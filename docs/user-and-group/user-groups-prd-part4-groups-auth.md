# User & Groups Service — PRD Part 4: Groups & Authorization

> **Dynamic group engine, CASL role-permission matrix for 19+ roles, field-level authorization, and Drizzle integration patterns.**

---

## 1. Group Engine

### 1.1 Group Types and Their Behavior

| Group Type | Membership Type | Auto-Created? | Example |
|---|---|---|---|
| `class` | dynamic | Yes (per standard) | "Class 10 — All Students" |
| `section` | dynamic | Yes (per section) | "Class 10-A" |
| `house` | dynamic | Yes (per house) | "Red House" |
| `club` | static | No | "Science Club", "Debate Club" |
| `sports_team` | static | No | "Cricket U-17", "Kabaddi Girls" |
| `bus_route` | dynamic | Yes (per route) | "Route 5 — Sector 14 to School" |
| `subject` | dynamic | Yes (per subject) | "Physics Class 12" (all students taking Physics) |
| `stream` | dynamic | Yes (per stream) | "Science PCM Class 11" |
| `fee` | hybrid | No | "Tuition Fee Group A" (rule-based + manual overrides) |
| `exam` | dynamic | No | "Class 10 Board Exam Candidates" |
| `notification` | hybrid | No | "Parents of Defaulters" |
| `activity` | static | No | "Annual Day Performers" |
| `department` | hybrid | No | "Science Department" (all Science teachers + HOD) |
| `committee` | static | No | "SMC Members", "Anti-Ragging Committee" |
| `composite` | hybrid | No | "Science Wing" = Science teachers + Science students |
| `custom` | any | No | User-defined |

**Auto-created groups:** During institute setup (Temporal Phase 3), the system creates section groups, class groups, and house groups automatically. These are marked `is_system = true` and cannot be deleted by the admin (only deactivated).

### 1.2 Dynamic Rule Specification (JsonLogic)

Rules are JSONB in JsonLogic format. The rule engine converts them to Drizzle `where()` clauses.

**Available rule variables (the "dimensions"):**

| Variable | Type | Resolves Against |
|---|---|---|
| `standard_id` | UUID | `student_academics.standard_id` |
| `section_id` | UUID | `student_academics.section_id` |
| `academic_year_id` | UUID | `student_academics.academic_year_id` |
| `gender` | string | `user_profiles.gender` |
| `stream` | string | `student_profiles.stream` |
| `house_id` | UUID | `student_academics.house_id` |
| `route_id` | UUID | `student_academics.route_id` |
| `social_category` | string | `student_profiles.social_category` |
| `is_cwsn` | boolean | `student_profiles.is_cwsn` |
| `is_rte_admitted` | boolean | `student_profiles.is_rte_admitted` |
| `academic_status` | string | `student_profiles.academic_status` |
| `admission_type` | string | `student_profiles.admission_type` |
| `medium_of_instruction` | string | From section config |
| `employment_type` | string | `staff_profiles.employment_type` (for staff groups) |
| `department` | string | `staff_profiles.department` (for staff groups) |
| `designation` | string | `staff_profiles.designation` (for staff groups) |
| `is_class_teacher` | boolean | `staff_profiles.is_class_teacher` |
| `user_type` | string | membership role type (for mixed groups) |

**Example rules:**

"All female students in Class 10 Science stream, currently enrolled":
```json
{
  "and": [
    { "==": [{ "var": "user_type" }, "student"] },
    { "==": [{ "var": "standard_id" }, "uuid-of-class-10"] },
    { "==": [{ "var": "gender" }, "female"] },
    { "==": [{ "var": "stream" }, "science_pcm"] },
    { "==": [{ "var": "academic_status" }, "enrolled"] }
  ]
}
```

"All PGT teachers in Science department":
```json
{
  "and": [
    { "==": [{ "var": "user_type" }, "staff"] },
    { "==": [{ "var": "department" }, "Science"] },
    { "in": [{ "var": "designation" }, ["PGT Physics", "PGT Chemistry", "PGT Biology", "PGT Mathematics"]] }
  ]
}
```

