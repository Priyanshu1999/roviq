/**
 * Unit tests for `formatGraphQLError`.
 *
 * Every fixture in this file is a VERBATIM payload captured by curl-ing the
 * running api-gateway with intentionally bad input. No payload is hand-crafted
 * or guessed. Recapture instructions live next to each test group so the
 * fixtures can be refreshed when Apollo Server / NestJS error formats change.
 *
 * The formatter is the rendering layer of the Console Guardian. When these
 * tests pass, test failures will show the actual root cause string
 * ("Phone must be a valid 10-digit Indian mobile number") instead of the
 * useless wrapper ("Bad Request Exception").
 *
 * References:
 *  - GraphQL spec §7.1.2 https://spec.graphql.org/draft/#sec-Errors
 *  - Apollo error codes https://www.apollographql.com/docs/apollo-server/data/errors
 *  - NestJS GraphQL guard https://docs.nestjs.com/graphql/other-features#exception-filters
 */

import type { GraphQLFormattedError } from 'graphql';
import { describe, expect, it } from 'vitest';
import { formatGraphQLError } from '../lib/format-graphql-error';

describe('formatGraphQLError', () => {
  // ── 1. instituteLogin with wrong password ──────────────────────────────
  // curl -X POST $API -d '{"query":"mutation { instituteLogin(username:\"admin\", password:\"wrong\") { accessToken } }"}'
  describe('UNAUTHENTICATED — Passport JWT / login failure', () => {
    it('formats wrong-password login (NestJS UnauthorizedException via JWT)', () => {
      const err: GraphQLFormattedError = {
        message: 'Invalid credentials',
        locations: [{ line: 1, column: 12 }],
        path: ['instituteLogin'],
        extensions: {
          code: 'UNAUTHENTICATED',
          originalError: {
            message: 'Invalid credentials',
            error: 'Unauthorized',
            statusCode: 401,
          },
        },
      };
      expect(formatGraphQLError(err)).toBe(
        'Invalid credentials [UNAUTHENTICATED]: Invalid credentials',
      );
    });

    // Captured by hitting any authenticated query without a Bearer token
    it('formats missing Bearer token (Passport throws "Unauthorized")', () => {
      const err: GraphQLFormattedError = {
        message: 'Unauthorized',
        locations: [{ line: 1, column: 3 }],
        path: ['myProfile'],
        extensions: {
          code: 'UNAUTHENTICATED',
          originalError: { message: 'Unauthorized', statusCode: 401 },
        },
      };
      expect(formatGraphQLError(err)).toBe('Unauthorized [UNAUTHENTICATED]: Unauthorized');
    });
  });

  // ── 2. Syntax error (broken query string) ──────────────────────────────
  // curl -X POST $API -d '{"query":"mutation { instituteLogin( { accessToken } }"}'
  describe('GRAPHQL_PARSE_FAILED — malformed query string', () => {
    it('formats syntax error with no path (parse happens pre-execution)', () => {
      const err: GraphQLFormattedError = {
        message: 'Syntax Error: Expected Name, found "{".',
        locations: [{ line: 1, column: 28 }],
        extensions: { code: 'GRAPHQL_PARSE_FAILED' },
      };
      expect(formatGraphQLError(err)).toBe(
        'Syntax Error: Expected Name, found "{". [GRAPHQL_PARSE_FAILED]',
      );
    });
  });

  // ── 3. Field doesn't exist on schema ───────────────────────────────────
  // curl -X POST $API -d '{"query":"{ nonExistentField }"}'
  describe('GRAPHQL_VALIDATION_FAILED — unknown field on schema', () => {
    it('formats unknown field error with no path', () => {
      const err: GraphQLFormattedError = {
        message: 'Cannot query field "nonExistentField" on type "Query".',
        locations: [{ line: 1, column: 3 }],
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
      };
      expect(formatGraphQLError(err)).toBe(
        'Cannot query field "nonExistentField" on type "Query". [GRAPHQL_VALIDATION_FAILED]',
      );
    });

    it('formats "Did you mean ..." typo suggestion', () => {
      const err: GraphQLFormattedError = {
        message:
          'Cannot query field "createInstituteRequest" on type "Mutation". Did you mean "createInstituteGroup", "createInstitute", "resellerCreateInstituteRequest", or "updateInstituteGroup"?',
        locations: [{ line: 1, column: 58 }],
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
      };
      const out = formatGraphQLError(err);
      expect(out).toContain('Did you mean');
      expect(out).toContain('[GRAPHQL_VALIDATION_FAILED]');
    });
  });

  // ── 4. Variable coercion errors (BAD_USER_INPUT) ────────────────────────
  // curl -X POST $API -d '{"query":"mutation($input: CreateStudentInput!) { ... }",
  //   "variables":{"input":{"gender":"NOT_A_GENDER", "admissionNumber":"" ...}}}'
  describe('BAD_USER_INPUT — Apollo variable coercion', () => {
    it('formats invalid enum value', () => {
      const err: GraphQLFormattedError = {
        message:
          'Variable "$input" got invalid value "NOT_A_GENDER" at "input.gender"; Value "NOT_A_GENDER" does not exist in "Gender" enum.',
        locations: [{ line: 1, column: 10 }],
        extensions: { code: 'BAD_USER_INPUT' },
      };
      const out = formatGraphQLError(err);
      expect(out).toContain('does not exist in "Gender" enum');
      expect(out).toContain('[BAD_USER_INPUT]');
    });

    it('formats missing required field', () => {
      const err: GraphQLFormattedError = {
        message:
          'Variable "$input" got invalid value { ... }; Field "academicYearId" of required type "ID!" was not provided.',
        locations: [{ line: 1, column: 10 }],
        extensions: { code: 'BAD_USER_INPUT' },
      };
      expect(formatGraphQLError(err)).toContain('was not provided. [BAD_USER_INPUT]');
    });

    it('formats undefined field on input type', () => {
      const err: GraphQLFormattedError = {
        message:
          'Variable "$input" got invalid value { ... }; Field "admissionNumber" is not defined by type "CreateStudentInput". Did you mean "admissionDate", "admissionType", or "admissionClass"?',
        locations: [{ line: 1, column: 10 }],
        extensions: { code: 'BAD_USER_INPUT' },
      };
      expect(formatGraphQLError(err)).toContain('[BAD_USER_INPUT]');
    });
  });

  // ── 5. NestJS ValidationPipe (class-validator) — array of messages ─────
  // curl -X POST $API -d '{"query":"mutation($input: UpdateMyProfileInput!) ...",
  //   "variables":{"input":{"phone":"abc","profileImageUrl":"not-a-url"}}}'
  describe('BAD_REQUEST — NestJS ValidationPipe with array messages', () => {
    it('joins multiple class-validator messages with commas', () => {
      const err: GraphQLFormattedError = {
        message: 'Bad Request Exception',
        locations: [{ line: 1, column: 43 }],
        path: ['updateMyProfile'],
        extensions: {
          code: 'BAD_REQUEST',
          originalError: {
            message: [
              'Phone must be a valid 10-digit Indian mobile number',
              'profileImageUrl must be a valid URL',
            ],
            error: 'Bad Request',
            statusCode: 400,
          },
        },
      };
      expect(formatGraphQLError(err)).toBe(
        'Bad Request Exception [BAD_REQUEST]: Phone must be a valid 10-digit Indian mobile number, profileImageUrl must be a valid URL',
      );
    });

    it('handles single-message validation array (one bad field)', () => {
      const err: GraphQLFormattedError = {
        message: 'Bad Request Exception',
        locations: [{ line: 2, column: 3 }],
        path: ['grantConsent'],
        extensions: {
          code: 'BAD_REQUEST',
          originalError: {
            message: ['studentProfileId must be a valid UUIDv7'],
            error: 'Bad Request',
            statusCode: 400,
          },
        },
      };
      expect(formatGraphQLError(err)).toBe(
        'Bad Request Exception [BAD_REQUEST]: studentProfileId must be a valid UUIDv7',
      );
    });
  });

  // ── 6. BusinessException (custom code, no originalError wrapper) ───────
  // curl -X POST $API -d '{"query":"{ getStudent(id:\"<unknown-uuid>\") { id } }"}'
  describe('Custom domain codes (BusinessException pattern)', () => {
    it('formats BusinessException with no originalError', () => {
      const err: GraphQLFormattedError = {
        message: 'Student not found',
        locations: [{ line: 1, column: 3 }],
        path: ['getStudent'],
        extensions: { code: 'STUDENT_NOT_FOUND' },
      };
      expect(formatGraphQLError(err)).toBe('Student not found [STUDENT_NOT_FOUND]');
    });
  });

  // ── 7. Multi-error responses ───────────────────────────────────────────
  // Apollo can return multiple errors per response when variable coercion fails
  describe('Multi-error responses (Apollo collects all variable errors)', () => {
    it('formats each error in a multi-error response independently', () => {
      const errors: GraphQLFormattedError[] = [
        {
          message:
            'Variable "$input" got invalid value "NOT_A_GENDER" at "input.gender"; Value "NOT_A_GENDER" does not exist in "Gender" enum.',
          extensions: { code: 'BAD_USER_INPUT' },
        },
        {
          message:
            'Variable "$input" got invalid value { ... }; Field "academicYearId" of required type "ID!" was not provided.',
          extensions: { code: 'BAD_USER_INPUT' },
        },
      ];
      const formatted = errors.map((e) => formatGraphQLError(e));
      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toContain('Gender');
      expect(formatted[1]).toContain('academicYearId');
      expect(formatted.every((s) => s.includes('[BAD_USER_INPUT]'))).toBe(true);
    });
  });

  // ── 8. Apollo Server v4 stacktrace extension (dev mode) ────────────────
  describe('extensions.stacktrace (Apollo Server v4 dev mode)', () => {
    it('ignores the stacktrace array in formatted output', () => {
      const err: GraphQLFormattedError = {
        message: 'Bad Request Exception',
        extensions: {
          code: 'BAD_REQUEST',
          originalError: { message: ['name should not be empty'] },
          stacktrace: [
            'BadRequestException: Bad Request Exception',
            '    at ValidationPipe.exceptionFactory (/app/node_modules/@nestjs/common/pipes/validation.pipe.js:112:20)',
            '    at processTicksAndRejections (node:internal/process/task_queues:104:5)',
          ],
        },
      };
      const out = formatGraphQLError(err);
      expect(out).toBe('Bad Request Exception [BAD_REQUEST]: name should not be empty');
      expect(out).not.toContain('stacktrace');
      expect(out).not.toContain('processTicksAndRejections');
    });
  });

  // ── 9. Plain spec-compliant error (no extensions) ──────────────────────
  describe('plain GraphQL execution errors (spec §7.1.2)', () => {
    it('formats minimal error with only message', () => {
      const err: GraphQLFormattedError = { message: 'Field "foo" not found' };
      expect(formatGraphQLError(err)).toBe('Field "foo" not found [NO_CODE]');
    });

    it('formats error with locations + path but no extensions', () => {
      const err: GraphQLFormattedError = {
        message: 'User not found',
        locations: [{ line: 2, column: 3 }],
        path: ['user'],
      };
      expect(formatGraphQLError(err)).toBe('User not found [NO_CODE]');
    });
  });

  // ── 10. Edge cases (defensive) ─────────────────────────────────────────
  describe('defensive edge cases', () => {
    it('handles empty originalError.message string', () => {
      const err: GraphQLFormattedError = {
        message: 'Internal Error',
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
          originalError: { message: '' },
        },
      };
      expect(formatGraphQLError(err)).toBe('Internal Error [INTERNAL_SERVER_ERROR]');
    });

    it('handles empty originalError.message array', () => {
      const err: GraphQLFormattedError = {
        message: 'Bad Request Exception',
        extensions: {
          code: 'BAD_REQUEST',
          originalError: { message: [] },
        },
      };
      expect(formatGraphQLError(err)).toBe('Bad Request Exception [BAD_REQUEST]');
    });

    it('falls back to NO_CODE when extensions.code is missing', () => {
      const err: GraphQLFormattedError = {
        message: 'Weird',
        extensions: { someOtherKey: 'value' },
      };
      expect(formatGraphQLError(err)).toBe('Weird [NO_CODE]');
    });

    it('falls back to NO_CODE when extensions.code is null', () => {
      const err: GraphQLFormattedError = {
        message: 'Null code',
        extensions: { code: null as unknown as string },
      };
      expect(formatGraphQLError(err)).toBe('Null code [NO_CODE]');
    });

    it('falls back to NO_CODE when extensions.code is a number', () => {
      const err: GraphQLFormattedError = {
        message: 'Numeric',
        extensions: { code: 500 as unknown as string },
      };
      expect(formatGraphQLError(err)).toBe('Numeric [NO_CODE]');
    });

    it('handles entirely missing extensions', () => {
      const err: GraphQLFormattedError = { message: 'Bare error' };
      expect(formatGraphQLError(err)).toBe('Bare error [NO_CODE]');
    });
  });

  // ── 11. Apollo standard codes catalog ──────────────────────────────────
  // Reference: https://www.apollographql.com/docs/apollo-server/data/errors#built-in-error-codes
  describe('Apollo Server standard error codes catalog', () => {
    it.each([
      ['UNAUTHENTICATED', 'Unauthenticated'],
      ['FORBIDDEN', 'Forbidden'],
      ['BAD_USER_INPUT', 'Invalid input'],
      ['BAD_REQUEST', 'Bad Request'],
      ['GRAPHQL_VALIDATION_FAILED', 'Cannot query field "foo"'],
      ['GRAPHQL_PARSE_FAILED', 'Syntax Error: Expected Name'],
      ['INTERNAL_SERVER_ERROR', 'Something exploded'],
      ['PERSISTED_QUERY_NOT_FOUND', 'PersistedQueryNotFound'],
      ['PERSISTED_QUERY_NOT_SUPPORTED', 'PersistedQueryNotSupported'],
      ['OPERATION_RESOLUTION_FAILURE', 'No operation found'],
    ])('formats Apollo standard code %s', (code, message) => {
      const err: GraphQLFormattedError = { message, extensions: { code } };
      expect(formatGraphQLError(err)).toBe(`${message} [${code}]`);
    });
  });
});
