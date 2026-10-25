// Real Chrome checks against an already-running LOCAL server; no new dependencies.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const origin = new URL(process.argv[2] || 'http://localhost:3108');
if (!['localhost', '127.0.0.1'].includes(origin.hostname)) throw Error('Only local QA targets are allowed.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openui-product-pages-'));
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const child = cp.spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9338', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + path.join(directory, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;
(async () => {
  let target;
  for (let i = 0; i < 50; i++) { try { target = (await (await fetch('http://127.0.0.1:9338/json/list')).json()).find(item => item.type === 'page'); if (target) break; } catch {} await pause(100); }
  if (!target) throw Error('Chrome debugging target did not become available.');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map(); const exceptions = [];
  ws.addEventListener('message', event => { const message = JSON.parse(String(event.data)); if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const request = ++id; const timer = setTimeout(() => { pending.delete(request); reject(Error('Timed out: ' + method)); }, 35000); pending.set(request, message => { clearTimeout(timer); message.error ? reject(Error(message.error.message)) : resolve(message.result); }); ws.send(JSON.stringify({ id: request, method, params })); });
  const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error('Browser evaluation failed'); return result.result.value; };
  await call('Page.enable'); await call('Runtime.enable');
  const results = [];
  for (const slug of ['features', 'pricing', 'changelog', 'roadmap']) {
    for (const width of [1440, 768, 390]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 });
      for (const theme of ['light', 'dark']) {
        await call('Page.navigate', { url: origin.origin + '/' + slug });
        let ready = false;
        for (let i = 0; i < 100; i++) { ready = await evaluate(`document.readyState === 'complete' && location.pathname === '/${slug}' && !!document.querySelector('h1')`); if (ready) break; await pause(100); }
        if (!ready) throw Error('Page did not finish loading: ' + slug);
        await evaluate(`localStorage.setItem('theme','${theme}'); document.documentElement.classList.remove('light','dark'); document.documentElement.classList.add('${theme}');`);
        await evaluate(`(async()=>{await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,5000))]); const images=[...document.images].filter(image=>image.getClientRects().length); for(const image of images){image.loading='eager';} for(let attempt=0;attempt<150;attempt++){if(images.every(image=>image.complete&&image.naturalWidth>0))break;await new Promise(resolve=>setTimeout(resolve,100));} await Promise.all(images.filter(image=>image.complete&&image.naturalWidth>0).map(image=>image.decode().catch(()=>{}))); return true;})()`);
        await pause(150);
        const result = await evaluate(`({title:document.querySelector('h1').textContent,h1:document.querySelectorAll('h1').length,overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(image=>image.getClientRects().length&&(!image.complete||image.naturalWidth===0)).map(image=>image.getAttribute('src')),fontStatus:document.fonts.status,activeTab:document.querySelector('nav[aria-label="Product pages"] [aria-current="page"]')?.getAttribute('href'),footerLinks:[...document.querySelectorAll('footer nav[aria-label="Product footer"] a')].map(a=>a.getAttribute('href'))})`);
        results.push({ slug, width, theme, ...result });
        if (slug === 'pricing') {
          const faqWorks = await evaluate(`(()=>{const details=document.querySelector('details');if(!details)return false;details.querySelector('summary').click();const opened=details.open;details.querySelector('summary').click();return opened&&!details.open;})()`);
          if (!faqWorks) throw Error('Pricing FAQ did not open and close.');
        }
        if (width === 390 || width === 1440) { const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(directory, `${slug}-${width}-${theme}.png`), Buffer.from(shot.data, 'base64')); }
        if (width === 1440 && theme === 'light') {
          const metrics = await call('Page.getLayoutMetrics');
          const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1440, height: Math.ceil(metrics.cssContentSize.height), scale: 1 } });
          fs.writeFileSync(path.join(directory, `${slug}-full.png`), Buffer.from(shot.data, 'base64'));
        }
      }
    }
  }
  const passed = results.every(item => item.h1 === 1 && !item.overflow && !item.brokenImages.length && item.fontStatus === 'loaded' && item.activeTab === '/' + item.slug && item.footerLinks.length === 4) && !exceptions.length;
  fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify({ passed, exceptions, results }, null, 2));
  console.log(JSON.stringify({ directory, passed, checks: results.length, exceptions, failures: results.filter(item => item.h1 !== 1 || item.overflow || item.brokenImages.length || item.fontStatus !== 'loaded') }, null, 2));
  if (!passed) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => { ws?.close(); child.kill(); });
