/**
 * Single source of truth for `data-testid` values used by Playwright + RTL.
 *
 * Why a registry:
 *  - Renaming a testid happens in one place.
 *  - Production code and e2e specs share the exact same string.
 *  - Dynamic IDs (rows, cells) get a typed builder so `${row.id}` typos are
 *    impossible.
 *
 * Cross-app import:
 *  - apps/web → relative or `@web/testing/testid-registry`
 *  - e2e/* → `@web/testing/testid-registry` (resolved via `@web/*` alias in
 *    `tsconfig.base.json`, inherited by `e2e/tsconfig.json`).
 *
 * Scope:
 *  - Only `apps/web/src/**` is policed by `scripts/check-testid-literals.ts`.
 *  - `libs/frontend/ui` keeps its existing string literals (sidebar,
 *    bottom-tab-bar, breadcrumbs). The `layout` group below mirrors them so
 *    e2e specs can reference everything through one object — but UI lib
 *    components are not refactored to import from here.
 */

export const testIds = {
  // ── Cross-cutting layout (mirrors libs/frontend/ui literals) ───────────
  layout: {
    desktopSidebar: 'desktop-sidebar',
    desktopSidebarToggle: 'desktop-sidebar-toggle',
    mobileSidebarSheet: 'mobile-sidebar-sheet',
    bottomTabBar: 'bottom-tab-bar',
    bottomTabIndicator: 'bottom-tab-indicator',
    bottomTabMore: 'bottom-tab-more',
    bottomTab: (slug: string) => `bottom-tab-${slug}`,
    breadcrumbsDesktop: 'breadcrumbs-desktop',
    notFoundTitle: 'not-found-title',
    localeSwitcher: 'locale-switcher',
    localeOption: (code: string) => `locale-option-${code}`,
    themeToggle: 'theme-toggle',
    themeOption: (mode: 'system' | 'light' | 'dark') => `theme-${mode}`,
    instituteSwitcher: 'institute-switcher',
    instituteSwitcherMenu: 'institute-switcher-menu',
  },

  // ── Admin: institutes list + filters + columns ─────────────────────────
  adminInstitutes: {
    page: 'institutes-page',
    title: 'institutes-title',
    description: 'institutes-description',
    table: 'institutes-table',
    tabAll: 'institutes-tab-all',
    tabPending: 'institutes-tab-pending',
    nameCell: (id: string) => `institute-name-cell-${id}`,
    // Column header testids consumed by e2e (rendered by DataTable; we expose
    // them here so specs use the same string everywhere)
    colName: 'institutes-table-col-name',
    colCode: 'institutes-table-col-code',
    colType: 'institutes-table-col-type',
    colStatus: 'institutes-table-col-status',
    colReseller: 'institutes-table-col-reseller',
    colGroup: 'institutes-table-col-group',

    // Filters
    filterReseller: 'filter-reseller-combobox',
    filterGroup: 'filter-group-combobox',
  },

  // ── Admin: institute detail page ───────────────────────────────────────
  adminInstituteDetail: {
    page: 'institute-detail-page',
    title: 'institute-detail-title',
    identityCard: 'institute-detail-identity-card',
    identityTitle: 'institute-detail-identity-title',
    contactCard: 'institute-detail-contact-card',
    contactTitle: 'institute-detail-contact-title',
    addressCard: 'institute-detail-address-card',
    addressTitle: 'institute-detail-address-title',
    tabOverview: 'institute-detail-tab-overview',
    tabSetup: 'institute-detail-tab-setup',
    tabAcademic: 'institute-detail-tab-academic',
    tabUsers: 'institute-detail-tab-users',
    tabConfig: 'institute-detail-tab-config',
    tabBranding: 'institute-detail-tab-branding',
    tabAudit: 'institute-detail-tab-audit',
    actionApprove: 'action-approve',
    actionReassignReseller: 'action-reassign-reseller',
    actionAssignGroup: 'action-assign-group',
    actionRemoveGroup: 'action-remove-group',
    actionRestore: 'action-restore',
    reassignResellerCombobox: 'reassign-reseller-combobox',
    assignGroupCombobox: 'assign-group-combobox',
  },

  // ── Admin: dashboard ───────────────────────────────────────────────────
  adminDashboard: {
    page: 'admin-dashboard-page',
    welcomeCard: 'admin-dashboard-welcome-card',
    welcomeTitle: 'admin-dashboard-welcome-title',
    welcomeDescription: 'admin-dashboard-welcome-description',
    quickLinksTitle: 'admin-dashboard-quick-links-title',
    quickLink: (id: string) => `admin-dashboard-link-${id}`,
    quickLinkAnchor: (id: string) => `admin-dashboard-link-${id}-link`,
  },

  // ── Admin: institute groups (referenced by navigation e2e) ─────────────
  adminInstituteGroups: {
    title: 'institute-groups-title',
  },

  // ── Admin: audit logs (referenced by navigation e2e) ───────────────────
  adminAuditLogs: {
    title: 'audit-logs-title',
  },

  // ── Institute: dashboard ───────────────────────────────────────────────
  instituteDashboard: {
    welcomeCard: 'dashboard-welcome-card',
    getStarted: 'dashboard-get-started',
    quickLinks: 'dashboard-quick-links',
    quickLink: (id: string) => `dashboard-quick-link-${id}`,
    attendanceKpiCard: 'dashboard-attendance-kpi-card',
    attendanceKpiLink: 'dashboard-attendance-kpi-link',
    attendanceKpiByStatus: (status: string) => `dashboard-attendance-kpi-${status}`,
  },

  // ── Institute: students list + detail ──────────────────────────────────
  instituteStudents: {
    title: 'students-title',
    description: 'students-description',
    searchInput: 'students-search-input',
    statusFilter: 'students-status-filter',
    statusOption: (status: string) => `students-status-option-${status}`,
    genderFilter: 'students-gender-filter',
    categoryFilter: 'students-category-filter',
    rteFilter: 'students-rte-filter',
    clearFiltersBtn: 'students-clear-filters-btn',
    exportBtn: 'students-export-btn',
    newBtn: 'students-new-btn',
    table: 'students-table',
    emptyState: 'students-empty-state',
    pageSizeSelect: 'students-page-size-select',
    sortAdmissionBtn: 'students-sort-admission-btn',
    studentCard: (id: string) => `student-card-${id}`,
    detailTabProfile: 'students-detail-tab-profile',
    detailTabAcademics: 'students-detail-tab-academics',
    detailTabGuardians: 'students-detail-tab-guardians',
    detailTabDocuments: 'students-detail-tab-documents',
    detailTabTcHistory: 'students-detail-tab-tc-history',
    detailTabAudit: 'students-detail-tab-audit',
    detailFirstNameEn: 'students-detail-first-name-en',
    detailSocialCategory: 'students-detail-social-category',
    detailSaveBtn: 'students-detail-save-btn',
    detailGuardiansEmpty: 'students-detail-guardians-empty',
    detailDocumentsEmpty: 'students-detail-documents-empty',
    detailTcEmpty: 'students-detail-tc-empty',
    detailAuditEmpty: 'students-detail-audit-empty',
  },

  // ── Institute: settings → roles (primary nav per role) ─────────────────
  instituteRoles: {
    forbidden: 'role-nav-forbidden',
    error: 'role-nav-error',
    empty: 'role-nav-empty',
    row: (id: string) => `role-row-${id}`,
    customize: (id: string) => `role-customize-${id}`,
  },
} as const;
