import { Field, ID, InputType } from '@nestjs/graphql';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

@InputType({ description: 'Inclusive date range for filtering audit log entries.' })
export class DateRangeInput {
  @Field(() => DateTimeScalar, { description: 'Start of the range (inclusive).' })
  from!: Date;

  @Field(() => DateTimeScalar, { description: 'End of the range (inclusive).' })
  to!: Date;
}

@InputType({
  description: 'Filter criteria for the audit log. All fields are optional and combine with AND.',
})
export class AuditLogFilterInput {
  @Field(() => ID, {
    nullable: true,
    description: 'Filter by institute (tenant) — platform admins only.',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Filter by entity type, e.g. "Student", "Staff", "Section".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityType?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Filter by the specific entity UUIDv7 that was mutated.',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Filter by the user who performed the action.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Filter by one or more action types, e.g. ["CREATE", "UPDATE", "DELETE"].',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionTypes?: string[];

  @Field(() => String, {
    nullable: true,
    description: 'Filter by correlation ID to trace all changes in a single request.',
  })
  @IsOptional()
  @IsUUID()
  correlationId?: string;

  @Field(() => DateRangeInput, {
    nullable: true,
    description: 'Restrict results to audit events within this date/time range.',
  })
  @IsOptional()
  dateRange?: DateRangeInput;

  @Field(() => String, {
    nullable: true,
    description:
      'Filter by synthetic-context origin (e.g. "workflow:tc-issuance", "consumer:billing-event"). Only set for rows written by the synthetic-user actor.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  syntheticOrigin?: string;
}
