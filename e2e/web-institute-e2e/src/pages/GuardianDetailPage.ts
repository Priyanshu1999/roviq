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
    // Fallback: sidebar renders the full name in a large label. The page
    // itself has no explicit <h1> — the breadcrumb carries the name — so
    // we target the sidebar avatar's sibling name by its Users icon group.
    return this.page.getByRole('heading').first();
  }

  profileTab(): Locator {
    return this.page.getByRole('tab', { name: /profile|प्रोफ़ाइल/i });
  }

  childrenTab(): Locator {
    return this.page.getByRole('tab', { name: /children|बच्चे/i });
  }

  auditTab(): Locator {
    return this.page.getByRole('tab', { name: /audit|लेखा|इतिहास/i });
  }

  occupationInput(): Locator {
    return this.page.getByLabel(/occupation|व्यवसाय/i);
  }

  educationLevelField(): Locator {
    // Detail page may render this as either a combobox (Select) once the
    // other agent lands the fix, or a textbox today. We resolve either by
    // accessible name.
    return this.page.getByLabel(/education level|शिक्षा स्तर/i);
  }

  educationLevelCombobox(): Locator {
    return this.page.getByRole('combobox', { name: /education level|शिक्षा स्तर/i });
  }

  saveButton(): Locator {
    return this.page.getByRole('button', { name: /^save$|save changes|सहेजें|परिवर्तन सहेजें/i });
  }

  notFoundTitle(): Locator {
    return this.page.getByText(/guardian not found|अभिभावक नहीं मिला/i);
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
