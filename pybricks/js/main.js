// Page logic: editor, worker, replay of simulation frames, missions UI.
import { World } from './render3d.js';
import { REFERENCE } from './reference.js';
import { account } from './account.js';

const PYB = window.PYB;
const R = PYB.ROBOT;
const DEG = Math.PI / 180;
const $ = (id) => document.getElementById(id);

// ---------- storage (best effort) ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
};

// ---------- load map files ----------
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}
for (const f of PYB.MAP_FILES) await loadScript('js/maps/' + f);
PYB.MAPS.sort((a, b) => (a.level || 99) - (b.level || 99));

// ---------- editor ----------
const editor = CodeMirror.fromTextArea($('code'), {
  mode: 'python', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false,
  matchBrackets: true, autoCloseBrackets: true,
  extraKeys: {
    Tab: (cm) => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection('    ', 'end'),
    'Shift-Tab': (cm) => cm.indentSelection('subtract'),
    'Ctrl-Enter': () => run(), 'Cmd-Enter': () => run()
  }
});
let errLine = null;
let loadingCode = false;   // true while a saved program is being put into the editor
editor.on('change', () => {
  if (errLine !== null) { editor.removeLineClass(errLine, 'background', 'err-line'); errLine = null; }
  if (!map || loadingCode) return;
  if (account.kid) queueCloudSave();
  else store.set('pyb-code-' + map.id, editor.getValue());
});

// ---------- saving to the kid's login ----------
let saveTimer = null, saveMap = null;
function saveState(text, cls) { const el = $('saveState'); el.textContent = text; el.className = 'save-state ' + (cls || ''); }
function queueCloudSave() {
  if (saveTimer && saveMap !== map.id) flushCloudSave();
  saveMap = map.id;
  saveState('· saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushCloudSave, 1500);
}
async function flushCloudSave() {
  clearTimeout(saveTimer); saveTimer = null;
  const id = saveMap; saveMap = null;
  if (!id || !account.kid) return;
  const code = id === (map && map.id) ? editor.getValue() : account.code(id);
  try {
    await account.saveCode(id, code);
    if (!saveTimer) saveState('· saved ✓', 'ok');
  } catch (e) {
    saveState('· not saved: ' + e.message, 'bad');
  }
}
window.addEventListener('pagehide', () => { if (saveTimer) flushCloudSave(); });

// ---------- 3D world ----------
const world = new World($('view'));

// ---------- state ----------
let map = null;
let worker = null, workerReady = false;
let lastMsg = 0;
const play = {
  active: false, frames: [], events: [], fi: 0, ei: 0, t: 0, workerDone: false,
  score: 0, bumps: 0, done: new Set(), light: null, disp: null, ended: false, hadError: false
};

// ---------- worker ----------
function makeWorker() {
  workerReady = false;
  setStatus('Loading Python…', 'busy');
  $('runBtn').disabled = true;
  worker = new Worker('js/worker.js');
  worker.onmessage = (e) => onWorker(e.data);
  worker.onerror = (e) => { consoleLine('Worker error: ' + (e.message || e), 'err'); };
}
function onWorker(m) {
  lastMsg = performance.now();
  if (m.type === 'status') { $('loadingText').textContent = m.text; setStatus(m.text, 'busy'); }
  else if (m.type === 'ready') {
    workerReady = true; $('loading').hidden = true; $('runBtn').disabled = false;
    setStatus('Ready', 'ok');
  } else if (m.type === 'fatal') {
    $('loadingText').textContent = 'Could not start Python: ' + m.text;
    consoleLine('Could not start Python: ' + m.text + '\nCheck your internet connection and reload the page.', 'err');
    setStatus('Error', '');
  } else if (m.type === 'chunk') {
    for (const f of m.frames) play.frames.push(f);
    for (const ev of m.events) play.events.push(ev);
  } else if (m.type === 'done') {
    play.workerDone = true;
    setStatus('Replaying…', 'busy');
  }
}
makeWorker();

// ---------- UI helpers ----------
function setStatus(text, cls) { const s = $('status'); s.textContent = text; s.className = 'status ' + (cls || ''); }
function fmtT(ms) { return (ms / 1000).toFixed(1).padStart(5, ' '); }
function consoleLine(text, cls, t) {
  const pre = $('console');
  if (pre.childNodes.length > 1500) pre.removeChild(pre.firstChild);
  const span = document.createElement('span');
  if (cls) span.className = cls;
  if (t !== undefined) {
    const ts = document.createElement('span'); ts.className = 't'; ts.textContent = '[' + fmtT(t) + 's] ';
    pre.appendChild(ts);
  }
  span.textContent = text.endsWith('\n') ? text : text + '\n';
  pre.appendChild(span);
  pre.scrollTop = pre.scrollHeight;
}
let toastTimer = null;
function toast(text, bad) {
  const el = $('toast');
  el.textContent = text; el.className = 'toast' + (bad ? ' bad' : ''); el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2200);
}
function hsvToCss(h, s, v) {
  s /= 100; v /= 100;
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return `rgb(${Math.round(f(5) * 255)},${Math.round(f(3) * 255)},${Math.round(f(1) * 255)})`;
}

