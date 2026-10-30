/* Zenou Unblocked — watch page: movies/TV play their cached official trailer;
 * full-film streaming providers (vidking-style) were rejected on licensing
 * grounds, so this page is honest about what can and cannot play here.
 */
'use strict';

async function boot() {
  const p = new URLSearchParams(location.search);
  const kind = p.get('k') || 'movie';
  const id = p.get('id') || '';

  TMDB.kind = kind === 'tv' ? 'tv' : 'movie';
  await TMDB.load();
  const m = TMDB.byId(id);

  $('#skRow').hidden = true;
  $('#watchView').hidden = false;
  if (!m) {
    const info = document.querySelector('.game-info');
    if (info) info.hidden = true;
    return noSource(null, 'This title isn\'t in the cached snapshot. Run scripts/fetch-tmdb.mjs to refresh, or open it from the catalogue.', '');
  }

  $('#wTitle').textContent = m.t;
  document.title = `${m.t} — Watch — Zenou Unblocked`;
  $('#wMeta').textContent = [m.y, kind === 'tv' ? 'TV series' : 'Film'].filter(Boolean).join(' · ');
  const d = TMDB.detailOf(m.id);
  $('#wSource').textContent = `Metadata by TMDB${d && d.seo ? ' · IMDb ' + d.seo : ''}. This site only shows official trailers here — full-film streams need a licensed service, which we don't re-host.`;
  MediaStore.touch(m, kind);

  const yt = d && d.trailer ? [d.trailer] : [];
  const sources = yt.length ? [{ p: 'youtube', ctx: { ytKey: yt[0] }, label: 'Trailer (YouTube)' }] : [];

  const row = $('#providerRow');
  row.hidden = false;

  if (sources.length) {
    sources.forEach((s, i) => row.append(sourceChip(i, s)));
    apply(sources[0]);
    $('#wNote').hidden = false;
    $('#wNote').textContent = 'Official trailer only — trailers are not the full film, and this site doesn\'t frame unlicensed full-movie streams.';
  } else {
    noSource(m, 'No cached trailer for this title in the current snapshot, and no authorised embed source exists here.', (d && d.seo) || '');
  }

  function apply(src) {
    const stage = $('#stage'), frame = $('#frame'), loading = $('#loading');
    row.querySelectorAll('[data-src]').forEach(c => c.classList.toggle('on', +c.dataset.src === 0));
    stage.hidden = false; frame.hidden = false; $('#extBox').hidden = true;
    loading.classList.remove('done');
    frame.addEventListener('load', () => loading.classList.add('done'), { once: true });
    setTimeout(() => {
      if (!loading.classList.contains('done') && stage && !stage.hidden) {
        loading.classList.add('done');
        noSource(m, 'The player didn\'t connect in time — YouTube may be blocking or offline. The official links are below.', (d ? d.seo : '') || '');
      }
    }, 15000);
    frame.src = PROVIDERS[src.p].url(src.ctx);
  }

  function sourceChip(idx, src) {
    const b = document.createElement('a');
    b.className = 'chip on';
    b.href = '#';
    b.dataset.src = String(idx);
    b.textContent = src.label || PROVIDERS[src.p].name;
    b.addEventListener('click', (e) => { e.preventDefault(); apply(src); });
    return b;
  }

  $('#backBtn').addEventListener('click', () => history.length > 1 ? history.back() : location.href = (kind === 'tv' ? 'tv.html' : 'movies.html'));
}

function noSource(m, reason, imdbId) {
  $('#stage').hidden = true;
  $('#extBox').hidden = false;
  $('#extReason').textContent = reason || '';
  if (m) {
    if (m.t) $('#extTitle').textContent = `No playable source for “${m.t}” on this site`;
    if (imdbId) { $('#extOfficial').hidden = false; $('#extOfficial').href = `https://www.imdb.com/title/${imdbId}/`; }
    else {
      $('#extOfficial').hidden = false;
      $('#extOfficial').href = `https://www.justwatch.com/us/search?q=${encodeURIComponent(m.t || '')}`;
      const span = $('#extOfficial').querySelector('span');
      if (span) span.textContent = 'Find where it streams legally';
    }
  }
  $('#extTrailer').hidden = false;
  $('#extTrailer').href = m ? `https://www.youtube.com/results?search_query=${encodeURIComponent((m.t || '') + ' official trailer')}` : 'https://www.youtube.com';
  $('#backBtn').addEventListener('click', () => history.length > 1 ? history.back() : location.href = 'index.html');
}

boot();
