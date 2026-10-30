// Local browser smoke check. Requires Chrome and a running Jekyll server.
import { spawn } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.SITE_PREVIEW_URL || 'http://127.0.0.1:4000/rygiel-personal-page';
const browserPath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = await mkdtemp(join(tmpdir(), 'rygiel-browser-'));
const chrome = spawn(browserPath, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
const pending = new Map();
const errors = [];
const requests = [];
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
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 15000);
  pending.set(id, { resolve, reject, timer });
  chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
});
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride', {width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await call('Emulation.setEmulatedMedia', {features:[{name:'prefers-color-scheme',value:'light'}]});
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', {expression,returnByValue:true,awaitPromise:true,userGesture:true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression, label, timeout=30000) => {
    const deadline=Date.now()+timeout;
    while (Date.now()<deadline) {
      if (await evaluate(expression)) return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error(`${label}: ${await evaluate(`document.querySelector('[data-demo-status]')?.textContent`)}; browser errors: ${errors.join('; ')}`);
  };
  const frame = () => evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  const ready = async () => { await waitFor(`document.querySelector('[data-aneumo-demo]').dataset.state==='ready'`, 'Viewer did not become ready'); await frame(); };
  const screenshot = async name => { const result=await call('Page.captureScreenshot',{format:'png'}); await writeFile(join(tmpdir(),`rygiel-demo-${name}.png`),Buffer.from(result.data,'base64')); };
  const select = async (selector,value) => evaluate(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)};document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('change',{bubbles:true}))`);
  const pause = async () => { await evaluate(`if(document.querySelector('[data-demo-play]').getAttribute('aria-pressed')==='true')document.querySelector('[data-demo-play]').click()`);await frame(); };
  const timestep = async value => { await evaluate(`document.querySelector('[data-demo-time]').value=${JSON.stringify(String(value))};document.querySelector('[data-demo-time]').dispatchEvent(new Event('input',{bubbles:true}))`);await frame(); };
  const snapshot = () => evaluate(`(() => [...document.querySelectorAll('.demo-viewport canvas')].map(canvas => {
    const gl=canvas.getContext('webgl2'), width=canvas.width, height=canvas.height;
    const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let hash=2166136261, colored=0, nonBackground=0, xMin=width,xMax=0,yMin=height,yMax=0;
    const background=[pixels[0],pixels[1],pixels[2]];
    for(let i=0;i<pixels.length;i+=4) {
      hash=Math.imul(hash^pixels[i],16777619);hash=Math.imul(hash^pixels[i+1],16777619);hash=Math.imul(hash^pixels[i+2],16777619);
      if(Math.max(pixels[i],pixels[i+1],pixels[i+2])-Math.min(pixels[i],pixels[i+1],pixels[i+2])>35) colored++;
      if(background.some((v,k)=>Math.abs(pixels[i+k]-v)>8)) {nonBackground++;const x=(i/4)%width,y=Math.floor(i/4/width);xMin=Math.min(xMin,x);xMax=Math.max(xMax,x);yMin=Math.min(yMin,y);yMax=Math.max(yMax,y);}
    }
    return {hash:hash>>>0,colored,nonBackground,bounds:[xMin/width,xMax/width,yMin/height,yMax/height],field:canvas.dataset.field};
  }))()`);
  await call('Page.navigate',{url:base+'/publications/abgatr/'});
  await waitFor(`document.readyState==='complete' && document.querySelector('[data-demo-start]') && !document.querySelector('[data-demo-start]').hidden`, 'Demo page did not load');
  assert.equal(await evaluate(`document.querySelectorAll('.demo-viewport canvas').length`),0,'GPU resources load on demand');
  await evaluate(`document.querySelector('[data-demo-start]').click()`);
  await ready();
  assert.equal(await evaluate(`document.querySelector('[data-demo-dataset]').value`),'aaa-100','AAA-100 is the default dataset');
  assert.equal(await evaluate(`document.querySelector('[data-demo-sample]').value`),'AAA021-T');
  assert.equal(requests.filter(url=>url.endsWith('.series.gz')).length,2,'Initial load fetches only CFD and the selected model series');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.demo-pause-icon')).display`),'block');
  await pause();
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.demo-pause-icon')).display`),'none');
  assert.equal(await evaluate(`document.querySelector('[data-demo-play]').textContent.trim()`),'','Playback button uses icons');
  assert.match(await evaluate(`document.querySelector('[data-demo-play]').getAttribute('aria-label')`),/^Play/);
  await select('[data-demo-dataset]','aneumo');await ready();
  await evaluate(`document.querySelector('[data-aneumo-demo]').scrollIntoView({behavior:'instant',block:'start'})`);
  await frame();
  assert.equal(await evaluate(`document.querySelectorAll('.demo-viewport canvas').length`),3);
  const initial=await snapshot();
  assert.ok(initial.every(view=>view.colored>100),'Every panel renders an actual scalar field');
  assert.equal(new Set(initial.map(view=>view.hash)).size,3,'CFD, prediction and error are distinct renders');
  await screenshot('777-desktop');
  const speedScale=await evaluate(`document.querySelector('[data-demo-velocity-ticks]').textContent`);
  const errorScale=await evaluate(`document.querySelector('[data-demo-error-ticks]').textContent`);
  for(const model of ['AB-GATr','AB-UPT','AB-UPT-180','LaB-GATr','Transolver','Transolver-180']) {
    await select('[data-demo-model]',model);await frame();
    const views=await snapshot();
    assert.deepEqual(views.map(view=>view.field),['GT',model,model+'-error']);
    assert.equal(views[0].hash,initial[0].hash,'Changing model leaves CFD unchanged');
    assert.equal(await evaluate(`document.querySelector('[data-demo-velocity-ticks]').textContent`),speedScale);
    assert.equal(await evaluate(`document.querySelector('[data-demo-error-ticks]').textContent`),errorScale);
  }
  assert.equal(await evaluate(`document.querySelector('[data-demo-prediction-title]').textContent`),'Transolver++');
  assert.match(await evaluate(`document.querySelector('[data-demo-prediction-subtitle]').textContent`),/rotation-trained/);
  await select('[data-demo-model]','AB-GATr');await frame();
  const box=await evaluate(`(() => {const r=document.querySelector('[data-demo-view="prediction"] canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...box});
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:box.x+50,y:box.y+30});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:box.x+50,y:box.y+30});
  await frame();
  const rotated=await snapshot();
  assert.ok(rotated.every((view,index)=>view.hash!==initial[index].hash),'Dragging one pane rotates all three');
  rotated.slice(1).forEach(view=>view.bounds.forEach((value,index)=>assert.ok(Math.abs(value-rotated[0].bounds[index])<.015,'Geometry projections stay synchronized')));
  await evaluate(`document.querySelector('[data-demo-zoom="in"]').click()`);await frame();
  const zoomed=await snapshot();
  assert.ok(zoomed.every((view,index)=>view.nonBackground>rotated[index].nonBackground),'Zoom affects all panes');
  await evaluate(`document.querySelector('[data-demo-reset]').click()`);await frame();
  assert.deepEqual((await snapshot()).map(view=>view.hash),initial.map(view=>view.hash),'Reset restores the initial camera');
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',buttons:2,clickCount:1,...box});
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:2,x:box.x+25,y:box.y+10});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',buttons:0,clickCount:1,x:box.x+25,y:box.y+10});await frame();
  assert.ok((await snapshot()).every((view,index)=>view.hash!==initial[index].hash),'Panning affects all three views');
  await evaluate(`document.querySelector('[data-demo-reset]').click()`);await frame();
  await evaluate(`document.querySelector('[data-demo-wall]').click()`);await frame();
  assert.ok((await snapshot()).every((view,index)=>view.hash!==initial[index].hash),'Translucent walls can be hidden');
  await evaluate(`document.querySelector('[data-demo-wall]').click()`);await frame();
  const datasets = {aneumo:['777','832','845'],synthbifcor:['1815','1847','1962'],'aaa-100':['AAA021-T']};
  assert.deepEqual(await evaluate(`[...document.querySelector('[data-demo-dataset]').options].map(option=>option.value)`),Object.keys(datasets));
  for (const [dataset,samples] of Object.entries(datasets)) {
    const beforeDataset = requests.length;
    await select('[data-demo-dataset]',dataset);await ready();
    assert.deepEqual(await evaluate(`[...document.querySelector('[data-demo-sample]').options].map(option=>option.value)`),samples);
    assert.equal(await evaluate(`document.querySelector('[data-demo-time-controls]').hidden`),dataset!=='aaa-100');
    if(dataset==='aaa-100') {
      assert.deepEqual(await evaluate(`[...document.querySelector('[data-demo-sample]').options].map(option=>option.textContent)`),['021']);
      assert.equal(await evaluate(`document.querySelector('[data-demo-time]').max`),'20');
      assert.equal(await evaluate(`document.querySelector('[data-demo-play]').getAttribute('aria-pressed')`),'true','Temporal case starts looping');
      assert.ok(requests.slice(beforeDataset).filter(url=>url.endsWith('.series.gz')).length<=2,'Only CFD and the selected model time series load, unless already cached');
    }
    for (const sample of samples) {
      await select('[data-demo-sample]',sample);await ready();
      if(dataset==='aaa-100') {await pause();await timestep(0);}
      const reference=await snapshot();
      assert.ok(reference.every(view=>view.colored>10),`Initial fields visible for ${sample}`);
      const scales=await evaluate(`[...document.querySelectorAll('[data-demo-velocity-ticks],[data-demo-error-ticks]')].map(node=>node.textContent)`);
      for(const model of ['AB-GATr','AB-UPT','AB-UPT-180','LaB-GATr','Transolver','Transolver-180']) {
        await select('[data-demo-model]',model);await ready();
        const views=await snapshot();
        assert.deepEqual(views.map(view=>view.field),['GT',model,model+'-error']);
        assert.equal(views[0].hash,reference[0].hash,`${sample}: model changes preserve CFD`);
        assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-demo-velocity-ticks],[data-demo-error-ticks]')].map(node=>node.textContent)`),scales);
      }
      await select('[data-demo-model]','AB-GATr');await ready();
      await screenshot(`${sample}-default`);
      for (const axis of ['x','y','z']) {
        await select('[data-demo-axis]',axis);await ready();
        assert.ok((await snapshot()).every(view=>view.colored>10),`Interior fields visible for ${sample}/${axis}`);
      }
      for(const depth of [0,14,7]) {
        await evaluate(`document.querySelector('[data-demo-depth]').value='${depth}';document.querySelector('[data-demo-depth]').dispatchEvent(new Event('input',{bubbles:true}))`);
        await waitFor(`document.querySelector('[data-demo-status]').textContent.includes('slice at ${depth===0?'8':depth===14?'92':'50'}%') && document.querySelector('[data-aneumo-demo]').dataset.state==='ready'`,'Slice did not update');
        await frame();
        assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-demo-velocity-ticks],[data-demo-error-ticks]')].map(node=>node.textContent)`),scales);
      }
      console.log(`Verified ${dataset} sample ${sample}: all models, axes and depth changes.`);
    }
  }
  const cycleScales=await evaluate(`[...document.querySelectorAll('[data-demo-velocity-ticks],[data-demo-error-ticks]')].map(node=>node.textContent)`);
  const cycleStart=await snapshot();
  const hashes=[new Set(),new Set(),new Set()];
  for(let step=0;step<21;step++) {
    await timestep(step);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.demo-viewport canvas')].map(canvas=>canvas.dataset.timeStep)`),Array(3).fill(String(step)),'All three panels show the same timestep');
    (await snapshot()).forEach((view,index)=>hashes[index].add(view.hash));
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-demo-velocity-ticks],[data-demo-error-ticks]')].map(node=>node.textContent)`),cycleScales,'Scales are fixed across the full heart cycle');
  }
  assert.ok(hashes.every(values=>values.size>5),'CFD, prediction, and supplied error change through the cycle');
  await select('[data-demo-speed]','0.5');
  await evaluate(`document.querySelector('[data-demo-play]').click()`);
  await waitFor(`document.querySelector('[data-demo-view="gt"] canvas').dataset.timeStep==='0'`,'Playback did not wrap from timestep 21 to 1');
  await pause();
  assert.deepEqual((await snapshot()).map(view=>view.hash),cycleStart.map(view=>view.hash),'Loop returns to the same field and camera');
  const pausedStep=await evaluate(`document.querySelector('[data-demo-time]').value`);
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(await evaluate(`document.querySelector('[data-demo-time]').value`),pausedStep,'Pause stops time advancement');
  await timestep(10);await select('[data-demo-model]','AB-UPT');await ready();
  assert.equal(await evaluate(`document.querySelector('[data-demo-time]').value`),'10','Changing models retains the selected timestep');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.demo-viewport canvas')].map(canvas=>canvas.dataset.timeStep)`),['10','10','10']);
  await screenshot('AAA021-time-11');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]});
  await select('[data-demo-sample]','AAA021-T');await ready();
  assert.equal(await evaluate(`document.querySelector('[data-demo-play]').getAttribute('aria-pressed')`),'false','Reduced motion disables autoplay');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await frame();
  await evaluate(`document.querySelector('[data-aneumo-demo]').scrollIntoView({behavior:'instant',block:'start'})`);await frame();
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth+1`),false,'Time controls fit on mobile');
  await screenshot('AAA021-mobile-time-controls');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'no-preference'}]});
  // Rapid requests across datasets must not leave stale geometry or an averaging label.
  await select('[data-demo-dataset]','aaa-100');await select('[data-demo-dataset]','synthbifcor');await ready();
  assert.match(await evaluate(`document.querySelector('[data-demo-status]').textContent`),/^SynthBifCor · Sample 1815/);
  assert.equal(await evaluate(`document.querySelector('[data-demo-time-controls]').hidden`),true);
  assert.equal(await evaluate(`document.querySelector('[data-aneumo-demo]').dataset.playing`),'false');
  await select('[data-demo-dataset]','aneumo');await ready();
  // Rapid requests must not replace the selected case with an older completed fetch.
  await select('[data-demo-sample]','777');await select('[data-demo-sample]','832');await ready();
  assert.match(await evaluate(`document.querySelector('[data-demo-status]').textContent`),/^ANEUMO · Sample 832/);
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await frame();
  await evaluate(`document.querySelector('[data-demo-reset]').click();document.querySelector('[data-aneumo-demo]').scrollIntoView({behavior:'instant',block:'start'})`);await frame();
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth+1`),false,'No mobile horizontal overflow');
  await screenshot('mobile-controls');
  await evaluate(`document.querySelector('[data-demo-view="gt"] canvas').scrollIntoView({behavior:'instant',block:'center'})`);await frame();
  const touchBox=await evaluate(`(() => {const r=document.querySelector('[data-demo-view="gt"] canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  const beforeTouch=await snapshot();
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:touchBox.x-30,y:touchBox.y},{id:2,x:touchBox.x+30,y:touchBox.y}]});
  await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:touchBox.x-50,y:touchBox.y},{id:2,x:touchBox.x+50,y:touchBox.y}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frame();
  assert.ok((await snapshot()).every((view,index)=>view.hash!==beforeTouch[index].hash),'Pinch synchronizes all views');
  await evaluate(`document.querySelector('[data-demo-reset]').click();document.querySelector('[data-demo-view="gt"] canvas').focus()`);await frame();
  const beforeKey=await snapshot();
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await frame();
  assert.ok((await snapshot()).every((view,index)=>view.hash!==beforeKey[index].hash),'Keyboard rotates synchronized views');
  await evaluate(`document.documentElement.dataset.theme='dark'`);await frame();
  await screenshot('mobile-dark');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await frame();
  await evaluate(`document.querySelector('[data-demo-reset]').click();document.querySelector('[data-aneumo-demo]').scrollIntoView({behavior:'instant',block:'start'})`);await frame();
  await screenshot('desktop-dark');
  if(await evaluate(`document.fullscreenEnabled`)) {
    await evaluate(`document.querySelector('[data-demo-expand]').click()`);
    await waitFor(`document.fullscreenElement===document.querySelector('[data-aneumo-demo]')`,'Fullscreen did not open');
    await frame();
    assert.ok((await snapshot()).every(view=>view.colored>100),'Fullscreen renders all panels');
    await evaluate(`document.exitFullscreen()`);await frame();
  }
  // Simulate a failed data request and verify that stale geometry is not mislabeled.
  await evaluate(`window.originalFetch=window.fetch;window.fetch=(url,options)=>String(url).endsWith('.bin.gz')?Promise.resolve(new Response('',{status:503})):window.originalFetch(url,options)`);
  await evaluate(`document.querySelector('[data-demo-depth]').value='5';document.querySelector('[data-demo-depth]').dispatchEvent(new Event('input',{bubbles:true}))`);
  await waitFor(`document.querySelector('[data-aneumo-demo]').dataset.state==='error'`,'Failed fetch was not surfaced');
  assert.equal(await evaluate(`document.querySelector('[data-demo-panels]').hidden`),true);
  await evaluate(`window.fetch=window.originalFetch;delete window.originalFetch;document.querySelector('[data-demo-start]').click()`);await ready();
  assert.ok((await snapshot()).every(view=>view.colored>100),'Retry restores real geometry');
  assert.deepEqual(errors,[],'No browser exceptions or failed asset requests');
  console.log('AB-GATr browser checks passed: 3 datasets, 7 cases, 6 models, 21 synchronized AAA timesteps, looping and scrubbing, reduced motion, model-specific loading, 3 slicing axes, fixed scales, synchronized cameras, mobile/dark layouts, stale-request handling and retry.');
  console.log(`Screenshots: ${tmpdir()}/rygiel-demo-*.png`);
} finally {
  try { await send('Browser.close'); } catch (_) { chrome.kill(); }
  await new Promise(resolve=>{if(chrome.exitCode!==null)resolve();else{chrome.once('exit',resolve);setTimeout(resolve,2000);}});
  await rm(profile,{recursive:true,force:true});
}