"All parents of RTE students":
```json
{
  "and": [
    { "==": [{ "var": "user_type" }, "guardian"] },
    { "==": [{ "var": "linked_student.is_rte_admitted" }, true] }
  ]
}
```

### 1.3 Rule-to-SQL Conversion

The `GroupRuleEngine` service converts JsonLogic to Drizzle SQL:

1. Parse JsonLogic tree.
2. Map `var` references to table + column: `{ "var": "gender" }` → `userProfiles.gender`.
3. Map operators: `==` → `eq()`, `!=` → `ne()`, `in` → `inArray()`, `and` → `and()`, `or` → `or()`, `>` → `gt()`, `<` → `lt()`.
4. For cross-table dimensions (e.g., `linked_student.is_rte_admitted` for guardian groups), generate appropriate JOINs.
5. Always prepend `academic_status = 'enrolled'` for student groups and `deleted_at IS NULL` for all (RLS already handles tenant scoping).
6. Return a Drizzle `SQL` object passable to `.where()`.

**Implicit rules (always applied):**
- Student groups: `academic_year_id = current_active_year AND academic_status IN ('enrolled', 'promoted')`.
- Staff groups: `membership.is_active = true`.
- Guardian groups: resolved through their linked students' data.

### 1.4 Composite Group Resolution

Composite groups combine multiple child groups via `group_children`.

Resolution order:
1. Resolve each child group (recursive, depth limit = 5).
2. Union all member sets.
3. Apply manual exclusions (`group_members WHERE is_excluded = true`).
4. Apply manual inclusions (`group_members WHERE source = 'manual'`).
5. Deduplicate by membership_id.

**Cycle detection:** Before saving `group_children`, traverse the parent chain upward. If the child group already appears as an ancestor, reject with error `GROUP_CIRCULAR_REFERENCE`.

PostgreSQL recursive CTE for cycle check:
```sql
WITH RECURSIVE ancestry AS (
  SELECT parent_group_id FROM group_children WHERE child_group_id = $proposed_parent
  UNION ALL
  SELECT gc.parent_group_id FROM group_children gc
  JOIN ancestry a ON gc.child_group_id = a.parent_group_id
)
SELECT EXISTS (SELECT 1 FROM ancestry WHERE parent_group_id = $proposed_child);
```

### 1.5 Group Membership Caching

**Cache location:** `group_members` table (rows with `source = 'rule'` or `source = 'inherited'`).

**Resolution trigger:** Lazy on first query after invalidation. The `groups.resolved_at` timestamp is set to NULL when invalidated. On query, if `resolved_at IS NULL`, resolve synchronously before returning results.

**Invalidation matrix:**

| Event | Invalidates Groups Where |
|---|---|
| `student.admitted` | `rule_dimensions` contains any of: `standard_id`, `section_id`, `gender`, `social_category`, `academic_status` |
| `student.section_changed` | `rule_dimensions` contains `section_id` |
| `student.promoted` | `rule_dimensions` contains `standard_id` or `section_id` |
| `student.left` | `rule_dimensions` contains `academic_status` |
| `staff.joined` | Staff-targeted groups where `rule_dimensions` contains `department` or `designation` |
| `staff.left` | Same |
| `group.rules_updated` | The specific group only |
| `academic_year.activated` | ALL dynamic groups (full refresh) |

**Debouncing:** Bulk operations (mass promotion, bulk import) emit a single `BATCH_COMPLETE` event after processing all items. The invalidation service waits for `BATCH_COMPLETE` rather than reacting to each individual event. 5-second debounce window.

### 1.6 Group Usage Across Modules

| Module | Uses Groups For |
|---|---|
| Notifications | Select group → resolve members → send WhatsApp/SMS/push via Novu Topics |
| Finance | Fee structures linked to fee groups. "Tuition Fee for Bus Students" = fee linked to `bus_route` group |
| Timetable | Section groups define who attends which period |
| Exams | Exam groups determine who takes which paper. "Class 10 Board Candidates" |
| Attendance | Section groups define daily attendance lists |
| Reports | "Generate report for Class 10 Science" = resolve group → query marks |
| Permissions | Teacher's CASL `sectionIds` derived from section groups they're assigned to |

