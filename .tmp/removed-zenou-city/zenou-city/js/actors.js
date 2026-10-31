/* Zenou City — pedestrians, police on foot, and visual effects. */
import * as THREE from '../vendor/three.module.js';

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[(Math.random() * a.length) | 0]; }

const SHIRTS = [0xd94f4f, 0x4f7fd9, 0x4fd97f, 0xd9c04f, 0x9a4fd9, 0xd97f4f, 0xcfd4dd, 0x2f3a4a, 0xe0e4ec, 0x2e6f5e];
const PANTS = [0x2a3240, 0x3a3f4a, 0x4a4034, 0x1e2530, 0x5a5f68];
const SKIN = [0xf0c9a4, 0xd9a778, 0xa9744a, 0x7a4f31, 0xf4d7bd];

function limb(w, h, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  );
  m.castShadow = true;
  return m;
}

function buildHumanoid({ shirt, pants, skin, cop = false }) {
  const g = new THREE.Group();
  const torso = limb(0.62, 0.78, 0.34, cop ? 0x1b2436 : shirt);
  torso.position.y = 1.24;
  g.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 12, 10),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 })
  );
  head.position.y = 1.82;
  head.castShadow = true;
  g.add(head);
  if (cop) {
    const cap = limb(0.44, 0.14, 0.44, 0x0e1422);
    cap.position.y = 1.98;
    g.add(cap);
    const brim = limb(0.42, 0.05, 0.2, 0x0e1422);
    brim.position.set(0, 1.94, 0.22);
    g.add(brim);
    const badge = limb(0.12, 0.12, 0.04, 0xd8c26a);
    badge.position.set(0.15, 1.45, 0.18);
    g.add(badge);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = limb(0.17, 0.62, 0.19, cop ? 0x1b2436 : shirt);
    arm.position.set(s * 0.4, 1.34, 0);
    arm.geometry.translate(0, -0.28, 0);
    arm.position.y = 1.52;
    g.add(arm);
    arms.push(arm);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = limb(0.22, 0.74, 0.24, cop ? 0x111a2b : pants);
    leg.geometry.translate(0, -0.37, 0);
    leg.position.set(s * 0.16, 0.88, 0);
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, arms, legs, head, torso };
}

