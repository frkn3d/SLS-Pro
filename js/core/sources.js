/* SLS Pro — Yükseklik veri kaynakları
 *
 * Her kaynak bir arazi nesnesi (bkz. terrain.js) üretir. Yalnızca lisansı
 * ticari kullanıma ve yeniden dağıtıma izin veren açık veri kaynakları kullanılır;
 * zorunlu atıf metinleri arazi nesnesine ve dışa aktarılan meta veriye işlenir.
 */
(function (SLS) {
  'use strict';

  const SOURCES = {
    terrarium: {
      id: 'terrarium',
      nativeRes: 30,
      license: 'Open data (AWS Open Data Registry)',
      attribution: 'Terrain Tiles © Mapzen/Tilezen, AWS Open Data. Sources: SRTM (NASA), GMTED2010 (USGS), ETOPO1 (NOAA), EU-DEM (Copernicus), 3DEP (USGS) and others.',
      url: 'https://registry.opendata.aws/terrain-tiles/',
    },
    copernicus: {
      id: 'copernicus',
      nativeRes: 30,
      license: 'Copernicus DEM GLO-30 licence — free, worldwide, commercial use permitted',
      attribution: 'Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.',
      url: 'https://registry.opendata.aws/copernicus-dem/',
    },
    file: {
      id: 'file',
      nativeRes: null,
      license: 'User-supplied data',
      attribution: 'User-supplied DEM',
      url: null,
    },
  };

  async function pool(items, limit, worker) {
    let next = 0;
    const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
      while (next < items.length) { const i = next++; await worker(items[i], i); }
    });
    await Promise.all(runners);
  }

  function bilinear(arr, w, h, x, y) {
    if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return NaN;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
    const tx = x - x0, ty = y - y0;
    const a = arr[y0 * w + x0], b = arr[y0 * w + x1], c = arr[y1 * w + x0], d = arr[y1 * w + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  // ---------------------------------------------------------------------------
  // 1) AWS Terrain Tiles (Terrarium PNG) — CORS açık, tarayıcıdan doğrudan
  // ---------------------------------------------------------------------------
  const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

  function terrariumZoom(lat, cellSize) {
    for (let z = 8; z <= 15; z++) {
      const res = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
      if (res <= cellSize) return z;
    }
    return 15;
  }

  async function decodeTile(blob) {
    const bmp = await createImageBitmap(blob);
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(0, 0, 256, 256).data;
    const out = new Float32Array(256 * 256);
    for (let i = 0; i < out.length; i++) out[i] = (px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256) - 32768;
    return out;
  }

  async function fromTerrarium(bbox, cellSize, onProgress) {
    const grid = SLS.terrain.planGrid(bbox, cellSize);
    const z = terrariumZoom((bbox.south + bbox.north) / 2, cellSize);
    const [wx0, wy0] = SLS.proj.lonLatToWorld(bbox.west, bbox.north, z);
    const [wx1, wy1] = SLS.proj.lonLatToWorld(bbox.east, bbox.south, z);
    const tx0 = Math.floor(wx0 / 256) - 1, ty0 = Math.floor(wy0 / 256) - 1;
    const tx1 = Math.floor(wx1 / 256) + 1, ty1 = Math.floor(wy1 / 256) + 1;
    const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
    if (nx * ny > 900) throw new Error(SLS.i18n.t('terrain.tooBig'));

    const W = nx * 256, H = ny * 256;
    const mosaic = new Float32Array(W * H).fill(NaN);
    const jobs = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push([tx, ty]);
    let done = 0;
    await pool(jobs, 8, async ([tx, ty]) => {
      const url = TERRARIUM_URL.replace('{z}', z).replace('{x}', tx).replace('{y}', ty);
      try {
        const res = await fetch(url);
        if (res.ok) {
          const tile = await decodeTile(await res.blob());
          const ox = (tx - tx0) * 256, oy = (ty - ty0) * 256;
          for (let r = 0; r < 256; r++) mosaic.set(tile.subarray(r * 256, r * 256 + 256), (oy + r) * W + ox);
        }
      } catch (_) { /* eksik döşeme NaN kalır */ }
      onProgress('progress.tiles', ++done / jobs.length);
    });

    const offX = tx0 * 256 + 0.5, offY = ty0 * 256 + 0.5; // piksel merkezleri
    const sampler = (lon, lat) => {
      const [x, y] = SLS.proj.lonLatToWorld(lon, lat, z);
      return bilinear(mosaic, W, H, x - offX, y - offY);
    };
    const data = await SLS.terrain.resample(grid, sampler, (f) => onProgress('progress.resample', f));
    return finish(grid, data, 'terrarium', { zoom: z });
  }

  // ---------------------------------------------------------------------------
  // 2) Copernicus GLO-30 (Cloud Optimized GeoTIFF, AWS) — S3 kovası CORS
  //    başlığı vermediği için yerel serve.py vekil sunucusu üzerinden okunur.
  // ---------------------------------------------------------------------------
  function copName(lat, lon) {
    const la = (lat >= 0 ? 'N' : 'S') + String(Math.abs(lat)).padStart(2, '0');
    const lo = (lon >= 0 ? 'E' : 'W') + String(Math.abs(lon)).padStart(3, '0');
    const n = `Copernicus_DSM_COG_10_${la}_00_${lo}_00_DEM`;
    return `/proxy/copernicus30/${n}/${n}.tif`;
  }

  async function serverAvailable() {
    if (location.protocol === 'file:') return false;
    try {
      const r = await fetch('/proxy/health', { cache: 'no-store' });
      return r.ok;
    } catch (_) { return false; }
  }

  async function fromCopernicus(bbox, cellSize, onProgress) {
    if (!(await serverAvailable())) throw new Error(SLS.i18n.t('err.server'));
    const grid = SLS.terrain.planGrid(bbox, cellSize);
    const pad = 0.002;
    const tiles = [];
    for (let lat = Math.floor(bbox.south - pad); lat <= Math.floor(bbox.north + pad); lat++)
      for (let lon = Math.floor(bbox.west - pad); lon <= Math.floor(bbox.east + pad); lon++) tiles.push({ lat, lon });

    const loaded = new Map();
    let done = 0;
    await pool(tiles, 4, async (tl) => {
      try {
        const tiff = await GeoTIFF.fromUrl(copName(tl.lat, tl.lon), { allowFullFile: false });
        const img = await tiff.getImage();
        const [w0, s0, e0, n0] = img.getBoundingBox();
        const W = img.getWidth(), H = img.getHeight();
        const rx = (e0 - w0) / W, ry = (n0 - s0) / H;
        const c0 = Math.max(0, Math.floor((bbox.west - pad - w0) / rx) - 2);
        const c1 = Math.min(W, Math.ceil((bbox.east + pad - w0) / rx) + 2);
        const r0 = Math.max(0, Math.floor((n0 - bbox.north - pad) / ry) - 2);
        const r1 = Math.min(H, Math.ceil((n0 - bbox.south + pad) / ry) + 2);
        if (c1 > c0 && r1 > r0) {
          const [band] = await img.readRasters({ window: [c0, r0, c1, r1] });
          loaded.set(`${tl.lat},${tl.lon}`, { band, w: c1 - c0, h: r1 - r0, west: w0 + c0 * rx, north: n0 - r0 * ry, rx, ry });
        }
      } catch (_) { /* deniz/okyanus döşemeleri mevcut değil */ }
      onProgress('progress.cog', ++done / tiles.length);
    });
    if (!loaded.size) throw new Error(SLS.i18n.t('err.noData'));

    const sampler = (lon, lat) => {
      const tl = loaded.get(`${Math.floor(lat)},${Math.floor(lon)}`);
      if (!tl) return NaN;
      // GeoTIFF bbox piksel kenarlarını verir; piksel merkezine göre -0.5
      return bilinear(tl.band, tl.w, tl.h, (lon - tl.west) / tl.rx - 0.5, (tl.north - lat) / tl.ry - 0.5);
    };
    const data = await SLS.terrain.resample(grid, sampler, (f) => onProgress('progress.resample', f));
    return finish(grid, data, 'copernicus', {});
  }

  // ---------------------------------------------------------------------------
  // 3) Kullanıcının GeoTIFF dosyası (drone, LiDAR, kurum DEM'i)
  //    Metrik CRS ise doğal ızgara korunur; coğrafi ise UTM'e yeniden örneklenir.
  // ---------------------------------------------------------------------------
  async function fromFile(file, cellSizeIfGeographic, onProgress) {
    onProgress('progress.reading', 0.05);
    const tiff = await GeoTIFF.fromBlob(file);
    const img = await tiff.getImage();
    const keys = img.getGeoKeys() || {};
    const epsg = keys.ProjectedCSTypeGeoKey || keys.GeographicTypeGeoKey;
    const desc = epsg && epsg !== 32767 ? SLS.proj.describe(epsg) : null;
    if (!desc) throw new Error(SLS.i18n.t('err.crs', { epsg: epsg || '?' }));

    const W = img.getWidth(), H = img.getHeight();
    const f = Math.max(1, Math.ceil(Math.sqrt((W * H) / SLS.terrain.MAX_CELLS)));
    const w = Math.floor(W / f), h = Math.floor(H / f);
    onProgress('progress.reading', 0.3);
    const [band] = await img.readRasters({ width: w, height: h, resampleMethod: 'bilinear' });
    const nd = img.getGDALNoData();
    const data = new Float32Array(w * h);
    for (let i = 0; i < data.length; i++) {
      const v = band[i];
      data[i] = (nd !== null && v === nd) || v < -11000 || v > 9000 ? NaN : v;
    }
    const [ox, oy] = img.getOrigin();
    const [rx, ry] = img.getResolution();
    onProgress('progress.reading', 1);

    if (desc.metric && !desc.mercator) {
      // Doğal ızgara (drone/LiDAR çözünürlüğü korunur)
      const grid = { epsg, cellSize: Math.abs(rx) * f, originX: ox, originY: oy, width: w, height: h };
      return finish(grid, data, 'file', { fileName: file.name, nativeEpsg: epsg, downsample: f });
    }

    // Coğrafi (4326) veya Web Mercator (3857): UTM'e yeniden örnekle
    const srcConv = SLS.proj.converter(epsg);
    const sx = rx * f, sy = ry * f;
    const corners = [[ox, oy], [ox + sx * w, oy], [ox + sx * w, oy + sy * h], [ox, oy + sy * h]]
      .map((p) => (epsg === 4326 ? p : srcConv.inverse(p)));
    const bbox = SLS.terrain.bboxFromCorners(corners);
    const grid = SLS.terrain.planGrid(bbox, cellSizeIfGeographic);
    if (grid.tooBig) throw new Error(SLS.i18n.t('terrain.tooBig'));
    const sampler = (lon, lat) => {
      const [x, y] = epsg === 4326 ? [lon, lat] : srcConv.forward([lon, lat]);
      return bilinear(data, w, h, (x - ox) / sx - 0.5, (y - oy) / sy - 0.5);
    };
    const out = await SLS.terrain.resample(grid, sampler, (p) => onProgress('progress.resample', p));
    return finish(grid, out, 'file', { fileName: file.name, nativeEpsg: epsg, downsample: f });
  }

  function finish(grid, data, sourceId, extra) {
    const src = SOURCES[sourceId];
    const t = {
      width: grid.width, height: grid.height, cellSize: grid.cellSize,
      originX: grid.originX, originY: grid.originY, epsg: grid.epsg,
      data,
      source: Object.assign({ id: sourceId, license: src.license, url: src.url }, extra),
      attribution: src.attribution,
    };
    t.bboxWgs84 = SLS.terrain.bboxFromCorners(SLS.terrain.cornersWgs84(t));
    let valid = 0;
    for (const v of data) if (!Number.isNaN(v)) { valid++; break; }
    if (!valid) throw new Error(SLS.i18n.t('err.noData'));
    return t;
  }

  SLS.sources = { SOURCES, fromTerrarium, fromCopernicus, fromFile, serverAvailable, TERRARIUM_URL };
})(window.SLS = window.SLS || {});
