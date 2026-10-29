/* Zenou Unblocked — My Library page: watchlist, favourites, recently viewed. */
'use strict';

(async function () {
  TMDB.kind = 'movie';
  await TMDB.load();
  const cols = $('#cols');

  const sections = [
    ['Watchlist', [...MediaStore.watchlist], 'wl'],
    ['Favourites', [...MediaStore.liked], 'lk'],
    ['Recently viewed', MediaStore.recent.map(r => r.id), 'rc'],
  ];

  cols.innerHTML = '';
  let shown = 0;

  for (const [title, ids, flag] of sections) {
    const sec = document.createElement('section');
    const head = document.createElement('div'); head.className = 'mhead';
    const h = document.createElement('h2'); h.textContent = `${title} (${ids.length})`;
    head.append(h); sec.append(head);
    const grid = document.createElement('div'); grid.className = 'mgrid';
    sec.append(grid);

    if (ids.length) {
      ids.slice(0, 24).forEach(id => {
        const m = TMDB.byId(id);
        const card = m ? mcard(m) : stubCard(id);
        grid.append(card);
      });
      shown++;
    } else {
      const p = document.createElement('p');
      p.style.cssText = 'color:var(--muted);font-size:13.5px';
      p.textContent = flag === 'wl' ? 'Tap Watchlist on any title to collect it here.'
        : flag === 'lk' ? 'Favourite a title you love and it will appear here.'
        : 'Your recently viewed titles show up here automatically.';
      sec.append(p);
    }
    cols.append(sec);
  }
})();

function stubCard(id) {
  const a = document.createElement('a');
  a.className = 'mcard';
  const img = document.createElement('img');
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 3"><rect width="2" height="3" fill="#11151a"/></svg>');
  const name = document.createElement('span'); name.className = 'mname'; name.textContent = id;
  a.append(img, name);
  return a;
}
