(() => {
  const picker = document.querySelector('.za-accent');
  const root = document.documentElement;
  if (root.style.getPropertyValue('--accent')) {
    picker.add(new Option('Custom', 'custom'));
    picker.value = 'custom';
  } else {
    picker.value = root.dataset.theme || 'white';
  }
  picker.addEventListener('change', () => {
    const theme = picker.value;
    root.dataset.theme = theme;
    for (const name of ['--accent', '--accent-2', '--accent-rgb', '--accent-2-rgb']) {
      root.style.removeProperty(name);
    }
    picker.querySelector('[value="custom"]')?.remove();
    try {
      const prefs = JSON.parse(localStorage.getItem('zenou_prefs') || '{}');
      Object.assign(prefs, {theme, hue: null});
      delete prefs.hueRgb;
      delete prefs.hue2Rgb;
      localStorage.setItem('zenou_prefs', JSON.stringify(prefs));
    } catch { /* The selection still applies for this page. */ }
  });
})();
