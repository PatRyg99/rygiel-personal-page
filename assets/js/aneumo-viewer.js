import { decodeGeometry, decodeTimeSeries } from './aneumo-codec.js';
import * as THREE from './vendor/three/three.module.min.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

import { SPEED_COLORS, ERROR_COLORS } from './viewer-palettes.js';

const number = value => value === 0 ? '0' : Number(value.toPrecision(3)).toString();
const colourRange = (range, fraction) => {
  const requested = Number(fraction);
  const cap = Number.isFinite(requested) && requested > 0 && requested <= 1 ? requested : 1;
  return [range[0], range[0] + (range[1] - range[0]) * cap];
};

export { decodeGeometry, decodeTimeSeries } from './aneumo-codec.js';

function coloredGeometry(packet, field, range, palette, existing) {
  const values = packet.fields.get(field);
  if (!values) throw new Error(`Missing field: ${field}`);
  const geometry = existing || new THREE.BufferGeometry();
  if (!existing) {
    geometry.setAttribute('position', new THREE.BufferAttribute(packet.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(packet.indices, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(packet.vertices * 3), 3));
  }
  const colors = geometry.getAttribute('color').array;
  const color = new THREE.Color();
  values.forEach((value, index) => {
    const fraction = THREE.MathUtils.clamp((value - range[0]) / (range[1] - range[0] || 1), 0, 1) * (palette.length - 1);
    const low = Math.min(Math.floor(fraction), palette.length - 2);
    color.copy(palette[low]).lerp(palette[low + 1], fraction - low);
    color.toArray(colors, index * 3);
  });
  geometry.getAttribute('color').needsUpdate = true;
  return geometry;
}

export async function createViewer(root) {
  const manifestURL = new URL(root.dataset.manifest, location.href);
  const [response, metricsResponse] = await Promise.all([
    fetch(manifestURL), fetch(new URL(root.dataset.metrics, location.href)),
  ]);
  if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
  if (!metricsResponse.ok) throw new Error(`Error metrics HTTP ${metricsResponse.status}`);
  const [manifest, metrics] = await Promise.all([response.json(), metricsResponse.json()]);
  if (![1, 2].includes(manifest.formatVersion) || manifest.units !== 'cm/s' || !manifest.datasets?.length || !manifest.samples?.length || !manifest.models?.length) throw new Error('Unsupported demo data');
  if (metrics.version !== 4 || metrics.definition !== '100 * norm(GT - prediction) / norm(GT)' || metrics.zeroReferencePolicy !== 'include zero-GT prediction errors' || !metrics.samples) throw new Error('Unsupported error metrics');
  return new AneumoViewer(root, manifest, manifestURL, metrics);
}

class AneumoViewer {
  constructor(root, manifest, manifestURL, metrics) {
    this.root = root;
    this.manifest = manifest;
    this.manifestURL = manifestURL;
    this.metrics = metrics;
    this.views = [];
    this.cache = new Map();
    this.colourMaxima = new Map();
    this.cacheBytes = 0;
    this.timeStep = 0;
    this.playing = false;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.listeners = new AbortController();
    this.generation = 0;
    this.frame = 0;
    this.disposed = false;
    this.status = root.querySelector('[data-demo-status]');
    this.interface = root.querySelector('[data-demo-interface]');
    this.datasetSelect = root.querySelector('[data-demo-dataset]');
    this.sampleSelect = root.querySelector('[data-demo-sample]');
    this.modelSelect = root.querySelector('[data-demo-model]');
    this.axisSelect = root.querySelector('[data-demo-axis]');
    this.depth = root.querySelector('[data-demo-depth]');
    this.depthLabel = root.querySelector('[data-demo-depth-label]');
    this.timeControls = root.querySelector('[data-demo-time-controls]');
    this.timeInput = root.querySelector('[data-demo-time]');
    this.timeLabel = root.querySelector('[data-demo-time-label]');
    this.playButton = root.querySelector('[data-demo-play]');
    this.speedSelect = root.querySelector('[data-demo-speed]');
    this.colourControls = [...root.querySelectorAll('[data-demo-colour-controls]')];
    this.colourInputs = [...root.querySelectorAll('[data-demo-colour-max]')];
    this.colourSliders = [...root.querySelectorAll('[data-demo-colour-slider]')];
    this.datasetSelect.replaceChildren(...manifest.datasets.map(dataset => new Option(dataset.label, dataset.id)));
    this.datasetSelect.value = manifest.datasets.some(dataset => dataset.id === root.dataset.defaultDataset) ? root.dataset.defaultDataset : manifest.datasets[0].id;
    this.setSampleOptions();
    this.modelSelect.replaceChildren(...manifest.models.map(model => new Option(model.label, model.id)));
    this.modelSelect.value = 'AB-GATr';
    this.setSliceControls();
    this.interface.hidden = false;
    try {
      for (const holder of root.querySelectorAll('[data-demo-view]')) this.createView(holder);
    } catch (error) {
      this.dispose();
      error.userMessage = 'The 3D viewer needs WebGL 2. Try a recent browser with hardware acceleration enabled. The paper’s figures remain available above.';
      throw error;
    }
    this.bindControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.views.forEach(view => this.resizeObserver.observe(view.holder));
    this.themeObserver = new MutationObserver(() => this.setTheme());
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.setTheme();
  }

  createView(holder) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${holder.dataset.demoView === 'gt' ? 'CFD ground truth' : holder.dataset.demoView} velocity view. Drag to rotate and scroll to zoom.`);
    canvas.setAttribute('aria-describedby', 'aneumo-controls-help');
    holder.replaceChildren(canvas);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(3, 5, 4);
    scene.add(light);
    const camera = new THREE.PerspectiveCamera(34, 1, .01, 100);
    camera.position.set(0, 0, 5);
    const wallMaterial = new THREE.MeshPhongMaterial({ color: '#abbab8', transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, shininess: 20 });
    const fieldMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const view = { holder, renderer, scene, camera, controls: null, wallMaterial, fieldMaterial, wall: null, slice: null };
    this.views.push(view);
    this.configureControls(view);
    canvas.addEventListener('keydown', event => this.onKey(event, view), { signal: this.listeners.signal });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.showError(new Error('The graphics context was lost. Try loading the viewer again.'));
    }, { signal: this.listeners.signal });
  }

  configureControls(view) {
    view.controls?.dispose();
    view.controls = new OrbitControls(view.camera, view.renderer.domElement);
    view.controls.enableDamping = false;
    view.controls.minDistance = .25;
    view.controls.maxDistance = 25;
    view.controls.zoomSpeed = .8;
    view.controls.addEventListener('change', () => this.syncCameras(view));
  }

  bindControls() {
    const on = (node, event, action) => node.addEventListener(event, action, { signal: this.listeners.signal });
    on(this.datasetSelect, 'change', () => {
      this.setSampleOptions();
      this.setSliceControls();
      this.load(true).catch(error => this.showError(error));
    });
    on(this.sampleSelect, 'change', () => {
      this.sample = this.manifest.samples.find(sample => sample.id === this.sampleSelect.value);
      this.setSliceControls();
      this.load(true).catch(error => this.showError(error));
    });
    on(this.modelSelect, 'change', () => {
      if (this.sample.timeSteps) { this.load(false).catch(error => this.showError(error)); return; }
      if (this.packet && this.root.dataset.state === 'ready') { this.updateFields(); this.describe(); }
    });
    on(this.axisSelect, 'change', () => {
      this.setDepth(Number(this.depth.value));
      this.load(true).catch(error => this.showError(error));
    });
    on(this.depth, 'input', () => {
      clearTimeout(this.playbackTimer);
      const previous = Number(this.loadedDepth ?? this.depth.value);
      this.setDepth(Number(this.depth.value), previous);
      clearTimeout(this.sliceTimer);
      this.sliceTimer = setTimeout(() => this.load(false).catch(error => this.showError(error)), 100);
    });
    on(this.playButton, 'click', () => this.setPlaying(!this.playing));
    on(this.timeInput, 'input', () => {
      const timeStep = Number(this.timeInput.value);
      this.setPlaying(false);
      this.timeStep = timeStep;
      if (this.packet && this.root.dataset.state === 'ready') this.updateFields();
      this.syncTimeControls();
    });
    on(this.speedSelect, 'change', () => this.schedulePlayback());
    this.colourInputs.forEach(input => on(input, 'input', () => {
      if (this.root.dataset.state !== 'ready') return;
      const maximum = input.valueAsNumber;
      const valid = Number.isFinite(maximum) && maximum > 0;
      input.setCustomValidity(valid ? '' : 'Enter a maximum greater than 0 cm/s.');
      input.setAttribute('aria-invalid', String(!valid));
      input.closest('fieldset').querySelector('[data-demo-colour-validation]').textContent = valid ? '' : 'Enter a maximum greater than 0 cm/s.';
      if (!valid) return;
      const maxima = this.colourMaxima.get(this.loadedSample.id) || {};
      this.colourMaxima.set(this.loadedSample.id, { ...maxima, [input.dataset.demoColourMax]: maximum });
      this.syncColourSlider(input.dataset.demoColourMax, maximum);
      this.updateFields();
    }));
    this.colourSliders.forEach(slider => on(slider, 'input', () => {
      const input = this.colourInputs.find(node => node.dataset.demoColourMax === slider.dataset.demoColourSlider);
      input.value = Number(Number(slider.value).toPrecision(3));
      input.dispatchEvent(new Event('input'));
    }));
    this.root.querySelectorAll('[data-demo-colour-reset]').forEach(button => on(button, 'click', () => {
      if (this.root.dataset.state !== 'ready') return;
      const maxima = this.colourMaxima.get(this.loadedSample.id);
      if (maxima) delete maxima[button.dataset.demoColourReset];
      this.syncColourControls();
      this.updateFields();
    }));
    on(document, 'visibilitychange', () => this.schedulePlayback());
    on(this.reducedMotion, 'change', event => { if (event.matches) this.setPlaying(false); });
    on(this.root.querySelector('[data-demo-wall]'), 'change', event => {
      this.views.forEach(view => { if (view.wall) view.wall.visible = event.target.checked; });
      this.requestRender();
    });
    on(this.root.querySelector('[data-demo-reset]'), 'click', () => this.resetView());
    this.root.querySelectorAll('[data-demo-zoom]').forEach(button => on(button, 'click', () => this.zoom(this.views[0], button.dataset.demoZoom === 'in' ? .82 : 1.22)));
    const expand = this.root.querySelector('[data-demo-expand]');
    if (this.root.requestFullscreen && document.fullscreenEnabled) {
      expand.hidden = false;
      on(expand, 'click', async () => {
        try {
          if (document.fullscreenElement === this.root) await document.exitFullscreen();
          else await this.root.requestFullscreen();
        } catch (_) { this.status.textContent = 'Fullscreen is unavailable in this browser window.'; }
      });
      on(document, 'fullscreenchange', () => { expand.textContent = document.fullscreenElement === this.root ? 'Exit fullscreen' : 'Fullscreen'; this.resize(); });
    }
  }

  setSampleOptions() {
    const samples = this.manifest.samples.filter(sample => sample.dataset === this.datasetSelect.value);
    if (!samples.length) throw new Error('No samples for this dataset');
    this.sampleSelect.replaceChildren(...samples.map(sample => new Option(sample.label || sample.id, sample.id)));
    this.sample = samples.find(sample => sample.id === this.root.dataset.defaultSample) || samples[0];
    this.sampleSelect.value = this.sample.id;
  }

  sampleLabel(sample) {
    const dataset = this.manifest.datasets.find(dataset => dataset.id === sample.dataset);
    return `${dataset.label} · Sample ${sample.label || sample.id}`;
  }

  setSliceControls() {
    clearTimeout(this.playbackTimer);
    this.timeStep = 0;
    this.playing = Boolean(this.sample.timeSteps && !this.reducedMotion.matches);
    this.syncTimeControls();
    const preferred = this.sample.id === this.root.dataset.defaultSample;
    const preferredAxis = this.root.dataset.defaultAxis;
    this.axisSelect.value = preferred && this.sample.slices[preferredAxis]?.some(Boolean) ? preferredAxis : this.sample.defaultAxis;
    [...this.axisSelect.options].forEach(option => { option.disabled = !this.sample.slices[option.value]?.some(Boolean); });
    this.depth.min = 0;
    this.depth.max = this.manifest.fractions.length - 1;
    const preferredDepth = preferred ? this.manifest.fractions.indexOf(Number(this.root.dataset.defaultDepth)) : -1;
    this.setDepth(preferredDepth >= 0 ? preferredDepth : this.sample.defaultSlice);
  }

  setDepth(value, previous = value) {
    const slices = this.sample.slices[this.axisSelect.value];
    const valid = slices.map((path, index) => path ? index : -1).filter(index => index >= 0);
    if (!valid.length) throw new Error('No valid slices for this direction');
    const direction = value >= previous ? 1 : -1;
    valid.sort((a, b) => Math.abs(a - value) - Math.abs(b - value) || (b - a) * direction);
    const index = valid[0];
    this.depth.value = index;
    this.depthLabel.textContent = `${Math.round(this.manifest.fractions[index] * 100)}%`;
    this.depth.setAttribute('aria-valuetext', `${this.depthLabel.textContent} along ${this.axisSelect.value.toUpperCase()}`);
  }

  syncTimeControls() {
    const count = this.sample.timeSteps || 1;
    this.timeControls.hidden = count === 1;
    this.timeInput.max = count - 1;
    this.timeInput.value = this.timeStep;
    this.timeLabel.textContent = `Time step ${this.timeStep + 1} / ${count}`;
    this.timeInput.setAttribute('aria-valuetext', this.timeLabel.textContent);
    this.playButton.title = this.playing ? 'Pause' : 'Play';
    this.playButton.setAttribute('aria-pressed', String(this.playing));
    this.playButton.setAttribute('aria-label', this.playing ? 'Pause heart-cycle playback' : 'Play heart cycle in a loop');
    this.playButton.disabled = this.timeInput.disabled = this.root.dataset.state !== 'ready';
    this.root.dataset.playing = String(this.playing);
  }

  setPlaying(playing) {
    this.playing = Boolean(playing && this.sample.timeSteps);
    this.syncTimeControls();
    this.schedulePlayback();
  }

  schedulePlayback() {
    clearTimeout(this.playbackTimer);
    if (!this.playing || this.disposed || document.hidden || this.root.dataset.state !== 'ready') return;
    // Playback pacing is for presentation; the source contains frame indices, not times in seconds.
    this.playbackTimer = setTimeout(() => {
      this.timeStep = (this.timeStep + 1) % this.loadedSample.timeSteps;
      this.updateFields();
      this.syncTimeControls();
      this.schedulePlayback();
    }, 170 / Number(this.speedSelect.value));
  }

  async asset(path, signal, decode) {
    if (this.cache.has(path)) {
      const cached = this.cache.get(path);
      this.cache.delete(path);
      this.cache.set(path, cached);
      return cached.packet;
    }
    const response = await fetch(new URL(path, this.manifestURL), { signal });
    if (!response.ok) throw new Error(`Geometry HTTP ${response.status}`);
    let buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Please use a recent browser to open the compressed geometry.');
      buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const packet = decode(buffer);
    const retainedBytes = packet.values ? packet.values.byteLength : buffer.byteLength;
    this.cache.set(path, { packet, bytes: retainedBytes });
    this.cacheBytes += retainedBytes;
    while (this.cacheBytes > 64 * 1024 * 1024 && this.cache.size > 1) {
      const oldest = this.cache.keys().next().value;
      this.cacheBytes -= this.cache.get(oldest).bytes;
      this.cache.delete(oldest);
    }
    return packet;
  }

  geometry(path, signal) { return this.asset(path, signal, buffer => decodeGeometry(buffer, this.manifest.fieldOrder)); }

  async load(reset = true) {
    clearTimeout(this.sliceTimer);
    clearTimeout(this.playbackTimer);
    const generation = ++this.generation;
    this.fetchController?.abort();
    const controller = new AbortController();
    this.fetchController = controller;
    const sample = this.sample, axis = this.axisSelect.value, depth = Number(this.depth.value);
    const model = this.manifest.models.find(model => model.id === this.modelSelect.value);
    this.root.dataset.state = 'loading';
    this.colourControls.forEach(controls => { controls.disabled = true; });
    this.syncTimeControls();
    this.interface.setAttribute('aria-busy', 'true');
    this.status.textContent = `Loading ${this.sampleLabel(sample)}, ${axis.toUpperCase()} slice at ${Math.round(this.manifest.fractions[depth] * 100)}%…`;
    try {
      if (sample.timeSteps && !['xor-float32-v1', 'uint16-delta-v1'].includes(sample.seriesEncoding)) throw new Error('Unsupported time-series encoding');
      const series = sample.timeSteps ? sample.series[axis][depth] : null;
      const [shell, slice, gtSeries, modelSeries] = await Promise.all([
        this.geometry(sample.shell, controller.signal), this.geometry(sample.slices[axis][depth], controller.signal),
        series ? this.asset(series.gt, controller.signal, decodeTimeSeries) : null,
        series ? this.asset(series.models[model.id], controller.signal, decodeTimeSeries) : null,
      ]);
      if (generation !== this.generation || this.disposed) return;
      if (series && (!gtSeries || !modelSeries || gtSeries.vertices !== slice.vertices || modelSeries.vertices !== slice.vertices || gtSeries.frameCount !== sample.timeSteps || modelSeries.frameCount !== sample.timeSteps || gtSeries.fieldCount !== 1 || modelSeries.fieldCount !== 2)) throw new Error('Time series does not match the slice');
      this.packet = slice;
      this.gtSeries = gtSeries;
      this.modelSeries = modelSeries;
      this.loadedModel = model;
      this.loadedDepth = depth;
      this.loadedAxis = axis;
      this.loadedSample = sample;
      this.syncColourControls();
      if (this.wallSample !== sample.id) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(shell.positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(shell.indices, 1));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        this.radius = geometry.boundingSphere.radius;
        this.views.forEach(view => {
          if (view.wall) view.scene.remove(view.wall);
          view.wall = new THREE.Mesh(geometry, view.wallMaterial);
          view.wall.visible = this.root.querySelector('[data-demo-wall]').checked;
          view.scene.add(view.wall);
        });
        this.wallGeometry?.dispose();
        this.wallGeometry = geometry;
        this.wallSample = sample.id;
      }
      this.updateFields();
      this.interface.hidden = false;
      this.root.querySelector('[data-demo-panels]').hidden = false;
      this.resize();
      if (reset) this.resetView();
      this.root.dataset.state = 'ready';
      this.colourControls.forEach(controls => { controls.disabled = false; });
      this.interface.setAttribute('aria-busy', 'false');
      this.syncTimeControls();
      this.describe();
      this.requestRender();
      this.schedulePlayback();
    } catch (error) {
      if (error.name === 'AbortError' || generation !== this.generation) return;
      throw error;
    }
  }

  colourRanges() {
    const caps = this.root.dataset;
    const ranges = {
      velocity: colourRange(this.loadedSample.velocityRange, caps.velocityMaxFraction),
      error: colourRange(this.loadedSample.errorRange, caps.errorMaxFraction),
    };
    const defaults = this.loadedSample.dataset === 'aaa-100'
      ? { velocity: Number(caps.aaaVelocityMax), error: Number(caps.aaaErrorMax) } : {};
    // Display limits belong to the sample, independent of model, slice and time.
    const maxima = this.colourMaxima.get(this.loadedSample.id);
    for (const field of ['velocity', 'error']) {
      const maximum = maxima?.[field] ?? defaults[field];
      if (Number.isFinite(maximum) && maximum > 0) ranges[field][1] = maximum;
    }
    return ranges;
  }

  syncColourControls() {
    const ranges = this.colourRanges();
    this.colourInputs.forEach(input => {
      const field = input.dataset.demoColourMax;
      const maximum = ranges[field][1];
      input.value = Number(maximum.toPrecision(6));
      input.setCustomValidity('');
      input.removeAttribute('aria-invalid');
      input.closest('fieldset').querySelector('[data-demo-colour-validation]').textContent = '';
      this.syncColourSlider(field, maximum, true);
    });
  }

  syncColourSlider(field, maximum, reset = false) {
    const slider = this.colourSliders.find(node => node.dataset.demoColourSlider === field);
    const extent = Math.max(this.loadedSample[`${field}Range`][1], maximum);
    const step = 10 ** (Math.floor(Math.log10(extent)) - 2);
    const upper = Math.ceil(extent / step / 10) * step * 10;
    slider.min = Math.min(step, maximum);
    slider.step = 'any';
    slider.max = Math.max(Number.isFinite(upper) ? upper : extent, reset ? 0 : Number(slider.max));
    slider.value = maximum;
    slider.setAttribute('aria-valuetext', `${number(maximum)} cm/s`);
  }

  updateFields() {
    const model = this.loadedSample.timeSteps ? this.loadedModel : this.manifest.models.find(model => model.id === this.modelSelect.value);
    const fields = ['GT', model.id, model.errorField];
    const { velocity: velocityRange, error: errorRange } = this.colourRanges();
    if (this.loadedSample.timeSteps) {
      const values = (series, field) => {
        const start = (this.timeStep * series.fieldCount + field) * series.vertices;
        return series.values.subarray(start, start + series.vertices);
      };
      this.packet = { ...this.packet, fields: new Map([
        ['GT', values(this.gtSeries, 0)], [model.id, values(this.modelSeries, 0)], [model.errorField, values(this.modelSeries, 1)],
      ]) };
    }
    this.views.forEach((view, index) => {
      const sameGeometry = view.slice?.geometry.getAttribute('position').array === this.packet.positions;
      if (view.slice && !sameGeometry) { view.scene.remove(view.slice); view.slice.geometry.dispose(); view.slice = null; }
      const geometry = coloredGeometry(this.packet, fields[index], index === 2 ? errorRange : velocityRange, index === 2 ? ERROR_COLORS : SPEED_COLORS, view.slice?.geometry);
      if (!view.slice) { view.slice = new THREE.Mesh(geometry, view.fieldMaterial); view.scene.add(view.slice); }
      view.renderer.domElement.dataset.field = fields[index];
      if (this.loadedSample.timeSteps) view.renderer.domElement.dataset.timeStep = this.timeStep;
      else delete view.renderer.domElement.dataset.timeStep;
    });
    const rotated = model.id.endsWith('-180');
    const label = model.label.replace(/\s*\(rotation-trained\)/i, '');
    this.root.querySelector('[data-demo-prediction-title]').textContent = label;
    this.root.querySelector('[data-demo-prediction-subtitle]').textContent = rotated ? 'Prediction · rotation-trained' : 'Prediction';
    this.root.querySelector('[data-demo-error-subtitle]').textContent = `${label}${rotated ? ' (rot.)' : ''} vs CFD`;
    this.updateErrorMetrics(model);
    const ticks = (selector, range, clipped) => this.root.querySelectorAll(selector).forEach(node => {
      node.replaceChildren(...[range[0], (range[0] + range[1]) / 2, range[1]].map((value, index) => { const tick = document.createElement('span'); tick.textContent = `${clipped && index === 2 ? '≥' : ''}${number(value)}`; return tick; }));
    });
    ticks('[data-demo-velocity-ticks]', velocityRange, velocityRange[1] < this.loadedSample.velocityRange[1]);
    ticks('[data-demo-error-ticks]', errorRange, errorRange[1] < this.loadedSample.errorRange[1]);
    this.requestRender();
  }

  updateErrorMetrics(model) {
    const sample = this.loadedSample;
    const metrics = this.metrics.samples[sample.id];
    const current = metrics?.sourceSha256 === sample.source.sha256 && metrics.frameCount === (sample.timeSteps || 1);
    const record = current ? metrics.models?.[model.id] : null;
    const temporal = sample.timeSteps > 1;
    const frame = temporal ? this.timeStep : 0;
    const slice = record?.slices?.[this.loadedAxis]?.[this.loadedDepth]?.[frame];
    const volume = record?.volumeRelativeL2;
    for (const [scope, value] of [['slice', slice], ['volume', volume]]) {
      const node = this.root.querySelector(`[data-demo-${scope}-relative-error]`);
      const available = Number.isFinite(value) && value >= 0;
      node.textContent = available ? `${value.toFixed(2)}%` : '—';
      node.dataset.value = available ? String(value) : '';
      const domain = temporal
        ? scope === 'slice' ? `slice vertices at timestep ${frame + 1} of ${sample.timeSteps}` : `volume vertices across ${sample.timeSteps} timesteps`
        : `${scope} vertices`;
      node.title = available
        ? `100 × ‖CFD − prediction‖₂ / ‖CFD‖₂. Both norms include all vector components of ${domain}, from the original VTU vectors. Prediction errors at zero-GT points are included.`
        : 'No valid relative error is available for this selection.';
    }
  }

  describe() {
    const model = this.manifest.models.find(model => model.id === this.modelSelect.value);
    this.status.textContent = `${this.sampleLabel(this.loadedSample)} · ${model.label} · ${this.loadedAxis.toUpperCase()} slice at ${Math.round(this.manifest.fractions[this.loadedDepth] * 100)}%`;
  }

  syncCameras(source) {
    if (this.syncing || this.disposed) return;
    this.syncing = true;
    this.views.forEach(view => {
      if (view === source) return;
      view.camera.position.copy(source.camera.position);
      view.camera.quaternion.copy(source.camera.quaternion);
      view.camera.up.copy(source.camera.up);
      view.camera.zoom = source.camera.zoom;
      view.controls.target.copy(source.controls.target);
      view.camera.updateProjectionMatrix();
      view.controls.update();
    });
    this.syncing = false;
    this.requestRender();
  }

  resetView() {
    if (!this.views.length) return;
    const direction = this.axisSelect.value;
    const normal = new THREE.Vector3(...(direction === 'x' ? [1, 0, 0] : direction === 'y' ? [0, -1, 0] : [0, 0, 1]));
    const preferredZoom = this.sample.id === this.root.dataset.defaultSample ? Number(this.root.dataset.defaultZoom) : 1;
    const zoom = Number.isFinite(preferredZoom) && preferredZoom > 0 ? preferredZoom : 1;
    const distance = (this.radius || 1.2) / Math.sin(THREE.MathUtils.degToRad(17)) / Math.min(1, this.views[0].camera.aspect) * 1.08 / zoom;
    this.syncing = true;
    this.views.forEach(view => {
      view.camera.position.copy(normal).multiplyScalar(distance);
      view.camera.up.set(0, direction === 'z' ? 1 : 0, direction === 'z' ? 0 : 1);
      view.camera.zoom = 1;
      view.camera.lookAt(0, 0, 0);
      view.camera.updateProjectionMatrix();
      // OrbitControls fixes its up-axis transform at construction time.
      this.configureControls(view);
      view.controls.target.set(0, 0, 0);
      view.controls.update();
    });
    this.syncing = false;
    this.requestRender();
  }

  zoom(view, factor) {
    const offset = view.camera.position.clone().sub(view.controls.target);
    offset.multiplyScalar(factor).clampLength(view.controls.minDistance, view.controls.maxDistance);
    view.camera.position.copy(view.controls.target).add(offset);
    view.controls.update();
    this.syncCameras(view);
  }

  onKey(event, view) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (['+', '=', '-', '_'].includes(event.key)) { event.preventDefault(); this.zoom(view, ['+', '='].includes(event.key) ? .82 : 1.22); return; }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); this.resetView(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const offset = view.camera.position.clone().sub(view.controls.target);
    const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    const axis = vertical ? new THREE.Vector3(1, 0, 0).applyQuaternion(view.camera.quaternion) : view.camera.up.clone().normalize();
    const angle = (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? 1 : -1) * Math.PI / 18;
    offset.applyAxisAngle(axis, angle);
    view.camera.position.copy(view.controls.target).add(offset);
    view.controls.update();
    this.syncCameras(view);
  }

  resize() {
    if (this.disposed) return;
    this.views.forEach(view => {
      const width = Math.max(1, view.holder.clientWidth), height = Math.max(1, view.holder.clientHeight);
      view.renderer.setSize(width, height, false);
      view.camera.aspect = width / height;
      view.camera.updateProjectionMatrix();
    });
    this.requestRender();
  }

  setTheme() {
    const background = getComputedStyle(this.root).getPropertyValue('--bg').trim();
    const dark = document.documentElement.dataset.theme === 'dark';
    this.views.forEach(view => { view.renderer.setClearColor(background, 1); view.wallMaterial.color.set(dark ? '#9cbbb7' : '#8daba5'); });
    this.requestRender();
  }

  requestRender() {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.views.forEach(view => view.renderer.render(view.scene, view.camera));
    });
  }

  showError(error) {
    if (error.name === 'AbortError' || this.disposed) return;
    this.setPlaying(false);
    this.root.dataset.state = 'error';
    this.syncTimeControls();
    this.interface.setAttribute('aria-busy', 'false');
    this.root.querySelector('[data-demo-panels]').hidden = true;
    this.status.textContent = error.userMessage || 'This slice could not be loaded. Choose another slice or try loading the viewer again.';
    const retry = this.root.querySelector('[data-demo-start]');
    retry.textContent = 'Try loading again';
    retry.hidden = false;
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.playbackTimer);
    this.fetchController?.abort();
    this.listeners.abort();
    clearTimeout(this.sliceTimer);
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.themeObserver?.disconnect();
    this.views.forEach(view => {
      view.controls.dispose();
      view.slice?.geometry.dispose();
      view.wallMaterial.dispose();
      view.fieldMaterial.dispose();
      view.renderer.dispose();
      view.renderer.forceContextLoss();
      view.holder.replaceChildren();
    });
    this.wallGeometry?.dispose();
    this.cache.clear();
    this.interface.hidden = true;
  }
}
