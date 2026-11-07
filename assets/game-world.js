
  /* ===== v4.3 HQアセット (読込失敗時は従来表示に自動フォールバック) ===== */
  window.HQW = { parts:null, pending:[], tex:{}, _ready:{}, _waiters:{} };
  (function(){
    var TL = new THREE.TextureLoader();
    function loadTex(name, srgb, rx, ry){
      var t = TL.load('assets/textures/' + name + '.png', function(){
        window.HQW._ready[name] = 1;
        var w = window.HQW._waiters[name] || []; window.HQW._waiters[name] = [];
        for(var i=0;i<w.length;i++){ try{ w[i](); }catch(e){} }
      });
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if(rx) t.repeat.set(rx, ry || rx);
      if(srgb) t.colorSpace = THREE.SRGBColorSpace;
      window.HQW.tex[name] = t;
      return t;
    }
    window.HQW.whenTex = function(name, cb){
      if(window.HQW._ready[name]){ cb(); }
      else { (window.HQW._waiters[name] = window.HQW._waiters[name] || []).push(cb); }
    };
    loadTex('skin_map', 1); loadTex('skin_nrm'); loadTex('skin_rgh'); loadTex('eye', 1);
    loadTex('head_map', 1); loadTex('head_nrm');
    ['watu','matuya','tiiger','junbo','mcilro','decham'].forEach(function(k){ loadTex('head_' + k, 1); loadTex('skin_' + k, 1); });
    loadTex('pants_map', 1); loadTex('pants_nrm'); loadTex('pants_rgh');
    loadTex('shirt_nrm'); loadTex('shirt_rgh');
    loadTex('grass_map', 1, 26, 26); loadTex('grass_nrm', 0, 26, 26); loadTex('grass_rgh', 0, 26, 26);
    loadTex('leaf_map', 1); loadTex('leaf_nrm');
    loadTex('stone_map', 1); loadTex('stone_nrm'); loadTex('stone_rgh');
    loadTex('bark_map', 1); loadTex('bark_nrm');
    window.HQW.loadParts = function(){
      if(window.HQW._started) return; window.HQW._started = 1;
      try{
        var loader = new THREE.GLTFLoader();
        if(window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
        loader.load('assets/models/hero_world.glb', function(gltf){
          var parts = {};
          gltf.scene.children.forEach(function(root){ if(root && root.name) parts[root.name] = root; });
          if(Object.keys(parts).length < 10) return;
          window.HQW.parts = parts;
          var pend = window.HQW.pending.splice(0);
          for(var i=0;i<pend.length;i++){ try{ window.HQW.applyGolfer(pend[i][0], pend[i][1]); }catch(e){} }
        }, undefined, function(){});
      }catch(e){}
    };
    window.HQW.enqueueGolfer = function(g, ctx){
      if(window.HQW.parts){ try{ window.HQW.applyGolfer(g, ctx); }catch(e){} }
      else { window.HQW.pending.push([g, ctx]); window.HQW.loadParts(); }
    };
    var INV = new THREE.MeshBasicMaterial(); INV.visible = false;
    window.HQW.applyGolfer = function(g, ctx){
      var P = window.HQW.parts; if(!P) return;
      var T = window.HQW.tex;
      var sm = ctx.shirtMat, pm = ctx.pantsMat, sk = ctx.skinMat;
      if(!sm.userData.hq){ sm.userData.hq = 1; if(T.shirt_nrm){ sm.normalMap = T.shirt_nrm; sm.roughnessMap = T.shirt_rgh; } sm.needsUpdate = true; }
      if(!pm.userData.hq){ pm.userData.hq = 1; if(T.pants_map){ pm.map = T.pants_map; pm.normalMap = T.pants_nrm; pm.roughnessMap = T.pants_rgh; } pm.needsUpdate = true; }
      if(!sk.userData.hq){ sk.userData.hq = 1; if(T.skin_nrm){ sk.normalMap = T.skin_nrm; sk.roughnessMap = T.skin_rgh; } sk.needsUpdate = true; }
      var headM = sk.clone();
      /* v4.4: パレット肌色から色調を導出し全員同一肌色を是正 (マップ平均 (197,153,121) で正規化) */
      var _bc = new THREE.Color(ctx.skinMat.color.getHex());
      var _tint = new THREE.Color(Math.min(1, _bc.r / 0.773), Math.min(1, _bc.g / 0.600), Math.min(1, _bc.b / 0.475));
      var _vk = ctx.charId ? String(ctx.charId).toLowerCase() : null;
      var _vH = (_vk && T['head_' + _vk]) ? T['head_' + _vk] : null; /* v4.4是正2: _readyゲート廃止(golf側と同件) */
      var _vS = (_vk && T['skin_' + _vk]) ? T['skin_' + _vk] : null;
      if(_vS && !sk.userData.vApplied){ sk.userData.vApplied = 1; sk.map = _vS; sk.color.set(0xffffff); sk.needsUpdate = true; }
      if(_vH){ headM.map = _vH; headM.normalMap = T.head_nrm; headM.color.set(0xffffff); }
      else if(T.head_map){ headM.map = T.head_map; headM.normalMap = T.head_nrm; headM.color.copy(_tint); } headM.roughness = 1.0; headM.envMapIntensity = 0.5; headM.needsUpdate = true;
      if(T.skin_map){ sk.color.copy(_tint); } sk.roughness = 1.0; sk.envMapIntensity = 0.5; sk.needsUpdate = true;
      var strawM = new THREE.MeshStandardMaterial({ color: 0xb08a34, roughness: 0.9, envMapIntensity: 0.35 });
      var hatM2 = (ctx.hatType === 'straw') ? strawM : new THREE.MeshStandardMaterial({ color: ctx.hatCol, roughness: 0.55 });
      var SLOT = { MAT_SKIN: sk, MAT_HEAD: headM, MAT_SHIRT: sm, MAT_PANTS: pm, MAT_HAT: hatM2, MAT_STRAW: strawM,
        MAT_SHOE: ctx.shoeMat, MAT_SHOE2: ctx.toeMat,
        MAT_DARK: new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.5, metalness: 0.2 }),
        MAT_METAL: new THREE.MeshStandardMaterial({ color: 0xd8e2f0, roughness: 0.15, metalness: 0.92 }),
        MAT_GOLD: new THREE.MeshStandardMaterial({ color: 0xffd466, roughness: 0.2, metalness: 0.9 }),
        MAT_WHITE: new THREE.MeshStandardMaterial({ color: 0xf6f6f6, roughness: 0.5 }),
        MAT_EYE: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, map: T.eye || null }) };
      var put = function(name, parent){
        var tpl = P[name]; if(!tpl || !parent) return null;
        var o = tpl.clone();
        o.traverse(function(n){ if(n.isMesh){ n.castShadow = true; n.userData.hqPart = true; var mn = n.material && n.material.name; if(mn && SLOT[mn]) n.material = SLOT[mn]; } });
        parent.add(o);
        return o;
      };
      var bodyMats = [ctx.shirtMat, ctx.pantsMat, ctx.skinMat, ctx.hatMat, ctx.shoeMat, ctx.toeMat];
      var hideBody = function(grp){
        if(!grp) return;
        for(var i=0;i<grp.children.length;i++){ var c = grp.children[i]; if(c.isMesh && c !== ctx.torso && !c.userData.hqPart && bodyMats.indexOf(c.material) >= 0) c.visible = false; }
      };
      var J = ctx.joints;
      for(var i=0;i<2;i++){
        put('thigh', ctx.legs[i]); put('shin', ctx.knees[i]); put('shoe', ctx.ankles[i]); put('toe', ctx.ankles[i]);
        hideBody(ctx.legs[i]); hideBody(ctx.knees[i]); hideBody(ctx.ankles[i]);
      }
      put('pelvis', J.hips); put('belt', J.hips); hideBody(J.hips);
      put('torso', ctx.torso); ctx.torso.material = INV; hideBody(J.torso);
      (put('head_' + (_vk || 'watu'), J.head) || put('head', J.head)); put('earL', J.head); put('earR', J.head); put('nose', J.head);
      if(ctx.hatType === 'cap'){ put('cap', J.head); put('cap_brim', J.head); put('cap_logo', J.head); }
      else if(ctx.hatType === 'visor'){ put('cap_brim', J.head); }
      else if(ctx.hatType === 'straw'){ put('straw', J.head); put('straw_top', J.head); }
      else { put('flat', J.head); }
      hideBody(J.head);
      put('upperarm', J.shoulderC); put('upperarm', J.shoulderF);
      put('forearm', J.elbowC); put('forearm', J.elbowF);
      put('hand', J.wristC); put('glove', J.wristC); put('hand', J.wristF);
      hideBody(J.shoulderC); hideBody(J.shoulderF); hideBody(J.elbowC); hideBody(J.elbowF); hideBody(J.wristC); hideBody(J.wristF);
      put('clubw_grip', ctx.clubGroup); put('clubw_shaft', ctx.clubGroup); put('clubw_head', ctx.clubGroup);
      for(var ci=0; ci<ctx.clubGroup.children.length; ci++){ var cc = ctx.clubGroup.children[ci]; if(cc.isMesh && !cc.userData.hqPart) cc.visible = false; }
    };
  })();
  
