/* Fetch each pk- entry's Poki page and extract the primary image hash. */
import fs from 'node:fs';

const catalogPath = 'catalog/games.json';
const data = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const missing = data.games.filter(g => g.id.startsWith('pk-') && !g.img);
console.log('missing thumbs:', missing.length);

async function grab(g) {
  const slug = g.id.slice(3);
  try {
    const r = await fetch(`https://poki.com/en/g/${slug}`, {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) { console.log(`SKIP ${r.status} ${slug}`); return; }
    const html = await r.text();
    const m = /img\.poki-cdn\.com\/(?:cdn-cgi\/image\/[a-zA-Z0-9=,._-]+\/)?([0-9a-f]{32})\/([^"'\\?)\s]+\.(?:png|jfif|jpe?g|webp))/i.exec(html);
    if (!m) { console.log(`NOIMG ${slug}`); return; }
    const [, hash, file] = m;
    g.img = `https://img.poki-cdn.com/cdn-cgi/image/q=78,scq=50,width=448,height=280,fit=cover,f=png/${hash}/${file}`;
    console.log(`OK   ${slug}`);
  } catch (e) {
    console.log(`ERR  ${slug}: ${e.name || e.message}`);
  }
}

const queue = [...missing];
while (queue.length) {
  await Promise.all(queue.splice(0, 6).map(grab));
}

fs.writeFileSync(catalogPath, JSON.stringify(data));
const left = data.games.filter(g => g.id.startsWith('pk-') && !g.img);
console.log('still missing:', left.length, left.map(g => g.id));
