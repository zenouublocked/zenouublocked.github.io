/* Zenou Unblocked, the "plus" layer.
 *
 * One script shared by every page. It adds the parts of the site that are not
 * tied to a single screen: the command palette, toasts, the library store
 * (ratings, notes, playlists, playtime, achievements), keyboard shortcuts, the
 * reading-progress bar, the first-run tour, gamepad detection and the
 * installable-app plumbing.
 *
 * Everything is local. There is no account and nothing is uploaded; the only
 * network request here is the cached game catalogue the palette searches.
 */
'use strict';

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const LS = {
    get(k, f) {
      try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch { return f; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  /* ================================================================
     store
     ================================================================ */
  const K = {
    fav: 'zenou_fav',
    recent: 'zenou_recent',
    ratings: 'zenou_ratings',
    notes: 'zenou_notes',
    playtime: 'zenou_playtime',
    hidden: 'zenou_hidden',
    playlists: 'zenou_playlists',
    xp: 'zenou_xp',
    ach: 'zenou_ach',
    days: 'zenou_days',
    reported: 'zenou_reported',
    tour: 'zenou_tour_done',
    view: 'zenou_view',
    searches: 'zenou_searches',
    catalog: 'zenou_catalog_cache2',
  };

  const store = {
    favs: new Set(LS.get(K.fav, [])),
    recent: (LS.get(K.recent, []) || []).filter(r => r && typeof r.id === 'string'),
    ratings: LS.get(K.ratings, {}) || {},
    notes: LS.get(K.notes, {}) || {},
    playtime: LS.get(K.playtime, {}) || {},
    hidden: new Set(LS.get(K.hidden, []) || []),
    playlists: LS.get(K.playlists, []) || [],
    xp: LS.get(K.xp, 0) || 0,
    ach: new Set(LS.get(K.ach, []) || []),
    days: LS.get(K.days, []) || [],
    reported: LS.get(K.reported, []) || [],

    saveFav() { LS.set(K.fav, [...this.favs]); },
    saveRecent() { LS.set(K.recent, this.recent.slice(0, 80)); },
    saveRatings() { LS.set(K.ratings, this.ratings); },
    saveNotes() { LS.set(K.notes, this.notes); },
    savePlaytime() { LS.set(K.playtime, this.playtime); },
    saveHidden() { LS.set(K.hidden, [...this.hidden]); },
    savePlaylists() { LS.set(K.playlists, this.playlists); },
    saveAch() { LS.set(K.ach, [...this.ach]); },
    saveDays() { LS.set(K.days, this.days.slice(-400)); },
  };

  /* ================================================================
     achievements + xp
     ================================================================ */
  const ACHIEVEMENTS = [
    { id: 'first', name: 'First run', desc: 'Play your first game', icon: '▶', test: s => s.played >= 1 },
    { id: 'five', name: 'Getting warm', desc: 'Play 5 different games', icon: '5', test: s => s.played >= 5 },
    { id: 'twentyfive', name: 'Catalogue crawler', desc: 'Play 25 different games', icon: '25', test: s => s.played >= 25 },
    { id: 'hundred', name: 'Century', desc: 'Play 100 different games', icon: '100', test: s => s.played >= 100 },
    { id: 'fivehundred', name: 'Curator', desc: 'Play 500 different games', icon: '500', test: s => s.played >= 500 },
    { id: 'tenmin', name: 'Coffee break', desc: 'Spend 10 minutes playing', icon: '☕', test: s => s.ms >= 6e5 },
    { id: 'onehour', name: 'One more go', desc: 'Spend an hour playing', icon: '⏱', test: s => s.ms >= 36e5 },
    { id: 'fivehours', name: 'Long session', desc: 'Spend 5 hours playing', icon: '🌙', test: s => s.ms >= 18e6 },
    { id: 'day', name: 'Whole day', desc: 'Spend 24 hours playing', icon: '🌞', test: s => s.ms >= 864e5 },
    { id: 'threecats', name: 'Wide taste', desc: 'Play games from 3 categories', icon: '◈', test: s => s.cats >= 3 },
    { id: 'eightcats', name: 'Genre hopper', desc: 'Play games from 8 categories', icon: '✦', test: s => s.cats >= 8 },
    { id: 'allsources', name: 'Source sampler', desc: 'Play from 3 different sources', icon: '⛁', test: s => s.sources >= 3 },
    { id: 'rated10', name: 'Critic', desc: 'Rate 10 games', icon: '★', test: s => s.rated >= 10 },
    { id: 'fav10', name: 'Collector', desc: 'Favourite 10 games', icon: '♥', test: s => s.favs >= 10 },
    { id: 'playlist', name: 'Setlist', desc: 'Build a playlist', icon: '☰', test: s => s.playlists >= 1 },
    { id: 'hidden10', name: 'Hiding places', desc: 'Hide 10 games you are not into', icon: '⊘', test: s => s.hidden >= 10 },
    { id: 'streak3', name: 'Three in a row', desc: 'Play on 3 days in a row', icon: '⚡', test: s => s.streak >= 3 },
    { id: 'streak7', name: 'Week habit', desc: 'Play on 7 days in a row', icon: '🔥', test: s => s.streak >= 7 },
    { id: 'night', name: 'Night shift', desc: 'Play between 1am and 4am', icon: '🌜', test: s => s.night },
    { id: 'early', name: 'Early bird', desc: 'Play before 7am', icon: '🌅', test: s => s.early },
    { id: 'gem', name: 'Gem hunter', desc: 'Play a game with under 5,000 plays', icon: '💎', test: s => s.gem },
    { id: 'adfree', name: 'Clean start', desc: 'Play 10 ad-free games', icon: '◎', test: s => s.adfree >= 10 },
  ];

  function dayKey(d) {
    const x = d || new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }

  function streakOf(days) {
    const set = new Set(days);
    let streak = 0;
    const d = new Date();
    for (;;) {
      if (set.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }

  /* Read straight from localStorage: another page may have written since this
     script parsed (for example the player adding a game to history). */
  function stats() {
    const playtime = LS.get(K.playtime, {}) || {};
    const ratings = LS.get(K.ratings, {}) || {};
    const playlists = LS.get(K.playlists, []) || [];
    const days = LS.get(K.days, []) || [];
    const recent = (LS.get(K.recent, []) || []).filter(r => r && r.id);
    const favs = LS.get(K.fav, []) || [];
    const hidden = LS.get(K.hidden, []) || [];

    const ids = Object.keys(playtime);
    const ms = Object.values(playtime).reduce((a, b) => a + (b || 0), 0);
    let cats = 0, sources = 0, adfree = 0, gem = false;
    if (window.__zenouGames) {
      const map = new Map(window.__zenouGames.map(g => [g.id, g]));
      const cs = new Set(), ss = new Set();
      ids.forEach(id => {
        const g = map.get(id);
        if (!g) return;
        (g.cs || []).forEach(c => cs.add(c));
        ss.add(g.s);
        if (g.p !== 'pg') adfree++;
        if (g.pc != null && g.pc < 5000) gem = true;
      });
      cats = cs.size; sources = ss.size;
    }
    const playedSet = new Set(recent.map(r => r.id));
    ids.forEach(id => playedSet.add(id));
    const hour = new Date().getHours();
    return {
      played: playedSet.size,
      ms,
      cats, sources, adfree, gem,
      rated: Object.keys(ratings).length,
      favs: favs.length,
      playlists: playlists.length,
      hidden: hidden.length,
      streak: streakOf(days),
      night: days.includes('night'),
      early: days.includes('early'),
      hour,
    };
  }

  /* triangular curve: L2 at 100 xp, L3 at 300, L4 at 600, L5 at 1,000 … */
  const xpForLevel = (l) => 50 * (l - 1) * l;
  function levelFor(xp) {
    let level = 1;
    while (xpForLevel(level + 1) <= xp && level < 200) level++;
    const floorXp = xpForLevel(level);
    const nextXp = xpForLevel(level + 1);
    return { level, floorXp, nextXp, into: xp - floorXp, span: nextXp - floorXp };
  }

  function addXp(n) {
    if (!n) return;
    store.xp = Math.max(0, store.xp + n);
    LS.set(K.xp, store.xp);
  }

  function checkAchievements({ quiet } = {}) {
    const s = stats();
    const unlocked = [];
    for (const a of ACHIEVEMENTS) {
      if (store.ach.has(a.id)) continue;
      let ok = false;
      try { ok = a.test(s); } catch { ok = false; }
      if (ok) { store.ach.add(a.id); unlocked.push(a); }
    }
    if (unlocked.length) {
      store.saveAch();
      addXp(unlocked.length * 25);
      if (!quiet) {
        unlocked.slice(0, 3).forEach((a, i) =>
          setTimeout(() => toast(`${a.icon}  Achievement, ${a.name}`, a.desc, { kind: 'ach' }), i * 650));
      }
    }
    return unlocked;
  }

  function markDay() {
    const today = dayKey();
    if (!store.days.includes(today)) store.days.push(today);
    const h = new Date().getHours();
    if (h >= 1 && h < 4 && !store.days.includes('night')) store.days.push('night');
    if (h < 7 && !store.days.includes('early')) store.days.push('early');
    store.saveDays();
  }

  /* ================================================================
     toasts
     ================================================================ */
  let toastHost = null;

  function toast(title, sub, opts = {}) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toast-stack';
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      document.body.append(toastHost);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (opts.kind ? ` toast-${opts.kind}` : '');
    const t = document.createElement('strong');
    t.textContent = title;
    el.append(t);
    if (sub) {
      const p = document.createElement('span');
      p.textContent = sub;
      el.append(p);
    }
    if (opts.action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-act';
      b.textContent = opts.action.label;
      b.addEventListener('click', () => { opts.action.run(); el.remove(); });
      el.append(b);
    }
    toastHost.append(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 260);
    }, opts.ms || 3600);
    return el;
  }

  /* ================================================================
     game cards (shared by library, playlists, stats)
     ================================================================ */
  function gameCard(g, extra = {}) {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = `play.html?id=${encodeURIComponent(g.id)}`;
    a.setAttribute('aria-label', g.t);
    if (g.img) {
      const img = document.createElement('img');
      img.className = 'card-thumb';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '';
      img.src = g.img;
      img.onerror = () => {
        const p = document.createElement('span');
        p.className = 'card-plaque';
        p.textContent = (g.t.match(/[A-Za-z0-9]/g) || ['?']).slice(0, 2).join('').toUpperCase();
        img.replaceWith(p);
      };
      a.append(img);
    }
    const play = document.createElement('span');
    play.className = 'card-play-badge';
    play.innerHTML = '<i><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></i>';
    const nm = document.createElement('span');
    nm.className = 'card-name';
    nm.textContent = g.t;
    a.append(play, nm);
    const r = store.ratings[g.id];
    if (r) {
      const b = document.createElement('span');
      b.className = 'card-rating';
      b.textContent = '★'.repeat(r);
      a.append(b);
    }
    if (extra.actions !== false) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'card-x';
      x.title = 'Hide this game';
      x.setAttribute('aria-label', `Hide ${g.t}`);
      x.innerHTML = '&times;';
      x.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        hideGame(g.id, g.t);
        a.remove();
      });
      a.append(x);
    }
    return a;
  }

  function hideGame(id, name) {
    store.hidden.add(id);
    store.saveHidden();
    toast('Hidden', `${name} will no longer show in lists. Undo any time in My Library.`, {
      action: { label: 'Undo', run: () => { store.hidden.delete(id); store.saveHidden(); location.reload(); } },
    });
    checkAchievements();
  }

  /* ================================================================
     playlists
     ================================================================ */
  function createPlaylist(name) {
    const p = { id: uid(), name: (name || 'New playlist').slice(0, 60), ids: [], ts: Date.now() };
    store.playlists.push(p);
    store.savePlaylists();
    addXp(10);
    checkAchievements();
    return p;
  }
  function addToPlaylist(playlistId, gameId) {
    const p = store.playlists.find(x => x.id === playlistId);
    if (!p) return false;
    if (!p.ids.includes(gameId)) p.ids.push(gameId);
    store.savePlaylists();
    checkAchievements();
    return true;
  }
  function toggleInPlaylist(playlistId, gameId) {
    const p = store.playlists.find(x => x.id === playlistId);
    if (!p) return false;
    const i = p.ids.indexOf(gameId);
    if (i >= 0) p.ids.splice(i, 1); else p.ids.push(gameId);
    store.savePlaylists();
    return i < 0;
  }

  function playlistPicker(gameId, gameName) {
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.innerHTML = `<h3>Add to playlist</h3><p class="sheet-sub"></p><div class="sheet-list"></div>
      <div class="sheet-new"><input type="text" maxlength="60" placeholder="New playlist name"><button class="btn btn-solid" type="button">Create</button></div>`;
    $('.sheet-sub', sheet).textContent = gameName || '';
    const list = $('.sheet-list', sheet);

    const paint = () => {
      list.innerHTML = '';
      if (!store.playlists.length) {
        const p = document.createElement('p');
        p.className = 'sheet-empty';
        p.textContent = 'No playlists yet, name one below.';
        list.append(p);
      }
      store.playlists.forEach(pl => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'sheet-row';
        const on = pl.ids.includes(gameId);
        row.innerHTML = `<span class="sheet-row-name"></span><span class="sheet-row-meta">${pl.ids.length} game${pl.ids.length === 1 ? '' : 's'}${on ? ' · added' : ''}</span>`;
        $('.sheet-row-name', row).textContent = pl.name;
        row.setAttribute('aria-pressed', on ? 'true' : 'false');
        row.addEventListener('click', () => {
          const added = toggleInPlaylist(pl.id, gameId);
          toast(added ? 'Added to playlist' : 'Removed from playlist', pl.name);
          paint();
        });
        list.append(row);
      });
    };
    paint();

    const input = $('.sheet-new input', sheet);
    const create = () => {
      const name = input.value.trim();
      if (!name) return;
      const p = createPlaylist(name);
      addToPlaylist(p.id, gameId);
      input.value = '';
      toast('Playlist created', p.name);
      paint();
    };
    $('.sheet-new button', sheet).addEventListener('click', create);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') create(); });

    overlay.append(sheet);
    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 200); };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  /* ================================================================
     ratings
     ================================================================ */
  function ratingRow(gameId, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'rating';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Rate this game');
    let current = store.ratings[gameId] || 0;
    const paint = () => {
      $$('button', wrap).forEach((b, i) => {
        b.classList.toggle('on', i < current);
        b.setAttribute('aria-pressed', i < current ? 'true' : 'false');
      });
      const label = $('.rating-label', wrap);
      if (label) label.textContent = current ? `${current} of 5` : 'Not rated';
    };
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = '★';
      b.title = `${i} star${i === 1 ? '' : 's'}`;
      b.addEventListener('click', () => {
        current = current === i ? 0 : i;
        if (current) store.ratings[gameId] = current; else delete store.ratings[gameId];
        store.saveRatings();
        addXp(current ? 2 : 0);
        checkAchievements();
        paint();
        if (onChange) onChange(current);
      });
      wrap.append(b);
    }
    const label = document.createElement('span');
    label.className = 'rating-label';
    wrap.append(label);
    paint();
    return wrap;
  }

  /* ================================================================
     catalogue cache (palette + recommendations)
     ================================================================ */
  let catalogPromise = null;
  function loadCatalog() {
    if (window.__zenouGames) return Promise.resolve(window.__zenouGames);
    if (catalogPromise) return catalogPromise;
    catalogPromise = (async () => {
      const cached = LS.get(K.catalog, null);
      if (cached && Array.isArray(cached.games) && cached.games.length) {
        window.__zenouGames = cached.games;
        // refresh in the background for next time
        fetch('catalog/games.json?v=2026-10-31b').then(r => r.ok ? r.json() : null).then(d => {
          if (d && d.games) { LS.set(K.catalog, { ts: Date.now(), games: d.games }); window.__zenouGames = d.games; }
        }).catch(() => {});
        return window.__zenouGames;
      }
      try {
        const r = await fetch('catalog/games.json?v=2026-10-31b');
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        window.__zenouGames = d.games;
        try { LS.set(K.catalog, { ts: Date.now(), games: d.games }); } catch { /* too big, fine */ }
        return d.games;
      } catch {
        return [];
      }
    })();
    return catalogPromise;
  }

  /* ================================================================
     command palette
     ================================================================ */
  const PAGES = [
    ['All games', 'index.html', 'Home, rails and the full catalogue'],
    ['Social', 'social.html', 'YouTube, TikTok, Instagram, Twitch, Discord'],
    ['Music', 'music.html', 'Spotify and SoundCloud embeds'],
    ['My Library', 'library.html', 'Favourites, playlists, stats'],
    ['No pre-roll ads', 'index.html?c=noads', 'Games that start without an ad screen'],
    ['HoodaMath builds', 'index.html?c=hoodamath', 'Publisher builds that start instantly'],
  ];

  let palette = null;

  function openPalette(seed) {
    if (palette) { palette.input.focus(); if (seed) palette.setQuery(seed); return; }
    const overlay = document.createElement('div');
    overlay.className = 'cmdk-overlay';
    overlay.innerHTML = `
      <div class="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="cmdk-bar">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 1 1-4.32 13.64L3 19.85 3.94 20.8l3.18-3.18A7.5 7.5 0 0 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/></svg>
          <input type="text" placeholder="Search games, jump to a page, run an action…" autocomplete="off" spellcheck="false" aria-label="Command palette search">
          <kbd>esc</kbd>
        </div>
        <div class="cmdk-list" role="listbox"></div>
        <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>⌘</kbd><kbd>K</kbd> anywhere</span></div>
      </div>`;
    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const input = $('input', overlay);
    const list = $('.cmdk-list', overlay);
    let results = [];
    let active = 0;
    let games = [];

    const ACTIONS = [
      { label: 'Surprise me, random playable game', run: () => { location.href = 'play.html?id=' + pickRandom() ; } },
      { label: 'Surprise me from the ad-free shelf', run: () => { location.href = 'play.html?id=' + pickRandom(true); } },
      { label: 'Open settings', run: () => { close(); document.querySelector('#settingsBtn')?.click() || toast('Settings unavailable here'); } },
      { label: 'Toggle list / grid view', run: () => { const v = LS.get(K.view, 'grid') === 'grid' ? 'list' : 'grid'; LS.set(K.view, v); document.documentElement.dataset.view = v; toast(`View: ${v}`); } },
      { label: 'Toggle calm motion', run: () => { cyclePref('motion', ['full', 'calm']); } },
      { label: 'Cycle accent colour', run: () => { cyclePref('theme', ['aurora', 'cyan', 'violet', 'emerald', 'amber', 'crimson', 'ice', 'ocean', 'sunset', 'rose']); } },
      { label: 'Clear search history', run: () => { LS.del(K.searches); toast('Search history cleared'); } },
      { label: 'Export my data', run: () => exportData() },
      { label: 'Open keyboard shortcuts', run: () => { close(); shortcutSheet(); } },
    ];

    function cyclePref(key, values) {
      let p = {};
      try { p = JSON.parse(localStorage.getItem('zenou_prefs') || '{}'); } catch { /* ignore */ }
      const i = values.indexOf(p[key]);
      const next = values[(i + 1) % values.length];
      p[key] = next;
      try { localStorage.setItem('zenou_prefs', JSON.stringify(p)); } catch { /* ignore */ }
      document.documentElement.dataset[key] = next;
      toast(`${key}: ${next}`);
    }

    function pickRandom(adFree) {
      const pool = (games.length ? games : []).filter(g => !adFree || g.p !== 'pg');
      if (!pool.length) return '';
      return pool[Math.floor(Math.random() * pool.length)].id;
    }

    function setQuery(q) {
      input.value = q;
      render();
    }

    function render() {
      const q = input.value.trim().toLowerCase();
      list.innerHTML = '';
      results = [];
      const push = (group, items) => {
        if (!items.length) return;
        const gh = document.createElement('p');
        gh.className = 'cmdk-group';
        gh.textContent = group;
        list.append(gh);
        items.forEach(it => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'cmdk-item';
          b.innerHTML = `<span class="cmdk-ico"></span><span class="cmdk-txt"><b></b><small></small></span>`;
          $('.cmdk-ico', b).textContent = it.icon || '';
          $('b', b).textContent = it.label;
          const sm = $('small', b);
          if (it.sub) sm.textContent = it.sub; else sm.remove();
          b.addEventListener('click', () => run(it));
          b.addEventListener('mousemove', () => { active = results.indexOf(it); paintActive(); });
          list.append(b);
          results.push(it);
        });
      };

      push('Actions', ACTIONS.filter(a => !q || a.label.toLowerCase().includes(q)).slice(0, q ? 6 : 4).map(a => ({ ...a, icon: '⌘' })));
      push('Pages', PAGES.filter(p => !q || p[0].toLowerCase().includes(q) || p[2].toLowerCase().includes(q)).slice(0, 5)
        .map(p => ({ label: p[0], sub: p[2], icon: '→', run: () => { location.href = p[1]; } })));

      if (q) {
        const scored = [];
        for (const g of games) {
          const t = g.t.toLowerCase();
          let s = 0;
          if (t === q) s = 100;
          else if (t.startsWith(q)) s = 80;
          else if (t.split(/[\s-]+/).some(w => w.startsWith(q))) s = 60;
          else if (t.includes(q)) s = 40;
          else if ((g.cs || []).some(c => c.includes(q))) s = 20;
          else if ((g.a || '').toLowerCase().includes(q)) s = 12;
          if (s) scored.push([s, g]);
        }
        scored.sort((a, b) => b[0] - a[0] || (b[1].pc || 0) - (a[1].pc || 0));
        push('Games', scored.slice(0, 24).map(([, g]) => ({
          label: g.t,
          sub: [SOURCE_LABEL[g.s] || '', g.pc ? g.pc.toLocaleString() + ' plays' : '', (g.cs || [])[0] || ''].filter(Boolean).join(' · '),
          icon: '▶',
          run: () => { location.href = `play.html?id=${encodeURIComponent(g.id)}`; },
        })));
      }

      if (!q) {
        const recents = store.recent.slice(0, 5).map(r => games.find(g => g.id === r.id)).filter(Boolean);
        push('Pick up where you left off', recents.map(g => ({
          label: g.t, sub: 'Recently played', icon: '↺',
          run: () => { location.href = `play.html?id=${encodeURIComponent(g.id)}`; },
        })));
      }

      if (!results.length) {
        const p = document.createElement('p');
        p.className = 'cmdk-empty';
        p.textContent = games.length ? 'No match. Try a shorter word.' : 'Catalogue is still loading…';
        list.append(p);
      }
      active = 0;
      paintActive();
    }

    function paintActive() {
      $$('.cmdk-item', list).forEach((el, i) => el.classList.toggle('active', i === active));
      const el = $$('.cmdk-item', list)[active];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }

    function run(it) { if (!it) return; close(); it.run(); }

    function close() {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 160);
      palette = null;
      document.removeEventListener('keydown', key);
    }

    function key(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, results.length); paintActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + results.length) % Math.max(1, results.length); paintActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(results[active]); }
    }

    input.addEventListener('input', render);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', key);
    palette = { input, setQuery };

    render();
    input.focus();
    loadCatalog().then(list => { games = list; render(); });
  }

  const SOURCE_LABEL = { 'crazygames-official': 'CrazyGames', hoodamath: 'HoodaMath', scratch: 'Scratch', selfhosted: 'Hosted here', gamedistribution: 'GameDistribution' };

  /* ================================================================
     keyboard shortcuts sheet
     ================================================================ */
  const KEYMAP_KEY = 'zenou_keymap';
  const KEY_DEFAULTS = { search: '/', random: '4', games: '1', library: '2', settings: '3', shortcuts: '?' };
  function keymap() {
    return { ...KEY_DEFAULTS, ...(LS.get(KEYMAP_KEY, {}) || {}) };
  }
  function shortcutRows() {
    const map = keymap();
    return [
      ['⌘K / Ctrl K', 'Open the command palette'],
      [map.search, 'Focus search'],
      [map.random, 'Random playable game'],
      [map.games, 'Go to the games catalogue'],
      [map.library, 'My Library'],
      [map.settings, 'Open settings'],
      [map.shortcuts, 'This sheet'],
      ['Esc', 'Close any panel'],
      ['Space', 'Fullscreen on a game page'],
    ];
  }

  function shortcutSheet() {
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `<div class="sheet sheet-wide"><h3>Keyboard shortcuts</h3>
      <div class="kb-grid"></div>
      <p class="sheet-foot">Shortcuts are off while you are typing in a field.</p></div>`;
    const grid = $('.kb-grid', overlay);
    shortcutRows().forEach(([k, d]) => {
      const row = document.createElement('div');
      row.className = 'kb-row';
      row.innerHTML = '<kbd></kbd><span></span>';
      $('kbd', row).textContent = k;
      $('span', row).textContent = d;
      grid.append(row);
    });
    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 180); };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  /* ================================================================
     scroll progress + back to top
     ================================================================ */
  function mountScroll() {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'to-top';
    top.setAttribute('aria-label', 'Back to top');
    top.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 7-1.4 1.4L13 8.8V20h-2V8.8l-4.6 4.6L5 12z"/></svg>';
    top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.append(bar, top);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
        top.classList.toggle('show', window.scrollY > 700);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ================================================================
     first-run tour
     ================================================================ */
  const TOUR = [
    ['Search or press ⌘K', 'One box finds games, pages and actions. Try ⌘K (Ctrl K) for the command palette.'],
    ['Chips filter the shelf', '“No pre-roll ads” keeps only games that start without an ad screen.'],
    ['Everything is yours', 'Favourites, ratings, notes, playlists and stats live in this browser, no account.'],
  ];

  function tour() {
    let step = 0;
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay tour';
    overlay.innerHTML = `<div class="sheet sheet-narrow">
      <p class="tour-step"></p><h3 class="tour-title"></h3><p class="tour-body"></p>
      <div class="tour-actions">
        <button type="button" class="btn btn-ghost tour-skip">Skip</button>
        <button type="button" class="btn btn-solid tour-next">Next</button>
      </div></div>`;
    const paint = () => {
      $('.tour-step', overlay).textContent = `Step ${step + 1} of ${TOUR.length}`;
      $('.tour-title', overlay).textContent = TOUR[step][0];
      $('.tour-body', overlay).textContent = TOUR[step][1];
      $('.tour-next', overlay).textContent = step === TOUR.length - 1 ? 'Start playing' : 'Next';
    };
    const close = () => {
      LS.set(K.tour, true);
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 180);
    };
    $('.tour-skip', overlay).addEventListener('click', close);
    $('.tour-next', overlay).addEventListener('click', () => {
      if (step === TOUR.length - 1) { close(); return; }
      step++;
      paint();
    });
    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    paint();
  }

  /* ================================================================
     gamepad badge
     ================================================================ */
  function mountGamepad() {
    const badge = document.createElement('div');
    badge.className = 'gamepad-badge';
    badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10a5 5 0 0 1 4.9 6l-.6 2.4a3 3 0 0 1-4.9 1.5L14.5 16h-5l-1.9 1.9A3 3 0 0 1 2.7 16.4L2.1 14A5 5 0 0 1 7 8zm1 2v2H6v2h2v2h2v-2h2v-2h-2v-2H8zm8.5 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm2.5 2.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg><span>Controller connected</span>';
    document.body.append(badge);
    const paint = () => {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
      const has = pads.length > 0;
      badge.classList.toggle('show', has);
      if (has) $('span', badge).textContent = pads[0].id.slice(0, 34) || 'Controller connected';
    };
    window.addEventListener('gamepadconnected', paint);
    window.addEventListener('gamepaddisconnected', paint);
    setTimeout(paint, 1200);
  }

  /* ================================================================
     data export / import
     ================================================================ */
  const EXPORT_KEYS = [K.fav, K.recent, K.ratings, K.notes, K.playtime, K.hidden, K.playlists, K.xp, K.ach, K.days, 'zenou_prefs'];

  function exportData() {
    const out = { app: 'zenou-unblocked', v: 2, exported: new Date().toISOString(), data: {} };
    EXPORT_KEYS.forEach(k => {
      const v = localStorage.getItem(k);
      if (v != null) { try { out.data[k] = JSON.parse(v); } catch { out.data[k] = v; } }
    });
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zenou-backup-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Backup downloaded', `${Object.keys(out.data).length} settings and lists saved to a file.`);
  }

  function importData(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = JSON.parse(String(r.result));
          const data = parsed && parsed.data ? parsed.data : parsed;
          if (!data || typeof data !== 'object') throw new Error('Not a Zenou backup file.');
          let n = 0;
          EXPORT_KEYS.forEach(k => {
            if (data[k] == null) return;
            localStorage.setItem(k, JSON.stringify(data[k]));
            n++;
          });
          resolve(n);
        } catch (e) { reject(e); }
      };
      r.onerror = () => reject(new Error('That file could not be read.'));
      r.readAsText(file);
    });
  }

  /* ================================================================
     installable app
     ================================================================ */
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    document.documentElement.dataset.canInstall = '1';
  });

  async function install() {
    if (!installPrompt) { toast('Install unavailable', 'Use your browser menu → “Install app” or “Add to Home Screen”.'); return; }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') toast('Installed', 'Zenou now opens in its own window.');
    installPrompt = null;
  }

  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    // Keep local development honest: a cached shell would hide edits.
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline shell is optional */ });
  }

  /* ================================================================
     global keys
     ================================================================ */
  function mountKeys() {
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t && t.matches && t.matches('input, textarea, select, [contenteditable]');

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      const map = keymap();
      if (e.key === map.shortcuts) { e.preventDefault(); shortcutSheet(); }
      else if (e.key === map.search) {
        e.preventDefault();
        const box = document.querySelector('.searchbox input, #search');
        if (box) box.focus();
        else location.href = 'search.html';
      }
      else if (e.key === map.random) {
        const random = document.querySelector('#randomBtn');
        if (random) { e.preventDefault(); random.click(); }
      }
      else if (e.key === map.games) { location.href = 'index.html'; }
      else if (e.key === map.library) { location.href = 'library.html'; }
      else if (e.key === map.settings) { document.querySelector('#settingsBtn')?.click(); }
    });
  }

  /* ================================================================
     expose + boot
     ================================================================ */
  window.Zenou = {
    store, K, LS, toast, gameCard, playlistPicker, ratingRow, createPlaylist, addToPlaylist,
    hideGame, stats, levelFor, addXp, checkAchievements, markDay, achievements: ACHIEVEMENTS,
    openPalette, shortcutSheet, exportData, importData, install, loadCatalog,
    keymap,
    canInstall: () => !!installPrompt,
    dayKey, streakOf,
  };

  function boot() {
    document.documentElement.dataset.view = LS.get(K.view, 'grid');
    mountKeys();
    mountScroll();
    mountGamepad();
    registerWorker();
    const isHome = /(^|\/)(index\.html)?(\?.*)?$/.test(location.pathname + location.search) || location.pathname.endsWith('index.html');
    if (isHome && !LS.get(K.tour, false) && !store.recent.length) setTimeout(tour, 900);
    loadCatalog().then(() => checkAchievements({ quiet: true }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
