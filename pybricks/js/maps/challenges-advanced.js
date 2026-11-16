// Advanced challenges A1-A7: precise odd turns, chained stops, arm heights, line following.
(function (g) {
  'use strict';
  const C = g.PYB.challenge, K = g.PYB.kit;

  // A1: 123 degrees and 345 mm backwards
  {
    const S = K.polar(500, 700, 123, -345);
    C({
      code: 'A1', name: 'Dock 123', goal: 'Turn to face 123°, then reverse 345 mm into the dock.',
      blurb: 'A docking bay at an awkward angle. Point the robot along the arrow and back straight in. Precision counts.',
      start: { x: 500, y: 700, yaw: 0 },
      obstacles: K.slot('dock', S[0], S[1], 123, 220, 120, { front: 60 }),
      missions: [
        { id: 'a1l', type: 'pose', x: S[0], y: S[1], r: 20, heading: 123, headingTol: 4, points: 20, name: 'Docked',
          desc: 'End within 20 mm of the dot, facing the arrow within 4°.' },
        { id: 'a1p', type: 'pose', x: S[0], y: S[1], r: 8, heading: 123, headingTol: 1.5, points: 60, name: 'Precision Dock',
          desc: 'End within 8 mm and 1.5° of the target.',
          hint: '123° counterclockwise from east. Check your sign, then measure the reverse distance with 📏.' },
        { id: 'a1f', type: 'fast', time: 5, points: 20, name: 'Quick Dock', desc: 'Bonus: finish in 5 seconds or less.' }
      ]
    });
  }

  // A2: two bells at different heights
  C({
    code: 'A2', name: 'Two Bells', goal: 'Ring the 150 mm bell, then the 235 mm bell.',
    blurb: 'Two bells on posts, at different heights and positions. Each needs its own arm angle and its own stopping point.',
    start: { x: 200, y: 400, yaw: 0 },
    obstacles: [
      { id: 'post1', label: 'Post', kind: 'cyl', x: 712, y: 400, r: 18, z1: 165, color: '#6b4a2f', penalty: true },
      { id: 'post2', label: 'Post', kind: 'cyl', x: 712, y: 650, r: 18, z1: 260, color: '#6b4a2f', penalty: true }
    ],
    targets: [
      { id: 'low', label: 'Bell · 150 mm', x: 690, y: 400, z: 150, face: 180, r: 15 },
      { id: 'high', label: 'Bell · 235 mm', x: 690, y: 650, z: 235, face: 180, r: 15 }
    ],
    missions: [
      { id: 'a2a', type: 'touch', target: 'low', points: 35, name: 'Low Bell', desc: 'Touch the 150 mm bell.',
        hint: 'For each bell work out the arm angle first, then how far ahead of the wheels the tip will be.' },
      { id: 'a2b', type: 'touch', target: 'high', after: 'a2a', points: 45, name: 'High Bell', desc: 'Then touch the 235 mm bell.' },
      { id: 'a2c', type: 'clean', minMissions: 1, points: 20, name: 'Clean Ringing', desc: 'Bonus: don\'t bump the posts.' }
    ]
  });

  // A3: three precise stops
  {
    const P1 = [600, 300], P2 = K.polar(600, 300, 71, 380), P3 = K.polar(P2[0], P2[1], -75, 420);
    C({
      code: 'A3', name: 'Stop and Go', goal: 'Stop on dot 1, then dot 2 (facing 71°), then end on dot 3 (facing -75°).',
      blurb: 'Three stops in a row. Each stop must be accurate, or the next one will be off too.',
      start: { x: 200, y: 300, yaw: 0 },
      missions: [
        { id: 'a3a', type: 'pose', stop: true, x: P1[0], y: P1[1], r: 15, points: 20, name: 'Stop 1', desc: 'Stop on the first blue dot (±15 mm).' },
        { id: 'a3b', type: 'pose', stop: true, after: 'a3a', x: P2[0], y: P2[1], r: 15, heading: 71, headingTol: 2, points: 30, name: 'Stop 2',
          desc: 'Then stop on the second blue dot (±15 mm) facing its arrow (±2°).',
          hint: 'Errors add up. Use the 📐 tool from each stopping point, not from the start.' },
        { id: 'a3c', type: 'pose', after: 'a3b', x: P3[0], y: P3[1], r: 10, heading: -75, headingTol: 2, points: 50, name: 'Final Stop',
          desc: 'End on the pink dot (±10 mm) facing its arrow (±2°).' }
      ]
    });
  }

  // A4: under a beam, then press a button from above, then home again
  C({
    code: 'A4', name: 'Under and Over', goal: 'Duck under the beam, press the button on top of the block, and come home.',
    blurb: 'The beam is 120 mm up and the button sits on top of a 120 mm block. Timing the arm is everything — both ways.',
    start: { x: 200, y: 500, yaw: 0 },
    obstacles: [
      { id: 'pil-s', label: 'Pillar', kind: 'cyl', x: 500, y: 230, r: 18, z1: 170, color: '#c9c3b6', penalty: true },
      { id: 'pil-n', label: 'Pillar', kind: 'cyl', x: 500, y: 770, r: 18, z1: 170, color: '#c9c3b6', penalty: true },
      { id: 'beam', label: 'Beam · 120 mm', x: 500, y: 500, w: 40, d: 520, z0: 120, z1: 150, color: '#d64541', penalty: true, overhang: true },
      { id: 'block', label: 'Block', x: 800, y: 500, w: 80, d: 80, z1: 120, color: '#7d8ea3', penalty: true }
    ],
    targets: [{ id: 'button', label: 'Button', x: 800, y: 500, z: 122, face: 'up', r: 15 }],
    missions: [
      { id: 'a4t', type: 'touch', target: 'button', points: 40, name: 'Press the Button', desc: 'Touch the button on top of the block with the arm tip.',
        hint: 'The tip has to come down onto the button from above. Where can the arm go up without hitting the beam or the block?' },
      { id: 'a4h', type: 'pose', after: 'a4t', x: 200, y: 500, r: 15, heading: 0, headingTol: 3, points: 40, name: 'Home Again',
        desc: 'Then end back on the start dot (±15 mm) facing east (±3°).' },
      { id: 'a4c', type: 'clean', minMissions: 1, points: 20, name: 'Clean Run', desc: 'Bonus: don\'t touch the beam, pillars or block.' }
    ]
  });

  // A5: line follower
  {
    const L = [[200, 200], [500, 200], [700, 350], [750, 600], [600, 800], [900, 860], [1300, 800]];
    C({
      code: 'A5', name: 'Line Follower', goal: 'Follow the black line to its end.',
      blurb: 'A winding black line with odd-angle bends. Follow it with the colour sensor, or plan every leg yourself.',
      start: { x: 200, y: 200, yaw: 0 },
      starterExtra: 'color_sensor = ColorSensor(Port.D)',
      paint: [{ shape: 'line', pts: L, width: 22, color: 'black' }, { shape: 'circle', x: 1300, y: 800, r: 45, color: 'green' }],
      missions: [
        { id: 'a5k', type: 'path', pts: L.slice(1, 6), r: 45, points: 50, name: 'On the Line', desc: 'Pass every bend of the line (checkpoints 1-5).',
          hint: 'color_sensor.reflection() is low on black and high on white. Steer by how far it is from the halfway value.' },
        { id: 'a5p', type: 'pose', after: 'a5k', x: 1300, y: 800, r: 25, points: 30, name: 'End of the Line', desc: 'End on the green circle (±25 mm).' },
        { id: 'a5f', type: 'fast', time: 25, points: 20, name: 'Speedy', desc: 'Bonus: finish in 25 seconds or less.' }
      ]
    });
  }

  // A6: four arm heights along a wall
  {
    const H = [[250, 120], [400, 160], [550, 200], [700, 240]];
    C({
      code: 'A6', name: 'Arm Ladder', goal: 'Touch the four targets on the wall in order: 120, 160, 200 and 240 mm high.',
      blurb: 'Four small targets climb up the wall. Every one needs a different arm angle and a different distance from the wall.',
      start: { x: 300, y: 250, yaw: 0 },
      obstacles: [{ id: 'wall', label: 'Wall', x: 1010, y: 500, w: 20, d: 800, z1: 300, color: '#7d8ea3', penalty: true }],
      targets: H.map(([y, z], i) => ({ id: 't' + i, label: z + ' mm', x: 995, y, z, face: 180, r: 12 })),
      missions: H.map(([, z], i) => ({
        id: 'a6' + i, type: 'touch', target: 't' + i, after: i ? 'a6' + (i - 1) : undefined,
        points: [15, 20, 25, 25][i], name: 'Rung ' + (i + 1) + ' · ' + z + ' mm',
        desc: i ? 'Then touch the ' + z + ' mm target.' : 'Touch the 120 mm target.',
        hint: i ? undefined : 'Make a little table: height → arm angle → how far the tip reaches. Then drive to the right distance.'
      })).concat([{ id: 'a6c', type: 'clean', minMissions: 1, points: 15, name: 'Light Touch', desc: 'Bonus: never bump the wall.' }])
    });
  }

  // A7: gates at odd angles
  {
    const G1 = [550, 200], G2 = K.polar(G1[0], G1[1], 37, 400), G3 = K.polar(G2[0], G2[1], 101, 350), E = K.polar(G3[0], G3[1], 13, 450);
    C({
      code: 'A7', name: 'Zigzag Gates', goal: 'Drive through gates 1-3 (turning 37°, 101°, 13°) and stop on the dot.',
      blurb: 'Three gates, three odd turns. Turn in the middle of each gate, and keep every leg dead straight.',
      start: { x: 150, y: 200, yaw: 0 },
      obstacles: [].concat(
        K.gate('g1', G1[0], G1[1], 18.5, 260), K.gate('g2', G2[0], G2[1], 69, 260), K.gate('g3', G3[0], G3[1], 57, 260)
      ),
      missions: [
        { id: 'a7k', type: 'path', pts: [G1, G2, G3], r: 30, points: 40, name: 'All Gates', desc: 'Pass the middle of gates 1, 2 and 3 in order.',
          hint: 'Measure each new leg from the middle of the gate you are in, not from the start. Small angle errors grow over 400 mm.' },
        { id: 'a7p', type: 'pose', after: 'a7k', x: E[0], y: E[1], r: 12, heading: 13, headingTol: 2, points: 40, name: 'Final Dot',
          desc: 'Then end on the dot (±12 mm) facing the arrow (±2°).' },
        { id: 'a7c', type: 'clean', minMissions: 1, points: 20, name: 'Clean Gates', desc: 'Bonus: don\'t touch a gate post.' }
      ]
    });
  }
})(typeof self !== 'undefined' ? self : window);
