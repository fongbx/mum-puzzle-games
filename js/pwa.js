// Registers the service worker that keeps the games on the phone after the first visit.
// If a newer copy takes over, reload once so the open page matches the saved files.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController) window.location.reload();
    });
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
}
