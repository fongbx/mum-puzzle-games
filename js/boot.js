// Runs before the page paints so high contrast does not flash on.
// The storage key must match KEYS.settings in settings.js.
(function () {
  try {
    var raw = localStorage.getItem('mum.settings');
    var data = raw ? JSON.parse(raw) : null;
    if (data && data.contrast) document.documentElement.classList.add('hc');
  } catch (e) {}

  document.addEventListener('DOMContentLoaded', function () {
    var modern = 'noModule' in document.createElement('script');
    if (!modern) {
      var el = document.getElementById('old-browser');
      if (el) el.hidden = false;
    }
  });
})();
