/* SLS Pro — Raster sınıflarını vektör poligona dönüştürme (GeoJSON)
 * Hücre kenarı izleme: her sınıf için sınır kenarları yönlü olarak toplanır ve halkalara bağlanır.
 * Dış halkalar ve delikler ayrılır; köşegen temas eden hücreler ayrı tutulur (4-komşuluk).
 * Sonuç RFC 7946 GeoJSON: WGS84, dış halka saat yönünün tersine, delikler saat yönünde.
 */
(function (SLS) {
  'use strict';

  /** Tek sınıf için halkalar (ızgara köşe koordinatlarında: x = sütun, y = satır). */
  function rings(W, H, isIn) {
    // Kenar anahtarı: başlangıç köşesi → [bitiş köşesi, ...]
    const out = new Map();
    const add = (x0, y0, x1, y1) => {
      const k = y0 * (W + 1) + x0;
      let a = out.get(k);
      if (!a) { a = []; out.set(k, a); }
      a.push(y1 * (W + 1) + x1);
    };
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (!isIn(r * W + c)) continue;
        // Ekran koordinatlarında (y aşağı) saat yönünde: iç taraf sağda
        if (r === 0 || !isIn((r - 1) * W + c)) add(c, r, c + 1, r);
        if (c === W - 1 || !isIn(r * W + c + 1)) add(c + 1, r, c + 1, r + 1);
        if (r === H - 1 || !isIn((r + 1) * W + c)) add(c + 1, r + 1, c, r + 1);
        if (c === 0 || !isIn(r * W + c - 1)) add(c, r + 1, c, r);
      }
    }
    const xy = (k) => [k % (W + 1), Math.floor(k / (W + 1))];
    const result = [];
    for (const [start, list] of out) {
      while (list.length) {
        const ring = [start];
        let prev = start, cur = list.pop();
        let guard = 0;
        while (cur !== start && guard++ < 1e7) {
          ring.push(cur);
          const cand = out.get(cur);
          if (!cand || !cand.length) break;
          let pick = 0;
          if (cand.length > 1) {
            // Eyer köşesi: sağa dönüşü tercih et (iç taraf sağda) → köşegen temaslar ayrılır
            const [px, py] = xy(prev), [cx, cy] = xy(cur), dx = cx - px, dy = cy - py;
            const rx = -dy, ry = dx;
            pick = cand.findIndex((k) => { const [nx, ny] = xy(k); return nx - cx === rx && ny - cy === ry; });
            if (pick < 0) pick = 0;
          }
          const next = cand.splice(pick, 1)[0];
          prev = cur; cur = next;
        }
        if (ring.length >= 4) result.push(simplify(ring.map(xy)));
      }
    }
    return result;
  }

  /** Doğrusal ara köşeleri kaldır. */
  function simplify(pts) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b);
    }
    return out;
  }

  const area = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] * r[i][1] - r[i][0] * r[j][1]); return s / 2; };
  function inside(pt, r) {
    let ins = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }

  /**
   * codes: sınıf dizisi; classes: [{ value, props }] → GeoJSON FeatureCollection (MultiPolygon / sınıf)
   */
  function classesToGeoJSON(t, codes, classes) {
    const W = t.width, H = t.height, conv = SLS.proj.converter(t.epsg), cs = t.cellSize;
    const toLL = (p) => {
      const ll = conv.inverse([t.originX + p[0] * cs, t.originY - p[1] * cs]);
      return [Math.round(ll[0] * 1e7) / 1e7, Math.round(ll[1] * 1e7) / 1e7];
    };
    const features = [];
    for (const cl of classes) {
      const rs = rings(W, H, (i) => codes[i] === cl.value);
      // Ekran koordinatında: dış halka saat yönü (alan > 0, y aşağı), delik saat tersi
      const outers = [], holes = [];
      for (const r of rs) (area(r) > 0 ? outers : holes).push(r);
      const polys = outers.map((o) => ({ outer: o, a: Math.abs(area(o)), holes: [] }));
      for (const h of holes) {
        const pt = [h[0][0] + 0.5 * Math.sign(h[1][0] - h[0][0] || 0), h[0][1] + 0.5];
        let best = null;
        for (const p of polys) if (inside(h[0], p.outer) || inside(pt, p.outer)) { if (!best || p.a < best.a) best = p; }
        if (best) best.holes.push(h);
      }
      if (!polys.length) continue;
      // Coğrafi koordinatta y yukarı: ekran saat yönü → saat tersi (RFC 7946 dış halka)
      const coords = polys.map((p) => [
        [...p.outer.map(toLL), toLL(p.outer[0])],
        ...p.holes.map((h) => [...h.map(toLL), toLL(h[0])]),
      ]);
      let cells = 0;
      for (let i = 0; i < codes.length; i++) if (codes[i] === cl.value) cells++;
      features.push({ type: 'Feature', properties: Object.assign({ area_m2: cells * cs * cs, area_ha: +(cells * cs * cs / 1e4).toFixed(3) }, cl.props), geometry: { type: 'MultiPolygon', coordinates: coords } });
    }
    return { type: 'FeatureCollection', features };
  }

  SLS.vectorize = { rings, classesToGeoJSON, area };
})(window.SLS = window.SLS || {});
