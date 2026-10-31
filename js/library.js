/* Zenou Unblocked, My Library hub.
 *
 * Nine panels over one local store: overview + stats, favourites, recent,
 * playlists, ratings & notes, achievements, hidden games, the film shelf and
 * the data tools. No account, no server, it all lives in this browser.
 */
'use strict';

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  let GAMES = [];
  let byId = new Map();
  let Z = null;

  const fmtDuration = (ms) => {
    const m = Math.round(ms / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  const empty = (panel, text, cta) => {
    panel.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'lib-empty';
    p.textContent = text;
    panel.append(p);
    if (cta) {
      const a = document.createElement('a');
      a.className = 'btn btn-solid';
      a.href = cta[1];
      a.textContent = cta[0];
      panel.append(a);
    }
  };

  const sectionHead = (panel, title, sub) => {
    panel.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'lib-head';
    const h = document.createElement('h2');
    h.textContent = title;
    head.append(h);
    if (sub) {
      const p = document.createElement('p');
      p.textContent = sub;
      head.append(p);
    }
    panel.append(head);
    return head;
  };

  const gridFor = (list, extra) => {
    const grid = document.createElement('div');
    grid.className = 'grid';
    list.forEach(g => grid.append(Z.gameCard(g, extra)));
    return grid;
  };

  /* ---------------- overview ---------------- */
  function renderOverview() {
    const panel = $('#panel-overview');
    panel.innerHTML = '';
    const s = Z.stats();
    const lv = Z.levelFor(Z.store.xp);

    const card = document.createElement('div');
    card.className = 'xp-card';
    card.innerHTML = `
      <div class="xp-top">
        <div class="xp-level"><b>${lv.level}</b><span>level</span></div>
        <div class="xp-note">${Z.store.xp.toLocaleString()} XP · ${lv.into} / ${lv.span} to level ${lv.level + 1}</div>
      </div>
      <div class="xp-bar"><i style="width:${Math.max(2, Math.round((lv.into / lv.span) * 100))}%"></i></div>
      <div class="xp-note">${Z.store.ach.size} of ${Z.achievements.length} achievements · ${s.streak > 0 ? `${s.streak}-day streak` : 'no streak yet'}</div>`;
    panel.append(card);

    const stats = document.createElement('div');
    stats.className = 'stat-grid';
    [
      [`${s.played}`, 'games played', `${fmtDuration(s.ms)} total`],
      [`${fmtDuration(s.ms)}`, 'time in games', `across ${Object.keys(Z.store.playtime).length} titles`],
      [`${s.cats}`, 'categories', `${s.sources} sources tried`],
      [`${s.favs}`, 'favourites', `${s.rated} rated`],
      [`${s.playlists}`, 'playlists', `${s.hidden} hidden`],
      [`${s.streak}`, 'day streak', s.streak > 0 ? 'keep it going' : 'play today to start'],
    ].forEach(([v, label, note]) => {
      const d = document.createElement('div');
      d.className = 'stat-card';
      d.innerHTML = '<b></b><span></span><em></em>';
      $('b', d).textContent = v;
      $('span', d).textContent = label;
      $('em', d).textContent = note;
      stats.append(d);
    });
    panel.append(stats);

    const recent = Z.store.recent.map(r => byId.get(r.id)).filter(Boolean).slice(0, 12);
    if (recent.length) {
      const h = document.createElement('h3');
      h.className = 'section-title';
      h.style.marginTop = '26px';
      h.textContent = 'Continue playing';
      panel.append(h, gridFor(recent));
    } else {
      const p = document.createElement('p');
      p.className = 'lib-empty';
      p.style.marginTop = '22px';
      p.textContent = 'Nothing played yet. Pick something from the arcade and it will show up here.';
      const a = document.createElement('a');
      a.className = 'btn btn-solid';
      a.href = 'index.html';
      a.textContent = 'Browse games';
      panel.append(p, a);
    }

    if (s.cats) {
      /* source tags live in the same list as genres, keep the chart about genres */
      const SOURCE_TAGS = new Set(['selfhosted', 'scratch', 'crazygames-official', 'poki-official', 'neal-fun', 'multiplayer']);
      const counts = new Map();
      Object.keys(Z.store.playtime).forEach(id => {
        const g = byId.get(id);
        if (!g) return;
        (g.cs || []).filter(c => !SOURCE_TAGS.has(c)).slice(0, 2)
          .forEach(c => counts.set(c, (counts.get(c) || 0) + 1));
      });
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (top.length) {
        const h = document.createElement('h3');
        h.className = 'section-title';
        h.style.marginTop = '26px';
        h.textContent = 'Where your time goes';
        const bars = document.createElement('div');
        bars.className = 'bars';
        const max = top[0][1];
        top.forEach(([cat, n]) => {
          const row = document.createElement('div');
          row.className = 'bar-row';
          row.innerHTML = `<span>${cat.replace(/-/g, ' ')}</span><div class="bar-track"><i style="width:${Math.round((n / max) * 100)}%"></i></div><b>${n}</b>`;
          bars.append(row);
        });
        panel.append(h, bars);
      }
    }
  }

  /* ---------------- simple lists ---------------- */
  function renderFavourites() {
    const panel = $('#panel-favourites');
    const list = [...Z.store.favs].map(id => byId.get(id)).filter(Boolean);
    if (!list.length) return empty(panel, 'No favourites yet. Tap the heart on any game page.', ['Browse games', 'index.html']);
    sectionHead(panel, `Favourites (${list.length})`, 'Stored in this browser');
    panel.append(gridFor(list));
  }

  function renderRecent() {
    const panel = $('#panel-recent');
    const list = Z.store.recent.map(r => byId.get(r.id)).filter(Boolean);
    if (!list.length) return empty(panel, 'Your history is empty.', ['Browse games', 'index.html']);
    sectionHead(panel, `Recently played (${list.length})`, 'Most recent first');
    panel.append(gridFor(list, { actions: false }));
  }

  function renderHidden() {
    const panel = $('#panel-hidden');
    const list = [...Z.store.hidden].map(id => byId.get(id)).filter(Boolean);
    if (!list.length) return empty(panel, 'Nothing hidden. Use the × on any card to hide a game you are not into.');
    sectionHead(panel, `Hidden (${list.length})`, 'Click a card to bring the game back');
    const grid = document.createElement('div');
    grid.className = 'grid';
    list.forEach(g => {
      const a = Z.gameCard(g, { actions: false });
      a.href = '#';
      a.title = 'Unhide';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        Z.store.hidden.delete(g.id);
        Z.store.saveHidden();
        Z.toast('Restored', g.t);
        renderHidden();
      });
      grid.append(a);
    });
    panel.append(grid);
  }

  /* ---------------- ratings & notes ---------------- */
  function renderRatings() {
    const panel = $('#panel-ratings');
    const ids = new Set([...Object.keys(Z.store.ratings), ...Object.keys(Z.store.notes)]);
    const list = [...ids].map(id => byId.get(id)).filter(Boolean)
      .sort((a, b) => (Z.store.ratings[b.id] || 0) - (Z.store.ratings[a.id] || 0));
    if (!list.length) return empty(panel, 'Rate a game or write a note on its page and it will be collected here.', ['Browse games', 'index.html']);
    sectionHead(panel, `Ratings & notes (${list.length})`, 'Your own scores, kept locally');
    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gap = '12px';
    list.forEach(g => {
      const row = document.createElement('div');
      row.className = 'play-side-card';
      const title = document.createElement('a');
      title.href = `play.html?id=${encodeURIComponent(g.id)}`;
      title.textContent = g.t;
      title.style.fontWeight = '650';
      row.append(title);
      if (Z.store.ratings[g.id]) row.append(Z.ratingRow(g.id, () => renderRatings()));
      if (Z.store.notes[g.id]) {
        const n = document.createElement('p');
        n.style.margin = '0';
        n.style.color = 'var(--muted)';
        n.style.fontSize = '13px';
        n.textContent = Z.store.notes[g.id];
        row.append(n);
      }
      wrap.append(row);
    });
    panel.append(wrap);
  }

  /* ---------------- playlists ---------------- */
  function renderPlaylists() {
    const panel = $('#panel-playlists');
    panel.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'lib-head';
    head.innerHTML = '<h2>Playlists</h2><p>Any collection of games you want to come back to.</p>';
    const createBtn = document.createElement('button');
    createBtn.className = 'btn btn-solid';
    createBtn.type = 'button';
    createBtn.textContent = 'New playlist';
    head.append(createBtn);
    panel.append(head);

    createBtn.addEventListener('click', () => {
      const name = prompt('Playlist name');
      if (!name || !name.trim()) return;
      const p = Z.createPlaylist(name.trim());
      Z.toast('Playlist created', p.name);
      renderPlaylists();
    });

    if (!Z.store.playlists.length) {
      const p = document.createElement('p');
      p.className = 'lib-empty';
      p.textContent = 'No playlists yet. Create one, or use “Add to playlist” on any game page.';
      panel.append(p);
      return;
    }

    Z.store.playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'play-side-card';
      card.style.marginBottom = '14px';
      const head2 = document.createElement('div');
      head2.className = 'lib-head';
      head2.style.marginBottom = '0';
      const h = document.createElement('h3');
      h.style.margin = '0';
      h.style.fontSize = '17px';
      h.textContent = `${pl.name} · ${pl.ids.length}`;
      const tools = document.createElement('div');
      tools.className = 'play-tools';

      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'btn btn-solid';
      play.textContent = 'Shuffle play';
      play.addEventListener('click', () => {
        const pool = pl.ids.map(id => byId.get(id)).filter(Boolean);
        if (!pool.length) { Z.toast('Nothing playable in this playlist'); return; }
        location.href = `play.html?id=${encodeURIComponent(pool[Math.floor(Math.random() * pool.length)].id)}`;
      });

      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'btn btn-ghost';
      rename.textContent = 'Rename';
      rename.addEventListener('click', () => {
        const name = prompt('New name', pl.name);
        if (!name || !name.trim()) return;
        pl.name = name.trim().slice(0, 60);
        Z.store.savePlaylists();
        renderPlaylists();
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-ghost';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (!confirm(`Delete “${pl.name}”?`)) return;
        Z.store.playlists = Z.store.playlists.filter(x => x.id !== pl.id);
        Z.store.savePlaylists();
        Z.toast('Playlist deleted');
        renderPlaylists();
      });

      tools.append(play, rename, del);
      head2.append(h, tools);
      card.append(head2);

      const games = pl.ids.map(id => byId.get(id)).filter(Boolean);
      if (games.length) card.append(gridFor(games));
      else {
        const p = document.createElement('p');
        p.className = 'lib-empty';
        p.style.padding = '10px 0';
        p.textContent = 'Empty, add games from their player page.';
        card.append(p);
      }
      panel.append(card);
    });
  }

  /* ---------------- achievements ---------------- */
  function renderAchievements() {
    const panel = $('#panel-achievements');
    sectionHead(panel, `Achievements (${Z.store.ach.size} / ${Z.achievements.length})`, 'Unlocking one is worth 25 XP');
    const grid = document.createElement('div');
    grid.className = 'ach-grid';
    Z.achievements.forEach(a => {
      const d = document.createElement('div');
      d.className = 'ach' + (Z.store.ach.has(a.id) ? ' on' : '');
      d.innerHTML = '<i></i><b></b><span></span>';
      $('i', d).textContent = Z.store.ach.has(a.id) ? a.icon : '🔒';
      $('b', d).textContent = a.name;
      $('span', d).textContent = a.desc;
      grid.append(d);
    });
    panel.append(grid);
  }

  /* ---------------- data ---------------- */
  function renderData() {
    const panel = $('#panel-data');
    panel.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'lib-head';
    head.innerHTML = '<h2>Your data</h2><p>Local only. Take a copy before you clear site data.</p>';
    panel.append(head);

    const box = document.createElement('div');
    box.className = 'play-side-card';
    box.innerHTML = `
      <h3>Backup</h3>
      <p class="xp-note">One JSON file with favourites, ratings, notes, playtime, playlists, achievements and appearance settings.</p>
      <div class="play-tools">
        <button class="btn btn-solid" type="button" id="exportBtn">Export backup</button>
        <label class="btn btn-ghost" style="cursor:pointer">
          Import backup
          <input type="file" id="importFile" accept="application/json" hidden>
        </label>
        <button class="btn btn-ghost" type="button" id="resetBtn">Reset everything</button>
      </div>`;
    panel.append(box);

    $('#exportBtn', box).addEventListener('click', () => Z.exportData());
    $('#importFile', box).addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const n = await Z.importData(f);
        Z.toast('Imported', `${n} collections restored. Reloading…`);
        setTimeout(() => location.reload(), 900);
      } catch (err) {
        Z.toast('Import failed', err.message);
      }
    });
    $('#resetBtn', box).addEventListener('click', () => {
      if (!confirm('Clear favourites, ratings, notes, playtime, playlists, achievements and appearance settings?')) return;
      ['zenou_fav', 'zenou_recent', 'zenou_ratings', 'zenou_notes', 'zenou_playtime', 'zenou_hidden',
        'zenou_playlists', 'zenou_xp', 'zenou_ach', 'zenou_days', 'zenou_prefs', 'zenou_bgimg', 'zenou_view',
        'zenou_searches', 'zenou_reported'].forEach(k => localStorage.removeItem(k));
      location.reload();
    });

    const rep = document.createElement('div');
    rep.className = 'play-side-card';
    rep.style.marginTop = '14px';
    rep.innerHTML = '<h3>Reported games</h3>';
    if (!Z.store.reported.length) {
      const p = document.createElement('p');
      p.className = 'xp-note';
      p.textContent = 'None. Use “Report broken” on a game page if an embed stops loading.';
      rep.append(p);
    } else {
      const ul = document.createElement('div');
      ul.style.display = 'grid';
      ul.style.gap = '6px';
      Z.store.reported.slice(0, 20).forEach(r => {
        const row = document.createElement('div');
        row.className = 'play-tools';
        const a = document.createElement('a');
        a.href = `play.html?id=${encodeURIComponent(r.id)}`;
        a.textContent = r.t || r.id;
        a.style.fontSize = '13px';
        row.append(a);
        ul.append(row);
      });
      rep.append(ul);
    }
    panel.append(rep);
  }

  /* ---------------- tabs ---------------- */
  const RENDERERS = {
    overview: renderOverview,
    favourites: renderFavourites,
    recent: renderRecent,
    playlists: renderPlaylists,
    ratings: renderRatings,
    achievements: renderAchievements,
    hidden: renderHidden,
    data: renderData,
  };

  function select(tab) {
    $$('.lib-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $$('.lib-panel').forEach(p => { p.hidden = p.id !== `panel-${tab}`; });
    const fn = RENDERERS[tab];
    if (fn) fn();
    history.replaceState(null, '', `library.html#${tab}`);
  }

  async function boot() {
    Z = window.Zenou;
    if (!Z) { console.warn('library: shared layer missing'); return; }
    try {
      const res = await fetch('catalog/games.json?v=2026-10-31b');
      const data = await res.json();
      GAMES = data.games;
      byId = new Map(GAMES.map(g => [g.id, g]));
    } catch {
      GAMES = [];
    }
    $$('.lib-tab').forEach(b => b.addEventListener('click', () => select(b.dataset.tab)));
    const start = (location.hash || '').replace('#', '');
    select(RENDERERS[start] ? start : 'overview');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
