import { Vector2 } from './vendor/three/three.module.min.js';

const SCALE = 2;
const FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function lines(context, text, width) {
  const result = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) { result.push(line); line = word; }
    else line = next;
  }
  if (line) result.push(line);
  return result;
}

function drawText(context, text, x, y, width, size, color, weight = 400) {
  context.font = `${weight} ${size}px ${FONT}`;
  context.fillStyle = color;
  const wrapped = lines(context, text, width);
  wrapped.forEach((line, index) => context.fillText(line, x, y + index * size * 1.5));
  return wrapped.length * size * 1.5;
}

function drawView(context, view, x, y, width, height, scale) {
  const { renderer, scene, camera } = view;
  const size = renderer.getSize(new Vector2()), ratio = renderer.getPixelRatio();
  const fit = Math.min(width / size.x, height / size.y);
  const drawWidth = size.x * fit, drawHeight = size.y * fit;
  try {
    // Render more pixels with the same camera and aspect ratio, then restore the live view.
    renderer.setPixelRatio(1);
    renderer.setSize(Math.round(drawWidth * scale), Math.round(drawHeight * scale), false);
    renderer.render(scene, camera);
    context.drawImage(renderer.domElement, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  } finally {
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.x, size.y, false);
    renderer.render(scene, camera);
  }
}

function drawLegend(context, legend, x, y, width, colors) {
  context.font = `400 12px ${FONT}`;
  context.fillStyle = colors.muted;
  context.fillText(legend.label, x, y);
  context.textAlign = 'right'; context.fillText(legend.units, x + width, y); context.textAlign = 'left';
  const gradient = context.createLinearGradient(x, 0, x + width, 0);
  legend.palette.forEach((color, index) => gradient.addColorStop(index / (legend.palette.length - 1), color.getStyle()));
  context.fillStyle = gradient; context.fillRect(x, y + 22, width, 10);
  context.fillStyle = colors.muted;
  legend.ticks.forEach((text, index) => {
    context.textAlign = ['left', 'center', 'right'][index];
    context.fillText(text, x + width * index / 2, y + 40);
  });
  context.textAlign = 'left';
}

