/* SLS Pro — Sürtünme parametre kitaplığı
 *
 * Kuru kar akışları için μ ve ξ değerleri, RAMMS::AVALANCHE kullanıcı kılavuzundaki
 * MuXi tablosundan alınmıştır (WSL/SLF, RAMMS::Avalanche 1.4, Ek 7.1). Tablo:
 *   hacim sınıfı (çok küçük < 5 000 m³, küçük 5–25 000, orta 25–60 000, büyük > 60 000)
 *   × tekerrür süresi (10, 30, 100, 300 yıl)
 *   × kot bandı (üst sınırın üstü, iki sınır arası, alt sınırın altı; Alpler için 1500 / 1000 m)
 *   × arazi sınıfı (açık yamaç / kanal / oluk / düz)
 *   Orman: μ + 0,02, ξ = 400 m/s².
 * Islak ve yoğun kar düzeltmeleri RAMMS tablosunda yoktur; SLS tahminidir ve öyle işaretlenir.
 * Kullanıcı kendi gözlemleriyle kalibre ettiği setleri kaydedebilir (tekdüze değer veya ölçek çarpanı).
 */
(function (SLS) {
  'use strict';

  const USER_STORE = 'sls.paramSets';
  const TERRAIN = ['open', 'channelled', 'gully', 'flat'];
  const BANDS = ['high', 'mid', 'low'];        // üst sınırın üstü, arası, alt sınırın altı
  const RPS = [300, 100, 30, 10];

  // [μ, ξ] — sırası: RPS (300, 100, 30, 10)
  const MUXI = {
    large: {
      open: { high: [[0.155, 3000], [0.165, 3000], [0.17, 3000], [0.18, 3000]], mid: [[0.17, 2500], [0.18, 2500], [0.19, 2500], [0.2, 2500]], low: [[0.19, 2000], [0.2, 2000], [0.21, 2000], [0.22, 2000]] },
      channelled: { high: [[0.21, 2000], [0.22, 2000], [0.225, 2000], [0.235, 2000]], mid: [[0.22, 1750], [0.23, 1750], [0.24, 1750], [0.25, 1750]], low: [[0.24, 1500], [0.25, 1500], [0.26, 1500], [0.27, 1500]] },
      gully: { high: [[0.27, 1500], [0.28, 1500], [0.29, 1500], [0.3, 1500]], mid: [[0.285, 1350], [0.3, 1350], [0.31, 1350], [0.325, 1350]], low: [[0.3, 1200], [0.315, 1200], [0.33, 1200], [0.345, 1200]] },
      flat: { high: [[0.14, 4000], [0.15, 4000], [0.155, 4000], [0.16, 4000]], mid: [[0.15, 3500], [0.16, 3500], [0.17, 3500], [0.18, 3500]], low: [[0.17, 3000], [0.18, 3000], [0.19, 3000], [0.2, 3000]] },
    },
    medium: {
      open: { high: [[0.195, 2500], [0.205, 2500], [0.215, 2500], [0.225, 2500]], mid: [[0.21, 2100], [0.22, 2100], [0.23, 2100], [0.24, 2100]], low: [[0.23, 1750], [0.24, 1750], [0.25, 1750], [0.26, 1750]] },
      channelled: { high: [[0.25, 1750], [0.26, 1750], [0.27, 1750], [0.28, 1750]], mid: [[0.27, 1530], [0.28, 1530], [0.285, 1530], [0.295, 1530]], low: [[0.28, 1350], [0.29, 1350], [0.3, 1350], [0.31, 1350]] },
      gully: { high: [[0.32, 1350], [0.33, 1350], [0.34, 1350], [0.35, 1350]], mid: [[0.33, 1200], [0.34, 1200], [0.355, 1200], [0.36, 1200]], low: [[0.36, 1100], [0.37, 1100], [0.38, 1100], [0.39, 1100]] },
      flat: { high: [[0.17, 3250], [0.18, 3250], [0.19, 3250], [0.2, 3250]], mid: [[0.19, 2900], [0.2, 2900], [0.21, 2900], [0.22, 2900]], low: [[0.21, 2500], [0.22, 2500], [0.23, 2500], [0.24, 2500]] },
    },
    small: {
      open: { high: [[0.235, 2000], [0.245, 2000], [0.25, 2000], [0.26, 2000]], mid: [[0.25, 1750], [0.26, 1750], [0.265, 1750], [0.275, 1750]], low: [[0.265, 1500], [0.275, 1500], [0.285, 1500], [0.295, 1500]] },
      channelled: { high: [[0.28, 1500], [0.29, 1500], [0.3, 1500], [0.31, 1500]], mid: [[0.3, 1350], [0.31, 1350], [0.315, 1350], [0.325, 1350]], low: [[0.31, 1200], [0.32, 1200], [0.33, 1200], [0.34, 1200]] },
      gully: { high: [[0.37, 1200], [0.38, 1200], [0.39, 1200], [0.4, 1200]], mid: [[0.38, 1100], [0.39, 1100], [0.4, 1100], [0.41, 1100]], low: [[0.4, 1000], [0.41, 1000], [0.42, 1000], [0.43, 1000]] },
      flat: { high: [[0.215, 2500], [0.225, 2500], [0.23, 2500], [0.24, 2500]], mid: [[0.23, 2250], [0.24, 2250], [0.245, 2250], [0.255, 2250]], low: [[0.245, 2000], [0.255, 2000], [0.26, 2000], [0.27, 2000]] },
    },
    tiny: {
      open: { high: [[0.275, 1500], [0.28, 1500], [0.285, 1500], [0.29, 1500]], mid: [[0.29, 1400], [0.295, 1400], [0.3, 1400], [0.305, 1400]], low: [[0.3, 1250], [0.31, 1250], [0.32, 1250], [0.33, 1250]] },
      channelled: { high: [[0.31, 1250], [0.32, 1250], [0.33, 1250], [0.34, 1250]], mid: [[0.33, 1180], [0.34, 1180], [0.345, 1180], [0.355, 1180]], low: [[0.34, 1050], [0.35, 1050], [0.36, 1050], [0.37, 1050]] },
      gully: { high: [[0.42, 1050], [0.43, 1050], [0.44, 1050], [0.45, 1050]], mid: [[0.43, 1000], [0.44, 1000], [0.45, 1000], [0.46, 1000]], low: [[0.44, 900], [0.45, 900], [0.46, 900], [0.47, 900]] },
      flat: { high: [[0.26, 1750], [0.265, 1750], [0.27, 1750], [0.275, 1750]], mid: [[0.27, 1600], [0.275, 1600], [0.28, 1600], [0.285, 1600]], low: [[0.28, 1500], [0.285, 1500], [0.29, 1500], [0.295, 1500]] },
    },
  };
  const FOREST = { dMu: 0.02, xi: 400 };

  const VOLUME = [
    { id: 'tiny', max: 5000 },
    { id: 'small', max: 25000 },
    { id: 'medium', max: 60000 },
    { id: 'large', max: Infinity },
  ];
  // Kar tipi düzeltmeleri (RAMMS tablosu kuru kar içindir; ıslak / yoğun için SLS tahmini)
  const SNOW = {
    dry: { dMu: 0, xiF: 1, rho: 300, powder: true, estimate: false },
    dense: { dMu: 0.03, xiF: 0.8, rho: 350, powder: false, estimate: true },
    wet: { dMu: 0.08, xiF: 0.4, rho: 450, powder: false, estimate: true },
  };

  function volumeClass(v) { return VOLUME.find((c) => v < c.max) || VOLUME[VOLUME.length - 1]; }
  function rpIndex(T) { const k = RPS.indexOf(Number(T)); return k >= 0 ? k : 1; }
  function band(z, limits) { return z > limits.upper ? 'high' : z >= limits.lower ? 'mid' : 'low'; }

  /** Tek değer (gösterim / tekdüze kullanım için). */
  function lookup(snowType, T, releaseVolume, terrainClass, bandId) {
    const vc = volumeClass(releaseVolume || 1e9), s = SNOW[snowType] || SNOW.dry;
    const [mu, xi] = MUXI[vc.id][terrainClass || 'open'][bandId || 'high'][rpIndex(T)];
    return { mu: +(mu + s.dMu).toFixed(3), xi: Math.round(xi * s.xiF), rho: s.rho, powderAllowed: s.powder, volumeClass: vc.id, estimate: s.estimate, source: 'library' };
  }

  // ---------------------------------------------------------------------------
  /**
   * Arazi sınıflandırması (RAMMS yaklaşımına benzer): eğim ve topoğrafik konum indeksi (TPI = z − çevre ortalaması).
   * düz: eğim < 15° · oluk: TPI < −8 m · kanal: TPI < −2,5 m · aksi halde açık yamaç. Yarıçap ≈ 60 m.
   * Kod: 0 açık, 1 kanal, 2 oluk, 3 düz
   */
  function classifyTerrain(t, slope, opts) {
    const W = t.width, H = t.height, N = W * H, z = t.data;
    const R = Math.max(2, Math.round((opts && opts.radius || 60) / t.cellSize));
    // Toplam alan tablosu (NaN hücreler hariç)
    const S = new Float64Array((W + 1) * (H + 1)), C = new Float64Array((W + 1) * (H + 1));
    for (let r = 0; r < H; r++) {
      let rs = 0, rc = 0;
      for (let c = 0; c < W; c++) {
        const v = z[r * W + c];
        if (Number.isFinite(v)) { rs += v; rc++; }
        S[(r + 1) * (W + 1) + c + 1] = S[r * (W + 1) + c + 1] + rs;
        C[(r + 1) * (W + 1) + c + 1] = C[r * (W + 1) + c + 1] + rc;
      }
    }
    const cls = new Uint8Array(N), tpi = new Float32Array(N);
    for (let r = 0; r < H; r++) {
      const r0 = Math.max(0, r - R), r1 = Math.min(H, r + R + 1);
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        if (!Number.isFinite(z[i])) { cls[i] = 0; continue; }
        const c0 = Math.max(0, c - R), c1 = Math.min(W, c + R + 1);
        const sum = S[r1 * (W + 1) + c1] - S[r0 * (W + 1) + c1] - S[r1 * (W + 1) + c0] + S[r0 * (W + 1) + c0];
        const cnt = C[r1 * (W + 1) + c1] - C[r0 * (W + 1) + c1] - C[r1 * (W + 1) + c0] + C[r0 * (W + 1) + c0];
        const d = z[i] - sum / cnt;
        tpi[i] = d;
        cls[i] = slope[i] < 15 ? 3 : d < -8 ? 2 : d < -2.5 ? 1 : 0;
      }
    }
    return { cls, tpi };
  }

  /**
   * Hücre bazlı μ / ξ haritaları.
   * o = { terrain, cls, T, volume, snowType, limits:{upper, lower}, forestMask?, scale?:{mu, xi} }
   */
  function muxiMaps(o) {
    const t = o.terrain, N = t.width * t.height, z = t.data;
    const vc = volumeClass(o.volume), s = SNOW[o.snowType] || SNOW.dry, k = rpIndex(o.T);
    const sc = o.scale || { mu: 1, xi: 1 };
    const muMap = new Float32Array(N), xiMap = new Float32Array(N);
    const tab = MUXI[vc.id];
    for (let i = 0; i < N; i++) {
      const tc = TERRAIN[o.cls[i]] || 'open';
      const b = Number.isFinite(z[i]) ? band(z[i], o.limits) : 'high';
      let [mu, xi] = tab[tc][b][k];
      mu = (mu + s.dMu) * sc.mu; xi = xi * s.xiF * sc.xi;
      if (o.forestMask && o.forestMask[i]) { mu += FOREST.dMu; xi = Math.min(xi, FOREST.xi); }
      muMap[i] = mu; xiMap[i] = xi;
    }
    return { muMap, xiMap, volumeClass: vc.id };
  }

  /** Sınıf dağılımı ve bir bölgedeki (ör. kopma alanı) ortalama μ, ξ. */
  function summarize(maps, cls, mask) {
    const N = cls.length, share = [0, 0, 0, 0];
    let n = 0, mu = 0, xi = 0;
    for (let i = 0; i < N; i++) {
      share[cls[i]]++;
      if (mask && mask[i]) { n++; mu += maps.muMap[i]; xi += maps.xiMap[i]; }
    }
    return { share: share.map((x) => x / N), muRelease: n ? mu / n : NaN, xiRelease: n ? xi / n : NaN };
  }

  // ---- Kullanıcı kalibrasyon setleri ----
  // { id, name, snowType, T, kind: 'uniform' (mu, xi, rho) | 'scale' (muScale, xiScale), notes, metrics? }
  function userSets() {
    try { const a = JSON.parse(localStorage.getItem(USER_STORE) || '[]'); return Array.isArray(a) ? a : []; }
    catch (_) { return []; }
  }
  function saveUserSet(set) {
    const a = userSets().filter((x) => x.id !== set.id);
    // Kimlik: zaman + rastgele ek (aynı milisaniyede kaydedilen setler çakışmasın; ör. ikili senaryo kalibrasyonu)
    a.unshift(Object.assign({ id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), created: new Date().toISOString(), kind: 'uniform' }, set));
    try { localStorage.setItem(USER_STORE, JSON.stringify(a)); } catch (_) { /* yok say */ }
    return a[0];
  }
  function removeUserSet(id) {
    try { localStorage.setItem(USER_STORE, JSON.stringify(userSets().filter((x) => x.id !== id))); } catch (_) { /* yok say */ }
  }

  const SOURCE = 'RAMMS::AVALANCHE User Manual (WSL Institute for Snow and Avalanche Research SLF), Appendix 7.1 MuXi-Table, RAMMS::Avalanche 1.4.';

  SLS.paramsLibrary = { MUXI, TERRAIN, VOLUME, SNOW, FOREST, RPS, SOURCE, lookup, volumeClass, band, classifyTerrain, muxiMaps, summarize, userSets, saveUserSet, removeUserSet };
})(window.SLS = window.SLS || {});
