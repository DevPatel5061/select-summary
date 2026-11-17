// Share behavior, not layout, between setup and replacement forms.
export function createKeyField(input, reveal) {
  function mask() {
    input.type = 'password';
    reveal.setAttribute('aria-label', 'Show entered key');
    reveal.setAttribute('aria-pressed', 'false');
  }
  reveal.addEventListener('click', () => {
    if (input.type === 'text') return mask();
    input.type = 'text';
    reveal.setAttribute('aria-label', 'Hide entered key');
    reveal.setAttribute('aria-pressed', 'true');
  });
  return {
    mask,
    clear() {
      input.value = '';
      mask();
    }
  };
}
