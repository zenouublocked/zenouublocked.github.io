/* Zenou Unblocked, homepage logic.
 * Single catalog file fetched once at boot; all views render from memory.
 * URL routes: index.html            -> home
 *             index.html?c=wheelie  -> collection view
 *             index.html?q=run      -> search results
 */
'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* count a number up instead of snapping, respects reduced motion */
function countUp(el, n) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || n < 10) { el.textContent = n.toLocaleString(); return; }
  const start = performance.now();
  const dur = 900;
  const step = (t) => {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(n * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* category chips inside the filter sheet */
function paintFilters() {
  const wrap = document.getElementById('filterCats');
  if (!wrap) return;
  wrap.innerHTML = '';
  CATEGORY_META.forEach(([id, label]) => {
    const n = GAMES.filter(g => (g.cs || []).includes(id)).length;
    if (n < 20) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filter-chip';
    b.textContent = `${label} · ${n.toLocaleString()}`;
    b.setAttribute('aria-pressed', String(browse.cats.includes(id)));
    b.addEventListener('click', () => {
      const i = browse.cats.indexOf(id);
      if (i >= 0) browse.cats.splice(i, 1); else browse.cats.push(id);
      b.setAttribute('aria-pressed', String(browse.cats.includes(id)));
      renderBrowse();
      paintFilters();
    });
    wrap.append(b);
  });
  $$('#filterPlays .filter-chip').forEach(x => x.setAttribute('aria-pressed', String((+x.dataset.min || 0) === browse.minPlays)));
  $$('#filterSize .filter-chip').forEach(x => x.setAttribute('aria-pressed', String((+x.dataset.size || 0) === browse.maxMb)));
  const btn = document.getElementById('filterBtn');
  if (btn) {
    const n = browse.cats.length + (browse.minPlays ? 1 : 0) + (browse.maxMb ? 1 : 0);
    btn.textContent = n ? `Filters · ${n}` : 'Filters';
  }
}

/* ---------- local storage ---------- */
const store = {
  get(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota, ignore */ } },
};
const favs = new Set(store.get('zenou_fav', []));
let recent = store.get('zenou_recent', []).filter(r => typeof r?.id === 'string');

/* ---------- catalog state ---------- */
let GAMES = [];
let byId = new Map();
let countsReady = false;

/* browse controls (persisted) */
const BROWSE_KEY = 'zenou_browse';
const browse = Object.assign(
  { sort: 'featured', src: 'all', adFree: false, cats: [], minPlays: 0, maxMb: 0 },
  store.get(BROWSE_KEY, {}),
);
if (!Array.isArray(browse.cats)) browse.cats = [];

/* ratings + hidden lists come from the shared layer (js/zenou-plus.js) */
function ratingsMap() { return (window.Zenou && window.Zenou.store.ratings) || store.get('zenou_ratings', {}) || {}; }
function hiddenSet() { return (window.Zenou && window.Zenou.store.hidden) || new Set(store.get('zenou_hidden', []) || []); }
const shuffleSeed = Math.random();

function browseList() {
  const hidden = hiddenSet();
  const rated = ratingsMap();
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem('zenou_prefs') || '{}') || {}; } catch { /* ignore */ }
  let list = GAMES.filter(g => !hidden.has(g.id));
  if (browse.src === 'publisher') list = list.filter(g => g.p === 'pf');
  else if (browse.src !== 'all') list = list.filter(g => g.s === browse.src);
  if (browse.adFree) list = list.filter(g => g.p !== 'pg');
  if (browse.cats.length) list = list.filter(g => browse.cats.some(c => (g.cs || []).includes(c)));
  if (browse.minPlays) list = list.filter(g => (g.pc || 0) >= browse.minPlays);
  if (browse.maxMb) list = list.filter(g => g.mb != null && g.mb <= browse.maxMb);

  switch (browse.sort) {
    case 'az': list.sort((a, b) => a.t.localeCompare(b.t)); break;
    case 'za': list.sort((a, b) => b.t.localeCompare(a.t)); break;
    case 'source': list.sort((a, b) => a.s.localeCompare(b.s) || (b.pc || 0) - (a.pc || 0)); break;
    case 'popular': list.sort((a, b) => (b.pc || 0) - (a.pc || 0)); break;
    case 'rated': list.sort((a, b) => (rated[b.id] || 0) - (rated[a.id] || 0)); break;
    case 'smallest': list.sort((a, b) => (a.mb ?? 999) - (b.mb ?? 999)); break;
    case 'largest': list.sort((a, b) => (b.mb ?? -1) - (a.mb ?? -1)); break;
    case 'shuffle': list.sort((a, b) => ((a.id.charCodeAt(0) * 7 + a.id.length) % 97) - ((b.id.charCodeAt(0) * 7 + b.id.length) % 97) || shuffleSeed - 0.5); break;
    default: break;
  }
  return list;
}
function renderBrowse() {
  store.set(BROWSE_KEY, browse);
  setGrid(browseList());
}

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
  ['hoodamath', 'HoodaMath'],
  ['selfhosted', 'Self-hosted'],
];
const CAT_NAMES = new Map(CATEGORY_META);
const CAT_ORDER = CATEGORY_META.map(c => c[0]);
const SOURCE_BADGES = { 'crazygames-official': 'CrazyGames', hoodamath: 'HoodaMath', scratch: 'Scratch', selfhosted: 'Hosted here', gamedistribution: 'GameDistribution', publisher: 'Publisher' };

