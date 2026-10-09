/* SLS Pro — Uygulama kabuğu: modül başlatıcı ve yönlendirme */
(function (SLS) {
  'use strict';

  const t = (k) => SLS.i18n.t(k);
  const svg = (body) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

  // Modül kayıt defteri — yeni simülatörler buraya eklenir.
  const MODULES = [
    { id: 'avalanche', active: true, icon: svg('<path d="M3 20l6-11 3.5 5 2.5-3.5L21 20z"/><path d="M7.4 12l1.6 1.2 1.6-1.2"/><circle cx="17" cy="5" r=".6"/><circle cx="20" cy="8" r=".6"/><circle cx="14.5" cy="7.5" r=".6"/>') },
    { id: 'flood', icon: svg('<path d="M12 3s4 4.6 4 7.5a4 4 0 0 1-8 0C8 7.6 12 3 12 3z"/><path d="M2 17c1.7 0 1.7-1.3 3.3-1.3S7 17 8.7 17s1.6-1.3 3.3-1.3 1.6 1.3 3.3 1.3 1.6-1.3 3.4-1.3S20.3 17 22 17"/><path d="M2 21c1.7 0 1.7-1.3 3.3-1.3S7 21 8.7 21s1.6-1.3 3.3-1.3 1.6 1.3 3.3 1.3 1.6-1.3 3.4-1.3S20.3 21 22 21"/>') },
    { id: 'debris', icon: svg('<path d="M3 20h18L8 5z"/><circle cx="15" cy="16.5" r="1.4"/><circle cx="11" cy="13" r="1"/><circle cx="18.5" cy="18" r=".8"/>') },
    { id: 'rockfall', icon: svg('<path d="M4 21V4h5l2 4-1 4 1 9"/><path d="M15.5 7.5l2.5-.8 1.5 2-1 2.3-2.6-.2z"/><path d="M15 15l1 1.5M18.5 16.5l.8 1.8"/>') },
    { id: 'landslide', icon: svg('<path d="M3 21h18"/><path d="M3 17c3-.5 5-4 8-6.5S17 8 21 5"/><path d="M8 17.5l2.5-2 2 1.5 3-3 2 1"/>') },
    { id: 'wildfire', icon: svg('<path d="M12 3c.6 3 4.8 5 4.8 10a4.8 4.8 0 0 1-9.6 0c0-2.8 1.8-3.6 2-6.4 1.2.8 2 2.2 2.4 3.6.6-2.4.6-4.8.4-7.2z"/>') },
  ];

  const app = document.getElementById('app');
  const crumb = document.getElementById('crumb');
  let current = null; // aktif modül nesnesi

  function renderLauncher() {
    crumb.innerHTML = '';
    app.innerHTML = `
      <div class="launcher"><div class="launcher-inner">
        <div class="hero">
          <h1>${t('launcher.title')}</h1>
          <p>${t('launcher.subtitle')}</p>
        </div>
        <div class="core-strip">
          <div class="core-icon">${svg('<path d="M3 18l5-8 4 5 3-4 6 7z"/><path d="M3 21h18"/><path d="M12 3v3M8.5 4.5l1 1M15.5 4.5l-1 1"/>')}</div>
          <div>
            <div class="eyebrow">${t('launcher.core')}</div>
            <div class="name">${t('launcher.coreName')}</div>
            <div class="desc">${t('launcher.coreDesc')}</div>
          </div>
        </div>
        <div class="modules">
          ${MODULES.map((m) => `
            <button type="button" class="module ${m.active ? 'active' : 'disabled'}" data-mod="${m.id}" ${m.active ? '' : 'aria-disabled="true"'}>
              <div class="m-icon">${m.icon}</div>
              <h3>${t('mod.' + m.id)}</h3>
              <p>${t('mod.' + m.id + '.desc')}</p>
              <div class="m-foot">
                ${m.active
                  ? `<span class="badge ok"><span class="dot"></span>${t('launcher.active')}</span><span class="open">${t('launcher.open')} →</span>`
                  : `<span class="badge">${t('launcher.soon')}</span>`}
              </div>
            </button>`).join('')}
        </div>
        <div class="launcher-foot">SLS Pro ${SLS.VERSION} · © ${new Date().getFullYear()}</div>
      </div></div>`;
    app.querySelectorAll('.module.active').forEach((b) => b.onclick = () => { location.hash = '#/' + b.dataset.mod; });
  }

  function renderCrumb(id) {
    crumb.innerHTML = `
      <button type="button" id="backBtn">← <span>${t('ws.back')}</span></button>
      <span>/</span><span class="cur">${t('mod.' + id)}</span>`;
    crumb.querySelector('#backBtn').onclick = () => { location.hash = '#/'; };
  }

  function route() {
    const id = location.hash.replace(/^#\/?/, '');
    const mod = MODULES.find((m) => m.id === id && m.active);
    if (current) { current.unmount(); current = null; }
    if (mod && SLS.modules[mod.id]) {
      current = SLS.modules[mod.id];
      current.id = mod.id;
      renderCrumb(mod.id);
      current.mount(app);
    } else {
      renderLauncher();
    }
  }

  const verBtn = document.getElementById('verBtn');
  const renderVersion = () => { verBtn.textContent = `${t('app.version')} ${SLS.VERSION}`; };
  verBtn.onclick = () => SLS.releaseNotes.open();
  document.getElementById('lang').onclick = () => SLS.i18n.toggle();
  document.getElementById('brand').onclick = (e) => { e.preventDefault(); location.hash = '#/'; };
  SLS.i18n.onChange(() => {
    renderVersion();
    if (SLS.releaseNotes.isOpen()) SLS.releaseNotes.open();
    if (current) { renderCrumb(current.id); current.onLang && current.onLang(); } else renderLauncher();
  });

  SLS.i18n.apply();
  renderVersion();
  window.addEventListener('hashchange', route);
  route();
})(window.SLS = window.SLS || {});
