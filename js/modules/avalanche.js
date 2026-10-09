/* SLS Pro — Çığ modülü çalışma alanı
 * Faz 1: Arazi edinimi (bu dosya). Sonraki adımlar (kopma alanı, parametreler,
 * Voellmy-Salm çözücü, rapor) aynı arazi nesnesini girdi olarak kullanacak.
 */
(function (SLS) {
  'use strict';

  const t = (k, v) => SLS.i18n.t(k, v);
  const n = (v, d) => SLS.i18n.number(v, d);
  const pct = (f) => (SLS.i18n.lang === 'tr' ? '%' + n(f * 100, 1) : n(f * 100, 1) + '%');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STEPS = [
    { id: 'terrain', key: 'ws.step.terrain' },
    { id: 'release', key: 'ws.step.release', locked: true },
    { id: 'params', key: 'ws.step.params', locked: true },
    { id: 'run', key: 'ws.step.run', locked: true },
    { id: 'report', key: 'ws.step.report', locked: true },
  ];
  const CELL_SIZES = [5, 10, 20, 30, 50];

  const ICON = {
    draw: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 3"/><path d="M4 4h4M4 4v4"/></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
    terrain: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20l6-10 4 6 3-4 5 8z"/></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };

  let root, mapView, state;

  function initialState() {
    return {
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
    };
  }

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
      onDrawEnd: () => {
        state.drawing = false;
        root.querySelector('#mapWrap').classList.remove('drawing');
        root.querySelector('#mapHint').classList.add('hidden');
      },
    });
    render();
    SLS.sources.serverAvailable().then((ok) => { state.serverOk = ok; render(); });
  }

  function unmount() {
    if (mapView) mapView.destroy();
    mapView = null;
    root.innerHTML = '';
  }

  // ---------------------------------------------------------------------------
  function gridPlan() {
    if (state.source === 'file' || !state.bbox) return null;
    return SLS.terrain.planGrid(state.bbox, state.cellSize);
  }

  function render() {
    const sb = root.querySelector('#sidebar');
    const scroll = sb.scrollTop;
    const plan = gridPlan();
    const canFetch = !state.busy && (state.source === 'file' ? !!state.file : !!state.bbox && plan && !plan.tooBig);

    sb.innerHTML = `
      <nav class="stepper" aria-label="steps">
        ${STEPS.map((s) => `
          <div class="step ${s.id === 'terrain' ? 'current' : ''} ${s.locked ? 'locked' : ''}" title="${s.locked ? esc(t('ws.step.locked')) : ''}">
            <span class="bar"></span><span class="lbl">${esc(t(s.key))}</span>
          </div>`).join('')}
      </nav>

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

      ${state.terrain ? resultSection() : ''}

      <section class="section">
        <h4>${esc(t('result.layers'))}</h4>
        <div class="seg" style="margin-bottom:10px">
          <button type="button" data-basemap="topo" class="${state.basemap === 'topo' ? 'sel' : ''}">${esc(t('basemap.topo'))}</button>
          <button type="button" data-basemap="sat" class="${state.basemap === 'sat' ? 'sel' : ''}">${esc(t('basemap.sat'))}</button>
        </div>
        <div class="toggles">
          ${state.terrain ? toggle('slope', 'layer.slope') : ''}
          ${toggle('hillshade', 'layer.hillshade')}
          ${toggle('terrain3d', 'layer.terrain3d')}
        </div>
      </section>

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

  function resultSection() {
    const tr = state.terrain, st = state.stats;
    const d = SLS.proj.describe(tr.epsg);
    const labels = ['0–15°', '15–30°', '30–45°', '45–60°', '60°+'];
    const srcName = t('src.' + tr.source.id) + (tr.source.fileName ? ' · ' + tr.source.fileName : '');
    return `
      <section class="section">
        <h4>${esc(t('result.title'))}</h4>
        <div class="stats">
          <div class="stat wide"><div class="k">${esc(t('result.source'))}</div><div class="v" style="font-family:var(--font);font-size:13px">${esc(srcName)}</div></div>
          <div class="stat"><div class="k">${esc(t('result.elev'))}</div><div class="v">${n(st.min)}–${n(st.max)}<small>m</small></div></div>
          <div class="stat"><div class="k">${esc(t('result.relief'))}</div><div class="v">${n(st.max - st.min)}<small>m</small></div></div>
          <div class="stat"><div class="k">${esc(t('result.dims'))}</div><div class="v">${n(tr.width)}×${n(tr.height)}</div></div>
          <div class="stat"><div class="k">${esc(t('result.cell'))}</div><div class="v">${n(tr.cellSize, tr.cellSize < 1 ? 2 : 0)}<small>m</small></div></div>
          <div class="stat wide"><div class="k">${esc(t('result.crs'))}</div><div class="v" style="font-size:13px">EPSG:${tr.epsg} · ${esc(d ? d.name : '')}</div></div>
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
          <button class="btn primary block" disabled title="${esc(t('export.nextLocked'))}">${esc(t('export.next'))} ${ICON.arrow}</button>
          <p class="hint" style="margin:0">${esc(t('export.nextLocked'))}</p>
        </div>
      </section>`;
  }

  function toggle(id, key) {
    return `
      <label class="toggle"><span>${esc(t(key))}</span>
        <span class="switch"><input type="checkbox" data-layer="${id}" ${state.layers[id] ? 'checked' : ''}><span></span></span>
      </label>`;
  }

  function renderLegend() {
    const lg = root.querySelector('#legend');
    const show = state.terrain && state.layers.slope;
    lg.classList.toggle('hidden', !show);
    if (!show) return;
    lg.innerHTML = `<h5>${esc(t('legend.slope'))}</h5>` + SLS.terrain.SLOPE_CLASSES.map((c) =>
      `<div class="li"><span class="sw" style="background:rgb(${c.color.join(',')})"></span>${c.min}°${c.max >= 90 ? '+' : '–' + c.max + '°'}</div>`).join('');
  }

  // ---------------------------------------------------------------------------
  function bind(sb) {
    sb.querySelectorAll('[data-src]').forEach((b) => b.onclick = () => {
      state.source = b.dataset.src; state.error = null; render();
    });
    sb.querySelectorAll('[data-cell]').forEach((b) => b.onclick = () => {
      state.cellSize = Number(b.dataset.cell); render();
    });
    sb.querySelectorAll('[data-basemap]').forEach((b) => b.onclick = () => {
      state.basemap = b.dataset.basemap; mapView.setBasemap(state.basemap); render();
    });
    sb.querySelectorAll('[data-layer]').forEach((inp) => inp.onchange = () => {
      const id = inp.dataset.layer;
      state.layers[id] = inp.checked;
      if (id === 'slope') mapView.setSlopeVisible(inp.checked);
      if (id === 'hillshade') mapView.setHillshade(inp.checked);
      if (id === 'terrain3d') mapView.set3D(inp.checked);
      renderLegend();
    });

    const drawBtn = sb.querySelector('#drawBtn');
    if (drawBtn) drawBtn.onclick = () => {
      if (state.drawing) { mapView.stopDraw(); render(); return; }
      state.drawing = true;
      root.querySelector('#mapWrap').classList.add('drawing');
      const hint = root.querySelector('#mapHint');
      hint.textContent = t('terrain.drawing');
      hint.classList.remove('hidden');
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
    const doGoto = () => {
      state.gotoText = gotoInput.value;
      const m = gotoInput.value.replace(/[°NEne]/g, '').split(/[\s,;]+/).filter(Boolean).map(Number);
      if (m.length >= 2 && m.every(Number.isFinite) && Math.abs(m[0]) <= 90 && Math.abs(m[1]) <= 180) mapView.flyTo(m[1], m[0]);
    };
    if (gotoInput) {
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

    sb.querySelector('#fetchBtn').onclick = runFetch;
    const expAsc = sb.querySelector('#expAsc');
    if (expAsc) {
      const base = `sls_dem_${state.terrain.epsg}_${state.terrain.cellSize}m`;
      expAsc.onclick = () => SLS.terrain.exportAsc(state.terrain, base);
      sb.querySelector('#expJson').onclick = () => SLS.terrain.exportJson(state.terrain, state.stats, base);
    }
  }

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
      const corners = SLS.terrain.cornersWgs84(terrain);
      mapView.setTerrainOverlay(SLS.terrain.slopeOverlay(terrain, slope), corners);
      mapView.setSlopeVisible(state.layers.slope);
      mapView.fitBbox(terrain.bboxWgs84);
      Object.assign(state, { terrain, stats, slope, aspect });
      // Sonraki modüller ve hata ayıklama için erişim
      SLS.currentTerrain = terrain;
      setProgress('progress.done', 1);
    } catch (e) {
      console.error(e);
      state.error = e && e.message ? e.message : t('err.generic');
    } finally {
      state.busy = false;
      render();
    }
  }

  function updateCoords(ll) {
    const el = root && root.querySelector('#coords');
    if (!el) return;
    let s = `${ll.lat.toFixed(5)}° ${ll.lat >= 0 ? 'N' : 'S'}  ${ll.lng.toFixed(5)}° ${ll.lng >= 0 ? 'E' : 'W'}`;
    const tr = state.terrain;
    if (tr) {
      const [x, y] = SLS.proj.converter(tr.epsg).forward([ll.lng, ll.lat]);
      const c = Math.floor((x - tr.originX) / tr.cellSize), r = Math.floor((tr.originY - y) / tr.cellSize);
      if (c >= 0 && r >= 0 && c < tr.width && r < tr.height) {
        const z = tr.data[r * tr.width + c], sl = state.slope[r * tr.width + c];
        if (!Number.isNaN(z)) s += `  ·  ${n(z)} m  ·  ${n(sl, 1)}°`;
      }
    }
    el.textContent = s;
  }

  SLS.modules = SLS.modules || {};
  SLS.modules.avalanche = { mount, unmount, onLang: () => state && render() };
})(window.SLS = window.SLS || {});
