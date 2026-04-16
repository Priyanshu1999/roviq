/**
 * Filter input for the `adminListResellers` query (ROV-234).
 *
 * Multi-select `status` and `tier` per issue spec — frontend builds checkbox
 * filter bars and passes the selected set. All filters combine with AND,
 * values within a multi-select combine with IN.
 */
import { Field, InputType, Int } from '@nestjs/graphql';
import { ResellerStatus, ResellerTier } from '@roviq/common-types';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

@InputType({ description: 'Filters for the adminListResellers query' })
export class AdminListResellersFilterInput {
  /** Case-insensitive ILIKE over reseller name/slug */
  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  search?: string;

  /** Lifecycle status filter — multi-select */
  @Field(() => [ResellerStatus], { nullable: true })
  @IsArray()
  @IsEnum(ResellerStatus, { each: true })
  @IsOptional()
  status?: ResellerStatus[];

  /** Tier filter — multi-select */
  @Field(() => [ResellerTier], { nullable: true })
  @IsArray()
  @IsEnum(ResellerTier, { each: true })
  @IsOptional()
  tier?: ResellerTier[];

  /** When set, filters the system "Roviq Direct" reseller in (true) or out (false) */
  @Field(() => Boolean, { nullable: true })
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  first?: number;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  after?: string;
}
