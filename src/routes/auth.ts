import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import type { FastifyInstance } from 'fastify';
import {
  authenticatePasskey,
  authenticationOptions,
  getPasskeyStatus,
  hasPasskeySession,
  isPasskeyAuthEnabled,
  registerPasskey,
  registrationOptions,
  removePasskeySession,
} from '../lib/passkeys.js';
import { authHtml } from '../views/auth.html.js';

const require = createRequire(import.meta.url);
const browserBundle = join(dirname(require.resolve('@simplewebauthn/browser')), '../dist/bundle/index.umd.min.js');

function sessionFromRequest(request: { cookies: Record<string, string | undefined> }) {
  return request.cookies.vault_session;
}

function setSessionCookie(reply: { setCookie: (name: string, value: string, options: object) => unknown }, session: string) {
  reply.setCookie('vault_session', session, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function requiresPasskey(request: { method: string; url: string; cookies: Record<string, string | undefined> }) {
  if (!isPasskeyAuthEnabled() || hasPasskeySession(sessionFromRequest(request))) return false;
  return request.method === 'GET' && (request.url === '/' || request.url.startsWith('/artifacts/') || request.url.startsWith('/api/manifest'));
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/auth', async (_request, reply) => reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(authHtml()));
  app.get('/auth/webauthn.js', async (_request, reply) => reply.type('application/javascript; charset=utf-8').header('Cache-Control', 'public, max-age=31536000, immutable').send(await readFile(browserBundle, 'utf8')));
  app.get('/auth/status', async () => getPasskeyStatus());
  app.post('/auth/register/options', async (request, reply) => {
    const setupToken = request.headers['x-setup-token'];
    try { return await registrationOptions(typeof setupToken === 'string' ? setupToken : undefined); } catch (error) { return reply.code(403).send({ error: error instanceof Error ? error.message : 'Registration failed' }); }
  });
  app.post('/auth/register/verify', async (request, reply) => {
    try { await registerPasskey((request.body as { response: never }).response, (request.body as { challengeId?: string }).challengeId); return { status: 'ok' }; } catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : 'Registration failed' }); }
  });
  app.post('/auth/login/options', async (_request, reply) => {
    try { return await authenticationOptions(); } catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : 'Authentication failed' }); }
  });
  app.post('/auth/login/verify', async (request, reply) => {
    try { const body = request.body as { response: never; challengeId?: string }; setSessionCookie(reply, await authenticatePasskey(body.response, body.challengeId)); return { status: 'ok' }; } catch (error) { return reply.code(401).send({ error: error instanceof Error ? error.message : 'Authentication failed' }); }
  });
  app.post('/auth/logout', async (request, reply) => { removePasskeySession(sessionFromRequest(request)); reply.clearCookie('vault_session', { path: '/' }); return { status: 'ok' }; });
}
