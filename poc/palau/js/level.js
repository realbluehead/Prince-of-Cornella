// level.js — mapa del nivell i decorat procedural del "Palau de la Lluna".
(function () {
  'use strict';

  const TW = 32, RH = 63, ROWS = 3, ROOMW = 320, GAMEH = 192;
  // Llegenda: ' ' buit, '_' terra, '#' bloc de pedra, 'T' terra + torxa,
  // 'O' terra + finestra, 'I' terra + columna, 'S' punxes, 'L' rajola fluixa,
  // 'B' placa de pressió, 'V' palanca, 'G' reixa, 'D' porta de sortida,
  // pocions: 'P' vida, 'Q' vida màxima, 'X' verí, 'F' ploma (caiguda lenta),
  // enemics: 'K' guarda, 'M' en Mykola.
  // Cada palanca o placa obre la reixa o porta que li toca per ordre: la
  // primera activadora (d'esquerra a dreta) obre el primer objectiu, etc.
  const ROOMS = [
    // sala 1: enfilar-se, saltar l'abisme
    ['#___  O__T', '#   ___P__', '#_T__  ___'],
    // sala 2: punxes, rajola fluixa, poció gran a dalt de tot
    ['__Q__#####', '_T____L_ _', '___SS__I__'],
    // sala 3: un guarda i la primera palanca
    ['##########', '___T_  V_#', '_T__K___G_'],
    // sala 4: enfilar-se, verí i punxes
    ['###_O__T__', '# X__SS___', '__T___#___'],
    // sala 5: pont de rajoles fluixes i una placa que obre la reixa següent
    ['_O__T__O__', '__LLL__ __', '  ____B___'],
    // sala 6: reixa, guarda i la poció ploma amagada a dalt
    ['###F_ ####', '_G_____K__', '_#__T___I_'],
    // sala 7: palanca al pis de dalt
    ['#PV_ #####', '______G___', '#__T___O__'],
    // sala 8: dues palanques i punxes
    ['__T__O__T_', '_V_G_SS_V_', '__T____I__'],
    // sala 9: reixa, guarda, poció gran a dalt i un forat
    ['##_Q_ ####', '_G_____K_ ', '###____P__'],
    // sala 10: en Mykola, la placa i la porta de sortida
    ['_T__O__T_#', '#####  B_#', '_T__M_I_D#'],
  ];
  const MAP = [0, 1, 2].map((r) => ROOMS.map((s) => s[r]).join(''));
  const COLS = MAP[0].length, NROOMS = ROOMS.length;
  // on apareix l'heroi a cada sala (la 1 és l'inici; la resta, per a ?sala=N)
  const START = [[1, 2], [10, 2], [20, 1], [30, 2], [40, 1], [50, 1], [60, 1], [70, 1], [80, 1], [90, 2]];
  const POTIONS = {
    P: { type: 'vida', color: '#d1283a', hi: '#ff8a9a' },
    Q: { type: 'max', color: '#2f6fe0', hi: '#9cc4ff', big: true },
    X: { type: 'veri', color: '#3f9a2c', hi: '#b4ec8e' },
    F: { type: 'ploma', color: '#e6d36a', hi: '#fff8c8' },
  };
  const FOES = { K: 'guard', M: 'mykola' };
  const floorY = (r) => r * RH + 60;

  // generador pseudoaleatori amb llavor (el decorat és sempre el mateix)
  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function parse() {
    const tiles = [], items = [], foes = [], triggers = [], targets = [];
    for (let r = 0; r < ROWS; r++) {
      tiles.push([]);
      for (let c = 0; c < COLS; c++) {
        let ch = MAP[r][c];
        if (POTIONS[ch]) { items.push({ ch, c, r, taken: false }); ch = '_'; }
        if (FOES[ch]) { foes.push({ kind: FOES[ch], c, r }); ch = '_'; }
        const t = { ch, c, r, shake: 0, ext: 0, near: 0, pressed: 0, used: 0, open: 0, goal: 0 };
        if (ch === 'V' || ch === 'B') triggers.push(t);
        if (ch === 'G' || ch === 'D') targets.push(t);
        tiles[r].push(t);
      }
    }
    const lr = (a, b) => a.c - b.c || a.r - b.r;
    triggers.sort(lr); targets.sort(lr);
    if (triggers.length !== targets.length) console.warn('Hi ha', triggers.length, 'palanques/plaques i', targets.length, 'reixes/portes');
    triggers.forEach((t, i) => { t.target = targets[i]; });
    return { tiles, items, foes, triggers };
  }

  // ---- decorat de fons (pre-renderitzat per sala) --------------------------
  function drawBricks(g, R, x0, y0, w, h) {
    for (let y = y0; y < y0 + h; y += 9) {
      let x = x0 - Math.floor(R() * 14);
      while (x < x0 + w) {
        const bw = 12 + Math.floor(R() * 12);
        const v = Math.floor(R() * 16) - 8;
        const tint = R() < 0.06 ? 10 : 0;
        g.fillStyle = `rgb(${50 + v + tint},${52 + v},${80 + v - tint})`;
        g.fillRect(x + 1, y + 1, bw - 1, 8);
        g.fillStyle = `rgba(255,255,255,0.07)`;
        g.fillRect(x + 1, y + 1, bw - 1, 1);
        g.fillStyle = `rgba(0,0,0,0.25)`;
        g.fillRect(x + 1, y + 8, bw - 1, 1);
        if (R() < 0.08) {
          // esquerda
          g.fillStyle = 'rgba(10,10,20,0.6)';
          let cx = x + 3 + Math.floor(R() * (bw - 6)), cy = y + 2;
          for (let i = 0; i < 6; i++) { g.fillRect(cx, cy, 1, 1); cx += Math.round(R() * 2 - 1); cy++; }
        }
        x += bw;
      }
    }
  }

  function drawWindow(g, R, x0, rowTop, moon) {
    const wx = x0 + 7, wy = rowTop + 12, ww = 18, wh = 34;
    g.fillStyle = '#6e6a8c';
    g.fillRect(wx - 2, wy + 6, ww + 4, wh - 4);
    g.beginPath(); g.arc(wx + ww / 2, wy + 9, ww / 2 + 2, Math.PI, 0); g.fill();
    // cel nocturn
    g.save();
    g.beginPath();
    g.rect(wx, wy + 9, ww, wh - 9);
    g.arc(wx + ww / 2, wy + 9, ww / 2, Math.PI, 0);
    g.clip();
    const grd = g.createLinearGradient(0, wy, 0, wy + wh);
    grd.addColorStop(0, '#0a0d2a'); grd.addColorStop(1, '#3a2752');
    g.fillStyle = grd; g.fillRect(wx, wy, ww, wh);
    g.fillStyle = '#fff';
    for (let i = 0; i < 9; i++) g.fillRect(wx + Math.floor(R() * ww), wy + Math.floor(R() * wh * 0.6), 1, 1);
    if (moon) {
      g.fillStyle = '#f4e6b0'; g.beginPath(); g.arc(wx + 12, wy + 9, 4, 0, 7); g.fill();
      g.fillStyle = '#0d102e'; g.beginPath(); g.arc(wx + 14, wy + 8, 3.5, 0, 7); g.fill();
    }
    // siluetes de cúpules i minarets
    g.fillStyle = '#140f26';
    const base = wy + wh;
    g.fillRect(wx, base - 8, ww, 8);
    g.beginPath(); g.arc(wx + 6, base - 8, 5, Math.PI, 0); g.fill();
    g.fillRect(wx + 13, base - 18, 2, 12);
    g.beginPath(); g.arc(wx + 14, base - 18, 2, Math.PI, 0); g.fill();
    g.fillStyle = '#e8b04a';
    g.fillRect(wx + 3, base - 5, 1, 1); g.fillRect(wx + 9, base - 4, 1, 1); g.fillRect(wx + 15, base - 3, 1, 1);
    g.restore();
    g.fillStyle = '#8a86a8'; g.fillRect(wx - 3, wy + wh, ww + 6, 2);
  }

  function drawPillar(g, x0, rowTop, fy) {
    const px = x0 + 10;
    g.fillStyle = '#4c4a6e'; g.fillRect(px, rowTop + 6, 12, fy - rowTop - 6);
    g.fillStyle = '#6d6a92'; g.fillRect(px + 2, rowTop + 6, 3, fy - rowTop - 6);
    g.fillStyle = '#2e2c48'; g.fillRect(px + 10, rowTop + 6, 2, fy - rowTop - 6);
    g.fillStyle = '#7a77a0'; g.fillRect(px - 3, rowTop + 2, 18, 5); g.fillRect(px - 2, fy - 6, 16, 6);
    g.fillStyle = '#3a3858'; g.fillRect(px - 3, rowTop + 6, 18, 1);
  }

  function drawBanner(g, R, x0, rowTop) {
    const bx = x0 + 9, by = rowTop + 6;
    g.fillStyle = '#2a2018'; g.fillRect(bx - 2, by, 18, 2);
    g.fillStyle = '#6c1622'; g.fillRect(bx, by + 2, 14, 30);
    g.beginPath(); g.moveTo(bx, by + 32); g.lineTo(bx + 7, by + 38); g.lineTo(bx + 14, by + 32); g.fill();
    g.fillStyle = '#d6a92a';
    g.fillRect(bx + 1, by + 4, 12, 1); g.fillRect(bx + 1, by + 29, 12, 1);
    // lluna creixent brodada
    g.beginPath(); g.arc(bx + 7, by + 16, 4, 0, 7); g.fill();
    g.fillStyle = '#6c1622'; g.beginPath(); g.arc(bx + 9, by + 15, 3.5, 0, 7); g.fill();
  }

  function drawDoor(g, x0, rowTop, fy) {
    const dx = x0 + 3, dw = 26, dy = rowTop + 8;
    g.fillStyle = '#8a86a8';
    g.fillRect(dx - 3, dy + 10, dw + 6, fy - dy - 10);
    g.beginPath(); g.arc(dx + dw / 2, dy + 13, dw / 2 + 3, Math.PI, 0); g.fill();
    g.fillStyle = '#0c0a14';
    g.fillRect(dx, dy + 13, dw, fy - dy - 13);
    g.beginPath(); g.arc(dx + dw / 2, dy + 13, dw / 2, Math.PI, 0); g.fill();
    // escales que pugen cap a la llum
    for (let i = 0; i < 5; i++) {
      g.fillStyle = `rgb(${40 + i * 18},${34 + i * 14},${50 + i * 10})`;
      g.fillRect(dx + 2 + i * 2, fy - 4 - i * 5, dw - 4 - i * 4, 4);
    }
    g.fillStyle = '#d6a92a';
    g.fillRect(dx + dw / 2 - 1, dy - 4, 2, 3);
  }

  function renderRoom(level, room) {
    const cv = document.createElement('canvas');
    cv.width = ROOMW; cv.height = GAMEH;
    const g = cv.getContext('2d');
    const R = rng(1234 + room * 77);
    g.fillStyle = '#1d1d33'; g.fillRect(0, 0, ROOMW, GAMEH);
    drawBricks(g, R, 0, 0, ROOMW, GAMEH);
    for (let r = 0; r < ROWS; r++) {
      const rowTop = r * RH, fy = floorY(r);
      for (let i = 0; i < 10; i++) {
        const c = room * 10 + i, ch = level.tiles[r][c].ch, x0 = i * TW;
        if (ch === 'O') drawWindow(g, R, x0, rowTop, (room + r) % 3 === 0);
        else if (ch === 'I') drawPillar(g, x0, rowTop, fy);
        else if (ch === 'D') drawDoor(g, x0, rowTop, fy);
        else if (ch === '_' && R() < 0.12) drawBanner(g, R, x0, rowTop);
        if (ch === 'T') {
          g.fillStyle = '#2a1e14'; g.fillRect(x0 + 14, rowTop + 26, 4, 8);
          g.fillStyle = '#5a4026'; g.fillRect(x0 + 13, rowTop + 22, 6, 4);
        }
        // molsa i cadenes ocasionals
        if (R() < 0.15) {
          g.fillStyle = 'rgba(70,110,60,0.5)';
          for (let k = 0; k < 6; k++) g.fillRect(x0 + Math.floor(R() * 30), fy - 4 - Math.floor(R() * 4), 1 + Math.floor(R() * 2), 1);
        }
        if (ch === ' ' && R() < 0.4) {
          g.fillStyle = '#3a3a52';
          for (let y = rowTop; y < rowTop + 14 + R() * 20; y += 3) g.fillRect(x0 + 15 + (y / 3) % 2, y, 2, 2);
        }
      }
    }
    // foscor a dalt i a baix
    const v = g.createLinearGradient(0, 0, 0, GAMEH);
    v.addColorStop(0, 'rgba(0,0,10,0.35)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,10,0.3)');
    g.fillStyle = v; g.fillRect(0, 0, ROOMW, GAMEH);
    return cv;
  }

  // ---- rajoles dinàmiques -------------------------------------------------
  function drawBlock(g, x0, rowTop) {
    g.fillStyle = '#4a4868'; g.fillRect(x0, rowTop, TW, RH);
    for (let y = 0; y < RH; y += 16) {
      const off = (y / 16) % 2 ? 0 : 16;
      for (let x = -off; x < TW; x += 32) {
        g.fillStyle = '#5c5a80'; g.fillRect(x0 + Math.max(0, x) + 1, rowTop + y + 1, Math.min(31, TW - Math.max(0, x)) - 1, 14);
        g.fillStyle = '#6e6c94'; g.fillRect(x0 + Math.max(0, x) + 1, rowTop + y + 1, Math.min(31, TW - Math.max(0, x)) - 1, 1);
      }
    }
    g.fillStyle = '#2c2a44'; g.fillRect(x0 + TW - 1, rowTop, 1, RH);
  }

  function drawFloorTop(g, x0, fy, t, tick) {
    let oy = 0;
    if (t.ch === 'L' && t.shake > 0) oy = (tick >> 1) % 2;
    g.fillStyle = t.ch === 'L' ? '#86829e' : '#7e7b9e';
    g.fillRect(x0, fy - 3 + oy, TW, 3);
    g.fillStyle = '#a4a1c2'; g.fillRect(x0, fy - 3 + oy, TW, 1);
    if (t.ch === 'B') {
      g.fillStyle = t.pressed ? '#8a7a50' : '#c9a85a';
      g.fillRect(x0 + 6, fy - 5 + (t.pressed ? 2 : 0), 20, 2);
    }
  }

  function drawFloorFront(g, x0, fy, t, tick) {
    let oy = 0;
    if (t.ch === 'L' && t.shake > 0) oy = (tick >> 1) % 2;
    g.fillStyle = '#3e3c5a'; g.fillRect(x0, fy + oy, TW, 6);
    g.fillStyle = '#2a283f'; g.fillRect(x0 + 15, fy + oy, 1, 6); g.fillRect(x0, fy + 5 + oy, TW, 1);
    if (t.ch === 'L') { g.fillStyle = '#26243a'; g.fillRect(x0, fy + oy, 1, 6); g.fillRect(x0 + TW - 1, fy + oy, 1, 6); }
  }

  function drawSpikes(g, x0, fy, ext) {
    if (ext <= 0) { g.fillStyle = '#1a1826'; for (let i = 0; i < 4; i++) g.fillRect(x0 + 4 + i * 7, fy - 3, 3, 1); return; }
    const h = Math.round(ext * 2.2);
    for (let i = 0; i < 4; i++) {
      const sx = x0 + 4 + i * 7;
      g.fillStyle = '#c8ccd8'; g.fillRect(sx + 1, fy - 3 - h, 1, h);
      g.fillStyle = '#8a8ea0'; g.fillRect(sx, fy - 3 - Math.floor(h * 0.6), 1, Math.floor(h * 0.6)); g.fillRect(sx + 2, fy - 3 - Math.floor(h * 0.6), 1, Math.floor(h * 0.6));
    }
  }

  // palanca a la paret: el mànec apunta amunt i, un cop estirada, avall
  function drawLever(g, x0, fy, on) {
    const cx = x0 + 16, cy = fy - 22;
    g.fillStyle = '#2a2838'; g.fillRect(cx - 4, cy - 5, 8, 10);
    g.fillStyle = '#6e6a8c'; g.fillRect(cx - 3, cy - 4, 6, 8);
    const dir = on ? 1 : -1;
    g.fillStyle = '#3a2a1a';
    for (let i = 0; i < 9; i++) g.fillRect(cx + Math.round(i * 0.4), cy + dir * i, 2, 1);
    g.fillStyle = on ? '#5fc46e' : '#d6a92a'; g.fillRect(cx + 3, cy + dir * 9 - 1, 3, 3);
    g.fillStyle = '#1c1a26'; g.fillRect(cx - 1, cy - 1, 2, 2);
  }

  // reixa que puja (open = 0 tancada, 1 oberta); barra el pas pel mig de la rajola
  function drawGate(g, x0, fy, open) {
    const top = fy - 50, h = Math.round((1 - open) * 47);
    g.fillStyle = '#7a77a0'; g.fillRect(x0 + 9, top - 4, 14, 4);
    g.fillStyle = '#3a3858'; g.fillRect(x0 + 9, top, 14, 1);
    if (h <= 0) return;
    g.fillStyle = '#16141f';
    for (const bx of [11, 15, 19]) g.fillRect(x0 + bx, top, 2, h + 2);
    for (let y = top + 4; y < top + h - 1; y += 7) g.fillRect(x0 + 10, y, 12, 2);
    g.fillStyle = '#5a5778';
    for (const bx of [11, 15, 19]) g.fillRect(x0 + bx, top, 1, h);
  }

  window.Level = { TW, RH, ROWS, COLS, NROOMS, ROOMW, GAMEH, MAP, START, POTIONS, floorY, parse, renderRoom, drawBlock, drawFloorTop, drawFloorFront, drawSpikes, drawLever, drawGate };
})();
