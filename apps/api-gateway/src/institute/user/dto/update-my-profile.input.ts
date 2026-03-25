import { Field, InputType } from '@nestjs/graphql';

@InputType({
  description: 'Self-service profile update. Cannot change name, DOB, or identity documents.',
})
export class UpdateMyProfileInput {
  @Field(() => String, { nullable: true, description: 'Phone number (10-digit Indian mobile)' })
  phone?: string;

  @Field(() => String, { nullable: true, description: 'Profile image URL' })
  profileImageUrl?: string;

  @Field(() => String, { nullable: true, description: 'Nationality' })
  nationality?: string;

  @Field(() => String, { nullable: true, description: 'Religion' })
  religion?: string;

  @Field(() => String, { nullable: true, description: 'Mother tongue' })
  motherTongue?: string;
}
