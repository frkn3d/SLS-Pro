/* SLS Pro — Kar profili (saha rasatı) modeli
 *
 * Saha platformu (saha.html) ve simülatör aynı modeli kullanır. Profiller bu
 * tarayıcıda localStorage'da tutulur; JSON dosyası olarak dışa/içe aktarılır.
 *
 * Katmanlar üstten alta sıralıdır. Kalınlık ölçüldüğü yönde (eğimli yamaçta yamaca dik).
 * Her katman için yoğunluk (kg/m³) veya kar-su eşdeğeri (mm) girilir; biri diğerinden türetilir:
 *   SWE_mm = kalınlık_m × yoğunluk_kg/m³   (1 mm su = 1 kg/m²)
 */
(function (SLS) {
  'use strict';

  const STORE = 'sls.field.profiles';
  const FORMAT = 'sls-snow-profile';

  // Uluslararası kar sınıflaması (Fierz vd. 2009) kısaltmaları
  const GRAIN = ['PP', 'DF', 'RG', 'FC', 'DH', 'SH', 'MF', 'IF'];
  const HARDNESS = ['F', '4F', '1F', 'P', 'K', 'I'];
  const WETNESS = ['D', 'M', 'W', 'V', 'S'];

  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function blank() {
    return {
      format: FORMAT, version: 1, id: uid(), name: '', date: new Date().toISOString(), observer: '',
      location: { lat: null, lon: null, elev: null, aspect: null, slope: null },
      weather: { airTemp: null, windDir: null, windSpeed: null },
      layers: [{ thickness: 30, density: 120, swe: null, grain: 'PP', hardness: 'F', wetness: 'D', weak: false }],
      notes: '',
    };
  }

  /** Katman yoğunluğu: girilen yoğunluk ya da SWE / kalınlık. */
  function layerDensity(L) {
    const th = Number(L.thickness) / 100;
    if (Number.isFinite(Number(L.density)) && L.density !== '' && L.density !== null) return Number(L.density);
    if (Number.isFinite(Number(L.swe)) && L.swe !== '' && L.swe !== null && th > 0) return Number(L.swe) / th;
    return NaN;
  }

  /** Profilden türetilen büyüklükler. */
  function derive(pr) {
    const layers = (pr.layers || []).filter((L) => Number(L.thickness) > 0);
    let hs = 0, swe = 0, missing = 0;
    const tops = [];
    for (const L of layers) {
      tops.push(hs);
      const th = Number(L.thickness) / 100, rho = layerDensity(L);
      hs += th;
      if (Number.isFinite(rho)) swe += th * rho; else missing++;
    }
    // Zayıf katman: işaretlenen en üstteki zayıf katman; üstündeki levha kopma kalınlığıdır
    const wi = layers.findIndex((L) => L.weak);
    let slab = null;
    if (wi > 0) {
      let th = 0, m = 0;
      for (let k = 0; k < wi; k++) { const t = Number(layers[k].thickness) / 100, r = layerDensity(layers[k]); th += t; if (Number.isFinite(r)) m += t * r; }
      slab = { depth: th, density: th ? m / th : NaN, swe: m, weakIndex: wi };
    }
    // Sürüklenebilir kar: üstten başlayarak yoğunluğu ≤ 200 kg/m³ olan gevşek katmanlar
    let eTh = 0, eM = 0;
    for (const L of layers) {
      const r = layerDensity(L);
      if (!Number.isFinite(r) || r > 200) break;
      const t = Number(L.thickness) / 100;
      eTh += t; eM += t * r;
    }
    const wet = layers.some((L) => ['W', 'V', 'S'].includes(L.wetness));
    const moist = layers.some((L) => L.wetness === 'M');
    const slabRho = slab ? slab.density : (hs ? swe / hs : NaN);
    const snowType = wet ? 'wet' : (slabRho > 300 ? 'dense' : 'dry');
    return {
      nLayers: layers.length,
      hs,                                   // m
      swe,                                  // mm (kg/m²)
      meanDensity: hs ? swe / hs : NaN,     // kg/m³
      thicknesses: layers.map((L) => Number(L.thickness)), // cm, katmanlar arası mesafe
      tops,                                 // m, her katmanın yüzeyden derinliği
      slab,
      erodible: { depth: eTh, density: eTh ? eM / eTh : NaN },
      wetness: wet ? 'wet' : moist ? 'moist' : 'dry',
      snowType,
      complete: missing === 0 && layers.length > 0,
      missingDensity: missing,
    };
  }

  /** Simülasyona aktarılacak öneriler. */
  function toSimulation(pr) {
    const d = derive(pr);
    return {
      d0: d.slab ? d.slab.depth : null,                 // m, yamaca dik
      slabDensity: d.slab ? d.slab.density : d.meanDensity,
      erodibleDepth: d.erodible.depth,                  // m
      erodibleDensity: d.erodible.density,              // kg/m³
      snowType: d.snowType,
      elev: pr.location ? pr.location.elev : null,
      windDir: pr.weather ? pr.weather.windDir : null,
      windSpeed: pr.weather ? pr.weather.windSpeed : null,
      derived: d,
    };
  }

  function validate(pr) {
    const errs = [];
    if (!pr || pr.format !== FORMAT) errs.push('format');
    if (!Array.isArray(pr.layers) || !pr.layers.length) errs.push('layers');
    return errs;
  }

  // ---- Depolama ----
  function list() {
    try { const a = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(a) ? a : []; }
    catch (_) { return []; }
  }
  function save(pr) {
    const a = list().filter((x) => x.id !== pr.id);
    pr.updated = new Date().toISOString();
    a.unshift(pr);
    try { localStorage.setItem(STORE, JSON.stringify(a)); return true; } catch (_) { return false; }
  }
  function remove(id) {
    try { localStorage.setItem(STORE, JSON.stringify(list().filter((x) => x.id !== id))); } catch (_) { /* yok say */ }
  }
  function get(id) { return list().find((x) => x.id === id) || null; }

  function toFile(pr) {
    const name = (pr.name || 'profil').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40);
    return new File([JSON.stringify(pr, null, 2)], `${name}.slsprofile.json`, { type: 'application/json' });
  }
  async function fromFile(file) {
    const data = JSON.parse(await file.text());
    const arr = Array.isArray(data) ? data : [data];
    const ok = arr.filter((p) => !validate(p).length);
    if (!ok.length) throw new Error('invalid');
    return ok;
  }

  // ---- Bağlantı ile paylaşım (sunucusuz): JSON → deflate-raw → base64url ----
  async function encode(pr) {
    const data = new TextEncoder().encode(JSON.stringify(pr));
    const cs = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const u8 = new Uint8Array(await new Response(cs).arrayBuffer());
    let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function decode(str) {
    const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
    const ds = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const pr = JSON.parse(await new Response(ds).text());
    if (validate(pr).length) throw new Error('invalid');
    return pr;
  }
  /** Simülatörde açılan paylaşım bağlantısı */
  async function shareUrl(pr) {
    const base = location.href.replace(/[^/]*([?#].*)?$/, '');
    return `${base}index.html#/avalanche?pz=${await encode(pr)}`;
  }

  // ---- Bağlantı ile paylaşım (sunucusuz): JSON → deflate-raw → base64url ----
  async function encode(pr) {
    const data = new TextEncoder().encode(JSON.stringify(pr));
    const cs = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const u8 = new Uint8Array(await new Response(cs).arrayBuffer());
    let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function decode(str) {
    const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
    const ds = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const pr = JSON.parse(await new Response(ds).text());
    if (validate(pr).length) throw new Error('invalid');
    return pr;
  }
  /** Simülatörde açılan paylaşım bağlantısı */
  async function shareUrl(pr) {
    const base = location.href.replace(/[^/]*([?#].*)?$/, '');
    return `${base}index.html#/avalanche?pz=${await encode(pr)}`;
  }

  SLS.snowpack = { encode, decode, shareUrl, encode, decode, shareUrl, GRAIN, HARDNESS, WETNESS, FORMAT, blank, derive, toSimulation, layerDensity, validate, list, save, remove, get, toFile, fromFile, uid };
})(window.SLS = window.SLS || {});
