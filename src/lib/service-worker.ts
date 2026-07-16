import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
let generationQueue = Promise.resolve();

export async function regenerateServiceWorker() {
  const operation = generationQueue.then(() => execFileAsync(process.execPath, ['build-sw.mjs']));
  generationQueue = operation.then(() => undefined, () => undefined);
  await operation;
}
