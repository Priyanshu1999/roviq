// Single source of truth for `data-testid` values shared by production code
// and tests. Lives in `@roviq/ui` so `libs/frontend/ui` layout components,
// `apps/web` pages, and `e2e/*` specs all import the SAME constant — drift
// between code and test is structurally impossible.
//
// Import path: `@roviq/ui/testing/testid-registry` (resolves via the
// `@roviq/ui/*` alias in `tsconfig.base.json`).
//
// Dynamic IDs (rows, cells) use a typed builder so `${row.id}` typos are
// caught at the producer. The `check:testids` CI gate enforces that
// migrated files no longer contain raw `data-testid="…"` literals.

export const testIds = {
  // ── Cross-cutting layout (consumed by libs/frontend/ui components) ─────
  layout: {
    topbar: 'topbar',
    desktopSidebar: 'desktop-sidebar',
    desktopSidebarToggle: 'desktop-sidebar-toggle',
    mobileSidebarSheet: 'mobile-sidebar-sheet',
    bottomTabBar: 'bottom-tab-bar',
    bottomTabIndicator: 'bottom-tab-indicator',
    bottomTabMore: 'bottom-tab-more',
    bottomTab: (slug: string) => `bottom-tab-${slug}`,
    breadcrumbsDesktop: 'breadcrumbs-desktop',
    breadcrumbsMobile: 'breadcrumbs-mobile',
    notFoundTitle: 'not-found-title',
    localeSwitcher: 'locale-switcher',
    localeOption: (code: string) => `locale-option-${code}`,
    themeToggle: 'theme-toggle',
    themeOption: (mode: 'system' | 'light' | 'dark') => `theme-${mode}`,
    instituteSwitcher: 'institute-switcher',
    instituteSwitcherMenu: 'institute-switcher-menu',
    // User menu (topbar avatar dropdown)
    userMenuTrigger: 'user-menu-trigger',
    userMenuProfile: 'user-menu-profile',
    userMenuLogout: 'user-menu-logout',
    // Sidebar (search, filter, nav group/pin toggles, mobile drawer footer)
    sidebarSearch: 'sidebar-search',
    sidebarFilterInput: 'sidebar-filter-input',
    navPinToggle: (href: string) => `nav-pin-toggle-${href}`,
    navGroupToggle: (title: string) => `nav-group-toggle-${title}`,
    navPinnedSection: 'nav-pinned-section',
    navRecentsSection: 'nav-recents-section',
    drawerFooter: 'drawer-footer',
    drawerFooterInstitute: 'drawer-footer-institute',
    drawerClose: 'drawer-close',
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
    // Column header testids consumed by e2e (rendered by DataTable)
    col: (name: 'name' | 'code' | 'type' | 'status' | 'reseller' | 'group') =>
      `institutes-table-col-${name}`,

    // Filters
    filterReseller: 'filter-reseller-combobox',
    filterGroup: 'filter-group-combobox',

    // Create form
    newTitle: 'admin-institute-new-title',
    newDraftDiscardBtn: 'admin-institute-new-draft-discard-btn',
    newDraftRestoreBtn: 'admin-institute-new-draft-restore-btn',
    formSectionBasic: 'institute-form-section-basic',
    formSectionBoard: 'institute-form-section-board',
    formSectionOwnership: 'institute-form-section-ownership',
    formSectionContact: 'institute-form-section-contact',
    formSectionAddress: 'institute-form-section-address',
    formSectionAdvanced: 'institute-form-section-advanced',
    newCodeInfo: 'admin-institute-new-code-info',
    newCodeInput: 'admin-institute-new-code-input',
    newTypeInfo: 'admin-institute-new-type-info',
    newFrameworkInfo: 'admin-institute-new-framework-info',
    newFrameworkSelect: 'admin-institute-new-framework-select',
    newBoardInfo: 'admin-institute-new-board-info',
    newBoardCombobox: 'admin-institute-new-board-combobox',
    newDepartment: (dept: string) => `admin-institute-new-department-${dept}`,
    newResellerInfo: 'admin-institute-new-reseller-info',
    newResellerCombobox: 'admin-institute-new-reseller-combobox',
    newGroupInfo: 'admin-institute-new-group-info',
    newGroupCombobox: 'admin-institute-new-group-combobox',
    newPhone: (index: number) => `admin-institute-new-phone-${index}-input`,
    newRemovePhone: (index: number) => `admin-institute-new-remove-phone-${index}-btn`,
    newAddPhoneBtn: 'admin-institute-new-add-phone-btn',
    newEmail: (index: number) => `admin-institute-new-email-${index}-input`,
    newRemoveEmail: (index: number) => `admin-institute-new-remove-email-${index}-btn`,
    newAddEmailBtn: 'admin-institute-new-add-email-btn',
    newPostalCodeInput: 'admin-institute-new-postal-code-input',
    newStateCombobox: 'admin-institute-new-state-combobox',
    newAddressPreview: 'admin-institute-new-address-preview',
    newIsDemoSwitch: 'admin-institute-new-is-demo-switch',
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
    tab: (name: 'overview' | 'setup' | 'academic' | 'users' | 'config' | 'branding' | 'audit') =>
      `institute-detail-tab-${name}`,
    actionApprove: 'action-approve',
    actionReassignReseller: 'action-reassign-reseller',
    actionAssignGroup: 'action-assign-group',
    actionRemoveGroup: 'action-remove-group',
    actionRestore: 'action-restore',
    reassignResellerCombobox: 'reassign-reseller-combobox',
    assignGroupCombobox: 'assign-group-combobox',

    // Sub-components
    academicTreeTab: 'academic-tree-tab',
    auditTab: 'audit-tab',
    usersTab: 'users-tab',
    brandingDisplay: 'branding-display',
    configDisplay: 'config-display',
    setupProgressPanel: 'setup-progress-panel',
    setupRetryButton: 'setup-retry-button',
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
    page: 'institute-groups-page',
    description: 'institute-groups-description',
    newBtn: 'institute-groups-new-btn',
    table: 'institute-groups-table',
    empty: 'institute-groups-empty',
    // Create form
    clearDraftBtn: 'institute-group-clear-draft-btn',
    formSectionBasic: 'institute-group-form-section-basic',
    formSectionRegistration: 'institute-group-form-section-registration',
    formSectionContact: 'institute-group-form-section-contact',
    formSectionAddress: 'institute-group-form-section-address',
    codeInfo: 'institute-group-code-info',
    typeInfo: 'institute-group-type-info',
    registrationNumberInfo: 'institute-group-registration-number-info',
    registrationStateInfo: 'institute-group-registration-state-info',
  },

  // ── Admin: audit logs (referenced by navigation e2e) ───────────────────
  adminAuditLogs: {
    title: 'audit-logs-title',
    page: 'audit-logs-page',
    description: 'audit-logs-description',
    tabAll: 'audit-logs-tab-all',
    tabImpersonation: 'audit-logs-tab-impersonation',
    tabReseller: 'audit-logs-tab-reseller',
    table: 'audit-logs-table',
  },

  // ── Admin: attendance ─────────────────────────────────────────────────
  adminAttendance: {
    page: 'admin-attendance-page',
    title: 'admin-attendance-title',
    dateInput: 'admin-attendance-date-input',
    todayButton: 'admin-attendance-today-button',
    table: 'admin-attendance-table',
    empty: 'admin-attendance-empty',
    denied: 'admin-attendance-denied',
    row: (id: string) => `admin-attendance-row-${id}`,
  },

  // ── Admin: resellers list ──────────────────────────────────────────────
  adminResellers: {
    page: 'resellers-page',
    title: 'resellers-title',
    description: 'resellers-description',
    createBtn: 'create-reseller-btn',
    table: 'resellers-table',
    emptyFilteredTitle: 'resellers-empty-filtered-title',
    emptyTitle: 'resellers-empty-title',
    createEmptyBtn: 'create-reseller-empty-btn',
    // Filters
    searchInput: 'reseller-search-input',
    statusFilter: 'reseller-status-filter',
    tierFilter: 'reseller-tier-filter',
    clearFilters: 'reseller-clear-filters',
  },

  // ── Admin: reseller detail ─────────────────────────────────────────────
  adminResellerDetail: {
    page: 'reseller-detail-page',
    loading: 'reseller-detail-loading',
    notFound: 'reseller-not-found',
    title: 'reseller-detail-title',
    statusBadge: 'reseller-status-badge',
    tierBadge: 'reseller-tier-badge',
    systemBadge: 'reseller-system-badge',
    systemNotice: 'reseller-system-notice',
    actions: 'reseller-actions',
    actionEditBtn: 'action-edit-btn',
    actionChangeTierBtn: 'action-change-tier-btn',
    actionSuspendBtn: 'action-suspend-btn',
    actionUnsuspendBtn: 'action-unsuspend-btn',
    actionDeleteBtn: 'action-delete-btn',
    tab: (name: 'overview' | 'institutes' | 'team' | 'activity' | 'billing') => `tab-${name}`,
    tabContent: (name: 'overview' | 'institutes' | 'team' | 'activity' | 'billing') =>
      `tab-content-${name}`,
    detailName: 'detail-name',
    detailSlug: 'detail-slug',
    detailTier: 'detail-tier',
    detailStatus: 'detail-status',
    detailDomain: 'detail-domain',
    detailSuspendedAt: 'detail-suspended-at',
    detailInstituteCount: 'detail-institute-count',
    detailTeamSize: 'detail-team-size',
    detailCreatedAt: 'detail-created-at',
    detailUpdatedAt: 'detail-updated-at',
    detailBranding: 'detail-branding',
    detailLogoUrl: 'detail-logo-url',
    detailFaviconUrl: 'detail-favicon-url',
    detailPrimaryColor: 'detail-primary-color',
    detailSecondaryColor: 'detail-secondary-color',
    // Edit dialog
    editDialogTitle: 'edit-reseller-dialog-title',
    editForm: 'edit-reseller-form',
    editCancelBtn: 'edit-cancel-btn',
    // Change tier dialog
    changeTierDialogTitle: 'change-tier-dialog-title',
    changeTierSelect: 'change-tier-select',
    changeTierCancelBtn: 'change-tier-cancel-btn',
    changeTierConfirmBtn: 'change-tier-confirm-btn',
    tierOption: (tier: string) => `tier-option-${tier}`,
    // Suspend dialog
    suspendDialogTitle: 'suspend-dialog-title',
    suspendReasonInput: 'suspend-reason-input',
    suspendCancelBtn: 'suspend-cancel-btn',
    suspendConfirmBtn: 'suspend-confirm-btn',
    // Unsuspend dialog
    unsuspendDialogTitle: 'unsuspend-dialog-title',
    unsuspendCancelBtn: 'unsuspend-cancel-btn',
    unsuspendConfirmBtn: 'unsuspend-confirm-btn',
    // Delete dialog
    deleteDialogTitle: 'delete-dialog-title',
    deleteGracePeriodNote: 'delete-grace-period-note',
    deleteCancelBtn: 'delete-cancel-btn',
    deleteConfirmBtn: 'delete-confirm-btn',
  },

  // ── Admin: create reseller ─────────────────────────────────────────────
  adminResellerCreate: {
    page: 'new-reseller-page',
    title: 'new-reseller-title',
    backBtn: 'back-to-resellers-btn',
    form: 'create-reseller-form',
    cancelBtn: 'cancel-create-reseller-btn',
  },

  // ── Auth: login pages (shared across scopes) ───────────────────────────
  auth: {
    loginCard: 'login-card',
    loginTitle: 'login-title',
    loginDescription: 'login-description',
  },

  // ── Admin: account page ────────────────────────────────────────────────
  adminAccount: {
    page: 'account-page',
    title: 'account-title',
    description: 'account-description',
    profileFieldset: 'account-profile-fieldset',
    emailValue: 'account-email-value',
    emailRevealBtn: 'account-email-reveal-btn',
    emailCopyBtn: 'account-email-copy-btn',
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
    detailTab: (
      name:
        | 'profile'
        | 'academics'
        | 'guardians'
        | 'documents'
        | 'tc-history'
        | 'audit'
        | 'attendance',
    ) => `students-detail-tab-${name}`,
    detailFirstNameEn: 'students-detail-first-name-en',
    detailSocialCategory: 'students-detail-social-category',
    detailSaveBtn: 'students-detail-save-btn',
    detailGuardiansEmpty: 'students-detail-guardians-empty',
    detailDocumentsEmpty: 'students-detail-documents-empty',
    detailTcEmpty: 'students-detail-tc-empty',
    detailAuditEmpty: 'students-detail-audit-empty',
    detailAcademicsEmpty: 'students-detail-academics-empty',
    detailTitle: 'students-detail-title',
    detailDraftDiscardBtn: 'students-detail-draft-discard-btn',
    detailDraftRestoreBtn: 'students-detail-draft-restore-btn',
    detailResetBtn: 'students-detail-reset-btn',
    detailUploadDocCancelBtn: 'students-detail-upload-doc-cancel-btn',
    detailLinkGuardianBtn: 'student-detail-link-guardian-btn',
    detailLinkGuardianDialog: 'student-detail-link-guardian-dialog',
    detailLinkGuardianPickerTrigger: 'student-detail-link-guardian-picker-trigger',
    detailLinkGuardianPrimaryWarning: 'student-detail-link-guardian-primary-warning',
    detailLinkGuardianRelationshipSelect: 'student-detail-link-guardian-relationship-select',
    detailLinkGuardianSubmit: 'student-detail-link-guardian-submit',
    // Student attendance sub-tab
    attendanceStartDateInput: 'student-attendance-start-date-input',
    attendanceEndDateInput: 'student-attendance-end-date-input',
    attendanceSummary: 'student-attendance-summary',
    attendanceTable: 'student-attendance-table',
    attendanceViewFullLink: 'student-attendance-view-full-link',
    // New student page
    newTitle: 'students-new-title',
    newBackBtn: 'students-new-back-btn',
    newCancelBtn: 'students-new-cancel-btn',
    newSocialCategoryInfo: 'students-new-social-category-info',
    newAcademicYearInfo: 'students-new-academic-year-info',
    newAdmissionTypeInfo: 'students-new-admission-type-info',
  },

  // ── Institute: settings → roles (primary nav per role) ─────────────────
  instituteRoles: {
    forbidden: 'role-nav-forbidden',
    error: 'role-nav-error',
    empty: 'role-nav-empty',
    row: (id: string) => `role-row-${id}`,
    customize: (id: string) => `role-customize-${id}`,
    // Customize nav sheet
    customizeSheet: 'customize-sheet',
    customizeSelectedCount: 'customize-selected-count',
    rolePreviewChips: 'role-preview-chips',
    roleResetDefault: 'role-reset-default',
    customizeCancel: 'customize-cancel',
    customizeSave: 'customize-save',
  },

  // ── Institute: academic years ──────────────────────────────────────────
  instituteAcademicYears: {
    title: 'academic-years-title',
    grid: 'academic-years-grid',
    newBtn: 'academic-years-new-btn',
    academicYearLabel: 'academic-year-label',
    // Create dialog
    createDialog: 'academic-years-create-dialog',
    createLabelInfo: 'academic-years-create-label-info',
    createTermStructureInfo: 'academic-years-create-term-structure-info',
    // Edit sheet
    editBtn: 'academic-years-edit-btn',
    editSheet: 'academic-years-edit-sheet',
    editLabelInput: 'academic-years-edit-label-input',
    editLabelInfo: 'academic-years-edit-label-info',
    editLabelError: 'academic-years-edit-label-error',
    editStartDateInput: 'academic-years-edit-start-date-input',
    editStartDateError: 'academic-years-edit-start-date-error',
    editEndDateInput: 'academic-years-edit-end-date-input',
    editEndDateError: 'academic-years-edit-end-date-error',
    editTermStructureInfo: 'academic-years-edit-term-structure-info',
    editAddTermBtn: 'academic-years-edit-add-term-btn',
    editSaveBtn: 'academic-years-edit-save-btn',
    editCancelBtn: 'academic-years-edit-cancel-btn',
    editDiscardDraftBtn: 'academic-years-edit-discard-draft-btn',
  },

  // ── Institute: academics (standards/sections/subjects) ────────────────
  instituteAcademics: {
    title: 'academics-title',
    table: 'academics-table',
    newBtn: 'academics-new-btn',
    viewToggle: 'academics-view-toggle',
    tabDepartment: 'academics-tab-department',
    tabFlat: 'academics-tab-flat',
    // Standard detail page
    standardDetailTitle: 'academics-standard-detail-title',
    standardBackLink: 'academics-standard-back-link',
    standardEditCancelBtn: 'academics-standard-edit-cancel-btn',
    standardDeleteCancelBtn: 'academics-standard-delete-cancel-btn',
    standardDeleteConfirmBtn: 'academics-standard-delete-confirm-btn',
    standardCreateCancelBtn: 'academics-standard-create-cancel-btn',
    standardSectionsTab: 'academics-standard-sections-tab',
    standardSubjectsTab: 'academics-standard-subjects-tab',
    // Sections
    sectionNewBtn: 'academics-section-new-btn',
    sectionsTable: 'academics-sections-table',
    sectionCreateCancelBtn: 'academics-section-create-cancel-btn',
    // Subjects
    subjectNewBtn: 'academics-subject-new-btn',
    subjectsTable: 'academics-subjects-table',
    subjectImportBtn: 'academics-subject-import-btn',
    subjectCreateCancelBtn: 'academics-subject-create-cancel-btn',
  },

  // ── Institute: admission → applications ───────────────────────────────
  instituteAdmissionApplications: {
    title: 'applications-title',
    total: 'applications-total',
    table: 'applications-table',
    statusFilter: 'applications-status-filter',
    standardFilter: 'applications-standard-filter',
    rteFilter: 'applications-rte-filter',
    clearFiltersBtn: 'applications-clear-filters-btn',
    emptyNoData: 'applications-empty-no-data',
    emptyNoMatch: 'applications-empty-no-match',
    // Approve dialog
    approveDialog: 'approve-application-dialog',
    approveCancelBtn: 'approve-cancel-btn',
    approveConfirmBtn: 'approve-confirm-btn',
    // Reject dialog
    rejectDialog: 'reject-application-dialog',
    rejectCancelBtn: 'reject-cancel-btn',
    rejectConfirmBtn: 'reject-confirm-btn',
    rejectReasonInput: 'reject-reason-input',
    // Status change dialog
    statusChangeDialog: 'status-change-dialog',
    statusChangeSelect: 'status-change-select',
    statusChangeCancelBtn: 'status-change-cancel-btn',
    statusChangeSubmitBtn: 'status-change-submit-btn',
  },

  // ── Institute: admission → enquiries ──────────────────────────────────
  instituteAdmissionEnquiries: {
    title: 'enquiries-title',
    total: 'enquiries-total',
    table: 'enquiries-table',
    kanban: 'enquiries-kanban',
    newBtn: 'enquiries-new-btn',
    searchInput: 'enquiries-search-input',
    statusFilter: 'enquiries-status-filter',
    sourceFilter: 'enquiries-source-filter',
    classFilter: 'enquiries-class-filter',
    followupFrom: 'enquiries-followup-from',
    followupTo: 'enquiries-followup-to',
    clearFiltersBtn: 'enquiries-clear-filters-btn',
    emptyNoData: 'enquiries-empty-no-data',
    emptyNoMatch: 'enquiries-empty-no-match',
    viewKanbanBtn: 'enquiries-view-kanban-btn',
    viewTableBtn: 'enquiries-view-table-btn',
    // Kanban
    kanbanCard: (id: string) => `enquiry-card-${id}`,
    kanbanColumn: (status: string) => `kanban-column-${status}`,
    // Form sheet
    formTitle: 'enquiry-form-title',
    form: 'enquiry-form',
    formCancelBtn: 'enquiry-form-cancel-btn',
    sourceInfo: 'enquiry-source-info',
    followupInfo: 'enquiry-followup-info',
    // Convert dialog
    convertDialog: 'convert-enquiry-dialog',
    convertCancelBtn: 'convert-cancel-btn',
    convertSubmitBtn: 'convert-submit-btn',
    convertStandardSelect: 'convert-standard-select',
    convertYearSelect: 'convert-year-select',
    convertYearInfo: 'convert-year-info',
  },

  // ── Institute: admission → statistics ─────────────────────────────────
  instituteAdmissionStatistics: {
    title: 'statistics-title',
    loading: 'statistics-loading',
    empty: 'statistics-empty',
    funnelChart: 'funnel-chart',
    sourcePieChart: 'source-pie-chart',
    sourceConversionList: 'source-conversion-list',
  },

  // ── Institute: attendance ──────────────────────────────────────────────
  instituteAttendance: {
    title: 'attendance-title',
    standardSelect: 'attendance-standard-select',
    sectionSelect: 'attendance-section-select',
    dateInput: 'attendance-date-input',
    periodSelect: 'attendance-period-select',
    openSessionBtn: 'attendance-open-session-btn',
    sessionSummary: 'attendance-session-summary',
    rosterList: 'attendance-roster-list',
    rosterTable: 'attendance-roster-table',
    markAllPresentBtn: 'attendance-mark-all-present-btn',
    overrideBtn: 'attendance-override-btn',
    // History page
    historyTitle: 'attendance-history-title',
    historyBackLink: 'attendance-history-back-link',
    historyStartDateInput: 'history-start-date-input',
    historyEndDateInput: 'history-end-date-input',
    historyStudentPicker: 'history-student-picker',
    historyStudentSearchInput: 'history-student-search-input',
    historySummary: 'history-summary',
    historyTable: 'history-table',
    absentDatesMoreBtn: 'absent-dates-more-btn',
    // Reports page
    reportsTitle: 'attendance-reports-title',
    reportsBackLink: 'attendance-reports-back-link',
    reportsLink: 'attendance-reports-link',
    reportsTabs: 'attendance-reports-tabs',
    reportsTabDaily: 'attendance-reports-tab-daily',
    reportsTabAbsentees: 'attendance-reports-tab-absentees',
    // Daily report
    breakdownDateInput: 'breakdown-date-input',
    breakdownStandardSelect: 'breakdown-standard-select',
    breakdownTable: 'breakdown-table',
    breakdownMoreAbsenteesBtn: 'breakdown-more-absentees-btn',
    dailyExportCsvBtn: 'daily-export-csv-btn',
    // Absentees report
    absenteesStartDateInput: 'absentees-start-date-input',
    absenteesEndDateInput: 'absentees-end-date-input',
    absenteesStandardSelect: 'absentees-standard-select',
    absenteesSectionSelect: 'absentees-section-select',
    absenteesSectionHint: 'absentees-section-hint',
    absenteesTable: 'absentees-table',
    absenteesExportCsvBtn: 'absentees-export-csv-btn',
  },

  // ── Institute: certificates → TC ──────────────────────────────────────
  instituteCertificatesTc: {
    title: 'tc-title',
    table: 'tc-table',
    // Request dialog
    requestAcademicYearInfo: 'tc-request-academic-year-info',
    requestReasonInfo: 'tc-request-reason-info',
    rejectReasonInfo: 'tc-reject-reason-info',
    duplicateReasonInfo: 'tc-duplicate-reason-info',
  },

  // ── Institute: certificates → other ───────────────────────────────────
  instituteCertificatesOther: {
    title: 'other-certs-title',
    purposeInfo: 'cert-other-purpose-info',
    templateInfo: 'cert-other-template-info',
  },

  // ── Institute: groups ─────────────────────────────────────────────────
  instituteGroups: {
    // Detail page
    detailTitle: 'groups-detail-title',
    detailBackBtn: 'groups-detail-back-btn',
    detailTypeBadge: 'groups-detail-type-badge',
    detailMembershipBadge: 'groups-detail-membership-badge',
    detailTabMembers: 'groups-detail-tab-members',
    detailTabRules: 'groups-detail-tab-rules',
    detailTabAudit: 'groups-detail-tab-audit',
    detailMembersEmpty: 'groups-members-empty',
    // New page
    newTitle: 'groups-new-title',
    newBackBtn: 'groups-new-back-btn',
    newTypeInfo: 'groups-new-type-info',
    newMemberTypesInfo: 'groups-new-member-types-info',
    newMembersSearchInput: 'groups-new-members-search-input',
    newMembershipTypeInfo: 'groups-new-membership-type-info',
    newNoCandidates: 'groups-new-no-candidates',
    newNoSelection: 'groups-new-no-selection',
    newPrevBtn: 'groups-new-prev-btn',
    newNextBtn: 'groups-new-next-btn',
    newRulePreviewBtn: 'groups-new-rule-preview-btn',
  },

  // ── Institute: holiday ────────────────────────────────────────────────
  instituteHoliday: {
    title: 'holiday-title',
    addBtn: 'holiday-add-btn',
    viewToggleCalendar: 'holiday-view-toggle-calendar',
    viewToggleTable: 'holiday-view-toggle-table',
    filterType: 'holiday-filter-type',
    filterStartDate: 'holiday-filter-start-date',
    filterEndDate: 'holiday-filter-end-date',
    filterIsPublic: 'holiday-filter-is-public',
    filterIsPublicTrue: 'holiday-filter-is-public-true',
    filterIsPublicFalse: 'holiday-filter-is-public-false',
    accessDenied: 'holiday-access-denied',
    table: 'holiday-table',
    deleteDialog: 'holiday-delete-dialog',
    deleteCancelBtn: 'holiday-delete-cancel-btn',
    deleteConfirmBtn: 'holiday-delete-confirm-btn',
    // Calendar component
    calendar: 'holiday-calendar',
    calendarHeading: 'holiday-calendar-heading',
    calendarPrevBtn: 'holiday-calendar-prev-btn',
    calendarTodayBtn: 'holiday-calendar-today-btn',
    calendarNextBtn: 'holiday-calendar-next-btn',
    // Edit page
    editTitle: 'holiday-edit-title',
    editBackBtn: 'holiday-edit-back-btn',
    editCancelBtn: 'holiday-edit-cancel-btn',
    editDeleteBtn: 'holiday-edit-delete-btn',
    editAccessDenied: 'holiday-edit-access-denied',
    editDeleteDialog: 'holiday-edit-delete-dialog',
    editDeleteCancelBtn: 'holiday-edit-delete-cancel-btn',
    editDeleteConfirmBtn: 'holiday-edit-delete-confirm-btn',
    // New page
    newTitle: 'holiday-new-title',
    newBackBtn: 'holiday-new-back-btn',
    newCancelBtn: 'holiday-new-cancel-btn',
    newAccessDenied: 'holiday-new-access-denied',
  },

  // ── Institute: leave ──────────────────────────────────────────────────
  instituteLeave: {
    title: 'leave-title',
    tabs: 'leave-tabs',
    tabAll: 'leave-tab-all',
    tabPending: 'leave-tab-pending',
    table: 'leave-table',
    filterStatus: 'leave-filter-status',
    filterType: 'leave-filter-type',
    filterStartDate: 'leave-filter-start-date',
    filterEndDate: 'leave-filter-end-date',
    userPicker: 'leave-user-picker',
    userPickerInput: 'leave-user-picker-input',
    userPickerClear: 'leave-user-picker-clear',
    accessDenied: 'leave-access-denied',
    applyLink: 'leave-apply-link',
    // Apply page
    applyTitle: 'leave-apply-title',
    applyBackBtn: 'leave-apply-back-btn',
    applyCancelBtn: 'leave-apply-cancel-btn',
    applyAccessDenied: 'leave-apply-access-denied',
    applyUserPicker: 'leave-apply-user-picker',
    applyUserPickerInput: 'leave-apply-user-picker-input',
    // Detail page
    detailTitle: 'leave-detail-title',
    detailCard: 'leave-detail-card',
    detailStatus: 'leave-detail-status',
    detailType: 'leave-detail-type',
    detailFileUrls: 'leave-detail-file-urls',
    detailBackBtn: 'leave-detail-back-btn',
    detailApproveBtn: 'leave-detail-approve-btn',
    detailRejectBtn: 'leave-detail-reject-btn',
    detailCancelBtn: 'leave-detail-cancel-btn',
    detailAccessDenied: 'leave-detail-access-denied',
  },

  // ── Institute: people → guardians ─────────────────────────────────────
  instituteGuardians: {
    title: 'guardians-title',
    searchInput: 'guardians-search-input',
    filteredEmpty: 'guardians-filtered-empty',
    // Detail page
    detailTitle: 'guardian-detail-title',
    detailNotFoundTitle: 'guardian-detail-not-found-title',
    detailTabProfile: 'guardian-detail-tab-profile',
    detailTabChildren: 'guardian-detail-tab-children',
    detailTabAudit: 'guardian-detail-tab-audit',
    detailLinkStudentBtn: 'guardian-detail-link-student-btn',
    detailLinkStudentDialog: 'guardian-detail-link-student-dialog',
    detailLinkStudentEmpty: 'guardian-detail-link-student-empty',
    detailLinkStudentPickerTrigger: 'guardian-detail-link-student-picker-trigger',
    detailLinkStudentPrimaryWarning: 'guardian-detail-link-student-primary-warning',
    detailLinkStudentRelationshipSelect: 'guardian-detail-link-student-relationship-select',
    detailLinkStudentSubmit: 'guardian-detail-link-student-submit',
    // New page
    newTitle: 'guardian-new-title',
    newBackBtn: 'guardian-new-back-btn',
    newEducationLevelInfo: 'guardian-new-education-level-info',
    newDraftBanner: 'guardian-new-draft-banner',
  },

  // ── Institute: people → staff ──────────────────────────────────────────
  instituteStaff: {
    title: 'staff-title',
    table: 'staff-table',
    search: 'staff-search',
    emptyState: 'staff-empty-state',
    newBtn: 'staff-new-btn',
    // Detail page
    detailTitle: 'staff-detail-title',
    detailTabProfile: 'staff-detail-tab-profile',
    detailTabQualifications: 'staff-detail-tab-qualifications',
    detailTabSections: 'staff-detail-tab-sections',
    detailTabAudit: 'staff-detail-tab-audit',
    detailDraftDiscardBtn: 'staff-detail-draft-discard-btn',
    detailDraftRestoreBtn: 'staff-detail-draft-restore-btn',
    detailAddQualificationBtn: 'staff-detail-add-qualification-btn',
    qualificationDialog: 'staff-qualification-dialog',
    qualificationCancelBtn: 'staff-qualification-cancel-btn',
    qualificationDeleteCancelBtn: 'staff-qualification-delete-cancel-btn',
    qualificationDeleteConfirmBtn: 'staff-qualification-delete-confirm-btn',
    // New page
    newTitle: 'staff-new-title',
    newBackBtn: 'staff-new-back-btn',
    newCancelBtn: 'staff-new-cancel-btn',
    newDepartmentInfo: 'staff-new-department-info',
    newDesignationInfo: 'staff-new-designation-info',
    newEmployeeIdInfo: 'staff-new-employee-id-info',
    newEmploymentTypeInfo: 'staff-new-employment-type-info',
    newSocialCategoryInfo: 'staff-new-social-category-info',
  },

  // ── Institute: profile page ────────────────────────────────────────────
  instituteProfile: {
    title: 'profile-title',
    personalSection: 'profile-personal-section',
    editableSection: 'profile-editable-section',
    roleGuardian: 'profile-role-guardian',
    roleStaff: 'profile-role-staff',
    roleStudent: 'profile-role-student',
    passkeyManagerStub: 'passkey-manager-stub',
    passwordChangeFormStub: 'password-change-form-stub',
  },

  // ── Institute: settings → consent ─────────────────────────────────────
  instituteConsent: {
    notGuardian: 'consent-not-guardian',
    title: 'consent-title',
    privacyNotice: 'consent-privacy-notice',
    withdrawDialog: 'consent-withdraw-dialog',
    withdrawConfirm: 'consent-withdraw-confirm',
  },

  // ── Institute: settings → institute info/branding/config ──────────────
  instituteSettings: {
    // Info tab
    infoRefreshBtn: 'settings-info-refresh-btn',
    infoCodeInput: 'settings-info-code-input',
    infoIdentifiersInfo: 'institute-info-identifiers-info',
    infoAffiliationsInfo: 'institute-info-affiliations-info',
    // Branding tab
    brandingLogoInfo: 'branding-logo-info',
    brandingFaviconInfo: 'branding-favicon-info',
    brandingPrimaryColorInfo: 'branding-primary-color-info',
    brandingPrimaryColorPicker: 'branding-primary-color-picker',
    brandingSecondaryColorPicker: 'branding-secondary-color-picker',
    brandingThemeInfo: 'branding-theme-info',
    brandingCoverInfo: 'branding-cover-info',
    // Config tab
    configAttendanceTypeInfo: 'institute-config-attendance-type-info',
    configShiftsInfo: 'institute-config-shifts-info',
    configGradingSystemInfo: 'institute-config-grading-system-info',
    configOptimalStrengthInfo: 'institute-config-optimal-strength-info',
    configHardMaxInfo: 'institute-config-hard-max-info',
    configExemptionAllowedInfo: 'institute-config-exemption-allowed-info',
    // Address form
    addressLine1Input: 'settings-address-line1-input',
    addressLine1Error: 'settings-address-line1-error',
    addressLine2Input: 'settings-address-line2-input',
    addressLine3Input: 'settings-address-line3-input',
    addressCityInput: 'settings-address-city-input',
    addressCityError: 'settings-address-city-error',
    addressDistrictInput: 'settings-address-district-input',
    addressDistrictError: 'settings-address-district-error',
    addressPostalCodeInput: 'settings-address-postal-code-input',
    addressPostalCodeError: 'settings-address-postal-code-error',
    addressStateInfo: 'settings-address-state-info',
    addressStateTrigger: 'settings-address-state-trigger',
    addressStateError: 'settings-address-state-error',
    addressLatInput: 'settings-address-lat-input',
    addressLatError: 'settings-address-lat-error',
    addressLngInput: 'settings-address-lng-input',
    addressLngError: 'settings-address-lng-error',
  },

  // ── Institute: select institute ────────────────────────────────────────
  instituteSelectInstitute: {
    title: 'select-institute-title',
  },

  // ── Reseller: institutes list ──────────────────────────────────────────
  resellerInstitutes: {
    title: 'reseller-institutes-title',
    // Create form info popovers
    newCodeInfo: 'reseller-institute-new-code-info',
    newTypeInfo: 'reseller-institute-new-type-info',
    newFrameworkInfo: 'reseller-institute-new-framework-info',
    newBoardInfo: 'reseller-institute-new-board-info',
    newGroupInfo: 'reseller-institute-new-group-info',
  },

  // ── Reseller: billing → plans ──────────────────────────────────────────
  resellerBillingPlans: {
    createBtn: 'billing-create-plan-btn',
    // Form dialog
    createDialog: 'billing-create-plan-dialog',
    draftRestoreBtn: 'billing-plan-draft-restore-btn',
    draftDiscardBtn: 'billing-plan-draft-discard-btn',
    sectionBasic: 'billing-plan-section-basic',
    sectionBilling: 'billing-plan-section-billing',
    sectionLimits: 'billing-plan-section-limits',
    codeInfoEdit: 'billing-plan-code-info-edit',
    codeInfoCreate: 'billing-plan-code-info-create',
    amountInfo: 'billing-plan-amount-info',
    intervalInfo: 'billing-plan-interval-info',
    priceDisplay: 'billing-plan-price-display',
    trialDaysInfo: 'billing-plan-trial-days-info',
    limitsInfo: 'billing-plan-limits-info',
    cancelBtn: 'billing-plan-cancel-btn',
  },

  // ── Reseller: billing → gateway configs ───────────────────────────────
  resellerBillingGateway: {
    vpaInfo: 'billing-gateway-vpa-info',
    keyIdInfo: 'billing-gateway-key-id-info',
    keySecretInfo: 'billing-gateway-key-secret-info',
    webhookSecretInfo: 'billing-gateway-webhook-secret-info',
    testModeInfo: 'billing-gateway-test-mode-info',
    defaultInfo: 'billing-gateway-default-info',
  },

  // ── Reseller: billing → invoices ──────────────────────────────────────
  resellerBillingInvoices: {
    // Record payment dialog
    recordPaymentMethodInfo: 'billing-record-payment-method-info',
    recordPaymentReceiptInfo: 'billing-record-payment-receipt-info',
    recordPaymentCollectedByInfo: 'billing-record-payment-collected-by-info',
    recordPaymentCollectionDateInfo: 'billing-record-payment-collection-date-info',
    // Refund dialog
    refundAmountInfo: 'billing-refund-amount-info',
    refundReasonInfo: 'billing-refund-reason-info',
  },

  // ── Reseller: billing → subscriptions ─────────────────────────────────
  resellerBillingSubscriptions: {
    assignPlanBtn: 'billing-assign-plan-btn',
    // Assign plan dialog
    assignPlanDialog: 'billing-assign-plan-dialog',
    // Change plan dialog
    changePlanProrationInfo: 'billing-change-plan-proration-info',
    // Action dialog
    subscriptionReasonInfo: 'billing-subscription-reason-info',
  },
} as const;
