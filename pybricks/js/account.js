// Logins for the Robot Lab. Uses the same accounts and server as the FLL Attachment Lab
// (/api/fll, created by the coach on /fll-coach.html), so one login works in both games.
// Without the server (e.g. a plain static copy) everything still works as a guest.

async function api(action, opts = {}) {
  const method = opts.method || 'GET';
  const body = method === 'POST' ? JSON.stringify(opts.body || {}) : undefined;
  const res = await fetch('/api/fll?action=' + action, {
    method,
    credentials: 'same-origin',
    keepalive: !!body && body.length < 30000,   // lets the last save finish when the page closes
    headers: method === 'POST' ? { 'Content-Type': 'application/json', 'X-FLL-Request': '1' } : {},
    body
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* not JSON */ }
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return data;
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export const account = {
  available: false,   // is the login server there?
  user: null,         // { username, name, team, role: 'kid' | 'coach' }
  robot: {},          // { setup, code: { mapId: program } }
  scores: {},         // { mapId: { best, runs, ... } }

  get kid() { return !!this.user && this.user.role === 'kid'; },

  // Find out whether the server exists and who is logged in.
  async init() {
    try {
      const s = await withTimeout(api('status'), 4000);
      this.available = !!s.ready;
    } catch (e) { this.available = false; }
    if (!this.available) return;
    try {
      const me = await withTimeout(api('me'), 4000);
      this.user = me.user || null;
      if (this.kid) await this.loadRobot();
    } catch (e) { this.user = null; }
  },

  async loadRobot() {
    const d = await api('robot');
    this.robot = d.robot || {};
    this.scores = d.scores || {};
  },

  async login(username, password) {
    const d = await api('login', { method: 'POST', body: { username, password } });
    this.user = d.user;
    this.robot = {}; this.scores = {};
    if (this.kid) await this.loadRobot();
    return this.user;
  },

  async logout() {
    try { await api('logout', { method: 'POST' }); } catch (e) { /* cookie is cleared anyway */ }
    this.user = null; this.robot = {}; this.scores = {};
  },

  code(mapId) { return (this.robot.code || {})[mapId]; },

  async saveCode(mapId, code) {
    (this.robot.code = this.robot.code || {})[mapId] = code;
    return api('robot', { method: 'POST', body: { mapId, code } });
  },

  async saveSetup(setup) {
    this.robot.setup = setup;
    return api('robot', { method: 'POST', body: { setup } });
  },

  async saveScore(rec) {
    const d = await api('robot_score', { method: 'POST', body: rec });
    const s = this.scores[rec.mapId] || {};
    this.scores[rec.mapId] = Object.assign(s, { best: d.best });
    return d;
  }
};
