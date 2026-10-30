/* Zenou Unblocked — settings panel.
 * Appearance: accent pair, glow strength, corner style, card density,
 * background style and motion. Disguise: tab title, preset/custom favicon.
 * Everything applies instantly and is stored in this browser only.
 */
'use strict';

(function () {
  const $ = (s, el) => (el || document).querySelector(s);

  const store = {
    get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  /* ---------- appearance ---------- */
  const THEMES = [
    ['aurora', 'Aurora'],
    ['cyan', 'Cyan'],
    ['violet', 'Violet'],
    ['emerald', 'Emerald'],
    ['amber', 'Amber'],
    ['crimson', 'Crimson'],
    ['ice', 'Ice'],
  ];
  const THEME_IDS = new Set(THEMES.map(([id]) => id));

  const PREF_GROUPS = [
    ['glow', 'Glow strength', [['off', 'Off'], ['soft', 'Soft'], ['medium', 'Medium'], ['strong', 'Strong']]],
    ['radius', 'Corner style', [['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round']]],
    ['density', 'Card density', [['cozy', 'Cozy'], ['compact', 'Compact']]],
    ['bg', 'Background', [['aurora', 'Aurora'], ['stars', 'Stars'], ['snow', 'Snow'], ['night', 'Stars + snow'], ['grid', 'Grid'], ['plain', 'Plain'], ['custom', 'Custom image']]],
    ['motion', 'Motion', [['full', 'Full'], ['calm', 'Calm']]],
  ];
  const DEFAULTS = { theme: 'aurora', glow: 'medium', radius: 'soft', density: 'cozy', bg: 'aurora', motion: 'full', bgDim: 45 };
  const PREF_KEY = 'zenou_prefs';
  const BG_KEY = 'zenou_bgimg';

  function readPrefs() {
    const saved = store.get(PREF_KEY, {});
    const legacy = store.get('zenou_mask', {});
    const p = { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
    if (!saved || !saved.theme) {
      if (legacy && THEME_IDS.has(legacy.theme)) p.theme = legacy.theme;
    }
    if (!THEME_IDS.has(p.theme)) p.theme = DEFAULTS.theme;
    return p;
  }
  function writePrefs(p) { store.set(PREF_KEY, p); }

  function readBgImage() { try { return localStorage.getItem(BG_KEY) || ''; } catch { return ''; } }
  function applyBgImage() {
    const r = document.documentElement;
    const v = readBgImage();
    r.classList.toggle('has-custom', !!v);
    if (v) r.style.setProperty('--custom-bg', `url("${v}")`);
    else r.style.removeProperty('--custom-bg');
    return v;
  }

  function applyPrefs(p) {
    const r = document.documentElement;
    r.dataset.theme = p.theme;
    r.dataset.glow = p.glow;
    r.dataset.radius = p.radius;
    r.dataset.density = p.density;
    r.dataset.bg = p.bg;
    r.dataset.motion = p.motion;
    const dim = Number.isFinite(+p.bgDim) ? Math.min(85, Math.max(0, +p.bgDim)) : DEFAULTS.bgDim;
    r.style.setProperty('--bg-dim', String(dim / 100));
    applyBgImage();
  }
  function setPref(key, value) {
    const p = readPrefs();
    p[key] = value;
    writePrefs(p);
    applyPrefs(p);
  }

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

  /* ---------- title / icon masking ---------- */
  const maskState = { title: '', icon: '' };
  let titleObserver = null;

  function applyFavicon(icon) {
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
      titleObserver = new MutationObserver(() => {
        if (maskState.title && document.title !== maskState.title) document.title = maskState.title;
      });
      const t = document.querySelector('title') || document.head.appendChild(document.createElement('title'));
      titleObserver.observe(t, { childList: true, characterData: true, subtree: true });
    }
  }

  window.zenouMaskedTitle = function (fallback) { return maskState.title || fallback; };

  window.zenouSettingsBoot = function () {
    const prefs = readPrefs();
    applyPrefs(prefs);
    const mask = store.get('zenou_mask', {});
    applyTabMask(mask.title, mask.icon, mask.iconData);
    if (window.ZenouAtmo) window.ZenouAtmo.refresh();
  };

  /* ---------- custom background image ---------- */
  const MAX_BG_BYTES = 3.4 * 1024 * 1024;
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Pick an image file (JPG, PNG, WebP).')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
          let out = '';
          for (const [max, quality] of [[2400, .84], [1800, .78], [1400, .7], [1000, .62]]) {
            const scale = Math.min(1, max / longest);
            const cw = Math.max(1, Math.round(img.naturalWidth * scale));
            const ch = Math.max(1, Math.round(img.naturalHeight * scale));
            const c = document.createElement('canvas');
            c.width = cw; c.height = ch;
            c.getContext('2d').drawImage(img, 0, 0, cw, ch);
            out = c.toDataURL('image/jpeg', quality);
            if (out.length < MAX_BG_BYTES) break;
          }
          URL.revokeObjectURL(url);
          resolve(out);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
      img.src = url;
    });
  }

  /* ---------- panel ---------- */
  function buildPanel() {
    const prefs = readPrefs();
    const mask = store.get('zenou_mask', {});

    const root = document.createElement('div');
    root.className = 'settings-overlay';
    root.hidden = true;
    root.innerHTML = `
      <div class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
        <button class="settings-close btn btn-ghost" type="button" aria-label="Close settings">✕</button>
        <h2 id="settingsTitle">Settings</h2>
        <p class="settings-note">Appearance applies instantly. Everything is saved in this browser only — nothing is uploaded.</p>

        <section class="settings-section">
          <h3>Look &amp; feel</h3>
          <div class="settings-field">
            <span>Accent</span>
            <div id="seThemes" class="theme-chips"></div>
          </div>
          <div id="sePrefs"></div>

          <div class="settings-preview" aria-hidden="true">
            <span class="preview-chip">Sample collection</span>
            <button class="preview-btn" type="button" tabindex="-1">Play now</button>
            <div class="preview-card">
              <span class="preview-thumb"></span>
              <span class="preview-name">Game title</span>
            </div>
          </div>
        </section>

        <section class="settings-section">
          <h3>Background image</h3>
          <div class="settings-field">
            <span>Custom background image</span>
            <div class="bg-row">
              <div id="seBgThumb" class="bg-thumb" aria-hidden="true"></div>
              <div class="bg-actions">
                <input id="seBgFile" type="file" accept="image/*">
                <button id="seBgClear" class="btn btn-ghost" type="button">Remove image</button>
              </div>
            </div>
            <small id="seBgNote">Photos and wallpapers work. The image is resized and stored in this browser only — pick “Custom image” above to show it.</small>
          </div>
          <label class="settings-field" for="seDim">
            <span>Image dim <output id="seDimOut">45%</output></span>
            <input id="seDim" type="range" min="0" max="85" step="5" value="45">
            <small>Raise the dim when the picture fights the text.</small>
          </label>

        </section>

        <section class="settings-section">
          <h3>Tab disguise</h3>
          <label class="settings-field">
            <span>Tab title</span>
            <input id="seTitle" type="text" placeholder="Example: Google Docs" value="">
          </label>
          <div class="settings-field">
            <span>Preset tab icons</span>
            <div id="seIcons" class="icon-row"></div>
          </div>
          <label class="settings-field">
            <span>Custom tab icon</span>
            <input id="seIconFile" type="file" accept="image/*">
            <small>Click a preset to change the tab icon immediately. Custom uploads are saved when you press Done.</small>
          </label>
        </section>

        <div class="settings-actions">
          <button id="seReset" class="btn btn-ghost" type="button">Reset all</button>
          <button id="seSave" class="btn btn-solid" type="button">Done</button>
        </div>
      </div>`;

    const titleInput = $('#seTitle', root);
    const themeWrap = $('#seThemes', root);
    const prefsWrap = $('#sePrefs', root);
    const iconRow = $('#seIcons', root);
    const fileInput = $('#seIconFile', root);
    const bgFile = $('#seBgFile', root);
    const bgThumb = $('#seBgThumb', root);
    const bgNote = $('#seBgNote', root);
    const dimInput = $('#seDim', root);
    const dimOut = $('#seDimOut', root);
    titleInput.value = mask.title || '';

    const paintBg = () => {
      const v = readBgImage();
      bgThumb.style.backgroundImage = v ? `url("${v}")` : '';
      bgThumb.classList.toggle('has-image', !!v);
      dimInput.value = String(readPrefs().bgDim);
      dimOut.textContent = readPrefs().bgDim + '%';
    };
    paintBg();

    bgFile.addEventListener('change', async () => {
      const f = bgFile.files && bgFile.files[0];
      if (!f) return;
      bgNote.textContent = 'Preparing image…';
      try {
        const data = await shrinkImage(f);
        try { localStorage.setItem(BG_KEY, data); }
        catch { throw new Error('That image is too large for this browser’s storage. Try a smaller file.'); }
        applyBgImage();
        setPref('bg', 'custom');
        paintBg();
        paintBgSeg();
        bgNote.textContent = 'Background saved. It lives in this browser only.';
      } catch (err) {
        bgNote.textContent = err && err.message ? err.message : 'That image could not be used.';
      } finally {
        bgFile.value = '';
      }
    });

    $('#seBgClear', root).addEventListener('click', () => {
      try { localStorage.removeItem(BG_KEY); } catch { /* ignore */ }
      applyBgImage();
      paintBg();
      bgNote.textContent = 'Image removed.';
    });

    dimInput.addEventListener('input', () => {
      dimOut.textContent = dimInput.value + '%';
      setPref('bgDim', +dimInput.value);
    });

    /* accent chips */
    const paintThemes = () => {
      const cur = readPrefs().theme;
      themeWrap.innerHTML = '';
      THEMES.forEach(([id, name]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'theme-chip';
        b.dataset.id = id;
        b.setAttribute('aria-pressed', cur === id ? 'true' : 'false');
        b.innerHTML = `<i class="swatch sw-${id}" aria-hidden="true"></i><span></span>`;
        b.querySelector('span').textContent = name;
        b.addEventListener('click', () => {
          setPref('theme', id);
          paintThemes();
        });
        themeWrap.append(b);
      });
    };
    paintThemes();

    /* segmented preference groups */
    const paintBgSeg = () => paintPrefGroup('bg');
    const paintPrefGroup = (key, options) => {
      const current = readPrefs()[key];
      const seg = prefsWrap.querySelector(`[data-seg="${key}"]`);
      if (!seg) return;
      seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.val === current ? 'true' : 'false'));
    };

    PREF_GROUPS.forEach(([key, label, options]) => {
      const field = document.createElement('div');
      field.className = 'settings-field';
      const span = document.createElement('span');
      span.textContent = label;
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.dataset.seg = key;
      options.forEach(([val, text]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.val = val;
        b.textContent = text;
        b.setAttribute('aria-pressed', readPrefs()[key] === val ? 'true' : 'false');
        b.addEventListener('click', () => {
          setPref(key, val);
          paintPrefGroup(key, options);
          if (key === 'bg' && val === 'custom' && !readBgImage()) bgFile.click();
        });
        seg.append(b);
      });
      field.append(span, seg);
      prefsWrap.append(field);
    });

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
      };
      if (!next.title && !next.icon && !next.iconData) store.del('zenou_mask');
      else store.set('zenou_mask', next);
      close();
    });

    $('#seReset', root).addEventListener('click', () => {
      store.del('zenou_mask');
      store.del(PREF_KEY);
      try { localStorage.removeItem(BG_KEY); } catch { /* ignore */ }
      const r = document.documentElement;
      ['theme', 'glow', 'radius', 'density', 'bg', 'motion'].forEach(k => delete r.dataset[k]);
      r.style.removeProperty('--bg-dim');
      r.style.removeProperty('--custom-bg');
      r.classList.remove('has-custom');
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.zenouSettingsBoot && window.zenouSettingsBoot());
  else if (window.zenouSettingsBoot) window.zenouSettingsBoot();
})();
