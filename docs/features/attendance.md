# Attendance, Leaves & Holidays

A single feature doc that covers the three tightly-coupled tenant modules: `attendance`, `leave`, and `holiday`. Roviq models each one as a first-class domain with its own schema, service, resolver, and events — but at run-time they form one pipeline: holidays block attendance sessions, approved leaves seed attendance entries, and attendance drives guardian notifications.

## 1. Overview

**Attendance** is the backbone of the daily roster. A teacher opens a session for `(section, date, period)` — the service creates one `attendance_sessions` row and auto-seeds one `attendance_entries` row per active student with status `PRESENT`. Teachers then flip absentees and latecomers, and can choose `DAILY` (whole-day, `period = NULL`) or `LECTURE_WISE` (per-period) mode. A past-day edit is refused with `ATTENDANCE_EDIT_WINDOW_CLOSED` unless an admin explicitly passes `overridePastDay: true`, which is audited.

**Leaves** are the upstream feed. Students and staff file leaves with a date range, type, reason, and optional file URLs. A PENDING leave has no attendance effect; once APPROVED, the attendance auto-seed picks it up — any student with an approved leave covering the session date is seeded `LEAVE` instead of `PRESENT`. Teachers still see the marks and can override if, say, the student actually showed up. REJECTED / CANCELLED leaves do nothing to attendance.

**Holidays** are the blocker. Institute admins publish single-day or range holidays on the institute calendar. When a teacher tries to open a session on a holiday-covered date, `openAttendanceSession` throws `ATTENDANCE_ON_HOLIDAY` and refuses to create the row. This is intentionally strict — there is no admin override — because the downstream integrity of reports depends on "holiday dates have zero sessions, period".

## 2. Backend

### Schema

| Table | Purpose | Key columns | Tenant RLS |
| --- | --- | --- | --- |
| `attendance_sessions` | One row per `(section, date, period)` | `tenant_id`, `section_id`, `academic_year_id`, `date`, `period` (nullable), `subject_id` (nullable), `lecturer_id`, `override_check` | `tenantPolicies('attendance_sessions')` — roviq_app / roviq_reseller / roviq_admin read + write |
| `attendance_entries` | One row per student per session | `tenant_id`, `session_id`, `student_id` (membership id), `status`, `mode`, `remarks`, `marked_at` | `tenantPolicies('attendance_entries')` |
| `leaves` | Leave application | `tenant_id`, `user_id` (membership id — student or staff), `start_date`, `end_date`, `type`, `status`, `reason`, `file_urls` (JSONB), `decided_by` | `tenantPolicies('leaves')` |
| `holidays` | Institute holiday calendar | `tenant_id`, `name` (i18n JSONB), `type`, `start_date`, `end_date`, `tags` (JSONB), `is_public` | `tenantPolicies('holidays')` |

**Enums**

- `AttendanceStatus`: `PRESENT`, `ABSENT`, `LEAVE`, `LATE`
- `AttendanceMode`: `MANUAL`, `APP`, `BIOMETRIC`, `IMPORT`
- `LeaveType`: `MEDICAL`, `CASUAL`, `BEREAVEMENT`, `EXAM`, `OTHER`
- `LeaveStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`
- `HolidayType`: see `libs/shared/common-types/src/lib/enums/holiday.ts`

All four tables carry `tenantColumns` (id/createdAt/updatedAt/createdBy/updatedBy/deletedAt/tenantId) and enforce tenant isolation through the common `tenantPolicies()` RLS helper.

### Modules

Each module is a self-contained NestJS feature under `apps/api-gateway/src/institute/`:

- **`attendance/`** — `attendance.resolver.ts`, `attendance.service.ts`, `repositories/attendance.repository.ts` + `attendance.drizzle-repository.ts`, DTOs, models. Imports `StudentModule`, `LeaveModule`, `HolidayModule` (for the auto-seed + holiday guard).
- **`leave/`** — `leave.resolver.ts`, `leave.service.ts`, repositories, DTOs, models. Self-contained.
- **`holiday/`** — `holiday.resolver.ts`, `holiday.service.ts`, repositories, DTOs, models. Self-contained.

### GraphQL surface

All three modules use `@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)` at the resolver class level.

