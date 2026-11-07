/* ZenouMath, global search across films, games, AI and music. */
'use strict';

(async function () {
  const qIn = $('#globalQ');
  const results = $('#results');
  const echo = $('#qEcho');

  const p = new URLSearchParams(location.search);
  const initial = (p.get('q') || '').trim();
  if (initial) qIn.value = initial;

  // preload the game index and the movie shelf
  let games = [];
  let films = [];
  let assistants = [];
  try { games = (await fetch('/catalog/games.json?v=2026-10-31b').then(r => r.json())).games; } catch { /* empty catalog still fine */ }
  try { films = (await fetch('/catalog/movies.json?v=2026-11-07').then(r => r.json())).sources || []; } catch { /* the shelf is optional */ }
  try { assistants = (await fetch('/catalog/ai.json?v=2026-11-07').then(r => r.json())).tools || []; } catch { /* the AI room is optional */ }
  // TMDB discovery is served by the local Node process. On a static host the
  // fetch fails and the title row simply never appears, which is the right
  // degradation: the local catalogs below still answer.
  let tmdb = { on: false, base: 'https://image.tmdb.org/t/p/' };
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    tmdb = { on: Boolean(cfg.configured), base: (cfg.images && cfg.images.base) || tmdb.base };
  } catch { /* no API, no title row */ }

  let tDeb;
  qIn.addEventListener('input', () => {
    clearTimeout(tDeb);
    tDeb = setTimeout(() => run(qIn.value.trim()), 220);
  });
  $('#globalForm').addEventListener('submit', (e) => { e.preventDefault(); run(qIn.value.trim()); });

  if (initial) run(initial); else echo.textContent = 'Type to search games, films, AI and music.';

  async function run(q) {
    if (!q) { echo.textContent = 'Type to search games, films, AI and music.'; results.innerHTML = ''; return; }
    echo.textContent = '';
    history.replaceState(null, '', `?q=${encodeURIComponent(q)}`);
    results.innerHTML = '';
    results.append(skl());
    results.append(skl());

    const needle = q.toLowerCase();

    const hits = [];
    // 0 films and series: real TMDB titles, when the API is running
    if (tmdb.on) {
      const titles = await searchTitles(q);
      if (titles.length) hits.push(titlesRow(titles));
    }
    // 1 games
    const gameHits = games.filter(g => g.t.toLowerCase().includes(needle)).slice(0, 18);
    if (gameHits.length) hits.push(gamesRow(gameHits));
    // 2 movies: sources whose name, note or host matches
    const filmHits = films.filter(s => s.status !== 'down'
      && `${s.name} ${s.note || ''} ${s.url}`.toLowerCase().includes(needle)).slice(0, 8);
    if (filmHits.length) hits.push(filmsRow(filmHits));
    // 3 AI: name, vendor, blurb or tag
    const aiHits = assistants.filter(t => `${t.name} ${t.vendor || ''} ${t.blurb || ''} ${(t.tags || []).join(' ')}`.toLowerCase().includes(needle)).slice(0, 8);
    if (aiHits.length) hits.push(aiRow(aiHits));
    // 4 music: link-outs into Spotify's official search (no unlicensed scraping)
    hits.push(spotifyRow(q));
    hits.push(soundcloudRow(q));

    results.innerHTML = '';
    if (!hits.length) {
      results.innerHTML = `<div class="external-panel"><h2>Nothing matched “${escapeHtml(q)}”</h2><p>Try fewer words, or different spelling.</p></div>`;
      return;
    }
    hits.forEach(r => results.append(r));
  }

  function skl() { const d = document.createElement('div'); d.className = 'skl'; d.style.marginBottom = '18px'; return d; }

  function rowWrap(title, gridCls) {
    const wrap = document.createElement('section');
    const head = document.createElement('div'); head.className = 'mhead';
    const h = document.createElement('h2'); h.textContent = title;
    head.append(h); wrap.append(head);
    const grid = document.createElement('div'); grid.className = gridCls;
    wrap.append(grid);
    results.append(wrap);
    return grid;
  }

  function gamesRow(list) {
    const grid = rowWrap('Games', 'grid');
    list.forEach(g => {
      const a = document.createElement('a');
      a.className = 'card';
      a.href = `/play?id=${encodeURIComponent(g.id)}`;
      if (g.img) { const img = document.createElement('img'); img.className = 'card-thumb'; img.loading = 'lazy'; img.src = g.img; img.alt = ''; img.onerror = () => img.remove(); a.append(img); }
      const name = document.createElement('span'); name.className = 'card-name'; name.textContent = g.t;
      a.append(name);
      grid.append(a);
    });
    return wrapFix(grid);
  }
  function wrapFix(grid) { return grid.parentElement; }

  function filmsRow(list) {
    const grid = rowWrap('Movies & series', 'grid');
    list.forEach(s => {
      const a = document.createElement('a');
      a.className = 'card';
      a.href = `/sources?s=${encodeURIComponent(s.id)}`;
      const mark = document.createElement('span');
      mark.className = 'card-thumb';
      mark.style.cssText = 'display:grid;place-items:center;font-weight:800;font-size:22px;background:linear-gradient(140deg,#ff4fb0,#8b5cf6);color:#fff';
      mark.textContent = s.glyph || s.name.slice(0, 2).toUpperCase();
      const name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = s.name;
      a.append(mark, name);
      grid.append(a);
    });
    return wrapFix(grid);
  }



  async function searchTitles(q) {
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=multi&page=1`);
      if (!r.ok) return [];
      const data = await r.json();
      return (data.results || []).filter(t => t.poster).slice(0, 8);
    } catch { return []; }
  }

  function titlesRow(list) {
    const grid = rowWrap('Films & series', 'grid');
    list.forEach(t => {
      const a = document.createElement('a');
      a.className = 'card';
      a.href = `/title?type=${t.type}&id=${t.id}`;
      const thumb = document.createElement('img');
      thumb.className = 'card-thumb';
      thumb.loading = 'lazy';
      thumb.alt = '';
      // Posters are 2:3; the shared .card-thumb frame is 16:10.
      thumb.style.aspectRatio = '2 / 3';
      // A poster that never loads leaves a year block rather than a hole. The
      // handler is attached before src, and the node is in the card first, so a
      // cached failure can still replace it in place.
      thumb.onerror = () => {
        const mark = document.createElement('span');
        mark.className = 'card-thumb';
        mark.style.cssText = 'display:grid;place-items:center;aspect-ratio:2/3;font-weight:700;font-size:14px;background:linear-gradient(140deg,#ff4fb0,#8b5cf6);color:#fff';
        mark.textContent = t.year || '—';
        thumb.replaceWith(mark);
      };
      const name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = t.title;
      a.append(thumb, name);
      thumb.src = `${tmdb.base}w342${t.poster}`;
      grid.append(a);
    });
    return wrapFix(grid);
  }

  function aiRow(list) {
    const grid = rowWrap('AI', 'grid');
    list.forEach(t => {
      const a = document.createElement('a');
      a.className = 'card';
      if (t.frame === 'inline') {
        a.href = `/ai?t=${encodeURIComponent(t.id)}`;
      } else {
        a.href = t.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = 'Opens in its own tab: ' + (t.note || 'blocks framing');
      }
      const mark = document.createElement('span');
      mark.className = 'card-thumb';
      mark.style.cssText = 'display:grid;place-items:center;font-weight:800;font-size:20px;background:linear-gradient(140deg,#22d3ee,#8b5cf6);color:#fff';
      mark.textContent = '✦';
      const name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = t.name;
      a.append(mark, name);
      grid.append(a);
    });
    return wrapFix(grid);
  }

  function spotifyRow(q) {
    const grid = rowWrap('Search on Spotify…', '');
    grid.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
    const a = document.createElement('a');
    a.className = 'chip'; a.target = '_blank'; a.rel = 'noopener';
    a.href = `https://open.spotify.com/search/${encodeURIComponent(q)}`;
    a.textContent = `“${q}” ↗ Spotify`;
    grid.append(a);
    return wrapFix(grid);
  }

  function soundcloudRow(q) {
    const grid = rowWrap('Search on SoundCloud…', '');
    grid.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
    const a = document.createElement('a');
    a.className = 'chip'; a.target = '_blank'; a.rel = 'noopener';
    a.href = `https://soundcloud.com/search?q=${encodeURIComponent(q)}`;
    a.textContent = `“${q}” ↗ SoundCloud (official widget embed supported)`;
    grid.append(a);
    return wrapFix(grid);
  }

  function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
})();
