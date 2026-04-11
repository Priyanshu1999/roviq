import type { CodegenConfig } from '@graphql-codegen/cli';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const LIVE_SCHEMA = `${API_URL}/api/graphql`;
const LOCAL_SCHEMA = 'libs/frontend/graphql/src/generated/schema.graphql';

// CI has no running gateway — use the committed schema.graphql file instead
const SCHEMA_SOURCE = process.env.CI ? LOCAL_SCHEMA : LIVE_SCHEMA;

const sharedConfig = {
  dedupeFragments: true,
  enumsAsTypes: true,
  maybeValue: 'T | null',
  avoidOptionals: {
    field: true, // Output: actorName: string | null (not actorName?: ...)
    inputValue: false, // Inputs: keep optional fields optional
    object: false,
    defaultValue: false,
  },
  scalars: {
    DateTime: 'string',
    BigInt: 'string',
    JSON: 'Record<string, unknown>',
    JSONObject: 'Record<string, unknown>',
    I18nText: 'import("@roviq/i18n").I18nText',
  },
  skipTypename: false,
};

const config: CodegenConfig = {
  overwrite: true,
  schema: SCHEMA_SOURCE,
  documents: ['apps/web/src/**/*.{ts,tsx}'],

  generates: {
    // 1. Download schema for offline use / CI
    'libs/frontend/graphql/src/generated/schema.graphql': {
      plugins: ['schema-ast'],
    },

    // 2. Base types from schema (shared across all operations)
    'libs/frontend/graphql/src/generated/graphql.ts': {
      plugins: ['typescript'],
      config: sharedConfig,
    },

    // 3. Near-operation-file: generates .generated.ts next to each file with gql tags
    //    Exports TypedDocumentNode constants — useQuery(DOC) is fully typed automatically
    'apps/': {
      preset: 'near-operation-file',
      presetConfig: {
        extension: '.generated.ts',
        baseTypesPath: '~@roviq/graphql/generated',
      },
      plugins: ['typescript-operations', 'typed-document-node'],
      config: sharedConfig,
    },
  },
};

export default config;
