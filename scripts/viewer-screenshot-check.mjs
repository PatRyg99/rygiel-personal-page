import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function checkGIFRecovery({ evaluate, root }) {
  const state = () => evaluate(`(() => {
    const root=document.querySelector(${JSON.stringify(root)});
    return {controls:[...root.querySelectorAll('input,select,button:not([data-viewer-export])')].map(node=>[node.value,node.disabled,node.getAttribute('aria-pressed')]),
      views:[...root.querySelectorAll('[data-demo-view],[data-wss-view]')].map(node=>{const canvas=node.querySelector('canvas');return [node.inert,canvas.dataset.timeStep??canvas.dataset.timestep,canvas.toDataURL()];})};
  })()`);
  const before = await state();
  await evaluate(`document.querySelector(${JSON.stringify(root)}).querySelector('[data-viewer-export]').click()`);
  assert.ok(await evaluate(`(() => {const root=document.querySelector(${JSON.stringify(root)});return root.querySelector('[data-viewer-export]').getAttribute('aria-label')==='Cancel GIF export' && [...root.querySelectorAll('input,select,button:not([data-viewer-export])')].every(node=>node.disabled) && [...root.querySelectorAll('[data-demo-view],[data-wss-view]')].every(node=>node.inert);})()`), 'Controls and cameras are locked during export, with cancellation available');
  const wait = async predicate => {
    const deadline=Date.now()+30000;
    while(Date.now()<deadline) {if(await evaluate(predicate))return;await new Promise(resolve=>setTimeout(resolve,50));}
    throw new Error('Export recovery timed out');
  };
  await wait(`Number(document.querySelector(${JSON.stringify(root)}).querySelector('[data-viewer-export-status]').textContent.match(/(\\d+) \\/ 21/)?.[1])>=3`);
  await evaluate(`document.querySelector(${JSON.stringify(root)}).querySelector('[data-viewer-export]').click()`);
  await wait(`document.querySelector(${JSON.stringify(root)}).querySelector('[data-viewer-export]').getAttribute('aria-busy')==='false'`);
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  assert.deepEqual(await state(),before,'Cancelling restores the selected frame, controls and rendered geometry');
  assert.match(await evaluate(`document.querySelector(${JSON.stringify(root)}).querySelector('[data-viewer-export-status]').textContent`),/cancelled/);
  try {
    await evaluate(`window.originalGIFWorker=window.Worker;window.Worker=class{constructor(){throw new Error('Test worker failure');}};document.querySelector(${JSON.stringify(root)}).querySelector('[data-viewer-export]').click()`);
    await wait(`document.querySelector(${JSON.stringify(root)}).querySelector('[data-viewer-export]').getAttribute('aria-busy')==='false'`);
    await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    assert.deepEqual(await state(),before,'Encoder failures restore the viewer and allow retry');
    assert.match(await evaluate(`document.querySelector(${JSON.stringify(root)}).querySelector('[data-viewer-export-status]').textContent`),/could not be downloaded/);
  } finally { await evaluate(`window.Worker=window.originalGIFWorker;delete window.originalGIFWorker`); }
}

