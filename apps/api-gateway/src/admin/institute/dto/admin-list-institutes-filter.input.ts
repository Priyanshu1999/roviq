import { Field, InputType, Int } from '@nestjs/graphql';
import { InstituteStatus, InstituteType } from '@roviq/common-types';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

@InputType({ description: 'Filters for the adminListInstitutes query' })
export class AdminListInstitutesFilterInput {
  @Field({ nullable: true, description: 'Full-text search over name + code (tsvector/trigram)' })
  @IsString()
  @IsOptional()
  search?: string;

  @Field(() => [InstituteStatus], { nullable: true })
  @IsArray()
  @IsEnum(InstituteStatus, { each: true })
  @IsOptional()
  status?: InstituteStatus[];

  @Field(() => InstituteType, { nullable: true })
  @IsEnum(InstituteType)
  @IsOptional()
  type?: InstituteType;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  resellerId?: string;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  groupId?: string;

  @Field({
    nullable: true,
    description: 'Board affiliation filter — case-insensitive match on InstituteAffiliation.board',
  })
  @IsString()
  @IsOptional()
  affiliationBoard?: string;

  @Field({
    nullable: true,
    description: 'Match on institute address state (exact, case-insensitive)',
  })
  @IsString()
  @IsOptional()
  state?: string;

  @Field({
    nullable: true,
    description: 'Match on institute address district (exact, case-insensitive)',
  })
  @IsString()
  @IsOptional()
  district?: string;

  @Field(() => DateTimeScalar, { nullable: true })
  @IsDate()
  @IsOptional()
  createdAfter?: Date;

  @Field(() => DateTimeScalar, { nullable: true })
  @IsDate()
  @IsOptional()
  createdBefore?: Date;

  /**
   * Page size. Upper bound of 50 — the admin field resolver batches
   * reseller/group name lookups via DataLoader so 50 rows costs at most 2
   * extra DB queries. Larger pages are rejected to keep UI pagination
   * predictable and cap JSON payload size.
   */
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  first?: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  after?: string;
}
