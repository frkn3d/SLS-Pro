/* SLS Pro — Proje deposu
 * Proje = zip (fflate) içinde project.json + ikili diziler (bin/*.bin).
 * Tarayıcıda IndexedDB'de saklanır; .slsproj dosyası olarak dışa / içe aktarılır.
 */
(function (SLS) {
  'use strict';

  const DB = 'sls-pro', STORE = 'projects', VERSION = 1;
  const FORMAT = 'sls-project';

  function db() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, VERSION);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
      const out = fn(s);
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }

  /** Typed array → Uint8Array (bayt görünümü) */
  const bytes = (ta) => new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);
  /** Uint8Array → istenen tür (hizalama için kopya) */
  function typed(u8, Type) {
    const copy = new Uint8Array(u8.length); copy.set(u8);
    return new Type(copy.buffer);
  }

  /** { json, bins: { name: TypedArray } } → zip Blob */
  async function pack(json, bins) {
    const ff = await SLS.kml.fflate();
    const files = { 'project.json': ff.strToU8(JSON.stringify(Object.assign({ format: FORMAT }, json))) };
    const manifest = {};
    for (const [name, arr] of Object.entries(bins)) {
      if (!arr) continue;
      files[`bin/${name}.bin`] = [bytes(arr), { level: 6 }];
      manifest[name] = arr.constructor.name;
    }
    files['bins.json'] = ff.strToU8(JSON.stringify(manifest));
    return new Blob([ff.zipSync(files)], { type: 'application/zip' });
  }

  /** zip Blob → { json, bins } */
  async function unpack(blob) {
    const ff = await SLS.kml.fflate();
    const files = ff.unzipSync(new Uint8Array(await blob.arrayBuffer()));
    if (!files['project.json']) throw new Error('not-a-project');
    const json = JSON.parse(ff.strFromU8(files['project.json']));
    if (json.format !== FORMAT) throw new Error('not-a-project');
    const manifest = JSON.parse(ff.strFromU8(files['bins.json'] || ff.strToU8('{}')));
    const types = { Float32Array, Float64Array, Uint8Array, Int32Array, Uint16Array };
    const bins = {};
    for (const [name, type] of Object.entries(manifest)) {
      const u8 = files[`bin/${name}.bin`];
      if (u8) bins[name] = typed(u8, types[type] || Uint8Array);
    }
    return { json, bins };
  }

  async function save(rec) {
    // rec: { id?, name, blob, summary }
    const r = Object.assign({}, rec, { id: rec.id || 'p' + Date.now().toString(36), updated: new Date().toISOString() });
    r.size = r.blob.size;
    await tx('readwrite', (s) => s.put(r));
    return r;
  }
  async function list() {
    const all = await tx('readonly', (s) => s.getAll());
    return (all || []).map(({ blob, ...meta }) => meta).sort((a, b) => (a.updated < b.updated ? 1 : -1));
  }
  async function get(id) { return tx('readonly', (s) => s.get(id)); }
  async function remove(id) { return tx('readwrite', (s) => s.delete(id)); }

  SLS.projectStore = { pack, unpack, save, list, get, remove, FORMAT };
})(window.SLS = window.SLS || {});
