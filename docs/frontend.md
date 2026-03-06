# Frontend

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
- `OrgSwitcher` — dropdown in topbar for switching between organizations (visible when user has >1 membership)
- `AbilityProvider`, `Can`, `useAbility` — CASL React integration
- `RouteGuard` — page-level permission check with 403 fallback

### @roviq/auth
Client-side auth state management:
- `AuthProvider` / `useAuth()` — login, logout, refresh, selectOrganization, switchOrganization
- `ProtectedRoute` — redirects unauthenticated users to login, or to `/select-org` when org selection pending
- `LoginForm` — react-hook-form + Zod validated form (username + password only, no org ID)
- `tokenStorage` — sessionStorage (access token, platform token) + localStorage (refresh token, user, memberships)
- `needsOrgSelection` / `memberships` — state for multi-org org picker flow

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
│   ├── selectOrg.json # Org picker page
│   └── locale.json    # Language names (for switcher)
└── hi/
    └── ... (same structure)
```

**Locale routing**: All routes use `[locale]` segment — e.g. `/en/dashboard`, `/hi/dashboard`. The middleware auto-detects browser locale and redirects `/` to `/<defaultLocale>/`.

## Auth Flow (Frontend)

1. User visits `/login` — sees username + password fields (no org ID)
2. **Single org:** auto-redirected to `/dashboard`
3. **Multi org:** redirected to `/select-org` — picks an organization → `/dashboard`
4. **Org switching:** topbar dropdown calls `switchOrganization()` — swaps tokens without re-login

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
    onSwitch: (tenantId) => switchOrganization(tenantId),
  },
};

export default function Layout({ children }) {
  return <AdminLayout config={config}>{children}</AdminLayout>;
}
```
