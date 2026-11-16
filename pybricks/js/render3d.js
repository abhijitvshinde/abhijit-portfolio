// three.js view of the table and robot.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PYB = window.PYB;
const R = PYB.ROBOT;
const DEG = Math.PI / 180;

function label(text, opts = {}) {
  const c = document.createElement('canvas');
  const fs = 44;
  const ctx = c.getContext('2d');
  ctx.font = `600 ${fs}px system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  c.width = w; c.height = fs + 22;
  ctx.font = `600 ${fs}px system-ui, sans-serif`;
  ctx.fillStyle = opts.bg || 'rgba(20,24,32,0.82)';
  const r = 14;
  ctx.beginPath(); ctx.roundRect(0, 0, w, c.height, r); ctx.fill();
  ctx.fillStyle = opts.fg || '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 14, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const h = opts.size || 34;
  sp.scale.set(h * w / c.height, h, 1);
  sp.renderOrder = 10;
  return sp;
}

export class World {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dfe6ee');
    this.camera = new THREE.PerspectiveCamera(42, 1, 10, 30000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.camMode = 'orbit';

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a8f99', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(-700, 2200, 900);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -1500, right: 1500, top: 1000, bottom: -1000, near: 100, far: 5000 });
    this.scene.add(sun);
    this.sun = sun;

    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
    this.buildRobot();
    this.buildTrail();

    this.flashes = new Map();
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(container);
    this.resize();
  }

  // sim (x, y, z) -> three vector
  v(x, y, z = 0) { return new THREE.Vector3(x - this.W / 2, z, -(y - this.H / 2)); }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- map ----------
  loadMap(map) {
    this.map = map;
    this.W = map.size[0]; this.H = map.size[1];
    for (const ch of [...this.mapGroup.children]) { this.mapGroup.remove(ch); ch.traverse?.(o => { o.geometry?.dispose?.(); }); }
    this.obsMeshes = {}; this.targetMeshes = {}; this.zoneMeshes = {};
    const g = this.mapGroup;

    // floor under the table
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshStandardMaterial({ color: '#c9d2dc', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -40; floor.receiveShadow = true;
    g.add(floor);
    // table body
    const T = PYB.BORDER.thickness, BH = PYB.BORDER.height;
    const body = new THREE.Mesh(new THREE.BoxGeometry(this.W + 2 * T, 40, this.H + 2 * T), new THREE.MeshStandardMaterial({ color: '#8c6a48' }));
    body.position.set(0, -20.5, 0); g.add(body);

    // mat
    const tex = new THREE.CanvasTexture(this.drawMat(map));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(this.W, this.H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    mat.rotation.x = -Math.PI / 2; mat.receiveShadow = true;
    g.add(mat);

    // border walls
    const wood = new THREE.MeshStandardMaterial({ color: '#b9875a', roughness: 0.8 });
    const walls = [
      [this.W / 2, -T / 2, this.W + 2 * T, T], [this.W / 2, this.H + T / 2, this.W + 2 * T, T],
      [-T / 2, this.H / 2, T, this.H], [this.W + T / 2, this.H / 2, T, this.H]
    ];
    for (const [x, y, w, d] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, BH, d), wood);
      m.position.copy(this.v(x, y, BH / 2)); m.castShadow = true; m.receiveShadow = true; g.add(m);
    }

    // obstacles
    for (const o0 of map.obstacles || []) {
      const o = PybSimGeomPrep(o0);
      const h = o.z1 - o.z0;
      const geom = o.kind === 'cyl' ? new THREE.CylinderGeometry(o.r, o.r, h, 32) : new THREE.BoxGeometry(o.w, h, o.d);
      const mat = new THREE.MeshStandardMaterial({ color: o.color || '#888', roughness: 0.7, emissive: '#000000' });
      const m = new THREE.Mesh(geom, mat);
      m.position.copy(this.v(o.x, o.y, (o.z0 + o.z1) / 2));
      m.rotation.y = (o.rot || 0) * DEG;
      m.castShadow = true; m.receiveShadow = true;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 30), new THREE.LineBasicMaterial({ color: '#000', transparent: true, opacity: 0.25 }));
      m.add(edges);
      if (o.overhang) {
        // hazard stripes texture on overhangs
        mat.map = stripeTexture(o.color || '#d64541');
        mat.color.set('#ffffff');
        const lb = label(o.label || o.id, { size: 26, bg: 'rgba(160,40,30,0.85)' });
        lb.position.copy(this.v(o.x, o.y, o.z1 + 30));
        g.add(lb);
      }
      g.add(m);
      this.obsMeshes[o.id] = m;
    }

    // targets
    for (const tg of map.targets || []) {
      const grp = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 10, 28),
        new THREE.MeshStandardMaterial({ color: '#ffcf33', emissive: '#ffb300', emissiveIntensity: 0.6 }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(tg.r || 25, 2.2, 8, 40),
        new THREE.MeshBasicMaterial({ color: '#ffb300', transparent: true, opacity: 0.7 }));
      if (tg.face === 'up') {
        disc.position.y = -2;
        ring.rotation.x = Math.PI / 2;
      } else {
        // disc axis points along the face normal (horizontal)
        disc.rotation.z = Math.PI / 2;
        grp.rotation.y = (tg.face || 0) * DEG;
        ring.rotation.y = Math.PI / 2;
      }
      grp.add(disc); grp.add(ring);
      grp.position.copy(this.v(tg.x, tg.y, tg.z));
      g.add(grp);
      const lb = label(tg.label || tg.id, { size: 28, bg: 'rgba(120,84,0,0.85)' });
      lb.position.copy(this.v(tg.x, tg.y, tg.z + 55));
      g.add(lb);
      this.targetMeshes[tg.id] = { grp, disc, ring };
    }

    // glow boxes for zone missions
    for (const m of map.missions || []) {
      if (!m.rect) continue;
      const [x0, y0, x1, y1] = m.rect;
      const box = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 6, y1 - y0),
        new THREE.MeshBasicMaterial({ color: '#39d98a', transparent: true, opacity: 0 }));
      box.position.copy(this.v((x0 + x1) / 2, (y0 + y1) / 2, 3));
      g.add(box);
      this.zoneMeshes[m.id] = box;
    }

    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.sun.target);
    this.resetRobot();
    this.setCamera(this.camMode, true);
  }

  drawMat(map) {
    const s = 0.75; // px per mm
    const c = document.createElement('canvas');
    c.width = Math.round(this.W * s); c.height = Math.round(this.H * s);
    const ctx = c.getContext('2d');
    const X = x => x * s, Y = y => (this.H - y) * s;
    ctx.fillStyle = PYB.MAT_COLORS.white.rgb; ctx.fillRect(0, 0, c.width, c.height);
    // 100 mm grid
    ctx.strokeStyle = 'rgba(40,60,90,0.10)'; ctx.lineWidth = 1;
    for (let x = 100; x < this.W; x += 100) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), c.height); ctx.stroke(); }
    for (let y = 100; y < this.H; y += 100) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(c.width, Y(y)); ctx.stroke(); }
    ctx.fillStyle = 'rgba(40,60,90,0.45)'; ctx.font = '600 13px system-ui, sans-serif';
    for (let x = 200; x < this.W; x += 200) ctx.fillText(String(x), X(x) + 3, c.height - 5);
    for (let y = 200; y < this.H; y += 200) ctx.fillText(String(y), 4, Y(y) - 3);
    for (const p of map.paint || []) {
      const col = (PYB.MAT_COLORS[p.color] || PYB.MAT_COLORS.white).rgb;
      ctx.fillStyle = col; ctx.strokeStyle = col;
      if (p.shape === 'rect') ctx.fillRect(X(p.x0), Y(p.y1), (p.x1 - p.x0) * s, (p.y1 - p.y0) * s);
      else if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.r * s, 0, Math.PI * 2); ctx.fill(); }
      else if (p.shape === 'line') {
        ctx.lineWidth = (p.width || 20) * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); p.pts.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke();
      }
      if (p.label && p.shape === 'rect') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `800 ${Math.round(34 * s)}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.label, X((p.x0 + p.x1) / 2), Y(p.y0) - 26 * s);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      }
    }
    return c;
  }

  // ---------- robot ----------
  buildRobot() {
    const robot = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: '#f3f1ea', roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.6 });
    const teal = new THREE.MeshStandardMaterial({ color: '#29a3a3', roughness: 0.5 });
    const add = (geom, mat, x, y, z) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z); m.castShadow = true; robot.add(m); return m; };

    // chassis frame (three: +x forward, +y up, -z = robot left)
    add(new THREE.BoxGeometry(150, 46, 92), teal, 5, 40, 0);
    add(new THREE.BoxGeometry(40, 30, 130), white, -50, 40, 0);
    // hub
    const hub = add(new THREE.BoxGeometry(92, 30, 60), new THREE.MeshStandardMaterial({ color: '#ffd84a', roughness: 0.5 }), -5, 78, 0);
    // display texture on hub top
    this.dispCanvas = document.createElement('canvas');
    this.dispCanvas.width = 64; this.dispCanvas.height = 64;
    this.dispTex = new THREE.CanvasTexture(this.dispCanvas);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: this.dispTex }));
    disp.rotation.x = -Math.PI / 2; disp.rotation.z = -Math.PI / 2;
    disp.position.set(5, 93.6, 0); robot.add(disp);
    this.hubLight = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 3, 16), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    this.hubLight.position.set(-34, 94.5, 0); robot.add(this.hubLight);
    void hub;

    // wheels
    this.wheels = [];
    for (const side of [-1, 1]) {
      const wg = new THREE.Group();
      const wr = R.wheelDiameter / 2;
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 14, 32), dark);
      tyre.rotation.x = Math.PI / 2; tyre.castShadow = true;
      const rim = new THREE.Mesh(new THREE.BoxGeometry(wr * 1.4, 8, 15), white);
      wg.add(tyre); wg.add(rim);
      wg.position.set(0, wr, side * R.axleTrack / 2);
      robot.add(wg);
      this.wheels.push(wg);
    }
    // caster
    add(new THREE.SphereGeometry(11, 16, 12), new THREE.MeshStandardMaterial({ color: '#c0c4cc', metalness: 0.6, roughness: 0.3 }), -60, 11, 0);
    // colour sensor
    add(new THREE.BoxGeometry(24, 24, 24), dark, R.colorSensorX, 26, 0);
    const csl = new THREE.Mesh(new THREE.CircleGeometry(6, 16), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    csl.rotation.x = Math.PI / 2; csl.position.set(R.colorSensorX, 13.5, 0); robot.add(csl);
    // ultrasonic "eyes"
    add(new THREE.BoxGeometry(14, 30, 64), white, R.ultraX - 10, R.ultraZ, 0);
    for (const z of [-16, 16]) {
      const eye = add(new THREE.CylinderGeometry(10, 10, 8, 20), dark, R.ultraX - 2, R.ultraZ, z);
      eye.rotation.z = Math.PI / 2;
    }
    // arm motor
    add(new THREE.BoxGeometry(46, 46, 40), white, R.pivotX - 8, R.pivotZ - 10, 0);
    // arm
    const arm = new THREE.Group();
    arm.position.set(R.pivotX, R.pivotZ, 0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(R.armLength, 12, R.armHalfWidth * 2), new THREE.MeshStandardMaterial({ color: '#e5483b', roughness: 0.5 }));
    beam.position.x = R.armLength / 2; beam.castShadow = true;
    arm.add(beam);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(14, 18, 26), new THREE.MeshStandardMaterial({ color: '#2b2f36' }));
    tip.position.x = R.armLength - 4; tip.castShadow = true;
    arm.add(tip);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 52, 16), new THREE.MeshStandardMaterial({ color: '#8b9099' }));
    axle.rotation.x = Math.PI / 2; arm.add(axle);
    robot.add(arm);
    this.arm = arm;

    // heading arrow on the floor
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(14, 40, 3), new THREE.MeshBasicMaterial({ color: '#1f6feb', transparent: true, opacity: 0.6 }));
    arrow.rotation.z = -Math.PI / 2; arrow.position.set(R.bodyFront + 120, 2, 0);
    arrow.scale.set(1, 1, 0.1);
    void arrow;

    this.robot = robot;
    this.scene.add(robot);
    this.setDisplay(null);
  }

  buildTrail() {
    const max = 6000;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    geom.setDrawRange(0, 0);
    this.trail = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#1f6feb', transparent: true, opacity: 0.75 }));
    this.trailN = 0; this.trailMax = max;
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);
  }
  clearTrail() { this.trailN = 0; this.trail.geometry.setDrawRange(0, 0); }
  addTrail(x, y) {
    if (this.trailN >= this.trailMax) return;
    const p = this.v(x, y, 2);
    if (this.trailN > 0) {
      const a = this.trail.geometry.attributes.position.array, i = (this.trailN - 1) * 3;
      if (Math.hypot(a[i] - p.x, a[i + 2] - p.z) < 6) return;
    }
    this.trail.geometry.attributes.position.setXYZ(this.trailN++, p.x, p.y, p.z);
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, this.trailN);
  }

  resetRobot() {
    const st = this.map.start;
    this.setRobot({ x: st.x, y: st.y, yaw: (st.yaw || 0) * DEG, arm: R.armStart, wl: 0, wr: 0 });
    this.clearTrail();
    for (const id in this.targetMeshes) this.setTargetDone(id, false);
    for (const id in this.zoneMeshes) this.zoneMeshes[id].material.opacity = 0;
    this.setHubLight([0, 0, 100]);
    this.setDisplay(null);
  }

  // rebuild the robot model after the robot setup (wheel size, axle track) changed
  rebuildRobot() {
    if (this.robot) {
      this.scene.remove(this.robot);
      this.robot.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    this.buildRobot();
    if (this.pose) this.setRobot(this.pose);
  }

  setRobot(s) {
    this.pose = s;
    this.robot.position.copy(this.v(s.x, s.y, 0));
    this.robot.rotation.y = s.yaw;
    this.arm.rotation.z = s.arm * DEG;
    // wheel spin: left motor is mirrored
    const k = 1; // degrees of motor shaft = degrees of wheel
    this.wheels[0].rotation.z = (s.wl * k) * DEG;     // left wheel (three -z side)
    this.wheels[1].rotation.z = -(s.wr * k) * DEG;
  }

  setTargetDone(id, done) {
    const t = this.targetMeshes[id];
    if (!t) return;
    t.disc.material.color.set(done ? '#39d98a' : '#ffcf33');
    t.disc.material.emissive.set(done ? '#1fae6a' : '#ffb300');
    t.ring.material.color.set(done ? '#39d98a' : '#ffb300');
  }
  setZoneDone(id) { const z = this.zoneMeshes[id]; if (z) z.material.opacity = 0.35; }
  flash(id) {
    const m = this.obsMeshes[id];
    if (!m) return;
    this.flashes.set(id, performance.now());
    m.material.emissive.set('#ff2020');
  }
  setHubLight(hsv) {
    const c = this.hubLight.material.color;
    if (!hsv) c.set('#333'); else c.setHSL(hsv[0] / 360, hsv[1] / 100, 0.15 + 0.6 * hsv[2] / 100 * (1 - hsv[1] / 250));
  }
  setDisplay(px) {
    const ctx = this.dispCanvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const b = px ? px[r][c] / 100 : 0;
      ctx.fillStyle = b > 0 ? `rgba(255,255,255,${0.25 + 0.75 * b})` : '#2a2a2a';
      ctx.fillRect(4 + c * 12, 4 + r * 12, 9, 9);
    }
    this.dispTex.needsUpdate = true;
  }

  // ---------- camera ----------
  setCamera(mode, snap) {
    this.camMode = mode;
    this.controls.enabled = mode === 'orbit' || mode === 'top';
    if (mode === 'orbit' && snap) {
      this.camera.position.set(-150, 1250, 1350);
      this.controls.target.set(-150, 0, 100);
    } else if (mode === 'top') {
      this.camera.position.set(0, Math.max(this.W, this.H) * 1.12, 1);
      this.controls.target.set(0, 0, 0);
    }
    this.controls.update();
  }

  render() {
    const now = performance.now();
    for (const [id, t0] of this.flashes) {
      const m = this.obsMeshes[id];
      if (!m) { this.flashes.delete(id); continue; }
      const k = 1 - (now - t0) / 500;
      if (k <= 0) { m.material.emissive.set('#000'); this.flashes.delete(id); }
      else m.material.emissive.setRGB(k * 0.9, 0, 0);
    }
    if (this.pose && (this.camMode === 'follow' || this.camMode === 'side')) {
      const s = this.pose;
      const fx = Math.cos(s.yaw), fy = Math.sin(s.yaw);
      let cam, look;
      if (this.camMode === 'follow') {
        cam = this.v(s.x - fx * 520, s.y - fy * 520, 380);
        look = this.v(s.x + fx * 160, s.y + fy * 160, 90);
      } else {
        // looking at the robot's left side so arm heights are easy to judge
        cam = this.v(s.x - fy * 620 + fx * 60, s.y + fx * 620 + fy * 60, 150);
        look = this.v(s.x + fx * 110, s.y + fy * 110, 120);
      }
      this.camera.position.lerp(cam, 0.15);
      this.controls.target.lerp(look, 0.2);
      this.camera.lookAt(this.controls.target);
    } else {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);
  }
}

function PybSimGeomPrep(o) {
  const q = Object.assign({ kind: 'box', z0: 0, rot: 0 }, o);
  if (q.h !== undefined && q.z1 === undefined) q.z1 = q.z0 + q.h;
  return q;
}

function stripeTexture(color) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = -64; i < 128; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 16, 0); ctx.lineTo(i + 16 - 64, 64); ctx.lineTo(i - 64, 64); ctx.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
