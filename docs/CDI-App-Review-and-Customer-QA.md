# CDI (Compensation Decision Intelligence) - App Review & Customer Q&A

**Prepared for:** Prospective customer demo
**Date:** 19 February 2026
**Product:** ReasonGrid CDI - Pay Intelligence Platform

---

## 1. App Review Summary

CDI is a governance platform for managing pay decisions with EU Pay Transparency Directive alignment. It provides structured, defensible pay decision documentation, automated gender pay gap monitoring, and a comprehensive audit trail.

### Feature Status Overview

| Area | Status | Notes |
|------|--------|-------|
| Auth & RBAC | Complete | 5 roles, JWT, org-scoped multi-tenancy |
| Employee Directory | Complete | Search, filter, detail views, data history |
| CSV Import | Complete | AI-assisted column mapping, normalization, snapshots |
| Pay Decision Workflow | Complete | DRAFT > PENDING_REVIEW > APPROVED > FINALISED |
| Rationale Library | Complete | Versioned, org-scoped, frozen at decision time |
| Risk Analysis (Pay Gap) | Complete | Gender gap detection, 5% threshold, drilldowns |
| Policy Rules Engine | Complete | 5 check types, WARNING/BLOCK severity |
| Audit Trail | Complete | 18 action types, full metadata |
| Dashboard | Complete | Metrics, charts, AI insights |
| Notifications | Complete | In-app workflow alerts |
| Salary Ranges | Complete | Compa ratio, position-in-range, coverage checker |
| Admin / Multi-tenant | Complete | Organisation + user management |
| PDF Reports | Not yet built | Endpoints exist but return 501 |
| Discovery Bundle Export | Not yet built | Planned for future release |

### Architecture

- **Frontend:** Angular 21 (standalone components, Angular Material, RxJS)
- **API:** Node.js + Express + TypeScript (45 endpoints across 12 routers)
- **Database:** PostgreSQL with Prisma ORM (20 models)
- **Auth:** JWT with role-based access control
- **Shared:** Zod schemas for request/response validation

---

## 2. Potential Customer Q&A

### General / Value Proposition

**Q: What problem does CDI solve?**

CDI helps HR and Total Rewards teams document, govern, and audit pay decisions in a structured, defensible way. It provides automated gender pay gap monitoring at the comparator group level - aligned with the EU Pay Transparency Directive's 5% threshold - while ensuring every decision is traceable to objective rationale, an accountable owner, and an approver.

**Q: Does CDI make us compliant with the EU Pay Transparency Directive?**

CDI supports your compliance efforts by providing the tools and structure needed - structured rationales, immutable audit trails, automated gap detection, and accountability tracking. It highlights areas that may require review but does not certify compliance or constitute legal advice. You will still need legal counsel for formal compliance assessments.

**Q: Is this a recommendation engine? Will it tell us what to pay people?**

No. CDI is a governance and documentation tool. It never recommends pay actions or auto-generates rationales. Every decision and rationale is human-authored. The system's role is to structure, preserve, and monitor - not to decide.

**Q: Who is the typical user of CDI?**

CDI is designed for HR and Total Rewards teams. Typical users include HR Managers who import data and manage pay decisions, Managers who create draft decisions for their teams, and Admins who configure the rationale library and policy rules. There is also a read-only Viewer role for stakeholders who need visibility without edit access.

---

### Employee Data & Imports

**Q: How do we get our employee data into the system?**

CSV upload with an intelligent mapping wizard. You upload a file, the system auto-detects columns (with AI-enhanced suggestions), you confirm the mapping, and it imports. It normalises country codes (e.g. "France" to "FR"), parses salary formats, and can annualise monthly/weekly pay. Re-imports update existing employees by ID without losing pay decision history.

**Q: What happens to historical employee data when we re-import?**

Every import creates an immutable snapshot of each employee's data at that point in time. The "current" employee record updates, but all previous snapshots are preserved. You can view the full data history timeline on any employee's detail page, including change indicators showing what shifted between imports.

**Q: What employee fields does CDI track?**

Core fields include: Employee ID, Role Title, Job Family, Level, Country, Location, Currency, Base Salary, Bonus Target, LTI Target, Hire Date, Employment Type, Gender (for risk analysis), and Performance Rating. All fields are captured in immutable snapshots at import and decision time.

**Q: Can we connect to our HRIS directly?**

Not in the current version - CSV is the primary import method. The architecture supports adding HRIS connectors in a future phase.

---

### Pay Decisions

**Q: Walk me through how a pay decision gets recorded.**

From an employee's detail page, you create a new decision selecting the type (promotion, annual increase, adjustment, etc.), enter before/after pay, select one or more rationales from your organisation's library, add supporting context, and assign an owner and approver. It saves as a draft, then follows a review workflow: submitted, then approved (or returned for edits), then finalised. Once finalised, the record is permanently locked.

