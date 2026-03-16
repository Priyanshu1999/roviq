import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon?: LucideIcon;
  badge?: string;
  disabled?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface InstituteSwitcherConfig {
  currentTenantId: string;
  currentInstituteName: string;
  memberships: {
    tenantId: string;
    instituteName: string;
    instituteLogoUrl?: string;
    roleName: string;
  }[];
  onSwitch: (tenantId: string) => void;
}

export interface UserInfo {
  username: string;
  email: string;
}

export interface NotificationConfig {
  applicationIdentifier: string;
  subscriberId: string;
  subscriberHash: string;
  tenantId?: string;
  backendUrl?: string;
  socketUrl?: string;
}

export interface LayoutConfig {
  appName: string;
  navGroups: NavGroup[];
  user?: UserInfo;
  onLogout?: () => void;
  instituteSwitcher?: InstituteSwitcherConfig;
  notifications?: NotificationConfig;
}