// Compose synchronously: every panel, label and legend belongs to the same animation frame.
export function renderScreenshot(root, snapshot, options = {}) {
  const style = getComputedStyle(root);
  const colors = options.colors || Object.fromEntries(['bg', 'surface', 'ink', 'muted', 'line'].map(key => [key, style.getPropertyValue(`--${key}`).trim()]));
  const groupColumns = Math.min(snapshot.groupColumns || 1, snapshot.groups.length);
  const panelWidth = groupColumns === 2 ? 280 : 340;
  const margin = 24, gap = 14, groupGap = 28;
  const groupWidth = panelWidth * 3 + gap * 2;
  const width = margin * 2 + groupColumns * groupWidth + (groupColumns - 1) * groupGap;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas export is unavailable');
  context.font = `600 24px ${FONT}`;
  const titleHeight = lines(context, snapshot.title, width - margin * 2).length * 36;
  context.font = `400 14px ${FONT}`;
  const subtitleHeight = lines(context, snapshot.subtitle, width - margin * 2).length * 21;
  const headerHeight = margin + titleHeight + subtitleHeight + 24;
  const panels = snapshot.groups.flatMap(group => group.panels);
  const viewHeight = Math.round(Math.max(300, Math.min(560, ...panels.map(panel => panelWidth * panel.view.camera.aspect ** -1))));
  const hasGroupTitles = snapshot.groups.some(group => group.title);
  const hasPanelMetrics = panels.some(panel => panel.metrics?.length);
  const groupTitleHeight = hasGroupTitles ? 36 : 0;
  const panelHeight = 72 + viewHeight + 80 + (hasPanelMetrics ? 60 : 0);
  const groupFooterHeight = snapshot.groups.some(group => group.metrics?.length) ? 52 : 0;
  const rowHeight = groupTitleHeight + panelHeight + groupFooterHeight;
  const rows = Math.ceil(snapshot.groups.length / groupColumns);
  const height = headerHeight + rows * rowHeight + (rows - 1) * groupGap + margin;
  const scale = options.maxDimension ? Math.min(SCALE, options.maxDimension / Math.max(width, height)) : SCALE;
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  context.scale(scale, scale); context.textBaseline = 'top';
  context.fillStyle = colors.bg; context.fillRect(0, 0, width, height);
  drawText(context, snapshot.title, margin, margin, width - margin * 2, 24, colors.ink, 600);
  drawText(context, snapshot.subtitle, margin, margin + titleHeight + 4, width - margin * 2, 14, colors.muted);
  snapshot.groups.forEach((group, groupIndex) => {
    const gx = margin + (groupIndex % groupColumns) * (groupWidth + groupGap);
    const gy = headerHeight + Math.floor(groupIndex / groupColumns) * (rowHeight + groupGap);
    if (group.title) drawText(context, group.title, gx, gy, groupWidth, 18, colors.ink, 600);
    group.panels.forEach((panel, index) => {
      const x = gx + index * (panelWidth + gap), y = gy + groupTitleHeight;
      context.fillStyle = colors.surface; context.fillRect(x, y, panelWidth, panelHeight);
      context.strokeStyle = colors.line; context.lineWidth = 1; context.strokeRect(x + .5, y + .5, panelWidth - 1, panelHeight - 1);
      drawText(context, panel.title, x + 14, y + 12, panelWidth - 28, 18, colors.ink, 600);
      if (panel.subtitle) drawText(context, panel.subtitle, x + 14, y + 42, panelWidth - 28, 12, colors.muted);
      context.fillStyle = colors.bg; context.fillRect(x + 1, y + 72, panelWidth - 2, viewHeight);
      drawView(context, panel.view, x + 1, y + 72, panelWidth - 2, viewHeight, scale);
      drawLegend(context, panel.legend, x + 14, y + 72 + viewHeight + 12, panelWidth - 28, colors);
      (panel.metrics || []).forEach((metric, metricIndex) => {
        drawText(context, metric, x + 14, y + 72 + viewHeight + 82 + metricIndex * 22, panelWidth - 28, 12, colors.ink);
      });
    });
    (group.metrics || []).forEach((metric, index) => {
      drawText(context, metric, gx, gy + groupTitleHeight + panelHeight + 10 + index * 20, groupWidth, 12, colors.muted);
    });
  });
  return canvas;
}

function gifWorker(signal) {
  const worker = new Worker(new URL('./viewer-gif-worker.js', import.meta.url), { type: 'module' });
  let pending;
  const fail = error => { if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null; } };
  const abort = () => { worker.terminate(); fail(new DOMException('Export cancelled', 'AbortError')); };
  signal.addEventListener('abort', abort, { once: true });
  worker.onerror = () => fail(new Error('GIF encoder failed to load'));
  worker.onmessage = ({ data }) => {
    if (!pending) return;
    const { resolve, reject, timer } = pending; pending = null; clearTimeout(timer);
    data.error ? reject(new Error(data.error)) : resolve(data);
  };
  return {
    send(data, transfer = []) {
      signal.throwIfAborted();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => fail(new Error('GIF encoding timed out')), 60000);
        pending = { resolve, reject, timer }; worker.postMessage(data, transfer);
      });
    },
    dispose() { signal.removeEventListener('abort', abort); worker.terminate(); },
  };
}

function colorRampPixels(snapshot) {
  const palettes = [...new Set(snapshot.groups.flatMap(group => group.panels.map(panel => panel.legend.palette)))];
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = palettes.length * 16;
  const context = canvas.getContext('2d');
  palettes.forEach((palette, row) => {
    const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
    palette.forEach((color, index) => gradient.addColorStop(index / (palette.length - 1), color.getStyle()));
    context.fillStyle = gradient; context.fillRect(0, row * 16, canvas.width, 16);
  });
  return context.getImageData(0, 0, canvas.width, canvas.height).data.buffer;
}

