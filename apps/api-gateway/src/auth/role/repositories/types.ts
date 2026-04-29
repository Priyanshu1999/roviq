import type { I18nContent } from '@roviq/database';

export interface RoleRecord {
  id: string;
  tenantId: string | null;
  name: I18nContent;
  isDefault: boolean;
  isSystem: boolean;
  primaryNavSlugs: string[];
}
