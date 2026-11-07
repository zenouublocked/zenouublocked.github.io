/* ZenouMath, movie and TV discovery.
 *
 * The page is a thin client over /api: the server owns the TMDB key, the cache
 * and the shaping, and this file owns everything the visitor sees. Every state
 * is explicit, including the ones that are not the happy path:
 *
 *   no API at all      a setup card, not a spinner that never ends
 *   API, no TMDB key   a setup card with the exact two lines to add
 *   upstream failure   an inline notice with a retry
 *   empty search       a sentence, not a blank box
 */
'use strict';

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const UI = window.ZenouTMDB;

  const state = {
    config: null,
    kind: 'movie',
    genre: '',
    sort: 'popularity.desc',
    genres: [],
    page: 0,
    pages: 1,
    loading: false,
    heroId: null,
    query: '',
    hits: [],
    hitIndex: -1,
    searchSeq: 0,
  };

  const RAILS = [
    { id: 'trending', type: 'movie', feed: 'trending', title: 'Trending films', sub: 'This week' },
    { id: 'popular-tv', type: 'tv', feed: 'popular', title: 'Popular series', sub: 'Most watched right now' },
    { id: 'upcoming', type: 'movie', feed: 'upcoming', title: 'Coming soon', sub: 'Cinema releases' },
    { id: 'now', type: 'movie', feed: 'now_playing', title: 'In cinemas', sub: 'Playing now' },
    { id: 'airing', type: 'tv', feed: 'airing_today', title: 'Airing today', sub: 'New episodes' },
    { id: 'top', type: 'movie', feed: 'top_rated', title: 'Top rated', sub: 'All time' },
    { id: 'onair', type: 'tv', feed: 'on_the_air', title: 'Still running', sub: 'Series with new episodes ahead' },
  ];

  const KIND_KEY = 'zenou_discover_kind';

  /* ---------------- api ---------------- */

  class ApiError extends Error {
    constructor(message, { status = 0, code = 'error', setup = false } = {}) {
      super(message);
      this.status = status;
      this.code = code;
      this.setup = setup;
    }
  }

  async function api(path) {
    let res;
    try {
      res = await fetch(path, { headers: { accept: 'application/json' } });
    } catch {
      throw new ApiError('The Zenou server is not answering.', { code: 'offline' });
    }

    if (res.status === 404) {
      // A static host answers 404 for /api, which is the deployment case rather
      // than a bug in this page.
      throw new ApiError('This page is running without its API.', { status: 404, code: 'no_api' });
    }

    let body = null;
    try { body = await res.json(); } catch { /* html error page */ }

    if (!res.ok) {
      throw new ApiError(body?.message || `Request failed (HTTP ${res.status}).`, {
        status: res.status,
        code: body?.error || 'http_error',
        setup: Boolean(body?.setup),
      });
    }
    return body;
  }

  /* ---------------- rails ---------------- */

  function railShell({ title, sub }) {
    const section = document.createElement('section');
    section.className = 'dc-rail';
    section.innerHTML =
      `<div class="dc-rail-head">
         <h2></h2>
         <span class="dc-rail-sub"></span>
         <div class="dc-rail-nav">
           <button type="button" data-dir="-1" aria-label="Scroll back">‹</button>
           <button type="button" data-dir="1" aria-label="Scroll forward">›</button>
         </div>
       </div>
       <div class="dc-track"></div>`;
    section.querySelector('h2').textContent = title;
    section.querySelector('.dc-rail-sub').textContent = sub || '';
    return section;
  }

  function wireRailNav(section) {
    const track = section.querySelector('.dc-track');
    const [back, fwd] = $$('.dc-rail-nav button', section);
    const step = () => Math.max(220, track.clientWidth * 0.8);
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth;
      back.disabled = track.scrollLeft <= 2;
      fwd.disabled = track.scrollLeft >= max - 2;
    };
    back.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    fwd.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', sync, { passive: true });
    track.addEventListener('load', sync, true);
    requestAnimationFrame(sync);
    window.addEventListener('resize', sync);
  }

  async function paintRails() {
    const host = $('#rails');
    host.innerHTML = '';

    const sections = RAILS.map(rail => {
      const section = railShell(rail);
      const track = section.querySelector('.dc-track');
      for (let i = 0; i < 5; i += 1) track.append(UI.skeletonCard());
      host.append(section);
      wireRailNav(section);
      return { rail, section, track };
    });

    // Sequential by design: seven rails at once would spend the visitor's
    // bandwidth on posters they may never scroll to.
    for (const entry of sections) {
      try {
        const data = await api(`/api/feed?type=${entry.rail.type}&feed=${entry.rail.feed}&page=1`);
        entry.track.innerHTML = '';
        if (!data.results.length) {
          entry.section.remove();
          continue;
        }
        for (const item of data.results) entry.track.append(UI.posterCard(item));
        entry.section.querySelector('.dc-rail-sub').textContent =
          `${entry.rail.sub || ''}${entry.rail.sub ? ' · ' : ''}${data.results.length}`;
      } catch (e) {
        if (e.setup) return;
        entry.section.remove();
      }
    }
  }

  /* ---------------- hero ---------------- */

  async function paintHero() {
    const hero = $('#hero');
    let data;
    try {
      data = await api('/api/feed?type=movie&feed=trending&page=1');
    } catch {
      hero.classList.add('is-ready');
      $('#heroTitle').textContent = 'Discovery needs its API';
      $('#heroLede').textContent = 'Start the Zenou server to load TMDB content, or open the direct-source shelf below.';
      // A dead "Watch now" on the setup screen would be a lie; the two buttons
      // become the two things a visitor without a key can actually do.
      const watch = $('#heroWatch');
      const more = $('#heroMore');
      watch.textContent = 'Open the shelf';
      watch.href = '/sources';
      more.textContent = 'How to set it up';
      more.href = '#setup';
      return;
    }

    const pick = data.results.find(r => r.backdrop) || data.results[0];
    if (!pick) return;

    state.heroId = `${pick.type}:${pick.id}`;
    const backdrop = UI.img(pick.backdrop, 'w1280') || UI.img(pick.backdrop, 'original');
    if (backdrop) {
      const image = $('#heroImg');
      image.addEventListener('load', () => hero.classList.add('is-ready'), { once: true });
      image.src = backdrop;
    } else {
      hero.classList.add('is-ready');
    }

    $('#heroTitle').textContent = pick.title;
    UI.fillMeta($('#heroMeta'), pick);
    $('#heroLede').textContent = pick.overview || 'No synopsis yet for this title.';
    $('#heroWatch').href = `/title?type=${pick.type}&id=${pick.id}`;
    $('#heroMore').href = `/title?type=${pick.type}&id=${pick.id}`;
  }

  /* ---------------- browse grid ---------------- */

  function gridShell(count) {
    const grid = $('#grid');
    grid.innerHTML = '';
    for (let i = 0; i < count; i += 1) grid.append(UI.skeletonCard());
  }

  function paintFilters() {
    $$('#filters button').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.kind === state.kind));
    });
    const sort = $('#sort');
    if (sort) {
      // Date sorts only exist per type; keep the list honest.
      const dateOption = sort.querySelector('option[value^="primary_release_date"]');
      if (dateOption) {
        dateOption.value = state.kind === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc';
      }
      sort.value = state.sort.startsWith('primary') || state.sort.startsWith('first_air')
        ? dateOption?.value || 'popularity.desc'
        : state.sort;
    }
  }

  async function paintGenres() {
    const select = $('#genre');
    if (!select) return;
    try {
      const data = await api(`/api/genres?type=${state.kind}`);
      state.genres = data.genres;
    } catch {
      state.genres = [];
    }
    const keep = state.genre;
    select.innerHTML = '<option value="">All genres</option>';
    for (const g of state.genres) {
      const opt = document.createElement('option');
      opt.value = String(g.id);
      opt.textContent = g.name;
      select.append(opt);
    }
    select.value = state.genres.some(g => String(g.id) === keep) ? keep : '';
    state.genre = select.value;
  }

  async function loadPage(reset) {
    if (state.loading) return;
    state.loading = true;

    const grid = $('#grid');
    const more = $('#more');
    if (reset) {
      state.page = 0;
      state.pages = 1;
      gridShell(12);
      more.innerHTML = '';
    }

    const next = state.page + 1;
    const params = new URLSearchParams({
      type: state.kind,
      page: String(next),
      sort: state.sort,
    });
    if (state.genre) params.set('genre', state.genre);

    try {
      const data = await api('/api/browse?' + params.toString());
      state.page = data.page;
      state.pages = data.pages;

      if (reset) grid.innerHTML = '';

      if (!data.results.length) {
        if (reset) {
          const empty = document.createElement('div');
          empty.className = 'dc-empty';
          empty.textContent = 'Nothing matched those filters. Try a different genre.';
          grid.append(empty);
        }
      } else {
        for (const item of data.results) grid.append(UI.posterCard(item));
      }

      if (state.page >= state.pages) {
        more.innerHTML = '';
      } else {
        more.innerHTML = '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dc-btn';
        btn.textContent = 'Load more';
        btn.addEventListener('click', () => loadPage(false));
        more.append(btn);
      }
    } catch (e) {
      grid.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'dc-notice';
      box.innerHTML = '<b>Could not load the catalogue.</b><br>';
      box.append(document.createTextNode(e.message));
      const retry = document.createElement('div');
      retry.className = 'dc-more';
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'dc-btn';
      again.textContent = 'Try again';
      again.addEventListener('click', () => loadPage(true));
      retry.append(again);
      grid.append(box, retry);
      if (e.setup) showSetup(e);
    } finally {
      state.loading = false;
    }
  }

  function observeSentinel() {
    const sentinel = $('#sentinel');
    if (!sentinel || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && !state.loading && state.page < state.pages) loadPage(false);
      }
    }, { rootMargin: '600px 0px' });
    io.observe(sentinel);
  }

  /* ---------------- live search ---------------- */

  function closeLive() {
    const live = $('#live');
    live.hidden = true;
    live.innerHTML = '';
    $('#searchInput').setAttribute('aria-expanded', 'false');
    state.hits = [];
    state.hitIndex = -1;
  }

  function renderHits() {
    const live = $('#live');
    live.innerHTML = '';
    if (!state.hits.length) {
      const foot = document.createElement('div');
      foot.className = 'dc-live-foot';
      foot.textContent = `Nothing for “${state.query}”. Try a shorter spelling.`;
      live.append(foot);
      live.hidden = false;
      $('#searchInput').setAttribute('aria-expanded', 'true');
      return;
    }

    state.hits.forEach((hit, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'dc-hit';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === state.hitIndex));
      row.dataset.index = String(i);

      const src = UI.img(hit.poster, 'w92');
      if (src) {
        const image = document.createElement('img');
        image.src = src;
        image.alt = '';
        image.loading = 'lazy';
        image.addEventListener('error', () => image.classList.add('dc-hit-ph'));
        row.append(image);
      } else {
        const ph = document.createElement('span');
        ph.className = 'dc-hit-ph';
        row.append(ph);
      }

      const body = document.createElement('span');
      body.className = 'dc-hit-body';
      const name = document.createElement('b');
      name.textContent = hit.title;
      const meta = document.createElement('span');
      meta.textContent = [UI.subLine(hit, { showKind: true }), hit.rating ? `★ ${hit.rating.toFixed(1)}` : '']
        .filter(Boolean)
        .join(' · ');
      body.append(name, meta);

      const kind = document.createElement('span');
      kind.className = 'dc-hit-kind';
      kind.textContent = hit.type === 'tv' ? 'Series' : 'Film';

      row.append(body, kind);
      row.addEventListener('click', () => goTo(hit));
      live.append(row);
    });

    const foot = document.createElement('div');
    foot.className = 'dc-live-foot';
    foot.textContent = 'Enter opens the first result · Esc closes';
    live.append(foot);

    live.hidden = false;
    $('#searchInput').setAttribute('aria-expanded', 'true');
  }

  function goTo(hit) {
    if (!hit) return;
    location.href = `/title?type=${encodeURIComponent(hit.type)}&id=${encodeURIComponent(hit.id)}`;
  }

  let searchTimer = 0;

  async function runSearch(q) {
    const seq = ++state.searchSeq;
    state.query = q;
    if (!q) {
      closeLive();
      return;
    }
    try {
      const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
      if (seq !== state.searchSeq) return; // a newer keystroke won
      state.hits = data.results.slice(0, 8);
      state.hitIndex = -1;
      renderHits();
    } catch (e) {
      if (seq !== state.searchSeq) return;
      const live = $('#live');
      live.innerHTML = '';
      const foot = document.createElement('div');
      foot.className = 'dc-live-foot';
      foot.textContent = e.setup ? 'TMDB is not configured on this server yet.' : e.message;
      live.append(foot);
      live.hidden = false;
    }
  }

  function wireSearch() {
    const form = $('#searchForm');
    const input = $('#searchInput');
    if (!form || !input) return;

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (state.hits.length) goTo(state.hits[state.hitIndex >= 0 ? state.hitIndex : 0]);
    });

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(searchTimer);
      if (!q) {
        closeLive();
        return;
      }
      searchTimer = setTimeout(() => runSearch(q), 260);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeLive();
        input.blur();
        return;
      }
      if (!state.hits.length) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        state.hitIndex = (state.hitIndex + delta + state.hits.length) % state.hits.length;
        $$('.dc-hit').forEach((row, i) => row.setAttribute('aria-selected', String(i === state.hitIndex)));
      }
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.dc-searchwrap')) closeLive();
    });

    // "/" focuses the search, the way every catalogue does it.
    document.addEventListener('keydown', e => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      input.focus();
    });
  }

  /* ---------------- setup / failure ---------------- */

  function showSetup(error) {
    const host = $('#setup');
    if (!host || host.dataset.shown === '1') return;
    host.dataset.shown = '1';
    host.hidden = false;

    const card = document.createElement('div');
    card.className = 'dc-setup-card';

    const isNoApi = error && (error.code === 'no_api' || error.code === 'offline');

    card.innerHTML = isNoApi
      ? `<h2>This page needs its API running</h2>
         <p>Discovery is served by the small Node process in <code>server/</code>, which holds the TMDB key and the cache. A static file host cannot run it, so the page falls back to the direct-source shelf.</p>
         <pre>npm start</pre>
         <p style="margin-top:14px"><a href="/sources">Open the direct-source shelf instead →</a></p>`
      : `<h2>TMDB is not configured on this server</h2>
         <p>The integration is wired and running — it just has no credential. Add either a v4 read access token or a v3 key to <code>.env</code> in the project root, then restart the server. Nothing about the key reaches the browser.</p>
         <pre>TMDB_READ_TOKEN=your_v4_read_access_token
# or
TMDB_API_KEY=your_v3_key</pre>
         <p style="margin-top:14px">Create either at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org/settings/api</a>. Optional: <code>TMDB_LANGUAGE</code>, <code>TMDB_REGION</code>.</p>`;

    host.append(card);
  }

  /* ---------------- boot ---------------- */

  async function boot() {
    paintFilters();
    wireSearch();
    observeSentinel();

    // Restore the last kind so a series watcher does not land on films again.
    try {
      const saved = localStorage.getItem(KIND_KEY);
      if (saved === 'tv' || saved === 'movie') state.kind = saved;
    } catch { /* private mode */ }

    let config;
    try {
      config = await api('/api/config');
    } catch (e) {
      showSetup(e);
      await paintHero();
      $('#rails').innerHTML = '';
      $('#browse').hidden = true;
      return;
    }

    state.config = config;
    UI.setConfig(config);

    if (!config.configured) {
      showSetup(new ApiError('TMDB is not configured on this server.', { code: 'no_key', setup: true }));
      await paintHero();
      $('#rails').innerHTML = '';
      $('#browse').hidden = true;
      return;
    }

    paintFilters();
    wireFilters();
    await paintGenres();
    await Promise.all([paintHero(), paintRails(), loadPage(true)]);
  }

  function wireFilters() {
    $$('#filters button').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (state.kind === btn.dataset.kind) return;
        state.kind = btn.dataset.kind;
        state.genre = '';
        try { localStorage.setItem(KIND_KEY, state.kind); } catch { /* private mode */ }
        paintFilters();
        await paintGenres();
        loadPage(true);
      });
    });

    $('#genre')?.addEventListener('change', e => {
      state.genre = e.target.value;
      loadPage(true);
    });

    $('#sort')?.addEventListener('change', e => {
      state.sort = e.target.value;
      loadPage(true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
