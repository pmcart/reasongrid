# claude.md — Compensation Decision Intelligence (CDI) MVP

You are working in this repo to build the CDI MVP. This file is the **source of truth** for what to build and how it should behave.

## Purpose (in plain language)
CDI helps HR/Total Rewards teams:
- Upload employee pay data (CSV-first)
- Normalize it into a standard structure
- Record **structured, defensible** pay decisions per employee
- Automatically monitor pay gap risk aligned to EU Pay Transparency requirements (not legal advice)

**CDI does NOT** recommend pay actions, auto-generate rationales, or certify compliance.

---

## Tech stack (intended)
- Frontend: Angular (standalone components), RxJS, Angular Material (or another consistent component kit) with icons
- API: Node.js + TypeScript (Express is fine—prefer a modular structure)
- DB: Postgres
- ORM: Prisma
- Auth: email/password for MVP (JWT), RBAC enforced on API

## Repo structure (recommended)
- /apps/web            Angular app
- /apps/api            Node/TS API
- /packages/shared     Shared types (Zod schemas + TS types)
- /docs                Product + engineering docs (source of truth)
- /prisma              Prisma schema + migrations

If the repo differs, follow the repo’s existing conventions.

---

## High-level MVP flow
1) Manager/HR uploads a CSV containing employee info (name, id, role, level, location, salary, etc.)
2) The system **assists** with mapping and normalization into a standard CDI format
3) Employees appear in an Employee Directory; each employee has an Employee Detail view
4) From Employee Detail, users create **Pay Decision Records** (structured rationale + evidence + accountability)
5) A **Risk Analysis Engine** runs periodically and on key events to detect pay gap risks (5% threshold logic)
6) Users view risk results in a simple dashboard and can drill into groups/impacted employees/decisions

---

## Core product concepts and rules

### 1) Employee
A person record imported from CSV (MVP) with standardized fields.

**Key rule:** Employee records are the base layer. Pay decisions attach to employees.

Minimum employee fields (MVP):
- employeeId (string, unique)
- fullName (string) — may be hidden behind role permissions later, but store for MVP
- roleTitle (string)
- jobFamily (string | null)
- level (string)
- country (string) — normalized to ISO (e.g., "IE", "FR") if possible
- location (string | null) — city/site
- currency (string) — ISO currency code (e.g., "EUR")
- baseSalary (number) — normalized to annualized numeric value in currency
- bonusTarget (number | null) — optional
- ltiTarget (number | null) — optional
- hireDate (date | null)
- employmentType (string | null) — optional
- gender (string | null) — optional; ensure privacy-safe access controls
- performanceRating (string | null) — optional

### 2) Pay Decision Record (PDR)
An immutable record of a single pay event for an employee.

Decision types (enum):
- NEW_HIRE
- PROMOTION
- ADJUSTMENT
- ANNUAL_INCREASE
- OTHER

PDR must capture:
- employeeId (FK)
- decisionType
- effectiveDate
- payBefore (base/bonus/lti)
- payAfter (base/bonus/lti)
- rationaleSelections (1+ from Rationale Library)
- supportingContext (short factual text)
- evidenceReference (optional string)
- accountableOwnerUserId (FK)
- approverUserId (FK)
- status: DRAFT | FINALISED
- timestamps + audit fields

**Immutability rule:** When status becomes FINALISED, record becomes read-only.

### 3) Rationale Library (Rationale Governance)
Rationale definitions are **database-driven, versioned, org-scoped records** stored in the `RationaleDefinition` table. They replace the original hardcoded Rationale enum.

Users must pick from the active rationale library when creating pay decisions (multi-select allowed).

**Key rules:**
- **Versioned and immutable:** Editing a rationale definition creates a new version. The previous version gets `effectiveTo` set and is preserved for audit.
- **Snapshot at decision time:** Each `PayDecisionRationale` stores a `rationaleSnapshot` JSON — a frozen copy of the definition text, category, and metadata at the moment the pay decision was created.
- **Cannot delete with history:** Rationale definitions cannot be deleted if any PayDecisionRationale references them. They can be archived instead.
- **Org-scoped:** Each organisation maintains its own rationale library.

**RationaleCategory enum:** STRUCTURAL, MARKET, PERFORMANCE, TEMPORARY, OTHER

**RationaleStatus enum:** ACTIVE, ARCHIVED

