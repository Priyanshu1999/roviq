import { ConfigService } from '@nestjs/config';
import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class AppResolver {
  constructor(private readonly config: ConfigService) {}

  @Query(() => String, { description: 'Returns the current Roviq edition: ce or ee' })
  edition(): string {
    return this.config.get('ROVIQ_EE') === 'true' ? 'ee' : 'ce';
  }
}
