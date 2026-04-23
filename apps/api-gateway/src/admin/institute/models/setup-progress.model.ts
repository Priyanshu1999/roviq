import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

/** Progress step lifecycle used across the institute-setup workflow. */
export enum SetupStepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

registerEnumType(SetupStepStatus, {
  name: 'SetupStepStatus',
  description:
    'Status of a single institute setup step emitted by the InstituteSetupWorkflow — lifecycle: pending → in_progress → (completed | failed)',
});

@ObjectType({
  description: 'A single progress update emitted by the institute-setup Temporal workflow',
})
export class SetupProgressModel {
  @Field(() => ID)
  instituteId!: string;

  @Field({ description: "Current step name (e.g., 'identity', 'academic_structure')" })
  step!: string;

  @Field(() => SetupStepStatus)
  status!: SetupStepStatus;

  @Field({ nullable: true, description: 'Human-readable progress message' })
  message?: string;

  @Field(() => Int)
  completedSteps!: number;

  @Field(() => Int)
  totalSteps!: number;
}
