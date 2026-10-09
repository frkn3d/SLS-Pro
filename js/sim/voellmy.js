/* SLS Pro — Voellmy-Salm yoğun çığ akış çözücüsü
 *
 * Derinlik-ortalamalı sığ akış denklemleri, yatay izdüşüm ızgarasında
 * birinci derece sonlu hacim (HLL akısı) ile çözülür.
 *
 *   ∂h/∂t  + ∇·(h u)                 = 0
 *   ∂hu/∂t + ∇·(h u⊗u + ½ g cosθ h² I) = −g cos²θ h ∇z  − S_f
 *
 * Eğim düzeltmeleri (yatay izdüşüm, θ = yerel eğim):
 *   - Sürükleyici ivme  g sinθ cosθ  = g cos²θ · tanθ   (eğik düzlemdeki blokla tutarlı)
 *   - Coulomb sürtünmesi μ g cos²θ                        (normal kuvvet g cosθ, yatay bileşen ·cosθ)
 *   - Türbülans sürtünmesi g U² / (ξ h_n), U = |u|/cosθ, h_n = h cosθ
 * Sürtünme, yön değiştirmeyecek şekilde (yarı-kapalı) uygulanır; böylece
 * tanθ < μ olan yamaçta duran kar hareketsiz kalır.
 *
 * Alan sınırları yalnızca dışarı akışa izin verir; dışarı çıkan hacim ayrıca sayılır.
 *
 * Bu dosya hem Web Worker'da hem Node.js testlerinde kullanılır (DOM yok).
 */
