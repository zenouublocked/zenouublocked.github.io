/* ZenouMath, the AI room.
 *
 * One console, one catalogue, one rule: only what the server allows gets a
 * frame. `frame: "inline"` entries load in the console, everything else opens
 * in a tab, and every entry carries a Magma hand-off for networks that block
 * the domain rather than the frame.
 *
 * The verdicts in catalog/ai.json come from scripts/verify-ai.mjs, which
 * follows redirects and grades the final response.
 */
'use strict';

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const CATALOG_URL = '/catalog/ai.json';
  const PICK_KEY = 'zenou_ai_pick';
  /* Open WebUI cold-starts slowly, so the fallback is generous: it is there for
     a frame that never paints at all, not for one that is still booting. */
  const FRAME_TIMEOUT = 22000;

  const FILTERS = [
    ['all', 'Everything'],
    ['chat', 'Chat'],
    ['search', 'Search with sources'],
    ['build', 'Build & compare'],
    ['inline', 'Runs in the frame'],
  ];

  const state = {
    catalog: null,
    tools: [],
    filter: 'all',
    loaded: false,
    timer: 0,
  };

  function toast(title, sub) {
    if (window.Zenou && window.Zenou.toast) window.Zenou.toast(title, sub);
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  }

  function proxyHref(url) {
    return '/web?proxy=' + encodeURIComponent(url);
  }

  /* ---------- console ---------- */

  function frameEls() {
    return {
      frame: $('#aiStage'),
      shroud: $('#aiShroud'),
      shroudTitle: $('#aiShroudTitle'),
      fallback: $('#aiFallback'),
      name: $('#aiStageName'),
      note: $('#aiStageNote'),
      openTab: $('#aiOpenTab'),
      fallbackOpen: $('#aiFallbackOpen'),
      fallbackProxy: $('#aiFallbackProxy'),
      fallbackTitle: $('#aiFallbackTitle'),
      fallbackText: $('#aiFallbackText'),
    };
  }

  function showFallback(tool) {
    const el = frameEls();
    if (!el.fallback) return;
    el.fallbackTitle.textContent = tool ? tool.name + ' did not paint' : 'Nothing drawn yet';
    el.fallbackText.textContent = tool && tool.note
      ? tool.name + ' answered, but the frame stayed empty (' + tool.note + '). Open it in a tab, or carry the address through Magma.'
      : 'A server that refuses framing leaves the frame empty no matter what this page does. Open it in its own tab, or carry it through Magma.';
    el.fallbackOpen.href = tool ? tool.url : '#';
    el.fallbackProxy.href = tool ? proxyHref(tool.url) : '/web';
    el.fallback.hidden = false;
  }

  function hideFallback() {
    const el = frameEls();
    if (el.fallback) el.fallback.hidden = true;
  }

  function loadTool(tool, opts) {
    if (!tool) return;
    const el = frameEls();
    clearTimeout(state.timer);
    hideFallback();
    showShroud('Connecting to ' + tool.name);

    el.name.textContent = tool.name;
    el.note.textContent = (tool.vendor ? tool.vendor + ' · ' : '') + (tool.note || '');
    el.openTab.href = tool.url;
    el.openTab.title = 'Open ' + tool.name + ' in a new tab';

    el.frame.src = 'about:blank';
    requestAnimationFrame(() => { el.frame.src = tool.url; });

    try { localStorage.setItem(PICK_KEY, tool.id); } catch { /* private mode */ }

    paintSwitch(tool.id);
    if (opts && opts.applyQuery) {
      const url = new URL(location.href);
      url.searchParams.set('t', tool.id);
      history.replaceState(null, '', url);
    }

    state.timer = setTimeout(() => { hideShroud(); showFallback(tool); }, FRAME_TIMEOUT);
    el.frame.addEventListener('load', function onLoad() {
      if (el.frame.src === 'about:blank') return;
      clearTimeout(state.timer);
      hideShroud();
      el.frame.removeEventListener('load', onLoad);
    });
  }

  function showShroud(title) {
    const el = frameEls();
    if (!el.shroud) return;
    if (el.shroudTitle && title) el.shroudTitle.textContent = title;
    el.shroud.classList.remove('is-gone');
  }

  function hideShroud() {
    const el = frameEls();
    if (el.shroud) el.shroud.classList.add('is-gone');
  }

  function paintSwitch(activeId) {
    const wrap = $('#aiSwitch');
    if (!wrap || !state.catalog) return;
    const framable = state.tools.filter(t => t.frame === 'inline');
    wrap.innerHTML = '';
    framable.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t.name;
      b.setAttribute('aria-pressed', String(t.id === activeId));
      b.addEventListener('click', () => loadTool(t, { applyQuery: true }));
      wrap.append(b);
    });
  }

  /* ---------- directory ---------- */

  function paintFilters() {
    const wrap = $('#aiFilters');
    if (!wrap) return;
    wrap.innerHTML = '';
    FILTERS.forEach(([key, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-pressed', String(key === state.filter));
      b.addEventListener('click', () => {
        state.filter = key;
        paintFilters();
        paintGrid();
      });
      wrap.append(b);
    });
  }

  function matches(tool) {
    if (state.filter === 'all') return true;
    if (state.filter === 'inline') return tool.frame === 'inline';
    return (tool.tags || []).includes(state.filter);
  }

  function paintGrid() {
    const wrap = $('#aiGrid');
    if (!wrap) return;
    wrap.innerHTML = '';
    const list = state.tools.filter(matches);

    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'ai-deck';
      p.textContent = 'Nothing in that lane yet.';
      wrap.append(p);
      return;
    }

    list.forEach(tool => {
      const card = document.createElement('article');
      card.className = 'ai-card';
      card.innerHTML =
        '<div class="ai-card-top"><b></b><span class="ai-card-vendor"></span></div>' +
        '<p></p>' +
        '<div class="ai-card-foot"><span class="ai-badge"></span><div class="ai-card-actions">' +
        '<a class="ai-mini ai-mini-solid" target="_blank" rel="noopener">Open</a>' +
        '<a class="ai-mini">Magma</a>' +
        '</div></div>';

      card.querySelector('.ai-card-top b').textContent = tool.name;
      card.querySelector('.ai-card-vendor').textContent = tool.vendor || hostOf(tool.url);
      card.querySelector('p').textContent = tool.blurb || '';

      const badge = card.querySelector('.ai-badge');
      badge.dataset.frame = tool.frame;
      badge.textContent = tool.frame === 'inline' ? 'Runs in the frame' : 'Own tab';

      const open = card.querySelector('.ai-mini-solid');
      open.href = tool.url;
      open.setAttribute('aria-label', 'Open ' + tool.name + ' in a new tab');

      const magma = card.querySelector('.ai-mini:not(.ai-mini-solid)');
      magma.href = proxyHref(tool.url);
      magma.textContent = 'Magma';
      magma.title = 'Open Magma in the viewer, with ' + hostOf(tool.url) + ' copied to the clipboard';

      if (tool.frame === 'inline') {
        const run = document.createElement('button');
        run.type = 'button';
        run.className = 'ai-mini';
        run.textContent = 'Run here';
        run.addEventListener('click', () => {
          loadTool(tool, { applyQuery: true });
          $('#aiStageHost').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        open.before(run);
      }

      wrap.append(card);
    });
  }

  /* ---------- boot ---------- */

  async function boot() {
    paintFilters();

    try {
      const res = await fetch(CATALOG_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.catalog = await res.json();
    } catch (e) {
      const wrap = $('#aiGrid');
      if (wrap) {
        const p = document.createElement('p');
        p.className = 'ai-deck';
        p.textContent = 'The catalogue did not load (' + (e && e.message ? e.message : 'unknown error') + '). Serve the folder over HTTP rather than opening the file directly.';
        wrap.append(p);
      }
      paintSwitch('slate');
      return;
    }

    state.tools = Array.isArray(state.catalog.tools) ? state.catalog.tools.slice() : [];
    state.loaded = true;

    const stage = state.tools.find(t => t.id === (state.catalog.stage && state.catalog.stage.id)) || state.tools[0];
    const wanted = new URLSearchParams(location.search).get('t');
    const picked = wanted && state.tools.find(t => t.id === wanted && t.frame === 'inline');
    let remembered = null;
    try { remembered = localStorage.getItem(PICK_KEY); } catch { /* private mode */ }
    const last = !picked && remembered && state.tools.find(t => t.id === remembered && t.frame === 'inline');

    paintGrid();
    if (stage) loadTool(picked || last || stage);
    else paintSwitch('slate');
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('#aiReload').addEventListener('click', () => {
      const frame = $('#aiStage');
      if (!frame || !frame.src || frame.src === 'about:blank') return;
      const src = frame.src;
      hideFallback();
      showShroud('Reloading');
      frame.src = 'about:blank';
      requestAnimationFrame(() => { frame.src = src; });
    });

    $('#aiFull').addEventListener('click', () => {
      const host = $('#aiStageHost');
      if (!host) return;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (host.requestFullscreen) host.requestFullscreen();
      else toast('Fullscreen is not available', 'This browser refused the request.');
    });

    boot();
  });
})();
