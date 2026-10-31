import * as THREE from './vendor/three/three.module.min.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { SPEED_COLORS, ERROR_COLORS } from './viewer-palettes.js';
import { decodeSurface, decodeVectors, glyphSites } from './wss-codec.js';

const labelNumber = value => value.toFixed(2);
const up = new THREE.Vector3(0, 1, 0);
function colorAt(value, maximum, palette, target) {
  const t = Math.min(1, Math.max(0, value / (maximum || 1))) * (palette.length - 1);
  const i = Math.min(palette.length - 2, Math.floor(t));
  return target.copy(palette[i]).lerp(palette[i + 1], t - i);
}

function arrowGeometry() {
  const shaft = new THREE.CylinderGeometry(.023, .023, .72, 5).toNonIndexed();
  const head = new THREE.ConeGeometry(.085, .28, 5).toNonIndexed();
  shaft.translate(0, .36, 0); head.translate(0, .86, 0);
  const geometry = new THREE.BufferGeometry();
  for (const key of ['position', 'normal']) {
    const a = shaft.getAttribute(key).array, b = head.getAttribute(key).array;
    const data = new Float32Array(a.length + b.length); data.set(a); data.set(b, a.length);
    geometry.setAttribute(key, new THREE.BufferAttribute(data, 3));
  }
  shaft.dispose(); head.dispose();
  return geometry;
}

