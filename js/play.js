/* Zenou Unblocked, game player page. */
'use strict';

const $ = (sel) => document.querySelector(sel);

const store = {
  get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const favs = new Set(store.get('zenou_fav', []));
function touchRecent(id) {
  const r = store.get('zenou_recent', []).filter(x => x && x.id !== id);
  r.unshift({ id, ts: Date.now() });
  store.set('zenou_recent', r.slice(0, 60));
}

const PLAY_MODE = {
  lo: { source: 'this site (open source)', how: 'Runs entirely from this website\'s own hosting, no third-party portals, no pre-game ads.' },
  pf: { source: 'the game’s own publisher', how: 'Embedded directly from the publisher’s own service, the same build CrazyGames frames.' },
  pg: { source: 'CrazyGames', how: 'Embedded from the official build CrazyGames uses, their game-file host or the publisher’s own server, with the publisher’s pre-game screen when one exists.' },
  sc: { source: 'Scratch', how: 'Runs in the official Scratch player. Credit stays with the project’s creator.' },
  hm: { source: 'HoodaMath', how: 'Plays from HoodaMath’s own game build, no portal shell and no pre-game gate.' },
  gamedistribution: { source: 'GameDistribution', how: 'Embedded from the publisher’s official GameDistribution build.' },
};
const MODE_FALLBACK = { source: 'the publisher', how: '' };

async function boot() {
  const p = new URLSearchParams(location.search);
  const id = p.get('id') || '';
  let GAMES;
  try {
    const res = await fetch('catalog/games.json?v=2026-10-30k');
    if (!res.ok) throw new Error(res.status);
    GAMES = (await res.json()).games;
  } catch {
    $('#main').innerHTML = '<p class="empty">The catalog failed to load, refresh in a moment.</p>';
    return;
  }
  const g = GAMES.find(x => x.id === id);
  if (!g) {
    $('#missingView').hidden = false;
    return;
  }

  document.title = window.zenouMaskedTitle
    ? window.zenouMaskedTitle(`${g.t}, Zenou Unblocked`)
    : `${g.t}, Zenou Unblocked`;
  touchRecent(g.id);
  if (g.wrap || g.direct) { location.replace(g.wrap ? g.u : g.direct); return; }
  $('#playerView').hidden = false;

  // header info
  $('#gTitle').textContent = g.t;
  const mode = PLAY_MODE[g.p] || MODE_FALLBACK;
  const meta = [];
  if (g.s === 'scratch' && g.a) meta.push(`Scratch project by @${g.a}`);
  else if (g.s === 'scratch') meta.push('Scratch community project');
  else if (g.s === 'selfhosted') meta.push('Open source · hosted in this repository');
  else if (g.s === 'hoodamath') meta.push('HoodaMath build · plays in this page');
  else meta.push(`Published on ${mode.source}`);
  if (g.pc) meta.push(`${g.pc.toLocaleString()} plays`);
  $('#gMeta').textContent = meta.join(' · ');

  // category chips (link home)
  const tags = $('#gCats');
  tags.innerHTML = '';
  (g.cs || []).slice(0, 6).forEach(c => {
    const s = document.createElement('span');
    s.textContent = c.replace(/-/g, ' ');
    tags.append(s);
  });

  $('#gSource').textContent = g.s === 'scratch'
    ? `Original project & rights: @${g.a || 'Scratch creator'}`
    : g.s === 'selfhosted'
      ? 'Original author keeps copyright · MIT licence permits this copy'
      : `Rights stay with the publisher · listed from ${mode.source}`;

  // publisher gate hint for CrazyGames file-host embeds
    if (g.p === 'pg') {
    $('#embedNote').hidden = false;
    $('#embedNote').textContent = 'A short pre-game ad may play first, heavy titles can take a minute. If a publisher hard-locks its title, pick another game from “More like this” below.';
  } else if (g.p === 'pf') {
    $('#embedNote').hidden = false;
    $('#embedNote').textContent = 'Loads straight from the developer\'s own hosting, no portal shell.';
  } else if (g.p === 'lo') {
    $('#embedNote').hidden = false;
    $('#embedNote').textContent = 'Fully hosted in this repository (MIT-licensed), no third-party sites, no ads, no pre-game screen.';
  } else if (g.p === 'hm') {
    $('#embedNote').hidden = false;
    $('#embedNote').textContent = 'Runs from HoodaMath’s own game build, no portal shell and no pre-game gate.';
  }

  // copy a shareable link
  const shareBtn = $('#shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const label = shareBtn.querySelector('span');
      try {
        await navigator.clipboard.writeText(location.href);
        label.textContent = 'Link copied';
      } catch {
        label.textContent = 'Copy failed';
      }
      setTimeout(() => { label.textContent = 'Copy link'; }, 1600);
    });
  }

  // favorite toggle
  const favBtn = $('#favBtn');
  const setFav = (on) => {
    favBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    favBtn.querySelector('span').textContent = on ? 'Favorited' : 'Favorite';
  };
  setFav(favs.has(g.id));
  favBtn.addEventListener('click', () => {
    const on = !favs.has(g.id);
    if (on) favs.add(g.id); else favs.delete(g.id);
    store.set('zenou_fav', [...favs]);
    setFav(on);
  });

  // visualization of the game itself
  {
    const frame = $('#gameFrame');
    const loading = $('#loading');
    const loadMsg = loading.querySelector('p');
    const startCopy = {
      sc: 'Starting the Scratch player…',
      hm: 'Loading the game build…',
      lo: 'Starting the game from this site…',
      pf: 'Loading the publisher’s build…',
      pg: 'Starting the game…',
    };
    if (g.mb && g.mb > 12) loadMsg.textContent = `Large game (~${g.mb} MB), first load can take up to a minute…`;
    else if (startCopy[g.p]) loadMsg.textContent = startCopy[g.p];
    let loaded = false;
    const failTimer = setTimeout(() => {
      if (!loaded) loadMsg.textContent = 'Still loading, big builds take a moment on a slow connection…';
    }, 8000);
    const errorTimer = setTimeout(() => {
      if (!loaded) showFail(g);
    }, 45000);
    frame.addEventListener('load', () => {
      loaded = true;
      clearTimeout(failTimer);
      clearTimeout(errorTimer);
      loading.classList.add('done');
    });
    frame.src = g.u;
    frame.hidden = false;

    // adjustable sound for same-origin (locally hosted) games
    const sndBtn = $('#sndBtn');
    if (g.p === 'lo') {
      let muted = store.get('zenou_mute', false);
      const applyMute = () => {
        try {
          const d = frame.contentDocument;
          d.querySelectorAll('audio,video').forEach(el => {
            el.muted = muted;
            try { el.volume = muted ? 0 : el.volume || 1; } catch { /* */ }
          });
          const w = frame.contentWindow;
          for (const k of Object.getOwnPropertyNames(w)) {
            let v; try { v = w[k]; } catch { continue; }
            if (w.AudioContext && v instanceof w.AudioContext) {
              if (muted) v.suspend?.(); else v.resume?.();
            }
          }
          // games that build their audio engine after START need a trap too
          if (!w.__zenouAudioTrapped && w.AudioContext) {
            const Orig = w.AudioContext;
            try {
              w.AudioContext = class extends Orig {
                constructor(...a) {
                  super(...a);
                  if (muted) this.suspend?.();
                }
              };
              w.__zenouAudioTrapped = true;
            } catch { /* keep original */ }
          }
        } catch { /* cross-origin, browser blocks access */ }
      };
      const paint = () => sndBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      sndBtn.hidden = false;
      paint();
      frame.addEventListener('load', () => { applyMute(); setTimeout(applyMute, 1500); });
      sndBtn.addEventListener('click', () => {
        muted = !muted;
        store.set('zenou_mute', muted);
        paint();
        applyMute();
      });
    }

    $('#fsBtn').addEventListener('click', () => {
      const el = $('.frame-wrap');
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen?.();
    });
  }

  // related games (same primary category)
  const pool = GAMES.filter(x =>
    x.id !== g.id
    && (!g.cs || x.cs?.some(c => g.cs.includes(c)))
  ).slice(0, 24);
  const rg = $('#relatedGrid');
  pool.forEach(x => rg.append(relatedCard(x)));

  $('#backBtn').addEventListener('click', () => {
    if (history.length > 1) history.back(); else location.href = 'index.html';
  });

  /* Space toggles fullscreen unless the user is typing somewhere */
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && t.matches && t.matches('input, textarea, select, [contenteditable], button, a')) return;
    e.preventDefault();
    if (document.fullscreenElement) document.exitFullscreen();
    else $('.frame-wrap')?.requestFullscreen?.();
  });

  setupTools(g);
}

