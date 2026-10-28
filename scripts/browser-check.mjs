// Local browser smoke check. Requires Chrome and a running Jekyll server.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.SITE_PREVIEW_URL || 'http://127.0.0.1:4000/rygiel-personal-page';
const browserPath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = await mkdtemp(join(tmpdir(), 'rygiel-browser-'));
const chrome = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
const pending = new Map();
const errors = [];
let nextId = 0, buffer = '';
chrome.stdio[4].on('data', chunk => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf('\0')) !== -1) {
    const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id); clearTimeout(timer); pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) errors.push(`${message.params.response.status}: ${message.params.response.url}`);
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 15000);
  pending.set(id, { resolve, reject, timer });
  chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
});
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const navigate = async route => {
    await call('Page.navigate', { url: base + route });
    for (let attempt = 0; attempt < 100; attempt++) {
      await evaluate(`[...document.images].forEach(image => image.loading = 'eager')`);
      const ready = await evaluate(`location.href === ${JSON.stringify(base + route)} && document.readyState === 'complete' && [...document.images].every(i => i.complete)`);
      if (ready) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Page did not finish loading: ${route}`);
  };
  const screenshot = async name => {
    const result = await call('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(tmpdir(), `rygiel-${name}.png`), Buffer.from(result.data, 'base64'));
  };
  for (const width of [1440, 768, 390]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 1, mobile: width === 390 });
    for (const route of ['/', '/publications/', '/publications/abgatr/', '/publications/active-learning/', '/talks/']) {
      await navigate(route);
      const info = await evaluate(`({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,h1:document.querySelectorAll('h1').length,brokenImages:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),text:document.querySelector('main').innerText.length})`);
      assert.equal(info.overflow, false, `Horizontal overflow at ${width}: ${route}`);
      assert.equal(info.h1, 1, `One heading required: ${route}`);
      assert.deepEqual(info.brokenImages, [], `Broken image: ${route}`);
      assert.ok(info.text > 100, `Empty content: ${route}`);
      if (route === '/' || route === '/publications/abgatr/') await screenshot(`${width}-${route === '/' ? 'home' : 'abgatr'}`);
    }
  }
  await navigate('/publications/');
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]').length`), 21);
  const publicationRoutes = await evaluate(`[...document.querySelectorAll('[data-publication] h3 a')].map(a=>new URL(a.href).pathname)`);
  for (const path of publicationRoutes) {
    await navigate(path.slice(new URL(base).pathname.replace(/\/$/, '').length));
    assert.ok(await evaluate(`document.querySelectorAll('.research-figure img').length > 0`), `Publication figure required: ${path}`);
    assert.ok(await evaluate(`[...document.images].every(image=>image.naturalWidth > 0)`), `Publication images must load: ${path}`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth > innerWidth + 1`), false, `Publication layout overflow: ${path}`);
  }
  await navigate('/publications/');
  const search = async (value) => evaluate(`document.querySelector('[name="q"]').value=${JSON.stringify(value)};document.querySelector('[name="q"]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelectorAll('[data-publication]:not([hidden])').length`);
  assert.equal(await search('Symmetry in the Wild'), 1, 'Previous title must remain searchable');
  assert.equal(await search('no-such-paper-xyz'), 0);
  assert.equal(await evaluate(`document.querySelector('[data-empty-results]').hidden`), false);
  await search('');
  await evaluate(`document.querySelector('[name="type"]').value='preprint';document.querySelector('[name="type"]').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]:not([hidden])').length`), 2);
  await navigate('/publications/?topic=geometry');
  assert.ok(await evaluate(`document.querySelectorAll('[data-publication]:not([hidden])').length > 0`));
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-publication]:not([hidden])')].every(e=>e.dataset.topics.includes('geometry'))`));
  await navigate('/');
  assert.equal(await evaluate(`document.querySelector('.profile-name').textContent`), 'Patryk Rygiel');
  assert.equal(await evaluate(`document.querySelectorAll('.monogram,nav a[href$="/cv/"]').length`), 0);
  assert.ok(await evaluate(`document.querySelector('.feature-image img').src.endsWith('abgatr-equivariance.png')`));
  assert.ok(await evaluate(`document.querySelector('.cv-download').hasAttribute('download')`));
  const cvResponse = await fetch(base + '/files/patryk-rygiel-cv.pdf');
  assert.ok(cvResponse.ok, 'Original CV download responds successfully');
  assert.deepEqual(Buffer.from(await cvResponse.arrayBuffer()), await readFile('files/patryk-rygiel-cv.pdf'), 'Downloaded CV must match the stored PDF exactly');
  await navigate('/talks/');
  assert.equal(await evaluate(`document.querySelectorAll('#community .activity-appearances li').length`), 3, 'Grouped ML in PL community roles retain all years');
  assert.equal(await evaluate(`[...document.querySelectorAll('#talks .activity-meta')].filter(item=>item.textContent.includes('ML in PL')).length`), 4, 'ML in PL contributions are listed separately by year');
  await screenshot('390-talks');
  await navigate('/');
  await evaluate(`document.documentElement.dataset.theme='light';document.querySelector('.theme-toggle').click()`);
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark');
  await screenshot('390-home-dark');
  await navigate('/publications/abgatr/');
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark', 'Theme persists across pages');
  await send('Browser.grantPermissions', { origin: new URL(base).origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await evaluate(`document.querySelector('[data-copy-citation]').click();new Promise(r=>setTimeout(r,200))`);
  assert.equal(await evaluate(`document.querySelector('[data-copy-citation]').textContent`), 'Copied');
  await call('Emulation.setScriptExecutionDisabled', { value: true });
  await navigate('/publications/');
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]:not([hidden])').length`), 21);
  assert.equal(await evaluate(`document.querySelector('[data-publication-filters]').hidden`), true);
  await call('Emulation.setScriptExecutionDisabled', { value: false });
  assert.deepEqual(errors, [], 'Browser errors');
  console.log('Browser checks passed: 5 pages at 3 widths, figures on all 21 publications, original CV download, grouped activities, filters, title aliases, clipboard, dark theme, no-JavaScript archive.');
  console.log(`Screenshots: ${tmpdir()}/rygiel-*.png`);
} finally {
  try { await send('Browser.close'); } catch (_) { chrome.kill(); }
  await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else { chrome.once('exit', resolve); setTimeout(resolve, 2000); } });
  await rm(profile, { recursive: true, force: true });
}
