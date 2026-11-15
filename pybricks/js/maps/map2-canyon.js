// Map 2 — Canyon Run (harder). See README.md for the map format.
(function (g) {
  g.PYB.MAPS.push({
    id: 'canyon',
    name: 'Canyon Run',
    level: 2,
    difficulty: 'Medium',
    blurb: 'Reach over a fence, squeeze through a canyon full of rock ledges, and light the summit beacon.',
    size: [2360, 1140],
    start: { x: 200, y: 200, yaw: 0 },
    timeLimit: 150,
    paint: [
      { shape: 'rect', x0: 50, y0: 60, x1: 350, y1: 340, color: 'blue', label: 'START' },
      { shape: 'rect', x0: 500, y0: 420, x1: 1700, y1: 760, color: 'gray' },
      { shape: 'line', pts: [[350, 590], [2000, 590]], width: 20, color: 'black' },
      { shape: 'rect', x0: 1720, y0: 440, x1: 1850, y1: 740, color: 'green', label: 'EXIT' },
      { shape: 'rect', x0: 1900, y0: 900, x1: 2300, y1: 1100, color: 'yellow', label: 'FINISH' },
      { shape: 'circle', x: 770, y: 200, r: 60, color: 'red' }
    ],
    obstacles: [
      // reach-over fence with a button behind it
      { id: 'fence', label: 'Fence', x: 697, y: 200, w: 14, d: 220, z1: 50, color: '#e8e4da', penalty: true },
      { id: 'pedestal', label: 'Button pedestal', x: 770, y: 200, w: 40, d: 40, z1: 25, color: '#555b66' },
      // canyon walls
      { id: 'wall-s', label: 'Canyon wall', x: 1100, y: 410, w: 1200, d: 20, z1: 150, color: '#b0754a', penalty: true },
      { id: 'wall-n', label: 'Canyon wall', x: 1100, y: 770, w: 1200, d: 20, z1: 150, color: '#b0754a', penalty: true },
      // overhanging ledges stuck to the canyon walls
      { id: 'ledge1', label: 'Rock ledge (125 mm)', x: 830, y: 640, w: 60, d: 240, z0: 125, z1: 150, color: '#8a5634', penalty: true, overhang: true },
      { id: 'ledge2', label: 'Rock shelf (110 mm)', x: 1430, y: 535, w: 60, d: 230, z0: 110, z1: 140, color: '#8a5634', penalty: true, overhang: true },
      { id: 'boulder', label: 'Boulder', kind: 'cyl', x: 1000, y: 465, r: 35, z1: 60, color: '#7b6f66', penalty: true },
      // summit
      { id: 'summit', label: 'Summit tower', x: 2125, y: 590, w: 150, d: 140, z1: 340, color: '#6f7f95' },
      { id: 'cable-post', label: 'Cable post', x: 1710, y: 810, w: 20, d: 40, z1: 160, color: '#555b66' },
      { id: 'cable', label: 'Cable (140 mm)', x: 2035, y: 810, w: 650, d: 16, z0: 140, z1: 156, color: '#2b2b2b', penalty: true, overhang: true }
    ],
    targets: [
      { id: 'button', label: 'Button · 35 mm', x: 770, y: 200, z: 35, face: 'up', r: 25 },
      { id: 'crystal', label: 'Crystal · 150 mm', x: 1150, y: 748, z: 150, face: 270, r: 25 },
      { id: 'beacon', label: 'Beacon · 240 mm', x: 2038, y: 590, z: 240, face: 180, r: 25 }
    ],
    missions: [
      { id: 'm1', type: 'touch', target: 'button', points: 15, name: 'Press the Button',
        desc: 'The red button sits 35 mm high behind a 50 mm fence. Reach over the fence and press it with the arm tip.',
        hint: 'The robot can\'t cross the fence. Lower the arm after the arm has cleared the fence, or tilt it just enough.' },
      { id: 'm2', type: 'touch', target: 'crystal', points: 25, name: 'Canyon Crystal',
        desc: 'A crystal is fixed to the north canyon wall, 150 mm high. Touch it.',
        hint: 'The canyon is only 340 mm wide. A level arm sticks out 205 mm from the robot\'s centre: it will hit the wall while turning.' },
      { id: 'm3', type: 'zone', rect: [1720, 440, 1850, 740], points: 15, name: 'Through the Canyon',
        desc: 'Make it out of the canyon into the green Exit. Two rock ledges hang over the path at 125 mm and 110 mm.',
        hint: 'The robot body is 95 mm tall. Only the arm can catch on a ledge.' },
      { id: 'm4', type: 'touch', target: 'beacon', points: 25, name: 'Summit Beacon',
        desc: 'Light the beacon on the summit tower. It is 240 mm above the floor.',
        hint: 'Very high! Work out the arm angle first, then how close the robot must get.' },
      { id: 'm5', type: 'park', rect: [1900, 900, 2300, 1100], points: 10, name: 'Finish Flag',
        desc: 'End the program parked in the yellow Finish zone. A cable is stretched 140 mm above the floor on the way.' },
      { id: 'm6', type: 'clean', points: 10, minMissions: 3, name: 'Clean Run',
        desc: 'Bonus: complete 3 missions without bumping the fence, canyon walls, ledges, boulder or cable.' }
    ],
    starter: `from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor, UltrasonicSensor, ForceSensor
from pybricks.parameters import Button, Color, Direction, Port, Side, Stop
from pybricks.robotics import DriveBase
from pybricks.tools import wait, StopWatch

hub = PrimeHub()

left_motor = Motor(Port.A, Direction.COUNTERCLOCKWISE)
right_motor = Motor(Port.B)
arm = Motor(Port.C)          # positive angle = arm goes up

drive_base = DriveBase(left_motor, right_motor, wheel_diameter=56, axle_track=112)
drive_base.use_gyro(True)    # turn using the hub's gyro

# Mission 1: Press the Button (it's straight ahead)

# Your code here...
`
  });
})(typeof self !== 'undefined' ? self : window);
