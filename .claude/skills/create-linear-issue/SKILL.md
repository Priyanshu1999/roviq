---
name: create-linear-issue
description: Use when creating or updating Linear issues — provides issue template, field requirements, and quality checklist
---

# Creating Linear Issues

## When to Create Issues

- Infrastructure, convention, or architectural changes
- Bugs discovered during implementation
- Follow-up work identified while working on another issue
- Translating a PRD or design doc into actionable work items
- Always ask the user before creating — never auto-create

## Required Fields

Every issue MUST have:
- **title** — concise, imperative mood, lowercase after first word (e.g., "Add audit logging for admin database client usage")
- **team** — always `Roviq`
- **description** — structured markdown (see template below). **Be thorough** — the description is the spec. An implementer should be able to complete the work without asking clarifying questions.
- **labels** — use ONLY existing labels from Linear (fetch with `list_issue_labels` if unsure). Never create new labels without asking the user first.
- **priority** — 1=Urgent, 2=High, 3=Normal, 4=Low (default to 3 unless context demands otherwise)

## Optional but Encouraged

- **project** — assign to a project if the work belongs to one
- **milestone** — assign if the project has relevant milestones
- **blockedBy** / **blocks** — always set dependency relations when they exist
- **estimate** — set if scope is clear enough to estimate

## Description Template

Use this structure. Omit sections that don't apply, but always include Summary, Changes/What to Do, and Verification.

**Be maximally specific** — include tables for schemas/data structures, full code blocks for SQL/config/types, and exact file paths when known. The description should be a self-contained implementation spec.

**This template is a minimum, not a ceiling.** Add extra sections, subsections, tables, diagrams, or detail beyond what's listed here whenever it makes the issue clearer. The goal is a complete spec — if the source material (PRD, design doc, conversation) has relevant detail that doesn't fit neatly into the template sections, include it anyway.

```markdown
## Summary

One-liner explaining the why — not just the what.

## Context

(Optional) Background needed to understand the issue. Reference design docs, prior issues, or architectural decisions.

## Changes / What to Do

Concrete implementation steps. Be specific:
* Step one — exact files, functions, or modules to create/modify
* Step two — include code snippets, SQL, or type definitions inline
* Step three — reference existing patterns in the codebase to follow

### Data Structures / Schema

When the issue involves data models, tables, types, or configs, include them as tables:

| Field | Type | Description |
|---|---|---|
| `field_name` | `type` | What it does |

### Code / SQL / Config

Include full code blocks for any non-trivial implementation detail — SQL migrations, type definitions, decorator usage, config snippets. Use fenced blocks with language identifiers:

\```sql
-- Example: migration SQL
\```

\```typescript
// Example: type definition or decorator usage
\```

## Verification

Checkbox list of concrete tests and checks that prove the issue is done. These should be runnable/observable — not vague goals.

* [ ] Specific test: "INSERT succeeds, UPDATE/DELETE fail with permission error"
* [ ] Integration test: "tenant A cannot SELECT tenant B's data"
* [ ] CLI command output matches expected result
* [ ] UI behavior: "clicking X shows Y"

## Blocked by

* ROV-XX (description) — only if there are actual dependencies

## Does NOT Change

* List things explicitly out of scope to prevent scope creep
* Especially important for issues that touch shared infrastructure

## Ref

Links to design docs, related issues, or external resources.
```

## Title Conventions

- Imperative mood: "Add X", "Fix Y", "Implement Z" — not "Added" or "Adding"
- Include scope when useful: "Build impersonation UI — banner + write toggle"
- Keep under 80 characters
- Never use the word "school" — always "institute"

## Creating Issues from a PRD

When translating a PRD or design doc into issues:

1. **One issue per deployable unit of work** — each issue should be independently implementable and testable. Don't create issues so granular they can't be worked on alone, but don't combine unrelated work.
2. **Preserve PRD detail** — copy relevant schema tables, SQL, code examples, and specs directly into the issue description. The implementer may not have the PRD open.
3. **Set dependency chains** — use `blockedBy`/`blocks` to encode the order from the PRD's phases. First issue in a chain has no blockers; subsequent issues block on their prerequisites.
4. **Map PRD sections to issues** — each major implementation step, data model, or component in the PRD typically becomes one issue. Don't lose detail by over-summarizing.
5. **Include PRD section references** — add a `## Ref` section linking back to the relevant PRD section (e.g., "Audit Logging PRD — Section 3.1 Schema").

## Quality Checklist

Before creating an issue, verify:
- [ ] Title is clear and actionable without reading the description
- [ ] Description has enough context for someone unfamiliar to start work
- [ ] Steps/changes reference specific files or modules, not vague areas
- [ ] Schema/data tables are included when the issue involves data models
- [ ] Code blocks (SQL, TypeScript, config) are included for non-trivial implementation details
- [ ] Verification section has specific, testable checkbox items
- [ ] "Does NOT Change" is set for issues touching shared code
- [ ] Dependency relations (`blockedBy`/`blocks`) are set correctly
- [ ] Labels are chosen from existing Linear labels (never invented)
- [ ] No occurrences of "school" anywhere in the issue
- [ ] Code snippets use fenced blocks with language identifiers
