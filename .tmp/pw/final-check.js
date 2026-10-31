const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,160)));
  await page.addInitScript(() => { try { localStorage.setItem('zenou_tour_done','true'); } catch(e){} });
  await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('count:', await page.locator('#lpCount').textContent());
  console.log('nav:', (await page.locator('.mainnav a').allTextContents()).join(' | '));
  console.log('has trailer link:', await page.locator('a.btn-trailer').count());
  await page.goto('http://127.0.0.1:8000/play.html?id=lo-skate-3', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('skate page heading:', await page.evaluate(() => document.querySelector('#gTitle')?.textContent || 'missing'));
  console.log('errors:', errs.slice(0,3).join(' ~ ') || 'none');
  await browser.close();
})();
