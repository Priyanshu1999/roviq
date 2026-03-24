import { Field, ID, InputType } from '@nestjs/graphql';
import { AuditMask } from '@roviq/audit';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Stub InputTypes for user_identifiers mutations (resolvers come in M2).
 * @AuditMask() ensures value_encrypted and value_plain are redacted in audit logs.
 */

@InputType({
  description: 'Input for creating a user identifier (government ID, registration number)',
})
export class CreateUserIdentifierInput {
  @IsUUID()
  @Field(() => ID)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @Field({ description: 'Identifier type key (e.g. aadhaar, pan, apaar, pen)' })
  type!: string;

  @AuditMask()
  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description:
      'Raw value for sensitive identifiers (Aadhaar, PAN) — will be encrypted before storage',
  })
  valueEncrypted?: string;

  @AuditMask()
  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: 'Plain value for non-sensitive identifiers (APAAR, PEN, registration numbers)',
  })
  valuePlain?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Authority that issued this identifier' })
  issuingAuthority?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Date from which this identifier is valid (ISO 8601)' })
  validFrom?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Date until which this identifier is valid (ISO 8601)' })
  validTo?: string;
}

@InputType({ description: 'Input for updating a user identifier' })
export class UpdateUserIdentifierInput {
  @AuditMask()
  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Updated raw value — will be re-encrypted' })
  valueEncrypted?: string;

  @AuditMask()
  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Updated plain value' })
  valuePlain?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Updated issuing authority' })
  issuingAuthority?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Updated valid-from date (ISO 8601)' })
  validFrom?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Updated valid-to date (ISO 8601)' })
  validTo?: string;
}
