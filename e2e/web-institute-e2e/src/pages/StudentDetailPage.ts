/**
 * Page Object for /people/students/:id.
 *
 * Covers the 6-tab detail page with a focus on the Guardians tab's Link
 * Guardian dialog. Uses data-testid selectors that match the production
 * component so the POM stays resilient to copy changes.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export class StudentDetailPage {
  constructor(private readonly page: Page) {}

  async gotoById(id: string, locale: 'en' | 'hi' = 'en'): Promise<void> {
    await this.page.goto(`/${locale}/people/students/${id}`);
  }

  // ── Tabs ──────────────────────────────────────────────────────────────

  guardiansTab(): Locator {
    // Student detail tabs use Radix <Tabs> triggers — resolve by role.
    return this.page.getByRole('tab', { name: /guardians/i });
  }

  async clickGuardiansTab(): Promise<void> {
    await this.guardiansTab().click();
  }

  // ── Link Guardian dialog ──────────────────────────────────────────────

  linkGuardianButton(): Locator {
    return this.page.getByTestId('student-detail-link-guardian-btn');
  }

  linkGuardianDialog(): Locator {
    return this.page.getByTestId('student-detail-link-guardian-dialog');
  }

  linkGuardianPickerTrigger(): Locator {
    return this.page.getByTestId('student-detail-link-guardian-picker-trigger');
  }

  linkGuardianOption(id: string): Locator {
    return this.page.getByTestId(`student-detail-link-guardian-option-${id}`);
  }

  linkGuardianRelationshipSelect(): Locator {
    return this.page.getByTestId('student-detail-link-guardian-relationship-select');
  }

  linkGuardianSubmit(): Locator {
    return this.page.getByTestId('student-detail-link-guardian-submit');
  }

  linkGuardianPrimaryWarning(): Locator {
    return this.page.getByTestId('student-detail-link-guardian-primary-warning');
  }

  /**
   * Drives the full link-guardian happy path: opens the dialog, picks the
   * first available guardian, chooses a relationship, and submits.
   */
  async linkFirstAvailableGuardian(relationshipLabel: RegExp | string): Promise<void> {
    await this.linkGuardianButton().click();
    await expect(this.linkGuardianDialog()).toBeVisible();

    await this.linkGuardianPickerTrigger().click();
    const firstOption = this.page
      .locator('[data-testid^="student-detail-link-guardian-option-"]')
      .first();
    await expect(firstOption).toBeVisible({ timeout: 5_000 });
    await firstOption.click();

    await this.linkGuardianRelationshipSelect().click();
    await this.page.getByRole('option', { name: relationshipLabel }).first().click();

    await expect(this.linkGuardianSubmit()).toBeEnabled();
    await this.linkGuardianSubmit().click();
  }
}
