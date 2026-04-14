import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUrl, Matches } from 'class-validator';

@InputType({
  description:
    'Self-service profile update — users can change contact info and personal metadata. ' +
    'Cannot change name, DOB, gender, or identity documents (admin-only fields).',
})
export class UpdateMyProfileInput {
  @Field(() => String, {
    nullable: true,
    description: '10-digit Indian mobile number (starts with 6-9). Null to clear.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Phone must be a valid 10-digit Indian mobile number' })
  phone?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Absolute URL to the profile photo hosted on MinIO/S3. Null to clear.',
  })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'profileImageUrl must be a valid URL' })
  profileImageUrl?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Nationality (free text, e.g. "Indian"). Null to clear.',
  })
  @IsOptional()
  @IsString()
  nationality?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Religion (free text). Null to clear.',
  })
  @IsOptional()
  @IsString()
  religion?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Mother tongue (free text, e.g. "Hindi"). Null to clear.',
  })
  @IsOptional()
  @IsString()
  motherTongue?: string | null;
}
