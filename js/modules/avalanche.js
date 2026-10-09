/* SLS Pro — Çığ modülü çalışma alanı
 * Adımlar: 1) Arazi  2) Kopma alanı  3) Parametreler  4) Simülasyon  5) Rapor
 * Hesap: avalanche-analysis.js · Dışa aktarım: avalanche-export.js · Rapor: avalanche-report.js
 */
(function (SLS) {
  'use strict';

  const t = (k, v) => SLS.i18n.t(k, v);
  const n = (v, d) => SLS.i18n.number(v, d);
  const pct = (f) => (SLS.i18n.lang === 'tr' ? '%' + n(f * 100, 1) : n(f * 100, 1) + '%');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AN = () => SLS.avAnalysis;

  const STEPS = [
    { id: 'terrain', key: 'ws.step.terrain' },
    { id: 'release', key: 'ws.step.release' },
    { id: 'params', key: 'ws.step.params' },
    { id: 'run', key: 'ws.step.run' },
    { id: 'report', key: 'ws.step.report' },
  ];
  const CELL_SIZES = [5, 10, 20, 30, 50];
  const D0_OPTIONS = [0.5, 1, 1.5, 2, 2.5];
  const PRA = { minSlope: 28, maxSlope: 55, minArea: 2000 };   // potansiyel kopma alanı ölçütleri
  const POLY_SLOPE = { min: 25, max: 60 };                      // elle çizilen alanda kopabilir eğim
  const MAX_EXPANSIONS = 3;                                     // otomatik alan genişletme sınırı
  const BOUNDARY_TOL = 0.001;                                   // kenardan çıkan hacim / giren hacim
  const COMPASS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
  const RESULT_LAYERS = [
    { id: 'hmax', ramp: 'height', key: 'res.hmax' },
    { id: 'vmax', ramp: 'velocity', key: 'res.vmax' },
    { id: 'pmax', ramp: 'pressure', key: 'res.pmax' },
    { id: 'hfinal', ramp: 'height', key: 'res.hfinal' },
    { id: 'zones', ramp: 'zones', key: 'res.zones' },
    { id: 'eroded', ramp: 'erosion', key: 'res.eroded', needs: 'eroded' },
    { id: 'powder', ramp: 'powder', key: 'res.powder', needs: 'powder' },
  ];
  const ZONE_HEX = ['#94a3b8', '#facc15', '#2563eb', '#dc2626'];

  const ICON = {
    draw: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 3"/><path d="M4 4h4M4 4v4"/></svg>',
    poly: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18 4 8l8-5 8 6-3 10z"/><circle cx="4" cy="8" r="1.4"/><circle cx="12" cy="3" r="1.4"/><circle cx="20" cy="9" r="1.4"/></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
    upload: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M4 21h16"/></svg>',
    terrain: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20l6-10 4 6 3-4 5 8z"/></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    stop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
  };

  let root, mapView, state;

  function initialState() {
    return {
      step: 'terrain',
      source: 'terrarium',
      bbox: null,
      cellSize: 10,
      file: null,
      drawing: false,
      busy: false,
      error: null,
      terrain: null,
      stats: null,
      slope: null,
      aspect: null,
      serverOk: false,
      layers: { slope: true, hillshade: true, terrain3d: false },
      basemap: 'topo',
      gotoText: '',
      pra: null,
      release: freshRelease(),
      field: null,                 // { id, profile, sim, useGrad }
      wind: { on: false, dir: 315, speed: 10 },
      snowType: 'dry',
      params: {
        mode: 'single', T: 100, source: 'library', useCalib: true,
        mu: 0.18, xi: 2500, rho: 300, cd: 2, tMax: 300, forest: false,
        entrain: false, erodDepth: 0.3, erodRho: 150, kappaE: 0.02, powder: false,
      },
      landcover: null,
      lcBusy: false, lcError: null,
      assets: [], assetsName: null, assetsError: null, kmlError: null,
      sim: freshSim(),
      report: { meta: loadMeta(), busy: false, progress: 0, error: null, done: null },
    };
  }
  const META_KEY = 'sls.reportMeta';
  function loadMeta() {
    try { return Object.assign({ project: '', location: '', author: '', org: '', notes: '' }, JSON.parse(localStorage.getItem(META_KEY) || '{}')); }
    catch (_) { return { project: '', location: '', author: '', org: '', notes: '' }; }
  }
  function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(state.report.meta)); } catch (_) { /* yok say */ } }
  function freshRelease() {
    return { polys: [], selected: new Set(), fixedMask: null, d0: 1, d0_30: 1.0, d0_300: 1.5, showPra: true, drawingPoly: false, mask: null, h0: null, stats: null };
  }
  function freshSim() {
    return {
      status: 'idle', worker: null, live: null, phase: null, runs: {}, primaryKey: null, view: null, layer: 'hmax',
      error: null, expansions: 0, expanding: false, incomplete: false, stopRequested: false, zoning: null, assetRisk: null,
    };
  }
  const primaryRun = () => state.sim.runs[state.sim.primaryKey] || null;
  const viewRun = () => (state.sim.view && state.sim.view !== 'matrix' ? state.sim.runs[state.sim.view] : primaryRun());

  const canvases = {};
  const canvas = (id) => canvases[id] || (canvases[id] = document.createElement('canvas'));
  const ctx = () => ({ terrain: state.terrain, slope: state.slope, aspect: state.aspect, mask: state.release.mask });

  // ---------------------------------------------------------------------------
  function mount(el) {
    root = el;
    state = initialState();
    root.innerHTML = `
      <div class="workspace">
        <aside class="sidebar" id="sidebar"></aside>
        <div class="map-wrap" id="mapWrap">
          <div id="map"></div>
          <div class="map-hint hidden" id="mapHint"></div>
          <div class="map-panel legend hidden" id="legend"></div>
          <div class="map-panel coords" id="coords">—</div>
        </div>
      </div>`;
    mapView = new SLS.MapView(root.querySelector('#map'), {
      onPointer: updateCoords,
      onClick: onMapClick,
      onDrawEnd: () => {
        state.drawing = false;
        root.querySelector('#mapWrap').classList.remove('drawing');
        hint(null);
      },
    });
    // Saha platformundan gelen profil (#/avalanche?profile=ID)
    const q = new URLSearchParams((location.hash.split('?')[1]) || '');
    const pid = q.get('profile');
    if (pid) { const pr = SLS.snowpack.get(pid); if (pr) applyProfile(pr, true); }
    render();
    SLS.sources.serverAvailable().then((ok) => { state.serverOk = ok; render(); });
  }

  function unmount() {
    stopWorker();
    if (mapView) mapView.destroy();
    mapView = null;
    root.innerHTML = '';
  }

  function hint(text) {
    const el = root.querySelector('#mapHint');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
  }

  // ---------------------------------------------------------------------------
  function releaseCount() { return state.release.stats ? state.release.stats.cells : 0; }
  function stepAvailable(id) {
    if (id === 'terrain') return true;
    if (id === 'release') return !!state.terrain;
    if (id === 'params' || id === 'run') return !!state.terrain && releaseCount() > 0;
    if (id === 'report') return state.sim.status === 'done';
    return false;
  }
  function goStep(id) {
    if (!stepAvailable(id) || state.busy || state.sim.status === 'running') return;
    if (mapView.drawingPolygon) mapView.cancelPolygon();
    state.step = id;
    render();
    syncOverlays();
    root.querySelector('#sidebar').scrollTop = 0;
  }

  // ---------------------------------------------------------------------------
  function render() {
    const sb = root.querySelector('#sidebar');
    const scroll = sb.scrollTop;
    const idx = STEPS.findIndex((s) => s.id === state.step);
    const panel = { terrain: terrainPanel, release: releasePanel, params: paramsPanel, run: runPanel, report: reportPanel }[state.step]();
    sb.innerHTML = `
      <nav class="stepper" aria-label="steps">
        ${STEPS.map((s, i) => {
          const avail = stepAvailable(s.id);
          const cls = [s.id === state.step ? 'current' : '', i < idx && avail ? 'done' : '', avail ? 'avail' : ''].join(' ');
          return `<button type="button" class="step ${cls}" data-step="${s.id}" ${avail ? '' : 'disabled'}>
            <span class="bar"></span><span class="lbl">${i + 1}. ${esc(t(s.key))}</span>
          </button>`;
        }).join('')}
      </nav>
      ${panel}
      ${layersSection()}
      <footer class="sidebar-foot">
        <details>
          <summary>${esc(t('attr.title'))}</summary>
          <ul>
            ${Object.values(SLS.sources.SOURCES).filter((s) => s.url).map((s) => `<li>${esc(s.attribution)}<br><a href="${s.url}" target="_blank" rel="noopener">${esc(s.license)}</a></li>`).join('')}
            <li>${esc(SLS.landcover.SOURCE.attribution)} (${SLS.landcover.SOURCE.license})</li>
            <li>OpenTopoMap (CC-BY-SA) · OpenStreetMap contributors (ODbL)</li>
            <li>Sentinel-2 cloudless 2016 by EOX IT Services GmbH (CC BY 4.0)</li>
            <li>MapLibre GL JS (BSD-3) · proj4js (MIT) · geotiff.js (MIT) · jsPDF (MIT) · fflate (MIT)</li>
          </ul>
        </details>
      </footer>`;
    sb.scrollTop = scroll;
    bind(sb);
    renderLegend();
  }

  const fileBtn = (id, key, accept) => `
    <label class="btn" for="${id}" style="flex:1">${ICON.upload}<span>${esc(t(key))}</span></label>
    <input type="file" id="${id}" accept="${accept}" hidden>`;

  // ---------- 1) Arazi ----------
  function gridPlan() {
    if (state.source === 'file' || !state.bbox) return null;
    return SLS.terrain.planGrid(state.bbox, state.cellSize);
  }

  function terrainPanel() {
    const plan = gridPlan();
    const canFetch = !state.busy && (state.source === 'file' ? !!state.file : !!state.bbox && plan && !plan.tooBig);
    return `
      <section class="section">
        <h2>${esc(t('terrain.title'))}</h2>
        <p class="muted">${esc(t('terrain.intro'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('terrain.source'))}</h4>
        <div class="src-list">
          ${sourceCard('terrarium', '<span class="tag ok">' + esc(t('src.browser')) + '</span>')}
          ${sourceCard('copernicus', state.serverOk ? '<span class="tag ok">serve.py ✓</span>' : '<span class="tag warn">' + esc(t('src.needsServer')) + '</span>', !state.serverOk)}
          ${sourceCard('file', '<span class="tag">' + esc(t('src.local')) + '</span>')}
        </div>
      </section>
      ${state.source === 'file' ? fileSection() : areaSection(plan)}
      <section class="section">
        <h4>${esc(t('terrain.cell'))}</h4>
        <div class="seg" role="radiogroup">
          ${CELL_SIZES.map((c) => `<button type="button" data-cell="${c}" class="${c === state.cellSize ? 'sel' : ''}">${c} m</button>`).join('')}
        </div>
        <p class="hint">${esc(t('terrain.cellHint'))}</p>
        <p class="hint">${esc(t('terrain.runoutHint'))}</p>
        <div style="margin-top:14px">
          <button class="btn primary block" id="fetchBtn" ${canFetch ? '' : 'disabled'}>${ICON.terrain}<span>${esc(t('terrain.fetch'))}</span></button>
        </div>
        <div class="progress ${state.busy ? '' : 'hidden'}" id="progress">
          <div class="track"><div class="fill" id="progFill"></div></div>
          <div class="lbl"><span id="progLbl"></span><span id="progPct" class="mono"></span></div>
        </div>
        ${state.error ? `<div class="alert">${esc(state.error)}</div>` : ''}
        ${plan && plan.tooBig ? `<div class="alert">${esc(t('terrain.tooBig'))}</div>` : ''}
      </section>
      ${state.terrain ? terrainResult() : ''}`;
  }

  function sourceCard(id, tag, dim) {
    return `
      <button type="button" class="src ${state.source === id ? 'sel' : ''} ${dim ? 'off' : ''}" data-src="${id}">
        <span class="radio"></span>
        <span>
          <span class="t">${esc(t('src.' + id))} ${tag}</span>
          <span class="d">${esc(t('src.' + id + '.desc'))}</span>
        </span>
      </button>`;
  }

  function areaSection(plan) {
    const d = plan ? SLS.proj.describe(plan.epsg) : null;
    return `
      <section class="section">
        <h4>${esc(t('terrain.area'))}</h4>
        <div class="row">
          <button class="btn ${state.drawing ? 'on' : ''}" id="drawBtn" style="flex:1">${ICON.draw}<span>${esc(t('terrain.draw'))}</span></button>
          <button class="btn" id="clearBtn" ${state.bbox ? '' : 'disabled'}>${esc(t('terrain.clear'))}</button>
        </div>
        <div class="row" style="margin-top:8px">${fileBtn('kmlArea', 'kml.areaFrom', '.kml,.kmz')}</div>
        ${state.kmlError ? `<div class="alert">${esc(state.kmlError)}</div>` : ''}
        <div class="row" style="margin-top:8px">
          <input class="input mono" id="gotoInput" placeholder="${esc(t('terrain.goto'))}" value="${esc(state.gotoText)}">
          <button class="btn" id="gotoBtn">${esc(t('terrain.gotoBtn'))}</button>
        </div>
        ${plan ? `
          <dl class="kv">
            <dt>${esc(t('terrain.areaKm2'))}</dt><dd>${n(SLS.proj.approxAreaKm2(state.bbox), 2)} km²</dd>
            <dt>${esc(t('terrain.grid'))}</dt><dd>${n(plan.width)} × ${n(plan.height)} (${n(plan.cells)} ${esc(t('unit.cells'))})</dd>
            <dt>${esc(t('terrain.crs'))}</dt><dd>EPSG:${plan.epsg} · ${esc(d.name)}</dd>
          </dl>` : `<p class="hint">${esc(t('terrain.noArea'))}</p>`}
      </section>`;
  }

  function fileSection() {
    return `
      <section class="section">
        <h4>${esc(t('src.file'))}</h4>
        <label class="drop" id="drop">
          <input type="file" id="fileInput" accept=".tif,.tiff,image/tiff" hidden>
          <strong>${esc(t('terrain.file.pick'))}</strong>
          <span class="hint" style="margin:0">${esc(t('terrain.file.drop'))}</span>
          ${state.file ? `<span class="fn">${esc(state.file.name)} · ${n(state.file.size / 1048576, 1)} MB</span>` : ''}
        </label>
        <p class="hint">${esc(t('terrain.fileNoExpand'))}</p>
      </section>`;
  }

  function terrainResult() {
    const tr = state.terrain, st = state.stats;
    const d = SLS.proj.describe(tr.epsg);
    const labels = ['0–15°', '15–30°', '30–45°', '45–60°', '60°+'];
    const srcName = t('src.' + tr.source.id) + (tr.source.fileName ? ' · ' + tr.source.fileName : '');
    return `
      <section class="section">
        <h4>${esc(t('result.title'))}</h4>
        <div class="stats">
          <div class="stat wide"><div class="k">${esc(t('result.source'))}</div><div class="v sm">${esc(srcName)}</div></div>
          <div class="stat"><div class="k">${esc(t('result.elev'))}</div><div class="v">${n(st.min)}–${n(st.max)}<small>m</small></div></div>
          <div class="stat"><div class="k">${esc(t('result.relief'))}</div><div class="v">${n(st.max - st.min)}<small>m</small></div></div>
          <div class="stat"><div class="k">${esc(t('result.dims'))}</div><div class="v">${n(tr.width)}×${n(tr.height)}</div></div>
          <div class="stat"><div class="k">${esc(t('result.cell'))}</div><div class="v">${n(tr.cellSize, tr.cellSize < 1 ? 2 : 0)}<small>m</small></div></div>
          <div class="stat wide"><div class="k">${esc(t('result.crs'))}</div><div class="v sm">EPSG:${tr.epsg} · ${esc(d ? d.name : '')}</div></div>
          <div class="stat wide"><div class="k">${esc(t('result.critical'))}</div><div class="v" style="color:var(--warn)">${pct(st.criticalFraction)}</div></div>
        </div>
        <h4 style="margin-top:16px">${esc(t('result.slopeDist'))}</h4>
        <div class="hist">
          ${st.slopeHist.map((f, i) => `
            <div class="hrow ${i === 2 ? 'crit' : ''}">
              <span>${labels[i]}</span><span class="hbar"><i style="width:${(f * 100).toFixed(1)}%"></i></span><span>${pct(f)}</span>
            </div>`).join('')}
        </div>
      </section>
      <section class="section">
        <h4>${esc(t('result.export'))}</h4>
        <div class="stack">
          <button class="btn block" id="expAsc">${ICON.download}<span>${esc(t('export.asc'))}</span></button>
          <button class="btn block" id="expJson">${ICON.download}<span>${esc(t('export.json'))}</span></button>
          <button class="btn primary block" data-goto="release">${esc(t('export.next'))} ${ICON.arrow}</button>
        </div>
      </section>`;
  }

  // ---------- 2) Kopma alanı ----------
  function releasePanel() {
    const R = state.release, st = R.stats, P = state.pra, F = state.field, Wd = state.wind, dual = state.params.mode === 'dual';
    const profiles = SLS.snowpack.list();
    const fs = F ? F.sim : null;
    const lee = (Wd.dir + 180) % 360;
    return `
      <section class="section">
        <h2>${esc(t('rel.title'))}</h2>
        <p class="muted">${esc(t('rel.intro'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('rel.pra'))}</h4>
        <label class="toggle"><span>${esc(t('rel.showPra'))} <span class="tag">${n(P ? P.candidates : 0)}</span></span>
          <span class="switch"><input type="checkbox" id="praToggle" ${R.showPra ? 'checked' : ''}><span></span></span>
        </label>
        <p class="hint">${esc(t('rel.praHint', { a: PRA.minSlope, b: PRA.maxSlope, m: n(PRA.minArea) }))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('rel.manual'))}</h4>
        <div class="row">
          <button class="btn ${R.drawingPoly ? 'on' : ''}" id="polyBtn" style="flex:1">${ICON.poly}<span>${esc(t(R.drawingPoly ? 'rel.finish' : 'rel.drawPoly'))}</span></button>
          <button class="btn" id="relClear" ${releaseCount() || R.polys.length ? '' : 'disabled'}>${esc(t('terrain.clear'))}</button>
        </div>
        <div class="row" style="margin-top:8px">${fileBtn('kmlRelease', 'kml.releaseFrom', '.kml,.kmz')}</div>
        ${state.kmlError ? `<div class="alert">${esc(state.kmlError)}</div>` : ''}
        <p class="hint">${esc(t('rel.polyHint', { a: POLY_SLOPE.min, b: POLY_SLOPE.max }))}</p>
      </section>

      <section class="section">
        <h4>${esc(t('fp.title'))}</h4>
        <div class="row">
          <select class="select" id="profileSel" style="flex:1;min-width:0">
            <option value="">${esc(t(profiles.length ? 'fp.choose' : 'fp.none'))}</option>
            ${profiles.map((p) => `<option value="${esc(p.id)}" ${F && F.id === p.id ? 'selected' : ''}>${esc(p.name || p.id)} · ${esc(new Date(p.date).toLocaleDateString())}</option>`).join('')}
          </select>
        </div>
        <div class="row" style="margin-top:8px">
          ${fileBtn('profileFile', 'fp.import', '.json,application/json')}
          <a class="btn" href="saha.html" target="_blank" rel="noopener" style="flex:1">${esc(t('fp.open'))}</a>
        </div>
        ${fs ? `
          <dl class="kv">
            <dt>HS · SWE</dt><dd>${n(fs.derived.hs * 100)} cm · ${n(fs.derived.swe)} mm</dd>
            <dt>${esc(t('field.meanRho'))}</dt><dd>${n(fs.derived.meanDensity)} kg/m³ · ${fs.derived.nLayers} ${esc(t('field.layersShort'))}</dd>
            <dt>${esc(t('field.slabD'))}</dt><dd>${fs.d0 ? n(fs.d0 * 100) + ' cm' : '—'}${fs.d0 ? ' · ' + n(fs.slabDensity) + ' kg/m³' : ''}</dd>
            <dt>${esc(t('field.erodible'))}</dt><dd>${n(fs.erodibleDepth * 100)} cm</dd>
            <dt>${esc(t('field.snowType'))}</dt><dd>${esc(t('snow.' + fs.snowType))}</dd>
            <dt>${esc(t('field.elev'))}</dt><dd>${fs.elev != null ? n(fs.elev) + ' m' : '—'}</dd>
          </dl>
          ${fs.elev != null ? `<label class="toggle"><span>${esc(t('fp.grad'))}</span><span class="switch"><input type="checkbox" id="gradToggle" ${F.useGrad ? 'checked' : ''}><span></span></span></label>` : ''}
          ${!fs.d0 ? `<p class="hint">${esc(t('fp.noSlab'))}</p>` : ''}` : `<p class="hint">${esc(t('fp.hint'))}</p>`}
      </section>

      <section class="section">
        <h4>${esc(t(dual ? 'rel.d0Dual' : 'rel.d0'))}</h4>
        ${dual ? `
          <div class="fgrid2">
            <label class="field"><span>T = 30 ${esc(t('unit.years'))} (m)</span><input class="input mono" type="number" step="0.05" min="0.1" data-d0f="d0_30" value="${R.d0_30}"></label>
            <label class="field"><span>T = 300 ${esc(t('unit.years'))} (m)</span><input class="input mono" type="number" step="0.05" min="0.1" data-d0f="d0_300" value="${R.d0_300}"></label>
          </div>
          <p class="hint">${esc(t('rel.d0DualHint'))}</p>` : `
          <div class="seg">
            ${D0_OPTIONS.map((d) => `<button type="button" data-d0="${d}" class="${d === R.d0 ? 'sel' : ''}">${n(d, 1)} m</button>`).join('')}
          </div>
          <label class="field" style="margin-top:8px"><span>${esc(t('rel.d0Custom'))}</span><input class="input mono" type="number" step="0.05" min="0.1" data-d0f="d0" value="${R.d0}"></label>
          <p class="hint">${esc(t('rel.d0Hint'))}</p>`}
      </section>

      <section class="section">
        <h4>${esc(t('wind.title'))}</h4>
        <label class="toggle"><span>${esc(t('wind.toggle'))}</span>
          <span class="switch"><input type="checkbox" id="windToggle" ${Wd.on ? 'checked' : ''}><span></span></span></label>
        ${Wd.on ? `
          <div class="compass">${COMPASS.map(([lab, deg]) => `<button type="button" data-wdir="${deg}" class="${Wd.dir === deg ? 'sel' : ''}">${lab}</button>`).join('')}</div>
          <div class="fgrid2" style="margin-top:8px">
            <label class="field"><span>${esc(t('wind.dir'))} (°)</span><input class="input mono" type="number" min="0" max="359" step="1" data-wind="dir" value="${Wd.dir}"></label>
            <label class="field"><span>${esc(t('wind.speed'))} (m/s)</span><input class="input mono" type="number" min="0" max="60" step="0.5" data-wind="speed" value="${Wd.speed}"></label>
          </div>
          <dl class="kv"><dt>${esc(t('wind.lee'))}</dt><dd>${n(lee)}° · +${n(AN().windDelta(lee, Wd) * 100)} cm</dd></dl>` : ''}
        <p class="hint">${esc(t('wind.hint'))}</p>
      </section>

      <section class="section">
        <h4>${esc(t('rel.summary'))}</h4>
        ${st && st.cells ? `
          <div class="stats">
            <div class="stat"><div class="k">${esc(t('rel.area'))}</div><div class="v">${n(st.area)}<small>m²</small></div></div>
            <div class="stat"><div class="k">${esc(t('rel.volume'))}${dual ? ' (T300)' : ''}</div><div class="v">${n(st.volume)}<small>m³</small></div></div>
            <div class="stat"><div class="k">${esc(t('rel.meanSlope'))}</div><div class="v">${n(st.meanSlope, 1)}<small>°</small></div></div>
            <div class="stat"><div class="k">${esc(t('rel.elev'))}</div><div class="v">${n(st.zmin)}–${n(st.zmax)}<small>m</small></div></div>
            <div class="stat wide"><div class="k">${esc(t('rel.dRange'))}</div><div class="v">${n(st.dmin, 2)}–${n(st.dmax, 2)}<small>m</small></div></div>
          </div>
          <div style="margin-top:12px"><button class="btn primary block" data-goto="params">${esc(t('rel.next'))} ${ICON.arrow}</button></div>`
        : `<p class="hint">${esc(t('rel.empty'))}</p>`}
      </section>`;
  }

  // ---------- 3) Parametreler ----------
  function slider(id, key, min, max, step, value, digits, unit) {
    return `
      <div class="param">
        <div class="param-head"><label for="p_${id}">${esc(t(key))}</label><span class="mono" id="v_${id}">${n(value, digits)}${unit ? ' ' + unit : ''}</span></div>
        <input type="range" class="range" id="p_${id}" data-param="${id}" data-digits="${digits}" data-unit="${unit || ''}" min="${min}" max="${max}" step="${step}" value="${value}">
      </div>`;
  }

  /** Senaryo için sürtünme parametreleri: özel → kullanıcı seti → kalibre set → kitaplık. */
  function resolveParams(T, volume) {
    const P = state.params, lib = SLS.paramsLibrary;
    if (P.mode === 'single' && P.source === 'custom') return { mu: P.mu, xi: P.xi, rho: P.rho, label: t('par.src.custom'), kind: 'custom' };
    if (P.mode === 'single' && P.source && P.source.startsWith('u')) {
      const s = lib.userSets().find((x) => x.id === P.source);
      if (s) return { mu: s.mu, xi: s.xi, rho: s.rho, label: s.name, kind: 'user' };
    }
    if (P.useCalib) {
      const us = lib.userSets().find((s) => s.snowType === state.snowType && Number(s.T) === Number(T));
      if (us) return { mu: us.mu, xi: us.xi, rho: us.rho, label: us.name, kind: 'user' };
    }
    const L = lib.lookup(state.snowType, T, volume);
    return { mu: L.mu, xi: L.xi, rho: L.rho, label: t('par.src.library', { vc: t('vc.' + L.volumeClass) }), kind: 'library' };
  }

  function scenarios() {
    const R = state.release, P = state.params;
    return P.mode === 'dual'
      ? [{ key: 'T30', T: 30, d0: R.d0_30 }, { key: 'T300', T: 300, d0: R.d0_300 }]
      : [{ key: 'S', T: P.T, d0: R.d0 }];
  }
  function releaseOpts(d0) {
    const F = state.field;
    return { d0, elevRef: F && F.useGrad && F.sim.elev != null ? F.sim.elev : null, grad: 0.05, wind: state.wind };
  }
  const powderAllowed = () => SLS.paramsLibrary.SNOW[state.snowType].powder;

  function paramsPanel() {
    const P = state.params, dual = P.mode === 'dual', lib = SLS.paramsLibrary;
    const scs = scenarios().map((sc) => {
      const rel = AN().releaseDepth(ctx(), releaseOpts(sc.d0));
      return Object.assign({}, sc, { vol: rel.stats.volume, prm: resolveParams(sc.T, rel.stats.volume) });
    });
    const cur = scs[0].prm;
    const sets = lib.userSets();
    return `
      <section class="section">
        <h2>${esc(t('par.title'))}</h2>
        <p class="muted">${esc(t('par.intro'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('par.mode'))}</h4>
        <div class="seg seg-wrap">
          <button type="button" data-mode="single" class="${!dual ? 'sel' : ''}">${esc(t('par.modeSingle'))}</button>
          <button type="button" data-mode="dual" class="${dual ? 'sel' : ''}">${esc(t('par.modeDual'))}</button>
        </div>
        <p class="hint">${esc(t(dual ? 'par.modeDualHint' : 'par.modeSingleHint'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('par.snowType'))} ${state.field ? `<span class="tag ok">${esc(t('fp.fromField'))}</span>` : ''}</h4>
        <div class="seg seg-wrap">
          ${['dry', 'dense', 'wet'].map((k) => `<button type="button" data-snow="${k}" class="${state.snowType === k ? 'sel' : ''}">${esc(t('snow.' + k))}</button>`).join('')}
        </div>
        <p class="hint">${esc(t('snow.' + state.snowType + 'Hint'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('par.friction'))}</h4>
        ${dual ? `
          <table class="ptable"><thead><tr><th></th><th>T30</th><th>T300</th></tr></thead><tbody>
            <tr><td>d₀</td>${scs.map((s) => `<td>${n(s.d0, 2)} m</td>`).join('')}</tr>
            <tr><td>${esc(t('rel.volume'))}</td>${scs.map((s) => `<td>${n(s.vol)} m³</td>`).join('')}</tr>
            <tr><td>μ</td>${scs.map((s) => `<td>${n(s.prm.mu, 3)}</td>`).join('')}</tr>
            <tr><td>ξ</td>${scs.map((s) => `<td>${n(s.prm.xi)}</td>`).join('')}</tr>
            <tr><td>ρ</td>${scs.map((s) => `<td>${n(s.prm.rho)}</td>`).join('')}</tr>
            <tr><td>${esc(t('par.source'))}</td>${scs.map((s) => `<td class="sm">${esc(s.prm.label)}</td>`).join('')}</tr>
          </tbody></table>` : `
          <div class="seg" style="margin-bottom:10px">${[30, 100, 300].map((T) => `<button type="button" data-T="${T}" class="${P.T === T ? 'sel' : ''}">T ${T}</button>`).join('')}</div>
          <p class="hint" style="margin:0 0 10px">${esc(t('par.source'))}: <b>${esc(cur.label)}</b>${cur.kind !== 'library' ? ` · <a href="#" id="toLibrary">${esc(t('par.backToLib'))}</a>` : ''}</p>
          ${slider('mu', 'par.mu', 0.08, 0.6, 0.005, cur.mu, 3, '')}
          ${slider('xi', 'par.xi', 200, 5000, 50, cur.xi, 0, 'm/s²')}
          ${slider('rho', 'par.rho', 150, 550, 10, cur.rho, 0, 'kg/m³')}`}
        <p class="hint">${esc(t('par.libHint'))}</p>
        <details class="calib">
          <summary>${esc(t('par.calib'))} (${sets.length})</summary>
          <label class="toggle"><span>${esc(t('par.useCalib'))}</span><span class="switch"><input type="checkbox" id="calibToggle" ${P.useCalib ? 'checked' : ''}><span></span></span></label>
          ${!dual ? `<button class="btn block" id="saveCalib" style="margin:6px 0">${esc(t('par.saveCalib', { s: t('snow.' + state.snowType), T: P.T }))}</button>` : ''}
          ${sets.length ? `<ul class="setlist">${sets.map((s) => `<li><span><b>${esc(s.name)}</b><small>${esc(t('snow.' + s.snowType))} · T${s.T} · μ ${n(s.mu, 3)} · ξ ${n(s.xi)} · ρ ${n(s.rho)}</small></span>
            ${!dual ? `<button class="icon-btn" data-useset="${esc(s.id)}" title="${esc(t('par.apply'))}">✓</button>` : ''}<button class="icon-btn" data-delset="${esc(s.id)}" title="${esc(t('field.delete'))}">×</button></li>`).join('')}</ul>` : `<p class="hint">${esc(t('par.noCalib'))}</p>`}
        </details>
      </section>
      <section class="section">
        <h4>${esc(t('par.forest'))}</h4>
        <label class="toggle"><span>${esc(t('par.forestToggle'))}</span>
          <span class="switch"><input type="checkbox" id="forestToggle" ${P.forest ? 'checked' : ''} ${state.lcBusy ? 'disabled' : ''}><span></span></span>
        </label>
        ${state.lcBusy ? `<p class="hint">${esc(t('par.forestLoading'))}</p>` : ''}
        ${P.forest && state.landcover ? `<dl class="kv"><dt>${esc(t('par.forestShare'))}</dt><dd>${pct(state.landcover.stats.forestFraction)}</dd></dl>` : ''}
        ${state.lcError ? `<div class="alert">${esc(state.lcError)}</div>` : ''}
        <p class="hint">${esc(t('par.forestHint'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('ent.title'))}</h4>
        <label class="toggle"><span>${esc(t('ent.toggle'))}</span>
          <span class="switch"><input type="checkbox" id="entToggle" ${P.entrain ? 'checked' : ''}><span></span></span></label>
        ${P.entrain ? `
          <div class="fgrid2" style="margin-top:6px">
            <label class="field"><span>${esc(t('ent.depth'))} (m)</span><input class="input mono" type="number" min="0" max="3" step="0.05" data-ent="erodDepth" value="${P.erodDepth}"></label>
            <label class="field"><span>${esc(t('ent.rho'))} (kg/m³)</span><input class="input mono" type="number" min="50" max="500" step="10" data-ent="erodRho" value="${P.erodRho}"></label>
            <label class="field"><span>κ_e</span><input class="input mono" type="number" min="0" max="0.2" step="0.005" data-ent="kappaE" value="${P.kappaE}"></label>
          </div>` : ''}
        <p class="hint">${esc(t('ent.hint'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('pw.title'))} <span class="tag warn">${esc(t('pw.experimental'))}</span></h4>
        <label class="toggle"><span>${esc(t('pw.toggle'))}</span>
          <span class="switch"><input type="checkbox" id="powderToggle" ${P.powder && powderAllowed() ? 'checked' : ''} ${powderAllowed() ? '' : 'disabled'}><span></span></span></label>
        <p class="hint">${esc(t(powderAllowed() ? 'pw.hint' : 'pw.notWet'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('par.flow'))}</h4>
        ${slider('cd', 'par.cd', 1, 2, 0.1, P.cd, 1, '')}
        ${slider('tMax', 'par.tMax', 60, 900, 30, P.tMax, 0, 's')}
        <p class="hint">${esc(t('par.flowHint'))}</p>
        <div style="margin-top:12px"><button class="btn primary block" data-goto="run">${esc(t('par.next'))} ${ICON.arrow}</button></div>
      </section>`;
  }

  // ---------- 4) Simülasyon ----------
  function runPanel() {
    const S = state.sim, P = state.params, tr = state.terrain;
    const running = S.status === 'running';
    const L = S.live;
    const scs = scenarios();
    let body = '';
    if (running) {
      body = `
        <section class="section">
          <h4>${esc(t('run.live'))}${S.phase && S.phase.n > 1 ? ` · ${esc(t('run.phase', { i: S.phase.i, n: S.phase.n, k: S.phase.key }))}` : ''}</h4>
          ${S.expanding ? `<div class="info-note">${esc(t('run.expanding', { n: S.expansions + 1, m: MAX_EXPANSIONS }))}</div>` : ''}
          <div class="progress"><div class="track"><div class="fill" id="simFill" style="width:${L ? Math.min(100, L.t / P.tMax * 100) : 0}%"></div></div></div>
          <div class="stats" style="margin-top:12px">
            <div class="stat"><div class="k">${esc(t('run.time'))}</div><div class="v" id="liveT">${L ? n(L.t, 1) : '0'}<small>s</small></div></div>
            <div class="stat"><div class="k">${esc(t('run.vnow'))}</div><div class="v" id="liveV">${L ? n(L.vNowMax, 1) : '0'}<small>m/s</small></div></div>
            <div class="stat"><div class="k">${esc(t('run.momentum'))}</div><div class="v" id="liveM">${L ? pct(L.momentumRatio) : '—'}</div></div>
            <div class="stat"><div class="k">${esc(t('run.wall'))}</div><div class="v" id="liveW">${L ? n(L.wallMs / 1000, 1) : '0'}<small>s</small></div></div>
          </div>
          <p class="hint">${esc(t('run.stopRule'))}</p>
        </section>`;
    }
    if (S.status === 'done') body = resultsPanel();
    return `
      <section class="section">
        <h2>${esc(t('run.title'))}</h2>
        <p class="muted">${esc(t('run.intro'))}</p>
        <dl class="kv">
          <dt>${esc(t('par.mode'))}</dt><dd style="font-family:var(--font)">${esc(t(P.mode === 'dual' ? 'par.modeDual' : 'par.modeSingle'))}</dd>
          <dt>${esc(t('par.snowType'))}</dt><dd style="font-family:var(--font)">${esc(t('snow.' + state.snowType))}</dd>
          <dt>${esc(t('run.scenarios'))}</dt><dd>${scs.map((s) => `${s.key === 'S' ? 'T' + s.T : s.key} · d₀ ${n(s.d0, 2)} m`).join('<br>')}</dd>
          <dt>${esc(t('run.options'))}</dt><dd style="font-family:var(--font)">${[P.forest && esc(t('par.forest')), P.entrain && esc(t('ent.title')), P.powder && powderAllowed() && esc(t('pw.title')), state.wind.on && esc(t('wind.title')), state.field && esc(t('fp.short'))].filter(Boolean).join(' · ') || '—'}</dd>
          <dt>${esc(t('terrain.grid'))}</dt><dd>${n(tr.width)} × ${n(tr.height)} · ${n(tr.cellSize)} m</dd>
        </dl>
        <div style="margin-top:14px">
          ${running
            ? `<button class="btn danger block" id="stopBtn">${ICON.stop}<span>${esc(t('run.stop'))}</span></button>`
            : `<button class="btn primary block" id="runBtn">${ICON.play}<span>${esc(t(S.status === 'done' ? 'run.rerun' : 'run.start'))}</span></button>`}
        </div>
        <p class="hint">${esc(t(tr.source.id === 'file' ? 'run.noExpandHint' : 'run.expandHint'))}</p>
        ${S.error ? `<div class="alert">${esc(S.error)}</div>` : ''}
      </section>
      ${body}`;
  }

  function stopLabel(reason) {
    return t({ momentum: 'run.reason.momentum', tmax: 'run.reason.tmax', user: 'run.reason.user', stopped: 'run.reason.momentum', empty: 'run.reason.empty' }[reason] || 'run.reason.momentum');
  }

  function resultsPanel() {
    const S = state.sim, keys = Object.keys(S.runs), matrix = S.view === 'matrix';
    const run = viewRun(), A = run.analysis;
    const layers = RESULT_LAYERS.filter((l) => !l.needs || run.result[l.needs]);
    const zA = S.zoning ? AN().zoneAreas(S.zoning, state.terrain.cellSize) : null;
    const zoneName = (z) => t(['zone.none', 'zone.yellowM', 'zone.blueM', 'zone.redM'][z]);
    return `
      ${S.incomplete ? `<section class="section"><div class="alert strong"><b>${esc(t('res.incompleteTitle'))}</b><br>${esc(S.incompleteReason || '')}</div></section>` : ''}
      ${S.expansions ? `<section class="section"><div class="info-note">${esc(t('res.expanded', { n: S.expansions }))}</div></section>` : ''}
      <section class="section">
        <h4>${esc(t('res.title'))}</h4>
        ${keys.length > 1 || S.zoning ? `
          <div class="seg seg-wrap" style="margin-bottom:8px">
            ${keys.map((k) => `<button type="button" data-view="${k}" class="${S.view === k ? 'sel' : ''}">${k}</button>`).join('')}
            ${S.zoning ? `<button type="button" data-view="matrix" class="${matrix ? 'sel' : ''}">${esc(t('res.matrix'))}</button>` : ''}
          </div>` : ''}
        ${matrix ? `
          <div class="zones">
            <div><span class="sw" style="background:#dc2626"></span>${esc(t('zone.redM'))}<b class="mono">${n(zA.red, 1)} ha</b></div>
            <div><span class="sw" style="background:#2563eb"></span>${esc(t('zone.blueM'))}<b class="mono">${n(zA.blue, 1)} ha</b></div>
            <div><span class="sw" style="background:#facc15"></span>${esc(t('zone.yellowM'))}<b class="mono">${n(zA.yellow, 1)} ha</b></div>
          </div>
          <table class="ptable matrix-table" style="margin-top:10px">
            <thead><tr><th></th><th>T ≤ 30</th><th>30–300</th></tr></thead>
            <tbody>
              <tr><td>≥ 30 kPa</td><td class="zr">${esc(t('zone.redM'))}</td><td class="zr">${esc(t('zone.redM'))}</td></tr>
              <tr><td>3–30 kPa</td><td class="zr">${esc(t('zone.redM'))}</td><td class="zb">${esc(t('zone.blueM'))}</td></tr>
              <tr><td>&lt; 3 kPa</td><td class="zb">${esc(t('zone.blueM'))}</td><td class="zy">${esc(t('zone.yellowM'))}</td></tr>
            </tbody></table>
          <p class="hint">${esc(t('res.matrixHint'))}</p>` : `
          <div class="seg seg-wrap" role="radiogroup">
            ${layers.map((l) => `<button type="button" data-rlayer="${l.id}" class="${S.layer === l.id ? 'sel' : ''}">${esc(t(l.key))}</button>`).join('')}
          </div>
          <div class="stats" style="margin-top:12px">
            <div class="stat"><div class="k">${esc(t('res.vmaxAll'))}</div><div class="v">${n(A.vmax, 1)}<small>m/s</small></div></div>
            <div class="stat"><div class="k">${esc(t('res.pmaxAll'))}</div><div class="v">${n(A.pmax, 0)}<small>kPa</small></div></div>
            <div class="stat"><div class="k">${esc(t('res.hmaxAll'))}</div><div class="v">${n(A.hmax, 1)}<small>m</small></div></div>
            <div class="stat"><div class="k">${esc(t('res.runout'))}</div><div class="v">${n(A.runout)}<small>m</small></div></div>
            <div class="stat"><div class="k">${esc(t('res.alpha'))}</div><div class="v">${n(A.alpha, 1)}<small>°</small></div></div>
            <div class="stat"><div class="k">${esc(t('res.drop'))}</div><div class="v">${n(A.drop)}<small>m</small></div></div>
            <div class="stat"><div class="k">${esc(t('res.affected'))}</div><div class="v">${n(A.affectedHa, 1)}<small>ha</small></div></div>
            <div class="stat"><div class="k">${esc(t('res.duration'))}</div><div class="v">${n(A.t, 0)}<small>s</small></div></div>
            ${A.entrained > 0 ? `<div class="stat wide"><div class="k">${esc(t('res.entrained'))}</div><div class="v">${n(A.entrained)}<small>m³</small> <small>(${pct(A.entrained / A.release)} ${esc(t('res.ofRelease'))})</small></div></div>` : ''}
            ${A.powder ? `<div class="stat"><div class="k">${esc(t('res.powderP'))}</div><div class="v">${n(A.powderPmax, 1)}<small>kPa</small></div></div>
              <div class="stat"><div class="k">${esc(t('res.powderArea'))}</div><div class="v">${n(A.powderHa, 1)}<small>ha</small></div></div>` : ''}
          </div>
          <h4 style="margin-top:16px">${esc(t('res.zonesTitle'))}</h4>
          <div class="zones">
            <div><span class="sw" style="background:#dc2626"></span>${esc(t('zone.red'))}<b class="mono">${n(A.zoneHa[2], 1)} ha</b></div>
            <div><span class="sw" style="background:#2563eb"></span>${esc(t('zone.blue'))}<b class="mono">${n(A.zoneHa[1], 1)} ha</b></div>
            <div><span class="sw" style="background:#facc15"></span>${esc(t('zone.yellow'))}<b class="mono">${n(A.zoneHa[0], 1)} ha</b></div>
          </div>
          <dl class="kv">
            <dt>μ / ξ / ρ</dt><dd>${n(run.params.mu, 3)} / ${n(run.params.xi)} / ${n(run.params.rho)}</dd>
            <dt>${esc(t('res.stop'))}</dt><dd style="font-family:var(--font)">${esc(stopLabel(A.reason))}</dd>
            <dt>${esc(t('res.deposit'))}</dt><dd>${n(A.deposit)} m³</dd>
            <dt>${esc(t('res.outflowShare'))}</dt><dd>${pct(A.outflowShare)}</dd>
            <dt>${esc(t('res.mass'))}</dt><dd>${n(Math.abs(A.massErr) * 100, 4)} %</dd>
            <dt>${esc(t('res.compute'))}</dt><dd>${n(A.wallMs / 1000, 1)} s · ${n(A.steps)} ${esc(t('res.steps'))}</dd>
          </dl>
          ${A.reason === 'tmax' ? `<div class="alert">${esc(t('res.tmaxWarn'))}</div>` : ''}`}
      </section>
      ${run.profile && !matrix ? `
      <section class="section">
        <h4>${esc(t('prof.title'))}${keys.length > 1 ? ` · ${esc(S.view)}` : ''}</h4>
        <div class="profile-wrap"><canvas id="profileCanvas" aria-label="${esc(t('prof.title'))}"></canvas><div class="profile-tip hidden" id="profileTip"></div></div>
        <p class="hint">${esc(t('prof.hint'))}</p>
      </section>` : ''}
      <section class="section">
        <h4>${esc(t('assets.title'))}</h4>
        <div class="row">${fileBtn('assetFile', 'assets.import', '.kml,.kmz')}</div>
        ${state.assetsError ? `<div class="alert">${esc(state.assetsError)}</div>` : ''}
        ${S.assetRisk && S.assetRisk.length ? `
          <p class="hint">${esc(state.assetsName || '')} · ${S.assetRisk.length} ${esc(t('assets.items'))} · ${esc(t(S.zoning ? 'assets.byMatrix' : 'assets.bySingle'))}</p>
          <table class="ptable assets"><thead><tr><th>${esc(t('assets.name'))}</th><th>${esc(t('assets.zone'))}</th><th>p<sub>max</sub></th><th>h<sub>max</sub></th></tr></thead><tbody>
            ${S.assetRisk.map((a) => `<tr><td>${esc(a.name)}<small>${esc(t('geom.' + a.type))}${a.affectedLen ? ' · ' + n(a.affectedLen) + ' m' : ''}${!a.inside ? ' · ' + esc(t('assets.outside')) : ''}</small></td>
              <td><span class="zdot" style="background:${ZONE_HEX[a.zone]}"></span>${esc(zoneName(a.zone))}</td><td class="mono">${n(a.pmax)}</td><td class="mono">${n(a.hmax, 1)}</td></tr>`).join('')}
          </tbody></table>` : `<p class="hint">${esc(t('assets.hint'))}</p>`}
      </section>
      <section class="section">
        <h4>${esc(t('result.export'))}</h4>
        <div class="stack">
          <button class="btn block" data-exp="kmz">${ICON.download}<span>${esc(t('exp.kmz'))}</span></button>
          <button class="btn block" data-exp="hmax">${ICON.download}<span>h_max (.asc)</span></button>
          <button class="btn block" data-exp="vmax">${ICON.download}<span>v_max (.asc)</span></button>
          <button class="btn block" data-exp="pmax">${ICON.download}<span>p_max (.asc)</span></button>
          <button class="btn block" data-exp="zones">${ICON.download}<span>${esc(t(S.zoning ? 'res.matrix' : 'res.zones'))} (.asc)</span></button>
          <button class="btn block" data-exp="summary">${ICON.download}<span>${esc(t('res.summaryJson'))}</span></button>
          <button class="btn primary block" data-goto="report">${esc(t('res.report'))} ${ICON.arrow}</button>
        </div>
      </section>`;
  }

  // ---------- Katmanlar ve lejant ----------
  function layersSection() {
    return `
      <section class="section">
        <h4>${esc(t('result.layers'))}</h4>
        <div class="seg" style="margin-bottom:10px">
          <button type="button" data-basemap="topo" class="${state.basemap === 'topo' ? 'sel' : ''}">${esc(t('basemap.topo'))}</button>
          <button type="button" data-basemap="sat" class="${state.basemap === 'sat' ? 'sel' : ''}">${esc(t('basemap.sat'))}</button>
        </div>
        <div class="toggles">
          ${state.terrain && state.step === 'terrain' ? toggle('slope', 'layer.slope') : ''}
          ${toggle('hillshade', 'layer.hillshade')}
          ${toggle('terrain3d', 'layer.terrain3d')}
        </div>
      </section>`;
  }

  function toggle(id, key) {
    return `
      <label class="toggle"><span>${esc(t(key))}</span>
        <span class="switch"><input type="checkbox" data-layer="${id}" ${state.layers[id] ? 'checked' : ''}><span></span></span>
      </label>`;
  }

  function legendHtml(title, classes, unitFmt) {
    return `<h5>${esc(title)}</h5>` + classes.map((c) =>
      `<div class="li"><span class="sw" style="background:rgb(${c.color.join(',')})"></span>${c.key ? esc(t(c.key)) : unitFmt(c)}</div>`).join('');
  }
  const rangeLabel = (c) => (c.max === Infinity ? `≥ ${n(c.min, c.min < 1 ? 2 : 0)}` : `${n(c.min, c.min < 1 && c.min > 0 ? 2 : 0)} – ${n(c.max, c.max < 1 ? 1 : 0)}`);

  function renderLegend() {
    const lg = root.querySelector('#legend');
    let html = '';
    const S = state.sim;
    if (state.step === 'terrain' && state.terrain && state.layers.slope) {
      html = legendHtml(t('legend.slope'), SLS.terrain.SLOPE_CLASSES, (c) => `${c.min}°${c.max >= 90 ? '+' : '–' + c.max + '°'}`);
    } else if (state.step === 'release' || state.step === 'params') {
      html = `<h5>${esc(t('ws.step.release'))}</h5>
        <div class="li"><span class="sw" style="background:#22d3ee"></span>${esc(t('legend.release'))}</div>
        ${state.step === 'release' && state.release.showPra ? `<div class="li"><span class="sw" style="background:#a78bfa"></span>${esc(t('legend.pra'))}</div>` : ''}
        ${state.step === 'params' && state.params.forest && state.landcover ? `<div class="li"><span class="sw" style="background:rgb(22,128,61)"></span>${esc(t('lc.tree'))}</div>` : ''}`;
    } else if (state.step === 'run' && S.status === 'running') {
      html = legendHtml(t('legend.flowH'), SLS.raster.RAMPS.height.classes, rangeLabel);
      if (state.params.powder && powderAllowed()) html += `<div class="li"><span class="sw" style="background:rgb(196,160,255)"></span>${esc(t('legend.cloud'))}</div>`;
    } else if ((state.step === 'run' || state.step === 'report') && S.status === 'done') {
      if (S.view === 'matrix') html = legendHtml(t('res.matrix'), SLS.raster.RAMPS.matrix.classes, rangeLabel);
      else {
        const L = RESULT_LAYERS.find((l) => l.id === S.layer);
        const ramp = SLS.raster.RAMPS[L.ramp];
        html = legendHtml(`${t(L.key)}${L.ramp === 'zones' ? '' : ' (' + ramp.unit + ')'}`, ramp.classes, rangeLabel);
      }
      if (S.assetRisk && S.assetRisk.length) html += `<div class="li" style="margin-top:6px"><span class="sw" style="background:#e6edf3;border-radius:50%"></span>${esc(t('assets.title'))}</div>`;
    }
    lg.classList.toggle('hidden', !html);
    lg.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  function bind(sb) {
    const on = (sel, ev, fn) => { const el = sb.querySelector(sel); if (el) el[ev] = fn; return el; };
    sb.querySelectorAll('[data-step]').forEach((b) => b.onclick = () => goStep(b.dataset.step));
    sb.querySelectorAll('[data-goto]').forEach((b) => b.onclick = () => goStep(b.dataset.goto));
    sb.querySelectorAll('[data-src]').forEach((b) => b.onclick = () => { state.source = b.dataset.src; state.error = null; render(); });
    sb.querySelectorAll('[data-cell]').forEach((b) => b.onclick = () => { state.cellSize = Number(b.dataset.cell); render(); });
    sb.querySelectorAll('[data-basemap]').forEach((b) => b.onclick = () => { state.basemap = b.dataset.basemap; mapView.setBasemap(state.basemap); render(); });
    sb.querySelectorAll('[data-layer]').forEach((inp) => inp.onchange = () => {
      const id = inp.dataset.layer;
      state.layers[id] = inp.checked;
      if (id === 'hillshade') mapView.setHillshade(inp.checked);
      if (id === 'terrain3d') mapView.set3D(inp.checked);
      syncOverlays();
    });

    // Arazi
    on('#drawBtn', 'onclick', () => {
      if (state.drawing) { mapView.stopDraw(); render(); return; }
      state.drawing = true;
      root.querySelector('#mapWrap').classList.add('drawing');
      hint(t('terrain.drawing'));
      mapView.startDraw((b) => { if (b) { state.bbox = b; state.error = null; } mapView.setAoi(state.bbox); render(); });
      render();
    });
    on('#clearBtn', 'onclick', () => { state.bbox = null; mapView.setAoi(null); render(); });
    const gotoInput = sb.querySelector('#gotoInput');
    if (gotoInput) {
      const doGoto = () => {
        state.gotoText = gotoInput.value;
        const m = gotoInput.value.replace(/[°NEne]/g, '').split(/[\s,;]+/).filter(Boolean).map(Number);
        if (m.length >= 2 && m.every(Number.isFinite) && Math.abs(m[0]) <= 90 && Math.abs(m[1]) <= 180) mapView.flyTo(m[1], m[0]);
      };
      sb.querySelector('#gotoBtn').onclick = doGoto;
      gotoInput.onkeydown = (e) => { if (e.key === 'Enter') doGoto(); };
    }
    const drop = sb.querySelector('#drop');
    if (drop) {
      const inp = sb.querySelector('#fileInput');
      inp.onchange = () => { if (inp.files[0]) { state.file = inp.files[0]; state.error = null; render(); } };
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) { state.file = f; state.error = null; render(); } };
    }
    on('#fetchBtn', 'onclick', runFetch);
    if (sb.querySelector('#expAsc')) {
      const base = `sls_dem_${state.terrain.epsg}_${state.terrain.cellSize}m`;
      on('#expAsc', 'onclick', () => SLS.terrain.exportAsc(state.terrain, base));
      on('#expJson', 'onclick', () => SLS.terrain.exportJson(state.terrain, state.stats, base));
    }
    on('#kmlArea', 'onchange', (e) => importKml(e.target.files[0], 'area'));

    // Kopma alanı
    on('#praToggle', 'onchange', (e) => { state.release.showPra = e.target.checked; syncOverlays(); });
    on('#polyBtn', 'onclick', () => {
      if (state.release.drawingPoly) { mapView.finishPolygon(); return; }
      state.release.drawingPoly = true;
      hint(t('rel.polyDrawing'));
      mapView.startPolygon((ring) => {
        state.release.drawingPoly = false; hint(null);
        if (ring) { state.release.polys.push(ring); updateRelease(); }
        render();
      });
      render();
    });
    on('#relClear', 'onclick', () => { const R = state.release; R.polys = []; R.selected.clear(); R.fixedMask = null; updateRelease(); render(); });
    on('#kmlRelease', 'onchange', (e) => importKml(e.target.files[0], 'release'));
    sb.querySelectorAll('[data-d0]').forEach((b) => b.onclick = () => { state.release.d0 = Number(b.dataset.d0); updateRelease(); render(); });
    sb.querySelectorAll('[data-d0f]').forEach((inp) => inp.onchange = () => {
      const v = Number(inp.value);
      if (Number.isFinite(v) && v > 0) { state.release[inp.dataset.d0f] = Math.round(v * 100) / 100; updateRelease(); render(); }
    });
    on('#profileSel', 'onchange', (e) => {
      const id = e.target.value;
      if (!id) { state.field = null; updateRelease(); render(); return; }
      const pr = SLS.snowpack.get(id); if (pr) applyProfile(pr);
    });
    on('#profileFile', 'onchange', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const arr = await SLS.snowpack.fromFile(f); arr.forEach((p) => SLS.snowpack.save(p)); applyProfile(arr[0]); }
      catch (_) { alert(t('field.importErr')); }
    });
    on('#gradToggle', 'onchange', (e) => { state.field.useGrad = e.target.checked; updateRelease(); render(); });
    on('#windToggle', 'onchange', (e) => { state.wind.on = e.target.checked; updateRelease(); render(); });
    sb.querySelectorAll('[data-wdir]').forEach((b) => b.onclick = () => { state.wind.dir = Number(b.dataset.wdir); updateRelease(); render(); });
    sb.querySelectorAll('[data-wind]').forEach((inp) => inp.onchange = () => {
      const v = Number(inp.value);
      if (Number.isFinite(v)) { state.wind[inp.dataset.wind] = inp.dataset.wind === 'dir' ? ((Math.round(v) % 360) + 360) % 360 : Math.max(0, v); updateRelease(); render(); }
    });

    // Parametreler
    sb.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { state.params.mode = b.dataset.mode; updateRelease(); render(); });
    sb.querySelectorAll('[data-snow]').forEach((b) => b.onclick = () => {
      state.snowType = b.dataset.snow;
      if (!powderAllowed()) state.params.powder = false;
      if (state.params.source === 'custom') state.params.source = 'library';
      invalidateSim(); render();
    });
    sb.querySelectorAll('[data-T]').forEach((b) => b.onclick = () => { state.params.T = Number(b.dataset.t || b.dataset.T); invalidateSim(); render(); });
    sb.querySelectorAll('[data-param]').forEach((inp) => {
      const id = inp.dataset.param, dg = Number(inp.dataset.digits), unit = inp.dataset.unit;
      inp.oninput = () => { sb.querySelector('#v_' + id).textContent = n(Number(inp.value), dg) + (unit ? ' ' + unit : ''); };
      inp.onchange = () => {
        const P = state.params;
        if (id === 'mu' || id === 'xi' || id === 'rho') {
          if (P.source !== 'custom') {
            const sc = scenarios()[0], rel = AN().releaseDepth(ctx(), releaseOpts(sc.d0));
            Object.assign(P, resolveParams(sc.T, rel.stats.volume));
            P.source = 'custom';
          }
        }
        P[id] = Number(inp.value);
        invalidateSim(); render();
      };
    });
    on('#toLibrary', 'onclick', (e) => { e.preventDefault(); state.params.source = 'library'; invalidateSim(); render(); });
    on('#calibToggle', 'onchange', (e) => { state.params.useCalib = e.target.checked; invalidateSim(); render(); });
    on('#saveCalib', 'onclick', () => {
      const sc = scenarios()[0], rel = AN().releaseDepth(ctx(), releaseOpts(sc.d0)), cur = resolveParams(sc.T, rel.stats.volume);
      const name = prompt(t('par.calibName'), `${t('snow.' + state.snowType)} T${state.params.T}`);
      if (!name) return;
      const s = SLS.paramsLibrary.saveUserSet({ name, snowType: state.snowType, T: state.params.T, mu: cur.mu, xi: cur.xi, rho: cur.rho });
      state.params.source = s.id;
      render();
    });
    sb.querySelectorAll('[data-useset]').forEach((b) => b.onclick = () => { state.params.source = b.dataset.useset; invalidateSim(); render(); });
    sb.querySelectorAll('[data-delset]').forEach((b) => b.onclick = () => {
      if (!confirm(t('par.confirmDelSet'))) return;
      SLS.paramsLibrary.removeUserSet(b.dataset.delset);
      if (state.params.source === b.dataset.delset) state.params.source = 'library';
      invalidateSim(); render();
    });
    on('#forestToggle', 'onchange', (e) => setForest(e.target.checked));
    on('#entToggle', 'onchange', (e) => { state.params.entrain = e.target.checked; invalidateSim(); render(); });
    sb.querySelectorAll('[data-ent]').forEach((inp) => inp.onchange = () => {
      const v = Number(inp.value); if (Number.isFinite(v) && v >= 0) { state.params[inp.dataset.ent] = v; invalidateSim(); }
    });
    on('#powderToggle', 'onchange', (e) => { state.params.powder = e.target.checked; invalidateSim(); render(); });

    // Rapor
    sb.querySelectorAll('[data-meta]').forEach((inp) => { inp.oninput = () => { state.report.meta[inp.dataset.meta] = inp.value; saveMeta(); }; });
    on('#reportBtn', 'onclick', makeReport);

    // Simülasyon
    on('#runBtn', 'onclick', startSim);
    on('#stopBtn', 'onclick', (e) => { state.sim.stopRequested = true; if (state.sim.worker) state.sim.worker.postMessage({ type: 'stop' }); e.currentTarget.disabled = true; });
    sb.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => {
      state.sim.view = b.dataset.view;
      const r = viewRun();
      if (!RESULT_LAYERS.find((l) => l.id === state.sim.layer && (!l.needs || r.result[l.needs]))) state.sim.layer = 'hmax';
      paintResult(); showPath(); render();
    });
    sb.querySelectorAll('[data-rlayer]').forEach((b) => b.onclick = () => { state.sim.layer = b.dataset.rlayer; paintResult(); render(); });
    sb.querySelectorAll('[data-exp]').forEach((b) => b.onclick = () => exportResult(b.dataset.exp));
    on('#assetFile', 'onchange', (e) => importKml(e.target.files[0], 'assets'));
    bindProfile(sb);
  }

  // ---------------------------------------------------------------------------
  // Arazi edinimi
  function setProgress(key, frac) {
    const fill = root.querySelector('#progFill');
    if (!fill) return;
    fill.style.width = Math.round(frac * 100) + '%';
    root.querySelector('#progLbl').textContent = t(key);
    root.querySelector('#progPct').textContent = Math.round(frac * 100) + '%';
  }

  async function runFetch() {
    state.busy = true; state.error = null;
    render();
    setProgress('progress.tiles', 0);
    try {
      let terrain;
      if (state.source === 'terrarium') terrain = await SLS.sources.fromTerrarium(state.bbox, state.cellSize, setProgress);
      else if (state.source === 'copernicus') terrain = await SLS.sources.fromCopernicus(state.bbox, state.cellSize, setProgress);
      else terrain = await SLS.sources.fromFile(state.file, state.cellSize, setProgress);
      setProgress('progress.analysis', 0.5);
      await new Promise((r) => setTimeout(r, 20));
      stopWorker();
      applyTerrain(terrain, false);
      mapView.fitBbox(terrain.bboxWgs84);
      setProgress('progress.done', 1);
    } catch (e) {
      console.error(e);
      state.error = e && e.message ? e.message : t('err.generic');
    } finally {
      state.busy = false;
      render();
      syncOverlays();
    }
  }

  /** Yeni araziyi yerleştirir. keep=true: kopma tanımı, saha verisi ve parametreler korunur (alan genişletme). */
  function applyTerrain(terrain, keep) {
    const { slope, aspect } = SLS.terrain.slopeAspect(terrain);
    const stats = SLS.terrain.stats(terrain, slope);
    Object.assign(state, { terrain, stats, slope, aspect, landcover: null, lcError: null });
    if (!keep) {
      state.release = Object.assign(freshRelease(), { d0: state.release.d0, d0_30: state.release.d0_30, d0_300: state.release.d0_300 });
      state.sim = freshSim();
      state.params.forest = false;
      state.report.done = null;
      mapView.setPath(null); mapView.setProbe(null);
    }
    SLS.currentTerrain = terrain;
    state.corners = SLS.terrain.cornersWgs84(terrain);
    ['slope', 'forest', 'pra', 'release', 'result', 'sim', 'simPowder'].forEach((id) => mapView.removeOverlay(id));
    computePra();
    updateRelease(true);
    SLS.raster.paint(canvas('slope'), terrain.width, terrain.height, slope, SLS.terrain.SLOPE_CLASSES, 200);
    mapView.setOverlay('slope', canvas('slope'), state.corners, 0.72);
    mapView.refreshOverlay('slope');
    mapView.setExtent(state.corners);
    state.bbox = terrain.bboxWgs84;
    mapView.setAoi(null);
  }

  // ---------------------------------------------------------------------------
  // KML / KMZ
  async function importKml(file, purpose) {
    if (!file) return;
    state.kmlError = null; state.assetsError = null;
    try {
      const feats = await SLS.kml.readFile(file);
      if (!feats.length) throw new Error('empty');
      if (purpose === 'area') {
        const b = SLS.kml.bboxOf(feats), mx = Math.max((b.east - b.west) * 0.25, 0.005), my = Math.max((b.north - b.south) * 0.25, 0.004);
        state.bbox = { west: b.west - mx, east: b.east + mx, south: b.south - my, north: b.north + my };
        state.kmlPolys = feats.filter((f) => f.type === 'Polygon').map((f) => f.coords);
        mapView.setAoi(state.bbox); mapView.fitBbox(state.bbox);
        if (state.kmlPolys.length) mapView.setPolygons(state.kmlPolys);
      } else if (purpose === 'release') {
        const polys = feats.filter((f) => f.type === 'Polygon').map((f) => f.coords);
        if (!polys.length) throw new Error(t('kml.noPolygon'));
        state.release.polys.push(...polys);
        updateRelease();
      } else if (purpose === 'assets') {
        state.assets = feats;
        state.assetsName = file.name;
        computeAssetRisk();
        syncOverlays();
      }
    } catch (e) {
      console.error(e);
      const msg = t('kml.err') + (e && e.message && !/^(empty|kml-parse|kmz-empty)$/.test(e.message) ? ' (' + e.message + ')' : '');
      if (purpose === 'assets') state.assetsError = msg; else state.kmlError = msg;
    }
    render();
  }

  function computeAssetRisk() {
    const S = state.sim;
    if (!state.assets.length || S.status !== 'done') { S.assetRisk = null; mapView.setAssets([]); return; }
    const pr = primaryRun().result;
    const zoneOf = S.zoning ? (i) => S.zoning[i] : (i) => AN().singleZone(pr, i);
    S.assetRisk = AN().assetRisk(state.assets, ctx(), pr, zoneOf);
    mapView.setAssets(S.assetRisk.map((a) => Object.assign({}, a.feature, { color: ZONE_HEX[a.zone] })));
  }

  // ---------------------------------------------------------------------------
  // Saha verisi
  function applyProfile(pr, silent) {
    const s = SLS.snowpack.toSimulation(pr);
    state.field = { id: pr.id, profile: pr, sim: s, useGrad: s.elev != null };
    if (s.d0) state.release.d0 = Math.round(s.d0 * 100) / 100;
    state.snowType = s.snowType;
    if (!powderAllowed()) state.params.powder = false;
    if (s.erodibleDepth > 0) {
      state.params.entrain = true;
      state.params.erodDepth = Math.round(s.erodibleDepth * 100) / 100;
      if (Number.isFinite(s.erodibleDensity)) state.params.erodRho = Math.round(s.erodibleDensity);
    }
    if (Number.isFinite(Number(s.windDir)) && Number.isFinite(Number(s.windSpeed)) && s.windDir !== null && s.windSpeed !== null) {
      state.wind = { on: Number(s.windSpeed) > 4, dir: Math.round(Number(s.windDir)) % 360, speed: Number(s.windSpeed) };
    }
    if (state.terrain) updateRelease();
    if (!silent) render();
  }

  // ---------------------------------------------------------------------------
  // Kopma alanı
  function computePra() {
    const tr = state.terrain, s = state.slope;
    const minCells = Math.ceil(PRA.minArea / (tr.cellSize * tr.cellSize));
    const comp = SLS.raster.components(tr.width, tr.height, (i) => s[i] >= PRA.minSlope && s[i] <= PRA.maxSlope);
    const big = new Uint8Array(comp.count + 1);
    let candidates = 0;
    for (let l = 1; l <= comp.count; l++) if (comp.sizes[l] >= minCells) { big[l] = 1; candidates++; }
    state.pra = { labels: comp.labels, big, candidates };
    SLS.raster.paintMask(canvas('pra'), tr.width, tr.height, comp.labels, [167, 139, 250], 120, (l) => l > 0 && big[l] === 1);
    mapView.setOverlay('pra', canvas('pra'), state.corners, 0.8);
    mapView.refreshOverlay('pra');
  }

  function updateRelease(keepSim) {
    const tr = state.terrain, R = state.release, s = state.slope;
    if (!tr) return;
    const N = tr.width * tr.height;
    const mask = new Uint8Array(N);
    if (R.selected.size) {
      const L = state.pra.labels;
      for (let i = 0; i < N; i++) if (L[i] && R.selected.has(L[i])) mask[i] = 1;
    }
    if (R.fixedMask && R.fixedMask.length === N) for (let i = 0; i < N; i++) if (R.fixedMask[i]) mask[i] = 1;
    for (const ring of R.polys) {
      SLS.raster.rasterizePolygon(tr, ring, (i) => { if (s[i] >= POLY_SLOPE.min && s[i] <= POLY_SLOPE.max) mask[i] = 1; });
    }
    for (let i = 0; i < N; i++) if (Number.isNaN(tr.data[i])) mask[i] = 0;
    R.mask = mask;
    const sc = scenarios();
    const rel = AN().releaseDepth(ctx(), releaseOpts(sc[sc.length - 1].d0));
    R.h0 = rel.h0;
    R.stats = rel.stats;
    SLS.raster.paintMask(canvas('release'), tr.width, tr.height, mask, [34, 211, 238], 210);
    if (!mapView.map.getSource('release')) mapView.setOverlay('release', canvas('release'), state.corners, 0.85);
    mapView.refreshOverlay('release');
    mapView.setPolygons(R.polys);
    if (!keepSim) invalidateSim();
  }

  function onMapClick(ll) {
    if (state.step !== 'release' || !state.terrain || !state.pra || !state.release.showPra) return;
    const i = SLS.raster.cellAt(state.terrain, ll.lng, ll.lat);
    if (i < 0) return;
    const l = state.pra.labels[i];
    if (!l || !state.pra.big[l]) return;
    const sel = state.release.selected;
    if (sel.has(l)) sel.delete(l); else sel.add(l);
    updateRelease();
    render();
  }

  // ---------------------------------------------------------------------------
  // Simülasyon
  function invalidateSim() {
    if (!state.sim || state.sim.status === 'running') return;
    if (state.sim.status === 'done' || state.sim.live) {
      state.sim = freshSim();
      mapView.removeOverlay('result');
      mapView.removeOverlay('sim');
      mapView.removeOverlay('simPowder');
      mapView.setPath(null); mapView.setProbe(null); mapView.setAssets([]);
      state.report.done = null;
    }
  }

  function stopWorker() {
    if (state && state.sim && state.sim.worker) { state.sim.worker.terminate(); state.sim.worker = null; }
  }

  const canExpand = () => state.terrain.source.id !== 'file' && state.sim.expansions < MAX_EXPANSIONS;

  /** Tek senaryo çalıştırır. abortOnBoundary: akış alan kenarına ulaşınca erken bırak. */
  function runWorker(h0, prm, abortOnBoundary) {
    return new Promise((resolve, reject) => {
      const tr = state.terrain, P = state.params, W = tr.width, H = tr.height, N = W * H;
      let worker;
      try { worker = new Worker('js/sim/voellmy-worker.js'); }
      catch (e) { reject(new Error(t('run.workerErr'))); return; }
      state.sim.worker = worker;
      const simCanvas = canvas('sim'), powCanvas = canvas('simPowder');
      simCanvas.width = W; simCanvas.height = H; powCanvas.width = W; powCanvas.height = H;
      mapView.setOverlay('sim', simCanvas, state.corners, 0.9);
      const usePowder = P.powder && powderAllowed();
      if (usePowder) mapView.setOverlay('simPowder', powCanvas, state.corners, 0.55);
      syncOverlays();
      const heights = SLS.raster.RAMPS.height.classes;
      const cloud = [{ min: 0.5, max: Infinity, color: [196, 160, 255] }];
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'frame') {
          state.sim.live = Object.assign({}, m.status, { wallMs: m.wallMs });
          SLS.raster.paint(simCanvas, W, H, m.h, heights, 230);
          mapView.refreshOverlay('sim');
          if (m.ph) { SLS.raster.paint(powCanvas, W, H, m.ph, cloud, 140); mapView.refreshOverlay('simPowder'); }
          updateLive();
          const st = m.status, inflow = st.releaseVolume + (st.entrained || 0);
          if (abortOnBoundary && inflow > 0 && st.outflow / inflow > BOUNDARY_TOL) {
            worker.terminate(); state.sim.worker = null;
            resolve({ boundary: true, edges: st.edges });
          }
        } else if (m.type === 'done') {
          worker.terminate(); state.sim.worker = null;
          resolve({ result: m });
        } else if (m.type === 'error') {
          worker.terminate(); state.sim.worker = null;
          reject(new Error(m.message));
        }
      };
      worker.onerror = (e) => { worker.terminate(); state.sim.worker = null; reject(new Error(location.protocol === 'file:' ? t('run.workerErr') : (e.message || t('err.generic')))); };

      const z = new Float32Array(tr.data);
      const h0c = new Float32Array(h0);
      const msg = {
        type: 'start', width: W, height: H, dx: tr.cellSize, z, h0: h0c,
        params: { mu: prm.mu, xi: prm.xi, rho: prm.rho, cd: P.cd, tMax: P.tMax, kappaE: P.kappaE, rhoCover: P.erodRho, powder: usePowder },
      };
      const transfer = [z.buffer, h0c.buffer];
      if (P.forest && state.landcover) {
        const muMap = new Float32Array(N).fill(prm.mu), xiMap = new Float32Array(N).fill(prm.xi);
        const cls = state.landcover.classes;
        for (let i = 0; i < N; i++) if (cls[i] === SLS.landcover.FOREST) { muMap[i] = prm.mu + 0.02; xiMap[i] = Math.min(prm.xi, 400); }
        msg.muMap = muMap; msg.xiMap = xiMap; transfer.push(muMap.buffer, xiMap.buffer);
      }
      if (P.entrain && P.erodDepth > 0) {
        // Örtü karı: yamaca dik derinlik → düşey; kopma hücrelerinde örtü yok (zaten kopan levha)
        const er = new Float32Array(N), mask = state.release.mask;
        for (let i = 0; i < N; i++) if (!mask[i] && !Number.isNaN(tr.data[i])) er[i] = P.erodDepth / Math.cos(state.slope[i] * Math.PI / 180);
        msg.erodible = er; transfer.push(er.buffer);
      }
      worker.postMessage(msg, transfer);
    });
  }

  /** Akışın çıktığı kenar(lar)a doğru araziyi büyütür, kopma tanımını yeni ızgaraya taşır. */
  async function expandDomain(edges) {
    const tr = state.terrain, b = tr.bboxWgs84, f = 0.5;
    const w = b.east - b.west, h = b.north - b.south, m = 0.02;
    const nb = {
      west: b.west - (edges.w > 0 ? f * w : m * w), east: b.east + (edges.e > 0 ? f * w : m * w),
      south: b.south - (edges.s > 0 ? f * h : m * h), north: b.north + (edges.n > 0 ? f * h : m * h),
    };
    if (SLS.terrain.planGrid(nb, tr.cellSize, tr.epsg).tooBig) return false;
    state.sim.expanding = true; render();
    try {
      const fetcher = tr.source.id === 'copernicus' ? SLS.sources.fromCopernicus : SLS.sources.fromTerrarium;
      const nt = await fetcher(nb, tr.cellSize, () => {}, tr.epsg);
      const dc = Math.round((tr.originX - nt.originX) / tr.cellSize), dr = Math.round((nt.originY - tr.originY) / tr.cellSize);
      const old = state.release.mask, fm = new Uint8Array(nt.width * nt.height);
      for (let i = 0; i < old.length; i++) {
        if (!old[i]) continue;
        const r = ((i / tr.width) | 0) + dr, c = (i % tr.width) + dc;
        if (r >= 0 && c >= 0 && r < nt.height && c < nt.width) fm[r * nt.width + c] = 1;
      }
      const hadForest = state.params.forest;
      state.release.fixedMask = fm;
      state.release.selected.clear();
      applyTerrain(nt, true);
      if (hadForest) await setForest(true, true);
      mapView.fitBbox(nt.bboxWgs84);
      return true;
    } finally {
      state.sim.expanding = false;
    }
  }

  async function startSim() {
    stopWorker();
    ['result', 'sim', 'simPowder'].forEach((id) => mapView.removeOverlay(id));
    mapView.setPath(null); mapView.setProbe(null); mapView.setAssets([]);
    const S = state.sim = Object.assign(freshSim(), { status: 'running', layer: state.sim.layer });
    state.report.done = null;
    render();
    try {
      outer: for (;;) {
        S.runs = {};
        const scs = scenarios();
        for (let k = 0; k < scs.length; k++) {
          const sc = scs[k];
          if (S.stopRequested) break outer;
          S.phase = { i: k + 1, n: scs.length, key: sc.key === 'S' ? 'T' + sc.T : sc.key };
          S.live = null; render();
          const rel = AN().releaseDepth(ctx(), releaseOpts(sc.d0));
          const prm = resolveParams(sc.T, rel.stats.volume);
          let out = await runWorker(rel.h0, prm, canExpand());
          if (out.boundary) {
            if (await expandDomain(out.edges)) { S.expansions++; continue outer; }
            out = await runWorker(AN().releaseDepth(ctx(), releaseOpts(sc.d0)).h0, prm, false);
          }
          S.runs[sc.key] = { scenario: sc, params: { mu: prm.mu, xi: prm.xi, rho: prm.rho, source: prm.label }, release: rel.stats, result: out.result };
        }
        break;
      }
      finalize();
    } catch (e) {
      console.error(e);
      S.status = 'error';
      S.error = e && e.message ? e.message : t('err.generic');
      ['sim', 'simPowder'].forEach((id) => mapView.removeOverlay(id));
      render();
    }
  }

  function finalize() {
    const S = state.sim, keys = Object.keys(S.runs);
    ['sim', 'simPowder'].forEach((id) => mapView.removeOverlay(id));
    if (!keys.length) { S.status = 'idle'; render(); syncOverlays(); return; }
    const c = ctx();
    for (const k of keys) {
      const run = S.runs[k];
      run.analysis = AN().analyze(run.result, c);
      run.profile = AN().flowProfile(run.result, c, run.analysis.iTop, run.analysis.iTip);
    }
    S.primaryKey = S.runs.T300 ? 'T300' : keys[keys.length - 1];
    S.zoning = S.runs.T30 && S.runs.T300 ? AN().zoningMatrix(S.runs.T30.result, S.runs.T300.result, state.terrain.width * state.terrain.height) : null;
    S.view = S.zoning ? 'matrix' : S.primaryKey;
    // Tamamlanma
    const reasons = [];
    for (const k of keys) {
      const A = S.runs[k].analysis;
      if (A.outflowShare > BOUNDARY_TOL) reasons.push(t('res.inc.outflow', { k, p: pct(A.outflowShare) }));
      if (A.reason === 'tmax') reasons.push(t('res.inc.tmax', { k }));
      if (A.reason === 'user') reasons.push(t('res.inc.user', { k }));
    }
    if (state.params.mode === 'dual' && !S.zoning) reasons.push(t('res.inc.dual'));
    S.incomplete = reasons.length > 0;
    S.incompleteReason = reasons.join(' ');
    S.status = 'done';
    computeAssetRisk();
    paintResult();
    mapView.setOverlay('result', canvas('result'), state.corners, 0.85);
    mapView.refreshOverlay('result');
    showPath();
    render();
    syncOverlays();
  }

  function showPath() {
    const r = viewRun();
    mapView.setPath(r && r.profile ? r.profile.cells.map(cellLonLat) : null);
  }

  function updateLive() {
    const L = state.sim.live;
    if (!L || state.step !== 'run') return;
    const set = (id, html) => { const el = root.querySelector('#' + id); if (el) el.innerHTML = html; };
    const fill = root.querySelector('#simFill');
    if (!fill) { render(); return; }
    fill.style.width = Math.min(100, L.t / state.params.tMax * 100) + '%';
    set('liveT', `${n(L.t, 1)}<small>s</small>`);
    set('liveV', `${n(L.vNowMax, 1)}<small>m/s</small>`);
    set('liveM', pct(L.momentumRatio));
    set('liveW', `${n(L.wallMs / 1000, 1)}<small>s</small>`);
  }

  function paintResult() {
    const S = state.sim, tr = state.terrain;
    if (S.status !== 'done') return;
    const W = tr.width, H = tr.height;
    if (S.view === 'matrix') {
      SLS.raster.paint(canvas('result'), W, H, S.zoning, SLS.raster.RAMPS.matrix.classes, 215, (i) => S.zoning[i] > 0);
    } else {
      const r = viewRun().result;
      const L = RESULT_LAYERS.find((l) => l.id === S.layer) || RESULT_LAYERS[0];
      const classes = SLS.raster.RAMPS[L.ramp].classes;
      let values, mask;
      if (L.id === 'zones') { values = r.pmax; mask = (i) => r.hmax[i] >= AN().AFFECTED_H; }
      else if (L.id === 'powder') { values = r.powder.pmax; mask = (i) => r.powder.pmax[i] >= 0.5; }
      else if (L.id === 'eroded') { values = r.eroded; mask = (i) => r.eroded[i] >= 0.02; }
      else if (L.id === 'hfinal') { values = r.hfinal; mask = null; }
      else { values = r[L.id]; mask = (i) => r.hmax[i] >= 0.05; }
      SLS.raster.paint(canvas('result'), W, H, values, classes, 215, mask);
    }
    mapView.refreshOverlay('result');
    renderLegend();
  }

  function exportCtx() {
    const S = state.sim, tr = state.terrain, P = state.params;
    const pr = primaryRun();
    return {
      terrain: tr, terrainStats: state.stats, corners: state.corners, runs: S.runs, primaryKey: S.primaryKey,
      zoning: S.zoning, releaseMask: state.release.mask, assetRisk: S.assetRisk,
      pathCoords: pr && pr.profile ? pr.profile.cells.map(cellLonLat) : null,
      mode: P.mode, snowType: state.snowType, complete: !S.incomplete, expansions: S.expansions,
      options: { forest: P.forest, entrain: P.entrain ? { depth_m: P.erodDepth, density: P.erodRho, kappa: P.kappaE } : false, powder: P.powder && powderAllowed(), wind: state.wind.on ? { dir_deg: state.wind.dir, speed_ms: state.wind.speed } : false, cd: P.cd, t_max_s: P.tMax },
      fieldProfile: state.field ? { id: state.field.id, name: state.field.profile.name, date: state.field.profile.date, derived: state.field.sim.derived } : null,
      baseName: `sls_avalanche_${tr.epsg}_${tr.cellSize}m`,
      title: state.report.meta.project || t('mod.avalanche'),
    };
  }

  async function exportResult(kind) {
    const E = SLS.avExport, c = exportCtx(), r = viewRun().result;
    const suffix = state.sim.view && state.sim.view !== 'matrix' && state.sim.view !== 'S' ? '_' + state.sim.view : '';
    try {
      if (kind === 'summary') return E.summaryJson(c);
      if (kind === 'kmz') return await E.kmz(c);
      if (kind === 'zones') {
        if (state.sim.zoning) return E.asc(state.terrain, E.zoneRaster(state.sim.zoning), `${c.baseName}_zoning_matrix`);
        const codes = new Uint8Array(r.pmax.length);
        for (let i = 0; i < codes.length; i++) codes[i] = AN().singleZone(r, i);
        return E.asc(state.terrain, E.zoneRaster(codes), `${c.baseName}_zones${suffix}`);
      }
      E.asc(state.terrain, r[kind], `${c.baseName}_${kind}${suffix}`);
    } catch (e) { console.error(e); alert(t('err.generic') + ': ' + e.message); }
  }

  // ---------------------------------------------------------------------------
  function syncOverlays() {
    if (!mapView) return;
    const s = state.step, S = state.sim;
    mapView.setOverlayVisible('slope', s === 'terrain' && state.layers.slope);
    mapView.setOverlayVisible('pra', s === 'release' && state.release.showPra);
    mapView.setOverlayVisible('release', s !== 'terrain');
    mapView.setOverlayOpacity('release', s === 'run' ? 0.45 : 0.85);
    mapView.setOverlayVisible('result', (s === 'run' || s === 'report') && S.status === 'done');
    mapView.setOverlayVisible('sim', s === 'run' && S.status === 'running');
    mapView.setOverlayVisible('simPowder', s === 'run' && S.status === 'running');
    mapView.setOverlayVisible('forest', s === 'params' && state.params.forest);
    mapView.setPathVisible((s === 'run' || s === 'report') && S.status === 'done');
    renderLegend();
  }

  function updateCoords(ll) {
    const el = root && root.querySelector('#coords');
    if (!el) return;
    let s = `${ll.lat.toFixed(5)}° ${ll.lat >= 0 ? 'N' : 'S'}  ${ll.lng.toFixed(5)}° ${ll.lng >= 0 ? 'E' : 'W'}`;
    const tr = state.terrain;
    if (tr) {
      const i = SLS.raster.cellAt(tr, ll.lng, ll.lat);
      if (i >= 0 && !Number.isNaN(tr.data[i])) {
        s += `  ·  ${n(tr.data[i])} m  ·  ${n(state.slope[i], 1)}°`;
        const run = state.sim.status === 'done' ? viewRun() : null;
        if (run && run.result.hmax[i] >= 0.05) s += `  ·  h ${n(run.result.hmax[i], 1)} m · v ${n(run.result.vmax[i], 1)} m/s · p ${n(run.result.pmax[i], 0)} kPa`;
        if (state.sim.zoning && state.sim.zoning[i]) s += `  ·  ${t(['zone.none', 'zone.yellowM', 'zone.blueM', 'zone.redM'][state.sim.zoning[i]])}`;
      }
    }
    el.textContent = s;
  }

  // ---------------------------------------------------------------------------
  // Orman (ESA WorldCover)
  async function setForest(on, quiet) {
    state.lcError = null;
    if (on && !state.landcover) {
      state.lcBusy = true; if (!quiet) render();
      try {
        const classes = await SLS.landcover.fetchForTerrain(state.terrain);
        state.landcover = { classes, stats: SLS.landcover.stats(classes) };
        const tr = state.terrain;
        SLS.raster.paintMask(canvas('forest'), tr.width, tr.height, classes, [22, 128, 61], 150, (v) => v === SLS.landcover.FOREST);
        mapView.setOverlay('forest', canvas('forest'), state.corners, 0.75);
        mapView.refreshOverlay('forest');
      } catch (e) {
        console.error(e);
        state.lcError = t('lc.err');
        on = false;
      } finally {
        state.lcBusy = false;
      }
    }
    state.params.forest = on;
    if (!quiet) { invalidateSim(); render(); syncOverlays(); }
  }

  // ---------------------------------------------------------------------------
  function cellLonLat(i) {
    const tr = state.terrain, r = (i / tr.width) | 0, c = i - r * tr.width;
    return SLS.proj.converter(tr.epsg).inverse([tr.originX + (c + 0.5) * tr.cellSize, tr.originY - (r + 0.5) * tr.cellSize]);
  }

  // Arayüzdeki boykesit grafiği (koyu tema) + imleç
  const PROFILE_THEME = { bg: '#131a22', ink: '#e6edf3', ink2: '#a9b6c4', grid: '#233040', axis: '#3a4b60', line: '#5cc8ff', fill: 'rgba(169,182,196,0.16)', band: 'rgba(34,211,238,0.14)', ref: '#6c7d90', font: 'Inter, system-ui, sans-serif', fontSize: 11 };
  let profileLayout = null;
  function profileLabels() {
    return { z: t('prof.z'), v: t('prof.v'), p: t('prof.p'), dist: t('prof.dist'), release: t('legend.release'), ref3: '3 kPa', ref30: '30 kPa' };
  }
  function drawProfileUI(cv, hoverIdx) {
    const prof = viewRun().profile, w = cv.parentElement.clientWidth || 360, h = 330;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    profileLayout = SLS.figures.drawProfile(cv, prof, PROFILE_THEME, profileLabels(), w, h, window.devicePixelRatio || 1);
    if (hoverIdx != null) {
      const g = cv.getContext('2d'), x = Math.round(profileLayout.X(prof.d[hoverIdx])) + 0.5;
      g.strokeStyle = '#e6edf3'; g.lineWidth = 1;
      const L = profileLayout.panels;
      g.beginPath(); g.moveTo(x, L[0].top); g.lineTo(x, L[L.length - 1].bot); g.stroke();
      const vals = [prof.z[hoverIdx], prof.v[hoverIdx], prof.p[hoverIdx]];
      L.forEach((P, k) => {
        g.beginPath(); g.arc(x, P.Y(vals[k]), 4, 0, Math.PI * 2);
        g.fillStyle = k ? '#5cc8ff' : '#a9b6c4'; g.fill();
        g.lineWidth = 2; g.strokeStyle = '#131a22'; g.stroke();
      });
    }
  }
  function bindProfile(sb) {
    const cv = sb.querySelector('#profileCanvas');
    const run = state.sim.status === 'done' ? viewRun() : null;
    if (!cv || !run || !run.profile) return;
    drawProfileUI(cv, null);
    const tip = sb.querySelector('#profileTip'), prof = run.profile;
    const nearest = (x) => {
      const L = profileLayout, d = (x - L.ML) / (L.cssW - L.ML - L.MR) * L.dMax;
      let best = 0;
      for (let i = 1; i < prof.d.length; i++) if (Math.abs(prof.d[i] - d) < Math.abs(prof.d[best] - d)) best = i;
      return best;
    };
    cv.onmousemove = (e) => {
      const rect = cv.getBoundingClientRect(), x = e.clientX - rect.left;
      if (x < profileLayout.ML - 4) return;
      const i = nearest(x);
      drawProfileUI(cv, i);
      tip.innerHTML = `<b>${n(prof.d[i])} m</b><span>${esc(t('prof.z'))}</span><i>${n(prof.z[i])} m</i>` +
        `<span>${esc(t('prof.slope'))}</span><i>${n(prof.s[i], 1)}°</i>` +
        `<span>h_max</span><i>${n(prof.h[i], 1)} m</i><span>v_max</span><i>${n(prof.v[i], 1)} m/s</i><span>p_max</span><i>${n(prof.p[i])} kPa</i>` +
        (prof.pp[i] > 0 ? `<span>${esc(t('res.powder'))}</span><i>${n(prof.pp[i], 1)} kPa</i>` : '');
      tip.classList.remove('hidden');
      const px = profileLayout.X(prof.d[i]);
      tip.style.left = (px > rect.width / 2 ? px - tip.offsetWidth - 10 : px + 10) + 'px';
      mapView.setProbe(cellLonLat(prof.cells[i]));
    };
    cv.onmouseleave = () => { drawProfileUI(cv, null); tip.classList.add('hidden'); mapView.setProbe(null); };
  }

  // ---------------------------------------------------------------------------
  // 5) Rapor
  function reportPanel() {
    const Rp = state.report, M = Rp.meta;
    const field = (k, key, ph) => `
      <label class="field"><span>${esc(t(key))}</span>
        <input class="input" data-meta="${k}" value="${esc(M[k])}" placeholder="${esc(ph ? t(ph) : '')}"></label>`;
    return `
      <section class="section">
        <h2>${esc(t('rep.title'))}</h2>
        <p class="muted">${esc(t('rep.intro'))}</p>
        ${state.sim.incomplete ? `<div class="alert strong"><b>${esc(t('res.incompleteTitle'))}</b><br>${esc(t('rep.incompleteNote'))}</div>` : ''}
      </section>
      <section class="section">
        <h4>${esc(t('rep.info'))}</h4>
        <div class="stack">
          ${field('project', 'rep.project', 'rep.projectPh')}
          ${field('location', 'rep.location', 'rep.locationPh')}
          ${field('author', 'rep.author')}
          ${field('org', 'rep.org')}
          <label class="field"><span>${esc(t('rep.notes'))}</span>
            <textarea class="input textarea" data-meta="notes" rows="3">${esc(M.notes)}</textarea></label>
        </div>
      </section>
      <section class="section">
        <h4>${esc(t('rep.contents'))}</h4>
        <ol class="toc">${t('rep.toc').split('|').map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <button class="btn primary block" id="reportBtn" ${Rp.busy ? 'disabled' : ''}>${ICON.download}<span>${esc(t(Rp.busy ? 'rep.building' : 'rep.make'))}</span></button>
        <div class="progress ${Rp.busy ? '' : 'hidden'}"><div class="track"><div class="fill" id="repFill" style="width:${Math.round(Rp.progress * 100)}%"></div></div></div>
        ${Rp.error ? `<div class="alert">${esc(Rp.error)}</div>` : ''}
        ${Rp.done ? `<div class="ok-note">${esc(t('rep.done', { n: Rp.done.pages, no: Rp.done.reportNo }))}</div>` : ''}
        <p class="hint">${esc(t('rep.hint'))}</p>
      </section>`;
  }

  async function makeReport() {
    const Rp = state.report, S = state.sim;
    Rp.busy = true; Rp.error = null; Rp.progress = 0; Rp.done = null;
    render();
    const setP = (f) => { Rp.progress = f; const el = root.querySelector('#repFill'); if (el) el.style.width = Math.round(f * 100) + '%'; };
    try {
      await new Promise((r) => setTimeout(r, 30));
      const tr = state.terrain, pr = primaryRun();
      const out = await SLS.avalancheReport.build(Object.assign(exportCtx(), {
        slope: state.slope, aspect: state.aspect,
        release: { mask: state.release.mask, stats: pr.release, d0: pr.scenario.d0 },
        params: Object.assign({}, state.params, pr.params, { T: pr.scenario.T }),
        result: pr.result, analysis: pr.analysis, profile: pr.profile,
        landcover: state.params.forest && state.landcover ? { used: true, forestFraction: state.landcover.stats.forestFraction } : { used: false },
        field: state.field, wind: state.wind,
        incompleteReason: S.incompleteReason,
        meta: Rp.meta,
        sourceName: t('src.' + tr.source.id) + (tr.source.fileName ? ' · ' + tr.source.fileName : ''),
        onProgress: setP,
      }));
      SLS.avExport.download(out.blob, out.fileName);
      Rp.done = { pages: out.pages, reportNo: out.reportNo, fileName: out.fileName, size: out.blob.size };
      SLS.lastReport = out; // otomasyon / test
    } catch (e) {
      console.error(e);
      Rp.error = t('rep.err') + (e && e.message ? ' (' + e.message + ')' : '');
    } finally {
      Rp.busy = false;
      render();
    }
  }

  SLS.modules = SLS.modules || {};
  SLS.modules.avalanche = {
    mount, unmount,
    onLang: () => state && render(),
    // Test ve otomasyon için
    _state: () => state,
    _selectPra: (lng, lat) => onMapClick({ lng, lat }),
    _applyProfile: (pr) => applyProfile(pr),
    _importKml: (file, purpose) => importKml(file, purpose),
  };
})(window.SLS = window.SLS || {});
