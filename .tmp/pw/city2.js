const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 400)));

  await page.goto('http://127.0.0.1:8000/games/zenou-city/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.resolve('../shots/city-start2.png') });
  await page.click('.ov-start');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.resolve('../shots/city-street.png') });

  // night
  await page.evaluate(() => window.__zenou.setTime(23));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.resolve('../shots/city-night.png') });

  // wanted level + police
  await page.evaluate(() => { window.__zenou.addWanted(3); window.__zenou.setTime(13); });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.resolve('../shots/city-police.png') });
  const pol = await page.evaluate(() => ({
    wanted: window.__zenou.player.wanted,
    cops: window.__zenou.cops.length,
    policeCars: window.__zenou.vehicles.police.length,
    wantedStars: document.querySelectorAll('#stars .star.on').length,
  }));
  console.log('police:', JSON.stringify(pol));

  // mission flow
  const mis = await page.evaluate(() => {
    const z = window.__zenou;
    z.startMission();
    return { active: z.mission.active, reward: z.mission.reward, target: [Math.round(z.mission.target.x), Math.round(z.mission.target.y)] };
  });
  console.log('mission:', JSON.stringify(mis));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.resolve('../shots/city-mission.png') });

  // finish the mission by teleporting to the target
  const done = await page.evaluate(async () => {
    const z = window.__zenou;
    z.player.pos.set(z.mission.target.x, z.mission.target.y);
    await new Promise((r) => setTimeout(r, 600));
    return { money: z.player.money, active: z.mission.active, objective: document.querySelector('#objective').textContent };
  });
  console.log('mission done:', JSON.stringify(done));

  // fps sample
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const t0 = performance.now();
    const tick = () => {
      frames++;
      if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
      else resolve(Math.round((frames * 1000) / (performance.now() - t0)));
    };
    requestAnimationFrame(tick);
  }));
  console.log('fps (software renderer):', fps);
  console.log('errors:', logs.slice(-10).join(' | ') || '(none)');
  await browser.close();
})();
