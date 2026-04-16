import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AffiliationStatus, BoardType } from '@roviq/common-types';
import { DateOnlyScalar } from '@roviq/nestjs-graphql';

registerEnumType(BoardType, { name: 'BoardType' });
registerEnumType(AffiliationStatus, { name: 'AffiliationStatus' });

@ObjectType()
export class InstituteAffiliationModel {
  @Field(() => ID)
  id!: string;

  @Field(() => BoardType)
  board!: BoardType;

  @Field(() => AffiliationStatus)
  affiliationStatus!: AffiliationStatus;

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

  @Field(() => DateOnlyScalar, { nullable: true })
  nocDate?: string | null;
}
