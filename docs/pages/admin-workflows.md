# Admin Portal Workflows

This guide covers the day-to-day workflows available to Roviq platform administrators through the Admin Portal.

## Accessing the Admin Portal

1. Navigate to the Admin Portal login page (e.g., `admin.roviq.com/en/admin/login`).
2. Enter your **Roviq ID** and **password**.
3. Alternatively, authenticate using a **passkey** if you have one registered.
4. After successful login, you are taken to the Admin Dashboard.

## Dashboard

The dashboard displays a "Welcome to Roviq Admin" greeting and provides quick-access links to common tasks:

- **Manage Institutes** -- go to the institute list
- **Manage Users** -- go to user management
- **View Audit Logs** -- go to the audit log viewer
- **View Settings** -- go to platform settings

Use these links to jump directly into the workflow you need.

---

## Institute Management

### Viewing the Institute List

1. From the sidebar or dashboard, open **Institutes**.
2. The list shows all institutes on the platform with key details at a glance.
3. Use the **search bar** to find an institute by name.
4. Apply **filters** to narrow results by:
   - **Status** (e.g., Active, Pending, Suspended)
   - **Type** (e.g., CBSE, ICSE, State Board)
   - **Board**
5. Switch to the **Pending Approval** tab to see institutes awaiting review. The tab displays a count badge showing how many institutes need attention.

### Viewing Institute Details

1. Click on any institute in the list to open its detail page.
2. The breadcrumb at the top shows the institute name (not a UUID) for easy navigation.
3. The detail page has the following tabs:
   - **Overview** -- identity information, contact details, and address
   - **Setup Progress** -- tracks onboarding steps completed by the institute
   - **Academic Structure** -- standards, sections, and subjects configured
   - **Configuration** -- institute-level settings
   - **Branding** -- logo, colors, and visual identity
   - **Audit Log** -- history of changes made to this institute

### Approving an Institute

When a new institute registers, it enters a **PENDING_APPROVAL** status and appears in the Pending Approval tab.

1. Open the **Pending Approval** tab on the institute list.
2. Click on the institute to open its detail page and review the submitted information.
3. Click the **Approve** button.
4. The institute status changes to **PENDING**, and its setup process begins automatically via a background workflow (Temporal).
5. Once setup completes, the institute transitions to **ACTIVE** and its administrators can log in.

### Rejecting an Institute

1. Open the institute detail page for a PENDING_APPROVAL institute.
2. Click the **Reject** button.
3. Enter a **reason for rejection** (minimum 10 characters). This reason is recorded and visible in the audit log.
4. Confirm the rejection. The institute status changes to **REJECTED**.

### Deactivating an Institute

Deactivation is used when an institute should be temporarily disabled but its data must be preserved.

1. Open the institute detail page.
2. Click **Deactivate**.
3. Confirm the action.
4. The institute status changes to **DEACTIVATED**. Users belonging to this institute can no longer log in. All data is preserved and the institute can be reactivated later.

### Suspending an Institute

Suspension is used for policy violations or compliance issues.

1. Open the institute detail page.
2. Click **Suspend**.
3. Optionally enter a **reason** for the suspension. This is recorded in the audit log.
4. Confirm the action. The institute status changes to **SUSPENDED**.

### Deleting an Institute

Deletion is a soft delete -- the institute is removed from normal views but can be restored.

1. Open the institute detail page.
2. Click **Delete**.
3. A confirmation dialog appears. Confirm the deletion.
4. The institute is soft-deleted and no longer appears in the default institute list.

### Restoring a Deleted Institute

1. Access the deleted/trashed institutes view.
2. Find the institute you want to restore.
3. Click **Restore**.
4. The institute reappears in the institute list with its previous status.

---

## Institute Groups

Institute groups let you organize institutes into logical collections (e.g., by region, franchise, or management body).

1. From the sidebar, open **Institute Groups**.
2. The list shows all existing groups.
3. Click **Create** to make a new group. Provide a name and any required details.
4. Open a group to **assign institutes** to it. Search and select the institutes you want to add.

---

## Audit Logs

The audit log provides a complete record of actions taken across the platform.

### Browsing Logs

1. From the sidebar or dashboard, open **Audit Logs**.
2. The view has three tabs:
   - **All Events** -- every recorded action on the platform
   - **Impersonation** -- logs of admin-initiated impersonation sessions
   - **Reseller Activity** -- actions performed by resellers

### Filtering Logs

Use the filter controls to narrow results by:

- **Entity type** -- e.g., Institute, User, Subscription
- **Action type** -- e.g., created, updated, approved, suspended
- **User ID** -- find all actions by a specific user

### Viewing Event Details

1. Click on any log row to open its detail view.
2. The detail shows the full event payload, including before/after values where applicable.
3. The **Correlation ID** is displayed and links to a **trace page** showing a timeline of all related events in that operation.

---

## Observability

1. From the sidebar, open **Observability**.
2. An embedded **Grafana dashboard** is displayed, showing platform health metrics, request rates, error rates, and resource usage.
3. Use the Grafana controls to adjust time ranges and drill into specific panels.

---

## Sessions

Manage active login sessions across the platform.

1. From the sidebar, open **Settings > Sessions**.
2. The list shows all currently active sessions with details such as device, IP, and last activity.
3. To terminate a session, click **Revoke** next to the session entry.
4. The revoked session is immediately invalidated and the user must log in again.

---

## Account Settings

### Passkey Management

1. From the sidebar, open **Account** or navigate to your profile settings.
2. The **Passkey Manager** section shows your registered passkeys.
3. You can:
   - **Register a new passkey** for passwordless login
   - **Remove an existing passkey** that you no longer use
4. Passkeys provide a more secure and convenient alternative to password-based login.
