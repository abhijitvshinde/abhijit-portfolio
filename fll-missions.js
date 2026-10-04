/* ==========================================
   FLL ATTACHMENT LAB — season data
   2026-27 FIRST LEGO League Challenge: BIOGLOW

   Each mission has a short goal (our own words) and a simplified
   3D test model ("sim") for the builder. Units are LEGO studs:
   the robot's front is at x = 0 and it drives toward +x; y is up;
   +z is the robot's right. Boxes are [x0, y0, z0, x1, y1, z1].

   The test models are simplified on purpose. They teach height,
   reach and motion; the real mission models and the official
   Robot Game Rulebook + Challenge Updates are the real authority.
========================================== */

window.FLL_DATA = (function () {

  const LINKS = {
    missionsVideo: "https://youtu.be/uhZZ8O1StiQ",
    fieldSetupVideo: "https://youtu.be/wDan0826cn0",
    rulebook: "https://firstinspires.blob.core.windows.net/fll/challenge/2026-27/fll-challenge-bioglow-rgr.pdf",
    updates: "https://firstinspires.blob.core.windows.net/fll/challenge/2026-27/fll-challenge-bioglow-updates.pdf",
    materials: "https://www.firstinspires.org/resources/library/fll/season-materials",
    season: "https://www.firstinspires.org/programs/fll/game-and-season"
  };

  const BROWN = 0x78350f;
  const GREEN = 0x16a34a;
  const GRAY = 0x9ca3af;

  const MISSIONS = [
    {
      id: "M01", name: "Drone Survey", color: "#38bdf8", icon: "fa-helicopter",
      goal: "Push the red scan marker UP to launch the drone.", points: "20, +10 bonus", noTouch: true,
      sim: {
        solids: [
          { name: "base", box: [12, 0, -6, 26, 1, 6], color: GRAY },
          { name: "drone tower", box: [22, 1, -6, 23, 16, -5], color: 0x111827 },
          { name: "drone tower", box: [22, 1, 5, 23, 16, 6], color: 0x111827 },
          { name: "drone", box: [19, 15, -3, 25, 16, 3], color: 0x38bdf8, deco: true },
          { name: "scan marker", box: [14, 3, -2, 17, 5, 2], color: 0xef4444, target: true },
          { name: "scan marker", box: [15, 1, -1, 16, 3, 1], color: 0x7f1d1d, deco: true }
        ],
        checks: [{ type: "lift", label: "Launch the drone", target: "scan marker", zone: [14, 2, -2, 17, 3, 2], need: 2, done: "The scan marker goes up and the drone launches!" }]
      }
    },
    {
      id: "M02", name: "Exploding Seeds", color: "#f59e0b", icon: "fa-seedling",
      goal: "Catch a seed ring and pull the seed off the stalk.", points: "10 each seed",
      sim: {
        solids: [
          { name: "base", box: [18, 0, -3, 23, 1, 3], color: GRAY },
          { name: "stalk", box: [20, 1, -1, 21, 15, 1], color: 0x84cc16 },
          { name: "branch", box: [17, 11, -1, 20, 12, 1], color: 0x84cc16 },
          { name: "seed ring", box: [16, 10, -2, 17, 11, 2], color: 0xfacc15, target: true },
          { name: "seed ring", box: [16, 7, -2, 17, 8, 2], color: 0xfacc15, target: true },
          { name: "seed ring", box: [16, 8, -2, 17, 10, -1], color: 0xfacc15, target: true },
          { name: "seed ring", box: [16, 8, 1, 17, 10, 2], color: 0xfacc15, target: true },
          { name: "seed ring", box: [16, 4, -1, 17, 7, 1], color: 0x92400e, deco: true }
        ],
        checks: [{ type: "hook", label: "Catch the seed", target: "seed ring", zone: [16, 8, -1, 17, 10, 1], done: "Your attachment goes through the ring — the seed comes off!" }]
      }
    },
    {
      id: "M03", name: "Flip the Rock", color: "#a78bfa", icon: "fa-mountain",
      goal: "Reach over the rock and push the research flag DOWN.", points: "20, +10 bonus",
      sim: {
        solids: [
          { name: "rock", box: [14, 0, -4, 22, 5, 4], color: 0x78716c },
          { name: "research flag", box: [17, 5, -1, 18, 9, 1], color: 0xef4444, target: true },
          { name: "research flag", box: [18, 7, -0.2, 20, 9, 0.2], color: 0xef4444, deco: true }
        ],
        checks: [{ type: "press", label: "Flag down", target: "research flag", zone: [16, 7, -2, 19, 10, 2], done: "The arm comes down and the flag goes down!" }]
      }
    },
    {
      id: "M04", name: "Lucky Leaves", color: "#22c55e", icon: "fa-leaf",
      goal: "Lift a leaf out of the nest without touching the katydid.", points: "10, +20 bonus", noTouch: true,
      sim: {
        solids: [
          { name: "nest", box: [16, 0, -5, 22, 4, 5], color: GREEN },
          { name: "leaf", box: [16, 5, 1, 22, 6, 4], color: 0x4ade80, target: true },
          { name: "leaf", box: [18, 4, 2, 19, 5, 3], color: 0x15803d, deco: true },
          { name: "katydid", box: [18, 4, -2, 20, 6, 0], color: 0x65a30d, protect: true }
        ],
        checks: [
          { type: "lift", label: "Lift the leaf", target: "leaf", zone: [16, 4, 1, 22, 5, 4], need: 1.5, done: "The leaf comes out of the nest!" },
          { type: "avoid", label: "Katydid", done: "You didn't touch the katydid." }
        ]
      }
    },
    {
      id: "M05", name: "Reaching Roots", color: "#b45309", icon: "fa-tree",
      goal: "Push the high root lever to stretch the root.", points: "10 or 20", noTouch: true,
      sim: {
        solids: [
          { name: "root frame", box: [16, 0, -4, 22, 10, 4], color: BROWN },
          { name: "plant root", box: [15, 11, -1, 16, 14, 1], color: 0xb45309, target: true },
          { name: "plant root", box: [16, 10, -1, 17, 14, 1], color: 0xb45309, deco: true }
        ],
        checks: [{ type: "push", label: "Push the root", target: "plant root", zone: [14, 11, -1, 15.5, 14, 1], move: 2, done: "You pushed the root lever!" }]
      }
    },
    {
      id: "M06", name: "Leafcutter Frenzy", color: "#ef4444", icon: "fa-bug",
      goal: "Gently push the ant along the mat into its nest.", points: "10 each fragment",
      sim: {
        solids: [
          { name: "nest", box: [18, 0, -5, 24, 6, 5], color: 0xd6a26b },
          { name: "ant", box: [15, 0, -1, 17, 1, 1], color: 0xb91c1c, target: true },
          { name: "leaf", box: [19, 6, -1, 20, 9, 0], color: 0xfb923c, deco: true },
          { name: "leaf", box: [21, 6, 1, 22, 9, 2], color: 0x22c55e, deco: true }
        ],
        checks: [{ type: "push", label: "Push the ant", target: "ant", zone: [14, 0, -1, 15.5, 1, 1], move: 2, done: "The ant goes into the nest!" }]
      }
    },
    {
      id: "M07", name: "Humongous Fungus", color: "#e5e7eb", icon: "fa-circle-nodes",
      goal: "Get under the mycelium and lift it up.", points: "20, +10 bonus", noTouch: true, teamwork: true,
      sim: {
        solids: [
          { name: "fungus base", box: [16, 0, -4, 24, 3, 4], color: 0x57534e },
          { name: "mycelium", box: [15, 3, -1, 21, 4, 1], color: 0xf5f5f4, target: true }
        ],
        checks: [{ type: "lift", label: "Lift the mycelium", target: "mycelium", zone: [15, 0, -1, 16, 3, 1], need: 1.5, done: "The mycelium stretches out!" }]
      }
    },
    {
      id: "M08", name: "Tangled", color: "#16a34a", icon: "fa-wind",
      goal: "Lift the vine up off its hook.", points: "30",
      sim: {
        solids: [
          { name: "tree", box: [20, 0, -2, 22, 16, 2], color: BROWN },
          { name: "branch", box: [17, 13, -1, 20, 14, 1], color: 0x166534 },
          { name: "vine", box: [16, 9, -1, 17, 13, 1], color: 0x22c55e, target: true }
        ],
        checks: [{ type: "lift", label: "Lift the vine", target: "vine", zone: [16, 8, -1, 17, 9, 1], need: 2, done: "The vine comes off the hook!" }]
      }
    },
    {
      id: "M09", name: "Research Platform", color: "#0ea5e9", icon: "fa-binoculars",
      goal: "Lift the research platform up the tree.", points: "10 + 10 + 10", noTouch: true,
      sim: {
        solids: [
          { name: "tree", box: [21, 0, -2, 23, 18, 2], color: BROWN },
          { name: "research platform", box: [15, 8, -4, 21, 9, 4], color: 0xd6a26b, target: true },
          { name: "camera trap", box: [17, 9, -1, 18, 10, 1], color: 0x111827, deco: true }
        ],
        checks: [{ type: "lift", label: "Raise the platform", target: "research platform", zone: [15, 6, -4, 21, 8, 4], need: 3, done: "The platform goes up!" }]
      }
    },
    {
      id: "M10", name: "Fragile Microhabitats", color: "#facc15", icon: "fa-spider",
      goal: "Drive past without touching the spider or snail homes.", points: "10 + 10", noTouch: true,
      sim: {
        allowEmpty: true,
        driveTo: 30,
        solids: [
          { name: "spider habitat", box: [14, 0, -19, 22, 10, -11], color: GRAY, protect: true },
          { name: "snail habitat", box: [14, 0, 11, 22, 8, 17], color: 0xfacc15, protect: true }
        ],
        checks: [{ type: "avoid", label: "Drive past safely", done: "You drove past without touching the habitats!" }]
      }
    },
    {
      id: "M11", name: "Window to the Past", color: "#dc2626", icon: "fa-door-open",
      goal: "Push the TOP of the root cover so it falls open.", points: "20",
      sim: {
        solids: [
          { name: "tree base", box: [17, 0, -5, 24, 12, 5], color: BROWN },
          { name: "root cover", box: [15, 1, -4, 16, 11, 4], color: 0xdc2626, target: true }
        ],
        checks: [{ type: "push", label: "Open the window", target: "root cover", zone: [14, 9, -4, 15.5, 11, 4], move: 1, tip: true, done: "The root cover falls open!" }]
      }
    },
    {
      id: "M12", name: "Forest Elder", color: "#a16207", icon: "fa-tree",
      goal: "Slide under the cane and lift it up against the tree.", points: "20 + 10", noTouch: true,
      sim: {
        solids: [
          { name: "old tree", box: [21, 0, -3, 24, 16, 3], color: BROWN },
          { name: "cane", box: [14, 2, -1, 20, 3, 1], color: 0xa16207, target: true }
        ],
        checks: [{ type: "lift", label: "Raise the cane", target: "cane", zone: [14, 1, -1, 17, 2, 1], need: 3, done: "The cane goes up against the tree!" }]
      }
    },
    {
      id: "M13", name: "Keystone Species", color: "#ec4899", icon: "fa-paw",
      goal: "Carry your animal over the platform and drop it there.", points: "30", dock: true,
      sim: {
        solids: [
          { name: "restoration platform", box: [16, 0, -4, 22, 4, 4], color: GREEN },
          { name: "young trees", box: [22, 0, -4, 24, 9, 4], color: 0x15803d }
        ],
        checks: [{ type: "deliver", label: "Deliver the animal", zone: [16, 4, -4, 22, 9, 4], min: 2, color: 0xec4899, done: "Your animal lands on the platform!" }]
      }
    },
    {
      id: "M14", name: "Seeds of Renewal", color: "#84cc16", icon: "fa-hand-holding-droplet",
      goal: "Reach over the wall and drop seeds into the station.", points: "5 each, +5 each", dock: true,
      sim: {
        solids: [
          { name: "station wall", box: [16, 0, -4, 17, 6, 4], color: 0x92400e },
          { name: "station wall", box: [21, 0, -4, 22, 6, 4], color: 0x92400e },
          { name: "station wall", box: [17, 0, -4, 21, 6, -3], color: 0x92400e },
          { name: "station wall", box: [17, 0, 3, 21, 6, 4], color: 0x92400e },
          { name: "soil", box: [17, 0, -3, 21, 1, 3], color: 0x57534e }
        ],
        checks: [{ type: "deliver", label: "Drop the seeds", zone: [17, 6, -3, 21, 10, 3], min: 2, color: 0x92400e, done: "The seeds drop into the station!" }]
      }
    },
    {
      id: "M15", name: "Biocentric Architecture", color: "#14b8a6", icon: "fa-building",
      goal: "Get under the nesting canopy and lift it up.", points: "10 each, +10 bonus", noTouch: true, dock: true,
      sim: {
        solids: [
          { name: "building", box: [16, 0, -6, 26, 10, 6], color: 0x14b8a6 },
          { name: "nesting canopy", box: [14, 10, -5, 20, 11, 5], color: 0xf59e0b, target: true }
        ],
        checks: [{ type: "lift", label: "Raise the canopy", target: "nesting canopy", zone: [14, 8, -5, 16, 10, 5], need: 2, done: "The nesting canopy goes up!" }]
      }
    }
  ];

  const RULES = [
    "A match lasts 2.5 minutes. The robot drives on its own — no remote controls.",
    "One hub, up to 4 motors. A standard SPIKE Prime set has 1 spare motor for attachments.",
    "Only LEGO pieces — no tape or glue.",
    "You can only touch the robot and swap attachments in home.",
    "Fit everything in one launch area under 12 in. tall for 20 bonus points."
  ];

  return { LINKS, MISSIONS, RULES };

})();
