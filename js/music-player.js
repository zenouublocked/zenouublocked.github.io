/* Zenou Unblocked — persistent bottom music player (Spotify + SoundCloud official embeds).
 * Queue persists in localStorage. Playback happens inside the provider's own
 * official embed — nothing is scraped or re-hosted. Spotify embeds play 30-second
 * previews for signed-out visitors (or full tracks when the visitor is signed in),
 * which is Spotify's own behaviour for third-party sites.
 */
'use strict';

const Queue = {
  list: (JSON.parse((() => { try { return localStorage.getItem('zenou_queue'); } catch { return '[]'; } })() || '[]')),
  pos: (() => { try { const n = +localStorage.getItem('zenou_qpos'); return Number.isFinite(n) ? n : 0; } catch { return 0; } })(),
  save() {
    try {
      localStorage.setItem('zenou_queue', JSON.stringify(this.list.slice(0, 100)));
      localStorage.setItem('zenou_qpos', String(this.pos));
    } catch { /* private mode */ }
  },
  use(trackList, start) { this.list = trackList.slice(0, 100); this.pos = Math.max(0, start || 0); this.save(); },
  next(delta) { this.pos = (this.pos + delta + this.list.length) % this.list.length; this.save(); return this.list[this.pos]; },
  cue(track) { if (!this.list.find(t => (t.url || t.id) === (track.url || track.id))) { this.list.push(track); this.pos = this.list.length - 1; this.save(); } },
};

function AudioPlayer(hostSel) {
  const host = document.querySelector(hostSel);
  if (!host) return null;

  const bar = document.createElement('div');
  bar.className = 'player-bar';
  bar.innerHTML = `
    <div class="pb-embed"><iframe class="pb-frame" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"></iframe></div>
    <div class="pb-info">
      <div class="pb-title">Nothing queued yet</div>
      <div class="pb-artist">Paste a Spotify or SoundCloud link on the Music page</div>
    </div>
    <div class="pb-ctrl">
      <button type="button" class="prev" aria-label="Previous">⏮</button>
      <button type="button" class="next" aria-label="Next">⏭</button>
      <a class="pb-open" target="_blank" rel="noopener" aria-label="Open at source">↗</a>
    </div>
    <button type="button" class="pb-hide" aria-label="Show/hide player">▾</button>`;
  host.append(bar);
  document.body.classList.add('has-player');

  const $ = (s) => bar.querySelector(s);
  const frame = $('.pb-frame'), title = $('.pb-title'), artist = $('.pb-artist');
  const nextB = $('.next'), prevB = $('.prev'), open = $('.pb-open'), hide = $('.pb-hide');
  const barCSS = document.createElement('style');
  barCSS.textContent = `
    .pb-embed { width: 340px; height: 152px; border-radius: 12px; overflow: hidden; flex: none; background: #0d1210; border: 1px solid var(--line); }
    .pb-embed iframe { width: 100%; height: 100%; border: 0; display: block; }
    .pb-info { width: 200px; }
    .pb-open { color: var(--muted); text-decoration: none; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 999px; }
    .pb-open:hover { color: var(--accent); }
    .pb-hide { min-width: 30px; background: none; border: 0; color: var(--muted); cursor: pointer; height: 34px; border-radius: 999px; font-size: 15px; }
    .pb-hide:hover { color: var(--text); }
    .player-bar { min-height: 168px; }
    .player-bar.folded .pb-embed, .player-bar.folded .pb-info { display: none; }
    .player-bar.folded { transform: translateY(112px); }
    @media (max-width: 780px) {
      .pb-embed { flex: 1; min-width: 220px; height: 88px; }
      .player-bar { align-items: stretch; }
      .player-bar.folded { transform: translateY(48px); }
    }
    @media (max-width: 640px) { .pb-info { display: none; } .pb-hide { display: none; } }
  `;
  document.head.append(barCSS);

  hide.addEventListener('click', () => bar.classList.toggle('folded'));

  function playNow(track) {
    if (!track || !track.url) return false;
    title.textContent = track.t || track.title || 'Now playing';
    artist.textContent = track.artist || PROVIDERS.which(track.url);
    const kind = PROVIDERS.which(track.url);
    const url = PROVIDERS[kind].url({ url: track.url });
    if (!url) return false;
    frame.src = url;
    open.href = track.url;
    Queue.cue(track);
    // Spotify's compact embed misrenders inside a squeezed box; give it its documented 320px mode
    document.querySelectorAll('.player-bar').forEach(b => b.classList.remove('sc-mode'));
    bar.classList.add('on');
    bar.classList.remove('folded');
    return true;
  }

  PROVIDERS.which = (url) => (/open\.spotify\.com/.test(url) ? 'spotify' : /soundcloud\.com/.test(url) ? 'soundcloud' : null);

  nextB.addEventListener('click', () => { if (Queue.list.length) playNow(Queue.next(1)); });
  prevB.addEventListener('click', () => { if (Queue.list.length) playNow(Queue.next(-1)); });
  bar.addEventListener('click', e => { if (e.target === bar) bar.classList.add('folded'); });

  /* resume queue UI (don't autoplay — browser policy + no surprise audio) */
  if (Queue.list[Queue.pos]) {
    const t = Queue.list[Queue.pos];
    title.textContent = t.t || 'Queued';
    artist.textContent = t.artist || PROVIDERS.which(t.url) || '';
    open.href = t.url;
  }
  return { playNow, bar };
}

const PLAYER = AudioPlayer('#pbHost');
window.ZENOU_PLAYER = PLAYER;
