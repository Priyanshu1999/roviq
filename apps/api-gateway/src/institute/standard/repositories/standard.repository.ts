import type { CreateStandardData, StandardRecord, UpdateStandardData } from './types';

export abstract class StandardRepository {
  abstract findById(id: string): Promise<StandardRecord | null>;
  abstract findByAcademicYear(academicYearId: string): Promise<StandardRecord[]>;
  abstract create(data: CreateStandardData): Promise<StandardRecord>;
  abstract update(id: string, data: UpdateStandardData): Promise<StandardRecord>;
  abstract softDelete(id: string): Promise<void>;
}
