/* SLS Pro — Sürtünme parametre kitaplığı
 *
 * Kar tipi × tekerrür süresi × hacim sınıfı için başlangıç değerleri.
 * DİKKAT: Bu değerler literatürdeki tipik aralıklardan (Salm vd. 1990; Christen vd. 2010
 * ve izleyen uygulamalar) derlenmiş YAKLAŞIK başlangıç noktalarıdır, kalibre edilmemiştir.
 * Kullanıcı kendi bölgesinde gözlenmiş çığlarla kalibre ettiği setleri kaydedebilir;
 * bu setler kitaplık değerlerinin önüne geçer.
 */
(function (SLS) {
  'use strict';

  const USER_STORE = 'sls.paramSets';

  // Kuru kar, açık yamaç, büyük hacim (> 60 000 m³) temel değerleri
  const BASE = {
    30: { mu: 0.20, xi: 2000 },
    100: { mu: 0.18, xi: 2500 },
    300: { mu: 0.16, xi: 3000 },
  };
  // Hacim sınıfı düzeltmeleri (küçük çığlar daha erken durur)
  const VOLUME = [
    { id: 'small', max: 10000, dMu: 0.06, xiF: 0.5 },
    { id: 'medium', max: 60000, dMu: 0.03, xiF: 0.75 },
    { id: 'large', max: Infinity, dMu: 0, xiF: 1 },
  ];
  // Kar tipleri
  const SNOW = {
    dry: { dMu: 0, xiF: 1, rho: 300, powder: true },     // kuru (toz) kar: toz bulutu oluşabilir
    dense: { dMu: 0.03, xiF: 0.8, rho: 350, powder: false }, // yoğun / sıkı kuru kar
    wet: { dMu: 0.08, xiF: 0.4, rho: 450, powder: false },   // ıslak kar: yavaş, yoğun, toz bulutu yok
  };

  function volumeClass(v) { return VOLUME.find((c) => v < c.max) || VOLUME[VOLUME.length - 1]; }

  /** Kitaplık değeri. */
  function lookup(snowType, T, releaseVolume) {
    const b = BASE[T] || BASE[100], s = SNOW[snowType] || SNOW.dry, vc = volumeClass(releaseVolume || 1e9);
    return {
      mu: +(b.mu + vc.dMu + s.dMu).toFixed(3),
      xi: Math.max(300, Math.round(b.xi * vc.xiF * s.xiF / 50) * 50),
      rho: s.rho,
      powderAllowed: s.powder,
      volumeClass: vc.id,
      source: 'library',
    };
  }

  // ---- Kullanıcı kalibrasyon setleri ----
  function userSets() {
    try { const a = JSON.parse(localStorage.getItem(USER_STORE) || '[]'); return Array.isArray(a) ? a : []; }
    catch (_) { return []; }
  }
  function saveUserSet(set) {
    const a = userSets().filter((x) => x.id !== set.id);
    a.unshift(Object.assign({ id: 'u' + Date.now().toString(36), created: new Date().toISOString() }, set));
    try { localStorage.setItem(USER_STORE, JSON.stringify(a)); } catch (_) { /* yok say */ }
    return a[0];
  }
  function removeUserSet(id) {
    try { localStorage.setItem(USER_STORE, JSON.stringify(userSets().filter((x) => x.id !== id))); } catch (_) { /* yok say */ }
  }

  SLS.paramsLibrary = { BASE, VOLUME, SNOW, lookup, volumeClass, userSets, saveUserSet, removeUserSet };
})(window.SLS = window.SLS || {});
