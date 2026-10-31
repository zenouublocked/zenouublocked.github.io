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
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.resolve('../shots/city-start.png') });
  console.log('title:', await page.title());
  console.log('start errors:', logs.slice(-6).join(' | ') || '(none)');

  await page.click('.ov-start');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.resolve('../shots/city-play.png') });

  const state1 = await page.evaluate(() => ({
    running: !!window.__zenou,
    health: window.__zenou.player.health,
    pos: [Math.round(window.__zenou.player.pos.x), Math.round(window.__zenou.player.pos.y)],
    cars: window.__zenou.vehicles.cars.length,
    collision: window.__zenou.world.buildings.length,
    inCar: !!window.__zenou.player.car,
  }));
  console.log('state1:', JSON.stringify(state1));

  // walk forward
  await page.keyboard.down('w');
  await page.waitForTimeout(1100);
  await page.keyboard.up('w');
  const state2 = await page.evaluate(() => [Math.round(window.__zenou.player.pos.x), Math.round(window.__zenou.player.pos.y)]);
  console.log('walked to:', state2);

  // teleport next to a car and steal it
  await page.evaluate(() => {
    const z = window.__zenou;
    const car = z.vehicles.cars.find((c) => c.alive && !c.police);
    if (car) { z.player.pos.set(car.pos.x + 1.4, car.pos.y + 1.4); }
  });
  await page.keyboard.press('f');
  await page.waitForTimeout(600);
  const state3 = await page.evaluate(() => ({ inCar: !!window.__zenou.player.car, type: window.__zenou.player.car && window.__zenou.player.car.type }));
  console.log('inCar:', JSON.stringify(state3));

  await page.keyboard.down('w');
  await page.waitForTimeout(1800);
  await page.keyboard.up('w');
  await page.screenshot({ path: path.resolve('../shots/city-drive.png') });
  const state4 = await page.evaluate(() => ({ speed: Math.round(window.__zenou.player.car ? window.__zenou.player.car.speed * 3.6 : 0) }));
  console.log('driving:', JSON.stringify(state4));

  // exit, fire a few rounds
  await page.keyboard.press('f');
  await page.waitForTimeout(400);
  await page.mouse.click(720, 450);
  await page.waitForTimeout(250);
  await page.mouse.click(720, 450);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.resolve('../shots/city-shoot.png') });
  const state5 = await page.evaluate(() => ({ ammo: document.querySelector('#ammo').textContent, health: Math.round(window.__zenou.player.health) }));
  console.log('after shooting:', JSON.stringify(state5));
  console.log('errors:', logs.slice(-10).join(' | ') || '(none)');

  await browser.close();
})();
