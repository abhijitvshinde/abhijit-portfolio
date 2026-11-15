# Pybricks Robot Lab

A browser game where kids program a virtual SPIKE Prime robot in **Pybricks Python** and solve
missions on a 3D table. It is a plain static site (no build step), so it can be copied into any website folder.

- **Python**: real CPython (Pyodide 0.26.4, loaded from jsDelivr) runs in a Web Worker.
- **Pybricks API**: `python/pybricks/` re-implements `hubs`, `pupdevices`, `robotics`, `parameters`,
  `tools`, `geometry`, `iodevices`, plus `umath`, `urandom`, `micropython` and friends. Blocking calls and
  `async`/`multitask`/`run_task` both work.
- **Physics**: `js/sim.js` is a 5 ms fixed-step simulation (motor speed profiles, drive base, collisions,
  sensors). The program runs ahead in simulated time and the page replays the recorded frames in 3D
  (`js/render3d.js`, three.js 0.160).

## The robot

| Port | Device |
|---|---|
| A | Left drive motor (mirrored: use `Direction.COUNTERCLOCKWISE`) |
| B | Right drive motor |
| C | Arm motor, positive = up. Arm: 150 mm long, pivot 95 mm high, 55 mm ahead of the axle, −35°…+95° |
| D | Color sensor, pointing down, 60 mm ahead of the axle |
| E | Ultrasonic sensor, forward, 55 mm high |
| F | Force sensor on the arm tip |

Wheels: 56 mm, axle track 112 mm. Body: 150 × 130 × 95 mm. All values live in `js/shared.js`.

Rules the sim enforces:

- The body collides with anything lower than 95 mm. The arm collides with anything in its path, including
  overhangs, so a raised arm can catch on a low bridge, branch or cable.
- A blocking command (`straight`, `turn`, `run_angle`, …) that is stalled for 2 s is cancelled and the console
  reports what the robot is stuck on. `run_until_stalled` is not cancelled.
- Each sensor / motor reading costs 0.5 ms of robot time, so polling loops progress. A loop that never touches
  the robot is stopped by a 6 s watchdog.
- A match ends after `timeLimit` seconds (150 s by default).

## Run it locally

```bash
cd pybricks-emulator
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` as a file does not work, because the worker needs HTTP.

## Adding a map (3 → 10)

1. Copy `js/maps/map2-canyon.js` to a new file, e.g. `js/maps/map3-forest.js`.
2. Give it a unique `id` and `level`.
3. Add the file name to `js/maps/index.js`.

Map format (all distances in mm, origin at the table's bottom-left corner, y points "north"):

```js
{
  id: 'forest', name: 'Forest', level: 3, difficulty: 'Medium', blurb: '…',
  size: [2360, 1140],                 // table size
  start: { x: 200, y: 250, yaw: 0 },  // yaw: 0 = east, 90 = north (degrees)
  timeLimit: 150,                     // seconds
  paint: [                            // mat artwork, also what the colour sensor sees (later items on top)
    { shape: 'rect', x0, y0, x1, y1, color: 'green', label: 'ZONE' },
    { shape: 'circle', x, y, r, color: 'red' },
    { shape: 'line', pts: [[x, y], …], width: 20, color: 'black' }
  ],                                  // colours: white black gray red orange yellow green cyan blue violet magenta
  obstacles: [
    // box: centre x,y; size w (along x) × d (along y); from height z0 to z1; optional rot (deg)
    { id: 'wall', label: 'Wall', x, y, w, d, z0: 0, z1: 150, color: '#b0754a', penalty: true },
    // overhang: same, with z0 above the floor; `overhang: true` draws hazard stripes + a label
    { id: 'beam', label: 'Low beam', x, y, w, d, z0: 125, z1: 160, overhang: true, penalty: true },
    // cylinder
    { id: 'rock', kind: 'cyl', x, y, r: 50, z1: 80 }
  ],                                  // penalty: bumping it cancels the Clean Run bonus
  targets: [                          // things the arm tip must touch
    { id: 'bell', label: 'Bell · 180 mm', x, y, z: 180, face: 180, r: 25 }  // face: direction it faces (deg) or 'up'
  ],
  missions: [
    { id: 'm1', type: 'zone',  rect: [x0, y0, x1, y1], points: 15, name, desc, hint },  // robot centre enters
    { id: 'm2', type: 'touch', target: 'bell', points: 25, name, desc, hint },          // arm tip within r
    { id: 'm3', type: 'park',  rect: [x0, y0, x1, y1], points: 15, name, desc },        // stopped inside at the end
    { id: 'm4', type: 'clean', minMissions: 3, points: 15, name, desc }                 // no penalty bumps
  ],
  starter: `python code shown on first load`
}
```

Useful formulas for designing arm missions: tip height = `95 + 150·sin(a)`, tip reach = `55 + 150·cos(a)` mm ahead of
the wheel axle. Check a new map by writing a solution and running it: every mission should be reachable, and the
obstacles should block the obvious wrong approach.

## Files

```
index.html          page
css/style.css
js/main.js          editor, worker control, replay, missions UI
js/render3d.js      three.js scene
js/reference.js     API reference shown in the "Pybricks reference" dialog
js/worker.js        Pyodide + simulator worker
js/sim.js           physics, motors, drive base, sensors, missions
js/shared.js        robot dimensions, mat colours
js/maps/            one file per map + index.js
python/             the Pybricks package and MicroPython shims loaded into Pyodide
```
