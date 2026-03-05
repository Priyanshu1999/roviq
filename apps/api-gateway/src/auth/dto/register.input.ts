import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username must be alphanumeric (dashes and underscores allowed)',
  })
  username!: string;

  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @Field()
  @IsUUID()
  tenantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