const RAILS = [
  { title: 'Instant start, no pre-roll', filter: g => g.p !== 'pg', max: 24 },
  { title: 'Wheelie & bike collection', cats: ['wheelie', 'motorcycle'], max: 24 },
  { title: 'Drifting & racing', cats: ['drift', 'racing'], max: 24 },
  { title: '3D driving arcade', cats: ['driving-3d', 'stunt'], max: 24 },
  { title: 'Multiplayer & .io', cats: ['multiplayer', 'io'], max: 24 },
  { title: 'Escape & horror', cats: ['horror', 'adventure'], max: 24 },
  { title: 'Scratch creators', cats: ['scratch'], max: 24 },
];

/* curated featured ids, all verified playable in-page */
const FEATURED_IDS = [
  'sc-1231016758', 'cg-moto-x3m', 'cg-snow-rider-3d',
  'cg-tanuki-sunset', 'hm-ovo', 'hm-run3', 'lo-clumsy-bird',
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
  a.href = g.direct ? g.direct : `play.html?id=${encodeURIComponent(g.id)}`;
  a.setAttribute('aria-label', `${g.t}, ${SOURCE_BADGES[g.s] || 'game'}`);

  const badge = document.createElement('span');
  badge.className = 'card-src';
  badge.dataset.src = g.p === 'hm' ? 'hoodamath' : g.s;
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

  const mine = ratingsMap()[g.id];
  if (mine) {
    const stars = document.createElement('span');
    stars.className = 'card-rating';
    stars.textContent = '★'.repeat(mine);
    a.append(stars);
  }

  // a creator credit means something; a category repeated on every tile does not
  if (g.s === 'scratch') {
    const sub = document.createElement('span');
    sub.className = 'card-sub';
    sub.textContent = `by ${g.a || 'Scratch creator'}`;
    a.append(sub);
  }

  if (badge.textContent) a.append(badge);

  const hide = document.createElement('button');
  hide.type = 'button';
  hide.className = 'card-x';
  hide.title = 'Not interested, hide this game';
  hide.setAttribute('aria-label', `Hide ${g.t}`);
  hide.innerHTML = '&times;';
  hide.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.Zenou) window.Zenou.hideGame(g.id, g.t);
    else {
      store.set('zenou_hidden', [...hiddenSet(), g.id]);
    }
    a.remove();
  });
  a.append(hide);
  return a;
}

/* the featured banner is full width, so ask the CDN for a larger copy of the thumb */
function bigThumb(src) {
  if (!src) return '';
  return src.replace(/width=\d+/, 'width=1280');
}

function catOf(g) { return g.cs && g.cs[0] || 'arcade'; }

/* the first real genre, not the source tag we also keep in cs */
const SOURCE_TAGS = new Set(['hoodamath', 'crazygames', 'scratch', 'selfhosted', 'publisher']);
function genreOf(g) {
  const c = (g.cs || []).find(x => !SOURCE_TAGS.has(x));
  return (c || 'HoodaMath').replace(/-/g, ' ');
}
function fmtPlays(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  String(n);
  return String(n);
}

/* ---------- home view ---------- */
function heroImage(g) {
  const src = bigThumb(g.img) || '';
  return src;
}

