/* SLS Pro — GeoTIFF yazıcısı (bağımlılıksız)
 * Tek bant, sıkıştırmasız, şerit (strip) düzenli; Float32 veya Uint8.
 * Coğrafi anahtarlar: GTModelType, GTRasterType (PixelIsArea), ProjectedCSType / GeographicType (EPSG).
 * GDAL_NODATA etiketi yazılır; QGIS / GDAL tarafından doğrudan okunur.
 */
(function (SLS) {
  'use strict';

  const SHORT = 3, LONG = 4, DOUBLE = 12, ASCII = 2;

  /**
   * t = { width, height, cellSize, originX, originY (sol-üst köşe), epsg }
   * data: Float32Array (NaN → nodata) veya Uint8Array; opts: { nodata = -9999 (Float32) / 0 (Uint8) }
   */
  function write(t, data, opts) {
    const W = t.width, H = t.height, isU8 = data instanceof Uint8Array;
    const bps = isU8 ? 1 : 4, nodata = opts && opts.nodata != null ? opts.nodata : (isU8 ? 0 : -9999);
    const rowsPerStrip = Math.max(1, Math.floor(65536 / (W * bps)));
    const nStrips = Math.ceil(H / rowsPerStrip);
    const geographic = Number(t.epsg) === 4326;
    const geokeys = [1, 1, 0, 3,
      1024, 0, 1, geographic ? 2 : 1,
      1025, 0, 1, 1,
      geographic ? 2048 : 3072, 0, 1, Number(t.epsg)];
    const nodataStr = (isU8 ? String(nodata) : String(nodata)) + '\0';

    // Etiketler (artan sırada)
    const tags = [
      [256, LONG, [W]], [257, LONG, [H]], [258, SHORT, [bps * 8]], [259, SHORT, [1]], [262, SHORT, [1]],
      [273, LONG, new Array(nStrips).fill(0)], [277, SHORT, [1]], [278, LONG, [rowsPerStrip]],
      [279, LONG, Array.from({ length: nStrips }, (_, k) => Math.min(rowsPerStrip, H - k * rowsPerStrip) * W * bps)],
      [284, SHORT, [1]], [339, SHORT, [isU8 ? 1 : 3]],
      [33550, DOUBLE, [t.cellSize, t.cellSize, 0]],
      [33922, DOUBLE, [0, 0, 0, t.originX, t.originY, 0]],
      [34735, SHORT, geokeys],
      [42113, ASCII, nodataStr],
    ];
    const size = { [SHORT]: 2, [LONG]: 4, [DOUBLE]: 8, [ASCII]: 1 };
    const ifdOff = 8, ifdLen = 2 + 12 * tags.length + 4;
    // Ek veri alanı (4 bayttan büyük değerler)
    let extra = 0;
    const extraOff = [];
    for (const [, type, vals] of tags) {
      const len = (type === ASCII ? vals.length : vals.length) * size[type];
      if (len > 4) { extraOff.push(extra); extra += len + (len & 1); } else extraOff.push(-1);
    }
    const dataOff = ifdOff + ifdLen + extra;
    const total = dataOff + W * H * bps;
    const buf = new ArrayBuffer(total), dv = new DataView(buf), u8 = new Uint8Array(buf);
    u8[0] = 0x49; u8[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, ifdOff, true);
    // Şerit ofsetleri
    tags[5][2] = Array.from({ length: nStrips }, (_, k) => dataOff + k * rowsPerStrip * W * bps);
    dv.setUint16(ifdOff, tags.length, true);
    tags.forEach(([tag, type, vals], k) => {
      const e = ifdOff + 2 + 12 * k;
      const count = type === ASCII ? vals.length : vals.length;
      dv.setUint16(e, tag, true); dv.setUint16(e + 2, type, true); dv.setUint32(e + 4, count, true);
      const at = extraOff[k] >= 0 ? ifdOff + ifdLen + extraOff[k] : e + 8;
      if (extraOff[k] >= 0) dv.setUint32(e + 8, at, true);
      for (let j = 0; j < count; j++) {
        if (type === SHORT) dv.setUint16(at + 2 * j, vals[j], true);
        else if (type === LONG) dv.setUint32(at + 4 * j, vals[j], true);
        else if (type === DOUBLE) dv.setFloat64(at + 8 * j, vals[j], true);
        else u8[at + j] = vals.charCodeAt(j) & 0xff;
      }
    });
    dv.setUint32(ifdOff + 2 + 12 * tags.length, 0, true);
    // Pikseller (satır-öncelikli, kuzeyden güneye)
    if (isU8) u8.set(data, dataOff);
    else {
      for (let i = 0; i < W * H; i++) {
        const v = data[i];
        dv.setFloat32(dataOff + 4 * i, Number.isFinite(v) ? v : nodata, true);
      }
    }
    return new Blob([buf], { type: 'image/tiff' });
  }

  SLS.geotiffWriter = { write };
})(window.SLS = window.SLS || {});
