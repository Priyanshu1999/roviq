import type { AcademicYearStatus } from '@roviq/database';
import type { AcademicYearRecord, CreateAcademicYearData, UpdateAcademicYearData } from './types';

export abstract class AcademicYearRepository {
  abstract findById(id: string): Promise<AcademicYearRecord | null>;
  abstract findAll(): Promise<AcademicYearRecord[]>;
  abstract findActive(): Promise<AcademicYearRecord | null>;
  /** Find academic years whose date ranges overlap with the given range (excludes the given id) */
  abstract findOverlapping(
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<AcademicYearRecord[]>;
  abstract create(data: CreateAcademicYearData): Promise<AcademicYearRecord>;
  abstract update(id: string, data: UpdateAcademicYearData): Promise<AcademicYearRecord>;
  abstract activate(id: string, previousActiveId: string | null): Promise<AcademicYearRecord>;
  abstract updateStatus(id: string, status: AcademicYearStatus): Promise<AcademicYearRecord>;
}