function renderHero() {
  const heroCard = $('#heroCard');
  const side = $('#heroSide');
  if (!heroCard) return;

  const feat = FEATURED_IDS.map(id => byId.get(id)).filter(Boolean);
  const bigs = (feat.length ? feat : GAMES.filter(g => g.img).slice(0, 6)).slice(0, 6);
  const paint = (g) => {
    heroCard.hidden = false;
    heroCard.href = `play.html?id=${encodeURIComponent(g.id)}`;
    heroCard.innerHTML = '';
    const img = document.createElement('img');
    img.src = heroImage(g);
    img.alt = '';
    img.decoding = 'async';
    img.onerror = () => img.remove();
    const body = document.createElement('div');
    body.className = 'lp-feature-body';
    body.innerHTML = '<span class="lp-feature-kicker">Pick of the night</span><h2 class="lp-feature-title"></h2><p class="lp-feature-meta"></p><span class="lp-feature-play">Play now<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg></span>';
    body.querySelector('.lp-feature-title').textContent = g.t;
    body.querySelector('.lp-feature-meta').textContent = `${SOURCE_BADGES[g.s] || 'In-page'} · ${genreOf(g)}`;
    heroCard.append(img, body);
  };

  if (!bigs.length) heroCard.hidden = true;
  else paint(bigs[0]);

  side.innerHTML = '';
  bigs.slice(1, 3).forEach(g => {
    const a = document.createElement('a');
    a.className = 'lp-mini';
    a.href = `play.html?id=${encodeURIComponent(g.id)}`;
    a.innerHTML = '<img alt="" loading="lazy" decoding="async"><span class="lp-mini-copy"><b></b><small></small></span>';
    const img = a.querySelector('img');
    img.src = heroImage(g);
    img.onerror = () => img.remove();
    a.querySelector('b').textContent = g.t;
    a.querySelector('small').textContent = `${SOURCE_BADGES[g.s] || 'In-page'} · ${genreOf(g)}`;
    side.append(a);
  });

  clearInterval(renderHero._timer);
  if (bigs.length > 1) {
    let idx = 0;
    renderHero._timer = setInterval(() => {
      if (document.hidden) return;
      idx = (idx + 1) % bigs.length;
      if (heroCard.querySelector('img')) heroCard.classList.add('is-swapping');
      paint(bigs[idx]);
      requestAnimationFrame(() => heroCard.classList.remove('is-swapping'));
    }, 6500);
  }

  /* wheelie builds from Scratch, Soflo first, then the busiest projects */
  const list = $('#heroList');
  if (!list) return;
  list.innerHTML = '';
  const wheelie = GAMES
    .filter(g => g.p === 'sc' && g.img && (g.cs || []).includes('wheelie'))
    .sort((a, b) => (b.pc || 0) - (a.pc || 0))
    .slice(0, 8);
  wheelie.forEach(g => {
    const a = document.createElement('a');
    a.className = 'lp-fresh';
    a.href = `play.html?id=${encodeURIComponent(g.id)}`;
    a.innerHTML = '<img alt="" loading="lazy" decoding="async"><span class="lp-fresh-copy"><b></b><small></small></span>';
    const img = a.querySelector('img');
    img.src = g.img;
    img.onerror = () => img.remove();
    a.querySelector('b').textContent = g.t;
    a.querySelector('small').textContent = genreOf(g);
    list.append(a);
  });
}

