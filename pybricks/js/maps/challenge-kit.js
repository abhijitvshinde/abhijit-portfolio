// Shared helpers for the 25 skill challenges (B1-B5, I1-I7, A1-A7, M1-M6).
// Each challenge is a small map of its own, worth 100 points. Load this file before the
// challenge files (see index.js).
(function (g) {
  'use strict';
  const P = g.PYB;
  const D = Math.PI / 180;

  // Same header as the big maps, so PYB.adaptStarter() can rewrite it for other robot setups.
  const HEADER = `from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor, UltrasonicSensor, ForceSensor
from pybricks.parameters import Button, Color, Direction, Port, Side, Stop
from pybricks.robotics import DriveBase
from pybricks.tools import wait, StopWatch

hub = PrimeHub()

# Drive motors: the left one is mirrored, so it turns counterclockwise to go forward.
left_motor = Motor(Port.A, Direction.COUNTERCLOCKWISE)
right_motor = Motor(Port.B)
arm = Motor(Port.C)          # positive angle = arm goes up

drive_base = DriveBase(left_motor, right_motor, wheel_diameter=56, axle_track=112)
`;

  const LEVELS = {
    B: ['Beginner challenges', 'Beginner'],
    I: ['Intermediate challenges', 'Intermediate'],
    A: ['Advanced challenges', 'Advanced'],
    M: ['Master challenges', 'Master']
  };
  const ORDER = 'BIAM';

  const K = {
    D,
    // point `d` mm from (x, y) in direction `deg` (0 = east, 90 = north)
    polar(x, y, deg, d) { return [x + Math.cos(deg * D) * d, y + Math.sin(deg * D) * d]; },
    // arm angle (deg) that puts the tip at height h, and how far ahead of the axle the tip is then
    armFor(h) { const a = Math.asin((h - P.ROBOT.pivotZ) / P.ROBOT.armLength) / D; return { angle: a, reach: P.ROBOT.pivotX + P.ROBOT.armLength * Math.cos(a * D) }; },
    // two posts that make a gate across a path going in direction `deg`
    gate(id, x, y, deg, gap, opts = {}) {
      const r = opts.r || 15, off = gap / 2 + r;
      const [ax, ay] = K.polar(x, y, deg + 90, off), [bx, by] = K.polar(x, y, deg - 90, off);
      const base = { kind: 'cyl', r, z1: opts.h || 150, color: opts.color || '#e0662f', penalty: true, label: opts.label || 'Gate post' };
      return [Object.assign({ id: id + '-a', x: ax, y: ay }, base), Object.assign({ id: id + '-b', x: bx, y: by }, base)];
    },
    // a wall built from short straight pieces along a circle (angles in degrees, CCW from east)
    arcWall(id, cx, cy, R, a0, a1, opts = {}) {
      const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (opts.step || 9)));
      const out = [];
      for (let i = 0; i < n; i++) {
        const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n, tm = (t0 + t1) / 2;
        const len = 2 * R * Math.sin(Math.abs(t1 - t0) / 2 * D) + 8;
        const [x, y] = K.polar(cx, cy, tm, R);
        out.push({ id: id + i, label: opts.label || 'Wall', x, y, w: len, d: opts.t || 16, rot: tm + 90, z1: opts.h || 70, color: opts.color || '#b0754a', penalty: true });
      }
      return out;
    },
    // a parking slot: the robot ends at (x, y) facing `deg`, with the slot behind it
    slot(id, x, y, deg, width, depth, opts = {}) {
      const t = opts.t || 20, h = opts.h || 90, col = opts.color || '#7d8ea3';
      const front = opts.front === undefined ? 40 : opts.front;
      const len = front + depth;
      const mid = K.polar(x, y, deg, (front - depth) / 2);
      const side = (s) => { const [sx, sy] = K.polar(mid[0], mid[1], deg + 90 * s, width / 2 + t / 2); return { id: id + (s > 0 ? '-l' : '-r'), label: 'Slot wall', x: sx, y: sy, w: len, d: t, rot: deg, z1: h, color: col, penalty: true }; };
      const [bx, by] = K.polar(x, y, deg, -depth - t / 2);
      return [side(1), side(-1), { id: id + '-back', label: 'Slot wall', x: bx, y: by, w: t, d: width + 2 * t, rot: deg, z1: h, color: col, penalty: true }];
    }
  };
  P.kit = K;

  P.challenge = function (c) {
    const [group, difficulty] = LEVELS[c.code[0]];
    const st = c.start;
    const pad = { shape: 'rect', x0: st.x - 95, y0: st.y - 95, x1: st.x + 95, y1: st.y + 95, color: 'blue' };
    const map = Object.assign({ size: [1500, 1000], timeLimit: 60, targets: [], obstacles: [] }, c, {
      id: 'ch-' + c.code.toLowerCase(),
      group, difficulty,
      level: 100 + ORDER.indexOf(c.code[0]) * 20 + Number(c.code.slice(1)),
      paint: (c.startPad === false ? [] : [pad]).concat(c.paint || []),
      starter: HEADER + (c.starterExtra ? c.starterExtra + '\n' : '') +
        `\n# ${c.code} · ${c.name}\n# ${c.goal}\n\n# Your code here...\n`
    });
    P.MAPS.push(map);
  };
})(typeof self !== 'undefined' ? self : window);
