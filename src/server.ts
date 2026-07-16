import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { regenerateServiceWorker } from './lib/service-worker.js';
import { ensureStore } from './lib/store.js';
import { artifactRoutes } from './routes/artifacts.js';
import { galleryRoutes } from './routes/gallery.js';
import { manifestRoutes } from './routes/manifest.js';

declare module 'fastify' {
  interface FastifyInstance {
    regenerateServiceWorker: () => Promise<void>;
  }
}

export async function buildApp(options: { regenerateServiceWorker?: () => Promise<void> } = {}) {
  const app = Fastify({ logger: true, bodyLimit: 11 * 1024 * 1024 });
  app.decorate('regenerateServiceWorker', options.regenerateServiceWorker ?? regenerateServiceWorker);

  await ensureStore();
  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'public'),
    prefix: '/',
    setHeaders(response, filePath) {
      if (filePath.endsWith('/sw.js')) response.setHeader('Cache-Control', 'no-cache');
    },
  });
  await app.register(galleryRoutes);
  await app.register(manifestRoutes);
  await app.register(artifactRoutes);
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
}
