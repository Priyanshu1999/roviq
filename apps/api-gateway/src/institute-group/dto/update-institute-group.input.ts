import { Field, InputType, Int } from '@nestjs/graphql';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import { IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import {
  InstituteAddressInput,
  InstituteContactInput,
} from '../../institute/management/dto/create-institute.input';

@InputType()
export class UpdateInstituteGroupInput {
  @Field(() => Int)
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

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  registrationState?: string;

  @Field(() => InstituteContactInput, { nullable: true })
  @IsObject()
  @IsOptional()
  contact?: InstituteContact;

  @Field(() => InstituteAddressInput, { nullable: true })
  @IsObject()
  @IsOptional()
  address?: InstituteAddress;
}
