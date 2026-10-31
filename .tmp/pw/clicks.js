const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport:{width:1280,height:800} });
  await page.goto('http://127.0.0.1:8765/games/how-to-fish/index.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(20000);
  await page.mouse.click(290, 485); // Host Game button from the 1280x800 menu
  await page.waitForTimeout(12000);
  await page.screenshot({path:path.resolve('../shots/test-how-to-fish-play.png')});
  console.log('how-to-fish after click title', await page.title());
  await page.close();

  const p2 = await browser.newPage({ viewport:{width:1280,height:800} });
  await p2.goto('http://127.0.0.1:8765/.tmp/granny-v2.html',{waitUntil:'domcontentloaded',timeout:30000});
  await p2.waitForTimeout(30000);
  await p2.mouse.click(240, 380); // ИГРАТЬ
  await p2.waitForTimeout(12000);
  await p2.screenshot({path:path.resolve('../shots/test-granny-play.png')});
  console.log('granny after click title', await p2.title());
  await browser.close();
})();
