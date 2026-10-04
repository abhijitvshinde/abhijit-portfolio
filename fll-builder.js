/* ==========================================
   FLL ATTACHMENT LAB — 3D LEGO builder + mission tester
   Kids snap Technic-style pieces onto a SPIKE Prime robot,
   then press Test to watch the robot try the mission.
   Units: 1 = one LEGO stud (8 mm). Robot faces +x, y is up,
   +z is the robot's right-hand side.
========================================== */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ---------- 24 right-angle orientations ---------- */

const GEN = {
  turn: [0, 0, 1, 0, 1, 0, -1, 0, 0], // 90° about y
  tip: [0, -1, 0, 1, 0, 0, 0, 0, 1],  // 90° about z
  roll: [1, 0, 0, 0, 0, -1, 0, 1, 0]  // 90° about x
};

function mul(a, b) {
  const r = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  }
  return r;
}

const ROTS = [];
const ROT_INDEX = new Map();
(function buildRotations() {
  const queue = [[1, 0, 0, 0, 1, 0, 0, 0, 1]];
  while (queue.length) {
    const m = queue.shift();
    const key = m.join(",");
    if (ROT_INDEX.has(key)) continue;
    ROT_INDEX.set(key, ROTS.length);
    ROTS.push(m);
    for (const g of Object.values(GEN)) queue.push(mul(g, m));
  }
})();

function rotateIndex(ri, gen) {
  return ROT_INDEX.get(mul(GEN[gen], ROTS[ri]).join(","));
}

function apply(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ];
}

/* ---------- pieces ---------- */

const line = (n) => Array.from({ length: n }, (_, i) => [i, 0, 0]);

function frameCells(w, h) {
  const out = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) out.push([x, y, 0]);
  }
  return out;
}

function block(x0, x1, y0, y1, z0, z1) {
  const out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) out.push([x, y, z]);
  return out;
}

export const PIECES = {
  beam3: { name: "Beam 3", kind: "beam", cells: line(3), color: 0xcfd6df, icon: "fa-grip-lines", label: "3" },
  beam5: { name: "Beam 5", kind: "beam", cells: line(5), color: 0xcfd6df, icon: "fa-grip-lines", label: "5" },
  beam7: { name: "Beam 7", kind: "beam", cells: line(7), color: 0xcfd6df, icon: "fa-grip-lines", label: "7" },
  beam9: { name: "Beam 9", kind: "beam", cells: line(9), color: 0xcfd6df, icon: "fa-grip-lines", label: "9" },
  beam13: { name: "Beam 13", kind: "beam", cells: line(13), color: 0xcfd6df, icon: "fa-grip-lines", label: "13" },
  lbeam: { name: "L-beam", kind: "beam", cells: [...line(5), [0, 1, 0], [0, 2, 0]], color: 0x2dd4bf, icon: "fa-l", label: "" },
  axle4: { name: "Axle 4", kind: "axle", cells: line(4), color: 0xdc2626, icon: "fa-minus", label: "4" },
  axle8: { name: "Axle 8", kind: "axle", cells: line(8), color: 0xdc2626, icon: "fa-minus", label: "8" },
  frame: { name: "Frame", kind: "beam", cells: frameCells(7, 5), color: 0xf8fafc, icon: "fa-vector-square", label: "" },
  panel: { name: "Panel", kind: "panel", cells: block(0, 0, 0, 2, 0, 4), color: 0x38bdf8, icon: "fa-square", label: "" },
  gear: { name: "Gear", kind: "gear", cells: block(0, 0, -1, 1, -1, 1), color: 0x94a3b8, icon: "fa-gear", label: "" },
  motor: {
    name: "Motor", kind: "motor", cells: [...block(0, 2, -1, 1, -1, 1), [3, 0, 0]],
    color: 0xf1f5f9, icon: "fa-bolt", label: "", shaft: [3, 0, 0], axis: [1, 0, 0]
  }
};

export const PALETTE = ["beam3", "beam5", "beam7", "beam9", "beam13", "lbeam", "axle4", "axle8", "frame", "panel", "gear", "motor"];

/* ---------- the robot (simplified SPIKE Prime driving base) ---------- */

const ROBOT = [
  { name: "robot", b: [-17, 1, -6, 0, 4, 6], color: 0xd1d5db, attach: true },
  { name: "robot", b: [-1, 4, -5, 0, 9, 5], color: 0xe5e7eb, attach: true },
  { name: "hub", b: [-14, 4, -4, -4, 11, 4], color: 0xfde047, attach: true },
  { name: "robot", b: [-11, 1, -7, -5, 5, -6], color: 0xf8fafc, attach: true },
  { name: "robot", b: [-11, 1, 6, -5, 5, 7], color: 0xf8fafc, attach: true },
  { name: "wheel", b: [-11, 0, -9, -5, 6, -7], wheel: true },
  { name: "wheel", b: [-11, 0, 7, -5, 6, 9], wheel: true },
  { name: "robot", b: [-17, 0, -1, -15, 1, 1], color: 0x6b7280 }
];

const BOUNDS = { x0: -24, x1: 30, y0: 0, y1: 38, z0: -15, z1: 15 };
const MAX_PIECES = 80;
const key = (c) => c[0] + "," + c[1] + "," + c[2];
const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const ROBOT_CELLS = new Set();
const ROBOT_ATTACH = new Set();
for (const part of ROBOT) {
  const [x0, y0, z0, x1, y1, z1] = part.b;
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
    ROBOT_CELLS.add(key([x, y, z]));
    if (part.attach) ROBOT_ATTACH.add(key([x, y, z]));
  }
}

function pieceCells(t, p, r) {
  const R = ROTS[r] || ROTS[0];
  return PIECES[t].cells.map((c) => {
    const v = apply(R, c);
    return [p[0] + v[0], p[1] + v[1], p[2] + v[2]];
  });
}

/* ---------- analysis shared by the builder, the tester and the coach page ---------- */

