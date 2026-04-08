import '@testing-library/jest-dom/vitest';
import { createMongoAbility } from '@casl/ability';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AbilityContext } from '../ability-provider';
import { RouteGuard } from '../route-guard';

function renderWithAbility(rules: Parameters<typeof createMongoAbility>[0], ui: React.ReactNode) {
  const ability = createMongoAbility(rules);
  return render(<AbilityContext.Provider value={ability}>{ui}</AbilityContext.Provider>);
}

describe('RouteGuard', () => {
  it('renders children when ability allows the action', () => {
    renderWithAbility(
      [{ action: 'read', subject: 'Student' }],
      <RouteGuard action="read" subject="Student">
        <div>secret content</div>
      </RouteGuard>,
    );
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });

  it('renders default 403 when ability denies', () => {
    renderWithAbility(
      [],
      <RouteGuard action="read" subject="Student">
        <div>secret content</div>
      </RouteGuard>,
    );
    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders custom fallback when provided and denied', () => {
    renderWithAbility(
      [],
      <RouteGuard action="read" subject="Student" fallback={<div>nope</div>}>
        <div>secret content</div>
      </RouteGuard>,
    );
    expect(screen.getByText('nope')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('respects subject-specific rules', () => {
    renderWithAbility(
      [{ action: 'read', subject: 'Student' }],
      <RouteGuard action="read" subject="Invoice">
        <div>billing</div>
      </RouteGuard>,
    );
    expect(screen.queryByText('billing')).not.toBeInTheDocument();
    expect(screen.getByText('403')).toBeInTheDocument();
  });
});
