/* GOAT r180 bootstrap (WebGPU variant) — WebGPURenderer with automatic fallback
   to the r180 WebGL renderer when WebGPU is unavailable or fails to start.
   The 3 custom GLSL ShaderMaterials of the original (world sky, world water,
   golf sky) are re-implemented as TSL node materials with identical math.
   Original shader colors were display-referred (written raw to the frame
   buffer under r128), so color constants/uniforms are converted sRGB->linear
   here and the renderer's output transform restores the original values. */
import * as THREE_NS from 'three';
import * as THREE_WEBGL from './three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { WebGPURenderer, MeshBasicNodeMaterial } from 'three/webgpu';
import * as TSL from 'three/tsl';

// r128 color-pipeline parity: the original game was authored without color
// management (hex colors used as-is). r180 converts them by default, which
// darkens every surface; disabling CM restores the original values exactly
// (verified pixel-identical against r128 in the lighting harness).
THREE_NS.ColorManagement.enabled = false;

function srgbVec3(v) {
  const c = new THREE_NS.Color().setRGB(v.x, v.y, v.z, THREE_NS.SRGBColorSpace);
  return new THREE_NS.Vector3(c.r, c.g, c.b);
}
function srgbConst(x, y, z) {
  const c = new THREE_NS.Color().setRGB(x, y, z, THREE_NS.SRGBColorSpace);
  return TSL.vec3(c.r, c.g, c.b);
}
/* Replace each {value} entry of the game's uniforms object with a TSL uniform
   node (mutating the object), so the game's per-frame `.value` writes keep
   working on the node itself. */
function toUniforms(uniforms, colorKeys) {
  const out = {};
  for (const k of Object.keys(uniforms)) {
    let v = uniforms[k].value;
    if (colorKeys.indexOf(k) >= 0 && v && v.isVector3) v = srgbVec3(v);
    const node = TSL.uniform(v);
    out[k] = node;
    uniforms[k] = node;
  }
  return out;
}
function baseNodeMat() {
  const m = new MeshBasicNodeMaterial();
  m.fog = false;
  m.toneMapped = false;
  return m;
}
function buildWorldSky(desc) {
  const u = toUniforms(desc.uniforms, ['uTopDark', 'uHorDark', 'uTopPure', 'uHorPure']);
  const d = TSL.normalize(TSL.positionWorld);
  const h = d.y.mul(1.15).add(0.08).clamp(0.0, 1.0);
  const topC = TSL.mix(u.uTopDark, u.uTopPure, u.uPure);
  const horC = TSL.mix(u.uHorDark, u.uHorPure, u.uPure);
  let col = TSL.mix(horC, topC, TSL.pow(h, 0.62));
  const sunAmt = TSL.max(TSL.dot(d, u.uSunDir), 0.0);
  col = col.add(srgbConst(1.0, 0.88, 0.62).mul(TSL.pow(sunAmt, 24.0)).mul(TSL.float(0.35).add(TSL.float(0.65).mul(u.uPure))));
  col = col.add(srgbConst(1.0, 0.96, 0.84).mul(sunAmt.smoothstep(0.996, 0.9995)).mul(1.6));
  col = col.mul(TSL.float(1.0).sub(u.uStorm.mul(0.58)));
  col = col.add(srgbConst(0.75, 0.84, 1.0).mul(u.uFlash));
  const m = baseNodeMat();
  m.colorNode = col;
  m.side = THREE_NS.BackSide;
  m.depthWrite = false;
  return m;
}
function buildWorldWater(desc) {
  const u = toUniforms(desc.uniforms, []);
  const lp = TSL.positionLocal;
  const wave = TSL.sin(lp.x.mul(0.9).add(u.uTime.mul(2.2))).mul(0.04)
    .add(TSL.cos(lp.y.mul(1.1).sub(u.uTime.mul(1.8))).mul(0.04));
  const wp = TSL.positionWorld;
  const w1 = TSL.sin(wp.x.mul(1.6).add(u.uTime.mul(2.4))).mul(TSL.cos(wp.z.mul(1.5).sub(u.uTime.mul(1.9))));
  const spec = w1.smoothstep(0.68, 0.98);
  const viewD = TSL.normalize(TSL.cameraPosition.sub(wp));
  const fres = TSL.pow(TSL.float(1.0).sub(TSL.max(TSL.dot(viewD, TSL.vec3(0.0, 1.0, 0.0)), 0.0)), 2.6);
  const col = TSL.mix(u.uBaseColor, srgbConst(0.72, 0.88, 1.0), fres.mul(0.55))
    .add(srgbConst(1.0, 0.95, 0.8).mul(spec).mul(0.45));
  const m = baseNodeMat();
  m.positionNode = lp.add(TSL.vec3(0.0, 0.0, wave));
  m.colorNode = TSL.vec4(col, 0.86);
  m.transparent = true;
  return m;
}
function buildGolfSky(desc) {
  const u = toUniforms(desc.uniforms, ['uTop', 'uHor', 'uSun']);
  const d = TSL.normalize(TSL.positionWorld);
  const h = d.y.mul(1.15).add(0.08).clamp(0.0, 1.0);
  let col = TSL.mix(u.uHor, u.uTop, TSL.pow(h, 0.6));
  const s = TSL.max(TSL.dot(d, u.uSunDir), 0.0);
  col = col.add(u.uSun.mul(TSL.pow(s, 18.0)).mul(0.55));
  col = col.add(u.uSun.mul(s.smoothstep(0.996, 0.9996)).mul(1.4));
  const m = baseNodeMat();
  m.colorNode = col;
  m.side = THREE_NS.BackSide;
  m.depthWrite = false;
  return m;
}

