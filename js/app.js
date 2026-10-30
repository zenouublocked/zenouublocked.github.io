/* Zenou Unblocked — homepage logic.
 * Single catalog file fetched once at boot; all views render from memory.
 * URL routes: index.html            -> home
 *             index.html?c=wheelie  -> collection view
 *             index.html?q=run      -> search results
 */
'use strict';

const $ = (sel) => document.querySelector(sel);

/* ---------- local storage ---------- */
const store = {
  get(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota — ignore */ } },
};
const favs = new Set(store.get('zenou_fav', []));
let recent = store.get('zenou_recent', []).filter(r => typeof r?.id === 'string');

/* ---------- catalog state ---------- */
let GAMES = [];
let byId = new Map();
let countsReady = false;

const CATEGORY_META = [
  ['wheelie', 'Wheelie bikes'],
  ['motorcycle', 'Moto & motorcycles'],
  ['driving-3d', '3D driving'],
  ['racing', 'Racing'],
  ['drift', 'Drifting'],
  ['stunt', 'Stunts'],
  ['runner', 'Endless runners'],
  ['platformer', 'Platformers'],
  ['parkour', 'Parkour'],
  ['multiplayer', 'Multiplayer'],
  ['io', '.io games'],
  ['sports', 'Sports'],
  ['stickman', 'Stickman'],
  ['fighting', 'Fighting'],
  ['horror', 'Horror'],
  ['adventure', 'Adventure'],
  ['simulator', 'Simulators'],
  ['tycoon', 'Tycoon'],
  ['shooter', 'Shooting'],
  ['physics-fun', 'Physics'],
  ['arcade', 'Arcade'],
  ['scratch', 'Scratch games'],
  ['chess', 'Chess'],
  ['crazygames-official', 'Offsite picks'],
  ['poki-official', 'Poki picks'],
  ['selfhosted', 'Self-hosted'],
];
const CAT_NAMES = new Map(CATEGORY_META);
const CAT_ORDER = CATEGORY_META.map(c => c[0]);
const SOURCE_BADGES = { crazygames: 'CrazyGames', scratch: 'Scratch', poki: 'Poki', selfhosted: 'Hosted here' };

const RAILS = [
  { title: 'Hosted right here', cats: ['selfhosted'], max: 12 },
  { title: 'Wheelie & bike collection', cats: ['wheelie', 'motorcycle'], max: 24 },
  { title: '3D driving arcade', cats: ['driving-3d', 'stunt'], max: 24 },
  { title: 'Scratch creators', cats: ['scratch'], max: 24 },
  { title: 'Drifting & racing', cats: ['drift', 'racing'], max: 24 },
  { title: 'Endless runners', cats: ['runner'], max: 24 },
  { title: 'Multiplayer & .io', cats: ['multiplayer', 'io'], max: 24 },
  { title: 'Sports', cats: ['sports'], max: 24 },
  { title: 'Escape & horror', cats: ['horror', 'adventure'], max: 24 },
  { title: 'Stickman & fighting', cats: ['stickman', 'fighting'], max: 24 },
  { title: 'Tycoons & simulators', cats: ['tycoon', 'simulator'], max: 24 },
];

/* curated featured ids — all verified playable */
const FEATURED_IDS = [
  'lo-hexgl', 'cg-smash-karts', 'sc-1231016758',
  'cg-moto-x3m-pool-party', 'sc-612229554', 'lo-clumsy-bird', 'cg-moto-x3m-4',
];
const EXCLUDE_FROM_FEATURED = new Set(FEATURED_IDS);

/* ---------- router ---------- */
function params() {
  return new URLSearchParams(location.search);
}
function currentRoute() {
  const p = params();
  const q = (p.get('q') || '').trim();
  const c = (p.get('c') || '').trim();
  if (q) return { view: 'search', q };
  if (c && CAT_ORDER.includes(c) || (c && byName(c))) return { view: 'collection', c: c || byName(c) };
  if (c) return { view: 'collection', c };
  return { view: 'home' };
}
function byName(nameOrCat) {
  const n = nameOrCat.toLowerCase();
  for (const [id, name] of CAT_NAMES) if (id === n || name.toLowerCase() === n) return id;
  return null;
}
function goToSearch(q, replace = false) {
  const url = `index.html?q=${encodeURIComponent(q)}`;
  if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
  render();
}
function goToCategory(cat) {
  history.pushState(null, '', `index.html?c=${encodeURIComponent(cat)}`);
  render();
}
function goHome() {
  history.pushState(null, '', 'index.html');
  render();
}