function renderVibes() {
  const wrap = $('#lpVibes');
  if (!wrap) return;
  const VIBES = [
    ['racing', 'Racing', 'drift · track · karts'],
    ['motorcycle', 'Moto & wheelie', 'bikes · balance · speed'],
    ['stunt', 'Stunts', 'flips · jumps · crashes'],
    ['runner', 'Runners', 'escape · parkour · endless'],
    ['multiplayer', 'Multiplayer', '.io · 2 player · online'],
    ['horror', 'Horror', 'night · ghosts · survival'],
    ['sports', 'Sports', 'soccer · hoops · golf'],
    ['puzzle', 'Puzzle', 'logic · blocks · brain teasers'],
  ];
  wrap.innerHTML = '';
  VIBES.forEach(([cat, label, sub], i) => {
    const pool = GAMES.filter(g => (g.cs || []).includes(cat));
    if (!pool.length) return;
    const art = pool.find(g => g.img && g.p === 'sc') || pool.find(g => g.img && g.p !== 'hm') || pool.find(g => g.img) || pool[0];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lp-vibe';
    b.style.setProperty('--vbg', art.img ? `url("${art.img.replace(/"/g, '%22')}")` : 'none');
    b.innerHTML = '<span class="lp-vibe-wash" aria-hidden="true"></span><span class="lp-vibe-copy"><b></b><small></small></span><span class="lp-vibe-foot"><i></i> collection</span>';
    b.querySelector('b').textContent = label;
    b.querySelector('small').textContent = sub;
    b.querySelector('i').textContent = `${pool.length.toLocaleString()} games`;
    b.style.setProperty('--vdelay', `${i * 45}ms`);
    b.addEventListener('click', () => goToCategory(cat));
    wrap.append(b);
  });

  const quick = $('#lpQuick');
  if (quick) {
    quick.innerHTML = '';
    [['Moto X3M', 'index.html?q=moto x3m'], ['Drift', 'index.html?c=drift'], ['2 player', 'index.html?c=multiplayer'], ['No ads', 'index.html?c=noads'], ['Scratch', 'index.html?c=scratch']].forEach(([label, href]) => {
      const a = document.createElement('a');
      a.className = 'lp-quick-link';
      a.href = href;
      a.textContent = label;
      quick.append(a);
    });
  }
}

function renderChart() {
  const wrap = $('#lpChart');
  if (!wrap) return;
  const top = GAMES.filter(g => g.pc > 0).sort((a, b) => b.pc - a.pc).slice(0, 10);
  wrap.innerHTML = '';
  top.forEach((g, i) => {
    const a = document.createElement('a');
    a.className = 'lp-rank';
    a.href = `play.html?id=${encodeURIComponent(g.id)}`;
    a.innerHTML = '<span class="lp-rank-n"></span><span class="lp-rank-art"></span><span class="lp-rank-copy"><b></b><small></small></span><span class="lp-rank-go" aria-hidden="true">▶</span>';
    a.querySelector('.lp-rank-n').textContent = String(i + 1).padStart(2, '0');
    a.querySelector('.lp-rank-copy b').textContent = g.t;
    a.querySelector('.lp-rank-copy small').textContent = `${SOURCE_BADGES[g.s] || 'In-page'} · ${fmtPlays(g.pc)} plays`;
    const art = a.querySelector('.lp-rank-art');
    if (g.img) {
      const img = document.createElement('img');
      img.src = g.img; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.onerror = () => img.remove();
      art.append(img);
    }
    wrap.append(a);
  });
}

function matchesAny(g, cats) { return cats.some(c => g.cs && g.cs.includes(c)); }

function renderRails() {
  const wrap = $('#railWrap');
  wrap.innerHTML = '';

  /* personalised rails first, only when there is something to show */
  for (const extra of personalRails()) {
    const sec = document.createElement('section');
    const head = document.createElement('div');
    head.className = 'section-head-with-link';
    const h = document.createElement('h2');
    h.className = 'section-title';
    h.textContent = extra.title;
    head.append(h);
    if (extra.action) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.type = 'button';
      b.innerHTML = '<span>See all</span>';
      b.addEventListener('click', extra.action.run);
      head.append(b);
    }
    sec.append(head);
    const row = document.createElement('div');
    row.className = 'rail';
    extra.list.slice(0, 24).forEach(g => row.append(card(g)));
    if (row.children.length) { sec.append(row); wrap.append(sec); }
  }

  for (const rail of RAILS) {
    const picks = rail.filter
      ? GAMES.filter(g => !hiddenSet().has(g.id) && rail.filter(g))
      : GAMES.filter(g => matchesAny(g, rail.cats));
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
    all.addEventListener('click', () => goToCategory(rail.filter ? 'noads' : rail.cats[0]));
    titleGrid.append(h, all);
    sec.append(titleGrid);

    const row = document.createElement('div');
    row.className = 'rail';
    const cover = (rail.filter ? picks : firstCategoryOverlap(picks, rail.cats)).slice(0, rail.max);
    cover.forEach(g => row.append(card(g)));
    sec.append(row);
    wrap.append(sec);
  }
}

