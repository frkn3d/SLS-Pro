/* SLS Pro — Çığ sonuçlarının dışa aktarımı: ESRI ASCII Grid, özet JSON, KMZ (Google Earth) */
(function (SLS) {
  'use strict';

  const t = (k, v) => SLS.i18n.t(k, v);
  const n = (v, d) => SLS.i18n.number(v, d);

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  }

  /** Raster → ASC (+ .prj). */
  function asc(terrain, data, name) {
    SLS.terrain.exportAsc(Object.assign({}, terrain, { data }), name);
  }

  function zoneRaster(codes) {
    const out = new Float32Array(codes.length);
    for (let i = 0; i < codes.length; i++) out[i] = codes[i] ? codes[i] : NaN;
    return out;
  }

  function summaryJson(ctx) {
    const tr = ctx.terrain, meta = SLS.terrain.metadata(tr, ctx.terrainStats);
    const runs = {};
    for (const [k, r] of Object.entries(ctx.runs)) {
      const A = r.analysis;
      runs[k] = {
        return_period_years: r.scenario.T, fracture_depth_m: r.scenario.d0,
        parameters: r.params,
        release: { area_m2: r.release.area, volume_m3: r.release.volume, depth_range_m: [r.release.dmin, r.release.dmax] },
        results: {
          max_velocity_ms: A.vmax, max_pressure_kpa: A.pmax, max_flow_height_m: A.hmax,
          runout_m: A.runout, drop_m: A.drop, alpha_deg: A.alpha, affected_ha: A.affectedHa,
          entrained_m3: A.entrained, deposit_m3: A.deposit, outflow_m3: A.outflow, outflow_share: A.outflowShare,
          powder: A.powder ? { peak_pressure_kpa: A.powderPmax, area_ge_0_5kpa_ha: A.powderHa, mass_t: A.powder.source / 1000 } : null,
          mass_error: A.massErr, simulated_time_s: A.t, stop_reason: A.reason, complete: A.complete,
        },
      };
    }
    const sum = {
      format: 'sls-avalanche-result', version: 2, generator: 'SLS Pro ' + SLS.VERSION, created: new Date().toISOString(),
      model: 'Voellmy-Salm depth-averaged dense flow, first-order finite volume (HLL)' + (ctx.options.entrain ? ' + velocity-proportional entrainment' : '') + (ctx.options.powder ? ' + experimental powder-cloud layer' : ''),
      analysis_type: ctx.mode, snow_type: ctx.snowType, complete: ctx.complete, domain_expansions: ctx.expansions,
      grid: { origin_x: meta.origin_x, origin_y: meta.origin_y, cell_size: meta.cell_size, width: meta.width, height: meta.height, epsg: meta.epsg, crs_name: meta.crs_name },
      terrain_source: tr.source, attribution: tr.attribution,
      options: ctx.options, field_profile: ctx.fieldProfile || null,
      zoning: ctx.zoning ? SLS.avAnalysis.zoneAreas(ctx.zoning, tr.cellSize) : null,
      runs,
      assets: (ctx.assetRisk || []).map((a) => ({ name: a.name, type: a.type, zone: a.zone, pmax_kpa: a.pmax, hmax_m: a.hmax, vmax_ms: a.vmax, powder_kpa: a.powderP, affected_length_m: a.affectedLen, affected_area_m2: a.affectedArea })),
    };
    download(new Blob([JSON.stringify(sum, null, 2)], { type: 'application/json' }), ctx.baseName + '_summary.json');
  }

  // ---------------------------------------------------------------------------
  const ZONE_RGB = { 3: [220, 38, 38], 2: [37, 99, 235], 1: [250, 204, 21], 0: [148, 163, 184] };

  async function kmz(ctx) {
    const K = SLS.kml, tr = ctx.terrain, W = tr.width, H = tr.height, files = {};
    const overlay = async (key, values, ramp, mask) => {
      const cv = document.createElement('canvas');
      SLS.raster.paint(cv, W, H, values, SLS.raster.RAMPS[ramp].classes, 200, mask);
      files[`img/${key}.png`] = await K.canvasPng(cv);
      return `img/${key}.png`;
    };
    const pr = ctx.runs[ctx.primaryKey].result;
    const hOn = (r, th) => (i) => r.hmax[i] >= th;
    const parts = [];

    // Bölgeler
    if (ctx.zoning) {
      const href = await overlay('zones_matrix', ctx.zoning, 'matrix', (i) => ctx.zoning[i] > 0);
      parts.push(K.folder(t('kmz.zonesMatrix'), [K.groundOverlay(t('kmz.zonesMatrix'), href, ctx.corners, true)], true));
    } else {
      const href = await overlay('zones', pr.pmax, 'zones', hOn(pr, 0.1));
      parts.push(K.folder(t('res.zones'), [K.groundOverlay(t('res.zones'), href, ctx.corners, true)], true));
    }
    // Senaryo katmanları
    for (const [key, run] of Object.entries(ctx.runs)) {
      const r = run.result, lab = key === 'S' ? '' : ` (${key})`;
      const items = [
        K.groundOverlay('h_max (m)' + lab, await overlay(`${key}_hmax`, r.hmax, 'height', hOn(r, 0.05)), ctx.corners, false),
        K.groundOverlay('v_max (m/s)' + lab, await overlay(`${key}_vmax`, r.vmax, 'velocity', hOn(r, 0.05)), ctx.corners, false),
        K.groundOverlay('p_max (kPa)' + lab, await overlay(`${key}_pmax`, r.pmax, 'pressure', hOn(r, 0.05)), ctx.corners, false),
      ];
      if (r.powder) items.push(K.groundOverlay(t('res.powder') + lab, await overlay(`${key}_powder`, r.powder.pmax, 'powder', (i) => r.powder.pmax[i] >= 0.5), ctx.corners, false));
      if (r.eroded) items.push(K.groundOverlay(t('res.eroded') + lab, await overlay(`${key}_eroded`, r.eroded, 'erosion', (i) => r.eroded[i] >= 0.02), ctx.corners, false));
      parts.push(K.folder(key === 'S' ? t('kmz.results') : `${t('kmz.scenario')} ${key}`, items, false));
    }
    // Kopma alanı
    {
      const cv = document.createElement('canvas');
      SLS.raster.paintMask(cv, W, H, ctx.releaseMask, [34, 211, 238], 200);
      files['img/release.png'] = await K.canvasPng(cv);
      parts.push(K.folder(t('legend.release'), [K.groundOverlay(t('legend.release'), 'img/release.png', ctx.corners, true)], false));
    }
    // Akış yolu
    if (ctx.pathCoords && ctx.pathCoords.length > 1) parts.push(K.line(t('prof.title'), ctx.pathCoords, [17, 24, 39], 3));
    // Unsurlar
    if (ctx.assetRisk && ctx.assetRisk.length) {
      const zl = (z) => t(['zone.none', 'zone.yellowM', 'zone.blueM', 'zone.redM'][z]);
      const items = ctx.assetRisk.map((a) => {
        const d = `${zl(a.zone)} · p_max ${n(a.pmax)} kPa · h_max ${n(a.hmax, 1)} m · v_max ${n(a.vmax, 1)} m/s`;
        const f = a.feature, rgb = ZONE_RGB[a.zone];
        if (f.type === 'Point') return K.point(a.name, f.coords, rgb, d);
        if (f.type === 'LineString') return K.line(a.name, f.coords, rgb, 4);
        return K.polygon(a.name, f.coords, rgb, d);
      });
      parts.push(K.folder(t('assets.title'), items, true));
    }
    const descr = `SLS Pro ${SLS.VERSION} · ${new Date().toLocaleString()}${ctx.complete ? '' : ' · ' + t('kmz.incomplete')}`;
    files['doc.kml'] = K.kmlDocument(ctx.title, parts.join('\n'), descr);
    const blob = await K.zipKmz(files);
    download(blob, ctx.baseName + '.kmz');
    return blob;
  }

  // ---------------------------------------------------------------------------
  // GeoTIFF, GeoJSON ve QGIS paketi
  function geotiff(terrain, data, name) {
    download(SLS.geotiffWriter.write(terrain, data), name + '.tif');
  }

  const ZONE_LABEL = () => ({ 1: t('zone.yellowM'), 2: t('zone.blueM'), 3: t('zone.redM') });
  const ZONE_HEXC = { 1: '#facc15', 2: '#2563eb', 3: '#dc2626' };

  function zoneCodes(ctx) {
    if (ctx.zoning) return ctx.zoning;
    const r = ctx.runs[ctx.primaryKey].result, codes = new Uint8Array(r.pmax.length);
    for (let i = 0; i < codes.length; i++) codes[i] = SLS.avAnalysis.singleZone(r, i);
    return codes;
  }

  function zonesGeoJSON(ctx) {
    const lab = ZONE_LABEL();
    return SLS.vectorize.classesToGeoJSON(ctx.terrain, zoneCodes(ctx), [3, 2, 1].map((v) => ({
      value: v, props: { zone: v, label: lab[v], method: ctx.zoning ? 'T30+T300 intensity-probability matrix' : 'pressure criterion (3 / 30 kPa)', color: ZONE_HEXC[v] },
    })));
  }

  function rgbOf(hex) { const n = parseInt(hex.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }

  /** QGIS raster stili: paletli (sınıf kodları) */
  function qmlPalette(entries) {
    return `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis version="3.28.0" styleCategories="AllStyleCategories">
  <pipe>
    <rasterrenderer type="paletted" band="1" opacity="0.8" alphaBand="-1" nodataColor="">
      <colorPalette>
${entries.map((e) => `        <paletteEntry value="${e.value}" color="${e.color}" label="${e.label.replace(/[<>&"]/g, '')}" alpha="255"/>`).join('\n')}
      </colorPalette>
    </rasterrenderer>
  </pipe>