**RationaleDefinition fields:**
- code (UPPER_SNAKE_CASE, stable across versions)
- name, legalDescription, plainLanguageDescription
- category (RationaleCategory)
- objectiveCriteriaTags (JSON string[]), applicableDecisionTypes (JSON DecisionType[])
- jurisdictionScope (JSON string[] of ISO country codes)
- requiresSubstantiation (boolean)
- version (int), effectiveFrom, effectiveTo
- status (ACTIVE/ARCHIVED)
- Unique constraint: (organizationId, code, version)

**Default rationale definitions (seeded as v1):**
- SENIORITY_TENURE — Structural — "Seniority / tenure"
- RELEVANT_EXPERIENCE — Structural — "Relevant experience"
- PERFORMANCE_HISTORY — Performance — "Performance history"
- SCOPE_OF_ROLE — Structural — "Scope of role"
- MARKET_CONDITIONS — Market — "Market conditions"
- GEOGRAPHIC_FACTORS — Market — "Geographic factors"
- INTERNAL_EQUITY_ALIGNMENT — Structural — "Internal equity alignment"
- PROMOTION_HIGHER_RESPONSIBILITY — Structural — "Promotion into higher responsibility"
- TEMPORARY_ADJUSTMENT — Temporary — "Temporary adjustment"

**API endpoints:**
- GET /rationale-definitions — List active definitions (latest version per code). Filters: status, category
- GET /rationale-definitions/:id — Single definition by ID
- GET /rationale-definitions/code/:code/history — All versions for a code
- POST /rationale-definitions — Create new definition (HR_MANAGER, ADMIN)
- PUT /rationale-definitions/:id — Edit creates new version (HR_MANAGER, ADMIN)
- POST /rationale-definitions/:id/archive — Archive (ADMIN only)
- DELETE /rationale-definitions/:id — Hard delete only if zero historical usage (ADMIN only)

**Frontend:**
- Rationale Library page at `/rationale-library` (ADMIN/HR_MANAGER only)
- Create/edit dialog with version notice
- Version history timeline at `/rationale-library/:code/history`
- Pay decision form fetches rationales from API, grouped by category in dropdown

**Future phases (not yet implemented):**
- Substantiation requirements engine (required data validation, conditional requirements, soft/hard enforcement)
- Jurisdictional controls (enable/disable rationales per country, lock mode)
- Governance monitoring dashboard (usage analytics, drift alerts)

### 4) Risk Analysis (Risk Radar)
A background process that calculates pay gap risk in **comparator groups**.

Comparator Group definition (MVP):
- country + jobFamily + level
  - If jobFamily is null, group by country + level + roleTitle as fallback
  - Provide deterministic grouping rules

Risk logic (MVP):
- Compute gender pay gap % per comparator group
- Gap metric: compare median baseSalary for women vs men (if both exist)
  - If median not possible (small N), fallback to mean and flag "low sample"
- Risk thresholds:
  - WITHIN_EXPECTED_RANGE: gap < 4%
  - REQUIRES_REVIEW: gap >= 4% and < 5%
  - THRESHOLD_ALERT: gap >= 5%

Outputs:
- group id + grouping fields
- counts by gender
- gapPct
- riskState
- computedAt timestamp
- notes: e.g. "insufficient data", "low sample size"

**Important:** Risk output should be framed as "may require review" — not "non-compliant".

When risk runs:
- On employee CSV import completion
- On Pay Decision finalisation
- Scheduled periodic run (e.g., nightly)

---

## Security, auth, and RBAC (MVP)
Auth:
- Email/password login
- JWT access token
- Basic password hashing (bcrypt)

RBAC roles (enum, MVP):
- ADMIN
- HR_MANAGER
- MANAGER
- VIEWER

Permissions (minimum):
- ADMIN: everything
- HR_MANAGER: import CSV, view employees, create/approve/finalise pay decisions, view risk dashboard, export reports
- MANAGER: view employees they have access to, create DRAFT pay decisions, view own team risk summaries (if scoped)
- VIEWER: read-only employees + decisions + risks (no edits)

For MVP, access scoping can be simplified:
- HR_MANAGER sees all
- MANAGER sees all (if scoping not yet built), but structure code to support scoping later

---

## Data import & normalization (CSV-first MVP)

### UX expectations
- User uploads CSV
- System shows "mapping screen":
  - Detect columns
  - Suggest mapping to standard fields
  - Allow manual override
