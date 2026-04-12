import { requireBackend } from '../shared/preflight.js';

export async function setup(): Promise<void> {
  await requireBackend();
}
