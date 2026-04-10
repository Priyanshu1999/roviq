import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { DEFAULT_ROLE_ABILITIES, type DefaultRole, DefaultRoles } from '@roviq/common-types';
import type { DrizzleDB } from '@roviq/database';
import {
  academicYears,
  authProviders,
  instituteAffiliations,
  instituteBranding,
  instituteConfigs,
  instituteIdentifiers,
  instituteNotificationConfigs,
  institutes,
  memberships,
  platformMemberships,
  resellerMemberships,
  resellers,
  roles,
  SYSTEM_USER_ID,
  sectionSubjects,
  sections,
  standardSubjects,
  standards,
  subjects,
  users,
  withAdmin,
} from '@roviq/database';
import { plans } from '@roviq/ee-database';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { SEED_IDS } from './seed-ids';

// ─── Shared actor context ────────────────────────────────────────────
const BY = { createdBy: SYSTEM_USER_ID, updatedBy: SYSTEM_USER_ID };

// ─── Types for seed data definitions ─────────────────────────────────
type EducationLevel =
  | 'PRE_PRIMARY'
  | 'PRIMARY'
  | 'UPPER_PRIMARY'
  | 'SECONDARY'
  | 'SENIOR_SECONDARY';
type NepStage = 'FOUNDATIONAL' | 'PREPARATORY' | 'MIDDLE' | 'SECONDARY';
type SubjectType = 'ACADEMIC' | 'LANGUAGE' | 'SKILL' | 'EXTRACURRICULAR' | 'INTERNAL_ASSESSMENT';

interface StandardDef {
  name: string;
  order: number;
  level: EducationLevel;
  nep?: NepStage;
  sections: string[];
  udise: number;
  boardExam?: boolean;
  stream?: boolean;
}

interface SubjectDef {
  name: string;
  shortName: string;
  boardCode?: string;
  type: SubjectType;
  mandatory: boolean;
  theory?: number;
  practical?: number;
  internal?: number;
}

