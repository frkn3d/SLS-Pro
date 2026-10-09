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

  SLS.raster = { RAMPS, classColor, paint, paintMask, lonLatToGrid, cellAt, rasterizePolygon, components };
})(window.SLS = window.SLS || {});
