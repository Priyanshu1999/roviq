import type { CreateInstituteData, InstituteRecord, UpdateInstituteInfoData } from './types';

export abstract class InstituteRepository {
  abstract findById(id: string): Promise<InstituteRecord | null>;
  abstract findByIdIncludeDeleted(id: string): Promise<InstituteRecord | null>;
  abstract create(data: CreateInstituteData): Promise<InstituteRecord>;
  abstract updateInfo(id: string, data: UpdateInstituteInfoData): Promise<InstituteRecord>;
  abstract updateStatus(id: string, status: string): Promise<InstituteRecord>;
  abstract softDelete(id: string): Promise<void>;
  abstract restore(id: string): Promise<InstituteRecord>;
}
