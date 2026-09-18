(() => {
  let settings;
  async function send() {
    if (!settings) settings = (await chrome.storage.local.get('settings')).settings || {};
    window.postMessage({ type: 'UNSQUEEZE_SETTINGS', settings }, location.origin);
  }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.type === 'UNSQUEEZE_READY') void send();
    if (event.data?.type === 'UNSQUEEZE_STATUS' && typeof event.data.message === 'string') {
      void chrome.storage.local.set({ lastStatus: { kind: event.data.kind, message: event.data.message.slice(0, 500), time: Date.now() } });
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) { settings = changes.settings.newValue || {}; void send(); }
  });
  void send();
})();
