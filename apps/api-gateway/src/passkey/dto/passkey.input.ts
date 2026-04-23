import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType({
  description: 'Password confirmation required before issuing a WebAuthn registration challenge.',
})
export class GeneratePasskeyRegistrationInput {
  @Field({
    description: "User's current account password — confirmed before issuing a passkey challenge.",
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

@InputType({
  description: 'WebAuthn registration response returned by the browser authenticator.',
})
export class VerifyPasskeyRegistrationInput {
  @Field(() => GraphQLJSON, {
    description:
      'Public-key credential response object from navigator.credentials.create() — pass the full JSON as-is.',
  })
  @IsNotEmpty()
  credential!: Record<string, unknown>;

  @Field({
    nullable: true,
    description: 'Human-readable label for this passkey, e.g. "MacBook Touch ID". Max 100 chars.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

@InputType({
  description: 'WebAuthn authentication response returned by the browser authenticator.',
})
export class VerifyPasskeyAuthInput {
  @Field({ description: 'Challenge ID returned by the generatePasskeyAuthentication query.' })
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @Field(() => GraphQLJSON, {
    description:
      'Public-key credential response object from navigator.credentials.get() — pass the full JSON as-is.',
  })
  @IsNotEmpty()
  credential!: Record<string, unknown>;
}
