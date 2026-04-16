import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GroupStatus, GroupType, IndianState } from '@roviq/common-types';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import {
  InstituteAddressObject,
  InstituteContactObject,
} from '../../institute/management/models/institute.model';

registerEnumType(GroupType, {
  name: 'GroupType',
  description: 'Legal or organisational type of an institute group.',
});
registerEnumType(GroupStatus, {
  name: 'GroupStatus',
  description: 'Lifecycle state of an institute group.',
});
registerEnumType(IndianState, {
  name: 'IndianState',
  description: 'Indian state or union territory.',
});

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

  @Field(() => IndianState, { nullable: true })
  registrationState?: IndianState | null;

  @Field(() => InstituteContactObject)
  contact!: Record<string, unknown>;

  @Field(() => InstituteAddressObject, { nullable: true })
  address?: Record<string, unknown> | null;

  @Field(() => GroupStatus)
  status!: GroupStatus;

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
