/* Zenou Unblocked — global search across games, movies, TV and music. */
'use strict';

(async function () {
  const qIn = $('#globalQ');
  const results = $('#results');
  const echo = $('#qEcho');

  const p = new URLSearchParams(location.search);
  const initial = (p.get('q') || '').trim();
  if (initial) qIn.value = initial;

  // preload game + film indexes
  let games = [];
  try { games = (await fetch('catalog/games.json?v=2026-10-30e').then(r => r.json())).games; } catch { /* empty catalog still fine */ }
  await TMDB.load();

  let tDeb;
  qIn.addEventListener('input', () => {
    clearTimeout(tDeb);
    tDeb = setTimeout(() => run(qIn.value.trim()), 220);
  });
  $('#globalForm').addEventListener('submit', (e) => { e.preventDefault(); run(qIn.value.trim()); });

  if (initial) run(initial); else echo.textContent = 'Type to search games, movies, shows and music in one place.';

  async function run(q) {
    if (!q) { echo.textContent = 'Type to search games, movies, shows and music in one place.'; results.innerHTML = ''; return; }
    echo.textContent = '';
    history.replaceState(null, '', `?q=${encodeURIComponent(q)}`);
    results.innerHTML = '';
    results.append(skl());
    results.append(skl());

    const needle = q.toLowerCase();

    const hits = [];
    // 1 games
    const gameHits = games.filter(g => g.t.toLowerCase().includes(needle)).slice(0, 18);
    if (gameHits.length) hits.push(gamesRow(gameHits));
    // 2 movies/TV from cache
    if (TMDB.data) {
      const mHits = TMDB.data.items.filter(x => x.t.toLowerCase().includes(needle)).slice(0, 18);
      if (mHits.length) hits.push(titlesRow(mHits, 'Movies & TV (cached TMDB snapshot)'));
    }
    // 3 music: link-outs into Spotify's official search (no unlicensed scraping)
    hits.push(spotifyRow(q));
    hits.push(soundcloudRow(q));

    results.innerHTML = '';
    if (!hits.length) {
      results.innerHTML = `<div class="external-panel"><h2>Nothing matched “${escapeHtml(q)}”</h2><p>Try fewer words — or different spelling.</p></div>`;
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
      a.href = g.p === 'ex' ? (g.g || '#') : `play.html?id=${encodeURIComponent(g.id)}`;
      if (g.p === 'ex') a.target = '_blank'; a.rel = 'noopener';
      if (g.img) { const img = document.createElement('img'); img.className = 'card-thumb'; img.loading = 'lazy'; img.src = g.img; img.alt = ''; img.onerror = () => img.remove(); a.append(img); }
      const name = document.createElement('span'); name.className = 'card-name'; name.textContent = g.t;
      a.append(name);
      grid.append(a);
    });
    return wrapFix(grid);
  }
  function wrapFix(grid) { return grid.parentElement; }

  function titlesRow(list, label) {
    const grid = rowWrap(label, 'mgrid');
    list.forEach(m => grid.append(mcard(m)));
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
