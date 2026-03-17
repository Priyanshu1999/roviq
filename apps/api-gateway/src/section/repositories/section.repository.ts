import type { CreateSectionData, SectionRecord, UpdateSectionData } from './types';

export abstract class SectionRepository {
  abstract findById(id: string): Promise<SectionRecord | null>;
  abstract findByStandard(standardId: string): Promise<SectionRecord[]>;
  abstract create(data: CreateSectionData): Promise<SectionRecord>;
  abstract update(id: string, data: UpdateSectionData): Promise<SectionRecord>;
  abstract softDelete(id: string): Promise<void>;
}
