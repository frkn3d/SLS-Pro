/* SLS Pro — Çığ modülü çalışma alanı
 * Adımlar: 1) Arazi  2) Kopma alanı  3) Parametreler  4) Simülasyon  5) Rapor (sonraki sürüm)
 */
(function (SLS) {
  'use strict';

  const t = (k, v) => SLS.i18n.t(k, v);
  const n = (v, d) => SLS.i18n.number(v, d);
  const pct = (f) => (SLS.i18n.lang === 'tr' ? '%' + n(f * 100, 1) : n(f * 100, 1) + '%');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STEPS = [
    { id: 'terrain', key: 'ws.step.terrain' },
    { id: 'release', key: 'ws.step.release' },
    { id: 'params', key: 'ws.step.params' },
    { id: 'run', key: 'ws.step.run' },
    { id: 'report', key: 'ws.step.report', locked: true },
  ];
  const CELL_SIZES = [5, 10, 20, 30, 50];
  const D0_OPTIONS = [0.5, 1, 1.5, 2, 2.5];
  const PRA = { minSlope: 28, maxSlope: 55, minArea: 2000 };   // potansiyel kopma alanı ölçütleri
  const POLY_SLOPE = { min: 25, max: 60 };                      // elle çizilen alanda kopabilir eğim
  const AFFECTED_H = 0.1;                                       // etkilenen alan eşiği (m)
  // Senaryo ön ayarları: İsviçre kılavuzu / RAMMS yaygın aralıklarından başlangıç değerleri
  const PRESETS = {
    small: { mu: 0.25, xi: 1000 },
    medium: { mu: 0.2, xi: 1500 },
    large: { mu: 0.16, xi: 2500 },
  };
  const RESULT_LAYERS = [
    { id: 'hmax', ramp: 'height', key: 'res.hmax' },
    { id: 'vmax', ramp: 'velocity', key: 'res.vmax' },
    { id: 'pmax', ramp: 'pressure', key: 'res.pmax' },
    { id: 'hfinal', ramp: 'height', key: 'res.hfinal' },
    { id: 'zones', ramp: 'zones', key: 'res.zones' },
  ];

  const ICON = {
    draw: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 3"/><path d="M4 4h4M4 4v4"/></svg>',
    poly: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18 4 8l8-5 8 6-3 10z"/><circle cx="4" cy="8" r="1.4"/><circle cx="12" cy="3" r="1.4"/><circle cx="20" cy="9" r="1.4"/></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
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
      serverOk: false,
      layers: { slope: true, hillshade: true, terrain3d: false },
      basemap: 'topo',
      gotoText: '',
      pra: null,
      release: freshRelease(),
      params: { preset: 'medium', mu: 0.2, xi: 1500, rho: 300, cd: 2, tMax: 300 },
      sim: freshSim(),
    };
  }
  function freshRelease() {
    return { polys: [], selected: new Set(), d0: 1, showPra: true, drawingPoly: false, mask: null, h0: null, stats: null };
  }
  function freshSim() {
    return { status: 'idle', worker: null, live: null, result: null, analysis: null, layer: 'hmax', error: null };
  }

  // Tuval nesneleri (harita bindirmeleri için tekrar kullanılır)
  const canvases = {};
  const canvas = (id) => canvases[id] || (canvases[id] = document.createElement('canvas'));

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
  // Adım erişimi
  function releaseCount() { return state.release.stats ? state.release.stats.cells : 0; }
  function stepAvailable(id) {
    if (id === 'terrain') return true;
    if (id === 'release') return !!state.terrain;
    if (id === 'params' || id === 'run') return !!state.terrain && releaseCount() > 0;
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
    const panel = { terrain: terrainPanel, release: releasePanel, params: paramsPanel, run: runPanel }[state.step]();

    sb.innerHTML = `
      <nav class="stepper" aria-label="steps">
        ${STEPS.map((s, i) => {
          const avail = stepAvailable(s.id);
          const cls = [s.id === state.step ? 'current' : '', i < idx && avail ? 'done' : '', s.locked ? 'locked' : '', avail ? 'avail' : ''].join(' ');
          return `<button type="button" class="step ${cls}" data-step="${s.id}" ${avail ? '' : 'disabled'} title="${s.locked ? esc(t('ws.step.locked')) : ''}">
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
            <li>OpenTopoMap (CC-BY-SA) · OpenStreetMap contributors (ODbL)</li>
            <li>Sentinel-2 cloudless 2016 by EOX IT Services GmbH (CC BY 4.0)</li>
            <li>MapLibre GL JS (BSD-3) · proj4js (MIT) · geotiff.js (MIT)</li>
          </ul>
        </details>
      </footer>`;

    sb.scrollTop = scroll;
    bind(sb);
    renderLegend();
  }

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
    const R = state.release, st = R.stats, P = state.pra;
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
        <p class="hint">${esc(t('rel.polyHint', { a: POLY_SLOPE.min, b: POLY_SLOPE.max }))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('rel.d0'))}</h4>
        <div class="seg">
          ${D0_OPTIONS.map((d) => `<button type="button" data-d0="${d}" class="${d === R.d0 ? 'sel' : ''}">${n(d, 1)} m</button>`).join('')}
        </div>
        <p class="hint">${esc(t('rel.d0Hint'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('rel.summary'))}</h4>
        ${st && st.cells ? `
          <div class="stats">
            <div class="stat"><div class="k">${esc(t('rel.area'))}</div><div class="v">${n(st.area)}<small>m²</small></div></div>
            <div class="stat"><div class="k">${esc(t('rel.volume'))}</div><div class="v">${n(st.volume)}<small>m³</small></div></div>
            <div class="stat"><div class="k">${esc(t('rel.meanSlope'))}</div><div class="v">${n(st.meanSlope, 1)}<small>°</small></div></div>
            <div class="stat"><div class="k">${esc(t('rel.elev'))}</div><div class="v">${n(st.zmin)}–${n(st.zmax)}<small>m</small></div></div>
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

  function paramsPanel() {
    const P = state.params;
    return `
      <section class="section">
        <h2>${esc(t('par.title'))}</h2>
        <p class="muted">${esc(t('par.intro'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('par.scenario'))}</h4>
        <div class="seg seg-wrap">
          ${['small', 'medium', 'large'].map((k) => `<button type="button" data-preset="${k}" class="${P.preset === k ? 'sel' : ''}">${esc(t('par.' + k))}</button>`).join('')}
        </div>
        <p class="hint">${esc(t(P.preset === 'custom' ? 'par.customHint' : 'par.' + P.preset + 'Hint'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('par.friction'))}</h4>
        ${slider('mu', 'par.mu', 0.08, 0.5, 0.01, P.mu, 2, '')}
        ${slider('xi', 'par.xi', 200, 5000, 100, P.xi, 0, 'm/s²')}
        <p class="hint">${esc(t('par.frictionHint'))}</p>
      </section>
      <section class="section">
        <h4>${esc(t('par.flow'))}</h4>
        ${slider('rho', 'par.rho', 150, 500, 10, P.rho, 0, 'kg/m³')}
        ${slider('cd', 'par.cd', 1, 2, 0.1, P.cd, 1, '')}
        ${slider('tMax', 'par.tMax', 60, 900, 30, P.tMax, 0, 's')}
        <p class="hint">${esc(t('par.flowHint'))}</p>
        <div style="margin-top:12px"><button class="btn primary block" data-goto="run">${esc(t('par.next'))} ${ICON.arrow}</button></div>
      </section>`;
  }

  // ---------- 4) Simülasyon ----------
  function runPanel() {
    const S = state.sim, R = state.release.stats, P = state.params, tr = state.terrain;
    const running = S.status === 'running';
    const L = S.live;
    let body = '';
    if (running || (S.status !== 'done' && L)) {
      body = `
        <section class="section">
          <h4>${esc(t('run.live'))}</h4>
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
          <dt>${esc(t('rel.volume'))}</dt><dd>${n(R.volume)} m³</dd>
          <dt>${esc(t('rel.area'))}</dt><dd>${n(R.area)} m²</dd>
          <dt>μ / ξ</dt><dd>${n(P.mu, 2)} / ${n(P.xi)} m/s²</dd>
          <dt>${esc(t('terrain.grid'))}</dt><dd>${n(tr.width)} × ${n(tr.height)} · ${n(tr.cellSize)} m</dd>
        </dl>
        <div style="margin-top:14px">
          ${running
            ? `<button class="btn danger block" id="stopBtn">${ICON.stop}<span>${esc(t('run.stop'))}</span></button>`
            : `<button class="btn primary block" id="runBtn">${ICON.play}<span>${esc(t(S.status === 'done' ? 'run.rerun' : 'run.start'))}</span></button>`}
        </div>
        ${S.error ? `<div class="alert">${esc(S.error)}</div>` : ''}
      </section>
      ${body}`;
  }

  function resultsPanel() {
    const S = state.sim, A = S.analysis;
    const stopKey = { momentum: 'run.reason.momentum', tmax: 'run.reason.tmax', user: 'run.reason.user', stopped: 'run.reason.momentum', empty: 'run.reason.empty' }[A.reason] || 'run.reason.momentum';
    return `
      <section class="section">
        <h4>${esc(t('res.title'))}</h4>
        <div class="seg seg-wrap" role="radiogroup">
          ${RESULT_LAYERS.map((l) => `<button type="button" data-rlayer="${l.id}" class="${S.layer === l.id ? 'sel' : ''}">${esc(t(l.key))}</button>`).join('')}
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
        </div>
        <h4 style="margin-top:16px">${esc(t('res.zonesTitle'))}</h4>
        <div class="zones">
          <div><span class="sw" style="background:#dc2626"></span>${esc(t('zone.red'))}<b class="mono">${n(A.zoneHa[2], 1)} ha</b></div>
          <div><span class="sw" style="background:#2563eb"></span>${esc(t('zone.blue'))}<b class="mono">${n(A.zoneHa[1], 1)} ha</b></div>
          <div><span class="sw" style="background:#facc15"></span>${esc(t('zone.yellow'))}<b class="mono">${n(A.zoneHa[0], 1)} ha</b></div>
        </div>
        <p class="hint">${esc(t('res.zonesHint'))}</p>
        <dl class="kv">
          <dt>${esc(t('res.stop'))}</dt><dd style="font-family:var(--font)">${esc(t(stopKey))}</dd>
          <dt>${esc(t('res.deposit'))}</dt><dd>${n(A.deposit)} m³</dd>
          <dt>${esc(t('res.mass'))}</dt><dd>${n(Math.abs(A.massErr) * 100, 4)} %</dd>
          <dt>${esc(t('res.compute'))}</dt><dd>${n(A.wallMs / 1000, 1)} s · ${n(A.steps)} ${esc(t('res.steps'))}</dd>
        </dl>
        ${A.outflow > 0.01 * A.release ? `<div class="alert">${esc(t('res.outflowWarn', { p: pct(A.outflow / A.release) }))}</div>` : ''}
        ${A.reason === 'tmax' ? `<div class="alert">${esc(t('res.tmaxWarn'))}</div>` : ''}
      </section>
      <section class="section">
        <h4>${esc(t('result.export'))}</h4>
        <div class="stack">
          <button class="btn block" data-exp="hmax">${ICON.download}<span>h_max (.asc)</span></button>
          <button class="btn block" data-exp="vmax">${ICON.download}<span>v_max (.asc)</span></button>
          <button class="btn block" data-exp="pmax">${ICON.download}<span>p_max (.asc)</span></button>
          <button class="btn block" data-exp="zones">${ICON.download}<span>${esc(t('res.zones'))} (.asc)</span></button>
          <button class="btn block" data-exp="summary">${ICON.download}<span>${esc(t('res.summaryJson'))}</span></button>
          <button class="btn primary block" disabled>${esc(t('res.report'))}</button>
          <p class="hint" style="margin:0">${esc(t('res.reportSoon'))}</p>
        </div>
      </section>`;
  }

  // ---------- Katmanlar ----------
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
        ${state.step === 'release' && state.release.showPra ? `<div class="li"><span class="sw" style="background:#a78bfa"></span>${esc(t('legend.pra'))}</div>` : ''}`;
    } else if (state.step === 'run' && (S.status === 'running' || (S.live && S.status !== 'done'))) {
      html = legendHtml(t('legend.flowH'), SLS.raster.RAMPS.height.classes, rangeLabel);
    } else if (state.step === 'run' && S.status === 'done') {
      const L = RESULT_LAYERS.find((l) => l.id === S.layer);
      const ramp = SLS.raster.RAMPS[L.ramp];
      html = legendHtml(`${t(L.key)}${L.ramp === 'zones' ? '' : ' (' + ramp.unit + ')'}`, ramp.classes, rangeLabel);
    }
    lg.classList.toggle('hidden', !html);
    lg.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  function bind(sb) {
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
      renderLegend();
    });

    // Arazi adımı
    const drawBtn = sb.querySelector('#drawBtn');
    if (drawBtn) drawBtn.onclick = () => {
      if (state.drawing) { mapView.stopDraw(); render(); return; }
      state.drawing = true;
      root.querySelector('#mapWrap').classList.add('drawing');
      hint(t('terrain.drawing'));
      mapView.startDraw((b) => {
        if (b) { state.bbox = b; state.error = null; }
        mapView.setAoi(state.bbox);
        render();
      });
      render();
    };
    const clearBtn = sb.querySelector('#clearBtn');
    if (clearBtn) clearBtn.onclick = () => { state.bbox = null; mapView.setAoi(null); render(); };
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
      drop.ondrop = (e) => {
        e.preventDefault(); drop.classList.remove('over');
        const f = e.dataTransfer.files[0];
        if (f) { state.file = f; state.error = null; render(); }
      };
    }
    const fetchBtn = sb.querySelector('#fetchBtn');
    if (fetchBtn) fetchBtn.onclick = runFetch;
    const expAsc = sb.querySelector('#expAsc');
    if (expAsc) {
      const base = `sls_dem_${state.terrain.epsg}_${state.terrain.cellSize}m`;
      expAsc.onclick = () => SLS.terrain.exportAsc(state.terrain, base);
      sb.querySelector('#expJson').onclick = () => SLS.terrain.exportJson(state.terrain, state.stats, base);
    }

    // Kopma alanı adımı
    const praToggle = sb.querySelector('#praToggle');
    if (praToggle) praToggle.onchange = () => { state.release.showPra = praToggle.checked; syncOverlays(); renderLegend(); };
    const polyBtn = sb.querySelector('#polyBtn');
    if (polyBtn) polyBtn.onclick = () => {
      if (state.release.drawingPoly) { mapView.finishPolygon(); return; }
      state.release.drawingPoly = true;
      hint(t('rel.polyDrawing'));
      mapView.startPolygon((ring) => {
        state.release.drawingPoly = false;
        hint(null);
        if (ring) { state.release.polys.push(ring); updateRelease(); }
        render();
      });
      render();
    };
    const relClear = sb.querySelector('#relClear');
    if (relClear) relClear.onclick = () => {
      state.release.polys = []; state.release.selected.clear();
      updateRelease(); render();
    };
    sb.querySelectorAll('[data-d0]').forEach((b) => b.onclick = () => { state.release.d0 = Number(b.dataset.d0); updateRelease(); render(); });

    // Parametreler
    sb.querySelectorAll('[data-preset]').forEach((b) => b.onclick = () => {
      const k = b.dataset.preset;
      Object.assign(state.params, PRESETS[k], { preset: k });
      invalidateSim(); render();
    });
    sb.querySelectorAll('[data-param]').forEach((inp) => {
      const id = inp.dataset.param, dg = Number(inp.dataset.digits), unit = inp.dataset.unit;
      inp.oninput = () => { sb.querySelector('#v_' + id).textContent = n(Number(inp.value), dg) + (unit ? ' ' + unit : ''); };
      inp.onchange = () => {
        state.params[id] = Number(inp.value);
        if (id === 'mu' || id === 'xi') {
          const match = Object.keys(PRESETS).find((k) => PRESETS[k].mu === state.params.mu && PRESETS[k].xi === state.params.xi);
          state.params.preset = match || 'custom';
        }
        invalidateSim(); render();
      };
    });

    // Simülasyon
    const runBtn = sb.querySelector('#runBtn');
    if (runBtn) runBtn.onclick = startSim;
    const stopBtn = sb.querySelector('#stopBtn');
    if (stopBtn) stopBtn.onclick = () => { if (state.sim.worker) state.sim.worker.postMessage({ type: 'stop' }); stopBtn.disabled = true; };
    sb.querySelectorAll('[data-rlayer]').forEach((b) => b.onclick = () => { state.sim.layer = b.dataset.rlayer; paintResult(); render(); });
    sb.querySelectorAll('[data-exp]').forEach((b) => b.onclick = () => exportResult(b.dataset.exp));
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
      const { slope, aspect } = SLS.terrain.slopeAspect(terrain);
      const stats = SLS.terrain.stats(terrain, slope);
      stopWorker();
      Object.assign(state, { terrain, stats, slope, aspect, release: freshRelease(), sim: freshSim() });
      SLS.currentTerrain = terrain;
      state.corners = SLS.terrain.cornersWgs84(terrain);
      ['slope', 'pra', 'release', 'result', 'sim'].forEach((id) => mapView.removeOverlay(id));
      computePra();
      updateRelease();
      SLS.raster.paint(canvas('slope'), terrain.width, terrain.height, slope, SLS.terrain.SLOPE_CLASSES, 200);
      mapView.setOverlay('slope', canvas('slope'), state.corners, 0.72);
      mapView.refreshOverlay('slope');
      mapView.setExtent(state.corners);
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

  function updateRelease() {
    const tr = state.terrain, R = state.release, s = state.slope;
    if (!tr) return;
    const N = tr.width * tr.height;
    const mask = new Uint8Array(N);
    if (R.selected.size) {
      const L = state.pra.labels;
      for (let i = 0; i < N; i++) if (L[i] && R.selected.has(L[i])) mask[i] = 1;
    }
    for (const ring of R.polys) {
      SLS.raster.rasterizePolygon(tr, ring, (i) => { if (s[i] >= POLY_SLOPE.min && s[i] <= POLY_SLOPE.max) mask[i] = 1; });
    }
    const h0 = new Float32Array(N);
    let cells = 0, vol = 0, sl = 0, zmin = Infinity, zmax = -Infinity;
    const a = tr.cellSize * tr.cellSize;
    for (let i = 0; i < N; i++) {
      if (!mask[i] || Number.isNaN(tr.data[i])) { mask[i] = 0; continue; }
      const hv = R.d0 / Math.cos(s[i] * Math.PI / 180);   // eğime dik kalınlık → düşey yükseklik
      h0[i] = hv; cells++; vol += hv * a; sl += s[i];
      if (tr.data[i] < zmin) zmin = tr.data[i];
      if (tr.data[i] > zmax) zmax = tr.data[i];
    }
    R.mask = mask; R.h0 = h0;
    R.stats = { cells, area: cells * a, volume: vol, meanSlope: cells ? sl / cells : 0, zmin, zmax };
    SLS.raster.paintMask(canvas('release'), tr.width, tr.height, mask, [34, 211, 238], 210);
    if (!mapView.map.getSource('release')) mapView.setOverlay('release', canvas('release'), state.corners, 0.85);
    mapView.refreshOverlay('release');
    mapView.setPolygons(R.polys);
    invalidateSim();
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
    if (state.sim.status === 'running') return;
    if (state.sim.status === 'done' || state.sim.live) {
      state.sim = freshSim();
      mapView.removeOverlay('result');
      mapView.removeOverlay('sim');
    }
  }

  function stopWorker() {
    if (state && state.sim && state.sim.worker) { state.sim.worker.terminate(); state.sim.worker = null; }
  }

  function startSim() {
    const tr = state.terrain, R = state.release;
    stopWorker();
    mapView.removeOverlay('result');
    state.sim = Object.assign(freshSim(), { status: 'running', layer: state.sim.layer });
    let worker;
    try {
      worker = new Worker('js/sim/voellmy-worker.js');
    } catch (e) {
      state.sim.status = 'error';
      state.sim.error = t('run.workerErr');
      render();
      return;
    }
    state.sim.worker = worker;
    const W = tr.width, H = tr.height;
    const simCanvas = canvas('sim');
    simCanvas.width = W; simCanvas.height = H;
    mapView.setOverlay('sim', simCanvas, state.corners, 0.9);
    syncOverlays();
    const heights = SLS.raster.RAMPS.height.classes;

    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'frame') {
        state.sim.live = Object.assign({}, m.status, { wallMs: m.wallMs });
        SLS.raster.paint(simCanvas, W, H, m.h, heights, 230);
        mapView.refreshOverlay('sim');
        updateLive();
      } else if (m.type === 'done') {
        worker.terminate();
        state.sim.worker = null;
        state.sim.status = 'done';
        state.sim.result = m;
        state.sim.analysis = analyze(m);
        mapView.removeOverlay('sim');
        paintResult();
        mapView.setOverlay('result', canvas('result'), state.corners, 0.85);
        mapView.refreshOverlay('result');
        render();
        syncOverlays();
      } else if (m.type === 'error') {
        worker.terminate();
        state.sim.worker = null;
        state.sim.status = 'error';
        state.sim.error = m.message;
        render();
      }
    };
    worker.onerror = (e) => {
      state.sim.status = 'error';
      state.sim.error = (location.protocol === 'file:' ? t('run.workerErr') : (e.message || t('err.generic')));
      render();
    };

    const z = new Float32Array(tr.data);
    const h0 = new Float32Array(R.h0);
    const P = state.params;
    worker.postMessage({
      type: 'start', width: W, height: H, dx: tr.cellSize, z, h0,
      params: { mu: P.mu, xi: P.xi, rho: P.rho, cd: P.cd, tMax: P.tMax },
    }, [z.buffer, h0.buffer]);
    render();
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

  /** Kaçış mesafesi, α açısı, etkilenen alan, bölge alanları, kütle dengesi. */
  function analyze(res) {
    const tr = state.terrain, R = state.release, W = tr.width, N = W * tr.height, cs = tr.cellSize;
    const z = tr.data, st = res.status;
    let iTop = -1;
    for (let i = 0; i < N; i++) if (R.mask[i] && (iTop < 0 || z[i] > z[iTop])) iTop = i;
    const rT = (iTop / W) | 0, cT = iTop - rT * W;
    let best = 0, iTip = iTop, affected = 0, hmax = 0, vmax = 0, pmax = 0;
    const zoneCells = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      if (res.hmax[i] > hmax) hmax = res.hmax[i];
      if (res.vmax[i] > vmax) vmax = res.vmax[i];
      if (res.pmax[i] > pmax) pmax = res.pmax[i];
      if (res.hmax[i] < AFFECTED_H) continue;
      affected++;
      const p = res.pmax[i];
      zoneCells[p >= 30 ? 2 : p >= 3 ? 1 : 0]++;
      const r = (i / W) | 0, c = i - r * W;
      const d2 = (r - rT) * (r - rT) + (c - cT) * (c - cT);
      if (d2 > best) { best = d2; iTip = i; }
    }
    const runout = Math.sqrt(best) * cs;
    const drop = z[iTop] - z[iTip];
    const ha = cs * cs / 10000;
    return {
      runout, drop, alpha: runout > 0 ? Math.atan(drop / runout) * 180 / Math.PI : 0,
      iTop, iTip, hmax, vmax, pmax,
      affectedHa: affected * ha, zoneHa: zoneCells.map((x) => x * ha),
      release: st.releaseVolume, deposit: st.depositVolume, outflow: st.outflow,
      massErr: (st.releaseVolume - st.depositVolume - st.outflow - st.clipped) / st.releaseVolume,
      t: st.t, steps: st.steps, wallMs: st.wallMs, reason: st.reason,
    };
  }

  function paintResult() {
    const S = state.sim, tr = state.terrain;
    if (S.status !== 'done') return;
    const r = S.result, W = tr.width, H = tr.height;
    const L = RESULT_LAYERS.find((l) => l.id === S.layer);
    const classes = SLS.raster.RAMPS[L.ramp].classes;
    const values = L.id === 'zones' ? r.pmax : r[L.id];
    const mask = L.id === 'hfinal' ? null : (i) => r.hmax[i] >= (L.id === 'zones' ? AFFECTED_H : 0.05);
    SLS.raster.paint(canvas('result'), W, H, values, classes, 215, mask);
    mapView.refreshOverlay('result');
    renderLegend();
  }

  function exportResult(kind) {
    const tr = state.terrain, S = state.sim, A = S.analysis;
    const base = `sls_avalanche_${tr.epsg}_${tr.cellSize}m`;
    if (kind === 'summary') {
      const meta = SLS.terrain.metadata(tr, state.stats);
      const P = state.params, R = state.release.stats;
      const sum = {
        format: 'sls-avalanche-result', version: 1, generator: 'SLS Pro ' + SLS.VERSION, created: new Date().toISOString(),
        model: 'Voellmy-Salm, depth-averaged shallow flow, first-order finite volume (HLL)',
        grid: { origin_x: meta.origin_x, origin_y: meta.origin_y, cell_size: meta.cell_size, width: meta.width, height: meta.height, epsg: meta.epsg, crs_name: meta.crs_name },
        terrain_source: tr.source, attribution: tr.attribution,
        release: { area_m2: R.area, volume_m3: R.volume, fracture_depth_m: state.release.d0, mean_slope_deg: R.meanSlope, elevation_m: [R.zmin, R.zmax] },
        parameters: { mu: P.mu, xi: P.xi, density: P.rho, cd: P.cd, t_max_s: P.tMax, scenario: P.preset },
        results: {
          max_velocity_ms: A.vmax, max_pressure_kpa: A.pmax, max_flow_height_m: A.hmax,
          runout_m: A.runout, drop_m: A.drop, alpha_deg: A.alpha, affected_ha: A.affectedHa,
          zones_ha: { red: A.zoneHa[2], blue: A.zoneHa[1], yellow: A.zoneHa[0] },
          deposit_m3: A.deposit, outflow_m3: A.outflow, mass_error: A.massErr,
          simulated_time_s: A.t, steps: A.steps, stop_reason: A.reason,
        },
      };
      const blob = new Blob([JSON.stringify(sum, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = base + '_summary.json';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return;
    }
    let data = S.result[kind];
    if (kind === 'zones') {
      data = new Float32Array(S.result.pmax.length);
      for (let i = 0; i < data.length; i++) {
        if (S.result.hmax[i] < AFFECTED_H) { data[i] = NaN; continue; }
        const p = S.result.pmax[i];
        data[i] = p >= 30 ? 3 : p >= 3 ? 2 : 1;            // 3 kırmızı, 2 mavi, 1 sarı
      }
    }
    SLS.terrain.exportAsc(Object.assign({}, tr, { data }), `${base}_${kind}`);
  }

  // ---------------------------------------------------------------------------
  function syncOverlays() {
    if (!mapView) return;
    const s = state.step, S = state.sim;
    mapView.setOverlayVisible('slope', s === 'terrain' && state.layers.slope);
    mapView.setOverlayVisible('pra', s === 'release' && state.release.showPra);
    mapView.setOverlayVisible('release', s !== 'terrain');
    mapView.setOverlayOpacity('release', s === 'run' ? 0.45 : 0.85);
    mapView.setOverlayVisible('result', s === 'run' && S.status === 'done');
    mapView.setOverlayVisible('sim', s === 'run' && S.status !== 'done');
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
        const r = state.sim.status === 'done' ? state.sim.result : null;
        if (r && r.hmax[i] >= 0.05) s += `  ·  h ${n(r.hmax[i], 1)} m · v ${n(r.vmax[i], 1)} m/s · p ${n(r.pmax[i], 0)} kPa`;
      }
    }
    el.textContent = s;
  }

  SLS.modules = SLS.modules || {};
  SLS.modules.avalanche = {
    mount, unmount,
    onLang: () => state && render(),
    // Test ve otomasyon için
    _state: () => state,
    _selectPra: (lng, lat) => onMapClick({ lng, lat }),
  };
})(window.SLS = window.SLS || {});
