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

### 3) Rationale Library
A fixed, legally vetted list of objective, gender-neutral reasons.
Users must pick from this list (multi-select allowed).

MVP rationale options (enum + display labels):
- SENIORITY_TENURE — "Seniority / tenure"
- RELEVANT_EXPERIENCE — "Relevant experience"
- PERFORMANCE_HISTORY — "Performance history"
- SCOPE_OF_ROLE — "Scope of role"
- MARKET_CONDITIONS — "Market conditions"
- GEOGRAPHIC_FACTORS — "Geographic factors"
- INTERNAL_EQUITY_ALIGNMENT — "Internal equity alignment"
- PROMOTION_HIGHER_RESPONSIBILITY — "Promotion into higher responsibility"
- TEMPORARY_ADJUSTMENT — "Temporary adjustment"

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

## Implementation notes
- Keep copy neutral and audit-safe; avoid legal advice language.
- Treat risk as "requires review" not "non-compliant".
- Preserve historical truth: pay decisions are timestamped and immutable once finalised.
- Build for extensibility: HRIS connectors later, more comparator logic later (equal-value scoring).