async function renderAnimation(root, viewer, animation, status, signal) {
  const original = viewer.screenshot();
  const colors = Object.fromEntries(['bg', 'surface', 'ink', 'muted', 'line'].map(key => [key, getComputedStyle(root).getPropertyValue(`--${key}`).trim()]));
  const controls = [...root.querySelectorAll('button:not([data-viewer-export]),input,select')].map(node => [node, node.disabled]);
  const views = viewer.views.map(view => [view.holder, view.holder.inert]);
  const lock = () => controls.forEach(([node]) => { node.disabled = true; });
  let worker;
  viewer.exporting = true;
  animation.pause();
  views.forEach(([node]) => { node.inert = true; });
  lock();
  try {
    worker = gifWorker(signal);
    const ramps = colorRampPixels(original);
    for (let frame = 0; frame < animation.frameCount; frame++) {
      signal.throwIfAborted();
      if (root.dataset.state !== 'ready') throw new Error('Viewer is no longer ready');
      status.textContent = `Preparing GIF… ${frame + 1} / ${animation.frameCount}`;
      animation.seek(frame); lock();
      const snapshot = { ...viewer.screenshot(), groupColumns: original.groupColumns };
      const canvas = renderScreenshot(root, snapshot, { maxDimension: 1600, colors });
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer;
      await worker.send({ type: 'frame', first: frame === 0, pixels, width: canvas.width, height: canvas.height, delay: animation.delay, ramps: frame === 0 ? ramps : undefined }, frame === 0 ? [pixels, ramps] : [pixels]);
    }
    const result = await worker.send({ type: 'finish' });
    return { blob: new Blob([result.bytes], { type: 'image/gif' }), filename: `${original.filename.replace(/-t\d+$/, '')}-cycle` };
  } finally {
    worker?.dispose();
    viewer.exporting = false;
    views.forEach(([node, inert]) => { node.inert = inert; });
    if (!viewer.disposed) {
      controls.forEach(([node, disabled]) => { node.disabled = disabled; });
      if (root.dataset.state === 'ready') animation.restore();
      viewer.resize(); viewer.setTheme();
    }
  }
}

export function bindViewerExport(root, viewer, signal) {
  const button = root.querySelector('[data-viewer-export]');
  const status = root.querySelector('[data-viewer-export-status]');
  const icon = button.querySelector('path'), downloadIcon = icon.getAttribute('d');
  let busy = false;
  let job;
  const sync = () => {
    const animated = Boolean(viewer.exportAnimation());
    button.disabled = (busy && !job) || signal.aborted || root.dataset.state !== 'ready';
    button.setAttribute('aria-busy', String(busy));
    button.title = job ? 'Cancel GIF export' : animated ? 'Download GIF' : 'Download PNG';
    button.setAttribute('aria-label', job ? 'Cancel GIF export' : animated ? 'Download heart cycle as GIF' : 'Download visualization as PNG');
    icon.setAttribute('d', job ? 'M6 6l12 12M18 6 6 18' : downloadIcon);
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['data-state'] });
  signal.addEventListener('abort', () => { job?.abort(); observer.disconnect(); sync(); }, { once: true });
  button.addEventListener('click', async () => {
    if (job) { job.abort(); return; }
    if (busy || signal.aborted || root.dataset.state !== 'ready') return;
    const animation = viewer.exportAnimation(), extension = animation ? 'gif' : 'png';
    busy = true;
    if (animation) job = new AbortController();
    sync(); status.hidden = !animation;
    try {
      let blob, filename;
      if (animation) {
        ({ blob, filename } = await renderAnimation(root, viewer, animation, status, job.signal));
        job.signal.throwIfAborted();
      } else {
        const captured = viewer.screenshot(); filename = captured.filename;
        const canvas = renderScreenshot(root, captured);
        blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'));
      }
      if (signal.aborted) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url;
      link.download = `${filename.replace(/[^a-zA-Z0-9_-]+/g, '-')}.${extension}`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.hidden = true;
    } catch (error) {
      if (!signal.aborted) {
        status.textContent = error.name === 'AbortError' ? 'GIF export cancelled.' : `The ${extension.toUpperCase()} could not be downloaded. Please try again.`;
        status.hidden = false;
      }
    } finally { busy = false; job = null; sync(); }
  }, { signal });
  sync();
}
