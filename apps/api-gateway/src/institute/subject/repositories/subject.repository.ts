import type { CreateSubjectData, SubjectRecord, UpdateSubjectData } from './types';

export abstract class SubjectRepository {
  abstract findById(id: string): Promise<SubjectRecord | null>;
  abstract findAll(): Promise<SubjectRecord[]>;
  abstract findByStandard(standardId: string): Promise<SubjectRecord[]>;
  abstract create(data: CreateSubjectData): Promise<SubjectRecord>;
  abstract update(id: string, data: UpdateSubjectData): Promise<SubjectRecord>;
  abstract softDelete(id: string): Promise<void>;
  abstract assignToStandard(subjectId: string, standardId: string): Promise<void>;
  abstract removeFromStandard(subjectId: string, standardId: string): Promise<void>;
  abstract assignToSection(subjectId: string, sectionId: string): Promise<void>;
  abstract removeFromSection(subjectId: string, sectionId: string): Promise<void>;
}
