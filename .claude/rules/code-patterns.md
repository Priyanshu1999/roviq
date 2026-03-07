# Code Patterns & Style

## NestJS (Backend)

- Code-first GraphQL (no `.graphql` files) — resolvers are thin, logic in services
- DI for same-process communication, NATS for inter-service
- `ConfigService` for all config — never `process.env`
- All NestJS app modules must have `ConfigModule.forRoot({ isGlobal: true })`

### Feature Module Structure

```
src/<feature>/
├── <feature>.module.ts
├── <feature>.service.ts        # Business logic here
├── <feature>.resolver.ts       # Thin — delegates to service
├── dto/                        # GraphQL inputs
├── models/                     # GraphQL object types
└── __tests__/
```

## Frontend

- `nuqs` (URL state) → TanStack Table → Apollo Client → shadcn/ui
- Use `<Can>` from `@casl/react` for conditional rendering
- Use `@roviq/ui` components — never raw HTML elements
- All user-facing text must use `useTranslations()` from `next-intl` — never hardcode strings

## i18n

- Both Next.js apps use `[locale]` route segments (`/en/dashboard`, `/hi/dashboard`)
- Translation files are per-namespace in `messages/{locale}/` (e.g., `common.json`, `dashboard.json`)
- New features → create a new namespace JSON file and import it in `src/i18n/request.ts`
- Use `useFormatDate()` / `useFormatNumber()` from `@roviq/i18n` for locale-aware formatting
- Sidebar nav hrefs are auto-prefixed with the current locale in `@roviq/ui`'s sidebar component

## Naming Conventions

- camelCase: variables, functions
- PascalCase: classes, types, models
- snake_case: database columns/tables
- kebab-case: file names
- UPPER_SNAKE: environment variables
- `@roviq/*`: library imports

## Code Style

- **Biome** for linting and formatting — 2-space indent, single quotes, trailing commas, semicolons, 100 char line width
- TypeScript strict mode, target ES2022
- Root `.env` for shared infra vars, per-app `.env` for app-specific — new env vars must also go in `.env.example`
- Exports at top, private methods at bottom
- >2 params → use object parameter
- Only export what's used externally
