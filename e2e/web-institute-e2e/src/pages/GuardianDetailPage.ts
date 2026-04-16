/**
 * Page Object for /people/guardians/:id.
 *
 * Covers the sidebar, profile/children/audit tabs, and the profile edit
 * form. Uses role-based queries exclusively.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export class GuardianDetailPage {
  constructor(private readonly page: Page) {}

  async gotoById(id: string, locale: 'en' | 'hi' = 'en'): Promise<void> {
    await this.page.goto(`/${locale}/people/guardians/${id}`);
  }

  heading(): Locator {
    return this.page.getByRole('heading').first();
  }

  profileTab(): Locator {
    return this.page.getByTestId('guardian-detail-tab-profile');
  }

  childrenTab(): Locator {
    return this.page.getByTestId('guardian-detail-tab-children');
  }

  auditTab(): Locator {
    return this.page.getByTestId('guardian-detail-tab-audit');
  }

  occupationInput(): Locator {
    return this.page.getByTestId('guardian-detail-occupation-input');
  }

  educationLevelField(): Locator {
    return this.page.getByTestId('guardian-detail-education-level-select');
  }

  educationLevelCombobox(): Locator {
    return this.page.getByTestId('guardian-detail-education-level-select');
  }

  saveButton(): Locator {
    return this.page.getByTestId('guardian-detail-save-btn');
  }

  notFoundTitle(): Locator {
    return this.page.getByTestId('guardian-detail-not-found-title');
  }

  async clickProfileTab(): Promise<void> {
    await this.profileTab().click();
  }

  async clickChildrenTab(): Promise<void> {
    await this.childrenTab().click();
  }

  async clickAuditTab(): Promise<void> {
    await this.auditTab().click();
  }

  async expectProfileTabActive(): Promise<void> {
    await expect(this.profileTab()).toHaveAttribute('data-state', 'active');
  }

  async expectChildrenTabActive(): Promise<void> {
    await expect(this.childrenTab()).toHaveAttribute('data-state', 'active');
  }

  async expectAuditTabActive(): Promise<void> {
    await expect(this.auditTab()).toHaveAttribute('data-state', 'active');
  }

  // ── Link Student dialog (Children tab) ────────────────────────────────

  linkStudentButton(): Locator {
    return this.page.getByTestId('guardian-detail-link-student-btn');
  }

  linkStudentDialog(): Locator {
    return this.page.getByTestId('guardian-detail-link-student-dialog');
  }

  linkStudentPickerTrigger(): Locator {
    return this.page.getByTestId('guardian-detail-link-student-picker-trigger');
  }

  linkStudentOption(id: string): Locator {
    return this.page.getByTestId(`guardian-detail-link-student-option-${id}`);
  }

  linkStudentRelationshipSelect(): Locator {
    return this.page.getByTestId('guardian-detail-link-student-relationship-select');
  }

  linkStudentSubmit(): Locator {
    return this.page.getByTestId('guardian-detail-link-student-submit');
  }

  linkStudentPrimaryWarning(): Locator {
    return this.page.getByTestId('guardian-detail-link-student-primary-warning');
  }

  /**
   * Drives the full link-student happy path: opens the dialog, picks the
   * first available student, chooses a relationship, and submits. Returns
   * the chosen student's test-id so the caller can assert the refreshed
   * list contains the new link.
   */
  async linkFirstAvailableStudent(relationshipLabel: RegExp | string): Promise<void> {
    await this.linkStudentButton().click();
    await expect(this.linkStudentDialog()).toBeVisible();

    await this.linkStudentPickerTrigger().click();
    // Pick the first visible option — tests run against the seed tenant
    // which always has at least one student.
    const firstOption = this.page
      .locator('[data-testid^="guardian-detail-link-student-option-"]')
      .first();
    await expect(firstOption).toBeVisible({ timeout: 5_000 });
    await firstOption.click();

    await this.linkStudentRelationshipSelect().click();
    await this.page.getByRole('option', { name: relationshipLabel }).first().click();

    await expect(this.linkStudentSubmit()).toBeEnabled();
    await this.linkStudentSubmit().click();
  }
}
