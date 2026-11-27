/* ==========================================
   PROJECT BOARD (fll-projects.html) — Mechanical Masters FLL
   Modelled on the team's "Road to States" plan: Robot / Project / Team /
   Logistics tasks with T-numbers, key (★) tasks, weeks, a status board,
   a timeline (Gantt), "My tasks" and follow-up notes.
   - Coach: everything, including making captains.
   - Captain / Vice Captain (posts with area "all" + "assign"): tasks in every
     area, and they hand out area posts such as "Innovation Lead".
   - Area leads: create / edit / delete tasks in their area.
   - Anyone on a task can change its status; anyone can add notes.
   Data lives in /api/fll (pm, pm_task, pm_post).
========================================== */
(function () {
  const root = document.getElementById("pmApp");
  if (!root) return;

  const EVENT = { date: "2027-01-09", label: "State Championship" };
  const BREAKS = [["2026-12-21", "2027-01-03"]];  // winter break weeks (shaded, labelled "break")
  const STATUS = [
    { id: "not_started", label: "Not started", icon: "fa-circle" },
    { id: "in_progress", label: "In progress", icon: "fa-spinner" },
    { id: "blocked", label: "Blocked", icon: "fa-hand" },
    { id: "done", label: "Done", icon: "fa-circle-check" },
    { id: "abandoned", label: "Abandoned", icon: "fa-ban" }
  ];
  const statusOf = (id) => STATUS.find((s) => s.id === id) || STATUS[0];
  const PRIORITY = { high: "High", normal: "Normal", low: "Low" };
  const AREA_COLORS = { robot: "#38bdf8", project: "#a78bfa", team: "#f472b6", logistics: "#fbbf24" };
  const AREA_SHORT = { robot: "Robot", project: "Project", team: "Team", logistics: "Logistics" };
  const TITLE_IDEAS = ["Captain", "Vice Captain", "Innovation Lead", "Research Lead", "Robot Lead", "Robot Design Lead",
    "Coding Lead", "Build Lead", "Core Values Lead", "Team Spirit Lead", "Logistics Lead", "Presentation Lead"];

  const state = { user: null, data: null, tab: "board", msg: "", edit: null, open: null, minePerson: "",
    f: { area: "", week: "", q: "" }, zoom: "day" };

  /* ---------- helpers ---------- */

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.setAttribute("style", v);
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
    const res = await fetch("/api/fll?action=" + action, {
      method, credentials: "same-origin",
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

  async function act(action, body, after) {
    try {
      const res = await api(action, { method: "POST", body });
      state.msg = "";
      if (after) after(res);
    } catch (err) {
      state.msg = err.message;
      if (err.status === 401) { state.user = null; state.data = null; }
    }
    render();
  }
  const setTasks = (res) => { state.data.tasks = res.tasks; };

  async function reload() {
    try { state.data = await api("pm"); state.msg = ""; }
    catch (err) {
      if (err.status === 401) { state.user = null; state.data = null; }
      state.msg = err.message;
    }
    render();
  }

  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => iso(new Date());
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const shortDate = (s) => parse(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const weekOf = (s) => addDays(s, -((parse(s).getDay() + 6) % 7));  // Monday
  const isBreak = (s) => BREAKS.some(([a, b]) => a <= s && s <= b);
  function weekLabel(w) {
    const end = addDays(w, 6);
    const a = parse(w), b = parse(end);
    const left = a.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const right = a.getMonth() === b.getMonth() ? String(b.getDate()) : b.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return left + "–" + right + (isBreak(w) || isBreak(end) ? " · break" : "");
  }

  const kidName = (u) => ((state.data.kids.find((k) => k.username === u) || {}).name) || u;
  const postsOf = (u) => state.data.posts.filter((p) => p.username === u);
  const rights = () => state.data.me.rights;
  const canEditArea = (area) => rights().areas.includes(area);
  const isOverdue = (t) => t.end < today() && t.status !== "done" && t.status !== "abandoned";
  const canSetStatus = (t) => canEditArea(t.area) || (t.assignees || []).includes(state.data.me.username);
  const statusPill = (id) => { const s = statusOf(id); return h("span", { class: "pill st-" + s.id }, icon(s.icon), " ", s.label); };
  const areaTag = (a) => h("span", { class: "area-tag", style: "color:" + AREA_COLORS[a] + ";border-color:" + AREA_COLORS[a] }, AREA_SHORT[a] || a);

  /* ---------- login / header ---------- */

  function viewLogin() {
    const msg = h("p", { class: "fll-msg", role: "alert" }, state.msg || "");
    const user = h("input", { id: "pUser", type: "text", autocomplete: "username", autocapitalize: "none", spellcheck: "false", required: true });
    const pass = h("input", { id: "pPass", type: "password", autocomplete: "current-password", required: true });
    const btn = h("button", { class: "btn primary", type: "submit" }, icon("fa-right-to-bracket"), " Log in");
    return h("div", { class: "fll-login" },
      h("div", { class: "fll-card fll-login-card" },
        h("div", { class: "fll-login-icon" }, icon("fa-diagram-project")),
        h("h3", {}, "Road to States — project board"),
        h("p", { class: "fll-muted" }, "Kids: log in with your own FLL login (the Attachment Lab one). Coaches and mentors use their logins too."),
        h("form", {
          class: "fll-login-form",
          onsubmit: async (e) => {
            e.preventDefault();
            btn.disabled = true;
            msg.textContent = "Checking…";
            try {
              const data = await api("login", { method: "POST", body: { username: user.value, password: pass.value } });
              state.user = data.user;
              await reload();
            } catch (err) { msg.textContent = err.message; btn.disabled = false; }
          }
        }, h("label", { for: "pUser" }, "Username"), user, h("label", { for: "pPass" }, "Password"), pass, btn, msg)));
  }

  async function logout() {
    try { await api("logout", { method: "POST" }); } catch (e) { /* ignore */ }
    state.user = null; state.data = null; state.msg = "";
    render();
  }

  function header() {
    const me = state.data.me;
    const titles = me.role === "kid" ? postsOf(me.username).map((p) => h("span", { class: "pill post" + (p.area === "all" ? " all" : "") }, p.title)) : [];
    const roleIcon = me.role === "coach" ? "fa-clipboard-user" : me.role === "mentor" ? "fa-user-tie" : "fa-user";
    const left = daysBetween(today(), EVENT.date);
    return h("div", { class: "fll-header" },
      h("span", { class: "fll-who" }, icon(roleIcon), " ", me.name, " ",
        me.role === "coach" ? h("small", {}, "· Coach") : me.role === "mentor" ? h("small", {}, "· Mentor") : null, " ", titles),
      left >= 0 ? h("span", { class: "pm-countdown", title: EVENT.label + " · " + parse(EVENT.date).toDateString() },
        h("strong", {}, String(left)), " day" + (left === 1 ? "" : "s") + " to " + EVENT.label) : null,
      h("button", { class: "fll-tool-btn", type: "button", onclick: logout }, icon("fa-right-from-bracket"), " Log out"));
  }

  function tabs() {
    const list = [["board", "Board", "fa-table-columns"], ["list", "List", "fa-list-check"], ["gantt", "Timeline", "fa-chart-gantt"],
      ["mine", "My tasks", "fa-user-check"], ["posts", "Team posts", "fa-id-badge"]];
    return h("div", { class: "pm-tabs", role: "tablist" }, list.map(([id, label, ic]) => h("button", {
      class: "pm-tab", type: "button", role: "tab", "aria-selected": state.tab === id ? "true" : "false",
      onclick: () => { state.tab = id; state.msg = ""; render(); }
    }, icon(ic), " ", label)));
  }

  /* ---------- shared filters ---------- */

  function filtered() {
    const f = state.f;
    const q = f.q.trim().toLowerCase();
    return state.data.tasks.filter((t) =>
      (!f.area || t.area === f.area) &&
      (!f.week || weekOf(t.end) === f.week) &&
      (!q || (t.code + " " + t.title + " " + (t.desc || "") + " " + (t.assignees || []).map(kidName).join(" ")).toLowerCase().includes(q)));
  }

  function filterBar(withNew) {
    const d = state.data;
    const f = state.f;
    const chip = (v, label) => h("button", { type: "button", class: "chip" + (f.area === v ? " on" : ""),
      style: v ? "--c:" + AREA_COLORS[v] : null, onclick: () => { f.area = v; render(); } }, label);
    const weeks = [...new Set(d.tasks.map((t) => weekOf(t.end)))].sort();
    const thisWeek = weekOf(today());
    const search = h("input", { type: "search", placeholder: "Search…", value: f.q, "aria-label": "Search tasks" });
    search.addEventListener("input", () => { f.q = search.value; clearTimeout(search._t); search._t = setTimeout(() => { render(); const s = root.querySelector("input[type=search]"); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 250); });
    return h("div", { class: "pm-filters" },
      h("div", { class: "chips" }, chip("", "All"), Object.keys(d.areas).map((a) => chip(a, AREA_SHORT[a]))),
      h("select", { "aria-label": "Week", onchange: (e) => { f.week = e.target.value; render(); } },
        h("option", { value: "" }, "All weeks"), weeks.map((w) => h("option", { value: w, selected: f.week === w }, weekLabel(w)))),
      h("button", { type: "button", class: "chip" + (f.week === thisWeek ? " on" : ""), onclick: () => { f.week = f.week === thisWeek ? "" : thisWeek; render(); } }, "This week"),
      search,
      withNew && rights().areas.length ? h("button", { class: "btn primary fll-small-btn", type: "button",
        onclick: () => { state.edit = "new"; state.msg = ""; render(); } }, icon("fa-plus"), " New task") : null);
  }

  function summary() {
    const d = state.data;
    const n = (s) => d.tasks.filter((t) => t.status === s).length;
    const overdue = d.tasks.filter(isOverdue).length;
    return h("p", { class: "fll-muted small pm-sum" }, d.tasks.length + " tasks · " + n("done") + " done · " + n("in_progress") + " in progress · " +
      n("blocked") + " blocked", overdue ? h("span", { class: "pill overdue", style: "margin-left:8px" }, icon("fa-clock"), " " + overdue + " overdue") : null);
  }

  /* ---------- board (columns by status, grouped by week) ---------- */

  function card(t) {
    const people = (t.assignees || []).map(kidName);
    return h("button", { type: "button", class: "kcard " + t.status, style: "--c:" + AREA_COLORS[t.area],
      onclick: () => { state.open = t.id; state.msg = ""; render(); } },
      h("div", { class: "kc-top" }, h("span", { class: "kc-code" }, t.code || ""), areaTag(t.area),
        t.key ? h("span", { class: "kc-key", title: "Key task" }, "★") : null,
        h("span", { class: "kc-due" + (isOverdue(t) ? " late" : "") }, shortDate(t.end))),
      h("div", { class: "kc-title" }, t.title),
      h("div", { class: "kc-foot" }, h("span", {}, icon("fa-user-group"), " ", people.length ? people.join(", ") : "unassigned"),
        (t.notes || []).length ? h("span", {}, icon("fa-comment"), " " + t.notes.length) : null));
  }

  function viewBoard() {
    const list = filtered();
    const wrap = h("div", {}, filterBar(true), summary());
    const cols = h("div", { class: "kanban" });
    for (const s of STATUS) {
      const items = list.filter((t) => t.status === s.id);
      if (s.id === "abandoned" && !items.length) continue;
      const col = h("div", { class: "kcol" }, h("div", { class: "kcol-head" }, h("span", { class: "pill st-" + s.id }, icon(s.icon), " ", s.label), h("span", { class: "fll-muted small" }, String(items.length))));
      if (!items.length) col.append(h("p", { class: "fll-muted small kc-empty" }, "nothing here"));
      let week = null;
      for (const t of items) {
        const w = weekOf(t.end);
        if (w !== week) { week = w; col.append(h("div", { class: "kc-week" + (isBreak(w) ? " brk" : "") }, weekLabel(w))); }
        col.append(card(t));
      }
      cols.append(col);
    }
    wrap.append(h("div", { class: "kanban-wrap" }, cols));
    return wrap;
  }

  /* ---------- list ---------- */

  function viewList(tasksOverride, emptyText) {
    const list = tasksOverride || filtered();
    const box = h("div", { class: "fll-card" });
    if (!tasksOverride) box.append(filterBar(true), summary());
    if (!list.length) { box.append(h("p", { class: "fll-muted" }, emptyText || "No tasks match.")); return box; }
    let week = null;
    for (const t of list) {
      const w = weekOf(t.end);
      if (w !== week) { week = w; box.append(h("div", { class: "kc-week list" + (isBreak(w) ? " brk" : "") }, weekLabel(w))); }
      box.append(row(t));
    }
    return box;
  }

  function row(t) {
    const people = (t.assignees || []).map(kidName);
    return h("div", { class: "pm-task " + t.status, style: "border-left:4px solid " + AREA_COLORS[t.area] },
      h("div", {},
        h("button", { type: "button", class: "pm-title linklike", onclick: () => { state.open = t.id; render(); } },
          h("span", { class: "kc-code" }, t.code || ""), " ", t.key ? "★ " : "", t.title),
        h("div", { class: "pm-meta" }, areaTag(t.area), statusPill(t.status),
          t.priority === "high" ? h("span", { class: "pill pr-high" }, "High priority") : null,
          isOverdue(t) ? h("span", { class: "pill overdue" }, icon("fa-clock"), " Overdue") : null,
          h("span", {}, icon("fa-calendar"), " ", shortDate(t.start), " → ", shortDate(t.end)),
          h("span", {}, icon("fa-user-group"), " ", people.length ? people.join(", ") : "unassigned"),
          (t.notes || []).length ? h("span", {}, icon("fa-comment"), " " + t.notes.length) : null)),
      h("div", { class: "pm-actions" }, statusSelect(t)));
  }

  function statusSelect(t) {
    if (!canSetStatus(t)) return null;
    return h("select", { "aria-label": "Status of " + t.title,
      onchange: (e) => act("pm_task", { op: "status", id: t.id, status: e.target.value }, setTasks) },
      STATUS.map((s) => h("option", { value: s.id, selected: s.id === t.status }, s.label)));
  }

  /* ---------- my tasks ---------- */

  function viewMine() {
    const d = state.data;
    const isKid = d.me.role === "kid";
    const who = isKid ? d.me.username : state.minePerson;
    const box = h("div", {});
    if (!isKid) {
      box.append(h("div", { class: "pm-filters" }, h("label", { class: "pm-inline" }, "Show tasks for ",
        h("select", { onchange: (e) => { state.minePerson = e.target.value; render(); } },
          h("option", { value: "" }, "Choose a team member…"), d.kids.map((k) => h("option", { value: k.username, selected: who === k.username }, k.name))))));
      if (!who) return box;
    }
    const mine = d.tasks.filter((t) => (t.assignees || []).includes(who));
    const open = mine.filter((t) => t.status !== "done" && t.status !== "abandoned");
    const closed = mine.filter((t) => t.status === "done" || t.status === "abandoned");
    box.append(h("p", { class: "fll-muted" }, (isKid ? "You have " : kidName(who) + " has ") + open.length + " open task" + (open.length === 1 ? "" : "s") +
      (open.filter(isOverdue).length ? " — " + open.filter(isOverdue).length + " overdue" : "") + "."));
    box.append(viewList(open, isKid ? "Nothing on your list right now. Ask your captain or lead what to pick up!" : "No open tasks."));
    if (closed.length) { box.append(h("div", { class: "fll-sub" }, "Finished")); box.append(viewList(closed)); }
    return box;
  }

  /* ---------- task details (status, notes, edit) ---------- */

  function viewDetails(t) {
    const close = () => { state.open = null; state.msg = ""; render(); };
    const people = (t.assignees || []).map(kidName);
    const noteInput = h("textarea", { maxlength: "300", placeholder: "Add a follow-up note (what happened, what's next, what you need)…" });
    const me = state.data.me;
    return h("div", { class: "pm-modal", onclick: (e) => { if (e.target.classList.contains("pm-modal")) close(); } },
      h("div", { class: "fll-card" },
        h("div", { class: "kc-top", style: "margin-bottom:6px" }, h("span", { class: "kc-code" }, t.code || ""), areaTag(t.area),
          t.key ? h("span", { class: "kc-key" }, "★ key task") : null,
          h("button", { class: "fll-tool-btn", type: "button", style: "margin-left:auto", onclick: close, "aria-label": "Close" }, icon("fa-xmark"))),
        h("h3", {}, t.title),
        state.msg ? h("p", { class: "fll-note warn", role: "alert" }, icon("fa-circle-exclamation"), " ", state.msg) : null,
        h("div", { class: "pm-meta" }, statusPill(t.status),
          isOverdue(t) ? h("span", { class: "pill overdue" }, icon("fa-clock"), " Overdue") : null,
          t.priority && t.priority !== "normal" ? h("span", { class: "pill pr-" + t.priority }, PRIORITY[t.priority] + " priority") : null,
          h("span", {}, icon("fa-calendar"), " ", shortDate(t.start), " → ", shortDate(t.end)),
          h("span", {}, icon("fa-user-group"), " ", people.length ? people.join(", ") : "unassigned")),
        t.desc ? h("div", { class: "pm-desc" }, t.desc) : null,
        h("div", { class: "pm-actions", style: "justify-content:flex-start;margin-top:12px" },
          canSetStatus(t) ? h("label", { class: "pm-inline" }, "Status ", statusSelect(t)) : null,
          canEditArea(t.area) ? h("button", { class: "fll-tool-btn", type: "button", onclick: () => { state.edit = t.id; state.open = null; render(); } }, icon("fa-pen"), " Edit") : null,
          canEditArea(t.area) ? h("button", { class: "fll-tool-btn", type: "button", onclick: () => {
            if (confirm("Delete " + (t.code || "") + " \"" + t.title + "\"?")) { state.open = null; act("pm_task", { op: "remove", id: t.id }, setTasks); }
          } }, icon("fa-trash"), " Delete") : null),
        h("div", { class: "fll-sub", style: "margin-top:16px" }, icon("fa-comments"), " Follow-up notes"),
        (t.notes || []).length
          ? h("ul", { class: "pm-notes" }, t.notes.map((n) => h("li", {},
            h("div", {}, n.text), h("small", {}, n.by + " · " + new Date(n.at * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
              n.u === me.username || canEditArea(t.area) ? h("button", { class: "fll-link-btn", type: "button",
                onclick: () => act("pm_task", { op: "note", id: t.id, remove: true, noteId: n.id }, setTasks) }, " delete") : null))))
          : h("p", { class: "fll-muted small" }, "No notes yet."),
        h("form", { class: "pm-form", onsubmit: (e) => { e.preventDefault(); act("pm_task", { op: "note", id: t.id, text: noteInput.value }, setTasks); } },
          h("div", { class: "wide" }, noteInput), h("button", { class: "btn primary fll-small-btn", type: "submit" }, icon("fa-paper-plane"), " Add note")),
        h("p", { class: "pm-by" }, "Added by " + (t.createdBy || "?") + (t.updatedBy && t.updatedBy !== t.createdBy ? " · last change by " + t.updatedBy : ""))));
  }

  /* ---------- task form (add / edit) ---------- */

  function taskForm(t) {
    const r = rights();
    const v = t || { area: state.f.area && r.areas.includes(state.f.area) ? state.f.area : r.areas[0], status: "not_started",
      priority: "normal", start: today(), end: addDays(today(), 6), assignees: [] };
    const area = h("select", {}, r.areas.map((a) => h("option", { value: a, selected: a === v.area }, state.data.areas[a])));
    const title = h("input", { type: "text", maxlength: "80", required: true, value: v.title || "", placeholder: "e.g. Interview an expert" });
    const desc = h("textarea", { maxlength: "400", placeholder: "What needs to happen? (optional)" }, v.desc || "");
    const start = h("input", { type: "date", required: true, value: v.start });
    const end = h("input", { type: "date", required: true, value: v.end });
    const status = h("select", {}, STATUS.map((s) => h("option", { value: s.id, selected: s.id === v.status }, s.label)));
    const priority = h("select", {}, Object.entries(PRIORITY).map(([id, label]) => h("option", { value: id, selected: id === (v.priority || "normal") }, label)));
    const key = h("input", { type: "checkbox", checked: !!v.key });
    const boxes = state.data.kids.map((k) => {
      const cb = h("input", { type: "checkbox", value: k.username, checked: (v.assignees || []).includes(k.username) });
      return { cb, el: h("label", {}, cb, k.name) };
    });
    const close = () => { state.edit = null; state.msg = ""; render(); };
    return h("div", { class: "pm-modal", onclick: (e) => { if (e.target.classList.contains("pm-modal")) close(); } },
      h("div", { class: "fll-card" },
        h("h3", {}, icon(t ? "fa-pen" : "fa-plus"), t ? " Edit " + (t.code || "task") : " New task"),
        state.msg ? h("p", { class: "fll-note warn", role: "alert" }, icon("fa-circle-exclamation"), " ", state.msg) : null,
        h("form", {
          class: "pm-form",
          onsubmit: (e) => {
            e.preventDefault();
            const body = { op: t ? "update" : "add", id: t ? t.id : undefined, area: area.value, title: title.value, desc: desc.value,
              start: start.value, end: end.value, status: status.value, priority: priority.value, key: key.checked,
              assignees: boxes.filter((b) => b.cb.checked).map((b) => b.cb.value) };
            act("pm_task", body, (res) => { state.data.tasks = res.tasks; state.edit = null; });
          }
        },
          h("label", {}, "Area", area), h("label", { class: "wide" }, "Task", title),
          h("label", { class: "wide" }, "Details", desc),
          h("label", {}, "Start", start), h("label", {}, "Due", end),
          h("label", {}, "Status", status), h("label", {}, "Priority", priority),
          h("label", { class: "pm-inline" }, key, " ★ Key task"),
          h("div", { class: "wide" }, h("div", { class: "fll-sub" }, "Who is working on it"), h("div", { class: "pm-people" }, boxes.map((b) => b.el))),
          h("button", { class: "btn primary fll-small-btn", type: "submit" }, icon("fa-floppy-disk"), t ? " Save" : " Add task"),
          h("button", { class: "fll-tool-btn", type: "button", onclick: close }, "Cancel"))));
  }

  /* ---------- timeline (Gantt) ---------- */

  function viewGantt() {
    const d = state.data;
    const tasks = filtered();
    const wrap = h("div", {}, filterBar(true));
    const card = h("div", { class: "fll-card" });
    wrap.append(card);
    card.append(h("div", { class: "gantt-tools" }, h("strong", {}, icon("fa-chart-gantt"), " Timeline"),
      h("label", { class: "pm-inline" }, "Zoom ", h("select", { onchange: (e) => { state.zoom = e.target.value; render(); } },
        [["day", "Days"], ["week", "Weeks"]].map(([v, l]) => h("option", { value: v, selected: state.zoom === v }, l))))));
    if (!tasks.length) { card.append(h("p", { class: "fll-muted" }, "No tasks to show.")); return wrap; }

    const t0 = today();
    let first = tasks.reduce((m, t) => (t.start < m ? t.start : m), tasks[0].start);
    let last = tasks.reduce((m, t) => (t.end > m ? t.end : m), tasks[0].end);
    if (t0 < first && daysBetween(t0, first) < 60) first = t0;
    if (t0 > last && daysBetween(last, t0) < 60) last = t0;
    if (EVENT.date > last && daysBetween(last, EVENT.date) < 30) last = EVENT.date;
    first = weekOf(first);
    last = addDays(weekOf(last), 6);
    const days = daysBetween(first, last) + 1;
    const W = state.zoom === "day" ? 30 : 12;
    const width = days * W;
    const x = (s) => daysBetween(first, s) * W;

    const gantt = h("div", { class: "gantt", style: "grid-template-columns:230px " + width + "px;" });
    const head = h("div", { class: "g-head", style: "width:" + width + "px" });
    const bg = [];
    for (let i = 0; i < days; i++) {
      const day = addDays(first, i);
      const dt = parse(day);
      if (dt.getDay() === 1) {
        head.append(h("div", { class: "g-month", style: "left:" + i * W + "px" }, weekLabel(day)));
        bg.push(["g-grid", "left:" + i * W + "px"]);
      }
      if (state.zoom === "day") head.append(h("div", { class: "g-tick", style: "left:" + (i * W + W / 2) + "px" }, String(dt.getDate())));
      if (isBreak(day)) bg.push(["g-break", "left:" + i * W + "px;width:" + W + "px"]);
      else if (state.zoom === "day" && (dt.getDay() === 0 || dt.getDay() === 6)) bg.push(["g-weekend", "left:" + i * W + "px;width:" + W + "px"]);
    }
    const marks = [];
    if (t0 >= first && t0 <= last) marks.push(["g-today", x(t0) + W / 2, "Today"]);
    if (EVENT.date >= first && EVENT.date <= last) marks.push(["g-event", x(EVENT.date) + W / 2, EVENT.label]);
    const decorate = (r) => {
      for (const [cls, style] of bg) r.append(h("div", { class: cls, style }));
      for (const [cls, left, title] of marks) r.append(h("div", { class: cls, style: "left:" + left + "px", title }));
      return r;
    };
    gantt.append(h("div", { class: "g-label g-head g-head-label" }, "Task"), decorate(head));

    for (const [area, label] of Object.entries(d.areas)) {
      const items = tasks.filter((t) => t.area === area).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
      if (!items.length) continue;
      gantt.append(h("div", { class: "g-group", style: "color:" + AREA_COLORS[area] }, label + " · " + items.length), h("div", { class: "g-group-fill" }));
      for (const t of items) {
        const left = x(t.start);
        const w = Math.max((daysBetween(t.start, t.end) + 1) * W, 8);
        const people = (t.assignees || []).map(kidName).join(", ");
        const tip = (t.code || "") + " " + t.title + "\n" + shortDate(t.start) + " → " + shortDate(t.end) + " · " + statusOf(t.status).label + (people ? "\n" + people : "");
        const bar = h("button", {
          type: "button", class: "g-bar " + t.status + (isOverdue(t) ? " overdue" : "") + (t.key ? " key" : ""), title: tip,
          style: "left:" + left + "px;width:" + w + "px;--c:" + AREA_COLORS[area],
          onclick: () => { state.open = t.id; render(); }
        }, w > 44 ? (t.code || "") : "");
        gantt.append(h("div", { class: "g-label", title: tip }, h("span", { class: "kc-code" }, t.code || ""), " ", t.title,
          h("small", {}, (people || "unassigned") + " · " + statusOf(t.status).label)),
          decorate(h("div", { class: "g-row", style: "width:" + width + "px" }, bar)));
      }
    }
    card.append(h("div", { class: "gantt-wrap" }, gantt));
    card.append(h("div", { class: "g-legend" },
      STATUS.map((s) => h("span", {}, h("i", { class: "sw g-bar " + s.id, style: "position:static;padding:0;height:10px;width:16px" }), s.label)),
      h("span", {}, h("i", { class: "sw", style: "outline:2px solid #fbbf24;background:transparent" }), "★ Key task"),
      h("span", {}, h("i", { class: "sw", style: "outline:2px solid #ef4444;background:transparent" }), "Overdue"),
      h("span", {}, h("i", { class: "sw", style: "background:#f43f5e;width:3px;height:14px" }), "Today"),
      h("span", {}, h("i", { class: "sw", style: "background:#a3e635;width:3px;height:14px" }), EVENT.label),
      h("span", {}, h("i", { class: "sw g-break", style: "position:static;width:16px;height:10px" }), "Break")));
    card.append(h("p", { class: "fll-muted small" }, "Click a bar to open the task."));
    return wrap;
  }

  /* ---------- team posts ---------- */

  function viewPosts() {
    const d = state.data;
    const r = rights();
    const setPosts = (res) => { state.data.posts = res.posts; };
    const card = h("div", { class: "fll-card" },
      h("h3", {}, icon("fa-id-badge"), " Team posts"),
      h("p", { class: "fll-muted" }, "A post gives a team member a title and lets them create and manage the tasks for an area (for example an Innovation Lead runs the Project tasks). Captain and Vice Captain can manage every area and hand out the other posts. Only the coach makes captains."));
    if (r.assign) {
      const who = h("select", {}, h("option", { value: "" }, "Choose a team member…"), d.kids.map((k) => h("option", { value: k.username }, k.name)));
      const title = h("input", { type: "text", maxlength: "40", list: "pmTitleIdeas", placeholder: "e.g. Innovation Lead", required: true });
      const areaOpts = (r.coach ? [["all", "All areas (Captain / Vice Captain)"]] : []).concat(Object.entries(d.areas));
      const area = h("select", {}, areaOpts.map(([v, l]) => h("option", { value: v }, l)));
      const assign = h("input", { type: "checkbox" });
      title.addEventListener("change", () => {
        const t = title.value.toLowerCase();
        if (r.coach && (t === "captain" || t === "vice captain")) { area.value = "all"; assign.checked = true; return; }
        const guess = { innovation: "project", research: "project", presentation: "project", project: "project",
          robot: "robot", coding: "robot", code: "robot", build: "robot", "core values": "team", team: "team", spirit: "team",
          logistics: "logistics", outreach: "logistics", fundrais: "logistics" };
        for (const [k, a] of Object.entries(guess)) if (t.includes(k)) { area.value = a; break; }
      });
      card.append(h("datalist", { id: "pmTitleIdeas" }, TITLE_IDEAS.map((t) => h("option", { value: t }))),
        h("form", {
          class: "pm-form",
          onsubmit: (e) => {
            e.preventDefault();
            if (!who.value) { state.msg = "Choose a team member first."; render(); return; }
            act("pm_post", { op: "add", username: who.value, title: title.value, area: area.value, assign: r.coach && assign.checked }, setPosts);
          }
        },
          h("label", {}, "Team member", who), h("label", {}, "Title", title), h("label", {}, "Runs tasks for", area),
          r.coach ? h("label", { class: "pm-inline" }, assign, " Can hand out posts") : null,
          h("button", { class: "btn primary fll-small-btn", type: "submit" }, icon("fa-plus"), " Give post")));
    }
    const canRemove = (p) => r.assign && (r.coach || (p.area !== "all" && !p.assign));
    const table = h("table", { class: "grid", style: "margin-top:14px" },
      h("thead", {}, h("tr", {}, ["Team member", "Posts", "Manages tasks in", "Open tasks"].map((t) => h("th", { style: "text-align:left" }, t)))),
      h("tbody", {}, d.kids.map((k) => {
        const ps = postsOf(k.username);
        const areas = ps.some((p) => p.area === "all") ? "Every area" : [...new Set(ps.map((p) => d.areas[p.area]).filter(Boolean))].join(", ");
        const open = d.tasks.filter((t) => (t.assignees || []).includes(k.username) && t.status !== "done" && t.status !== "abandoned").length;
        return h("tr", {},
          h("td", { style: "text-align:left" }, k.name),
          h("td", { style: "text-align:left;white-space:normal" }, ps.length ? ps.map((p) => h("span", { style: "display:inline-flex;gap:4px;align-items:center;margin:2px 6px 2px 0" },
            h("span", { class: "pill post" + (p.area === "all" ? " all" : ""), title: "Given by " + p.by }, p.title),
            canRemove(p) ? h("button", { class: "fll-link-btn", type: "button", title: "Remove this post",
              onclick: () => { if (confirm("Remove " + k.name + "'s post \"" + p.title + "\"?")) act("pm_post", { op: "remove", id: p.id }, setPosts); } }, "×") : null))
            : h("span", { class: "fll-muted small" }, "Team member")),
          h("td", { style: "text-align:left;white-space:normal" }, areas || h("span", { class: "fll-muted small" }, "—")),
          h("td", { style: "text-align:left" }, String(open)));
      })));
    card.append(h("div", { class: "grid-wrap" }, table));
    return card;
  }

  /* ---------- render ---------- */

  function render() {
    root.replaceChildren();
    if (!state.user || !state.data) {
      if (state.user && !state.data) {
        root.append(state.msg
          ? h("div", { class: "fll-card" }, h("p", {}, icon("fa-circle-exclamation"), " ", state.msg), " ",
            h("button", { class: "fll-tool-btn", type: "button", onclick: logout }, icon("fa-right-from-bracket"), " Log out"))
          : h("p", { class: "fll-muted" }, "Loading…"));
        return;
      }
      root.append(viewLogin());
      return;
    }
    root.append(header());
    if (state.msg && !state.edit && !state.open) root.append(h("p", { class: "fll-note warn", role: "alert" }, icon("fa-circle-exclamation"), " ", state.msg));
    root.append(tabs());
    root.append(({ board: viewBoard, list: () => viewList(), gantt: viewGantt, mine: viewMine, posts: viewPosts }[state.tab] || viewBoard)());
    if (state.edit) {
      const t = state.edit === "new" ? null : state.data.tasks.find((x) => x.id === state.edit);
      if (state.edit === "new" || t) root.append(taskForm(t));
      else state.edit = null;
    } else if (state.open) {
      const t = state.data.tasks.find((x) => x.id === state.open);
      if (t) root.append(viewDetails(t));
      else state.open = null;
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (state.open || state.edit)) { state.open = null; state.edit = null; state.msg = ""; render(); }
  });

  (async function init() {
    root.replaceChildren(h("p", { class: "fll-muted" }, "Loading…"));
    try {
      const status = await api("status");
      if (!status.ready) { root.replaceChildren(h("p", { class: "fll-card" }, "The team server is not set up yet.")); return; }
      state.user = (await api("me")).user;
      await reload();
    } catch (err) {
      state.user = null;
      render();
    }
  })();
})();
