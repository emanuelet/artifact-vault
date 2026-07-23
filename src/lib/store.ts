import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Manifest } from './types.js';

let manifestQueue = Promise.resolve();

export function getDataDirectory() {
  return process.env.VAULT_DATA_DIR ?? join(process.cwd(), 'data');
}

function getManifestPath() {
  return join(getDataDirectory(), 'manifest.json');
}

export function getArtifactsDirectory() {
  return join(getDataDirectory(), 'artifacts');
}

export async function ensureStore() {
  const artifactsDirectory = getArtifactsDirectory();
  const manifestPath = getManifestPath();
  await mkdir(artifactsDirectory, { recursive: true });
  try {
    await readFile(manifestPath, 'utf8');
  } catch (error: unknown) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    await writeManifest({ artifacts: [] });
  }
}

export async function readManifest(): Promise<Manifest> {
  await ensureStore();
  const manifest = JSON.parse(await readFile(getManifestPath(), 'utf8')) as Manifest;
  if (!Array.isArray(manifest.artifacts)) throw new Error('Invalid manifest');
  return manifest;
}

export async function writeManifest(manifest: Manifest) {
  const manifestPath = getManifestPath();
  await mkdir(dirname(manifestPath), { recursive: true });
  const temporaryPath = `${manifestPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, manifestPath);
}

export async function updateManifest<T>(update: (manifest: Manifest) => Promise<T> | T): Promise<T> {
  const operation = manifestQueue.then(async () => {
    const manifest = await readManifest();
    const result = await update(manifest);
    await writeManifest(manifest);
    return result;
  });
  manifestQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