</qgis>`;
  }

  /** QGIS raster stili: sınıflı sözde renk (eşik değerleri = SLS renk sınıfları) */
  function qmlRamp(classes) {
    const items = classes.map((c) => `            <item alpha="255" value="${Number.isFinite(c.max) ? c.max : 1e9}" label="${c.min}${Number.isFinite(c.max) ? ' – ' + c.max : '+'}" color="#${c.color.map((x) => x.toString(16).padStart(2, '0')).join('')}"/>`);
    return `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis version="3.28.0" styleCategories="AllStyleCategories">
  <pipe>
    <rasterrenderer type="singlebandpseudocolor" band="1" opacity="0.8" alphaBand="-1" classificationMin="${classes[0].min}" classificationMax="${classes[classes.length - 1].min}">
      <rastershader>
        <colorrampshader colorRampType="DISCRETE" classificationMode="1" clip="0" minimumValue="${classes[0].min}" maximumValue="${classes[classes.length - 1].min}">
            <item alpha="0" value="${classes[0].min}" label="&lt; ${classes[0].min}" color="#ffffff"/>
${items.join('\n')}
        </colorrampshader>
      </rastershader>
    </rasterrenderer>
  </pipe>
</qgis>`;
  }

  /** QGIS vektör stili: bölge kodlarına göre kategorik dolgu */
  /** QGIS sembol katmanı: fill | line | marker */
  function qmlSymbolLayer(kind, color, alpha) {
    const c = rgbOf(color) + ',255';
    if (kind === 'line') return `<layer class="SimpleLine" enabled="1" locked="0" pass="0"><Option type="Map">
            <Option name="line_color" type="QString" value="${c}"/><Option name="line_width" type="QString" value="0.9"/><Option name="capstyle" type="QString" value="round"/><Option name="joinstyle" type="QString" value="round"/>
          </Option></layer>`;
    if (kind === 'marker') return `<layer class="SimpleMarker" enabled="1" locked="0" pass="0"><Option type="Map">
            <Option name="color" type="QString" value="${c}"/><Option name="outline_color" type="QString" value="11,15,20,255"/><Option name="outline_width" type="QString" value="0.4"/><Option name="size" type="QString" value="3"/><Option name="name" type="QString" value="circle"/>
          </Option></layer>`;
    return `<layer class="SimpleFill" enabled="1" locked="0" pass="0"><Option type="Map">
            <Option name="color" type="QString" value="${alpha === 0 ? rgbOf(color) + ',0' : c}"/><Option name="outline_color" type="QString" value="${c}"/><Option name="outline_width" type="QString" value="0.6"/><Option name="style" type="QString" value="${alpha === 0 ? 'no' : 'solid'}"/>
          </Option></layer>`;
  }
  const QML_HEAD = `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>\n<qgis version="3.28.0" styleCategories="Symbology">`;
  const symType = (kind) => (kind === 'marker' ? 'marker' : kind);

  /** QGIS vektör stili: bölge kodlarına göre kategorik (fill / line / marker) */
  function qmlZonesVector(kind = 'fill', zones = [3, 2, 1]) {
    const lab = Object.assign({ 0: t('zone.none') }, ZONE_LABEL()), col = Object.assign({ 0: '#94a3b8' }, ZONE_HEXC);
    const cats = zones.map((v, k) => `      <category value="${v}" label="${lab[v]}" symbol="${k}" render="true"/>`).join('\n');
    const syms = zones.map((v, k) => `      <symbol type="${symType(kind)}" name="${k}" alpha="${kind === 'fill' ? 0.55 : 1}" clip_to_extent="1" force_rhr="0">
        ${qmlSymbolLayer(kind, col[v])}
      </symbol>`).join('\n');
    return `${QML_HEAD}
  <renderer-v2 type="categorizedSymbol" attr="zone" symbollevels="0" enableorderby="0" forceraster="0">
    <categories>
