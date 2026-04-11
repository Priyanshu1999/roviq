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
    return this.page.locator('[data-test-id="guardian-detail-tab-profile"]');
  }

  childrenTab(): Locator {
    return this.page.locator('[data-test-id="guardian-detail-tab-children"]');
  }

  auditTab(): Locator {
    return this.page.locator('[data-test-id="guardian-detail-tab-audit"]');
  }

  occupationInput(): Locator {
    return this.page.locator('[data-test-id="guardian-detail-occupation-input"]');
  }

  educationLevelField(): Locator {
    return this.page.locator('[data-test-id="guardian-detail-education-level-select"]');
  }

  educationLevelCombobox(): Locator {
    return this.page.locator('[data-test-id="guardian-detail-education-level-select"]');
  }

  saveButton(): Locator {
    return this.page.locator('[data-test-id="guardian-detail-save-btn"]');
  }

  notFoundTitle(): Locator {
    return this.page.locator('[data-test-id="guardian-detail-not-found-title"]');
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
}
