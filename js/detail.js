/* Zenou Unblocked — media detail page (movie / TV / archive item). */
'use strict';

async function boot() {
  const p = new URLSearchParams(location.search);
  const kind = p.get('k') || 'movie';
  const id = p.get('id') || '';

  document.title = 'Detail — Zenou Unblocked';

  TMDB.kind = kind === 'tv' ? 'tv' : 'movie';
  await TMDB.load();
  const m = TMDB.byId(id);
  if (!m) { $('#notFound').hidden = false; $('#skRow').hidden = true; return; }

  $('#skRow').hidden = true;
  $('#body').hidden = false;
  MediaStore.touch(m, TMDB.kind);

  const poster = m.imgBig || TMDB.img('w500', m.img) || '';
  $('#thumb').src = poster;
  $('#thumb').onerror = () => { $('#thumb').style.visibility = 'hidden'; };
  $('#bigTitle').textContent = m.t;
  document.title = `${m.t} — Zenou Unblocked`;

  const d = TMDB.detailOf(m.id);
  const subBits = [];
  if (m.y) subBits.push(m.y);
  if (d && d.runtime) subBits.push(`${d.runtime} min`);
  subBits.push(TMDB.kind === 'tv' ? 'TV series' : 'Film');
  $('#sub').textContent = subBits.join(' · ');

  const stats = $('#stats');
  if (m.r) { const s = document.createElement('span'); s.className = 'stat rated'; s.textContent = `★ ${m.r}`; stats.append(s); }
  TMDB.genreNames(m.g).forEach(g => { const s = document.createElement('span'); s.className = 'stat'; s.textContent = g; stats.append(s); });
  if (d && d.status) { const s = document.createElement('span'); s.className = 'stat'; s.textContent = d.status; stats.append(s); }

  $('#desc').textContent = m.ov || 'No synopsis cached for this snapshot.';

  if (d) {
    if (d.cast && d.cast.length) {
      $('#castRow').innerHTML = '<b>Starring</b> ';
      $('#castRow').append(d.cast.map(c => c.n).join(', '));
      if (d.dir && d.dir.length) $('#castRow').append(` — directed by ${d.dir.join(', ')}`);
    }
    if (d.trailer) {
      const stage = $('#trailerStage');
      const ifr = document.createElement('iframe');
      const origin = new URL(location.href).origin;
      ifr.src = `https://www.youtube-nocookie.com/embed/${d.trailer}?rel=0`;
      ifr.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
      ifr.allowFullscreen = true;
      ifr.title = `${m.t} trailer`;
      stage.append(ifr);
      $('#trailerBox').hidden = false;
    }
    if (TMDB.kind === 'tv' && d.seasons && d.seasons.length) renderSeasons(d);
    if (d.seo) {
      $('#imdbBtn').hidden = false;
      $('#imdbBtn').href = `https://www.imdb.com/title/${d.seo}`;
    }
  }

  // actions
  $('#playBtn').textContent = TMDB.kind === 'tv' ? 'Watch episodes' : 'Watch / play sources';
  $('#playBtn').href = `watch.html?k=${TMDB.kind}&id=${encodeURIComponent(m.id)}`;

  const wl = $('#watchBtn'), lk = $('#likeBtn');
  const paint = () => {
    wl.setAttribute('aria-pressed', MediaStore.watchlist.has(m.id) ? 'true' : 'false');
    wl.querySelector('span').textContent = MediaStore.watchlist.has(m.id) ? 'In watchlist' : 'Watchlist';
    lk.setAttribute('aria-pressed', MediaStore.liked.has(m.id) ? 'true' : 'false');
    lk.querySelector('span').textContent = MediaStore.liked.has(m.id) ? 'Favorited' : 'Favorite';
  };
  paint();
  wl.addEventListener('click', () => { MediaStore.toggleWatch(m.id); paint(); });
  lk.addEventListener('click', () => { MediaStore.toggleLike(m.id); paint(); });

  if (d && d.rec) {
    const recGrid = $('#recGrid');
    d.rec.forEach(x => recGrid.append(mcard(x)));
    $('#rec').hidden = false;
  }

  $('#backBtn').addEventListener('click', () => { history.length > 1 ? history.back() : location.href = (TMDB.kind === 'tv' ? 'tv.html' : 'movies.html'); });
}

function renderSeasons(d) {
  const chips = $('#seasonChips'), list = $('#epList');
  $('#seasons').hidden = false;
  d.seasons.forEach((s, i) => {
    const b = document.createElement('a');
    b.className = 'chip' + (i === 0 ? ' on' : '');
    b.href = '#';
    b.textContent = s.t || `Season ${s.n}`;
    b.dataset.season = s.n;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      [...chips.children].forEach(c => c.classList.toggle('on', c === b));
      renderEps(d, +b.dataset.season);
    });
    chips.append(b);
  });
  renderEps(d, d.seasons[0].n);
}

function renderEps(d, snum) {
  const list = $('#epList');
  list.hidden = false;
  list.innerHTML = '';
  const eps = (d.episodes || []).filter(e => e.s === snum);
  if (!eps.length) {
    const li = document.createElement('li');
    li.className = 'ep-item';
    li.style.justifyContent = 'center';
    li.textContent = 'Episodes for this season aren\'t cached — refresh data/fetch-tmdb.mjs data to include more seasons.';
    list.append(li);
    return;
  }
  eps.forEach(e => {
    const li = document.createElement('li');
    li.className = 'ep-item';
    const n = document.createElement('b'); n.className = 'no'; n.textContent = `S${e.s} E${e.n}`;
    const t = document.createElement('div');
    const tt = document.createElement('div'); tt.className = 'ep-title'; tt.textContent = e.t;
    const ts = document.createElement('div'); ts.className = 'ep-sub'; ts.textContent = e.ov || (e.air && `Aired ${e.air}`) || '';
    t.append(tt, ts);
    const btn = document.createElement('a');
    btn.className = 'chip';
    btn.href = `watch.html?k=tv&id=${d.id}&ep=${e.s}-${e.n}`;
    btn.textContent = 'Play';
    li.append(n, t, btn);
    list.append(li);
  });
}



boot();
