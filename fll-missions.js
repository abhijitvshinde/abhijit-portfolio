/* ==========================================
   FLL ATTACHMENT LAB — season data
   2026-27 FIRST LEGO League Challenge: BIOGLOW
   Mission descriptions are written in our own kid-friendly words.
   The official Robot Game Rulebook + Challenge Updates are the
   only real authority — always check them.
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

  /* What the robot can do to a mission model */
  const ACTIONS = [
    { id: "push",    label: "Push",          icon: "fa-hand",            tip: "Move it away from the robot." },
    { id: "pull",    label: "Pull",          icon: "fa-hand-back-fist",  tip: "Drag it toward the robot." },
    { id: "lift",    label: "Lift up",       icon: "fa-arrow-up",        tip: "Raise something higher." },
    { id: "press",   label: "Press down",    icon: "fa-arrow-down",      tip: "Push something down from above." },
    { id: "flip",    label: "Flip over",     icon: "fa-rotate",          tip: "Turn something upside down." },
    { id: "spin",    label: "Spin / turn",   icon: "fa-gear",            tip: "Turn a gear, or swing around fast." },
    { id: "hook",    label: "Catch & hold",  icon: "fa-link",            tip: "Grab a loop, ring or handle." },
    { id: "collect", label: "Collect",       icon: "fa-basket-shopping", tip: "Pick up loose pieces and keep them." },
    { id: "drop",    label: "Deliver",       icon: "fa-box-open",        tip: "Carry something and leave it in a spot." },
    { id: "avoid",   label: "Stay away",     icon: "fa-ban",             tip: "Don't touch it, or barely touch it." }
  ];

  /* Attachment families kids can choose from */
  const TOOLS = [
    {
      id: "pusher", name: "Pusher / bumper", icon: "fa-square",
      good: "Pushing things forward or sideways.",
      build: "Make a flat wall from beams or a frame on the front of the robot. Wider = easier to hit the target.",
      power: "Usually no motor — the robot drives into it."
    },
    {
      id: "hook", name: "Hook", icon: "fa-link",
      good: "Catching loops, rings or handles, then pulling.",
      build: "Use an L-shaped beam or an axle sticking out. Point the hook so it slides in, then catches when the robot backs up.",
      power: "No motor if the robot drives it in. A motor helps if it has to drop down first."
    },
    {
      id: "fork", name: "Fork (two prongs)", icon: "fa-utensils",
      good: "Sliding under something or around a stalk, then lifting or pulling.",
      build: "Two long axles or thin beams side by side, with a gap a little bigger than the part you want to catch.",
      power: "No motor to slide in. Add a motor if it must lift afterwards."
    },
    {
      id: "lifter", name: "Lift arm / forklift", icon: "fa-arrow-up-from-bracket",
      good: "Raising things up — platforms, canes, vines.",
      build: "A long arm on a motor axle. Gears can make it stronger (small gear drives big gear = more power, less speed).",
      power: "Needs a motor."
    },
    {
      id: "lever", name: "Lever arm", icon: "fa-arrows-up-down",
      good: "Swinging up or down to press, flip or knock something.",
      build: "A beam on a motor that swings like a door. Test how far it needs to move — then program that angle.",
      power: "Needs a motor."
    },
    {
      id: "scoop", name: "Scoop / basket", icon: "fa-basket-shopping",
      good: "Catching and carrying loose pieces like seeds.",
      build: "Walls on three sides with an open front. Make it deep enough that pieces don't bounce out.",
      power: "No motor to carry. A motor can tip it."
    },
    {
      id: "dropper", name: "Drop box / trapdoor", icon: "fa-box-open",
      good: "Carrying something and letting it go in an exact spot.",
      build: "A box with a door that opens — by a motor, or by bumping into the model (a 'trigger').",
      power: "Motor, or no motor if the model bumps the trigger."
    },
    {
      id: "spinner", name: "Spinner", icon: "fa-fan",
      good: "Turning gears, or quick swinging moves.",
      build: "An arm or wheel on a motor axle, or let the whole robot turn fast in place.",
      power: "Motor, or use the robot's own turning."
    },
    {
      id: "guide", name: "Wall guide / aligner", icon: "fa-ruler-combined",
      good: "Lining the robot up the same way every time.",
      build: "A bar or bumper that touches the wall or a model so the robot always stops in the same spot.",
      power: "No motor. Works together with any other attachment!"
    }
  ];

  /* The 15 BIOGLOW missions (own words; check the rulebook for exact scoring) */
  const MISSIONS = [
    {
      id: "M01", name: "Drone Survey", color: "#38bdf8", icon: "fa-helicopter",
      story: "A drone flies above the rainforest to make a 3D map. Help launch it!",
      goal: "Get the drone off the mat. Bonus: flip the LiDAR map over so the scan marker lands in the survey area.",
      points: "20, +10 bonus",
      noTouch: true,
      parts: ["Drone", "LiDAR map", "Scan marker"],
      actions: { must: [["lift", "push"]], ok: ["flip"] },
      hints: [
        "Watch the video. Which piece makes the drone go up when it moves?",
        "Find the red scan marker. Which way does it have to move for the drone to rise?",
        "Moving the scan marker upward raises the drone. Something also has to flip for the bonus."
      ],
      tools: { best: ["lever", "lifter"], ok: ["pusher", "fork", "guide"] },
      think: [
        "How high does the scan marker need to move?",
        "Can one attachment launch the drone AND flip the map, or do you need two moves?"
      ],
      watchOut: "No-touch rule: your attachment can't still be touching this model when the match ends."
    },
    {
      id: "M02", name: "Exploding Seeds", color: "#f59e0b", icon: "fa-seedling",
      story: "Some trees shoot their seeds far away. Help the seed pod release its seeds!",
      goal: "Get the seeds off the stalk. Every seed that is no longer touching the stalk scores.",
      points: "10 each seed",
      parts: ["Stalk", "Seeds (with rings)"],
      links: "Seeds you collect can be planted later in Mission 14!",
      actions: { must: [["pull", "hook", "lift"]], ok: ["collect", "push"] },
      hints: [
        "Look at how each seed hangs on the stalk. What is holding it?",
        "Each seed has a ring. What could you do to a ring to free the seed?",
        "Catch the ring and pull or lift it away. Do you want to keep the seed for later?"
      ],
      tools: { best: ["fork", "hook"], ok: ["scoop", "lever", "guide"] },
      think: [
        "Do you want the seeds to fall on the mat, or catch them for Mission 14?",
        "How can you catch all the seeds in one trip?"
      ]
    },
    {
      id: "M03", name: "Flip the Rock", color: "#a78bfa", icon: "fa-mountain",
      story: "Animals live under rocks. Flip the rock to peek underneath — then put it back the way you found it.",
      goal: "Get the research flag down. Bonus: the rock ends up back in its starting position.",
      points: "20, +10 bonus",
      parts: ["Rock", "Research flag", "Red handles"],
      actions: { must: [["press", "pull", "flip"]], ok: ["hook", "push"] },
      hints: [
        "Score points by getting the flag down. What could make it go down?",
        "You could press the flag down, or flip the rock using its red handles.",
        "For the bonus, the rock has to go all the way over and come back. Try catching a handle and pulling."
      ],
      tools: { best: ["hook", "lever"], ok: ["spinner", "pusher", "guide"] },
      think: [
        "Is the easy 20 points enough, or do you want to try the bonus?",
        "This model is close to home. Could it be a quick first mission?"
      ]
    },
    {
      id: "M04", name: "Lucky Leaves", color: "#22c55e", icon: "fa-leaf",
      story: "A katydid hides among the leaves. Take the leaves without scaring it away!",
      goal: "Remove leaves from the nest. Bonus: take the second leaf while the katydid stays in its starting spot.",
      points: "10, +20 bonus",
      noTouch: true,
      parts: ["Nest", "Two leaves", "Katydid"],
      actions: { must: [["lift", "hook"], ["avoid"]], ok: ["pull"] },
      hints: [
        "Two things matter here: the leaves AND the katydid.",
        "The leaves need to come out of the nest. The katydid needs to stay where it is.",
        "Lift or hook the leaves out, and stay away from the katydid."
      ],
      tools: { best: ["fork", "hook"], ok: ["lever", "lifter", "guide"] },
      think: [
        "The leaves are mixed up before each match! Can your attachment work wherever they are?",
        "How can you make sure your attachment never bumps the katydid?"
      ],
      watchOut: "If the katydid ends up completely outside the leaf area, this mission scores zero. Also a no-touch mission. (See Challenge Update 01.)"
    },
    {
      id: "M05", name: "Reaching Roots", color: "#b45309", icon: "fa-tree",
      story: "Plant roots stretch out to find food and friends. Help this root cross the forest boundary.",
      goal: "Extend the plant root — partly for some points, all the way for more.",
      points: "10 partly, 20 fully",
      noTouch: true,
      parts: ["Plant root"],
      links: "If your root is fully extended, it can team up with the other table's Mission 07!",
      actions: { must: [["push", "spin"]], ok: [] },
      hints: [
        "Watch how the root moves in the video. Does it slide, swing or roll?",
        "It needs a quick shove to stretch all the way out.",
        "A fast push or a quick turn of the robot can swing it all the way."
      ],
      tools: { best: ["spinner", "pusher", "lever"], ok: ["guide"] },
      think: [
        "Does speed matter? Try slow and fast and compare.",
        "After this mission, can the robot head straight home?"
      ],
      watchOut: "No-touch rule: don't leave your attachment resting on the root."
    },
    {
      id: "M06", name: "Leafcutter Frenzy", color: "#ef4444", icon: "fa-bug",
      story: "Leafcutter ants carry leaf bits home. Guide an ant back to its nest — but don't spill the leaves!",
      goal: "The ant touches the nest, and leaf fragments stay inside the nest.",
      points: "10 each fragment",
      parts: ["Ant", "Nest", "Leaf fragments", "Big gear"],
      actions: { must: [["push", "spin"]], ok: [] },
      hints: [
        "What has to move: the ant, the leaves, or the nest?",
        "The ant has to go into the nest. There's also a gear connected to it.",
        "Gently push the ant in, or turn the gear. If you go too fast, the leaves fly out!"
      ],
      tools: { best: ["pusher", "spinner"], ok: ["lever", "guide"] },
      think: [
        "How slow is slow enough? Test different speeds.",
        "Could something above the leaves stop them from flying out?"
      ]
    },
    {
      id: "M07", name: "Humongous Fungus", color: "#e5e7eb", icon: "fa-circle-nodes",
      story: "Fungus threads (mycelium) connect the forest underground. Stretch them to reach a neighbor's tree root!",
      goal: "Extend the mycelium all the way. Bonus: connect with the other team's fully extended root.",
      points: "20, +10 bonus",
      noTouch: true,
      teamwork: true,
      parts: ["Mycelium", "Lever"],
      links: "Teamwork mission! It works with Mission 05 on the other team's table.",
      actions: { must: [["pull", "lift"]], ok: ["hook", "push"] },
      hints: [
        "Find the part that makes the mycelium stretch out.",
        "There's a lever. Which way does it have to move?",
        "Pull the lever (or lift the mycelium) to stretch it out."
      ],
      tools: { best: ["hook", "lever"], ok: ["lifter", "fork", "guide"] },
      think: [
        "Talk to the other team at your event! You both get the bonus if you both extend.",
        "Is there a chain or part your attachment could snag on?"
      ],
      watchOut: "No-touch rule. The bonus can't be scored in remote events or without another team."
    },
    {
      id: "M08", name: "Tangled", color: "#16a34a", icon: "fa-wind",
      story: "Vines have wrapped around a tree. Untangle them so the tree can grow!",
      goal: "Get the vine off the tree and touching the mat.",
      points: "30",
      parts: ["Tree", "Vine"],
      actions: { must: [["lift", "hook"]], ok: ["pull", "push"] },
      hints: [
        "How is the vine stuck on the tree?",
        "It's hanging on a hook. What move gets something off a hook?",
        "Lift the vine up and off, then let it drop to the mat."
      ],
      tools: { best: ["lifter", "fork", "hook"], ok: ["lever", "guide"] },
      think: [
        "Where will the vine land? Could it block your robot's path later?",
        "This one is worth 30 points with no bonus — is it a good early mission?"
      ]
    },
    {
      id: "M09", name: "Research Platform", color: "#0ea5e9", icon: "fa-binoculars",
      story: "Scientists study animals high in the treetops. Help them set up their equipment!",
      goal: "Raise the research platform, deploy the camera trap, and get the seed off the tree.",
      points: "10 + 10 + 10",
      noTouch: true,
      parts: ["Research platform", "Camera trap", "Seed"],
      links: "The seed can be planted in Mission 14.",
      actions: { must: [["lift"]], ok: ["collect", "push"] },
      hints: [
        "The platform starts low. Where does it need to go?",
        "Lifting the platform might set off other things too — watch the video closely!",
        "Lift the platform all the way up. Then think about catching the seed."
      ],
      tools: { best: ["lifter", "fork"], ok: ["scoop", "lever", "guide"] },
      think: [
        "The platform is heavy. How can you make your lift arm stronger? (Hint: gears!)",
        "How can you catch the seed when it comes off?"
      ],
      watchOut: "No-touch rule: move your attachment away from the model after lifting."
    },
    {
      id: "M10", name: "Fragile Microhabitats", color: "#facc15", icon: "fa-spider",
      story: "Tiny creatures live here. Be a careful explorer and don't damage their homes!",
      goal: "Keep the spider habitat and the snail habitat in their starting positions.",
      points: "10 + 10",
      noTouch: true,
      noTool: true,
      parts: ["Spider habitat", "Snail habitat"],
      actions: { must: [["avoid"]], ok: [] },
      hints: [
        "Do you have to do anything to these habitats to score?",
        "You score when they stay exactly where they started.",
        "Stay away! Plan robot paths that never bump them."
      ],
      tools: { best: ["guide"], ok: [] },
      think: [
        "Which of your other missions drive close to these habitats?",
        "Do any of your attachments stick out far enough to bump them while turning?"
      ],
      watchOut: "These points are 'free' at the start — you lose them only if your robot moves the habitats."
    },
    {
      id: "M11", name: "Window to the Past", color: "#dc2626", icon: "fa-door-open",
      story: "Tree roots tell the rainforest's history. Open the root window and take a look!",
      goal: "Get the root cover down so it's touching the mat.",
      points: "20",
      parts: ["Root cover"],
      actions: { must: [["pull", "push"]], ok: ["hook", "press", "collect"] },
      hints: [
        "The root cover works like a door. Which way does it open?",
        "It needs to end up down, touching the mat.",
        "Push or pull the top of the cover so it swings down."
      ],
      tools: { best: ["hook", "lever"], ok: ["pusher", "scoop", "guide"] },
      think: [
        "From which side is it easiest for the robot to reach the cover?",
        "Is there anything else near this model you could grab on the same trip?"
      ]
    },
    {
      id: "M12", name: "Forest Elder", color: "#a16207", icon: "fa-tree",
      story: "A very old tree is bending under its own weight. Give it support!",
      goal: "Raise the cane all the way so it touches the tree. Also put the support tie around the post.",
      points: "20 + 10",
      noTouch: true,
      parts: ["Cane", "Support tie", "Post"],
      actions: { must: [["lift", "push"]], ok: ["hook", "drop", "pull"] },
      hints: [
        "The cane starts low. Where does it need to end up?",
        "The cane has to go up until it touches the tree.",
        "Lift the cane up. Then the support tie needs to go around the post."
      ],
      tools: { best: ["lifter", "fork", "lever"], ok: ["hook", "guide"] },
      think: [
        "Could the robot slide under the cane and lift as it drives?",
        "The support tie is worth fewer points. Is it worth an extra trip?"
      ],
      watchOut: "No-touch rule: leave the cane and the tie free at the end of the match."
    },
    {
      id: "M13", name: "Keystone Species", color: "#ec4899", icon: "fa-paw",
      story: "Keystone animals help the whole forest. Build your own animal and deliver it to its new home!",
      goal: "Your team's own keystone animal ends up on the restoration platform, and the young trees are raised.",
      points: "30",
      dock: true,
      parts: ["Your keystone animal (from bag 20)", "Restoration platform", "Young trees"],
      actions: { must: [["drop"]], ok: ["push", "press"] },
      hints: [
        "You build the animal yourself! What does the robot have to do with it?",
        "The animal needs to get onto the platform.",
        "Carry the animal and drop it on the platform. Its weight can push the platform down and raise the trees."
      ],
      tools: { best: ["dropper"], ok: ["scoop", "pusher", "guide"] },
      think: [
        "How heavy does your animal need to be to push the platform down?",
        "How can your attachment let go of the animal in exactly the right spot?"
      ],
      watchOut: "Dock mission: you choose which dock (mine, city or farm) this model goes on before the match. Your animal counts as equipment at inspection."
    },
    {
      id: "M14", name: "Seeds of Renewal", color: "#84cc16", icon: "fa-hand-holding-droplet",
      story: "A healthy rainforest needs lots of different plants. Plant the seeds your team collected!",
      goal: "Get seeds inside the replantation station. Bonus for each seed that is also touching the mat.",
      points: "5 each, +5 each",
      dock: true,
      parts: ["Replantation station", "Seeds from other missions"],
      links: "Seeds come from Missions 02, 09 and others.",
      actions: { must: [["drop"]], ok: ["collect", "push"] },
      hints: [
        "Where do the seeds come from? Where do they need to go?",
        "The robot has to bring seeds to the station and let them go inside.",
        "Collect seeds on other missions, then deliver them into the station. Can they reach the mat for the bonus?"
      ],
      tools: { best: ["dropper", "scoop"], ok: ["guide"] },
      think: [
        "Which missions give you seeds, and in what order will you do them?",
        "How do you get the seeds all the way down so they touch the mat?"
      ],
      watchOut: "Dock mission: decide where to put the station before the match."
    },
    {
      id: "M15", name: "Biocentric Architecture", color: "#14b8a6", icon: "fa-building",
      story: "Smart buildings can be homes for wildlife too. Upgrade this building for nature!",
      goal: "Three upgrades: raise the nesting canopy, slide the garden skylight in, open the compost hatch onto the mat. Bonus for doing the upgrade that fits the dock the building is on.",
      points: "10 each, +10 bonus",
      noTouch: true,
      dock: true,
      parts: ["Nesting canopy", "Garden skylight", "Compost hatch"],
      actions: { must: [["lift", "pull", "press"]], ok: ["hook", "push"] },
      hints: [
        "There are three parts. Look at each one separately.",
        "One goes up, one slides in, one opens down.",
        "Lift the canopy, pull the skylight in, press the hatch open. You don't have to do all three!"
      ],
      tools: { best: ["lever", "hook", "lifter"], ok: ["pusher", "fork", "guide"] },
      think: [
        "Which upgrade gets the bonus on each dock? (Mine = canopy, City = skylight, Farm = hatch.)",
        "Can one attachment do two upgrades?"
      ],
      watchOut: "Dock mission + no-touch rule."
    }
  ];

  /* Build & test checklist (shown on every mission) */
  const CHECKLIST = [
    { id: "fits",    text: "My robot with this attachment fits inside one launch area and is under 12 in. (305 mm) tall." },
    { id: "lego",    text: "It's made only of LEGO pieces (no tape or glue!)." },
    { id: "swap",    text: "It goes on and comes off the robot in about 5 seconds." },
    { id: "sturdy",  text: "It doesn't fall apart when I shake it gently." },
    { id: "clear",   text: "It doesn't bump other mission models on the way." },
    { id: "home",    text: "The robot drives back home after the mission." }
  ];

  const RULES = [
    "A match lasts 2.5 minutes. The robot must drive on its own — no remote controls.",
    "One hub, up to 4 motors, and touch/force, color, distance and gyro sensors.",
    "A standard SPIKE Prime set uses 2 motors for driving, which leaves 1 motor (the large one) for attachments.",
    "You can only touch the robot and change attachments while it's in home.",
    "If you touch the robot outside home, you lose a precision token. You start with 6 tokens, worth 50 points.",
    "If everything fits in ONE launch area under 12 in. tall at inspection, you get 20 bonus points."
  ];

  return { LINKS, ACTIONS, TOOLS, MISSIONS, CHECKLIST, RULES };

})();
