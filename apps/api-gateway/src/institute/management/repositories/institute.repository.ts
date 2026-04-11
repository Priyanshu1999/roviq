import type { InstituteStatus } from '@roviq/database';
import type {
  CreateInstituteData,
  InstituteRecord,
  InstituteSearchParams,
  InstituteStatistics,
  UpdateInstituteBrandingData,
  UpdateInstituteConfigData,
  UpdateInstituteInfoData,
} from './types';

export abstract class InstituteRepository {
  abstract findById(id: string): Promise<InstituteRecord | null>;
  abstract findByIdIncludeDeleted(id: string): Promise<InstituteRecord | null>;
  abstract search(
    params: InstituteSearchParams,
  ): Promise<{ records: InstituteRecord[]; total: number }>;
  abstract create(data: CreateInstituteData): Promise<InstituteRecord>;
  abstract updateInfo(id: string, data: UpdateInstituteInfoData): Promise<InstituteRecord>;
  abstract updateStatus(id: string, status: InstituteStatus): Promise<InstituteRecord>;
  abstract updateBranding(id: string, data: UpdateInstituteBrandingData): Promise<InstituteRecord>;
  abstract updateConfig(id: string, data: UpdateInstituteConfigData): Promise<InstituteRecord>;
  abstract softDelete(id: string): Promise<void>;
  abstract restore(id: string): Promise<InstituteRecord>;
  abstract searchByReseller(
    resellerId: string,
    params: InstituteSearchParams,
  ): Promise<{ records: InstituteRecord[]; total: number }>;
  abstract findByReseller(resellerId: string, id: string): Promise<InstituteRecord | null>;
  abstract statisticsByReseller(
    resellerId: string,
  ): Promise<{ totalInstitutes: number; byStatus: Array<{ key: string; count: number }> }>;
  abstract findBranding(instituteId: string): Promise<Record<string, unknown> | null>;
  abstract findConfig(instituteId: string): Promise<Record<string, unknown> | null>;
  abstract findIdentifiers(instituteId: string): Promise<Record<string, unknown>[]>;
  abstract findAffiliations(instituteId: string): Promise<Record<string, unknown>[]>;

  /** Platform-wide institute statistics (admin scope). */
  abstract statistics(): Promise<InstituteStatistics>;
}
