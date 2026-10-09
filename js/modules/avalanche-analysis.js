/* SLS Pro — Çığ analiz fonksiyonları (arayüzden bağımsız, saf hesap)
 *
 *  - releaseDepth: kopma kalınlığı haritası (taban d₀ + yükseklik gradyanı + rüzgâr yüklemesi)
 *  - analyze: kaçış, α, etkilenen alan, bölge alanları, kütle dengesi, tamamlanma durumu
 *  - flowProfile: akış yolu (Dijkstra) ve boykesit
 *  - zoningMatrix: T30 + T300 şiddet–olasılık matrisi (İsviçre yaklaşımı)
 *  - assetRisk: KML'den gelen yapı/yol/alan unsurları için en yüksek etkiler
 */
(function (SLS) {
  'use strict';

  const AFFECTED_H = 0.1;   // etkilenen alan eşiği (m)
  const D2R = Math.PI / 180;

  // ---------------------------------------------------------------------------
  /** Rüzgâr yüklemesi (m, yamaca dik): rüzgâraltı yamaçta artış, rüzgârüstünde yarısı kadar azalma. */
  function windDelta(aspectDeg, wind) {
    if (!wind || !wind.on || !(wind.speed > 4) || !Number.isFinite(aspectDeg)) return 0;
    const k = Math.min(0.5, (wind.speed - 4) * 0.03);       // 10 m/s → 0,18 m; 20 m/s → 0,48 m
    const lee = ((wind.dir || 0) + 180) % 360;              // rüzgârın estiği yön = rüzgâraltı bakı
    const c = Math.cos((aspectDeg - lee) * D2R);
    return c > 0 ? k * c : 0.5 * k * c;
  }

  /** Salm vd. (1990) eğim düzeltmesi f(ψ) = 0,291 / (sin ψ − 0,202 cos ψ); 28°'de 1. */
  function fpsi(psiDeg) {
    const p = Math.max(25, Math.min(60, psiDeg)) * D2R;
    return 0.291 / (Math.sin(p) - 0.202 * Math.cos(p));
  }

  /**
   * Kopma kalınlığı haritası.
   * method 'direct': d = d₀ (+ kot gradyanı + rüzgâr), yamaca dik, doğrudan
   * method 'swiss' : d = (ΔHS₃ + g·(z − z_ref)/100 + rüzgâr) · f(ψ)   (İsviçre yöntemi, Salm vd. 1990)
   * method 'field' : d = (d_çukur + g·(z − z_çukur)/100 + rüzgâr) · f(ψ) / f(ψ_çukur)
   * ctx = { terrain, slope, aspect, mask }; o = { d0, elevRef, grad (m/100 m), wind }
   * Döner: { h0 (düşey yükseklik), d (yamaca dik kalınlık), stats }
   */
  function releaseDepth(ctx, o) {
    const tr = ctx.terrain, N = tr.width * tr.height, a = tr.cellSize * tr.cellSize;
    const h0 = new Float32Array(N), d = new Float32Array(N);
    let cells = 0, vol = 0, sl = 0, zmin = Infinity, zmax = -Infinity, dmin = Infinity, dmax = -Infinity, dsum = 0;
    for (let i = 0; i < N; i++) {
      if (!ctx.mask[i] || Number.isNaN(tr.data[i])) continue;
      let di = o.d0;
      const zr = o.method === 'swiss' ? (o.zref ?? 2000) : o.elevRef;
      if (zr != null && Number.isFinite(zr) && o.grad) di += o.grad * (tr.data[i] - zr) / 100;
      di += windDelta(ctx.aspect[i], o.wind);
      if (o.method === 'swiss') di *= fpsi(ctx.slope[i]);
      else if (o.method === 'field') di *= fpsi(ctx.slope[i]) / fpsi(o.refSlope || 28);
      di = Math.max(0.05, di);
      d[i] = di;
      const hv = di / Math.cos(ctx.slope[i] * D2R);
      h0[i] = hv; cells++; vol += hv * a; sl += ctx.slope[i]; dsum += di;
      if (tr.data[i] < zmin) zmin = tr.data[i];
      if (tr.data[i] > zmax) zmax = tr.data[i];
      if (di < dmin) dmin = di;
      if (di > dmax) dmax = di;
    }
    return {
      h0, d,
      stats: { cells, area: cells * a, volume: vol, meanSlope: cells ? sl / cells : 0, zmin, zmax, dmin, dmax, dmean: cells ? dsum / cells : 0 },
    };
  }

  // ---------------------------------------------------------------------------
  /** Kaçış mesafesi, α, etkilenen alan, bölge alanları, kütle dengesi. */
  function analyze(res, ctx) {
    const tr = ctx.terrain, W = tr.width, N = W * tr.height, cs = tr.cellSize, z = tr.data, st = res.status, mask = ctx.mask;
    let iTop = -1;
    for (let i = 0; i < N; i++) if (mask[i] && (iTop < 0 || z[i] > z[iTop])) iTop = i;
    const rT = (iTop / W) | 0, cT = iTop - rT * W;
    let best = 0, iTip = iTop, affected = 0, hmax = 0, vmax = 0, pmax = 0, ppow = 0, erodedVol = 0, powderHa = 0;
    const zoneCells = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      if (res.hmax[i] > hmax) hmax = res.hmax[i];
      if (res.vmax[i] > vmax) vmax = res.vmax[i];
      if (res.pmax[i] > pmax) pmax = res.pmax[i];
      if (res.eroded) erodedVol += res.eroded[i];
      if (res.powder) { const pp = res.powder.pmax[i]; if (pp > ppow) ppow = pp; if (pp >= 0.5) powderHa++; }
      if (res.hmax[i] < AFFECTED_H) continue;
      affected++;
      const p = res.pmax[i];
      zoneCells[p >= 30 ? 2 : p >= 3 ? 1 : 0]++;
      const r = (i / W) | 0, c = i - r * W;
      const d2 = (r - rT) * (r - rT) + (c - cT) * (c - cT);
      if (d2 > best) { best = d2; iTip = i; }
    }
    const runout = Math.sqrt(best) * cs;
    const drop = z[iTop] - z[iTip];
    const ha = cs * cs / 10000;
    const inflow = st.releaseVolume + (st.entrained || 0);
    const outflowShare = inflow > 0 ? st.outflow / inflow : 0;
    return {
      runout, drop, alpha: runout > 0 ? Math.atan(drop / runout) * 180 / Math.PI : 0,
      iTop, iTip, hmax, vmax, pmax,
      affectedHa: affected * ha, zoneHa: zoneCells.map((x) => x * ha),
      release: st.releaseVolume, entrained: st.entrained || 0, erodedCover: erodedVol * cs * cs,
      deposit: st.depositVolume, outflow: st.outflow, outflowShare, edges: st.edges,
      toPowder: st.toPowderVol || 0, powderPmax: ppow, powderHa: powderHa * ha, powder: st.powder,
      massErr: (inflow + st.clipped - st.depositVolume - st.outflow - (st.toPowderVol || 0)) / st.releaseVolume,
      t: st.t, steps: st.steps, wallMs: st.wallMs, reason: st.reason,
      complete: outflowShare <= 0.001 && st.reason !== 'tmax' && st.reason !== 'user',
    };
  }

  // ---------------------------------------------------------------------------
  /** Akış yolu: akış ucunu besleyen kopma yamacından uca, hızlı akış çekirdeğini izleyen yol (Dijkstra). */
  function flowProfile(res, ctx, iTop, iTip) {
    const tr = ctx.terrain, W = tr.width, H = tr.height, N = W * H, cs = tr.cellSize, mask = ctx.mask;
    if (iTop < 0 || iTip < 0 || iTop === iTip || mask[iTip] === 1) return null;
    const inFlow = (i) => res.hmax[i] >= 0.05 || mask[i] === 1;
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const hc = [], hi = [];
    const push = (c, i) => {
      let k = hc.length; hc.push(c); hi.push(i);
      while (k > 0) { const p = (k - 1) >> 1; if (hc[p] <= hc[k]) break; [hc[p], hc[k]] = [hc[k], hc[p]]; [hi[p], hi[k]] = [hi[k], hi[p]]; k = p; }
    };
    const pop = () => {
      const c = hc[0], i = hi[0], lc = hc.pop(), li = hi.pop();
      if (hc.length) {
        hc[0] = lc; hi[0] = li; let k = 0;
        for (;;) {
          const a = 2 * k + 1, b = a + 1; let m = k;
          if (a < hc.length && hc[a] < hc[m]) m = a;
          if (b < hc.length && hc[b] < hc[m]) m = b;
          if (m === k) break;
          [hc[m], hc[k]] = [hc[k], hc[m]]; [hi[m], hi[k]] = [hi[k], hi[m]]; k = m;
        }
      }
      return [c, i];
    };
    // Çok kaynaklı başlangıç: tüm kopma hücreleri; yüksekte başlamak ucuzdur (0,3 s/m)
    const zTop = tr.data[iTop];
    for (let i = 0; i < N; i++) if (mask[i] === 1) { dist[i] = 0.3 * (zTop - tr.data[i]); push(dist[i], i); }
    while (hc.length) {
      const [dc, i] = pop();
      if (dc > dist[i]) continue;
      if (i === iTip) break;
      const r = (i / W) | 0, c = i - r * W;
      for (let dr = -1; dr <= 1; dr++) for (let dcol = -1; dcol <= 1; dcol++) {
        if (!dr && !dcol) continue;
        const rr = r + dr, cc = c + dcol;
        if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue;
        const j = rr * W + cc;
        if (Number.isNaN(tr.data[j])) continue;
        const len = (dr && dcol ? Math.SQRT2 : 1) * cs;
        // Süre benzeri maliyet × eğim cezası (yana / yokuş yukarı pahalı) × akış dışı cezası
        const grade = (tr.data[i] - tr.data[j]) / len;
        const penalty = (1 + 8 * Math.max(0, 0.3 - grade)) * (inFlow(j) ? 1 : 4);
        const nd = dc + len / (0.5 * (res.vmax[i] + res.vmax[j]) + 1) * penalty;
        if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(nd, j); }
      }
    }
    if (!Number.isFinite(dist[iTip])) return null;
    const cells = [];
    for (let i = iTip; i >= 0; i = prev[i]) cells.push(i);
    cells.reverse();
    const prof = { cells, d: [], z: [], v: [], p: [], h: [], s: [], pp: [], release: [] };
    let acc = 0;
    cells.forEach((i, k) => {
      if (k) {
        const a = cells[k - 1], ra = (a / W) | 0, rb = (i / W) | 0;
        acc += Math.hypot(rb - ra, (i - rb * W) - (a - ra * W)) * cs;
      }
      prof.d.push(acc); prof.z.push(tr.data[i]); prof.v.push(res.vmax[i]); prof.p.push(res.pmax[i]);
      prof.h.push(res.hmax[i]); prof.s.push(ctx.slope[i]); prof.release.push(mask[i] === 1);
      prof.pp.push(res.powder ? res.powder.pmax[i] : 0);
    });
    return prof;
  }

  // ---------------------------------------------------------------------------
  /**
   * Şiddet–olasılık matrisi (İsviçre yaklaşımı; şiddet eşikleri 3 ve 30 kPa):
   *   Kırmızı: T300'de p ≥ 30 kPa  veya  T30'da p ≥ 3 kPa
   *   Mavi:    T300'de 3 ≤ p < 30 kPa  veya  T30'da p < 3 kPa (etkilenmiş)
   *   Sarı:    yalnızca T300'de p < 3 kPa (etkilenmiş) veya toz bulutu basıncı 1–3 kPa
   * Toz bulutu basıncı ≥ 3 kPa, aynı eşiklerle yoğun akış şiddetine eklenir.
   * Kodlar: 3 kırmızı, 2 mavi, 1 sarı, 0 yok.
   */
  function zoningMatrix(r30, r300, N) {
    const out = new Uint8Array(N);
    const I = (r, i) => {
      if (!r) return { on: false, p: 0, pp: 0 };
      const on = r.hmax[i] >= AFFECTED_H;
      const pp = r.powder ? r.powder.pmax[i] : 0;
      return { on, p: on ? r.pmax[i] : 0, pp };
    };
    for (let i = 0; i < N; i++) {
      const a = I(r30, i), b = I(r300, i);
      const p30 = Math.max(a.p, a.pp >= 3 ? a.pp : 0), p300 = Math.max(b.p, b.pp >= 3 ? b.pp : 0);
      const on30 = a.on || a.pp >= 3, on300 = b.on || b.pp >= 3;
      let z = 0;
      if ((on300 && p300 >= 30) || (on30 && p30 >= 3)) z = 3;
      else if ((on300 && p300 >= 3) || on30) z = 2;
      else if (on300 || b.pp >= 1 || a.pp >= 1) z = 1;
      out[i] = z;
    }
    return out;
  }

  function zoneAreas(codes, cs) {
    const c = [0, 0, 0, 0];
    for (const z of codes) c[z]++;
    const ha = cs * cs / 10000;
    return { yellow: c[1] * ha, blue: c[2] * ha, red: c[3] * ha };
  }

  /** Tek senaryoda basınca göre bölge kodu (3/2/1/0). */
  function singleZone(r, i) {
    if (r.hmax[i] < AFFECTED_H) return r.powder && r.powder.pmax[i] >= 1 ? 1 : 0;
    const p = r.pmax[i];
    return p >= 30 ? 3 : p >= 3 ? 2 : 1;
  }

  // ---------------------------------------------------------------------------
  /**
   * Unsur risk tablosu. assets: KML özellikleri (Point / LineString / Polygon, WGS84).
   * runs: { key: result }; zoneOf(i) → bölge kodu.
   */
  function assetRisk(assets, ctx, primary, zoneOf) {
    const tr = ctx.terrain, cs = tr.cellSize;
    const cellsOf = (f) => {
      const set = new Set();
      if (f.type === 'Point') { const i = SLS.raster.cellAt(tr, f.coords[0], f.coords[1]); if (i >= 0) set.add(i); }
      else if (f.type === 'LineString') {
        for (let k = 1; k < f.coords.length; k++) {
          const [x0, y0] = SLS.raster.lonLatToGrid(tr, f.coords[k - 1][0], f.coords[k - 1][1]);
          const [x1, y1] = SLS.raster.lonLatToGrid(tr, f.coords[k][0], f.coords[k][1]);
          const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
          for (let s = 0; s <= n; s++) {
            const c = Math.floor(x0 + (x1 - x0) * s / n), r = Math.floor(y0 + (y1 - y0) * s / n);
            if (c >= 0 && r >= 0 && c < tr.width && r < tr.height) set.add(r * tr.width + c);
          }
        }
      } else if (f.type === 'Polygon') {
        SLS.raster.rasterizePolygon(tr, f.coords, (i) => set.add(i));
        const i = SLS.raster.cellAt(tr, f.coords[0][0], f.coords[0][1]); if (i >= 0) set.add(i);
      }
      return set;
    };
    return assets.map((f) => {
      const cells = cellsOf(f);
      let zone = 0, p = 0, h = 0, v = 0, pp = 0, hit = 0;
      for (const i of cells) {
        zone = Math.max(zone, zoneOf(i));
        if (primary.hmax[i] >= AFFECTED_H) { hit++; p = Math.max(p, primary.pmax[i]); h = Math.max(h, primary.hmax[i]); v = Math.max(v, primary.vmax[i]); }
        if (primary.powder) pp = Math.max(pp, primary.powder.pmax[i]);
      }
      const inside = cells.size > 0;
      return {
        name: f.name || '—', type: f.type, inside, zone, pmax: p, hmax: h, vmax: v, powderP: pp,
        affectedLen: f.type === 'LineString' ? hit * cs : null,
        affectedArea: f.type === 'Polygon' ? hit * cs * cs : null,
        feature: f,
      };
    }).sort((a, b) => b.zone - a.zone || b.pmax - a.pmax);
  }

  SLS.avAnalysis = { AFFECTED_H, windDelta, fpsi, releaseDepth, analyze, flowProfile, zoningMatrix, zoneAreas, singleZone, assetRisk };
})(window.SLS = window.SLS || {});
