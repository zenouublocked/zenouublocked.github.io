/* ZenouMath, title detail.
 *
 * One page for a film or a series. Metadata comes from /api/title; playback is
 * resolved separately through /api/players, which asks every registry host for
 * this exact id and offers only the ones that answered.
 *
 * Series keep their own season and episode selection, and changing it re-probes
 * the hosts, because a host can carry a show and still have no copy of series 2.
 */
'use strict';

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const UI = window.ZenouTMDB;

  const params = new URLSearchParams(location.search);
  const type = params.get('type') === 'tv' ? 'tv' : 'movie';
  const id = params.get('id') || '';

  const state = {
    title: null,
    providers: [],
    selected: null,
    season: 1,
    episode: 1,
    probing: false,
  };

  /* ---------------- api ---------------- */

  async function api(path) {
    let res;
    try {
      res = await fetch(path, { headers: { accept: 'application/json' } });
    } catch {
      throw new Error('The Zenou server is not answering.');
    }
    let body = null;
    try { body = await res.json(); } catch { /* not json */ }
    if (!res.ok) {
      const err = new Error(body?.message || `Request failed (HTTP ${res.status}).`);
      err.status = res.status;
      err.code = body?.error;
      throw err;
    }
    return body;
  }

  /* ---------------- rendering ---------------- */

  function fact(dl, label, value) {
    if (!value) return;
    const wrap = document.createElement('div');
    wrap.className = 't-fact';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    wrap.append(dt, dd);
    dl.append(wrap);
  }

  function renderFacts(t) {
    const dl = $('#facts');
    dl.innerHTML = '';
    fact(dl, t.type === 'tv' ? 'Seasons' : 'Runtime', t.type === 'tv' ? (t.seasons || null) : (t.runtime ? `${t.runtime} min` : null));
    fact(dl, 'Episodes', t.episodes);
    fact(dl, 'Status', t.status);
    fact(dl, 'Created by', t.created_by && t.created_by.length ? t.created_by.join(', ') : null);
    fact(dl, 'Country', t.countries && t.countries.length ? t.countries.slice(0, 2).join(', ') : null);
    fact(dl, 'Language', t.languages && t.languages.length ? t.languages.slice(0, 2).join(', ') : null);
    fact(dl, 'Genres', t.genres && t.genres.length ? t.genres.map(g => g.name).join(', ') : null);
  }

  function renderTrailer(t) {
    if (!t.trailer) return;
    const host = $('#trailer');
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(t.trailer.key)}?rel=0`;
    frame.title = `${t.title} — ${t.trailer.name}`;
    frame.loading = 'lazy';
    frame.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    frame.setAttribute('allowfullscreen', '');
    host.append(frame);
    $('#trailerBlock').hidden = false;
  }

  function renderCast(cast) {
    if (!cast.length) return;
    const host = $('#cast');
    for (const person of cast) {
      const card = document.createElement('div');
      card.className = 't-person';

      const face = document.createElement('div');
      face.className = 't-person-face';
      const src = UI.img(person.photo, 'w185');
      if (src) {
        const image = document.createElement('img');
        image.src = src;
        image.alt = '';
        image.loading = 'lazy';
        image.addEventListener('error', () => image.remove());
        face.append(image);
      }

      const name = document.createElement('b');
      name.textContent = person.name;
      const role = document.createElement('span');
      role.textContent = person.character || '';

      card.append(face, name, role);
      host.append(card);
    }
    $('#castBlock').hidden = false;
  }

  function renderSimilar(t) {
    const seen = new Set([`${t.type}:${t.id}`]);
    const list = [];
    for (const item of [...t.recommendations, ...t.similar]) {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(item);
    }
    if (!list.length) return;
    const host = $('#similar');
    for (const item of list.slice(0, 12)) host.append(UI.posterCard(item));
    $('#similarBlock').hidden = false;
  }

  function renderTitle(t) {
    state.title = t;

    document.title = `${t.title}${t.year ? ' (' + t.year + ')' : ''} | ZenouMath`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && t.overview) desc.setAttribute('content', t.overview.slice(0, 155));

    const backdrop = UI.img(t.backdrop, 'w1280');
    if (backdrop) {
      const image = $('#heroImg');
      image.addEventListener('load', () => $('#hero').classList.add('is-ready'), { once: true });
      image.src = backdrop;
    } else {
      $('#hero').classList.add('is-ready');
    }

    $('#crumb').textContent = t.title;
    $('#titleName').textContent = t.title;

    const posterSlot = $('#poster');
    posterSlot.innerHTML = '';
    const posterSrc = UI.img(t.poster, 'w342');
    if (posterSrc) {
      const image = document.createElement('img');
      image.src = posterSrc;
      image.alt = `${t.title} poster`;
      image.addEventListener('error', () => {
        posterSlot.innerHTML = '<span class="t-poster-ph"></span>';
        posterSlot.querySelector('span').textContent = t.title;
      });
      posterSlot.append(image);
    } else {
      const ph = document.createElement('span');
      ph.className = 't-poster-ph';
      ph.textContent = t.title;
      posterSlot.append(ph);
    }

    if (t.originalTitle && t.originalTitle !== t.title) {
      $('#original').textContent = t.originalTitle;
      $('#original').hidden = false;
    }

    if (t.tagline) {
      $('#tagline').textContent = t.tagline;
      $('#tagline').hidden = false;
    }

    // Certification, runtime and seasons already come from the shared meta line;
    // the detail page only adds the vote count on top of it.
    const meta = $('#meta');
    UI.fillMeta(meta, t);
    if (t.votes) {
      const span = document.createElement('span');
      span.className = 't-pill';
      // "0.0k votes" is worse than the number itself.
      span.textContent = t.votes >= 1000
        ? `${(t.votes / 1000).toFixed(t.votes >= 10000 ? 0 : 1)}k votes`
        : `${t.votes} votes`;
      meta.append(span);
    }

    $('#overview').textContent = t.overview || 'No synopsis has been published for this title yet.';
    renderFacts(t);

    if (t.homepage) {
      const home = $('#homepage');
      home.href = t.homepage;
      home.hidden = false;
    }

    renderTrailer(t);
    renderCast(t.cast || []);
    renderSimilar(t);
    if (t.type === 'tv') renderSeasons(t);
    quickLaunch(t);
  }

  /* ---------------- seasons ---------------- */

  function renderSeasons(t) {
    const block = $('#episodesBlock');
    const list = (t.seasonsList || []).filter(s => s.number > 0);
    if (!list.length) return;
    block.hidden = false;

    const bar = $('#seasons');
    bar.innerHTML = '';

    const paintEpisodes = () => {
      const host = $('#episodes');
      host.innerHTML = '';
      const season = list.find(s => s.number === state.season);
      const count = Math.max(1, Math.min(season?.episodes || 12, 60));
      for (let n = 1; n <= count; n += 1) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(n);
        btn.setAttribute('aria-label', `Season ${state.season}, episode ${n}`);
        btn.setAttribute('aria-pressed', String(n === state.episode));
        btn.addEventListener('click', () => {
          state.episode = n;
          paintEpisodes();
          loadProviders();
          if (state.title) quickLaunch(state.title);
        });
        host.append(btn);
      }
    };

    for (const season of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 't-season';
      btn.textContent = season.episodes ? `${season.name} · ${season.episodes} eps` : season.name;
      btn.setAttribute('aria-pressed', String(season.number === state.season));
      btn.addEventListener('click', () => {
        state.season = season.number;
        state.episode = 1;
        $$('.t-season', bar).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        paintEpisodes();
        loadProviders();
        if (state.title) quickLaunch(state.title);
      });
      bar.append(btn);
    }

    paintEpisodes();
  }

  /* ---------------- quick launch ---------------- */

  // Movy takes a TMDB id in its path, so its link is built here and works even
  // if the API is unreachable. StreamEx has no id routes: it starts as its own
  // search and is upgraded to the resolved watch page when /api/watch-links
  // answers. Both hosts send framing headers, so both open in a new tab.
  function quickLaunch(t) {
    if (!t || !$('#quickLinks')) return;

    const year = String(t.date || '').slice(0, 4);
    const movy = type === 'tv'
      ? `https://www.movy.sx/tv/${t.id}/${state.season}/${state.episode}?play=true`
      : `https://www.movy.sx/movie/${t.id}?play=true`;
    const search = `https://streamex.ws/search?q=${encodeURIComponent(t.title)}`;

    paintQuick([
      { name: 'Movy', mark: 'MV', url: movy, exact: true, qualifier: 'exact title' },
      { name: 'StreamEx', mark: 'SX', url: search, exact: false, qualifier: 'its search' },
    ]);
    $('#quick').hidden = false;

    const query = new URLSearchParams({ type, id: String(t.id), title: t.title, year });
    if (type === 'tv') {
      query.set('season', String(state.season));
      query.set('episode', String(state.episode));
    }

    api('/api/watch-links?' + query.toString())
      .then(data => {
        if (state.title !== t || !Array.isArray(data.links) || !data.links.length) return;
        paintQuick(data.links.map(link => ({
          name: link.name,
          mark: link.id === 'movy' ? 'MV' : 'SX',
          url: link.url,
          exact: Boolean(link.exact),
          note: link.note,
          qualifier: link.exact ? 'exact title' : 'its search',
        })));
      })
      .catch(() => { /* the built links stay in place */ });
  }

  function paintQuick(links) {
    const host = $('#quickLinks');
    if (!host) return;
    host.innerHTML = '';
    for (const link of links) {
      if (!link.url) continue;
      const a = document.createElement('a');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.dataset.exact = String(Boolean(link.exact));
      a.title = link.note || `Open ${link.name} in a new tab`;

      const mark = document.createElement('span');
      mark.className = 't-quick-mark';
      mark.textContent = link.mark;
      const name = document.createElement('b');
      name.textContent = link.name;
      const qualifier = document.createElement('small');
      qualifier.textContent = link.qualifier;

      a.append(mark, name, qualifier);
      host.append(a);
    }
  }

  /* ---------------- playback ---------------- */

  function stageMessage(title, text, action) {
    const stage = $('#stage');
    stage.innerHTML = '';
    const box = document.createElement('div');
    box.className = 't-stage-empty';
    const b = document.createElement('b');
    b.textContent = title;
    const span = document.createElement('span');
    span.textContent = text;
    box.append(b, span);
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dc-btn dc-btn-solid';
      button.textContent = action.label;
      button.addEventListener('click', action.onClick);
      box.append(button);
    }
    stage.append(box);
  }

  function play(provider) {
    state.selected = provider;
    $$('.t-provider').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.id === provider.id)));

    if (provider.frame === 'blocked') {
      stageMessage(
        `${provider.name} refuses to be framed`,
        'Its server sends a framing header, so no page can show it inline. Open it in its own tab; the title is already resolved.',
        {
          label: `Open ${provider.name} in a tab`,
          onClick: () => window.open(provider.url, '_blank', 'noopener'),
        },
      );
      return;
    }

    const stage = $('#stage');
    stage.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.src = provider.url;
    frame.title = `${state.title?.title || 'Title'} on ${provider.name}`;
    frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write';
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    frame.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads',
    );
    stage.append(frame);
  }

  function renderProviders(data) {
    const bar = $('#providers');
    bar.innerHTML = '';
    const available = data.available || [];

    $('#watchState').textContent = available.length
      ? `${available.length} of the registry answered · checked now`
      : 'No source answered for this title';

    if (!available.length) {
      stageMessage(
        'Nothing answered for this id',
        'Every registry host was asked for this title and none returned a page. That usually means the title is very new, or the hosts are behind a challenge right now. The direct-source shelf has the full directory.',
        { label: 'Open the source shelf', onClick: () => { location.href = '/sources'; } },
      );
      return;
    }

    for (const provider of available) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 't-provider';
      btn.dataset.id = provider.id;
      btn.dataset.licensing = provider.licensing;
      btn.setAttribute('aria-pressed', 'false');

      const name = document.createElement('span');
      name.textContent = provider.name;
      const tag = document.createElement('small');
      tag.textContent = provider.frame === 'blocked' ? 'new tab' : 'in frame';
      btn.append(name, tag);
      btn.title = provider.rightsNote || 'Third-party embed host';
      btn.addEventListener('click', () => play(provider));
      bar.append(btn);
    }

    const preferred =
      available.find(p => p.frame === 'direct') || available[0];
    play(preferred);
  }

  async function loadProviders() {
    if (!state.title || state.probing) return;
    state.probing = true;
    $('#watchState').textContent = 'Checking sources…';

    const query = new URLSearchParams({ type, id: state.title.id });
    if (type === 'tv') {
      query.set('season', String(state.season));
      query.set('episode', String(state.episode));
    }

    try {
      const data = await api('/api/players?' + query.toString());
      state.providers = data.available || [];
      renderProviders(data);
    } catch (e) {
      $('#watchState').textContent = 'Availability check failed';
      stageMessage(
        'Could not check the sources',
        e.message + ' The rest of the page still works.',
        { label: 'Try again', onClick: () => loadProviders() },
      );
    } finally {
      state.probing = false;
    }
  }

  /* ---------------- failure ---------------- */

  function renderFailure(error) {
    const main = $('#main');
    main.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'dc-setup';
    const card = document.createElement('div');
    card.className = 'dc-setup-card';

    if (error.status === 404) {
      card.innerHTML =
        '<h2>That title is not in the catalogue</h2>' +
        '<p>TMDB has no record for this id, or it was removed. Search from the movies page instead.</p>';
    } else {
      card.innerHTML = '<h2>Could not load this title</h2><p></p>';
      card.querySelector('p').textContent = error.message;
    }

    const back = document.createElement('p');
    back.style.marginTop = '16px';
    const link = document.createElement('a');
    link.href = '/movies';
    link.textContent = 'Back to discovery →';
    back.append(link);
    card.append(back);

    wrap.append(card);
    main.append(wrap);
  }

  /* ---------------- boot ---------------- */

  async function boot() {
    if (!/^\d+$/.test(id)) {
      renderFailure({ status: 404, message: 'No title id in the address.' });
      return;
    }

    try {
      const config = await api('/api/config');
      UI.setConfig(config);
      if (!config.configured) {
        renderFailure({
          status: 503,
          message: 'TMDB is not configured on this server. Add TMDB_READ_TOKEN or TMDB_API_KEY to .env and restart it.',
        });
        return;
      }
    } catch (e) {
      renderFailure({ status: 503, message: e.message });
      return;
    }

    try {
      const data = await api(`/api/title?type=${type}&id=${encodeURIComponent(id)}`);
      renderTitle(data.title);
      if (data.title.seasonsList && data.title.seasonsList.length) {
        state.season = data.title.seasonsList.find(s => s.number > 0)?.number || 1;
      }
      loadProviders();
    } catch (e) {
      renderFailure(e);
    }

    $('#watchCta').addEventListener('click', () => {
      $('#watch').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
