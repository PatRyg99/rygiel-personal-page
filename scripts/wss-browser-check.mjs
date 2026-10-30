// Local WebGL interaction check. Run against a Jekyll preview; requires Chrome.
import { spawn } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.SITE_PREVIEW_URL || 'http://127.0.0.1:4000/rygiel-personal-page';
const profile = await mkdtemp(join(tmpdir(), 'rygiel-wss-browser-'));
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
const pending = new Map(), errors = [], requests = [];
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
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 30000);
  pending.set(id, { resolve, reject, timer });
  chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
});
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1250, deviceScaleFactor: 1, mobile: false });
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }] });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression, label, timeout = 30000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error(`${label}: ${await evaluate(`document.querySelector('[data-wss-status]')?.textContent`)}; ${errors.join('; ')}`);
  };
  const frame = () => evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  const ready = async () => { await waitFor(`document.querySelector('[data-wss-demo]')?.dataset.state==='ready'`, 'WSS viewer not ready'); await frame(); };
  const select = (key, value) => evaluate(`document.querySelector('[data-wss-${key}]').value=${JSON.stringify(value)};document.querySelector('[data-wss-${key}]').dispatchEvent(new Event('change',{bubbles:true}))`);
  const timestep = async value => { await evaluate(`document.querySelector('[data-wss-time]').value=${value};document.querySelector('[data-wss-time]').dispatchEvent(new Event('input',{bubbles:true}))`); await frame(); };
  const capture = async name => {
    await evaluate(`document.querySelector('[data-wss-demo]').scrollIntoView({block:'start',behavior:'instant'})`); await frame();
    const clip = await evaluate(`(()=>{const r=document.querySelector('[data-wss-demo]').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()`);
    const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    await writeFile(join(tmpdir(), `rygiel-wss-${name}.png`), Buffer.from(result.data, 'base64'));
  };
  const pixels = () => evaluate(`Array.from(document.querySelectorAll('[data-wss-view] canvas'),canvas=>{
    const gl=canvas.getContext('webgl2'),data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let hash=2166136261,colored=0,ink=0;const bg=[data[0],data[1],data[2]];
    for(let i=0;i<data.length;i+=4){hash=Math.imul(hash^data[i],16777619);hash=Math.imul(hash^data[i+1],16777619);hash=Math.imul(hash^data[i+2],16777619);if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>40)colored++;if(bg.some((v,j)=>Math.abs(v-data[i+j])>10))ink++;}
    return {hash:hash>>>0,colored,ink,step:canvas.dataset.timestep,geometry:canvas.dataset.geometry,glyphs:Number(canvas.dataset.glyphCount||0)};
  })`);
  const legends = () => evaluate(`Array.from(document.querySelectorAll('[data-wss-ticks]'),n=>n.textContent)`);
  const metrics = () => evaluate(`Array.from(document.querySelectorAll('[data-wss-group]'),group=>({id:group.dataset.wssGroup,values:['step','total'].map(key=>({text:group.querySelector('[data-wss-'+key+'-error]').textContent,value:Number(group.querySelector('[data-wss-'+key+'-error]').dataset.value)}))}))`);
  const manifest = await (await fetch(`${base}/assets/data/wss-demo/manifest.json`)).json();
  const verifyChallenge = async id => {
    const challenge = manifest.challenges.find(item => item.id === id);
    assert.ok(await evaluate(`(()=>{const root=document.querySelector('[data-wss-demo]').getBoundingClientRect();return Array.from(document.querySelectorAll('.wss-header label,.wss-header select,.wss-header button')).filter(node=>!node.hidden).every(node=>{const r=node.getBoundingClientRect();return r.top>=root.top && r.bottom<=root.bottom && r.left>=root.left && r.right<=root.right})})()`), 'Challenge and camera controls remain inside the viewer');
    assert.equal(await evaluate(`document.querySelector('[data-wss-demo]').dataset.challenge`), id);
    assert.deepEqual((await pixels()).map(view => view.geometry), challenge.cases.flatMap(item => Array(3).fill(item.sample)));
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-wss-case-title]'),node=>node.textContent)`), challenge.cases.map(item => item.label));
    const step = await evaluate(`Number(document.querySelector('[data-wss-time]').value)`);
    for (const group of await metrics()) {
      const expected = manifest.samples.find(sample => sample.id === group.id);
      assert.equal(group.values[0].text, `${expected.metrics.relativeL2[step].toFixed(2)}%`);
      assert.equal(group.values[1].text, `${expected.metrics.relativeL2AllFrames.toFixed(2)}%`);
    }
    const expectedLegends = ['wss','error'].map(key => {
      const limit=challenge.displayRanges[key][1]*manifest.unitScale;
      return `0${Number((limit/2).toPrecision(3))}≥ ${Number(limit.toPrecision(3))}`;
    });
    assert.deepEqual(await legends(), expectedLegends, 'Both scales correspond to the selected challenge');
    (await pixels()).forEach(view=>{assert.ok(view.ink>1500);assert.ok(view.colored>50);assert.equal(view.step,String(step));});
  };

  await call('Page.navigate', { url: `${base}/publications/wall-shear-stress-aaa/` });
  await waitFor(`document.readyState==='complete' && document.querySelector('[data-wss-start]') && !document.querySelector('[data-wss-start]').hidden`, 'Page not ready');
  assert.equal(await evaluate(`document.querySelectorAll('[data-wss-view] canvas').length`), 0, 'GPU resources load on demand');
  assert.equal(requests.filter(url => /wss-demo\/.*\.gz/.test(url)).length, 0, 'No simulation data fetched before launch');
  await evaluate(`document.querySelector('[data-wss-start]').click()`); await ready();
  assert.equal(await evaluate(`document.querySelector('[data-wss-play]').getAttribute('aria-pressed')`), 'false', 'Reduced motion prevents autoplay');
  assert.deepEqual(await evaluate(`Array.from(document.querySelector('[data-wss-challenge]').options,option=>option.value)`), ['topology','boundary-conditions','remodelling']);
  await verifyChallenge('topology');
  const first = await pixels();
  assert.equal(first.length, 6, 'Both geometries appear simultaneously in six panels');
  first.forEach(view => { assert.ok(view.ink > 1500); assert.ok(view.colored > 50, 'All views have colored data'); });
  assert.equal(await evaluate(`document.querySelectorAll('[data-wss-geometry],[data-wss-range]').length`), 0, 'Geometry and color-range selectors removed');
  assert.deepEqual(first.map(view => view.geometry), ['base','base','base','extended','extended','extended']);
  for (const start of [0, 3]) {
    assert.ok(first[start].glyphs > 1000 && first[start].glyphs === first[start + 1].glyphs, 'CFD and prediction share glyph locations');
    assert.notEqual(first[start].hash, first[start + 1].hash, 'CFD and prediction use different vectors');
  }
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-wss-units]'),n=>n.textContent)`), Array(2).fill('Pa'));
  const fixedLegends = await legends();
  assert.equal(fixedLegends.length, 2, 'Both geometries share one WSS scale and one error scale');
  for (const step of [0, 5, 20]) {
    await timestep(step);
    for (const group of await metrics()) {
      const expected = manifest.samples.find(sample => sample.id === group.id);
      assert.equal(group.values[0].text, `${expected.metrics.relativeL2[step].toFixed(2)}%`);
      assert.equal(group.values[1].text, `${expected.metrics.relativeL2AllFrames.toFixed(2)}%`);
    }
    assert.deepEqual(await legends(), fixedLegends, 'Limits stay fixed across time and geometry');
    (await pixels()).forEach(view => assert.equal(view.step, String(step)));
  }
  await timestep(5);
  const systole = await pixels(); systole.forEach((view, i) => assert.notEqual(view.hash, first[i].hash, 'All six panels update with time'));
  // Six portrait views must actually fit within a typical laptop viewport.
  for (const [width,height] of [[1280,720],[1366,768],[1440,900]]) {
    await call('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false}); await frame();
    await evaluate(`document.querySelector('[data-wss-demo]').scrollIntoView({block:'start',behavior:'instant'})`); await frame();
    const layout = await evaluate(`(()=>{
      const root=document.querySelector('[data-wss-demo]').getBoundingClientRect();
      const rects=Array.from(document.querySelectorAll('[data-wss-view]'),node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}});
      return {top:root.top,bottom:root.bottom,scrollWidth:document.documentElement.scrollWidth,rects};
    })()`);
    assert.ok(layout.top>=0 && layout.bottom<=height+1, `${width}×${height}: the entire viewer fits on screen: ${JSON.stringify(layout)}`);
    assert.ok(layout.scrollWidth<=width+1, 'Wide viewer does not create horizontal page scrolling');
    layout.rects.forEach(rect=>{assert.ok(rect.top>=layout.top && rect.bottom<=layout.bottom);assert.ok(rect.left>=0 && rect.right<=width);assert.ok(rect.height>=200,'Vessels remain large enough to compare');});
    assert.ok(Math.max(...layout.rects.map(r=>r.top))-Math.min(...layout.rects.map(r=>r.top))<2, 'All six viewports share one row');
    (await pixels()).forEach(view=>assert.ok(view.ink>1500,'Resizing keeps every geometry visible'));
    if(width===1366)await capture('laptop');
  }
  await evaluate(`document.documentElement.dataset.theme='light'`); await frame(); await capture('desktop-light');
  await evaluate(`document.documentElement.dataset.theme='dark'`); await frame(); await capture('desktop-dark');
  const initialCamera = await pixels();
  await evaluate(`document.querySelector('[data-wss-zoom="in"]').click()`); await frame();
  (await pixels()).forEach((view, i) => assert.notEqual(view.hash, initialCamera[i].hash, 'All six cameras zoom together'));
  const zoomed = await pixels();
  await evaluate(`document.querySelector('[data-wss-view="gt"] canvas').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`); await frame();
  (await pixels()).forEach((view, i) => assert.notEqual(view.hash, zoomed[i].hash, 'All six cameras rotate together'));
  await evaluate(`document.querySelector('[data-wss-reset]').click()`); await frame();
  await select('density', '0.036'); await frame();
  for (const index of [0,1,3,4]) assert.ok((await pixels())[index].glyphs < first[index].glyphs);
  await select('density', '0.024'); await frame();
  await evaluate(`document.querySelector('[data-wss-size]').value='1.5';document.querySelector('[data-wss-size]').dispatchEvent(new Event('input',{bubbles:true}))`); await frame();
  assert.equal(await evaluate(`document.querySelector('[data-wss-size-label]').textContent`), '1.5×');
  const glyphPixels = await pixels(), glyphMetrics = await metrics();
  await select('display', 'magnitude'); await frame();
  const scalarPixels = await pixels();
  for (const index of [0,1,3,4]) { assert.notEqual(scalarPixels[index].hash, glyphPixels[index].hash, 'Glyphs switch to scalar magnitude'); assert.ok(scalarPixels[index].colored > 1000); }
  for (const index of [2,5]) assert.equal(scalarPixels[index].hash, glyphPixels[index].hash, 'Error maps remain vector-difference magnitude');
  assert.deepEqual(await legends(), fixedLegends); assert.deepEqual(await metrics(), glyphMetrics);
  assert.equal(await evaluate(`document.querySelector('[data-wss-density]').disabled && document.querySelector('[data-wss-size]').disabled`), true);
  await capture('scalar-dark');
  await timestep(6);
  (await pixels()).forEach((view, i) => assert.notEqual(view.hash, scalarPixels[i].hash, 'Scalar fields animate too'));
  await select('display', 'glyphs'); await timestep(5);
  assert.equal(await evaluate(`document.querySelector('[data-wss-density]').disabled || document.querySelector('[data-wss-size]').disabled`), false);
  assert.deepEqual((await pixels()).map(view => view.hash), glyphPixels.map(view => view.hash), 'Switching back restores glyph view');
  await timestep(20); await select('speed', '0.5'); await evaluate(`document.querySelector('[data-wss-play]').click()`);
  await waitFor(`Number(document.querySelector('[data-wss-time]').value)<20`, 'Playback did not loop');
  await evaluate(`document.querySelector('[data-wss-play]').click()`); await frame();
  assert.equal(await evaluate(`document.querySelector('[data-wss-play]').getAttribute('aria-pressed')`), 'false');
  assert.equal(requests.filter(url => /wss-demo\/.*\.gz/.test(url)).length, 4, 'Both geometries load only once');
  await timestep(5);
  await select('challenge','boundary-conditions'); await ready(); await verifyChallenge('boundary-conditions');
  assert.equal(requests.filter(url => /wss-demo\/.*\.gz/.test(url)).length, 5, 'Boundary comparison reuses the base geometry and only fetches new fields');
  const boundaryLegends = await legends();
  await timestep(10); await verifyChallenge('boundary-conditions'); assert.deepEqual(await legends(),boundaryLegends);
  await timestep(5); await capture('boundary-conditions');
  await select('display','magnitude'); await frame(); await verifyChallenge('boundary-conditions');
  await capture('boundary-scalar');
  // Aborting a cold challenge load must never overwrite a later selection.
  await select('challenge','remodelling');
  await select('challenge','topology'); await ready();
  await evaluate(`new Promise(resolve=>setTimeout(resolve,300))`); await verifyChallenge('topology');
  await select('challenge','remodelling'); await ready(); await verifyChallenge('remodelling');
  assert.equal(await evaluate(`document.querySelector('[data-wss-display]').value`),'magnitude','Display mode survives challenge switching');
  assert.equal(await evaluate(`document.querySelector('[data-wss-time]').value`),'5','Heart-cycle phase survives challenge switching');
  const remodellingLegends = await legends();
  await capture('remodelling-scalar');
  await timestep(15); await verifyChallenge('remodelling'); assert.deepEqual(await legends(),remodellingLegends);
  await select('display','glyphs'); await timestep(5); await verifyChallenge('remodelling'); await capture('remodelling-glyphs');
  const warmedRequests = requests.filter(url => /wss-demo\/.*\.gz/.test(url)).length;
  for(const id of ['topology','boundary-conditions','remodelling']) {
    await select('challenge',id); await ready(); await verifyChallenge(id);
  }
  assert.equal(requests.filter(url => /wss-demo\/.*\.gz/.test(url)).length,warmedRequests,'All visited cases are reused without new downloads');
  await select('speed','0.5'); await evaluate(`document.querySelector('[data-wss-play]').click()`);
  await select('challenge','boundary-conditions'); await ready();
  assert.equal(await evaluate(`document.querySelector('[data-wss-play]').getAttribute('aria-pressed')`),'true','Playback resumes after switching challenge');
  await evaluate(`document.querySelector('[data-wss-play]').click()`); await timestep(5); await verifyChallenge('boundary-conditions');
  const expanded = await evaluate(`(async()=>{const button=document.querySelector('[data-wss-fullscreen]');if(button.hidden)return false;button.click();await new Promise(r=>setTimeout(r,100));return !!document.fullscreenElement})()`);
  if (expanded) {
    await frame();
    assert.ok(await evaluate(`(()=>{const root=document.querySelector('[data-wss-demo]');return root.scrollHeight<=root.clientHeight+1 && Array.from(root.querySelectorAll('[data-wss-view]')).every(node=>node.getBoundingClientRect().bottom<=innerHeight)})()`), 'Fullscreen shows all six views without internal scrolling');
    await capture('fullscreen');
    await evaluate(`document.exitFullscreen()`); await frame();
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true }); await frame();
  await evaluate(`document.querySelector('[data-wss-reset]').click()`); await timestep(5); await capture('mobile');
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), 'No mobile horizontal overflow');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.wss-demo .demo-panels')).gridTemplateColumns.split(' ').length`), 1);
  assert.ok(await evaluate(`Math.abs(document.querySelector('[data-wss-density]').closest('label').getBoundingClientRect().y-document.querySelector('[data-wss-size]').closest('label').getBoundingClientRect().y)<2`), 'Arrow density and size sit beside each other');
  (await pixels()).forEach(view => assert.ok(view.ink > 1500));
  assert.deepEqual(errors, [], 'No console/network errors');
  console.log('WSS browser checks passed: three challenges, lazy/cached case loading, stale-request protection, six panels fitting laptop screens, glyph/scalar switching, 21-step playback, Pa legends, fixed percentile limits, both surface metrics, shared cameras, dark/light themes, and mobile layout.');
} finally {
  await send('Browser.close').catch(() => {});
  chrome.kill();
  for (const task of pending.values()) clearTimeout(task.timer);
  await rm(profile, { recursive: true, force: true });
}
