/* ZenouMath, first-visit agreement.
 *
 * A visitor must decide before the site is usable: the page underneath is
 * hidden until they either accept or leave. Acceptance is one localStorage
 * record — a version string and a timestamp, nothing about the person — so a
 * returning visitor is not asked again, and a material change to the terms can
 * ask once more by bumping VERSION.
 *
 *   localStorage['zenoumath.consent'] = { v: VERSION, at: ISO date }
 *
 * Legal pages are exempt: a visitor has to be able to read the document they
 * are being asked to agree to. They can still open the gate with any element
 * carrying [data-consent-review], which is what the footer link does.
 */
(function () {
  'use strict';

  var VERSION = '2026-11-07';
  var KEY = 'zenoumath.consent';
  var EXEMPT =
    location.pathname.indexOf('/legal') === 0 ||
    (document.body && document.body.hasAttribute('data-consent-exempt'));
  var GATE_ID = 'consentGate';

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var rec = JSON.parse(raw);
      return rec && typeof rec === 'object' ? rec : null;
    } catch (e) {
      return null;
    }
  }

  function write(rec) {
    try {
      localStorage.setItem(KEY, JSON.stringify(rec));
    } catch (e) {
      /* storage blocked: the decision holds for this page view only */
    }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
  }

  function accepted() {
    var rec = read();
    return !!rec && rec.v === VERSION;
  }

  function release() {
    document.documentElement.classList.remove('consent-pending');
  }

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (html != null) node.innerHTML = html;
    return node;
  }

  function build(mode) {
    var gate = el('div', {
      class: 'consent-gate',
      id: GATE_ID,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'consentTitle',
      'aria-describedby': 'consentIntro',
    });

    var updating = mode === 'update';
    var reviewing = mode === 'review';

    var reason = updating
      ? '<p class="consent-reason">The agreement has changed since you last accepted it. Read the summary below, then accept again to continue.</p>'
      : '';

    gate.innerHTML =
      '<div class="consent-card">' +
      '<div class="consent-top">' +
      '<p class="consent-kicker">' + (reviewing ? 'Your agreement' : 'Before you start') + '</p>' +
      '<h2 id="consentTitle">How ZenouMath works, and what you are agreeing to</h2>' +
      '<p id="consentIntro">One short read. It takes about a minute, and it is the same document whether or not you read it.</p>' +
      '</div>' +
      '<div class="consent-scroll">' +
      reason +
      '<h3>What this site is</h3>' +
      '<p>ZenouMath is an independent study site. It collects links to things that are already public: browser practice sets embedded from their publishers, film and television <strong>metadata</strong> from TMDB, a directory of AI tools, and third-party players. It is not a school, it is not accredited, and it has no affiliation with any school, university or education department.</p>' +
      '<h3>What it does not do</h3>' +
      '<ul>' +
      '<li>It does not host video or audio files. Playback happens inside the third party’s own player, requested by your browser directly from them.</li>' +
      '<li>It does not sell, license or claim ownership of any content it links to.</li>' +
      '<li>It has no accounts, no sign-in and no server-side profile of you.</li>' +
      '<li>It does not run advertising trackers or third-party analytics.</li>' +
      '</ul>' +
      '<h3>Your responsibilities</h3>' +
      '<ul>' +
      '<li>Use it lawfully where you are, including copyright law.</li>' +
      '<li>Do not use it to harass, defraud or harm anyone, or to attempt to break into systems you are not authorised to access.</li>' +
      '<li>Remember that it is a study aid, not a substitute for your own school’s material, and not a citation source for assessed work.</li>' +
      '</ul>' +
      '<h3>What is stored</h3>' +
      '<p>Your appearance settings, saved items and this acceptance are kept in your own browser’s <code>localStorage</code>. They are not uploaded. The only things that reach our server are ordinary request logs without cookies. See the <a href="/legal/privacy">Privacy Policy</a> for the full list.</p>' +
      '<h3>Limits and risk</h3>' +
      '<p>The site is provided as-is. Third-party sites and embeds can go down, change or disappear without notice, and metadata can be wrong. To the extent the law allows, we exclude liability for indirect loss arising from your use of it. Nothing here removes rights you have under the Australian Consumer Law that cannot lawfully be excluded.</p>' +
      '<h3>The documents</h3>' +
      '<p><a href="/legal/terms">Terms of Service</a> · <a href="/legal/privacy">Privacy Policy</a> · <a href="/legal/acceptable-use">Acceptable Use</a> · <a href="/legal/copyright">Copyright</a> · <a href="/legal/takedown">Takedown process</a> · <a href="/legal/disclaimer">Disclaimer</a> · <a href="/legal/contact">Contact</a></p>' +
      '</div>' +
      '<div class="consent-actions">' +
      '<label class="consent-check"><input type="checkbox" id="consentBox">' +
      '<span>I have read the summary above and I agree to the Terms of Service and Privacy Policy.</span></label>' +
      '<div class="consent-row">' +
      (reviewing
        ? '<button type="button" class="consent-btn" id="consentClose">Close</button>'
        : '<button type="button" class="consent-btn" id="consentDecline">Decline and leave</button>') +
      '<button type="button" class="consent-btn consent-btn-primary" id="consentAccept" aria-disabled="true" disabled>Accept and continue</button>' +
      '</div>' +
      '<p class="consent-meta">Agreement version <code>' + VERSION + '</code>. Your acceptance is stored in this browser with its date and nothing else. <a href="/legal/privacy">Details</a>.</p>' +
      '</div>' +
      '</div>';

    return gate;
  }

  function trapFocus(gate, event) {
    if (event.key !== 'Tab') return;
    var focusable = gate.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open(mode) {
    if (document.getElementById(GATE_ID)) return;

    var previous = document.activeElement;
    var gate = build(mode);
    document.body.appendChild(gate);
    document.documentElement.classList.add('consent-pending');
    document.body.style.overflow = 'hidden';

    var box = gate.querySelector('#consentBox');
    var accept = gate.querySelector('#consentAccept');
    var decline = gate.querySelector('#consentDecline');
    var close = gate.querySelector('#consentClose');

    function sync() {
      var ok = box.checked;
      accept.disabled = !ok;
      accept.setAttribute('aria-disabled', ok ? 'false' : 'true');
    }

    box.addEventListener('change', sync);
    gate.addEventListener('keydown', function (e) {
      trapFocus(gate, e);
      if (e.key === 'Escape' && mode === 'review') shut();
    });
    sync();

    function shut() {
      gate.remove();
      release();
      document.body.style.overflow = '';
      if (previous && previous.focus) previous.focus();
      document.dispatchEvent(new CustomEvent('zenoumath:consent-closed'));
    }

    accept.addEventListener('click', function () {
      if (!box.checked) return;
      write({ v: VERSION, at: new Date().toISOString() });
      shut();
      document.dispatchEvent(new CustomEvent('zenoumath:consent', { detail: { version: VERSION } }));
    });

    if (decline) {
      decline.addEventListener('click', function () {
        clear();
        document.body.style.overflow = '';
        release();
        var left = el('div', { class: 'consent-left' });
        left.innerHTML =
          '<div><h2>You declined</h2>' +
          '<p>No agreement, no site. Nothing was stored and nothing was sent. You can close this tab, or reload and accept if you change your mind.</p>' +
          '<button type="button" class="consent-btn" id="consentReload">Reload the page</button></div>';
        document.body.innerHTML = '';
        document.body.appendChild(left);
        left.querySelector('#consentReload').addEventListener('click', function () {
          location.reload();
        });
      });
    }

    if (close) close.addEventListener('click', shut);

    setTimeout(function () {
      (box || accept).focus({ preventScroll: true });
    }, 60);
  }

  function start() {
    release();
    if (EXEMPT) return;

    var rec = read();
    if (rec && rec.v === VERSION) return;

    open(rec ? 'update' : 'new');
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest ? e.target.closest('[data-consent-review]') : null;
    if (!trigger) return;
    e.preventDefault();
    open(accepted() ? 'review' : 'new');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  /* Lets a page or a test ask where the visitor stands without reading storage. */
  window.ZenouConsent = {
    version: VERSION,
    accepted: accepted,
    open: open,
    record: read,
  };
})();
