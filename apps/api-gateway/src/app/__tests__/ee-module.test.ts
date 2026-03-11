import { EeModule } from '@roviq/ee-gateway';
import { describe, expect, it } from 'vitest';

describe('EeModule', () => {
  it('should return empty imports when ROVIQ_EE is not set', async () => {
    delete process.env.ROVIQ_EE;

    const result = await EeModule.register();

    expect(result.module).toBe(EeModule);
    expect(result.imports).toEqual([]);
  });

  it('should return empty imports when ROVIQ_EE is false', async () => {
    process.env.ROVIQ_EE = 'false';

    const result = await EeModule.register();

    expect(result.imports).toEqual([]);

    delete process.env.ROVIQ_EE;
  });

  it('should return a valid DynamicModule when ROVIQ_EE is true', async () => {
    process.env.ROVIQ_EE = 'true';

    const result = await EeModule.register();

    expect(result.module).toBe(EeModule);
    expect(Array.isArray(result.imports)).toBe(true);

    delete process.env.ROVIQ_EE;
  });
});
