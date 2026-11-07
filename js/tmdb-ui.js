/* ZenouMath, shared TMDB presentation helpers.
 *
 * Both movies.html and title.html render the same card, the same poster
 * fallback and the same meta line, so they share this instead of drifting.
 * No network here: callers hand in data the API already shaped.
 */
'use strict';

window.ZenouTMDB = (function () {
  const DEFAULT_BASE = 'https://image.tmdb.org/t/p/';
  let base = DEFAULT_BASE;

  function setConfig(config) {
    if (config && config.images && config.images.base) base = config.images.base;
  }

  function img(path, size) {
    if (!path) return null;
    return base + size + path;
  }

  const KIND_LABEL = { movie: 'Film', tv: 'Series' };

  function yearOf(item) {
    if (item.year) return item.year;
    if (item.date) return Number(String(item.date).slice(0, 4)) || null;
    return null;
  }

  function subLine(item, { showKind = false } = {}) {
    const bits = [];
    if (showKind) bits.push(KIND_LABEL[item.type] || 'Film');
    const year = yearOf(item);
    if (year) bits.push(String(year));
    if (item.seasons) bits.push(item.seasons + (item.seasons === 1 ? ' season' : ' seasons'));
    return bits.join(' · ');
  }

  /** A poster card, as used by every rail and the browse grid. */
  function posterCard(item, { showKind = true } = {}) {
    const a = document.createElement('a');
    a.className = 'dc-card';
    a.href = `/title?type=${encodeURIComponent(item.type)}&id=${encodeURIComponent(item.id)}`;
    a.setAttribute('aria-label', `${item.title}${yearOf(item) ? ' (' + yearOf(item) + ')' : ''}`);

    const poster = document.createElement('div');
    poster.className = 'dc-poster';

    const placeholder = document.createElement('span');
    placeholder.className = 'dc-poster-ph';
    placeholder.textContent = item.title;
    poster.append(placeholder);

    const src = img(item.poster, 'w342');
    if (src) {
      const image = document.createElement('img');
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 342;
      image.height = 513;
      image.addEventListener('load', () => image.classList.add('is-loaded'));
      image.addEventListener('error', () => image.remove());
      image.src = src;
      poster.append(image);
    }

    if (item.rating) {
      const chip = document.createElement('span');
      chip.className = 'dc-score-chip';
      chip.textContent = item.rating.toFixed(1);
      poster.append(chip);
    }

    if (showKind && KIND_LABEL[item.type]) {
      const kind = document.createElement('span');
      kind.className = 'dc-kind-chip';
      kind.textContent = KIND_LABEL[item.type];
      poster.append(kind);
    }

    const title = document.createElement('span');
    title.className = 'dc-card-title';
    title.textContent = item.title;

    const sub = document.createElement('span');
    sub.className = 'dc-card-sub';
    sub.textContent = subLine(item);

    a.append(poster, title, sub);
    return a;
  }

  function skeletonCard() {
    const d = document.createElement('div');
    d.className = 'dc-skel';
    return d;
  }

  function metaLine(item) {
    const parts = [];
    if (item.rating) parts.push({ cls: 'dc-score', text: item.rating.toFixed(1) });
    if (item.year) parts.push({ cls: '', text: String(item.year) });
    if (item.certification) parts.push({ cls: 'dc-cert', text: item.certification });
    if (item.runtime) parts.push({ cls: '', text: `${item.runtime} min` });
    if (item.seasons) parts.push({ cls: '', text: `${item.seasons} season${item.seasons === 1 ? '' : 's'}` });
    if (item.episodes) parts.push({ cls: '', text: `${item.episodes} episodes` });
    return parts;
  }

  function fillMeta(host, item) {
    host.innerHTML = '';
    for (const part of metaLine(item)) {
      const span = document.createElement('span');
      if (part.cls) span.className = part.cls;
      span.textContent = part.text;
      host.append(span);
    }
    if (KIND_LABEL[item.type]) {
      const span = document.createElement('span');
      span.textContent = KIND_LABEL[item.type];
      host.prepend(span);
    }
  }

  return { setConfig, img, posterCard, skeletonCard, fillMeta, subLine, yearOf, KIND_LABEL };
})();
