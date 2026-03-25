import { Field, InputType, Int } from '@nestjs/graphql';

@InputType({
  description: 'Input for updating guardian profile — optimistic concurrency via version',
})
export class UpdateGuardianInput {
  @Field(() => String, { nullable: true })
  occupation?: string;

  @Field(() => String, { nullable: true })
  organization?: string;

  @Field(() => String, { nullable: true })
  educationLevel?: string;

  @Field(() => Int, { description: 'Current version for optimistic concurrency' })
  version!: number;
}
