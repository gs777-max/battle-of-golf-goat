/* GOAT r180 bootstrap (WebGL variant) — sets up window.THREE / renderer / shader
   factory, then injects the classic game script (assets/game-*.js) unchanged in
   global semantics. Renderer params are exact copies of the original r128
   construction arguments in world.html / golf.html. */
/* v4.9: アセット版数トークン。firebase の assets 30日キャッシュに対し、版上げ時は
   この値と HTML 側の ?v= を差し替えることで全アセットを確実に入れ替える（単一の変更点）。 */
const ASSET_V = '4.11';
window.__GOAT_AV__ = ASSET_V;

import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// r128 color-pipeline parity: see boot-common-webgpu.js note.
THREE_NS.ColorManagement.enabled = false;

function inject(src) {
  const s = document.createElement('script');
  s.src = src + (src.indexOf('?') === -1 ? '?v=' : '&v=') + ASSET_V;
  s.onload = function () {
    // The game script was injected after parsing; if lifecycle events already
    // fired, re-dispatch so game listeners registered late are not lost.
    if (document.readyState === 'complete') {
      document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
      window.dispatchEvent(new Event('load'));
    } else if (document.readyState === 'interactive') {
      document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    }
  };
  document.body.appendChild(s);
}

/* Small on-screen badge so the player can see which backend is actually
   live (added for the WebGPU/WebGL comparison builds). World pages centre
   it (their top-left is occupied by the area panel); golf pages pin it to
   the top-left (their top-centre carries the hole banner). */
function engineLabel(backend) {
  if (backend === 'webgpu') return '描画: WebGPU';
  if (backend && backend.indexOf('explicit') >= 0) return '描画: WebGL（フォールバック）';
  if (backend && backend.indexOf('auto-fallback') >= 0) return '描画: WebGL（自動切替）';
  if (backend === 'webgl') return '描画: WebGL';
  return '描画: ' + backend;
}
function showEngineBadge(info, gameSrc) {
  try {
    var d = document.createElement('div');
    d.id = 'engineBadge';
    d.textContent = engineLabel(info.backend);
    var world = (gameSrc || '').indexOf('world') >= 0;
    d.style.cssText = 'position:fixed;top:6px;z-index:90;background:rgba(8,10,22,.72);color:#ffd875;border:1px solid rgba(255,216,117,.45);border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:2px 8px;pointer-events:none;font-family:sans-serif;' +
      (world ? 'left:50%;transform:translateX(-50%);' : 'left:8px;');
    (document.body || document.documentElement).appendChild(d);
  } catch (e) {}
}

export async function boot(opts) {
  const THREE = Object.assign({}, THREE_NS, { GLTFLoader: GLTFLoader });
  window.THREE = THREE;
  window.MeshoptDecoder = MeshoptDecoder;
  window.__GOAT_ENGINE__ = { variant: 'webgl-r180', backend: 'webgl', adapter: null, error: null };
  showEngineBadge(window.__GOAT_ENGINE__, opts.gameSrc);
  window.__GOAT_SHADER__ = function (name, desc) { return new THREE.ShaderMaterial(desc); };
  window.__GOAT_RENDERER__ = new THREE.WebGLRenderer(opts.params);
  console.log('[GOAT engine] variant=webgl-r180 backend=webgl');
  try { await Promise.race([MeshoptDecoder.ready, new Promise(function (r) { setTimeout(r, 3000); })]); } catch (e) {}
  inject(opts.gameSrc);
}
