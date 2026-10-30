(() => {
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.hidden = false;
    const updateLabel = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      toggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
      toggle.title = toggle.getAttribute('aria-label');
    };
    updateLabel();
    toggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (_) {}
      updateLabel();
    });
  }
  const filters = document.querySelector('[data-publication-filters]');
  if (filters) {
    filters.hidden = false;
    const search = filters.querySelector('[name="q"]');
    const type = filters.querySelector('[name="type"]');
    const topic = filters.querySelector('[name="topic"]');
    const entries = [...document.querySelectorAll('[data-publication]')];
    const status = document.querySelector('[data-result-count]');
    const empty = document.querySelector('[data-empty-results]');
    const params = new URLSearchParams(location.search);
    const countryControls = [...document.querySelectorAll('.world-map [data-country-select]')];
    const countries = new Map(countryControls.map(control => [control.dataset.countrySelect, control.dataset.countryName]));
    let country = countries.has(params.get('country')) ? params.get('country') : '';
    const clearCountry = document.querySelector('[data-clear-country]');
    const countryStatus = document.querySelector('[data-country-status]');
    search.value = params.get('q') || '';
    for (const select of [type, topic]) {
      const value = params.get(select.name) || '';
      if ([...select.options].some(option => option.value === value)) select.value = value;
    }
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const update = () => {
      const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
      let count = 0;
      entries.forEach(entry => {
        const matches = (!type.value || entry.dataset.type === type.value) &&
          (!topic.value || entry.dataset.topics.split(' ').includes(topic.value)) &&
          (!country || entry.dataset.countries.split(' ').includes(country)) &&
          terms.every(term => normalize(entry.dataset.search).includes(term));
        entry.hidden = !matches;
        if (matches) count++;
      });
      document.querySelectorAll('[data-publication-group]').forEach(group => {
        group.hidden = ![...group.querySelectorAll('[data-publication]')].some(entry => !entry.hidden);
      });
      status.textContent = `${count} of ${entries.length} research outputs${country ? ` · Affiliations in ${countries.get(country)}` : ''}`;
      countryControls.forEach(control => control.setAttribute('aria-pressed', String(control.dataset.countrySelect === country)));
      if (countryStatus) countryStatus.textContent = country ? `Affiliations in ${countries.get(country)}` : 'All countries';
      if (clearCountry) clearCountry.hidden = !country;
      empty.hidden = count !== 0;
      const next = new URLSearchParams();
      if (search.value.trim()) next.set('q', search.value.trim());
      if (type.value) next.set('type', type.value);
      if (topic.value) next.set('topic', topic.value);
      if (country) next.set('country', country);
      const query = next.toString();
      history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
    };
    filters.addEventListener('input', update);
    filters.addEventListener('submit', event => { event.preventDefault(); update(); });
    filters.addEventListener('reset', () => { country = ''; setTimeout(update, 0); });
    countryControls.forEach(control => {
      if (control.tagName.toLowerCase() === 'path') {
        control.setAttribute('role', 'button');
        control.setAttribute('tabindex', '0');
        control.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); control.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
        });
      } else control.disabled = false;
      control.addEventListener('click', () => {
        country = control.dataset.countrySelect === country ? '' : control.dataset.countrySelect;
        update();
      });
    });
    if (clearCountry) clearCountry.addEventListener('click', () => { country = ''; update(); });
    document.querySelectorAll('[data-map-selection], [data-map-tools]').forEach(element => { element.hidden = false; });
    update();
  }
  const copyButton = document.querySelector('[data-copy-citation]');
  if (copyButton && navigator.clipboard && window.isSecureContext) {
    copyButton.hidden = false;
    copyButton.addEventListener('click', async () => {
      const status = document.querySelector('.copy-status');
      try {
        await navigator.clipboard.writeText(document.querySelector('#bibtex').textContent.trim());
        copyButton.textContent = 'Copied';
        status.textContent = 'BibTeX copied to clipboard.';
        setTimeout(() => { copyButton.textContent = 'Copy BibTeX'; }, 2500);
      } catch (_) {
        status.textContent = 'Could not copy. Select the citation text or download the BibTeX file.';
        status.classList.remove('sr-only');
      }
    });
  }
})();