export async function createViewer(root) {
  const url = new URL(root.dataset.manifest, location.href);
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`WSS manifest HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.version !== 2 || manifest.units !== 'Pa' || manifest.unitScale !== .1 || manifest.model !== 'LaB-GATr' || !manifest.samples?.length || !manifest.challenges?.length) throw new Error('Unsupported WSS data');
  if (manifest.challenges.some(challenge => challenge.cases?.length !== 2 || challenge.cases.some(item => !manifest.samples.some(sample => sample.id === item.sample)) || !['wss', 'error'].every(key => Number.isFinite(challenge.displayRanges?.[key]?.[1]) && challenge.displayRanges[key][1] > 0))) throw new Error('Invalid WSS challenge');
  return new WSSViewer(root, manifest, url);
}

class WSSViewer {
  constructor(root, manifest, url) {
    this.root = root; this.manifest = manifest; this.url = url;
    this.views = []; this.cache = new Map(); this.surfaceCache = new Map(); this.step = 0; this.generation = 0;
    this.colourMaxima = new Map();
    this.listeners = new AbortController(); this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.ui = name => root.querySelector(`[data-wss-${name}]`);
    this.interface = this.ui('interface'); this.status = this.ui('status');
    this.colourControls = [...root.querySelectorAll('[data-wss-colour-controls]')];
    this.colourInputs = [...root.querySelectorAll('[data-wss-colour-max]')];
    this.colourSliders = [...root.querySelectorAll('[data-wss-colour-slider]')];
    const preferred = this.ui('challenge').value || manifest.defaultChallenge;
    this.ui('challenge').replaceChildren(...manifest.challenges.map(challenge => new Option(challenge.label, challenge.id)));
    this.ui('challenge').value = manifest.challenges.some(challenge => challenge.id === preferred) ? preferred : manifest.challenges[0].id;
    this.challenge = manifest.challenges.find(challenge => challenge.id === this.ui('challenge').value);
    this.ui('challenge-controls').hidden = false;
    this.root.querySelectorAll('[data-wss-units]').forEach(node => { node.textContent = manifest.units; });
    this.interface.hidden = false;
    this.ui('camera-controls').hidden = false;
    try { root.querySelectorAll('[data-wss-view]').forEach(holder => this.createView(holder)); }
    catch (error) {
      this.dispose();
      error.userMessage = 'This viewer needs WebGL 2. Try a browser with hardware acceleration enabled.';
      throw error;
    }
    this.arrowGeometry = arrowGeometry();
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.views.forEach(view => this.resizeObserver.observe(view.holder));
    this.themeObserver = new MutationObserver(() => this.setTheme());
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.setTheme();
  }

  createView(holder) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
    const name = holder.dataset.wssView;
    const slot = Number(holder.dataset.wssSlot);
    const sample = this.manifest.samples.find(item => item.id === this.challenge.cases[slot].sample);
    canvas.setAttribute('aria-describedby', 'wss-controls-help');
    holder.replaceChildren(canvas);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x737e84, 2));
    const light = new THREE.DirectionalLight(0xffffff, 1.5); light.position.set(2, -3, 4); scene.add(light);
    const camera = new THREE.PerspectiveCamera(34, 1, .01, 100);
    camera.up.set(0, 0, 1); camera.position.set(0, -5, 0);
    const controls = new OrbitControls(camera, canvas);
    controls.minDistance = .4; controls.maxDistance = 25; controls.zoomSpeed = .8;
    const wallMaterial = new THREE.MeshPhongMaterial({ color: '#909eaa', transparent: true, opacity: .30, side: THREE.DoubleSide, depthWrite: false, shininess: 12 });
    const glyphMaterial = new THREE.MeshBasicMaterial();
    const errorMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const view = { holder, name, sample, slot, renderer, scene, camera, controls, wallMaterial, glyphMaterial, errorMaterial };
    this.views.push(view);
    controls.addEventListener('change', () => this.syncCameras(view));
    canvas.addEventListener('keydown', event => this.onKey(event, view), { signal: this.listeners.signal });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.fail(new Error('WebGL context lost')); }, { signal: this.listeners.signal });
  }

  bind() {
    const on = (node, event, handler) => node.addEventListener(event, handler, { signal: this.listeners.signal });
    on(this.ui('challenge'), 'change', () => this.load().catch(error => this.fail(error)));
    on(this.ui('display'), 'change', () => { if (this.loaded) this.update(); });
    on(this.ui('density'), 'change', () => { if (this.loaded) { this.makeGlyphs(); this.update(); } });
    on(this.ui('size'), 'input', () => {
      this.ui('size-label').textContent = `${Number(this.ui('size').value)}×`;
      if (this.loaded) this.update();
    });
    on(this.ui('time'), 'input', () => { this.setPlaying(false); this.step = Number(this.ui('time').value); if (this.loaded) this.update(); });
    on(this.ui('play'), 'click', () => this.setPlaying(!this.playing));
    on(this.ui('speed'), 'change', () => this.schedule());
    this.colourInputs.forEach(input => on(input, 'input', () => {
      if (this.root.dataset.state !== 'ready') return;
      const maximum = input.valueAsNumber;
      const valid = Number.isFinite(maximum) && maximum > 0 && Number.isFinite(maximum / this.manifest.unitScale);
      input.setCustomValidity(valid ? '' : 'Enter a positive, finite maximum in Pa.');
      input.setAttribute('aria-invalid', String(!valid));
      input.closest('fieldset').querySelector('[data-wss-colour-validation]').textContent = valid ? '' : 'Enter a positive, finite maximum in Pa.';
      if (!valid) return;
      const field = input.dataset.wssColourMax;
      this.colourMaxima.set(this.challenge.id, { ...this.colourMaxima.get(this.challenge.id), [field]: maximum });
      this.syncColourSlider(field, maximum);
      this.update();
    }));
    this.colourSliders.forEach(slider => on(slider, 'input', () => {
      const input = this.colourInputs.find(node => node.dataset.wssColourMax === slider.dataset.wssColourSlider);
      input.value = Number(Number(slider.value).toPrecision(3));
      input.dispatchEvent(new Event('input'));
    }));
    this.root.querySelectorAll('[data-wss-colour-reset]').forEach(button => on(button, 'click', () => {
      if (this.root.dataset.state !== 'ready') return;
      const maxima = this.colourMaxima.get(this.challenge.id);
      if (maxima) delete maxima[button.dataset.wssColourReset];
      this.syncColourControls();
      this.update();
    }));
    on(document, 'visibilitychange', () => this.schedule());
    on(this.motion, 'change', event => { if (event.matches) this.setPlaying(false); });
    on(this.ui('reset'), 'click', () => this.resetView());
    this.root.querySelectorAll('[data-wss-zoom]').forEach(button => on(button, 'click', () => this.zoom(this.views[0], button.dataset.wssZoom === 'in' ? .82 : 1.22)));
    const fullscreen = this.ui('fullscreen');
    if (document.fullscreenEnabled && this.root.requestFullscreen) {
      fullscreen.hidden = false;
      on(fullscreen, 'click', async () => {
        try { if (document.fullscreenElement === this.root) await document.exitFullscreen(); else await this.root.requestFullscreen(); }
        catch (_) { this.status.textContent = 'Fullscreen is unavailable in this browser window.'; }
      });
      on(document, 'fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement === this.root ? 'Exit fullscreen' : 'Fullscreen'; this.resize(); });
    }
  }

  async asset(path, signal) {
    const response = await fetch(new URL(path, this.url), { signal, cache: 'no-cache' });
    if (!response.ok) throw new Error(`WSS asset HTTP ${response.status}`);
    if (!globalThis.DecompressionStream) throw Object.assign(new Error('Gzip unavailable'), { userMessage: 'Please use a recent browser to load the compressed 3D data.' });
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }

  async load() {
    const generation = ++this.generation;
    const first = !this.loaded;
    const challenge = this.manifest.challenges.find(item => item.id === this.ui('challenge').value);
    const samples = challenge.cases.map(item => this.manifest.samples.find(sample => sample.id === item.sample));
    if (samples[0].frameCount !== samples[1].frameCount) throw new Error('WSS examples need matching timesteps');
    this.resumePlayback = this.resumePlayback || this.playing || first && !this.motion.matches;
    this.setPlaying(false);
    this.fetchController?.abort(); this.fetchController = new AbortController();
    const signal = this.fetchController.signal, pendingSurfaces = new Map();
    const surfaceFor = path => {
      if (this.surfaceCache.has(path)) return Promise.resolve(this.surfaceCache.get(path));
      if (!pendingSurfaces.has(path)) pendingSurfaces.set(path, this.asset(path, signal).then(decodeSurface));
      return pendingSurfaces.get(path);
    };
    this.interface.hidden = false;
    this.root.dataset.state = 'loading'; this.interface.setAttribute('aria-busy', 'true');
    this.colourControls.forEach(controls => { controls.disabled = true; });
    this.status.textContent = `Loading ${challenge.label.toLowerCase()}…`;
    await Promise.all(samples.map(async sample => {
      if (this.cache.has(sample.id)) return;
      const [surface, vectorBuffer] = await Promise.all([surfaceFor(sample.geometry), this.asset(sample.vectors, signal)]);
      if (this.disposed || generation !== this.generation) return;
      const vectors = decodeVectors(vectorBuffer);
      if (surface.count !== sample.pointCount || vectors.count !== sample.pointCount || vectors.frameCount !== sample.frameCount || surface.frameCount !== sample.frameCount) throw new Error('Mismatched WSS geometry and vectors');
      this.surfaceCache.set(sample.geometry, surface);
      this.cache.set(sample.id, { surface, vectors });
    }));
    if (this.disposed || generation !== this.generation) return;
    this.challenge = challenge; this.frameCount = samples[0].frameCount;
    this.views.forEach(view => {
      view.sample = samples[view.slot];
      const label = challenge.cases[view.slot].label;
      view.renderer.domElement.setAttribute('aria-label', `${label}: ${view.name === 'gt' ? 'CFD' : view.name === 'prediction' ? 'LaB-GATr' : 'Absolute error'} wall shear stress. Drag to rotate; scroll to zoom.`);
    });
    samples.forEach((sample, slot) => {
      const group = this.root.querySelector(`[data-wss-group][data-wss-slot="${slot}"]`);
      group.dataset.wssGroup = sample.id;
      const heading = group.querySelector('[data-wss-case-title]');
      heading.textContent = challenge.cases[slot].label; heading.title = sample.source;
      group.querySelector('.demo-error-metrics').setAttribute('aria-label', `${challenge.cases[slot].label} surface errors`);
    });
    this.loaded = true;
    this.ui('time').max = this.frameCount - 1;
    this.step = Math.min(this.step, this.frameCount - 1);
    this.root.dataset.hasData = 'true'; this.root.dataset.challenge = challenge.id;
    this.root.dataset.state = 'ready'; this.interface.setAttribute('aria-busy', 'false');
    this.syncColourControls();
    this.colourControls.forEach(controls => { controls.disabled = false; });
    this.makeSurfaces(); this.makeGlyphs(); this.resize();
    if (first) this.resetView();
    this.update(); this.status.textContent = `${challenge.label} · LaB-GATr`;
    this.setPlaying(this.resumePlayback); this.resumePlayback = false;
  }

  makeSurfaces() {
    this.views.forEach(view => {
      if (view.wall) { view.scene.remove(view.wall); view.wall.geometry.dispose(); }
      const { surface } = this.cache.get(view.sample.id);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(surface.positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1));
      geometry.computeVertexNormals();
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(surface.count * 3), 3));
      view.wall = new THREE.Mesh(geometry, view.name === 'error' ? view.errorMaterial : view.wallMaterial);
      view.scene.add(view.wall);
    });
  }

  makeGlyphs() {
    this.cache.forEach(data => { data.sites = glyphSites(data.surface.positions, Number(this.ui('density').value)); });
    this.views.filter(view => view.name !== 'error').forEach(view => {
      if (view.glyphs) { view.scene.remove(view.glyphs); view.glyphs.dispose(); }
      const sites = this.cache.get(view.sample.id).sites;
      view.glyphs = new THREE.InstancedMesh(this.arrowGeometry, view.glyphMaterial, sites.length);
      view.glyphs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Dynamic arrow extents change each frame; avoid stale frustum bounds.
      view.glyphs.frustumCulled = false;
      view.scene.add(view.glyphs);
      view.renderer.domElement.dataset.glyphCount = sites.length;
    });
  }

  colourRanges() {
    const maxima = this.colourMaxima.get(this.challenge.id);
    // Inputs are in Pa; rendering still uses the original dyn/cm² vectors.
    return Object.fromEntries(['wss', 'error'].map(field => [field,
      maxima?.[field] === undefined ? this.challenge.displayRanges[field] : [0, maxima[field] / this.manifest.unitScale],
    ]));
  }

  syncColourControls() {
    const ranges = this.colourRanges();
    this.colourInputs.forEach(input => {
      const field = input.dataset.wssColourMax, maximum = ranges[field][1] * this.manifest.unitScale;
      input.value = maximum.toFixed(2);
      input.setCustomValidity(''); input.removeAttribute('aria-invalid');
      input.closest('fieldset').querySelector('[data-wss-colour-validation]').textContent = '';
      this.syncColourSlider(field, maximum, true);
    });
  }

  syncColourSlider(field, maximum, reset = false) {
    const slider = this.colourSliders.find(node => node.dataset.wssColourSlider === field);
    const extent = Math.max(this.challenge.displayRanges[field][1] * this.manifest.unitScale * 2, maximum);
    const step = 10 ** (Math.floor(Math.log10(extent)) - 2);
    const upper = Math.ceil(extent / step / 10) * step * 10;
    slider.min = Math.min(step, maximum); slider.step = 'any';
    slider.max = Math.max(Number.isFinite(upper) ? upper : extent, reset ? 0 : Number(slider.max));
    slider.value = maximum;
    slider.setAttribute('aria-valuetext', `${labelNumber(maximum)} Pa`);
  }

  update() {
    const ranges = this.colourRanges(), color = new THREE.Color(), dummy = new THREE.Object3D();
    const direction = new THREE.Vector3(), normal = new THREE.Vector3();
    const size = Number(this.ui('size').value), glyphs = this.ui('display').value === 'glyphs';
    this.ui('size').disabled = !glyphs; this.ui('density').disabled = !glyphs;
    this.root.querySelectorAll('[data-wss-field-label]').forEach(node => { node.textContent = glyphs ? 'Surface WSS vectors' : 'Surface WSS magnitude'; });
    this.views.forEach(view => {
      const { surface, vectors, sites } = this.cache.get(view.sample.id);
      const truth = vectors.frame(this.step, 0), prediction = vectors.frame(this.step, 1);
      const values = view.name === 'gt' ? truth : prediction;
      const isError = view.name === 'error';
      view.wall.material = isError || !glyphs ? view.errorMaterial : view.wallMaterial;
      if (view.glyphs) view.glyphs.visible = glyphs;
      if (!isError && glyphs) {
        const normals = view.wall.geometry.getAttribute('normal').array;
        sites.forEach((site, index) => {
          const offset = site * 3;
          direction.fromArray(values, offset);
          const magnitude = direction.length();
          // Preserve vector direction; a small normal offset avoids z-fighting.
          normal.fromArray(normals, offset);
          dummy.position.fromArray(surface.positions, offset).addScaledVector(normal, .002);
          dummy.quaternion.setFromUnitVectors(up, magnitude ? direction.multiplyScalar(1 / magnitude) : up);
          // Colorbar adjustments change colors, while the arrow-size control sets glyph size.
          const length = magnitude ? .055 * size * (.35 + .65 * Math.sqrt(Math.min(1, magnitude / this.challenge.displayRanges.wss[1]))) : 0;
          dummy.scale.setScalar(length); dummy.updateMatrix();
          view.glyphs.setMatrixAt(index, dummy.matrix);
          view.glyphs.setColorAt(index, colorAt(magnitude, ranges.wss[1], SPEED_COLORS, color));
        });
        view.glyphs.instanceMatrix.needsUpdate = true; view.glyphs.instanceColor.needsUpdate = true;
      } else {
        const colors = view.wall.geometry.getAttribute('color');
        for (let offset = 0; offset < truth.length; offset += 3) {
          const value = isError
            ? Math.hypot(prediction[offset] - truth[offset], prediction[offset + 1] - truth[offset + 1], prediction[offset + 2] - truth[offset + 2])
            : Math.hypot(values[offset], values[offset + 1], values[offset + 2]);
          colorAt(value, ranges[isError ? 'error' : 'wss'][1], isError ? ERROR_COLORS : SPEED_COLORS, color).toArray(colors.array, offset);
        }
        colors.needsUpdate = true;
      }
      view.renderer.domElement.dataset.timestep = this.step;
      view.renderer.domElement.dataset.geometry = view.sample.id;
      view.renderer.domElement.dataset.display = isError ? 'error' : glyphs ? 'glyphs' : 'magnitude';
    });
    this.ui('time').value = this.step;
    this.ui('time-label').textContent = `Time step ${this.step + 1} / ${this.frameCount}`;
    this.challenge.cases.forEach((item, slot) => {
      const sample = this.manifest.samples.find(record => record.id === item.sample);
      const group = this.root.querySelector(`[data-wss-group][data-wss-slot="${slot}"]`);
      for (const [name, value, scope] of [
        ['step-error', sample.metrics.relativeL2[this.step], `at timestep ${this.step + 1}`],
        ['total-error', sample.metrics.relativeL2AllFrames, `across all ${this.frameCount} timesteps`],
      ]) {
        const node = group.querySelector(`[data-wss-${name}]`); node.textContent = Number.isFinite(value) ? `${value.toFixed(2)}%` : '—';
        node.dataset.value = value ?? '';
        node.title = `100 × ‖CFD − prediction‖₂ / ‖CFD‖₂ over all surface vertices and vector components ${scope}, computed from original VTP vectors, including zero-GT points.`;
      }
    });
    this.root.querySelectorAll('[data-wss-ticks]').forEach(node => {
      const field = node.dataset.wssTicks;
      const maximum = ranges[field][1] * this.manifest.unitScale;
      const clipped = this.views.some(view => view.sample.ranges[field][1] > ranges[field][1]);
      node.replaceChildren(...[0, maximum / 2, maximum].map((value, index) => {
        const span = document.createElement('span'); span.textContent = `${clipped && index === 2 ? '≥ ' : ''}${labelNumber(value)}`; return span;
      }));
      node.title = `${this.colourMaxima.get(this.challenge.id)?.[field] === undefined ? 'Default 99th-percentile' : 'Selected'} limit across both cases in this challenge and all timesteps; higher values saturate.`;
    });
    this.requestRender();
  }

  setPlaying(playing) {
    this.playing = Boolean(playing && this.loaded && this.root.dataset.state === 'ready');
    this.ui('play').setAttribute('aria-pressed', String(this.playing));
    this.ui('play').setAttribute('aria-label', this.playing ? 'Pause heart cycle' : 'Play heart cycle in a loop');
    this.ui('play').title = this.playing ? 'Pause' : 'Play'; this.schedule();
  }

  schedule() {
    clearTimeout(this.timer);
    if (!this.playing || this.disposed || document.hidden) return;
    this.timer = setTimeout(() => { this.step = (this.step + 1) % this.frameCount; this.update(); this.schedule(); }, 130 / Number(this.ui('speed').value));
  }

  syncCameras(source) {
    if (this.syncing || this.disposed) return;
    this.syncing = true;
    this.views.forEach(view => {
      if (view === source) return;
      view.camera.position.copy(source.camera.position); view.camera.quaternion.copy(source.camera.quaternion);
      view.controls.target.copy(source.controls.target); view.controls.update();
    });
    this.syncing = false; this.requestRender();
  }

  fittedDistance() {
    const bounds = new THREE.Box3();
    this.views.forEach(view => bounds.union(new THREE.Box3().setFromBufferAttribute(view.wall.geometry.getAttribute('position'))));
    const dimensions = bounds.getSize(new THREE.Vector3());
    return Math.max(dimensions.z, dimensions.x / Math.max(.1, this.views[0].camera.aspect)) / (2 * Math.tan(THREE.MathUtils.degToRad(17))) * 1.15;
  }

  resetView() {
    if (!this.loaded) return;
    this.fitDistance = this.fittedDistance();
    const view = this.views[0]; view.controls.target.set(0, 0, 0); view.camera.position.set(0, -this.fitDistance, .05); view.controls.update(); this.syncCameras(view);
  }

  zoom(view, factor) {
    const offset = view.camera.position.clone().sub(view.controls.target).multiplyScalar(factor).clampLength(.4, 25);
    view.camera.position.copy(view.controls.target).add(offset); view.controls.update(); this.syncCameras(view);
  }

  onKey(event, view) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (['+', '=', '-', '_'].includes(event.key)) { event.preventDefault(); this.zoom(view, ['+', '='].includes(event.key) ? .82 : 1.22); return; }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); this.resetView(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const axis = ['ArrowUp', 'ArrowDown'].includes(event.key) ? new THREE.Vector3(1, 0, 0).applyQuaternion(view.camera.quaternion) : view.camera.up;
    const offset = view.camera.position.clone().sub(view.controls.target).applyAxisAngle(axis, (['ArrowLeft', 'ArrowUp'].includes(event.key) ? 1 : -1) * Math.PI / 18);
    view.camera.position.copy(view.controls.target).add(offset); view.controls.update(); this.syncCameras(view);
  }

  resize() {
    if (this.disposed) return;
    this.views.forEach(view => {
      const width = Math.max(1, view.holder.clientWidth), height = Math.max(1, view.holder.clientHeight);
      view.renderer.setSize(width, height, false); view.camera.aspect = width / height; view.camera.updateProjectionMatrix();
    });
    if (this.loaded && this.views.every(view => view.wall)) {
      const distance = this.fittedDistance();
      // Preserve relative zoom and orientation when switching screen layouts.
      if (this.fitDistance && Math.abs(distance - this.fitDistance) > 1e-6) this.zoom(this.views[0], distance / this.fitDistance);
      this.fitDistance = distance;
    }
    this.requestRender();
  }

  setTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const background = getComputedStyle(this.root).getPropertyValue('--bg').trim();
    this.views.forEach(view => { view.renderer.setClearColor(background); view.wallMaterial.color.set(dark ? '#bdc9ce' : '#697c88'); });
    this.requestRender();
  }

  requestRender() {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.views.forEach(view => view.renderer.render(view.scene, view.camera)); });
  }

  fail(error) {
    if (error.name === 'AbortError' || this.disposed) return;
    this.resumePlayback = false; this.setPlaying(false); this.root.dataset.state = 'error'; this.interface.setAttribute('aria-busy', 'false'); this.interface.hidden = true;
    this.status.textContent = error.userMessage || 'The surface could not load. Try loading the viewer again.';
    this.ui('start').hidden = false; this.ui('start').textContent = 'Try loading again';
  }

  dispose() {
    this.disposed = true; clearTimeout(this.timer); cancelAnimationFrame(this.frame);
    this.fetchController?.abort(); this.listeners.abort(); this.resizeObserver?.disconnect(); this.themeObserver?.disconnect();
    this.views.forEach(view => {
      view.controls.dispose(); view.glyphs?.dispose(); view.wall?.geometry.dispose();
      view.wallMaterial.dispose(); view.glyphMaterial.dispose(); view.errorMaterial.dispose();
      view.renderer.dispose(); view.renderer.forceContextLoss(); view.holder.replaceChildren();
    });
    this.arrowGeometry?.dispose(); this.cache.clear(); this.surfaceCache.clear(); delete this.root.dataset.hasData; this.interface.hidden = true; this.ui('camera-controls').hidden = true; this.ui('challenge-controls').hidden = true;
  }
}
