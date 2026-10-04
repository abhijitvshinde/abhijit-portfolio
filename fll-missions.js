/* ==========================================
   FLL ATTACHMENT LAB — season data
   2026-27 FIRST LEGO League Challenge: BIOGLOW

   The field and mission models are LEGO-stud-scale look-alikes of the
   official BIOGLOW models, placed where the official Field Setup Guide
   puts them, with the same moving parts. Goals are in our own words.
   The official Robot Game Rulebook + Challenge Updates are the authority.

   Units: 1 = one LEGO stud (8 mm). World: x = east along the mat
   (0..295), z = south toward the audience (0 = far wall, 143 = near
   edge), y = up. Model parts use model-local coords (x east, z south =
   the model's front, y up); each model is placed with {x, z, rot}.
   Boxes are [x0, y0, z0, x1, y1, z1].
========================================== */

window.FLL_DATA = (function () {

  const LINKS = {
    missionsVideo: "https://youtu.be/uhZZ8O1StiQ",
    fieldSetupVideo: "https://youtu.be/wDan0826cn0",
    rulebook: "https://firstinspires.blob.core.windows.net/fll/challenge/2026-27/fll-challenge-bioglow-rgr.pdf",
    updates: "https://firstinspires.blob.core.windows.net/fll/challenge/2026-27/fll-challenge-bioglow-updates.pdf",
    fieldGuide: "https://firstinspires.blob.core.windows.net/fll/challenge/2026-27/fll-challenge-bioglow-field-setup-reference-guide.pdf",
    materials: "https://www.firstinspires.org/resources/library/fll/season-materials",
    season: "https://www.firstinspires.org/programs/fll/game-and-season"
  };

  /* LEGO colors */
  const C = {
    red: 0xc91a09, brown: 0x6b3f22, tan: 0xd9bb7b, darkTan: 0x958a73, lime: 0xa5ca18,
    green: 0x237841, brightGreen: 0x4b9f4a, darkGreen: 0x184632, dgray: 0x6c6e68,
    lgray: 0xa0a5a9, white: 0xf4f4f4, black: 0x1b2a34, yellow: 0xf2cd37, gold: 0xc69b3b,
    orange: 0xfe8a18, azure: 0x36aebf, transBlue: 0x9ad5f5, pink: 0xe4adc8, magenta: 0x923978
  };

  /* part helpers (model-local) */
  const box = (name, b, color, o) => Object.assign({ k: "box", name, b, color }, o || {});
  const beam = (name, b, color, o) => Object.assign({ k: "beam", name, b, color }, o || {});
  const cyl = (name, c, r, h, color, o) => Object.assign({ k: "cyl", name, c, r, h, color }, o || {});
  const ball = (name, c, r, color, o) => Object.assign({ k: "ball", name, c, r, color, deco: true }, o || {});
  const leafy = (c, r, color) => ball("leaves", c, r, color || C.brightGreen);

  // a Technic frame standing in the x-y plane (w wide, h tall) at z0..z0+1
  function frameXY(name, x0, y0, z0, w, h, color, o) {
    return [
      beam(name, [x0, y0, z0, x0 + w, y0 + 1, z0 + 1], color, o),
      beam(name, [x0, y0 + h - 1, z0, x0 + w, y0 + h, z0 + 1], color, o),
      beam(name, [x0, y0 + 1, z0, x0 + 1, y0 + h - 1, z0 + 1], color, o),
      beam(name, [x0 + w - 1, y0 + 1, z0, x0 + w, y0 + h - 1, z0 + 1], color, o)
    ];
  }

  // open Technic cage used by the interchangeable dock models (M13, M14)
  function cage(color) {
    const p = [];
    for (const [x, z] of [[-6, -5], [5, -5], [-6, 4], [5, 4]]) p.push(beam("frame", [x, 0, z, x + 1, 9, z + 1], color));
    p.push(beam("frame", [-6, 8, 4, 6, 9, 5], color), beam("frame", [-6, 8, -5, 6, 9, -4], color),
      beam("frame", [-6, 8, -4, -5, 9, 4], color), beam("frame", [5, 8, -4, 6, 9, 4], color),
      beam("frame", [-6, 0, 4, 6, 1, 5], color), beam("frame", [-6, 0, -5, 6, 1, -4], color));
    return p;
  }

  /* ---------- mission models ---------- */

  const MODELS = {

    // M01: pushing the red scan marker along the mat bends the long axles
    // into an upside-down V that lifts the drone.
    drone: {
      parts: [
        box("scan marker", [-2, 0, -2, 2, 2.4, 1], C.red, { g: "marker", target: true }),
        box("axle", [2, 0.2, -1.6, 50, 0.6, -1.2], C.black, { deco: true, g: "railA" }),
        box("axle", [2, 0.2, 0.2, 50, 0.6, 0.6], C.black, { deco: true, g: "railA" }),
        box("axle", [50, 0.2, -1.6, 98, 0.6, -1.2], C.black, { deco: true, g: "railB" }),
        box("axle", [50, 0.2, 0.2, 98, 0.6, 0.6], C.black, { deco: true, g: "railB" }),
        cyl("drone", [50, 0, -0.5], 1.6, 1.2, C.black, { g: "drone", deco: true }),
        cyl("drone light", [50, 1.2, -0.5], 0.6, 0.4, C.white, { g: "drone", deco: true }),
        cyl("pilot base", [102, 0, -0.5], 4, 1.4, C.dgray),
        box("pilot", [101, 1.4, -1, 103, 4.4, 0], C.yellow, { deco: true }),
        ...frameXY("LiDAR map", 84, 0, -22, 7, 1, C.lgray, { deco: true, g: "lidar" }),
        box("LiDAR map", [84, 0, -22, 91, 0.8, -17], C.lgray, { g: "lidar" })
      ]
    },

    // M02: three seed pods held on a lime stalk by gold rings.
    seeds: {
      parts: [
        beam("base frame", [-4, 0, -3, 4, 1, 3], C.lgray),
        box("stalk", [-1.5, 1, -1, 1.5, 16, 1], C.lime),
        box("stalk top", [-0.5, 16, -0.5, 0.5, 21, 0.5], C.yellow, { deco: true }),
        box("stalk top", [-2.5, 19, -0.5, 2.5, 19.8, 0.5], C.yellow, { deco: true }),
        box("seed ring", [-1.4, 10, 3, 1.4, 10.4, 3.4], C.gold, { g: "seed", target: true }),
        box("seed ring", [-1.4, 7.6, 3, 1.4, 8, 3.4], C.gold, { g: "seed", target: true }),
        box("seed ring", [-1.4, 8, 3, -1, 10, 3.4], C.gold, { g: "seed", target: true }),
        box("seed ring", [1, 8, 3, 1.4, 10, 3.4], C.gold, { g: "seed", target: true }),
        box("seed ring", [-0.4, 8, 1, 0.4, 8.4, 3], C.gold, { g: "seed", deco: true }),
        cyl("seed", [0, 5, 2.2], 1.2, 2.6, C.brown, { g: "seed", deco: true }),
        cyl("seed", [-4, 9, 0], 1.2, 2.6, C.brown, { deco: true }),
        cyl("seed", [4, 9, 0], 1.2, 2.6, C.brown, { deco: true }),
        box("tube", [-4.3, 11.6, -0.3, -3.7, 19, 0.3], C.lime, { deco: true }),
        box("tube", [3.7, 11.6, -0.3, 4.3, 19, 0.3], C.lime, { deco: true }),
        box("tube", [-4.3, 18.6, -0.3, 4.3, 19.2, 0.3], C.lime, { deco: true })
      ]
    },

    // M03: the rock turns on an axle inside a fixed frame; pulling a red
    // handle toward the robot flips it and the research flag goes down.
    rock: {
      groups: { rock: { pivot: [0, 2.5, 0.5] } },
      parts: [
        beam("frame", [-5, 0, -3, -4, 3, 4], C.dgray),
        beam("frame", [4, 0, -3, 5, 3, 4], C.dgray),
        box("rock", [-4, 0.4, -3, 4, 5, 4], C.lgray, { g: "rock" }),
        box("moss", [-4, 1, 3, -1, 5, 4.2], C.green, { g: "rock", deco: true }),
        box("moss", [1, 1, 3, 4, 4, 4.2], C.lime, { g: "rock", deco: true }),
        beam("red handle", [-4, 4, -3, -3, 11, -2], C.red, { g: "rock", target: true }),
        beam("red handle", [3, 4, -3, 4, 11, -2], C.red, { g: "rock", target: true }),
        box("research flag", [5, 0, 3, 6, 5, 4], C.black, { g: "flag" }),
        box("research flag", [5, 5, 3, 6, 6, 4], C.red, { g: "flag", deco: true }),
        cyl("flower", [0.5, 5, 1], 0.5, 1, C.transBlue, { g: "rock", deco: true })
      ]
    },

    // M04: three slots — two leaves and the katydid — each with a tan loop on top.
    leaves: {
      parts: [
        box("nest", [-9, 0, -3, 9, 2, 3], C.lgray),
        box("nest", [-9, 2, -3, 9, 3, 3], C.green),
        ...slot("leafL", -6, false),
        ...slot("katydid", 0, true),
        ...slot("leafR", 6, false)
      ]
    },

    // M05: a pivoting arm with two red handles; a quick push swings the root out.
    roots: {
      groups: { arm: { pivot: [-1, 9.5, -2] } },
      parts: [
        ...frameXY("frame", -7, 0, -5, 5, 7, C.lgray),
        box("root base", [-2, 0, -5, 3, 3, 0], C.brown),
        box("slope", [-2, 0, 0, 3, 1.6, 2], C.brown, { deco: true }),
        beam("post", [-2, 3, -3, -1, 10, -2], C.brown),
        beam("post", [0, 3, -3, 1, 10, -2], C.brown),
        beam("root arm", [-3, 9, -3, 9, 10, -1], C.brown, { g: "arm" }),
        box("root", [8, 10, -2.5, 9, 13, -1.5], C.brown, { g: "arm", deco: true }),
        beam("red handle", [-5, 4, -1, -4, 5, 5], C.red, { g: "arm", target: true }),
        ball("red handle", [-4.5, 4.5, 5.6], 0.7, C.red, { g: "arm" }),
        beam("red handle", [1, 7, -1, 2, 8, 5], C.red, { g: "arm", target: true }),
        ball("red handle", [1.5, 7.5, 5.6], 0.7, C.red, { g: "arm" })
      ]
    },

    // M06 + M07: the tan nest with the ant on its rack, and the white fungus tower.
    nest: {
      parts: [
        box("nest", [-4, 0, -5, 4, 7, 1], C.tan),
        box("nest door", [-2, 0, 0.6, 2, 4, 1.2], C.darkGreen, { deco: true }),
        cyl("gear", [-4.6, 1.5, -1], 1.6, 0.5, C.lgray, { deco: true }),
        box("leaf fragment", [-3, 7, -2, -2.4, 11, -1], C.green, { deco: true }),
        box("leaf fragment", [-1.5, 7, -2, -0.9, 11.5, -1], C.orange, { deco: true }),
        box("leaf fragment", [0, 7, -2, 0.6, 11, -1], C.yellow, { deco: true }),
        box("leaf fragment", [1.5, 7, -2, 2.1, 10.5, -1], C.white, { deco: true }),
        beam("rack", [-11, 0, 0, -4, 1, 1], C.white, { g: "ant" }),
        box("ant", [-14, 0, -1, -11, 3, 2], C.red, { g: "ant", target: true }),
        beam("tower", [6, 0, -5, 7, 13, -4], C.lgray),
        beam("tower", [9, 0, -5, 10, 13, -4], C.lgray),
        box("tower", [6, 11, -5, 10, 13, -2], C.white),
        beam("mycelium", [5, 5, -2, 6, 11, 1], C.white, { g: "myc" }),
        beam("mycelium", [10, 5, -2, 11, 11, 1], C.white, { g: "myc" }),
        beam("mycelium", [5, 5, 1, 11, 6, 2], C.white, { g: "myc" }),
        beam("lever post", [8, 0, -2, 9, 2, 2], C.lgray),
        beam("red lever", [7, 1, 2, 12, 2, 3], C.red, { g: "lever", target: true }),
        ball("red lever", [12.6, 1.5, 2.5], 0.7, C.red, { g: "lever" })
      ]
    },

    // M08 + M09: the research tree — platform on the front, vine on the right.
    tree: {
      parts: [
        cyl("tree", [0, 0, -3], 2.6, 22, C.brown),
        leafy([0, 23, -3], 5, C.brightGreen), leafy([-6, 22, -2], 3.5, C.lime), leafy([6, 22, -4], 3.5, C.green),
        beam("branch", [-8, 15, -3.5, -2, 16, -2.5], C.brown, { deco: true }),
        box("research platform", [-6, 9, -1, 6, 10, 5], C.tan, { g: "platform", target: true }),
        box("railing", [-6, 10, 4.6, 6, 11.2, 5], C.tan, { g: "platform", deco: true }),
        box("researcher", [-3, 10, 1, -2, 13, 2], C.green, { g: "platform", deco: true }),
        box("camera trap", [2, 10, 1, 3, 11, 2], C.black, { g: "platform", deco: true }),
        beam("support", [-5, 0, -1, -4, 9, 0], C.lgray),
        beam("support", [4, 0, -1, 5, 9, 0], C.lgray),
        box("vine", [8, 4, -1, 9, 14, 0], C.brightGreen, { g: "vine", target: true }),
        box("vine", [6, 13, -1, 8, 14, 0], C.tan, { g: "vine", target: true }),
        box("vine", [8, 3, 0, 9, 4, 3], C.brightGreen, { g: "vine", target: true }),
        beam("hook", [3, 13, -1.5, 6, 14, -0.5], C.lgray, { deco: true })
      ]
    },

    // M10: two fragile habitats (placed separately on the field).
    spider: {
      parts: [
        ...frameXY("spider habitat", -3, 0, 0, 6, 7, C.white, { protect: true }),
        beam("spider habitat", [-4, 7, -0.5, 4, 8, 1.5], C.brown, { protect: true }),
        box("spider", [-0.5, 3.5, 0.2, 0.5, 4.5, 0.8], C.black, { deco: true })
      ]
    },
    snail: {
      parts: [
        beam("snail habitat", [-1, 0, -2, 1, 2, 2], C.dgray, { protect: true }),
        beam("snail habitat", [-1, 2, -1, 1, 6, 0], C.lime, { protect: true }),
        cyl("snail", [0, 6, -0.5], 1.6, 0.6, C.yellow, { deco: true })
      ]
    },

    // M11: a stump with a root cover hinged at the bottom; pull the red top bar.
    window: {
      groups: { cover: { pivot: [0, 0, 5] } },
      parts: [
        box("stump", [-4, 0, -4, 4, 9, 4], C.brown),
        box("stump top", [-4, 9, -4, 4, 10, 4], C.green, { deco: true }),
        cyl("flower", [1, 10, -1], 0.6, 4, C.green, { deco: true }),
        ball("flower", [1, 14.5, -1], 1.2, C.orange),
        box("root cover", [-4, 0, 4, 4, 8, 5], C.brown, { g: "cover", target: true }),
        box("red top bar", [-4, 7, 5, 7, 8, 6], C.red, { g: "cover", target: true })
      ]
    },

    // M12: the old tree with the cane lying on the mat in front.
    elder: {
      groups: { cane: { pivot: [0, 1.5, 2] } },
      parts: [
        cyl("base", [0, 0, 0], 4, 1, C.darkGreen),
        box("tree", [-1, 1, -1, 1, 13, 1], C.tan),
        box("tree", [0, 12, -1, 2, 17, 1], C.tan, { deco: true }),
        leafy([1, 18, 0], 2.6, C.green), leafy([4, 15, 0], 2, C.brightGreen),
        box("support tie", [-6, 1, -3, -5, 9, 3], C.red, { deco: true }),
        box("post", [-10, 0, 4, -8, 4, 6], C.lgray, { deco: true }),
        box("cane", [-1, 1, 2, 1, 2, 11], C.brown, { g: "cane", target: true })
      ]
    },

    // Interchangeable dock models (Missions 13-15)
    keystone: {
      parts: [
        box("dock", [-7, 0, -6, 7, 0.3, 6], C.lgray, { deco: true }),
        ...cage(C.black),
        box("restoration platform", [-4, 4, -3, 4, 5, 3], C.lgray, { g: "plat" }),
        beam("tree arm", [-5, 9, -1, -4, 13, 0], C.brown, { g: "trees", deco: true }),
        beam("tree arm", [4, 9, -1, 5, 13, 0], C.brown, { g: "trees", deco: true }),
        leafy([-4.5, 13.5, -0.5], 1.5, C.brightGreen), leafy([4.5, 13.5, -0.5], 1.5, C.brightGreen)
      ]
    },
    replant: {
      parts: [
        box("dock", [-7, 0, -6, 7, 0.3, 6], C.lgray, { deco: true }),
        ...cage(C.black),
        ...[-3, -1, 1, 3].map((z) => beam("grate", [-5, 9, z, 5, 10, z + 0.6], C.brown)),
        box("soil", [-5, 1, -4, 5, 2, 4], C.darkTan, { deco: true })
      ]
    },
    building: {
      groups: { canopy: { pivot: [0, 9.3, -1] } },
      parts: [
        box("dock", [-7, 0, -6, 7, 0.3, 6], C.lgray, { deco: true }),
        box("building", [-6, 0, -5, 6, 9, 5], C.lime),
        box("window", [-5, 2, 4.8, -1, 6, 5.1], C.white, { deco: true }),
        box("roof", [1, 9, -5, 6, 9.8, 5], C.black, { deco: true }),
        box("nesting canopy", [-6, 9, -1, 1, 9.6, 7], C.red, { g: "canopy", target: true }),
        box("bird", [3, 9.8, 1, 4, 10.8, 2], C.azure, { deco: true })
      ]
    }
  };

  function slot(group, c, katydid) {
    const o = katydid ? { g: group, protect: true } : { g: group, target: true };
    const color = katydid ? 0x7ab648 : C.brightGreen;
    return [
      box(katydid ? "katydid" : "leaf", [c - 2, 3, -3, c + 2, 5, 0], color, o),
      box(katydid ? "katydid" : "leaf loop", [c - 2, 3, 0, c - 1.6, 12, 0.4], C.tan, o),
      box(katydid ? "katydid" : "leaf loop", [c + 1.6, 3, 0, c + 2, 12, 0.4], C.tan, o),
      box(katydid ? "katydid" : "leaf loop", [c - 2, 11.6, 0, c + 2, 12, 0.4], C.tan, o)
    ];
  }

  /* ---------- the field ---------- */

  const DOCKS = { mine: [278, 16], farm: [147, 63], city: [190, 128] };

  const FIELD = {
    size: [295, 143],
    wallHeight: 9,
    homes: [{ x: 0, color: C.red }, { x: 295, color: 0x1d4ed8 }],
    homeRadius: 68,
    lines: [[[64, 50], [78, 28], [110, 24]], [[198, 15], [215, 30], [250, 30]], [[141, 72], [151, 92]]],
    // where each model sits (rot = degrees around the vertical axis)
    place: [
      { model: "drone", x: 62, z: 136, rot: 0 },
      { model: "seeds", x: 93, z: 74, rot: -90 },
      { model: "rock", x: 16, z: 58, rot: 0 },
      { model: "leaves", x: 24, z: 20, rot: 0 },
      { model: "roots", x: 60, z: 6, rot: 0 },
      { model: "tree", x: 78, z: 8, rot: 0 },
      { model: "spider", x: 116, z: 14, rot: 0 },
      { model: "snail", x: 161, z: 45, rot: 0 },
      { model: "nest", x: 228, z: 8, rot: 0 },
      { model: "window", x: 206, z: 66, rot: 90 },
      { model: "elder", x: 280, z: 44, rot: 0 },
      { model: "keystone", dock: "farm" },
      { model: "replant", dock: "city" },
      { model: "building", dock: "mine" }
    ]
  };

  /* ---------- missions ----------
     start: robot's front-center position and heading in world coords
            (heading 0 = east, 90 = north, 180 = west).
     checks: zones are in the mission model's local coords.
     dock: dock missions put their own model on the farm dock (center of the
           field, easy to reach) for the test; teams choose the dock in real matches. */

  const MISSIONS = [
    {
      id: "M01", name: "Drone Survey", color: "#38bdf8", icon: "fa-helicopter", noTouch: true,
      goal: "Push the red scan marker along the mat to launch the drone.", points: "20, +10 bonus",
      model: "drone", start: { x: 46, z: 128, h: 0 },
      checks: [{
        type: "push", label: "Launch the drone", target: "scan marker", zone: [-3, 0, -2, -1.5, 2.4, 1],
        done: "The axles bend up and the drone leaves the mat!",
        anim: [{ g: "marker", move: [10, 0, 0] }, { g: "drone", move: [0, 7, 0] }, { g: "railA", rot: { axis: "z", deg: 8, pivot: [2, 0.4, 0] } }, { g: "railB", rot: { axis: "z", deg: -8, pivot: [98, 0.4, 0] } }],
        robot: [10, -4]
      }]
    },
    {
      id: "M02", name: "Exploding Seeds", color: "#f59e0b", icon: "fa-seedling",
      goal: "Reach through a gold seed ring and pull the seed off the stalk.", points: "10 each seed",
      model: "seeds", start: { x: 75, z: 74, h: 0 },
      checks: [{
        type: "hook", label: "Catch the seed", target: "seed ring", zone: [-1, 8, 1, 1, 10, 3.4],
        done: "Your attachment goes through the ring — the seed comes off!",
        anim: [{ g: "seed", move: [0, -5, 6] }], robot: [-6]
      }]
    },
    {
      id: "M03", name: "Flip the Rock", color: "#a78bfa", icon: "fa-mountain",
      goal: "Hook a red handle from above and pull to flip the rock.", points: "20, +10 bonus",
      model: "rock", start: { x: 16, z: 76, h: 90 },
      checks: [{
        type: "pull", label: "Flip the rock", target: "red handle",
        zones: [[-4, 8, -5, -3, 11, -3], [3, 8, -5, 4, 11, -3]],
        done: "You pulled the handle — the rock flips and the flag goes down!",
        anim: [{ g: "rock", rot: { axis: "x", deg: 180 } }, { g: "flag", rot: { axis: "x", deg: 80, pivot: [5.5, 0, 3.5] } }], robot: [-4]
      }]
    },
    {
      id: "M04", name: "Lucky Leaves", color: "#22c55e", icon: "fa-leaf", noTouch: true,
      goal: "Hook a leaf's tan loop and lift the leaf out — don't touch the katydid.", points: "10, +20 bonus",
      model: "leaves", start: { x: 24, z: 37, h: 90 },
      checks: [
        {
          type: "hook", label: "Take a leaf", target: "leaf loop",
          zones: [[-7.6, 5, -3, -4.4, 11.6, 0.4], [4.4, 5, -3, 7.6, 11.6, 0.4]], groups: ["leafL", "leafR"],
          done: "You hooked a leaf and pulled it out of the nest!",
          anim: [{ g: "$hit", move: [0, 3, 7] }], robot: [-7]
        },
        { type: "avoid", label: "Katydid", done: "The katydid didn't move." }
      ],
      note: "In real matches the referee mixes up where the leaves and the katydid go."
    },
    {
      id: "M05", name: "Reaching Roots", color: "#b45309", icon: "fa-tree", noTouch: true,
      goal: "Hit a red handle quickly so the root swings out.", points: "10 or 20",
      model: "roots", start: { x: 60, z: 26, h: 90 },
      checks: [{
        type: "push", label: "Swing the root", target: "red handle",
        zones: [[-5, 3.5, 5, -4, 5.5, 6.5], [1, 6.5, 5, 2, 8.5, 6.5]],
        done: "The arm swings and the root reaches across the boundary!",
        anim: [{ g: "arm", rot: { axis: "y", deg: -55 } }], robot: [1, -5]
      }]
    },
    {
      id: "M06", name: "Leafcutter Frenzy", color: "#ef4444", icon: "fa-bug",
      goal: "Push the ant along its rack into the nest — gently!", points: "10 each fragment",
      model: "nest", start: { x: 200, z: 9, h: 0 },
      checks: [{
        type: "push", label: "Ant home", target: "ant", zone: [-15, 0, -1, -13.5, 3, 2],
        done: "The ant slides into the nest with its leaves!",
        anim: [{ g: "ant", move: [7, 0, 0] }], robot: [7, -4]
      }]
    },
    {
      id: "M07", name: "Humongous Fungus", color: "#e5e7eb", icon: "fa-circle-nodes", noTouch: true, teamwork: true,
      goal: "Lower a hook behind the red lever and pull it toward you.", points: "20, +10 bonus",
      model: "nest", start: { x: 238, z: 25, h: 90 },
      checks: [{
        type: "pull", label: "Extend the mycelium", target: "red lever", zone: [7, 0.5, -1, 12, 2.5, 2],
        done: "You pulled the lever — the mycelium stretches out!",
        anim: [{ g: "lever", move: [0, 0, 3] }, { g: "myc", move: [0, 1, 4] }], robot: [-4]
      }]
    },
    {
      id: "M08", name: "Tangled", color: "#16a34a", icon: "fa-wind",
      goal: "Lift the bottom of the vine so it comes off its hook.", points: "30",
      model: "tree", start: { x: 86, z: 25, h: 90 },
      checks: [{
        type: "lift", label: "Untangle the vine", target: "vine", zone: [8, 1, 0, 9, 3, 3], need: 2,
        done: "The vine comes off its hook and falls to the mat!",
        anim: [{ g: "vine", move: [1, -3, 3] }]
      }]
    },
    {
      id: "M09", name: "Research Platform", color: "#0ea5e9", icon: "fa-binoculars", noTouch: true,
      goal: "Get under the research platform and lift it up the tree.", points: "10 + 10 + 10",
      model: "tree", start: { x: 78, z: 25, h: 90 },
      checks: [{
        type: "lift", label: "Raise the platform", target: "research platform", zone: [-6, 6, 3, 6, 9, 5], need: 3,
        done: "The platform goes up the tree!",
        anim: [{ g: "platform", move: [0, 3.5, 0] }]
      }]
    },
    {
      id: "M10", name: "Fragile Microhabitats", color: "#facc15", icon: "fa-spider", noTouch: true,
      goal: "Drive past the spider and snail homes without touching them.", points: "10 + 10",
      model: "spider", start: { x: 90, z: 30, h: 0 }, driveTo: 85, allowEmpty: true,
      checks: [{ type: "avoid", label: "Drive past safely", done: "You drove past without touching the habitats!" }]
    },
    {
      id: "M11", name: "Window to the Past", color: "#dc2626", icon: "fa-door-open",
      goal: "Hook behind the red top bar and pull the root cover down.", points: "20",
      model: "window", start: { x: 226, z: 66, h: 180 },
      checks: [{
        type: "pull", label: "Open the window", target: "red top bar", zone: [4, 6, 3, 7, 8, 5],
        done: "The root cover folds down onto the mat!",
        anim: [{ g: "cover", rot: { axis: "x", deg: 88 } }], robot: [-4]
      }]
    },
    {
      id: "M12", name: "Forest Elder", color: "#a16207", icon: "fa-tree", noTouch: true,
      goal: "Slide under the cane and lift it up against the tree.", points: "20 + 10",
      model: "elder", start: { x: 280, z: 67, h: 90 },
      checks: [{
        type: "lift", label: "Raise the cane", target: "cane", zone: [-1, 0, 6, 1, 1, 11], need: 3,
        done: "The cane goes up against the tree!",
        anim: [{ g: "cane", rot: { axis: "x", deg: -62 } }]
      }]
    },
    {
      id: "M13", name: "Keystone Species", color: "#ec4899", icon: "fa-paw", dock: true,
      goal: "Carry your animal over the cage and drop it on the platform inside.", points: "30",
      model: "keystone", start: { x: 147, z: 82, h: 90 },
      checks: [{
        type: "deliver", label: "Deliver the animal", zone: [-5, 5, -4, 5, 12, 4], min: 2, color: 0xec4899,
        done: "Your animal lands on the platform and the young trees go up!",
        anim: [{ g: "plat", move: [0, -1, 0] }, { g: "trees", move: [0, 2, 0] }]
      }]
    },
    {
      id: "M14", name: "Seeds of Renewal", color: "#84cc16", icon: "fa-hand-holding-droplet", dock: true,
      goal: "Reach over the station and drop seeds through the grate.", points: "5 each, +5 each",
      model: "replant", start: { x: 147, z: 82, h: 90 },
      checks: [{
        type: "deliver", label: "Plant the seeds", zone: [-5, 10, -4, 5, 14, 4], min: 2, color: 0x6b3f22,
        done: "The seeds drop into the station!"
      }]
    },
    {
      id: "M15", name: "Biocentric Architecture", color: "#14b8a6", icon: "fa-building", noTouch: true, dock: true,
      goal: "Get under the red nesting canopy and lift it up.", points: "10 each, +10 bonus",
      model: "building", start: { x: 147, z: 82, h: 90 },
      checks: [{
        type: "lift", label: "Raise the canopy", target: "nesting canopy", zone: [-6, 7, 5, 1, 9, 7], need: 2,
        done: "The nesting canopy goes up!",
        anim: [{ g: "canopy", rot: { axis: "x", deg: -55 } }]
      }]
    }
  ];

  const RULES = [
    "A match lasts 2.5 minutes. The robot drives on its own — no remote controls.",
    "One hub, up to 4 motors. A standard SPIKE Prime set has 1 spare motor for attachments.",
    "Only LEGO pieces — no tape or glue.",
    "You can only touch the robot and swap attachments in home.",
    "Fit everything in one launch area under 12 in. tall for 20 bonus points."
  ];

  return { LINKS, MODELS, FIELD, DOCKS, MISSIONS, RULES };

})();
