/* SLS Pro Saha — kar profili rasat girişi (mobil öncelikli) */
(function (SLS) {
  'use strict';

  const t = (k, v) => SLS.i18n.t(k, v);
  const n = (v, d) => (Number.isFinite(v) ? SLS.i18n.number(v, d) : '—');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SP = SLS.snowpack;
  const root = document.getElementById('field');

  let cur = null;   // düzenlenen profil
  let dirty = false;

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'ftoast'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function localDT(iso) {
    const d = iso ? new Date(iso) : new Date();
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ---------------------------------------------------------------------------
  function render() {
    const list = SP.list();
    if (!cur) cur = list[0] ? JSON.parse(JSON.stringify(list[0])) : SP.blank();
    const L = cur.location, Wt = cur.weather;
    const num = (path, key, val, step, unit) => `
      <label class="field"><span>${esc(t(key))}${unit ? ' (' + unit + ')' : ''}</span>
        <input class="input mono" type="number" inputmode="decimal" step="${step || 'any'}" data-path="${path}" value="${val ?? ''}"></label>`;
    const sel = (cls, path, key, opts, val) => `
      <label class="field ${cls}"><span>${esc(t(key))}</span>
        <select class="select" data-path="${path}">${opts.map((o) => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;

    root.innerHTML = `
      <div class="fld">
        <aside class="fld-list">
          <div class="row">
            <button class="btn primary" id="newBtn" style="flex:1">+ ${esc(t('field.new'))}</button>
            <label class="btn" for="impFile">${esc(t('field.import'))}</label>
            <input type="file" id="impFile" accept=".json,application/json" hidden>
          </div>
          <h4 style="margin:6px 0 0;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)">${esc(t('field.saved'))} (${list.length})</h4>
          <div class="plist">
            ${list.length ? list.map((p) => {
              const d = SP.derive(p);
              return `<button class="pitem ${p.id === cur.id ? 'sel' : ''}" data-open="${p.id}">
                <span class="t">${esc(p.name || t('field.unnamed'))}</span>
                <span class="d">${esc(new Date(p.date).toLocaleString(SLS.i18n.lang === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }))}</span>
                <span class="d">HS ${n(d.hs * 100, 0)} cm · SWE ${n(d.swe, 0)} mm · ${d.nLayers} ${esc(t('field.layersShort'))}</span>
              </button>`;
            }).join('') : `<p class="hint">${esc(t('field.empty'))}</p>`}
          </div>
          <p class="hint">${esc(t('field.storeHint'))}</p>
        </aside>

        <div class="fld-main">
          <section class="fcard">
            <h3>${esc(t('field.general'))}</h3>
            <div class="fgrid">
              <label class="field" style="grid-column:1/-1"><span>${esc(t('field.name'))}</span>
                <input class="input" data-path="name" value="${esc(cur.name)}" placeholder="${esc(t('field.namePh'))}"></label>
              <label class="field"><span>${esc(t('field.date'))}</span>
                <input class="input mono" type="datetime-local" data-path="date" value="${localDT(cur.date)}"></label>
              <label class="field"><span>${esc(t('field.observer'))}</span>
                <input class="input" data-path="observer" value="${esc(cur.observer)}"></label>
            </div>
          </section>

          <section class="fcard">
            <h3>${esc(t('field.location'))}</h3>
            <div class="fgrid">
              ${num('location.lat', 'field.lat', L.lat, 'any', '°')}
              ${num('location.lon', 'field.lon', L.lon, 'any', '°')}
              ${num('location.elev', 'field.elev', L.elev, 1, 'm')}
              ${num('location.aspect', 'field.aspect', L.aspect, 1, '°')}
              ${num('location.slope', 'field.slope', L.slope, 1, '°')}
              <div class="field"><span>&nbsp;</span><button class="btn" id="gpsBtn">${esc(t('field.gps'))}</button></div>
            </div>
          </section>

          <section class="fcard">
            <h3>${esc(t('field.weather'))}</h3>
            <div class="fgrid">
              ${num('weather.airTemp', 'field.airTemp', Wt.airTemp, 0.1, '°C')}
              ${num('weather.windDir', 'field.windDir', Wt.windDir, 1, '°')}
              ${num('weather.windSpeed', 'field.windSpeed', Wt.windSpeed, 0.1, 'm/s')}
            </div>
            <p class="hint">${esc(t('field.windHint'))}</p>
          </section>

          <section class="fcard">
            <h3>${esc(t('field.layers'))}</h3>
            <p class="hint" style="margin:-6px 0 10px">${esc(t('field.layersHint'))}</p>
            <div class="layers">
              ${cur.layers.map((Lr, i) => `
                <div class="lrow ${Lr.weak ? 'weak' : ''}" data-row="${i}">
                  <span class="no">${i + 1}</span>
                  ${num(`layers.${i}.thickness`, 'field.thickness', Lr.thickness, 0.5, 'cm')}
                  ${num(`layers.${i}.density`, 'field.density', Lr.density, 1, 'kg/m³')}
                  ${num(`layers.${i}.swe`, 'field.swe', Lr.swe, 0.1, 'mm')}
                  ${sel('grain', `layers.${i}.grain`, 'field.grain', SP.GRAIN, Lr.grain)}
                  ${sel('hard', `layers.${i}.hardness`, 'field.hardness', SP.HARDNESS, Lr.hardness)}
                  ${sel('wet', `layers.${i}.wetness`, 'field.wetness', SP.WETNESS, Lr.wetness)}
                  <label class="wk"><input type="checkbox" data-path="layers.${i}.weak" ${Lr.weak ? 'checked' : ''}> ${esc(t('field.weak'))}</label>
                  <span class="acts">
                    <button class="icon-btn" data-up="${i}" title="${esc(t('field.up'))}" ${i ? '' : 'disabled'}>↑</button>
                    <button class="icon-btn" data-down="${i}" title="${esc(t('field.down'))}" ${i < cur.layers.length - 1 ? '' : 'disabled'}>↓</button>
                    <button class="icon-btn" data-del="${i}" title="${esc(t('field.delete'))}" ${cur.layers.length > 1 ? '' : 'disabled'}>×</button>
                  </span>
                </div>`).join('')}
            </div>
            <button class="btn" id="addLayer" style="margin-top:10px">+ ${esc(t('field.addLayer'))}</button>
          </section>

          <section class="fcard">
            <h3>${esc(t('field.summary'))}</h3>
            <div class="summary" id="summary"></div>
            <canvas class="profile-chart" id="pchart" aria-label="${esc(t('field.chart'))}"></canvas>
            <p class="hint" id="sumHint"></p>
          </section>

          <section class="fcard">
            <h3>${esc(t('field.notes'))}</h3>
            <textarea class="input textarea" rows="3" data-path="notes" style="width:100%">${esc(cur.notes)}</textarea>
          </section>

          <div class="factions">
            <button class="btn primary" id="saveBtn">${esc(t('field.save'))}</button>
            <button class="btn" id="useBtn">${esc(t('field.useInSim'))}</button>
            <button class="btn" id="expBtn">${esc(t('field.export'))}</button>
            ${navigator.share ? `<button class="btn" id="shareBtn">${esc(t('field.share'))}</button>` : ''}
            <button class="btn" id="delBtn" ${SP.get(cur.id) ? '' : 'disabled'}>${esc(t('field.remove'))}</button>
          </div>
        </div>
      </div>`;
    bind();
    refreshSummary();
  }

  function setPath(path, raw, type) {
    const parts = path.split('.');
    let o = cur;
    for (let k = 0; k < parts.length - 1; k++) o = o[parts[k]];
    const key = parts[parts.length - 1];
    if (type === 'checkbox') o[key] = raw;
    else if (type === 'number') o[key] = raw === '' ? null : Number(raw);
    else if (key === 'date') o[key] = raw ? new Date(raw).toISOString() : new Date().toISOString();
    else o[key] = raw;
    // Yoğunluk ↔ SWE: biri girilince diğeri hesaplanır
    const m = path.match(/^layers\.(\d+)\.(density|swe|thickness)$/);
    if (m) {
      const Lr = cur.layers[+m[1]], th = Number(Lr.thickness) / 100;
      if (m[2] === 'density' && Lr.density != null && th > 0) Lr.swe = +(Lr.density * th).toFixed(1);
      if (m[2] === 'swe' && Lr.swe != null && th > 0) Lr.density = Math.round(Lr.swe / th);
      if (m[2] === 'thickness' && Lr.density != null && th > 0) Lr.swe = +(Lr.density * th).toFixed(1);
      const row = root.querySelector(`[data-row="${m[1]}"]`);
      if (row) {
        if (m[2] !== 'density') row.querySelector(`[data-path="layers.${m[1]}.density"]`).value = Lr.density ?? '';
        if (m[2] !== 'swe') row.querySelector(`[data-path="layers.${m[1]}.swe"]`).value = Lr.swe ?? '';
      }
    }
    dirty = true;
  }

  function bind() {
    root.querySelectorAll('[data-path]').forEach((el) => {
      const ev = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        setPath(el.dataset.path, el.type === 'checkbox' ? el.checked : el.value, el.type);
        if (el.type === 'checkbox') { render(); return; }
        refreshSummary();
      });
    });
    root.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => {
      if (dirty && !confirm(t('field.discard'))) return;
      cur = JSON.parse(JSON.stringify(SP.get(b.dataset.open))); dirty = false; render();
    });
    root.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => { const i = +b.dataset.up; [cur.layers[i - 1], cur.layers[i]] = [cur.layers[i], cur.layers[i - 1]]; dirty = true; render(); });
    root.querySelectorAll('[data-down]').forEach((b) => b.onclick = () => { const i = +b.dataset.down; [cur.layers[i + 1], cur.layers[i]] = [cur.layers[i], cur.layers[i + 1]]; dirty = true; render(); });
    root.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { cur.layers.splice(+b.dataset.del, 1); dirty = true; render(); });
    root.querySelector('#addLayer').onclick = () => {
      cur.layers.push({ thickness: 20, density: 200, swe: 40, grain: 'RG', hardness: '1F', wetness: 'D', weak: false });
      dirty = true; render();
    };
    root.querySelector('#newBtn').onclick = () => {
      if (dirty && !confirm(t('field.discard'))) return;
      cur = SP.blank(); dirty = false; render();
    };
    root.querySelector('#impFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const arr = await SP.fromFile(f);
        arr.forEach((p) => SP.save(p));
        cur = JSON.parse(JSON.stringify(arr[0])); dirty = false; render();
        toast(t('field.imported', { n: arr.length }));
      } catch (_) { toast(t('field.importErr')); }
    };
    root.querySelector('#gpsBtn').onclick = () => {
      if (!navigator.geolocation) { toast(t('field.gpsErr')); return; }
      toast(t('field.gpsWait'));
      navigator.geolocation.getCurrentPosition((pos) => {
        cur.location.lat = +pos.coords.latitude.toFixed(6);
        cur.location.lon = +pos.coords.longitude.toFixed(6);
        if (pos.coords.altitude != null) cur.location.elev = Math.round(pos.coords.altitude);
        dirty = true; render();
      }, () => toast(t('field.gpsErr')), { enableHighAccuracy: true, timeout: 20000 });
    };
    root.querySelector('#saveBtn').onclick = save;
    root.querySelector('#useBtn').onclick = () => { save(); location.href = 'index.html#/avalanche?profile=' + encodeURIComponent(cur.id); };
    root.querySelector('#expBtn').onclick = () => {
      const f = SP.toFile(cur), a = document.createElement('a');
      a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    const sh = root.querySelector('#shareBtn');
    if (sh) sh.onclick = async () => {
      const f = SP.toFile(cur);
      try {
        if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: cur.name || 'SLS profile' });
        else await navigator.share({ title: cur.name || 'SLS profile', text: JSON.stringify(cur) });
      } catch (_) { /* iptal */ }
    };
    root.querySelector('#delBtn').onclick = () => {
      if (!confirm(t('field.confirmDel'))) return;
      SP.remove(cur.id); cur = null; dirty = false; render();
    };
  }

  function save() {
    if (!cur.name) cur.name = `${t('field.profile')} ${new Date(cur.date).toLocaleDateString(SLS.i18n.lang === 'tr' ? 'tr-TR' : 'en-GB')}`;
    if (SP.save(JSON.parse(JSON.stringify(cur)))) { dirty = false; toast(t('field.saved1')); render(); }
    else toast(t('field.saveErr'));
  }

  function refreshSummary() {
    const d = SP.derive(cur);
    const tile = (k, v, u) => `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${v}${u ? `<small>${u}</small>` : ''}</div></div>`;
    root.querySelector('#summary').innerHTML = [
      tile(t('field.hs'), n(d.hs * 100, 0), 'cm'),
      tile(t('field.sweTot'), n(d.swe, 0), 'mm'),
      tile(t('field.meanRho'), n(d.meanDensity, 0), 'kg/m³'),
      tile(t('field.nLayers'), d.nLayers),
      tile(t('field.slabD'), d.slab ? n(d.slab.depth * 100, 0) : '—', d.slab ? 'cm' : ''),
      tile(t('field.slabRho'), d.slab ? n(d.slab.density, 0) : '—', d.slab ? 'kg/m³' : ''),
      tile(t('field.erodible'), n(d.erodible.depth * 100, 0), 'cm'),
      tile(t('field.snowType'), esc(t('snow.' + d.snowType))),
    ].join('');
    const hints = [];
    if (!d.slab) hints.push(t('field.noWeak'));
    if (d.missingDensity) hints.push(t('field.missing', { n: d.missingDensity }));
    root.querySelector('#sumHint').textContent = hints.join(' ');
    drawChart(d);
  }

  /** Yoğunluk–derinlik profili: her katman bir yatay çubuk (genişlik = yoğunluk). */
  function drawChart(d) {
    const cv = root.querySelector('#pchart');
    const w = cv.parentElement.clientWidth - 32, h = Math.max(160, Math.min(320, 40 + d.hs * 220));
    const dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#131a22'; ctx.fillRect(0, 0, w, h);
    const ML = 46, MR = 12, MT = 20, MB = 30, pw = w - ML - MR, ph = h - MT - MB;
    const rhoMax = 600, depth = Math.max(d.hs, 0.1);
    ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillStyle = '#a9b6c4';
    // Izgara
    ctx.strokeStyle = '#233040'; ctx.lineWidth = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let r = 0; r <= rhoMax; r += 100) { const x = ML + r / rhoMax * pw + 0.5; ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + ph); ctx.stroke(); ctx.fillText(r, x, MT + ph + 4); }
    ctx.fillText(t('field.density') + ' (kg/m³)', ML + pw / 2, MT + ph + 16);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const stepCm = depth > 1.5 ? 50 : depth > 0.6 ? 20 : 10;
    for (let c = 0; c <= depth * 100 + 0.01; c += stepCm) { const y = MT + (c / 100) / depth * ph; ctx.fillText(c, ML - 6, y); }
    ctx.save(); ctx.translate(12, MT + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(t('field.depth') + ' (cm)', 0, 0); ctx.restore();
    // Katmanlar
    const layers = cur.layers.filter((L) => Number(L.thickness) > 0);
    let top = 0;
    layers.forEach((L) => {
      const th = Number(L.thickness) / 100, rho = SP.layerDensity(L);
      const y0 = MT + top / depth * ph, y1 = MT + (top + th) / depth * ph;
      const bw = Number.isFinite(rho) ? Math.min(rho, rhoMax) / rhoMax * pw : 0;
      ctx.fillStyle = L.weak ? '#f3b33e' : '#5cc8ff';
      ctx.fillRect(ML, y0 + 1, Math.max(0, bw), Math.max(1, y1 - y0 - 2));     // 2px katman aralığı
      if (L.weak) { ctx.fillStyle = '#e6edf3'; ctx.textAlign = 'left'; ctx.fillText('◄ ' + t('field.weak'), ML + bw + 6, (y0 + y1) / 2); }
      top += th;
    });
  }

  // ---------------------------------------------------------------------------
  document.getElementById('lang').onclick = () => SLS.i18n.toggle();
  SLS.i18n.onChange(() => render());
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('resize', () => cur && drawChart(SP.derive(cur)));
  SLS.i18n.apply();
  render();
})(window.SLS = window.SLS || {});
