export function restoreAurora() {
  try {
    const color = localStorage.getItem('trilorah.aurora') ?? 'fern';
    document.documentElement.dataset.aurora = ['fern', 'iris', 'tide', 'ember', 'rose'].includes(color) ? color : 'fern';
  } catch { /* The default palette works without storage. */ }
}
