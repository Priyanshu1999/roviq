import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { DateTimeScalar, I18nTextScalar } from '@roviq/nestjs-graphql';
import { createConnectionType } from '../../../common/pagination/relay-pagination.model';

@ObjectType({ description: 'Profile snapshot for a reseller team member' })
export class ResellerTeamMemberProfileModel {
  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar, { nullable: true })
  firstName?: I18nContent | null;

  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar, { nullable: true })
  lastName?: I18nContent | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;
}

@ObjectType({
  description:
    'A user who holds a reseller-scope membership in this reseller organisation (i.e. a team member, not a managed institute user)',
})
export class ResellerTeamMemberModel {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  username!: string;

  @Field(() => ID, { description: 'Reseller membership row ID' })
  membershipId!: string;

  @Field(() => ID)
  roleId!: string;

  @Field({ description: 'False when the membership has been deactivated' })
  isActive!: boolean;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => ResellerTeamMemberProfileModel, { nullable: true })
  profile?: ResellerTeamMemberProfileModel | null;
}

export const { ConnectionType: ResellerTeamMemberConnection } = createConnectionType(
  ResellerTeamMemberModel,
  'ResellerTeamMember',
);
