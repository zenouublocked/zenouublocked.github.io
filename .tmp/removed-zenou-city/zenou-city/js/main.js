/* Zenou City — an open-world crime sandbox that runs entirely in the browser.
 * Original code and procedural art; no external assets, no network requests.
 */
import * as THREE from '../vendor/three.module.js';
import { createWorld, CITY } from './world.js';
import { VehicleManager } from './vehicles.js';
import { Pedestrian, Cop, Effects, createPlayerMesh } from './actors.js';
import { Audio } from './audio.js';

const $ = (s) => document.querySelector(s);
const clamp = THREE.MathUtils.clamp;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

/* ---------- player state ---------- */

const player = {
  pos: new THREE.Vector2(43, 110),
  vy: 0,
  grounded: true,
  heading: 0,
  health: 100,
  armor: 0,
  money: 500,
  wanted: 0,
  heat: 0,
  car: null,
  alive: true,
  speed: 0,
  kills: 0,
  lastStep: 0,
};

const weapons = [
  { name: 'Pistol', mag: 12, magSize: 12, reserve: 72, dmg: 26, rate: 0.24, reloadTime: 1.1, spread: 0.006, auto: false },
  { name: 'SMG', mag: 30, magSize: 30, reserve: 150, dmg: 15, rate: 0.075, reloadTime: 1.9, spread: 0.028, auto: true },
];
let weaponIndex = 0;
let fireCooldown = 0;
let reloading = 0;

/* ---------- renderer ---------- */

const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 1400);

const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x24262e, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 400;
sun.shadow.camera.left = -110;
sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110;
sun.shadow.camera.bottom = -110;
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

const skyDay = new THREE.Color(0x8fc7ff);
const skyDusk = new THREE.Color(0xff8a4a);
const skyNight = new THREE.Color(0x05070f);
scene.background = skyDay.clone();
scene.fog = new THREE.Fog(0x9fc9ef, 110, 620);

/* stars */
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 1100; i++) {
  const v = new THREE.Vector3().setFromSphericalCoords(700, Math.acos(rand(0, 1)), rand(0, Math.PI * 2));
  starPos.push(v.x, Math.abs(v.y) * 0.9 + 40, v.z);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xdfe9ff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0 });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

const world = createWorld(scene);
const vehicles = new VehicleManager(scene, world);
const effects = new Effects(scene);
const audio = new Audio();

/* player model */
const playerModel = createPlayerMesh();
playerModel.group.position.set(player.pos.x, 0.02, player.pos.y);
scene.add(playerModel.group);

/* headlights */
const headlight = new THREE.SpotLight(0xfff2cf, 0, 70, Math.PI / 7, 0.5, 1.4);
headlight.visible = false;
scene.add(headlight, headlight.target);

/* ---------- pedestrians ---------- */

const peds = [];
for (let i = 0; i < 26; i++) {
  const p = world.randomSidewalkPoint();
  peds.push(new Pedestrian(scene, world, p.x, p.z));
}
const cops = [];
let copSpawnTimer = 0;

/* ---------- pickups ---------- */

