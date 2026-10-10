/* SLS Pro — Voellmy-Salm yoğun akış çözücüsünün WebGPU (WGSL) sürümü
 *
 * voellmy.js ile aynı ayrıklaştırma: HLL akısı, MUSCL-MC + Heun (SSP-RK2) veya birinci derece,
 * sürtünme + kar sürüklenmesi adım başına bir kez (yarı-kapalı). Toz bulutu katmanı yoktur
 * (bulut açıkken CPU çözücüsü kullanılır).
 *
 * Tamamen GPU'da yürür: her adımda dalga hızı ve momentum indirgemesi, dt seçimi, zaman ve
 * durma ölçütü bir denetim tamponunda hesaplanır; CPU yalnızca toplu adımlar arasında bu
 * küçük tamponu okur. Kütle muhasebesi atomik işlem gerektirmez: kırpma hücre bazında
 * (durum.w), kenar çıkışı sınır yüzü bazında birikir.
 * Tek duyarlıklı (f32) hesap: CPU (f64) ile fark tipik olarak binde birler mertebesindedir.
 */
(function (root) {
  'use strict';

  const WG = 256;
  const CTRL = 16;   // denetim tamponu başlığı (f32): 0 dt, 1 t, 2 bitti, 3 neden, 4 adım, 5 momentum, 6 maks. momentum, 7 anlık maks. U, 8 akan hücre
  const REASONS = { 1: 'empty', 2: 'tmax', 3: 'momentum', 4: 'stopped' };

  const WGSL = /* wgsl */`
struct Params {
  W: u32, H: u32, N: u32, nwg: u32,
  nx: u32, order: u32, hasErod: u32, pad0: u32,
  dx: f32, A: f32, cfl: f32, tMax: f32,
  stopRatio: f32, rho: f32, minFlowH: f32, kappaE: f32,
  rhoCover: f32, uErode: f32, pad1: f32, pad2: f32,
};
const G: f32 = 9.81;
const EPS: f32 = 1e-3;
const VMAX: f32 = 150.0;

@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> geo: array<vec4f>;        // zx, zy, cos²θ, duvar
@group(0) @binding(2) var<storage, read> muxi: array<vec2f>;       // μ, ξ
@group(0) @binding(3) var<storage, read_write> sa: array<vec4f>;   // h, hu, hv, kırpılan hacim (birikimli)
@group(0) @binding(4) var<storage, read_write> sb: array<vec4f>;   // ara aşama
@group(0) @binding(5) var<storage, read_write> acc: array<vec4f>;  // hmax, vmax, kalan örtü, alınan örtü
@group(0) @binding(6) var<storage, read_write> part: array<vec4f>; // çalışma grubu kısmi indirgemeleri
@group(0) @binding(7) var<storage, read_write> ctrl: array<f32>;   // denetim başlığı + kenar çıkışları

var<workgroup> red1: array<vec4f, ${WG}>;
var<workgroup> red2: array<vec4f, ${WG}>;

fn isWall(j: u32) -> bool { return geo[j].w > 0.5; }
fn gnAt(j: u32) -> f32 { return G * sqrt(geo[j].z); }
fn st(j: u32, src: u32) -> vec4f { if (src == 0u) { return sa[j]; } return sb[j]; }
fn velA(s: vec4f) -> f32 { if (s.x < EPS) { return 0.0; } return s.y / s.x; }
fn velB(s: vec4f) -> f32 { if (s.x < EPS) { return 0.0; } return s.z / s.x; }

fn mc(a: f32, b: f32, c: f32) -> f32 {
  let d1 = b - a; let d2 = c - b;
  if (d1 * d2 <= 0.0) { return 0.0; }
  return sign(d1) * min(min(2.0 * abs(d1), 0.5 * abs(c - a)), 2.0 * abs(d2));
}

fn hll(hL: f32, unL: f32, utL: f32, hR: f32, unR: f32, utR: f32, g: f32) -> vec3f {
  let cL = sqrt(g * hL); let cR = sqrt(g * hR);
  var sL: f32; var sR: f32;
  if (hL < EPS) { sL = unR - 2.0 * cR; sR = unR + cR; }
  else if (hR < EPS) { sL = unL - cL; sR = unL + 2.0 * cL; }
  else { sL = min(unL - cL, unR - cR); sR = max(unL + cL, unR + cR); }
  let FL = vec3f(hL * unL, hL * unL * unL + 0.5 * g * hL * hL, hL * unL * utL);
  let FR = vec3f(hR * unR, hR * unR * unR + 0.5 * g * hR * hR, hR * unR * utR);
  if (sL >= 0.0) { return FL; }
  if (sR <= 0.0) { return FR; }
  let UL = vec3f(hL, hL * unL, hL * utL); let UR = vec3f(hR, hR * unR, hR * utR);
  return (sR * FL - sL * FR + sL * sR * (UR - UL)) / (sR - sL);
}

// Yüz akısı (iL → iR). iL/iR = -1: alan dışı; iLL/iRR = -1: ikinci komşu yok. Dönüş: (fh, fu, fv, -)
fn faceFlux(src: u32, iL: i32, iR: i32, iLL: i32, iRR: i32, xDir: bool) -> vec4f {
  if (iL < 0 && iR < 0) { return vec4f(0.0); }
  let jL = select(iR, iL, iL >= 0); let jR = select(iL, iR, iR >= 0);
  if (isWall(u32(jL)) || isWall(u32(jR))) { return vec4f(0.0); }
  let SL = st(u32(jL), src); let SR = st(u32(jR), src);
  var hL = SL.x; var hR = SR.x;
  if (hL < EPS && hR < EPS) { return vec4f(0.0); }
  var aL = velA(SL); var bL = velB(SL); var aR = velA(SR); var bR = velB(SR);
  if (p.order == 2u && iL >= 0 && iR >= 0) {
    var jLL = select(jL, iLL, iLL >= 0); var jRR = select(jR, iRR, iRR >= 0);
    if (isWall(u32(jLL))) { jLL = jL; }
    if (isWall(u32(jRR))) { jRR = jR; }
    let SLL = st(u32(jLL), src); let SRR = st(u32(jRR), src);
    let cAL = aL; let cBL = bL; let cAR = aR; let cBR = bR;
    let hl = hL + 0.5 * mc(SLL.x, hL, hR); let hr = hR - 0.5 * mc(hL, hR, SRR.x);
    if (hl >= EPS) { aL = cAL + 0.5 * mc(velA(SLL), cAL, cAR); bL = cBL + 0.5 * mc(velB(SLL), cBL, cBR); } else { aL = 0.0; bL = 0.0; }
    if (hr >= EPS) { aR = cAR - 0.5 * mc(cAL, cAR, velA(SRR)); bR = cBR - 0.5 * mc(cBL, cBR, velB(SRR)); } else { aR = 0.0; bR = 0.0; }
    hL = hl; hR = hr;
    if (hL < EPS && hR < EPS) { return vec4f(0.0); }
  }
  let g = 0.5 * (gnAt(u32(jL)) + gnAt(u32(jR)));
  var f: vec3f;
  if (xDir) { f = hll(hL, aL, bL, hR, aR, bR, g); } else { f = hll(hL, bL, aL, hR, bR, aR, g); }
  if ((iL < 0 && f.x > 0.0) || (iR < 0 && f.x < 0.0)) { return vec4f(0.0); }  // sınırdan içeri akış yok
  if (xDir) { return vec4f(f.x, f.y, f.z, 0.0); }
  return vec4f(f.x, f.z, f.y, 0.0);
}

// Bir hiperbolik aşama (akı farkı + yerçekimi). Dönüş: yeni (h, hu, hv) ve bu aşamada kırpılan hacim.
fn stageCore(i: u32, src: u32, w: f32) -> vec4f {
  let S = st(i, src);
  let dt = ctrl[0];
  if (dt <= 0.0 || isWall(i)) { return vec4f(S.xyz, 0.0); }
  let Wi = i32(p.W); let Hi = i32(p.H); let ii = i32(i);
  let r = i32(i / p.W); let c = i32(i % p.W);
  let iE = select(-1, ii + 1, c + 1 < Wi);
  let iW = select(-1, ii - 1, c >= 1);
  let iS = select(-1, ii + Wi, r + 1 < Hi);
  let iN = select(-1, ii - Wi, r >= 1);
  let fe = faceFlux(src, ii, iE, iW, select(-1, ii + 2, c + 2 < Wi), true);
  let fw = faceFlux(src, iW, ii, select(-1, ii - 2, c >= 2), iE, true);
  let fs = faceFlux(src, ii, iS, iN, select(-1, ii + 2 * Wi, r + 2 < Hi), false);
  let fn_ = faceFlux(src, iN, ii, select(-1, ii - 2 * Wi, r >= 2), iS, false);
  let ex = w * dt * p.dx;
  if (iW < 0) { ctrl[${CTRL}u + u32(r)] += -fw.x * ex; }
  if (iE < 0) { ctrl[${CTRL}u + p.H + u32(r)] += fe.x * ex; }
  if (iN < 0) { ctrl[${CTRL}u + 2u * p.H + u32(c)] += -fn_.x * ex; }
  if (iS < 0) { ctrl[${CTRL}u + 2u * p.H + p.W + u32(c)] += fs.x * ex; }
  let d = fw.xyz - fe.xyz + fn_.xyz - fs.xyz;
  let k = dt / p.dx;
  let g4 = geo[i];
  let hOld = S.x;
  var hn = hOld + k * d.x;
  let qx = S.y + k * d.y - dt * G * g4.z * hOld * g4.x;
  let qy = S.z + k * d.z - dt * G * g4.z * hOld * g4.y;
  if (hn < EPS) {
    var cl = 0.0;
    if (hn < 0.0) { cl = -w * hn * p.A; hn = 0.0; }
    return vec4f(hn, 0.0, 0.0, cl);
  }
  return vec4f(hn, qx, qy, 0.0);
}

fn cellIndex(wid: vec3u, li: u32) -> u32 { return (wid.y * p.nx + wid.x) * ${WG}u + li; }

@compute @workgroup_size(${WG})
fn stage1(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  let i = cellIndex(wid, li);
  if (i >= p.N) { return; }
  let o = stageCore(i, 0u, select(0.5, 1.0, p.order == 1u));
  sb[i] = vec4f(o.xyz, sa[i].w + o.w);
}

@compute @workgroup_size(${WG})
fn stage2(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  let i = cellIndex(wid, li);
  if (i >= p.N) { return; }
  let o = stageCore(i, 1u, 0.5);
  sa[i] = vec4f(0.5 * (sa[i].xyz + o.xyz), sb[i].w + o.w);   // Heun ortalaması
}

@compute @workgroup_size(${WG})
fn copyBack(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  let i = cellIndex(wid, li);
  if (i >= p.N) { return; }
  sa[i] = sb[i];
}

// Sürtünme + sürüklenme (kapalı), maksimumlar; sonraki adım için dalga hızı ve momentum indirgemesi
@compute @workgroup_size(${WG})
fn friction(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) li: u32) {
  let wgi = wid.y * p.nx + wid.x;
  let i = wgi * ${WG}u + li;
  var r1 = vec4f(0.0);   // maks |u|+c, maks |v|+c, Σ h·U, maks U
  var r2 = vec4f(0.0);   // akan hücre, ıslak hücre
  if (i < p.N && !isWall(i)) {
    let dt = ctrl[0];
    let s = sa[i];
    var hn = s.x;
    if (hn < EPS) {
      sa[i] = vec4f(hn, 0.0, 0.0, s.w);
      if (hn > 0.0) { r2.y = 1.0; }
    } else {
      var u = s.y / hn; var v = s.z / hn;
      let sp = sqrt(u * u + v * v);
      let c2 = geo[i].z; let cT = sqrt(c2);
      var sNew = 0.0;
      if (sp > 0.0) {
        let mx = muxi[i];
        let s1 = max(0.0, sp - dt * mx.x * G * c2);                                // Coulomb
        sNew = min(2.0 * s1 / (1.0 + sqrt(1.0 + 4.0 * dt * G * s1 / (mx.y * hn * c2))), VMAX); // türbülans
        let f = sNew / sp; u *= f; v *= f;
      }
      var U = sNew / cT;
      var a = acc[i];
      if (p.hasErod == 1u && a.z > 0.0 && hn >= p.minFlowH && U > p.uErode) {
        let de = min(a.z, dt * p.kappaE * U);
        a.z -= de; a.w += de;
        let add = de * p.rhoCover / p.rho;
        let f = hn / (hn + add);
        hn += add; u *= f; v *= f; sNew *= f; U *= f;
      }
      sa[i] = vec4f(hn, hn * u, hn * v, s.w);
      r2.y = 1.0;
      a.x = max(a.x, hn);
      if (sNew > 0.0) {
        if (hn >= p.minFlowH && U > a.y) { a.y = U; }
        r1.z = hn * U; r1.w = U;
        if (hn >= p.minFlowH && U > 0.1) { r2.x = 1.0; }
      }
      acc[i] = a;
      let cc = sqrt(G * cT * hn);
      r1.x = abs(u) + cc; r1.y = abs(v) + cc;
    }
  }
  red1[li] = r1; red2[li] = r2;
  workgroupBarrier();
  for (var s = ${WG / 2}u; s > 0u; s = s >> 1u) {
    if (li < s) {
      let a = red1[li]; let b = red1[li + s];
      red1[li] = vec4f(max(a.x, b.x), max(a.y, b.y), a.z + b.z, max(a.w, b.w));
      red2[li] = red2[li] + red2[li + s];
    }
    workgroupBarrier();
  }
  if (li == 0u) { part[2u * wgi] = red1[0]; part[2u * wgi + 1u] = red2[0]; }
}

// Tek çalışma grubu: kısmi indirgemeler → zaman, durma ölçütü ve sonraki dt
@compute @workgroup_size(${WG})
fn finalize(@builtin(local_invocation_index) li: u32) {
  var r1 = vec4f(0.0); var r2 = vec4f(0.0);
  for (var k = li; k < p.nwg; k += ${WG}u) {
    let a = part[2u * k]; let b = part[2u * k + 1u];
    r1 = vec4f(max(r1.x, a.x), max(r1.y, a.y), r1.z + a.z, max(r1.w, a.w));
    r2 += b;
  }
  red1[li] = r1; red2[li] = r2;
  workgroupBarrier();
  for (var s = ${WG / 2}u; s > 0u; s = s >> 1u) {
    if (li < s) {
      let a = red1[li]; let b = red1[li + s];
      red1[li] = vec4f(max(a.x, b.x), max(a.y, b.y), a.z + b.z, max(a.w, b.w));
      red2[li] = red2[li] + red2[li + s];
    }
    workgroupBarrier();
  }
  if (li != 0u || ctrl[2] > 0.5) { return; }
  let a = red1[0]; let b = red2[0];
  let dtPrev = ctrl[0];
  if (dtPrev > 0.0) { ctrl[1] += dtPrev; ctrl[4] += 1.0; }
  let t = ctrl[1];
  let mom = a.z * p.A;
  ctrl[5] = mom; ctrl[7] = a.w; ctrl[8] = b.x;
  var reason = 0.0;
  if (dtPrev > 0.0) {
    ctrl[6] = max(ctrl[6], mom);
    if (b.y < 0.5) { reason = 1.0; }
    else if (t >= p.tMax - 1e-4) { reason = 2.0; }
    else if (t > 2.0 && mom < p.stopRatio * ctrl[6]) { reason = 3.0; }
  } else if (b.y < 0.5) { reason = 1.0; }
  if (reason == 0.0 && a.x + a.y <= 0.0) { reason = 4.0; }
  if (reason > 0.0) { ctrl[2] = 1.0; ctrl[3] = reason; ctrl[0] = 0.0; }
  else { ctrl[0] = min(min(p.cfl * p.dx / (a.x + a.y), 0.5), p.tMax - t + 1e-6); }
}
`;

  /** WebGPU kullanılabilir mi (adaptör alınabiliyor mu)? */
  async function available(gpu) {
    gpu = gpu || (typeof navigator !== 'undefined' ? navigator.gpu : null);
    if (!gpu) return false;
    try { return !!(await gpu.requestAdapter()); } catch (e) { return false; }
  }

  /**
   * createSim ile aynı girdiler (o.width, o.height, o.dx, o.z, o.h0, o.muMap, o.xiMap, o.erodible, o.params).
   * Dönen nesne zaman uyumsuzdur: advance(n), sync(), results().
   */
  async function createGpuSim(o, gpu) {
    const V = root.SLSVoellmy;
    gpu = gpu || (typeof navigator !== 'undefined' ? navigator.gpu : null);
    if (!gpu) throw new Error('WebGPU yok');
    const W = o.width, H = o.height, N = W * H, dx = o.dx, A = dx * dx;
    const p = Object.assign({}, V.DEFAULTS, o.params || {});
    if (p.powder) throw new Error('GPU çözücüsünde toz bulutu yok');
    const order = p.order === 1 ? 1 : 2;

    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('WebGPU adaptörü yok');
    const need = N * 16;
    const lim = adapter.limits;
    if (need > lim.maxStorageBufferBindingSize || need > lim.maxBufferSize) throw new Error('Izgara GPU belleği sınırını aşıyor');
    const device = await adapter.requestDevice({
      requiredLimits: { maxStorageBufferBindingSize: Math.min(lim.maxStorageBufferBindingSize, Math.max(need, 134217728)), maxBufferSize: Math.min(lim.maxBufferSize, Math.max(need, 268435456)) },
    });
    let lost = null;
    device.lost.then((info) => { lost = info; });

    const g = V.geometry(W, H, dx, o.z);
    const geo = new Float32Array(N * 4), mx = new Float32Array(N * 2), sa = new Float32Array(N * 4), acc = new Float32Array(N * 4);
    let releaseVolume = 0;
    for (let i = 0; i < N; i++) {
      geo[4 * i] = g.zx[i]; geo[4 * i + 1] = g.zy[i]; geo[4 * i + 2] = g.cos2[i]; geo[4 * i + 3] = g.wall[i];
      mx[2 * i] = o.muMap ? o.muMap[i] : p.mu; mx[2 * i + 1] = o.xiMap ? o.xiMap[i] : p.xi;
      const v = g.wall[i] ? 0 : (o.h0[i] || 0);
      if (v > 0) { sa[4 * i] = v; acc[4 * i] = v; releaseVolume += v * A; }
      if (o.erodible) acc[4 * i + 2] = o.erodible[i];
    }

    const nwg = Math.ceil(N / WG), nx = Math.min(nwg, 65535), ny = Math.ceil(nwg / nx);
    const nCtrl = CTRL + 2 * H + 2 * W;
    const S = GPUBufferUsage.STORAGE, CD = GPUBufferUsage.COPY_DST, CS = GPUBufferUsage.COPY_SRC;
    const buf = (data, usage) => {
      const b = device.createBuffer({ size: Math.max(16, data.byteLength), usage, mappedAtCreation: true });
      new data.constructor(b.getMappedRange()).set(data); b.unmap(); return b;
    };
    const params = new ArrayBuffer(80), pu = new Uint32Array(params), pf = new Float32Array(params);
    pu.set([W, H, N, nwg, nx, order, o.erodible ? 1 : 0, 0]);
    pf.set([dx, A, p.cfl, p.tMax, p.stopRatio, p.rho, p.minFlowH, p.kappaE, p.rhoCover, p.uErode, 0, 0], 8);
    const B = {
      p: buf(new Uint32Array(params), GPUBufferUsage.UNIFORM | CD),
      geo: buf(geo, S), muxi: buf(mx, S),
      sa: buf(sa, S | CS), sb: device.createBuffer({ size: N * 16, usage: S }),
      acc: buf(acc, S | CS), part: device.createBuffer({ size: Math.max(32, nwg * 32), usage: S }),
      ctrl: buf(new Float32Array(nCtrl), S | CS | CD),
    };
    const read = {
      ctrl: device.createBuffer({ size: nCtrl * 4, usage: GPUBufferUsage.MAP_READ | CD }),
      big: device.createBuffer({ size: N * 16, usage: GPUBufferUsage.MAP_READ | CD }),
    };

    device.pushErrorScope('validation');
    const module = device.createShaderModule({ code: WGSL });
    const ro = { type: 'read-only-storage' }, rw = { type: 'storage' };
    const types = [{ type: 'uniform' }, ro, ro, rw, rw, rw, rw, rw];
    const bgl = device.createBindGroupLayout({ entries: types.map((t, k) => ({ binding: k, visibility: GPUShaderStage.COMPUTE, buffer: t })) });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
    const pipe = {};
    for (const e of ['stage1', 'stage2', 'copyBack', 'friction', 'finalize']) {
      pipe[e] = await device.createComputePipelineAsync({ layout, compute: { module, entryPoint: e } });
    }
    const bind = device.createBindGroup({ layout: bgl, entries: [B.p, B.geo, B.muxi, B.sa, B.sb, B.acc, B.part, B.ctrl].map((b, k) => ({ binding: k, resource: { buffer: b } })) });
    const err = await device.popErrorScope();
    if (err) throw new Error('WGSL: ' + err.message);

    let t = 0, steps = 0, done = releaseVolume === 0, reason = done ? 'empty' : null, dt = 0;
    let momentum = 0, momentumMax = 0, vNowMax = 0, flowing = 0;
    const edges = { w: 0, e: 0, n: 0, s: 0 };
    let clipped = 0;
    const h = new Float32Array(N), hu = new Float32Array(N), hv = new Float32Array(N);
    const cosT = g.cosT;

    function encodeSteps(enc, n, withInit) {
      const pass = enc.beginComputePass();
      pass.setBindGroup(0, bind);
      if (withInit) {   // dt = 0: yalnızca ilk dalga hızı / dt
        pass.setPipeline(pipe.friction); pass.dispatchWorkgroups(nx, ny);
        pass.setPipeline(pipe.finalize); pass.dispatchWorkgroups(1);
      }
      for (let k = 0; k < n; k++) {
        pass.setPipeline(pipe.stage1); pass.dispatchWorkgroups(nx, ny);
        pass.setPipeline(order === 2 ? pipe.stage2 : pipe.copyBack); pass.dispatchWorkgroups(nx, ny);
        pass.setPipeline(pipe.friction); pass.dispatchWorkgroups(nx, ny);
        pass.setPipeline(pipe.finalize); pass.dispatchWorkgroups(1);
      }
      pass.end();
    }

    async function readCtrl(enc) {
      enc.copyBufferToBuffer(B.ctrl, 0, read.ctrl, 0, nCtrl * 4);
      device.queue.submit([enc.finish()]);
      await read.ctrl.mapAsync(GPUMapMode.READ);
      const c = new Float32Array(read.ctrl.getMappedRange()).slice();
      read.ctrl.unmap();
      if (lost) throw new Error('GPU aygıtı kayboldu: ' + (lost.message || lost.reason));
      dt = c[0]; t = c[1]; steps = c[4]; momentum = c[5]; momentumMax = c[6]; vNowMax = c[7]; flowing = c[8];
      if (c[2] > 0.5 && !done) { done = true; reason = REASONS[c[3]] || 'stopped'; }
      let w = 0, e = 0, nn = 0, s = 0;
      for (let r = 0; r < H; r++) { w += c[CTRL + r]; e += c[CTRL + H + r]; }
      for (let q = 0; q < W; q++) { nn += c[CTRL + 2 * H + q]; s += c[CTRL + 2 * H + W + q]; }
      edges.w = w; edges.e = e; edges.n = nn; edges.s = s;
    }

    let started = false;
    /** n adım ilerletir (bitmişse adımlar GPU'da boş geçer) */
    async function advance(n) {
      if (done) return;
      const enc = device.createCommandEncoder();
      encodeSteps(enc, Math.max(1, n | 0), !started);
      started = true;
      await readCtrl(enc);
    }

    async function readBig(src) {
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(src, 0, read.big, 0, N * 16);
      device.queue.submit([enc.finish()]);
      await read.big.mapAsync(GPUMapMode.READ);
      const a = new Float32Array(read.big.getMappedRange()).slice();
      read.big.unmap();
      return a;
    }

    /** Durumu (h, hu, hv, kırpılan hacim) CPU'ya kopyalar: kare, anlık görüntü ve durum için */
    async function sync() {
      const a = await readBig(B.sa);
      let cl = 0;
      for (let i = 0; i < N; i++) { h[i] = a[4 * i]; hu[i] = a[4 * i + 1]; hv[i] = a[4 * i + 2]; cl += a[4 * i + 3]; }
      clipped = cl;
    }

    function entrainedFrom(a) {
      if (!o.erodible) return { eroded: null, entrained: 0 };
      const er = new Float32Array(N); let s = 0;
      for (let i = 0; i < N; i++) { er[i] = a[4 * i + 3]; s += er[i]; }
      return { eroded: er, entrained: s * p.rhoCover / p.rho * A };
    }
    let entrained = 0;

    function status() {
      return {
        t, steps, done, reason, outflow: edges.w + edges.e + edges.n + edges.s, edges: Object.assign({}, edges), clipped, releaseVolume, entrained, toPowderVol: 0,
        momentumRatio: momentumMax > 0 ? momentum / momentumMax : 0, vNowMax, flowingCells: flowing, powder: null, engine: 'gpu',
      };
    }

    /** Zaman çizelgesi karesi (voellmy.js snapshot ile aynı biçim); önce sync() çağrılmalı */
    function snapshot() {
      let c0 = W, c1 = -1, r0 = H, r1 = -1;
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (h[r * W + c] > 0) { if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < r0) r0 = r; if (r > r1) r1 = r; }
      }
      const base = { t, vNow: vNowMax, mom: momentumMax > 0 ? momentum / momentumMax : 0 };
      if (c1 < 0) return Object.assign(base, { c0: 0, r0: 0, w: 0, h: 0, hq: new Uint8Array(0), vq: new Uint8Array(0), pq: null });
      const w = c1 - c0 + 1, hh = r1 - r0 + 1;
      const hq = new Uint8Array(w * hh), vq = new Uint8Array(w * hh);
      for (let r = r0, k = 0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++, k++) {
          const i = r * W + c, hi = h[i];
          hq[k] = V.QUANT.qh(hi);
          if (hi > 1e-3) vq[k] = V.QUANT.qv(Math.hypot(hu[i], hv[i]) / hi / cosT[i]);
        }
      }
      return Object.assign(base, { c0, r0, w, h: hh, hq, vq, pq: null });
    }

    async function results() {
      await sync();
      const a = await readBig(B.acc);
      const hmax = new Float32Array(N), vmax = new Float32Array(N), pmax = new Float32Array(N);
      const kp = 0.5 * p.cd * p.rho / 1000;
      let vol = 0;
      for (let i = 0; i < N; i++) { hmax[i] = a[4 * i]; vmax[i] = a[4 * i + 1]; pmax[i] = kp * vmax[i] * vmax[i]; vol += h[i]; }
      const er = entrainedFrom(a);
      entrained = er.entrained;
      const out = {
        hmax, vmax, pmax, hfinal: Float32Array.from(h), eroded: er.eroded, powder: null,
        status: Object.assign(status(), { depositVolume: vol * A }), params: Object.assign({}, p, { engine: 'gpu' }),
      };
      destroy();
      return out;
    }

    /** Canlı durum için alınan örtü toplamı (ara sıra) */
    async function syncEntrained() {
      if (!o.erodible) return;
      entrained = entrainedFrom(await readBig(B.acc)).entrained;
    }

    function destroy() {
      for (const b of Object.values(B)) b.destroy();
      read.ctrl.destroy(); read.big.destroy();
      device.destroy();
    }

    // İlk geçiş (dt = 0): başlangıç dalga hızları ve ilk dt
    { const enc = device.createCommandEncoder(); encodeSteps(enc, 0, true); started = true; await readCtrl(enc); }

    return {
      advance, sync, syncEntrained, status, snapshot, results, destroy, params: Object.assign({}, p, { engine: 'gpu' }),
      get t() { return t; }, get done() { return done; }, get dt() { return dt; },
      state: { h, hu, hv, cosT, powder: null },
      stop() { if (!done) { done = true; reason = 'user'; } },
      gpu: true, adapterInfo: adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, description: adapter.info.description } : null,
    };
  }

  const api = { createGpuSim, available, WGSL };
  root.SLSVoellmyGPU = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
