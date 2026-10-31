// Find the CURRENT game's own config in the page (name, thumb, p4d id).
import fs from 'node:fs';
const html = fs.readFileSync('stickman.html', 'utf8');

// The page usually embeds the current game near a key like "currentGame" or its slug.
for (const key of ['"stickman-hook"', 'currentGame', 'PokiSDK', 'gameid', 'gameId']) {
  const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  let m, n = 0;
  while ((m = re.exec(html)) && n < 2) {
    console.log('--- ' + key + ' @' + m.index);
    console.log(html.slice(Math.max(0, m.index - 300), m.index + 500).replace(/\\u003C/g, '<').replace(/\s+/g, ' ').slice(0, 700));
    n++;
  }
}
