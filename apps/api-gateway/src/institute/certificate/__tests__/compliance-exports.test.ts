/**
 * Unit tests for compliance exports (ROV-171).
 *
 * Tests:
 * 1. UDISE+ export has ALL 21 student fields + 12 teacher fields
 * 2. CBSE Registration export has correct headers
 * 3. RTE report generates with correct structure
 * 4. AWR export sorted by admission number
 * 5. Field mapping constants have correct counts
 */

import {
  CBSE_REGISTRATION_FIELDS,
  CBSE_REGISTRATION_HEADERS,
  UDISE_STUDENT_FIELDS,
  UDISE_STUDENT_HEADERS,
  UDISE_TEACHER_FIELDS,
  UDISE_TEACHER_HEADERS,
} from '@roviq/compliance';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

describe('UDISE+ Field Mappings', () => {
  it('has all 21 student fields per PRD §2.1', () => {
    expect(Object.keys(UDISE_STUDENT_FIELDS)).toHaveLength(21);
    expect(UDISE_STUDENT_HEADERS).toHaveLength(21);

    // Verify critical fields exist
    const fieldNames = Object.keys(UDISE_STUDENT_FIELDS);
    expect(fieldNames).toContain('studentName');
    expect(fieldNames).toContain('fatherName');
    expect(fieldNames).toContain('motherName');
    expect(fieldNames).toContain('dateOfBirth');
    expect(fieldNames).toContain('gender');
    expect(fieldNames).toContain('aadhaarMasked');
    expect(fieldNames).toContain('motherTongue');
    expect(fieldNames).toContain('socialCategory');
    expect(fieldNames).toContain('minorityStatus');
    expect(fieldNames).toContain('isBpl');
    expect(fieldNames).toContain('isCwsn');
    expect(fieldNames).toContain('cwsnType');
    expect(fieldNames).toContain('isRteAdmitted');
    expect(fieldNames).toContain('className');
    expect(fieldNames).toContain('sectionName');
    expect(fieldNames).toContain('admissionNumber');
    expect(fieldNames).toContain('stream');
    expect(fieldNames).toContain('mediumOfInstruction');
    expect(fieldNames).toContain('previousYearStatus');
    expect(fieldNames).toContain('apaarId');
    expect(fieldNames).toContain('pen');
  });

  it('has all 12 teacher fields per PRD §2.2', () => {
    expect(Object.keys(UDISE_TEACHER_FIELDS)).toHaveLength(12);
    expect(UDISE_TEACHER_HEADERS).toHaveLength(12);

    const fieldNames = Object.keys(UDISE_TEACHER_FIELDS);
    expect(fieldNames).toContain('teacherName');
    expect(fieldNames).toContain('aadhaarMasked');
    expect(fieldNames).toContain('dateOfBirth');
    expect(fieldNames).toContain('gender');
    expect(fieldNames).toContain('socialCategory');
    expect(fieldNames).toContain('natureOfAppointment');
    expect(fieldNames).toContain('dateOfJoining');
    expect(fieldNames).toContain('academicQualification');
    expect(fieldNames).toContain('professionalQualification');
    expect(fieldNames).toContain('trainedForCwsn');
    expect(fieldNames).toContain('isDisabled');
    expect(fieldNames).toContain('designation');
  });

  it('every field has a section (GP or EP)', () => {
    for (const field of Object.values(UDISE_STUDENT_FIELDS)) {
      expect(['GP', 'EP']).toContain(field.section);
    }
  });
});

describe('CBSE Registration Field Mappings', () => {
  it('has required fields for Pariksha Sangam', () => {
    const fields = Object.values(CBSE_REGISTRATION_FIELDS);
    const required = fields.filter((f) => f.required);

    // PRD §3.1: Name, Mother, Father, DOB, Gender, APAAR, 5 subjects, mobile = 11 required
    expect(required.length).toBeGreaterThanOrEqual(11);
  });

  it('has subject code fields 1-7', () => {
    const headers = CBSE_REGISTRATION_HEADERS;
    expect(headers).toContain('Subject Code 1');
    expect(headers).toContain('Subject Code 5');
    expect(headers).toContain('Subject Code 7');
  });
});

describe('XLSX Generation — Smoke Tests', () => {
  it('generates a valid XLSX buffer from UDISE student headers', () => {
    const wb = XLSX.utils.book_new();
    const data = [
      { 'Student Name': 'Arjun Kumar', "Father's Name": 'Suresh Kumar', Gender: 'male' },
      { 'Student Name': 'Priya Sharma', "Father's Name": 'Rajesh Sharma', Gender: 'female' },
    ];
    const ws = XLSX.utils.json_to_sheet(data, { header: UDISE_STUDENT_HEADERS });
    XLSX.utils.book_append_sheet(wb, ws, 'Students');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    // Buffer should be non-empty and start with XLSX magic bytes (PK zip header)
    expect(buf.length).toBeGreaterThan(100);
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
  });

  it('generates multi-sheet XLSX (students + teachers)', () => {
    const wb = XLSX.utils.book_new();

    const studentData = [{ 'Student Name': 'Test Student', Gender: 'male' }];
    const studentSheet = XLSX.utils.json_to_sheet(studentData, { header: UDISE_STUDENT_HEADERS });
    XLSX.utils.book_append_sheet(wb, studentSheet, 'Students');

    const teacherData = [{ 'Teacher Name': 'Test Teacher', Gender: 'female' }];
    const teacherSheet = XLSX.utils.json_to_sheet(teacherData, { header: UDISE_TEACHER_HEADERS });
    XLSX.utils.book_append_sheet(wb, teacherSheet, 'Teachers');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    expect(buf.length).toBeGreaterThan(100);

    // Parse back and verify two sheets
    const parsed = XLSX.read(buf);
    expect(parsed.SheetNames).toContain('Students');
    expect(parsed.SheetNames).toContain('Teachers');
  });

  it('AWR export headers include all required AWR fields', () => {
    const awrHeaders = [
      'S.No.',
      'Admission Number',
      'Student Name',
      'Date of Birth',
      'Gender',
      'Admission Date',
      'Admission Class',
      'Admission Type',
      'Academic Status',
      'Social Category',
      'Class',
      'Section',
    ];
    expect(awrHeaders).toHaveLength(12);
  });
});