- After confirmation, import runs and produces:
  - Created/updated employee count
  - Errors and rows that failed validation

### "AI normalization" for MVP (practical approach)
Implement "AI normalization" as **assisted mapping + normalization**:
- Column name matching + heuristics
- Value normalization rules:
  - country: map "France"/"FR" -> "FR"
  - currency: infer if present; default configurable per org
  - salary: remove commas/symbols; parse number
  - annualization: if a "salaryPeriod" column exists (monthly/weekly), convert to annual; otherwise assume annual

Optional: keep a placeholder service interface for LLM-based enhancement later:
- `NormalizationService` with a `suggestMappings()` method
- For now, implement deterministic logic; do not call external LLMs unless configured

### Import idempotency
- Use employeeId as natural key
- On re-import:
  - Update employee fields
  - Preserve pay decisions (do not overwrite history)
  - Maintain `updatedAt`

---

## UX screens (MVP)

### Web app pages
1) Auth: login + basic user management (ADMIN only)
2) Employee Directory
   - Search, filter (country, job family, level)
   - Row click -> Employee Detail
3) Employee Detail
   - Overview card
   - Pay History timeline/table
   - CTA: "Record Pay Decision"
4) Record Pay Decision (modal or page)
   - prefilled current pay + job context
   - pay change inputs
   - rationale multi-select
   - supporting context + evidence reference
   - owner + approver assignment
   - save as DRAFT
   - finalisation flow with confirmation modal
5) Risk Dashboard (Pay Gap Overview)
   - list of comparator groups with riskState
   - filters
   - drilldown view per group: distribution summary + impacted employees + recent decisions
6) Imports
   - upload + mapping UI
   - import history + error exports

### Copy/tone rules
- Neutral, factual, audit-safe
- Avoid: "ensure compliance", "fix", "non-compliant"
- Prefer: "supports", "documents", "highlights", "requires review"
- Always show disclaimer text in Reports and Regulatory pages:
  - "This information supports internal governance and transparency requirements. It does not constitute legal advice."

---

## Reporting (MVP)
Generate server-side PDFs (or HTML->PDF) for:
1) Employee Snapshot
   - employee context, pay position, factors (rationale categories)
   - no peer data
2) Pay Decision Summary
   - decisions in a date range grouped by decision type and rationale
3) Discovery Bundle (export zip)
   - selected pay decision record
   - rationale definitions at that time
   - evidence references

MVP can ship with:
- Employee Snapshot + Pay Decision Summary
- Discovery Bundle can be a zip of JSON + PDF (simple)

---

## Database & Prisma guidance

### Suggested Prisma models (minimum)
- User (id, email, passwordHash, role, createdAt, updatedAt)
- Employee (id, employeeId unique, fullName, roleTitle, jobFamily, level, country, location, currency, baseSalary, bonusTarget, ltiTarget, gender, hireDate, performanceRating, createdAt, updatedAt)
- PayDecision (id, employeeId FK, decisionType, effectiveDate, payBeforeBase, payAfterBase, payBeforeBonus, payAfterBonus, payBeforeLti, payAfterLti, supportingContext, evidenceReference, status, ownerUserId, approverUserId, finalisedAt, createdAt, updatedAt)
- PayDecisionRationale (payDecisionId FK, rationale enum) — many-to-many or join table
- ImportJob (id, uploadedByUserId, status, createdCount, updatedCount, errorCount, mappingJson, errorReportPath, createdAt, updatedAt)
- RiskRun (id, triggeredBy, startedAt, finishedAt, status)
- RiskGroupResult (id, riskRunId FK, country, jobFamily, level, roleTitleFallback, groupKey, womenCount, menCount, gapPct, riskState, notes, computedAt)

Indexing:
- Employee: employeeId unique; (country, jobFamily, level)
- PayDecision: employeeId; status; effectiveDate
- RiskGroupResult: groupKey; riskState; computedAt

---

## API (Node/Express) requirements

### REST endpoints (MVP)
Auth:
- POST /auth/login
- POST /auth/register (ADMIN only) or seed users

Employees:
- GET /employees (filters: country, jobFamily, level, q)
- GET /employees/:id
- PATCH /employees/:id (HR_MANAGER+ only; keep minimal)
- POST /imports/employees/csv (upload + begin mapping)
- POST /imports/:importId/confirm-mapping (start import)
- GET /imports (history)
- GET /imports/:id (details + errors)

