import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum BoardTypeEnum {
  CBSE = 'CBSE',
  BSEH = 'BSEH',
  RBSE = 'RBSE',
  ICSE = 'ICSE',
}

export enum AffiliationStatusEnum {
  PROVISIONAL = 'PROVISIONAL',
  REGULAR = 'REGULAR',
  EXTENSION_PENDING = 'EXTENSION_PENDING',
  REVOKED = 'REVOKED',
}

registerEnumType(BoardTypeEnum, { name: 'BoardType' });
registerEnumType(AffiliationStatusEnum, { name: 'AffiliationStatus' });

@ObjectType()
export class InstituteAffiliationModel {
  @Field(() => ID)
  id!: string;

  @Field(() => BoardTypeEnum)
  board!: BoardTypeEnum;

  @Field(() => AffiliationStatusEnum)
  affiliationStatus!: AffiliationStatusEnum;

  @Field(() => String, { nullable: true })
  affiliationNumber?: string | null;

  @Field(() => String, { nullable: true })
  grantedLevel?: string | null;

  @Field(() => String)
  validFrom!: string;

  @Field(() => String)
  validTo!: string;

  @Field(() => String, { nullable: true })
  nocNumber?: string | null;

  @Field(() => String, { nullable: true })
  nocDate?: string | null;
}
