import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ImpersonationBadge } from '../impersonation-badge';

describe('ImpersonationBadge', () => {
  it('shows impersonator name in default badge text', () => {
    render(<ImpersonationBadge impersonatorName="Asha Patel" />);
    expect(screen.getByText('Impersonated by Asha Patel')).toBeInTheDocument();
  });

  it('uses custom badge text formatter when provided', () => {
    render(
      <ImpersonationBadge impersonatorName="Asha" labels={{ badgeText: (name) => `As ${name}` }} />,
    );
    expect(screen.getByText('As Asha')).toBeInTheDocument();
  });

  // Radix renders tooltip content twice when open: once visibly and once
  // inside an sr-only `<span role="tooltip">` for screen readers. Both copies
  // contain the same text, so we use `getAllByText` and assert at least one.
  const tooltipText = (matcher: string | RegExp) => {
    const matches = screen.getAllByText(matcher);
    expect(matches.length).toBeGreaterThan(0);
  };

  it('reveals the custom tooltipText (with name + scope + user) on hover', async () => {
    render(
      <ImpersonationBadge
        impersonatorName="Asha"
        actorScope="platform"
        userName="Rajesh"
        labels={{ tooltipText: (n, s, u) => `tt:${n}|${s}|${u}` }}
      />,
    );
    await userEvent.hover(screen.getByText('Impersonated by Asha'));
    await waitFor(() => tooltipText('tt:Asha|platform admin|Rajesh'));
  });

  it('uses the supplied scope label inside the default tooltip on hover', async () => {
    render(
      <ImpersonationBadge
        impersonatorName="Asha"
        actorScope="platform"
        userName="Rajesh"
        labels={{ scopeLabels: { platform: 'प्लेटफ़ॉर्म एडमिन' } }}
      />,
    );
    await userEvent.hover(screen.getByText('Impersonated by Asha'));
    await waitFor(() => tooltipText(/प्लेटफ़ॉर्म एडमिन/));
  });

  it('omits the impersonated user phrase from the default tooltip when userName is missing', async () => {
    render(<ImpersonationBadge impersonatorName="Asha" actorScope="reseller" />);
    await userEvent.hover(screen.getByText('Impersonated by Asha'));
    await waitFor(() =>
      tooltipText('This action was performed by Asha (reseller admin) via impersonation'),
    );
  });

  it('includes the impersonated user phrase in the default tooltip when userName is supplied', async () => {
    render(<ImpersonationBadge impersonatorName="Asha" actorScope="institute" userName="Rajesh" />);
    await userEvent.hover(screen.getByText('Impersonated by Asha'));
    await waitFor(() =>
      tooltipText('This action was performed by Asha (institute admin) while impersonating Rajesh'),
    );
  });
});
