/**
 * Input for `adminCreateReseller` mutation (ROV-234).
 *
 * The mutation creates a reseller row, provisions the initial admin user
 * (via IdentityService), and attaches them as a reseller_membership with the
 * tier's matching system role.
 *
 * Slug is optional — when omitted the service derives it from `name`.
 * Custom domain is a placeholder per auth PRD §23.4 (deferred).
 */
import { Field, InputType } from '@nestjs/graphql';
import { ResellerTier } from '@roviq/common-types';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsFQDN,
  IsHexColor,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

@InputType({ description: 'Optional branding configuration stored on reseller.branding (JSONB)' })
export class AdminResellerBrandingInput {
  @Field(() => String, { nullable: true })
  @IsUrl()
  @IsOptional()
  @MaxLength(2048)
  logoUrl?: string;

  @Field(() => String, { nullable: true })
  @IsUrl()
  @IsOptional()
  @MaxLength(2048)
  faviconUrl?: string;

  @Field(() => String, { nullable: true, description: 'Hex colour (e.g. #1677FF)' })
  @IsHexColor()
  @IsOptional()
  primaryColor?: string;

  @Field(() => String, { nullable: true, description: 'Hex colour (e.g. #5BC0EB)' })
  @IsHexColor()
  @IsOptional()
  secondaryColor?: string;
}

@InputType({ description: 'Payload for adminCreateReseller' })
export class AdminCreateResellerInput {
  @Field(() => String)
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  /**
   * URL-safe slug. Optional — the service auto-generates from `name` when absent.
   * Pattern restricts to lowercase alphanumerics + hyphens to keep URLs + DNS clean.
   */
  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumerics and hyphens (e.g. "acme-partners")',
  })
  slug?: string;

  @Field(() => ResellerTier)
  @IsEnum(ResellerTier)
  tier!: ResellerTier;

  /** Email address for the initial reseller admin. Creates a user + reseller_membership. */
  @Field(() => String)
  @IsEmail()
  @MaxLength(320)
  initialAdminEmail!: string;

  @Field(() => AdminResellerBrandingInput, { nullable: true })
  @ValidateNested()
  @Type(() => AdminResellerBrandingInput)
  @IsOptional()
  branding?: AdminResellerBrandingInput;

  /** Deferred — placeholder per auth PRD §23.4; stored as null if unsupported */
  @Field(() => String, { nullable: true })
  @IsFQDN({ require_tld: true })
  @IsOptional()
  @MaxLength(255)
  customDomain?: string;
}