function analyse(pieces) {
  const cells = [];
  const owner = new Map();
  let motor = null;
  pieces.forEach((pc, i) => {
    const cs = pieceCells(pc.t, pc.p, pc.r);
    cs.forEach((c) => { cells.push({ c, i }); owner.set(key(c), i); });
    if (pc.t === "motor") {
      const R = ROTS[pc.r] || ROTS[0];
      const s = apply(R, PIECES.motor.shaft);
      const shaft = [pc.p[0] + s[0], pc.p[1] + s[1], pc.p[2] + s[2]];
      motor = { i, shaft, axis: apply(R, PIECES.motor.axis), body: new Set(cs.filter((c) => key(c) !== key(shaft)).map(key)) };
    }
  });

  const arm = new Set();
  let stuck = false;
  if (motor) {
    const queue = [];
    for (const d of NEIGHBORS) {
      const n = owner.get(key([motor.shaft[0] + d[0], motor.shaft[1] + d[1], motor.shaft[2] + d[2]]));
      if (n !== undefined && n !== motor.i && !arm.has(n)) { arm.add(n); queue.push(n); }
    }
    while (queue.length) {
      const i = queue.shift();
      for (const c of pieceCells(pieces[i].t, pieces[i].p, pieces[i].r)) {
        for (const d of NEIGHBORS) {
          const nk = key([c[0] + d[0], c[1] + d[1], c[2] + d[2]]);
          if (ROBOT_CELLS.has(nk) || motor.body.has(nk)) stuck = true;
          const n = owner.get(nk);
          if (n !== undefined && n !== motor.i && !arm.has(n)) { arm.add(n); queue.push(n); }
        }
      }
    }
  }
  let top = 11;
  let front = 0;
  cells.forEach(({ c }) => { top = Math.max(top, c[1] + 1); front = Math.max(front, c[0] + 1); });
  return { cells, motor, arm, stuck, top, front };
}

const EPS = 1e-6;
const overlap = (a0, a1, b0, b1) => a0 < b1 - EPS && b0 < a1 - EPS;
const boxOverlap = (a, b) => overlap(a[0], a[3], b[0], b[3]) && overlap(a[1], a[4], b[1], b[4]) && overlap(a[2], a[5], b[2], b[5]);
const shift = (b, dx, dz) => [b[0] + dx, b[1], b[2] + dz, b[3] + dx, b[4], b[5] + dz];
const cellBox = (c) => [c[0], c[1], c[2], c[0] + 1, c[1] + 1, c[2] + 1];
const inside = (p, b) => p[0] > b[0] && p[0] < b[3] && p[1] > b[1] && p[1] < b[4] && p[2] > b[2] && p[2] < b[5];
const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");

function rotateAround(point, center, axis, deg) {
  const v = new THREE.Vector3(point[0] - center[0], point[1] - center[1], point[2] - center[2]);
  v.applyAxisAngle(new THREE.Vector3(axis[0], axis[1], axis[2]).normalize(), (deg * Math.PI) / 180);
  return [v.x + center[0], v.y + center[1], v.z + center[2]];
}

/* Advice for moving the closest piece into the goal spot */
function moveAdvice(boxes, zone) {
  let best = null;
  for (const b of boxes) {
    const d = [0, 1, 2].map((ax) => {
      if (b[ax + 3] <= zone[ax] + EPS) return Math.ceil(zone[ax] - b[ax] - EPS);
      if (b[ax] >= zone[ax + 3] - EPS) return -Math.ceil(b[ax + 3] - zone[ax + 3] - EPS);
      return 0;
    });
    const cost = Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]);
    if (!best || cost < best.cost) best = { d, cost };
  }
  if (!best) return "";
  const [dx, dy, dz] = best.d;
  const parts = [];
  if (dy > 0) parts.push(plural(dy, "stud") + " higher");
  if (dy < 0) parts.push(plural(-dy, "stud") + " lower");
  // Fix height/sideways first: once those line up, the robot usually drives further by itself.
  if (!dy && !dz && dx > 0) parts.push(plural(dx, "stud") + " further forward (make it longer)");
  if (!dy && !dz && dx < 0) parts.push(plural(-dx, "stud") + " further back (make it shorter)");
  if (dz > 0) parts.push(plural(dz, "stud") + " to the right");
  if (dz < 0) parts.push(plural(-dz, "stud") + " to the left");
  if (!parts.length) return "";
  return "Move it " + parts.join(", ") + ".";
}