;

    "use strict";
    /* =========================================================================
       第1部：パラメータ・全6エリア環境プロファイル・残影30名ビジュアル定義
       ========================================================================= */
    var QP = new URLSearchParams(location.search);
    var AREA_IDX = Math.max(0, Math.min(5, parseInt(QP.get("area") || "0", 10) || 0));
    var CHAR_ID = QP.get("char") || "Watu";
    var PNAME = QP.get("name") || CHAR_ID;
    var IS_GOAT = (QP.get("mode") === "goat");

    var CHAR_PALETTE = {
      Watu: { shirt: 0xf2e7c9, pants: 0x3c3528, cap: 0xd6a11e, skin: 0xeab98e, accent: 0xffd875 },
      Matuya: { shirt: 0x1f4e82, pants: 0xeaeef7, cap: 0xffffff, skin: 0xe8b184, accent: 0x5ce1e6 },
      TIiger: { shirt: 0xc91a25, pants: 0x15161c, cap: 0x14151a, skin: 0x8d5b36, accent: 0xff4d5a },
      Junbo: { shirt: 0xe87417, pants: 0x22232b, cap: 0xf5f5f5, skin: 0xe5b386, accent: 0xffb84d },
      McIlro: { shirt: 0x2665c2, pants: 0xdde5f4, cap: 0x1b2c4d, skin: 0xf2c8a2, accent: 0x68b5ff },
      DeCham: { shirt: 0xebedf5, pants: 0x2a2f3d, cap: 0x282c38, skin: 0xe2aa7c, accent: 0xff8547 }
    };

    var AREA_THEMES = [
      {
        idx: 0, id: "kyoto", title: "KYOTO — 天孫降臨の古都",
        skyTop: [0.07, 0.09, 0.24], skyHor: [0.38, 0.28, 0.46], skyPureTop: [0.14, 0.34, 0.68], skyPureHor: [0.72, 0.58, 0.48],
        sunColor: 0xffd998, fogColor: 0x221c34, fogPure: 0x6d7ea8, grassA: "#1d4c2e", grassB: "#255e39",
        waterColor: 0x164c64, archType: "kyoto", petalColor: 0xffb7c5
      },
      {
        idx: 1, id: "paris", title: "PARIS — オリンポスの宮廷",
        skyTop: [0.10, 0.20, 0.46], skyHor: [0.58, 0.52, 0.66], skyPureTop: [0.18, 0.44, 0.82], skyPureHor: [0.86, 0.78, 0.66],
        sunColor: 0xfff1c8, fogColor: 0x363a58, fogPure: 0x8fa4c8, grassA: "#1f5d34", grassB: "#2a7343",
        waterColor: 0x1c6b8a, archType: "paris", petalColor: 0xffe999
      },
      {
        idx: 2, id: "rome", title: "ROME — 神代の闘技場",
        skyTop: [0.14, 0.18, 0.38], skyHor: [0.68, 0.44, 0.32], skyPureTop: [0.16, 0.40, 0.76], skyPureHor: [0.92, 0.66, 0.42],
        sunColor: 0xffcf86, fogColor: 0x3c2c2c, fogPure: 0x9e826c, grassA: "#2a5829", grassB: "#376b33",
        waterColor: 0x145d78, archType: "rome", petalColor: 0xffaa55
      },
      {
        idx: 3, id: "america", title: "AMERICA — プロメテウスの火の継承地",
        skyTop: [0.09, 0.26, 0.56], skyHor: [0.55, 0.68, 0.78], skyPureTop: [0.12, 0.46, 0.86], skyPureHor: [0.78, 0.88, 0.95],
        sunColor: 0xfff6dc, fogColor: 0x2f4358, fogPure: 0x8ab2d4, grassA: "#15632f", grassB: "#1d7a3c",
        waterColor: 0x145b8c, archType: "america", petalColor: 0xff7eb3
      },
      {
        idx: 4, id: "edo", title: "EDO CASTLE — 黄泉の門と天岩戸",
        skyTop: [0.05, 0.03, 0.12], skyHor: [0.26, 0.11, 0.32], skyPureTop: [0.22, 0.34, 0.62], skyPureHor: [0.88, 0.66, 0.34],
        sunColor: 0xffb86c, fogColor: 0x180e26, fogPure: 0x7c6858, grassA: "#183b28", grassB: "#214d35",
        waterColor: 0x16294a, archType: "edo", petalColor: 0xd99bff
      },
      {
        idx: 5, id: "olympus_sky", title: "SKY SANCTUARY — 天空の神域",
        skyTop: [0.16, 0.38, 0.82], skyHor: [0.96, 0.88, 0.68], skyPureTop: [0.18, 0.46, 0.92], skyPureHor: [0.99, 0.92, 0.74],
        sunColor: 0xfff9e2, fogColor: 0x9ab4dc, fogPure: 0xb8cef0, grassA: "#207542", grassB: "#2b8c52",
        waterColor: 0x3298c8, archType: "olympus", petalColor: 0xfff099
      }
    ];

    /* 残影30名の個別外観特徴テーブル（浄化後に本来の鮮やかな衣装へ蘇る） */
    var FALLBACK_MOBS_30 = [
      { id: "garcia", area: 0, cls: "小", name: "ガルシヤ", shirt: 0xd62828, pants: 0xf7b801, hat: "cap", acc: "none" },
      { id: "scott", area: 0, cls: "小", name: "スコト", shirt: 0x2b5876, pants: 0xeaeaea, hat: "visor", acc: "none" },
      { id: "nakajima", area: 0, cls: "中", name: "ナカジマ", shirt: 0x2c3e50, pants: 0xdcdde1, hat: "cap", acc: "glasses" },
      { id: "singh", area: 0, cls: "中", name: "シソ", shirt: 0x192a56, pants: 0x2f3640, hat: "visor", acc: "none" },
      { id: "snead_m", area: 0, cls: "大", name: "スニード", shirt: 0xf5f6fa, pants: 0x57606f, hat: "straw", acc: "none" },
      { id: "hogan_m", area: 0, cls: "大", name: "ホーガソ", shirt: 0xf1f2f6, pants: 0x747d8c, hat: "flat", acc: "none" },

      { id: "rose", area: 1, cls: "小", name: "ローズ", shirt: 0x1e3799, pants: 0xf5f6fa, hat: "cap", acc: "goldpin" },
      { id: "stenson", area: 1, cls: "小", name: "ステンソソ", shirt: 0x3c6382, pants: 0x1e272e, hat: "cap", acc: "sunglass" },
      { id: "harring", area: 1, cls: "中", name: "ハリントソ", shirt: 0x009432, pants: 0xdcdde1, hat: "cap", acc: "none" },
      { id: "stewart", area: 1, cls: "中", name: "スチワート", shirt: 0x6f1e51, pants: 0xd1ccc0, hat: "beret", acc: "knicker" },
      { id: "vardon_m", area: 1, cls: "大", name: "バードソ", shirt: 0x846d52, pants: 0x594a38, hat: "flat", acc: "knicker" },
      { id: "faldo_m", area: 1, cls: "大", name: "ファルソ", shirt: 0x2f3542, pants: 0xdfe4ea, hat: "none", acc: "argyle" },

      { id: "day", area: 2, cls: "小", name: "デェイ", shirt: 0x1e272e, pants: 0x2f3542, hat: "cap", acc: "none" },
      { id: "thomson_m", area: 2, cls: "中", name: "トムソソ", shirt: 0x3867d6, pants: 0xd1d8e0, hat: "none", acc: "none" },
      { id: "els", area: 2, cls: "中", name: "エルズ", shirt: 0x222f3e, pants: 0xc8d6e5, hat: "cap", acc: "tall" },
      { id: "rahm", area: 2, cls: "中", name: "ラム", shirt: 0xc23616, pants: 0x192a56, hat: "cap", acc: "tall" },
      { id: "seve_m", area: 2, cls: "大", name: "セベ", shirt: 0x130f40, pants: 0xdff9fb, hat: "visor", acc: "none" },
      { id: "sarazen_m", area: 2, cls: "大", name: "サラゼソ", shirt: 0x9c88ff, pants: 0x7f8fa6, hat: "flat", acc: "knicker" },

      { id: "couples", area: 3, cls: "小", name: "カプルス", shirt: 0xf7f1e3, pants: 0x84817a, hat: "visor", acc: "none" },
      { id: "spieth", area: 3, cls: "中", name: "スピーズ", shirt: 0x227093, pants: 0xf7f1e3, hat: "cap", acc: "none" },
      { id: "scheff", area: 3, cls: "中", name: "シェフラ", shirt: 0xffffff, pants: 0x2c2c54, hat: "cap", acc: "beard" },
      { id: "floyd", area: 3, cls: "中", name: "フロイソ", shirt: 0x40407a, pants: 0xd1ccc0, hat: "visor", acc: "none" },
      { id: "trevino_m", area: 3, cls: "大", name: "トレヴィーノ", shirt: 0xe15f41, pants: 0xf5cd79, hat: "visor", acc: "none" },
      { id: "jones_m", area: 3, cls: "大", name: "ジョンズ", shirt: 0xf5f6fa, pants: 0x718093, hat: "none", acc: "tie_knicker" },

      { id: "nelson_m", area: 4, cls: "中", name: "ネルソソ", shirt: 0xd2dae2, pants: 0x485460, hat: "flat", acc: "none" },
      { id: "norman", area: 4, cls: "中", name: "ノーマソ", shirt: 0xf5f6fa, pants: 0x1e272e, hat: "straw", acc: "shark" },
      { id: "hagen_m", area: 4, cls: "大", name: "ヘーゲソ", shirt: 0xf8efba, pants: 0x2c3a47, hat: "none", acc: "twotone" },
      { id: "watson_m", area: 4, cls: "大", name: "ワトソソ", shirt: 0x833471, pants: 0xd1ccc0, hat: "cap", acc: "beard" },
      { id: "lefty_m", area: 4, cls: "大", name: "ミケルソソ", shirt: 0x111318, pants: 0x181b22, hat: "visor", acc: "lefty" },
      { id: "koepka", area: 4, cls: "大", name: "コプカ", shirt: 0x2f3640, pants: 0x191c22, hat: "cap", acc: "tall" }
    ];

    var MOBS_VISUAL_MAP = {};
    FALLBACK_MOBS_30.forEach(function (m) { MOBS_VISUAL_MAP[m.id] = m; });

    /* 四神波動クラブ定義 */
    var FOUR_GOD_CLUBS = [
      {
        idx: 0, name: "🐉 青龍ドライバー", color: 0x48dbfb, kusanagiColor: 0xffcf48, range: 68, speed: 52, dmg: 46,
        desc: "青龍：超長距離・螺旋龍貫通ビーム（地面に光の溝を刻む）"
      },
      {
        idx: 1, name: "🔥 朱雀アイアン", color: 0xff5e57, range: 46, speed: 38, dmg: 36,
        desc: "朱雀：中距離・オーロラ軌跡から炎の光羽が扇状に分裂追尾"
      },
      {
        idx: 2, name: "⚡ 白虎ウェッジ", color: 0xf5f6fa, range: 32, speed: 26, dmg: 52,
        desc: "白虎：高弾道ロブ→天からの垂直光柱＆虎爪地割れ（バンカーで砂煙目くらまし！）"
      },
      {
        idx: 3, name: "🐢 玄武パター", color: 0x2ed573, range: 24, speed: 30, dmg: 28,
        desc: "玄武：無音で地形を這う六角亀甲波紋（他残影に気づかれず100%確定スタン！）"
      }
    ];

    /* 効果音シンセ（フィールド打撃・四神波動・ファー咆哮・浄化チャイム） */
    var AC = null;
    function ensureAC() {
      if (!AC) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (C) AC = new C();
      }
      if (AC && AC.state === "suspended") AC.resume().catch(function () { });
      return AC;
    }
    function tone(f1, f2, dur, type, vol) {
      var ac = ensureAC(); if (!ac) return;
      var now = ac.currentTime;
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(f1, now);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + dur);
      g.gain.setValueAtTime(Math.max(0.001, vol || 0.14), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(now); o.stop(now + dur + 0.03);
    }
    /* 空間環境音（風のそよぎ＋鳥の声）をWeb Audioで生成・ループ */
    var ambNodes = null;
    function startAmbient() {
      var ac = ensureAC(); if (!ac || ambNodes) return;
      try {
        var master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
        master.gain.setTargetAtTime(0.15, ac.currentTime, 1.5);
        var len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0), last = 0;
        for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
        var src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
        var bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 480; bp.Q.value = 0.6;
        var wg = ac.createGain(); wg.gain.value = 0.5;
        var lfo = ac.createOscillator(); lfo.frequency.value = 0.07; var lfoG = ac.createGain(); lfoG.gain.value = 180; lfo.connect(lfoG); lfoG.connect(bp.frequency);
        var lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.045; var lfo2G = ac.createGain(); lfo2G.gain.value = 0.22; lfo2.connect(lfo2G); lfo2G.connect(wg.gain);
        src.connect(bp); bp.connect(wg); wg.connect(master); src.start(); lfo.start(); lfo2.start();
        ambNodes = { master: master };
        (function birds() {
          setTimeout(function () {
            if (AC && AC.state === "running") { var f = 2100 + Math.random() * 900; tone(f, f * 1.35, 0.09, "sine", 0.028); setTimeout(function () { tone(f * 1.1, f * 0.9, 0.07, "sine", 0.02); }, 120); }
            birds();
          }, 3500 + Math.random() * 6500);
        })();
      } catch (e) {}
    }
    function playSfx(k) {
      startAmbient();
      if (k === "seiryu") { tone(240, 1320, 0.36, "sawtooth", 0.14); setTimeout(function () { tone(660, 1760, 0.28, "triangle", 0.11); }, 55); }
      else if (k === "suzaku") { tone(420, 1480, 0.28, "triangle", 0.13); setTimeout(function () { tone(880, 1960, 0.22, "sine", 0.10); }, 70); }
      else if (k === "byakko") { tone(320, 760, 0.22, "sine", 0.12); }
      else if (k === "byakko_land") { tone(160, 52, 0.38, "sawtooth", 0.20); tone(920, 440, 0.25, "triangle", 0.12); }
      else if (k === "genbu") { tone(280, 540, 0.24, "sine", 0.10); }
      else if (k === "hit") { tone(210, 85, 0.14, "square", 0.16); }
      else if (k === "purify") { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { setTimeout(function () { tone(f, f * 1.01, 0.38, "triangle", 0.13); }, i * 75); }); }
      else if (k === "fore") { tone(340, 620, 0.16, "sawtooth", 0.18); setTimeout(function () { tone(580, 290, 0.34, "sawtooth", 0.18); }, 110); }
      else if (k === "push") { tone(260, 90, 0.18, "triangle", 0.18); }
      else if (k === "pickup") { tone(880, 1320, 0.14, "sine", 0.12); }
      else if (k === "splash") { tone(380, 95, 0.32, "sine", 0.15); }
      else if (k === "hurt") { tone(135, 62, 0.25, "sawtooth", 0.20); }
    }

    /* =========================================================================
       第2部：PS5級 Three.js PBR/IBLレンダラー・GLSL空＆水面シェーダー・全6聖地3D建築
       ========================================================================= */
    var THEME = AREA_THEMES[AREA_IDX] || AREA_THEMES[0];
    document.getElementById("hudArea").textContent = THEME.title;
    document.getElementById("hudName").textContent = PNAME;

    var container = document.getElementById("gl");
    var renderer = window.__GOAT_RENDERER__;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 820 ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(THEME.fogColor, 0.0046);

    var camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.25, 480);

    /* プロシージャルIBL環境マップ（PMREMGeneratorによる金属・水面・大理石のリアル反射） */
    (function buildIBL() {
      try {
        var pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        var envScene = new THREE.Scene();
        var skyGeo = new THREE.SphereGeometry(40, 24, 16);
        var cTop = new THREE.Color(THEME.skyPureTop[0], THEME.skyPureTop[1], THEME.skyPureTop[2]);
        var cHor = new THREE.Color(THEME.skyPureHor[0], THEME.skyPureHor[1], THEME.skyPureHor[2]);
        var cols = [];
        var pos = skyGeo.attributes.position;
        for (var i = 0; i < pos.count; i++) {
          var t = Math.max(0, Math.min(1, (pos.getY(i) + 40) / 80));
          var c = cHor.clone().lerp(cTop, Math.pow(t, 0.7));
          cols.push(c.r, c.g, c.b);
        }
        skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
        envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
        var sunBall = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfff4cc }));
        sunBall.position.set(18, 22, -20);
        envScene.add(sunBall);
        var rt = pmrem.fromScene(envScene, 0.04);
        scene.environment = rt.texture;
        pmrem.dispose();
      } catch (e) { }
    })();

    /* プロシージャル高精細PBRテクスチャ生成（芝ストライプ・石垣・大理石・バンカー砂） */
    function makeProceduralTex(drawFn, repX, repY) {
      var cv = document.createElement("canvas");
      cv.width = 512; cv.height = 512;
      drawFn(cv.getContext("2d"), 512, 512);
      var tx = new THREE.CanvasTexture(cv);
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
      tx.repeat.set(repX || 1, repY || 1);
      tx.colorSpace = THREE.SRGBColorSpace;
      return tx;
    }

    var grassAlbedo = makeProceduralTex(function (ctx, w, h) {
      ctx.fillStyle = THEME.grassA; ctx.fillRect(0, 0, w, h);
      for (var bs = 0; bs < 300; bs++) {
        var bx2 = Math.random() * w, by2 = Math.random() * h, br2 = 12 + Math.random() * 52;
        ctx.globalAlpha = 0.10 + Math.random() * 0.13;
        ctx.fillStyle = Math.random() < 0.55 ? THEME.grassB : (Math.random() < 0.5 ? "#0c2c16" : "#7fae62");
        ctx.beginPath(); ctx.arc(bx2, by2, br2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (var i = 0; i < 6000; i++) {
        var x = Math.random() * w, y = Math.random() * h;
        ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.06)";
        ctx.fillRect(x, y, 2, 3);
      }
    }, 26, 26);

    var grassBump = makeProceduralTex(function (ctx, w, h) {
      ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 9000; i++) {
        var v = 90 + Math.floor(Math.random() * 80);
        ctx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, 32, 32);

    var marbleTex = makeProceduralTex(function (ctx, w, h) {
      ctx.fillStyle = "#ece9e2"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(155,145,130,0.28)";
      for (var i = 0; i < 22; i++) {
        ctx.lineWidth = 1 + Math.random() * 2.5;
        ctx.beginPath();
        var y = Math.random() * h;
        ctx.moveTo(0, y);
        for (var x = 0; x <= w; x += 32) {
          y += (Math.random() - 0.5) * 24;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }, 3, 3);

    var stoneTex = makeProceduralTex(function (ctx, w, h) {
      ctx.fillStyle = "#4c4e56"; ctx.fillRect(0, 0, w, h);
      var rows = 8;
      for (var r = 0; r < rows; r++) {
        var y = r * (h / rows), cols = 5;
        var off = (r % 2) * 45;
        for (var c = 0; c <= cols; c++) {
          var x = c * (w / cols) - off;
          var sh = 58 + Math.floor(Math.random() * 36);
          ctx.fillStyle = "rgb(" + sh + "," + sh + "," + (sh + 5) + ")";
          ctx.fillRect(x + 2, y + 2, (w / cols) - 4, (h / rows) - 4);
        }
      }
    }, 4, 2);

    var sandTex = makeProceduralTex(function (ctx, w, h) {
      ctx.fillStyle = "#ebd9b4"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 5000; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.12)" : "rgba(160,130,85,0.12)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 2);
      }
    }, 6, 6);

    /* GLSL大気スカイドーム（浄化率 uPure ＆ Lv3チャージ暗転雷鳴 uStorm 連動） */
    var skyUniforms = {
      uTopDark: { value: new THREE.Vector3().fromArray(THEME.skyTop) },
      uHorDark: { value: new THREE.Vector3().fromArray(THEME.skyHor) },
      uTopPure: { value: new THREE.Vector3().fromArray(THEME.skyPureTop) },
      uHorPure: { value: new THREE.Vector3().fromArray(THEME.skyPureHor) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.48, -0.75).normalize() },
      uPure: { value: (AREA_IDX === 5 || IS_GOAT) ? 1.0 : 0.15 },
      uStorm: { value: 0.0 },
      uFlash: { value: 0.0 }
    };
    var skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(360, 36, 24),
      window.__GOAT_SHADER__('worldSky', {
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: skyUniforms,
        vertexShader: [
          "varying vec3 vWorldPos;",
          "void main(){",
          "  vec4 wp = modelMatrix * vec4(position, 1.0);",
          "  vWorldPos = wp.xyz;",
          "  gl_Position = projectionMatrix * viewMatrix * wp;",
          "}"
        ].join("\n"),
        fragmentShader: [
          "uniform vec3 uTopDark, uHorDark, uTopPure, uHorPure, uSunDir;",
          "uniform float uPure, uStorm, uFlash;",
          "varying vec3 vWorldPos;",
          "void main(){",
          "  vec3 d = normalize(vWorldPos);",
          "  float h = clamp(d.y * 1.15 + 0.08, 0.0, 1.0);",
          "  vec3 topC = mix(uTopDark, uTopPure, uPure);",
          "  vec3 horC = mix(uHorDark, uHorPure, uPure);",
          "  vec3 col = mix(horC, topC, pow(h, 0.62));",
          "  float sunAmt = max(dot(d, uSunDir), 0.0);",
          "  col += vec3(1.0, 0.88, 0.62) * pow(sunAmt, 24.0) * (0.35 + 0.65 * uPure);",
          "  col += vec3(1.0, 0.96, 0.84) * smoothstep(0.996, 0.9995, sunAmt) * 1.6;",
          "  col *= (1.0 - uStorm * 0.58);",
          "  col += vec3(0.75, 0.84, 1.0) * uFlash;",
          "  gl_FragColor = vec4(col, 1.0);",
          "}"
        ].join("\n")
      })
    );
    scene.add(skyDome);

    /* 太陽光（PCFソフトシャドウ）＆ 半球環境光 */
    var hemiLight = new THREE.HemisphereLight(0xdce8ff, 0x263824, 0.72 * Math.PI);
    scene.add(hemiLight);

    var sunLight = new THREE.DirectionalLight(THEME.sunColor, 1.45 * Math.PI);
    sunLight.position.set(58, 74, -85);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = window.innerWidth < 820 ? 1024 : 2048;
    sunLight.shadow.mapSize.height = window.innerWidth < 820 ? 1024 : 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 260;
    var sBox = 95;
    sunLight.shadow.camera.left = -sBox;
    sunLight.shadow.camera.right = sBox;
    sunLight.shadow.camera.top = sBox;
    sunLight.shadow.camera.bottom = -sBox;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    /* 地形ハイトフィールド（中心施設広場・池窪地・外周のなだらかなアンジュレーション） */
    var WORLD_R = 96;
    var PONDS = [
      { x: 26, z: -18, r: 12.5 },
      { x: -32, z: 22, r: 10.5 }
    ];
    var BUNKERS = [
      { x: 14, z: -26, r: 6.2 },
      { x: -18, z: -14, r: 5.8 },
      { x: 24, z: 24, r: 6.5 }
    ];

    function terrainY(x, z) {
      var dCenter = Math.hypot(x, z);
      var flatCenter = Math.min(1, Math.max(0, (dCenter - 16) / 18));
      var y = (Math.sin(x * 0.045) * Math.cos(z * 0.045) * 2.1 + Math.sin((x + z) * 0.025) * 1.2) * flatCenter;
      for (var i = 0; i < PONDS.length; i++) {
        var pd = PONDS[i];
        var dp = Math.hypot(x - pd.x, z - pd.z);
        if (dp < pd.r + 3.5) {
          var t = Math.max(0, 1 - dp / (pd.r + 3.5));
          y -= t * t * 2.6;
        }
      }
      return y;
    }

    function isInPond(x, z) {
      for (var i = 0; i < PONDS.length; i++) {
        if (Math.hypot(x - PONDS[i].x, z - PONDS[i].z) < PONDS[i].r - 0.8) return true;
      }
      return false;
    }
    function nudgeOutOfPond(x, z, margin) {
      var m = margin || 1.6;
      var rx = x, rz = z;
      for (var i = 0; i < PONDS.length; i++) {
        var pd = PONDS[i];
        var dx = rx - pd.x, dz = rz - pd.z;
        var d = Math.hypot(dx, dz);
        if (d < pd.r + m) {
          if (d < 0.01) { dx = 0; dz = 1; d = 1; }
          rx = pd.x + (dx / d) * (pd.r + m);
          rz = pd.z + (dz / d) * (pd.r + m);
        }
      }
      var dc = Math.hypot(rx, rz);
      if (dc > WORLD_R - 3.5) {
        rx *= (WORLD_R - 3.5) / dc;
        rz *= (WORLD_R - 3.5) / dc;
      }
      return { x: rx, z: rz };
    }
    function isInBunker(x, z) {
      for (var i = 0; i < BUNKERS.length; i++) {
        if (Math.hypot(x - BUNKERS[i].x, z - BUNKERS[i].z) < BUNKERS[i].r) return true;
      }
      return false;
    }

    /* 3Dフェアウェイ＆ラフ起伏メッシュ構築 */
    var groundMesh = null;
    (function buildTerrain() {
      var geo = new THREE.PlaneGeometry(WORLD_R * 2.3, WORLD_R * 2.3, 128, 128);
      geo.rotateX(-Math.PI / 2);
      var pos = geo.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        pos.setY(i, terrainY(pos.getX(i), pos.getZ(i)));
      }
      geo.computeVertexNormals();
      var gCols = new Float32Array(pos.count * 3);
      for (var ci2 = 0; ci2 < pos.count; ci2++) {
        var vx2 = pos.getX(ci2), vz2 = pos.getZ(ci2);
        var nn2 = 0.90 + 0.10 * Math.sin(vx2 * 0.11 + vz2 * 0.07) * Math.cos(vz2 * 0.09 - vx2 * 0.05);
        var pp2 = (Math.sin(vx2 * 0.021 + 3.1) * Math.cos(vz2 * 0.019 - 1.2) > 0.55) ? 0.90 : 1.0;
        var vv2 = nn2 * pp2;
        gCols[ci2 * 3] = vv2 * 0.95; gCols[ci2 * 3 + 1] = vv2; gCols[ci2 * 3 + 2] = vv2 * 0.93;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(gCols, 3));
      var mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: grassAlbedo,
        bumpMap: grassBump,
        bumpScale: 0.08,
        roughness: 0.82,
        metalness: 0.04
      });
      if (window.HQW) HQW.whenTex('grass_map', function(){ mat.map = HQW.tex.grass_map; mat.normalMap = HQW.tex.grass_nrm; mat.roughnessMap = HQW.tex.grass_rgh; mat.bumpMap = null; mat.needsUpdate = true; });
      var ground = new THREE.Mesh(geo, mat);
      ground.receiveShadow = true;
      groundMesh = ground;
      scene.add(ground);

      /* 天空の神域（エリア5）は周囲に幻想的な雲海リングを配置 */
      if (AREA_IDX === 5) {
        var cloudMat = new THREE.MeshStandardMaterial({ color: 0xfff9ee, roughness: 0.95, transparent: true, opacity: 0.82 });
        for (var c = 0; c < 32; c++) {
          var ang = (c / 32) * Math.PI * 2;
          var rad = 98 + (c % 3) * 14;
          var puff = new THREE.Mesh(new THREE.SphereGeometry(16 + (c % 4) * 5, 16, 12), cloudMat);
          puff.scale.y = 0.38;
          puff.position.set(Math.cos(ang) * rad, -4, Math.sin(ang) * rad);
          scene.add(puff);
        }
      }
    })();

    /* GLSLフレネル波紋シェーダーによる池・堀水面 + バンカー砂面 */
    var waterUniforms = {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(THEME.waterColor) }
    };
    var waterMat = window.__GOAT_SHADER__('worldWater', {
      transparent: true,
      uniforms: waterUniforms,
      vertexShader: [
        "uniform float uTime;",
        "varying vec2 vUv;",
        "varying vec3 vWorld;",
        "void main(){",
        "  vUv = uv;",
        "  vec3 p = position;",
        "  p.z += sin(p.x * 0.9 + uTime * 2.2) * 0.04 + cos(p.y * 1.1 - uTime * 1.8) * 0.04;",
        "  vec4 wp = modelMatrix * vec4(p, 1.0);",
        "  vWorld = wp.xyz;",
        "  gl_Position = projectionMatrix * viewMatrix * wp;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime;",
        "uniform vec3 uBaseColor;",
        "varying vec2 vUv;",
        "varying vec3 vWorld;",
        "void main(){",
        "  float w1 = sin(vWorld.x * 1.6 + uTime * 2.4) * cos(vWorld.z * 1.5 - uTime * 1.9);",
        "  float spec = smoothstep(0.68, 0.98, w1);",
        "  vec3 viewD = normalize(cameraPosition - vWorld);",
        "  float fres = pow(1.0 - max(dot(viewD, vec3(0.0,1.0,0.0)), 0.0), 2.6);",
        "  vec3 col = mix(uBaseColor, vec3(0.72, 0.88, 1.0), fres * 0.55) + vec3(1.0, 0.95, 0.8) * spec * 0.45;",
        "  gl_FragColor = vec4(col, 0.86);",
        "}"
      ].join("\n")
    });

    PONDS.forEach(function (pd) {
      var wm = new THREE.Mesh(new THREE.CircleGeometry(pd.r, 40), waterMat);
      wm.rotation.x = -Math.PI / 2;
      wm.position.set(pd.x, terrainY(pd.x, pd.z) + 1.55, pd.z);
      scene.add(wm);
    });

    var bunkerMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.9, metalness: 0.02 });
    BUNKERS.forEach(function (bk) {
      var bm = new THREE.Mesh(new THREE.CircleGeometry(bk.r, 28), bunkerMat);
      bm.rotation.x = -Math.PI / 2;
      bm.position.set(bk.x, terrainY(bk.x, bk.z) + 0.07, bk.z);
      bm.receiveShadow = true;
      scene.add(bm);
    });

    /* 全6エリア固有の歴史・神話ランドマーク3D建築生成 */
    var celestialRings = [];
    (function buildAreaArchitecture() {
      var goldMat = new THREE.MeshStandardMaterial({ color: 0xffcf56, roughness: 0.24, metalness: 0.86 });
      var marbMat = new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.35, metalness: 0.08 });
      var stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.85, metalness: 0.06 });
      if (window.HQW) HQW.whenTex('stone_map', function(){ stoneMat.map = HQW.tex.stone_map; stoneMat.normalMap = HQW.tex.stone_nrm; stoneMat.roughnessMap = HQW.tex.stone_rgh; stoneMat.needsUpdate = true; });
      var vermMat = new THREE.MeshStandardMaterial({ color: 0xc8251d, roughness: 0.42, metalness: 0.12 });
      var darkWood = new THREE.MeshStandardMaterial({ color: 0x2b1e16, roughness: 0.75 });
      if (window.HQW) HQW.whenTex('bark_map', function(){ darkWood.map = HQW.tex.bark_map; darkWood.normalMap = HQW.tex.bark_nrm; darkWood.needsUpdate = true; });

      function makeTorii(x, z, rotY, sc, matOverride) {
        var g = new THREE.Group();
        var m = matOverride || vermMat;
        var pL = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * sc, 0.34 * sc, 5.2 * sc, 14), m);
        var pR = pL.clone();
        pL.position.set(-1.9 * sc, 2.6 * sc, 0);
        pR.position.set(1.9 * sc, 2.6 * sc, 0);
        var kasagi = new THREE.Mesh(new THREE.BoxGeometry(5.4 * sc, 0.42 * sc, 0.65 * sc), darkWood);
        kasagi.position.y = 5.25 * sc;
        var shimaki = new THREE.Mesh(new THREE.BoxGeometry(4.8 * sc, 0.32 * sc, 0.48 * sc), m);
        shimaki.position.y = 4.92 * sc;
        var nuki = new THREE.Mesh(new THREE.BoxGeometry(4.4 * sc, 0.28 * sc, 0.36 * sc), m);
        nuki.position.y = 3.95 * sc;
        g.add(pL, pR, kasagi, shimaki, nuki);
        g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
        g.position.set(x, terrainY(x, z), z);
        g.rotation.y = rotY || 0;
        scene.add(g);
      }

      function makeTree(x, z, crownColor, tall) {
        var g = new THREE.Group();
        var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, tall ? 5.5 : 3.2, 8), darkWood);
        tr.position.y = tall ? 2.75 : 1.6;
        tr.castShadow = true;
        g.add(tr);
        var cMat = new THREE.MeshStandardMaterial({ color: crownColor, roughness: 0.78 });
        if (window.HQW) HQW.whenTex('leaf_map', function(){ cMat.normalMap = HQW.tex.leaf_nrm; cMat.bumpMap = HQW.tex.leaf_map; cMat.bumpScale = 0.6; cMat.needsUpdate = true; });
        if (tall) {
          var cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7.2, 10), cMat);
          cone.position.y = 6.2; cone.castShadow = true;
          g.add(cone);
        } else {
          for (var i = 0; i < 3; i++) {
            var sp = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75 - i * 0.25, 1), cMat);
            sp.position.set((i - 1) * 0.7, 3.4 + (i % 2) * 0.7, (i % 2) * 0.5);
            sp.castShadow = true;
            g.add(sp);
          }
        }
        g.position.set(x, terrainY(x, z), z);
        scene.add(g);
      }

      if (THEME.archType === "kyoto") {
        /* 京都：朱塗りの連続鳥居参道・五重塔・竹林・桜並木 */
        for (var i = 0; i < 5; i++) makeTorii(0, -18 - i * 9.5, 0, 1.0 + i * 0.05);
        /* 五重塔ランドマーク */
        var pag = new THREE.Group();
        for (var lv = 0; lv < 5; lv++) {
          var s = 1 - lv * 0.13;
          var core = new THREE.Mesh(new THREE.BoxGeometry(4.2 * s, 2.2, 4.2 * s), vermMat);
          core.position.y = 1.2 + lv * 2.4;
          var roof = new THREE.Mesh(new THREE.ConeGeometry(4.3 * s, 1.15, 4), darkWood);
          roof.rotation.y = Math.PI / 4;
          roof.position.y = 2.5 + lv * 2.4;
          core.castShadow = roof.castShadow = true;
          pag.add(core, roof);
        }
        var spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 3.6, 8), goldMat);
        spire.position.y = 14.5;
        pag.add(spire);
        pag.position.set(-38, terrainY(-38, -38), -38);
        scene.add(pag);
        /* 竹林＆桜 */
        var bamMat = new THREE.MeshStandardMaterial({ color: 0x3b8c47, roughness: 0.45 });
        for (var b = 0; b < 45; b++) {
          var bx = 38 + Math.sin(b * 2.1) * 18, bz = -5 + Math.cos(b * 1.7) * 28;
          var bm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 9 + (b % 4) * 2, 7), bamMat);
          bm.position.set(bx, terrainY(bx, bz) + 4.5, bz);
          bm.castShadow = true;
          scene.add(bm);
        }
        for (var sk = 0; sk < 18; sk++) {
          var a = (sk / 18) * Math.PI * 2;
          makeTree(Math.cos(a) * 54, Math.sin(a) * 54, sk % 2 === 0 ? 0xffb7c5 : 0x2f6b39, false);
        }
      } else if (THEME.archType === "paris") {
        /* パリ：ベルサイユ白大理石列柱宮殿・黄金噴水・幾何学トピアリー庭園 */
        var pal = new THREE.Group();
        var base = new THREE.Mesh(new THREE.BoxGeometry(42, 9.5, 10), marbMat);
        base.position.y = 4.75; base.castShadow = true; pal.add(base);
        var trim = new THREE.Mesh(new THREE.BoxGeometry(43, 0.8, 10.8), goldMat);
        trim.position.y = 9.6; pal.add(trim);
        for (var c = -5; c <= 5; c++) {
          var col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 9.2, 14), marbMat);
          col.position.set(c * 3.6, 4.6, 5.4); col.castShadow = true; pal.add(col);
        }
        var dome = new THREE.Mesh(new THREE.SphereGeometry(5.5, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
        dome.position.y = 9.8; pal.add(dome);
        pal.position.set(0, terrainY(0, -72), -72);
        scene.add(pal);
        for (var g = 0; g < 20; g++) {
          var ga = (g / 20) * Math.PI * 2;
          makeTree(Math.cos(ga) * 52, Math.sin(ga) * 52, 0x226b3a, true);
        }
      } else if (THEME.archType === "rome") {
        /* ローマ：コロッセオ大円形アーチ回廊・糸杉並木・鍛冶神の炎炉 */
        for (var ar = 0; ar < 20; ar++) {
          var ang = (ar / 20) * Math.PI * 2;
          if (Math.abs(Math.sin(ang)) < 0.25 && Math.cos(ang) < 0) continue;
          var rx = Math.cos(ang) * 68, rz = Math.sin(ang) * 68;
          var pillar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 13.5, 3.2), marbMat);
          pillar.position.set(rx, terrainY(rx, rz) + 6.75, rz);
          pillar.lookAt(0, pillar.position.y, 0);
          pillar.castShadow = true;
          scene.add(pillar);
        }
        for (var cy = 0; cy < 22; cy++) {
          var ca = (cy / 22) * Math.PI * 2;
          makeTree(Math.cos(ca) * 46, Math.sin(ca) * 46, 0x234d28, true);
        }
      } else if (THEME.archType === "america") {
        /* アメリカ：オーガスタ風白亜クラブハウス・アザレアの花壇・クリーク石橋・観客スタンド */
        var ch = new THREE.Group();
        var bodyM = new THREE.Mesh(new THREE.BoxGeometry(26, 7.5, 12), marbMat);
        bodyM.position.y = 3.75; bodyM.castShadow = true;
        var gRoof = new THREE.Mesh(new THREE.ConeGeometry(16, 4.2, 4), new THREE.MeshStandardMaterial({ color: 0x1e4d32, roughness: 0.7 }));
        gRoof.rotation.y = Math.PI / 4; gRoof.position.y = 9.5;
        ch.add(bodyM, gRoof);
        ch.position.set(-42, terrainY(-42, -45), -45);
        scene.add(ch);
        /* アザレア（鮮やかなピンク・白ツツジ）と松林 */
        for (var az = 0; az < 26; az++) {
          var aa = (az / 26) * Math.PI * 2;
          makeTree(Math.cos(aa) * 54, Math.sin(aa) * 54, az % 3 === 0 ? 0xff5e9c : 0x1b5e32, az % 3 !== 0);
        }
      } else if (THEME.archType === "edo") {
        /* 江戸城：巨大な石垣と黒金三層天守閣・黄泉の鳥居 */
        var keep = new THREE.Group();
        var ishigaki = new THREE.Mesh(new THREE.CylinderGeometry(13, 16.5, 7.5, 4), stoneMat);
        ishigaki.rotation.y = Math.PI / 4; ishigaki.position.y = 3.75; keep.add(ishigaki);
        var blackWall = new THREE.MeshStandardMaterial({ color: 0x181a24, roughness: 0.55 });
        for (var kl = 0; kl < 3; kl++) {
          var ks = 1 - kl * 0.2;
          var flr = new THREE.Mesh(new THREE.BoxGeometry(13 * ks, 3.6, 13 * ks), blackWall);
          flr.position.y = 9.2 + kl * 4.0;
          var krf = new THREE.Mesh(new THREE.ConeGeometry(11.5 * ks, 2.0, 4), goldMat);
          krf.rotation.y = Math.PI / 4; krf.position.y = 11.4 + kl * 4.0;
          flr.castShadow = krf.castShadow = true;
          keep.add(flr, krf);
        }
        keep.position.set(0, terrainY(0, -70), -70);
        scene.add(keep);
        makeTorii(0, -32, 0, 1.25, blackWall);
        for (var et = 0; et < 16; et++) {
          var ea = (et / 16) * Math.PI * 2;
          makeTree(Math.cos(ea) * 55, Math.sin(ea) * 55, 0x263832, false);
        }
      } else {
        /* 天空の神域：黄金鳥居とギリシャ神殿列柱の融合・天空で回転する天球儀リング */
        makeTorii(0, -30, 0, 1.35, goldMat);
        for (var oc = 0; oc < 16; oc++) {
          var oa = (oc / 16) * Math.PI * 2;
          var ox = Math.cos(oa) * 56, oz = Math.sin(oa) * 56;
          var pil = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 11, 16), marbMat);
          pil.position.set(ox, terrainY(ox, oz) + 5.5, oz);
          pil.castShadow = true;
          var capG = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 2.2), goldMat);
          capG.position.set(ox, terrainY(ox, oz) + 11.2, oz);
          scene.add(pil, capG);
        }
        for (var rg = 0; rg < 2; rg++) {
          var ring = new THREE.Mesh(new THREE.TorusGeometry(42 + rg * 14, 0.35, 12, 80), goldMat);
          ring.position.set(0, 36 + rg * 6, -30);
          ring.rotation.x = Math.PI * (0.32 + rg * 0.2);
          scene.add(ring);
          celestialRings.push(ring);
        }
      }
    })();

    /* ===== 建築ディテール増強（商用品質アップグレード： Extrude/Lathe本格造形・発光・炎の揺らめき） ===== */
    var FLICKER_LIGHTS = [];
    (function buildArchitectureDetail() {
      var goldM = new THREE.MeshStandardMaterial({ color: 0xffcf56, roughness: 0.24, metalness: 0.86 });
      var stoneM = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.85 });
      var marbM = new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.35, metalness: 0.08 });
      var darkW = new THREE.MeshStandardMaterial({ color: 0x2b1e16, roughness: 0.75 });
      var vermM = new THREE.MeshStandardMaterial({ color: 0xc8251d, roughness: 0.42 });
      function curvedRoof(w, d, h, mat) {
        var sh = new THREE.Shape();
        sh.moveTo(-w / 2, 0);
        sh.quadraticCurveTo(-w * 0.18, h * 0.92, 0, h);
        sh.quadraticCurveTo(w * 0.18, h * 0.92, w / 2, 0);
        sh.lineTo(w / 2 - 0.35, -0.28); sh.lineTo(-w / 2 + 0.35, -0.28); sh.closePath();
        var geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
        geo.translate(0, 0, -d / 2);
        var m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
      }
      if (THEME.archType === "kyoto") {
        var lampM = new THREE.MeshStandardMaterial({ color: 0x8a8f7a, roughness: 0.9 });
        var glowM = new THREE.MeshStandardMaterial({ color: 0xffc37a, emissive: 0xff9a3c, emissiveIntensity: 1.6 });
        for (var li = 0; li < 5; li++) {
          [-3.4, 3.4].forEach(function (lx) {
            var lz = -16 - li * 9.5;
            var lg = new THREE.Group();
            var post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.5, 8), lampM); post.position.y = 0.75;
            var lbox = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.44, 0.52), glowM); lbox.position.y = 1.65;
            var lcap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.34, 4), lampM); lcap.rotation.y = Math.PI / 4; lcap.position.y = 2.02;
            lg.add(post, lbox, lcap); lg.position.set(lx, terrainY(lx, lz), lz); scene.add(lg);
          });
        }
        var hall = new THREE.Group();
        var hw = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.6, 4.4), vermM); hw.position.y = 1.3; hw.castShadow = true;
        var rf = curvedRoof(7.6, 5.6, 1.5, darkW); rf.position.y = 2.65;
        hall.add(hw, rf); hall.position.set(-30, terrainY(-30, -24), -24); scene.add(hall);
      } else if (THEME.archType === "paris") {
        var fnt = new THREE.Group();
        var pts = []; [[0.1, 0], [2.6, 0.15], [2.75, 0.5], [1.5, 0.62], [1.35, 1.5], [2.1, 1.62], [2.2, 1.95], [0.9, 2.05], [0.75, 2.8], [1.15, 2.9], [1.2, 3.2], [0.12, 3.3]].forEach(function (p) { pts.push(new THREE.Vector2(p[0], p[1])); });
        var fb = new THREE.Mesh(new THREE.LatheGeometry(pts, 22), marbM); fb.castShadow = true; fnt.add(fb);
        var water = new THREE.Mesh(new THREE.CircleGeometry(2.35, 22), new THREE.MeshStandardMaterial({ color: 0x7ec8e8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8 }));
        water.rotation.x = -Math.PI / 2; water.position.y = 0.55; fnt.add(water);
        fnt.position.set(0, terrainY(0, -48), -48); scene.add(fnt);
        var st = new THREE.Group();
        var ped2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.6), marbM); ped2.position.y = 1.1; st.add(ped2);
        var robe = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.6, 10), goldM); robe.position.y = 3.5; st.add(robe);
        var hd = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), goldM); hd.position.y = 5.05; st.add(hd);
        var armS = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.7, 8), goldM); armS.position.set(0.8, 4.4, 0); armS.rotation.z = -0.9; st.add(armS);
        st.position.set(10, terrainY(10, -58), -58); scene.add(st);
        var winMat = new THREE.MeshStandardMaterial({ color: 0x1a2038, roughness: 0.25, metalness: 0.4 });
        for (var wi = -5; wi <= 5; wi++) {
          if (wi === 0) continue;
          var win = new THREE.Group();
          var inset = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.4, 0.18), winMat); win.add(inset);
          var archT = new THREE.Mesh(new THREE.CircleGeometry(0.75, 14, 0, Math.PI), winMat); archT.position.y = 1.7; win.add(archT);
          win.position.set(wi * 3.6, terrainY(0, -72) + 4.4, -72 + 5.15); scene.add(win);
        }
      } else if (THEME.archType === "rome") {
        var shape = new THREE.Shape();
        shape.moveTo(-2.6, 0); shape.lineTo(2.6, 0); shape.lineTo(2.6, 6.4); shape.lineTo(-2.6, 6.4); shape.closePath();
        var holeP = new THREE.Path();
        holeP.moveTo(-1.15, 0); holeP.lineTo(-1.15, 3.1); holeP.absarc(0, 3.1, 1.15, Math.PI, 0, true); holeP.lineTo(1.15, 0); holeP.closePath();
        shape.holes.push(holeP);
        var segGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: false });
        for (var tier = 0; tier < 2; tier++) {
          for (var sg = 0; sg < 60; sg++) {
            var a2 = (sg / 60) * Math.PI * 2;
            if (Math.abs(Math.sin(a2)) < 0.22 && Math.cos(a2) < 0) continue;
            var seg = new THREE.Mesh(segGeo, stoneM);
            var px = Math.cos(a2) * 62, pz = Math.sin(a2) * 62;
            seg.position.set(px, terrainY(px, pz) + tier * 6.4, pz);
            seg.lookAt(0, seg.position.y, 0);
            seg.scale.x = 1.14; seg.castShadow = true;
            scene.add(seg);
          }
        }
        var forge = new THREE.Group();
        var fb2 = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.3, 1.6, 10), stoneM); fb2.position.y = 0.8; forge.add(fb2);
        var lava = new THREE.Mesh(new THREE.CircleGeometry(1.45, 14), new THREE.MeshStandardMaterial({ color: 0xff5a1e, emissive: 0xff4400, emissiveIntensity: 2.2 }));
        lava.rotation.x = -Math.PI / 2; lava.position.y = 1.62; forge.add(lava);
        var fl = new THREE.PointLight(0xff7a33, 1.6 * Math.PI, 26, 1); fl.position.y = 2.6; forge.add(fl);
        FLICKER_LIGHTS.push({ l: fl, base: 1.6, seed: Math.random() * 9 });
        forge.position.set(20, terrainY(20, -30), -30); scene.add(forge);
      } else if (THEME.archType === "america") {
        var tw = new THREE.Group();
        var tb = new THREE.Mesh(new THREE.BoxGeometry(4.4, 13, 4.4), marbM); tb.position.y = 6.5; tb.castShadow = true; tw.add(tb);
        var trf = new THREE.Mesh(new THREE.ConeGeometry(3.9, 3.2, 4), new THREE.MeshStandardMaterial({ color: 0x1e4d32, roughness: 0.7 })); trf.rotation.y = Math.PI / 4; trf.position.y = 14.6; tw.add(trf);
        var clock = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.24, 20), new THREE.MeshStandardMaterial({ color: 0xf6f1de, roughness: 0.3, emissive: 0x444026 }));
        clock.rotation.x = Math.PI / 2; clock.position.set(0, 10.6, 2.25); tw.add(clock);
        var hh1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.1), darkW); hh1.position.set(0, 10.85, 2.42); hh1.rotation.z = -0.7; tw.add(hh1);
        var hh2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.72, 0.1), darkW); hh2.position.set(0.18, 10.45, 2.42); hh2.rotation.z = 1.9; tw.add(hh2);
        tw.position.set(-56, terrainY(-56, -42), -42); scene.add(tw);
        var brShape = new THREE.Shape();
        brShape.moveTo(-7, 0); brShape.quadraticCurveTo(0, 3.4, 7, 0); brShape.lineTo(7, -1.1); brShape.quadraticCurveTo(0, 1.6, -7, -1.1); brShape.closePath();
        var brGeo = new THREE.ExtrudeGeometry(brShape, { depth: 3.2, bevelEnabled: false }); brGeo.translate(0, 0, -1.6);
        var bridge = new THREE.Mesh(brGeo, stoneM); bridge.castShadow = true;
        bridge.position.set(24, terrainY(24, -14) + 0.4, -14); bridge.rotation.y = 0.5; scene.add(bridge);
      } else if (THEME.archType === "edo") {
        [-2.4, 2.4].forEach(function (sx) {
          var shg = new THREE.Group();
          var bd = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 8), goldM); bd.rotation.x = Math.PI; shg.add(bd);
          var hd2 = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), goldM); hd2.position.set(0, 0.72, 0.12); shg.add(hd2);
          var fin2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 4), goldM); fin2.position.set(0, 0.35, -0.4); fin2.rotation.x = -0.8; shg.add(fin2);
          shg.position.set(sx, terrainY(0, -70) + 19.3, -70); shg.rotation.y = sx > 0 ? Math.PI : 0; scene.add(shg);
        });
        [-6, 6].forEach(function (bx) {
          var bz = new THREE.Group();
          var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.0, 6), darkW); pole.position.y = 1.0; bz.add(pole);
          var basket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.5, 8, 1, true), darkW); basket.position.y = 2.15; bz.add(basket);
          var flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.85, 8), new THREE.MeshStandardMaterial({ color: 0xffa63e, emissive: 0xff7b1c, emissiveIntensity: 2.4, transparent: true, opacity: 0.92 }));
          flame.position.y = 2.6; bz.add(flame);
          var bl = new THREE.PointLight(0xff8a3c, 1.3 * Math.PI, 20, 1); bl.position.y = 2.7; bz.add(bl);
          FLICKER_LIGHTS.push({ l: bl, base: 1.3, seed: Math.random() * 9 });
          bz.position.set(bx, terrainY(bx, -56), -56); scene.add(bz);
        });
      } else {
        var tmp = new THREE.Group();
        for (var ci = -3; ci <= 3; ci++) {
          var col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 9, 12), marbM);
          col2.position.set(ci * 3.1, 4.5, 0); col2.castShadow = true; tmp.add(col2);
          var cap2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), goldM); cap2.position.set(ci * 3.1, 9.2, 0); tmp.add(cap2);
        }
        var beam = new THREE.Mesh(new THREE.BoxGeometry(21.5, 0.9, 2.2), marbM); beam.position.y = 9.8; tmp.add(beam);
        var pedShape = new THREE.Shape(); pedShape.moveTo(-10.7, 0); pedShape.lineTo(10.7, 0); pedShape.lineTo(0, 3.4); pedShape.closePath();
        var pedGeo = new THREE.ExtrudeGeometry(pedShape, { depth: 2.0, bevelEnabled: false }); pedGeo.translate(0, 0, -1);
        var ped = new THREE.Mesh(pedGeo, marbM); ped.position.y = 10.25; tmp.add(ped);
        tmp.position.set(0, terrainY(0, -80), -80); scene.add(tmp);
      }
      if (FLICKER_LIGHTS.length) {
        (function flick() {
          var t = performance.now() / 1000;
          FLICKER_LIGHTS.forEach(function (f) { f.l.intensity = f.base * Math.PI * (0.82 + 0.28 * Math.sin(t * 11 + f.seed) * Math.sin(t * 5.3 + f.seed * 2)); });
          requestAnimationFrame(flick);
        })();
      }
    })();

    /* =========================================================================
       v4.4レイヤー：象徴建築のジオメトリ作り込み＋植生密度＋遠景/霧/空の改善
       ・既存の生成関数には一切手を入れず、エリア生成後に追加ジオメトリを足す。
       ・江戸は黄泉・黒金仕様を維持（白壁化しない）。白漆喰＋瓦＋石垣は京都側で表現。
       ========================================================================= */
    (function buildWorldV44Layer() {
      var goldM = new THREE.MeshStandardMaterial({ color: 0xffcf56, roughness: 0.24, metalness: 0.86 });
      var goldDim = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.38, metalness: 0.8 });
      var whiteM = new THREE.MeshStandardMaterial({ color: 0xf2ede0, roughness: 0.82, metalness: 0.02 });
      var tileM = new THREE.MeshStandardMaterial({ color: 0x39424f, roughness: 0.55, metalness: 0.22 });
      var tileDarkM = new THREE.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.5, metalness: 0.3 });
      var blackM = new THREE.MeshStandardMaterial({ color: 0x14151d, roughness: 0.58, metalness: 0.12 });
      var stoneM = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.88, metalness: 0.05 });
      var marbM = new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.35, metalness: 0.08 });
      var vermM = new THREE.MeshStandardMaterial({ color: 0xc8251d, roughness: 0.42, metalness: 0.12 });
      var woodM = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 0.78 });
      var slateM = new THREE.MeshStandardMaterial({ color: 0x46586e, roughness: 0.5, metalness: 0.35 });
      var greenRoofM = new THREE.MeshStandardMaterial({ color: 0x1e4d32, roughness: 0.7 });

      var v44count = 0;
      function bx(parent, w, h, d, mat, x, y, z, ry) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z); if (ry) m.rotation.y = ry;
        m.castShadow = true; m.receiveShadow = true; parent.add(m); v44count++; return m;
      }
      function cyl(parent, rt, rb, h, seg, mat, x, y, z) {
        var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
        m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); v44count++; return m;
      }
      /* 反りのある屋根（軒反りプロファイルを Extrude した本格瓦屋根スラブ＋棟＋軒先の跳ね上げ） */
      function soriRoof(w, d, h, mat, ridgeMat) {
        var g = new THREE.Group();
        var sh = new THREE.Shape();
        sh.moveTo(-w / 2, 0);
        sh.quadraticCurveTo(-w * 0.20, h * 0.95, 0, h);
        sh.quadraticCurveTo(w * 0.20, h * 0.95, w / 2, 0);
        sh.lineTo(w / 2 - 0.32, -0.30); sh.lineTo(-w / 2 + 0.32, -0.30); sh.closePath();
        var geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
        geo.translate(0, 0, -d / 2);
        var slab = new THREE.Mesh(geo, mat); slab.castShadow = true; slab.receiveShadow = true; g.add(slab); v44count++;
        var ridge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, d * 0.92), ridgeMat || mat);
        ridge.position.y = h + 0.08; ridge.castShadow = true; g.add(ridge); v44count++;
        [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) {
          var tip = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 0.85), mat);
          tip.position.set(sx * (w / 2 - 0.2), 0.22, sz * (d / 2 - 0.2));
          tip.rotation.z = -sx * 0.38; tip.rotation.x = sz * 0.38; tip.castShadow = true; g.add(tip); v44count++;
        }); });
        return g;
      }
      /* 石垣の段差（下段ほど広く・石目テクスチャで段ごとに陰影を作る） */
      function ishigakiSteps(w, d, steps, hEach, mat) {
        var g = new THREE.Group();
        for (var i = 0; i < steps; i++) {
          var k = (steps - i) / steps;
          bx(g, w * (0.72 + 0.28 * k), hEach, d * (0.72 + 0.28 * k), mat || stoneM, 0, hEach * (i + 0.5), 0);
        }
        return g;
      }
      function solidAt(x, z, px, pz, r) { return Math.hypot(x - px, z - pz) < r; }

      var arch = THEME.archType;

      /* ---------------- 京都：白漆喰＋瓦＋石垣の社務所／五重塔の白壁・反り軒／鳥居の部品増し ---------------- */
      if (arch === "kyoto") {
        /* 社務所（石垣台座→白漆喰壁→柱列→反り瓦屋根の関係を部品で表現） */
        var shrineOffice = new THREE.Group();
        var soBase = ishigakiSteps(11, 8, 3, 0.55); shrineOffice.add(soBase);
        bx(shrineOffice, 9.2, 2.7, 6.4, whiteM, 0, 1.65 + 1.35, 0);
        bx(shrineOffice, 9.6, 0.35, 6.8, woodM, 0, 1.65 + 0.18, 0);
        bx(shrineOffice, 9.6, 0.3, 6.8, woodM, 0, 1.65 + 2.62, 0);
        for (var pc = -3; pc <= 3; pc++) cyl(shrineOffice, 0.16, 0.18, 2.7, 8, woodM, pc * 1.45, 1.65 + 1.35, 3.35);
        bx(shrineOffice, 10.6, 0.28, 1.6, woodM, 0, 1.5, 3.6);
        var soRoof = soriRoof(11.6, 8.6, 1.7, tileM, tileDarkM); soRoof.position.y = 1.65 + 2.85; shrineOffice.add(soRoof);
        var soRoof2 = soriRoof(8.2, 6.2, 1.25, tileM, tileDarkM); soRoof2.position.y = 1.65 + 2.85 + 1.55; shrineOffice.add(soRoof2);
        shrineOffice.position.set(20, terrainY(20, 34), 34); shrineOffice.rotation.y = -0.35;
        scene.add(shrineOffice);
        /* 小祠堂（白壁＋瓦） */
        var miniHall = new THREE.Group();
        miniHall.add(ishigakiSteps(5.4, 4.6, 2, 0.5));
        bx(miniHall, 4.2, 2.0, 3.4, whiteM, 0, 1.0 + 1.0, 0);
        var mhRoof = soriRoof(6.0, 4.8, 1.2, tileM, tileDarkM); mhRoof.position.y = 3.05; miniHall.add(mhRoof);
        bx(miniHall, 0.9, 1.3, 0.14, vermM, 0, 1.65, 1.74);
        miniHall.position.set(-24, terrainY(-24, 40), 40); miniHall.rotation.y = 0.5;
        scene.add(miniHall);
        /* 五重塔：各層に白漆喰の壁帯＋反り軒スラブ＋石垣基壇を追加し、円錐屋根だけの平坦さを消す */
        var pagBase = new THREE.Group();
        pagBase.add(ishigakiSteps(9.5, 9.5, 3, 0.6));
        pagBase.position.set(-38, terrainY(-38, -38), -38); scene.add(pagBase);
        for (var lv2 = 0; lv2 < 5; lv2++) {
          var s2 = 1 - lv2 * 0.13;
          var lvlG = new THREE.Group();
          bx(lvlG, 4.35 * s2, 0.85, 4.35 * s2, whiteM, 0, 0, 0);
          var eave = soriRoof(6.1 * s2, 6.1 * s2, 0.55, tileDarkM, goldDim); eave.position.y = 0.42; lvlG.add(eave);
          lvlG.position.set(-38, terrainY(-38, -38) + 1.8 + 0.85 + lv2 * 2.4, -38);
          scene.add(lvlG);
        }
        /* 鳥居の部品増し：根巻き石（柱脚）・額束（がくづか）・笠木の反りキャップ・貫の楔 */
        for (var ti = 0; ti < 5; ti++) {
          var tsc = 1.0 + ti * 0.05, tx = 0, tz = -18 - ti * 9.5, ty = terrainY(tx, tz);
          var tg = new THREE.Group();
          [-1.9 * tsc, 1.9 * tsc].forEach(function (px) {
            cyl(tg, 0.52 * tsc, 0.62 * tsc, 0.5, 10, stoneM, px, 0.25, 0);
            bx(tg, 0.34 * tsc, 0.5 * tsc, 0.2, woodM, px * 0.92, 3.95 * tsc, 0.24);
          });
          bx(tg, 0.55 * tsc, 1.15 * tsc, 0.2, vermM, 0, 4.35 * tsc, 0);
          bx(tg, 0.4 * tsc, 0.5 * tsc, 0.24, goldDim, 0, 4.35 * tsc, 0.02);
          var cap = soriRoof(5.9 * tsc, 0.95, 0.42, tileDarkM, tileDarkM); cap.position.y = 5.42 * tsc; tg.add(cap);
          tg.position.set(tx, ty, tz); scene.add(tg);
        }
        /* 玉垣（朱の柵）で参道の両側を区切る */
        for (var fk = 0; fk < 9; fk++) {
          [-4.6, 4.6].forEach(function (fx) {
            var fz = -14 - fk * 5.2;
            bx(scene, 0.18, 1.0, 0.18, vermM, fx, terrainY(fx, fz) + 0.5, fz);
          });
          [-4.6, 4.6].forEach(function (fx2) {
            var fz2 = -16.6 - fk * 5.2;
            bx(scene, 0.12, 0.16, 5.2, vermM, fx2, terrainY(fx2, fz2) + 0.92, fz2);
          });
        }
      }

      /* ---------------- パリ：マンサード屋根帯・フレッシュ尖塔・両翼ドーム・煙突/ドーマー ---------------- */
      if (arch === "paris") {
        var pBaseY = terrainY(0, -72);
        var pg = new THREE.Group();
        bx(pg, 43.5, 2.4, 11.4, slateM, 0, 10.6, 0);
        var slopeF = bx(pg, 43.5, 3.4, 0.3, slateM, 0, 12.2, 4.6); slopeF.rotation.x = 0.5;
        var slopeB = bx(pg, 43.5, 3.4, 0.3, slateM, 0, 12.2, -4.6); slopeB.rotation.x = -0.5;
        bx(pg, 43.5, 1.5, 6.4, slateM, 0, 13.6, 0);
        for (var dm = -4; dm <= 4; dm++) {
          if (dm === 0) continue;
          bx(pg, 1.3, 1.5, 0.5, whiteM, dm * 4.4, 11.9, 5.35);
          var dRoof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.8, 4), goldDim);
          dRoof.rotation.y = Math.PI / 4; dRoof.position.set(dm * 4.4, 13.0, 5.35); dRoof.castShadow = true; pg.add(dRoof); v44count++;
        }
        [-19, -9.5, 9.5, 19].forEach(function (cx) { bx(pg, 0.9, 1.7, 0.9, whiteM, cx, 14.9, 0); });
        /* 中央フレッシュ（尖塔）：ドーム頂から伸びるシルエットの芯 */
        cyl(pg, 0.32, 0.5, 2.2, 8, goldM, 0, 16.6, 0);
        var fleche = new THREE.Mesh(new THREE.ConeGeometry(0.95, 4.6, 8), goldM);
        fleche.position.set(0, 19.9, 0); fleche.castShadow = true; pg.add(fleche); v44count++;
        var fBall = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), goldM); fBall.position.set(0, 22.4, 0); pg.add(fBall); v44count++;
        /* 両翼パビリオンのドーム＋小尖塔 */
        [-16.5, 16.5].forEach(function (wx) {
          var wd = new THREE.Mesh(new THREE.SphereGeometry(3.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), slateM);
          wd.position.set(wx, 11.6, 0); wd.castShadow = true; pg.add(wd); v44count++;
          var wt = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 8), goldM);
          wt.position.set(wx, 15.9, 0); wt.castShadow = true; pg.add(wt); v44count++;
        });
        /* 正面の破風（ペディメント）と時計円盤 */
        var pedS = new THREE.Shape(); pedS.moveTo(-4.4, 0); pedS.lineTo(4.4, 0); pedS.lineTo(0, 2.2); pedS.closePath();
        var pedG = new THREE.ExtrudeGeometry(pedS, { depth: 0.5, bevelEnabled: false });
        var pedM = new THREE.Mesh(pedG, marbM); pedM.position.set(0, 9.9, 5.2); pedM.castShadow = true; pg.add(pedM); v44count++;
        pg.position.set(0, pBaseY, -72); scene.add(pg);
      }

      /* ---------------- ローマ：コロッセオに横梁（エンタブラチュア）の段＋アリーナ楕円リング ---------------- */
      if (arch === "rome") {
        for (var rb = 0; rb < 40; rb++) {
          var ra = (rb / 40) * Math.PI * 2;
          if (Math.abs(Math.sin(ra)) < 0.25 && Math.cos(ra) < 0) continue;
          var rx2 = Math.cos(ra) * 68, rz2 = Math.sin(ra) * 68, ry2 = terrainY(rx2, rz2);
          [7.0, 13.9].forEach(function (hh) {
            var beam = bx(scene, 11.0, 0.95, 3.5, marbM, rx2, ry2 + hh, rz2);
            beam.lookAt(0, ry2 + hh, 0);
          });
          var key = bx(scene, 1.1, 1.5, 0.5, stoneM, Math.cos(ra) * 66.2, ry2 + 10.6, Math.sin(ra) * 66.2);
          key.lookAt(0, ry2 + 10.6, 0);
        }
        var arena = new THREE.Mesh(new THREE.TorusGeometry(30, 0.45, 8, 64), stoneM);
        arena.rotation.x = Math.PI / 2; arena.scale.set(1, 0.78, 1);
        arena.position.set(0, terrainY(0, 0) + 0.35, 0); arena.receiveShadow = true; scene.add(arena); v44count++;
        var arenaIn = new THREE.Mesh(new THREE.TorusGeometry(21, 0.35, 8, 56), marbM);
        arenaIn.rotation.x = Math.PI / 2; arenaIn.scale.set(1, 0.78, 1);
        arenaIn.position.set(0, terrainY(0, 0) + 0.3, 0); scene.add(arenaIn); v44count++;
      }

      /* ---------------- アメリカ：クラブハウスのポーチ列柱・破風・キューポラ・ドーマー＋観客スタンド ---------------- */
      if (arch === "america") {
        var cBaseY = terrainY(-42, -45);
        var cg = new THREE.Group();
        bx(cg, 27, 0.6, 4.6, marbM, 0, 0.3, 8.1);
        for (var cc2 = -5; cc2 <= 5; cc2 += 2) cyl(cg, 0.3, 0.34, 7.2, 12, whiteM, cc2 * 2.5, 3.9, 9.6);
        var porchRoof = bx(cg, 28, 0.35, 5.4, greenRoofM, 0, 7.75, 8.6); porchRoof.rotation.x = 0.16;
        var pedS2 = new THREE.Shape(); pedS2.moveTo(-5.2, 0); pedS2.lineTo(5.2, 0); pedS2.lineTo(0, 2.4); pedS2.closePath();
        var pedG2 = new THREE.ExtrudeGeometry(pedS2, { depth: 0.6, bevelEnabled: false });
        var pedM2 = new THREE.Mesh(pedG2, whiteM); pedM2.position.set(0, 7.9, 9.9); pedM2.castShadow = true; cg.add(pedM2); v44count++;
        cyl(cg, 1.15, 1.3, 1.6, 10, whiteM, 0, 12.6, 0);
        var cup = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.6, 8), greenRoofM);
        cup.position.set(0, 14.2, 0); cup.castShadow = true; cg.add(cup); v44count++;
        var cupBall = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), goldM); cupBall.position.set(0, 15.3, 0); cg.add(cupBall); v44count++;
        [-8, 0, 8].forEach(function (dx) {
          bx(cg, 1.7, 1.6, 0.6, whiteM, dx, 9.3, 3.4);
          var dr = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.9, 4), greenRoofM);
          dr.rotation.y = Math.PI / 4; dr.position.set(dx, 10.5, 3.4); cg.add(dr); v44count++;
        });
        cg.position.set(-42, cBaseY, -45); scene.add(cg);
        /* 観客グランドスタンド（段々＋屋根柱） */
        var gs = new THREE.Group();
        for (var stp = 0; stp < 4; stp++) bx(gs, 16, 0.85, 1.7, marbM, 0, 0.45 + stp * 0.85, -stp * 1.55);
        bx(gs, 16, 2.2, 0.4, greenRoofM, 0, 4.4, -6.6);
        [-7.4, -2.5, 2.5, 7.4].forEach(function (px2) { cyl(gs, 0.14, 0.14, 5.6, 8, whiteM, px2, 2.8, 0.6); });
        var gsRoof = bx(gs, 17, 0.3, 8.6, greenRoofM, 0, 5.9, -2.6); gsRoof.rotation.x = 0.1;
        gs.position.set(34, terrainY(34, -34), -34); gs.rotation.y = -0.6; scene.add(gs);
      }

      /* ---------------- 江戸：天守の段差石垣・黒壁の段＋反り屋根（黒瓦×金棟）・櫓・外周石垣（※白壁化しない） ---------------- */
      if (arch === "edo") {
        var eBaseY = terrainY(0, -70);
        var eg = new THREE.Group();
        var step1 = cyl(eg, 20.5, 23.5, 2.0, 4, stoneM, 0, 0.6, 0); step1.rotation.y = Math.PI / 4;
        var step2 = cyl(eg, 18.0, 20.5, 2.0, 4, stoneM, 0, 2.2, 0); step2.rotation.y = Math.PI / 4;
        for (var kl2 = 0; kl2 < 3; kl2++) {
          var ks2 = 1 - kl2 * 0.2, fy = 9.2 + kl2 * 4.0;
          bx(eg, 13.5 * ks2, 0.5, 13.5 * ks2, goldDim, 0, fy - 1.65, 0);
          bx(eg, 13.5 * ks2, 0.42, 13.5 * ks2, tileDarkM, 0, fy + 1.72, 0);
          [-1, 1].forEach(function (sx2) { [-1, 1].forEach(function (sz2) {
            var crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), goldM);
            crest.position.set(sx2 * 6.4 * ks2, fy + 0.2, sz2 * 6.4 * ks2); eg.add(crest); v44count++;
          }); });
          var eRoof = soriRoof(14.6 * ks2, 14.6 * ks2, 1.15, tileDarkM, goldM);
          eRoof.position.y = fy + 1.85; eg.add(eRoof);
        }
        eg.position.set(0, eBaseY, -70); scene.add(eg);
        /* 隅櫓（黒壁＋反り屋根＋石垣）×2 */
        [[24, -58], [-24, -58]].forEach(function (yp) {
          var yg = new THREE.Group();
          yg.add(ishigakiSteps(7.5, 7.5, 2, 0.8));
          bx(yg, 5.6, 3.0, 5.6, blackM, 0, 1.6 + 1.5, 0);
          bx(yg, 6.0, 0.4, 6.0, goldDim, 0, 1.6 + 0.2, 0);
          var yRoof = soriRoof(7.6, 7.6, 1.3, tileDarkM, goldM); yRoof.position.y = 1.6 + 3.1; yg.add(yRoof);
          yg.position.set(yp[0], terrainY(yp[0], yp[1]), yp[1]); scene.add(yg);
        });
        /* 外周の石垣ウォール（地形に沿った分割配置） */
        for (var wi2 = 0; wi2 < 14; wi2++) {
          var wa = (wi2 / 14) * Math.PI * 2 + 0.22;
          var wx = Math.cos(wa) * 30, wz = -70 + Math.sin(wa) * 26;
          var wall = bx(scene, 11.5, 1.7, 1.1, stoneM, wx, terrainY(wx, wz) + 0.7, wz);
          wall.lookAt(0, terrainY(wx, wz) + 0.7, -70);
        }
        /* 黄泉鳥居（0,-32 黒鳥居）の根巻き石と額束・黒金の笠 */
        var yg2 = new THREE.Group();
        [-2.38, 2.38].forEach(function (px3) { cyl(yg2, 0.6, 0.72, 0.55, 10, stoneM, px3, 0.27, 0); });
        bx(yg2, 0.6, 1.3, 0.22, blackM, 0, 5.45, 0);
        bx(yg2, 0.44, 0.55, 0.26, goldDim, 0, 5.45, 0.02);
        yg2.position.set(0, terrainY(0, -32), -32); scene.add(yg2);
      }

      /* ---------------- 神域：神殿の基壇段・浮遊島（岩塊＋石板＋結晶）・第二列柱 ---------------- */
      if (arch === "olympus") {
        var oBaseY = terrainY(0, -80);
        var og = new THREE.Group();
        bx(og, 26, 0.7, 10, marbM, 0, 0.35, 2);
        bx(og, 23, 0.7, 8.6, marbM, 0, 1.05, 2);
        bx(og, 20, 0.7, 7.4, marbM, 0, 1.75, 2);
        og.position.set(0, oBaseY, -80); scene.add(og);
        for (var oc2 = -4; oc2 <= 4; oc2++) {
          if (oc2 === 0) continue;
          var cx3 = oc2 * 4.4, cz3 = -62, cy3 = terrainY(cx3, cz3);
          cyl(scene, 0.5, 0.62, 7.4, 12, marbM, cx3, cy3 + 3.7, cz3);
          bx(scene, 1.4, 0.45, 1.4, goldM, cx3, cy3 + 7.6, cz3);
          bx(scene, 1.5, 0.4, 1.5, marbM, cx3, cy3 + 0.2, cz3);
        }
        var beam2 = bx(scene, 39, 0.8, 1.9, marbM, 0, terrainY(0, -62) + 8.15, -62);
        function floatIsland(x, z, lift, sc) {
          var fg = new THREE.Group();
          var rock = new THREE.Mesh(new THREE.ConeGeometry(3.4 * sc, 5.2 * sc, 7), stoneM);
          rock.rotation.x = Math.PI; rock.position.y = -2.2 * sc; rock.castShadow = true; fg.add(rock); v44count++;
          cyl(fg, 3.9 * sc, 3.9 * sc, 0.7, 7, marbM, 0, 0.3, 0);
          var cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.85 * sc, 0),
            new THREE.MeshStandardMaterial({ color: 0xffe98a, emissive: 0xcc9a22, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.4 }));
          cry.position.y = 1.9 * sc; fg.add(cry); v44count++;
          var beamC = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * sc, 1.3 * sc, lift, 10, 1, true),
            new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
          beamC.position.y = -lift / 2 - 4.6 * sc; fg.add(beamC); v44count++;
          fg.position.set(x, terrainY(x, z) + lift, z); scene.add(fg);
        }
        floatIsland(30, -54, 9, 1.0);
        floatIsland(-33, -60, 11.5, 1.25);
        floatIsland(17, -90, 13, 0.85);
        floatIsland(-18, -92, 8, 0.7);
      }

      /* ---------------- 全エリア共通：参道の敷石・植生インスタンシング・遠景の山影・地平の霞 ---------------- */
      var stonePathMat = new THREE.MeshStandardMaterial({ color: 0x7d7668, roughness: 0.95 });
      var pathInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.14, 1.15), stonePathMat, 30);
      var dummy = new THREE.Object3D();
      for (var pi2 = 0; pi2 < 30; pi2++) {
        var pz3 = 20 - pi2 * 2.65, px4 = Math.sin(pi2 * 1.7) * 0.35;
        dummy.position.set(px4, terrainY(px4, pz3) + 0.045, pz3); if (pz3 > -46) dummy.scale.set(0.001, 0.001, 0.001); else dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, Math.sin(pi2 * 2.3) * 0.14, 0);
        dummy.updateMatrix(); pathInst.setMatrixAt(pi2, dummy.matrix);
      }
      pathInst.receiveShadow = true; scene.add(pathInst);

      var seed = 1234567;
      function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
      var avoid = [[0, -72, 17], [-42, -45, 16], [0, -70, 20], [0, -80, 15], [-38, -38, 9], [20, -30, 9], [34, -34, 11], [-56, -42, 8], [20, 34, 10], [0, -48, 7]];
      function spotOK(x, z) {
        if (isInPond(x, z)) return false;
        if (Math.abs(x) < 6 && z < 4 && z > -62) return false;
        for (var i = 0; i < PONDS.length; i++) if (Math.hypot(x - PONDS[i].x, z - PONDS[i].z) < PONDS[i].r + 4) return false;
        for (var j = 0; j < BUNKERS.length; j++) if (Math.hypot(x - BUNKERS[j].x, z - BUNKERS[j].z) < BUNKERS[j].r + 2.5) return false;
        for (var k = 0; k < avoid.length; k++) if (solidAt(x, z, avoid[k][0], avoid[k][1], avoid[k][2])) return false;
        if (arch === "rome" && Math.abs(Math.hypot(x, z) - 65) < 9) return false;
        return true;
      }
      var NT = 110, treePos = [];
      var guard = 0;
      while (treePos.length < NT && guard++ < 3000) {
        var ta = rnd() * Math.PI * 2, tr2 = 24 + rnd() * 66;
        var tx2 = Math.cos(ta) * tr2, tz4 = Math.sin(ta) * tr2;
        if (!spotOK(tx2, tz4)) continue;
        treePos.push({ x: tx2, z: tz4, s: 0.75 + rnd() * 0.8, rot: rnd() * Math.PI * 2 });
      }
      var trunkInst = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.16, 0.3, 2.8, 7),
        new THREE.MeshStandardMaterial({ color: 0x4c3826, roughness: 0.9 }), treePos.length);
      var crownCols = (arch === "kyoto")
        ? [0xe8a7bf, 0x3d7d3a, 0xd98fab]
        : (arch === "rome" || arch === "paris")
          ? [0x27592e, 0x2e6b34, 0x244f2a]
          : [0x2e6b34, 0x3d7d3a, 0x27592e];
      var crownInsts = crownCols.map(function (cc) {
        return new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.55, 1),
          new THREE.MeshStandardMaterial({ color: cc, roughness: 0.85 }), treePos.length);
      });
      var tallCrown = (arch === "rome" || arch === "paris");
      treePos.forEach(function (tp, idx) {
        var gy = terrainY(tp.x, tp.z);
        dummy.position.set(tp.x, gy + 1.4 * tp.s, tp.z);
        dummy.rotation.set(0, tp.rot, 0); dummy.scale.setScalar(tp.s); dummy.updateMatrix();
        trunkInst.setMatrixAt(idx, dummy.matrix);
        for (var ci3 = 0; ci3 < 3; ci3++) {
          dummy.position.set(tp.x + Math.sin(idx * 2.1 + ci3 * 2.4) * 0.62 * tp.s,
            gy + (3.1 + (ci3 % 2) * 0.85) * tp.s, tp.z + Math.cos(idx * 1.7 + ci3 * 2.4) * 0.62 * tp.s);
          dummy.scale.set(tp.s * (1.05 - ci3 * 0.16), tp.s * (tallCrown ? 1.75 - ci3 * 0.2 : 1.0 - ci3 * 0.1), tp.s * (1.05 - ci3 * 0.16));
          dummy.rotation.set(idx + ci3, idx * 1.3 + ci3 * 2.0, 0); dummy.updateMatrix();
          crownInsts[ci3].setMatrixAt(idx, dummy.matrix);
        }
      });
      trunkInst.castShadow = true; scene.add(trunkInst);
      crownInsts.forEach(function (ci4) { ci4.castShadow = true; scene.add(ci4); });

      /* 草むら・花・岩のインスタンシングで平坦な色面を崩す */
      function scatterInst(geo, mat, n, sy0, sy1, rMax) {
        var inst = new THREE.InstancedMesh(geo, mat, n), placed = 0, g2 = 0;
        while (placed < n && g2++ < n * 30) {
          var a3 = rnd() * Math.PI * 2, r3 = 6 + rnd() * (rMax || 84);
          var x3 = Math.cos(a3) * r3, z4 = Math.sin(a3) * r3;
          if (isInPond(x3, z4)) continue;
          if (Math.abs(x3) < 9.5 && z4 > -54 && z4 < 36) continue; /* v4.4: 街路コリドー除外 */
          if (Math.hypot(x3, z4 - 10) < 15.5) continue; /* v4.4: 広場除外 */
          dummy.position.set(x3, terrainY(x3, z4) + sy0, z4);
          dummy.rotation.set((rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.5);
          var sc3 = sy1 * (0.6 + rnd() * 0.9); dummy.scale.set(sc3, sc3, sc3); dummy.updateMatrix();
          inst.setMatrixAt(placed++, dummy.matrix);
        }
        inst.count = placed; scene.add(inst); return inst;
      }
      scatterInst(new THREE.ConeGeometry(0.34, 0.85, 6), new THREE.MeshStandardMaterial({ color: 0x2c6e35, roughness: 0.9 }), 260, 0.3, 1.0);
      scatterInst(new THREE.ConeGeometry(0.26, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0x4c8a3f, roughness: 0.9 }), 200, 0.22, 0.9);
      scatterInst(new THREE.SphereGeometry(0.13, 6, 5), new THREE.MeshBasicMaterial({ color: THEME.petalColor }), 130, 0.32, 1.0);
      var rockInst = scatterInst(new THREE.DodecahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: 0x777d84, roughness: 0.95 }), 46, 0.18, 1.3);
      rockInst.castShadow = true;

      /* 遠景の山影リング（平坦な地平線をシルエットで割る） */
      var mtnCol = new THREE.Color(THEME.fogColor).lerp(new THREE.Color(0x8fa4c8), 0.45);
      var mtnMat = new THREE.MeshBasicMaterial({ color: mtnCol });
      for (var mi = 0; mi < 15; mi++) {
        var ma = (mi / 15) * Math.PI * 2 + rnd() * 0.2;
        var mr = 148 + rnd() * 42, mh = 17 + rnd() * 24;
        var mtn = new THREE.Mesh(new THREE.ConeGeometry(20 + rnd() * 16, mh, 5), mtnMat);
        mtn.position.set(Math.cos(ma) * mr, mh * 0.28, Math.sin(ma) * mr);
        mtn.rotation.y = rnd() * Math.PI; scene.add(mtn); v44count++;
      }
      /* 地平の霞グラデーション（空と地面の境界を柔らかく繋ぐ円筒） */
      (function hazeBand() {
        var cv = document.createElement("canvas"); cv.width = 4; cv.height = 256;
        var cx = cv.getContext("2d");
        var hor = new THREE.Color(THEME.skyHor[0], THEME.skyHor[1], THEME.skyHor[2]);
        var grd = cx.createLinearGradient(0, 0, 0, 256);
        var rgb = Math.floor(hor.r * 255) + "," + Math.floor(hor.g * 255) + "," + Math.floor(hor.b * 255);
        grd.addColorStop(0, "rgba(" + rgb + ",0)");
        grd.addColorStop(0.72, "rgba(" + rgb + ",0.10)");
        grd.addColorStop(1, "rgba(" + rgb + ",0.5)");
        cx.fillStyle = grd; cx.fillRect(0, 0, 4, 256);
        var tx = new THREE.CanvasTexture(cv);
        var hz = new THREE.Mesh(new THREE.CylinderGeometry(335, 335, 110, 32, 1, true),
          new THREE.MeshBasicMaterial({ map: tx, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false }));
        hz.position.y = 18; scene.add(hz);
      })();
      /* 霧を僅かに抜いて遠景建築のシルエットが立つようにする（濃霧の色面化を回避） */
      if (scene.fog && scene.fog.isFogExp2) scene.fog.density = 0.0034;
      dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
      window.__V44 = { added: v44count, trees: treePos.length, arch: arch };
    })();

    /* =========================================================================
       第3部：インタラクティブ施設・運命の祠・神話試練祭壇・決戦の門
       ========================================================================= */

    /* ================= v4.4 拠点の街並み（メインストリート＋建築キット＋小物＋散布物） ================= */
    (function buildTownV44() {
      var arch = (THEME.archType === 'olympus') ? 'olympus_sky' : THEME.archType;
      var stoneMatT = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92, metalness: 0.04 });
      var marbMatT = new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.4, metalness: 0.06 });
      var goldMatT = new THREE.MeshStandardMaterial({ color: 0xffcf56, roughness: 0.26, metalness: 0.85 });
      var added = 0;
      function bx(parent, w, h, d, mat, x, y, z, ry, rz) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z); if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
        m.castShadow = true; m.receiveShadow = true; parent.add(m); added++; return m;
      }
      function cyl(parent, rt, rb, h, seg, mat, x, y, z) {
        var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
        m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); added++; return m;
      }
      function stdMat(c, r, m2) { return new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.85 : r, metalness: m2 || 0.03 }); }
      /* 反りのある切妻屋根（プロファイル押し出し） */
      function gableRoof(w, d, h, mat, ridgeMat, sori) {
        var g = new THREE.Group();
        var sh = new THREE.Shape();
        sh.moveTo(-w / 2, 0);
        if (sori) { sh.quadraticCurveTo(-w * 0.2, h * 0.95, 0, h); sh.quadraticCurveTo(w * 0.2, h * 0.95, w / 2, 0); }
        else { sh.lineTo(0, h); sh.lineTo(w / 2, 0); }
        sh.lineTo(w / 2 - 0.3, -0.26); sh.lineTo(-w / 2 + 0.3, -0.26); sh.closePath();
        var geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
        geo.translate(0, 0, -d / 2);
        var slab = new THREE.Mesh(geo, mat); slab.castShadow = true; slab.receiveShadow = true; g.add(slab); added++;
        var ridge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, d * 0.94), ridgeMat || mat);
        ridge.position.y = h + 0.05; ridge.castShadow = true; g.add(ridge); added++;
        return g;
      }
      /* ---------- メインストリート（地形追従リボン）＋広場 ---------- */
      /* v4.4: 明るい石畳テクスチャを自前生成（従来 stoneTex は暗くアスファルトに見えた） */
      var pavCanvas = document.createElement('canvas'); pavCanvas.width = pavCanvas.height = 256;
      var pcx = pavCanvas.getContext('2d');
      pcx.fillStyle = '#8f887a'; pcx.fillRect(0, 0, 256, 256);
      var pavRnd = 1234; function pavRand() { pavRnd = (pavRnd * 16807) % 2147483647; return pavRnd / 2147483647; }
      for (var py = 0; py < 4; py++) for (var px2 = 0; px2 < 4; px2++) {
        var sh = 148 + Math.floor(pavRand() * 26) - 8;
        pcx.fillStyle = 'rgb(' + sh + ',' + (sh - 6) + ',' + (sh - 22) + ')';
        pcx.fillRect(px2 * 64 + 3, py * 64 + 3, 58, 58);
        pcx.fillStyle = 'rgba(255,255,255,0.05)'; pcx.fillRect(px2 * 64 + 3, py * 64 + 3, 58, 10);
      }
      for (var sp = 0; sp < 2600; sp++) {
        var sv = Math.floor(pavRand() * 60) - 30;
        pcx.fillStyle = 'rgba(' + (140 + sv) + ',' + (134 + sv) + ',' + (118 + sv) + ',0.25)';
        pcx.fillRect(Math.floor(pavRand() * 256), Math.floor(pavRand() * 256), 2, 2);
      }
      var streetTex = new THREE.CanvasTexture(pavCanvas);
      streetTex.wrapS = streetTex.wrapT = THREE.RepeatWrapping; streetTex.repeat.set(1, 1);
      var streetMat = new THREE.MeshStandardMaterial({ map: streetTex, roughness: 0.95, metalness: 0.02, side: THREE.DoubleSide });
      var edgeMat = stdMat(0x3f4448, 0.95); edgeMat.side = THREE.DoubleSide;
      function ribbon(pts, width, mat, yOff, uvScale) {
        var pos = [], uv = [], idx = [], dist = 0;
        for (var i = 0; i < pts.length; i++) {
          var pt = pts[i];
          var pn = pts[Math.min(pts.length - 1, i + 1)], pp = pts[Math.max(0, i - 1)];
          var vx = pn[0] - pp[0], vz = pn[1] - pp[1]; var vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
          var qx = vz, qz = -vx;
          if (i > 0) dist += Math.hypot(pt[0] - pp[0], pt[1] - pp[1]);
          var hw = width / 2;
          var y1 = terrainY(pt[0] - qx * hw, pt[1] - qz * hw) + yOff, y2 = terrainY(pt[0] + qx * hw, pt[1] + qz * hw) + yOff;
          pos.push(pt[0] - qx * hw, y1, pt[1] - qz * hw, pt[0] + qx * hw, y2, pt[1] + qz * hw);
          uv.push(0, dist / (uvScale || 4), 1, dist / (uvScale || 4));
          if (i < pts.length - 1) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        var m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); added++;
        return m;
      }
      function densify(pts, step) { var out = [pts[0]]; for (var di = 1; di < pts.length; di++) { var a = pts[di - 1], b = pts[di]; var dd = Math.hypot(b[0] - a[0], b[1] - a[1]); var nn = Math.max(1, Math.round(dd / step)); for (var dj = 1; dj <= nn; dj++) out.push([a[0] + (b[0] - a[0]) * dj / nn, a[1] + (b[1] - a[1]) * dj / nn]); } return out; }
      var mainPts = densify([[0, 32], [1.2, 18], [-1.2, 2], [0.8, -14], [-0.8, -30], [0, -46]], 3.5);
      ribbon(mainPts, 7.6, streetMat, 0.16, 4);
      ribbon(mainPts, 8.7, edgeMat, 0.13, 4);
      var crossPts = densify([[-32, 10.5], [-14, 11.2], [0, 10], [14, 9.4], [32, 10.2]], 3.5);
      ribbon(crossPts, 6.0, streetMat, 0.15, 4);
      var plaza = new THREE.Mesh(new THREE.CircleGeometry(13.5, 36), streetMat);
      plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, terrainY(0, 10) + 0.06, 10); plaza.receiveShadow = true; scene.add(plaza); added++;
      var plazaRing = new THREE.Mesh(new THREE.TorusGeometry(13.5, 0.3, 6, 40), edgeMat);
      plazaRing.rotation.x = Math.PI / 2; plazaRing.position.set(0, terrainY(0, 10) + 0.1, 10); scene.add(plazaRing); added++;

      /* ---------- 建築キット ---------- */
      var PAL = {
        kyoto:    { wall: 0x54402a, wall2: 0xe9e1cd, timber: 0x2e2015, roof: 0x39424f, roofR: 0x232833, accent: 0x2a3a6e, glass: 0xffca7a, sori: true, roofH: 1.35 },
        edo:      { wall: 0x2a2c34, wall2: 0xdcd6c4, timber: 0x17181e, roof: 0x1d2027, roofR: 0xffcf56, accent: 0x8e1f1f, glass: 0xffb45e, sori: true, roofH: 1.45 },
        paris:    { wall: 0xefe6d0, wall2: 0xe6dcc4, timber: 0x4a3421, roof: 0xb5651d, roofR: 0x8a4a16, accent: 0x51643c, glass: 0xbfd9e8, sori: false, roofH: 2.5 },
        rome:     { wall: 0xc9ab7d, wall2: 0xbf9d6c, timber: 0x8a6a42, roof: 0xa8542f, roofR: 0x7e3c20, accent: 0x74552e, glass: 0xbfd9e8, sori: false, roofH: 0.95 },
        america:  { wall: 0xe8e4da, wall2: 0x9db3c0, timber: 0x5a4632, roof: 0x5a5f66, roofR: 0x3c4046, accent: 0x8e3324, glass: 0xbfd9e8, sori: false, roofH: 1.7 },
        olympus_sky: { wall: 0xf2ede0, wall2: 0xe9e2cf, timber: 0xc9a227, roof: 0xffcf56, roofR: 0xc9a227, accent: 0xfff2b0, glass: 0xd8ecff, sori: false, roofH: 1.1 }
      };
      var P = PAL[arch] || PAL.kyoto;
      var wallM = stdMat(P.wall, 0.88), wall2M = stdMat(P.wall2, 0.85), timbM = stdMat(P.timber, 0.8),
          roofM = stdMat(P.roof, 0.6, 0.15), roofRM = stdMat(P.roofR, 0.55, 0.2),
          accM = stdMat(P.accent, 0.7), glassM = new THREE.MeshStandardMaterial({ color: P.glass, roughness: 0.18, metalness: 0.25, emissive: P.glass, emissiveIntensity: (arch === 'kyoto' || arch === 'edo') ? 0.35 : 0.06 });
      function buildHouse(w, d, h, variant) {
        var g = new THREE.Group();
        bx(g, w + 0.35, 0.55, d + 0.35, stoneMatT, 0, 0.27, 0);                    // 石の基壇
        bx(g, w, h, d, variant % 2 ? wall2M : wallM, 0, 0.55 + h / 2, 0);          // 壁
        var fz = d / 2;
        if (arch !== 'olympus_sky') {
          // 木組み: 柱・梁（前面）
          [-1, 1].forEach(function (sx) { bx(g, 0.2, h, 0.2, timbM, sx * (w / 2 - 0.1), 0.55 + h / 2, fz + 0.03); });
          bx(g, w, 0.22, 0.14, timbM, 0, 0.55 + h - 0.12, fz + 0.03);
          bx(g, w, 0.2, 0.14, timbM, 0, 0.55 + 0.35, fz + 0.03);
          if (arch === 'paris') { // ハーフティンバーの斜材
            bx(g, 0.16, h * 0.92, 0.12, timbM, -w * 0.22, 0.55 + h / 2, fz + 0.04, 0, 0.62);
            bx(g, 0.16, h * 0.92, 0.12, timbM, w * 0.22, 0.55 + h / 2, fz + 0.04, 0, -0.62);
          }
          // 窓（枠＋格子＋ガラス）
          var nWin = w > 6.4 ? 3 : 2;
          for (var wi = 0; wi < nWin; wi++) {
            var wx = (wi - (nWin - 1) / 2) * (w / (nWin + 0.6));
            if (Math.abs(wx) < 0.85) continue; // 扉と重なる窓は省略
            bx(g, 0.98, 1.15, 0.1, timbM, wx, 0.55 + h * 0.58, fz + 0.04);
            bx(g, 0.78, 0.95, 0.12, glassM, wx, 0.55 + h * 0.58, fz + 0.05);
            bx(g, 0.07, 0.95, 0.13, timbM, wx, 0.55 + h * 0.58, fz + 0.06);
            bx(g, 0.78, 0.07, 0.13, timbM, wx, 0.55 + h * 0.58, fz + 0.06);
          }
          // 扉＋暖簾/看板
          bx(g, 1.0, 1.95, 0.12, timbM, 0, 0.55 + 0.98, fz + 0.04);
          if (arch === 'kyoto' || arch === 'edo') {
            bx(g, 1.45, 0.6, 0.07, accM, 0, 0.55 + 2.28, fz + 0.16);
            cyl(g, 0.045, 0.045, 1.6, 6, timbM, 0, 0.55 + 2.62, fz + 0.16).rotation.z = Math.PI / 2;
          } else {
            bx(g, 0.55, 1.15, 0.09, accM, w / 2 - 0.75, 0.55 + 1.7, fz + 0.06); // 看板
          }
          // 提灯（京都/江戸） or 街灯ポスト（他）
          var lx = w / 2 + 0.55;
          cyl(g, 0.06, 0.08, 2.5, 6, timbM, lx, 1.25, fz + 0.4);
          var lamp = bx(g, 0.34, 0.44, 0.34, glassM, lx, 2.62, fz + 0.4);
          lamp.material = glassM;
        } else {
          // 神域: 列柱＋ペディメントのパビリオン
          for (var ci = -1; ci <= 1; ci++) cyl(g, 0.22, 0.26, h, 10, marbMatT, ci * (w / 2 - 0.5), 0.55 + h / 2, fz - 0.3);
          bx(g, w + 0.6, 0.35, d + 0.4, goldMatT, 0, 0.55 + h + 0.15, 0);
        }
        var rf = gableRoof(w + 1.7, d + 1.5, P.roofH * (0.9 + (variant % 3) * 0.12), roofM, roofRM, P.sori);
        rf.position.y = 0.55 + h; g.add(rf);
        if (arch === 'paris' || arch === 'america' || arch === 'rome') {
          bx(g, 0.55, 1.25, 0.55, arch === 'america' ? stdMat(0x7a4436, 0.9) : stoneMatT, w * 0.26, 0.55 + h + P.roofH * 0.45, 0); // 煙突
        }
        return g;
      }
      /* 建物列: 参道の両側（施設・池・バンカー・ランドマークを避ける） */
      var exclusions = [[-38, -38, 12], [0, -72, 17], [0, -70, 17], [-42, -45, 13], [0, -80, 15], [20, 34, 10], [-24, 40, 8], [26, -18, 15], [-32, 22, 13], [0, -52, 8], [-11, 8, 5], [11, 8, 5], [0, 14, 5]];
      function blocked(x, z) {
        for (var i = 0; i < exclusions.length; i++) if (Math.hypot(x - exclusions[i][0], z - exclusions[i][1]) < exclusions[i][2]) return true;
        for (var j = 0; j < PONDS.length; j++) if (Math.hypot(x - PONDS[j].x, z - PONDS[j].z) < PONDS[j].r + 5) return true;
        for (var k = 0; k < BUNKERS.length; k++) if (Math.hypot(x - BUNKERS[k].x, z - BUNKERS[k].z) < BUNKERS[k].r + 4) return true;
        return false;
      }
      var seedT = 4242;
      var rndT = function () { seedT = (seedT * 1103515245 + 12345) & 0x7fffffff; return seedT / 0x7fffffff; };
      var slots = [];
      for (var zi = 0; zi < 9; zi++) slots.push(25 - zi * 8.3);
      slots.forEach(function (z, si) {
        [-1, 1].forEach(function (side) {
          if (rndT() < 0.22) return; // 抜けを作る
          var w = 5.6 + rndT() * 2.2, d = 4.6 + rndT() * 1.4, h = 3.1 + rndT() * 1.3;
          var x = side * (6.6 + d / 2);
          var zz = z + (rndT() - 0.5) * 1.6;
          if (blocked(x, zz)) return;
          var house = buildHouse(w, d, h, si * 2 + (side > 0 ? 1 : 0));
          house.position.set(x, terrainY(x, zz), zz);
          house.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          scene.add(house);
        });
      });
      /* 横丁の建物（広場の東西） */
      [-24, 24].forEach(function (x, hi) {
        if (blocked(x, 17)) return;
        var house = buildHouse(6.4, 5.0, 3.5, hi + 5);
        house.position.set(x, terrainY(x, 17), 17);
        house.rotation.y = x > 0 ? Math.PI : 0;
        scene.add(house);
      });

      /* ---------- エリア固有の小物・ビスタ ---------- */
      if (arch === 'kyoto' || arch === 'edo') {
        var sakuraM = [stdMat(0xf2b8c6, 0.95), stdMat(0xeaa0b4, 0.95), stdMat(0xf6ccd6, 0.95)];
        var trunkMS = stdMat(0x3a2a1c, 0.95);
        [[-6.9, 20], [6.9, 2], [-6.9, -16], [6.9, -34]].forEach(function (sp, i2) {
          var tg = new THREE.Group();
          var tr = cyl(tg, 0.16, 0.3, 2.6, 7, trunkMS, 0, 1.3, 0); tr.rotation.z = (i2 % 2 ? -0.1 : 0.12);
          for (var k2 = 0; k2 < 3; k2++) {
            var cl2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 - k2 * 0.25, 1), sakuraM[(i2 + k2) % 3]);
            cl2.position.set((rndT() - 0.5) * 1.6, 2.9 + k2 * 0.7, (rndT() - 0.5) * 1.6);
            cl2.castShadow = true; tg.add(cl2); added++;
          }
          tg.position.set(sp[0], terrainY(sp[0], sp[1]), sp[1]); scene.add(tg);
        });
        // 石灯籠（参道わき）
        for (var li = 0; li < 6; li++) {
          var lz = 22 - li * 13, lx2 = (li % 2 ? 5.4 : -5.4);
          var lg = new THREE.Group();
          bx(lg, 0.52, 0.22, 0.52, stoneMatT, 0, 0.11, 0);
          cyl(lg, 0.1, 0.13, 0.85, 8, stoneMatT, 0, 0.62, 0);
          bx(lg, 0.44, 0.36, 0.44, stoneMatT, 0, 1.2, 0);
          bx(lg, 0.3, 0.2, 0.3, glassM, 0, 1.2, 0);
          var cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.34, 4), stoneMatT);
          cap.rotation.y = Math.PI / 4; cap.position.y = 1.52; cap.castShadow = true; lg.add(cap); added++;
          var jewel = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), stoneMatT); jewel.position.y = 1.76; lg.add(jewel); added++;
          lg.position.set(lx2, terrainY(lx2, lz), lz); scene.add(lg);
        }
        // 石垣＋生垣（東側の擁壁）
        for (var wi2 = 0; wi2 < 3; wi2++) bx(scene, 1.1, 0.5, 34, stoneMatT, 13.8, terrainY(13.8, -2) + 0.25 + wi2 * 0.48, -2);
        bx(scene, 1.3, 0.8, 34, stdMat(0x1d4d22, 0.95), 13.8, terrainY(13.8, -2) + 1.85, -2);
      }
      if (arch === 'paris') {
        // 街の塔（ビスタ）: 石の円塔＋円錐屋根
        var tw = new THREE.Group();
        cyl(tw, 2.0, 2.4, 10.5, 14, stoneMatT, 0, 5.25, 0);
        var trf = new THREE.Mesh(new THREE.ConeGeometry(3.0, 4.4, 14), stdMat(0x46586e, 0.55, 0.3));
        trf.position.y = 12.6; trf.castShadow = true; tw.add(trf); added++;
        bx(tw, 0.7, 1.1, 0.2, glassM, 0, 7.6, 2.25);
        bx(tw, 0.7, 1.1, 0.2, glassM, 0, 4.6, 2.32);
        tw.position.set(-13.5, terrainY(-13.5, -38), -38); scene.add(tw);
      }
      if (arch === 'rome') {
        var cypM = stdMat(0x14401c, 0.95), trkM = stdMat(0x4a3421, 0.9);
        [[-6.8, 14], [6.8, -6], [-6.8, -24], [6.8, -40]].forEach(function (cp) {
          var cg2 = new THREE.Group();
          cyl(cg2, 0.09, 0.14, 1.0, 6, trkM, 0, 0.5, 0);
          var cone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), cypM);
          cone.scale.set(1, 3.1, 1); cone.position.y = 3.4; cone.castShadow = true; cg2.add(cone); added++;
          cg2.position.set(cp[0], terrainY(cp[0], cp[1]), cp[1]); scene.add(cg2);
        });
      }
      if (arch === 'america') {
        // 星条旗ポール（広場）
        var fp = new THREE.Group();
        cyl(fp, 0.07, 0.1, 9.4, 8, stdMat(0xd8d8d8, 0.4, 0.6), 0, 4.7, 0);
        var flag = bx(fp, 2.3, 1.35, 0.06, stdMat(0xb22234, 0.8), 1.2, 8.5, 0);
        bx(fp, 0.95, 0.72, 0.07, stdMat(0x3c3b6e, 0.8), 0.55, 8.82, 0);
        fp.position.set(6.5, terrainY(6.5, 17), 17); scene.add(fp);
        // 給水塔
        var wt = new THREE.Group();
        [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(function (lg2) { bx(wt, 0.22, 6.4, 0.22, trkM2(), lg2[0], 3.2, lg2[1]); });
        function trkM2() { return stdMat(0x5a4632, 0.9); }
        cyl(wt, 2.5, 2.5, 3.4, 12, stdMat(0x8e6b42, 0.85), 0, 8.1, 0);
        var wtc = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.7, 12), stdMat(0x5a5f66, 0.6));
        wtc.position.y = 10.6; wtc.castShadow = true; wt.add(wtc); added++;
        wt.position.set(-21, terrainY(-21, -28), -28); scene.add(wt);
      }

      /* ---------- 池・バンカーの縁処理 ---------- */
      PONDS.forEach(function (pd) {
        var mud = new THREE.Mesh(new THREE.RingGeometry(pd.r - 0.4, pd.r + 2.6, 36), stdMat(0x44502f, 1));
        mud.rotation.x = -Math.PI / 2;
        mud.position.set(pd.x, terrainY(pd.x, pd.z) + 1.50, pd.z);
        mud.receiveShadow = true; scene.add(mud); added++;
        for (var si2 = 0; si2 < 14; si2++) {
          var an = (si2 / 14) * Math.PI * 2 + rndT() * 0.3;
          var sx = pd.x + Math.cos(an) * (pd.r + 1.1), sz = pd.z + Math.sin(an) * (pd.r + 1.1);
          var st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + rndT() * 0.4, 0), stoneMatT);
          st.scale.y = 0.55; st.position.set(sx, terrainY(sx, sz) + 0.12, sz); st.rotation.y = rndT() * 3;
          st.castShadow = true; scene.add(st); added++;
        }
      });
      BUNKERS.forEach(function (bk) {
        var lip = new THREE.Mesh(new THREE.TorusGeometry(bk.r, 0.34, 7, 26), stdMat(0x8a6f3c, 1));
        lip.rotation.x = Math.PI / 2; lip.scale.set(1, 1, 0.55);
        lip.position.set(bk.x, terrainY(bk.x, bk.z) + 0.10, bk.z);
        scene.add(lip); added++;
        var inner = new THREE.Mesh(new THREE.CircleGeometry(bk.r * 0.97, 26), stdMat(0xb99c62, 1));
        inner.rotation.x = -Math.PI / 2;
        inner.position.set(bk.x, terrainY(bk.x, bk.z) + 0.045, bk.z);
        scene.add(inner); added++;
      });

      /* ---------- 散布物（茂み・岩・草むら）InstancedMesh ---------- */
      var dummy = new THREE.Object3D();
      var bushGeo = new THREE.IcosahedronGeometry(0.75, 1);
      var bushMat = stdMat(0xffffff, 0.95); bushMat.flatShading = true;
      var bushN = window.innerWidth < 820 ? 90 : 150;
      var bushes = new THREE.InstancedMesh(bushGeo, bushMat, bushN);
      var bushCols = [new THREE.Color(0x1d4d22), new THREE.Color(0x27632a), new THREE.Color(0x2e7030), new THREE.Color(0x1a421e)];
      var placedB = 0, guardB = 0;
      while (placedB < bushN && guardB++ < 900) {
        var a2 = rndT() * Math.PI * 2, rr2 = 13 + rndT() * 76;
        var bx3 = Math.cos(a2) * rr2, bz3 = Math.sin(a2) * rr2;
        if (Math.abs(bx3) < 8.6 && bz3 > -52 && bz3 < 34) continue;
        if (blocked(bx3, bz3)) continue;
        dummy.position.set(bx3, terrainY(bx3, bz3) + 0.25, bz3);
        dummy.scale.set(0.7 + rndT() * 1.1, 0.5 + rndT() * 0.6, 0.7 + rndT() * 1.1);
        dummy.rotation.set(0, rndT() * 3, 0); dummy.updateMatrix();
        bushes.setMatrixAt(placedB, dummy.matrix);
        bushes.setColorAt(placedB, bushCols[Math.floor(rndT() * 4)]);
        placedB++;
      }
      bushes.count = placedB; if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
      bushes.castShadow = true; scene.add(bushes); added++;
      var rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
      var rockMat = stdMat(0x777268, 0.95); rockMat.flatShading = true;
      var rockN = window.innerWidth < 820 ? 36 : 60;
      var rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockN);
      var placedR = 0; guardB = 0;
      while (placedR < rockN && guardB++ < 700) {
        var a3 = rndT() * Math.PI * 2, rr3 = 15 + rndT() * 74;
        var rx3 = Math.cos(a3) * rr3, rz3 = Math.sin(a3) * rr3;
        if (Math.abs(rx3) < 8.6 && rz3 > -52 && rz3 < 34) continue;
        if (blocked(rx3, rz3)) continue;
        dummy.position.set(rx3, terrainY(rx3, rz3) + 0.12, rz3);
        dummy.scale.set(0.6 + rndT() * 1.3, 0.5 + rndT() * 0.8, 0.6 + rndT() * 1.3);
        dummy.rotation.set(rndT(), rndT() * 3, rndT()); dummy.updateMatrix();
        rocks.setMatrixAt(placedR, dummy.matrix);
        placedR++;
      }
      rocks.count = placedR; rocks.castShadow = true; scene.add(rocks); added++;
      window.__TOWN44 = { added: added, bushes: placedB, rocks: placedR };
    })();

    var LANDMARKS = [];
    var subTrialTargetMesh = null;
    var duelGateGroup = null, duelPortalMesh = null;

    (function buildFacilities() {
      var goldMat = new THREE.MeshStandardMaterial({ color: 0xffd466, roughness: 0.25, metalness: 0.85, emissive: 0x553800 });
      var cyanMat = new THREE.MeshStandardMaterial({ color: 0x5ce1e6, roughness: 0.2, metalness: 0.6, emissive: 0x104555 });
      var purpMat = new THREE.MeshStandardMaterial({ color: 0xb589ff, roughness: 0.3, metalness: 0.5, emissive: 0x321055 });

      function addBeaconSpot(x, z, colorHex, label, radius, action) {
        var g = new THREE.Group();
        var y = terrainY(x, z);
        var ped = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.85, 0.55, 20),
          new THREE.MeshStandardMaterial({ color: 0x222742, roughness: 0.4, metalness: 0.5 }));
        ped.position.y = 0.28;
        var ring = new THREE.Mesh(new THREE.RingGeometry(1.75, 2.1, 32),
          new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1;
        var crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 0),
          new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.8 }));
        crystal.position.y = 2.1;
        g.add(ped, ring, crystal);
        g.position.set(x, y, z);
        scene.add(g);
        var lm = { x: x, z: z, r: radius || 3.6, label: label, color: colorHex, crystal: crystal, action: action };
        LANDMARKS.push(lm);
        return lm;
      }

      /* 3大拠点（中央広場周辺） */
      addBeaconSpot(-11, 8, 0xffd875, "🏠 クラブハウス（全回復・新聞ヒント・セーブ）", 3.8, { type: "facility", facility: "clubhouse" });
      addBeaconSpot(11, 8, 0x44e587, "🛍 プロショップ（全11枠ギア・ボール購入）", 3.8, { type: "facility", facility: "proshop" });
      addBeaconSpot(0, 14, 0xb589ff, "🍸 19番ホール（モイライの織物・ビンゴ・図鑑）", 3.8, { type: "facility", facility: "hole19" });

      /* 運命の岐路①・② ＆ ノクスの誘惑オベリスク（エリア0〜4） */
      if (AREA_IDX <= 4) {
        addBeaconSpot(-24, -10, 0x7ee8fa, "⚖ 運命の岐路①の祠を調べる", 3.8, { type: "branch", eventKey: "b1" });
        addBeaconSpot(22, 14, 0x7ee8fa, "⚖ 運命の岐路②の碑を調べる", 3.8, { type: "branch", eventKey: "b2" });
        addBeaconSpot(-14, -34, 0xff4d6d, "🌑 ノクスの囁き（誘惑の黒碑）に触れる", 3.8, { type: "branch", eventKey: "tempt" });
      }

      /* 神話のサブ試練祭壇（池越えの波動ターゲットクリスタル！ 波動ショットを当てるか接近で達成） */
      var stX = 26, stZ = -18; // 第1の池の中央上空に浮かぶ神話クリスタル！
      var stY = terrainY(stX, stZ) + 3.4;
      subTrialTargetMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.35, 0),
        cyanMat
      );
      subTrialTargetMesh.position.set(stX, stY, stZ);
      scene.add(subTrialTargetMesh);
      var pillarBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 18, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x5ce1e6, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
      );
      pillarBeam.position.set(stX, stY + 6, stZ);
      scene.add(pillarBeam);
      subTrialTargetMesh.userData.beam = pillarBeam;
      addBeaconSpot(13, -15, 0x5ce1e6, "⚡ 神話の試練祭壇（池上の蒼き結晶を波動ショットで射抜け！）", 3.6, { type: "subtrial_hint" });

      /* 北端：決戦の門（Gate of Duel） */
      duelGateGroup = new THREE.Group();
      var gx = 0, gz = -52, gy = terrainY(gx, gz);
      var p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 8.2, 16), goldMat);
      var p2 = p1.clone();
      p1.position.set(-3.8, 4.1, 0);
      p2.position.set(3.8, 4.1, 0);
      var arch = new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.1, 1.4), goldMat);
      arch.position.y = 8.4;
      duelPortalMesh = new THREE.Mesh(
        new THREE.CircleGeometry(3.5, 32),
        new THREE.MeshBasicMaterial({ color: 0xffd875, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
      );
      duelPortalMesh.position.y = 4.2;
      duelGateGroup.add(p1, p2, arch, duelPortalMesh);
      duelGateGroup.position.set(gx, gy, gz);
      scene.add(duelGateGroup);
      LANDMARKS.push({ x: gx, z: gz, r: 4.6, label: "⛳ 決戦の門（ゴルフ真剣勝負へ挑む！）", color: 0xff4d5a, isGate: true, action: { type: "duel" } });
      /* v4.4: ビーコンの浮遊クリスタルに光柱と石の基壇リングを与え「祠ビーコン」として接地させる */
      LANDMARKS.forEach(function (lm) {
        if (!lm.crystal) return;
        var gy2 = terrainY(lm.x, lm.z);
        var pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.34, 1.65, 10, 1, true),
          new THREE.MeshBasicMaterial({ color: lm.color, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false }));
        pillar.position.set(lm.x, gy2 + 1.28, lm.z); scene.add(pillar);
        var bring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.13, 6, 26),
          new THREE.MeshStandardMaterial({ color: 0x4c4e56, roughness: 0.9 }));
        bring.rotation.x = Math.PI / 2; bring.position.set(lm.x, gy2 + 0.14, lm.z); scene.add(bring);
        for (var bs2 = 0; bs2 < 4; bs2++) {
          var an2 = bs2 * Math.PI / 2 + 0.4;
          var bst = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0),
            new THREE.MeshStandardMaterial({ color: 0x5a5c60, roughness: 0.95 }));
          bst.position.set(lm.x + Math.cos(an2) * 2.0, gy2 + 0.1, lm.z + Math.sin(an2) * 2.0);
          scene.add(bst);
        }
      });
    })();

    /* 人型3Dゴルファーメッシュ構築（主人公＆残影30名の個別帽子・眼鏡・衣装完全対応） */
    /* 人型ゴルファー構築（商用品質アップグレード： PBR多関節ボーン階層＋Canvas柄シャツ＋立体造形の顔・帽子） */
    var GOLFER_RIGS = [];
    function golferShirtTexture(kind, baseHex) {
      try {
        var cv = document.createElement("canvas"); cv.width = cv.height = 512;
        var cx = cv.getContext("2d"); cx.scale(4, 4);
        cx.fillStyle = baseHex; cx.fillRect(0, 0, 128, 128);
        cx.strokeStyle = "rgba(255,255,255,0.35)"; cx.lineWidth = 5;
        if (kind === "argyle") {
          cx.save(); cx.translate(64, 64); cx.rotate(Math.PI / 4);
          for (var i = -3; i <= 3; i++) { cx.beginPath(); cx.moveTo(i * 30, -110); cx.lineTo(i * 30, 110); cx.stroke(); cx.beginPath(); cx.moveTo(-110, i * 30); cx.lineTo(110, i * 30); cx.stroke(); }
          cx.restore();
        } else if (kind === "check") {
          cx.fillStyle = "rgba(255,255,255,0.20)";
          for (var j = 0; j < 4; j++) { cx.fillRect(0, j * 32, 128, 7); cx.fillRect(j * 32, 0, 7, 128); }
        } else {
          cx.fillStyle = "rgba(255,255,255,0.30)";
          for (var k = 0; k < 4; k++) cx.fillRect(0, 12 + k * 32, 128, 6);
        }
        cx.fillStyle = "rgba(0,0,0,0.16)"; cx.fillRect(0, 108, 128, 20);
        var tx = new THREE.CanvasTexture(cv);
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 1);
        return tx;
      } catch (e) { return null; }
    }
    function buildGolferMesh(opts) {
      var g = new THREE.Group();
      var sc = opts.scale || 1.0;
      var baseCol = "#" + (opts.shirt >>> 0).toString(16).padStart(6, "0");
      var pattern = opts.pattern || (opts.acc === "argyle" ? "argyle" : (opts.acc === "goldpin" ? "check" : "stripe"));
      var shirtTex = golferShirtTexture(pattern, baseCol);
      var shirtMat = new THREE.MeshStandardMaterial({ color: opts.shirt, roughness: 0.62, map: shirtTex || null });
      var pantsMat = new THREE.MeshStandardMaterial({ color: opts.pants, roughness: 0.72 });
      var skinMat = new THREE.MeshStandardMaterial({ color: opts.skin || 0xeab98e, roughness: 0.58 });
      var side = (opts.acc === "lefty") ? -1 : 1;

      /* 脚：股関節→膝→足首の3関節＋ツートンシューズ */
      var shoeCol = (opts.acc === "twotone") ? 0xffffff : 0x1b1e28;
      var shoeMat = new THREE.MeshStandardMaterial({ color: shoeCol, roughness: 0.4 });
      var toeMat = new THREE.MeshStandardMaterial({ color: (opts.acc === "twotone") ? (opts.cap !== undefined ? opts.cap : 0x8b1e24) : 0x0c0e14, roughness: 0.35 });
      var legPivots = [], kneePivots = [], anklePivots = [];
      [-0.22, 0.22].forEach(function (lx) {
        var lp = new THREE.Group(); lp.position.set(lx, 1.15, 0);
        var thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.12, 0.60, 10), pantsMat);
        thigh.position.y = -0.30; thigh.castShadow = true; lp.add(thigh);
        var knee = new THREE.Group(); knee.position.y = -0.60; lp.add(knee);
        var shin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.55, 10), pantsMat);
        shin.position.y = -0.275; shin.castShadow = true; knee.add(shin);
        var ankle = new THREE.Group(); ankle.position.y = -0.55; knee.add(ankle);
        var shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.34), shoeMat);
        shoe.position.set(0, -0.045, 0.05); ankle.add(shoe);
        var toe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.10, 0.12), toeMat);
        toe.position.set(0, -0.055, 0.235); ankle.add(toe);
        g.add(lp); legPivots.push(lp); kneePivots.push(knee); anklePivots.push(ankle);
      });

      /* 骨盤→胸郭 */
      var hips = new THREE.Group(); hips.position.y = 1.15; g.add(hips);
      var pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.24, 12), pantsMat);
      pelvis.position.y = 0.06; pelvis.castShadow = true; hips.add(pelvis);
      var torsoG = new THREE.Group(); torsoG.position.y = 0.10; hips.add(torsoG);
      var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.92, 12), shirtMat);
      torso.position.y = 0.44; torso.castShadow = true; torsoG.add(torso);
      var collar = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.045, 8, 18), shirtMat);
      collar.position.y = 0.90; collar.rotation.x = Math.PI / 2 - 0.25; torsoG.add(collar);
      if (opts.acc === "argyle" || opts.acc === "goldpin") {
        var badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0),
          new THREE.MeshStandardMaterial({ color: 0xffd875, metalness: 0.9, roughness: 0.2 }));
        badge.position.set(0.12, 0.56, 0.31); torsoG.add(badge);
      }
      if (opts.acc === "tie_knicker") {
        var tie = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x8b1e24 }));
        tie.position.set(0, 0.50, 0.32); torsoG.add(tie);
      }

      /* 頭部：顎ライン・鼻筋・耳を備えた立体造形＋帽子群 */
      var headG = new THREE.Group(); headG.position.y = 0.81; torsoG.add(headG);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 14), skinMat);
      head.position.y = 0.14; head.castShadow = true; headG.add(head);
      var jaw = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), skinMat);
      jaw.scale.set(0.92, 0.78, 0.95); jaw.position.set(0, 0.015, 0.035); headG.add(jaw);
      var nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 8), skinMat);
      nose.rotation.x = Math.PI / 2 - 0.35; nose.position.set(0, 0.10, 0.27); headG.add(nose);
      [-0.255, 0.255].forEach(function (ex) {
        var ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skinMat);
        ear.position.set(ex, 0.13, 0); headG.add(ear);
      });
      if (opts.acc === "glasses" || opts.acc === "sunglass") {
        var glMat = new THREE.MeshStandardMaterial({ color: opts.acc === "sunglass" ? 0x0a0c12 : 0xdde8ff, metalness: 0.85, roughness: 0.15 });
        var glMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.08), glMat);
        glMesh.position.set(0, 0.16, 0.24); headG.add(glMesh);
      }
      if (opts.acc === "beard") {
        var brd = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), new THREE.MeshStandardMaterial({ color: 0x4a3728 }));
        brd.position.set(0, 0.03, 0.10); headG.add(brd);
      }
      var hatType = opts.hat || "cap";
      var hatCol = (opts.cap !== undefined) ? opts.cap : (hatType === "straw" ? 0xe5c77b : (hatType === "flat" ? 0xf5f6fa : 0x1e2436));
      var hatMat = new THREE.MeshStandardMaterial({ color: hatCol, roughness: 0.55 });
      if (hatType === "cap" || hatType === "visor") {
        if (hatType === "cap") {
          var dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
          dome.position.y = 0.20; headG.add(dome);
        }
        var brim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.26), hatMat);
        brim.position.set(0, 0.22, 0.24); headG.add(brim);
      } else if (hatType === "straw") {
        var sBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.04, 18), hatMat);
        sBrim.position.y = 0.28; headG.add(sBrim);
        var sTop = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.20, 16), hatMat);
        sTop.position.y = 0.38; headG.add(sTop);
        if (opts.acc === "shark") {
          var fin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), new THREE.MeshStandardMaterial({ color: 0x38ada9 }));
          fin.position.set(0, 0.54, 0.12); headG.add(fin);
        }
      } else if (hatType === "flat" || hatType === "beret") {
        var fl = new THREE.Mesh(new THREE.SphereGeometry(0.30, 14, 10), hatMat);
        fl.scale.set(1.05, 0.42, 1.18); fl.position.set(0, 0.32, 0.05); headG.add(fl);
      }

      /* 腕：肩→肘→手首の多関節（クラブ側が主動・反対側はグリップへ添える） */
      function buildArm(sx) {
        var sh = new THREE.Group(); sh.position.set(0.34 * sx, 0.70, 0); torsoG.add(sh);
        var up = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.36, 8), shirtMat);
        up.position.y = -0.18; up.castShadow = true; sh.add(up);
        var el = new THREE.Group(); el.position.y = -0.36; sh.add(el);
        var fo = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.34, 8), skinMat);
        fo.position.y = -0.17; el.add(fo);
        var wr = new THREE.Group(); wr.position.y = -0.34; el.add(wr);
        var hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), skinMat);
        hand.position.y = -0.05; wr.add(hand);
        return { sh: sh, el: el, wr: wr, hand: hand };
      }
      var armC = buildArm(side);        /* クラブ側 */
      var armF = buildArm(-side);       /* 添え手側 */
      armF.sh.rotation.z = 0.55 * side; armF.sh.rotation.x = -0.55; armF.el.rotation.x = -0.65;
      var armPivot = armC.sh;

      /* クラブ（手首のクラブグループ配下：金属シャフト＋金ヘッド） */
      var clubGroup = new THREE.Group(); clubGroup.position.set(0.03 * side, -0.08, 0.06); armC.wr.add(clubGroup);
      var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 1.15, 6),
        new THREE.MeshStandardMaterial({ color: 0xd8e2f0, metalness: 0.92, roughness: 0.15 }));
      shaft.position.set(0.02 * side, -0.52, 0.16); shaft.rotation.x = 0.30; clubGroup.add(shaft);
      var clubHead = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.20),
        new THREE.MeshStandardMaterial({ color: 0xffd466, metalness: 0.9, roughness: 0.2 }));
      clubHead.position.set(0.04 * side, -1.04, 0.33); clubGroup.add(clubHead);

      g.scale.setScalar(sc);
      var joints = { hips: hips, torso: torsoG, head: headG, shoulderC: armC.sh, elbowC: armC.el, wristC: armC.wr, shoulderF: armF.sh, elbowF: armF.el, knees: kneePivots, ankles: anklePivots };
      g.userData = { shirtMat: shirtMat, pantsMat: pantsMat, armPivot: armPivot, clubHead: clubHead, legs: legPivots, origShirt: opts.shirt, origPants: opts.pants, joints: joints, torsoMesh: torso };
      GOLFER_RIGS.push({ g: g, arm: armPivot, j: joints, torso: torso, seed: Math.random() * 10 });
      if (window.HQW) HQW.enqueueGolfer(g, { shirtMat: shirtMat, pantsMat: pantsMat, skinMat: skinMat, hatMat: hatMat, shoeMat: shoeMat, toeMat: toeMat, hatCol: hatCol, hatType: hatType, joints: joints, legs: legPivots, knees: kneePivots, ankles: anklePivots, clubGroup: clubGroup, torso: torso, charId: opts.charId || null });
      return g;
    }
    /* 運動連鎖＆呼吸モーション（既存の armPivot 駆動から全身へ配分する） */
    (function golferRigLoop() {
      var t0 = performance.now();
      function fr(now) {
        var t = (now - t0) / 1000;
        for (var i = 0; i < GOLFER_RIGS.length; i++) {
          var R = GOLFER_RIGS[i];
          if (!R.g.parent) continue;
          var ax = R.arm.rotation.x || 0;
          R.j.torso.rotation.y = ax * 0.30;
          R.j.hips.rotation.y = ax * 0.14;
          R.j.head.rotation.y = -ax * 0.36;
          R.j.head.rotation.x = Math.sin(t * 1.6 + R.seed) * 0.03;
          R.j.elbowC.rotation.x = -0.22 - Math.min(0.8, Math.abs(ax) * 0.4);
          R.torso.position.y = 0.44 + Math.sin(t * 1.6 + R.seed) * 0.012;
          R.j.ankles.forEach(function (a) { a.rotation.x = -ax * 0.10; });
        }
        requestAnimationFrame(fr);
      }
      requestAnimationFrame(fr);
    })();

    /* =========================================================================
       第4部：主人公・残影AI・四神波動ショットMAX・ファー咆哮・炎＆糸Canvas HUD
       ========================================================================= */
    var STATE = {
      mode: IS_GOAT ? "goat" : "normal",
      playerName: PNAME,
      rankTitle: IS_GOAT ? "グランドスラマー" : "100切り挑戦者",
      power: 100,
      mental: 100,
      balls: IS_GOAT ? 999 : 18,
      gold: IS_GOAT ? 999999 : 2400,
      tp: IS_GOAT ? 20000 : 0,
      clubIdx: 0,
      gearStats: {
        distPct: IS_GOAT ? 28 : 0,
        critMult: IS_GOAT ? 2.3 : 1.0,
        critRatePct: IS_GOAT ? 35 : 5,
        walkSpdPct: IS_GOAT ? 30 : 0,
        setThree: IS_GOAT,
        setOlympus: IS_GOAT,
        setGodComplete: IS_GOAT,
        specials: IS_GOAT ? { kusanagi: true, yasakani_eternal: true, hades_stealth: true } : {}
      },
      subTrialDone: false,
      paused: false
    };

    /* 主人公モデル＆神装オーラリング */
    var pal = CHAR_PALETTE[CHAR_ID] || CHAR_PALETTE.Watu;
    var playerMesh = buildGolferMesh({
      shirt: pal.shirt, pants: pal.pants, cap: pal.cap, skin: pal.skin, hat: "cap", charId: CHAR_ID, scale: ({ Watu: 1.02, Matuya: 1.05, TIiger: 1.07, Junbo: 1.06, McIlro: 1.10, DeCham: 1.09 }[CHAR_ID] || 1.05)
    });
    var player = { x: 0, z: 22, rotY: Math.PI, vx: 0, vz: 0, hurtCd: 0, foreCd: 0, pushCd: 0 };
    playerMesh.position.set(player.x, terrainY(player.x, player.z), player.z);
    playerMesh.rotation.y = player.rotY;
    scene.add(playerMesh);

    var sacredAuraRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.15, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd875, side: THREE.DoubleSide, transparent: true, opacity: 0.0 })
    );
    sacredAuraRing.rotation.x = -Math.PI / 2;
    sacredAuraRing.position.y = 0.08;
    playerMesh.add(sacredAuraRing);

    var chargeOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x5ce1e6, transparent: true, opacity: 0.0 })
    );
    chargeOrb.position.set(0.38, 0.55, 0.48);
    playerMesh.add(chargeOrb);

    /* 環境パーティクル（桜吹雪・黄金粒子・黄泉霧→天岩戸の光） */
    var envParticles = (function createEnvParticles() {
      var cnt = 140;
      var geo = new THREE.BufferGeometry();
      var pos = new Float32Array(cnt * 3);
      for (var i = 0; i < cnt; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 150;
        pos[i * 3 + 1] = 1 + Math.random() * 22;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 150;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      var mat = new THREE.PointsMaterial({
        color: THEME.petalColor, size: 0.42, transparent: true, opacity: 0.72
      });
      var pts = new THREE.Points(geo, mat);
      scene.add(pts);
      return pts;
    })();

    /* 残影6体の配置と個別外観適用（エリア5天空の神域は最初から清浄） */
    var MOBS = [];
    var MOB_SPAWN_COORDS = [
      { x: -20, z: -2 }, { x: 20, z: -4 },
      { x: -30, z: -24 }, { x: 32, z: 4 },
      { x: -16, z: -40 }, { x: 18, z: -38 }
    ];

    function spawnAreaMobs(mobDefs, purifiedIds) {
      /* v4.5: 旧モブのシャツ用 CanvasTexture を解放し、残影リグ配列から除去済み分を剪定（sync のたびの単調増加を止める） */
      MOBS.forEach(function (m) {
        if (m.mesh) {
          m.mesh.traverse(function (o) {
            if (o.material) {
              var mats = Array.isArray(o.material) ? o.material : [o.material];
              mats.forEach(function (mm) { if (mm.map && mm.map.isCanvasTexture) { try { mm.map.dispose(); } catch (e) {} } });
            }
          });
          scene.remove(m.mesh);
        }
      });
      for (var ri = GOLFER_RIGS.length - 1; ri >= 0; ri--) { if (!GOLFER_RIGS[ri].g.parent) GOLFER_RIGS.splice(ri, 1); }
      MOBS = [];
      if (AREA_IDX === 5) return; // 天空の神域は神聖領域

      var list = (mobDefs && mobDefs.length) ? mobDefs : FALLBACK_MOBS_30.filter(function (m) { return m.area === AREA_IDX; });
      var pureSet = {};
      (purifiedIds || []).forEach(function (id) { pureSet[id] = true; });

      list.slice(0, 6).forEach(function (def, idx) {
        var vis = MOBS_VISUAL_MAP[def.id] || FALLBACK_MOBS_30[idx];
        var maxHp = def.cls === "大" ? 120 : (def.cls === "中" ? 80 : 45);
        var sc = (def.cls === "大" ? 1.16 : (def.cls === "中" ? 1.04 : 0.95)) * (vis.acc === "tall" ? 1.07 : 1.0);
        var mesh = buildGolferMesh({
          shirt: vis.shirt, pants: vis.pants, hat: vis.hat, acc: vis.acc, scale: sc
        });

        /* 闇の瘴気オーラリング */
        var miasma = new THREE.Mesh(
          new THREE.RingGeometry(0.75, 1.25, 24),
          new THREE.MeshBasicMaterial({ color: 0x9b30ff, side: THREE.DoubleSide, transparent: true, opacity: 0.68 })
        );
        miasma.rotation.x = -Math.PI / 2;
        miasma.position.y = 0.08;
        mesh.add(miasma);

        /* 頭上HPバー */
        var hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.15), new THREE.MeshBasicMaterial({ color: 0x111320, side: THREE.DoubleSide }));
        hpBg.position.y = 2.65;
        var hpFg = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.10), new THREE.MeshBasicMaterial({ color: 0xd65eff, side: THREE.DoubleSide }));
        hpFg.position.set(0, 2.65, 0.01);
        mesh.add(hpBg, hpFg);

        var sp = MOB_SPAWN_COORDS[idx % MOB_SPAWN_COORDS.length];
        var isPure = !!pureSet[def.id];
        var mob = {
          id: def.id,
          name: def.name,
          cls: def.cls,
          homeX: sp.x, homeZ: sp.z,
          x: sp.x, z: sp.z,
          vx: 0, vz: 0,
          rotY: 0,
          hp: maxHp, maxHp: maxHp,
          purified: isPure,
          stunTimer: 0,
          blindTimer: 0,
          alerted: false,
          mesh: mesh,
          miasma: miasma,
          hpBg: hpBg,
          hpFg: hpFg
        };
        applyMobVisualState(mob);
        mesh.position.set(mob.x, terrainY(mob.x, mob.z), mob.z);
        scene.add(mesh);
        MOBS.push(mob);
      });
      refreshPurificationAtmosphere();
    }

    function applyMobVisualState(m) {
      var ud = m.mesh.userData;
      if (m.purified) {
        /* 浄化完了：黒紫の影が消え、本来の鮮やかな衣装と生気を取り戻す！ */
        ud.shirtMat.color.setHex(ud.origShirt);
        ud.shirtMat.emissive.setHex(0x000000);
        ud.pantsMat.color.setHex(ud.origPants);
        m.miasma.material.color.setHex(0x44e587);
        m.miasma.material.opacity = 0.35;
        m.hpBg.visible = false;
        m.hpFg.visible = false;
      } else {
        /* 浄化前：黒紫の呪縛トーン */
        ud.shirtMat.color.setHex(0x261738);
        ud.shirtMat.emissive.setHex(0x1f0933);
        ud.pantsMat.color.setHex(0x161124);
        m.miasma.visible = true;
      }
    }

    function countPurified() {
      var c = 0;
      for (var i = 0; i < MOBS.length; i++) if (MOBS[i].purified) c++;
      return c;
    }

    function isDuelGateOpen() {
      if (AREA_IDX === 5 || STATE.mode === "goat") return true;
      return countPurified() >= 2; // 2体以上浄化で決戦の門が開門！
    }

    function refreshPurificationAtmosphere() {
      var ratio = (AREA_IDX === 5 || MOBS.length === 0) ? 1.0 : (countPurified() / MOBS.length);
      /* v4.1（項目7）: ボス撃破済みエリアは残影の浄化率によらず光が満ちた状態にする */
      if (STATE.bossDefeated) ratio = 1.0;
      skyUniforms.uPure.value = Math.min(1.0, 0.16 + ratio * 0.84);
      var cDark = new THREE.Color(THEME.fogColor);
      var cPure = new THREE.Color(THEME.fogPure);
      scene.fog.color.copy(cDark.lerp(cPure, ratio));
      sunLight.intensity = (1.25 + ratio * 0.55) * Math.PI;
      if (duelPortalMesh) {
        var open = isDuelGateOpen();
        duelPortalMesh.material.color.setHex(open ? 0xffd875 : 0x6b3fa0);
        duelPortalMesh.material.opacity = open ? 0.68 : 0.25;
      }
      updateHudNumbers();
    }

    /* フィールド上の拾得ボール配置（ラフやバンカー周辺に点在・時間経過で補充） */
    var PICKUPS = [];
    (function spawnBallPickups() {
      var ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.1, emissive: 0x333322 });
      var ringMat = new THREE.MeshBasicMaterial({ color: 0xffe699, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
      var pts = [
        [-16, -12], [15, -24], [26, 22], [-28, 12], [8, -32], [-8, -22], [32, -10], [-36, -12]
      ];
      pts.forEach(function (p) {
        var grp = new THREE.Group();
        var sp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), ballMat);
        sp.position.y = 0.35;
        var rg = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.48, 18), ringMat);
        rg.rotation.x = -Math.PI / 2; rg.position.y = 0.08;
        grp.add(sp, rg);
        grp.position.set(p[0], terrainY(p[0], p[1]), p[1]);
        scene.add(grp);
        PICKUPS.push({ x: p[0], z: p[1], active: true, respawn: 0, mesh: grp });
      });
    })();

    /* =========================================================================
       第5部：四神波動ショットMAX（青龍・朱雀・白虎・玄武）＆ 衝撃エフェクト群
       ========================================================================= */
    var PROJECTILES = [];
    var FX_LIST = [];
    var hitstopTimer = 0;
    var camShake = 0;

    function showToast(msg) {
      var area = document.getElementById("toastArea");
      var d = document.createElement("div");
      d.className = "toast";
      d.textContent = msg;
      area.appendChild(d);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2700);
    }

    var bannerTimer = null;
    function showBanner(big, sub) {
      var wrap = document.getElementById("centerBanner");
      document.getElementById("bannerBig").textContent = big;
      document.getElementById("bannerSub").textContent = sub || "";
      wrap.style.display = "block";
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(function () { wrap.style.display = "none"; }, 3200);
    }

    function spawnPillarFX(x, z, colorHex, radius, height, dur) {
      var y = terrainY(x, z);
      var mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
      var cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.65, radius, height, 20, 1, true), mat);
      cyl.position.set(x, y + height * 0.5, z);
      scene.add(cyl);
      FX_LIST.push({ mesh: cyl, age: 0, dur: dur || 0.55, kind: "pillar" });

      var ring = new THREE.Mesh(new THREE.RingGeometry(0.4, radius * 1.3, 28),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, y + 0.14, z);
      scene.add(ring);
      FX_LIST.push({ mesh: ring, age: 0, dur: dur || 0.55, kind: "expand_ring" });
    }

    function spawnGroundGroove(x, z, rotY, colorHex) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.65, 2.2),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.78, side: THREE.DoubleSide })
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -rotY;
      m.position.set(x, terrainY(x, z) + 0.09, z);
      scene.add(m);
      FX_LIST.push({ mesh: m, age: 0, dur: 0.75, kind: "fade" });
    }

    function spawnTigerClaws(x, z, isSandBlind) {
      var y = terrainY(x, z);
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2;
        var claw = new THREE.Mesh(
          new THREE.PlaneGeometry(0.42, isSandBlind ? 7.5 : 5.2),
          new THREE.MeshBasicMaterial({ color: isSandBlind ? 0xf6d365 : 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
        );
        claw.rotation.x = -Math.PI / 2;
        claw.rotation.z = a;
        claw.position.set(x + Math.sin(a) * 2.0, y + 0.11, z + Math.cos(a) * 2.0);
        scene.add(claw);
        FX_LIST.push({ mesh: claw, age: 0, dur: 0.85, kind: "fade" });
      }
      if (isSandBlind) {
        /* バンカー砂煙ドーム（目くらましスタン発動！） */
        var dome = new THREE.Mesh(
          new THREE.SphereGeometry(5.5, 18, 12),
          new THREE.MeshBasicMaterial({ color: 0xe8c987, transparent: true, opacity: 0.62, wireframe: false })
        );
        dome.position.set(x, y + 1.2, z);
        scene.add(dome);
        FX_LIST.push({ mesh: dome, age: 0, dur: 1.15, kind: "sand_dome" });
      }
    }

    function spawnHexRipple(x, z, colorHex) {
      var hex = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.72, 6),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      );
      hex.rotation.x = -Math.PI / 2;
      hex.position.set(x, terrainY(x, z) + 0.10, z);
      scene.add(hex);
      FX_LIST.push({ mesh: hex, age: 0, dur: 0.55, kind: "expand_hex" });
    }

    /* 四神波動ショット発射！ */
    function fireWaveShot(chargeSec) {
      var gs = STATE.gearStats || {};
      var infiniteBall = (STATE.mode === "goat" || (gs.specials && gs.specials.yasakani_eternal));
      if (!infiniteBall && STATE.balls <= 0) {
        showToast("⚠ ボールが0球です！『[E] FORE!咆哮』で凌ぎつつ白い球を拾うか補給しよう！");
        playSfx("hurt");
        return;
      }
      if (!infiniteBall) {
        STATE.balls = Math.max(0, STATE.balls - 1);
        postToParent({ type: "goat:worldUpdate", addBalls: -1 });
        updateHudNumbers();
      }

      var lv = chargeSec >= 1.28 ? 3 : (chargeSec >= 0.58 ? 2 : 1);
      var mult = lv === 3 ? 2.15 : (lv === 2 ? 1.48 : 1.0);
      var club = FOUR_GOD_CLUBS[STATE.clubIdx];
      var dirX = Math.sin(player.rotY), dirZ = Math.cos(player.rotY);
      var startX = player.x + dirX * 0.9, startZ = player.z + dirZ * 0.9;
      var startY = terrainY(startX, startZ) + 1.05;

      /* スイングモーション＆反動シェイク */
      playerMesh.userData.armPivot.rotation.x = -1.35;
      camShake = Math.max(camShake, 0.14 * lv);
      if (lv === 3) skyUniforms.uFlash.value = 0.85;

      var isCrit = Math.random() * 100 < (12 + (gs.critRatePct || 0) + (lv === 3 ? 25 : 0));
      var dmg = Math.round(club.dmg * mult * (1 + (gs.distPct || 0) * 0.01) * (isCrit ? (gs.critMult || 1.35) : 1.0));

      /* ① 青龍ドライバー：3D二重螺旋ドラゴンビーム（クサナギ装備時は黒金青龍！） */
      if (STATE.clubIdx === 0) {
        playSfx("seiryu");
        var hasKusanagi = !!(gs.specials && gs.specials.kusanagi);
        var col = hasKusanagi ? 0xffcf48 : club.color;
        var grp = new THREE.Group();
        var core = new THREE.Mesh(new THREE.SphereGeometry(0.32 * (0.9 + lv * 0.2), 14, 12),
          new THREE.MeshBasicMaterial({ color: hasKusanagi ? 0xfff3b0 : 0xdff9fb }));
        var helix1 = new THREE.Mesh(new THREE.TorusGeometry(0.58 + lv * 0.14, 0.09, 8, 20),
          new THREE.MeshBasicMaterial({ color: col }));
        var helix2 = new THREE.Mesh(new THREE.TorusGeometry(0.58 + lv * 0.14, 0.08, 8, 20),
          new THREE.MeshBasicMaterial({ color: hasKusanagi ? 0x221a08 : 0x0abde3 }));
        helix2.rotation.y = Math.PI / 2;
        grp.add(core, helix1, helix2);
        grp.position.set(startX, startY, startZ);
        scene.add(grp);
        PROJECTILES.push({
          club: 0, lv: lv, mesh: grp, x: startX, y: startY, z: startZ,
          vx: dirX * club.speed, vy: 0, vz: dirZ * club.speed,
          rotY: player.rotY, dist: 0, maxDist: club.range * (0.85 + lv * 0.22),
          dmg: dmg, isCrit: isCrit, pierce: true, hitMap: {}, color: col, stepAcc: 0
        });
      }
      /* ② 朱雀アイアン：オーロラ軌跡から炎の光羽が扇状に分裂飛翔 */
      else if (STATE.clubIdx === 1) {
        playSfx("suzaku");
        var featherCnt = lv === 3 ? 7 : (lv === 2 ? 5 : 3);
        for (var f = 0; f < featherCnt; f++) {
          var spread = (f - (featherCnt - 1) * 0.5) * 0.13;
          var ang = player.rotY + spread;
          var fMesh = new THREE.Mesh(
            new THREE.ConeGeometry(0.22, 1.15, 6),
            new THREE.MeshBasicMaterial({ color: f % 2 === 0 ? 0xff5e57 : 0xffbe76 })
          );
          fMesh.rotation.x = Math.PI / 2;
          fMesh.position.set(startX, startY + 0.2, startZ);
          scene.add(fMesh);
          PROJECTILES.push({
            club: 1, lv: lv, mesh: fMesh, x: startX, y: startY + 0.2, z: startZ,
            vx: Math.sin(ang) * club.speed, vy: 2.5, vz: Math.cos(ang) * club.speed,
            rotY: ang, dist: 0, maxDist: club.range * (0.9 + lv * 0.15),
            dmg: Math.round(dmg * 0.72), isCrit: isCrit, pierce: false, hitMap: {}, color: 0xff5e57, stepAcc: 0
          });
        }
      }
      /* ③ 白虎ウェッジ：高弾道ロブ→着弾時に天からの垂直光柱＆虎爪地割れ（バンカーなら砂煙目くらまし！） */
      else if (STATE.clubIdx === 2) {
        playSfx("byakko");
        var fromBunker = isInBunker(player.x, player.z);
        var orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.30, 14, 12),
          new THREE.MeshBasicMaterial({ color: fromBunker ? 0xf6d365 : 0xffffff })
        );
        orb.position.set(startX, startY + 0.3, startZ);
        scene.add(orb);
        var targetDist = (16 + lv * 6.5);
        var flightT = 0.72;
        PROJECTILES.push({
          club: 2, lv: lv, mesh: orb, x: startX, y: startY + 0.3, z: startZ,
          vx: dirX * (targetDist / flightT), vy: 11.5 + lv * 2.0, vz: dirZ * (targetDist / flightT),
          rotY: player.rotY, dist: 0, maxDist: 99, age: 0, flightT: flightT,
          dmg: dmg, isCrit: isCrit, fromBunker: fromBunker, color: 0xffffff
        });
      }
      /* ④ 玄武パター：無音で地面を這う六角亀甲波紋（100%確定スタン＆隠密） */
      else {
        playSfx("genbu");
        var disc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.14, 6),
          new THREE.MeshBasicMaterial({ color: 0x2ed573 })
        );
        disc.position.set(startX, terrainY(startX, startZ) + 0.22, startZ);
        scene.add(disc);
        PROJECTILES.push({
          club: 3, lv: lv, mesh: disc, x: startX, y: disc.position.y, z: startZ,
          vx: dirX * club.speed, vy: 0, vz: dirZ * club.speed,
          rotY: player.rotY, dist: 0, maxDist: club.range * (0.9 + lv * 0.25),
          dmg: dmg, isCrit: isCrit, pierce: false, hitMap: {}, color: 0x2ed573, stepAcc: 0, stealth: true
        });
      }
    }

    /* 残影へのダメージ・スタン・浄化処理 */
    function damageMob(mob, dmg, opts) {
      if (mob.purified) return;
      opts = opts || {};
      mob.hp -= dmg;
      playSfx("hit");
      hitstopTimer = Math.max(hitstopTimer, 0.042);
      camShake = Math.max(camShake, opts.isCrit ? 0.32 : 0.16);

      if (opts.stunSec) {
        mob.stunTimer = Math.max(mob.stunTimer, opts.stunSec);
      }
      if (opts.blindSec) {
        mob.blindTimer = Math.max(mob.blindTimer, opts.blindSec);
        mob.stunTimer = Math.max(mob.stunTimer, opts.blindSec);
      }
      if (!opts.stealth) {
        mob.alerted = true;
      }

      /* ノックバック */
      var dx = mob.x - player.x, dz = mob.z - player.z;
      var len = Math.hypot(dx, dz) || 1;
      mob.x += (dx / len) * 1.35;
      mob.z += (dz / len) * 1.35;

      /* HPゲージ更新 */
      var ratio = Math.max(0, mob.hp / mob.maxHp);
      mob.hpFg.scale.x = Math.max(0.01, ratio);

      if (opts.isCrit) {
        showToast("⚡ 会心の一撃！ " + mob.name + " に " + dmg + " ダメージ！");
      }

      /* 浄化完了！ */
      if (mob.hp <= 0) {
        mob.hp = 0;
        mob.purified = true;
        applyMobVisualState(mob);
        playSfx("purify");
        spawnPillarFX(mob.x, mob.z, 0xffd875, 2.4, 16, 0.95);

        var gainTp = mob.cls === "大" ? 140 : (mob.cls === "中" ? 95 : 65);
        var gainGold = mob.cls === "大" ? 2200 : (mob.cls === "中" ? 1400 : 900);
        var gainBalls = 2;
        STATE.tp += gainTp;
        STATE.gold += gainGold;
        if (STATE.mode !== "goat") STATE.balls += gainBalls;

        showBanner("✨ 残影浄化 ― " + mob.name, "生気と色彩が蘇った！ +" + gainTp + "TP / +¥" + gainGold.toLocaleString() + " / 球+2");
        postToParent({
          type: "goat:worldUpdate",
          purifiedMobId: mob.id,
          addTp: gainTp,
          addGold: gainGold,
          addBalls: gainBalls,
          narrText: mob.name + "の残影が清められ、聖地に光が戻っていく。",
          narrRole: "male"
        });
        refreshPurificationAtmosphere();
      }
    }

    /* 緊急護身①：『FORE!（ファー！）』咆哮（周囲16mの残影を一斉スタン！ 球消費0） */
    function triggerForeRoar() {
      if (player.foreCd > 0) return;
      player.foreCd = 8.0;
      playSfx("fore");
      spawnPillarFX(player.x, player.z, 0xffd875, 6.5, 4.5, 0.65);
      camShake = 0.25;
      var hitCnt = 0;
      MOBS.forEach(function (m) {
        if (m.purified) return;
        if (Math.hypot(m.x - player.x, m.z - player.z) < 16.5) {
          m.stunTimer = Math.max(m.stunTimer, 3.8);
          hitCnt++;
        }
      });
      showBanner("📢 『FORE!!（ファー！！）』", hitCnt > 0 ? (hitCnt + "体の残影が咆哮に怯んで静止した！") : "聖地に警告の咆哮が響き渡った！");
    }

    /* 緊急護身②：近接プッシュ押し返し（周囲6.5mの残影を弾き飛ばす！ 球消費0） */
    function triggerClosePush() {
      if (player.pushCd > 0) return;
      player.pushCd = 2.5;
      playSfx("push");
      playerMesh.userData.armPivot.rotation.x = -1.2;
      spawnPillarFX(player.x, player.z, 0x5ce1e6, 3.8, 2.5, 0.4);
      MOBS.forEach(function (m) {
        if (m.purified) return;
        var dx = m.x - player.x, dz = m.z - player.z;
        var d = Math.hypot(dx, dz);
        if (d < 6.8) {
          var nx = dx / (d || 1), nz = dz / (d || 1);
          m.x += nx * 5.8;
          m.z += nz * 5.8;
          m.stunTimer = Math.max(m.stunTimer, 1.8);
          damageMob(m, 12, { stunSec: 1.8 });
        }
      });
    }

    /* =========================================================================
       第6部：ユニバーサル高速入力エンジン（Windows WASD/矢印/マウスクリック移動 ＆ スマホ360°スティック/地面タップ/ピンチズーム）
       ========================================================================= */
    var keys = {};
    var camYaw = 0, camPitch = 0.34, camDist = 11.5;
    var charging = false, chargeTime = 0;
    var activePromptLandmark = null;

    /* 高速ダッシュ制御（デフォルトで常時高速ON！ さらにShift/瞬速ボタンで超高速ブースト！） */
    var alwaysDash = true;
    var boostHeld = false;
    var dashBurstTimer = 0;
    var sprintDustAcc = 0;
    var stridePhase = 0;

    /* バーチャルアナログスティック状態（-1..1） */
    var stickVec = { x: 0, y: 0, mag: 0, active: false, pointerId: null };
    var floatStickState = { active: false, pointerId: null, ox: 0, oy: 0 };

    /* 地面クリック／タップ自動高速移動＆目的地3Dマーカー */
    var autoMove = { active: false, x: 0, z: 0, landmark: null };
    var raycaster = new THREE.Raycaster();
    var moveTargetGroup = (function createMoveTargetMarker() {
      var grp = new THREE.Group();
      var r1 = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.82, 28),
        new THREE.MeshBasicMaterial({ color: 0x5ce1e6, side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
      );
      r1.rotation.x = -Math.PI / 2;
      r1.position.y = 0.12;
      var r2 = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.34, 20),
        new THREE.MeshBasicMaterial({ color: 0xffd875, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
      );
      r2.rotation.x = -Math.PI / 2;
      r2.position.y = 0.14;
      var pin = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.85, 10),
        new THREE.MeshBasicMaterial({ color: 0xffd875, transparent: true, opacity: 0.85 })
      );
      pin.rotation.x = Math.PI;
      pin.position.y = 0.85;
      grp.add(r1, r2, pin);
      grp.visible = false;
      grp.userData = { r1: r1, pin: pin };
      scene.add(grp);
      return grp;
    })();

    function cancelAutoMove() {
      autoMove.active = false;
      autoMove.landmark = null;
      moveTargetGroup.visible = false;
    }

    function setAutoMoveTarget(wx, wz, lm) {
      var safe = nudgeOutOfPond(wx, wz, 1.8);
      autoMove.x = safe.x;
      autoMove.z = safe.z;
      autoMove.landmark = lm || null;
      autoMove.active = true;
      moveTargetGroup.position.set(safe.x, terrainY(safe.x, safe.z), safe.z);
      moveTargetGroup.visible = true;
    }

    function triggerDashBurst() {
      ensureAC();
      dashBurstTimer = 0.52;
      spawnHexRipple(player.x, player.z, 0x5ce1e6);
    }

    var dashToggleEl = document.getElementById("dashToggleBtn");
    dashToggleEl.onclick = function () {
      alwaysDash = !alwaysDash;
      dashToggleEl.classList.toggle("on", alwaysDash);
      dashToggleEl.textContent = alwaysDash ? "⚡ 常時高速: ON" : "🚶 常時高速: OFF";
      showToast(alwaysDash ? "⚡ 常時高速ダッシュ ON（27m/s 爽快移動！）" : "🚶 通常ランニング速度へ切り替えました");
    };

    var boostBtnEl = document.getElementById("boostStepBtn");
    boostBtnEl.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation();
      boostHeld = true;
      boostBtnEl.classList.add("active");
      triggerDashBurst();
    });
    window.addEventListener("pointerup", function () {
      if (boostHeld) { boostHeld = false; boostBtnEl.classList.remove("active"); }
    });
    window.addEventListener("pointercancel", function () {
      if (boostHeld) { boostHeld = false; boostBtnEl.classList.remove("active"); }
    });

    function selectClub(idx) {
      STATE.clubIdx = idx;
      Array.prototype.forEach.call(document.querySelectorAll(".cslot"), function (b, i) {
        b.classList.toggle("active", i === idx);
      });
      document.getElementById("clubDesc").textContent = FOUR_GOD_CLUBS[idx].desc;
    }

    Array.prototype.forEach.call(document.querySelectorAll(".cslot"), function (b) {
      b.onclick = function () { selectClub(parseInt(b.getAttribute("data-club"), 10)); };
    });
    document.getElementById("btnFore").onclick = triggerForeRoar;
    document.getElementById("btnPush").onclick = triggerClosePush;
    document.getElementById("btnQSave").onclick = function () {
      postToParent({ type: "goat:quickSave" });
      showToast("💾 現在地をクイックセーブしました");
    };

    /* チャージ開始時にカメラ正面（または正面近くの未浄化残影）へスマート照準アシスト */
    function alignAimToCameraOrTarget() {
      var fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw);
      var bestAng = Math.atan2(fwdX, fwdZ);
      var bestScore = 999;
      for (var i = 0; i < MOBS.length; i++) {
        var m = MOBS[i];
        if (m.purified) continue;
        var dx = m.x - player.x, dz = m.z - player.z;
        var dist = Math.hypot(dx, dz);
        if (dist < 0.5 || dist > 38) continue;
        var dot = (dx / dist) * fwdX + (dz / dist) * fwdZ;
        if (dot > 0.84 && dist < bestScore) {
          bestScore = dist;
          bestAng = Math.atan2(dx, dz);
        }
      }
      player.rotY = bestAng;
    }

    function startCharge(pId) {
      if (STATE.paused || charging) return;
      ensureAC();
      alignAimToCameraOrTarget();
      charging = true;
      chargeTime = 0;
      chargingPointerId = (pId !== undefined) ? pId : null;
      document.getElementById("chargeHud").style.display = "block";
    }
    function releaseCharge() {
      if (!charging) return;
      charging = false;
      chargingPointerId = null;
      document.getElementById("chargeHud").style.display = "none";
      skyUniforms.uStorm.value = 0;
      chargeOrb.material.opacity = 0;
      fireWaveShot(chargeTime);
      chargeTime = 0;
    }
    var chargingPointerId = null;

    var cBtn = document.getElementById("chargeBtn");
    cBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation();
      startCharge(e.pointerId);
    });
    window.addEventListener("pointerup", function (e) {
      if (charging && (chargingPointerId === null || e.pointerId === chargingPointerId)) releaseCharge();
    });
    window.addEventListener("pointercancel", function (e) {
      if (charging && (chargingPointerId === null || e.pointerId === chargingPointerId)) releaseCharge();
    });

    /* ① 左下360°バーチャルアナログスティック（スマホ親指＆PCマウスドラッグ両対応・マルチタッチ分離） */
    var vStickBase = document.getElementById("vStickBase");
    var vStickKnob = document.getElementById("vStickKnob");

    function updateStickFromClientXY(cx, cy, rectCx, rectCy, maxR, knobEl) {
      var dx = cx - rectCx, dy = cy - rectCy;
      var dist = Math.hypot(dx, dy);
      var clamped = Math.min(maxR, dist);
      var nx = dist > 0.001 ? (dx / dist) : 0;
      var ny = dist > 0.001 ? (dy / dist) : 0;
      var mag = Math.min(1, dist / maxR);
      if (mag < 0.08) {
        stickVec.x = 0; stickVec.y = 0; stickVec.mag = 0;
      } else {
        stickVec.x = nx * mag;
        stickVec.y = ny * mag;
        stickVec.mag = mag;
        cancelAutoMove();
      }
      if (knobEl) {
        knobEl.style.transform = "translate(" + (nx * clamped).toFixed(1) + "px, " + (ny * clamped).toFixed(1) + "px)";
      }
    }

    function resetVirtualStick() {
      stickVec.x = 0; stickVec.y = 0; stickVec.mag = 0;
      stickVec.active = false; stickVec.pointerId = null;
      vStickBase.classList.remove("active");
      vStickKnob.style.transform = "translate(0px, 0px)";
    }

    vStickBase.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation();
      ensureAC();
      try { vStickBase.setPointerCapture(e.pointerId); } catch (err) { }
      stickVec.active = true;
      stickVec.pointerId = e.pointerId;
      vStickBase.classList.add("active");
      var r = vStickBase.getBoundingClientRect();
      updateStickFromClientXY(e.clientX, e.clientY, r.left + r.width * 0.5, r.top + r.height * 0.5, r.width * 0.38, vStickKnob);
    });
    vStickBase.addEventListener("pointermove", function (e) {
      if (!stickVec.active || e.pointerId !== stickVec.pointerId) return;
      e.preventDefault();
      var r = vStickBase.getBoundingClientRect();
      updateStickFromClientXY(e.clientX, e.clientY, r.left + r.width * 0.5, r.top + r.height * 0.5, r.width * 0.38, vStickKnob);
    });
    vStickBase.addEventListener("pointerup", function (e) {
      if (e.pointerId === stickVec.pointerId) resetVirtualStick();
    });
    vStickBase.addEventListener("pointercancel", function (e) {
      if (e.pointerId === stickVec.pointerId) resetVirtualStick();
    });

    /* ② 3Dキャンバス操作：マルチタッチ対応（左画面タッチ移動＋右画面カメラ回転＋2本指ピンチズーム＋地面クリック/タップ自動ダッシュ移動！） */
    var canvasPointers = {};
    var pinchPrevDist = 0;
    var floatStickEl = document.getElementById("floatStick");
    var floatStickKnobEl = document.getElementById("floatStickKnob");

    function activeCanvasPointerList() {
      var arr = [];
      for (var k in canvasPointers) {
        if (Object.prototype.hasOwnProperty.call(canvasPointers, k)) arr.push(canvasPointers[k]);
      }
      return arr;
    }

    function handleTapToMove(clientX, clientY) {
      if (STATE.paused || !groundMesh) return;
      var rect = renderer.domElement.getBoundingClientRect();
      var ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      var ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      var hits = raycaster.intersectObject(groundMesh, false);
      if (!hits || !hits.length) return;
      var pt = hits[0].point;

      /* 施設・祠・決戦の門の近くをタップ/クリックした場合は、そこへ高速自動移動して到着時に自動オープン！ */
      var pickedLM = null, bestLMD = 999;
      for (var i = 0; i < LANDMARKS.length; i++) {
        var lm = LANDMARKS[i];
        var d = Math.hypot(pt.x - lm.x, pt.z - lm.z);
        if (d < lm.r + 3.2 && d < bestLMD) {
          bestLMD = d;
          pickedLM = lm;
        }
      }
      if (pickedLM) {
        setAutoMoveTarget(pickedLM.x, pickedLM.z, pickedLM);
        showToast("🏃 『" + pickedLM.label + "』へ高速ダッシュ移動！");
      } else {
        setAutoMoveTarget(pt.x, pt.z, null);
      }
    }

    renderer.domElement.addEventListener("pointerdown", function (e) {
      ensureAC();
      if (e.button === 2) { startCharge(e.pointerId); return; }
      var isLeftTouchZone = (e.pointerType === "touch" && e.clientX < window.innerWidth * 0.43 && !stickVec.active && !floatStickState.active);
      canvasPointers[e.pointerId] = {
        id: e.pointerId,
        startX: e.clientX, startY: e.clientY,
        x: e.clientX, y: e.clientY,
        moved: 0,
        t0: performance.now(),
        role: isLeftTouchZone ? "left_touch" : "cam_or_tap",
        pointerType: e.pointerType
      };
      var list = activeCanvasPointerList();
      if (list.length === 2) {
        pinchPrevDist = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
      }
    });

    window.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    window.addEventListener("pointermove", function (e) {
      var p = canvasPointers[e.pointerId];
      if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.startX, e.clientY - p.startY));

      var list = activeCanvasPointerList();
      if (list.length >= 2) {
        /* 2本指ピンチズーム */
        var curDist = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
        if (pinchPrevDist > 10) {
          camDist = Math.max(6.5, Math.min(22, camDist - (curDist - pinchPrevDist) * 0.035));
        }
        pinchPrevDist = curDist;
        return;
      }

      /* スマホ左画面タッチドラッグ：どこを触ってもフローティング移動スティックとして即機能！ */
      if (p.role === "left_touch") {
        if (p.moved > 9) {
          if (!floatStickState.active) {
            floatStickState.active = true;
            floatStickState.pointerId = p.id;
            floatStickState.ox = p.startX;
            floatStickState.oy = p.startY;
            floatStickEl.style.left = p.startX + "px";
            floatStickEl.style.top = p.startY + "px";
            floatStickEl.style.display = "block";
          }
          updateStickFromClientXY(p.x, p.y, floatStickState.ox, floatStickState.oy, 44, floatStickKnobEl);
        }
        return;
      }

      /* カメラ視点ドラッグ回転 */
      if (p.moved > 4) {
        camYaw -= dx * 0.0065;
        camPitch = Math.max(0.12, Math.min(1.05, camPitch + dy * 0.005));
      }
    });

    function endCanvasPointer(e) {
      var p = canvasPointers[e.pointerId];
      if (!p) return;
      delete canvasPointers[e.pointerId];
      if (floatStickState.active && floatStickState.pointerId === e.pointerId) {
        floatStickState.active = false;
        floatStickState.pointerId = null;
        floatStickEl.style.display = "none";
        floatStickKnobEl.style.transform = "translate(0px, 0px)";
        if (!stickVec.active) { stickVec.x = 0; stickVec.y = 0; stickVec.mag = 0; }
        return;
      }
      /* ドラッグではなく素早いクリック／タップだった場合は、その地面または施設へ高速ダッシュ移動！ */
      if (e.type === "pointerup" && p.moved < 9 && (performance.now() - p.t0) < 360) {
        handleTapToMove(p.x, p.y);
      }
    }
    window.addEventListener("pointerup", endCanvasPointer);
    window.addEventListener("pointercancel", endCanvasPointer);

    window.addEventListener("wheel", function (e) {
      camDist = Math.max(6.5, Math.min(22, camDist + e.deltaY * 0.01));
    }, { passive: true });

    /* ③ 右下ミニマップのクリック／タップでその地点へ瞬間高速ワープ！ */
    document.getElementById("minimap").addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation();
      ensureAC();
      var cv = document.getElementById("minimap");
      var r = cv.getBoundingClientRect();
      var px = ((e.clientX - r.left) / r.width) * cv.width;
      var pz = ((e.clientY - r.top) / r.height) * cv.height;
      var cx = cv.width * 0.5, cy = cv.height * 0.5;
      var sc = (cv.width * 0.46) / WORLD_R;
      var wx = (px - cx) / sc;
      var wz = (pz - cy) / sc;
      var safe = nudgeOutOfPond(wx, wz, 2.0);
      cancelAutoMove();
      player.x = safe.x;
      player.z = safe.z;
      spawnPillarFX(player.x, player.z, 0x5ce1e6, 2.4, 9, 0.45);
      showToast("⚡ ミニマップ瞬間移動！");
    });

    /* ④ キーボード入力（Windows直接フォーカス時 ＆ 親フレーム index.html からの自動転送の両対応！） */
    function normalizeKeyTokens(code, key) {
      var list = [];
      if (code) list.push(code);
      if (key) {
        var lk = String(key).toLowerCase();
        if (lk === "w") list.push("KeyW");
        else if (lk === "a") list.push("KeyA");
        else if (lk === "s") list.push("KeyS");
        else if (lk === "d") list.push("KeyD");
        else if (lk === "e") list.push("KeyE");
        else if (lk === "f") list.push("KeyF");
        else if (lk === "q") list.push("KeyQ");
        else if (lk === "1") list.push("Digit1");
        else if (lk === "2") list.push("Digit2");
        else if (lk === "3") list.push("Digit3");
        else if (lk === "4") list.push("Digit4");
        else if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") list.push(key);
        else if (key === "Shift") list.push("ShiftLeft");
        else if (key === " ") list.push("Space");
        else if (key === "Enter") list.push("Enter");
      }
      return list;
    }

    function handleUnifiedKey(code, key, isDown) {
      var tokens = normalizeKeyTokens(code, key);
      if (!isDown) {
        for (var u = 0; u < tokens.length; u++) {
          keys[tokens[u]] = false;
          if (tokens[u] === "Space" && charging) releaseCharge();
        }
        return;
      }
      if (STATE.paused) return;
      var wasShift = !!(keys["ShiftLeft"] || keys["ShiftRight"]);
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i];
        keys[tk] = true;
        if (tk === "Digit1") selectClub(0);
        else if (tk === "Digit2") selectClub(1);
        else if (tk === "Digit3") selectClub(2);
        else if (tk === "Digit4") selectClub(3);
        else if (tk === "KeyE") triggerForeRoar();
        else if (tk === "KeyF") triggerClosePush();
        else if (tk === "KeyQ") { postToParent({ type: "goat:quickSave" }); showToast("💾 クイックセーブ完了"); }
        else if (tk === "Space") { if (!charging) startCharge(null); }
        else if (tk === "Enter" && activePromptLandmark) { executeLandmarkAction(activePromptLandmark); }
        else if ((tk === "ShiftLeft" || tk === "ShiftRight") && !wasShift) { triggerDashBurst(); }
      }
    }

    window.addEventListener("keydown", function (e) {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "ArrowLeft" || e.code === "ArrowRight") {
        e.preventDefault();
      }
      handleUnifiedKey(e.code, e.key, true);
    });
    window.addEventListener("keyup", function (e) {
      handleUnifiedKey(e.code, e.key, false);
    });
    window.addEventListener("blur", function () {
      keys = {};
      if (stickVec.active) resetVirtualStick();
    });

    document.getElementById("interactPrompt").onclick = function () {
      if (activePromptLandmark) executeLandmarkAction(activePromptLandmark);
    };

    function executeLandmarkAction(lm) {
      if (!lm || !lm.action) return;
      var act = lm.action;
      if (act.type === "facility") {
        postToParent({ type: "goat:openFacility", facility: act.facility });
      } else if (act.type === "branch") {
        postToParent({ type: "goat:triggerBranch", eventKey: act.eventKey });
      } else if (act.type === "subtrial_hint") {
        if (STATE.subTrialDone) {
          showToast("✓ この聖地の神話試練はすでに制覇しています");
        } else {
          showBanner("⚡ 神話の試練", "池の上に浮かぶ蒼き結晶へ四神波動ショットを撃ち込め！");
        }
      } else if (act.type === "duel") {
        if (!isDuelGateOpen()) {
          showBanner("🔒 決戦の門は封印されている", "先に聖地の残影をあと " + (2 - countPurified()) + " 体浄化せよ！");
          playSfx("hurt");
          return;
        }
        postToParent({ type: "goat:toGolf" });
      }
    }

    /* =========================================================================
       第7部：炎のパワーCanvas・運命の糸Canvas・ミニマップ描画・メインループ
       ========================================================================= */
    function updateHudNumbers() {
      document.getElementById("hudName").textContent = STATE.playerName;
      document.getElementById("hudRank").textContent = STATE.rankTitle;
      var gs = STATE.gearStats || {};
      var inf = (STATE.mode === "goat" || (gs.specials && gs.specials.yasakani_eternal));
      document.getElementById("ballNum").textContent = inf ? "∞" : STATE.balls;
      document.getElementById("pureNum").textContent = AREA_IDX === 5 ? "神域" : (countPurified() + "/" + MOBS.length);
      document.getElementById("goldNum").textContent = "¥" + (STATE.gold || 0).toLocaleString();
      document.getElementById("powerNum").textContent = Math.round(STATE.power) + "%";
      document.getElementById("mentalNum").textContent = Math.round(STATE.mental) + "%";
      document.getElementById("btnFore").disabled = player.foreCd > 0;
      document.getElementById("btnFore").textContent = player.foreCd > 0 ? ("[E] FORE!(" + Math.ceil(player.foreCd) + "s)") : "[E] 📢 FORE!咆哮";
    }

    var flameCv = document.getElementById("flameCanvas");
    var flameCtx = flameCv.getContext("2d");
    var threadCv = document.getElementById("threadCanvas");
    var threadCtx = threadCv.getContext("2d");
    var miniCv = document.getElementById("minimap");
    var miniCtx = miniCv.getContext("2d");

    function renderGauges(t) {
      /* ① 炎のパワーゲージ（満タン時は静かな蒼金の炎、低下時は激しく揺れる紅蓮の炎） */
      var pw = Math.max(0, Math.min(100, STATE.power));
      var W = flameCv.width, H = flameCv.height;
      flameCtx.clearRect(0, 0, W, H);
      var fillW = (pw / 100) * W;
      var turb = pw >= 75 ? 1.8 : (pw >= 40 ? 3.6 : 6.5);
      var grad = flameCtx.createLinearGradient(0, 0, W, 0);
      if (pw >= 75) {
        grad.addColorStop(0, "#1e90ff"); grad.addColorStop(0.55, "#5ce1e6"); grad.addColorStop(1, "#ffe57f");
      } else if (pw >= 40) {
        grad.addColorStop(0, "#ff6b35"); grad.addColorStop(0.6, "#ffb142"); grad.addColorStop(1, "#fff275");
      } else {
        grad.addColorStop(0, "#8b0000"); grad.addColorStop(0.5, "#ff2e4c"); grad.addColorStop(1, "#ff9f43");
      }
      flameCtx.fillStyle = grad;
      flameCtx.beginPath();
      flameCtx.moveTo(0, H);
      for (var x = 0; x <= fillW; x += 6) {
        var waveY = 3 + Math.sin(x * 0.14 - t * 9) * turb * 0.45 + Math.cos(x * 0.27 + t * 13) * turb * 0.3;
        flameCtx.lineTo(x, Math.max(1, waveY));
      }
      flameCtx.lineTo(fillW, H);
      flameCtx.closePath();
      flameCtx.fill();

      /* ② 運命の糸メンタルゲージ（絹糸の光沢振動） */
      var mn = Math.max(0, Math.min(100, STATE.mental));
      var TW = threadCv.width, TH = threadCv.height;
      threadCtx.clearRect(0, 0, TW, TH);
      var mW = (mn / 100) * TW;
      for (var s = 0; s < 3; s++) {
        threadCtx.beginPath();
        for (var tx = 0; tx <= mW; tx += 8) {
          var ty = TH * 0.5 + Math.sin(tx * 0.08 + t * 5 + s * 1.5) * (1.5 + (100 - mn) * 0.03);
          if (tx === 0) threadCtx.moveTo(tx, ty); else threadCtx.lineTo(tx, ty);
        }
        threadCtx.strokeStyle = s === 0 ? "#e2d4ff" : (s === 1 ? "#a57dff" : "#5ce1e6");
        threadCtx.lineWidth = s === 0 ? 2.4 : 1.3;
        threadCtx.stroke();
      }
    }

    function renderMinimap() {
      var W = miniCv.width, H = miniCv.height, cx = W / 2, cy = H / 2, sc = (W * 0.46) / WORLD_R;
      miniCtx.clearRect(0, 0, W, H);
      miniCtx.fillStyle = "rgba(10, 26, 18, 0.92)";
      miniCtx.beginPath(); miniCtx.arc(cx, cy, W * 0.48, 0, Math.PI * 2); miniCtx.fill();
      miniCtx.strokeStyle = "rgba(255,216,117,0.4)"; miniCtx.lineWidth = 1.5; miniCtx.stroke();

      /* 池・バンカー */
      PONDS.forEach(function (pd) {
        miniCtx.fillStyle = "rgba(38, 145, 210, 0.75)";
        miniCtx.beginPath(); miniCtx.arc(cx + pd.x * sc, cy + pd.z * sc, pd.r * sc, 0, Math.PI * 2); miniCtx.fill();
      });
      BUNKERS.forEach(function (bk) {
        miniCtx.fillStyle = "rgba(235, 212, 158, 0.72)";
        miniCtx.beginPath(); miniCtx.arc(cx + bk.x * sc, cy + bk.z * sc, bk.r * sc, 0, Math.PI * 2); miniCtx.fill();
      });

      /* 施設・祠・決戦の門 */
      LANDMARKS.forEach(function (lm) {
        miniCtx.fillStyle = lm.isGate ? (isDuelGateOpen() ? "#ff4d5a" : "#7c5295") : "#ffd875";
        miniCtx.beginPath();
        miniCtx.arc(cx + lm.x * sc, cy + lm.z * sc, lm.isGate ? 4.5 : 3.2, 0, Math.PI * 2);
        miniCtx.fill();
      });

      /* 残影（未浄化：紫、浄化済：緑） */
      MOBS.forEach(function (m) {
        miniCtx.fillStyle = m.purified ? "#44e587" : "#c56cf0";
        miniCtx.beginPath();
        miniCtx.arc(cx + m.x * sc, cy + m.z * sc, m.purified ? 3.0 : 3.8, 0, Math.PI * 2);
        miniCtx.fill();
      });

      /* 主人公と視線コーン */
      var px = cx + player.x * sc, pz = cy + player.z * sc;
      miniCtx.fillStyle = "rgba(255, 255, 255, 0.22)";
      miniCtx.beginPath();
      miniCtx.moveTo(px, pz);
      miniCtx.arc(px, pz, 13, Math.PI * 0.5 - player.rotY - 0.42, Math.PI * 0.5 - player.rotY + 0.42);
      miniCtx.closePath();
      miniCtx.fill();

      miniCtx.fillStyle = "#ffffff";
      miniCtx.beginPath(); miniCtx.arc(px, pz, 4.0, 0, Math.PI * 2); miniCtx.fill();
    }

    /* メインゲームループ */
    var clock = new THREE.Clock();
    var elapsed = 0;

    function animate() {
      requestAnimationFrame(animate);
      var dt = Math.min(0.05, clock.getDelta());
      if (STATE.paused || document.hidden) {
        return; /* v4.5: 対戦中・非表示中は描画自体を止め、GPU/帯域を対戦側へ譲る（状態は保持され復帰は即時） */
      }
      if (hitstopTimer > 0) {
        hitstopTimer -= dt;
        renderer.render(scene, camera);
        return;
      }

      elapsed += dt;
      waterUniforms.uTime.value = elapsed;
      if (skyUniforms.uFlash.value > 0) skyUniforms.uFlash.value = Math.max(0, skyUniforms.uFlash.value - dt * 2.8);

      if (player.hurtCd > 0) player.hurtCd = Math.max(0, player.hurtCd - dt);
      if (player.foreCd > 0) {
        player.foreCd = Math.max(0, player.foreCd - dt);
        if (player.foreCd === 0) updateHudNumbers();
      }
      if (player.pushCd > 0) player.pushCd = Math.max(0, player.pushCd - dt);

      /* スイング腕の自然復帰 */
      var armP = playerMesh.userData.armPivot;
      armP.rotation.x += (0 - armP.rotation.x) * Math.min(1, dt * 10);

      /* 神装オーラ演出 */
      var gs = STATE.gearStats || {};
      if (gs.setGodComplete || gs.setThree || gs.setOlympus) {
        sacredAuraRing.material.opacity = 0.52 + Math.sin(elapsed * 4) * 0.18;
        sacredAuraRing.material.color.setHex(gs.setGodComplete ? 0x5ce1e6 : 0xffd875);
        sacredAuraRing.rotation.z = elapsed * 1.4;
      } else {
        sacredAuraRing.material.opacity = 0;
      }

      /* 波動チャージ3段階演出（カメラドリーイン＋Lv3暗雲雷鳴） */
      var targetFov = 52;
      if (charging) {
        chargeTime += dt;
        var pct = Math.min(100, (chargeTime / 1.35) * 100);
        document.getElementById("chargeFill").style.width = pct + "%";
        var lv = chargeTime >= 1.28 ? 3 : (chargeTime >= 0.58 ? 2 : 1);
        var lvEl = document.getElementById("chargeLv");
        lvEl.textContent = lv === 3 ? "Lv.3 MAX（神威覚醒！）" : ("Lv." + lv);
        lvEl.style.color = lv === 3 ? "#ff6b81" : (lv === 2 ? "#ffd875" : "#5ce1e6");

        chargeOrb.material.opacity = 0.45 + lv * 0.18;
        chargeOrb.material.color.setHex(lv === 3 ? 0xffd875 : (lv === 2 ? 0x7ee8fa : 0x48dbfb));
        chargeOrb.scale.setScalar(0.8 + Math.sin(elapsed * 22) * 0.18 + lv * 0.35);

        targetFov = lv === 3 ? 44 : (lv === 2 ? 48 : 50.5);
        skyUniforms.uStorm.value += ((lv === 3 ? 0.85 : (lv === 2 ? 0.25 : 0)) - skyUniforms.uStorm.value) * dt * 4;
        if (lv === 3 && Math.random() < 0.05) skyUniforms.uFlash.value = 0.55;
      } else {
        skyUniforms.uStorm.value += (0 - skyUniforms.uStorm.value) * dt * 5;
      }
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 7);
      camera.updateProjectionMatrix();

      /* WASD・矢印・360°バーチャルスティック・地面タップ自動ダッシュ統合高速移動エンジン */
      if (dashBurstTimer > 0) dashBurstTimer = Math.max(0, dashBurstTimer - dt);

      var kbX = (keys["KeyD"] || keys["ArrowRight"] ? 1 : 0) - (keys["KeyA"] || keys["ArrowLeft"] ? 1 : 0);
      var kbZ = (keys["KeyS"] || keys["ArrowDown"] ? 1 : 0) - (keys["KeyW"] || keys["ArrowUp"] ? 1 : 0);
      var inX = kbX + stickVec.x;
      var inZ = kbZ + stickVec.y;
      var manualMag = Math.hypot(inX, inZ);

      if (manualMag > 0.05) {
        if (autoMove.active) cancelAutoMove();
      }

      var moveWorldX = 0, moveWorldZ = 0, activeSpeedRatio = 0;
      var isTurbo = !!(keys["ShiftLeft"] || keys["ShiftRight"] || boostHeld || dashBurstTimer > 0);
      var baseRunSpd = alwaysDash ? 27.0 : 17.5;
      var maxSpd = baseRunSpd * (isTurbo ? 1.32 : 1.0) * (1 + (gs.walkSpdPct || 0) * 0.008) * (charging ? 0.78 : 1.0);
      if (dashBurstTimer > 0) maxSpd = Math.max(maxSpd, 37.5);
      if (isInBunker(player.x, player.z)) maxSpd *= 0.84;

      if (manualMag > 0.05) {
        var normScale = Math.min(1, manualMag);
        var dirInX = inX / manualMag, dirInZ = inZ / manualMag;
        var fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw);
        var rgtX = Math.cos(camYaw), rgtZ = -Math.sin(camYaw);
        moveWorldX = (fwdX * (-dirInZ) + rgtX * dirInX) * maxSpd * normScale;
        moveWorldZ = (fwdZ * (-dirInZ) + rgtZ * dirInX) * maxSpd * normScale;
        activeSpeedRatio = normScale * (alwaysDash || isTurbo ? 1.25 : 0.85);

        /* スティック／横移動時、カメラをドラッグしていなければ緩やかに背後へオート追従して片手操作を快適化 */
        if (activeCanvasPointerList().length === 0 && (stickVec.mag > 0.15 || floatStickState.active)) {
          camYaw -= dirInX * 0.95 * normScale * dt;
        }
      } else if (autoMove.active) {
        /* 地面クリック／タップ目的地への自動高速スプリント（池自動迂回つき！） */
        var adx = autoMove.x - player.x, adz = autoMove.z - player.z;
        var adist = Math.hypot(adx, adz);
        var stopR = autoMove.landmark ? Math.max(1.4, autoMove.landmark.r - 0.8) : 0.75;
        if (adist <= stopR) {
          var arrivedLM = autoMove.landmark;
          cancelAutoMove();
          if (arrivedLM) executeLandmarkAction(arrivedLM);
        } else {
          var ux = adx / adist, uz = adz / adist;
          /* 前方に池がある場合は接線方向へスマートに迂回して池ポチャを防止 */
          var lookX = player.x + ux * 2.6, lookZ = player.z + uz * 2.6;
          for (var piP = 0; piP < PONDS.length; piP++) {
            var pdA = PONDS[piP];
            var pdxA = lookX - pdA.x, pdzA = lookZ - pdA.z;
            var pDistA = Math.hypot(pdxA, pdzA);
            if (pDistA < pdA.r + 1.5) {
              var txA = -pdzA / (pDistA || 1), tzA = pdxA / (pDistA || 1);
              if (txA * ux + tzA * uz < 0) { txA = -txA; tzA = -tzA; }
              ux = txA; uz = tzA;
              break;
            }
          }
          var autoSpd = Math.min(maxSpd * 1.06, Math.max(10, adist * 6.5));
          moveWorldX = ux * autoSpd;
          moveWorldZ = uz * autoSpd;
          activeSpeedRatio = 1.25;
        }
      }

      /* 目的地3Dリングの脈動アニメーション */
      if (moveTargetGroup.visible) {
        var pulseS = 1.0 + Math.sin(elapsed * 8) * 0.16;
        moveTargetGroup.userData.r1.scale.set(pulseS, pulseS, 1);
        moveTargetGroup.userData.pin.position.y = 0.85 + Math.sin(elapsed * 7) * 0.18;
        moveTargetGroup.rotation.y = elapsed * 2.5;
      }

      /* 慣性ゼロのキビキビした加減速補間 */
      player.vx += (moveWorldX - player.vx) * Math.min(1, dt * 20);
      player.vz += (moveWorldZ - player.vz) * Math.min(1, dt * 20);
      var curSpd = Math.hypot(player.vx, player.vz);

      if (curSpd > 0.25) {
        var nx = player.x + player.vx * dt, nz = player.z + player.vz * dt;

        /* 池ポチャ判定（1球ロスト＆岸へ安全復帰／ヤサカニ・GOATならロスト無効！） */
        if (isInPond(nx, nz)) {
          cancelAutoMove();
          playSfx("splash");
          var infBall = (STATE.mode === "goat" || (gs.specials && gs.specials.yasakani_eternal));
          if (infBall) {
            showToast("🔮 ヤサカニの水上加護！ ボールロスト無効で岸へ戻った");
          } else if (STATE.balls > 0) {
            STATE.balls = Math.max(0, STATE.balls - 1);
            postToParent({ type: "goat:worldUpdate", addBalls: -1 });
            updateHudNumbers();
            showToast("💧 池ポチャ！ ボールを1球ロストした……");
          }
          var safeShore = nudgeOutOfPond(player.x - player.vx * dt * 1.5, player.z - player.vz * dt * 1.5, 1.8);
          player.x = safeShore.x;
          player.z = safeShore.z;
          player.vx = 0; player.vz = 0;
        } else {
          var distC = Math.hypot(nx, nz);
          if (distC > WORLD_R - 3) {
            nx *= (WORLD_R - 3) / distC;
            nz *= (WORLD_R - 3) / distC;
          }
          player.x = nx; player.z = nz;
        }
        if (!charging) {
          player.rotY = Math.atan2(player.vx, player.vz);
        }

        /* 高速走行ストライド脚アニメーション ＆ 疾走風エフェクト */
        stridePhase += dt * (8 + curSpd * 0.58);
        var legSwing = Math.sin(stridePhase) * Math.min(0.82, 0.25 + curSpd * 0.022);
        var pLegs = playerMesh.userData.legs;
        if (pLegs && pLegs.length === 2) {
          pLegs[0].rotation.x = legSwing;
          pLegs[1].rotation.x = -legSwing;
        }
        if (!charging) {
          armP.rotation.x = -legSwing * 0.55;
        }
        if (!charging && curSpd > 22) {
          camera.fov += (56.2 - camera.fov) * Math.min(1, dt * 6);
          camera.updateProjectionMatrix();
          sprintDustAcc += curSpd * dt;
          if (sprintDustAcc > 7.5) {
            sprintDustAcc = 0;
            spawnGroundGroove(player.x, player.z, player.rotY, isTurbo ? 0x5ce1e6 : 0xffd875);
          }
        }
      } else {
        player.vx = 0; player.vz = 0;
        var pLegsIdle = playerMesh.userData.legs;
        if (pLegsIdle && pLegsIdle.length === 2) {
          pLegsIdle[0].rotation.x *= Math.max(0, 1 - dt * 14);
          pLegsIdle[1].rotation.x *= Math.max(0, 1 - dt * 14);
        }
      }

      var bobY = curSpd > 0.5 ? Math.abs(Math.sin(stridePhase)) * 0.09 : 0;
      playerMesh.position.set(player.x, terrainY(player.x, player.z) + bobY, player.z);
      playerMesh.rotation.y = player.rotY;

      /* フィールド拾得ボール回収＆リスポーン */
      PICKUPS.forEach(function (pk) {
        if (pk.active) {
          pk.mesh.rotation.y = elapsed * 2.2;
          if (Math.hypot(pk.x - player.x, pk.z - player.z) < 1.85) {
            pk.active = false;
            pk.respawn = 18.0;
            pk.mesh.visible = false;
            playSfx("pickup");
            if (STATE.mode !== "goat") {
              STATE.balls += 2;
              postToParent({ type: "goat:worldUpdate", addBalls: 2 });
            }
            updateHudNumbers();
            showToast("⚪ ツアーボール +2球 を拾得！");
          }
        } else {
          pk.respawn -= dt;
          if (pk.respawn <= 0) { pk.active = true; pk.mesh.visible = true; }
        }
      });

      /* 飛翔中の四神波動弾更新 ＆ 神話試練クリスタル命中判定 */
      for (var pi = PROJECTILES.length - 1; pi >= 0; pi--) {
        var p = PROJECTILES[pi];
        var stepD = Math.hypot(p.vx * dt, p.vz * dt);
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.dist += stepD;
        p.stepAcc = (p.stepAcc || 0) + stepD;

        if (p.club === 0) {
          p.y = terrainY(p.x, p.z) + 1.05;
          p.mesh.rotation.z += dt * 16;
          p.mesh.rotation.x += dt * 12;
          if (p.stepAcc > 1.8) { p.stepAcc = 0; spawnGroundGroove(p.x, p.z, p.rotY, p.color); }
        } else if (p.club === 1) {
          p.vy -= 5.2 * dt;
          p.y = Math.max(terrainY(p.x, p.z) + 0.65, p.y + p.vy * dt);
          /* 最寄りの未浄化残影へゆるやかに誘導（光羽ホーミング） */
          var bestM = null, bestD = 14;
          for (var mi = 0; mi < MOBS.length; mi++) {
            if (MOBS[mi].purified) continue;
            var dm = Math.hypot(MOBS[mi].x - p.x, MOBS[mi].z - p.z);
            if (dm < bestD) { bestD = dm; bestM = MOBS[mi]; }
          }
          if (bestM) {
            var tx = bestM.x - p.x, tz = bestM.z - p.z, tl = Math.hypot(tx, tz) || 1;
            p.vx += (tx / tl) * 26 * dt;
            p.vz += (tz / tl) * 26 * dt;
          }
          p.mesh.lookAt(p.x + p.vx, p.y, p.z + p.vz);
        } else if (p.club === 2) {
          p.age += dt;
          p.vy -= 28 * dt;
          p.y += p.vy * dt;
          var gy = terrainY(p.x, p.z);
          if (p.y <= gy + 0.25 || p.age >= p.flightT) {
            /* 白虎着弾：天からの垂直光柱＋虎爪地割れ（バンカーなら砂煙目くらまし！） */
            playSfx("byakko_land");
            var sandBlind = p.fromBunker || isInBunker(p.x, p.z);
            spawnPillarFX(p.x, p.z, sandBlind ? 0xf6d365 : 0xffffff, 3.2 + p.lv * 0.8, 22, 0.75);
            spawnTigerClaws(p.x, p.z, sandBlind);
            var aoeR = (sandBlind ? 10.5 : 5.8) + p.lv * 1.2;
            MOBS.forEach(function (m) {
              if (!m.purified && Math.hypot(m.x - p.x, m.z - p.z) <= aoeR) {
                damageMob(m, p.dmg, { isCrit: p.isCrit, stunSec: sandBlind ? 5.0 : 1.5, blindSec: sandBlind ? 5.0 : 0 });
              }
            });
            if (sandBlind) showToast("🌪 白虎・バンカー砂煙目くらまし発動！（周囲5秒スタン）");
            checkSubTrialCrystalHit(p.x, gy + 2, p.z, 6.5);
            scene.remove(p.mesh);
            PROJECTILES.splice(pi, 1);
            continue;
          }
        } else if (p.club === 3) {
          p.y = terrainY(p.x, p.z) + 0.22;
          p.mesh.rotation.y += dt * 8;
          if (p.stepAcc > 2.2) { p.stepAcc = 0; spawnHexRipple(p.x, p.z, 0x2ed573); }
        }

        p.mesh.position.set(p.x, p.y, p.z);

        /* 神話の試練クリスタルへの命中判定 */
        if (checkSubTrialCrystalHit(p.x, p.y, p.z, 2.8) && !p.pierce) {
          scene.remove(p.mesh);
          PROJECTILES.splice(pi, 1);
          continue;
        }

        /* 残影との衝突判定（青龍・朱雀・玄武） */
        if (p.club !== 2) {
          var removeProj = false;
          for (var mj = 0; mj < MOBS.length; mj++) {
            var mob = MOBS[mj];
            if (mob.purified || p.hitMap[mob.id]) continue;
            if (Math.hypot(mob.x - p.x, mob.z - p.z) < 1.55) {
              p.hitMap[mob.id] = true;
              if (p.club === 0 && (p.lv === 3 || p.isCrit)) {
                spawnPillarFX(mob.x, mob.z, p.color, 1.8, 18, 0.55);
              }
              damageMob(mob, p.dmg, {
                isCrit: p.isCrit,
                stunSec: p.club === 3 ? 4.5 : (p.lv === 3 ? 1.4 : 0.4),
                stealth: !!p.stealth
              });
              if (p.club === 3) showToast("🐢 玄武・隠密確定スタン！（4.5秒静止）");
              if (!p.pierce) { removeProj = true; break; }
            }
          }
          if (removeProj || p.dist >= p.maxDist) {
            scene.remove(p.mesh);
            PROJECTILES.splice(pi, 1);
          }
        }
      }

      /* 残影AI更新 ＆ 画面端の黒紫脅威オーラ更新 */
      var nearestThreat = 999;
      var detectBase = (gs.specials && gs.specials.hades_stealth) ? 8.5 : 14.5; // ハデスの隠れ兜で感知距離激減！
      MOBS.forEach(function (m, idx) {
        if (m.purified) {
          /* 浄化済みのゴルファーは穏やかに素振り練習をする */
          m.mesh.userData.armPivot.rotation.x = Math.sin(elapsed * 2.2 + idx) * 0.45;
          return;
        }
        var dx = player.x - m.x, dz = player.z - m.z;
        var dist = Math.hypot(dx, dz);
        if (dist < nearestThreat) nearestThreat = dist;

        m.miasma.rotation.z = elapsed * 2.5;
        m.hpBg.lookAt(camera.position);
        m.hpFg.lookAt(camera.position);

        if (m.stunTimer > 0) {
          m.stunTimer = Math.max(0, m.stunTimer - dt);
          m.mesh.rotation.y += dt * 7; // スタン中ふらつき演出
          return;
        }

        if (dist < detectBase || m.alerted) {
          if (dist > 26) m.alerted = false;
          var spdM = m.cls === "大" ? 4.6 : (m.cls === "中" ? 5.2 : 5.8);
          var nxM = m.x + (dx / (dist || 1)) * spdM * dt;
          var nzM = m.z + (dz / (dist || 1)) * spdM * dt;
          if (!isInPond(nxM, nzM)) {
            m.x = nxM; m.z = nzM;
          }
          m.rotY = Math.atan2(dx, dz);
          m.mesh.userData.armPivot.rotation.x = Math.sin(elapsed * 9 + idx) * 0.65;

          /* 主人公への接触ダメージ（炎パワー減少／GOATモードは無敵！） */
          if (dist < 1.35 && player.hurtCd <= 0) {
            player.hurtCd = 1.25;
            if (STATE.mode !== "goat") {
              playSfx("hurt");
              STATE.power = Math.max(10, STATE.power - (m.cls === "大" ? 12 : 8));
              postToParent({ type: "goat:worldUpdate", power: STATE.power });
              updateHudNumbers();
              var hf = document.getElementById("hurtFlash");
              hf.style.opacity = "1";
              setTimeout(function () { hf.style.opacity = "0"; }, 180);
            }
          }
        } else {
          /* 巡回 */
          var patrolX = m.homeX + Math.sin(elapsed * 0.7 + idx * 1.7) * 3.5;
          var patrolZ = m.homeZ + Math.cos(elapsed * 0.6 + idx * 1.7) * 3.5;
          var pdx = patrolX - m.x, pdz = patrolZ - m.z, pdist = Math.hypot(pdx, pdz);
          if (pdist > 0.2) {
            m.x += (pdx / pdist) * 1.8 * dt;
            m.z += (pdz / pdist) * 1.8 * dt;
            m.rotY = Math.atan2(pdx, pdz);
          }
        }
        m.mesh.position.set(m.x, terrainY(m.x, m.z), m.z);
        m.mesh.rotation.y = m.rotY;
      });

      var auraEl = document.getElementById("threatAura");
      if (nearestThreat < detectBase + 2) {
        var pulse = 0.45 + 0.35 * Math.sin(elapsed * 7);
        auraEl.style.opacity = String(Math.min(0.92, (1 - nearestThreat / (detectBase + 3)) * 1.25 * pulse + 0.2));
      } else {
        auraEl.style.opacity = "0";
      }

      /* エフェクト寿命更新 */
      for (var fi = FX_LIST.length - 1; fi >= 0; fi--) {
        var fx = FX_LIST[fi];
        fx.age += dt;
        var k = fx.age / fx.dur;
        if (k >= 1) {
          scene.remove(fx.mesh);
          FX_LIST.splice(fi, 1);
          continue;
        }
        fx.mesh.material.opacity = (1 - k) * 0.85;
        if (fx.kind === "pillar") {
          fx.mesh.scale.set(1 + k * 0.5, 1, 1 + k * 0.5);
        } else if (fx.kind === "expand_ring" || fx.kind === "expand_hex") {
          var s = 1 + k * 4.2;
          fx.mesh.scale.set(s, s, 1);
        } else if (fx.kind === "sand_dome") {
          var sd = 0.5 + k * 1.6;
          fx.mesh.scale.set(sd, sd * 0.7, sd);
        }
      }

      /* ランドマーク結晶アニメーション＆接触プロンプト判定 */
      var foundLM = null;
      LANDMARKS.forEach(function (lm) {
        if (lm.crystal) {
          lm.crystal.rotation.y = elapsed * 1.8;
          lm.crystal.position.y = 2.1 + Math.sin(elapsed * 2.6 + lm.x) * 0.22;
        }
        if (Math.hypot(lm.x - player.x, lm.z - player.z) < lm.r) {
          foundLM = lm;
        }
      });
      activePromptLandmark = foundLM;
      var prEl = document.getElementById("interactPrompt");
      if (foundLM) {
        prEl.style.display = "block";
        document.getElementById("promptLabel").textContent = foundLM.label;
      } else {
        prEl.style.display = "none";
      }

      if (subTrialTargetMesh && subTrialTargetMesh.visible) {
        subTrialTargetMesh.rotation.y = elapsed * 2.4;
        subTrialTargetMesh.position.y = terrainY(26, -18) + 3.4 + Math.sin(elapsed * 3) * 0.35;
      }
      celestialRings.forEach(function (r, i) { r.rotation.z = elapsed * (0.12 + i * 0.08); });

      /* 環境粒子の舞い */
      var pArr = envParticles.geometry.attributes.position;
      for (var ei = 0; ei < pArr.count; ei++) {
        var py = pArr.getY(ei) - dt * 0.75;
        var pxE = pArr.getX(ei) + Math.sin(elapsed + ei) * dt * 0.4;
        if (py < 0.5) py = 20;
        pArr.setY(ei, py);
        pArr.setX(ei, pxE);
      }
      pArr.needsUpdate = true;

      /* 3人称カメラ追従＋インパクトシェイク */
      var shakeX = 0, shakeY = 0;
      if (camShake > 0) {
        shakeX = (Math.random() - 0.5) * camShake;
        shakeY = (Math.random() - 0.5) * camShake;
        camShake = Math.max(0, camShake - dt * 1.8);
      }
      var pyTerrain = terrainY(player.x, player.z);
      var cxCam = player.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist + shakeX;
      var cyCam = pyTerrain + 1.8 + Math.sin(camPitch) * camDist + shakeY;
      var czCam = player.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist;
      cyCam = Math.max(terrainY(cxCam, czCam) + 1.2, cyCam);
      camera.position.lerp(new THREE.Vector3(cxCam, cyCam, czCam), Math.min(1, dt * 14));
      camera.lookAt(player.x, pyTerrain + 1.45, player.z);

      renderGauges(elapsed);
      renderMinimap();
      renderer.render(scene, camera);
    }

    function checkSubTrialCrystalHit(x, y, z, hitR) {
      if (!subTrialTargetMesh || !subTrialTargetMesh.visible || STATE.subTrialDone) return false;
      var tp = subTrialTargetMesh.position;
      if (Math.hypot(tp.x - x, tp.z - z) < hitR) {
        STATE.subTrialDone = true;
        subTrialTargetMesh.visible = false;
        if (subTrialTargetMesh.userData.beam) subTrialTargetMesh.userData.beam.visible = false;
        playSfx("purify");
        spawnPillarFX(tp.x, tp.z, 0x5ce1e6, 4.2, 24, 1.2);
        showBanner("⚡ 神話の試練 達成！！", "池上の神話結晶を射抜いた！");
        postToParent({ type: "goat:subTrialWin" });
        return true;
      }
      return false;
    }

    /* 親フレーム（index.html）との通信ブリッジ */
    function postToParent(msg) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, "*");
      }
    }

    /* v4.5: 文書破棄時に WebGL を明示解放し、遷移ピークの GPU メモリを下げる */
    window.addEventListener("pagehide", function () {
      try { if (renderer) { if (renderer.forceContextLoss) renderer.forceContextLoss(); try { renderer.dispose(); } catch (e2) {} } } catch (e) {}
    });

    window.addEventListener("message", function (ev) {
      var d = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "goat:pause") { STATE.paused = true; keys = {}; resetVirtualStick(); return; }
      if (d.type === "goat:resume") { STATE.paused = false; startAmbient(); return; }
      if (d.type === "goat:key") { handleUnifiedKey(d.code, d.key, !!d.down); return; }
      if (d.type === "goat:syncState") {
        STATE.mode = d.mode || STATE.mode;
        STATE.playerName = d.playerName || STATE.playerName;
        if (d.rank && d.rank.title) STATE.rankTitle = d.rank.title + " (" + d.rank.hc + ")";
        if (typeof d.power === "number") STATE.power = d.power;
        if (typeof d.mental === "number") STATE.mental = d.mental;
        if (typeof d.balls === "number") STATE.balls = d.balls;
        /* LAYOUT FIX v4.0（③GOATは全ステータス常時フル：同期で受けてもフルを維持する） */
        if (STATE.mode === "goat") { STATE.power = 100; STATE.mental = 100; STATE.balls = 999; }
        if (typeof d.gold === "number") STATE.gold = d.gold;
        if (typeof d.tp === "number") STATE.tp = d.tp;
        if (d.gearStats) STATE.gearStats = d.gearStats;
        STATE.subTrialDone = !!d.subTrialDone;
        /* v4.1（項目7）: エリアボス撃破済みなら「天岩戸の光が戻った」状態として大気を完全浄化側へ */
        STATE.bossDefeated = !!d.bossDefeated;
        refreshPurificationAtmosphere();
        if (subTrialTargetMesh) {
          subTrialTargetMesh.visible = !STATE.subTrialDone;
          if (subTrialTargetMesh.userData.beam) subTrialTargetMesh.userData.beam.visible = !STATE.subTrialDone;
        }
        spawnAreaMobs(d.areaMobs, d.purifiedMobs);
        updateHudNumbers();
      }
    });

    window.addEventListener("resize", function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    /* スタンドアロン直接起動時も即動作するよう初期スポーンを実行し、親へ挨拶送信 */
    spawnAreaMobs(null, []);
    updateHudNumbers();
    postToParent({ type: "goat:hello" });
    animate();
  
;

/* v4.1（項目17）: Three.js が読み込めなかった場合の代替表示（本体が起動していない時だけ出す） */
setTimeout(function(){
  if(typeof THREE === "undefined" && !document.getElementById("v41LoadFallback")){
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
}, 4000);

/* v4.1（項目8）: 時間の流れの表情 ― 太陽の方位と空の明るさが数分かけて静かに移ろう（エリア固有の空の色は変えない） */
(function(){
  var t0 = Date.now();
  var baseA = Math.atan2(-85, 58), R = Math.hypot(58, 85);
  setInterval(function(){
    if(typeof sunLight === "undefined" || typeof hemiLight === "undefined") return;
    if(typeof STATE !== "undefined" && STATE.paused) return;
    var t = (Date.now() - t0) / 1000;
    var ang = Math.sin(t * Math.PI * 2 / 300) * 0.22;
    sunLight.position.x = Math.cos(baseA + ang) * R;
    sunLight.position.z = Math.sin(baseA + ang) * R;
    hemiLight.intensity = 0.72 * Math.PI * (1 + 0.07 * Math.sin(t * Math.PI * 2 / 180));
  }, 1000);
})();
