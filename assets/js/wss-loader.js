(() => {
  const root = document.querySelector('[data-wss-demo]');
  if (!root) return;
  const scriptURL = document.currentScript.src;
  const start = root.querySelector('[data-wss-start]');
  const status = root.querySelector('[data-wss-status]');
  let viewer;
  start.hidden = false;
  start.addEventListener('click', async () => {
    start.disabled = true;
    root.dataset.state = 'loading';
    status.textContent = 'Loading the 3D viewer…';
    try {
      viewer?.dispose();
      viewer = null;
      const module = await import(new URL('wss-viewer.js', scriptURL));
      viewer = await module.createViewer(root);
      await viewer.load();
      start.hidden = true;
    } catch (error) {
      viewer?.dispose();
      viewer = null;
      root.dataset.state = 'error';
      status.textContent = error.userMessage || 'The viewer could not load. Check your connection and try again.';
      start.textContent = 'Try loading again';
    } finally { start.disabled = false; }
  });
})();
