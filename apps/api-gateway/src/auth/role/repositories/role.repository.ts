import type { RoleRecord } from './types';

export abstract class InstituteRoleRepository {
  abstract list(): Promise<RoleRecord[]>;
  abstract findById(id: string): Promise<RoleRecord | null>;
  abstract updatePrimaryNavSlugs(id: string, slugs: string[]): Promise<RoleRecord>;
}
