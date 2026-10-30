// anims.js — biblioteca d'animacions per fotogrames clau.
// Cada animació és una llista de [pose, durada en ticks]; el motor interpola
// entre poses consecutives (a 60 ticks per segon).
(function () {
  'use strict';
  const { resolve } = Sprite;

  const P = (p) => resolve(p);
  // pose "a terra" desplaçada horitzontalment respecte l'ancoratge
  const at = (p, hx) => resolve(Object.assign({}, p, { hx }));

  // ---- poses base ----------------------------------------------------------
  const STAND = P({ rh: 4, rk: 3, lh: -3, lk: 2 });
  const BREATH = P({ rh: 4, rk: 4, lh: -3, lk: 3, ls: -9, le: 15, rs: 3, re: 17, hd: 3, t: 1 });
  const CROUCH = P({ t: 30, hd: -18, rh: 75, rk: 100, lh: 15, lk: 110, la: -20, rs: 45, re: 30, ls: 35, le: 35 });
  const HANG = P({ g: 0, hx: -3, hy: 26, t: -4, rs: 172, re: 0, ls: 168, le: 4, rh: 6, rk: 12, lh: -6, lk: 18, ra: 30, la: 30 });
  const HANG2 = P({ g: 0, hx: -3, hy: 26, t: -2, rs: 172, re: 0, ls: 168, le: 4, rh: -4, rk: 18, lh: 6, lk: 10, ra: 30, la: 30 });
  const SQUAT = P({ t: 20, rh: 50, rk: 80, lh: 40, lk: 80, rs: -40, re: 30, ls: -45, le: 30 });
  const AIR1 = P({ g: 0, hy: -27, t: 10, rh: 70, rk: 50, lh: -45, lk: 40, rs: 100, re: 10, ls: -70, le: 20, la: 20 });
  const AIR2 = P({ g: 0, hy: -26, t: 4, rh: 45, rk: 30, lh: -10, lk: 60, rs: 60, re: 30, ls: -20, le: 30 });
  const LAND = P({ t: 20, rh: 55, rk: 70, lh: -20, lk: 60, rs: 30, re: 40, ls: 10, le: 40 });
  const KNEEL = P({ t: 40, hd: -10, rh: 70, rk: 110, lh: 0, lk: 120, la: -30, rs: 60, re: 20, ls: 50, le: 20 });
  const LYING = P({ g: 0, hx: -2, hy: -4, t: -92, hd: 15, rh: 88, rk: 4, lh: 84, lk: 14, rs: -105, re: 10, ls: -60, le: 30, ra: -20, la: -10 });
  const GARDE = P({ t: 5, rh: 28, rk: 25, ra: -5, lh: -22, lk: 20, rs: 65, re: 25, sw: 115, ls: -150, le: -40 });
  const GARDE2 = P({ t: 6, rh: 28, rk: 30, ra: -5, lh: -22, lk: 25, rs: 62, re: 28, sw: 118, ls: -148, le: -44 });

  // ---- cicle de córrer ------------------------------------------------------
  const R1 = P({ t: 12, rh: 38, rk: 12, lh: -32, lk: 40, rs: -45, re: 70, ls: 45, le: 60 });
  const R2 = P({ t: 12, rh: 2, rk: 30, lh: 25, lk: 95, rs: -5, re: 60, ls: 10, le: 60 });
  const R3 = P({ t: 12, lh: 38, lk: 12, rh: -32, rk: 40, ls: -45, le: 70, rs: 45, re: 60 });
  const R4 = P({ t: 12, lh: 2, lk: 30, rh: 25, rk: 95, ls: -5, le: 60, rs: 10, re: 60 });

  // ---- escalar (ancorat a la vora del replà) --------------------------------
  const C1 = P({ g: 0, hx: -4, hy: 12, t: -6, rs: 60, re: 140, ls: 55, le: 135, rh: 20, rk: 40, lh: -10, lk: 30, ra: 20, la: 20 });
  const C2 = P({ g: 0, hx: 0, hy: 2, t: 22, hd: 5, rs: -60, re: 120, ls: -55, le: 115, rh: 100, rk: 110, lh: -10, lk: 30 });
  const C3 = at({ t: 30, hd: -10, rh: 75, rk: 100, lh: 15, lk: 110, la: -20, rs: 25, re: 30, ls: 20, le: 35 }, 8);
  const C4 = at({ rh: 4, rk: 3, lh: -3, lk: 2 }, 10);

  function reverse(frames) {
    const n = frames.length;
    return frames.map((f, i) => [frames[n - 1 - i][0], i < n - 1 ? frames[n - 2 - i][1] : 1]);
  }
  const CLIMB = [[HANG, 12], [C1, 12], [C2, 10], [C3, 8], [C4, 1]];

  const A = {
    idle: { loop: true, frames: [[STAND, 70], [BREATH, 70]] },
    startRun: {
      frames: [
        [STAND, 5],
        [P({ t: 6, rh: 20, rk: 20, lh: -5, lk: 5, rs: -20, re: 40, ls: 25, le: 50 }), 6],
        [P({ t: 10, rh: 35, rk: 10, lh: -25, lk: 45, rs: -35, re: 60, ls: 40, le: 60 }), 4],
        [R1, 1],
      ],
    },
    run: { loop: true, frames: [[R1, 6], [R2, 6], [R3, 6], [R4, 6]] },
    stop: {
      frames: [
        [P({ t: -8, rh: 40, rk: 0, ra: -10, lh: -10, lk: 60, rs: 30, re: 40, ls: -30, le: 30 }), 9],
        [P({ t: -4, rh: 25, rk: 15, lh: -5, lk: 40, rs: 15, re: 30, ls: -10, le: 20 }), 7],
        [STAND, 2],
      ],
    },
    turn: {
      frames: [
        [P({ t: -3, rh: 10, rk: 20, lh: -10, lk: 10, ls: 20, le: 30, rs: -15, re: 30 }), 6],
        [P({ t: 3, rh: -10, rk: 10, lh: 10, lk: 20, rs: 20, re: 30, ls: -15, le: 30 }), 6],
        [STAND, 1],
      ],
    },
    step: {
      frames: [
        [STAND, 6],
        [P({ t: 2, rh: 18, rk: 34, ra: -15 }), 8],
        [P({ t: 3, rh: 30, rk: 5, lh: -12, lk: 5, rs: -10, ls: 10 }), 7],
        [P({ rh: 10, rk: 4, lh: -6, lk: 10 }), 5],
        [STAND, 1],
      ],
    },
    crouchDown: { frames: [[STAND, 8], [CROUCH, 1]] },
    crouch: { loop: true, frames: [[CROUCH, 40], [Object.assign({}, CROUCH, { t: 32, hd: -16 }), 40]] },
    crouchUp: { frames: [[CROUCH, 9], [STAND, 1]] },
    crawl: {
      frames: [
        [CROUCH, 5],
        [P({ t: 36, hd: -20, rh: 85, rk: 110, lh: 30, lk: 120, la: -20, rs: 70, re: 20, ls: 50, le: 30 }), 6],
        [CROUCH, 1],
      ],
    },
    jumpPrep: { frames: [[STAND, 7], [P({ t: 10, rh: 30, rk: 50, lh: 25, lk: 50, rs: -30, re: 20, ls: -35, le: 20 }), 1]] },
    jumpReach: {
      frames: [[P({ t: 0, rh: 0, rk: 0, ra: 35, lh: -5, lk: 8, la: 35, rs: 168, re: 0, ls: 162, le: 6 }), 1]],
    },
    jumpAir: { frames: [[P({ g: 0, hy: -24, rh: 5, rk: 10, ra: 30, lh: -8, lk: 20, la: 30, rs: 170, re: 0, ls: 160, le: 8 }), 1]] },
    hang: { loop: true, frames: [[HANG, 40], [HANG2, 40]] },
    climb: { frames: CLIMB },
    climbDown: { frames: reverse(CLIMB) },
    standJumpPrep: { frames: [[STAND, 10], [SQUAT, 1]] },
    runJumpTakeoff: { frames: [[R1, 5], [P({ t: 15, rh: 50, rk: 60, lh: -25, lk: 10, la: 20, rs: 60, re: 20, ls: -50, le: 30 }), 1]] },
    air: { frames: [[AIR1, 14], [AIR2, 1]] },
    fall: {
      loop: true,
      frames: [
        [P({ g: 0, hy: -26, t: -5, rh: 30, rk: 50, lh: -10, lk: 60, rs: 150, re: 20, ls: 120, le: 40 }), 8],
        [P({ g: 0, hy: -26, t: -3, rh: 20, rk: 60, lh: 0, lk: 50, rs: 125, re: 45, ls: 150, le: 20 }), 8],
      ],
    },
    landRun: { frames: [[LAND, 8], [R1, 1]] },
    landSoft: { frames: [[LAND, 8], [STAND, 1]] },
    landCrouch: { frames: [[CROUCH, 14], [STAND, 9], [STAND, 1]] },
    landHard: { frames: [[KNEEL, 28], [CROUCH, 10], [STAND, 1]] },
    bump: { frames: [[P({ t: -14, hd: -10, rh: 10, rk: 30, lh: -20, lk: 20, rs: 30, re: 60, ls: 20, le: 50 }), 14], [STAND, 1]] },
    death: { frames: [[KNEEL, 12], [P({ g: 0, hx: -3, hy: -10, t: -40, hd: 10, rh: 80, rk: 60, lh: 60, lk: 80, rs: -60, re: 30, ls: -40, le: 30 }), 8], [LYING, 1]] },
    spiked: { frames: [[P({ g: 0, hy: -16, t: 50, hd: 30, rh: 60, rk: 90, lh: 30, lk: 100, rs: 20, re: 10, ls: -10, le: 10 }), 1]] },
    drink: {
      frames: [
        [STAND, 10],
        [P({ t: 45, hd: -10, rh: 30, rk: 45, lh: 20, lk: 45, rs: 70, re: 10, ls: 30, le: 20 }), 10],
        [P({ t: 45, hd: -10, rh: 30, rk: 45, lh: 20, lk: 45, rs: 70, re: 10, ls: 30, le: 20, pot: 1 }), 12],
        [P({ t: -4, hd: -25, rs: 130, re: 82, pot: 1 }), 40],
        [P({ t: -2, hd: -10, rs: 20, re: 60, face: 1 }), 14],
        [STAND, 1],
      ],
    },
    victory: {
      frames: [
        [STAND, 8],
        [P({ t: -4, hd: -12, rs: 165, re: 10, ls: 158, le: 18, face: 1, rh: 6, lh: -6 }), 40],
        [P({ t: -4, hd: -12, rs: 165, re: 10, ls: 158, le: 18, face: 1, rh: 6, lh: -6 }), 1],
      ],
    },

    // ---- esgrima --------------------------------------------------------------
    drawSword: {
      frames: [
        [STAND, 7],
        [P({ t: 3, rs: -25, re: 100, ls: 5, le: 20, rh: 10, rk: 10 }), 8],
        [P({ t: 2, rs: 160, re: 10, sw: 170, ls: -40, le: -20, rh: 20, rk: 15, lh: -15, lk: 10, face: 1 }), 8],
        [GARDE, 1],
      ],
    },
    sheathe: {
      frames: [
        [GARDE, 8],
        [P({ t: 3, rs: -25, re: 100, sw: 200, ls: 5, le: 20, rh: 10, rk: 10 }), 8],
        [STAND, 1],
      ],
    },
    garde: { loop: true, frames: [[GARDE, 30], [GARDE2, 30]] },
    advance: { frames: [[GARDE, 5], [P({ t: 6, rh: 42, rk: 12, lh: -12, lk: 30, rs: 65, re: 25, sw: 112, ls: -150, le: -40 }), 5], [GARDE, 1]] },
    retreat: { frames: [[GARDE, 5], [P({ t: 2, rh: 14, rk: 36, lh: -36, lk: 10, rs: 62, re: 25, sw: 120, ls: -150, le: -40 }), 5], [GARDE, 1]] },
    gardeTurn: { frames: [[GARDE, 5], [P({ t: 0, rh: 0, rk: 20, lh: 0, lk: 20, rs: 40, re: 60, sw: 160, ls: -40, le: -30 }), 5], [GARDE, 1]] },
    strike: {
      frames: [
        [GARDE, 6],
        [P({ t: -2, rh: 24, rk: 28, lh: -22, lk: 22, rs: 112, re: 40, sw: 150, ls: -150, le: -40 }), 5],
        [P({ hx: 4, t: 18, rh: 55, rk: 5, ra: -10, lh: -38, lk: 0, la: 30, rs: 92, re: 0, sw: 92, ls: -130, le: -30, face: 1 }), 7],
        [P({ hx: 4, t: 18, rh: 55, rk: 5, ra: -10, lh: -38, lk: 0, la: 30, rs: 92, re: 0, sw: 92, ls: -130, le: -30, face: 1 }), 10],
        [GARDE, 1],
      ],
    },
    block: {
      frames: [
        [GARDE, 4],
        [P({ t: -3, rh: 22, rk: 28, lh: -26, lk: 22, rs: 100, re: 55, sw: 172, ls: -150, le: -40 }), 12],
        [P({ t: -3, rh: 22, rk: 28, lh: -26, lk: 22, rs: 100, re: 55, sw: 172, ls: -150, le: -40 }), 6],
        [GARDE, 1],
      ],
    },
    hurt: {
      frames: [
        [GARDE, 3],
        [P({ t: -18, hd: -15, rs: 40, re: 10, sw: 70, rh: 15, rk: 5, lh: -15, lk: 30, ls: -120, le: -20, face: 1 }), 10],
        [P({ t: -10, hd: -8, rs: 50, re: 20, sw: 90, rh: 20, rk: 15, lh: -20, lk: 25, ls: -130, le: -30 }), 8],
        [GARDE, 1],
      ],
    },
  };

  // Precalcula la durada total de cada animació
  for (const k in A) {
    A[k].name = k;
    A[k].total = A[k].frames.reduce((s, f) => s + f[1], 0);
  }

  function poseAt(anim, time) {
    const F = anim.frames;
    let t = anim.loop ? time % anim.total : Math.min(time, anim.total);
    for (let i = 0; i < F.length; i++) {
      const d = F[i][1];
      if (t < d || i === F.length - 1) {
        const next = i + 1 < F.length ? F[i + 1][0] : anim.loop ? F[0][0] : F[i][0];
        return Sprite.lerpPose(F[i][0], next, Math.min(1, t / d));
      }
      t -= d;
    }
    return F[F.length - 1][0];
  }

  window.Anims = { A, poseAt, STAND, HANG, CROUCH };
})();
