import type { FastifyInstance } from 'fastify';
import { readManifest } from '../lib/store.js';
import { galleryHtml } from '../views/gallery.html.js';

export async function galleryRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const query = request.query as { bucket?: string; tag?: string; selected?: string };
    const manifest = await readManifest();
    const artifacts = manifest.artifacts.filter((artifact) =>
      (!query.bucket || artifact.bucket === query.bucket) && (!query.tag || artifact.tags.includes(query.tag)),
    );
    reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-cache');
    return galleryHtml(artifacts, query.selected);
  });
}
