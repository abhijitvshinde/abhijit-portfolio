// Master challenges M1-M6: long precise routes, turning on the spot with the arm, timing, everything at once.
(function (g) {
  'use strict';
  const C = g.PYB.challenge, K = g.PYB.kit;

  // M1: five-pointed star (144-degree turns)
  {
    const P = [[400, 360]];
    for (const h of [0, 144, -72, 72, 216]) P.push(K.polar(P[P.length - 1][0], P[P.length - 1][1], h, 500));
    C({
      code: 'M1', name: 'Star Run', goal: 'Draw a five-pointed star through checkpoints 1-4 and end on the start dot facing east.',
      blurb: 'Five sides of 500 mm with sharp turns at every point. One wrong angle and the star falls apart.',
      start: { x: 400, y: 360, yaw: 0 },
      missions: [
        { id: 'm1k', type: 'path', pts: P.slice(1, 5), r: 15, points: 50, name: 'Star Points', desc: 'Hit the star points 1-4 in order (±15 mm).',
          hint: 'At each point the robot turns by the same amount. The outside angle of a star point is not 36°.' },
        { id: 'm1p', type: 'pose', after: 'm1k', x: 400, y: 360, r: 10, heading: 0, headingTol: 2, points: 30, name: 'Close the Star',
          desc: 'Then end on the start dot (±10 mm) facing east (±2°).' },
        { id: 'm1f', type: 'fast', time: 30, points: 20, name: 'Shooting Star', desc: 'Bonus: finish in 30 seconds or less.' }
      ]
    });
  }

  // M2: turn on the spot and touch four targets at odd bearings and heights
  {
    const cx = 750, cy = 500;
    const T = [[23, 110], [131, 180], [-67, 230], [-158, 150]];
    const targets = [], posts = [];
    T.forEach(([b, h], i) => {
      const a = K.armFor(h);
      const [x, y] = K.polar(cx, cy, b, a.reach), [px, py] = K.polar(cx, cy, b, a.reach + 22);
      targets.push({ id: 'c' + i, label: h + ' mm', x, y, z: h, face: b + 180, r: 12 });
      posts.push({ id: 'cp' + i, label: 'Post', kind: 'cyl', x: px, y: py, r: 10, z1: h + 10, color: '#6b4a2f', penalty: true });
    });
    C({
      code: 'M2', name: 'Clock Tower', goal: 'Without leaving the centre, touch targets 1-4 in order by turning and moving the arm.',
      blurb: 'Four targets surround the robot at odd angles and heights. Stay on the spot: turn, set the arm, touch, repeat.',
      start: { x: cx, y: cy, yaw: 0 },
      obstacles: posts, targets,
      missions: T.map(([b, h], i) => ({
        id: 'm2' + i, type: 'touch', target: 'c' + i, after: i ? 'm2' + (i - 1) : undefined, points: [15, 20, 20, 25][i],
        name: 'Target ' + (i + 1) + ' · ' + h + ' mm', desc: (i ? 'Then touch target ' : 'Touch target ') + (i + 1) + ' (' + h + ' mm high).',
        hint: i ? undefined : 'Each target is exactly where the arm tip can reach it from the centre. A low arm swinging round hits the posts.'
      })).concat([{ id: 'm2c', type: 'clean', minMissions: 2, points: 20, name: 'Steady Hands', desc: 'Bonus: don\'t bump any post.' }])
    });
  }

  // M3: reverse into a narrow slot at 157 degrees
  {
    const S = [700, 600];
    C({
      code: 'M3', name: 'Tight Slot', goal: 'Back into the narrow slot so the robot faces the arrow (157°).',
      blurb: 'A narrow slot at an awkward angle with only a few millimetres to spare. Line up perfectly, then reverse in.',
      start: { x: 250, y: 250, yaw: 0 },
      obstacles: K.slot('slot', S[0], S[1], 157, 200, 120, { front: 40, h: 110 }),
      missions: [
        { id: 'm3p', type: 'pose', x: S[0], y: S[1], r: 6, heading: 157, headingTol: 1, points: 60, name: 'Perfect Park',
          desc: 'End within 6 mm of the dot, facing the arrow within 1°.',
          hint: 'Pick a lining-up point in front of the slot on the arrow\'s line. Measure to it, then reverse in a straight line.' },
        { id: 'm3c', type: 'clean', minMissions: 1, points: 20, name: 'No Scratches', desc: 'Bonus: don\'t touch the slot walls.' },
        { id: 'm3f', type: 'fast', time: 12, points: 20, name: 'Quick Park', desc: 'Bonus: park in 12 seconds or less.' }
      ]
    });
  }

  // M4: arm up and down while driving, against the clock
  C({
    code: 'M4', name: 'Rush Hour', goal: 'Duck under beam 1, tap the hanging bell, duck under beam 2 and stop on the dot — fast.',
    blurb: 'Low beams and a high bell on one straight road. Stopping for every arm move is too slow: move the arm while driving.',
    start: { x: 150, y: 500, yaw: 0 },
    obstacles: [
      { id: 'b1', label: 'Beam · 125 mm', x: 450, y: 500, w: 40, d: 420, z0: 125, z1: 155, color: '#d64541', penalty: true, overhang: true },
      { id: 'b1s', label: 'Pillar', kind: 'cyl', x: 450, y: 280, r: 16, z1: 170, color: '#c9c3b6', penalty: true },
      { id: 'b1n', label: 'Pillar', kind: 'cyl', x: 450, y: 720, r: 16, z1: 170, color: '#c9c3b6', penalty: true },
      { id: 'bar', label: 'Bell bar', x: 800, y: 500, w: 30, d: 420, z0: 245, z1: 265, color: '#6b4a2f', overhang: true },
      { id: 'bars', label: 'Pillar', kind: 'cyl', x: 800, y: 280, r: 16, z1: 265, color: '#c9c3b6' },
      { id: 'barn', label: 'Pillar', kind: 'cyl', x: 800, y: 720, r: 16, z1: 265, color: '#c9c3b6' },
      { id: 'b2', label: 'Beam · 125 mm', x: 1150, y: 500, w: 40, d: 420, z0: 125, z1: 155, color: '#d64541', penalty: true, overhang: true },
      { id: 'b2s', label: 'Pillar', kind: 'cyl', x: 1150, y: 280, r: 16, z1: 170, color: '#c9c3b6', penalty: true },
      { id: 'b2n', label: 'Pillar', kind: 'cyl', x: 1150, y: 720, r: 16, z1: 170, color: '#c9c3b6', penalty: true }
    ],
    targets: [{ id: 'bell', label: 'Bell · 225 mm', x: 800, y: 500, z: 225, face: 'up', r: 25 }],
    missions: [
      { id: 'm4t', type: 'touch', target: 'bell', points: 30, name: 'Tap the Bell', desc: 'Touch the bell hanging under the bar.',
        hint: 'drive_base.straight(..., wait=False) keeps driving while your code moves the arm. drive_base.distance() tells you where you are.' },
      { id: 'm4p', type: 'pose', after: 'm4t', x: 1350, y: 500, r: 20, points: 30, name: 'Through', desc: 'Then end on the dot (±20 mm).' },
      { id: 'm4c', type: 'clean', minMissions: 1, points: 20, name: 'Clean Rush', desc: 'Bonus: don\'t touch a beam or pillar.' },
      { id: 'm4f', type: 'fast', time: 5.7, points: 20, name: 'Rush', desc: 'Bonus: finish in 5.7 seconds or less.' }
    ]
  });

  // M5: asteroid field with a planned route
  C({
    code: 'M5', name: 'Asteroid Field', goal: 'Find a safe route through the rocks and stop on the dot facing north.',
    blurb: 'Rocks everywhere. Plan a route with the measuring tools — straight lines between gaps — and finish precisely.',
    start: { x: 150, y: 150, yaw: 0 },
    obstacles: [[1100, 600], [400, 400], [650, 600], [950, 450], [300, 700], [1300, 250], [550, 850]]
      .map(([x, y], i) => ({ id: 'rock' + i, label: 'Rock', kind: 'cyl', x, y, r: 40, z1: 80, color: '#8b7b6b', penalty: true })),
    missions: [
      { id: 'm5p', type: 'pose', x: 1305.7, y: 700.3, r: 10, heading: 90, headingTol: 2, points: 50, name: 'Safe Landing',
        desc: 'End on the dot (±10 mm) facing north (±2°).',
        hint: 'Find gaps you can see through with a straight line. Measure each leg from the point where the last one ended.' },
      { id: 'm5c', type: 'clean', minMissions: 1, points: 30, name: 'No Impacts', desc: 'Bonus: don\'t touch a single rock.' },
      { id: 'm5f', type: 'fast', time: 20, points: 20, name: 'Warp Speed', desc: 'Bonus: land in 20 seconds or less.' }
    ]
  });

  // M6: everything at once
  {
    const R1 = K.polar(200, 200, 29, 500), sens = K.polar(R1[0], R1[1], 29, 60);
    const a = K.polar(sens[0], sens[1], 119, 130), b = K.polar(sens[0], sens[1], -61, 130);
    const R2 = K.polar(R1[0], R1[1], 80, 300), bell = K.armFor(205);
    const B = K.polar(R2[0], R2[1], 80, bell.reach), BP = K.polar(R2[0], R2[1], 80, bell.reach + 30);
    const S3 = [1250, 500];
    C({
      code: 'M6', name: 'Grand Precision', goal: 'Stop on the yellow line, ring the 205 mm bell, then reverse-park in the slot facing 200°.',
      blurb: 'The final exam: an odd-angle drive to a colour line, a precise arm touch, and a reverse park at an odd angle.',
      start: { x: 200, y: 200, yaw: 0 },
      starterExtra: 'color_sensor = ColorSensor(Port.D)',
      paint: [{ shape: 'line', pts: [a, b], width: 24, color: 'yellow' }],
      obstacles: [{ id: 'post', label: 'Bell post', kind: 'cyl', x: BP[0], y: BP[1], r: 18, z1: 230, color: '#6b4a2f', penalty: true }]
        .concat(K.slot('slot', S3[0], S3[1], 200, 200, 120, { front: 40, h: 100 })),
      targets: [{ id: 'bell', label: 'Bell · 205 mm', x: B[0], y: B[1], z: 205, face: 260, r: 15 }],
      missions: [
        { id: 'm6y', type: 'pose', stop: true, x: R1[0], y: R1[1], r: 10, heading: 29, headingTol: 2, points: 20, name: 'Yellow Line',
          desc: 'Stop with the colour sensor on the yellow line (robot within 10 mm of the blue dot, facing 29° ±2°).',
          hint: 'Plan the whole run on paper first: every turn angle, every distance, every arm angle.' },
        { id: 'm6b', type: 'touch', target: 'bell', after: 'm6y', points: 25, name: 'Ring the Bell', desc: 'Then touch the 205 mm bell.' },
        { id: 'm6p', type: 'pose', after: 'm6b', x: S3[0], y: S3[1], r: 5, heading: 200, headingTol: 1, points: 35, name: 'Final Park',
          desc: 'Then reverse into the slot: end within 5 mm of the dot, facing 200° (±1°).' },
        { id: 'm6f', type: 'fast', time: 30, points: 10, name: 'Under 30 s', desc: 'Bonus: finish everything in 30 seconds or less.' },
        { id: 'm6c', type: 'clean', minMissions: 2, points: 10, name: 'Clean Exam', desc: 'Bonus: no bumps at all.' }
      ]
    });
  }
})(typeof self !== 'undefined' ? self : window);