---

## 2. CASL Authorization with Drizzle

### 2.1 CASL-to-Drizzle Bridge

Since no production `@casl/drizzle` adapter exists, we build a custom ~200-line bridge:

```typescript
// casl-drizzle.ts
import { rulesToAST } from '@casl/ability/extra';
import { eq, ne, inArray, and, or, sql, type SQL } from 'drizzle-orm';

export function accessibleBy(
  ability: AppAbility,
  action: string,
  subject: string,
  table: PgTable
): SQL | undefined {
  const ast = rulesToAST(ability, action, subject);
  if (!ast) return sql`FALSE`; // No matching rules = deny all
  return astToDrizzle(ast, table);
}

function astToDrizzle(node: ASTNode, table: PgTable): SQL {
  switch (node.operator) {
    case 'and': return and(...node.value.map(n => astToDrizzle(n, table)));
    case 'or': return or(...node.value.map(n => astToDrizzle(n, table)));
    case 'eq': return eq(table[node.field], node.value);
    case 'ne': return ne(table[node.field], node.value);
    case 'in': return inArray(table[node.field], node.value);
    // ... other operators
  }
}
```

Usage in services:
```typescript
async findStudents(ability: AppAbility) {
  const filter = accessibleBy(ability, 'read', 'Student', studentProfiles);
  return withTenant(this.db, tenantId, (tx) =>
    tx.select().from(studentProfiles).where(filter)
  );
}
```

### 2.2 Double Authorization Layer

**Layer 1: RLS (database level).** Ensures a user can NEVER see another tenant's data, even if CASL misconfigures. RLS is the safety net.

**Layer 2: CASL (application level).** Fine-grained: "teacher can only read students in their sections." CASL conditions generate additional `WHERE` clauses on top of RLS.

**Why both?** RLS prevents catastrophic cross-tenant leaks. CASL handles within-tenant granularity. Defense in depth.

### 2.3 Ability Compilation

At login (or cache miss), the `AbilityFactory` (Auth PRD §5.4):
1. Loads role's `abilities` JSONB (from Redis cache or DB).
2. Loads membership's `abilities` JSONB (per-user overrides).
3. Interpolates conditions: replaces `${user.tenantId}`, `${user.sectionIds}`, `${user.childrenIds}` with actual runtime values.
4. Merges: role abilities at priority 0, membership overrides at priority 100.
5. Sorts by priority (CASL last-match-wins).
6. Builds `createMongoAbility(rules)`.
7. Caches serialized rules in Redis (`packRules`) with 5-minute TTL.

### 2.4 Field-Level Authorization

Sensitive fields are restricted by role using CASL `fields`:

```json
// In student role abilities: students can read their own basic data but NOT these fields
{
  "action": "read",
  "subject": "Student",
  "fields": ["aadhaar_encrypted", "medical_info", "annual_income", "caste"],
  "inverted": true,
  "conditions": { "id": { "$ne": "${user.studentProfileId}" } }
}
```

In GraphQL resolvers, use `permittedFieldsOf(ability, 'read', 'Student')` to filter response fields. Unauthorized fields return `null` with no error (silent filter — standard CASL pattern).

---

## 3. Role-Permission Matrix

### 3.1 System Roles (Seeded During Institute Setup)

These roles are created by the Institute Setup Temporal workflow and marked `is_system = true`.

