/* Zenou City — vehicles: player cars, traffic and police cruisers. */
import * as THREE from '../vendor/three.module.js';

const COLORS = [0xb4232e, 0x1f4fa8, 0xdedede, 0x1d1f24, 0x2f7d4f, 0xd08a1e, 0x6b3fa0, 0x9aa3ad, 0x274b56, 0xc0392b];

const CAR_TYPES = {
  sedan: { len: 4.5, wid: 1.9, max: 32, accel: 13, grip: 0.9, tall: 0.62 },
  coupe: { len: 4.3, wid: 1.86, max: 38, accel: 17, grip: 0.86, tall: 0.55 },
  van: { len: 5.2, wid: 2.05, max: 26, accel: 10, grip: 0.82, tall: 0.9 },
  taxi: { len: 4.5, wid: 1.9, max: 31, accel: 13, grip: 0.9, tall: 0.62 },
};

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeWheel() {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14),
    new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.9 })
  );
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.34, 10),
    new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.35, metalness: 0.9 })
  );
  rim.rotation.z = Math.PI / 2;
  g.add(tyre, rim);
  return g;
}

export function createCarMesh({ color = 0xb4232e, type = 'sedan', police = false } = {}) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: police ? 0x15171c : color,
    roughness: 0.35,
    metalness: 0.55,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0d1420, roughness: 0.12, metalness: 0.5, transparent: true, opacity: 0.92,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.85 });

  const body = box(spec.wid, spec.tall, spec.len, bodyMat);
  body.position.y = 0.72;
  g.add(body);

  const cabin = box(spec.wid * 0.86, spec.tall * 0.72, spec.len * 0.44, glassMat);
  cabin.position.set(0, 0.72 + spec.tall * 0.62, -spec.len * 0.04);
  g.add(cabin);

  const roof = box(spec.wid * 0.8, 0.1, spec.len * 0.34, bodyMat);
  roof.position.set(0, 0.72 + spec.tall * 0.98, -spec.len * 0.05);
  g.add(roof);

  const skirt = box(spec.wid * 1.02, 0.22, spec.len * 0.98, trimMat);
  skirt.position.y = 0.42;
  g.add(skirt);

  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xfff0c0, emissiveIntensity: 0.7 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x7a1418, emissive: 0xff2030, emissiveIntensity: 0.35 });
  for (const sx of [-1, 1]) {
    const hl = box(0.42, 0.18, 0.1, headMat);
    hl.position.set(sx * spec.wid * 0.32, 0.78, spec.len / 2 + 0.01);
    g.add(hl);
    const tl = box(0.44, 0.16, 0.1, tailMat);
    tl.position.set(sx * spec.wid * 0.32, 0.8, -spec.len / 2 - 0.01);
    g.add(tl);
  }

  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = makeWheel();
      w.position.set(sx * (spec.wid / 2 + 0.02), 0.42, sz * spec.len * 0.32);
      g.add(w);
      wheels.push(w);
    }
  }

  let lightBar = null;
  if (police) {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x33373f, roughness: 0.6 });
    lightBar = box(spec.wid * 0.72, 0.16, 0.4, barMat);
    lightBar.position.set(0, 0.72 + spec.tall * 1.06, -0.1);
    g.add(lightBar);
    const blue = new THREE.MeshStandardMaterial({ color: 0x1a3bff, emissive: 0x2a5bff, emissiveIntensity: 2.6 });
    const red = new THREE.MeshStandardMaterial({ color: 0xff1a2e, emissive: 0xff2233, emissiveIntensity: 2.6 });
    for (const [sx, mat] of [[-1, red], [1, blue]]) {
      const lens = box(spec.wid * 0.3, 0.14, 0.34, mat);
      lens.position.set(sx * spec.wid * 0.2, 0.72 + spec.tall * 1.14, -0.1);
      lightBar.add(lens);
      lightBar[`lens${sx < 0 ? 'R' : 'B'}`] = lens;
    }
    const decal = box(spec.wid * 0.9, 0.5, spec.len * 0.62, new THREE.MeshStandardMaterial({ color: 0xe9edf3, roughness: 0.5 }));
    decal.position.set(0, 0.88, -spec.len * 0.02);
    g.add(decal);
  }

  if (type === 'taxi' && !police) {
    const sign = box(0.9, 0.26, 0.34, new THREE.MeshStandardMaterial({ color: 0xffcf3d, emissive: 0xffb200, emissiveIntensity: 0.8 }));
    sign.position.set(0, 0.72 + spec.tall * 1.1, -0.1);
    g.add(sign);
    const stripe = box(spec.wid * 1.005, 0.16, spec.len * 0.98, new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7 }));
    stripe.position.y = 0.62;
    g.add(stripe);
  }

  g.userData = { spec, wheels, tailMat, headMat, lightBar, police, bodyMat, glassMat };
  return g;
}