// hub matrix widget
const cells = [];
for (let i = 0; i < 25; i++) { const c = document.createElement('i'); $('hubMatrix').appendChild(c); cells.push(c); }
function showMatrix(px, label) {
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const b = px ? px[r][c] / 100 : 0;
    cells[r * 5 + c].style.background = b > 0 ? `rgba(255,255,255,${0.25 + 0.75 * b})` : '#333';
  }
  $('hubLabel').textContent = label || '';
  world.setDisplay(px);
}
function showLight(hsv) {
  $('hubLight').style.background = hsv ? hsvToCss(hsv[0], hsv[1], hsv[2]) : '#444';
  world.setHubLight(hsv);
}

// ---------- audio ----------
let audio = null;
function beep(f, d, v) {
  const spd = +$('speedSelect').value;
  if (!audio || spd > 4 || !d) return;
  const o = audio.createOscillator(), gn = audio.createGain();
  o.type = 'square'; o.frequency.value = f;
  gn.gain.value = 0.04 * (v ?? 100) / 100;
  o.connect(gn); gn.connect(audio.destination);
  const t0 = audio.currentTime;
  o.start(t0); o.stop(t0 + d / 1000 / spd);
}

// ---------- maps ----------
function fillMapSelect() {
  const sel = $('mapSelect');
  sel.innerHTML = '';
  for (const m of PYB.MAPS) {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = `${m.level || ''}. ${m.name} · ${m.difficulty || ''}`;
    sel.appendChild(o);
  }
}
function selectMap(id) {
  stopRun(true);
  map = PYB.MAPS.find(m => m.id === id) || PYB.MAPS[0];
  $('mapSelect').value = map.id;
  store.set('pyb-map', map.id);
  if (location.hash !== '#' + map.id) history.replaceState(null, '', '#' + map.id);
  if (saveTimer) flushCloudSave();
  const saved = account.kid ? account.code(map.id) : store.get('pyb-code-' + map.id);
  loadingCode = true;
  editor.setValue(!saved || isStarterCode(saved) ? starterCode() : saved);
  loadingCode = false;
  editor.clearHistory();
  world.loadMap(map);
  if (measure.tool) { measure.pts = []; measure.hover = null; drawMeasure(); }
  resetPlayback();
  renderMissions();
  renderRobotTab();
}

// ---------- missions panel ----------
function renderMissions() {
  const total = map.missions.reduce((a, m) => a + (m.points || 0), 0);
  const el = $('tab-missions');
  el.innerHTML = '';
  const p = document.createElement('p'); p.className = 'blurb';
  p.textContent = `${map.blurb}  Match time: ${(map.timeLimit || 150)} s · ${total} points.`;
  el.appendChild(p);
  const ul = document.createElement('ul'); ul.className = 'missions';
  map.missions.forEach((m, i) => {
    const li = document.createElement('li'); li.id = 'mis-' + m.id;
    if (play.done.has(m.id)) li.classList.add('done');
    li.innerHTML = `<span class="chk">${play.done.has(m.id) ? '✓' : i + 1}</span>
      <div><div class="nm"></div><div class="ds"></div></div><span class="pts">${m.points}</span>`;
    li.querySelector('.nm').textContent = m.name;
    li.querySelector('.ds').textContent = m.desc;
    if (m.hint) {
      const d = document.createElement('details');
      d.innerHTML = '<summary>Hint</summary>';
      d.appendChild(document.createTextNode(m.hint));
      li.querySelector('div').appendChild(d);
    }
    ul.appendChild(li);
  });
  el.appendChild(ul);
}
function markMission(id) {
  const li = $('mis-' + id);
  if (li) { li.classList.add('done'); li.querySelector('.chk').textContent = '✓'; }
}

