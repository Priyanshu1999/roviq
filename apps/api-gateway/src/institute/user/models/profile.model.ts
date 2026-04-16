import { createUnionType, Field, ID, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { DateOnlyScalar, I18nTextScalar } from '@roviq/nestjs-graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType({ description: 'Common user profile data (platform-level)' })
export class UserProfileData {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar)
  firstName!: I18nContent;

  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar, { nullable: true })
  lastName?: I18nContent | null;

  @Field(() => String, { nullable: true })
  gender?: string | null;

  @Field(() => DateOnlyScalar, { nullable: true })
  dateOfBirth?: string | null;

  @Field(() => String, { nullable: true })
  bloodGroup?: string | null;

  @Field(() => String, { nullable: true })
  nationality?: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;
}

@ObjectType({ description: 'My profile as a student' })
export class MyStudentProfile {
  @Field()
  type!: string;

  @Field(() => UserProfileData)
  userProfile!: UserProfileData;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Student-specific domain data' })
  studentProfile?: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Current academic placement' })
  academics?: Record<string, unknown>;
}

@ObjectType({ description: 'My profile as a staff member' })
export class MyStaffProfile {
  @Field()
  type!: string;

  @Field(() => UserProfileData)
  userProfile!: UserProfileData;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Staff-specific domain data' })
  staffProfile?: Record<string, unknown>;
}

@ObjectType({ description: 'My profile as a guardian' })
export class MyGuardianProfile {
  @Field()
  type!: string;

  @Field(() => UserProfileData)
  userProfile!: UserProfileData;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Guardian-specific domain data' })
  guardianProfile?: Record<string, unknown>;

  @Field(() => [LinkedChild], { nullable: true, description: 'Children linked to this guardian' })
  children?: LinkedChild[];
}

@ObjectType()
export class LinkedChild {
  @Field(() => ID)
  studentProfileId!: string;

  @Field()
  relationship!: string;

  @Field()
  isPrimaryContact!: boolean;

  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar, { nullable: true })
  firstName?: I18nContent | null;

  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar, { nullable: true })
  lastName?: I18nContent | null;
}

export const MyProfileUnion = createUnionType({
  name: 'MyProfile',
  types: () => [MyStudentProfile, MyStaffProfile, MyGuardianProfile] as const,
  resolveType(value) {
    if (value.type === 'student') return MyStudentProfile;
    if (value.type === 'staff') return MyStaffProfile;
    if (value.type === 'guardian') return MyGuardianProfile;
    return MyStaffProfile;
  },
});
