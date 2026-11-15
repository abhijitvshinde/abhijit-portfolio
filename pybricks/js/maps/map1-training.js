// Map 1 — Training Ground (easy). See README.md for the map format.
(function (g) {
  g.PYB.MAPS.push({
    id: 'training',
    name: 'Training Ground',
    level: 1,
    difficulty: 'Easy',
    blurb: 'Learn to drive, steer around a hurdle, ring a bell with the arm and duck under a low bridge.',
    size: [2360, 1140],
    start: { x: 200, y: 250, yaw: 0 },
    timeLimit: 150,
    paint: [
      { shape: 'rect', x0: 40, y0: 110, x1: 340, y1: 390, color: 'blue', label: 'START' },
      { shape: 'line', pts: [[340, 250], [600, 250]], width: 20, color: 'black' },
      { shape: 'rect', x0: 620, y0: 150, x1: 820, y1: 350, color: 'green', label: 'GARDEN' },
      { shape: 'rect', x0: 1200, y0: 150, x1: 1420, y1: 350, color: 'orange', label: 'LANDING' },
      { shape: 'line', pts: [[1430, 250], [1640, 250]], width: 20, color: 'black' },
      { shape: 'rect', x0: 380, y0: 690, x1: 520, y1: 950, color: 'gray', label: 'BRIDGE' },
      { shape: 'rect', x0: 60, y0: 700, x1: 340, y1: 1060, color: 'violet', label: 'HOME' },
      { shape: 'circle', x: 1940, y: 600, r: 70, color: 'yellow' },
      { shape: 'line', pts: [[1940, 670], [1940, 820], [700, 820]], width: 20, color: 'black' }
    ],
    obstacles: [
      { id: 'hurdle', label: 'Hurdle', x: 1030, y: 230, w: 60, d: 460, z1: 70, color: '#d9822b', penalty: true },
      { id: 'tower', label: 'Bell tower', x: 1940, y: 250, w: 120, d: 160, z1: 320, color: '#7d8ea3' },
      { id: 'rock1', label: 'Rock', kind: 'cyl', x: 1300, y: 960, r: 55, z1: 80, color: '#8b7b6b', penalty: true },
      { id: 'branch-post', label: 'Tree trunk', kind: 'cyl', x: 1580, y: 1090, r: 40, z1: 260, color: '#6b4a2f' },
      { id: 'branch', label: 'Low branch', x: 1580, y: 880, w: 50, d: 420, z0: 150, z1: 180, color: '#3f8f3f', penalty: true, overhang: true },
      { id: 'pillar-s', label: 'Bridge pillar', x: 450, y: 660, w: 40, d: 40, z1: 200, color: '#c9c3b6', penalty: true },
      { id: 'pillar-n', label: 'Bridge pillar', x: 450, y: 980, w: 40, d: 40, z1: 200, color: '#c9c3b6', penalty: true },
      { id: 'beam', label: 'Low bridge', x: 450, y: 820, w: 40, d: 360, z0: 125, z1: 165, color: '#d64541', penalty: true, overhang: true }
    ],
    targets: [
      { id: 'bell', label: 'Bell · 180 mm', x: 1868, y: 250, z: 180, face: 180, r: 25 }
    ],
    missions: [
      { id: 'm1', type: 'zone', rect: [620, 150, 820, 350], points: 15, name: 'First Drive',
        desc: 'Drive the robot into the green Garden.',
        hint: 'The Garden starts 420 mm in front of the robot\'s centre. Try drive_base.straight().' },
      { id: 'm2', type: 'zone', rect: [1200, 150, 1420, 350], points: 15, name: 'Around the Hurdle',
        desc: 'The orange hurdle is too tall to drive over. Go around it and reach the orange Landing.',
        hint: 'The hurdle is fixed to the south wall and ends at y = 460 mm. Turn, drive past its end, then turn back.' },
      { id: 'm3', type: 'touch', target: 'bell', points: 25, name: 'Ring the Bell',
        desc: 'Touch the yellow bell on the tower with the arm tip. The bell is 180 mm above the floor.',
        hint: 'Tip height = 95 + 150 × sin(arm angle). If the arm is level when you drive up, it hits the tower first.' },
      { id: 'm4', type: 'zone', rect: [380, 700, 520, 940], points: 15, name: 'Under the Bridge',
        desc: 'Drive through the low bridge (125 mm clearance). The robot fits; a raised arm does not.',
        hint: 'Watch out for the low tree branch on the way. What angle keeps the whole arm below 125 mm?' },
      { id: 'm5', type: 'park', rect: [60, 700, 340, 1060], points: 15, name: 'Home Base',
        desc: 'End the program with the robot parked in the violet Home zone.' },
      { id: 'm6', type: 'clean', points: 15, minMissions: 3, name: 'Clean Run',
        desc: 'Bonus: do at least 3 missions without bumping the hurdle, rock, branch or bridge.' }
    ],
    starter: `from pybricks.hubs import PrimeHub
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

# Mission 1: First Drive
drive_base.straight(300)

# Your code here...
`
  });
})(typeof self !== 'undefined' ? self : window);
