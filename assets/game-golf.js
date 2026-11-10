
/* ===== v4.3 HQアセット (読込失敗時は従来表示に自動フォールバック) ===== */
window.HQG = { parts:null, pending:[], tex:{}, _ready:{}, _waiters:{} };
/* v4.10 A2: 診断記録（記録のみ・挙動変更なし）。失敗は window.__GOAT_DIAG__ に集約し、
   最終エラーのみ保持する（履歴配列は作らない）。既存の __GOAT_ENGINE__ / __GOAT_AV__ とは別名。 */
window.__GOAT_DIAG__ = window.__GOAT_DIAG__ || {};
(function(D){
  D.ctx = D.ctx || { lost:false, checks:0, lastCheckAt:0 };
  D.golfLoop = D.golfLoop || { consecErrors:0, lastError:null, lastErrorAt:0 };
  D.worldAnimate = D.worldAnimate || { consecErrors:0, lastError:null, lastErrorAt:0 };
  D.hq = D.hq || {};
  D.hq.player = D.hq.player || { failed:false, error:null, detail:null, at:0 };
  D.hq.courseDress = D.hq.courseDress || { failed:false, error:null, detail:null, at:0 };
  D.hq.sky = D.hq.sky || { failed:false, error:null, detail:null, at:0 };
  D.ibl = D.ibl || { failed:false, error:null, detail:null, at:0 };
})(window.__GOAT_DIAG__);
window.__goatDiagFail = function(slot, detail, e){ try{ var D = window.__GOAT_DIAG__; if(!D) return; var s = (slot === "ibl") ? D.ibl : (D.hq && D.hq[slot]); if(!s) return; s.failed = true; s.detail = detail; s.error = (e && e.message) ? String(e.message).slice(0, 200) : String(e).slice(0, 200); s.at = Date.now(); }catch(_){} };
window.__goatDiagLoopErr = function(slot, e){ try{ var D = window.__GOAT_DIAG__; if(!D || !D[slot]) return; var s = D[slot]; s.consecErrors = (s.consecErrors || 0) + 1; s.lastError = (e && e.message) ? String(e.message).slice(0, 200) : String(e).slice(0, 200); s.lastErrorAt = Date.now(); }catch(_){} };
window.__goatDiagLoopOk = function(slot){ try{ var D = window.__GOAT_DIAG__; if(D && D[slot]) D[slot].consecErrors = 0; }catch(_){} };
(function(){
  var TL = new THREE.TextureLoader();
  /* v4.9: アセット版数（boot 層の __GOAT_AV__ と連動）。テクスチャ/GLB の URL に付与し、
     30日キャッシュ下でも版上げで確実に差し替わるようにする */
  var AVQ = '?v=' + (window.__GOAT_AV__ || '4.16');
  var __WARM = /[?&]warmup=1/.test(location.search); /* v4.5: 先読み時はテクスチャを読み込まない */
  function loadTex(name, srgb, rx, ry){
    if(__WARM) return null;
    var t = TL.load('assets/textures/' + name + '.png' + AVQ, function(){
      window.HQG._ready[name] = 1;
      var w = window.HQG._waiters[name] || []; window.HQG._waiters[name] = [];
      for(var i=0;i<w.length;i++){ try{ w[i](); }catch(e){} }
    }, undefined, function(){
      /* v4.9: テクスチャ読込失敗を無言で握らず最大2回まで再試行する */
      window.HQG._tf = window.HQG._tf || {};
      var f = (window.HQG._tf[name] || 0) + 1; window.HQG._tf[name] = f;
      if(f <= 2) setTimeout(function(){ loadTex(name, srgb, rx, ry); }, 1500);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if(rx) t.repeat.set(rx, ry || rx);
    if(srgb) t.colorSpace = THREE.SRGBColorSpace;
    window.HQG.tex[name] = t;
    return t;
  }
  window.HQG.whenTex = function(name, cb){
    if(window.HQG._ready[name]){ cb(); }
    else { (window.HQG._waiters[name] = window.HQG._waiters[name] || []).push(cb); }
  };
 loadTex('skin_map', 1); loadTex('skin_nrm'); loadTex('skin_rgh');
loadTex('head_map', 1); loadTex('head_nrm'); loadTex('eye', 1);
/* v4.9: キャラ別テクスチャ（v4.4で導入した6人分の顔/肌バリエーション）は、使うキャラの分だけを
対戦確定時に遅延ロードする。使わない5人分（デコード約40MiB/文書）の常駐を消すための変更で、
画質・見た目は不変。ロード完了までは従来どおり汎用マップで表示され、完了と同時に差し替わる。 */
window.HQG._charTex = {};
window.HQG.loadCharTex = function(k){
if(__WARM ||!k || window.HQG._charTex[k]) return;
window.HQG._charTex[k] = 1;
loadTex('head_' + k, 1); loadTex('skin_' + k, 1);
};
  loadTex('pants_map', 1); loadTex('pants_nrm'); loadTex('pants_rgh');
  loadTex('shirt_nrm'); loadTex('shirt_rgh');
  loadTex('ball_nrm');
  loadTex('grass_detail', 1); loadTex('grass_nrm'); loadTex('cloud', 1); loadTex('leaf_map', 1); loadTex('bark_map', 1); loadTex('sand_detail', 1); loadTex('sand_nrm'); loadTex('water_nrm');
 /* v4.9: GLB を「共通ベース＋キャラ別ヘッド」に分割し、使うキャラの分だけロードする。
パーツ名・マテリアル名・中身は従来の hero_golf.glb と同一（分割再収納のみ、画質不変）。
ベース読込の失敗時は最大3回まで再試行し（r180版修正の恒常化対策を継承）、
それでも失敗すれば HQ 適用自体を行わない（従来モデル表示のフォールバック維持）。
ヘッドの読込失敗時も再試行し、最終失敗時は汎用ヘッドで適用を進める。 */
window.HQG._pBase = false; window.HQG._pHead = {};
/* プレビュー堅牢化（world 側 HQW と同型）: ① MeshoptDecoder ready ゲート
② 再試行は打ち切らず createImageBitmap 無効経路と交互に試す
③ 適用ヘッド種別と失敗理由を _appliedHead / _diag に記録する */
window.HQG._diag = { baseFails: 0, headFails: {}, lastErr: '', decoderWaited: false};
window.HQG._noteErr = function(where, e){
try{ window.HQG._diag.lastErr = where + ': ' + String((e && e.message) || e || 'load error').slice(0, 140);}catch(_){}
};
window.HQG._decoderReady = function(cb){
var d = window.MeshoptDecoder;
if(!d || d.supported){ cb(); return;}
window.HQG._diag.decoderWaited = true;
var iv = setInterval(function(){
if(!window.MeshoptDecoder || window.MeshoptDecoder.supported){ clearInterval(iv); cb();}
}, 200);
};
var _bmDepthG = 0, _bmSavedG = null;
function _bmOffG(){ if(_bmDepthG === 0){ _bmSavedG = window.createImageBitmap; try{ window.createImageBitmap = undefined;}catch(e){}} _bmDepthG++;}
function _bmOnG(){ _bmDepthG--; if(_bmDepthG <= 0){ _bmDepthG = 0; try{ window.createImageBitmap = _bmSavedG;}catch(e){}}}
window.HQG._glbLoad = function(url, noBitmap, onOk, onFail){
window.HQG._decoderReady(function(){
try{
var loader = new THREE.GLTFLoader();
if(window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
if(noBitmap) _bmOffG();
loader.load(url, function(g){ if(noBitmap) _bmOnG(); onOk(g);}, undefined, function(err){ if(noBitmap) _bmOnG(); onFail(err);});
}catch(e){ if(noBitmap) _bmOnG(); onFail(e);}
});
};
window.HQG._flushPending = function(){
if(!window.HQG._pBase) return;
var pend = window.HQG.pending.splice(0);
for(var i=0;i<pend.length;i++){ try{ pend[i]();}catch(e){}}
};
window.HQG.readyFor = function(key){
if(!window.HQG._pBase ||!window.HQG.parts) return false;
if(!key || key === 'watu') return true;
var s = window.HQG._pHead[key];
/* 堅牢化: ヘッド未着のまま汎用ヘッドで適用を進めることはしない */
return s === 'ok';
};
function mergePartsG(gltf, minRoots){
var roots = 0;
gltf.scene.children.forEach(function(root){ if(root && root.name){ (window.HQG.parts = window.HQG.parts || {})[root.name] = root; roots++;}});
return roots >= minRoots;
}
window.HQG._baseFail = function(err){
window.HQG._fails = (window.HQG._fails || 0) + 1;
window.HQG._diag.baseFails = window.HQG._fails;
window.HQG._noteErr('base', err);
/* 堅牢化: 打ち切らず再試行し続ける（バックオフ上限10秒、偶数試行は ImageBitmap 無効経路） */
var delay = Math.min(2500 * Math.ceil(window.HQG._fails / 2), 10000);
setTimeout(function(){ window.HQG._loadBase();}, delay);
};
window.HQG._loadBase = function(){
var noBitmap = ((window.HQG._fails || 0) % 2) === 1;
window.HQG._glbLoad('assets/models/hero_golf_base.glb' + AVQ, noBitmap, function(gltf){
if(!mergePartsG(gltf, 10)){ window.HQG._baseFail(new Error('base roots < 10')); return;}
window.HQG._pBase = true;
window.HQG._flushPending();
}, function(err){ window.HQG._baseFail(err);});
};
window.HQG._loadHead = function(key){
var f = window.HQG._pHead[key + '_f'] || 0;
window.HQG._glbLoad('assets/models/hero_golf_head_' + key + '.glb' + AVQ, (f % 2) === 1, function(gltf){
mergePartsG(gltf, 1);
window.HQG._pHead[key] = 'ok';
window.HQG._flushPending();
}, function(err){
var nf = window.HQG._pHead[key + '_f'] = f + 1;
window.HQG._diag.headFails[key] = nf;
window.HQG._noteErr('head_' + key, err);
/* 堅牢化: 'err'（汎用ヘッドで進める）には落とさず、成功するまで再試行する */
var delay = Math.min(2500 * Math.ceil(nf / 2), 10000);
setTimeout(function(){ window.HQG._loadHead(key);}, delay);
});
};
window.HQG.loadParts = function(charKey){
try{
if(!window.HQG._baseStarted){ window.HQG._baseStarted = 1; window.HQG._loadBase();}
if(charKey && charKey!== 'watu' &&!window.HQG._pHead[charKey]){
window.HQG._pHead[charKey] = 'loading';
window.HQG._loadHead(charKey);
}
}catch(e){}
};
})();

;

"use strict";
// ================================================
// ⛳ GOLF MASTER 3D v5
//  ★ みんゴル式ゲームスケール放物線ボール物理
//  ★ なだらか地形（振幅&周波数大幅縮小）
//  ★ 2打目以降も常時残り距離表示
// ================================================

// ===== 天気 =====

// ═══════════════════════════════════════════════════════════════
// ★★★ Web Audio API プロ仕様ダイナミックサウンドエンジン ★★★
// 外部ファイル不要・超高速プロシージャル合成による極上の打感＆大歓声
// ═══════════════════════════════════════════════════════════════
class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = true;
  }

  ensureInit() {
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch(e) {
        console.warn("AudioContext init error:", e);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  /* 空間環境音：風のそよぎ＋鳥の声＋ボス戦の大観衆マーマー（Web Audio生成ループ） */
  startAmbient() {
    this.ensureInit();
    if (!this.ctx || this._amb) return;
    try {
      const ac = this.ctx;
      const master = ac.createGain(); master.gain.value = 0; master.connect(this.masterGain);
      master.gain.setTargetAtTime(0.13, ac.currentTime, 2.0);
      const len = ac.sampleRate * 2;
      const mkBuf = (coef, amp) => { const b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + coef * w) / (1 + coef); d[i] = last * amp; } return b; };
      const src = ac.createBufferSource(); src.buffer = mkBuf(0.02, 3.2); src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 0.55;
      const wg = ac.createGain(); wg.gain.value = 0.55;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.06; const lg = ac.createGain(); lg.gain.value = 200; lfo.connect(lg); lg.connect(bp.frequency);
      src.connect(bp); bp.connect(wg); wg.connect(master); src.start(); lfo.start();
      const csrc = ac.createBufferSource(); csrc.buffer = mkBuf(0.008, 2.4); csrc.loop = true;
      const cbp = ac.createBiquadFilter(); cbp.type = "bandpass"; cbp.frequency.value = 900; cbp.Q.value = 0.4;
      const cg = ac.createGain(); cg.gain.value = 0;
      csrc.connect(cbp); cbp.connect(cg); cg.connect(master); csrc.start();
      this._amb = { master: master, crowdGain: cg };
      const birds = () => { setTimeout(() => { if (this.ctx && this.enabled && !this._crowdOn) { const f = 2000 + Math.random() * 800; try { const t = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.3, t + 0.09); gn.gain.setValueAtTime(0.014, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(gn); gn.connect(this.masterGain); o.start(t); o.stop(t + 0.12); } catch(e){} } birds(); }, 4200 + Math.random() * 7000); };
      birds();
    } catch(e) {}
  }
  setCrowd(on) {
    this._crowdOn = !!on;
    if (this._amb && this.ctx) this._amb.crowdGain.gain.setTargetAtTime(on ? 0.5 : 0.0, this.ctx.currentTime, 1.2);
  }

  // ① インパクト音（ドライバー・アイアン・ウェッジ・パター）
  playImpact(clubType = "driver", power = 1.0, isPerfect = false) {
    this.ensureInit();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const isDriver = clubType === "driver" || clubType === "wood";
    const isPutter = clubType === "putter";
    const isWedge = clubType === "wedge";

    if (isPutter) {
      // パター：静寂に響く「コツン…」
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
      gain.gain.setValueAtTime(0.4 * power, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.08);
      return;
    }

    if (isDriver) {
      // ドライバー：金属製チタンヘッドの重低音サブベース＋「キィイインッ！」
      // 1. 低音インパクトパンチ
      const oscLow = this.ctx.createOscillator();
      const gainLow = this.ctx.createGain();
      oscLow.type = "sine";
      oscLow.frequency.setValueAtTime(isPerfect ? 380 : 280, t);
      oscLow.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      gainLow.gain.setValueAtTime(isPerfect ? 0.9 : 0.7, t);
      gainLow.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      oscLow.connect(gainLow);
      gainLow.connect(this.masterGain);
      oscLow.start(t);
      oscLow.stop(t + 0.18);

      // 2. 金属高音チャープ（チタンの乾いた高周波）
      const oscHi = this.ctx.createOscillator();
      const gainHi = this.ctx.createGain();
      oscHi.type = "triangle";
      oscHi.frequency.setValueAtTime(isPerfect ? 3200 : 2400, t);
      oscHi.frequency.exponentialRampToValueAtTime(800, t + 0.12);
      gainHi.gain.setValueAtTime(isPerfect ? 0.6 : 0.45, t);
      gainHi.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      oscHi.connect(gainHi);
      gainHi.connect(this.masterGain);
      oscHi.start(t);
      oscHi.stop(t + 0.12);

      // 3. インパクトホワイトノイズバースト
      this._playNoiseBurst(t, 0.06, 3500, isPerfect ? 0.5 : 0.35);
    } else {
      // アイアン / ウェッジ：乾いた「パシッ！」「スパンッ！」
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(isWedge ? 750 : 620, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);
      gain.gain.setValueAtTime(isPerfect ? 0.75 : 0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.12);

      this._playNoiseBurst(t, 0.045, isWedge ? 4800 : 3800, isPerfect ? 0.5 : 0.38);
    }
  }

  // ② 着弾音（芝・砂・水）
  playLanded(surf = "fairway") {
    this.ensureInit();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;

    if (surf === "bunker") {
      // バンカー：砂を弾く「ザザッ！」
      this._playNoiseBurst(t, 0.16, 1600, 0.55, "bandpass");
    } else if (surf === "water") {
      // ウォーターハザード：水没「ボチャンッ！」
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(480, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.25);
      gain.gain.setValueAtTime(0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
      this._playNoiseBurst(t + 0.02, 0.22, 2200, 0.45);
    } else {
      // 芝生（FW/ラフ/グリーン）：「トスッ…」
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.09);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.09);
      this._playNoiseBurst(t, 0.05, 1200, 0.25);
    }
  }

  // ③ カップイン音（カラン…コロンッ！）
  playCupIn() {
    this.ensureInit();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // 1打目：金属カップに当たる高音「カランッ」
    [1920, 2450].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + i * 0.06 + 0.18);
      gain.gain.setValueAtTime(0.5, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.18);
    });
    // 2打目：底で跳ねる「コロンッ」
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1450, t + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(950, t + 0.32);
    gain2.gain.setValueAtTime(0.45, t + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t + 0.14);
    osc2.stop(t + 0.32);
  }

  // ④ ギャラリー歓声＆拍手（Crowd Audio）
  playCrowd(type = "cheer") {
    this.ensureInit();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const dur = type === "roar" ? 2.8 : type === "cheer" ? 2.0 : 1.4;

    // 歓声（ピンクノイズ風フィルタリング）
    const bufSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.3;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(750, t);
    filter.frequency.linearRampToValueAtTime(950, t + dur * 0.3);
    filter.frequency.linearRampToValueAtTime(600, t + dur);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(type === "roar" ? 0.75 : 0.5, t + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + dur);
  }

  // ⑤ ゾーン集中・心拍音（ドクン…ドクン…）
  playHeartbeat() {
    this.ensureInit();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    [0, 0.14].forEach((delay, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(idx === 0 ? 65 : 52, t + delay);
      osc.frequency.exponentialRampToValueAtTime(28, t + delay + 0.12);
      gain.gain.setValueAtTime(0.65, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + delay);
      osc.stop(t + delay + 0.12);
    });
  }

  // 内部ユーティリティ：ノイズバースト
  _playNoiseBurst(time, duration, filterFreq, volume = 0.3, filterType = "lowpass") {
    const bufSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
    noise.stop(time + duration);
  }
}

// ═══════════════════════════════════════════════════════════════
// ★★★ FXManager：物理パーティクル＆サーフェス着弾スプラッシュ ★★★
// ═══════════════════════════════════════════════════════════════
class FXManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.rings = [];
  }

  // ① インパクトスパーク（パーフェクトショット時の輝き）
  createImpactSparks(pos) {
    if (!this.scene || !pos) return;
    const count = 16;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y + 0.1;
      positions[i * 3 + 2] = pos.z;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 5.0;
      velocities.push(new THREE.Vector3(
        Math.cos(angle) * speed,
        1.5 + Math.random() * 4.0,
        Math.sin(angle) * speed
      ));
    }
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffea44,
      size: 0.18,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });
    const pSystem = new THREE.Points(geom, mat);
    this.scene.add(pSystem);
    this.particles.push({ mesh: pSystem, vels: velocities, life: 1.0, decay: 2.2 });
  }

  // ② 着弾ディボット＆スプラッシュ（芝・砂・水）
  createDivot(pos, surf = "fairway") {
    if (!this.scene || !pos) return;

    if (surf === "water") {
      // 水面波紋リング
      const ringGeo = new THREE.RingGeometry(0.2, 0.4, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x99ddff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, pos.y + 0.05, pos.z);
      this.scene.add(ring);
      this.rings.push({ mesh: ring, scale: 1.0, opacity: 0.85 });
      return;
    }

    const count = surf === "bunker" ? 22 : 14;
    const col = surf === "bunker" ? 0xedd092 : surf === "rough" ? 0x226618 : 0x44cc28;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y + 0.05;
      positions[i * 3 + 2] = pos.z;
      const angle = Math.random() * Math.PI * 2;
      const speed = surf === "bunker" ? (1.5 + Math.random() * 3.5) : (2.0 + Math.random() * 4.0);
      velocities.push(new THREE.Vector3(
        Math.cos(angle) * speed,
        2.0 + Math.random() * (surf === "bunker" ? 4.5 : 3.5),
        Math.sin(angle) * speed
      ));
    }
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: col,
      size: surf === "bunker" ? 0.22 : 0.16,
      transparent: true,
      opacity: 0.95
    });
    const pSystem = new THREE.Points(geom, mat);
    this.scene.add(pSystem);
    this.particles.push({ mesh: pSystem, vels: velocities, life: 1.0, decay: surf === "bunker" ? 1.6 : 2.0 });
  }

  // ③ フルスクリーン・ブルームフラッシュ演出
  triggerScreenFlash() {
    const el = document.getElementById("fxFlashOverlay");
    if (!el) return;
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 120);
  }

  // ④ PGA Tour Broadcast テロップ表示
  showBroadcastBanner(title, text = "") {
    const banner = document.getElementById("pgaBroadcastBanner");
    const txt = document.getElementById("pgaBannerText");
    if (!banner || !txt) return;
    txt.textContent = text ? `${title} - ${text}` : title;
    banner.classList.add("show");
    setTimeout(() => banner.classList.remove("show"), 2600);
  }

  // ⑤ 毎フレームの物理更新
  update(dt) {
    // パーティクル更新
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.material.opacity = Math.max(0, p.life);
      const posAttr = p.mesh.geometry.attributes.position;
      for (let j = 0; j < p.vels.length; j++) {
        p.vels[j].y -= 9.8 * dt; // 重力
        posAttr.setX(j, posAttr.getX(j) + p.vels[j].x * dt);
        posAttr.setY(j, Math.max(0, posAttr.getY(j) + p.vels[j].y * dt));
        posAttr.setZ(j, posAttr.getZ(j) + p.vels[j].z * dt);
      }
      posAttr.needsUpdate = true;
    }

    // 波紋リング更新
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.scale += 3.5 * dt;
      r.opacity -= 1.1 * dt;
      if (r.opacity <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      r.mesh.scale.set(r.scale, r.scale, r.scale);
      r.mesh.material.opacity = Math.max(0, r.opacity);
    }
  }
}

class Weather{
  constructor(type="sunny"){
    this.type=type;this.windDirection=Math.random()*360;
    this.windStrength=0;this.rainIntensity=0;this.temperature=20;
    this.gustTimer=0;this.gustOffset=0;
    switch(type){
      case"sunny":this.windStrength=Math.random()*5+0.5;this.temperature=22;break;
      case"rain":this.windStrength=Math.random()*7+3;this.rainIntensity=15;this.temperature=13;break;
      case"strongWind":this.windStrength=Math.random()*10+8;this.temperature=17;break;
      case"fog":this.windStrength=Math.random()*2;this.temperature=9;break;
    }
    this.windVec=new THREE.Vector3(Math.sin(this.windDirection*Math.PI/180),0,Math.cos(this.windDirection*Math.PI/180)).multiplyScalar(this.windStrength);
  }
  update(dt){
    this.gustTimer+=dt;
    if(this.gustTimer>2.5+Math.random()*3){this.gustOffset=(Math.random()-0.5)*0.3*this.windStrength;this.gustTimer=0;}
    const eff=this.windStrength+this.gustOffset;
    const r=this.windDirection*Math.PI/180;
    this.windVec.set(Math.sin(r)*eff,0,Math.cos(r)*eff);
  }
  get distMult(){return 1+((this.temperature-15)*0.002);}
  get label(){return{sunny:"☀️ 晴れ",rain:"🌧️ 雨",strongWind:"💨 強風",fog:"🌫️ 霧"}[this.type]||"☀️";}
}

// ===== キャラクター =====
class Character{
  constructor(d){
    Object.assign(this,d);
    const m={"最高に安定":0.7,"安定":2.2,"不安定":5.0};
    this.ironVar=m[d.ironStability]||2.2;this.apprVar=m[d.approachStability]||2.2;this.puttVar=m[d.putterStability]||1.2;
    this.driverMult=d.driverSpeed/80;
  }
  varianceFor(t){if(t==="putter")return this.puttVar;if(t==="approach")return this.apprVar;return this.ironVar;}
}
const CHARACTERS=[
  {name:"Watu",   realName:"ゴルフの神",    emoji:"🌟",nationality:"JPN",
   driverSpeed:75,ironStability:"不安定",approachStability:"不安定",putterStability:"安定",
   skinColor:0xeab98e,shirtColor:0x1144cc,pantsColor:0x222244,hatColor:0x111133,
   desc:"謎の天才ゴルファー"},
  {name:"Matuya", realName:"マスターズ覇者・東洋の翠竜",       emoji:"🇯🇵",nationality:"JPN",
   driverSpeed:80,ironStability:"最高に安定",approachStability:"最高に安定",putterStability:"安定",
   skinColor:0xe8b184,shirtColor:0xffffff,pantsColor:0x111111,hatColor:0x222222,
   desc:"マスターズ覇者・日本の誇り"},
  {name:"TIiger", realName:"サンデーレッドの絶対王者",emoji:"🐯",nationality:"USA",
   driverSpeed:85,ironStability:"最高に安定",approachStability:"最高に安定",putterStability:"最高に安定",
   skinColor:0x8d5b36,shirtColor:0xcc0000,pantsColor:0x111111,hatColor:0x222222,
   desc:"最強レジェンド 14メジャー制覇"},
  {name:"Junbo",  realName:"九十四勝・地の帝王",   emoji:"👑",nationality:"JPN",
   driverSpeed:82,ironStability:"安定",approachStability:"安定",putterStability:"安定",
   skinColor:0xe0a878,shirtColor:0x0055aa,pantsColor:0x334455,hatColor:0x112233,
   desc:"国内94勝・プロゴルフの帝王"},
  {name:"McIlro", realName:"北の貴公子・蒼穹のドライブ",emoji:"🍀",nationality:"IRL",
   driverSpeed:90,ironStability:"安定",approachStability:"安定",putterStability:"不安定",
   skinColor:0xf2c8a2,shirtColor:0x003399,pantsColor:0xffffff,hatColor:0x001166,
   desc:"世界最長飛距離 4メジャー覇者"},
  {name:"DeCham", realName:"科学の探究者・物理の飛ばし屋",emoji:"💪",nationality:"USA",
   driverSpeed:95,ironStability:"安定",approachStability:"不安定",putterStability:"安定",
   skinColor:0xe2aa7c,shirtColor:0xff6600,pantsColor:0x222222,hatColor:0x333333,
   desc:"科学の申し子 超飛距離ゴルファー"},
];

// ===== クラブ定義：2モード =====
// 通常モード（DR最大350yd）
const CLUBS_NORMAL=[
  {id:"DR",  name:"DR",   maxDist:350,loft:10,type:"driver",  runFactor:0.18,peakRatio:0.13},
  {id:"MiDR",name:"MiDR", maxDist:320,loft:12,type:"driver",  runFactor:0.15,peakRatio:0.14},
  {id:"3W",  name:"3W",   maxDist:250,loft:15,type:"wood",    runFactor:0.13,peakRatio:0.15},
  {id:"5W",  name:"5W",   maxDist:230,loft:18,type:"wood",    runFactor:0.11,peakRatio:0.16},
  {id:"7W",  name:"7W",   maxDist:215,loft:21,type:"wood",    runFactor:0.10,peakRatio:0.17},
  {id:"3I",  name:"3I",   maxDist:205,loft:21,type:"iron",    runFactor:0.09,peakRatio:0.17},
  {id:"4I",  name:"4I",   maxDist:190,loft:24,type:"iron",    runFactor:0.08,peakRatio:0.18},
  {id:"5I",  name:"5I",   maxDist:180,loft:27,type:"iron",    runFactor:0.07,peakRatio:0.19},
  {id:"6I",  name:"6I",   maxDist:165,loft:30,type:"iron",    runFactor:0.06,peakRatio:0.20},
  {id:"7I",  name:"7I",   maxDist:150,loft:34,type:"iron",    runFactor:0.05,peakRatio:0.21},
  {id:"8I",  name:"8I",   maxDist:140,loft:38,type:"iron",    runFactor:0.04,peakRatio:0.22},
  {id:"9I",  name:"9I",   maxDist:125,loft:42,type:"approach",runFactor:0.03,peakRatio:0.23},
  {id:"PW",  name:"PW",   maxDist:110,loft:46,type:"approach",runFactor:0.02,peakRatio:0.24},
  {id:"AW",  name:"AW52°",maxDist:90, loft:52,type:"approach",runFactor:0.01,peakRatio:0.26},
  {id:"SW",  name:"SW58°",maxDist:75, loft:58,type:"approach",runFactor:0.008,peakRatio:0.28},
  {id:"LW",  name:"LW62°",maxDist:60, loft:62,type:"approach",runFactor:0.005,peakRatio:0.30},
  {id:"PT",  name:"Putt", maxDist:30, loft:4, type:"putter",  runFactor:1.0, peakRatio:0.01},
];
// 超人モード（DR最大500yd）
const CLUBS_SUPER=[
  {id:"DR",  name:"DR",   maxDist:500,loft:10,type:"driver",  runFactor:0.18,peakRatio:0.13},
  {id:"MiDR",name:"MiDR", maxDist:460,loft:12,type:"driver",  runFactor:0.15,peakRatio:0.14},
  {id:"3W",  name:"3W",   maxDist:360,loft:15,type:"wood",    runFactor:0.13,peakRatio:0.15},
  {id:"5W",  name:"5W",   maxDist:330,loft:18,type:"wood",    runFactor:0.11,peakRatio:0.16},
  {id:"7W",  name:"7W",   maxDist:310,loft:21,type:"wood",    runFactor:0.10,peakRatio:0.17},
  {id:"3I",  name:"3I",   maxDist:295,loft:21,type:"iron",    runFactor:0.09,peakRatio:0.17},
  {id:"4I",  name:"4I",   maxDist:275,loft:24,type:"iron",    runFactor:0.08,peakRatio:0.18},
  {id:"5I",  name:"5I",   maxDist:260,loft:27,type:"iron",    runFactor:0.07,peakRatio:0.19},
  {id:"6I",  name:"6I",   maxDist:240,loft:30,type:"iron",    runFactor:0.06,peakRatio:0.20},
  {id:"7I",  name:"7I",   maxDist:220,loft:34,type:"iron",    runFactor:0.05,peakRatio:0.21},
  {id:"8I",  name:"8I",   maxDist:200,loft:38,type:"iron",    runFactor:0.04,peakRatio:0.22},
  {id:"9I",  name:"9I",   maxDist:180,loft:42,type:"approach",runFactor:0.03,peakRatio:0.23},
  {id:"PW",  name:"PW",   maxDist:160,loft:46,type:"approach",runFactor:0.02,peakRatio:0.24},
  {id:"AW",  name:"AW52°",maxDist:135,loft:52,type:"approach",runFactor:0.01,peakRatio:0.26},
  {id:"SW",  name:"SW58°",maxDist:110,loft:58,type:"approach",runFactor:0.008,peakRatio:0.28},
  {id:"LW",  name:"LW62°",maxDist:85, loft:62,type:"approach",runFactor:0.005,peakRatio:0.30},
  {id:"PT",  name:"Putt", maxDist:30, loft:4, type:"putter",  runFactor:1.0, peakRatio:0.01},
];
// ゲーム中に有効なCLUBS（game.start()で切り替える）
let CLUBS=CLUBS_NORMAL;

// 飛距離クラス（v4.16）: 基準は通常モード・素のクラブ定義 CLUBS_NORMAL の DR maxDist = 350y。
// 倍率 = 目標ヤード ÷ 350。GOD = 現状（×1.0）。全クラブに同じ倍率をかけ、
// ギア補正（_getGoatDistMult）は、その土台に今までどおり乗る。
const DIST_CLASS_BASE_YD=350;
const DIST_CLASS_MULT={ amateur:200/350, top_pro:250/350, tour_pro:300/350, dracon:1.0 };

const COURSES=[
  {id:"toda",name:"戸田パブリック",flag:"🇯🇵",desc:"荒川河川敷 18H(9H×2WAY) Par72",color:0x698B22,
   terrainProfile:"flat_river", greenSpeed:11.0, roughType:"korai",
   isToda2Way:true,
   holes:[
    // 【OUTコース】フロント9 (1〜9番)
    {n:1,  physHole:1, isIN:false, par:5,yards:511, dogleg:"", feat:"ob_left|penalty_right|center_tree",
     name:"Hole 1", drakon:true,
     tee:{x:0, y:0.36, z:0}, pin:{x:-5, y:1.8, z:-511}, subPin:{x:6, y:1.8, z:-511},
     desc:"【ドラコン推奨】ストレートなロングホール。左全長OB、右1ペナ。230yd地点のFWセンター木がIP点。",
     alert:"⚠️ 左OB注意 / 230yd中央ツリー狙い"},

    {n:2,  physHole:2, isIN:false, par:3,yards:178, dogleg:"", feat:"water_right|ob_left|elevated_green",
     name:"Hole 2", nearpin:true,
     tee:{x:0, y:0.36, z:0}, pin:{x:-5, y:1.8, z:-178}, subPin:{x:6, y:1.8, z:-198},
     desc:"【ニアピン推奨】ストレートなショート。左浅いOB、右グリーン周辺に池。左手前からのアプローチが定石。",
     alert:"💧 右サイドに池ハザード / 左OB警戒"},

    {n:3,  physHole:3, isIN:false, par:4,yards:324, dogleg:"", feat:"alison_bunker|river_left|narrow_creek",
     name:"Hole 3",
     tee:{x:0, y:0.36, z:0}, pin:{x:-5, y:1.8, z:-324}, subPin:{x:5, y:1.8, z:-315},
     desc:"ストレートミドル。左川の浅いOB、右細川と高林。砲台グリーン手前にアゴの高いアリソン風ガードバンカー。",
     alert:"🏖️ グリーン手前 アゴ高アリソンバンカー"},

    {n:4,  physHole:4, isIN:false, par:4,yards:373, dogleg:"slight_right", feat:"center_symbol_tree|drop_slope_green|water_right",
     name:"Hole 4",
     tee:{x:0, y:0.36, z:0}, pin:{x:-5, y:1.8, z:-373}, subPin:{x:5, y:1.8, z:-338},
     desc:"やや右ドッグレッグ。FW中央にシンボルツリー。砲台グリーン奥は急な下り傾斜でこぼれは致命的。",
     alert:"⚠️ グリーン奥は急激な滑落スロープ！手前から"},

    {n:5,  physHole:5, isIN:false, par:5,yards:515, dogleg:"right", feat:"river_ob_left|dense_trees_right",
     name:"Hole 5", drakon:true,
     tee:{x:0, y:0.36, z:0}, pin:{x:7, y:1.8, z:-515}, subPin:{x:-6, y:1.8, z:-518},
     desc:"【ドラコン推奨】左側面すべてが荒川で右ドッグレッグ。2打目以降左は超強烈に浅いOB！右ショートカットは高林が阻む。",
     alert:"🚨 左全域が荒川・超危険OB！右林を避けFWキープ"},

    {n:6,  physHole:6, isIN:false, par:4,yards:353, dogleg:"", feat:"cross_water_240|elevated_green|river_left",
     name:"Hole 6",
     tee:{x:0, y:0.36, z:0}, pin:{x:-5, y:1.8, z:-353}, subPin:{x:6, y:1.8, z:-346},
     desc:"ストレート。240ヤード地点に池。ドライバーで打つと池に入るため、クラブ選択（レイアップ）を強要する戦略的ホール。",
     alert:"🌊 240yd地点に池！ドライバー危険・レイアップ推奨"},

    {n:7,  physHole:7, isIN:false, par:4,yards:311, dogleg:"", feat:"tight_ob_left|bush_pressure",
     name:"Hole 7",
     tee:{x:0, y:0.36, z:0}, pin:{x:-4, y:1.8, z:-311}, subPin:{x:5, y:1.8, z:-337},
     desc:"距離の短いパー4。左サイドに極端に近いOBラインと深いブッシュ。視覚的プレッシャーを克服してバーディを狙う。",
     alert:"⚠️ 左OBライン極近！右サイド狙い安全策"},

    {n:8,  physHole:8, isIN:false, par:4,yards:354, dogleg:"sharp_left", feat:"right_angle_dogleg|corner_forest|local_rule_shortcut_ban",
     name:"Hole 8",
     tee:{x:0, y:0.36, z:0}, pin:{x:-42, y:1.8, z:-260}, subPin:{x:-36, y:1.8, z:-270},
     desc:"直角の左ドッグレッグ。200ヤード地点左にコーナーを塞ぐ林。直接グリーン狙いはローカルルールで禁止。コーナー刻み必須。",
     alert:"🚫 直角左ドッグレッグ！ローカルルール：ショートカット禁止"},

    {n:9,  physHole:9, isIN:false, par:3,yards:188, dogleg:"", feat:"fortress_green|deep_surround_bunkers|high_spin_required",
     name:"Hole 9", nearpin:true,
     tee:{x:0, y:0.36, z:0}, pin:{x:-6, y:2.0, z:-188}, subPin:{x:6, y:2.0, z:-170},
     desc:"【ニアピン推奨】完全な要塞型砲台グリーン。全周を深いガードバンカーが囲む。キャリーで落としスピンで止めないとバンカー滑落。",
     alert:"🏰 要塞型砲台グリーン！全周バンカー・スピン必須"},

    // 【INコース】バック9 (10〜18番) ※物理9ホールを別ティー・別グリーンで使用
    {n:10, physHole:1, isIN:true,  par:5,yards:535, dogleg:"", feat:"ob_left|penalty_right|center_tree",
     name:"Hole 10", drakon:true,
     tee:{x:5, y:0.36, z:24}, pin:{x:6, y:1.8, z:-511}, subPin:{x:-5, y:1.8, z:-511},
     desc:"【ドラコン推奨】Hole 1の別ティー・別グリーン(OUTより24y延長)。右奥グリーンへ。230ydセンターツリーが目印。",
     alert:"⚠️ OUTより+24yd / 右奥グリーン狙い"},

    {n:11, physHole:2, isIN:true,  par:3,yards:198, dogleg:"", feat:"water_right|ob_left|elevated_green",
     name:"Hole 11", nearpin:true,
     tee:{x:3, y:0.36, z:20}, pin:{x:6, y:1.8, z:-198}, subPin:{x:-5, y:1.8, z:-178},
     desc:"【ニアピン推奨】Hole 2の別ティー・別グリーン(OUTより20y延長)。最奥の右グリーンへ。池のプレッシャーが増す。",
     alert:"💧 198yd最長ショート / 右池プレッシャー"},

    {n:12, physHole:3, isIN:true,  par:4,yards:315, dogleg:"", feat:"alison_bunker|river_left",
     name:"Hole 12",
     tee:{x:4, y:0.36, z:-9}, pin:{x:5, y:1.8, z:-324}, subPin:{x:-5, y:1.8, z:-324},
     desc:"Hole 3の別ティー・別グリーン(OUTより9y短縮)。右側グリーンへ。手前のアリソンバンカーを確実に避ける。",
     alert:"🏖️ 右グリーン狙い / アリソンバンカー警戒"},

    {n:13, physHole:4, isIN:true,  par:4,yards:338, dogleg:"slight_right", feat:"center_symbol_tree|drop_slope_green",
     name:"Hole 13",
     tee:{x:6, y:0.36, z:-35}, pin:{x:5, y:1.8, z:-373}, subPin:{x:-5, y:1.8, z:-373},
     desc:"Hole 4の別ティー・別グリーン(OUTより35y短縮)。短縮された分攻めやすいが、奥の急傾斜こぼれは依然危険。",
     alert:"⚠️ 338ydミドル / グリーン奥の滑落に注意"},

    {n:14, physHole:5, isIN:true,  par:5,yards:518, dogleg:"right", feat:"river_ob_left|dense_trees_right",
     name:"Hole 14", drakon:true,
     tee:{x:-3, y:0.36, z:3}, pin:{x:-6, y:1.8, z:-515}, subPin:{x:7, y:1.8, z:-515},
     desc:"【ドラコン推奨】Hole 5の別ティー・別グリーン(OUTより3y延長)。左手前グリーンを狙う。左荒川OBの脅威。",
     alert:"🚨 左全域荒川OB！右ドッグレッグを丁寧に進める"},

    {n:15, physHole:6, isIN:true,  par:4,yards:346, dogleg:"", feat:"cross_water_240|elevated_green",
     name:"Hole 15",
     tee:{x:4, y:0.36, z:-7}, pin:{x:6, y:1.8, z:-353}, subPin:{x:-5, y:1.8, z:-353},
     desc:"Hole 6の別ティー・別グリーン(OUTより7y短縮)。池までの距離を計算したレイアップでセカンド勝負。",
     alert:"🌊 240yd池ハザード！ティーショットは番手を落とす"},

    {n:16, physHole:7, isIN:true,  par:4,yards:337, dogleg:"", feat:"tight_ob_left|bush_pressure",
     name:"Hole 16",
     tee:{x:0, y:0.36, z:26}, pin:{x:5, y:1.8, z:-311}, subPin:{x:-4, y:1.8, z:-311},
     desc:"Hole 7の別ティー・別グリーン(OUTより26y延長)。右グリーンへ。左浅OBの重圧に負けずフェアウェイ中央へ。",
     alert:"⚠️ 左浅OB！落ち着いてフェアウェイキープ"},

    {n:17, physHole:8, isIN:true,  par:4,yards:373, dogleg:"sharp_left", feat:"right_angle_dogleg|corner_forest|local_rule_shortcut_ban",
     name:"Hole 17",
     tee:{x:6, y:0.36, z:19}, pin:{x:-36, y:1.8, z:-270}, subPin:{x:-42, y:1.8, z:-260},
     desc:"Hole 8の別ティー・別グリーン(OUTより19y延長)。直角左ドッグレッグ。コーナーへ正確に200yd刻む。",
     alert:"🚫 直角ドッグレッグ・ショートカット禁止！刻み必須"},

    {n:18, physHole:9, isIN:true,  par:3,yards:170, dogleg:"", feat:"fortress_green|deep_surround_bunkers|high_spin_required",
     name:"Hole 18", nearpin:true,
     tee:{x:5, y:0.36, z:-18}, pin:{x:6, y:2.0, z:-170}, subPin:{x:-6, y:2.0, z:-188},
     desc:"【ニアピン推奨】感動のフィニッシュホール！要塞砲台グリーン手前側(170yd)。全周バンカーを越えて1オンなるか。",
     alert:"🏰 最終18番！要塞砲台グリーン＆360度バンカー"}
  ]},
  // ─────────────────────────────────────────────
  // Augusta National Golf Club  Par72 7,435yd
  // マスターズが開催される世界最高峰コース
  // ─────────────────────────────────────────────
  {id:"augusta",name:"Augusta National",flag:"🇺🇸",desc:"マスターズ 7,435yd Par72",color:0x1a6b1a,
   terrainProfile:"hilly", greenSpeed:13.5, roughType:"light",
   holes:[
    {n:1, name:"Tea Olive",    par:4,yards:445, dogleg:"right", feat:"rightDogleg|bunker2", elev:"uphill",
     desc:"右ドッグレッグ。フェアウェイ右バンカー2基。グリーン右手前と奥にバンカー。"},
    {n:2, name:"Pink Dogwood", par:5,yards:575, dogleg:"left",  feat:"leftDogleg|bunker2|water_right", elev:"uphill",
     desc:"左ドッグレッグのロング。セカンドで右の池を意識。ガーデンホールの別名。"},
    {n:3, name:"Flowering Peach",par:4,yards:350,dogleg:"",    feat:"bunker2", elev:"downhill",
     desc:"最短ミドル。グリーン正面にバンカー2基。スコアメイクの好機。"},
    {n:4, name:"Flowering Crab Apple",par:3,yards:240,dogleg:"",feat:"bunker3",elev:"uphill",
     desc:"最長ショート。グリーン左右と手前にバンカー3基。風の読みが命。"},
    {n:5, name:"Magnolia",     par:4,yards:495, dogleg:"right", feat:"rightDogleg|bunker2|ob_left",elev:"uphill",
     desc:"距離のあるミドル。右ドッグレッグ。左OBライン。2打目が難しい。"},
    {n:6, name:"Juniper",      par:3,yards:180, dogleg:"",      feat:"bunker3",elev:"downhill",
     desc:"下り傾斜のショート。グリーン周辺に3バンカー。風向きで番手が変わる。"},
    {n:7, name:"Pampas",       par:4,yards:450, dogleg:"",      feat:"bunker5",elev:"uphill",
     desc:"グリーン手前に5基のバンカー群。Eisenhower Treeがかつてのランドマーク。"},
    {n:8, name:"Yellow Jasmine",par:5,yards:570,dogleg:"right", feat:"rightDogleg|bunker2",elev:"uphill",
     desc:"2オン可能なロング。右ドッグレッグ。グリーン左の深いバンカーに要注意。"},
    {n:9, name:"Carolina Cherry",par:4,yards:460,dogleg:"right",feat:"rightDogleg|bunker2",elev:"downhill",
     desc:"右ドッグレッグ下り。2打目は強い右からの傾斜を読んでグリーンを狙う。"},
    {n:10,name:"Camellia",     par:4,yards:495, dogleg:"left",  feat:"leftDogleg|bunker2",elev:"downhill",
     desc:"Amen Cornerへの導入。急激な下り左ドッグレッグ。スコアに差がつく難ホール。"},
    {n:11,name:"White Dogwood", par:4,yards:520, dogleg:"",     feat:"water_left|bunker1",elev:"downhill",
     desc:"Amen Corner第1番。左の池が2打目にプレッシャーをかける。グリーン左奥は水。"},
    {n:12,name:"Golden Bell",   par:3,yards:155, dogleg:"",     feat:"water_front|bunker2",elev:"flat",
     desc:"世界で最も有名なショートホール。Rae's Creekが前方を横切る。風が命。"},
    {n:13,name:"Azalea",       par:5,yards:545, dogleg:"left",  feat:"leftDogleg|water_left|bunker2",elev:"downhill",
     desc:"Amen Corner第3番。左の池に絡む左ドッグレッグ。3打目を池越えにするか刻むか。"},
    {n:14,name:"Chinese Fir",  par:4,yards:440, dogleg:"",      feat:"bunker2",elev:"uphill",
     desc:"バンカーのないホール（18Hで唯一）。ただしグリーンは強烈に傾斜している。"},
    {n:15,name:"Firethorn",    par:5,yards:550, dogleg:"",      feat:"water_front|bunker2",elev:"downhill",
     desc:"グリーン手前を池が横切る。2オン狙いかレイアップかの戦略的ロング。"},
    {n:16,name:"Redbud",       par:3,yards:170, dogleg:"",      feat:"water_left|bunker2",elev:"flat",
     desc:"グリーン左に大きな池。右から左へのスライスで有名なマスターズの名場面ホール。"},
    {n:17,name:"Nandina",      par:4,yards:440, dogleg:"",      feat:"bunker3",elev:"uphill",
     desc:"グリーン手前3バンカー。18番への助走となる重要なミドルホール。"},
    {n:18,name:"Holly",        par:4,yards:465, dogleg:"left",  feat:"leftDogleg|bunker2",elev:"uphill",
     desc:"最終ホール。左ドッグレッグ登り。フェアウェイ両サイドのバンカーを避けてグリーンへ。"},
  ]},
  // ─────────────────────────────────────────────
  // Pebble Beach Golf Links  Par72 7,041yd
  // 太平洋の崖沿いに広がる天然の名コース
  // ─────────────────────────────────────────────
  {id:"pebble",name:"Pebble Beach",flag:"🇺🇸",desc:"USオープン 7,041yd Par72",color:0x1a6b22,
   terrainProfile:"coastal", greenSpeed:12.0, roughType:"heavy",
   holes:[
    {n:1, name:"",par:4,yards:378, dogleg:"right",feat:"rightDogleg|bunker2",elev:"flat",
     desc:"右ドッグレッグ。手前のバンカーを避けて右サイドから狙う。"},
    {n:2, name:"",par:5,yards:509, dogleg:"left", feat:"leftDogleg|bunker3|water_right",elev:"flat",
     desc:"左ドッグレッグロング。右手前の池を意識したショットが必要。"},
    {n:3, name:"",par:4,yards:397, dogleg:"",     feat:"ocean_right|bunker2",elev:"flat",
     desc:"右手に太平洋を望む。フェアウェイが狭く正確性が求められる。"},
    {n:4, name:"",par:4,yards:333, dogleg:"left", feat:"leftDogleg|bunker2",elev:"flat",
     desc:"海沿いの短いミドル。左ドッグレッグでバンカーが連続。"},
    {n:5, name:"",par:3,yards:189, dogleg:"",     feat:"ocean_right|bunker2",elev:"flat",
     desc:"海を右に見るショート。風が強く番手選択が難しい。"},
    {n:6, name:"",par:5,yards:498, dogleg:"left", feat:"ocean_left|bunker3",elev:"cliffside",
     desc:"崖沿いのロング。左に太平洋の断崖。フェアウェイが狭く3打目が勝負。"},
    {n:7, name:"",par:3,yards:107, dogleg:"",     feat:"ocean_front|bunker4",elev:"downhill",
     desc:"最短・最難関ショート。グリーン前方は崖と海。世界最高の難関ショートの一つ。"},
    {n:8, name:"",par:4,yards:416, dogleg:"right",feat:"rightDogleg|ocean_right|bunker2",elev:"uphill",
     desc:"右ドッグレッグ。2打目は海側の崖越えの名場面。パー4最難関の一つ。"},
    {n:9, name:"",par:4,yards:483, dogleg:"left", feat:"leftDogleg|ocean_left",elev:"flat",
     desc:"海沿いの長いミドル。左OBは海。フェアウェイ右サイドキープが鉄則。"},
    {n:10,name:"",par:4,yards:444, dogleg:"",     feat:"bunker2",elev:"flat",
     desc:"インターコースのスタート。フェアウェイバンカーを避けてのティーショット。"},
    {n:11,name:"",par:4,yards:370, dogleg:"",     feat:"bunker2|water_right",elev:"flat",
     desc:"右サイドに池が絡むミドル。パーセーブ重視の戦略が有効。"},
    {n:12,name:"",par:3,yards:202, dogleg:"",     feat:"ocean_right|bunker3",elev:"flat",
     desc:"太平洋に面した長いショート。グリーン右は崖。セカンドショット勝負。"},
    {n:13,name:"",par:4,yards:401, dogleg:"",     feat:"bunker2",elev:"flat",
     desc:"フェアウェイが広め。グリーン左バンカーへの対応が必要。"},
    {n:14,name:"",par:5,yards:559, dogleg:"",     feat:"bunker3|water_left",elev:"flat",
     desc:"最長ロング。左手の池を意識した3打以降の戦略が重要。"},
    {n:15,name:"",par:4,yards:393, dogleg:"",     feat:"bunker2",elev:"flat",
     desc:"比較的攻めやすいミドル。グリーン右バンカーには注意。"},
    {n:16,name:"",par:4,yards:400, dogleg:"right",feat:"rightDogleg|bunker2",elev:"flat",
     desc:"右ドッグレッグ。2打目の距離感が難しい。グリーン手前の傾斜に注意。"},
    {n:17,name:"",par:3,yards:182, dogleg:"",     feat:"ocean_right|bunker2",elev:"cliffside",
     desc:"崖上のショート。右は断崖絶壁。Jack Nicklaus 1点の伝説的バーディホール。"},
    {n:18,name:"",par:5,yards:541, dogleg:"left", feat:"leftDogleg|ocean_left|bunker3",elev:"flat",
     desc:"海沿いの最終ロング。左は海のOB。フィニッシュに相応しい絶景のホール。"},
  ]},
  // ─────────────────────────────────────────────
  // St Andrews Old Course  Par72 7,310yd
  // ゴルフ発祥の地。バンカーと風が支配する
  // ─────────────────────────────────────────────
  {id:"standrews",name:"St Andrews Old Course",flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",desc:"ゴルフ発祥の地 7,310yd Par72",color:0x5a9a3a,
   terrainProfile:"links", greenSpeed:11.0, roughType:"fescue",
   holes:[
    {n:1, name:"Burn",         par:4,yards:376, dogleg:"",     feat:"water_front|ob_left",elev:"flat",
     desc:"Swilcan Burnがグリーン手前を横切る。OBは左のStreet。幅広フェアウェイ。"},
    {n:2, name:"Dyke",         par:4,yards:453, dogleg:"right",feat:"rightDogleg|bunker_hidden",elev:"flat",
     desc:"隠れバンカー多数。ダイクとシェルバンカーが有名。風次第で別コースになる。"},
    {n:3, name:"Cartgate Out", par:4,yards:397, dogleg:"",     feat:"bunker2",elev:"flat",
     desc:"グリーン手前のカートゲートバンカーが難関。右から攻めるのが定石。"},
    {n:4, name:"Ginger Beer",  par:4,yards:480, dogleg:"",     feat:"bunker4",elev:"flat",
     desc:"Cottage、Ginger Beer等の有名バンカー群。距離も長く難易度高。"},
    {n:5, name:"Hole O'Cross Out",par:5,yards:568,dogleg:"",  feat:"bunker3",elev:"flat",
     desc:"最長ホール。バンカー群とエスト広大なフェアウェイ。風の読みが重要。"},
    {n:6, name:"Heathery Out",  par:4,yards:412, dogleg:"",    feat:"bunker3",elev:"uphill",
     desc:"登りのミドル。左右にバンカー群。グリーンは受けグリーン。"},
    {n:7, name:"High Out",      par:4,yards:371, dogleg:"",    feat:"bunker2",elev:"uphill",
     desc:"高台への登り。Shell Bunkerが名物。グリーンは非常に起伏がある。"},
    {n:8, name:"Short",         par:3,yards:188, dogleg:"",    feat:"bunker4",elev:"flat",
     desc:"ショートホール。Principal's NoseバンカーとCoffin Bunkerが有名。"},
    {n:9, name:"End",           par:4,yards:352, dogleg:"left",feat:"leftDogleg|bunker2",elev:"downhill",
     desc:"折り返し地点。左ドッグレッグ下り。コース中盤のスコアメイクホール。"},
    {n:10,name:"Bobby Jones",   par:4,yards:386, dogleg:"",    feat:"bunker2",elev:"flat",
     desc:"Bobby Jonesが得意としたホール。グリーンは大きく傾斜している。"},
    {n:11,name:"High In",       par:3,yards:173, dogleg:"",    feat:"bunker3",elev:"flat",
     desc:"Hill Bunkerが難関。グリーン左前方の斜面に落ちると3打以上かかることも。"},
    {n:12,name:"Heathery In",   par:4,yards:348, dogleg:"",    feat:"bunker2",elev:"flat",
     desc:"比較的短いミドル。グリーン傾斜が強くパットが難しい。"},
    {n:13,name:"Hole O'Cross In",par:4,yards:430,dogleg:"",   feat:"bunker3",elev:"flat",
     desc:"Cat's Trapバンカーが中央フェアウェイに鎮座。避けて攻める判断が必要。"},
    {n:14,name:"Long",          par:5,yards:618, dogleg:"",    feat:"bunker5|ob_right",elev:"flat",
     desc:"コース最長ホール。Hell Bunkerが有名。右はOB。慎重な攻略が求められる。"},
    {n:15,name:"Cartgate In",   par:4,yards:455, dogleg:"",    feat:"bunker2",elev:"flat",
     desc:"グリーン手前のバンカー群。距離があるだけに2打目のクラブ選択が重要。"},
    {n:16,name:"Corner of the Dyke",par:4,yards:423,dogleg:"right",feat:"rightDogleg|bunker3",elev:"flat",
     desc:"右ドッグレッグ。Principal's Noseバンカーを越えるとフェアウェイが広がる。"},
    {n:17,name:"Road Hole",     par:4,yards:495, dogleg:"right",feat:"rightDogleg|bunker1|ob_right",elev:"flat",
     desc:"世界最難関のパー4。右はオールドコースホテルとロードバンカー。伝説のホール。"},
    {n:18,name:"Tom Morris",    par:4,yards:354, dogleg:"",    feat:"bunker2|water_front",elev:"flat",
     desc:"Swilcan Bridgeを渡りフィニッシュ。全世界のゴルファーが夢見る最終ホール。"},
  ]},
  // ─────────────────────────────────────────────
  // TPC Sawgrass  Par72 7,245yd
  // PGAツアー Players Championship の舞台
  // ─────────────────────────────────────────────
  {id:"tpcsawgrass",name:"TPC Sawgrass",flag:"🇺🇸",desc:"Players Championship 7,245yd Par72",color:0x1e8a1e,
   terrainProfile:"flat_water", greenSpeed:12.5, roughType:"bermuda",
   holes:[
    {n:1, name:"",par:4,yards:423, dogleg:"right",feat:"rightDogleg|bunker2|water_right",elev:"flat",
     desc:"右ドッグレッグ。水が絡む開幕ホール。落ち着いてフェアウェイキープを。"},
    {n:2, name:"",par:5,yards:532, dogleg:"",     feat:"bunker3|water_left",elev:"flat",
     desc:"左手に水が続くロング。2オン狙いはリスクが高い。3打勝負が正解。"},
    {n:3, name:"",par:3,yards:177, dogleg:"",     feat:"water_front|bunker2",elev:"flat",
     desc:"名物ショート。手前左の池越え。直接狙うか右花道から攻めるか戦略が問われる。"},
    {n:4, name:"",par:4,yards:384, dogleg:"left", feat:"leftDogleg|bunker2",elev:"flat",
     desc:"左ドッグレッグ。グリーンの傾斜が複雑。パットの読みが勝負を分ける。"},
    {n:5, name:"",par:4,yards:471, dogleg:"",     feat:"bunker3|water_right",elev:"flat",
     desc:"距離のあるミドル。右の水を意識して左サイドからのアプローチが基本。"},
    {n:6, name:"",par:4,yards:393, dogleg:"",     feat:"bunker2",elev:"flat",
     desc:"比較的攻めやすいミドル。グリーンへのアプローチで傾斜に乗せたい。"},
    {n:7, name:"",par:4,yards:452, dogleg:"",     feat:"bunker3|water_left",elev:"flat",
     desc:"左手の水が2打目にプレッシャー。スタジアムコースの雰囲気が漂う。"},
    {n:8, name:"",par:3,yards:237, dogleg:"",     feat:"water_right|bunker3",elev:"flat",
     desc:"最長ショート。右は全面水。強風時は3番手アップも珍しくない。"},
    {n:9, name:"",par:5,yards:583, dogleg:"",     feat:"bunker2|water_left",elev:"flat",
     desc:"最長ロング。左手に水。3打目の距離感と方向性がスコアを決める。"},
    {n:10,name:"",par:4,yards:424, dogleg:"right",feat:"rightDogleg|bunker2",elev:"flat",
     desc:"後半スタート。右ドッグレッグ。バンカーを越えてフェアウェイを広く使う。"},
    {n:11,name:"",par:5,yards:558, dogleg:"",     feat:"water_right|bunker3",elev:"flat",
     desc:"右手の水が続くロング。攻め方は右を避けながら2オンか刻みか。"},
    {n:12,name:"",par:4,yards:358, dogleg:"",     feat:"bunker2",elev:"flat",
     desc:"短めのミドル。グリーン周辺のバンカー配置が絶妙。バーディチャンス。"},
    {n:13,name:"",par:3,yards:181, dogleg:"",     feat:"bunker4|water_right",elev:"flat",
     desc:"右に水が迫るショート。バンカーも多い難関。グリーン左サイドを狙う。"},
    {n:14,name:"",par:4,yards:481, dogleg:"",     feat:"bunker3|water_left",elev:"flat",
     desc:"距離のあるミドル。左の水を避けて右サイドから攻める。"},
    {n:15,name:"",par:4,yards:470, dogleg:"",     feat:"bunker2|water_right",elev:"flat",
     desc:"17番前の重要ホール。右手の池に注意しながらグリーンを狙う。"},
    {n:16,name:"",par:5,yards:523, dogleg:"",     feat:"water_left|bunker3",elev:"flat",
     desc:"17番Island Greenへの前哨戦。スコアを作っておきたいロング。"},
    {n:17,name:"Island Green",par:3,yards:137, dogleg:"",feat:"island_green",elev:"flat",
     desc:"世界最も有名なショートホール。グリーン全体が水に囲まれた孤島。毎年50,000球以上が池に沈む。"},
    {n:18,name:"",par:4,yards:462, dogleg:"right",feat:"rightDogleg|water_left|bunker3",elev:"flat",
     desc:"最終ホール。左手に水、右ドッグレッグ。スタジアムのギャラリーが見守る中でのフィニッシュ。"},
  ]},
  // ─────────────────────────────────────────────
  // 戸田パブリックゴルフコース  Par72
  // 荒川河川敷の公共コース（旧データ維持）
  // ─────────────────────────────────────────────
    // ─────────────────────────────────────────────
  // 戸田パブリックゴルフコース (Toda Public Golf Course)
  // 荒川河川敷 9ホール2WAY 18ホール Par72 6,237yd
  // ─────────────────────────────────────────────
  
  
  // ─────────────────────────────────────────────
  // 宍戸ヒルズCC 西コース  Par72 7,437yd
  // ─────────────────────────────────────────────
  {id:"sasayama",name:"宍戸ヒルズ西コース",flag:"🇯🇵",desc:"日本オープン開催 7,437yd Par72",color:0x2a7a18,
   terrainProfile:"hilly", greenSpeed:12.0, roughType:"fescue",
   holes:[
    {n:1,par:4,yards:398,feat:"bunker2",        desc:"戦略的オープニング。グリーン手前の2バンカーが難関。"},
    {n:2,par:5,yards:519,feat:"leftDogleg|bunker2",desc:"左ドッグレッグロング。2打目の左サイドバンカーに要注意。"},
    {n:3,par:3,yards:192,feat:"bunker3",         desc:"グリーン周辺3バンカーのショート。風の影響を受けやすい。"},
    {n:4,par:4,yards:415,feat:"rightDogleg|bunker2",desc:"右ドッグレッグ。距離も長く正確性が求められる難ミドル。"},
    {n:5,par:4,yards:402,feat:"bunker2",         desc:"標準的な距離のミドル。グリーンの傾斜が強い。"},
    {n:6,par:5,yards:588,feat:"bunker3",         desc:"最長ロング。3打目の距離感が勝負を分ける。"},
    {n:7,par:3,yards:231,feat:"bunker3",         desc:"コース最長ショート。バンカー群と傾斜グリーンで難度最高。"},
    {n:8,par:4,yards:456,feat:"rightDogleg|bunker2",desc:"長い右ドッグレッグ。2打目でグリーンを捉えるのが難しい。"},
    {n:9,par:4,yards:508,feat:"bunker3|ob_left", desc:"前半最長ミドル。左OBと3バンカーでスコアを崩しやすい。"},
    {n:10,par:5,yards:515,feat:"leftDogleg|bunker2",desc:"後半スタートのロング。左ドッグレッグで木々が絡む。"},
    {n:11,par:4,yards:407,feat:"bunker2",        desc:"フラットなミドル。グリーン手前の2バンカーが難関。"},
    {n:12,par:4,yards:408,feat:"rightDogleg|bunker2",desc:"右ドッグレッグ。フェアウェイが広いが2打目が難しい。"},
    {n:13,par:3,yards:162,feat:"water_front|bunker2",desc:"グリーン手前に池が横切る難関ショート。"},
    {n:14,par:4,yards:460,feat:"bunker3",        desc:"距離のある難ミドル。グリーン周辺の3バンカーが厄介。"},
    {n:15,par:5,yards:638,feat:"bunker4",        desc:"コース最長ロング638yd。日本オープンでも話題の超難関。"},
    {n:16,par:3,yards:190,feat:"water_right|bunker2",desc:"右に池が迫るショート。風が強い日は番手が上がる。"},
    {n:17,par:4,yards:481,feat:"leftDogleg|bunker2",desc:"距離ある左ドッグレッグミドル。最終盤の難ホール。"},
    {n:18,par:4,yards:467,feat:"rightDogleg|bunker3",desc:"右ドッグレッグのフィニッシュ。グリーン周辺3バンカーでクライマックスを演出。"},
  ]},
  // ─────────────────────────────────────────────
  // PGM石岡ゴルフクラブ  Par72 7,071yd
  // ─────────────────────────────────────────────
  {id:"ibaraki",name:"PGM石岡GC",flag:"🇯🇵",desc:"7,071yd Par72",color:0x1e7a1e,
   terrainProfile:"hilly", greenSpeed:11.5, roughType:"noshiba",
   holes:[
    {n:1, par:4,yards:352,feat:"bunker2",       desc:"オープニングミドル。グリーン左右バンカー。落ち着いてスタート。"},
    {n:2, par:5,yards:533,feat:"leftDogleg|bunker2",desc:"左ドッグレッグロング。フェアウェイバンカーが絡む。"},
    {n:3, par:4,yards:382,feat:"bunker2",       desc:"標準的な距離のミドル。グリーン手前のバンカー2基に注意。"},
    {n:4, par:3,yards:196,feat:"bunker3",       desc:"グリーン周辺3バンカーのショート。距離も長く難度高い。"},
    {n:5, par:5,yards:576,feat:"bunker3|water_left",desc:"左手に池が絡むロング。2打目の選択が重要。"},
    {n:6, par:4,yards:466,feat:"rightDogleg|bunker2",desc:"長い右ドッグレッグ。距離と方向の両立が求められる。"},
    {n:7, par:4,yards:430,feat:"bunker3",       desc:"グリーン周辺3バンカーの難ミドル。"},
    {n:8, par:3,yards:225,feat:"bunker4|water_right",desc:"右手の池と4バンカーの難関ショート。"},
    {n:9, par:4,yards:429,feat:"leftDogleg|bunker2",desc:"左ドッグレッグ。前半の締めに難易度高いミドル。"},
    {n:10,par:4,yards:389,feat:"bunker2",       desc:"後半スタート。グリーン手前バンカーを避けてアプローチ。"},
    {n:11,par:5,yards:495,feat:"bunker3",       desc:"短めのロング。2オン狙いもあるが手前の3バンカーが曲者。"},
    {n:12,par:4,yards:352,feat:"bunker2",       desc:"短めのミドル。バーディチャンスだがグリーン傾斜が強い。"},
    {n:13,par:3,yards:206,feat:"water_front|bunker2",desc:"池越えの難ショート。グリーン手前が全面水。"},
    {n:14,par:4,yards:412,feat:"rightDogleg|bunker2",desc:"右ドッグレッグ。コースが曲がる地点のバンカーに注意。"},
    {n:15,par:4,yards:465,feat:"bunker3",       desc:"距離のある難ミドル。3バンカー配置が絶妙。"},
    {n:16,par:5,yards:544,feat:"leftDogleg|bunker2|water_right",desc:"左ドッグレッグロング。右の池と2バンカーが難関。"},
    {n:17,par:3,yards:184,feat:"bunker3",       desc:"グリーン3バンカー。最終盤に集中力が問われるショート。"},
    {n:18,par:4,yards:435,feat:"rightDogleg|bunker3",desc:"右ドッグレッグのフィニッシュ。3バンカーで締めくくり。"},
  ]},
  // ─────────────────────────────────────────────
  // 花葉CC  Par71
  // ─────────────────────────────────────────────
  {id:"kazuha",name:"花葉CC",flag:"🇯🇵",desc:"Par71",color:0x4a9a2a,
   terrainProfile:"gentle_hilly", greenSpeed:11.0, roughType:"korai",
   holes:[
    {n:1, par:5,yards:520,feat:"water_left|bunker2", desc:"池が絡むオープニングロング。左の池を避けて右サイドから攻める。"},
    {n:2, par:4,yards:438,feat:"bunker3",            desc:"距離のある難ミドル。グリーン周辺3バンカー。"},
    {n:3, par:4,yards:356,feat:"bunker2",            desc:"標準的なミドル。グリーン手前バンカー2基に注意。"},
    {n:4, par:4,yards:329,feat:"rightDogleg|bunker1",desc:"短い右ドッグレッグ。バーディチャンス。"},
    {n:5, par:3,yards:173,feat:"bunker2",            desc:"距離は短めのショート。グリーン両サイドのバンカーが難関。"},
    {n:6, par:4,yards:384,feat:"bunker2",            desc:"フェアウェイが広めのミドル。グリーン奥の下り傾斜に注意。"},
    {n:7, par:3,yards:177,feat:"water_front|bunker2",desc:"池越えのショート。グリーン手前全面が水。"},
    {n:8, par:4,yards:357,feat:"bunker2",            desc:"短めのミドル。スコアメイクのチャンスホール。"},
    {n:9, par:5,yards:501,feat:"leftDogleg|bunker2", desc:"左ドッグレッグロング。前半の締めくくり。"},
    {n:10,par:4,yards:369,feat:"bunker2",            desc:"後半スタート。落ち着いてフェアウェイキープ。"},
    {n:11,par:3,yards:185,feat:"bunker3",            desc:"グリーン周辺3バンカーの難ショート。"},
    {n:12,par:4,yards:406,feat:"rightDogleg|bunker2",desc:"右ドッグレッグ。2打目のアイアン勝負。"},
    {n:13,par:5,yards:448,feat:"water_left|bunker2", desc:"短いロング。2オン狙い可能だが左の池に注意。"},
    {n:14,par:4,yards:330,feat:"bunker1",            desc:"最短ミドル。バーディを量産したいホール。"},
    {n:15,par:4,yards:360,feat:"bunker2",            desc:"傾斜が複雑なミドル。パットの読みが勝負。"},
    {n:16,par:4,yards:376,feat:"rightDogleg|bunker2",desc:"右ドッグレッグ。グリーン手前バンカーを避けて。"},
    {n:17,par:5,yards:448,feat:"water_right|bunker2",desc:"右手に池が絡むロング。最終盤の難ホール。"},
    {n:18,par:3,yards:181,feat:"bunker3",            desc:"3バンカー配置の最終ショート。感動のフィニッシュ。"},
  ]},
];

function pointInPolygon2D(px,pz,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i].x,zi=poly[i].y,xj=poly[j].x,zj=poly[j].y;
    if(((zi>pz)!==(zj>pz))&&(px<(xj-xi)*(pz-zi)/(zj-zi)+xi))inside=!inside;
  }
  return inside;
}

// =============================================
// ★ ゲームスケール地形（フラクタルノイズ）
// =============================================
class TerrainGen{
  constructor(W,H,seed){
    this.W=W;this.H=H;this.seed=seed||Math.random()*999;
    this.fairwayCurve=(Math.random()-0.5)*0.015;
    // ★ コースプロファイルで外部から上書き可能
    this.amplitude=1.0; // 起伏の大きさ倍率
    this.freq=1.0;      // 周波数倍率（未使用だが互換性のため保持）
  }
  // スムーズノイズ（Smooth-step補間）
  _smooth(x,z,freq,amp){
    const s=this.seed;
    const ix=Math.floor(x*freq), iz=Math.floor(z*freq);
    const fx=(x*freq-ix), fz=(z*freq-iz);
    // Smoothstep
    const ux=fx*fx*(3-2*fx), uz=fz*fz*(3-2*fz);
    const h00=Math.sin(ix*127.1+iz*311.7+s)*43758.5453%1;
    const h10=Math.sin((ix+1)*127.1+iz*311.7+s)*43758.5453%1;
    const h01=Math.sin(ix*127.1+(iz+1)*311.7+s)*43758.5453%1;
    const h11=Math.sin((ix+1)*127.1+(iz+1)*311.7+s)*43758.5453%1;
    return amp*(h00*(1-ux)*(1-uz)+h10*ux*(1-uz)+h01*(1-ux)*uz+h11*ux*uz-0.5)*2;
  }
  getHeight(xi,zi){
      let h = this._smooth(xi,zi,this.freq,this.amplitude);
      if(window._bunkerZones){
        for(let b of window._bunkerZones){
          let dx = xi - b.x; let dz = zi - b.z;
          let dist = Math.sqrt(dx*dx + dz*dz);
          if(dist < b.radius){
            // ポットバンカー（すり鉢状の深い窪み）
            let depth = (b.radius - dist) / b.radius;
            h -= depth * 1.5; // 最大1.5mの深さ
          }
        }
      }
      return h;
    }
}

// =============================================
// ★★★ ULTRA REALISTIC Ball Physics Engine ★★★
// Magnus効果・バックスピン・ライ別ラン・傾斜パット対応
// =============================================

// ─────────────────────────────────────────────────────────────
// ★★★ 戸田パブリックゴルフコース PBRマテリアル＆物性定義 ★★★
// 仕様書準拠カラーパレット・反発係数・摩擦係数
// ─────────────────────────────────────────────────────────────
const TODA_PALETTE = {
  tee:      0x34b233, // 鮮やかな緑（高麗芝）
  fairway:  0x17420c, // 濃淡美しい高麗芝フェアウェイ /* v4.15: 空撮で縞と同化していたため深くする（縞 0x276314 は据え置きで明暗差を出す）。 */
  firstCut: 0x1a4d0e, // FWより一段階暗く抵抗を感じさせる
  rough:    0x143806, // 深く密集した高麗芝の重さ（v4.15: 空撮でフェアウェイと同化していたため少し深くする）
  green:    0x1e7d16, // 砲台グリーン高麗芝
  bunker:   0xd8b47c, // 重く湿り気のある河川敷ダークベージュ
  water:    0x0f5a92, // 荒川スチールブルー /* v4.15: 空撮で池が淡い水色に見えていたため深い青にする（飽和青に寄せる）。 */
  bush:     0x0d4f0d, // 視覚的圧迫感を与える深い深緑
  ob:       0xFFFFFF, // 白杭
  penalty:  0xFFCC00  // 黄・赤杭
};

const TODA_PHYSICS = {
  tee:      { restitution: 0.55, friction: 0.35, rollDecay: 1.6 },
  fairway:  { restitution: 0.50, friction: 0.40, rollDecay: 1.8 },
  firstCut: { restitution: 0.40, friction: 0.55, rollDecay: 2.8 },
  rough:    { restitution: 0.25, friction: 0.75, rollDecay: 4.8 },
  green:    { restitution: 0.35, friction: 0.20, rollDecay: 1.25 },
  bunker:   { restitution: 0.08, friction: 0.95, rollDecay: 9.5 },
  water:    { restitution: 0.00, friction: 1.00, rollDecay: 0.0 },
  slope:    { restitution: 0.38, friction: 0.15, rollDecay: 0.85 } // 砲台法面（滑落）
};

class Ball{
  constructor(){
    this.position=new THREE.Vector3(0,0,0);
    this.phase="idle";
    this.inFlight=false;
    this.mesh=null;
    this.carryStartPos=new THREE.Vector3();
    this.carryEndPos=new THREE.Vector3();
    this.carryDist=0;
    this.carryTime=0;
    this.carryElapsed=0;
    this.peakHeight=0;
    this.startPos=new THREE.Vector3();
    this.totalDistYd=0;
    this.runStartPos=new THREE.Vector3();
    this.runEndPos=new THREE.Vector3();
    this.runDist=0;
    this.runTime=0;
    this.runElapsed=0;
    // パット用（リアル3Dベクター）
    this.puttVel=new THREE.Vector3();
    this.puttDecay=0;
    this.puttElapsed=0;
    this._slopeVec=new THREE.Vector2(0,0);
    // Magnus効果パラメータ
    this._aimSx=0; this._aimSz=0;
    this.magnasMidOffset=0;
    this.spinAxis=0;
    // 情報
    this.maxHeight=0;
    this.distanceTraveled=0;
    this.onLanded=null;
    this.onStopped=null;
    this.isOB=false;
    this.landedSurface="fairway";
  }

  shoot(fromPos, carryDist, runDist, aimAngleRad, sideOffsetYd, peakRatioOverride, getGY, extraParams){
    this.phase="carry";this.inFlight=true;
    this.startPos.copy(fromPos);this.position.copy(fromPos);
    this.carryElapsed=0;this.maxHeight=0;this.distanceTraveled=0;this.isOB=false;
    const sx=Math.sin(aimAngleRad), sz=-Math.cos(aimAngleRad);
    this._aimSx=sx; this._aimSz=sz;
    // Magnus効果: スピン軸から曲がりを計算
    this.spinAxis=(extraParams&&extraParams.spinAxis)||0;
    this.magnasMidOffset=this.spinAxis*carryDist*0.006;
    const cx=fromPos.x+sx*carryDist+sideOffsetYd;
    const cz=fromPos.z+sz*carryDist;
    const cgy=getGY(cx,cz);
    this.carryStartPos.copy(fromPos);
    this.carryEndPos.set(cx,cgy,cz);
    this.carryDist=carryDist;
    this.carryTime=Math.sqrt(carryDist)*0.19;
    this.peakHeight=carryDist*(peakRatioOverride||0.18);
    const rx=cx+sx*runDist+sideOffsetYd*0.3;
    const rz=cz+sz*runDist;
    const rgy=getGY(rx,rz);
    this.runStartPos.copy(this.carryEndPos);
    this.runEndPos.set(rx,rgy,rz);
    this.runDist=runDist;
    this.runTime=Math.max(0.4,Math.min(2.0,Math.sqrt(runDist)*0.22));
    this.runElapsed=0;
    this.totalDistYd=(carryDist+runDist);
  }

  putt(fromPos,speedYdPerSec,aimAngleRad,slopeVec,customDecay){
    this.phase="putt_roll";this.inFlight=true;
    this.startPos.copy(fromPos);this.position.copy(fromPos);
    this.puttVel.set(Math.sin(aimAngleRad)*speedYdPerSec,0,-Math.cos(aimAngleRad)*speedYdPerSec);
    this._slopeVec=slopeVec||new THREE.Vector2(0,0);
    this.puttDecay=customDecay||1.6;
    this.puttElapsed=0;this.distanceTraveled=0;this.isOB=false;
    this.landedSurface="green";this.maxHeight=0;
    this.totalDistYd=speedYdPerSec*speedYdPerSec/(2*this.puttDecay);
  }

  update(dt,getGY,getSurf){
    if(!this.inFlight)return;
    const SUB=4;const subDt=dt/SUB;
    for(let i=0;i<SUB;i++){
      this._step(subDt,getGY,getSurf);
      if(!this.inFlight)break;
    }
    if(this.mesh){
      this.mesh.position.copy(this.position);
      // ボール回転アニメーション
      if(this.phase==="carry"){this.mesh.rotation.x+=dt*10;}
      else if(this.phase==="run"||this.phase==="putt_roll"){this.mesh.rotation.x+=dt*6;this.mesh.rotation.y+=dt*1.5;}
    }
  }

  _step(dt,getGY,getSurf){
    if(this.phase==="carry"){
      this.carryElapsed+=dt;
      const t=Math.min(this.carryElapsed/this.carryTime,1);
      // ★ Magnus効果: S字弾道（正弦波横方向偏差）
      const magnusX=this._aimSz*this.magnasMidOffset*Math.sin(Math.PI*t);
      const magnusZ=-this._aimSx*this.magnasMidOffset*Math.sin(Math.PI*t);
      this.position.x=this.carryStartPos.x+(this.carryEndPos.x-this.carryStartPos.x)*t+magnusX;
      this.position.z=this.carryStartPos.z+(this.carryEndPos.z-this.carryStartPos.z)*t+magnusZ;
      // ★ バックスピン非対称放物線: 頂点がt=0.5より少し後ろにずれる
      const groundT=this.carryStartPos.y+(this.carryEndPos.y-this.carryStartPos.y)*t;
      const tAdjusted=t<0.52?t/0.52*0.5:0.5+(t-0.52)/0.48*0.5;
      const arc=Math.sin(Math.PI*tAdjusted)*this.peakHeight;
      this.position.y=groundT+arc;
      if(this.position.y>this.maxHeight)this.maxHeight=this.position.y;
      if(t>=1){
        this.position.copy(this.carryEndPos);
        this.position.y=getGY(this.position.x,this.position.z)+0.03;
        this.landedSurface=getSurf(this.position.x,this.position.z);
        if(this.onLanded)this.onLanded(this.landedSurface,this.position.clone());
        this.phase="run";this.runElapsed=0;
        this.runStartPos.copy(this.position);
        // ★ ライ別ラン補正
        if(this.landedSurface==="rough"){this.runDist*=0.4;this.runTime*=0.7;}
        else if(this.landedSurface==="bunker"){this.runDist*=0.05;this.runTime*=0.3;}
        else if(this.landedSurface==="green"){this.runDist*=0.45;this.runTime*=0.8;}
        this.runEndPos.set(
          this.runStartPos.x+this._aimSx*this.runDist,
          getGY(this.runStartPos.x+this._aimSx*this.runDist, this.runStartPos.z+this._aimSz*this.runDist),
          this.runStartPos.z+this._aimSz*this.runDist
        );
      }
    } else if(this.phase==="run"){
      this.runElapsed+=dt;
      const tRun=Math.min(this.runElapsed/this.runTime,1);
      // Cubic easeOut
      const ease=1-Math.pow(1-tRun,3);
      this.position.x=this.runStartPos.x+(this.runEndPos.x-this.runStartPos.x)*ease;
      this.position.z=this.runStartPos.z+(this.runEndPos.z-this.runStartPos.z)*ease;
      this.position.y=getGY(this.position.x,this.position.z)+0.03;
      if(tRun>=1)this._stop(getGY,getSurf);
    } else if(this.phase==="putt_roll"){
      this.puttElapsed+=dt;
      const spd=Math.sqrt(this.puttVel.x*this.puttVel.x+this.puttVel.z*this.puttVel.z);
      if(spd<0.06){this._stop(getGY,getSurf);return;}
      // ★ リアル摩擦減速（物理ベース）
      const friction=this.puttDecay*dt;
      const newSpd=Math.max(0,spd-friction);
      const factor=spd>0?newSpd/spd:0;
      this.puttVel.x*=factor;
      this.puttVel.z*=factor;
      // ★ 傾斜重力加速
      const maxSlopeAcc = 0.8;
      const sx = Math.max(-maxSlopeAcc, Math.min(maxSlopeAcc, this._slopeVec.x * 1.0));
      const sz = Math.max(-maxSlopeAcc, Math.min(maxSlopeAcc, this._slopeVec.y * 1.0));
      this.puttVel.x += sx * dt;
      this.puttVel.z += sz * dt;
      this.position.x+=this.puttVel.x*dt;
      this.position.z+=this.puttVel.z*dt;
      this.position.y=getGY(this.position.x,this.position.z)+0.03;
      if(newSpd<0.06)this._stop(getGY,getSurf);
    }
    const d=Math.sqrt((this.position.x-this.startPos.x)**2+(this.position.z-this.startPos.z)**2);
    this.distanceTraveled=d;
  }

  _stop(getGY,getSurf){
    this.phase="idle";this.inFlight=false;
    this.position.y=getGY(this.position.x,this.position.z)+0.03;
    if(this.onStopped)this.onStopped(this.position.clone(),getSurf(this.position.x,this.position.z));
  }
}

// ===== ショットコントローラー（NS/SNS/UNS ゾーン対応） =====
class ShotController{
  constructor(cb){
    this.onShotReady=cb;
    this.phase=0;this.power=0;this.accuracy=0;
    this.needlePos=0;this.needleDir=1;this.needleSpeed=0.82;
    this.animating=false;this.raf=null;this.lastTime=0;
    // ナイスショットゾーン定義（impact phase2 の針位置）
    // UNS: 47〜53%, SNS: 40〜47% & 53〜60%, NS: 33〜40% & 60〜67%
    this.UNS_CENTER=0.50; this.UNS_HALF=0.03;  // 中心±3% = UNS
    this.SNS_HALF=0.10;                          // 中心±10% = SNS
    this.NS_HALF=0.17;                           // 中心±17% = NS
    this.niceShotBonus=0; // 0 / 0.20 / 0.30 / 0.50
    this.niceShotLabel="";
    this.clubMaxDist=0; // 現在クラブの最大飛距離（推定距離表示用）
  }
  /* 難易度（v4.16・方式C）: 第2段の針速と UNS 半幅だけを変える。ノーマルは現行定数そのもの。
     難易度は対戦ブリッジが window.GOAT_BATTLE.difficulty に載せる（未設定時はノーマル）。 */
  _diffParams(){
    var d = (typeof window !== "undefined" && window.GOAT_BATTLE && window.GOAT_BATTLE.difficulty) || "normal";
    if(d === "super_easy") return { speed:1.05, unsHalf:0.055 };
    if(d === "easy")       return { speed:1.28, unsHalf:0.040 };
    if(d === "hard")       return { speed:1.80, unsHalf:0.022 };
    return { speed:1.5, unsHalf:0.03 };
  }
  reset(){
    this.phase=0;this.power=0;this.accuracy=0;this.niceShotBonus=0;
    this.needlePos=0;this.needleDir=1;this.animating=false;
    if(this.raf){cancelAnimationFrame(this.raf);this.raf=null;}
    const n=document.getElementById("powerNeedle");if(n)n.style.left="0%";
    const iz=document.getElementById("impactZone");if(iz)iz.style.display="none";
    const izu=document.getElementById("impactZoneUNS");if(izu)izu.style.display="none";
    const sg=document.getElementById("shotGuide");if(sg)sg.textContent="タップ / Space でショット";
    // パワー数値表示をOFF、swinging クラスも除去
    const pvr=document.getElementById("powerValueRow");if(pvr)pvr.style.display="none";
    const pr=document.getElementById("powerRow");if(pr)pr.classList.remove("swinging");
    const pvn=document.getElementById("powerValueNum");if(pvn){pvn.textContent="--%";pvn.style.color="#fff";}
    const pzh=document.getElementById("powerZoneHint");if(pzh)pzh.textContent="";
  }
  startSwing(){
    if(this.phase!==0)return;
    this.phase=1;this.animating=true;this.needlePos=0;this.needleDir=1;
    this.UNS_HALF=this._diffParams().unsHalf; // 難易度に応じた JUST 帯（ノーマルは現行 ±3%）
    document.getElementById("shotGuide").textContent="⬆️ パワー最大点でもう一度！";
    const iz=document.getElementById("impactZone");if(iz)iz.style.display="none";
    const izu=document.getElementById("impactZoneUNS");if(izu)izu.style.display="none";
    // パワー数値表示をON、powerRowにスペース確保クラスを付与
    const pvr=document.getElementById("powerValueRow");if(pvr)pvr.style.display="flex";
    const pr=document.getElementById("powerRow");if(pr)pr.classList.add("swinging");
    const pvn=document.getElementById("powerValueNum");if(pvn){pvn.textContent="0%";pvn.style.color="#fff";}
    const pzh=document.getElementById("powerZoneHint");if(pzh)pzh.textContent="";
    this.lastTime=performance.now();this._anim();
  }
  _anim(){
    if(!this.animating)return;
    const now=performance.now(),dt=(now-this.lastTime)/1000;this.lastTime=now;
    this.needlePos+=this.needleDir*this.needleSpeed*dt;
    if(this.needlePos>=1){this.needlePos=1;this.needleDir=-1;}
    if(this.needlePos<=0){this.needlePos=0;this.needleDir=1;}
    const pct=Math.round(this.needlePos*100);
    document.getElementById("powerNeedle").style.left=pct+"%";
    // リアルタイムパワー数値＋推定飛距離表示
    const pvn=document.getElementById("powerValueNum");
    const pzh=document.getElementById("powerZoneHint");
    if(this.phase===1&&pvn){
      // 推定飛距離 = クラブmax × パワー%
      const estYd=this.clubMaxDist?Math.round(this.clubMaxDist*(pct/100)):"?";
      pvn.innerHTML=`<span style="font-size:2.8rem">${pct}%</span><span style="font-size:1.1rem;color:#88ccff;margin-left:8px">${estYd}yd</span>`;
      if(pzh){
        if(pct>=94){pzh.textContent="🌟 UNS圏内！";pzh.style.color="#ff88ff";}
        else if(pct>=88){pzh.textContent="⭐ SNS圏内";pzh.style.color="#ffdd44";}
        else if(pct>=78){pzh.textContent="✨ NS圏内";pzh.style.color="#44ff88";}
        else{pzh.textContent="";pzh.style.color="";}
      }
    }else if(this.phase===2&&pvn){
      const diff=Math.abs(this.needlePos-this.UNS_CENTER);
      if(diff<=this.UNS_HALF){pvn.style.color="#ff88ff";pzh&&(pzh.textContent="🌟 UNS！");}
      else if(diff<=this.SNS_HALF){pvn.style.color="#ffdd44";pzh&&(pzh.textContent="⭐ SNS！");}
      else if(diff<=this.NS_HALF){pvn.style.color="#44ff88";pzh&&(pzh.textContent="✨ NS！");}
      else{pvn.style.color="#ffffff";pzh&&(pzh.textContent="");}
    }
    this.raf=requestAnimationFrame(()=>this._anim());
  }
  setPower(){
    if(this.phase!==1)return;
    this.phase=2;this.power=Math.round(this.needlePos*100);
    // インパクトゾーン表示
    const c=this.UNS_CENTER,nh=this.NS_HALF;
    const iz=document.getElementById("impactZone");
    if(iz){iz.style.left=((c-nh)*100)+"%";iz.style.width=(nh*2*100)+"%";iz.style.display="block";}
    const izu=document.getElementById("impactZoneUNS");
    if(izu){izu.style.left=((c-this.UNS_HALF)*100)+"%";izu.style.width=(this.UNS_HALF*2*100)+"%";izu.style.display="block";}
    // パワー確定表示
    const pvn=document.getElementById("powerValueNum");
    if(pvn){pvn.textContent=this.power+"%";pvn.style.color="#ffd700";}
    const pzh=document.getElementById("powerZoneHint");
    if(pzh){pzh.textContent="★ 中央でUNS +50%！";pzh.style.color="#ff88ff";}
    document.getElementById("shotGuide").textContent=`POWER ${this.power}%  ▶ タイミング！`;
    this.needleSpeed=this._diffParams().speed; // 難易度に応じた第2段の針速（ノーマルは現行 1.5）
  }
  setImpact(){
    if(this.phase!==2)return;
    this.animating=false;if(this.raf){cancelAnimationFrame(this.raf);this.raf=null;}
    const diff=Math.abs(this.needlePos-this.UNS_CENTER);
    // ナイスショット判定
    if(diff<=this.UNS_HALF){
      this.niceShotBonus=0.50;this.niceShotLabel="🌟 ULTRA NICE SHOT +50%";this.accuracy=100;
    }else if(diff<=this.SNS_HALF){
      this.niceShotBonus=0.30;this.niceShotLabel="⭐ SUPER NICE SHOT +30%";this.accuracy=88;
    }else if(diff<=this.NS_HALF){
      this.niceShotBonus=0.20;this.niceShotLabel="✨ NICE SHOT +20%";this.accuracy=75;
    }else{
      this.niceShotBonus=0.00;
      const miss=diff>0.3;
      this.niceShotLabel=miss?"❌ MISS":"😐 OK";
      this.accuracy=miss?30:55;
    }
    const iz=document.getElementById("impactZone");if(iz)iz.style.display="none";
    const izu=document.getElementById("impactZoneUNS");if(izu)izu.style.display="none";
    document.getElementById("shotGuide").textContent=this.niceShotLabel;
    // パワー数値にニーショット結果を表示
    const pvn=document.getElementById("powerValueNum");
    const pzh=document.getElementById("powerZoneHint");
    if(pvn){pvn.textContent=this.power+"%";}
    if(pzh){
      if(this.niceShotBonus>=0.50){pzh.textContent="🌟 UNS +50%";pzh.style.color="#ff88ff";}
      else if(this.niceShotBonus>=0.30){pzh.textContent="⭐ SNS +30%";pzh.style.color="#ffdd44";}
      else if(this.niceShotBonus>=0.20){pzh.textContent="✨ NS +20%";pzh.style.color="#44ff88";}
      else{pzh.textContent="";pzh.style.color="";}
    }
    this.phase=0;
    this.onShotReady(this.power,this.accuracy,this.niceShotBonus);
    setTimeout(()=>this.reset(),1400);
  }
  onInput(){if(this.phase===0)this.startSwing();else if(this.phase===1)this.setPower();else if(this.phase===2)this.setImpact();}
}

// ===== パットコントローラー（みんゴル式・操作しやすい）=====
// ===== パットコントローラー（物理法則完全一致・オートレンジ＆直感ゲージ）=====
class PuttController{
  constructor(cb){
    this.onPuttReady=cb;
    this.phase=0;
    this.needlePos=0;this.needleDir=1;
    // 落ち着いて狙いやすい絶妙なテンポ（往復約2.6秒）
    this.needleSpeed=0.38;
    this.animating=false;this.raf=null;this.lastTime=0;
    this.targetPos=0.75; // 目標ピン位置を常にメーターの75%に配置！
    this.targetRange=0.08; // ジャストゾーン（71%〜79%）
    this.distYd=3.0; // 現在のカップまでの距離(yd)
    this.distFt=9.0; // 現在のカップまでの距離(ft)
    this.maxRangeYd=4.0; // メーター全体の最大距離(yd) = distYd / 0.75
  }

  // ピンまでの距離(yd)に応じてメーターをオートスケール
  setTargetFromDist(distYd){
    this.distYd=Math.max(0.5, distYd);
    this.distFt=Math.round(this.distYd * 30) / 10;
    // ピン位置を常にメーターの75%に設定
    this.targetPos=0.75;
    this.maxRangeYd=this.distYd / this.targetPos; // 100%位置がカップの約1.33倍
    this.targetRange=0.08;
    this._updateUI();

    const pvn=document.getElementById("puttValueNum");
    if(pvn) pvn.textContent=`${this.distYd.toFixed(1)}yd (${this.distFt.toFixed(1)}ft)`;
    const pzh=document.getElementById("puttZoneHint");
    if(pzh) pzh.textContent=`⛳ 目標: ${Math.round(this.distYd)}yd (${Math.round(this.distFt)}ft)`;
  }

  _updateUI(){
    const iz=document.getElementById("puttImpactZone");
    if(iz){
      const left=(this.targetPos - this.targetRange * 0.5) * 100;
      const width=this.targetRange * 100;
      iz.style.left=Math.max(0, left) + "%";
      iz.style.width=width + "%";
      iz.style.display="block";
    }
    const pm=document.getElementById("puttTargetPinMarker");
    if(pm){
      pm.style.left=(this.targetPos * 100) + "%";
    }
  }

  reset(){
    this.phase=0;this.needlePos=0;this.needleDir=1;this.animating=false;
    if(this.raf){cancelAnimationFrame(this.raf);this.raf=null;}
    const n=document.getElementById("puttNeedle");if(n)n.style.left="0%";
    const pvn=document.getElementById("puttValueNum");
    if(pvn){pvn.textContent=`${this.distYd.toFixed(1)}yd (${this.distFt.toFixed(1)}ft)`; pvn.style.color="#00ffcc";}
    const pzh=document.getElementById("puttZoneHint");
    if(pzh){pzh.textContent="⛳ タップでパット開始"; pzh.style.color="#ffd700";}
  }

  start(){
    if(this.phase!==0)return;
    this.phase=1;this.animating=true;this.needlePos=0;this.needleDir=1;
    const pzh=document.getElementById("puttZoneHint");
    if(pzh){pzh.textContent="🏌️ 緑のゾーンで止める！"; pzh.style.color="#00ff88";}
    this._updateUI();
    this.lastTime=performance.now();this._anim();
  }

  _anim(){
    if(!this.animating)return;
    const now=performance.now(),dt=(now-this.lastTime)/1000;this.lastTime=now;
    this.needlePos+=this.needleDir*this.needleSpeed*dt;
    if(this.needlePos>=1){this.needlePos=1;this.needleDir=-1;}
    if(this.needlePos<=0){this.needlePos=0;this.needleDir=1;}
    const n=document.getElementById("puttNeedle");if(n)n.style.left=(this.needlePos*100)+"%";

    // 狙う転がり距離（物理法則基準）
    const targetRollYd = this.needlePos * this.maxRangeYd;
    const targetRollFt = targetRollYd * 3.0;
    const diffYd = targetRollYd - this.distYd;
    const diffSign = diffYd > 0 ? `+${diffYd.toFixed(1)}` : `${diffYd.toFixed(1)}`;

    const pvn=document.getElementById("puttValueNum");
    const pzh=document.getElementById("puttZoneHint");
    const inJustZone = Math.abs(this.needlePos - this.targetPos) <= this.targetRange * 0.5;

    if(pvn){
      pvn.textContent=`${targetRollYd.toFixed(1)}yd (${targetRollFt.toFixed(1)}ft)`;
      pvn.style.color = inJustZone ? "#00ff88" : (this.needlePos > this.targetPos ? "#ff8888" : "#00eeff");
    }
    if(pzh){
      if(inJustZone){
        pzh.textContent=`🎯 ジャスト! (${diffSign}yd)`;
        pzh.style.color="#00ff88";
      }else if(this.needlePos < this.targetPos){
        pzh.textContent=`ショート (${diffSign}yd)`;
        pzh.style.color="#66ddff";
      }else{
        pzh.textContent=`オーバー (${diffSign}yd)`;
        pzh.style.color="#ff8888";
      }
    }

    this.raf=requestAnimationFrame(()=>this._anim());
  }

  stop(){
    if(this.phase!==1)return;
    this.animating=false;
    if(this.raf){cancelAnimationFrame(this.raf);this.raf=null;}

    const targetRollYd = this.needlePos * this.maxRangeYd;
    const diff = Math.abs(this.needlePos - this.targetPos);
    let msg, col;
    if(diff <= this.targetRange * 0.35){
      msg="🌟 PERFECT TOUCH!"; col="#00ff88";
    }else if(diff <= this.targetRange * 0.7){
      msg="✅ NICE PUTT"; col="#00e5ff";
    }else if(this.needlePos < this.targetPos){
      msg="⚠️ SHORT (届かず)"; col="#88ccff";
    }else{
      msg="⚠️ OVER (強すぎ)"; col="#ff7777";
    }

    const pzh=document.getElementById("puttZoneHint");
    if(pzh){pzh.textContent=msg; pzh.style.color=col;}

    // ★ 物理運動方程式で狙った目標転がり距離（yd）を渡す
    this.phase=0;
    this.onPuttReady(targetRollYd);
    setTimeout(()=>this.reset(), 1200);
  }

  onInput(){if(this.phase===0)this.start();else if(this.phase===1)this.stop();}
}


// =============================================
// ===== メインゲームクラス =====
// =============================================
class GolfGame{
  constructor(){
    this.scene=null;this.camera=null;this.renderer=null;
    this.ball=null;this.currentCourse=null;this.currentHoleIdx=0;
    this.currentClubIdx=0;this.aimAngle=0;
    this.camTilt=0; // ★ 縦方向視野チルト（-30〜+40度）
    this.camOrbit=0; // ★ カメラ自由回転オフセット（左右、ボール基準）
    // ★★★ 弾道トレース機能 ★★★
    this.traceEnabled=true;       // トレース表示ON/OFF
    this.traceLines=[];           // 過去ショットの弾道ライン（Line2 mesh配列）
    this.traceMaxHistory=5;       // 保持する弾道数（古いものから消える）
    this._curTracePoints=[];      // 現在飛行中の弾道座標バッファ
    this._curTraceLine=null;      // 現在飛行中の弾道ラインmesh
    this._curTraceMarkers=[];     // 現在ショットの着地点マーカー
    this.scores=[];this.strokes=0;
    this.weather=null;this.character=null;
    this.cameraMode="follow";
    this.rainParticles=null;this.flagMesh=null;this.playerMesh=null;
    this.obZones=[];
    this.clock=new THREE.Clock();
    this.teePos=new THREE.Vector3();this.pinPos=new THREE.Vector3();
    this.terrainH=200;this.terrain=null;this.terrainW=100;
    this.shotCtrl=new ShotController((pw,acc,nsBonus)=>this._executeShot(pw,acc,nsBonus));
    this.puttCtrl=new PuttController((pw)=>this._executePutt(pw));
    this.isOBLocked=false;
    this.gameMode="normal";
    this._brightnessMultiplier=1.0; // ★ 自然でリアルな明るさ基準（白飛び完全解消）
    // ★ リアルスタッツ追跡
    this._stats={
      fir:0,   // フェアウェイキープ数
      firTotal:0,
      gir:0,   // グリーンリーチ数
      girTotal:0,
      putts:[],    // ホール別パット数
      drivingDist:[], // ドライビングディスタンス
      longestDrive:0,
      penalties:0,
    };
    this._holeFirstShot=true;
    this._holeGIRPossible=true;
    this._holePutts=0;
    this.greenOnShown=false;
    this._holeCompletedFlag=false;
    // モバイル判定（一度だけ計算してキャッシュ）
    this.isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.lastSafePos=null; // OB時の復帰位置
    this.greenPos=null;    // グリーン位置・サイズ
    // ===== D-Plane Theory 状態 =====
    // faceAngle: フェース角 -3(クローズ/ドロー) 0(スクエア) +3(オープン/フェード)
    // swingPath: スイングパス -3(アウト→イン/フェード) 0(スクエア) +3(イン→アウト/ドロー)
    // attackAngle: 打ち込み角 -2(ダウンブロー/低) 0(レベル) +2(アッパー/高)
    this.dplane={faceAngle:0, swingPath:0, attackAngle:0};
    // エイム
    this._keysDown={};this._aimDirL=false;this._aimDirR=false;this._aimHoldTime=0;
    // 3Dオブジェクト
    this.aimLineMesh=null;this.aimArrowMesh=null;this.aimDots=[];
    this.targetRingMesh=null;this.carryMarkerMesh=null;this.puttLineMesh=null;
    this.dirArrowMesh=null;   // キャラクター方向大矢印
    this._terrainGen=null;
    this._confettiRaf=null;
    // ★★★ AAAアップグレード：オーディオ・FX・シネマティックカメラ・風フラッグ ★★★
    this.audio = new AudioManager();
    this.fx = null;
    this._camShake = 0;
    this._flagMesh = null;
    this._flagBaseGeo = null;
    this._cinematicNearPin = false;
  }

  init(){
    const canvas=document.getElementById("canvas");
    const isMobile=this.isMobile;
    this.renderer=window.__GOAT_RENDERER__;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,isMobile?1.5:2));
    this.renderer.setSize(window.innerWidth,window.innerHeight);
    // 背景色を明示的に設定（黒画面防止）
    this.renderer.setClearColor(0x4a9fd8,1);
    // モバイルでは影を軽量化
    this.renderer.shadowMap.enabled=!isMobile;
    if(!isMobile)this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.15;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();
    this.fx = new FXManager(this.scene);
    // ユーザーの最初の操作でWeb Audioをアンロック
    const unlockAudio = () => {
      if(this.audio) this.audio.ensureInit();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    this.camera=new THREE.PerspectiveCamera(52,window.innerWidth/window.innerHeight,0.1,2000);
    const onResize=()=>{
      this.renderer.setSize(window.innerWidth,window.innerHeight);
      this.camera.aspect=window.innerWidth/window.innerHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener("resize",onResize);
    // iPhone向け：orientationchange 対応
    window.addEventListener("orientationchange",()=>{setTimeout(onResize,200);});
    this._setupInput();
  }

  // ===== 入力 =====
  _setupInput(){
    const shoot=()=>{
      if(this._holeCompletedFlag){
        this.nextHole();
        return;
      }
      if(this.gameMode==="putt")this.puttCtrl.onInput();
      else this.shotCtrl.onInput();
    };
    this._triggerShootInput = shoot;
    document.getElementById("shootBtn").addEventListener("click",shoot);
    document.getElementById("shootBtn").addEventListener("touchstart",e=>{e.preventDefault();shoot();},{passive:false});
    // ★ メーター領域全体のクリック/タップでも確実にショット発動（押し損ね・位置ズレの完全解消）
    const pmWrap = document.getElementById("powerMeterWrap");
    if(pmWrap){
      pmWrap.addEventListener("click", shoot);
      pmWrap.addEventListener("touchstart", e => { e.preventDefault(); shoot(); }, {passive: false});
    }
    const puttMWrap = document.getElementById("puttMeterWrap");
    if(puttMWrap){
      puttMWrap.addEventListener("click", shoot);
      puttMWrap.addEventListener("touchstart", e => { e.preventDefault(); shoot(); }, {passive: false});
    }
    const btnL=document.getElementById("aimBtnL"),btnR=document.getElementById("aimBtnR");
    const setL=(v)=>{this._aimDirL=v;this._aimHoldTime=0;btnL.classList.toggle("pressing",v);};
    const setR=(v)=>{this._aimDirR=v;this._aimHoldTime=0;btnR.classList.toggle("pressing",v);};
    this._setAimKey=(dir,v)=>{if(dir<0)setL(v);else setR(v);};
    btnL.addEventListener("touchstart",e=>{e.preventDefault();e.stopPropagation();setL(true);},{passive:false});
    btnL.addEventListener("touchend",e=>{e.preventDefault();setL(false);},{passive:false});
    btnL.addEventListener("touchcancel",()=>setL(false));
    btnR.addEventListener("touchstart",e=>{e.preventDefault();e.stopPropagation();setR(true);},{passive:false});
    btnR.addEventListener("touchend",e=>{e.preventDefault();setR(false);},{passive:false});
    btnR.addEventListener("touchcancel",()=>setR(false));
    btnL.addEventListener("mousedown",e=>{e.preventDefault();setL(true);});
    btnR.addEventListener("mousedown",e=>{e.preventDefault();setR(true);});
    document.addEventListener("mouseup",()=>{setL(false);setR(false);});
    document.addEventListener("keydown",e=>{
      if(this._keysDown[e.code])return;this._keysDown[e.code]=true;
      if(e.code==="ArrowLeft")setL(true);if(e.code==="ArrowRight")setR(true);
      if(e.code==="Space"||e.code==="Enter"){e.preventDefault();shoot();}
      if(e.code==="KeyC")this.toggleCamera();
    });
    document.addEventListener("keyup",e=>{
      delete this._keysDown[e.code];
      if(e.code==="ArrowLeft")setL(false);if(e.code==="ArrowRight")setR(false);
    });
    let mouseDownAim=false,lastMX=0,lastMY=0;
    document.addEventListener("mousedown",e=>{if(e.target.closest("#shotUI")||e.target.closest("#holeInfo"))return;mouseDownAim=true;lastMX=e.clientX;lastMY=e.clientY;});
    document.addEventListener("mousemove",e=>{
      if(!mouseDownAim||this._aimDirL||this._aimDirR)return;
      this.aimAngle+=e.movementX*0.5;
      // ★ 縦方向ドラッグ → カメラチルト（視野の上下）
      this.camTilt=Math.max(-25,Math.min(45,this.camTilt-e.movementY*0.3));
      this._onAimChanged();
    });
    document.addEventListener("mouseup",()=>mouseDownAim=false);
    // ★ 右クリックドラッグ：カメラ自由回転（ショット方向に影響しない）
    let rmbDown=false;
    document.addEventListener("contextmenu",e=>{if(e.target.closest("canvas"))e.preventDefault();});
    document.addEventListener("mousedown",e=>{if(e.button===2){rmbDown=true;}});
    document.addEventListener("mousemove",e=>{
      if(!rmbDown)return;
      this.camOrbit=((this.camOrbit||0)+e.movementX*0.4);
      this.camOrbit=((this.camOrbit%360)+360)%360;if(this.camOrbit>180)this.camOrbit-=360;
      this.camTilt=Math.max(-25,Math.min(45,(this.camTilt||0)-e.movementY*0.3));
    });
    document.addEventListener("mouseup",e=>{if(e.button===2)rmbDown=false;});
    // ホイールでもチルト調整可能に
    document.addEventListener("wheel",e=>{
      if(e.target.closest("#shotUI")||e.target.closest("#holeInfo")||e.target.closest("#scoreCard"))return;
      this.camTilt=Math.max(-25,Math.min(45,this.camTilt-e.deltaY*0.02));
    },{passive:true});

    let swipeX=null,swipeY=null;
    let orbitSwipeX=null,orbitSwipeY=null; // 2本指：カメラ自由回転用
    document.addEventListener("touchstart",e=>{
      if(e.target.closest("#shotUI"))return;
      if(e.touches.length===1){swipeX=e.touches[0].clientX;swipeY=e.touches[0].clientY;}
      else if(e.touches.length===2){
        orbitSwipeX=(e.touches[0].clientX+e.touches[1].clientX)/2;
        orbitSwipeY=(e.touches[0].clientY+e.touches[1].clientY)/2;
        swipeX=null;swipeY=null; // 1本指操作はキャンセル
      }
    },{passive:true});
    document.addEventListener("touchmove",e=>{
      if(e.target.closest("#shotUI"))return;
      if(e.touches.length===2&&orbitSwipeX!==null){
        // ★ 2本指ドラッグ：カメラ自由回転（左右）＋チルト（上下）。ショット方向には影響しない
        const mx=(e.touches[0].clientX+e.touches[1].clientX)/2;
        const my=(e.touches[0].clientY+e.touches[1].clientY)/2;
        const odx=mx-orbitSwipeX, ody=my-orbitSwipeY;
        this.camOrbit=((this.camOrbit||0)+odx*0.4);
        this.camOrbit=((this.camOrbit%360)+360)%360;if(this.camOrbit>180)this.camOrbit-=360;
        this.camTilt=Math.max(-25,Math.min(45,(this.camTilt||0)-ody*0.25));
        orbitSwipeX=mx;orbitSwipeY=my;
        return;
      }
      if(!swipeX)return;
      const dx=e.touches[0].clientX-swipeX;
      const dy=e.touches[0].clientY-swipeY;
      this.aimAngle+=dx*0.4;
      // ★ 縦スワイプ → カメラチルト
      this.camTilt=Math.max(-25,Math.min(45,this.camTilt-dy*0.25));
      swipeX=e.touches[0].clientX;swipeY=e.touches[0].clientY;
      this._onAimChanged();
    },{passive:true});
    document.addEventListener("touchend",e=>{
      swipeX=null;swipeY=null;
      if(e.touches.length<2){orbitSwipeX=null;orbitSwipeY=null;}
    });
    document.getElementById("camBtn").addEventListener("click",()=>this.toggleCamera());
    document.getElementById("traceBtn").addEventListener("click",()=>this.toggleTrace());
    // 明るさボタンを表示
    const bbtn=document.getElementById("brightnessBtn");
    if(bbtn)bbtn.style.display="inline-block";
    const wind=document.getElementById("windIndicator");
    if(wind)wind.style.display="block";
    document.getElementById("nextHoleBtn").addEventListener("click",()=>this.nextHole());
    document.getElementById("scoreBtn").addEventListener("click",()=>this.showScoreCard());
    document.getElementById("closeScoreBtn").addEventListener("click",()=>document.getElementById("scoreCard").style.display="none");
  }

  _onAimChanged(){
    // 全モード共通：360度フルサポート（-180〜+180に正規化）
    this.aimAngle=((this.aimAngle%360)+360)%360;
    if(this.aimAngle>180)this.aimAngle-=360;
    this._updatePlayerDir();
    this._updateAimArrow();
    this._updateAimAngleDisplay();
    this._updateTrajDots();
    this._updateDirArrow3D();
    if(this.gameMode==="putt")this._updatePuttLine(true);
  }

  _processAimInput(dt){
    if(!this._aimDirL&&!this._aimDirR){this._aimHoldTime=0;return;}
    this._aimHoldTime+=dt;
    const t=Math.min(this._aimHoldTime,1.0);
    // パット時：精度重視でゆっくり。通常：速め
    const initSpd=this.gameMode==="putt"?18:30;
    const maxSpd =this.gameMode==="putt"?75:150;
    const spd=initSpd+(maxSpd-initSpd)*t*t;
    const dir=this._aimDirL?-1:1;
    this.aimAngle+=dir*spd*dt;
    this._onAimChanged();
  }

  // ===== ショット計算（NS/SNS/UNS ボーナス対応）=====
  _calcShot(power,accuracy,nsBonus){
    const club=CLUBS[this.currentClubIdx];
    const c=this.character;
    const speedMult=(club.type==="driver"||club.type==="wood")?c.driverMult:1.0;
    const bonusMult=1+(nsBonus||0);

    // ===== D-Plane Theory 計算 =====
    const face=this.dplane.faceAngle;   // -3〜+3 (負=クローズ, 正=オープン)
    const path=this.dplane.swingPath;   // -3〜+3 (負=アウトイン, 正=インアウト)
    const atk=this.dplane.attackAngle;  // -2〜+2 (負=ダウンブロー, 正=アッパー)

    // ---- 飛距離補正 ----
    // ダウンブロー(-2)〜アッパー(+2) で飛距離 ±5% 変化
    const distFactor=1+(atk*0.025);
    // ★ ライ別飛距離補正
    const surf=this.getSurf(this.ball.position.x,this.ball.position.z);
    const lieMult=surf==="bunker"?0.45:surf==="rough"?0.78:1.0;
    // バンカーは方向誤差も追加
    const bunkerAngleErr=surf==="bunker"?(Math.random()-0.5)*12:0;
    const totalDist=club.maxDist*(power/100)*speedMult*(this.weather?this.weather.distMult:1)*bonusMult*distFactor*lieMult;
    const carryDist=totalDist*(1-club.runFactor);
    const runDist=totalDist*club.runFactor;

    // ---- D-Plane: 初期方向 = フェース角の75% + パスの25% ----
    // （D-Plane理論：ボールはフェース角に約75-80%依存して飛び出す）
    const initialDir=face*0.75+path*0.25; // 度単位の横ズレ方向

    // ---- スピン軸 = フェース角 - スイングパス（マグナス効果による曲がり）----
    const spinAxis=face-path; // 正=フェード/スライス方向, 負=ドロー/フック方向
    const curvature=spinAxis*(carryDist/100)*0.55; // yd単位の曲がり量

    // ---- 高低 = 打ち込み角 + クラブロフト + アタック角補正 ----
    // アッパーブロー → 打球が高くなる (+attackAngle → peakRatio増加)
    const peakAdj=atk*0.018; // ±0.036 の調整
    const peakRatio=Math.max(0.05,Math.min(0.45, club.peakRatio+peakAdj));

    // ---- ランダムバラつき（accuracy依存）----
    const variance=c.varianceFor(club.type);
    const sideScale=nsBonus>=0.50?0.0:nsBonus>=0.30?0.3:nsBonus>=0.20?0.6:1.0;
    const randomSide=(1-accuracy/100)*variance*carryDist*0.015*(Math.random()>0.5?1:-1)*sideScale;

    // ---- 風の影響（横ズレ + 飛距離変化）★リアル計算 ----
    const aimRad=this.aimAngle*Math.PI/180;
    // ショット方向に対する向かい風・追い風成分
    const windTail=this.weather?(this.weather.windVec.x*Math.sin(aimRad)-this.weather.windVec.z*Math.cos(aimRad)):0;
    // 横風成分
    const windSide=this.weather?(this.weather.windVec.x*Math.cos(-aimRad)-this.weather.windVec.z*Math.sin(-aimRad))*0.65:0;
    // 向かい風はキャリー減少、追い風はキャリー増加（1m/sあたり±1.5yd）
    const windDistAdj=windTail*1.5;

    // ---- 最終横ズレ = 初期方向 + 曲がり + ランダム + 風 ----
    const dirYd=initialDir*(carryDist/57.3)*0.4;
    const sideYd=dirYd+curvature+randomSide+windSide;
    // 向かい風・追い風の飛距離調整を totalDist に適用
    const carryDistFinal=Math.max(10,carryDist+windDistAdj*0.7);
    const runDistFinal=Math.max(0,runDist+windDistAdj*0.3);

    const bunkerSideExtra=bunkerAngleErr*(carryDist/57.3)*0.4;
    return{carryDist:carryDistFinal||carryDist,runDist:runDistFinal||runDist,sideYd:sideYd+bunkerSideExtra,peakRatio,
      spinAxis,
      shotShape:this._getShotShape(face,path,atk)+(surf==="bunker"?" 🏖️バンカー":surf==="rough"?" 🌿ラフ":"")};
  }

  // ショット形状ラベル取得
  _getShotShape(face,path,atk){
    const spin=face-path; // 正=フェード, 負=ドロー
    const mag=Math.abs(spin);
    let shape="";
    if(mag<0.5)shape="ストレート";
    else if(spin<-2.0)shape="🔴 フック";
    else if(spin<-0.5)shape="🟢 ドロー";
    else if(spin>2.0)shape="🔵 スライス";
    else shape="🟡 フェード";
    // 高低
    if(atk<=-1.5)shape="⬇️ 低弾道 "+shape;
    else if(atk>=1.5)shape="⬆️ 高弾道 "+shape;
    return shape;
  }

  // ★★★ 弾道トレース：新ショット開始時にバッファをリセット ★★★
  _traceStart(){
    this._curTracePoints=[];
    if(this._curTraceLine){this.scene.remove(this._curTraceLine);this._disposeObj(this._curTraceLine);this._curTraceLine=null;}
    this._curTraceMarkers.forEach(m=>{this.scene.remove(m);this._disposeObj(m);});
    this._curTraceMarkers=[];
  }

  /* v4.6: オブジェクトの geometry/material を安全に解放する共通ヘルパー（二重解放は three.js 側で無害） */
  _disposeObj(root){
    if(!root) return;
    root.traverse(function(o){
      if(o.geometry){ try{ o.geometry.dispose(); }catch(e){} }
      if(o.material){ const ms=Array.isArray(o.material)?o.material:[o.material]; for(const m of ms){ try{ m.dispose(); }catch(e){} } }
    });
  }

  // ★ 毎フレーム：飛行中のボール座標を記録し、太めのチューブラインで弾道を描画
  _traceUpdate(){
    if(!this.traceEnabled||!this.ball||!this.ball.inFlight)return;
    const p=this.ball.position;
    // 一定距離以上移動した時のみ記録（点数を抑えて軽量化）
    const last=this._curTracePoints[this._curTracePoints.length-1];
    if(last&&last.distanceTo(p)<0.15)return;
    this._curTracePoints.push(new THREE.Vector3(p.x,p.y,p.z));
    if(this._curTracePoints.length<3)return;
    if(this._curTraceLine){this.scene.remove(this._curTraceLine);if(this._curTraceLine.type==='Group'){this._curTraceLine.children.forEach(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});}else if(this._curTraceLine.geometry){this._curTraceLine.geometry.dispose();if(this._curTraceLine.material){try{this._curTraceLine.material.dispose();}catch(e){}}}} /* v4.14: Lineフォールバック時もマテリアルを解放（従来はgeometryのみでLineBasicMaterialが飛行フレーム数だけ漏れていた） */
    // フェーズ別カラー：キャリー=黄、ラン=緑、パット=水色
    const col=this.ball.phase==="putt_roll"?0x44ddff:this.ball.phase==="run"?0x66ff66:0xffdd33;
    try{
      // ★★★ PGA Tour Toptracer 仕様：発光コア＋ネオングローの二重弾道チューブ ★★★
      const curve=new THREE.CatmullRomCurve3(this._curTracePoints);
      const segs = Math.min(72, this._curTracePoints.length * 2);
      // 外側グロー
      const glowGeo = new THREE.TubeGeometry(curve, segs, 0.08, 6, false);
      const glowCol = this.ball.phase==="putt_roll"?0x00ccff:this.ball.phase==="run"?0x33ff66:0xffaa00;
      const glowMat = new THREE.MeshBasicMaterial({color:glowCol, transparent:true, opacity:0.65});
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      // 内側コア（純白）
      const coreGeo = new THREE.TubeGeometry(curve, segs, 0.035, 6, false);
      const coreMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.95});
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      const traceGroup = new THREE.Group();
      traceGroup.add(glowMesh); traceGroup.add(coreMesh);
      this._curTraceLine = traceGroup;
      this.scene.add(this._curTraceLine);
    }catch(e){
      // 点が極端に近い等でTubeGeometry失敗時はLineにフォールバック
      const geo=new THREE.BufferGeometry().setFromPoints(this._curTracePoints);
      const mat=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.88});
      this._curTraceLine=new THREE.Line(geo,mat);
      this.scene.add(this._curTraceLine);
    }
  }

  // ★ ショット完了時：現在の弾道を履歴に固定保存し、着地マーカーを設置
  _traceFinalize(landedPos,surf){
    if(!this.traceEnabled)return;
    if(this._curTracePoints.length>=3){
      try{
        const curve=new THREE.CatmullRomCurve3(this._curTracePoints);
        const tubeGeo=new THREE.TubeGeometry(curve,Math.min(80,this._curTracePoints.length*2),0.035,5,false);
        const tubeMat=new THREE.MeshBasicMaterial({color:0xffcc00,transparent:true,opacity:0.5});
        const finalLine=new THREE.Mesh(tubeGeo,tubeMat);
        this.scene.add(finalLine);
        this.traceLines.push(finalLine);
      }catch(e){
        const geo=new THREE.BufferGeometry().setFromPoints(this._curTracePoints);
        const mat=new THREE.LineBasicMaterial({color:0xffcc00,transparent:true,opacity:0.55});
        const finalLine=new THREE.Line(geo,mat);
        this.scene.add(finalLine);
        this.traceLines.push(finalLine);
      }
      // 履歴上限：古いものから除去
      while(this.traceLines.length>this.traceMaxHistory){
        const old=this.traceLines.shift();
        this.scene.remove(old);
        this._disposeObj(old); /* v4.6: 溢れた旧弾道の GPU バッファも解放 */
      }
    }
    // 現在描画中のライブラインは削除（finalLineに置き換わったため）
    if(this._curTraceLine){this.scene.remove(this._curTraceLine);this._disposeObj(this._curTraceLine);this._curTraceLine=null;} /* v4.6: 解放追加 */
    this._curTracePoints=[];
    // 着地点マーカー（小さな旗ピン風マーク・リング状）
    if(landedPos){
      const markGeo=new THREE.RingGeometry(0.35,0.55,16);
      const markMat=new THREE.MeshBasicMaterial({
        color:surf==="bunker"?0xffaa00:surf==="rough"?0x66ff66:surf==="green"?0x44ddff:0xffdd33,
        transparent:true,opacity:0.75,side:THREE.DoubleSide
      });
      const mark=new THREE.Mesh(markGeo,markMat);
      mark.rotation.x=-Math.PI/2;
      mark.position.set(landedPos.x,landedPos.y+0.04,landedPos.z);
      this.scene.add(mark);
      this._curTraceMarkers.push(mark);
      // マーカー履歴上限（弾道ラインと同期して保持数を管理）
      while(this._curTraceMarkers.length>this.traceMaxHistory){
        const oldMark=this._curTraceMarkers.shift();
        this.scene.remove(oldMark);
        this._disposeObj(oldMark); /* v4.6: 解放追加 */
      }
    }
  }

  // ★ 全弾道トレースをクリア（新ホール開始時等）
  _traceClearAll(){
    this.traceLines.forEach(l=>{this.scene.remove(l);this._disposeObj(l);}); /* v4.6: 解放追加 */
    this.traceLines=[];
    this._curTraceMarkers.forEach(m=>{this.scene.remove(m);this._disposeObj(m);}); /* v4.6: 解放追加 */
    this._curTraceMarkers=[];
    if(this._curTraceLine){this.scene.remove(this._curTraceLine);this._disposeObj(this._curTraceLine);this._curTraceLine=null;} /* v4.6: 解放追加 */
    this._curTracePoints=[];
  }

  // ★ トレース表示のON/OFF切り替え
  toggleTrace(){
    this.traceEnabled=!this.traceEnabled;
    if(!this.traceEnabled)this._traceClearAll();
    const btn=document.getElementById("traceBtn");
    if(btn)btn.textContent=this.traceEnabled?"📈 TRACE":"📈 OFF";
    if(btn)btn.style.opacity=this.traceEnabled?"1":"0.5";
  }

  _executeShot(power,accuracy,nsBonus){
    if(!this.ball||this.ball.inFlight)return;
    nsBonus=nsBonus||0;
    this.lastSafePos=this.ball.position.clone();
    const {carryDist,runDist,sideYd,peakRatio,shotShape}=this._calcShot(power,accuracy,nsBonus);
    const aimRad=this.aimAngle*Math.PI/180;
    this._hideAimViz();
    this._traceStart(); // ★ 弾道トレース開始
    this.ball.onLanded=(surf,pos)=>this._onLanded(surf,pos);
    this.ball.onStopped=(pos,surf)=>this._onStopped(pos,surf);
    this.ball.shoot(this.ball.position.clone(),carryDist,runDist,aimRad,sideYd,peakRatio,(x,z)=>this.getGY(x,z),{spinAxis:this.dplane.faceAngle-this.dplane.swingPath});
    this.strokes++;this._updateHUDStrokes();
    // ★ ドライビングディスタンス記録
    if(this._holeFirstShot&&CLUBS[this.currentClubIdx]&&(CLUBS[this.currentClubIdx].type==="driver")){
      this._firstShotDist=carryDist+runDist;
      this._firstShotSide=Math.abs(sideYd);
    }
    this._holeFirstShot=false;
    document.getElementById("flightBar").style.display="block";
    this._swingAnim();
    this._haptic(nsBonus>=0.50?"success":nsBonus>=0.20?"medium":"light");
    // ★★★ AAAインパクト演出：迫真サウンド、カメラシェイク、スパーク、フラッシュ ★★★
    if(this.audio){
      const club = CLUBS[this.currentClubIdx];
      const isPerf = nsBonus >= 0.20;
      this.audio.playImpact(club ? club.type : "driver", power, isPerf);
    }
    if(nsBonus >= 0.20){
      if(this.fx){
        this.fx.createImpactSparks(this.ball.position);
        this.fx.triggerScreenFlash();
      }
      this._camShake = nsBonus >= 0.50 ? 0.6 : 0.35;
      if(this.audio) this.audio.playCrowd("cheer");
    }
    // ショット形状をポップアップ表示（D-Plane結果）
    const shapeEl=document.getElementById("dplaneShotShape");
    if(shapeEl&&shotShape&&shotShape!=="ストレート"){
      shapeEl.textContent=shotShape;shapeEl.style.display="block";
      setTimeout(()=>shapeEl.style.display="none",2000);
    }else if(shapeEl)shapeEl.style.display="none";
    // ナイスショットポップアップ
    if(nsBonus>0){
      const label=nsBonus>=0.50?"🌟 ULTRA NICE SHOT +50%":nsBonus>=0.30?"⭐ SUPER NICE SHOT +30%":"✨ NICE SHOT +20%";
      const col=nsBonus>=0.50?"#ff88ff":nsBonus>=0.30?"#ffdd00":"#00ff88";
      this._showNiceShotPopup(label,col);
    }
  }

  _executePutt(targetRollYd){
    if(!this.ball||this.ball.inFlight)return;

    // 芝質による転がり抵抗
    const surf = this.getSurf(this.ball.position.x, this.ball.position.z);
    const surfDecay = surf === "rough" ? 2.4 : surf === "fairway" ? 1.9 : 1.6;

    // ★ 物理運動方程式: v0 = sqrt(2 * a * L)
    // 狙った targetRollYd でピタリと停止・カップインする初速を厳密計算！
    const targetL = typeof targetRollYd === "number" ? Math.max(0.2, targetRollYd) : this._distToPin();
    const speedYdPerSec = Math.sqrt(2 * surfDecay * targetL);

    const aimRad = this.aimAngle * Math.PI / 180;
    this._hideAimViz();
    this._traceStart();
    this.ball.onStopped = (pos, surf) => this._onStopped(pos, surf);
    const _greenSlope = this._getGreenSlope();

    this.ball.putt(this.ball.position.clone(), speedYdPerSec, aimRad, _greenSlope, surfDecay);
    this.strokes++; this._holePutts++; this._updateHUDStrokes();
    this._swingAnim();
    this._haptic("light");
    if(this.audio) this.audio.playImpact("putter", 0.7, false);
  }


  // ★ グリーン傾斜ベクター取得（急斜面での暴走を防止するクランプ付き）
  _getGreenSlope(){
    if(!this._terrainGen||!this.ball||!this.pinPos)return new THREE.Vector2(0,0);
    const p=this.ball.position;
    const d=0.8;
    const hL=this.getGY(p.x-d,p.z);
    const hR=this.getGY(p.x+d,p.z);
    const hF=this.getGY(p.x,p.z-d);
    const hB=this.getGY(p.x,p.z+d);
    const rawX=(hR-hL)/(2*d);
    const rawZ=(hB-hF)/(2*d);
    const clampX=Math.max(-0.15, Math.min(0.15, rawX));
    const clampZ=Math.max(-0.15, Math.min(0.15, rawZ));
    return new THREE.Vector2(clampX*1.2, clampZ*1.2);
  }


  _hideAimViz(){
    if(this.aimLineMesh)this.aimLineMesh.visible=false;
    if(this.aimArrowMesh)this.aimArrowMesh.visible=false;
    if(this.dirArrowMesh)this.dirArrowMesh.visible=false;
    if(this.pinGuideMesh)this.pinGuideMesh.visible=false;
    this.aimDots.forEach(d=>d.visible=false);
    if(this.targetRingMesh)this.targetRingMesh.visible=false;
    if(this.carryMarkerMesh)this.carryMarkerMesh.visible=false;
    if(this.puttLineMesh)this.puttLineMesh.visible=false;
  }
  _showAimViz(){
    if(this.aimLineMesh)this.aimLineMesh.visible=true;
    if(this.aimArrowMesh)this.aimArrowMesh.visible=true;
    if(this.dirArrowMesh)this.dirArrowMesh.visible=true;
    if(this.pinGuideMesh)this.pinGuideMesh.visible=true;
    if(this.targetRingMesh&&this.gameMode!=="putt")this.targetRingMesh.visible=true;
    if(this.carryMarkerMesh&&this.gameMode!=="putt")this.carryMarkerMesh.visible=true;
    if(this.puttLineMesh&&this.gameMode==="putt")this.puttLineMesh.visible=true;
  }

  _onLanded(surf,pos){
    // ★★★ AAA着弾演出：サーフェス別サウンド（芝・砂・水）＆物理パーティクル飛び散り ★★★
    if(this.audio) this.audio.playLanded(surf);
    if(this.fx) this.fx.createDivot(pos, surf);
    if(surf==="green"&&!this.greenOnShown){
      this.greenOnShown=true;this._showGreenOn();
    }
  }
  _onStopped(pos,surf){
    const finalDist = this._distToPin();
    // ★★★ ベタピン大歓声（ピンから5yd以内ならギャラリー大歓声） ★★★
    if(finalDist <= 5.0 && this.strokes > 0 && surf !== "water"){
      if(this.audio) this.audio.playCrowd("roar");
      if(this.fx) this.fx.showBroadcastBanner("🌟 BRILLIANT APPROACH!", finalDist.toFixed(1) + "yd to Pin!");
    } else if(finalDist <= 12.0 && this.strokes > 0 && surf !== "water"){
      if(this.audio) this.audio.playCrowd("cheer");
      if(this.fx) this.fx.showBroadcastBanner("✨ GREAT ON!", finalDist.toFixed(1) + "yd");
    }
    const groundY = this.getGY(pos.x, pos.z);
    pos.y = groundY + 0.04; // ボールが地面に埋まるのを完全防止（芝生の上に正確に静止）
    this.ball.position.copy(pos);
    if(this.ball.mesh) this.ball.mesh.position.copy(pos);
    if(this.playerMesh){this.playerMesh.position.set(pos.x, groundY, pos.z);}
    this._traceFinalize(pos,surf); // ★ 弾道トレース確定・着地マーカー設置
    // ★ ライ状況表示
    const lieEl=document.getElementById("lieAlert");
    if(lieEl){
      if(surf==="bunker"){
        lieEl.textContent="⛱️ バンカー — 飛距離-60% 方向不安定";
        lieEl.style.color="#ffaa00";lieEl.style.borderLeft="3px solid #ffaa00";
        lieEl.style.display="block";
        setTimeout(()=>lieEl.style.display="none",3000);
      }else if(surf==="rough"){
        lieEl.textContent="🌿 ラフ — 飛距離-20% ラン-60%";
        lieEl.style.color="#66ff66";lieEl.style.borderLeft="3px solid #44cc44";
        lieEl.style.display="block";
        setTimeout(()=>lieEl.style.display="none",2500);
      }else{
        lieEl.style.display="none";
      }
    }
    this._showAimViz();
    this._detectMode();
    // ★ 停止後、残り距離に最適なクラブを自動選択
    if(this.gameMode!=="putt"){
      this._autoSelectClub(this._distToPin());
    }
    // ★ 停止後、ピン方向に自動エイム
    this._resetAimToPin();
    document.getElementById("flightBar").style.display="none";
    setTimeout(()=>this._checkHoleComplete(),80);
  }
  _showGreenOn(){
    // ★ グリーン傾斜矢印を表示
    setTimeout(()=>this._buildSlopeArrows(),300);
    const slLeg=document.getElementById("slopeLegend");
    if(slLeg){slLeg.style.display="block";setTimeout(()=>slLeg.style.display="none",8000);}
    const el=document.getElementById("greenOnPopup");
    if(!el)return;
    const charName=this.character?this.character.realName||this.character.name:"";
    el.innerHTML="🟢 グリーンオン！"+(charName?"<div style='font-size:0.9rem;margin-top:4px;color:#aaffcc'>"+charName+"</div>":"");
    el.style.display="block";el.style.animation="none";
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      el.style.cssText+=";-webkit-animation:greenOnAnim 0.5s ease-out;animation:greenOnAnim 0.5s ease-out";
    }));
    setTimeout(()=>el.style.display="none",2800);
    this._haptic("medium");
  }

  // ★ ナイスショット結果ポップアップ
  _showNiceShotPopup(label,col){
    const el=document.getElementById("niceShotPopup");
    if(!el)return;
    el.textContent=label;
    el.style.color=col||"#ffffff";
    el.style.display="block";
    el.style.animation="none";
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      el.style.animation="nicePop 0.4s ease-out forwards";
    }));
    setTimeout(()=>{el.style.display="none";},2200);
  }

  _updatePlayerDir(){
    if(!this.playerMesh)return;
    // aimAngle は世界座標絶対角度（度）
    // Three.js Y軸回転：rotation.y = aimAngle(rad) でそのまま適用
    this.playerMesh.rotation.y=this.aimAngle*Math.PI/180;
  }

  // ホール開始・ボール停止時にaimAngleをピン方向に自動リセット
  _resetAimToPin(){
    if(!this.ball||!this.pinPos)return;
    const dx=this.pinPos.x-this.ball.position.x;
    const dz=this.pinPos.z-this.ball.position.z;
    // atan2(dx, -dz): Three.jsのY軸回転と合わせた方向計算
    this.aimAngle=Math.atan2(dx,-dz)*180/Math.PI;
    this._onAimChanged();
  }

  _swingAnim(){
    if(!this.playerMesh||!this.playerJoints)return;
    const J=this.playerJoints;
    this._swinging=true;
    let t=0;
    const easeIO=x=>x<0.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
    const clamp01=x=>Math.max(0,Math.min(1,x));
    const swingAngle=u=>{
      if(u<0.42) return easeIO(u/0.42);                    /* テイクバック〜トップ */
      if(u<0.52) return 1.0;                               /* トップのタメ */
      if(u<0.66) { const k=(u-0.52)/0.14; return 1.0-k*k; }/* ダウンスイング */
      if(u<0.90) { const k=(u-0.66)/0.24; return -easeIO(k); } /* フォロー */
      return -1.0;                                         /* フィニッシュ静止 */
    };
    const anim=()=>{
      t+=0.14;
      const u=Math.min(1,t/(Math.PI*2));
      const A=swingAngle(u);
      const Ap=swingAngle(Math.min(1,u+0.05)); /* 骨盤は先行回転（運動連鎖） */
      J.hips.rotation.y=-Ap*0.55;
      J.torso.rotation.y=-A*1.05;
      J.head.rotation.y=A*0.72;
      J.head.rotation.x=0.16+Math.max(0,-A)*0.1;
      const lift=-A*1.85;
      J.shoulderR.rotation.x=J.addr.shR[0]+lift;
      J.shoulderL.rotation.x=J.addr.shL[0]+lift*0.94;
      J.shoulderR.rotation.z=J.addr.shR[2]-A*0.22;
      J.shoulderL.rotation.z=J.addr.shL[2]-A*0.18;
      const cock=0.22+Math.max(0,A)*1.05+Math.max(0,-A)*0.35;
      J.elbowR.rotation.x=J.addr.elR-cock;
      J.elbowL.rotation.x=J.addr.elL-cock*0.8;
      const lag=(u>0.52&&u<0.70)?Math.sin((u-0.52)/0.18*Math.PI)*0.5:0; /* クラブの遅れ（タメ） */
      J.club.rotation.z=J.addr.club[2]-A*0.55+lag;
      J.club.rotation.x=J.addr.club[0]-Math.max(0,A)*0.3;
      J.legs.L.knee.rotation.x=0.10+Math.abs(A)*0.10;
      J.legs.R.knee.rotation.x=0.10+Math.abs(A)*0.06;
      J.hips.position.x=-A*0.05;
      this.playerMesh.rotation.z=A*0.05;
      if(t<Math.PI*2){requestAnimationFrame(anim);}
      else{
        this._swinging=false;
        J.hips.rotation.y=0; J.torso.rotation.y=0; J.head.rotation.y=0; J.head.rotation.x=0.16;
        J.shoulderR.rotation.set(J.addr.shR[0],0,J.addr.shR[2]);
        J.shoulderL.rotation.set(J.addr.shL[0],0,J.addr.shL[2]);
        J.elbowR.rotation.x=J.addr.elR; J.elbowL.rotation.x=J.addr.elL;
        J.club.rotation.set(J.addr.club[0],0,J.addr.club[2]);
        J.hips.position.x=0; this.playerMesh.rotation.z=0;
      }
    };
    anim();
  }

  // ===== モード切替 =====
  _detectMode(){
    if(!this.ball||this.ball.inFlight)return;
    const onGreen=this.getSurf(this.ball.position.x,this.ball.position.z)==="green";
    const dist=this._distToPin();
    let m=onGreen?"putt":(dist<55?"approach":"normal");
    if(m!==this.gameMode){this.gameMode=m;this._applyMode();}
  }

  _applyMode(isManual = false){
    const badge=document.getElementById("modeBadge");
    const shootBtn=document.getElementById("shootBtn");
    const pw=document.getElementById("powerMeterWrap");
    const puttW=document.getElementById("puttMeterWrap");
    const puttHint=document.getElementById("puttLineHint");
    const dplPanel=document.getElementById("dplanePanel");
    const btnL=document.getElementById("aimBtnL"),btnR=document.getElementById("aimBtnR");
    if(this.gameMode==="putt"){
      badge.textContent="🏌️ パット";badge.className="putt";badge.style.display="block";
      shootBtn.textContent="⛳ PUTT";shootBtn.className="putt-mode";
      btnL.classList.add("putt-mode");btnR.classList.add("putt-mode");
      pw.style.display="none";puttW.style.display="flex";
      if(puttHint)puttHint.style.display="block";
      if(dplPanel)dplPanel.style.display="none";
      const de=document.getElementById("holeDescHUD"); if(de) de.style.display="none";
      if(!isManual) {
        this.currentClubIdx=CLUBS.length-1;this._highlightClub();
      }
      const distYd=this._distToPin();
      this.puttCtrl.setTargetFromDist(distYd);
      this.puttCtrl.reset();
      this._resetAimToPin();
    }else if(this.gameMode==="approach"){
      badge.textContent="🎯 アプローチ";badge.className="approach";badge.style.display="block";
      shootBtn.textContent="🎯 SHOT";shootBtn.className="";
      btnL.classList.remove("putt-mode");btnR.classList.remove("putt-mode");
      pw.style.display="block";puttW.style.display="none";
      if(puttHint)puttHint.style.display="none";
      if(dplPanel)dplPanel.style.display="block";
      if(!isManual) {
        this._autoSelectClub(this._distToPin());
      }
      this.shotCtrl.reset();
    }else{
      badge.style.display="none";shootBtn.textContent="🏌️ SHOT";shootBtn.className="";
      btnL.classList.remove("putt-mode");btnR.classList.remove("putt-mode");
      pw.style.display="block";puttW.style.display="none";
      if(puttHint)puttHint.style.display="none";
      if(dplPanel)dplPanel.style.display="block";
      if(!isManual) {
        this._autoSelectClub(this._distToPin());
      }
      this.shotCtrl.reset();
    }
    this._updateTrajDots();
    this._updateDistPanel();
  }


  _distToPin(){
    if(!this.ball||!this.pinPos)return 9999;
    return Math.sqrt((this.ball.position.x-this.pinPos.x)**2+(this.ball.position.z-this.pinPos.z)**2);
  }
  changeClub(delta){
    const maxIdx = CLUBS.length - 1; // ★ パター（PT）も含めて全クラブを自由に選択可能！
    let newIdx = this.currentClubIdx + delta;
    if(newIdx < 0) newIdx = maxIdx;
    if(newIdx > maxIdx) newIdx = 0;
    this.currentClubIdx = newIdx;
    this._highlightClub();

    // ★ クラブがパターになったらパター操作に即座に切り替え（テキサスウェッジ対応）
    const isPutter = CLUBS[this.currentClubIdx].type === "putter";
    if(isPutter){
      this._setManualMode("putt");
    } else {
      // パター以外（ウェッジやアイアン）なら通常ショット操作に戻す
      const dist = this._distToPin();
      this._setManualMode(dist < 55 ? "approach" : "normal");
    }

    this._updateAimArrow();
    this._updateTrajDots();
    this._updateDistPanel();
  }

  _setManualMode(mode){
    this.gameMode = mode;
    this._applyMode(true);
  }

  _highlightClub(){
    const nameEl = document.getElementById("compactClubName");
    const distEl = document.getElementById("compactClubDist");
    const clubBox = document.getElementById("compactClubBox");
    const currentClub = CLUBS[this.currentClubIdx];
    const gm = this._getGoatDistMult ? this._getGoatDistMult() : 1.0;
    if(nameEl && currentClub) nameEl.textContent = currentClub.name;
    if(distEl && currentClub) distEl.textContent = Math.round(currentClub.maxDist * gm) + "yd";
    if(clubBox && currentClub){
      clubBox.classList.toggle("putt-active", currentClub.type === "putter");
    }
    document.querySelectorAll(".club-btn").forEach((b,i)=>{
      b.classList.toggle("active",i===this.currentClubIdx);
      if(i===this.currentClubIdx){
        try{b.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});}
        catch(e){try{b.scrollIntoView(false);}catch(e2){}}
      }
    });
    const club=CLUBS[this.currentClubIdx];
    if(club&&this.shotCtrl){
      const c=this.character;
      const sm=(club.type==="driver"||club.type==="wood")&&c?c.driverMult:1.0;
      const wm=this.weather?this.weather.distMult:1.0;
      this.shotCtrl.clubMaxDist=Math.round(club.maxDist*sm*wm*gm);
    }
  }


  // ===== ホール読み込み =====
  loadHole(course,idx){
    this.currentCourse = course || this.currentCourse;
    this.currentHoleIdx = idx;
    this.camOrbit=0;this.camTilt=0; // ★ ホール開始時にカメラリセット
    this.traceLines=[];this._curTraceLine=null;this._curTracePoints=[];this._curTraceMarkers=[]; // ★ 弾道トレース履歴クリア（シーン自体がリセットされるため配列のみクリア）
    // カメラ操作ヒントを表示（5秒）
    const ch=document.getElementById("camHint");
    if(ch){ch.style.display="block";clearTimeout(this._camHintTimer);this._camHintTimer=setTimeout(()=>{ch.style.display="none";},5000);}
    /* v4.6: 前ホールの全オブジェクトを外す際に geometry/material も明示解放する。
       従来は remove のみで、地形・林(InstancedMesh)・空・HQ差替マテリアルがホールを跨いで
       GPU/ヒープに残留していた（3ホール制の最終戦で最も蓄積する）。テクスチャは共有資産のため解放しない。 */
    while(this.scene.children.length>0){
      const _old=this.scene.children[0];
      this.scene.remove(_old);
      _old.traverse(function(o){
        if(o.geometry){ try{ o.geometry.dispose(); }catch(e){} }
        if(o.material){ const _ms=Array.isArray(o.material)?o.material:[o.material]; for(const _m of _ms){ try{ _m.dispose(); }catch(e){} /* v4.14: シャツ用CanvasTexture（ホール毎に1枚生成）もここで解放。共有のファイルテクスチャはCanvasTextureではないため対象外 */ for(const _slot of ['map','normalMap','roughnessMap','emissiveMap']){ const _tx=_m[_slot]; if(_tx && _tx.isCanvasTexture){ try{ _tx.dispose(); }catch(e2){} } } } }
        if(o.isInstancedMesh && o.dispose){ try{ o.dispose(); }catch(e){} }
      });
    }
    if(this.fx){ this.fx.particles.length=0; this.fx.rings.length=0; } /* FX の対象メッシュは上記で解放済みのため参照だけを空にする */
    this.obZones=[];this.rainParticles=null;
    this.aimLineMesh=null;this.aimArrowMesh=null;this.aimDots=[];
    this.targetRingMesh=null;this.carryMarkerMesh=null;this.puttLineMesh=null;
    this.dirArrowMesh=null;this.pinGuideMesh=null;this.clubMesh=null;this.ballShadowMesh=null;
    this.greenPos=null;
    this.trailMeshes=null;this.trailPositions=null;
    const hole=course.holes[idx];
    if(!hole){console.warn("loadHole: hole["+idx+"] undefined");return;}
    this.terrainH=hole.yards;
    // ★ コースプロファイルに合わせたTerrainGen設定
    const tg=new TerrainGen(this.terrainW,this.terrainH);
    const cp2=course.terrainProfile||"flat";
    if(cp2==="hilly"||cp2==="gentle_hilly"){
      tg.amplitude=cp2==="hilly"?4.5:2.8; tg.freq=0.022;
    }else if(cp2==="links"){
      tg.amplitude=1.8; tg.freq=0.015;
    }else if(cp2==="coastal"){
      tg.amplitude=2.2; tg.freq=0.018;
    }else{
      tg.amplitude=1.2; tg.freq=0.012;
    }
    this._terrainGen=tg;
    this._buildSky(course);
    this._buildLighting(); // ★ ホールごとに全ライトを確実に初期化・追加！
    if(this.weather.type==="fog"){
      const sv=(course&&course.skyVariant)||"";
      const fogCol=(sv==="yomi_dusk"||sv==="amaterasu_eclipse")?0x2e2042:0x9ab4a4;
      this.scene.fog=new THREE.FogExp2(fogCol,0.0018);
    }
    else if(this.weather.type==="rain")this.scene.fog=new THREE.Fog(0x2a3a45,60,420);
    else if(this.weather.type==="strongWind")this.scene.fog=new THREE.Fog(0x8aaabb,200,700);
    else this.scene.fog=new THREE.Fog(0x88c0d8,320,900);
    this._buildTerrain(hole,course);
    this._buildPin();this._buildPlayer();this._buildBallMesh();
    this._buildCourseLandmark(course);
    this._hqUpgradeGround();
    try{ this._hqCourseDress(); }catch(e){}
    if(this.weather.rainIntensity>0)this._buildRain();
    this._buildAimViz();
    this.camera.position.set(this.teePos.x,this.teePos.y+10,this.teePos.z+22);
    this.camera.lookAt(this.pinPos);
    this._updateHoleUI(hole);this._updateWeatherUI();
    this.strokes=0;this._updateHUDStrokes();
    this._autoSelectClub(hole.yards);
    this.isOBLocked=false;this.greenOnShown=false;
    this._holeCompletedFlag=false;
    // ★ ホール別スタッツリセット
    this._holeFirstShot=true;
    this._holePutts=0;
    this._holeGIRPossible=true;
    if(this._slopeArrows&&this.scene){this._slopeArrows.forEach(a=>this.scene.remove(a));this._slopeArrows=[];}
    // D-Planeはホール間でリセットしない（プレイヤーの設定を維持）
    this.gameMode="normal";this._applyMode();
    // ★ ボール位置確定後にピン方向へ自動エイム
    this.ball.position.copy(this.teePos);
    if(this.ball.mesh)this.ball.mesh.position.copy(this.teePos);
    this._resetAimToPin();
    this.shotCtrl.reset();this.puttCtrl.reset();
  }

  _buildLighting(){
    const w=this.weather;
    const mob=this.isMobile;
    const bm=this._brightnessMultiplier||1.5;
    this._allLights=[];

    const isSunny=w.type==="sunny";
    const isWind=w.type==="strongWind";
    const isRain=w.type==="rain";
    const isFog=w.type==="fog";

    // ① アンビエント（自然で目に優しい光量・白飛び防止）
    const ambBase=(isRain?0.50:isFog?0.58:0.68)*Math.PI;
    const amb=new THREE.AmbientLight(0xf4f8f4,ambBase*bm);
    this.scene.add(amb);
    this._allLights.push({light:amb,base:ambBase});

    // ② 天空ヘミスフェアライト（青空と芝生の上品な陰影）
    const hSky=isRain?0x4a5a7a:isFog?0x8a9aa0:isSunny?0x68b0e8:0x60a0d8;
    const hGnd=isRain?0x1a2a0a:0x204814;
    const hBase=(isRain?0.35:isFog?0.40:0.52)*Math.PI;
    const hemi=new THREE.HemisphereLight(hSky,hGnd,hBase*bm);
    this.scene.add(hemi);
    this._allLights.push({light:hemi,base:hBase});

    // ③ メイン太陽光（自然でクッキリした美しい陰影）
    const sunCol=isSunny?0xfffaee:isWind?0xfff4e0:isRain?0x9aa8bb:isFog?0xbbaacc:0xfff6e4;
    const sunBase=(isSunny?1.15:isWind?1.05:isRain?0.65:isFog?0.70:0.95)*Math.PI;
    const sun=new THREE.DirectionalLight(sunCol,sunBase*bm);
    const holeLen = this.terrainH || 400;
    const midZ = -holeLen * 0.5;
    sun.position.set(120, 240, midZ + 80);
    sun.target.position.set(0, 0, midZ);
    this.scene.add(sun.target);
    if(!mob){
      sun.castShadow=true;
      sun.shadow.mapSize.width=2048;sun.shadow.mapSize.height=2048;
      sun.shadow.camera.near=10;
      sun.shadow.camera.far=1400;
      const shadowW = Math.max(180, this.terrainW * 2.2);
      const shadowH = Math.max(300, holeLen * 0.75);
      sun.shadow.camera.left=-shadowW;sun.shadow.camera.right=shadowW;
      sun.shadow.camera.top=shadowH;sun.shadow.camera.bottom=-shadowH;
      sun.shadow.bias=-0.0002;
      sun.shadow.normalBias=0.03;
    }
    this.scene.add(sun);
    this.sunLight = sun;
    this._allLights.push({light:sun,base:sunBase});

    // ④ フィルライト（影のコントラストを優しく保持）
    const fillBase=(isRain?0.30:isFog?0.28:0.35)*Math.PI;
    const fill=new THREE.DirectionalLight(isRain?0x8899cc:0xb8d0e8,fillBase*bm);
    fill.position.set(-60,50,40);
    this.scene.add(fill);
    this._allLights.push({light:fill,base:fillBase});

    // ⑤ 後方補助
    const backBase=(isRain?0.18:0.24)*Math.PI;
    const back=new THREE.DirectionalLight(0x90a8b4,backBase*bm);
    back.position.set(0,30,90);
    this.scene.add(back);
    this._allLights.push({light:back,base:backBase});

    // ⑥ 地面反射光
    const gndBase=(isRain?0.12:0.18)*Math.PI;
    const gnd=new THREE.DirectionalLight(0x3a7028,gndBase*bm);
    gnd.position.set(0,-20,0);
    this.scene.add(gnd);
    this._allLights.push({light:gnd,base:gndBase});

    // ⑦ 晴天時の環境光ポイント
    if(isSunny&&!mob){
      const skyFill=new THREE.DirectionalLight(0x5588ee,0.15*Math.PI*bm);
      skyFill.position.set(0,200,0);
      this.scene.add(skyFill);
      this._allLights.push({light:skyFill,base:0.15*Math.PI});
    }

    if(this.renderer)this.renderer.toneMappingExposure=Math.max(0.75,bm*0.92);
  }
  _buildSky(courseArg){
    const w=this.weather;
    const course=courseArg||this.currentCourse||{};
    const prof=course.terrainProfile||"";
    const isCoastal=prof==="coastal";
    const isLinks=prof==="links";

    // ★ 天候・コース別スカイカラー
    let skyTop, skyHorizon, skyGround;
    if(w.type==="rain"){
      skyTop=0x1a1e2a; skyHorizon=0x2a303c; skyGround=0x1a1e14;
    } else if(w.type==="fog"){
      skyTop=0x8a9a8a; skyHorizon=0xaabaa8; skyGround=0x3a4a2a;
    } else if(w.type==="strongWind"){
      skyTop=0x2a4a7a; skyHorizon=0x6a8aaa; skyGround=0x2a3a1a;
    } else if(isCoastal){
      skyTop=0x1a50a0; skyHorizon=0x5090d0; skyGround=0x284a20;
    } else if(isLinks){
      skyTop=0x2a5a8a; skyHorizon=0x7aaac0; skyGround=0x3a4818;
    } else {
      skyTop=0x1a4a8a; skyHorizon=0x4a80c0; skyGround=0x2a4a18;
    }

    // L1: スカイドーム（大球）/* v4.10 B1: 霧で漂白・縞化しないよう fog:false（グラデーションは後段のGLSLドームが担う） */
    const skyGeo=new THREE.SphereGeometry(900,32,16);
    const skyMat=new THREE.MeshBasicMaterial({color:skyTop,side:THREE.BackSide,fog:false});
    const skyMesh=new THREE.Mesh(skyGeo,skyMat);
    this.scene.add(skyMesh);

    // L2: 地平線グラデーション帯
    const horizonGeo=new THREE.CylinderGeometry(850,850,200,32,1,true);
    const horizonMat=new THREE.MeshBasicMaterial({color:skyHorizon,side:THREE.BackSide,transparent:true,opacity:0.7,fog:false});
    const horizonMesh=new THREE.Mesh(horizonGeo,horizonMat);
    horizonMesh.position.y=-100;
    this.scene.add(horizonMesh);

    // L3: 地表付近の霞
    const hazeGeo=new THREE.CylinderGeometry(800,800,80,32,1,true);
    const hazeMat=new THREE.MeshBasicMaterial({
      color:w.type==="fog"?0xaabaa0:w.type==="rain"?0x303840:skyHorizon,
      side:THREE.BackSide,transparent:true,opacity:w.type==="fog"?0.85:0.35,fog:false
    });
    const hazeMesh=new THREE.Mesh(hazeGeo,hazeMat);
    hazeMesh.position.y=-160;
    this.scene.add(hazeMesh);

    // L4: 太陽（晴天・強風時）
    if(w.type==="sunny"||w.type==="strongWind"){
      const sunGeo=new THREE.SphereGeometry(w.type==="sunny"?22:16,16,10);
      const sunCol=w.type==="sunny"?0xfff8c0:0xffe8a0;
      const sunMat=new THREE.MeshBasicMaterial({color:sunCol,fog:false});
      const sunSphere=new THREE.Mesh(sunGeo,sunMat);
      sunSphere.position.set(180,320,-500);
      this.scene.add(sunSphere);
      // 太陽の光輪
      const glowGeo=new THREE.SphereGeometry(w.type==="sunny"?40:28,12,8);
      const glowMat=new THREE.MeshBasicMaterial({color:sunCol,transparent:true,opacity:0.15,fog:false});
      const glowSphere=new THREE.Mesh(glowGeo,glowMat);
      glowSphere.position.copy(sunSphere.position);
      this.scene.add(glowSphere);
    }

    // L5: 雲（天候別・コース別）
    const cloudCount=this.isMobile?4:
      (w.type==="rain"?12:w.type==="fog"?3:w.type==="strongWind"?18:8);
    const cloudCol=w.type==="rain"?0x3a3e4a:w.type==="fog"?0xbabcb8:0xf0f4ff;
    const cloudOpa=w.type==="rain"?0.82:w.type==="fog"?0.6:0.55;
    for(let i=0;i<cloudCount;i++){
      const cx=(Math.random()-0.5)*1200;
      const cy=120+Math.random()*220;
      const cz_=-200-Math.random()*500;
      const cw=80+Math.random()*160, ch=18+Math.random()*30;
      // 雲本体（楕円3個で1雲）
      for(let j=0;j<3;j++){
        const cGeo=new THREE.SphereGeometry(cw*0.25+j*cw*0.12,10,6);
        const cMat=new THREE.MeshBasicMaterial({color:cloudCol,transparent:true,opacity:cloudOpa*(0.7+j*0.1)});
        const cloud=new THREE.Mesh(cGeo,cMat);
        cloud.userData.v44OldCloud=true;
        cloud.position.set(cx+j*cw*0.22,cy+(j===1?ch*0.18:0),cz_);
        cloud.scale.set(1,0.4+Math.random()*0.25,0.55);
        this.scene.add(cloud);
      }
    }

    // L6: 遠景の山（Augusta・丘陵コース）
    if((course.terrainProfile==="hilly"||isCoastal)&&!this.isMobile){
      const mtColors=[0x1a2e1c,0x223c24,0x2a482c];
      for(let m=0;m<5;m++){
        const mx=(m-2)*260+80*(Math.random()-0.5);
        const mh=80+Math.random()*140;
        const mGeo=new THREE.SphereGeometry(120+Math.random()*80,14,10);
        const mMat=new THREE.MeshBasicMaterial({
          color:mtColors[m%3],transparent:true,opacity:0.55+m*0.04
        });
        const mt=new THREE.Mesh(mGeo,mMat);
        mt.scale.set(1,mh/260,0.72);
        mt.position.set(mx,-mh*0.10,-700-m*80);
        this.scene.add(mt);
      }
    }

    // L7: 海のコース→遠景に水平線
    if(isCoastal&&!this.isMobile){
      const horizLineGeo=new THREE.PlaneGeometry(2000,30);
      const horizLineMat=new THREE.MeshBasicMaterial({
        color:0x1a5080,transparent:true,opacity:0.6
      });
      const horizLine=new THREE.Mesh(horizLineGeo,horizLineMat);
      horizLine.rotation.x=-Math.PI/2;
      horizLine.position.set(0,-8,-800);
      this.scene.add(horizLine);
    }
  }

  _buildTerrain(hole,course){
    const TW=this.terrainW,TH=this.terrainH;
    const SW=56,SH=Math.min(112,Math.round(84*TH/200));
    const gen=this._terrainGen;
    const mob=this.isMobile;
    const rain=this.weather&&this.weather.type==="rain";
    const fog=this.weather&&this.weather.type==="fog";
    const gZ=-TH*0.97;
    // ★ コースID・プロファイル・全ハザード物理配列を最上位で確実に初期化（コースバリアント完全対応）
    window._waterBoxes = [];
    window._shortcutBanZone = null;
    window._obVolumes = [];
    window._runoffAreas = [];
    window._bunkerZones = [];
    window._waterLevel = undefined;
    this._bunkerZones = [];

    const cid=course.id||"";
    const courseProf0=course.terrainProfile||"flat";
    const isLinks0=courseProf0==="links";
    const isCoastal0=courseProf0==="coastal";
    const isHilly0=courseProf0==="hilly"||courseProf0==="gentle_hilly";
    const isAugusta=(cid==="augusta"||cid==="augusta_divine");
    const isPebble=(cid==="pebble");
    const isStAndrews=(cid==="standrews"||cid==="standrews_new");
    const isSawgrass=(cid==="tpcsawgrass");
    const isToda=(cid==="toda"||cid==="toda_dark"||!!course.isToda2Way);

    // ═════════════════════════════════════════════════════════════
    // ★★★ 戸田パブリックゴルフコース (河川敷 9ホール2WAY) 構築 ★★★
    // ═════════════════════════════════════════════════════════════
    if(isToda){

      // ─── 共通マテリアル（仕様書完全準拠） ───
      const matFW = new THREE.MeshLambertMaterial({color: TODA_PALETTE.fairway});
      const matRough = new THREE.MeshLambertMaterial({color: TODA_PALETTE.rough});
      const matGreen = new THREE.MeshLambertMaterial({color: TODA_PALETTE.green});
      const matSubGreen = new THREE.MeshLambertMaterial({color: 0x2bb52b}); // サブグリーン
      const matBunker = new THREE.MeshLambertMaterial({color: TODA_PALETTE.bunker});
      const matWater = new THREE.MeshPhongMaterial({color: TODA_PALETTE.water, transparent:true, opacity:0.88, shininess:80});
      const matBush = new THREE.MeshLambertMaterial({color: TODA_PALETTE.bush});

      // ─── 荒川河川敷ベースフラット大地 ＆ 遠景荒川水面 ───
      const baseRiverLand = new THREE.Mesh(new THREE.PlaneGeometry(TW*8, TH*2.0), matRough);
      baseRiverLand.rotation.x = -Math.PI/2;
      baseRiverLand.position.set(0, -0.04, -TH/2);
      this.scene.add(baseRiverLand);

      const farRiver = new THREE.Mesh(new THREE.PlaneGeometry(TW*2.2, TH*1.8), matWater);
      farRiver.rotation.x = -Math.PI/2;
      farRiver.position.set(-TW*1.55, -0.02, -TH/2);
      this.scene.add(farRiver);

      // ─── ティー位置・ピン位置の動的バインド ───
      const teeCoord = hole.tee || {x:0, y:0.36, z:0};
      const pinCoord = hole.pin || {x:-5, y:1.8, z:gZ};
      /* v4.4: 戸田でも dogleg ホールはピンを横へずらし実際に曲げる (8番直角は既存仕様) */
      if(((hole.physHole || ((hole.n - 1) % 9 + 1))) !== 8){
        if(hole.dogleg === "right"){ pinCoord.x += 24; pinCoord.z += 16; }
        else if(hole.dogleg === "left"){ pinCoord.x -= 24; pinCoord.z += 16; }
        else if(hole.dogleg === "slight_right"){ pinCoord.x += 10; pinCoord.z += 6; }
        else if(hole.dogleg === "slight_left"){ pinCoord.x -= 10; pinCoord.z += 6; }
      }
      const subPinCoord = hole.subPin || {x:5, y:1.8, z:gZ};

      this.teePos.set(teeCoord.x, teeCoord.y, teeCoord.z);
      this.pinPos.set(pinCoord.x, pinCoord.y, pinCoord.z);

      const ph = hole.physHole || ((hole.n-1)%9 + 1);
      const isRightAngleDogleg = (ph === 8);

      // ─── フェアウェイ構築 ───
      if(!isRightAngleDogleg){
        // 通常ストレートホール
        const fwWidth = (hole.dogleg==="slight_right"||hole.dogleg==="right") ? TW*0.75 : TW*0.62;
        const fwMesh = new THREE.Mesh(new THREE.PlaneGeometry(fwWidth, TH*0.98), matFW);
        fwMesh.rotation.x = -Math.PI/2;
        fwMesh.position.set(0, 0.01, -TH/2);
        fwMesh.receiveShadow = true;
        this.scene.add(fwMesh);

        // PS5級・高麗芝刈り目ストライプ＆河川敷防風林・OB白杭
        const bandD = 12, bandN = Math.ceil(TH*0.98 / bandD);
        for(let s = 0; s < bandN; s++){
          if(s % 2 === 0) continue;
          const stM = new THREE.Mesh(new THREE.PlaneGeometry(fwWidth, bandD - 0.15), new THREE.MeshLambertMaterial({color: 0x276314}));
          stM.rotation.x = -Math.PI/2;
          stM.position.set(0, 0.016, -(s + 0.5)*bandD);
          this.scene.add(stM);
        }
        for(let z = -22; z >= -TH*0.95; z -= 34){
          this._addTree(fwWidth/2 + 12 + (Math.abs(z)%7), z, gen, 1.5, "broad");
          this._addTree(-fwWidth/2 - 14 - (Math.abs(z)%5), z - 12, gen, 1.35, "pine");
          for(const sd of [-1, 1]){
            const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.35, 6), new THREE.MeshBasicMaterial({color: TODA_PALETTE.ob}));
            stk.position.set(sd*(fwWidth/2 + 4.8), 0.68, z);
            this.scene.add(stk);
          }
        }

        // ★ 線ブラッシュアップ: OB白杭を結ぶ白ライン帯（アコーディア図のOB白線を3D側にも）
        for(const sd of [-1, 1]){
          const obLine = new THREE.Mesh(new THREE.PlaneGeometry(0.3, TH*0.93), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.9}));
          obLine.rotation.x = -Math.PI/2;
          obLine.position.set(sd*(fwWidth/2 + 4.8), 0.05, -TH*0.475);
          this.scene.add(obLine);
        }

        // ファーストカット境界帯
        for(const sd of [-1, 1]){
          const fc = new THREE.Mesh(new THREE.PlaneGeometry(4.0, TH*0.98), new THREE.MeshLambertMaterial({color: TODA_PALETTE.firstCut}));
          fc.rotation.x = -Math.PI/2;
          fc.position.set(sd*(fwWidth/2 + 2.0), 0.012, -TH/2);
          this.scene.add(fc);
        }
      } else {
        // ★★★ 【Hole 8 & Hole 17】 200yから直角の左ドッグレッグ ★★★
        // ① ティーから200yd地点へのストレート区間FW
        const leg1Length = 215;
        const leg1W = 34;
        const leg1 = new THREE.Mesh(new THREE.PlaneGeometry(leg1W, leg1Length), matFW);
        leg1.rotation.x = -Math.PI/2;
        leg1.position.set(0, 0.01, -leg1Length/2);
        leg1.receiveShadow = true;
        this.scene.add(leg1);

        // ファーストカット（縦方向の左右）
        for(const sd of [-1, 1]){
          const fc1 = new THREE.Mesh(new THREE.PlaneGeometry(4.0, leg1Length), new THREE.MeshLambertMaterial({color: TODA_PALETTE.firstCut}));
          fc1.rotation.x = -Math.PI/2;
          fc1.position.set(sd*(leg1W/2 + 2.0), 0.012, -leg1Length/2);
          this.scene.add(fc1);
        }

        // ② 200ydコーナーから真左（-X方向）へ直角に折れ曲がる区間FW
        // コーナー: Z = -185 〜 -225, X = 0 から X = -95 まで横に伸びる
        const cornerZ = -205;
        const leg2W = 95;
        const leg2Depth = 40;
        const leg2 = new THREE.Mesh(new THREE.PlaneGeometry(leg2W, leg2Depth), matFW);
        leg2.rotation.x = -Math.PI/2;
        leg2.position.set(-leg2W/2 + 10, 0.014, cornerZ);
        leg2.receiveShadow = true;
        this.scene.add(leg2);

        // ファーストカット（横方向の上下）
        for(const sd of [-1, 1]){
          const fc2 = new THREE.Mesh(new THREE.PlaneGeometry(leg2W, 4.0), new THREE.MeshLambertMaterial({color: TODA_PALETTE.firstCut}));
          fc2.rotation.x = -Math.PI/2;
          fc2.position.set(-leg2W/2 + 10, 0.015, cornerZ + sd*(leg2Depth/2 + 2.0));
          this.scene.add(fc2);
        }

        // ★ 線刷新フェーズ1: 直角ドッグレッグ (8番/17番) にも OB白ライン帯を追加 (通常ホールと同じ戸田基準: 白・幅0.3・opacity 0.9・y=0.05・FW端 +4.8)
        // leg1 (縦区間) 両側 / leg2 (横区間) 両側 / leg2 左端キャップ (描画のみ・OB判定は不変更)
        const obMatDL = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.9});
        const obBandDL = (w, l, x, z) => {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), obMatDL);
          m.rotation.x = -Math.PI/2; m.position.set(x, 0.05, z); this.scene.add(m);
        };
        for(const sd of [-1, 1]) obBandDL(0.3, leg1Length*0.97, sd*(leg1W/2 + 4.8), -leg1Length/2);
        for(const sd of [-1, 1]) obBandDL(leg2W*0.97, 0.3, -leg2W/2 + 10, cornerZ + sd*(leg2Depth/2 + 4.8));
        obBandDL(0.3, leg2Depth, -leg2W + 10 - 4.8, cornerZ);

        // ③ コーナー内側（X: -8 〜 -55, Z: -60 〜 -190）を塞ぐ密集した高い防風林
        // ティーからグリーンへの直接ショットを完全にブロック！
        for(let z = -70; z >= -195; z -= 14){
          for(let x = -12; x >= -50; x -= 14){
            const jx = x + (Math.random()-0.5)*6;
            const jz = z + (Math.random()-0.5)*6;
            const treeH = 3.6 + Math.random()*1.8;
            this._addTree(jx, jz, gen, treeH, "broad");
          }
        }

        // ④ ローカルルール空域OB（ショートカット禁止判定ボリューム）
        window._shortcutBanZone = {
          minX: -65, maxX: -6,
          minZ: -202, maxZ: -65,
          maxY: 60
        };

        // ⑤ 外周OB白杭（右サイドおよびコーナー奥）
        for(let z = 10; z >= -230; z -= 18){
          const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.4, 6), new THREE.MeshBasicMaterial({color: TODA_PALETTE.ob}));
          stk.position.set(leg1W/2 + 4, 0.7, z);
          this.scene.add(stk);
        }
        // 突き当たり奥（Z = -230以奥）のOB白杭
        for(let x = -leg1W/2; x <= leg1W/2 + 4; x += 10){
          const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.4, 6), new THREE.MeshBasicMaterial({color: TODA_PALETTE.ob}));
          stk.position.set(x, 0.7, -228);
          this.scene.add(stk);
        }
      }

      // ─── ティーグラウンド（OUT用・IN用） ───
      const teeA = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 8), new THREE.MeshLambertMaterial({color: TODA_PALETTE.tee}));
      teeA.position.set(0, 0.12, 0);
      this.scene.add(teeA);
      for(const mx of [-2.4, 2.4]){
        const mk = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshLambertMaterial({color: 0x2288ff}));
        mk.position.set(mx, 0.4, 0);
        this.scene.add(mk);
      }

      // IN用別ティー
      const inTeeCoord = hole.isIN ? teeCoord : {x:6, y:0.36, z:19};
      const teeB = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 8), new THREE.MeshLambertMaterial({color: TODA_PALETTE.tee}));
      teeB.position.set(inTeeCoord.x, 0.12, inTeeCoord.z);
      this.scene.add(teeB);
      for(const mx of [-2.4, 2.4]){
        const mk = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshLambertMaterial({color: 0xcc2222}));
        mk.position.set(inTeeCoord.x+mx, 0.4, inTeeCoord.z);
        this.scene.add(mk);
      }

      // ─── 砲台グリーン（2つのグリーン） ───
      const gHeight = pinCoord.y || 1.8;
      const gRadius = 9.0;
      
      // ① アクティブグリーン砲台マウンド（法面＋天面）
      const basePodium = new THREE.Mesh(new THREE.CylinderGeometry(gRadius, gRadius+5.0, gHeight, 32), matRough);
      basePodium.position.set(pinCoord.x, gHeight*0.5, pinCoord.z);
      this.scene.add(basePodium);

      const activeGreenMesh = new THREE.Mesh(new THREE.CylinderGeometry(gRadius*0.92, gRadius*0.92, 0.30, 32), matGreen);
      activeGreenMesh.position.set(pinCoord.x, gHeight + 0.15, pinCoord.z);
      this.scene.add(activeGreenMesh);
      this.greenPos = {x: pinCoord.x, z: pinCoord.z, r: gRadius*0.92, y: gHeight};

      // アクティブグリーンのカップリング
      const cupRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 24), new THREE.MeshBasicMaterial({color:0xffffff, side:THREE.DoubleSide}));
      cupRing.rotation.x = -Math.PI/2;
      cupRing.position.set(pinCoord.x, gHeight + 0.31, pinCoord.z);
      this.scene.add(cupRing);

      // ② サブグリーン砲台マウンド（フラッグなしBグリーン）
      const subPodium = new THREE.Mesh(new THREE.CylinderGeometry(gRadius*0.95, gRadius+4.5, gHeight*0.95, 28), matRough);
      subPodium.position.set(subPinCoord.x, gHeight*0.48, subPinCoord.z);
      this.scene.add(subPodium);

      const subGreenMesh = new THREE.Mesh(new THREE.CylinderGeometry(gRadius*0.88, gRadius*0.88, 0.15, 28), matSubGreen);
      subGreenMesh.position.set(subPinCoord.x, gHeight*0.95 + 0.05, subPinCoord.z);
      this.scene.add(subGreenMesh);

      // 砲台グリーン法面の滑落エリア登録
      window._runoffAreas.push({pos: new THREE.Vector3(pinCoord.x, 0, pinCoord.z), radius: gRadius + 4.5});

      // ─── その他ホール固有ギミック ───
      // 【Hole 1 / 10】
      if(ph === 1){
        this._addTree(0, -230, gen, 3.2, "broad");
        window._obVolumes.push({minX: -TW*2, maxX: -TW*0.62/2 - 5, minZ: -TH*1.5, maxZ: 10, reason:"左OBライン (白杭)"});
      }
      // 【Hole 2 / 11】
      if(ph === 2){
        const pz = -140;
        const pWater = new THREE.Mesh(new THREE.PlaneGeometry(28, 60), matWater);
        pWater.rotation.x = -Math.PI/2;
        pWater.position.set(TW*0.62/2 + 10, 0.03, pz);
        this.scene.add(pWater);
        window._waterBoxes.push({minX: TW*0.62/2 - 2, maxX: TW*2, minZ: pz - 32, maxZ: pz + 32, maxY: 0.5});
      }
      // 【Hole 3 / 12】
      if(ph === 3){
        const bkZ = pinCoord.z + 14;
        const bA = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.2, 0.8, 24), matBunker);
        bA.position.set(pinCoord.x, 0.35, bkZ);
        this.scene.add(bA);
        window._bunkerZones.push({x: pinCoord.x, z: bkZ, r: 6.0, radius: 6.0});
        this._bunkerZones.push({x: pinCoord.x, z: bkZ, r: 6.0, radius: 6.0});
      }
      // 【Hole 4 / 13】
      if(ph === 4){
        this._addTree(0, -190, gen, 3.0, "broad");
        const dropZ = pinCoord.z - 12;
        const dropSlope = new THREE.Mesh(new THREE.BoxGeometry(TW*0.6, 1.5, 16), matRough);
        dropSlope.rotation.x = 0.25;
        dropSlope.position.set(pinCoord.x, -0.2, dropZ);
        this.scene.add(dropSlope);
        window._runoffAreas.push({pos: new THREE.Vector3(pinCoord.x, 0, dropZ), radius: 14.0});
      }
      // 【Hole 5 / 14】
      if(ph === 5){
        const river = new THREE.Mesh(new THREE.PlaneGeometry(TW*2, TH*1.2), matWater);
        river.rotation.x = -Math.PI/2;
        river.position.set(-TW - 5, 0.02, -TH/2);
        this.scene.add(river);
        window._obVolumes.push({minX: -TW*3, maxX: -TW*0.75/2 - 2, minZ: -TH*1.5, maxZ: 10, reason:"荒川河川敷 超浅OB"});
      }
      // 【Hole 6 / 15】
      if(ph === 6){
        const creekZ = -240;
        const creekW = TW*0.62 * 1.3;
        const creekL = 20;
        const creekMesh = new THREE.Mesh(new THREE.PlaneGeometry(creekW, creekL), matWater);
        creekMesh.rotation.x = -Math.PI/2;
        creekMesh.position.set(0, 0.03, creekZ);
        this.scene.add(creekMesh);
        window._waterBoxes.push({minX: -creekW/2 - 4, maxX: creekW/2 + 4, minZ: creekZ - creekL/2, maxZ: creekZ + creekL/2, maxY: 0.5});
      }
      // 【Hole 7 / 16】
      if(ph === 7){
        const obX = -TW*0.62/2 - 2;
        window._obVolumes.push({minX: -TW*2, maxX: obX, minZ: -TH*1.5, maxZ: 10, reason:"左サイド極浅OB"});
      }
      // 【Hole 9 / 18】
      if(ph === 9){
        const bkDist = gRadius + 3.2;
        const bkAngles = [0, Math.PI/2, Math.PI, Math.PI*1.5];
        for(const ang of bkAngles){
          const bx = pinCoord.x + Math.sin(ang)*bkDist;
          const bz = pinCoord.z + Math.cos(ang)*bkDist;
          const bkMesh = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.0, 0.9, 20), matBunker);
          bkMesh.position.set(bx, 0.4, bz);
          this.scene.add(bkMesh);
          window._bunkerZones.push({x: bx, z: bz, r: 4.8, radius: 4.8});
          this._bunkerZones.push({x: bx, z: bz, r: 4.8, radius: 4.8});
        }
        window._runoffAreas.push({pos: new THREE.Vector3(pinCoord.x, 0, pinCoord.z), radius: gRadius + 6.0});
      }
      // 戸田パブリック外周広域OB境界（大幅なコース外逸脱を確実にOB判定、グリーン奥・左右ラフ余白を適切に確保）
      window._obVolumes.push({minX: -TW*4, maxX: -TW*1.45, minZ: -TH*2.2, maxZ: 60, reason:"コース左外周OB"});
      window._obVolumes.push({minX: TW*1.45, maxX: TW*4, minZ: -TH*2.2, maxZ: 60, reason:"コース右外周OB"});
      window._obVolumes.push({minX: -TW*4, maxX: TW*4, minZ: -TH*2.2, maxZ: -TH*1.55, reason:"グリーン奥外周OB"});

      this._centerline = isRightAngleDogleg
        ? [{x:teeCoord.x, z:teeCoord.z}, {x:0, z:-205}, {x:pinCoord.x, z:pinCoord.z}]
        : [{x:teeCoord.x, z:teeCoord.z},
           {x:teeCoord.x + (pinCoord.x - teeCoord.x) * 0.6 + (hole.dogleg === "right" ? 14 : (hole.dogleg === "left" ? -14 : (hole.dogleg === "slight_right" ? 6 : (hole.dogleg === "slight_left" ? -6 : 0)))), z:teeCoord.z + (pinCoord.z - teeCoord.z) * 0.6},
           {x:pinCoord.x, z:pinCoord.z}];
      console.log(`[Toda Public] Built 2WAY Hole ${hole.n} (Physical Hole ${ph}, isIN: ${hole.isIN}, Dogleg: ${hole.dogleg})`);
      return; // 戸田パブリック固有の構築完了
    }

    // ★ feat解析（コース特性をビジュアルに反映）
    const feat=hole.feat||"";
    const hasLeftDogleg=feat.includes("leftDogleg");
    const hasRightDogleg=feat.includes("rightDogleg");
    const hasWaterLeft=feat.includes("water_left")||feat.includes("ocean_left");
    const hasWaterRight=feat.includes("water_right")||feat.includes("ocean_right");
    const hasWaterFront=feat.includes("water_front");
    const hasIslandGreen=feat.includes("island_green");
    const hasOcean=feat.includes("ocean");
    const hasCliff=feat.includes("cliffside");
    const hasOBLeft=feat.includes("ob_left");
    const hasElevGreen=feat.includes("elevated_green");
    const bunkerCount=parseInt((feat.match(/bunker(\d)/)||[0,0])[1])||0;
    /* v4.4 dogleg実形化: 中心線 tee->corner(60%)->pin、ピンを中心線終端へ */
    let gX = 0; let gZv = gZ;
    let dlSide = 0, dlTheta = 0;
    if(feat.includes("leftDogleg") || hole.dogleg === "left"){ dlSide = -1; dlTheta = 38; }
    else if(feat.includes("rightDogleg") || hole.dogleg === "right"){ dlSide = 1; dlTheta = 38; }
    else if(hole.dogleg === "slight_right"){ dlSide = 1; dlTheta = 13; }
    else if(hole.dogleg === "slight_left"){ dlSide = -1; dlTheta = 13; }
    else if(hole.dogleg === "sharp_left"){ dlSide = -1; dlTheta = 80; }
    else if(hole.dogleg === "sharp_right"){ dlSide = 1; dlTheta = 80; }
    const DL1 = TH * 0.60, DL2 = TH * 0.40;
    if(dlSide !== 0){
      const thR = dlTheta * Math.PI / 180;
      gX = dlSide * DL2 * Math.sin(thR);
      gZv = -(DL1 + DL2 * Math.cos(thR));
    }
    this._centerline = dlSide !== 0
      ? [{x:0,z:0},{x:0,z:-DL1},{x:gX,z:gZv}]
      : [{x:0,z:0},{x:0,z:gZv}];
    if(dlSide !== 0 && Math.abs(dlTheta) >= 30){
      const chX = gX / 2, chZ = gZv / 2;
      const inX = (chX) * 0.38, inZ = -DL1 + (chZ + DL1) * 0.38;
      window._shortcutBanZone = { minX: inX - 8, maxX: inX + 8, minZ: inZ - 8, maxZ: inZ + 8, maxY: 60 };
    }
    // isLinks/isCoastal/isHilly は冒頭の isLinks0/isCoastal0/isHilly0 を使用
    const isLinks=isLinks0;
    const isCoastal=isCoastal0;
    const isHilly=isHilly0;

    // コースプロファイル別の背景色（外周）
    const outerColor=isLinks?(rain?0x3a3020:0xd4c080):isCoastal?(rain?0x1a2a1a:0x8ab090):(rain?0x2a2a18:0xc4aa70);

    /* ─── helper: add mesh at y offset ─── */
    const add=(geo,color,py,px,pz,opts={})=>{
      const mat=new THREE.MeshLambertMaterial({color,...opts});
      const m=new THREE.Mesh(geo,mat);
      m.rotation.x=-Math.PI/2;m.position.set(px||0,py||0,pz||-TH/2);
      this.scene.add(m);return m;
    };
    const addC=(geo,color,opts={})=>{
      const mat=new THREE.MeshLambertMaterial({color,...opts});
      const m=new THREE.Mesh(geo,mat);
      this.scene.add(m);return m;
    };
    // ★ 水面用（半透明・リフレクション風）
    const addWater=(geo,px,pz,py)=>{
      const wmat=new THREE.MeshPhongMaterial({
        color:rain?0x1a3a5a:0x1a6496,
        transparent:true,opacity:0.82,
        shininess:120,specular:0x88ccff
      });
      const m=new THREE.Mesh(geo,wmat);
      m.rotation.x=-Math.PI/2;m.position.set(px,py||0.02,pz);
      this.scene.add(m);return m;
    };

    // ═══════════════════════════════════════════════════════
    // ①  最外周：OB外の荒れ地（コース境界を視覚的に強調）
    // ═══════════════════════════════════════════════════════
    // ★ 最外周地形（コース別）
    add(new THREE.PlaneGeometry(TW*10,TH*2.0),outerColor,-0.35,0,-TH/2);
    // 外周の自然地形（色分け）
    if(isHilly){
      // 丘陵: 外周に濃緑の起伏地形
      add(new THREE.PlaneGeometry(TW*8,TH*1.7),rain?0x1a3808:0x2a5a10,-0.28,0,-TH/2);
      add(new THREE.PlaneGeometry(TW*6,TH*1.4),rain?0x1e4008:0x2e6812,-0.20,0,-TH/2);
    } else if(isLinks){
      // リンクス: 土・砂丘色
      add(new THREE.PlaneGeometry(TW*8,TH*1.7),rain?0x3a3218:0x5a4a28,-0.28,0,-TH/2);
    }
    // ★ コースタル・リンクス: 海/海岸の描画（リアル多層）
    if(isCoastal||hasOcean||hasCliff){
      const oceanX=hasWaterLeft?-(TW*1.9):TW*1.9;
      // 深海（最暗）
      const oceanDeep=new THREE.Mesh(new THREE.PlaneGeometry(TW*5,TH*1.8),
        new THREE.MeshBasicMaterial({color:rain?0x060e18:0x08203a}));
      oceanDeep.rotation.x=-Math.PI/2;oceanDeep.position.set(oceanX,-0.35,-TH/2);this.scene.add(oceanDeep);
      // 中間水深
      const oceanMid=new THREE.Mesh(new THREE.PlaneGeometry(TW*4,TH*1.6),
        new THREE.MeshPhongMaterial({color:rain?0x0e2844:0x0a3a6a,transparent:true,opacity:0.92,shininess:200,specular:0x4488cc}));
      oceanMid.rotation.x=-Math.PI/2;oceanMid.position.set(oceanX,-0.18,-TH/2);this.scene.add(oceanMid);
      // 浅瀬
      const oceanShallow=new THREE.Mesh(new THREE.PlaneGeometry(TW*1.2,TH*1.4),
        new THREE.MeshPhongMaterial({color:rain?0x1a4060:0x1a6090,transparent:true,opacity:0.85,shininess:160,specular:0x66aadd}));
      oceanShallow.rotation.x=-Math.PI/2;
      oceanShallow.position.set(oceanX>0?TW*0.8:-TW*0.8,-0.08,-TH/2);this.scene.add(oceanShallow);
      // 砂浜（3トーン）
      const beachX=oceanX>0?TW*0.58:-TW*0.58;
      add(new THREE.PlaneGeometry(TW*0.28,TH*1.1),rain?0x9a8a60:0xe8cc88,-0.12,beachX,-TH/2);
      add(new THREE.PlaneGeometry(TW*0.18,TH*1.0),rain?0xb0a070:0xf0d8a0,-0.1,beachX,-TH/2);
      // 波打ち際（白波・半透明）
      if(!mob){
        for(let w=0;w<8;w++){
          const wv=new THREE.Mesh(new THREE.PlaneGeometry(TW*0.12,0.8+Math.random()*1.5),
            new THREE.MeshBasicMaterial({color:0xeef6ff,transparent:true,opacity:0.3+Math.random()*0.25}));
          wv.rotation.x=-Math.PI/2;
          wv.position.set(beachX+(oceanX>0?-2:-2+4*Math.random()),-0.05,-(TH*0.1+w*TH*0.1));
          this.scene.add(wv);
        }
      }
      // 崖（岩肌）
      if(hasCliff){
        add(new THREE.PlaneGeometry(TW*0.35,TH*0.9),rain?0x504838:0x706850,-0.2,
          oceanX>0?TW*0.44:-TW*0.44,-TH/2);
      }
    }
    // ★ リンクスコース: 荒れ地・フェスキュー
    if(isLinks){
      // フェスキュー（黄緑・起伏感）
      add(new THREE.PlaneGeometry(TW*3.5,TH*1.25),rain?0x3a3818:0x909848,-0.22,0,-TH/2);
      // ポットバンカー跡（自然な窪み・色変化）
      if(!mob){
        for(let pb=0;pb<6;pb++){
          const pbx=(Math.random()-0.5)*TW*1.4;
          const pbz=-(TH*0.12+Math.random()*TH*0.72);
          if(Math.abs(pbx)<TW*0.55)continue;
          add(new THREE.CircleGeometry(1.5+Math.random()*2,10),rain?0xa09878:0xd4ba88,-0.19,pbx,pbz);
        }
      }
    }

    // 砂利・荒れ草パッチ（外周質感）
    if(!mob){
      for(let i=0;i<80;i++){
        const px=(Math.random()-0.5)*TW*7,pz=-(Math.random()*TH*1.6);
        const d=Math.abs(px)-TW/2-3;if(d<0)continue;
        add(new THREE.PlaneGeometry(1.5+Math.random()*4,1+Math.random()*3),
          Math.random()>0.6?0xb09a60:0x8a7a50,
          -0.23,px,pz,{transparent:true,opacity:0.5+Math.random()*0.4});
      }
    }

    // ═══════════════════════════════════════════════════════
    // ②  ラフ（コース別・プロ品質）
    // ═══════════════════════════════════════════════════════
    // ベースラフ色（コース芝の種類で異なる）
    const roughColor = 0x2e4a1a; /* v4.15: 空撮でフェアウェイと同化していたため少し深くする。 */
    add(new THREE.PlaneGeometry(TW*2.3,TH*1.09),roughColor||0x1b5814,-0.06);
    // セミラフ（フェアウェイとラフの中間）
    const semiRough=isLinks?(rain?0x484828:0x788840):(rain?0x226010:0x2a8018);
    add(new THREE.PlaneGeometry(TW*1.48,TH*1.03),semiRough,-0.03);
    // セミラフ内縁（より明るい）
    add(new THREE.PlaneGeometry(TW*1.22,TH*1.01),rain?0x247012:0x2e9018,-0.015);
    // ラフ草テクスチャ（コース別）
    const gc=mob?12:55;
    for(let i=0;i<gc;i++){
      const gx=(Math.random()-0.5)*TW*1.85;
      const pz=-(Math.random()*TH*1.02);
      if(Math.abs(gx)<TW*0.62)continue;
      const gc2=isLinks?[0x4a5820,0x586828,0x3a4818][i%3]:[0x1a5a0c,0x236818,0x1e6610][i%3];
      add(new THREE.PlaneGeometry(0.8+Math.random()*3.8,TH*0.022+Math.random()*TH*0.032),
        gc2,-0.04,gx,pz,{transparent:true,opacity:0.5+Math.random()*0.38});
    }

    // ═══════════════════════════════════════════════════════
    // ③  フェアウェイ（精密地形 + 7段の刈り目縞）
    // ═══════════════════════════════════════════════════════
    const fwW2 = dlSide!==0 ? TW*2.3 : TW;
    const fwGeo=new THREE.PlaneGeometry(fwW2,TH,dlSide!==0?110:SW,SH);
    fwGeo.rotateX(-Math.PI/2);
    const pa=fwGeo.attributes.position;
    const colsX=Math.round(fwW2/(TW/SW));
    for(let i=0;i<=SH;i++)for(let j=0;j<=colsX;j++){
      const idx=i*(colsX+1)+j;
      pa.setY(idx,gen.getHeight(pa.getX(idx)+TW/2,i*(TH/SH)));
    }
    fwGeo.computeVertexNormals();
    // ★ コース・天候・季節別リアルフェアウェイカラー
    let fwBase = 0x356b24;
    if(isLinks) fwBase=rain?0x3a5c22:0x527a2c;        // リンクス=フェスキュー芝（黄緑系）
    else if(isCoastal) fwBase=rain?0x1f5c14:0x2c7a1e;  // 海岸=洋芝
    else if(isHilly) fwBase=rain?0x205518:0x2a8020;    // 丘陵=バミューダ芝
    const fwC=rain?Math.round(fwBase*0.82):fog?Math.round(fwBase*0.95):fwBase;
    // ★ フェアウェイ高品質マテリアル（MeshLambertMaterial）
    const fwMat=new THREE.MeshLambertMaterial({color:fwC});
    if(dlSide!==0) fwMat.color.set(rain?0x24471a:0x1c4210); /* dogleg: 下地はラフトーン、本FWは中心線リボン */
    const fw=new THREE.Mesh(fwGeo,fwMat);
    fw.receiveShadow=true;
    fw.position.set(0,0,-TH/2);this.scene.add(fw);this.terrain=fw;

    // 刈り目縞（コース別幅・3トーン）
    const bandD2=12;
    const ns=Math.ceil(TH/bandD2)+1;
    const toneA=rain?0x348018:isLinks?0x5a8828:0x44c020,
          toneB=rain?0x2a700e:isLinks?0x4a7820:0x2f9a14, /* v4.15: 濃い側の縞を少し深くして縞のコントラストを戻す。 */
          toneC=rain?0x307518:isLinks?0x508030:0x3fb01a;
    for(let s=0;s<ns;s++){
      const col=s%2===0?toneA:toneB;
      const stripe=new THREE.Mesh(
        new THREE.PlaneGeometry(TW,bandD2-0.12),
        new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:dlSide!==0?0.16:0.7}) /* v4.15: 空撮で縞が薄く見えていたため不透明度を上げる（色・幅・間隔は不変）。 */
      );
      stripe.rotation.x=-Math.PI/2;
      stripe.position.set(0,0.01,-(s+0.5)*bandD2+2);
      this.scene.add(stripe);
    }

    // フェアウェイ左右境界ライン（細い暗線）
    for(const sd of[-1,1]){
      const bl=new THREE.Mesh(
        new THREE.PlaneGeometry(0.9,TH*0.995),
        new THREE.MeshBasicMaterial({color:0x145508,transparent:true,opacity:0.8})
      );
      bl.rotation.x=-Math.PI/2;
      bl.position.set(sd*(TW/2+0.45),0.015,-TH/2);
      this.scene.add(bl);
    }

    // ═══════════════════════════════════════════════════════
    // ④  OBゾーン（白杭 + 白線 + 警告帯）
    // ═══════════════════════════════════════════════════════
    // OB警告帯（2段階）
    for(const sd of[-1,1]){
      // 1ペナ予告帯（薄い黄土）
      const wb=new THREE.Mesh(new THREE.PlaneGeometry(5,TH),
        new THREE.MeshBasicMaterial({color:0xc8aa68,transparent:true,opacity:0.5}));
      wb.rotation.x=-Math.PI/2;wb.position.set(sd*(TW/2+4.5),-0.05,-TH/2);
      this.scene.add(wb);
      // OB確定帯（赤茶）
      const ob=new THREE.Mesh(new THREE.PlaneGeometry(10,TH),
        new THREE.MeshBasicMaterial({color:0xa08048,transparent:true,opacity:0.55}));
      ob.rotation.x=-Math.PI/2;ob.position.set(sd*(TW/2+12),-0.07,-TH/2);
      this.scene.add(ob);
    }

    // 白線（OBライン境界）— ★線刷新フェーズ1 (全コース展開): 戸田基準仕様 (白・幅0.3・opacity 0.9) に統一。
    // 従来は固定 y=0.018 の平らな1枚板 (幅0.22・opacity 0.85) で、ドッグレッグではフェアウェイ中心線が
    // 曲がるのに直線のままだった。中心線オフセット (±(TW/2+2.1) = 直線ホールでは従来と同位置) に沿って
    // 約6単位ごとに分割したリボンに変更 (描画のみ・OB判定データは不変更)。
    // 高さは max(getGY, 0)+0.06: 線の位置 (|x|=52付近) の描画地面は平坦なセミラフ面 (y≈-0.015) で、
    // getGY (物理高度) が負の区間では帯がその面の下に潜ってしまうため、平坦面レベルを下限にする。
    // getGY が正の区間 (ドッグレッグの広幅地形メッシュ上など) では地形高度に沿う。
    const obOff=TW/2+2.1;
    const clOB=(this._centerline&&this._centerline.length>1)?this._centerline:[{x:0,z:0},{x:0,z:-TH*0.97}];
    const obSamples=[]; // {x,z,px,pz} 中心線の弧長サンプル (法線は区間ごと一定・コーナーは区間境界で両法線を取る)
    for(let si=0;si<clOB.length-1;si++){
      const a=clOB[si],b=clOB[si+1];
      const vx=b.x-a.x,vz=b.z-a.z,sl=Math.hypot(vx,vz)||1;
      const npx=vz/sl,npz=-vx/sl;
      const steps=Math.max(2,Math.ceil(sl/6));
      for(let k=(si===0?0:1);k<=steps;k++){
        const t=k/steps;
        obSamples.push({x:a.x+vx*t,z:a.z+vz*t,px:npx,pz:npz});
      }
    }
    const obLineMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9,side:THREE.DoubleSide});
    for(const sd of[-1,1]){
      const pos=[],idx=[];
      for(let i=0;i<obSamples.length;i++){
        const s=obSamples[i];
        const cxp=s.x+s.px*sd*obOff,czp=s.z+s.pz*sd*obOff;
        const hx=s.px*0.15,hz=s.pz*0.15; // 半幅0.15 → 幅0.3 (戸田基準)
        const x1=cxp-hx,z1=czp-hz,x2=cxp+hx,z2=czp+hz;
        pos.push(x1,Math.max(this.getGY(x1,z1),0)+0.06,z1, x2,Math.max(this.getGY(x2,z2),0)+0.06,z2);
        if(i<obSamples.length-1){const a2=i*2;idx.push(a2,a2+1,a2+2, a2+1,a2+3,a2+2);}
      }
      const obGeo=new THREE.BufferGeometry();
      obGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      obGeo.setIndex(idx);obGeo.computeVertexNormals();
      this.scene.add(new THREE.Mesh(obGeo,obLineMat));
    }

    // 白杭（14m間隔・立体的）— ★線刷新フェーズ1: 白帯と同じ中心線オフセット列に置き、各杭を白帯と同じ高さ基準で接地
    // (従来は直線配置・固定 y。描画のみ)
    const stkMatB=new THREE.MeshBasicMaterial({color:0xf9f9f5});
    const stkMatT=new THREE.MeshBasicMaterial({color:0xffffff});
    const stkMatS=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.18});
    const stakePts=[];let stkAcc=0,stkPrev=obSamples[0]||{x:0,z:0,px:1,pz:0};
    if(obSamples.length)stakePts.push(obSamples[0]);
    for(let i=1;i<obSamples.length;i++){
      const s=obSamples[i];
      stkAcc+=Math.hypot(s.x-stkPrev.x,s.z-stkPrev.z);stkPrev=s;
      if(stkAcc>=14){stakePts.push(s);stkAcc=0;}
    }
    for(const sp of stakePts){
      for(const sd of[-1,1]){
        const sx=sp.x+sp.px*sd*obOff,sz=sp.z+sp.pz*sd*obOff;
        const gy=Math.max(this.getGY(sx,sz),0);
        // 杭本体
        const sb=new THREE.Mesh(
          new THREE.CylinderGeometry(0.09,0.11,1.38,7),stkMatB);
        sb.position.set(sx,gy+0.69,sz);this.scene.add(sb);
        // 杭頭（丸）
        const st=new THREE.Mesh(
          new THREE.SphereGeometry(0.14,7,5),stkMatT);
        st.position.set(sx,gy+1.44,sz);this.scene.add(st);
        // 接地影
        const ss=new THREE.Mesh(
          new THREE.CircleGeometry(0.14,8),stkMatS);
        ss.rotation.x=-Math.PI/2;ss.position.set(sx,gy+0.02,sz);this.scene.add(ss);
      }
    }

    // ═══════════════════════════════════════════════════════
    // ⑤  バンカー（プロ品質・レーキ跡・砂質感）
    // ═══════════════════════════════════════════════════════
    // ★ feat の bunkerN から実際のバンカー数を取得
    const blist=[];
    // グリーンサイドバンカー（feat=bunkerN → N基）
    
    // ==== カスタムホール（全11コース対応）ロジック ====
    // TPCソーグラス #17 アイランドグリーン
    if(isSawgrass && hole.n===17){
       // 周囲360度を水に
       addWater(new THREE.PlaneGeometry(TW*4,TH*2), 0, -TH/2, 0.05);
       // 右手前のバンカー
       this._bunkerZones.push({x: TW*0.1, z: -TH/2 + 10, r: 4, radius: 4});
    }
    
    // ペブルビーチ #7 海
    if(isPebble && hole.n===7){
       // 崖と海
       addWater(new THREE.PlaneGeometry(TW*5,TH*3), 0, -TH/2 - 20, -0.2);
    }
    
    // オーガスタ #12
    if(isAugusta && hole.n===12){
       // レイズクリーク
       addWater(new THREE.PlaneGeometry(TW, 15), 0, -TH/2 + 20, -0.1);
       // グリーン手前の滑る傾斜
       window._runoffAreas.push({pos: new THREE.Vector3(0,0,-TH/2 + 10), radius: 10});
    }
    
    // セントアンドリュース (ポットバンカー)
    if(isStAndrews){
       for(let i=0; i<10; i++){
          const pbx = (Math.random()-0.5)*TW*0.6;
          const pbz = -(Math.random()*TH*0.8);
          const pbr = 2 + Math.random()*2;
          this._bunkerZones.push({ x: pbx, z: pbz, r: pbr, radius: pbr });
       }
    }

const bCntGreen=Math.min(bunkerCount,5);
    const bAngles=[-0.7,0.7,-1.4,1.4,0];
    for(let b=0;b<bCntGreen;b++){
      const ang=bAngles[b]||b*0.5;
      const br=8.5+Math.random()*1.5;
      blist.push({
        x:gX+Math.sin(ang)*br,
        z:gZv+Math.cos(ang)*(12+Math.random()*3),
        r:4.2+Math.random()*2.0,d:true,green:true});
    }
    // フェアウェイバンカー（ホール距離に応じて配置）
    const bCntFW=Math.max(0,Math.min(bunkerCount-2,3));
    for(let b=0;b<bCntFW;b++){
      blist.push({
        x:(b%2===0?-1:1)*(14+Math.random()*7),
        z:-TH*(0.32+b*0.18+Math.random()*0.06),
        r:4.5+Math.random()*2.0,d:false,green:false});
    }
    // 最低1基はフェアウェイバンカー
    if(bunkerCount>0&&bCntFW===0){
      blist.push({x:(Math.random()>0.5?1:-1)*(14+Math.random()*6),
        z:-TH*(0.38+Math.random()*0.12),r:4.5+Math.random()*1.8,d:false,green:false});
    }

    for(const bk of blist){
      this._bunkerZones.push({ x: bk.x, z: bk.z, r: bk.r, radius: bk.r });
      const gy=gen.getHeight(bk.x+TW/2,-bk.z-TH/2);
      // 窪み（暗い影）
      addC(new THREE.CylinderGeometry(bk.r*1.08,bk.r*1.2,0.45,30),0xb89850)
        .position.set(bk.x,gy-0.14,bk.z);
      // 砂面（本格的な砂色）
      addC(new THREE.CylinderGeometry(bk.r,bk.r*1.04,0.16,30),bk.d?0xf2e2b0:0xeeda98)
        .position.set(bk.x,gy+0.03,bk.z);
      // 砂中央ハイライト（白っぽい）
      addC(new THREE.CylinderGeometry(bk.r*0.52,bk.r*0.58,0.1,22),0xfaeeca)
        .position.set(bk.x+0.6,gy+0.055,bk.z+0.5);
      // 砂の影（縁に近い暗部）
      addC(new THREE.CylinderGeometry(bk.r*0.88,bk.r,0.08,26),0xd8c07a)
        .position.set(bk.x-0.4,gy+0.04,bk.z-0.3);
      // 縁芝（3層で厚み表現）
      const rimColors=[0x2a7818,0x246c14,0x1e6010];
      const rimW=[0.72,0.45,0.28];
      const rimR=[1.06,1.12,1.18];
      for(let r=0;r<3;r++){
        const rim=new THREE.Mesh(
          new THREE.TorusGeometry(bk.r*rimR[r],rimW[r],9,30),
          new THREE.MeshBasicMaterial({color:rimColors[r]}));
        rim.rotation.x=Math.PI/2;rim.position.set(bk.x,gy+0.22-r*0.04,bk.z);
        this.scene.add(rim);
      }
      // レーキ跡（細かい同心円・8本）
      const nRake=bk.d?9:6;
      for(let r=1;r<=nRake;r++){
        const rr=r*(bk.r/nRake);
        const rake=new THREE.Mesh(
          new THREE.TorusGeometry(rr,0.035,4,22),
          new THREE.MeshBasicMaterial({color:0xdcc87e,transparent:true,opacity:0.72}));
        rake.rotation.x=Math.PI/2;rake.position.set(bk.x,gy+0.08,bk.z);
        this.scene.add(rake);
      }
      // レーキ跡縦（クロスハッチ感）
      for(let r=1;r<=Math.floor(nRake/2);r++){
        const cross=new THREE.Mesh(
          new THREE.PlaneGeometry(bk.r*2-r*0.5,0.06),
          new THREE.MeshBasicMaterial({color:0xdcc87e,transparent:true,opacity:0.4}));
        cross.rotation.x=-Math.PI/2;cross.position.set(bk.x,gy+0.09,bk.z+r*(bk.r/nRake)-bk.r/2);
        this.scene.add(cross);
      }
    }

    // ═══════════════════════════════════════════════════════
    // ⑥  池・水ハザード（超リアル・7レイヤー）feat完全連動
    // ═══════════════════════════════════════════════════════
    // water_left / water_right / water_front / ocean それぞれ描画
    const waterDefs=[];
    if(hasWaterLeft)  waterDefs.push({wx:-(TW*0.54),wz:-TH*0.48,wW:TW*0.38,wH:TH*0.30,stakes:"yellow"});
    if(hasWaterRight) waterDefs.push({wx:TW*0.54, wz:-TH*0.46,wW:TW*0.38,wH:TH*0.28,stakes:"yellow"});
    if(hasWaterFront){
      // ★ 横幅一面OB（TW*0.82）を廃止し、バランスの良いプロ仕様レイアウト（TW*0.52）に改善
      // 左〜中央寄りに配置し、右サイドに安全なフェアウェイ・花道迂回路を確保！
      const waterW = TW * 0.52;
      const waterX = -(TW * 0.14);
      waterDefs.push({wx: waterX, wz: gZv + TH * 0.08, wW: waterW, wH: TH * 0.12, stakes: "yellow"});
    }
    // 後方互換（旧featフォーマット）
    const hasPondOld=hole.feat&&(hole.feat.includes("池")||hole.feat.includes("水"))
      &&!hasWaterLeft&&!hasWaterRight&&!hasWaterFront;
    if(hasPondOld&&!hasIslandGreen){
      waterDefs.push({wx:hole.feat.includes("左")?-(TW*0.52):TW*0.52,
        wz:-TH*0.52,wW:TW*0.36,wH:TH*0.26,stakes:"yellow"});
    }
    for(const wd of waterDefs){
      const {wx,wz:wz2,wW,wH}=wd;
      const isNarrow=wH<TH*0.15;
      if(true){

      // L1: 水底（最暗・藻の色）
      const bed=new THREE.Mesh(new THREE.PlaneGeometry(wW+8,wH+8),
        new THREE.MeshBasicMaterial({color:0x060e14}));
      bed.rotation.x=-Math.PI/2;bed.position.set(wx,-0.28,wz2);this.scene.add(bed);
      // L2: 水底浅瀬色
      const shallow=new THREE.Mesh(new THREE.PlaneGeometry(wW+2,wH+2),
        new THREE.MeshBasicMaterial({color:0x0c2030,transparent:true,opacity:0.95}));
      shallow.rotation.x=-Math.PI/2;shallow.position.set(wx,-0.18,wz2);this.scene.add(shallow);
      // L3: 深水エリア
      const deep=new THREE.Mesh(new THREE.PlaneGeometry(wW*0.7,wH*0.7),
        new THREE.MeshBasicMaterial({color:0x082848,transparent:true,opacity:0.9}));
      deep.rotation.x=-Math.PI/2;deep.position.set(wx,-0.12,wz2);this.scene.add(deep);
      // L4: メイン水面
      const wC=rain?0x1a3a58:fog?0x1e3c50:0x0e4f86; /* v4.15: 空撮で池が淡い水色に見えていたため深い青にする（飽和青に寄せる）。 */
      const water=new THREE.Mesh(new THREE.PlaneGeometry(wW,wH),
        new THREE.MeshBasicMaterial({color:wC,transparent:true,opacity:0.9}));
      water.rotation.x=-Math.PI/2;water.position.set(wx,-0.02,wz2);this.scene.add(water);
      // L5: 水面ハイライト（キラキラ反射・細かい）
      const nG=mob?8:20;
      for(let w=0;w<nG;w++){
        const gw=0.8+Math.random()*6,gh=0.1+Math.random()*0.22;
        const glint=new THREE.Mesh(new THREE.PlaneGeometry(gw,gh),
          new THREE.MeshBasicMaterial({color:0xb8d8f0,transparent:true,opacity:0.15+Math.random()*0.2}));
        glint.rotation.x=-Math.PI/2;glint.rotation.z=(Math.random()-0.5)*0.7;
        glint.position.set(wx+(Math.random()-0.5)*wW*0.8,0.005,wz2+(Math.random()-0.5)*wH*0.75);
        this.scene.add(glint);
      }
      // L6: 波紋（同心円・淡い）
      for(let r=1;r<=4;r++){
        const wr=new THREE.Mesh(
          new THREE.RingGeometry(r*2.5,r*2.5+0.15,32),
          new THREE.MeshBasicMaterial({color:0x5898c8,transparent:true,opacity:0.22-r*0.04,side:THREE.DoubleSide}));
        wr.rotation.x=-Math.PI/2;wr.position.set(wx+1,0.01,wz2-1);this.scene.add(wr);
      }

      // L7: 岸辺（自然な傾斜・湿地帯）
      // 泥・湿地
      const mud=new THREE.Mesh(new THREE.PlaneGeometry(wW+8,wH+8),
        new THREE.MeshBasicMaterial({color:0x1e3018,transparent:true,opacity:0.8}));
      mud.rotation.x=-Math.PI/2;mud.position.set(wx,-0.08,wz2);this.scene.add(mud);
      // 護岸石（多数・自然配置）
      const nSt=mob?10:28;
      for(let s=0;s<nSt;s++){
        const ang=s/nSt*Math.PI*2;
        const er=wW/2+0.8+Math.random()*2.2,ver=wH/2+0.8+Math.random()*1.8;
        const sc=[0x484e38,0x3a4430,0x52583e,0x404838][s%4];
        const stone=new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.5+Math.random()*0.8,0),
          new THREE.MeshBasicMaterial({color:sc}));
        stone.scale.set(1,0.4+Math.random()*0.4,1);
        stone.position.set(wx+Math.cos(ang)*er,-0.05,wz2+Math.sin(ang)*ver);
        stone.rotation.y=Math.random()*Math.PI;this.scene.add(stone);
      }
      // 水際の芝（緑と水の境界）
      for(let s=0;s<(mob?6:16);s++){
        const ang=s/(mob?6:16)*Math.PI*2;
        const er=wW/2+2.2,ver=wH/2+2.0;
        const wg=new THREE.Mesh(
          new THREE.CylinderGeometry(0.06,0.22,0.55+Math.random()*0.45,5),
          new THREE.MeshBasicMaterial({color:0x1e5c10}));
        wg.position.set(wx+Math.cos(ang)*er,0.2,wz2+Math.sin(ang)*ver);this.scene.add(wg);
      }

      // 黄色杭（精巧グループ・12本）
      for(let s=0;s<12;s++){
        const yg=new THREE.Group();
        const yb=new THREE.Mesh(
          new THREE.CylinderGeometry(0.08,0.1,1.32,7),
          new THREE.MeshBasicMaterial({color:0xffdd00}));
        yb.position.y=0.66;yg.add(yb);
        const yt=new THREE.Mesh(
          new THREE.SphereGeometry(0.12,7,5),
          new THREE.MeshBasicMaterial({color:0xffc800}));
        yt.position.y=1.36;yg.add(yt);
        const side=s%2===0;
        const yx=wx+(side?-wW/2-1.6:wW/2+1.6);
        const yz=wz2-wH/2+s*(wH/12)+wH/24;
        yg.position.set(yx,0,yz);this.scene.add(yg);
      }

      this.obZones.push([
        new THREE.Vector2(wx-wW/2,wz2-wH/2),new THREE.Vector2(wx+wW/2,wz2-wH/2),
        new THREE.Vector2(wx+wW/2,wz2+wH/2),new THREE.Vector2(wx-wW/2,wz2+wH/2)
      ]);
      } // end if(true)
    } // end waterDefs loop
    if(hole.name==="Island Green"){
      const ig=addC(new THREE.CylinderGeometry(13.5,14.5,0.6,40),0x3dbb28);
      ig.position.set(gX,0.25,gZv);
      const ocean=new THREE.PlaneGeometry(110,110);ocean.rotateX(-Math.PI/2);
      this.scene.add(new THREE.Mesh(ocean,new THREE.MeshBasicMaterial({color:0x0c4280,transparent:true,opacity:0.93})));
      this.obZones.push([new THREE.Vector2(-55,gZv-55),new THREE.Vector2(55,gZv-55),new THREE.Vector2(55,gZv+55),new THREE.Vector2(-55,gZv+55)]);
    }

    // ═══════════════════════════════════════════════════════
    // ⑦  グリーン（コース別形状・5層構造・最高品質）
    // ═══════════════════════════════════════════════════════
    const gY=0.52;
    // ★ コース別グリーンサイズ・色（cid/isAugusta等は冒頭で定義済み）
    const gR=isAugusta?11.2:isStAndrews?10.6:isPebble?9.6:isSawgrass?8.5:9.5;
    const gColMain=isAugusta?(rain?0x2aa010:0x42d818):isLinks?(rain?0x28880a:0x3aaa18):(rain?0x28a010:0x40cc18);
    // L1: 土台（土手）
    addC(new THREE.CylinderGeometry(gR+2.3,gR+3.8,0.95,40),0x144808).position.set(gX,gY-0.46,gZv);
    // L2: 外縁ラフ移行帯
    addC(new THREE.CylinderGeometry(gR+1.6,gR+2.0,0.32,36),0x1e6010).position.set(gX,gY+0.0,gZv);
    // L3: フリンジ外
    addC(new THREE.CylinderGeometry(gR+1.0,gR+1.4,0.25,36),0x2a8018).position.set(gX,gY+0.06,gZv);
    // L4: フリンジ内（エプロン）
    addC(new THREE.CylinderGeometry(gR+0.3,gR+0.8,0.22,36),0x38a822).position.set(gX,gY+0.1,gZv);
    // L5: グリーン本体
    addC(new THREE.CylinderGeometry(gR,gR+0.3,0.30,40),gColMain).position.set(gX,gY,gZv);
    this.greenPos={x:gX,z:gZv,r:gR+0.3,y:gY};

    // グリーン刈り目（3トーン・8本縞）
    const gSW=2.3,nGS=8;
    const gT=[0x42d018,0x4ae820,0x3cc018];
    for(let s=0;s<nGS;s++){
      const gst=new THREE.Mesh(
        new THREE.PlaneGeometry(gSW-0.06,18.5),
        new THREE.MeshBasicMaterial({color:gT[s%3],transparent:true,opacity:0.42}));
      gst.rotation.x=-Math.PI/2;
      gst.position.set(gX-nGS*gSW/2+gSW*(s+0.5),gY+0.17,gZv);this.scene.add(gst);
    }

    // アンジュレーション（傾斜矢印 + 等高線）
    const sDir=Math.random()*Math.PI*2;
    const aS=new THREE.Shape();
    aS.moveTo(0,2.8);aS.lineTo(-1.15,-0.55);aS.lineTo(-0.44,-0.24);
    aS.lineTo(-0.44,-1.9);aS.lineTo(0.44,-1.9);aS.lineTo(0.44,-0.24);aS.lineTo(1.15,-0.55);aS.closePath();
    const aMesh=new THREE.Mesh(new THREE.ShapeGeometry(aS),
      new THREE.MeshBasicMaterial({color:0x00ffd0,transparent:true,opacity:0.82,side:THREE.DoubleSide}));
    aMesh.rotation.x=-Math.PI/2;aMesh.rotation.z=sDir;aMesh.position.set(gX,gY+0.18,gZv);
    this.scene.add(aMesh);
    // サブ矢印（4隅）
    for(let a=0;a<4;a++){
      const ang=sDir+a*Math.PI/2;
      const sAS=new THREE.Shape();
      sAS.moveTo(0,1.1);sAS.lineTo(-0.5,-0.22);sAS.lineTo(0.5,-0.22);sAS.closePath();
      const sAM=new THREE.Mesh(new THREE.ShapeGeometry(sAS),
        new THREE.MeshBasicMaterial({color:0x00ffb0,transparent:true,opacity:0.58,side:THREE.DoubleSide}));
      sAM.rotation.x=-Math.PI/2;sAM.rotation.z=sDir;
      sAM.position.set(gX+Math.cos(ang)*5.8,gY+0.18,gZv+Math.sin(ang)*5.8);this.scene.add(sAM);
    }
    // 等高線リング（4本）
    for(let c=0;c<4;c++){
      const cr=2.2+c*2.2;
      const ct=new THREE.Mesh(
        new THREE.TorusGeometry(cr,0.065,5,32),
        new THREE.MeshBasicMaterial({color:0x00ee99,transparent:true,opacity:0.55}));
      ct.rotation.x=Math.PI/2;ct.position.set(gX,gY+0.17,gZv);this.scene.add(ct);
    }
    // カップリング（白円）
    const cupR=new THREE.Mesh(
      new THREE.RingGeometry(0.52,0.82,24),
      new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.65,side:THREE.DoubleSide}));
    cupR.rotation.x=-Math.PI/2;cupR.position.set(gX,gY+0.19,gZv);this.scene.add(cupR);
    this._slopeDir=sDir;

    // ═══════════════════════════════════════════════════════
    // ⑧  ティーイングエリア（コース別・最高品質）
    // ═══════════════════════════════════════════════════════
    // (isStAndrews は冒頭で定義済み)

    // ティー芝色（コース別）
    const teeGreen=isAugusta?(rain?0x309020:0x48d828):isLinks?(rain?0x2a6820:0x3a9828):(rain?0x2a6818:0x40b820);
    addC(new THREE.BoxGeometry(14,0.3,10),teeGreen).position.set(0,0.15,-2);

    // ティー刈り目（コース別幅）
    const tswid=isAugusta?1.8:2.0;
    const tsCount=Math.floor(14/tswid);
    for(let s=0;s<tsCount;s++){
      const tsDark=isAugusta?(rain?0x2a8018:0x3ec020):rain?0x256015:0x38a818;
      const tsLight=isAugusta?(rain?0x309820:0x48d028):rain?0x2a6818:0x44b822;
      const ts=new THREE.Mesh(
        new THREE.PlaneGeometry(tswid-0.06,9.8),
        new THREE.MeshBasicMaterial({color:s%2===0?tsDark:tsLight,transparent:true,opacity:0.50}));
      ts.rotation.x=-Math.PI/2;ts.position.set(-7+tswid*(s+0.5),0.17,-2);this.scene.add(ts);
    }
    // ティー前線（白線）
    const tfl=new THREE.Mesh(new THREE.PlaneGeometry(13.5,0.18),
      new THREE.MeshBasicMaterial({color:0xf8f8f8}));
    tfl.rotation.x=-Math.PI/2;tfl.position.set(0,0.19,-6.8);this.scene.add(tfl);

    // ティーマーカー（コース別カラー）
    const mkCol=isAugusta?0x22aa22:isSawgrass?0xcc2200:isPebble?0x003388:isStAndrews?0x4444aa:0xcc0000;
    const mkCol2=isAugusta?0x44ee44:isSawgrass?0xff4422:isPebble?0x0055cc:isStAndrews?0x6666cc:0xff2222;
    for(const sx of[-2.6,2.6]){
      const mk=new THREE.Group();
      const mb=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,0.50,10),
        new THREE.MeshLambertMaterial({color:mkCol}));
      mb.position.y=0.25;mk.add(mb);
      const mt=new THREE.Mesh(new THREE.SphereGeometry(0.26,10,8),
        new THREE.MeshLambertMaterial({color:mkCol2}));
      mt.position.y=0.58;mk.add(mt);
      mk.position.set(sx,0.3,-2);this.scene.add(mk);
    }

    // Augusta専用: ギャラリーロープ（白）
    if(isAugusta&&!mob){
      const ropePostMat=new THREE.MeshLambertMaterial({color:0xf0efe8});
      const ropeMat=new THREE.MeshBasicMaterial({color:0xe8e8d8,transparent:true,opacity:0.8});
      for(let ri=0;ri<6;ri++){
        const rpx=-12+ri*4.8;
        const rp=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,1.4,5),ropePostMat);
        rp.position.set(rpx,1.0,-8);this.scene.add(rp);
        if(ri<5){
          const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,4.8,5),ropeMat);
          rope.rotation.z=Math.PI/2;rope.position.set(rpx+2.4,0.9,-8);this.scene.add(rope);
        }
      }
    }
    // リンクス専用: 石積み壁（St Andrews風）
    if(isStAndrews&&!mob){
      const wallMat=new THREE.MeshLambertMaterial({color:rain?0x6a6050:0x8a7a68});
      for(let wi=0;wi<8;wi++){
        const wb=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.6,0.6),wallMat);
        wb.position.set(-7+wi*2,-0.1,-9);this.scene.add(wb);
      }
    }
    // カート道（コース別）
    if(!isLinks){ // リンクスにカート道なし
      const cpW=3.2,cpZ=-TH*0.27;
      const cpX=isAugusta?-(TW/2-5.8):(TW/2-5.8); // Augusta=左側
      const cpCol=isAugusta?0x8a8478:0x9c9488;
      const cpBorder=isAugusta?0xa09888:0xb4a898;
      addC(new THREE.BoxGeometry(cpW,0.08,TH*0.44),cpCol).position.set(cpX,0.04,cpZ);
      for(const sdC of[-1,1]){
        addC(new THREE.BoxGeometry(0.18,0.1,TH*0.44),cpBorder)
          .position.set(cpX+sdC*(cpW/2+0.09),0.05,cpZ);
      }
      for(let d=0;d<8;d++){
        addC(new THREE.BoxGeometry(cpW*0.82,0.06,0.7),0xc0b8a0)
          .position.set(cpX,0.05,-TH*0.1-d*(TH*0.042/8*5));
      }
    }

    // ═══════════════════════════════════════════════════════
    // ⑨  木・植生（コース別樹種・最高密度・自然配置）
    // ═══════════════════════════════════════════════════════
    // コース変数はメソッド冒頭で定義済み（cid/isAugusta/isStAndrews/isPebble/isSawgrass）

    // Augusta: 密な樹木（マグノリア・パイン）、Links: 少なめ
    const nTrees=mob?(isAugusta?10:isLinks?3:7):(isAugusta?26:isLinks?4:16);
    // Augusta専用: 左右に密に植樹（コース特徴）
    for(let t=0;t<nTrees;t++){
      let sx, sz, ttype, tsize;
      if(isAugusta){
        // Augusta: フェアウェイ両側に密植（幅60yd内→外に）
        sx=(Math.random()>0.5?1:-1)*(TW/2*0.42+Math.random()*TW*0.38);
        sz=-TH*(0.05+Math.random()*0.87);
        ttype=Math.random()<0.55?"broad":"pine"; // マグノリア・広葉多め
        tsize=1.8+Math.random()*2.2;
      } else if(isLinks){
        // Links: 木は少なく、端に数本のみ
        sx=(Math.random()>0.5?1:-1)*(TW/2*0.72+Math.random()*TW*0.18);
        sz=-TH*(0.1+Math.random()*0.78);
        ttype="pine"; tsize=1.0+Math.random()*1.4;
      } else if(isPebble){
        // Pebble: 海側は少なめ、内陸側に広葉樹
        sx=(Math.random()>0.5?1:-1)*(TW/2*0.48+Math.random()*TW*0.32);
        sz=-TH*(0.08+Math.random()*0.82);
        ttype=Math.random()<0.4?"broad":"pine";
        tsize=1.4+Math.random()*2.0;
      } else {
        sx=(Math.random()>0.5?1:-1)*(TW/2*0.50+Math.random()*TW*0.36);
        sz=-TH*(0.06+Math.random()*0.84);
        ttype=Math.random()<0.45?"broad":"pine";
        tsize=1.5+Math.random()*2.2;
      }
      if(Math.sqrt((sx-gX)**2+(sz-gZv)**2)<22||Math.sqrt(sx*sx+sz*sz)<12)continue;
      this._addTree(sx,sz,gen,tsize,ttype);
    }

    // Augusta専用: フェアウェイ奥（グリーン背後）の木々群
    if(isAugusta&&!mob){
      for(let bt=0;bt<8;bt++){
        const bx=(Math.random()-0.5)*TW*0.8;
        const bz=gZv-12-Math.random()*20;
        if(Math.sqrt((bx-gX)**2+(bz-gZv)**2)<16)continue;
        this._addTree(bx,bz,gen,1.6+Math.random()*1.8,"broad");
      }
    }

    // コース別草むら（ラフ質感）
    const nTufts=mob?8:isAugusta?40:isLinks?15:22;
    const tuftCols=isLinks?[0x4a5820,0x586828,0x404018,0x505020]:
                   isAugusta?[0x246814,0x1e6010,0x2a7018,0x1a5818]:
                   [0x246814,0x1e5c10,0x2a7018,0x1a5410];
    for(let g=0;g<nTufts;g++){
      const gxMin=isAugusta?TW/2*0.08:TW/2*0.12;
      const gxRange=isAugusta?TW*0.30:TW*0.24;
      const gx=(Math.random()>0.5?1:-1)*(gxMin+Math.random()*gxRange);
      const gz=-TH*(0.05+Math.random()*0.9);
      const gy2=gen.getHeight(gx+TW/2,-gz-TH/2);
      if(Math.sqrt((gx-gX)**2+(gz-gZv)**2)<18)continue;
      const gh=isAugusta?0.6+Math.random()*1.1:0.45+Math.random()*0.85;
      const tft=new THREE.Mesh(
        new THREE.CylinderGeometry(0.04,0.20,gh,5),
        new THREE.MeshLambertMaterial({color:tuftCols[Math.floor(Math.random()*4)]}));
      tft.position.set(gx,gy2+gh/2,gz);this.scene.add(tft);
    }

    // リンクスのポットバンカー周辺の草むら
    if(isLinks&&!mob){
      for(let lb=0;lb<12;lb++){
        const lx=(Math.random()-0.5)*TW*1.2;
        const lz=-TH*(0.15+Math.random()*0.65);
        if(Math.abs(lx)<TW*0.42)continue;
        const gy3=gen.getHeight(lx+TW/2,-lz-TH/2);
        const lh=0.4+Math.random()*0.7;
        const lft=new THREE.Mesh(
          new THREE.CylinderGeometry(0.05,0.22,lh,5),
          new THREE.MeshLambertMaterial({color:[0x4a5818,0x585828,0x484010][lb%3]}));
        lft.position.set(lx,gy3+lh/2,lz);this.scene.add(lft);
      }
    }
    // 岩（自然配置）
    if(!mob){
      for(let i=0;i<6;i++){
        const rx=(Math.random()-0.5)*TW*0.75;
        const rz=-TH*(0.1+Math.random()*0.75);
        if(Math.sqrt((rx-gX)**2+(rz-gZv)**2)<26)continue;
        const rs=0.35+Math.random()*1.2;
        const gy2=gen.getHeight(rx+TW/2,-rz-TH/2);
        const rock=new THREE.Mesh(
          new THREE.DodecahedronGeometry(rs,0),
          new THREE.MeshBasicMaterial({color:[0x5e5850,0x686058,0x505048,0x6a6260][i%4]}));
        rock.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,0);
        rock.position.set(rx,gy2+rs*0.26,rz);this.scene.add(rock);
      }
    }

    // 位置・OBゾーン
    this.teePos.set(0,0.36,0);
    this.pinPos.set(gX,gY+0.45,gZv);
    // ★★★ feat別リアル地形追加 ★★★
    const gpx=gX, gpz=gZv;
    // ─── 水ハザード（左） ───
    if(hasWaterLeft){
      const wW=TW*0.42, wH=TH*(0.28+Math.random()*0.18);
      const wX=-(TW*0.58);const wZ=-(TH*0.45);
      addWater(new THREE.PlaneGeometry(wW,wH),wX,wZ,0.05);
      add(new THREE.PlaneGeometry(wW+3,wH+3),rain?0x2a4a2a:0x4a6a4a,0.03,wX,wZ);
    }
    // ─── 水ハザード（右） ───
    if(hasWaterRight){
      const wW=TW*0.42, wH=TH*(0.26+Math.random()*0.16);
      const wX=TW*0.58;const wZ=-(TH*0.43);
      addWater(new THREE.PlaneGeometry(wW,wH),wX,wZ,0.05);
      add(new THREE.PlaneGeometry(wW+3,wH+3),rain?0x2a4a2a:0x4a6a4a,0.03,wX,wZ);
    }
    // ─── 水ハザード（手前グリーン前） ───
    if(hasWaterFront){
      const wW=TW*0.9, wH=TH*0.11;
      const wZf=gpz+TH*0.10;
      // 川底（Augusta=Rae's Creek風）
      const isRaeCreek=isAugusta;
      // 川底の石や砂
      add(new THREE.PlaneGeometry(wW+7,wH+5),isRaeCreek?(rain?0x3a3020:0x4a4030):0x2a4a2a,0.02,0,wZf);
      // 水面（川）
      const creek=new THREE.Mesh(new THREE.PlaneGeometry(wW,wH),
        new THREE.MeshPhongMaterial({
          color:isRaeCreek?(rain?0x1a3a50:0x1a6090):rain?0x0e2844:0x1a70b0,
          transparent:true,opacity:0.88,shininess:180,specular:0x66aaee
        }));
      creek.rotation.x=-Math.PI/2; creek.position.set(0,0.04,wZf); this.scene.add(creek);
      // 波紋
      for(let r=1;r<=3;r++){
        const wr=new THREE.Mesh(new THREE.PlaneGeometry(wW*0.8,0.18),
          new THREE.MeshBasicMaterial({color:0x88bbdd,transparent:true,opacity:0.25}));
        wr.rotation.x=-Math.PI/2; wr.position.set(0,0.06,wZf-wH*0.25+r*(wH*0.18));
        this.scene.add(wr);
      }
      // Augusta→橋（木製・Rae's Creek橋を再現）
      if(isRaeCreek&&!mob){
        const bridgeGeo=new THREE.BoxGeometry(TW*0.45,0.25,wH*0.9);
        const bridge=new THREE.Mesh(bridgeGeo,new THREE.MeshLambertMaterial({color:rain?0x4a3818:0x6a5028}));
        bridge.position.set(0,0.28,wZf); this.scene.add(bridge);
        // 橋のレール
        for(const bx of [-TW*0.21,TW*0.21]){
          const rail=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.5,wH),
            new THREE.MeshLambertMaterial({color:0x5a4018}));
          rail.position.set(bx,0.55,wZf); this.scene.add(rail);
        }
      }
    }
    // ─── Island Green（TPC Sawgrass 17番 精巧再現）───
    if(hasIslandGreen){
      // 池全体（グリーン周囲すべて水）
      const igPool=new THREE.Mesh(new THREE.PlaneGeometry(TW*1.05,TH*0.45),
        new THREE.MeshPhongMaterial({color:rain?0x0e2844:0x0e4880,transparent:true,opacity:0.92,shininess:220,specular:0x44aaff}));
      igPool.rotation.x=-Math.PI/2; igPool.position.set(0,-0.05,gpz+TH*0.04); this.scene.add(igPool);
      // 波紋
      for(let r=1;r<=6;r++){
        const wr=new THREE.Mesh(new THREE.RingGeometry(r*2.8,r*2.8+0.12,40),
          new THREE.MeshBasicMaterial({color:0x4488cc,transparent:true,opacity:0.18-r*0.02,side:THREE.DoubleSide}));
        wr.rotation.x=-Math.PI/2; wr.position.set(gpx,0.02,gpz); this.scene.add(wr);
      }
      // 島の基盤（石積み壁）
      const iWall=new THREE.Mesh(new THREE.CylinderGeometry(11.5,13.5,1.8,24),
        new THREE.MeshLambertMaterial({color:rain?0x4a4030:0x6a5840}));
      iWall.position.set(gpx,0.5,gpz); this.scene.add(iWall);
      // 島の土台（濃緑）
      const iBase=new THREE.Mesh(new THREE.CylinderGeometry(10.5,11.2,0.5,24),
        new THREE.MeshLambertMaterial({color:rain?0x224818:0x2a6020}));
      iBase.position.set(gpx,1.2,gpz); this.scene.add(iBase);
      // フリンジ
      const ifringe=new THREE.Mesh(new THREE.CylinderGeometry(9.8,10.3,0.22,24),
        new THREE.MeshLambertMaterial({color:rain?0x2a6018:0x349a20}));
      ifringe.position.set(gpx,1.35,gpz); this.scene.add(ifringe);
      // 橋（桟橋）
      const bridgeGeo=new THREE.BoxGeometry(3.5,0.3,14);
      const bridgeMat=new THREE.MeshLambertMaterial({color:rain?0x5a4a2a:0x7a6038});
      const bridge=new THREE.Mesh(bridgeGeo,bridgeMat);
      bridge.position.set(gpx,0.7,gpz+TH*0.08); this.scene.add(bridge);
      // 橋の柵
      if(!mob){
        for(let pi=0;pi<4;pi++){
          const post=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,1.2,5),
            new THREE.MeshLambertMaterial({color:0x8a6828}));
          post.position.set(gpx+(pi<2?-1.5:1.5),1.35,gpz+TH*0.06+pi%2*5);
          this.scene.add(post);
        }
      }
    }
    // ─── ドッグレッグ: 曲がり角の樹木壁（コース別樹種）───
    if(hasLeftDogleg||hasRightDogleg){
      const dlZ=-(TH*0.40+Math.random()*TH*0.05);
      const dlSide=hasRightDogleg?1:-1;
      const dlX=dlSide*(TW*0.25);
      // cid3 -> cid
      // Augusta特有の樹種・密度
      const tCount=mob?(isAugusta?4:3):(isAugusta?8:6);
      const treeType=isAugusta?"broad":isLinks?"pine":"pine";
      for(let ti=0;ti<tCount;ti++){
        const spread=isAugusta?14:12;
        const tx=dlX+(Math.random()-0.5)*spread;
        const tz2=dlZ+(Math.random()-0.5)*18;
        const sm=1.4+Math.random()*1.8;
        this._addTree(tx,tz2,gen,sm,treeType);
      }
      // 反対サイドにも少数の木（フェアウェイ感）
      const tCount2=mob?1:3;
      for(let ti=0;ti<tCount2;ti++){
        const tx2=-dlX*0.4+(Math.random()-0.5)*8;
        const tz2=-TH*(0.18+Math.random()*0.14);
        this._addTree(tx2,tz2,gen,0.9+Math.random()*1.2,"pine");
      }
      // ドッグレッグのFW延長部分
      const dlFWx=dlSide*TW*0.17;
      add(new THREE.PlaneGeometry(TW*0.52,TH*0.28),
        rain?0x2a6010:fog?0x38821a:0x3cb825,-0.01,dlFWx,dlZ);
      // Augusta白ロープ柵（スペクテイターロープ）
      if(isAugusta&&!mob){
        for(let ri=0;ri<6;ri++){
          const post=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,1.4,5),
            new THREE.MeshLambertMaterial({color:0xf0f0e8}));
          post.position.set(dlX*0.9+(ri-3)*4,this.getGY(dlX*0.9+(ri-3)*4,dlZ*0.85)+0.7,dlZ*0.85);
          this.scene.add(post);
        }
      }
    }
    // ─── 砲台グリーン ───
    if(hasElevGreen){
      const eBase=new THREE.Mesh(new THREE.CylinderGeometry(12,15,2,16),
        new THREE.MeshLambertMaterial({color:rain?0x2a5020:0x3a6828}));
      eBase.position.set(gpx,this.getGY(gpx,gpz)+0.9,gpz);this.scene.add(eBase);
    }
    // ─── OB左: 白杭（OBは白杭が正式ルール）───
    if(hasOBLeft&&!mob){
      for(let si=0;si<9;si++){
        const sz2=-(TH*0.06+si*(TH*0.10));
        const sx2=-(TW*0.45+Math.random()*1.5);
        const stkH=1.4+Math.random()*0.3;
        const stk=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.12,stkH,5),
          new THREE.MeshLambertMaterial({color:0xf0f0f0}));
        stk.position.set(sx2,this.getGY(sx2,sz2)+stkH*0.5,sz2);this.scene.add(stk);
        // 杭のトップに白ペイント感（少し太め）
        const top=new THREE.Mesh(new THREE.SphereGeometry(0.11,5,4),
          new THREE.MeshLambertMaterial({color:0xffffff}));
        top.position.set(sx2,this.getGY(sx2,sz2)+stkH+0.05,sz2);this.scene.add(top);
      }
    }
    // ─── コースタル/崖: 崖の地形 ───
    if(hasCliff&&!mob){
      add(new THREE.PlaneGeometry(TW*0.3,TH*0.8),rain?0x5a5040:0x8a7a60,-0.1,
        hasWaterLeft?-(TW*0.38):TW*0.38,-TH*0.4);
    }
    const hw=TW*1.92/2;
    this.obZones.push([new THREE.Vector2(-hw,-TH*1.14),new THREE.Vector2(-TW/2-2.1,-TH*1.14),new THREE.Vector2(-TW/2-2.1,6),new THREE.Vector2(-hw,6)]);
    this.obZones.push([new THREE.Vector2(TW/2+2.1,-TH*1.14),new THREE.Vector2(hw,-TH*1.14),new THREE.Vector2(hw,6),new THREE.Vector2(TW/2+2.1,6)]);
    this.obZones.push([new THREE.Vector2(-hw,-TH*1.19),new THREE.Vector2(hw,-TH*1.19),new THREE.Vector2(hw,-TH*1.09),new THREE.Vector2(-hw,-TH*1.09)]);
  }

  _addTree(x,z,gen,sm,type="pine"){
    /* v4.4: 円錐/球を廃止し、幹+複数クラスタの樹冠に置換（色ばらつき・葉テクスチャ） */
    const gy=gen.getHeight(x+this.terrainW/2,-z-this.terrainH/2);
    const mob=this.isMobile;
    const rain=this.weather&&this.weather.type==="rain";
    const H=window.HQG; const leafTex=(H&&H.tex&&H.tex.leaf_map)?H.tex.leaf_map:null;
    let seed=Math.floor(Math.abs(x*131.7+z*57.3))%9973+11;
    const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
    const trunkH=(2.6+rnd()*1.6)*sm;
    const trunk=new THREE.Mesh(
      new THREE.CylinderGeometry(0.22*sm,0.40*sm,trunkH,7),
      new THREE.MeshLambertMaterial({color:rain?0x33241a:0x402a14})
    );
    trunk.position.set(x,gy+trunkH*0.5,z);
    trunk.castShadow=!mob; trunk.receiveShadow=!mob;
    this.scene.add(trunk);
    const greens=rain?[0x14351a,0x1a4520,0x0f2c14]:[0x1d4d16,0x27631d,0x2e6b22,0x1a4218];
    const nCl=(type==="pine")?4:3;
    const crownR=(type==="pine"?2.5:3.1)*sm;
    for(let k=0;k<nCl;k++){
      const cr=crownR*(1.0-k*0.16)*(0.85+rnd()*0.3);
      const cm=new THREE.MeshLambertMaterial({color:greens[Math.floor(rnd()*greens.length)]});
      if(leafTex){ cm.map=leafTex; }
      const blob=new THREE.Mesh(new THREE.IcosahedronGeometry(cr,1),cm);
      blob.position.set(
        x+(rnd()-0.5)*crownR*0.9,
        gy+trunkH+cr*0.55+k*(type==="pine"?1.15:0.8)*sm,
        z+(rnd()-0.5)*crownR*0.9);
      blob.scale.y=0.82;
      blob.castShadow=!mob;
      this.scene.add(blob);
    }
  }

  // ★ グリーン傾斜矢印（スネークライン可視化）
  _buildSlopeArrows(){
    if(!this.scene||!this.greenPos)return;
    if(this._slopeArrows){
      this._slopeArrows.forEach(a=>{ try{ if(a.geometry) a.geometry.dispose(); if(a.material) a.material.dispose(); }catch(e){} this.scene.remove(a); }); /* v4.15: グリーンオン時の再生成で旧コーンが残留していたため解放する。 */
    }
    this._slopeArrows=[];
    if(!this.greenPos)return;
    const gp=this.greenPos;
    const rows=5,cols=5;
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
      const ox=(j/(cols-1)-0.5)*gp.r*1.6;
      const oz=(i/(rows-1)-0.5)*gp.r*1.6;
      const wx=gp.x+ox, wz=gp.z+oz;
      if(Math.sqrt(ox*ox+oz*oz)>gp.r*1.0)continue;
      // 傾斜方向を計算
      const d=1.2;
      const hL=this.getGY(wx-d,wz);
      const hR=this.getGY(wx+d,wz);
      const hF=this.getGY(wx,wz-d);
      const hB=this.getGY(wx,wz+d);
      const slopeX=(hR-hL)/(2*d);
      const slopeZ=(hB-hF)/(2*d);
      const mag=Math.sqrt(slopeX*slopeX+slopeZ*slopeZ);
      if(mag<0.002)continue;
      const ang=Math.atan2(slopeX,slopeZ);
      const gy=this.getGY(wx,wz);
      // 矢印コーン
      const cone=new THREE.Mesh(
        new THREE.ConeGeometry(0.22,0.7,6),
        new THREE.MeshBasicMaterial({
          color:mag>0.05?0xff4444:mag>0.02?0xffaa00:0x44ff88,
          transparent:true,opacity:0.72
        })
      );
      cone.rotation.x=Math.PI/2;
      cone.rotation.z=-ang;
      cone.position.set(wx,gy+0.35,wz);
      this.scene.add(cone);
      this._slopeArrows.push(cone);
    }
  }


  // ★ 風速・風向に応じたリアルタイム布なびきシミュレーション
  _updateFlagPhysics(dt){
    if(!this._flagMesh || !this._flagBaseGeo) return;
    const posAttr = this._flagMesh.geometry.attributes.position;
    const baseAttr = this._flagBaseGeo.attributes.position;
    const windSpeed = (this.weather && this.weather.windStrength) ? this.weather.windStrength : 3.0;
    const time = performance.now() * 0.005;
    const waveFreq = 2.4;
    const waveSpeed = 2.0 + windSpeed * 0.45;
    const waveAmp = 0.08 + Math.min(0.24, windSpeed * 0.035);

    for(let i = 0; i < posAttr.count; i++){
      const ox = baseAttr.getX(i);
      const oy = baseAttr.getY(i);
      // ポール側（ox = -1.4）は固定、先端（ox = 1.4）に向かって振幅拡大
      const factor = Math.max(0, (ox + 1.4) / 2.8);
      const wave = Math.sin(time * waveSpeed + ox * waveFreq) * Math.cos(time * waveSpeed * 0.5 + oy * 1.5) * factor * waveAmp;
      posAttr.setZ(i, wave);
    }
    posAttr.needsUpdate = true;
  }

  /* コース背景ランドマーク（商用品質アップグレード： グリーン奥にコース別クラブハウス・城郭・石橋・観客席を配置しRPG側の世界観と一致） */
  _buildCourseLandmark(course){
    if(this._landmarkGroup){ this.scene.remove(this._landmarkGroup); this._landmarkGroup=null; }
    if(!this.scene) return;
    const cid=(course&&course.id)||"";
    const gp=this.pinPos||{x:0,y:0.5,z:-190};
    const gx=gp.x*0.5, gz=gp.z-40;
    let gy=gp.y; try{ const h=this.getGY(gx,gz); if(isFinite(h)) gy=h; }catch(e){}
    const grp=new THREE.Group();
    const S=(v,r,m)=>new THREE.MeshStandardMaterial({color:v,roughness:(r===undefined?0.7:r),metalness:(m===undefined?0.05:m)});
    const wallW=S(0xf2ede2,0.8), wallStone=S(0x8d8d94,0.9), roofD=S(0x232733,0.6), roofG=S(0x1e4d32,0.65), gold=S(0xffcf56,0.25,0.85), glass=S(0xbfd9e8,0.15,0.4);
    const dark=(cid.indexOf("dark")>=0||cid.indexOf("divine")>=0);
    /* 台座（地形外でも浮かないよう下へ伸ばす） */
    const plinth=new THREE.Mesh(new THREE.BoxGeometry(30,26,16),wallStone); plinth.position.set(0,-13.4,0); grp.add(plinth);
    function clubhouse(bodyMat, roofMat, cols){
      const b=new THREE.Mesh(new THREE.BoxGeometry(17,6.4,7),bodyMat); b.position.y=3.2; grp.add(b);
      const rf=new THREE.Mesh(new THREE.ConeGeometry(12.6,3.6,4),roofMat); rf.rotation.y=Math.PI/4; rf.position.y=8.2; grp.add(rf);
      if(cols){ for(let i=-2;i<=2;i++){ const c=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.36,6.2,10),wallW); c.position.set(i*3.1,3.1,3.9); grp.add(c); } }
      const win=new THREE.Mesh(new THREE.BoxGeometry(13,2.2,0.2),glass); win.position.set(0,3.6,3.55); grp.add(win);
    }
    if(cid==="augusta_divine"){
      for(let i=-3;i<=3;i++){ const c=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,8.4,12),wallW); c.position.set(i*2.9,4.2,2); grp.add(c); }
      const beam=new THREE.Mesh(new THREE.BoxGeometry(20.5,0.9,3),gold); beam.position.y=8.8; grp.add(beam);
      const pedShape=new THREE.Shape(); pedShape.moveTo(-10.2,0); pedShape.lineTo(10.2,0); pedShape.lineTo(0,3.2); pedShape.closePath();
      const pedGeo=new THREE.ExtrudeGeometry(pedShape,{depth:2.6,bevelEnabled:false}); pedGeo.translate(0,0,-1.3);
      const ped=new THREE.Mesh(pedGeo,wallW); ped.position.y=9.25; grp.add(ped);
    } else if(cid==="toda_dark"||dark){
      const tm=S(0x181a24,0.55), gm=gold;
      for(let lv=0;lv<3;lv++){ const k=1-lv*0.2; const f=new THREE.Mesh(new THREE.BoxGeometry(12*k,3.3,12*k),tm); f.position.y=1.65+lv*3.7; grp.add(f);
        const r=new THREE.Mesh(new THREE.ConeGeometry(10.6*k,1.9,4),gm); r.rotation.y=Math.PI/4; r.position.y=3.7+lv*3.7; grp.add(r); }
    } else if(cid==="sasayama"){
      const base=new THREE.Mesh(new THREE.BoxGeometry(19,2.2,10),wallStone); base.position.y=1.1; grp.add(base);
      const b=new THREE.Mesh(new THREE.BoxGeometry(15,5.6,8),wallW); b.position.y=5.0; grp.add(b);
      const rf=new THREE.Mesh(new THREE.ConeGeometry(11.8,3.4,4),roofD); rf.rotation.y=Math.PI/4; rf.position.y=9.4; grp.add(rf);
    } else if(cid==="standrews"||cid==="standrews_new"){
      const b=new THREE.Mesh(new THREE.BoxGeometry(18,7,8),wallStone); b.position.y=3.5; grp.add(b);
      const rf=new THREE.Mesh(new THREE.ConeGeometry(13,3.4,4),S(0x3a4149,0.7)); rf.rotation.y=Math.PI/4; rf.position.y=8.7; grp.add(rf);
      const ch2=new THREE.Mesh(new THREE.BoxGeometry(1.4,3.4,1.4),wallStone); ch2.position.set(6,9.6,0); grp.add(ch2);
    } else if(cid==="pebble"){
      const b=new THREE.Mesh(new THREE.BoxGeometry(16,5.6,7.5),S(0x9a7c5c,0.8)); b.position.y=2.8; grp.add(b);
      const win=new THREE.Mesh(new THREE.BoxGeometry(13,2.6,0.2),glass); win.position.set(0,3.2,3.8); grp.add(win);
      const rf=new THREE.Mesh(new THREE.ConeGeometry(12,3,4),roofD); rf.rotation.y=Math.PI/4; rf.position.y=7.1; grp.add(rf);
      const lh=new THREE.Group();
      for(let i=0;i<4;i++){ const seg=new THREE.Mesh(new THREE.CylinderGeometry(0.85-i*0.09,0.92-i*0.09,1.9,12), i%2? S(0xc8251d,0.6):wallW); seg.position.y=0.95+i*1.9; lh.add(seg); }
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.5,10,8),S(0xffe9a8,0.3,0.2)); lamp.material.emissive=new THREE.Color(0xffca5f); lamp.material.emissiveIntensity=1.4; lamp.position.y=8.1; lh.add(lamp);
      lh.position.set(13,0,-2); grp.add(lh);
    } else if(cid==="tpcsawgrass"){
      const b=new THREE.Mesh(new THREE.BoxGeometry(19,6.8,8),wallW); b.position.y=3.4; grp.add(b);
      const win=new THREE.Mesh(new THREE.BoxGeometry(16.5,3.6,0.2),glass); win.position.set(0,3.6,4.05); grp.add(win);
      const rf=new THREE.Mesh(new THREE.BoxGeometry(20.5,0.7,9.5),roofD); rf.position.y=7.15; grp.add(rf);
    } else if(cid==="augusta"){
      clubhouse(wallW, roofG, true);
    } else {
      clubhouse(wallW, roofD, true);
    }
    /* 観客席スタンド（グリーン脇） */
    const stand=new THREE.Group();
    for(let r2=0;r2<4;r2++){ const bench=new THREE.Mesh(new THREE.BoxGeometry(13,0.5,1.15), r2%2? S(0xdde3ea,0.6):S(0x9fb4c8,0.6)); bench.position.set(0,0.6+r2*0.95,r2*1.05); stand.add(bench); }
    for(const px of [-6.2,6.2]){ const post=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,5.6,6),roofD); post.position.set(px,2.8,3.6); stand.add(post); }
    const sroof=new THREE.Mesh(new THREE.BoxGeometry(14.5,0.22,3.4),roofD); sroof.position.set(0,5.75,2.6); sroof.rotation.x=0.18; stand.add(sroof);
    stand.position.set(gp.x+17,0,6); grp.add(stand);
    grp.position.set(gx,gy,gz);
    this.scene.add(grp);
    this._landmarkGroup=grp;
    if(this.audio){ try{ this.audio.startAmbient(); let isBoss=false; try{ isBoss=(typeof B!=="undefined"&&B.holesCount>=3); }catch(e){} this.audio.setCrowd(isBoss); }catch(e){} }
  }
  _buildPin(){
    if(this.pinMesh)this.scene.remove(this.pinMesh);
    if(!this.scene)return;
    const gp=this.greenPos||{x:0,z:-(this.terrainH||200)*0.97,r:9,y:0.52};
    const course=this.currentCourse||{};
    const pinCid=course.id||"";
    const mob=this.isMobile;

    const isAugPin=(pinCid==="augusta"||pinCid==="augusta_divine");
    const isStAPin=(pinCid==="standrews"||pinCid==="standrews_new");
    // ピン（ポール色はコース別）
    const poleCol=isAugPin?0xf0f0f0:isStAPin?0xd0d0d0:0xfafafa;
    const pole=new THREE.Mesh(
      new THREE.CylinderGeometry(0.1,0.12,7.5,8),
      new THREE.MeshLambertMaterial({color:poleCol})
    );
    pole.position.set(gp.x,gp.y+3.75,gp.z);
    this.scene.add(pole);

    // ★ 旗（どんな遠距離・起伏でも視認性抜群なプロ仕様フラッグ）
    // オーガスタはマスターズ伝統の鮮やかなゴールドイエロー、他コースはクッキリしたハイビズレッド
    const flagCol=isAugPin?0xffd700:pinCid==="tpcsawgrass"?0xff2222:pinCid==="pebble"?0x0088ff:0xff3300;
    // ★ 物理風シミュレーション対応リアル布フラッグ（細分化メッシュ）
    const flagGeo = new THREE.PlaneGeometry(2.8, 1.9, 12, 4);
    const flagMat = new THREE.MeshBasicMaterial({color: flagCol, side: THREE.DoubleSide});
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(gp.x + 1.4, gp.y + 7.2, gp.z);
    this.scene.add(flag);
    this._flagMesh = flag;
    if(this._flagBaseGeo){ try{ this._flagBaseGeo.dispose(); }catch(e){} } /* v4.15: クローンはシーンに属さず loadHole の網にかからないため、上書き前に解放する。 */
    this._flagBaseGeo = flagGeo.clone();

    // 旗頭に輝くゴールデンボールマーカー（遠くからでもピン位置が一目瞭然）
    const topMarker=new THREE.Mesh(
      new THREE.SphereGeometry(0.35,12,8),
      new THREE.MeshBasicMaterial({color:0xfff044})
    );
    topMarker.position.set(gp.x,gp.y+8.2,gp.z);
    this.scene.add(topMarker);

    // Augusta旗：黄色のマスターズロゴ風ストライプ
    if(isAugPin){
      const stripe=new THREE.Mesh(
        new THREE.PlaneGeometry(2.4,0.35),
        new THREE.MeshLambertMaterial({color:0xffd700,side:THREE.DoubleSide})
      );
      stripe.position.set(gp.x+1.2,gp.y+6.5,gp.z+0.01);
      this.scene.add(stripe);
    }

    // ホールカップ（穴）
    const cup=new THREE.Mesh(
      new THREE.CylinderGeometry(0.52,0.48,0.4,16),
      new THREE.MeshLambertMaterial({color:0x111111})
    );
    cup.position.set(gp.x,gp.y-0.08,gp.z);
    this.scene.add(cup);
    // カップ白縁
    const cupRim=new THREE.Mesh(
      new THREE.TorusGeometry(0.52,0.06,8,20),
      new THREE.MeshLambertMaterial({color:0xf0f0f0})
    );
    cupRim.rotation.x=Math.PI/2;
    cupRim.position.set(gp.x,gp.y+0.05,gp.z);
    this.scene.add(cupRim);

    this.pinMesh=pole;
    this.pinPos.set(gp.x,gp.y+0.45,gp.z);
  }
  _buildPlayer(){
    const g=new THREE.Group();
    const ch=this.character;
    const skin=ch&&ch.skinColor?ch.skinColor:0xffcc88;
    const shirt=ch&&ch.shirtColor?ch.shirtColor:0x1e44bb;
    const pants=ch&&ch.pantsColor?ch.pantsColor:0x222244;
    const hatC=ch&&ch.hatColor?ch.hatColor:0x111122;
    /* 商用品質アップグレード： MeshBasicMaterial廃止 → PBR（MeshStandardMaterial）多関節階層モデル */
    const S=(v,r,m)=>new THREE.MeshStandardMaterial({color:v,roughness:(r===undefined?0.6:r),metalness:(m===undefined?0.05:m)});
    const skinM=S(skin,0.55), shirtM=S(shirt,0.65), pantsM=S(pants,0.72), darkM=S(0x181820,0.5,0.2);
    skinM.side=THREE.DoubleSide; shirtM.side=THREE.DoubleSide; pantsM.side=THREE.DoubleSide;
    try{
      const cv=document.createElement("canvas"); cv.width=cv.height=512;
      const cx=cv.getContext("2d"); cx.scale(4,4);
      cx.fillStyle="#"+(shirt>>>0).toString(16).padStart(6,"0"); cx.fillRect(0,0,128,128);
      cx.fillStyle="rgba(255,255,255,0.28)";
      if(ch&&ch.name==="Junbo"){ for(let i=0;i<4;i++){ cx.fillRect(0,i*32,128,7); cx.fillRect(i*32,0,7,128); } }
      else if(ch&&ch.name!=="TIiger"){ for(let i=0;i<4;i++) cx.fillRect(0,12+i*32,128,6); }
      cx.fillStyle="rgba(0,0,0,0.15)"; cx.fillRect(0,108,128,20);
      const tx=new THREE.CanvasTexture(cv); tx.wrapS=tx.wrapT=THREE.RepeatWrapping; tx.repeat.set(2,1);
      shirtM.map=tx;
    }catch(e){}
    const J={};
    /* 脚：股関節→膝→足首＋ツートンシューズ */
    J.legs={};
    for(const sideN of [-1,1]){
      const hip=new THREE.Group(); hip.position.set(0.14*sideN,0.88,0); g.add(hip);
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.098,0.082,0.46,10),pantsM); thigh.position.y=-0.23; thigh.castShadow=true; hip.add(thigh);
      const knee=new THREE.Group(); knee.position.y=-0.46; hip.add(knee);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.076,0.062,0.42,10),pantsM); shin.position.y=-0.21; knee.add(shin);
      const ank=new THREE.Group(); ank.position.y=-0.42; knee.add(ank);
      const shoe=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.09,0.36),S(0xf2f2f2,0.4)); shoe.position.set(0,-0.045,-0.05); ank.add(shoe);
      const toe=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.07,0.12),S(hatC,0.4)); toe.position.set(0,-0.05,-0.26); ank.add(toe);
      J.legs[sideN<0?"L":"R"]={hip:hip,knee:knee,ank:ank};
    }
    /* 骨盤→胸郭→頭 */
    const hips=new THREE.Group(); hips.position.y=0.88; g.add(hips); J.hips=hips;
    const pelvis=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.19,0.16,12),pantsM); pelvis.position.y=0.04; hips.add(pelvis);
    const belt=new THREE.Mesh(new THREE.CylinderGeometry(0.215,0.215,0.05,12),darkM); belt.position.y=0.11; hips.add(belt);
    const torsoG=new THREE.Group(); torsoG.position.y=0.10; hips.add(torsoG); J.torso=torsoG;
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.185,0.215,0.56,12),shirtM); torso.position.y=0.28; torso.castShadow=true; torsoG.add(torso); J.torsoMesh=torso;
    const collar=new THREE.Mesh(new THREE.TorusGeometry(0.10,0.03,8,16),shirtM); collar.position.y=0.56; collar.rotation.x=Math.PI/2-0.3; torsoG.add(collar);
    const headG=new THREE.Group(); headG.position.y=0.59; torsoG.add(headG); J.head=headG;
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.085,0.14,10),skinM); neck.position.y=0.02; headG.add(neck);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.21,16,12),skinM); head.scale.set(0.95,1.1,0.98); head.position.y=0.24; head.castShadow=true; headG.add(head);
    const jaw=new THREE.Mesh(new THREE.SphereGeometry(0.155,12,8),skinM); jaw.scale.set(0.95,0.75,0.95); jaw.position.set(0,0.115,-0.03); headG.add(jaw);
    for(const ex of [-0.20,0.20]){ const ear=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,6),skinM); ear.position.set(ex,0.24,0); headG.add(ear); }
    for(const ex of [-0.082,0.082]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.026,8,6),darkM); eye.position.set(ex,0.28,-0.185); headG.add(eye);
      const shine=new THREE.Mesh(new THREE.SphereGeometry(0.009,5,3),S(0xffffff,0.3)); shine.position.set(ex-0.008,0.29,-0.205); headG.add(shine);
      const brow=new THREE.Mesh(new THREE.BoxGeometry(0.075,0.018,0.02),S(0x2a1c10,0.85)); brow.position.set(ex,0.335,-0.19); headG.add(brow);
    }
    const nose=new THREE.Mesh(new THREE.ConeGeometry(0.028,0.09,8),skinM); nose.rotation.x=-Math.PI/2+0.3; nose.position.set(0,0.225,-0.205); headG.add(nose);
    const mouth=new THREE.Mesh(new THREE.SphereGeometry(0.02,6,3),S(0x9a4a44,0.7)); mouth.scale.set(2.0,0.6,0.7); mouth.position.set(0,0.145,-0.185); headG.add(mouth);
    /* 帽子（キャラ別の精密メッシュ） */
    const hatKind=(ch&&ch.name==="DeCham")?"flat":(ch&&ch.name==="Watu")?"straw":"cap";
    const hatM=S(hatC,0.55);
    if(hatKind==="cap"){
      const dome=new THREE.Mesh(new THREE.SphereGeometry(0.225,16,10,0,Math.PI*2,0,Math.PI/2),hatM); dome.position.y=0.315; dome.scale.set(0.98,0.82,1.0); headG.add(dome);
      const brim=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.035,0.24),hatM); brim.position.set(0,0.315,-0.26); brim.rotation.x=0.10; headG.add(brim);
      const hlogo=new THREE.Mesh(new THREE.CircleGeometry(0.045,10),S(0xffd875,0.35,0.6)); hlogo.position.set(0,0.36,-0.215); hlogo.rotation.x=-0.35; headG.add(hlogo);
    } else if(hatKind==="straw"){
      const sb=new THREE.Mesh(new THREE.CylinderGeometry(0.40,0.42,0.035,18),S(0xe5c77b,0.7)); sb.position.y=0.335; headG.add(sb);
      const st2=new THREE.Mesh(new THREE.CylinderGeometry(0.20,0.225,0.17,14),S(0xe5c77b,0.7)); st2.position.y=0.43; headG.add(st2);
    } else {
      const fl=new THREE.Mesh(new THREE.SphereGeometry(0.235,14,10),hatM); fl.scale.set(1.05,0.40,1.15); fl.position.set(0,0.345,-0.01); headG.add(fl);
      const fb2=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.03,0.16),hatM); fb2.position.set(0,0.315,-0.25); headG.add(fb2);
    }
    /* 腕：肩→肘→手首（左=リード・右=クラブ保持） */
    function arm(sideN){
      const sh=new THREE.Group(); sh.position.set(0.26*sideN,0.52,0); torsoG.add(sh);
      const up=new THREE.Mesh(new THREE.CylinderGeometry(0.072,0.065,0.34,8),shirtM); up.position.y=-0.17; up.castShadow=true; sh.add(up);
      const el=new THREE.Group(); el.position.y=-0.34; sh.add(el);
      const fo=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.055,0.30,8),skinM); fo.position.y=-0.15; el.add(fo);
      const wr=new THREE.Group(); wr.position.y=-0.30; el.add(wr);
      const hand=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,6),skinM); hand.position.y=-0.04; wr.add(hand);
      return {sh:sh,el:el,wr:wr};
    }
    const aL=arm(-1), aR=arm(1);
    J.shoulderL=aL.sh; J.elbowL=aL.el; J.wristL=aL.wr; J.shoulderR=aR.sh; J.elbowR=aR.el; J.wristR=aR.wr;
    const glove=new THREE.Mesh(new THREE.SphereGeometry(0.076,8,6),S(0xf6f6f6,0.5)); glove.position.y=-0.04; aL.wr.add(glove);
    /* クラブ（右手首のクラブグループ配下） */
    const clubG=new THREE.Group();
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.02,1.78,8),S(0xb8c0cc,0.28,0.9)); shaft.position.y=-0.54; clubG.add(shaft);
    const grip=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.027,0.28,8),S(0x1c1c22,0.7)); grip.position.y=0.47; clubG.add(grip);
    const chead=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.11,0.05),S(0xd8dce2,0.25,0.95)); chead.position.set(0,-1.45,-0.03); clubG.add(chead);
    clubG.position.set(0,-0.06,-0.02);
    aR.wr.add(clubG);
    this.clubMesh=clubG; J.club=clubG;
    /* アドレス姿勢（スイング復帰先として保持） */
    J.addr={ shL:[-0.52,0,0.34], shR:[-0.52,0,-0.28], elL:-0.30, elR:-0.22, club:[-0.38,0,-0.10] };
    aL.sh.rotation.set(-0.52,0,0.34); aR.sh.rotation.set(-0.52,0,-0.28);
    aL.el.rotation.x=-0.30; aR.el.rotation.x=-0.22;
    clubG.rotation.set(-0.38,0,-0.10);
    J.legs.L.knee.rotation.x=0.10; J.legs.R.knee.rotation.x=0.10;
    headG.rotation.x=0.16;
    /* 接地影 */
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.35,16),
      new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.3}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=0.005;g.add(shadow);
    /* v4.4: 体格の作り分け (driverSpeedは6人とも固有値のため識別子として使う) */
    var BP = {75:{h:0.97,w:0.92},80:{h:1.00,w:1.00},85:{h:1.02,w:1.06},82:{h:1.01,w:1.15},90:{h:1.05,w:0.95},95:{h:1.04,w:1.23}};
    var BPN = {Watu:{h:0.97,w:0.92},Matuya:{h:1.00,w:1.00},TIiger:{h:1.02,w:1.06},Junbo:{h:1.01,w:1.15},McIlro:{h:1.05,w:0.95},DeCham:{h:1.04,w:1.23}}; /* v4.4是正3: GOAT時はdriverSpeedが99に化けるためnameを主キーにする */
    var bp = BPN[ch && ch.name] || BP[ch && ch.driverSpeed] || {h:1,w:1};
    g.scale.set(bp.w, bp.h, bp.w);
    g.position.copy(this.teePos);
    this.playerMesh=g; this.playerJoints=J; this.scene.add(g);
    this._startPlayerIdle();
    this._hqApplied=false; this._hqApplyPlayer();
  }
  /* アドレス中のワッグル＆呼吸（スイング中は干渉しない） */
  _startPlayerIdle(){
    if(this._idleOn) return; this._idleOn=true;
    const loop=()=>{
      requestAnimationFrame(loop);
      if(document.hidden) return; /* v4.14: 非表示中は待機モーションの更新も止める */
      if(this._swinging||!this.playerJoints||!this.playerMesh||!this.playerMesh.parent) return;
      const J=this.playerJoints, t=performance.now()/1000;
      J.torsoMesh.position.y=0.28+Math.sin(t*1.7)*0.008;
      J.club.rotation.x=J.addr.club[0]+Math.sin(t*2.3)*0.035;
      J.club.rotation.z=J.addr.club[2]+Math.sin(t*1.9+1.3)*0.02;
      J.head.rotation.y=Math.sin(t*0.6)*0.05;
    };
    loop();
  }
  /* v4.3: HQモデルパーツへの差し替え (未読込/失敗時は従来モデルのまま) */
  _hqApplyPlayer(){
    const H = window.HQG; if(!H) return;
 var _ck49 = ({Watu:'watu',Matuya:'matuya',TIiger:'tiiger',Junbo:'junbo',McIlro:'mcilro',DeCham:'decham'})[this.character && this.character.name] || 'watu';
if(!H.readyFor(_ck49)){
if(!this._hqQueued){ this._hqQueued = true; const self = this; H.pending.push(function(){ self._hqQueued = false; if(self.playerMesh && self.playerMesh.parent) self._hqApplyPlayer();}); H.loadCharTex(_ck49); H.loadParts(_ck49);}
return;
}
    if(this._hqApplied) return; this._hqApplied = true;
    try{
      const J = this.playerJoints, ch = this.character, P = H.parts, T = H.tex;
      const skin = ch && ch.skinColor ? ch.skinColor : 0xffcc88;
      const shirt = ch && ch.shirtColor ? ch.shirtColor : 0x1e44bb;
      const pants = ch && ch.pantsColor ? ch.pantsColor : 0x222244;
      const hatC = ch && ch.hatColor ? ch.hatColor : 0x111122;
      const S = (o) => new THREE.MeshStandardMaterial(o);
      const shirtBase = J.torsoMesh.material;
      const shirtM2 = shirtBase.clone();
      if(T.shirt_nrm){ shirtM2.normalMap = T.shirt_nrm; shirtM2.roughnessMap = T.shirt_rgh; shirtM2.needsUpdate = true; }
      /* v4.4: 国籍・人種設定に合わせた肌色/顔の作り分け (全員固定色だった v4.3 の是正) */
      var CKN = {Watu:['watu',0xffffff,0x241a12],Matuya:['matuya',0xfdf6ec,0x201812],TIiger:['tiiger',0x9a7a58,0x14100c],Junbo:['junbo',0xf5ebd6,0x6a625a],McIlro:['mcilro',0xffffff,0x7a4a26],DeCham:['decham',0xfff6e0,0x4a3420]}; /* v4.4是正3: name主キー(GOAT時driverSpeed=99対策) */
      var CK = CKN[ch && ch.name] || {75:CKN.Watu,80:CKN.Matuya,85:CKN.TIiger,82:CKN.Junbo,90:CKN.McIlro,95:CKN.DeCham}[ch && ch.driverSpeed] || CKN.Watu;
      var vH = T['head_' + CK[0]] || null; /* v4.4是正2: _readyゲートを廃止しロード完了と同時に差し替わるようにする(従来は適用競合で汎用顔に戻っていた) */
      var vS = T['skin_' + CK[0]] || null;
      const SLOT = {
        MAT_SKIN: S({color: vS ? 0xffffff : CK[1], roughness: 1.0, envMapIntensity: 0.45, map: vS || T.skin_map || null, normalMap: T.skin_nrm || null, roughnessMap: T.skin_rgh || null}),
        MAT_HEAD: S({color: vH ? 0xffffff : CK[1], roughness: 1.0, envMapIntensity: 0.45, map: vH || T.head_map || null, normalMap: T.head_nrm || null, roughnessMap: T.skin_rgh || null}),
        MAT_BROW: S({color: CK[2], roughness: 0.85}),
        MAT_EYE: S({color: 0xffffff, roughness: 0.12, map: T.eye || null}),
        MAT_SHIRT: shirtM2,
        MAT_PANTS: S({color: pants, roughness: 0.72, map: T.pants_map || null, normalMap: T.pants_nrm || null, roughnessMap: T.pants_rgh || null}),
        MAT_HAT: S({color: hatC, roughness: 0.55}),
        MAT_SHOE: S({color: 0xf2f2f2, roughness: 0.38, normalMap: T.skin_nrm || null}),
        MAT_SHOE2: S({color: hatC, roughness: 0.35}),
        MAT_DARK: S({color: 0x181820, roughness: 0.5, metalness: 0.2}),
        MAT_METAL: S({color: 0xb8c0cc, roughness: 0.28, metalness: 0.9}),
        MAT_METALD: S({color: 0x2a2e36, roughness: 0.32, metalness: 0.92}),
        MAT_GOLD: S({color: 0xffd875, roughness: 0.3, metalness: 0.85}),
        MAT_WHITE: S({color: 0xf6f6f6, roughness: 0.5}),
        MAT_STRAW: S({color: 0xb08a34, roughness: 0.9, envMapIntensity: 0.35})
      };
      Object.keys(SLOT).forEach(function(k){ SLOT[k].side = THREE.DoubleSide; });
      const put = (name, parent, flip) => {
        const tpl = P[name]; if(!tpl || !parent) return null;
        const o = tpl.clone();
        o.traverse((n) => { if(n.isMesh){ n.castShadow = true; n.userData.hqPart = true; const mn = n.material && n.material.name; if(mn && SLOT[mn]) n.material = SLOT[mn]; } });
        if(flip){ o.rotation.y += Math.PI; o.position.x *= -1; o.position.z *= -1; }
        parent.add(o);
        return o;
      };
      const hide = (grp) => { if(!grp) return; for(let i = 0; i < grp.children.length; i++){ const c = grp.children[i]; if(c.isMesh && !c.userData.hqPart) c.visible = false; } };
      /* v4.4: 透け根絶 - 従来モデルを 0.93 倍の内側ブロッカーとして残し、HQパーツの隙間から背景が見えないようにする */
      const block = (grp) => { if(!grp) return; for(let i = 0; i < grp.children.length; i++){ const c = grp.children[i]; if(c.isMesh && !c.userData.hqPart){ c.scale.x *= 0.93; c.scale.z *= 0.93; } } };
      for(const sd of ['L', 'R']){
        const leg = J.legs[sd];
        put('thigh', leg.hip, true); block(leg.hip);
        put('shin', leg.knee, true); block(leg.knee);
        put('shoe', leg.ank, true); put('toe', leg.ank, true); block(leg.ank);
      }
      put('pelvis', J.hips, true); put('belt', J.hips, true); block(J.hips);
      put('torso', J.torsoMesh, true);
      /* v4.4: シャツもブロッカーとして残す (襟だけは二重になるため隠す) */
      J.torsoMesh.scale.x *= 0.94; J.torsoMesh.scale.z *= 0.94;
      if(J.torso) for(let i = 0; i < J.torso.children.length; i++){ const c = J.torso.children[i]; if(c.isMesh && c.geometry && c.geometry.type === 'TorusGeometry') c.visible = false; }
      var _hk48 = {Watu:'watu',Matuya:'matuya',TIiger:'tiiger',Junbo:'junbo',McIlro:'mcilro',DeCham:'decham'}[ch && ch.name] || 'watu';
      var _hpUsedG = put('head_' + _hk48, J.head, true);
var _hpKindG = _hpUsedG ? ((P['head_' + _hk48]) ? _hk48 : 'watu-base') : (put('head', J.head, true) ? 'generic' : 'none');
window.HQG._appliedHead = _hpKindG;
(window.HQG._appliedHeads = window.HQG._appliedHeads || {})[_hk48] = _hpKindG;
put('earL', J.head, true); put('earR', J.head, true); put('nose', J.head, true);
      const hatKind = (ch && ch.name === 'DeCham') ? 'flat' : (ch && ch.name === 'Watu') ? 'straw' : 'cap';
      /* v4.13: ツバが目を覆う問題の修正（ワールド側と同件）。こちらは flip 適用後の座標系のため
         前上げの tilt 符号は正、支点 z は負になる。寸法は対戦側スケール（ワールドの約0.755倍）。 */
      const _hatAdjG = (o, lift, tilt, py, pz) => {
        if(!o) return;
        const c = Math.cos(tilt), s = Math.sin(tilt), oy = o.position.y, oz = o.position.z;
        o.position.y = (oy * c - oz * s) + (py - (py * c - pz * s)) + lift;
        o.position.z = (oy * s + oz * c) + (pz - (py * s + pz * c));
        o.rotation.x += tilt;
      };
      if(hatKind === 'cap'){ put('cap', J.head, true); _hatAdjG(put('cap_brim', J.head, true), 0.008, 0.30, 0.24, -0.148); put('cap_logo', J.head, true); }
      else if(hatKind === 'straw'){ _hatAdjG(put('straw', J.head, true), 0.015, 0.08, 0.227, 0.0); _hatAdjG(put('straw_top', J.head, true), 0.015, 0.08, 0.227, 0.0); }
      else { _hatAdjG(put('flat', J.head, true), 0.009, 0.12, 0.227, -0.148); }
      hide(J.head);
      put('upperarm', J.shoulderL, true); block(J.shoulderL);
      put('upperarm', J.shoulderR, true); block(J.shoulderR);
      put('forearm', J.elbowL, true); block(J.elbowL);
      put('forearm', J.elbowR, true); block(J.elbowR);
      put('hand', J.wristL, true); put('glove', J.wristL, true); block(J.wristL);
      put('hand', J.wristR, true); block(J.wristR);
      put('club_grip', J.club, false); put('club_shaft', J.club, false);
      this._hqHeads = { driver: put('club_driver', J.club, false), iron: put('club_iron', J.club, false), putter: put('club_putter', J.club, false), top: put('club_driver_top', J.club, false) };
      hide(J.club);
      if(!this._hqSyncOn){
        this._hqSyncOn = true; const self = this;
        const sync = () => {
          requestAnimationFrame(sync);
          if(!self.playerMesh || !self.playerMesh.parent){ self._hqSyncOn = false; return; }
          if(self._hqHeads){
            let ty = 'iron'; try{ ty = (CLUBS[self.currentClubIdx] || {}).type || 'iron'; }catch(e){}
            const want = ty === 'putter' ? 'putter' : (ty === 'driver' || ty === 'wood') ? 'driver' : 'iron';
            for(const k of ['driver', 'iron', 'putter']) if(self._hqHeads[k]) self._hqHeads[k].visible = (k === want);
            if(self._hqHeads.top) self._hqHeads.top.visible = (want === 'driver');
          }
        };
        sync();
      }
    }catch(e){ /* 差し替え失敗時も従来表示で継続 */ }
  }
  /* v4.3: 地面・ランドマーク素材のPBR化 (Lambert→Standard+詳細テクスチャ) */
  _hqUpgradeGround(){
    try{
      const H = window.HQG; if(!H || !this.scene) return;
      const T = H.tex;
      /* v4.5: 前ホールのテクスチャ clone を解放し、ホール遷移ごとの GPU 累積を止める。水面マテリアル/雲の参照も現ホール分へ切り替える */
      if(H._cloneTexs){ for(const ct of H._cloneTexs){ try{ ct.dispose(); }catch(e){} } }
      H._cloneTexs = [];
      H.waterMats = [];
      H._clouds = null;
      /* v4.14: 同じ元テクスチャ×同じrepeatのクローンは1枚を使い回す（従来は地面メッシュ毎に生成し、最終ホール分が残留していた）。使い回し分もH._cloneTexs経由で次ホール開始時に解放される */
      const _texCache = new Map();
      const mkTex = (t, rx, ry) => { if(!t || !t.image || !t.image.width) return null; const _k = (t.uuid || t) + '|' + rx + '|' + ry; if(_texCache.has(_k)) return _texCache.get(_k); const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); H._cloneTexs.push(c); _texCache.set(_k, c); return c; };
      const _oldMats = new Set();
      this.scene.traverse((o) => {
        if(!o.isMesh) return;
        const m = o.material;
        if(!m || m.type !== 'MeshLambertMaterial' || m.transparent || m.userData.hqUp) return;
        m.userData.hqUp = true;
        const c = m.color; if(!c) return;
        if(c.r > 0.9 && c.g > 0.9 && c.b > 0.9) return;
        let kind = null;
        if(c.g >= c.r && c.g >= c.b && c.g > 0.15) kind = 'grass';
        else if(c.b > c.r && c.b > c.g) kind = 'water';
        else if(c.r > 0.55 && c.g > 0.4 && (c.r - c.b) > 0.08 && (c.r - c.b) < 0.45 && (c.g - c.b) < 0.35) kind = 'sand';
        if(!kind) return;
        let rx = 6, ry = 6;
        const geo = o.geometry;
        if(geo){ geo.computeBoundingBox(); const bb = geo.boundingBox; const dims = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].sort((a, b) => b - a); rx = Math.max(1, Math.min(48, Math.round(dims[0] / 6))); ry = Math.max(1, Math.min(48, Math.round(dims[1] / 6))); }
        const nm = new THREE.MeshStandardMaterial({ color: c.getHex(), roughness: kind === 'water' ? 0.12 : 0.94, metalness: kind === 'water' ? 0.05 : 0.0 });
        if(kind === 'grass'){ nm.map = mkTex(T.grass_detail, rx, ry); nm.normalMap = mkTex(T.grass_nrm, rx, ry); nm.envMapIntensity = 0.35; /* v4.15: 芝は反射しないため空の映り込みを抑え、色の濃さを戻す。 */ }
        else if(kind === 'sand'){ nm.map = mkTex(T.sand_detail, rx, ry); nm.normalMap = mkTex(T.sand_nrm, rx, ry); nm.envMapIntensity = 0.35; /* v4.15: 同上。 */ }
        else { nm.normalMap = mkTex(T.water_nrm, rx, ry); nm.envMapIntensity = 0.6; /* v4.15: 池の飽和青を戻す（従来1.3では空の反射で白く抜けていた）。 */ if(nm.normalMap){ nm.normalMap.wrapS = nm.normalMap.wrapT = THREE.RepeatWrapping; (H.waterMats = H.waterMats || []).push(nm); } }
        if(nm.map || nm.normalMap){ _oldMats.add(m); o.material = nm; }
      });
      /* v4.14: 差し替えで外れた旧Lambertマテリアルを解放（従来は参照を失うだけでホール毎に蓄積）。他のメッシュがまだ使っているものは残す */
      if(_oldMats.size){ const _inUse = new Set(); this.scene.traverse((o) => { if(o.material){ const _ms = Array.isArray(o.material) ? o.material : [o.material]; for(const _m of _ms) _inUse.add(_m); } }); for(const _om of _oldMats){ if(!_inUse.has(_om)){ try{ _om.dispose(); }catch(e){} } } }
      /* v4.3改: 雲スプライトと水面アニメーション */
      if(T.cloud && !H._clouds){
        H._clouds = [];
        for(let i = 0; i < 16; i++){
          const sm = new THREE.SpriteMaterial({ map: T.cloud, transparent: true, depthWrite: false, opacity: 0.55 + Math.random() * 0.3 });
          const sp = new THREE.Sprite(sm);
          const sc = 60 + Math.random() * 70;
          sp.scale.set(sc, sc * 0.32, 1);
          sp.position.set(-280 + Math.random() * 560, 170 + Math.random() * 60, -350 - Math.random() * 450); /* v4.10 B1: 空撮で地面のシミにならないよう雲を上空・遠方へ（旧y48-88・z±280）。地上視点では低空に見えるよう遠方に置く */
          sp.userData.v = 1.4 + Math.random() * 1.6;
          this.scene.add(sp); H._clouds.push(sp);
        }
      }
      if(!H._envTick){
        H._envTick = true;
        let last = performance.now();
        const tick = () => {
          requestAnimationFrame(tick);
          const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
          if(document.hidden) return; /* v4.14: 非表示中は水面・雲のアニメーションを止める */
          try{
            if(H.waterMats) for(const wm of H.waterMats){ if(wm.normalMap){ wm.normalMap.offset.x += dt * 0.010; wm.normalMap.offset.y += dt * 0.004; } }
            if(H._clouds) for(const sp of H._clouds){ sp.position.x += sp.userData.v * dt; if(sp.position.x > 300) sp.position.x = -300; }
          }catch(e){}
        };
        tick();
      }
    }catch(e){ window.__goatDiagFail("player", "_hqApplyPlayer", e); }
  }
  /* v4.4: コースの作り込み - 林(幹+葉クラスタのInstancedMesh) / バンカー窪みの強調 / 空の空気感 */
  _hqCourseDress(){
    /* v4.4-2: 中心線フェアウェイリボン / 林 / 丘陵 / 色補正 (ホール単位で再実行) */
    const holeKey = ((this.currentCourse&&this.currentCourse.id)||'') + '#' + this.currentHoleIdx;
    if(this._dressHoleKey === holeKey) return; this._dressHoleKey = holeKey;
    const TW = this.terrainW, TH = this.terrainH;
    const mob = this.isMobile;
    let seed = 987654;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const hole = (this.currentCourse && this.currentCourse.holes) ? this.currentCourse.holes[this.currentHoleIdx] : null;
    const cid = (this.currentCourse && this.currentCourse.id) || '';
    const isToda = (cid === 'toda' || cid === 'toda_dark' || !!(this.currentCourse && this.currentCourse.isToda2Way));
    const physHole = hole ? (hole.physHole || ((hole.n - 1) % 9 + 1)) : 1;
    const isSharpDogleg = isToda && physHole === 8;

    /* --- 色の白飛び補正: 全ライトを 0.68 倍に (画素実測で調整) --- */
    try{
      if(this._allLights) for(const e of this._allLights){ if(e.light && e.base){ e.base *= 0.58; e.light.intensity = e.base * (this._brightnessMultiplier || 1); } } if(this.renderer) this.renderer.toneMappingExposure = 0.8;
      if(this.scene && this.scene.fog && this.scene.fog.color) this.scene.fog.color.lerp(new THREE.Color(0x9db8cc), 0.2);
    }catch(e){ window.__goatDiagFail("courseDress", "lights", e); }

    /* --- 旧・球体雲を隠し、柔らかいスプライト雲に置換 --- */
    try{
      this.scene.traverse(o => { if(o.userData && o.userData.v44OldCloud) o.visible = false; });
      const H = window.HQG;
      if(H && H.tex && H.tex.cloud){
        for(let i = 0; i < (mob ? 6 : 11); i++){
          const sm = new THREE.SpriteMaterial({ map: H.tex.cloud, transparent: true, depthWrite: false, opacity: 0.45 + rnd() * 0.3 });
          const sp = new THREE.Sprite(sm);
          const sc = 130 + rnd() * 130;
          sp.scale.set(sc, sc * 0.30, 1);
          sp.position.set(-420 + rnd() * 840, 200 + rnd() * 70, -350 - rnd() * 450); /* v4.10 B1: 空撮で地面のシミにならないよう雲を上空・遠方へ（旧y95-165・z-80〜-600）。地上視点では低空に見えるよう遠方に置く */
          this.scene.add(sp);
        }
      }
    }catch(e){ window.__goatDiagFail("courseDress", "clouds", e); }

    /* --- 中心線 (tee -> pin, dogleg で膨らむ) --- */
    const tee = this.teePos || new THREE.Vector3(0, 0, 0);
    const pin = this.pinPos || new THREE.Vector3(0, 0, -TH * 0.97);
    const dx = pin.x - tee.x, dz = pin.z - tee.z;
    const L = Math.hypot(dx, dz) || TH;
    const ux = dx / L, uz = dz / L;           /* 進行方向 */
    const px = uz, pz = -ux;                  /* 横方向 */
    const greenR = this.greenPos ? this.greenPos.r : 10;
    const clPts = (this._centerline && this._centerline.length > 1) ? this._centerline : [{x:tee.x, z:tee.z}, {x:pin.x, z:pin.z}];
    const clSeg = []; let PL = 0;
    for(let i = 0; i < clPts.length - 1; i++){ const sl = Math.hypot(clPts[i + 1].x - clPts[i].x, clPts[i + 1].z - clPts[i].z); clSeg.push(sl); PL += sl; }
    if(PL < 1) PL = L;
    const centerAt = (t) => {
      let d = Math.max(0, Math.min(1, t)) * PL;
      let i = 0; while(i < clSeg.length - 1 && d > clSeg[i]){ d -= clSeg[i]; i++; }
      const a = clPts[i], b = clPts[i + 1]; const sl = clSeg[i] || 1; const k = Math.max(0, Math.min(1, d / sl));
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, off: 0 };
    };
    const perpAt = (t) => {
      const c1 = centerAt(t), c2 = centerAt(Math.min(1, t + 0.012));
      let vx = c2.x - c1.x, vz = c2.z - c1.z; const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
      return { x: vz, z: -vx };
    };

    /* --- フェアウェイリボン (幅変化 + 12単位の横帯モアライン) --- */
    if(!isSharpDogleg){
      const baseHW = isToda ? 27 : 25;
      const t0 = 2 / PL, t1 = 1 - (greenR + 7) / PL;
      const N = 52;
      const buildRibbon = (extraW, yOff, colFn) => {
        const pos = [], col = [], idx = [];
        const cA = new THREE.Color(0x1e5c12), cB = new THREE.Color(0x113a09), cEdge = new THREE.Color(0x256b14);
        for(let i = 0; i <= N; i++){
          const t = t0 + (t1 - t0) * (i / N);
          const c = centerAt(t);
          const qp = perpAt(t);
          const hw = baseHW * (1 + 0.13 * Math.sin(t * Math.PI * 2 + 1.0)) + extraW;
          const dist = t * PL;
          const band = Math.floor(dist / 12) % 2;
          const cc = colFn ? colFn(band, cA, cB, cEdge) : cA;
          const y = this.getGY(c.x, c.z) + yOff;
          pos.push(c.x - qp.x * hw, y, c.z - qp.z * hw, c.x + qp.x * hw, y, c.z + qp.z * hw);
          col.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
          if(i < N){ const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx); g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
        m.receiveShadow = true;
        this.scene.add(m);
        return m;
      };
      buildRibbon(3.4, 0.028, (band, cA, cB, cEdge) => cEdge);                 /* ファーストカット縁 */
      buildRibbon(0, 0.045, (band, cA, cB) => band ? cB : cA);                  /* フェアウェイ本体 */
    }

    /* --- 林: 中心線の両脇に幹+葉クラスタを連続配置 (InstancedMesh) --- */
    {
      const NT = mob ? 56 : 104;
      const trunkG = new THREE.CylinderGeometry(0.20, 0.36, 3.0, 6); trunkG.translate(0, 1.5, 0);
      const trunkM = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 1.0 });
      const trunks = new THREE.InstancedMesh(trunkG, trunkM, NT);
      const blobG = new THREE.IcosahedronGeometry(1.8, 1);
      const blobM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
      const blobs = new THREE.InstancedMesh(blobG, blobM, NT * 3);
      const dummy = new THREE.Object3D();
      const leafCols = [new THREE.Color(0x1d4d16), new THREE.Color(0x27631d), new THREE.Color(0x2e6b22), new THREE.Color(0x1a4218)].map(c => c.multiplyScalar(0.55)); /* v4.10 B1: 強い光で白く飛ぶため葉色を濃くして実測の緑に近づける */
      let ti = 0, bi = 0;
      for(let sIdx = 0; sIdx < NT; sIdx++){
        const t = 0.03 + 0.94 * (sIdx / NT) + (rnd() - 0.5) * 0.012;
        const tc = Math.max(0, Math.min(1, t));
        const c = centerAt(tc);
        const qp = perpAt(tc);
        const side = sIdx % 2 === 0 ? 1 : -1;
        const hw = (isToda ? 27 : 25) * (1 + 0.13 * Math.sin(t * Math.PI * 2 + 1.0));
        const off = hw + 6 + rnd() * 15;
        const x = c.x + qp.x * side * off, z = c.z + qp.z * side * off;
        if(this.greenPos && Math.hypot(x - this.greenPos.x, z - this.greenPos.z) < greenR + 8) continue;
        if(Math.hypot(x - tee.x, z - tee.z) < 10) continue;
        let bad = false;
        if(this._bunkerZones) for(const bz of this._bunkerZones){ if(Math.hypot(x - bz.x, z - bz.z) < bz.r + 3.5){ bad = true; break; } }
        if(bad) continue;
        if(window._waterBoxes) for(const wb of window._waterBoxes){ if(x > wb.minX - 2 && x < wb.maxX + 2 && z > wb.minZ - 2 && z < wb.maxZ + 2){ bad = true; break; } }
        if(bad) continue;
        const y = this.getGY(x, z);
        const sc = 0.9 + rnd() * 0.9;
        dummy.position.set(x, y - 0.1, z); dummy.scale.setScalar(sc); dummy.rotation.set(0, rnd() * 3.14, 0);
        dummy.updateMatrix(); trunks.setMatrixAt(ti, dummy.matrix);
        for(let k = 0; k < 3; k++){
          dummy.position.set(x + (rnd() - 0.5) * 1.9 * sc, y + (2.9 + k * 0.95) * sc, z + (rnd() - 0.5) * 1.9 * sc);
          dummy.scale.setScalar(sc * (1.06 - k * 0.17)); dummy.rotation.set(rnd(), rnd() * 3, rnd());
          dummy.updateMatrix(); blobs.setMatrixAt(bi, dummy.matrix);
          blobs.setColorAt(bi, leafCols[Math.floor(rnd() * leafCols.length)]);
          bi++;
        }
        ti++;
      }
      trunks.count = ti; blobs.count = bi;
      if(blobs.instanceColor) blobs.instanceColor.needsUpdate = true;
      trunks.castShadow = !mob; blobs.castShadow = !mob;
      this.scene.add(trunks); this.scene.add(blobs);
    }
    /* コーナー内側の林 (ショートカット防止) */
    if(clPts.length > 2 && this._terrainGen){
      const cn = clPts[1];
      const chX = (clPts[0].x + clPts[clPts.length - 1].x) / 2, chZ = (clPts[0].z + clPts[clPts.length - 1].z) / 2;
      const inX = cn.x + (chX - cn.x) * 0.38, inZ = cn.z + (chZ - cn.z) * 0.38;
      for(let k = 0; k < 9; k++){
        const a = rnd() * Math.PI * 2, rr = 3 + rnd() * 9;
        this._addTree(inX + Math.cos(a) * rr, inZ + Math.sin(a) * rr, this._terrainGen, 1.5 + rnd() * 1.1, 'broad');
      }
    }

    /* --- バンカーが無いホールにはグリーン周りに2基を物理ごと追加 --- */
    if(!isSharpDogleg && this._bunkerZones && this._bunkerZones.length === 0 && this.greenPos){
      const gp = this.greenPos;
      for(const sd of [-1, 1]){
        const bx = gp.x + sd * (greenR + 3.0), bz = gp.z + 7.5, br = 4.6;
        this._bunkerZones.push({ x: bx, z: bz, r: br, radius: br });
        if(window._bunkerZones) window._bunkerZones.push({ x: bx, z: bz, r: br, radius: br });
      }
    }

    /* --- バンカー可視化: 窪み+砂+縁の影 (物理ゾーンと一致) --- */
    if(this._bunkerZones){
      const H = window.HQG;
      const ringM = new THREE.MeshStandardMaterial({ color: 0x6e5527, roughness: 1 });
      const dipM = new THREE.MeshStandardMaterial({ color: 0xe8cf8f, roughness: 1 });
      if(H && H.tex && H.tex.sand_detail){ dipM.map = H.tex.sand_detail; }
      const pitM = new THREE.MeshStandardMaterial({ color: 0xc9ab68, roughness: 1 });
      for(const bz of this._bunkerZones){
        const gy = this.getGY(bz.x, bz.z);
        const pit = new THREE.Mesh(new THREE.CylinderGeometry(bz.r * 1.05, bz.r * 0.8, 0.5, 24), pitM);
        pit.position.set(bz.x, gy - 0.16, bz.z); this.scene.add(pit);
        const dip = new THREE.Mesh(new THREE.CircleGeometry(bz.r * 0.92, 24), dipM);
        dip.rotation.x = -Math.PI / 2; dip.position.set(bz.x, gy + 0.10, bz.z); this.scene.add(dip);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(bz.r * 1.04, 0.34, 6, 26), ringM);
        ring.rotation.x = Math.PI / 2; ring.position.set(bz.x, gy + 0.12, bz.z); this.scene.add(ring);
      }
    }

    /* --- グリーン: フリンジの輪 (汎用コースのみ) --- */
    if(this.terrain && this.greenPos){
      const gp = this.greenPos;
      const fr = new THREE.Mesh(new THREE.RingGeometry(greenR + 0.3, greenR + 2.8, 36),
        new THREE.MeshLambertMaterial({ color: 0x59b83a }));
      fr.rotation.x = -Math.PI / 2;
      fr.position.set(gp.x, this.getGY(gp.x, gp.z + greenR + 1.6) + 0.07, gp.z);
      this.scene.add(fr);
    }

    /* --- 遠景: なだらかな丘陵+樹海の地平線 (三角山は廃止) --- */
    {
      const hillCols = [0x1e3d19, 0x244a1e, 0x1a3516]; /* v4.15: 空撮で丘が白く抜けて平坦に見えていたため少し深くする。 */
      /* v4.10 B1: 晴天時は fog:false で距離による漂白を無くす（雨・霧天は従来の霧に任せる）。
         沈めて扁平化し、地平線に着地させる（旧 y-0.06 / 扁平0.26-0.36 で浮いて見えた）。
         ※ 霞色の焼き込みは太陽光で白く飛ぶため不採用。元の深緑のまま fog を切るのが最も自然だった（diag nofog で確認） */
      const hillWType = (this.weather && this.weather.type) || "sunny";
      const hillClear = (hillWType !== "fog" && hillWType !== "rain");
      const nH = mob ? 5 : 8;
      for(let i = 0; i < nH; i++){
        const ang = (i / nH) * Math.PI * 2 + rnd() * 0.3;
        const dist = 600 + rnd() * 200;
        const hx = Math.cos(ang) * dist, hz = -TH / 2 + Math.sin(ang) * dist;
        const hr = 190 + rnd() * 150;
        const hill = new THREE.Mesh(new THREE.SphereGeometry(hr, 14, 10),
          new THREE.MeshLambertMaterial({ color: hillCols[i % 3], fog: !hillClear }));
        hill.scale.set(1, 0.30 + rnd() * 0.08, 0.75);
        hill.position.set(hx, -hr * 0.15, hz);
        this.scene.add(hill);
      }
    }
  }

  _buildBallMesh(){
    // ★ ディンプル感のある高品質ボール（MeshPhongMaterial）
    const mesh=new THREE.Mesh(
      new THREE.SphereGeometry(0.22,32,24),
      new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.34, metalness:0.0 })
    );
    mesh.castShadow=true;mesh.receiveShadow=false;
    if(window.HQG) window.HQG.whenTex('ball_nrm', function(){ try{ mesh.material.normalMap = window.HQG.tex.ball_nrm; mesh.material.normalScale = new THREE.Vector2(1.6, 1.6); mesh.material.needsUpdate = true; }catch(e){} });
    if(this.ball){this.ball.mesh=mesh;this.ball.position.copy(this.teePos);mesh.position.copy(this.teePos);}
    this.scene.add(mesh);

    // ボール地面影
    const shadowGeo=new THREE.CircleGeometry(0.4,16);
    shadowGeo.rotateX(-Math.PI/2);
    this.ballShadowMesh=new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.35})
    );
    this.ballShadowMesh.visible=false;
    this.scene.add(this.ballShadowMesh);

    // ★ ボールトレイル（飛行軌跡）- PCのみ（モバイルは省略）
    if(!this.isMobile){
      const trailCount=24;
      this.trailMeshes=[];
      for(let i=0;i<trailCount;i++){
        const t=1-i/trailCount;
        const tr=new THREE.Mesh(
          new THREE.SphereGeometry(0.18*t,6,4),
          new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.0})
        );
        tr.visible=false;
        this.scene.add(tr);
        this.trailMeshes.push(tr);
      }
      this.trailPositions=[];
    }else{
      this.trailMeshes=null;
      this.trailPositions=null;
    }
  }
  _buildRain(){
    const cnt=2500;const geo=new THREE.BufferGeometry();const pos=new Float32Array(cnt*3);
    for(let i=0;i<cnt;i++){pos[i*3]=(Math.random()-0.5)*220;pos[i*3+1]=Math.random()*90;pos[i*3+2]=(Math.random()-0.5)*220-this.terrainH/2;}
    geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
    this.rainParticles=new THREE.Points(geo,new THREE.PointsMaterial({color:0x88aacc,size:0.28,transparent:true,opacity:0.55}));this.scene.add(this.rainParticles);
  }
  _buildAimViz(){
    // ---- 方向ライン（破線）※前方(-Z)へ: 従来は+Z延長でボール後方に引かれていた（ガイドリボンと同種の向き修正） ----
    const pts=[];
    for(let i=0;i<20;i++){const s=i*3,e=s+2;pts.push(new THREE.Vector3(0,0.25,-s),new THREE.Vector3(0,0.25,-e));}
    this.aimLineMesh=new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.80})
    );
    this.scene.add(this.aimLineMesh);

    // ---- 先端コーン矢印（やや大きめ） ----
    this.aimArrowMesh=new THREE.Mesh(
      new THREE.ConeGeometry(1.1,2.6,10),
      new THREE.MeshBasicMaterial({color:0xffd700,transparent:true,opacity:0.95})
    );
    this.scene.add(this.aimArrowMesh);

    // ---- ★ 地面に貼り付く大きなフラット矢印（プレイヤー直下）----
    const arrowShape=new THREE.Shape();
    arrowShape.moveTo(0,0);        // 矢印の先端
    arrowShape.lineTo(-1.5,-1.4);
    arrowShape.lineTo(-0.65,-1.4);
    arrowShape.lineTo(-0.65,-3.8);
    arrowShape.lineTo(0.65,-3.8);
    arrowShape.lineTo(0.65,-1.4);
    arrowShape.lineTo(1.5,-1.4);
    arrowShape.closePath();
    const arrowGeo=new THREE.ShapeGeometry(arrowShape);
    arrowGeo.rotateX(-Math.PI/2); // 地面に寝かせる
    const arrowMat=new THREE.MeshBasicMaterial({
      color:0xffee00,transparent:true,opacity:0.88,side:THREE.DoubleSide
    });
    this.dirArrowMesh=new THREE.Mesh(arrowGeo,arrowMat);
    this.dirArrowMesh.visible=false;
    this.scene.add(this.dirArrowMesh);

    // ---- ガイドリボン生成（地面に貼る帯: 色グロー下地+白芯 = レイアウト図の線の作法）----
    const makeGuideRibbon=(len, glowColor, glowOp)=>{
      const grp=new THREE.Group();
      const mk=(w,color,op)=>{
        const geo=new THREE.PlaneGeometry(w,len);
        geo.rotateX(Math.PI/2); // 丈方向(+Y)を +Z へ倒す
        geo.translate(0,0,-len/2); // 前方(-Z)へ伸ばす: rotation.y=-rad でエイム/ピン方向を向く（従来ラインは+Z延長で逆向きだった）
        const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:op,side:THREE.DoubleSide,depthWrite:false}));
        m.renderOrder=5;
        grp.add(m);
      };
      mk(0.62,glowColor,glowOp);
      mk(0.26,0xffffff,0.95);
      grp.visible=false;
      return grp;
    };

    // ---- ピン方向ガイド（ピンへの帯状ガイド）----
    this.pinGuideMesh=makeGuideRibbon(200,0x00ff88,0.32);
    this.scene.add(this.pinGuideMesh);

    // ---- 弾道ドット ----
    this.aimDots=[];
    for(let i=0;i<12;i++){
      const g=new THREE.CircleGeometry(0.42,8);g.rotateX(-Math.PI/2);
      const d=new THREE.Mesh(g,new THREE.MeshBasicMaterial({
        color:i<11?0xffaa00:0xff3300,transparent:true,opacity:0.65
      }));
      d.visible=false;this.scene.add(d);this.aimDots.push(d);
    }

    // ---- ターゲットリング ----
    const rg=new THREE.RingGeometry(3,5,32);rg.rotateX(-Math.PI/2);
    this.targetRingMesh=new THREE.Mesh(rg,new THREE.MeshBasicMaterial({
      color:0x00ffaa,transparent:true,opacity:0.55,side:THREE.DoubleSide
    }));
    this.targetRingMesh.visible=false;this.scene.add(this.targetRingMesh);

    // ---- キャリーマーカー（×印）----
    const cm=new THREE.Group();
    const mMat=new THREE.MeshBasicMaterial({color:0x00ffcc,transparent:true,opacity:0.9,side:THREE.DoubleSide});
    for(const rot of[Math.PI/4,-Math.PI/4]){
      const mGeo=new THREE.PlaneGeometry(2.5,0.4);mGeo.rotateX(-Math.PI/2);
      const m=new THREE.Mesh(mGeo,mMat);m.rotation.z=rot;cm.add(m);
    }
    this.carryMarkerMesh=cm;cm.visible=false;this.scene.add(cm);

    // ---- パットライン（帯状ガイド）----
    this.puttLineMesh=makeGuideRibbon(40,0x00ffdd,0.38);
    this.scene.add(this.puttLineMesh);
  }

  _updateAimArrow(){
    if(!this.aimLineMesh||!this.ball)return;
    const bp=this.ball.position;
    const rad=this.aimAngle*Math.PI/180;
    const sx=Math.sin(rad), sz=-Math.cos(rad);

    // ---- 破線ライン（ボールから進行方向へ）----
    this.aimLineMesh.position.set(bp.x,bp.y+0.25,bp.z);
    this.aimLineMesh.rotation.y=-rad;

    // ---- 先端コーン矢印 ----
    const arrDist=44;
    this.aimArrowMesh.position.set(bp.x+sx*arrDist,bp.y+0.5,bp.z+sz*arrDist);
    this.aimArrowMesh.rotation.set(Math.PI/2,0,-rad);

    // ---- 大きなフラット矢印（プレイヤー足元）----
    if(this.dirArrowMesh){
      this.dirArrowMesh.visible=!this.ball.inFlight;
      const pp=this.playerMesh?this.playerMesh.position:bp;
      this.dirArrowMesh.position.set(pp.x,pp.y+0.25,pp.z);
      // 矢印は-Z方向（前方）を指すように作ったので、Y軸回転のみで方向制御
      this.dirArrowMesh.rotation.set(0,-rad,0);
    }

    // ---- ピン方向ガイドライン（ボール→ピンの細い緑ライン）----
    if(this.pinGuideMesh&&this.pinPos){
      this.pinGuideMesh.visible=!this.ball.inFlight;
      const dx=this.pinPos.x-bp.x;
      const dz=this.pinPos.z-bp.z;
      const pinRad=Math.atan2(dx,-dz);
      this.pinGuideMesh.position.set(bp.x,bp.y+0.18,bp.z);
      this.pinGuideMesh.rotation.y=-pinRad;
    }
  }

  // ★ 大きな地面矢印の更新（_onAimChangedから呼び出し）
  _updateDirArrow3D(){
    if(!this.dirArrowMesh||!this.ball)return;
    const rad=this.aimAngle*Math.PI/180;
    const pp=this.playerMesh?this.playerMesh.position:this.ball.position;
    this.dirArrowMesh.position.set(pp.x,pp.y+0.25,pp.z);
    this.dirArrowMesh.rotation.set(0,-rad,0);
    this.dirArrowMesh.visible=!this.ball.inFlight;
  }
  _updatePuttLine(visible){
    if(!this.puttLineMesh||!this.ball)return;
    this.puttLineMesh.visible=visible;
    if(!visible)return;
    const bp=this.ball.position;
    const rad=this.aimAngle*Math.PI/180;
    this.puttLineMesh.position.set(bp.x,bp.y+0.18,bp.z);
    // ラインをエイム方向へ向ける
    this.puttLineMesh.rotation.y=-rad;
    // 傾斜情報
    const si=document.getElementById("slopeInfo");
    const slope=Math.abs(this.aimAngle)<5?"ほぼフラット":this.aimAngle<-90||this.aimAngle>90?"反対方向":this.aimAngle<0?"左傾斜":"右傾斜";
    if(si)si.textContent=slope;
    const pf=document.getElementById("puttDistFt");
    if(pf)pf.textContent=Math.round(this._distToPin()*3)+" ft";
  }

  // ===== 弾道予測ドット（ゲームスケール） =====
  _updateTrajDots(){
    if(!this.ball||this.ball.inFlight||!this.character||!this.weather){
      this.aimDots.forEach(d=>d.visible=false);
      if(this.targetRingMesh)this.targetRingMesh.visible=false;
      if(this.carryMarkerMesh)this.carryMarkerMesh.visible=false;return;
    }
    if(this.gameMode==="putt"){this.aimDots.forEach(d=>d.visible=false);if(this.targetRingMesh)this.targetRingMesh.visible=false;if(this.carryMarkerMesh)this.carryMarkerMesh.visible=false;return;}
    const club=CLUBS[this.currentClubIdx];const pw=70;
    const c=this.character;const speedMult=(club.type==="driver"||club.type==="wood")?c.driverMult:1.0;
    const gm=this._getGoatDistMult?this._getGoatDistMult():1.0;
    const totalDist=club.maxDist*(pw/100)*speedMult*this.weather.distMult*gm;
    const carryDist=totalDist*(1-club.runFactor);
    const aimRad=this.aimAngle*Math.PI/180;
    const bp=this.ball.position;const sx=Math.sin(aimRad),sz=-Math.cos(aimRad);
    const N=this.aimDots.length;
    for(let i=0;i<N;i++){
      const t=(i+1)/N;
      const dx=bp.x+sx*carryDist*t;const dz=bp.z+sz*carryDist*t;
      const dy=Math.sin(Math.PI*t)*carryDist*club.peakRatio;
      const gy=this.getGY(dx,dz);
      const d=this.aimDots[i];d.position.set(dx,gy+dy+0.3,dz);d.visible=true;
      const s=0.3+(0.7*t);d.scale.set(s,s,s);
    }
    // ターゲットリング & キャリーマーカー
    const cx=bp.x+sx*carryDist,cz=bp.z+sz*carryDist,cgy=this.getGY(cx,cz);
    if(this.targetRingMesh){this.targetRingMesh.position.set(cx,cgy+0.2,cz);this.targetRingMesh.visible=true;}
    if(this.carryMarkerMesh){this.carryMarkerMesh.position.set(cx,cgy+0.3,cz);this.carryMarkerMesh.visible=true;}
  }

  getGY(x,z){
    // グリーン上は固定高さ（ボール沈没防止）
    if(this.greenPos){
      const gdx=x-this.greenPos.x,gdz=z-this.greenPos.z;
      if(Math.sqrt(gdx*gdx+gdz*gdz)<this.greenPos.r){
        return this.greenPos.y+0.3;
      }
    }
    if(!this.terrain||!this._terrainGen)return 0;
    const TW=this.terrainW,TH=this.terrainH;
    const normZ=(-z)/TH;if(normZ<0.03||normZ>0.98)return 0;
    return this._terrainGen.getHeight(x+TW/2,-z-TH/2);
  }
  getSurf(x,z){
    // グリーン判定
    if(this.greenPos){
      const gd=Math.sqrt((x-this.greenPos.x)**2+(z-this.greenPos.z)**2);
      if(gd<this.greenPos.r)return"green";
    }else if(this.pinPos){
      const d=Math.sqrt((x-this.pinPos.x)**2+(z-this.pinPos.z)**2);
      if(d<9.3)return"green";
    }
    // ★ バンカー判定（バンカーゾーン配列）
    if(this._bunkerZones){
      for(const bz of this._bunkerZones){
        const bd=Math.sqrt((x-bz.x)**2+(z-bz.z)**2);
        if(bd<bz.r)return"bunker";
      }
    }
    if(this._centerline && this._centerline.length > 1){
      let best = 1e18; const cl = this._centerline;
      for(let i = 0; i < cl.length - 1; i++){
        const ax = cl[i].x, az = cl[i].z, bx2 = cl[i + 1].x, bz2 = cl[i + 1].z;
        const abx = bx2 - ax, abz = bz2 - az; const len2 = abx * abx + abz * abz || 1;
        let t = ((x - ax) * abx + (z - az) * abz) / len2; t = Math.max(0, Math.min(1, t));
        const ddx = x - (ax + abx * t), ddz = z - (az + abz * t);
        const dd = ddx * ddx + ddz * ddz; if(dd < best) best = dd;
      }
      return Math.sqrt(best) <= 32 ? "fairway" : "rough";
    }
    if(Math.abs(x)>32)return"rough";
    return"fairway";
  }
  checkOB(x,z){
    if(this.getSurf(x,z)==="green")return false;
    for(const zone of this.obZones){
      if(pointInPolygon2D(x,z,zone))return true;
    }
    if(window._shortcutBanZone){
      const sb=window._shortcutBanZone;
      if(x>=sb.minX&&x<=sb.maxX&&z>=sb.minZ&&z<=sb.maxZ)return true;
    }
    if(window._obVolumes){
      for(const ob of window._obVolumes){
        if(x>ob.minX&&x<ob.maxX&&z>ob.minZ&&z<ob.maxZ)return true;
      }
    }
    if(window._waterBoxes){
      const by=this.ball?this.ball.position.y:0;
      for(const wb of window._waterBoxes){
        if(x>=wb.minX&&x<=wb.maxX&&z>=wb.minZ&&z<=wb.maxZ&&by<=(wb.maxY||0.6))return true;
      }
    }
    return false;
  }

  // ===== カメラ =====
  // ★★★ グリーン＆旗が常に視野内に入るカメラシステム ★★★
  updateCamera(){
    if(!this.ball)return;
    // 太陽光とシャドウカメラをプレイヤー/ボール周辺へスムーズに追従（超特大ショット後も常に最高照度）
    if(this.sunLight && this.sunLight.target){
      const bp = this.ball.position;
      this.sunLight.target.position.set(bp.x * 0.5, 0, bp.z);
      this.sunLight.position.set(bp.x * 0.5 + 80, 220, bp.z + 60);
    }
    const bp=this.ball.position;
    const pin=this.pinPos||new THREE.Vector3(0,0,-100);
    const tiltRad=(this.camTilt||0)*Math.PI/180;

    if(this.cameraMode==="follow"){
      // ボール→ピン方向の単位ベクトル（XZ平面）
      const toPin=new THREE.Vector3(pin.x-bp.x,0,pin.z-bp.z);
      const distToPin=toPin.length();
      toPin.normalize();
      // ピンが非常に近い（ボールがピン上=ホールイン直後等）場合のフォールバック
      const safeToPin=distToPin>0.5?toPin:new THREE.Vector3(Math.sin(this.aimAngle*Math.PI/180),0,-Math.cos(this.aimAngle*Math.PI/180));

      if(this.ball.inFlight){
        if(this.ball.phase==="carry"){
          // キャリー中：ボールの進行方向 + ピン方向をブレンドし、常にグリーンが画角に入るよう後方配置
          const dist=this.ball.carryDist||100;
          const pullBack=Math.min(32,14+dist*0.045);
          const baseUp=Math.min(20,7+dist*0.032);
          const t=this.ball.carryElapsed/Math.max(this.ball.carryTime,0.01);
          const heightBonus=Math.sin(Math.PI*t)*8;

          const flightDir=new THREE.Vector3(
            this.ball.carryEndPos.x-this.ball.carryStartPos.x,0,
            this.ball.carryEndPos.z-this.ball.carryStartPos.z
          ).normalize();
          // 進行方向とピン方向の中間（ボールが大きく曲がってもピン側に視野を保つ）
          const blendDir=flightDir.clone().lerp(safeToPin,0.35).normalize();

          const back=blendDir.clone().multiplyScalar(-pullBack)
            .add(new THREE.Vector3(0,baseUp+heightBonus+tiltRad*14,0));
          this.camera.position.lerp(bp.clone().add(back),0.045);
          // ボールとピンの中間目標点を注視（グリーンを画角に収める）
          const lookTarget=bp.clone().lerp(pin,0.22);
          this.camera.lookAt(lookTarget);
        }else{
          // ラン中：低めだがピン方向を見失わないよう調整
          const backRun=safeToPin.clone().multiplyScalar(-9)
            .add(new THREE.Vector3(0,9+tiltRad*10,0));
          this.camera.position.lerp(bp.clone().add(backRun),0.12);
          const lookTargetRun=bp.clone().lerp(pin,0.18);
          this.camera.lookAt(lookTargetRun);
        }
      }else{
        // ★ 静止時（構え中）：ボール後方から「ボール～グリーン～ピン」が必ず画角に入る配置
        // カメラの後方オフセットはエイム方向ではなく、ピン方向（safeToPin）を基準にする
        // camOrbitで左右に自由回転、camTiltで上下に視野変更可能
        const orbitRad=(this.camOrbit||0)*Math.PI/180;
        // ピン方向を orbitRad だけ回転させたものを後方ベクトルにする
        const backDir=safeToPin.clone();
        const rotatedX=backDir.x*Math.cos(orbitRad)-backDir.z*Math.sin(orbitRad);
        const rotatedZ=backDir.x*Math.sin(orbitRad)+backDir.z*Math.cos(orbitRad);
        const finalBackDir=new THREE.Vector3(rotatedX,0,rotatedZ).normalize();

        // 距離に応じた引きと高度
        const pullBackStill=this.gameMode==="putt"
          ? 9+Math.abs(this.camOrbit||0)*0.02
          : Math.min(20,11+distToPin*0.015);
        let heightStill=this.gameMode==="putt"
          ? 6+tiltRad*8
          : Math.min(18,8+distToPin*0.015)+tiltRad*11;

        // 目標カメラ位置（XZ平面）
        const targetCamX = bp.x - finalBackDir.x * pullBackStill;
        const targetCamZ = bp.z - finalBackDir.z * pullBackStill;
        const camGroundY = this.getGY(targetCamX, targetCamZ);

        // ★ ボールとピンの間の地形最高高度をサンプリング（途中の丘・マウンドによる遮蔽を完全防止！）
        let maxTerrainBetween = Math.max(bp.y, pin.y);
        for(let step = 0.15; step <= 0.85; step += 0.15){
          const sampleX = bp.x + (pin.x - bp.x) * step;
          const sampleZ = bp.z + (pin.z - bp.z) * step;
          const sampleY = this.getGY(sampleX, sampleZ);
          if(sampleY > maxTerrainBetween) maxTerrainBetween = sampleY;
        }

        // カメラ高度は「カメラ足元地面 + 4.2yd」「途中の丘の最高点 + 3.0yd」「ボールからの基本高度」の最大値に自動リフトアップ！
        // これにより、手前の丘や起伏でグリーンフラッグが見えなくなる現象を完全に根絶！
        const minSafeCamY = Math.max(camGroundY + 4.2, maxTerrainBetween + 3.0, bp.y + heightStill);
        const camPos = new THREE.Vector3(targetCamX, minSafeCamY, targetCamZ);
        this.camera.position.lerp(camPos, 0.12);

        // 注視点：ピンフラッグ頭部（pin.y + 2.5）とボールをバランスよく収め、常にフラッグが視界中央に堂々と映る
        const flagTop = new THREE.Vector3(pin.x, pin.y + 2.5, pin.z);
        const lookBlend = this.gameMode==="putt" ? 0.35 : Math.max(0.32, 0.48 - distToPin * 0.0004);
        const lookTargetStill = bp.clone().lerp(flagTop, lookBlend);
        this.camera.lookAt(lookTargetStill);
      }
    }else{
      // 一人称カメラ（ピン方向を自動で見るよう調整、camOrbit/camTiltで微調整可）
      if(this.playerMesh){
        const pp=this.playerMesh.position;
        this.camera.position.set(pp.x,pp.y+1.65,pp.z);
        const toPinFP=new THREE.Vector3(pin.x-pp.x,0,pin.z-pp.z).normalize();
        const orbitRadFP=(this.camOrbit||0)*Math.PI/180;
        const rx=toPinFP.x*Math.cos(orbitRadFP)-toPinFP.z*Math.sin(orbitRadFP);
        const rz=toPinFP.x*Math.sin(orbitRadFP)+toPinFP.z*Math.cos(orbitRadFP);
        const lookAt=new THREE.Vector3(
          pp.x+rx*60,
          pp.y+1.2+tiltRad*20,
          pp.z+rz*60
        );
        this.camera.lookAt(lookAt);
      }
    }
    // ★★★ インパクト時のカメラシェイク（打撃の重み・衝撃をダイナミックに演出） ★★★
    if(this._camShake > 0.001){
      this.camera.position.x += (Math.random() - 0.5) * this._camShake;
      this.camera.position.y += (Math.random() - 0.5) * this._camShake * 0.7;
      this.camera.position.z += (Math.random() - 0.5) * this._camShake;
      this._camShake *= 0.88;
    }
  }
  // ★ 明るさ調整
  setBrightness(val){
    this._brightnessMultiplier=val;
    if(this.renderer) this.renderer.toneMappingExposure=Math.max(0.8,val*0.95);
    if(this._allLights){
      this._allLights.forEach(({light,base})=>{
        light.intensity=base*val;
      });
    }
    const el=document.getElementById("brightnessVal");
    if(el) el.textContent=val.toFixed(2);
  }

  toggleCamera(){this.cameraMode=this.cameraMode==="follow"?"firstperson":"follow";document.getElementById("camBtn").textContent=this.cameraMode==="follow"?"📷 CAM":"👁 FP";}

  _updateRain(dt){
    if(!this.rainParticles)return;
    const pos=this.rainParticles.geometry.attributes.position;
    const wx=this.weather.windVec.x*0.1,wz=this.weather.windVec.z*0.1;
    for(let i=0;i<pos.count;i++){
      pos.setY(i,pos.getY(i)-32*dt);pos.setX(i,pos.getX(i)+wx);pos.setZ(i,pos.getZ(i)+wz);
      if(pos.getY(i)<0){pos.setY(i,90);pos.setX(i,(Math.random()-0.5)*220);}
    }
    pos.needsUpdate=true;
  }

  _drawMiniMap(){
    const cv = document.getElementById("miniMapCanvas");
    if(!cv) return;
    const ctx = cv.getContext("2d");
    if(!ctx) return;

    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    // 背景：ラフ（淡黄緑・アコーディア公式レイアウト図の紙面表現）※線ブラッシュアップ
    const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.42, 6, W * 0.5, H * 0.5, W * 0.78);
    bgGrad.addColorStop(0, "#dff29e");
    bgGrad.addColorStop(0.65, "#c4e06a");
    bgGrad.addColorStop(1, "#a9cc4e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    const isTodaCourse = !!(this.currentCourse && (this.currentCourse.id === "toda" || this.currentCourse.id === "toda_dark" || this.currentCourse.isToda2Way));
    const curHole = (this.currentCourse && this.currentCourse.holes) ? this.currentCourse.holes[this.currentHoleIdx] : null;
    const ph = curHole ? (curHole.physHole || ((curHole.n - 1) % 9 + 1)) : (this.currentHoleIdx + 1);
    const isRightAngleDogleg = isTodaCourse && (ph === 8 || (curHole && (curHole.dogleg === "sharp_left" || curHole.n === 8 || curHole.n === 17)));

    if(isRightAngleDogleg){
      // ═════════════════════════════════════════════════════════════
      // ★★★ GDO公式レイアウト画像に完全準拠した直角左ドッグレッグ ★★★
      // 添付画像 (media_1789620186490.png) をピクセルレベルで再現
      // ═════════════════════════════════════════════════════════════
      
      // 1. 座標定義（下部ティーから右斜め上へ200yd、そこで左上へ90度直角折れ）
      // ティーグラウンド中心
      const teeX = W * 0.36;
      const teeY = H * 0.90;

      // 200ydコーナー（IP点・曲がり角）
      const cornerX = W * 0.64;
      const cornerY = H * 0.44;

      // 左奥グリーンエリア中心
      const greenAreaX = W * 0.28;
      const greenAreaY = H * 0.18;

      // 2つのグリーン
      // 手前グリーン (OUT / Hole 8 用)
      const g1X = W * 0.22;
      const g1Y = H * 0.22;
      // 奥グリーン (IN / Hole 17 用)
      const g2X = W * 0.38;
      const g2Y = H * 0.15;

      // 2. フェアウェイ（L字形状のパス）
      // ティーからコーナーへのストレート区間（幅22px、角度約25度の右傾斜）
      const fwAngle = Math.atan2(cornerY - teeY, cornerX - teeX);
      const perpAngle = fwAngle + Math.PI / 2;
      const hw1 = 12; // 縦区間半幅

      // コーナーから左上への直角区間（幅24px、角度約-155度）
      const leg2Angle = Math.atan2(greenAreaY - cornerY, greenAreaX - cornerX);
      const perpAngle2 = leg2Angle + Math.PI / 2;
      const hw2 = 14; // 横区間半幅

      // メインフェアウェイ（高麗芝の鮮やかな緑 #698B22 / #589228）
      ctx.save();
      ctx.beginPath();
      // ティー下部
      ctx.moveTo(teeX - Math.cos(perpAngle)*hw1, teeY - Math.sin(perpAngle)*hw1 + 4);
      // ティー下部右
      ctx.lineTo(teeX + Math.cos(perpAngle)*hw1, teeY + Math.sin(perpAngle)*hw1 + 4);
      // 右外縁〜コーナー外角
      ctx.lineTo(cornerX + Math.cos(perpAngle)*hw1 + 2, cornerY + Math.sin(perpAngle)*hw1 + 2);
      // コーナー外角奥
      ctx.lineTo(cornerX + Math.cos(perpAngle2)*hw2 + 4, cornerY + Math.sin(perpAngle2)*hw2 + 4);
      // グリーン奥右
      ctx.lineTo(greenAreaX + Math.cos(perpAngle2)*hw2 + 6, greenAreaY + Math.sin(perpAngle2)*hw2 + 6);
      // グリーン奥左（丸み）
      ctx.arc(greenAreaX - 2, greenAreaY, hw2 + 4, perpAngle2, perpAngle2 + Math.PI);
      // グリーン手前左
      ctx.lineTo(greenAreaX - Math.cos(perpAngle2)*hw2 - 2, greenAreaY - Math.sin(perpAngle2)*hw2 - 2);
      // コーナー内角
      ctx.lineTo(cornerX - Math.cos(perpAngle)*hw1 - 1, cornerY - Math.sin(perpAngle)*hw1 - 1);
      // ティー左外縁
      ctx.lineTo(teeX - Math.cos(perpAngle)*hw1, teeY - Math.sin(perpAngle)*hw1 + 4);
      ctx.closePath();

      // フェアウェイのベース塗り（アコーディア式: 柔らかい影+フリンジ縁+鮮緑）※線ブラッシュアップ
      ctx.save();
      ctx.translate(1.2, 1.8);
      ctx.fillStyle = "rgba(70,100,25,0.25)";
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#57b52b";
      ctx.fill();
      ctx.strokeStyle = "#93cf55";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 斜めシマシマ刈り目ストライプ
      ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 3.2;
      for (let s = -H; s < W + H; s += 6.5) {
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(s + H * 0.9, H);
        ctx.stroke();
      }
      ctx.restore();

      // 3. カート道（白い細線）- 添付画像通りに左サイドを通る
      ctx.strokeStyle = "#878d91";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      // ティー周囲から左サイドへカーブ
      ctx.arc(teeX, teeY + 2, 7, 0, Math.PI);
      ctx.moveTo(teeX - 7, teeY + 2);
      ctx.bezierCurveTo(teeX - 8, teeY - 20, cornerX - 18, cornerY + 15, cornerX - 12, cornerY - 2);
      ctx.lineTo(greenAreaX - 4, greenAreaY + 10);
      ctx.stroke();
      ctx.strokeStyle = "#c9ced3";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // 4. コーナー左側の小さな青い池（添付画像中央のハザード）
      ctx.fillStyle = "#2f7fe0";
      ctx.beginPath();
      ctx.ellipse(cornerX - 16, cornerY + 4, 3.5, 2.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e23b3b";
      ctx.lineWidth = 1.3;
      ctx.setLineDash([2.5, 2.5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 5. 木々の列（添付画像通りに右側・左側・コーナー奥・内角に密集配置）
      const drawTreeWithShadow = (tx, ty, r = 3.2) => {
        // 黒い接地影（右下）
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.beginPath();
        ctx.ellipse(tx + 1.2, ty + 1.5, r * 0.9, r * 0.7, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // 樹冠（深緑）
        ctx.fillStyle = "#004d00";
        ctx.beginPath();
        ctx.arc(tx, ty, r, 0, Math.PI * 2);
        ctx.fill();
        // ハイライト（黄緑）
        ctx.fillStyle = "#228811";
        ctx.beginPath();
        ctx.arc(tx - 0.6, ty - 0.6, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      };

      // 右サイドの木々の列（ティーからコーナーまで）
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const tx = (teeX + Math.cos(perpAngle)*hw1 + 4) * (1 - t) + (cornerX + Math.cos(perpAngle)*hw1 + 5) * t;
        const ty = (teeY + Math.sin(perpAngle)*hw1) * (1 - t) + (cornerY + Math.sin(perpAngle)*hw1 + 2) * t;
        drawTreeWithShadow(tx, ty, 3.0);
      }

      // コーナー奥の木々の列（北東の壁）
      const cornerWallTrees = [
        [cornerX + 10, cornerY - 4], [cornerX + 6, cornerY - 10], [cornerX + 1, cornerY - 14],
        [cornerX - 5, cornerY - 18], [cornerX - 12, cornerY - 21]
      ];
      for(const pt of cornerWallTrees) drawTreeWithShadow(pt[0], pt[1], 3.2);

      // 左サイドの木々の列（ショートカットを遮断する内角の林）
      const innerCornerForest = [
        [teeX - 6, teeY - 14], [teeX - 3, teeY - 26], [teeX + 2, teeY - 38],
        [teeX + 7, teeY - 50], [cornerX - 10, cornerY + 12], [cornerX - 6, cornerY + 18],
        [cornerX - 18, cornerY + 24], [cornerX - 14, cornerY + 34], [cornerX - 22, cornerY + 44]
      ];
      for(const pt of innerCornerForest) drawTreeWithShadow(pt[0], pt[1], 3.4);

      // ショートカット禁止ライン（赤破線）
      ctx.strokeStyle = "rgba(255, 50, 50, 0.85)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(teeX, teeY - 8);
      ctx.lineTo(g1X + 4, g1Y + 6);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255, 60, 60, 0.95)";
      ctx.font = "bold 7.5px 'Noto Sans JP', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🚫直角90°", W * 0.44, H * 0.72);

      // 6. ティーグラウンド（手前下部・明るい緑の長方形）
      ctx.fillStyle = "#35c94a";
      ctx.fillRect(teeX - 5, teeY - 3, 10, 6);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(teeX - 5, teeY - 3, 10, 6);

      // ティーマーカー（OUT青 / IN赤）
      const isIN = (curHole && curHole.isIN);
      ctx.fillStyle = isIN ? "#ee3333" : "#3388ff";
      ctx.beginPath();
      ctx.arc(teeX, teeY, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // 7. 2つのグリーン ＆ バンカー（添付画像通りに左上に2個）
      // 手前グリーン (g1X, g1Y)
      // 奥グリーン (g2X, g2Y)
      // 2つのグリーンの間の白いバンカー
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse((g1X + g2X) / 2 - 2, (g1Y + g2Y) / 2 + 1, 4.5, 3.0, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#deb887";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // グリーン1（手前・Hole 8用）※黄緑+細縁に調和
      ctx.fillStyle = isIN ? "#a9d63f" : "#c2e650";
      ctx.beginPath();
      ctx.arc(g1X, g1Y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#77b01e";
      ctx.lineWidth = 1;
      ctx.stroke();

      // グリーン2（奥・Hole 17用）
      ctx.fillStyle = isIN ? "#c2e650" : "#a9d63f";
      ctx.beginPath();
      ctx.arc(g2X, g2Y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#77b01e";
      ctx.lineWidth = 1;
      ctx.stroke();

      // アクティブグリーンのピンフラッグ
      const targetGX = isIN ? g2X : g1X;
      const targetGY = isIN ? g2Y : g1Y;
      ctx.fillStyle = "#ff2222";
      ctx.beginPath();
      ctx.arc(targetGX, targetGY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 8. 200yd地点コーナーIPマーカー
      ctx.fillStyle = "#ffee00";
      ctx.beginPath();
      ctx.arc(cornerX, cornerY, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,60,0,0.65)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.font = "bold 7px sans-serif";
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 2;
      ctx.fillStyle = "#8a6500";
      ctx.textAlign = "left";
      ctx.fillText("200y", cornerX + 3, cornerY - 2);
      ctx.shadowBlur = 0;

      // 9. ボール位置投影（斜め直角コース座標変換）
      if(this.ball){
        const bx3 = this.ball.position.x;
        const bz3 = this.ball.position.z;

        let mbx = teeX;
        let mby = teeY;

        if(bz3 > -205){
          // ティーからコーナーへのストレート区間（Z: 0 〜 -200）
          const tZ = Math.min(1.0, Math.max(0, -bz3 / 205));
          mbx = teeX + tZ * (cornerX - teeX) + (bx3 / 25) * 6;
          mby = teeY + tZ * (cornerY - teeY);
        } else {
          // コーナーから左上グリーンへの直角区間（X: 0 〜 -80）
          const tX = Math.min(1.0, Math.max(0, -bx3 / 80));
          mbx = cornerX + tX * (targetGX - cornerX);
          mby = cornerY + tX * (targetGY - cornerY);
        }

        // ボール本体（黄色/白色）
        ctx.fillStyle = this.ball.inFlight ? "#ffff00" : "#ffffff";
        ctx.beginPath();
        ctx.arc(mbx, mby, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // エイム方向矢印
        if(!this.ball.inFlight){
          const rad = this.aimAngle * Math.PI / 180;
          const len = 13;
          const ex = mbx + Math.sin(rad) * len;
          const ey = mby - Math.cos(rad) * len;
          ctx.strokeStyle = this.gameMode === "putt" ? "#00ffdd" : "#ffd700";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(mbx, mby);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

    } else {
      // ═════════════════════════════════════════════════════════════
      // 通常ホール：手前（下）がティー、奥（上）がグリーン
      // ═════════════════════════════════════════════════════════════
      const sX = W / 190;
      const sZ = (H - 24) / Math.max(100, this.terrainH);
      const cx = W / 2;
      const teeY = H - 12;
      const pinY = 12;

      // ═══ アコーディア公式レイアウト図の作法で描く（線ブラッシュアップ） ═══
      // ラフ=淡黄緑 / フェアウェイ=鮮緑+斜め刈り目+フリンジ縁 / カート道=灰の帯 / OB=白線 /
      // 池=飽和青+赤点線PA / バンカー=白抜き / グリーン=黄緑+細縁 / ティー=鮮緑の小矩形
      const pinMX = cx + (this.pinPos ? this.pinPos.x : 0) * sX;
      const pinMY = Math.max(8, teeY + (this.pinPos ? this.pinPos.z : -this.terrainH * 0.97) * sZ);
      const teeMX = cx + (this.teePos ? this.teePos.x : 0) * sX;
      const cl = (this._centerline && this._centerline.length > 1) ? this._centerline : [{x:0, z:0}, {x:0, z:-this.terrainH * 0.97}];
      const fwW = Math.max(9, 34 * sX), fwH = fwW / 2;
      const cps = cl.map(pt => ({ x: cx + pt.x * sX, y: teeY + pt.z * sZ }));
      const offs = (d) => cps.map((p, i) => {
        const a = cps[Math.max(0, i - 1)], b = cps[Math.min(cps.length - 1, i + 1)];
        let dx = b.x - a.x, dy = b.y - a.y; const ln = Math.hypot(dx, dy) || 1;
        return { x: p.x - (dy / ln) * d, y: p.y + (dx / ln) * d };
      });
      const smoothLine = (pts) => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      };
      const bandPath = (half) => {
        const L = offs(half), R = offs(-half);
        const p = new Path2D();
        p.moveTo(L[0].x, L[0].y);
        for (let i = 1; i < L.length - 1; i++) p.quadraticCurveTo(L[i].x, L[i].y, (L[i].x + L[i + 1].x) / 2, (L[i].y + L[i + 1].y) / 2);
        p.lineTo(L[L.length - 1].x, L[L.length - 1].y);
        for (let i = R.length - 1; i > 0; i--) p.quadraticCurveTo(R[i].x, R[i].y, (R[i].x + R[i - 1].x) / 2, (R[i].y + R[i - 1].y) / 2);
        p.lineTo(R[0].x, R[0].y);
        p.closePath();
        p.moveTo(cps[0].x + half, cps[0].y); p.arc(cps[0].x, cps[0].y, half, 0, Math.PI * 2);
        const e = cps[cps.length - 1];
        p.moveTo(e.x + half, e.y); p.arc(e.x, e.y, half, 0, Math.PI * 2);
        return p;
      };
      const rrPath = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // OBライン（白・両サイド）
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1.6;
      smoothLine(offs(fwH + 6)); ctx.stroke();
      smoothLine(offs(-fwH - 6)); ctx.stroke();

      // カート道（灰の帯・左サイド）
      smoothLine(offs(-fwH - 3.4));
      ctx.strokeStyle = "#878d91"; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.strokeStyle = "#c9ced3"; ctx.lineWidth = 1.5; ctx.stroke();

      // フェアウェイ（柔らかい影 → フリンジ → 鮮緑+斜め刈り目）
      ctx.save();
      ctx.translate(1.2, 1.8);
      ctx.fillStyle = "rgba(70,100,25,0.25)";
      ctx.fill(bandPath(fwH + 2.5));
      ctx.restore();
      ctx.fillStyle = "#93cf55";
      ctx.fill(bandPath(fwH + 2.5));
      ctx.fillStyle = "#57b52b";
      ctx.fill(bandPath(fwH));
      ctx.save();
      ctx.clip(bandPath(fwH));
      for (let s = -H, k = 0; s < W + H; s += 7, k++) {
        ctx.strokeStyle = (k % 2 === 0) ? "rgba(255,255,255,0.13)" : "rgba(18,92,12,0.13)";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(s + H * 0.55, H);
        ctx.stroke();
      }
      ctx.restore();

      // 池・クリーク（飽和青 + 赤点線PA）
      const wbs = (typeof window !== "undefined" && window._waterBoxes) ? window._waterBoxes : [];
      for (const wb of wbs) {
        const x0 = Math.max(1, cx + wb.minX * sX), x1 = Math.min(W - 1, cx + wb.maxX * sX);
        const y0 = Math.max(1, teeY + wb.minZ * sZ), y1 = Math.min(H - 1, teeY + wb.maxZ * sZ);
        if (x1 - x0 < 2 || y1 - y0 < 2) continue;
        // 有機的な池の形にするため矩形でなく内接楕円で描く（アコーディア図の池表現）
        const wcx = (x0 + x1) / 2, wcy = (y0 + y1) / 2, wrx = (x1 - x0) / 2, wry = (y1 - y0) / 2;
        ctx.fillStyle = "#2f7fe0";
        ctx.beginPath();
        ctx.ellipse(wcx, wcy, wrx, wry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#e23b3b";
        ctx.lineWidth = 1.4;
        ctx.setLineDash([2.5, 2.5]);
        ctx.beginPath();
        ctx.ellipse(wcx, wcy, wrx + 1.5, wry + 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // グリーン（黄緑+細縁+エプロン）
      ctx.fillStyle = "#a8d95a";
      ctx.beginPath();
      ctx.arc(pinMX, pinMY, 9.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c2e650";
      ctx.beginPath();
      ctx.arc(pinMX, pinMY, 7.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#77b01e";
      ctx.lineWidth = 1;
      ctx.stroke();

      // バンカー（白抜き+細い土縁）※グリーンの後に描く: グリーン脇のバンカーがエプロンに隠れないように
      const bzs = (this._bunkerZones && this._bunkerZones.length) ? this._bunkerZones : ((typeof window !== "undefined" && window._bunkerZones) ? window._bunkerZones : []);
      const seenBz = new Set();
      for (const bz of bzs) {
        const bx2 = cx + bz.x * sX, by2 = teeY + bz.z * sZ;
        const key = Math.round(bx2) + "," + Math.round(by2);
        if (seenBz.has(key)) continue;
        seenBz.add(key);
        const rx = Math.max(2.4, (bz.r || 5) * sX), ry = Math.max(2.4, (bz.r || 5) * sZ);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(bx2, by2, rx, ry, 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(196,158,102,0.95)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // ピンフラッグ（白ポール+赤旗）
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pinMX + 0.5, pinMY + 0.5);
      ctx.lineTo(pinMX + 0.5, pinMY - 5.5);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(pinMX, pinMY);
      ctx.lineTo(pinMX, pinMY - 6);
      ctx.stroke();
      ctx.fillStyle = "#e5322d";
      ctx.beginPath();
      ctx.moveTo(pinMX, pinMY - 6);
      ctx.lineTo(pinMX + 4.6, pinMY - 4.3);
      ctx.lineTo(pinMX, pinMY - 2.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(pinMX, pinMY, 1.1, 0, Math.PI * 2);
      ctx.fill();

      // ティー（鮮緑の小矩形+IN/OUT色ドット）
      ctx.fillStyle = "#35c94a";
      rrPath(teeMX - 5, teeY - 3, 10, 6, 1.5);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = (curHole && curHole.isIN) ? "#ee3333" : "#4488ff";
      ctx.beginPath();
      ctx.arc(teeMX, teeY, 1.6, 0, Math.PI * 2);
      ctx.fill();

      // ボール
      if(this.ball){
        const bx = Math.max(4, Math.min(W - 4, cx + this.ball.position.x * sX));
        const by = Math.max(6, Math.min(teeY, teeY + this.ball.position.z * sZ));

        // 飛行軌跡
        if(this.ball.inFlight && this.ball.phase === "carry"){
          const sy = Math.max(6, Math.min(teeY, teeY + this.ball.carryStartPos.z * sZ));
          const sx = cx + this.ball.carryStartPos.x * sX;
          ctx.strokeStyle = "rgba(255,140,26,0.85)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.fillStyle = this.ball.inFlight ? "#ffff00" : "#ffffff";
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // エイム矢印
        if(!this.ball.inFlight){
          const rad = this.aimAngle * Math.PI / 180;
          const len = 12;
          const ex = bx + Math.sin(rad) * len;
          const ey = by - Math.cos(rad) * len;
          ctx.strokeStyle = "rgba(90,60,0,0.5)";
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.strokeStyle = this.gameMode === "putt" ? "#00ffdd" : "#ffd700";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.arc(ex, ey, 2.2, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }

    // ─── 共通オーバーレイ（ホール番号・風向） ───
    ctx.font = "bold 9px 'Orbitron',monospace";
    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = 3;
    ctx.fillStyle = "#17530f";
    ctx.textAlign = "left";
    ctx.fillText("H" + (this.currentHoleIdx + 1), 4, 12);

    ctx.font = "8px monospace";
    ctx.fillStyle = "rgba(23,83,15,0.9)";
    ctx.textAlign = "left";
    ctx.fillText(Math.round(this.terrainH) + "yd", 4, H - 3);
    ctx.shadowBlur = 0;

    // 風向インジケータ（右上）
    if(this.weather){
      const wr = this.weather.windDirection * Math.PI / 180;
      const ws = Math.min(this.weather.windStrength, 15) / 15;
      const wx = W - 12, wy = 12;
      ctx.strokeStyle = "rgba(21,84,130,0.75)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(wx, wy, 8, 0, Math.PI*2);
      ctx.stroke();
      ctx.strokeStyle = "#1565a8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.sin(wr) * 7 * ws, wy - Math.cos(wr) * 7 * ws);
      ctx.stroke();
    }
  }// ===== 常時残り距離表示（全クラブ・パター完全一致システム） =====
  _updateDistPanel(){
    if(!this.ball||!this.pinPos)return;
    const distYd=Math.round(this._distToPin());
    const distM=Math.round(distYd*0.9144);
    const distFt=Math.round(distYd*3);
    const distPanel=document.getElementById("distPanel");
    const numEl=document.getElementById("distNum");
    const unitEl=document.getElementById("distUnit");
    const subEl=document.getElementById("distSub");
    const brkEl=document.getElementById("distBreak");
    const lblEl=document.getElementById("distLabel");
    const clubBar=document.getElementById("clubDistBar");
    if(!distPanel||!numEl)return;

    // distPanel を全クラブ共通で常時表示（パターでも非表示にしない！）
    distPanel.style.display="block";

    if(this.gameMode==="putt"){
      // ===== パター選択時：残距離を完全一致（ydを主役にし、ft・mを併記） =====
      distPanel.classList.add("putt-style");
      distPanel.style.borderLeftColor="#00ffcc";

      if(this.ball.inFlight){
        distPanel.classList.add("inflight");
        const rolledYd=Math.round(this.ball.distanceTraveled);
        const rolledFt=Math.round(rolledYd*3);
        if(lblEl) lblEl.innerHTML='<span style="color:#00ffcc;font-weight:900;font-size:0.75rem;">⛳</span> 転がり距離';
        numEl.textContent=rolledYd;
        if(unitEl) unitEl.textContent="yd";
        if(subEl) subEl.textContent=`${rolledFt}ft 転がり済`;
        if(brkEl) brkEl.textContent=`ピンまで ${distYd}yd (${distFt}ft)`;
        if(clubBar) clubBar.style.display="none";
      }else{
        distPanel.classList.remove("inflight");
        if(lblEl) lblEl.innerHTML='<span style="color:#00ffcc;font-weight:900;font-size:0.75rem;">⛳</span> カップまで';
        // ★ ここが決定打！パターでも他のクラブと同じ distYd（yd）を特大表示！
        numEl.textContent=distYd;
        if(unitEl) unitEl.textContent="yd";
        if(subEl) subEl.textContent=`${distFt} ft  (${distM}m)`;
        if(brkEl) brkEl.textContent="🏌️ パター推奨タッチ";

        // パター時のclubBar表示
        if(clubBar){
          clubBar.style.display="block";
          const num=document.getElementById("clubDistBarNum");
          const carry=document.getElementById("clubDistCarry");
          const run=document.getElementById("clubDistRun");
          const lbl=document.getElementById("clubDistBarLabel");
          if(num) num.textContent=`${distYd}yd`;
          if(carry) carry.textContent="Touch: Just";
          if(run) run.textContent=`${distFt}ft`;
          if(lbl) lbl.textContent="⛳ PT パット推奨";
        }
      }
    }else if(this.gameMode==="approach"){
      // ===== アプローチモード =====
      distPanel.classList.remove("putt-style");
      distPanel.style.borderLeftColor="var(--approach)";

      if(this.ball.inFlight){
        distPanel.classList.add("inflight");
        const flown=Math.round(this.ball.distanceTraveled);
        if(lblEl) lblEl.innerHTML='<span style="color:#ffaa00;font-weight:900;font-size:0.75rem;">🎯</span> 飛距離';
        numEl.textContent=flown;
        if(unitEl) unitEl.textContent="yd";
        if(subEl) subEl.textContent=`ピンまで ${distYd}yd (${distM}m)`;
        if(brkEl) brkEl.textContent="";
        if(clubBar) clubBar.style.display="none";
      }else{
        distPanel.classList.remove("inflight");
        if(lblEl) lblEl.innerHTML='<span style="color:#ff5500;font-weight:900;font-size:0.75rem;">↑</span> ピンまで';
        numEl.textContent=distYd;
        if(unitEl) unitEl.textContent="yd";
        const club=CLUBS[this.currentClubIdx];
        const c=this.character;
        if(club&&c){
          const sm=1.0;
          const gm=this._getGoatDistMult?this._getGoatDistMult():1.0;
          const est=Math.round(club.maxDist*sm*(this.weather?this.weather.distMult:1)*gm);
          const diff=est-distYd;
          const diffStr=diff>0?`+${diff}yd`:`${diff}yd`;
          if(subEl) subEl.textContent=`${distFt} ft  (${distM}m)`;
          if(brkEl) brkEl.textContent=`${club.name} 推定:${est}yd (誤差${diffStr})`;
          if(clubBar){
            clubBar.style.display="block";
            const num=document.getElementById("clubDistBarNum");
            const carry=document.getElementById("clubDistCarry");
            const run=document.getElementById("clubDistRun");
            const lbl=document.getElementById("clubDistBarLabel");
            const estCarryA=Math.round(est*(1-(CLUBS[this.currentClubIdx]?.runFactor||0.02)));
            const estRunA=est-estCarryA;
            if(num) num.textContent=est+"yd";
            if(carry) carry.textContent="C:"+estCarryA+"yd";
            if(run) run.textContent="R:"+estRunA+"yd";
            if(lbl) lbl.textContent="🎯 "+club.name+" 推定";
          }
        }
      }
    }else{
      // ===== 通常モード =====
      distPanel.classList.remove("putt-style");
      distPanel.style.borderLeftColor="var(--gold)";

      if(this.ball.inFlight){
        distPanel.classList.add("inflight");
        const flown=Math.round(this.ball.distanceTraveled);
        if(lblEl) lblEl.innerHTML='<span style="color:#00ff88;font-weight:900;font-size:0.75rem;">✈️</span> 飛距離';
        numEl.textContent=flown;
        if(unitEl) unitEl.textContent="yd";
        if(subEl) subEl.textContent="ピンまで "+distYd+"yd";
        if(brkEl) brkEl.textContent="";
        if(clubBar) clubBar.style.display="none";
      }else{
        distPanel.classList.remove("inflight");
        if(lblEl) lblEl.innerHTML='<span style="color:#ff5500;font-weight:900;font-size:0.75rem;">↑</span> ピンまで';
        numEl.textContent=distYd;
        if(unitEl) unitEl.textContent="yd";
        const club=CLUBS[this.currentClubIdx];
        const c=this.character;
        if(club&&c&&clubBar){
          const sm=(club.type==="driver"||club.type==="wood")?c.driverMult:1.0;
          const gm=this._getGoatDistMult?this._getGoatDistMult():1.0;
          const estTotal=Math.round(club.maxDist*sm*(this.weather?this.weather.distMult:1)*gm);
          const estCarry=Math.round(estTotal*(1-club.runFactor));
          const estRun=estTotal-estCarry;
          if(subEl) subEl.textContent=club.name+" 推定:"+estTotal+"yd";
          if(brkEl) brkEl.textContent="C:"+estCarry+" + R:"+estRun+"yd";
          clubBar.style.display="block";
          const num=document.getElementById("clubDistBarNum");
          const carry=document.getElementById("clubDistCarry");
          const run=document.getElementById("clubDistRun");
          const lbl=document.getElementById("clubDistBarLabel");
          if(num) num.textContent=estTotal+"yd";
          if(carry) carry.textContent="C:"+estCarry+"yd";
          if(run) run.textContent="R:"+estRun+"yd";
          if(lbl) lbl.textContent="🏌️ 1 "+club.name+" 推定";
        }else{
          if(subEl) subEl.textContent="";
          if(brkEl) brkEl.textContent="";
          if(clubBar) clubBar.style.display="none";
        }
      }
    }

    // 上部HUD距離更新（全クラブで残距離単位をydに統一し、パット時も一致させる！）
    const hd=document.getElementById("hudDist");
    if(hd){
      hd.textContent=distYd+"yd";
    }
  }


  _updateCompass(){
    const cv=document.getElementById("compassCanvas");
    if(!cv)return;
    const ctx=cv.getContext("2d");
    const W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);
    const cx=W/2,cy=H*0.82,R=H*0.75;

    if(this.gameMode==="putt"){
      // ---- パット：フルサークルコンパス ----
      ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
      ctx.strokeStyle="rgba(0,200,255,0.15)";ctx.lineWidth=12;ctx.stroke();
      for(let i=0;i<8;i++){
        const a=(i/8)*Math.PI*2-Math.PI/2;
        ctx.beginPath();ctx.moveTo(cx+R*Math.cos(a),cy+R*Math.sin(a));
        ctx.lineTo(cx+(R-8)*Math.cos(a),cy+(R-8)*Math.sin(a));
        ctx.strokeStyle="rgba(0,255,200,0.4)";ctx.lineWidth=1.5;ctx.stroke();
      }
      // ピン方向マーカー
      if(this.ball&&this.pinPos){
        const dx=this.pinPos.x-this.ball.position.x;
        const dz=this.pinPos.z-this.ball.position.z;
        const pinDeg=Math.atan2(dx,-dz)*180/Math.PI;
        const pinA=(pinDeg-90)*Math.PI/180;
        ctx.beginPath();
        ctx.moveTo(cx+(R-2)*Math.cos(pinA),cy+(R-2)*Math.sin(pinA));
        ctx.lineTo(cx+(R+10)*Math.cos(pinA),cy+(R+10)*Math.sin(pinA));
        ctx.strokeStyle="#ff4444";ctx.lineWidth=3;ctx.stroke();
        ctx.font="bold 8px 'Orbitron',monospace";ctx.fillStyle="#ff4444";ctx.textAlign="center";
        ctx.fillText("⛳",(cx+(R+18)*Math.cos(pinA)).toFixed(0),(cy+(R+18)*Math.sin(pinA)+3).toFixed(0));
      }
      // エイム針
      const aimA=(this.aimAngle-90)*Math.PI/180;
      const nx=cx+(R+2)*Math.cos(aimA),ny=cy+(R+2)*Math.sin(aimA);
      ctx.save();ctx.translate(nx,ny);ctx.rotate(aimA+Math.PI/2);
      ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(4,5);ctx.lineTo(-4,5);ctx.closePath();
      ctx.fillStyle="#00ffdd";ctx.fill();ctx.restore();
      const degFull=Math.round(((this.aimAngle%360)+360)%360);
      ctx.font="bold 9px 'Orbitron',monospace";ctx.fillStyle="#00ffdd";ctx.textAlign="center";
      ctx.fillText(degFull+"°",cx,cy+4);
    }else{
      // ---- 通常・アプローチ：半円コンパス（360度針対応）----
      // 半円の背景
      ctx.beginPath();ctx.arc(cx,cy,R,Math.PI,0);
      ctx.strokeStyle="rgba(255,255,255,0.1)";ctx.lineWidth=14;ctx.stroke();
      const col=this.gameMode==="approach"?"rgba(255,180,0,0.3)":"rgba(0,200,80,0.25)";
      ctx.beginPath();ctx.arc(cx,cy,R,Math.PI,0);ctx.strokeStyle=col;ctx.lineWidth=12;ctx.stroke();

      // ピン方向マーカー（半円上にPINラベル）
      // ピンへの実際の角度を計算
      let pinRelDeg=0;
      if(this.ball&&this.pinPos){
        const dx=this.pinPos.x-this.ball.position.x;
        const dz=this.pinPos.z-this.ball.position.z;
        pinRelDeg=Math.atan2(dx,-dz)*180/Math.PI;
      }
      // 半円上の5本目盛り（-90,-45,0,+45,+90度をPIN基準に）
      for(let i=-2;i<=2;i++){
        const deg=pinRelDeg+i*45;
        const ang=(deg-90)*Math.PI/180;
        // 半円の範囲（下半分=π〜0）内のみ描画
        const normAng=((ang%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
        if(normAng>0&&normAng<Math.PI){
          ctx.beginPath();
          ctx.moveTo(cx+R*Math.cos(ang),cy+R*Math.sin(ang));
          ctx.lineTo(cx+(R-8)*Math.cos(ang),cy+(R-8)*Math.sin(ang));
          ctx.strokeStyle=i===0?"rgba(255,80,80,0.9)":"rgba(255,255,255,0.3)";
          ctx.lineWidth=i===0?2.5:1.5;ctx.stroke();
        }
      }
      // PILラベル（常に上部中央）
      ctx.font="bold 9px 'Orbitron',monospace";ctx.fillStyle="rgba(255,80,80,0.9)";ctx.textAlign="center";
      ctx.fillText("PIN",cx,cy-R+16);

      // エイム針（aimAngleを半円上にマッピング）
      // aimAngle は絶対角度。半円の -90°〜+90°（左〜右）に相対でマッピング
      const relToPinDeg=this.aimAngle-pinRelDeg;
      // -90〜+90 にクランプして針位置を決める（それ以上はバー端）
      const clampedRel=Math.max(-90,Math.min(90,relToPinDeg));
      // 半円: π（左端）〜0（右端）, clampedRel:-90→π, 0→π/2(上), +90→0
      const aimAng=Math.PI/2-(clampedRel*Math.PI/180);
      const nx2=cx+(R+2)*Math.cos(aimAng),ny2=cy+(R+2)*Math.sin(aimAng);
      ctx.save();ctx.translate(nx2,ny2);ctx.rotate(aimAng-Math.PI/2);
      ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(4,5);ctx.lineTo(-4,5);ctx.closePath();
      ctx.fillStyle=this.gameMode==="approach"?"#ffcc44":"#ffd700";ctx.fill();ctx.restore();

      // 角度テキスト
      const dispDeg=Math.round(Math.abs(clampedRel));
      ctx.font="bold 10px 'Orbitron',monospace";
      ctx.fillStyle=this.gameMode==="approach"?"#ffcc44":"#ffd700";ctx.textAlign="center";
      const side=clampedRel<-1?"◀ ":clampedRel>1?"▶ ":"";
      ctx.fillText(side+dispDeg+"°",cx,cy+3);
    }
  }

  _updateAimAngleDisplay(){
    const el=document.getElementById("aimDegPad");
    if(!el)return;
    const a=this.aimAngle;
    if(this.gameMode==="putt"){
      const deg=Math.round(((a%360)+360)%360);
      el.textContent=deg+"°";
    }else{
      let relDeg=a;
      if(this.ball&&this.pinPos){
        const dx=this.pinPos.x-this.ball.position.x;
        const dz=this.pinPos.z-this.ball.position.z;
        const pinDeg=Math.atan2(dx,-dz)*180/Math.PI;
        relDeg=a-pinDeg;
        while(relDeg>180)relDeg-=360;
        while(relDeg<-180)relDeg+=360;
      }
      const abs=Math.abs(relDeg).toFixed(0);
      el.textContent=Math.abs(relDeg)<1.5?"PIN":(relDeg<0?`◀${abs}°`:`${abs}°▶`);
    }
  }

  _updateFlightBar(){
    const bar=document.getElementById("flightBar");
    if(!this.ball||!this.ball.inFlight){bar.style.display="none";return;}
    const dist=Math.round(this.ball.distanceTraveled);
    const total=Math.round(this.ball.totalDistYd||0);
    const ph=this.ball.phase;
    const ht=Math.round(this.ball.maxHeight*10)/10;
    const windTag=this.weather&&this.weather.windStrength>3?` | 💨${this.weather.windStrength.toFixed(1)}m/s`:"";
    bar.textContent=ph==="carry"?`✈️ キャリー ${dist}yd | 高さ${ht}yd | ~${total}yd${windTag}`:ph==="run"?`🌿 ラン ${dist}yd (着地面:${this.ball.landedSurface==="rough"?"ラフ":this.ball.landedSurface==="bunker"?"バンカー":"FW"})`:ph==="putt_roll"?`⛳ ロール ${dist}yd`:"";
  }

  _updateHoleUI(hole){

    // ★ 戸田パブリック タクティカルアラート表示
    const alertEl = document.getElementById("tacticalAlertBadge");
    if(alertEl){
      if(hole.alert){
        alertEl.textContent = hole.alert;
        alertEl.style.display = "block";
      } else {
        alertEl.style.display = "none";
      }
    }

    if(!hole)return;
    const total=this.currentCourse?this.currentCourse.holes.length:18;
    const cur=this.currentHoleIdx+1;
    const setEl=(id,txt)=>{const e=document.getElementById(id);if(e)e.textContent=txt;};
    setEl("hiHoleNum",`HOLE ${hole.n}`);
    setEl("holeProgress",`${cur} / ${total}ホール`);
    setEl("hiYards",`${hole.yards}yd`);
    setEl("hiPar",`Par ${hole.par}`);
    setEl("hiName",hole.name||"");
    // ★ feat絵文字付き特徴表示（複数feat対応）
    const hf=hole.feat||"";
    const featParts=[];
    if(hf.includes("island_green")) featParts.push("🏝️ Island Green");
    if(hf.includes("water_front"))  featParts.push("💧 池越え");
    if(hf.includes("water_left"))   featParts.push("💧 左池");
    if(hf.includes("water_right"))  featParts.push("💧 右池");
    if(hf.includes("ocean")||hf.includes("cliff")) featParts.push("🌊 海沿い");
    if(hf.includes("leftDogleg"))   featParts.push("↩ 左Dog");
    if(hf.includes("rightDogleg"))  featParts.push("↪ 右Dog");
    if(hf.includes("ob_left"))      featParts.push("⚠️ 左OB");
    if(hf.includes("elevated_green")) featParts.push("⛰️ 砲台");
    const bNum=parseInt((hf.match(/bunker(\d)/)||[0,0])[1])||0;
    if(bNum>0) featParts.push(`⛱️ ×${bNum}`);
    setEl("hiDesc",featParts.join("  ")||"");

    // ホール説明も一時表示
    if(hole.desc){
      const de=document.getElementById("holeDescHUD");
      if(de){
        de.textContent=hole.desc;
        de.style.display="block";
        clearTimeout(this._descTimer2);
        this._descTimer2=setTimeout(()=>{de.style.display="none";},5500);
      }
    }
    setEl("hudHole",`${cur}/${total}`);
    // ホール説明をトーストで4秒表示
    if(hole.desc){
      const toast=document.getElementById("holeDescToast");
      if(toast){
        toast.textContent=hole.desc;
        toast.style.display="block";
        clearTimeout(this._toastTimer);
        this._toastTimer=setTimeout(()=>{toast.style.display="none";},4500);
      }
    }
  }
  _updateWeatherUI(){
    const w=this.weather,lbl=w.label.split(" ");
    // 風向き矢印（8方位）
    const wStr=w.windStrength||0;
    const wAngle=w.windDirection||0;
    const wDirArrows=["↑","↗","→","↘","↓","↙","←","↖"];
    const wDirIdx=Math.round(((wAngle+360)%360)/45)%8;
    const wArrow=wStr>0.5?wDirArrows[wDirIdx]:"—";
    const wEl=document.getElementById("windIndicator");
    if(wEl&&w) wEl.textContent=wStr>0.5?`${wArrow} ${wStr.toFixed(1)}m/s`:"無風";
    const wi=document.getElementById("weatherIcon");if(wi)wi.textContent=lbl[0]||"☀️";
    const wl=document.getElementById("weatherLabel");if(wl)wl.textContent=lbl.slice(1).join(" ");
    // 風速：強さに応じて色を変える
    const winfo=document.getElementById("windInfo");
    if(winfo){
      const ws=w.windStrength;
      const wcolor=ws<3?"#88ccff":ws<7?"#ffcc44":ws<11?"#ff8844":"#ff4444";
      winfo.textContent=` ${ws.toFixed(1)}m/s`;
      winfo.style.color=wcolor;
    }
    const ti=document.getElementById("tempInfo");if(ti)ti.textContent=` ${w.temperature}°C`;
    const arrows=["→","↗","↑","↖","←","↙","↓","↘"];
    const wa=document.getElementById("windArrow");
    if(wa)wa.textContent=" "+arrows[Math.round(w.windDirection/45)%8];
  }
  _updateHUDStrokes(){
    // 完了ホールのスコア集計（打数 - パー）
    let totalCompletedStrokes = 0;
    let totalCompletedPars = 0;
    let completedRelativeScore = 0;

    for(let i=0; i<this.currentHoleIdx; i++){
      const sc = this.scores[i] || 0;
      if (sc > 0 && this.currentCourse && this.currentCourse.holes[i]) {
        const hPar = this.currentCourse.holes[i].par;
        totalCompletedStrokes += sc;
        totalCompletedPars += hPar;
        completedRelativeScore += (sc - hPar);
      }
    }

    // 現在プレイ中ホールのパー
    const curHole = (this.currentCourse && this.currentCourse.holes) ? this.currentCourse.holes[this.currentHoleIdx] : null;
    const curPar = curHole ? curHole.par : 4;

    // 現在ホールでの打数
    const curStrokes = this.strokes || 0;

    // 【ユーザー公式準拠スコア表示】
    // まだホールアウトしていない場合でも、現在ホールで打った分も含めた現時点の通算スコア（または完了ホール通算）
    // 通算スコア（完了ホール合計）
    // 0の場合は "0", マイナスは "-1", プラスは "+1"
    const relScore = completedRelativeScore;
    let relScoreStr = relScore === 0 ? "0" : (relScore > 0 ? `+${relScore}` : `${relScore}`);
    let relColor = relScore === 0 ? "#ffffff" : (relScore < 0 ? "#00ff88" : "#ff8855");

    // HUD上部中央パネル
    const hudScore = document.getElementById("hudScore");
    if(hudScore) {
      hudScore.innerHTML = `<span style="font-size:1.3rem;font-weight:900;color:${relColor};">${relScoreStr}</span>`;
    }

    const hudStrokes = document.getElementById("hudStrokes");
    if(hudStrokes) {
      const totalStrokesAll = totalCompletedStrokes + curStrokes;
      hudStrokes.innerHTML = `<span style="font-size:0.75rem;color:#cceeff;">${totalStrokesAll}打</span> <span style="font-size:0.6rem;color:#8ab;">(今H: ${curStrokes}打/P${curPar})</span>`;
    }
  }

  _autoSelectClub(yards){
    if(this.gameMode==="putt"){this.currentClubIdx=CLUBS.length-1;this._highlightClub();return;}
    // 残り距離に最も適したクラブを選択（NS想定の実飛距離＋GOATパワー率×神装飛距離補正で比較）
    const c=this.character;
    const gm=this._getGoatDistMult?this._getGoatDistMult():1.0;
    const surf=(this.ball&&this.getSurf)?this.getSurf(this.ball.position.x,this.ball.position.z):"fairway";
    const lieMult=surf==="bunker"?0.55:surf==="rough"?0.82:1.0;
    let best=CLUBS.length-2;
    let bestDiff=9999;
    for(let i=0;i<CLUBS.length-1;i++){
      const cl=CLUBS[i];
      const sm=(cl.type==="driver"||cl.type==="wood")?c.driverMult:1.0;
      const estDist=cl.maxDist*0.80*sm*(this.weather?this.weather.distMult:1)*gm*lieMult;
      const diff=Math.abs(estDist-yards);
      if(diff<bestDiff){bestDiff=diff;best=i;}
    }
    this.currentClubIdx=best;this._highlightClub();
  }

  // iOS触覚フィードバック
  _haptic(type="light"){
    try{
      if(window.navigator&&window.navigator.vibrate){
        const patterns={light:30,medium:60,heavy:100,success:[50,50,100]};
        window.navigator.vibrate(patterns[type]||30);
      }
    }catch(e){}
  }
  _checkHoleComplete(){
    if(!this.ball||this.ball.inFlight||this.strokes===0)return;
    if(this._holeCompletedFlag)return; // 二重呼び出し防止
    if(this._distToPin()<2.0){
      this._holeCompletedFlag=true;
    // ★★★ AAAカップイン演出：金属カップ音「コロンッ！」＆大歓声・紙吹雪 ★★★
    if(this.audio){
      this.audio.playCupIn();
      setTimeout(() => this.audio.playCrowd("roar"), 180);
    }
    const hole=this.currentCourse&&this.currentCourse.holes[this.currentHoleIdx];
    if(this.fx&&hole){
      const scoreDiff = this.strokes - hole.par;
      const scoreName = scoreDiff <= -3 ? "ALBATROSS!" : scoreDiff === -2 ? "EAGLE!" : scoreDiff === -1 ? "BIRDIE!" : scoreDiff === 0 ? "PAR" : "BOGEY";
      this.fx.showBroadcastBanner("🏆 " + scoreName, "HOLE COMPLETED!");
    }
      this._holeComplete();
    }
  }
  _holeComplete(){
    const hole=this.currentCourse&&this.currentCourse.holes[this.currentHoleIdx];
    if(!hole){console.warn("_holeComplete: hole undefined");return;}
    this.scores[this.currentHoleIdx]=this.strokes;
    this._updateHUDStrokes(); // ★ 即時HUDスコア更新
    // ★ スタッツ集計
    this._stats.putts.push(this._holePutts);
    if(this._firstShotDist){
      this._stats.drivingDist.push(this._firstShotDist);
      if(this._firstShotDist>this._stats.longestDrive)this._stats.longestDrive=this._firstShotDist;
      // FIR: サイドが5yd以内ならフェアウェイキープ
      this._stats.firTotal++;
      if(this._firstShotSide<5)this._stats.fir++;
      this._firstShotDist=0;this._firstShotSide=0;
    }
    // GIR: par-2打以内でグリーンオンかつ
    if(hole){
      this._stats.girTotal++;
      const girStrokes=this.strokes-this._holePutts;
      if(this.greenOnShown&&girStrokes<=hole.par-2)this._stats.gir++;
    }
    const rel = this.strokes - hole.par;
    const relStr = rel === 0 ? "0" : (rel > 0 ? `+${rel}` : `${rel}`);
    // スコア名・色（打数 - パー）
    const scoreMap={
      "-3":["🦅🦅 アルバトロス！ (-3)","#ff44ff"],
      "-2":["🦅 イーグル！ (-2)","#ff88ff"],
      "-1":["🐦 バーディ！ (-1)","#00ff88"],
      "0": ["⛳ パー (0)","#88ccff"],
      "1": ["📉 ボギー (+1)","#ff9966"],
      "2": ["❌ ダブルボギー (+2)","#ff4444"],
    };
    const row=scoreMap[String(rel)]||[rel<=-3?"🔥 アルバトロス！":"💔 トリプル以上","#ff0000"];
    // ハプティクス
    if(rel<=-2)this._haptic("success");
    else if(rel==-1)this._haptic("medium");
    // ポップアップ
    const popup=document.getElementById("scorePopup");
    const totalHoles=this.currentCourse&&this.currentCourse.holes?this.currentCourse.holes.length:18;
    const isFinal=this.currentHoleIdx>=totalHoles-1;
    const nextBtnLabel=isFinal?"🏆 最終結果を表示":"➡️ 次のホールへ進む";
    if(popup){
      const holeName=hole.name?hole.name:"Hole "+hole.n;
      popup.innerHTML=row[0]+
        "<div style='font-size:0.65rem;color:#aaa;margin-top:4px'>"+holeName+" | "+this.strokes+"打 (Par "+hole.par+")</div>"+
        "<div style='font-size:0.75rem;color:#ffd700;margin-top:8px;padding:6px 14px;background:rgba(0,0,0,0.65);border:1.5px solid #ffd700;border-radius:14px;cursor:pointer;display:inline-block;pointer-events:auto;'>"+nextBtnLabel+"</div>";
      popup.style.color=row[1];popup.style.display="block";
      popup.style.pointerEvents="auto";
      popup.onclick=()=>this.nextHole();
      popup.style.animation="none";
      requestAnimationFrame(()=>requestAnimationFrame(()=>{popup.style.animation="popIn 0.4s ease-out forwards";}));
      clearTimeout(this._scorePopupTimer);
      this._scorePopupTimer = setTimeout(()=>{if(popup && !this._holeCompletedFlag)popup.style.display="none";},5000);
    }
    const nhb=document.getElementById("nextHoleBtn");
    if(nhb){
      nhb.textContent=isFinal?"🏆 結果":"➡️ 次ホール";
      nhb.style.display="block";
    }
    const sBtn=document.getElementById("shootBtn");
    if(sBtn) sBtn.textContent=isFinal?"🏆 結果":"➡️ 次ホール";
    this.shotCtrl.reset();this.puttCtrl.reset();
  }
  nextHole(){
    const nhb=document.getElementById("nextHoleBtn");
    if(nhb) nhb.style.display="none";
    const sBtn=document.getElementById("shootBtn");
    if(sBtn) sBtn.textContent="🏌️ SHOT";
    const popup=document.getElementById("scorePopup");
    if(popup){popup.style.display="none";popup.onclick=null;popup.style.pointerEvents="none";}
    this.camOrbit=0;this.camTilt=0; // ★ 新ホールでカメラリセット
    const slLeg=document.getElementById("slopeLegend");
    if(slLeg)slLeg.style.display="none";
    const lieEl=document.getElementById("lieAlert");
    if(lieEl)lieEl.style.display="none";
    this.currentHoleIdx++;
    const totalHoles=this.currentCourse&&this.currentCourse.holes?this.currentCourse.holes.length:18;
    if(this.currentHoleIdx>=totalHoles){this._onRoundFinished();return;}
    this.ball.phase="idle";this.ball.inFlight=false;
    this.loadHole(this.currentCourse,this.currentHoleIdx);
    if(this.playerMesh)this.playerMesh.position.copy(this.teePos);
  }
  // ===== SCボタン → スコアカード表示のみ（トーナメント画面にしない）=====
  showScoreCard(){
    this._showInGameScoreCard();
  }

  _showInGameScoreCard(){
    const course=this.currentCourse;
    const cGS=this.currentCourse&&this.currentCourse.greenSpeed||"--";
    const cRT=this.currentCourse&&this.currentCourse.roughType||"--";
    let html=`<tr style="background:rgba(0,80,40,0.3)"><td colspan="7" style="font-size:0.52rem;color:#88ddaa;padding:2px 4px">
      ${this.currentCourse?this.currentCourse.name:""} | Green: <b style="color:#ffd700">${cGS}</b> | Rough: <b>${cRT}</b></td></tr>
    <tr><th>H</th><th>Name</th><th>Par</th><th>Yds</th><th>Sc</th><th>±</th><th>Putt</th></tr>`;
    let tp=0,ts=0,tr=0;
    course.holes.forEach((h,i)=>{
      const sc=this.scores[i]||0,rel=sc-h.par;
      let cls="";
      if(rel<=-2)cls="sc-eagle";else if(rel===-1)cls="sc-birdie";else if(rel===1)cls="sc-bogey";else if(rel>=2)cls="sc-double";
      const rs=sc===0?"-":rel===0?"E":rel>0?`+${rel}`:String(rel);
      const isCurrent=i===this.currentHoleIdx?" style='background:rgba(255,215,0,0.12)'":"";
      const pt=this._stats.putts[i]!==undefined?this._stats.putts[i]:'-';
      const hf2=h.feat||"";
      const hfIcon=hf2.includes("island_green")?"🏝":hf2.includes("water")?"💧":
        hf2.includes("ocean")?"🌊":hf2.includes("Dogleg")?"↩":hf2.includes("ob_")?"⚠":
        hf2.includes("elevated")?"⛰":"";
      const hnDisp=(h.name?h.name.substring(0,8):"")+(hfIcon?" "+hfIcon:"");
      html+=`<tr${isCurrent}><td>${h.n}</td><td style="font-size:0.55rem">${hnDisp}</td><td>${h.par}</td><td>${h.yards}</td><td class="${cls}">${sc||"-"}</td><td class="${cls}">${sc?rs:"-"}</td><td style="color:#88aaff">${pt}</td></tr>`;
      tp+=h.par; if(sc>0){ ts+=sc; tr+=rel; }
    });
    
    const avgPutts=this._stats.putts.length>0?(this._stats.putts.reduce((a,b)=>a+b,0)/this._stats.putts.length).toFixed(1):'?';
    const firPct=this._stats.firTotal>0?Math.round(this._stats.fir/this._stats.firTotal*100):'?';
    const girPct=this._stats.girTotal>0?Math.round(this._stats.gir/this._stats.girTotal*100):'?';
    const avgDD=this._stats.drivingDist.length>0?Math.round(this._stats.drivingDist.reduce((a,b)=>a+b,0)/this._stats.drivingDist.length):0;
    const totalPutts=this._stats.putts.reduce((a,b)=>a+b,0);
    html+=`<tr style="border-top:2px solid rgba(255,215,0,0.35)"><td colspan="2"><b>TOTAL</b></td><td><b>${tp}</b></td><td></td><td><b>${ts||"-"}</b></td><td><b>${ts?(tr===0?"E":tr>0?`+${tr}`:String(tr)):"-"}</b></td><td><b>${totalPutts||'-'}</b></td></tr>`;
    html+=`<tr style="background:rgba(0,100,200,0.12);font-size:0.58rem"><td colspan="7" style="padding:5px 4px;text-align:left;color:#88aaff">📊 FIR <b style="color:#44ff88">${firPct}%</b> &nbsp; GIR <b style="color:#44ff88">${girPct}%</b> &nbsp; 平均Putt <b style="color:#ffcc44">${avgPutts}</b> &nbsp; 平均DD <b style="color:#ff8844">${avgDD?avgDD+'yd':'-'}</b> &nbsp; 最長DD <b style="color:#ff8844">${this._stats.longestDrive?Math.round(this._stats.longestDrive)+'yd':'-'}</b></td></tr>`;
    document.getElementById("scoreTableInner").innerHTML=html;
    document.getElementById("scoreCard").style.display="flex";
  }

  // ===== 18（or 9 or 3）ホール終了 → トーナメント順位表 =====
  _onRoundFinished(){
    this._showTournamentResults();
  }

  _showTournamentResults(){
    // ---- プレイヤーのトータルスコア計算 ----
    const course=this.currentCourse;
    const totalPar=course.holes.reduce((a,h)=>a+h.par,0);
    const playerTotal=this.scores.reduce((a,b)=>a+b,0);
    const playerRel=playerTotal-totalPar;
    const playerName=this.character?this.character.name:"Player";

    // ---- CPU選手データ生成（リアルなプロスコア）----
    const cpuNames=[
      {name:"TIiger",flag:"🇺🇸"},{name:"McIlro",flag:"🇮🇪"},
      {name:"DeCham",flag:"🇺🇸"},{name:"Matuya",flag:"🇯🇵"},
      {name:"Junbo",flag:"🇯🇵"},{name:"Watu",flag:"🇯🇵"},
      {name:"Scheff",flag:"🇸🇪"},{name:"Thomas",flag:"🇺🇸"},
      {name:"Lowry",flag:"🇮🇪"},{name:"Rahm",flag:"🇪🇸"},
    ].filter(c=>c.name!==playerName);

    // CPUスコア：プロらしい-10〜+5の範囲でランダム生成
    const cpuPlayers=cpuNames.slice(0,9).map((c,idx)=>{
      // プロのスコア分布：先頭選手は上手い、後ろは普通
      const base=-8+idx*1.3;
      const rand=(Math.random()-0.5)*4;
      const rel=Math.max(-18,Math.min(6,Math.round(base+rand)));
      return{name:c.name,flag:c.flag,rel,total:totalPar+rel,isPlayer:false};
    });

    // プレイヤーエントリ
    const allPlayers=[
      {name:playerName,flag:"🎌",rel:playerRel,total:playerTotal,isPlayer:true},
      ...cpuPlayers
    ];

    // スコア順にソート（同スコアならプレイヤー優先）
    allPlayers.sort((a,b)=>{
      if(a.rel!==b.rel)return a.rel-b.rel;
      return a.isPlayer?-1:1;
    });

    // 賞金テーブル（優勝4億ドル）
    const prizes=[
      400000000,120000000,75000000,48000000,32000000,
      22000000,18000000,14000000,11000000,9000000
    ];
    const fmtPrize=v=>"$"+v.toLocaleString();
    const fmtScore=r=>r===0?"E":r>0?`+${r}`:String(r);
    const rankEmoji=i=>i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}位`;

    // ---- 順位表HTML生成 ----
    const tbody=document.getElementById("leaderboardBody");
    if(!tbody)return;
    tbody.innerHTML="";
    allPlayers.forEach((p,i)=>{
      const tr=document.createElement("tr");
      if(p.isPlayer)tr.className="lb-you";
      const relCol=p.rel<0?"#00ff88":p.rel===0?"#88ccff":"#ff9966";
      tr.innerHTML=`
        <td class="lb-rank ${i===0?"rank-1":i===1?"rank-2":i===2?"rank-3":""}">${rankEmoji(i)}</td>
        <td class="lb-player">${p.flag} ${p.name}${p.isPlayer?" 👤":""}</td>
        <td class="lb-score" style="color:${relCol}">${fmtScore(p.rel)}</td>
        <td style="color:#ccc">${p.total}</td>
        <td class="lb-prize">${fmtPrize(prizes[i]||1000000)}</td>
      `;
      tbody.appendChild(tr);
    });

    // サブタイトル更新
    const sub=document.getElementById("tournamentSubtitle");
    if(sub)sub.textContent=`${course.name} — ${totalPar}Par ${allPlayers.length}人出場`;

    // トーナメント画面表示
    document.getElementById("tournamentScreen").style.display="flex";
    document.getElementById("gameUI").style.display="none";

    // ---- 優勝判定 ----
    const playerRank=allPlayers.findIndex(p=>p.isPlayer);
    if(playerRank===0){
      // 4秒後に賞金授与画面へ
      setTimeout(()=>this._showPrizeCeremony(playerName),4000);
    }
  }

  // ===== 賞金授与式（優勝時）=====
  _showPrizeCeremony(name){
    document.getElementById("tournamentScreen").style.display="none";
    const ps=document.getElementById("prizeScreen");
    const wn=document.getElementById("prizeWinnerName");
    if(wn)wn.textContent=`🎌 ${name}`;
    if(ps)ps.style.display="flex";

    // 紙吹雪スタート
    this._startConfetti();

    // FINボタン
    const finBtn=document.getElementById("prizeFinBtn");
    if(finBtn){
      finBtn.onclick=()=>{
        this._stopConfetti();
        document.getElementById("prizeScreen").style.display="none";
        this._showFin();
      };
    }
  }

  // ===== FIN画面 =====
  _showFin(){
    const fs=document.getElementById("finScreen");
    if(fs)fs.style.display="flex";
  }

  // ===== 紙吹雪アニメーション =====
  _startConfetti(){
    if(this._confettiRaf){cancelAnimationFrame(this._confettiRaf);this._confettiRaf=null;} /* v4.6: 二重起動で旧ループが孤児化し続けるのを防ぐ */
    const cv=document.getElementById("confettiCanvas");
    if(!cv)return;
    cv.width=window.innerWidth;cv.height=window.innerHeight;
    const ctx=cv.getContext("2d");
    const particles=[];
    const colors=["#ffd700","#ff4488","#00ff88","#00ccff","#ff8800","#ff00cc","#ffffff"];
    for(let i=0;i<180;i++){
      particles.push({
        x:Math.random()*cv.width,y:Math.random()*-cv.height,
        vx:(Math.random()-0.5)*4,vy:Math.random()*3+2,
        w:Math.random()*10+5,h:Math.random()*6+3,
        color:colors[Math.floor(Math.random()*colors.length)],
        rot:Math.random()*360,rv:(Math.random()-0.5)*8,
        alpha:1
      });
    }
    this._confettiRaf=null;
    const animate=()=>{
      ctx.clearRect(0,0,cv.width,cv.height);
      particles.forEach(p=>{
        p.x+=p.vx;p.y+=p.vy;p.rot+=p.rv;
        if(p.y>cv.height+20){p.y=-20;p.x=Math.random()*cv.width;}
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);
        ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;
        ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
      });
      this._confettiRaf=requestAnimationFrame(animate);
    };
    animate();
  }

  _stopConfetti(){
    if(this._confettiRaf){cancelAnimationFrame(this._confettiRaf);this._confettiRaf=null;}
    const cv=document.getElementById("confettiCanvas");
    if(cv)cv.getContext("2d").clearRect(0,0,cv.width,cv.height);
  }
  _triggerOB(){
    if(this.isOBLocked)return;this.isOBLocked=true;
    this.ball.phase="idle";this.ball.inFlight=false;
    this.strokes++;this._updateHUDStrokes();
    document.getElementById("obAlert").style.display="block";
    setTimeout(()=>{
      document.getElementById("obAlert").style.display="none";
      // ★ 前回の安全位置から復帰（なければティー）＋1ペナ済み
      const recovery=this.lastSafePos||this.teePos;
      this.ball.position.copy(recovery);
      if(this.ball.mesh)this.ball.mesh.position.copy(recovery);
      if(this.playerMesh)this.playerMesh.position.copy(recovery);
      this.isOBLocked=false;this.shotCtrl.reset();this.puttCtrl.reset();
      this._showAimViz();this._resetAimToPin();this._detectMode();
      document.getElementById("flightBar").style.display="none";
      // ballShadow 非表示
      if(this.ballShadowMesh)this.ballShadowMesh.visible=false;
    },2000);
  }

  // ===== ゲーム開始 =====
  start(course,charData,weatherType,roundHoles,distMode){
    // 飛距離モードに応じてCLUBSを切り替え（グローバル変数を更新）
    CLUBS = distMode==="super" ? CLUBS_SUPER : CLUBS_NORMAL;
    // 飛距離クラス（v4.16）: 通常モード時のみ、全クラブの maxDist にクラス倍率を適用した土台にする。
    // GOAT（super）は従来どおり無適用。クラスは対戦ブリッジが window.GOAT_BATTLE.distClass に載せる（未設定 = dracon = ×1.0 で現行と完全同一）。
    if(distMode!=="super"){
      var dcm = (typeof window!=="undefined" && window.GOAT_BATTLE) ? DIST_CLASS_MULT[window.GOAT_BATTLE.distClass] : undefined;
      if(typeof dcm==="number" && dcm!==1.0){
        CLUBS = CLUBS_NORMAL.map(function(c){ var cc=Object.assign({},c); cc.maxDist=c.maxDist*dcm; return cc; });
      }
    }
    // クラブボタンの距離表示を更新（GOAT飛距離倍率を反映）
    const startGm = this._getGoatDistMult ? this._getGoatDistMult() : 1.0;
    document.querySelectorAll(".club-btn").forEach((b,i)=>{
      const dist=b.querySelector(".club-btn-dist");
      if(dist&&CLUBS[i])dist.textContent=Math.round(CLUBS[i].maxDist*startGm)+"yd";
    });
    // 飛距離モードをHUDに表示
    const modeTag=distMode==="super"?"⚡超人":"🏌️通常";
    const hudModeEl=document.getElementById("hudDistMode");
    if(hudModeEl)hudModeEl.textContent=modeTag;
    // roundHoles = 3, 9, または 18（コースのホール数をスライス）
    const maxH=Math.min(roundHoles||18, course.holes.length);
    const slicedCourse={...course, holes:course.holes.slice(0,maxH)};
    this.currentCourse=slicedCourse;
    this.character=new Character(charData);this.weather=new Weather(weatherType);
    this.ball=new Ball();this.scores=slicedCourse.holes.map(()=>0);
    this.currentHoleIdx=0;this.strokes=0;
    // プレイヤー名表示（本名も表示）
    const hudPl=document.getElementById("hudPlayer");
    if(hudPl){
      hudPl.textContent=charData.name;
      hudPl.title=charData.realName||charData.name;
    }
    // 本名を小さく表示するサブラベルを動的追加
    const plPanel=hudPl&&hudPl.closest(".hud-panel");
    if(plPanel&&charData.realName){
      let realNameEl=plPanel.querySelector(".hud-realname");
      if(!realNameEl){
        realNameEl=document.createElement("div");
        realNameEl.className="hud-realname";
        realNameEl.style.cssText="font-size:0.55rem;color:#55aaff;font-weight:700;white-space:nowrap;overflow:hidden;max-width:100px;text-overflow:ellipsis;line-height:1.1;";
        plPanel.appendChild(realNameEl);
      }
      realNameEl.textContent=charData.realName;
    }
    document.getElementById("startScreen").style.display="none";document.getElementById("gameUI").style.display="block";
    this.loadHole(slicedCourse,0);
    // loadHole 内で ball.position と _resetAimToPin が呼ばれるので追加設定不要

    // WebGLコンテキスト消失対応（iOS Safariでバックグラウンド移行時に発生）
    if(!this._ctxListenerBound){
      this._ctxListenerBound = true;
      const canvasEl=document.getElementById("canvas");
      canvasEl.addEventListener("webglcontextlost",e=>{e.preventDefault();console.warn("WebGL context lost");try{ if(window.__GOAT_DIAG__ && window.__GOAT_DIAG__.ctx) window.__GOAT_DIAG__.ctx.lost = true; }catch(_){}},{passive:true});
      canvasEl.addEventListener("webglcontextrestored",()=>{console.warn("WebGL context restored");try{ if(window.__GOAT_DIAG__ && window.__GOAT_DIAG__.ctx) window.__GOAT_DIAG__.ctx.lost = false; }catch(_){}},{passive:true});
    }

    // shotUIの実際の高さをCSS変数に反映（全フローティングパネルの基準）
    const updateShotUIHeight=()=>{
      const sui=document.getElementById("shotUI");
      if(sui){
        const h=sui.getBoundingClientRect().height;
        if(h>0)document.documentElement.style.setProperty("--sui-h",Math.ceil(h+2)+"px");
      }
    };
    updateShotUIHeight();
    if(!this._suiObserverBound){
      this._suiObserverBound = true;
      const suiObserver=new ResizeObserver(updateShotUIHeight);
      const suiEl=document.getElementById("shotUI");
      if(suiEl)suiObserver.observe(suiEl);
    }

    if(this._loopRunning) return;
    this._loopRunning = true;

    let _ctxCheckFrame = 0; /* v4.10 A1: コンテキストロスト実体チェックの間引き用カウンタ（120フレームに1回） */
    const loop=()=>{
      requestAnimationFrame(loop);
      try{
        const dt=Math.min(this.clock.getDelta(),0.05);
        if(document.hidden){ return; } /* v4.14: 非表示iframeの描画・物理演算を止める（ワールド側と同型。ワールド表示中のゴルフ先読みフレームがCPU/GPUを消費し続けていた）。getDeltaは上で消費済みのため復帰時のdt跳ねはない */
        this.weather.update(dt);
        if(!this.ball.inFlight){
          const prev=this.aimAngle;this._processAimInput(dt);
          if(Math.abs(this.aimAngle-prev)>0.01){this._updateAimArrow();this._updateTrajDots();}
        }
        this.ball.update(dt,(x,z)=>this.getGY(x,z),(x,z)=>this.getSurf(x,z));
        if(this.fx) this.fx.update(dt);
        this._updateFlagPhysics(dt);
        this._traceUpdate(); // ★ 弾道トレース：毎フレーム座標を記録
        const bp = this.ball.position;
        const groundY = this.getGY(bp.x, bp.z);
        const height = Math.max(0, bp.y - groundY);
        // ★ ローリング中のリアル・カップイン捕捉（パット＆チップインでカップ上を通過した瞬間に吸い込まれる！）
        if(this.ball.inFlight && !this.isOBLocked && height <= 0.25 && this.pinPos){
          const dPin = this._distToPin();
          if(this.ball.phase === "putt_roll"){
            const pSpd = Math.hypot(this.ball.puttVel.x, this.ball.puttVel.z);
            if(dPin < 0.78 && pSpd < 7.0){
              this.ball.position.set(this.pinPos.x, this.getGY(this.pinPos.x, this.pinPos.z) + 0.02, this.pinPos.z);
              this.ball._stop((x,z)=>this.getGY(x,z),(x,z)=>this.getSurf(x,z));
            }
          } else if(this.ball.phase === "run" && this.getSurf(bp.x, bp.z) === "green"){
            if(dPin < 0.68){
              this.ball.position.set(this.pinPos.x, this.getGY(this.pinPos.x, this.pinPos.z) + 0.02, this.pinPos.z);
              this.ball._stop((x,z)=>this.getGY(x,z),(x,z)=>this.getSurf(x,z));
            }
          }
        }
        // ★ 空中飛行中（キャリー中、または地面から浮いている height > 0.25）は絶対にOB判定を行わない！
        // ボールが地面に着地・接触した時（run / bounce / putt_roll かつ height <= 0.25）のみ判定
        const isLanded = (this.ball.phase !== "carry") && (height <= 0.25);
        if(this.ball.inFlight && !this.isOBLocked && isLanded && this.checkOB(bp.x, bp.z)){
          this._triggerOB();
        }
        if(!this.ball.inFlight && this.strokes > 0){
          if(!this.isOBLocked && this.checkOB(bp.x, bp.z)){
            this._triggerOB();
          } else {
            this._checkHoleComplete();
          }
        }
        this.updateCamera();this._updateRain(dt);
        // ボール地面影（飛行高さに応じてサイズ・透明度変化）
        if(this.ballShadowMesh&&this.ball){
          const bp=this.ball.position;
          const groundY=this.getGY(bp.x,bp.z);
          const height=Math.max(0,bp.y-groundY);
          if(this.ball.inFlight&&height>0.1){
            const scale=Math.max(0.3,1-height/this.ball.peakHeight*0.7);
            this.ballShadowMesh.position.set(bp.x,groundY+0.05,bp.z);
            this.ballShadowMesh.scale.set(scale,1,scale);
            this.ballShadowMesh.material.opacity=Math.max(0.05,0.35*scale);
            this.ballShadowMesh.visible=true;
          }else{
            this.ballShadowMesh.visible=false;
          }
        }
        // ボールトレイル更新
        if(this.trailMeshes&&this.ball&&this.ball.inFlight&&this.ball.phase==="carry"){
          // 現在位置を記録
          this.trailPositions=this.trailPositions||[];
          this.trailPositions.unshift(this.ball.position.clone());
          if(this.trailPositions.length>this.trailMeshes.length)this.trailPositions.pop();
          // トレイルメッシュを位置に配置
          this.trailMeshes.forEach((tm,i)=>{
            if(i<this.trailPositions.length){
              tm.position.copy(this.trailPositions[i]);
              const fade=(1-i/this.trailMeshes.length)*0.45;
              tm.material.opacity=fade;
              tm.visible=fade>0.01;
            }else{tm.visible=false;}
          });
        }else if(this.trailMeshes&&(!this.ball||!this.ball.inFlight)){
          // 飛行終了でトレイルをフェードアウト
          this.trailMeshes.forEach(tm=>tm.visible=false);
          if(this.trailPositions)this.trailPositions.length=0;
        }
        if(this.flagMesh){
          const t=Date.now()*0.003;
          const windDir=this.weather?this.weather.windDirection*Math.PI/180:0;
          const windStr=this.weather?Math.min(this.weather.windStrength*0.04,0.6):0.2;
          this.flagMesh.rotation.y=windDir+Math.sin(t*1.8)*windStr;
          this.flagMesh.rotation.z=Math.sin(t*2.2)*windStr*0.3;
        }
        this._updateDistPanel();
        this._updateFlightBar();
        this._drawMiniMap();this._updateCompass();this._updateAimAngleDisplay();
        /* v4.10 A1: 毎フレームの実体チェックを廃止。リスナーが立てるフラグを参照し、120フレームに1回だけ
           実体チェック（安全網）でフラグを更新する。ロスト中は描画せず復旧したら再開、の意味は従来どおり。 */
        var _ctxLost = false;
        _ctxCheckFrame++;
        var _diagCtx = (window.__GOAT_DIAG__ && window.__GOAT_DIAG__.ctx) || null;
        if(_diagCtx && _diagCtx.lost){ _ctxLost = true; }
        if((_ctxCheckFrame % 120) === 0){
          try { var _gc = this.renderer.getContext(); var _lostNow = !!(_gc && typeof _gc.isContextLost === "function" && _gc.isContextLost()); if(_diagCtx){ _diagCtx.lost = _lostNow; _diagCtx.checks = (_diagCtx.checks || 0) + 1; _diagCtx.lastCheckAt = Date.now(); } _ctxLost = _lostNow; } catch(e) {}
        }
        if(!_ctxLost){
          this.renderer.render(this.scene,this.camera);
        }
        window.__goatDiagLoopOk("golfLoop");
      }catch(e){console.warn("Loop error:",e);window.__goatDiagLoopErr("golfLoop", e);}
    };
    loop();
  }
}

// ===== スタートUI =====
const game=new GolfGame();
/* キャラ肖像画エンブレム（象徴カラー・帽子シルエット・神話の後光を描くSVG生成） */
function renderCharPortraitSVG(c){
  c = c || {};
  var col = "#" + ((c.shirtColor !== undefined ? c.shirtColor : 0xc9a227) >>> 0).toString(16).padStart(6, "0");
  var id = c.name || "";
  var hat = (id === "DeCham") ? "flat" : (id === "Watu") ? "straw" : "cap";
  var hats = {
    cap: '<path d="M22 40 a18 12 0 0 1 36 0 l0 3 -36 0 z" fill="H"/><path d="M40 43 l16 3 -1.5 4 -14.5 -2 z" fill="H"/>',
    straw: '<ellipse cx="40" cy="42" rx="21" ry="4.6" fill="H"/><path d="M28 41 a12 9 0 0 1 24 0 z" fill="H"/>',
    flat: '<path d="M21 42 a19 8 0 0 1 38 -1 l1 3 -40 0 z" fill="H"/><path d="M52 43.4 l9 2.4 -1.4 3.6 -9 -1.8 z" fill="H"/>'
  };
  var hatSvg = (hats[hat] || hats.cap).split("H").join(col);
  return '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + id + '">' +
    '<circle cx="40" cy="40" r="37" fill="#0a0d1e" stroke="' + col + '" stroke-width="2"/>' +
    '<circle cx="40" cy="40" r="33.5" fill="none" stroke="' + col + '" stroke-opacity=".45" stroke-width="1"/>' +
    '<path d="M40 6 L40 14 M14 20 L20 26 M66 20 L60 26" stroke="#ffd875" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>' +
    '<circle cx="40" cy="55" r="12.5" fill="#eab98e"/>' +
    '<path d="M29 62 a12.5 12.5 0 0 0 22 0 l0 6 -22 0 z" fill="' + col + '" opacity=".9"/>' +
    hatSvg +
    '<circle cx="35" cy="54" r="1.6" fill="#14161f"/><circle cx="45" cy="54" r="1.6" fill="#14161f"/>' +
    '<path d="M36 61 q4 2.6 8 0" stroke="#8a5a3b" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
    '</svg>';
}
function buildStartUI(){
  const cg=document.getElementById("charGrid");
  CHARACTERS.forEach((c,i)=>{
    const card=document.createElement("div");card.className="char-card"+(i===0?" selected":"");card.dataset.idx=i;
    const spd=Math.round((c.driverSpeed/95)*100);
    const stab={"最高に安定":100,"安定":70,"不安定":38};
    const stars=v=>v>=90?"★★★":v>=65?"★★☆":"★☆☆";
    const natFlag=c.nationality==="JPN"?"🇯🇵":c.nationality==="USA"?"🇺🇸":c.nationality==="IRL"?"🇮🇪":"🌍";
    card.innerHTML=`
      <div class="char-avatar">${renderCharPortraitSVG(c)}</div>
      <div class="char-name">${c.name}</div>
      <div style="font-size:0.58rem;color:#88ccff;margin-bottom:3px">${natFlag} ${c.realName||c.name}</div>
      <div style="font-size:0.55rem;color:#8ab;margin-bottom:4px;line-height:1.3">${c.desc||""}</div>
      <div class="stat-row"><span class="stat-label">DR</span><div class="stat-bar"><div class="stat-fill" style="width:${spd}%"></div></div><span style="font-size:0.6rem">${c.driverSpeed}</span></div>
      <div class="stat-row"><span class="stat-label">鉄</span><span class="star-row">${stars(stab[c.ironStability]||50)}</span></div>
      <div class="stat-row"><span class="stat-label">PT</span><span class="star-row">${stars(stab[c.putterStability]||50)}</span></div>`;
    card.addEventListener("click",()=>{document.querySelectorAll(".char-card").forEach(x=>x.classList.remove("selected"));card.classList.add("selected");});cg.appendChild(card);
  });
  const courseG=document.getElementById("courseGrid");
  COURSES.forEach((c,i)=>{
    const btn=document.createElement("div");btn.className="course-btn"+(i===0?" selected":"");btn.dataset.idx=i;
    btn.innerHTML=`<div class="course-name"><span style="margin-right:4px">${c.flag}</span>${c.name}</div><div class="course-info">${c.desc}</div>`;
    btn.addEventListener("click",()=>{document.querySelectorAll(".course-btn").forEach(x=>x.classList.remove("selected"));btn.classList.add("selected");});courseG.appendChild(btn);
  });
  const wg=document.getElementById("weatherGrid");
  [{type:"sunny",icon:"☀️",name:"晴れ"},{type:"rain",icon:"🌧️",name:"雨"},{type:"strongWind",icon:"💨",name:"強風"},{type:"fog",icon:"🌫️",name:"霧"}].forEach((w,i)=>{
    const btn=document.createElement("div");btn.className="weather-btn"+(i===0?" selected":"");btn.dataset.type=w.type;
    btn.innerHTML=`<div class="weather-icon">${w.icon}</div><div class="weather-name">${w.name}</div>`;
    btn.addEventListener("click",()=>{document.querySelectorAll(".weather-btn").forEach(x=>x.classList.remove("selected"));btn.classList.add("selected");});wg.appendChild(btn);
  });
  const cs=document.getElementById("clubScroll");
  CLUBS.forEach((c,i)=>{
    const btn=document.createElement("div");
    btn.className="club-btn"+(i===0?" active":"");
    btn.dataset.idx=i;
    // クラブタイプ別の色アクセント
    const typeEmoji=c.type==="driver"?"🏌️":c.type==="wood"?"🌲":c.type==="iron"?"⛳":c.type==="approach"?"🎯":c.type==="putter"?"🏴":"⛳";
    const distColor=c.type==="driver"?"#ffaa44":c.type==="wood"?"#88ffaa":c.type==="iron"?"#66ddff":c.type==="approach"?"#ffdd66":"#aaffdd";
    btn.innerHTML=`
      <div class="club-btn-name">${typeEmoji} ${c.name}</div>
      <div class="club-btn-dist" style="color:${distColor}">${c.maxDist}<span style="font-size:0.55rem;opacity:0.8">yd</span></div>
    `;
    btn.addEventListener("click",()=>{
      game.currentClubIdx=i;game._highlightClub();
      if(game.ball&&!game.ball.inFlight)game._updateTrajDots();
    });
    cs.appendChild(btn);
  });
}
window.addEventListener("load",()=>{
  const isGoatDuel = new URLSearchParams(location.search).get("goat") === "1";
  if(isGoatDuel){
    const ld = document.getElementById("loading");
    if(ld) ld.style.display = "none";
  }
  var isWarm = new URLSearchParams(location.search).get("warmup") === "1";
  setTimeout(()=>{
    document.getElementById("loading").style.display="none";
    if(isWarm) return; /* v4.5: 先読み時はレンダラ/シーンを作らない（スクリプトのキャッシュだけを温める） */
    if(!isGoatDuel) document.getElementById("startScreen").style.display="flex";
    game.init();
    buildStartUI();
  }, isGoatDuel ? 30 : 500);

  // ===== D-Plane ボタン イベントハンドラ =====
  function updateDplanePreview(){
    if(!game||!game.dplane)return;
    const dp=game.dplane;
    const shape=game._getShotShape?game._getShotShape(dp.faceAngle,dp.swingPath,dp.attackAngle):"⬛ ストレート";
    const pr=document.getElementById("dpPreview");
    if(pr)pr.textContent=shape||"⬛ ストレート";
    const fv=document.getElementById("dpFaceVal");
    if(fv)fv.textContent=(dp.faceAngle>0?"+":"")+dp.faceAngle+"°";
    const pv=document.getElementById("dpPathVal");
    if(pv)pv.textContent=(dp.swingPath>0?"+":"")+dp.swingPath+"°";
    const av=document.getElementById("dpAtkVal");
    if(av)av.textContent=(dp.attackAngle>0?"+":"")+dp.attackAngle+"°";
  }
  // D-Plane ボタンのキーと対応するアクティブボタンIDのマップ
  const dpKeyBtnMap={
    faceAngle:  ["dpFaceM3","dpFaceM1","dpFace0","dpFaceP1","dpFaceP3"],
    swingPath:  ["dpPathM3","dpPathM1","dpPath0","dpPathP1","dpPathP3"],
    attackAngle:["dpAtkM2","dpAtkM1","dpAtk0","dpAtkP1","dpAtkP2"],
  };
  document.querySelectorAll(".dp-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const key=btn.dataset.key;
      const val=parseFloat(btn.dataset.val);
      if(!key||isNaN(val))return;
      game.dplane[key]=val;
      // 同グループのボタンをリセットしてこのボタンをアクティブに
      dpKeyBtnMap[key].forEach(id=>{
        const el=document.getElementById(id);
        if(el)el.classList.remove("dp-active");
      });
      btn.classList.add("dp-active");
      updateDplanePreview();
    });
  });
  // 初期プレビュー表示
  setTimeout(updateDplanePreview,100);

  // 飛距離モード選択
  document.querySelectorAll(".dist-mode-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".dist-mode-btn").forEach(b=>b.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });

  // ラウンド数選択
  document.querySelectorAll(".round-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".round-btn").forEach(b=>b.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });

  document.getElementById("startBtn").addEventListener("click",()=>{
    const ci=parseInt((document.querySelector(".char-card.selected")||{dataset:{}}).dataset.idx||0);
    const coi=parseInt((document.querySelector(".course-btn.selected")||{dataset:{}}).dataset.idx||0);
    const wt=(document.querySelector(".weather-btn.selected")||{dataset:{}}).dataset.type||"sunny";
    const roundH=parseInt((document.querySelector(".round-btn.selected")||{dataset:{holes:"18"}}).dataset.holes||18);
    const distMode=(document.querySelector(".dist-mode-btn.selected")||{dataset:{mode:"normal"}}).dataset.mode||"normal";
    game.start(COURSES[coi],CHARACTERS[ci],wt,roundH,distMode);
  });

  // もう一度プレイボタン
  document.getElementById("playAgainBtn").addEventListener("click",()=>{
    // 全結果画面を非表示にしてスタート画面へ
    game._stopConfetti();
    ["tournamentScreen","prizeScreen","finScreen","gameUI"].forEach(id=>{
      const el=document.getElementById(id);if(el)el.style.display="none";
    });
    document.getElementById("startScreen").style.display="flex";
  });

  // 紙吹雪キャンバスをウィンドウサイズに合わせる
  window.addEventListener("resize",()=>{
    const cv=document.getElementById("confettiCanvas");
    if(cv){cv.width=window.innerWidth;cv.height=window.innerHeight;}
  });
});

;

/* 情報バー統合v3＋マップドック（スマホ・対戦中のみ） */
document.addEventListener('DOMContentLoaded', function () {
  if (!window.matchMedia('(max-width: 640px)').matches) return;
  if (new URLSearchParams(location.search).get('goat') !== '1') return;
  var bar = document.createElement('div'); bar.id = 'goatInfoBar';
  var flame = document.getElementById('goatBattleLeft');
  if (flame) bar.appendChild(flame);
  var row = document.createElement('div'); row.className = 'gib-row';
  ['distPanel', 'clubDistBar'].forEach(function (id) { var el = document.getElementById(id); if (el) row.appendChild(el); });
  bar.appendChild(row);
  document.body.appendChild(bar);
  var dock = document.createElement('div'); dock.id = 'mapDock';
  var strip = document.createElement('div'); strip.className = 'map-strip'; strip.textContent = 'マップ ◀';
  dock.appendChild(strip);
  var mm = document.getElementById('miniMap');
  if (mm) dock.appendChild(mm);
  document.body.appendChild(dock);
  strip.addEventListener('click', function () { document.body.classList.toggle('map-folded'); });
  var fb = document.createElement('button'); fb.id = 'foldCardBtn'; fb.textContent = 'カード ▾';
  fb.addEventListener('click', function () { var f = document.body.classList.toggle('card-folded'); fb.textContent = f ? 'カード ▴' : 'カード ▾'; });
  document.body.appendChild(fb);
});

;

/* LAYOUT FIX v4.0（①上段の余白へ項目を移す：要素の移動のみ。内容の更新は従来どおりID経由でそのまま効く） */
(function(){
  if(new URLSearchParams(location.search).get("goat") !== "1") return;
  function mergeHeader(){
    var hud = document.getElementById("topHUD");
    /* ① 赤い特徴バナーを最上段（プレイヤーの隣）へ移し、余白に組み込む（641px以上） */
    if(window.matchMedia("(min-width: 641px)").matches){
      var badge = document.getElementById("tacticalAlertBadge");
      if(hud && badge && hud.children[1] && badge.parentElement !== hud) hud.insertBefore(badge, hud.children[1]);
    }
    /* ① 広幅ではホール情報を対戦カードへ統合し、対戦状況も最上段へ移す（1101px以上） */
    var wide = window.matchMedia("(min-width: 1101px)").matches;
    if(!wide) return;
    var card = document.getElementById("goatMatchCard");
    var hi = document.getElementById("holeInfo");
    if(card && hi && !card.getAttribute("data-merged")){
      var seg = document.createElement("div");
      seg.className = "gmc-hole";
      while(hi.firstChild) seg.appendChild(hi.firstChild);
      card.insertBefore(seg, card.firstChild);
      card.setAttribute("data-merged", "1");
    }
    if(wide && hud && card){
      var center = card.querySelector(".gmc-center");
      var panels = hud.querySelectorAll(".hud-panel");
      if(center && panels.length && center.parentElement !== hud) hud.insertBefore(center, panels[panels.length - 1]);
    }
  }
  /* ② スマホ幅では炎パネルの中身を「ラベル＋バー(%)」の組2つにまとめ直す（帯レイアウト用。PC幅では元の縦積みのまま） */
  function regroupFlamePanel(){
    if(!window.matchMedia("(max-width: 640px)").matches) return;
    var p = document.getElementById("goatBattleLeft");
    if(!p || p.getAttribute("data-regrouped")) return;
    var k = Array.prototype.slice.call(p.children);
    if(k.length < 5) return;
    function cell(row, cv){
      var d = document.createElement("div"); d.className = "gbl-cell";
      var bar = document.createElement("div"); bar.className = "gbl-bar";
      var spans = row.querySelectorAll("span");
      var pct = spans.length > 1 ? spans[spans.length - 1] : null;
      p.insertBefore(d, row);
      d.appendChild(row);
      bar.appendChild(cv);
      if(pct) bar.appendChild(pct);
      d.appendChild(bar);
    }
    cell(k[0], k[1]); cell(k[2], k[3]);
    p.setAttribute("data-regrouped", "1");
  }
  function applyLayoutFix(){ mergeHeader(); regroupFlamePanel(); }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyLayoutFix);
  else applyLayoutFix();
})();

;

/* =========================================================================
   PS5+ IBL環境反射 ＆ GLSL大気瑞光スカイシェーダー強化（全モード共通適用）
   ========================================================================= */
(function upgradeGolfPS5Visuals(){
  if(typeof GolfGame === "undefined" || typeof THREE === "undefined") return;

  /* 新コースバリアント（セントアンドリュース・ニューコース／黄泉宵闇／天岩戸決戦／天空の神域）を追加登録 */
  function findCourse(id){
    for(var i=0;i<COURSES.length;i++) if(COURSES[i].id === id) return COURSES[i];
    return COURSES[0];
  }
  if(!COURSES.some(function(c){ return c.id === "standrews_new"; })){
    var stOld = findCourse("standrews");
    COURSES.push(Object.assign({}, stOld, {
      id: "standrews_new",
      name: "セントアンドリュース・ニューコース",
      desc: "欧州リンクス前哨戦（1895年開場・バックナイン選抜）",
      skyVariant: "links_morning",
      holes: stOld.holes.length >= 18 ? stOld.holes.slice(9, 18) : stOld.holes.slice()
    }));
  }
  if(!COURSES.some(function(c){ return c.id === "toda_dark"; })){
    var td = findCourse("toda");
    COURSES.push(Object.assign({}, td, {
      id: "toda_dark",
      name: "戸田パブリック（黄泉宵闇）",
      skyVariant: "yomi_dusk"
    }));
  }
  if(!COURSES.some(function(c){ return c.id === "sasayama_dark"; })){
    var ss = findCourse("sasayama");
    COURSES.push(Object.assign({}, ss, {
      id: "sasayama_dark",
      name: "宍戸ヒルズ（天岩戸・最終決戦）",
      skyVariant: "amaterasu_eclipse"
    }));
  }
  if(!COURSES.some(function(c){ return c.id === "augusta_divine"; })){
    var ag = findCourse("augusta");
    COURSES.push(Object.assign({}, ag, {
      id: "augusta_divine",
      name: "オーガスタ（天空の神域・黄金仕様）",
      skyVariant: "olympus_divine"
    }));
  }

  /* PMREMGenerator によるリアルタイムIBL環境マップ＆GLSL大気グラデーション空へのアップグレード */
  var origBuildSky = GolfGame.prototype._buildSky;
  GolfGame.prototype._buildSky = function(courseArg){
    origBuildSky.call(this, courseArg);
    try {
      var c = courseArg || this.currentCourse || {};
      var sv = c.skyVariant || "";
      var topCol = [0.09, 0.28, 0.64], horCol = [0.58, 0.78, 0.94], sunCol = [1.0, 0.94, 0.78];
      if(sv === "yomi_dusk"){
        topCol = [0.06, 0.04, 0.16]; horCol = [0.36, 0.16, 0.42]; sunCol = [0.95, 0.55, 0.85];
      } else if(sv === "amaterasu_eclipse"){
        topCol = [0.05, 0.03, 0.12]; horCol = [0.46, 0.18, 0.24]; sunCol = [1.0, 0.78, 0.35];
      } else if(sv === "olympus_divine"){
        topCol = [0.14, 0.42, 0.88]; horCol = [0.98, 0.90, 0.68]; sunCol = [1.0, 0.97, 0.82];
      } else if(this.weather && this.weather.type === "rain"){
        topCol = [0.10, 0.13, 0.20]; horCol = [0.24, 0.28, 0.35]; sunCol = [0.5, 0.55, 0.65];
      }

      /* GLSL大気瑞光ドームを重ねてPS5級の滑らかな空と太陽コロナを描画 */
      var dome = new THREE.Mesh(
        new THREE.SphereGeometry(880, 36, 24),
        window.__GOAT_SHADER__('golfSky', {
          side: THREE.BackSide,
          depthWrite: false,
          uniforms: {
            uTop: { value: new THREE.Vector3().fromArray(topCol) },
            uHor: { value: new THREE.Vector3().fromArray(horCol) },
            uSun: { value: new THREE.Vector3().fromArray(sunCol) },
            uSunDir: { value: new THREE.Vector3(0.32, 0.48, -0.82).normalize() }
          },
          vertexShader: "varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }",
          fragmentShader: [
            "uniform vec3 uTop, uHor, uSun, uSunDir; varying vec3 vW;",
            "void main(){",
            "  vec3 d = normalize(vW);",
            "  float h = clamp(d.y * 1.15 + 0.08, 0.0, 1.0);",
            "  vec3 col = mix(uHor, uTop, pow(h, 0.6));",
            "  float s = max(dot(d, uSunDir), 0.0);",
            "  col += uSun * pow(s, 18.0) * 0.55 + uSun * smoothstep(0.996, 0.9996, s) * 1.4;",
            "  gl_FragColor = vec4(col, 1.0);",
            "}"
          ].join("\n")
        })
      );
      this.scene.add(dome);

      /* PMREMGenerator によるIBL金属・水面反射環境マップ（初回生成キャッシュ） */
      if(this.renderer && THREE.PMREMGenerator && !this._cachedEnvMap){
        var pmrem = new THREE.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();
        var es = new THREE.Scene();
        es.add(new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), new THREE.MeshBasicMaterial({ color:0x8ec5fc, side:THREE.BackSide })));
        var sb = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 10), new THREE.MeshBasicMaterial({ color:0xfff3cc }));
        sb.position.set(12, 18, -16); es.add(sb);
        this._cachedEnvMap = pmrem.fromScene(es, 0.04).texture;
        pmrem.dispose();
      }
      if(this._cachedEnvMap) this.scene.environment = this._cachedEnvMap;
    } catch(e){ window.__goatDiagFail("sky", "_buildSky", e); }
  };
})();

;

/* =========================================================================
   GOAT BATTLE ENGINE v3.0 — RPGパワー物理・全11枠ギア・8特殊ショット・リアルタイム敵ゴースト・ニアピン決着
   ========================================================================= */
(function initGoatBattleEngineV3(){
  var q = new URLSearchParams(location.search);
  if(q.get("goat") !== "1") return;

  var SPECIAL_SHOTS = [
    { id:"burning",  name:"🔥 バーニングショット", cost:24, desc:"飛距離+16% ＆ 敵ゴーストのパワーを12削る炎撃（鍛冶神手袋で1.3倍）" },
    { id:"rising",   name:"🌪 ライジングドライブ", cost:20, desc:"高弾道強襲！キャリー+10% ＆ 風による横流され75%軽減" },
    { id:"hawkeye",  name:"🦅 ホークアイ・シーカー", cost:22, desc:"精密狙撃！横ブレ80%カット ＆ グリーン着弾後ピタリと止まる" },
    { id:"stinger",  name:"⚡ サンダースティンガー", cost:18, desc:"超低弾道ライン出し！向かい風無効 ＆ ラン飛距離+35%増大" },
    { id:"mirage",   name:"🌀 ミラージュバックスピン", cost:20, desc:"着弾即停止スピン ＆ 幻惑波動で敵の次打ミス率を上昇させる" },
    { id:"sandexp",  name:"🏖 サンドエクスプロージョン", cost:16, desc:"バンカー・深ラフの飛距離＆方向ペナルティをこの一打のみ100%無効化！" },
    { id:"zone",     name:"🧘 明鏡止水（炎回復）", cost:25, desc:"深い呼吸で己を整え、炎パワーを即座に+24%回復して安定ショットを放つ" },
    { id:"amaterasu",name:"🌟 天岩戸・神威一閃", cost:38, desc:"奥義！飛距離+22%・確定会心の一撃で敵パワーを18削り取る黄金弾！" },
    { id:"yasakani", name:"🔮 ヤサカニ絶対ショット", cost:0, yasakaniOnly:true, desc:"【三種の神器・1対戦1回】風・悪ライ・ブレを完全無視する神の直進弾(+15%)！" }
  ];

  var B = {
    ctx: null,
    mode: q.get("mode") || "normal",
    difficulty: "normal",
    distClass: "dracon",
    courseId: q.get("course") || "toda",
    holesCount: parseInt(q.get("holes") || "3", 10),
    isResume: q.get("resume") === "1",
    playerName: "Watu",
    oppName: "好敵手",
    oppTitle: "王者",
    oppPowTier: 3.5,
    isBoss: true,
    isPrime: false,
    playerPower: 100,
    playerMental: 100,
    balls: 18,
    oppPower: 100,
    gearStats: { specials:{} },
    buff: null,
    poseidonLeft: 0,
    yasakaniShotUsed: false,
    achillesBrokenThisHole: false,
    armedSpecial: null,
    holeMarks: [],       // '○' | '●' | '△'
    oppHoleStrokes: [],  // 各ホールの敵ゴースト最終打数
    ghost: { x:0, z:0, strokes:0, holed:false, disturb:false },
    inPlayoff: false,
    playoffPar3Hole: null,
    sentResult: false,
    yataLineMesh: null,
    started: false
  };

  function loadStoredCtx(){
    try {
      var raw = localStorage.getItem("goat_active_battle_v2");
      if(raw) return JSON.parse(raw);
    } catch(e){}
    return null;
  }

  window.addEventListener("message", function(ev){
    var d = ev.data;
    if(!d || typeof d !== "object") return;
    if(d.type === "goat:battleContext" && d.ctx && !B.started && !window.__GOAT_WARM){
      B.ctx = d.ctx;
      bootBattle();
      return;
    }
    if(d.type === "goat:golfKey"){
      var ov = document.getElementById("goatFinishOverlay");
      if(ov && ov.style.display === "flex"){
        if(d.down && (d.code === "Space" || d.code === "Enter")){
          var gbtn = document.getElementById("gfoBtn");
          if(gbtn) gbtn.click();
        }
        return;
      }
      if(typeof game !== "undefined" && game){
        if(d.code === "ArrowLeft" && game._setAimKey) game._setAimKey(-1, !!d.down);
        else if(d.code === "ArrowRight" && game._setAimKey) game._setAimKey(1, !!d.down);
        else if(d.down && (d.code === "Space" || d.code === "Enter") && game._triggerShootInput) game._triggerShootInput();
        else if(d.down && d.code === "KeyC" && game.toggleCamera) game.toggleCamera();
      }
    }
  });

  function calcPowerRate(pow){
    return 70 + Math.max(0, Math.min(100, pow)) * 0.5; // 120% 〜 70%
  }

  function showCaption(msg){
    var el = document.getElementById("goatGhostCaption");
    if(!el) return;
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(el._tm);
    el._tm = setTimeout(function(){ el.style.display = "none"; }, 3400);
  }

  function effectiveCost(sp){
    if(sp.yasakaniOnly) return 0;
    var cut = (B.gearStats && B.gearStats.mentalCutPct) || 0;
    return Math.max(4, Math.round(sp.cost * (1 - cut / 100)));
  }

  function renderSpecialMenu(){
    var menu = document.getElementById("goatSpMenu");
    var btn = document.getElementById("goatSpBtn");
    if(!menu || !btn) return;
    if(B.armedSpecial){
      btn.textContent = "🔥 発動待機：" + B.armedSpecial.name + "（クリックで解除）";
      btn.classList.add("armed");
    } else {
      btn.textContent = "⚡ 特殊ショット選択（現在：通常ショット）";
      btn.classList.remove("armed");
    }

    var hasYasakani = B.mode === "goat" || (B.gearStats.specials && B.gearStats.specials.yasakani_eternal);
    menu.innerHTML = "";
    SPECIAL_SHOTS.forEach(function(sp){
      if(sp.yasakaniOnly && !hasYasakani) return;
      var cost = effectiveCost(sp);
      var disabled = sp.yasakaniOnly ? B.yasakaniShotUsed : (B.mode !== "goat" && B.playerMental < cost);
      var b = document.createElement("button");
      b.className = "sp-item" + (B.armedSpecial && B.armedSpecial.id === sp.id ? " sel" : "");
      b.disabled = disabled;
      b.innerHTML = sp.name + " <span style='float:right;color:#ffd875;'>" +
        (sp.yasakaniOnly ? (B.yasakaniShotUsed ? "使用済" : "残り1回") : ("糸-" + cost)) + "</span>" +
        "<small>" + sp.desc + "</small>";
      b.onclick = function(){
        if(B.armedSpecial && B.armedSpecial.id === sp.id) B.armedSpecial = null;
        else B.armedSpecial = sp;
        menu.classList.remove("open");
        renderSpecialMenu();
      };
      menu.appendChild(b);
    });
  }

  document.getElementById("goatSpBtn").onclick = function(){
    var menu = document.getElementById("goatSpMenu");
    if(B.armedSpecial){
      B.armedSpecial = null;
      renderSpecialMenu();
      return;
    }
    renderSpecialMenu();
    menu.classList.toggle("open");
  };

  /* 額縁HUD（トップ中継カード＋炎＆糸Canvas）リアルタイム更新 */
  var fCv = document.getElementById("gFlameCv"), fCtx = fCv.getContext("2d");
  var tCv = document.getElementById("gThreadCv"), tCtx = tCv.getContext("2d");

  function updateBattleHUD(tNow){
    if(B.mode === "goat"){ B.playerPower = 100; B.playerMental = 100; B.balls = 999; }
    var pRate = calcPowerRate(B.playerPower);
    var infBall = B.mode === "goat" || (B.gearStats.specials && B.gearStats.specials.yasakani_eternal);

    document.getElementById("gmcPlayerName").textContent = B.playerName;
    document.getElementById("gmcPlayerSub").textContent =
      "飛距離率 " + Math.round(pRate) + "% ｜ 球 " + (infBall ? "∞" : B.balls) +
      (B.poseidonLeft > 0 ? " ｜ 🔱×" + B.poseidonLeft : "");

    document.getElementById("gmcOppName").textContent = (B.isPrime && String(B.oppName).indexOf("★") === -1 ? "★" : "") + B.oppName;
    document.getElementById("gmcOppTitle").textContent = B.oppTitle + " (敵炎 " + Math.round(B.oppPower) + "%)";
    document.getElementById("gmcOppPowFill").style.width = Math.max(4, B.oppPower) + "%";

    var hw = B.holeMarks.filter(function(m){ return m === "○"; }).length;
    var hl = B.holeMarks.filter(function(m){ return m === "●"; }).length;
    var stTxt = B.inPlayoff ? "⚔ NEAR-PIN PLAYOFF" :
                (B.holesCount === 1 ? "1H RIVAL MATCH" :
                (hw > hl ? (hw - hl) + " UP (あなた優勢)" : (hl > hw ? (hl - hw) + " DOWN (相手優勢)" : "ALL SQUARE")));
    document.getElementById("gmcStatus").textContent = stTxt;

    var curH = (typeof game !== "undefined" && game.currentCourse && game.currentCourse.holes[game.currentHoleIdx]);
    var hInfo = B.inPlayoff ? "Par3 ニアピン1打決戦（0.01yd計測）" :
      ("H" + ((game ? game.currentHoleIdx : 0) + 1) + "/" + B.holesCount +
       (curH ? "(Par" + curH.par + ")" : "") + " ｜ " +
       (B.holeMarks.length ? B.holeMarks.join(" ") : "開幕") +
       " ｜ 敵現在:" + B.ghost.strokes + "打" + (B.ghost.holed ? "(ホールアウト)" : ""));
    document.getElementById("gmcMarks").textContent = hInfo;

    document.getElementById("gPowNum").textContent = Math.round(B.playerPower) + "%";
    document.getElementById("gPowRateTxt").textContent = "(出力" + Math.round(pRate) + "%)";
    document.getElementById("gMenNum").textContent = Math.round(B.playerMental) + "%";

    /* 炎のパワーCanvas描画 */
    var t = (tNow || performance.now()) * 0.001;
    var W = fCv.width, H = fCv.height;
    fCtx.clearRect(0, 0, W, H);
    var fw = (B.playerPower / 100) * W;
    var turb = B.playerPower >= 75 ? 1.5 : (B.playerPower >= 40 ? 3.2 : 5.8);
    var grd = fCtx.createLinearGradient(0, 0, W, 0);
    if(B.playerPower >= 75){ grd.addColorStop(0,"#1e90ff"); grd.addColorStop(0.6,"#5ce1e6"); grd.addColorStop(1,"#ffe57f"); }
    else if(B.playerPower >= 40){ grd.addColorStop(0,"#ff6b35"); grd.addColorStop(0.6,"#ffb142"); grd.addColorStop(1,"#fff275"); }
    else { grd.addColorStop(0,"#8b0000"); grd.addColorStop(0.5,"#ff2e4c"); grd.addColorStop(1,"#ff9f43"); }
    fCtx.fillStyle = grd;
    fCtx.beginPath(); fCtx.moveTo(0, H);
    for(var x=0; x<=fw; x+=6){
      fCtx.lineTo(x, Math.max(1, 2.5 + Math.sin(x*0.15 - t*9)*turb*0.4 + Math.cos(x*0.28 + t*12)*turb*0.3));
    }
    fCtx.lineTo(fw, H); fCtx.closePath(); fCtx.fill();

    /* 運命の糸メンタルCanvas描画 */
    var TW = tCv.width, TH = tCv.height, mw = (B.playerMental / 100) * TW;
    tCtx.clearRect(0, 0, TW, TH);
    for(var s=0; s<2; s++){
      tCtx.beginPath();
      for(var tx=0; tx<=mw; tx+=8){
        var ty = TH*0.5 + Math.sin(tx*0.09 + t*5 + s*1.6) * 1.8;
        if(tx===0) tCtx.moveTo(tx,ty); else tCtx.lineTo(tx,ty);
      }
      tCtx.strokeStyle = s===0 ? "#e6d8ff" : "#5ce1e6";
      tCtx.lineWidth = s===0 ? 2.2 : 1.2;
      tCtx.stroke();
    }
  }

  setInterval(function(){ if(B.started && !document.hidden) updateBattleHUD(performance.now()); }, 75); /* v4.14: 非表示中はHUD更新を止める */

  /* 敵ゴースト初期化＆プレイヤーの1打ごとのリアルタイム進行シミュレーション */
  function resetGhostForHole(){
    var tee = (game && game.teePos) ? game.teePos : { x:0, z:0 };
    B.ghost = { x: tee.x, z: tee.z, strokes: 0, holed: false, disturb: false };
    B.achillesBrokenThisHole = false;
  }

  function stepEnemyGhostOneShot(){
    if(!game || !game.pinPos || B.ghost.holed || B.inPlayoff) return;
    var pin = game.pinPos;
    var dx = pin.x - B.ghost.x, dz = pin.z - B.ghost.z;
    var remDist = Math.hypot(dx, dz);
    B.ghost.strokes++;

    /* 敵の実効精度（powTierと残りoppPowerに連動：プレイヤーが会心で敵パワーを削るほど敵が崩れる！） */
    var oppRate = calcPowerRate(B.oppPower) / 120; // 1.00 〜 0.583
    var skill = Math.min(0.96, (0.52 + B.oppPowTier * 0.075) * oppRate) - (B.ghost.disturb ? 0.16 : 0);
    B.ghost.disturb = false;

    if(remDist <= 14){
      /* グリーン上のパット判定 */
      var makeProb = remDist <= 3.2 ? 0.94 : (0.32 + skill * 0.45);
      if(Math.random() < makeProb || B.ghost.strokes >= ((game.currentCourse.holes[game.currentHoleIdx].par || 4) + 2)){
        B.ghost.x = pin.x; B.ghost.z = pin.z; B.ghost.holed = true;
        var par = game.currentCourse.holes[game.currentHoleIdx].par;
        if(B.ghost.strokes < par){
          showCaption("⚡ " + B.oppName + " が見事なバーディパットを沈めた！（" + B.ghost.strokes + "打）");
        }
      } else {
        B.ghost.x = pin.x + (Math.random()-0.5)*1.4;
        B.ghost.z = pin.z + (Math.random()-0.5)*1.4;
      }
      return;
    }

    var maxStep = Math.min(remDist, (235 + B.oppPowTier * 14) * oppRate);
    var dirX = dx / remDist, dirZ = dz / remDist;
    var errScale = (1.12 - skill) * Math.min(34, remDist * 0.14);
    var sideErr = (Math.random() - 0.5) * 2 * errScale;
    var distAchieved = maxStep * (0.90 + skill * 0.10);

    B.ghost.x += dirX * distAchieved + (-dirZ) * sideErr;
    B.ghost.z += dirZ * distAchieved + (dirX) * sideErr;

    /* 重大トラブル発生時のみ下部字幕で静かに通知 */
    if(Math.abs(sideErr) > 16){
      B.oppPower = Math.max(15, B.oppPower - 7);
      showCaption("🏖 " + B.oppName + " のショットが乱れハザードへ！（敵パワー -7）");
    } else if(Math.hypot(pin.x - B.ghost.x, pin.z - B.ghost.z) < 4.2){
      showCaption("🎯 " + B.oppName + " がピンそば " + Math.hypot(pin.x - B.ghost.x, pin.z - B.ghost.z).toFixed(1) + "yd にベタピン！");
    }
  }

  function finishGhostIfRemaining(){
    var guard = 0;
    while(!B.ghost.holed && guard < 10){
      stepEnemyGhostOneShot();
      guard++;
    }
    return B.ghost.strokes;
  }

  /* 1打確定ごとの親フレーム同期（リセットやり直し防止・1打単位レジューム） */
  function syncShotProgress(){
    try {
      parent.postMessage({
        type: "goat:shotProgress",
        power: B.playerPower,
        mental: B.playerMental,
        balls: B.balls,
        progress: {
          holeIdx: game.currentHoleIdx,
          strokes: game.strokes,
          scores: game.scores.slice(),
          ballPos: { x:game.ball.position.x, y:game.ball.position.y, z:game.ball.position.z },
          holeMarks: B.holeMarks.slice(),
          oppHoleStrokes: B.oppHoleStrokes.slice(),
          oppPower: B.oppPower,
          ghost: Object.assign({}, B.ghost),
          poseidonLeft: B.poseidonLeft,
          yasakaniShotUsed: B.yasakaniShotUsed
        }
      }, "*");
    } catch(e){}
  }

  /* GolfGame本体へのRPG物理・全11枠ギア・神器・ミニマップ敵球・マッチプレー完全フック */
  function installEngineHooks(){
    var gs = B.gearStats || { specials:{} };

    /* 0. GOATパワー率×11枠神装飛距離倍率取得ヘルパー（オート番手選択・推定飛距離HUD・弾道ドット完全連動用） */
    game._getGoatDistMult = function(){
      var curGs = B.gearStats || gs || {};
      var rawR = calcPowerRate(B.playerPower);
      var dropM = 120 - rawR;
      var effR = 120 - dropM * (1 - Math.min(96, curGs.powDropCutPct || 0) / 100);
      var dm = (effR / 100);
      var gdp = curGs.distPct || 0;
      if(B.achillesBrokenThisHole && curGs.specials && curGs.specials.achilles_heel){
        gdp -= 11;
      }
      dm *= (1 + gdp * 0.01);
      if(curGs.specials && curGs.specials.zeus_storm && this.weather && (this.weather.type === "strongWind" || this.weather.type === "storm" || this.weather.type === "rain")){
        dm *= 1.06;
      }
      if(B.buff === "dist12") dm *= 1.12;
      if(B.buff === "godPower18") dm *= 1.18;
      if(B.buff === "humanPride") dm *= 1.10;
      return dm;
    };

    /* 1. ショット物理計算フック（パワー率 70+power*0.5 ＆ 全11枠ギア補正 ＆ 8特殊ショット） */
    var origCalcShot = game._calcShot.bind(game);
    game._calcShot = function(power, accuracy, nsBonus){
      var sp = B.armedSpecial;
      if(sp && sp.id === "zone"){
        B.playerPower = Math.min(100, B.playerPower + 24);
      }
      var res = origCalcShot(power, accuracy, nsBonus);
      var club = CLUBS[this.currentClubIdx] || { type:"driver" };
      var surf = this.getSurf(this.ball.position.x, this.ball.position.z);

      /* パワー率（120%〜70%）＋ ⑤シャフトによる飛距離落ちカット */
      var rawRate = calcPowerRate(B.playerPower); // 120 at 100%, 70 at 0%
      var dropFromMax = 120 - rawRate;            // 0 〜 50
      var effRate = 120 - dropFromMax * (1 - Math.min(96, gs.powDropCutPct || 0) / 100);
      var distMult = (effRate / 100);

      /* ①ドライバー・②アイアン・⑪シューズ飛距離加算（アキレスの靴バンカー破損判定込み） */
      var gearDistPct = gs.distPct || 0;
      if(B.achillesBrokenThisHole && gs.specials && gs.specials.achilles_heel){
        gearDistPct -= 11;
      }
      distMult *= (1 + gearDistPct * 0.01);

      /* ゼウスの雷霆：強風・嵐で飛距離+6% ／ 事前バフ適用 */
      if(gs.specials && gs.specials.zeus_storm && this.weather && (this.weather.type === "strongWind" || this.weather.type === "storm" || this.weather.type === "rain")){
        distMult *= 1.06;
      }
      if(B.buff === "dist12") distMult *= 1.12;
      if(B.buff === "godPower18") distMult *= 1.18;
      if(B.buff === "humanPride") distMult *= 1.10;

      /* ⑪シューズ悪ライ緩和 */
      if((surf === "rough" || surf === "bunker") && (gs.lieCutPct || 0) > 0 && !B.achillesBrokenThisHole){
        var basePenalty = surf === "bunker" ? 0.55 : 0.22;
        distMult *= (1 + basePenalty * (gs.lieCutPct / 100) * 0.55);
      }

      /* 横ブレ倍率（パワー低下で拡大 → ⑥グリップで抑制 → クラブ＆手袋＆ゼクシオオで軽減） */
      var rawSpread = 120 / Math.max(70, rawRate); // 1.00 〜 1.71
      var effSpread = 1 + (rawSpread - 1) * (1 - Math.min(96, gs.varDropCutPct || 0) / 100);
      var varCut = Math.min(82, (gs.varCutPct || 0) + ((gs.specials && gs.specials.xxio_lowpow && B.playerPower < 65) ? 20 : 0));
      var sideMult = effSpread * (1 - varCut / 100);
      if(B.achillesBrokenThisHole && gs.specials && gs.specials.achilles_heel) sideMult *= 1.25;
      if(this.weather && this.weather.type !== "sunny"){
        sideMult *= (1 - Math.min(95, gs.weatherCutPct || 0) * 0.004);
      }

      /* 特殊ショット効果適用 */
      if(sp){
        if(sp.id === "burning"){ distMult *= 1.16; }
        else if(sp.id === "rising"){ distMult *= 1.10; sideMult *= 0.35; res.peakRatio = Math.min(0.45, res.peakRatio * 1.25); }
        else if(sp.id === "hawkeye"){ sideMult *= 0.20; res.runDist *= 0.25; }
        else if(sp.id === "stinger"){ res.peakRatio *= 0.48; res.runDist = res.carryDist * 0.35 + res.runDist * 1.35; sideMult *= 0.55; }
        else if(sp.id === "mirage"){ res.runDist = 0; B.ghost.disturb = true; }
        else if(sp.id === "sandexp" && (surf === "bunker" || surf === "rough")){
          distMult *= (surf === "bunker" ? 2.1 : 1.28); sideMult *= 0.25;
        }
        else if(sp.id === "amaterasu"){ distMult *= 1.22; sideMult *= 0.25; }
        else if(sp.id === "yasakani"){
          distMult *= 1.15;
          if(surf === "bunker") distMult *= 2.0;
          else if(surf === "rough") distMult *= 1.25;
          sideMult = 0;
        }
      }

      res.carryDist *= distMult;
      res.runDist *= distMult;
      res.sideYd *= sideMult;
      return res;
    };

    /* 2. ショット実行時のメンタル消費・会心の一撃（敵パワー削減）・神器弾道色演出 */
    var origExecShot = game._executeShot.bind(game);
    game._executeShot = function(power, accuracy, nsBonus){
      var sp = B.armedSpecial;
      if(sp){
        if(sp.yasakaniOnly) B.yasakaniShotUsed = true;
        else if(B.mode !== "goat") B.playerMental = Math.max(0, B.playerMental - effectiveCost(sp));
      }

      origExecShot(power, accuracy, nsBonus);

      /* クサナギ（黒金）・神装完成（雷光シアン）弾道カラー強化 */
      if(this._curTraceLine && (gs.setGodComplete || (gs.specials && gs.specials.kusanagi) || (sp && sp.id === "amaterasu"))){
        var colHex = gs.setGodComplete ? 0x5ce1e6 : 0xffcf48;
        this._curTraceLine.traverse(function(m){
          if(m.isMesh && m.material && m.material.opacity < 0.8) m.material.color.setHex(colHex);
        });
      }

      /* 会心の一撃判定（SNS/UNS または 会心率抽選 または 炎/天岩戸特殊ショット） */
      var critRoll = (nsBonus >= 0.30) ||
                     (sp && (sp.id === "burning" || sp.id === "amaterasu" || sp.id === "yasakani")) ||
                     (Math.random() * 100 < (8 + (gs.critRatePct || 0) + (B.buff === "critBoost" || B.buff === "soloFocus" ? 15 : 0)));
      if(critRoll){
        var baseSlash = (sp && sp.id === "amaterasu") ? 18 : ((sp && sp.id === "burning") ? 12 : (nsBonus >= 0.50 ? 15 : 9));
        var fireBoost = (sp && (sp.id === "burning" || sp.id === "amaterasu") && gs.specials && gs.specials.hephaestus_fire) ? 1.3 : 1.0;
        var slash = Math.round(baseSlash * (gs.critMult || 1.0) * fireBoost);
        B.oppPower = Math.max(10, B.oppPower - slash);
        if(this.fx){
          this.fx.triggerScreenFlash();
          this.fx.showBroadcastBanner("⚡ CRITICAL STRIKE!!", B.oppName + " のパワーを -" + slash + "% 削り取った！");
        }
        showCaption("⚡ 会心の一撃！ " + B.oppName + " の炎パワーを -" + slash + "% 削減！");
      }

      B.armedSpecial = null;
      renderSpecialMenu();
      stepEnemyGhostOneShot();
      updateBattleHUD(performance.now());
    };

    /* 3. パット実行（④パター＆🪞ヤタノミラーによるパワー低下影響カット＋真のパットライン描画） */
    var origExecPutt = game._executePutt.bind(game);
    game._executePutt = function(targetRollYd){
      var dropErr = 0;
      if(B.mode !== "goat" && B.playerPower < 85){
        var puttCut = Math.min(100, gs.puttCutPct || 0);
        var leak = (1 - puttCut / 100) * ((85 - B.playerPower) / 85);
        dropErr = (Math.random() - 0.5) * targetRollYd * 0.22 * leak;
      }
      origExecPutt(Math.max(0.2, targetRollYd + dropErr));
      stepEnemyGhostOneShot();
      updateBattleHUD(performance.now());
    };

    var origUpdatePuttLine = game._updatePuttLine.bind(game);
    game._updatePuttLine = function(visible){
      origUpdatePuttLine(visible);
      /* 🪞 ヤタノミラー装備時：グリーンの傾斜を逆算した『黄金の真実パットライン』をカップまで可視化！ */
      var hasYata = B.mode === "goat" || (gs.specials && gs.specials.yata_truth);
      if(!hasYata || !this.ball || !this.pinPos){
        if(B.yataLineMesh) B.yataLineMesh.visible = false;
        return;
      }
      if(!visible){
        if(B.yataLineMesh) B.yataLineMesh.visible = false;
        return;
      }
      var bp = this.ball.position, pp = this.pinPos;
      var slope = this._getGreenSlope();
      var midX = (bp.x + pp.x) * 0.5 - slope.x * 4.5;
      var midZ = (bp.z + pp.z) * 0.5 - slope.y * 4.5;
      var pts = [
        new THREE.Vector3(bp.x, this.getGY(bp.x, bp.z) + 0.14, bp.z),
        new THREE.Vector3(midX, this.getGY(midX, midZ) + 0.14, midZ),
        new THREE.Vector3(pp.x, this.getGY(pp.x, pp.z) + 0.14, pp.z)
      ];
      if(B.yataLineMesh){ try{ if(B.yataLineMesh.geometry) B.yataLineMesh.geometry.dispose(); if(B.yataLineMesh.material) B.yataLineMesh.material.dispose(); }catch(e){} this.scene.remove(B.yataLineMesh); } /* v4.15: エイム操作のたびに作り直すため、旧分を解放しないとフレームごとに蓄積する（v4.14の弾道フォールバックと同型）。 */
      var curve = new THREE.CatmullRomCurve3(pts);
      B.yataLineMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.045, 6, false),
        new THREE.MeshBasicMaterial({ color:0xffd875, transparent:true, opacity:0.88 })
      );
      this.scene.add(B.yataLineMesh);
    };

    /* 4. ボール停止時：ニアピンプレーオフ即時計測決着・悪ライ消耗・アキレス腱判定・1打同期 */
    var origOnStopped = game._onStopped.bind(game);
    game._onStopped = function(pos, surf){
      origOnStopped(pos, surf);

      /* ⚔ サドンデス・ニアピン1打プレーオフの即時計測＆決着！ */
      if(B.inPlayoff && !B.sentResult){
        var playerDist = +this._distToPin().toFixed(2);
        var oppSkill = (0.55 + B.oppPowTier * 0.07) * (calcPowerRate(B.oppPower) / 120);
        var oppDist = +(Math.max(0.85, (14.5 - oppSkill * 9.5) * (0.55 + Math.random() * 0.9))).toFixed(2);
        if(Math.abs(playerDist - oppDist) < 0.02) oppDist = +(oppDist + 0.14).toFixed(2); // 0.01yd単位で完全決着保証！
        var winPO = playerDist < oppDist;
        var detailPO = "オールスクエア → Par3ニアピン1打プレーオフ決着！（あなた " + playerDist.toFixed(2) + " yd 対 " + B.oppName + " " + oppDist.toFixed(2) + " yd）";
        presentFinalOverlay(winPO ? "win" : "lose", detailPO, true);
        return;
      }

      if(surf === "bunker" || surf === "rough"){
        if(surf === "bunker" && gs.specials && gs.specials.achilles_heel && !B.achillesBrokenThisHole){
          B.achillesBrokenThisHole = true;
          showCaption("⚠ アキレスの腱発動！バンカー進入によりこのホール靴の飛距離補助が消滅！");
        }
        if(B.mode !== "goat"){
          var loss = surf === "bunker" ? 9 : 4;
          if(gs.specials && gs.specials.athena_aegis) loss *= 0.75;
          if(B.buff === "halfLoss") loss *= 0.5;
          B.playerPower = Math.max(10, B.playerPower - loss);
        }
      }
      syncShotProgress();
      updateBattleHUD(performance.now());
    };

    /* 5. OB／池ハザード時の 🔱ポセイドンの三叉槍（2回まで無ペナ救済）＆ ボール消費・パワー減少 */
    var origTriggerOB = game._triggerOB.bind(game);
    game._triggerOB = function(){
      if(this.isOBLocked) return;
      if(B.poseidonLeft > 0){
        B.poseidonLeft--;
        this.ball.phase = "idle"; this.ball.inFlight = false;
        var rec = this.lastSafePos || this.teePos;
        this.ball.position.copy(rec);
        if(this.ball.mesh) this.ball.mesh.position.copy(rec);
        if(this.playerMesh) this.playerMesh.position.copy(rec);
        this.shotCtrl.reset(); this.puttCtrl.reset();
        this._showAimViz(); this._resetAimToPin(); this._detectMode();
        document.getElementById("flightBar").style.display = "none";
        if(this.fx) this.fx.showBroadcastBanner("🔱 POSEIDON'S GRACE!", "海神の水が球を押し戻した！ペナルティ完全無効（残り" + B.poseidonLeft + "回）");
        showCaption("🔱 ポセイドンの三叉槍『水の加護』発動！無罰で安全地点へ復帰！");
        if(B.inPlayoff){
          /* プレーオフで救済された場合はもう一度だけ1打を打てる */
          this.strokes = 0; this._updateHUDStrokes();
        }
        syncShotProgress();
        updateBattleHUD(performance.now());
        return;
      }

      if(B.inPlayoff && !B.sentResult){
        this.ball.phase = "idle"; this.ball.inFlight = false;
        presentFinalOverlay("lose", "Par3ニアピン1打プレーオフ：あなたの打球がハザード/OBとなり惜敗……", true);
        return;
      }

      if(B.mode !== "goat"){
        var inf = gs.specials && gs.specials.yasakani_eternal;
        if(!inf) B.balls = Math.max(0, B.balls - 1);
        var obLoss = 14;
        if(gs.specials && gs.specials.athena_aegis) obLoss *= 0.75;
        if(B.buff === "halfLoss") obLoss *= 0.5;
        B.playerPower = Math.max(10, B.playerPower - obLoss);
      }
      origTriggerOB();
      syncShotProgress();
      updateBattleHUD(performance.now());
    };

    /* 6. ミニマップへの『敵ゴースト球（金縁の黒球）』同時プロット */
    var origDrawMini = game._drawMiniMap.bind(game);
    game._drawMiniMap = function(){
      origDrawMini();
      if(B.inPlayoff) return;
      var cv = document.getElementById("miniMapCanvas");
      if(!cv || !B.ghost) return;
      var ctx = cv.getContext("2d");
      var W = cv.width, H = cv.height;
      var cx = W * 0.5, pinY = 14, teeY = H - 12;
      var sX = W / 190;
      var sZ = (H - 24) / Math.max(100, this.terrainH || 350);
      var gx = Math.max(5, Math.min(W - 5, cx + B.ghost.x * sX));
      var gy = Math.max(6, Math.min(teeY, teeY + B.ghost.z * sZ));

      ctx.save();
      ctx.fillStyle = "#12131c";
      ctx.strokeStyle = "#ffd875";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(gx, gy, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    /* 7. ホール完了＆次ホール進行フック（2勝先行コールドゲーム ＆ オールスクエア時Par3ニアピン突入！） */
    var origHoleComplete = game._holeComplete.bind(game);
    game._holeComplete = function(){
      var idx = this.currentHoleIdx;
      var oppStr = finishGhostIfRemaining();
      B.oppHoleStrokes[idx] = oppStr;
      var pStr = this.strokes;
      var mark = pStr < oppStr ? "○" : (pStr > oppStr ? "●" : "△");
      B.holeMarks[idx] = mark;

      origHoleComplete();
      showCaption("ホール" + (idx + 1) + "終了：あなた " + pStr + "打 vs " + B.oppName + " " + oppStr + "打 → " +
                  (mark==="○"?"★あなたのホール勝利！":(mark==="●"?"相手のホール勝利":"△引き分け(Halved)")));
      syncShotProgress();
    };

    var origNextHole = game.nextHole.bind(game);
    game.nextHole = function(){
      if(B.sentResult || B.inPlayoff) return;
      var hw = B.holeMarks.filter(function(m){ return m === "○"; }).length;
      var hl = B.holeMarks.filter(function(m){ return m === "●"; }).length;
      var holesPlayed = B.holeMarks.length;
      var holesLeft = B.holesCount - holesPlayed;

      /* ★ 3ホールボス戦：2勝先行コールド決着判定（例：2ホール終了時点で 2勝0敗 または 0勝2敗） */
      if(B.holesCount >= 3 && Math.abs(hw - hl) > holesLeft && holesLeft > 0){
        var coldWin = hw > hl;
        var coldDetail = "3Hマッチプレー " + hw + "勝" + hl + "敗（2&1 コールド決着！ ホール経過: " + B.holeMarks.join(" ") + "）";
        presentFinalOverlay(coldWin ? "win" : "lose", coldDetail, false);
        return;
      }

      /* 全規定ホール消化後の決着またはサドンデス・ニアピンプレーオフ突入！ */
      if(holesPlayed >= B.holesCount){
        evaluateRegulationEnd();
        return;
      }

      origNextHole();
      resetGhostForHole();
      syncShotProgress();
    };

    /* 従来のトーナメント結果画面が直接呼ばれた場合もGOAT決着へ安全接続 */
    game._onRoundFinished = function(){
      evaluateRegulationEnd();
    };
  }

  function calcShotPoints(playerRel){
    var st = (game && game._stats) || {};
    var sp = (st.fir || 0) + (st.gir || 0) * 2 + (playerRel < 0 ? 2 : 0);
    if(st.longestDrive && st.longestDrive >= 290) sp += 1;
    if(B.gearStats && B.gearStats.specials && B.gearStats.specials.moirai_thread) sp += 1; // モイラの運命の糸ボーナス
    return sp;
  }

  function evaluateRegulationEnd(){
    if(B.sentResult) return;
    var holes = game.currentCourse.holes;
    var totalPar = holes.reduce(function(a,h){ return a + h.par; }, 0);
    var pTotal = game.scores.reduce(function(a,b){ return a + (b||0); }, 0);
    var oTotal = B.oppHoleStrokes.reduce(function(a,b){ return a + (b||4); }, 0);
    var pRel = pTotal - totalPar, oRel = oTotal - totalPar;

    /* ① 1ホール・ライバル戦：打数 → ショットポイント → 残り炎パワーで完全決着！ */
    if(B.holesCount <= 1){
      if(pTotal < oTotal){
        presentFinalOverlay("win", "1H対決：" + pTotal + "打 対 " + oTotal + "打 で快勝！", false);
      } else if(pTotal > oTotal){
        presentFinalOverlay("lose", "1H対決：" + pTotal + "打 対 " + oTotal + "打 で惜敗……", false);
      } else {
        var pSp = calcShotPoints(pRel);
        var oSp = Math.max(1, Math.round(B.oppPowTier * 0.7));
        if(pSp !== oSp){
          var wSp = pSp > oSp;
          presentFinalOverlay(wSp ? "win" : "lose", "同打数(" + pTotal + "打) → ショットポイント " + pSp + " 対 " + oSp + " で" + (wSp?"勝利！":"惜敗"), false);
        } else {
          var wPow = B.playerPower >= B.oppPower;
          presentFinalOverlay(wPow ? "win" : "lose", "同打数・同SP → 残り炎パワー " + Math.round(B.playerPower) + "% 対 " + Math.round(B.oppPower) + "% で" + (wPow?"執念の勝利！":"惜敗"), false);
        }
      }
      return;
    }

    /* ② 3ホール・レジェンドマッチプレー */
    var hw = B.holeMarks.filter(function(m){ return m === "○"; }).length;
    var hl = B.holeMarks.filter(function(m){ return m === "●"; }).length;
    var marksStr = B.holeMarks.join(" ");
    if(hw > hl){
      presentFinalOverlay("win", "3Hマッチプレー " + hw + "勝" + hl + "敗（" + marksStr + "）で王者に勝利！", false);
    } else if(hl > hw){
      presentFinalOverlay("lose", "3Hマッチプレー " + hw + "勝" + hl + "敗（" + marksStr + "）で惜敗……", false);
    } else {
      /* ★ オールスクエア（1勝1敗1分 または 3引き分け） → Par3 ニアピン1打サドンデスプレーオフ発動！ */
      startPar3NearPinPlayoff();
    }
  }

  function startPar3NearPinPlayoff(){
    B.inPlayoff = true;
    var p3 = B.playoffPar3Hole || game.currentCourse.holes[0];
    var poCourse = Object.assign({}, game.currentCourse, {
      name: game.currentCourse.name + "【PLAYOFF】",
      holes: [Object.assign({}, p3, { name:"SUDDEN DEATH NEAR-PIN" })]
    });
    game.currentCourse = poCourse;
    game.currentHoleIdx = 0;
    game.scores = [0];
    game.ball.phase = "idle"; game.ball.inFlight = false;
    var popup = document.getElementById("scorePopup");
    if(popup) popup.style.display = "none";
    var nhb = document.getElementById("nextHoleBtn");
    if(nhb) nhb.style.display = "none";
    var sBtn = document.getElementById("shootBtn");
    if(sBtn) sBtn.textContent = "🏌️ SHOT";

    game.loadHole(poCourse, 0);
    if(game.fx){
      game.fx.showBroadcastBanner("⚔ SUDDEN DEATH PLAYOFF!", "オールスクエア！Par3 ニアピン1打勝負（0.01yd計測）！");
    }
    showCaption("⚔ オールスクエア！ このティーショット1打でピンに最も近づけた者が勝者となる！");
  }

  function presentFinalOverlay(outcome, detail, wasPlayoff){
    if(B.sentResult) return;
    B.sentResult = true;
    var ov = document.getElementById("goatFinishOverlay");
    document.getElementById("gfoTag").textContent = wasPlayoff ? "SUDDEN DEATH PLAYOFF DECIDED" : "GOAT MATCH PLAY RESULT";
    document.getElementById("gfoTitle").textContent = outcome === "win" ? ("🏆 VICTORY! ― " + B.oppName + " 撃破！") : ("🌑 DEFEAT ― " + B.oppName + " に惜敗");
    document.getElementById("gfoTitle").style.color = outcome === "win" ? "#ffe680" : "#ff8598";
    document.getElementById("gfoBody").innerHTML =
      "<b>" + detail + "</b><br><br>" +
      "残り炎パワー：<b>" + Math.round(B.playerPower) + "%</b> ｜ 残りメンタル：<b>" + Math.round(B.playerMental) + "%</b> ｜ 相手残りパワー：<b>" + Math.round(B.oppPower) + "%</b>";
    ov.style.display = "flex";

    /* v4.1: 自己記録用に集計フィールドを追加（既存フィールドは不変更・追加のみ） */
    var tPar = 0, tStr = 0;
    try {
      var hs = game.currentCourse.holes;
      for(var hi = 0; hi < hs.length; hi++){ tPar += (hs[hi].par || 0); tStr += (game.scores[hi] || 0); }
    } catch(e){}
    var payload = {
      type: "goat:golfResult",
      outcome: outcome,
      detail: detail,
      isPlayoff: !!wasPlayoff,
      powerLeft: B.playerPower,
      mentalLeft: B.playerMental,
      ballsLeft: B.balls,
      oppName: B.oppName,
      holesCount: B.holesCount,
      totalStrokes: tStr,
      totalPar: tPar,
      relScore: tStr - tPar
    };

    document.getElementById("gfoBtn").onclick = function(){
      parent.postMessage(payload, "*");
    };
    /* 自動テストパラメータ時は自動送信 */
    if(q.get("testresult") === "1"){
      setTimeout(function(){ parent.postMessage(payload, "*"); }, 400);
    }
  }

  /* 対戦起動メイン処理（game.init()によるThree.jsシーン初期化完了を確実に待ってから起動） */
  function bootBattle(){
    if(B.started) return;
    if(typeof game === "undefined" || !game || !game.scene){
      setTimeout(bootBattle, 60);
      return;
    }
    window.game = game;
    window.GOAT_BATTLE = B;
    B.started = true;

    var ctx = B.ctx || loadStoredCtx();
    if(ctx){
      B.mode = ctx.mode || B.mode;
      B.difficulty = ["super_easy","easy","normal","hard"].indexOf(ctx.difficulty) >= 0 ? ctx.difficulty : "normal";
      B.distClass = ["amateur","top_pro","tour_pro","dracon"].indexOf(ctx.distClass) >= 0 ? ctx.distClass : "dracon";
      B.playerName = ctx.playerName || B.playerName;
      B.playerPower = typeof ctx.power === "number" ? ctx.power : 100;
      B.playerMental = typeof ctx.mental === "number" ? ctx.mental : 100;
      B.balls = typeof ctx.balls === "number" ? ctx.balls : 18;
      B.gearStats = ctx.gearStats || { specials:{} };
      B.buff = ctx.buff || null;
      if(ctx.opponent){
        B.oppName = ctx.opponent.name || B.oppName;
        B.oppTitle = ctx.opponent.title || B.oppTitle;
        B.oppPowTier = ctx.opponent.powTier || 3.5;
        B.oppPower = typeof ctx.opponent.power === "number" ? ctx.opponent.power : 100;
        B.isBoss = !!ctx.opponent.isBoss;
        B.isPrime = !!ctx.opponent.isPrime;
      }
      B.courseId = ctx.course || B.courseId;
      B.holesCount = ctx.holes || B.holesCount;
    }

    if(B.mode === "goat" || (B.gearStats.specials && B.gearStats.specials.poseidon_water)){
      B.poseidonLeft = 2;
    }

    /* キャラクター選定＆表示名反映 */
    var activeCharId = (ctx && ctx.activeChar && ctx.activeChar.id) || q.get("player") || "Watu";
    var ci = CHARACTERS.findIndex(function(c){ return c.name === activeCharId; });
    if(ci < 0) ci = 0;
    var ch = Object.assign({}, CHARACTERS[ci], { name: B.playerName });
    var distMode = "normal";
    if(B.mode === "goat"){
      ch.driverSpeed = 99;
      ch.ironStability = "最高に安定";
      ch.approachStability = "最高に安定";
      ch.putterStability = "最高に安定";
      distMode = "super";
    }

    /* コース選定（ボス戦3Hは設計書どおり必ず Par3 → Par4 → Par5 の黄金構成に編成！） */
    var coi = COURSES.findIndex(function(c){ return c.id === B.courseId; });
    if(coi < 0) coi = 0;
    var full = COURSES[coi];
    var p3 = full.holes.find(function(h){ return h.par === 3; }) || full.holes[0];
    var p4 = full.holes.find(function(h){ return h.par === 4; }) || full.holes[1] || full.holes[0];
    var p5 = full.holes.find(function(h){ return h.par === 5; }) || full.holes[2] || full.holes[0];
    B.playoffPar3Hole = p3;

    var useHoles = (B.holesCount >= 3) ? [p3, p4, p5] : [p4];
    var courseArg = Object.assign({}, full, { holes: useHoles });
    var weatherType = (ctx && ctx.weather) ? ctx.weather : "sunny";
    if(weatherType === "storm") weatherType = "strongWind";

    document.body.classList.add("goat-duel");
    window.game = game;
    window.GOAT_BATTLE = B;
    document.getElementById("goatMatchCard").style.display = "flex";
    document.getElementById("goatBattleLeft").style.display = "block";

    installEngineHooks();
    game.start(courseArg, ch, weatherType, useHoles.length, distMode);
    if(game.renderer && game.camera && game.scene){
      var rw = window.innerWidth || 1280, rh = window.innerHeight || 720;
      game.renderer.setSize(rw, rh);
      game.camera.aspect = rw / Math.max(1, rh);
      game.camera.updateProjectionMatrix();
      game.updateCamera();
      game.renderer.render(game.scene, game.camera);
    }
    resetGhostForHole();

    /* 1打単位レジューム復帰（対戦途中でブラウザを閉じて再開した場合、そのホールと打数から完全再開！） */
    if(B.isResume && ctx && ctx.progress){
      var pr = ctx.progress;
      B.holeMarks = pr.holeMarks || [];
      B.oppHoleStrokes = pr.oppHoleStrokes || [];
      if(typeof pr.oppPower === "number") B.oppPower = pr.oppPower;
      if(typeof pr.poseidonLeft === "number") B.poseidonLeft = pr.poseidonLeft;
      B.yasakaniShotUsed = !!pr.yasakaniShotUsed;
      if(typeof pr.holeIdx === "number" && pr.holeIdx < useHoles.length){
        game.currentHoleIdx = pr.holeIdx;
        game.scores = pr.scores || game.scores;
        game.loadHole(courseArg, pr.holeIdx);
        if(pr.strokes > 0 && pr.ballPos){
          game.strokes = pr.strokes;
          game.ball.position.set(pr.ballPos.x, pr.ballPos.y, pr.ballPos.z);
          if(game.ball.mesh) game.ball.mesh.position.copy(game.ball.position);
          if(game.playerMesh) game.playerMesh.position.set(pr.ballPos.x, game.getGY(pr.ballPos.x, pr.ballPos.z), pr.ballPos.z);
          game._detectMode(); game._resetAimToPin(); game._updateHUDStrokes();
        }
        if(pr.ghost) B.ghost = pr.ghost;
      }
      showCaption("💾 中断された一打から真剣勝負を再開しました！");
    }

    renderSpecialMenu();
    updateBattleHUD(performance.now());

    if(q.get("testresult") === "1"){
      setTimeout(function(){
        B.holeMarks = B.holesCount >= 3 ? ["○","○"] : ["○"];
        game.scores = useHoles.map(function(h){ return h.par - 1; });
        B.oppHoleStrokes = useHoles.map(function(h){ return h.par; });
        presentFinalOverlay("win", "自動検証テスト快勝", false);
      }, 2200);
    }
  }

  function requestBoot(){
    /* v4.2 項目10: warmup モード（シェルの先読み）では対戦を開始しない。
       Three.js とスクリプトの読込・初期化だけを済ませ、本番起動は新規文書で行う。 */
    if(q.get("warmup") === "1"){
      window.__GOAT_WARM = true;
      return;
    }
    try { parent.postMessage({ type:"goat:golfHello", version:"4.2", goat:(B.mode === "goat") }, "*"); } catch(e){}
    setTimeout(function(){ if(!B.started) bootBattle(); }, 180);
  }

  if(document.readyState === "complete") setTimeout(requestBoot, 70);
  else window.addEventListener("load", function(){ setTimeout(requestBoot, 70); });
})();

;

/* =========================================================================
   v4.1 追加モジュール：プレイヤー紹介カメラ（項目13）／適応的解像度（項目15）／読込失敗時の代替表示（項目17）
   レイアウト寸法・セーブ・postMessage には触れない
   ========================================================================= */
(function(){
  "use strict";

  /* ---- 項目17: Three.js が読み込めなかった場合の代替表示 ---- */
  function showLoadFallback(){
    if(document.getElementById("v41LoadFallback")) return;
    var d = document.createElement("div");
    d.id = "v41LoadFallback";
    d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#0a0d1e;color:#ffe9a8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:'Noto Serif JP',serif;text-align:center;padding:24px;";
    d.innerHTML = "<div style='font-size:20px;font-weight:700;'>⛳ 3Dエンジンの読み込みに失敗しました</div>" +
      "<div style='font-size:13.5px;color:#aebadd;line-height:1.8;'>通信環境を確認してから、再読み込みしてください。<br>セーブデータはブラウザ内に安全に残っています。</div>";
    var b = document.createElement("button");
    b.textContent = "🔄 再読み込み";
    b.style.cssText = "background:#c9a227;color:#14161f;border:none;font-size:15px;font-weight:700;padding:10px 26px;border-radius:8px;cursor:pointer;";
    b.onclick = function(){ location.reload(); };
    d.appendChild(b);
    document.body.appendChild(d);
  }
  setTimeout(function(){
    if(typeof THREE === "undefined") showLoadFallback();
  }, 4000);

  /* ---- ゲーム本体の準備を待つ ---- */
  var tries = 0;
  var iv = setInterval(function(){
    tries++;
    var g = window.game;
    if(!g || !g.renderer || !g.scene){ if(tries > 200) clearInterval(iv); return; }
    clearInterval(iv);
    initWithGame(g);
  }, 150);

  function initWithGame(g){

    /* ---- 項目13: ホール開始時だけ、アドレスに入るプレイヤーの姿を小窓（ピクチャ・イン・ピクチャ）で映す ----
       通常カメラはボール後方からピンを見るため、プレイヤーが画角の外（下端のHUD裏）に隠れてしまう。
       そこでホール開始の約2.4秒だけ、同じ3Dシーンを「プレイヤーを横前方から見るカメラ」で右端の小窓に描画する。
       レイアウト寸法は変えず、操作を始めたら即座に消える。 */
    var pipUntil = 0, pipLabel = null;
    function cancelPip(){ pipUntil = 0; if(pipLabel){ pipLabel.remove(); pipLabel = null; } }
    ["pointerdown","touchstart"].forEach(function(ev){
      window.addEventListener(ev, function(){ if(Date.now() < pipUntil) cancelPip(); }, { passive:true });
    });
    function startPip(){
      if(window.GOAT_BATTLE && GOAT_BATTLE.inPlayoff) return;
      if(g.gameMode === "putt") return;
      pipUntil = Date.now() + 2400;
      if(!pipLabel){
        pipLabel = document.createElement("div");
        pipLabel.textContent = "🏌 PLAYER CAM";
        pipLabel.style.cssText = "position:fixed;z-index:60;background:rgba(8,10,22,.85);color:#ffd875;border:1px solid rgba(255,216,117,.6);border-radius:6px;font-size:11px;font-weight:700;letter-spacing:.08em;padding:3px 8px;pointer-events:none;font-family:'Cinzel',serif;";
        document.body.appendChild(pipLabel);
      }
    }
    if(typeof g.loadHole === "function" && !g.__v41CamHooked){
      g.__v41CamHooked = true;
      var origLoadHole = g.loadHole.bind(g);
      g.loadHole = function(){
        var r = origLoadHole.apply(null, arguments);
        setTimeout(startPip, 80);
        return r;
      };
    }
    setTimeout(startPip, 1000);

    var pipCam = null;
    function pipLoop(){
      requestAnimationFrame(pipLoop);
      if(Date.now() > pipUntil){
        if(pipLabel){ pipLabel.remove(); pipLabel = null; }
        return;
      }
      if(!g.playerMesh || !g.pinPos) return;
      var W = window.innerWidth, H = window.innerHeight;
      var S = W < 820 ? 148 : 272;
      var x = W - S - 12, yB = Math.round(H * 0.30);
      if(pipLabel){
        pipLabel.style.right = "12px";
        pipLabel.style.top = (H - yB - S - 30) + "px";
      }
      if(!pipCam) pipCam = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
      var pp = g.playerMesh.position;
      var toPin = new THREE.Vector3(g.pinPos.x - pp.x, 0, g.pinPos.z - pp.z).normalize();
      var side = new THREE.Vector3(-toPin.z, 0, toPin.x);
      var camPos = pp.clone().add(side.multiplyScalar(5.2)).add(toPin.clone().multiplyScalar(-1.6));
      camPos.y = pp.y + 2.1;
      pipCam.position.copy(camPos);
      pipCam.lookAt(pp.x, pp.y + 1.35, pp.z);
      var r = g.renderer;
      var prevAuto = r.autoClear;
      try {
        r.autoClear = false;
        r.setScissorTest(true);
        r.setViewport(x, yB, S, S);
        r.setScissor(x, yB, S, S);
        r.clearColor();
        r.clearDepth();
        r.render(g.scene, pipCam);
      } catch(e){}
      try {
        r.setScissorTest(false);
        r.setViewport(0, 0, W, H);
        r.autoClear = prevAuto;
      } catch(e){}
    }
    requestAnimationFrame(pipLoop);

    /* ---- 項目15: 実測フレームレートに応じた適応的解像度（重い端末でのみ自動で軽くし、滑らかさを取り戻す） ---- */
    var basePR = g.renderer.getPixelRatio ? g.renderer.getPixelRatio() : 1;
    var curPR = basePR;
    var frames = 0, lastT = performance.now(), lowStreak = 0, highStreak = 0;
    function loop(){
      requestAnimationFrame(loop);
      frames++;
      var now = performance.now();
      if(now - lastT >= 2000){
        var fps = frames * 1000 / (now - lastT);
        frames = 0; lastT = now;
        if(document.hidden) return;
        if(fps < 42 && curPR > 1.0){
          lowStreak++; highStreak = 0;
          if(lowStreak >= 2){
            curPR = Math.max(1.0, +(curPR - 0.25).toFixed(2));
            try { g.renderer.setPixelRatio(curPR); } catch(e){}
            lowStreak = 0;
          }
        } else if(fps > 57 && curPR < basePR){
          highStreak++; lowStreak = 0;
          if(highStreak >= 3){
            curPR = Math.min(basePR, +(curPR + 0.25).toFixed(2));
            try { g.renderer.setPixelRatio(curPR); } catch(e){}
            highStreak = 0;
          }
        } else { lowStreak = 0; highStreak = 0; }
        window.__v41Fps = Math.round(fps);
        window.__v41PR = curPR;
      }
    }
    requestAnimationFrame(loop);
  }
})();

;

/* v4.5: 文書破棄時に WebGL を明示解放し、遷移ピークの GPU メモリを下げる */
window.addEventListener("pagehide", function(){ try{ var g = window.game; if(g && g.renderer){ if(g.renderer.forceContextLoss) g.renderer.forceContextLoss(); try{ g.renderer.dispose(); }catch(e2){} } }catch(e){} });