**Q: What types of pay decisions can be recorded?**

Five decision types: New Hire, Promotion, Adjustment, Annual Increase, and Other. Each decision captures the full pay change (base, bonus, LTI), the rationale behind it, supporting evidence, and clear accountability (owner and approver).

**Q: What do you mean by "immutable"? Can we never fix a mistake?**

Once a pay decision is finalised, it cannot be edited or deleted - this is by design for audit integrity. If a correction is needed, you would create a new adjustment decision referencing the original. Draft and pending decisions can still be edited freely.

**Q: What data is frozen when a decision is finalised?**

A complete snapshot of the employee's data at decision time - salary, role, level, location, tenure, compa ratio, position in salary range, promotion history, and recent increase history. The rationale definitions used are also frozen as snapshots. This means even if definitions or employee data change later, the decision record reflects exactly what was known at the time.

**Q: What is the approval workflow?**

Decisions follow a structured workflow: Draft (created by manager or HR), then Submitted for Review (triggers policy evaluation checks), then either Approved or Returned with feedback. Approved decisions can then be Finalised (locked permanently). Notifications are sent at each stage to the relevant parties.

**Q: What are policy evaluation checks?**

When a pay decision is submitted for review, the system automatically evaluates it against configurable policy rules. Five check types are available: gender gap impact, salary range compliance, peer median deviation, historical consistency, and change magnitude. Each can be set to WARNING (proceed with acknowledgement) or BLOCK (prevents submission until resolved).

---

### Rationale Library & Governance

**Q: What rationales come out of the box?**

Nine defaults aligned to common objective criteria: Seniority/Tenure, Relevant Experience, Performance History, Scope of Role, Market Conditions, Geographic Factors, Internal Equity Alignment, Promotion into Higher Responsibility, and Temporary Adjustment. These are categorised as Structural, Market, Performance, or Temporary.

**Q: Can we customise the rationale library?**

Yes. Your HR managers and admins can create new rationale definitions, edit existing ones (which creates a new version - the old version is preserved), and archive rationales no longer in use. Each organisation maintains its own library. Rationales that have been used in decisions cannot be deleted - only archived - ensuring the audit trail remains intact.

**Q: How does versioning work for rationales?**

Editing a rationale creates a new version (v1, v2, etc.). The previous version is marked with an end date and preserved. Every pay decision stores a frozen snapshot of the rationale text as it existed when the decision was made. You can view the full version history timeline for any rationale code.

**Q: Why is rationale governance important for EU Pay Transparency?**

The EU Pay Transparency Directive requires that pay differences between employees doing equal or equal-value work are justified by objective, gender-neutral criteria. CDI's rationale library provides a vetted set of objective criteria that decision-makers must select from, creating a structured and auditable record of why each pay decision was made.

---

### Risk Analysis / Pay Gap Monitoring

**Q: How does the pay gap detection work?**

The system groups employees into comparator groups by country + job family + level. Within each group, it compares the median base salary of women vs men. If fewer than 3 people exist per gender, it falls back to mean and flags "low sample size". The gap is classified into three tiers:

- **Under 4%:** Within expected range (green)
- **4% to under 5%:** Requires review (amber)
- **5% or above:** Threshold alert (red) - aligned with the EU Directive's 5% trigger

**Q: When does the risk analysis run?**

Three triggers: (1) automatically after every CSV import completes, (2) automatically when a pay decision is finalised, and (3) on a nightly schedule. You can also trigger it manually from the dashboard.

**Q: Can I drill into a specific risk group?**

Yes. From the risk dashboard, clicking a group shows the employees in that group with their salary data, gender distribution, and recent pay decisions affecting those employees.

**Q: Does the system tell us how to fix a pay gap?**

No. CDI highlights groups that may require review - it does not prescribe remediation. The language is deliberately neutral: "requires review" and "threshold alert", never "non-compliant" or "fix". This is a governance tool, not a compliance certification tool.

**Q: How does the 5% threshold relate to the EU Directive?**

The EU Pay Transparency Directive requires employers to take action when a gender pay gap of 5% or more exists within a category of workers and cannot be justified by objective, gender-neutral criteria. CDI's risk analysis uses this same 5% threshold as its alert trigger, helping organisations proactively identify groups that may need attention before formal reporting obligations arise.

**Q: Is there AI-powered analysis of the risk data?**

Yes. CDI can generate narrative AI risk reports that summarise the key findings from the latest risk analysis run. These reports highlight the most critical groups, trends, and potential areas of concern in plain language. Report history is preserved for audit purposes.

---

### Salary Ranges & Compa Ratio

**Q: What are salary ranges used for?**

