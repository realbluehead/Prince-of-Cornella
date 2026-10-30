// game.js — motor del joc: entrada, física per estats, combat i dibuix.
(function () {
  'use strict';
  const { TW, RH, ROWS, COLS, ROOMW, GAMEH, floorY } = Level;
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
    if (e.code === 'KeyR') start();
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) held[k] = false; });
  addEventListener('blur', () => { for (const k in held) held[k] = false; });
  document.querySelectorAll('[data-k]').forEach((b) => {
    const k = b.dataset.k;
    const on = (e) => { e.preventDefault(); Snd.init(); if (!held[k]) pressed[k] = true; held[k] = true; if (game.mode === 'title') start(); };
    const off = (e) => { e.preventDefault(); held[k] = false; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });
  overlay.addEventListener('click', () => { Snd.init(); start(); });

  // ---- món ----------------------------------------------------------------
  let L, bgs, prince, guard, debris, rubble, parts, tick;
  const game = { mode: 'title', fade: 0, door: 0, doorTarget: 0, timer: 0 };

  const tile = (c, r) => (c < 0 || c >= COLS || r < 0 ? { ch: '#' } : r >= ROWS ? { ch: ' ' } : L.tiles[r][c]);
  const isFloor = (c, r) => tile(c, r).ch !== ' ';
  const isWall = (c, r) => tile(c, r).ch === '#';
  const colOf = (x) => Math.floor(x / TW);
  const rowOf = (y) => Math.round((y - 60) / RH);
  const sign = (v) => (v < 0 ? -1 : 1);
  const say = (t) => { msgEl.textContent = t; };

  class Actor {
    constructor(kind, x, y, face) {
      Object.assign(this, { kind, x, y, face, vx: 0, vy: 0, hp: 3, maxHp: 3, scarf: 8, lastX: x, flash: 0 });
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
    // moviment horitzontal amb col·lisió contra blocs de pedra
    move(dx) {
      if (!dx) return true;
      const nx = this.x + dx, probe = nx + sign(dx) * 5;
      const rows = this.state === 'air' || this.state === 'fall' ? [rowOf(this.y - 2), Math.floor((this.y - 30) / RH)] : [this.row];
      for (const r of rows) {
        if (isWall(colOf(probe), r)) {
          this.x = dx > 0 ? colOf(probe) * TW - 5.01 : (colOf(probe) + 1) * TW + 5.01;
          return false;
        }
      }
      this.x = nx;
      return true;
    }
  }

  function start() {
    L = Level.parse();
    bgs = [0, 1, 2].map((r) => Level.renderRoom(L, r));
    prince = new Actor('prince', 56, floorY(2), 1);
    const gs = L.spawns.guard;
    guard = new Actor('guard', gs.c * TW + 16, floorY(gs.r), -1);
    guard.cool = 60;
    debris = []; rubble = []; parts = []; tick = 0;
    Object.assign(game, { mode: 'play', fade: 0, door: 0, doorTarget: 0, timer: 0 });
    overlay.classList.add('hidden');
    say('Troba la placa que obre la porta del palau...');
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
    if (a === prince) { Snd.play('death'); game.timer = 0; }
  }

  function damage(a, from) {
    a.hp--; a.flash = 20;
    burst(a.x, a.y - 24, 10, '#c21d2f', 1.8);
    Snd.play('hit');
    if (a.hp <= 0) { kill(a); if (a === guard) say('El guarda ha caigut!'); }
    else if (a.sword) a.go('hurt', 'hurt', 2);
    else { a.sword = true; a.go('hurt', 'hurt', 2); }
    if (from) a.face = sign(from.x - a.x);
  }

  function landOn(a) {
    const fy = a.y, dist = fy - a.fallStart;
    const t = tile(colOf(a.x), a.row);
    burst(a.x, fy, 6, '#8a86a8', 1.2, 0.4);
    if (t.ch === 'L' && !t.shake) t.shake = 1;
    if (t.ch === 'S') { t.ext = 4; return kill(a, 'spikes'); }
    if (dist > 140) { Snd.play('slam'); return kill(a); }
    if (dist > 80) { Snd.play('slam'); a.hp--; a.flash = 20; if (a.hp <= 0) return kill(a); say('Ai! Aquesta caiguda ha fet mal.'); return a.go('land', 'landHard', 2); }
    Snd.play('land');
    if (dist > 30) return a.go('land', 'landCrouch', 2);
    if (a.jumpKind === 'run' && held[a.face > 0 ? 'right' : 'left']) return a.go('landRun', 'landRun', 2);
    a.go('land', 'landSoft', 2);
  }

  // física comuna per a 'air' i 'fall'
  function airPhysics(a, g) {
    const prevY = a.y;
    a.vy = Math.min(a.vy + g, 6);
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

  function nearGuard() {
    return guard.alive && guard.row === prince.row && Math.abs(guard.x - prince.x) < 110 && guard.state !== 'dead';
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
    if (pressed.act && a.sword) a.queued = true;
    const combatReady = ['idle', 'run', 'startRun', 'stop', 'land', 'turn'].includes(a.state);
    if (combatReady && nearGuard() && a.grounded()) {
      a.face = sign(guard.x - a.x); a.sword = true; a.vx = 0;
      return a.go('drawSword', 'drawSword', 4);
    }
    switch (a.state) {
      case 'idle': {
        a.vx = 0;
        if (!ground()) return;
        const dc = colOf(a.x);
        if (held.up && tile(dc, a.row).ch === 'D' && game.door >= 1) {
          a.x = dc * TW + 16; a.go('win', 'victory'); Snd.play('win'); say('Llibertat! Has escapat del Palau de la Lluna.');
          return;
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
        }
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
        airPhysics(a, 0.2);
        break;
      case 'drink':
        if (a.at === 20 && a.potion) { a.potion.taken = true; }
        if (a.at === 40) Snd.play('gulp');
        if (a.done) {
          if (a.hp < a.maxHp) a.hp++; else { a.maxHp++; a.hp = a.maxHp; }
          burst(a.x, a.y - 32, 14, '#ff6a7a', 1, 1);
          say('Una poció! Et sents més fort.');
          a.go('idle', 'idle', 4);
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
        const g = guard.alive && guard.row === a.row && Math.abs(guard.x - a.x) < 160;
        if (!g) { a.gardeT = (a.gardeT || 0) + 1; if (a.gardeT > 40) { a.gardeT = 0; a.sword = false; return a.go('drawDone', 'sheathe', 4); } }
        else a.gardeT = 0;
        if (g && sign(guard.x - a.x) !== a.face) return a.go('gardeTurn');
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
      case 'advance':
        if (a.at <= 10 && Math.abs(guard.x - (a.x + a.face)) > 15 || !guard.alive) a.move(a.face * 0.9);
        if (!a.grounded()) { a.sword = false; return startFall(a, 0); }
        if (a.done) a.go('garde', 'garde', 0);
        break;
      case 'retreat': {
        const nx = a.x - a.face * 0.9;
        if (a.at <= 10 && isFloor(colOf(nx - a.face * 4), a.row)) a.move(-a.face * 0.9);
        if (a.done) a.go('garde', 'garde', 0);
        break;
      }
      case 'strike':
        if (a.at === 13) resolveHit(a, guard);
        if (a.done) a.go('garde', 'garde', 0);
        break;
      case 'block':
        if (a.done) a.go('garde', 'garde', 0);
        break;
      case 'hurt':
        if (a.at < 10) a.move(-a.face * 0.6);
        if (a.done) a.go('garde', 'garde', 0);
        break;
      case 'win':
        if (a.done) { game.fade += 0.02; if (game.fade >= 1) { game.mode = 'win'; showOverlay('win'); } }
        break;
      case 'dead':
        game.timer++;
        if (game.timer === 80) { showOverlay('dead'); game.mode = 'dead'; }
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

  // ---- IA del guarda -------------------------------------------------------------
  function updateGuard() {
    const g = guard, p = prince;
    g.at++;
    const dx = p.x - g.x, ad = Math.abs(dx);
    const engaged = p.alive && p.row === g.row && ad < 120;
    switch (g.state) {
      case 'idle':
        if (engaged) { g.face = sign(dx); g.sword = true; g.go('drawSword', 'drawSword', 4); say('Un guarda! Maj/Espai: atacar · Amunt: parar el cop'); }
        break;
      case 'drawSword':
        if (g.done) g.go('garde', 'garde', 0);
        break;
      case 'garde':
        g.cool--;
        if (!p.alive) break;
        if (sign(dx) !== g.face) return g.go('gardeTurn');
        if (p.state === 'strike' && p.at < 9) {
          if (!g.decided) { g.decided = true; if (Math.random() < 0.45) return g.go('block', 'block', 2); }
        } else g.decided = false;
        if (ad > 33 && engaged) return g.go('advance');
        if (ad < 18) return g.go('retreat');
        if (ad <= 38 && g.cool <= 0 && Math.random() < 0.05) { g.cool = 45 + Math.random() * 40; Snd.play('swish'); return g.go('strike', 'strike', 3); }
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

  // ---- trampes i objectes -------------------------------------------------------
  function updateWorld() {
    const p = prince;
    const pg = p.alive && ['idle', 'run', 'startRun', 'stop', 'step', 'land', 'landRun', 'crouch', 'turn', 'garde', 'advance', 'retreat', 'strike', 'block'].includes(p.state);
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
        if (t.ch === 'B' && pg && p.row === r && colOf(p.x) === c && !t.pressed) {
          t.pressed = 1; game.doorTarget = 1; Snd.play('door');
          say('S\'ha sentit un cruixit llunyà... la porta s\'obre!');
        }
      }
    }
    if (game.door < game.doorTarget) game.door = Math.min(1, game.door + 0.006);
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
    const pose = a.computePose();
    if (a.flash > 0 && (a.flash-- >> 2) % 2) return;
    const img = Sprite.drawPose(R, pose, a.kind, { scarf: a.scarf });
    ctx.save();
    ctx.translate(Math.round(a.x - camX), Math.round(a.y));
    ctx.scale(a.face, 1);
    ctx.drawImage(img, -Sprite.OX, -Sprite.OY);
    ctx.restore();
  }

  function drawFlame(x, y) {
    const f = Math.sin(tick * 0.4 + x) * 1.5;
    ctx.fillStyle = '#c7381c'; ctx.fillRect(x - 3, y - 6, 6, 6);
    ctx.fillStyle = '#f08a24'; ctx.fillRect(x - 2, y - 9 + f * 0.5, 4, 7);
    ctx.fillStyle = '#ffd860'; ctx.fillRect(x - 1, y - 7 + f * 0.3, 2, 4);
    if ((tick + x) % 9 < 2) { ctx.fillStyle = '#ffb040'; ctx.fillRect(x + Math.round(f), y - 13, 1, 1); }
  }

  function render() {
    const room = Math.max(0, Math.min(2, Math.floor(prince.x / ROOMW)));
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
          const h = Math.round((1 - game.door) * 44);
          ctx.fillStyle = '#1c1a26';
          for (let k = 0; k < 6; k++) ctx.fillRect(x0 + 5 + k * 4, fy - 46, 1, h);
          ctx.fillRect(x0 + 4, fy - 46 + h - 2, 24, 2);
        }
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
      const x = (it.c - c0) * TW + 22, fy = floorY(it.r);
      ctx.fillStyle = '#0a0c14'; ctx.fillRect(x - 3, fy - 9, 7, 7); ctx.fillRect(x - 1, fy - 13, 3, 4);
      ctx.fillStyle = '#d1283a'; ctx.fillRect(x - 2, fy - 8, 5, 5);
      ctx.fillStyle = '#ff8a9a'; ctx.fillRect(x - 1, fy - 7, 1, 2);
      ctx.fillStyle = '#c9c3b0'; ctx.fillRect(x, fy - 12, 1, 3);
      if (tick % 40 < 20) { ctx.fillStyle = '#ff9aa8'; ctx.fillRect(x + 1, fy - 15 - ((tick % 20) >> 2), 1, 1); }
    }
    if (Math.floor(guard.x / ROOMW) === room) drawActor(guard, camX);
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
    if (guard.alive && guard.state !== 'idle' && Math.floor(guard.x / ROOMW) === room) {
      for (let i = 0; i < guard.hp; i++) {
        ctx.fillStyle = '#3a8ee0';
        for (let k = 0; k < 5; k++) ctx.fillRect(W - 12 - i * 8 + k, GAMEH + 9 - k * 1.4, 7 - k * 2 > 0 ? 7 - k * 2 : 1, 1.4);
      }
    }
    ctx.fillStyle = '#6e6a8c'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
    ctx.fillText('SALA ' + (room + 1), W / 2, GAMEH + 9);
    if (game.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, game.fade)})`; ctx.fillRect(0, 0, W, H); }
  }

  function showOverlay(kind) {
    overlay.classList.remove('hidden');
    overlay.querySelector('h1').textContent = kind === 'win' ? 'Has escapat!' : 'Has mort';
    overlay.querySelector('.sub').textContent = kind === 'win' ? 'La lluna t\'espera a fora del palau.' : 'Les ombres del palau t\'han vençut.';
    overlay.querySelector('.go').textContent = 'Prem R o toca per tornar a jugar';
  }

  // ---- bucle principal amb pas fix a 60 Hz --------------------------------------
  let acc = 0, last = performance.now();
  function frame(now) {
    acc += Math.min(100, now - last); last = now;
    while (acc >= 1000 / 60) {
      acc -= 1000 / 60;
      if (game.mode === 'play') {
        tick++;
        updatePrince(); updateGuard(); updateWorld();
        updateScarf(prince);
        prince.x = Math.max(6, Math.min(COLS * TW - 6, prince.x));
      }
      for (const k in pressed) pressed[k] = false;
    }
    if (L) render(); else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    requestAnimationFrame(frame);
  }

  // pantalla de títol: es dibuixa el nivell al fons
  start(); game.mode = 'title'; overlay.classList.remove('hidden'); say('');
  requestAnimationFrame(frame);

  window.__game = { get prince() { return prince; }, get guard() { return guard; }, game, held, pressed };
})();
