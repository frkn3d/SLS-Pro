/* SLS Pro — Harita görünümü (MapLibre GL, BSD-3)
 * Altlıklar yalnızca açık lisanslı kaynaklardan gelir:
 *  - OpenTopoMap (CC-BY-SA, OSM verisi ODbL)
 *  - Sentinel-2 cloudless 2016, EOX (CC BY 4.0)
 *  - AWS Terrain Tiles (Terrarium) gölgeli kabartma ve 3B arazi
 */
(function (SLS) {
  'use strict';

  const ATTR_OTM = 'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, SRTM | Style © <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a> (CC-BY-SA)';
  const ATTR_S2 = '<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless 2016</a> by EOX IT Services GmbH (CC BY 4.0, contains modified Copernicus Sentinel data 2016)';
  const ATTR_DEM = '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">Terrain Tiles</a> (Mapzen/Tilezen, AWS Open Data)';

  const EMPTY = { type: 'FeatureCollection', features: [] };

  function bboxPolygon(b) {
    return {
      type: 'Feature', properties: {},
      geometry: { type: 'Polygon', coordinates: [[[b.west, b.south], [b.east, b.south], [b.east, b.north], [b.west, b.north], [b.west, b.south]]] },
    };
  }

  class MapView {
    constructor(container, opts) {
      this.opts = opts || {};
      this.map = new maplibregl.Map({
        container,
        center: [41.25, 39.86], // Palandöken, Erzurum
        zoom: 11.5,
        maxPitch: 75,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            topo: { type: 'raster', tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`), tileSize: 256, maxzoom: 17, attribution: ATTR_OTM },
            sat: { type: 'raster', tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'], tileSize: 256, maxzoom: 15, attribution: ATTR_S2 },
            demHs: { type: 'raster-dem', tiles: [SLS.sources.TERRARIUM_URL], encoding: 'terrarium', tileSize: 256, maxzoom: 15, attribution: ATTR_DEM },
            dem3d: { type: 'raster-dem', tiles: [SLS.sources.TERRARIUM_URL], encoding: 'terrarium', tileSize: 256, maxzoom: 15 },
            aoi: { type: 'geojson', data: EMPTY },
            extent: { type: 'geojson', data: EMPTY },
            polys: { type: 'geojson', data: EMPTY },
            fpolys: { type: 'geojson', data: EMPTY },
            obs: { type: 'geojson', data: EMPTY },
            draft: { type: 'geojson', data: EMPTY },
            path: { type: 'geojson', data: EMPTY },
            probe: { type: 'geojson', data: EMPTY },
            assets: { type: 'geojson', data: EMPTY },
          },
          layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': '#0b0f14' } },
            { id: 'topo', type: 'raster', source: 'topo', paint: { 'raster-saturation': -0.35, 'raster-brightness-max': 0.92 } },
            { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } },
            { id: 'hillshade', type: 'hillshade', source: 'demHs', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#0b1520', 'hillshade-highlight-color': '#ffffff' } },
            { id: 'aoi-fill', type: 'fill', source: 'aoi', paint: { 'fill-color': '#5cc8ff', 'fill-opacity': 0.08 } },
            { id: 'aoi-line', type: 'line', source: 'aoi', paint: { 'line-color': '#5cc8ff', 'line-width': 2, 'line-dasharray': [2, 1.5] } },
            { id: 'extent-line', type: 'line', source: 'extent', paint: { 'line-color': '#dff3ff', 'line-width': 1.5 } },
            { id: 'polys-line', type: 'line', source: 'polys', paint: { 'line-color': '#22d3ee', 'line-width': 2 } },
            { id: 'fpolys-fill', type: 'fill', source: 'fpolys', paint: { 'fill-color': '#16803d', 'fill-opacity': 0.25 } },
            { id: 'fpolys-line', type: 'line', source: 'fpolys', paint: { 'line-color': '#4ade80', 'line-width': 2, 'line-dasharray': [2, 1] } },
            { id: 'draft-line', type: 'line', source: 'draft', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#22d3ee', 'line-width': 2, 'line-dasharray': [1.5, 1] } },
            { id: 'path-halo', type: 'line', source: 'path', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.9 } },
            { id: 'path-line', type: 'line', source: 'path', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#111827', 'line-width': 2.2 } },
            { id: 'obs-halo', type: 'line', source: 'obs', paint: { 'line-color': '#ffffff', 'line-width': 4.5, 'line-opacity': 0.85 } },
            { id: 'obs-line', type: 'line', source: 'obs', paint: { 'line-color': '#c026d3', 'line-width': 2.2, 'line-dasharray': [2.5, 1.5] } },
            { id: 'assets-fill', type: 'fill', source: 'assets', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 } },
            { id: 'assets-line', type: 'line', source: 'assets', filter: ['!=', '$type', 'Point'], paint: { 'line-color': ['get', 'color'], 'line-width': 3 } },
            { id: 'assets-pt', type: 'circle', source: 'assets', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#0b0f14', 'circle-stroke-width': 2 } },
            { id: 'probe-pt', type: 'circle', source: 'probe', paint: { 'circle-radius': 6, 'circle-color': '#5cc8ff', 'circle-stroke-color': '#0b0f14', 'circle-stroke-width': 2 } },
            { id: 'draft-pts', type: 'circle', source: 'draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 4, 'circle-color': '#0b0f14', 'circle-stroke-color': '#22d3ee', 'circle-stroke-width': 2 } },
          ],
        },
      });
      this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      this.map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
      this.ready = new Promise((res) => this.map.on('load', res));
      window.__slsMap = this.map; // hata ayıklama / otomasyon
      this._initDraw();
    }

    // ---- Katmanlar ----
    setBasemap(id) {
      this.map.setLayoutProperty('topo', 'visibility', id === 'topo' ? 'visible' : 'none');
      this.map.setLayoutProperty('sat', 'visibility', id === 'sat' ? 'visible' : 'none');
    }
    setHillshade(on) { this.map.setLayoutProperty('hillshade', 'visibility', on ? 'visible' : 'none'); }
    set3D(on) {
      if (on) {
        this.map.setTerrain({ source: 'dem3d', exaggeration: 1.2 });
        this.map.easeTo({ pitch: 62, duration: 900 });
      } else {
        this.map.setTerrain(null);
        this.map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      }
    }

    setAoi(b) { this.map.getSource('aoi').setData(b ? bboxPolygon(b) : EMPTY); }

    // ---- Raster bindirmeleri (arazi ızgarası üzerine) ----
    // Sıra (alttan üste): slope, pra, release, result, sim
    _beforeId(id) {
      const order = ['slope', 'tclass', 'forest', 'pra', 'release', 'result', 'sim', 'simPowder'];
      for (let k = order.indexOf(id) + 1; k < order.length; k++) if (this.map.getLayer(order[k])) return order[k];
      return 'aoi-fill';
    }

    /** Kanvas tabanlı bindirme; kanvas her güncellendiğinde refreshOverlay(id) çağrılır. */
    setOverlay(id, canvas, corners, opacity) {
      this.removeOverlay(id);
      this.map.addSource(id, { type: 'canvas', canvas, coordinates: corners, animate: false });
      this.map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opacity ?? 0.75, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } }, this._beforeId(id));
    }
    refreshOverlay(id) {
      const src = this.map.getSource(id);
      if (!src) return;
      src.play(); // dokuyu yeniden yükle
      this.map.triggerRepaint();
      clearTimeout(this['_rf' + id]);
      this['_rf' + id] = setTimeout(() => { const s = this.map.getSource(id); if (s) s.pause(); }, 150);
    }
    removeOverlay(id) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
      if (this.map.getSource(id)) this.map.removeSource(id);
    }
    setOverlayVisible(id, on) { if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); }
    setOverlayResampling(id, mode) { if (this.map.getLayer(id)) this.map.setPaintProperty(id, 'raster-resampling', mode); }
    setForestPolygons(rings) {
      this.map.getSource('fpolys').setData({
        type: 'FeatureCollection',
        features: (rings || []).map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...r, r[0]]] } })),
      });
    }
    /** Gözlenen çığ sınırı (doğrulama) */
    setObserved(rings) {
      this.map.getSource('obs').setData({
        type: 'FeatureCollection',
        features: (rings || []).map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...r, r[0]]] } })),
      });
    }
    setForestPolygonsVisible(on) { for (const id of ['fpolys-fill', 'fpolys-line']) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); }
    setOverlayOpacity(id, v) { if (this.map.getLayer(id)) this.map.setPaintProperty(id, 'raster-opacity', v); }

    setExtent(corners) {
      this.map.getSource('extent').setData(corners ? {
        type: 'Feature', properties: {},
        geometry: { type: 'Polygon', coordinates: [[...corners, corners[0]]] },
      } : EMPTY);
    }

    setPath(coords) {
      this.map.getSource('path').setData(coords && coords.length > 1
        ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } : EMPTY);
    }
    setPathVisible(on) {
      for (const id of ['path-halo', 'path-line']) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
    /** KML unsurları; her özellik { type, coords, name, color } */
    setAssets(feats) {
      const geom = (f) => (f.type === 'Point' ? { type: 'Point', coordinates: f.coords }
        : f.type === 'LineString' ? { type: 'LineString', coordinates: f.coords }
          : { type: 'Polygon', coordinates: [[...f.coords, f.coords[0]]] });
      this.map.getSource('assets').setData({
        type: 'FeatureCollection',
        features: (feats || []).map((f) => ({ type: 'Feature', properties: { name: f.name, color: f.color || '#e6edf3' }, geometry: geom(f) })),
      });
    }
    setProbe(ll) {
      this.map.getSource('probe').setData(ll ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: ll } } : EMPTY);
    }

    setPolygons(rings) {
      this.map.getSource('polys').setData({
        type: 'FeatureCollection',
        features: rings.map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...r, r[0]]] } })),
      });
    }

    fitBbox(b) { this.map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 60, duration: 900, maxZoom: 15 }); }
    flyTo(lon, lat) { this.map.flyTo({ center: [lon, lat], zoom: 13, duration: 1200 }); }

    // ---- Dikdörtgen çizimi ----
    _initDraw() {
      const m = this.map;
      let start = null;
      const toBbox = (a, b) => ({
        west: Math.min(a.lng, b.lng), east: Math.max(a.lng, b.lng),
        south: Math.min(a.lat, b.lat), north: Math.max(a.lat, b.lat),
      });
      const down = (e) => {
        if (!this._drawCb) return;
        e.preventDefault();
        start = e.lngLat;
      };
      const move = (e) => {
        if (this.opts.onPointer) this.opts.onPointer(e.lngLat);
        if (!this._drawCb || !start) return;
        this.setAoi(toBbox(start, e.lngLat));
      };
      const up = (e) => {
        if (!this._drawCb || !start) return;
        const b = toBbox(start, e.lngLat);
        start = null;
        const cb = this._drawCb;
        this.stopDraw();
        if (b.east - b.west > 1e-5 && b.north - b.south > 1e-5) cb(b); else cb(null);
      };
      m.on('click', (e) => {
        if (this._poly) { this._polyClick(e); return; }
        if (!this._drawCb && this.opts.onClick) this.opts.onClick(e.lngLat);
      });
      m.on('dblclick', (e) => { if (this._poly) { e.preventDefault(); this.finishPolygon(); } });
      m.on('mousemove', (e) => { if (this._poly) this._polyPreview(e.lngLat); });
      this._onKey = (e) => {
        if (!this._poly) return;
        if (e.key === 'Escape') this.cancelPolygon();
        if (e.key === 'Enter') this.finishPolygon();
      };
      document.addEventListener('keydown', this._onKey);
      m.on('mousedown', down); m.on('touchstart', down);
      m.on('mousemove', move); m.on('touchmove', move);
      m.on('mouseup', up); m.on('touchend', up);
    }
    startDraw(cb) {
      this._drawCb = cb;
      this.map.dragPan.disable();
      this.map.dragRotate.disable();
      this.map.touchZoomRotate.disable();
    }
    stopDraw() {
      this._drawCb = null;
      this.map.dragPan.enable();
      this.map.dragRotate.enable();
      this.map.touchZoomRotate.enable();
      if (this.opts.onDrawEnd) this.opts.onDrawEnd();
    }
    // ---- Poligon çizimi: tıklayarak köşe ekle; çift tık, Enter ya da ilk köşeye tıklayarak bitir ----
    startPolygon(cb) {
      this.cancelPolygon();
      this._poly = { pts: [], cb };
      this.map.doubleClickZoom.disable();
      this.map.getCanvas().style.cursor = 'crosshair';
    }
    _polyClick(e) {
      const pts = this._poly.pts;
      const px = this.map.project(e.lngLat);
      if (pts.length) {
        const last = this.map.project(pts[pts.length - 1]);
        if (Math.hypot(px.x - last.x, px.y - last.y) < 4) return; // çift tık tekrarları
      }
      if (pts.length >= 3) {
        const first = this.map.project(pts[0]);
        if (Math.hypot(px.x - first.x, px.y - first.y) < 10) { this.finishPolygon(); return; }
      }
      pts.push([e.lngLat.lng, e.lngLat.lat]);
      this._polyPreview(null);
    }
    _polyPreview(ll) {
      const pts = this._poly.pts.slice();
      if (ll) pts.push([ll.lng, ll.lat]);
      const fs = this._poly.pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }));
      if (pts.length >= 2) fs.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.length >= 3 ? [...pts, pts[0]] : pts } });
      this.map.getSource('draft').setData({ type: 'FeatureCollection', features: fs });
    }
    finishPolygon() {
      const P = this._poly;
      if (!P) return;
      this._endPolygon();
      P.cb(P.pts.length >= 3 ? P.pts : null);
    }
    cancelPolygon() {
      const P = this._poly;
      if (!P) return;
      this._endPolygon();
      P.cb(null);
    }
    _endPolygon() {
      this._poly = null;
      this.map.getSource('draft').setData(EMPTY);
      this.map.getCanvas().style.cursor = '';
      setTimeout(() => this.map.doubleClickZoom.enable(), 300);
    }
    get drawingPolygon() { return !!this._poly; }

    resize() { this.map.resize(); }
    destroy() { document.removeEventListener('keydown', this._onKey); this.map.remove(); }
  }

  SLS.MapView = MapView;
})(window.SLS = window.SLS || {});
