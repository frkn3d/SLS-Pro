/* SLS Pro — Gözlenmiş çığa karşı doğrulama ve μ/ξ kalibrasyonu
 *
 * Gözlenen çığ sınırı (KML/KMZ/GeoJSON poligonu veya haritada çizim) ızgaraya aktarılır ve
 * simülasyon ayak izi (h_max ≥ 0,1 m, analizle aynı eşik) ile karşılaştırılır:
 *   - Örtüşme: isabet (TP), yanlış alarm (FP), kaçırma (FN); kesinlik, duyarlık (POD),
 *     F1 (= Dice), CSI (= Jaccard / tehdit skoru)
 *   - Kaçış: kopma alanının tepesinden en uzak etkilenen nokta; mesafe farkı ve α açısı farkı
 * Kalibrasyon: μ ve ξ haritaları ölçek çarpanlarıyla değiştirilerek (RAMMS sınıf yapısı korunur)
 * küçük bir arama yapılır. Amaç fonksiyonu J = (1 − F1) + |Δα| / 10°  (1° α hatası ≈ 0,1 F1).
 * Arama: her ξ çarpanı (×1, ×0,5, ×2) için kaçış mesafesi farkını sıfırlayan μ çarpanı aranır:
 * önce işaret değişimi (μ ×1,15 … ×2 ya da ×0,85 … ×0,4), sonra aralık içinde regula falsi.
 * Kaçış mesafesi μ ile tekdüze azalır; α ise uç başka bir yöne sıçradığında sıçrayabileceği için
 * kök arama hedefi değildir (amaç fonksiyonunda kalır). ξ, J'si en iyi olan seçilir; son olarak en iyi
 * noktada μ, J iyileştikçe ±%7 adımlarla ilerletilir (kaba ızgarada kaçış birkaç μ'de aynı kalabilir).
 * Not: tek olayın ayak izi ve kaçışı μ'yü iyi, ξ'yi zayıf belirler (μ–ξ eşsonluğu); ξ için hız/basınç
 * gözlemi (radar, hasar) gerekir. Benzer J veren çiftler 'alternatives' olarak bildirilir.
 */