/* ---------- card rendering ---------- */
function hashHue(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 5;
  return h;
}
function initials(t) {
  return (t.match(/[A-Za-z0-9]/g) || ['?']).slice(0, 2).join('').toUpperCase();
}

function card(g, extra = {}) {
  const a = document.createElement('a');
  a.className = 'card';
  a.href = `play.html?id=${encodeURIComponent(g.id)}`;
  a.setAttribute('aria-label', `${g.t} — ${SOURCE_BADGES[g.s] || 'game'}`);

  const badge = document.createElement('span');
  badge.className = 'card-src';
  badge.dataset.src = g.s;
  badge.textContent = SOURCE_BADGES[g.s] || '';

  if (g.img) {
    const img = document.createElement('img');
    img.className = 'card-thumb';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    img.src = g.img;
    img.onerror = () => {
      const plaque = document.createElement('span');
      plaque.className = 'card-plaque';
      plaque.dataset.hue = hashHue(g.t);
      plaque.textContent = initials(g.t);
      img.replaceWith(plaque);
    };
    a.append(img);
  } else {
    const plaque = document.createElement('span');
    plaque.className = 'card-plaque';
    plaque.dataset.hue = hashHue(g.t);
    plaque.textContent = initials(g.t);
    a.append(plaque);
  }

  const playBadge = document.createElement('span');
  playBadge.className = 'card-play-badge';
  playBadge.innerHTML = '<i><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></i>';
  a.append(playBadge);

  const name = document.createElement('span');
  name.className = 'card-name';
  name.textContent = g.t;
  a.append(name);

  // a creator credit means something; a category repeated on every tile does not
  if (g.s === 'scratch') {
    const sub = document.createElement('span');
    sub.className = 'card-sub';
    sub.textContent = `by ${g.a || 'Scratch creator'}`;
    a.append(sub);
  }

  if (badge.textContent) a.append(badge);
  return a;
}

/* the featured banner is full width, so ask the CDN for a larger copy of the thumb */
function bigThumb(src) {
  if (!src) return '';
  return src.replace(/width=\d+/, 'width=1280');
}

function catOf(g) { return g.cs && g.cs[0] || 'arcade'; }
function fmtPlays(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  String(n);
  return String(n);
}

/* ---------- home view ---------- */
function renderHero() {
  const heroCard = $('#heroCard');
  const feat = FEATURED_IDS.map(id => byId.get(id)).filter(Boolean);
  const f = feat[0];
  if (!f) { heroCard.hidden = true; }
  else {
    heroCard.hidden = false;
    heroCard.href = `play.html?id=${encodeURIComponent(f.id)}`;
    heroCard.innerHTML = '';
    const img = document.createElement('img');
    img.src = bigThumb(f.img);
    img.alt = '';
    const txt = document.createElement('div');
    txt.className = 'hero-card-text';
    txt.innerHTML = `
      <span class="hero-kicker">Featured today</span>
      <h2 class="hero-card-title"></h2>
      <span class="hero-card-play">Play now<svg viewBox="0 0 24 24" width="14" height="14" style="fill:currentColor;margin-left:2px"><path d="M8 5.5v13l11-6.5z"/></svg></span>`;
    txt.querySelector('.hero-card-title').textContent = f.t;
    heroCard.append(img, txt);
  }
  if (feat.length > 1) {
    // rotating picks every 6s
    let idx = 0;
    clearInterval(renderHero._timer);
    renderHero._timer = setInterval(() => {
      if (heroCard.hidden || document.hidden) return;
      idx = (idx + 1) % Math.min(feat.length, 5);
      const g = feat[idx];
      const img = heroCard.querySelector('img');
      const title = heroCard.querySelector('.hero-card-title');
      if (img && title) { img.src = bigThumb(g.img) || img.src; title.textContent = g.t; heroCard.href = `play.html?id=${encodeURIComponent(g.id)}`; }
    }, 6000);
  }

  const list = $('#heroList');
  list.innerHTML = '';
  const head = document.createElement('p');
  head.className = 'hero-list-title';
  head.innerHTML = 'Most played <small>Live play counts from Scratch</small>';
  list.append(head);
  const top = GAMES.filter(g => g.s === 'scratch' && g.pc).sort((a, b) => b.pc - a.pc).slice(0, 10);
  top.forEach((g, i) => {
    const it = document.createElement('a');
    it.className = 'hero-item';
    it.href = `play.html?id=${encodeURIComponent(g.id)}`;
    const img = document.createElement('img');
    img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
    img.onerror = () => { it.querySelector('.hero-item-name').textContent = g.t; img.remove(); };
    img.src = g.img || '';
    const nm = document.createElement('span');
    nm.className = 'hero-item-name';
    nm.textContent = g.t;
    const pl = document.createElement('span');
    pl.className = 'hero-item-plays';
    pl.textContent = fmtPlays(g.pc);
    it.append(
      Object.assign(document.createElement('span'), { className: 'hero-item-rank', textContent: String(i + 1) }),
      img, nm, pl,
    );
    list.append(it);
  });
}

