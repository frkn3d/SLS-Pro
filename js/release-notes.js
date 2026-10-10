/* SLS Pro — Sürüm bilgisi ve sürüm notları
 * Yeni sürümde: SLS.VERSION değerini güncelleyin ve RELEASES dizisinin başına kayıt ekleyin.
 */
(function (SLS) {
  'use strict';

  SLS.VERSION = '0.8.2';

  const RELEASES = [
    {
      version: '0.8.2',
      date: '2026-10-10',
      tr: {
        title: 'swissALTI3D / USGS 3DEP: kapsam denetimi ve yeniden deneme',
        items: [
          'Seçilen alan kaynağın kapsamı dışındaysa (swissALTI3D: İsviçre ve Lihtenştayn; USGS 3DEP: ABD) kart “Kapsam dışı” olarak işaretlenir ve nedeni ile önerilen kaynaklar yazılır.',
          'USGS 3DEP sunucusu yoğunlukta zaman zaman yanıt vermiyor ve tarayıcı bunu “Failed to fetch” olarak bildiriyordu. İstekler artık zaman aşımıyla 4 kez (swisstopo: 3 kez) artan beklemeyle yeniden denenir; yine olmazsa anlaşılır bir mesaj gösterilir.',
        ],
      },
      en: {
        title: 'swissALTI3D / USGS 3DEP: coverage check and retries',
        items: [
          'If the selected area is outside a source’s coverage (swissALTI3D: Switzerland and Liechtenstein; USGS 3DEP: USA) the card is marked “Outside coverage” with the reason and suggested sources.',
          'The USGS 3DEP server occasionally stops responding under load, which the browser reported as “Failed to fetch”. Requests are now retried 4 times (swisstopo: 3) with increasing waits and a timeout; otherwise a clear message is shown.',
        ],
      },
    },
    {
      version: '0.8.1',
      date: '2026-10-10',
      tr: {
        title: 'Rüzgâr yüklemesi İsviçre kılavuzuna göre düzeltildi',
        items: [
          'Rüzgâr eki artık yalnızca kar biriken yerlere uygulanır: rüzgâraltına bakan hücrelerde, sırt altındaki üst bantta ve belirgin oyuklarda (Salm, Burkhard & Gubler 1990: birikim yerlerinde +0,3–0,5 m, kopma alanı ortalaması).',
          'Önceki sürüm eki tüm rüzgâraltı alana veriyordu: 20 m/s’de kopma alanı ortalaması +0,43 m idi, şimdi +0,18 m (Davos örneği; hacim artışı %43 → %18, etkilenen alan artışı %15 → %8).',
          'Rüzgârüstü yamaçlarda kalınlık artık azaltılmaz (kılavuzda yok).',
          'Rüzgâr panelinde ve raporda kopma alanı ortalama eki ve yüklü alan payı gösterilir.',
        ],
      },
      en: {
        title: 'Wind loading corrected according to the Swiss guideline',
        items: [
          'The wind surcharge is now applied only where drift snow accumulates: lee-facing cells in the upper band below the ridge and in pronounced hollows (Salm, Burkhard & Gubler 1990: +0.3–0.5 m at deposits, release-area mean).',
          'The previous version applied it to the whole lee-facing area: at 20 m/s the release-area mean was +0.43 m, now +0.18 m (Davos example; volume increase 43% → 18%, affected-area increase 15% → 8%).',
          'Depth is no longer reduced on windward slopes (not part of the guideline).',
          'The wind panel and the report show the release-area mean surcharge and the loaded area share.',
        ],
      },
    },
    {
      version: '0.8.0',
      date: '2026-10-10',
      tr: {
        title: 'WebGPU çözücü, gözlenen çığa karşı doğrulama ve otomatik kalibrasyon, QGIS eklentisi',
        items: [
          'WebGPU (ekran kartı) çözücüsü: yoğun akış ve kar sürüklenmesi tamamen GPU’da; CPU çözücüsüyle aynı sonuç (ayak izi örtüşmesi 1,000, kütle hatası 0). 900×600 ızgarada 16 kat hızlı. Hesap motoru: Otomatik / CPU / GPU; WebGPU yoksa veya toz bulutu açıksa CPU kullanılır.',
          'Doğrulama: gözlenen çığ sınırı (KML / KMZ / GeoJSON veya haritada çizim) ile karşılaştırma — F1 (Dice), CSI, kesinlik / duyarlık, alanlar, kaçış mesafesi ve α farkı; uyum değerlendirmesi.',
          'Otomatik kalibrasyon: μ ve ξ haritaları ölçek çarpanlarıyla aranır (her ξ için kaçışı eşleyen μ, ardından şekil uyumu); sonuç kalibrasyon seti olarak kaydedilip tek tıkla uygulanır. μ–ξ eşsonluğu raporlanır.',
          'İkiz deney doğrulaması: bilinen μ/ξ çarpanlarıyla üretilen izlerden çarpanlar %2 içinde geri bulundu (4 vaka).',
          'QGIS eklentisi (uygulamadan .zip olarak indirilir): SLS Pro paketini stilleriyle tek grupta açar; QGIS’teki herhangi bir yükseklik katmanını SLS Pro’ya uygun UTM GeoTIFF’e dönüştürür.',
          'QGIS paketine kopma alanı, akış yolu ve yapı/yol riski (nokta / çizgi / alan) stilleri eklendi.',
          'Rapor: gözlenen çığa karşı doğrulama ve kalibrasyon bölümü; sınırlamalar kullanılan veri ve yönteme göre yazılır.',
        ],
      },
      en: {
        title: 'WebGPU solver, validation against observed avalanches and automatic calibration, QGIS plugin',
        items: [
          'WebGPU (graphics card) solver: dense flow and entrainment run entirely on the GPU; identical results to the CPU solver (footprint overlap 1.000, mass error 0). 16× faster on a 900×600 grid. Compute engine: Automatic / CPU / GPU; the CPU is used without WebGPU or when the powder cloud is on.',
          'Validation: comparison with an observed avalanche outline (KML / KMZ / GeoJSON or drawn on the map) — F1 (Dice), CSI, precision / recall, areas, runout distance and α difference; agreement rating.',
          'Automatic calibration: the μ and ξ maps are searched with scale factors (μ matching the runout for each ξ, then shape agreement); the result is saved as a calibration set and applied with one click. μ–ξ equifinality is reported.',
          'Twin-experiment validation: factors were recovered within 2% from footprints generated with known μ/ξ factors (4 cases).',
          'QGIS plugin (downloaded as .zip from the app): opens an SLS Pro package with its styles in one group; converts any elevation layer in QGIS into an SLS Pro-ready UTM GeoTIFF.',
          'The QGIS package now includes styles for the release area, flow path and building/road risk (point / line / polygon).',
          'Report: validation and calibration section; limitations are written according to the data and method used.',
        ],
      },
    },
    {
      version: '0.7.0',
      date: '2026-10-10',
      tr: {
        title: 'Açık LiDAR kaynakları, LAS/LAZ, QGIS paketi, GeoTIFF/GeoJSON, paylaşım bağlantısı',
        items: [
          'Yeni yükseklik kaynakları: swissALTI3D (İsviçre, LiDAR 2 m / 0,5 m) ve USGS 3DEP (ABD, LiDAR 1 m) — tarayıcıdan doğrudan.',
          'LiDAR nokta bulutu (LAS / LAZ) içe aktarımı: zemin noktalarından yükseklik modeli; LAZ için WASM çözücü (laz-perf).',
          'Bilinmeyen EPSG kodları epsg.io tanımıyla, EPSG’siz WKT’ler doğrudan okunur; feet tabanlı sistemler metreye ve UTM’e dönüştürülür (GeoTIFF ve LAS/LAZ).',
          'QGIS paketi: tüm sonuç katmanları GeoTIFF (EPSG gömülü), tehlike bölgeleri / kopma alanı / akış yolu / yapı-yol riski GeoJSON, her katman için otomatik uygulanan QGIS .qml stilleri.',
          'Tek katman GeoTIFF ve tehlike bölgeleri GeoJSON (delikli çokgenler, RFC 7946) dışa aktarımı.',
          'Arazi sınıfları (RAMMS) arazi adımında da katman olarak gösterilebilir.',
          'Saha profili bağlantı ile paylaşılır (sunucusuz): bağlantı açıldığında profil simülatöre veya saha uygulamasına aktarılır.',
          'Kıyas testi: Mangeney vd. (2000) eğik düzlemde sürtünmeli baraj yıkılması — 2. derece yöntemle 30°/20° durumunda cephe hatası %0,6.',
        ],
      },
      en: {
        title: 'Open LiDAR sources, LAS/LAZ, QGIS package, GeoTIFF/GeoJSON, share link',
        items: [
          'New elevation sources: swissALTI3D (Switzerland, LiDAR 2 m / 0.5 m) and USGS 3DEP (USA, LiDAR 1 m) — directly in the browser.',
          'LiDAR point cloud (LAS / LAZ) import: elevation model from ground points; WASM decoder (laz-perf) for LAZ.',
          'Unknown EPSG codes are resolved via epsg.io and WKT without EPSG is read directly; foot-based systems are converted to metres and UTM (GeoTIFF and LAS/LAZ).',
          'QGIS package: all result layers as GeoTIFF (EPSG embedded), hazard zones / release area / flow path / building-road risk as GeoJSON, with QGIS .qml styles applied automatically per layer.',
          'Single-layer GeoTIFF and hazard-zone GeoJSON (polygons with holes, RFC 7946) export.',
          'Terrain classes (RAMMS) can be shown as a layer in the terrain step too.',
          'Field profiles can be shared by link (serverless): opening the link loads the profile into the simulator or the field app.',
          'Benchmark: Mangeney et al. (2000) frictional dam break on an incline — front error 0.6% with the 2nd-order method in the 30°/20° case.',
        ],
      },
    },
    {
      version: '0.6.0',
      date: '2026-10-10',
      tr: {
        title: 'İkinci derece çözücü, RAMMS sürtünme tablosu, İsviçre kopma kalınlığı, proje kaydetme',
        items: [
          'İkinci derece sayısal yöntem (MUSCL-MC + HLL + Heun/SSP-RK2) varsayılan oldu: oluk testinde 10 m hücrede kaçış hatası %10 → %5, hız hatası %24 → %13; 5 m hücrede kaçış hatası %2,6.',
          'Sürtünme parametreleri RAMMS::AVALANCHE kılavuzundaki MuXi tablosundan hücre bazında atanır: arazi sınıfı (açık yamaç / kanal / oluk / düz) × kot bandı × hacim sınıfı × tekerrür süresi (10, 30, 100, 300 yıl).',
          'Arazi sınıflandırması (eğim + topoğrafik konum indeksi) haritada gösterilebilir; kot sınırları bölgeye göre ayarlanabilir.',
          'Kopma kalınlığı için İsviçre yöntemi: (ΔHS₃ + kot gradyanı + rüzgâr) · f(ψ), f(ψ) = 0,291 / (sin ψ − 0,202 cos ψ) (Salm vd. 1990); saha profili çukur eğimine göre ölçeklenir.',
          'Orman poligonu çizimi ve KML/KMZ ile orman alanı (μ +0,02, ξ ≤ 400).',
          'Proje kaydetme / açma (tarayıcıda) ve .slsproj dosyası olarak dışa / içe aktarma; sonuçlar ve zaman çizelgesi dahil.',
          'Sürekli renk skalası ve yumuşatılmış çizim seçeneği; zaman çizelgesi kayıt aralığı ayarı; sayısal yöntem seçimi.',
          'Kalibrasyon setleri tekdüze değer veya RAMMS tablosu üzerinde ölçek çarpanı olarak saklanabilir.',
        ],
      },
      en: {
        title: 'Second-order solver, RAMMS friction table, Swiss fracture depth, project saving',
        items: [
          'Second-order numerical method (MUSCL-MC + HLL + Heun/SSP-RK2) is now the default: in the gully test runout error at 10 m drops from 10% to 5% and speed error from 24% to 13%; runout error at 5 m is 2.6%.',
          'Friction parameters are assigned per cell from the MuXi table of the RAMMS::AVALANCHE manual: terrain class (open slope / channelled / gully / flat) × elevation band × volume class × return period (10, 30, 100, 300 years).',
          'Terrain classification (slope + topographic position index) can be shown on the map; elevation limits can be adjusted to the region.',
          'Swiss method for fracture depth: (ΔHS₃ + elevation gradient + wind) · f(ψ), f(ψ) = 0.291 / (sin ψ − 0.202 cos ψ) (Salm et al. 1990); field profiles are scaled by the pit slope.',
          'Forest polygons can be drawn or imported from KML/KMZ (μ +0.02, ξ ≤ 400).',
          'Project save / open (in the browser) and export / import as an .slsproj file, including results and timeline.',
          'Continuous colour scale and smooth rendering option; timeline recording interval; numerical method choice.',
          'Calibration sets can store a uniform value or scale factors applied to the RAMMS table.',
        ],
      },
    },
    {
      version: '0.5.0',
      date: '2026-10-10',
      tr: {
        title: 'Simülasyon zaman çizelgesi',
        items: [
          'Akış hesap sırasında kaydedilir (senaryo başına ~200 kare, etkin bölge kırpılarak 8 bit kodlanır).',
          'Zaman çizelgesi: oynat / duraklat, kaydırıcıyla ileri geri gitme, 5×–40× oynatma hızı.',
          'Akış yüksekliği veya hız görünümü; toz bulutu da oynatılır.',
          'Anlık en yüksek hız – zaman grafiği; grafiğe tıklayarak o ana atlama.',
          'T30 / T300 senaryolarının her biri için ayrı zaman çizelgesi.',
          'Rapora akış zaman dizisi şekli (olay süresinin %10, %30, %60 ve sonu) eklendi.',
        ],
      },
      en: {
        title: 'Simulation timeline',
        items: [
          'The flow is recorded during the computation (~200 frames per scenario, cropped to the active area and 8-bit encoded).',
          'Timeline: play / pause, scrub back and forth, 5×–40× playback speed.',
          'Flow height or speed view; the powder cloud is replayed too.',
          'Current max speed vs time chart; click the chart to jump to that moment.',
          'A separate timeline for each of the T30 / T300 scenarios.',
          'The report now includes a flow time-sequence figure (10%, 30%, 60% of the event and the end).',
        ],
      },
    },
    {
      version: '0.4.0',
      date: '2026-10-09',
      tr: {
        title: 'Saha platformu, T30 + T300 bölgeleme, sürüklenme, toz bulutu, KML/KMZ',
        items: [
          'Tamamlanmamış analiz denetimi: akış alan sınırına ulaşırsa arazi otomatik genişletilip hesap baştan yapılır (en fazla 3 kez); genişletilemezse sonuç, rapor ve KMZ "tamamlanmamış" olarak işaretlenir.',
          'Kar sürüklenmesi (entrainment): akış yolundaki örtü karını hıza bağlı olarak bünyesine katar; kütle korunur, aşınma haritası üretilir.',
          'Toz bulutu (deneysel): yüksek hızlı yoğun akıştan beslenen ikinci katman; hava katılımı, çökelme ve indirgenmiş yerçekimi; basınç haritası. Kalibre edilmemiştir.',
          'Rüzgâr yüklemesi: rüzgâraltı yamaçlarda kopma kalınlığı artırılır, rüzgârüstünde azaltılır.',
          'Saha platformu (saha.html): telefonda kar profili girişi — katman kalınlığı, yoğunluk / kar-su eşdeğeri, tane, sertlik, ıslaklık, zayıf katman, GPS, rüzgâr; kaydetme, paylaşma, simülatöre tek tıkla aktarım.',
          'Saha profili simülasyona aktarılır: kopma kalınlığı (zayıf katman üstü), kota göre kalınlık gradyanı, kar tipi, sürüklenebilir kar, rüzgâr.',
          'Tehlike bölgeleme modu: T30 ve T300 senaryoları sırayla çalışır, İsviçre şiddet–olasılık matrisiyle birleşik kırmızı/mavi/sarı bölge haritası üretilir.',
          'Sürtünme parametre kitaplığı: kuru, yoğun ve ıslak kar × tekerrür süresi × hacim sınıfı; kullanıcı kalibrasyon setleri kaydedilip otomatik kullanılabilir.',
          'KML/KMZ: çalışma alanı ve kopma alanı içe aktarımı; yapı/yol/parsel katmanı için risk tablosu (bölge, p, h, v); sonuçların Google Earth KMZ olarak dışa aktarımı.',
          'Rapor: saha profili tablosu, senaryo karşılaştırması, bölgeleme matrisi, sürüklenme ve toz bulutu haritaları, yapı/yol risk tablosu, tamamlanmamış analiz uyarısı.',
          'Çözücü testleri 19’a çıktı: sürüklenme ve toz bulutu kütle dengeleri, eşik davranışı, kenar bazlı taşma takibi.',
        ],
      },
      en: {
        title: 'Field platform, T30 + T300 zoning, entrainment, powder cloud, KML/KMZ',
        items: [
          'Incomplete-analysis control: if the flow reaches the area edge, the terrain is expanded automatically and recomputed (up to 3 times); otherwise the result, report and KMZ are marked "incomplete".',
          'Snow entrainment: the flow entrains snow cover along its path at a speed-dependent rate; mass is conserved and an erosion map is produced.',
          'Powder cloud (experimental): a second layer fed by fast dense flow, with air entrainment, settling and reduced gravity; pressure map. Not calibrated.',
          'Wind loading: fracture depth is increased on lee slopes and reduced on windward slopes.',
          'Field platform (saha.html): phone-friendly snow-profile entry — layer thickness, density / snow-water equivalent, grain, hardness, wetness, weak layer, GPS, wind; save, share, one-click transfer to the simulator.',
          'Field profiles feed the simulation: fracture depth (above weak layer), elevation gradient, snow type, erodible snow, wind.',
          'Hazard-zoning mode: T30 and T300 scenarios run in sequence and are combined with the Swiss intensity–probability matrix into a red/blue/yellow zone map.',
          'Friction-parameter library: dry, dense and wet snow × return period × volume class; user calibration sets can be saved and applied automatically.',
          'KML/KMZ: import of study area and release areas; risk table for building/road/parcel layers (zone, p, h, v); export of results as a Google Earth KMZ.',
          'Report: field-profile table, scenario comparison, zoning matrix, entrainment and powder maps, building/road risk table, incomplete-analysis warning.',
          'Solver tests increased to 19: entrainment and powder mass balances, threshold behaviour, per-edge outflow tracking.',
        ],
      },
    },
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
