(function () {
  'use strict';

  if (globalThis.__ytbStarted) return;
  globalThis.__ytbStarted = true;

  let sweepTimer = null;

  function looksInteresting(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.matches && (node.matches(globalThis.YTBCard.CARD_SELECTOR) || node.matches('ytd-watch-metadata'))) return true;
    if (node.querySelector && node.querySelector(globalThis.YTBCard.CARD_SELECTOR + ', ytd-watch-metadata')) return true;
    return false;
  }

  function startObservers() {
    const observer = new MutationObserver(function (records) {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (looksInteresting(node)) {
            globalThis.YTBFilter.schedule();
            return;
          }
        }
      }
    });
    observer.observe(document.documentElement || document, { childList: true, subtree: true });

    document.addEventListener('yt-navigate-finish', function () {
      globalThis.YTBFilter.schedule();
    });
    document.addEventListener('yt-page-data-updated', function () {
      globalThis.YTBFilter.schedule();
    });
    window.addEventListener('popstate', function () {
      globalThis.YTBFilter.schedule();
    });
  }

  function startSweep() {
    clearInterval(sweepTimer);
    sweepTimer = setInterval(function () {
      globalThis.YTBFilter.schedule();
    }, 3000);
  }

  async function boot() {
    globalThis.YTBMenu.start();
    await globalThis.YTBState.load();
    globalThis.YTBState.on(function () {
      globalThis.YTBFilter.schedule();
    });
    globalThis.YTBFilter.schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      startObservers();
      startSweep();
    });
  } else {
    startObservers();
    startSweep();
  }

  boot();
})();
