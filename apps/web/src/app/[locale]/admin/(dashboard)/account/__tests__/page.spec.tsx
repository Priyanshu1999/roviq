import '@testing-library/jest-dom/vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @roviq/auth — we only render the read-only profile card here, so we
// stub useAuth and replace PasskeyManager with a marker so the tests don't
// have to wire mutations.
const useAuthMock = vi.fn();
vi.mock('@roviq/auth', () => ({
  useAuth: () => useAuthMock(),
  createAuthMutations: () => ({
    myPasskeys: {},
    generatePasskeyRegistrationOptions: {},
    verifyPasskeyRegistration: {},
    removePasskey: {},
  }),
  PasskeyManager: () => <div data-testid="passkey-manager-stub" />,
  PasswordChangeForm: () => <div data-testid="password-change-form-stub" />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import accountMessages from '../../../../../../../messages/en/account.json';
import authMessages from '../../../../../../../messages/en/auth.json';
import commonMessages from '../../../../../../../messages/en/common.json';
import { renderWithProviders } from '../../../../../../__test-utils__/render-with-providers';
import AccountPage from '../page';

const messages = {
  account: accountMessages,
  auth: authMessages,
  common: commonMessages,
};

describe('AccountPage (admin)', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it('renders title, description and profile FieldSet', () => {
    useAuthMock.mockReturnValue({
      user: {
        username: 'priyanshu.admin',
        email: 'priyanshu@roviq.test',
        scope: 'platform',
      },
    });

    renderWithProviders(<AccountPage />, { messages });

    expect(screen.getByRole('heading', { name: /^account$/i })).toBeInTheDocument();
    expect(screen.getByText(/manage your account settings and security/i)).toBeInTheDocument();
    // Profile card title is a heading.
    expect(screen.getAllByText(/^profile$/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/roviq id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByText(/access scope/i)).toBeInTheDocument();
  });

  it('shows the masked email by default and reveals it on toggle', async () => {
    useAuthMock.mockReturnValue({
      user: {
        username: 'priyanshu.admin',
        email: 'priyanshu@roviq.test',
        scope: 'platform',
      },
    });

    renderWithProviders(<AccountPage />, { messages });

    // Masked: first 2 chars + *** + @domain
    expect(screen.getByText('pr***@roviq.test')).toBeInTheDocument();
    expect(screen.queryByText('priyanshu@roviq.test')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /reveal email/i });
    await userEvent.click(toggle);

    expect(screen.getByText('priyanshu@roviq.test')).toBeInTheDocument();
    // Toggle button now offers to hide
    expect(screen.getByRole('button', { name: /hide email/i })).toBeInTheDocument();
  });

  it('renders the platform scope badge label for platform users', () => {
    useAuthMock.mockReturnValue({
      user: { username: 'admin', email: 'a@b.test', scope: 'platform' },
    });
    renderWithProviders(<AccountPage />, { messages });
    // Scope badge text is the only place in this page that says "Platform admin".
    // (Description copy talks about "platform administrator" but not "platform admin".)
    expect(screen.getByText(/^platform admin$/i)).toBeInTheDocument();
  });

  it('renders a loading placeholder when user is not yet loaded', () => {
    useAuthMock.mockReturnValue({ user: undefined });
    renderWithProviders(<AccountPage />, { messages });
    // common.loading translation appears in the username and email outputs.
    expect(screen.getAllByText('Loading...').length).toBeGreaterThanOrEqual(2);
  });

  it('mounts the PasskeyManager (stubbed) inside the profile area', () => {
    useAuthMock.mockReturnValue({
      user: { username: 'admin', email: 'a@b.test', scope: 'platform' },
    });
    renderWithProviders(<AccountPage />, { messages });
    expect(screen.getByTestId('passkey-manager-stub')).toBeInTheDocument();
  });
});
