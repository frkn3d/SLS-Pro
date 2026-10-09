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
          },
          layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': '#0b0f14' } },
            { id: 'topo', type: 'raster', source: 'topo', paint: { 'raster-saturation': -0.35, 'raster-brightness-max': 0.92 } },
            { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } },
            { id: 'hillshade', type: 'hillshade', source: 'demHs', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#0b1520', 'hillshade-highlight-color': '#ffffff' } },
            { id: 'aoi-fill', type: 'fill', source: 'aoi', paint: { 'fill-color': '#5cc8ff', 'fill-opacity': 0.08 } },
            { id: 'aoi-line', type: 'line', source: 'aoi', paint: { 'line-color': '#5cc8ff', 'line-width': 2, 'line-dasharray': [2, 1.5] } },
            { id: 'extent-line', type: 'line', source: 'extent', paint: { 'line-color': '#dff3ff', 'line-width': 1.5 } },
          ],
        },
      });
      this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      this.map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
      this.ready = new Promise((res) => this.map.on('load', res));
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

    /** Arazi ızgarası bindirmesi (eğim sınıfları) + ızgara sınırı. */
    setTerrainOverlay(dataUrl, corners) {
      this.clearTerrainOverlay();
      this.map.addSource('slope', { type: 'image', url: dataUrl, coordinates: corners });
      this.map.addLayer({ id: 'slope', type: 'raster', source: 'slope', paint: { 'raster-opacity': 0.72, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } }, 'aoi-fill');
      this.map.getSource('extent').setData({
        type: 'Feature', properties: {},
        geometry: { type: 'Polygon', coordinates: [[...corners, corners[0]]] },
      });
    }
    clearTerrainOverlay() {
      if (this.map.getLayer('slope')) this.map.removeLayer('slope');
      if (this.map.getSource('slope')) this.map.removeSource('slope');
      this.map.getSource('extent') && this.map.getSource('extent').setData(EMPTY);
    }
    setSlopeVisible(on) { if (this.map.getLayer('slope')) this.map.setLayoutProperty('slope', 'visibility', on ? 'visible' : 'none'); }

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
    resize() { this.map.resize(); }
    destroy() { this.map.remove(); }
  }

  SLS.MapView = MapView;
})(window.SLS = window.SLS || {});