interface SubjectMapping {
  orderRange: [number, number];
  subjects: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// SEED DATA DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

// ─── NEP Standards for Institute 1 (Nursery through Class 12) ────────
const INST1_STANDARDS: StandardDef[] = [
  // PRE_PRIMARY — Foundational stage (NEP)
  {
    name: 'Nursery',
    order: -3,
    level: 'PRE_PRIMARY',
    nep: 'FOUNDATIONAL',
    sections: ['A', 'B'],
    udise: -3,
  },
  {
    name: 'LKG',
    order: -2,
    level: 'PRE_PRIMARY',
    nep: 'FOUNDATIONAL',
    sections: ['A', 'B'],
    udise: -2,
  },
  {
    name: 'UKG',
    order: -1,
    level: 'PRE_PRIMARY',
    nep: 'FOUNDATIONAL',
    sections: ['A', 'B'],
    udise: -1,
  },
  // PRIMARY — Foundational (1-2) + Preparatory (3-5) stages
  {
    name: 'Class 1',
    order: 1,
    level: 'PRIMARY',
    nep: 'FOUNDATIONAL',
    sections: ['A', 'B', 'C'],
    udise: 1,
  },
  {
    name: 'Class 2',
    order: 2,
    level: 'PRIMARY',
    nep: 'FOUNDATIONAL',
    sections: ['A', 'B', 'C'],
    udise: 2,
  },
  {
    name: 'Class 3',
    order: 3,
    level: 'PRIMARY',
    nep: 'PREPARATORY',
    sections: ['A', 'B', 'C'],
    udise: 3,
  },
  {
    name: 'Class 4',
    order: 4,
    level: 'PRIMARY',
    nep: 'PREPARATORY',
    sections: ['A', 'B'],
    udise: 4,
  },
  {
    name: 'Class 5',
    order: 5,
    level: 'PRIMARY',
    nep: 'PREPARATORY',
    sections: ['A', 'B'],
    udise: 5,
  },
  // UPPER_PRIMARY — Middle stage
  {
    name: 'Class 6',
    order: 6,
    level: 'UPPER_PRIMARY',
    nep: 'MIDDLE',
    sections: ['A', 'B'],
    udise: 6,
  },
  {
    name: 'Class 7',
    order: 7,
    level: 'UPPER_PRIMARY',
    nep: 'MIDDLE',
    sections: ['A', 'B'],
    udise: 7,
  },
  {
    name: 'Class 8',
    order: 8,
    level: 'UPPER_PRIMARY',
    nep: 'MIDDLE',
    sections: ['A', 'B'],
    udise: 8,
  },
  // SECONDARY — Secondary stage
  {
    name: 'Class 9',
    order: 9,
    level: 'SECONDARY',
    nep: 'SECONDARY',
    sections: ['A', 'B'],
    udise: 9,
  },
  {
    name: 'Class 10',
    order: 10,
    level: 'SECONDARY',
    nep: 'SECONDARY',
    sections: ['A', 'B'],
    udise: 10,
    boardExam: true,
  },
  // SENIOR_SECONDARY — Secondary stage, streams apply
  {
    name: 'Class 11',
    order: 11,
    level: 'SENIOR_SECONDARY',
    nep: 'SECONDARY',
    sections: ['Science', 'Commerce', 'Arts'],
    udise: 11,
    stream: true,
  },
  {
    name: 'Class 12',
    order: 12,
    level: 'SENIOR_SECONDARY',
    nep: 'SECONDARY',
    sections: ['Science', 'Commerce', 'Arts'],
    udise: 12,
    stream: true,
    boardExam: true,
  },
];

// ─── TRADITIONAL Standards for Institute 2 (Class 1–10) ─────────────
const INST2_STANDARDS: StandardDef[] = [
  { name: 'Class 1', order: 1, level: 'PRIMARY', sections: ['A', 'B'], udise: 1 },
  { name: 'Class 2', order: 2, level: 'PRIMARY', sections: ['A', 'B'], udise: 2 },
  { name: 'Class 3', order: 3, level: 'PRIMARY', sections: ['A', 'B'], udise: 3 },
  { name: 'Class 4', order: 4, level: 'PRIMARY', sections: ['A'], udise: 4 },
  { name: 'Class 5', order: 5, level: 'PRIMARY', sections: ['A'], udise: 5 },
  { name: 'Class 6', order: 6, level: 'UPPER_PRIMARY', sections: ['A'], udise: 6 },
  { name: 'Class 7', order: 7, level: 'UPPER_PRIMARY', sections: ['A'], udise: 7 },
  { name: 'Class 8', order: 8, level: 'UPPER_PRIMARY', sections: ['A'], udise: 8 },
  { name: 'Class 9', order: 9, level: 'SECONDARY', sections: ['A'], udise: 9 },
  { name: 'Class 10', order: 10, level: 'SECONDARY', sections: ['A'], udise: 10, boardExam: true },
];

// ─── Institute 1 Subjects (CBSE curriculum) ──────────────────────────
const INST1_SUBJECTS: SubjectDef[] = [
  {
    name: 'English',
    shortName: 'ENG',
    boardCode: '184',
    type: 'LANGUAGE',
    mandatory: true,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Hindi',
    shortName: 'HIN',
    boardCode: '002',
    type: 'LANGUAGE',
    mandatory: true,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Sanskrit',
    shortName: 'SKT',
    boardCode: '122',
    type: 'LANGUAGE',
    mandatory: false,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Mathematics',
    shortName: 'MATH',
    boardCode: '041',
    type: 'ACADEMIC',
    mandatory: true,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Science',
    shortName: 'SCI',
    boardCode: '086',
    type: 'ACADEMIC',
    mandatory: true,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Social Science',
    shortName: 'SST',
    boardCode: '087',
    type: 'ACADEMIC',
    mandatory: true,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Physics',
    shortName: 'PHY',
    boardCode: '042',
    type: 'ACADEMIC',
    mandatory: false,
    theory: 70,
    practical: 30,
  },
  {
    name: 'Chemistry',
    shortName: 'CHEM',
    boardCode: '043',
    type: 'ACADEMIC',
    mandatory: false,
    theory: 70,
    practical: 30,
  },
  {
    name: 'Biology',
    shortName: 'BIO',
    boardCode: '044',
    type: 'ACADEMIC',
    mandatory: false,
    theory: 70,
    practical: 30,
  },
  {
    name: 'Accountancy',
    shortName: 'ACC',
    boardCode: '055',
    type: 'ACADEMIC',
    mandatory: false,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Business Studies',
    shortName: 'BST',
    boardCode: '054',
    type: 'ACADEMIC',
    mandatory: false,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Economics',
    shortName: 'ECO',
    boardCode: '030',
    type: 'ACADEMIC',
    mandatory: false,
    theory: 80,
    internal: 20,
  },
  {
    name: 'History',
    shortName: 'HIST',
    boardCode: '027',
    type: 'ACADEMIC',
    mandatory: false,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Political Science',
    shortName: 'POL',
    boardCode: '028',
    type: 'ACADEMIC',
    mandatory: false,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Geography',
    shortName: 'GEO',
    boardCode: '029',
    type: 'ACADEMIC',
    mandatory: false,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Computer Science',
    shortName: 'CS',
    boardCode: '083',
    type: 'SKILL',
    mandatory: false,
    theory: 70,
    practical: 30,
  },
  {
    name: 'Physical Education',
    shortName: 'PE',
    boardCode: '048',
    type: 'EXTRACURRICULAR',
    mandatory: false,
    theory: 70,
    practical: 30,
  },
  { name: 'Art & Craft', shortName: 'ART', type: 'EXTRACURRICULAR', mandatory: false },
  { name: 'General Knowledge', shortName: 'GK', type: 'INTERNAL_ASSESSMENT', mandatory: false },
  { name: 'Moral Science', shortName: 'MS', type: 'INTERNAL_ASSESSMENT', mandatory: false },
];

const INST1_SUBJECT_MAPPINGS: SubjectMapping[] = [
  { orderRange: [-3, -1], subjects: ['ENG', 'HIN', 'ART', 'GK'] },
  { orderRange: [1, 5], subjects: ['ENG', 'HIN', 'MATH', 'SCI', 'SST', 'GK', 'ART', 'MS'] },
  { orderRange: [6, 8], subjects: ['ENG', 'HIN', 'SKT', 'MATH', 'SCI', 'SST', 'CS', 'PE'] },
  { orderRange: [9, 10], subjects: ['ENG', 'HIN', 'SKT', 'MATH', 'SCI', 'SST', 'CS', 'PE'] },
  { orderRange: [11, 12], subjects: ['ENG', 'PE'] },
  { orderRange: [11, 12], subjects: ['PHY', 'CHEM', 'BIO', 'MATH'] },
  { orderRange: [11, 12], subjects: ['ACC', 'BST', 'ECO'] },
  { orderRange: [11, 12], subjects: ['HIST', 'POL', 'GEO'] },
];

// ─── Institute 2 Subjects (BSEH / state board) ──────────────────────
const INST2_SUBJECTS: SubjectDef[] = [
  {
    name: 'English',
    shortName: 'ENG',
    type: 'LANGUAGE',
    mandatory: true,
    theory: 80,
    internal: 20,
  },
  { name: 'Hindi', shortName: 'HIN', type: 'LANGUAGE', mandatory: true, theory: 80, internal: 20 },
  {
    name: 'Sanskrit',
    shortName: 'SKT',
    type: 'LANGUAGE',
    mandatory: false,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Mathematics',
    shortName: 'MATH',
    type: 'ACADEMIC',
    mandatory: true,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Science',
    shortName: 'SCI',
    type: 'ACADEMIC',
    mandatory: true,
    theory: 80,
    internal: 20,
  },
  {
    name: 'Social Science',
    shortName: 'SST',
    type: 'ACADEMIC',
    mandatory: true,
    theory: 80,
    internal: 20,
  },
  { name: 'Drawing', shortName: 'DRW', type: 'EXTRACURRICULAR', mandatory: false },
  { name: 'Physical Education', shortName: 'PE', type: 'EXTRACURRICULAR', mandatory: false },
  {
    name: 'Computer',
    shortName: 'COMP',
    type: 'SKILL',
    mandatory: false,
    theory: 50,
    practical: 50,
  },
];

const INST2_SUBJECT_MAPPINGS: SubjectMapping[] = [
  { orderRange: [1, 5], subjects: ['ENG', 'HIN', 'MATH', 'DRW'] },
  { orderRange: [6, 8], subjects: ['ENG', 'HIN', 'SKT', 'MATH', 'SCI', 'SST', 'COMP', 'PE'] },
  { orderRange: [9, 10], subjects: ['ENG', 'HIN', 'SKT', 'MATH', 'SCI', 'SST', 'COMP', 'PE'] },
];

// ═══════════════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

async function seedReseller(tx: DrizzleDB) {
  const [reseller] = await tx
    .insert(resellers)
    .values({
      id: SEED_IDS.RESELLER_DIRECT,
      name: 'Roviq Direct',
      slug: 'roviq-direct',
      isSystem: true,
      tier: 'full_management',
    })
    .onConflictDoUpdate({
      target: resellers.slug,
      set: { updatedAt: new Date() },
    })
    .returning();
  console.log(`Reseller: ${reseller.name} (${reseller.id})`);
  return reseller;
}

async function seedInstitutes(tx: DrizzleDB) {
  const [inst1] = await tx
    .insert(institutes)
    .values({
      id: SEED_IDS.INSTITUTE_1,
      name: { en: 'Saraswati Vidya Mandir', hi: 'सरस्वती विद्या मंदिर' },
      slug: 'saraswati-vidya-mandir',
      code: 'SVM-GGN-01',
      type: 'SCHOOL',
      structureFramework: 'NEP',
      status: 'ACTIVE',
      setupStatus: 'COMPLETED',
      isDemo: false,
      departments: ['PRE_PRIMARY', 'PRIMARY', 'UPPER_PRIMARY', 'SECONDARY', 'SENIOR_SECONDARY'],
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      contact: {
        phones: [
          {
            countryCode: '+91',
            number: '9876543210',
            isPrimary: true,
            isWhatsappEnabled: true,
            label: 'Office',
          },
          {
            countryCode: '+91',
            number: '0124-2345678',
            isPrimary: false,
            isWhatsappEnabled: false,
            label: 'Landline',
          },
        ],
        emails: [
          { address: 'info@svm-ggn.edu.in', isPrimary: true, label: 'General' },
          { address: 'principal@svm-ggn.edu.in', isPrimary: false, label: 'Principal' },
        ],
      },
      address: {
        line1: '12, Sector 14',
        line2: 'Near Civil Hospital',
        city: 'Gurugram',
        district: 'Gurugram',
        state: 'Haryana',
        postalCode: '122001',
        country: 'IN',
        coordinates: { lat: 28.4595, lng: 77.0266 },
      },
      settings: { supportedLocales: ['en', 'hi'] },
      ...BY,
    })
    .onConflictDoUpdate({
      target: institutes.slug,
      set: { status: 'ACTIVE', setupStatus: 'COMPLETED', updatedAt: new Date() },
    })
    .returning();
  console.log(`Institute 1: ${(inst1.name as Record<string, string>).en} (NEP + CBSE)`);

  const [inst2] = await tx
    .insert(institutes)
    .values({
      id: SEED_IDS.INSTITUTE_2,
      name: { en: 'Rajasthan Public School', hi: 'राजस्थान पब्लिक स्कूल' },
      slug: 'rajasthan-public-school',
      code: 'RPS-JPR-01',
      type: 'SCHOOL',
      structureFramework: 'TRADITIONAL',
      status: 'ACTIVE',
      setupStatus: 'COMPLETED',
      isDemo: false,
      departments: ['PRIMARY', 'UPPER_PRIMARY', 'SECONDARY'],
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      contact: {
        phones: [
          {
            countryCode: '+91',
            number: '9412345678',
            isPrimary: true,
            isWhatsappEnabled: true,
            label: 'Office',
          },
        ],
        emails: [{ address: 'office@rps-jaipur.edu.in', isPrimary: true, label: 'General' }],
      },
      address: {
        line1: '45, Jawahar Nagar',
        line2: 'Near Statue Circle',
        city: 'Jaipur',
        district: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302004',
        country: 'IN',
        coordinates: { lat: 26.9124, lng: 75.7873 },
      },
      settings: { supportedLocales: ['en', 'hi'] },
      ...BY,
    })
    .onConflictDoUpdate({
      target: institutes.slug,
      set: { status: 'ACTIVE', setupStatus: 'COMPLETED', updatedAt: new Date() },
    })
    .returning();
  console.log(`Institute 2: ${(inst2.name as Record<string, string>).en} (Traditional + BSEH)`);

  return { inst1, inst2 };
}

async function seedBrandingAndConfigs(tx: DrizzleDB, inst1Id: string, inst2Id: string) {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  // Branding
  await tx
    .insert(instituteBranding)
    .values([
      {
        id: SEED_IDS.BRANDING_INST1,
        tenantId: inst1Id,
        primaryColor: '#1E40AF',
        secondaryColor: '#F59E0B',
        themeIdentifier: 'royal-blue',
        ...BY,
      },
      {
        id: SEED_IDS.BRANDING_INST2,
        tenantId: inst2Id,
        primaryColor: '#059669',
        secondaryColor: '#DC2626',
        themeIdentifier: 'emerald',
        ...BY,
      },
    ])
    .onConflictDoNothing();
  console.log('  Branding seeded for both institutes');

  // Configs
  await tx
    .insert(instituteConfigs)
    .values({
      id: SEED_IDS.CONFIG_INST1,
      tenantId: inst1Id,
      attendanceType: 'DAILY',
      openingTime: '07:30',
      closingTime: '14:00',
      shifts: [{ name: 'Morning', start: '07:30', end: '14:00' }],
      termStructure: [
        { label: 'Term 1', startDate: `${startYear}-04-01`, endDate: `${startYear}-09-30` },
        { label: 'Term 2', startDate: `${startYear}-10-01`, endDate: `${startYear + 1}-03-31` },
      ],
      gradingSystem: {
        type: 'CBSE_CCE',
        scales: [
          { grade: 'A1', minPercent: 91, maxPercent: 100, gpa: 10.0 },
          { grade: 'A2', minPercent: 81, maxPercent: 90, gpa: 9.0 },
          { grade: 'B1', minPercent: 71, maxPercent: 80, gpa: 8.0 },
          { grade: 'B2', minPercent: 61, maxPercent: 70, gpa: 7.0 },
          { grade: 'C1', minPercent: 51, maxPercent: 60, gpa: 6.0 },
          { grade: 'C2', minPercent: 41, maxPercent: 50, gpa: 5.0 },
          { grade: 'D', minPercent: 33, maxPercent: 40, gpa: 4.0 },
          { grade: 'E', minPercent: 0, maxPercent: 32, gpa: 0.0 },
        ],
      },
      sectionStrengthNorms: { optimal: 40, hardMax: 45, exemptionAllowed: true },
      admissionNumberConfig: {
        format: '{prefix}{year}/{value:04d}',
        year_format: 'YYYY',
        prefixes: { '-3': 'N-', '-2': 'L-', '-1': 'U-', '1': 'A-' },
        no_prefix_from_class: 2,
      },
      ...BY,
    })
    .onConflictDoNothing();

  await tx
    .insert(instituteConfigs)
    .values({
      id: SEED_IDS.CONFIG_INST2,
      tenantId: inst2Id,
      attendanceType: 'DAILY',
      openingTime: '08:00',
      closingTime: '14:30',
      shifts: [{ name: 'Morning', start: '08:00', end: '14:30' }],
      termStructure: [
        { label: 'First Half', startDate: `${startYear}-04-01`, endDate: `${startYear}-09-30` },
        {
          label: 'Second Half',
          startDate: `${startYear}-10-01`,
          endDate: `${startYear + 1}-03-31`,
        },
      ],
      gradingSystem: { type: 'PERCENTAGE', passingPercent: 33 },
      sectionStrengthNorms: { optimal: 45, hardMax: 50, exemptionAllowed: false },
      admissionNumberConfig: {
        format: 'RPS/{year}/{value:04d}',
        year_format: 'YY-YY',
        prefixes: {},
        no_prefix_from_class: 1,
      },
      ...BY,
    })
    .onConflictDoNothing();
  console.log('  Configs seeded for both institutes');
}

async function seedIdentifiersAndAffiliations(tx: DrizzleDB, inst1Id: string, inst2Id: string) {
  await tx
    .insert(instituteIdentifiers)
    .values([
      {
        id: SEED_IDS.IDENTIFIER_UDISE_INST1,
        tenantId: inst1Id,
        type: 'UDISE_PLUS',
        value: '06130100501',
        issuingAuthority: 'Ministry of Education',
        ...BY,
      },
      {
        id: SEED_IDS.IDENTIFIER_CBSE_AFF_INST1,
        tenantId: inst1Id,
        type: 'CBSE_AFFILIATION',
        value: '530456',
        issuingAuthority: 'CBSE New Delhi',
        validFrom: '2020-04-01',
        validTo: '2030-03-31',
        ...BY,
      },
      {
        id: SEED_IDS.IDENTIFIER_UDISE_INST2,
        tenantId: inst2Id,
        type: 'UDISE_PLUS',
        value: '08220200301',
        issuingAuthority: 'Ministry of Education',
        ...BY,
      },
      {
        id: SEED_IDS.IDENTIFIER_BSEH_AFF_INST2,
        tenantId: inst2Id,
        type: 'BSEH_AFFILIATION',
        value: 'BSEH-1234',
        issuingAuthority: 'Board of School Education Haryana',
        validFrom: '2019-07-01',
        validTo: '2029-06-30',
        ...BY,
      },
    ])
    .onConflictDoNothing();
  console.log('  Identifiers seeded (UDISE + board affiliation codes)');

  await tx
    .insert(instituteAffiliations)
    .values([
      {
        id: SEED_IDS.AFFILIATION_CBSE_INST1,
        tenantId: inst1Id,
        board: 'CBSE',
        affiliationStatus: 'REGULAR',
        affiliationNumber: '530456',
        grantedLevel: 'Senior Secondary (Class XII)',
        validFrom: '2020-04-01',
        validTo: '2030-03-31',
        ...BY,
      },
      {
        id: SEED_IDS.AFFILIATION_BSEH_INST2,
        tenantId: inst2Id,
        board: 'BSEH',
        affiliationStatus: 'REGULAR',
        affiliationNumber: 'BSEH-1234',
        grantedLevel: 'Secondary (Class X)',
        validFrom: '2019-07-01',
        validTo: '2029-06-30',
        ...BY,
      },
    ])
    .onConflictDoNothing();
  console.log('  Affiliations seeded (CBSE for Inst1, BSEH for Inst2)');
}

async function seedNotificationConfigs(tx: DrizzleDB, instituteIds: string[]) {
  const notificationTypes = ['FEE', 'ATTENDANCE', 'APPROVAL'];
  for (const instId of instituteIds) {
    for (const type of notificationTypes) {
      await tx
        .insert(instituteNotificationConfigs)
        .values({
          tenantId: instId,
          notificationType: type,
          inAppEnabled: true,
          whatsappEnabled: true,
          emailEnabled: true,
          pushEnabled: false,
          digestEnabled: false,
          ...BY,
        })
        .onConflictDoUpdate({
          target: [
            instituteNotificationConfigs.tenantId,
            instituteNotificationConfigs.notificationType,
          ],
          set: { updatedAt: new Date() },
        });
    }
  }
  console.log('  Notification configs seeded');
}

async function seedAcademicStructure(
  tx: DrizzleDB,
  instId: string,
  ayId: string,
  stdDefs: StandardDef[],
  label: string,
) {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const [ay] = await tx
    .insert(academicYears)
    .values({
      id: ayId,
      tenantId: instId,
      label: `${startYear}-${startYear + 1}`,
      startDate: `${startYear}-04-01`,
      endDate: `${startYear + 1}-03-31`,
      isActive: true,
      status: 'ACTIVE',
      termStructure: [
        { label: 'Term 1', startDate: `${startYear}-04-01`, endDate: `${startYear}-09-30` },
        { label: 'Term 2', startDate: `${startYear}-10-01`, endDate: `${startYear + 1}-03-31` },
      ],
      ...BY,
    })
    .onConflictDoNothing()
    .returning({ id: academicYears.id });

  if (!ay) return null;

  const streamConfigs: Record<string, { name: string; code: string }> = {
    Science: { name: 'Science PCM/PCB', code: 'science' },
    Commerce: { name: 'Commerce', code: 'commerce' },
    Arts: { name: 'Humanities', code: 'arts' },
  };

  for (const s of stdDefs) {
    const [std] = await tx
      .insert(standards)
      .values({
        tenantId: instId,
        academicYearId: ay.id,
        name: s.name,
        numericOrder: s.order,
        level: s.level,
        nepStage: s.nep ?? null,
        isBoardExamClass: s.boardExam ?? false,
        streamApplicable: s.stream ?? false,
        maxStudentsPerSection: s.level === 'PRE_PRIMARY' ? 30 : 40,
        udiseClassCode: s.udise,
        ...BY,
      })
      .onConflictDoNothing()
      .returning({ id: standards.id });

    if (std) {
      for (const secName of s.sections) {
        await tx
          .insert(sections)
          .values({
            tenantId: instId,
            standardId: std.id,
            academicYearId: ay.id,
            name: secName,
            displayLabel: `${s.name}-${secName}`,
            capacity: s.level === 'PRE_PRIMARY' ? 30 : 40,
            stream: streamConfigs[secName] ?? null,
            mediumOfInstruction: label.includes('NEP') ? 'English' : 'Hindi',
            shift: 'Morning',
            ...BY,
          })
          .onConflictDoNothing();
      }
    }
  }
  console.log(`  ${label}: ${stdDefs.length} standards, sections seeded`);
  return ay;
}

async function seedSubjects(
  tx: DrizzleDB,
  instId: string,
  subjectDefs: SubjectDef[],
): Promise<Record<string, string>> {
  const idMap: Record<string, string> = {};
  for (const s of subjectDefs) {
    const [sub] = await tx
      .insert(subjects)
      .values({
        tenantId: instId,
        name: s.name,
        shortName: s.shortName,
        boardCode: s.boardCode ?? null,
        type: s.type,
        isMandatory: s.mandatory,
        hasPractical: !!s.practical,
        theoryMarks: s.theory ?? null,
        practicalMarks: s.practical ?? null,
        internalMarks: s.internal ?? null,
        ...BY,
      })
      .onConflictDoNothing()
      .returning({ id: subjects.id });
    if (sub) idMap[s.shortName] = sub.id;
  }
  console.log(`  Subjects: ${Object.keys(idMap).length} created for ${instId.slice(-3)}`);
  return idMap;
}

async function linkSubjectsToStructure(
  tx: DrizzleDB,
  instId: string,
  ayId: string,
  subjectIds: Record<string, string>,
  mappings: SubjectMapping[],
) {
  const allStds = await tx
    .select({ id: standards.id, order: standards.numericOrder })
    .from(standards)
    .where(eq(standards.academicYearId, ayId));

  for (const mapping of mappings) {
    const [minOrder, maxOrder] = mapping.orderRange;
    const matchingStds = allStds.filter((s) => s.order >= minOrder && s.order <= maxOrder);

    for (const std of matchingStds) {
      for (const subKey of mapping.subjects) {
        const subId = subjectIds[subKey];
        if (!subId) continue;

        await tx
          .insert(standardSubjects)
          .values({ tenantId: instId, subjectId: subId, standardId: std.id, ...BY })
          .onConflictDoNothing();

        const secs = await tx
          .select({ id: sections.id })
          .from(sections)
          .where(eq(sections.standardId, std.id));

        for (const sec of secs) {
          await tx
            .insert(sectionSubjects)
            .values({ tenantId: instId, subjectId: subId, sectionId: sec.id, ...BY })
            .onConflictDoNothing();
        }
      }
    }
  }
  console.log(`  Subject links created for ${instId.slice(-3)}`);
}

async function seedSystemRoles(tx: DrizzleDB) {
  const systemRoles = [
    {
      id: SEED_IDS.ROLE_PLATFORM_ADMIN,
      scope: 'platform',
      name: 'platform_admin',
      abilities: [{ action: 'manage', subject: 'all' }],
    },
    {
      id: SEED_IDS.ROLE_PLATFORM_SUPPORT,
      scope: 'platform',
      name: 'platform_support',
      abilities: [
        { action: 'read', subject: 'all' },
        { action: 'impersonate', subject: 'User' },
      ],
    },
    {
      id: SEED_IDS.ROLE_RESELLER_FULL_ADMIN,
      scope: 'reseller',
      name: 'reseller_full_admin',
      resellerId: SEED_IDS.RESELLER_DIRECT,
      abilities: [
        { action: 'create', subject: 'Institute' },
        { action: 'read', subject: 'Institute' },
        { action: 'update', subject: 'Institute' },
        { action: 'update_status', subject: 'Institute' },
        { action: 'view_statistics', subject: 'Institute' },
        { action: 'impersonate', subject: 'User' },
        { action: 'manage', subject: 'InstituteGroup' },
        { action: 'read', subject: 'AcademicYear' },
        { action: 'read', subject: 'Standard' },
        { action: 'read', subject: 'Section' },
        { action: 'read', subject: 'Subject' },
        { action: 'manage', subject: 'SubscriptionPlan' },
        { action: 'manage', subject: 'Subscription' },
        { action: 'manage', subject: 'Invoice' },
        { action: 'manage', subject: 'Payment' },
        { action: 'manage', subject: 'PaymentGatewayConfig' },
        { action: 'read', subject: 'BillingDashboard' },
        { action: 'read', subject: 'AuditLog' },
      ],
    },
    {
      id: SEED_IDS.ROLE_RESELLER_SUPPORT_ADMIN,
      scope: 'reseller',
      name: 'reseller_support_admin',
      resellerId: SEED_IDS.RESELLER_DIRECT,
      abilities: [
        { action: 'read', subject: 'all' },
        { action: 'impersonate', subject: 'User' },
      ],
    },
    {
      id: SEED_IDS.ROLE_RESELLER_VIEWER,
      scope: 'reseller',
      name: 'reseller_viewer',
      resellerId: SEED_IDS.RESELLER_DIRECT,
      abilities: [{ action: 'read', subject: 'all' }],
    },
  ];

  for (const sr of systemRoles) {
    await tx
      .insert(roles)
      .values({
        id: sr.id,
        scope: sr.scope,
        resellerId: 'resellerId' in sr ? sr.resellerId : null,
        name: { en: sr.name },
        abilities: JSON.parse(JSON.stringify(sr.abilities)),
        isSystem: true,
        isDefault: false,
        ...BY,
      })
      .onConflictDoUpdate({ target: roles.id, set: { updatedAt: new Date() } });
    console.log(`  System role: ${sr.name} (${sr.scope})`);
  }
}

async function seedInstituteRoles(tx: DrizzleDB, inst1Id: string, inst2Id: string) {
  const roleIds: Partial<Record<DefaultRole, string>> = {};
  const roleIds2: Partial<Record<DefaultRole, string>> = {};

  for (const [, roleName] of Object.entries(DefaultRoles)) {
    const abilities = DEFAULT_ROLE_ABILITIES[roleName];

    const [role] = await tx
      .insert(roles)
      .values({
        tenantId: inst1Id,
        scope: 'institute',
        name: { en: roleName },
        abilities: JSON.parse(JSON.stringify(abilities)),
        isDefault: true,
        ...BY,
      })
      .onConflictDoUpdate({ target: [roles.tenantId, roles.name], set: { updatedAt: new Date() } })
      .returning();
    roleIds[roleName] = role.id;

    const [role2] = await tx
      .insert(roles)
      .values({
        tenantId: inst2Id,
        scope: 'institute',
        name: { en: roleName },
        abilities: JSON.parse(JSON.stringify(abilities)),
        isDefault: true,
        ...BY,
      })
      .onConflictDoUpdate({ target: [roles.tenantId, roles.name], set: { updatedAt: new Date() } })
      .returning();
    roleIds2[roleName] = role2.id;

    console.log(`  Role: ${roleName}`);
  }

  return { roleIds, roleIds2 };
}

async function seedUsersAndMemberships(
  tx: DrizzleDB,
  inst1Id: string,
  inst2Id: string,
  roleIds: Partial<Record<DefaultRole, string>>,
  roleIds2: Partial<Record<DefaultRole, string>>,
) {
  function requireRole(ids: typeof roleIds, role: DefaultRole): string {
    const id = ids[role];
    if (!id) throw new Error(`Role "${role}" not found in seeded roles`);
    return id;
  }

  const adminPassword = await hash('admin123');
  const resellerPassword = await hash('reseller123');
  const teacherPassword = await hash('teacher123');
  const studentPassword = await hash('student123');

  const [admin] = await tx
    .insert(users)
    .values({
      id: SEED_IDS.USER_ADMIN,
      username: 'admin',
      email: 'admin@svm-ggn.edu.in',
      passwordHash: adminPassword,
    })
    .onConflictDoUpdate({ target: users.username, set: { updatedAt: new Date() } })
    .returning();
  const [teacher] = await tx
    .insert(users)
    .values({
      id: SEED_IDS.USER_TEACHER,
      username: 'teacher1',
      email: 'teacher1@svm-ggn.edu.in',
      passwordHash: teacherPassword,
    })
    .onConflictDoUpdate({ target: users.username, set: { updatedAt: new Date() } })
    .returning();
  const [student] = await tx
    .insert(users)
    .values({
      id: SEED_IDS.USER_STUDENT,
      username: 'student1',
      email: 'student1@svm-ggn.edu.in',
      passwordHash: studentPassword,
    })
    .onConflictDoUpdate({ target: users.username, set: { updatedAt: new Date() } })
    .returning();
  const [resellerUser] = await tx
    .insert(users)
    .values({
      id: SEED_IDS.USER_RESELLER,
      username: 'reseller1',
      email: 'reseller1@roviq.com',
      passwordHash: resellerPassword,
    })
    .onConflictDoUpdate({ target: users.username, set: { updatedAt: new Date() } })
    .returning();

  // admin — member of BOTH institutes + platform admin
  await tx
    .insert(memberships)
    .values({
      id: SEED_IDS.MEMBERSHIP_ADMIN_INST1,
      userId: admin.id,
      tenantId: inst1Id,
      roleId: requireRole(roleIds, 'institute_admin'),
      ...BY,
    })
    .onConflictDoUpdate({
      target: [memberships.userId, memberships.tenantId, memberships.roleId],
      set: { updatedAt: new Date() },
    });
  await tx
    .insert(memberships)
    .values({
      id: SEED_IDS.MEMBERSHIP_ADMIN_INST2,
      userId: admin.id,
      tenantId: inst2Id,
      roleId: requireRole(roleIds2, 'institute_admin'),
      ...BY,
    })
    .onConflictDoUpdate({
      target: [memberships.userId, memberships.tenantId, memberships.roleId],
      set: { updatedAt: new Date() },
    });
  await tx
    .insert(platformMemberships)
    .values({ userId: admin.id, roleId: SEED_IDS.ROLE_PLATFORM_ADMIN })
    .onConflictDoUpdate({ target: platformMemberships.userId, set: { updatedAt: new Date() } });
  console.log(`  User: ${admin.username} / admin123 (institute_admin both + platform_admin)`);

  // reseller
  await tx
    .insert(resellerMemberships)
    .values({
      userId: resellerUser.id,
      resellerId: SEED_IDS.RESELLER_DIRECT,
      roleId: SEED_IDS.ROLE_RESELLER_FULL_ADMIN,
    })
    .onConflictDoUpdate({
      target: [resellerMemberships.userId, resellerMemberships.resellerId],
      set: { updatedAt: new Date() },
    });
  console.log(`  User: ${resellerUser.username} / reseller123 (reseller_full_admin)`);

  // teacher — single institute
  await tx
    .insert(memberships)
    .values({
      id: SEED_IDS.MEMBERSHIP_TEACHER_INST1,
      userId: teacher.id,
      tenantId: inst1Id,
      roleId: requireRole(roleIds, 'class_teacher'),
      ...BY,
    })
    .onConflictDoUpdate({
      target: [memberships.userId, memberships.tenantId, memberships.roleId],
      set: { updatedAt: new Date() },
    });
  console.log(`  User: ${teacher.username} / teacher123 (class_teacher)`);

  // student — single institute
  await tx
    .insert(memberships)
    .values({
      id: SEED_IDS.MEMBERSHIP_STUDENT_INST1,
      userId: student.id,
      tenantId: inst1Id,
      roleId: requireRole(roleIds, 'student'),
      ...BY,
    })
    .onConflictDoUpdate({
      target: [memberships.userId, memberships.tenantId, memberships.roleId],
      set: { updatedAt: new Date() },
    });
  console.log(`  User: ${student.username} / student123 (student)`);

  // Auth providers (password-based)
  for (const user of [admin, teacher, student, resellerUser]) {
    await tx
      .insert(authProviders)
      .values({ userId: user.id, provider: 'password', providerUserId: user.id })
      .onConflictDoUpdate({
        target: [authProviders.provider, authProviders.providerUserId],
        set: { updatedAt: new Date() },
      });
  }
}

async function seedBillingData(tx: DrizzleDB) {
  const [freePlan] = await tx
    .insert(plans)
    .values({
      id: SEED_IDS.PLAN_FREE,
      resellerId: SEED_IDS.RESELLER_DIRECT,
      name: { en: 'Free' },
      description: { en: 'Free tier for evaluation' },
      code: 'FREE',
      interval: 'MONTHLY',
      amount: 0n,
      currency: 'INR',
      entitlements: {
        maxStudents: 10,
        maxStaff: 5,
        maxStorageMb: 512,
        auditLogRetentionDays: 90,
        features: [],
      },
      ...BY,
    })
    .onConflictDoUpdate({ target: plans.id, set: { updatedAt: new Date() } })
    .returning();
  console.log(`  Plan: ${(freePlan.name as Record<string, string>).en}`);

  const [proPlan] = await tx
    .insert(plans)
    .values({
      id: SEED_IDS.PLAN_PRO,
      resellerId: SEED_IDS.RESELLER_DIRECT,
      name: { en: 'Pro' },
      description: { en: 'Professional plan for growing institutes' },
      code: 'PRO',
      interval: 'MONTHLY',
      amount: 99900n,
      currency: 'INR',
      entitlements: {
        maxStudents: 500,
        maxStaff: 50,
        maxStorageMb: 5120,
        auditLogRetentionDays: 365,
        features: ['advanced_timetable', 'bulk_sms'],
      },
      ...BY,
    })
    .onConflictDoUpdate({ target: plans.id, set: { updatedAt: new Date() } })
    .returning();
  console.log(`  Plan: ${(proPlan.name as Record<string, string>).en}`);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL,
  });
  const db = drizzle({ client: pool }) as unknown as DrizzleDB;

  const existing = await withAdmin(db, async (tx) => {
    const rows = await tx
      .select()
      .from(institutes)
      .where(eq(institutes.slug, 'saraswati-vidya-mandir'))
      .limit(1);
    return rows[0] ?? null;
  });

  if (existing) {
    console.log('Database already seeded, skipping.');
    await pool.end();
    process.exit(0);
  }

  console.log('Seeding database...');

  await withAdmin(db, async (tx) => {
    // SYSTEM_USER row — referenced by every createdBy/updatedBy on business
    // tables during seed, migrations, NATS consumers, and tests. Its ID must
    // resolve to a real users row or FK constraints fire on user_profiles,
    // student_profiles, staff, etc.
    await tx
      .insert(users)
      .values({
        id: SYSTEM_USER_ID,
        username: 'system',
        email: 'system@roviq.internal',
        passwordHash: 'disabled-system-user-no-login',
      })
      .onConflictDoNothing({ target: users.id });

    await seedReseller(tx);
    const { inst1, inst2 } = await seedInstitutes(tx);

    await seedBrandingAndConfigs(tx, inst1.id, inst2.id);
    await seedIdentifiersAndAffiliations(tx, inst1.id, inst2.id);
    await seedNotificationConfigs(tx, [inst1.id, inst2.id]);

    const ay1 = await seedAcademicStructure(
      tx,
      inst1.id,
      SEED_IDS.ACADEMIC_YEAR_INST1,
      INST1_STANDARDS,
      'Institute 1 (NEP)',
    );
    const ay2 = await seedAcademicStructure(
      tx,
      inst2.id,
      SEED_IDS.ACADEMIC_YEAR_INST2,
      INST2_STANDARDS,
      'Institute 2 (Traditional)',
    );

    const inst1SubjectIds = await seedSubjects(tx, inst1.id, INST1_SUBJECTS);
    const inst2SubjectIds = await seedSubjects(tx, inst2.id, INST2_SUBJECTS);

    if (ay1)
      await linkSubjectsToStructure(tx, inst1.id, ay1.id, inst1SubjectIds, INST1_SUBJECT_MAPPINGS);
    if (ay2)
      await linkSubjectsToStructure(tx, inst2.id, ay2.id, inst2SubjectIds, INST2_SUBJECT_MAPPINGS);

    await seedSystemRoles(tx);
    const { roleIds, roleIds2 } = await seedInstituteRoles(tx, inst1.id, inst2.id);
    await seedUsersAndMemberships(tx, inst1.id, inst2.id, roleIds, roleIds2);
    await seedBillingData(tx);
  });

  console.log('\n✓ Seed complete!');
  console.log('\nTest logins:');
  console.log('  Admin portal   (admin.localhost:4200):     admin / admin123');
  console.log('  Reseller portal (reseller.localhost:4200): reseller1 / reseller123');
  console.log('  Institute portal (localhost:4200):');
  console.log(
    '    admin / admin123       → multi-institute picker (Saraswati Vidya Mandir + Rajasthan Public School)',
  );
  console.log('    teacher1 / teacher123  → direct to Saraswati Vidya Mandir');
  console.log('    student1 / student123  → direct to Saraswati Vidya Mandir');
  console.log('\nInstitute profiles:');
  console.log('  Saraswati Vidya Mandir — NEP + CBSE, Gurugram, Nursery–Class 12, 20 subjects');
  console.log('  Rajasthan Public School — Traditional + BSEH, Jaipur, Class 1–10, 9 subjects');

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
