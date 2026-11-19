// Intermediate challenges I1-I7: odd angles, reverse parking, arm under/over, sensors, curves.
(function (g) {
  'use strict';
  const C = g.PYB.challenge, K = g.PYB.kit;

  // I1: one odd-angle turn
  {
    const spot = K.polar(200, 200, 37, 700), gate = K.polar(200, 200, 37, 400);
    C({
      code: 'I1', name: 'Odd Angle 37', goal: 'Turn to face the dot (37° left of east), drive through the gate and stop on the dot.',
      blurb: 'The target is not straight ahead. Turn exactly the right amount, thread the gate, and stop on the dot facing the arrow.',
      start: { x: 200, y: 200, yaw: 0 },
      obstacles: K.gate('gate', gate[0], gate[1], 37, 200),
      missions: [
        { id: 'i1g', type: 'path', pts: [gate], r: 40, points: 20, name: 'Through the Gate', desc: 'Drive through the middle of the gate.' },
        { id: 'i1p', type: 'pose', x: spot[0], y: spot[1], r: 15, heading: 37, headingTol: 2, points: 50, name: 'Dead On',
          desc: 'End on the dot (±15 mm) facing the arrow (±2°).',
          hint: 'Use the 📐 Angle tool: click the robot, then the dot. Remember which sign turns left.' },
        { id: 'i1c', type: 'clean', minMissions: 1, points: 30, name: 'No Touch', desc: 'Bonus: don\'t touch the gate posts.' }
      ]
    });
  }

  // I2: reverse into a slot facing south
  C({
    code: 'I2', name: 'Reverse Parking', goal: 'Back into the slot at the top so the robot ends facing south.',
    blurb: 'The parking slot opens downwards. Park in it backwards, so the robot is ready to drive straight out.',
    start: { x: 300, y: 250, yaw: 0 },
    paint: [{ shape: 'rect', x0: 860, y0: 700, x1: 1140, y1: 980, color: 'gray', label: 'SLOT' }],
    obstacles: K.slot('slot', 1000, 850, -90, 280, 130, { front: 160, h: 100 }),
    missions: [
      { id: 'i2z', type: 'park', rect: [860, 700, 1140, 980], points: 30, name: 'Parked', desc: 'End the program inside the slot.' },
      { id: 'i2p', type: 'pose', x: 1000, y: 850, r: 12, heading: -90, headingTol: 2, points: 50, name: 'Nose Out',
        desc: 'End on the dot (±12 mm) facing south (±2°).',
        hint: 'Line the robot up with the slot first, then reverse straight in.' },
      { id: 'i2c', type: 'clean', minMissions: 1, points: 20, name: 'No Scratches', desc: 'Bonus: don\'t touch the slot walls.' }
    ]
  });

  // I3: arm low under a beam, then high to a bell
  {
    const bell = K.armFor(230);
    C({
      code: 'I3', name: 'Limbo Bell', goal: 'Pass under the low beam, then touch the bell 230 mm up.',
      blurb: 'The beam is only 125 mm above the floor: keep the arm low. Then lift it to ring a bell 230 mm up.',
      start: { x: 200, y: 500, yaw: 0 },
      obstacles: [
        { id: 'pil-s', label: 'Pillar', kind: 'cyl', x: 600, y: 230, r: 18, z1: 170, color: '#c9c3b6', penalty: true },
        { id: 'pil-n', label: 'Pillar', kind: 'cyl', x: 600, y: 770, r: 18, z1: 170, color: '#c9c3b6', penalty: true },
        { id: 'beam', label: 'Low beam · 125 mm', x: 600, y: 500, w: 40, d: 520, z0: 125, z1: 160, color: '#d64541', penalty: true, overhang: true },
        { id: 'post', label: 'Bell post', kind: 'cyl', x: 1190, y: 500, r: 25, z1: 300, color: '#6b4a2f', penalty: true }
      ],
      targets: [{ id: 'bell', label: 'Bell · 230 mm', x: 1155, y: 500, z: 230, face: 180, r: 20 }],
      missions: [
        { id: 'i3k', type: 'path', pts: [[800, 500]], r: 50, points: 20, name: 'Under the Beam', desc: 'Get past the low beam.' },
        { id: 'i3t', type: 'touch', target: 'bell', points: 50, name: 'High Bell', desc: 'Touch the bell with the arm tip.',
          hint: 'The arm can only rise once its tip is past the beam, and must rise before it reaches the post.' },
        { id: 'i3c', type: 'clean', minMissions: 1, points: 30, name: 'Clean Limbo', desc: 'Bonus: don\'t touch the beam, pillars or post.' }
      ],
      _solution: bell
    });
  }

  // I4: colour sensor stops
  C({
    code: 'I4', name: 'Colour Stops', goal: 'Stop with the colour sensor on blue, wait, then stop on red.',
    blurb: 'Two coloured stripes cross the road. Pause on the blue one, then park on the red one. The colour sensor sits 60 mm in front of the wheels.',
    start: { x: 200, y: 500, yaw: 0 },
    starterExtra: 'color_sensor = ColorSensor(Port.D)',
    paint: [
      { shape: 'rect', x0: 600, y0: 300, x1: 630, y1: 700, color: 'blue' },
      { shape: 'rect', x0: 900, y0: 300, x1: 930, y1: 700, color: 'red' }
    ],
    missions: [
      { id: 'i4b', type: 'pose', stop: true, x: 555, y: 500, r: 15, points: 30, name: 'Blue Pause',
        desc: 'Stop (even for a moment) with the colour sensor over the blue stripe.',
        hint: 'color_sensor.color() tells you what is under the sensor. Where is the robot centre when the sensor is on the stripe?' },
      { id: 'i4r', type: 'pose', after: 'i4b', x: 855, y: 500, r: 10, points: 50, name: 'Red Finish',
        desc: 'Then end with the colour sensor over the red stripe (robot centre within 10 mm of the dot).' },
      { id: 'i4f', type: 'fast', time: 10, points: 20, name: 'Quick', desc: 'Bonus: finish both in 10 seconds or less.' }
    ]
  });

  // I5: ultrasonic distance, then an odd turn
  C({
    code: 'I5', name: 'Wall Sense', goal: 'Stop 150 mm from the wall (ultrasonic), then turn to face north-west.',
    blurb: 'Drive towards the wall and stop when the ultrasonic sensor reads 150 mm. Then turn on the spot to face the arrow.',
    start: { x: 200, y: 500, yaw: 0 },
    starterExtra: 'eyes = UltrasonicSensor(Port.E)',
    obstacles: [{ id: 'wall', label: 'Wall', x: 1300, y: 500, w: 40, d: 600, z1: 150, color: '#7d8ea3', penalty: true }],
    missions: [
      { id: 'i5w', type: 'pose', stop: true, x: 1048, y: 500, r: 10, points: 40, name: '150 mm Stop',
        desc: 'Stop with the sensor 150 mm from the wall (robot centre within 10 mm of the blue dot).',
        hint: 'eyes.distance() gives millimetres from the sensor, which is 82 mm in front of the wheels.' },
      { id: 'i5t', type: 'pose', after: 'i5w', x: 1048, y: 500, r: 15, heading: 135, headingTol: 2, points: 40, name: 'Face North-West',
        desc: 'Then end on the same spot facing the arrow (135°, ±2°).' },
      { id: 'i5c', type: 'clean', minMissions: 1, points: 20, name: 'No Bump', desc: 'Bonus: never touch the wall.' }
    ]
  });

  // I6: drive a curve
  {
    const cx = 200, cy = 950, R = 700;
    C({
      code: 'I6', name: 'Curve Road', goal: 'Follow the curved road and stop on the dot at the top, facing north.',
      blurb: 'The road bends a quarter circle to the left. Try drive_base.curve() or drive_base.arc() instead of lots of little turns.',
      size: [1300, 1200],
      start: { x: 200, y: 250, yaw: 0 },
      obstacles: [].concat(
        K.arcWall('in', cx, cy, R - 150, -90, 0),
        K.arcWall('out', cx, cy, R + 150, -90, 0),
        [{ id: 'in-end', label: 'Wall', x: 750, y: 1050, w: 16, d: 200, z1: 70, color: '#b0754a', penalty: true },
         { id: 'out-end', label: 'Wall', x: 1050, y: 1050, w: 16, d: 200, z1: 70, color: '#b0754a', penalty: true }]
      ),
      missions: [
        { id: 'i6k', type: 'path', pts: [K.polar(cx, cy, -60, R), K.polar(cx, cy, -30, R)], r: 40, points: 30, name: 'Stay on the Road',
          desc: 'Pass both checkpoints in the middle of the road.',
          hint: 'The middle of the road is a circle with a 700 mm radius. In curve(), a negative angle bends left.' },
        { id: 'i6p', type: 'pose', x: 900, y: 1050, r: 20, heading: 90, headingTol: 3, points: 40, name: 'Top of the Road',
          desc: 'End on the dot (±20 mm) facing north (±3°).' },
        { id: 'i6c', type: 'clean', minMissions: 1, points: 30, name: 'Clean Curve', desc: 'Bonus: don\'t touch the road walls.' }
      ]
    });
  }

  // I7: slalom
  C({
    code: 'I7', name: 'Slalom', goal: 'Weave through checkpoints 1-3 around the cones and stop on the dot.',
    blurb: 'Go below the first cone, above the second and below the third, then finish on the dot facing east.',
    start: { x: 150, y: 500, yaw: 0 },
    obstacles: [450, 750, 1050].map((x, i) => ({ id: 'cone' + i, label: 'Cone', kind: 'cyl', x, y: 500, r: 25, z1: 80, color: '#f08c00', penalty: true })),
    missions: [
      { id: 'i7k', type: 'path', pts: [[450, 310], [750, 690], [1050, 310]], r: 40, points: 40, name: 'Weave',
        desc: 'Pass checkpoints 1, 2 and 3 in order.',
        hint: 'Measure each leg with the 📏 and 📐 tools. The legs all have the same length.' },
      { id: 'i7p', type: 'pose', after: 'i7k', x: 1350, y: 500, r: 20, heading: 0, headingTol: 3, points: 40, name: 'Finish Line',
        desc: 'Then end on the dot (±20 mm) facing east (±3°).' },
      { id: 'i7c', type: 'clean', minMissions: 1, points: 20, name: 'Clean Slalom', desc: 'Bonus: don\'t touch a cone.' }
    ]
  });
})(typeof self !== 'undefined' ? self : window);