function renderRobotTab() {
  const el = $('tab-robot');
  const rows = Object.entries(R.ports).map(([p, v]) => `<tr><td>Port.${p}</td><td>${v.label}</td></tr>`).join('');
  el.innerHTML = `
    <p class="blurb">Robot setup: <b>${setupLabel(R.setup)}</b>. Change it with the 🤖 button at the top. Your program should start with:</p>
    <pre class="setup-code">${PYB.setupCode(R.setup)}</pre>
    <table class="spec" style="margin-top:10px"><tbody>${rows}</tbody></table>
    <table class="spec" style="margin-top:10px"><tbody>
      <tr><td>Wheels</td><td>${R.wheelDiameter} mm diameter, ${R.axleTrack} mm apart (axle track)</td></tr>
      <tr><td>Body</td><td>150 mm long, 130 mm wide, ${R.bodyHeight} mm tall. Front is ${R.bodyFront} mm ahead of the wheel axle.</td></tr>
      <tr><td>Arm</td><td>${R.armLength} mm long, pivot ${R.pivotZ} mm high and ${R.pivotX} mm ahead of the wheel axle. It can move from ${R.armMin}° to +${R.armMax}°; it starts level (0°).</td></tr>
      <tr><td>Tip height</td><td><code>${R.pivotZ} + ${R.armLength} × sin(angle)</code> mm</td></tr>
      <tr><td>Tip reach</td><td><code>${R.pivotX} + ${R.armLength} × cos(angle)</code> mm ahead of the wheel axle</td></tr>
      <tr><td>Start</td><td>x = ${map.start.x} mm, y = ${map.start.y} mm, facing ${['east', 'north', 'west', 'south'][Math.round(((map.start.yaw || 0) % 360 + 360) % 360 / 90) % 4]}. The mat grid is 100 mm.</td></tr>
    </tbody></table>`;
}
function renderHelp() {
  $('tab-help').innerHTML = `<div class="help">
    <p><b>Write Pybricks Python on the left and press ▶ Run</b> (or Ctrl+Enter). The program runs on a simulated
    SPIKE Prime robot, then the robot replays what happened in 3D.</p>
    <ul>
      <li>The robot is solid: it <b>can't drive through obstacles</b>. Orange and red hazard pieces hanging from walls
      can catch the <b>arm</b> even when the robot body fits underneath.</li>
      <li>If a motor keeps pushing against something for 2 s, the robot is <b>stuck</b>: the command is cancelled and
      the console says what it hit. Bumping hazard pieces loses the Clean Run bonus.</li>
      <li>A match lasts ${map ? map.timeLimit || 150 : 150} s of robot time. Loops need <code>wait()</code> or a sensor
      reading to move time forward.</li>
      <li>Use the <b>Side</b> camera to judge arm heights, and <b>Top</b> with the 100 mm grid to measure distances.</li>
      <li><code>print()</code> output appears when the replay reaches that moment.</li>
      <li>Multitasking works like on a real hub: <code>async def main()</code>, <code>await multitask(...)</code>, <code>run_task(main())</code>.</li>
      <li>Your code is saved in this browser for each map.</li>
    </ul></div>`;
}

// ---------- run / stop / reset ----------
function resetPlayback() {
  Object.assign(play, { active: false, frames: [], events: [], fi: 0, ei: 0, t: 0, workerDone: false, score: 0,
    bumps: 0, done: new Set(), light: null, disp: null, ended: false, hadError: false });
  $('results').hidden = true;
  world.resetRobot();
  showMatrix(null); showLight([0, 0, 100]);
  updateHud();
  renderMissionsIfLoaded();
}
function renderMissionsIfLoaded() { if (map) renderMissions(); }

function run() {
  if (!workerReady) return;
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } }
  if (play.active && !play.workerDone) stopRun(false);
  resetPlayback();
  play.active = true;
  lastMsg = performance.now();
  consoleLine('▶ Running main.py on "' + map.name + '"', 'sys');
  setStatus('Running…', 'busy');
  $('stopBtn').disabled = false;
  worker.postMessage({ type: 'run', code: editor.getValue(), mapId: map.id, setup: R.setup });
}
function stopRun(silent) {
  const busy = play.active && !play.workerDone;
  if (busy) {
    worker.terminate();
    makeWorker();
  }
  if (play.active && !silent) consoleLine('■ Stopped', 'sys');
  play.active = false;
  $('stopBtn').disabled = true;
  if (!busy && workerReady) setStatus('Ready', 'ok');
}

// ---------- playback ----------
function applyEvent(ev) {
  switch (ev.type) {
    case 'print': consoleLine(ev.text, ev.level === 'warn' ? 'warn' : '', ev.t); break;
    case 'beep': beep(ev.f, ev.d, ev.v); break;
    case 'light': play.light = Object.assign({ t0: ev.t }, ev); if (ev.mode === 'on') showLight(ev.color); break;
    case 'display':
      if (ev.frames) play.disp = { t0: ev.t, frames: ev.frames, interval: ev.interval };
      else { play.disp = null; showMatrix(ev.pixels, ev.label); }
      break;
    case 'mission': {
      play.done.add(ev.id); play.score = ev.score;
      const m = map.missions.find(x => x.id === ev.id);
      markMission(ev.id);
      if (m && m.target) world.setTargetDone(m.target, true);
      if (m && m.rect) world.setZoneDone(ev.id);
      toast(`✓ ${m ? m.name : ev.id}  +${ev.points}`);
      consoleLine(`✓ Mission complete: ${m ? m.name : ev.id} (+${ev.points})`, 'ok', ev.t);
      break;
    }
    case 'bump':
      world.flash(ev.id);
      if (ev.penalty) { play.bumps++; toast('Bump: ' + ev.label, true); }
      break;
    case 'stuck': if (ev.id) world.flash(ev.id); toast('Stuck!', true); break;
    case 'error':
      play.hadError = true;
      consoleLine(ev.text, 'err', ev.t);
      if (ev.line) {
        errLine = ev.line - 1;
        editor.addLineClass(errLine, 'background', 'err-line');
        editor.scrollIntoView({ line: errLine, ch: 0 }, 80);
      }
      break;
    case 'end': play.ended = ev; break;
  }
}

