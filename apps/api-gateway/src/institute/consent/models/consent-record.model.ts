import { Field, ID, ObjectType } from '@nestjs/graphql';
import { DateTimeScalar } from '@roviq/nestjs-graphql';

@ObjectType({ description: 'DPDP Act 2023 verifiable parental consent record (append-only)' })
export class ConsentRecordModel {
  @Field(() => ID)
  id!: string;

  @Field({
    description: 'Data processing purpose (e.g. academic_data_processing, photo_video_marketing)',
  })
  purpose!: string;

  @Field({ description: 'true = consent granted, false = consent withdrawn' })
  isGranted!: boolean;

  @Field(() => DateTimeScalar, {
    nullable: true,
    description: 'Timestamp when consent was granted (null for withdrawals)',
  })
  grantedAt?: Date | null;

  @Field(() => DateTimeScalar, {
    nullable: true,
    description: 'Timestamp when consent was withdrawn (null for grants)',
  })
  withdrawnAt?: Date | null;

  @Field(() => String, {
    nullable: true,
    description:
      'How the guardian was verified: digilocker_token, aadhaar_otp, in_person_id_check, signed_form_uploaded, school_erp_verified_account',
  })
  verificationMethod?: string | null;

  @Field(() => DateTimeScalar, { description: 'When this consent record was created' })
  createdAt!: Date;
}
