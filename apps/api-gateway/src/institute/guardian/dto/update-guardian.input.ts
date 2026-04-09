import { Field, InputType, Int } from '@nestjs/graphql';
import { GuardianEducationLevel } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

// Validator `message:` strings below are hardcoded English pending
// backend i18n (ROV-222). Once that lands, swap each to
// `i18nValidationMessage('validation.guardian.*')`.

@InputType({
  description:
    'Input for updating a guardian profile. All fields are optional; only dirty fields are sent. Optimistic concurrency enforced via the `version` field.',
})
export class UpdateGuardianInput {
  @Field(() => I18nTextScalar, {
    nullable: true,
    description:
      'Guardian first name as an i18nText map. Only sent when the form dirties this field.',
  })
  @IsOptional()
  @IsObject()
  firstName?: I18nContent;

  @Field(() => I18nTextScalar, {
    nullable: true,
    description: 'Guardian last name as an i18nText map.',
  })
  @IsOptional()
  @IsObject()
  lastName?: I18nContent;

  @Field(() => String, {
    nullable: true,
    description: 'Guardian occupation (free text).',
  })
  @IsOptional()
  @IsString()
  occupation?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Employer / organisation the guardian works at (free text).',
  })
  @IsOptional()
  @IsString()
  organization?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Guardian job title inside their organisation (free text).',
  })
  @IsOptional()
  @IsString()
  designation?: string;

  @Field(() => GuardianEducationLevel, {
    nullable: true,
    description:
      "Guardian's highest completed education level. Constrained enum — mirrors the chk_education_level DB constraint.",
  })
  @IsOptional()
  @IsEnum(GuardianEducationLevel, {
    message: `educationLevel must be one of: ${Object.values(GuardianEducationLevel).join(', ')}`,
  })
  educationLevel?: GuardianEducationLevel;

  @Field(() => Int, {
    description:
      'Current version the client read. The update fails with a ConflictException when the stored row has a higher version.',
  })
  @IsInt({ message: 'version must be an integer' })
  @Min(0, { message: 'version must be >= 0' })
  version!: number;
}
