# Institute Service — API Reference

## Platform Scope (Admin)

### Mutations

| Mutation | CASL | Input | Returns |
|----------|------|-------|---------|
| `adminCreateInstitute(input)` | `create:Institute` | `AdminCreateInstituteInput` | `InstituteModel` |
| `adminApproveInstitute(id)` | `update_status:Institute` | ID | `InstituteModel` |
| `adminRejectInstitute(id, reason)` | `update_status:Institute` | ID + String | `InstituteModel` |
| `adminUpdateInstituteStatus(id, status, reason?)` | `update_status:Institute` | ID + Enum + String? | `InstituteModel` |
| `adminDeleteInstitute(id)` | `delete:Institute` | ID | `Boolean` |
| `adminRestoreInstitute(id)` | `restore:Institute` | ID | `InstituteModel` |
| `adminCreateInstituteGroup(input)` | `create:InstituteGroup` | `CreateInstituteGroupInput` | `InstituteGroupModel` |
| `adminUpdateInstituteGroup(id, input)` | `update:InstituteGroup` | ID + `UpdateInstituteGroupInput` | `InstituteGroupModel` |
| `adminDeleteInstituteGroup(id)` | `delete:InstituteGroup` | ID | `Boolean` |

### Queries

| Query | CASL | Returns |
|-------|------|---------|
| `adminListInstitutes(filter?)` | `read:Institute` | `InstituteConnection` |
| `adminGetInstitute(id)` | `read:Institute` | `InstituteModel` |
| `adminInstituteStatistics` | `view_statistics:Institute` | `JSON` |
| `adminListInstituteGroups(filter?)` | `read:InstituteGroup` | `InstituteGroupConnection` |

### Subscriptions

| Subscription | Filter |
|-------------|--------|
| `adminInstituteApprovalRequested` | None (all events) |
| `adminInstituteCreated` | None (all events) |

---

## Reseller Scope

### Mutations

| Mutation | CASL | Tier | Returns |
|----------|------|------|---------|
| `resellerCreateInstituteRequest(input)` | `create:Institute` | full_management | `InstituteModel` |
| `resellerSuspendInstitute(id, reason?)` | `update_status:Institute` | full_management | `InstituteModel` |
| `resellerReactivateInstitute(id)` | `update_status:Institute` | full_management | `InstituteModel` |
| `resellerCreateInstituteGroup(input)` | `create:InstituteGroup` | full_management | `JSON` |

### Queries

| Query | CASL | Returns |
|-------|------|---------|
| `resellerListInstitutes(filter?)` | `read:Institute` | `InstituteConnection` |
| `resellerGetInstitute(id)` | `read:Institute` | `InstituteModel` |
| `resellerInstituteStatistics` | `view_statistics:Institute` | `JSON` |
| `resellerListInstituteGroups` | `read:InstituteGroup` | `[JSON]` |

### Subscriptions

| Subscription | Filter |
|-------------|--------|
| `resellerInstituteCreated` | `resellerId` from JWT |
| `resellerInstituteStatusChanged` | `resellerId` from JWT |

---

## Institute Scope

### Mutations