export class Vehicle {
  constructor(scene, { x = 0, z = 0, heading = 0, type = 'sedan', color, police = false, parked = false }) {
    this.type = type;
    this.police = police;
    this.parked = parked;
    this.mesh = createCarMesh({ color: color ?? COLORS[(Math.random() * COLORS.length) | 0], type, police });
    this.mesh.position.set(x, 0.02, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.spec = this.mesh.userData.spec;
    this.pos = new THREE.Vector2(x, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = police ? 160 : 100;
    this.radius = Math.max(this.spec.wid, this.spec.len * 0.55) * 0.62;
    this.alive = true;
    this.braking = false;
    this.honk = 0;
    this._lastHit = 0;
    this.occupied = false;
    this.wheelSpin = 0;
    this.id = Math.random();
  }

  get forward() {
    return new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading));
  }

  setPosition(x, z, heading = this.heading) {
    this.pos.set(x, z);
    this.heading = heading;
    this.mesh.position.set(x, 0.02, z);
    this.mesh.rotation.y = heading;
  }

  /** controls: {throttle:-1..1, steer:-1..1, handbrake:boolean} */
  applyControls(dt, controls, world) {
    const spec = this.spec;
    const throttle = THREE.MathUtils.clamp(controls.throttle || 0, -1, 1);
    const steerInput = THREE.MathUtils.clamp(controls.steer || 0, -1, 1);
    const handbrake = !!controls.handbrake;

    this.braking = false;
    if (throttle > 0.02) {
      this.speed += spec.accel * throttle * dt;
    } else if (throttle < -0.02) {
      if (this.speed > 0.6) {
        this.speed -= 26 * -throttle * dt;
        this.braking = true;
      } else {
        this.speed -= spec.accel * 0.55 * -throttle * dt;
      }
    } else {
      this.speed *= 1 - 1.1 * dt;
    }

    if (handbrake) {
      this.speed *= 1 - 2.6 * dt;
      this.braking = true;
    }

    const max = spec.max * (handbrake ? 0.72 : 1);
    this.speed = THREE.MathUtils.clamp(this.speed, -max * 0.4, max);

    // steering tightens at low speed, is gentle at speed
    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 9, 0.24, 1);
    const targetSteer = steerInput * (handbrake ? 1.25 : 1);
    this.steer += (targetSteer - this.steer) * Math.min(1, 9 * dt);
    const turnRate = 1.95 * (handbrake ? 1.5 : 1) * speedFactor;
    this.heading += this.steer * turnRate * dt * Math.sign(this.speed || 1);

    const f = this.forward;
    this.pos.x += f.x * this.speed * dt;
    this.pos.y += f.y * this.speed * dt;

    // world collision
    const before = { x: this.pos.x, y: this.pos.y };
    const p = { x: this.pos.x, z: this.pos.y };
    if (world.resolveCircle(p, this.radius)) {
      this.pos.set(p.x, p.z);
      const moved = Math.hypot(this.pos.x - before.x, this.pos.y - before.y);
      if (moved > 0.01) {
        if (Math.abs(this.speed) > 8) this.honk = 0.6;
        this.speed *= -0.22;
      }
    }
    this.pos.set(p.x, p.z);

    this.mesh.position.set(this.pos.x, 0.02, this.pos.y);
    this.mesh.rotation.y = this.heading;

    // wheel visuals
    this.wheelSpin += this.speed * dt * 2.2;
    for (const w of this.mesh.userData.wheels) {
      w.rotation.x = this.wheelSpin;
      w.rotation.y = this.steer * 0.45 * (w.position.z > 0 ? 1 : 0);
    }
    this.mesh.userData.tailMat.emissiveIntensity = this.braking || this.speed < -0.2 ? 2.2 : 0.35;
    if (this.mesh.userData.lightBar) {
      const t = performance.now() / 1000;
      const l = this.mesh.userData.lightBar;
      if (l.lensB) {
        l.lensB.material.emissiveIntensity = Math.sin(t * 9) > 0 ? 3.2 : 0.25;
        l.lensR.material.emissiveIntensity = Math.sin(t * 9) > 0 ? 0.25 : 3.2;
      }
    }
    return this;
  }

  damage(amount) {
    if (!this.alive) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      this.explode();
      return true;
    }
    return false;
  }

  explode() {
    this.alive = false;
    this.mesh.userData.bodyMat.color.setHex(0x1b1b1b);
    this.mesh.userData.glassMat.opacity = 0.4;
    if (this.onExplode) this.onExplode(this);
  }

  seatPosition() {
    return new THREE.Vector3(this.pos.x, 0, this.pos.y);
  }
}

