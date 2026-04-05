# Institute Portal -- User Guide

This guide is for institute administrators, teachers, clerks, and staff who use the Roviq Institute Portal to manage their institute's day-to-day operations.

---

## Table of Contents

1. [Logging In](#logging-in)
2. [Selecting Your Institute](#selecting-your-institute)
3. [Dashboard](#dashboard)
4. [Academics](#academics)
   - [Academic Years](#academic-years)
   - [Standards](#standards)
5. [Billing](#billing)
   - [Subscription](#subscription)
   - [Invoices](#invoices)
   - [Payments](#payments)
6. [Settings](#settings)
   - [Institute Settings](#institute-settings)
   - [Notification Preferences](#notification-preferences)
   - [Sessions](#sessions)
7. [Audit Logs](#audit-logs)
8. [Account (Passkey Manager)](#account-passkey-manager)
9. [Sidebar Navigation Reference](#sidebar-navigation-reference)

---

## Logging In

1. Open the Institute Portal in your browser.
2. On the login page you will see two fields: **Roviq ID** and **Password**.
3. Enter the Roviq ID and password provided to you by your institute administrator.
4. Click **Log In**.

**Passkey login (optional):** If you have set up a passkey on your device, you can use it instead of typing your password. Click the **Log in with Passkey** option and follow your browser's prompt (fingerprint, face scan, or security key).

> **Tip:** If you have forgotten your password, contact your institute administrator to reset it.

---

## Selecting Your Institute

If your Roviq ID is associated with more than one institute (for example, a teacher who works at two institutes), you will see an **Institute Selection** page after logging in.

Each institute is shown as a card with:

- The institute's **name**
- The institute's **avatar/logo**
- Your **role** at that institute (e.g. Admin, Teacher, Clerk)

Click the card for the institute you want to work with. You will be taken to the dashboard for that institute.

> **Note:** You can switch institutes later from the header area without logging out.

---

## Dashboard

After logging in (and selecting your institute, if applicable), you arrive at the **Dashboard**.

The dashboard shows a welcome message and highlights areas that need your attention with **Get Started** cards:

| Card | What It Means | What to Do |
|------|---------------|------------|
| **No Students Enrolled** | No students have been added yet | Go to Users and add students |
| **No Teachers Assigned** | No teachers have been added yet | Go to Users and add teachers |
| **No Standards Configured** | Grade levels have not been set up | Go to Standards and create them |

Below the cards you will find **Quick Links** for common tasks:

- **Standards** -- set up grade levels
- **Subjects** -- manage subjects
- **Users** -- manage students, teachers, and staff
- **Settings** -- configure your institute

---

## Academics

### Academic Years

An academic year represents a full session (for example, 2025--26). You must have at least one active academic year before you can manage standards, sections, or subjects.

#### Viewing Academic Years

1. In the sidebar, click **Academic Years** (under the Academic group).
2. You will see a list of all academic years with their status (Active, Upcoming, Archived).

#### Creating a New Academic Year

1. On the Academic Years page, click the **Create** button.
2. Fill in the required details:
   - **Name** -- for example, "2025--26"
   - **Start Date** and **End Date**
3. Click **Save**.

The new academic year will be created in an inactive state.

#### Activating an Academic Year

1. Find the academic year you want to activate in the list.
2. Click on it to open the detail view.
3. Click **Activate**.

> **Important:** Only one academic year can be active at a time. Activating a new year does not automatically archive the previous one -- you must archive it separately.

#### Archiving an Academic Year

1. Open the academic year you want to archive.
2. Click **Archive**.

Archived academic years are read-only. You can still view their data but cannot make changes.

---

### Standards

Standards represent grade levels at your institute (for example, Class 1, Class 2, up to Class 12).

#### Viewing Standards

1. In the sidebar, click **Standards** (under the Academic group).
2. You will see a list of all configured grade levels.

#### Creating a New Standard

1. On the Standards page, click the **Create** button.
2. Enter the standard name (for example, "Class 5").
3. Click **Save**.

#### Viewing Standard Details

1. Click on any standard in the list to open its detail page.
2. On the detail page you can see:
   - **Sections** assigned to this standard (for example, Section A, Section B)
   - **Subjects** assigned to this standard

From here you can add or remove sections and subjects as needed.

---

## Billing

### Subscription

The Subscription page shows your institute's current plan and usage.

1. In the sidebar, click **Subscriptions** (under the Billing group).
2. You will see:
   - **Current Plan** name and status (Active, Trial, Expired, etc.)
   - **Billing Period** -- start and end dates
   - **Entitlements** -- the limits included in your plan:
     - Maximum number of **students**
     - Maximum number of **staff members**
     - Maximum **storage** allowed

> **Tip:** If you are approaching your plan limits, contact your reseller to upgrade.

---

### Invoices

Invoices are bills generated for your subscription.

#### Viewing Invoices

1. In the sidebar, click **Invoices** (under the Billing group).
2. You will see a list of all invoices with their status (Paid, Pending, Overdue).
3. Click on any invoice to see full details including line items and amounts.

#### Paying an Invoice

There are two payment methods available:

**Option A -- UPI P2P (manual transfer):**

1. Open the invoice you want to pay.
2. Click **Pay via UPI**.
3. You will see:
   - A **QR code** you can scan with any UPI app (Google Pay, PhonePe, Paytm, etc.)
   - The **VPA (UPI ID)** you can copy and pay manually
4. After making the payment in your UPI app, come back and enter the **UTR number** (transaction reference) in the form.
5. Click **Submit**. Your payment will be verified.

**Option B -- Online payment (Razorpay):**

1. Open the invoice you want to pay.
2. Click **Pay Online**.
3. You will be redirected to the Razorpay payment page.
4. Complete the payment using UPI, card, net banking, or any supported method.
5. After payment, you will be redirected back automatically.

#### Downloading Invoice PDF

1. Open the invoice.
2. Click the **Download PDF** button.
3. The invoice will be downloaded to your device. You can print it for your records.

---

### Payments

The Payments page shows a history of all payments made by your institute.

1. In the sidebar, click **Payments** (under the Billing group).
2. Each payment entry shows:
   - **Date** of the payment
   - **Amount** paid (in INR)
   - **Method** icon (UPI, Card, Net Banking, etc.)
   - **Status** badge (Success, Pending, Failed)

---

## Settings

### Institute Settings

1. In the sidebar, click **Settings** (under the System group).
2. On this page you can view and update your institute's configuration, such as:
   - Institute name and contact details
   - Supported languages
   - Other institute-level preferences

Click **Save Changes** after making any modifications.

---

### Notification Preferences

Control which notifications you receive and through which channels.

1. In the sidebar, click **Notification Preferences** (under the System group).
2. You will see a matrix (grid) with:
   - **Rows** -- different notification types (for example, "New invoice generated", "Subscription expiring")
   - **Columns** -- delivery channels (for example, In-App, Email, SMS, WhatsApp)
3. Toggle each cell on or off based on your preference.

Changes are saved automatically.

---

### Sessions

View and manage your active login sessions.

1. In the sidebar, click **Sessions** (under the System group).
2. You will see a list of all devices and browsers where you are currently logged in, including:
   - Device/browser name
   - Last active time
   - Location (approximate)
3. To sign out from a specific session, click the **Sign Out** button next to it.

> **Security tip:** If you see a session you do not recognise, sign out of it immediately and change your password.

---

## Audit Logs

Audit Logs record all important actions performed within your institute. This helps administrators track who did what and when.

1. In the sidebar, click **Audit Logs** (under the System group).
2. You will see a chronological list of activities, including:
   - **Who** performed the action (user name)
   - **What** was done (for example, "Created standard Class 5", "Updated institute settings")
   - **When** it happened (date and time)

Use the filters and search to find specific entries.

> **Note:** Audit logs are read-only. They cannot be edited or deleted.

---

## Account (Passkey Manager)

Passkeys let you log in without a password, using your device's fingerprint sensor, face recognition, or a security key.

1. In the sidebar, click **Account** (under the System group).
2. You will see a list of passkeys registered to your account.
3. To add a new passkey:
   - Click **Add Passkey**.
   - Follow your browser's prompt to register a fingerprint, face, or security key.
   - Give the passkey a name (for example, "Office Laptop" or "My Phone").
4. To remove a passkey, click the **Delete** button next to it.

> **Tip:** Register passkeys on all devices you regularly use to make logging in faster and more secure.

---

## Sidebar Navigation Reference

The sidebar is organised into groups for easy access:

| Group | Pages |
|-------|-------|
| **Overview** | Dashboard, Users |
| **Academic** | Academic Years, Standards, Timetable |
| **Billing** | Subscriptions, Invoices, Payments |
| **System** | Audit Logs, Settings, Notification Preferences, Account |

Click any item in the sidebar to navigate directly to that page.
