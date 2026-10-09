# Sürüm Notları / Changelog

## 0.1.0 — 2026-10-09 — İlk sürüm: Arazi Motoru

- Modül başlatıcı: Çığ Simülasyonu aktif; Sel, Moloz Akışı, Kaya Düşmesi, Heyelan ve Orman Yangını “Yakında”.
- Türkçe / İngilizce arayüz; cihaz dili otomatik algılanır.
- Haritada dikdörtgen çizerek çalışma alanı seçimi, enlem/boylam ile konuma gitme.
- Yükseklik kaynakları: AWS Terrain Tiles, Copernicus GLO-30 (yerel sunucu ile), kullanıcının GeoTIFF dosyası (drone / LiDAR).
- WGS84 / UTM ızgarasına 5–50 m yeniden örnekleme; TUREF TM ve ED50 UTM dosyalarında doğal çözünürlük korunur.
- Eğim / bakı analizi, çığ eğim sınıfları, kot ve eğim dağılımı özeti.
- 3B arazi, topografik ve Sentinel-2 altlıklar.
- QGIS uyumlu dışa aktarım: `.asc + .prj` ve `.json` meta veri.
