import { type DynamicModule, type ForwardReference, Module, type Type } from '@nestjs/common';

type NestImport = Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference;

@Module({})
export class EeModule {
  static async register(): Promise<DynamicModule> {
    // NOTE: This is the ONE place where process.env is used directly instead of
    // ConfigService. This is intentional — EeModule.register() runs during module
    // assembly, before the NestJS DI container is initialized and ConfigService
    // is available. This is a bootstrap-time decision, not a runtime one.
    if (process.env['ROVIQ_EE'] !== 'true') {
      return { module: EeModule, imports: [] };
    }

    const modules: NestImport[] = [];

    // Future EE modules are dynamically imported here:
    // const { BillingModule } = await import('./billing/billing.module');
    // modules.push(BillingModule);

    return {
      module: EeModule,
      imports: modules,
    };
  }
}
