import { Field, InputType } from '@nestjs/graphql';
import { AuditMask } from '@roviq/audit';
import { GuardianEducationLevel } from '@roviq/common-types';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Stub InputTypes for guardian_profiles mutations (resolvers come in M2).
 * @AuditMask() on annualIncome — sensitive for RTE eligibility verification.
 */

@InputType({ description: 'Input for creating a guardian profile at an institute' })
export class CreateGuardianProfileInput {
  @IsUUID()
  @Field({ description: 'User ID of the guardian' })
  userId!: string;

  @IsUUID()
  @Field({ description: 'Membership ID linking user to this institute' })
  membershipId!: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: "Guardian's occupation" })
  occupation?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Employer name' })
  organization?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Job title at the organization' })
  designation?: string;

  @IsOptional()
  @IsEnum(GuardianEducationLevel)
  @Field(() => GuardianEducationLevel, {
    nullable: true,
    description: 'Highest completed education qualification.',
  })
  educationLevel?: GuardianEducationLevel;

  @AuditMask()
  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description:
      'Annual household income in paise (BIGINT string) — redacted in audit logs for RTE privacy',
  })
  annualIncome?: string;
}

@InputType({ description: 'Input for updating a guardian profile' })
export class UpdateGuardianProfileInput {
  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: "Guardian's occupation" })
  occupation?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Employer name' })
  organization?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true, description: 'Job title at the organization' })
  designation?: string;

  @IsOptional()
  @IsEnum(GuardianEducationLevel)
  @Field(() => GuardianEducationLevel, {
    nullable: true,
    description: 'Highest completed education qualification.',
  })
  educationLevel?: GuardianEducationLevel;

  @AuditMask()
  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description:
      'Annual household income in paise (BIGINT string) — redacted in audit logs for RTE privacy',
  })
  annualIncome?: string;
}
