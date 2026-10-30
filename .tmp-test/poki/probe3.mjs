// Poke around for how the game URL is constructed (apiv2 payload, lib configs).
import fs from 'node:fs';
const html = fs.readFileSync('stickman.html', 'utf8');

// Search for "gameplay" & "slug" & "releases" style JSON
for (const key of ['"slug"', 'gameplay', 'releases', 'build', 'apiv2', 'lib']) {
  const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  let m, n = 0;
  while ((m = re.exec(html)) && n < 2) {
    console.log('--- ' + key + ' @' + m.index);
    console.log(html.slice(Math.max(0, m.index - 200), m.index + 400).replace(/\s+/g, ' ').slice(0, 520));
    n++;
  }
}
