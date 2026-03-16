---
paths:
  - "libs/database/src/schema/**"
  - "apps/**/models/**"
  - "apps/**/dto/**"
  - "libs/frontend/**"
---

## Multi-Language (i18n) Fields

1. **DB stores full JSONB, API returns full JSONB, frontend resolves locale** — `i18nText('name')` stores `{ "en": "Science", "hi": "विज्ञान" }`. GraphQL returns the whole object (NOT a resolved string). Frontend uses `useI18nField()` hook to pick the right locale with fallback chain: current → `en` → first available. NEVER resolve locale in resolvers or services.

2. **Only human-readable, tenant-authored text gets `i18nText()`** — Institute names, section names, role names, plan names. NEVER for: emails, usernames, phone numbers, UDISE codes, UUIDs, enum values, or any language-independent field.

3. **Zod validates `en` key exists** — Use `i18nTextSchema` from `common/validators.ts`. English is required, other locales optional. Forms use `<I18nInput>` component showing one field per locale from the tenant's `supportedLocales` config.