/* Zenou Unblocked, settings panel.
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
    ['ocean', 'Ocean'],
    ['sunset', 'Sunset'],
    ['rose', 'Rose'],
    ['mint', 'Mint'],
    ['gold', 'Gold'],
  ];
  const THEME_IDS = new Set(THEMES.map(([id]) => id));

  const PREF_GROUPS = [
    ['glow', 'Glow strength', [['off', 'Off'], ['soft', 'Soft'], ['medium', 'Medium'], ['strong', 'Strong']]],
    ['radius', 'Corner style', [['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round']]],
    ['density', 'Card density', [['cozy', 'Cozy'], ['compact', 'Compact']]],
    ['bg', 'Background', [['aurora', 'Aurora'], ['stars', 'Stars'], ['snow', 'Snow'], ['night', 'Stars + snow'], ['grid', 'Grid'], ['plain', 'Plain'], ['custom', 'Custom image']]],
    ['motion', 'Motion', [['full', 'Full'], ['calm', 'Calm']]],
  ];
  const DEFAULTS = { theme: 'aurora', glow: 'medium', radius: 'soft', density: 'cozy', bg: 'aurora', motion: 'full', bgDim: 45, hue: null };
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

  /* hue -> rgb triple, so the glow layers and canvas keep working */
  function hslTriple(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    const k = (n) => (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map(x => Math.round(x * 255)).join(' ');
  }
  function applyHue(p) {
    const r = document.documentElement;
    if (p.hue == null) {
      r.style.removeProperty('--accent');
      r.style.removeProperty('--accent-2');
      r.style.removeProperty('--accent-rgb');
      r.style.removeProperty('--accent-2-rgb');
      return;
    }
    const h = +p.hue;
    r.style.setProperty('--accent', `hsl(${h} 92% 64%)`);
    r.style.setProperty('--accent-2', `hsl(${(h + 42) % 360} 92% 68%)`);
    r.style.setProperty('--accent-rgb', p.hueRgb || hslTriple(h, 92, 64));
    r.style.setProperty('--accent-2-rgb', p.hue2Rgb || hslTriple((h + 42) % 360, 92, 68));
  }

  function applyPrefs(p) {
    const r = document.documentElement;
    r.dataset.theme = p.theme;

    applyHue(p);
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
    if (key === 'hue') {
      if (value == null) { delete p.hueRgb; delete p.hue2Rgb; }
      else {
        p.hueRgb = hslTriple(+value, 92, 64);
        p.hue2Rgb = hslTriple((+value + 42) % 360, 92, 68);
      }
    }
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
        <p class="settings-note">Appearance applies instantly. Everything is saved in this browser only, nothing is uploaded.</p>

        <section class="settings-section">
          <h3>Look &amp; feel</h3>
          <div class="settings-field">
            <span>Accent</span>
            <div id="seThemes" class="theme-chips"></div>
          </div>
          <div id="sePrefs"></div>

          <div class="settings-field hue-field">
            <span>Custom accent hue <output id="seHueOut">off</output></span>
            <div class="hue-swatch" aria-hidden="true"></div>
            <input id="seHue" type="range" min="0" max="360" step="2" value="320">
            <small>Overrides the presets with your own colour. Drag to 0 and press Reset accent to go back.</small>
            <button id="seHueClear" class="btn btn-ghost" type="button">Use preset colours</button>
          </div>

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
            <small id="seBgNote">Photos and wallpapers work. The image is resized and stored in this browser only, pick “Custom image” above to show it.</small>
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

        <section class="settings-section" id="seWebSection">
          <h3>Web shortcuts</h3>
          <p class="settings-note" style="margin:0">Add one shortcut at a time, up to 12. Give it a key and an exact URL. Pressing that key anywhere in Zenou, outside a text field, turns this tab into that website at once; Open shortcut does the same. It never loads in the Web stage, and a bound shortcut must be removed before its address can change.</p>
          <div id="seTabs" class="tab-binder"></div>
          <p id="seTabsNote" class="settings-note" role="status" aria-live="polite" style="margin:0"></p>
        </section>

        <section class="settings-section">
          <h3>App &amp; shortcuts</h3>
          <div class="settings-field">
            <span>Install as an app</span>
            <button id="seInstall" class="btn btn-ghost" type="button">Install Zenou</button>
            <small>Adds a home-screen icon and opens without browser chrome. Available in Chrome, Edge and most Android browsers.</small>
          </div>
          <div class="settings-field">
            <span>Keyboard</span>
            <button id="seKeys" class="btn btn-ghost" type="button">Show all shortcuts</button>
          </div>
          <div class="settings-field">
            <span>Shortcut keys</span>
            <div id="seKeymap" class="keymap"></div>
            <small>Click Change, then press any key. Defaults use digits and punctuation, so typing a letter in a game never opens a page.</small>
            <button id="seKeysReset" class="btn btn-ghost" type="button" style="margin-top:10px">Reset shortcuts</button>
            <p id="seKeyNote" class="settings-note" role="status" aria-live="polite" style="margin:8px 0 0"></p>
          </div>
          <div class="settings-field">
            <span>Your library</span>
            <div class="play-tools">
              <a class="btn btn-ghost" href="library.html#overview">Stats</a>
              <a class="btn btn-ghost" href="library.html#playlists">Playlists</a>
              <a class="btn btn-ghost" href="library.html#achievements">Achievements</a>
              <a class="btn btn-ghost" href="library.html#data">Backup</a>
            </div>
          </div>
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

    /* custom accent hue */
    const hueInput = $('#seHue', root);
    const hueOut = $('#seHueOut', root);
    const paintHue = () => {
      const p = readPrefs();
      hueInput.value = p.hue == null ? 320 : p.hue;
      hueOut.textContent = p.hue == null ? 'preset' : `${p.hue}°`;
    };
    paintHue();
    hueInput.addEventListener('input', () => {
      setPref('hue', +hueInput.value);
      hueOut.textContent = `${hueInput.value}°`;
      paintThemes();
    });
    $('#seHueClear', root).addEventListener('click', () => {
      setPref('hue', null);
      paintHue();
    });

    /* web tab binder */
    const TAB_KEY = 'zenou_webtabs';
    const tabWrap = $('#seTabs', root);
    const tabNote = $('#seTabsNote', root);

    const MAX_TABS = 12;
    let draftOpen = false;
    const readTabs = () => {
      const raw = store.get(TAB_KEY, []);
      return (Array.isArray(raw) ? raw : [])
        .filter(t => t && t.url)
        .map(t => ({ key: t.key || '', url: t.url }))
        .slice(0, MAX_TABS);
    };
    const saveTabs = (list) => {
      store.set(TAB_KEY, list.slice(0, MAX_TABS));
    };
    const normalizeUrl = (v) => {
      const t = (v || '').trim();
      if (!t) return '';
      if (/^https?:\/\/[^\s]+$/i.test(t)) return t;
      if (/^[\w-]+(\.[\w-]+)+(\/[^\s]*)?$/.test(t)) return `https://${t}`;
      return '';
    };
    const setTabNote = (text, bad) => {
      tabNote.textContent = text || '';
      tabNote.classList.toggle('is-bad', !!bad);
    };
    const keyName = (k) => (k === ' ' ? 'Space' : k);
    const keyMatches = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
    const siteKeys = () => ({
      search: '/', random: '4', games: '1', library: '2', settings: '3', shortcuts: '?',
      ...(store.get('zenou_keymap', {}) || {}),
    });
    const keyConflict = (key, list, except) => {
      const k = String(key).toLowerCase();
      if (Object.values(siteKeys()).map(v => String(v).toLowerCase()).includes(k)) return 'reserved';
      const hit = list.findIndex((t, idx) => idx !== except && t.key && keyMatches(t.key, key));
      return hit === -1 ? null : hit;
    };
    const launchShortcut = (tab) => { location.href = tab.url; };

    let webCaptureCancel = null;
    const captureKey = (btn, onKey) => {
      if (webCaptureCancel) webCaptureCancel();
      const old = btn.textContent;
      let active = true;
      let handler;
      const cleanup = () => {
        if (!active) return;
        active = false;
        document.removeEventListener('keydown', handler, true);
        btn.classList.remove('is-capturing');
        btn.textContent = old;
        if (webCaptureCancel === cancel) webCaptureCancel = null;
      };
      const cancel = cleanup;
      handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') { cleanup(); setTabNote('Change cancelled.', false); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) { setTabNote('Pick one key, without Ctrl, Cmd or Alt.', true); return; }
        if (!e.key || e.key.length !== 1 || e.key === ' ') {
          setTabNote('Pick one printable key. Space is reserved for fullscreen.', true);
          return;
        }
        cleanup();
        onKey(e.key);
      };
      webCaptureCancel = cancel;
      btn.classList.add('is-capturing');
      btn.textContent = 'Press a key...';
      document.addEventListener('keydown', handler, true);
    };

    const makeTabRow = (tab, i) => {
      const row = document.createElement('div');
      row.className = 'tab-bind' + (tab ? ' is-bound' : ' is-draft');

      if (tab) {
        row.innerHTML = `
          <div class="tab-bind-head">
            <span class="tab-bind-index"></span>
            <span class="tab-bind-state">Direct, in this tab</span>
          </div>
          <div class="tab-bind-address"><span>Address</span><code></code></div>
          <div class="tab-bind-keyrow">
            <div class="tab-key-block"><span>Key</span><button type="button" class="tab-key" data-act="key"></button></div>
            <p class="tab-bind-hint">Click the key, then press the key that should open this address.</p>
          </div>
          <div class="tab-bind-actions">
            <button type="button" class="btn btn-solid" data-act="open">Open shortcut</button>
            <button type="button" class="btn btn-ghost" data-act="clear">Remove shortcut</button>
          </div>
          <p class="tab-bind-hint">Pressing this key opens the address at once, even from another page. It never loads in the Web stage.</p>`;
        row.querySelector('.tab-bind-index').textContent = `Shortcut ${i + 1}`;
        row.querySelector('.tab-bind-address code').textContent = tab.url || '';
        const keyBtn = row.querySelector('[data-act="key"]');
        keyBtn.textContent = tab.key ? keyName(tab.key) : 'Set key';
        keyBtn.classList.toggle('is-unset', !tab.key);

        keyBtn.addEventListener('click', () => {
          captureKey(keyBtn, (key) => {
            const list = readTabs();
            const current = list[i];
            if (!current) { setTabNote('That shortcut is no longer here.', true); paintTabs(); return; }
            const clash = keyConflict(key, list, i);
            if (clash === 'reserved') {
              setTabNote('That key is reserved by Zenou itself. Pick another.', true);
              paintTabs();
              return;
            }
            if (typeof clash === 'number') {
              setTabNote(`That key is already used by Shortcut ${clash + 1}.`, true);
              paintTabs();
              return;
            }
            current.key = key;
            saveTabs(list);
            setTabNote(`Shortcut ${i + 1} now opens with ${keyName(key)}.`, false);
            paintTabs();
          });
        });

        row.querySelector('[data-act="open"]').addEventListener('click', () => {
          const list = readTabs();
          const current = list[i];
          if (!current) { setTabNote('That shortcut is no longer here.', true); paintTabs(); return; }
          launchShortcut(current);
        });
        row.querySelector('[data-act="clear"]').addEventListener('click', () => {
          const list = readTabs();
          if (list[i]) list.splice(i, 1);
          saveTabs(list);
          setTabNote(`Shortcut ${i + 1} removed.`, false);
          paintTabs();
        });
        return row;
      }

      let draftKey = '';
      row.innerHTML = `
        <div class="tab-bind-head">
          <span class="tab-bind-index">New shortcut</span>
          <span class="tab-bind-state">Direct, in this tab</span>
        </div>
        <div class="tab-bind-keyrow">
          <div class="tab-key-block"><span>Key</span><button type="button" class="tab-key" data-act="key">Set key</button></div>
          <p class="tab-bind-hint">Click Set key, then press the key that should open your address.</p>
        </div>
        <label class="tab-field tab-field-wide"><span>Full address</span><input type="text" class="tab-bind-url" inputmode="url" autocomplete="off" placeholder="https://example.com"></label>
        <p class="tab-bind-hint">The key is yours alone. Pressing it anywhere in Zenou, outside a text field, leaves this site at once and opens the address. It never loads inside the Web stage.</p>
        <div class="tab-bind-actions">
          <button type="button" class="btn btn-solid" data-act="bind">Bind shortcut</button>
          <button type="button" class="btn btn-ghost" data-act="clear">Cancel</button>
        </div>`;

      const keyBtn = row.querySelector('[data-act="key"]');
      keyBtn.addEventListener('click', () => {
        captureKey(keyBtn, (key) => {
          const list = readTabs();
          const clash = keyConflict(key, list, -1);
          if (clash === 'reserved') {
            setTabNote('That key is reserved by Zenou itself. Pick another.', true);
            return;
          }
          if (typeof clash === 'number') {
            setTabNote(`That key is already used by Shortcut ${clash + 1}.`, true);
            return;
          }
          draftKey = key;
          keyBtn.textContent = keyName(key);
          keyBtn.classList.remove('is-unset');
          setTabNote(`Key ${keyName(key)} ready. Add the address and bind.`, false);
        });
      });

      row.querySelector('[data-act="bind"]').addEventListener('click', () => {
        const urlEl = row.querySelector('.tab-bind-url');
        const url = normalizeUrl(urlEl.value);
        if (!draftKey) { setTabNote('Set a key first, then add the address.', true); keyBtn.focus(); return; }
        if (!url) { setTabNote('That is not a usable address, include a domain, like example.com or https://example.com.', true); urlEl.focus(); return; }
        const list = readTabs();
        if (list.length >= MAX_TABS) { setTabNote(`The limit is ${MAX_TABS} shortcuts. Remove one first.`, true); return; }
        const clash = keyConflict(draftKey, list, -1);
        if (clash === 'reserved') { setTabNote('That key is reserved by Zenou itself. Pick another.', true); keyBtn.focus(); return; }
        if (typeof clash === 'number') { setTabNote(`That key is already used by Shortcut ${clash + 1}.`, true); keyBtn.focus(); return; }
        const dupe = list.findIndex(t => t.url === url);
        if (dupe !== -1) {
          setTabNote(`That URL is already bound to Shortcut ${dupe + 1}. Remove the existing shortcut first.`, true);
          return;
        }
        list.push({ key: draftKey, url });
        saveTabs(list);
        draftOpen = false;
        setTabNote(`Shortcut bound to ${keyName(draftKey)}. Press it anywhere in Zenou to open ${url}.`, false);
        paintTabs();
      });
      row.querySelector('[data-act="clear"]').addEventListener('click', () => {
        draftOpen = false;
        setTabNote('No shortcut added.', false);
        paintTabs();
      });
      return row;
    };

    const paintTabs = () => {
      if (webCaptureCancel) webCaptureCancel();
      const list = readTabs();
      tabWrap.innerHTML = '';
      list.forEach((tab, i) => tabWrap.append(makeTabRow(tab, i)));

      if (!list.length || draftOpen) {
        if (list.length < MAX_TABS) tabWrap.append(makeTabRow(null, -1));
        return;
      }
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn btn-ghost tab-add';
      add.textContent = '+ Add another shortcut';
      add.addEventListener('click', () => {
        draftOpen = true;
        paintTabs();
        const draft = tabWrap.querySelector('.is-draft');
        draft?.scrollIntoView({ block: 'nearest' });
        draft?.querySelector('.tab-key')?.focus();
      });
      tabWrap.append(add);
    };
    paintTabs();

    /* rebindable global shortcuts */
    const KEYMAP_KEY = 'zenou_keymap';
    const KEY_DEFAULTS = { search: '/', random: '4', games: '1', library: '2', settings: '3', shortcuts: '?' };
    const KEY_ACTIONS = [
      ['random', 'Random game'],
      ['games', 'Games catalogue'],
      ['library', 'My Library'],
      ['settings', 'Settings'],
      ['search', 'Focus search'],
      ['shortcuts', 'Shortcut sheet'],
    ];
    const keyWrap = $('#seKeymap', root);
    const keyNote = $('#seKeyNote', root);
    const readKeys = () => ({ ...KEY_DEFAULTS, ...(store.get(KEYMAP_KEY, {}) || {}) });
    const keyLabel = (action) => (KEY_ACTIONS.find(([a]) => a === action) || [action])[1];
    const setKeyNote = (text, bad) => {
      keyNote.textContent = text || '';
      keyNote.classList.toggle('is-bad', !!bad);
    };
    let capture = null;
    const endCapture = () => {
      if (!capture) return;
      document.removeEventListener('keydown', capture.handler, true);
      capture.btn.textContent = 'Change';
      capture = null;
    };
    const paintKeys = () => {
      const map = readKeys();
      keyWrap.innerHTML = '';
      KEY_ACTIONS.forEach(([action, label]) => {
        const row = document.createElement('div');
        row.className = 'keymap-row';
        row.innerHTML = '<span class="keymap-label"></span><kbd></kbd><button type="button" class="btn btn-ghost" data-act="set">Change</button>';
        row.querySelector('.keymap-label').textContent = label;
        row.querySelector('kbd').textContent = map[action] || '?';
        row.querySelector('button').addEventListener('click', () => {
          endCapture();
          const btn = row.querySelector('button');
          btn.textContent = 'Press a key';
          setKeyNote(`Press a key for ${label.toLowerCase()}. Escape cancels.`, false);
          const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') {
              endCapture();
              setKeyNote('Change cancelled.', false);
              return;
            }
            if (e.ctrlKey || e.metaKey) {
              setKeyNote('Pick a single key, without Ctrl or Cmd.', true);
              return;
            }
            if (e.key.length !== 1 || [' ', 'Enter', 'Tab'].includes(e.key)) {
              setKeyNote('Pick a printable key other than Space, Enter or Tab.', true);
              return;
            }
            const map = readKeys();
            const clash = KEY_ACTIONS.find(([a]) => a !== action && map[a] === e.key);
            if (clash) {
              endCapture();
              setKeyNote(`That key is already used by ${keyLabel(clash[0])}. Pick another.`, true);
              return;
            }
            map[action] = e.key;
            const saved = {};
            KEY_ACTIONS.forEach(([a]) => { saved[a] = map[a]; });
            store.set(KEYMAP_KEY, saved);
            endCapture();
            paintKeys();
            setKeyNote(`${label} now uses ${e.key}.`, false);
          };
          capture = { handler, btn };
          document.addEventListener('keydown', handler, true);
        });
        keyWrap.append(row);
      });
    };
    paintKeys();
    $('#seKeysReset', root).addEventListener('click', () => {
      endCapture();
      store.del(KEYMAP_KEY);
      paintKeys();
      setKeyNote('Shortcuts reset to the defaults: 4, 1, 2, 3, / and ?.', false);
    });

    /* app + shortcuts */
    $('#seInstall', root).addEventListener('click', () => {
      if (window.Zenou) window.Zenou.install();
    });
    $('#seKeys', root).addEventListener('click', () => {
      if (window.Zenou) window.Zenou.shortcutSheet();
    });

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
      try { store.del('zenou_view'); } catch { /* ignore */ }
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

  /* ---------- direct key shortcuts (Web shortcuts) ---------- */
  const WEB_TAB_KEY = 'zenou_webtabs';
  const SITE_KEY_DEFAULTS = { search: '/', random: '4', games: '1', library: '2', settings: '3', shortcuts: '?' };
  function directShortcutFor(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return null;
    if (!e.key || e.key.length !== 1 || e.key === ' ') return null;
    const target = e.target;
    if (target && target.matches && target.matches('input, textarea, select, [contenteditable]')) return null;
    if (document.querySelector('.settings-overlay:not([hidden]), .sheet-overlay, .web-pin-overlay')) return null;
    let list;
    try { list = JSON.parse(localStorage.getItem(WEB_TAB_KEY) || '[]'); } catch { return null; }
    if (!Array.isArray(list)) return null;
    let savedKeys = {};
    try { savedKeys = JSON.parse(localStorage.getItem('zenou_keymap') || '{}') || {}; } catch { /* ignore */ }
    const reserved = Object.values({ ...SITE_KEY_DEFAULTS, ...savedKeys }).map(v => String(v).toLowerCase());
    if (reserved.includes(e.key.toLowerCase())) return null;
    return list.find(t => t && t.url && t.key && String(t.key).toLowerCase() === e.key.toLowerCase()) || null;
  }
  document.addEventListener('keydown', (e) => {
    const hit = directShortcutFor(e);
    if (!hit) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    location.href = hit.url;
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectButton);
  else injectButton();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.zenouSettingsBoot && window.zenouSettingsBoot());
  else if (window.zenouSettingsBoot) window.zenouSettingsBoot();
})();
