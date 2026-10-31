/* Zenou City — procedural city generation.
 * Everything is generated from code at load time: no textures, models or data files.
 */
import * as THREE from '../vendor/three.module.js';

export const CITY = {
  blocks: 7,
  block: 86,
  road: 18,
  cell: 104,
  get span() { return this.blocks * this.cell + this.road; },
  get half() { return this.span / 2; },
};

const tmpVec = new THREE.Vector3();

function rand(min, max) { return min + Math.random() * (max - min); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

/* ---------- shared materials ---------- */

function windowTexture(hue, litChance) {
  const cols = 6, rows = 8;
  const cw = 128 / cols, ch = 128 / rows;

  // daylight facade: concrete / glass panes
  const base = document.createElement('canvas');
  base.width = base.height = 128;
  const bg = base.getContext('2d');
  bg.fillStyle = `hsl(${hue} 12% 42%)`;
  bg.fillRect(0, 0, 128, 128);
  // subtle floor banding
  for (let y = 0; y < rows; y++) {
    bg.fillStyle = `hsl(${hue} 10% ${y % 2 ? 38 : 45}%)`;
    bg.fillRect(0, y * ch, 128, 1.2);
  }

  // night emissive layer: only the lit rooms glow
  const lit = document.createElement('canvas');
  lit.width = lit.height = 128;
  const lg = lit.getContext('2d');
  lg.fillStyle = '#000';
  lg.fillRect(0, 0, 128, 128);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cw + cw * 0.18, py = y * ch + ch * 0.2;
      const pw = cw * 0.64, ph = ch * 0.52;
      bg.fillStyle = `hsl(${hue} 26% ${rand(12, 26)}%)`;
      bg.fillRect(px, py, pw, ph);
      bg.fillStyle = `hsla(${hue} 30% 70% / ${rand(0.02, 0.1)})`;
      bg.fillRect(px, py, pw, ph * 0.4);
      if (Math.random() < litChance) {
        const warm = Math.random() < 0.7;
        lg.fillStyle = warm
          ? `hsl(${rand(34, 46)} 92% ${rand(58, 76)}%)`
          : `hsl(${rand(180, 205)} 78% ${rand(60, 80)}%)`;
        lg.fillRect(px, py, pw, ph);
      }
    }
  }

  const map = new THREE.CanvasTexture(base);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  const emissive = new THREE.CanvasTexture(lit);
  emissive.colorSpace = THREE.SRGBColorSpace;
  emissive.wrapS = emissive.wrapT = THREE.RepeatWrapping;
  emissive.anisotropy = 4;
  return { map, emissive };
}

function asphaltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2d34';
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 1400; i++) {
    const v = (34 + Math.random() * 40) | 0;
    g.fillStyle = `rgba(${v},${v},${v + 3},${Math.random() * 0.5})`;
    g.fillRect(Math.random() * 64, Math.random() * 64, 1.4, 1.4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  return tex;
}

function curbTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#5c6069';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(0,0,0,.22)';
  g.lineWidth = 1;
  for (let i = 0; i < 64; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(23, 23);
  return tex;
}

/* ---------- world ---------- */

export function createWorld(scene) {
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const roadTex = asphaltTexture();
  const curbTex = curbTexture();
  const winTex = [
    windowTexture(220, 0.42),
    windowTexture(205, 0.3),
    windowTexture(230, 0.52),
    windowTexture(190, 0.36),
  ];

  const buildings = [];
  const buildingMeshes = [];
  const blocks = [];
  const roadLines = [];   // {axis:'x'|'z', at:number}
  const parks = [];

  const span = CITY.span, half = CITY.half, cell = CITY.cell;

  /* ground */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(span + 900, span + 900),
    new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.96, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  /* roads (wide slabs) + sidewalks + markings */
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.92, metalness: 0.04 });
  for (let i = 0; i <= CITY.blocks; i++) {
    const at = i * cell - half;
    roadLines.push({ axis: 'z', at }); // road running along z at x = at
    roadLines.push({ axis: 'x', at }); // road running along x at z = at

    const rz = new THREE.Mesh(new THREE.BoxGeometry(CITY.road, 0.05, span + CITY.road), roadMat);
    rz.position.set(at, 0.025, 0);
    rz.receiveShadow = true;
    group.add(rz);

    const rx = new THREE.Mesh(new THREE.BoxGeometry(span + CITY.road, 0.05, CITY.road), roadMat);
    rx.position.set(0, 0.026, at);
    rx.receiveShadow = true;
    group.add(rx);
  }

  const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.9 });
  const dashGeo = new THREE.BoxGeometry(0.22, 0.02, 3.2);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c2, roughness: 0.7, emissive: 0x2a2a20, emissiveIntensity: 0.4 });
  const dashes = [];

  /* blocks */
  const buildingSpots = [];
  for (let i = 0; i < CITY.blocks; i++) {
    for (let j = 0; j < CITY.blocks; j++) {
      const cx = (i + 0.5) * cell - half;
      const cz = (j + 0.5) * cell - half;
      const isCenterPark = i === 3 && j === 3;

      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(CITY.block, 0.22, CITY.block),
        curbMat
      );
      slab.position.set(cx, 0.11, cz);
      slab.receiveShadow = true;
      group.add(slab);

      blocks.push({ x: cx, z: cz, size: CITY.block, park: isCenterPark });
      if (isCenterPark) parks.push({ x: cx, z: cz, size: CITY.block });

      /* dashed lane markings on the two roads bordering this block */
      for (let k = -2; k <= 2; k++) {
        dashes.push({ x: cx + k * 15, y: 0.06, z: cz - CITY.block / 2 - CITY.road / 2, rot: 0 });
        dashes.push({ x: cx, y: 0.06, z: cz - CITY.block / 2 - CITY.road / 2 + k * 15, rot: Math.PI / 2 });
      }

      if (isCenterPark) continue;

      const roll = Math.random();
      if (roll < 0.1) {
        /* parking lot block */
        const lot = new THREE.Mesh(
          new THREE.BoxGeometry(64, 0.05, 64),
          new THREE.MeshStandardMaterial({ color: 0x25272d, roughness: 0.95 })
        );
        lot.position.set(cx, 0.24, cz);
        lot.receiveShadow = true;
        group.add(lot);
        buildingSpots.push({ type: 'lot', x: cx, z: cz });
        continue;
      }

      /* 2x2 lots of buildings, some merged into a courtyard */
      const layout = Math.random() < 0.5 ? 2 : 3;
      const inner = CITY.block - 12;
      const step = inner / layout;
      for (let a = 0; a < layout; a++) {
        for (let b = 0; b < layout; b++) {
          if (Math.random() < 0.12) continue; // gap / alley
          const lx = cx - inner / 2 + step * (a + 0.5);
          const lz = cz - inner / 2 + step * (b + 0.5);
          const w = step * rand(0.62, 0.92);
          const d = step * rand(0.62, 0.92);
          const distC = Math.hypot(lx, lz) / half;
          const tall = THREE.MathUtils.clamp(1.5 - distC * 1.25, 0.22, 1.15);
          const h = rand(9, 20) + tall * rand(20, 62);
          buildingSpots.push({ type: 'building', x: lx, z: lz, w, d, h });
        }
      }
    }
  }

  for (const spot of buildingSpots) {
    if (spot.type === 'lot') {
      /* a few parked cars are placed by the vehicle system later */
      continue;
    }
    const tex = pick(winTex);
    const tint = pick([0xffffff, 0xdfe6f2, 0xcfd8e6, 0xf0e6da]);
    const sideMat = new THREE.MeshStandardMaterial({
      map: tex.map,
      color: tint,
      roughness: 0.78,
      metalness: 0.16,
      emissiveMap: tex.emissive,
      emissive: 0xffffff,
      emissiveIntensity: 0.06,
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.95 });

    const geo = new THREE.BoxGeometry(spot.w, spot.h, spot.d);
    const uv = geo.attributes.uv;
    let scaleY = spot.h / 11;
    let scaleX = spot.w / 11;
    // scale the window grid with the wall size so windows stay human-sized
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const idx = f * 4 + k;
        const face = f;
        const sx = face === 1 || face === 3 ? scaleY : scaleX;
        uv.setXY(idx, uv.getX(idx) * sx, uv.getY(idx) * scaleY);
      }
    }
    const mesh = new THREE.Mesh(geo, [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat]);
    mesh.position.set(spot.x, spot.h / 2 + 0.2, spot.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    buildingMeshes.push(mesh);
    buildings.push({
      x: spot.x, z: spot.z, w: spot.w, d: spot.d, h: spot.h, mesh,
      minX: spot.x - spot.w / 2, maxX: spot.x + spot.w / 2,
      minZ: spot.z - spot.d / 2, maxZ: spot.z + spot.d / 2,
      windows: sideMat,
    });

  }

  /* spire + beacon on the tallest tower so the skyline has a landmark */
  if (buildings.length) {
    const tallest = buildings.reduce((a, b) => (b.h > a.h ? b : a), buildings[0]);
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 1.8, 30, 8),
      new THREE.MeshStandardMaterial({ color: 0x6d7480, roughness: 0.6, metalness: 0.7 })
    );
    spire.position.set(tallest.x, tallest.h + 15, tallest.z);
    group.add(spire);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xff3355 })
    );
    beacon.position.set(tallest.x, tallest.h + 31, tallest.z);
    group.add(beacon);
    scene.userData.beacon = beacon;
  }

  /* trees in parks and along sidewalks */
  const trunkGeo = new THREE.CylinderGeometry(0.26, 0.36, 3.4, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x513a28, roughness: 1 });
  const leafGeo = new THREE.SphereGeometry(2.15, 8, 6);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3c, roughness: 0.95 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 340);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 340);
  let treeCount = 0;
  const m4 = new THREE.Matrix4();
  const addTree = (x, z, s = 1) => {
    if (treeCount >= 340) return;
    m4.makeTranslation(x, 1.7 * s, z).multiply(new THREE.Matrix4().makeScale(s, s, s));
    trunks.setMatrixAt(treeCount, m4);
    m4.makeTranslation(x, 3.9 * s, z).multiply(new THREE.Matrix4().makeScale(s, s, s));
    leaves.setMatrixAt(treeCount, m4);
    treeCount++;
  };
  for (const park of parks) {
    for (let i = 0; i < 34; i++) {
      addTree(park.x + rand(-36, 36), park.z + rand(-36, 36), rand(0.8, 1.4));
    }
    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(CITY.block - 8, 0.12, CITY.block - 8),
      new THREE.MeshStandardMaterial({ color: 0x24512f, roughness: 1 })
    );
    lawn.position.set(park.x, 0.26, park.z);
    lawn.receiveShadow = true;
    group.add(lawn);
  }
  for (let i = 0; i < 90; i++) {
    const line = roadLines[(Math.random() * roadLines.length) | 0];
    const off = (Math.random() < 0.5 ? -1 : 1) * (CITY.road / 2 + 2.2);
    const along = rand(-half + 40, half - 40);
    if (line.axis === 'z') addTree(line.at + off, along, rand(0.55, 0.8));
    else addTree(along, line.at + off, rand(0.55, 0.8));
  }
  trunks.count = treeCount;
  leaves.count = treeCount;
  trunks.castShadow = leaves.castShadow = true;
  group.add(trunks, leaves);

  /* street lamps at intersections */
  const poleGeo = new THREE.CylinderGeometry(0.16, 0.2, 9, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.6, metalness: 0.5 });
  const headGeo = new THREE.BoxGeometry(2.2, 0.22, 0.5);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, emissive: 0xffc46b, emissiveIntensity: 0.2 });
  const poles = [];
  for (let i = 0; i <= CITY.blocks; i++) {
    for (let j = 0; j <= CITY.blocks; j++) {
      for (const s of [[-1, -1], [1, 1]]) {
        const x = i * cell - half + s[0] * (CITY.road / 2 + 1.4);
        const z = j * cell - half + s[1] * (CITY.road / 2 + 1.4);
        poles.push({ x, z });
      }
    }
  }
  const polesMesh = new THREE.InstancedMesh(poleGeo, poleMat, poles.length);
  const headsMesh = new THREE.InstancedMesh(headGeo, headMat, poles.length);
  poles.forEach((p, i) => {
    m4.makeTranslation(p.x, 4.5, p.z);
    polesMesh.setMatrixAt(i, m4);
    m4.makeTranslation(p.x, 8.9, p.z);
    headsMesh.setMatrixAt(i, m4);
  });
  polesMesh.castShadow = true;
  group.add(polesMesh, headsMesh);

  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  dashes.forEach((d, i) => {
    m4.makeRotationY(d.rot);
    m4.setPosition(d.x, d.y, d.z);
    dashMesh.setMatrixAt(i, m4);
  });
  group.add(dashMesh);

  /* crosswalks at intersections */
  const walkGeo = new THREE.BoxGeometry(7.5, 0.02, 0.7);
  const walks = [];
  for (let i = 0; i <= CITY.blocks; i++) {
    for (let j = 0; j <= CITY.blocks; j++) {
      const x = i * cell - half, z = j * cell - half;
      for (let k = -3; k <= 3; k++) {
        walks.push({ x: x + k * 1.4, z: z - CITY.road / 2 - 1.6, rot: Math.PI / 2 });
        walks.push({ x: x + k * 1.4, z: z + CITY.road / 2 + 1.6, rot: Math.PI / 2 });
        walks.push({ x: x - CITY.road / 2 - 1.6, z: z + k * 1.4, rot: 0 });
        walks.push({ x: x + CITY.road / 2 + 1.6, z: z + k * 1.4, rot: 0 });
      }
    }
  }
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xc9c6bb, roughness: 0.8 });
  const walkMesh = new THREE.InstancedMesh(walkGeo, walkMat, walks.length);
  walks.forEach((w, i) => {
    m4.makeRotationY(w.rot);
    m4.setPosition(w.x, 0.062, w.z);
    walkMesh.setMatrixAt(i, m4);
  });
  group.add(walkMesh);

  /* collision hash */
  const HASH = 40;
  const hash = new Map();
  const key = (x, z) => `${Math.floor(x / HASH)},${Math.floor(z / HASH)}`;
  const addToHash = (b) => {
    const x0 = Math.floor(b.minX / HASH), x1 = Math.floor(b.maxX / HASH);
    const z0 = Math.floor(b.minZ / HASH), z1 = Math.floor(b.maxZ / HASH);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = `${x},${z}`;
        if (!hash.has(k)) hash.set(k, []);
        hash.get(k).push(b);
      }
    }
  };
  buildings.forEach(addToHash);

  const world = {
    scene, group, buildings, buildingMeshes, blocks, roadLines, parks, bounds: half - 6,
    collisionBoxes: buildings,
    nearbyBuildings(x, z, out = []) {
      out.length = 0;
      const cx = Math.floor(x / HASH), cz = Math.floor(z / HASH);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const arr = hash.get(`${cx + dx},${cz + dz}`);
          if (arr) for (const b of arr) if (!out.includes(b)) out.push(b);
        }
      }
      return out;
    },
    /** push a circle out of every building it overlaps. returns true when it hit something */
    resolveCircle(pos, radius) {
      let hit = false;
      const list = world.nearbyBuildings(pos.x, pos.z);
      for (const b of list) {
        const nx = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX);
        const nz = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
        const dx = pos.x - nx, dz = pos.z - nz;
        const dist2 = dx * dx + dz * dz;
        if (dist2 > radius * radius) continue;
        hit = true;
        if (dist2 > 1e-6) {
          const d = Math.sqrt(dist2);
          pos.x += (dx / d) * (radius - d);
          pos.z += (dz / d) * (radius - d);
        } else {
          // centre inside the box: push out along the shallowest face
          const l = pos.x - b.minX, r = b.maxX - pos.x;
          const t = pos.z - b.minZ, bo = b.maxZ - pos.z;
          const m = Math.min(l, r, t, bo);
          if (m === l) pos.x = b.minX - radius;
          else if (m === r) pos.x = b.maxX + radius;
          else if (m === t) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
      }
      const lim = world.bounds;
      if (pos.x < -lim) { pos.x = -lim; hit = true; }
      if (pos.x > lim) { pos.x = lim; hit = true; }
      if (pos.z < -lim) { pos.z = -lim; hit = true; }
      if (pos.z > lim) { pos.z = lim; hit = true; }
      return hit;
    },
    isRoad(x, z, pad = 0) {
      const near = (v) => {
        const k = Math.round((v + half) / cell);
        if (k < 0 || k > CITY.blocks) return false;
        return Math.abs(v - (k * cell - half)) <= CITY.road / 2 + pad;
      };
      return near(x) || near(z);
    },
    /** a random point in the middle of a road lane (for spawning traffic/peds) */
    randomRoadPoint() {
      const line = pick(roadLines);
      const along = rand(-half + 30, half - 30);
      if (line.axis === 'z') return { x: line.at + (Math.random() < 0.5 ? -4.4 : 4.4), z: along, axis: 'z' };
      return { x: along, z: line.at + (Math.random() < 0.5 ? -4.4 : 4.4), axis: 'x' };
    },
    randomSidewalkPoint() {
      const b = pick(blocks.filter((s) => !s.park));
      const side = (Math.random() * 4) | 0;
      const off = CITY.block / 2 - 4;
      const t = rand(-30, 30);
      if (side === 0) return { x: b.x + t, z: b.z - off };
      if (side === 1) return { x: b.x + t, z: b.z + off };
      if (side === 2) return { x: b.x - off, z: b.z + t };
      return { x: b.x + off, z: b.z + t };
    },
    randomPoint() {
      return { x: rand(-half + 20, half - 20), z: rand(-half + 20, half - 20) };
    },
    setNight(amount) {
      // amount 0 = day, 1 = night
      for (const b of buildings) {
        b.windows.emissiveIntensity = 0.05 + amount * 1.55;
      }
      headMat.emissiveIntensity = 0.15 + amount * 2.4;
    },
  };

  return world;
}

export { tmpVec };
