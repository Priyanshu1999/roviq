/**
 * Input for `adminUpdateReseller` mutation (ROV-234).
 *
 * Editable fields: name, branding, customDomain. Slug is NOT updatable
 * (changing would break URLs), and tier has its own dedicated mutation
 * (`adminChangeResellerTier`) because it cascades to memberships.
 */
import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsFQDN,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AdminResellerBrandingInput } from './admin-create-reseller.input';

@InputType({
  description: 'Payload for adminUpdateReseller — slug and tier are not updatable here',
})
export class AdminUpdateResellerInput {
  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @Field(() => AdminResellerBrandingInput, { nullable: true })
  @ValidateNested()
  @Type(() => AdminResellerBrandingInput)
  @IsOptional()
  branding?: AdminResellerBrandingInput;

  @Field(() => String, { nullable: true })
  @IsFQDN({ require_tld: true })
  @IsOptional()
  @MaxLength(255)
  customDomain?: string;
}
