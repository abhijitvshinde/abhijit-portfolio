// Robot physics + motor control simulation. Runs inside the Python worker.
// Units: mm, degrees, milliseconds at the API boundary; seconds internally for dt.
(function (g) {
  'use strict';
  const R = g.PYB.ROBOT;
  const DT = 0.005;              // 5 ms physics tick
  const DT_MS = DT * 1000;
  const DEG = Math.PI / 180;
  const FRAME_EVERY = 4;         // record a playback frame every 20 ms of sim time
  const STUCK_GIVE_UP = 2.0;     // seconds stalled before a blocking command gives up
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const THEN = { hold: 'hold', brake: 'brake', coast: 'coast', none: 'none' };

  // ---------- motion profiles ----------
  class Profile {
    // Trapezoidal move from p to target. keepSpeed: don't decelerate (Stop.NONE).
    constructor(p, v, target, vmax, acc, keepSpeed) {
      this.p = p; this.v = v; this.target = target;
      this.vmax = Math.abs(vmax); this.acc = Math.abs(acc) || 1;
      this.keepSpeed = !!keepSpeed; this.done = false;
      if (this.vmax < 1e-6 || Math.abs(target - p) < 1e-6) { this.p = target; this.v = keepSpeed ? v : 0; this.done = true; }
    }
    step(dt) {
      if (this.done) { if (!this.keepSpeed) this.v = 0; return; }
      const rem = this.target - this.p, dir = rem >= 0 ? 1 : -1, ar = Math.abs(rem);
      const vstop = this.keepSpeed ? this.vmax : Math.sqrt(2 * this.acc * ar);
      const vdes = dir * Math.min(this.vmax, vstop);
      this.v += clamp(vdes - this.v, -this.acc * dt, this.acc * dt);
      let np = this.p + this.v * dt;
      if ((this.target - np) * dir <= 0 || ar < 1e-3) { np = this.target; this.done = true; if (!this.keepSpeed) this.v = 0; }
      this.p = np;
    }
  }
  class SpeedRef {
    constructor(p, v, vt, acc) { this.p = p; this.v = v; this.vt = vt; this.acc = Math.abs(acc) || 1; this.done = false; }
    step(dt) { this.v += clamp(this.vt - this.v, -this.acc * dt, this.acc * dt); this.p += this.v * dt; }
  }

  // ---------- motor ----------
  class SimMotor {
    constructor(port) {
      this.port = port;
      this.angle = 0; this.speed = 0; this.desired = 0;
      this.mode = 'coast'; this.ref = null; this.then = 'hold';
      this.holdTarget = 0; this.duty = 0; this.endTime = null; this.untilStalled = false;
      this.maxSpeed = R.maxSpeed; this.acc = 2000; this.kp = 12; this.posTol = 3;
      this.stallT = 0; this.isDone = true; this.owner = null;
    }
    get stalled() { return this.stallT > 0.25; }
    release() { if (this.owner && this.owner.mode !== 'none') this.owner.abandon(this); }
    run(v) {
      this.release();
      this.mode = 'run';
      this.ref = new SpeedRef(this.angle, this.speed, clamp(v, -this.maxSpeed, this.maxSpeed), this.acc);
      this.endTime = null; this.untilStalled = false; this.isDone = false; this.stallT = 0;
    }
    runTime(v, ms, then, now) { this.run(v); this.endTime = now + ms; this.then = then; }
    runUntilStalled(v, then) { this.run(v); this.untilStalled = true; this.then = then; }
    runTarget(v, target, then) {
      this.release();
      this.mode = 'target'; this.then = then;
      this.ref = new Profile(this.angle, this.speed, target, Math.min(Math.abs(v), this.maxSpeed), this.acc, then === 'none');
      this.isDone = false; this.stallT = 0; this.endTime = null; this.untilStalled = false;
    }
    stop() { this.release(); this.mode = 'coast'; this.isDone = true; }
    brake() { this.release(); this.mode = 'brake'; this.isDone = true; }
    hold(at) { this.release(); this.mode = 'hold'; this.holdTarget = at === undefined ? this.angle : at; this.isDone = true; }
    dc(duty) { this.release(); this.mode = 'dc'; this.duty = clamp(duty, -100, 100); this.isDone = true; }
    track(t) { this.release(); this.mode = 'track'; this.holdTarget = t; this.isDone = true; }
    // Where a relative move should start from (the held target avoids error build-up).
    base() { return this.mode === 'hold' ? this.holdTarget : this.angle; }
    finish() {
      const target = this.ref instanceof Profile ? this.ref.target : this.angle;
      switch (this.then) {
        case 'hold': this.mode = 'hold'; this.holdTarget = target; break;
        case 'brake': this.mode = 'brake'; break;
        case 'none': this.mode = 'run'; this.ref = new SpeedRef(this.angle, this.speed, this.speed, this.acc); break;
        default: this.mode = 'coast';
      }
      this.isDone = true; this.endTime = null; this.untilStalled = false;
    }
    giveUp() { this.mode = 'hold'; this.holdTarget = this.angle; this.isDone = true; this.endTime = null; }
    control(dt, now) {
      if (this.owner && this.owner.mode !== 'none') return; // the drive base sets `desired`
      let d = 0;
      switch (this.mode) {
        case 'coast': d = this.speed * Math.exp(-dt / 0.10); break;
        case 'brake': d = this.speed * Math.exp(-dt / 0.015); break;
        case 'hold': d = 15 * (this.holdTarget - this.angle); break;
        case 'track': d = 25 * (this.holdTarget - this.angle); break;
        case 'dc': d = this.duty / 100 * this.maxSpeed; break;
        case 'run':
        case 'target': {
          this.ref.step(dt);
          const err = this.ref.p - this.angle;
          if (err > 30) this.ref.p = this.angle + 30; else if (err < -30) this.ref.p = this.angle - 30;
          d = this.ref.v + this.kp * (this.ref.p - this.angle);
          if (this.mode === 'run') {
            if (this.endTime !== null && now >= this.endTime) this.finish();
            else if (this.untilStalled && this.stalled) this.finish();
          } else if (this.ref.done && Math.abs(this.ref.target - this.angle) < this.posTol) {
            this.finish();
          }
          break;
        }
      }
      this.desired = clamp(d, -this.maxSpeed, this.maxSpeed);
    }
    apply(delta, dt) {
      const want = this.desired * dt;
      this.angle += delta;
      this.speed = delta / dt;
      const active = (this.owner && this.owner.mode !== 'none') || (this.mode !== 'coast' && this.mode !== 'brake');
      if (active && Math.abs(this.desired) > 25 && Math.abs(delta) < 0.25 * Math.abs(want)) this.stallT += dt;
      else this.stallT = 0;
    }
  }

  // ---------- drive base ----------
  class SimDriveBase {
    constructor(sim, lp, ls, rp, rs, wd, at) {
      this.sim = sim;
      this.L = sim.m(lp); this.R = sim.m(rp);
      this.ls = ls; this.rs = rs; this.wd = wd; this.track = at;
      this.L.owner = this; this.R.owner = this;
      this.mode = 'none'; this.then = 'hold';
      this.sOff = 0; this.hOff = 0; this.useGyro = false;
      // defaults (faster than a real hub's ~40% so the game feels snappy; settings() changes them)
      this.ss = 400; this.sa = 1000; this.tr = 250; this.ta = 1000;
      this.refS = null; this.refH = null; this.isDone = true;
      this.sOff = this.rawS(); this.hOff = this.rawH();
    }
    k() { return Math.PI * this.wd / 360; }
    wheels() { const k = this.k(); return [this.ls * this.L.angle * k, this.rs * this.R.angle * k]; }
    rawS() { const [a, b] = this.wheels(); return (a + b) / 2; }
    rawH() {
      if (this.useGyro) return this.sim.trueHeading();
      const [a, b] = this.wheels(); return (a - b) / this.track / DEG;
    }
    vS() { const k = this.k(); return (this.ls * this.L.speed + this.rs * this.R.speed) * k / 2; }
    vH() {
      if (this.useGyro) return -this.sim.yawRate / DEG;
      const k = this.k(); return (this.ls * this.L.speed - this.rs * this.R.speed) * k / this.track / DEG;
    }
    distance() { return this.rawS() - this.sOff; }
    angle() { return this.rawH() - this.hOff; }
    bases() {
      if (this.mode === 'hold' && this.refS && this.refH) return [this.refS.target, this.refH.target];
      return [this.rawS(), this.rawH()];
    }
    begin(mode, then) {
      this.mode = mode; this.then = then || 'hold'; this.isDone = mode === 'drive';
      this.L.stallT = 0; this.R.stallT = 0;
    }
    straight(d, then) {
      const [s, h] = this.bases();
      const vs = this.vS();
      this.refS = new Profile(this.rawS(), vs, s + d, this.ss, this.sa, then === 'none');
      this.refH = new Profile(h, 0, h, this.tr, this.ta);
      this.begin('move', then);
    }
    turn(a, then) {
      const [s, h] = this.bases();
      this.refS = new Profile(s, 0, s, this.ss, this.sa);
      this.refH = new Profile(this.rawH(), this.vH(), h + a, this.tr, this.ta, then === 'none');
      this.begin('move', then);
    }
    curve(sd, hd, then) {
      if (Math.abs(sd) < 1e-6) return this.turn(hd, then);
      const [s, h] = this.bases();
      this.cS0 = s; this.cH0 = h; this.cSd = sd; this.cHd = hd;
      // keep the turn rate within limits by slowing the drive speed when needed
      const vmax = Math.min(this.ss, Math.abs(this.tr * sd / hd) || this.ss);
      this.refS = new Profile(this.rawS(), this.vS(), s + sd, vmax, this.sa, then === 'none');
      this.refH = new Profile(h, 0, h + hd, 1, 1); this.refH.done = true; this.refH.p = h;
      this.begin('curve', then);
    }
    drive(v, rate) {
      this.refS = new SpeedRef(this.rawS(), this.vS(), v, this.sa);
      this.refH = new SpeedRef(this.rawH(), this.vH(), rate, this.ta);
      this.begin('drive', 'hold');
    }
    stop() { this.mode = 'none'; this.L.mode = 'coast'; this.R.mode = 'coast'; this.isDone = true; }
    brake() { this.mode = 'none'; this.L.mode = 'brake'; this.R.mode = 'brake'; this.isDone = true; }
    holdHere() {
      const s = this.rawS(), h = this.rawH();
      this.refS = new Profile(s, 0, s, 1, 1); this.refH = new Profile(h, 0, h, 1, 1);
      this.mode = 'hold'; this.isDone = true;
    }
    abandon(byMotor) {
      this.mode = 'none'; this.isDone = true;
      const other = byMotor === this.L ? this.R : this.L;
      other.mode = 'coast';
    }
    reset(d, a) { this.sOff = this.rawS() - d; this.hOff = this.rawH() - a; }
    get stalled() { return this.L.stalled || this.R.stalled; }
    control(dt) {
      if (this.mode === 'none') return;
      const s = this.rawS(), h = this.rawH();
      this.refS.step(dt);
      if (this.mode === 'curve') {
        const f = (this.refS.p - this.cS0) / this.cSd;
        this.refH.p = this.cH0 + this.cHd * f;
        this.refH.v = this.refS.v * this.cHd / this.cSd;
        this.refH.target = this.cH0 + this.cHd;
      } else {
        this.refH.step(dt);
      }
      // anti-windup: the reference can't run away from a blocked robot
      if (this.refS.p - s > 40) this.refS.p = s + 40; else if (this.refS.p - s < -40) this.refS.p = s - 40;
      if (this.mode !== 'curve') {
        if (this.refH.p - h > 25) this.refH.p = h + 25; else if (this.refH.p - h < -25) this.refH.p = h - 25;
      }
      const vs = this.refS.v + 8 * (this.refS.p - s);
      const vh = this.refH.v + 8 * (this.refH.p - h);
      const k = this.k();
      const vl = vs + (this.track / 2) * vh * DEG;
      const vr = vs - (this.track / 2) * vh * DEG;
      this.L.desired = clamp(this.ls * vl / k, -this.L.maxSpeed, this.L.maxSpeed);
      this.R.desired = clamp(this.rs * vr / k, -this.R.maxSpeed, this.R.maxSpeed);

      if ((this.mode === 'move' || this.mode === 'curve') && this.refS.done && (this.mode === 'curve' || this.refH.done)) {
        const hT = this.mode === 'curve' ? this.cH0 + this.cHd : this.refH.target;
        if (this.then === 'none' || (Math.abs(this.refS.target - s) < 4 && Math.abs(hT - h) < 2.5)) this.finish(hT);
      }
    }
    finish(hT) {
      this.isDone = true;
      if (this.then === 'hold') {
        const sT = this.refS.target;
        this.refS = new Profile(sT, 0, sT, 1, 1); this.refH = new Profile(hT, 0, hT, 1, 1);
        this.mode = 'hold';
      } else if (this.then === 'brake') this.brake();
      else if (this.then === 'none') { const v = this.refS.v; this.drive(v, 0); this.isDone = true; }
      else this.stop();
    }
  }

  // ---------- geometry helpers ----------
  function prepObstacle(o) {
    const q = Object.assign({ kind: 'box', z0: 0, rot: 0, penalty: false }, o);
    if (q.h !== undefined && q.z1 === undefined) q.z1 = q.z0 + q.h;
    q.rotRad = (q.rot || 0) * DEG;
    q.cos = Math.cos(q.rotRad); q.sin = Math.sin(q.rotRad);
    q.bound = q.kind === 'cyl' ? q.r : Math.hypot(q.w, q.d) / 2;
    return q;
  }
  function local(o, px, py) {
    const dx = px - o.x, dy = py - o.y;
    return [dx * o.cos + dy * o.sin, -dx * o.sin + dy * o.cos];
  }
  function pointIn2D(o, px, py) {
    if (o.kind === 'cyl') { const dx = px - o.x, dy = py - o.y; return dx * dx + dy * dy <= o.r * o.r; }
    const [lx, ly] = local(o, px, py);
    return Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= o.d / 2;
  }
  // robot footprint (OBB) vs obstacle footprint
  function bodyHits(pose, o) {
    const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
    const cx = pose.x + c * (R.bodyFront + R.bodyBack) / 2, cy = pose.y + s * (R.bodyFront + R.bodyBack) / 2;
    const hl = (R.bodyFront - R.bodyBack) / 2, hw = R.halfWidth;
    if (o.kind === 'cyl') {
      const dx = o.x - cx, dy = o.y - cy;
      const lx = dx * c + dy * s, ly = -dx * s + dy * c;
      const qx = clamp(lx, -hl, hl), qy = clamp(ly, -hw, hw);
      return (lx - qx) ** 2 + (ly - qy) ** 2 <= o.r * o.r;
    }
    // SAT on 4 axes
    const A = [[c, s], [-s, c]], B = [[o.cos, o.sin], [-o.sin, o.cos]];
    const ea = [hl, hw], eb = [o.w / 2, o.d / 2];
    const tx = o.x - cx, ty = o.y - cy;
    for (const ax of [A[0], A[1], B[0], B[1]]) {
      const ra = ea[0] * Math.abs(A[0][0] * ax[0] + A[0][1] * ax[1]) + ea[1] * Math.abs(A[1][0] * ax[0] + A[1][1] * ax[1]);
      const rb = eb[0] * Math.abs(B[0][0] * ax[0] + B[0][1] * ax[1]) + eb[1] * Math.abs(B[1][0] * ax[0] + B[1][1] * ax[1]);
      if (Math.abs(tx * ax[0] + ty * ax[1]) > ra + rb) return false;
    }
    return true;
  }
  const ARM_S = []; for (let s = 0; s <= R.armLength + 0.01; s += 10) ARM_S.push(s);
  const ARM_Y = [-R.armHalfWidth, 0, R.armHalfWidth];
  function armPoints(pose, armDeg, extra) {
    const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
    const ca = Math.cos(armDeg * DEG), sa = Math.sin(armDeg * DEG);
    const pts = [];
    const list = extra ? ARM_S.concat([R.armLength + extra]) : ARM_S;
    for (const d of list) {
      const lx = R.pivotX + d * ca, z = R.pivotZ + d * sa;
      for (const ly of ARM_Y) pts.push([pose.x + c * lx - s * ly, pose.y + s * lx + c * ly, z]);
    }
    return pts;
  }
  function armTip(pose, armDeg, ext) {
    const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
    const d = R.armLength + (ext || 0);
    const lx = R.pivotX + d * Math.cos(armDeg * DEG);
    return [pose.x + c * lx, pose.y + s * lx, R.pivotZ + d * Math.sin(armDeg * DEG)];
  }

  // ---------- the simulator ----------
  class PybSim {
    constructor(map, opts) {
      this.map = map;
      this.opts = opts || {};
      this.t = 0;                 // ms
      this.limit = (map.timeLimit || 150) * 1000;
      this.qAcc = 0; this.tickN = 0; this.timeUp = false; this.finishing = false;
      const st = map.start;
      this.pose = { x: st.x, y: st.y, yaw: (st.yaw || 0) * DEG };
      this.yaw0 = this.pose.yaw; this.yawRate = 0; this.headingOff = 0;
      // internal motors: A = left wheel, B = right wheel, C = arm. The robot setup says
      // which user port each one is plugged into and which way it is mounted.
      this.motors = { A: new SimMotor('A'), B: new SimMotor('B'), C: new SimMotor('C') };
      const su = R.setup || g.PYB.cleanSetup({});
      this.pm = {}; this.pm[su.left] = 'A'; this.pm[su.right] = 'B'; this.pm[su.arm] = 'C';
      this.sL = su.mirrored === 'left' ? -1 : 1;   // left wheel: + shaft angle drives forward?
      this.sR = su.mirrored === 'right' ? -1 : 1;
      this.armSign = su.armUp < 0 ? -1 : 1;
      this.db = null;
      this.frames = []; this.events = [];
      this.contacts = new Set(); this.bumps = {}; this.bumpTotal = 0;
      this.score = 0;
      this.missions = (map.missions || []).map(m => Object.assign({ done: false }, m));
      this.targets = {}; for (const tg of (map.targets || [])) this.targets[tg.id] = tg;
      const W = map.size[0], H = map.size[1], T = g.PYB.BORDER.thickness, BH = g.PYB.BORDER.height;
      const border = [
        { id: 'border-s', x: W / 2, y: -T / 2, w: W + 2 * T, d: T, z1: BH },
        { id: 'border-n', x: W / 2, y: H + T / 2, w: W + 2 * T, d: T, z1: BH },
        { id: 'border-w', x: -T / 2, y: H / 2, w: T, d: H, z1: BH },
        { id: 'border-e', x: W + T / 2, y: H / 2, w: T, d: H, z1: BH }
      ];
      this.obstacles = (map.obstacles || []).concat(border).map(prepObstacle);
      this.obsById = {}; for (const o of this.obstacles) this.obsById[o.id] = o;
      this.lastFlush = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      this.pushFrame();
      const hit = this.robotHit(this.pose, this.armDeg());
      if (hit) this.emitPrint('⚠ Start position overlaps obstacle "' + hit + '" (map bug)\n', 'warn');
    }

    // ----- basic state -----
    armDeg() { return R.armStart + this.armSign * this.motors.C.angle; }
    trueHeading() { return -(this.pose.yaw - this.yaw0) / DEG; }
    time() { return this.t; }
    now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

    // ----- events / frames -----
    emit(type, data) {
      const ev = { t: this.t, type };
      if (typeof data === 'string') { try { Object.assign(ev, JSON.parse(data)); } catch (e) { ev.data = data; } }
      else if (data) Object.assign(ev, data);
      this.events.push(ev);
      this.maybeFlush();
    }
    emitPrint(text, level) { this.events.push({ t: this.t, type: 'print', text: String(text), level: level || 'out' }); this.maybeFlush(true); }
    pushFrame() {
      const m = this.motors;
      this.frames.push([this.t, this.pose.x, this.pose.y, this.pose.yaw, this.armDeg(), -this.sL * m.A.angle, this.sR * m.B.angle]);
    }
    maybeFlush(force) {
      const n = this.now();
      if (this.frames.length >= 60 || n - this.lastFlush > 150 || (force && n - this.lastFlush > 40)) this.flush();
    }
    flush() {
      if (!this.frames.length && !this.events.length) return;
      if (this.opts.post) this.opts.post({ type: 'chunk', frames: this.frames, events: this.events });
      this.frames = []; this.events = [];
      this.lastFlush = this.now();
    }

    // ----- collision -----
    robotHit(pose, arm) {
      const reach = R.pivotX + R.armLength + 20;
      for (const o of this.obstacles) {
        const dx = o.x - pose.x, dy = o.y - pose.y;
        if (dx * dx + dy * dy > (o.bound + reach) ** 2) continue;
        if (o.z0 < R.bodyHeight && o.z1 > 0 && bodyHits(pose, o)) return o.id;
      }
      return this.armHit(pose, arm);
    }
    armHit(pose, arm) {
      const reach = R.pivotX + R.armLength + 20;
      let pts = null;
      for (const o of this.obstacles) {
        const dx = o.x - pose.x, dy = o.y - pose.y;
        if (dx * dx + dy * dy > (o.bound + reach) ** 2) continue;
        if (!pts) pts = armPoints(pose, arm);
        for (const p of pts) if (p[2] >= o.z0 && p[2] <= o.z1 && pointIn2D(o, p[0], p[1])) return o.id;
      }
      return null;
    }
    contact(id) {
      if (!id) return;
      this.tickContacts.add(id);
      if (!this.contacts.has(id)) {
        const o = this.obsById[id];
        this.bumps[id] = (this.bumps[id] || 0) + 1;
        if (o && o.penalty) this.bumpTotal++;
        this.events.push({ t: this.t, type: 'bump', id, penalty: !!(o && o.penalty), label: (o && o.label) || id });
      }
    }

    // ----- one physics tick -----
    tick() {
      if (this.t >= this.limit && !this.finishing) { this.timeUp = true; throw new Error('SIM_TIMEUP'); }
      const now = this.t;
      const M = this.motors;
      if (this.db) this.db.control(DT);
      for (const p in M) M[p].control(DT, now);
      this.tickContacts = new Set();

      // drive wheels
      const kP = Math.PI * R.wheelDiameter / 360;
      const dA = M.A.desired * DT, dB = M.B.desired * DT;
      const arm = this.armDeg();
      let frac = 0;
      if (Math.abs(dA) > 1e-9 || Math.abs(dB) > 1e-9) {
        for (const f of [1, 0.5, 0.2]) {
          const np = this.movedPose(this.sL * dA * f * kP, this.sR * dB * f * kP);
          const hit = this.robotHit(np, arm);
          if (!hit) { frac = f; this.pose = np; break; }
          this.contact(hit);
        }
      }
      const prevYaw = this.pose.yaw;
      // arm
      let dC = this.armSign * M.C.desired * DT;
      let armNew = arm + dC;
      if (armNew > R.armMax) { armNew = R.armMax; }
      if (armNew < R.armMin) { armNew = R.armMin; }
      let realC = armNew - arm;
      if (Math.abs(realC) > 1e-9) {
        const hit = this.armHit(this.pose, armNew);
        if (hit) {
          this.contact(hit);
          const half = arm + realC / 3;
          realC = this.armHit(this.pose, half) ? 0 : realC / 3;
        }
      }
      M.A.apply(dA * frac, DT); M.B.apply(dB * frac, DT); M.C.apply(this.armSign * realC, DT);
      this.contacts = this.tickContacts;
      this.yawRate = (this.pose.yaw - this.lastYaw || 0) / DT; this.lastYaw = this.pose.yaw;
      void prevYaw;

      this.t += DT_MS; this.tickN++;
      this.checkMissions(false);
      if (this.tickN % FRAME_EVERY === 0) this.pushFrame();
      this.maybeFlush();
      return true;
    }
    movedPose(dL, dR) {
      const ds = (dL + dR) / 2, dyaw = (dR - dL) / R.axleTrack;
      const p = this.pose, a = p.yaw + dyaw / 2;
      return { x: p.x + ds * Math.cos(a), y: p.y + ds * Math.sin(a), yaw: p.yaw + dyaw };
    }
    // every sensor/motor query costs a little sim time so polling loops progress
    q() { this.qAcc += 0.5; if (this.qAcc >= DT_MS) { this.qAcc = 0; this.tick(); } }
    waitTime(ms) { const end = this.t + Math.max(0, ms); while (this.t < end - 1e-9) this.tick(); return 0; }

    // ----- missions -----
    inRect(r, x, y) { return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]; }
    stopped() { return Math.abs(this.motors.A.speed) + Math.abs(this.motors.B.speed) < 60; }
    // how far the robot is from a pose mission's spot: [mm, heading error in degrees or null]
    poseError(m) {
      const d = Math.hypot(this.pose.x - m.x, this.pose.y - m.y);
      if (m.heading === undefined || m.heading === null) return [d, null];
      let a = (this.pose.yaw / DEG - m.heading) % 360;
      if (a > 180) a -= 360; if (a < -180) a += 360;
      return [d, a];
    }
    poseOk(m) {
      const [d, a] = this.poseError(m);
      return d <= (m.r || 20) && (a === null || Math.abs(a) <= (m.headingTol === undefined ? 3 : m.headingTol));
    }
    checkMissions(end) {
      for (const m of this.missions) {
        if (m.done) continue;
        if (m.after && !this.missions.some(x => x.id === m.after && x.done)) continue;
        let ok = false;
        if (m.type === 'zone') ok = this.inRect(m.rect, this.pose.x, this.pose.y);
        else if (m.type === 'pose') {
          // end: checked when the program ends; stop: true = robot must pause on the spot during the run
          if (end || m.stop) ok = this.poseOk(m) && (end || this.stopped());
        } else if (m.type === 'path') {
          m.k = m.k || 0;
          const p = m.pts[m.k];
          if (p && Math.hypot(this.pose.x - p[0], this.pose.y - p[1]) <= (m.r || 40)) {
            m.k++;
            this.events.push({ t: this.t, type: 'checkpoint', id: m.id, k: m.k });
          }
          ok = m.k >= m.pts.length;
        } else if (end && m.type === 'fast') {
          const others = this.missions.filter(x => x !== m && x.type !== 'clean' && x.type !== 'fast');
          ok = others.every(x => x.done) && this.endT <= m.time * 1000;
        }
        else if (m.type === 'touch') {
          const tg = this.targets[m.target];
          if (tg) {
            const tip = armTip(this.pose, this.armDeg(), 0), tip2 = armTip(this.pose, this.armDeg(), -8);
            const r = tg.r || 25;
            ok = Math.hypot(tip[0] - tg.x, tip[1] - tg.y, tip[2] - tg.z) <= r || Math.hypot(tip2[0] - tg.x, tip2[1] - tg.y, tip2[2] - tg.z) <= r;
          }
        } else if (end && m.type === 'park') {
          const v = Math.abs(this.motors.A.speed) + Math.abs(this.motors.B.speed);
          ok = this.inRect(m.rect, this.pose.x, this.pose.y) && v < 60;
        } else if (end && m.type === 'clean') {
          const others = this.missions.filter(x => x !== m && x.type !== 'clean' && x.done).length;
          ok = this.bumpTotal === 0 && others >= (m.minMissions || 3);
        }
        if (ok) {
          m.done = true; this.score += m.points || 0;
          this.events.push({ t: this.t, type: 'mission', id: m.id, points: m.points || 0, score: this.score });
        }
      }
    }
    finish(reason) {
      this.finishing = true;
      this.endT = this.t;
      // program ended: Pybricks stops all motors
      this.db && (this.db.mode = 'none');
      for (const p in this.motors) { this.motors[p].mode = 'coast'; this.motors[p].owner = null; }
      for (let i = 0; i < 60; i++) this.tick();
      this.checkMissions(true);
      this.precisionReport();
      this.pushFrame();
      this.events.push({ t: this.t, type: 'end', reason: reason || 'done', score: this.score, bumps: this.bumpTotal });
      this.flush();
      return { score: this.score, t: this.t };
    }

    // tell the player how close they got on precision missions
    precisionReport() {
      for (const m of this.missions) {
        if (m.type === 'pose' && !m.stop) {
          const [d, a] = this.poseError(m);
          let txt = (m.done ? '🎯 ' : '📍 ') + m.name + ': ' + d.toFixed(1) + ' mm from the spot';
          if (a !== null) txt += ', ' + Math.abs(a).toFixed(1) + '° ' + (Math.abs(a) < 0.05 ? 'off' : a > 0 ? 'too far left' : 'too far right');
          txt += ' (allowed: ' + (m.r || 20) + ' mm' + (a !== null ? ', ' + (m.headingTol === undefined ? 3 : m.headingTol) + '°' : '') + ')\n';
          this.emitPrint(txt, m.done ? 'out' : 'warn');
        } else if (m.type === 'path' && !m.done) {
          this.emitPrint('📍 ' + m.name + ': reached ' + (m.k || 0) + ' of ' + m.pts.length + ' checkpoints\n', 'warn');
        } else if (m.type === 'fast' && !m.done) {
          const others = this.missions.filter(x => x !== m && x.type !== 'clean' && x.type !== 'fast');
          if (others.every(x => x.done)) this.emitPrint('⏱ ' + m.name + ': finished in ' + (this.endT / 1000).toFixed(1) + ' s, needed ' + m.time + ' s or less\n', 'warn');
        }
      }
    }

    // ----- motor API (raw shaft degrees, positive = clockwise) -----
    m(p) { const mo = this.motors[this.pm[p]]; if (!mo) throw new Error('No motor on port ' + p); return mo; }
    portInfo() { return JSON.stringify(R.ports); }
    mAttach(p) { const mo = this.m(p); if (mo.owner && mo.owner.mode !== 'none') mo.owner.abandon(mo); mo.owner = null; if (this.db && (this.db.L === mo || this.db.R === mo)) this.db = null; mo.mode = 'coast'; }
    mRun(p, v) { this.m(p).run(v); }
    mRunTime(p, v, ms, then) { this.m(p).runTime(v, ms, THEN[then] || 'hold', this.t); }
    mRunTarget(p, v, target, then) { this.m(p).runTarget(v, target, THEN[then] || 'hold'); }
    mRunUntilStalled(p, v, then) { this.m(p).runUntilStalled(v, THEN[then] || 'coast'); }
    mStop(p) { this.m(p).stop(); }
    mBrake(p) { this.m(p).brake(); }
    mHold(p) { this.m(p).hold(); }
    mDc(p, duty) { this.m(p).dc(duty); }
    mTrack(p, t) { this.m(p).track(t); }
    mAngle(p) { this.q(); return this.m(p).angle; }
    mSpeed(p) { this.q(); return this.m(p).speed; }
    mDone(p) { this.q(); return this.m(p).isDone; }
    mStalled(p) { this.q(); return this.m(p).stalled; }
    mLoad(p) { this.q(); const mo = this.m(p); return mo.stalled ? 180 : Math.min(150, Math.abs(mo.desired) * 0.05); }
    mBase(p) { return this.m(p).base(); }
    mLimits(p, speed, acc) {
      const mo = this.m(p);
      if (speed > 0) mo.maxSpeed = Math.min(speed, R.maxSpeed);
      if (acc > 0) mo.acc = acc;
      return [mo.maxSpeed, mo.acc];
    }
    // mode 0: give up after STUCK_GIVE_UP s stalled; mode 1: run until stalled (no give up)
    waitMotor(p, mode) {
      const mo = this.m(p);
      while (!mo.isDone) {
        this.tick();
        if (mode !== 1 && mo.stallT > STUCK_GIVE_UP) {
          mo.giveUp();
          this.stuckMsg('Motor on Port.' + p);
          return 1;
        }
      }
      return 0;
    }
    stuckMsg(who) {
      const ids = Array.from(this.contacts);
      const o = ids.length ? this.obsById[ids[0]] : null;
      const what = o ? ' against "' + (o.label || o.id) + '"' : (this.armDeg() >= R.armMax - 0.5 || this.armDeg() <= R.armMin + 0.5 ? ' at the arm\'s end stop' : '');
      this.emitPrint('⚠ ' + who + ' is stuck' + what + ' — command cancelled after ' + STUCK_GIVE_UP + ' s\n', 'warn');
      this.events.push({ t: this.t, type: 'stuck', id: o ? o.id : null });
    }

    // ----- drive base API -----
    dbNew(lp, ls, rp, rs, wd, at) {
      if (lp === rp) throw new Error('Left and right motors must be on different ports');
      this.db = new SimDriveBase(this, lp, ls, rp, rs, wd, at);
    }
    D() { if (!this.db) throw new Error('DriveBase not initialised'); return this.db; }
    dbStraight(d, then) { this.D().straight(d, THEN[then] || 'hold'); }
    dbTurn(a, then) { this.D().turn(a, THEN[then] || 'hold'); }
    dbCurve(sd, hd, then) { this.D().curve(sd, hd, THEN[then] || 'hold'); }
    dbDrive(v, r) { this.D().drive(v, r); }
    dbStop() { this.D().stop(); }
    dbBrake() { this.D().brake(); }
    dbDistance() { this.q(); return this.D().distance(); }
    dbAngle() { this.q(); return this.D().angle(); }
    dbSpeed() { this.q(); return this.D().vS(); }
    dbRate() { this.q(); return this.D().vH(); }
    dbReset(d, a) { this.D().reset(d, a); }
    dbSettings(ss, sa, tr, ta) {
      const d = this.D();
      if (ss > 0) d.ss = ss; if (sa > 0) d.sa = sa; if (tr > 0) d.tr = tr; if (ta > 0) d.ta = ta;
      return [d.ss, d.sa, d.tr, d.ta];
    }
    dbDone() { this.q(); return this.D().isDone; }
    dbStalled() { this.q(); return this.D().stalled; }
    dbUseGyro(b) { const d = this.D(); const a = d.angle(); d.useGyro = !!b; d.hOff = d.rawH() - a; if (d.mode === 'hold') d.holdHere(); }
    waitDB() {
      const d = this.D();
      while (!d.isDone) {
        this.tick();
        if (d.L.stallT > STUCK_GIVE_UP || d.R.stallT > STUCK_GIVE_UP) {
          d.holdHere(); d.L.stallT = 0; d.R.stallT = 0;
          this.stuckMsg('Drive base');
          return 1;
        }
      }
      return 0;
    }

    // ----- hub / sensors -----
    heading() { this.q(); return this.trueHeading() - this.headingOff; }
    resetHeading(a) { this.headingOff = this.trueHeading() - a; }
    yawRateDeg() { this.q(); return -this.yawRate / DEG; }
    color() {
      this.q();
      const x = this.pose.x + Math.cos(this.pose.yaw) * R.colorSensorX;
      const y = this.pose.y + Math.sin(this.pose.yaw) * R.colorSensorX;
      const name = this.paintAt(x, y);
      const c = g.PYB.MAT_COLORS[name] || g.PYB.MAT_COLORS.white;
      return [c.h, c.s, c.v, c.refl, 20, name];
    }
    paintAt(x, y) {
      const W = this.map.size[0], H = this.map.size[1];
      if (x < 0 || y < 0 || x > W || y > H) return 'black';
      const P = this.map.paint || [];
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        if (p.shape === 'rect' && x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1) return p.color;
        if (p.shape === 'circle' && Math.hypot(x - p.x, y - p.y) <= p.r) return p.color;
        if (p.shape === 'line') {
          const pts = p.pts, hw = (p.width || 20) / 2;
          for (let j = 0; j + 1 < pts.length; j++) {
            const [ax, ay] = pts[j], [bx, by] = pts[j + 1];
            const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
            const tt = clamp(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1);
            if (Math.hypot(x - ax - tt * vx, y - ay - tt * vy) <= hw) return p.color;
          }
        }
      }
      return 'white';
    }
    ultra() {
      this.q();
      const c = Math.cos(this.pose.yaw), s = Math.sin(this.pose.yaw);
      const ox = this.pose.x + c * R.ultraX, oy = this.pose.y + s * R.ultraX, z = R.ultraZ;
      let best = 2000;
      for (const o of this.obstacles) {
        if (z < o.z0 || z > o.z1) continue;
        let d = null;
        if (o.kind === 'cyl') {
          const fx = ox - o.x, fy = oy - o.y;
          const b = fx * c + fy * s, cc = fx * fx + fy * fy - o.r * o.r, disc = b * b - cc;
          if (disc >= 0) { const t1 = -b - Math.sqrt(disc); if (t1 >= 0) d = t1; else if (cc <= 0) d = 0; }
        } else {
          const [lx, ly] = local(o, ox, oy);
          const ldx = c * o.cos + s * o.sin, ldy = -c * o.sin + s * o.cos;
          let tmin = -Infinity, tmax = Infinity;
          const sl = [[lx, ldx, o.w / 2], [ly, ldy, o.d / 2]];
          let miss = false;
          for (const [p0, dd, e] of sl) {
            if (Math.abs(dd) < 1e-12) { if (Math.abs(p0) > e) miss = true; }
            else { let t1 = (-e - p0) / dd, t2 = (e - p0) / dd; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); }
          }
          if (!miss && tmax >= Math.max(0, tmin)) d = Math.max(0, tmin);
        }
        if (d !== null && d < best) best = d;
      }
      return Math.round(best);
    }
    force() {
      this.q();
      const arm = this.armDeg();
      const tip = armTip(this.pose, arm, 4);
      let touching = false;
      for (const o of this.obstacles) {
        if (tip[2] >= o.z0 && tip[2] <= o.z1 && pointIn2D(o, tip[0], tip[1])) { touching = true; break; }
      }
      if (!touching && tip[2] <= 0.5) touching = true;
      if (!touching) for (const id in this.targets) {
        const tg = this.targets[id];
        if (Math.hypot(tip[0] - tg.x, tip[1] - tg.y, tip[2] - tg.z) <= 12) { touching = true; break; }
      }
      const pushing = touching && this.motors.C.stalled;
      const f = touching ? (pushing ? 6.5 : 1.5) : 0;
      return [f, touching ? (pushing ? 6 : 2) : 0, touching];
    }
  }

  g.PybSim = PybSim;
  g.PybSimGeom = { armPoints, armTip, prepObstacle };
})(typeof self !== 'undefined' ? self : window);
