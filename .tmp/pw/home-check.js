const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0,200)));
  p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,200)); });
  await p.goto('http://127.0.0.1:8790/index.html', { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(1200);
  const info = await p.evaluate(() => ({
    total: document.getElementById('statTotal')?.textContent,
    logo: document.querySelector('.brand-mark img')?.currentSrc || null,
    logoLoaded: (() => { const i = document.querySelector('.brand-mark img'); return !!(i && i.complete && i.naturalWidth); })(),
    cards: document.querySelectorAll('[data-id], .card, .game-card').length,
    names: [...document.querySelectorAll('h3, .card-title, .game-title')].slice(0,6).map(e => e.textContent.trim()),
    hasAmong: document.body.innerText.includes('Among Us'),
    hasSilk: document.body.innerText.includes('Silksong'),
    hasCity: document.body.innerText.includes('Zenou City'),
  }));
  console.log(JSON.stringify(info, null, 1));
  console.log('errors:', errs.slice(0,4).join(' | ') || 'none');
  await p.screenshot({ path: '.tmp/review/home-top.png', clip: { x: 0, y: 0, width: 1440, height: 460 } });
  await p.evaluate(() => window.scrollTo(0, 900));
  await p.waitForTimeout(600);
  await p.screenshot({ path: '.tmp/review/home-mid.png' });
  await b.close();
})();
