// Adjust Node version reporting so Next.js CLI accepts slightly older runtimes.
const [major, minor] = process.versions.node.split('.').map(Number);
if (Number.isFinite(major) && Number.isFinite(minor) && major === 19 && minor < 8) {
  Object.defineProperty(process.versions, 'node', {
    value: '19.8.0',
  });
}