function animateHub() {
  const L = play.light;
  if (L && L.mode === 'blink') {
    const per = L.durations.reduce((a, b) => a + b, 0) || 1;
    let ph = (play.t - L.t0) % per, on = true, acc = 0;
    for (let i = 0; i < L.durations.length; i++) { acc += L.durations[i]; if (ph < acc) { on = i % 2 === 0; break; } }
    showLight(on ? L.color : null);
  } else if (L && L.mode === 'animate' && L.colors.length) {
    const i = Math.floor((play.t - L.t0) / (L.interval || 100)) % L.colors.length;
    showLight(L.colors[i]);
  }
  const D = play.disp;
  if (D && D.frames.length) {
    const i = Math.floor((play.t - D.t0) / (D.interval || 100)) % D.frames.length;
    showMatrix(D.frames[i]);
  }
}

function updateHud(pose) {
  const p = pose || world.pose || { yaw: 0, arm: 0 };
  const yaw0 = map ? (map.start.yaw || 0) * DEG : 0;
  $('hudTime').textContent = (play.t / 1000).toFixed(1) + ' s';
  $('hudScore').textContent = play.score;
  $('hudHeading').textContent = Math.round(-(p.yaw - yaw0) / DEG) + '°';
  $('hudArm').textContent = Math.round(p.arm) + '°';
  $('hudTip').textContent = Math.round(R.pivotZ + R.armLength * Math.sin(p.arm * DEG)) + ' mm';
  $('hudBumps').textContent = play.bumps;
}

