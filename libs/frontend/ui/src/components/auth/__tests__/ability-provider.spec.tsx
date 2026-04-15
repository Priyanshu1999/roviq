import '@testing-library/jest-dom/vitest';
import { createMongoAbility, type RawRuleOf } from '@casl/ability';
import type { AppAbility } from '@roviq/common-types';
import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AbilityContext, AbilityProvider, Can, useAbility } from '../ability-provider';

// ── AbilityProvider ────────────────────────────────────────────────────────────

describe('AbilityProvider', () => {
  it('provides an ability computed from the given rules', () => {
    const { result } = renderHook(() => useAbility(), {
      wrapper: ({ children }) => (
        <AbilityProvider rules={[{ action: 'read', subject: 'Student' }]}>
          {children}
        </AbilityProvider>
      ),
    });
    expect(result.current.can('read', 'Student')).toBe(true);
    expect(result.current.can('delete', 'Student')).toBe(false);
  });

  it('provides an empty ability when rules array is empty', () => {
    const { result } = renderHook(() => useAbility(), {
      wrapper: ({ children }) => <AbilityProvider rules={[]}>{children}</AbilityProvider>,
    });
    expect(result.current.can('read', 'Student')).toBe(false);
  });
});

// ── useAbility ─────────────────────────────────────────────────────────────────

describe('useAbility', () => {
  it('returns the default empty ability when no provider wraps it', () => {
    const { result } = renderHook(() => useAbility());
    // Default ability from createMongoAbility([]) — allows nothing
    expect(result.current.can('read', 'Student')).toBe(false);
  });

  it('returns the ability injected via AbilityContext.Provider directly', () => {
    const ability = createMongoAbility<AppAbility>([{ action: 'manage', subject: 'all' }]);
    const { result } = renderHook(() => useAbility(), {
      wrapper: ({ children }) => (
        <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
      ),
    });
    expect(result.current.can('delete', 'Invoice')).toBe(true);
  });
});

// ── Can ────────────────────────────────────────────────────────────────────────

function renderWithRules(rules: RawRuleOf<AppAbility>[], ui: React.ReactNode) {
  return render(<AbilityProvider rules={rules}>{ui}</AbilityProvider>);
}

describe('Can', () => {
  it('renders children when the action is allowed', () => {
    renderWithRules(
      [{ action: 'read', subject: 'Student' }],
      <Can I="read" a="Student">
        <span>student list</span>
      </Can>,
    );
    expect(screen.getByText('student list')).toBeInTheDocument();
  });

  it('renders nothing when the action is denied', () => {
    renderWithRules(
      [],
      <Can I="read" a="Student">
        <span>student list</span>
      </Can>,
    );
    expect(screen.queryByText('student list')).not.toBeInTheDocument();
  });

  it('renders based on the most specific matching rule', () => {
    renderWithRules(
      [{ action: 'read', subject: 'Student' }],
      <>
        <Can I="read" a="Student">
          <span>can read</span>
        </Can>
        <Can I="delete" a="Student">
          <span>can delete</span>
        </Can>
      </>,
    );
    expect(screen.getByText('can read')).toBeInTheDocument();
    expect(screen.queryByText('can delete')).not.toBeInTheDocument();
  });

  it('responds to manage:all rule', () => {
    renderWithRules(
      [{ action: 'manage', subject: 'all' }],
      <Can I="delete" a="Invoice">
        <span>super admin action</span>
      </Can>,
    );
    expect(screen.getByText('super admin action')).toBeInTheDocument();
  });
});