/* ---------- traffic ---------- */

export class TrafficCar extends Vehicle {
  constructor(scene, world, opts = {}) {
    const line = opts.line || world.roadLines[(Math.random() * world.roadLines.length) | 0];
    const axis = line.axis;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const along = (Math.random() * 2 - 1) * world.bounds;
    const lane = dir * 4.6;
    const x = axis === 'z' ? line.at + lane : along;
    const z = axis === 'z' ? along : line.at + lane;
    const heading = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    super(scene, { x, z, heading, type: opts.type || (Math.random() < 0.16 ? 'taxi' : Math.random() < 0.2 ? 'van' : Math.random() < 0.35 ? 'coupe' : 'sedan') });
    this.world = world;
    this.axis = axis;
    this.dir = dir;
    this.lane = lane;
    this.speed = 8 + Math.random() * 4;
    this.cruise = 8 + Math.random() * 5;
    this.node = this.nextNode(along, dir);
    this.turning = 0;
  }

  nextNode(along, dir) {
    const half = this.world.bounds + 10;
    const step = 104;
    const idx = Math.round((along + (this.world.roadLines[0] ? 373 : 0)) / step);
    let target = (idx + dir) * step - 373;
    if (target < -half || target > half) target = (idx - dir) * step - 373;
    return target;
  }

  update(dt, world, playerPos) {
    if (!this.alive || this.occupied) return;
    const target = this.node;
    const along = this.axis === 'z' ? this.pos.y : this.pos.x;
    const delta = target - along;
    if (Math.abs(delta) < 2.4) {
      // choose a new direction at the junction
      const straight = Math.random() < 0.62;
      if (!straight) {
        const newAxis = this.axis === 'z' ? 'x' : 'z';
        const newDir = Math.random() < 0.5 ? 1 : -1;
        this.axis = newAxis;
        this.dir = newDir;
        this.lane = newDir * 4.6;
        if (newAxis === 'z') this.pos.set(newAxis === 'z' ? Math.round((this.pos.x + 373) / 104) * 104 - 373 + this.lane : this.pos.x, this.pos.y);
      }
      const roadAt = Math.round((this.pos.x + 373) / 104) * 104 - 373;
      if (this.axis === 'z') { this.pos.x = roadAt + this.lane; }
      else { this.pos.y = roadAt + this.lane; }
      this.node = this.nextNode(this.axis === 'z' ? this.pos.y : this.pos.x, this.dir);
      this.heading = this.axis === 'z' ? (this.dir > 0 ? 0 : Math.PI) : (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      return;
    }

    // slow down for corners and the player
    let wanted = this.cruise;
    if (Math.abs(delta) < 14) wanted = 4.5;
    if (playerPos) {
      const d = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.y);
      if (d < 14) wanted = Math.min(wanted, 3);
    }
    this.speed += THREE.MathUtils.clamp(wanted - this.speed, -12 * dt, 7 * dt);

    const sign = Math.sign(delta);
    if (this.axis === 'z') this.pos.y += sign * this.speed * dt;
    else this.pos.x += sign * this.speed * dt;

    const targetHeading = this.axis === 'z' ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? Math.PI / 2 : -Math.PI / 2);
    let diff = ((targetHeading - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.heading += diff * Math.min(1, 6 * dt);
    this.mesh.position.set(this.pos.x, 0.02, this.pos.y);
    this.mesh.rotation.y = this.heading;
    this.wheelSpin += this.speed * dt * 2.2;
    for (const w of this.mesh.userData.wheels) w.rotation.x = this.wheelSpin;
  }
}

export class PoliceCar extends Vehicle {
  constructor(scene, world, x, z) {
    super(scene, { x, z, heading: Math.atan2(-x, -z), type: 'sedan', police: true });
    this.world = world;
    this.speed = 0;
    this.stuck = 0;
    this.reverse = 0;
  }