Pay decisions:
- GET /employees/:id/pay-decisions
- POST /employees/:id/pay-decisions (create DRAFT)
- PATCH /pay-decisions/:id (edit if DRAFT only)
- POST /pay-decisions/:id/finalise (lock)
- GET /pay-decisions/:id

Risk:
- POST /risk/run (HR_MANAGER+; manual trigger)
- GET /risk/latest (latest run summary)
- GET /risk/groups (filters: riskState, country, jobFamily, level)
- GET /risk/groups/:groupKey (drilldown)

Salary Ranges:
- GET /salary-ranges (list all for org)
- POST /salary-ranges (HR_MANAGER+)
- PATCH /salary-ranges/:id (HR_MANAGER+)
- DELETE /salary-ranges/:id (ADMIN only)

Reports:
- GET /reports/employee-snapshot/:employeeId (PDF)
- GET /reports/pay-decision-summary (PDF; date range)

Validation:
- Use Zod schemas in `/packages/shared` for request/response types
- Enforce RBAC at the API layer

---

## Frontend (Angular) requirements

Principles:
- Use standalone components
- Use RxJS for data streams + state
- Use a consistent component library (Angular Material ok)
- Strict typing with shared Zod-derived TS types

Suggested feature modules (folders):
- auth/
- employees/
- pay-decisions/
- imports/
- risk/
- reports/
- shared-ui/

State management:
- Keep it simple (services + RxJS); no heavy store unless needed

---

## Background jobs / scheduling
Implement a simple scheduler in the API (MVP):
- A cron-like job (node-cron) runs nightly to compute risk
- Also run risk computation on:
  - successful import completion
  - pay decision finalisation

Ensure risk computations are idempotent:
- Store each run
- Mark latest run pointer or query by newest computedAt

---

## Non-goals / out of scope (MVP)
- HRIS API connectors (post-MVP)
- AI-generated rationales or narrative explanations
- Automated pay recommendations or remediation
- Budget planning / approvals workflows beyond owner+approver fields
- Candidate-facing explanations
- Full performance review ingestion

---

## Definition of Done (MVP)
The MVP is complete when:
- Users can log in and see employees
- CSV upload + mapping imports employees reliably
- Users can open an employee and create pay decisions
- Pay decisions can be finalised and become immutable
- Risk runs automatically and produces group-level results with 5% threshold alerts
- Risk dashboard shows current risk state and drilldowns
- At least one report (Employee Snapshot) can be exported

---

## Employee Snapshots (Immutable Data History)

CDI uses an **immutable snapshot model** for employee data. Instead of only maintaining a "current state" Employee record, every CSV import creates a point-in-time `EmployeeSnapshot` — an immutable copy of all employee fields at the moment of import.

### Why snapshots matter
Pay decisions are made based on the employee data available at the time. When decisions are later audited or challenged, the system must prove what data informed the decision. Snapshots provide this evidence chain.

### How it works
- **Employee table** remains the "current state" view for directory, filtering, and day-to-day use
- **EmployeeSnapshot table** stores immutable copies, linked to the ImportJob that created them
- Each CSV import creates one snapshot per employee row processed
- Every pay decision creates a **fresh snapshot** at decision time (never reuses old snapshots)
- CSV imports also create snapshots (raw employee data only, no computed context)

### Key rules
- Snapshots are **never modified** after creation
- `importJobId` is nullable — snapshots created for pay decisions have null importJobId
- The `snapshotAt` field records when the data was captured
- The pay decision detail view shows "Employee Context at Decision Time" using the linked snapshot
- If the current employee data differs from the snapshot, a drift indicator is shown

### EmployeeSnapshot fields
**Raw employee fields**: id, employeeId (FK), importJobId (FK, nullable), organizationId, employeeExternalId, roleTitle, jobFamily, level, country, location, currency, baseSalary, bonusTarget, ltiTarget, hireDate, employmentType, gender, performanceRating, snapshotAt, createdAt