const pickups = [];
function makePickup(type) {
  const p = world.randomSidewalkPoint();
  const g = new THREE.Group();
  const colors = { cash: 0x3ddc84, health: 0xff4d5e, armor: 0x3d8bff, ammo: 0xffc93d };
  const baseMat = new THREE.MeshStandardMaterial({ color: colors[type], emissive: colors[type], emissiveIntensity: 0.7, roughness: 0.4 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), baseMat);
  box.position.y = 0.9;
  box.castShadow = true;
  g.add(box);
  if (type === 'health' || type === 'armor') {
    const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.16), markMat);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), markMat);
    a.position.y = b.position.y = 0.9;
    g.add(a, b);
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.05, 8, 22),
    new THREE.MeshBasicMaterial({ color: colors[type], transparent: true, opacity: 0.75 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.14;
  g.add(ring);
  g.position.set(p.x, 0, p.z);
  scene.add(g);
  const values = { cash: 220, health: 45, armor: 50, ammo: 36 };
  return { mesh: g, type, value: values[type], taken: false, respawn: 0 };
}
for (let i = 0; i < 16; i++) {
  pickups.push(makePickup(pick(['cash', 'cash', 'health', 'armor', 'ammo'])));
}

/* ---------- mission ---------- */

const mission = {
  active: false,
  stage: 'idle',
  target: new THREE.Vector2(),
  time: 0,
  reward: 0,
  cooldown: 3,
  marker: null,
};
const markerGroup = new THREE.Group();
{
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.24, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc93d, transparent: true, opacity: 0.95 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 22, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc93d, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 11;
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 28),
    new THREE.MeshBasicMaterial({ color: 0xffc93d, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.12;
  markerGroup.add(ring, beam, inner);
  markerGroup.userData.ring = ring;
  scene.add(markerGroup);
  mission.marker = markerGroup;
}

function newMissionPoint(minDist = 120) {
  for (let i = 0; i < 40; i++) {
    const p = world.randomRoadPoint();
    if (Math.hypot(p.x - player.pos.x, p.z - player.pos.y) > minDist) return p;
  }
  return world.randomRoadPoint();
}

function resetMissionMarker() {
  const p = newMissionPoint(70);
  mission.target.set(p.x, p.z);
  mission.stage = 'idle';
  mission.active = false;
  markerGroup.position.set(p.x, 0, p.z);
  markerGroup.visible = true;
  $('#objective').textContent = 'Head to the gold marker · press E to start';
}

function startMission() {
  const p = newMissionPoint(200);
  mission.active = true;
  mission.stage = 'run';
  mission.target.set(p.x, p.z);
  mission.time = 95;
  mission.reward = 900 + Math.floor(rand(0, 12)) * 100;
  markerGroup.position.set(p.x, 0, p.z);
  markerGroup.visible = true;
  audio.pickup();
  toast(`Mission started · deliver the package in ${mission.time | 0}s for $${mission.reward}`);
  $('#objective').textContent = `Delivery: reach the marker · ${mission.time | 0}s · $${mission.reward}`;
}

function finishMission(success) {
  if (success) {
    player.money += mission.reward;
    toast(`Mission complete · +$${mission.reward}`);
    mission.cooldown = 5;
    mission.stage = 'cooldown';
    mission.active = false;
    markerGroup.visible = false;
  } else {
    toast('Mission failed · out of time');
    mission.cooldown = 4;
    mission.stage = 'cooldown';
    mission.active = false;
    markerGroup.visible = false;
  }
}

/* ---------- HUD ---------- */

const ui = {
  health: $('#healthFill'),
  armor: $('#armorFill'),
  money: $('#money'),
  stars: $('#stars'),
  ammo: $('#ammo'),
  weapon: $('#weaponName'),
  speedo: $('#speedo'),
  speedVal: $('#speedVal'),
  toast: $('#toast'),
  crosshair: $('#crosshair'),
  hit: $('#hitmark'),
  objective: $('#objective'),
  missionTimer: $('#missionTimer'),
  vignette: $('#vignette'),
  overlay: $('#overlay'),
  loading: $('#loading'),
};

let toastTimer = 0;
function toast(text, duration = 2.6) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastTimer = duration;
}

function updateStats() {
  ui.money.textContent = `$${player.money.toLocaleString('en-US')}`;
  const n = Math.ceil(player.wanted - 0.001);
  ui.stars.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="star ${i < n ? 'on' : ''}">★</span>`).join('');
  ui.health.style.width = `${clamp(player.health, 0, 100)}%`;
  ui.armor.style.width = `${clamp(player.armor, 0, 100)}%`;
  const w = weapons[weaponIndex];
  ui.ammo.textContent = reloading > 0 && player.car === null ? 'RELOADING' : `${w.mag} / ${w.reserve}`;
  ui.weapon.textContent = w.name;
  ui.vignette.style.opacity = player.health < 45 ? `${(1 - player.health / 45) * 0.85}` : '0';
}

/* ---------- input ---------- */

const keys = new Set();
let running = false;
let paused = false;
let camYaw = 0;
let camPitch = 0.18;
let shake = 0;
let bobPhase = 0;

function isDown(...codes) { return codes.some((c) => keys.has(c)); }

addEventListener('keydown', (e) => {
  if (['Space', 'Tab', 'KeyE', 'KeyF', 'KeyR', 'Digit1', 'Digit2'].includes(e.code) && running && !paused) e.preventDefault();
  keys.add(e.code);
  if (!running || paused) return;
  if (e.code === 'KeyF') { if (player.car) exitCar(); else enterCar(); }
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyR') reload();
  if (e.code === 'Digit1') setWeapon(0);
  if (e.code === 'Digit2') setWeapon(1);
  if (e.code === 'Escape') togglePause(true);
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') audio.setMuted(!audio.muted);
  if (e.code === 'KeyH') $('.help-card').classList.toggle('show');
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

canvas.addEventListener('click', () => {
  if (running && !paused && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
});

let dragging = false;
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0 && document.pointerLockElement !== canvas) dragging = true;
});
addEventListener('mouseup', () => { dragging = false; });

addEventListener('mousemove', (e) => {
  if (!running || paused) return;
  const locked = document.pointerLockElement === canvas;
  if (!locked && !dragging) return;
  const dx = e.movementX || 0;
  const dy = e.movementY || 0;
  camYaw -= dx * 0.0021;
  camPitch = clamp(camPitch + dy * 0.0017, -0.32, 1.05);
});

addEventListener('mousedown', (e) => {
  if (!running || paused) return;
  if (e.button === 0) {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    mouseDown = true;
    if (player.car === null) fire();
  }
  if (e.button === 2 && player.car === null) {
    camera.fov = 48;
    camera.updateProjectionMatrix();
  }
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) {
    camera.fov = 64;
    camera.updateProjectionMatrix();
  }
});
addEventListener('contextmenu', (e) => { if (running) e.preventDefault(); });
let mouseDown = false;

/* touch controls */
const isTouch = matchMedia('(pointer: coarse)').matches;
const touch = { move: { x: 0, y: 0 }, active: false };
if (isTouch) {
  document.body.classList.add('touch');
  const stick = $('#stick');
  const knob = $('#knob');
  let stickId = null;
  const moveStick = (e) => {
    const r = stick.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len);
    touch.move.x = (dx / len) * k;
    touch.move.y = (dy / len) * k;
    knob.style.transform = `translate(${touch.move.x * 34}px, ${touch.move.y * 34}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  const end = () => { stickId = null; touch.move.x = touch.move.y = 0; knob.style.transform = 'translate(0,0)'; };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  $('#btnFire').addEventListener('pointerdown', (e) => { e.preventDefault(); if (player.car === null) fire(); });
  $('#btnUse').addEventListener('pointerdown', (e) => { e.preventDefault(); interact(); });
  $('#btnJump').addEventListener('pointerdown', (e) => { e.preventDefault(); if (player.grounded) { player.vy = 5.6; player.grounded = false; } });
}

/* ---------- weapons ---------- */

function setWeapon(i) {
  if (i === weaponIndex) return;
  weaponIndex = i;
  reloading = 0;
  fireCooldown = 0;
  toast(weapons[i].name);
}

function reload() {
  const w = weapons[weaponIndex];
  if (reloading > 0 || w.mag >= w.magSize || w.reserve <= 0 || player.car) return;
  reloading = w.reloadTime;
}

function fire() {
  const w = weapons[weaponIndex];
  if (!player.alive || fireCooldown > 0 || reloading > 0 || player.car) return;
  if (w.mag <= 0) { reload(); return; }
  w.mag--;
  fireCooldown = w.rate;
  audio.gunshot();
  shake = Math.min(0.09, shake + 0.035);
  camPitch = clamp(camPitch + 0.008 + Math.random() * 0.006, -0.32, 1.05);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.x += rand(-w.spread, w.spread);
  dir.y += rand(-w.spread, w.spread);
  dir.z += rand(-w.spread, w.spread);
  dir.normalize();

  const origin = camera.position.clone();
  const muzzle = new THREE.Vector3(player.pos.x, 1.34, player.pos.y)
    .add(new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading)).multiplyScalar(0.5));
  effects.muzzle(muzzle);

  const hit = traceShot(origin, dir, 300);
  const end = hit ? hit.point : origin.clone().addScaledVector(dir, 220);
  effects.tracer(muzzle, end, 0xffe0a0);

  if (hit) {
    if (hit.actor) {
      const killed = hit.actor.damage(w.dmg, player);
      ui.hit.classList.add('show');
      setTimeout(() => ui.hit.classList.remove('show'), 90);
      effects.sparks(hit.point, 6, 0xff5566);
      audio.impact();
      if (killed) {
        player.kills++;
        if (hit.actor.cop) { addWanted(2); toast('Officer down'); }
        else { addWanted(1); toast('Civilian down'); }
      } else if (hit.actor.cop) addWanted(1);
    } else if (hit.car) {
      const boom = hit.car.damage(w.dmg * 1.2);
      effects.sparks(hit.point, 8, 0xffc96b);
      audio.impact();
      if (boom) {
        effects.explosion(new THREE.Vector3(hit.car.pos.x, 1, hit.car.pos.y));
        audio.boom();
        addWanted(1);
        if (Math.hypot(hit.car.pos.x - player.pos.x, hit.car.pos.y - player.pos.y) < 9) damagePlayer(35);
      }
    } else {
      effects.sparks(hit.point, 7, 0xfff0c0);
      audio.impact();
    }
  }
  updateStats();
}

