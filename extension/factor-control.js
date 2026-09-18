// Presets and manual entry share the same saved numeric factor.
Unsqueeze.bindFactorControl = function (root = document) {
  const preset = root.getElementById('factor-preset');
  const factor = root.getElementById('factor');
  const values = [1, 1.25, 1.33, 1.5, 1.6, 1.8, 2];
  preset.replaceChildren(
    ...values.map(value => new Option(value === 1 ? '1× · Original' : `${value}×`, String(value))),
    new Option('Custom…', 'custom')
  );
  function sync() {
    const value = Number(factor.value);
    preset.value = factor.validity.valid && values.includes(value) ? String(value) : 'custom';
  }
  factor.addEventListener('input', sync);
  factor.addEventListener('change', sync);
  preset.addEventListener('change', () => {
    if (preset.value === 'custom') {
      factor.focus();
      factor.select();
      return;
    }
    factor.value = preset.value;
    factor.dispatchEvent(new Event('change', { bubbles: true }));
  });
  sync();
  return { sync };
};
