(() => {
  const links = [...document.querySelectorAll('[data-photo]')];
  const dialog = document.querySelector('.photo-viewer');
  if (!links.length || !dialog || typeof dialog.showModal !== 'function') return;

  const image = dialog.querySelector('[data-photo-image]');
  const caption = dialog.querySelector('[data-photo-caption]');
  const count = dialog.querySelector('.photo-viewer-count');
  let index = 0;
  let opener;

  const show = position => {
    index = (position + links.length) % links.length;
    const link = links[index];
    image.src = link.href;
    image.alt = link.dataset.description;
    caption.textContent = link.dataset.caption;
    count.textContent = `${index + 1} / ${links.length}`;
  };

  links.forEach((link, position) => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      show(position);
      dialog.showModal();
      document.body.classList.add('photo-viewer-open');
    });
  });

  dialog.querySelector('[data-photo-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-photo-prev]').addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-photo-next]').addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('photo-viewer-open');
    image.removeAttribute('src');
    opener?.focus({ preventScroll: true });
  });
})();