(function (SLS) {
  'use strict';

  const AFFECTED_H = 0.1;
  const R2D = 180 / Math.PI;
  const XI_GRID = [1, 0.5, 2];   // ξ çarpanları
  const MU_UP = [1.15, 1.35, 1.7, 2.0];     // μ artırma adımları (işaret değişimi aranır)
  const MU_DOWN = [0.85, 0.7, 0.55, 0.4];  // μ azaltma adımları
  const MU_MIN = 0.4, MU_MAX = 2.0;
  const RUNOUT_TOL_CELLS = 1.5;            // kaçış eşleşme toleransı (hücre)
  const LOCAL_STEP = 0.07, LOCAL_MAX = 4;  // son yerel μ iyileştirmesi

  /** Poligon halkalarını (WGS84 [lng, lat] dizileri) ızgara maskesine çevirir. */
  function observedMask(terrain, rings) {
    const m = new Uint8Array(terrain.width * terrain.height);
    for (const ring of rings || []) SLS.raster.rasterizePolygon(terrain, ring, (i) => { m[i] = 1; });
    return m;
  }

  function tipFrom(mask, W, iTop, test) {
    const rT = (iTop / W) | 0, cT = iTop - rT * W;
    let best = -1, iTip = -1;
    for (let i = 0; i < mask.length; i++) {
      if (!test(i)) continue;
      const r = (i / W) | 0, c = i - r * W, d2 = (r - rT) * (r - rT) + (c - cT) * (c - cT);
      if (d2 > best) { best = d2; iTip = i; }
    }
    return { iTip, dist: best >= 0 ? Math.sqrt(best) : 0 };
  }

  /**
   * res: çözücü sonucu (hmax), ctx: { terrain, mask (kopma) }, obs: gözlenen maske.
   * Dönüş: örtüşme ve kaçış ölçütleri.
   */
  function metrics(res, ctx, obs) {
    const tr = ctx.terrain, W = tr.width, N = W * tr.height, cs = tr.cellSize, z = tr.data;
    let iTop = -1;
    for (let i = 0; i < N; i++) if (ctx.mask[i] && (iTop < 0 || z[i] > z[iTop])) iTop = i;
    let tp = 0, fp = 0, fn = 0;
    for (let i = 0; i < N; i++) {
      if (Number.isNaN(z[i])) continue;
      const s = res.hmax[i] >= AFFECTED_H, o = obs[i] === 1;
      if (s && o) tp++; else if (s) fp++; else if (o) fn++;
    }
    const ha = cs * cs / 10000;
    const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = tp ? 2 * tp / (2 * tp + fp + fn) : 0, csi = tp ? tp / (tp + fp + fn) : 0;
    const sim = tipFrom(obs, W, iTop, (i) => res.hmax[i] >= AFFECTED_H);
    const ob = tipFrom(obs, W, iTop, (i) => obs[i] === 1);
    const alpha = (t) => (t.iTip >= 0 && t.dist > 0 ? Math.atan((z[iTop] - z[t.iTip]) / (t.dist * cs)) * R2D : NaN);
    const aS = alpha(sim), aO = alpha(ob);
    return {
      tp, fp, fn, precision, recall, f1, csi,
      simHa: (tp + fp) * ha, obsHa: (tp + fn) * ha, overlapHa: tp * ha,
      runoutSim: sim.dist * cs, runoutObs: ob.dist * cs, dRunout: (sim.dist - ob.dist) * cs, cell: cs,
      alphaSim: aS, alphaObs: aO, dAlpha: aS - aO,
      iTop, iTipSim: sim.iTip, iTipObs: ob.iTip,
    };
  }

  /** Amaç fonksiyonu (küçük olan iyi) */
  function objective(m) {
    const da = Number.isFinite(m.dAlpha) ? Math.abs(m.dAlpha) : 10;
    return (1 - m.f1) + da / 10;
  }

  /**
   * Ölçek çarpanı araması. evalFn(kMu, kXi) → Promise<metrics> (bir simülasyon).
   * seed: önceden hesaplanmış (1, 1) sonucu (yeniden koşturulmaz). onStep(entry, all, plannedTotal)
   * shouldStop(): true dönerse arama o ana kadarki en iyiyle biter.
   */
  async function search(evalFn, opts) {
    const o = opts || {};
    const all = [], seen = new Map();
    const key = (a, b) => a.toFixed(4) + '|' + b.toFixed(4);
    const planned = XI_GRID.length * 4 + 2 - (o.seed ? 1 : 0);
    const best = () => all.reduce((a, b) => (b.J < a.J ? b : a));
    async function ev(kMu, kXi) {
      kMu = +Math.min(MU_MAX, Math.max(MU_MIN, kMu)).toFixed(4); kXi = +kXi.toFixed(4);
      const k = key(kMu, kXi);
      if (seen.has(k)) return seen.get(k);
      if (o.shouldStop && o.shouldStop()) return null;
      const m = await evalFn(kMu, kXi);
      if (!m) return null;
      const e = Object.assign({ kMu, kXi, J: objective(m) }, m);
      seen.set(k, e); all.push(e);
      if (o.onStep) o.onStep(e, all, planned);
      return e;
    }
    if (o.seed) { const e = Object.assign({ kMu: 1, kXi: 1, J: objective(o.seed), seed: true }, o.seed); seen.set(key(1, 1), e); all.push(e); }
    // Her ξ çarpanı için kaçış mesafesi farkını sıfırlayan μ çarpanı: önce işaret değişimi aranır
    // (adımlar büyüyerek), sonra aralık içinde regula falsi. ξ seçimi şekil uyumuyla (J).
    const g = (e) => e.dRunout;
    const tol = (e) => RUNOUT_TOL_CELLS * (e.cell || 1);
    const sameSide = (e, f) => Math.sign(g(e)) === Math.sign(g(f));
    for (const x of XI_GRID) {
      const a = await ev(1, x);
      if (!a) break;
      if (Math.abs(g(a)) <= tol(a)) continue;
      const up = g(a) > 0;                           // simülasyon uzun gidiyor → μ artır
      let lo = a, hi = null;
      for (const m of up ? MU_UP : MU_DOWN) {
        const e = await ev(m, x);
        if (!e) break;
        if (Math.abs(g(e)) <= tol(e) || !sameSide(e, a)) { hi = e; break; }
        lo = e;
      }
      for (let it = 0; hi && it < 2 && Math.abs(g(hi)) > tol(hi); it++) {
        const den = g(hi) - g(lo);
        if (Math.abs(den) < 1e-9) break;
        const e = await ev(lo.kMu - g(lo) * (hi.kMu - lo.kMu) / den, x);
        if (!e || e === lo || e === hi) break;
        if (Math.abs(g(e)) <= tol(e)) break;
        if (sameSide(e, lo)) lo = e; else hi = e;
      }
    }
    if (!all.length) return null;
    // Yerel iyileştirme: kaba ızgarada kaçış birkaç μ değerinde aynı kalabilir; en iyi ξ'de μ,
    // J (şekil uyumu) iyileştikçe ±%7 adımlarla ilerletilir (en çok 4 koşu)
    let cur = best();
    for (let n = 0, dir = 0; n < LOCAL_MAX && !(o.shouldStop && o.shouldStop()); ) {
      const tryDirs = dir ? [dir] : [1, -1];
      let moved = false;
      for (const d of tryDirs) {
        const e = await ev(cur.kMu * (1 + d * LOCAL_STEP), cur.kXi);
        n++;
        if (e && e.J < cur.J - 1e-4) { cur = e; dir = d; moved = true; break; }
        if (n >= LOCAL_MAX) break;
      }
      if (!moved) break;
    }
    // Eşsonluk: J'si en iyiye çok yakın (≤ 0,02) farklı çarpan çiftleri
    const bb = best();
    const alternatives = all.filter((e) => e !== bb && e.J - bb.J <= 0.02 && (Math.abs(e.kMu - bb.kMu) > 0.05 || e.kXi !== bb.kXi));
    return { best: bb, all, alternatives, stopped: !!(o.shouldStop && o.shouldStop()) };
  }

  SLS.calibrate = { AFFECTED_H, XI_GRID, observedMask, metrics, objective, search };
})(typeof window !== 'undefined' ? (window.SLS = window.SLS || {}) : (globalThis.SLS = globalThis.SLS || {}));
