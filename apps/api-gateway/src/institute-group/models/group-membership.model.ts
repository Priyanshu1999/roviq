import { Field, ID, ObjectType } from '@nestjs/graphql';
import { DateTimeScalar } from '@roviq/nestjs-graphql';

@ObjectType()
export class GroupMembershipModel {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  groupId!: string;

  @Field()
  roleId!: string;

  @Field()
  isActive!: boolean;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}
