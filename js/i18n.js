/* SLS Pro — i18n (TR / EN)
 * Dil önceliği: kullanıcının seçimi (localStorage) > cihaz dili > İngilizce
 */
(function (SLS) {
  'use strict';

  const DICT = {
    tr: {
      'app.tagline': 'Doğal Afet Simülasyon Platformu',
      'app.version': 'Sürüm',
      'notes.title': 'Sürüm Notları',
      'notes.open': 'Sürüm notlarını göster',
      'notes.close': 'Kapat',
      'lang.switch': 'EN',

      'launcher.title': 'Simülasyon Modülleri',
      'launcher.subtitle': 'Tüm modüller ortak Arazi Motoru üzerinde çalışır. Bir modül seçerek başlayın.',
      'launcher.core': 'Ortak çekirdek',
      'launcher.coreName': 'Arazi Motoru',
      'launcher.coreDesc': 'Koordinatlı DEM edinimi, UTM projeksiyonu, eğim / bakı analizi, QGIS uyumlu dışa aktarım.',
      'launcher.open': 'Modülü aç',
      'launcher.soon': 'Yakında',
      'launcher.active': 'Aktif',

      'mod.avalanche': 'Çığ Simülasyonu',
      'mod.avalanche.desc': 'Voellmy-Salm akış modeli, kopma alanı analizi, darbe basıncı ve tehlike bölgelemesi.',
      'mod.flood': 'Sel ve Taşkın',
      'mod.flood.desc': '2B sığ su denklemleri ile taşkın yayılımı, su derinliği ve akış hızı haritaları.',
      'mod.debris': 'Moloz / Çamur Akışı',
      'mod.debris.desc': 'Yağış kaynaklı moloz akışlarının yayılım ve birikim analizi.',
      'mod.rockfall': 'Kaya Düşmesi',
      'mod.rockfall.desc': 'Blok yörüngeleri, sıçrama enerjileri ve bariyer tasarım girdileri.',
      'mod.landslide': 'Heyelan',
      'mod.landslide.desc': 'Şev duyarlılığı ve kütle hareketi yayılım senaryoları.',
      'mod.wildfire': 'Orman Yangını',
      'mod.wildfire.desc': 'Rüzgâr, eğim ve yakıt tipine bağlı yangın yayılım modeli.',

      'ws.back': 'Modüller',
      'ws.step.terrain': 'Arazi',
      'ws.step.release': 'Kopma Alanı',
      'ws.step.params': 'Parametreler',
      'ws.step.run': 'Simülasyon',
      'ws.step.report': 'Rapor',
      'ws.step.locked': 'Sonraki fazda',

      'terrain.title': 'Arazi Verisi Edinimi',
      'terrain.intro': 'Çalışma alanını haritada seçin, yükseklik kaynağını belirleyin ve araziyi metrik (UTM) ızgaraya çekin.',
      'terrain.source': 'Yükseklik kaynağı',
      'src.terrarium': 'AWS Terrain Tiles',
      'src.terrarium.desc': 'Küresel, anahtarsız, tarayıcıdan doğrudan. Türkiye için ~30 m (SRTM tabanlı).',
      'src.copernicus': 'Copernicus GLO-30',
      'src.copernicus.desc': 'ESA / Avrupa Birliği küresel DSM, 30 m. Yerel sunucu (serve.py) gerektirir.',
      'src.file': 'Kendi GeoTIFF dosyam',
      'src.file.desc': 'Drone fotogrametrisi, LiDAR veya kurum DEM’i. En yüksek detay; çözünürlük korunur.',
      'src.needsServer': 'Yerel sunucu gerekli',
      'src.browser': 'Tarayıcıdan',
      'src.local': 'Yerel dosya',

      'terrain.area': 'Çalışma alanı',
      'terrain.draw': 'Haritada alan çiz',
      'terrain.drawing': 'Haritada sürükleyerek dikdörtgen çizin…',
      'terrain.clear': 'Temizle',
      'terrain.noArea': 'Henüz alan seçilmedi.',
      'terrain.goto': 'Konuma git (enlem, boylam)',
      'terrain.gotoBtn': 'Git',
      'terrain.cell': 'Hücre boyutu',
      'terrain.cellHint': 'Kaynağın doğal çözünürlüğünden küçük değerler detay eklemez, yalnızca enterpolasyon yapar.',
      'terrain.fetch': 'Araziyi Çek',
      'terrain.file.pick': 'GeoTIFF seçin (.tif / .tiff)',
      'terrain.file.drop': 'veya dosyayı buraya bırakın',
      'terrain.areaKm2': 'Alan',
      'terrain.grid': 'Izgara',
      'terrain.crs': 'Hedef CRS',
      'terrain.tooBig': 'Alan çok büyük. Lütfen alanı küçültün veya hücre boyutunu büyütün.',

      'progress.tiles': 'Döşemeler indiriliyor',
      'progress.resample': 'UTM ızgarasına yeniden örnekleniyor',
      'progress.analysis': 'Eğim ve bakı hesaplanıyor',
      'progress.reading': 'Dosya okunuyor',
      'progress.cog': 'Copernicus döşemeleri okunuyor',
      'progress.done': 'Arazi hazır',

      'result.title': 'Arazi Özeti',
      'result.source': 'Kaynak',
      'result.dims': 'Boyut',
      'result.cell': 'Hücre',
      'result.crs': 'CRS',
      'result.elev': 'Kot aralığı',
      'result.relief': 'Rölyef',
      'result.slopeDist': 'Eğim dağılımı',
      'result.critical': 'Çığ kopma eğimi (30°–45°)',
      'result.layers': 'Katmanlar',
      'layer.slope': 'Eğim sınıfları',
      'layer.hillshade': 'Gölgeli kabartma',
      'layer.terrain3d': '3B arazi',
      'layer.basemap': 'Altlık',
      'basemap.topo': 'Topografik',
      'basemap.sat': 'Uydu (Sentinel-2)',
      'result.export': 'Dışa aktar (QGIS)',
      'export.asc': 'ESRI ASCII Grid (.asc + .prj)',
      'export.json': 'Meta veri (.json)',
      'export.next': 'Kopma alanına geç',
      'export.nextLocked': 'Kopma alanı tanımı Faz 2’de gelecek',

      'legend.slope': 'Eğim (°)',
      'attr.title': 'Veri kaynakları ve lisanslar',

      'err.server': 'Copernicus için yerel sunucu bulunamadı. Uygulamayı "Baslat.bat" ile (python serve.py) açın.',
      'err.generic': 'Bir hata oluştu',
      'err.crs': 'Dosyanın koordinat sistemi okunamadı veya desteklenmiyor (EPSG:{epsg}).',
      'err.noData': 'Seçilen alanda yükseklik verisi bulunamadı.',
      'unit.cells': 'hücre',
    },

    en: {
      'app.tagline': 'Natural Hazard Simulation Platform',
      'app.version': 'Version',
      'notes.title': 'Release Notes',
      'notes.open': 'Show release notes',
      'notes.close': 'Close',
      'lang.switch': 'TR',

      'launcher.title': 'Simulation Modules',
      'launcher.subtitle': 'All modules run on a shared Terrain Engine. Pick a module to get started.',
      'launcher.core': 'Shared core',
      'launcher.coreName': 'Terrain Engine',
      'launcher.coreDesc': 'Georeferenced DEM acquisition, UTM projection, slope / aspect analysis, QGIS-ready export.',
      'launcher.open': 'Open module',
      'launcher.soon': 'Coming soon',
      'launcher.active': 'Active',

      'mod.avalanche': 'Avalanche Simulation',
      'mod.avalanche.desc': 'Voellmy-Salm flow model, release-zone analysis, impact pressure and hazard zoning.',
      'mod.flood': 'Flood & Inundation',
      'mod.flood.desc': '2D shallow-water flood propagation with depth and velocity maps.',
      'mod.debris': 'Debris / Mud Flow',
      'mod.debris.desc': 'Runout and deposition of rainfall-triggered debris flows.',
      'mod.rockfall': 'Rockfall',
      'mod.rockfall.desc': 'Block trajectories, bounce energies and barrier design inputs.',
      'mod.landslide': 'Landslide',
      'mod.landslide.desc': 'Slope susceptibility and mass-movement runout scenarios.',
      'mod.wildfire': 'Wildfire',
      'mod.wildfire.desc': 'Fire spread driven by wind, slope and fuel type.',

      'ws.back': 'Modules',
      'ws.step.terrain': 'Terrain',
      'ws.step.release': 'Release Zone',
      'ws.step.params': 'Parameters',
      'ws.step.run': 'Simulation',
      'ws.step.report': 'Report',
      'ws.step.locked': 'Next phase',

      'terrain.title': 'Terrain Acquisition',
      'terrain.intro': 'Select a study area on the map, choose an elevation source and pull the terrain into a metric (UTM) grid.',
      'terrain.source': 'Elevation source',
      'src.terrarium': 'AWS Terrain Tiles',
      'src.terrarium.desc': 'Global, no API key, straight from the browser. ~30 m over Türkiye (SRTM-based).',
      'src.copernicus': 'Copernicus GLO-30',
      'src.copernicus.desc': 'ESA / European Union global DSM, 30 m. Requires the local server (serve.py).',
      'src.file': 'My own GeoTIFF',
      'src.file.desc': 'Drone photogrammetry, LiDAR or agency DEM. Highest detail; native resolution kept.',
      'src.needsServer': 'Local server',
      'src.browser': 'In browser',
      'src.local': 'Local file',

      'terrain.area': 'Study area',
      'terrain.draw': 'Draw area on map',
      'terrain.drawing': 'Drag on the map to draw a rectangle…',
      'terrain.clear': 'Clear',
      'terrain.noArea': 'No area selected yet.',
      'terrain.goto': 'Go to location (lat, lon)',
      'terrain.gotoBtn': 'Go',
      'terrain.cell': 'Cell size',
      'terrain.cellHint': 'Values finer than the source’s native resolution add no detail, only interpolation.',
      'terrain.fetch': 'Fetch Terrain',
      'terrain.file.pick': 'Choose a GeoTIFF (.tif / .tiff)',
      'terrain.file.drop': 'or drop the file here',
      'terrain.areaKm2': 'Area',
      'terrain.grid': 'Grid',
      'terrain.crs': 'Target CRS',
      'terrain.tooBig': 'Area is too large. Shrink the area or use a coarser cell size.',

      'progress.tiles': 'Downloading tiles',
      'progress.resample': 'Resampling to UTM grid',
      'progress.analysis': 'Computing slope and aspect',
      'progress.reading': 'Reading file',
      'progress.cog': 'Reading Copernicus tiles',
      'progress.done': 'Terrain ready',

      'result.title': 'Terrain Summary',
      'result.source': 'Source',
      'result.dims': 'Size',
      'result.cell': 'Cell',
      'result.crs': 'CRS',
      'result.elev': 'Elevation range',
      'result.relief': 'Relief',
      'result.slopeDist': 'Slope distribution',
      'result.critical': 'Avalanche release slope (30°–45°)',
      'result.layers': 'Layers',
      'layer.slope': 'Slope classes',
      'layer.hillshade': 'Hillshade',
      'layer.terrain3d': '3D terrain',
      'layer.basemap': 'Basemap',
      'basemap.topo': 'Topographic',
      'basemap.sat': 'Satellite (Sentinel-2)',
      'result.export': 'Export (QGIS)',
      'export.asc': 'ESRI ASCII Grid (.asc + .prj)',
      'export.json': 'Metadata (.json)',
      'export.next': 'Continue to release zone',
      'export.nextLocked': 'Release-zone definition arrives in Phase 2',

      'legend.slope': 'Slope (°)',
      'attr.title': 'Data sources and licences',

      'err.server': 'Local server not found for Copernicus. Launch the app with "Baslat.bat" (python serve.py).',
      'err.generic': 'Something went wrong',
      'err.crs': 'Could not read or unsupported coordinate system in file (EPSG:{epsg}).',
      'err.noData': 'No elevation data found in the selected area.',
      'unit.cells': 'cells',
    },
  };

  const STORAGE_KEY = 'sls.lang';
  const listeners = [];

  function detect() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && DICT[saved]) return saved;
    } catch (_) { /* storage unavailable */ }
    const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (const l of langs) {
      const code = String(l).toLowerCase().slice(0, 2);
      if (DICT[code]) return code;
    }
    return 'en';
  }

  let current = detect();

  function t(key, vars) {
    let s = (DICT[current] && DICT[current][key]) || DICT.en[key] || key;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }

  function apply(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    (root || document).querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.documentElement.lang = current;
  }

  function set(lang) {
    if (!DICT[lang]) return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* ignore */ }
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  function number(v, digits) {
    return Number(v).toLocaleString(current === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: digits ?? 0, minimumFractionDigits: digits ?? 0 });
  }

  SLS.i18n = {
    t, apply, set, number,
    get lang() { return current; },
    toggle() { set(current === 'tr' ? 'en' : 'tr'); },
    onChange(fn) { listeners.push(fn); },
  };
})(window.SLS = window.SLS || {});
