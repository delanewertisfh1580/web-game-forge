/**
 * dev-client.js — hot reload client for dev server.
 * Connects to /__reload SSE endpoint and reloads on changes.
 * Silently no-ops if dev server is not running.
 */
(async function() {
  try {
    // Check if dev server is running
    const res = await fetch('/__reload/ping', { method: 'HEAD' });
    if (res.status !== 200) return;

    // Connect to SSE
    const source = new EventSource('/__reload');
    source.addEventListener('reload', () => {
      console.log('[dev-client] Reloading...');
      location.reload();
    });
    source.addEventListener('message', (e) => {
      if (e.data === 'reload') {
        console.log('[dev-client] Reloading...');
        location.reload();
      }
    });
    source.onerror = () => {
      // Silently close on error (server stopped)
      source.close();
    };
  } catch (e) {
    // Dev server not running — silently ignore
  }
})();
