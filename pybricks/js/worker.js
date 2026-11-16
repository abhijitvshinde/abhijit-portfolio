// Web worker: runs Python (Pyodide) + the robot simulator, streams frames to the page.
/* global importScripts, loadPyodide, PybSim, PYB */
'use strict';

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
importScripts(PYODIDE_URL + 'pyodide.js');
importScripts('shared.js', 'sim.js', 'maps/index.js');

const PY_FILES = [
  'pybricks/__init__.py', 'pybricks/_sim.py', 'pybricks/tools.py', 'pybricks/parameters.py',
  'pybricks/pupdevices.py', 'pybricks/robotics.py', 'pybricks/hubs.py', 'pybricks/geometry.py',
  'pybricks/iodevices.py', '_pyb_runner.py', 'umath.py', 'urandom.py', 'ustruct.py', 'uerrno.py',
  'usys.py', 'ujson.py', 'utime.py', 'micropython.py'
];

let pyodide = null;
const ready = (async () => {
  postMessage({ type: 'status', text: 'Loading Python…' });
  pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
  postMessage({ type: 'status', text: 'Loading Pybricks…' });
  const v = (self.PYB_VERSION || Date.now());
  const texts = await Promise.all(PY_FILES.map(f => fetch('../python/' + f + '?v=' + v).then(r => {
    if (!r.ok) throw new Error('Could not load ' + f);
    return r.text();
  })));
  pyodide.FS.mkdirTree('/pyb/pybricks');
  PY_FILES.forEach((f, i) => pyodide.FS.writeFile('/pyb/' + f, texts[i]));
  pyodide.runPython('import sys\nsys.path.insert(0, "/pyb")\nimport _pyb_runner');
  postMessage({ type: 'ready' });
})().catch(err => postMessage({ type: 'fatal', text: String(err && err.message || err) }));

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type !== 'run') return;
  await ready;
  if (!pyodide) return;
  const map = PYB.MAPS.find(m => m.id === msg.mapId);
  PYB.applySetup(msg.setup);
  const sim = new PybSim(map, { post: (m) => postMessage(m) });
  self.SIM = sim;
  let res;
  try {
    pyodide.globals.set('USER_CODE', msg.code);
    res = JSON.parse(pyodide.runPython('_pyb_runner.run(USER_CODE)'));
  } catch (err) {
    res = { ok: false, error: String(err && err.message || err) };
  }
  if (res.timeup || sim.timeUp) sim.emitPrint("⏱ Time's up! The match is " + (map.timeLimit || 150) + ' s long.\n', 'warn');
  if (!res.ok) sim.events.push({ t: sim.t, type: 'error', text: res.error, line: res.line || null });
  sim.finish(res.timeup ? 'timeup' : (res.ok ? 'done' : 'error'));
  postMessage({ type: 'done', ok: res.ok });
};