function matchesAny(g, cats) { return cats.some(c => g.cs && g.cs.includes(c)); }

function renderRails() {
  const wrap = $('#railWrap');
  wrap.innerHTML = '';
  for (const rail of RAILS) {
    const picks = GAMES.filter(g => matchesAny(g, rail.cats) && !EXCLUDE_FROM_FEATURED.has(g.id));
    if (!picks.length) continue;
    const sec = document.createElement('section');
    const titleGrid = document.createElement('div');
    titleGrid.className = 'section-head-with-link';
    const h = document.createElement('h2');
    h.className = 'section-title';
    h.textContent = rail.title;
    const all = document.createElement('button');
    all.className = 'btn';
    all.type = 'button';
    all.innerHTML = '<span>See all</span>';
    all.addEventListener('click', () => goToCategory(rail.cats[0]));
    titleGrid.append(h, all);
    sec.append(titleGrid);

    const row = document.createElement('div');
    row.className = 'rail';
    const cover = firstCategoryOverlap(GAMES, rail.cats).slice(0, rail.max);
    cover.forEach(g => row.append(card(g)));
    sec.append(row);
    wrap.append(sec);
  }
}

function firstCategoryOverlap(games, cats) {
  // rank: exact primary category first, secondary after
  const a = games.filter(g => g.cs && cats.includes(g.cs[0]));
  const b = games.filter(g => g.cs && cats.includes(g.cs[0]) === false && cats.some(c => g.cs.includes(c)));
  return [...a, ...b];
}

function renderCollections() {
  const railEl = $('#collectionRail');
  railEl.innerHTML = '';
  const chip = (label, cat, current, count) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.append(document.createTextNode(label));
    if (count) {
      const n = document.createElement('span');
      n.className = 'chip-count';
      n.textContent = count.toLocaleString();
      b.append(n);
    }
    b.setAttribute('aria-current', current ? 'true' : 'false');
    b.addEventListener('click', () => current ? goHome() : goToCategory(cat));
    return b;
  };
  railEl.append(chip('Home', 'home', false));
  for (const [id, name] of CATEGORY_META) {
    const count = GAMES.filter(g => g.cs?.includes(id)).length;
    if (count < 4) continue;
    railEl.append(chip(name, id, currentRoute().view === 'collection' && currentRoute().c === id, count));
  }
}

function renderYou() {
  const wrap = $('#youRow');
  wrap.innerHTML = '';
  const sec = (label, list, emptyText) => {
    if (!list.length) return;
    const s = document.createElement('section');
    const h = document.createElement('h2');
    h.className = 'section-title';
    h.textContent = label;
    s.append(h);
    const row = document.createElement('div');
    row.className = 'rail';
    list.forEach(g => row.append(card(g)));
    s.append(row);
    wrap.append(s);
  };
  sec('Recently played', recent.map(r => byId.get(r.id)).filter(Boolean).slice(0, 18));
  sec('Your favorites', [...favs].map(id => byId.get(id)).filter(Boolean).slice(0, 18));
}

/* ---------- browse grid (lazy batches) ---------- */
const gridState = { list: [], shown: 0, batch: 120, active: false };

function setGrid(list) {
  gridState.list = list;
  gridState.shown = 0;
  $('#grid').innerHTML = '';
  $('#emptyState').hidden = list.length > 0;
  $('#catalogMeta').innerHTML = list.length
    ? `Showing <b>${list.length.toLocaleString()}</b> games`
    : '';
  showMore();
}
function showMore() {
  const { list, batch } = gridState;
  if (gridState.shown >= list.length) { $('#sentinel').hidden = true; return; }
  $('#sentinel').hidden = false;
  const frag = document.createDocumentFragment();
  const end = Math.min(gridState.shown + batch, list.length);
  for (let i = gridState.shown; i < end; i++) frag.append(card(list[i]));
  gridState.shown = end;
  $('#grid').append(frag);
}

