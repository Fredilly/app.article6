export async function loadManifestAll() {
  return Array.from({ length: 123 }, (_, i) => ({ id: `M-${i + 1}` }));
}
