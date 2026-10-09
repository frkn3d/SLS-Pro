/* SLS Pro — Arazi örtüsü (ESA WorldCover 10 m, 2021, CC BY 4.0)
 *
 * Veri Microsoft Planetary Computer üzerinden okunur: anonim SAS belirteci alınır,
 * 3°×3° Cloud Optimized GeoTIFF döşemelerinden yalnızca gereken pencere indirilir
 * (HTTP Range). Sınıflar arazi ızgarasına en yakın komşu ile örneklenir.
 */
(function (SLS) {
  'use strict';

  const TOKEN_URL = 'https://planetarycomputer.microsoft.com/api/sas/v1/token/esa-worldcover';
  const BLOB = 'https://ai4edataeuwest.blob.core.windows.net/esa-worldcover/v200/2021/map/';

  const CLASSES = {
    10: { key: 'lc.tree', color: [0, 100, 0] },
    20: { key: 'lc.shrub', color: [255, 187, 34] },
    30: { key: 'lc.grass', color: [255, 255, 76] },
    40: { key: 'lc.crop', color: [240, 150, 255] },
    50: { key: 'lc.built', color: [250, 0, 0] },
    60: { key: 'lc.bare', color: [180, 180, 180] },
    70: { key: 'lc.snow', color: [240, 240, 240] },
    80: { key: 'lc.water', color: [0, 100, 200] },
    90: { key: 'lc.wetland', color: [0, 150, 160] },
    95: { key: 'lc.mangrove', color: [0, 207, 117] },
    100: { key: 'lc.moss', color: [250, 230, 160] },
  };
  const FOREST = 10;

  const SOURCE = {
    license: 'CC BY 4.0',
    attribution: '© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. Accessed via Microsoft Planetary Computer.',
    url: 'https://esa-worldcover.org/',
  };

  let token = null, tokenExpiry = 0;
  async function getToken() {
    if (token && Date.now() < tokenExpiry - 60000) return token;
    const r = await fetch(TOKEN_URL);
    if (!r.ok) throw new Error('WorldCover token ' + r.status);
    const j = await r.json();
    token = j.token;
    tokenExpiry = Date.parse(j['msft:expiry']) || Date.now() + 30 * 60000;
    return token;
  }

  function tileName(lat, lon) {
    const la = Math.floor(lat / 3) * 3, lo = Math.floor(lon / 3) * 3;
    const ns = (la >= 0 ? 'N' : 'S') + String(Math.abs(la)).padStart(2, '0');
    const ew = (lo >= 0 ? 'E' : 'W') + String(Math.abs(lo)).padStart(3, '0');
    return { key: `${la},${lo}`, name: `ESA_WorldCover_10m_2021_v200_${ns}${ew}_Map.tif` };
  }

  /** Arazi ızgarası için sınıf dizisi (Uint8Array, 0 = veri yok). */
  async function fetchForTerrain(t, onProgress) {
    const b = t.bboxWgs84, pad = 0.002;
    const tk = await getToken();
    const tiles = new Map();
    const la0 = Math.floor((b.south - pad) / 3) * 3, la1 = Math.floor((b.north + pad) / 3) * 3;
    const lo0 = Math.floor((b.west - pad) / 3) * 3, lo1 = Math.floor((b.east + pad) / 3) * 3;
    for (let la = la0; la <= la1; la += 3)
      for (let lo = lo0; lo <= lo1; lo += 3) { const tn = tileName(la, lo); tiles.set(tn.key, tn); }
    const loaded = new Map();
    let done = 0;
    for (const tn of tiles.values()) {
      try {
        const tiff = await GeoTIFF.fromUrl(BLOB + tn.name + '?' + tk, { allowFullFile: false });
        const img = await tiff.getImage();
        const [w0, s0, e0, n0] = img.getBoundingBox();
        const W = img.getWidth(), H = img.getHeight();
        const rx = (e0 - w0) / W, ry = (n0 - s0) / H;
        const c0 = Math.max(0, Math.floor((b.west - pad - w0) / rx));
        const c1 = Math.min(W, Math.ceil((b.east + pad - w0) / rx));
        const r0 = Math.max(0, Math.floor((n0 - b.north - pad) / ry));
        const r1 = Math.min(H, Math.ceil((n0 - b.south + pad) / ry));
        if (c1 > c0 && r1 > r0) {
          const [band] = await img.readRasters({ window: [c0, r0, c1, r1] });
          loaded.set(tn.key, { band, w: c1 - c0, h: r1 - r0, west: w0 + c0 * rx, north: n0 - r0 * ry, rx, ry });
        }
      } catch (e) { console.warn('WorldCover', tn.name, e); }
      onProgress && onProgress(++done / tiles.size);
    }
    if (!loaded.size) throw new Error(SLS.i18n.t('lc.err'));
    const sampler = (lon, lat) => {
      const tl = loaded.get(tileName(lat, lon).key);
      if (!tl) return 0;
      const c = Math.floor((lon - tl.west) / tl.rx), r = Math.floor((tl.north - lat) / tl.ry);
      if (c < 0 || r < 0 || c >= tl.w || r >= tl.h) return 0;
      return tl.band[r * tl.w + c];
    };
    const f = await SLS.terrain.resample(t, sampler);
    const out = new Uint8Array(f.length);
    for (let i = 0; i < f.length; i++) out[i] = f[i];
    return out;
  }

  function stats(classes) {
    const counts = {};
    let n = 0;
    for (const c of classes) { if (!c) continue; counts[c] = (counts[c] || 0) + 1; n++; }
    return { counts, total: n, forestFraction: n ? (counts[FOREST] || 0) / n : 0 };
  }

  SLS.landcover = { CLASSES, FOREST, SOURCE, fetchForTerrain, stats };
})(window.SLS = window.SLS || {});
