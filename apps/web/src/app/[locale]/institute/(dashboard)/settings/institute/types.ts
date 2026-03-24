// --- Contact & Address types (JSONB fields) ---

export interface InstitutePhone {
  country_code: string;
  number: string;
  is_primary: boolean;
  is_whatsapp_enabled: boolean;
  label: string;
}

export interface InstituteEmail {
  address: string;
  is_primary: boolean;
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
  postal_code: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
}

// --- Branding ---

export interface InstituteBranding {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  themeIdentifier?: string | null;
  coverImageUrl?: string | null;
}

// --- Config ---

export interface ShiftConfig {
  name: string;
  start_time: string;
  end_time: string;
}

export interface TermConfig {
  label: string;
  start_date: string;
  end_date: string;
}

export interface SectionStrengthNorms {
  optimal: number;
  hard_max: number;
  exemption_allowed: boolean;
}

export interface InstituteConfig {
  attendanceType?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  shifts?: ShiftConfig[] | null;
  notificationPreferences?: Record<string, unknown> | null;
  payrollConfig?: Record<string, unknown> | null;
  gradingSystem?: Record<string, unknown> | null;
  termStructure?: TermConfig[] | null;
  sectionStrengthNorms?: SectionStrengthNorms | null;
}

// --- Identifiers & Affiliations (read-only display) ---

export interface InstituteIdentifier {
  type: string;
  value: string;
  issuedBy?: string;
  validUntil?: string;
}

export interface InstituteAffiliation {
  board: string;
  affiliationStatus: string;
  affiliationNumber?: string;
  grantedLevel?: string;
  validFrom?: string;
  validTo?: string;
}

// --- MyInstitute query result ---

export interface MyInstituteData {
  myInstitute: {
    id: string;
    name: Record<string, string>;
    slug: string;
    code?: string | null;
    type: string;
    structureFramework: string;
    setupStatus: string;
    contact: InstituteContact;
    address?: InstituteAddress | null;
    logoUrl?: string | null;
    timezone: string;
    currency: string;
    settings: Record<string, unknown>;
    status: string;
    version: number;
    createdAt: string;
    updatedAt: string;
    branding?: InstituteBranding | null;
    config?: InstituteConfig | null;
    identifiers?: InstituteIdentifier[];
    affiliations?: InstituteAffiliation[];
    departments?: string[];
  };
}

// --- Mutation result types ---

export interface UpdateInstituteInfoData {
  updateInstituteInfo: MyInstituteData['myInstitute'];
}

export interface UpdateInstituteBrandingData {
  updateInstituteBranding: MyInstituteData['myInstitute'];
}

export interface UpdateInstituteConfigData {
  updateInstituteConfig: MyInstituteData['myInstitute'];
}

// --- Subscription payloads ---

export interface InstituteBrandingUpdatedData {
  instituteBrandingUpdated: MyInstituteData['myInstitute'];
}

export interface InstituteConfigUpdatedData {
  instituteConfigUpdated: MyInstituteData['myInstitute'];
}
