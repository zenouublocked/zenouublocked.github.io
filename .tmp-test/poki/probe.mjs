// Probe a Poki game page for its CDN game URL.
import fs from 'node:fs';

const html = fs.readFileSync('stickman.html', 'utf8');

for (const key of ['gameweb', 'html5Game', 'gameUrl', 'cdn.poki', 'poki.io', 'iframe']) {
  const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let m, n = 0;
  while ((m = re.exec(html)) && n < 3) {
    console.log('--- ' + key + ' @' + m.index);
    console.log(html.slice(Math.max(0, m.index - 160), m.index + 220).replace(/\s+/g, ' ').slice(0, 380));
    n++;
  }
}
