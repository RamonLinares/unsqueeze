(() => {
  const $ = id => document.getElementById(id);
  const storage = chrome.storage.local;
  const factorControl = Unsqueeze.bindFactorControl();
  function showFilter() { $('camera-filter').hidden = $('camera').value !== 'custom'; }
  async function initialize() {
    const stored = await storage.get(['settings', 'lastStatus']);
    const settings = Unsqueeze.normalize(stored.settings);
    $('enabled').checked = settings.enabled;
    $('factor').value = settings.factor;
    factorControl.sync();
    $('framing').value = settings.framing;
    $('performance').value = settings.performance;
    $('camera').value = settings.camera === '*' ? '*' : 'custom';
    $('camera-name').value = settings.camera === '*' ? '' : settings.camera;
    showFilter();
    for (const id of ['enabled', 'factor', 'framing', 'performance', 'camera', 'camera-name']) $(id).addEventListener('change', save);
    if (stored.settings && stored.settings.schemaVersion !== 2) {
      await storage.set({ settings });
      $('saved').textContent = 'Preferences updated. Correction now applies to any selected camera; use the camera filter to limit it.';
    }
    if (stored.lastStatus) $('status').textContent = `${new Date(stored.lastStatus.time).toLocaleTimeString()} · ${stored.lastStatus.message}`;
  }
  async function save() {
    showFilter();
    if (!$('factor').reportValidity()) return;
    if ($('camera').value === 'custom' && (!$('camera-name').value.trim() || $('camera-name').value.trim() === '*')) {
      $('saved').textContent = 'Enter part of the camera name to save this filter.';
      return;
    }
    try {
      const settings = Unsqueeze.normalize({ schemaVersion: 2, enabled: $('enabled').checked,
        factor: $('factor').value, framing: $('framing').value, performance: $('performance').value,
        camera: $('camera').value === '*' ? '*' : $('camera-name').value });
      await storage.set({ settings });
      $('saved').textContent = 'Saved · processing updates live. Restart the call camera to update capture quality.';
    } catch (error) { $('saved').textContent = `Could not save: ${error.message}`; }
  }
  $('preview').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('preview.html') }));
  void initialize().catch(error => { $('saved').textContent = `Could not load preferences: ${error.message}`; });
})();
