import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334;
const profile = mkdtempSync(join(tmpdir(), 'cg-check-'));
const games = process.argv.slice(2);
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=900,640', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function client(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } };
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  return { ready, send(method, params = {}) { const n = ++id; ws.send(JSON.stringify({ id: n, method, params })); return new Promise((resolve, reject) => pending.set(n, { resolve, reject })); }, close: () => ws.close() };
}

async function run(slug) {
  const url = `https://games.crazygames.com/en_US/${slug}/index.html`;
  const t = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then(r => r.json());
  const c = client(t.webSocketDebuggerUrl); await c.ready;
  await c.send('Page.enable'); await c.send('Runtime.enable');
  await sleep(7000);
  for (const [x, y] of [[450, 300], [450, 250], [450, 340]]) {
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(1200);
  }
  await sleep(20000);
  const shot = await c.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`../zenou-ui-shots/check-${slug}.png`, Buffer.from(shot.data, 'base64'));
  const txt = await c.send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0,400)', returnByValue: true });
  c.close();
  return { slug, text: (txt.result?.value || '').replace(/\s+/g, ' ').slice(0, 240) };
}

try {
  for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }
  for (const g of games) console.log(JSON.stringify(await run(g)));
} finally { chrome.kill(); }
