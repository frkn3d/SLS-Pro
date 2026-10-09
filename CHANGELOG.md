# Sürüm Notları / Changelog

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