/* ---------- personalised shelves ---------- */
function personalRails() {
  const hidden = hiddenSet();
  const rated = ratingsMap();
  const out = [];
  const seen = new Set(recent.map(r => r.id));

  const cont = recent.map(r => byId.get(r.id)).filter(Boolean).slice(0, 12);
  if (cont.length >= 2) out.push({ title: 'Continue playing', list: cont });

  const mine = Object.keys(rated).map(id => byId.get(id)).filter(Boolean).sort((a, b) => rated[b.id] - rated[a.id]);
  if (mine.length >= 2) out.push({ title: 'Top rated by you', list: mine });

  const last = recent.length ? byId.get(recent[0].id) : null;
  if (last && last.cs && last.cs.length) {
    const cat = last.cs[0];
    const more = GAMES.filter(g => g.id !== last.id && !hidden.has(g.id) && !seen.has(g.id) && (g.cs || []).includes(cat));
    if (more.length >= 4) {
      out.push({
        title: `Because you played ${last.t}`,
        list: more.slice(0, 24),
        action: { run: () => goToCategory(cat) },
      });
    }
  }

  const gems = GAMES.filter(g => !hidden.has(g.id) && g.pc != null && g.pc > 0 && g.pc < 25000);
  if (gems.length >= 8) {
    out.push({
      title: 'Hidden gems, under 25k plays',
      list: gems.sort((a, b) => (b.pc || 0) - (a.pc || 0)).slice(0, 24),
    });
  }

  const instant = GAMES.filter(g => !hidden.has(g.id) && g.p !== 'pg' && g.pc > 0);
  if (instant.length >= 8) {
    out.push({
      title: 'Instant start, no pre-roll, no portal shell',
      list: instant.sort((a, b) => (b.pc || 0) - (a.pc || 0)).slice(0, 24),
      action: { run: () => goToCategory('noads') },
    });
  }
  return out;
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
  const adFree = GAMES.filter(g => g.p !== 'pg').length;
  railEl.append(chip('No pre-roll ads', 'noads', currentRoute().view === 'collection' && currentRoute().c === 'noads', adFree));
  for (const [id, name] of CATEGORY_META) {
    const count = GAMES.filter(g => g.cs?.includes(id)).length;
    if (count < 4) continue;
    railEl.append(chip(name, id, currentRoute().view === 'collection' && currentRoute().c === id, count));
  }
}

/* ---------- landing extras ---------- */
function renderLanding() {
  const count = document.getElementById('lpCount');
  if (count) count.textContent = GAMES.length.toLocaleString();
  renderVibes();
  renderChart();
}

function renderYou() {
  const wrap = $('#youRow');
  wrap.innerHTML = '';
  const sec = (label, list, action) => {
    if (!list.length) return;
    const s = document.createElement('section');
    const head = document.createElement('div');
    head.className = 'section-head-with-link';
    const h = document.createElement('h2');
    h.className = 'section-title';
    h.textContent = label;
    head.append(h);
    if (action) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.type = 'button';
      b.innerHTML = '<span>Open</span>';
      b.addEventListener('click', action);
      head.append(b);
    }
    s.append(head);
    const row = document.createElement('div');
    row.className = 'rail';
    list.forEach(g => row.append(card(g)));
    s.append(row);
    wrap.append(s);
  };
  const hidden = hiddenSet();
  sec('Your favorites', [...favs].map(id => byId.get(id)).filter(g => g && !hidden.has(g.id)), () => location.href = 'library.html');
  sec('Recently played', recent.map(r => byId.get(r.id)).filter(g => g && !hidden.has(g.id)).slice(0, 18), () => location.href = 'library.html');

  /* user playlists as shelves */
  const store2 = window.Zenou ? window.Zenou.store : null;
  if (store2) {
    store2.playlists.slice(0, 3).forEach(pl => {
      const list = pl.ids.map(id => byId.get(id)).filter(Boolean);
      sec(`Playlist, ${pl.name}`, list, () => location.href = 'library.html#playlists');
    });
  }
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
  const oldMeta = $('#filteredView').querySelector('.catalog-meta');
  if (oldMeta) oldMeta.remove();
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
    if (route.c === 'noads') {
      const list = GAMES.filter(g => g.p !== 'pg');
      return setFilteredView(list, 'No pre-roll ads');
    }
    const name = CAT_NAMES.get(route.c) || route.c;
    const list = GAMES.filter(g => g.cs?.includes(route.c));
    return setFilteredView(list, name);
  } else {
    renderHero();
    renderVibes();
    renderChart();
    renderRails();
    renderCollections();
    renderYou();
    setGrid(browseList());
  }
  if (route.view === 'home') window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ---------- boot ---------- */