function showResults() {
  const total = map.missions.reduce((a, m) => a + (m.points || 0), 0);
  const end = play.ended || {};
  const el = $('results');
  const reason = end.reason === 'timeup' ? "Time's up!" : end.reason === 'error' ? 'Program stopped with an error' : 'Program finished';
  el.innerHTML = `<h3>${reason}</h3>
    <div><span class="big">${play.score}</span> / ${total} points · ${(play.t / 1000).toFixed(1)} s · ${play.bumps} bump${play.bumps === 1 ? '' : 's'}</div>
    <ul>${map.missions.map(m => `<li class="${play.done.has(m.id) ? '' : 'miss'}"><span>${play.done.has(m.id) ? '✓' : '·'} ${escapeHtml(m.name)}</span><b>${play.done.has(m.id) ? '+' + m.points : 0}</b></li>`).join('')}</ul>
    <div class="row"><button class="btn" id="replayBtn">↺ Watch again</button><button class="btn primary" id="closeRes">Close</button></div>`;
  el.hidden = false;
  $('closeRes').onclick = () => (el.hidden = true);
  $('replayBtn').onclick = replay;
  const best = +(store.get('pyb-best-' + map.id) || 0);
  if (play.score > best) store.set('pyb-best-' + map.id, String(play.score));
  if (account.kid && !play.reported) {
    play.reported = true;
    const prevBest = (account.scores[map.id] || {}).best || 0;
    account.saveScore({ mapId: map.id, mapName: map.name, score: play.score, total, missions: [...play.done] })
      .then(d => { if (play.score > prevBest && play.score === d.best) toastMsg('New best on ' + map.name + ': ' + d.best + ' points!'); })
      .catch(err => toastMsg('Score not saved: ' + err.message));
  }
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function replay() {
  const frames = play.frames, events = play.events.filter(e => e.type !== 'print' && e.type !== 'error');
  resetPlayback();
  Object.assign(play, { frames, events, workerDone: true, active: true, reported: true });
}

let lastNow = performance.now();
function loop(now, manual) {
  const dt = manual ? now - lastNow : Math.min(100, now - lastNow); lastNow = now;
  if (play.active) {
    const spd = +$('speedSelect').value;
    const F = play.frames;
    const lastT = F.length ? F[F.length - 1][0] : 0;
    play.t = Math.min(play.t + dt * spd, lastT);
    // events up to now
    while (play.ei < play.events.length && play.events[play.ei].t <= play.t) applyEvent(play.events[play.ei++]);
    // frames
    while (play.fi + 1 < F.length && F[play.fi + 1][0] <= play.t) { play.fi++; world.addTrail(F[play.fi][1], F[play.fi][2]); }
    if (F.length) {
      const a = F[play.fi], b = F[Math.min(play.fi + 1, F.length - 1)];
      const k = b[0] > a[0] ? Math.max(0, Math.min(1, (play.t - a[0]) / (b[0] - a[0]))) : 0;
      const L = (i) => a[i] + (b[i] - a[i]) * k;
      const pose = { x: L(1), y: L(2), yaw: L(3), arm: L(4), wl: L(5), wr: L(6) };
      world.setRobot(pose);
      updateHud(pose);
    }
    animateHub();
    if (play.workerDone && play.t >= lastT && play.ei >= play.events.length) {
      play.active = false;
      $('stopBtn').disabled = true;
      setStatus('Ready', 'ok');
      if (play.ended) showResults();
    }
    // watchdog: a Python loop that never touches the robot can't be interrupted any other way
    if (!play.workerDone && performance.now() - lastMsg > 6000) {
      consoleLine('Program stopped: it ran for a long time without moving the robot or reading a sensor.\n' +
        'Does a loop need a wait(10) inside it?', 'err');
      stopRun(true);
    }
  }
  world.render();
  if (!manual) requestAnimationFrame(loop);
}

// ---------- reference dialog ----------
function renderReference(filter) {
  const q = (filter || '').toLowerCase().trim();
  const body = $('refBody');
  body.innerHTML = '';
  for (const sec of REFERENCE) {
    const items = sec.items.filter(([s, d]) => !q || s.toLowerCase().includes(q) || d.toLowerCase().includes(q) || sec.mod.toLowerCase().includes(q));
    if (!items.length) continue;
    const h = document.createElement('h3'); h.textContent = sec.mod; body.appendChild(h);
    if (sec.note) { const n = document.createElement('p'); n.className = 'ref-note'; n.textContent = sec.note; body.appendChild(n); }
    for (const [sig, desc] of items) {
      const it = document.createElement('div'); it.className = 'ref-item'; it.title = 'Click to insert into your code';
      it.innerHTML = '<span class="sig"></span><span class="d"></span>';
      it.querySelector('.sig').textContent = sig; it.querySelector('.d').textContent = desc;
      it.onclick = () => {
        const text = sig.split('  /  ')[0];
        editor.replaceSelection(text);
        $('refDialog').close(); editor.focus();
      };
      body.appendChild(it);
    }
  }
}

// ---------- wire up ----------
fillMapSelect();
renderHelp();
renderReference('');
$('mapSelect').onchange = (e) => selectMap(e.target.value);
$('runBtn').onclick = run;
$('stopBtn').onclick = () => stopRun(false);
$('resetBtn').onclick = () => { stopRun(true); resetPlayback(); };
$('clearBtn').onclick = () => ($('console').innerHTML = '');
$('refBtn').onclick = () => { $('refDialog').showModal(); $('refSearch').focus(); };
$('refClose').onclick = () => $('refDialog').close();
$('refSearch').oninput = (e) => renderReference(e.target.value);
document.querySelectorAll('.cams button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.cams button').forEach(x => x.classList.toggle('on', x === b));
  world.setCamera(b.dataset.cam, true);
});
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
  for (const id of ['missions', 'robot', 'help']) $('tab-' + id).hidden = id !== t.dataset.tab;
});
$('moreBtn').onclick = (e) => { e.stopPropagation(); $('moreMenu').hidden = !$('moreMenu').hidden; };
document.addEventListener('click', () => ($('moreMenu').hidden = true));
$('moreMenu').onclick = (e) => {
  const act = e.target.dataset.act;
  if (act === 'starter') { if (confirm('Replace your code with the starter code for this map?')) editor.setValue(starterCode()); }
  else if (act === 'download') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([editor.getValue()], { type: 'text/x-python' }));
    a.download = map.id + '.py'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } else if (act === 'upload') $('fileInput').click();
};
$('fileInput').onchange = async (e) => {
  const f = e.target.files[0];
  if (f) editor.setValue(await f.text());
  e.target.value = '';
};
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== map.id) selectMap(id); });

// ---------- robot setup ----------
const SETUP_KEYS = ['left', 'right', 'arm', 'color', 'ultrasonic', 'force', 'mirrored', 'armUp', 'wheel', 'track'];
const sameSetup = (a, b) => !!a && !!b && SETUP_KEYS.every(k => String(a[k]) === String(b[k]));
const presetList = () => Object.entries(PYB.SETUP_PRESETS).map(([id, p]) => ({ id, name: p.name, desc: p.desc, s: PYB.cleanSetup(p) }));
function readSetup(key) {
  try { const j = store.get(key); return j ? PYB.cleanSetup(JSON.parse(j)) : null; } catch (e) { return null; }
}
function defaultSetup() {
  if (account.kid && account.robot.setup) return PYB.cleanSetup(account.robot.setup);
  return readSetup('pyb-setup-default') || PYB.cleanSetup(PYB.SETUP_PRESETS[PYB.DEFAULT_SETUP] || PYB.SETUP_PRESETS.lab);
}
function setupLabel(s) {
  const p = presetList().find(o => sameSetup(o.s, s));
  return p ? p.name : 'My robot';
}
function describeSetup(s) {
  return `Drive motors on ${s.left} (left) and ${s.right} (right), arm on ${s.arm}, ${s.wheel} mm wheels.`;
}
function starterCode() { return PYB.adaptStarter(map.starter, R.setup); }
// true when the code is this map's starter program for some setup (the kid hasn't changed it)
function isStarterCode(code) {
  const cands = presetList().map(o => o.s).concat([R.setup, defaultSetup(), readSetup('pyb-setup-custom')]);
  return code === map.starter || cands.some(s => s && code === PYB.adaptStarter(map.starter, s));
}
function applyRobotSetup(s) {
  PYB.applySetup(s);
  $('setupName').textContent = setupLabel(R.setup);
  world.rebuildRobot();
  if (map) {
    stopRun(true);
    if (isStarterCode(editor.getValue())) editor.setValue(starterCode());
    resetPlayback();
    renderRobotTab();
  }
}

