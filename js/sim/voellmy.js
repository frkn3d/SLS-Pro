/* SLS Pro — Voellmy-Salm yoğun çığ akış çözücüsü (+ kar sürüklenmesi, + deneysel toz bulutu)
 *
 * YOĞUN AKIŞ: derinlik-ortalamalı sığ akış denklemleri, yatay izdüşüm ızgarasında sonlu hacim.
 * Varsayılan ikinci derece: MUSCL yüz kestirimi (MC sınırlayıcı) + HLL akısı + Heun (SSP-RK2);
 * sürtünme, sürüklenme ve bulut kaynağı adım başına bir kez (ayrıştırma) uygulanır.
 * clipped: negatif yükseklik kırpmasıyla eklenen kütle (dengeye + yönde girer).
 *
 *   ∂h/∂t  + ∇·(h u)                   = ė_entrain − ė_powder
 *   ∂hu/∂t + ∇·(h u⊗u + ½ g cosθ h² I) = −g cos²θ h ∇z − S_f
 *
 * Eğim düzeltmeleri (yatay izdüşüm, θ = yerel eğim):
 *   - Sürükleyici ivme  g sinθ cosθ = g cos²θ · tanθ (eğik düzlemdeki blokla tutarlı)
 *   - Coulomb sürtünmesi μ g cos²θ; türbülans g U²/(ξ h_n), U = |u|/cosθ, h_n = h cosθ
 * Sürtünme yön değiştirmeyecek şekilde (yarı-kapalı) uygulanır.
 *
 * KAR SÜRÜKLENMESİ: yoğun akış (h ≥ minFlowH, U > uErode) yoldaki örtü karını
 *   ė = κ_e · U  (m/s, örtü karı derinliği) hızıyla, mevcut örtü bitene kadar alır.
 *   Kütle korunur: Δh_akış = Δh_örtü · ρ_örtü / ρ_akış. Alınan kar durgun kabul edilir
 *   (momentum korunur, hız düşer).
 *
 * TOZ BULUTU (deneysel, kalibre edilmemiş): ikinci sığ katman.
 *   - Kaynak: U > uPowder olan yoğun akıştan S = κ_p ρ (U − uPowder) kg/m²/s
 *   - Bulut yüksekliği H, fazla kütle m (kg/m²); fazla yoğunluk Δρ = m/H
 *   - İndirgenmiş yerçekimi g' = g Δρ / (Δρ + ρ_hava); hava katılımı dH/dt = E_a U;
 *     taban sürüklemesi C_f U²/H; çökelme w_s·(1 − U/U_askı)·Δρ (hızlı bulut askıda kalır)
 *   - Darbe basıncı p = ½ C_p (ρ_hava + Δρ) U²
 *
 * Alan sınırları yalnızca dışarı akışa izin verir; dışarı çıkan hacim kenar bazında sayılır.
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
    order: 2,            // sayısal yöntem: 1 = birinci derece (HLL), 2 = MUSCL-MC + Heun (SSP-RK2)
    minFlowH: 0.05,      // hız/basınç maksimumlarının kaydedileceği en küçük akış yüksekliği (m)
    // Kar sürüklenmesi (erodible haritası verilirse etkin)
    kappaE: 0.02,        // sürüklenme katsayısı (–)
    rhoCover: 150,       // örtü karı yoğunluğu (kg/m³)
    uErode: 1,           // sürüklenme eşik hızı (m/s)
    // Toz bulutu (deneysel)
    powder: false,
    uPowder: 20,         // bulut oluşum eşik hızı (m/s)
    kappaP: 2e-4,        // yoğun akıştan buluta kütle aktarım katsayısı (–)
    rhoC0: 10,           // oluşan bulutun ilk fazla yoğunluğu (kg/m³)
    rhoAir: 1.0,         // hava yoğunluğu (kg/m³)
    entrainAir: 0.02,    // hava katılım katsayısı E_a (–)
    dragP: 0.002,        // bulut taban sürükleme katsayısı (–)
    settle: 0.2,         // çökelme hızı (m/s)
    uSuspend: 15,        // bu hızın üzerinde türbülans çökelmeyi engeller (m/s)
    cdP: 1,              // bulut basınç katsayısı
  };

  // Zaman çizelgesi kareleri için 8 bitlik kodlama (ana iş parçacığı da aynı fonksiyonları kullanır)
  const QUANT = {
    qh: (h) => (h <= 0.005 ? 0 : Math.max(1, Math.min(255, Math.round(Math.sqrt(Math.min(h, 25) / 25) * 255)))),
    dh: (q) => (q ? (q / 255) * (q / 255) * 25 : 0),
    qv: (v) => Math.min(255, Math.round(Math.min(v, 60) / 60 * 255)),
    dv: (q) => q * 60 / 255,
    qp: (H) => (H <= 0.5 ? 0 : Math.max(1, Math.min(255, Math.round(Math.sqrt(Math.min(H, 100) / 100) * 255)))),
    dp: (q) => (q ? (q / 255) * (q / 255) * 100 : 0),
  };

  function createSim(o) {
    const W = o.width, H = o.height, N = W * H, dx = o.dx, A = dx * dx;
    const p = Object.assign({}, DEFAULTS, o.params || {});
    const z = o.z;
    const muMap = o.muMap || null, xiMap = o.xiMap || null;

    const wall = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (!Number.isFinite(z[i])) wall[i] = 1;

    // Eğim alanları (merkezi fark; kenar ve duvarlarda tek yönlü)
    const zx = new Float32Array(N), zy = new Float32Array(N);
    const cos2 = new Float32Array(N), cosT = new Float32Array(N), gn = new Float32Array(N);
    const zAt = (r, c) => {
      if (r < 0 || c < 0 || r >= H || c >= W) return NaN;
      return z[r * W + c];
    };
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        if (wall[i]) { cos2[i] = 1; cosT[i] = 1; gn[i] = G; continue; }
        const zc = z[i];
        const zl = zAt(r, c - 1), zr = zAt(r, c + 1), zu = zAt(r - 1, c), zd = zAt(r + 1, c);
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

    // ---- Katmanlar ----
    function layer(withTracer) {
      return {
        h: new Float64Array(N), hu: new Float64Array(N), hv: new Float64Array(N),
        dh: new Float64Array(N), dhu: new Float64Array(N), dhv: new Float64Array(N),
        m: withTracer ? new Float64Array(N) : null, dm: withTracer ? new Float64Array(N) : null,
        box: { c0: W, c1: -1, r0: H, r1: -1 },
      };
    }
    const D = layer(false);                    // yoğun akış
    const P = p.powder ? layer(true) : null;   // toz bulutu
    const gP = P ? new Float32Array(N) : null; // bulutun basınç terimi için g' cosθ

    const hmax = new Float32Array(N), vmax = new Float32Array(N);
    const erod = o.erodible ? Float32Array.from(o.erodible) : null;
    const eroded = erod ? new Float32Array(N) : null;
    const pHmax = P ? new Float32Array(N) : null, pVmax = P ? new Float32Array(N) : null, pPmax = P ? new Float32Array(N) : null;

    let releaseVolume = 0;
    const grow = (b, r, c) => { if (c < b.c0) b.c0 = c; if (c > b.c1) b.c1 = c; if (r < b.r0) b.r0 = r; if (r > b.r1) b.r1 = r; };
    for (let i = 0; i < N; i++) {
      const v = wall[i] ? 0 : (o.h0[i] || 0);
      if (v > 0) {
        D.h[i] = v; hmax[i] = v; releaseVolume += v * A;
        const r = (i / W) | 0;
        grow(D.box, r, i - r * W);
      }
    }

    let t = 0, steps = 0, clipped = 0, entrained = 0, toPowderVol = 0;
    const edges = { w: 0, e: 0, n: 0, s: 0 };          // yoğun akış kenar çıkışı (m³)
    const pAcc = { source: 0, settled: 0, outflow: 0, dissipated: 0 }; // bulut kütlesi (kg)
    let momentum = 0, momentumMax = 0, pMomentum = 0, pMomentumMax = 0, vNowMax = 0, flowing = 0;
    let done = releaseVolume === 0, reason = done ? 'empty' : null;

    // HLL akısı. Normal hız un, teğet hız ut. Sonuç fh, fn, ft.
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

    // MC sınırlayıcı (monotonized central): ikinci derece eğimler, TVD ve pozitiflik korunur
    function mc(a, b, c) {
      const d1 = b - a, d2 = c - b;
      if (d1 * d2 <= 0) return 0;
      const s = d1 > 0 ? 1 : -1;
      return s * Math.min(2 * Math.abs(d1), 0.5 * Math.abs(c - a), 2 * Math.abs(d2));
    }

    /**
     * Bir katman için tüm yüzey akıları (bölge: ra..rb, ca..cb).
     * order 2: yüz değerleri MUSCL (MC sınırlayıcı) ile kestirilir. out(edge, fh, fm) kenar çıkışı bildirir.
     */
    function fluxes(L, gArr, ra, rb, ca, cb, out, order) {
      const h = L.h, hu = L.hu, hv = L.hv, dh = L.dh, dhu = L.dhu, dhv = L.dhv, m = L.m, dm = L.dm;
      const second = order === 2;
      for (let r = ra; r <= rb; r++) {
        for (let c = ca; c <= cb; c++) { const i = r * W + c; dh[i] = 0; dhu[i] = 0; dhv[i] = 0; if (dm) dm[i] = 0; }
      }
      const velA = (j) => (h[j] < EPS ? 0 : hu[j] / h[j]);
      const velB = (j) => (h[j] < EPS ? 0 : hv[j] / h[j]);
      for (let pass = 0; pass < 2; pass++) {
        const xDir = pass === 0;
        const rFrom = xDir ? ra : ra - 1, cFrom = xDir ? ca - 1 : ca;
        for (let r = rFrom; r <= rb; r++) {
          for (let c = cFrom; c <= cb; c++) {
            let iL, iR;
            if (xDir) { iL = c >= 0 ? r * W + c : -1; iR = c + 1 < W ? r * W + c + 1 : -1; }
            else { iL = r >= 0 ? r * W + c : -1; iR = r + 1 < H ? (r + 1) * W + c : -1; }
            if (iL < 0 && iR < 0) continue;
            const jL = iL >= 0 ? iL : iR, jR = iR >= 0 ? iR : iL;
            if (wall[jL] || wall[jR]) continue;
            let hL = h[jL], hR = h[jR];
            if (hL < EPS && hR < EPS) continue;
            let aL = velA(jL), bL = velB(jL), aR = velA(jR), bR = velB(jR);
            if (second && iL >= 0 && iR >= 0) {
              let jLL, jRR;
              if (xDir) { jLL = c - 1 >= 0 ? r * W + c - 1 : jL; jRR = c + 2 < W ? r * W + c + 2 : jR; }
              else { jLL = r - 1 >= 0 ? (r - 1) * W + c : jL; jRR = r + 2 < H ? (r + 2) * W + c : jR; }
              if (wall[jLL]) jLL = jL;
              if (wall[jRR]) jRR = jR;
              const cAL = aL, cBL = bL, cAR = aR, cBR = bR;   // hücre ortalamaları
              const hl = hL + 0.5 * mc(h[jLL], hL, hR), hr = hR - 0.5 * mc(hL, hR, h[jRR]);
              if (hl >= EPS) { aL = cAL + 0.5 * mc(velA(jLL), cAL, cAR); bL = cBL + 0.5 * mc(velB(jLL), cBL, cBR); } else { aL = 0; bL = 0; }
              if (hr >= EPS) { aR = cAR - 0.5 * mc(cAL, cAR, velA(jRR)); bR = cBR - 0.5 * mc(cBL, cBR, velB(jRR)); } else { aR = 0; bR = 0; }
              hL = hl; hR = hr;
              if (hL < EPS && hR < EPS) continue;
            }
            if (xDir) hll(hL, aL, bL, hR, aR, bR, 0.5 * (gArr[jL] + gArr[jR]));
            else hll(hL, bL, aL, hR, bR, aR, 0.5 * (gArr[jL] + gArr[jR]));
            if ((iL < 0 && fh > 0) || (iR < 0 && fh < 0)) continue; // sınırdan içeri akış yok
            let fm = 0;
            if (m) fm = fh > 0 ? fh * (h[jL] < EPS ? 0 : m[jL] / h[jL]) : fh * (h[jR] < EPS ? 0 : m[jR] / h[jR]);
            const fu = xDir ? fn : ft, fv = xDir ? ft : fn;
            if (iL >= 0) { dh[iL] -= fh; dhu[iL] -= fu; dhv[iL] -= fv; if (dm) dm[iL] -= fm; }
            else out(xDir ? 'w' : 'n', -fh, -fm);
            if (iR >= 0) { dh[iR] += fh; dhu[iR] += fu; dhv[iR] += fv; if (dm) dm[iR] += fm; }
            else out(xDir ? 'e' : 's', fh, fm);
          }
        }
      }
    }

    function region(b, pad) {
      if (b.c1 < 0) return null;
      const q = pad || 1;
      return { ca: Math.max(0, b.c0 - q), cb: Math.min(W - 1, b.c1 + q), ra: Math.max(0, b.r0 - q), rb: Math.min(H - 1, b.r1 + q) };
    }

    function waveSpeeds(L, gArr, R, s) {
      for (let r = R.ra; r <= R.rb; r++) {
        for (let c = R.ca; c <= R.cb; c++) {
          const i = r * W + c, hi = L.h[i];
          if (hi < EPS) continue;
          const cc = Math.sqrt(gArr[i] * hi);
          const ax = Math.abs(L.hu[i] / hi) + cc, ay = Math.abs(L.hv[i] / hi) + cc;
          if (ax > s[0]) s[0] = ax;
          if (ay > s[1]) s[1] = ay;
        }
      }
    }

    // İkinci derece için Heun başlangıç durumunun kopyası
    const order = p.order === 1 ? 1 : 2;
    const h0s = order === 2 ? new Float64Array(N) : null, hu0s = order === 2 ? new Float64Array(N) : null, hv0s = order === 2 ? new Float64Array(N) : null;

    /** Yoğun akış için bir hiperbolik aşama: akı farkı + yerçekimi kaynağı (sürtünme yok). w: muhasebe ağırlığı */
    function denseStage(R, dt, w) {
      fluxes(D, gn, R.ra, R.rb, R.ca, R.cb, (e, f) => { edges[e] += w * f * dt * dx; }, order);
      const k = dt / dx;
      for (let r = R.ra; r <= R.rb; r++) {
        for (let c = R.ca; c <= R.cb; c++) {
          const i = r * W + c;
          if (wall[i]) continue;
          const hOld = D.h[i];
          let hn = hOld + k * D.dh[i];
          const qx = D.hu[i] + k * D.dhu[i] - dt * G * cos2[i] * hOld * zx[i];
          const qy = D.hv[i] + k * D.dhv[i] - dt * G * cos2[i] * hOld * zy[i];
          if (hn < EPS) {
            if (hn < 0) { clipped -= w * hn * A; hn = 0; }
            D.h[i] = hn; D.hu[i] = 0; D.hv[i] = 0;
            continue;
          }
          D.h[i] = hn; D.hu[i] = qx; D.hv[i] = qy;
        }
      }
    }

    function step() {
      if (done) return 0;
      const RD = region(D.box, order === 2 ? 2 : 1), RP = P ? region(P.box) : null;
      if (!RD && !RP) { done = true; reason = 'stopped'; return 0; }

      // Bulut için g' cosθ (fazla yoğunluk hücreye göre)
      if (RP) {
        for (let r = RP.ra; r <= RP.rb; r++) for (let c = RP.ca; c <= RP.cb; c++) {
          const i = r * W + c, Hc = P.h[i];
          const dr = Hc > EPS ? Math.max(0, P.m[i] / Hc) : 0;
          gP[i] = G * cosT[i] * dr / (dr + p.rhoAir);
        }
      }
      const s = [0, 0];
      if (RD) waveSpeeds(D, gn, RD, s);
      if (RP) waveSpeeds(P, gP, RP, s);
      if (s[0] + s[1] === 0) { done = true; reason = 'stopped'; return 0; }
      const dt = Math.min(p.cfl * dx / (s[0] + s[1]), 0.5, p.tMax - t + 1e-9);
      const k = dt / dx;

      // ---- Bulut (birinci derece) ----
      let pMom = 0;
      const nbP = { c0: W, c1: -1, r0: H, r1: -1 };
      if (RP) {
        fluxes(P, gP, RP.ra, RP.rb, RP.ca, RP.cb, (e, f, fm) => { pAcc.outflow += fm * dt * dx; }, 1);
        for (let r = RP.ra; r <= RP.rb; r++) for (let c = RP.ca; c <= RP.cb; c++) {
          const i = r * W + c;
          if (wall[i]) continue;
          const Hold = P.h[i];
          const Hb = Hold + k * P.dh[i];
          let mn = P.m[i] + k * P.dm[i];
          const gpi = gP[i] / cosT[i]; // g' (tam)
          const qx = P.hu[i] + k * P.dhu[i] - dt * gpi * cos2[i] * Hold * zx[i];
          const qy = P.hv[i] + k * P.dhv[i] - dt * gpi * cos2[i] * Hold * zy[i];
          if (Hb < EPS || mn <= 0) {
            pAcc.dissipated += mn * A;          // negatif sayısal artık dahil, denge tam kapanır
            P.h[i] = 0; P.hu[i] = 0; P.hv[i] = 0; P.m[i] = 0;
            continue;
          }
          let u = qx / Hb, v = qy / Hb;
          let sp = Math.hypot(u, v);
          // 1) Taban sürüklemesi (kapalı)
          if (sp > 0) {
            const sN = Math.min(VMAX, sp / (1 + dt * p.dragP * sp / Hb));
            u *= sN / sp; v *= sN / sp; sp = sN;
          }
          // 2) Çökelme: w_s · Δρ (kg/m²/s); türbülans hızlı bulutta parçacıkları askıda tutar
          const wEff = p.settle * Math.max(0, 1 - sp / cosT[i] / p.uSuspend);
          const settled = Math.min(mn, dt * wEff * mn / Hb);
          mn -= settled; pAcc.settled += settled * A;
          // 3) Hava katılımı: kütlesiz hacim eklenir, momentum (H·u) korunur → hız düşer
          const Hn = Hb + dt * p.entrainAir * sp;
          u *= Hb / Hn; v *= Hb / Hn; sp *= Hb / Hn;
          const drn = mn / Hn;
          if (drn < 0.01) { pAcc.dissipated += mn * A; P.h[i] = 0; P.hu[i] = 0; P.hv[i] = 0; P.m[i] = 0; continue; }
          P.h[i] = Hn; P.hu[i] = Hn * u; P.hv[i] = Hn * v; P.m[i] = mn;
          grow(nbP, r, c);
          const U = sp / cosT[i];
          if (Hn > pHmax[i]) pHmax[i] = Hn;
          if (U > pVmax[i]) pVmax[i] = U;
          const pc = 0.5 * p.cdP * (p.rhoAir + drn) * U * U / 1000;
          if (pc > pPmax[i]) pPmax[i] = pc;
          pMom += mn * U;
        }
      }

      // ---- Yoğun akış: hiperbolik kısım (1. derece: Euler; 2. derece: Heun / SSP-RK2) ----
      if (RD) {
        if (order === 2) {
          for (let r = RD.ra; r <= RD.rb; r++) for (let c = RD.ca; c <= RD.cb; c++) {
            const i = r * W + c; h0s[i] = D.h[i]; hu0s[i] = D.hu[i]; hv0s[i] = D.hv[i];
          }
          denseStage(RD, dt, 0.5);
          denseStage(RD, dt, 0.5);
          for (let r = RD.ra; r <= RD.rb; r++) for (let c = RD.ca; c <= RD.cb; c++) {
            const i = r * W + c;
            D.h[i] = 0.5 * (h0s[i] + D.h[i]); D.hu[i] = 0.5 * (hu0s[i] + D.hu[i]); D.hv[i] = 0.5 * (hv0s[i] + D.hv[i]);
          }
        } else denseStage(RD, dt, 1);
      }

      // ---- Sürtünme + sürüklenme + bulut kaynağı (adım başına bir kez, kapalı) ----
      const mu = p.mu, xi = p.xi, rho = p.rho;
      const nb = { c0: W, c1: -1, r0: H, r1: -1 };
      momentum = 0; vNowMax = 0; flowing = 0;
      if (RD) {
        for (let r = RD.ra; r <= RD.rb; r++) {
          for (let c = RD.ca; c <= RD.cb; c++) {
            const i = r * W + c;
            if (wall[i]) continue;
            let hn = D.h[i];
            if (hn < EPS) {
              D.hu[i] = 0; D.hv[i] = 0;
              if (hn > 0) grow(nb, r, c);
              continue;
            }
            let u = D.hu[i] / hn, v = D.hv[i] / hn;
            const sp = Math.hypot(u, v);
            let sNew = 0;
            if (sp > 0) {
              const c2 = cos2[i];
              const muI = muMap ? muMap[i] : mu, xiI = xiMap ? xiMap[i] : xi;
              const s1 = Math.max(0, sp - dt * muI * G * c2);                         // Coulomb
              sNew = 2 * s1 / (1 + Math.sqrt(1 + 4 * dt * G * s1 / (xiI * hn * c2))); // türbülans (kapalı)
              if (sNew > VMAX) sNew = VMAX;
              const f = sNew / sp; u *= f; v *= f;
            }
            let U = sNew / cosT[i];                                                // eğime paralel hız
            // Kar sürüklenmesi: örtü karı alınır, momentum korunur
            if (erod && erod[i] > 0 && hn >= p.minFlowH && U > p.uErode) {
              const de = Math.min(erod[i], dt * p.kappaE * U);
              erod[i] -= de; eroded[i] += de;
              const add = de * p.rhoCover / rho;
              entrained += add * A;
              const f = hn / (hn + add);
              hn += add; u *= f; v *= f; sNew *= f; U *= f;
            }
            // Toz bulutu kaynağı
            if (P && U > p.uPowder && hn >= p.minFlowH) {
              const S = Math.min(p.kappaP * rho * (U - p.uPowder) * dt, 0.5 * hn * rho); // kg/m²
              const dhP = S / rho;
              hn -= dhP; toPowderVol += dhP * A; pAcc.source += S * A;
              const Hadd = S / p.rhoC0;
              P.h[i] += Hadd; P.hu[i] += Hadd * u; P.hv[i] += Hadd * v; P.m[i] += S;
              grow(nbP, r, c);
            }
            D.h[i] = hn; D.hu[i] = hn * u; D.hv[i] = hn * v;
            grow(nb, r, c);
            if (hn > hmax[i]) hmax[i] = hn;
            if (sNew > 0) {
              if (hn >= p.minFlowH && U > vmax[i]) vmax[i] = U;
              if (U > vNowMax) vNowMax = U;
              momentum += hn * U;
              if (hn >= p.minFlowH && U > 0.1) flowing++;
            }
          }
        }
      }
      D.box = nb;
      if (P) P.box = nbP;
      momentum *= A;
      if (momentum > momentumMax) momentumMax = momentum;
      pMomentum = pMom * A;
      if (pMomentum > pMomentumMax) pMomentumMax = pMomentum;
      t += dt; steps++;

      const denseStopped = t > 2 && momentum < p.stopRatio * momentumMax;
      const powderStopped = !P || pMomentumMax === 0 || pMomentum < p.stopRatio * pMomentumMax || P.box.c1 < 0;
      if (D.box.c1 < 0 && (!P || P.box.c1 < 0)) { done = true; reason = 'empty'; }
      else if (t >= p.tMax - 1e-6) { done = true; reason = 'tmax'; }
      else if (denseStopped && powderStopped) { done = true; reason = 'momentum'; }
      return dt;
    }

    /** Zaman çizelgesi karesi: etkin bölge kırpılır, h / U / bulut yüksekliği 8 bit kodlanır. */
    function snapshot() {
      const b = { c0: D.box.c0, c1: D.box.c1, r0: D.box.r0, r1: D.box.r1 };
      if (P && P.box.c1 >= 0) {
        b.c0 = Math.min(b.c0, P.box.c0); b.c1 = Math.max(b.c1, P.box.c1);
        b.r0 = Math.min(b.r0, P.box.r0); b.r1 = Math.max(b.r1, P.box.r1);
      }
      const base = { t, vNow: vNowMax, mom: momentumMax > 0 ? momentum / momentumMax : 0 };
      if (b.c1 < 0) return Object.assign(base, { c0: 0, r0: 0, w: 0, h: 0, hq: new Uint8Array(0), vq: new Uint8Array(0), pq: null });
      const c0 = Math.max(0, b.c0), c1 = Math.min(W - 1, b.c1), r0 = Math.max(0, b.r0), r1 = Math.min(H - 1, b.r1);
      const w = c1 - c0 + 1, hh = r1 - r0 + 1;
      const hq = new Uint8Array(w * hh), vq = new Uint8Array(w * hh), pq = P ? new Uint8Array(w * hh) : null;
      for (let r = r0, k = 0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++, k++) {
          const i = r * W + c, hi = D.h[i];
          hq[k] = QUANT.qh(hi);
          if (hi > EPS) vq[k] = QUANT.qv(Math.hypot(D.hu[i], D.hv[i]) / hi / cosT[i]);
          if (pq) pq[k] = QUANT.qp(P.h[i]);
        }
      }
      return Object.assign(base, { c0, r0, w, h: hh, hq, vq, pq });
    }

    function volume() {
      let v = 0;
      for (let i = 0; i < N; i++) v += D.h[i];
      return v * A;
    }
    function powderMass() {
      if (!P) return 0;
      let m = 0;
      for (let i = 0; i < N; i++) m += P.m[i];
      return m * A;
    }

    function status() {
      const outflow = edges.w + edges.e + edges.n + edges.s;
      return {
        t, steps, done, reason, outflow, edges: Object.assign({}, edges), clipped, releaseVolume, entrained, toPowderVol,
        momentumRatio: momentumMax > 0 ? momentum / momentumMax : 0,
        vNowMax, flowingCells: flowing,
        powder: P ? Object.assign({ airborne: powderMass() }, pAcc) : null,
      };
    }

    function results() {
      const pmax = new Float32Array(N);
      const kp = 0.5 * p.cd * p.rho / 1000; // kPa
      for (let i = 0; i < N; i++) pmax[i] = kp * vmax[i] * vmax[i];
      const hfinal = new Float32Array(N);
      for (let i = 0; i < N; i++) hfinal[i] = D.h[i];
      return {
        hmax, vmax, pmax, hfinal,
        eroded: eroded || null,
        powder: P ? { hmax: pHmax, vmax: pVmax, pmax: pPmax } : null,
        status: Object.assign(status(), { depositVolume: volume() }), params: p,
      };
    }

    return {
      step, status, results, volume, snapshot, params: p,
      get t() { return t; }, get done() { return done; },
      state: { h: D.h, hu: D.hu, hv: D.hv, cosT, powder: P ? P.h : null },
      stop() { if (!done) { done = true; reason = 'user'; } },
    };
  }

  const api = { createSim, DEFAULTS, G, QUANT };
  root.SLSVoellmy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