  chase(dt, targetPos) {
    if (!this.alive) return;
    const dx = targetPos.x - this.pos.x;
    const dz = targetPos.z - this.pos.y;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let diff = ((want - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

    if (this.reverse > 0) {
      this.reverse -= dt;
      this.speed = -6;
      this.heading += diff * Math.min(1, 2 * dt);
    } else {
      this.heading += THREE.MathUtils.clamp(diff, -1, 1) * 2.3 * dt;
      const targetSpeed = dist > 26 ? 26 : dist > 14 ? 12 : 0;
      this.speed += THREE.MathUtils.clamp(targetSpeed - this.speed, -22 * dt, 14 * dt);
      if (Math.abs(diff) > 1.5 && this.speed > 9) this.speed -= 14 * dt;
    }

    const f = this.forward;
    const p = { x: this.pos.x + f.x * this.speed * dt, z: this.pos.y + f.y * this.speed * dt };
    const movedX = p.x, movedZ = p.z;
    if (this.world.resolveCircle(p, this.radius)) {
      if (Math.abs(this.speed) > 4) {
        this.reverse = 0.9;
        this.speed *= 0.15;
      }
      p.x = this.pos.x; p.z = this.pos.y;
    }
    if (Math.hypot(p.x - movedX, p.z - movedZ) > 2) this.reverse = 0.8;
    this.pos.set(p.x, p.z);
    this.mesh.position.set(this.pos.x, 0.02, this.pos.y);
    this.mesh.rotation.y = this.heading;
    this.wheelSpin += this.speed * dt * 2.2;
    for (const w of this.mesh.userData.wheels) w.rotation.x = this.wheelSpin;
    this.mesh.userData.tailMat.emissiveIntensity = 1.6;
  }
}

/* ---------- manager ---------- */

export class VehicleManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    this.parked = [];
    this.traffic = [];
    this.police = [];
    this.spawnTraffic(16);
    this.spawnParked(26);
  }

  spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const c = new TrafficCar(this.scene, this.world);
      this.cars.push(c);
      this.traffic.push(c);
    }
  }

  spawnParked(n) {
    const line = () => this.world.roadLines[(Math.random() * this.world.roadLines.length) | 0];
    for (let i = 0; i < n; i++) {
      const l = line();
      const along = (Math.random() * 2 - 1) * (this.world.bounds - 20);
      const side = Math.random() < 0.5 ? 1 : -1;
      const off = side * (this.world.roadLines[0] ? 8.2 : 8.2);
      const x = l.axis === 'z' ? l.at + off : along;
      const z = l.axis === 'z' ? along : l.at + off;
      const heading = l.axis === 'z' ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      let ok = true;
      for (const b of this.world.buildings) {
        if (x > b.minX - 3 && x < b.maxX + 3 && z > b.minZ - 3 && z < b.maxZ + 3) { ok = false; break; }
      }
      if (!ok) continue;
      const car = new Vehicle(this.scene, { x, z, heading, type: Math.random() < 0.2 ? 'van' : Math.random() < 0.4 ? 'coupe' : 'sedan', parked: true });
      this.cars.push(car);
      this.parked.push(car);
    }
  }

  nearestCar(x, z, maxDist = 4.4, exclude = null) {
    let best = null, bestD = maxDist;
    for (const c of this.cars) {
      if (c === exclude || !c.alive || c.police) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.y - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  spawnPolice(x, z) {
    const car = new PoliceCar(this.scene, this.world, x, z);
    this.cars.push(car);
    this.police.push(car);
    return car;
  }

  update(dt, player, wanted) {
    for (const c of this.traffic) c.update(dt, this.world, player.pos);

    // traffic cars stop for each other (cheap O(n^2) on 16 cars)
    for (let i = 0; i < this.traffic.length; i++) {
      const a = this.traffic[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.traffic.length; j++) {
        const b = this.traffic[j];
        if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.y - a.pos.y;
        const d = Math.hypot(dx, dz);
        if (d > 3.4 || d < 0.01) continue;
        const push = (3.4 - d) / 2;
        a.pos.x -= (dx / d) * push; a.pos.y -= (dz / d) * push;
        b.pos.x += (dx / d) * push; b.pos.y += (dz / d) * push;
        a.speed *= 0.6; b.speed *= 0.6;
        a.mesh.position.set(a.pos.x, 0.02, a.pos.y);
        b.mesh.position.set(b.pos.x, 0.02, b.pos.y);
      }
    }

    // police dispatch
    const wantCars = Math.min(4, Math.max(0, wanted - 1) * 2);
    if (this.police.filter((p) => p.alive).length < wantCars) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 120;
      const c = this.spawnPolice(player.pos.x + Math.cos(angle) * dist, player.pos.z + Math.sin(angle) * dist);
      c.copTimer = 0;
    }
    for (const p of this.police) {
      if (!p.alive) continue;
      p.chase(dt, player.pos);
    }
  }

  clearPolice() {
    for (const p of this.police) this.remove(p);
    this.police.length = 0;
  }

  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    const j = this.traffic.indexOf(car);
    if (j >= 0) this.traffic.splice(j, 1);
    const k = this.parked.indexOf(car);
    if (k >= 0) this.parked.splice(k, 1);
    this.scene.remove(car.mesh);
    car.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
