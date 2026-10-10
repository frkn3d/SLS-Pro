/* SLS Pro — Çözücü iş parçacığı (Web Worker)
 * CPU: hesap ~40 ms'lik dilimlerle yürür; aralarda durdurma mesajı alınabilir.
 * GPU (WebGPU): toplu adımlar halinde yürür (voellmy-gpu.js).
 * ~7–10 kare/sn akış yüksekliği görüntüsü ana iş parçacığına gönderilir.
 */
/* global SLSVoellmy, SLSVoellmyGPU */
importScripts('voellmy.js', 'voellmy-gpu.js');

const GPU_AUTO_CELLS = 60000;   // otomatik kipte GPU'nun seçildiği en küçük ızgara

let sim = null;
let rec = null;   // zaman çizelgesi kaydı { every, next, frames }
let stopRequested = false;
let lastFrame = 0;
let wallStart = 0;

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'start') start(m);
  else if (m.type === 'stop') {
    stopRequested = true;
  }
};

/** Hesap motoru: 'gpu' istenirse veya 'auto' + büyük ızgara + toz bulutu kapalıysa WebGPU; olmazsa CPU */
async function start(m) {
  stopRequested = false;
  const prm = m.params || {}, want = prm.engine || 'auto';
  const tryGpu = !prm.powder && self.navigator && self.navigator.gpu && (want === 'gpu' || (want === 'auto' && m.width * m.height >= GPU_AUTO_CELLS));
  let note = null;
  sim = null;
  if (tryGpu) {
    try { sim = await SLSVoellmyGPU.createGpuSim(m); }
    catch (err) { note = String(err && err.message || err); sim = null; }
  } else if (want === 'gpu') note = prm.powder ? 'powder' : 'unavailable';
  if (!sim) sim = SLSVoellmy.createSim(m);
  sim.engineNote = note;
  // ~200 kare: kayıt aralığı simülasyon süresine göre (en az 1 s)
  const ev = Number(sim.params.recordEvery) > 0 ? Number(sim.params.recordEvery) : Math.max(1, (sim.params.tMax || 300) / 200);
  rec = { every: ev, next: 0, frames: [] };
  if (sim.gpu) await sim.sync();
  record();
  wallStart = performance.now();
  lastFrame = 0;
  if (sim.gpu) gpuLoop(); else loop();
}

const status = () => Object.assign(sim.status(), { engine: sim.gpu ? 'gpu' : 'cpu', engineNote: sim.engineNote || null });

/** GPU döngüsü: toplu adımlar (~30 ms), kayıt zamanına göre kırpılır; durum yalnızca gerektiğinde okunur */
async function gpuLoop() {
  let batch = 16;
  try {
    while (!sim.done) {
      if (stopRequested) { sim.stop(); break; }
      const toRec = sim.dt > 0 ? Math.ceil((rec.next - sim.t) / sim.dt) : batch;
      const n = Math.max(1, Math.min(batch, toRec));
      const t0 = performance.now();
      await sim.advance(n);
      const el = performance.now() - t0;
      if (n === batch) batch = Math.max(4, Math.min(1024, Math.round(batch * (el < 20 ? 1.5 : el > 45 ? 0.7 : 1))));
      const needRec = sim.t >= rec.next - 1e-6, needFrame = performance.now() - lastFrame > 150;
      if (needRec || needFrame) await sim.sync();
      if (needRec) record();
      if (needFrame && !sim.done) { lastFrame = performance.now(); if (sim.syncEntrained && Math.random() < 0.2) await sim.syncEntrained(); frame(); }
    }
    await sim.sync();
    if (rec.frames[rec.frames.length - 1].t < sim.t) record();
    frame();
    const r = await sim.results();
    finish(r);
  } catch (err) {
    try { sim.destroy(); } catch (e) { /* zaten kapalı */ }
    self.postMessage({ type: 'error', message: 'WebGPU: ' + String(err && err.message || err) });
  }
}

function finish(r) {
  rec.frames = thin(rec.frames);
  const st = Object.assign(r.status, { wallMs: performance.now() - wallStart, engine: sim.gpu ? 'gpu' : 'cpu', engineNote: sim.engineNote || null });
  const transfer = [r.hmax.buffer, r.vmax.buffer, r.pmax.buffer, r.hfinal.buffer];
  if (r.eroded) transfer.push(r.eroded.buffer);
  if (r.powder) transfer.push(r.powder.hmax.buffer, r.powder.vmax.buffer, r.powder.pmax.buffer);
  for (const f of rec.frames) { transfer.push(f.hq.buffer, f.vq.buffer); if (f.pq) transfer.push(f.pq.buffer); }
  self.postMessage({ type: 'done', hmax: r.hmax, vmax: r.vmax, pmax: r.pmax, hfinal: r.hfinal, eroded: r.eroded, powder: r.powder, frames: rec.frames, status: st, params: r.params }, transfer);
  rec = null;
  sim = null;
}

function frame() {
  const h = new Float32Array(sim.state.h);
  const ph = sim.state.powder ? new Float32Array(sim.state.powder) : null;
  self.postMessage({ type: 'frame', h, ph, status: status(), wallMs: performance.now() - wallStart }, ph ? [h.buffer, ph.buffer] : [h.buffer]);
}

const FRAME_BUDGET = 40 * 1048576;   // senaryo başına zaman çizelgesi bellek bütçesi (bayt)

/** Bütçe aşılırsa ilk ve son kare korunarak aradaki kareler seyreltilir. */
function thin(frames) {
  const size = (fs) => fs.reduce((a, f) => a + f.hq.length + f.vq.length + (f.pq ? f.pq.length : 0), 0);
  while (frames.length > 40 && size(frames) > FRAME_BUDGET) {
    frames = frames.filter((f, i) => i === 0 || i === frames.length - 1 || i % 2 === 0);
  }
  return frames;
}

function record() {
  rec.frames.push(sim.snapshot());
  rec.next = sim.t + rec.every;
}

function loop() {
  const t0 = performance.now();
  try {
    while (performance.now() - t0 < 40) {
      if (stopRequested) sim.stop();
      sim.step();
      if (sim.t >= rec.next) record();
      if (sim.done) break;
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.message || err) });
    return;
  }
  if (sim.done) {
    frame();
    if (rec.frames[rec.frames.length - 1].t < sim.t) record();
    finish(sim.results());
    return;
  }
  if (performance.now() - lastFrame > 100) { lastFrame = performance.now(); frame(); }
  setTimeout(loop, 0);
}