| Role Name | Scope | Description |
|---|---|---|
| `institute_admin` | institute | Full access to all institute data and settings |
| `principal` | institute | Academic authority, TC approval, staff management |
| `vice_principal` | institute | Deputizes for principal, supervises coordinators |
| `academic_coordinator` | institute | HOD — manages department curriculum, question papers |
| `admin_clerk` | institute | Admissions, registers, TC preparation, certificates |
| `accountant` | institute | Fee management, payroll, financial reports |
| `class_teacher` | institute | Own section: attendance, conduct, parent communication |
| `subject_teacher` | institute | Assigned students: marks entry, homework |
| `activity_teacher` | institute | Co-curricular grades, event management |
| `lab_assistant` | institute | Lab scheduling, equipment logs |
| `librarian` | institute | Library management, book issue/return |
| `transport_incharge` | institute | Route management, vehicle tracking |
| `hostel_warden` | institute | Hostel student management (if applicable) |
| `counselor` | institute | Confidential student counseling records |
| `sports_coach` | institute | Sports teams, fitness records, event results |
| `it_admin` | institute | User account management, system configuration |
| `receptionist` | institute | Visitor management, enquiry handling |
| `exam_coordinator` | institute | Exam scheduling, seating, result processing |
| `nurse` | institute | Health checkups, medical records |
| `support_staff` | institute | Minimal access — peon, watchman |
| `student` | institute | Own data: attendance, marks, timetable |
| `guardian` | institute | Children's data: attendance, marks, fees |

### 3.2 Ability Definitions per Role

#### `institute_admin`
```json
[{ "action": "manage", "subject": "all" }]
```

#### `principal`
```json
[
  { "action": "manage", "subject": "all" },
  { "action": "delete", "subject": "Institute", "inverted": true },
  { "action": "approve", "subject": "TransferCertificate" },
  { "action": "impersonate", "subject": "User", "conditions": { "tenantId": "${user.tenantId}" } }
]
```

#### `class_teacher`
```json
[
  { "action": "read", "subject": "Student", "conditions": { "sectionId": { "$in": "${user.sectionIds}" } } },
  { "action": "update", "subject": "Student", "conditions": { "sectionId": { "$in": "${user.sectionIds}" } },
    "fields": ["class_roles", "medical_info"] },
  { "action": "read", "subject": "Student",
    "fields": ["aadhaar_encrypted", "annual_income"],
    "inverted": true },
  { "action": "create", "subject": "Attendance", "conditions": { "sectionId": { "$in": "${user.sectionIds}" } } },
  { "action": "read", "subject": "Guardian", "conditions": { "linkedStudentSectionId": { "$in": "${user.sectionIds}" } } },
  { "action": "read", "subject": "Group" },
  { "action": "create", "subject": "LeaveApproval" },
  { "action": "read", "subject": "AuditLog" }
]
```

#### `subject_teacher`
```json
[
  { "action": "read", "subject": "Student", "conditions": { "sectionId": { "$in": "${user.sectionIds}" } } },
  { "action": "read", "subject": "Student",
    "fields": ["aadhaar_encrypted", "medical_info", "annual_income", "caste", "social_category"],
    "inverted": true },
  { "action": "create", "subject": "Mark" },
  { "action": "update", "subject": "Mark", "conditions": { "subjectId": { "$in": "${user.subjectIds}" } } },
  { "action": "read", "subject": "Timetable" }
]
```

#### `accountant`
```json
[
  { "action": "read", "subject": "Student", "fields": ["id", "first_name", "last_name", "admission_number", "section", "standard"] },
  { "action": "manage", "subject": "Fee" },
  { "action": "manage", "subject": "Payment" },
  { "action": "read", "subject": "Guardian", "fields": ["id", "first_name", "last_name", "phone", "annual_income"] },
  { "action": "create", "subject": "FeeWaiver", "conditions": { "amount": { "$lte": "${user.waiverLimit}" } } },
  { "action": "manage", "subject": "Payroll" }
]
```

#### `guardian` (parent)
```json
[
  { "action": "read", "subject": "Student", "conditions": { "id": { "$in": "${user.childrenIds}" } } },
  { "action": "read", "subject": "Attendance", "conditions": { "studentId": { "$in": "${user.childrenIds}" } } },
  { "action": "read", "subject": "Mark", "conditions": { "studentId": { "$in": "${user.childrenIds}" } } },
  { "action": "read", "subject": "Fee", "conditions": { "studentId": { "$in": "${user.childrenIds}" } } },
  { "action": "read", "subject": "Timetable", "conditions": { "sectionId": { "$in": "${user.childrenSectionIds}" } } },
  { "action": "create", "subject": "LeaveRequest" },
  { "action": "read", "subject": "Certificate", "conditions": { "studentId": { "$in": "${user.childrenIds}" } } },
  { "action": "update", "subject": "Profile", "conditions": { "userId": "${user.id}" } },
  { "action": "manage", "subject": "Consent", "conditions": { "guardianId": "${user.guardianProfileId}" } }
]
```

