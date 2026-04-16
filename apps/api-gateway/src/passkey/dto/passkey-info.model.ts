import { Field, ObjectType } from '@nestjs/graphql';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class PasskeyInfo {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  deviceType!: string;

  @Field()
  backedUp!: boolean;

  @Field(() => DateTimeScalar)
  registeredAt!: Date;

  @Field(() => DateTimeScalar, { nullable: true })
  lastUsedAt?: Date;
}

@ObjectType()
export class PasskeyAuthOptions {
  @Field(() => GraphQLJSON)
  optionsJSON!: Record<string, unknown>;

  @Field()
  challengeId!: string;
}
