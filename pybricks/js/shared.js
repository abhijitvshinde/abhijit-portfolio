// Shared constants for the Pybricks Robot Lab.
// Loaded both by the page (window) and by the simulation worker (self).
(function (g) {
  'use strict';

  // Robot geometry, in millimetres. Robot frame: +x forward, +y left, z up.
  // The origin is the midpoint between the two drive wheels, on the floor.
  const ROBOT = {
    bodyBack: -70,
    bodyFront: 80,
    halfWidth: 65,
    bodyHeight: 95,
    wheelDiameter: 56,
    axleTrack: 112,
    wheelWidth: 14,
    pivotX: 55,        // arm pivot, forward of the wheel axle
    pivotZ: 95,        // arm pivot height above the floor
    armLength: 150,    // pivot to tip
    armHalfWidth: 12,
    armMin: -35,       // arm hard stops (degrees from horizontal)
    armMax: 95,
    armStart: 0,
    colorSensorX: 60,
    ultraX: 82,
    ultraZ: 55,
    maxSpeed: 1000,    // deg/s, motor shaft
    ports: {
      A: { kind: 'motor', label: 'Left drive motor' },
      B: { kind: 'motor', label: 'Right drive motor' },
      C: { kind: 'motor', label: 'Arm motor (+ raises the arm)' },
      D: { kind: 'color', label: 'Color sensor (points down)' },
      E: { kind: 'ultrasonic', label: 'Ultrasonic sensor (faces forward)' },
      F: { kind: 'force', label: 'Force sensor (on the arm tip)' }
    }
  };

  // Mat paint colours: rgb is what you see, h/s/v/refl is what the colour sensor reads.
  const MAT_COLORS = {
    white:  { rgb: '#f4f2ea', h: 0,   s: 0,  v: 100, refl: 96 },
    black:  { rgb: '#202020', h: 0,   s: 0,  v: 9,   refl: 7 },
    gray:   { rgb: '#9a9a96', h: 0,   s: 0,  v: 50,  refl: 45 },
    red:    { rgb: '#d8433b', h: 356, s: 84, v: 82,  refl: 52 },
    orange: { rgb: '#ee8a2e', h: 26,  s: 84, v: 92,  refl: 62 },
    yellow: { rgb: '#f2cd34', h: 53,  s: 80, v: 95,  refl: 82 },
    green:  { rgb: '#2f9d55', h: 132, s: 72, v: 62,  refl: 24 },
    cyan:   { rgb: '#33b6c9', h: 188, s: 72, v: 78,  refl: 48 },
    blue:   { rgb: '#2f66c7', h: 222, s: 78, v: 78,  refl: 20 },
    violet: { rgb: '#7a52c2', h: 266, s: 60, v: 74,  refl: 30 },
    magenta:{ rgb: '#c84aa4', h: 316, s: 64, v: 78,  refl: 40 }
  };

  // ---------- robot setups ----------
  // Which port each device is plugged into, and the drive geometry.
  // `mirrored`: which drive motor is mounted facing the other way (that one needs
  // Direction.COUNTERCLOCKWISE so that + drives forward). `armUp`: +1 if a positive
  // motor angle raises the arm, -1 if it lowers it. Sensor ports may be 'none'.
  const SETUP_PRESETS = {
    lab: {
      name: 'Robot Lab standard',
      desc: 'Drive motors on A and B, arm on C, sensors on D, E and F. 56 mm wheels.',
      left: 'A', right: 'B', arm: 'C', color: 'D', ultrasonic: 'E', force: 'F',
      mirrored: 'left', armUp: 1, wheel: 56, track: 112
    },
    team: {
      name: 'Team robot',
      desc: 'Right motor on A, left motor on B, attachment motor on D, 88 mm wheels.',
      left: 'B', right: 'A', arm: 'D', color: 'C', ultrasonic: 'E', force: 'F',
      mirrored: 'left', armUp: 1, wheel: 88, track: 160
    }
  };
  // The setup new visitors start with. Change this to 'team' to make that the site default.
  const DEFAULT_SETUP = 'lab';
  const DEVICE_ROLES = [
    { key: 'left', kind: 'motor', label: 'Left drive motor' },
    { key: 'right', kind: 'motor', label: 'Right drive motor' },
    { key: 'arm', kind: 'motor', label: 'Arm motor' },
    { key: 'color', kind: 'color', label: 'Color sensor (points down)' },
    { key: 'ultrasonic', kind: 'ultrasonic', label: 'Ultrasonic sensor (faces forward)' },
    { key: 'force', kind: 'force', label: 'Force sensor (on the arm tip)' }
  ];
  const BASE_HALF_WIDTH = ROBOT.halfWidth;
  const short = (r) => r.label.replace(/ \(.*/, '');

  function cleanSetup(s) {
    const d = SETUP_PRESETS.lab, o = {};
    s = s || {};
    for (const r of DEVICE_ROLES) {
      const p = s[r.key];
      o[r.key] = /^[A-F]$/.test(p) || (p === 'none' && r.kind !== 'motor') ? p : d[r.key];
    }
    o.mirrored = s.mirrored === 'right' ? 'right' : 'left';
    o.armUp = Number(s.armUp) === -1 ? -1 : 1;
    const w = Number(s.wheel), t = Number(s.track);
    o.wheel = w >= 20 && w <= 150 ? w : d.wheel;
    o.track = t >= 60 && t <= 250 ? t : d.track;
    return o;
  }
  // Returns a message when two devices share a port, '' when the setup is fine.
  function setupProblem(s) {
    const used = {};
    for (const r of DEVICE_ROLES) {
      const p = s[r.key];
      if (p === 'none') continue;
      if (used[p]) return used[p] + ' and ' + short(r).toLowerCase() + ' are both on Port ' + p + '.';
      used[p] = short(r);
    }
    return '';
  }
  // Apply a setup to ROBOT (geometry + port table). Called on the page and in the worker.
  function applySetup(s) {
    s = cleanSetup(s);
    ROBOT.setup = s;
    ROBOT.wheelDiameter = s.wheel;
    ROBOT.axleTrack = s.track;
    // the wheels count as part of the body for collisions
    ROBOT.halfWidth = Math.max(BASE_HALF_WIDTH, s.track / 2 + ROBOT.wheelWidth / 2);
    const byPort = {};
    for (const r of DEVICE_ROLES) {
      if (s[r.key] === 'none') continue;
      let label = r.label;
      if (r.key === s.mirrored) label += ' (mirrored: use Direction.COUNTERCLOCKWISE)';
      if (r.key === 'arm') label += s.armUp > 0 ? ' (+ raises the arm)' : ' (+ lowers the arm: use Direction.COUNTERCLOCKWISE)';
      byPort[s[r.key]] = { kind: r.kind, role: r.key, label };
    }
    ROBOT.ports = {};
    for (const p of 'ABCDEF') if (byPort[p]) ROBOT.ports[p] = byPort[p];
    return s;
  }
  // The motor + DriveBase lines of a program, written for a setup.
  function setupCode(s) {
    const ccw = (b) => (b ? ', Direction.COUNTERCLOCKWISE' : '');
    return [
      `left_motor = Motor(Port.${s.left}${ccw(s.mirrored === 'left')})`,
      `right_motor = Motor(Port.${s.right}${ccw(s.mirrored === 'right')})`,
      `arm = Motor(Port.${s.arm}${ccw(s.armUp < 0)})          # positive angle = arm goes up`,
      '',
      `drive_base = DriveBase(left_motor, right_motor, wheel_diameter=${s.wheel}, axle_track=${s.track})`
    ].join('\n');
  }
  // Rewrite a map's starter program (written for the standard robot) for another setup.
  function adaptStarter(code, s) {
    const lab = cleanSetup(SETUP_PRESETS.lab);
    let out = code.replace(setupCode(lab), setupCode(s));
    if (s.mirrored === 'right') out = out.replace('the left one is mirrored', 'the right one is mirrored');
    const sensors = { ColorSensor: 'color', UltrasonicSensor: 'ultrasonic', ForceSensor: 'force' };
    for (const cls in sensors) {
      const p = s[sensors[cls]];
      if (p !== 'none') out = out.split(cls + '(Port.' + lab[sensors[cls]] + ')').join(cls + '(Port.' + p + ')');
    }
    return out;
  }

  g.PYB = g.PYB || {};
  g.PYB.ROBOT = ROBOT;
  g.PYB.SETUP_PRESETS = SETUP_PRESETS;
  g.PYB.DEFAULT_SETUP = DEFAULT_SETUP;
  g.PYB.DEVICE_ROLES = DEVICE_ROLES;
  g.PYB.cleanSetup = cleanSetup;
  g.PYB.setupProblem = setupProblem;
  g.PYB.applySetup = applySetup;
  g.PYB.setupCode = setupCode;
  g.PYB.adaptStarter = adaptStarter;
  applySetup(SETUP_PRESETS.lab);
  g.PYB.MAT_COLORS = MAT_COLORS;
  g.PYB.MAPS = g.PYB.MAPS || [];
  g.PYB.BORDER = { thickness: 50, height: 75 };
})(typeof self !== 'undefined' ? self : window);
