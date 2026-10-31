const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'] });
  for (const [name,url,wait] of [
    ['granny-original','http://127.0.0.1:8765/.tmp/granny-original.html',30000],
    ['gd-official','https://geometrydash.com/game/',8000],
  ]) {
    const page = await browser.newPage({ viewport:{width:1280,height:800} });
    const logs=[]; page.on('console',m=>{if(['error','warning'].includes(m.type())) logs.push(m.type()+': '+m.text().slice(0,180));});
    page.on('pageerror',e=>logs.push('pageerror: '+String(e).slice(0,180)));
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
    await page.waitForTimeout(wait);
    await page.screenshot({path: path.resolve('../shots/test-'+name+'.png')});
    console.log('##',name,await page.title());
    console.log(logs.slice(-5).join('\n')||'(none)');
    await page.close();
  }
  await browser.close();
})();
