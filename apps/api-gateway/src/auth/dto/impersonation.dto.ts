import { Field, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';

@ObjectType()
export class StartImpersonationResult {
  /** One-time code (UUID) for token exchange — only present when no OTP is required. */
  @Field({ nullable: true })
  code?: string;

  /** True when the institute admin must approve via OTP before exchange. */
  @Field({ nullable: true })
  requiresOtp?: boolean;

  /** Server-side impersonation_session id — required for the verifyOtp call. */
  @Field({ nullable: true })
  sessionId?: string;
}

@ObjectType()
export class ImpersonationInstituteInfo {
  @Field()
  id!: string;

  @Field(() => I18nTextScalar)
  name!: I18nContent;
}

@ObjectType()
export class ImpersonationUserInfo {
  @Field()
  id!: string;

  @Field()
  username!: string;
}

@ObjectType()
export class ImpersonationAuthPayload {
  @Field()
  accessToken!: string;

  @Field(() => ImpersonationUserInfo)
  user!: ImpersonationUserInfo;

  @Field(() => ImpersonationInstituteInfo)
  institute!: ImpersonationInstituteInfo;
}