async function boot() {
  $('#moreBtn').addEventListener('click', showMore);
  $('#backBtn').addEventListener('click', () => {
    if (history.length > 1) history.back(); else goHome();
  });
  const rollRandom = () => {
    const playable = browseList();
    if (!playable.length) return;
    const g = playable[Math.floor(Math.random() * playable.length)];
    location.href = `play.html?id=${encodeURIComponent(g.id)}`;
  };
  $('#randomBtn').addEventListener('click', rollRandom);
  $('#lpRandom')?.addEventListener('click', rollRandom);
  $('#lpFreshAll')?.addEventListener('click', () => goToCategory('wheelie'));

  /* browse controls */
  const sortSel = $('#sortSel'), srcSel = $('#srcSel'), adFreeBtn = $('#adFreeToggle');
  if (sortSel && srcSel && adFreeBtn) {
    sortSel.value = browse.sort;
    srcSel.value = browse.src;
    adFreeBtn.setAttribute('aria-pressed', String(!!browse.adFree));
    sortSel.addEventListener('change', () => { browse.sort = sortSel.value; renderBrowse(); });
    srcSel.addEventListener('change', () => { browse.src = srcSel.value; renderBrowse(); });
    adFreeBtn.addEventListener('click', () => {
      browse.adFree = !browse.adFree;
      adFreeBtn.setAttribute('aria-pressed', String(browse.adFree));
      renderBrowse();
    });
  }

  /* filter sheet */
  const filterBtn = $('#filterBtn'), filterPanel = $('#filterPanel');
  if (filterBtn && filterPanel) {
    filterBtn.addEventListener('click', () => {
      const open = filterPanel.hidden;
      filterPanel.hidden = !open;
      filterBtn.setAttribute('aria-expanded', String(open));
      filterBtn.setAttribute('aria-pressed', String(open));
    });
    $('#filterDone')?.addEventListener('click', () => {
      filterPanel.hidden = true;
      filterBtn.setAttribute('aria-expanded', 'false');
      filterBtn.setAttribute('aria-pressed', 'false');
    });
    $('#filterReset')?.addEventListener('click', () => {
      browse.cats = []; browse.minPlays = 0; browse.maxMb = 0;
      paintFilters();
      renderBrowse();
    });
    $$('#filterPlays .filter-chip').forEach(b => b.addEventListener('click', () => {
      browse.minPlays = +b.dataset.min || 0;
      $$('#filterPlays .filter-chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderBrowse();
    }));
    $$('#filterSize .filter-chip').forEach(b => b.addEventListener('click', () => {
      browse.maxMb = +b.dataset.size || 0;
      $$('#filterSize .filter-chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderBrowse();
    }));
  }

  /* list / grid view */
  const viewBtn = $('#viewBtn');
  const paintView = () => {
    const v = document.documentElement.dataset.view === 'list' ? 'list' : 'grid';
    if (viewBtn) viewBtn.textContent = v === 'list' ? 'Grid view' : 'List view';
  };
  viewBtn?.addEventListener('click', () => {
    const next = document.documentElement.dataset.view === 'list' ? 'grid' : 'list';
    document.documentElement.dataset.view = next;
    try { localStorage.setItem('zenou_view', JSON.stringify(next)); } catch { /* ignore */ }
    paintView();
  });
  paintView();

  /* search and random keys live in zenou-plus, where they can be rebound */
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
    const res = await fetch('catalog/games.json?v=2026-10-30k');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    GAMES = data.games;
  } catch (e) {
    $('#main').innerHTML = '<p class="empty">The catalog failed to load, refresh in a moment.</p>';
    return;
  }
  byId = new Map(GAMES.map(g => [g.id, g]));
  countsReady = true;

  const total = document.getElementById('statTotal');
  if (total) countUp(total, GAMES.length);
  const adFreeStat = document.getElementById('statAdFree');
  if (adFreeStat) countUp(adFreeStat, GAMES.filter(g => g.p !== 'pg').length);

  paintFilters();
  renderLanding();
  render();
  // restore search text if arriving on a search route
  const r = currentRoute();
  if (r.view === 'search') $('#search').value = r.q;
}
boot();