function inject(src) {
  const s = document.createElement('script');
  s.src = src;
  s.onload = function () {
    if (document.readyState === 'complete') {
      document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
      window.dispatchEvent(new Event('load'));
    } else if (document.readyState === 'interactive') {
      document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    }
  };
  document.body.appendChild(s);
}

let useTSL = false; // true only when the live renderer is a WebGPURenderer (either backend)

export async function boot(opts) {
  window.MeshoptDecoder = MeshoptDecoder;
  const info = { variant: 'webgpu-r180', backend: 'webgpu', adapter: null, error: null };
  let renderer = null;
  if (navigator.gpu) {
    try {
      const a = await navigator.gpu.requestAdapter();
      if (a && a.info) info.adapter = [a.info.vendor, a.info.architecture, a.info.device].filter(Boolean).join('/') || 'unknown';
    } catch (e) {}
    try {
      const r = new WebGPURenderer(opts.params);
      await r.init();
      renderer = r;
      info.backend = (r.backend && r.backend.isWebGPUBackend) ? 'webgpu' : 'webgl (WebGPURenderer auto-fallback backend)';
    } catch (e) {
      info.error = String((e && e.message) || e);
    }
  } else {
    info.error = 'navigator.gpu unavailable';
  }
  if (!renderer) {
    renderer = new THREE_WEBGL.WebGLRenderer(opts.params);
    info.backend = 'webgl (explicit fallback)';
  } else {
    useTSL = true;
  }
  // The THREE namespace handed to the game must match the live renderer family:
  // the WebGPU build's PMREMGenerator (and other extras) are node-material based
  // and break under the plain WebGL renderer, so the explicit WebGL fallback
  // exposes the WebGL build's namespace instead (both builds share one core).
  const THREE = Object.assign({}, useTSL ? THREE_NS : THREE_WEBGL, { GLTFLoader: GLTFLoader });
  window.THREE = THREE;
  window.__GOAT_SHADER__ = function (name, desc) {
    if (!useTSL) return new THREE.ShaderMaterial(desc); // WebGL fallback: original GLSL
    if (name === 'worldSky') return buildWorldSky(desc);
    if (name === 'worldWater') return buildWorldWater(desc);
    if (name === 'golfSky') return buildGolfSky(desc);
    return new THREE.ShaderMaterial(desc);
  };
  window.__GOAT_ENGINE__ = info;
  window.__GOAT_RENDERER__ = renderer;
  console.log('[GOAT engine] variant=webgpu-r180 backend=' + info.backend + ' adapter=' + info.adapter + (info.error ? ' note=' + info.error : ''));
  try { await Promise.race([MeshoptDecoder.ready, new Promise(function (r) { setTimeout(r, 3000); })]); } catch (e) {}
  inject(opts.gameSrc);
}
