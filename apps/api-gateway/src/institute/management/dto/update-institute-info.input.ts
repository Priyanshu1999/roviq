import { Field, InputType, Int } from '@nestjs/graphql';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { IsInt, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { InstituteAddressInput, InstituteContactInput } from './create-institute.input';

@InputType({
  description:
    'Updatable identity fields for an institute. Requires version for optimistic concurrency.',
})
export class UpdateInstituteInfoInput {
  @IsInt()
  @Field(() => Int, {
    description:
      'Current version — used for optimistic concurrency. Fails with ConflictException if stale.',
  })
  version!: number;

  @Field(() => I18nTextScalar, {
    nullable: true,
    description: 'Localised institute name, e.g. { en: "Sunrise Academy", hi: "सनराइज़ अकैडमी" }.',
  })
  @IsObject()
  @IsOptional()
  name?: Record<string, string>;

  @Field({
    nullable: true,
    description: 'Short internal code for the institute, e.g. "SAJ". Unique per reseller.',
  })
  @IsString()
  @IsOptional()
  code?: string;

  @Field(() => InstituteContactInput, {
    nullable: true,
    description: 'Phone and email contact details.',
  })
  @IsObject()
  @IsOptional()
  contact?: InstituteContact;

  @Field(() => InstituteAddressInput, {
    nullable: true,
    description: 'Physical address of the institute.',
  })
  @IsObject()
  @IsOptional()
  address?: InstituteAddress;

  @Field({
    nullable: true,
    description:
      'IANA timezone identifier, e.g. "Asia/Kolkata". Defaults to Asia/Kolkata if not set.',
  })
  @IsString()
  @IsOptional()
  timezone?: string;

  @Field({
    nullable: true,
    description: 'ISO 4217 currency code (exactly 3 characters), e.g. "INR".',
  })
  @IsString()
  @Length(3, 3)
  @IsOptional()
  currency?: string;
}