${cats}
    </categories>
    <symbols>
${syms}
    </symbols>
  </renderer-v2>
</qgis>`;
  }

  /** QGIS vektör stili: tek sembol */
  function qmlSingle(kind, color, alpha) {
    return `${QML_HEAD}
  <renderer-v2 type="singleSymbol" symbollevels="0" enableorderby="0" forceraster="0">
    <symbols>
      <symbol type="${symType(kind)}" name="0" alpha="1" clip_to_extent="1" force_rhr="0">
        ${qmlSymbolLayer(kind, color, alpha)}
      </symbol>
    </symbols>
  </renderer-v2>
</qgis>`;
  }

  function releaseGeoJSON(ctx) {
    const codes = new Uint8Array(ctx.releaseMask.length);
    for (let i = 0; i < codes.length; i++) codes[i] = ctx.releaseMask[i] ? 1 : 0;
    return SLS.vectorize.classesToGeoJSON(ctx.terrain, codes, [{ value: 1, props: { name: 'release area' } }]);
  }

  function pathGeoJSON(ctx) {
    if (!ctx.pathCoords) return null;
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'flow path' }, geometry: { type: 'LineString', coordinates: ctx.pathCoords } }] };
  }

  function assetsGeoJSON(ctx) {
    if (!ctx.assetRisk || !ctx.assetRisk.length) return null;
    const geom = (f) => (f.type === 'Point' ? { type: 'Point', coordinates: f.coords }
      : f.type === 'LineString' ? { type: 'LineString', coordinates: f.coords } : { type: 'Polygon', coordinates: [[...f.coords, f.coords[0]]] });
    return { type: 'FeatureCollection', features: ctx.assetRisk.map((a) => ({ type: 'Feature', geometry: geom(a.feature),
      properties: { name: a.name, zone: a.zone, pmax_kpa: +a.pmax.toFixed(2), hmax_m: +a.hmax.toFixed(2), vmax_ms: +a.vmax.toFixed(2), powder_kpa: +a.powderP.toFixed(2), affected_len_m: a.affectedLen, affected_area_m2: a.affectedArea } })) };
  }

  /** Tüm sonuçlar: GeoTIFF + GeoJSON + QGIS stilleri + DEM, tek zip */
  async function qgisPackage(ctx) {
    const ff = await SLS.kml.fflate();
    const tr = ctx.terrain, files = {};
    const tif = async (name, data) => { files[name + '.tif'] = [new Uint8Array(await SLS.geotiffWriter.write(tr, data).arrayBuffer()), { level: 6 }]; };
    const txt = (name, s) => { files[name] = ff.strToU8(s); };
    const R = SLS.raster.RAMPS;
    await tif('dem', tr.data);
    for (const [key, run] of Object.entries(ctx.runs)) {
      const r = run.result, pre = key === 'S' ? '' : key + '_';
      await tif(pre + 'hmax_m', r.hmax); txt(pre + 'hmax_m.qml', qmlRamp(R.height.classes));
      await tif(pre + 'vmax_ms', r.vmax); txt(pre + 'vmax_ms.qml', qmlRamp(R.velocity.classes));
      await tif(pre + 'pmax_kpa', r.pmax); txt(pre + 'pmax_kpa.qml', qmlRamp(R.pressure.classes));
      await tif(pre + 'deposit_m', r.hfinal); txt(pre + 'deposit_m.qml', qmlRamp(R.height.classes));
      if (r.eroded) { await tif(pre + 'eroded_m', r.eroded); txt(pre + 'eroded_m.qml', qmlRamp(R.erosion.classes)); }
      if (r.powder) { await tif(pre + 'powder_pmax_kpa', r.powder.pmax); txt(pre + 'powder_pmax_kpa.qml', qmlRamp(R.powder.classes)); }
    }
    const codes = zoneCodes(ctx), lab = ZONE_LABEL();
    await tif('zones', codes);
    txt('zones.qml', qmlPalette([3, 2, 1].map((v) => ({ value: v, color: ZONE_HEXC[v], label: lab[v] }))));
    txt('zones.geojson', JSON.stringify(zonesGeoJSON(ctx)));
    txt('zones_poly.qml', qmlZonesVector());
    txt('release.geojson', JSON.stringify(releaseGeoJSON(ctx)));
    txt('release.qml', qmlSingle('fill', '#22d3ee', 0));
    const pg = pathGeoJSON(ctx); if (pg) { txt('flow_path.geojson', JSON.stringify(pg)); txt('flow_path.qml', qmlSingle('line', '#111827')); }
    const ag = assetsGeoJSON(ctx);
    if (ag) {
      // Karışık geometri: QGIS (eklenti) nokta / çizgi / alan alt katmanlarını ayrı stillerle yükler
      txt('assets_risk.geojson', JSON.stringify(ag));
      txt('assets_risk_point.qml', qmlZonesVector('marker', [3, 2, 1, 0]));
      txt('assets_risk_line.qml', qmlZonesVector('line', [3, 2, 1, 0]));
      txt('assets_risk_polygon.qml', qmlZonesVector('fill', [3, 2, 1, 0]));
    }
    const d = SLS.proj.describe(tr.epsg);
    txt('README.txt', [
      `SLS Pro ${SLS.VERSION} — ${ctx.title}`,
      `CRS: EPSG:${tr.epsg} (${d ? d.name : ''}) · cell ${tr.cellSize} m · ${tr.width}×${tr.height}`,
      `Analysis: ${ctx.mode === 'dual' ? 'T30 + T300 zoning matrix' : 'single scenario'} · complete: ${ctx.complete ? 'yes' : 'NO — incomplete analysis'}`,
      '',
      'Rasters (GeoTIFF, Float32, nodata -9999): dem, hmax_m, vmax_ms, pmax_kpa, deposit_m [eroded_m, powder_pmax_kpa]; prefixes T30_/T300_ per scenario.',
      'zones.tif (UInt8): 1 yellow, 2 blue, 3 red; zones.geojson: zone polygons (WGS84).',
      'Each layer has a matching .qml style; QGIS applies it automatically when the layer is added.',
      'Data attribution: ' + tr.attribution,
    ].join('\n'));
    const blob = new Blob([ff.zipSync(files)], { type: 'application/zip' });
    download(blob, ctx.baseName + '_qgis.zip');
    return blob;
  }

  function geojsonZones(ctx) {
    download(new Blob([JSON.stringify(zonesGeoJSON(ctx))], { type: 'application/geo+json' }), ctx.baseName + '_zones.geojson');
  }

  SLS.avExport = { download, asc, zoneRaster, summaryJson, kmz, geotiff, qgisPackage, geojsonZones, zonesGeoJSON };
})(window.SLS = window.SLS || {});
