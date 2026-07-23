import { generateSW } from 'workbox-build';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const artifactsDirectory = join(process.env.VAULT_DATA_DIR ?? 'data', 'artifacts');
const artifactEntries = await readdir(artifactsDirectory, { withFileTypes: true }).then(async (entries) => Promise.all(
  entries.filter((entry) => entry.isFile() && entry.name.endsWith('.html')).map(async (entry) => {
    const contents = await readFile(join(artifactsDirectory, entry.name));
    return {
      url: `/artifacts/${entry.name}`,
      revision: createHash('sha256').update(contents).digest('hex'),
    };
  }),
));
const revision = Date.now().toString();

const { count, size, warnings } = await generateSW({
  globDirectory: '.',
  globPatterns: ['public/manifest.webmanifest', 'public/icons/*.svg'],
  modifyURLPrefix: { 'public/': '/' },
  swDest: 'public/sw.js',
  additionalManifestEntries: [
    { url: '/auth', revision },
    ...artifactEntries,
  ],
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.pathname === '/' || url.pathname === '/api/manifest',
      handler: 'NetworkFirst',
      options: { cacheName: 'vault-shell' },
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/artifacts/'),
      handler: 'CacheFirst',
      options: { cacheName: 'artifacts-runtime' },
    },
  ],
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  skipWaiting: true,
  clientsClaim: true,
});

if (warnings.length) console.warn(warnings.join('\n'));
console.log(`Precached ${count} files, ${size} bytes.`);
