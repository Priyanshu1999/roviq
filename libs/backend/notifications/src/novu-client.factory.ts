import type { ConfigService } from '@nestjs/config';
import { Novu } from '@novu/api';

/**
 * Creates a configured Novu SDK client.
 * When NOVU_MODE=local, points to the self-hosted instance via NOVU_API_URL.
 * When NOVU_MODE=cloud (default), uses Novu Cloud (https://api.novu.co).
 */
export function createNovuClient(config: ConfigService): Novu {
  const novuMode = config.get<string>('NOVU_MODE', 'cloud');
  return new Novu({
    secretKey: config.getOrThrow<string>('NOVU_SECRET_KEY'),
    ...(novuMode === 'local' && {
      serverURL: config.getOrThrow<string>('NOVU_API_URL'),
    }),
  });
}
