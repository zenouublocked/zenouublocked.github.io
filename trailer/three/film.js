// Zenou Unblocked — the trailer, rendered frame by frame in Three.js.
// The timeline (cuts, narration) comes from timeline.json so picture and sound
// are cut from the same clock.
import * as THREE from 'three';

const W = 1920, H = 1080;
const INK = '#f3f0fb', MUTED = '#a9a2c0';
const A1 = '#b24cff', A2 = '#ff4fb0', A3 = '#6df2c1', A4 = '#ffb04c';
const VIOLET = 0x8b5cf6, PINK = 0xff4fb0;

const TL = await fetch('./timeline.json').then((r) => r.json());

// ------------------------------------------------------------------ assets
const SRC = {
  home: '../assets/shots/home.png',
  library: '../assets/shots/library-real.png',
  web: '../assets/shots/web.png',
  media: '../assets/shots/media.png',
  music: '../assets/shots/music.png',
  mineral: '../assets/shots/mineral.png',
  crossy: '../assets/games/crossy.png',
  clustertruck: '../assets/games/clustertruck.png',
  fish: '../assets/games/howtofish.png',
  logo: '../../assets/logo.png',
};

const loader = new THREE.TextureLoader();
async function tex(src) {
  const t = await loader.loadAsync(src);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const TEX = {};
await Promise.all(Object.entries(SRC).map(async ([k, v]) => { TEX[k] = await tex(v); }));
await document.fonts.ready;
await document.fonts.load('800 200px Archivo');
await document.fonts.load('500 40px Archivo');

// ------------------------------------------------------------------ renderer
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060d);
scene.fog = new THREE.FogExp2(0x05060d, 0.030);

const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 400);
camera.position.set(0, 0, 8);

// ------------------------------------------------------------------ helpers
const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeIn = (t) => Math.pow(Math.min(1, Math.max(0, t)), 2.2);
const easeInOut = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const back = (t) => { t = Math.min(1, Math.max(0, t)); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const GLOW = glowTexture();

function glowSprite(color, size, opacity) {
  const m = new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  return s;
}

function textCanvas(parts, o = {}) {
  const size = o.size || 150;
  const weight = o.weight || 800;
  const track = o.track || 0;
  const pad = Math.ceil(size * 0.42);
  const segs = Array.isArray(parts) ? parts : [{ text: parts, color: o.color || INK }];
  const font = `${o.italic ? 'italic ' : ''}${weight} ${size}px Archivo, system-ui, sans-serif`;

  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  probe.letterSpacing = `${track}px`;
  const widths = segs.map((s) => probe.measureText(s.text).width);
  const total = widths.reduce((a, b) => a + b, 0);

  const c = document.createElement('canvas');
  c.width = Math.ceil(total + pad * 2);
  c.height = Math.ceil(size * 1.30 + pad * 2);
  const g = c.getContext('2d');
  g.font = font;
  g.letterSpacing = `${track}px`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';

  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = size * 0.42; }
  let x = pad;
  const y = c.height / 2;
  segs.forEach((s, i) => {
    let fill = s.color || INK;
    if (o.gradient) {
      const grd = g.createLinearGradient(pad, 0, pad + total, 0);
      grd.addColorStop(0, o.gradient[0]);
      grd.addColorStop(1, o.gradient[1]);
      fill = grd;
    }
    g.fillStyle = fill;
    g.fillText(s.text, x, y);
    if (o.glow) g.fillText(s.text, x, y);
    x += widths[i];
  });

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return { canvas: c, texture: t, w: c.width, h: c.height };
}

function txt(parts, o = {}) {
  const { canvas: c, texture } = textCanvas(parts, o);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true,
    depthWrite: false, toneMapped: false, opacity: o.opacity ?? 1 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, c.height / c.width), mat);
  mesh.userData.aspect = c.width / c.height;
  mesh.userData.fit = (w) => mesh.scale.set(w, w, 1);
  if (o.width) mesh.userData.fit(o.width);
  return mesh;
}

function roundTexture(source, radiusFrac = 0.035) {
  const img = source.image;
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = Math.round(1200 * img.height / img.width);
  const g = c.getContext('2d');
  const r = c.width * radiusFrac;
  g.beginPath();
  g.roundRect(0, 0, c.width, c.height, r);
  g.clip();
  g.drawImage(img, 0, 0, c.width, c.height);
  g.restore && g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.13)';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(1.5, 1.5, c.width - 3, c.height - 3, r);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { texture: t, aspect: c.width / c.height };
}

function card(key, width, o = {}) {
  const { texture, aspect } = roundTexture(TEX[key], o.radius ?? 0.03);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1 / aspect), mat);
  m.scale.set(width, width, 1);
  m.userData.aspect = aspect;
  return m;
}

