/* SLS Pro — Koordinat sistemleri
 * Simülasyon denklemleri metre cinsinden çalıştığı için tüm araziler metrik bir
 * projeksiyona (varsayılan: WGS84 / UTM) taşınır. Türkiye'de yaygın TUREF TM ve
 * ED50 UTM tanımları da desteklenir (yerel GeoTIFF içe aktarımı için).
 */
(function (SLS) {
  'use strict';

  const WGS84_GEOG = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  const TUREF_GEOG = 'GEOGCS["GCS_TUREF",DATUM["D_Turkish_National_Reference_Frame",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  const ED50_GEOG = 'GEOGCS["GCS_European_1950",DATUM["D_European_1950",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

  function tmWkt(name, geog, cm, k, fn) {
    return `PROJCS["${name}",${geog},PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",${fn.toFixed(1)}],PARAMETER["Central_Meridian",${cm.toFixed(1)}],PARAMETER["Scale_Factor",${k}],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`;
  }

  /** EPSG kodu için {proj4, wkt, name} döndürür; desteklenmiyorsa null. */
  function describe(epsg) {
    epsg = Number(epsg);
    // WGS84 / UTM kuzey (326xx) ve güney (327xx)
    if (epsg >= 32601 && epsg <= 32660 || epsg >= 32701 && epsg <= 32760) {
      const south = epsg > 32700;
      const zone = epsg % 100;
      const cm = zone * 6 - 183;
      return {
        epsg, metric: true,
        name: `WGS 84 / UTM ${zone}${south ? 'S' : 'N'}`,
        proj4: `+proj=utm +zone=${zone}${south ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`,
        wkt: tmWkt(`WGS_1984_UTM_Zone_${zone}${south ? 'S' : 'N'}`, WGS84_GEOG, cm, '0.9996', south ? 10000000 : 0),
      };
    }
    // TUREF / TM27 … TM45 (EPSG:5253–5259), 3° dilimli, k=1
    if (epsg >= 5253 && epsg <= 5259) {
      const cm = 27 + (epsg - 5253) * 3;
      return {
        epsg, metric: true,
        name: `TUREF / TM${cm}`,
        proj4: `+proj=tmerc +lat_0=0 +lon_0=${cm} +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`,
        wkt: tmWkt(`TUREF_TM${cm}`, TUREF_GEOG, cm, '1.0', 0),
      };
    }
    // ED50 / UTM 35N–38N (EPSG:23035–23038), eski Türkiye haritaları
    if (epsg >= 23028 && epsg <= 23038) {
      const zone = epsg - 23000;
      const cm = zone * 6 - 183;
      return {
        epsg, metric: true,
        name: `ED50 / UTM ${zone}N`,
        proj4: `+proj=utm +zone=${zone} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`,
        wkt: tmWkt(`ED_1950_UTM_Zone_${zone}N`, ED50_GEOG, cm, '0.9996', 0),
      };
    }
    if (epsg === 4326) {
      return { epsg, metric: false, name: 'WGS 84', proj4: '+proj=longlat +datum=WGS84 +no_defs', wkt: WGS84_GEOG };
    }
    if (epsg === 3857) {
      return { epsg, metric: true, mercator: true, name: 'WGS 84 / Pseudo-Mercator', proj4: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs', wkt: null };
    }
    return null;
  }

  /** Boylam/enlem için uygun WGS84 UTM EPSG kodu. */
  function utmEpsgFor(lon, lat) {
    const zone = Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));
    return (lat >= 0 ? 32600 : 32700) + zone;
  }

  const cache = new Map();
  /** EPSG -> WGS84 lon/lat dönüştürücü (forward: lonlat->proj, inverse: proj->lonlat). */
  function converter(epsg) {
    if (cache.has(epsg)) return cache.get(epsg);
    const d = describe(epsg);
    if (!d) return null;
    const c = proj4('EPSG:4326', d.proj4);
    cache.set(epsg, c);
    return c;
  }

  // Web Mercator piksel matematiği (XYZ döşemeler için)
  function lonLatToWorld(lon, lat, z) {
    const n = 256 * Math.pow(2, z);
    const x = (lon + 180) / 360 * n;
    const s = Math.sin(lat * Math.PI / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
    return [x, y];
  }

  /** Enlemde yaklaşık metre/derece (alan tahmini için). */
  function approxAreaKm2(b) {
    const latMid = (b.south + b.north) / 2 * Math.PI / 180;
    const w = (b.east - b.west) * 111.32 * Math.cos(latMid);
    const h = (b.north - b.south) * 110.57;
    return Math.abs(w * h);
  }

  SLS.proj = { describe, utmEpsgFor, converter, lonLatToWorld, approxAreaKm2 };
})(window.SLS = window.SLS || {});
