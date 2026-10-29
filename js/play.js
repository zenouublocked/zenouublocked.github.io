/* Zenou Unblocked — game player page. */
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
  lo: { source: 'this site (open source)', how: 'Runs entirely from this website\'s own hosting — no third-party portals, no pre-game ads.' },
  pf: { source: 'the game’s own publisher', how: 'Embedded directly from the publisher’s own service — the same build CrazyGames frames.' },
  pg: { source: 'CrazyGames', how: 'Embedded through CrazyGames’ official game-file host, with the publisher’s own pre-game screen when one exists.' },
  sc: { source: 'Scratch', how: 'Runs in the official Scratch player. Credit stays with the project’s creator.' },
  ex: { source: '', how: '' },
};

async function boot() {
  const p = new URLSearchParams(location.search);
  const id = p.get('id') || '';
  let GAMES;
  try {
    const res = await fetch('catalog/games.json');
    if (!res.ok) throw new Error(res.status);
    GAMES = (await res.json()).games;
  } catch {
    $('#main').innerHTML = '<p class="empty">The catalog failed to load — refresh in a moment.</p>';
    return;
  }
  const g = GAMES.find(x => x.id === id);
  if (!g) {
    $('#missingView').hidden = false;
    return;
  }

  document.title = window.zenouMaskedTitle
    ? window.zenouMaskedTitle(`${g.t} — Zenou Unblocked`)
    : `${g.t} — Zenou Unblocked`;
  touchRecent(g.id);
  $('#playerView').hidden = false;

  // header info
  $('#gTitle').textContent = g.t;
  const mode = PLAY_MODE[g.p] || PLAY_MODE.cg;
  const meta = [];
  if (g.s === 'scratch' && g.a) meta.push(`Scratch project by @${g.a}`);
  else if (g.s === 'scratch') meta.push('Scratch community project');
  else if (g.s === 'poki') meta.push('Poki official page');
  else if (g.s === 'selfhosted') meta.push('Open source · hosted in this repository');
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

  $('#officialLink').href = g.g || g.u;
  $('#gSource').textContent = g.s === 'scratch'
    ? `Original project & rights: @${g.a || 'Scratch creator'}`
    : g.s === 'selfhosted'
      ? 'Original author keeps copyright · MIT licence permits this copy'
      : `Rights stay with the publisher · listed from ${mode.source}`;

  // publisher gate hint for CrazyGames file-host embeds
    if (g.p === 'pg') {
    $('#embedNote').hidden = false;
    $('#embedNote').textContent = 'A short pre-game ad may play first — heavy titles can take a minute. If the game never appears, use the Official site button above.';
  } else if (g.p === 'pf') {
    $('#embedNote').hidden = false;
    $('#embedNote').textContent = 'Loads straight from the developer\'s own hosting — no portal shell.';
  } else if (g.p === 'lo') {
    $('#embedNote').hidden = false;
    $('#embedNote').textContent = 'Fully hosted in this repository (MIT-licensed) — no third-party sites, no ads, no pre-game screen.';
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
  if (g.p !== 'ex') {
    const frame = $('#gameFrame');
    const loading = $('#loading');
    const loadMsg = loading.querySelector('p');
    if (g.mb && g.mb > 12) loadMsg.textContent = `Large game (~${g.mb} MB) — first load can take up to a minute…`;
    let loaded = false;
    const failTimer = setTimeout(() => {
      if (!loaded) loadMsg.textContent = 'Still loading… heavy games download a lot. A short ad screen may show first.';
    }, 8000);
    const errorTimer = setTimeout(() => {
      if (!loaded) showFail(g);
    }, 30000);
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
        } catch { /* cross-origin — browser blocks access */ }
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
  } else {
    // publisher does not allow embedding — never pretend otherwise
    $('#frameWrap').hidden = true;
    $('#fsBtn').remove();
    $('#externalPanel').hidden = false;
    $('#externalBtn').href = g.g || g.u;
    $('#externalReason').textContent = g.note
      ? g.note
      : g.s === 'poki'
        ? "Poki keeps its games on poki.com and doesn't allow embedding them elsewhere."
        : `The publisher of this game doesn't allow it to be embedded on other websites. It opens on ${mode.source || 'its official site'} in a new tab.`;
    $('#externalPanel').hidden = false;
  }

  // related games (same primary category, embeddable first)
    const pool = GAMES.filter(x =>
      x.id !== g.id
      && (!g.cs || x.cs?.some(c => g.cs.includes(c)))
    ).sort((a, b) => (a.p === 'ex') - (b.p === 'ex'))
      .slice(0, 24);
  const rg = $('#relatedGrid');
  pool.forEach(x => rg.append(relatedCard(x)));

  $('#backBtn').addEventListener('click', () => {
    if (history.length > 1) history.back(); else location.href = 'index.html';
  });
}

function showFail(g) {
  $('#loading').classList.add('done');
  $('#errorPanel').hidden = false;
  $('#errorOfficial').href = g.g || g.u;
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
