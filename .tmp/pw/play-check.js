const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,160)));
  await page.goto('http://127.0.0.1:8000/play.html?id=lo-clustertruck', { waitUntil: 'networkidle' });
  await page.waitForTimeout(14000);
  await page.screenshot({ path: path.resolve('../shots/play-clustertruck.png') });
  console.log('heading:', await page.evaluate(() => document.querySelector('h1')?.textContent || document.body.innerText.slice(0,120)));
  console.log('iframes:', await page.locator('iframe').count());
  console.log('errors:', errs.slice(0,3).join(' ~ ') || 'none');
  await browser.close();
})();
