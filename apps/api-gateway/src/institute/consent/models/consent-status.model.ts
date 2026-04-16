import { Field, ObjectType } from '@nestjs/graphql';
import { DateTimeScalar } from '@roviq/nestjs-graphql';

@ObjectType({ description: 'Current consent state for one purpose for one child' })
export class ConsentStatus {
  @Field({ description: 'The student profile this consent applies to' })
  studentProfileId!: string;

  @Field({ description: 'Data processing purpose (e.g. academic_data_processing)' })
  purpose!: string;

  @Field({ description: 'Whether consent is currently granted' })
  isGranted!: boolean;

  @Field(() => DateTimeScalar, {
    nullable: true,
    description: 'When the consent state last changed',
  })
  lastUpdatedAt?: Date | null;
}
