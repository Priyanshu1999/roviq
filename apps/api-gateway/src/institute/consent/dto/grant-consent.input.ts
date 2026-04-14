import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID } from 'class-validator';

@InputType({
  description: 'Input for granting parental consent for a specific data processing purpose',
})
export class GrantConsentInput {
  @Field(() => ID, { description: 'The student profile to grant consent for' })
  @IsUUID('7', { message: 'studentProfileId must be a valid UUIDv7' })
  studentProfileId!: string;

  @Field({
    description:
      'Data processing purpose: academic_data_processing, photo_video_marketing, whatsapp_communication, sms_communication, aadhaar_collection, biometric_collection, third_party_edtech, board_exam_registration, transport_tracking, health_data_processing, cctv_monitoring',
  })
  @IsString()
  purpose!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'How the guardian was verified: digilocker_token, aadhaar_otp, in_person_id_check, signed_form_uploaded, school_erp_verified_account',
  })
  @IsOptional()
  @IsString()
  verificationMethod?: string;
}
