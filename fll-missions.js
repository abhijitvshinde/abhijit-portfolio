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
  const deco = (o) => Object.assign({ deco: true }, o || {});

  // Technic frames: standing facing z (XY), standing facing x (ZY), or lying flat (XZ)
  function frameXY(name, x0, y0, z0, w, h, color, o) {
    return [
      beam(name, [x0, y0, z0, x0 + w, y0 + 1, z0 + 1], color, o),
      beam(name, [x0, y0 + h - 1, z0, x0 + w, y0 + h, z0 + 1], color, o),
      beam(name, [x0, y0 + 1, z0, x0 + 1, y0 + h - 1, z0 + 1], color, o),
      beam(name, [x0 + w - 1, y0 + 1, z0, x0 + w, y0 + h - 1, z0 + 1], color, o)
    ];
  }
  function frameZY(name, x0, y0, z0, d, h, color, o) {
    return [
      beam(name, [x0, y0, z0, x0 + 1, y0 + 1, z0 + d], color, o),
      beam(name, [x0, y0 + h - 1, z0, x0 + 1, y0 + h, z0 + d], color, o),
      beam(name, [x0, y0 + 1, z0, x0 + 1, y0 + h - 1, z0 + 1], color, o),
      beam(name, [x0, y0 + 1, z0 + d - 1, x0 + 1, y0 + h - 1, z0 + d], color, o)
    ];
  }
  function frameXZ(name, x0, y0, z0, w, d, color, o) {
    return [
      beam(name, [x0, y0, z0, x0 + w, y0 + 1, z0 + 1], color, o),
      beam(name, [x0, y0, z0 + d - 1, x0 + w, y0 + 1, z0 + d], color, o),
      beam(name, [x0, y0, z0 + 1, x0 + 1, y0 + 1, z0 + d - 1], color, o),
      beam(name, [x0 + w - 1, y0, z0 + 1, x0 + w, y0 + 1, z0 + d - 1], color, o)
    ];
  }
  // flexible tube / chain drawn as small blocks along an arc in the x-y plane (decoration)
  function arcXY(name, cx, cy, z, r, a0, a1, color, n, size) {
    const out = [];
    const s = (size || 0.7) / 2;
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      out.push(box(name, [x - s, y - s, z - s, x + s, y + s, z + s], color, deco()));
    }
    return out;
  }
  // a canopy of leaf plates (decoration)
  function canopy(x0, x1, z0, z1, y, colors) {
    const out = [];
    let k = 0;
    for (let x = x0; x < x1; x += 2.5) for (let z = z0; z < z1; z += 2.5) {
      const dy = ((k * 37) % 5) * 0.35;
      out.push(box("leaves", [x, y + dy, z, x + 2.2, y + dy + 0.4, z + 2.2], colors[k % colors.length], deco()));
      k++;
    }
    return out;
  }
  // the dark gray dock frame every interchangeable model plugs into
  function dock() {
    return [
      ...frameXZ("dock", -7, 0, -6, 15, 13, C.dgray, deco()),
      ...frameZY("dock", -8, 0, -4, 7, 5, C.dgray, deco()),
      ...frameZY("dock", 7, 0, -4, 7, 5, C.dgray, deco())
    ];
  }
  // open cage (dark gray frames + green top rails) shared by M13 and M14
  function cage() {
    return [
      ...frameXY("frame", -6, 0, 4, 12, 8, C.dgray),
      ...frameXY("frame", -6, 0, -5, 12, 8, C.dgray),
      beam("rail", [-6, 7, -4, -5, 8, 4], C.green),
      beam("rail", [5, 7, -4, 6, 8, 4], C.green),
      beam("rail", [-6, 0, -4, -5, 1, 4], C.green, deco()),
      beam("rail", [5, 0, -4, 6, 1, 4], C.green, deco()),
      box("latch", [-6, 8, 4, -4, 9, 5], C.yellow, deco()),
      box("latch", [4, 8, -5, 6, 9, -4], C.yellow, deco())
    ];
  }

  /* ---------- mission models (shaped after the official building instructions) ---------- */

  const MODELS = {

    // Book 01 — M01: a red scan marker on a long double zipline of 32L axles. Pushing the
    // marker toward the pilot bends the axles into an upside-down V that lifts the drone.
    drone: {
      parts: [
        box("scan marker", [-2, 0, -2, 2, 2.4, 2], C.red, { g: "marker", target: true }),
        box("scan marker", [-1.5, 2.4, -1.5, 1.5, 2.8, 1.5], C.red, { g: "marker", deco: true }),
        box("axle", [2, 0.2, -1.6, 50, 0.6, -1.2], C.black, { deco: true, g: "railA" }),
        box("axle", [2, 0.2, 1.2, 50, 0.6, 1.6], C.black, { deco: true, g: "railA" }),
        box("axle", [50, 0.2, -1.6, 98, 0.6, -1.2], C.black, { deco: true, g: "railB" }),
        box("axle", [50, 0.2, 1.2, 98, 0.6, 1.6], C.black, { deco: true, g: "railB" }),
        box("drone", [48.4, 0.6, -1.6, 51.6, 1.2, 1.6], C.white, { g: "drone", deco: true }),
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dz]) => cyl("rotor", [50 + dx * 1.5, 1.2, dz * 1.5], 1.1, 0.4, C.black, { g: "drone", deco: true })),
        cyl("camera", [50, 0, 0], 0.6, 0.6, C.transBlue, { g: "drone", deco: true }),
        cyl("pilot base", [102, 0, 0], 4, 0.8, C.dgray),
        box("pilot", [101, 0.8, -0.5, 103, 4.2, 0.5], C.yellow, deco()),
        box("pilot", [100.6, 2.4, -0.6, 103.4, 3.4, 0.6], C.white, deco()),
        box("LiDAR map", [72, 0, -40, 80, 3, -34], C.lgray, { g: "lidar" }),
        box("LiDAR map", [72.5, 3, -39.5, 79.5, 3.6, -34.5], C.green, { g: "lidar", deco: true }),
        cyl("LiDAR map", [76, 3.6, -37], 1.2, 0.5, C.brown, { g: "lidar", deco: true }),
        box("antenna", [67, 1.4, -37.4, 72, 2, -36.6], C.tan, { g: "lidar", deco: true })
      ]
    },

    // Book 02 — M02: lime stalk on a gray frame, yellow cross on top, green tubes arcing
    // down to two side seeds, and a front seed held on by a tan ring.
    seeds: {
      parts: [
        ...frameXZ("base frame", -3, 0, -4, 6, 7, C.lgray),
        box("stalk", [-1.5, 1, -1, 1.5, 15, 1], C.lime),
        beam("stalk", [-1, 1, 1, 1, 13, 1.6], C.green, deco()),
        box("stalk top", [-0.5, 15, -0.5, 0.5, 21, 0.5], C.yellow, deco()),
        box("stalk top", [-2.6, 18.6, -0.5, 2.6, 19.4, 0.5], C.yellow, deco()),
        ball("flower", [-1.3, 20, 0.6], 0.5, C.pink), ball("flower", [1.3, 16, 0.6], 0.5, C.brightGreen),
        ...arcXY("tube", -2.8, 13.5, 0, 5.6, 80, 230, C.lime, 16),
        ...arcXY("tube", 2.8, 13.5, 0, 5.6, 100, -50, C.lime, 16),
        cyl("seed", [-6.4, 8.8, 0], 1.3, 2.6, C.brown, deco()),
        cyl("seed", [6.4, 8.8, 0], 1.3, 2.6, C.brown, deco()),
        box("seed ring", [-1.4, 10, 3, 1.4, 10.4, 3.4], C.tan, { g: "seed", target: true }),
        box("seed ring", [-1.4, 7.6, 3, 1.4, 8, 3.4], C.tan, { g: "seed", target: true }),
        box("seed ring", [-1.4, 8, 3, -1, 10, 3.4], C.tan, { g: "seed", target: true }),
        box("seed ring", [1, 8, 3, 1.4, 10, 3.4], C.tan, { g: "seed", target: true }),
        box("seed ring", [-0.4, 8, 1, 0.4, 8.4, 3], C.tan, { g: "seed", deco: true }),
        cyl("seed", [0, 4.4, 2.4], 1.3, 2.8, C.brown, { g: "seed", deco: true })
      ]
    },

    // Book 03 — M03: a brown rock with green bricks, turning on an axle inside a lime and
    // gray frame; red handles at the back. Pull a handle to flip it.
    rock: {
      groups: { rock: { pivot: [0, 3, 0] } },
      parts: [
        box("base", [-5, 0, -4, 5, 1.2, 4], C.lime),
        ...[[-5, -4], [4, -4], [-5, 3], [4, 3]].map(([x, z]) => beam("frame", [x, 0, z, x + 1, 5, z + 1], C.lgray)),
        cyl("pivot", [-5.4, 2.6, 0], 0.5, 0.8, C.dgray, deco()),
        box("rock", [-4, 1.2, -3, 4, 5, 3], C.brown, { g: "rock" }),
        box("rock top", [-3, 5, -2, 2, 5.4, 1.5], C.darkTan, { g: "rock", deco: true }),
        box("moss", [-3.4, 1.6, 3, -1.4, 4.4, 3.5], C.green, { g: "rock", deco: true }),
        box("moss", [1.2, 1.6, 3, 3.2, 4.4, 3.5], C.green, { g: "rock", deco: true }),
        box("frog", [-1, 5, -0.5, 0, 5.8, 0.5], C.darkTan, { g: "rock", deco: true }),
        beam("red handle", [-4, 4, -3, -3, 11, -2], C.red, { g: "rock", target: true }),
        beam("red handle", [3, 4, -3, 4, 11, -2], C.red, { g: "rock", target: true }),
        box("research flag", [5, 0, 2, 6, 5, 3], C.dgray, { g: "flag" }),
        box("research flag", [5, 5, 2, 6, 6, 3], C.red, { g: "flag", deco: true })
      ]
    },

    // Book 04 — M04: three nest sections, each with a long green leaf pointing out and a
    // tan loop on top. The katydid looks like a leaf (here in the left section).
    leaves: {
      parts: [
        box("nest", [-9, 0, -3, 9, 1.5, 3], C.lgray),
        box("nest", [-9, 1.5, -3, 9, 3, 3], C.green),
        box("katydid", [-13, 3, -1, -5, 4.2, 2], 0x7ab648, { g: "katydid", protect: true }),
        box("leaf", [-1.5, 3, -1, 1.5, 4.2, 9], C.brightGreen, { g: "leafM", target: true }),
        box("leaf", [5, 3, -1, 13, 4.2, 2], C.brightGreen, { g: "leafR", target: true }),
        ...loop("katydid", -6, true), ...loop("leafM", 0, false), ...loop("leafR", 6, false)
      ]
    },

    // Book 05 — M05: brown root structure with a gray frame, a curved root base, and an arm
    // with two red handles. A quick hit swings the root out.
    roots: {
      groups: { arm: { pivot: [-3, 6, -1] } },
      parts: [
        ...frameZY("frame", -7, 0, -3, 5, 7, C.lgray),
        box("root base", [-6, 0, -2, -2, 5, 1], C.brown),
        box("root base", [-2, 0, -2, 1, 3, 1], C.brown),
        box("root base", [1, 0, -2, 4, 1.4, 1], C.brown),
        box("moss", [-6, 0, 1, -3, 2, 2], C.green, deco()),
        beam("root arm", [-4, 5, -1.5, -3, 13, -0.5], C.brown, { g: "arm" }),
        beam("root arm", [-6, 12, -1.5, -3, 13, -0.5], C.brown, { g: "arm" }),
        beam("green beam", [-6, 9, -2, -2, 10, -1], C.green, { g: "arm", deco: true }),
        box("root tip", [-7, 13, -1.4, -6, 17, -0.6], C.brown, { g: "arm", deco: true }),
        beam("red handle", [-6, 11, -1, -5, 12, 6], C.red, { g: "arm", target: true }),
        ball("red handle", [-5.5, 11.5, 6.6], 0.7, C.red, { g: "arm" }),
        beam("red handle", [-3, 8, -1, -2, 9, 6], C.red, { g: "arm", target: true }),
        ball("red handle", [-2.5, 8.5, 6.6], 0.7, C.red, { g: "arm" })
      ]
    },

    // Book 06 — M06 + M07: the tan nest with leaf flags, gears and a rack holding the red ant
    // out front; the white fungus tower with a lever down to a red handle.
    nest: {
      parts: [
        box("nest", [-4, 0, -4, 4, 8, 2], C.tan),
        box("nest door", [-2, 0, 1.8, 2, 4.5, 2.3], C.darkGreen, deco()),
        box("roof tiles", [-4, 8, -4, 4, 8.4, 2], C.white, deco()),
        box("leaf flag", [-2.2, 8.4, -1.2, -1.6, 13, -0.6], C.yellow, deco()),
        box("leaf flag", [-1, 8.4, -1.2, -0.4, 12.6, -0.6], C.orange, deco()),
        box("leaf flag", [0.2, 8.4, -1.2, 0.8, 12, -0.6], C.brightGreen, deco()),
        box("leaf flag", [1.4, 8.4, -1.2, 2, 11.6, -0.6], C.white, deco()),
        cyl("gear", [-1.5, 0.5, 2.6], 1.6, 0.6, C.lgray, deco()),
        cyl("gear", [1.5, 0.5, 2.6], 1.0, 0.6, C.tan, deco()),
        beam("rack", [-1, 0, 2, 0, 1, 9], C.white, { g: "ant" }),
        box("ant", [-2, 0, 9, 1, 3, 12], C.red, { g: "ant", target: true }),
        box("ant legs", [-3, 0.4, 9.5, 2, 0.8, 11.5], C.black, { g: "ant", deco: true }),
        box("leaf", [1, 0.3, 9.5, 4, 0.7, 11.5], C.brightGreen, { g: "ant", deco: true }),
        box("tower base", [6, 0, -4, 13, 1.5, 2], C.lgray),
        beam("tower", [8, 1.5, -2, 9, 10, -1], C.lgray),
        beam("tower", [10, 1.5, -2, 11, 10, -1], C.lgray),
        beam("mycelium", [6, 9, -4, 14, 10, -3], C.white, { g: "myc" }),
        beam("mycelium", [6, 10, -3, 14, 11, -2], C.white, { g: "myc" }),
        beam("mycelium", [12, 10, -7, 13, 11, -3], C.white, { g: "myc" }),
        beam("lever", [11, 2, 0, 12, 9, 1], C.white, { g: "lever", deco: true }),
        beam("lever", [11, 1, 1, 12, 2, 4], C.white, { g: "lever", deco: true }),
        beam("red handle", [11, 1, 4, 15, 2, 5], C.red, { g: "lever", target: true }),
        ball("red handle", [15.6, 1.5, 4.5], 0.7, C.red, { g: "lever" })
      ]
    },

    // Book 07 — M08 + M09: the research tree. Platform with railings on a gray lift linkage,
    // big leafy canopy, and a tan-and-green vine hanging on the right from a hook.
    tree: {
      parts: [
        box("tree", [-3, 0, -5, 2, 22, 0], C.brown),
        box("bark", [-3.3, 3, -1, -2.7, 18, 0.2], 0x5a3219, deco()),
        ...canopy(-13, 13, -7, 6, 22, [C.brightGreen, C.lime, C.green]),
        beam("branch", [-9, 17, -3, -3, 18, -2], C.brown, deco()),
        box("branch tip", [-10, 15.5, -3, -9, 18, -2], C.red, deco()),
        box("research platform", [-7, 9, 0, 6, 10, 7], C.tan, { g: "platform", target: true }),
        box("railing", [-7, 10, 6.6, 6, 11.2, 7], C.tan, { g: "platform", deco: true }),
        box("railing", [-7, 10, 0, -6.6, 11.2, 7], C.tan, { g: "platform", deco: true }),
        box("researcher", [-4, 10, 2, -3, 13, 3], C.darkGreen, { g: "platform", deco: true }),
        box("researcher", [2, 10, 3, 3, 13, 4], C.darkGreen, { g: "platform", deco: true }),
        box("camera trap", [0, 10, 1, 1, 11, 2], C.black, { g: "platform", deco: true }),
        beam("lift link", [-6, 0, 0, -5, 9, 1], C.lgray),
        beam("lift link", [4, 0, 0, 5, 9, 1], C.lgray),
        beam("lift link", [-6, 4, 1, 5, 5, 2], C.lgray, deco()),
        box("roots", [-6, 0, -7, 5, 0.8, 3], C.brown, deco()),
        box("lever", [-3, 0.8, 1, 3, 1.8, 3], C.red, deco()),
        box("lever", [1, 1.8, 1.2, 4, 2.4, 2.2], C.yellow, deco()),
        box("hook", [2, 16, -2, 4, 17, -1], C.yellow, deco()),
        box("vine", [3, 16, -1.5, 6, 17, -0.5], C.tan, { g: "vine", target: true }),
        box("vine", [5, 12, -1.5, 6, 16, -0.5], C.tan, { g: "vine", target: true }),
        box("vine", [5, 11, -1.5, 8, 12, -0.5], C.tan, { g: "vine", target: true }),
        box("vine", [7, 6, -1.5, 8, 11, -0.5], C.tan, { g: "vine", target: true }),
        box("vine", [6, 5, -1.5, 8, 6, -0.5], C.brightGreen, { g: "vine", target: true }),
        box("vine", [6, 4, -1, 7, 5, 3], C.brightGreen, { g: "vine", target: true })
      ]
    },

    // Book 08 — M10: the spider habitat (white frame under a bent brown beam) and the
    // snail habitat (brown arm on a gray base with a yellow shell).
    spider: {
      parts: [
        ...frameXY("spider habitat", -4, 0, 0, 7, 7, C.white, { protect: true }),
        beam("spider habitat", [-1, 1, 0, 0, 6, 1], C.white, { protect: true, deco: true }),
        beam("spider habitat", [-5, 7, -0.5, 1, 8, 1.5], C.brown, { protect: true }),
        beam("spider habitat", [-5, 3, -0.5, -4, 8, 0.5], C.brown, { protect: true }),
        beam("spider habitat", [-6, 0, -1, -4, 4, 1], C.green, { protect: true }),
        box("spider", [-0.5, 3.5, 0.2, 0.5, 4.5, 0.8], C.black, deco())
      ]
    },
    snail: {
      parts: [
        beam("snail habitat", [-2, 0, -2, 2, 1.5, 2], C.dgray, { protect: true }),
        beam("snail habitat", [-1, 1.5, -1, 1, 6, 0], C.brown, { protect: true }),
        beam("snail habitat", [0, 1.5, -1, 1, 5, 0], C.lime, { protect: true, deco: true }),
        cyl("snail", [0.5, 6, -0.5], 1.6, 0.6, C.yellow, deco()),
        box("snail", [-1, 6.3, -1, 0, 7, 0], C.orange, deco())
      ]
    },

    // Book 09 — M11: a carved brown stump with a flower garden on top; the root cover on the
    // front is a studded brown panel with a red bar along its top.
    window: {
      groups: { cover: { pivot: [0, 0, 5] } },
      parts: [
        box("stump", [-4, 0, -4, 4, 9, 4], C.brown),
        box("roots", [-4.6, 0, -4.6, -3, 6, -2], 0x4a2a17, deco()),
        box("roots", [-4.6, 0, 2, -3, 5, 4.4], 0x4a2a17, deco()),
        box("stump top", [-4.5, 9, -4.5, 4.5, 9.6, 4.5], C.green, deco()),
        cyl("plant", [1, 9.6, -1], 0.6, 4, C.green, deco()),
        ball("flower", [1, 14.2, -1], 1.2, C.orange), ball("flower", [-2, 11.5, 1], 1, 0xb48ad3),
        ball("flower", [-1, 12.6, -2], 0.8, C.pink), ball("flower", [3, 11, 2], 0.7, C.yellow),
        box("seed", [-8, 6, -1, -5, 8, 1], C.tan, deco()),
        box("seed holder", [-5, 7, -0.5, -4, 9, 0.5], C.red, deco()),
        box("root cover", [-4, 0, 4, 4, 8, 5], C.brown, { g: "cover", target: true }),
        box("root cover", [-3.6, 0.4, 5, 3.6, 7.4, 5.3], 0x7a4a2a, { g: "cover", deco: true }),
        box("red top bar", [-4, 7.4, 5, 6.5, 8.4, 6], C.red, { g: "cover", target: true }),
        box("sign", [1, 5, 5.3, 3, 7, 5.5], C.black, { g: "cover", deco: true })
      ]
    },

    // Book 10 — M12: a bent tan tree on a round green base with two leafy tops, a red ring
    // support tie around the trunk, the tan cane lying on the mat, and a gray post.
    elder: {
      groups: { cane: { pivot: [-3, 1.6, 3] } },
      parts: [
        cyl("base", [0, 0, 0], 4.5, 0.8, C.green),
        box("tree", [-1, 0.8, -1, 1, 8, 1], C.tan),
        box("tree", [-0.5, 8, -1, 1.5, 14, 1], C.tan),
        box("tree", [0.5, 14, -1, 2.5, 18, 1], C.tan, deco()),
        box("tree", [-2.5, 10, -1, -0.5, 16, 1], C.tan, deco()),
        ball("leaves", [1.5, 19, 0], 3, C.brightGreen), ball("leaves", [-2, 17, 0], 2.4, C.green),
        ...arcXY("support tie", 0, 6, 1.6, 4.4, 200, 520, C.red, 22, 0.9),
        box("chain", [2.6, 3, 0, 3, 9, 0.4], C.lgray, deco()),
        box("post", [5, 0, 4, 12, 1, 5], C.lgray, deco()),
        box("post", [11, 0, 3, 13, 2, 5], C.red, deco()),
        box("cane", [-9, 1, 2, -3, 2.2, 4], C.tan, { g: "cane", target: true }),
        box("cane", [-3, 1, 2, -2, 2.2, 4], C.red, { g: "cane", target: true }),
        box("string", [-2, 0.6, 2.8, 0, 0.9, 3.2], C.brown, deco())
      ]
    },

    // Books 11-13 — interchangeable models that plug into a dark gray dock frame.
    keystone: {
      parts: [
        ...dock(),
        ...cage(),
        box("restoration platform", [-4, 3, -3, 4, 4, 3], C.lgray, { g: "plat" }),
        ...[[-5, -4], [4, -4], [-5, 3], [4, 3]].flatMap(([x, z]) => [
          beam("tree arm", [x, 8, z, x + 1, 12, z + 1], C.brown, { g: "trees", deco: true }),
          ball("young tree", [x + 0.5, 12.6, z + 0.5], 1.4, C.brightGreen, { g: "trees" })
        ])
      ]
    },
    replant: {
      parts: [
        ...dock(),
        ...cage(),
        ...[-4, -2.5, -1, 0.5, 2, 3.5].map((z) => beam("grate", [-5, 8, z, 5, 9, z + 0.6], C.brown)),
        box("soil", [-5, 1, -4, 5, 2, 4], C.darkTan, deco()),
        box("seed tube", [-1, 2, -1, 1, 8, 1], C.green, deco())
      ]
    },
    building: {
      groups: { canopy: { pivot: [0, 9.3, -1] } },
      parts: [
        ...dock(),
        box("building", [-6, 0, -5, 6, 9, 5], C.lime),
        box("wall", [-6.2, 1, -4, -6, 8, 4], C.tan, deco()),
        ...[-3, 0, 3].map((z) => box("window", [-6.4, 3, z - 1, -6.2, 6, z + 1], 0xbfe3c0, deco())),
        box("compost hatch", [1, 0.5, 5, 5, 3.5, 5.3], C.white, deco()),
        box("roof garden", [-6, 9, -5, 0, 10, 0], C.lime, deco()),
        box("garden skylight", [0, 9, -4, 6, 9.6, 4], C.black, deco()),
        box("nesting canopy", [-6, 9, 0, 1, 9.6, 7], C.red, { g: "canopy", target: true }),
        box("bird", [3, 9.6, 1, 4, 10.6, 2], C.azure, deco()),
        ball("handle", [7, 6, 2], 0.7, C.red), ball("handle", [7, 3, 3], 0.7, C.red)
      ]
    }
  };

  // M04 loop: a tan chain arch on top-back of a nest section
  function loop(group, c, katydid) {
    const o = katydid ? { g: group, protect: true } : { g: group, target: true };
    const name = katydid ? "katydid" : "leaf loop";
    return [
      box(name, [c - 2, 3, -2, c - 1.6, 12, -1.6], C.tan, o),
      box(name, [c + 1.6, 3, -2, c + 2, 12, -1.6], C.tan, o),
      box(name, [c - 2, 11.6, -2, c + 2, 12, -1.6], C.tan, o)
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
    // where each model sits (rot = degrees around the vertical axis), from the Field Setup Guide
    place: [
      { model: "drone", x: 62, z: 136, rot: 0 },
      { model: "seeds", x: 93, z: 74, rot: -90 },
      { model: "rock", x: 16, z: 58, rot: 0 },
      { model: "leaves", x: 26, z: 20, rot: 0 },
      { model: "roots", x: 60, z: 6, rot: 0 },
      { model: "tree", x: 80, z: 8, rot: 0 },
      { model: "spider", x: 116, z: 14, rot: 0 },
      { model: "snail", x: 161, z: 45, rot: 0 },
      { model: "nest", x: 226, z: 8, rot: 0 },
      { model: "window", x: 206, z: 66, rot: 90 },
      { model: "elder", x: 280, z: 44, rot: 0 },
      { model: "keystone", dock: "farm" },
      { model: "replant", dock: "city" },
      { model: "building", dock: "mine" }
    ]
  };

  /* ---------- missions ----------
     book: the official building-instruction book for the model.
     start: robot's front-center position and heading in world coords
            (heading 0 = east, 90 = north, 180 = west).
     checks: zones are in the mission model's local coords.
     dock: dock missions put their own model on the farm dock (center of the
           field, easy to reach) for the test; teams choose the dock in real matches. */

  const MISSIONS = [
    {
      id: "M01", name: "Drone Survey", color: "#38bdf8", icon: "fa-helicopter", noTouch: true, book: "01",
      goal: "Push the red scan marker along the mat to launch the drone.", points: "20, +10 bonus",
      model: "drone", start: { x: 46, z: 128, h: 0 },
      checks: [{
        type: "push", label: "Launch the drone", target: "scan marker", zone: [-3, 0, -2, -1.5, 2.4, 2],
        done: "The axles bend up and the drone leaves the mat!",
        anim: [{ g: "marker", move: [10, 0, 0] }, { g: "drone", move: [0, 7, 0] }, { g: "railA", rot: { axis: "z", deg: 8, pivot: [2, 0.4, 0] } }, { g: "railB", rot: { axis: "z", deg: -8, pivot: [98, 0.4, 0] } }],
        robot: [10, -4]
      }]
    },
    {
      id: "M02", name: "Exploding Seeds", color: "#f59e0b", icon: "fa-seedling", book: "02",
      goal: "Reach through the tan seed ring and pull the seed off the stalk.", points: "10 each seed",
      model: "seeds", start: { x: 75, z: 74, h: 0 },
      checks: [{
        type: "hook", label: "Catch the seed", target: "seed ring", zone: [-1, 8, 1, 1, 10, 3.4],
        done: "Your attachment goes through the ring — the seed comes off!",
        anim: [{ g: "seed", move: [0, -4, 6] }], robot: [-6]
      }]
    },
    {
      id: "M03", name: "Flip the Rock", color: "#a78bfa", icon: "fa-mountain", book: "03",
      goal: "Hook a red handle from above and pull to flip the rock.", points: "20, +10 bonus",
      model: "rock", start: { x: 16, z: 76, h: 90 },
      checks: [{
        type: "pull", label: "Flip the rock", target: "red handle",
        zones: [[-4, 8, -5, -3, 11, -3], [3, 8, -5, 4, 11, -3]],
        done: "You pulled the handle — the rock flips and the flag goes down!",
        anim: [{ g: "rock", rot: { axis: "x", deg: 180 } }, { g: "flag", rot: { axis: "x", deg: 80, pivot: [5.5, 0, 2.5] } }], robot: [-4]
      }]
    },
    {
      id: "M04", name: "Lucky Leaves", color: "#22c55e", icon: "fa-leaf", noTouch: true, book: "04",
      goal: "Hook a leaf's tan loop and lift it out — don't touch the katydid.", points: "10, +20 bonus",
      model: "leaves", start: { x: 32, z: 38, h: 90 },
      checks: [
        {
          type: "hook", label: "Take a leaf", target: "leaf loop",
          zones: [[-1.6, 5, -3, 1.6, 11.6, -1.6], [4.4, 5, -3, 7.6, 11.6, -1.6]], groups: ["leafM", "leafR"],
          done: "You hooked a leaf loop and pulled the leaf out of the nest!",
          anim: [{ g: "$hit", move: [0, 3, 8] }], robot: [-8]
        },
        { type: "avoid", label: "Katydid", done: "The katydid didn't move." }
      ],
      note: "In real matches the referee mixes up where the leaves and the katydid go."
    },
    {
      id: "M05", name: "Reaching Roots", color: "#b45309", icon: "fa-tree", noTouch: true, book: "05",
      goal: "Hit a red handle quickly so the root swings out.", points: "10 or 20",
      model: "roots", start: { x: 57, z: 27, h: 90 },
      checks: [{
        type: "push", label: "Swing the root", target: "red handle",
        zones: [[-6, 10.5, 6, -5, 12.5, 7.5], [-3, 7.5, 6, -2, 9.5, 7.5]],
        done: "The arm swings and the root reaches across the boundary!",
        anim: [{ g: "arm", rot: { axis: "y", deg: -55 } }], robot: [1, -5]
      }]
    },
    {
      id: "M06", name: "Leafcutter Frenzy", color: "#ef4444", icon: "fa-bug", book: "06",
      goal: "Gently push the ant along its rack back into the nest.", points: "10 each fragment",
      model: "nest", start: { x: 226, z: 34, h: 90 },
      checks: [{
        type: "push", label: "Ant home", target: "ant", zone: [-2, 0, 12, 1, 3, 13.5],
        done: "The ant slides into the nest with its leaves!",
        anim: [{ g: "ant", move: [0, 0, -7] }], robot: [7, -4]
      }]
    },
    {
      id: "M07", name: "Humongous Fungus", color: "#e5e7eb", icon: "fa-circle-nodes", noTouch: true, teamwork: true, book: "06",
      goal: "Lower a hook behind the red lever handle and pull it toward you.", points: "20, +10 bonus",
      model: "nest", start: { x: 239, z: 27, h: 90 },
      checks: [{
        type: "pull", label: "Extend the mycelium", target: "red handle", zone: [11, 0.5, 2, 15, 2.5, 4],
        done: "You pulled the lever — the mycelium swings out!",
        anim: [{ g: "lever", move: [0, 0, 3] }, { g: "myc", rot: { axis: "x", deg: 70, pivot: [10, 10, -2] } }], robot: [-4]
      }]
    },
    {
      id: "M08", name: "Tangled", color: "#16a34a", icon: "fa-wind", book: "07",
      goal: "Lift the bottom of the vine so it comes off its hook.", points: "30",
      model: "tree", start: { x: 86, z: 25, h: 90 },
      checks: [{
        type: "lift", label: "Untangle the vine", target: "vine", zone: [6, 2, 0, 7, 4, 3], need: 2,
        done: "The vine comes off its hook and falls to the mat!",
        anim: [{ g: "vine", move: [1, -3, 3] }]
      }]
    },
    {
      id: "M09", name: "Research Platform", color: "#0ea5e9", icon: "fa-binoculars", noTouch: true, book: "07",
      goal: "Get under the research platform and lift it up the tree.", points: "10 + 10 + 10",
      model: "tree", start: { x: 80, z: 29, h: 90 },
      checks: [{
        type: "lift", label: "Raise the platform", target: "research platform", zone: [-7, 6, 4, 6, 9, 7], need: 3,
        done: "The platform goes up the tree!",
        anim: [{ g: "platform", move: [0, 3.5, 0] }]
      }]
    },
    {
      id: "M10", name: "Fragile Microhabitats", color: "#facc15", icon: "fa-spider", noTouch: true, book: "08",
      goal: "Drive past the spider and snail homes without touching them.", points: "10 + 10",
      model: "spider", start: { x: 90, z: 30, h: 0 }, driveTo: 85, allowEmpty: true,
      checks: [{ type: "avoid", label: "Drive past safely", done: "You drove past without touching the habitats!" }]
    },
    {
      id: "M11", name: "Window to the Past", color: "#dc2626", icon: "fa-door-open", book: "09",
      goal: "Hook behind the end of the red top bar and pull the root cover down.", points: "20",
      model: "window", start: { x: 226, z: 66, h: 180 },
      checks: [{
        type: "pull", label: "Open the window", target: "red top bar", zone: [4, 7, 3, 6.5, 8.4, 5],
        done: "The root cover folds down onto the mat!",
        anim: [{ g: "cover", rot: { axis: "x", deg: 88 } }], robot: [-4]
      }]
    },
    {
      id: "M12", name: "Forest Elder", color: "#a16207", icon: "fa-tree", noTouch: true, book: "10",
      goal: "Slide under the tan cane and lift it up against the tree.", points: "20 + 10",
      model: "elder", start: { x: 280, z: 62, h: 90 },
      checks: [{
        type: "lift", label: "Raise the cane", target: "cane", zone: [-9, 0, 2, -5, 1, 4], need: 3,
        done: "The cane goes up against the tree!",
        anim: [{ g: "cane", rot: { axis: "z", deg: -70 } }]
      }]
    },
    {
      id: "M13", name: "Keystone Species", color: "#ec4899", icon: "fa-paw", dock: true, book: "11",
      goal: "Carry your animal over the cage and drop it on the platform inside.", points: "30",
      model: "keystone", start: { x: 147, z: 82, h: 90 },
      checks: [{
        type: "deliver", label: "Deliver the animal", zone: [-5, 4, -4, 5, 12, 4], min: 2, color: 0xec4899,
        done: "Your animal lands on the platform and the young trees go up!",
        anim: [{ g: "plat", move: [0, -1, 0] }, { g: "trees", move: [0, 2, 0] }]
      }]
    },
    {
      id: "M14", name: "Seeds of Renewal", color: "#84cc16", icon: "fa-hand-holding-droplet", dock: true, book: "12",
      goal: "Reach over the station and drop seeds through the brown grate.", points: "5 each, +5 each",
      model: "replant", start: { x: 147, z: 82, h: 90 },
      checks: [{
        type: "deliver", label: "Plant the seeds", zone: [-5, 9, -4, 5, 13, 4], min: 2, color: 0x6b3f22,
        done: "The seeds drop into the station!"
      }]
    },
    {
      id: "M15", name: "Biocentric Architecture", color: "#14b8a6", icon: "fa-building", noTouch: true, dock: true, book: "13",
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

  const BOOK_URL = (n) => "https://firstinspires.blob.core.windows.net/fll/challenge/2026-27/fll-challenge-bioglow-bi-enus-book-" + n + ".pdf";

  return { LINKS, MODELS, FIELD, DOCKS, MISSIONS, RULES, BOOK_URL };

})();
