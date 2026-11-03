/**
 * boot.js — shared error bootstrap for all examples.
 * Catches errors and shows a red banner in DOM.
 * Include via: <script type="module" src="../engine/boot.js"></script>
 * or import 'my-engine/boot' if mapped.
 */
(function() {
  if (window.__bootInstalled) return;
  window.__bootInstalled = true;

  function showBanner(msg) {
    let banner = document.getElementById('__engine-error-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = '__engine-error-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#c0392b;color:#fff;padding:10px 16px;font:13px/1.4 monospace;white-space:pre-wrap;max-height:40vh;overflow:auto;box-shadow:0 2px 8px rgba(0,0,0,.4);';
      document.body.appendChild(banner);
    }
    banner.textContent += (banner.textContent ? '\n---\n' : '') + msg;
  }

  window.addEventListener('error', (e) => {
    showBanner(`[error] ${e.message}\n  at ${e.filename}:${e.lineno}:${e.colno}`);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg = reason instanceof Error ? `${reason.message}\n${reason.stack || ''}` : String(reason);
    showBanner(`[unhandledrejection] ${msg}`);
  });

  // Catch console.error too
  const origError = console.error;
  console.error = function(...args) {
    origError.apply(console, args);
    showBanner(`[console.error] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
  };
})();
