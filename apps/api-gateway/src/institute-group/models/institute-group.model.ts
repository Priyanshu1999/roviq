import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GroupType } from '@roviq/common-types';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import {
  InstituteAddressObject,
  InstituteContactObject,
} from '../../institute/management/models/institute.model';

export enum GroupStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

registerEnumType(GroupType, { name: 'GroupType' });
registerEnumType(GroupStatusEnum, { name: 'GroupStatus' });

@ObjectType()
export class InstituteGroupModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => GroupType)
  type!: GroupType;

  @Field(() => String, { nullable: true })
  registrationNumber?: string | null;

  @Field(() => String, { nullable: true })
  registrationState?: string | null;

  @Field(() => InstituteContactObject)
  contact!: Record<string, unknown>;

  @Field(() => InstituteAddressObject, { nullable: true })
  address?: Record<string, unknown> | null;

  @Field(() => GroupStatusEnum)
  status!: GroupStatusEnum;

  @Field()
  createdBy!: string;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => Int, { description: 'Optimistic concurrency version counter' })
  version!: number;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;

  @Field(() => Int, {
    nullable: true,
    description: 'Number of institutes in this group (populated by list queries)',
  })
  instituteCount?: number;
}
