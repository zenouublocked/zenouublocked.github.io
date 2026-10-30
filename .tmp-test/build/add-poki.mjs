/* Add Poki's famous titles to the catalog with real thumbnails, keeping
 * honest external-only mode (Poki's CSP frames only *.poki.io).
 * Steps:
 *  1. fetch each existing pk- page -> json-ld primary image hash (thumbnails)
 *  2. merge extracted.json (slug|title|img) -> add unseen titles
 *  3. write games.json (compact, same v3 shape) + recompute manifest.json totals
 */
import fs from 'node:fs';

const catalogPath = 'catalog/games.json';
const manifestPath = 'catalog/manifest.json';

const data = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const games = data.games;

const extracted = JSON.parse(fs.readFileSync('.tmp-test/poki/extracted.json', 'utf8'));

const thumb = (imgPath) =>
  `https://img.poki-cdn.com/cdn-cgi/image/q=78,scq=50,width=448,height=280,fit=cover,f=png/${imgPath}`;

/* keyword category mapping (kept light; 'poki-official' always included) */
const CAT_RULES = [
  [/(wheelie|moto|bike|motorcycl|stunt)/i, ['motorcycle', 'stunt']],
  [/(climb|platformer|obby|rainbow-obby|jump|parkour)/i, ['platformer', 'parkour']],
  [/(stickman|stick-)/i, ['stickman', 'fighting']],
  [/(karate|punch|fight|battle|combat|war)/i, ['fighting', 'action']],
  [/(-io\b|\.io$|\.io[^-]|multiplay)/i, ['io', 'multiplayer']],
  [/(runner|run|dash-rush|surfer|subway)/i, ['runner']],
  [/(car|drift|rac(er|ing)|drive|truck|driving|kart|crash)/i, ['driving-3d', 'racing']],
  [/(chess|tic-tac|cards|solitaire|sudoku|2048|merge|puzzle|brain|onet|match|mahjong|jigsaw|word)/i, ['puzzle']],
  [/(horror|scary|escape|haunt)/i, ['horror', 'adventure']],
  [/(hotel|shop|simulator|tycoon|farm|build)/i, ['simulator', 'tycoon']],
  [/(soccer|football|basketball|penalty|golf|sports)/i, ['sports']],
  [/(shoot|gun|netherportal|blast)/i, ['shooter']],
];

function catsFor(title, slug) {
  const hay = `${title} ${slug}`;
  const out = new Set(['poki-official']);
  for (const [re, cats] of CAT_RULES) if (re.test(hay)) cats.forEach(c => out.add(c));
  if (out.size === 1) out.add('arcade');
  return [...out];
}

const catalog = new Map(games.map(g => [g.id, g]));
const report = { thumbsBackfilled: 0, added: 0, skipped: 0 };

/* 1. backfill thumbnails for existing pk- entries */
for (const g of games) {
  if (!g.id.startsWith('pk-')) continue;
  if (g.img) continue;
  const slug = g.id.slice(3);
  const ex = extracted.find(x => x.slug === slug);
  if (ex) { g.img = thumb(ex.img); report.thumbsBackfilled++; continue; }
  console.log('MISS (no extracted img):', slug);
}

/* 2. add unseen famous titles */
for (const { slug, title, img } of extracted) {
  const id = `pk-${slug}`;
  if (catalog.has(id)) { report.skipped++; continue; }
  games.push({
    id,
    t: title,
    cs: catsFor(title, slug),
    s: 'poki',
    a: null,
    p: 'ex',
    u: `https://poki.com/en/g/${slug}`,
    g: `https://poki.com/en/g/${slug}`,
    img: thumb(img),
    note: "Poki's content-security policy allows framing only on its own domains — this opens on poki.com.",
  });
  catalog.set(id, games[games.length - 1]);
  report.added++;
}

data.games = games;
fs.writeFileSync(catalogPath, JSON.stringify(data)); // compact, same as the build pipeline

/* 3. recompute manifest totals from the catalog */
const count = (pred) => games.filter(pred).length;
const manifest = {
  build: new Date().toISOString(),
  totals: {
    entries: games.length,
    playableOnSite: count(g => g.p !== 'ex'),
    providerFileIframes: count(g => g.p === 'pf'),
    crazygamesFileIframes: count(g => g.p === 'pg'),
    scratchEmbeds: count(g => g.p === 'sc'),
    externalOnly: count(g => g.p === 'ex'),
    crazygamesSitelocked: count(g => g.p === 'ex' && g.s === 'crazygames-official'),
    pokiExternal: count(g => g.s === 'poki'),
  },
  verification: {
    method: 'Per-game embeddability read from the official CrazyGames gameframe config (disableEmbedding flag) in the wrapper HTML of all slugs.',
    scratch: 'Every Scratch ID probed against the official Scratch API · official /embed player',
    poki: 'Every Poki slug validated on poki.com (HTTP 200); Poki serves frame-ancestors https://*.poki.io, so all Poki titles are honest external links with official CDN thumbnails.',
    providerNote: "pf games load from the publisher's own hosting with no CrazyGames ad/branding shell.",
    slowNote: 'pg embeds may show a pre-game ad. Player shows loading hints and an official-site escape.',
  },
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(JSON.stringify(report, null, 1));
console.log('manifest totals:', JSON.stringify(manifest.totals, null, 1));