let draft = null;
function buildSetupGrid() {
  const g = $('setupGrid');
  const portOpts = (none) => 'ABCDEF'.split('').map(p => `<option value="${p}">Port ${p}</option>`).join('') + (none ? '<option value="none">Not used</option>' : '');
  let html = '';
  for (const r of PYB.DEVICE_ROLES) {
    html += `<label>${r.label.replace(/ \(.*/, '')}<select data-k="${r.key}">${portOpts(r.kind !== 'motor')}</select></label>`;
  }
  html += '<label>Mirrored drive motor (needs COUNTERCLOCKWISE)<select data-k="mirrored"><option value="left">Left motor</option><option value="right">Right motor</option></select></label>';
  html += '<label>Positive arm angle moves the arm<select data-k="armUp"><option value="1">Up</option><option value="-1">Down</option></select></label>';
  html += '<label>Wheel diameter (mm)<input data-k="wheel" type="number" min="20" max="150" step="0.1" list="wheelSizes"></label>';
  html += '<label>Axle track (mm, wheel to wheel)<input data-k="track" type="number" min="60" max="250" step="1"></label>';
  html += '<datalist id="wheelSizes"><option value="56"><option value="62.4"><option value="88"></datalist>';
  g.innerHTML = html;
  g.querySelectorAll('[data-k]').forEach(el => {
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
      const k = el.dataset.k;
      draft[k] = el.tagName === 'INPUT' || k === 'armUp' ? Number(el.value) : el.value;
      renderSetupDialog(false);
    });
  });
}
function setupError(s) {
  if (!(s.wheel >= 20 && s.wheel <= 150)) return 'Wheel diameter must be between 20 and 150 mm.';
  if (!(s.track >= 60 && s.track <= 250)) return 'Axle track must be between 60 and 250 mm.';
  return PYB.setupProblem(s);
}
function renderSetupDialog(fillGrid) {
  const def = defaultSetup();
  const opts = presetList();
  const mine = opts.some(o => sameSetup(o.s, draft)) ? readSetup('pyb-setup-custom') : draft;
  const mineOwn = mine && !opts.some(o => sameSetup(o.s, mine));
  opts.push({ id: 'custom', name: 'My robot', desc: mineOwn ? describeSetup(mine) : 'Choose your own ports and wheel size.', s: mineOwn ? mine : null });
  const box = $('setupPresets');
  box.innerHTML = '';
  for (const o of opts) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'preset'; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', o.s && sameSetup(o.s, draft) ? 'true' : 'false');
    b.innerHTML = '<b></b><span></span>' + (o.s && sameSetup(o.s, def) ? '<em class="tag">★ Default</em>' : '');
    b.querySelector('b').textContent = o.name;
    b.querySelector('span').textContent = o.desc;
    b.onclick = () => {
      if (o.s) draft = Object.assign({}, o.s);
      else $('setupMore').open = true;
      renderSetupDialog(true);
    };
    box.appendChild(b);
  }
  if (fillGrid) $('setupGrid').querySelectorAll('[data-k]').forEach(el => { el.value = String(draft[el.dataset.k]); });
  const err = setupError(draft);
  $('setupErr').hidden = !err; $('setupErr').textContent = err;
  $('setupOk').disabled = !!err;
  $('setupCode').textContent = err ? '' : PYB.setupCode(PYB.cleanSetup(draft));
  $('setupDefault').checked = !err && sameSetup(PYB.cleanSetup(draft), def);
}
function openSetup() {
  draft = Object.assign({}, R.setup);
  $('setupMore').open = !presetList().some(o => sameSetup(o.s, draft));
  $('setupAsk').checked = store.get('pyb-setup-ask') !== '0';
  renderSetupDialog(true);
  $('setupDialog').showModal();
}
buildSetupGrid();
$('setupBtn').onclick = openSetup;
$('setupClose').onclick = () => $('setupDialog').close();
$('setupAsk').onchange = (e) => store.set('pyb-setup-ask', e.target.checked ? '1' : '0');
$('setupForm').onsubmit = (e) => {
  e.preventDefault();
  if (setupError(draft)) return;
  const s = PYB.cleanSetup(draft);
  if (!presetList().some(o => sameSetup(o.s, s))) store.set('pyb-setup-custom', JSON.stringify(s));
  if (account.kid) {
    if ($('setupDefault').checked && !sameSetup(defaultSetup(), s)) {
      account.saveSetup(s).then(() => toastMsg('Robot saved to your login')).catch(err => toastMsg('Could not save the robot: ' + err.message));
    }
  } else if ($('setupDefault').checked) store.set('pyb-setup-default', JSON.stringify(s));
  else if (sameSetup(readSetup('pyb-setup-default'), s)) { try { localStorage.removeItem('pyb-setup-default'); } catch (err) { /* ignore */ } }
  $('setupDialog').close();
  applyRobotSetup(s);
};
// ---------- measuring tools ----------
const measure = { tool: null, pts: [], hover: null };
const MEASURE_NEEDS = { distance: 2, angle: 3 };
const r0 = (n) => Math.round(n);
const normDeg = (a) => { a = ((a + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };
function measureNeeds() {
  if (measure.tool === 'angle' && measure.pts[0] && measure.pts[0].robot) return 2;
  return MEASURE_NEEDS[measure.tool] || 0;
}
function measureDone() { return measure.pts.length >= measureNeeds(); }
function setTool(tool) {
  measure.tool = measure.tool === tool ? null : tool;
  measure.pts = []; measure.hover = null;
  document.querySelectorAll('.tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === measure.tool));
  $('view').classList.toggle('measuring', !!measure.tool);
  drawMeasure();
}
function drawMeasure() {
  const box = $('measureBox');
  if (!measure.tool) { box.hidden = true; world.setMeasure(null); return; }
  box.hidden = false;
  const done = measureDone();
  const pts = done || !measure.hover ? measure.pts.slice() : measure.pts.concat([measure.hover]);
  let main = '', info = '', draw = { pts, segs: [] };
  if (measure.tool === 'distance') {
    $('mbTitle').textContent = '📏 Distance';
    if (pts.length >= 2) {
      const [a, b] = pts;
      const dx = b.x - a.x, dy = b.y - a.y, dz = (b.z || 0) - (a.z || 0), flat = Math.hypot(dx, dy);
      main = r0(flat) + ' mm';
      draw.segs = [[0, 1]];
      draw.text = main; draw.at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: Math.max(a.z || 0, b.z || 0) };
      if (a.robot) {
        const yaw = world.pose ? world.pose.yaw : 0;
        const ahead = dx * Math.cos(yaw) + dy * Math.sin(yaw), side = -dx * Math.sin(yaw) + dy * Math.cos(yaw);
        info = `From the robot's wheels: ${r0(Math.abs(ahead))} mm ${ahead >= 0 ? 'ahead' : 'behind'}, ${r0(Math.abs(side))} mm to the ${side >= 0 ? 'left' : 'right'}.`;
      } else {
        info = `Across (x): ${r0(Math.abs(dx))} mm · up the mat (y): ${r0(Math.abs(dy))} mm.`;
      }
      if (Math.abs(dz) > 4) info += ` Height: ${r0(a.z || 0)} → ${r0(b.z || 0)} mm (${dz > 0 ? '+' : '−'}${r0(Math.abs(dz))} mm).`;
    }
    if (!pts.length) info = 'Click the start point. Tip: click the robot to measure from its wheels.';
    else if (!done) info = (pts.length >= 2 ? info + ' ' : '') + 'Click the end point.';
    else info += ' Click again for a new one.';
  } else {
    $('mbTitle').textContent = '📐 Angle';
    const c = pts[0];
    if (c && c.robot) {
      const yaw = world.pose ? world.pose.yaw : 0;
      const far = { x: c.x + Math.cos(yaw) * 350, y: c.y + Math.sin(yaw) * 350, z: 0 };
      draw.dashed = [[c, far]];
      if (pts.length >= 2) {
        const p = pts[1];
        const bearing = Math.atan2(p.y - c.y, p.x - c.x) / DEG;
        const turn = normDeg(yaw / DEG - bearing);   // clockwise positive, like Pybricks
        main = `${r0(Math.abs(turn))}° ${Math.abs(turn) < 0.5 ? '' : turn > 0 ? 'right' : 'left'}`.trim();
        draw.segs = [[0, 1]]; draw.text = main; draw.at = p;
        info = Math.abs(turn) < 0.5 ? 'The robot is already facing this point.'
          : `Turn ${r0(Math.abs(turn))}° ${turn > 0 ? 'clockwise (right) to face it: a positive' : 'counterclockwise (left) to face it: a negative'} turn angle in Pybricks.`;
        info += ` It is ${r0(Math.hypot(p.x - c.x, p.y - c.y))} mm away.`;
      } else info = 'The dashed blue line is the way the robot faces. Click the point you want it to face.';
    } else if (pts.length >= 3) {
      const [a, b, cc] = pts;
      const ab = Math.atan2(b.y - a.y, b.x - a.x) / DEG, ac = Math.atan2(cc.y - a.y, cc.x - a.x) / DEG;
      const turn = normDeg(ab - ac);   // clockwise positive
      main = `${r0(Math.abs(turn))}°`;
      draw.segs = [[0, 1], [0, 2]]; draw.text = main; draw.at = a;
      info = `Going from the first line to the second is a ${turn >= 0 ? 'clockwise (right)' : 'counterclockwise (left)'} turn.`;
    } else if (pts.length === 2) {
      draw.segs = [[0, 1]];
      info = 'Click a point on the second line.';
    } else if (pts.length === 1) info = 'Click a point on the first line.';
    else info = 'Click the corner of the angle. Tip: click the robot to measure from the way it is facing.';
    if (done) info += ' Click again for a new one.';
  }
  $('mbMain').textContent = main;
  $('mbInfo').textContent = info;
  world.setMeasure(pts.length ? draw : null);
}
{
  const cv = world.renderer.domElement;
  let down = null, hoverQueued = false;
  cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointerup', (e) => {
    if (!measure.tool || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const p = world.pick(e.clientX, e.clientY);
    if (!p) return;
    if (measureDone()) measure.pts = [];
    measure.pts.push(p);
    drawMeasure();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!measure.tool || measureDone() || !measure.pts.length || hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => { hoverQueued = false; measure.hover = world.pick(e.clientX, e.clientY); drawMeasure(); });
  });
  cv.addEventListener('pointerleave', () => { if (measure.hover) { measure.hover = null; drawMeasure(); } });
}
document.querySelectorAll('.tools button').forEach(b => (b.onclick = () => setTool(b.dataset.tool)));
$('mbClose').onclick = () => setTool(null);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && measure.tool && !document.querySelector('dialog[open]')) setTool(null); });

