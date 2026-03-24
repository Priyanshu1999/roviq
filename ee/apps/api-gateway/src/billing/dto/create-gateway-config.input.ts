import { Field, InputType } from '@nestjs/graphql';
import { AuditMask } from '@roviq/audit';
import { Allow, IsBoolean, IsOptional, IsString } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class CreateGatewayConfigInput {
  @Field()
  @IsString()
  provider!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  displayName?: string;

  /** Encrypted before storage — @AuditMask ensures audit trail shows [REDACTED] */
  @Field(() => GraphQLJSON)
  @Allow()
  @AuditMask()
  credentials!: Record<string, string>;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @AuditMask()
  webhookSecret?: string;

  @Field({ nullable: true, defaultValue: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @Field({ nullable: true, defaultValue: false })
  @IsBoolean()
  @IsOptional()
  testMode?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  supportedMethods?: string[];
}
