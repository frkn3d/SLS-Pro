# SLS Pro

Doğal afet simülasyon platformu (HTML5). İlk modül: **Çığ Simülasyonu** — arazi edinimi (küresel 30 m, swissALTI3D, USGS 3DEP, LAS/LAZ, GeoTIFF), kopma alanı, Voellmy-Salm akış simülasyonu (2. derece, CPU veya WebGPU), tehlike bölgeleri, gözlenen çığa karşı doğrulama ve kalibrasyon, QGIS paketi/eklentisi ve PDF mühendislik raporu.

**Hemen dene:** https://frkn3d.github.io/SLS-Pro/ · **Saha platformu:** https://frkn3d.github.io/SLS-Pro/saha.html

## Çalıştırma

Python 3 gerekir (ek paket yok).

```
python serve.py
```

Windows'ta `Baslat.bat` dosyasına çift tıklamak yeterlidir. Uygulama `http://127.0.0.1:8749` adresinde açılır.

## Veri kaynakları

- AWS Terrain Tiles — Mapzen/Tilezen, AWS Open Data
- Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved
- OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors (ODbL)
- Sentinel-2 cloudless 2016 by EOX IT Services GmbH (CC BY 4.0)
- swissALTI3D © swisstopo (açık veri, atıf zorunlu), STAC API üzerinden
- USGS 3D Elevation Program (3DEP) — U.S. Geological Survey, kamu malı
- Koordinat sistemi tanımları: epsg.io (MapTiler)
- © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0), Microsoft Planetary Computer üzerinden

Kütüphaneler: MapLibre GL JS (BSD-3), proj4js (MIT), geotiff.js (MIT), jsPDF (MIT), fflate (MIT), laz-perf (Apache-2.0); yazı tipi: DejaVu Sans.

Sürtünme parametreleri: RAMMS::AVALANCHE kullanıcı kılavuzu MuXi tablosu (WSL SLF). QGIS eklentisi uygulama içinden (.zip) indirilir.

Sürüm notları: [CHANGELOG.md](CHANGELOG.md) — uygulama içinde üst çubuktaki sürüm numarasına tıklayarak da görülebilir.
