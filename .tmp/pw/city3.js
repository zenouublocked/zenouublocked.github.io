const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
  page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0,200)));
  await page.goto('http://127.0.0.1:8000/games/zenou-city/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.click('.ov-start');
  await page.waitForTimeout(1000);
  console.log(await page.evaluate(() => {
    const z = window.__zenou;
    z.startMission();
    return { active: z.mission.active, stage: z.mission.stage, time: z.mission.time, target: [z.mission.target.x, z.mission.target.y], player: [z.player.pos.x, z.player.pos.y] };
  }));
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(400);
    console.log(i, await page.evaluate(() => {
      const z = window.__zenou;
      return { active: z.mission.active, stage: z.mission.stage, cd: +z.mission.cooldown.toFixed(2), t: +z.mission.time.toFixed(1), money: z.player.money, obj: document.querySelector('#objective').textContent };
    }));
  }
  console.log('teleport');
  await page.evaluate(() => { const z = window.__zenou; z.player.pos.set(z.mission.target.x, z.mission.target.y); });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(300);
    console.log('post', i, await page.evaluate(() => {
      const z = window.__zenou;
      const d = Math.hypot(z.mission.target.x - z.player.pos.x, z.mission.target.y - z.player.pos.y);
      return { active: z.mission.active, stage: z.mission.stage, cd: +z.mission.cooldown.toFixed(2), t: +z.mission.time.toFixed(1), money: z.player.money, d: Math.round(d), obj: document.querySelector('#objective').textContent };
    }));
  }
  await browser.close();
})();
