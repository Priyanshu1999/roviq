import type { AppAction, AppSubject } from '@roviq/common-types';
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

/**
 * One entry in the navigation slug registry. Maps a stable symbolic key
 * (stored in `roles.primary_nav_slugs`) to its visible href / icon / label.
 */
export interface NavRegistryEntry {
  href: string;
  icon: LucideIcon;
  /** Pre-translated label for the bottom tab bar. */
  label: string;
  /**
   * Optional CASL ability the viewing user must have for this slug to render.
   * Slugs without ability are silently dropped from the bottom tab bar.
   */
  ability?: { action: AppAction; subject: AppSubject };
}

export interface BottomNavConfig {
  /** Per-user slug list resolved from `role.primaryNavSlugs`. Up to 4 entries. */
  slugs: string[];
  /** Fallback when `slugs` is empty (custom role with no curated list). */
  defaultSlugs: string[];
  /** Label for the "More" trigger that opens the existing sidebar drawer. */
  moreLabel: string;
}

export interface LayoutConfig {
  appName: string;
  navGroups: NavGroup[];
  user?: UserInfo;
  onLogout?: () => void;
  instituteSwitcher?: InstituteSwitcherConfig;
  notifications?: NotificationConfig;
  /**
   * Symbolic-slug → render-info map used to resolve bottom-nav slugs into
   * actual links. Required when `bottomNav` is set.
   */
  navRegistry?: Record<string, NavRegistryEntry>;
  /** Phone bottom tab bar configuration. Renders only below the `lg` breakpoint. */
  bottomNav?: BottomNavConfig;
  /**
   * Add a "Search" entry to the drawer body that opens the CommandPalette.
   * (CommandPalette stays mounted regardless — this only controls the menu item.)
   */
  searchEnabled?: boolean;
  /**
   * Optional callback fired when the drawer's "Search" entry is selected.
   * If omitted but `searchEnabled` is true, the drawer dispatches the standard
   * Cmd/Ctrl+K event so any listener (e.g. CommandPalette) opens.
   */
  onSearch?: () => void;
}
