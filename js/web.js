/* Zenou Unblocked, embedded web.
 *
 * A frame, an address bar and six tabs the visitor binds in Settings. The
 * frame is sandboxed without allow-top-navigation, so a site can never take
 * the tab with it. Sites that send X-Frame-Options still win: no page can
 * force another server to allow framing, and this one says so instead of
 * pretending a blank frame loaded.
 */
'use strict';

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const SIZE_KEY = 'zenou_web_size';
  const RECENT_KEY = 'zenou_web_recent';
  const MAGMA = 'https://magma3-mantle.laneesports.com/&';
  const HOME_TITLE = 'Web, Zenou Unblocked';

  const SITES = [
    {
      id: 'rabbits', label: 'Bouncing Rabbits', glyph: 'B',
      url: 'https://bouncingrabbits.cyou/',
      note: 'A proxy portal with its own search. Loads directly in the stage.',
      kind: 'site',
    },
    {
      id: 'movy', label: 'Movy', glyph: 'M',
      url: 'https://www.movy.sx/',
      note: 'Streaming portal. It sends X-Frame-Options: DENY, so Magma has to carry it.',
      kind: 'proxy',
    },
    {
      id: 'magma', label: 'Magma', glyph: '⌁',
      url: MAGMA,
      note: 'The proxy app. Open it here, then paste any address into its bar.',
      kind: 'proxy-app',
    },
    {
      id: 'mineral', label: 'Mineral', glyph: '⛏',
      url: 'mineral.html',
      note: 'Minecraft in the browser. ~120 MB on first launch, cached after that.',
      kind: 'app', newPage: true,
    },
    {
      id: 'youtube', label: 'YouTube library', glyph: '▶',
      url: 'social.html',
      note: 'Search a curated library, add your own links and watch in-page.',
      kind: 'app', newPage: true,
    },
    {
      id: 'tiktok', label: 'TikTok', glyph: '♪',
      url: 'https://www.tiktok.com/',
      note: 'TikTok only frames its own players. Open Magma and paste this address.',
      kind: 'proxy',
    },
    {
      id: 'instagram', label: 'Instagram', glyph: '◎',
      url: 'https://www.instagram.com/',
      note: 'Instagram sends a frame-ancestors policy. Magma is the way through.',
      kind: 'proxy',
    },
    {
      id: 'discord', label: 'Discord', glyph: '◈',
      url: 'https://discord.com/app',
      note: 'Discord denies framing of the app. Use Magma, or the server widget on Media.',
      kind: 'proxy',
    },
    {
      id: 'math', label: 'Math Tutorsmart', glyph: '∑',
      url: 'https://math.tutorsmart.pro/',
      note: 'Shows the site code first, then opens the site in this tab.',
      kind: 'site', code: '8329',
    },
  ];

  const MASK_PRESETS = {
    docs: {
      title: 'Google Docs',
      icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon-2023q4.ico',
    },
    classroom: {
      title: 'Google Classroom',
      icon: 'https://www.gstatic.com/classroom/favicon.png',
    },
    drive: {
      title: 'Google Drive',
      icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
    },
  };

  const frame = $('#webFrame');
  const start = $('#webStart');
  const state = $('#webState');
  const input = $('#webUrl');
  const now = $('#webNow');

  const history = [];
  let hIndex = -1;
  let current = null;
  let loadTimer = 0;

  /* ---------- storage ---------- */
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }
  function recent() { return readJson(RECENT_KEY, []); }
  function pushRecent(url, label) {
    const list = recent().filter(r => r.url !== url);
    list.unshift({ url, label: label || url });
    writeJson(RECENT_KEY, list.slice(0, 6));
    paintRecent();
  }

  /* ---------- toast ---------- */
  function toast(title, sub, action) {
    if (window.Zenou && window.Zenou.toast) window.Zenou.toast(title, sub, action ? { action } : undefined);
  }

  /* ---------- URL helpers ---------- */
  function normalize(raw) {
    const v = (raw || '').trim();
    if (!v) return '';
    if (/^(https?:|about:)/i.test(v)) return v;
    if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(v)) return `https://${v}`;
    return `https://www.google.com/search?q=${encodeURIComponent(v)}`;
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  }
  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /* ---------- frame ---------- */
  function stopTimer() { clearTimeout(loadTimer); }

  function showState(title, text) {
    state.hidden = false;
    $('#webStateTitle').textContent = title;
    $('#webStateText').textContent = text;
  }
  function hideState() { state.hidden = true; }

  function setActiveTab(key) {
    $$('.web-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === key));
  }

  function load(rawUrl, opts) {
    const url = normalize(rawUrl);
    if (!url) return;
    const label = (opts && opts.label) || hostOf(url);

    if (opts && opts.push !== false) {
      history.splice(hIndex + 1);
      history.push({ url, label });
      hIndex = history.length - 1;
    }

    current = { url, label };
    start.hidden = true;
    frame.hidden = false;
    hideState();
    stopTimer();
    frame.src = url;
    input.value = url.startsWith('about:') ? '' : url;
    now.textContent = label;
    pushRecent(url, label);
    if (opts && opts.tab) setActiveTab(opts.tab); else setActiveTab('start');

    /* A frame blocked by frame-ancestors still fires load in most browsers, so
       this is a hint, not a detector. It appears only when nothing has painted
       for a while and the site is one of the known blockers. */
    loadTimer = setTimeout(() => {
      if (!frame.hidden) {
        now.textContent = `${label} · still blank? the site may refuse framing`;
      }
    }, 7000);
  }

  frame.addEventListener('load', () => {
    stopTimer();
    if (current) now.textContent = current.label;
  });

  /* ---------- code reveal before leaving ---------- */
  function showCode(site) {
    const overlay = document.createElement('div');
    overlay.className = 'web-pin-overlay';
    overlay.innerHTML = `
      <div class="web-pin web-code" role="dialog" aria-modal="true" aria-label="Site code">
        <h2>Math Tutorsmart</h2>
        <p>Enter this code on the site:</p>
        <output class="web-code-value"></output>
        <p class="web-code-note">The site opens in this tab when you continue.</p>
        <div class="play-tools">
          <button class="btn" type="button" data-act="copy">Copy code</button>
          <button class="btn btn-solid" type="button" data-act="go">Continue to site</button>
        </div>
      </div>`;
    overlay.querySelector('.web-code-value').textContent = site.code;
    document.body.append(overlay);
    const close = () => { overlay.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-act="copy"]').addEventListener('click', (e) => {
      copy(site.code);
      e.currentTarget.textContent = 'Copied';
    });
    overlay.querySelector('[data-act="go"]').addEventListener('click', () => {
      close();
      location.href = site.url;
    });
  }

  /* ---------- built-in sites ---------- */
  function openSite(site) {
    if (site.code) { showCode(site); return; }
    if (site.newPage) { location.href = site.url; return; }
    if (site.kind === 'proxy-app') {
      load(site.url, { label: 'Magma' });
      toast('Magma is open', 'Type or paste any address into its own bar.');
      return;
    }
    if (site.kind === 'proxy') {
      load(MAGMA, { label: 'Magma' });
      copy(site.url);
      toast(`Magma opened · ${site.label} address copied`, 'Paste it into Magma’s bar to load the site.');
      return;
    }
    load(site.url, { label: site.label });
  }

  function copy(text) {
    try { navigator.clipboard.writeText(text); } catch { /* needs a gesture in some browsers */ }
  }

  function paintSites() {
    const wrap = $('#webSites');
    if (!wrap) return;
    wrap.innerHTML = '';
    SITES.forEach(site => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'web-site';
      b.innerHTML = '<span class="web-site-glyph"></span><b></b><small></small><i></i>';
      b.querySelector('.web-site-glyph').textContent = site.glyph;
      b.querySelector('b').textContent = site.label;
      b.querySelector('small').textContent = site.note;
      const badge = b.querySelector('i');
      badge.dataset.kind = site.kind === 'app' ? 'app' : site.kind === 'site' ? 'site' : 'proxy';
      badge.textContent = site.kind === 'app' ? 'Built-in' : site.kind === 'site' ? 'Direct' : 'Via Magma';
      b.addEventListener('click', () => openSite(site));
      wrap.append(b);
    });
  }

  function paintRecent() {
    const wrap = $('#webRecent');
    if (!wrap) return;
    wrap.innerHTML = '';
    const list = recent();
    if (!list.length) {
      const p = document.createElement('span');
      p.className = 'web-foot-note';
      p.textContent = 'Nothing opened yet.';
      wrap.append(p);
      return;
    }
    list.forEach(r => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = r.label || hostOf(r.url);
      b.title = r.url;
      b.addEventListener('click', () => load(r.url, { label: r.label }));
      wrap.append(b);
    });
  }

  /* ---------- size, fullscreen ---------- */
  const shell = $('.web-shell');
  const fullBtn = $('#webFull');
  const resetBtn = $('#webReset');
  const MIN_W = 420;
  const MIN_H = 320;

  function clampW(w) {
    const parent = shell.parentElement;
    const max = Math.min(window.innerWidth - 24, parent ? parent.clientWidth : window.innerWidth - 24);
    return Math.max(MIN_W, Math.min(w, max));
  }
  function clampH(h) { return Math.max(MIN_H, Math.min(h, window.innerHeight - 320)); }
  function readSize() {
    const s = readJson(SIZE_KEY, null);
    return s && isFinite(s.w) && isFinite(s.h) ? { w: s.w, h: s.h } : null;
  }
  function setShellSize(w, h) {
    shell.classList.add('is-manual');
    shell.style.width = clampW(w) + 'px';
    shell.style.height = clampH(h) + 'px';
  }
  function persistShell() {
    if (!shell.classList.contains('is-manual')) return;
    writeJson(SIZE_KEY, { w: shell.offsetWidth, h: shell.offsetHeight });
  }
  function resetShellSize(quiet) {
    shell.classList.remove('is-manual', 'is-resizing');
    ['width', 'height'].forEach(k => shell.style.removeProperty(k));
    try { localStorage.removeItem(SIZE_KEY); } catch { /* ignore */ }
    if (!quiet) toast('Web box reset', 'Back at its default size and place.');
  }
  function paintFull() {
    if (!fullBtn) return;
    const on = !!document.fullscreenElement;
    fullBtn.classList.toggle('is-on', on);
    fullBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    fullBtn.title = on ? 'Exit fullscreen' : 'Fullscreen the web box';
  }
  function setupShell() {
    if (!shell) return;
    const saved = readSize();
    if (saved) setShellSize(saved.w, saved.h);

    fullBtn?.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (shell.requestFullscreen) await shell.requestFullscreen();
        else toast('Fullscreen unavailable', 'Use your browser menu, or F11 on desktop.');
      } catch {
        toast('Fullscreen was blocked', 'The browser refused the request. Try F11 instead.');
      }
    });
    document.addEventListener('fullscreenchange', paintFull);
    paintFull();

    resetBtn?.addEventListener('click', () => {
      resetShellSize(false);
      setTimeout(() => {
        const top = shell.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }, 80);
    });

    $$('[data-resize]').forEach((handle) => {
      let rd = null;
      handle.addEventListener('pointerdown', (e) => {
        if (document.fullscreenElement) return;
        const r = shell.getBoundingClientRect();
        rd = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
        shell.classList.add('is-resizing', 'is-manual');
        try { handle.setPointerCapture(e.pointerId); } catch { /* older browser */ }
        e.preventDefault();
      });
      handle.addEventListener('pointermove', (e) => {
        if (!rd) return;
        const dir = handle.dataset.resize || 'se';
        const dx = e.clientX - rd.x;
        const dy = e.clientY - rd.y;
        const w = dir.includes('e') ? clampW(rd.w + dx) : rd.w;
        const h = dir.includes('s') ? clampH(rd.h + dy) : rd.h;
        shell.style.width = w + 'px';
        shell.style.height = h + 'px';
      });
      const endResize = (e) => {
        if (!rd) return;
        rd = null;
        shell.classList.remove('is-resizing');
        persistShell();
        try { handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      };
      handle.addEventListener('pointerup', endResize);
      handle.addEventListener('pointercancel', endResize);
      if (handle.dataset.resize === 'se') {
        handle.addEventListener('dblclick', () => resetShellSize(false));
      }
    });

    window.addEventListener('resize', () => {
      if (document.fullscreenElement) return;
      if (shell.classList.contains('is-manual')) {
        shell.style.width = clampW(shell.offsetWidth) + 'px';
        shell.style.height = clampH(shell.offsetHeight) + 'px';
      }
    });
  }

  /* ---------- masking ---------- */
  function applyMask(kind) {
    let cfg = MASK_PRESETS[kind] || null;
    if (!cfg) {
      try { localStorage.removeItem('zenou_mask'); } catch { /* ignore */ }
      document.title = HOME_TITLE;
      document.querySelectorAll('link[rel~="icon"]').forEach(n => n.remove());
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = 'assets/favicon.svg';
      link.type = 'image/svg+xml';
      document.head.append(link);
      return;
    }
    try { localStorage.setItem('zenou_mask', JSON.stringify({ title: cfg.title, icon: '', iconData: cfg.icon })); } catch { /* ignore */ }
    document.title = cfg.title;
    document.querySelectorAll('link[rel~="icon"]').forEach(n => n.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = cfg.icon;
    document.head.append(link);
  }

  /* ---------- about:blank ---------- */
  function openBlank() {
    if (!current) { toast('Open a site first', 'about:blank copies whatever is in the stage.'); return; }
    const cfg = MASK_PRESETS[$('#webMask').value] || { title: 'Google Docs', icon: MASK_PRESETS.docs.icon };
    const win = window.open('about:blank', '_blank', 'width=' + Math.min(1400, screen.width) + ',height=' + Math.min(900, screen.height));
    if (!win) { toast('Popup blocked', 'Allow popups for this site, then press about:blank again.'); return; }
    const safe = escAttr(current.url);
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${cfg.title}</title><link rel="icon" href="${cfg.icon}"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{width:100%;height:100%;border:0;display:block}</style></head><body><iframe src="${safe}" allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-pointer-lock allow-downloads" referrerpolicy="no-referrer"></iframe></body></html>`;
    win.document.open();
    win.document.write(doc);
    win.document.close();
  }

  /* ---------- start tab ---------- */
  function goStart() {
    frame.hidden = true;
    frame.src = 'about:blank';
    start.hidden = false;
    hideState();
    setActiveTab('start');
    now.textContent = 'Nothing loaded yet';
    input.value = '';
    current = null;
  }

  /* ---------- boot ---------- */
  function boot() {
    paintSites();
    paintRecent();
    setupShell();

    $('#webStartTab').addEventListener('click', goStart);

    $('#webForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      setActiveTab('start');
      load(v);
    });

    $('#webBack').addEventListener('click', () => {
      if (hIndex <= 0) return;
      hIndex--;
      const item = history[hIndex];
      current = item;
      frame.hidden = false;
      start.hidden = true;
      hideState();
      frame.src = item.url;
      input.value = item.url;
      now.textContent = item.label;
      setActiveTab('start');
    });
    $('#webFwd').addEventListener('click', () => {
      if (hIndex >= history.length - 1) return;
      hIndex++;
      const item = history[hIndex];
      current = item;
      frame.hidden = false;
      start.hidden = true;
      hideState();
      frame.src = item.url;
      input.value = item.url;
      now.textContent = item.label;
      setActiveTab('start');
    });
    $('#webReload').addEventListener('click', () => {
      if (!current) return;
      hideState();
      frame.src = 'about:blank';
      setTimeout(() => { frame.src = current.url; }, 80);
    });

    $('#webRetry').addEventListener('click', () => {
      if (!current) return;
      hideState();
      frame.src = 'about:blank';
      setTimeout(() => { frame.src = current.url; }, 80);
    });
    $('#webMagma').addEventListener('click', () => {
      load(MAGMA, { label: 'Magma' });
      if (current && current.url !== MAGMA) copy(current.url);
      toast('Magma is open', 'Paste the address into Magma’s bar to continue.');
    });

    $('#webBlank').addEventListener('click', openBlank);

    $('#webMask').addEventListener('change', e => applyMask(e.target.value));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideState();
    });

    /* hand-off from the Media tab: open Magma and put the search on the clipboard */
    const yt = new URLSearchParams(location.search).get('yt');
    if (yt) {
      load(MAGMA, { label: 'Magma' });
      copy(`https://www.youtube.com/results?search_query=${encodeURIComponent(yt)}`);
      toast('Magma is open · YouTube search copied', 'Paste it into Magma’s bar to search all of YouTube here.');
    }

    const hash = (location.hash || '').replace('#', '');
    if (hash) {
      const site = SITES.find(s => s.id === hash);
      if (site) openSite(site);
      else if (/^https?:/.test(decodeURIComponent(hash))) load(decodeURIComponent(hash));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
