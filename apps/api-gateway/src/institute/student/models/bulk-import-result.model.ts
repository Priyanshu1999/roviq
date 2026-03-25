import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description:
    'Result of starting a bulk student import — contains the workflow ID for progress tracking',
})
export class BulkImportStartResult {
  @Field({
    description: 'Temporal workflow ID — use with bulkImportProgress query to track status',
  })
  workflowId!: string;
}