class Actor {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.cop = !!opts.cop;
    const parts = buildHumanoid({
      shirt: pick(SHIRTS),
      pants: pick(PANTS),
      skin: pick(SKIN),
      cop: this.cop,
    });
    this.parts = parts;
    this.mesh = parts.group;
    this.mesh.position.set(opts.x || 0, 0.22, opts.z || 0);
    scene.add(this.mesh);
    this.pos = new THREE.Vector2(opts.x || 0, opts.z || 0);
    this.heading = rand(-Math.PI, Math.PI);
    this.speed = 0;
    this.walk = Math.random() * 10;
    this.health = this.cop ? 90 : 55;
    this.alive = true;
    this.state = 'wander';
    this.timer = rand(0, 3);
    this.target = null;
    this.radius = 0.42;
    this.fleeFrom = null;
    this.fireCooldown = rand(0.4, 1.4);
    this.muzzle = 0;
    this.deadTimer = 0;
  }

  get position3() {
    return new THREE.Vector3(this.pos.x, 1.1, this.pos.y);
  }

  setState(state) {
    if (this.state !== state) {
      this.state = state;
      this.timer = 0;
    }
  }

  damage(amount, from) {
    if (!this.alive) return false;
    this.health -= amount;
    this.hitFlash = 0.16;
    if (from) this.fleeFrom = from;
    if (this.health <= 0) {
      this.alive = false;
      this.state = 'dead';
      this.deadTimer = 0;
      this.mesh.rotation.z = Math.PI / 2;
      this.mesh.position.y = 0.42;
      return true;
    }
    this.setState(this.cop ? 'attack' : 'flee');
    return false;
  }

  moveTo(dt, tx, tz, speed, world) {
    const dx = tx - this.pos.x, dz = tz - this.pos.y;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) return d;
    const step = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * step;
    this.pos.y += (dz / d) * step;
    const want = Math.atan2(dx, dz);
    let diff = ((want - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.heading += diff * Math.min(1, 9 * dt);
    const p = { x: this.pos.x, z: this.pos.y };
    world.resolveCircle(p, this.radius);
    this.pos.set(p.x, p.z);
    this.speed = speed;
    return d;
  }

  animate(dt) {
    this.walk += dt * (2 + this.speed * 1.5);
    const swing = Math.sin(this.walk) * Math.min(0.9, this.speed * 0.32);
    if (this.parts) {
      this.parts.legs[0].rotation.x = swing;
      this.parts.legs[1].rotation.x = -swing;
      if (this.cop && this.state === 'attack') {
        this.parts.arms[0].rotation.x = -1.45;
        this.parts.arms[1].rotation.x = -1.2;
      } else {
        this.parts.arms[0].rotation.x = -swing * 0.8;
        this.parts.arms[1].rotation.x = swing * 0.8;
      }
    }
    this.mesh.position.set(this.pos.x, this.state === 'dead' ? 0.42 : 0.22, this.pos.y);
    this.mesh.rotation.y = this.heading;
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      this.parts.torso.material.emissive = new THREE.Color(0x661111);
      this.parts.torso.material.emissiveIntensity = 1.4;
    } else if (this.parts.torso.material.emissiveIntensity) {
      this.parts.torso.material.emissiveIntensity = 0;
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}

export function createPlayerMesh() {
  const parts = buildHumanoid({ shirt: 0x2f3a4a, pants: 0x1b2028, skin: 0xe8bd97 });
  parts.group.scale.setScalar(1.02);
  return { group: parts.group, parts };
}

export class Pedestrian extends Actor {
  constructor(scene, world, x, z) {
    super(scene, { x, z });
    this.world = world;
    this.speed = rand(1.1, 1.7);
    this.target = world.randomSidewalkPoint();
    this.panic = 0;
  }

  update(dt, ctx) {
    if (!this.alive) { this.animate(dt); return; }
    this.timer += dt;

    const playerDist = ctx.player ? Math.hypot(ctx.player.pos.x - this.pos.x, ctx.player.pos.z - this.pos.y) : 99;
    if (ctx.player) {
      const fast = ctx.player.inCar ? 20 : 7;
      if (playerDist < (ctx.player.inCar ? 12 : 6) || this.panic > 0 || ctx.alarm > 0 && playerDist < 40) {
        if (playerDist < 30) this.setState('flee');
      }
    }
    if (this.panic > 0) this.panic -= dt;

    if (this.state === 'flee') {
      const from = ctx.player ? ctx.player.pos : { x: this.pos.x + 1, z: this.pos.y };
      const dx = this.pos.x - from.x, dz = this.pos.y - from.z;
      const d = Math.hypot(dx, dz) || 1;
      this.moveTo(dt, this.pos.x + (dx / d) * 6, this.pos.y + (dz / d) * 6, 4.6, this.world);
      if (this.timer > 4) { this.setState('wander'); this.target = this.world.randomSidewalkPoint(); }
    } else {
      if (!this.target || Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.y) < 1.2 || this.timer > 14) {
        this.target = this.world.randomSidewalkPoint();
        this.timer = 0;
      }
      if (this.target) this.moveTo(dt, this.target.x, this.target.z, this.speed, this.world);
    }
    this.animate(dt);
  }
}

export class Cop extends Actor {
  constructor(scene, world, x, z) {
    super(scene, { x, z, cop: true });
    this.world = world;
    this.speed = 4.2;
    this.fireCooldown = rand(0.8, 1.8);
    this.burst = 0;
  }