const raycaster = new THREE.Raycaster();
function traceShot(origin, dir, range) {
  let best = null;
  let bestDist = range;

  raycaster.set(origin, dir);
  raycaster.far = range;
  const bHits = raycaster.intersectObjects(world.buildingMeshes, false);
  if (bHits.length && bHits[0].distance < bestDist) {
    bestDist = bHits[0].distance;
    best = { point: bHits[0].point.clone(), building: true };
  }

  const sphere = new THREE.Vector3();
  for (const a of peds.concat(cops)) {
    if (!a.alive) continue;
    sphere.set(a.pos.x, 1.05, a.pos.y);
    const t = raySphere(origin, dir, sphere, 0.72);
    if (t !== null && t < bestDist) {
      bestDist = t;
      best = { point: origin.clone().addScaledVector(dir, t), actor: a, dist: t };
    }
  }
  for (const c of vehicles.cars) {
    if (!c.alive) continue;
    sphere.set(c.pos.x, 0.9, c.pos.y);
    const t = raySphere(origin, dir, sphere, 1.7);
    if (t !== null && t < bestDist) {
      bestDist = t;
      best = { point: origin.clone().addScaledVector(dir, t), car: c, dist: t };
    }
  }
  return best;
}

function raySphere(origin, dir, center, radius) {
  const ox = origin.x - center.x, oy = origin.y - center.y, oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = -b - sq;
  if (t1 > 0.6) return t1;
  const t2 = -b + sq;
  return t2 > 0.6 ? t2 : null;
}