// ---------- login ----------
function toastMsg(text) { toast(text, /not saved|could not/i.test(text)); }
function renderUser() {
  $('userBtn').hidden = !account.available;
  $('setupLogin').hidden = !account.available || !!account.user;
  const u = account.user;
  $('userName').textContent = u ? (u.role === 'coach' ? 'Coach' : u.name) : 'Log in';
  $('coachLink').hidden = !(u && u.role === 'coach');
  $('userMenuNote').textContent = !u ? '' : u.role === 'coach'
    ? 'Coach accounts play as a guest here, so nothing is saved. Students\' Robot Lab scores and programs are on the coach dashboard.'
    : 'Logged in as ' + u.username + (u.team ? ' · ' + u.team : '') + '. Your programs, robot and best scores are saved.';
  saveState(account.kid ? '· saved to your login' : '', account.kid ? 'ok' : '');
}
// after logging in or out: switch robot and programs to the right owner
function switchOwner(carryCode) {
  applyRobotSetup(defaultSetup());
  const id = map.id;
  if (account.kid && carryCode && !account.code(id) && !isStarterCode(carryCode)) {
    // keep what the kid typed as a guest
    account.saveCode(id, carryCode).catch(() => {});
  }
  selectMap(id);
  renderUser();
}
function openLogin() {
  $('loginErr').hidden = true;
  $('loginPass').value = '';
  if ($('setupDialog').open) $('setupDialog').close();
  $('loginDialog').showModal();
  $('loginUser').focus();
}
$('userBtn').onclick = (e) => {
  e.stopPropagation();
  if (!account.user) return openLogin();
  $('userMenu').hidden = !$('userMenu').hidden;
};
$('setupLoginBtn').onclick = openLogin;
document.addEventListener('click', () => ($('userMenu').hidden = true));
$('userMenu').onclick = async (e) => {
  if (e.target.dataset.act !== 'logout') return;
  if (saveTimer) await flushCloudSave();
  await account.logout();
  switchOwner(null);
  toastMsg('Logged out. You are playing as a guest.');
};
$('loginClose').onclick = () => $('loginDialog').close();
$('loginGuest').onclick = () => $('loginDialog').close();
$('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  $('loginOk').disabled = true;
  $('loginErr').hidden = true;
  try {
    const guestCode = editor.getValue();
    const u = await account.login($('loginUser').value.trim(), $('loginPass').value);
    $('loginDialog').close();
    switchOwner(guestCode);
    toastMsg(u.role === 'coach' ? 'Logged in as coach (nothing is saved here).' : 'Hi ' + u.name + '! Your work will be saved.');
  } catch (err) {
    $('loginErr').textContent = err.message; $('loginErr').hidden = false;
  } finally {
    $('loginOk').disabled = false;
  }
};
await account.init();
renderUser();
applyRobotSetup(defaultSetup());

const startId = location.hash.slice(1) || store.get('pyb-map') || PYB.MAPS[0].id;
selectMap(PYB.MAPS.some(m => m.id === startId) ? startId : PYB.MAPS[0].id);
requestAnimationFrame(loop);
if (store.get('pyb-setup-ask') !== '0') openSetup();
// debugging hook (also lets tests advance the replay while the tab is hidden)
window.__pyb = { world, play, editor, run, applyRobotSetup, openSetup, account, measure, drawMeasure, setTool, step: (ms) => { lastNow = performance.now() - ms; loop(performance.now(), true); } };
