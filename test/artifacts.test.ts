import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

let dataDirectory: string;
let app: FastifyInstance;

beforeEach(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), 'artifact-vault-'));
  process.env.VAULT_DATA_DIR = dataDirectory;
  process.env.INGEST_TOKEN = 'test-token';
  process.env.WEBAUTHN_DISABLED = 'true';
  const { buildApp } = await import('../src/server.js');
  app = await buildApp({ regenerateServiceWorker: async () => {} });
});

afterEach(async () => {
  await app.close();
  await rm(dataDirectory, { recursive: true, force: true });
  delete process.env.VAULT_DATA_DIR;
  delete process.env.INGEST_TOKEN;
  delete process.env.WEBAUTHN_DISABLED;
});

describe('artifact API', () => {
  it('requires a token to ingest', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/artifacts', payload: { html: '<h1>x</h1>', title: 'X' } });
    expect(response.statusCode).toBe(401);
  });

  it('stores a manifest-backed artifact and serves it sandboxed', async () => {
    const upload = await app.inject({
      method: 'POST',
      url: '/api/artifacts',
      headers: { authorization: 'Bearer test-token' },
      payload: { html: '<h1>Hello</h1>', title: 'Hello', tags: ['test'], source: 'chatgpt' },
    });
    expect(upload.statusCode).toBe(200);
    const { id } = upload.json() as { id: string };

    const manifest = await app.inject({ method: 'GET', url: '/api/manifest' });
    expect(manifest.json().artifacts).toMatchObject([{ id, bucket: 'operational', tags: ['test'] }]);

    const artifact = await app.inject({ method: 'GET', url: `/artifacts/${id}.html` });
    expect(artifact.statusCode).toBe(200);
    expect(artifact.headers['content-security-policy']).toContain('sandbox');
    expect(artifact.body).toContain('<h1>Hello</h1>');
  });

  it('deduplicates HTML and deletes both index and file', async () => {
    const request = { method: 'POST' as const, url: '/api/artifacts', headers: { authorization: 'Bearer test-token' }, payload: { html: '<p>same</p>', title: 'One' } };
    const first = await app.inject(request);
    const { id } = first.json() as { id: string };
    const duplicate = await app.inject(request);
    expect(duplicate.json()).toMatchObject({ id, status: 'exists' });

    const deleted = await app.inject({ method: 'DELETE', url: `/api/artifacts/${id}`, headers: { authorization: 'Bearer test-token' } });
    expect(deleted.statusCode).toBe(200);
    await expect(readFile(join(dataDirectory, 'artifacts', `${id}.html`))).rejects.toThrow();
    expect((await app.inject('/api/manifest')).json().artifacts).toEqual([]);
  });

  it('allows explicit promotion to the understanding bucket', async () => {
    const upload = await app.inject({ method: 'POST', url: '/api/artifacts', headers: { authorization: 'Bearer test-token' }, payload: { html: '<p>keep</p>', title: 'Keep' } });
    const { id } = upload.json() as { id: string };
    const response = await app.inject({ method: 'PATCH', url: `/api/artifacts/${id}`, headers: { authorization: 'Bearer test-token' }, payload: { bucket: 'understanding' } });
    expect(response.json()).toMatchObject({ status: 'updated', bucket: 'understanding' });
    expect((await app.inject('/api/manifest')).json().artifacts[0].bucket).toBe('understanding');
  });

  it('renders uploaded artifacts in the sandboxed gallery', async () => {
    await app.inject({ method: 'POST', url: '/api/artifacts', headers: { authorization: 'Bearer test-token' }, payload: { html: '<p>gallery</p>', title: 'Gallery artifact' } });
    const response = await app.inject('/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Gallery artifact');
    expect(response.body).toContain('sandbox="allow-scripts');
  });

  it('redirects vault reads to the passkey gate when enabled', async () => {
    process.env.WEBAUTHN_DISABLED = 'false';
    const response = await app.inject('/');
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/auth');
    process.env.WEBAUTHN_DISABLED = 'true';
  });
});
