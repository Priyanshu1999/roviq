import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InstituteSwitcher } from '../institute-switcher';

const INST_A = {
  membershipId: 'm1',
  name: 'Sunrise Academy',
  slug: 'sunrise',
  roleName: 'Admin',
  isCurrent: true,
};

const INST_B = {
  membershipId: 'm2',
  name: 'Greenfield School',
  slug: 'greenfield',
  roleName: 'Teacher',
  isCurrent: false,
};

const INST_C = {
  membershipId: 'm3',
  name: 'City College',
  slug: 'city',
  roleName: 'Staff',
  isCurrent: false,
};

describe('InstituteSwitcher', () => {
  it('renders nothing when only one institute is present', () => {
    const { container } = render(<InstituteSwitcher institutes={[INST_A]} onSwitch={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when institutes array is empty', () => {
    const { container } = render(<InstituteSwitcher institutes={[]} onSwitch={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows current institute name in the trigger button', () => {
    render(<InstituteSwitcher institutes={[INST_A, INST_B]} onSwitch={vi.fn()} />);
    expect(screen.getByTestId('institute-switcher')).toHaveTextContent('Sunrise Academy');
  });

  it('shows "Switch Institute" in trigger when no institute is marked current', () => {
    const institutes = [
      { ...INST_A, isCurrent: false },
      { ...INST_B, isCurrent: false },
    ];
    render(<InstituteSwitcher institutes={institutes} onSwitch={vi.fn()} />);
    expect(screen.getByTestId('institute-switcher')).toHaveTextContent('Switch Institute');
  });

  it('opens dropdown and shows other institutes on trigger click', async () => {
    const user = userEvent.setup();
    render(<InstituteSwitcher institutes={[INST_A, INST_B, INST_C]} onSwitch={vi.fn()} />);

    await user.click(screen.getByTestId('institute-switcher'));

    // Only non-current institutes appear in the menu
    await waitFor(() => {
      expect(screen.getByText('Greenfield School — Teacher')).toBeInTheDocument();
      expect(screen.getByText('City College — Staff')).toBeInTheDocument();
    });

    // Current institute is not listed in the dropdown
    const menuItems = screen.getAllByRole('menuitem');
    const itemTexts = menuItems.map((el) => el.textContent);
    expect(itemTexts.every((t) => !t?.includes('Sunrise Academy'))).toBe(true);
  });

  it('calls onSwitch with the selected membershipId', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn().mockResolvedValue(undefined);
    render(<InstituteSwitcher institutes={[INST_A, INST_B]} onSwitch={onSwitch} />);

    await user.click(screen.getByTestId('institute-switcher'));
    await waitFor(() => screen.getByText('Greenfield School — Teacher'));
    await user.click(screen.getByText('Greenfield School — Teacher'));

    expect(onSwitch).toHaveBeenCalledOnce();
    expect(onSwitch).toHaveBeenCalledWith('m2');
  });

  it('disables the trigger while a switch is in progress', async () => {
    const user = userEvent.setup();
    let resolveSwitch!: () => void;
    const onSwitch = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSwitch = resolve;
        }),
    );

    render(<InstituteSwitcher institutes={[INST_A, INST_B]} onSwitch={onSwitch} />);

    await user.click(screen.getByTestId('institute-switcher'));
    await waitFor(() => screen.getByText('Greenfield School — Teacher'));
    await user.click(screen.getByText('Greenfield School — Teacher'));

    // While promise is pending the trigger should be disabled
    await waitFor(() => {
      expect(screen.getByTestId('institute-switcher')).toBeDisabled();
    });

    // After switch completes the trigger should re-enable
    resolveSwitch();
    await waitFor(() => {
      expect(screen.getByTestId('institute-switcher')).not.toBeDisabled();
    });
  });
});
