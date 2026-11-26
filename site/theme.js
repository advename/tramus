// Runs before first paint (loaded synchronously in <head>) so the page never flashes the wrong
// theme. An explicit choice from the toggle wins; otherwise follow the OS.
(function () {
  try {
    var t = localStorage.getItem('tramus-theme');
    if (t !== 'light' && t !== 'dark')
      t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
