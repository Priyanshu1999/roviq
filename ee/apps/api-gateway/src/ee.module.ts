import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS module convention requires a class with @Module decorator
export class EeModule {
  static async register(): Promise<DynamicModule> {
    const configService = new ConfigService();
    if (configService.get('ROVIQ_EE') !== 'true') {
      return { module: EeModule, imports: [] };
    }

    const modules = [];

    const { BillingModule } = await import('./billing/billing.module.js');
    modules.push(BillingModule);

    return {
      module: EeModule,
      imports: modules,
    };
  }
}