function coverCanvas(title, sub, c1, c2) {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 500;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 800, 500);
  grd.addColorStop(0, c1);
  grd.addColorStop(1, c2);
  g.fillStyle = grd;
  g.fillRect(0, 0, 800, 500);

  const b = g.createRadialGradient(620, 90, 0, 620, 90, 620);
  b.addColorStop(0, 'rgba(255,255,255,0.30)');
  b.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = b;
  g.fillRect(0, 0, 800, 500);

  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo(-100 + i * 110, 500);
    g.lineTo(180 + i * 110, 0);
    g.stroke();
  }

  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.font = '800 30px Archivo, sans-serif';
  g.letterSpacing = '7px';
  g.fillText('ZENOU', 44, 62);

  let size = 82;
  g.letterSpacing = '-1px';
  do { g.font = `800 ${size}px Archivo, sans-serif`; size -= 3; }
  while (g.measureText(title).width > 712 && size > 34);
  g.fillStyle = '#ffffff';
  g.fillText(title, 44, 392);
  g.font = '600 25px Archivo, sans-serif';
  g.letterSpacing = '3px';
  g.fillStyle = 'rgba(255,255,255,0.62)';
  g.fillText(String(sub).toUpperCase(), 46, 440);

  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.beginPath();
  g.roundRect(600, 52, 156, 46, 23);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = '700 20px Archivo, sans-serif';
  g.letterSpacing = '4px';
  g.fillText('PLAY', 628, 83);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function coverMesh(title, sub, c1, c2, width) {
  const t = coverCanvas(title, sub, c1, c2);
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 500 / 800), mat);
  m.scale.set(width, width, 1);
  return m;
}

function fit(mesh, w) { mesh.scale.set(w, w, 1); return mesh; }
function place(obj, x, y, z) { obj.position.set(x, y, z); return obj; }

// ------------------------------------------------------------------ world
const world = new THREE.Group();
scene.add(world);

const starGeo = new THREE.BufferGeometry();
{
  const n = 1500;
  const pos = new Float32Array(n * 3);
  const rng = (() => { let s = 1337; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (rng() - 0.5) * 70;
    pos[i * 3 + 1] = (rng() - 0.5) * 40;
    pos[i * 3 + 2] = -rng() * 90 + 8;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: 0xb9c2e8, size: 0.035, transparent: true, opacity: 0.55,
  blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
}));
world.add(stars);

const gridMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x7c4dff) }, uOpacity: { value: 0.30 } },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
    void main(){
      vec2 g = vUv * vec2(80.0, 80.0);
      g.y += uTime * 1.6;
      vec2 f = abs(fract(g - 0.5) - 0.5) / fwidth(g);
      float line = 1.0 - min(min(f.x, f.y), 1.0);
      float d = length(vUv - 0.5) * 2.0;
      float fade = smoothstep(1.05, 0.10, d);
      float a = line * fade * uOpacity;
      if (a < 0.002) discard;
      gl_FragColor = vec4(uColor, a);
    }`,
});
const grid = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), gridMat);
grid.rotation.x = -Math.PI / 2;
grid.position.set(0, -2.7, -22);
world.add(grid);

// ------------------------------------------------------------------ shots
const shots = {};
let current = null;

function shot(id, build) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const api = build(group);
  shots[id] = { group, id, ...api };
}

function show(shotObj) {
  if (current === shotObj) return;
  for (const s of Object.values(shots)) s.group.visible = false;
  shotObj.group.visible = true;
  current = shotObj;
}

// ---- 01 hook -------------------------------------------------------------
shot('hook', (g) => {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xa274ff, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false }));
  line.scale.set(7.4, 0.016, 1);
  line.position.set(0, 2.02, 0);
  g.add(line);

  const halo = glowSprite(0x8b5cf6, 9, 0.28);
  halo.position.set(0, 0.4, -1);
  g.add(halo);

  const kicker = txt('ZENOU UNBLOCKED', { size: 54, weight: 700, track: 22, color: '#c4b2ff', glow: '#6b2bff' });
  fit(kicker, 4.6).position.set(0, 1.62, 0);
  g.add(kicker);

  const big = txt([{ text: '5,710', color: INK }], { size: 400, weight: 800, track: -6, glow: '#7a34ff' });
  big.userData.fit(6.0);
  big.position.set(0, 0.42, 0);
  g.add(big);

  const word = txt([{ text: 'GAMES', color: A2 }], { size: 210, weight: 800, track: 10, glow: '#ff2f95' });
  fit(word, 4.9).position.set(0, -1.05, 0);
  g.add(word);

  const sub = txt('ONE TAB. NOTHING TO INSTALL.', { size: 42, weight: 600, track: 11, color: MUTED });
  fit(sub, 5.2).position.set(0, -1.82, 0);
  sub.material.opacity = 0;
  g.add(sub);

  const c1 = card('home', 2.2); place(c1, -4.1, 0.1, -4).rotation.set(0.1, 0.45, -0.12);
  const c2 = card('media', 2.3); place(c2, 4.2, -0.2, -4.6).rotation.set(-0.05, -0.45, 0.1);
  g.add(c1, c2);

  const hits = [0.95, 1.45];
  return {
    hits,
    update(lt) {
      const p1 = easeOut(lt / 0.55);
      line.scale.x = 7.4 * p1;
      line.material.opacity = 0.9 * p1;
      halo.material.opacity = 0.25 * p1;

      kicker.material.opacity = clamp01((lt - 0.35) / 0.35);

      const p2 = back((lt - 0.80) / 0.34);
      const s2 = lt > 0.80 ? lerp(1.35, 1, p2) : 1.35;
      big.scale.setScalar(6.0 * s2);
      big.material.opacity = clamp01((lt - 0.80) / 0.07);

      const p3 = back((lt - 1.42) / 0.30);
      const s3 = lt > 1.42 ? lerp(1.25, 1, p3) : 1.25;
      word.scale.setScalar(4.9 * s3);
      word.material.opacity = clamp01((lt - 1.42) / 0.06);
      word.position.y = -1.05 + (1 - clamp01((lt - 1.42) / 0.3)) * 0.18;

      sub.material.opacity = 0;

      const push = easeInOut(lt / 5.2);
      camera.position.set(0 + Math.sin(lt * 0.6) * 0.03, 0.02 + push * 0.06, lerp(8.2, 7.25, push));
      camera.lookAt(0, 0.05, 0);
      camera.fov = 35 - push * 1.2;
      camera.updateProjectionMatrix();

      c1.material.opacity = clamp01((lt - 3.5) / 0.7) * 0.9;
      c2.material.opacity = clamp01((lt - 3.7) / 0.7) * 0.9;
      c1.position.y = 0.1 + Math.sin(lt * 0.8) * 0.03;
      c2.position.y = -0.2 + Math.cos(lt * 0.7) * 0.03;
      c1.rotation.z = -0.12 + Math.sin(lt * 0.6) * 0.01;
      c2.rotation.z = 0.1 + Math.sin(lt * 0.5) * 0.01;

      big.position.y = 0.42 + Math.sin(lt * 0.7) * 0.012;
    },
  };
});

// ---- 02 rules ------------------------------------------------------------
shot('rules', (g) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.006, 6, 180),
    new THREE.MeshBasicMaterial({ color: 0x7b45ff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false }));
  ring.position.set(0, 0, -6);
  g.add(ring);
  const ring2 = ring.clone();
  ring2.scale.setScalar(1.35);
  ring2.material = ring.material.clone();
  ring2.material.opacity = 0.25;
  g.add(ring2);

  const words = [
    ['NO ', A1, 'SIGN-UPS'],
    ['NO ', A2, 'WAITING'],
    ['JUST ', A3, 'PLAY'],
  ].map(([lead, col, tail], i) => {
    const m = txt([{ text: lead, color: i === 2 ? A3 : '#ddd6f0' }, { text: tail, color: i === 2 ? INK : col }],
      { size: 190, weight: 800, track: 2, glow: col });
    fit(m, 6.8);
    m.position.set(0, 0, 0.4);
    m.material.opacity = 0;
    g.add(m);
    return m;
  });

  const marks = [0.42, 1.46, 2.34];
  const hits = marks.slice();
  return {
    hits,
    update(lt) {
      const idx = lt < marks[1] ? 0 : lt < marks[2] ? 1 : 2;
      const local = lt - marks[idx];
      const last = idx === 2;
      words.forEach((w, i) => {
        if (i !== idx) { w.material.opacity = 0; return; }
        const inP = clamp01(local / 0.10);
        const outP = last ? 0 : clamp01((local - 0.92) / 0.14);
        w.material.opacity = (1 - outP) * inP;
        const s = lerp(1.14, 1, back(local / 0.26));
        w.scale.set(6.8 * s, 6.8 * s, 1);
        w.position.y = (1 - easeOut(local / 0.32)) * 0.22 - outP * 0.35;
        w.rotation.z = (1 - easeOut(local / 0.4)) * 0.012;
      });

      ring.rotation.z = lt * 0.12;
      ring2.rotation.z = -lt * 0.08;
      ring.material.opacity = 0.45 + Math.sin(lt * 2.4) * 0.12;

      const push = easeInOut(lt / 5);
      camera.position.set(Math.sin(lt * 0.35) * 0.12, 0.05, lerp(8.6, 7.9, push));
      camera.lookAt(0, 0, 0);
      camera.fov = 35;
      camera.updateProjectionMatrix();
    },
  };
});

// ---- 03 site -------------------------------------------------------------
shot('site', (g) => {
  const keys = ['home', 'library', 'web', 'media', 'music', 'mineral', 'crossy', 'clustertruck', 'fish', 'home', 'media', 'music'];
  const ys = [-1.30, 1.55, 0.25, -0.65, 1.05, -1.15, 1.85, -0.15, 0.65, -1.75, 0.45, 1.25];
  const cards = keys.map((k, i) => {
    const depth = i % 3;
    const w = [4.7, 3.8, 3.05][depth];
    const m = card(k, w);
    const z = [-4.2, -6.4, -8.6][depth];
    m.position.set(i * 2.35 - 8.4, ys[i], z);
    m.rotation.set(0, (i % 2 ? 1 : -1) * 0.10, (i % 2 ? 1 : -1) * 0.045);
    m.material.opacity = 0;
    m.material.color.setScalar(1.12);
    const halo = glowSprite(i % 2 ? 0x8b5cf6 : 0xff4fb0, w * 1.9, 0);
    halo.position.set(m.position.x, m.position.y, z - 0.3);
    g.add(m, halo);
    m.userData.halo = halo;
    m.userData.speed = [1.55, 2.15, 2.8][depth];
    m.userData.base = m.position.clone();
    return m;
  });

  const title = new THREE.Group();
  g.add(title);
  const k1 = txt('THIS IS', { size: 54, weight: 600, track: 16, color: '#c9bcf0' });
  fit(k1, 2.1).position.set(0, 1.12, 0);
  const z = txt('ZENOU', { size: 380, weight: 800, track: 4, glow: '#7b2bff' });
  fit(z, 6.4).position.set(0, 0.0, 0);
  const u = txt('UNBLOCKED', { size: 120, weight: 700, track: 26, color: A2, glow: '#ff2f95' });
  fit(u, 5.4).position.set(0, -1.15, 0);
  title.add(k1, z, u);

  return {
    hits: [0.12, 3.0],
    update(lt) {
      const inT = clamp01(lt / 0.28);
      k1.material.opacity = inT * clamp01((2.02 - lt) / 0.42);
      z.material.opacity = clamp01((lt - 0.06) / 0.12) * clamp01((2.02 - lt) / 0.46);
      u.material.opacity = clamp01((lt - 0.30) / 0.35) * clamp01((2.02 - lt) / 0.46);
      const zs = lerp(1.10, 1, back((lt - 0.02) / 0.5));
      z.scale.set(6.4 * zs, 6.4 * zs, 1);
      title.position.y = (1 - easeOut(lt / 0.6)) * 0.08;

      // dive into the tunnel
      const drift = Math.max(0, lt - 1.9);
      const push = easeInOut(lt / 6.7);
      camera.position.set(Math.sin(lt * 0.5) * 0.10, 0.02, lerp(8.6, 7.5, push));
      camera.rotation.z = Math.sin(lt * 0.7) * 0.006;
      camera.lookAt(0, 0, -4);
      camera.fov = 35;
      camera.updateProjectionMatrix();

      cards.forEach((m, i) => {
        const appear = clamp01((lt - 1.92 - i * 0.04) / 0.28);
        m.material.opacity = appear;
        m.userData.halo.material.opacity = appear * 0.15;
        const raw = m.userData.base.x - drift * m.userData.speed;
        m.position.x = ((raw + 11) % 22 + 22) % 22 - 11;   // wrap off-screen, never a gap
        m.userData.halo.position.x = m.position.x;
        m.position.y = m.userData.base.y + Math.sin(lt * 0.6 + i) * 0.04;
      });

      gridMat.uniforms.uTime.value = lt * 0.6;
    },
  };
});

// ---- 04 games ------------------------------------------------------------
const GAME_LIST = [
  ['AMONG US', 'social deduction', '#1b2f6b', '#0a1230'],
  ['GRANNY', 'horror', '#3a1620', '#140609'],
  ['TERRARIA', 'sandbox', '#1d4b3a', '#08201a'],
  ['GEOMETRY DASH', 'one button', '#4a2170', '#160a28'],
  ['HOLLOW KNIGHT', 'metroidvania', '#243a4a', '#0a1218'],
  ['BUILDNOW GG', 'build shooter', '#5a3a12', '#1c1206'],
  ['SKATE 3', 'skate', '#3d3a12', '#141305'],
  ['HEXGL', 'racing', '#123a4a', '#05161c'],
  ['CROSSY ROAD', 'endless', '#24430f', '#0a1606'],
  ['CLUSTERTRUCK', 'platformer', '#4a2a10', '#170c05'],
  ['HOW TO FISH', 'chill', '#0f3a44', '#04161b'],
  ['2048', 'puzzle', '#3a2a0a', '#140e03'],
  ['CLUMSY BIRD', 'arcade', '#3f1230', '#150611'],
  ['MOTO X3M', 'bike', '#123047', '#05121b'],
  ['DRIFT BOSS', 'drift', '#3a1030', '#150511'],
  ['SNOW RIDER 3D', 'snow', '#1a2a4a', '#070f1c'],
  ['DUCK LIFE', 'racing', '#2a3a12', '#0e1405'],
  ['RED BALL', 'platformer', '#4a1010', '#180404'],
  ['SLITHER', 'io', '#103a2a', '#04140f'],
  ['BAD ICE CREAM', 'puzzle', '#10304a', '#05121a'],
  ['TANUKI SUNSET', 'skate', '#3a1230', '#150611'],
  ['BLOONS TD', 'tower defense', '#123a12', '#051405'],
  ['RIDDLE SCHOOL', 'point click', '#2a2a3a', '#0c0c14'],
  ['SOFLO WHEELIE', 'wheelie', '#3a2a12', '#140d04'],
];

shot('games', (g) => {
  const covers = GAME_LIST.map(([t, s, a, b]) => coverMesh(t, s, a, b, 2.0));
  const grid = new THREE.Group();
  g.add(grid);
  const items = [];
  const cols = 6, rows = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const m = covers[i].clone();
      m.position.set((c - (cols - 1) / 2) * 2.16, (r - (rows - 1) / 2) * 1.38, -9 - (r % 2) * 0.4);
      m.rotation.z = (Math.sin(i * 12.9) * 0.5) * 0.05;
      m.userData.from = new THREE.Vector3(
        (Math.sin(i * 7.3) * 0.5) * 7,
        (Math.cos(i * 3.1) * 0.5) * 5,
        -9 - Math.random() * 12,
      );
      m.material.opacity = 0;
      grid.add(m);
      items.push(m);
    }
  }

  const title = new THREE.Group();
  g.add(title);
  const press = txt('PRESS', { size: 300, weight: 800, track: 0, color: INK, glow: '#6a2bff' });
  fit(press, 4.4).position.set(0, 0.62, 0);
  const play = txt('PLAY', { size: 300, weight: 800, track: 6, gradient: [A1, A2], glow: '#ff2f95' });
  fit(play, 3.6).position.set(0, -0.72, 0);
  const sub = txt('5,710 GAMES  ·  3,043 WITH NO PRE-ROLL', { size: 38, weight: 600, track: 8, color: MUTED });
  fit(sub, 4.6).position.set(0, -1.62, 0);
  title.add(press, play, sub);

  return {
    hits: [4.7],
    update(lt) {
      const wave = clamp01((lt - 0.15) / 1.15);
      items.forEach((m, i) => {
        const d = Math.hypot(m.position.x / 6.6, m.position.y / 2.8);
        const p = clamp01((wave * 1.35 - d * 0.55) / 0.45);
        m.material.opacity = p;
        m.position.x = lerp(m.userData.from.x, (i % 6 - 2.5) * 2.16, easeOut(p));
        m.position.y = lerp(m.userData.from.y, (Math.floor(i / 6) - 1.5) * 1.38, easeOut(p));
        m.position.z = lerp(m.userData.from.z, -9 - ((i % 6) % 2) * 0.4, easeOut(p));
      });

      const fly = easeIn(lt / 4.5);
      camera.position.set(Math.sin(lt * 0.7) * 0.15, 0.05, lerp(8.4, -5.2, fly));
      camera.lookAt(0, 0, camera.position.z - 12);
      camera.fov = 35 + fly * 10;
      camera.updateProjectionMatrix();
      grid.rotation.z = (1 - fly) * -0.02;

      const a = clamp01((lt - 4.75) / 0.10);
      const b = clamp01((lt - 4.95) / 0.10);
      const c = clamp01((lt - 5.35) / 0.35);
      press.material.opacity = a;
      press.scale.set(4.4 * lerp(1.14, 1, back((lt - 4.75) / 0.3)), 4.4 * lerp(1.14, 1, back((lt - 4.75) / 0.3)), 1);
      play.material.opacity = b;
      sub.material.opacity = c * 0.92;
      title.visible = lt > 4.7;
      grid.visible = lt < 4.66;
      if (lt > 4.7) {
        camera.position.set(0, 0, 8.2 - (lt - 4.7) * 0.12);
        camera.lookAt(0, -0.15, 0);
        camera.fov = 35;
        camera.updateProjectionMatrix();
      }
    },
  };
});

// ---- panel shots (web / media / music / library / yours) -----------------
function panelShot(id, opts) {
  shot(id, (g) => {
    const panel = card(opts.key, opts.width);
    panel.position.set(opts.px, opts.py, 0);
    panel.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
    panel.material.opacity = 0;
    g.add(panel);

    const halo = glowSprite(opts.halo || VIOLET, opts.width * 2.4, 0);
    halo.position.set(opts.px, opts.py, -1.4);
    g.add(halo);

    const kick = txt(opts.kicker, { size: 40, weight: 700, track: 14, color: opts.kcolour || '#c4b2ff' });
    fit(kick, opts.kwidth || 2.4).position.set(opts.tx, opts.ty + 0.92, 0);
    g.add(kick);

    const lines = opts.title.map((t, i) => {
      const m = txt(t.parts || [{ text: t.text, color: t.color || INK }],
        { size: 150, weight: 800, track: t.track || 0, glow: t.glow || null,
          gradient: t.gradient || null });
      fit(m, t.width || 4.0).position.set(opts.tx, opts.ty + 0.16 - i * 0.78, 0);
      m.material.opacity = 0;
      g.add(m);
      return m;
    });


    const extra = (opts.extra || []).map((e) => {
      const m = txt(e.text, { size: e.size || 34, weight: 700, track: e.track || 2, color: e.color || INK });
      fit(m, e.width || 2.4);
      m.position.set(e.x, e.y, e.z || 0.3);
      m.material.opacity = 0;
      if (m.material.map) m.material.map.colorSpace = THREE.SRGBColorSpace;
      m.userData = { ...e };
      g.add(m);
      return m;
    });

    return {
      hits: [0.05],
      update(lt) {
        const p = easeOut(lt / 0.85);
        panel.material.opacity = clamp01(lt / 0.35);
        panel.position.y = opts.py - (1 - p) * 0.9;
        panel.rotation.y = (opts.ry || 0) + (1 - p) * 0.22 + Math.sin(lt * 0.5) * 0.012;
        panel.rotation.z = (opts.rz || 0) + Math.sin(lt * 0.4) * 0.006;
        halo.material.opacity = clamp01(lt / 0.8) * 0.20;

        kick.material.opacity = clamp01((lt - 0.10) / 0.45) * 0.95;
        lines.forEach((m, i) => {
          const t0 = 0.30 + i * 0.20;
          const q = back((lt - t0) / 0.34);
          m.material.opacity = clamp01((lt - t0) / 0.09);
          const base = (opts.title[i].width || 4.0);
          m.scale.set(base * lerp(1.12, 1, q), base * lerp(1.12, 1, q), 1);
        });
        extra.forEach((m, i) => {
          const t0 = (m.userData.at ?? 1.5) + i * 0.10;
          const a = clamp01((lt - t0) / 0.40);
          m.material.opacity = a;
          m.position.y = m.userData.y + (1 - easeOut(a)) * -0.22;
        });

        if (opts.cam) opts.cam(camera, lt);
        camera.updateProjectionMatrix();
      },
    };
  });
}

panelShot('web', {
  key: 'web', width: 4.05, px: 1.86, py: 0.02, ry: -0.40, rx: 0.02, rz: -0.02,
  kicker: 'THE WEB', tx: -2.02, ty: 0.62, kwidth: 1.7,
  title: [
    { text: 'THE WEB,', width: 4.0 },
    { text: 'IN HERE.', color: A2, width: 3.7, glow: '#ff2f95' },
  ],
  extra: [{ text: 'NO NEW TAB', x: -1.55, y: -1.15, width: 1.75, color: A3, at: 2.2 }],
  cam(cam, lt) {
    const p = easeInOut(lt / 8);
    cam.position.set(lerp(-0.35, 0.18, p), 0.05, lerp(8.9, 8.0, p));
    cam.lookAt(0.1, -0.05, 0);
    cam.fov = 35;
  },
});

panelShot('media', {
  key: 'media', width: 3.95, px: 1.9, py: 0.12, ry: -0.36, rx: 0.02, rz: 0.02,
  kicker: 'MEDIA', tx: -2.02, ty: 0.62, kwidth: 1.25, kcolour: '#ff9ad2',
  title: [
    { text: 'EVERYTHING', width: 3.95 },
    { text: 'YOU WATCH.', color: A2, width: 3.55, glow: '#ff2f95' },
  ],
  extra: [],
  cam(cam, lt) {
    const p = easeInOut(lt / 7.8);
    cam.position.set(lerp(0.15, -0.1, p), 0.02, lerp(8.9, 8.1, p));
    cam.lookAt(0.1, -0.05, 0);
    cam.fov = 35;
  },
});

panelShot('music', {
  key: 'music', width: 4.0, px: 1.86, py: 0.42, ry: -0.32, rz: -0.03,
  kicker: 'MUSIC', tx: -2.02, ty: 0.62, kwidth: 1.25,
  title: [
    { text: 'SOUND', width: 3.4 },
    { text: 'ON.', color: A3, width: 2.0, glow: '#2fe3a5' },
  ],
  extra: [
    { text: 'SPOTIFY', x: -2.55, y: -1.62, width: 1.25, color: A3, at: 2.1 },
    { text: 'SOUNDCLOUD', x: -1.05, y: -1.62, width: 1.75, color: '#bfeee0', at: 2.4 },
  ],
  cam(cam, lt) {
    const p = easeInOut(lt / 7);
    cam.position.set(lerp(-0.25, 0.1, p), lerp(-0.1, 0.05, p), lerp(8.9, 8.1, p));
    cam.lookAt(0.1, -0.05, 0);
    cam.fov = 35;
  },
});

panelShot('library', {
  key: 'library', width: 4.1, px: 1.9, py: 0.04, ry: -0.28, rz: 0.02,
  kicker: 'MY LIBRARY', tx: -2.02, ty: 0.6, kwidth: 2.05,
  title: [
    { text: 'IT', width: 1.8 },
    { text: 'REMEMBERS.', color: A1, width: 3.95, glow: '#7b2bff' },
  ],
  extra: [],
  cam(cam, lt) {
    const p = easeInOut(lt / 7.5);
    cam.position.set(lerp(0.1, -0.08, p), 0.03, lerp(8.4, 8.0, p));
    cam.lookAt(0.05, -0.05, 0);
    cam.fov = 35;
  },
});

panelShot('yours', {
  key: 'home', width: 3.9, px: 1.9, py: 0.06, ry: -0.32, rz: -0.03,
  kicker: 'MAKE IT YOURS', tx: -2.02, ty: 0.6, kwidth: 2.3,
  title: [
    { text: 'YOUR', width: 2.8 },
    { text: 'RULES.', color: A2, width: 3.3, glow: '#ff2f95' },
  ],
  extra: [],
  cam(cam, lt) {
    const p = easeInOut(lt / 7);
    cam.position.set(lerp(-0.15, 0.12, p), 0.02, lerp(8.9, 8.05, p));
    cam.lookAt(0.1, -0.05, 0);
    cam.fov = 35;
  },
});

// ---- equaliser + chips + swatches, added to their shots ------------------
{
  const g = shots.music.group;
  const bars = [];
  const n = 26;
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.72 - i * 0.006, 0.85, 0.62),
        transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending,
        toneMapped: false, depthWrite: false }));
    b.position.set(0.08 + i * 0.1505, -1.9, 1.1);
    b.scale.set(0.085, 0.1, 1);
    g.add(b);
    bars.push(b);
  }
  const prev = shots.music.update;
  shots.music.update = function (lt, t, s) {
    prev.call(this, lt, t, s);
    bars.forEach((b, i) => {
      const e = 0.10 + Math.abs(Math.sin(lt * 3.1 + i * 0.42)) * 0.85
        * (0.45 + 0.55 * Math.sin(i * 0.7 + lt * 1.3) ** 2);
      b.scale.y = 0.10 + e * 1.35;
      b.position.y = -2.15 + b.scale.y / 2;
      b.material.opacity = 0.5 + e * 0.5;
    });
  };
}

{
  const g = shots.yours.group;
  const cols = [0xb24cff, 0xff4fb0, 0x6df2c1, 0xffb04c, 0x60a5ff];
  const orbs = cols.map((c, i) => {
    const s = glowSprite(c, 0.9, 0.9);
    const ang = (i / cols.length) * Math.PI * 2;
    s.userData = { ang, i };
    s.position.set(2.6 + Math.cos(ang) * 1.9, 0.1 + Math.sin(ang) * 1.25, -0.8 + Math.sin(ang) * 0.4);
    g.add(s);
    return s;
  });
  const prev = shots.yours.update;
  shots.yours.update = function (lt, t, s) {
    prev.call(this, lt, t, s);
    orbs.forEach((o, i) => {
      const ang = o.userData.ang + lt * 0.35;
      o.position.set(2.65 + Math.cos(ang) * 1.95, 0.12 + Math.sin(ang) * 1.3, -0.6 + Math.sin(ang) * 0.5);
      o.material.opacity = clamp01((lt - 0.6 - i * 0.08) / 0.5) * 0.85;
    });
  };
}

// ---- 05 outro ------------------------------------------------------------
shot('outro', (g) => {
  const burst = glowSprite(0x8b5cf6, 1, 0);
  burst.position.set(0, 0.35, -3);
  g.add(burst);

  const mark = card('logo', 0.84, { radius: 0.18 });
  mark.position.set(0, 1.62, 0.1);
  mark.material.opacity = 0;
  const markGlow = glowSprite(0x5affd8, 2.4, 0);
  markGlow.position.set(0, 1.62, -0.3);
  g.add(markGlow, mark);

  const word = txt('ZENOU', { size: 400, weight: 800, track: 2, color: INK, glow: '#7b2bff' });
  fit(word, 5.6).position.set(0, 0.58, 0);
  word.material.opacity = 0;

  const sub = txt('UNBLOCKED', { size: 130, weight: 700, track: 30, color: A2, glow: '#ff2f95' });
  fit(sub, 5.0).position.set(0, -0.62, 0);
  sub.material.opacity = 0;

  const rule = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x9a6bff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, toneMapped: false }));
  rule.scale.set(4.2, 0.008, 1);
  rule.position.set(0, -1.16, 0);
  g.add(rule);

  const tag = txt('ONE TAB. EVERYTHING.', { size: 66, weight: 700, track: 16, color: '#efe9ff' });
  fit(tag, 4.4).position.set(0, -1.54, 0);
  tag.material.opacity = 0;

  const url = txt('zenou-unblocked', { size: 62, weight: 600, track: 1, color: '#0b0713' });
  const urlW = 3.4;
  fit(url, urlW);
  url.position.set(0, -2.2, 0.1);
  url.material.opacity = 0;
  const pill = card('home', 0.001); // placeholder, replaced by a drawn pill
  g.remove(pill);
  const pillCanvas = document.createElement('canvas');
  pillCanvas.width = 900; pillCanvas.height = 220;
  {
    const c = pillCanvas.getContext('2d');
    const grd = c.createLinearGradient(0, 0, 900, 0);
    grd.addColorStop(0, A1);
    grd.addColorStop(1, A2);
    c.fillStyle = grd;
    c.beginPath();
    c.roundRect(6, 6, 888, 208, 104);
    c.fill();
  }
  const pillTex = new THREE.CanvasTexture(pillCanvas);
  pillTex.colorSpace = THREE.SRGBColorSpace;
  const pillMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 220 / 900),
    new THREE.MeshBasicMaterial({ map: pillTex, transparent: true, toneMapped: false }));
  pillMesh.position.set(0, -2.2, 0);
  pillMesh.scale.set(3.7, 3.7, 1);
  pillMesh.material.opacity = 0;
  g.add(pillMesh);

  g.add(word, sub, rule, tag, url);

  return {
    hits: [0.15, 3.3],
    update(lt) {
      const inP = clamp01((lt - 0.10) / 0.30);
      const s = lerp(1.16, 1, back((lt - 0.10) / 0.55));
      word.scale.set(5.6 * s, 5.6 * s, 1);
      word.material.opacity = inP;
      word.position.y = 0.58 + Math.sin(lt * 0.5) * 0.01;

      const mk = lerp(1.4, 1, back((lt + 0.1) / 0.7));
      mark.material.opacity = clamp01(lt / 0.25);
      mark.scale.set(0.84 * mk, 0.84 * mk, 1);
      mark.position.y = 1.62 + Math.sin(lt * 0.5 + 0.4) * 0.012;
      markGlow.material.opacity = clamp01(lt / 0.6) * 0.22;

      sub.material.opacity = clamp01((lt - 0.45) / 0.4);
      sub.position.x = (1 - easeOut((lt - 0.45) / 0.7)) * 0.1;

      rule.material.opacity = clamp01((lt - 0.9) / 0.5) * 0.8;
      rule.scale.x = 4.2 * easeOut((lt - 0.9) / 0.8);

      tag.material.opacity = clamp01((lt - 3.35) / 0.5);
      pillMesh.material.opacity = clamp01((lt - 3.9) / 0.5);
      url.material.opacity = clamp01((lt - 4.0) / 0.5);

      burst.material.opacity = clamp01((lt - 0.05) / 0.4) * (0.35 - Math.min(0.2, lt * 0.02));
      const bs = 6 + easeOut(lt / 3) * 6;
      burst.scale.set(bs, bs, 1);

      const push = easeInOut(lt / 8.5);
      camera.position.set(0, 0.05, lerp(8.0, 7.2, push));
      camera.lookAt(0, -0.25, 0);
      camera.fov = 35;
      camera.updateProjectionMatrix();

      camera.rotation.z = Math.sin(lt * 0.4) * 0.0018;
    },
  };
});

// ------------------------------------------------------------------ overlay
const ui = document.getElementById('ui');
const ctx = ui.getContext('2d');

const vignette = (() => {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(W * 0.5, H * 0.46, H * 0.20, W * 0.5, H * 0.5, H * 0.86);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.62, 'rgba(3,2,8,0.26)');
  grd.addColorStop(1, 'rgba(2,1,5,0.78)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  return c;
})();

const grain = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const img = g.createImageData(512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 135;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 12 + Math.random() * 16;
  }
  g.putImageData(img, 0, 0);
  return c;
})();

const CHAPTER = {
  hook: '01 / THE SHELF',
  rules: '02 / NO FRICTION',
  site: '03 / THIS IS ZENOU',
  games: '04 / GAMES',
  web: '05 / THE WEB',
  media: '06 / MEDIA',
  music: '07 / MUSIC',
  library: '08 / LIBRARY',
  yours: '09 / YOURS',
  outro: '',
};

function wrap(text, maxWidth, font) {
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (ctx.measureText(next).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawOverlay(t, shotObj, lt) {
  ctx.clearRect(0, 0, W, H);

  // film-cut flash
  let flash = 0;
  for (const s of Object.values(shots)) {
    const d = t - s.group.userData.cutAt;
    if (!Number.isFinite(d)) continue;
    if (d >= 0 && d < 0.09) flash = Math.max(flash, 1 - d / 0.09);
  }
  if (shotObj.id === 'site' && lt > 1.28 && lt < 1.42) flash = Math.max(flash, 1 - Math.abs(lt - 1.35) / 0.07);
  if (flash > 0.002) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.drawImage(vignette, 0, 0);

  // caption bed: a soft band so the line stays readable over any shot
  const bed = ctx.createLinearGradient(0, H - 330, 0, H);
  bed.addColorStop(0, 'rgba(4,3,10,0)');
  bed.addColorStop(0.55, 'rgba(4,3,10,0.38)');
  bed.addColorStop(1, 'rgba(3,2,8,0.72)');
  ctx.fillStyle = bed;
  ctx.fillRect(0, H - 330, W, 330);

  // chapter mark, top left
  const ch = CHAPTER[shotObj.id];
  if (ch && lt > 0.30) {
    const a = clamp01((lt - 0.30) / 0.5);
    ctx.save();
    ctx.globalAlpha = a * 0.82;
    ctx.fillStyle = '#d7cbf0';
    ctx.font = '700 18px Archivo, sans-serif';
    ctx.letterSpacing = '7px';
    ctx.fillText(ch, 108, 92);
    ctx.restore();
    ctx.strokeStyle = `rgba(178,76,255,${a * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(108, 116);
    ctx.lineTo(108 + 54 * easeOut((lt - 0.30) / 0.6), 116);
    ctx.stroke();
  }

  // narration caption
  const vo = shotObj.vo;
  if (vo) {
    const a = clamp01((lt - 0.18) / 0.35) * clamp01((vo.end - t + 0.45) / 0.45);
    if (a > 0.01) {
      const font = '500 38px Archivo, sans-serif';
      const lines = wrap(vo.text, 1280, font);
      ctx.save();
      ctx.globalAlpha = a * 0.95;
      ctx.font = font;
      ctx.letterSpacing = '0.3px';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f1ecfa';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 3;
      const baseY = H - 128;
      lines.forEach((l, i) => {
        const y = baseY + (i - (lines.length - 1)) * 48;
        ctx.fillText(l, W / 2, y);
      });
      ctx.restore();
    }
  }

  // grain
  ctx.save();
  ctx.globalAlpha = 0.5;
  const ox = -Math.floor((t * 240) % 512);
  const oy = -Math.floor((t * 173) % 512);
  for (let y = oy; y < H; y += 512) for (let x = ox; x < W; x += 512) ctx.drawImage(grain, x, y);
  ctx.restore();
}

