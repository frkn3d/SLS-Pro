/* SLS Pro — Arazi Motoru (ortak çekirdek)
 *
 * Tüm modüllerin kullandığı tek arazi veri modeli:
 *   {
 *     width, height,           // hücre sayısı
 *     cellSize,                // metre
 *     originX, originY,        // sol-üst köşe (projeksiyon koordinatı, metre)
 *     epsg,                    // metrik CRS
 *     data: Float32Array,      // satır-öncelikli, kuzeyden güneye; NaN = veri yok
 *     source, attribution,     // kaynak ve zorunlu atıf metni
 *     bboxWgs84: {west,south,east,north}
 *   }
 */
(function (SLS) {
  'use strict';

  const MAX_CELLS = 12_000_000;

  /** Lon/lat kutusundan UTM ızgara planı çıkarır. */
  function planGrid(bbox, cellSize) {
    const epsg = SLS.proj.utmEpsgFor((bbox.west + bbox.east) / 2, (bbox.south + bbox.north) / 2);
    const conv = SLS.proj.converter(epsg);
    const pts = [];
    for (let i = 0; i <= 4; i++) {
      const fx = i / 4;
      const lon = bbox.west + (bbox.east - bbox.west) * fx;
      const lat = bbox.south + (bbox.north - bbox.south) * fx;
      pts.push([lon, bbox.south], [lon, bbox.north], [bbox.west, lat], [bbox.east, lat]);
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      const [x, y] = conv.forward(p);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    // Hücre sınırlarını hücre boyutunun katlarına oturt (QGIS'te temiz hizalama)
    const originX = Math.floor(minX / cellSize) * cellSize;
    const originY = Math.ceil(maxY / cellSize) * cellSize;
    const width = Math.max(2, Math.ceil((maxX - originX) / cellSize));
    const height = Math.max(2, Math.ceil((originY - minY) / cellSize));
    return { epsg, cellSize, originX, originY, width, height, cells: width * height, tooBig: width * height > MAX_CELLS };
  }

  /**
   * Izgara hücre merkezlerini lon/lat'a çevirip sampler(lon, lat) ile doldurur.
   * Ters projeksiyon her 16 hücrede bir hesaplanır, arası çift doğrusal
   * enterpolasyonla bulunur (UTM→WGS84 bu ölçekte pürüzsüz; hata << 1 mm).
   */
  async function resample(grid, sampler, onProgress) {
    const { width, height, cellSize, originX, originY } = grid;
    const conv = SLS.proj.converter(grid.epsg);
    const STEP = 16;
    const lw = Math.ceil(width / STEP) + 1;
    const lh = Math.ceil(height / STEP) + 1;
    const lat = new Float64Array(lw * lh);
    const lon = new Float64Array(lw * lh);
    for (let j = 0; j < lh; j++) {
      for (let i = 0; i < lw; i++) {
        const x = originX + (i * STEP + 0.5) * cellSize;
        const y = originY - (j * STEP + 0.5) * cellSize;
        const ll = conv.inverse([x, y]);
        lon[j * lw + i] = ll[0];
        lat[j * lw + i] = ll[1];
      }
    }
    const data = new Float32Array(width * height);
    for (let r = 0; r < height; r++) {
      const jf = r / STEP, j0 = Math.floor(jf), ty = jf - j0;
      for (let c = 0; c < width; c++) {
        const ifl = c / STEP, i0 = Math.floor(ifl), tx = ifl - i0;
        const a = j0 * lw + i0, b = a + 1, d = a + lw, e = d + 1;
        const lo = (lon[a] * (1 - tx) + lon[b] * tx) * (1 - ty) + (lon[d] * (1 - tx) + lon[e] * tx) * ty;
        const la = (lat[a] * (1 - tx) + lat[b] * tx) * (1 - ty) + (lat[d] * (1 - tx) + lat[e] * tx) * ty;
        data[r * width + c] = sampler(lo, la);
      }
      if (onProgress && (r & 63) === 0) {
        onProgress(r / height);
        await new Promise((res) => setTimeout(res, 0)); // arayüzü dondurma
      }
    }
    return data;
  }

  /** Horn (1981) yöntemiyle eğim (°) ve bakı (° kuzeyden saat yönü). */
  function slopeAspect(t) {
    const { width: w, height: h, data, cellSize: cs } = t;
    const slope = new Float32Array(w * h);
    const aspect = new Float32Array(w * h);
    const at = (r, c) => {
      r = r < 0 ? 0 : r >= h ? h - 1 : r;
      c = c < 0 ? 0 : c >= w ? w - 1 : c;
      return data[r * w + c];
    };
    const k = 180 / Math.PI;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const z1 = at(r - 1, c - 1), z2 = at(r - 1, c), z3 = at(r - 1, c + 1);
        const z4 = at(r, c - 1), z6 = at(r, c + 1);
        const z7 = at(r + 1, c - 1), z8 = at(r + 1, c), z9 = at(r + 1, c + 1);
        const dzdx = ((z3 + 2 * z6 + z9) - (z1 + 2 * z4 + z7)) / (8 * cs);
        const dzdy = ((z1 + 2 * z2 + z3) - (z7 + 2 * z8 + z9)) / (8 * cs); // kuzey pozitif
        const i = r * w + c;
        if (Number.isNaN(dzdx) || Number.isNaN(dzdy)) { slope[i] = NaN; aspect[i] = NaN; continue; }
        slope[i] = Math.atan(Math.hypot(dzdx, dzdy)) * k;
        // Bakı: yokuş aşağı yönün pusula açısı
        let a = Math.atan2(-dzdx, -dzdy) * k;
        aspect[i] = a < 0 ? a + 360 : a;
      }
    }
    return { slope, aspect };
  }

  // Çığ eğim sınıfları (uluslararası çığ eğitimi lejantlarıyla uyumlu)
  const SLOPE_CLASSES = [
    { min: 27, max: 30, color: [182, 227, 91] },
    { min: 30, max: 35, color: [246, 217, 59] },
    { min: 35, max: 40, color: [243, 156, 50] },
    { min: 40, max: 45, color: [224, 69, 47] },
    { min: 45, max: 50, color: [178, 51, 138] },
    { min: 50, max: 90, color: [90, 63, 156] },
  ];

  function stats(t, slope) {
    let min = Infinity, max = -Infinity, sum = 0, n = 0;
    for (const v of t.data) {
      if (Number.isNaN(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v; n++;
    }
    const bins = [0, 15, 30, 45, 60, 90];
    const hist = new Array(bins.length - 1).fill(0);
    let sn = 0;
    for (const s of slope) {
      if (Number.isNaN(s)) continue;
      sn++;
      for (let b = 0; b < hist.length; b++) if (s >= bins[b] && s < bins[b + 1]) { hist[b]++; break; }
    }
    return {
      min, max, mean: n ? sum / n : NaN, valid: n,
      slopeBins: bins,
      slopeHist: hist.map((x) => (sn ? x / sn : 0)),
      criticalFraction: sn ? hist[2] / sn : 0, // 30–45°
      areaKm2: (t.width * t.height * t.cellSize * t.cellSize) / 1e6,
    };
  }

  /** Eğim sınıflarını RGBA kanvasa boyar; harita bindirmesi için dataURL döner. */
  function slopeOverlay(t, slope) {
    const cv = document.createElement('canvas');
    cv.width = t.width; cv.height = t.height;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(t.width, t.height);
    const px = img.data;
    for (let i = 0; i < slope.length; i++) {
      const s = slope[i];
      if (Number.isNaN(s)) continue;
      for (const cl of SLOPE_CLASSES) {
        if (s >= cl.min && s < cl.max) {
          px[i * 4] = cl.color[0]; px[i * 4 + 1] = cl.color[1]; px[i * 4 + 2] = cl.color[2]; px[i * 4 + 3] = 200;
          break;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  }

  /** Izgaranın dört köşesi WGS84'te [TL, TR, BR, BL] (MapLibre image kaynağı sırası). */
  function cornersWgs84(t) {
    const conv = SLS.proj.converter(t.epsg);
    const x0 = t.originX, y0 = t.originY;
    const x1 = x0 + t.width * t.cellSize, y1 = y0 - t.height * t.cellSize;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map((p) => conv.inverse(p));
  }

  function bboxFromCorners(c) {
    const lons = c.map((p) => p[0]), lats = c.map((p) => p[1]);
    return { west: Math.min(...lons), east: Math.max(...lons), south: Math.min(...lats), north: Math.max(...lats) };
  }

  // ---------- Dışa aktarım ----------

  function download(name, parts, type) {
    const blob = new Blob(parts, { type: type || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function exportAsc(t, baseName) {
    const NODATA = -9999;
    const parts = [
      `ncols ${t.width}\nnrows ${t.height}\n` +
      `xllcorner ${t.originX.toFixed(3)}\nyllcorner ${(t.originY - t.height * t.cellSize).toFixed(3)}\n` +
      `cellsize ${t.cellSize}\nNODATA_value ${NODATA}\n`,
    ];
    const row = new Array(t.width);
    for (let r = 0; r < t.height; r++) {
      for (let c = 0; c < t.width; c++) {
        const v = t.data[r * t.width + c];
        row[c] = Number.isNaN(v) ? NODATA : v.toFixed(2);
      }
      parts.push(row.join(' ') + '\n');
    }
    download(baseName + '.asc', parts, 'text/plain');
    const d = SLS.proj.describe(t.epsg);
    if (d && d.wkt) setTimeout(() => download(baseName + '.prj', [d.wkt], 'text/plain'), 300);
  }

  function metadata(t, st) {
    const d = SLS.proj.describe(t.epsg);
    return {
      format: 'sls-terrain',
      version: 1,
      origin_x: t.originX,
      origin_y: t.originY,
      origin_ref: 'top-left corner of top-left cell',
      cell_size: t.cellSize,
      width: t.width,
      height: t.height,
      epsg: t.epsg,
      crs_name: d ? d.name : null,
      bbox_wgs84: t.bboxWgs84,
      elevation: st ? { min: st.min, max: st.max, mean: st.mean } : undefined,
      source: t.source,
      attribution: t.attribution,
      created: new Date().toISOString(),
      generator: 'SLS Pro ' + SLS.VERSION,
    };
  }

  function exportJson(t, st, baseName) {
    download(baseName + '.json', [JSON.stringify(metadata(t, st), null, 2)], 'application/json');
  }

  SLS.terrain = {
    MAX_CELLS, SLOPE_CLASSES,
    planGrid, resample, slopeAspect, stats, slopeOverlay, cornersWgs84, bboxFromCorners,
    exportAsc, exportJson, metadata,
  };
})(window.SLS = window.SLS || {});
