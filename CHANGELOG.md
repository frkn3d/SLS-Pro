# Sürüm Notları / Changelog

## 0.8.0 — 2026-10-10 — WebGPU çözücü, doğrulama ve otomatik kalibrasyon, QGIS eklentisi

- WebGPU (WGSL) yoğun akış çözücüsü: dt indirgemesi, durma ölçütü ve kütle muhasebesi GPU'da; CPU ile birebir (5 karşılaştırma testi), 900×600 ızgarada ×16.
- Gözlenen çığ sınırına karşı doğrulama (F1, CSI, kesinlik/duyarlık, kaçış, α) ve μ/ξ ölçek çarpanı kalibrasyonu; kalibrasyon setleri.
- Kalibrasyon ikiz deneyi: 4 vakada çarpanlar %2 içinde geri bulundu.
- QGIS eklentisi (paket yükleyici + SLS Pro için DEM dışa aktarımı); pakete yeni .qml stilleri.
- GeoJSON içe aktarımı (gözlenen sınır, orman, varlıklar).
- Raporda doğrulama/kalibrasyon bölümü, bağlama göre sınırlamalar.

## 0.7.0 — 2026-10-10 — Açık LiDAR kaynakları, LAS/LAZ, QGIS paketi, GeoTIFF/GeoJSON, paylaşım bağlantısı

- swissALTI3D (İsviçre, 2 m / 0,5 m) ve USGS 3DEP (ABD, 1 m) LiDAR yükseklik kaynakları.
- LAS / LAZ nokta bulutu içe aktarımı (zemin noktaları, WASM laz-perf).
- epsg.io ile bilinmeyen EPSG, EPSG'siz WKT ve feet → metre dönüşümü.
- QGIS paketi (GeoTIFF + GeoJSON + .qml stilleri), tek katman GeoTIFF, bölgeler GeoJSON.
- Saha profili paylaşım bağlantısı (sunucusuz).
- Mangeney vd. (2000) baraj yıkılması kıyas testi.

## 0.6.0 — 2026-10-10 — İkinci derece çözücü, RAMMS sürtünme tablosu, İsviçre kopma kalınlığı, proje kaydetme