| Module | Queries | Mutations |
| --- | --- | --- |
| `attendance` | `attendanceSession`, `attendanceSessionsForSection`, `attendanceEntries`, `attendanceCounts`, `attendanceCountsForDate`, `attendanceAbsenteesReport`, `attendanceSectionDailyBreakdown`, `attendanceStudentHistory` | `openAttendanceSession`, `overrideAttendanceSession`, `markAttendance`, `bulkMarkAttendance`, `deleteAttendanceSession` |
| `leave` | `leaves`, `leave` | `applyLeave`, `updateLeave`, `approveLeave`, `rejectLeave`, `cancelLeave`, `deleteLeave` |
| `holiday` | `holidays`, `holiday`, `holidaysOnDate` | `createHoliday`, `updateHoliday`, `deleteHoliday` |

Platform admin also exposes one cross-tenant query (see [Admin cross-tenant view](#admin-cross-tenant-view)).

### Events

Services emit NATS JetStream events through the private `emitEvent(pattern, data)` helper on each service. Domain events are UPPERCASE-prefixed; notification triggers use the `NOTIFICATION.*` prefix.

| Pattern | Emitted by | Purpose |
| --- | --- | --- |
| `ATTENDANCE_SESSION.opened` | `AttendanceService.openSession` | Downstream reporting, audit |
| `ATTENDANCE_SESSION.overridden` | `AttendanceService.overrideSession` | Teacher substitution audit |
| `ATTENDANCE_SESSION.bulk_marked` | `AttendanceService.bulkMark` | Bulk-mark audit |
| `ATTENDANCE_SESSION.past_day_bulk_edited` | `AttendanceService.bulkMark` (override path) | Admin override audit |
| `ATTENDANCE_SESSION.deleted` | `AttendanceService.deleteSession` | Soft-delete audit |
| `ATTENDANCE_ENTRY.marked` | `AttendanceService.markAttendance` | Single-mark audit |
| `ATTENDANCE_ENTRY.past_day_edited` | `AttendanceService.markAttendance` (override path) | Admin override audit |
| `NOTIFICATION.attendance.absent` | `AttendanceService.markAttendance` (when status=ABSENT) | Fan-out to Novu workflow `attendance-absent` |
| `LEAVE.applied` / `LEAVE.updated` / `LEAVE.approved` / `LEAVE.rejected` / `LEAVE.cancelled` / `LEAVE.deleted` | `LeaveService` | Audit + downstream reporting |
| `NOTIFICATION.leave.decided` | `LeaveService.approve` / `.reject` | Fan-out to Novu workflow `leave-decided` |
| `HOLIDAY.created` / `HOLIDAY.updated` / `HOLIDAY.deleted` | `HolidayService` | Calendar cache invalidation |

## 3. Frontend

Pages map 1:1 to modules, all under `apps/web/src/app/[locale]/`.

| Route | Purpose |
| --- | --- |
| `/institute/attendance` | Teacher's daily roster — open a session, mark the section |
| `/institute/attendance/reports` | Absentee and section reports |
| `/institute/attendance/history` | Per-student history over a date range |
| `/institute/leave` | Leaves list + filters (staff-scoped or all, based on ability) |
| `/institute/leave/apply` | Submit a new leave |
| `/institute/leave/[id]` | Leave detail + approve/reject actions |
| `/institute/holiday` | Holiday calendar — list + range picker |
| `/institute/holiday/new` | Publish a new holiday |
| `/institute/holiday/[id]` | Edit / delete a holiday |
| `/admin/attendance` | Platform-admin cross-tenant attendance roll-up for a single date |

Admin attendance uses `useAdminAttendanceSummary(date)` (in `apps/web/src/app/[locale]/admin/(dashboard)/attendance/use-admin-attendance.ts`) to fetch the roll-up. The DataTable row click routes to `/admin/institutes/{instituteId}` for drill-down.

## 4. Integrations

Below is the exact flow that ties the three modules together.

**Auto-seed from the student roster.** When `openAttendanceSession` succeeds (holiday check passes, idempotence check passes), `AttendanceService.seedPresentEntries` pages through `StudentService.list({ sectionId, academicStatus: ENROLLED })` in batches of 1 000 and inserts one `attendance_entries` row per student. Default status is `PRESENT`. This removes the "blank roster" problem on the teacher's screen — they only flip absentees/latecomers.

**LEAVE → session seed precedence.** Before the bulk insert, the service calls `LeaveService.approvedOnDate(date, membershipIds)` and collects the student membership ids whose APPROVED leave range covers the session date. Those students are seeded with `LEAVE` instead of `PRESENT`. PENDING / REJECTED / CANCELLED leaves have no effect. A teacher can still override the mark post-seed.

**HOLIDAY → session-creation blocker.** `openAttendanceSession` calls `HolidayService.onDate(date)` before inserting. If any holiday row spans the date, the service throws `ATTENDANCE_ON_HOLIDAY: <names>` and the transaction short-circuits. This is intentionally strict — there is no per-session override, because downstream reports assume holiday dates have zero sessions. The check runs *after* the idempotence check so re-opening a session that predates a later-added holiday still returns the existing record.

**Notification fan-out.** The backend emits `NOTIFICATION.*` events on significant domain transitions. `apps/notification-service` consumes them via NATS listeners and triggers Novu workflows:

| Event | Novu workflow | Channels |
| --- | --- | --- |
| `NOTIFICATION.attendance.absent` | `attendance-absent` | in-app → digest → WhatsApp → email → push |
| `NOTIFICATION.leave.decided` | `leave-decided` | in-app → email |

## 5. Permissions matrix

Defaults come from `DEFAULT_ROLE_ABILITIES` in `libs/shared/common-types/src/lib/common-types.ts`. A tenant's `institute_admin` seed role gets `manage:all` and therefore has `manage` on every subject.

| Role | Attendance | Leave | Holiday |
| --- | --- | --- | --- |
| `institute_admin` | `manage` (via `manage:all`) | `manage` | `manage` |
| `principal` | `manage` | `manage` | `manage` |
| `vice_principal` | `manage` | `manage` | `manage` |
| `class_teacher` | `manage` where `sectionId ∈ user.assignedSections` | `read` | `read` |
| `subject_teacher` | `manage` where `sectionId ∈ user.assignedSections` (same condition as class_teacher) | `read` | `read` |
| `admin_clerk` | — | `create`, `read` | `read` |
| `student` | `read` where `studentId = ${user.id}` | `create`, `read` where `userId = $user.sub` | `read` |
| `parent` | `read` | `read` | `read` |

Guard enforcement order: `GqlAuthGuard` → `InstituteScopeGuard` (or `PlatformScopeGuard` for admin) → `AbilityGuard` (reads the `@CheckAbility` metadata). Field-level restrictions (e.g. Aadhaar visibility on Student) do not apply to Attendance/Leave/Holiday.

## 6. Operational notes

**Same-day-only edit window.** `markAttendance` and `bulkMarkAttendance` refuse to update an entry whose parent session is older than today with `ATTENDANCE_EDIT_WINDOW_CLOSED`. The window is evaluated against the session's `date` — not the entry's `markedAt`. This is a business-rule guard, not an RLS concern.

**Admin override.** Both mutations accept `overridePastDay: boolean` + `overrideReason: string` arguments. When the override flag is `true`, the service still verifies the caller has `manage` on `Attendance` (so a class_teacher cannot self-elevate) before allowing the update. Overrides emit distinct audit events — `ATTENDANCE_ENTRY.past_day_edited` for singles and `ATTENDANCE_SESSION.past_day_bulk_edited` for bulks — so the audit pipeline surfaces them separately from normal marks.

**Holiday strictness.** `ATTENDANCE_ON_HOLIDAY` has no override path at the service layer. If an institute publishes a holiday, attendance cannot be recorded for that day. The only recourse is to delete/shrink the holiday, then re-open the session.

**Audit pipeline.** Every write goes through the standard audit listener (see `docs/audit-logging.md`). Field diffs are recorded; past-day overrides additionally set `metadata.overrideReason`.

**Admin cross-tenant view.** `adminAttendanceSummary(date)` aggregates every tenant's sessions via `withAdmin(db, tx => tx.execute(sql\`…\`))` — bypassing RLS is intentional for platform-admin reporting. The query joins `attendance_sessions` → `attendance_entries` → `institutes` and groups by `tenant_id + name`, emitting one row per institute with per-status counts + `sessionCount`. See `apps/api-gateway/src/admin/attendance/` for the implementation.

## 7. Deferred

Known gaps documented here so nothing is silently dropped. Each entry should get a Linear issue when prioritised.

- **Half-Day status.** `AttendanceStatus` is a four-value enum (`PRESENT / ABSENT / LEAVE / LATE`). A `HALF_DAY` status — common in Indian schools — would require (a) an enum migration, (b) UI affordance on the teacher roster, (c) a new report bucket, and (d) a notification rule (is half-day an absent? both?). Deferred.
- **Leave file-upload UI.** `leaves.file_urls` is a JSONB string array. The apply form currently accepts a list of URLs typed/pasted manually; there is no drag-drop uploader to the tenant storage bucket. Backend accepts uploaded URLs as-is — no virus scan, no size cap at the GraphQL layer.
- **Parent portal surface.** Parents have `read:Attendance` and `read:Leave` by default, but there is no `/parent/...` route that renders their children's attendance / leaves today. The API is ready; the page is not.