/* ----------------------------------------------------------------
   Everything local: ratings, notes, playtime, playlists, reports.
   Uses the shared store from js/zenou-plus.js when it is available.
   ---------------------------------------------------------------- */
function setupTools(g) {
  const Z = window.Zenou;
  const host = $('#zenouTools');
  if (!host) return;
  host.hidden = false;

  /* local playtime, flushed on hide/unload so a quick tab close still counts */
  const playtime = Z ? Z.store.playtime : store.get('zenou_playtime', {});
  const started = Date.now();
  let banked = 0;
  const flush = () => {
    const now = Date.now();
    const add = now - started - banked;
    if (add < 1000) return;
    banked += add;
    playtime[g.id] = (playtime[g.id] || 0) + add;
    if (Z) { Z.store.playtime = playtime; Z.store.savePlaytime(); }
    else store.set('zenou_playtime', playtime);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);

  const timer = $('#sessionTimer');
  let tick = 0;
  const paintTimer = () => {
    const secs = Math.floor((Date.now() - started) / 1000);
    timer.textContent = `Session ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  };
  paintTimer();
  tick = setInterval(paintTimer, 1000);
  window.addEventListener('pagehide', () => clearInterval(tick));

  /* award xp + streak once per visit */
  if (Z) {
    Z.markDay();
    Z.addXp(5);
    setTimeout(() => Z.checkAchievements(), 1200);
  }

  /* ad-free badge */
  const adFree = g.p !== 'pg';
  const badge = $('#adFreeBadge');
  if (badge && adFree) badge.hidden = false;

  /* rating */
  const ratingHost = $('#ratingHost');
  if (ratingHost && Z) {
    const label = document.createElement('div');
    label.className = 'filter-row';
    const cap = document.createElement('span');
    cap.textContent = 'Your rating';
    label.append(cap, Z.ratingRow(g.id, (v) => {
      if (v) Z.toast(`Rated ${v}/5`, g.t);
    }));
    ratingHost.append(label);
  }

  /* notes */
  const note = $('#noteBox');
  if (note && Z) {
    note.value = Z.store.notes[g.id] || '';
    let t = 0;
    note.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const v = note.value.trim();
        if (v) Z.store.notes[g.id] = v.slice(0, 600);
        else delete Z.store.notes[g.id];
        Z.store.saveNotes();
        Z.addXp(1);
      }, 500);
    });
  }

  /* playlist + restart + report */
  $('#playlistBtn')?.addEventListener('click', () => { if (Z) Z.playlistPicker(g.id, g.t); });

  $('#restartBtn')?.addEventListener('click', () => {
    const frame = $('#gameFrame');
    if (!frame || frame.hidden) { location.reload(); return; }
    const src = frame.src;
    frame.src = 'about:blank';
    setTimeout(() => { frame.src = src; }, 120);
    if (Z) Z.toast('Restarted', g.t);
  });

  $('#reportBtn')?.addEventListener('click', () => {
    if (!Z) return;
    Z.store.reported = Z.store.reported.filter(r => r.id !== g.id);
    Z.store.reported.unshift({ id: g.id, t: g.t, ts: Date.now() });
    Z.LS.set('zenou_reported', Z.store.reported.slice(0, 100));
    Z.toast('Report saved', 'The list lives in My Library → Data. Thanks, it gets checked.');
  });
}

function showFail(g) {
  $('#loading').classList.add('done');
  $('#errorPanel').hidden = false;
  const btn = $('#retryBtn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      $('#errorPanel').hidden = true;
      $('#loading').classList.remove('done');
      const frame = $('#gameFrame');
      frame.src = 'about:blank';
      setTimeout(() => { frame.src = g.u; }, 120);
    });
  }
}

function relatedCard(g) {
  const a = document.createElement('a');
  a.className = 'card';
  a.href = `play.html?id=${encodeURIComponent(g.id)}`;
  if (g.img) {
    const img = document.createElement('img');
    img.className = 'card-thumb';
    img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
    img.src = g.img;
    img.onerror = () => { const pl = document.createElement('span'); pl.className = 'card-plaque'; pl.textContent = '▶'; img.replaceWith(pl); };
    a.append(img);
  } else {
    const pl = document.createElement('span');
    pl.className = 'card-plaque';
    pl.textContent = '▶';
    a.append(pl);
  }
  const play = document.createElement('span');
  play.className = 'card-play-badge';
  play.innerHTML = '<i><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></i>';
  const nm = document.createElement('span');
  nm.className = 'card-name';
  nm.textContent = g.t;
  a.append(play, nm);
  return a;
}

boot();
