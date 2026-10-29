/* Zenou Unblocked — Music page.
 * Discovery: Spotify web search (no API key / terms conflict in browser).
 * Playback: official Spotify embed + official SoundCloud Widget for pasted links.
 */
'use strict';

(async function () {
  const grid = $('#tgrid');
  const qForm = $('#musSearch');
  const qIn = $('#q');
  const listTitle = $('#listTitle');

  /* instructions + paste box */
  const hero = document.createElement('div');
  hero.className = 'setup-note';
  hero.innerHTML = `
    <h2>Search & play</h2>
    <p>Search songs or artists officially on <a href="https://open.spotify.com/search/" target="_blank" rel="noopener">Spotify</a> — then paste the Spotify link (or any SoundCloud track/playlist link) below. Playback runs inside Spotify's and SoundCloud's own official players:</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
      <input id="pasteUrl" type="url" placeholder="https://open.spotify.com/track/…" style="flex:1;min-width:240px;background:var(--panel);border:1px solid var(--line-strong);border-radius:999px;padding:10px 16px;color:var(--text);font:inherit;outline:none">
      <button id="pasteBtn" class="btn btn-solid" type="button">Queue it</button>
    </div>
    <p style="font-size:12.5px">Spotify embeds play a 30-second preview for signed-out visitors — the same behaviour as any other site with Spotify's official embed.</p>`;
  $('#rails').innerHTML = '';
  $('#rails').append(hero);

  /* starter chip row linking official Spotify searches (permitted deep links) */
  const chips = document.createElement('div');
  chips.className = 'chip-row';
  ['Pop hits', 'Hip-Hop', 'Rock', 'Lo-fi beats', 'Electronic', 'Classical', 'Jazz'].forEach(label => {
    const b = document.createElement('a');
    b.className = 'chip';
    b.href = `https://open.spotify.com/search/${encodeURIComponent(label)}`;
    b.target = '_blank'; b.rel = 'noopener';
    b.textContent = `${label} ↗`;
    chips.append(b);
  });
  $('#rails').append(chips);

  grid.innerHTML = '';
  for (let i = 0; i < 6; i++) { const sk = document.createElement('div'); sk.className = 'skl'; sk.style.aspectRatio = 'auto'; sk.style.height = '72px'; grid.append(sk); }
  grid.innerHTML = '<p style="color:var(--muted)">Queue builds as you paste links — it persists in this browser.</p>';
  listTitle.textContent = 'Your queue';

  function paintQueue() {
    grid.innerHTML = '';
    if (!Queue.list.length) {
      grid.innerHTML = '<p style="color:var(--muted)">Queue is empty — paste a Spotify or SoundCloud link above.</p>';
      return;
    }
    Queue.list.forEach((t, i) => {
      const c = document.createElement('div');
      c.className = 'tcard' + (i === Queue.pos ? ' playing' : '');
      const img = document.createElement('img');
      img.src = t.img || '';
      img.onerror = () => img.style.opacity = '.2';
      const tt = document.createElement('div'); tt.className = 'tt';
      const name = document.createElement('div'); name.className = 'tname'; name.textContent = t.t;
      const sub = document.createElement('div'); sub.className = 'tsub'; sub.textContent = t.artist || PROVIDERS.which(t.url);
      tt.append(name, sub);
      c.append(img, tt);
      c.addEventListener('click', () => {
        Queue.pos = i; Queue.save();
        if (window.ZENOU_PLAYER) ZENOU_PLAYER.playNow(t);
        paintQueue();
      });
      grid.append(c);
    });
  }

  $('#pasteBtn').addEventListener('click', async () => {
    const url = $('#pasteUrl').value.trim();
    if (!url) return;
    const kind = PROVIDERS.which(url);
    if (!kind) {
      listTitle.textContent = 'That isn\'t a Spotify or SoundCloud link';
      return;
    }
    /* Spotify oEmbed has no CORS for browsers, so label from the link —
       the official embed itself shows the real artwork/title inside the bar. */
    const m = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\//.exec(url);
    let t = { url, t: m ? `Spotify ${m[1]} · queued from link` : 'Queued from link' };
    if (kind === 'soundcloud') {
      const sc = /soundcloud\.com\/([^/]+)\//.exec(url);
      t.t = sc ? `SoundCloud — @${sc[1]}` : 'SoundCloud track';
    }
    Queue.cue(t);
    $('#pasteUrl').value = '';
    paintQueue();
    if (window.ZENOU_PLAYER) { ZENOU_PLAYER.playNow(t); }
  });

  qForm.addEventListener('submit', (e) => {
    // search box doubles as paste-or-search: spotify.com handles real search
    e.preventDefault();
    const v = qIn.value.trim();
    if (PROVIDERS.which(v)) { $('#pasteUrl').value = v; $('#pasteBtn').click(); }
    else if (v) window.open(`https://open.spotify.com/search/${encodeURIComponent(v)}`, '_blank', 'noopener');
  });

  paintQueue();
  if (window.ZENOU_PLAYER) ZENOU_PLAYER.bar.classList.add('on');
})();
