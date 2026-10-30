// game.js — motor del joc: entrada, física per estats, combat i dibuix.
(function () {
  'use strict';
  const { TW, RH, ROWS, COLS, NROOMS, ROOMW, GAMEH, POTIONS, floorY } = Level;
  const A = Anims.A;
  const W = 320, H = 204;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const R = new Sprite.Renderer();
  const msgEl = document.getElementById('msg');
  const overlay = document.getElementById('overlay');

  // ---- so (sintetitzat amb WebAudio) ---------------------------------------
  const Snd = {
    ac: null,
    init() { if (!this.ac) try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* sense so */ } },
    tone(f0, f1, dur, type, vol) {
      if (!this.ac) return;
      const t = this.ac.currentTime, o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.ac.destination); o.start(t); o.stop(t + dur);
    },
    noise(dur, vol, freq) {
      if (!this.ac) return;
      const n = Math.floor(this.ac.sampleRate * dur), b = this.ac.createBuffer(1, n, this.ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
      s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
      s.connect(f).connect(g).connect(this.ac.destination); s.start();
    },
    play(k) {
      switch (k) {
        case 'clang': this.tone(1800, 900, 0.25, 'square', 0.05); this.noise(0.08, 0.15, 6000); break;
        case 'hit': this.tone(160, 60, 0.2, 'sawtooth', 0.12); this.noise(0.1, 0.2, 900); break;
        case 'land': this.noise(0.12, 0.25, 400); break;
        case 'slam': this.noise(0.3, 0.4, 300); this.tone(90, 40, 0.3, 'sine', 0.2); break;
        case 'swish': this.noise(0.12, 0.12, 2500); break;
        case 'gulp': this.tone(300, 600, 0.15, 'sine', 0.1); setTimeout(() => this.tone(350, 700, 0.15, 'sine', 0.1), 180); break;
        case 'door': this.noise(1.2, 0.15, 200); break;
        case 'lever': this.tone(260, 120, 0.12, 'square', 0.06); this.noise(0.1, 0.2, 700); break;
        case 'spikes': this.tone(900, 300, 0.1, 'square', 0.05); break;
        case 'death': this.tone(400, 60, 1.2, 'triangle', 0.15); break;
        case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.25, 'triangle', 0.1), i * 140)); break;
      }
    },
  };

  // ---- entrada ---------------------------------------------------------------
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ShiftLeft: 'act', ShiftRight: 'act', Space: 'act', KeyX: 'act' };
  const held = {}, pressed = {};
  addEventListener('keydown', (e) => {
    Snd.init();
    const k = KEYMAP[e.code];
    if (k) { if (!held[k]) pressed[k] = true; held[k] = true; e.preventDefault(); }
    if (e.code === 'Enter' && game.mode === 'title') start();
    if (e.code === 'Enter' && game.mode === 'dead') respawn();
    if (e.code === 'KeyR') start();
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) held[k] = false; });
  addEventListener('blur', () => { for (const k in held) held[k] = false; });
  document.querySelectorAll('[data-k]').forEach((b) => {
    const k = b.dataset.k;
    const on = (e) => { e.preventDefault(); Snd.init(); if (!held[k]) pressed[k] = true; held[k] = true; if (game.mode === 'title') start(); else if (game.mode === 'dead') respawn(); };
    const off = (e) => { e.preventDefault(); held[k] = false; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });
  overlay.addEventListener('click', () => { Snd.init(); if (game.mode === 'dead') respawn(); else start(); });

  // ---- món ----------------------------------------------------------------
  let L, bgs, prince, foes, debris, rubble, parts, tick;
  const game = { mode: 'title', fade: 0, timer: 0 };
  // cada tipus d'enemic: vida, probabilitat de parar un cop i d'atacar per tick
  const FOE_STATS = { guard: { hp: 3, block: 0.45, aggro: 0.05 }, mykola: { hp: 4, block: 0.55, aggro: 0.07 } };

  const tile = (c, r) => (c < 0 || c >= COLS || r < 0 ? { ch: '#' } : r >= ROWS ? { ch: ' ' } : L.tiles[r][c]);
  const isFloor = (c, r) => tile(c, r).ch !== ' ';
  const isWall = (c, r) => tile(c, r).ch === '#';
  const colOf = (x) => Math.floor(x / TW);
  const rowOf = (y) => Math.round((y - 60) / RH);
  const sign = (v) => (v < 0 ? -1 : 1);
  const say = (t) => { msgEl.textContent = t; };

  class Actor {
    constructor(kind, x, y, face) {
      Object.assign(this, { kind, x, y, face, vx: 0, vy: 0, hp: 3, maxHp: 3, scarf: 8, lastX: x, flash: 0, talk: 0, idleT: 0 });
      this.setAnim('idle', 0);
      this.state = 'idle';
    }
    setAnim(a, blend = 6) {
      this.from = blend && this.pose ? this.pose : null;
      this.blend = blend;
      this.anim = typeof a === 'string' ? A[a] : a;
      this.at = 0;
    }
    go(state, anim, blend) { this.state = state; this.setAnim(anim || state, blend); }
    get done() { return this.at >= this.anim.total; }
    computePose() {
      let p = Anims.poseAt(this.anim, this.at);
      if (this.from && this.at < this.blend) p = Sprite.lerpPose(this.from, p, this.at / this.blend);
      return (this.pose = p);
    }
    get row() { return rowOf(this.y); }
    get alive() { return this.hp > 0; }
    grounded() { return isFloor(colOf(this.x), this.row); }
    // moviment horitzontal amb col·lisió contra blocs de pedra i reixes tancades
    move(dx) {
      if (!dx) return true;
      const nx = this.x + dx, probe = nx + sign(dx) * 5, lead = this.x + sign(dx) * 5;
      const rows = this.state === 'air' || this.state === 'fall' ? [rowOf(this.y - 2), Math.floor((this.y - 30) / RH)] : [this.row];
      for (const r of rows) {
        if (isWall(colOf(probe), r)) {
          this.x = dx > 0 ? colOf(probe) * TW - 5.01 : (colOf(probe) + 1) * TW + 5.01;
          return false;
        }
        const t = tile(colOf(probe), r), gx = colOf(probe) * TW + 16;
        if (t.ch === 'G' && t.open < 0.85 && (dx > 0 ? lead <= gx && probe > gx : lead >= gx && probe < gx)) {
          this.x = gx - sign(dx) * 5.01;
          return false;
        }
      }
      this.x = nx;
      return true;
    }
  }

  function start() {
    L = Level.parse();
    bgs = Array.from({ length: NROOMS }, (_, i) => Level.renderRoom(L, i));
    // ?sala=N comença a la sala N, amb les reixes de les sales anteriors ja obertes
    const sala = Math.max(1, Math.min(NROOMS, parseInt(new URLSearchParams(location.search).get('sala'), 10) || 1)) - 1;
    for (const t of L.triggers) if (t.c < sala * 10) activate(t, true);
    const [sc, sr] = Level.START[sala];
    prince = new Actor('prince', sc * TW + 16, floorY(sr), 1);
    prince.chatCool = 60 * 8;
    foes = L.foes.map((f) => {
      const s = FOE_STATS[f.kind], a = new Actor(f.kind, f.c * TW + 16, floorY(f.r), -1);
      return Object.assign(a, { hp: s.hp, maxHp: s.hp, stats: s, cool: 60, shoutCool: 0, home: { x: a.x, y: a.y } });
    });
    debris = []; rubble = []; parts = []; tick = 0;
    newOlivia();
    Object.assign(game, { mode: 'play', fade: 0, timer: 0 });
    overlay.classList.add('hidden');
    if (window.speechSynthesis) speechSynthesis.cancel();
    say(sala ? 'Sala ' + (sala + 1) + '.' : 'Deu sales, palanques, reixes i guardes... Diego, troba la sortida del palau!');
  }

  const deathRoom = () => Math.max(0, Math.min(NROOMS - 1, Math.floor(prince.x / ROOMW)));

  // després de morir, en Diego torna a l'entrada de la sala on ha mort, amb la vida
  // plena. El món es queda com estava: reixes obertes, pocions begudes i enemics vençuts.
  function respawn() {
    const room = deathRoom(), [sc, sr] = Level.START[room], maxHp = prince.maxHp;
    prince = new Actor('prince', sc * TW + 16, floorY(sr), 1);
    Object.assign(prince, { hp: maxHp, maxHp, chatCool: 60 * 8 });
    // els enemics que encara viuen tornen al seu lloc, també amb la vida plena
    for (const f of foes) {
      if (!f.alive) continue;
      Object.assign(f, { x: f.home.x, y: f.home.y, face: -1, hp: f.maxHp, sword: false, talk: 0, cool: 60 });
      f.go('idle', 'idle', 0);
    }
    debris = []; parts = []; olivia.room = -1;
    Object.assign(game, { mode: 'play', fade: 0, timer: 0 });
    overlay.classList.add('hidden');
    say('Sala ' + (room + 1) + '. Torna-ho a provar!');
  }

  // una palanca o una placa obre la seva reixa (o la porta de sortida)
  function activate(t, silent) {
    if (t.used) return;
    t.used = 1; t.pressed = 1;
    const g = t.target;
    if (!g) return;
    g.goal = 1;
    if (silent) { g.open = 1; return; }
    Snd.play('door');
    if (g.ch === 'D') say('S\'ha sentit un cruixit llunyà... la porta del palau s\'obre!');
    else if (Math.floor(g.c / 10) === Math.floor(prince.x / ROOMW)) say('La reixa s\'aixeca!');
    else say('S\'ha sentit una reixa que s\'aixecava, lluny d\'aquí...');
    diego('No te falta razón');
  }

  // ---- parlar: bafarada sobre el cap i, si el navegador en sap, veu sintetitzada ----
  function talk(a, text, ticks) { a.talk = ticks; a.talkText = text; }
  function speak(text, lang, pitch, rate) {
    if (!Snd.ac || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang; u.pitch = pitch; u.rate = rate;
      speechSynthesis.speak(u);
    } catch (e) { /* sense veu */ }
  }

  // en Mykola es presenta cridant
  function shout(g) {
    g.shoutCool = 360;
    say('Mykola: «My name is Mykola!»');
    talk(g, 'MY NAME IS MYKOLA!', 140); speak('My name is Mykola!', 'en-US', 0.6, 1.1);
  }

  // en Diego (l'heroi) diu una de les seves frases (o la que toqui pel context);
  // només per escrit, a la bafarada
  const DIEGO = ['No te falta razón', 'Es así', 'Suena terrible'];
  const DIEGO_DIES = ['Aaahhh, esto es peor que una PR de Miguel', 'Aaahhh, esto es peor que un merge en viernes', 'Aaahhh, esto es peor que una reunión sin agenda'];
  const pick = (l) => l[Math.floor(Math.random() * l.length)];
  function diego(text) {
    talk(prince, text || pick(DIEGO), 150);
    prince.chatCool = 60 * (18 + Math.random() * 20);
  }

  // mentre balla, en Diego canta una tonada pròpia, nota a nota
  const SONGS = { macarena: [392, 440, 494, 440, 392, 330, 392, 0], gangnam: [220, 220, 262, 220, 294, 262, 220, 0] };
  function sing(a) {
    if (a.at % 15) return;
    const song = SONGS[a.dance], beat = (a.beat = (a.beat || 0) + 1), f = song[beat % song.length];
    if (f) Snd.tone(f, f, 0.16, 'triangle', 0.045);
    talk(a, beat % 16 < 8 ? '♪ la la la ♪' : '♪ na na na ♪', 20);
  }

  // ---- partícules -------------------------------------------------------------
  function burst(x, y, n, color, speed, up) {
    for (let i = 0; i < n; i++) {
      parts.push({ x, y, vx: (Math.random() - 0.5) * speed, vy: -Math.random() * speed * (up || 0.6), life: 20 + Math.random() * 20, color });
    }
  }

  // ---- utilitats de l'heroi -------------------------------------------------------
  function edgeFor(a, r, maxD) {
    // busca la vora d'un replà a la fila r a prop de x (amb terra cap a 'dir')
    const c = colOf(a.x);
    let best = null;
    for (const dir of [a.face, -a.face]) {
      for (const cc of [c, c - dir]) {
        const t = tile(cc + dir, r);
        if (t.ch === ' ' || t.ch === '#' || isFloor(cc, r)) continue;
        const ex = dir > 0 ? (cc + 1) * TW : cc * TW;
        const d = Math.abs(a.x - ex);
        if (d < maxD && (!best || (best.dir === dir && d < best.d))) best = { ex, dir, d };
      }
    }
    return best;
  }

  function startFall(a, vx) {
    a.vx = vx; a.vy = 0.3; a.fallStart = a.y;
    a.go('fall', 'fall', 8);
  }

  function launch(a, vx, vy, kind) {
    a.vx = vx; a.vy = vy; a.jumpKind = kind; a.fallStart = a.y;
    a.go('air', 'air', 4);
  }

  function hang(a, ex, hy, dir, anim) {
    a.face = dir; a.x = ex; a.y = hy; a.hangY = hy; a.edgeX = ex;
    if (anim) { a.state = 'hang'; a.setAnim(anim, 0); } else a.go('hang', 'hang', 0);
  }

  function kill(a, how) {
    if (!a.alive && a.state === 'dead') return;
    a.hp = 0;
    if (how === 'spikes') { a.go('dead', 'spiked', 0); burst(a.x, a.y - 8, 20, '#b0182a', 2); Snd.play('spikes'); }
    else if (how === 'fallout') a.state = 'dead';
    else { a.go('dead', 'death', 6); burst(a.x, a.y - 20, 16, '#b0182a', 2); }
    if (a === prince) { Snd.play('death'); game.timer = 0; diego(pick(DIEGO_DIES)); }
  }

  function damage(a, from) {
    a.hp--; a.flash = 20;
    burst(a.x, a.y - 24, 10, '#c21d2f', 1.8);
    Snd.play('hit');
    if (a.hp <= 0) {
      kill(a);
      if (a !== prince) { say(a.kind === 'mykola' ? 'En Mykola ha caigut. «My name... was... Mykola...»' : 'El guarda ha caigut!'); diego('Es así'); }
    }
    else {
      if (a.kind === 'mykola' && a.shoutCool < 200) shout(a);
      a.sword = true; a.go('hurt', 'hurt', 2);
    }
    if (from) a.face = sign(from.x - a.x);
  }

  function landOn(a) {
    // amb la poció ploma qualsevol caiguda és suau
    const fy = a.y, dist = a.feather > 0 ? 0 : fy - a.fallStart;
    const t = tile(colOf(a.x), a.row);
    burst(a.x, fy, 6, '#8a86a8', 1.2, 0.4);
    if (t.ch === 'L' && !t.shake) t.shake = 1;
    if (t.ch === 'S') { t.ext = 4; return kill(a, 'spikes'); }
    if (dist > 140) { Snd.play('slam'); return kill(a); }
    if (dist > 80) { Snd.play('slam'); a.hp--; a.flash = 20; if (a.hp <= 0) return kill(a); say('Ai! Aquesta caiguda ha fet mal.'); diego('Suena terrible'); return a.go('land', 'landHard', 2); }
    Snd.play('land');
    if (dist > 30) return a.go('land', 'landCrouch', 2);
    if (a.jumpKind === 'run' && held[a.face > 0 ? 'right' : 'left']) return a.go('landRun', 'landRun', 2);
    a.go('land', 'landSoft', 2);
  }

  // física comuna per a 'air' i 'fall'
  function airPhysics(a, g) {
    const prevY = a.y;
    a.vy = Math.min(a.vy + g, a.feather > 0 ? 1.4 : 6);
    if (!a.move(a.vx)) a.vx = 0;
    a.y += a.vy;
    // agafar-se a una vora mentre cau (mantenint Maj)
    if (a.vy > 0 && held.act) {
      const h0 = prevY - 40, h1 = a.y - 40;
      for (let r = 0; r < ROWS; r++) {
        const fy = floorY(r);
        if (h0 < fy && h1 >= fy) {
          const e = edgeFor(a, r, 18);
          if (e) { Snd.play('land'); return hang(a, e.ex, fy, e.dir); }
        }
      }
    }
    // aterratge
    for (let r = 0; r < ROWS; r++) {
      const fy = floorY(r);
      if (prevY <= fy && a.y >= fy && isFloor(colOf(a.x), r)) { a.y = fy; return landOn(a); }
    }
    if (a.y > GAMEH + 60) { kill(a, 'fallout'); say('Has caigut a l\'abisme...'); }
  }

  const dirHeld = () => (held.right && !held.left ? 1 : held.left && !held.right ? -1 : 0);

  // l'enemic viu més proper a la mateixa fila que l'heroi, a menys de 'range' píxels
  function foeNear(range) {
    let best = null;
    for (const f of foes) {
      const d = Math.abs(f.x - prince.x);
      if (f.alive && f.state !== 'dead' && f.row === prince.row && d < range && (!best || d < Math.abs(best.x - prince.x))) best = f;
    }
    return best;
  }

  function drinkEffect(a, it) {
    const P = POTIONS[it.ch];
    burst(a.x, a.y - 32, 14, P.hi, 1, 1);
    if (P.type === 'vida') { if (a.hp < a.maxHp) a.hp++; say('Una poció de vida. Et sents millor.'); }
    else if (P.type === 'max') { a.maxHp++; a.hp = a.maxHp; say('Una poció gran! Ara aguantes un cop més.'); }
    else if (P.type === 'ploma') { a.feather = 60 * 30; say('Et sents lleuger com una ploma... una estona, les caigudes no et faran mal.'); }
    else {
      a.hp--; a.flash = 20; Snd.play('hit');
      if (a.hp <= 0) { kill(a); say('Era verí...'); } else { say('Puaj! Era verí. Compte amb les pocions verdes.'); diego('Suena terrible'); }
    }
  }

  // ---- màquina d'estats de l'heroi -----------------------------------------------
  function updatePrince() {
    const a = prince, d = dirHeld(), fwd = d === a.face, back = d === -a.face;
    a.at++;
    const ground = () => {
      if (!a.grounded()) { startFall(a, a.vx || 0); return false; }
      return true;
    };
    const checkSpikes = () => { const t = tile(colOf(a.x), a.row); if (t.ch === 'S' && t.ext >= 2) kill(a, 'spikes'); };
    if (a.feather > 0) a.feather--;
    if (a.talk > 0) a.talk--;
    if (--a.chatCool <= 0 && ['idle', 'run', 'startRun', 'stop', 'garde', 'crouch'].includes(a.state)) diego();
    if (pressed.act && a.sword) a.queued = true;
    const combatReady = ['idle', 'dance', 'run', 'startRun', 'stop', 'land', 'turn'].includes(a.state);
    const foe = foeNear(110);
    if (combatReady && foe && a.grounded()) {
      a.face = sign(foe.x - a.x); a.sword = true; a.vx = 0;
      return a.go('drawSword', 'drawSword', 4);
    }
    switch (a.state) {
      case 'idle': {
        a.vx = 0;
        if (!ground()) return;
        const dc = colOf(a.x), here = tile(dc, a.row);
        if (held.up && here.ch === 'D' && here.open >= 1) return a.go('enter', 'enterTurn', 4);
        // si s'està quiet una estona, es posa a ballar
        if (d || held.up || held.down || held.act) a.idleT = 0;
        else if (++a.idleT > 300) {
          a.idleT = 0; a.beat = 0; a.dance = Math.random() < 0.5 ? 'macarena' : 'gangnam';
          return a.go('dance', a.dance, 8);
        }
        if (d && back) { a.go('turn'); a.flipped = false; return; }
        if (held.up) {
          if (fwd) return a.go('standJump', 'standJumpPrep', 4);
          return a.go('jumpPrep', 'jumpPrep', 4);
        }
        if (d && held.act) {
          let dist = 11;
          const tx = a.x + a.face * dist;
          if (!isFloor(colOf(tx), a.row)) {
            const ex = a.face > 0 ? (colOf(a.x) + 1) * TW : colOf(a.x) * TW;
            dist = Math.max(0, Math.abs(ex - a.x) - 2);
          }
          a.stepDist = dist;
          return a.go('step');
        }
        if (d) return a.go('startRun', 'startRun', 4);
        if (held.down) {
          const ex = a.face > 0 ? (colOf(a.x) + 1) * TW : colOf(a.x) * TW;
          if (!isFloor(colOf(a.x) + a.face, a.row) && Math.abs(ex - a.x) < 14) {
            a.face = -a.face;
            return hang(a, ex, a.y, a.face, A.climbDown);
          }
          return a.go('crouch', 'crouchDown', 4);
        }
        if (pressed.act) {
          const it = L.items.find((i) => !i.taken && i.r === a.row && Math.abs(i.c * TW + 16 - a.x) < 14);
          if (it) { a.potion = it; return a.go('drink', 'drink'); }
          if (here.ch === 'V' && !here.used) {
            a.lever = here; a.x = dc * TW + 16 - a.face * 7;
            return a.go('pull', 'pull', 4);
          }
        }
        break;
      }
      case 'pull':
        if (a.at === 16) { Snd.play('lever'); activate(a.lever); }
        if (a.done) a.go('idle', 'idle', 4);
        break;
      case 'dance':
        if (!ground()) return;
        if (d || held.up || held.down || held.act) { a.talk = 0; return a.go('idle', 'idle', 6); }
        // la Macarena acaba amb un saltet i un gir
        if (a.done) { if (a.dance === 'macarena') a.face = -a.face; a.setAnim(a.dance, 0); }
        sing(a);
        break;
      case 'enter': {
        // es posa al mig de la porta, es gira d'esquena i hi entra caminant
        a.x += Math.max(-0.7, Math.min(0.7, colOf(a.x) * TW + 16 - a.x));
        if (a.anim === A.enterTurn && a.done) { a.setAnim('walkIn', 0); Snd.play('win'); say('Llibertat! En Diego ha escapat del Palau de la Lluna.'); }
        if (a.anim === A.walkIn && a.at > 80) { game.fade += 0.02; if (game.fade >= 1) { game.mode = 'win'; showOverlay('win'); } }
        break;
      }
      case 'turn':
        if (a.at === 6) a.face = -a.face;
        if (a.done) { if (dirHeld() === a.face) a.go('startRun', 'startRun', 2); else a.go('idle', 'idle', 4); }
        break;
      case 'startRun':
        if (!a.move(a.face * (0.5 + Math.min(1, a.at / 15) * 1.2))) return a.go('bump', 'bump', 2);
        if (!ground()) return;
        checkSpikes();
        if (held.up) return a.go('runJump', 'runJumpTakeoff', 3);
        if (!fwd) { a.vx = 1.2; a.turnAfter = back; return a.go('stop', 'stop', 4); }
        if (a.done) a.go('run', 'run', 0);
        break;
      case 'run':
        a.vx = 1.7;
        if (!a.move(a.face * 1.7)) { Snd.play('land'); return a.go('bump', 'bump', 2); }
        if (!ground()) return;
        checkSpikes();
        if (held.up) return a.go('runJump', 'runJumpTakeoff', 3);
        if (held.down) { a.vx = 1.7; return a.go('slide', 'crouchDown', 4); }
        if (!fwd) { a.vx = 1.7; a.turnAfter = back; return a.go('stop', 'stop', 4); }
        break;
      case 'stop':
        a.move(a.face * a.vx); a.vx *= 0.86;
        if (!ground()) return;
        checkSpikes();
        if (a.done) {
          if (a.turnAfter) { a.turnAfter = false; a.go('turn'); } else a.go('idle', 'idle', 4);
        }
        break;
      case 'slide':
        a.move(a.face * a.vx); a.vx *= 0.9;
        if (!ground()) return;
        if (a.done) a.go('crouch', 'crouch', 0);
        break;
      case 'bump':
        if (a.at < 8) a.move(-a.face * 0.5);
        if (a.done) a.go('idle', 'idle', 4);
        break;
      case 'step':
        if (a.at > 6 && a.at <= 21) a.move(a.face * a.stepDist / 15);
        if (a.done) a.go('idle', 'idle', 2);
        break;
      case 'crouch':
        if (!ground()) return;
        if (a.anim === A.crouchDown && a.done) a.setAnim('crouch', 0);
        if (a.anim === A.crawl) { if (a.at <= 11) a.move(a.face * 0.7); if (a.done) a.setAnim('crouch', 0); break; }
        if (!held.down && a.anim !== A.crouchDown) return a.go('crouchUp', 'crouchUp', 2);
        if (fwd && a.anim === A.crouch) a.setAnim('crawl', 2);
        break;
      case 'crouchUp':
      case 'land':
      case 'drawDone':
        if (a.state === 'land' && !ground()) return;
        if (a.done) a.go('idle', 'idle', 4);
        break;
      case 'landRun':
        a.move(a.face * 1.5);
        if (!ground()) return;
        checkSpikes();
        if (a.done) { if (fwd) a.go('run', 'run', 3); else { a.vx = 1.5; a.go('stop', 'stop', 4); } }
        break;
      case 'jumpPrep':
        if (a.done) {
          const r = a.row - 1;
          const e = r >= 0 && !isFloor(colOf(a.x), r) ? edgeFor(a, r, 30) : null;
          if (e) {
            // s'enfila: rebasa la pose actual a l'ancoratge de la vora i interpola fins a penjar
            const hy = floorY(r);
            const reach = Object.assign({}, Anims.poseAt(A.jumpReach, 0));
            reach.hx = (a.x - e.ex) * e.dir; reach.hy += a.y - hy;
            hang(a, e.ex, hy, e.dir, { frames: [[reach, 5], [Object.assign({}, reach, { hy: reach.hy - 10 }), 6], [Anims.HANG, 1]], total: 12 });
            a.state = 'grabUp';
          } else {
            a.vy = isFloor(colOf(a.x), r) ? -1.3 : -2.6;
            a.fallStart = a.y; a.go('jumpUp', 'jumpAir', 3);
          }
        }
        break;
      case 'jumpUp': {
        const prevY = a.y;
        a.vy += 0.2; a.y += a.vy;
        if (a.vy > 0 && prevY <= a.fallStart && a.y >= a.fallStart) { a.y = a.fallStart; Snd.play('land'); a.go('land', 'landSoft', 3); }
        break;
      }
      case 'grabUp':
        if (a.done) a.go('hang', 'hang', 0);
        break;
      case 'hang':
        if (a.anim === A.climbDown) { if (a.done) { a.setAnim('hang', 0); a.waitRelease = true; } break; }
        if (!held.down) a.waitRelease = false;
        if (held.up) return a.go('climb', 'climb', 0);
        if ((held.down && !a.waitRelease) || (pressed.act && !held.up)) {
          a.y = a.hangY + 40; a.x = a.edgeX - a.face * 4; a.fallStart = a.y;
          startFall(a, 0); a.fallStart = a.y;
        }
        break;
      case 'climb':
        if (a.done) {
          a.x = a.edgeX + a.face * 8; a.y = a.hangY;
          a.pose = null; a.go('idle', 'idle', 0);
          const t = tile(colOf(a.x), a.row);
          if (t.ch === 'L' && !t.shake) t.shake = 1;
        }
        break;
      case 'standJump':
        if (a.done) launch(a, a.face * 1.5, -2.3, 'stand');
        break;
      case 'runJump':
        a.move(a.face * 1.7);
        if (a.done) launch(a, a.face * 2.3, -1.8, 'run');
        break;
      case 'air':
        airPhysics(a, a.jumpKind === 'run' ? 0.11 : 0.13);
        if (a.state === 'air' && a.y - a.fallStart > 40 && a.anim !== A.fall) a.setAnim('fall', 10);
        break;
      case 'fall':
        a.vx *= 0.97;
        airPhysics(a, a.feather > 0 ? 0.06 : 0.2);
        break;
      case 'drink':
        if (a.at === 20 && a.potion) { a.potion.taken = true; }
        if (a.at === 40) Snd.play('gulp');
        if (a.done) {
          drinkEffect(a, a.potion);
          if (a.alive) a.go('idle', 'idle', 4);
        }
        break;
      // ---- combat ----
      case 'drawSword':
        a.queued = false;
        if (a.at === 16) Snd.play('swish');
        if (a.done) a.go('garde', 'garde', 0);
        break;
      case 'garde': {
        if (!a.grounded()) { a.sword = false; return startFall(a, 0); }
        const f = foeNear(160), g = !!f;
        if (!g) { a.gardeT = (a.gardeT || 0) + 1; if (a.gardeT > 40) { a.gardeT = 0; a.sword = false; return a.go('drawDone', 'sheathe', 4); } }
        else a.gardeT = 0;
        if (g && sign(f.x - a.x) !== a.face) return a.go('gardeTurn');
        if (a.queued) { a.queued = false; if (g || pressed.act) { Snd.play('swish'); return a.go('strike', 'strike', 3); } }
        if (held.up) return a.go('block', 'block', 2);
        if (held.down && !g) { a.sword = false; return a.go('drawDone', 'sheathe', 4); }
        if (fwd) return a.go('advance');
        if (back) return a.go('retreat');
        break;
      }
      case 'gardeTurn':
        if (a.at === 5) a.face = -a.face;
        if (a.done) a.go('garde', 'garde', 0);
        break;
      case 'advance': {
        const f = foeNear(160);
        if (a.at <= 10 && (!f || Math.abs(f.x - (a.x + a.face)) > 15)) a.move(a.face * 0.9);
        if (!a.grounded()) { a.sword = false; return startFall(a, 0); }
        if (a.done) a.go('garde', 'garde', 0);
        break;
      }
      case 'retreat': {
        const nx = a.x - a.face * 0.9;
        if (a.at <= 10 && isFloor(colOf(nx - a.face * 4), a.row)) a.move(-a.face * 0.9);
        if (a.done) a.go('garde', 'garde', 0);
        break;
      }
      case 'strike':
        if (a.at === 13) { const f = foeNear(60); if (f) resolveHit(a, f); }
        if (a.done) a.go('garde', 'garde', 0);
        break;
      case 'block':
        if (a.done) a.go('garde', 'garde', 0);
        break;
      case 'hurt':
        if (a.at < 10) a.move(-a.face * 0.6);
        if (a.done) a.go('garde', 'garde', 0);
        break;
      case 'dead':
        game.timer++;
        // temps per llegir la darrera frase d'en Diego
        if (game.timer === 150) { showOverlay('dead'); game.mode = 'dead'; }
        break;
    }
  }

  function resolveHit(att, def) {
    if (!def.alive || def.row !== att.row) return;
    const dx = def.x - att.x, ad = Math.abs(dx);
    if (sign(dx) !== att.face || ad < 6 || ad > 38) return;
    if (def.state === 'block' && def.at >= 2) {
      Snd.play('clang');
      burst(att.x + att.face * ad * 0.55, att.y - 27, 12, '#fff3a0', 2.5, 1);
      return;
    }
    damage(def, att);
  }

  // ---- IA dels enemics (guardes i en Mykola) ------------------------------------------
  function updateFoe(g) {
    const p = prince, st = g.stats;
    g.at++;
    if (g.talk > 0) g.talk--;
    if (g.shoutCool > 0) g.shoutCool--;
    const dx = p.x - g.x, ad = Math.abs(dx);
    const engaged = p.alive && p.row === g.row && ad < 120;
    switch (g.state) {
      case 'idle':
        if (engaged) {
          g.face = sign(dx); g.sword = true; g.go('drawSword', 'drawSword', 4);
          if (g.kind === 'mykola') shout(g); else say('Un guarda! Maj/Espai: atacar · Amunt: parar el cop');
        }
        break;
      case 'drawSword':
        if (g.done) g.go('garde', 'garde', 0);
        break;
      case 'garde':
        g.cool--;
        if (!p.alive) break;
        if (sign(dx) !== g.face) return g.go('gardeTurn');
        if (g.kind === 'mykola' && g.shoutCool <= 0 && Math.random() < 0.01) shout(g);
        if (p.state === 'strike' && p.at < 9) {
          if (!g.decided) { g.decided = true; if (Math.random() < st.block) return g.go('block', 'block', 2); }
        } else g.decided = false;
        if (ad > 33 && engaged) return g.go('advance');
        if (ad < 18) return g.go('retreat');
        if (ad <= 38 && g.cool <= 0 && Math.random() < st.aggro) { g.cool = 45 + Math.random() * 40; Snd.play('swish'); return g.go('strike', 'strike', 3); }
        break;
      case 'gardeTurn':
        if (g.at === 5) g.face = -g.face;
        if (g.done) g.go('garde', 'garde', 0);
        break;
      case 'advance':
        if (g.at <= 10 && ad > 16) g.move(g.face * 0.8);
        if (g.done) g.go('garde', 'garde', 0);
        break;
      case 'retreat':
        if (g.at <= 10 && isFloor(colOf(g.x - g.face * 8), g.row)) g.move(-g.face * 0.8);
        if (g.done) g.go('garde', 'garde', 0);
        break;
      case 'strike':
        if (g.at === 13) resolveHit(g, p);
        if (g.done) g.go('garde', 'garde', 0);
        break;
      case 'block':
      case 'hurt':
        if (g.state === 'hurt' && g.at < 10) g.move(-g.face * 0.6);
        if (g.done) { g.go('garde', 'garde', 0); if (Math.random() < 0.5) g.cool = 0; }
        break;
    }
  }

  // ---- l'Olivia i el seu gos ------------------------------------------------------
  // Passegen per algunes sales: per a cada sala, la fila i les columnes del tros de terra
  // on camina. Quan en Diego entra en una d'aquestes sales, l'Olivia hi apareix.
  const OLIVIA_PATHS = { 0: [1, 4, 9], 1: [1, 10, 15], 3: [0, 33, 39], 4: [0, 40, 49], 6: [2, 61, 69], 7: [0, 70, 79] };
  const KPOP = ['♪ Saranghae~ ♪', '♪ Annyeong! ♪', '♪ Hwaiting! ♪', '♪ Ya-ya-ya, k-pop! ♪'];
  const CRITTER_COLORS = ['#7ad36b', '#6ab0f0', '#c48ae8', '#f0c85a'];
  let olivia, dog, critter, ball;

  function newOlivia() {
    olivia = new Actor('olivia', 0, 0, 1);
    Object.assign(olivia, { size: 0.8, room: -1, next: 200, bubbleH: 50 });
    dog = { x: 0, y: 0, face: 1, moving: false, t: 0, talk: 0, bubbleH: 26 };
    critter = null; ball = null;
  }

  function updateOlivia() {
    const o = olivia, room = Math.floor(prince.x / ROOMW), path = OLIVIA_PATHS[room];
    if (!path) { o.room = -1; return; }
    const [r, c0, c1] = path, lo = c0 * TW + 10, hi = (c1 + 1) * TW - 10;
    if (o.room !== room) {
      // apareix en un punt qualsevol del seu tros de camí
      Object.assign(o, { room, x: lo + Math.random() * (hi - lo), y: floorY(r), face: Math.random() < 0.5 ? 1 : -1, greeted: false, next: 120 });
      o.go('walk', 'walk', 0);
      Object.assign(dog, { x: o.x - o.face * 14, y: o.y, face: o.face });
      critter = null; ball = null;
    }
    o.at++;
    if (o.talk > 0) o.talk--;
    switch (o.state) {
      case 'walk':
        o.x += o.face * 0.45;
        if (o.x < lo || o.x > hi) { o.x = Math.max(lo, Math.min(hi, o.x)); o.face = -o.face; }
        if (--o.next <= 0) {
          o.next = 200 + Math.random() * 250;
          const k = Math.random();
          if (k < 0.45) { o.go('sing', 'sway', 6); o.ht = 0; }
          else if (k < 0.85) { o.go('hunt', 'idle', 6); o.ht = 0; }
        }
        break;
      case 'sing':
        if (o.ht++ % 80 === 0) talk(o, pick(KPOP), 70);
        if (o.ht > 240) o.go('walk', 'walk', 6);
        break;
      case 'hunt': huntStep(o, lo, hi); break;
    }
    // saluda en Diego quan se li acosta
    if (!o.greeted && prince.alive && prince.row === rowOf(o.y) && Math.abs(prince.x - o.x) < 50) { o.greeted = true; talk(o, 'Hola, Diego!', 100); }
    updateDog(o);
  }

  // caçar un bitxo: n'apareix un, l'Olivia li llança la bola i, tres sotracs després, el té (o se li escapa)
  function huntStep(o, lo, hi) {
    const t = ++o.ht;
    if (t === 1) {
      if (o.x + o.face * 40 > hi || o.x + o.face * 40 < lo) o.face = -o.face;
      critter = { x: o.x + o.face * 40, y: o.y, color: pick(CRITTER_COLORS), state: 'free', t: 0 };
      talk(o, 'Un bitxo salvatge!', 60);
    }
    if (t === 50) o.setAnim('throw', 3);
    if (t === 66 && critter) {
      const T = 30, x0 = o.x + o.face * 4, y0 = o.y - 18, ty = o.y - 3;
      ball = { x: x0, y: y0, vx: (critter.x - x0) / T, vy: (ty - y0 - 0.5 * 0.15 * T * T) / T, t: 0, state: 'fly' };
      Snd.play('swish');
    }
    if (ball) {
      ball.t++;
      if (ball.state === 'fly') {
        ball.x += ball.vx; ball.vy += 0.15; ball.y += ball.vy;
        if (ball.t >= 30) {
          Object.assign(ball, { state: 'shake', t: 0, y: o.y - 3, x: critter.x });
          critter.state = 'in'; burst(critter.x, o.y - 4, 10, '#ffffff', 1.2, 1);
        }
      } else if (ball.state === 'shake' && ball.t === 90) {
        if (Math.random() < 0.75) { burst(ball.x, ball.y - 3, 14, '#ffe680', 1.2, 1); talk(o, 'T\'he caçat!', 90); critter = null; Snd.play('gulp'); }
        else { critter.state = 'flee'; talk(o, 'Oh, s\'ha escapat!', 90); }
        ball.state = 'done';
      }
    }
    if (critter && critter.state === 'flee') { critter.x += o.face * 1.2; critter.t++; if (critter.t > 60) critter = null; }
    if (critter && critter.state === 'free') critter.t++;
    if (t === 200) { ball = null; critter = null; o.go('walk', 'walk', 6); }
  }

  // el gos va darrere de l'Olivia, amb la cua bellugant, i de tant en tant borda
  function updateDog(o) {
    dog.t++;
    if (dog.talk > 0) dog.talk--;
    const tx = o.x - o.face * 14, dx = tx - dog.x;
    dog.moving = Math.abs(dx) > 3;
    if (dog.moving) { dog.x += Math.sign(dx) * Math.min(Math.abs(dx), Math.abs(dx) > 30 ? 1.2 : 0.6); dog.face = Math.sign(dx); }
    else dog.face = sign(o.x - dog.x);
    dog.y = o.y;
    if (Math.random() < 0.0015) talk(dog, 'Guau!', 50);
  }

  // ---- trampes i objectes -------------------------------------------------------
  function updateWorld() {
    const p = prince;
    const pg = p.alive && ['idle', 'dance', 'run', 'startRun', 'stop', 'step', 'land', 'landRun', 'crouch', 'turn', 'garde', 'advance', 'retreat', 'strike', 'block'].includes(p.state);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = L.tiles[r][c];
        if (t.ch === 'S') {
          const near = p.alive && Math.abs(p.x - (c * TW + 16)) < 44 && p.y <= floorY(r) + 2 && p.y > floorY(r) - 70;
          if (near) { if (t.ext === 0) Snd.play('spikes'); t.ext = Math.min(4, t.ext + 0.5); t.near = 60; }
          else if (--t.near < 0) t.ext = Math.max(0, t.ext - 0.1);
        }
        if (t.ch === 'L') {
          if (pg && p.row === r && colOf(p.x) === c && !t.shake) t.shake = 1;
          if (t.shake && ++t.shake > 45) {
            t.ch = ' '; t.shake = 0;
            debris.push({ x: c * TW + 16, y: floorY(r), vy: 0, c, hit: false });
            Snd.play('land');
          }
        }
        const on = pg && p.row === r && colOf(p.x) === c;
        if (t.ch === 'B' && on && !t.used) activate(t);
        if (t.ch === 'V' && on && !t.used && !t.hinted) { t.hinted = 1; say('Una palanca. Prem Maj o Espai per estirar-la.'); }
        if (t.open < t.goal) t.open = Math.min(1, t.open + (t.ch === 'D' ? 0.006 : 0.015));
      }
    }
    for (const d of debris) {
      const prevY = d.y;
      d.vy = Math.min(d.vy + 0.2, 6); d.y += d.vy;
      if (!d.hit && p.alive && colOf(p.x) === d.c && d.y > p.y - 38 && d.y < p.y - 8 && p.state !== 'dead') {
        d.hit = true; damage(p); say('Compte amb les rajoles fluixes!');
      }
      for (let r = 0; r < ROWS; r++) {
        const fy = floorY(r);
        if (prevY < fy && d.y >= fy && isFloor(d.c, r)) { d.dead = true; rubble.push({ c: d.c, r }); burst(d.x, fy, 10, '#7e7b9e', 1.5); Snd.play('slam'); }
      }
      if (d.y > GAMEH + 20) d.dead = true;
    }
    debris = debris.filter((d) => !d.dead);
    for (const q of parts) { q.x += q.vx; q.y += q.vy; q.vy += 0.12; q.life--; }
    parts = parts.filter((q) => q.life > 0);
  }

  function updateScarf(a) {
    const dx = (a.x - a.lastX) * a.face;
    a.lastX = a.x;
    let target = 8 - Math.max(-0.5, dx) * 26 + Math.sin(tick / 5) * Math.min(6, Math.abs(dx) * 5);
    if ((a.state === 'fall' || a.state === 'air') && a.vy > 1) target = -150;
    a.scarf += (target - a.scarf) * 0.15;
  }

  // ---- dibuix -----------------------------------------------------------------
  function drawActor(a, camX) {
    if (a.state === 'dead' && a.y > GAMEH + 40) return;
    let pose = a.computePose();
    if (a.flash > 0 && (a.flash-- >> 2) % 2) return;
    if (a.talk > 0 && (tick >> 3) % 2) pose = Object.assign({}, pose, { face: 1 });
    const img = Sprite.drawPose(R, pose, a.kind, { scarf: a.scarf, pot: a.potion && POTIONS[a.potion.ch].color });
    ctx.save();
    // entrant per la porta: es fa petit, puja l'escala i s'esvaeix dins del forat
    let s = a.size || 1;
    if (a.state === 'enter' && a.anim === A.walkIn) {
      const k = Math.min(1, a.at / 90), x0 = colOf(a.x) * TW - camX;
      ctx.beginPath(); ctx.rect(x0 + 3, a.y - 60, 26, 62); ctx.clip();
      ctx.globalAlpha = 1 - 0.7 * k; s *= 1 - 0.35 * k;
      ctx.translate(0, -12 * k);
    }
    ctx.translate(Math.round(a.x - camX), Math.round(a.y));
    ctx.scale(a.face * s, s);
    ctx.drawImage(img, -Sprite.OX, -Sprite.OY);
    ctx.restore();
  }

  // el gos de l'Olivia: cadellet taronja i rodonet amb un bonyiguet gris al front.
  // Mapes de bits mirant a la dreta; dues posicions de potes per trotar.
  const DOG = [
    '.........gg..',
    '........ooo..',
    '.t.....ooooo.',
    '..ooooooooeoo',
    '..oooooooooon',
    '..ooooooooooo',
    '..oddoooodd..',
  ];
  const DOG_LEGS = [['..l.l....l.l.', '..l.l....l.l.'], ['...l.l..l.l..', '...l.l..l.l..']];
  const DOG_COL = { o: '#f08a24', d: '#c0601a', g: '#9aa0a8', e: '#111111', n: '#3a1a10', l: '#c0601a', t: '#f08a24' };
  function drawDog(camX) {
    const legs = DOG_LEGS[dog.moving ? (dog.t >> 3) % 2 : 0];
    const rows = DOG.concat(legs);
    // la cua es belluga
    rows[2] = ((dog.t >> 2) % 2 ? '.t' : 't.') + rows[2].slice(2);
    const x0 = Math.round(dog.x - camX), y0 = Math.round(dog.y) - rows.length - (dog.moving && (dog.t >> 3) % 2 ? 1 : 0);
    const px = (x, y) => [dog.face > 0 ? x0 - 6 + x : x0 + 6 - x, y0 + y];
    ctx.fillStyle = '#2a1408';
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < 13; x++) if (rows[y][x] !== '.') {
      const [sx, sy] = px(x, y); ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3);
    }
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < 13; x++) if (rows[y][x] !== '.') {
      const [sx, sy] = px(x, y); ctx.fillStyle = DOG_COL[rows[y][x]]; ctx.fillRect(sx, sy, 1, 1);
    }
  }

  // un bitxo inventat (no és cap pokémon de debò): una boleta amb orelles que fa saltirons
  function drawCritter(camX) {
    if (!critter || critter.state === 'in') return;
    const x = Math.round(critter.x - camX), y = Math.round(critter.y) - 5 - (Math.floor(critter.t / 10) % 2);
    ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 3, y - 1, 7, 6); ctx.fillRect(x - 2, y - 3, 1, 2); ctx.fillRect(x + 2, y - 3, 1, 2);
    ctx.fillStyle = critter.color; ctx.fillRect(x - 2, y, 5, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y + 1, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1);
  }

  // la bola de caçar: meitat vermella, meitat blanca; a terra fa sotracs
  function drawBall(camX) {
    if (!ball) return;
    const wob = ball.state === 'shake' ? [0, -1, 0, 1][(ball.t >> 3) % 4] : 0;
    const x = Math.round(ball.x - camX) + wob, y = Math.round(ball.y);
    ctx.fillStyle = '#111111'; ctx.fillRect(x - 2, y - 3, 5, 5);
    ctx.fillStyle = '#e03030'; ctx.fillRect(x - 1, y - 3, 3, 2);
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 1, 1, 1);
  }

  function drawFlame(x, y) {
    const f = Math.sin(tick * 0.4 + x) * 1.5;
    ctx.fillStyle = '#c7381c'; ctx.fillRect(x - 3, y - 6, 6, 6);
    ctx.fillStyle = '#f08a24'; ctx.fillRect(x - 2, y - 9 + f * 0.5, 4, 7);
    ctx.fillStyle = '#ffd860'; ctx.fillRect(x - 1, y - 7 + f * 0.3, 2, 4);
    if ((tick + x) % 9 < 2) { ctx.fillStyle = '#ffb040'; ctx.fillRect(x + Math.round(f), y - 13, 1, 1); }
  }

  // bafarada amb el que diu un personatge
  function drawBubble(a, camX) {
    const text = a.talkText;
    ctx.font = '7px monospace'; ctx.textAlign = 'center';
    const w = Math.ceil(ctx.measureText(text).width) + 8, h = 11;
    // si cau a l'abisme, la bafarada es queda a baix de tot de la pantalla
    const hx = Math.round(a.x - camX), top = Math.max(1, Math.min(GAMEH - 16, Math.round(a.y) - (a.bubbleH || 60)));
    const bx = Math.max(1, Math.min(W - w - 1, hx - (w >> 1)));
    ctx.fillStyle = '#0a0c14'; ctx.fillRect(bx - 1, top - 1, w + 2, h + 2);
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(bx, top, w, h);
    ctx.fillRect(hx - 2, top + h, 5, 1); ctx.fillRect(hx - 1, top + h + 1, 3, 1); ctx.fillRect(hx, top + h + 2, 1, 1);
    ctx.fillStyle = '#1a1420'; ctx.fillText(text, bx + w / 2, top + 8);
  }

  function render() {
    const room = Math.max(0, Math.min(NROOMS - 1, Math.floor(prince.x / ROOMW)));
    const camX = room * ROOMW;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(bgs[room], 0, 0);
    const c0 = room * 10;
    const torches = [];
    for (let r = 0; r < ROWS; r++) {
      const rowTop = r * RH, fy = floorY(r);
      for (let i = 0; i < 10; i++) {
        const t = L.tiles[r][c0 + i], x0 = i * TW;
        if (t.ch === 'T') { drawFlame(x0 + 16, rowTop + 22); torches.push([x0 + 16, rowTop + 18]); }
        if (t.ch === 'D') {
          // reixa de la porta
          const h = Math.round((1 - t.open) * 44);
          ctx.fillStyle = '#1c1a26';
          for (let k = 0; k < 6; k++) ctx.fillRect(x0 + 5 + k * 4, fy - 46, 1, h);
          ctx.fillRect(x0 + 4, fy - 46 + h - 2, 24, 2);
        }
        if (t.ch === 'V') Level.drawLever(ctx, x0, fy, t.used);
        if (t.ch === 'G') Level.drawGate(ctx, x0, fy, t.open);
        if (t.ch === '#') Level.drawBlock(ctx, x0, rowTop);
        else if (t.ch !== ' ') Level.drawFloorTop(ctx, x0, fy, t, tick);
        if (t.ch === 'S') Level.drawSpikes(ctx, x0, fy, t.ext);
      }
    }
    for (const rb of rubble) {
      if (colOf(rb.c * TW) < c0 || rb.c >= c0 + 10) continue;
      const x0 = (rb.c - c0) * TW, fy = floorY(rb.r);
      ctx.fillStyle = '#6e6b8e';
      for (let k = 0; k < 7; k++) ctx.fillRect(x0 + 3 + ((k * 13) % 26), fy - 3 - (k % 3), 3, 2);
    }
    for (const it of L.items) {
      if (it.taken || it.c < c0 || it.c >= c0 + 10) continue;
      // el flascó gran (vida màxima) fa 2 píxels més
      const P = POTIONS[it.ch], b = P.big ? 2 : 0;
      const x = (it.c - c0) * TW + 22, fy = floorY(it.r);
      ctx.fillStyle = '#0a0c14'; ctx.fillRect(x - 3 - b / 2, fy - 9 - b, 7 + b, 7 + b); ctx.fillRect(x - 1, fy - 13 - b, 3, 4);
      ctx.fillStyle = P.color; ctx.fillRect(x - 2 - b / 2, fy - 8 - b, 5 + b, 5 + b);
      ctx.fillStyle = P.hi; ctx.fillRect(x - 1 - b / 2, fy - 7 - b, 1, 2);
      ctx.fillStyle = '#c9c3b0'; ctx.fillRect(x, fy - 12 - b, 1, 3);
      if (tick % 40 < 20) { ctx.fillStyle = P.hi; ctx.fillRect(x + 1, fy - 15 - b - ((tick % 20) >> 2), 1, 1); }
    }
    const inRoom = (a) => Math.floor(a.x / ROOMW) === room;
    for (const f of foes) if (inRoom(f)) drawActor(f, camX);
    const oliviaHere = olivia.room === room;
    if (oliviaHere) { drawCritter(camX); drawDog(camX); drawActor(olivia, camX); drawBall(camX); }
    drawActor(prince, camX);
    for (let r = 0; r < ROWS; r++) {
      for (let i = 0; i < 10; i++) {
        const t = L.tiles[r][c0 + i];
        if (t.ch !== ' ' && t.ch !== '#') Level.drawFloorFront(ctx, i * TW, floorY(r), t, tick);
      }
    }
    for (const d of debris) {
      if (d.c < c0 || d.c >= c0 + 10) continue;
      const x0 = (d.c - c0) * TW;
      ctx.fillStyle = '#7e7b9e'; ctx.fillRect(x0, d.y - 3, TW, 3);
      ctx.fillStyle = '#3e3c5a'; ctx.fillRect(x0, d.y, TW, 6);
    }
    for (const q of parts) { ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x - camX), Math.round(q.y), 1, 1); }
    for (const f of foes) if (f.talk > 0 && f.alive && inRoom(f)) drawBubble(f, camX);
    if (oliviaHere) for (const a of [dog, olivia]) if (a.talk > 0) drawBubble(a, camX);
    if (prince.talk > 0) drawBubble(prince, camX);
    // llum càlida de les torxes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y] of torches) {
      const rr = 46 + Math.sin(tick * 0.3 + x) * 3;
      const g = ctx.createRadialGradient(x, y, 2, x, y, rr);
      g.addColorStop(0, 'rgba(255,150,60,0.28)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.restore();
    // HUD
    ctx.fillStyle = '#000'; ctx.fillRect(0, GAMEH, W, H - GAMEH);
    for (let i = 0; i < prince.maxHp; i++) {
      ctx.fillStyle = i < prince.hp ? '#e0263a' : '#4a1018';
      for (let k = 0; k < 5; k++) ctx.fillRect(4 + i * 8 + k, GAMEH + 9 - k * 1.4, 7 - k * 2 > 0 ? 7 - k * 2 : 1, 1.4);
    }
    ctx.font = '7px monospace';
    const hf = foes.find((f) => f.alive && f.state !== 'idle' && inRoom(f));
    if (hf) {
      for (let i = 0; i < hf.hp; i++) {
        ctx.fillStyle = '#3a8ee0';
        for (let k = 0; k < 5; k++) ctx.fillRect(W - 12 - i * 8 + k, GAMEH + 9 - k * 1.4, 7 - k * 2 > 0 ? 7 - k * 2 : 1, 1.4);
      }
      if (hf.kind === 'mykola') { ctx.fillStyle = '#9cc4ff'; ctx.textAlign = 'right'; ctx.fillText('MYKOLA', W - 8 - hf.hp * 8, GAMEH + 9); }
    }
    if (prince.feather > 0 && (prince.feather > 180 || (tick >> 3) % 2)) {
      ctx.fillStyle = '#e6d36a'; ctx.textAlign = 'left'; ctx.fillText('PLOMA', 8 + prince.maxHp * 8, GAMEH + 9);
    }
    ctx.fillStyle = '#6e6a8c'; ctx.textAlign = 'center';
    ctx.fillText('SALA ' + (room + 1), W / 2, GAMEH + 9);
    if (game.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, game.fade)})`; ctx.fillRect(0, 0, W, H); }
  }

  function showOverlay(kind) {
    overlay.classList.remove('hidden');
    overlay.querySelector('h1').textContent = kind === 'win' ? 'Has escapat!' : 'Has mort';
    overlay.querySelector('.sub').textContent = kind === 'win' ? 'En Diego ja és fora. La lluna l\'espera.' : 'Les ombres del palau han vençut en Diego.';
    overlay.querySelector('.go').textContent = kind === 'win' ? 'Prem R o toca per tornar a jugar'
      : 'Prem Enter o toca per continuar a la sala ' + (deathRoom() + 1) + ' · R per començar de nou';
  }

  // retrat de l'heroi a la pantalla de títol (en guàrdia, amb la bufanda al vent)
  const portrait = document.getElementById('portrait');
  const pctx = portrait.getContext('2d');
  pctx.imageSmoothingEnabled = false;
  let ptick = 0;
  function drawPortrait() {
    ptick++;
    const img = Sprite.drawPose(R, Anims.poseAt(A.garde, ptick), 'prince', { scarf: 8 + Math.sin(ptick / 9) * 22 });
    pctx.clearRect(0, 0, portrait.width, portrait.height);
    pctx.drawImage(img, -26, -20);
  }

  // ---- bucle principal amb pas fix a 60 Hz --------------------------------------
  function step() {
    if (game.mode === 'play') {
      tick++;
      updatePrince(); for (const f of foes) updateFoe(f); updateOlivia(); updateWorld();
      updateScarf(prince);
      prince.x = Math.max(6, Math.min(COLS * TW - 6, prince.x));
    }
    for (const k in pressed) pressed[k] = false;
  }

  let acc = 0, last = performance.now();
  function frame(now) {
    acc += Math.min(100, now - last); last = now;
    while (acc >= 1000 / 60) { acc -= 1000 / 60; step(); }
    if (L) render(); else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    if (!overlay.classList.contains('hidden')) drawPortrait();
    requestAnimationFrame(frame);
  }

  // pantalla de títol: es dibuixa el nivell al fons
  start(); game.mode = 'title'; overlay.classList.remove('hidden'); say('');
  requestAnimationFrame(frame);

  // per depurar des de la consola: __game.step(n) avança n ticks encara que la pestanya no es vegi
  window.__game = {
    get prince() { return prince; }, get foes() { return foes; }, get olivia() { return olivia; }, get dog() { return dog; }, get L() { return L; }, game, held, pressed, start,
    step(n = 1) { for (let i = 0; i < n; i++) step(); render(); },
  };
})();