// Decode the actual download, checking every field, labels, GIF frames and timing.
export async function checkScreenshot({ send, evaluate, root, panels, texts, filename, format = 'png', delay }) {
  const directory = await mkdtemp(join(tmpdir(), 'rygiel-export-'));
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
  await evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(root)});
    if (root.querySelector('[data-viewer-export]').disabled) throw new Error('Export button is disabled');
    const proto = CanvasRenderingContext2D.prototype;
    window.exportProbe = { texts: [], panels: [], bars: [], fillText: proto.fillText, drawImage: proto.drawImage, fillRect: proto.fillRect };
    proto.fillText = function(text, ...args) { window.exportProbe.texts.push(String(text)); return window.exportProbe.fillText.call(this, text, ...args); };
    const rectangle = (context,x,y,width,height) => { const t=context.getTransform();return {x:x*t.a+t.e,y:y*t.d+t.f,width:width*t.a,height:height*t.d}; };
    proto.drawImage = function(source, ...args) {
      if (source instanceof HTMLCanvasElement && source.closest('[data-demo-view],[data-wss-view]')) {
        window.exportProbe.panels.push({...rectangle(this,...args),step:source.dataset.timeStep??source.dataset.timestep});
      }
      return window.exportProbe.drawImage.call(this, source, ...args);
    };
    proto.fillRect = function(...args) {
      if (this.fillStyle instanceof CanvasGradient && this.canvas.width !== 512) window.exportProbe.bars.push(rectangle(this,...args));
      return window.exportProbe.fillRect.call(this,...args);
    };
    root.querySelector('[data-viewer-export]').click();
  })()`);
  try {
    let name;
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      name = (await readdir(directory)).find(file => file.endsWith('.' + format));
      if (name) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(name, `No ${format} downloaded: ${await evaluate(`document.querySelector(${JSON.stringify(root)}).querySelector('[data-viewer-export-status]').textContent`)}`);
    assert.match(name, filename, 'Download filename identifies the captured selection');
    const path = join(directory, name), file = await readFile(path);
    if (format === 'png') {
      assert.equal(file.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Download is a PNG');
      assert.ok(file.readUInt32BE(16) >= 2000 && file.readUInt32BE(20) >= 600, 'PNG has presentation-sized dimensions');
    } else {
      assert.equal(file.subarray(0, 6).toString(), 'GIF89a', 'Download is an animated GIF');
      assert.equal(Math.max(file.readUInt16LE(6), file.readUInt16LE(8)), 1600, 'GIF keeps a clear, bounded resolution');
    }
    const probe = await evaluate(`(async () => {
      const decoder=new ImageDecoder({data:Uint8Array.from(atob('${file.toString('base64')}'),c=>c.charCodeAt(0)),type:'image/${format}'});
      await decoder.tracks.ready;
      const track=decoder.tracks.selectedTrack;
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      const colored = rect => {
        const data=ctx.getImageData(Math.round(rect.x),Math.round(rect.y),Math.max(1,Math.floor(rect.width)),Math.max(1,Math.floor(rect.height))).data;
        let count=0;for(let i=0;i<data.length;i+=4)if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>40)count++;
        return count;
      };
      const frames=[];
      for(const index of (${format === 'gif' ? '[0,10,20]' : '[0]'})) {
        const {image}=await decoder.decode({frameIndex:index});
        const duration=image.duration;
        canvas.width=image.displayWidth;canvas.height=image.displayHeight;ctx.drawImage(image,0,0);image.close();
        const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let hash=2166136261;for(let i=0;i<data.length;i+=4)hash=Math.imul(hash^data[i],16777619);
        frames.push({hash,duration,panels:window.exportProbe.panels.slice(index*${panels},(index+1)*${panels}).map(colored),bars:window.exportProbe.bars.slice(index*${panels},(index+1)*${panels}).map(colored)});
      }
      const result={texts:window.exportProbe.texts,panels:window.exportProbe.panels,bars:window.exportProbe.bars,frames,frameCount:track.frameCount,loops:track.repetitionCount===Infinity};decoder.close();return result;
    })()`);
    const frames = format === 'gif' ? 21 : 1;
    assert.equal(probe.frameCount, frames, 'All timesteps are encoded');
    assert.equal(probe.panels.length, panels * frames, 'Export includes every field, even on mobile');
    assert.equal(probe.bars.length, panels * frames, 'Every field has its colorbar');
    probe.frames.forEach(frame => {
      frame.panels.forEach(count => assert.ok(count > 100, 'Exported geometry is not blank'));
      frame.bars.forEach(count => assert.ok(count > 1000, 'Exported colorbars contain colors'));
      if (delay) assert.equal(frame.duration, Math.round(delay / 10) * 10000, 'GIF uses the selected playback speed');
    });
    for (let i = 0; i < frames; i++) {
      const steps = probe.panels.slice(i * panels, (i + 1) * panels).map(panel => panel.step);
      assert.ok(new Set(steps).size <= 1, 'All exported fields use the same timestep');
      if (format === 'gif') assert.equal(Number(steps[0]), i, 'GIF covers the full heart cycle in order');
    }
    if (format === 'gif') { assert.ok(probe.loops, 'GIF loops indefinitely'); assert.ok(new Set(probe.frames.map(frame=>frame.hash)).size > 1, 'GIF contains changing fields'); }
    texts.forEach(text => assert.ok(probe.texts.includes(text), `Export includes label: ${text}`));
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(root)}).querySelector('[data-viewer-export]').disabled`), false, 'Download button is reusable');
    console.log(`Verified ${format.toUpperCase()} export (${(file.length/1024/1024).toFixed(2)} MiB): ${path}`);
    return path;
  } finally {
    await evaluate(`(() => {const proto=CanvasRenderingContext2D.prototype;proto.fillText=window.exportProbe.fillText;proto.drawImage=window.exportProbe.drawImage;proto.fillRect=window.exportProbe.fillRect;delete window.exportProbe;})()`);
  }
}
