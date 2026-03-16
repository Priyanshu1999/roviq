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

export interface OrgSwitcherConfig {
  currentTenantId: string;
  currentOrgName: string;
  memberships: { tenantId: string; orgName: string; orgLogoUrl?: string; roleName: string }[];
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
  orgSwitcher?: OrgSwitcherConfig;
  notifications?: NotificationConfig;
}
