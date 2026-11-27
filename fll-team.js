/* ==========================================
   TEAM CORNER (fll-team.html) — Mechanical Masters FLL
   Parents log in with their child's FLL login, say if they are the
   mother or father, then mark meeting availability, time away and
   volunteer for snacks / being present (with a time range). The coach plans meetings, sees
   everyone's availability and tracks mentors (who have no logins).
   Data lives in /api/fll (team* actions).
========================================== */
(function () {
  const root = document.getElementById("teamApp");
  if (!root) return;

  const KINDS = {
    snacks: { label: "Bring snacks", icon: "fa-cookie-bite" },
    present: { label: "Parent present at the meeting", icon: "fa-user-shield" }
  };
  // Parts of a meeting with no parent present: [[from, to], ...] ("HH:MM"). Mirrors presence_gaps() in api/fll.py.
  function presenceGaps(m, people) {
    const start = m.start || "", end = m.end || "";
    if (!(start && end && end > start)) return people.length ? [] : [["", ""]];
    const spans = people.map((p) => [p.from || start, p.to || end]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const gaps = [];
    let cur = start;
    for (const [a, b] of spans) {
      if (a > cur) gaps.push([cur, a < end ? a : end]);
      if (b > cur) cur = b;
      if (cur >= end) break;
    }
    if (cur < end) gaps.push([cur, end]);
    return gaps.filter((g) => g[0] < g[1]);
  }
  const gapText = (gaps) => gaps.map((g) => g[0] ? niceTime(g[0]) + "–" + niceTime(g[1]) : "whole meeting").join(", ");
  // Meetings and other team activities share one list; `type` says which.
  const TYPES = {
    meeting: { label: "Team meeting", icon: "fa-people-group" },
    zoo: { label: "Zoo visit", icon: "fa-hippo" },
    fundraiser: { label: "Fundraiser", icon: "fa-hand-holding-dollar" },
    team_visit: { label: "Visit another team", icon: "fa-handshake" },
    outreach: { label: "Outreach / demo", icon: "fa-bullhorn" },
    competition: { label: "Competition", icon: "fa-trophy" },
    other: { label: "Other activity", icon: "fa-star" }
  };
  const typeOf = (m) => TYPES[m.type] || TYPES.meeting;
  const eventName = (m) => m.title || typeOf(m).label;
  const ANSWERS = [
    { id: "yes", label: "Yes", mark: "✓" },
    { id: "maybe", label: "Maybe", mark: "?" },
    { id: "no", label: "No", mark: "✗" }
  ];
  const PARENT_KEY = "fllTeamParent:";

  const state = { user: null, parent: null, data: null, pub: null, editing: null, tab: null, showPast: false, msg: "", calMonth: null };

  /* ---------- helpers ---------- */

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
  const icon = (name) => h("i", { class: (name.startsWith("fa-brands") ? "" : "fa-solid ") + name, "aria-hidden": "true" });

  async function api(action, opts = {}) {
    const method = opts.method || "GET";
    const res = await fetch("/api/fll?action=" + action, {
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

  function today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function niceDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  function shortDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  function niceTime(t) {
    if (!t) return "";
    const [hh, mm] = t.split(":").map(Number);
    return new Date(2000, 0, 1, hh, mm).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function timeRange(m) {
    if (!m.start) return "";
    return niceTime(m.start) + (m.end ? " – " + niceTime(m.end) : "");
  }
  // "Priya (Mother)" when the parent's name is saved, otherwise just "Mother"
  const myParents = () => (state.data && state.data.mine && state.data.mine.parents) || {};
  // Saved parent names for a child: own child for parents, any child for the coach.
  function parentsOf(username) {
    if (!state.data) return {};
    if (state.data.mine) return username === state.user.username ? myParents() : {};
    const kid = (state.data.kids || []).find((k) => k.username === username);
    return (kid && kid.parents) || {};
  }
  // "Priya (Mother)" when the parent's name is known, otherwise just "Mother".
  function who(e, parents) {
    const name = e.name || (parents || {})[String(e.by || "").toLowerCase()];
    return name ? name + " (" + e.by + ")" : e.by;
  }
  const volName = (p) => {
    const name = p.name || parentsOf(p.u)[String(p.by || "").toLowerCase()];
    return name ? name + " (" + p.by + " of " + p.kid + ")" : p.by + " of " + p.kid;
  };
  const isAway = (awayList, date) => (awayList || []).some((a) => a.from <= date && date <= a.to);

  function visibleMeetings(includeCancelled) {
    const t = today();
    return state.data.meetings.filter((m) =>
      (state.showPast || m.date >= t) && (includeCancelled || m.status !== "cancelled"));
  }

  function flash(text) {
    state.msg = text;
    render();
  }

  // Answers that change the calendar's "kids / mentors coming" numbers (counted on the server).
  const COUNT_ACTIONS = new Set(["team_avail", "team_away", "team_mentor", "mentor_avail", "mentor_away", "team_meeting"]);

  async function act(action, body, after) {
    try {
      const res = await api(action, { method: "POST", body });
      state.msg = "";
      if (after) after(res);
      if (COUNT_ACTIONS.has(action) && state.data) {
        try { state.data.counts = (await api("team")).counts; } catch (e) { /* keep old numbers */ }
      }
    } catch (err) {
      state.msg = err.message;
      if (err.status === 401) { state.user = null; }
    }
    render();
  }

  async function reload() {
    try {
      state.data = await api("team");
    } catch (err) {
      if (err.status === 401) { state.user = null; state.data = null; }
      state.msg = err.message;
    }
    render();
  }

  /* ---------- login ---------- */

  function viewLogin(compact) {
    const msg = h("p", { class: "fll-msg", role: "alert" }, state.msg || "");
    const user = h("input", { id: "tUser", type: "text", autocomplete: "username", autocapitalize: "none", spellcheck: "false", required: true });
    const pass = h("input", { id: "tPass", type: "password", autocomplete: "current-password", required: true });
    const btn = h("button", { class: "btn primary", type: "submit" }, icon("fa-right-to-bracket"), " Log in");
    const form = h("form", {
      class: "fll-login-form",
      onsubmit: async (e) => {
        e.preventDefault();
        btn.disabled = true;
        msg.textContent = "Checking…";
        try {
          const data = await api("login", { method: "POST", body: { username: user.value, password: pass.value } });
          state.msg = "";
          await startSession(data.user);
        } catch (err) {
          msg.textContent = err.message;
          btn.disabled = false;
        }
      }
    },
      h("label", { for: "tUser" }, "Username (your child's, or your mentor login)"), user,
      h("label", { for: "tPass" }, "Password"), pass,
      btn, msg
    );
    if (compact) {
      return h("div", { class: "fll-card team-login-mini" },
        h("h3", {}, icon("fa-right-to-bracket"), " Parents, mentors & coach"),
        h("p", { class: "fll-muted small" }, "Parents: use your child's FLL login. Mentors: use the login the coach gave you."),
        form);
    }
    return h("div", { class: "fll-login" },
      h("div", { class: "fll-card fll-login-card" },
        h("div", { class: "fll-login-icon" }, icon("fa-people-group")),
        h("h3", {}, "Parents & team"),
        h("p", { class: "fll-muted" }, "Log in with your child's FLL login (the one they use for the Attachment Lab). " +
          "Here you can tell us when your child can come to meetings, add vacation dates, and sign up to bring snacks or to be there during a meeting."),
        form
      )
    );
  }

  function viewWhoAreYou() {
    const saved = myParents();
    const msg = h("p", { class: "fll-msg", role: "alert" });
    const row = (role, label, ic) => {
      const input = h("input", { type: "text", maxlength: "40", placeholder: label + "'s first name", value: saved[role] || "",
        "aria-label": label + "'s name" });
      const go = async () => {
        const name = input.value.trim();
        if (!name) { msg.textContent = "Please type your name first."; input.focus(); return; }
        try {
          if (name !== saved[role]) {
            const r = await api("team_parent", { method: "POST", body: { parent: role, name } });
            state.data.mine.parents = r.parents;
          }
          state.parent = role;
          try { localStorage.setItem(PARENT_KEY + state.user.username, role); } catch (e) { /* private mode */ }
          state.msg = "";
          render();
        } catch (err) { msg.textContent = err.message; }
      };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
      return h("div", { class: "who-row" },
        h("span", { class: "who-role" }, icon(ic), " ", label), input,
        h("button", { class: "btn primary fll-small-btn", type: "button", onclick: go }, "This is me"));
    };
    return h("div", { class: "fll-login" },
      h("div", { class: "fll-card fll-login-card" },
        h("div", { class: "fll-login-icon" }, icon("fa-user-check")),
        h("h3", {}, "Hi! Who is filling this in for " + state.user.name + "?"),
        h("p", { class: "fll-muted" }, "Type your name once and press \"This is me\". We remember both parents' names, " +
          "so next time you just pick yours. Your name is shown with your answers and sign-ups."),
        h("div", { class: "who-pick" }, row("mother", "Mother", "fa-person-dress"), row("father", "Father", "fa-person")),
        msg
      )
    );
  }

  async function startSession(user) {
    state.user = user;
    state.tab = user.role === "coach" ? "calendar" : "meetings";
    state.hours = null;
    if (user.role === "kid") {
      let saved = null;
      try { saved = localStorage.getItem(PARENT_KEY + user.username); } catch (e) { /* private mode */ }
      state.parent = saved === "mother" || saved === "father" ? saved : null;
    }
    await reload();
  }

  async function logout() {
    try { await api("logout", { method: "POST" }); } catch (e) { /* ignore */ }
    state.user = null;
    state.data = null;
    state.parent = null;
    state.msg = "";
    await loadPublic();
    render();
  }

  // Calendar for visitors who are not logged in (counts only).
  async function loadPublic() {
    try { state.pub = (await api("team_public")).meetings; } catch (e) { state.pub = null; }
  }

  function header() {
    const badge = state.user.role === "coach"
      ? h("span", { class: "fll-who" }, icon("fa-clipboard-user"), " Coach")
      : state.user.role === "mentor"
      ? h("span", { class: "fll-who" }, icon("fa-user-tie"), " ", state.user.name, " ", h("small", {}, "· Mentor"))
      : h("span", { class: "fll-who" }, icon("fa-user"), " ", state.user.name, " ",
        h("small", {}, "· filled in by ", who({ name: myParents()[state.parent], by: state.parent === "mother" ? "Mother" : "Father" }), " "),
        h("button", { class: "fll-link-btn", type: "button", onclick: () => { state.parent = null; render(); } }, "change"));
    return h("div", { class: "fll-header" },
      badge,
      h("button", { class: "fll-tool-btn", type: "button", onclick: logout }, icon("fa-right-from-bracket"), " Log out"));
  }

  function tabs(list) {
    return h("div", { class: "team-tabs", role: "tablist" },
      list.map(([id, label, ic]) => h("button", {
        class: "team-tab", type: "button", role: "tab", "aria-selected": state.tab === id ? "true" : "false",
        onclick: () => { state.tab = id; state.msg = ""; if (id === "hours") state.hours = null; render(); }
      }, icon(ic), " ", label)));
  }

  function pastToggle() {
    return h("label", { class: "fll-muted small" },
      h("input", { type: "checkbox", checked: state.showPast, onchange: (e) => { state.showPast = e.target.checked; render(); } }),
      " Show past meetings");
  }

  function meetingTitle(m) {
    return h("div", {},
      h("div", { class: "ev-name" + (m.type && m.type !== "meeting" ? " activity" : "") }, icon(typeOf(m).icon), " ", eventName(m)),
      h("div", { class: "when" }, niceDate(m.date), " ", h("span", { class: "badge " + m.status },
        m.status === "scheduled" ? "Confirmed" : m.status === "cancelled" ? "Cancelled" : "Proposed")),
      h("div", { class: "where" }, [timeRange(m), m.place, m.note].filter(Boolean).join(" · ")));
  }

  /* ---------- parent (kid login) views ---------- */

  function viewParentMeetings() {
    const mine = state.data.mine;
    const list = visibleMeetings(false);
    const card = h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-calendar-check"), " Can ", state.user.name, " come?"),
      h("p", { class: "fll-muted" }, "Answer for each meeting date. Proposed dates help the coach pick the best days; confirmed dates are happening."),
      pastToggle());
    if (!list.length) card.append(h("p", { class: "fll-muted" }, "No meeting dates yet. The coach will add them soon."));
    for (const m of list) {
      const ans = mine.avail[m.id];
      const away = isAway(mine.away, m.date);
      card.append(h("div", { class: "team-meeting" },
        h("div", {},
          meetingTitle(m),
          away ? h("span", { class: "badge away" }, icon("fa-plane"), " You marked time away") : null,
          ans ? h("div", { class: "by" }, "Answered by ", who(ans, myParents())) : null),
        h("div", { class: "team-choice" },
          ANSWERS.map((a) => h("button", {
            type: "button", class: a.id + (ans && ans.s === a.id ? " on" : ""),
            "aria-pressed": ans && ans.s === a.id ? "true" : "false",
            onclick: () => act("team_avail",
              { meetingId: m.id, status: ans && ans.s === a.id ? "" : a.id, parent: state.parent },
              (r) => { mine.avail = r.avail; })
          }, a.label)))));
    }
    return card;
  }

  function awayForm(onAdd) {
    const from = h("input", { type: "date", required: true });
    const to = h("input", { type: "date", required: true });
    const note = h("input", { type: "text", maxlength: "80", placeholder: "e.g. Winter vacation" });
    return h("form", {
      class: "team-form",
      onsubmit: (e) => {
        e.preventDefault();
        if (!to.value && from.value) to.value = from.value;
        onAdd({ from: from.value, to: to.value, note: note.value });
      }
    },
      h("label", {}, "From", from),
      h("label", {}, "To", to),
      h("label", {}, "Note (optional)", note),
      h("button", { class: "btn primary fll-small-btn", type: "submit" }, icon("fa-plus"), " Add"));
  }

  function awayList(list, onRemove) {
    if (!list.length) return h("p", { class: "fll-muted" }, "No time away added.");
    return h("ul", { class: "fll-list" }, list.map((a) => h("li", {},
      h("strong", {}, shortDate(a.from), a.to !== a.from ? " – " + shortDate(a.to) : ""),
      a.note ? " · " + a.note : "", " ",
      h("span", { class: "fll-muted small" }, "(added by ", who(a, myParents()), ") "),
      h("button", { class: "fll-link-btn", type: "button", onclick: () => onRemove(a) }, "remove"))));
  }

  function viewParentAway() {
    const mine = state.data.mine;
    return h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-plane"), " Vacations & time away"),
      h("p", { class: "fll-muted" }, "Add any dates ", state.user.name, " will be away (trips, holidays, other events). The coach sees these when planning meetings."),
      awayForm((v) => act("team_away", { op: "add", ...v, parent: state.parent }, (r) => { mine.away = r.away; })),
      awayList(mine.away, (a) => act("team_away", { op: "remove", id: a.id }, (r) => { mine.away = r.away; })));
  }

  // "Parent present": no spot limit; each parent picks the part of the meeting they can be there.
  function presenceSlot(m, canSignUp) {
    const vol = (state.data.volunteers[m.id] || {}).present || [];
    const myBy = state.parent === "mother" ? "Mother" : "Father";
    const me = canSignUp && vol.find((p) => p.u === state.user.username && p.by === myBy);
    const gaps = presenceGaps(m, vol);
    const save = (r) => { state.data.volunteers[m.id] = r.volunteers; };
    const box = h("div", { class: "vol-slot" },
      h("h5", {}, icon(KINDS.present.icon), " ", KINDS.present.label));
    for (const p of vol) {
      box.append(h("div", { class: "vol-person" }, icon("fa-check"), " ", volName(p),
        p.from && m.start ? h("span", { class: "fll-muted small" }, " · " + niceTime(p.from) + "–" + niceTime(p.to)) : null));
    }
    box.append(gaps.length
      ? h("div", { class: "vol-open" }, "Still needed: " + gapText(gaps))
      : h("div", { class: "vol-person" }, icon("fa-circle-check"), " Whole meeting covered — thank you!"));
    if (canSignUp) {
      const from = h("input", { type: "time", value: (me && me.from) || m.start || "", min: m.start || null, max: m.end || null, "aria-label": "From" });
      const to = h("input", { type: "time", value: (me && me.to) || m.end || "", min: m.start || null, max: m.end || null, "aria-label": "To" });
      const join = () => act("team_volunteer", { meetingId: m.id, kind: "present", join: true, parent: state.parent, from: from.value, to: to.value }, save);
      box.append(h("div", { class: "team-form" },
        m.start ? h("label", {}, "From", from) : null,
        m.end ? h("label", {}, "To", to) : null,
        h("button", { class: "btn primary fll-small-btn", type: "button", onclick: join },
          icon(me ? "fa-floppy-disk" : "fa-hand"), me ? " Update my time" : " I'll be there"),
        me ? h("button", { class: "fll-tool-btn", type: "button",
          onclick: () => act("team_volunteer", { meetingId: m.id, kind: "present", join: false, parent: state.parent }, save) },
          icon("fa-xmark"), " Cancel") : null));
    }
    return box;
  }

  function volunteerSlot(m, kind, canSignUp) {
    if (kind === "present") return presenceSlot(m, canSignUp);
    const vol = (state.data.volunteers[m.id] || {})[kind] || [];
    const slots = (m.slots || {})[kind] ?? 1;
    const me = canSignUp && vol.find((p) => p.u === state.user.username && p.by === (state.parent === "mother" ? "Mother" : "Father"));
    const box = h("div", { class: "vol-slot" },
      h("h5", {}, icon(KINDS[kind].icon), " ", KINDS[kind].label, " ", h("span", { class: "fll-muted small" }, "(" + vol.length + "/" + slots + ")")));
    for (const p of vol) box.append(h("div", { class: "vol-person" }, icon("fa-check"), " ", volName(p)));
    if (vol.length < slots) box.append(h("div", { class: "vol-open" }, (slots - vol.length) + " spot" + (slots - vol.length > 1 ? "s" : "") + " open"));
    if (canSignUp) {
      if (me) {
        box.append(h("button", { class: "fll-tool-btn", type: "button",
          onclick: () => act("team_volunteer", { meetingId: m.id, kind, join: false, parent: state.parent },
            (r) => { state.data.volunteers[m.id] = r.volunteers; }) }, icon("fa-xmark"), " Cancel my sign-up"));
      } else if (vol.length < slots) {
        box.append(h("button", { class: "btn primary fll-small-btn", type: "button",
          onclick: () => act("team_volunteer", { meetingId: m.id, kind, join: true, parent: state.parent },
            (r) => { state.data.volunteers[m.id] = r.volunteers; }) }, icon("fa-hand"), " I'll do it"));
      }
    }
    return box;
  }

  function viewVolunteers(canSignUp) {
    const list = visibleMeetings(false).filter((m) => m.status === "scheduled");
    const card = h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-handshake-angle"), " Parent volunteers"),
      h("p", { class: "fll-muted" }, canSignUp
        ? "Sign up to bring snacks, or to be there as a parent during the meeting — pick the time you can stay. Thank you!"
        : "Who is bringing snacks and which parents will be there at each confirmed meeting."),
      pastToggle());
    if (!list.length) card.append(h("p", { class: "fll-muted" }, "Sign-up opens when the coach confirms meeting dates."));
    for (const m of list) {
      const kinds = Object.keys(KINDS).filter((k) => k === "present" || ((m.slots || {})[k] ?? 1) > 0);
      card.append(h("div", { class: "team-meeting" }, meetingTitle(m), kinds.map((k) => volunteerSlot(m, k, canSignUp))));
    }
    return card;
  }

  /* ---------- mentor (own login) views ---------- */

  function viewMentorMeetings() {
    const me = state.data.mentor;
    const list = visibleMeetings(false);
    const card = h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-calendar-check"), " Can you come?"),
      h("p", { class: "fll-muted" }, "Say Yes for the sessions you can volunteer at, so the coach (and families) can see how many mentors will be there."),
      pastToggle());
    if (!list.length) card.append(h("p", { class: "fll-muted" }, "No meeting dates yet."));
    for (const m of list) {
      const ans = me.avail[m.id];
      card.append(h("div", { class: "team-meeting" },
        h("div", {}, meetingTitle(m),
          isAway(me.away, m.date) ? h("span", { class: "badge away" }, icon("fa-plane"), " You marked time away") : null,
          ans && ans.by === "Coach" ? h("div", { class: "by" }, "Set by the coach") : null),
        h("div", { class: "team-choice" },
          ANSWERS.map((a) => h("button", {
            type: "button", class: a.id + (ans && ans.s === a.id ? " on" : ""),
            "aria-pressed": ans && ans.s === a.id ? "true" : "false",
            onclick: () => act("mentor_avail", { meetingId: m.id, status: ans && ans.s === a.id ? "" : a.id },
              (r) => { me.avail = r.avail; })
          }, a.label)))));
    }
    return card;
  }

  function viewMentorAway() {
    const me = state.data.mentor;
    return h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-plane"), " Time away"),
      h("p", { class: "fll-muted" }, "Add dates you can't make it (exams, trips, holidays)."),
      awayForm((v) => act("mentor_away", { op: "add", ...v }, (r) => { me.away = r.away; })),
      awayList(me.away, (a) => act("mentor_away", { op: "remove", id: a.id }, (r) => { me.away = r.away; })));
  }

  /* ---------- volunteer hours (mentor: own sheet; coach: everyone's, approve / reject) ---------- */

  const STATUS_LABEL = { pending: "Waiting for coach", approved: "Approved", rejected: "Rejected" };
  const fmtHours = (n) => (Math.round(n * 100) / 100).toString();

  async function loadHours() {
    try { state.hours = (await api("hours")).sheets; } catch (err) { state.msg = err.message; state.hours = []; }
    render();
  }

  function viewHours() {
    const isCoach = state.user.role === "coach";
    if (!state.hours) { loadHours(); return h("p", { class: "fll-muted" }, "Loading…"); }
    const wrap = h("div", {});
    if (isCoach) {
      wrap.append(h("div", { class: "fll-card" },
        h("h3", {}, icon("fa-clock"), " Mentor volunteer hours"),
        h("p", { class: "fll-muted" }, "Mentors log their hours after each session. Approve or reject each entry, then download the sheet as a PDF to submit.")));
      if (!state.hours.length) wrap.append(h("p", { class: "fll-muted" }, "No mentors yet. Add them on the Mentors tab."));
    }
    for (const sheet of state.hours) wrap.append(hoursSheet(sheet, isCoach));
    return wrap;
  }

  function hoursSheet(sheet, isCoach) {
    const setHours = (r) => { sheet.hours = r.hours; };
    const approved = sheet.hours.filter((e) => e.status === "approved").reduce((s, e) => s + e.hours, 0);
    const pending = sheet.hours.filter((e) => e.status === "pending").length;
    const card = h("div", { class: "fll-card" },
      h("div", { class: "hours-head" },
        h("h3", {}, icon("fa-user-tie"), " ", sheet.name),
        h("button", { class: "btn primary fll-small-btn", type: "button", onclick: () => downloadSheetPdf(sheet) },
          icon("fa-file-pdf"), " Download PDF")),
      h("p", { class: "fll-muted small" }, "Approved: ", h("strong", {}, fmtHours(approved) + " h"),
        pending ? " · " + pending + " waiting for the coach" : ""));
    if (!isCoach) {
      const date = h("input", { type: "date", required: true, value: today() });
      const start = h("input", { type: "time", required: true });
      const end = h("input", { type: "time", required: true });
      const note = h("input", { type: "text", maxlength: "80", placeholder: "e.g. Robot build session" });
      card.append(h("form", {
        class: "team-form",
        onsubmit: (e) => {
          e.preventDefault();
          act("hours", { op: "add", date: date.value, start: start.value, end: end.value, note: note.value }, setHours);
        }
      }, h("label", {}, "Date", date), h("label", {}, "Start", start), h("label", {}, "End", end),
        h("label", {}, "What you did (optional)", note),
        h("button", { class: "btn primary fll-small-btn", type: "submit" }, icon("fa-plus"), " Log hours")));
    }
    if (!sheet.hours.length) {
      card.append(h("p", { class: "fll-muted" }, isCoach ? "No hours logged yet." : "No hours logged yet. Add your first session above."));
      return card;
    }
    const rows = sheet.hours.map((e, i) => h("tr", {},
      h("td", {}, i + 1), h("td", {}, sheet.name), h("td", {}, shortDate(e.date)),
      h("td", {}, niceTime(e.start)), h("td", {}, niceTime(e.end)), h("td", {}, fmtHours(e.hours)),
      h("td", { class: "hours-note" }, e.note || ""),
      h("td", {}, h("span", { class: "badge " + ({ approved: "scheduled", rejected: "cancelled" }[e.status] || "proposed") }, STATUS_LABEL[e.status])),
      h("td", {}, isCoach
        ? h("span", { class: "hours-actions" },
          e.status !== "approved" ? h("button", { class: "fll-tool-btn", type: "button",
            onclick: () => act("hours_decide", { mentorId: sheet.id, id: e.id, status: "approved" }, setHours) }, icon("fa-check"), " Approve") : null,
          e.status !== "rejected" ? h("button", { class: "fll-tool-btn", type: "button",
            onclick: () => act("hours_decide", { mentorId: sheet.id, id: e.id, status: "rejected" }, setHours) }, icon("fa-xmark"), " Reject") : null,
          e.status !== "pending" ? h("button", { class: "fll-link-btn", type: "button",
            onclick: () => act("hours_decide", { mentorId: sheet.id, id: e.id, status: "pending" }, setHours) }, "undo") : null)
        : e.status === "pending"
          ? h("button", { class: "fll-link-btn", type: "button",
            onclick: () => act("hours", { op: "remove", id: e.id }, setHours) }, "remove")
          : "")));
    card.append(h("div", { class: "grid-wrap" }, h("table", { class: "grid hours-table" },
      h("thead", {}, h("tr", {}, ["Sr. No.", "Name", "Date", "Start", "End", "Hours", "Note", "Coach", ""].map((t) => h("th", {}, t)))),
      h("tbody", {}, rows))));
    return card;
  }

  // PDF: jsPDF + AutoTable from cdnjs, loaded only when someone downloads a sheet.
  let pdfLibs = null;
  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => fail(new Error("Could not load the PDF tool. Check your internet and try again."));
      document.head.append(s);
    });
  }
  async function downloadSheetPdf(sheet) {
    try {
      pdfLibs = pdfLibs || loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
        .then(() => loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"));
      await pdfLibs;
    } catch (err) { pdfLibs = null; flash(err.message); return; }
    const doc = new window.jspdf.jsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text(sheet.name, W / 2, 56, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(12);
    doc.text("Mentor Volunteer Hours", W / 2, 76, { align: "center" });
    doc.setFontSize(10);
    doc.text("Mechanical Masters FLL Team #67741  ·  Printed " + niceDate(today()), W / 2, 92, { align: "center" });
    const approved = sheet.hours.filter((e) => e.status === "approved").reduce((s, e) => s + e.hours, 0);
    doc.autoTable({
      startY: 110,
      head: [["Sr. No.", "Name", "Date of volunteering", "Start time", "End time", "Total hours", "Coach approval"]],
      body: sheet.hours.map((e, i) => [i + 1, sheet.name, shortDate(e.date) + ", " + e.date.slice(0, 4), niceTime(e.start), niceTime(e.end),
        fmtHours(e.hours), e.status === "approved" ? "Approved" : e.status === "rejected" ? "Rejected" : "Pending"]),
      foot: [["", "", "", "", "Total approved", fmtHours(approved), ""]],
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 5 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
      columnStyles: { 0: { halign: "center", cellWidth: 44 }, 5: { halign: "center" }, 6: { halign: "center" } }
    });
    let y = doc.lastAutoTable.finalY + 48;
    if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 80; }
    doc.setFontSize(11);
    doc.text("Coach signature: ______________________________", 40, y);
    doc.text("Date: ______________", W - 190, y);
    doc.save(sheet.name.replace(/[^A-Za-z0-9]+/g, "_") + "_volunteer_hours.pdf");
  }

  /* ---------- coach views ---------- */

  // Add form (m = null) or edit form pre-filled from meeting m.
  function eventForm(m, onSave, onCancel) {
    const v = m || { type: "meeting", start: "16:00", end: "18:00" };
    const type = h("select", {}, Object.entries(TYPES).map(([id, t]) => h("option", { value: id, selected: (v.type || "meeting") === id }, t.label)));
    const title = h("input", { type: "text", maxlength: "60", placeholder: "e.g. NC Zoo trip (optional)", value: v.title || "" });
    const date = h("input", { type: "date", required: true, value: v.date || "" });
    const start = h("input", { type: "time", value: v.start || "" });
    const end = h("input", { type: "time", value: v.end || "" });
    const place = h("input", { type: "text", maxlength: "60", placeholder: "e.g. Coach's home", value: v.place || "" });
    const note = h("input", { type: "text", maxlength: "120", placeholder: "e.g. Robot runs practice", value: v.note || "" });
    return h("form", {
      class: "team-form",
      onsubmit: (e) => {
        e.preventDefault();
        if (start.value && end.value && end.value <= start.value) { flash("The end time must be after the start time."); return; }
        onSave({ type: type.value, title: title.value, date: date.value, start: start.value, end: end.value, place: place.value, note: note.value });
      }
    },
      h("label", {}, "What", type), h("label", {}, "Title", title),
      h("label", {}, "Date", date), h("label", {}, "Start", start), h("label", {}, "End", end),
      h("label", {}, "Place", place), h("label", {}, "Note", note),
      h("button", { class: "btn primary fll-small-btn", type: "submit" }, icon(m ? "fa-floppy-disk" : "fa-plus"), m ? " Save changes" : " Add date"),
      onCancel ? h("button", { class: "fll-tool-btn", type: "button", onclick: onCancel }, "Cancel") : null);
  }

  function viewCoachPlan() {
    const setMeetings = (r) => { state.data.meetings = r.meetings; };
    const card = h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-calendar-plus"), " Plan meetings & activities"),
      h("p", { class: "fll-muted" }, "Add team meetings or activities (zoo visit, fundraiser, visiting another team…). Add them as Proposed so families can answer, check the Availability tab, then switch the best ones to Confirmed. Parents can only volunteer for confirmed ones. Use Edit to change the date, time, place or anything else — answers and sign-ups are kept."),
      eventForm(null, (vals) => act("team_meeting", { op: "add", ...vals }, setMeetings)),
      pastToggle());
    const list = visibleMeetings(true);
    if (!list.length) card.append(h("p", { class: "fll-muted" }, "Nothing planned yet."));
    for (const m of list) {
      const status = h("select", {
        onchange: (e) => act("team_meeting", { op: "update", id: m.id, status: e.target.value }, (r) => { state.data.meetings = r.meetings; })
      }, ["proposed", "scheduled", "cancelled"].map((s) => h("option", { value: s, selected: m.status === s },
        s === "scheduled" ? "Confirmed" : s[0].toUpperCase() + s.slice(1))));
      const slotInput = (kind) => h("label", { class: "fll-muted small" }, KINDS[kind].label + " spots ",
        h("input", { type: "number", min: "0", max: "10", value: (m.slots || {})[kind] ?? 1,
          onchange: (e) => act("team_meeting", { op: "update", id: m.id, slots: { [kind]: e.target.value } },
            (r) => { state.data.meetings = r.meetings; }) }));
      if (state.editing === m.id) {
        card.append(h("div", { class: "team-meeting" },
          h("div", { style: "flex:1 1 100%" },
            h("div", { class: "fll-sub" }, icon("fa-pen"), " Editing: ", eventName(m), " · ", niceDate(m.date)),
            eventForm(m,
              (vals) => act("team_meeting", { op: "update", id: m.id, ...vals }, (r) => { state.data.meetings = r.meetings; state.editing = null; }),
              () => { state.editing = null; render(); }))));
        continue;
      }
      card.append(h("div", { class: "team-meeting" },
        meetingTitle(m),
        h("div", { class: "team-form" }, status, slotInput("snacks"),
          h("button", { class: "fll-tool-btn", type: "button", onclick: () => { state.editing = m.id; state.msg = ""; render(); } },
            icon("fa-pen"), " Edit"),
          h("button", { class: "fll-tool-btn", type: "button", onclick: () => {
            if (confirm("Delete the meeting on " + niceDate(m.date) + "? Its answers and sign-ups are removed too.")) {
              act("team_meeting", { op: "remove", id: m.id }, (r) => { state.data.meetings = r.meetings; });
            }
          } }, icon("fa-trash"), " Delete"))));
    }
    return card;
  }

  function cellFor(avail, away, date, parents) {
    const ans = avail[date.id];
    if (ans) {
      const a = ANSWERS.find((x) => x.id === ans.s);
      return { cls: ans.s, mark: a ? a.mark : "", title: a.label + " (by " + who(ans, parents) + ")" };
    }
    if (isAway(away, date.date)) return { cls: "away", mark: "✈", title: "Away (vacation)" };
    return { cls: "none", mark: "–", title: "No answer yet" };
  }

  function viewCoachGrid() {
    const meetings = visibleMeetings(false);
    const { kids, mentors } = state.data;
    const card = h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-table-cells"), " Availability"),
      h("div", { class: "team-legend" },
        h("span", {}, h("span", { class: "cell yes" }, "✓"), "Yes"),
        h("span", {}, h("span", { class: "cell maybe" }, "?"), "Maybe"),
        h("span", {}, h("span", { class: "cell no" }, "✗"), "No"),
        h("span", {}, h("span", { class: "cell away" }, "✈"), "Away (from vacation dates)"),
        h("span", {}, h("span", { class: "cell none" }, "–"), "No answer")),
      h("p", { class: "fll-muted small" }, "Click any square to change the answer (Yes → Maybe → No → blank). Use this when a parent tells you directly; it shows as \"set by Coach\" and the parent can still change it."),
      pastToggle());
    if (!meetings.length) { card.append(h("p", { class: "fll-muted" }, "Add meeting dates on the Plan tab first.")); return card; }

    const head = h("tr", {}, h("th", {}, ""), meetings.map((m) => h("th", { title: eventName(m) },
      icon(typeOf(m).icon), " ", shortDate(m.date), h("br"), h("span", { class: "badge " + m.status }, m.status === "scheduled" ? "Confirmed" : "Proposed"))));
    const body = h("tbody", {});
    body.append(h("tr", { class: "sub" }, h("td", { colspan: meetings.length + 1 }, "Kids (" + kids.length + ")")));
    const cycle = { "": "yes", yes: "maybe", maybe: "no", no: "" };
    for (const k of kids) {
      body.append(h("tr", {}, h("td", {}, k.name), meetings.map((m) => {
        const c = cellFor(k.avail, k.away, m, k.parents);
        const cur = (k.avail[m.id] || {}).s || "";
        return h("td", {}, h("button", { type: "button", class: "cell " + c.cls, title: c.title + " — click to change",
          "aria-label": k.name + ", " + shortDate(m.date) + ": " + c.title,
          onclick: () => act("team_avail", { username: k.username, meetingId: m.id, status: cycle[cur] },
            (r) => { k.avail = r.avail; }) }, c.mark));
      })));
    }
    body.append(h("tr", { class: "sub" }, h("td", { colspan: meetings.length + 1 }, "Mentors (" + mentors.length + ")")));
    for (const mt of mentors) {
      body.append(h("tr", {}, h("td", {}, mt.name), meetings.map((m) => {
        const c = cellFor(mt.avail, mt.away, m);
        const cur = (mt.avail[m.id] || {}).s || "";
        return h("td", {}, h("button", { type: "button", class: "cell " + c.cls, title: c.title + " — click to change",
          onclick: () => act("team_mentor", { op: "avail", id: mt.id, meetingId: m.id, status: cycle[cur] },
            (r) => { state.data.mentors = r.mentors; }) }, c.mark));
      })));
    }
    const count = (who, m) => who.filter((p) => (p.avail[m.id] || {}).s === "yes").length;
    const kc = (m) => ((state.data.counts || {})[m.id] || {}).kids || { coming: 0, total: kids.length };
    const foot = h("tfoot", {},
      h("tr", {}, h("td", { title: "Everyone counts as coming unless they said No or are away" }, "Kids coming"),
        meetings.map((m) => h("td", {}, kc(m).coming + "/" + kc(m).total))),
      h("tr", {}, h("td", {}, "Mentors saying yes"), meetings.map((m) => h("td", {}, count(mentors, m) + "/" + mentors.length))));
    card.append(h("div", { class: "grid-wrap" }, h("table", { class: "grid" }, h("thead", {}, head), body, foot)));
    return card;
  }

  function viewCoachMentors() {
    const name = h("input", { type: "text", maxlength: "40", placeholder: "Mentor's name", required: true });
    const card = h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-user-tie"), " Mentors"),
      h("p", { class: "fll-muted" }, "Add mentors, then give each one a login (username + password) so they can say which sessions they'll volunteer at, add time away, and log their volunteer hours on this same page. You can still set their answers yourself on the Availability tab."),
      h("form", {
        class: "team-form",
        onsubmit: (e) => { e.preventDefault(); act("team_mentor", { op: "add", name: name.value }, (r) => { state.data.mentors = r.mentors; }); }
      }, h("label", {}, "Name", name), h("button", { class: "btn primary fll-small-btn", type: "submit" }, icon("fa-plus"), " Add mentor")));
    for (const mt of state.data.mentors) {
      card.append(h("div", { class: "team-meeting" },
        h("div", { style: "flex:1 1 100%" },
          h("div", { class: "when" }, mt.name, " ",
            h("button", { class: "fll-link-btn", type: "button", onclick: () => {
              if (confirm("Remove mentor " + mt.name + "?")) act("team_mentor", { op: "remove", id: mt.id }, (r) => { state.data.mentors = r.mentors; });
            } }, "remove")),
          mentorLoginForm(mt),
          h("div", { class: "fll-sub" }, "Time away"),
          awayForm((v) => act("team_mentor", { op: "away_add", id: mt.id, ...v }, (r) => { state.data.mentors = r.mentors; })),
          awayList(mt.away, (a) => act("team_mentor", { op: "away_remove", id: mt.id, awayId: a.id }, (r) => { state.data.mentors = r.mentors; })))));
    }
    return card;
  }

  function mentorLoginForm(mt) {
    const user = h("input", { type: "text", maxlength: "24", autocomplete: "off", autocapitalize: "none", spellcheck: "false",
      value: mt.login || mt.name.toLowerCase().replace(/[^a-z0-9._-]/g, ""), "aria-label": mt.name + " username" });
    const pass = h("input", { type: "text", maxlength: "64", autocomplete: "new-password", placeholder: "6+ characters",
      "aria-label": mt.name + " password" });
    return h("div", {},
      h("div", { class: "fll-sub" }, "Login ",
        mt.login ? h("span", { class: "badge scheduled" }, icon("fa-key"), " ", mt.login) : h("span", { class: "badge proposed" }, "no login yet")),
      h("form", {
        class: "team-form",
        onsubmit: (e) => {
          e.preventDefault();
          act("team_mentor", { op: "login", id: mt.id, username: user.value, password: pass.value },
            (r) => { state.data.mentors = r.mentors; flash("Login saved for " + mt.name + ". Give them the username and password."); });
        }
      }, h("label", {}, "Username", user), h("label", {}, mt.login ? "New password" : "Password", pass),
        h("button", { class: "btn primary fll-small-btn", type: "submit" }, icon("fa-key"), mt.login ? " Reset password" : " Create login")));
  }

  function viewCoachAway() {
    const kids = state.data.kids;
    const setAway = (k) => (r) => { k.away = r.away; };
    const pick = h("select", { "aria-label": "Kid" },
      h("option", { value: "" }, "Choose a kid…"), kids.map((k) => h("option", { value: k.username }, k.name)));
    const card = h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-plane"), " Families' time away"),
      h("p", { class: "fll-muted" }, "When a parent tells you their child will miss meetings, add the dates here. It shows as \"added by Coach\" and the parent sees it too."),
      h("div", { class: "team-form" }, h("label", {}, "Kid", pick)),
      awayForm((v) => {
        const k = kids.find((x) => x.username === pick.value);
        if (!k) { flash("Choose the kid first."); return; }
        act("team_away", { op: "add", username: k.username, ...v }, setAway(k));
      }));
    const withAway = kids.filter((k) => k.away.length);
    if (!withAway.length) card.append(h("p", { class: "fll-muted" }, "No time away added yet."));
    for (const k of withAway) {
      card.append(h("div", { class: "fll-sub" }, k.name));
      card.append(h("ul", { class: "fll-list" }, k.away.map((a) => h("li", {},
        h("strong", {}, shortDate(a.from), a.to !== a.from ? " – " + shortDate(a.to) : ""),
        a.note ? " · " + a.note : "", " ", h("span", { class: "fll-muted small" }, "(by " + who(a, k.parents) + ") "),
        h("button", { class: "fll-link-btn", type: "button",
          onclick: () => act("team_away", { op: "remove", username: k.username, id: a.id }, setAway(k)) }, "remove")))));
    }
    return card;
  }

  /* ---------- calendar (coach: full picture; parents: meetings + volunteers) ---------- */

  // pub = true: the no-login calendar on the login screen (counts only, from team_public).
  function viewCalendar(pub) {
    const isCoach = !pub && state.user.role === "coach";
    const meetings = pub ? state.pub : state.data.meetings;
    const t = today();
    if (!state.calMonth) {
      const next = meetings.find((m) => m.date >= t && m.status !== "cancelled");
      state.calMonth = (next ? next.date : t).slice(0, 7);
    }
    const [y, mo] = state.calMonth.split("-").map(Number);
    const shift = (n) => () => {
      const d = new Date(y, mo - 1 + n, 1);
      state.calMonth = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      render();
    };
    const monthName = new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const card = h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-calendar-days"), pub ? " Team calendar" : " Calendar"),
      pub
        ? h("p", { class: "fll-muted small" }, "Upcoming meetings and activities, how many kids are coming, and which volunteer spots are filled. Log in to answer or sign up.")
        : isCoach
        ? h("div", { class: "team-legend" },
          h("span", {}, h("span", { class: "dot ok" }), "Covered"),
          h("span", {}, h("span", { class: "dot bad" }), "Red = nobody available / spot still open"))
        : h("p", { class: "fll-muted small" }, "Team meetings and who is volunteering."),
      h("div", { class: "cal-nav" },
        h("button", { class: "fll-tool-btn", type: "button", onclick: shift(-1), "aria-label": "Previous month" }, icon("fa-chevron-left")),
        h("strong", {}, monthName),
        h("button", { class: "fll-tool-btn", type: "button", onclick: shift(1), "aria-label": "Next month" }, icon("fa-chevron-right"))));

    const byDate = {};
    for (const m of meetings) (byDate[m.date] = byDate[m.date] || []).push(m);

    const grid = h("div", { class: "cal" });
    for (const d of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) grid.append(h("div", { class: "cal-head" }, d));
    const first = new Date(y, mo - 1, 1).getDay();
    const days = new Date(y, mo, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(h("div", { class: "cal-day empty" }));
    for (let day = 1; day <= days; day++) {
      const iso = state.calMonth + "-" + String(day).padStart(2, "0");
      const cell = h("div", { class: "cal-day" + (iso === t ? " today" : "") + (iso < t ? " past" : "") },
        h("div", { class: "cal-num" }, day));
      for (const m of byDate[iso] || []) cell.append(pub ? calMeetingPublic(m) : calMeeting(m, isCoach));
      grid.append(cell);
    }
    card.append(h("div", { class: "cal-wrap" }, grid));
    card.append(calSubscribe());
    return card;
  }

  // Subscribe links: the feed (/fll-team.ics) updates by itself when the coach changes events.
  function calSubscribe() {
    const https = location.origin + "/fll-team.ics";
    const webcal = https.replace(/^https?:/, "webcal:");
    const note = h("span", { class: "fll-muted small" });
    return h("div", { class: "cal-sub" },
      h("strong", {}, icon("fa-calendar-plus"), " Add to your calendar:"),
      h("a", { class: "btn primary fll-small-btn", href: "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcal),
        target: "_blank", rel: "noopener" }, icon("fa-brands fa-google"), " Google Calendar"),
      h("a", { class: "btn primary fll-small-btn", href: webcal }, icon("fa-brands fa-apple"), " Apple Calendar"),
      h("button", { class: "fll-tool-btn", type: "button", onclick: async () => {
        try { await navigator.clipboard.writeText(https); note.textContent = "Link copied — paste it into Outlook or any calendar app (\"subscribe from URL\")."; }
        catch (e) { note.textContent = https; }
      } }, icon("fa-link"), " Copy link"),
      h("div", { class: "fll-muted small cal-sub-help" },
        "It subscribes, so new or changed meetings show up automatically (Google can take a few hours to refresh). Only event names and times are shared — see this page for the place and sign-ups."),
      note);
  }

  // Kids are counted as coming unless a parent/coach said No or the date is in their time away.
  function kidsLine(k) {
    const extra = [k.absent ? k.absent + " absent" : "", k.maybe ? k.maybe + " maybe" : ""].filter(Boolean).join(", ");
    return calLine(k.coming > 0, "Kids", k.coming + "/" + k.total + " coming" + (extra ? " (" + extra + ")" : ""));
  }
  function mentorsLine(mc) {
    return calLine(mc.coming > 0, "Mentors", mc.coming + " coming" + (mc.maybe ? ", " + mc.maybe + " maybe" : ""));
  }

  function calLine(ok, label, text) {
    return h("div", { class: "cal-line " + (ok ? "ok" : "bad") }, h("b", {}, label + ": "), text);
  }

  function calBox(m) {
    return h("div", { class: "cal-meet " + m.status },
      h("div", { class: "ev-name" + (m.type && m.type !== "meeting" ? " activity" : "") }, icon(typeOf(m).icon), " ", eventName(m)),
      h("div", { class: "cal-time" }, timeRange(m), " ",
        h("span", { class: "badge " + m.status }, m.status === "scheduled" ? "Confirmed" : m.status === "cancelled" ? "Cancelled" : "Proposed")),
      m.place ? h("div", { class: "cal-place" }, m.place) : null);
  }

  // Public (no login) version: numbers only, never names.
  function calMeetingPublic(m) {
    const box = calBox(m);
    if (m.status === "cancelled") return box;
    if (m.kids) box.append(kidsLine(m.kids));
    if (m.mentors) box.append(mentorsLine(m.mentors));
    for (const [kind, v] of Object.entries(m.volunteers || {})) {
      if (kind === "present") {
        const gaps = v.gaps || [];
        box.append(calLine(!gaps.length, "Parent present",
          gaps.length ? (v.count ? v.count + " signed up · " : "") + "needed " + gapText(gaps) : "covered ✓"));
        continue;
      }
      if (!v.slots) continue;
      const open = v.slots - v.filled;
      box.append(calLine(open <= 0, kind === "snacks" ? "Snacks" : "Parent present",
        open <= 0 ? "covered ✓" : v.filled + "/" + v.slots + " · " + open + " open"));
    }
    return box;
  }

  function calMeeting(m, isCoach) {
    const box = calBox(m);
    if (m.status === "cancelled") return box;

    const c = (state.data.counts || {})[m.id];
    if (c) {
      box.append(kidsLine(c.kids));
      if (isCoach) {
        const mentors = state.data.mentors;
        const mYes = mentors.filter((mt) => (mt.avail[m.id] || {}).s === "yes").map((mt) => mt.name);
        const mMaybe = mentors.filter((mt) => (mt.avail[m.id] || {}).s === "maybe").map((mt) => mt.name + "?");
        box.append(calLine(mYes.length > 0, "Mentors",
          mYes.length || mMaybe.length ? mYes.length + " coming: " + mYes.concat(mMaybe).join(", ") : "none yet"));
      } else {
        box.append(mentorsLine(c.mentors));
      }
    }
    if (m.status === "scheduled") {
      const vol = state.data.volunteers[m.id] || {};
      for (const kind of Object.keys(KINDS)) {
        if (kind === "present") {
          const people = vol.present || [];
          const gaps = presenceGaps(m, people);
          const names = people.map((p) => volName(p) + (p.from && m.start ? " " + niceTime(p.from) + "–" + niceTime(p.to) : ""));
          box.append(calLine(!gaps.length, "Parent present",
            names.join(", ") + (gaps.length ? (names.length ? " · " : "") + "needed " + gapText(gaps) : "")));
          continue;
        }
        const slots = (m.slots || {})[kind] ?? 1;
        if (!slots) continue;
        const people = (vol[kind] || []).map(volName);
        const open = slots - people.length;
        const text = people.join(", ") + (open > 0 ? (people.length ? " · " : "") + open + " open" : "");
        box.append(calLine(open <= 0, kind === "snacks" ? "Snacks" : "Present", text));
      }
    }
    return box;
  }

  /* ---------- render ---------- */

  function render() {
    root.replaceChildren();
    if (!state.user) {
      // Calendar on the left, a compact login card in the top-right corner (stacks on phones).
      if (state.pub) root.append(h("div", { class: "team-public" }, viewLogin(true), viewCalendar(true)));
      else root.append(viewLogin());
      return;
    }
    if (state.user.role === "kid" && (!state.parent || !myParents()[state.parent])) {
      root.append(state.data ? viewWhoAreYou() : h("p", { class: "fll-muted" }, "Loading…"));
      return;
    }
    root.append(header());
    if (state.msg) root.append(h("p", { class: "fll-note warn", role: "alert" }, icon("fa-circle-exclamation"), " ", state.msg));
    if (!state.data) { root.append(h("p", { class: "fll-muted" }, "Loading…")); return; }

    if (state.user.role === "coach") {
      root.append(tabs([["calendar", "Calendar", "fa-calendar-days"], ["plan", "Plan meetings", "fa-calendar-plus"],
        ["grid", "Availability", "fa-table-cells"], ["away", "Time away", "fa-plane"], ["mentors", "Mentors", "fa-user-tie"],
        ["hours", "Mentor hours", "fa-clock"], ["volunteers", "Volunteers", "fa-handshake-angle"]]));
      const views = { calendar: () => viewCalendar(), plan: viewCoachPlan, grid: viewCoachGrid, away: viewCoachAway, mentors: viewCoachMentors,
        hours: viewHours, volunteers: () => viewVolunteers(false) };
      root.append((views[state.tab] || viewCoachPlan)());
    } else if (state.user.role === "mentor") {
      root.append(tabs([["meetings", "Meetings", "fa-calendar-check"], ["calendar", "Calendar", "fa-calendar-days"],
        ["away", "Time away", "fa-plane"], ["hours", "My volunteer hours", "fa-clock"]]));
      const views = { meetings: viewMentorMeetings, calendar: () => viewCalendar(), away: viewMentorAway, hours: viewHours };
      root.append((views[state.tab] || viewMentorMeetings)());
    } else {
      root.append(tabs([["meetings", "Meetings", "fa-calendar-check"], ["calendar", "Calendar", "fa-calendar-days"],
        ["away", "Vacations", "fa-plane"], ["volunteers", "Volunteer", "fa-handshake-angle"]]));
      const views = { meetings: viewParentMeetings, calendar: () => viewCalendar(), away: viewParentAway, volunteers: () => viewVolunteers(true) };
      root.append((views[state.tab] || viewParentMeetings)());
    }
  }

  /* ---------- start ---------- */

  (async function init() {
    root.replaceChildren(h("p", { class: "fll-muted" }, "Loading…"));
    try {
      const status = await api("status");
      if (!status.ready) { flash("The team server is not set up yet."); return; }
      const me = await api("me");
      await startSession(me.user);
    } catch (err) {
      state.user = null;
      await loadPublic();
      render();
    }
  })();
})();