**Computed context fields** (populated at pay decision time, null for import-only snapshots):
- `tenureYears` (Float?) — years since hireDate, frozen at decision time
- `compaRatio` (Float?) — baseSalary / salary range midpoint (null if no matching range)
- `positionInRange` (Float?) — (baseSalary - min) / (max - min) as 0-1 value (null if no matching range)
- `comparatorGroupKey` (String?) — `country:jobFamily:level` or `country:level:roleTitle` fallback
- `priorPromotionCount` (Int?) — count of FINALISED PROMOTION decisions at decision time
- `lastPromotionDate` (DateTime?) — date of most recent promotion (null if none)
- `priorIncreaseCount` (Int?) — count of FINALISED ANNUAL_INCREASE/ADJUSTMENT decisions in last 24 months
- `priorIncreaseTotalPct` (Float?) — sum of % increases in last 24 months

### Decision Context Computation
Implemented in `apps/api/src/services/snapshot-context.ts`. Called when creating a pay decision.
- Only FINALISED decisions count toward promotion/increase history
- Gender is captured in the snapshot for risk modelling but not shown in manager-facing UI
- Compa ratio requires salary range data in the SalaryRange table

---

## Audit Trail

All significant actions are logged to an `AuditLog` table for compliance and traceability.

### AuditAction enum
- EMPLOYEE_CREATED, EMPLOYEE_UPDATED, EMPLOYEE_IMPORTED
- PAY_DECISION_CREATED, PAY_DECISION_UPDATED, PAY_DECISION_FINALISED
- IMPORT_STARTED, IMPORT_COMPLETED, IMPORT_FAILED
- RISK_RUN_TRIGGERED, RISK_RUN_COMPLETED
- USER_LOGIN

### AuditLog fields
id, organizationId, userId (nullable for system actions), action, entityType, entityId, metadata (JSON), ipAddress, createdAt

### API endpoints
- GET /audit — Paginated audit log (ADMIN/HR_MANAGER only), filterable by entityType, entityId, action, userId
- GET /audit/entity/:entityType/:entityId — All audit entries for a specific entity

### Implementation
- Audit logging is fire-and-forget: errors are logged but never thrown to avoid disrupting the main flow
- The `logAudit()` service function is used throughout route handlers and services
- Draft pay decision edits log previous field values in metadata for complete edit history

---

## Employee Snapshot API Endpoints

- GET /employees/:id/snapshots — All snapshots for an employee, ordered by snapshotAt desc
- GET /employees/:id/snapshots/latest — Latest snapshot only

---

## Salary Ranges

Org-scoped lookup table used to compute compa ratio and position-in-range for decision context snapshots.

### SalaryRange fields
id, organizationId, country, jobFamily (nullable), level, currency, min, mid, max, createdAt, updatedAt

### Unique constraint
`(organizationId, country, jobFamily, level)` — one range per comparator group per org.

### API endpoints
- GET /salary-ranges — List all ranges for org (any authenticated user)
- GET /salary-ranges/:id — Single range
- POST /salary-ranges — Create (HR_MANAGER, ADMIN)
- PATCH /salary-ranges/:id — Update (HR_MANAGER, ADMIN)
- DELETE /salary-ranges/:id — Delete (ADMIN only)

### Validation
- min < mid < max enforced via Zod refinement (`createSalaryRangeSchema`)
- country: 2-char ISO, currency: 3-char ISO

### How it connects
When a pay decision is created, `computeSnapshotContext()` looks up the matching SalaryRange by (org, country, jobFamily, level). If found, compa ratio and position-in-range are computed and frozen on the snapshot. If not found, those fields are null.

---

## EU Pay Transparency Compliance Approach

CDI supports EU Pay Transparency requirements by providing:

1. **Structured, defensible pay decisions** — every decision must include objective rationale categories from a vetted library
2. **Immutable audit trail** — finalised decisions and their associated employee data snapshots cannot be modified
3. **Risk analysis** — automated gender pay gap detection at the comparator group level with 5% threshold alerts
4. **Accountability tracking** — every decision records an owner and approver
5. **Data history preservation** — snapshot-based import model ensures no data is overwritten or lost
6. **Comprehensive audit logging** — all significant actions are timestamped and recorded

**Important framing:** CDI highlights areas that may require review. It does not certify compliance or provide legal advice.

---

## Implementation notes
- Keep copy neutral and audit-safe; avoid legal advice language.
- Treat risk as "requires review" not "non-compliant".
- Preserve historical truth: pay decisions are timestamped and immutable once finalised.
- Employee data uses snapshot-based model: imports create immutable snapshots, pay decisions link to snapshots.
- Build for extensibility: HRIS connectors later, more comparator logic later (equal-value scoring).