// ------------------------------------------------------------------ driver
const byId = {};
for (const s of TL.shots) byId[s.id] = s;

let lastCut = 0;
function cutTimes() {
  const arr = [];
  for (const s of TL.shots) arr.push(s.start);
  for (const s of Object.values(shots)) (s.hits || []).forEach((h) => arr.push(byId[s.id].start + h));
  arr.sort((a, b) => a - b);
  return arr;
}
const CUTS = cutTimes();

function activeAt(t) {
  for (const s of TL.shots) if (t < s.end - 1e-6) return s;
  return TL.shots[TL.shots.length - 1];
}

function renderAt(t) {
  const s = activeAt(t);
  const lt = t - s.start;
  const obj = shots[s.id];
  obj.vo = s.vo;
  obj.group.userData.cutAt = s.start;
  show(obj);

  // shake on the two frames after a hit
  let shakeAmt = 0;
  for (const c of CUTS) {
    const d = t - c;
    if (d >= 0 && d < 0.10) shakeAmt = Math.max(shakeAmt, (1 - d / 0.10) * 0.035);
  }

  obj.update(lt, t, s);

  if (shakeAmt > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt;
    camera.position.y += (Math.random() - 0.5) * shakeAmt;
  }

  stars.rotation.z = t * 0.004;
  stars.position.z = (t * 0.35) % 6;
  gridMat.uniforms.uTime.value = t * 0.35;
  gridMat.uniforms.uOpacity.value = s.id === 'site' ? 0.38 : 0.26;

  renderer.render(scene, camera);
  drawOverlay(t, obj, lt);
  return true;
}

window.__film = {
  ready: true,
  duration: TL.duration,
  fps: TL.fps,
  shots: TL.shots,
  render: renderAt,
};

// still preview: index.html?t=12.5
const q = new URLSearchParams(location.search);
if (q.has('t')) {
  renderAt(parseFloat(q.get('t')));
  document.body.dataset.still = '1';
}