Salary ranges define the expected pay band (min, mid, max) for each combination of country, job family, and level. When a pay decision is created, the system automatically calculates the employee's compa ratio (salary vs midpoint) and position in range, freezing this context on the decision snapshot. This helps evaluators understand whether the proposed pay is within expected boundaries.

**Q: How do we know which groups are missing salary ranges?**

The salary ranges settings page includes a coverage checker that identifies employee comparator groups without defined ranges. These are displayed as warning chips with the employee count, and you can create a range directly from the alert.

---

### Audit & Compliance

**Q: What gets logged in the audit trail?**

Every significant action: employee creates/updates/imports, pay decision creates/edits/status changes/finalisations, import starts/completions/failures, risk run triggers/completions, rationale changes, and user logins. Each entry records the user, timestamp, entity affected, and metadata including field-level change details (old to new values).

**Q: Who can see the audit log?**

Admins and HR Managers. The audit log page includes a compliance disclaimer: "This log supports internal governance and transparency requirements. It does not constitute legal advice."

**Q: Can we export audit data for regulators?**

The API supports querying audit logs by entity type, entity ID, action type, and user. PDF/export functionality for formal discovery bundles is planned but not yet available in the current version.

**Q: How does CDI support regulatory inspections or audits?**

CDI provides several features that support regulatory readiness:

1. **Structured, defensible pay decisions** - every decision must include objective rationale categories from a vetted library
2. **Immutable audit trail** - finalised decisions and their associated employee data snapshots cannot be modified
3. **Risk analysis** - automated gender pay gap detection at the comparator group level with 5% threshold alerts
4. **Accountability tracking** - every decision records an owner and approver
5. **Data history preservation** - snapshot-based model ensures no data is overwritten or lost
6. **Comprehensive audit logging** - all significant actions are timestamped and recorded with full metadata

---

### Security & Access Control

**Q: What roles are available?**

Five roles: **Super Admin** (platform-level management), **Admin** (full org access including policy and rationale configuration), **HR Manager** (import, decisions, risk, rationale management), **Manager** (view employees, create draft decisions), and **Viewer** (read-only across the board).

**Q: Is data isolated between organisations?**

Yes. Every query is scoped to the user's organisation. Data is never shared across tenants. The database enforces this at the constraint level with org-scoped unique indexes.

**Q: Can managers only see their own team's employees?**

The role structure supports team-based scoping, but in the current version Managers can see all employees in their organisation. Team-based visibility scoping is architecturally planned for a future release.

---

### Dashboard & Reporting

**Q: What does the dashboard show?**

The dashboard provides a consolidated overview: total employees (with/without decisions), pay decision metrics by status and type, risk group distribution (green/amber/red), active rationale count, recent pay decisions with change percentages, an activity feed timeline, and AI-generated risk insights when available.

**Q: Can we generate reports?**

Report endpoints exist in the architecture for Employee Snapshot and Pay Decision Summary reports. PDF generation is planned for a future release. All underlying data is available through the UI and API.

---

### Technical / Deployment

**Q: Where is CDI hosted?**

CDI is a web application accessible via browser. The frontend is deployed as a static site and the API runs on cloud infrastructure with a managed PostgreSQL database. All data is encrypted in transit (HTTPS).

**Q: What browsers are supported?**

CDI is built with Angular and Angular Material, supporting all modern browsers (Chrome, Firefox, Safari, Edge).

**Q: How is data backed up?**

The database is managed PostgreSQL with automated backups. The immutable snapshot model means historical data is never overwritten, providing an additional layer of data preservation.

---

### Pricing & Onboarding (Placeholder)

**Q: How long does it take to get started?**

Once you have your employee data in CSV format, you can upload and start recording pay decisions immediately. The intelligent mapping wizard handles most column detection automatically. Default rationale definitions and policy rules are provided out of the box and can be customised to your organisation's needs.

**Q: Can we trial the system?**

*(To be confirmed by sales team)*

---

## 3. Demo Seed Data Summary

The system comes pre-loaded with realistic demo data:

- **25 employees** across Ireland, Germany, and France
- **8 comparator groups** including one with a **5.4% gender pay gap** triggering a threshold alert
- **8 finalised pay decisions** with rationale snapshots and full approval workflow
- **5 salary ranges** across 3 countries
- **9 default rationale definitions** across 4 categories
- **5 policy rules** pre-configured with sensible defaults

### Demo Accounts

| Email | Role | Password |
|-------|------|----------|
| superadmin@cdi.local | Super Admin | SuperAdmin123! |
| admin@cdi.local | Admin | Admin123! |
| hr@cdi.local | HR Manager | HrManager123! |
| manager1@cdi.local | Manager | Manager123! |
| manager2@cdi.local | Manager | Manager123! |

---

*This document was prepared based on a full review of the CDI V2 codebase (frontend, API, and database schema) as of 19 February 2026.*