#### `student`
```json
[
  { "action": "read", "subject": "Student", "conditions": { "id": "${user.studentProfileId}" } },
  { "action": "read", "subject": "Student",
    "fields": ["aadhaar_encrypted", "medical_info", "social_category", "caste", "annual_income", "is_bpl"],
    "inverted": true },
  { "action": "read", "subject": "Attendance", "conditions": { "studentId": "${user.studentProfileId}" } },
  { "action": "read", "subject": "Mark", "conditions": { "studentId": "${user.studentProfileId}" } },
  { "action": "read", "subject": "Timetable", "conditions": { "sectionId": "${user.sectionId}" } },
  { "action": "read", "subject": "Notice" },
  { "action": "create", "subject": "HomeworkSubmission" }
]
```

#### `counselor`
```json
[
  { "action": "read", "subject": "Student" },
  { "action": "manage", "subject": "CounselingSession" },
  { "action": "read", "subject": "CounselingSession",
    "conditions": { "counselorId": "${user.staffProfileId}" } }
]
```

**Critical rule for counseling:** Counseling session notes are ONLY readable by the counselor who created them. No other role (not even Principal) can access these without explicit legal authorization. This is enforced by CASL conditions, NOT by a separate table (keeping it within the standard authorization model).

#### `support_staff`
```json
[
  { "action": "read", "subject": "Notice" }
]
```
Minimal access. No student data, no staff data, no financial data.

### 3.3 Multi-Role Merging

When a user has multiple roles (via multiple memberships at the same institute), abilities from ALL active memberships are merged:

1. Load abilities from each membership's role.
2. Load per-membership ability overrides.
3. Concatenate all rule arrays.
4. CASL evaluates with last-match-wins. Rules from higher-priority overrides (priority 100) beat role defaults (priority 0).

**Example:** A teacher who is also Sports Coach and House Master:
- Subject Teacher abilities: read students in their sections, enter marks.
- Sports Coach abilities: read all students (for team selection), manage sports records.
- House Master: read house members, manage house points.
- Merged: the user can read all students (broadest scope from Sports Coach), enter marks for their subjects, manage sports records AND house points.

### 3.4 CASL Subject Registry

CASL subjects are code-level constants (NOT database records — the old system's mistake). Defined in a shared `@roviq/casl` library:

```typescript
export type Subjects =
  | 'Student' | 'Staff' | 'Guardian' | 'Bot'
  | 'Profile' | 'Membership' | 'Role'
  | 'Group' | 'Enquiry' | 'Application'
  | 'TransferCertificate' | 'Certificate'
  | 'Attendance' | 'Timetable' | 'Fee' | 'Payment' | 'FeeWaiver' | 'Payroll'
  | 'Mark' | 'Exam' | 'ReportCard'
  | 'Notice' | 'Notification' | 'Message'
  | 'LeaveRequest' | 'LeaveApproval'
  | 'HomeworkSubmission' | 'StudyMaterial'
  | 'CounselingSession' | 'HealthRecord'
  | 'AuditLog' | 'Consent'
  | 'Institute' | 'Standard' | 'Section' | 'Subject' | 'AcademicYear'
  | 'all';

export type Actions =
  | 'create' | 'read' | 'update' | 'delete'
  | 'manage' | 'approve' | 'reject' | 'impersonate'
  | 'export' | 'import' | 'assign' | 'restore';
```

### 3.5 Invalidation on Role Change

When a role's abilities are updated:
1. Auth PRD's `AbilityFactory` invalidates all users with that role (tracked via `user_roles` → Redis Set).
2. This module's group membership cache does NOT need invalidation (groups resolve by data attributes, not by permissions).
3. Active WebSocket connections with stale abilities receive a `subscription:permission_changed` event prompting the client to refetch the ability set.
