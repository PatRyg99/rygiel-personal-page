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
  const navigate = async (route, settledRoute = route) => {
    await call('Page.navigate', { url: base + route });
    for (let attempt = 0; attempt < 100; attempt++) {
      await evaluate(`[...document.images].forEach(image => image.loading = 'eager')`);
      const ready = await evaluate(`location.href === ${JSON.stringify(base + settledRoute)} && document.readyState === 'complete' && [...document.images].every(i => !i.hasAttribute('src') || i.complete)`);
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
    for (const route of ['/', '/publications/', '/publications/abgatr/', '/publications/active-learning/', '/talks/', '/photography/']) {
      await navigate(route);
      const info = await evaluate(`({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,h1:document.querySelectorAll('h1').length,brokenImages:[...document.images].filter(i=>i.hasAttribute('src')&&!i.naturalWidth).map(i=>i.src),text:document.querySelector('main').innerText.length})`);
      assert.equal(info.overflow, false, `Horizontal overflow at ${width}: ${route}`);
      assert.equal(info.h1, 1, `One heading required: ${route}`);
      assert.deepEqual(info.brokenImages, [], `Broken image: ${route}`);
      assert.ok(info.text > 100, `Empty content: ${route}`);
      if (route === '/' || route === '/publications/abgatr/') await screenshot(`${width}-${route === '/' ? 'home' : 'abgatr'}`);
      if (route === '/publications/') await screenshot(`${width}-publications-map`);
      if (route === '/photography/') {
        assert.ok(await evaluate(`[...document.querySelectorAll('.photo-grid')].every(grid => { const boxes = [...grid.children].map(photo => photo.getBoundingClientRect()); return boxes.every((box, index) => !index || (Math.abs(box.top - boxes[index - 1].top) < 1 ? box.left > boxes[index - 1].left : box.top > boxes[index - 1].top)); })`), 'Gallery reads left to right across each row');
        await screenshot(`${width}-photography`);
        if (width === 1440) {
          await evaluate(`document.querySelector('#photos-2026-uk').scrollIntoView({behavior:'instant',block:'start'})`);
          await screenshot('1440-photography-uk');
        }
      }
    }
  }
  await navigate('/publications/');
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]').length`), 21);
  assert.equal(await evaluate(`document.querySelectorAll('.world-map [data-country-select]').length`), 16, 'Every verified country is marked');
  assert.equal(await evaluate(`document.querySelector('.world-map [data-country-select="NL"]').dataset.countryCount`), '15');
  await evaluate(`document.querySelector('[data-map-view="407 25 172 108"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.world-map').getAttribute('viewBox')`), '407 25 172 108', 'Europe view enlarges the dense collaboration region');
  await evaluate(`document.querySelector('.world-map').scrollIntoView({behavior:'instant',block:'center'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const germanyVisible = await evaluate(`(() => { const r=document.querySelector('.world-map [data-country-select="DE"]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await call('Input.dispatchMouseEvent', { type:'mouseMoved', ...germanyVisible });
  await evaluate(`new Promise(r=>requestAnimationFrame(r))`);
  await screenshot('390-publications-map-hover');
  assert.equal(await evaluate(`document.querySelector('.map-tooltip').hidden`), false, 'Hovering a country opens institution counts');
  assert.equal(await evaluate(`document.querySelector('[data-tooltip-country]').textContent`), 'Germany');
  assert.equal(await evaluate(`document.querySelector('[data-tooltip-count]').textContent`), '5 papers');
  assert.equal(await evaluate(`[...document.querySelectorAll('[data-tooltip-institutions] li')].find(li=>li.querySelector('span').textContent==='Technical University of Munich').querySelector('strong').textContent`), '3', 'Institutions count distinct papers, not author occurrences');
  const tooltipPoint = await evaluate(`(() => { const r=document.querySelector('.map-tooltip').getBoundingClientRect(); return {x:r.x+20,y:r.y+20}; })()`);
  await call('Input.dispatchMouseEvent', {type:'mouseMoved', ...tooltipPoint});
  await new Promise(resolve => setTimeout(resolve, 220));
  assert.equal(await evaluate(`document.querySelector('.map-tooltip').hidden`), false, 'Institution popup remains readable when hovered');
  await screenshot('390-publications-institutions');
  await call('Input.dispatchKeyEvent', {type:'keyDown', key:'Escape', code:'Escape'});
  assert.equal(await evaluate(`document.querySelector('.map-tooltip').hidden`), true);
  await evaluate(`document.querySelector('.world-map [data-country-select="PL"]').focus()`);
  assert.equal(await evaluate(`document.querySelector('[data-tooltip-country]').textContent`), 'Poland', 'Keyboard focus reveals institutions');
  await call('Input.dispatchKeyEvent', {type:'keyDown', key:'Enter', code:'Enter'});
  await call('Input.dispatchKeyEvent', {type:'keyUp', key:'Enter', code:'Enter'});
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]:not([hidden])').length`), 5, 'Country selection filters publication list');
  assert.ok(await evaluate(`location.search.includes('country=PL')`));
  await evaluate(`document.querySelector('.world-map [data-country-select="NL"]').focus()`);
  assert.equal(await evaluate(`[...document.querySelectorAll('[data-tooltip-institutions] li')].find(li=>li.querySelector('span').textContent==='University of Twente').querySelector('strong').textContent`), '15', 'Country and institution totals remain independent of archive filters');
  await evaluate(`document.querySelector('[data-clear-country]').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]:not([hidden])').length`), 21);
  await navigate('/publications/?country=DE&type=preprint', '/publications/?type=preprint&country=DE');
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]:not([hidden])').length`), 2, 'Country URL and existing filters combine');
  await evaluate(`document.querySelector('[data-publication-filters]').reset();new Promise(r=>setTimeout(r,30))`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]:not([hidden])').length`), 21, 'Reset clears country and output-type filters');
  await navigate('/publications/?country=ZZ', '/publications/');
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]:not([hidden])').length`), 21, 'Unknown country does not hide the archive');
  assert.equal(await evaluate(`location.search`), '');
  await evaluate(`document.querySelector('[data-map-view="407 25 172 108"]').click();document.querySelector('.world-map').scrollIntoView({behavior:'instant',block:'center'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const netherlandsPoint = await evaluate(`(() => { const r=document.querySelector('.world-map [data-country-select="NL"]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await call('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[netherlandsPoint]});
  await call('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  assert.equal(await evaluate(`document.querySelector('.map-tooltip').hidden`), false, 'Touch opens the institution popup');
  assert.equal(await evaluate(`document.querySelector('[data-tooltip-country]').textContent`), 'Netherlands');
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]:not([hidden])').length`), 15);
  await navigate('/publications/');
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
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.contact-emails a')].map(link=>link.getAttribute('href'))`), ['mailto:p.t.rygiel@utwente.nl', 'mailto:patryk.rygiel@mlinpl.org', 'mailto:patrygiel99@gmail.com']);
  assert.equal(await evaluate(`document.querySelectorAll('.monogram,nav a[href$="/cv/"]').length`), 0);
  assert.ok(await evaluate(`document.querySelector('.feature-image img').src.endsWith('abgatr-equivariance.png')`));
  assert.equal(await evaluate(`document.querySelector('.feature a[href$="#aneumo-demo"]')?.href`), base + '/publications/abgatr/#aneumo-demo', 'Featured project links directly to the 3D viewer');
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
  await navigate('/publications/');
  await evaluate(`document.querySelector('[data-publication-map]').scrollIntoView({behavior:'instant',block:'start'})`);
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark');
  await screenshot('390-publications-map-dark');
  await navigate('/photography/');
  assert.equal(await evaluate(`document.querySelectorAll('[data-photo]').length`), 19, 'All selected photographs appear in the gallery');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.photo-year-heading h2')].map(node=>node.textContent)`), ['2026']);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.photo-region h3')].map(node=>node.textContent)`), ['Côte d’Azur', 'Dolomites', 'Switzerland', 'UK'], 'Photos are grouped under the requested regions');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.photo-region')].map(region=>region.querySelectorAll('[data-photo]').length)`), [3, 7, 3, 6]);
  assert.ok(await evaluate(`[...document.querySelectorAll('.photo-caption time')].every(node=>node.textContent==='2026')`));
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-photo] img')].every(image => Math.abs(image.width / image.height - image.naturalWidth / image.naturalHeight) < 0.02)`), 'Photos retain their aspect ratios');
  await screenshot('390-photography-dark');
  await evaluate(`document.querySelector('[data-photo]').focus();document.querySelector('[data-photo]').click()`);
  assert.equal(await evaluate(`document.querySelector('.photo-viewer').open`), true, 'Photo viewer opens');
  assert.equal(await evaluate(`document.activeElement.hasAttribute('data-photo-close')`), true, 'Viewer receives keyboard focus');
  await evaluate(`document.querySelector('[data-photo-next]').click()`);
  assert.equal(await evaluate(`document.querySelector('.photo-viewer-count').textContent`), '2 / 19');
  assert.equal(await evaluate(`document.querySelector('[data-photo-caption]').textContent`), await evaluate(`document.querySelectorAll('[data-photo]')[1].dataset.caption`), 'Visible captions contain location and year only');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft' });
  assert.equal(await evaluate(`document.querySelector('.photo-viewer-count').textContent`), '1 / 19', 'Arrow keys navigate photographs');
  await evaluate(`document.querySelector('[data-photo-prev]').click()`);
  assert.equal(await evaluate(`document.querySelector('.photo-viewer-count').textContent`), '19 / 19', 'Previous wraps to the last photograph');
  await evaluate(`new Promise(resolve => { const image = document.querySelector('[data-photo-image]'); if (image.complete) resolve(); else image.onload = resolve; })`);
  assert.ok(await evaluate(`document.querySelector('[data-photo-image]').naturalWidth > 0`));
  await screenshot('390-photography-viewer');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  assert.equal(await evaluate(`document.querySelector('.photo-viewer').open`), false, 'Escape closes the viewer');
  assert.equal(await evaluate(`document.activeElement === document.querySelector('[data-photo]')`), true, 'Focus returns to the photograph');
  assert.equal(await evaluate(`document.body.classList.contains('photo-viewer-open')`), false, 'Scrolling is restored');
  await call('Emulation.setScriptExecutionDisabled', { value: true });
  await navigate('/photography/');
  const photoFallback = await evaluate(`document.querySelector('[data-photo]').href`);
  assert.ok((await fetch(photoFallback)).ok, 'Full photograph remains accessible without JavaScript');
  assert.equal(await evaluate(`document.querySelectorAll('[data-photo]').length`), 19);
  await navigate('/publications/');
  assert.equal(await evaluate(`document.querySelectorAll('[data-publication]:not([hidden])').length`), 21);
  assert.equal(await evaluate(`document.querySelector('[data-publication-filters]').hidden`), true);
  assert.equal(await evaluate(`document.querySelectorAll('.world-map [data-country-select]').length`), 16, 'Country map remains visible without JavaScript');
  assert.equal(await evaluate(`document.querySelector('.world-map [data-country-select="NL"] title').textContent`), 'Netherlands · 15 papers', 'Country counts are server-rendered');
  assert.equal(await evaluate(`document.querySelectorAll('[data-affiliation-source]').length`), 18, 'Affiliation sources are available without JavaScript');
  await call('Emulation.setScriptExecutionDisabled', { value: false });
  assert.deepEqual(errors, [], 'Browser errors');
  console.log('Browser checks passed: 6 pages at 3 widths, country map and institution hover counts, keyboard selection and country filters, all 19 photographs, photo viewer, figures on all 21 publications, CV download, activities, filters, clipboard, dark theme, and no-JavaScript content.');
  console.log(`Screenshots: ${tmpdir()}/rygiel-*.png`);
} finally {
  try { await send('Browser.close'); } catch (_) { chrome.kill(); }
  await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else { chrome.once('exit', resolve); setTimeout(resolve, 2000); } });
  await rm(profile, { recursive: true, force: true });
}
