import * as THREE from './vendor/three/three.module.min.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

// Cool to Warm (Extended), Francesca Samsel; sampled in CIELAB at 257 positions.
// Source: https://github.com/Kitware/ParaView/blob/v5.13.3/Remoting/Views/ColorMaps.json
const SPEED_COLORS = (
  '#000059 #01025a #02045b #03065c #05085d #060a5e #070c5f #090e60 #0a1061 #0b1262 #0c1463 #0d1564 #0d1765 #0e1966 #0f1b67 #0f1c68 ' +
  '#101e69 #11206a #12226b #13246d #14276e #15296f #162b70 #162d72 #172f73 #183175 #1a3476 #1b3678 #1c3979 #1d3b7b #1e3e7d #1f407e ' +
  '#204380 #214581 #234883 #244a84 #254c85 #264f86 #275188 #285489 #29568a #2a588b #2c5a8c #2d5c8d #2e5d8e #2f5f8e #31618f #326390 ' +
  '#336591 #346792 #366993 #376b94 #386c95 #396e96 #3b7097 #3c7298 #3d7499 #3f769b #40789c #427a9e #437c9f #457fa1 #4681a3 #4883a4 ' +
  '#4985a6 #4b87a8 #4c89a9 #4e8cab #508eac #5190ae #5392b0 #5495b1 #5697b3 #5899b4 #599bb6 #5b9db7 #5d9fb9 #5ea1ba #60a3bc #61a5bd ' +
  '#63a7bf #66aac1 #68acc3 #6bafc6 #6db1c8 #70b4ca #72b7cc #75b9cf #77bcd1 #7abfd3 #7ec1d5 #81c4d7 #85c6d8 #88c9da #8bccdc #8fcede ' +
  '#92d1e0 #95d2e1 #97d4e2 #9ad5e3 #9dd7e4 #9fd8e5 #a2dae6 #a4dbe7 #a7dde8 #aadfe9 #ade0ea #b0e2eb #b4e3ec #b7e5ed #bae7ee #bde8ef ' +
  '#c0eaf0 #c2ebf1 #c5ecf2 #c7eef3 #c9eff3 #cbf0f4 #cef1f5 #d0f3f6 #d2f4f7 #d6f5f8 #daf6f8 #ddf7f9 #e1f8fa #e5f8fa #e9f9fb #ecfafb ' +
  '#f0fbfc #f3f9f5 #f5f7ee #f8f5e7 #faf3e1 #fcf1da #fcefd6 #fbedd3 #fbeacf #fbe8cc #fae6c9 #fae3c5 #f9e0c1 #f9ddbd #f8dbba #f8d8b6 ' +
  '#f7d5b2 #f6d2ae #f6ceab #f5cba7 #f5c8a4 #f4c5a0 #f3c19d #f3be99 #f2bb96 #f1b893 #f1b691 #f0b38e #f0b18c #efae89 #eeab87 #eea984 ' +
  '#eda682 #eca380 #eca17d #eb9e7b #eb9b78 #ea9876 #e99674 #e99371 #e8906f #e78d6c #e6896a #e58667 #e48364 #e37f62 #e27c5f #e1785d ' +
  '#e0755a #df7358 #de7156 #dc6e54 #db6c51 #da6a4f #d9684d #d7654b #d66349 #d46047 #d15d44 #cf5a42 #cc573f #ca543d #c7513b #c54e38 ' +
  '#c24b36 #c04835 #be4633 #bc4332 #bb4130 #b93e2f #b73b2e #b5392c #b3362b #b1342a #b03328 #ae3127 #ac2f26 #ab2d25 #a92c23 #a82a22 ' +
  '#a62821 #a42620 #a3241f #a1221e #9f201c #9e1e1b #9c1c1a #9b1a19 #991818 #971718 #961618 #941518 #921519 #911419 #8f1319 #8e1219 ' +
  '#8c1119 #8b111a #89101b #880f1c #860f1d #850e1e #830e1e #820e1f #800d20 #7e0d22 #7d0d23 #7b0d25 #7a0e26 #780e28 #760e29 #750e2b ' +
  '#730e2c #710e2d #700e2d #6e0e2e #6d0e2f #6b0e2f #690e30 #680e30 #660e31 #640f32 #630f32 #611033 #601034 #5e1134 #5c1135 #5b1235 ' +
  '#591236'
).split(' ').map(color => new THREE.Color(color));
// Turbo, Anton Mikhailov; the 256 RGB samples from the ParaView preset.
// Source: https://github.com/Kitware/ParaView/blob/v5.13.3/Remoting/Views/ColorMaps.json
const ERROR_COLORS = (
  '#30123b #321543 #33184a #341b51 #351e58 #36215f #372466 #38276d #392a73 #3a2d79 #3b2f80 #3c3286 #3d358b #3e3891 #3f3b97 #3f3e9c ' +
  '#4040a2 #4143a7 #4146ac #4249b1 #424bb5 #434eba #4451bf #4454c3 #4456c7 #4559cb #455ccf #455ed3 #4661d6 #4664da #4666dd #4669e0 ' +
  '#466be3 #476ee6 #4771e9 #4773eb #4776ee #4778f0 #477bf2 #467df4 #4680f6 #4682f8 #4685fa #4687fb #458afc #458cfd #448ffe #4391fe ' +
  '#4294ff #4196ff #4099ff #3e9bfe #3d9efe #3ba0fd #3aa3fc #38a5fb #37a8fa #35abf8 #33adf7 #31aff5 #2fb2f4 #2eb4f2 #2cb7f0 #2ab9ee ' +
  '#28bceb #27bee9 #25c0e7 #23c3e4 #22c5e2 #20c7df #1fc9dd #1ecbda #1ccdd8 #1bd0d5 #1ad2d2 #1ad4d0 #19d5cd #18d7ca #18d9c8 #18dbc5 ' +
  '#18ddc2 #18dec0 #18e0bd #19e2bb #19e3b9 #1ae4b6 #1ce6b4 #1de7b2 #1fe9af #20eaac #22ebaa #25eca7 #27eea4 #2aefa1 #2cf09e #2ff19b ' +
  '#32f298 #35f394 #38f491 #3cf58e #3ff68a #43f787 #46f884 #4af880 #4ef97d #52fa7a #55fa76 #59fb73 #5dfc6f #61fc6c #65fd69 #69fd66 ' +
  '#6dfe62 #71fe5f #75fe5c #79fe59 #7dff56 #80ff53 #84ff51 #88ff4e #8bff4b #8fff49 #92ff47 #96fe44 #99fe42 #9cfe40 #9ffd3f #a1fd3d ' +
  '#a4fc3c #a7fc3a #a9fb39 #acfb38 #affa37 #b1f936 #b4f836 #b7f735 #b9f635 #bcf534 #bef434 #c1f334 #c3f134 #c6f034 #c8ef34 #cbed34 ' +
  '#cdec34 #d0ea34 #d2e935 #d4e735 #d7e535 #d9e436 #dbe236 #dde037 #dfdf37 #e1dd37 #e3db38 #e5d938 #e7d739 #e9d539 #ebd339 #ecd13a ' +
  '#eecf3a #efcd3a #f1cb3a #f2c93a #f4c73a #f5c53a #f6c33a #f7c13a #f8be39 #f9bc39 #faba39 #fbb838 #fbb637 #fcb336 #fcb136 #fdae35 ' +
  '#fdac34 #fea933 #fea732 #fea431 #fea130 #fe9e2f #fe9b2d #fe992c #fe962b #fe932a #fe9029 #fd8d27 #fd8a26 #fc8725 #fc8423 #fb8122 ' +
  '#fb7e21 #fa7b1f #f9781e #f9751d #f8721c #f76f1a #f66c19 #f56918 #f46617 #f36315 #f26014 #f15d13 #f05b12 #ef5811 #ed5510 #ec530f ' +
  '#eb500e #ea4e0d #e84b0c #e7490c #e5470b #e4450a #e2430a #e14109 #df3f08 #dd3d08 #dc3b07 #da3907 #d83706 #d63506 #d43305 #d23105 ' +
  '#d02f05 #ce2d04 #cc2b04 #ca2a04 #c82803 #c52603 #c32503 #c12302 #be2102 #bc2002 #b91e02 #b71d02 #b41b01 #b21a01 #af1801 #ac1701 ' +
  '#a91601 #a71401 #a41301 #a11201 #9e1001 #9b0f01 #980e01 #950d01 #920b01 #8e0a01 #8b0902 #880802 #850702 #810602 #7e0502 #7a0403'
).split(' ').map(color => new THREE.Color(color));
const number = value => value === 0 ? '0' : Number(value.toPrecision(3)).toString();

