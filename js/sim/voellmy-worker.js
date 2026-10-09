/* SLS Pro — Çözücü iş parçacığı (Web Worker)
 * Hesap ~40 ms'lik dilimlerle yürür; aralarda durdurma mesajı alınabilir
 * ve ~10 kare/sn akış yüksekliği görüntüsü ana iş parçacığına gönderilir.
 */
/* global SLSVoellmy */
importScripts('voellmy.js');

let sim = null;
let stopRequested = false;
let lastFrame = 0;
let wallStart = 0;

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'start') {
    stopRequested = false;
    sim = SLSVoellmy.createSim(m);
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

function loop() {
  const t0 = performance.now();
  try {
    while (performance.now() - t0 < 40) {
      if (stopRequested) sim.stop();
      sim.step();
      if (sim.done) break;
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.message || err) });
    return;
  }
  if (sim.done) {
    frame();
    const r = sim.results();
    const st = Object.assign(r.status, { wallMs: performance.now() - wallStart });
    const transfer = [r.hmax.buffer, r.vmax.buffer, r.pmax.buffer, r.hfinal.buffer];
    if (r.eroded) transfer.push(r.eroded.buffer);
    if (r.powder) transfer.push(r.powder.hmax.buffer, r.powder.vmax.buffer, r.powder.pmax.buffer);
    self.postMessage({ type: 'done', hmax: r.hmax, vmax: r.vmax, pmax: r.pmax, hfinal: r.hfinal, eroded: r.eroded, powder: r.powder, status: st, params: r.params }, transfer);
    sim = null;
    return;
  }
  if (performance.now() - lastFrame > 100) { lastFrame = performance.now(); frame(); }
  setTimeout(loop, 0);
}
