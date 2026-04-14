import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, IsUUID } from 'class-validator';

@InputType({
  description: 'Input for withdrawing parental consent for a specific data processing purpose',
})
export class WithdrawConsentInput {
  @Field(() => ID, { description: 'The student profile to withdraw consent for' })
  @IsUUID('7', { message: 'studentProfileId must be a valid UUIDv7' })
  studentProfileId!: string;

  @Field({
    description:
      'Data processing purpose to withdraw: academic_data_processing, photo_video_marketing, whatsapp_communication, sms_communication, aadhaar_collection, biometric_collection, third_party_edtech, board_exam_registration, transport_tracking, health_data_processing, cctv_monitoring',
  })
  @IsString()
  purpose!: string;
}
