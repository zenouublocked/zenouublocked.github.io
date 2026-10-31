#!/usr/bin/env node
// Drives the Three.js trailer frame by frame and writes JPEGs.
//
//   node render.js --stills 3,9.5,16     preview frames
//   node render.js --all                 the whole film (needs timeline.json)
//
// A static server is started for the project root so the page can fetch the
// timeline and the screenshots.
const { chromium } = require('../../.tmp/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(__dirname, '.tmp/frames');
const PORT = 8781;
const W = 1920, H = 1080;

function reachable() {
  return new Promise((res) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/trailer/three/index.html', timeout: 800 }, (r) => {
      r.destroy(); res(true);
    });
    req.on('error', () => res(false));
    req.on('timeout', () => { req.destroy(); res(false); });
  });
}

async function serve() {
  if (await reachable()) return null;
  const py = process.env.PYTHON || 'python';
  const p = spawn(py, ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: ROOT, stdio: 'ignore', detached: false,
  });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await reachable()) return p;
  }
  throw new Error('static server did not start');
}

(async () => {
  const args = process.argv.slice(2);
  const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
  const quality = args.includes('--png') ? null : 96;

  const server = await serve();
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
           '--ignore-gpu-blocklist', '--disable-lcd-text', '--force-color-profile=srgb',
           '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${PORT}/trailer/three/index.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__film && window.__film.ready, null, { timeout: 60000 });
  const info = await page.evaluate(() => ({ duration: window.__film.duration, fps: window.__film.fps }));
  console.log('film', info.duration, 's @', info.fps, 'fps');
  const webgl = await page.evaluate(() => {
    const gl = document.getElementById('gl').getContext('webgl2');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a';
  });
  console.log('renderer:', webgl);

  fs.mkdirSync(OUT, { recursive: true });

  if (stillsArg) {
    for (const t of stillsArg.split(',').map(Number)) {
      await page.evaluate((tt) => window.__film.render(tt), t);
      await page.waitForTimeout(60);
      const file = path.join(OUT, `still_${t.toFixed(2)}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
      console.log('still', file);
    }
  } else {
    const total = Math.round(info.duration * info.fps);
    const started = Date.now();
    for (let i = 0; i < total; i++) {
      await page.evaluate((tt) => window.__film.render(tt), i / info.fps);
      await page.screenshot({ path: path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`),
                              type: 'jpeg', quality });
      if (i % 50 === 0) {
        const el = (Date.now() - started) / 1000;
        console.log(`  ${i}/${total}  ${(i / el).toFixed(1)} fps  eta ${Math.round((total - i) / (i / el))}s`);
      }
    }
    console.log('frames done in', Math.round((Date.now() - started) / 1000), 's');
  }

  if (errors.length) console.log('page errors:', errors.slice(0, 5).join(' | '));
  await browser.close();
  if (server) server.kill();
})().catch((e) => { console.error(e); process.exit(1); });