/* Run a mission test (pure: no drawing). */
export function evaluate(mission, build) {
  const sim = mission.sim;
  const lane = build.lane || 0;
  const angle = build.motorAngle || 0;
  const pieces = (build.pieces || []).filter((p) => PIECES[p.t]);
  const res = { ok: false, steps: [], startX: 0, t: 0, tx: 0, lane, angle, passed: [] };
  if (!sim) {
    res.steps.push({ ok: false, text: "This mission can't be tested here yet." });
    return res;
  }
  if (!pieces.length && !sim.allowEmpty) {
    res.steps.push({ ok: false, text: "Add some LEGO pieces to your robot first!" });
    return res;
  }

  const info = analyse(pieces);
  res.info = info;
  const startX = Math.min(0, (sim.startFront ?? 10) - info.front);
  const solids = sim.solids.filter((s) => !s.deco);
  const movers = ROBOT.map((r) => ({ box: r.b, robot: true }))
    .concat(info.cells.map(({ c, i }) => ({ box: cellBox(c), i })));

  let t = sim.driveTo != null ? sim.driveTo - (startX + info.front) : 40;
  let hit = null;
  for (const m of movers) {
    const a = shift(m.box, startX, lane);
    for (const s of solids) {
      const b = s.box;
      if (!overlap(a[1], a[4], b[1], b[4]) || !overlap(a[2], a[5], b[2], b[5])) continue;
      if (a[3] <= b[0] + EPS) {
        const lim = b[0] - a[3];
        if (lim < t) { t = lim; hit = { s, m }; }
      } else if (a[0] < b[3] - EPS) {
        t = 0; hit = { s, m };
      }
    }
  }
  t = Math.max(0, t);
  const tx = startX + t;
  Object.assign(res, { startX, t, tx, hit });

  const atStop = (c) => shift(cellBox(c), tx, lane);
  const attachBoxes = info.cells.map(({ c }) => atStop(c));
  const armCells = info.cells.filter(({ i }) => info.arm.has(i));
  const armBoxes = armCells.map(({ c }) => atStop(c));
  const robotBoxes = ROBOT.map((r) => shift(r.b, tx, lane));
  const whoHit = hit ? (hit.m.robot ? "your robot" : "your " + PIECES[pieces[hit.m.i].t].name.toLowerCase()) : "";
  const stopNote = hit ? " The robot stopped when " + whoHit + " bumped the " + hit.s.name + "." : "";
  const shaftWorld = info.motor ? [info.motor.shaft[0] + 0.5 + tx, info.motor.shaft[1] + 0.5, info.motor.shaft[2] + 0.5 + lane] : null;

  for (const check of sim.checks) {
    const zone = check.zone;
    let ok = false;
    let text = "";

    if (check.type === "push" || check.type === "hook" || check.type === "deliver") {
      const pool = check.type === "push" ? attachBoxes.concat(robotBoxes) : attachBoxes;
      const count = pool.filter((b) => boxOverlap(b, zone)).length;
      const need = check.type === "deliver" ? (check.min || 2) : 1;
      ok = count >= need;
      if (ok) text = check.done;
      else if (count > 0) text = "Almost! Make the part that reaches the goal spot a bit bigger.";
      else text = "Not touching the goal spot yet. " + moveAdvice(attachBoxes.length ? attachBoxes : robotBoxes, zone) + stopNote;
    }

    if (check.type === "lift" || check.type === "press") {
      const lifting = check.type === "lift";
      if (!info.motor) {
        const close = attachBoxes.some((b) => boxOverlap(b, zone));
        text = close
          ? "Great spot! Now it has to move " + (lifting ? "UP" : "DOWN") + " — add the motor and connect this part to its shaft."
          : "This needs a moving arm: add the motor, then stick pieces onto its shaft. " + moveAdvice(attachBoxes, zone);
      } else if (!armCells.length) {
        text = "Stick pieces onto the motor's shaft (the round end) to make an arm.";
      } else if (angle === 0) {
        text = "Your arm is ready — now set how far the motor turns.";
      } else {
        const center = shaftWorld;
        let bestMove = 0;
        let reached = false;
        for (let k = 1; k <= 12; k++) {
          const deg = (angle * k) / 12;
          for (const { c } of armCells) {
            const start = [c[0] + 0.5 + tx, c[1] + 0.5, c[2] + 0.5 + lane];
            const now = rotateAround(start, center, info.motor.axis, deg);
            if (lifting) {
              if (inside(start, zone)) bestMove = Math.max(bestMove, now[1] - start[1]);
            } else if (inside(now, zone) && now[1] < start[1] - 0.2) {
              reached = true;
            }
          }
        }
        if (lifting) {
          const inZone = armBoxes.some((b) => boxOverlap(b, zone));
          if (!inZone) {
            const other = attachBoxes.some((b) => boxOverlap(b, zone));
            text = other
              ? "A piece is in the right spot, but it isn't part of the motor's arm."
              : "The arm isn't under the " + check.target + " yet. " + moveAdvice(armBoxes, zone) + stopNote;
          } else if (bestMove >= check.need) {
            ok = true;
            text = check.done;
          } else if (bestMove <= 0) {
            text = "The arm moves the wrong way. Turn the motor the other way.";
          } else {
            text = "It lifts " + bestMove.toFixed(1) + " studs but needs " + check.need + ". Turn the motor more or make the arm longer.";
          }
        } else if (reached) {
          ok = true;
          text = check.done;
        } else {
          const moved = armCells.map(({ c }) => {
            const p = rotateAround([c[0] + 0.5 + tx, c[1] + 0.5, c[2] + 0.5 + lane], center, info.motor.axis, angle);
            return [p[0] - 0.5, p[1] - 0.5, p[2] - 0.5, p[0] + 0.5, p[1] + 0.5, p[2] + 0.5];
          });
          const goesUp = armCells.every(({ c }) => {
            const s = [c[0] + 0.5 + tx, c[1] + 0.5, c[2] + 0.5 + lane];
            return rotateAround(s, center, info.motor.axis, angle)[1] >= s[1];
          });
          text = goesUp
            ? "The arm swings up. Turn the motor the other way to press down."
            : "The arm doesn't come down on the " + check.target + ". " + moveAdvice(moved, zone);
        }
      }
      if (info.stuck && ok) {
        ok = false;
        text = "Your arm is also stuck to the robot or the motor body, so it can't really move. Connect it only to the shaft.";
      }
    }

    if (check.type === "avoid") {
      let bad = hit && hit.s.protect ? hit : null;
      if (!bad && info.motor && angle && armCells.length) {
        for (let k = 1; k <= 12 && !bad; k++) {
          for (const { c } of armCells) {
            const p = rotateAround([c[0] + 0.5 + tx, c[1] + 0.5, c[2] + 0.5 + lane], shaftWorld, info.motor.axis, (angle * k) / 12);
            const s = solids.find((x) => x.protect && inside(p, x.box));
            if (s) { bad = { s, swing: true }; break; }
          }
        }
      }
      ok = !bad;
      if (ok) text = check.done;
      else if (bad.swing) text = "Oops! The arm swings into the " + bad.s.name + ".";
      else {
        const side = (bad.s.box[2] + bad.s.box[5]) / 2 > lane ? "right" : "left";
        text = "Oops! " + (bad.m.robot ? "Your robot" : "Your " + PIECES[pieces[bad.m.i].t].name.toLowerCase()) +
          " bumped the " + bad.s.name + ". Make it narrower on the " + side + " side, or line the robot up differently.";
      }
    }

    res.steps.push({ ok, text, label: check.label });
    if (ok) res.passed.push(check);
  }

  const inches = (info.top * 8) / 25.4;
  const tall = info.top <= BOUNDS.y1;
  res.steps.push({
    ok: tall,
    label: "Height check",
    text: tall ? "Under 12 in. tall (" + inches.toFixed(1) + " in.)." : "Too tall! It's " + inches.toFixed(1) + " in. — the limit is 12 in."
  });
  res.ok = res.steps.every((s) => s.ok);
  return res;
}

