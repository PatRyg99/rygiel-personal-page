(() => {
  const map = document.querySelector('[data-publication-map]');
  if (!map) return;
  const records = Object.values(JSON.parse(map.querySelector('[data-affiliation-data]').textContent));
  const controls = [...map.querySelectorAll('[data-country-select]')];
  const tooltip = map.querySelector('.map-tooltip');
  const list = tooltip.querySelector('[data-tooltip-institutions]');
  const svg = map.querySelector('.world-map');
  let activeControl = null;
  let hideTimer;
  const totals = new Map();

  // Sets deduplicate multiple authors, departments, and repeated affiliations in a paper.
  records.forEach(record => {
    const institutionsByCountry = new Map();
    record.evidence.forEach(evidence => {
      if (!institutionsByCountry.has(evidence.code)) institutionsByCountry.set(evidence.code, new Set());
      evidence.institutions.forEach(name => institutionsByCountry.get(evidence.code).add(name));
    });
    institutionsByCountry.forEach((institutions, code) => {
      if (!totals.has(code)) totals.set(code, new Map());
      institutions.forEach(name => totals.get(code).set(name, (totals.get(code).get(name) || 0) + 1));
    });
  });

  const hide = () => {
    clearTimeout(hideTimer);
    tooltip.hidden = true;
    activeControl?.removeAttribute('aria-describedby');
    activeControl = null;
  };
  const scheduleHide = () => { hideTimer = setTimeout(hide, 180); };
  const show = (control, event) => {
    clearTimeout(hideTimer);
    activeControl?.removeAttribute('aria-describedby');
    activeControl = control;
    control.setAttribute('aria-describedby', tooltip.id);
    const code = control.dataset.countrySelect;
    const count = Number(control.dataset.countryCount);
    tooltip.querySelector('[data-tooltip-country]').textContent = control.dataset.countryName;
    tooltip.querySelector('[data-tooltip-count]').textContent = `${count} ${count === 1 ? 'paper' : 'papers'}`;
    list.replaceChildren();
    [...(totals.get(code) || [])].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).forEach(([name, total]) => {
      const item = document.createElement('li');
      const institution = document.createElement('span');
      const number = document.createElement('strong');
      institution.textContent = name;
      number.textContent = total;
      item.append(institution, number);
      list.append(item);
    });
    tooltip.hidden = false;
    tooltip.scrollTop = 0;
    const bounds = control.getBoundingClientRect();
    const pointer = event && event.type.startsWith('pointer') && event.pointerType !== 'touch';
    const x = pointer ? event.clientX : bounds.left + bounds.width / 2;
    const anchorTop = pointer ? event.clientY - 8 : bounds.top;
    const anchorBottom = pointer ? event.clientY + 8 : bounds.bottom;
    const above = Math.max(0, anchorTop - 24);
    const below = Math.max(0, innerHeight - anchorBottom - 24);
    const placeBelow = below >= Math.min(420, innerHeight * .7) || below >= above;
    // Leave the target uncovered so opening on focus cannot intercept a tap's click.
    tooltip.style.maxHeight = `${Math.min(420, innerHeight * .7, placeBelow ? below : above)}px`;
    const width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    let left = x + 12;
    if (left + width > innerWidth - 12) left = x - width - 12;
    const top = placeBelow ? anchorBottom + 12 : anchorTop - height - 12;
    tooltip.style.left = `${Math.max(12, Math.min(left, innerWidth - width - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(top, innerHeight - height - 12))}px`;
  };
  controls.forEach(control => {
    control.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') show(control, event); });
    control.addEventListener('pointerleave', scheduleHide);
    control.addEventListener('focus', () => show(control));
    control.addEventListener('blur', scheduleHide);
    control.addEventListener('click', () => show(control));
  });
  // Users can move into a long institution list to read or scroll it.
  tooltip.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  tooltip.addEventListener('pointerleave', scheduleHide);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  document.addEventListener('pointerdown', event => {
    if (!tooltip.contains(event.target) && !event.target.closest('[data-country-select]')) hide();
  });
  window.addEventListener('resize', hide);
  window.addEventListener('scroll', () => {
    if (activeControl === document.activeElement) {
      const bounds = activeControl.getBoundingClientRect();
      if (bounds.top >= 0 && bounds.bottom <= innerHeight) { show(activeControl); return; }
    }
    hide();
  }, { passive: true });
  map.querySelectorAll('[data-map-view]').forEach(button => {
    button.addEventListener('click', () => {
      hide();
      svg.setAttribute('viewBox', button.dataset.mapView);
      const view = svg.viewBox.baseVal;
      svg.querySelectorAll('[data-country-select]').forEach(path => {
        const bounds = path.getBBox();
        const visible = bounds.x < view.x + view.width && bounds.x + bounds.width > view.x && bounds.y < view.y + view.height && bounds.y + bounds.height > view.y;
        path.setAttribute('tabindex', visible ? '0' : '-1');
      });
      map.querySelectorAll('[data-map-view]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    });
  });
})();