(function (root) {
  'use strict';

  const G = 9.81;
  const EPS = 1e-3;      // kuru hücre eşiği (m)
  const VMAX = 150;      // sayısal güvenlik sınırı (m/s)

  const DEFAULTS = {
    mu: 0.2,             // Coulomb sürtünme katsayısı
    xi: 1500,            // türbülans katsayısı (m/s²)
    rho: 300,            // akış yoğunluğu (kg/m³)
    cd: 2,               // basınç katsayısı (p = ½ Cd ρ U²; Cd=2 → İsviçre p = ρU²)
    tMax: 300,           // en uzun simülasyon süresi (s)
    stopRatio: 0.05,     // momentum maksimumun bu oranına düşünce dur (RAMMS ölçütü)
    cfl: 0.45,
    minFlowH: 0.05,      // hız/basınç maksimumlarının kaydedileceği en küçük akış yüksekliği (m)
  };

  function createSim(o) {
    const W = o.width, H = o.height, N = W * H, dx = o.dx;
    const p = Object.assign({}, DEFAULTS, o.params || {});
    const z = o.z;

    const wall = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (!Number.isFinite(z[i])) wall[i] = 1;

    // Eğim alanları (merkezi fark; kenar ve duvarlarda tek yönlü)
    const zx = new Float32Array(N), zy = new Float32Array(N);
    const cos2 = new Float32Array(N), cosT = new Float32Array(N), gn = new Float32Array(N);
    const zAt = (r, c, fb) => {
      if (r < 0 || c < 0 || r >= H || c >= W) return fb;
      const v = z[r * W + c];
      return Number.isFinite(v) ? v : fb;
    };
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        if (wall[i]) { cos2[i] = 1; cosT[i] = 1; gn[i] = G; continue; }
        const zc = z[i];
        const zl = zAt(r, c - 1, NaN), zr = zAt(r, c + 1, NaN);
        const zu = zAt(r - 1, c, NaN), zd = zAt(r + 1, c, NaN);
        let gx, gy;
        if (Number.isFinite(zl) && Number.isFinite(zr)) gx = (zr - zl) / (2 * dx);
        else if (Number.isFinite(zr)) gx = (zr - zc) / dx;
        else if (Number.isFinite(zl)) gx = (zc - zl) / dx;
        else gx = 0;
        if (Number.isFinite(zu) && Number.isFinite(zd)) gy = (zd - zu) / (2 * dx);
        else if (Number.isFinite(zd)) gy = (zd - zc) / dx;
        else if (Number.isFinite(zu)) gy = (zc - zu) / dx;
        else gy = 0;
        zx[i] = gx; zy[i] = gy;
        const c2 = 1 / (1 + gx * gx + gy * gy);
        cos2[i] = c2; cosT[i] = Math.sqrt(c2); gn[i] = G * Math.sqrt(c2);
      }
    }

    const h = new Float64Array(N), hu = new Float64Array(N), hv = new Float64Array(N);
    const dh = new Float64Array(N), dhu = new Float64Array(N), dhv = new Float64Array(N);
    const hmax = new Float32Array(N), vmax = new Float32Array(N);

    let releaseVolume = 0;
    let c0 = W, c1 = -1, r0 = H, r1 = -1;
    for (let i = 0; i < N; i++) {
      const v = wall[i] ? 0 : (o.h0[i] || 0);
      if (v > 0) {
        h[i] = v; hmax[i] = v; releaseVolume += v * dx * dx;
        const r = (i / W) | 0, c = i - r * W;
        if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < r0) r0 = r; if (r > r1) r1 = r;
      }
    }

    let t = 0, steps = 0, outflow = 0, clipped = 0;
    let momentum = 0, momentumMax = 0, vNowMax = 0, flowing = 0;
    let done = releaseVolume === 0, reason = done ? 'empty' : null;

    // HLL akısı. Normal hız un, teğet hız ut. Sonuç fh, fn (normal momentum), ft (teğet momentum).
    let fh = 0, fn = 0, ft = 0;
    function hll(hL, unL, utL, hR, unR, utR, g) {
      const cL = Math.sqrt(g * hL), cR = Math.sqrt(g * hR);
      let sL, sR;
      if (hL < EPS) { sL = unR - 2 * cR; sR = unR + cR; }
      else if (hR < EPS) { sL = unL - cL; sR = unL + 2 * cL; }
      else { sL = Math.min(unL - cL, unR - cR); sR = Math.max(unL + cL, unR + cR); }
      const FhL = hL * unL, FnL = hL * unL * unL + 0.5 * g * hL * hL, FtL = hL * unL * utL;
      const FhR = hR * unR, FnR = hR * unR * unR + 0.5 * g * hR * hR, FtR = hR * unR * utR;
      if (sL >= 0) { fh = FhL; fn = FnL; ft = FtL; return; }
      if (sR <= 0) { fh = FhR; fn = FnR; ft = FtR; return; }
      const inv = 1 / (sR - sL);
      fh = (sR * FhL - sL * FhR + sL * sR * (hR - hL)) * inv;
      fn = (sR * FnL - sL * FnR + sL * sR * (hR * unR - hL * unL)) * inv;
      ft = (sR * FtL - sL * FtR + sL * sR * (hR * utR - hL * utL)) * inv;
    }

    function step() {
      if (done) return 0;
      // Etkin bölgeyi bir hücre genişlet
      const ca = Math.max(0, c0 - 1), cb = Math.min(W - 1, c1 + 1);
      const ra = Math.max(0, r0 - 1), rb = Math.min(H - 1, r1 + 1);

      let sx = 0, sy = 0;
      for (let r = ra; r <= rb; r++) {
        for (let c = ca; c <= cb; c++) {
          const i = r * W + c, hi = h[i];
          dh[i] = 0; dhu[i] = 0; dhv[i] = 0;
          if (hi < EPS) continue;
          const cc = Math.sqrt(gn[i] * hi);
          const ax = Math.abs(hu[i] / hi) + cc, ay = Math.abs(hv[i] / hi) + cc;
          if (ax > sx) sx = ax;
          if (ay > sy) sy = ay;
        }
      }
      if (sx + sy === 0) { done = true; reason = 'stopped'; return 0; }
      const dt = Math.min(p.cfl * dx / (sx + sy), 0.5, p.tMax - t + 1e-9);

      // x yönündeki yüzeyler (sütun c | c+1)
      for (let r = ra; r <= rb; r++) {
        const row = r * W;
        for (let c = ca - 1; c <= cb; c++) {
          const iL = c >= 0 ? row + c : -1, iR = c + 1 < W ? row + c + 1 : -1;
          const jL = iL >= 0 ? iL : iR, jR = iR >= 0 ? iR : iL; // kenarda geçirgen (yansımasız) sınır
          if (wall[jL] || wall[jR]) continue;
          const hL = h[jL], hR = h[jR];
          if (hL < EPS && hR < EPS) continue;
          const uL = hL < EPS ? 0 : hu[jL] / hL, vL = hL < EPS ? 0 : hv[jL] / hL;
          const uR = hR < EPS ? 0 : hu[jR] / hR, vR = hR < EPS ? 0 : hv[jR] / hR;
          hll(hL, uL, vL, hR, uR, vR, 0.5 * (gn[jL] + gn[jR]));
          // Alan sınırı: yalnızca dışarı akış; içeri akış (yoktan kütle) engellenir
          if ((iL < 0 && fh > 0) || (iR < 0 && fh < 0)) { fh = 0; fn = 0; ft = 0; }
          if (iL >= 0) { dh[iL] -= fh; dhu[iL] -= fn; dhv[iL] -= ft; } else outflow -= fh * dt * dx;
          if (iR >= 0) { dh[iR] += fh; dhu[iR] += fn; dhv[iR] += ft; } else outflow += fh * dt * dx;
        }
      }
      // y yönündeki yüzeyler (satır r | r+1), satır güneye doğru artar
      for (let r = ra - 1; r <= rb; r++) {
        for (let c = ca; c <= cb; c++) {
          const iL = r >= 0 ? r * W + c : -1, iR = r + 1 < H ? (r + 1) * W + c : -1;
          const jL = iL >= 0 ? iL : iR, jR = iR >= 0 ? iR : iL;
          if (wall[jL] || wall[jR]) continue;
          const hL = h[jL], hR = h[jR];
          if (hL < EPS && hR < EPS) continue;
          const uL = hL < EPS ? 0 : hu[jL] / hL, vL = hL < EPS ? 0 : hv[jL] / hL;
          const uR = hR < EPS ? 0 : hu[jR] / hR, vR = hR < EPS ? 0 : hv[jR] / hR;
          hll(hL, vL, uL, hR, vR, uR, 0.5 * (gn[jL] + gn[jR]));
          if ((iL < 0 && fh > 0) || (iR < 0 && fh < 0)) { fh = 0; fn = 0; ft = 0; }
          if (iL >= 0) { dh[iL] -= fh; dhv[iL] -= fn; dhu[iL] -= ft; } else outflow -= fh * dt * dx;
          if (iR >= 0) { dh[iR] += fh; dhv[iR] += fn; dhu[iR] += ft; } else outflow += fh * dt * dx;
        }
      }

      // Güncelleme + kaynak terimleri + sürtünme
      const k = dt / dx;
      const mu = p.mu, xi = p.xi;
      let nc0 = W, nc1 = -1, nr0 = H, nr1 = -1;
      momentum = 0; vNowMax = 0; flowing = 0;
      for (let r = ra; r <= rb; r++) {
        for (let c = ca; c <= cb; c++) {
          const i = r * W + c;
          if (wall[i]) continue;
          const hOld = h[i];
          let hn = hOld + k * dh[i];
          let qx = hu[i] + k * dhu[i] - dt * G * cos2[i] * hOld * zx[i];
          let qy = hv[i] + k * dhv[i] - dt * G * cos2[i] * hOld * zy[i];
          if (hn < EPS) {
            if (hn < 0) { clipped -= hn * dx * dx; hn = 0; }
            h[i] = hn; hu[i] = 0; hv[i] = 0;
            if (hn > 0) { // ince film: kütle korunur, hareket etmez
              if (c < nc0) nc0 = c; if (c > nc1) nc1 = c; if (r < nr0) nr0 = r; if (r > nr1) nr1 = r;
            }
            continue;
          }
          let u = qx / hn, v = qy / hn;
          const s = Math.hypot(u, v);
          let sNew = 0;
          if (s > 0) {
            const c2 = cos2[i];
            const s1 = Math.max(0, s - dt * mu * G * c2);                // Coulomb
            // türbülans: s = s1 − dt·g·s²/(ξ h cos²θ) kapalı çözümü (koşulsuz kararlı, kararlı halde tam)
            sNew = 2 * s1 / (1 + Math.sqrt(1 + 4 * dt * G * s1 / (xi * hn * c2)));
            if (sNew > VMAX) sNew = VMAX;
            const f = sNew / s;
            u *= f; v *= f;
          }
          h[i] = hn; hu[i] = hn * u; hv[i] = hn * v;
          if (c < nc0) nc0 = c; if (c > nc1) nc1 = c; if (r < nr0) nr0 = r; if (r > nr1) nr1 = r;
          if (hn > hmax[i]) hmax[i] = hn;
          if (sNew > 0) {
            const U = sNew / cosT[i];                                    // eğime paralel hız
            if (hn >= p.minFlowH && U > vmax[i]) vmax[i] = U;
            if (U > vNowMax) vNowMax = U;
            momentum += hn * U;
            if (hn >= p.minFlowH && U > 0.1) flowing++;
          }
        }
      }
      c0 = nc0; c1 = nc1; r0 = nr0; r1 = nr1;
      momentum *= dx * dx;
      if (momentum > momentumMax) momentumMax = momentum;
      t += dt; steps++;

      if (c1 < 0) { done = true; reason = 'empty'; }
      else if (t >= p.tMax - 1e-6) { done = true; reason = 'tmax'; }
      else if (t > 2 && momentum < p.stopRatio * momentumMax) { done = true; reason = 'momentum'; }
      return dt;
    }

    function volume() {
      let v = 0;
      for (let r = Math.max(0, r0); r <= r1; r++) for (let c = Math.max(0, c0); c <= c1; c++) v += h[r * W + c];
      return v * dx * dx;
    }

    function status() {
      return {
        t, steps, done, reason, outflow, clipped, releaseVolume,
        momentumRatio: momentumMax > 0 ? momentum / momentumMax : 0,
        vNowMax, flowingCells: flowing,
      };
    }

    function results() {
      const pmax = new Float32Array(N);
      const kp = 0.5 * p.cd * p.rho / 1000; // kPa
      for (let i = 0; i < N; i++) pmax[i] = kp * vmax[i] * vmax[i];
      const hfinal = new Float32Array(N);
      for (let i = 0; i < N; i++) hfinal[i] = h[i];
      return { hmax, vmax, pmax, hfinal, status: Object.assign(status(), { depositVolume: volume() }), params: p };
    }

    return {
      step, status, results, volume, params: p,
      get t() { return t; }, get done() { return done; },
      state: { h, hu, hv, cosT },
      stop() { if (!done) { done = true; reason = 'user'; } },
    };
  }

  const api = { createSim, DEFAULTS, G };
  root.SLSVoellmy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
