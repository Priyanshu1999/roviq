import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum IdentifierTypeEnum {
  UDISE_PLUS = 'UDISE_PLUS',
  CBSE_AFFILIATION = 'CBSE_AFFILIATION',
  CBSE_SCHOOL_CODE = 'CBSE_SCHOOL_CODE',
  BSEH_AFFILIATION = 'BSEH_AFFILIATION',
  RBSE_REGISTRATION = 'RBSE_REGISTRATION',
  SOCIETY_REGISTRATION = 'SOCIETY_REGISTRATION',
  STATE_RECOGNITION = 'STATE_RECOGNITION',
  SHALA_DARPAN_ID = 'SHALA_DARPAN_ID',
}

registerEnumType(IdentifierTypeEnum, { name: 'IdentifierType' });

@ObjectType()
export class InstituteIdentifierModel {
  @Field(() => ID)
  id!: string;

  @Field(() => IdentifierTypeEnum)
  type!: IdentifierTypeEnum;

  @Field(() => String)
  value!: string;

  @Field(() => String, { nullable: true })
  issuingAuthority?: string | null;

  @Field(() => String, { nullable: true })
  validFrom?: string | null;

  @Field(() => String, { nullable: true })
  validTo?: string | null;
}
