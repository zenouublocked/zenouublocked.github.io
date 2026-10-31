const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport:{width:1280,height:800} });
  page.on('pageerror', e => console.log('pageerror', String(e).slice(0,200)));
  await page.goto('http://127.0.0.1:8765/.tmp/granny-v2.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(30000);
  await page.screenshot({path:path.resolve('../shots/test-granny-v2.png')});
  console.log('title', await page.title());
  await browser.close();
})();
