const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const bad = [];
  p.on('response', r => { if (r.status() >= 400 && r.url().includes('127.0.0.1')) bad.push(r.status() + ' ' + r.url()); });
  await p.goto('http://127.0.0.1:8790/trailer.html', { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(800);
  const info = await p.evaluate(async () => {
    const v = document.getElementById('trailer');
    v.preload = 'auto'; v.load();
    await new Promise(r => setTimeout(r, 2500));
    return { src: v.currentSrc, duration: v.duration, w: v.videoWidth, h: v.videoHeight, ready: v.readyState };
  });
  console.log(JSON.stringify(info));
  console.log('bad:', bad.join(' | ') || 'none');
  await p.screenshot({ path: '.tmp/review/trailer-page.png', fullPage: false });
  await b.close();
})();
