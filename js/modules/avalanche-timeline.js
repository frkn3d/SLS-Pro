/* SLS Pro — Zaman çizelgesi: kayıtlı karelerin çözülmesi ve rapor için zaman dizisi şekli.
 * Kare kodlaması js/sim/voellmy.js içindeki QUANT ile aynıdır (aynı dosya sayfaya da yüklenir).
 */
(function (SLS) {
  'use strict';

  const Q = () => window.SLSVoellmy.QUANT;

  /** Kırpılmış kareyi tam ızgara dizisine açar. kind: 'h' | 'v' | 'p' */
  function decode(frame, W, out, kind) {
    out.fill(0);
    const src = kind === 'v' ? frame.vq : kind === 'p' ? frame.pq : frame.hq;
    if (!src || !frame.w) return out;
    const dec = kind === 'v' ? Q().dv : kind === 'p' ? Q().dp : Q().dh;
    for (let r = 0, k = 0; r < frame.h; r++) {
      const row = (frame.r0 + r) * W + frame.c0;
      for (let c = 0; c < frame.w; c++, k++) if (src[k]) out[row + c] = dec(src[k]);
    }
    return out;
  }

  /** t anına en yakın (≤ t) kare indeksi. */
  function indexAt(frames, t) {
    let lo = 0, hi = frames.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (frames[m].t <= t) lo = m; else hi = m - 1; }
    return lo;
  }

  /**
   * Rapor için 2×2 zaman dizisi: olay süresinin %10, %30, %60 ve sonundaki akış yüksekliği.
   * base: figures.renderMap ortak seçenekleri; label(t) → kare etiketi.
   */
  function sequenceFigure(frames, terrain, base, label) {
    if (!frames || frames.length < 4) return null;
    const N = terrain.width * terrain.height, tEnd = frames[frames.length - 1].t;
    const picks = [0.1, 0.3, 0.6, 1].map((f) => frames[indexAt(frames, f * tEnd)]);
    const buf = new Float32Array(N);
    const panels = picks.map((fr) => {
      decode(fr, terrain.width, buf, 'h');
      const vals = Float32Array.from(buf);
      const cv = SLS.figures.renderMap(Object.assign({}, base, {
        widthPx: 860, path: null, markers: [],
        overlay: { values: vals, classes: SLS.raster.RAMPS.height.classes, mask: (i) => vals[i] >= 0.05, alpha: 210 },
      })).canvas;
      return { cv, t: fr.t };
    });
    const gap = 16, pw = panels[0].cv.width, ph = panels[0].cv.height;
    const out = document.createElement('canvas');
    out.width = pw * 2 + gap; out.height = ph * 2 + gap;
    const g = out.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, out.width, out.height);
    panels.forEach((p, k) => {
      const x = (k % 2) * (pw + gap), y = Math.floor(k / 2) * (ph + gap);
      g.drawImage(p.cv, x, y);
      const txt = label(p.t);
      g.font = 'bold 22px DejaVu Sans, Inter, Arial, sans-serif';
      const tw = g.measureText(txt).width;
      g.fillStyle = 'rgba(17,24,39,0.82)';
      g.fillRect(x + 70, y + 18, tw + 20, 34);
      g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
      g.fillText(txt, x + 80, y + 35);
    });
    return out;
  }

  SLS.avTimeline = { decode, indexAt, sequenceFigure };
})(window.SLS = window.SLS || {});