| Mutation | CASL | Returns |
|----------|------|---------|
| `updateInstituteInfo(id, input)` | `update_info:Institute` | `InstituteModel` |
| `updateInstituteBranding(input)` | `update_branding:Institute` | `InstituteModel` |
| `updateInstituteConfig(input)` | `update_config:Institute` | `InstituteModel` |
| `createInstitute(input)` | `create:Institute` | `InstituteModel` |
| `activateInstitute(id)` | `update_status:Institute` | `InstituteModel` |
| `deactivateInstitute(id)` | `update_status:Institute` | `InstituteModel` |
| `suspendInstitute(id)` | `update_status:Institute` | `InstituteModel` |
| `deleteInstitute(id)` | `delete:Institute` | `Boolean` |
| `restoreInstitute(id)` | `restore:Institute` | `InstituteModel` |
| `createAcademicYear(input)` | `create:AcademicYear` | `AcademicYearModel` |
| `updateAcademicYear(id, input)` | `update:AcademicYear` | `AcademicYearModel` |
| `activateAcademicYear(id)` | `activate:AcademicYear` | `AcademicYearModel` |
| `archiveAcademicYear(id)` | `archive:AcademicYear` | `AcademicYearModel` |
| `createStandard(input)` | `create:Standard` | `StandardModel` |
| `updateStandard(id, input)` | `update:Standard` | `StandardModel` |
| `deleteStandard(id)` | `delete:Standard` | `Boolean` |
| `createSection(input)` | `create:Section` | `SectionModel` |
| `updateSection(id, input)` | `update:Section` | `SectionModel` |
| `deleteSection(id)` | `delete:Section` | `Boolean` |
| `assignClassTeacher(sectionId, classTeacherId)` | `update:Section` | `SectionModel` |
| `createSubject(input)` | `create:Subject` | `SubjectModel` |
| `updateSubject(id, input)` | `update:Subject` | `SubjectModel` |
| `deleteSubject(id)` | `delete:Subject` | `Boolean` |
| `assignSubjectToStandard(subjectId, standardId)` | `update:Subject` | `Boolean` |
| `assignSubjectToSection(subjectId, sectionId)` | `update:Subject` | `Boolean` |
| `removeSubjectFromStandard(subjectId, standardId)` | `update:Subject` | `Boolean` |
| `removeSubjectFromSection(subjectId, sectionId)` | `update:Subject` | `Boolean` |

### Queries

| Query | CASL | Returns |
|-------|------|---------|
| `myInstitute` | `read:Institute` | `InstituteModel` (with branding/config/identifiers/affiliations via @ResolveField) |
| `institutes(filter?)` | `read:Institute` | `InstituteConnection` |
| `institute(id)` | `read:Institute` | `InstituteModel` |
| `academicYears` | `read:AcademicYear` | `[AcademicYearModel]` |
| `activeAcademicYear` | `read:AcademicYear` | `AcademicYearModel?` |
| `standards(academicYearId)` | `read:Standard` | `[StandardModel]` |
| `standard(id)` | `read:Standard` | `StandardModel` |
| `sections(standardId)` | `read:Section` | `[SectionModel]` |
| `section(id)` | `read:Section` | `SectionModel` |
| `subjects` | `read:Subject` | `[SubjectModel]` |
| `subject(id)` | `read:Subject` | `SubjectModel` |
| `subjectsByStandard(standardId)` | `read:Subject` | `[SubjectModel]` |

### Subscriptions

| Subscription | Filter |
|-------------|--------|
| `instituteUpdated` | `tenantId` from JWT |
| `instituteBrandingUpdated` | `tenantId` from JWT |
| `instituteConfigUpdated` | `tenantId` from JWT |
| `instituteSetupProgress` | `tenantId` from JWT |

---

## NATS Events

