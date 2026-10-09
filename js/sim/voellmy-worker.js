/* SLS Pro — Çözücü iş parçacığı (Web Worker)
 * Hesap ~40 ms'lik dilimlerle yürür; aralarda durdurma mesajı alınabilir
 * ve ~10 kare/sn akış yüksekliği görüntüsü ana iş parçacığına gönderilir.
 */
/* global SLSVoellmy */
importScripts('voellmy.js');

let sim = null;
let rec = null;   // zaman çizelgesi kaydı { every, next, frames }
let stopRequested = false;
let lastFrame = 0;
let wallStart = 0;

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'start') {
    stopRequested = false;
    sim = SLSVoellmy.createSim(m);
    // ~200 kare: kayıt aralığı simülasyon süresine göre (en az 1 s)
    rec = { every: Math.max(1, (sim.params.tMax || 300) / 200), next: 0, frames: [] };
    record();
    wallStart = performance.now();
    lastFrame = 0;
    loop();
  } else if (m.type === 'stop') {
    stopRequested = true;
  }
};

function frame() {
  const h = new Float32Array(sim.state.h);
  const ph = sim.state.powder ? new Float32Array(sim.state.powder) : null;
  self.postMessage({ type: 'frame', h, ph, status: sim.status(), wallMs: performance.now() - wallStart }, ph ? [h.buffer, ph.buffer] : [h.buffer]);
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
    rec.frames = thin(rec.frames);
    const r = sim.results();
    const st = Object.assign(r.status, { wallMs: performance.now() - wallStart });
    const transfer = [r.hmax.buffer, r.vmax.buffer, r.pmax.buffer, r.hfinal.buffer];
    if (r.eroded) transfer.push(r.eroded.buffer);
    if (r.powder) transfer.push(r.powder.hmax.buffer, r.powder.vmax.buffer, r.powder.pmax.buffer);
    for (const f of rec.frames) { transfer.push(f.hq.buffer, f.vq.buffer); if (f.pq) transfer.push(f.pq.buffer); }
    self.postMessage({ type: 'done', hmax: r.hmax, vmax: r.vmax, pmax: r.pmax, hfinal: r.hfinal, eroded: r.eroded, powder: r.powder, frames: rec.frames, status: st, params: r.params }, transfer);
    rec = null;
    sim = null;
    return;
  }
  if (performance.now() - lastFrame > 100) { lastFrame = performance.now(); frame(); }
  setTimeout(loop, 0);
}
