/* ==========================================
   FLL ATTACHMENT LAB — coach dashboard
   Create student logins, reset passwords, and
   review each student's mission work.
========================================== */

(function () {
  const root = document.getElementById("coachApp");
  const { MISSIONS, LINKS } = window.FLL_DATA;

  const STATUS = {
    new: ["Not started", "st-new"],
    building: ["Building", "st-design"],
    testing: ["Testing", "st-test"],
    ready: ["Works", "st-ready"]
  };
  const statusOf = (s) => STATUS[s] || STATUS.new;

  let builderModule = null;
  const loadBuilder = () => builderModule || (builderModule = import("./fll-builder.js"));
  let viewers = [];

  // Short, easy-to-spell words so 9-11 year olds can remember passwords like "happy-panda-42".
  const WORDS_A = ["red", "blue", "green", "happy", "sunny", "lucky", "super", "funny", "fast", "cool", "brave", "jolly"];
  const WORDS_B = ["cat", "dog", "frog", "lion", "tiger", "panda", "robot", "rocket", "star", "moon", "fish", "duck"];

  const state = { view: "loading", users: [], team: "", lastCard: null, bulkCards: null, bulkFailed: null, detail: null, error: "" };

  /* ---------- helpers ---------- */

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
  const icon = (n) => h("i", { class: (n.startsWith("fa-brands") ? "" : "fa-solid ") + n, "aria-hidden": "true" });

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
      const err = new Error(data.error || "Something went wrong.");
      err.status = res.status;
      if (res.status === 401 && action !== "login") { state.view = "login"; state.error = "Please log in again."; render(); }
      throw err;
    }
    return data;
  }

  function randInt(n) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  }

  function makePassword() {
    return WORDS_A[randInt(WORDS_A.length)] + "-" + WORDS_B[randInt(WORDS_B.length)] + "-" + (10 + randInt(90));
  }

  // Kids log in with just their first name, e.g. "Saanvi" -> "saanvi".
  function suggestUsername(name, withNumber) {
    let base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "").slice(0, 20);
    if (!base) return "";
    if (withNumber || base.length < 3) base += 10 + randInt(90);
    return base;
  }

  function ago(ts) {
    if (!ts) return "never";
    const s = Date.now() / 1000 - ts;
    if (s < 90) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " days ago";
  }

  function siteUrl() {
    return location.origin + "/game.html#fll";
  }

  /* ---------- render ---------- */

  function render() {
    viewers.forEach((v) => v.dispose());
    viewers = [];
    const views = { loading: () => h("div", { class: "fll-card fll-center" }, icon("fa-spinner fa-spin"), " Loading…"), login: viewLogin, setup: viewSetup, dash: viewDash, detail: viewDetail };
    root.replaceChildren(views[state.view]());
  }

  function viewSetup() {
    return h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-plug"), " The save server isn't set up yet"),
      h("p", { class: "fll-muted" }, "Add an Upstash Redis database to this Vercel project and set ADMIN_USERNAME, ADMIN_PASSWORD and SESSION_SECRET in Vercel → Settings → Environment Variables, then redeploy. See FLL-SETUP.md in the website repository.")
    );
  }

  function viewLogin() {
    const user = h("input", { type: "text", id: "cUser", autocomplete: "username", autocapitalize: "none", required: true });
    const pass = h("input", { type: "password", id: "cPass", autocomplete: "current-password", required: true });
    const msg = h("p", { class: "fll-msg", role: "alert" }, state.error);
    const btn = h("button", { class: "btn primary", type: "submit" }, icon("fa-right-to-bracket"), " Log in");
    return h("div", { class: "fll-card", style: "max-width:440px" },
      h("h3", {}, icon("fa-user-shield"), " Coach login"),
      h("form", {
        class: "coach-form",
        onsubmit: async (e) => {
          e.preventDefault();
          btn.disabled = true;
          msg.textContent = "Checking…";
          try {
            const data = await api("login", { method: "POST", body: { username: user.value, password: pass.value } });
            if (data.user.role !== "coach") {
              await api("logout", { method: "POST" });
              throw new Error("That's a student account. Students play on the Kids Game page.");
            }
            state.error = "";
            await loadUsers();
          } catch (err) {
            msg.textContent = err.message;
            btn.disabled = false;
          }
        }
      },
        h("label", { for: "cUser" }, "Username"), user,
        h("label", { for: "cPass" }, "Password"), pass,
        btn, msg)
    );
  }

  async function loadUsers() {
    const data = await api("users");
    state.users = data.users;
    state.view = "dash";
    render();
  }

  async function logout() {
    try { await api("logout", { method: "POST" }); } catch (e) { /* ignore */ }
    state.view = "login";
    state.lastCard = null;
    render();
  }

  /* ---------- dashboard ---------- */

  function viewDash() {
    const teams = [...new Set(state.users.map((u) => u.team).filter(Boolean))].sort();
    const shown = state.team ? state.users.filter((u) => u.team === state.team) : state.users;

    return h("div", {},
      h("div", { class: "fll-header" },
        h("span", { class: "fll-who" }, icon("fa-user-shield"), " Coach"),
        h("span", { class: "fll-save" }, state.users.length + " student" + (state.users.length === 1 ? "" : "s")),
        h("button", { class: "fll-link-btn", type: "button", onclick: () => loadUsers() }, icon("fa-rotate"), " Refresh"),
        h("button", { class: "fll-link-btn", type: "button", onclick: logout }, icon("fa-right-from-bracket"), " Log out")
      ),
      h("div", { class: "coach-grid" },
        h("div", {}, createForm(teams), bulkForm(teams)),
        h("div", {},
          h("div", { class: "fll-card" },
            h("div", { class: "coach-toolbar" },
              h("h3", {}, icon("fa-table-cells"), " Team progress"),
              teams.length ? teamFilter(teams) : null
            ),
            shown.length ? matrix(shown) : h("p", { class: "fll-muted" }, "No students yet. Add your first student on the left.")
          ),
          shown.length ? h("div", { class: "fll-card" }, h("h3", {}, icon("fa-users"), " Students"), studentTable(shown)) : null,
          resources()
        )
      )
    );
  }

  function teamFilter(teams) {
    const sel = h("select", { "aria-label": "Filter by team", onchange: (e) => { state.team = e.target.value; render(); } },
      h("option", { value: "" }, "All teams"),
      teams.map((t) => h("option", { value: t, selected: t === state.team }, t)));
    return sel;
  }

  function createForm(teams) {
    const name = h("input", { type: "text", id: "nName", maxlength: "40", required: true, placeholder: "e.g. Maya" });
    const team = h("input", { type: "text", id: "nTeam", maxlength: "40", list: "teamList", placeholder: "e.g. Robo Rangers", value: state.team || state.lastTeam || "" });
    const username = h("input", { type: "text", id: "nUser", maxlength: "24", required: true, autocapitalize: "none", spellcheck: "false" });
    const password = h("input", { type: "text", id: "nPass", maxlength: "64", required: true, value: makePassword(), spellcheck: "false" });
    const msg = h("p", { class: "fll-msg", role: "alert" });
    let userEdited = false;
    username.addEventListener("input", () => { userEdited = true; });
    name.addEventListener("input", () => { if (!userEdited) username.value = suggestUsername(name.value); });

    const btn = h("button", { class: "btn primary", type: "submit" }, icon("fa-user-plus"), " Create login");

    const form = h("form", {
      class: "coach-form",
      onsubmit: async (e) => {
        e.preventDefault();
        btn.disabled = true;
        msg.textContent = "";
        try {
          const body = { name: name.value, team: team.value, username: username.value.trim().toLowerCase(), password: password.value };
          await api("create_user", { method: "POST", body });
          state.lastCard = { name: body.name, team: body.team, username: body.username, password: body.password, kind: "new" };
          state.lastTeam = body.team;
          state.team = state.team && body.team !== state.team ? "" : state.team;
          await loadUsers();
        } catch (err) {
          msg.textContent = err.message;
          btn.disabled = false;
        }
      }
    },
      h("label", { for: "nName" }, "Student's first name"), name,
      h("label", { for: "nTeam" }, "Team (optional)"), team,
      h("datalist", { id: "teamList" }, teams.map((t) => h("option", { value: t }))),
      h("label", { for: "nUser" }, "Username"), username,
      h("label", { for: "nPass" }, "Password"),
      h("div", { class: "coach-inline" }, password,
        h("button", { class: "fll-tool-btn", type: "button", onclick: () => { password.value = makePassword(); } }, icon("fa-dice"), " New")),
      btn, msg
    );

    return h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-user-plus"), " Add a student"),
      h("p", { class: "fll-muted small" }, "Use first names only — no last names, emails or birthdays are needed."),
      form,
      state.lastCard ? loginCard(state.lastCard) : null
    );
  }

  function bulkForm(teams) {
    const names = h("textarea", { id: "bNames", rows: "8", class: "coach-textarea", placeholder: "One first name per line\nMaya\nLeo\nAisha" });
    const team = h("input", { type: "text", id: "bTeam", maxlength: "40", list: "teamList", placeholder: "e.g. Robo Rangers", value: state.team || state.lastTeam || "" });
    const msg = h("p", { class: "fll-msg", role: "alert" });
    const btn = h("button", { class: "btn primary", type: "submit" }, icon("fa-users"), " Create all logins");

    const form = h("form", {
      class: "coach-form",
      onsubmit: async (e) => {
        e.preventDefault();
        const list = [...new Set(names.value.split(/[\n,]+/).map((n) => n.trim()).filter(Boolean))];
        if (!list.length) { msg.textContent = "Type at least one name."; return; }
        if (list.length > 60) { msg.textContent = "Please add 60 or fewer at a time."; return; }
        btn.disabled = true;
        const made = [];
        const failed = [];
        for (let i = 0; i < list.length; i++) {
          const name = list[i].slice(0, 40);
          msg.textContent = "Creating " + (i + 1) + " of " + list.length + "…";
          const password = makePassword();
          let error = "username taken";
          for (let attempt = 0; attempt < 4; attempt++) {
            const username = suggestUsername(name, attempt > 0);
            try {
              await api("create_user", { method: "POST", body: { name, team: team.value, username, password } });
              made.push({ name, team: team.value, username, password });
              error = null;
              break;
            } catch (err) {
              if (err.status !== 409) { error = err.message; break; }
            }
          }
          if (error) failed.push(name + " (" + error + ")");
        }
        state.bulkCards = made;
        state.bulkFailed = failed;
        state.lastTeam = team.value;
        await loadUsers();
      }
    },
      h("label", { for: "bNames" }, "Student first names (one per line)"), names,
      h("label", { for: "bTeam" }, "Team (optional)"), team,
      btn, msg
    );

    return h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-users"), " Add many students"),
      h("p", { class: "fll-muted small" }, "Usernames are the student's first name. Easy passwords like happy-panda-42 are made for you."),
      form,
      state.bulkFailed && state.bulkFailed.length ? h("p", { class: "fll-note warn" }, icon("fa-triangle-exclamation"), " Not created: " + state.bulkFailed.join(", ")) : null,
      state.bulkCards && state.bulkCards.length ? bulkCards(state.bulkCards) : null
    );
  }

  function bulkCards(cards) {
    const text = "FLL Attachment Lab logins\nWebsite: " + siteUrl() + "\n\n" +
      cards.map((c) => c.name + "  |  username: " + c.username + "  |  password: " + c.password).join("\n");
    const copyBtn = h("button", {
      class: "fll-tool-btn", type: "button",
      onclick: async () => {
        try { await navigator.clipboard.writeText(text); copyBtn.textContent = "Copied ✓"; } catch (e) { copyBtn.textContent = "Copy failed"; }
      }
    }, icon("fa-copy"), " Copy all");
    return h("div", { class: "coach-card-out" },
      h("strong", {}, icon("fa-id-card"), " " + cards.length + " login" + (cards.length === 1 ? "" : "s") + " created"),
      h("div", { class: "coach-table-wrap" },
        h("table", { class: "coach-table" },
          h("thead", {}, h("tr", {}, h("th", {}, "Name"), h("th", {}, "Username"), h("th", {}, "Password"))),
          h("tbody", {}, cards.map((c) => h("tr", {}, h("td", {}, c.name), h("td", {}, h("code", {}, c.username)), h("td", {}, h("code", {}, c.password)))))
        )
      ),
      h("p", { class: "fll-note warn" }, icon("fa-triangle-exclamation"), " Copy or print these now. Passwords can't be shown again — but you can always reset one."),
      h("div", { class: "coach-inline" },
        copyBtn,
        h("button", { class: "fll-tool-btn", type: "button", onclick: () => printCards(cards) }, icon("fa-print"), " Print cards"),
        h("button", { class: "fll-tool-btn", type: "button", onclick: () => { state.bulkCards = null; state.bulkFailed = null; render(); } }, icon("fa-xmark"), " Done"))
    );
  }

  function loginCard(c) {
    const text = "FLL Attachment Lab login for " + c.name + "\nWebsite: " + siteUrl() + "\nUsername: " + c.username + "\nPassword: " + c.password;
    const copyBtn = h("button", {
      class: "fll-tool-btn", type: "button",
      onclick: async () => {
        try { await navigator.clipboard.writeText(text); copyBtn.textContent = "Copied ✓"; } catch (e) { copyBtn.textContent = "Copy failed"; }
      }
    }, icon("fa-copy"), " Copy");
    return h("div", { class: "coach-card-out" },
      h("strong", {}, icon("fa-id-card"), c.kind === "reset" ? " New password for " : " Login card for ", c.name),
      h("dl", {},
        h("dt", {}, "Website"), h("dd", {}, siteUrl()),
        h("dt", {}, "Username"), h("dd", {}, c.username),
        h("dt", {}, "Password"), h("dd", {}, c.password)
      ),
      h("p", { class: "fll-note warn" }, icon("fa-triangle-exclamation"), " Copy or print this now. Passwords are stored securely and can't be shown again — but you can always reset one."),
      h("div", { class: "coach-inline" },
        copyBtn,
        h("button", { class: "fll-tool-btn", type: "button", onclick: () => printCards([c]) }, icon("fa-print"), " Print"),
        h("button", { class: "fll-tool-btn", type: "button", onclick: () => { state.lastCard = null; render(); } }, icon("fa-xmark"), " Done"))
    );
  }

  function printCards(cards) {
    const pc = document.getElementById("printCard");
    pc.replaceChildren(...cards.map((c) => h("div", { class: "pc" },
      h("h2", {}, "FLL Attachment Lab"),
      h("p", {}, "Hi ", h("strong", {}, c.name), "! Here is your login."),
      h("p", {}, "Website: ", h("code", {}, siteUrl())),
      h("p", {}, "Username: ", h("code", {}, c.username)),
      h("p", {}, "Password: ", h("code", {}, c.password)),
      h("p", {}, "Keep this card safe and don't share your password.")
    )));
    window.print();
  }

  function matrix(users) {
    return h("div", {},
      h("div", { class: "coach-legend" },
        Object.entries(STATUS).map(([k, [label, cls]]) => h("span", {}, h("span", { class: "sq " + cls }), label))),
      h("div", { class: "coach-table-wrap" },
        h("table", { class: "coach-table coach-matrix" },
          h("thead", {}, h("tr", {}, h("th", {}, "Student"), MISSIONS.map((m) => h("th", { title: m.name, class: "cell" }, m.id.slice(1))))),
          h("tbody", {}, users.map((u) => h("tr", {},
            h("td", {}, h("button", { class: "fll-link-btn", type: "button", onclick: () => openDetail(u.username) }, u.name)),
            MISSIONS.map((m) => {
              const [label, cls] = statusOf((u.missions[m.id] || {}).status);
              return h("td", { class: "cell" }, h("span", { class: "sq " + cls, title: u.name + " · " + m.id + " " + m.name + ": " + label }));
            })
          )))
        )
      )
    );
  }

  function studentTable(users) {
    return h("div", { class: "coach-table-wrap" },
      h("table", { class: "coach-table" },
        h("thead", {}, h("tr", {}, ["Name", "Team", "Username", "Ready", "Working on", "Last active", ""].map((t) => h("th", {}, t)))),
        h("tbody", {}, users.map((u) => {
          const statuses = Object.values(u.missions).map((m) => m.status);
          const ready = statuses.filter((s) => s === "ready").length;
          const active = statuses.filter((s) => s && s !== "ready" && s !== "new").length;
          return h("tr", {},
            h("td", {}, h("strong", {}, u.name)),
            h("td", {}, u.team || "—"),
            h("td", {}, h("code", {}, u.username)),
            h("td", {}, String(ready)),
            h("td", {}, String(active)),
            h("td", {}, ago(u.lastActive)),
            h("td", {},
              h("button", { class: "fll-tool-btn", type: "button", onclick: () => openDetail(u.username) }, icon("fa-eye"), " View"),
              h("button", { class: "fll-tool-btn", type: "button", onclick: () => resetPassword(u) }, icon("fa-key"), " Reset"),
              h("button", { class: "fll-tool-btn", type: "button", onclick: () => deleteUser(u) }, icon("fa-trash-can"), " Delete"))
          );
        }))
      )
    );
  }

  async function resetPassword(u) {
    const pw = prompt("New password for " + u.name + " (6+ characters):", makePassword());
    if (pw === null) return;
    try {
      await api("reset_password", { method: "POST", body: { username: u.username, password: pw } });
      state.lastCard = { name: u.name, team: u.team, username: u.username, password: pw, kind: "reset" };
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      alert(e.message);
    }
  }

  async function deleteUser(u) {
    if (!confirm("Delete " + u.name + " (" + u.username + ") and ALL of their work? This can't be undone.")) return;
    try {
      await api("delete_user", { method: "POST", body: { username: u.username } });
      await loadUsers();
    } catch (e) {
      alert(e.message);
    }
  }

  function resources() {
    const link = (href, ic, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer", class: "fll-resource" }, icon(ic), " ", text);
    return h("div", {},
      h("div", { class: "fll-card" },
        h("h3", {}, icon("fa-book-open"), " Official resources"),
        h("div", { class: "fll-resources" },
          link(LINKS.season, "fa-leaf", "BIOGLOW season page"),
          link(LINKS.rulebook, "fa-file-pdf", "Robot Game Rulebook"),
          link(LINKS.updates, "fa-file-circle-exclamation", "Challenge Updates"),
          link(LINKS.missionsVideo, "fa-circle-play", "Missions video"),
          link(LINKS.fieldSetupVideo, "fa-circle-play", "Field setup video"),
          link(LINKS.materials, "fa-cubes", "Building instructions & all materials")
        )
      ),
      h("div", { class: "fll-card coach-spoiler" },
        h("h3", {}, icon("fa-eye-slash"), " Coach-only: community solution videos"),
        h("p", { class: "fll-muted small" }, "These show complete solutions. They're useful for you to understand a mission — but try not to show them to students before they've designed their own idea."),
        h("div", { class: "fll-resources" },
          link("https://www.youtube.com/watch?v=KVfVDjWXRNY", "fa-brands fa-youtube", "BIOGLOW overview"),
          link("https://www.youtube.com/watch?v=fd2QyWyT3ac", "fa-brands fa-youtube", "Single mission runs"),
          link("https://www.youtube.com/watch?v=KWLmWv3EbVE", "fa-brands fa-youtube", "M02 Exploding Seeds"),
          link("https://www.youtube.com/watch?v=2_PzZpxqtqQ", "fa-brands fa-youtube", "M03 Flip the Rock"),
          link("https://www.youtube.com/watch?v=OyvSaDPghCg", "fa-brands fa-youtube", "M05 Reaching Roots"),
          link("https://www.youtube.com/watch?v=5O3BEnN2-BE", "fa-brands fa-youtube", "M14 Seeds of Renewal"),
          link("https://www.youtube.com/watch?v=tE8gCEMMeg0", "fa-brands fa-youtube", "M15 Biocentric Architecture"),
          link("https://elearn.robopartans.com/competitions/first-lego-league/2026-bioglow/tips-and-tricks", "fa-lightbulb", "Robopartans tips & tricks")
        )
      )
    );
  }

  /* ---------- student detail ---------- */

  async function openDetail(username) {
    state.view = "loading";
    render();
    try {
      const data = await api("user_progress", { query: { username } });
      state.detail = data;
      state.view = "detail";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e.status !== 401) { alert(e.message); state.view = "dash"; render(); }
    }
  }

  function viewDetail() {
    const { user, progress } = state.detail;
    const missions = (progress && progress.missions) || {};
    const worked = MISSIONS.filter((m) => {
      const r = missions[m.id];
      return r && ((r.build && r.build.pieces && r.build.pieces.length) || r.tests);
    });
    return h("div", {},
      h("button", { class: "fll-link-btn fll-back", type: "button", onclick: () => { state.view = "dash"; render(); } }, icon("fa-arrow-left"), " Back to dashboard"),
      h("div", { class: "fll-card" },
        h("h3", {}, icon("fa-user-astronaut"), " ", user.name, user.team ? " · " + user.team : ""),
        h("p", { class: "fll-muted" }, "Username: ", h("code", {}, user.username), " · Last saved: ", progress.savedAt ? new Date(progress.savedAt * 1000).toLocaleString() : "never")
      ),
      worked.length
        ? worked.map((m) => missionDetail(m, missions[m.id]))
        : h("div", { class: "fll-card fll-muted" }, "This student hasn't built anything yet.")
    );
  }

  function missionDetail(m, r) {
    const [label, cls] = statusOf(r.status);
    const build = r.build || { pieces: [] };
    const pieces = (build.pieces || []).length;
    const motor = (build.pieces || []).some((p) => p.t === "motor");
    const real = r.realTries || [];
    const row = (k, v) => [h("dt", {}, k), h("dd", {}, v)];
    const slot = h("div", { class: "coach-viewer" });
    const showBtn = h("button", {
      class: "fll-tool-btn", type: "button",
      onclick: async () => {
        showBtn.disabled = true;
        slot.replaceChildren(h("p", { class: "fll-muted" }, icon("fa-spinner fa-spin"), " Loading 3D view…"));
        try {
          const mod = await loadBuilder();
          viewers.push(mod.createBuilder(slot, { mission: m, build, readOnly: true }));
          showBtn.remove();
        } catch (e) {
          slot.replaceChildren(h("p", { class: "fll-msg" }, "The 3D view couldn't load."));
          showBtn.disabled = false;
        }
      }
    }, icon("fa-cube"), " Open 3D build");
    return h("div", { class: "coach-mission" },
      h("h4", {}, m.id + " " + m.name, h("span", { class: "fll-status " + cls }, label)),
      h("dl", {},
        row("Pieces", pieces + (motor ? " (with motor, turns " + (build.motorAngle || 0) + "°)" : " (no motor)")),
        row("Tests", String(r.tests || 0) + (r.tests ? (r.lastOk ? " · last test worked" : " · last test didn't work") : "")),
        row("Virtual test", r.passed ? "Passed ★" : "Not passed yet"),
        real.length ? row("Real robot", real.filter(Boolean).length + " of " + real.length + " tries worked") : null
      ),
      pieces ? showBtn : null,
      slot
    );
  }

  /* ---------- start ---------- */

  async function init() {
    render();
    try {
      const s = await api("status");
      if (!s.ready) { state.view = "setup"; return render(); }
    } catch (e) {
      state.view = "setup";
      return render();
    }
    try {
      const me = await fetch("/api/fll?action=me", { credentials: "same-origin" });
      const data = await me.json();
      if (me.ok && data.user && data.user.role === "coach") return loadUsers();
    } catch (e) { /* not logged in */ }
    state.view = "login";
    render();
  }

  init();
})();
