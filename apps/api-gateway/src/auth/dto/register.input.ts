import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

@InputType({ description: 'Credentials for creating a new Roviq account.' })
export class RegisterInput {
  @Field({
    description:
      'Roviq ID (username) — 3–50 characters, alphanumeric, dashes, and underscores only.',
  })
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username must be alphanumeric (dashes and underscores allowed)',
  })
  username!: string;

  @Field({
    description: 'Email address used for account recovery and transactional notifications.',
  })
  @IsEmail()
  email!: string;

  @Field({ description: 'Account password — minimum 8 characters, maximum 128.' })
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
