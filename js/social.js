/* Zenou Unblocked, media hub.
 *
 * The YouTube tab is a real library: a verified list in catalog/media.json,
 * filtered instantly as you type, played through YouTube's own embed. Links
 * you paste are checked against oEmbed and remembered. TikTok, Instagram and
 * Discord point at the embedded web, because only they can carry the full app.
 */
'use strict';

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const RECENT_KEY = 'zenou_social_recent';
  const EXTRA_KEY = 'zenou_media_saved';

  const CAT_LABEL = {
    all: 'Everything', music: 'Music', gaming: 'Gaming & trailers', science: 'Science',
    learning: 'Learning', talks: 'Talks', lofi: 'Lofi & study',
  };

  const library = { videos: [], cat: 'all', q: '' };

  /* ---------- storage ---------- */
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }

  /* ---------- recent list ---------- */
  function readRecent() { return readJson(RECENT_KEY, []); }
  function pushRecent(entry) {
    const list = readRecent().filter(r => r.url !== entry.url);
    list.unshift(entry);
    writeJson(RECENT_KEY, list.slice(0, 12));
    paintRecent();
  }
  function paintRecent() {
    const wrap = $('#recentList');
    if (!wrap) return;
    const list = readRecent();
    wrap.innerHTML = '';
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'social-hint';
      p.textContent = 'Nothing yet, anything you open is remembered here.';
      wrap.append(p);
      return;
    }
    list.forEach(r => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'social-chip';
      const glyph = r.kind === 'youtube' ? '▶' : r.kind === 'tiktok' ? '♪' : r.kind === 'instagram' ? '◎' : '◈';
      b.textContent = `${glyph} ${r.label}`;
      b.addEventListener('click', () => open(r.kind, r.url, r.label, true));
      wrap.append(b);
    });
  }

  /* ---------- parsing ---------- */
  function ytTarget(raw) {
    const v = (raw || '').trim();
    if (!v) return null;
    if (/^[\w-]{11}$/.test(v)) return { id: v, label: 'YouTube video' };
    let u;
    try { u = new URL(v.includes('://') ? v : `https://${v}`); } catch { return null; }
    const host = u.hostname.replace(/^www\./, '');
    if (!/(^|\.)youtube\.com$|^youtu\.be$|youtube-nocookie\.com$/.test(host)) return null;
    const list = u.searchParams.get('list');
    const vid = u.searchParams.get('v')
      || (host === 'youtu.be' ? u.pathname.slice(1) : '')
      || (u.pathname.match(/\/embed\/([\w-]{11})/)?.[1] ?? '')
      || (u.pathname.match(/\/shorts\/([\w-]{11})/)?.[1] ?? '');
    if (list) return { list, id: vid || '', label: 'YouTube playlist' };
    if (vid && /^[\w-]{11}$/.test(vid)) return { id: vid, label: 'YouTube video' };
    return null;
  }

  function ttTarget(raw) {
    const v = (raw || '').trim();
    if (/^\d{15,25}$/.test(v)) return { id: v, label: 'TikTok video' };
    const m = v.match(/\/video\/(\d{15,25})/) || v.match(/\/embed\/v2\/(\d{15,25})/);
    if (m) return { id: m[1], label: 'TikTok video' };
    return null;
  }

  function igTarget(raw) {
    const v = (raw || '').trim();
    const m = v.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/) || v.match(/^\/([\w-]{5,})\/?$/);
    if (m) return { code: m[1], label: 'Instagram post' };
    return null;
  }

  function dcTarget(raw) {
    const v = (raw || '').trim();
    const m = v.match(/(\d{15,22})/);
    return m ? { id: m[1], label: 'Discord server' } : null;
  }

  /* ---------- players ---------- */
  function mount(wrap, src, title, allow) {
    wrap.innerHTML = '';
    const f = document.createElement('iframe');
    f.src = src;
    f.title = title;
    f.loading = 'lazy';
    f.allow = allow || 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    wrap.append(f);
    return f;
  }

  function open(kind, url, label, quiet) {
    if (kind === 'youtube') {
      const t = ytTarget(url);
      if (!t) return toast('That is not a YouTube link', 'Paste a youtube.com, youtu.be or shorts link.');
      const src = t.list
        ? `https://www.youtube-nocookie.com/embed/${t.id || 'videoseries'}?list=${encodeURIComponent(t.list)}&rel=0`
        : `https://www.youtube-nocookie.com/embed/${t.id}?rel=0`;
      mount($('#ytFrameWrap'), src, 'YouTube player');
      $('#ytStage').hidden = false;
      $('#ytNow').textContent = label || t.label;
      $('#ytStage').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (!quiet) pushRecent({ kind, url: t.id || url, label: label || t.label });
      return;
    }
    if (kind === 'tiktok') {
      const t = ttTarget(url);
      if (!t) return toast('That is not a TikTok video link', 'It should contain /video/<id>.');
      mount($('#ttFrameWrap'), `https://www.tiktok.com/embed/v2/${t.id}`, 'TikTok video', 'autoplay; encrypted-media; fullscreen');
      $('#ttStage').hidden = false;
      $('#ttNow').textContent = t.label;
      if (!quiet) pushRecent({ kind, url: t.id, label: t.label });
      return;
    }
    if (kind === 'instagram') {
      const t = igTarget(url);
      if (!t) return toast('That is not an Instagram post link', 'Use a /p/ or /reel/ link.');
      mount($('#igFrameWrap'), `https://www.instagram.com/p/${t.code}/embed/`, 'Instagram post', 'encrypted-media; fullscreen');
      $('#igStage').hidden = false;
      $('#igNow').textContent = t.label;
      if (!quiet) pushRecent({ kind, url: t.code, label: t.label });
      return;
    }
    if (kind === 'discord') {
      const t = dcTarget(url);
      if (!t) return toast('That is not a server ID', 'It is a long number, 15-22 digits.');
      mount($('#dcFrameWrap'), `https://discord.com/widget?id=${t.id}&theme=dark`, 'Discord server widget', '');
      $('#dcStage').hidden = false;
      $('#dcNow').textContent = t.label;
      if (!quiet) pushRecent({ kind, url: t.id, label: t.label });
    }
  }

  function toast(title, sub) {
    if (window.Zenou) window.Zenou.toast(title, sub);
  }

  /* ---------- library ---------- */
  function savedExtras() { return readJson(EXTRA_KEY, []); }
  function saveExtra(entry) {
    const list = savedExtras().filter(v => v.id !== entry.id);
    list.unshift(entry);
    writeJson(EXTRA_KEY, list.slice(0, 30));
    buildLibrary();
  }

  function thumb(id) { return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`; }

  function buildLibrary() {
    const base = (library.base || []).map(v => ({ ...v, saved: false }));
    const extras = savedExtras().map(v => ({ ...v, saved: true }));
    const seen = new Set();
    library.videos = [...extras, ...base].filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
    paintCats();
    paintGrid();
  }

  function paintCats() {
    const wrap = $('#ytCats');
    if (!wrap) return;
    const counts = { all: library.videos.length };
    library.videos.forEach(v => { counts[v.cat] = (counts[v.cat] || 0) + 1; });
    wrap.innerHTML = '';
    Object.entries(CAT_LABEL).forEach(([id, label]) => {
      if (id !== 'all' && !counts[id]) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'media-cat';
      b.dataset.id = id;
      b.setAttribute('aria-pressed', library.cat === id ? 'true' : 'false');
      b.textContent = `${label} ${counts[id] || 0}`;
      b.addEventListener('click', () => {
        library.cat = id;
        paintCats();
        paintGrid();
      });
      wrap.append(b);
    });
  }

  function normalise(s) {
    return (s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  }

  function paintGrid() {
    const grid = $('#ytGrid');
    if (!grid) return;
    const q = normalise(library.q);
    const list = library.videos.filter(v => {
      if (library.cat !== 'all' && v.cat !== library.cat) return false;
      if (!q) return true;
      return normalise(`${v.title} ${v.channel} ${v.cat}`).includes(q);
    });
    grid.innerHTML = '';
    library.shown = list.length;
    const count = $('#ytCount');
    if (count) count.textContent = `${list.length} of ${library.videos.length} videos`;
    const empty = $('#ytEmpty');
    if (empty) empty.hidden = list.length > 0;

    list.forEach(v => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'media-card';
      card.innerHTML = `
        <span class="media-thumb"><img alt="" loading="lazy" decoding="async"><span class="media-play" aria-hidden="true">▶</span></span>
        <span class="media-body">
          <b></b>
          <small></small>
          <em></em>
        </span>`;
      const img = card.querySelector('img');
      img.src = thumb(v.id);
      img.alt = '';
      img.addEventListener('error', () => { card.classList.add('is-dead'); img.remove(); });
      card.querySelector('b').textContent = v.title;
      card.querySelector('small').textContent = v.channel;
      const tag = card.querySelector('em');
      tag.textContent = v.saved ? 'Saved by you' : CAT_LABEL[v.cat] || v.cat;
      card.addEventListener('click', () => open('youtube', v.id, v.title));
      grid.append(card);
    });
  }

  async function loadLibrary() {
    try {
      const res = await fetch('catalog/media.json');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      library.base = Array.isArray(data.videos) ? data.videos : [];
    } catch {
      library.base = [];
    }
    buildLibrary();
    const note = $('.media-side p');
    if (note) note.textContent = note.textContent.replace('{count}', String(library.videos.length));
    const hint = $('#ytHint');
    if (hint) hint.textContent = 'Links with list= play the whole playlist. Pasted videos are saved to the top of the library.';
  }

  /* ---------- pasted link → library entry ---------- */
  async function addToLibrary(id, fallbackTitle) {
    const existing = library.videos.find(v => v.id === id);
    if (existing) return existing;
    let entry = { id, title: fallbackTitle || 'YouTube video', channel: 'YouTube', cat: 'music' };
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`);
      if (res.ok) {
        const d = await res.json();
        entry = { id, title: d.title || entry.title, channel: d.author_name || 'YouTube', cat: 'music' };
      }
    } catch { /* offline or oEmbed blocked, keep the fallback */ }
    saveExtra(entry);
    return entry;
  }

  /* ---------- tabs ---------- */
  function tab(name) {
    $$('.social-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('.social-panel').forEach(p => { p.hidden = p.id !== `panel-${name}`; });
    history.replaceState(null, '', `social.html#${name}`);
  }

  function boot() {
    $$('.social-tab').forEach(b => b.addEventListener('click', () => tab(b.dataset.tab)));

    $('#ytSearch').addEventListener('input', (e) => {
      library.q = e.target.value;
      paintGrid();
    });

    /* Enter with no local hits: carry the query into the embedded web, where
       YouTube's own search page runs inside the site. */
    $('#ytSearch').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const q = e.target.value.trim();
      if (!q) return;
      if (library.shown) return;
      location.href = `web.html?yt=${encodeURIComponent(q)}`;
    });

    $('#ytForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const raw = $('#ytInput').value;
      const t = ytTarget(raw);
      if (!t) return toast('That is not a YouTube link', 'Paste a youtube.com, youtu.be or shorts link.');
      if (t.list) {
        open('youtube', raw, t.label);
        return;
      }
      const entry = await addToLibrary(t.id, 'YouTube video');
      open('youtube', t.id, entry.title);
    });

    $('#ytMagma').addEventListener('click', () => {
      const q = $('#ytSearch').value.trim();
      const target = q
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
        : 'https://www.youtube.com/';
      try { navigator.clipboard.writeText(target); } catch { /* gesture */ }
      toast('Search address copied', 'Magma opens on the next page, paste it into its bar.');
    });

    $('#ttForm').addEventListener('submit', (e) => {
      e.preventDefault();
      open('tiktok', $('#ttInput').value);
    });
    $('#igForm').addEventListener('submit', (e) => {
      e.preventDefault();
      open('instagram', $('#igInput').value);
    });
    $('#dcForm').addEventListener('submit', (e) => {
      e.preventDefault();
      open('discord', $('#dcInput').value);
    });

    [['ytStage', 'ytFrameWrap'], ['ttStage', 'ttFrameWrap'], ['igStage', 'igFrameWrap'], ['dcStage', 'dcFrameWrap']].forEach(([stage, wrap]) => {
      const btn = $(`#${stage === 'ytStage' ? 'ytClear' : stage === 'ttStage' ? 'ttClear' : stage === 'igStage' ? 'igClear' : 'dcClear'}`);
      if (btn) btn.addEventListener('click', () => { $(`#${stage}`).hidden = true; $(`#${wrap}`).innerHTML = ''; });
    });

    $('#ytFs').addEventListener('click', () => {
      const f = $('#ytFrameWrap iframe');
      if (f && f.requestFullscreen) f.requestFullscreen();
    });

    /* a ?url= hand-off keeps shared links working without a page reload */
    const p = new URLSearchParams(location.search);
    const shared = p.get('url');
    if (shared) {
      const kind = p.get('k') || 'youtube';
      tab(kind);
      open(kind, shared);
    } else {
      const hash = (location.hash || '').replace('#', '');
      if (['youtube', 'tiktok', 'instagram', 'discord'].includes(hash)) tab(hash);
    }

    paintRecent();
    loadLibrary();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
