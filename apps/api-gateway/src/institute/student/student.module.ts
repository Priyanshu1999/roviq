import { Module } from '@nestjs/common';
import { StudentResolver } from './student.resolver';
import { StudentService } from './student.service';
import { StudentAcademicResolver } from './student-academic.resolver';
import { StudentAcademicService } from './student-academic.service';
import { StudentBulkImportResolver } from './student-bulk-import.resolver';
import { StudentBulkImportService } from './student-bulk-import.service';
import { StudentEventHandler } from './student-event.handler';
import { BulkStudentImportWorkerService } from './workflows/bulk-student-import.worker';

@Module({
  providers: [
    StudentService,
    StudentResolver,
    StudentAcademicService,
    StudentAcademicResolver,
    StudentEventHandler,
    StudentBulkImportService,
    StudentBulkImportResolver,
    BulkStudentImportWorkerService,
  ],
  exports: [StudentService],
})
export class StudentModule {}