/* ---------- filtered view ---------- */
function setFilteredView(list, title, extraMeta) {
  $('#homeView').hidden = true;
  $('#filteredView').hidden = false;
  $('#filteredTitle').textContent = title;
  const fg = $('#filteredGrid');
  fg.innerHTML = '';
  let shown = 0;
  const batch = 150;
  const sentinel = $('#filteredSentinel');
  const empty = $('#filteredEmpty');
  sentinel.hidden = false;
  empty.hidden = list.length > 0;
  const meta = document.createElement('p');
  meta.className = 'catalog-meta';
  meta.innerHTML = list.length
    ? (extraMeta || `Showing <b>${list.length.toLocaleString()}</b> games`)
    : '';
  $('#backBtn').insertAdjacentElement('afterend', meta);

  const fill = () => {
    const frag = document.createDocumentFragment();
    const end = Math.min(shown + batch, list.length);
    for (let i = shown; i < end; i++) frag.append(card(list[i]));
    shown = end;
    fg.append(frag);
    sentinel.hidden = shown >= list.length;
  };
  $('#filteredMoreBtn').onclick = fill;
  sentinel.hidden = true;
  fill();
}

function renderSearch(qRaw) {
  const q = qRaw.toLowerCase();
  const needle = q.replace(/[^a-z0-9 +]/gi, '');
  const score = (g) => {
    const t = g.t.toLowerCase();
    if (!needle) return 0;
    if (t === needle) return 100;
    if (t.startsWith(needle)) return 80;
    if (t.split(/[\s-]+/).some(w => w.startsWith(needle))) return 60;
    if (t.includes(needle)) return 40;
    if ((g.cs || []).some(c => c.includes(needle))) return 20;
    if ((g.a || '').toLowerCase().includes(needle)) return 15;
    return -1;
  };
  const hits = [];
  for (const g of GAMES) {
    const s = score(g);
    if (s > 0) hits.push([s, g]);
  }
  hits.sort((a, b) => b[0] - a[0] || (b[1].pc || 0) - (a[1].pc || 0));
  setFilteredView(hits.map(h => h[1]).slice(0, 900), `Search: ${qRaw}`, `Matches for “<b>${escapeHTML(qRaw)}</b>”`);
}
function escapeHTML(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- master render ---------- */
function render() {
  const route = currentRoute();
  const searching = route.view === 'search';
  const collecting = route.view === 'collection';
  $('#homeView').hidden = searching || collecting;
  $('#filteredView').hidden = !(searching || collecting);
  if (searching) renderSearch(route.q);
  else if (collecting) {
    const name = CAT_NAMES.get(route.c) || route.c;
    const list = GAMES.filter(g => g.cs?.includes(route.c));
    return setFilteredView(list, name);
  } else {
    renderHero();
    renderRails();
    renderCollections();
    renderYou();
    setGrid(GAMES);
  }
  if (route.view === 'home') window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ---------- boot ---------- */
async function boot() {
  $('#moreBtn').addEventListener('click', showMore);
  $('#backBtn').addEventListener('click', () => {
    if (history.length > 1) history.back(); else goHome();
  });
  $('#randomBtn').addEventListener('click', () => {
    const playable = GAMES.filter(g => g.p !== 'ex');
    const g = playable[Math.floor(Math.random() * playable.length)];
    if (g) location.href = `play.html?id=${encodeURIComponent(g.id)}`;
  });
  const searchInput = $('#search');
  searchInput.addEventListener('input', () => {
    const v = searchInput.value.trim();
    clearTimeout(boot._t);
    boot._t = setTimeout(() => {
      const prevWasSearch = currentRoute().view === 'search';
      if (v) goToSearch(v, prevWasSearch);
      else if (prevWasSearch) goHome();
    }, 130);
  });
  window.addEventListener('popstate', render);

  try {
    const res = await fetch('catalog/games.json?v=2026-10-30e');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    GAMES = data.games;
  } catch (e) {
    $('#main').innerHTML = '<p class="empty">The catalog failed to load — refresh in a moment.</p>';
    return;
  }
  byId = new Map(GAMES.map(g => [g.id, g]));
  countsReady = true;

  const total = document.getElementById('statTotal');
  if (total) total.textContent = GAMES.length.toLocaleString();
  const playable = document.getElementById('statPlayable');
  if (playable) playable.textContent = GAMES.filter(g => g.p !== 'ex').length.toLocaleString();

  render();
  // restore search text if arriving on a search route
  const r = currentRoute();
  if (r.view === 'search') $('#search').value = r.q;
}
boot();
