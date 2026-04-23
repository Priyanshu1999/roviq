import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

@InputType({ description: 'Invite a new team member to the reseller organisation' })
export class ResellerInviteTeamMemberInput {
  @Field({ description: 'Roviq ID (username) for the new team member — must be globally unique' })
  @IsString()
  @MinLength(3)
  username!: string;

  @Field({ description: 'Email address for the new team member' })
  @IsEmail()
  email!: string;

  @Field(() => ID, {
    description: 'Reseller-scope role to assign. Must belong to this reseller.',
  })
  @IsUUID()
  roleId!: string;

  @Field({ nullable: true, description: 'First name — sent in the welcome notification' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @Field({ nullable: true, description: 'Last name — sent in the welcome notification' })
  @IsString()
  @IsOptional()
  lastName?: string;
}
