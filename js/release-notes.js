/* SLS Pro — Sürüm bilgisi ve sürüm notları
 * Yeni sürümde: SLS.VERSION değerini güncelleyin ve RELEASES dizisinin başına kayıt ekleyin.
 */
(function (SLS) {
  'use strict';

  SLS.VERSION = '0.1.0';

  const RELEASES = [
    {
      version: '0.1.0',
      date: '2026-10-09',
      tr: {
        title: 'İlk sürüm — Arazi Motoru',
        items: [
          'Modül başlatıcı: Çığ Simülasyonu aktif; Sel, Moloz Akışı, Kaya Düşmesi, Heyelan ve Orman Yangını modülleri “Yakında” olarak listelendi.',
          'Türkçe / İngilizce arayüz; cihaz dili otomatik algılanır, üst çubuktan değiştirilebilir.',
          'Haritada dikdörtgen çizerek çalışma alanı seçimi ve enlem/boylam ile konuma gitme.',
          'Üç yükseklik kaynağı: AWS Terrain Tiles (tarayıcıdan), Copernicus GLO-30 (yerel sunucu ile) ve kullanıcının kendi GeoTIFF dosyası (drone / LiDAR).',
          'Araziyi otomatik seçilen WGS84 / UTM dilimine 5–50 m hücre boyutunda yeniden örnekleme; TUREF TM ve ED50 UTM dosyalarında doğal çözünürlük korunur.',
          'Horn yöntemiyle eğim ve bakı analizi, çığ eğim sınıfları bindirmesi, kot aralığı ve eğim dağılımı özeti.',
          '3B arazi görünümü, topografik ve Sentinel-2 uydu altlıkları, imleç altında kot ve eğim göstergesi.',
          'QGIS uyumlu dışa aktarım: ESRI ASCII Grid (.asc + .prj) ve meta veri (.json).',
          'Yalnızca Python standart kütüphanesiyle çalışan yerel sunucu (serve.py) ve Baslat.bat.',
        ],
      },
      en: {
        title: 'First release — Terrain Engine',
        items: [
          'Module launcher: Avalanche Simulation enabled; Flood, Debris Flow, Rockfall, Landslide and Wildfire listed as “Coming soon”.',
          'Turkish / English interface; device language detected automatically, switchable from the top bar.',
          'Study-area selection by drawing a rectangle on the map, plus go-to by latitude/longitude.',
          'Three elevation sources: AWS Terrain Tiles (in browser), Copernicus GLO-30 (via local server) and the user’s own GeoTIFF (drone / LiDAR).',
          'Resampling to the automatically chosen WGS84 / UTM zone at 5–50 m cell size; native resolution kept for TUREF TM and ED50 UTM files.',
          'Slope and aspect analysis (Horn method), avalanche slope-class overlay, elevation range and slope distribution summary.',
          '3D terrain view, topographic and Sentinel-2 satellite basemaps, elevation and slope readout under the cursor.',
          'QGIS-ready export: ESRI ASCII Grid (.asc + .prj) and metadata (.json).',
          'Local server using only the Python standard library (serve.py) and Baslat.bat launcher.',
        ],
      },
    },
  ];

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function open() {
    close();
    const lang = SLS.i18n.lang;
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.id = 'releaseNotes';
    el.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rnTitle">
        <div class="modal-head">
          <h2 id="rnTitle">${esc(SLS.i18n.t('notes.title'))}</h2>
          <button class="modal-x" type="button" aria-label="${esc(SLS.i18n.t('notes.close'))}">×</button>
        </div>
        <div class="modal-body">
          ${RELEASES.map((r) => {
            const c = r[lang] || r.en;
            return `
              <article class="release">
                <div class="release-head">
                  <span class="badge ok">v${esc(r.version)}</span>
                  <strong>${esc(c.title)}</strong>
                  <span class="release-date mono">${esc(r.date)}</span>
                </div>
                <ul>${c.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
              </article>`;
          }).join('')}
        </div>
      </div>`;
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.modal-x')) close(); });
    document.body.appendChild(el);
    el.querySelector('.modal-x').focus();
  }

  function close() {
    const el = document.getElementById('releaseNotes');
    if (el) el.remove();
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  SLS.releaseNotes = { RELEASES, open, close, isOpen: () => !!document.getElementById('releaseNotes') };
})(window.SLS = window.SLS || {});
