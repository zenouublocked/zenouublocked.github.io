const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  const pages = [
    ['how-to-fish', 'http://127.0.0.1:8765/games/how-to-fish/index.html', 25000],
    ['granny', 'http://127.0.0.1:8765/games/granny/index.html', 30000],
  ];
  for (const [name, url, wait] of pages) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const logs = [];
    page.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.type()+': '+m.text().slice(0,240)); });
    page.on('pageerror', e => logs.push('pageerror: '+String(e).slice(0,240)));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.resolve('../shots/test-' + name + '.png') });
      console.log('##', name, await page.title(), 'canvas=' + await page.locator('canvas').count());
    } catch (e) { console.log('##', name, 'FAILED', String(e).slice(0,200)); }
    console.log(logs.slice(-8).join('\n') || '(no errors)');
    await page.close();
  }
  await browser.close();
})();
