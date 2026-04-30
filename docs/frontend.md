# Frontend

## Date contract

- **Wire format**: ISO 8601 only — `YYYY-MM-DD` for dates, RFC 3339 / `YYYY-MM-DDTHH:mm:ssZ` for timestamps. Never pass display-formatted strings (`DD/MM/YYYY`, `MM/DD/YYYY`) across any boundary (form→hook, hook→API, API response).
- **Display**: Always use `useFormatDate()` from `@roviq/i18n`. Never call `date.toLocaleDateString()`, `date.toLocaleTimeString()`, or bare `format()` from `date-fns` directly in components.
- **Parsing**: Use `parseISO()` from `date-fns` when converting an ISO string to a `Date` object. Never `new Date('10/12/2022')` (ambiguous locale), never `Date.parse()`.
- **DD/MM vs MM/DD footgun**: Dates in India are DD/MM/YYYY but ISO is YYYY-MM-DD. A display string must **never** be re-parsed. Store and transmit ISO; display-only at the final render step.
- **Forms**: Every date-accepting input must be backed by a date picker (not free text). The picker's `onChange` emits ISO `YYYY-MM-DD`. Zod schemas validate with `.regex(/^\d{4}-\d{2}-\d{2}$/)` or `emptyStringToUndefined(z.string().regex(...).optional())` for optional fields.
- **Timezone**: Server-side calendar logic (attendance, reports) uses `getInstituteToday(institute)` / `getInstituteNow(institute)` from `apps/api-gateway/src/common/timezone` (API-gateway-internal). Never use bare `new Date()` for calendar-day decisions.

## Apps

| App | URL | Purpose |
|-----|-----|---------|
| admin-portal | http://localhost:4200 | Platform admin — manage institutes, users, system health |
| institute-portal | http://localhost:4300 | Institute-facing — attendance, timetables, students |

Both apps share UI components from `@roviq/ui`, auth logic from `@roviq/auth`, and i18n from `@roviq/i18n`.

## Shared Libraries

### @roviq/ui
shadcn/ui components + layout shell. Key exports:
- All shadcn primitives (Button, Input, Card, Dialog, Select, etc.)
- `AdminLayout` — sidebar + topbar + command palette shell (accepts `LayoutConfig`)
- `OrgSwitcher` — dropdown in topbar for switching between institutes (visible when user has >1 membership)
- `AbilityProvider`, `Can`, `useAbility` — CASL React integration
- `RouteGuard` — page-level permission check with 403 fallback

### @roviq/auth
Client-side auth state management:
- `AuthProvider` / `useAuth()` — login, logout, refresh, selectInstitute, switchInstitute
- `ProtectedRoute` — redirects unauthenticated users to login, or to `/select-institute` when institute selection pending
- `LoginForm` / `ReAuthForm` / `PasswordChangeForm` / `PasskeyManager` — built on the `@roviq/ui` form kit (`useAppForm` + `@tanstack/react-form`) with Zod validation. See [forms.md](forms.md) for the kit API.
- `tokenStorage` — sessionStorage (access token, platform token) + localStorage (refresh token, user, memberships)
- `needsInstituteSelection` / `memberships` — state for multi-institute picker flow

### @roviq/graphql
Apollo Client setup:
- HTTP + WebSocket split link
- Auth link (injects Bearer token)
- Error link (handles 401 → auth refresh, network errors)
- Cache normalization for core entities

### @roviq/i18n
Internationalization powered by next-intl and date-fns:
- `locales`, `defaultLocale`, `localeLabels` — locale configuration (currently `en`, `hi`)
- `routing` — next-intl routing definition with `localePrefix: 'always'`
- `Link`, `redirect`, `usePathname`, `useRouter` — locale-aware navigation helpers
- `intlMiddleware` — pre-configured middleware for locale detection and redirects
- `createRequestConfig(loadMessages)` — factory for app-specific message loading with English fallback
- `useFormatDate()` — date formatting via date-fns with locale-aware output
- `useFormatNumber()` — number/currency/percent formatting via `Intl.NumberFormat`
- `LocaleSwitcher` — language dropdown component (in `@roviq/ui`)
- RTL-ready: `rtlLocales` config array, `dir` attribute on `<html>`

**Translation file structure** (per app):
```
apps/<app>/messages/
├── en/
│   ├── common.json    # Shared labels (appName, save, cancel, etc.)
│   ├── nav.json       # Sidebar navigation labels
│   ├── auth.json      # Login/logout, user menu
│   ├── dashboard.json # Dashboard page content
│   ├── selectOrg.json # Institute picker page
│   └── locale.json    # Language names (for switcher)
└── hi/
    └── ... (same structure)
```

**Locale routing**: All routes use `[locale]` segment — e.g. `/en/dashboard`, `/hi/dashboard`. The middleware auto-detects browser locale and redirects `/` to `/<defaultLocale>/`.

