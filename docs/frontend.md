# Frontend

## Apps

| App | URL | Purpose |
|-----|-----|---------|
| admin-portal | http://localhost:3001 | Platform admin — manage institutes, users, system health |
| institute-portal | http://localhost:3002 | Institute-facing — attendance, timetables, students |

Both apps share UI components from `@roviq/ui` and auth logic from `@roviq/auth`.

## Shared Libraries

### @roviq/ui
shadcn/ui components + layout shell. Key exports:
- All shadcn primitives (Button, Input, Card, Dialog, Select, etc.)
- `AdminLayout` — sidebar + topbar + command palette shell (accepts `LayoutConfig`)
- `AbilityProvider`, `Can`, `useAbility` — CASL React integration
- `RouteGuard` — page-level permission check with 403 fallback

### @roviq/auth
Client-side auth state management:
- `AuthProvider` / `useAuth()` — login, logout, refresh, switchTenant
- `ProtectedRoute` — redirects unauthenticated users to login
- `LoginForm` — react-hook-form + Zod validated form
- `TenantPicker` — organization selector for multi-tenant users
- `tokenStorage` — sessionStorage (access token) + localStorage (refresh token, user)

### @roviq/graphql
Apollo Client setup:
- HTTP + WebSocket split link
- Auth link (injects Bearer token)
- Error link (handles 401 → auth refresh, network errors)
- Cache normalization for core entities

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
};

export default function Layout({ children }) {
  return <AdminLayout config={config}>{children}</AdminLayout>;
}
```
