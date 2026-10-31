/* Zenou Unblocked, shared media data layer.
 * localStorage-backed library (watchlist, liked, recently viewed) + TMDB image URLs.
 */
'use strict';

function $(sel, el) { return (el || document).querySelector(sel); }

const MediaStore = {
  get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } },

  watchlist: new Set(),
  liked: new Set(),
  recent: [],

  init() {
    this.watchlist = new Set(this.get('zenou_watchlist', []));
    this.liked = new Set(this.get('zenou_liked', []));
    this.recent = this.get('zenou_mrecent', []);
  },
  save() {
    this.set('zenou_watchlist', [...this.watchlist]);
    this.set('zenou_liked', [...this.liked]);
    this.set('zenou_mrecent', this.recent.slice(0, 80));
  },
  touch(m, kind) {
    this.recent = this.recent.filter(x => x.id !== m.id);
    this.recent.unshift({ id: m.id, t: m.t, img: m.img || m.imgSmall || '', kind, ts: Date.now() });
    this.recent = this.recent.slice(0, 40);
    this.save();
  },
  genMove(id, list) {
    if (arguments.length === 1) return; // unused guard
  },
  toggleWatch(id) {
    if (this.watchlist.has(id)) { this.watchlist.delete(id); this.save(); return false; }
    this.watchlist.add(id); this.save(); return true;
  },
  toggleLike(id) {
    if (this.liked.has(id)) { this.liked.delete(id); this.save(); return false; }
    this.liked.add(id); this.save(); return true;
  },
};
MediaStore.init();

/* TMDB images are fetched straight from their CDN (public artwork hotlinking is allowed by TMDB's usage policy) */
function tmdbImg(set, size) {
  if (!set) return '';
  return `https://image.tmdb.org/t/p/${size}${set}`.replace('https://image', 'https://image');
}

function entryHref(m, kind) {
  return `detail.html?k=${kind || m.kind || 'movie'}&id=${encodeURIComponent(m.id)}`;
}

function watchHref(m, kind, ep) {
  const p = new URLSearchParams();
  p.set('k', kind || m.kind || 'movie');
  p.set('id', m.id);
  if (ep) p.set('ep', `${ep.s}-${ep.n}`);
  return `watch.html?${p.toString()}`;
}

document.addEventListener('DOMContentLoaded', () => {
  // highlight the current nav item
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.getAttribute('href').split('?')[0] === here) a.setAttribute('aria-current', 'page');
  });
});
