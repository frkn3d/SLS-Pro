/* SLS Pro — Rapor ve arayüz şekilleri
 *  - renderMap: arazi verisinden gölgeli kabartma + eş yükselti eğrileri + sonuç bindirmesi,
 *    UTM koordinat etiketleri, ölçek çubuğu ve kuzey oku (karo altlığa bağımlı değil).
 *  - drawProfile: ortak mesafe ekseninde küçük çoklu grafikler (kot, hız, basınç).
 */
(function (SLS) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Görünüm penceresi: ilgilenilen hücrelerin sınır kutusu + kenar payı, en-boy sınırı
  function fitView(t, isOn, opts) {
    const W = t.width, H = t.height;
    let c0 = W, c1 = -1, r0 = H, r1 = -1;
    for (let i = 0; i < W * H; i++) {
      if (!isOn(i)) continue;
      const r = (i / W) | 0, c = i - r * W;
      if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < r0) r0 = r; if (r > r1) r1 = r;
    }
    if (c1 < 0) { c0 = 0; c1 = W - 1; r0 = 0; r1 = H - 1; }
    const m = Math.max(4, Math.round(Math.max(c1 - c0, r1 - r0) * (opts && opts.margin != null ? opts.margin : 0.08)));
    c0 -= m; c1 += m + 1; r0 -= m; r1 += m + 1;
    // En-boy oranını [minA, maxA] aralığına getir (yükseklik / genişlik)
    const minA = opts && opts.minAspect || 0.55, maxA = opts && opts.maxAspect || 0.8;
    let w = c1 - c0, h = r1 - r0;
    if (h / w > maxA) { const nw = Math.ceil(h / maxA); c0 -= Math.floor((nw - w) / 2); c1 = c0 + nw; }
    else if (h / w < minA) { const nh = Math.ceil(w * minA); r0 -= Math.floor((nh - h) / 2); r1 = r0 + nh; }
    // Izgaraya sığdır (gerekirse kaydır)
    const clampShift = (a, b, max) => { if (a < 0) { b -= a; a = 0; } if (b > max) { a -= b - max; b = max; } return [Math.max(0, a), Math.min(max, b)]; };
    [c0, c1] = clampShift(c0, c1, W);
    [r0, r1] = clampShift(r0, r1, H);
    return { c0, c1, r0, r1 };
  }

  // ---------------------------------------------------------------------------
  // Eş yükselti eğrileri (marching squares, hücre merkezleri)
  function contours(t, interval, v) {
    const W = t.width, z = t.data, segs = [];
    const ip = (za, zb, L) => (L - za) / (zb - za);
    for (let r = v.r0; r < v.r1 - 1; r++) {
      for (let c = v.c0; c < v.c1 - 1; c++) {
        const a = z[r * W + c], b = z[r * W + c + 1], d = z[(r + 1) * W + c + 1], e = z[(r + 1) * W + c];
        if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(d) || Number.isNaN(e)) continue;
        const mn = Math.min(a, b, d, e), mx = Math.max(a, b, d, e);
        for (let L = Math.ceil(mn / interval) * interval; L < mx; L += interval) {
          if (L === mn) continue;
          const A = a >= L, B = b >= L, D = d >= L, E = e >= L;
          const p = [];
          if (A !== B) p.push([c + ip(a, b, L), r]);
          if (B !== D) p.push([c + 1, r + ip(b, d, L)]);
          if (E !== D) p.push([c + ip(e, d, L), r + 1]);
          if (A !== E) p.push([c, r + ip(a, e, L)]);
          if (p.length === 2) segs.push([p[0][0], p[0][1], p[1][0], p[1][1], L]);
          else if (p.length === 4) { // eyer noktası
            const center = (a + b + d + e) / 4 >= L;
            if (center === A) { segs.push([...p[0], ...p[1], L], [...p[2], ...p[3], L]); }
            else { segs.push([...p[0], ...p[3], L], [...p[1], ...p[2], L]); }
          }
        }
      }
    }
    return segs;
  }

  function niceStep(span, target) {
    const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * p) return m * p;
    return 10 * p;
  }

  // ---------------------------------------------------------------------------
  /**
   * Harita şekli. o = { t, slope, aspect, view, widthPx, overlay:{values, classes, mask, alpha},
   *   releaseMask, path:[cell...], markers:[{cell, kind:'top'|'tip'}], contourInterval }
   */
  function renderMap(o) {
    const t = o.t, v = o.view, W = t.width;
    const vw = v.c1 - v.c0, vh = v.r1 - v.r0;
    const k = o.widthPx / 1600;                       // yazı/çizgi ölçeği
    // Sol boşluk en uzun kuzey (northing) etiketine göre
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = `${Math.round(17 * k * 1.4)}px DejaVu Sans, Inter, Arial, sans-serif`;
    const yMaxLabel = Math.round(t.originY - v.r0 * t.cellSize).toLocaleString('en-US').replace(/,/g, ' ');
    const ML = Math.round(mctx.measureText(yMaxLabel).width + 24 * k * 1.4), MB = Math.round(46 * k), MT = Math.round(14 * k), MR = Math.round(14 * k);
    const plotW = o.widthPx - ML - MR;
    const s = plotW / vw;                             // piksel / hücre
    const plotH = Math.round(vh * s);
    const cv = document.createElement('canvas');
    cv.width = o.widthPx; cv.height = plotH + MT + MB;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);

    // 1) Gölgeli kabartma (hücre çözünürlüğünde, yumuşatılarak ölçeklenir)
    const hs = document.createElement('canvas'); hs.width = vw; hs.height = vh;
    const hctx = hs.getContext('2d'), img = hctx.createImageData(vw, vh), px = img.data;
    const zen = 45 * Math.PI / 180, az = 315 * Math.PI / 180, d2r = Math.PI / 180;
    for (let r = 0; r < vh; r++) for (let c = 0; c < vw; c++) {
      const i = (v.r0 + r) * W + (v.c0 + c), j = (r * vw + c) * 4;
      const sl = o.slope[i] * d2r, as = o.aspect[i] * d2r;
      let h = Math.cos(zen) * Math.cos(sl) + Math.sin(zen) * Math.sin(sl) * Math.cos(az - as);
      if (!Number.isFinite(h)) h = 1;
      const g = Math.round(150 + 105 * Math.max(0, Math.min(1, h)));
      px[j] = g; px[j + 1] = g; px[j + 2] = g; px[j + 3] = 255;
    }
    hctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.beginPath(); ctx.rect(ML, MT, plotW, plotH); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(hs, ML, MT, plotW, plotH);

    // 2) Sonuç bindirmesi (sınıflı, keskin)
    if (o.overlay) {
      const ov = document.createElement('canvas'); ov.width = vw; ov.height = vh;
      const octx = ov.getContext('2d'), oimg = octx.createImageData(vw, vh), op = oimg.data;
      const { values, classes, mask } = o.overlay, alpha = o.overlay.alpha || 200;
      for (let r = 0; r < vh; r++) for (let c = 0; c < vw; c++) {
        const i = (v.r0 + r) * W + (v.c0 + c);
        if (mask && !mask(i)) continue;
        const col = SLS.raster.classColor(classes, values[i]);
        if (!col) continue;
        const j = (r * vw + c) * 4;
        op[j] = col[0]; op[j + 1] = col[1]; op[j + 2] = col[2]; op[j + 3] = alpha;
      }
      octx.putImageData(oimg, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(ov, ML, MT, plotW, plotH);
    }

    // 3) Eş yükselti eğrileri
    if (o.contourInterval) {
      const segs = contours(t, o.contourInterval, v);
      const major = o.contourInterval * 5;
      for (const pass of [0, 1]) {
        ctx.beginPath();
        for (const sg of segs) {
          const isMajor = Math.abs(sg[4] / major - Math.round(sg[4] / major)) < 1e-6;
          if ((pass === 1) !== isMajor) continue;
          ctx.moveTo(ML + (sg[0] - v.c0 + 0.5) * s, MT + (sg[1] - v.r0 + 0.5) * s);
          ctx.lineTo(ML + (sg[2] - v.c0 + 0.5) * s, MT + (sg[3] - v.r0 + 0.5) * s);
        }
        ctx.strokeStyle = pass ? 'rgba(70,52,36,0.55)' : 'rgba(70,52,36,0.28)';
        ctx.lineWidth = (pass ? 1.6 : 0.9) * k * 1.4;
        ctx.stroke();
      }
    }

    // 4) Kopma alanı sınırı
    if (o.releaseMask) {
      const m = o.releaseMask;
      ctx.beginPath();
      for (let r = v.r0; r < v.r1; r++) for (let c = v.c0; c < v.c1; c++) {
        const i = r * W + c;
        if (!m[i]) continue;
        const x = ML + (c - v.c0) * s, y = MT + (r - v.r0) * s;
        if (c === 0 || !m[i - 1]) { ctx.moveTo(x, y); ctx.lineTo(x, y + s); }
        if (c === W - 1 || !m[i + 1]) { ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); }
        if (r === 0 || !m[i - W]) { ctx.moveTo(x, y); ctx.lineTo(x + s, y); }
        if (r === t.height - 1 || !m[i + W]) { ctx.moveTo(x, y + s); ctx.lineTo(x + s, y + s); }
      }
      ctx.strokeStyle = '#0891b2'; ctx.lineWidth = 2.2 * k * 1.4; ctx.stroke();
    }

    // 5) Akış yolu ve işaretler
    const cellXY = (i) => { const r = (i / W) | 0, c = i - r * W; return [ML + (c - v.c0 + 0.5) * s, MT + (r - v.r0 + 0.5) * s]; };
    if (o.path && o.path.length > 1) {
      for (const [col, lw] of [['#ffffff', 5.5], ['#111827', 2.4]]) {
        ctx.beginPath();
        o.path.forEach((i, n) => { const [x, y] = cellXY(i); n ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.strokeStyle = col; ctx.lineWidth = lw * k * 1.4; ctx.lineJoin = 'round'; ctx.stroke();
      }
    }
    for (const mk of o.markers || []) {
      const [x, y] = cellXY(mk.cell), R = 9 * k * 1.4;
      ctx.beginPath();
      if (mk.kind === 'top') { ctx.moveTo(x, y - R); ctx.lineTo(x + R, y + R * 0.8); ctx.lineTo(x - R, y + R * 0.8); ctx.closePath(); }
      else ctx.arc(x, y, R * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = mk.kind === 'top' ? '#0891b2' : '#111827';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * k;
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    // 6) Çerçeve, UTM koordinat etiketleri
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.5 * k * 1.4;
    ctx.strokeRect(ML, MT, plotW, plotH);
    const cs = t.cellSize;
    const x0 = t.originX + v.c0 * cs, x1 = t.originX + v.c1 * cs;
    const y1 = t.originY - v.r0 * cs, y0 = t.originY - v.r1 * cs;
    const step = niceStep(Math.max(x1 - x0, y1 - y0), 5);
    const fs = Math.round(17 * k * 1.4);
    ctx.font = `${fs}px DejaVu Sans, Inter, Arial, sans-serif`;
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      const px0 = ML + (x - x0) / cs * s;
      ctx.beginPath(); ctx.moveTo(px0, MT + plotH); ctx.lineTo(px0, MT + plotH + 6 * k * 1.4); ctx.stroke();
      ctx.fillText(Math.round(x).toLocaleString('en-US').replace(/,/g, ' '), px0, MT + plotH + 9 * k * 1.4);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      const py = MT + (y1 - y) / cs * s;
      ctx.beginPath(); ctx.moveTo(ML - 6 * k * 1.4, py); ctx.lineTo(ML, py); ctx.stroke();
      ctx.fillText(Math.round(y).toLocaleString('en-US').replace(/,/g, ' '), ML - 9 * k * 1.4, py);
    }

    // 7) Ölçek çubuğu (sol alt, harita içinde)
    const barM = niceStep((x1 - x0) / 4, 1);
    const barPx = barM / cs * s;
    const bx = ML + 16 * k * 1.4, by = MT + plotH - 22 * k * 1.4, bh = 7 * k * 1.4;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(bx - 8 * k, by - fs - 10 * k, barPx + 16 * k + fs * 3, fs + bh + 18 * k);
    ctx.fillStyle = '#111827'; ctx.fillRect(bx, by, barPx / 2, bh);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + barPx / 2, by, barPx / 2, bh);
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.2 * k; ctx.strokeRect(bx, by, barPx, bh);
    ctx.fillStyle = '#111827'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(barM >= 1000 ? `${barM / 1000} km` : `${barM} m`, bx, by - 4 * k);

    // 8) Kuzey oku (sağ üst) — UTM grid kuzeyi
    const nx = ML + plotW - 30 * k * 1.4, ny = MT + 18 * k * 1.4, L = 26 * k * 1.4;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(nx, ny + L * 0.75, L * 0.95, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.moveTo(nx, ny + 2 * k); ctx.lineTo(nx + L * 0.32, ny + L); ctx.lineTo(nx, ny + L * 0.78); ctx.lineTo(nx - L * 0.32, ny + L); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `bold ${fs}px DejaVu Sans, Inter, Arial, sans-serif`;
    ctx.fillText('N', nx, ny + L + 2 * k);

    return { canvas: cv, step, contourInterval: o.contourInterval };
  }

  function contourIntervalFor(relief) {
    if (relief > 1500) return 50;
    if (relief > 600) return 20;
    if (relief > 200) return 10;
    return 5;
  }

  // ---------------------------------------------------------------------------
  /**
   * Boykesit: ortak x (mesafe) ekseninde 3 panel. Her panel tek seri, tek y ekseni.
   * p = { d:[], z:[], v:[], p:[], h:[], release:[bool] }, theme = { bg, ink, ink2, grid, line, fill, band, ref }
   * labels = { z, v, p, dist, release, ref3, ref30 }
   */
  function drawProfile(canvas, prof, theme, labels, cssW, cssH, dpr) {
    dpr = dpr || 1;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, cssW, cssH);
    const font = theme.font || 'Inter, system-ui, sans-serif';
    const fs = theme.fontSize || 11;
    const ML = theme.ml || 46, MR = 10, MT = 6, MB = fs * 2 + 10, gap = fs + 14;
    const panels = [
      { key: 'z', label: labels.z, data: prof.z, fill: true },
      { key: 'v', label: labels.v, data: prof.v },
      { key: 'p', label: labels.p, data: prof.p, refs: [[3, labels.ref3], [30, labels.ref30]] },
    ];
    const ph = (cssH - MT - MB - gap * panels.length) / panels.length;
    const n = prof.d.length, dMax = prof.d[n - 1] || 1;
    const X = (d) => ML + (d / dMax) * (cssW - ML - MR);
    const layout = { ML, MR, cssW, dMax, panels: [] };

    panels.forEach((P, k) => {
      const top = MT + k * (ph + gap) + gap, bot = top + ph;
      let lo = Math.min(...P.data), hi = Math.max(...P.data);
      if (P.key !== 'z') lo = 0;
      if (P.refs) hi = Math.max(hi, 32);
      if (hi - lo < 1e-6) hi = lo + 1;
      const step = niceStep(hi - lo, 3);
      lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
      const Y = (val) => bot - (val - lo) / (hi - lo) * ph;
      layout.panels.push({ top, bot, Y, key: P.key });

      // Başlık (panel üstü, sol)
      ctx.fillStyle = theme.ink; ctx.font = `600 ${fs}px ${font}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(P.label, ML, top - 4);
      // Izgara + y etiketleri
      ctx.font = `${fs - 1}px ${font}`; ctx.fillStyle = theme.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = theme.grid; ctx.lineWidth = 1;
      for (let val = lo; val <= hi + 1e-9; val += step) {
        const y = Math.round(Y(val)) + 0.5;
        ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(cssW - MR, y); ctx.stroke();
        ctx.fillText(SLS.i18n.number(val, step < 1 ? 1 : 0), ML - 6, y);
      }
      // Kopma bölgesi bandı
      if (k === 0 && prof.release) {
        let a = -1;
        for (let i = 0; i <= n; i++) {
          const on = i < n && prof.release[i];
          if (on && a < 0) a = i;
          if (!on && a >= 0) {
            ctx.fillStyle = theme.band;
            ctx.fillRect(X(prof.d[a]), top, Math.max(2, X(prof.d[i - 1]) - X(prof.d[a])), ph);
            if (!layout.releaseLabeled) {
              ctx.fillStyle = theme.ink2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
              ctx.fillText(labels.release, X(prof.d[a]) + 4, top + 3);
              layout.releaseLabeled = true;
            }
            a = -1;
          }
        }
      }
      // Eşik çizgileri (basınç bölge sınırları)
      if (P.refs) {
        ctx.setLineDash([4, 3]); ctx.strokeStyle = theme.ref; ctx.lineWidth = 1;
        for (const [val, lab] of P.refs) {
          const y = Math.round(Y(val)) + 0.5;
          ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(cssW - MR, y); ctx.stroke();
          ctx.fillStyle = theme.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
          ctx.fillText(lab, cssW - MR - 2, y - 2);
        }
        ctx.setLineDash([]);
      }
      // Seri
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const x = X(prof.d[i]), y = Y(P.data[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      if (P.fill) {
        ctx.save();
        ctx.lineTo(X(prof.d[n - 1]), bot); ctx.lineTo(X(prof.d[0]), bot); ctx.closePath();
        ctx.fillStyle = theme.fill; ctx.fill();
        ctx.restore();
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const x = X(prof.d[i]), y = Y(P.data[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = theme.ink2;
      } else ctx.strokeStyle = theme.line;
      ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
      // Taban çizgisi
      ctx.strokeStyle = theme.axis || theme.ink2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ML, Math.round(bot) + 0.5); ctx.lineTo(cssW - MR, Math.round(bot) + 0.5); ctx.stroke();
    });

    // Ortak x ekseni (en altta)
    const xs = niceStep(dMax, 5);
    ctx.fillStyle = theme.ink2; ctx.font = `${fs - 1}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const yb = layout.panels[layout.panels.length - 1].bot;
    for (let d = 0; d <= dMax + 1e-9; d += xs) ctx.fillText(SLS.i18n.number(d), X(d), yb + 4);
    ctx.fillText(labels.dist, ML + (cssW - ML - MR) / 2, yb + fs + 8);
    layout.X = X;
    return layout;
  }

  SLS.figures = { fitView, contours, renderMap, contourIntervalFor, drawProfile, niceStep };
})(window.SLS = window.SLS || {});
