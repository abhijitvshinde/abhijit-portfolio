// Beginner challenges B1-B5: straight lines, reversing, 90-degree turns, the arm, loops.
(function (g) {
  'use strict';
  const C = g.PYB.challenge, K = g.PYB.kit;

  C({
    code: 'B1', name: 'Straight Shot', goal: 'Drive forward and stop with the robot centre on the pink dot.',
    blurb: 'Drive in a straight line and stop exactly on the spot. The closer you stop, the more points.',
    start: { x: 200, y: 500, yaw: 0 },
    paint: [{ shape: 'rect', x0: 800, y0: 400, x1: 1000, y1: 600, color: 'green', label: 'FINISH' }],
    missions: [
      { id: 'b1z', type: 'zone', rect: [800, 400, 1000, 600], points: 20, name: 'Reach the Finish',
        desc: 'Drive the robot centre into the green Finish box.' },
      { id: 'b1p', type: 'pose', x: 900, y: 500, r: 20, points: 50, name: 'On the Spot',
        desc: 'End the program with the robot centre (between the wheels) within 20 mm of the pink dot.',
        hint: 'Use the 📏 Distance tool: click the robot, then the dot. drive_base.straight() takes millimetres.' },
      { id: 'b1b', type: 'pose', x: 900, y: 500, r: 5, points: 30, name: 'Bullseye',
        desc: 'Bonus: stop within 5 mm of the dot.' }
    ]
  });

  C({
    code: 'B2', name: 'Back It In', goal: 'Reverse into the garage behind the robot.',
    blurb: 'The garage is behind you. Reverse into it without touching the walls and stop on the spot, still facing east.',
    start: { x: 1100, y: 500, yaw: 0 },
    paint: [{ shape: 'rect', x0: 270, y0: 350, x1: 600, y1: 650, color: 'gray', label: 'GARAGE' }],
    obstacles: K.slot('garage', 420, 500, 0, 300, 160, { front: 180, h: 110, color: '#9a6a44' }),
    missions: [
      { id: 'b2z', type: 'park', rect: [270, 350, 600, 650], points: 30, name: 'In the Garage',
        desc: 'End the program with the robot parked in the garage.' },
      { id: 'b2p', type: 'pose', x: 420, y: 500, r: 20, heading: 0, headingTol: 3, points: 50, name: 'Perfect Park',
        desc: 'Stop within 20 mm of the pink dot, facing east (arrow) within 3°.',
        hint: 'A negative distance drives backwards.' },
      { id: 'b2c', type: 'clean', minMissions: 1, points: 20, name: 'No Scratches',
        desc: 'Bonus: park without touching the garage walls.' }
    ]
  });

  C({
    code: 'B3', name: 'Corner Turn', goal: 'Drive around the block and stop on the dot facing north.',
    blurb: 'A big block sits between you and the target. Drive along the bottom, make one 90° turn, and stop facing north.',
    start: { x: 250, y: 250, yaw: 0 },
    obstacles: [{ id: 'block', label: 'Block', x: 550, y: 600, w: 320, d: 320, z1: 110, color: '#7d8ea3', penalty: true }],
    missions: [
      { id: 'b3k', type: 'path', pts: [[850, 250]], r: 40, points: 20, name: 'The Corner',
        desc: 'Pass over the orange corner checkpoint.' },
      { id: 'b3p', type: 'pose', x: 850, y: 700, r: 20, heading: 90, headingTol: 3, points: 60, name: 'Facing North',
        desc: 'End on the pink dot (±20 mm) facing north (±3°).',
        hint: 'In Pybricks, turn() with a positive angle turns right (clockwise). Which way is north from here?' },
      { id: 'b3c', type: 'clean', minMissions: 1, points: 20, name: 'Clean Corner',
        desc: 'Bonus: don\'t touch the block.' }
    ]
  });

  const bell = K.armFor(200);
  C({
    code: 'B4', name: 'Ring the Bell', goal: 'Touch the bell (200 mm high) with the arm tip, then return to the start.',
    blurb: 'Use the arm. The bell hangs 200 mm above the floor on a tall post. Ring it and drive back home.',
    start: { x: 250, y: 500, yaw: 0 },
    obstacles: [{ id: 'post', label: 'Bell post', kind: 'cyl', x: 702, y: 500, r: 30, z1: 260, color: '#6b4a2f', penalty: true }],
    targets: [{ id: 'bell', label: 'Bell · 200 mm', x: 660, y: 500, z: 200, face: 180, r: 25 }],
    missions: [
      { id: 'b4t', type: 'touch', target: 'bell', points: 60, name: 'Ring It',
        desc: 'Touch the yellow bell with the arm tip.',
        hint: 'Tip height = 95 + 150 × sin(arm angle). Raise the arm before you get close, or it hits the post.' },
      { id: 'b4h', type: 'pose', after: 'b4t', x: 250, y: 500, r: 30, points: 20, name: 'Back Home',
        desc: 'After ringing the bell, end the program back on the start spot (±30 mm).' },
      { id: 'b4c', type: 'clean', minMissions: 1, points: 20, name: 'Gentle Touch',
        desc: 'Bonus: don\'t bump the post.' }
    ],
    _solution: { armAngle: bell.angle, reach: bell.reach }
  });

  C({
    code: 'B5', name: 'Square Loop', goal: 'Drive a 500 mm square through checkpoints 1-3 and end where you started.',
    blurb: 'Drive a square around the box: four sides of 500 mm and four 90° turns. A loop makes it short.',
    start: { x: 400, y: 300, yaw: 0 },
    obstacles: [{ id: 'box', label: 'Box', x: 650, y: 550, w: 220, d: 220, z1: 110, color: '#7d8ea3', penalty: true }],
    missions: [
      { id: 'b5k', type: 'path', pts: [[900, 300], [900, 800], [400, 800]], r: 35, points: 50, name: 'Around the Box',
        desc: 'Pass checkpoints 1, 2 and 3 in order.',
        hint: 'The same two commands repeat four times. Try a for loop.' },
      { id: 'b5p', type: 'pose', after: 'b5k', x: 400, y: 300, r: 20, heading: 0, headingTol: 4, points: 30, name: 'Full Circle',
        desc: 'Then end on the start spot (±20 mm) facing east again (±4°).' },
      { id: 'b5c', type: 'clean', minMissions: 1, points: 20, name: 'Clean Square',
        desc: 'Bonus: don\'t touch the box.' }
    ]
  });
})(typeof self !== 'undefined' ? self : window);
