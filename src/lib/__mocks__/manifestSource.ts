export async function loadManifestAll() {
  return Array.from({ length: 123 }, (_value, index) => ({ id: `M-${index + 1}` }));
}