export function summarise(build) {
  const pieces = (build.pieces || []).filter((p) => PIECES[p.t]);
  const info = analyse(pieces);
  return { pieces: pieces.length, motor: !!info.motor, armPieces: info.arm.size, heightIn: (info.top * 8) / 25.4 };
}

/* ---------- 3D drawing ---------- */

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const icon = (n) => h("i", { class: "fa-solid " + n, "aria-hidden": "true" });

const MAT = {};
function mat(color, extra) {
  const k = color + JSON.stringify(extra || {});
  if (!MAT[k]) MAT[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...(extra || {}) });
  return MAT[k];
}

const GEO = {
  cell: new THREE.BoxGeometry(0.98, 0.9, 0.9),
  hole: new THREE.CylinderGeometry(0.24, 0.24, 0.94, 14).rotateX(Math.PI / 2),
  axleA: new THREE.BoxGeometry(1, 0.32, 0.12),
  axleB: new THREE.BoxGeometry(1, 0.12, 0.32),
  panel: new THREE.BoxGeometry(0.35, 1, 1),
  pick: new THREE.BoxGeometry(1, 1, 1)
};

function pieceMesh(t, ghost) {
  const def = PIECES[t];
  const g = new THREE.Group();
  const m = ghost ? new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.45, depthWrite: false }) : mat(def.color);
  const dark = mat(0x1f2937);
  if (def.kind === "beam") {
    def.cells.forEach((c) => {
      const box = new THREE.Mesh(GEO.cell, m);
      box.position.set(c[0], c[1], c[2]);
      g.add(box);
      if (!ghost) {
        const hole = new THREE.Mesh(GEO.hole, dark);
        hole.position.set(c[0], c[1], c[2]);
        g.add(hole);
      }
    });
  } else if (def.kind === "axle") {
    def.cells.forEach((c) => {
      for (const geo of [GEO.axleA, GEO.axleB]) {
        const a = new THREE.Mesh(geo, m);
        a.position.set(c[0], c[1], c[2]);
        g.add(a);
      }
    });
  } else if (def.kind === "panel") {
    def.cells.forEach((c) => {
      const p = new THREE.Mesh(GEO.panel, m);
      p.position.set(c[0], c[1], c[2]);
      g.add(p);
    });
  } else if (def.kind === "gear") {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.5, 24).rotateZ(Math.PI / 2), m);
    g.add(wheel);
    if (!ghost) {
      for (let i = 0; i < 16; i++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), m);
        const a = (i / 16) * Math.PI * 2;
        tooth.position.set(0, Math.cos(a) * 1.5, Math.sin(a) * 1.5);
        tooth.rotation.x = -a;
        g.add(tooth);
      }
      for (const geo of [GEO.axleA, GEO.axleB]) {
        const hole = new THREE.Mesh(geo, dark);
        hole.scale.set(0.6, 1, 1);
        g.add(hole);
      }
    }
  } else if (def.kind === "motor") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.96, 2.96, 2.96), m);
    body.position.set(1, 0, 0);
    g.add(body);
    if (!ghost) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 28).rotateZ(Math.PI / 2), mat(0x0ea5e9));
      ring.position.set(2.5, 0, 0);
      g.add(ring);
      const lightGeo = new THREE.BoxGeometry(0.2, 0.4, 0.4);
      const led = new THREE.Mesh(lightGeo, mat(0x0ea5e9));
      led.position.set(1, 1.5, 0);
      g.add(led);
    }
    for (const geo of [GEO.axleA, GEO.axleB]) {
      const shaft = new THREE.Mesh(geo, ghost ? m : mat(0x0ea5e9));
      shaft.position.set(3, 0, 0);
      g.add(shaft);
    }
  }
  return g;
}

function setPose(group, p, r) {
  const R = ROTS[r] || ROTS[0];
  const m4 = new THREE.Matrix4().set(R[0], R[1], R[2], 0, R[3], R[4], R[5], 0, R[6], R[7], R[8], 0, 0, 0, 0, 1);
  m4.setPosition(p[0] + 0.5, p[1] + 0.5, p[2] + 0.5);
  group.matrixAutoUpdate = false;
  group.matrix.copy(m4);
  group.matrixWorldNeedsUpdate = true;
}

function boxMesh(b, material) {
  const geo = new THREE.BoxGeometry(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
  return mesh;
}

function buildRobot(group, pickables) {
  for (const part of ROBOT) {
    if (part.wheel) {
      const z = (part.b[2] + part.b[5]) / 2;
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 1.8, 32).rotateX(Math.PI / 2), mat(0x1f2937));
      tire.position.set(-8, 3, z);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 1.9, 24).rotateX(Math.PI / 2), mat(0xf8fafc));
      rim.position.set(-8, 3, z);
      group.add(tire, rim);
      continue;
    }
    const mesh = boxMesh(part.b, mat(part.color));
    mesh.castShadow = true;
    group.add(mesh);
    if (part.attach) {
      mesh.userData.attach = true;
      pickables.push(mesh);
    }
  }
  // light matrix on the hub
  const matrix = boxMesh([-12, 11, -2.5, -7, 11.1, 2.5], mat(0x111827));
  group.add(matrix);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const led = boxMesh([-11.8 + i, 11.1, -2.3 + j, -11.3 + i, 11.18, -1.8 + j], mat((i + j) % 2 ? 0xfacc15 : 0x334155));
    group.add(led);
  }
  // front frame holes
  for (let y = 4; y < 9; y++) for (let z = -5; z < 5; z += 2) {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 12).rotateZ(Math.PI / 2), mat(0x475569));
    hole.position.set(0.02, y + 0.5, z + 0.5);
    group.add(hole);
  }
}

/* ---------- the builder widget ---------- */

