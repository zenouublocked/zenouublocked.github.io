/* Zenou Unblocked — settings panel: tab masking (title/icon presets + custom)
 * and colour themes. Everything applies locally in your browser (localStorage);
 * nothing is uploaded or tracked.
 */
'use strict';

(function () {
  const $ = (s, el) => (el || document).querySelector(s);

  const store = {
    get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  /* ---------- themes ---------- */
  const THEMES = [
    ['emerald', 'Emerald'],
    ['pink', 'Pink'],
    ['purple', 'Purple'],
    ['blue', 'Blue'],
    ['orange', 'Orange'],
    ['mono', 'Mono'],
  ];

  /* ---------- tab icon presets (inline SVG data URIs, drawn locally) ---------- */
  function svgIcon(svg) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  const ICON_PRESETS = [
    ['roblox', 'Roblox', svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#e2231a"/><rect x="11" y="7" width="14" height="14" rx="2" transform="rotate(12 18 14)" fill="#fff"/></svg>')],
    ['youtube', 'YouTube', svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#ff0033"/><path d="M13 10.5 23 16l-10 5.5z" fill="#fff"/></svg>')],
    ['google', 'Google', svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#fff"/><text x="16" y="22" font-family="Arial, sans-serif" font-size="17" font-weight="700" text-anchor="middle" fill="#4285F4">G</text></svg>')],
    ['drive', 'Google Drive', svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#fff"/><path d="M11 6h10l7 12-5 8H9l-2-3.5z" fill="#0f9d58"/><path d="M11 6h10l3 5.5H8z" fill="#ffcf44"/><path d="M9 23.5 14 11.5h-6L3 19z" fill="#11a861"/><path d="M21 23.5H9L23 11.5h4z" fill="#4285f4"/></svg>')],
    ['classroom', 'Classroom', svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0f9d58"/><rect x="8" y="12" width="16" height="11" rx="1.5" fill="#fff"/><path d="M16 8a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-6 5h12l-1 2H11z" fill="#fff"/></svg>')],
  ];

  const THUMB_TXT = 'Customize the browser tab and colours.\nEverything is saved only in your own browser (localStorage) — no data is sent anywhere.';

  /* ---------- root boot: apply saved settings ---------- */
  function applyTheme(theme) {
    if (THEMES.some(([id]) => id === theme)) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }

  /* current mask state — the title observer keeps re-enforcing it,
   * so anything else that touches document.title (player page, router)
   * can never wipe the cloak while a game is open. */
  const maskState = { title: '', icon: '' };
  let titleObserver = null;

  function applyFavicon(icon) {
    // remove every existing icon link (svg favicon, shortcut, apple-touch)
    document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(n => n.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = /svg/i.test(icon.slice(0, 60)) ? 'image/svg+xml' : 'image/png';
    link.href = icon;
    document.head.append(link);
  }

  function applyTabMask(title, iconPresetId, customIcon) {
    maskState.title = (title || '').trim();
    const preset = ICON_PRESETS.find(([id]) => id === iconPresetId);
    maskState.icon = customIcon || (preset && preset[2]) || '';
    if (maskState.title) document.title = maskState.title;
    if (maskState.icon) applyFavicon(maskState.icon);
    if (maskState.title && !titleObserver) {
      // keep the masked title pinned: restore it any time something else rewrites it
      titleObserver = new MutationObserver(() => {
        if (maskState.title && document.title !== maskState.title) document.title = maskState.title;
      });
      const t = document.querySelector('title') || document.head.appendChild(document.createElement('title'));
      titleObserver.observe(t, { childList: true, characterData: true, subtree: true });
    }
  }

  /* the player page asks for the masked title so embed-detect code and
   * analytics inside play.js land inside the cloak too */
  window.zenouMaskedTitle = function (fallback) { return maskState.title || fallback; };

  window.zenouSettingsBoot = function () {
    let link = document.querySelector('link[rel="icon"]');
    if (link) link.dataset.orig = link.getAttribute('href');
    const mask = store.get('zenou_mask', {});
    applyTheme(mask.theme);
    applyTabMask(mask.title, mask.icon, mask.iconData);
  };

  /* ---------- panel ---------- */
  function buildPanel() {
    const mask = store.get('zenou_mask', {});

    const root = document.createElement('div');
    root.className = 'settings-overlay';
    root.hidden = true;
    root.innerHTML = `
      <div class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
        <button class="settings-close btn btn-ghost" type="button" aria-label="Close settings">✕</button>
        <h2 id="settingsTitle">Settings</h2>
        <p class="settings-note">Customize the browser tab title, icon, and site colour theme.</p>

        <label class="settings-field">
          <span>Tab title</span>
          <input id="seTitle" type="text" placeholder="Example: Roblox" value="">
        </label>

        <div class="settings-field">
          <span>Colour theme</span>
          <div id="seThemes" class="theme-chips"></div>
        </div>

        <div class="settings-field">
          <span>Preset tab icons</span>
          <div id="seIcons" class="icon-row"></div>
        </div>

        <div class="settings-field">
          <span>Custom tab icon</span>
          <input id="seIconFile" type="file" accept="image/*">
          <p class="icon-preview-note">Click a preset to change the tab icon immediately. Custom uploads are saved when you press Save.</p>
        </div>

        <div class="settings-actions">
          <button id="seSave" class="btn btn-solid" type="button"><span>Save</span></button>
          <button id="seReset" class="btn btn-ghost" type="button"><span>Reset</span></button>
        </div>
        <p class="settings-note">The selected colour theme is saved automatically.</p>
      </div>`;

    const titleInput = $('#seTitle', root);
    const themeWrap = $('#seThemes', root);
    const iconRow = $('#seIcons', root);
    const fileInput = $('#seIconFile', root);
    titleInput.value = mask.title || '';

    /* theme chips */
    let themePills = [];
    const paintThemes = () => {
      const cur = document.documentElement.dataset.theme || 'emerald';
      themeWrap.innerHTML = '';
      themePills = THEMES.map(([id, name]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'theme-chip';
        b.dataset.id = id;
        b.setAttribute('aria-pressed', cur === id ? 'true' : 'false');
        b.innerHTML = `<i class="swatch sw-${id}" aria-hidden="true"></i><span></span>`;
        b.querySelector('span').textContent = name;
        b.addEventListener('click', () => {
          applyTheme(id);
          paintThemes();
        });
        themeWrap.append(b);
        return b;
      });
    };
    paintThemes();

    /* icon presets */
    const paintIcons = () => {
      iconRow.innerHTML = '';
      for (const [id, name, data] of ICON_PRESETS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'icon-chip';
        b.dataset.id = id;
        b.title = name;
        b.setAttribute('aria-label', `Tab icon: ${name}`);
        b.innerHTML = `<img src="${data}" alt="${name} icon">`;
        b.addEventListener('click', () => {
          applyTabMask(titleInput.value || undefined, id);
          [...iconRow.children].forEach(x => x.classList.remove('active'));
          b.classList.add('active');
        });
        iconRow.append(b);
      }
    };
    paintIcons();

    let customData = null;
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        customData = String(r.result);
        applyTabMask(titleInput.value || undefined, mask.icon, customData);
      };
      r.readAsDataURL(f);
    });

    $('#seSave', root).addEventListener('click', () => {
      const activePreset = [...iconRow.children].find(x => x.classList.contains('active'));
      const next = {
        title: titleInput.value.trim(),
        icon: activePreset ? activePreset.dataset.id : (mask.icon || null),
        iconData: customData,
        theme: document.documentElement.dataset.theme || 'emerald',
      };
      if (!next.title && !next.icon && !next.iconData) store.del('zenou_mask');
      else store.set('zenou_mask', next);
      close();
    });

    $('#seReset', root).addEventListener('click', () => {
      store.del('zenou_mask');
      delete document.documentElement.dataset.theme;
      let link = document.querySelector('link[rel="icon"]');
      if (link) link.href = link.dataset.orig || link.getAttribute('href') || '';
      customData = null;
      titleInput.value = '';
      location.reload();
    });

    document.body.append(root);
    return root;
  }

  function close() {
    const o = document.querySelector('.settings-overlay');
    if (o) { o.hidden = true; o.classList.remove('open'); }
  }
  function open() {
    let o = document.querySelector('.settings-overlay');
    if (!o) o = buildPanel();
    o.hidden = false;
    requestAnimationFrame(() => o.classList.add('open'));
    const closeBtn = $('.settings-close', o);
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', close);
      o.addEventListener('click', (e) => { if (e.target === o) close(); });
    }
  }

  function injectButton() {
    const hosts = ['body > header.topbar', 'body > header'];
    let bar = null;
    for (const sel of hosts) { bar = document.querySelector(sel); if (bar) break; }
    if (!bar) return;
    const b = document.createElement('button');
    b.className = 'btn btn-ghost settings-btn';
    b.type = 'button';
    b.id = 'settingsBtn';
    b.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7zm7.4-2.8.1-.7-.1-.7 1.9-1.5-1.7-3-2.2.9a7.6 7.6 0 0 0-1.2-.7L15.9 5h-3.8l-.3 2.2c-.4.2-.8.4-1.2.7l-2.2-.9-1.7 3 1.9 1.5a8 8 0 0 0 0 1.4L6.7 14.4l1.7 3 2.2-.9c.4.3.8.5 1.2.7l.3 2.2h3.8l.3-2.2c.4-.2.8-.4 1.2-.7l2.2.9 1.7-3-1.9-1.7z"/></svg><span>Settings</span>';
    b.addEventListener('click', open);
    const anchor = document.querySelector('#randomBtn') || document.querySelector('.play-topbar #backBtn') || bar.lastElementChild;
    if (anchor) anchor.insertAdjacentElement('afterend', b); else bar.append(b);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectButton);
  else injectButton();

  // apply saved settings (theme + tab mask) right away
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.zenouSettingsBoot && window.zenouSettingsBoot());
  else if (window.zenouSettingsBoot) window.zenouSettingsBoot();
})();
