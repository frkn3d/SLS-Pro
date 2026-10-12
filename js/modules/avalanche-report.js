/* SLS Pro — Çığ simülasyonu PDF mühendislik raporu
 * jsPDF (MIT) ve DejaVu Sans (serbest lisans, Türkçe karakter desteği) yalnızca
 * rapor üretilirken yüklenir. Haritalar arazi verisinden çizilir (figures.js).
 */
(function (SLS) {
  'use strict';

  const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
  const FONT_URL = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/';
  const G = 9.81;

  // ---------------------------------------------------------------------------
  const TXT = {
    tr: {
      eyebrow: 'ÇIĞ SİMÜLASYONU',
      title: 'Çığ Dinamiği Analiz Raporu',
      untitled: 'Adsız proje',
      header: 'SLS Pro · Çığ Dinamiği Analiz Raporu',
      page: 'Sayfa {a} / {b}',
      reportNo: 'Rapor no', date: 'Rapor tarihi', author: 'Hazırlayan', org: 'Kurum', location: 'Konum',
      coordWgs: 'Kopma alanı tepe noktası (WGS 84)', coordUtm: 'Kopma alanı tepe noktası (UTM)', software: 'Yazılım',
      coverFig: 'Şekil 1 — Tehlike bölgeleri ve akış yolu (genel görünüm).',
      kpiVol: 'Kopma hacmi', kpiV: 'En yüksek hız', kpiP: 'En yüksek basınç', kpiRun: 'Kaçış mesafesi', kpiAlpha: 'Kaçış açısı α', kpiAff: 'Etkilenen alan',
      coverNote: 'Bu rapor SLS Pro yazılımı ile otomatik üretilmiştir. Sonuçlar karar destek amaçlıdır; uygulamaya esas kararlar yetkin bir mühendis tarafından değerlendirilmelidir.',
      s1: '1. Yönetici özeti',
      summary: '{loc} için tanımlanan {area} ha büyüklüğündeki kopma alanından {vol} m³ hacimli kar kütlesinin hareketi Voellmy-Salm akış modeliyle simüle edilmiştir ({scen}). Çığ {t} s içinde yaklaşık {run} m yatay mesafe kat ederek {drop} m düşü yapmış ve α = {alpha}° kaçış açısıyla durmuştur. En yüksek akış hızı {v} m/s, en yüksek darbe basıncı {p} kPa olarak hesaplanmıştır. Basınç ölçütüne göre {red} ha kırmızı, {blue} ha mavi ve {yellow} ha sarı bölge belirlenmiştir.',
      thisArea: 'çalışma alanı',
      s2: '2. Arazi ve veri',
      demSource: 'Yükseklik verisi', demRes: 'Hesap ızgarası', crs: 'Koordinat sistemi', extent: 'Çalışma alanı', elevRange: 'Kot aralığı', crit: '30°–45° eğimli alan oranı', landcover: 'Arazi örtüsü', forestShare: 'orman', notUsed: 'kullanılmadı',
      s3: '3. Senaryo ve model',
      scenario: 'Senaryo', d0: 'Kopma kalınlığı d₀ (yamaca dik)', relArea: 'Kopma alanı', relVol: 'Kopma hacmi', relSlope: 'Kopma alanı ort. eğimi', relElev: 'Kopma alanı kotu',
      mu: 'Coulomb sürtünmesi μ', xi: 'Türbülans katsayısı ξ', rho: 'Akış yoğunluğu ρ', cd: 'Basınç katsayısı C_d', forest: 'Orman sürtünmesi', forestOn: 'μ +0,02, ξ = 400 m/s² (ormanlık hücreler)', tmax: 'En uzun süre', stopCrit: 'Durma ölçütü', stopVal: 'toplam momentum < en yüksek değerin %5’i',
      model: 'Akış, derinlik-ortalamalı sığ akış denklemleriyle iki boyutlu olarak çözülmüştür. Varsayılan sayısal yöntem ikinci derecedendir; hücre boyutuna bağlılık bu sayede azaltılmıştır. Sürtünme Voellmy-Salm yasasıyla tanımlanır: S_f = μ·g·h·cosθ + g·U²/ξ. Burada μ kuru (Coulomb) sürtünme, ξ türbülans katsayısı, θ yerel eğim ve U eğime paralel akış hızıdır. Denklemler birinci derece sonlu hacim yöntemi (HLL akısı) ile, eğime göre düzeltilmiş yerçekimi ve sürtünme terimleriyle çözülür. Darbe basıncı p = ½·C_d·ρ·U² bağıntısıyla hesaplanır.',
      verified: 'Çözücü; Voellmy limit hızı, Coulomb durma koşulu, kütle korunumu ve kaçış açısı için analitik çözümlerle doğrulanmıştır. Bu simülasyonda kütle dengesi hatası %{err} düzeyindedir.',
      s4: '4. Simülasyon sonuçları',
      param: 'Büyüklük', value: 'Değer',
      rV: 'En yüksek akış hızı', rP: 'En yüksek darbe basıncı', rH: 'En yüksek akış yüksekliği', rRun: 'Kaçış mesafesi (yatay)', rDrop: 'Düşü', rAlpha: 'Kaçış açısı α', rAff: 'Etkilenen alan (h ≥ 0,1 m)', rDep: 'Biriken hacim', rOut: 'Alan dışına çıkan hacim', rT: 'Olay süresi', rStop: 'Bitiş nedeni',
      figH: 'Şekil {n} — En yüksek akış yüksekliği h_max (m).', figV: 'Şekil {n} — En yüksek akış hızı v_max (m/s).', figP: 'Şekil {n} — En yüksek darbe basıncı p_max (kPa).', figD: 'Şekil {n} — Durma sonrası birikim yüksekliği (m).', figZ: 'Şekil {n} — Basınç ölçütüne göre tehlike bölgeleri.',
      figNote: 'Altlık: arazi verisinden gölgeli kabartma, eş yükselti aralığı {ci} m. Mavi çizgi: kopma alanı; siyah çizgi: akış yolu; üçgen: kopma tepe noktası; daire: akış ucu. Koordinatlar {crs} (m).',
      s5: '5. Akış yolu boykesiti',
      profFig: 'Şekil {n} — Akış yolu boyunca kot, en yüksek hız ve en yüksek basınç. Gri bant: kopma alanı.',
      profDesc: 'Akış yolu, akış ucunu besleyen kopma yamacının tepesinden başlayıp en hızlı akış çekirdeğini izleyerek akış ucuna kadar otomatik belirlenmiştir. β noktası ve sedde ön tahmini bu yol üzerinden hesaplanır.',
      dist: 'Mesafe (m)', elev: 'Kot (m)', slope: 'Eğim (°)', hmax: 'h_max (m)', vmax: 'v_max (m/s)', pmax: 'p_max (kPa)', zone: 'Bölge',
      zRed: 'Kırmızı', zBlue: 'Mavi', zYellow: 'Sarı', zNone: '—',
      s6: '6. Tehlike bölgelemesi (gösterge)',
      zoneCrit: 'Ölçüt', zoneArea: 'Alan (ha)', zoneMeaning: 'Anlamı',
      zRedC: 'p ≥ 30 kPa', zBlueC: '3 ≤ p < 30 kPa', zYellowC: 'p < 3 kPa, h ≥ 0,1 m',
      zRedM: 'Yüksek tehlike: kalıcı yapılaşma önerilmez.', zBlueM: 'Orta tehlike: yapılar tasarım basıncına göre güçlendirilmelidir.', zYellowM: 'Düşük tehlike: uyarı ve tahliye planlaması.',
      zoneNote: 'Bölgeler İsviçre çığ tehlike haritalama kılavuzunun basınç eşiklerine göre yalnızca bu senaryo için çizilmiştir. Resmî bölgeleme, farklı tekerrür süreli (ör. 30 ve 300 yıl) senaryoların birlikte değerlendirilmesini ve uzman görüşünü gerektirir.',
      s7: '7. Mühendislik değerlendirmesi ve öneriler',
      recRed: 'Kırmızı bölge ({a} ha): bu alanda yeni yapılaşma önerilmez; mevcut yapı ve yollar için kalıcı koruma veya yer değiştirme değerlendirilmelidir.',
      recBlue: 'Mavi bölge ({a} ha): yapılar, bulundukları noktadaki en yüksek darbe basıncına (bu senaryoda en fazla 30 kPa) göre tasarlanmalı; çığ yönündeki cephelerde açıklıklardan kaçınılmalıdır.',
      recYellow: 'Sarı bölge ({a} ha): çığ uyarı sistemi ve tahliye planlaması önerilir.',
      recRelease: 'Kopma alanı ({a} ha, ortalama eğim {s}°): kar destek yapıları (kar köprüleri, ağlar) ile kopmanın önlenmesi değerlendirilebilir. Yapı yükseklikleri, tasarım kar kalınlığı (d₀ = {d} m) ve yerel kar verileriyle belirlenmelidir.',
      recBeta: 'β noktası (yol boyunca eğimin ilk kez 10°’nin altına indiği yer): yol başından {d} m mesafede, {z} m kotta. β açısı {b}°. Norveç α-β modeli (α = 0,96β − 1,4°, standart sapma ≈ 2,3°) beklenen kaçış açısını {ab}° verir; simülasyonda aynı yol boyunca α = {a}° bulunmuştur.',
      recDam: 'Durdurma / yönlendirme seddesi ön tahmini (β noktası, v = {v} m/s, h = {h} m): H ≈ h + v²/(2·g·λ), λ ≈ 1,5 alınarak H ≈ {H} m. Bu değer yalnızca ön boyutlandırma içindir; sedde konumu ve geometrisi ayrıntılı analizle belirlenmelidir.',
      recNoBeta: 'Akış yolu boyunca eğimin 10°’nin altına indiği bir β noktası bulunamadı; kaçış bölgesi çalışma alanının dışına uzanıyor olabilir.',
      recGis: 'Risk altındaki yapı ve yolları belirlemek için h_max, v_max, p_max ve bölge katmanlarını (.asc) QGIS’te yapı ve ulaşım verileriyle çakıştırın.',
      recSens: 'Parametre belirsizliği için en az bir küçük (T≈30 yıl) ve bir büyük (T≈300 yıl) senaryo ile duyarlılık analizi yapılması önerilir.',
      recOut: 'Uyarı: kar kütlesinin {p} kadarı çalışma alanının dışına çıkmıştır. Sonuçlar eksiktir; daha geniş bir alanla yeniden hesaplanmalıdır.',
      recTmax: 'Uyarı: çığ en uzun süre dolduğunda hâlâ hareket ediyordu; süre artırılarak yeniden hesaplanmalıdır.',
      recForestOff: 'Orman örtüsünün sürtünme etkisi bu simülasyonda dikkate alınmamıştır; ormanlık yamaçlarda kaçış mesafesi daha kısa olabilir.',
      s8: '8. Sınırlamalar',
      limDemHi: 'Yükseklik modeli ({s}) {c} m ızgaraya yeniden örneklenmiştir; ızgara aralığından küçük topoğrafik öğeler (hendek, sedde, yol yarması) temsil edilmeyebilir.',
      limOrder2: 'İkinci derece sayısal yöntem ızgara bağımlılığını azaltır; yine de sonuçlar ızgara çözünürlüğüne bir ölçüde bağlıdır ve önemli kararlarda daha sık ızgarayla kontrol edilmelidir.',
      limHindcast: 'Gerçek olay doğrulaması (SLS Pro 0.8.3): 24 Ocak 2018 İsviçre çığ döneminden uydu ile haritalanmış 22 levha çığında kalibrasyonsuz geriye-tahmin — medyan F1 0,59, α farkı ortalaması −0,5° (RMSE 3,3°), vakaların %45’inde |Δα| ≤ 2°, medyan kaçış farkı 152 m; simülasyon ayak izi gözlenenden ortalama 1,7 kat geniştir (kopma alanı ve kalınlığı gözlemden tahmin edilmiştir). Sonuçlar bu belirsizlik düzeyinde yorumlanmalıdır.',
      limVal: 'Sonuçlar tek bir gözlenmiş çığa karşı doğrulanmış / kalibre edilmiştir; parametreler başka olaylarla doğrulanmadan bölgenin tamamına genellenmemelidir.',
      lim: [
        'Küresel 30 m yükseklik verisi daha sık ızgaraya yeniden örneklenmiştir; küçük ölçekli topoğrafik öğeler (hendek, sedde, yol yarması) temsil edilmeyebilir. Ayrıntılı çalışmalar için drone veya LiDAR verisi önerilir.',
        'Sürtünme parametreleri literatürdeki tipik aralıklardan alınmıştır ve bölgedeki gözlenmiş çığlarla kalibre edilmemiştir.',
        'Kar sürüklenmesi basitleştirilmiş hıza bağlı bir modelle, toz bulutu ise kalibre edilmemiş deneysel bir iki katmanlı modelle temsil edilir; toz bulutu sonuçları gösterge niteliğindedir. Kar örtüsünün mekânsal değişkenliği yalnızca saha profili ve kot gradyanı ölçüsünde dikkate alınır.',
        'Sürtünme parametre kitaplığı literatürdeki tipik aralıklardan derlenmiştir; kalibrasyon seti kullanılmadıysa değerler bölgeye özgü değildir.',
        'Birinci derece sayısal yöntem nispeten sönümleyicidir; sonuçlar ızgara çözünürlüğüne bağlıdır.',
        'Tehlike bölgeleri gösterge niteliğindedir ve resmî bölgeleme yerine geçmez.',
      ],
      s9: '9. Veri kaynakları ve atıflar',
      s10: '10. Onay',
      prepared: 'Hazırlayan', checked: 'Kontrol eden', approved: 'Onaylayan', name: 'Ad Soyad', signature: 'İmza', sigDate: 'Tarih',
      notes: 'Notlar',
      scen: { small: 'küçük senaryo, T≈30 yıl', medium: 'orta senaryo, T≈100 yıl', large: 'büyük senaryo, T≈300 yıl', custom: 'özel parametreler' },
      scenT: { 30: 'T≈30 yıl (sık)', 100: 'T≈100 yıl', 300: 'T≈300 yıl (seyrek)' },
      incomplete: 'TAMAMLANMAMIŞ ANALİZ',
      incompleteText: 'Bu analiz teknik olarak tamamlanmamıştır. {r} Durma mesafesi ve etki alanı eksik hesaplanmış olabilir; sonuçlar karar için kullanılmamalıdır.',
      analysisType: 'Analiz türü', modeSingle: 'Tek senaryo', modeDual: 'Tehlike bölgeleme (T30 + T300)',
      snowType: 'Kar tipi', snow: { dry: 'Kuru (toz) kar', dense: 'Yoğun kar', wet: 'Islak kar' },
      coverFigM: 'Şekil 1 — T30 + T300 şiddet–olasılık matrisine göre tehlike bölgeleri ve akış yolu.',
      sumEnt: 'Akış yolu boyunca {e} m³ kar sürüklenmiş; çığ hacmi kopma hacmine göre {p} büyümüştür.',
      sumPow: 'Deneysel toz bulutu modeli en yüksek {p} kPa basınç ve 0,5 kPa üzerinde {a} ha etki alanı vermiştir (gösterge niteliğinde).',
      expanded: 'Akış çalışma alanı sınırına ulaştığı için alan otomatik olarak {n} kez genişletilmiş ve hesap baştan yapılmıştır.',
      fpTitle: 'Saha verisi (kar profili)', fpName: 'Profil', fpObserver: 'Gözlemci', fpLoc: 'Konum', fpWx: 'Hava / rüzgâr',
      fpDerived: 'Türetilen değerler', fpSlab: 'Kopma levhası (zayıf katman üstü)', fpErod: 'Sürüklenebilir kar (≤ 200 kg/m³)',
      aspectW: 'bakı', slopeW: 'eğim', windOn: '{dir}° yönünden {s} m/s · kopma alanı ortalama eki +{m} cm (İsviçre kılavuzu, birikim yerlerinde en çok +{a} cm)', layers: 'katman',
      lNo: 'No', lTh: 'Kalınlık (cm)', lRho: 'Yoğunluk (kg/m³)', lSwe: 'SWE (mm)', lGrain: 'Tane', lHard: 'Sertlik', lWet: 'Islaklık', lWeak: 'Zayıf',
      gradNote: 'Kopma kalınlığı, profil kotundan ({z} m) itibaren 100 m’de 5 cm artacak şekilde her hücrenin kotuna göre ayarlanmıştır.',
      scenarioCol: 'Senaryo', retPeriod: 'Tekerrür süresi',
      frictionMethod: 'Sürtünme parametreleri', frictionMaps: 'RAMMS MuXi tablosu, hücre bazlı (arazi sınıfı × kot bandı × hacim × tekerrür); orman μ +0,02, ξ ≤ 400', frictionUniform: 'tekdüze değer (özel veya kalibrasyon seti)',
      releaseMethod: 'Kopma kalınlığı yöntemi', relMethods: { direct: 'doğrudan d₀ (yamaca dik)', swiss: 'İsviçre yöntemi: (ΔHS₃ + kot gradyanı + rüzgâr) · f(ψ), Salm vd. (1990)', field: 'saha profili: çukur levha kalınlığı · f(ψ)/f(ψ_çukur) + kot gradyanı' },
      numMethod: 'Sayısal yöntem', order1: '1. derece sonlu hacim (HLL)', order2: '2. derece sonlu hacim (MUSCL-MC + HLL + Heun/SSP-RK2)', paramSource: 'Parametre kaynağı', dRange: 'Kopma kalınlığı aralığı',
      windRow: 'Rüzgâr yüklemesi', entRow: 'Kar sürüklenmesi', entOn: 'örtü {d} m · ρ {r} kg/m³ · κ_e {k}', powRow: 'Toz bulutu', powOn: 'deneysel iki katmanlı model (kalibre edilmemiş)',
      modelEnt: 'Kar sürüklenmesi: yoğun akış, yolundaki örtü karını ė = κ_e·U hızıyla mevcut örtü bitene kadar bünyesine katar; alınan kar durgun kabul edilir ve kütle korunur.',
      modelPow: 'Toz bulutu (deneysel): hızı eşik değerini aşan yoğun akıştan beslenen ikinci bir sığ katman olarak çözülür; hava katılımıyla büyür, çökelir ve indirgenmiş yerçekimiyle hareket eder. Kalibre edilmemiştir.',
      rEnt: 'Sürüklenen kar', rPow: 'Toz bulutu en yüksek basıncı', rPowA: 'Toz bulutu etki alanı (≥ 0,5 kPa)',
      figEro: 'Şekil {n} — Aşınan örtü karı derinliği (m).',
      figSeq: 'Şekil {n} — Akış zaman dizisi: olay süresinin %10, %30, %60’ı ve sonundaki akış yüksekliği (m).',
      seqNote: 'Kareler hesap sırasında kaydedilmiştir; akış yüksekliği 8 bit kodlamayla saklandığından küçük yuvarlama farkları olabilir.', figPow: 'Şekil {n} — Toz bulutu en yüksek basıncı (kPa, deneysel).',
      powNote: 'Toz bulutu modeli kalibre edilmemiştir; gösterge niteliğindedir.',
      s6M: '6. Tehlike bölgelemesi (T30 + T300 matrisi)', figZM: 'Şekil {n} — Şiddet–olasılık matrisine göre tehlike bölgeleri.',
      mxHead: 'Şiddet \\ Olasılık', mxT30: 'T ≤ 30 yıl', mxT300: '30 < T ≤ 300 yıl',
      matrixNote: 'Matris, İsviçre çığ tehlike bölgeleme yaklaşımının şiddet (3 ve 30 kPa) ve olasılık (30 ve 300 yıl) eşiklerini uygular. Toz bulutu basıncı 3 kPa’yı aşan hücrelerde şiddete katılır, 1–3 kPa arası sarı bölge olarak gösterilir. Resmî bölgeleme uzman değerlendirmesi ve yetkili kurum onayı gerektirir.',
      sVal: 'Gözlenen çığa karşı doğrulama', valDesc: 'Simülasyon ayak izi (h ≥ 0,1 m) gözlenen çığ sınırıyla ({o}, senaryo {k}) karşılaştırılmıştır. F1 (Dice) ve CSI örtüşmeyi, Δα kaçış açısı farkını gösterir (α kopma alanının tepesinden en uzak etkilenen noktaya).', valMetric: 'Ölçüt', valSim: 'Simülasyon', valObs: 'Gözlem', valFit: 'Örtüşme (F1 / CSI)', valPR: 'Kesinlik / duyarlık', valArea: 'Etkilenen alan (ha)', valRunout: 'Kaçış mesafesi (m)', valAlpha: 'α açısı (°)',
      calDesc: 'Otomatik kalibrasyon: μ ve ξ haritaları ölçek çarpanlarıyla değiştirilmiş, her ξ çarpanı için kaçış mesafesi farkını sıfırlayan μ aranmıştır. Amaç J = (1 − F1) + |Δα|/10°. En iyi: μ ×{mu}, ξ ×{xi} (F1 {f1}, Δα {da}°).', calAlt: 'Benzer uyum veren {n} farklı çarpan çifti bulunmuştur (μ–ξ eşsonluğu); ξ tek olayın ayak izinden güvenilir biçimde belirlenemez.', recVal: 'Gözlenen çığla uyum zayıftır (F1 {f}, Δα {a}°); sonuçlar kalibre edilmeden kullanılmamalıdır.',
      sAssets: 'Yapı ve yol risk tablosu', assetsDesc: 'İçe aktarılan {n} unsurun her biri için {z} ile belirlenen bölge ve en yüksek etkiler.',
      byMatrix: 'T30 + T300 matrisi', bySingle: 'basınç ölçütü',
      aName: 'Unsur', aType: 'Tür', aLen: 'Etkilenen', geom: { Point: 'nokta', LineString: 'yol/hat', Polygon: 'alan' },
      recIncomplete: 'Analiz tamamlanmamıştır ({r}). Daha geniş bir çalışma alanıyla yeniden hesaplanmadan sonuçlar planlama kararlarında kullanılmamalıdır.',
      recDamHigh: 'Hesaplanan sedde yüksekliği 20 m’yi aşmaktadır ve pratik bir durdurma seddesi için uygun değildir. Bu konumda durdurma yerine yönlendirme seddeleri, akış yolunun daha aşağısında konumlandırma veya kopma alanında kar destek yapıları değerlendirilmelidir.',
      recAbLong: 'Simülasyonun kaçış açısı α-β modelinin beklentisinden {d}° daha düşüktür (iki standart sapmadan fazla): simülasyon belirgin şekilde daha uzun kaçış öngörmektedir. Bu muhafazakâr bir sonuç olabilir; ancak sürtünme parametreleri (özellikle büyük hacim ve sürüklenme ile birlikte) bölgede gözlenmiş çığlarla kalibre edilmelidir.',
      recAbShort: 'Simülasyonun kaçış açısı α-β modelinin beklentisinden {d}° daha yüksektir (iki standart sapmadan fazla): simülasyon kaçışı olduğundan kısa gösteriyor olabilir. Sürtünme parametreleri gözden geçirilmeli ve güvenli tarafta kalan bir senaryo ile karşılaştırılmalıdır.',
      recAbOk: 'Simülasyonun kaçış açısı α-β modelinin beklenti aralığındadır (± iki standart sapma); iki bağımsız yöntem tutarlıdır.',
      recAssets: '{n} yapı/yol unsuru kırmızı veya mavi bölgededir; bunlar için ayrıntılı yapısal değerlendirme ve koruma önlemleri öncelikle ele alınmalıdır.',
      recEnt: 'Kar sürüklenmesi çığ hacmini {p} artırmıştır; örtü karı kalınlığının mevsim içindeki değişimi sonuçları belirgin etkiler, farklı örtü kalınlıklarıyla duyarlılık analizi önerilir.',
      recPow: 'Toz bulutu sonuçları deneysel bir modelden gelmektedir; yapı tasarımında kullanılmadan önce gözlem veya kalibre edilmiş bir modelle doğrulanmalıdır.',
      recWind: 'Rüzgâr yüklemesi rüzgâraltı yamaçlarda kopma kalınlığını artırmıştır; hâkim rüzgâr yönü için yerel meteoroloji kayıtları ile doğrulanmalıdır.',
      stop: { momentum: 'Çığ durdu (momentum ölçütü)', stopped: 'Çığ durdu', tmax: 'En uzun süreye ulaşıldı', user: 'Kullanıcı durdurdu', empty: 'Akış alan dışına çıktı' },
    },
    en: {
      eyebrow: 'AVALANCHE SIMULATION',
      title: 'Avalanche Dynamics Analysis Report',
      untitled: 'Untitled project',
      header: 'SLS Pro · Avalanche Dynamics Analysis Report',
      page: 'Page {a} / {b}',
      reportNo: 'Report no.', date: 'Report date', author: 'Prepared by', org: 'Organisation', location: 'Location',
      coordWgs: 'Release-zone top (WGS 84)', coordUtm: 'Release-zone top (UTM)', software: 'Software',
      coverFig: 'Figure 1 — Hazard zones and flow path (overview).',
      kpiVol: 'Release volume', kpiV: 'Peak speed', kpiP: 'Peak pressure', kpiRun: 'Runout distance', kpiAlpha: 'Runout angle α', kpiAff: 'Affected area',
      coverNote: 'This report was generated automatically by SLS Pro. Results are for decision support; decisions must be reviewed by a qualified engineer.',
      s1: '1. Executive summary',
      summary: 'The motion of a {vol} m³ snow mass released from a {area} ha release area at {loc} was simulated with the Voellmy-Salm flow model ({scen}). The avalanche travelled about {run} m horizontally in {t} s with a vertical drop of {drop} m, stopping at a runout angle of α = {alpha}°. Peak flow speed was {v} m/s and peak impact pressure {p} kPa. By the pressure criterion, {red} ha red, {blue} ha blue and {yellow} ha yellow zone were identified.',
      thisArea: 'the study area',
      s2: '2. Terrain and data',
      demSource: 'Elevation data', demRes: 'Computational grid', crs: 'Coordinate system', extent: 'Study area', elevRange: 'Elevation range', crit: 'Share of 30°–45° slopes', landcover: 'Land cover', forestShare: 'forest', notUsed: 'not used',
      s3: '3. Scenario and model',
      scenario: 'Scenario', d0: 'Fracture depth d₀ (slope-normal)', relArea: 'Release area', relVol: 'Release volume', relSlope: 'Mean release slope', relElev: 'Release elevation',
      mu: 'Coulomb friction μ', xi: 'Turbulence coefficient ξ', rho: 'Flow density ρ', cd: 'Pressure coefficient C_d', forest: 'Forest friction', forestOn: 'μ +0.02, ξ = 400 m/s² (forest cells)', tmax: 'Maximum duration', stopCrit: 'Stopping criterion', stopVal: 'total momentum < 5% of its peak',
      model: 'The flow is solved in two dimensions with the depth-averaged shallow-flow equations. The default numerical method is second order, which reduces grid dependence. Friction follows the Voellmy-Salm law: S_f = μ·g·h·cosθ + g·U²/ξ, where μ is dry (Coulomb) friction, ξ the turbulence coefficient, θ the local slope and U the slope-parallel speed. The equations are solved with a first-order finite-volume method (HLL flux) with slope-corrected gravity and friction terms. Impact pressure is p = ½·C_d·ρ·U².',
      verified: 'The solver has been verified against analytic solutions for the Voellmy terminal speed, the Coulomb stopping condition, mass conservation and runout angle. The mass-balance error in this simulation is {err}%.',
      s4: '4. Simulation results',
      param: 'Quantity', value: 'Value',
      rV: 'Peak flow speed', rP: 'Peak impact pressure', rH: 'Peak flow height', rRun: 'Runout distance (horizontal)', rDrop: 'Vertical drop', rAlpha: 'Runout angle α', rAff: 'Affected area (h ≥ 0.1 m)', rDep: 'Deposited volume', rOut: 'Volume leaving the area', rT: 'Event duration', rStop: 'End reason',
      figH: 'Figure {n} — Peak flow height h_max (m).', figV: 'Figure {n} — Peak flow speed v_max (m/s).', figP: 'Figure {n} — Peak impact pressure p_max (kPa).', figD: 'Figure {n} — Deposit height after stopping (m).', figZ: 'Figure {n} — Hazard zones by pressure criterion.',
      figNote: 'Base: hillshade from terrain data, contour interval {ci} m. Blue line: release area; black line: flow path; triangle: release top; circle: flow tip. Coordinates {crs} (m).',
      s5: '5. Flow-path profile',
      profFig: 'Figure {n} — Elevation, peak speed and peak pressure along the flow path. Grey band: release area.',
      profDesc: 'The flow path is determined automatically from the top of the release slope that feeds the flow tip, following the fastest flow core to the tip. The β point and dam pre-estimate are computed along this path.',
      dist: 'Distance (m)', elev: 'Elevation (m)', slope: 'Slope (°)', hmax: 'h_max (m)', vmax: 'v_max (m/s)', pmax: 'p_max (kPa)', zone: 'Zone',
      zRed: 'Red', zBlue: 'Blue', zYellow: 'Yellow', zNone: '—',
      s6: '6. Hazard zoning (indicative)',
      zoneCrit: 'Criterion', zoneArea: 'Area (ha)', zoneMeaning: 'Meaning',
      zRedC: 'p ≥ 30 kPa', zBlueC: '3 ≤ p < 30 kPa', zYellowC: 'p < 3 kPa, h ≥ 0.1 m',
      zRedM: 'High hazard: no permanent construction recommended.', zBlueM: 'Moderate hazard: structures must be reinforced for the design pressure.', zYellowM: 'Low hazard: warning and evacuation planning.',
      zoneNote: 'Zones follow the pressure thresholds of the Swiss avalanche hazard mapping guideline for this scenario only. Official zoning requires combining scenarios of different return periods (e.g. 30 and 300 years) and expert judgement.',
      s7: '7. Engineering assessment and recommendations',
      recRed: 'Red zone ({a} ha): no new construction is recommended; permanent protection or relocation should be considered for existing buildings and roads.',
      recBlue: 'Blue zone ({a} ha): structures must be designed for the peak impact pressure at their location (at most 30 kPa in this scenario); openings in avalanche-facing walls should be avoided.',
      recYellow: 'Yellow zone ({a} ha): an avalanche warning system and evacuation planning are recommended.',
      recRelease: 'Release area ({a} ha, mean slope {s}°): preventing release with snow-supporting structures (snow bridges, nets) may be considered. Structure heights must be set from the design snow depth (d₀ = {d} m) and local snow data.',
      recBeta: 'β point (first point along the path where slope drops below 10°): {d} m from the path start at {z} m elevation. β angle {b}°. The Norwegian α-β model (α = 0.96β − 1.4°, standard deviation ≈ 2.3°) predicts a runout angle of {ab}°; the simulation gives α = {a}° along the same path.',
      recDam: 'Catching / deflecting dam pre-estimate (β point, v = {v} m/s, h = {h} m): H ≈ h + v²/(2·g·λ) with λ ≈ 1.5 gives H ≈ {H} m. This is for preliminary sizing only; dam location and geometry require detailed analysis.',
      recNoBeta: 'No β point (slope below 10°) was found along the flow path; the runout zone may extend beyond the study area.',
      recGis: 'To identify exposed buildings and roads, overlay the h_max, v_max, p_max and zone layers (.asc) with building and road data in QGIS.',
      recSens: 'Given parameter uncertainty, a sensitivity analysis with at least one small (T≈30 yr) and one large (T≈300 yr) scenario is recommended.',
      recOut: 'Warning: {p} of the snow mass left the study area. Results are incomplete; recompute with a larger area.',
      recTmax: 'Warning: the avalanche was still moving when the maximum duration ended; recompute with a longer duration.',
      recForestOff: 'The friction effect of forest cover was not included in this simulation; runout may be shorter on forested slopes.',
      s8: '8. Limitations',
      limDemHi: 'The elevation model ({s}) was resampled to a {c} m grid; topographic features smaller than the grid spacing (ditches, dams, road cuts) may not be represented.',
      limOrder2: 'The second-order numerical scheme reduces grid dependence; results still depend somewhat on grid resolution and should be checked with a finer grid for important decisions.',
      limHindcast: 'Real-event validation (SLS Pro 0.8.3): uncalibrated hindcast of 22 satellite-mapped slab avalanches from the 24 January 2018 Swiss avalanche period — median F1 0.59, mean α difference −0.5° (RMSE 3.3°), |Δα| ≤ 2° in 45% of cases, median runout difference 152 m; the simulated footprint is on average 1.7 times wider than observed (release area and depth estimated from the observations). Results should be interpreted at this level of uncertainty.',
      limVal: 'Results were validated / calibrated against a single observed avalanche; parameters should not be generalised to the whole region without validation against other events.',
      lim: [
        'Global 30 m elevation data were resampled to a finer grid; small topographic features (ditches, dams, road cuts) may not be represented. Drone or LiDAR data are recommended for detailed studies.',
        'Friction parameters are taken from typical literature ranges and have not been calibrated against observed avalanches in the area.',
        'Snow entrainment is represented by a simplified speed-dependent model and the powder cloud by an uncalibrated experimental two-layer model; powder results are indicative. Spatial variability of the snow cover is only considered through the field profile and elevation gradient.',
        'The friction-parameter library is compiled from typical literature ranges; unless a calibration set is used, values are not site-specific.',
        'The first-order numerical scheme is relatively diffusive; results depend on grid resolution.',
        'Hazard zones are indicative and do not replace official zoning.',
      ],
      s9: '9. Data sources and attribution',
      s10: '10. Approval',
      prepared: 'Prepared by', checked: 'Checked by', approved: 'Approved by', name: 'Name', signature: 'Signature', sigDate: 'Date',
      notes: 'Notes',
      scen: { small: 'small scenario, T≈30 yr', medium: 'medium scenario, T≈100 yr', large: 'large scenario, T≈300 yr', custom: 'custom parameters' },
      scenT: { 30: 'T≈30 yr (frequent)', 100: 'T≈100 yr', 300: 'T≈300 yr (rare)' },
      incomplete: 'INCOMPLETE ANALYSIS',
      incompleteText: 'This analysis is technically incomplete. {r} Runout and affected area may be underestimated; the results must not be used for decisions.',
      analysisType: 'Analysis type', modeSingle: 'Single scenario', modeDual: 'Hazard zoning (T30 + T300)',
      snowType: 'Snow type', snow: { dry: 'Dry (powder) snow', dense: 'Dense snow', wet: 'Wet snow' },
      coverFigM: 'Figure 1 — Hazard zones by the T30 + T300 intensity–probability matrix and flow path.',
      sumEnt: '{e} m³ of snow was entrained along the path; the avalanche grew by {p} relative to the release volume.',
      sumPow: 'The experimental powder-cloud model gives a peak pressure of {p} kPa and a footprint of {a} ha above 0.5 kPa (indicative).',
      expanded: 'Because the flow reached the edge of the study area, the area was expanded automatically {n} time(s) and the computation restarted.',
      fpTitle: 'Field data (snow profile)', fpName: 'Profile', fpObserver: 'Observer', fpLoc: 'Location', fpWx: 'Weather / wind',
      fpDerived: 'Derived values', fpSlab: 'Slab (above weak layer)', fpErod: 'Erodible snow (≤ 200 kg/m³)',
      aspectW: 'aspect', slopeW: 'slope', windOn: 'from {dir}° at {s} m/s · release-area mean surcharge +{m} cm (Swiss guideline, up to +{a} cm at deposits)', layers: 'layers',
      lNo: 'No.', lTh: 'Thickness (cm)', lRho: 'Density (kg/m³)', lSwe: 'SWE (mm)', lGrain: 'Grain', lHard: 'Hardness', lWet: 'Wetness', lWeak: 'Weak',
      gradNote: 'Fracture depth is adjusted to each cell’s elevation, increasing 5 cm per 100 m from the profile elevation ({z} m).',
      scenarioCol: 'Scenario', retPeriod: 'Return period',
      frictionMethod: 'Friction parameters', frictionMaps: 'RAMMS MuXi table, per cell (terrain class × elevation band × volume × return period); forest μ +0.02, ξ ≤ 400', frictionUniform: 'uniform value (custom or calibration set)',
      releaseMethod: 'Fracture-depth method', relMethods: { direct: 'direct d₀ (slope-normal)', swiss: 'Swiss method: (ΔHS₃ + elevation gradient + wind) · f(ψ), Salm et al. (1990)', field: 'field profile: pit slab depth · f(ψ)/f(ψ_pit) + elevation gradient' },
      numMethod: 'Numerical method', order1: '1st-order finite volume (HLL)', order2: '2nd-order finite volume (MUSCL-MC + HLL + Heun/SSP-RK2)', paramSource: 'Parameter source', dRange: 'Fracture depth range',
      windRow: 'Wind loading', entRow: 'Snow entrainment', entOn: 'cover {d} m · ρ {r} kg/m³ · κ_e {k}', powRow: 'Powder cloud', powOn: 'experimental two-layer model (not calibrated)',
      modelEnt: 'Snow entrainment: the dense flow entrains the snow cover on its path at a rate ė = κ_e·U until the cover is exhausted; entrained snow is assumed at rest and mass is conserved.',
      modelPow: 'Powder cloud (experimental): solved as a second shallow layer fed by dense flow above a threshold speed; it grows by air entrainment, settles and moves under reduced gravity. Not calibrated.',
      rEnt: 'Entrained snow', rPow: 'Peak powder-cloud pressure', rPowA: 'Powder footprint (≥ 0.5 kPa)',
      figEro: 'Figure {n} — Eroded snow-cover depth (m).',
      figSeq: 'Figure {n} — Flow time sequence: flow height (m) at 10%, 30%, 60% of the event duration and at the end.',
      seqNote: 'Frames were recorded during the computation; flow height is stored with 8-bit encoding, so small rounding differences may occur.', figPow: 'Figure {n} — Peak powder-cloud pressure (kPa, experimental).',
      powNote: 'The powder-cloud model is not calibrated; indicative only.',
      s6M: '6. Hazard zoning (T30 + T300 matrix)', figZM: 'Figure {n} — Hazard zones by the intensity–probability matrix.',
      mxHead: 'Intensity \\ Probability', mxT30: 'T ≤ 30 yr', mxT300: '30 < T ≤ 300 yr',
      matrixNote: 'The matrix applies the intensity (3 and 30 kPa) and probability (30 and 300 years) thresholds of the Swiss avalanche hazard zoning approach. Powder-cloud pressure above 3 kPa adds to intensity; 1–3 kPa is shown as yellow. Official zoning requires expert assessment and approval by the competent authority.',
      sVal: 'Validation against an observed avalanche', valDesc: 'The simulated footprint (h ≥ 0.1 m) is compared with the observed avalanche outline ({o}, scenario {k}). F1 (Dice) and CSI measure overlap, Δα the runout-angle difference (α from the top of the release area to the farthest affected point).', valMetric: 'Metric', valSim: 'Simulated', valObs: 'Observed', valFit: 'Overlap (F1 / CSI)', valPR: 'Precision / recall', valArea: 'Affected area (ha)', valRunout: 'Runout distance (m)', valAlpha: 'α angle (°)',
      calDesc: 'Automatic calibration: the μ and ξ maps were scaled by factors; for each ξ factor the μ zeroing the runout-distance difference was searched. Objective J = (1 − F1) + |Δα|/10°. Best: μ ×{mu}, ξ ×{xi} (F1 {f1}, Δα {da}°).', calAlt: '{n} other factor pair(s) give a similar fit (μ–ξ equifinality); ξ cannot be determined reliably from the footprint of a single event.', recVal: 'Agreement with the observed avalanche is poor (F1 {f}, Δα {a}°); results should not be used without calibration.',
      sAssets: 'Building and road risk table', assetsDesc: 'Zone determined by the {z} and peak impacts for each of the {n} imported features.',
      byMatrix: 'T30 + T300 matrix', bySingle: 'pressure criterion',
      aName: 'Feature', aType: 'Type', aLen: 'Affected', geom: { Point: 'point', LineString: 'road/line', Polygon: 'area' },
      recIncomplete: 'The analysis is incomplete ({r}). Results must not be used for planning decisions until recomputed with a larger study area.',
      recDamHigh: 'The computed dam height exceeds 20 m and is not practical for a catching dam. Consider deflecting dams, a location further down the path, or snow-supporting structures in the release area instead.',
      recAbLong: 'The simulated runout angle is {d}° lower than the α-β expectation (more than two standard deviations): the simulation predicts a markedly longer runout. This may be conservative, but friction parameters (especially with large volume and entrainment) should be calibrated against avalanches observed in the area.',
      recAbShort: 'The simulated runout angle is {d}° higher than the α-β expectation (more than two standard deviations): the simulation may underestimate runout. Review the friction parameters and compare with a scenario on the safe side.',
      recAbOk: 'The simulated runout angle lies within the α-β expectation (± two standard deviations); the two independent methods agree.',
      recAssets: '{n} building/road feature(s) lie in the red or blue zone; detailed structural assessment and protection measures should be prioritised for them.',
      recEnt: 'Entrainment increased the avalanche volume by {p}; the seasonal variation of snow-cover depth strongly affects results, so a sensitivity analysis with different cover depths is recommended.',
      recPow: 'Powder-cloud results come from an experimental model; they must be verified by observation or a calibrated model before use in structural design.',
      recWind: 'Wind loading increased fracture depth on lee slopes; verify the prevailing wind direction with local meteorological records.',
      stop: { momentum: 'Avalanche stopped (momentum criterion)', stopped: 'Avalanche stopped', tmax: 'Maximum duration reached', user: 'Stopped by user', empty: 'Flow left the area' },
    },
  };

  // ---------------------------------------------------------------------------
  // Kaynak yükleme (bir kez)
  let assetsPromise = null;
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src));
      document.head.appendChild(s);
    });
  }
  function b64(buf) {
    const bytes = new Uint8Array(buf); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function loadAssets() {
    if (assetsPromise) return assetsPromise;
    assetsPromise = (async () => {
      if (!window.jspdf) await loadScript(JSPDF_URL);
      const [reg, bold] = await Promise.all(['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map(async (f) => {
        const r = await fetch(FONT_URL + f);
        if (!r.ok) throw new Error('font ' + r.status);
        return r.arrayBuffer();
      }));
      // Kanvas şekilleri de aynı fontu kullansın
      try {
        const f1 = new FontFace('DejaVu Sans', reg), f2 = new FontFace('DejaVu Sans', bold, { weight: 'bold' });
        await Promise.all([f1.load(), f2.load()]);
        document.fonts.add(f1); document.fonts.add(f2);
      } catch (_) { /* kanvas yedek fonta düşer */ }
      return { reg: b64(reg), bold: b64(bold) };
    })();
    assetsPromise.catch(() => { assetsPromise = null; });
    return assetsPromise;
  }

  // ---------------------------------------------------------------------------
  // Sayfa düzeni yardımcıları (mm)
  const PAGE = { w: 210, h: 297, ml: 18, mr: 18, mt: 22, mb: 20 };
  const C = { ink: [17, 24, 39], ink2: [75, 85, 99], muted: [107, 114, 128], rule: [209, 213, 219], fill: [243, 244, 246], accent: [14, 116, 144] };

  class Doc {
    constructor(fonts) {
      const { jsPDF } = window.jspdf;
      this.d = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      this.d.addFileToVFS('DejaVuSans.ttf', fonts.reg);
      this.d.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
      this.d.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold);
      this.d.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
      this.d.setFont('DejaVu', 'normal');
      this.y = PAGE.mt;
      this.cw = PAGE.w - PAGE.ml - PAGE.mr;
    }
    font(size, bold, color) { this.d.setFont('DejaVu', bold ? 'bold' : 'normal'); this.d.setFontSize(size); this.d.setTextColor(...(color || C.ink)); }
    space(h) { if (this.y + h > PAGE.h - PAGE.mb) this.page(); }
    page() { this.d.addPage(); this.y = PAGE.mt; }
    gap(h) { this.y += h; }
    h1(text) {
      this.space(42);   // başlık sayfa sonunda yalnız kalmasın
      this.gap(3);
      this.font(13, true, C.accent);
      this.d.text(text, PAGE.ml, this.y + 4.5);
      this.y += 7;
      this.d.setDrawColor(...C.accent); this.d.setLineWidth(0.4);
      this.d.line(PAGE.ml, this.y, PAGE.ml + this.cw, this.y);
      this.y += 4;
    }
    h2(text) {
      this.space(12);
      this.gap(1);
      this.font(10.5, true, C.ink);
      this.d.text(text, PAGE.ml, this.y + 4);
      this.y += 7;
    }
    banner(title, text) {
      this.font(8.6, false);
      const lines = this.d.splitTextToSize(text, this.cw - 8);
      const h = 9 + lines.length * 3.8;
      this.space(h + 3);
      this.d.setFillColor(254, 226, 226); this.d.setDrawColor(220, 38, 38); this.d.setLineWidth(0.5);
      this.d.roundedRect(PAGE.ml, this.y, this.cw, h, 1.5, 1.5, 'FD');
      this.font(10, true, [153, 27, 27]); this.d.text(title, PAGE.ml + 4, this.y + 6);
      this.font(8.6, false, [127, 29, 29]); this.d.text(lines, PAGE.ml + 4, this.y + 10.5);
      this.y += h + 4;
    }
    para(text, size, color, indent) {
      this.font(size || 9.5, false, color || C.ink);
      const lines = this.d.splitTextToSize(text, this.cw - (indent || 0));
      const lh = (size || 9.5) * 0.43;
      for (const ln of lines) { this.space(lh + 1); this.d.text(ln, PAGE.ml + (indent || 0), this.y + lh * 0.8); this.y += lh; }
      this.y += 2.2;
    }
    bullets(items, size) {
      for (const it of items) {
        this.font(size || 9.5, false);
        const lines = this.d.splitTextToSize(it, this.cw - 5);
        const lh = (size || 9.5) * 0.43;
        this.space(lh * Math.min(lines.length, 3) + 1);
        this.d.setFillColor(...C.accent);
        this.d.circle(PAGE.ml + 1.4, this.y + lh * 0.55, 0.7, 'F');
        for (const ln of lines) { this.space(lh); this.d.text(ln, PAGE.ml + 5, this.y + lh * 0.8); this.y += lh; }
        this.y += 1.6;
      }
      this.y += 1;
    }
    /** Tablo: headers dizi ya da null; widths mm; align 'l'|'r' dizisi */
    table(headers, rows, widths, align) {
      const pad = 1.8, fs = 8.6, lh = fs * 0.42;
      const drawRow = (cells, header, zebra) => {
        this.font(fs, header, header ? C.ink : C.ink);
        const wrapped = cells.map((c, k) => this.d.splitTextToSize(String(c), widths[k] - pad * 2));
        const h = Math.max(...wrapped.map((w) => w.length)) * lh + pad * 2;
        this.space(h);
        if (header || zebra) { this.d.setFillColor(...(header ? [229, 231, 235] : C.fill)); this.d.rect(PAGE.ml, this.y, widths.reduce((a, b) => a + b, 0), h, 'F'); }
        let x = PAGE.ml;
        wrapped.forEach((lines, k) => {
          const right = align && align[k] === 'r';
          lines.forEach((ln, j) => this.d.text(ln, right ? x + widths[k] - pad : x + pad, this.y + pad + lh * (j + 0.8), { align: right ? 'right' : 'left' }));
          x += widths[k];
        });
        this.y += h;
        this.d.setDrawColor(...C.rule); this.d.setLineWidth(0.15);
        this.d.line(PAGE.ml, this.y, PAGE.ml + widths.reduce((a, b) => a + b, 0), this.y);
      };
      // Kısa tabloları bölme: sığmıyorsa yeni sayfada başlat
      const est = (rows.length + (headers ? 1 : 0)) * (lh + pad * 2 + 0.6);
      if (est < 150 && this.y + est > PAGE.h - PAGE.mb) this.page();
      if (headers) drawRow(headers, true);
      rows.forEach((r, i) => drawRow(r, false, i % 2 === 1));
      this.y += 4;
    }
    figure(canvas, caption, note, legend, maxH) {
      const ratio = canvas.height / canvas.width;
      let w = this.cw, h = w * ratio;
      if (maxH && h > maxH) { h = maxH; w = h / ratio; }
      const legendH = legend ? 6 : 0, noteH = note ? 8 : 0;
      this.space(h + 10 + legendH + noteH);
      this.d.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', PAGE.ml + (this.cw - w) / 2, this.y, w, h, undefined, 'FAST');
      this.y += h + 2;
      if (legend) this.legend(legend);
      this.font(8.6, true, C.ink); this.d.text(this.d.splitTextToSize(caption, this.cw), PAGE.ml, this.y + 3.2);
      this.y += 4.6;
      if (note) this.para(note, 7.6, C.muted);
      else this.y += 2;
    }
    legend(items) {
      this.font(7.6, false, C.ink2);
      let x = PAGE.ml;
      for (const it of items) {
        const tw = this.d.getTextWidth(it.label);
        if (x + 5 + tw > PAGE.ml + this.cw) { x = PAGE.ml; this.y += 4.5; }
        this.d.setFillColor(...it.color); this.d.rect(x, this.y + 0.6, 3.6, 2.6, 'F');
        this.d.text(it.label, x + 4.8, this.y + 2.9);
        x += 4.8 + tw + 5;
      }
      this.y += 5.5;
    }
    kpis(items) {
      const cols = 3, gapX = 3, w = (this.cw - gapX * (cols - 1)) / cols, h = 15;
      items.forEach((it, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const x = PAGE.ml + c * (w + gapX), y = this.y + r * (h + 3);
        this.d.setFillColor(...C.fill); this.d.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
        this.font(7.8, false, C.muted); this.d.text(it.k, x + 3, y + 5);
        this.font(12.5, true, C.ink); this.d.text(it.v, x + 3, y + 11.6);
        if (it.u) { const vw = this.d.getTextWidth(it.v); this.font(8, false, C.muted); this.d.text(it.u, x + 3 + vw + 1, y + 11.6); }
      });
      this.y += Math.ceil(items.length / cols) * (h + 3) + 2;
    }
    decorate(T, project, incomplete) {
      const n = this.d.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        this.d.setPage(i);
        if (i > 1) {
          this.font(7.4, false, C.muted);
          if (incomplete) { this.font(7.4, true, [185, 28, 28]); this.d.text(T.incomplete, PAGE.w / 2, 12, { align: 'center' }); this.font(7.4, false, C.muted); }
          this.d.text(T.header, PAGE.ml, 12);
          this.d.text(project, PAGE.w - PAGE.mr, 12, { align: 'right' });
          this.d.setDrawColor(...C.rule); this.d.setLineWidth(0.2); this.d.line(PAGE.ml, 14, PAGE.w - PAGE.mr, 14);
        }
        this.font(7.4, false, C.muted);
        this.d.text(`SLS Pro ${SLS.VERSION}`, PAGE.ml, PAGE.h - 10);
        this.d.text(T.page.replace('{a}', i).replace('{b}', n), PAGE.w - PAGE.mr, PAGE.h - 10, { align: 'right' });
      }
    }
  }

  // ---------------------------------------------------------------------------
  const fmt = (v, d) => SLS.i18n.number(v, d);
  const fill = (s, o) => Object.keys(o).reduce((a, k) => a.split('{' + k + '}').join(o[k]), s);

  function legendItems(rampId, T) {
    const ramp = SLS.raster.RAMPS[rampId];
    return ramp.classes.map((c) => ({
      color: c.color,
      label: c.key ? SLS.i18n.t(c.key) : (c.max === Infinity ? `≥ ${fmt(c.min, c.min < 1 ? 2 : 0)} ${ramp.unit}` : `${fmt(c.min, c.min < 1 ? 2 : 0)}–${fmt(c.max, c.max < 1 ? 1 : 0)} ${ramp.unit}`),
    }));
  }

  /** β noktası, sedde ön tahmini ve α-β karşılaştırması için yol analizi. */
  function betaAnalysis(prof) {
    if (!prof || prof.d.length < 3) return null;
    // Yerel eğim: ±3 nokta merkezli fark (gürültüyü azaltır)
    const n = prof.d.length;
    let last = 0;
    for (let i = 0; i < n; i++) if (prof.release[i]) last = i;
    for (let i = last + 1; i < n; i++) {
      const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3);
      const dd = prof.d[b] - prof.d[a];
      if (dd <= 0) continue;
      const sl = Math.atan((prof.z[a] - prof.z[b]) / dd) * 180 / Math.PI;
      if (sl < 10) {
        const beta = Math.atan((prof.z[0] - prof.z[i]) / prof.d[i]) * 180 / Math.PI;
        const v = prof.v[i], h = prof.h[i];
        const e = n - 1, alphaPath = Math.atan((prof.z[0] - prof.z[e]) / prof.d[e]) * 180 / Math.PI;
        return { i, d: prof.d[i], z: prof.z[i], beta, alphaAB: 0.96 * beta - 1.4, alphaPath, v, h, H: h + v * v / (2 * G * 1.5) };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  /**
   * ctx = { terrain, terrainStats, slope, aspect, release:{mask, stats, d0}, params, result, analysis,
   *         profile, landcover:{used, forestFraction}, meta:{project, location, author, org, notes},
   *         sourceName, onProgress(fraction) }
   */
  async function build(ctx) {
    const T = TXT[SLS.i18n.lang] || TXT.en;
    const P = ctx.onProgress || (() => {});
    P(0.05);
    const fonts = await loadAssets();
    P(0.25);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const tr = ctx.terrain, A = ctx.analysis, R = ctx.result, rel = ctx.release, par = ctx.params, M = ctx.meta;
    const runs = ctx.runs || {}, keys = Object.keys(runs), dual = !!ctx.zoning;
    const W = tr.width;
    const project = (M.project || '').trim() || T.untitled;
    const crsDesc = SLS.proj.describe(tr.epsg);
    const conv = SLS.proj.converter(tr.epsg);
    const cellCenter = (i) => { const r = (i / W) | 0, c = i - r * W; return [tr.originX + (c + 0.5) * tr.cellSize, tr.originY - (r + 0.5) * tr.cellSize]; };
    const topXY = cellCenter(A.iTop), topLL = conv.inverse(topXY);
    const now = new Date();
    const pad2 = (x) => String(x).padStart(2, '0');
    const reportNo = `SLS-AV-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
    const dateStr = now.toLocaleDateString(SLS.i18n.lang === 'tr' ? 'tr-TR' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    const pctS = (f, dg) => (SLS.i18n.lang === 'tr' ? '%' + fmt(f * 100, dg ?? 1) : fmt(f * 100, dg ?? 1) + '%');
    const scenName = (Tv) => T.scenT[Tv] || ('T≈' + Tv);
    let secNo = 0;
    const H1 = (title) => doc.h1(`${++secNo}. ${title.replace(/^\d+\.\s*/, '')}`);

    // ---- Şekiller ----
    const anyFlow = (i) => { for (const k of keys) if (runs[k].result.hmax[i] >= 0.05) return true; return rel.mask[i] === 1 || (R.powder && R.powder.pmax[i] >= 0.5); };
    const view = SLS.figures.fitView(tr, anyFlow, { margin: 0.1, minAspect: 0.5, maxAspect: 0.78 });
    let zmin = Infinity, zmax = -Infinity;
    for (let r = view.r0; r < view.r1; r++) for (let c = view.c0; c < view.c1; c++) { const z = tr.data[r * W + c]; if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
    const ci = SLS.figures.contourIntervalFor(zmax - zmin);
    const base = { t: tr, slope: ctx.slope, aspect: ctx.aspect, view, widthPx: 1700, releaseMask: rel.mask, contourInterval: ci,
      path: ctx.profile ? ctx.profile.cells : null, markers: [{ cell: A.iTop, kind: 'top' }, { cell: A.iTip, kind: 'tip' }] };
    const fig = (overlay) => SLS.figures.renderMap(Object.assign({}, base, { overlay })).canvas;
    const mH = (r, min) => (i) => r.hmax[i] >= min;
    const figs = {};
    figs.zones = dual
      ? fig({ values: ctx.zoning, classes: SLS.raster.RAMPS.matrix.classes, mask: (i) => ctx.zoning[i] > 0, alpha: 190 })
      : fig({ values: R.pmax, classes: SLS.raster.RAMPS.zones.classes, mask: mH(R, 0.1), alpha: 190 });
    P(0.35);
    figs.h = fig({ values: R.hmax, classes: SLS.raster.RAMPS.height.classes, mask: mH(R, 0.05), alpha: 200 });
    figs.v = fig({ values: R.vmax, classes: SLS.raster.RAMPS.velocity.classes, mask: mH(R, 0.05), alpha: 200 });
    P(0.45);
    figs.p = fig({ values: R.pmax, classes: SLS.raster.RAMPS.pressure.classes, mask: mH(R, 0.05), alpha: 200 });
    figs.d = fig({ values: R.hfinal, classes: SLS.raster.RAMPS.height.classes, mask: null, alpha: 200 });
    if (dual && runs.T30) figs.p30 = fig({ values: runs.T30.result.pmax, classes: SLS.raster.RAMPS.pressure.classes, mask: mH(runs.T30.result, 0.05), alpha: 200 });
    if (R.powder) figs.pw = fig({ values: R.powder.pmax, classes: SLS.raster.RAMPS.powder.classes, mask: (i) => R.powder.pmax[i] >= 0.5, alpha: 190 });
    const seqFrames = runs[ctx.primaryKey] && runs[ctx.primaryKey].timeline;
    if (seqFrames && SLS.avTimeline) figs.seq = SLS.avTimeline.sequenceFigure(seqFrames, tr, base, (tt) => `t = ${fmt(tt, 0)} s`);
    if (R.eroded) figs.er = fig({ values: R.eroded, classes: SLS.raster.RAMPS.erosion.classes, mask: (i) => R.eroded[i] >= 0.02, alpha: 200 });
    P(0.65);
    const figNote = fill(T.figNote, { ci, crs: crsDesc ? `${crsDesc.name} (EPSG:${tr.epsg})` : 'EPSG:' + tr.epsg });
    const primLabel = keys.length > 1 ? ` (${ctx.primaryKey})` : '';

    // ---- Belge ----
    const doc = new Doc(fonts), d = doc.d;

    // Kapak
    d.setFillColor(14, 116, 144); d.rect(0, 0, PAGE.w, 4, 'F');
    doc.y = 16;
    doc.font(8.5, true, C.accent); d.text(`SLS PRO  ·  ${T.eyebrow}`, PAGE.ml, doc.y); doc.y += 9;
    doc.font(21, true); d.text(T.title, PAGE.ml, doc.y); doc.y += 9;
    doc.font(13, false, C.ink2); d.text(d.splitTextToSize(project, doc.cw), PAGE.ml, doc.y); doc.y += 6;
    if (M.location) { doc.font(10, false, C.muted); d.text(d.splitTextToSize(M.location, doc.cw), PAGE.ml, doc.y); doc.y += 5; }
    doc.y += 3;
    if (!ctx.complete) doc.banner(T.incomplete, fill(T.incompleteText, { r: ctx.incompleteReason || '' }));
    const half = doc.cw / 2;
    doc.table(null, [
      [T.reportNo, reportNo, T.date, dateStr],
      [T.author, M.author || '—', T.org, M.org || '—'],
      [T.analysisType, dual ? T.modeDual : `${T.modeSingle} · ${scenName(par.T)}`, T.snowType, T.snow[ctx.snowType] || ctx.snowType],
      [T.coordWgs, `${topLL[1].toFixed(5)}° N, ${topLL[0].toFixed(5)}° E`, T.coordUtm, `E ${fmt(topXY[0])}  N ${fmt(topXY[1])}`],
      [T.software, `SLS Pro ${SLS.VERSION}`, 'EPSG', `${tr.epsg} · ${crsDesc ? crsDesc.name : ''}`],
    ], [half * 0.36, half * 0.64, half * 0.36, half * 0.64]);
    doc.figure(figs.zones, dual ? T.coverFigM : T.coverFig, null, legendItems(dual ? 'matrix' : 'zones', T), ctx.complete ? 92 : 80);
    doc.kpis([
      { k: T.kpiVol + primLabel, v: fmt(rel.stats.volume), u: 'm³' },
      { k: T.kpiV, v: fmt(A.vmax, 1), u: 'm/s' },
      { k: T.kpiP, v: fmt(A.pmax), u: 'kPa' },
      { k: T.kpiRun, v: fmt(A.runout), u: 'm' },
      { k: T.kpiAlpha, v: fmt(A.alpha, 1), u: '°' },
      { k: T.kpiAff, v: fmt(A.affectedHa, 1), u: 'ha' },
    ]);
    doc.para(T.coverNote, 7.6, C.muted);

    // Yönetici özeti
    doc.page();
    H1(T.s1);
    const zA = dual ? SLS.avAnalysis.zoneAreas(ctx.zoning, tr.cellSize) : { red: A.zoneHa[2], blue: A.zoneHa[1], yellow: A.zoneHa[0] };
    doc.para(fill(T.summary, {
      loc: (M.location || '').trim() || T.thisArea, area: fmt(rel.stats.area / 1e4, 1), vol: fmt(rel.stats.volume),
      scen: dual ? T.modeDual + ', ' + scenName(300) : scenName(par.T), t: fmt(A.t), run: fmt(A.runout), drop: fmt(A.drop), alpha: fmt(A.alpha, 1),
      v: fmt(A.vmax, 1), p: fmt(A.pmax), red: fmt(zA.red, 1), blue: fmt(zA.blue, 1), yellow: fmt(zA.yellow, 1),
    }));
    if (A.entrained > 0) doc.para(fill(T.sumEnt, { e: fmt(A.entrained), p: pctS(A.entrained / A.release, 0) }));
    if (A.powder) doc.para(fill(T.sumPow, { p: fmt(A.powderPmax, 1), a: fmt(A.powderHa, 1) }));
    if (ctx.expansions) doc.para(fill(T.expanded, { n: ctx.expansions }), 9, C.ink2);
    if (M.notes && M.notes.trim()) { doc.font(9.5, true); d.text(T.notes, PAGE.ml, doc.y + 3.5); doc.y += 5.5; doc.para(M.notes.trim()); }

    // Arazi, kar ve saha verisi
    H1(T.s2);
    const ts = ctx.terrainStats;
    const kw = [doc.cw * 0.42, doc.cw * 0.58];
    doc.table(null, [
      [T.demSource, ctx.sourceName],
      [T.demRes, `${fmt(tr.width)} × ${fmt(tr.height)} · ${fmt(tr.cellSize, tr.cellSize < 1 ? 2 : 0)} m`],
      [T.crs, `${crsDesc ? crsDesc.name : ''} (EPSG:${tr.epsg})`],
      [T.extent, `${fmt(ts.areaKm2, 2)} km²`],
      [T.elevRange, `${fmt(ts.min)} – ${fmt(ts.max)} m`],
      [T.crit, `${fmt(ts.criticalFraction * 100, 1)} %`],
      [T.landcover, ctx.landcover && ctx.landcover.used ? `ESA WorldCover 2021 (10 m) · ${T.forestShare} ${fmt(ctx.landcover.forestFraction * 100, 1)} %` : T.notUsed],
    ], kw);
    if (ctx.field) {
      const F = ctx.field, pr = F.profile, D = F.sim.derived, loc = pr.location || {}, wx = pr.weather || {};
      doc.h2(T.fpTitle);
      doc.table(null, [
        [T.fpName, `${pr.name || '—'} · ${new Date(pr.date).toLocaleString(SLS.i18n.lang === 'tr' ? 'tr-TR' : 'en-GB')}`],
        [T.fpObserver, pr.observer || '—'],
        [T.fpLoc, [loc.lat != null ? `${fmt(loc.lat, 5)}° N, ${fmt(loc.lon, 5)}° E` : null, loc.elev != null ? `${fmt(loc.elev)} m` : null,
          loc.aspect != null ? `${T.aspectW} ${fmt(loc.aspect)}°` : null, loc.slope != null ? `${T.slopeW} ${fmt(loc.slope)}°` : null].filter(Boolean).join(' · ') || '—'],
        [T.fpWx, [wx.airTemp != null ? `${fmt(wx.airTemp, 1)} °C` : null, wx.windSpeed != null ? fill(T.windOn, { dir: fmt(wx.windDir ?? 0), s: fmt(wx.windSpeed, 1) }) : null].filter(Boolean).join(' · ') || '—'],
        [T.fpDerived, `HS ${fmt(D.hs * 100)} cm · SWE ${fmt(D.swe)} mm · ρ̄ ${fmt(D.meanDensity)} kg/m³ · ${D.nLayers} ${T.layers}`],
        [T.fpSlab, D.slab ? `${fmt(D.slab.depth * 100)} cm · ${fmt(D.slab.density)} kg/m³` : '—'],
        [T.fpErod, `${fmt(D.erodible.depth * 100)} cm${Number.isFinite(D.erodible.density) ? ' · ' + fmt(D.erodible.density) + ' kg/m³' : ''}`],
      ], kw);
      const lr = (pr.layers || []).filter((L) => Number(L.thickness) > 0);
      const cw = doc.cw;
      doc.table([T.lNo, T.lTh, T.lRho, T.lSwe, T.lGrain, T.lHard, T.lWet, T.lWeak], lr.map((L, k) => {
        const rho = SLS.snowpack.layerDensity(L), th = Number(L.thickness);
        return [k + 1, fmt(th, 1), Number.isFinite(rho) ? fmt(rho) : '—', Number.isFinite(rho) ? fmt(th / 100 * rho, 1) : '—', L.grain || '', L.hardness || '', L.wetness || '', L.weak ? '●' : ''];
      }), [cw * 0.08, cw * 0.15, cw * 0.15, cw * 0.14, cw * 0.12, cw * 0.12, cw * 0.12, cw * 0.12], ['r', 'r', 'r', 'r', 'l', 'l', 'l', 'l']);
      if (F.useGrad && F.sim.elev != null) doc.para(fill(T.gradNote, { z: fmt(F.sim.elev) }), 8.4, C.ink2);
    }

    // Senaryolar ve model
    H1(T.s3);
    const opt = ctx.options || {};
    if (keys.length > 1) {
      const cw = doc.cw, cols = keys.map((k) => runs[k]);
      doc.table([T.scenarioCol, ...keys], [
        [T.retPeriod, ...cols.map((r) => scenName(r.scenario.T))],
        [T.d0, ...cols.map((r) => `${fmt(r.scenario.d0, 2)} m`)],
        [T.relVol, ...cols.map((r) => `${fmt(r.release.volume)} m³`)],
        [T.mu, ...cols.map((r) => fmt(r.params.mu, 3))],
        [T.xi, ...cols.map((r) => `${fmt(r.params.xi)} m/s²`)],
        [T.rho, ...cols.map((r) => `${fmt(r.params.rho)} kg/m³`)],
        [T.paramSource, ...cols.map((r) => r.params.source || '—')],
      ], [cw * 0.34, ...keys.map(() => cw * 0.66 / keys.length)], ['l', ...keys.map(() => 'r')]);
    }
    doc.table(null, [
      ...(keys.length > 1 ? [] : [
        [T.scenario, scenName(par.T)],
        [T.d0, `${fmt(rel.d0, 2)} m`],
        [T.relVol, `${fmt(rel.stats.volume)} m³`],
        [T.mu, fmt(par.mu, 3)],
        [T.xi, `${fmt(par.xi)} m/s²`],
        [T.rho, `${fmt(par.rho)} kg/m³`],
        [T.paramSource, par.source || '—'],
      ]),
      [T.snowType, T.snow[ctx.snowType] || ctx.snowType],
      [T.relArea, `${fmt(rel.stats.area)} m² (${fmt(rel.stats.area / 1e4, 2)} ha)`],
      [T.relSlope, `${fmt(rel.stats.meanSlope, 1)}°`],
      [T.relElev, `${fmt(rel.stats.zmin)} – ${fmt(rel.stats.zmax)} m`],
      [T.dRange, `${fmt(rel.stats.dmin, 2)} – ${fmt(rel.stats.dmax, 2)} m`],
      [T.frictionMethod, (keys.length ? runs[keys[0]].params.kind : '') === 'maps' ? T.frictionMaps : T.frictionUniform],
      [T.releaseMethod, T.relMethods[(keys.length && runs[keys[0]].params.method) || 'direct']],
      [T.numMethod, ((keys.length && runs[keys[0]].params.order) === 1 ? T.order1 : T.order2) + (keys.length && runs[keys[0]].result && runs[keys[0]].result.status && runs[keys[0]].result.status.engine === 'gpu' ? ' · GPU (WebGPU)' : ' · CPU')],
      [T.windRow, opt.wind ? fill(T.windOn, { dir: fmt(opt.wind.dir_deg), s: fmt(opt.wind.speed_ms, 1), m: fmt(((rel.stats.wind && rel.stats.wind.mean) || 0) * 100), a: fmt(((rel.stats.wind && rel.stats.wind.amplitude) || 0) * 100) }) : T.notUsed],
      [T.forest, opt.forest && ctx.landcover && ctx.landcover.used ? T.forestOn : T.notUsed],
      [T.entRow, opt.entrain ? fill(T.entOn, { d: fmt(opt.entrain.depth_m, 2), r: fmt(opt.entrain.density), k: fmt(opt.entrain.kappa, 3) }) : T.notUsed],
      [T.powRow, opt.powder ? T.powOn : T.notUsed],
      [T.cd, fmt(par.cd, 1)],
      [T.tmax, `${fmt(par.tMax)} s`],
      [T.stopCrit, T.stopVal],
    ], kw);
    doc.para(T.model, 9);
    if (opt.entrain) doc.para(T.modelEnt, 9);
    if (opt.powder) doc.para(T.modelPow, 9);
    doc.para(fill(T.verified, { err: fmt(Math.abs(A.massErr) * 100, 4) }), 9);

    // Sonuçlar
    H1(T.s4);
    const resRows = (fn) => keys.map((k) => fn(runs[k].analysis));
    const outCell = (a) => `${fmt(a.outflow)} m³ (${pctS(a.outflowShare, 1)})`;
    const rowsDef = [
      [T.rV, (a) => `${fmt(a.vmax, 1)} m/s`], [T.rP, (a) => `${fmt(a.pmax)} kPa`], [T.rH, (a) => `${fmt(a.hmax, 1)} m`],
      [T.rRun, (a) => `${fmt(a.runout)} m`], [T.rDrop, (a) => `${fmt(a.drop)} m`], [T.rAlpha, (a) => `${fmt(a.alpha, 1)}°`],
      [T.rAff, (a) => `${fmt(a.affectedHa, 1)} ha`],
      ...(opt.entrain ? [[T.rEnt, (a) => `${fmt(a.entrained)} m³`]] : []),
      ...(opt.powder ? [[T.rPow, (a) => `${fmt(a.powderPmax, 1)} kPa`], [T.rPowA, (a) => `${fmt(a.powderHa, 1)} ha`]] : []),
      [T.rDep, (a) => `${fmt(a.deposit)} m³`], [T.rOut, outCell], [T.rT, (a) => `${fmt(a.t)} s`], [T.rStop, (a) => T.stop[a.reason] || a.reason],
    ];
    if (keys.length > 1) {
      const cw = doc.cw;
      doc.table([T.param, ...keys], rowsDef.map(([lab, fn]) => [lab, ...resRows(fn)]), [cw * 0.4, ...keys.map(() => cw * 0.6 / keys.length)], ['l', ...keys.map(() => 'r')]);
    } else {
      doc.table([T.param, T.value], rowsDef.map(([lab, fn]) => [lab, fn(A)]), [doc.cw * 0.6, doc.cw * 0.4], ['l', 'r']);
    }
    let fn = 2;
    const FH = 98;
    doc.figure(figs.h, fill(T.figH, { n: fn++ }) + primLabel, figNote, legendItems('height', T), FH);
    if (figs.seq) doc.figure(figs.seq, fill(T.figSeq, { n: fn++ }) + primLabel, T.seqNote, legendItems('height', T), 120);
    doc.figure(figs.v, fill(T.figV, { n: fn++ }) + primLabel, figNote, legendItems('velocity', T), FH);
    doc.figure(figs.p, fill(T.figP, { n: fn++ }) + primLabel, figNote, legendItems('pressure', T), FH);
    if (figs.p30) doc.figure(figs.p30, fill(T.figP, { n: fn++ }) + ' (T30)', figNote, legendItems('pressure', T), FH);
    doc.figure(figs.d, fill(T.figD, { n: fn++ }) + primLabel, figNote, legendItems('height', T), FH);
    if (figs.er) doc.figure(figs.er, fill(T.figEro, { n: fn++ }) + primLabel, figNote, legendItems('erosion', T), FH);
    if (figs.pw) doc.figure(figs.pw, fill(T.figPow, { n: fn++ }) + primLabel, T.powNote + ' ' + figNote, legendItems('powder', T), FH);
    P(0.8);

    // Boykesit
    const prof = ctx.profile;
    if (prof && prof.d.length > 2) {
      doc.space(150);
      H1(T.s5);
      doc.para(T.profDesc, 9);
      const pc = document.createElement('canvas');
      SLS.figures.drawProfile(pc, prof, {
        bg: '#ffffff', ink: '#111827', ink2: '#4b5563', grid: '#e5e7eb', axis: '#9ca3af', line: '#0e7490',
        fill: 'rgba(100,116,139,0.18)', band: 'rgba(8,145,178,0.12)', ref: '#9ca3af', font: 'DejaVu Sans, Arial, sans-serif', fontSize: 17, ml: 78,
      }, { z: T.elev, v: T.vmax, p: T.pmax, dist: T.dist, release: SLS.i18n.t('legend.release'), ref3: '3 kPa', ref30: '30 kPa' }, 1000, 680, 2);
      doc.figure(pc, fill(T.profFig, { n: fn++ }) + primLabel, null, null, 96);
      const rows = [], n = prof.d.length, step = Math.max(1, Math.round(n / 9));
      const zoneOf = (p, h) => (h < 0.1 ? T.zNone : p >= 30 ? T.zRed : p >= 3 ? T.zBlue : T.zYellow);
      const row = (i) => [fmt(prof.d[i]), fmt(prof.z[i]), fmt(prof.s[i], 1), fmt(prof.h[i], 1), fmt(prof.v[i], 1), fmt(prof.p[i]), zoneOf(prof.p[i], prof.h[i])];
      for (let i = 0; i < n; i += step) rows.push(row(i));
      if ((n - 1) % step) rows.push(row(n - 1));
      const cw = doc.cw;
      doc.table([T.dist, T.elev, T.slope, T.hmax, T.vmax, T.pmax, T.zone], rows,
        [cw * 0.15, cw * 0.15, cw * 0.13, cw * 0.14, cw * 0.14, cw * 0.14, cw * 0.15], ['r', 'r', 'r', 'r', 'r', 'r', 'l']);
    }

    // Tehlike bölgelemesi
    doc.space(140);
    H1(dual ? T.s6M : T.s6);
    doc.figure(figs.zones, fill(dual ? T.figZM : T.figZ, { n: fn++ }), figNote, legendItems(dual ? 'matrix' : 'zones', T), 98);
    if (dual) {
      const cw = doc.cw;
      doc.table([T.mxHead, T.mxT30, T.mxT300], [
        ['p ≥ 30 kPa', T.zRed, T.zRed],
        ['3 ≤ p < 30 kPa', T.zRed, T.zBlue],
        ['p < 3 kPa', T.zBlue, T.zYellow],
      ], [cw * 0.34, cw * 0.33, cw * 0.33], ['l', 'l', 'l']);
      doc.table([SLS.i18n.lang === 'tr' ? 'Bölge' : 'Zone', T.zoneArea, T.zoneMeaning], [
        [T.zRed, fmt(zA.red, 1), T.zRedM], [T.zBlue, fmt(zA.blue, 1), T.zBlueM], [T.zYellow, fmt(zA.yellow, 1), T.zYellowM],
      ], [doc.cw * 0.16, doc.cw * 0.16, doc.cw * 0.68], ['l', 'r', 'l']);
      doc.para(T.matrixNote, 8.4, C.ink2);
    } else {
      doc.table([SLS.i18n.lang === 'tr' ? 'Bölge' : 'Zone', T.zoneCrit, T.zoneArea, T.zoneMeaning], [
        [T.zRed, T.zRedC, fmt(A.zoneHa[2], 1), T.zRedM],
        [T.zBlue, T.zBlueC, fmt(A.zoneHa[1], 1), T.zBlueM],
        [T.zYellow, T.zYellowC, fmt(A.zoneHa[0], 1), T.zYellowM],
      ], [doc.cw * 0.14, doc.cw * 0.22, doc.cw * 0.14, doc.cw * 0.5], ['l', 'l', 'r', 'l']);
      doc.para(T.zoneNote, 8.4, C.ink2);
    }

    // Yapı ve yol risk tablosu
    if (ctx.assetRisk && ctx.assetRisk.length) {
      doc.space(Math.min(200, 40 + Math.min(60, ctx.assetRisk.length) * 7));
      H1(T.sAssets);
      doc.para(fill(T.assetsDesc, { n: ctx.assetRisk.length, z: dual ? T.byMatrix : T.bySingle }), 9);
      const zn = (z) => [T.zNone, T.zYellow, T.zBlue, T.zRed][z];
      const cw = doc.cw;
      doc.table([T.aName, T.aType, T.zone, T.pmax, T.hmax, T.vmax, T.aLen], ctx.assetRisk.slice(0, 60).map((a) => [
        a.name, T.geom[a.type] || a.type, zn(a.zone), fmt(a.pmax), fmt(a.hmax, 1), fmt(a.vmax, 1),
        a.affectedLen != null ? fmt(a.affectedLen) + ' m' : a.affectedArea != null ? fmt(a.affectedArea) + ' m²' : '—',
      ]), [cw * 0.27, cw * 0.1, cw * 0.13, cw * 0.11, cw * 0.11, cw * 0.12, cw * 0.16], ['l', 'l', 'l', 'r', 'r', 'r', 'r']);
    }

    // Gözlenen çığa karşı doğrulama
    const VAL = ctx.validation;
    if (VAL && VAL.m) {
      const m = VAL.m, cw = doc.cw;
      doc.space(VAL.calib ? 260 : 150);
      H1(T.sVal);
      doc.para(fill(T.valDesc, { o: VAL.name || '—', k: VAL.key || '' }), 9);
      const sg = (v, d) => (Number.isFinite(v) ? (v >= 0 ? '+' : '−') + fmt(Math.abs(v), d) : '—');
      doc.table([T.valMetric, T.valSim, T.valObs, 'Δ'], [
        [T.valFit, fmt(m.f1, 3) + ' / ' + fmt(m.csi, 3), '', ''],
        [T.valPR, fmt(m.precision, 3) + ' / ' + fmt(m.recall, 3), '', ''],
        [T.valArea, fmt(m.simHa, 1), fmt(m.obsHa, 1), sg(m.simHa - m.obsHa, 1)],
        [T.valRunout, fmt(m.runoutSim), fmt(m.runoutObs), sg(m.dRunout, 0)],
        [T.valAlpha, fmt(m.alphaSim, 1), fmt(m.alphaObs, 1), sg(m.dAlpha, 1)],
      ], [cw * 0.34, cw * 0.24, cw * 0.2, cw * 0.22], ['l', 'r', 'r', 'r']);
      if (VAL.calib && VAL.calib.best) {
        const B = VAL.calib.best;
        doc.para(fill(T.calDesc, { mu: fmt(B.kMu, 3), xi: fmt(B.kXi, 2), f1: fmt(B.f1, 3), da: sg(B.dAlpha, 2) }), 9);
        doc.table(['μ ×', 'ξ ×', 'F1', 'CSI', 'Δα (°)', 'J'], VAL.calib.all.slice().sort((a, b) => a.J - b.J).map((e) => [
          fmt(e.kMu, 3), fmt(e.kXi, 2), fmt(e.f1, 3), fmt(e.csi, 3), sg(e.dAlpha, 2), fmt(e.J, 3),
        ]), [cw * 0.16, cw * 0.14, cw * 0.16, cw * 0.16, cw * 0.2, cw * 0.18], ['r', 'r', 'r', 'r', 'r', 'r']);
        if (VAL.calib.alternatives) doc.para(fill(T.calAlt, { n: VAL.calib.alternatives }), 8.4, C.ink2);
      }
    }

    // Değerlendirme
    H1(T.s7);
    const recs = [];
    if (!ctx.complete) recs.push(fill(T.recIncomplete, { r: ctx.incompleteReason || '' }));
    if (VAL && VAL.m && (VAL.m.f1 < 0.6 || Math.abs(VAL.m.dAlpha) > 2)) recs.push(fill(T.recVal, { f: fmt(VAL.m.f1, 2), a: fmt(VAL.m.dAlpha, 1) }));
    const zR = dual ? zA.red : A.zoneHa[2], zB = dual ? zA.blue : A.zoneHa[1], zY = dual ? zA.yellow : A.zoneHa[0];
    if (zR > 0) recs.push(fill(T.recRed, { a: fmt(zR, 1) }));
    if (zB > 0) recs.push(fill(T.recBlue, { a: fmt(zB, 1) }));
    if (zY > 0) recs.push(fill(T.recYellow, { a: fmt(zY, 1) }));
    if (ctx.assetRisk && ctx.assetRisk.some((a) => a.zone >= 2)) recs.push(fill(T.recAssets, { n: ctx.assetRisk.filter((a) => a.zone >= 2).length }));
    recs.push(fill(T.recRelease, { a: fmt(rel.stats.area / 1e4, 1), s: fmt(rel.stats.meanSlope, 1), d: fmt(rel.d0, 1) }));
    const B = betaAnalysis(prof);
    if (B) {
      recs.push(fill(T.recBeta, { d: fmt(B.d), z: fmt(B.z), b: fmt(B.beta, 1), ab: fmt(B.alphaAB, 1), a: fmt(B.alphaPath, 1) }));
      // α-β modeliyle tutarlılık (standart sapma ≈ 2,3°)
      const dA = B.alphaPath - B.alphaAB;
      if (dA < -2 * 2.3) recs.push(fill(T.recAbLong, { d: fmt(-dA, 1) }));
      else if (dA > 2 * 2.3) recs.push(fill(T.recAbShort, { d: fmt(dA, 1) }));
      else recs.push(T.recAbOk);
      if (B.v > 0.5) recs.push(fill(T.recDam, { v: fmt(B.v, 1), h: fmt(B.h, 1), H: fmt(B.H, 1) }));
      if (B.H > 20) recs.push(T.recDamHigh);
    } else recs.push(T.recNoBeta);
    if (A.entrained > 0) recs.push(fill(T.recEnt, { p: pctS(A.entrained / A.release, 0) }));
    if (A.powder) recs.push(T.recPow);
    if (opt.wind) recs.push(T.recWind);
    if (!(ctx.landcover && ctx.landcover.used)) recs.push(T.recForestOff);
    if (!dual) recs.push(T.recSens);
    recs.push(T.recGis);
    doc.bullets(recs, 9.2);

    // Sınırlamalar
    H1(T.s8);
    const lim = T.lim.slice();
    const srcId = tr.source && tr.source.id;
    if (srcId && !['copernicus', 'terrarium'].includes(srcId)) lim[0] = fill(T.limDemHi, { s: { swissalti3d: 'swissALTI3D', usgs3dep: 'USGS 3DEP', lidar: 'LiDAR LAS/LAZ', file: 'GeoTIFF' }[srcId] || srcId, c: fmt(tr.cellSize) });
    if (ctx.validation && ctx.validation.m) lim[1] = T.limVal;
    if (!(keys.length && runs[keys[0]].params.order === 1)) lim[4] = T.limOrder2;
    lim.splice(lim.length - 1, 0, T.limHindcast);
    doc.bullets(lim, 8.8);

    // Kaynaklar
    H1(T.s9);
    const srcs = [tr.attribution];
    if (ctx.landcover && ctx.landcover.used) srcs.push(SLS.landcover.SOURCE.attribution + ' (' + SLS.landcover.SOURCE.license + ')');
    srcs.push(
      'Bartelt, P., Salm, B., Gruber, U. (1999). Calculating dense-snow avalanche runout using a Voellmy-fluid model with active/passive longitudinal straining. Journal of Glaciology 45(150).',
      'Christen, M., Kowalski, J., Bartelt, P. (2010). RAMMS: Numerical simulation of dense snow avalanches in three-dimensional terrain. Cold Regions Science and Technology 63.',
      'Salm, B., Burkard, A., Gubler, H. (1990). Berechnung von Fliesslawinen. Mitteilungen des EISLF 47.',
      'BFF/EISLF (1984). Richtlinien zur Berücksichtigung der Lawinengefahr bei raumwirksamen Tätigkeiten.',
      'Lied, K., Bakkehøi, S. (1980). Empirical calculations of snow-avalanche run-out distance based on topographic parameters. Journal of Glaciology 26(94).',
      SLS.paramsLibrary.SOURCE,
      'Fierz, C. et al. (2009). The International Classification for Seasonal Snow on the Ground. IHP-VII Technical Documents in Hydrology 83, UNESCO-IHP.',
      'SLS Pro: MapLibre GL JS (BSD-3), proj4js (MIT), geotiff.js (MIT), jsPDF (MIT), fflate (MIT), DejaVu fonts.',
    );
    doc.bullets(srcs, 8);

    // Onay
    H1(T.s10);
    doc.space(34);
    const bw = (doc.cw - 8) / 3;
    [T.prepared, T.checked, T.approved].forEach((lab, k) => {
      const x = PAGE.ml + k * (bw + 4), y = doc.y;
      d.setDrawColor(...C.rule); d.setLineWidth(0.25); d.rect(x, y, bw, 30);
      doc.font(8.4, true); d.text(lab, x + 3, y + 5);
      doc.font(7.6, false, C.muted);
      d.text(`${T.name}:`, x + 3, y + 12); d.text(k === 0 && M.author ? M.author : '', x + 18, y + 12);
      d.text(`${T.signature}:`, x + 3, y + 19);
      d.text(`${T.sigDate}:`, x + 3, y + 26);
    });
    doc.y += 34;

    doc.decorate(T, project, !ctx.complete);
    P(0.97);
    const safe = project.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'rapor';
    const fileName = `SLS_${SLS.i18n.lang === 'tr' ? 'Cig_Raporu' : 'Avalanche_Report'}_${safe}_${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}.pdf`;
    const blob = d.output('blob');
    P(1);
    return { blob, fileName, pages: d.getNumberOfPages(), reportNo };
  }

  SLS.avalancheReport = { build, loadAssets, betaAnalysis };
})(window.SLS = window.SLS || {});
