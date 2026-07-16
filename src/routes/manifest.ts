import type { FastifyInstance } from 'fastify';
import { readManifest } from '../lib/store.js';

export async function manifestRoutes(app: FastifyInstance) {
  app.get('/api/manifest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return readManifest();
  });
}