// Prepared files retain a common coordinate frame and a scalar array per source vector field.
export function decodeGeometry(buffer, fieldOrder) {
  const header = new DataView(buffer);
  if (buffer.byteLength < 16 || header.getUint32(0, true) !== 0x414E4531) throw new Error('Invalid geometry header');
  const vertices = header.getUint32(4, true), indexCount = header.getUint32(8, true), fieldCount = header.getUint32(12, true);
  const expected = 16 + vertices * 12 + indexCount * 4 + vertices * fieldCount * 4;
  if (expected !== buffer.byteLength || indexCount % 3 || (fieldCount !== 0 && fieldCount !== fieldOrder.length)) throw new Error('Invalid geometry dimensions');
  const positions = new Float32Array(buffer, 16, vertices * 3);
  const indices = new Uint32Array(buffer, 16 + vertices * 12, indexCount);
  if (!positions.every(Number.isFinite) || !indices.every(index => index < vertices)) throw new Error('Invalid mesh coordinates');
  const fields = new Map();
  let offset = 16 + vertices * 12 + indexCount * 4;
  for (let index = 0; index < fieldCount; index++) {
    const values = new Float32Array(buffer, offset, vertices);
    if (!values.every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid field magnitude');
    fields.set(fieldOrder[index], values);
    offset += vertices * 4;
  }
  return { positions, indices, fields, vertices };
}

// Temporal packets share slice geometry; XOR deltas losslessly encode float32 fields.
export function decodeTimeSeries(buffer) {
  if (buffer.byteLength < 16) throw new Error('Invalid time-series header');
  const header = new DataView(buffer);
  if (header.getUint32(0, true) !== 0x41545331) throw new Error('Invalid time-series header');
  const vertices = header.getUint32(4, true), frameCount = header.getUint32(8, true), fieldCount = header.getUint32(12, true);
  const stride = vertices * fieldCount;
  if (!vertices || frameCount < 2 || ![1, 2].includes(fieldCount) || buffer.byteLength !== 16 + stride * frameCount * 4) throw new Error('Invalid time-series dimensions');
  const bits = new Uint32Array(buffer, 16);
  for (let index = stride; index < bits.length; index++) bits[index] ^= bits[index - stride];
  const values = new Float32Array(buffer, 16);
  if (!values.every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid time-series magnitude');
  return { vertices, frameCount, fieldCount, values };
}

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
  const response = await fetch(manifestURL);
  if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
  const manifest = await response.json();
  if (![1, 2].includes(manifest.formatVersion) || manifest.units !== 'cm/s' || !manifest.datasets?.length || !manifest.samples?.length || !manifest.models?.length) throw new Error('Unsupported demo data');
  return new AneumoViewer(root, manifest, manifestURL);
}

class AneumoViewer {
  constructor(root, manifest, manifestURL) {
    this.root = root;
    this.manifest = manifest;
    this.manifestURL = manifestURL;
    this.views = [];
    this.cache = new Map();
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
    this.sample = samples[0];
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
    this.axisSelect.value = this.sample.defaultAxis;
    [...this.axisSelect.options].forEach(option => { option.disabled = !this.sample.slices[option.value]?.some(Boolean); });
    this.depth.min = 0;
    this.depth.max = this.manifest.fractions.length - 1;
    this.setDepth(this.sample.defaultSlice);
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
    this.cache.set(path, { packet, bytes: buffer.byteLength });
    this.cacheBytes += buffer.byteLength;
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
    this.syncTimeControls();
    this.interface.setAttribute('aria-busy', 'true');
    this.status.textContent = `Loading ${this.sampleLabel(sample)}, ${axis.toUpperCase()} slice at ${Math.round(this.manifest.fractions[depth] * 100)}%…`;
    try {
      if (sample.timeSteps && sample.seriesEncoding !== 'xor-float32-v1') throw new Error('Unsupported time-series encoding');
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

  updateFields() {
    const model = this.loadedSample.timeSteps ? this.loadedModel : this.manifest.models.find(model => model.id === this.modelSelect.value);
    const fields = ['GT', model.id, model.errorField];
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
      const geometry = coloredGeometry(this.packet, fields[index], index === 2 ? this.loadedSample.errorRange : this.loadedSample.velocityRange, index === 2 ? ERROR_COLORS : SPEED_COLORS, view.slice?.geometry);
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
    const ticks = (selector, range) => this.root.querySelectorAll(selector).forEach(node => {
      node.replaceChildren(...[range[0], (range[0] + range[1]) / 2, range[1]].map(value => { const tick = document.createElement('span'); tick.textContent = number(value); return tick; }));
    });
    ticks('[data-demo-velocity-ticks]', this.loadedSample.velocityRange);
    ticks('[data-demo-error-ticks]', this.loadedSample.errorRange);
    this.requestRender();
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
    const distance = (this.radius || 1.2) / Math.sin(THREE.MathUtils.degToRad(17)) / Math.min(1, this.views[0].camera.aspect) * 1.08;
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
