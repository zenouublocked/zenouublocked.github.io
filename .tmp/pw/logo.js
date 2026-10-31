const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 420 }, deviceScaleFactor: 1 });
  await page.setContent('<body style="margin:0;background:transparent"><img id="l" src="http://127.0.0.1:8000/assets/favicon.svg" style="width:320px;height:320px;display:block"></body>');
  await page.waitForTimeout(1200);
  await page.locator('#l').screenshot({ path: path.resolve('../../trailer/assets/shots/logo-mark.png'), omitBackground: true });
  await browser.close();
})();
