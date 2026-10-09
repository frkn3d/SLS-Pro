/* SLS Pro — LiDAR nokta bulutu (LAS / LAZ) → sayısal yükseklik modeli
 * LAS doğrudan okunur; LAZ için laz-perf (Apache-2.0, WASM) gerektiğinde yüklenir.
 * Zemin noktaları (sınıf 2) varsa yalnızca onlar, yoksa gürültü (7, 18) dışındaki tüm noktalar kullanılır.
 * Hücre değeri: noktaların ortalaması; boş hücreler komşu ortalamasıyla doldurulur.
 */
(function (SLS) {
  'use strict';

  const LAZPERF = 'https://cdn.jsdelivr.net/npm/laz-perf@0.0.6/lib/web/';
  let lazP = null;
  function lazPerf() {
    if (!lazP) {
      lazP = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = LAZPERF + 'laz-perf.js';
        s.onload = () => window.createLazPerf({ locateFile: (f) => LAZPERF + f }).then(res, rej);
        s.onerror = () => { lazP = null; rej(new Error('laz-perf')); };
        document.head.appendChild(s);
      });
    }
    return lazP;
  }

  /** WKT'nin en üst düzey (PROJCS / GEOGCS) AUTHORITY kodu; alt düğümlerdekiler (birim, datum) yok sayılır. */
  function topAuthority(wkt) {
    let depth = 0;
    for (let i = 0; i < wkt.length; i++) {
      const ch = wkt[i];
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
      else if (depth === 1 && wkt.startsWith('AUTHORITY[', i)) {
        const m = wkt.slice(i).match(/^AUTHORITY\["EPSG",\s*"?(\d+)"?\]/);
        if (m) return Number(m[1]);
      }
    }
    return null;
  }

  function header(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'LASF') throw new Error('not-las');
    const h = {
      major: u8[24], minor: u8[25],
      headerSize: dv.getUint16(94, true), pointOffset: dv.getUint32(96, true), nVlr: dv.getUint32(100, true),
      pointFormat: u8[104] & 0x3f, compressed: (u8[104] & 0x80) !== 0, recordLength: dv.getUint16(105, true),
      count: dv.getUint32(107, true),
      scale: [dv.getFloat64(131, true), dv.getFloat64(139, true), dv.getFloat64(147, true)],
      offset: [dv.getFloat64(155, true), dv.getFloat64(163, true), dv.getFloat64(171, true)],
      maxX: dv.getFloat64(179, true), minX: dv.getFloat64(187, true), maxY: dv.getFloat64(195, true), minY: dv.getFloat64(203, true),
      maxZ: dv.getFloat64(211, true), minZ: dv.getFloat64(219, true),
      epsg: null,
    };
    if (!h.count && h.minor >= 4 && h.headerSize >= 255) h.count = Number(dv.getBigUint64(247, true));
    // VLR: GeoKeyDirectory (34735) veya OGC WKT (2112) → EPSG
    let off = h.headerSize;
    for (let k = 0; k < h.nVlr && off + 54 <= buf.byteLength; k++) {
      const uid = String.fromCharCode(...u8.subarray(off + 2, off + 18)).replace(/\0.*$/, '');
      const rid = dv.getUint16(off + 18, true), len = dv.getUint16(off + 20, true), d = off + 54;
      if (uid === 'LASF_Projection' && rid === 34735) {
        const n = dv.getUint16(d + 6, true);
        for (let j = 0; j < n; j++) {
          const key = dv.getUint16(d + 8 + 8 * j, true), val = dv.getUint16(d + 8 + 8 * j + 6, true);
          if ((key === 3072 || key === 2048) && val > 0 && val !== 32767 && !h.epsg) h.epsg = val;
        }
      } else if (rid === 2112 && !h.wkt) {
        h.wkt = new TextDecoder().decode(u8.subarray(d, d + len)).replace(/\0+$/, '').trim();
        const top = topAuthority(h.wkt);
        if (top && !h.epsg) h.epsg = top;
      }
      off = d + len;
    }
    return h;
  }

  /** Nokta yineleyici: cb(X, Y, Z, sınıf) */
  async function eachPoint(buf, h, cb, onProgress) {
    const clsOff = h.pointFormat >= 6 ? 16 : 15, clsMask = h.pointFormat >= 6 ? 0xff : 0x1f;
    const [sx, sy, sz] = h.scale, [ox, oy, oz] = h.offset;
    if (!h.compressed) {
      const dv = new DataView(buf);
      for (let i = 0; i < h.count; i++) {
        const p = h.pointOffset + i * h.recordLength;
        cb(dv.getInt32(p, true) * sx + ox, dv.getInt32(p + 4, true) * sy + oy, dv.getInt32(p + 8, true) * sz + oz, dv.getUint8(p + clsOff) & clsMask);
        if ((i & 0x3ffff) === 0 && onProgress) { onProgress(i / h.count); await new Promise((r) => setTimeout(r, 0)); }
      }
      return;
    }
    const M = await lazPerf();
    const src = M._malloc(buf.byteLength);
    M.HEAPU8.set(new Uint8Array(buf), src);
    const las = new M.LASZip();
    const dst = M._malloc(h.recordLength);
    try {
      las.open(src, buf.byteLength);
      const n = las.getCount();
      for (let i = 0; i < n; i++) {
        las.getPoint(dst);
        const dv = new DataView(M.HEAPU8.buffer, dst, h.recordLength);
        cb(dv.getInt32(0, true) * sx + ox, dv.getInt32(4, true) * sy + oy, dv.getInt32(8, true) * sz + oz, dv.getUint8(clsOff) & clsMask);
        if ((i & 0x3ffff) === 0 && onProgress) { onProgress(i / n); await new Promise((r) => setTimeout(r, 0)); }
      }
    } finally {
      las.delete(); M._free(dst); M._free(src);
    }
  }

  /**
   * file → arazi nesnesi. o = { cellSize, epsg (dosyada yoksa), onProgress }
   */
  async function toTerrain(file, o) {
    const P = o.onProgress || (() => {});
    P('progress.reading', 0.02);
    const buf = await file.arrayBuffer();
    const h = header(buf);
    const srcEpsg = Number(o.epsg) || h.epsg || null;
    let desc = srcEpsg ? SLS.proj.describe(srcEpsg) : null;
    if (srcEpsg && !desc) { try { desc = await SLS.proj.fetchDef(srcEpsg); } catch (_) { desc = null; } }
    if (!desc && h.wkt && /^PROJCS\[/.test(h.wkt)) {
      // EPSG kodu olmayan WKT: proj4js WKT'yi doğrudan okur; birim çarpanı PROJCS'in UNIT tanımından
      try {
        proj4(h.wkt, 'EPSG:4326').forward([(h.minX + h.maxX) / 2, (h.minY + h.maxY) / 2]);
        const units = [...h.wkt.matchAll(/UNIT\["[^"]*",\s*([\d.]+)/g)];
        const uf = units.length ? Number(units[units.length - 1][1]) : 1;
        desc = { epsg: null, name: 'WKT', proj4: h.wkt, metric: false, unitFactor: uf, dynamic: true };
      } catch (_) { desc = null; }
    }
    if (!desc) { const e = new Error(SLS.i18n.t('las.crsNeeded', { epsg: h.epsg || '?' })); e.code = 'crs'; throw e; }
    // Metrik ve destekli → doğal ızgara; aksi halde (feet, coğrafi, eğik) noktalar WGS84 / UTM'e dönüştürülür
    const native = desc.metric && !desc.mercator;
    let epsg = srcEpsg, tf = null, zf = 1;
    let minX = h.minX, maxX = h.maxX, minY = h.minY, maxY = h.maxY;
    if (!native) {
      const toLL = proj4(desc.proj4, 'EPSG:4326');
      const cLL = toLL.forward([(h.minX + h.maxX) / 2, (h.minY + h.maxY) / 2]);
      epsg = SLS.proj.utmEpsgFor(cLL[0], cLL[1]);
      const utm = SLS.proj.converter(epsg);
      tf = (x, y) => utm.forward(toLL.forward([x, y]));
      zf = desc.unitFactor || 1;                       // yatay birim feet ise düşey de feet kabul edilir
      const cs4 = [[h.minX, h.minY], [h.maxX, h.minY], [h.maxX, h.maxY], [h.minX, h.maxY]].map(([x, y]) => tf(x, y));
      minX = Math.min(...cs4.map((p) => p[0])); maxX = Math.max(...cs4.map((p) => p[0]));
      minY = Math.min(...cs4.map((p) => p[1])); maxY = Math.max(...cs4.map((p) => p[1]));
    }
    const cs = o.cellSize;
    const originX = Math.floor(minX / cs) * cs, originY = Math.ceil(maxY / cs) * cs;
    const W = Math.max(2, Math.ceil((maxX - originX) / cs)), H = Math.max(2, Math.ceil((originY - minY) / cs));
    if (W * H > SLS.terrain.MAX_CELLS) throw new Error(SLS.i18n.t('terrain.tooBig'));
    const N = W * H;
    const sumG = new Float64Array(N), cntG = new Uint32Array(N), sumA = new Float64Array(N), cntA = new Uint32Array(N);
    let nAll = 0, nGround = 0;
    await eachPoint(buf, h, (x, y, z, cl) => {
      if (cl === 7 || cl === 18) return;              // gürültü
      if (tf) { const p = tf(x, y); x = p[0]; y = p[1]; z *= zf; }
      const c = Math.floor((x - originX) / cs), r = Math.floor((originY - y) / cs);
      if (c < 0 || r < 0 || c >= W || r >= H) return;
      const i = r * W + c;
      sumA[i] += z; cntA[i]++; nAll++;
      if (cl === 2) { sumG[i] += z; cntG[i]++; nGround++; }
    }, (f) => P('progress.points', f));
    const useGround = nGround > 0.001 * nAll;
    const data = new Float32Array(N).fill(NaN);
    for (let i = 0; i < N; i++) {
      if (useGround ? cntG[i] : cntA[i]) data[i] = useGround ? sumG[i] / cntG[i] : sumA[i] / cntA[i];
    }
    // Boşlukları doldur: en az 2 dolu komşusu olan boş hücre, komşu ortalaması (en fazla 40 geçiş)
    let filled = 0;
    for (let pass = 0; pass < 40; pass++) {
      const add = [];
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const i = r * W + c;
        if (!Number.isNaN(data[i])) continue;
        let s = 0, k = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue;
          const v = data[rr * W + cc];
          if (!Number.isNaN(v)) { s += v; k++; }
        }
        if (k >= 2) add.push(i, s / k);
      }
      if (!add.length) break;
      for (let j = 0; j < add.length; j += 2) data[add[j]] = add[j + 1];
      filled += add.length / 2;
    }
    P('progress.reading', 1);
    const grid = { epsg, cellSize: cs, originX, originY, width: W, height: H };
    return SLS.sources.finish(grid, data, 'lidar', { fileName: file.name, points: nAll, groundPoints: useGround ? nGround : 0, usedGround: useGround, filledCells: filled, compressed: h.compressed, nativeEpsg: srcEpsg, reprojected: !native });
  }

  SLS.las = { header, toTerrain, lazPerf };
})(window.SLS = window.SLS || {});
