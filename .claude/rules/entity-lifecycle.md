---
paths:
  - "apps/**/*resolver.ts"
  - "apps/**/*service.ts"
  - "apps/**/*service.test.ts"
  - "ee/apps/**/*resolver.ts"
  - "ee/apps/**/*service.ts"
  - "ee/apps/**/*service.test.ts"
---

## Resolver & Service Rules

### Delete = one line
`await this.service.delete(id); return true;`. `softDelete()` throws `NotFoundException`/`ConflictException` directly. No try-catch, no result objects.

### Status ≠ deletion
Delete = "created by mistake." Deactivate = "still referenced but disabled." Separate mutations: `deletePlan` vs `deactivatePlan`.

### Explicit status transitions
`suspendStudent(id)`, NOT `updateStudent(id, { status })`. Each transition validates business rules.

### Financial records: status only, no delete
Invoices, subscriptions, ledger entries. `cancelSubscription`, `refundInvoice` — never delete.

### Trash/restore needs CASL
`@CheckAbility({ action: 'manage', subject })`. Service calls `withTrash()` internally — resolvers don't know about it.