  update(dt, ctx) {
    if (!this.alive) { this.animate(dt); return; }
    const player = ctx.player;
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.y;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let diff = ((want - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.heading += diff * Math.min(1, 7 * dt);

    if (dist > 11) {
      this.moveTo(dt, player.pos.x, player.pos.z, 4.4, this.world);
      this.setState('chase');
    } else {
      this.speed = 0;
      this.setState('attack');
      if (Math.random() < 0.4 * dt) {
        // strafe a little so they don't stack up
        const sx = Math.cos(want) * (Math.random() < 0.5 ? 1 : -1);
        const sz = -Math.sin(want) * (Math.random() < 0.5 ? 1 : -1);
        const p = { x: this.pos.x + sx * 1.6 * dt, z: this.pos.y + sz * 1.6 * dt };
        this.world.resolveCircle(p, this.radius);
        this.pos.set(p.x, p.z);
      }
    }

    this.fireCooldown -= dt;
    if (dist < 42 && this.fireCooldown <= 0 && ctx.player.alive) {
      this.fireCooldown = rand(0.9, 1.7);
      this.burst = 2;
      this.shoot(ctx);
    }
    this.animate(dt);
  }

  shoot(ctx) {
    const spread = rand(-0.07, 0.07);
    const hitChance = THREE.MathUtils.clamp(0.72 - ctx.player.speed * 0.02, 0.25, 0.7);
    const from = new THREE.Vector3(this.pos.x, 1.5, this.pos.y);
    const dir = new THREE.Vector3(
      ctx.player.pos.x - this.pos.x,
      1 - 1.4,
      ctx.player.pos.y - this.pos.y
    ).normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
    const to = from.clone().addScaledVector(dir, 45);
    ctx.effects.tracer(from, to, 0xffd7a0);
    ctx.audio.gunshot(0.5, true);
    if (Math.random() < hitChance) ctx.damagePlayer(rand(6, 13), this);
  }
}

/* ---------- effects ---------- */

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.sparkGeo = new THREE.SphereGeometry(0.06, 5, 4);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    this.flashGeo = new THREE.SphereGeometry(0.22, 8, 6);
  }

  tracer(from, to, color = 0xffe3a0) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.items.push({ obj: line, life: 0.09, max: 0.09, type: 'fade' });
  }

  muzzle(position) {
    const m = new THREE.Mesh(this.flashGeo, new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true }));
    m.position.copy(position);
    this.scene.add(m);
    this.items.push({ obj: m, life: 0.06, max: 0.06, type: 'fade' });
  }

  sparks(position, count = 8, color = 0xffd166) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.sparkGeo, new THREE.MeshBasicMaterial({ color }));
      m.position.copy(position);
      const vel = new THREE.Vector3(rand(-4, 4), rand(1, 5), rand(-4, 4));
      this.scene.add(m);
      this.items.push({ obj: m, life: rand(0.2, 0.5), max: 0.5, type: 'spark', vel });
    }
  }

  explosion(position) {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.95 })
    );
    core.position.copy(position);
    this.scene.add(core);
    this.items.push({ obj: core, life: 0.55, max: 0.55, type: 'boom' });

    const light = new THREE.PointLight(0xffa64d, 40, 40, 2);
    light.position.copy(position).setY(position.y + 2);
    this.scene.add(light);
    this.items.push({ obj: light, life: 0.4, max: 0.4, type: 'light' });

    this.sparks(position, 22, 0xffa64d);
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const t = Math.max(0, it.life / it.max);
      if (it.type === 'fade') {
        it.obj.material.opacity = t;
      } else if (it.type === 'spark') {
        it.obj.position.addScaledVector(it.vel, dt);
        it.vel.y -= 9.8 * dt;
        it.obj.material.opacity = t;
      } else if (it.type === 'boom') {
        const s = 1 + (1 - t) * 9;
        it.obj.scale.setScalar(s);
        it.obj.material.opacity = t * 0.9;
      } else if (it.type === 'light') {
        it.obj.intensity = 40 * t;
      }
      if (it.life <= 0) {
        this.scene.remove(it.obj);
        if (it.obj.geometry) it.obj.geometry.dispose();
        if (it.obj.material) it.obj.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
