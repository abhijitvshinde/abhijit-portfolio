/* ==========================================
   KIDS GAMES — tab switcher + FLL ATTACHMENT LAB
   Kids pick a BIOGLOW mission and are guided through
   Explore → Detective → Pick a tool → Design → Build & test.
   Progress is saved to /api/fll for logged-in students.
========================================== */

/* ---------- Tabs ---------- */
(function () {
  const tabs = Array.from(document.querySelectorAll(".games-tab"));
  if (!tabs.length) return;

  function show(name, focus) {
    tabs.forEach((tab) => {
      const on = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !on;
      if (on && focus) tab.focus();
    });
    if (window.history && history.replaceState) {
      history.replaceState(null, "", name === "rov" ? location.pathname : "#" + name);
    }
    document.dispatchEvent(new CustomEvent("games:tab", { detail: name }));
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => show(tab.dataset.tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      show(next.dataset.tab, true);
    });
  });

  show(location.hash === "#fll" ? "fll" : "rov");
})();

/* ---------- FLL Attachment Lab ---------- */
(function () {
  const root = document.getElementById("fllApp");
  if (!root || !window.FLL_DATA) return;

  const { LINKS, ACTIONS, TOOLS, MISSIONS, CHECKLIST, RULES } = window.FLL_DATA;
  const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
  const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
  const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

  const STEPS = [
    { n: 1, name: "Explore", icon: "fa-eye" },
    { n: 2, name: "Detective", icon: "fa-magnifying-glass" },
    { n: 3, name: "Pick a tool", icon: "fa-toolbox" },
    { n: 4, name: "Design", icon: "fa-pencil" },
    { n: 5, name: "Build & test", icon: "fa-flask" }
  ];

  const STATUS = {
    new:       { label: "Not started", cls: "st-new" },
    exploring: { label: "Exploring",   cls: "st-explore" },
    designing: { label: "Designing",   cls: "st-design" },
    testing:   { label: "Testing",     cls: "st-test" },
    ready:     { label: "Ready!",      cls: "st-ready" }
  };

  const PARTS = ["Beams", "Frames", "Axles", "Pins", "Connectors", "Gears", "Wheels", "Plates & bricks", "Rubber bands", "Motor"];

  const state = {
    user: null,
    guest: false,
    progress: { version: 1, missions: {} },
    view: "loading",
    missionId: null,
    serverReady: true,
    feedback: {},
    sketches: {}
  };

  /* ---------- small helpers ---------- */

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const icon = (name) => h("i", { class: "fa-solid " + name, "aria-hidden": "true" });

  async function api(action, opts = {}) {
    const method = opts.method || "GET";
    const qs = opts.query ? "&" + new URLSearchParams(opts.query).toString() : "";
    const res = await fetch("/api/fll?action=" + action + qs, {
      method,
      credentials: "same-origin",
      headers: method === "POST" ? { "Content-Type": "application/json", "X-FLL-Request": "1" } : {},
      body: method === "POST" ? JSON.stringify(opts.body || {}) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    if (!res.ok) {
      const err = new Error(data.error || "Something went wrong. Try again.");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function mission(id) {
    const all = state.progress.missions;
    if (!all[id]) {
      all[id] = {
        status: "new", step: 1, watched: false,
        actions: [], actionTries: 0, actionsDone: false, touchPlan: "",
        tools: [], toolsDone: false, power: "", pathPlan: "",
        design: { desc: "", parts: [], connect: "" }, hasSketch: false,
        checklist: {}, trials: [], changes: [], ready: false, updated: 0
      };
    }
    return all[id];
  }

  function statusOf(id) {
    const m = state.progress.missions[id];
    return (m && m.status) || "new";
  }

  function computeStatus(m) {
    if (m.ready) return "ready";
    if (m.step >= 5) return "testing";
    if (m.step >= 3) return "designing";
    if (m.watched || m.step > 1 || m.actions.length) return "exploring";
    return "new";
  }

  function stepUnlocked(m, n) {
    if (n <= 1) return true;
    if (n === 2) return m.watched;
    if (n === 3) return m.watched && m.actionsDone;
    if (n === 4) return m.watched && m.actionsDone && m.toolsDone;
    return m.watched && m.actionsDone && m.toolsDone && m.design.desc.trim().length >= 15;
  }

  /* ---------- saving ---------- */

  let saveTimer = null;
  let saveState = "idle";

  function touch(id) {
    const m = mission(id);
    m.status = computeStatus(m);
    m.updated = Date.now();
    scheduleSave();
  }

  function scheduleSave() {
    if (state.guest || !state.user) return;
    setSaveState("pending");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 1200);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    if (state.guest || !state.user) return;
    setSaveState("saving");
    try {
      await api("progress", { method: "POST", body: { progress: state.progress } });
      setSaveState("saved");
    } catch (e) {
      if (e.status === 401) return sessionExpired();
      setSaveState("error", e.message);
      saveTimer = setTimeout(saveNow, 8000);
    }
  }

  function setSaveState(s, msg) {
    saveState = s;
    const el = document.getElementById("fllSaveState");
    if (!el) return;
    const map = {
      idle: ["fa-cloud", "Saved"],
      pending: ["fa-pen", "Saving soon…"],
      saving: ["fa-cloud-arrow-up", "Saving…"],
      saved: ["fa-circle-check", "Saved"],
      error: ["fa-triangle-exclamation", msg || "Not saved yet — retrying"],
      guest: ["fa-user-secret", "Guest — not saved"]
    };
    const [ic, text] = map[s] || map.idle;
    el.className = "fll-save fll-save-" + s;
    el.replaceChildren(icon(ic), " " + text);
  }

  window.addEventListener("beforeunload", (e) => {
    if (saveState === "pending" || saveState === "saving") {
      saveNow();
      e.preventDefault();
      e.returnValue = "";
    }
  });

  function sessionExpired() {
    state.user = null;
    state.view = "login";
    state.loginMessage = "You were logged out. Please log in again.";
    render();
  }

  /* ---------- top-level render ---------- */

  function render() {
    const views = { loading: viewLoading, login: viewLogin, map: viewMap, mission: viewMission };
    root.replaceChildren((views[state.view] || viewLoading)());
    if (state.view === "map" || state.view === "mission") {
      setSaveState(state.guest ? "guest" : saveState === "pending" || saveState === "saving" ? saveState : "saved");
    }
  }

  function viewLoading() {
    return h("div", { class: "fll-card fll-center" }, icon("fa-spinner fa-spin"), " Loading the lab…");
  }

  /* ---------- login ---------- */

  function viewLogin() {
    const msg = h("p", { class: "fll-msg", role: "alert" }, state.loginMessage || "");
    const user = h("input", { id: "fllUser", type: "text", autocomplete: "username", autocapitalize: "none", spellcheck: "false", required: true });
    const pass = h("input", { id: "fllPass", type: "password", autocomplete: "current-password", required: true });
    const btn = h("button", { class: "btn primary", type: "submit" }, icon("fa-right-to-bracket"), " Log in");

    const form = h("form", {
      class: "fll-login-form",
      onsubmit: async (e) => {
        e.preventDefault();
        btn.disabled = true;
        msg.textContent = "Checking…";
        try {
          const data = await api("login", { method: "POST", body: { username: user.value, password: pass.value } });
          if (data.user.role === "coach") {
            msg.textContent = "";
            msg.append("You're logged in as the coach. ", h("a", { href: "fll-coach.html" }, "Open the coach dashboard"), ".");
            btn.disabled = false;
            return;
          }
          state.loginMessage = "";
          await startSession(data.user);
        } catch (err) {
          msg.textContent = err.message;
          btn.disabled = false;
        }
      }
    },
      h("label", { for: "fllUser" }, "Username"), user,
      h("label", { for: "fllPass" }, "Password"), pass,
      btn,
      msg
    );

    const notReady = !state.serverReady
      ? h("p", { class: "fll-note" }, icon("fa-circle-info"), " Saving isn't switched on yet, but you can still explore as a guest.")
      : null;

    return h("div", { class: "fll-login" },
      h("div", { class: "fll-card fll-login-card" },
        h("div", { class: "fll-login-icon" }, icon("fa-robot")),
        h("h3", {}, "Welcome, engineer!"),
        h("p", { class: "fll-muted" }, "Log in with the username and password your coach gave you. Your work is saved so you can keep going next time."),
        notReady,
        state.serverReady ? form : null,
        h("div", { class: "fll-or" }, h("span", {}, "or")),
        h("button", { class: "btn ghost", type: "button", onclick: () => { state.guest = true; state.view = "map"; render(); } },
          icon("fa-compass"), " Explore as a guest (nothing is saved)")
      ),
      introCard()
    );
  }

  function introCard() {
    return h("div", { class: "fll-card fll-intro-card" },
      h("h3", {}, icon("fa-leaf"), " What is the Attachment Lab?"),
      h("p", {}, "In the FIRST LEGO League BIOGLOW robot game, your SPIKE Prime robot has to complete missions on a rainforest field. To do that, it needs the right attachments — hooks, lifters, pushers and more."),
      h("p", {}, "Pick a mission, figure out what the robot has to do, choose a tool, design it, then build and test it for real with LEGO."),
      h("ol", { class: "fll-steps-mini" },
        STEPS.map((s) => h("li", {}, icon(s.icon), " ", s.name))
      )
    );
  }

  async function startSession(user) {
    state.user = user;
    state.guest = false;
    state.view = "loading";
    render();
    try {
      const data = await api("progress");
      const p = data.progress || {};
      state.progress = { version: 1, missions: {}, ...p };
    } catch (e) {
      if (e.status === 401) return sessionExpired();
      state.progress = { version: 1, missions: {} };
    }
    saveState = "saved";
    state.view = "map";
    render();
  }

  async function logout() {
    flushSketch();
    if (!state.guest) {
      await saveNow();
      try { await api("logout", { method: "POST" }); } catch (e) { /* ignore */ }
    }
    state.user = null;
    state.guest = false;
    state.progress = { version: 1, missions: {} };
    state.sketches = {};
    state.view = "login";
    render();
  }

  /* ---------- header ---------- */

  function header() {
    const who = state.guest
      ? h("span", { class: "fll-who" }, icon("fa-user-secret"), " Guest explorer")
      : h("span", { class: "fll-who" }, icon("fa-user-astronaut"), " ", state.user.name, state.user.team ? h("small", {}, " · " + state.user.team) : null);
    return h("div", { class: "fll-header" },
      who,
      h("span", { id: "fllSaveState", class: "fll-save" }),
      h("button", { class: "fll-link-btn", type: "button", onclick: logout },
        icon(state.guest ? "fa-right-to-bracket" : "fa-right-from-bracket"), state.guest ? " Log in" : " Log out")
    );
  }

  /* ---------- mission map ---------- */

  function viewMap() {
    const counts = { ready: 0, active: 0 };
    MISSIONS.forEach((m) => {
      const s = statusOf(m.id);
      if (s === "ready") counts.ready++;
      else if (s !== "new") counts.active++;
    });
    const pct = Math.round((counts.ready / MISSIONS.length) * 100);

    return h("div", { class: "fll-map" },
      header(),
      h("div", { class: "fll-summary fll-card" },
        h("div", {},
          h("h3", {}, "Pick a mission"),
          h("p", { class: "fll-muted" }, "Start with a mission that looks fun or easy. You can work on more than one!")
        ),
        h("div", { class: "fll-summary-stats" },
          h("div", { class: "fll-stat" }, h("strong", {}, String(counts.ready)), h("span", {}, "ready")),
          h("div", { class: "fll-stat" }, h("strong", {}, String(counts.active)), h("span", {}, "in progress")),
          h("div", { class: "fll-stat" }, h("strong", {}, String(MISSIONS.length)), h("span", {}, "missions"))
        ),
        h("div", { class: "fll-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct), "aria-label": "Missions ready" },
          h("div", { class: "fll-bar-fill", style: "width:" + pct + "%" }))
      ),
      h("div", { class: "fll-grid" }, MISSIONS.map(missionCard)),
      rulesCard(),
      resourcesCard()
    );
  }

  function badges(m) {
    return [
      m.noTouch ? h("span", { class: "fll-badge b-notouch", title: "Equipment can't be touching this model at the end of the match" }, icon("fa-hand"), " No-touch") : null,
      m.dock ? h("span", { class: "fll-badge b-dock", title: "Goes on a dock you choose before the match" }, icon("fa-anchor"), " Dock") : null,
      m.teamwork ? h("span", { class: "fll-badge b-team", title: "Works together with the other team's table" }, icon("fa-handshake"), " Teamwork") : null
    ];
  }

  function missionCard(m) {
    const s = statusOf(m.id);
    const rec = state.progress.missions[m.id];
    const step = rec ? rec.step : 0;
    return h("button", {
      class: "fll-mission-card " + STATUS[s].cls,
      type: "button",
      style: "--accent:" + m.color,
      onclick: () => openMission(m.id)
    },
      h("div", { class: "fll-mc-top" },
        h("span", { class: "fll-mc-num" }, m.id),
        h("span", { class: "fll-status " + STATUS[s].cls }, s === "ready" ? icon("fa-star") : null, " ", STATUS[s].label)
      ),
      h("div", { class: "fll-mc-icon" }, icon(m.icon)),
      h("h4", {}, m.name),
      h("p", { class: "fll-mc-points" }, icon("fa-trophy"), " ", m.points),
      h("div", { class: "fll-badges" }, badges(m)),
      h("div", { class: "fll-dots", "aria-label": "Step " + step + " of 5" },
        STEPS.map((st) => h("span", { class: "fll-dot" + (s === "ready" || st.n < step ? " done" : st.n === step ? " now" : "") })))
    );
  }

  function rulesCard() {
    return h("details", { class: "fll-card fll-details" },
      h("summary", {}, icon("fa-scale-balanced"), " Robot rules every builder should know"),
      h("ul", { class: "fll-list" }, RULES.map((r) => h("li", {}, r))),
      h("p", { class: "fll-muted small" }, "This is a short summary. The official Robot Game Rulebook and Challenge Updates always win.")
    );
  }

  function resourcesCard() {
    const link = (href, ic, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer", class: "fll-resource" }, icon(ic), " ", text);
    return h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-book-open"), " Official BIOGLOW resources"),
      h("div", { class: "fll-resources" },
        link(LINKS.missionsVideo, "fa-circle-play", "Robot Game Missions video"),
        link(LINKS.fieldSetupVideo, "fa-circle-play", "Field setup video"),
        link(LINKS.rulebook, "fa-file-pdf", "Robot Game Rulebook (PDF)"),
        link(LINKS.updates, "fa-file-circle-exclamation", "Challenge Updates (PDF)"),
        link(LINKS.materials, "fa-cubes", "Mission model building instructions")
      )
    );
  }

  /* ---------- mission workspace ---------- */

  function openMission(id) {
    state.missionId = id;
    state.view = "mission";
    state.feedback = {};
    const m = mission(id);
    if (!stepUnlocked(m, m.step)) m.step = 1;
    render();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!state.guest && m.hasSketch && state.sketches[id] === undefined) loadSketch(id);
  }

  function flushSketch() {
    if (state.flushSketch) state.flushSketch();
  }

  function goStep(n) {
    flushSketch();
    const m = mission(state.missionId);
    if (!stepUnlocked(m, n)) return;
    m.step = n;
    state.feedback = {};
    touch(state.missionId);
    render();
    const top = document.getElementById("fllStepTop");
    if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function viewMission() {
    const data = MISSION_BY_ID[state.missionId];
    const m = mission(data.id);
    const stepViews = { 1: stepExplore, 2: stepDetective, 3: stepTool, 4: stepDesign, 5: stepTest };

    return h("div", { class: "fll-mission", style: "--accent:" + data.color },
      header(),
      h("button", { class: "fll-link-btn fll-back", type: "button", onclick: () => { flushSketch(); state.view = "map"; render(); } },
        icon("fa-arrow-left"), " All missions"),
      h("div", { class: "fll-card fll-mission-head" },
        h("div", { class: "fll-mh-icon" }, icon(data.icon)),
        h("div", {},
          h("p", { class: "fll-mh-num" }, "Mission " + data.id.slice(1)),
          h("h3", {}, data.name),
          h("p", { class: "fll-muted" }, data.story),
          h("div", { class: "fll-badges" }, badges(data))
        )
      ),
      h("nav", { class: "fll-stepper", id: "fllStepTop", "aria-label": "Mission steps" },
        STEPS.map((st) => {
          const unlocked = stepUnlocked(m, st.n);
          const current = m.step === st.n;
          return h("button", {
            type: "button",
            class: "fll-step" + (current ? " current" : "") + (unlocked ? "" : " locked"),
            disabled: !unlocked,
            "aria-current": current ? "step" : null,
            onclick: () => goStep(st.n)
          },
            h("span", { class: "fll-step-n" }, unlocked ? icon(st.icon) : icon("fa-lock")),
            h("span", { class: "fll-step-name" }, st.n + ". " + st.name)
          );
        })
      ),
      h("div", { class: "fll-card fll-step-body" }, stepViews[m.step](data, m))
    );
  }

  function nextButton(m, n, label) {
    const ok = stepUnlocked(m, n);
    return h("div", { class: "fll-nav-row" },
      m.step > 1 ? h("button", { class: "btn ghost", type: "button", onclick: () => goStep(m.step - 1) }, icon("fa-arrow-left"), " Back") : h("span"),
      h("button", { class: "btn primary", type: "button", disabled: !ok, onclick: () => goStep(n) },
        label || "Next", " ", icon("fa-arrow-right"))
    );
  }

  function feedbackBox(key) {
    const f = state.feedback[key];
    if (!f) return null;
    return h("div", { class: "fll-feedback fb-" + f.kind, role: "status" },
      icon(f.kind === "good" ? "fa-circle-check" : f.kind === "warn" ? "fa-lightbulb" : "fa-circle-info"),
      h("div", {}, f.lines.map((l) => h("p", {}, l)))
    );
  }

  /* Step 1 — Explore */
  function stepExplore(data, m) {
    const box = h("input", {
      type: "checkbox", id: "fllWatched", checked: m.watched,
      onchange: (e) => { m.watched = e.target.checked; touch(data.id); render(); }
    });
    return h("div", {},
      h("h3", { class: "fll-step-title" }, icon("fa-eye"), " Step 1: Explore the mission"),
      h("div", { class: "fll-two-col" },
        h("div", {},
          h("h4", {}, "Your goal"),
          h("p", {}, data.goal),
          h("h4", {}, "Points"),
          h("p", {}, icon("fa-trophy"), " ", data.points),
          data.links ? h("p", { class: "fll-note" }, icon("fa-link"), " ", data.links) : null,
          data.watchOut ? h("p", { class: "fll-note warn" }, icon("fa-triangle-exclamation"), " ", data.watchOut) : null
        ),
        h("div", {},
          h("h4", {}, "Parts of the model"),
          h("div", { class: "fll-chips" }, data.parts.map((p) => h("span", { class: "fll-chip" }, p))),
          h("h4", {}, "Look closely"),
          h("p", {}, "Watch the official missions video and find ", h("strong", {}, data.name), ". If your team has the real model, look at it, touch it gently, and see how it moves."),
          h("a", { class: "btn ghost fll-small-btn", href: LINKS.missionsVideo, target: "_blank", rel: "noopener noreferrer" }, icon("fa-circle-play"), " Watch the missions video"),
          " ",
          h("a", { class: "btn ghost fll-small-btn", href: LINKS.rulebook, target: "_blank", rel: "noopener noreferrer" }, icon("fa-file-pdf"), " Rulebook")
        )
      ),
      h("label", { class: "fll-check big", for: "fllWatched" }, box,
        h("span", {}, "I watched the video and looked at the model. I know what it does!")),
      nextButton(m, 2, "Be a detective")
    );
  }

  /* Step 2 — Detective */
  function checkActions(data, m) {
    const chosen = new Set(m.actions);
    const must = data.actions.must;
    const allowed = new Set([...must.flat(), ...data.actions.ok]);
    const missing = must.filter((group) => !group.some((a) => chosen.has(a)));
    const extras = m.actions.filter((a) => !allowed.has(a));

    if (!chosen.size) {
      state.feedback.actions = { kind: "info", lines: ["Pick at least one move first!"] };
      return;
    }
    if (!missing.length && !extras.length) {
      m.actionsDone = true;
      const lines = ["Great detective work! You figured out what the robot has to do."];
      if (data.actions.ok.some((a) => chosen.has(a))) lines.push("You also spotted some extra moves that can help — nice thinking.");
      state.feedback.actions = { kind: "good", lines };
      return;
    }
    m.actionTries += 1;
    const lines = [];
    if (extras.length) {
      lines.push("Hmm… does the robot really need to " + ACTION_BY_ID[extras[0]].label.toLowerCase() + " here? Watch the video again.");
    }
    if (missing.length) {
      const hint = data.hints[Math.min(m.actionTries - 1, data.hints.length - 1)];
      lines.push((extras.length ? "Also, something is missing. " : "Almost! Something is missing. ") + "Hint " + Math.min(m.actionTries, data.hints.length) + ": " + hint);
    }
    state.feedback.actions = { kind: "warn", lines };
  }

  function stepDetective(data, m) {
    const grid = h("div", { class: "fll-pick-grid" },
      ACTIONS.map((a) => {
        const on = m.actions.includes(a.id);
        return h("button", {
          type: "button",
          class: "fll-pick" + (on ? " on" : ""),
          "aria-pressed": on ? "true" : "false",
          onclick: () => {
            m.actions = on ? m.actions.filter((x) => x !== a.id) : [...m.actions, a.id];
            if (m.actionsDone) m.actionsDone = false;
            state.feedback.actions = null;
            touch(data.id);
            render();
          }
        },
          h("span", { class: "fll-pick-icon" }, icon(a.icon)),
          h("strong", {}, a.label),
          h("small", {}, a.tip)
        );
      })
    );

    const plan = h("textarea", {
      id: "fllTouchPlan", rows: "3", maxlength: "500",
      placeholder: "Example: The robot comes from the left side and touches the red handle."
    });
    plan.value = m.touchPlan;
    plan.addEventListener("input", () => { m.touchPlan = plan.value; touch(data.id); });

    return h("div", {},
      h("h3", { class: "fll-step-title" }, icon("fa-magnifying-glass"), " Step 2: Be a detective"),
      h("p", {}, h("strong", {}, "What does the robot need to do to the model? "), "Pick all the moves that fit."),
      grid,
      h("div", { class: "fll-row" },
        h("button", { class: "btn primary", type: "button", onclick: () => { checkActions(data, m); touch(data.id); render(); } },
          icon("fa-check"), " Check my answer"),
        m.actionTries > 0 && !m.actionsDone ? h("span", { class: "fll-muted small" }, "Tries: " + m.actionTries) : null
      ),
      feedbackBox("actions"),
      h("label", { class: "fll-label", for: "fllTouchPlan" }, "Where will your robot touch the model, and from which side?"),
      plan,
      nextButton(m, 3, "Pick a tool")
    );
  }

  /* Step 3 — Pick a tool */
  function checkTools(data, m) {
    if (data.noTool) {
      m.toolsDone = m.pathPlan.trim().length >= 10;
      state.feedback.tools = m.toolsDone
        ? { kind: "good", lines: ["Smart plan! Protecting these habitats is free points."] }
        : { kind: "info", lines: ["Write a little more about your plan first."] };
      return;
    }
    if (!m.tools.length) {
      state.feedback.tools = { kind: "info", lines: ["Pick a tool first!"] };
      return;
    }
    const lines = [];
    let fits = 0;
    m.tools.forEach((id) => {
      const t = TOOL_BY_ID[id];
      if (data.tools.best.includes(id)) {
        fits++;
        lines.push("✔ " + t.name + ": great fit! " + t.good);
      } else if (data.tools.ok.includes(id)) {
        fits++;
        lines.push("✔ " + t.name + ": that could work. " + (id === "guide" ? "Guides help any attachment line up." : "Test it carefully!"));
      } else {
        lines.push("? " + t.name + ": hmm, how would that help with this mission? Talk it over with your team.");
      }
    });
    m.toolsDone = fits > 0;
    if (!m.toolsDone) {
      m.toolTries = (m.toolTries || 0) + 1;
      lines.push("Think about the moves you picked in Step 2. Which tool is good at those moves?");
    }
    state.feedback.tools = { kind: m.toolsDone ? "good" : "warn", lines };
  }

  function stepTool(data, m) {
    const moves = h("p", { class: "fll-muted" }, "Your moves: ",
      m.actions.map((a) => h("span", { class: "fll-chip small" }, icon(ACTION_BY_ID[a].icon), " ", ACTION_BY_ID[a].label)));

    if (data.noTool) {
      const plan = h("textarea", { id: "fllPathPlan", rows: "4", maxlength: "600", placeholder: "Example: On Mission 09 we turn early so the attachment doesn't hit the spider habitat." });
      plan.value = m.pathPlan;
      plan.addEventListener("input", () => { m.pathPlan = plan.value; touch(data.id); });
      return h("div", {},
        h("h3", { class: "fll-step-title" }, icon("fa-route"), " Step 3: Plan safe paths"),
        h("p", {}, "This mission doesn't need an attachment — it needs a careful driver! Which missions drive near the spider and snail habitats? How will your robot stay away?"),
        h("label", { class: "fll-label", for: "fllPathPlan" }, "My safe-path plan"),
        plan,
        h("div", { class: "fll-row" },
          h("button", { class: "btn primary", type: "button", onclick: () => { checkTools(data, m); touch(data.id); render(); } }, icon("fa-check"), " Save my plan")),
        feedbackBox("tools"),
        nextButton(m, 4, "Design")
      );
    }

    const grid = h("div", { class: "fll-tool-grid" },
      TOOLS.map((t) => {
        const on = m.tools.includes(t.id);
        return h("button", {
          type: "button",
          class: "fll-tool" + (on ? " on" : ""),
          "aria-pressed": on ? "true" : "false",
          onclick: () => {
            if (on) m.tools = m.tools.filter((x) => x !== t.id);
            else m.tools = [...m.tools, t.id].slice(-2);
            m.toolsDone = false;
            state.feedback.tools = null;
            touch(data.id);
            render();
          }
        },
          h("span", { class: "fll-tool-icon" }, icon(t.icon)),
          h("strong", {}, t.name),
          h("span", { class: "fll-tool-good" }, t.good),
          h("small", {}, icon("fa-hammer"), " ", t.build),
          h("small", { class: "fll-tool-power" }, icon("fa-bolt"), " ", t.power)
        );
      })
    );

    const power = h("div", { class: "fll-power", role: "radiogroup", "aria-label": "Does it need a motor?" },
      [["passive", "fa-feather", "No motor", "The robot drives it into the model. Simple and reliable!"],
       ["motor", "fa-gear", "Uses a motor", "The attachment moves on its own after the robot arrives."]].map(([id, ic, label, tip]) =>
        h("button", {
          type: "button", role: "radio", "aria-checked": m.power === id ? "true" : "false",
          class: "fll-power-opt" + (m.power === id ? " on" : ""),
          onclick: () => { m.power = id; touch(data.id); render(); }
        }, icon(ic), h("strong", {}, " " + label), h("small", {}, tip))
      )
    );

    return h("div", {},
      h("h3", { class: "fll-step-title" }, icon("fa-toolbox"), " Step 3: Pick a tool"),
      moves,
      h("p", {}, h("strong", {}, "Which attachment is good at those moves? "), "Pick one or two."),
      grid,
      h("div", { class: "fll-row" },
        h("button", { class: "btn primary", type: "button", onclick: () => { checkTools(data, m); touch(data.id); render(); } }, icon("fa-check"), " Check my choice")),
      feedbackBox("tools"),
      h("h4", { class: "fll-sub" }, "Does it need a motor?"),
      power,
      h("p", { class: "fll-muted small" }, icon("fa-circle-info"), " A standard SPIKE Prime set has 1 spare motor (the large one) after the 2 driving motors."),
      nextButton(m, 4, "Design it")
    );
  }

  /* Step 4 — Design */
  function stepDesign(data, m) {
    const desc = h("textarea", { id: "fllDesc", rows: "4", maxlength: "1200", placeholder: "Example: A long hook made from an L-beam on the front. It slides under the ring, then the robot backs up to pull it." });
    desc.value = m.design.desc;
    const descCount = h("span", { class: "fll-muted small" });
    const updateCount = () => {
      const n = desc.value.trim().length;
      descCount.textContent = n < 15 ? "Write at least " + (15 - n) + " more letters to unlock Step 5." : "";
    };
    updateCount();
    desc.addEventListener("input", () => {
      const before = stepUnlocked(m, 5);
      m.design.desc = desc.value;
      touch(data.id);
      updateCount();
      if (before !== stepUnlocked(m, 5)) refreshNav(m);
    });

    const connect = h("textarea", { id: "fllConnect", rows: "2", maxlength: "500", placeholder: "Example: Two black pins click into the front of the robot." });
    connect.value = m.design.connect;
    connect.addEventListener("input", () => { m.design.connect = connect.value; touch(data.id); });

    // Toggled in place (no full render) so an unsaved sketch below is not wiped.
    const parts = h("div", { class: "fll-chips" },
      PARTS.map((p) => {
        const on = m.design.parts.includes(p);
        const chip = h("button", {
          type: "button", class: "fll-chip toggle" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false",
          onclick: () => {
            const now = !m.design.parts.includes(p);
            m.design.parts = now ? [...m.design.parts, p] : m.design.parts.filter((x) => x !== p);
            chip.classList.toggle("on", now);
            chip.setAttribute("aria-pressed", now ? "true" : "false");
            touch(data.id);
          }
        }, p);
        return chip;
      })
    );

    return h("div", {},
      h("h3", { class: "fll-step-title" }, icon("fa-pencil"), " Step 4: Design your attachment"),
      h("div", { class: "fll-think" },
        h("h4", {}, icon("fa-brain"), " Think about it"),
        h("ul", { class: "fll-list" }, data.think.map((t) => h("li", {}, t)))
      ),
      h("label", { class: "fll-label", for: "fllDesc" }, "Describe your attachment. What does it look like? How does it move?"),
      desc, descCount,
      h("p", { class: "fll-label" }, "Which LEGO parts will you use?"),
      parts,
      h("label", { class: "fll-label", for: "fllConnect" }, "How does it attach to the robot?"),
      connect,
      h("p", { class: "fll-muted small" }, icon("fa-lightbulb"), " Tip: attachments that click on with 2 pins or slide onto an axle are fast to swap in home."),
      h("h4", { class: "fll-sub" }, icon("fa-paintbrush"), " Sketch it!"),
      sketchPad(data.id, m),
      h("div", { id: "fllNavSlot" }, nextButton(m, 5, "Build & test"))
    );
  }

  function refreshNav(m) {
    const slot = document.getElementById("fllNavSlot");
    if (slot) slot.replaceChildren(nextButton(m, 5, "Build & test"));
  }

  /* Sketch pad */
  async function loadSketch(id) {
    try {
      const data = await api("sketch", { query: { mission: id } });
      state.sketches[id] = data.image || null;
      if (state.view === "mission" && state.missionId === id && mission(id).step === 4) render();
    } catch (e) {
      if (e.status === 401) sessionExpired();
    }
  }

  function sketchPad(id, m) {
    const W = 640, H = 400;
    const canvas = h("canvas", { width: String(W), height: String(H), class: "fll-canvas", role: "img", "aria-label": "Drawing area for your attachment sketch" });
    const ctx = canvas.getContext("2d");
    const strokes = [];
    let base = null;
    let color = "#0f172a";
    let size = 4;
    let drawing = null;
    let dirty = false;
    const status = h("span", { class: "fll-muted small" });

    function redraw() {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      if (base) ctx.drawImage(base, 0, 0, W, H);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      strokes.forEach((s) => {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        ctx.beginPath();
        s.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
        ctx.stroke();
      });
    }

    const saved = state.sketches[id];
    if (saved) {
      const img = new Image();
      img.onload = () => { base = img; redraw(); };
      img.src = saved;
    } else if (m.hasSketch && saved === undefined && !state.guest) {
      status.textContent = "Loading your sketch…";
    }
    redraw();

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
    }
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      drawing = { color, size, pts: [pos(e)] };
      strokes.push(drawing);
      redraw();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      drawing.pts.push(pos(e));
      redraw();
    });
    let autoTimer = null;
    function changed() {
      dirty = true;
      status.textContent = "Not saved yet";
      clearTimeout(autoTimer);
      autoTimer = setTimeout(save, 1500);
      state.flushSketch = () => { clearTimeout(autoTimer); if (dirty) save(); };
    }
    const end = () => {
      if (drawing) { drawing = null; changed(); }
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    const colors = [["#0f172a", "Black"], ["#2563eb", "Blue"], ["#dc2626", "Red"], ["#16a34a", "Green"], ["#f59e0b", "Orange"]];
    const colorBtns = colors.map(([c, name]) => {
      const b = h("button", {
        type: "button", class: "fll-swatch" + (c === color ? " on" : ""), style: "background:" + c,
        "aria-label": name, title: name,
        onclick: () => { color = c; size = 4; colorBtns.forEach((x) => x.classList.remove("on")); b.classList.add("on"); }
      });
      return b;
    });
    const eraser = h("button", {
      type: "button", class: "fll-tool-btn", title: "Eraser",
      onclick: () => { color = "#ffffff"; size = 18; colorBtns.forEach((x) => x.classList.remove("on")); }
    }, icon("fa-eraser"), " Eraser");

    async function save() {
      clearTimeout(autoTimer);
      state.flushSketch = null;
      dirty = false;
      const empty = !base && !strokes.length;
      let image = empty ? null : canvas.toDataURL("image/png");
      if (image && image.length > 240000) image = canvas.toDataURL("image/jpeg", 0.8);
      state.sketches[id] = image;
      m.hasSketch = !empty;
      touch(id);
      if (state.guest) { status.textContent = "Kept for now (guests can't save)."; return; }
      status.textContent = "Saving…";
      try {
        await api("sketch", { method: "POST", body: { mission: id, image } });
        if (!dirty) status.textContent = "Sketch saved ✓";
      } catch (e) {
        if (e.status === 401) return sessionExpired();
        status.textContent = e.message;
        dirty = true;
      }
    }

    return h("div", { class: "fll-sketch" },
      h("div", { class: "fll-sketch-tools" },
        colorBtns, eraser,
        h("button", { type: "button", class: "fll-tool-btn", onclick: () => { if (!strokes.length) return; strokes.pop(); redraw(); changed(); } }, icon("fa-rotate-left"), " Undo"),
        h("button", {
          type: "button", class: "fll-tool-btn", onclick: () => {
            if (!confirm("Clear the whole drawing?")) return;
            strokes.length = 0; base = null; redraw(); changed();
          }
        }, icon("fa-trash-can"), " Clear"),
        status
      ),
      canvas,
      h("p", { class: "fll-muted small" }, "Draw your attachment from the side or from the top. Your sketch saves by itself.")
    );
  }

  /* Step 5 — Build & test */
  function testStats(m) {
    const last = m.trials.slice(-5);
    return { last, wins: last.filter(Boolean).length };
  }

  function canBeReady(data, m) {
    const checks = CHECKLIST.map((c) => c.id).concat(data.noTouch ? ["notouch"] : []);
    const allChecked = checks.every((c) => m.checklist[c]);
    const { last, wins } = testStats(m);
    return allChecked && last.length >= 5 && wins >= 4;
  }

  function stepTest(data, m) {
    const items = CHECKLIST.concat(data.noTouch ? [{ id: "notouch", text: "At the end, my attachment is NOT touching this model (no-touch rule)." }] : []);
    const checklist = h("div", { class: "fll-checklist" },
      items.map((c) => {
        const id = "fllChk_" + c.id;
        return h("label", { class: "fll-check", for: id },
          h("input", {
            type: "checkbox", id, checked: !!m.checklist[c.id],
            onchange: (e) => { m.checklist[c.id] = e.target.checked; if (!e.target.checked) m.ready = false; touch(data.id); render(); }
          }),
          h("span", {}, c.text));
      })
    );

    const { last, wins } = testStats(m);
    const trial = (ok) => { m.trials = [...m.trials, ok].slice(-30); if (!canBeReady(data, m)) m.ready = false; touch(data.id); render(); };

    const changeInput = h("input", { type: "text", id: "fllChange", maxlength: "200", placeholder: "Example: Made the hook 1 stud longer" });
    const addChange = () => {
      const t = changeInput.value.trim();
      if (!t) return;
      m.changes = [...m.changes, { text: t, at: Date.now() }].slice(-25);
      touch(data.id);
      render();
      const again = document.getElementById("fllChange");
      if (again) again.focus();
    };
    changeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addChange(); } });

    const readyOk = canBeReady(data, m);

    return h("div", {},
      h("h3", { class: "fll-step-title" }, icon("fa-flask"), " Step 5: Build it & test it"),
      h("p", {}, "Now build your attachment with real LEGO pieces, put it on your robot, and try the mission on the field."),
      h("h4", { class: "fll-sub" }, icon("fa-list-check"), " Builder checklist"),
      checklist,
      h("h4", { class: "fll-sub" }, icon("fa-vial"), " Test runs"),
      h("p", { class: "fll-muted" }, "After each try, tap a button. Real engineers test many times! Get 4 out of your last 5 tries to be mission-ready."),
      h("div", { class: "fll-row" },
        h("button", { class: "btn fll-btn-good", type: "button", onclick: () => trial(true) }, icon("fa-check"), " It worked!"),
        h("button", { class: "btn fll-btn-bad", type: "button", onclick: () => trial(false) }, icon("fa-xmark"), " It missed")
      ),
      h("div", { class: "fll-trials" },
        m.trials.length
          ? m.trials.slice(-15).map((t, i) => h("span", { class: "fll-trial " + (t ? "ok" : "no"), title: "Try " + (Math.max(0, m.trials.length - 15) + i + 1) }, icon(t ? "fa-check" : "fa-xmark")))
          : h("span", { class: "fll-muted small" }, "No tests yet."),
        m.trials.length ? h("button", { type: "button", class: "fll-link-btn small", onclick: () => { m.trials = m.trials.slice(0, -1); m.ready = false; touch(data.id); render(); } }, icon("fa-rotate-left"), " Undo last") : null
      ),
      h("p", { class: "fll-score" }, "Last 5 tries: ", h("strong", {}, wins + " / " + last.length), last.length < 5 ? " (keep testing!)" : ""),
      h("h4", { class: "fll-sub" }, icon("fa-wrench"), " What did you change?"),
      h("div", { class: "fll-row" }, changeInput, h("button", { class: "btn ghost fll-small-btn", type: "button", onclick: addChange }, icon("fa-plus"), " Add")),
      m.changes.length
        ? h("ul", { class: "fll-changes" }, m.changes.slice().reverse().map((c) => h("li", {}, h("span", { class: "fll-muted small" }, new Date(c.at).toLocaleDateString()), " ", c.text)))
        : null,
      m.ready
        ? h("div", { class: "fll-ready" },
            h("div", { class: "fll-ready-star" }, icon("fa-star")),
            h("h3", {}, "Mission ready!"),
            h("p", {}, "Awesome engineering! Your attachment for " + data.name + " works. Show your coach, then pick your next mission."),
            h("button", { class: "btn primary", type: "button", onclick: () => { state.view = "map"; render(); } }, icon("fa-map"), " Pick another mission"))
        : h("div", { class: "fll-nav-row" },
            h("button", { class: "btn ghost", type: "button", onclick: () => goStep(4) }, icon("fa-arrow-left"), " Back"),
            h("button", {
              class: "btn primary", type: "button", disabled: !readyOk,
              title: readyOk ? "" : "Check every box and get 4 of your last 5 tries",
              onclick: () => { m.ready = true; touch(data.id); saveNow(); render(); }
            }, icon("fa-star"), " Mark mission ready"))
    );
  }

  /* ---------- start ---------- */

  async function init() {
    render();
    try {
      const status = await api("status");
      state.serverReady = !!status.ready;
    } catch (e) {
      state.serverReady = false;
    }
    if (state.serverReady) {
      try {
        const me = await api("me");
        if (me.user && me.user.role === "kid") return startSession(me.user);
      } catch (e) { /* not logged in */ }
    }
    state.view = "login";
    render();
  }

  init();
})();
