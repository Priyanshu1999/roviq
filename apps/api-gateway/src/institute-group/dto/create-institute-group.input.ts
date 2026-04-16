import { Field, InputType } from '@nestjs/graphql';
import { GroupType, IndianState } from '@roviq/common-types';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';
import {
  InstituteAddressInput,
  InstituteContactInput,
} from '../../institute/management/dto/create-institute.input';

@InputType({
  description: 'Fields required to create an institute group (chain, trust, or society).',
})
export class CreateInstituteGroupInput {
  @Field({ description: 'Display name of the group, e.g. "Sunrise Education Trust".' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field({
    description:
      'Unique URL-safe code for the group — lowercase alphanumerics and hyphens, e.g. "sunrise-trust".',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'code must be lowercase alphanumeric with hyphens' })
  code!: string;

  @Field(() => GroupType, { description: 'Legal or organisational type of this group.' })
  @IsEnum(GroupType)
  type!: GroupType;

  @Field({
    nullable: true,
    description: 'Society/trust registration number issued by the Registrar of Societies.',
  })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @Field(() => IndianState, { nullable: true })
  @IsEnum(IndianState)
  @IsOptional()
  registrationState?: IndianState;

  @Field(() => InstituteContactInput, {
    nullable: true,
    description: 'Primary contact details for the group.',
  })
  @IsObject()
  @IsOptional()
  contact?: InstituteContact;

  @Field(() => InstituteAddressInput, {
    nullable: true,
    description: 'Registered address of the group.',
  })
  @IsObject()
  @IsOptional()
  address?: InstituteAddress;
}