export function createBuilder(root, opts) {
  const mission = opts.mission;
  const readOnly = !!opts.readOnly;
  const state = {
    build: {
      pieces: (opts.build && opts.build.pieces ? opts.build.pieces : []).filter((p) => PIECES[p.t]).map((p) => ({ t: p.t, p: p.p.slice(), r: p.r || 0 })),
      motorAngle: (opts.build && opts.build.motorAngle) || 0,
      lane: (opts.build && opts.build.lane) || 0
    },
    tool: null,
    rot: 0,
    mode: "build",
    showGoal: true,
    testing: false,
    undo: []
  };

  /* --- DOM --- */
  const canvasWrap = h("div", { class: "fb-canvas" });
  const tip = h("div", { class: "fb-tip" });
  const result = h("div", { class: "fb-result", role: "status" });
  const angleLabel = h("span", { class: "fb-angle-label" });
  const laneLabel = h("span", { class: "fb-lane-label" });
  const angleInput = h("input", { type: "range", min: "-120", max: "120", step: "15", "aria-label": "How far the motor turns" });
  angleInput.value = String(state.build.motorAngle);
  const motorBox = h("div", { class: "fb-motor" }, icon("fa-bolt"), h("span", {}, " Motor turns "), angleInput, angleLabel);
  const testBtn = h("button", { class: "btn primary fb-test-btn", type: "button", onclick: () => runTest() }, icon("fa-play"), " Test it!");
  const resetBtn = h("button", { class: "fb-btn", type: "button", onclick: () => resetScene() }, icon("fa-rotate-left"), " Reset");

  const paletteBtns = {};
  const palette = h("div", { class: "fb-palette", role: "toolbar", "aria-label": "LEGO pieces" },
    PALETTE.map((t) => {
      const def = PIECES[t];
      const b = h("button", {
        type: "button", class: "fb-piece", title: def.name, "aria-pressed": "false",
        onclick: () => selectTool(state.tool === t ? null : t)
      },
        h("span", { class: "fb-swatch", style: "background:#" + def.color.toString(16).padStart(6, "0") }, icon(def.icon)),
        h("span", { class: "fb-piece-name" }, def.name)
      );
      paletteBtns[t] = b;
      return b;
    })
  );

  const modeBuild = h("button", { type: "button", class: "fb-btn on", onclick: () => setMode("build") }, icon("fa-cubes"), " Build");
  const modeDelete = h("button", { type: "button", class: "fb-btn", onclick: () => setMode("delete") }, icon("fa-eraser"), " Remove");
  const toolbar = h("div", { class: "fb-toolbar" },
    readOnly ? null : [
      modeBuild, modeDelete,
      h("span", { class: "fb-sep" }),
      h("button", { type: "button", class: "fb-btn", title: "Turn (R)", onclick: () => rotate("turn") }, icon("fa-rotate-right"), " Turn"),
      h("button", { type: "button", class: "fb-btn", title: "Tip (T)", onclick: () => rotate("tip") }, icon("fa-arrow-turn-up"), " Tip"),
      h("button", { type: "button", class: "fb-btn", title: "Roll (Y)", onclick: () => rotate("roll") }, icon("fa-arrows-spin"), " Roll"),
      h("span", { class: "fb-sep" }),
      h("button", { type: "button", class: "fb-btn", title: "Undo (Ctrl+Z)", onclick: () => undo() }, icon("fa-rotate-left")),
      h("button", { type: "button", class: "fb-btn", title: "Remove everything", onclick: () => clearAll() }, icon("fa-trash-can"))
    ],
    h("span", { class: "fb-grow" }),
    ["3D", "Side", "Top", "Front"].map((v) => h("button", { type: "button", class: "fb-btn fb-view", onclick: () => setView(v) }, v)),
    h("button", { type: "button", class: "fb-btn on", title: "Show or hide the goal spot", onclick: (e) => toggleGoal(e.currentTarget) }, icon("fa-bullseye"), " Goal")
  );

  const laneBox = h("div", { class: "fb-lane" },
    icon("fa-arrows-left-right"), h("span", {}, " Line up "),
    h("button", { type: "button", class: "fb-btn", "aria-label": "Move robot left", onclick: () => setLane(state.build.lane - 1) }, icon("fa-caret-left")),
    laneLabel,
    h("button", { type: "button", class: "fb-btn", "aria-label": "Move robot right", onclick: () => setLane(state.build.lane + 1) }, icon("fa-caret-right"))
  );

  root.replaceChildren(h("div", { class: "fb" + (readOnly ? " fb-readonly" : "") },
    readOnly ? null : palette,
    h("div", { class: "fb-stage" },
      toolbar,
      h("div", { class: "fb-canvas-wrap" }, canvasWrap, tip),
      h("div", { class: "fb-testbar" }, laneBox, motorBox, h("span", { class: "fb-grow" }), resetBtn, testBtn),
      result
    )
  ));

  /* --- three.js scene --- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (e) {
    canvasWrap.replaceChildren(h("p", { class: "fb-nogl" }, "Your browser can't show 3D graphics. Try Chrome, Edge or Safari, or turn on hardware acceleration."));
    return { dispose() {}, getBuild: () => state.build };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasWrap.append(renderer.domElement);
  renderer.domElement.setAttribute("tabindex", "0");
  renderer.domElement.setAttribute("aria-label", "3D builder. Pick a piece, then click the robot to attach it.");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8eef6);
  const camera = new THREE.PerspectiveCamera(40, 1.6, 0.5, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 12;
  controls.maxDistance = 140;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-20, 50, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 100), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(80, 80, 0xcbd5e1, 0xe2e8f0);
  grid.position.set(5, 0.01, 0);
  scene.add(grid);

  const robotGroup = new THREE.Group();
  const robotPicks = [];
  buildRobot(robotGroup, robotPicks);
  const piecesGroup = new THREE.Group();
  robotGroup.add(piecesGroup);
  const pivot = new THREE.Group(); // turns with the motor during a test
  robotGroup.add(pivot);
  scene.add(robotGroup);

  // mission model
  const missionGroup = new THREE.Group();
  const targets = {};
  const goalGroup = new THREE.Group();
  if (mission.sim) {
    for (const s of mission.sim.solids) {
      const mesh = boxMesh(s.box, mat(s.color || 0x9ca3af, s.target ? { emissive: 0x000000 } : undefined));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (s.target) {
        mesh.material = mesh.material.clone();
        mesh.userData.pulse = true;
      }
      missionGroup.add(mesh);
      if (!targets[s.name]) targets[s.name] = [];
      targets[s.name].push(mesh);
    }
    for (const c of mission.sim.checks) {
      if (!c.zone) continue;
      const zm = boxMesh(c.zone, new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.22, depthWrite: false }));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(zm.geometry), new THREE.LineBasicMaterial({ color: 0x16a34a }));
      edges.position.copy(zm.position);
      goalGroup.add(zm, edges);
    }
  }
  scene.add(missionGroup, goalGroup);

  const ghost = new THREE.Group();
  ghost.visible = false;
  scene.add(ghost);
  let ghostType = null;
  let ghostPlacement = null;
  const highlight = new THREE.Group();
  scene.add(highlight);

  let pieceMeshes = [];
  let piecePicks = [];

  function rebuildPieces() {
    piecesGroup.clear();
    pivot.clear();
    pivot.position.set(0, 0, 0);
    pivot.quaternion.identity();
    pieceMeshes = [];
    piecePicks = [];
    state.build.pieces.forEach((pc, i) => {
      const g = pieceMesh(pc.t);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      setPose(g, pc.p, pc.r);
      g.userData.index = i;
      piecesGroup.add(g);
      pieceMeshes.push(g);
      for (const c of pieceCells(pc.t, pc.p, pc.r)) {
        const pick = new THREE.Mesh(GEO.pick, new THREE.MeshBasicMaterial({ visible: false }));
        pick.position.set(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);
        pick.userData = { index: i, cell: c };
        piecesGroup.add(pick);
        piecePicks.push(pick);
      }
    });
    updateMotorUI();
  }

  function occupancy() {
    const occ = new Set(ROBOT_CELLS);
    const touch = new Set(ROBOT_ATTACH);
    state.build.pieces.forEach((pc) => pieceCells(pc.t, pc.p, pc.r).forEach((c) => { occ.add(key(c)); touch.add(key(c)); }));
    return { occ, touch };
  }

  function validCells(cells, occ, touch) {
    let touches = false;
    for (const c of cells) {
      if (c[0] < BOUNDS.x0 || c[0] >= BOUNDS.x1 || c[1] < BOUNDS.y0 || c[1] >= BOUNDS.y1 || c[2] < BOUNDS.z0 || c[2] >= BOUNDS.z1) return false;
      if (occ.has(key(c))) return false;
      if (!touches) for (const d of NEIGHBORS) if (touch.has(key([c[0] + d[0], c[1] + d[1], c[2] + d[2]]))) { touches = true; break; }
    }
    return touches;
  }

  /* --- UI state --- */

  function selectTool(t) {
    if (readOnly) return;
    if (t === "motor" && state.build.pieces.some((p) => p.t === "motor")) {
      say("You already have a motor. A standard SPIKE Prime set has 1 spare motor after the 2 driving motors.");
      t = null;
    }
    state.tool = t;
    if (t) setMode("build", true);
    Object.entries(paletteBtns).forEach(([k, b]) => {
      b.classList.toggle("on", k === t);
      b.setAttribute("aria-pressed", k === t ? "true" : "false");
    });
    if (ghostType !== t) {
      ghost.clear();
      if (t) ghost.add(pieceMesh(t, true));
      ghostType = t;
    }
    ghost.visible = false;
    say(t ? "Click on the robot (or on a piece) to stick the " + PIECES[t].name.toLowerCase() + " on." : defaultTip());
  }

  function setMode(m, keepTool) {
    state.mode = m;
    modeBuild.classList.toggle("on", m === "build");
    modeDelete.classList.toggle("on", m === "delete");
    if (m === "delete" && !keepTool) selectTool(null);
    ghost.visible = false;
    highlight.clear();
    if (m === "delete") say("Click a piece to remove it.");
  }

  function rotate(gen) {
    state.rot = rotateIndex(state.rot, gen);
    if (lastPointer) hover(lastPointer);
  }

  function say(text) {
    tip.textContent = text;
    tip.hidden = !text;
  }

  function defaultTip() {
    if (readOnly) return "";
    return state.build.pieces.length ? "Pick another piece, or press Test it! to try the mission." : "Pick a LEGO piece to start building.";
  }

  function commit(change) {
    state.undo.push(JSON.stringify(state.build.pieces));
    if (state.undo.length > 60) state.undo.shift();
    change();
    rebuildPieces();
    result.replaceChildren();
    if (opts.onChange) opts.onChange(getBuild());
  }

  function undo() {
    if (!state.undo.length) return;
    resetScene();
    state.build.pieces = JSON.parse(state.undo.pop());
    rebuildPieces();
    result.replaceChildren();
    if (opts.onChange) opts.onChange(getBuild());
  }

  function clearAll() {
    if (!state.build.pieces.length) return;
    if (!confirm("Remove all pieces?")) return;
    resetScene();
    commit(() => { state.build.pieces = []; });
  }

  function setLane(v, silent) {
    resetScene();
    state.build.lane = Math.max(-8, Math.min(8, v));
    laneLabel.textContent = state.build.lane === 0 ? "center" : Math.abs(state.build.lane) + (state.build.lane < 0 ? " left" : " right");
    robotGroup.position.z = state.build.lane;
    if (opts.onChange && !readOnly && !silent) opts.onChange(getBuild());
  }

  function updateMotorUI() {
    const hasMotor = state.build.pieces.some((p) => p.t === "motor");
    motorBox.hidden = !hasMotor;
    const a = state.build.motorAngle;
    angleLabel.textContent = a === 0 ? "0°" : (a > 0 ? "+" : "") + a + "°";
  }

  angleInput.disabled = readOnly;
  angleInput.addEventListener("input", () => {
    resetScene();
    state.build.motorAngle = Number(angleInput.value);
    updateMotorUI();
    previewArm();
    if (opts.onChange && !readOnly) opts.onChange(getBuild());
  });

  function toggleGoal(btn) {
    state.showGoal = !state.showGoal;
    goalGroup.visible = state.showGoal;
    btn.classList.toggle("on", state.showGoal);
  }

  const VIEWS = {
    "3D": [[20, 26, 44], [6, 6, 0]],
    Side: [[6, 7, 62], [6, 7, 0]],
    Top: [[6, 72, 0.01], [6, 0, 0]],
    Front: [[20, 14, 16], [-1, 6, 0]]
  };

  function setView(v) {
    const [p, t] = VIEWS[v];
    camera.position.set(p[0], p[1], p[2]);
    controls.target.set(t[0], t[1], t[2]);
    controls.update();
  }

  /* --- pointer handling --- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  let lastPointer = null;

  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(state.mode === "delete" ? piecePicks : robotPicks.concat(piecePicks), false);
    return hits[0] || null;
  }

  function hover(ev) {
    lastPointer = { clientX: ev.clientX, clientY: ev.clientY };
    if (readOnly || state.testing) return;
    const hit = pick(ev);
    if (state.mode === "delete") {
      highlight.clear();
      if (hit) {
        const pc = state.build.pieces[hit.object.userData.index];
        const g = pieceMesh(pc.t, true);
        g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(0xef4444); o.scale.multiplyScalar(1.06); } });
        setPose(g, pc.p, pc.r);
        g.matrix.premultiply(robotGroup.matrixWorld);
        highlight.add(g);
      }
      return;
    }
    if (!state.tool || !hit) { ghost.visible = false; ghostPlacement = null; return; }
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const normal = [Math.round(n.x), Math.round(n.y), Math.round(n.z)];
    let cell = hit.object.userData.cell;
    if (!cell) {
      const lp = robotGroup.worldToLocal(hit.point.clone());
      cell = [Math.floor(lp.x - normal[0] * 0.5), Math.floor(lp.y - normal[1] * 0.5), Math.floor(lp.z - normal[2] * 0.5)];
    }
    const a = [cell[0] + normal[0], cell[1] + normal[1], cell[2] + normal[2]];
    const { occ, touch } = occupancy();
    let place = null;
    for (let k = 0; k < 5 && !place; k++) {
      const p = [a[0] + normal[0] * k, a[1] + normal[1] * k, a[2] + normal[2] * k];
      if (validCells(pieceCells(state.tool, p, state.rot), occ, touch)) place = p;
    }
    const shown = place || a;
    setPose(ghost.children[0], shown, state.rot);
    ghost.position.copy(robotGroup.position);
    ghost.children[0].traverse((o) => { if (o.isMesh) o.material.color.set(place ? 0x22c55e : 0xef4444); });
    ghost.visible = true;
    ghostPlacement = place;
  }

  function click(ev) {
    if (readOnly || state.testing) return;
    hover(ev);
    if (state.mode === "delete") {
      const hit = pick(ev);
      if (!hit) return;
      const i = hit.object.userData.index;
      commit(() => { state.build.pieces.splice(i, 1); });
      highlight.clear();
      say(defaultTip());
      return;
    }
    if (!state.tool) return;
    if (!ghostPlacement) {
      say("That spot is blocked. Try Turn or Tip, or click somewhere else.");
      return;
    }
    if (state.build.pieces.length >= MAX_PIECES) {
      say("That's a lot of pieces! Remove some before adding more.");
      return;
    }
    const placed = { t: state.tool, p: ghostPlacement, r: state.rot };
    commit(() => { state.build.pieces.push(placed); });
    if (placed.t === "motor") {
      selectTool(null);
      say("Motor added! Stick pieces onto its blue shaft to make an arm that moves.");
    } else {
      hover(ev);
    }
  }

  const el = renderer.domElement;
  el.addEventListener("pointerdown", (ev) => {
    downAt = [ev.clientX, ev.clientY];
    if (state.testing && !readOnly) return;
    if (resetPending) resetScene();
  });
  el.addEventListener("pointermove", hover);
  el.addEventListener("pointerleave", () => { ghost.visible = false; highlight.clear(); });
  el.addEventListener("pointerup", (ev) => {
    if (!downAt) return;
    const moved = Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]);
    downAt = null;
    if (moved < 6) click(ev);
  });
  el.addEventListener("keydown", (ev) => {
    if (readOnly) return;
    const k = ev.key.toLowerCase();
    if (k === "r") rotate("turn");
    else if (k === "t") rotate("tip");
    else if (k === "y") rotate("roll");
    else if (k === "escape") selectTool(null);
    else if ((ev.ctrlKey || ev.metaKey) && k === "z") { ev.preventDefault(); undo(); }
    else return;
    ev.preventDefault();
  });

  /* --- arm preview + test animation --- */

  let resetPending = false;

  function armSetup() {
    const info = analyse(state.build.pieces);
    pivot.clear();
    pivot.position.set(0, 0, 0);
    pivot.quaternion.identity();
    if (!info.motor || !info.arm.size) return null;
    const s = info.motor.shaft;
    pivot.position.set(s[0] + 0.5, s[1] + 0.5, s[2] + 0.5);
    for (const i of info.arm) {
      const g = pieceMeshes[i];
      const m = g.matrix.clone();
      m.premultiply(new THREE.Matrix4().makeTranslation(-pivot.position.x, -pivot.position.y, -pivot.position.z));
      g.matrix.copy(m);
      pivot.add(g);
    }
    return new THREE.Vector3(info.motor.axis[0], info.motor.axis[1], info.motor.axis[2]).normalize();
  }

  let previewTimer = null;
  function previewArm() {
    // Briefly show where the arm ends up so kids see which way it turns.
    clearTimeout(previewTimer);
    rebuildPieces();
    const axis = armSetup();
    if (!axis) return;
    const target = (state.build.motorAngle * Math.PI) / 180;
    tween(400, (k) => pivot.quaternion.setFromAxisAngle(axis, target * k)).then(() => {
      previewTimer = setTimeout(() => {
        tween(400, (k) => pivot.quaternion.setFromAxisAngle(axis, target * (1 - k))).then(() => rebuildPieces());
      }, 900);
    });
  }

  function tween(ms, fn) {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - start) / ms);
        fn(k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
        if (k < 1 && !disposed) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let movedTargets = [];

  function resetScene() {
    if (!resetPending && !state.testing) return;
    resetPending = false;
    robotGroup.position.set(0, 0, state.build.lane);
    for (const [mesh, pos, rot] of movedTargets) { mesh.position.copy(pos); mesh.rotation.copy(rot); }
    movedTargets = [];
    missionGroup.children.filter((o) => o.userData.dropped).forEach((o) => missionGroup.remove(o));
    rebuildPieces();
  }

  async function runTest() {
    if (state.testing) return;
    resetScene();
    selectTool(null);
    setMode("build");
    const res = evaluate(mission, state.build);
    state.testing = true;
    testBtn.disabled = true;
    result.replaceChildren(h("p", { class: "fb-running" }, icon("fa-spinner fa-spin"), " Testing…"));
    setView("3D");
    controls.target.set(10, 5, state.build.lane);
    controls.update();

    const lane = state.build.lane;
    if (res.steps.length && res.info) {
      if (res.startX < 0) await tween(500, (k) => robotGroup.position.set(res.startX * k, 0, lane));
      await tween(Math.max(600, res.t * 70), (k) => robotGroup.position.set(res.startX + res.t * k, 0, lane));
      const axis = armSetup();
      const passed = new Set(res.passed.map((c) => c.type));
      const liftCheck = res.passed.find((c) => c.type === "lift");
      const pressCheck = res.passed.find((c) => c.type === "press");
      const remember = (mesh) => { if (!movedTargets.some((m) => m[0] === mesh)) movedTargets.push([mesh, mesh.position.clone(), mesh.rotation.clone()]); };
      if (axis && res.angle) {
        const target = (res.angle * Math.PI) / 180;
        const lifted = liftCheck ? targets[liftCheck.target] || [] : [];
        const pressed = pressCheck ? targets[pressCheck.target] || [] : [];
        [...lifted, ...pressed].forEach(remember);
        const base = new Map([...lifted, ...pressed].map((m) => [m, m.position.clone()]));
        await tween(900, (k) => {
          pivot.quaternion.setFromAxisAngle(axis, target * k);
          lifted.forEach((m) => { m.position.y = base.get(m).y + (liftCheck.need + 0.5) * k; });
          pressed.forEach((m) => { m.position.y = base.get(m).y - 1.5 * k; });
        });
      }
      const push = res.passed.find((c) => c.type === "push");
      if (push) {
        const meshes = targets[push.target] || [];
        meshes.forEach(remember);
        const base = new Map(meshes.map((m) => [m, m.position.clone()]));
        const d = push.move || 2;
        await tween(700, (k) => {
          robotGroup.position.x = res.tx + d * k;
          meshes.forEach((m) => { m.position.x = base.get(m).x + d * k; if (push.tip) m.rotation.z = -1.2 * k; });
        });
      }
      const hook = res.passed.find((c) => c.type === "hook");
      if (hook) {
        const meshes = targets[hook.target] || [];
        meshes.forEach(remember);
        const base = new Map(meshes.map((m) => [m, m.position.clone()]));
        await tween(900, (k) => {
          robotGroup.position.x = res.tx - 5 * k;
          meshes.forEach((m) => { m.position.x = base.get(m).x - 4 * k; m.position.y = base.get(m).y - base.get(m).y * 0.6 * k; });
        });
      }
      const deliver = res.passed.find((c) => c.type === "deliver");
      if (deliver) {
        const z = deliver.zone;
        const thing = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), mat(deliver.color || 0xec4899));
        thing.userData.dropped = true;
        thing.position.set((z[0] + z[3]) / 2, z[4] + 1, (z[2] + z[5]) / 2);
        missionGroup.add(thing);
        await tween(700, (k) => { thing.position.y = z[4] + 1 - (z[4] - z[1] + 0.1) * k; });
      }
      if (!passed.size) await wait(250);
    }

    showResult(res);
    state.testing = false;
    testBtn.disabled = false;
    resetPending = true;
    if (opts.onTest) opts.onTest(res, getBuild());
  }

  function showResult(res) {
    result.replaceChildren(
      h("div", { class: "fb-verdict " + (res.ok ? "ok" : "no") },
        icon(res.ok ? "fa-star" : "fa-wrench"),
        h("strong", {}, res.ok ? " It works!" : " Not yet — let's fix it")),
      h("ul", { class: "fb-steps" }, res.steps.map((s) =>
        h("li", { class: s.ok ? "ok" : "no" }, icon(s.ok ? "fa-circle-check" : "fa-circle-xmark"),
          h("span", {}, s.label ? h("strong", {}, s.label + ": ") : null, s.text))))
    );
  }

  /* --- render loop --- */
  let disposed = false;
  function resize() {
    const w = canvasWrap.clientWidth || 600;
    const hgt = Math.max(300, Math.min(560, Math.round(w * 0.62)));
    renderer.setSize(w, hgt);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvasWrap);
  resize();

  let pulseT = 0;
  function frame() {
    if (disposed) return;
    pulseT += 0.05;
    missionGroup.children.forEach((m) => {
      if (m.userData.pulse && m.material.emissive) m.material.emissive.setRGB(0.25 + 0.2 * Math.sin(pulseT), 0.18 + 0.15 * Math.sin(pulseT), 0);
    });
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function getBuild() {
    return { pieces: state.build.pieces.map((p) => ({ t: p.t, p: p.p.slice(), r: p.r })), motorAngle: state.build.motorAngle, lane: state.build.lane };
  }

  rebuildPieces();
  setLane(state.build.lane, true);
  setView("3D");
  say(defaultTip());
  frame();

  return {
    getBuild,
    test: runTest,
    dispose() {
      disposed = true;
      clearTimeout(previewTimer);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
    }
  };
}
