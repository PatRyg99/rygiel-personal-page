(() => {
  const root = document.querySelector('[data-aneumo-demo]');
  if (!root) return;
  const start = root.querySelector('[data-demo-start]');
  const status = root.querySelector('[data-demo-status]');
  const scriptURL = document.currentScript.src;
  start.hidden = false;
  let viewer;
  start.addEventListener('click', async () => {
    if (viewer && root.dataset.state === 'error') { viewer.dispose(); viewer = null; }
    start.disabled = true;
    root.dataset.state = 'loading';
    status.textContent = 'Loading the 3D viewer…';
    try {
      if (!viewer) {
        const module = await import(new URL('aneumo-viewer.js', scriptURL));
        viewer = await module.createViewer(root);
      }
      await viewer.load();
      start.hidden = true;
    } catch (error) {
      if (viewer) { viewer.dispose(); viewer = null; }
      root.dataset.state = 'error';
      status.textContent = error.userMessage || 'The viewer could not load. Check your connection and try again.';
      start.textContent = 'Try loading again';
    } finally {
      start.disabled = false;
    }
  });
})();
