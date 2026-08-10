/* ==========================================
   "WHAT I DO NEXT?" — Oil Leak Robot Game
   Educational game for grades 5-8 teaching
   Prevention, Detection & Mitigation concepts.
========================================== */

(function () {

  const STAGES = [
    {
      id: "lights",
      phase: "Detection",
      phaseIcon: "fa-magnifying-glass",
      scene: "Beep boop! I've been lowered down the zipline data cable and I'm now floating at the bottom of the ship's hull. It's pitch black down here — I can't see a thing. What do I do next?",
      reask: [
        "Still can't see anything down here. What do I do next?",
        "It's still dark! What do I do next?",
        "Hmm, that didn't help me see. What do I do next?"
      ],
      correct: (a) =>
        /\b(light|lights|camera|flashlight|torch|headlamp|headlight|headlights)\b/.test(a) &&
        /\b(turn on|switch on|activate|power up|enable|use|flip on)\b/.test(a),
      vague: (a) =>
        /\b(look|check|see|scan|inspect|explore|search|go|move)\b/.test(a),
      hints: [
        "Hmm, I can't see a thing down here... what part of me could help with that?",
        "I have built-in LED lights and an underwater camera!",
        "Try typing something like: 'Turn on your lights and camera.'"
      ],
      success: "Lights and camera ON! Real inspection robots always light up the area first so their cameras can actually see underwater.",
      actionLabel: "Turned on lights & camera to see underwater"
    },
    {
      id: "oilsensor",
      phase: "Detection",
      phaseIcon: "fa-magnifying-glass",
      scene: "Now I can see! There's a strange cloudy, shiny patch of water near a pipe joint. It doesn't look normal. What do I do next?",
      reask: [
        "That patch of water is still there and still looks strange. What do I do next?",
        "I'm still not sure what that cloudy patch is. What do I do next?",
        "That didn't tell me what's in the water. What do I do next?"
      ],
      correct: (a) =>
        /\b(oil sensor|hydrocarbon sensor|hydrocarbon|chemical sensor|oil detector|water sample|water test|sniff|smell sensor|gas sensor)\b/.test(a) ||
        /\btest the water\b/.test(a),
      vague: (a) =>
        /\b(check it|look closer|investigate|go see|find out|examine|zoom|look at it|check the water|study it)\b/.test(a),
      hints: [
        "A camera can show me color and shape, but not what a liquid is actually made of...",
        "I need a sensor that can tell oil apart from sand or algae in the water.",
        "Try: 'Use your oil sensor to test the water.'"
      ],
      success: "Oil sensor confirms it — that's oil! Hydrocarbon sensors detect the chemical signature of oil, so robots don't get fooled by sand or algae that just LOOK similar.",
      actionLabel: "Used the oil sensor to test the cloudy water"
    },
    {
      id: "pinpoint",
      phase: "Detection",
      phaseIcon: "fa-magnifying-glass",
      scene: "The sensor found oil in the water! But I still don't know exactly where it's coming from. What do I do next?",
      reask: [
        "I still haven't found exactly where it's leaking from. What do I do next?",
        "The source is still a mystery. What do I do next?",
        "That didn't lead me to the leak. What do I do next?"
      ],
      correct: (a) =>
        /\bsonar\b/.test(a) ||
        (/\b(follow|move|trace|track|swim|head|go|approach)\b/.test(a) &&
         /\b(pipe|joint|source|crack|leak|closer)\b/.test(a)),
      vague: (a) =>
        /\b(find it|search|look for it|figure out|locate it|check around)\b/.test(a),
      hints: [
        "Oil leaks usually come from ONE specific spot, like a pipe or valve — not the whole hull.",
        "Try following the cloudy water. It gets thicker the closer you get to the source.",
        "Try: 'Move closer to the pipe joint to find the crack.'"
      ],
      success: "Found it — a hairline crack in the pipe joint! Real inspection robots follow the spreading oil trail, or use sonar imaging, to pinpoint leaks precisely.",
      actionLabel: "Traced the oil trail to a cracked pipe joint"
    },
    {
      id: "prevention",
      phase: "Prevention",
      phaseIcon: "fa-shield-halved",
      scene: "There's a small crack in this pipe joint. Before fixing anything... what do I do next?",
      reask: [
        "I haven't looked anywhere else yet. What do I do next?",
        "I only know about this one crack so far. What do I do next?",
        "That's not about the other joints. What do I do next?"
      ],
      correct: (a) =>
        /\b(other|nearby|neighboring|neighbouring|surrounding|rest of the|all the|remaining)\b/.test(a) &&
        /\b(joint|joints|pipe|pipes|seal|seals|valve|valves)\b/.test(a),
      vague: (a) =>
        /\b(check more|look around|keep checking|do more checks|check everything|inspect more)\b/.test(a),
      hints: [
        "If one joint failed, could the ones right next to it be getting weak too?",
        "Good inspection robots don't stop at the first problem — they check similar spots nearby before moving on.",
        "Try: 'Scan the nearby pipe joints for cracks too.'"
      ],
      success: "Nearby joints checked — they're okay for now! This is called preventive inspection: catching weak spots before they turn into leaks.",
      actionLabel: "Checked nearby pipe joints for other weak spots"
    },
    {
      id: "stopsource",
      phase: "Mitigation",
      phaseIcon: "fa-triangle-exclamation",
      scene: "Good thinking! But oil is still leaking out of the crack right now. What do I do next?",
      reask: [
        "Oil is still flowing out of the crack. What do I do next?",
        "The leak hasn't stopped yet. What do I do next?",
        "That didn't stop the oil from coming out. What do I do next?"
      ],
      correct: (a) =>
        /\b(valve|pump|patch|clamp|plug)\b/.test(a) ||
        /\b(shut off|shut it off|close the valve|close it|stop the flow|stop the pump|turn off the pump|seal it|seal the crack)\b/.test(a),
      vague: (a) =>
        /\b(stop it|fix it|make it stop|stop the leak|do something|handle it)\b/.test(a),
      hints: [
        "Oil keeps coming out because it's still flowing through the pipe...",
        "Is there a valve or pump nearby you could shut off? Or something to patch the crack with?",
        "Try: 'Close the valve to stop the oil flow.'"
      ],
      success: "Valve closed — the flow has stopped! Stopping the SOURCE is always priority #1. Cleaning up oil that's still leaking is like mopping a floor with the tap running.",
      actionLabel: "Closed the valve to stop the oil flow"
    },
    {
      id: "contain",
      phase: "Mitigation",
      phaseIcon: "fa-triangle-exclamation",
      scene: "The leak has stopped, but there's still oil floating in the water around me. What do I do next?",
      reask: [
        "The oil is still floating around out there. What do I do next?",
        "That oil hasn't been contained yet. What do I do next?",
        "The spill is still spreading a little. What do I do next?"
      ],
      correct: (a) =>
        /\b(boom|containment boom|absorbent|floating barrier|barrier|pads?|skimmer)\b/.test(a),
      vague: (a) =>
        /\b(clean it up|clean the water|remove the oil|get rid of it|clean up)\b/.test(a),
      hints: [
        "You need something that floats and traps the oil so it can't spread any further.",
        "It's like a floating fence just for oil — it's called a boom.",
        "Try: 'Deploy a containment boom around the spill.'"
      ],
      success: "Containment boom deployed! Booms are floating barriers that stop oil from spreading, making cleanup much easier and protecting more of the ocean.",
      actionLabel: "Deployed a containment boom around the spill"
    },
    {
      id: "report",
      phase: "Mitigation",
      phaseIcon: "fa-triangle-exclamation",
      scene: "The spill is contained. What do I do next?",
      reask: [
        "The crew still doesn't know what happened. What do I do next?",
        "Nobody on the ship knows yet. What do I do next?",
        "That's not going to tell the crew anything. What do I do next?"
      ],
      correct: (a) =>
        /\b(report|alert|radio|message|notify|log it|data cable|control room|inform)\b/.test(a) ||
        /\b(tell the crew|send a report|call the crew)\b/.test(a),
      vague: (a) =>
        /\b(tell someone|let them know|communicate|talk to them|say something)\b/.test(a),
      hints: [
        "The humans on the ship still have no idea what just happened down here...",
        "You're still connected by that data cable — what could you send through it?",
        "Try: 'Send a report to the control room through the data cable.'"
      ],
      success: "Report sent! Real-time data reporting lets the crew log the incident, dispatch a cleanup team, and fix the root cause so it doesn't happen again.",
      actionLabel: "Sent a report to the control room via the data cable"
    },
    {
      id: "return",
      phase: "Wrap-Up",
      phaseIcon: "fa-flag-checkered",
      scene: "Mission almost done — you found the leak, stopped it, cleaned it up, and reported it! What do I do next?",
      reask: [
        "I'm still down here at the bottom of the ship. What do I do next?",
        "The mission's done, but I haven't gone anywhere. What do I do next?",
        "That's not going to get me back to the ship. What do I do next?"
      ],
      correct: (a) =>
        /\b(return|surface|retract|zipline|climb|ascend)\b/.test(a) ||
        /\b(go back|head back|back up|go home|come back up|pull me up)\b/.test(a),
      vague: (a) =>
        /\b(leave|finish|end the mission|go somewhere|move on)\b/.test(a),
      hints: [
        "Your job here is finished — where should you go now?",
        "You came down on a zipline data cable... could you go back UP it?",
        "Try: 'Return to the surface using the zipline.'"
      ],
      success: "Mission complete! You just completed a full Prevent → Detect → Mitigate cycle, just like real inspection robots do.",
      actionLabel: "Returned to the surface via the zipline"
    }
  ];

  const REASK_GENERIC = [
    "Hmm, I don't think that's going to help right now. What do I do next?",
    "That doesn't seem right for this situation. What do I do next?",
    "Not quite — let's think about this differently. What do I do next?",
    "That's not it. What do I do next?"
  ];

  const VAGUE_REPLIES = [
    "Okay... but HOW will I do that?",
    "How exactly should I do that?",
    "I hear you, but I need more detail — how will I do it?",
    "Sounds like a plan, but how? Be specific!"
  ];

  const SILLY_REPLIES = [
    "Beep boop? That doesn't sound like a real instruction. Give me something a robot could actually do!",
    "Hmm, I don't think my robot arms can do that. Try a real instruction!",
    "That's not going to help with the oil leak. Give it another shot with a real plan!",
    "I don't understand that one. Try telling me a real, specific instruction."
  ];

  const PHASE_CLASS = {
    "Detection": "phase-detection",
    "Prevention": "phase-prevention",
    "Mitigation": "phase-mitigation",
    "Wrap-Up": "phase-wrapup"
  };

  let stageIndex = 0;
  let attempts = 0;
  let completedActions = [];
  let finished = false;

  const chatLog = document.getElementById("chatLog");
  const form = document.getElementById("gameForm");
  const input = document.getElementById("gameInput");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const phaseBadge = document.getElementById("phaseBadge");
  const attemptNote = document.getElementById("attemptNote");
  const restartBtn = document.getElementById("restartBtn");
  const victoryPanel = document.getElementById("victoryPanel");
  const gamePanel = document.getElementById("gamePanel");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const recapLists = {
    Detection: document.getElementById("recapDetection"),
    Prevention: document.getElementById("recapPrevention"),
    Mitigation: document.getElementById("recapMitigation"),
    "Wrap-Up": document.getElementById("recapWrapup")
  };

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function normalize(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const JUNK_WORDS = new Set([
    "idk", "dunno", "nothing", "whatever", "banana", "poop", "asdf", "asdfgh",
    "test", "lol", "haha", "hehe", "random", "blah", "meh", "skip", "pass",
    "no", "yes", "ok", "okay", "hi", "hello", "k", "na", "stuff", "something",
    "things", "anything", "i dont know", "i do not know", "dont know", "idc"
  ]);

  function isSilly(s) {
    if (!s || s.length < 2) return true;
    const compact = s.replace(/\s+/g, "");
    if (/^(.)\1{2,}$/.test(compact)) return true;
    if (/^[0-9]+$/.test(compact)) return true;
    if (/^[bcdfghjklmnpqrstvwxyz]{3,}$/.test(compact)) return true;
    if (JUNK_WORDS.has(s)) return true;
    return false;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function scrollChatToBottom() {
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function addMessage(sender, html) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + (sender === "robot" ? "robot" : "kid");

    if (sender === "robot") {
      bubble.innerHTML =
        '<span class="bubble-icon"><i class="fa-solid fa-robot"></i></span>' +
        '<span class="bubble-text">' + html + "</span>";
    } else {
      bubble.innerHTML = '<span class="bubble-text">' + html + "</span>";
    }

    chatLog.appendChild(bubble);
    scrollChatToBottom();
  }

  function updateProgress() {
    const pct = Math.round((stageIndex / STAGES.length) * 100);
    progressFill.style.width = pct + "%";

    if (stageIndex < STAGES.length) {
      const stage = STAGES[stageIndex];
      progressText.textContent = "Stage " + (stageIndex + 1) + " of " + STAGES.length;
      phaseBadge.className = "phase-badge " + PHASE_CLASS[stage.phase];
      phaseBadge.innerHTML =
        '<i class="fa-solid ' + stage.phaseIcon + '"></i> ' + stage.phase;
    }
  }

  function updateAttemptNote() {
    if (attempts <= 0) {
      attemptNote.textContent = "";
    } else {
      attemptNote.textContent = "Attempt " + attempts + " on this step";
    }
  }

  function startStage(index) {
    attempts = 0;
    updateAttemptNote();
    updateProgress();
    const stage = STAGES[index];
    setTimeout(() => addMessage("robot", stage.scene), 250);
  }

  function showVictory() {
    finished = true;
    gamePanel.classList.add("hidden");
    victoryPanel.classList.remove("hidden");

    Object.values(recapLists).forEach((el) => (el.innerHTML = ""));

    completedActions.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + escapeHtml(item.action);
      const list = recapLists[item.phase];
      if (list) list.appendChild(li);
    });

    Object.entries(recapLists).forEach(([phase, list]) => {
      const section = list.closest(".recap-group");
      if (section) {
        section.style.display = list.children.length ? "" : "none";
      }
    });

    victoryPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetGame() {
    stageIndex = 0;
    attempts = 0;
    completedActions = [];
    finished = false;
    chatLog.innerHTML = "";
    victoryPanel.classList.add("hidden");
    gamePanel.classList.remove("hidden");
    input.value = "";
    startStage(0);
    gamePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (finished) return;

    const raw = input.value;
    if (!raw || !raw.trim()) return;

    addMessage("kid", escapeHtml(raw.trim()));
    input.value = "";

    const ans = normalize(raw);

    if (isSilly(ans)) {
      setTimeout(() => addMessage("robot", pickRandom(SILLY_REPLIES)), 350);
      return;
    }

    attempts++;
    updateAttemptNote();

    const stage = STAGES[stageIndex];

    if (stage.correct(ans)) {
      addMessage("robot", "✅ " + stage.success);
      completedActions.push({ phase: stage.phase, action: stage.actionLabel });
      stageIndex++;

      if (stageIndex >= STAGES.length) {
        setTimeout(showVictory, 1100);
      } else {
        setTimeout(() => startStage(stageIndex), 1300);
      }
      return;
    }

    let hintText = "";
    if (attempts === 4) hintText = stage.hints[0];
    else if (attempts === 6) hintText = stage.hints[1];
    else if (attempts >= 8) hintText = stage.hints[2];

    let reply;
    if (stage.vague(ans)) {
      reply = pickRandom(VAGUE_REPLIES);
    } else {
      reply = pickRandom(REASK_GENERIC.concat(stage.reask));
    }

    if (hintText) {
      reply += '<br><span class="hint-line"><i class="fa-solid fa-lightbulb"></i> Hint: ' + hintText + "</span>";
    }

    setTimeout(() => addMessage("robot", reply), 350);
  }

  form.addEventListener("submit", handleSubmit);
  restartBtn.addEventListener("click", resetGame);
  playAgainBtn.addEventListener("click", resetGame);

  // Kick off the game
  startStage(0);
})();
