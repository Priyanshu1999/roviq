import { Module } from '@nestjs/common';
import { IdentityCryptoService } from './encrypted-field';

@Module({
  providers: [IdentityCryptoService],
  exports: [IdentityCryptoService],
})
export class CryptoModule {}
