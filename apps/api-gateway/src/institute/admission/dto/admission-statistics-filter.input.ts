import { Field, InputType } from '@nestjs/graphql';
import { IsDateString, IsOptional } from 'class-validator';

/**
 * Optional date-range filter for `admissionStatistics`.
 *
 * `from`/`to` are ISO date strings (YYYY-MM-DD). Inclusive on both ends.
 * Applied to `enquiries.created_at` and `admission_applications.created_at`
 * so the funnel + source breakdown reflect only events created in the window.
 */
@InputType({ description: 'Date-range filter for admissionStatistics (ROV-168)' })
export class AdmissionStatisticsFilterInput {
  @Field({ nullable: true, description: 'Inclusive lower bound (ISO date YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @Field({ nullable: true, description: 'Inclusive upper bound (ISO date YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
