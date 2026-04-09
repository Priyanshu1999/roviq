/**
 * Page Object for /people/guardians/new.
 *
 * Wraps semantic queries so specs read as domain steps. All locators use
 * role/label queries — no CSS, no data-testid.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export type GuardianEducationLevel =
  | 'ILLITERATE'
  | 'PRIMARY'
  | 'SECONDARY'
  | 'GRADUATE'
  | 'POST_GRADUATE'
  | 'PROFESSIONAL';

export const EDUCATION_LEVEL_LABELS_EN: Record<GuardianEducationLevel, string> = {
  ILLITERATE: 'No formal education',
  PRIMARY: 'Primary (up to Class 5)',
  SECONDARY: 'Secondary (Class 10 / 12)',
  GRADUATE: 'Graduate',
  POST_GRADUATE: 'Post-graduate',
  PROFESSIONAL: 'Professional (MBBS, LLB, CA, etc.)',
};

export const EDUCATION_LEVEL_LABELS_HI: Record<GuardianEducationLevel, string> = {
  ILLITERATE: 'कोई औपचारिक शिक्षा नहीं',
  PRIMARY: 'प्राथमिक (कक्षा 5 तक)',
  SECONDARY: 'माध्यमिक (कक्षा 10 / 12)',
  GRADUATE: 'स्नातक',
  POST_GRADUATE: 'स्नातकोत्तर',
  PROFESSIONAL: 'व्यावसायिक (MBBS, LLB, CA आदि)',
};

export class GuardianCreatePage {
  constructor(private readonly page: Page) {}

  async goto(locale: 'en' | 'hi' = 'en'): Promise<void> {
    await this.page.goto(`/${locale}/people/guardians/new`);
  }

  heading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  firstNameEnglish(): Locator {
    return this.page.getByRole('textbox', { name: /first name.*english/i });
  }

  firstNameHindi(): Locator {
    return this.page.getByRole('textbox', {
      name: /first name.*hindi|प्रथम नाम.*हिन्दी|प्रथम नाम.*हिंदी/i,
    });
  }

  genderTrigger(): Locator {
    return this.page.getByRole('combobox', { name: /gender|लिंग/i });
  }

  emailInput(): Locator {
    return this.page.getByRole('textbox', { name: /email|ईमेल/i });
  }

  phoneInput(): Locator {
    return this.page.getByRole('textbox', { name: /phone|फ़ोन/i });
  }

  occupationInput(): Locator {
    return this.page.getByRole('textbox', { name: /occupation|व्यवसाय/i });
  }

  educationLevelTrigger(): Locator {
    return this.page.getByRole('combobox', { name: /education level|शिक्षा स्तर/i });
  }

  submitButton(): Locator {
    return this.page.getByRole('button', {
      name: /create guardian|^create$|अभिभावक बनाएँ/i,
    });
  }

  backButton(): Locator {
    return this.page.getByRole('button', {
      name: /back to guardians|अभिभावकों पर वापस जाएँ/i,
    });
  }

  async fillFirstNameEnglish(value: string): Promise<void> {
    await this.firstNameEnglish().fill(value);
  }

  async selectGender(optionLabel: string): Promise<void> {
    await this.genderTrigger().click();
    await this.page.getByRole('option', { name: optionLabel, exact: true }).click();
  }

  async selectEducationLevel(label: string): Promise<void> {
    await this.educationLevelTrigger().click();
    await this.page.getByRole('option', { name: label, exact: true }).click();
  }

  async openEducationLevel(): Promise<void> {
    await this.educationLevelTrigger().click();
  }

  educationLevelOption(label: string): Locator {
    return this.page.getByRole('option', { name: label, exact: true });
  }

  async submit(): Promise<void> {
    await this.submitButton().click();
  }

  async expectOnNewPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/people\/guardians\/new/);
  }

  async expectRedirectedToDetail(): Promise<void> {
    await expect(this.page).toHaveURL(/\/(institute\/)?people\/guardians\/[0-9a-f-]{36}/);
  }
}
