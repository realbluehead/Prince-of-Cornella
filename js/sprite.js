// sprite.js — esquelet procedural i rasteritzador pixel-art.
// Cada fotograma es dibuixa píxel a píxel a partir d'una "pose" (angles de les
// articulacions), mirant sempre a la dreta; el joc l'emmiralla si cal.
(function () {
  'use strict';

  const D2R = Math.PI / 180;
  // escala global del personatge respecte les mides de disseny originals
  const S = 0.8;
  const SK = { thigh: 11 * S, shin: 11 * S, torso: 13 * S, sh: 11 * S, uarm: 8 * S, farm: 8 * S, foot: 4 * S, neck: 4 };
  const BUF_W = 112, BUF_H = 128, OX = 56, OY = 70;

  // 0° = cap avall, angles positius = cap endavant (cap on mira el personatge)
  const dirv = (a) => [Math.sin(a * D2R), Math.cos(a * D2R)];

  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
  }

  // Paletes: l'heroi està inspirat en la foto (cabell i barba foscos amb algun
  // pèl gris, jaqueta plomífera blau marí i bufanda negra amb ratlles crues).
  const PALETTES = {
    prince: {
      outline: '#0a0c14', skin: '#e4aa86', skinD: '#b57656', hair: '#1c1512', beard: '#2b1f18',
      beardL: '#6b5a4e', eye: '#22130b', mouth: '#6e1717', teeth: '#f3ecdf',
      body: '#2c3b5e', bodyL: '#41588a', bodyD: '#1b2542', sleeve: '#2c3b5e', sleeveD: '#1b2542',
      fore: '#2c3b5e', foreD: '#1b2542',
      pants: '#38322f', pantsD: '#24201e', boot: '#3e2517', bootD: '#28170d',
      scarf: '#111114', stripe: '#e6dfcb', stripe2: '#9b4b2c',
      blade: '#dfe4ec', hilt: '#d0a62a',
    },
    guard: {
      outline: '#0a0806', skin: '#b67b52', skinD: '#87583a', hair: '#120c0a', beard: '#120c0a',
      beardL: '#120c0a', eye: '#1a0d06', mouth: '#5a1010', teeth: '#eee6d6',
      turban: '#ebe3cf', turbanD: '#b4a990', jewel: '#d42a30',
      body: '#8f2024', bodyL: '#b83c32', bodyD: '#5e1316', sleeve: '#8f2024', sleeveD: '#5e1316',
      fore: '#b67b52', foreD: '#87583a',
      pants: '#d8cba9', pantsD: '#a6987a', boot: '#2e1b10', bootD: '#1e1008', sash: '#d9ab2b',
      blade: '#cdd2dc', hilt: '#8a6a1e',
    },
    // en Mykola: ulleres negres de pasta, jersei verd oliva, texans i bambes
    mykola: {
      outline: '#0a0c10', skin: '#efc29e', skinD: '#c48f6c', hair: '#7a5634', beard: '#7a5634',
      beardL: '#7a5634', eye: '#1a1410', mouth: '#7a1a1a', teeth: '#f3ecdf',
      glasses: '#040404', lens: '#e4f0f6',
      body: '#5a6b3c', bodyL: '#7a8d52', bodyD: '#3a4526', sleeve: '#5a6b3c', sleeveD: '#3a4526',
      fore: '#5a6b3c', foreD: '#3a4526',
      pants: '#3d5a8a', pantsD: '#283d61', boot: '#ebe7de', bootD: '#b3ada2',
      blade: '#dfe4ec', hilt: '#a8a8b0',
    },
    // l'Olivia: nena de cabell ros i llarg, ulls blaus, samarreta rosa i bambes blanques
    olivia: {
      outline: '#2a1a14', skin: '#f6d2b4', skinD: '#dcaa88', hair: '#f2cf62', beard: '#f2cf62',
      beardL: '#f2cf62', eye: '#2f80e8', mouth: '#c8466a', teeth: '#ffffff',
      body: '#f06aa8', bodyL: '#ffa2cf', bodyD: '#b84a80', sleeve: '#f06aa8', sleeveD: '#b84a80',
      fore: '#f6d2b4', foreD: '#dcaa88',
      pants: '#7a64d8', pantsD: '#5544a8', boot: '#ffffff', bootD: '#c8c8d8',
      blade: '#dfe4ec', hilt: '#a8a8b0',
    },
  };
  const PAL32 = {};
  for (const k in PALETTES) {
    PAL32[k] = {};
    for (const c in PALETTES[k]) PAL32[k][c] = hex(PALETTES[k][c]);
  }

  // Caps (mirant a la dreta). H cabell, h cella, S pell, s pell fosca/orella,
  // E ull, B barba, b barba grisa, r boca, w dents, T/t turbant, j joia.
  const HEADS = {
    prince: [
      '..HHHHH..',
      '.HHHHHHH.',
      'HHHHHHHHH',
      'HHHHSSSS.',
      'HHHSShhS.',
      'HHsSSSES.',
      'HssSSSSSS',
      '.HsSSSSS.',
      '.BBSBBBBB',
      '..BBBBBB.',
      '...BbBB..',
    ],
    guard: [
      '..TTTTT..',
      '.TTtTTTT.',
      'TTTTTTjTT',
      'TtTTTTTT.',
      'HHHSShhS.',
      'HHsSSSES.',
      'HssSSSSSS',
      '.HsSSSSS.',
      '.HHSBBBBS',
      '..SSSSSS.',
      '...SSSS..',
    ],
    mykola: [
      '..HHHHH..',
      '.HHHHHHH.',
      'HHHHHHHHH',
      'HHHHSSSS.',
      'HHHSShhh.',
      'HHGGGGGGG',
      'HsSGgSEGS',
      'HsSGGGGGS',
      '.sSSSSSSS',
      '..SSSSSS.',
      '...SSSS..',
    ],
  };
  // l'Olivia: serrell ros i la cabellera que li baixa per darrere. L'ull blau fa
  // més d'un píxel perquè no desaparegui quan es dibuixa a escala 0.8.
  HEADS.olivia = [
    '..HHHHH..',
    '.HHHHHHH.',
    'HHHHHHHHH',
    'HHHHHHHHH',
    'HHHHSSSSS',
    'HHHSSEESS',
    'HHHsSSESS',
    'HHHHSSSS.',
    'HHHH.SrS.',
    'HHHH.....',
    '.HHH.....',
  ];
  HEADS.oliviaShout = HEADS.olivia.slice();
  HEADS.oliviaShout[8] = 'HHHH.Srr.';
  // l'heroi d'esquena (quan entra per la porta): només cabell, orelles i clatell
  HEADS.princeBack = [
    '..HHHHH..',
    '.HHHHHHH.',
    'HHHHHHHHH',
    'HHHHHHHHH',
    'HHHHHHHHH',
    'HHHHHHHHH',
    'sHHHHHHHs',
    '.HHHHHHH.',
    '.HHHHHHH.',
    '..HHHHH..',
    '...sss...',
  ];
  HEADS.mykolaShout = HEADS.mykola.slice();
  HEADS.mykolaShout[9] = '..SSrrrS.';
  HEADS.mykolaShout[10] = '...SrrS..';
  HEADS.princeShout = HEADS.prince.slice();
  HEADS.princeShout[9] = '..BBBwwB.';
  HEADS.princeShout[10] = '...BrrB..';
  HEADS.guardShout = HEADS.guard.slice();
  HEADS.guardShout[9] = '..SSSrrS.';
  const HEAD_KEYS = {
    H: 'hair', h: 'hair', S: 'skin', s: 'skinD', E: 'eye', B: 'beard', b: 'beardL',
    r: 'mouth', w: 'teeth', T: 'turban', t: 'turbanD', j: 'jewel', G: 'glasses', g: 'lens',
  };

  // Pose per defecte (dempeus). l* = cama/braç del fons, r* = del davant.
  const DEF = {
    hx: 0, hy: -24, g: 1, t: 0, hd: 0,
    lh: 0, lk: 0, la: 0, rh: 0, rk: 0, ra: 0,
    ls: -6, le: 12, rs: 6, re: 14,
    sw: null, face: 0, pot: 0, back: 0,
  };

  function skeleton(p) {
    const up = [Math.sin(p.t * D2R), -Math.cos(p.t * D2R)];
    const fwd = [Math.cos(p.t * D2R), Math.sin(p.t * D2R)];
    const neck = [up[0] * SK.torso, up[1] * SK.torso];
    const sh = [up[0] * SK.sh, up[1] * SK.sh];
    const ha = (p.t + p.hd) * D2R;
    const head = [neck[0] + Math.sin(ha) * SK.neck, neck[1] - Math.cos(ha) * SK.neck];
    function leg(h, k, an) {
      const d1 = dirv(h);
      const knee = [d1[0] * SK.thigh, d1[1] * SK.thigh];
      const sa = h - k;
      const d2 = dirv(sa);
      const ankle = [knee[0] + d2[0] * SK.shin, knee[1] + d2[1] * SK.shin];
      const d3 = dirv(sa + 90 + an);
      const toe = [ankle[0] + d3[0] * SK.foot, ankle[1] + d3[1] * SK.foot];
      return { knee, ankle, toe };
    }
    function arm(s, e) {
      const d1 = dirv(s);
      const elbow = [sh[0] + d1[0] * SK.uarm, sh[1] + d1[1] * SK.uarm];
      const d2 = dirv(s + e);
      const hand = [elbow[0] + d2[0] * SK.farm, elbow[1] + d2[1] * SK.farm];
      return { elbow, hand };
    }
    return {
      up, fwd, neck, sh, head,
      bl: leg(p.lh, p.lk, p.la), fl: leg(p.rh, p.rk, p.ra),
      ba: arm(p.ls, p.le), fa: arm(p.rs, p.re),
    };
  }

  // Completa una pose amb els valors per defecte i, si va "a terra" (g),
  // calcula l'alçada del maluc perquè el peu més baix toqui el terra.
  function resolve(p) {
    const r = Object.assign({}, DEF, p);
    r.hx *= S;
    if (!r.g) r.hy *= S;
    if (r.g) {
      const s = skeleton(r);
      let low = -99;
      for (const L of [s.bl, s.fl]) low = Math.max(low, L.ankle[1] + 2, L.toe[1] + 1.5);
      r.hy = -low;
    }
    r.g = 0;
    return r;
  }

  function lerpPose(a, b, t) {
    const o = {};
    for (const k in a) {
      const va = a[k], vb = b[k];
      if (typeof va === 'number' && typeof vb === 'number') o[k] = va + (vb - va) * t;
      else if (va == null) o[k] = vb;
      else o[k] = t < 0.5 ? va : vb == null ? null : vb;
    }
    if (a.sw == null && b.sw != null && t < 0.35) o.sw = null;
    if (a.sw != null && b.sw == null && t > 0.65) o.sw = null;
    o.face = t < 0.5 ? a.face : b.face;
    o.pot = t < 0.5 ? a.pot : b.pot;
    return o;
  }

  // ---- rasteritzador -------------------------------------------------------
  const discCache = {};
  function discOffsets(r) {
    const key = r.toFixed(2);
    if (discCache[key]) return discCache[key];
    const out = [];
    const R = Math.ceil(r), r2 = r * r + 0.3;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (x * x + y * y <= r2) out.push(x, y);
    return (discCache[key] = out);
  }

  class Renderer {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.canvas.width = BUF_W;
      this.canvas.height = BUF_H;
      this.ctx = this.canvas.getContext('2d');
      this.img = this.ctx.createImageData(BUF_W, BUF_H);
      this.buf = new Uint32Array(this.img.data.buffer);
    }
    px(x, y, c) {
      if (x < 0 || y < 0 || x >= BUF_W || y >= BUF_H) return;
      this.buf[y * BUF_W + x] = c;
    }
    disc(cx, cy, r, c) {
      const o = discOffsets(Math.round(r * 4) / 4);
      const x0 = Math.round(cx), y0 = Math.round(cy);
      for (let i = 0; i < o.length; i += 2) this.px(x0 + o[i], y0 + o[i + 1], c);
    }
    seg(a, b, r0, r1, c) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        this.disc(a[0] + dx * t, a[1] + dy * t, r0 + (r1 - r0) * t, c);
      }
    }
    // dibuixa una peça amb contorn: primer el contorn engreixat, després el farciment
    part(segs, outline) {
      for (const s of segs) this.seg(s[0], s[1], s[2] + 1, s[3] + 1, outline);
      for (const s of segs) this.seg(s[0], s[1], s[2], s[3], s[4]);
    }
    bitmap(rows, cx, cy, pal, outline) {
      const h = rows.length, w = rows[0].length;
      const x0 = Math.round(cx) - (w >> 1), y0 = Math.round(cy) - Math.round(h * 0.55);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (rows[y][x] !== '.')
            for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + ox, ny = y + oy;
              if (ny < 0 || ny >= h || nx < 0 || nx >= w || rows[ny][nx] === '.') this.px(x0 + nx, y0 + ny, outline);
            }
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const ch = rows[y][x];
          if (ch !== '.') this.px(x0 + x, y0 + y, pal[HEAD_KEYS[ch]]);
        }
    }
    flush() {
      this.ctx.putImageData(this.img, 0, 0);
      return this.canvas;
    }
  }

  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];

  // Dibuixa una pose completa al buffer. kind: 'prince' | 'guard' | 'mykola' | 'olivia'.
  // extra.scarf = angle de la cua de la bufanda (moviment secundari),
  // extra.pot = color de la poció que té a la mà.
  function drawPose(R, p, kind, extra) {
    extra = extra || {};
    const pal = PAL32[kind];
    const O = pal.outline;
    R.buf.fill(0);
    const s = skeleton(p);
    const base = [OX + p.hx, OY + p.hy];
    const T = (v) => [base[0] + v[0], base[1] + v[1]];
    const hip = base;
    const guard = kind === 'guard';
    const thighR = guard ? 2.7 : 2.1, shinR = guard ? 2.1 : 1.6;

    function legParts(L, dark) {
      const k = T(L.knee), a = T(L.ankle), toe = T(L.toe);
      const mid = [k[0] + (a[0] - k[0]) * 0.55, k[1] + (a[1] - k[1]) * 0.55];
      return [
        [hip, k, thighR, shinR + 0.2, dark ? pal.pantsD : pal.pants],
        [k, mid, shinR, shinR, dark ? pal.pantsD : pal.pants],
        [mid, a, 1.6, 1.5, dark ? pal.bootD : pal.boot],
        [a, toe, 1.3, 1.0, dark ? pal.bootD : pal.boot],
      ];
    }
    function armParts(A, dark) {
      const sh = T(s.sh), e = T(A.elbow), h = T(A.hand);
      return [
        [sh, e, 1.7, 1.5, dark ? pal.sleeveD : pal.sleeve],
        [e, h, 1.4, 1.2, dark ? pal.foreD : pal.fore],
        [h, h, 1.3, 1.3, dark ? pal.skinD : pal.skin],
      ];
    }

    // braç i cama del fons
    R.part(armParts(s.ba, true), O);
    R.part(legParts(s.bl, true), O);
    R.part(legParts(s.fl, false), O);

    // cabell llarg de l'Olivia, que li penja per l'esquena
    if (kind === 'olivia') {
      const hd = T(s.head), sh = T(s.sh);
      R.part([[add([hd[0], hd[1] + 2], s.fwd, -3), add(add(sh, s.fwd, -2.5), s.up, -9), 2.4, 1.8, pal.hair]], O);
    }

    // tors (jaqueta plomífera / armilla)
    const tb = add(hip, s.up, -1.5);
    const tt = T(s.sh);
    R.part([[tb, tt, 3.7, 4.1, pal.body]], O);
    for (const f of [0.3, 0.62]) {
      const c = [tb[0] + (tt[0] - tb[0]) * f, tb[1] + (tt[1] - tb[1]) * f];
      R.seg(add(c, s.fwd, -3.4), add(c, s.fwd, 3.4), 0.3, 0.3, pal.bodyD);
    }
    const hl0 = add([tb[0] + (tt[0] - tb[0]) * 0.4, tb[1] + (tt[1] - tb[1]) * 0.4], s.fwd, 1.8);
    const hl1 = add(tt, s.fwd, 1.8);
    R.seg(hl0, hl1, 0.6, 0.8, pal.bodyL);
    if (guard) {
      R.seg(add(hip, s.fwd, -3.3), add(hip, s.fwd, 3.3), 1.1, 1.1, pal.sash);
    }

    // cap
    const head = T(s.head);
    const back = p.back > 0.5;
    R.bitmap(HEADS[kind + (back ? 'Back' : p.face ? 'Shout' : '')] || HEADS[kind], head[0], head[1], pal, O);

    // bufanda (només l'heroi; d'esquena no se li veu la cua)
    if (kind === 'prince') {
      const nk = T(s.neck);
      R.disc(nk[0], nk[1] + 1, 3.0, O);
      R.disc(nk[0], nk[1] + 1, 2.2, pal.scarf);
      R.px(Math.round(nk[0] + 2), Math.round(nk[1] + 1), pal.stripe);
      R.px(Math.round(nk[0] + 1), Math.round(nk[1] + 2), pal.stripe);
      R.px(Math.round(nk[0] - 1), Math.round(nk[1] + 3), pal.stripe2);
      if (!back) {
        const ta = extra.scarf == null ? 8 : extra.scarf;
        const t0 = add(nk, s.fwd, 1.3);
        const td = dirv(ta + p.t * 0.5);
        const t1 = [t0[0] + td[0] * 6.5, t0[1] + 2 + td[1] * 6.5];
        R.part([[[t0[0], t0[1] + 2], t1, 1.2, 1.0, pal.scarf]], O);
        for (const f of [0.7, 0.9]) {
          R.px(Math.round(t0[0] + (t1[0] - t0[0]) * f), Math.round(t0[1] + 2 + (t1[1] - t0[1] - 2) * f), pal.stripe);
        }
      }
    }

    // espasa i braç del davant
    const hand = T(s.fa.hand);
    if (p.sw != null) {
      const d = dirv(p.sw);
      const perp = [d[1], -d[0]];
      const tip = add(hand, d, 13);
      R.seg(add(hand, d, -2), hand, 1.6, 1.6, O);
      if (guard) {
        // simitarra: fulla corbada
        const pts = [];
        for (let i = 0; i <= 8; i++) {
          const f = i / 8;
          pts.push(add(add(hand, d, 1 + 12 * f), perp, -1.8 * f * f));
        }
        for (let i = 0; i < 8; i++) R.seg(pts[i], pts[i + 1], 1.3, 1.0, O);
        for (let i = 0; i < 8; i++) R.seg(pts[i], pts[i + 1], 0.6, 0.3, pal.blade);
      } else {
        R.seg(add(hand, d, 1), tip, 1.3, 1.1, O);
        R.seg(add(hand, d, 1), tip, 0.6, 0.3, pal.blade);
      }
      R.seg(add(add(hand, d, 1), perp, -2.5), add(add(hand, d, 1), perp, 2.5), 0.6, 0.6, pal.hilt);
    }
    R.part(armParts(s.fa, false), O);
    if (p.pot) {
      R.disc(hand[0] + 1, hand[1] - 1, 2.2, O);
      R.disc(hand[0] + 1, hand[1] - 1, 1.3, hex(extra.pot || '#d1283a'));
      R.px(Math.round(hand[0] + 1), Math.round(hand[1] - 3), hex('#c9c3b0'));
    }
    return R.flush();
  }

  window.Sprite = { S, SK, DEF, OX, OY, BUF_W, BUF_H, PALETTES, resolve, lerpPose, skeleton, drawPose, Renderer, hex };
})();
