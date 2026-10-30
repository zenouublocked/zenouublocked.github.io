/* Wire the PlayGTA5 page + takedown notice into every site page.
 * - inserts "PlayGTA5" nav link before "My Library" (or before </nav>)
 * - appends the takedown/credit footer line
 * Idempotent: skips files that already contain "playgta5.html".
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '.';
const NAV_LINK = '<a href="playgta5.html" data-nav>PlayGTA5</a>\n    ';
const FOOTER_LINE = '\n  <p>Takedown requests and concerns about this website or its content: <a href="mailto:nuxxzul@gmail.com">nuxxzul@gmail.com</a>. Also see the <a href="playgta5.html">PlayGTA5 project</a>.</p>\n';

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

for (const f of files) {
  const p = path.join(ROOT, f);
  let t = fs.readFileSync(p, 'utf8');

  if (!t.includes('playgta5.html')) {
    // nav: prefer inserting before the My Library link
    if (t.includes('<a href="library.html"')) {
      t = t.replace('<a href="library.html"', NAV_LINK + '<a href="library.html"');
    } else if (t.includes('</nav>')) {
      t = t.replace('</nav>', NAV_LINK + '</nav>');
    }
    if (t.includes('</footer>')) {
      t = t.replace('</footer>', FOOTER_LINE + '</footer>');
    }
    fs.writeFileSync(p, t);
    console.log('wired', f);
  } else {
    console.log('skip (already wired)', f);
  }
}

// settings.js gear button anchor is independent of nav — nothing to do there.
console.log('done');
