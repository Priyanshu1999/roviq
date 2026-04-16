// ── Contact & Address types (match Drizzle InstituteContact / InstituteAddress) ──

export interface InstitutePhone {
  countryCode: string;
  number: string;
  isPrimary: boolean;
  isWhatsappEnabled: boolean;
  label: string;
}

export interface InstituteEmail {
  address: string;
  isPrimary: boolean;
  label: string;
}

export interface InstituteContact {
  phones: InstitutePhone[];
  emails: InstituteEmail[];
}

export interface InstituteAddress {
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  district: string;
  state: string;
  postalCode: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
}

// ── Branding ──

export interface InstituteBranding {
  id: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  themeIdentifier?: string | null;
  coverImageUrl?: string | null;
}

// ── Config ──

export interface ShiftConfig {
  name: string;
  start: string;
  end: string;
}

export interface TermConfig {
  label: string;
  startDate: string;
  endDate: string;
}

export interface SectionStrengthNorms {
  optimal: number;
  hardMax: number;
  exemptionAllowed: boolean;
}

export interface AdmissionNumberConfig {
  format: string;
  yearFormat: string;
  prefixes: Record<string, string>;
  noPrefixFromClass: number;
}

export interface InstituteConfig {
  id: string;
  attendanceType?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  shifts?: ShiftConfig[] | null;
  notificationPreferences?: Record<string, unknown> | null;
  payrollConfig?: Record<string, unknown> | null;
  gradingSystem?: Record<string, unknown> | null;
  termStructure?: TermConfig[] | null;
  sectionStrengthNorms?: SectionStrengthNorms | null;
  admissionNumberConfig?: AdmissionNumberConfig | null;
}

// ── Identifiers & Affiliations (read-only display) ──

export interface InstituteIdentifier {
  id: string;
  type: string;
  value: string;
  issuingAuthority?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
}

export interface InstituteAffiliation {
  id: string;
  board: string;
  affiliationStatus: string;
  affiliationNumber?: string | null;
  grantedLevel?: string | null;
  validFrom: string;
  validTo: string;
  nocNumber?: string | null;
  nocDate?: string | null;
}

// ── MyInstitute query result ──

export interface MyInstituteData {
  myInstitute: {
    id: string;
    name: Record<string, string>;
    slug: string;
    code?: string | null;
    type: string;
    structureFramework: string;
    setupStatus: string;
    departments?: string[] | null;
    version: number;
    contact: InstituteContact;
    address?: InstituteAddress | null;
    logoUrl?: string | null;
    timezone: string;
    currency: string;
    settings: Record<string, unknown>;
    status: string;
    createdAt: string;
    updatedAt: string;
    branding?: InstituteBranding | null;
    config?: InstituteConfig | null;
    identifiers?: InstituteIdentifier[];
    affiliations?: InstituteAffiliation[];
  };
}

// ── Mutation result types ──

export interface UpdateInstituteInfoData {
  updateInstituteInfo: MyInstituteData['myInstitute'];
}

export interface UpdateInstituteBrandingData {
  updateInstituteBranding: MyInstituteData['myInstitute'];
}

export interface UpdateInstituteConfigData {
  updateInstituteConfig: MyInstituteData['myInstitute'];
}

// ── Subscription payloads ──

export interface InstituteBrandingUpdatedData {
  instituteBrandingUpdated: MyInstituteData['myInstitute'];
}

export interface InstituteConfigUpdatedData {
  instituteConfigUpdated: MyInstituteData['myInstitute'];
}
