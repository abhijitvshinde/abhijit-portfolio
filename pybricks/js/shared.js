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

  g.PYB = g.PYB || {};
  g.PYB.ROBOT = ROBOT;
  g.PYB.MAT_COLORS = MAT_COLORS;
  g.PYB.MAPS = g.PYB.MAPS || [];
  g.PYB.BORDER = { thickness: 50, height: 75 };
})(typeof self !== 'undefined' ? self : window);
