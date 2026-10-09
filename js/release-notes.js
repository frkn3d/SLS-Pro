/* SLS Pro — Sürüm bilgisi ve sürüm notları
 * Yeni sürümde: SLS.VERSION değerini güncelleyin ve RELEASES dizisinin başına kayıt ekleyin.
 */
(function (SLS) {
  'use strict';

  SLS.VERSION = '0.3.0';

  const RELEASES = [
    {
      version: '0.3.0',
      date: '2026-10-09',
      tr: {
        title: 'PDF mühendislik raporu, boykesit ve orman etkisi',
        items: [
          'Yeni Rapor adımı: kapak, yönetici özeti, arazi ve model bilgileri, sonuç haritaları, boykesit, tehlike bölgelemesi, mühendislik önerileri, sınırlamalar, kaynakça ve imza bölümü içeren PDF rapor.',
          'Rapor haritaları doğrudan arazi verisinden çizilir: gölgeli kabartma, eş yükselti eğrileri, UTM koordinatları, ölçek çubuğu ve kuzey oku.',
          'Mühendislik değerlendirmesi: β noktası, Norveç α-β modeli ile kaçış açısı karşılaştırması ve durdurma seddesi yüksekliği ön tahmini.',
          'Akış yolu boykesiti: kot, en yüksek hız ve basınç; grafik üzerinde gezinince haritada konum gösterilir.',
          'Haritada otomatik akış yolu çizgisi.',
          'Orman etkisi: ESA WorldCover 2021 (10 m) verisiyle ormanlık hücrelerde artırılmış sürtünme; çözücü artık hücre bazlı μ ve ξ destekliyor.',
          'Rapor bilgileri (proje, konum, hazırlayan, kurum) tarayıcıda hatırlanır.',
        ],
      },
      en: {
        title: 'PDF engineering report, profile and forest effect',
        items: [
          'New Report step: PDF report with cover, executive summary, terrain and model details, result maps, profile, hazard zoning, engineering recommendations, limitations, references and sign-off section.',
          'Report maps are drawn directly from terrain data: hillshade, contours, UTM coordinates, scale bar and north arrow.',
          'Engineering assessment: β point, runout-angle comparison with the Norwegian α-β model and a catching-dam height pre-estimate.',
          'Flow-path profile: elevation, peak speed and pressure; hovering the chart marks the location on the map.',
          'Automatic flow-path line on the map.',
          'Forest effect: increased friction in forest cells from ESA WorldCover 2021 (10 m); the solver now supports per-cell μ and ξ.',
          'Report details (project, location, author, organisation) are remembered in the browser.',
        ],
      },
    },
    {
      version: '0.2.0',
      date: '2026-10-09',
      tr: {
        title: 'Çığ akış simülasyonu',
        items: [
          'Voellmy-Salm yoğun çığ çözücüsü: derinlik-ortalamalı sığ akış denklemleri, sonlu hacim (HLL), eğime göre düzeltilmiş yerçekimi ve sürtünme.',
          'Çözücü analitik testlerle doğrulandı: Voellmy limit hızı, Coulomb durma koşulu, kütle korunumu ve kaçış açısı.',
          'Kopma alanı adımı: eğime göre otomatik aday kopma alanları (tıklayarak seçim), poligon çizimi ve kopma kalınlığı d₀.',
          'Parametreler adımı: küçük / orta / büyük senaryo ön ayarları; μ, ξ, yoğunluk, basınç katsayısı ve süre ayarları.',
          'Simülasyon adımı: arka planda (Web Worker) hesap, haritada canlı akış animasyonu, durdurma.',
          'Sonuç haritaları: en yüksek akış yüksekliği, hız, darbe basıncı, birikim ve İsviçre basınç eşiklerine göre tehlike bölgeleri.',
          'Sonuç özeti: kaçış mesafesi, α açısı, düşü, etkilenen alan, bölge alanları, kütle dengesi; alan dışına taşma uyarısı.',
          'QGIS için sonuç dışa aktarımı: h_max, v_max, p_max, tehlike bölgeleri (.asc + .prj) ve özet (.json).',
          'Adım çubuğu artık tıklanabilir; imleç altında sonuç değerleri gösterilir.',
        ],
      },
      en: {
        title: 'Avalanche flow simulation',
        items: [
          'Voellmy-Salm dense-flow solver: depth-averaged shallow-flow equations, finite volume (HLL), slope-corrected gravity and friction.',
          'Solver verified against analytic tests: Voellmy terminal speed, Coulomb stopping condition, mass conservation and runout angle.',
          'Release step: automatic slope-based candidate release areas (click to select), polygon drawing and fracture depth d₀.',
          'Parameters step: small / medium / large scenario presets; μ, ξ, density, pressure coefficient and duration settings.',
          'Simulation step: background computation (Web Worker), live flow animation on the map, stop button.',
          'Result maps: peak flow height, speed, impact pressure, deposit and hazard zones by Swiss pressure thresholds.',
          'Result summary: runout distance, α angle, vertical drop, affected area, zone areas, mass balance; warning when flow leaves the area.',
          'Result export for QGIS: h_max, v_max, p_max, hazard zones (.asc + .prj) and summary (.json).',
          'The step bar is now clickable; result values are shown under the cursor.',
        ],
      },
    },
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
