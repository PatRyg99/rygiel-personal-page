document.documentElement.classList.replace('no-js', 'js');
try {
  const saved = localStorage.getItem('theme');
  const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch (_) {}