## Auth Flow (Frontend)

1. User visits `/login` — sees username + password fields (no institute ID)
2. **Single institute:** auto-redirected to `/dashboard`
3. **Multi institute:** redirected to `/select-institute` — picks an institute → `/dashboard`
4. **Institute switching:** topbar dropdown calls `switchInstitute()` — swaps tokens without re-login

## Styling

- Tailwind CSS v4 with CSS-native `@theme` configuration (no `tailwind.config.js`)
- CSS custom properties for colors (HSL) — ready for tenant theming
- `tw-animate-css` for animations
- `geist` font (sans + mono)

## Layout

The admin layout is configured per-app via `LayoutConfig`:

```tsx
const config: LayoutConfig = {
  appName: 'Roviq Admin',
  navGroups: [
    {
      title: 'Overview',
      items: [
        { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { title: 'Institutes', href: '/institutes', icon: Building2 },
      ],
    },
  ],
  orgSwitcher: {
    currentOrg: { tenantId, name, logoUrl },
    otherOrgs: [...],
    onSwitch: (tenantId) => switchInstitute(tenantId),
  },
};

export default function Layout({ children }) {
  return <AdminLayout config={config}>{children}</AdminLayout>;
}
```

## Responsive layout + bottom tab bar

The shell adapts to three viewport classes — see [PVTXG] in `CLAUDE.md` for the
exact thresholds. Sidebar is always-on at desktop; below `xl` the same nav lives
in a drawer triggered from the topbar hamburger and a phone-only bottom tab bar
exposes 4 primary destinations.

| Class   | Width      | Sidebar      | Topbar          | Bottom tab bar |
| ------- | ---------- | ------------ | --------------- | -------------- |
| Phone   | `<sm`      | Drawer       | Hamburger + crumbs + bell + avatar | Visible (4 slugs + More) |
| Tablet  | `sm`–`xl`  | Drawer       | Hamburger + crumbs + bell + avatar | Visible        |
| Desktop | `xl+` (1280+) | Always-on | Crumbs + search + bell + avatar    | Hidden         |

### LayoutConfig extension

`LayoutConfig` (in `libs/frontend/ui/src/components/layout/types.ts`) gained
`navRegistry`, `bottomNav`, `searchEnabled`, and `onSearch`. Each portal owns
its own registry mapping symbolic slugs (from `@roviq/common-types` →
`NAV_SLUGS`) to the rendered `{ href, icon, label, ability? }`:

```ts
const config: LayoutConfig = {
  // ...existing fields
  navRegistry: {
    dashboard: { href: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    students:  { href: '/students',  icon: Users,           label: t('students'),
                 ability: { action: 'read', subject: 'Student' } },
    // ...
  },
  bottomNav: {
    slugs: user?.primaryNavSlugs ?? [],
    defaultSlugs: ['dashboard', 'students', 'enquiries', 'academics'],
    moreLabel: t('more'),
  },
  searchEnabled: true,
};
```

### CASL gating

Each `NavRegistryEntry` may declare an `ability: { action, subject }`. When the
bottom tab bar resolves slugs, it silently drops any whose ability the current
user lacks. The same registry is reused by the drawer, so customization that
includes a slug a viewer cannot use never produces a broken link or empty tab —
it just renders fewer items. Custom roles with no curated `slugs` fall through
to the per-portal `defaultSlugs`.

### Active-tab / sidebar highlighting

Highlighting uses **longest-prefix match** against `pathname` (after stripping
the locale prefix), not exact equality. This is required because nested routes
like `/settings/consent` would otherwise highlight both `/settings` and
`/settings/consent` simultaneously — with longest-prefix only the consent entry
wins. The same logic drives both the desktop sidebar item and the bottom tab
bar's active state.

### Drawer auto-close on navigation

The drawer subscribes to pathname changes and closes itself on every transition.
Without this, navigating from the in-drawer "Search" entry → CommandPalette →
target page leaves the drawer mounted over the new content. Same applies to
clicking any drawer link directly.

### Per-portal `defaultSlugs`

Used when a role has no curated `primaryNavSlugs` (or the resolved list is
empty after CASL filtering):

| Portal    | defaultSlugs                                       |
| --------- | -------------------------------------------------- |
| Institute | `dashboard`, `students`, `enquiries`, `academics`  |
| Reseller  | `dashboard`, `institutes`, `team`, `billing`       |
| Admin     | `dashboard`, `resellers`, `institutes`, `audit`    |

### Tenant-admin customization

Institute admins customize per-role primary nav at **`/settings/roles`** in the
institute portal (v1 — reseller and admin portals have no UI yet). The page
calls `instituteRoles` to list roles and `updateRolePrimaryNav` to persist a
new slug list (max 4, validated server-side against `NAV_SLUGS`). See the
GraphQL surface notes in [architecture.md](architecture.md#per-role-primary-nav).
