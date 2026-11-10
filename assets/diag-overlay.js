/* GOAT 診断オーバーレイ（?diag=1 でのみ有効。通常プレイでは完全に無効）
   有効化条件: 自分自身の URL に diag=1 / localStorage goat_diag=1 / 親ページ URL に diag=1
   無効化: URL に diag=off、またはパネルの「OFF」ボタン（localStorage を消去）
   目的: 実機で「HQモデル適用のどこで落ちているか」をスクリーンショット1枚で確定させる。 */
(function () {
  'use strict';
  var qs = '';
  try { qs = location.search || ''; } catch (e) {}
  if (/[?&]diag=off/.test(qs)) { try { localStorage.removeItem('goat_diag'); } catch (e) {} return; }
  var on = /[?&]diag=1/.test(qs);
  if (!on) { try { on = localStorage.getItem('goat_diag') === '1'; } catch (e) {} }
  if (!on) { try { on = /[?&]diag=1/.test(window.parent.location.search || ''); } catch (e) {} }
  if (!on) return;
  try { localStorage.setItem('goat_diag', '1'); } catch (e) {}

  var T0 = Date.now();
  var pageKind = /world\.html/.test(location.pathname) ? 'world' : (/golf\.html/.test(location.pathname) ? 'golf' : 'shell');
  var decLog = [];        /* デコーダ状態遷移ログ */
  var errLog = [];        /* ページエラー / 未処理 rejection */
  var wasmTest = { state: 'pending', msg: '' };
  var glErrCount = 0, glLastErr = 0;
  function ts() { return ((Date.now() - T0) / 1000).toFixed(1) + 's'; }
  function logDec(s) { decLog.push(ts() + ' ' + s); if (decLog.length > 12) decLog.shift(); }
  window.addEventListener('error', function (e) { errLog.push('ERR ' + String(e.message || 'error').slice(0, 120)); if (errLog.length > 5) errLog.shift(); });
  window.addEventListener('unhandledrejection', function (e) { errLog.push('REJ ' + String((e.reason && (e.reason.message || e.reason)) || 'rejection').slice(0, 120)); if (errLog.length > 5) errLog.shift(); });

  /* --- WASM 自己テスト: このオリジン/ブラウザで WebAssembly のコンパイルが許可されているか --- */
  try {
    var bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
    var valid = (typeof WebAssembly !== 'undefined') && WebAssembly.validate(bytes);
    if (typeof WebAssembly === 'undefined') { wasmTest = { state: 'NO-API', msg: 'WebAssembly undefined' }; }
    else {
      WebAssembly.instantiate(bytes, {}).then(function () {
        wasmTest = { state: 'OK', msg: 'validate=' + valid };
      }, function (err) {
        wasmTest = { state: 'FAIL', msg: String((err && err.message) || err).slice(0, 300) };
      });
    }
  } catch (e) { wasmTest = { state: 'THROW', msg: String((e && e.message) || e).slice(0, 300) }; }

  /* --- デコーダ状態遷移の追跡（boot が window.MeshoptDecoder を代入した瞬間から） --- */
  var decSeen = false, decHooked = false;
  logDec('watch start (page=' + pageKind + ')');
  var decIv = setInterval(function () {
    var d = window.MeshoptDecoder;
    if (d && !decSeen) { decSeen = true; logDec('decoder object seen, supported=' + d.supported); }
    if (d && d.ready && !decHooked) {
      decHooked = true;
      try {
        d.ready.then(function () { logDec('decoder READY resolved'); }, function (err) { logDec('decoder READY REJECTED: ' + String((err && err.message) || err).slice(0, 220)); });
      } catch (e) { logDec('ready hook throw: ' + String(e).slice(0, 80)); }
    }
    if (decSeen && decHooked && decLog.length && /READY/.test(decLog[decLog.length - 1])) { /* keep polling cheaply anyway */ }
  }, 100);
  setTimeout(function () { clearInterval(decIv); }, 120000);

  /* --- パネル DOM --- */
  var panel = document.createElement('div');
  panel.id = 'goatDiagPanel';
  panel.style.cssText = 'position:fixed;top:6px;left:6px;right:6px;z-index:2147483000;background:rgba(2,6,14,.88);color:#cfe8ff;border:1px solid #d6a11e;border-radius:8px;padding:8px 10px;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-all;max-height:72vh;overflow-y:auto;-webkit-overflow-scrolling:touch;';
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;';
  var mkBtn = function (label) { var b = document.createElement('button'); b.textContent = label; b.style.cssText = 'background:#1c2f4a;color:#ffe9a8;border:1px solid #d6a11e;border-radius:6px;padding:4px 10px;font-size:12px;'; return b; };
  var btnCopy = mkBtn('📋 テキストをコピー');
  var btnOff = mkBtn('✕ diag OFF（閉じる）');
  btnRow.appendChild(btnCopy); btnRow.appendChild(btnOff);
  var body = document.createElement('div');
  panel.appendChild(btnRow); panel.appendChild(body);
  function mount() { if (document.body) { document.body.appendChild(panel); } else { setTimeout(mount, 100); } }
  mount();
  btnOff.addEventListener('click', function () { try { localStorage.removeItem('goat_diag'); } catch (e) {} if (panel.parentNode) panel.parentNode.removeChild(panel); });
  btnCopy.addEventListener('click', function () {
    var t = body.textContent || '';
    try { navigator.clipboard.writeText(t); btnCopy.textContent = '✅ コピーしました'; } catch (e) { btnCopy.textContent = 'コピー失敗（スクショでOK）'; }
    setTimeout(function () { btnCopy.textContent = '📋 テキストをコピー'; }, 2000);
  });

  function glProbe() {
    try {
      var cv = document.querySelector('canvas');
      if (!cv) return 'canvas: none yet';
      var gl = null;
      try { gl = cv.getContext('webgl2') || cv.getContext('webgl'); } catch (e) {}
      if (!gl) return 'canvas: ctx取得不可（別モードで作成済みの可能性）';
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var ren = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      var err = gl.getError(); /* 注意: getError は読み取りでフラグをクリアする（診断版のみの割り切り） */
      if (err !== 0) { glErrCount++; glLastErr = err; }
      return 'GL: ' + gl.getParameter(gl.VERSION) + '\nrenderer: ' + String(ren).slice(0, 90) + '\nMAX_TEXTURE_SIZE: ' + maxTex + ' / getError累計: ' + glErrCount + (glLastErr ? ' (last=0x' + glLastErr.toString(16) + ')' : '');
    } catch (e) { return 'GL probe err: ' + String(e).slice(0, 80); }
  }

  function hqLines() {
    var H = (pageKind === 'world') ? window.HQW : (pageKind === 'golf' ? window.HQG : null);
    if (!H) return ['HQ object: (shell page / 未生成)'];
    var out = [];
    var parts = H.parts ? Object.keys(H.parts) : [];
    out.push('HQ appliedHead: ' + (H._appliedHead || '(未適用)') + (H._appliedHeads ? ' / heads=' + JSON.stringify(H._appliedHeads) : ''));
    out.push('pBase: ' + H._pBase + ' pHead: ' + JSON.stringify(H._pHead || {}) + ' parts: ' + parts.length + ' pending: ' + ((H.pending || []).length));
    var d = H._diag || {};
    out.push('diag baseFails: ' + (d.baseFails || 0) + ' headFails: ' + JSON.stringify(d.headFails || {}) + ' decoderWaited: ' + !!d.decoderWaited);
    out.push('lastErr: ' + (d.lastErr || '(なし)'));
    /* 実行時テクスチャの実サイズ */
    var texKeys = H.tex ? Object.keys(H.tex) : [];
    var tl = [];
    for (var i = 0; i < texKeys.length && tl.length < 18; i++) {
      var k = texKeys[i], t = H.tex[k];
      var im = t && t.image;
      tl.push(k + ':' + (H._ready[k] ? 'OK' : '..') + (im ? (im.width || '?') + 'x' + (im.height || '?') : 'noimg'));
    }
    out.push('tex[' + texKeys.length + ']: ' + tl.join(' '));
    /* GLB 内蔵テクスチャ（アトラス）の実サイズ: 適用済みパーツのマテリアルから収集 */
    var seen = {}, maps = [];
    function walk(o, depth) {
      if (!o || depth > 4 || maps.length > 14) return;
      if (o.material) {
        var ms = Array.isArray(o.material) ? o.material : [o.material];
        for (var j = 0; j < ms.length; j++) {
          var m = ms[j];
          if (m && m.name && !seen[m.name]) {
            seen[m.name] = 1;
            if (m.map) { var im2 = m.map.image; maps.push(m.name + '.map=' + (im2 ? (im2.width || '?') + 'x' + (im2.height || '?') : 'noimg')); }
            else maps.push(m.name + '(nomap)');
          }
        }
      }
      var ch = o.children || [];
      for (var c = 0; c < ch.length; c++) walk(ch[c], depth + 1);
    }
    for (var p = 0; p < parts.length; p++) walk(H.parts[parts[p]], 0);
    out.push('GLB materials: ' + (maps.length ? maps.join(' ') : '(parts未着)'));
    return out;
  }

  function render() {
    var lines = [];
    lines.push('=== GOAT DIAG v4.16 (' + ts() + ') ===');
    lines.push('page: ' + pageKind + ' / host: ' + location.host + ' path: ' + location.pathname);
    lines.push('AV: ' + (window.__GOAT_AV__ || '?') + ' / engine badge: ' + (function () { try { var b = document.querySelector('[data-engine-badge]') || document.getElementById('engineBadge'); return b ? b.textContent : '(不明)'; } catch (e) { return '?'; } })());
    lines.push('UA: ' + navigator.userAgent.slice(0, 110));
    lines.push('WASM self-test: ' + wasmTest.state + ' ' + wasmTest.msg);
    lines.push('decoder log:');
    for (var i = 0; i < decLog.length; i++) lines.push('  ' + decLog[i]);
    lines.push('decoder now: ' + (window.MeshoptDecoder ? ('present supported=' + window.MeshoptDecoder.supported) : 'ABSENT'));
    lines.push.apply(lines, hqLines());
    lines.push(glProbe());
    if (errLog.length) { lines.push('page errors:'); for (var j = 0; j < errLog.length; j++) lines.push('  ' + errLog[j]); }
    body.textContent = lines.join('\n');
  }
  render();
  setInterval(render, 1500);
})();
