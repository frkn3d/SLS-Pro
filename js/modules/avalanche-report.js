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
      model: 'Akış, derinlik-ortalamalı sığ akış denklemleriyle iki boyutlu olarak çözülmüştür. Sürtünme Voellmy-Salm yasasıyla tanımlanır: S_f = μ·g·h·cosθ + g·U²/ξ. Burada μ kuru (Coulomb) sürtünme, ξ türbülans katsayısı, θ yerel eğim ve U eğime paralel akış hızıdır. Denklemler birinci derece sonlu hacim yöntemi (HLL akısı) ile, eğime göre düzeltilmiş yerçekimi ve sürtünme terimleriyle çözülür. Darbe basıncı p = ½·C_d·ρ·U² bağıntısıyla hesaplanır.',
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
      lim: [
        'Küresel 30 m yükseklik verisi daha sık ızgaraya yeniden örneklenmiştir; küçük ölçekli topoğrafik öğeler (hendek, sedde, yol yarması) temsil edilmeyebilir. Ayrıntılı çalışmalar için drone veya LiDAR verisi önerilir.',
        'Sürtünme parametreleri literatürdeki tipik aralıklardan alınmıştır ve bölgedeki gözlenmiş çığlarla kalibre edilmemiştir.',
        'Model yalnızca yoğun akış katmanını temsil eder; toz bulutu (aerosol) çığı, yol boyunca kar sürüklenmesi (entrainment) ve kar örtüsünün mekânsal değişkenliği modellenmemiştir.',
        'Birinci derece sayısal yöntem nispeten sönümleyicidir; sonuçlar ızgara çözünürlüğüne bağlıdır.',
        'Tehlike bölgeleri gösterge niteliğindedir ve resmî bölgeleme yerine geçmez.',
      ],
      s9: '9. Veri kaynakları ve atıflar',
      s10: '10. Onay',
      prepared: 'Hazırlayan', checked: 'Kontrol eden', approved: 'Onaylayan', name: 'Ad Soyad', signature: 'İmza', sigDate: 'Tarih',
      notes: 'Notlar',
      scen: { small: 'küçük senaryo, T≈30 yıl', medium: 'orta senaryo, T≈100 yıl', large: 'büyük senaryo, T≈300 yıl', custom: 'özel parametreler' },
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
      model: 'The flow is solved in two dimensions with the depth-averaged shallow-flow equations. Friction follows the Voellmy-Salm law: S_f = μ·g·h·cosθ + g·U²/ξ, where μ is dry (Coulomb) friction, ξ the turbulence coefficient, θ the local slope and U the slope-parallel speed. The equations are solved with a first-order finite-volume method (HLL flux) with slope-corrected gravity and friction terms. Impact pressure is p = ½·C_d·ρ·U².',
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
      lim: [
        'Global 30 m elevation data were resampled to a finer grid; small topographic features (ditches, dams, road cuts) may not be represented. Drone or LiDAR data are recommended for detailed studies.',
        'Friction parameters are taken from typical literature ranges and have not been calibrated against observed avalanches in the area.',
        'The model represents the dense flow layer only; powder (aerosol) avalanches, snow entrainment along the path and spatial variability of the snow cover are not modelled.',
        'The first-order numerical scheme is relatively diffusive; results depend on grid resolution.',
        'Hazard zones are indicative and do not replace official zoning.',
      ],
      s9: '9. Data sources and attribution',
      s10: '10. Approval',
      prepared: 'Prepared by', checked: 'Checked by', approved: 'Approved by', name: 'Name', signature: 'Signature', sigDate: 'Date',
      notes: 'Notes',
      scen: { small: 'small scenario, T≈30 yr', medium: 'medium scenario, T≈100 yr', large: 'large scenario, T≈300 yr', custom: 'custom parameters' },
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
      this.space(16);
      this.gap(3);
      this.font(13, true, C.accent);
      this.d.text(text, PAGE.ml, this.y + 4.5);
      this.y += 7;
      this.d.setDrawColor(...C.accent); this.d.setLineWidth(0.4);
      this.d.line(PAGE.ml, this.y, PAGE.ml + this.cw, this.y);
      this.y += 4;
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
    decorate(T, project) {
      const n = this.d.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        this.d.setPage(i);
        if (i > 1) {
          this.font(7.4, false, C.muted);
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

    // ---- Şekiller ----
    const affected = (i) => R.hmax[i] >= 0.05 || rel.mask[i];
    const view = SLS.figures.fitView(tr, affected, { margin: 0.1, minAspect: 0.5, maxAspect: 0.78 });
    let zmin = Infinity, zmax = -Infinity;
    for (let r = view.r0; r < view.r1; r++) for (let c = view.c0; c < view.c1; c++) { const z = tr.data[r * W + c]; if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
    const ci = SLS.figures.contourIntervalFor(zmax - zmin);
    const base = { t: tr, slope: ctx.slope, aspect: ctx.aspect, view, widthPx: 1700, releaseMask: rel.mask, contourInterval: ci,
      path: ctx.profile ? ctx.profile.cells : null, markers: [{ cell: A.iTop, kind: 'top' }, { cell: A.iTip, kind: 'tip' }] };
    const fig = (overlay) => SLS.figures.renderMap(Object.assign({}, base, { overlay })).canvas;
    const mH = (min) => (i) => R.hmax[i] >= min;
    const figs = {
      zones: fig({ values: R.pmax, classes: SLS.raster.RAMPS.zones.classes, mask: mH(0.1), alpha: 190 }),
    };
    P(0.35);
    figs.h = fig({ values: R.hmax, classes: SLS.raster.RAMPS.height.classes, mask: mH(0.05), alpha: 200 });
    figs.v = fig({ values: R.vmax, classes: SLS.raster.RAMPS.velocity.classes, mask: mH(0.05), alpha: 200 });
    P(0.5);
    figs.p = fig({ values: R.pmax, classes: SLS.raster.RAMPS.pressure.classes, mask: mH(0.05), alpha: 200 });
    figs.d = fig({ values: R.hfinal, classes: SLS.raster.RAMPS.height.classes, mask: null, alpha: 200 });
    P(0.65);
    const figNote = fill(T.figNote, { ci, crs: crsDesc ? `${crsDesc.name} (EPSG:${tr.epsg})` : 'EPSG:' + tr.epsg });

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
    const half = doc.cw / 2;
    doc.table(null, [
      [T.reportNo, reportNo, T.date, dateStr],
      [T.author, M.author || '—', T.org, M.org || '—'],
      [T.coordWgs, `${topLL[1].toFixed(5)}° N, ${topLL[0].toFixed(5)}° E`, T.coordUtm, `E ${fmt(topXY[0])}  N ${fmt(topXY[1])}`],
      [T.software, `SLS Pro ${SLS.VERSION}`, 'EPSG', `${tr.epsg} · ${crsDesc ? crsDesc.name : ''}`],
    ], [half * 0.36, half * 0.64, half * 0.36, half * 0.64]);
    doc.figure(figs.zones, T.coverFig, null, legendItems('zones', T), 96);
    doc.kpis([
      { k: T.kpiVol, v: fmt(rel.stats.volume), u: 'm³' },
      { k: T.kpiV, v: fmt(A.vmax, 1), u: 'm/s' },
      { k: T.kpiP, v: fmt(A.pmax), u: 'kPa' },
      { k: T.kpiRun, v: fmt(A.runout), u: 'm' },
      { k: T.kpiAlpha, v: fmt(A.alpha, 1), u: '°' },
      { k: T.kpiAff, v: fmt(A.affectedHa, 1), u: 'ha' },
    ]);
    doc.para(T.coverNote, 7.6, C.muted);

    // 1. Özet
    doc.page();
    doc.h1(T.s1);
    doc.para(fill(T.summary, {
      loc: (M.location || '').trim() || T.thisArea, area: fmt(rel.stats.area / 1e4, 1), vol: fmt(rel.stats.volume),
      scen: T.scen[par.preset] || T.scen.custom, t: fmt(A.t), run: fmt(A.runout), drop: fmt(A.drop), alpha: fmt(A.alpha, 1),
      v: fmt(A.vmax, 1), p: fmt(A.pmax), red: fmt(A.zoneHa[2], 1), blue: fmt(A.zoneHa[1], 1), yellow: fmt(A.zoneHa[0], 1),
    }));
    if (M.notes && M.notes.trim()) { doc.font(9.5, true); d.text(T.notes, PAGE.ml, doc.y + 3.5); doc.y += 5.5; doc.para(M.notes.trim()); }

    // 2. Arazi
    doc.h1(T.s2);
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

    // 3. Senaryo ve model
    doc.h1(T.s3);
    doc.table(null, [
      [T.scenario, T.scen[par.preset] || T.scen.custom],
      [T.relArea, `${fmt(rel.stats.area)} m² (${fmt(rel.stats.area / 1e4, 2)} ha)`],
      [T.d0, `${fmt(rel.d0, 1)} m`],
      [T.relVol, `${fmt(rel.stats.volume)} m³`],
      [T.relSlope, `${fmt(rel.stats.meanSlope, 1)}°`],
      [T.relElev, `${fmt(rel.stats.zmin)} – ${fmt(rel.stats.zmax)} m`],
      [T.mu, fmt(par.mu, 2)],
      [T.xi, `${fmt(par.xi)} m/s²`],
      [T.rho, `${fmt(par.rho)} kg/m³`],
      [T.cd, fmt(par.cd, 1)],
      [T.forest, ctx.landcover && ctx.landcover.used ? T.forestOn : T.notUsed],
      [T.tmax, `${fmt(par.tMax)} s`],
      [T.stopCrit, T.stopVal],
    ], kw);
    doc.para(T.model, 9);
    doc.para(fill(T.verified, { err: fmt(Math.abs(A.massErr) * 100, 4) }), 9);

    // 4. Sonuçlar
    doc.h1(T.s4);
    doc.table([T.param, T.value], [
      [T.rV, `${fmt(A.vmax, 1)} m/s`],
      [T.rP, `${fmt(A.pmax)} kPa`],
      [T.rH, `${fmt(A.hmax, 1)} m`],
      [T.rRun, `${fmt(A.runout)} m`],
      [T.rDrop, `${fmt(A.drop)} m`],
      [T.rAlpha, `${fmt(A.alpha, 1)}°`],
      [T.rAff, `${fmt(A.affectedHa, 1)} ha`],
      [T.rDep, `${fmt(A.deposit)} m³`],
      [T.rOut, `${fmt(A.outflow)} m³ (${fmt(A.outflow / A.release * 100, 1)} %)`],
      [T.rT, `${fmt(A.t)} s`],
      [T.rStop, T.stop[A.reason] || A.reason],
    ], [doc.cw * 0.6, doc.cw * 0.4], ['l', 'r']);
    let fn = 2;
    const FH = 98;
    doc.figure(figs.h, fill(T.figH, { n: fn++ }), figNote, legendItems('height', T), FH);
    doc.figure(figs.v, fill(T.figV, { n: fn++ }), figNote, legendItems('velocity', T), FH);
    doc.figure(figs.p, fill(T.figP, { n: fn++ }), figNote, legendItems('pressure', T), FH);
    doc.figure(figs.d, fill(T.figD, { n: fn++ }), figNote, legendItems('height', T), FH);
    P(0.8);

    // 5. Boykesit
    const prof = ctx.profile;
    if (prof && prof.d.length > 2) {
      doc.space(150);
      doc.h1(T.s5);
      doc.para(T.profDesc, 9);
      const pc = document.createElement('canvas');
      SLS.figures.drawProfile(pc, prof, {
        bg: '#ffffff', ink: '#111827', ink2: '#4b5563', grid: '#e5e7eb', axis: '#9ca3af', line: '#0e7490',
        fill: 'rgba(100,116,139,0.18)', band: 'rgba(8,145,178,0.12)', ref: '#9ca3af', font: 'DejaVu Sans, Arial, sans-serif', fontSize: 17, ml: 78,
      }, { z: T.elev, v: T.vmax, p: T.pmax, dist: T.dist, release: SLS.i18n.t('legend.release'), ref3: '3 kPa', ref30: '30 kPa' }, 1000, 680, 2);
      doc.figure(pc, fill(T.profFig, { n: fn++ }), null, null, 96);
      // Düzenli aralıklı tablo
      const rows = [], n = prof.d.length, step = Math.max(1, Math.round(n / 9));
      const zoneOf = (p, h) => (h < 0.1 ? T.zNone : p >= 30 ? T.zRed : p >= 3 ? T.zBlue : T.zYellow);
      for (let i = 0; i < n; i += step) rows.push([fmt(prof.d[i]), fmt(prof.z[i]), fmt(prof.s[i], 1), fmt(prof.h[i], 1), fmt(prof.v[i], 1), fmt(prof.p[i]), zoneOf(prof.p[i], prof.h[i])]);
      if ((n - 1) % step) { const i = n - 1; rows.push([fmt(prof.d[i]), fmt(prof.z[i]), fmt(prof.s[i], 1), fmt(prof.h[i], 1), fmt(prof.v[i], 1), fmt(prof.p[i]), zoneOf(prof.p[i], prof.h[i])]); }
      const cw = doc.cw;
      doc.table([T.dist, T.elev, T.slope, T.hmax, T.vmax, T.pmax, T.zone], rows,
        [cw * 0.15, cw * 0.15, cw * 0.13, cw * 0.14, cw * 0.14, cw * 0.14, cw * 0.15], ['r', 'r', 'r', 'r', 'r', 'r', 'l']);
    }

    // 6. Bölgeler
    doc.space(140);
    doc.h1(T.s6);
    doc.figure(figs.zones, fill(T.figZ, { n: fn++ }), figNote, legendItems('zones', T), 98);
    doc.table([SLS.i18n.lang === 'tr' ? 'Bölge' : 'Zone', T.zoneCrit, T.zoneArea, T.zoneMeaning], [
      [T.zRed, T.zRedC, fmt(A.zoneHa[2], 1), T.zRedM],
      [T.zBlue, T.zBlueC, fmt(A.zoneHa[1], 1), T.zBlueM],
      [T.zYellow, T.zYellowC, fmt(A.zoneHa[0], 1), T.zYellowM],
    ], [doc.cw * 0.14, doc.cw * 0.22, doc.cw * 0.14, doc.cw * 0.5], ['l', 'l', 'r', 'l']);
    doc.para(T.zoneNote, 8.4, C.ink2);

    // 7. Değerlendirme
    doc.h1(T.s7);
    const recs = [];
    if (A.outflow > 0.01 * A.release) {
      const v = fmt(A.outflow / A.release * 100, 1);
      recs.push(fill(T.recOut, { p: SLS.i18n.lang === 'tr' ? '%' + v : v + '%' }));
    }
    if (A.reason === 'tmax') recs.push(T.recTmax);
    if (A.zoneHa[2] > 0) recs.push(fill(T.recRed, { a: fmt(A.zoneHa[2], 1) }));
    if (A.zoneHa[1] > 0) recs.push(fill(T.recBlue, { a: fmt(A.zoneHa[1], 1) }));
    if (A.zoneHa[0] > 0) recs.push(fill(T.recYellow, { a: fmt(A.zoneHa[0], 1) }));
    recs.push(fill(T.recRelease, { a: fmt(rel.stats.area / 1e4, 1), s: fmt(rel.stats.meanSlope, 1), d: fmt(rel.d0, 1) }));
    const B = betaAnalysis(prof);
    if (B) {
      recs.push(fill(T.recBeta, { d: fmt(B.d), z: fmt(B.z), b: fmt(B.beta, 1), ab: fmt(B.alphaAB, 1), a: fmt(B.alphaPath, 1) }));
      if (B.v > 0.5) recs.push(fill(T.recDam, { v: fmt(B.v, 1), h: fmt(B.h, 1), H: fmt(B.H, 1) }));
    } else recs.push(T.recNoBeta);
    if (!(ctx.landcover && ctx.landcover.used)) recs.push(T.recForestOff);
    recs.push(T.recSens, T.recGis);
    doc.bullets(recs, 9.2);

    // 8. Sınırlamalar
    doc.h1(T.s8);
    doc.bullets(T.lim, 8.8);

    // 9. Kaynaklar
    doc.h1(T.s9);
    const srcs = [tr.attribution];
    if (ctx.landcover && ctx.landcover.used) srcs.push(SLS.landcover.SOURCE.attribution + ' (' + SLS.landcover.SOURCE.license + ')');
    srcs.push(
      'Bartelt, P., Salm, B., Gruber, U. (1999). Calculating dense-snow avalanche runout using a Voellmy-fluid model with active/passive longitudinal straining. Journal of Glaciology 45(150).',
      'Christen, M., Kowalski, J., Bartelt, P. (2010). RAMMS: Numerical simulation of dense snow avalanches in three-dimensional terrain. Cold Regions Science and Technology 63.',
      'Salm, B., Burkard, A., Gubler, H. (1990). Berechnung von Fliesslawinen. Mitteilungen des EISLF 47.',
      'BFF/EISLF (1984). Richtlinien zur Berücksichtigung der Lawinengefahr bei raumwirksamen Tätigkeiten.',
      'Lied, K., Bakkehøi, S. (1980). Empirical calculations of snow-avalanche run-out distance based on topographic parameters. Journal of Glaciology 26(94).',
      'SLS Pro: MapLibre GL JS (BSD-3), proj4js (MIT), geotiff.js (MIT), jsPDF (MIT), DejaVu fonts.',
    );
    doc.bullets(srcs, 8);

    // 10. Onay
    doc.h1(T.s10);
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

    doc.decorate(T, project);
    P(0.97);
    const safe = project.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'rapor';
    const fileName = `SLS_${SLS.i18n.lang === 'tr' ? 'Cig_Raporu' : 'Avalanche_Report'}_${safe}_${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}.pdf`;
    const blob = d.output('blob');
    P(1);
    return { blob, fileName, pages: d.getNumberOfPages(), reportNo };
  }

  SLS.avalancheReport = { build, loadAssets, betaAnalysis };
})(window.SLS = window.SLS || {});
