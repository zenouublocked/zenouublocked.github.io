/* Zenou Unblocked — public metadata catalogue (movies & TV).
 *
 * Provider: TMDB's documented public REST API, fetched at build time into
 * data/ent/*.json (run scripts/fetch-tmdb.mjs to refresh). The site itself
 * never loads the API key in a browser. IMDb remains the discovery reference;
 * TMDB is the documented metadata alternative, kept configurable here.
 */
'use strict';

const TMDB = {
  kind: 'movie',                 // set per page
  data: null,                    // { v, genre, rails, items }
  details: null,                 // detail.json (sparse)

  img(size, p) { if (!p) return ''; return `https://image.tmdb.org/t/p/${size}${p}`; },

  async load() {
    if (this.data) return this.data;
    try {
      const [idx, det, upd] = await Promise.all([
        fetch(`data/ent/${this.kind === 'tv' ? 'tv' : 'movies'}.json`).then(r => r.ok ? r.json() : null),
        fetch('data/ent/detail.json').then(r => r.ok ? r.json() : null),
        fetch('data/ent/updated.json').then(r => r.ok ? r.json() : null),
      ]);
      this.data = idx; this.details = det || {};
      if (upd) { this.updated = upd; try { localStorage.setItem('zenou_ent_stamp', JSON.stringify(upd)); } catch { /* */ } }
    } catch { this.data = null; }
    return this.data;
  },  updatedAt() {
    return this.updated || (() => { try { return JSON.parse(localStorage.getItem('zenou_ent_stamp') || 'null'); } catch { return null; } })();
  },

  byId(id) {
    const n = String(id).replace(/^[a-z]+/, '');
    return (this.data && this.data.items.find(x => x.id === id || x.id.endsWith(n))) || null;
  },
  detailOf(id) { return this.details && this.details[id]; },

  genreNames(ids) {
    return (ids || []).map(i => this.data.genre[i]).filter(Boolean);
  },
};

/* ---------- render helpers (shared with movies/tv/library/search) ---------- */
function mcard(m, { meta } = {}) {
  const a = document.createElement('a');
  a.className = 'mcard';
  a.href = entryHref(m);
  a.setAttribute('aria-label', `${m.t}${meta ? ' — ' + meta : ''}`);

  const img = document.createElement('img');
  img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
  img.src = m.imgBig || m.img || m.imgSmall || '';
  img.onerror = () => a.remove();
  a.append(img);

  if (meta || m.r) {
    const badge = document.createElement('span');
    badge.className = 'mmeta';
    badge.textContent = meta || (m.r ? '★ ' + m.r : '');
    a.append(badge);
  }
  const play = document.createElement('span');
  play.className = 'mplay';
  play.innerHTML = '<i></i>';
  const name = document.createElement('span');
  name.className = 'mname';
  name.textContent = m.t;
  a.append(play, name);
  return a;
}

function mrail(title, items, { meta } = {}) {
  if (!items.length) return null;
  const wrap = document.createElement('div');
  const head = document.createElement('div');
  head.className = 'mhead';
  const h = document.createElement('h2');
  h.textContent = title;
  head.append(h);
  wrap.append(head);
  const rail = document.createElement('div');
  rail.className = 'mrail';
  items.forEach(m => rail.append(mcard(m, meta)));
  wrap.append(rail);
  return wrap;
}

function stampText() {
  const s = TMDB.updatedAt();
  return s && s.built ? `Catalog updated ${s.built.slice(0, 16).replace('T', ' ')} UTC` : '';
}

/* ---------- page boot for movies.html / tv.html ---------- */
async function bootEntPage() {
  const root = $('#rails');
  root.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const sk = document.createElement('div');
    sk.className = 'skl';
    sk.style.cssText = 'display:inline-block;width:148px;margin-right:14px';
    root.append(sk);
  }

  const loaded = await TMDB.load();
  root.innerHTML = '';

  // genre filter chips
  const RAIL_TITLES = TMDB.kind === 'tv'
    ? { trending: 'Trending now', popular: 'Popular TV shows', air: 'New episodes this week', top: 'Top rated', upcoming: '' }
    : { trending: 'Trending now', popular: 'Popular movies', upcoming: 'Upcoming releases', top: 'Top rated', air: '' };

  const genres = [];
  if (loaded) {
    document.querySelectorAll('.stamp').forEach(s => s.textContent = stampText());
    // present fresh rails with "updated" stamp
    const head0 = document.createElement('div');
    head0.className = 'mhead';
    const h0 = document.createElement('h2');
    h0.textContent = TMDB.kind === 'tv' ? 'TV shows' : 'Movies';
    const st = document.createElement('span');
    st.className = 'stamp';
    st.textContent = stampText();
    head0.append(h0, st);
    root.append(head0);

    for (const k of ['trending', 'popular', 'upcoming', 'air', 'top']) {
      const title = RAIL_TITLES[k];
      if (!title) continue;
      const items = (TMDB.data.rails[k] || []);
      const rail = mrail(title, items.slice(0, 20));
      if (rail) root.append(rail);
    }
    genres.push(...Object.values(TMDB.data.genre).slice(0, 22));
  }

  // genre chips for the big grid
  const chipRow = document.createElement('div');
  chipRow.className = 'chip-row';
  chipRow.style.margin = '26px 0 14px';
  chipRow.append(chip('All', '', true));
  genres.forEach(gn => chipRow.append(chip(gn, gn)));
  root.append(chipRow);

  const gridWrap = document.createElement('div');
  gridWrap.className = 'mgrid';
  gridWrap.id = 'catalogGrid';
  root.append(gridWrap);

  if (loaded) {
    updateGrid('');
    function updateGrid(g) {
      const items = TMDB.data.items.filter(m => !g || TMDB.genreNames(m.g).includes(g));
      gridWrap.innerHTML = '';
      items.slice(0, 48).forEach(m => gridWrap.append(mcard(m)));
    }
  }

  function chip(label, val, on) {
    const b = document.createElement('a');
    b.className = 'chip' + (on ? ' on' : '');
    b.href = `#${encodeURIComponent(val)}`;
    b.textContent = label;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      [...chipRow.children].forEach(c => c.classList.toggle('on', c === b));
      history.replaceState(null, '', val ? `#${encodeURIComponent(val)}` : '#');
      if (loaded) updateGrid(val);
    });
    return b;
  }

  if (!loaded) {
    root.prepend(setupCard());
    return;
  }
}

function setupCard() {
  const d = document.createElement('div');
  d.className = 'setup-note';
  d.innerHTML = `
    <h2>Activate the full catalogue</h2>
    <p>The trending/popular rails are cached from TMDB’s documented API at build time — the key is never shipped with the site. Create a free account at themoviedb.org, grab an API key, then run this once from the repo:</p>
    <p><code>TMDB_API_KEY=[your key] node scripts/fetch-tmdb.mjs</code></p>`;
  return d;
}