- İkinci derece yöntem (MUSCL-MC + HLL + Heun) varsayılan; ızgara bağımlılığı belirgin azaldı (oluk testi: 10 m'de kaçış hatası %10 → %5).
- RAMMS::AVALANCHE MuXi tablosu ile hücre bazlı μ / ξ (arazi sınıfı × kot × hacim × tekerrür 10/30/100/300 yıl).
- Arazi sınıflandırması katmanı, ayarlanabilir kot sınırları.
- İsviçre kopma kalınlığı yöntemi f(ψ) = 0,291 / (sin ψ − 0,202 cos ψ) (Salm vd. 1990).
- Orman poligonu (çizim / KML).
- Proje kaydet / aç (IndexedDB) ve .slsproj dışa / içe aktarma.
- Sürekli renk skalası, kayıt aralığı ve sayısal yöntem seçimi.

## 0.5.0 — 2026-10-10 — Simülasyon zaman çizelgesi

- Akış hesap sırasında kaydedilir (senaryo başına ~200 kare, 8 bit, etkin bölge kırpılmış).
- Oynat / duraklat, ileri-geri kaydırma, 5×–40× hız, yükseklik / hız görünümü, toz bulutu.
- Anlık en yüksek hız – zaman grafiği; tıklayarak o ana atlama.
- Raporda akış zaman dizisi şekli.

## 0.4.0 — 2026-10-09 — Saha platformu, T30 + T300 bölgeleme, sürüklenme, toz bulutu, KML/KMZ

- Tamamlanmamış analiz denetimi: akış sınıra ulaşırsa otomatik alan genişletme ve yeniden hesap (en fazla 3 kez); aksi halde sonuç/rapor/KMZ "tamamlanmamış" olarak işaretlenir.
- Kar sürüklenmesi (hıza bağlı, kütle korunumlu) ve aşınma haritası.
- Toz bulutu katmanı (deneysel, kalibre edilmemiş) ve basınç haritası.
- Rüzgâr yüklemesi (rüzgâraltı / rüzgârüstü kopma kalınlığı düzeltmesi).
- Saha platformu `saha.html`: kar profili girişi (katman, yoğunluk / SWE, tane, sertlik, ıslaklık, zayıf katman, GPS, rüzgâr), kaydet / paylaş / simülatöre aktar.
- T30 + T300 çift senaryo ve İsviçre şiddet–olasılık matrisiyle bölgeleme.
- Kar tipi × tekerrür × hacim sürtünme kitaplığı; kullanıcı kalibrasyon setleri.
- KML/KMZ içe aktarım (alan, kopma alanı, yapı/yol risk tablosu) ve KMZ dışa aktarım.
- Rapor ve 19 çözücü testi güncellendi.

## 0.3.0 — 2026-10-09 — PDF mühendislik raporu, boykesit ve orman etkisi

- Rapor adımı: kapak, yönetici özeti, arazi/model bilgileri, sonuç haritaları, boykesit, tehlike bölgelemesi, mühendislik önerileri, sınırlamalar, kaynakça ve onay bölümü içeren PDF rapor (Türkçe / İngilizce).
- Rapor haritaları arazi verisinden çizilir: gölgeli kabartma, eş yükselti eğrileri, UTM koordinatları, ölçek çubuğu, kuzey oku.
- Mühendislik değerlendirmesi: β noktası, Norveç α-β modeliyle kaçış açısı karşılaştırması, durdurma seddesi ön tahmini.
- Akış yolu boykesiti (kot, hız, basınç) ve haritada akış yolu; grafik üzerinde gezinince harita konumu işaretlenir.
- Orman etkisi: ESA WorldCover 2021 (10 m); çözücüde hücre bazlı μ ve ξ.

## 0.2.0 — 2026-10-09 — Çığ akış simülasyonu

- Voellmy-Salm yoğun çığ çözücüsü: derinlik-ortalamalı sığ akış denklemleri, sonlu hacim (HLL), eğime göre düzeltilmiş yerçekimi ve sürtünme; hesap tarayıcıda arka planda (Web Worker).
- Analitik doğrulama: Voellmy limit hızı (hata < %0,1), Coulomb durma koşulu, kütle korunumu (açık sınırlar dahil), kaçış açısı, ξ duyarlılığı.
- Kopma alanı: eğime göre otomatik aday alanlar (tıklayarak seçim), poligon çizimi, kopma kalınlığı d₀.
- Parametreler: küçük / orta / büyük senaryo ön ayarları; μ, ξ, yoğunluk, C_d, süre.
- Canlı akış animasyonu; sonuç haritaları: h_max, v_max, p_max, birikim, İsviçre basınç eşiklerine göre tehlike bölgeleri.
- Sonuç özeti: kaçış mesafesi, α açısı, düşü, etkilenen alan, bölge alanları, kütle dengesi, alan dışına taşma uyarısı.
- QGIS için sonuç dışa aktarımı (.asc + .prj) ve özet (.json).

## 0.1.0 — 2026-10-09 — İlk sürüm: Arazi Motoru

- Modül başlatıcı: Çığ Simülasyonu aktif; Sel, Moloz Akışı, Kaya Düşmesi, Heyelan ve Orman Yangını “Yakında”.
- Türkçe / İngilizce arayüz; cihaz dili otomatik algılanır.
- Haritada dikdörtgen çizerek çalışma alanı seçimi, enlem/boylam ile konuma gitme.
- Yükseklik kaynakları: AWS Terrain Tiles, Copernicus GLO-30 (yerel sunucu ile), kullanıcının GeoTIFF dosyası (drone / LiDAR).
- WGS84 / UTM ızgarasına 5–50 m yeniden örnekleme; TUREF TM ve ED50 UTM dosyalarında doğal çözünürlük korunur.
- Eğim / bakı analizi, çığ eğim sınıfları, kot ve eğim dağılımı özeti.
- 3B arazi, topografik ve Sentinel-2 altlıklar.
- QGIS uyumlu dışa aktarım: `.asc + .prj` ve `.json` meta veri.