/* ---------- vehicles for the player ---------- */

function interact() {
  if (!player.alive) return;
  if (player.car) { exitCar(); return; }
  if (mission.stage === 'idle' && Math.hypot(mission.target.x - player.pos.x, mission.target.y - player.pos.y) < 6.5) {
    startMission();
    return;
  }
  if (vehicles.nearestCar(player.pos.x, player.pos.y, 4.6)) enterCar();
}

function enterCar() {
  if (!player.alive) return;
  const car = vehicles.nearestCar(player.pos.x, player.pos.y, 4.6);
  if (!car) { toast('No car nearby'); return; }
  if (car.alive === false) return;
  player.car = car;
  car.occupied = true;
  car.parked = true;
  playerModel.group.visible = false;
  document.body.classList.add('driving');
  camYaw = car.heading + Math.PI;
  toast(`${car.type === 'van' ? 'Van' : car.type === 'coupe' ? 'Coupe' : car.type === 'taxi' ? 'Taxi' : 'Sedan'} acquired`);
  audio.ensureEngine();
}

function exitCar() {
  const car = player.car;
  if (!car) return;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  const p = { x: car.pos.x + side.x * 2.2, z: car.pos.y + side.z * 2.2 };
  world.resolveCircle(p, 0.5);
  player.pos.set(p.x, p.z);
  player.car = null;
  car.occupied = false;
  playerModel.group.visible = true;
  document.body.classList.remove('driving');
  camYaw = car.heading + Math.PI;
  audio.engineSound(0, 0, false);
}

/* ---------- damage / police ---------- */

function addWanted(n) {
  player.wanted = clamp(player.wanted + n, 0, 5);
  player.heat = 9;
  updateStats();
}

function damagePlayer(amount) {
  if (!player.alive) return;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, amount * 0.7);
    player.armor -= absorbed;
    amount -= absorbed;
  }
  player.health -= amount;
  shake = Math.min(0.4, shake + amount * 0.012);
  ui.vignette.style.opacity = '0.8';
  if (player.health <= 0) die();
  updateStats();
}

function die() {
  player.alive = false;
  player.health = 0;
  player.wanted = 0;
  player.heat = 0;
  if (player.car) { player.car.occupied = false; player.car = null; }
  playerModel.group.visible = true;
  document.body.classList.remove('driving');
  document.exitPointerLock?.();
  showOverlay('WASTED', 'You were taken down. Respawning at the hospital…', 2600, () => respawn());
}

function respawn() {
  player.pos.set(-61, -61);
  world.resolveCircle({ x: player.pos.x, z: player.pos.y }, 0.5);
  player.health = 100;
  player.armor = 0;
  player.money = Math.max(0, player.money - 100);
  player.alive = true;
  player.wanted = 0;
  player.heat = 0;
  player.vy = 0;
  playerModel.group.visible = true;
  vehicles.clearPolice();
  for (const c of cops.slice()) removeCop(c);
  camYaw = Math.PI * 0.25;
  updateStats();
}

function removeCop(cop) {
  const i = cops.indexOf(cop);
  if (i >= 0) cops.splice(i, 1);
  cop.dispose();
}

/* ---------- overlay ---------- */

let overlayCallback = null;
function showOverlay(title, sub, ms, cb) {
  const ov = ui.overlay;
  ov.querySelector('h1').textContent = title;
  ov.querySelector('.ov-sub').textContent = sub;
  ov.classList.add('show');
  ov.classList.remove('menu');
  overlayCallback = cb || null;
  if (ms) {
    setTimeout(() => {
      ov.classList.remove('show');
      if (overlayCallback) { const f = overlayCallback; overlayCallback = null; f(); }
    }, ms);
  }
}

function togglePause(force) {
  if (!player.alive) return;
  paused = force ?? !paused;
  if (paused) {
    document.exitPointerLock?.();
    ui.overlay.querySelector('h1').textContent = 'PAUSED';
    ui.overlay.querySelector('.ov-sub').textContent = 'Zenou City';
    ui.overlay.classList.add('show', 'menu');
    ui.overlay.querySelector('.ov-start').textContent = 'Resume';
  } else {
    ui.overlay.classList.remove('show', 'menu');
    canvas.requestPointerLock?.();
  }
}

/* ---------- main loop ---------- */

const clock = new THREE.Clock();
let elapsed = 0;
let timeOfDay = 10.2;
let night = 0;
let minimapTimer = 0;

function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const dpr = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    renderer.setSize(w, h, false);
  }
}

