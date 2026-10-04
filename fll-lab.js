/* ==========================================
   KIDS GAMES — tab switcher + FLL ATTACHMENT LAB
   Kids pick a BIOGLOW mission, build an attachment from LEGO
   pieces in 3D (fll-builder.js), and test it on the mission.
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

  const { LINKS, MISSIONS, RULES } = window.FLL_DATA;
  const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

  const STATUS = {
    new:      { label: "Not started", cls: "st-new" },
    building: { label: "Building",    cls: "st-design" },
    testing:  { label: "Testing",     cls: "st-test" },
    ready:    { label: "Works!",      cls: "st-ready" }
  };

  const state = {
    user: null,
    guest: false,
    progress: { version: 2, missions: {} },
    view: "loading",
    missionId: null,
    serverReady: true,
    builder: null
  };

  let builderModule = null;
  const loadBuilder = () => builderModule || (builderModule = import("./fll-builder.js"));

  /* ---------- small helpers ---------- */

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
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
    const m = all[id] || (all[id] = {});
    if (!m.build || !Array.isArray(m.build.pieces)) m.build = { pieces: [], motorAngle: 0, lane: 0 };
    if (typeof m.tests !== "number") m.tests = 0;
    if (!Array.isArray(m.realTries)) m.realTries = [];
    if (!STATUS[m.status]) m.status = computeStatus(m);
    return m;
  }

  function statusOf(id) {
    const m = state.progress.missions[id];
    return m && STATUS[m.status] ? m.status : "new";
  }

  function computeStatus(m) {
    if (m.passed) return "ready";
    if (m.tests > 0) return "testing";
    if (m.build && m.build.pieces && m.build.pieces.length) return "building";
    return "new";
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
    saveTimer = setTimeout(saveNow, 1500);
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
    if (state.builder) {
      state.builder.dispose();
      state.builder = null;
    }
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
      ? h("p", { class: "fll-note" }, icon("fa-circle-info"), " Saving isn't switched on yet, but you can still play as a guest.")
      : null;

    return h("div", { class: "fll-login" },
      h("div", { class: "fll-card fll-login-card" },
        h("div", { class: "fll-login-icon" }, icon("fa-robot")),
        h("h3", {}, "Welcome, engineer!"),
        h("p", { class: "fll-muted" }, "Log in with the username and password your coach gave you."),
        notReady,
        state.serverReady ? form : null,
        h("div", { class: "fll-or" }, h("span", {}, "or")),
        h("button", { class: "btn ghost", type: "button", onclick: () => { state.guest = true; state.view = "map"; render(); } },
          icon("fa-compass"), " Play as a guest (nothing is saved)")
      ),
      introCard()
    );
  }

  function introCard() {
    return h("div", { class: "fll-card fll-intro-card" },
      h("h3", {}, icon("fa-cubes"), " How it works"),
      h("ol", { class: "fll-how" },
        h("li", {}, icon("fa-map"), h("span", {}, "Pick a mission")),
        h("li", {}, icon("fa-cubes"), h("span", {}, "Snap LEGO pieces onto the robot")),
        h("li", {}, icon("fa-play"), h("span", {}, "Test it on the mission")),
        h("li", {}, icon("fa-wrench"), h("span", {}, "Fix it until it works")),
        h("li", {}, icon("fa-robot"), h("span", {}, "Build it for real!"))
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
      state.progress = { version: 2, missions: {}, ...p };
    } catch (e) {
      if (e.status === 401) return sessionExpired();
      state.progress = { version: 2, missions: {} };
    }
    saveState = "saved";
    state.view = "map";
    render();
  }

  async function logout() {
    if (!state.guest) {
      await saveNow();
      try { await api("logout", { method: "POST" }); } catch (e) { /* ignore */ }
    }
    state.user = null;
    state.guest = false;
    state.progress = { version: 2, missions: {} };
    state.view = "login";
    render();
  }

  /* ---------- header ---------- */

  function header() {
    const who = state.guest
      ? h("span", { class: "fll-who" }, icon("fa-user-secret"), " Guest")
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
    const ready = MISSIONS.filter((m) => statusOf(m.id) === "ready").length;
    const pct = Math.round((ready / MISSIONS.length) * 100);

    return h("div", { class: "fll-map" },
      header(),
      h("div", { class: "fll-summary fll-card" },
        h("div", {}, h("h3", {}, "Pick a mission")),
        h("div", { class: "fll-summary-stats" },
          h("div", { class: "fll-stat" }, h("strong", {}, ready + " / " + MISSIONS.length), h("span", {}, "working"))
        ),
        h("div", { class: "fll-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct), "aria-label": "Missions working" },
          h("div", { class: "fll-bar-fill", style: "width:" + pct + "%" }))
      ),
      h("div", { class: "fll-grid" }, MISSIONS.map(missionCard)),
      rulesCard(),
      resourcesCard()
    );
  }

  function badges(m) {
    return [
      m.noTouch ? h("span", { class: "fll-badge b-notouch", title: "Your attachment can't be touching this model when the match ends" }, icon("fa-hand"), " No-touch") : null,
      m.dock ? h("span", { class: "fll-badge b-dock", title: "Goes on a dock you choose before the match" }, icon("fa-anchor"), " Dock") : null,
      m.teamwork ? h("span", { class: "fll-badge b-team", title: "Works together with the other team's table" }, icon("fa-handshake"), " Teamwork") : null
    ];
  }

  function missionCard(m) {
    const s = statusOf(m.id);
    const rec = state.progress.missions[m.id];
    const pieces = rec && rec.build && rec.build.pieces ? rec.build.pieces.length : 0;
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
      pieces ? h("p", { class: "fll-mc-pieces" }, icon("fa-cubes"), " " + pieces + " piece" + (pieces === 1 ? "" : "s")) : null
    );
  }

  function rulesCard() {
    return h("details", { class: "fll-card fll-details" },
      h("summary", {}, icon("fa-scale-balanced"), " Robot rules"),
      h("ul", { class: "fll-list" }, RULES.map((r) => h("li", {}, r))),
      h("p", { class: "fll-muted small" }, "Short version. The official Robot Game Rulebook and Challenge Updates always win.")
    );
  }

  function resourcesCard() {
    const link = (href, ic, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer", class: "fll-resource" }, icon(ic), " ", text);
    return h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-book-open"), " Official BIOGLOW resources"),
      h("div", { class: "fll-resources" },
        link(LINKS.missionsVideo, "fa-circle-play", "Missions video"),
        link(LINKS.fieldSetupVideo, "fa-circle-play", "Field setup video"),
        link(LINKS.rulebook, "fa-file-pdf", "Rulebook"),
        link(LINKS.updates, "fa-file-circle-exclamation", "Challenge Updates"),
        link(LINKS.materials, "fa-cubes", "Model building instructions")
      )
    );
  }

  /* ---------- mission workspace ---------- */

  function openMission(id) {
    state.missionId = id;
    state.view = "mission";
    mission(id);
    render();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function viewMission() {
    const data = MISSION_BY_ID[state.missionId];
    const m = mission(data.id);
    const mount = h("div", { class: "fll-builder-mount" },
      h("div", { class: "fll-card fll-center" }, icon("fa-spinner fa-spin"), " Getting the LEGO pieces out…"));
    const after = h("div", { class: "fll-after" });

    const view = h("div", { class: "fll-mission", style: "--accent:" + data.color },
      header(),
      h("button", { class: "fll-link-btn fll-back", type: "button", onclick: () => { state.view = "map"; render(); } },
        icon("fa-arrow-left"), " All missions"),
      h("div", { class: "fll-card fll-mission-head" },
        h("div", { class: "fll-mh-icon" }, icon(data.icon)),
        h("div", { class: "fll-mh-text" },
          h("p", { class: "fll-mh-num" }, "Mission " + data.id.slice(1) + " · " + data.points + " pts"),
          h("h3", {}, data.name),
          h("p", { class: "fll-mh-goal" }, icon("fa-bullseye"), " ", data.goal),
          h("div", { class: "fll-badges" }, badges(data))
        ),
        h("div", { class: "fll-mh-links" },
          h("a", { class: "btn ghost fll-small-btn", href: LINKS.missionsVideo, target: "_blank", rel: "noopener noreferrer" }, icon("fa-circle-play"), " Video"),
          data.book && window.FLL_DATA.BOOK_URL
            ? h("a", { class: "btn ghost fll-small-btn", href: window.FLL_DATA.BOOK_URL(data.book), target: "_blank", rel: "noopener noreferrer", title: "Official building instructions for this mission model" }, icon("fa-book"), " Model")
            : null
        )
      ),
      mount,
      after
    );

    renderAfter(after, data, m);

    loadBuilder().then((mod) => {
      if (state.view !== "mission" || state.missionId !== data.id || !mount.isConnected) return;
      state.builder = mod.createBuilder(mount, {
        mission: data,
        build: m.build,
        onChange: (build) => { m.build = build; touch(data.id); },
        onTest: (res, build) => {
          m.build = build;
          m.tests += 1;
          m.lastOk = res.ok;
          if (res.ok) m.passed = true;
          touch(data.id);
          saveNow();
          renderAfter(after, data, m, res.ok);
        }
      });
    }).catch(() => {
      mount.replaceChildren(h("div", { class: "fll-card fll-center" }, icon("fa-triangle-exclamation"),
        " The 3D builder couldn't load. Check your internet connection and refresh the page."));
    });

    return view;
  }

  // The part under the builder: celebration + "did it work on the real robot?"
  function renderAfter(el, data, m, justPassed) {
    if (!m.passed) { el.replaceChildren(); return; }
    const wins = m.realTries.filter(Boolean).length;
    const tally = h("div", { class: "fll-real" },
      h("p", {}, icon("fa-robot"), h("strong", {}, " Now build it with real LEGO and try it on the field!")),
      h("div", { class: "fll-row" },
        h("button", { class: "btn fll-btn-good", type: "button", onclick: () => addTry(true) }, icon("fa-check"), " It worked"),
        h("button", { class: "btn fll-btn-bad", type: "button", onclick: () => addTry(false) }, icon("fa-xmark"), " It missed"),
        m.realTries.length ? h("span", { class: "fll-score" }, "Real robot: " + wins + " of " + m.realTries.length + " worked") : null
      )
    );
    function addTry(ok) {
      m.realTries = [...m.realTries, ok].slice(-30);
      touch(data.id);
      renderAfter(el, data, m);
    }
    el.replaceChildren(h("div", { class: "fll-ready" + (justPassed ? " pop" : "") },
      h("div", { class: "fll-ready-star" }, icon("fa-star")),
      h("h3", {}, "Your " + data.name + " attachment works!"),
      tally,
      h("button", { class: "btn ghost", type: "button", onclick: () => { state.view = "map"; render(); } }, icon("fa-map"), " Pick another mission")
    ));
  }

  /* ---------- start ---------- */

  async function init() {
    render();
    loadBuilder().catch(() => { builderModule = null; });
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
