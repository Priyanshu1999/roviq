import type { InstituteAddress, InstituteContact } from '@roviq/database';

export interface InstituteRecord {
  id: string;
  name: Record<string, string>;
  slug: string;
  code: string | null;
  type: string;
  structureFramework: string;
  setupStatus: string;
  contact: InstituteContact;
  address: InstituteAddress | null;
  logoUrl: string | null;
  timezone: string;
  currency: string;
  settings: Record<string, unknown>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInstituteData {
  name: Record<string, string>;
  slug: string;
  code?: string;
  type?: string;
  structureFramework?: string;
  contact?: InstituteContact;
  address?: InstituteAddress;
}

export interface InstituteSearchParams {
  search?: string;
  status?: string;
  type?: string;
  first?: number;
  after?: string;
}

export interface UpdateInstituteInfoData {
  name?: Record<string, string>;
  code?: string;
  contact?: InstituteContact;
  address?: InstituteAddress;
  timezone?: string;
  currency?: string;
}
