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

  SLS.avExport = { download, asc, zoneRaster, summaryJson, kmz };
})(window.SLS = window.SLS || {});
