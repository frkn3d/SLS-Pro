# SLS Pro

Doğal afet simülasyon platformu (HTML5). İlk modül: **Çığ Simülasyonu** — arazi edinimi, kopma alanı, Voellmy-Salm akış simülasyonu, tehlike bölgeleri ve PDF mühendislik raporu.

**Hemen dene:** https://frkn3d.github.io/SLS-Pro/

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
- © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0), Microsoft Planetary Computer üzerinden

Kütüphaneler: MapLibre GL JS (BSD-3), proj4js (MIT), geotiff.js (MIT), jsPDF (MIT); yazı tipi: DejaVu Sans.

Sürüm notları: [CHANGELOG.md](CHANGELOG.md) — uygulama içinde üst çubuktaki sürüm numarasına tıklayarak da görülebilir.
