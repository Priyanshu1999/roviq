import { Field, InputType, Int } from '@nestjs/graphql';
import { IndianState } from '@roviq/common-types';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import { IsEnum, IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import {
  InstituteAddressInput,
  InstituteContactInput,
} from '../../institute/management/dto/create-institute.input';

@InputType({
  description:
    'Fields that can be updated on an existing institute group. All fields are optional.',
})
export class UpdateInstituteGroupInput {
  @Field(() => Int, {
    description: 'Optimistic concurrency version counter — must match current server value.',
  })
  @IsInt()
  version!: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @Field(() => IndianState, { nullable: true })
  @IsEnum(IndianState)
  @IsOptional()
  registrationState?: IndianState;

  @Field(() => InstituteContactInput, {
    nullable: true,
    description: 'Updated primary contact details for the group.',
  })
  @IsObject()
  @IsOptional()
  contact?: InstituteContact;

  @Field(() => InstituteAddressInput, {
    nullable: true,
    description: 'Updated registered address of the group.',
  })
  @IsObject()
  @IsOptional()
  address?: InstituteAddress;
}