function updatePlayer(dt) {
  const speedWalk = 3.5, speedRun = 7.2;
  let mx = 0, mz = 0;
  if (isDown('KeyW', 'ArrowUp')) mz += 1;
  if (isDown('KeyS', 'ArrowDown')) mz -= 1;
  if (isDown('KeyA', 'ArrowLeft')) mx -= 1;
  if (isDown('KeyD', 'ArrowRight')) mx += 1;
  if (isTouch) { mx += touch.move.x; mz -= touch.move.y; }
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }

  const run = isDown('ShiftLeft', 'ShiftRight');
  const speed = (run ? speedRun : speedWalk) * Math.min(1, Math.hypot(mx, mz));
  const fwd = new THREE.Vector2(-Math.sin(camYaw), -Math.cos(camYaw));
  const right = new THREE.Vector2(Math.cos(camYaw), -Math.sin(camYaw));
  const vx = (fwd.x * mz + right.x * mx) * speed;
  const vz = (fwd.y * mz + right.y * mx) * speed;

  player.pos.x += vx * dt;
  player.pos.y += vz * dt;
  const p = { x: player.pos.x, z: player.pos.y };
  world.resolveCircle(p, 0.45);
  player.pos.set(p.x, p.z);

  if (Math.hypot(vx, vz) > 0.2) {
    player.heading = Math.atan2(vx, vz);
  }
  player.speed = Math.hypot(vx, vz);

  // jumping / gravity
  if (isDown('Space') && player.grounded) {
    player.vy = 5.8;
    player.grounded = false;
  }
  if (!player.grounded) {
    player.vy -= 17 * dt;
    playerModel.group.position.y += player.vy * dt;
    if (playerModel.group.position.y <= 0.02) {
      playerModel.group.position.y = 0.02;
      player.vy = 0;
      player.grounded = true;
    }
  } else {
    playerModel.group.position.y = 0.02;
  }

  playerModel.group.position.x = player.pos.x;
  playerModel.group.position.z = player.pos.y;
  playerModel.group.rotation.y = player.heading;

  // walk cycle
  bobPhase += dt * (4 + player.speed * 1.6);
  const swing = Math.sin(bobPhase) * Math.min(0.85, player.speed * 0.16);
  playerModel.parts.legs[0].rotation.x = swing;
  playerModel.parts.legs[1].rotation.x = -swing;
  playerModel.parts.arms[0].rotation.x = -swing * 0.7;
  playerModel.parts.arms[1].rotation.x = swing * 0.7;
  if (player.speed > 0.5 && elapsed - player.lastStep > (run ? 0.28 : 0.42)) {
    player.lastStep = elapsed;
    audio.footstep();
  }

  // pickups
  for (const item of pickups) {
    if (item.taken) continue;
    if (Math.hypot(item.mesh.position.x - player.pos.x, item.mesh.position.z - player.pos.y) < 2.1) {
      item.taken = true;
      item.mesh.visible = false;
      item.respawn = 22;
      if (item.type === 'cash') { player.money += item.value; toast(`+$${item.value}`); }
      else if (item.type === 'health') { player.health = Math.min(100, player.health + item.value); toast('+Health'); }
      else if (item.type === 'armor') { player.armor = Math.min(100, player.armor + item.value); toast('+Armor'); }
      else { weapons[0].reserve += item.value; weapons[1].reserve += item.value; toast('+Ammo'); }
      audio.pickup();
      updateStats();
    }
  }

  // being run over
  for (const c of vehicles.cars) {
    if (!c.alive || c === player.car) continue;
    const d = Math.hypot(c.pos.x - player.pos.x, c.pos.y - player.pos.y);
    if (d < 2 && Math.abs(c.speed) > 9) {
      damagePlayer(18);
      player.pos.x += (player.pos.x - c.pos.x) * 0.8;
      player.pos.y += (player.pos.y - c.pos.y) * 0.8;
    }
  }

  // mission pickup
  if (mission.stage === 'idle' && Math.hypot(mission.target.x - player.pos.x, mission.target.y - player.pos.y) < 5.5) {
    if (isDown('KeyE')) startMission();
    else $('#objective').textContent = 'Press E to start the mission';
  }
}

function updateCar(dt) {
  const car = player.car;
  if (!car) return;
  if (!car.alive) { exitCar(); return; }
  const throttle = (isDown('KeyW', 'ArrowUp') ? 1 : 0) - (isDown('KeyS', 'ArrowDown') ? 1 : 0);
  const steer = (isDown('KeyD', 'ArrowRight') ? 1 : 0) - (isDown('KeyA', 'ArrowLeft') ? 1 : 0);
  car.applyControls(dt, { throttle, steer, handbrake: isDown('Space') }, world);
  audio.engineSound(car.speed, throttle, true);

  player.pos.set(car.pos.x, car.pos.y);
  player.heading = car.heading;

  if (Math.abs(car.speed) > 3) {
    for (const ped of peds) {
      if (!ped.alive) continue;
      if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.y - car.pos.y) < 3.2 && Math.abs(car.speed) > 8) {
        ped.damage(200, player);
        effects.sparks(new THREE.Vector3(ped.pos.x, 1, ped.pos.y), 8, 0xff5566);
        addWanted(1);
        toast('Civilian down');
      }
    }
  }

  // nearby cops on foot shoot the driver
  if (player.heat <= 0 && player.wanted < 0.5) {
    car.speed *= 1 - 0.4 * dt;
  }
}

