// Which chunks exist? Try fetching the GamePlayer chunk and look for the gdn URL pattern.
import fs from 'node:fs';
const html = fs.readFileSync('stickman.html', 'utf8');
const chunkIds = [...html.matchAll(/class="chunk-([0-9a-f]+)"| client~([0-9]{4})~|loadableChunks/g)];
console.log('chunk hint count', chunkIds.length);

const chunksEl = html.match(/__LOADABLE_REQUIRED_CHUNKS__[^>]*>(\[.*?\])</);
console.log('chunks', chunksEl?.[1]);

// named chunk map
const extEl = html.match(/__LOADABLE_REQUIRED_CHUNKS___ext[^>]*>(\{.*?\})</);
const ext = JSON.parse(extEl[1]);
console.log('named:', ...Object.entries(ext.namedChunks).filter(([k, v]) => /GamePlayer|p4d|Sdk/i.test(String(k))).slice(0, 4));
console.log(JSON.stringify(ext, null, 0).slice(0, 200));
