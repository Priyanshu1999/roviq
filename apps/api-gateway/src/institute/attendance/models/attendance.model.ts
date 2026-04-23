import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AttendanceMode, AttendanceStatus } from '@roviq/common-types';
import { DateTimeScalar } from '@roviq/nestjs-graphql';

registerEnumType(AttendanceStatus, {
  name: 'AttendanceStatus',
  description: 'Per-student attendance mark for a given session (PRESENT, ABSENT, LEAVE, LATE).',
});

registerEnumType(AttendanceMode, {
  name: 'AttendanceMode',
  description:
    'How an attendance entry was captured (MANUAL by teacher, APP check-in, BIOMETRIC device, IMPORT bulk).',
});

@ObjectType({
  description:
    'One attendance sitting for a section on a given date — whole-day when period is null, otherwise per lecture/period.',
})
export class AttendanceSessionModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  sectionId!: string;

  @Field(() => ID)
  academicYearId!: string;

  @Field(() => String, { description: 'Date of attendance as ISO YYYY-MM-DD.' })
  date!: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Period / lecture slot number. Null means whole-day (DAILY) attendance.',
  })
  period!: number | null;

  @Field(() => ID, {
    nullable: true,
    description: 'Subject / lecture being taught in this period (null for DAILY mode).',
  })
  subjectId!: string | null;

  @Field(() => ID, { description: 'Membership id of the staff who owns this session.' })
  lecturerId!: string;

  @Field(() => Boolean, {
    description: 'Flag set when another teacher requests override confirmation.',
  })
  overrideCheck!: boolean;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}

@ObjectType({ description: "A single student's attendance mark within a session." })
export class AttendanceEntryModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  sessionId!: string;

  @Field(() => ID, { description: 'Student membership id.' })
  studentId!: string;

  @Field(() => AttendanceStatus)
  status!: AttendanceStatus;

  @Field(() => AttendanceMode)
  mode!: AttendanceMode;

  @Field(() => String, { nullable: true })
  remarks!: string | null;

  @Field(() => DateTimeScalar, {
    description: 'Timestamp the mark was first set or last corrected.',
  })
  markedAt!: Date;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}

@ObjectType({ description: 'Count of attendance entries bucketed by status.' })
export class AttendanceStatusCount {
  @Field(() => AttendanceStatus)
  status!: AttendanceStatus;

  @Field(() => Int)
  count!: number;
}

@ObjectType({
  description: 'An attendance session plus its per-student entries and aggregate counts.',
})
export class AttendanceSessionWithEntriesModel {
  @Field(() => AttendanceSessionModel)
  session!: AttendanceSessionModel;

  @Field(() => [AttendanceEntryModel])
  entries!: AttendanceEntryModel[];

  @Field(() => [AttendanceStatusCount])
  counts!: AttendanceStatusCount[];
}

@ObjectType({
  description:
    "Per-student absentee report row — aggregates a student's attendance across all sessions in the requested date range.",
})
export class AbsenteeReportItem {
  @Field(() => ID, { description: 'Student membership id.' })
  studentId!: string;

  @Field(() => Int, {
    description:
      'Total number of attendance sessions this student had an entry in across the range.',
  })
  totalSessions!: number;

  @Field(() => Int, { description: 'Number of sessions marked PRESENT for this student.' })
  presentCount!: number;

  @Field(() => Int, { description: 'Number of sessions marked ABSENT for this student.' })
  absentCount!: number;

  @Field(() => Int, { description: 'Number of sessions marked LEAVE for this student.' })
  leaveCount!: number;

  @Field(() => Int, { description: 'Number of sessions marked LATE for this student.' })
  lateCount!: number;

  @Field(() => [String], {
    description:
      'Sorted, distinct list of ISO YYYY-MM-DD dates on which the student was marked ABSENT.',
  })
  absentDates!: string[];
}

@ObjectType({
  description:
    'One row per attendance session on the requested date — counts of marks plus the membership ids of absentees for the session.',
})
export class SectionDailyBreakdown {
  @Field(() => ID, { description: 'Section the session belongs to.' })
  sectionId!: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Period / lecture slot number. Null for whole-day (DAILY) attendance.',
  })
  period!: number | null;

  @Field(() => ID, {
    nullable: true,
    description: 'Subject being taught in this session (null for DAILY mode).',
  })
  subjectId!: string | null;

  @Field(() => ID, { description: 'Membership id of the staff who owned this session.' })
  lecturerId!: string;

  @Field(() => Int, { description: 'Number of PRESENT marks for this session.' })
  presentCount!: number;

  @Field(() => Int, { description: 'Number of ABSENT marks for this session.' })
  absentCount!: number;

  @Field(() => Int, { description: 'Number of LEAVE marks for this session.' })
  leaveCount!: number;

  @Field(() => Int, { description: 'Number of LATE marks for this session.' })
  lateCount!: number;

  @Field(() => [ID], {
    description: 'Membership ids of students marked ABSENT in this session.',
  })
  absenteeIds!: string[];
}

@ObjectType({
  description:
    'One row per attendance entry belonging to a single student across a date range — used for per-student attendance history.',
})
export class StudentHistoryItem {
  @Field(() => ID)
  sessionId!: string;

  @Field(() => ID)
  sectionId!: string;

  @Field(() => String, { description: 'ISO YYYY-MM-DD date of the session.' })
  date!: string;

  @Field(() => Int, { nullable: true })
  period!: number | null;

  @Field(() => ID, { nullable: true })
  subjectId!: string | null;

  @Field(() => AttendanceStatus)
  status!: AttendanceStatus;

  @Field(() => String, { nullable: true })
  remarks!: string | null;

  @Field(() => DateTimeScalar)
  markedAt!: Date;
}