| Event | Payload | Published By |
|-------|---------|-------------|
| `INSTITUTE.created` | `{ instituteId, type }` | adminCreateInstitute |
| `INSTITUTE.approval_requested` | `{ instituteId, resellerId, requestedBy }` | resellerCreateInstituteRequest |
| `INSTITUTE.approved` | `{ instituteId, resellerId }` | adminApproveInstitute |
| `INSTITUTE.rejected` | `{ instituteId, resellerId, reason }` | adminRejectInstitute |
| `INSTITUTE.activated` | `{ instituteId, previousStatus }` | activate |
| `INSTITUTE.suspended` | `{ instituteId, reason, scope }` | suspend |
| `INSTITUTE.deactivated` | `{ instituteId, previousStatus }` | deactivate |
| `INSTITUTE.deleted` | `{ instituteId }` | delete |
| `INSTITUTE.restored` | `{ instituteId }` | restore |
| `INSTITUTE.branding_updated` | `{ instituteId, branding }` | updateBranding |
| `INSTITUTE.config_updated` | `{ instituteId, changedFields }` | updateConfig |
| `INSTITUTE.status_changed` | `{ instituteId, resellerId, previousStatus, newStatus }` | approve/reject |
| `INSTITUTE.setup_completed` | `{ instituteId }` | Temporal workflow |
| `INSTITUTE.setup_progress` | `{ instituteId, step, status, completedSteps, totalSteps }` | Temporal workflow |
| `ACADEMIC_YEAR.created` | `{ academicYearId, tenantId, label }` | createAcademicYear |
| `ACADEMIC_YEAR.activated` | `{ academicYearId, tenantId, previousYearId }` | activateAcademicYear |
| `ACADEMIC_YEAR.archived` | `{ academicYearId, tenantId }` | archiveAcademicYear |
| `STANDARD.created` | `{ standardId, tenantId, name }` | createStandard |
| `STANDARD.updated` | `{ standardId, tenantId }` | updateStandard |
| `STANDARD.deleted` | `{ standardId }` | deleteStandard |
| `SECTION.created` | `{ sectionId, tenantId, standardId }` | createSection |
| `SECTION.updated` | `{ sectionId, tenantId }` | updateSection |
| `SECTION.deleted` | `{ sectionId }` | deleteSection |
| `SECTION.teacher_assigned` | `{ sectionId, tenantId, classTeacherId }` | assignClassTeacher |
| `SUBJECT.created` | `{ subjectId, tenantId, name }` | createSubject |
| `SUBJECT.deleted` | `{ subjectId }` | deleteSubject |
| `SUBJECT.assigned_to_standard` | `{ subjectId, standardId }` | assignSubjectToStandard |
| `SUBJECT.assigned_to_section` | `{ subjectId, sectionId }` | assignSubjectToSection |
| `SUBJECT.removed_from_standard` | `{ subjectId, standardId }` | removeSubjectFromStandard |
| `SUBJECT.removed_from_section` | `{ subjectId, sectionId }` | removeSubjectFromSection |

---

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `FORBIDDEN` | 403 | CASL permission denied |
| `INSTITUTE_NOT_FOUND` | 404 | Institute not found or soft-deleted |
| `INSTITUTE_CODE_DUPLICATE` | 409 | Code already used by another non-deleted institute |
| `INSTITUTE_EMAIL_DUPLICATE` | 409 | Primary email already used |
| `SETUP_NOT_COMPLETE` | 422 | Cannot activate before setup_status=completed |
| `RESELLER_INVALID` | 422 | Reseller not found or inactive |
| `SYSTEM_RESELLER_PROTECTED` | 422 | Cannot modify "Roviq Direct" |
| `CONCURRENT_MODIFICATION` | 409 | Version mismatch on update |
| `ACADEMIC_YEAR_OVERLAP` | 400 | Date range overlaps (schools only) |
| `INVALID_DATE_RANGE` | 400 | Start date >= end date |
| `LAST_ACADEMIC_YEAR` | 422 | Cannot delete last year |
| `YEAR_ALREADY_ACTIVE` | 409 | Year is already active |
| `STANDARD_NAME_DUPLICATE` | 409 | Name exists in same academic year |
| `SECTION_NAME_DUPLICATE` | 409 | Name exists in same standard |
| `HAS_ACTIVE_ENROLLMENTS` | 422 | Cannot delete with enrolled students |
| `HAS_RECORDED_ASSESSMENTS` | 422 | Cannot delete subject with assessments |
| `STREAM_REQUIRED` | 400 | Senior secondary section needs stream |
| `SECTION_CAPACITY_EXCEEDED` | 422 | Section at/over capacity |
| `SUBJECT_CODE_DUPLICATE` | 409 | Board code already used in standard |
