/* SLS Pro — Raster yardımcıları: renk sınıfları, boyama, poligon rasterleştirme,
 * bağlı bileşen etiketleme. Tüm modüller tarafından paylaşılır.
 */
(function (SLS) {
  'use strict';

  // Sınıflı renk skalaları [min, max) — legend ile birebir
  const RAMPS = {
    height: { unit: 'm', classes: [
      { min: 0.05, max: 0.5, color: [198, 230, 255] },
      { min: 0.5, max: 1, color: [140, 200, 245] },
      { min: 1, max: 2, color: [79, 159, 224] },
      { min: 2, max: 3, color: [47, 111, 196] },
      { min: 3, max: 5, color: [59, 63, 160] },
      { min: 5, max: Infinity, color: [91, 31, 132] },
    ] },
    velocity: { unit: 'm/s', classes: [
      { min: 1, max: 5, color: [255, 233, 168] },
      { min: 5, max: 10, color: [255, 200, 87] },
      { min: 10, max: 20, color: [255, 155, 61] },
      { min: 20, max: 30, color: [242, 96, 58] },
      { min: 30, max: 40, color: [200, 50, 58] },
      { min: 40, max: Infinity, color: [122, 22, 64] },
    ] },
    pressure: { unit: 'kPa', classes: [
      { min: 1, max: 3, color: [254, 243, 199] },
      { min: 3, max: 10, color: [252, 211, 77] },
      { min: 10, max: 30, color: [245, 158, 11] },
      { min: 30, max: 100, color: [220, 38, 38] },
      { min: 100, max: Infinity, color: [127, 29, 29] },
    ] },
    // T30 + T300 şiddet–olasılık matrisi kodları (1 sarı, 2 mavi, 3 kırmızı)
    matrix: { unit: '', classes: [
      { min: 1, max: 2, color: [250, 204, 21], key: 'zone.yellowM' },
      { min: 2, max: 3, color: [37, 99, 235], key: 'zone.blueM' },
      { min: 3, max: Infinity, color: [220, 38, 38], key: 'zone.redM' },
    ] },
    // Toz bulutu darbe basıncı (deneysel)
    powder: { unit: 'kPa', classes: [
      { min: 0.5, max: 1, color: [233, 213, 255] },
      { min: 1, max: 3, color: [196, 160, 255] },
      { min: 3, max: 10, color: [139, 92, 246] },
      { min: 10, max: Infinity, color: [91, 33, 182] },
    ] },
    // Sürüklenen örtü karı derinliği
    erosion: { unit: 'm', classes: [
      { min: 0.02, max: 0.1, color: [254, 235, 200] },
      { min: 0.1, max: 0.3, color: [253, 186, 116] },
      { min: 0.3, max: 0.6, color: [234, 88, 12] },
      { min: 0.6, max: Infinity, color: [154, 52, 18] },
    ] },
    // İsviçre çığ tehlike bölgelemesi, basınç ölçütü (gösterge niteliğinde)
    zones: { unit: 'kPa', classes: [
      { min: 0, max: 3, color: [250, 204, 21], key: 'zone.yellow' },
      { min: 3, max: 30, color: [37, 99, 235], key: 'zone.blue' },
      { min: 30, max: Infinity, color: [220, 38, 38], key: 'zone.red' },
    ] },
  };

  function classColor(classes, v) {
    for (let k = 0; k < classes.length; k++) {
      const c = classes[k];
      if (v >= c.min && v < c.max) return c.color;
    }
    return null;
  }

  /** values → canvas (sınıflı renk). mask(i) false ise şeffaf. */
  function paint(canvas, w, h, values, classes, alpha, mask) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const px = img.data;
    for (let i = 0; i < w * h; i++) {
      if (mask && !mask(i)) continue;
      const col = classColor(classes, values[i]);
      if (!col) continue;
      px[i * 4] = col[0]; px[i * 4 + 1] = col[1]; px[i * 4 + 2] = col[2]; px[i * 4 + 3] = alpha;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /**
   * Sürekli renk: sınıf eşiklerini kontrol noktası olarak kullanır, aradaki renkleri (log ölçekte) karıştırır.
   * Böylece sınıflı ve sürekli görünüm aynı renk dilini konuşur.
   */
  function continuousStops(classes) {
    const st = classes.map((c) => ({ v: c.min, col: c.color }));
    const last = classes[classes.length - 1];
    st.push({ v: Number.isFinite(last.max) ? last.max : last.min * 1.6, col: last.color });
    return st;
  }
  function continuousColor(stops, v) {
    if (!(v >= stops[0].v)) return null;
    if (v >= stops[stops.length - 1].v) return stops[stops.length - 1].col;
    for (let k = 0; k < stops.length - 1; k++) {
      const a = stops[k], b = stops[k + 1];
      if (v < b.v) {
        const f = a.v > 0 ? Math.log(v / a.v) / Math.log(b.v / a.v) : (v - a.v) / (b.v - a.v);
        return [a.col[0] + (b.col[0] - a.col[0]) * f, a.col[1] + (b.col[1] - a.col[1]) * f, a.col[2] + (b.col[2] - a.col[2]) * f];
      }
    }
    return null;
  }
  function paintContinuous(canvas, w, h, values, classes, alpha, mask) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const stops = continuousStops(classes);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const px = img.data;
    for (let i = 0; i < w * h; i++) {
      if (mask && !mask(i)) continue;
      const col = continuousColor(stops, values[i]);
      if (!col) continue;
      px[i * 4] = col[0]; px[i * 4 + 1] = col[1]; px[i * 4 + 2] = col[2]; px[i * 4 + 3] = alpha;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
  /** Lejant için CSS gradyanı */
  function gradientCss(classes) {
    const st = continuousStops(classes), lo = Math.log(st[0].v || 1e-3), hi = Math.log(st[st.length - 1].v);
    return 'linear-gradient(90deg,' + st.map((s) => `rgb(${s.col.join(',')}) ${(((Math.log(s.v || 1e-3) - lo) / (hi - lo)) * 100).toFixed(1)}%`).join(',') + ')';
  }

  /** Tek renkli maske boyama (Uint8 / Int32 dizisi, değer>0 olan hücreler). */
  function paintMask(canvas, w, h, arr, color, alpha, pick) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const px = img.data;
    for (let i = 0; i < w * h; i++) {
      if (!(pick ? pick(arr[i]) : arr[i] > 0)) continue;
      px[i * 4] = color[0]; px[i * 4 + 1] = color[1]; px[i * 4 + 2] = color[2]; px[i * 4 + 3] = alpha;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /** WGS84 → ızgara (sütun, satır) kesirli koordinat; hücre merkezi c+0.5. */
  function lonLatToGrid(t, lon, lat) {
    const [x, y] = SLS.proj.converter(t.epsg).forward([lon, lat]);
    return [(x - t.originX) / t.cellSize, (t.originY - y) / t.cellSize];
  }

  function cellAt(t, lon, lat) {
    const [gx, gy] = lonLatToGrid(t, lon, lat);
    const c = Math.floor(gx), r = Math.floor(gy);
    if (c < 0 || r < 0 || c >= t.width || r >= t.height) return -1;
    return r * t.width + c;
  }

  /** WGS84 halkasını ızgaraya rasterleştirir; merkezi poligon içindeki hücreler için fn(i). */
  function rasterizePolygon(t, ring, fn) {
    const pts = ring.map((p) => lonLatToGrid(t, p[0], p[1]));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const r0 = Math.max(0, Math.floor(minY)), r1 = Math.min(t.height - 1, Math.ceil(maxY));
    const n = pts.length;
    for (let r = r0; r <= r1; r++) {
      const yc = r + 0.5;
      // Tarama çizgisi kesişimleri
      const xs = [];
      for (let k = 0, j = n - 1; k < n; j = k++) {
        const [xi, yi] = pts[k], [xj, yj] = pts[j];
        if ((yi > yc) !== (yj > yc)) xs.push(xi + (yc - yi) * (xj - xi) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const ca = Math.max(0, Math.ceil(xs[k] - 0.5)), cb = Math.min(t.width - 1, Math.floor(xs[k + 1] - 0.5));
        for (let c = ca; c <= cb; c++) fn(r * t.width + c);
      }
    }
  }

  /** 4-komşulu bağlı bileşen etiketleme. labels: 0 = yok, 1..n. */
  function components(w, h, isOn) {
    const labels = new Int32Array(w * h);
    const sizes = [0];
    const stack = new Int32Array(w * h);
    let n = 0;
    for (let i = 0; i < w * h; i++) {
      if (labels[i] || !isOn(i)) continue;
      n++;
      let sp = 0, size = 0;
      stack[sp++] = i; labels[i] = n;
      while (sp) {
        const j = stack[--sp]; size++;
        const r = (j / w) | 0, c = j - r * w;
        if (c > 0 && !labels[j - 1] && isOn(j - 1)) { labels[j - 1] = n; stack[sp++] = j - 1; }
        if (c < w - 1 && !labels[j + 1] && isOn(j + 1)) { labels[j + 1] = n; stack[sp++] = j + 1; }
        if (r > 0 && !labels[j - w] && isOn(j - w)) { labels[j - w] = n; stack[sp++] = j - w; }
        if (r < h - 1 && !labels[j + w] && isOn(j + w)) { labels[j + w] = n; stack[sp++] = j + w; }
      }
      sizes.push(size);
    }
    return { labels, sizes, count: n };
  }

  SLS.raster = { RAMPS, classColor, paint, paintContinuous, continuousStops, continuousColor, gradientCss, paintMask, lonLatToGrid, cellAt, rasterizePolygon, components };
})(window.SLS = window.SLS || {});
