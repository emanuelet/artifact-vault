import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { getDataDirectory } from './store.js';

interface StoredCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

interface PasskeyData {
  credentials: StoredCredential[];
}

interface Challenge {
  value: string;
  expiresAt: number;
}

const challenges = new Map<string, Challenge>();
const sessions = new Map<string, number>();
const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const challengeDuration = 5 * 60 * 1000;

function passkeyPath() {
  return join(getDataDirectory(), 'passkeys.json');
}

async function readPasskeys(): Promise<PasskeyData> {
  try {
    return JSON.parse(await readFile(passkeyPath(), 'utf8')) as PasskeyData;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { credentials: [] };
    throw error;
  }
}

async function writePasskeys(data: PasskeyData) {
  const path = passkeyPath();
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
}

function rememberChallenge(value: string) {
  const id = randomBytes(24).toString('base64url');
  challenges.set(id, { value, expiresAt: Date.now() + challengeDuration });
  return id;
}

function consumeChallenge(id: string | undefined) {
  if (!id) return undefined;
  const challenge = challenges.get(id);
  challenges.delete(id);
  return challenge && challenge.expiresAt > Date.now() ? challenge.value : undefined;
}

export function isPasskeyAuthEnabled() {
  return process.env.WEBAUTHN_DISABLED !== 'true';
}

export function getPasskeyConfig() {
  const rpID = process.env.WEBAUTHN_RP_ID;
  const origin = process.env.WEBAUTHN_ORIGIN;
  const setupToken = process.env.WEBAUTHN_SETUP_TOKEN;
  if (!rpID || !origin || !setupToken) throw new Error('WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN, and WEBAUTHN_SETUP_TOKEN are required');
  return { rpID, origin, setupToken };
}

export async function getPasskeyStatus() {
  return { configured: (await readPasskeys()).credentials.length > 0 };
}

export async function registrationOptions(setupToken: string | undefined) {
  const { rpID, setupToken: expectedSetupToken } = getPasskeyConfig();
  const data = await readPasskeys();
  if (data.credentials.length > 0 || setupToken !== expectedSetupToken) throw new Error('Registration is not allowed');

  const options = await generateRegistrationOptions({
    rpName: 'Artifact Vault',
    rpID,
    userName: 'vault-owner',
    userDisplayName: 'Artifact Vault owner',
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      userVerification: 'required',
    },
  });
  return { options, challengeId: rememberChallenge(options.challenge) };
}

export async function registerPasskey(response: RegistrationResponseJSON, challengeId: string | undefined) {
  const { rpID, origin } = getPasskeyConfig();
  const expectedChallenge = consumeChallenge(challengeId);
  if (!expectedChallenge) throw new Error('Registration challenge expired');

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error('Passkey registration failed');

  const data = await readPasskeys();
  const credential = verification.registrationInfo.credential;
  data.credentials.push({
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports,
  });
  await writePasskeys(data);
}

export async function authenticationOptions() {
  const { rpID } = getPasskeyConfig();
  const data = await readPasskeys();
  if (data.credentials.length === 0) throw new Error('No passkey enrolled');
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: data.credentials.map((credential) => ({ id: credential.id, transports: credential.transports })),
  });
  return { options, challengeId: rememberChallenge(options.challenge) };
}

export async function authenticatePasskey(response: AuthenticationResponseJSON, challengeId: string | undefined) {
  const { rpID, origin } = getPasskeyConfig();
  const expectedChallenge = consumeChallenge(challengeId);
  if (!expectedChallenge) throw new Error('Authentication challenge expired');
  const data = await readPasskeys();
  const stored = data.credentials.find((credential) => credential.id === response.id);
  if (!stored) throw new Error('Unknown passkey');

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: stored.id,
      publicKey: Buffer.from(stored.publicKey, 'base64url'),
      counter: stored.counter,
      transports: stored.transports,
    },
    requireUserVerification: true,
  });
  if (!verification.verified) throw new Error('Passkey authentication failed');
  stored.counter = verification.authenticationInfo.newCounter;
  await writePasskeys(data);

  const session = randomBytes(32).toString('base64url');
  sessions.set(session, Date.now() + sessionDuration);
  return session;
}

export function hasPasskeySession(session: string | undefined) {
  if (!session) return false;
  const expiresAt = sessions.get(session);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(session);
    return false;
  }
  return true;
}

export function removePasskeySession(session: string | undefined) {
  if (session) sessions.delete(session);
}
