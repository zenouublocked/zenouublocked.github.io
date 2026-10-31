const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--hide-scrollbars','--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
  await page.addInitScript(() => { try { localStorage.setItem('zenou_tour_done','true'); } catch(e){} });
  await page.goto('http://127.0.0.1:8000/trailer.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.resolve('../shots/trailer-page.png') });
  const dur = await page.evaluate(async () => {
    const v = document.getElementById('trailer');
    if (v.readyState < 1) await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
    return { duration: v.duration, w: v.videoWidth, h: v.videoHeight, error: v.error && v.error.code };
  });
  console.log('video:', JSON.stringify(dur));
  await page.click('#bigPlay');
  await page.waitForTimeout(3000);
  console.log('playing:', await page.evaluate(() => ({ t: document.getElementById('trailer').currentTime, paused: document.getElementById('trailer').paused })));
  await page.screenshot({ path: path.resolve('../shots/trailer-playing.png') });
  console.log('errors:', errs.slice(0,3).join(' ~ ') || 'none');
  await browser.close();
})();
