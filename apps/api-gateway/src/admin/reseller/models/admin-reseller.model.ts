/**
 * GraphQL models for the admin reseller management surface (ROV-234).
 *
 * Mirrors the `resellers` Drizzle table (libs/database/src/schema/reseller/resellers.ts)
 * and registers the two reseller enums with NestJS GraphQL so the SDL surfaces
 * them as first-class types — keeping the frontend TypeScript enums in lockstep
 * via codegen.
 */
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ResellerStatus, ResellerTier } from '@roviq/common-types';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import { createConnectionType } from '../../../common/pagination/relay-pagination.model';

registerEnumType(ResellerTier, {
  name: 'ResellerTier',
  description: 'Tier controlling what a reseller can do with its assigned institutes',
});

registerEnumType(ResellerStatus, {
  name: 'ResellerStatus',
  description: 'Lifecycle state of a reseller account',
});

/**
 * Structured branding descriptor stored in the `resellers.branding` JSONB column.
 * All fields optional — defaults are applied by the reseller-admin portal when
 * absent. Logo and favicon are URLs served from the tenant storage bucket.
 */
@ObjectType({ description: 'Reseller branding configuration (logo, colors, favicon)' })
export class ResellerBrandingModel {
  @Field(() => String, { nullable: true, description: 'URL of the reseller logo image' })
  logoUrl?: string | null;

  @Field(() => String, { nullable: true, description: 'URL of the reseller favicon' })
  faviconUrl?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Primary brand colour as a hex code (e.g. "#1677FF")',
  })
  primaryColor?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Secondary/accent brand colour as a hex code',
  })
  secondaryColor?: string | null;
}

@ObjectType({ description: 'Platform-admin view of a reseller account' })
export class AdminResellerModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, {
    description:
      'URL-safe slug, globally unique. Immutable after creation (changing it breaks URLs).',
  })
  slug!: string;

  @Field(() => ResellerTier)
  tier!: ResellerTier;

  @Field(() => ResellerStatus)
  status!: ResellerStatus;

  @Field(() => Boolean, {
    description:
      'True for the built-in "Roviq Direct" reseller — cannot be suspended, deleted, or have its tier changed',
  })
  isSystem!: boolean;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => ResellerBrandingModel, { nullable: true })
  branding?: ResellerBrandingModel | null;

  @Field(() => String, {
    nullable: true,
    description: 'Custom vanity domain (deferred — placeholder for PRD §23.4)',
  })
  customDomain?: string | null;

  @Field(() => DateTimeScalar, {
    nullable: true,
    description: 'Timestamp of most recent suspension; null when active',
  })
  suspendedAt?: Date | null;

  @Field(() => DateTimeScalar, {
    nullable: true,
    description: 'Soft-delete timestamp; set when status=DELETED',
  })
  deletedAt?: Date | null;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;

  @Field(() => Int, {
    description: 'Number of non-deleted institutes currently assigned to this reseller',
  })
  instituteCount!: number;

  @Field(() => Int, {
    description: 'Number of active reseller_memberships (staff accounts) for this reseller',
  })
  teamSize!: number;
}

export const { ConnectionType: AdminResellerConnection, EdgeType: AdminResellerEdge } =
  createConnectionType(AdminResellerModel, 'AdminReseller');