function updatePolice(dt) {
  player.heat = Math.max(0, player.heat - dt);
  if (player.heat <= 0 && player.wanted > 0) {
    let near = false;
    for (const c of vehicles.police) {
      if (c.alive && Math.hypot(c.pos.x - player.pos.x, c.pos.y - player.pos.y) < 34) { near = true; break; }
    }
    if (!near) player.wanted = Math.max(0, player.wanted - 0.22 * dt);
  }

  const level = Math.floor(player.wanted + 0.001);
  vehicles.update(dt, { pos: { x: player.pos.x, z: player.pos.y } }, level);

  // police cars stop and deploy an officer
  for (const p of vehicles.police) {
    if (!p.alive || p.deployed) continue;
    const d = Math.hypot(p.pos.x - player.pos.x, p.pos.y - player.pos.y);
    if (d < 22 && Math.abs(p.speed) < 3.5) {
      p.deployed = true;
      if (cops.length < 9) {
        const c = new Cop(scene, world, p.pos.x + rand(-2, 2), p.pos.y + rand(-2, 2));
        cops.push(c);
        p.cop = c;
      }
    }
  }

  // keep a couple of officers around at each wanted level
  copSpawnTimer -= dt;
  const wantCops = Math.min(8, level * 2);
  if (level > 0 && cops.filter((c) => c.alive).length < wantCops && copSpawnTimer <= 0) {
    copSpawnTimer = 3;
    for (let tries = 0; tries < 12; tries++) {
      const p = world.randomSidewalkPoint();
      const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.y);
      if (d > 28 && d < 70) {
        cops.push(new Cop(scene, world, p.x, p.z));
        break;
      }
    }
  }

  const ctx = {
    player: {
      pos: { x: player.pos.x, z: player.pos.y },
      speed: player.speed,
      alive: player.alive,
      inCar: !!player.car,
    },
    effects, audio,
    alarm: player.wanted,
    damagePlayer,
  };
  for (const ped of peds) ped.update(dt, ctx);
  for (const c of cops.slice()) {
    c.update(dt, ctx);
    if (!c.alive) {
      c.deadTimer += dt;
      if (c.deadTimer > 12) removeCop(c);
    }
  }

  // stand down once the heat is gone
  if (level === 0 && player.heat <= 0) {
    for (const p of vehicles.police.slice()) {
      const d = Math.hypot(p.pos.x - player.pos.x, p.pos.y - player.pos.y);
      if (d > 55) vehicles.remove(p);
    }
    for (const c of cops.slice()) {
      const d = Math.hypot(c.pos.x - player.pos.x, c.pos.y - player.pos.y);
      if (!c.alive || d > 55) removeCop(c);
    }
  }

  // siren volume from the nearest cruiser
  let siren = false;
  for (const p of vehicles.police) {
    if (p.alive && Math.hypot(p.pos.x - player.pos.x, p.pos.y - player.pos.y) < 60) { siren = true; break; }
  }
  audio.sirenSound(siren && level > 0);
}

