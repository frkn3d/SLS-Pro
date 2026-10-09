/* SLS Pro — KML / KMZ içe ve dışa aktarım
 * KMZ (zip) için fflate (MIT) yalnızca gerektiğinde yüklenir.
 */
(function (SLS) {
  'use strict';

  const FFLATE_URL = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js';
  let fflateP = null;
  function fflate() {
    if (window.fflate) return Promise.resolve(window.fflate);
    if (!fflateP) {
      fflateP = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = FFLATE_URL; s.onload = () => res(window.fflate); s.onerror = () => { fflateP = null; rej(new Error('fflate')); };
        document.head.appendChild(s);
      });
    }
    return fflateP;
  }

  // ---------------------------------------------------------------------------
  // İçe aktarım
  function parseCoords(text) {
    return String(text || '').trim().split(/\s+/).map((t) => t.split(',').map(Number))
      .filter((a) => a.length >= 2 && Number.isFinite(a[0]) && Number.isFinite(a[1]))
      .map((a) => [a[0], a[1]]);
  }
  const child = (el, name) => { for (const c of el.children) if (c.localName === name) return c; return null; };
  const desc = (el, name) => el.getElementsByTagNameNS('*', name);

  function geometries(el, out) {
    for (const g of el.children) {
      const n = g.localName;
      if (n === 'Point') { const c = parseCoords(child(g, 'coordinates')?.textContent); if (c.length) out.push({ type: 'Point', coords: c[0] }); }
      else if (n === 'LineString') { const c = parseCoords(child(g, 'coordinates')?.textContent); if (c.length > 1) out.push({ type: 'LineString', coords: c }); }
      else if (n === 'Polygon') {
        const ob = child(g, 'outerBoundaryIs'), ring = ob && child(ob, 'LinearRing');
        const c = ring ? parseCoords(child(ring, 'coordinates')?.textContent) : [];
        if (c.length >= 3) {
          if (c.length > 3 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1]) c.pop();
          out.push({ type: 'Polygon', coords: c });
        }
      } else if (n === 'MultiGeometry') geometries(g, out);
    }
  }

  /** KML metninden özellik listesi: [{type, coords, name, description}] */
  function parseKml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('kml-parse');
    const feats = [];
    for (const pm of desc(doc, 'Placemark')) {
      const name = child(pm, 'name')?.textContent?.trim() || '';
      const description = child(pm, 'description')?.textContent?.trim() || '';
      const gs = [];
      geometries(pm, gs);
      gs.forEach((g, k) => feats.push(Object.assign(g, { name: gs.length > 1 ? `${name} (${k + 1})` : name, description })));
    }
    return feats;
  }

  async function readFile(file) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.kmz')) {
      const ff = await fflate();
      const files = ff.unzipSync(new Uint8Array(await file.arrayBuffer()));
      const names = Object.keys(files).filter((n) => n.toLowerCase().endsWith('.kml'));
      if (!names.length) throw new Error('kmz-empty');
      const main = names.find((n) => /(^|\/)doc\.kml$/i.test(n)) || names[0];
      return parseKml(new TextDecoder().decode(files[main]));
    }
    return parseKml(await file.text());
  }

  function bboxOf(feats) {
    let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
    for (const f of feats) {
      const pts = f.type === 'Point' ? [f.coords] : f.coords;
      for (const [x, y] of pts) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
    }
    return Number.isFinite(w) ? { west: w, east: e, south: s, north: n } : null;
  }

  // ---------------------------------------------------------------------------
  // Dışa aktarım
  const x = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  /** [r,g,b] + alfa (0–255) → KML aabbggrr */
  function kmlColor(rgb, a) {
    const h = (v) => Math.round(v).toString(16).padStart(2, '0');
    return h(a ?? 255) + h(rgb[2]) + h(rgb[1]) + h(rgb[0]);
  }
  const ring = (pts) => [...pts, pts[0]].map((p) => `${p[0].toFixed(7)},${p[1].toFixed(7)},0`).join(' ');

  function polygon(name, pts, rgb, descr) {
    return `<Placemark><name>${x(name)}</name>${descr ? `<description>${x(descr)}</description>` : ''}
      <Style><LineStyle><color>${kmlColor(rgb)}</color><width>2</width></LineStyle><PolyStyle><color>${kmlColor(rgb, 70)}</color></PolyStyle></Style>
      <Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>${ring(pts)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
  }
  function line(name, pts, rgb, width) {
    return `<Placemark><name>${x(name)}</name><Style><LineStyle><color>${kmlColor(rgb)}</color><width>${width || 3}</width></LineStyle></Style>
      <LineString><tessellate>1</tessellate><coordinates>${pts.map((p) => `${p[0].toFixed(7)},${p[1].toFixed(7)},0`).join(' ')}</coordinates></LineString></Placemark>`;
  }
  function point(name, p, rgb, descr) {
    return `<Placemark><name>${x(name)}</name>${descr ? `<description>${x(descr)}</description>` : ''}
      <Style><IconStyle><color>${kmlColor(rgb)}</color><scale>0.9</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>
      <Point><coordinates>${p[0].toFixed(7)},${p[1].toFixed(7)},0</coordinates></Point></Placemark>`;
  }
  /** Köşeler [TL, TR, BR, BL] (WGS84) — gx:LatLonQuad döndürülmüş ızgaraya tam oturur */
  function groundOverlay(name, href, corners, visible) {
    const [tl, tr, br, bl] = corners;
    const q = [bl, br, tr, tl].map((p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`).join(' ');
    return `<GroundOverlay><name>${x(name)}</name><visibility>${visible ? 1 : 0}</visibility><Icon><href>${x(href)}</href></Icon>
      <gx:LatLonQuad><coordinates>${q}</coordinates></gx:LatLonQuad></GroundOverlay>`;
  }
  function folder(name, items, open) {
    return `<Folder><name>${x(name)}</name><open>${open ? 1 : 0}</open>${items.join('\n')}</Folder>`;
  }
  function kmlDocument(name, body, descr) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document><name>${x(name)}</name>${descr ? `<description>${x(descr)}</description>` : ''}
${body}
</Document></kml>`;
  }

  async function canvasPng(canvas) {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  /** files: { 'doc.kml': string, 'img/x.png': Uint8Array } → KMZ Blob */
  async function zipKmz(files) {
    const ff = await fflate();
    const entries = {};
    for (const [k, v] of Object.entries(files)) entries[k] = typeof v === 'string' ? ff.strToU8(v) : [v, { level: 0 }];
    return new Blob([ff.zipSync(entries, { level: 6 })], { type: 'application/vnd.google-earth.kmz' });
  }

  SLS.kml = { parseKml, readFile, bboxOf, kmlColor, polygon, line, point, groundOverlay, folder, kmlDocument, canvasPng, zipKmz };
})(window.SLS = window.SLS || {});
