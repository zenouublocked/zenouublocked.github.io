// Probe AI destinations: reachability + framing verdict, graded on the FINAL hop.
// Writes catalog/ai.json's tools array verdicts back into the catalogue so the
// page never claims a frame the server refuses.
//
//   node scripts/verify-ai.mjs           # probe and report
//   node scripts/verify-ai.mjs --write   # probe and rewrite verdict fields
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CATALOG = path.join(ROOT, 'catalog', 'ai.json');
const WRITE = process.argv.includes('--write');
const TIMEOUT = 18000;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Grade framing from response headers. */
function grade(headers) {
  const xfo = (headers.get('x-frame-options') || '').toLowerCase();
  const csp = (headers.get('content-security-policy') || '').toLowerCase();
  if (xfo.includes('deny')) return { frame: 'tab', note: 'X-Frame-Options: DENY' };
  if (xfo.includes('sameorigin')) return { frame: 'tab', note: 'X-Frame-Options: SAMEORIGIN' };
  const ancestors = /frame-ancestors([^;]*)/.exec(csp);
  if (ancestors) {
    const value = ancestors[1].trim();
    if (value.includes("'none'")) return { frame: 'tab', note: "frame-ancestors 'none'" };
    if (value.includes('*')) return { frame: 'inline', note: 'frame-ancestors *' };
    return { frame: 'tab', note: 'frame-ancestors ' + value.slice(0, 40) };
  }
  return { frame: 'inline', note: 'no framing header' };
}

async function probe(tool) {
  const started = Date.now();
  try {
    const res = await fetch(tool.url, {
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = await res.text();
    const title = (/<title[^>]*>([\s\S]{0,140}?)<\/title>/i.exec(body) || [, ''])[1].trim().replace(/\s+/g, ' ');
    const verdict = grade(res.headers);
    /* A 403/429/202 here is an edge challenge, not a dead host: a real browser
       passes it and lands on the app. The tool is still usable, it just cannot
       be framed and never was going to be. */
    const challenge = res.status >= 400 || res.status === 202;
    const frame = challenge ? 'tab' : verdict.frame;
    const note = challenge
      ? 'edge answered ' + res.status + (title ? ' · ' + title.slice(0, 34) : '') + ' (challenge)'
      : verdict.note + ' · ' + res.status;
    return {
      ok: true,
      state: challenge ? 'challenge' : 'live',
      frame,
      status: res.status,
      note,
      final: res.url,
      title,
      ms: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false,
      state: 'down',
      frame: 'tab',
      status: 0,
      note: 'unreachable · ' + (e.name || 'error'),
      final: tool.url,
      title: '',
      ms: Date.now() - started,
    };
  }
}

const catalog = JSON.parse(await fs.readFile(CATALOG, 'utf8'));
const tools = Array.isArray(catalog.tools) ? catalog.tools : [];
const rows = [];

for (const tool of tools) {
  const r = await probe(tool);
  rows.push({ id: tool.id, ...r });
  const mark = r.ok ? (r.frame === 'inline' ? 'FRAME ' : 'TAB   ') : 'FAIL  ';
  console.log(
    [mark, tool.id.padEnd(12), String(r.status).padEnd(4), String(r.ms).padEnd(6) + 'ms', r.note.slice(0, 56)].join(' '),
  );
  if (WRITE) {
    tool.frame = r.ok ? r.frame : 'tab';
    tool.status = r.ok ? r.state : 'down';
    tool.note = r.note;
    tool.checked = new Date().toISOString().slice(0, 10);
  }
}

const live = rows.filter(r => r.ok && r.state === 'live').length;
const challenged = rows.filter(r => r.ok && r.state === 'challenge').length;
const down = rows.filter(r => !r.ok).length;
const inline = rows.filter(r => r.ok && r.frame === 'inline').length;
console.log(`\n${rows.length} probed · ${live} live · ${challenged} behind a challenge · ${down} unreachable · ${inline} allow framing`);

if (WRITE) {
  catalog.checked = new Date().toISOString().slice(0, 10);
  await fs.writeFile(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
  console.log('wrote ' + path.relative(ROOT, CATALOG));
} else {
  console.log('dry run · pass --write to store the verdicts');
}

process.exitCode = down === rows.length ? 1 : 0;