function updateCamera(dt) {
  const inCar = !!player.car;
  let target;
  if (inCar) {
    target = new THREE.Vector3(player.car.pos.x, 1.5, player.car.pos.y);
    const behind = player.car.heading + Math.PI;
    let diff = ((behind - camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    camYaw += diff * Math.min(1, 1.6 * dt);
    camPitch += (0.18 - camPitch) * Math.min(1, 1.2 * dt);
  } else {
    target = new THREE.Vector3(player.pos.x, 1.45, player.pos.y);
  }

  const dist = inCar ? 9.2 : 5.4;
  const off = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(camPitch) * dist,
    Math.sin(camPitch) * dist + 1.1,
    Math.cos(camYaw) * Math.cos(camPitch) * dist
  );
  const desired = target.clone().add(off);

  // keep the camera out of buildings
  const probe = { x: desired.x, z: desired.z };
  const hit = world.resolveCircle(probe, 0.5);
  if (hit) {
    desired.x = probe.x;
    desired.z = probe.z;
    desired.y = Math.max(desired.y, target.y + 1.2);
  }
  if (desired.y < 1.2) desired.y = 1.2;

  camera.position.lerp(desired, Math.min(1, dt * (inCar ? 7 : 11)));
  if (shake > 0) {
    camera.position.x += rand(-shake, shake);
    camera.position.y += rand(-shake, shake);
    camera.position.z += rand(-shake, shake);
    shake = Math.max(0, shake - dt * 0.9);
  }
  camera.lookAt(target);

  // headlights
  if (inCar) {
    const car = player.car;
    const f = car.forward;
    headlight.position.set(car.pos.x + f.x * 1.5, 1.2, car.pos.y + f.y * 1.5);
    headlight.target.position.set(car.pos.x + f.x * 30, 0.2, car.pos.y + f.y * 30);
    headlight.intensity = night * 55;
    headlight.visible = night > 0.08;
  } else {
    headlight.visible = false;
  }

  // sun follows the player so shadows stay crisp
  sun.position.set(player.pos.x + 120, 180, player.pos.y + 70);
  sun.target.position.set(player.pos.x, 0, player.pos.y);
  stars.position.set(camera.position.x, 0, camera.position.z);
}

function updateSky(dt) {
  timeOfDay = (timeOfDay + dt * (24 / 300)) % 24;
  const sunAngle = ((timeOfDay - 6) / 12) * Math.PI;
  const sunHeight = Math.sin(sunAngle);
  night = clamp(-sunHeight * 2.2, 0, 1);

  let sky;
  if (sunHeight > 0.1) sky = skyDusk.clone().lerp(skyDay, clamp((sunHeight - 0.1) / 0.4, 0, 1));
  else sky = skyNight.clone().lerp(skyDusk, clamp((sunHeight + 0.25) / 0.35, 0, 1));
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  scene.fog.near = 70 + (1 - night) * 60;
  scene.fog.far = 320 + (1 - night) * 360;

  sun.intensity = clamp(sunHeight * 2.4, 0.02, 2.4);
  sun.color.setHex(night > 0.5 ? 0x9eb6ff : 0xfff0d0);
  hemi.intensity = 0.22 + clamp(sunHeight, 0, 1) * 0.72;
  hemi.color.copy(night > 0.5 ? new THREE.Color(0x2a3a66) : new THREE.Color(0xcfe4ff));

  stars.material.opacity = night * 0.9;
  stars.visible = night > 0.05;
  world.setNight(night);

  if (scene.userData.beacon) {
    const b = scene.userData.beacon;
    b.material.color.setHex(Math.sin(elapsed * 3) > 0 ? 0xff3355 : 0x551122);
  }
}

function updateMission(dt) {
  if (mission.cooldown > 0) {
    mission.cooldown -= dt;
    if (mission.cooldown <= 0) resetMissionMarker();
  }
  if (mission.active) {
    mission.time -= dt;
    ui.missionTimer.textContent = `${Math.max(0, mission.time) | 0}s`;
    $('#objective').textContent = `Delivery · ${mission.reward ? `$${mission.reward}` : ''} · ${Math.max(0, mission.time) | 0}s`;
    const d = Math.hypot(mission.target.x - player.pos.x, mission.target.y - player.pos.y);
    if (d < 6) finishMission(true);
    else if (mission.time <= 0) finishMission(false);
  } else if (mission.stage === 'idle') {
    ui.missionTimer.textContent = '';
  }

  // marker animation
  markerGroup.rotation.y += dt * 0.8;
  const pulse = 1 + Math.sin(elapsed * 3) * 0.06;
  markerGroup.userData.ring.scale.setScalar(pulse);
  markerGroup.userData.ring.material.opacity = 0.65 + Math.sin(elapsed * 3) * 0.25;

  for (const item of pickups) {
    if (item.taken) {
      item.respawn -= dt;
      if (item.respawn <= 0) {
        const p = world.randomSidewalkPoint();
        item.mesh.position.set(p.x, 0, p.z);
        item.mesh.visible = true;
        item.taken = false;
      }
    } else {
      item.mesh.rotation.y += dt * 1.4;
      item.mesh.position.y = Math.sin(elapsed * 2 + item.mesh.position.x) * 0.12;
    }
  }
}

const minimap = $('#minimap');
const mctx = minimap.getContext('2d');

function drawMinimap() {
  const w = minimap.width, h = minimap.height;
  const cx = w / 2, cy = h / 2;
  const scale = 0.42;
  mctx.clearRect(0, 0, w, h);
  mctx.save();
  mctx.beginPath();
  mctx.arc(cx, cy, w / 2 - 3, 0, Math.PI * 2);
  mctx.clip();
  mctx.fillStyle = 'rgba(9,12,18,.9)';
  mctx.fillRect(0, 0, w, h);

  mctx.translate(cx - player.pos.x * scale, cy - player.pos.y * scale);

  // blocks / parks
  for (const b of world.blocks) {
    mctx.fillStyle = b.park ? '#1f3d2a' : '#191c24';
    mctx.fillRect((b.x - b.size / 2) * scale, (b.z - b.size / 2) * scale, b.size * scale, b.size * scale);
  }
  // buildings
  mctx.fillStyle = '#272d3a';
  for (const b of world.buildings) {
    mctx.fillRect((b.minX) * scale, (b.minZ) * scale, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
  }
  // roads
  mctx.strokeStyle = '#3a4050';
  mctx.lineWidth = CITY.road * scale;
  for (const r of world.roadLines) {
    mctx.beginPath();
    if (r.axis === 'z') {
      mctx.moveTo(r.at * scale, (-CITY.half) * scale);
      mctx.lineTo(r.at * scale, CITY.half * scale);
    } else {
      mctx.moveTo((-CITY.half) * scale, r.at * scale);
      mctx.lineTo(CITY.half * scale, r.at * scale);
    }
    mctx.stroke();
  }

  // cars
  mctx.fillStyle = '#9aa6b8';
  for (const c of vehicles.cars) {
    if (!c.alive) continue;
    mctx.fillRect(c.pos.x * scale - 1, c.pos.y * scale - 1, 2, 2);
  }
  // police
  mctx.fillStyle = '#ff4d5e';
  for (const p of vehicles.police) {
    if (!p.alive) continue;
    mctx.beginPath();
    mctx.arc(p.pos.x * scale, p.pos.y * scale, 2.4, 0, Math.PI * 2);
    mctx.fill();
  }
  // mission
  if (markerGroup.visible) {
    mctx.fillStyle = '#ffc93d';
    mctx.beginPath();
    mctx.arc(mission.target.x * scale, mission.target.y * scale, 3.4, 0, Math.PI * 2);
    mctx.fill();
  }
  mctx.restore();

  // player arrow (north-up)
  mctx.save();
  mctx.translate(cx, cy);
  mctx.rotate(-player.heading + Math.PI);
  mctx.fillStyle = '#6df2c1';
  mctx.beginPath();
  mctx.moveTo(0, -7);
  mctx.lineTo(5, 6);
  mctx.lineTo(0, 3);
  mctx.lineTo(-5, 6);
  mctx.closePath();
  mctx.fill();
  mctx.restore();

  mctx.strokeStyle = 'rgba(120,255,210,.35)';
  mctx.lineWidth = 2;
  mctx.beginPath();
  mctx.arc(cx, cy, w / 2 - 3, 0, Math.PI * 2);
  mctx.stroke();
}

function updateHudExtras(dt) {
  if (player.car) {
    const kmh = Math.abs(player.car.speed) * 3.6;
    ui.speedo.classList.add('show');
    ui.speedVal.textContent = `${kmh | 0}`;
  } else {
    ui.speedo.classList.remove('show');
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) ui.toast.classList.remove('show');
  }
  if (mission.active) ui.missionTimer.classList.add('show');
  else ui.missionTimer.classList.remove('show');
}

function updateWeapons(dt) {
  if (fireCooldown > 0) fireCooldown -= dt;
  const w = weapons[weaponIndex];
  if (reloading > 0) {
    reloading -= dt;
    if (reloading <= 0) {
      const need = w.magSize - w.mag;
      const take = Math.min(need, w.reserve);
      w.mag += take;
      w.reserve -= take;
      toast('Reloaded');
      updateStats();
    }
  }
  if (mouseDown && w.auto && fireCooldown <= 0 && player.car === null && running && !paused) fire();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  if (!running) {
    const t = performance.now() / 1000;
    camera.position.set(
      player.pos.x + Math.cos(t * 0.07) * 52,
      21 + Math.sin(t * 0.11) * 3,
      player.pos.y + Math.sin(t * 0.07) * 52
    );
    camera.lookAt(player.pos.x, 9, player.pos.y);
    updateSky(dt);
    effects.update(dt);
    renderer.render(scene, camera);
    return;
  }
  if (!paused) {
    elapsed += dt;
    if (player.alive) {
      if (player.car) updateCar(dt);
      else updatePlayer(dt);
    }
    updatePolice(dt);
    effects.update(dt);
    updateWeapons(dt);
    updateSky(dt);
    updateMission(dt);
    updateHudExtras(dt);
    updateStats();
    minimapTimer -= dt;
    if (minimapTimer <= 0) { minimapTimer = 0.08; drawMinimap(); }
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

/* ---------- boot ---------- */

function startGame() {
  running = true;
  paused = false;
  audio.init();
  audio.setMuted(audio.muted);
  ui.overlay.classList.remove('show', 'menu');
  resetMissionMarker();
  updateStats();
  canvas.requestPointerLock?.();
  toast('Welcome to Zenou City · W to drive, F to steal a car', 4);
}

$('.ov-start').addEventListener('click', () => {
  if (overlayCallback) {
    const f = overlayCallback;
    overlayCallback = null;
    ui.overlay.classList.remove('show');
    f();
    return;
  }
  if (paused) { togglePause(false); return; }
  if (!player.alive) return;
  if (running) return;
  startGame();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) togglePause(true);
  clock.getDelta();
});
window.addEventListener('resize', () => { resize(); });

camera.position.set(player.pos.x + 10, 8, player.pos.y + 18);
camera.lookAt(player.pos.x, 4, player.pos.y);
ui.loading.classList.add('hide');
resize();
updateStats();
animate();

// expose a tiny debug surface for automated checks
window.__zenou = {
  player, world, vehicles, mission, camera, scene, cops,
  setTime: (h) => { timeOfDay = h; },
  addWanted, startMission, damagePlayer,
};
