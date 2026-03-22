import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ImpersonationBadge } from '../impersonation-badge';

afterEach(cleanup);

describe('ImpersonationBadge', () => {
  it('renders badge with impersonator name', () => {
    render(<ImpersonationBadge impersonatorName="Admin User" />);
    expect(screen.getByText('Impersonated by Admin User')).toBeDefined();
  });

  it('renders with platform scope (purple classes)', () => {
    render(<ImpersonationBadge impersonatorName="Platform Admin" actorScope="platform" />);
    const badge = screen.getByText('Impersonated by Platform Admin');
    expect(badge.className).toContain('purple');
  });

  it('renders with reseller scope (blue classes)', () => {
    render(<ImpersonationBadge impersonatorName="Reseller Admin" actorScope="reseller" />);
    const badge = screen.getByText('Impersonated by Reseller Admin');
    expect(badge.className).toContain('blue');
  });

  it('renders with institute scope (muted classes)', () => {
    render(<ImpersonationBadge impersonatorName="Institute Admin" actorScope="institute" />);
    const badge = screen.getByText('Impersonated by Institute Admin');
    expect(badge.className).toContain('muted');
  });

  it('defaults to platform scope when not specified', () => {
    render(<ImpersonationBadge impersonatorName="Some Admin" />);
    const badge = screen.getByText('Impersonated by Some Admin');
    expect(badge.className).toContain('purple');
  });
});
