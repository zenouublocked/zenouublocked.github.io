/* ZenouMath, movies.
 *
 * Two layers, because the web only has two:
 *
 *   players  embed hosts that take a TMDB/IMDb id and allow framing. This is
 *            the only layer that can actually play inside this page, and it is
 *            what the catalogue sites below are built on.
 *   sources  catalogue sites, graded by scripts/verify-movies.mjs. Most of them
 *            send X-Frame-Options, so their tile offers a tab instead of a
 *            black rectangle.
 *
 * Proxy doors stay optional and live in this browser. Nothing is hardcoded
 * because public instances die.
 */
'use strict';

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const STAR_KEY = 'zenou_movies_stars';
  const RECENT_KEY = 'zenou_movies_recent';
  const DOOR_KEY = 'zenou_movie_doors';
  const SHOW_BROKEN_KEY = 'zenou_movies_broken';
  const KIND_KEY = 'zenou_movies_kind';

  const CATS = {
    all: 'Everything', movies: 'Movies', tv: 'Series', anime: 'Anime',
    asian: 'Asian drama', docs: 'Documentaries', live: 'Live TV', discovery: 'Discovery',
  };

  const BROKEN = new Set(['down', 'slow', 'parked', 'blocked-http']);

  const state = {
    sources: [],
    players: [],
    doors: [],
    cat: 'all',
    q: '',
    showBroken: false,
    kind: 'movie',
    current: null,
    full: false,
  };

  /* ---------- storage ---------- */

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }
  function stars() { return readJson(STAR_KEY, []); }
  function isStarred(id) { return stars().includes(id); }
  function toggleStar(id) {
    const list = stars();
    const at = list.indexOf(id);
    if (at === -1) list.push(id); else list.splice(at, 1);
    writeJson(STAR_KEY, list);
    return at === -1;
  }
  function recent() { return readJson(RECENT_KEY, []); }
  function pushRecent(id) {
    const list = recent().filter(v => v !== id);
    list.unshift(id);
    writeJson(RECENT_KEY, list.slice(0, 8));
  }
  function loadDoors() {
    const stored = readJson(DOOR_KEY, null);
    return Array.isArray(stored) ? stored : [];
  }
  function saveDoors(list) {
    state.doors = list;
    writeJson(DOOR_KEY, list);
    paintDoors();
  }

  /* ---------- proxy doors ---------- */

  /* The Ultraviolet family encodes a target by XOR-ing each byte with a
     two-byte key of 0x00, 0x02 and URL-encoding the result. Doors that take a
     plain query string get {url}; {b64} covers the rest. */
  function xorEncode(text) {
    let out = '';
    for (let i = 0; i < text.length; i += 1) {
      out += String.fromCharCode(text.charCodeAt(i) ^ (i % 2 ? 2 : 0));
    }
    return out;
  }

  function b64(text) {
    try { return btoa(unescape(encodeURIComponent(text))); } catch { return ''; }
  }

  function doorUrl(door, target) {
    return String(door.template || '')
      .replace(/\{url\}/g, encodeURIComponent(target))
      .replace(/\{enc\}/g, encodeURIComponent(xorEncode(target)))
      .replace(/\{b64\}/g, encodeURIComponent(b64(target)));
  }

  /* ---------- helpers ---------- */

  function toast(title, sub) {
    if (window.Zenou && window.Zenou.toast) window.Zenou.toast(title, sub);
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  }

  function normalise(s) {
    return (s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  }

  function copy(text) {
    try {
      navigator.clipboard.writeText(text);
      toast('Copied', text);
    } catch {
      toast('Copy blocked', 'Select the address and copy it by hand.');
    }
  }

  /* TMDB numbers, IMDb tt ids, and links to either. */
  function extractId(raw) {
    const v = (raw || '').trim();
    if (!v) return '';
    if (/^\d{1,8}$/.test(v)) return v;
    if (/^tt\d{6,10}$/i.test(v)) return v.toLowerCase();
    const tmdb = v.match(/themoviedb\.org\/(?:movie|tv)\/(\d{1,8})/i);
    if (tmdb) return tmdb[1];
    const imdb = v.match(/imdb\.com\/title\/(tt\d{6,10})/i);
    if (imdb) return imdb[1].toLowerCase();
    return '';
  }

  function clampInt(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  /* ---------- watch panel ---------- */

  function paintPlayerSelect() {
    const select = $('#watchPlayer');
    if (!select) return;
    select.innerHTML = '';
    state.players.forEach(player => {
      if (player.status !== 'up') return;
      const option = document.createElement('option');
      option.value = player.id;
      option.textContent = player.name;
      if (!player.tvOk) option.dataset.movieOnly = '1';
      select.append(option);
    });
    const saved = localStorage.getItem('zenou_movies_player');
    if (saved && $$('#watchPlayer option').some(o => o.value === saved)) select.value = saved;
    select.addEventListener('change', () => {
      try { localStorage.setItem('zenou_movies_player', select.value); } catch { /* quota */ }
    });
    paintWatchHint();
  }

  function paintWatchHint() {
    const hint = $('#watchHint');
    const select = $('#watchPlayer');
    if (!hint || !select) return;
    const player = state.players.find(p => p.id === select.value);
    if (!player) return;
    const kind = state.kind;
    if (kind === 'tv' && !player.tvOk) {
      hint.innerHTML = `${player.name} only answered for films on the last check, so an episode may not load there. Pick another player for series.`;
      return;
    }
    hint.innerHTML = kind === 'tv'
      ? `Plays <code>${player.name}</code> at /tv/id/season/episode. Numbers work everywhere; <code>tt</code> ids work on the VidX hosts.`
      : `Plays <code>${player.name}</code> at /movie/id. Numbers work everywhere; <code>tt</code> ids work on the VidX hosts.`;
  }

  function setKind(kind) {
    state.kind = kind;
    localStorage.setItem(KIND_KEY, kind);
    $$('.movies-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
    const ep = $('#watchEp');
    if (ep) ep.hidden = kind !== 'tv';
    paintWatchHint();
  }

  function playFromPanel() {
    const input = $('#watchId');
    const select = $('#watchPlayer');
    const id = extractId(input.value);
    if (!id) {
      toast('That is not an id', 'A TMDB number, an IMDb tt id, or a link to either.');
      input.focus();
      return;
    }
    const player = state.players.find(p => p.id === select.value);
    if (!player) return toast('No player', 'The player list did not load.');

    let url;
    if (state.kind === 'tv') {
      if (!player.tv) return toast(`${player.name} has no series route`, 'Pick another player.');
      const season = clampInt($('#watchS').value, 1);
      const episode = clampInt($('#watchE').value, 1);
      url = player.tv.replace('{id}', id).replace('{s}', season).replace('{e}', episode);
    } else {
      url = player.movie.replace('{id}', id);
    }

    if (player.frame === 'blocked') {
      window.open(url, '_blank', 'noopener');
      $('#moviesStageMeta').textContent = 'New tab';
      toast(`${player.name} opens in a tab`, 'Its server refuses framing, so it cannot play inside this page.');
      return;
    }

    state.current = { id: `play-${player.id}-${id}`, name: `${player.name} · ${id}`, glyph: player.glyph, url };
    pushRecent(state.current.id);
    paintRecent();
    header(state.current);
    $('#moviesStageMeta').textContent = state.kind === 'tv' ? 'Series' : 'Film';
    mountFrame(url, `${player.name} player`);
    $('#moviesStage').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const copyBtn = $('#moviesCopy');
    if (copyBtn) copyBtn.dataset.target = url;
  }

  /* ---------- players rail ---------- */

  function paintPlayers() {
    const grid = $('#playersGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const live = state.players.filter(p => p.status === 'up');
    const count = $('#playersCount');
    if (count) count.textContent = `${live.length} of ${state.players.length} answering`;

    state.players.forEach(player => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'movie-card is-player';
      if (player.status !== 'up') card.classList.add('is-down');
      card.innerHTML = `
        <span class="movie-head">
          <span class="movie-mark"></span>
          <span class="movie-title"><b></b><small></small></span>
        </span>
        <p class="movie-note"></p>
        <span class="movie-badges"><i class="movie-badge" data-tone="frame"></i><i class="movie-badge" data-tone="host"></i></span>`;
      card.querySelector('.movie-mark').textContent = player.glyph || player.name.slice(0, 2).toUpperCase();
      card.querySelector('.movie-title b').textContent = player.name;
      card.querySelector('.movie-title small').textContent = hostOf(player.url);
      card.querySelector('.movie-note').textContent = player.note || '';
      const badge = card.querySelector('.movie-badge[data-tone="frame"]');
      if (player.status !== 'up') {
        badge.textContent = 'Down';
        badge.dataset.tone = 'down';
      } else if (player.frame === 'blocked') {
        badge.textContent = 'New tab';
        badge.dataset.tone = 'tab';
      } else {
        badge.textContent = 'Frames here';
        badge.dataset.tone = 'plays';
      }
      const host = card.querySelector('.movie-badge[data-tone="host"]');
      host.textContent = player.tvOk ? 'Film + series' : 'Film only';
      host.dataset.tone = player.tvOk ? 'plays' : 'tab';
      card.setAttribute('aria-label', `Open ${player.name}`);
      card.addEventListener('click', () => openPlayer(player));
      grid.append(card);
    });
  }

  function openPlayer(player) {
    state.current = { id: `player-${player.id}`, name: player.name, glyph: player.glyph, url: player.url };
    pushRecent(state.current.id);
    paintRecent();
    header(state.current);

    // A host that sends a framing header can never paint in this stage, so hand
    // it to the browser rather than showing a black rectangle.
    if (player.frame === 'blocked') {
      $('#moviesStageMeta').textContent = 'New tab';
      window.open(player.url, '_blank', 'noopener');
      return;
    }

    $('#moviesStageMeta').textContent = '';
    mountFrame(player.url, player.name);
    $('#moviesStage').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const copyBtn = $('#moviesCopy');
    if (copyBtn) copyBtn.dataset.target = player.url;
  }

  /* ---------- directory ---------- */

  function healthy(source) {
    return !BROKEN.has(source.status) && source.status === 'up';
  }

  function frameBadge(source) {
    if (source.status === 'parked') return { text: 'Sold', tone: 'down' };
    if (source.status === 'down') return { text: 'Down', tone: 'down' };
    if (source.status === 'slow') return { text: 'Times out', tone: 'down' };
    if (source.status === 'blocked-http') return { text: 'Bot-blocked', tone: 'down' };
    if (source.frame === 'direct') return { text: 'Plays here', tone: 'plays' };
    return { text: 'Opens in a tab', tone: 'tab' };
  }

  function visibleSources() {
    const q = normalise(state.q);
    return state.sources.filter(s => {
      if (!state.showBroken && !healthy(s)) return false;
      if (state.cat !== 'all' && !(s.cats || []).includes(state.cat)) return false;
      if (!q) return true;
      const hay = normalise([s.name, s.note, hostOf(s.url), (s.tags || []).join(' '), (s.cats || []).join(' ')].join(' '));
      return hay.includes(q);
    }).sort((a, b) => {
      if (healthy(a) !== healthy(b)) return healthy(a) ? -1 : 1;
      const sa = isStarred(a.id) ? 0 : 1;
      const sb = isStarred(b.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const fa = a.featured ? 0 : 1;
      const fb = b.featured ? 0 : 1;
      return fa - fb;
    });
  }

  function paintCats() {
    const wrap = $('#moviesCats');
    if (!wrap) return;
    const counts = { all: state.sources.filter(s => state.showBroken || healthy(s)).length };
    state.sources.forEach(s => {
      if (!state.showBroken && !healthy(s)) return;
      (s.cats || []).forEach(c => { counts[c] = (counts[c] || 0) + 1; });
    });
    wrap.innerHTML = '';
    Object.entries(CATS).forEach(([id, label]) => {
      if (id !== 'all' && !counts[id]) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'movies-cat';
      b.dataset.id = id;
      b.setAttribute('aria-pressed', String(state.cat === id));
      b.textContent = `${label} ${counts[id] || 0}`;
      b.addEventListener('click', () => {
        state.cat = id;
        paintCats();
        paintGrid();
      });
      wrap.append(b);
    });
  }

  function paintGrid() {
    const grid = $('#moviesGrid');
    if (!grid) return;
    const list = visibleSources();
    grid.innerHTML = '';
    const count = $('#moviesCount');
    if (count) {
      const shown = state.sources.filter(s => state.showBroken || healthy(s)).length;
      count.textContent = `${list.length} of ${shown} sites`;
    }
    const empty = $('#moviesEmpty');
    if (empty) empty.hidden = list.length > 0;

    list.forEach(source => {
      const card = document.createElement('article');
      card.className = 'movie-card';
      if (!healthy(source)) card.classList.add('is-down');

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'movie-open';
      open.innerHTML = `
        <span class="movie-head">
          <span class="movie-mark"></span>
          <span class="movie-title"><b></b><small></small></span>
        </span>
        <p class="movie-note"></p>
        <span class="movie-badges"><i class="movie-badge" data-tone="frame"></i><i class="movie-badge" data-tone="host"></i></span>`;
      open.querySelector('.movie-mark').textContent = source.glyph || source.name.slice(0, 2).toUpperCase();
      open.querySelector('.movie-title b').textContent = source.name;
      open.querySelector('.movie-title small').textContent = hostOf(source.url);
      open.querySelector('.movie-note').textContent = source.note || '';
      const badge = frameBadge(source);
      const fb = open.querySelector('.movie-badge[data-tone="frame"]');
      fb.textContent = badge.text;
      fb.dataset.tone = badge.tone;
      const hb = open.querySelector('.movie-badge[data-tone="host"]');
      hb.textContent = source.checked ? `Checked ${source.checked}` : 'Unchecked';
      hb.dataset.tone = 'host';
      open.setAttribute('aria-label', `Open ${source.name}`);
      open.addEventListener('click', () => openSource(source));
      card.append(open);

      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'movie-star';
      star.textContent = '★';
      star.title = isStarred(source.id) ? 'Remove from starred' : 'Star this site';
      star.setAttribute('aria-pressed', String(isStarred(source.id)));
      star.addEventListener('click', (e) => {
        e.stopPropagation();
        const on = toggleStar(source.id);
        star.setAttribute('aria-pressed', String(on));
        star.title = on ? 'Remove from starred' : 'Star this site';
        paintGrid();
      });
      card.append(star);

      grid.append(card);
    });
  }

  /* ---------- stage ---------- */

  function stageEls() {
    return {
      stage: $('#moviesStage'),
      frame: $('#moviesFrame'),
      idle: $('#moviesIdle'),
      blocked: $('#moviesBlocked'),
      mark: $('#moviesStageMark'),
      name: $('#moviesStageName'),
      host: $('#moviesStageHost'),
      meta: $('#moviesStageMeta'),
    };
  }

  function resetStage() {
    const el = stageEls();
    el.frame.innerHTML = '';
    el.idle.hidden = false;
    el.blocked.hidden = true;
    el.mark.textContent = '—';
    el.name.textContent = 'Nothing loaded';
    el.host.textContent = 'Pick a player or a source';
    el.meta.textContent = '';
  }

  function header(current) {
    const el = stageEls();
    el.mark.textContent = current.glyph || current.name.slice(0, 2).toUpperCase();
    el.name.textContent = current.name;
    el.host.textContent = hostOf(current.url);
  }

  function mountFrame(src, label) {
    const el = stageEls();
    const frame = document.createElement('iframe');
    frame.src = src;
    frame.title = label || 'Movie player';
    frame.referrerPolicy = 'no-referrer';
    frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write';
    frame.allowFullscreen = true;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation');
    el.frame.innerHTML = '';
    el.frame.append(frame);
    el.idle.hidden = true;
    el.blocked.hidden = true;
  }

  function showBlocked(source, reason) {
    const el = stageEls();
    el.frame.innerHTML = '';
    el.idle.hidden = true;
    el.blocked.hidden = false;
    const inner = el.blocked.querySelector('.movies-state-inner');

    const sold = source.status === 'parked';
    const gone = source.status === 'down' || source.status === 'slow';
    inner.querySelector('span').textContent = sold ? 'Domain sold' : gone ? 'Host unreachable' : 'Their server says no';
    inner.querySelector('h2').textContent = sold
      ? `${source.name} is not that site any more`
      : gone
        ? `${source.name} did not answer`
        : `${source.name} refuses to be framed`;
    inner.querySelector('p').textContent = reason || (sold
      ? 'The domain now redirects somewhere else entirely. The record stays so nobody walks into it twice.'
      : gone
        ? 'The last check got no answer. A player above will still find the film if you have its id.'
        : 'It sends X-Frame-Options or frame-ancestors, so the browser blanks the frame no matter what this page does. Open it in its own tab instead.');

    const tabBtn = inner.querySelector('[data-act="tab"]');
    tabBtn.href = source.url;
    tabBtn.textContent = sold || gone ? 'Open anyway' : 'Open in a new tab';
    tabBtn.hidden = sold;
    const tryBtn = inner.querySelector('[data-act="try"]');
    tryBtn.hidden = sold || gone;
    tryBtn.onclick = () => {
      mountFrame(source.url, source.name);
      toast('Loading anyway', 'If it stays black, their headers won.');
    };
    paintDoorChooser(inner, source);
  }

  function paintDoorChooser(scope, source) {
    const wrap = scope.querySelector('[data-act="doors"]');
    if (!wrap) return;
    const doors = state.doors || [];
    wrap.innerHTML = '';
    wrap.hidden = doors.length === 0 || source.status !== 'up';
    if (wrap.hidden) return;
    const select = document.createElement('select');
    select.className = 'movies-door-select';
    doors.forEach(d => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.name;
      select.append(o);
    });
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'btn';
    go.textContent = 'Play through a door';
    go.addEventListener('click', () => {
      const door = doors.find(d => d.id === select.value) || doors[0];
      if (!door) return;
      mountFrame(doorUrl(door, source.url), `${source.name} through ${door.name}`);
      toast(`Loading through ${door.name}`, 'If the door is alive the site lands in this frame.');
    });
    wrap.append(select, go);
  }

  function openSource(source) {
    state.current = source;
    pushRecent(source.id);
    paintRecent();
    header(source);
    $('#moviesStageMeta').textContent = '';
    $('#moviesStage').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const copyBtn = $('#moviesCopy');
    if (copyBtn) copyBtn.dataset.target = source.url;

    if (!healthy(source)) return showBlocked(source);
    if (source.frame === 'direct') return mountFrame(source.url, source.name);
    if (source.frame === 'unknown') {
      mountFrame(source.url, source.name);
      $('#moviesStageMeta').textContent = 'Unverified';
      return;
    }
    showBlocked(source);
  }

  /* ---------- doors panel ---------- */

  function paintDoors() {
    const list = $('#moviesDoorList');
    if (!list) return;
    list.innerHTML = '';
    if (!state.doors.length) {
      const li = document.createElement('li');
      li.className = 'movies-door-item';
      li.innerHTML = '<b>No doors yet</b><span>Add a proxy above and every blocked site gains a second button.</span>';
      list.append(li);
      return;
    }
    state.doors.forEach(door => {
      const li = document.createElement('li');
      li.className = 'movies-door-item';
      const name = document.createElement('b');
      name.textContent = door.name;
      const tpl = document.createElement('span');
      tpl.textContent = door.template;
      tpl.title = door.template;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn btn-ghost';
      rm.style.padding = '4px 9px';
      rm.style.fontSize = '11.5px';
      rm.textContent = 'Remove';
      rm.addEventListener('click', () => saveDoors(state.doors.filter(d => d.id !== door.id)));
      li.append(name, tpl, rm);
      list.append(li);
    });
  }

  function addDoor(name, template) {
    const tpl = (template || '').trim();
    if (!tpl) return false;
    if (!/\{(url|enc|b64)\}/.test(tpl)) {
      toast('Template needs a slot', 'Include {url}, {enc} or {b64} where the address goes.');
      return false;
    }
    const door = {
      id: `d${Date.now().toString(36)}`,
      name: (name || '').trim() || hostOf(tpl) || 'Door',
      template: tpl,
    };
    saveDoors([...state.doors, door]);
    toast('Door added', `${door.name} now appears on blocked sites.`);
    return true;
  }

  /* ---------- fullscreen ---------- */

  function toggleFull() {
    const stage = $('#moviesStage');
    if (!stage) return;
    state.full = !state.full;
    stage.classList.toggle('is-full', state.full);
    document.body.style.overflow = state.full ? 'hidden' : '';
    const btn = $('#moviesFull');
    if (btn) btn.textContent = state.full ? 'Exit full' : 'Fullscreen';
  }

  /* ---------- recents ---------- */

  /* A recent entry can be a site or a player, so look in both lists. */
  function findRecent(id) {
    const site = state.sources.find(s => s.id === id);
    if (site) return { label: site.name, run: () => openSource(site) };
    const player = state.players.find(p => p.id === id);
    if (player) return { label: player.name, run: () => openPlayer(player) };
    if (id.startsWith('play-')) {
      const [, playerId] = id.split('-');
      const name = state.players.find(p => p.id === playerId)?.name;
      return name ? { label: `Play · ${name}`, run: () => {} } : null;
    }
    return null;
  }

  function paintRecent() {
    const wrap = $('#moviesRecent');
    if (!wrap) return;
    wrap.innerHTML = '';
    const list = recent().map(findRecent).filter(Boolean);
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'movies-deck';
      p.textContent = 'Nothing opened yet. The last eight things you press turn up here.';
      wrap.append(p);
      return;
    }
    list.forEach(entry => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'movies-flag';
      b.textContent = entry.label;
      b.addEventListener('click', entry.run);
      wrap.append(b);
    });
  }

  /* ---------- boot ---------- */

  async function loadCatalog() {
    try {
      const res = await fetch('/catalog/movies.json');
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      state.sources = Array.isArray(data.sources) ? data.sources : [];
      state.players = Array.isArray(data.players) ? data.players : [];
      state.doors = loadDoors();
      const hint = $('#moviesDoorHint');
      if (hint && data.doorHint) hint.textContent = data.doorHint;
    } catch {
      state.sources = [];
      state.players = [];
      state.doors = loadDoors();
      toast('Catalogue did not load', 'catalog/movies.json is missing or blocked.');
    }
    paintPlayerSelect();
    paintPlayers();
    paintCats();
    paintGrid();
    paintDoors();
    paintRecent();
    resetStage();

    const p = new URLSearchParams(location.search);
    if (p.get('s')) {
      const hit = state.sources.find(s => s.id === p.get('s'));
      if (hit) openSource(hit);
    }
    if (p.get('id')) {
      $('#watchId').value = p.get('id');
      playFromPanel();
    }
  }

  function boot() {
    state.showBroken = readJson(SHOW_BROKEN_KEY, false) === true;
    state.kind = localStorage.getItem(KIND_KEY) === 'tv' ? 'tv' : 'movie';

    const search = $('#moviesSearch');
    if (search) {
      search.addEventListener('input', (e) => {
        state.q = e.target.value;
        paintGrid();
      });
    }

    const broken = $('#moviesShowDown');
    if (broken) {
      broken.setAttribute('aria-pressed', String(state.showBroken));
      broken.addEventListener('click', () => {
        state.showBroken = !state.showBroken;
        broken.setAttribute('aria-pressed', String(state.showBroken));
        writeJson(SHOW_BROKEN_KEY, state.showBroken);
        paintCats();
        paintGrid();
      });
    }

    $$('.movies-seg button').forEach(b => b.addEventListener('click', () => setKind(b.dataset.kind)));
    setKind(state.kind);

    $('#watchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      playFromPanel();
    });
    $('#watchId').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); playFromPanel(); }
    });

    $('#moviesReload').addEventListener('click', () => {
      const frame = $('#moviesFrame iframe');
      if (frame) frame.src = frame.src;
      else if (state.current) openSource(state.current);
    });

    $('#moviesCopy').addEventListener('click', (e) => {
      const target = e.currentTarget.dataset.target;
      if (target) copy(target);
    });

    $('#moviesTab').addEventListener('click', () => {
      if (!state.current) return toast('Nothing loaded', 'Pick a player or a site first.');
      window.open(state.current.url, '_blank', 'noopener');
    });

    $('#moviesFull').addEventListener('click', toggleFull);

    $('#moviesClose').addEventListener('click', () => {
      if (state.full) toggleFull();
      state.current = null;
      resetStage();
    });

    const form = $('#moviesDoorForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#moviesDoorName');
        const tpl = $('#moviesDoorTpl');
        if (addDoor(name.value, tpl.value)) {
          name.value = '';
          tpl.value = '';
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.full) toggleFull();
    });

    const p = new URLSearchParams(location.search);
    if (p.get('q')) {
      state.q = p.get('q');
      if (search) search.value = state.q;
    }

    loadCatalog();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
