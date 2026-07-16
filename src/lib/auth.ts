import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

export function hasIngestAccess(request: FastifyRequest) {
  const token = process.env.INGEST_TOKEN;
  const authorization = request.headers.authorization;
  if (!token || !authorization) return false;

  const provided = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${token}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
