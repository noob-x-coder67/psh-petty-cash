PAKISTAN SWEET HOME - AFP
MASTER SOFTWARE REQUIREMENTS SPECIFICATION
Petty Cash Management and Monitoring System
Business Requirements • UI/UX System • Technical Architecture • Development Playbook
Version 4.0  |  July 25, 2026

Authoritative Consolidated Baseline
This document supersedes earlier draft SRS, UI/UX, testing, production and finance-validation documents where differences exist. Finance-approved corrections and the latest confirmed operational decisions are controlling.
   Document Control
Field	Detail
Document Title	Pakistan Sweet Home - AFP Master Software Requirements Specification
System	Petty Cash Management and Monitoring System
Version	4.0 - Consolidated Development Baseline
Prepared For	Head Office Finance, Administration and Software Development Team
Prepared By	Requirements and Development Planning Team
Document Date	July 25, 2026
Status	Ready for technical kickoff, backlog creation and controlled development
Confidentiality	Internal use only
Primary Development Assistant	Claude Code through the organization/user Claude Pro subscription
Current Environment	Local development + Vercel free demo + hosted PostgreSQL test database
Future Production	Single Ubuntu VPS with Next.js, NestJS, PostgreSQL and private uploads
Revision History
Version	Date	Purpose
1.0	July 11, 2026	Initial requirements draft
2.0	July 2026	Expanded workflows and controls
3.0	July 2026	Actual PSH workflow, online-only system and hosting clarification
4.0	July 25, 2026	Complete master SRS, latest Finance decisions, modern UI, technical architecture and Claude development playbook
Approval Record
Authority	Name / Designation	Decision	Signature / Date
Head of Finance		Approved / Approved with changes / Not approved	
Administration Head		Approved / Approved with changes / Not approved	
Lead Developer		Requirements received	
Project Sponsor		Development authorization	
  Table of Contents
1. Executive Summary
2. Purpose, Audience and Conventions
3. Business Context and Objectives
4. Organizational Scope and Petty-Cash Unit Model
5. Scope, Boundaries and Constraints
6. Stakeholders, Roles and Responsibilities
7. Confirmed Finance Policies
8. End-to-End Business Workflows
9. Functional Requirements
10. Reporting and Analytics Requirements
11. UI/UX Master Design System
12. Screen-Level UI Specifications
13. Motion, Iconography and Visual Experience
14. Data Model and Database Requirements
15. API and Backend Requirements
16. Security, Privacy and Auditability
17. Non-Functional Requirements
18. Demo and Testing Architecture
19. Production VPS Architecture
20. Migration from Vercel Demo to VPS
21. Testing and Quality Assurance
22. Acceptance Criteria and UAT
23. Implementation Plan and Backlog
24. Claude Pro / Claude Code Development Playbook
25. DevOps, Configuration and Environment Variables
26. Risks, Assumptions and Mitigations
27. Requirements Traceability
Appendices A-J
Navigation Note
The document is intentionally comprehensive. The implementation team should treat requirement IDs, business rules, acceptance criteria and role permissions as binding. Narrative design language explains intent but does not override explicit requirements.
  1. Executive Summary
Pakistan Sweet Home - AFP Head Office at H-9 Islamabad provides physical petty cash to selected centers and project locations for routine, small-value operational expenditure. Locations spend from cash already issued, record the expenditure afterward, justify the business need and attach the available bill. Head Office Finance monitors activity online and uses professional reports instead of re-entering a large monthly physical file into Excel.
Operating Model
Post-spend
No routine pre-approval	Categories
3 only
Building • Vehicle • Other	Operation
Online only
No offline synchronization	UI Direction
No sidebar
Animated finance workspace
1.1 Definitive Product Vision
Build a secure, visually distinctive and exceptionally usable finance workspace that gives Head Office a live and auditable picture of petty-cash issuance, spending, supporting documents, closing balances and three-month compliance across every authorized operating location.
1.2 Non-Negotiable Decisions
• Pakistan Sweet Home Islamabad (PSH-ISB) has no petty-cash account and must never appear in allocation, expense-entry, balance, petty-cash dashboard or petty-cash report selectors.
• Routine expenditure does not require approval before spending. The system records and monitors spending after it happens.
• Every entry requires justification. A bill may contain multiple line items, and the same bill is attached once to the voucher.
• Only Building, Vehicle and Other are available as line-item categories. Other requires a clear explanation.
• There is no multi-stage expense workflow. Saving the entry is sufficient; Finance later marks the receipt Checked or leaves it Unchecked.
• Only Finance Manager and Super Admin may edit recorded financial entries; all before/after values must remain in the audit trail.
• Negative balances are allowed, visibly highlighted and reportable; they are not automatically blocked.
• The system is online-only.
• The first demo uses Vercel free and hosted PostgreSQL. Production later moves to one VPS.
• The application must not use a permanent sidebar. Navigation is top-led, contextual and responsive.
  2. Purpose, Audience and Conventions
2.1 Purpose
This Master SRS defines the full business, functional, data, interface, reporting, security, deployment and development requirements required to build, test, demonstrate, approve and later deploy the system officially.
2.2 Intended Audience
Audience	Use of Document
Head of Finance	Validate controls, reports, balances and policy
Administration	Confirm units, users and operational ownership
Lead Developer	Plan architecture, modules, APIs and delivery
Frontend / UI Developer	Implement the approved visual and interaction system
Backend Developer	Implement finance logic, permissions and auditability
QA / UAT Team	Design tests and verify acceptance criteria
Claude Code	Use as the authoritative project context and implementation guardrail
System Administrator	Deploy, secure, back up and maintain the system
2.3 Requirement Language
Term	Meaning
MUST / SHALL	Mandatory for acceptance
SHOULD	Expected unless an approved exception exists
MAY	Optional or future-capable
Demo	Temporary free testing environment, not official production
Production	Official operational system on secured VPS
Unit	A center or project location eligible for its own petty-cash account
Receipt Checked	Finance has visually reviewed the attached receipt; this is not an approval status
  3. Business Context and Objectives
3.1 Current Problem
Head Office currently issues cash to operating locations. The location spends during the month, keeps physical bills and later sends a large file. Finance manually re-enters the expenses into Excel. This causes delay, inconsistent descriptions, weak live visibility, repetitive data entry and difficult reporting.
3.2 Target Process
Head Office records cash issuance
        ↓
Authorized location receives cash
        ↓
Location spends for routine operational need
        ↓
User creates one voucher for one bill/payment event
        ↓
User adds one or more line items and justification
        ↓
Bill image/PDF is uploaded once
        ↓
Balance and reports update immediately
        ↓
Finance views receipt and marks Checked
        ↓
Month-end cash count, reports and archive are completed
3.3 Business Objectives
1. Eliminate repeated monthly Excel entry at Head Office.
2. Provide live center/project-level balances and expenditures.
3. Standardize categories to Building, Vehicle and Other.
4. Provide professional, meaningful and highly filterable reports.
5. Preserve complete accountability for every entry, edit, check and deletion.
6. Support monthly closing and the three-month cash-count rule.
7. Allow Finance to inspect and download bills remotely.
8. Create a scalable foundation for additional units without database redesign.
3.4 Success Metrics
Metric	Target
Monthly re-entry at Head Office	Eliminated for system-recorded petty cash
Entry visibility	Available to Head Office immediately after save
Voucher total accuracy	100% line-item total equals bill total
Category standardization	100% line items use one of three categories
Auditability	100% privileged edits have before/after history
Report availability	Core reports exportable to PDF and Excel
Receipt monitoring	Checked/Unchecked visible per voucher
Month compliance	Three-month rule calculated automatically
  4. Organizational Scope and Petty-Cash Unit Model
4.1 Head Office
Pakistan Sweet Home - AFP Head Office, H-9 Islamabad, is the central monitoring, cash-issuance, finance-administration and reporting authority. Head Office itself is not treated as an ordinary petty-cash unit in this system.
4.2 Organizational Units
Type	Operating Unit	Petty-Cash Account	System Treatment
Center	Pakistan Sweet Home Islamabad (PSH-ISB)	NO	Organizational reference only; excluded from all petty-cash operations
Center	Pakistan Sweet Home Cadet College Sohawa	YES	Separate account and ledger
Center	Pakistan Sweet Home Sukkur	YES	Separate account and ledger
Center	Pakistan Sweet Home Bhalwal	YES	Separate account and ledger
Center	Pakistan Sweet Home Center of Excellence, Rehara, Rawalakot, AJK	YES	Separate account and ledger
Project Location	Fatima Tuz Zahra Dastarkhawan - Raja Bazaar, Rawalpindi	YES	Separate account and ledger
Project Location	Fatima Tuz Zahra Dastarkhawan - Liaquat Bagh, Rawalpindi	YES	Separate account and ledger
Project Location	Pakistan Sweet Home Rehabilitation Center - Chakri, Rawalpindi	YES	Separate account and ledger
Project Location	Pakistan Sweet Home Rehabilitation Center - H-9 Islamabad	YES	Separate project-location account; distinct from PSH-ISB
Project / Service	Pakistan Sweet Home Free Burial Service (Safar-e-Akhrat)	YES	Separate account; operational location configurable
Critical Exclusion
PSH-ISB must be excluded by data rule, not merely hidden in the interface. APIs, database constraints, seed data and reports must prevent a petty-cash account from being created for the PSH-ISB organizational-unit code.
4.3 Hierarchy Model
Pakistan Sweet Home - AFP Head Office
├── Centers eligible for petty cash
├── Projects
│   └── Project locations eligible for petty cash
└── Non-petty-cash organizational units
    └── PSH-ISB (reference only)
4.4 Expansion
Super Admin may add new centers, projects or project locations later. A new unit is not automatically petty-cash enabled; Finance must explicitly create and activate a petty-cash account.
  5. Scope, Boundaries and Constraints
5.1 Included in First Release
• Authentication and location-based access
• Organizational-unit management
• Petty-cash account and allocation recording
• Cash receipt confirmation
• Expense voucher with multiple line items
• Three controlled categories
• Bill upload, view and download
• Live balance and negative-balance visibility
• Receipt Checked/Unchecked marker
• Finance/Super Admin controlled editing with audit trail
• Replenishment recording and monitoring
• Monthly cash count and close
• Three-month compliance rule
• Advanced dashboards and reports
• PDF and Excel export
• Monthly bill archive download and deletion control
• Audit logs and administration
• Responsive, animated no-sidebar UI
• Vercel free multi-location demo
• VPS production migration readiness
5.2 Excluded from First Release
• Salary and payroll processing
• Major cheque/bank expense processing
• Direct bank API integration
• Bank reconciliation
• Procurement, quotations and purchase orders
• Full general ledger or double-entry accounting
• Offline transaction entry or synchronization
• Automated OCR and AI accounting classification
• WhatsApp or SMS integration
• Public self-registration
• Petty cash for PSH-ISB
5.3 Constraints
Constraint	Required Response
No paid hosting during demo	Use Vercel free and a free hosted PostgreSQL plan
No paid object storage during demo	Store small temporary bill files in PostgreSQL with strict limits and retention
Online-only	Display connectivity errors and never confirm save before server acknowledgement
No permanent sidebar	Use masthead, workspace tabs, command palette and mobile dock
Finance simplicity	No approval-status maze; Entered + receipt Checked/Unchecked
Future VPS migration	Keep storage abstraction and database portability from day one
  6. Stakeholders, Roles and Responsibilities
6.1 Roles
Role	Scope	Core Responsibilities
Super Admin	All units and settings	Users, roles, units, technical configuration, audited corrections, system health
Head of Finance / Finance Manager	All petty-cash units	Allocations, privileged edits, receipt checks, reports, month close, categories policy, compliance
Finance Officer	All petty-cash units	Monitor entries, view/download bills, mark receipts Checked, prepare reports
Center / Project User	Assigned unit(s)	Record post-spend vouchers, add line items, justify, upload bill, view own ledger
Center / Project In-Charge	Assigned unit(s)	View unit position, enter/confirm physical cash count, support month close
Auditor / Read Only	Authorized scope	View and export data and audit trail without changes
Developer / Support	Technical only	Deploy, diagnose and maintain without silent financial editing
6.2 Access Principles
• Permissions are determined by role plus assigned organizational unit.
• A user may access multiple units only when explicitly authorized.
• Finance and Super Admin may access all petty-cash units.
• PSH-ISB users cannot be assigned a petty-cash account workflow.
• System support access must not bypass audit controls.
6.3 RACI Summary
Activity	Center User	In-Charge	Finance Officer	Finance Manager	Super Admin
Record expense	R	I	I	I	I
Upload bill	R	I	I	I	I
Mark receipt Checked	I	I	R	A	A
Edit recorded entry	I	I	I	A	A
Record allocation	I	I	R	A	A
Enter physical cash	R	A	C	A	I
Close month	I	C	R	A	A
Manage users/units	I	I	I	C	A
Generate reports	C	C	R	A	A
  7. Confirmed Finance Policies
ID	Policy	Rule
BR-001	Post-spend model	No routine approval is required before spending from issued cash.
BR-002	Justification	Every voucher must contain a meaningful operational justification.
BR-003	Voucher basis	One voucher normally represents one bill or payment event.
BR-004	Multiple items	One voucher may contain multiple line items.
BR-005	Total equality	Sum of line items must equal voucher/bill total before save.
BR-006	Categories	Each line item must be Building, Vehicle or Other.
BR-007	Other explanation	Other requires a clear explanation.
BR-008	Receipt review	Finance marks Checked after viewing the receipt; no approval state is created.
BR-009	Privileged editing	Only Finance Manager and Super Admin may edit saved entries.
BR-010	Audit preservation	All edits preserve old and new values, actor, time and reason.
BR-011	Negative balance	Negative balance is allowed and must be visually prominent and reportable.
BR-012	Online-only	All transactions require server confirmation.
BR-013	Three-month rule	A fourth-month deposit/replenishment is blocked or held when the preceding three monthly cash counts/closing balances are incomplete, unless an authorized exception is recorded.
BR-014	Bill retention	Bill files are retained online for one month and deleted only after archive confirmation plus configured grace period.
BR-015	Data retention	Financial and audit data remains permanently after bill-file deletion.
BR-016	PSH-ISB exclusion	PSH-ISB cannot own a petty-cash account.
BR-017	Entry timing	Late/backdated entries are allowed but highlighted and reportable.
BR-018	Missing bill	Where a bill is unavailable, reason is mandatory and entry remains reportable.
BR-019	Original records	Physical document handling may continue; the system avoids re-entry, not necessarily physical filing.
BR-020	No silent deletion	Recorded financial entries cannot disappear without an auditable reversal/deactivation action.
  8. End-to-End Business Workflows
8.1 Cash Allocation
1. Finance selects an eligible petty-cash unit.
2. Finance enters amount, issue date, payment/reference details and remarks.
3. System validates that the unit is petty-cash enabled and is not PSH-ISB.
4. Allocation is written to the unit cash ledger.
5. Unit confirms receipt date and received amount.
6. Dashboard and balance update immediately.
8.2 Expense Entry
1. Authorized user selects own assigned unit.
2. User enters expense date, bill date where applicable, vendor/payee, bill number where available and operational justification.
3. User adds one or more line items.
4. Each line item uses Building, Vehicle or Other.
5. Other requires line-specific explanation.
6. User attaches the bill once.
7. System checks line-item total equals bill total.
8. User saves the entry.
9. Ledger balance updates, including a negative value when applicable.
10. Finance sees the entry as Unchecked until receipt review.
8.3 Receipt Check
1. Finance opens the voucher and views the uploaded bill.
2. Finance clicks Mark as Checked.
3. System records checked_by and checked_at.
4. The marker changes visually across dashboard, ledger and reports.
5. Finance may revert to Unchecked only with an audit reason.
6. Checked means reviewed, not approved or reimbursed.
8.4 Correction
1. Finance Manager or Super Admin opens the saved voucher.
2. User selects Edit and supplies a mandatory reason.
3. System captures a before snapshot.
4. Authorized changes are saved.
5. System recalculates ledger impact and balance.
6. Audit log stores field-level before/after values, actor, timestamp and reason.
8.5 Replenishment
1. Unit or Finance views current balance and spending.
2. System evaluates three preceding monthly cash-count records.
3. When compliant, Finance records or processes replenishment according to policy.
4. When non-compliant, system shows Hold - Three-Month Closing Incomplete.
5. Finance Manager may record an authorized exception with reason.
6. New cash is added to the ledger after receipt confirmation.
8.6 Month Close and Cash Count
1. Unit enters physical cash count for the month.
2. System calculates expected closing balance and variance.
3. In-Charge confirms the count.
4. Finance reviews entries, checked receipts, missing bills, negative balance and variance.
5. Finance records closing remarks.
6. Month is marked Closed by Finance Manager.
7. Closed data remains reportable; privileged correction requires audit reason.
8.7 Bill Archive and Deletion
1. Finance filters a completed month and generates unit-wise or consolidated ZIP archive.
2. System records archive generation and download.
3. Finance confirms archive copied to an official Head Office device/drive.
4. Files become deletion-eligible after confirmation and grace period.
5. Authorized deletion removes file bytes/path but retains voucher metadata and deletion audit record.
  9. Functional Requirements
9.1 Authentication and Session Management
ID	Priority	Requirement
FR-AUTH-001	MUST	Users shall sign in with email/username and password.
FR-AUTH-002	MUST	Passwords shall be hashed using an approved adaptive algorithm.
FR-AUTH-003	MUST	The system shall enforce role and unit authorization on every protected API.
FR-AUTH-004	MUST	Sessions shall expire after configurable inactivity.
FR-AUTH-005	MUST	Repeated failed logins shall be rate limited and logged.
FR-AUTH-006	MUST	Super Admin shall activate, deactivate and reset users.
FR-AUTH-007	SHOULD	Production Head Office accounts should support two-factor authentication.
FR-AUTH-008	MUST	No public registration shall exist.
9.2 Organization and User Administration
ID	Priority	Requirement
FR-ORG-001	MUST	Maintain hierarchical organizational units.
FR-ORG-002	MUST	Maintain a petty_cash_enabled flag per unit.
FR-ORG-003	MUST	PSH-ISB petty_cash_enabled shall be false and protected from change without database migration/explicit super-level control.
FR-ORG-004	MUST	Assign users to one or more authorized units.
FR-ORG-005	MUST	Allow new centers/projects/locations without schema redesign.
FR-ORG-006	MUST	Prevent inactive units from new transactions while retaining history.
FR-ORG-007	MUST	Provide unit codes and display names.
FR-ORG-008	SHOULD	Provide user impersonation only in non-production demo and clearly label it.
9.3 Petty-Cash Accounts and Allocations
ID	Priority	Requirement
FR-CASH-001	MUST	Create one petty-cash account per eligible unit.
FR-CASH-002	MUST	Record allocations with amount, date, reference, remarks and issuer.
FR-CASH-003	MUST	Record recipient confirmation.
FR-CASH-004	MUST	Maintain an append-only cash ledger as the balance source of truth.
FR-CASH-005	MUST	Show opening, received, spent, adjustments and expected balance.
FR-CASH-006	MUST	Allow different allocation amounts per unit.
FR-CASH-007	MUST	Allow negative balance and set a negative-balance indicator.
FR-CASH-008	MUST	Prevent allocation to PSH-ISB.
FR-CASH-009	MUST	Audit allocation edits, reversals and confirmations.
FR-CASH-010	SHOULD	Show low-balance thresholds configured per unit.
9.4 Expense Voucher
ID	Priority	Requirement
FR-EXP-001	MUST	Generate unique human-readable voucher number.
FR-EXP-002	MUST	Require petty-cash unit, expense date, vendor/payee, total and justification.
FR-EXP-003	MUST	Support bill date and vendor bill number where available.
FR-EXP-004	MUST	Support multiple line items.
FR-EXP-005	MUST	Restrict category to Building, Vehicle or Other.
FR-EXP-006	MUST	Require explanation for Other.
FR-EXP-007	MUST	Validate line sum equals voucher total.
FR-EXP-008	MUST	Save as an entered transaction without approval routing.
FR-EXP-009	MUST	Deduct amount from expected balance immediately after successful server save.
FR-EXP-010	MUST	Allow negative balance and display warning before final save.
FR-EXP-011	MUST	Capture entered_by and entered_at.
FR-EXP-012	MUST	Allow only assigned unit selection.
FR-EXP-013	MUST	Highlight backdated entry according to configurable threshold.
FR-EXP-014	SHOULD	Warn on possible duplicate vendor/date/amount/bill-number combinations.
FR-EXP-015	MUST	Allow Finance Manager/Super Admin edit with mandatory reason and audit.
FR-EXP-016	MUST	Prevent ordinary users from editing saved entries.
FR-EXP-017	MUST	Support auditable reversal/void mechanism without hard deletion.
FR-EXP-018	MUST	Retain voucher data after attachment deletion.
9.5 Attachments and Receipts
ID	Priority	Requirement
FR-DOC-001	MUST	Accept JPG, JPEG, PNG and PDF.
FR-DOC-002	MUST	Validate MIME type, extension and configured size limit.
FR-DOC-003	MUST	Attach one file to a voucher with multiple items; support additional pages where configured.
FR-DOC-004	MUST	Allow authorized inline view and download.
FR-DOC-005	MUST	Store files privately; never expose public predictable paths.
FR-DOC-006	MUST	Maintain file name, type, size, checksum, uploader and upload time.
FR-DOC-007	MUST	Allow missing-bill reason when no bill exists.
FR-DOC-008	MUST	Expose Checked/Unchecked marker.
FR-DOC-009	MUST	Record checked_by and checked_at.
FR-DOC-010	MUST	Record reason when changing Checked back to Unchecked.
FR-DOC-011	MUST	Generate monthly ZIP archive.
FR-DOC-012	MUST	Delete file only after archive confirmation and grace period.
FR-DOC-013	MUST	Retain deletion actor, time and archive reference.
FR-DOC-014	MUST	Demo storage shall use PostgreSQL temporary binary storage; production shall use private VPS disk through a storage adapter.
9.6 Receipt Monitoring
ID	Priority	Requirement
FR-CHK-001	MUST	New vouchers default to Unchecked.
FR-CHK-002	MUST	Finance Officer, Finance Manager and Super Admin may mark Checked.
FR-CHK-003	MUST	Checked status shall appear in dashboard, ledger and reports.
FR-CHK-004	MUST	Receipt check shall not change cash balance.
FR-CHK-005	MUST	Receipt check shall not imply expense approval.
FR-CHK-006	MUST	Bulk check may be provided only after explicit selection and confirmation.
FR-CHK-007	MUST	Every check/uncheck action shall be auditable.
9.7 Replenishment and Three-Month Compliance
ID	Priority	Requirement
FR-REP-001	MUST	Show available balance and recent expenditure before replenishment.
FR-REP-002	MUST	Calculate compliance for the preceding three monthly cash counts.
FR-REP-003	MUST	Flag fourth-month deposit/replenishment as on hold when any required month is incomplete.
FR-REP-004	MUST	Allow Finance Manager/Super Admin exception with reason, actor and time.
FR-REP-005	MUST	Record replenishment amount, date, reference and receipt confirmation.
FR-REP-006	MUST	Prevent duplicate posting of the same replenishment reference.
FR-REP-007	MUST	Include compliance and exceptions in reports.
9.8 Monthly Cash Count and Close
ID	Priority	Requirement
FR-CLS-001	MUST	Create one monthly closing record per petty-cash unit and month.
FR-CLS-002	MUST	Capture physical cash count, counted_by and count date.
FR-CLS-003	MUST	Calculate expected closing balance and variance.
FR-CLS-004	MUST	Allow negative, zero or positive variance with mandatory remarks when non-zero.
FR-CLS-005	MUST	Show entry count, total expenditure, unchecked receipts, missing bills and negative-balance events.
FR-CLS-006	MUST	Finance Manager shall close the month.
FR-CLS-007	MUST	Reopening a closed month requires Finance Manager/Super Admin reason and audit.
FR-CLS-008	MUST	Feed closed-month status into three-month compliance.
FR-CLS-009	MUST	Show a three-month visual timeline for each unit.
9.9 Notifications and Alerts
ID	Priority	Requirement
FR-ALT-001	MUST	Provide in-app alerts for negative balance, low balance, unchecked receipts and incomplete month close.
FR-ALT-002	MUST	Provide three-month compliance hold alert.
FR-ALT-003	MUST	Provide report-export completion feedback.
FR-ALT-004	MUST	Provide clear server/network failure messages.
FR-ALT-005	SHOULD	Email notifications may be added later without changing core data model.
FR-ALT-006	MUST	No SMS/WhatsApp dependency in first release.
9.10 Audit and Administration
ID	Priority	Requirement
FR-AUD-001	MUST	Audit login, failed login, create, edit, check, uncheck, allocation, close, reopen, archive and delete actions.
FR-AUD-002	MUST	Store actor, action, entity, entity ID, timestamp, IP/device metadata where available, reason and before/after JSON.
FR-AUD-003	MUST	Audit records shall be immutable to ordinary application roles.
FR-AUD-004	MUST	Provide searchable audit viewer to authorized roles.
FR-AUD-005	MUST	Allow audit export.
FR-AUD-006	MUST	No hard deletion of financial or audit records.
FR-AUD-007	MUST	System settings changes shall be audited.
  10. Reporting and Analytics Requirements
10.1 Reporting Principle
Finance Priority
Reporting is a primary product capability, not an afterthought. Reports must be presentable, meaningful, filter-rich and suitable for management review, audit and monthly record keeping.
10.2 Required Reports
ID	Report	Purpose
RPT-01	Consolidated Cash Position	Opening, allocations, expenditure, adjustments, expected balance by unit
RPT-02	Unit Ledger	Chronological cash ledger with running balance
RPT-03	Monthly Expense Statement	Voucher and line-item detail for selected month
RPT-04	Category Analysis	Building, Vehicle and Other totals, percentages and trends
RPT-05	Vendor / Payee Analysis	Spending by vendor/payee and frequency
RPT-06	Receipt Control	Checked, Unchecked, missing bill and check-age analysis
RPT-07	Negative Balance	Units, dates, vouchers and duration of negative balances
RPT-08	Allocation and Replenishment	Cash issued, confirmed, held and exception history
RPT-09	Three-Month Compliance	Completion timeline and fourth-month eligibility
RPT-10	Cash Count and Variance	Expected vs physical cash and remarks
RPT-11	Backdated and Duplicate Warnings	Late entries and possible duplicate patterns
RPT-12	Monthly Attachment Index	Voucher-to-file index and archive status
RPT-13	User Activity	Entries, checks, edits and exports by user
RPT-14	Audit Trail	Complete immutable action history
RPT-15	Cross-Unit Comparison	Ranked spending, balance and compliance by unit
RPT-16	Line-Item Analysis	Item descriptions and category totals independent of voucher header
10.3 Filters
• Date range and named month
• Fiscal quarter and year
• Center / project / project location
• Project group
• Category
• Vendor/payee
• Amount range
• Receipt Checked/Unchecked
• Bill present/missing
• Negative-balance event
• Entered by
• Checked by
• Expense date and entry date
• Backdated flag
• Possible duplicate flag
• Monthly close status
• Three-month compliance status
• Archive/download/deletion status
10.4 Report Presentation
• Official PSH header, report title and unique report ID
• Generated date/time and generated-by user
• Visible list of applied filters
• Summary KPI strip before detail tables
• Professional typography, spacing and page breaks
• Repeating table headers on PDF
• Totals and subtotals
• Confidentiality footer and page numbering
• Optional signature area for Finance review
• Print, PDF, Excel and CSV where appropriate
10.5 Dashboard Analytics
Cash issued
PKR
Current period	Spending
PKR
Current period	Expected cash
PKR
Live	Unchecked
Count
Receipt control	Negative
Count
Units affected
• Unit Pulse Grid showing balance, unchecked receipts and closing status
• Animated Cash Stream showing issued → spent → remaining
• Three-Month Compliance ribbon
• Category split and trend
• Recent high-value entries
• Units requiring Finance attention
• Quick jump to filtered report from any KPI
  11. UI/UX Master Design System
11.1 Design Concept: Aurora Ledger
The application shall feel like a modern institutional finance operating system rather than a generic admin template. The design language is named Aurora Ledger: luminous data surfaces, disciplined color, responsive motion, clear hierarchy and immediate financial meaning. It must be distinctive, calm, premium and fast.
No Sidebar Rule
The application shall not use a permanent left or right sidebar. Desktop navigation uses a compact institutional masthead, horizontal workspace tabs, command palette and contextual action rails. Mobile uses a bottom workspace dock and full-screen command sheet.
11.2 Information Architecture
Institutional Masthead
├── PSH identity and current environment badge
├── Unit / scope switcher
├── Period switcher
├── Global search / command palette
├── Alerts
└── User menu

Horizontal Workspace Navigation
├── Overview
├── Cash Flow
├── Expenses
├── Reports Studio
├── Month Close
└── Administration (role based)
11.3 Visual Personality
• Deep midnight and royal blue establish institutional authority.
• Cyan and emerald communicate live/healthy financial movement.
• Amber communicates pending review or compliance attention.
• Coral communicates negative balances and exceptional risk.
• Violet differentiates analytical/reporting workspaces.
• Color is always paired with text/icon meaning and never used alone.
• Surfaces use subtle depth, soft gradients and carefully controlled translucency; readability takes priority.
11.4 Design Tokens
Token Group	Baseline
Typography	Aptos/Inter-style sans; tabular numerals for amounts
Spacing	4px base grid; 8/12/16/24/32/48 scale
Radius	10px controls, 16px cards, 24px feature surfaces
Elevation	Subtle 1-3 level shadows; no heavy floating chrome
Border	Low-contrast cool gray, strengthened on focus
Amount Format	PKR with comma grouping and tabular figures
Focus	2px accessible accent outline
Density	Comfortable default; compact tables optional
Theme	Light-first; dark theme supported after core UAT
11.5 Responsive Model
Viewport	Navigation	Layout
Desktop ≥1280	Masthead + full horizontal tabs	12-column adaptive grid
Laptop 1024-1279	Masthead + scrollable tabs	8-12 columns
Tablet 768-1023	Condensed masthead + tab rail	Two-column / stacked
Mobile <768	Top title bar + bottom dock	Single-column task flow
  12. Screen-Level UI Specifications
12.1 Login
Animated PSH identity mark, secure sign-in panel, demo environment badge, clean background motion, no unnecessary marketing content.
12.2 Finance Command Center
KPI constellation, Unit Pulse Grid, negative-balance spotlight, receipt queue, three-month compliance ribbon, quick report launches.
• Animated number counters on first load
• Cards expand into filtered detail without full-page context loss
• Attention items sorted by financial urgency
• PSH-ISB never appears in petty-cash unit grid
12.3 Center Workspace
Own balance, cash received, spent, expected cash, recent entries, New Expense primary action, monthly close state.
12.4 Record Expense
Progressive form: unit context, bill header, justification, editable line-item composer, category chips, receipt upload, live total equality and balance preview.
• Line item row: description, category, amount, Other explanation
• Add/remove/reorder line items
• Bill total mismatch blocks save
• Negative balance warning is visible but does not block save
• Save confirms only after server response
12.5 Voucher Detail
Receipt viewer beside structured financial data, Checked control, audit timeline, privileged Edit action, printable voucher.
12.6 Expense Register
Powerful searchable table using TanStack Table, sticky headers, column control, saved filters, amount totals and export.
• Global search across voucher, vendor and justification
• Multi-filter chips with clear-all
• Column sorting, pinning and visibility
• Server-side pagination for large datasets
• Row opens a detail drawer or route, not a sidebar navigation shell
12.7 Cash Flow
Allocation ledger, receipt confirmations, balance timeline, negative-balance periods and replenishment action.
12.8 Reports Studio
Report gallery, filter composer, live preview, chart/table switch, PDF/Excel export, saved report presets.
• Reports designed as polished documents, not raw tables
• Filter summary visible in preview and export
• Drill from chart/KPI to filtered ledger
• Saved presets per Finance user
• Export progress and success state
12.9 Month Close
Physical cash entry, variance, receipt completeness, missing bills, closing remarks and three-month eligibility timeline.
12.10 Administration
Users, roles, units, petty-cash enablement, environment settings and audit viewer.
12.11 Mobile Experience
Camera/file upload, large controls, bottom dock, compact line-item editor and touch-first review.
  13. Motion, Iconography and Visual Experience
13.1 Approved UI Libraries
Purpose	Library / Standard	Usage Rule
Primary animation	Motion for React 12.x	Default for layout transitions, enter/exit, gestures, counters and view transitions
Complex orchestration	GSAP 3.x core	Use sparingly for special dashboard sequences or report storytelling; never required for basic usability
Icons	Lucide React	Primary icon set; consistent 1.75px stroke, tree-shaken imports, no emoji UI
Component foundation	shadcn/ui	Open-code components customized into PSH design system; do not ship default template appearance
Styling	Tailwind CSS 4.3+	Design tokens, responsive layout and states
Tables	TanStack Table	Headless sorting, filtering, grouping, pagination and custom visual design
Server data	TanStack Query	Caching, synchronization, mutation states and invalidation
Charts	Recharts	Accessible dashboard charts with restrained animation
Forms	React Hook Form + Zod	Performant form state and shared validation
Notifications	Sonner-style toast pattern	Brief confirmations; critical finance warnings remain persistent in page context
13.2 Motion Principles
• Motion explains state change and hierarchy; it is not decoration for its own sake.
• Primary transitions: 180-320ms; large workspace transitions: 350-550ms.
• Use spring motion for cards, drawers and rearrangement.
• Use subtle stagger for KPI and unit-grid reveal.
• Animate numeric changes with direction and previous-value context.
• Receipt Checked uses a short line-draw/check animation and timestamp reveal.
• Negative balance uses one controlled attention pulse, not continuous flashing.
• Report preview morphs smoothly between table and chart modes.
• Respect prefers-reduced-motion and provide equivalent non-animated states.
• Do not animate large table rows on every filter change when it harms performance.
13.3 Signature Interactions
Interaction	Animation
App entry	Institutional mark resolves into masthead; data surfaces reveal in logical order
Unit switch	Shared-layout transition preserves spatial context
Expense add line	New row expands with spring and focuses description
Total match	Progress ring closes and state changes to Match
Save success	Voucher number resolves; balance rolls to new value
Receipt checked	Icon path draws, chip color changes, checker/time appear
Negative balance	Balance crosses zero with coral transition and attention banner
Report generation	Filter tokens flow into report header; preview fades in
Month close	Three-month timeline advances and eligibility status updates
13.4 Icon Rules
• Use Lucide icons by semantic name and import only used icons.
• Use icon + text for navigation and important actions.
• Use icon-only buttons only with tooltip and accessible label.
• Create a small custom SVG set only for PSH-specific concepts such as Cash Count and Safar-e-Akhrat; match Lucide geometry.
• No mixed icon families in the same interface.
• Icons may animate on hover/confirmation but must not spin or bounce continuously.
  14. Data Model and Database Requirements
14.1 Database Platform
Use PostgreSQL. Demo shall use a hosted PostgreSQL free tier. Production shall use PostgreSQL on the VPS. Prisma ORM provides migrations and type-safe access. Financial posting operations must use database transactions.
14.2 Core Entities
Entity	Purpose
organizational_units	Hierarchy, code, type, city, parent, active, petty_cash_enabled
users	Identity, credentials, active state, profile
roles / permissions	Role definitions and permission assignments
user_unit_access	Authorized unit scope per user
petty_cash_accounts	One account per eligible unit, configuration and cached balance
cash_ledger_entries	Append-only allocations, expenses, adjustments, reversals and replenishments
cash_allocations	Allocation header and receipt confirmation
expense_vouchers	Voucher header, vendor, dates, total, justification, check marker
expense_lines	Line description, category enum, amount and Other explanation
attachments	Metadata, demo binary bytes or production storage key/path
receipt_check_events	Check/uncheck history
monthly_closings	Month close, expected/physical cash, variance, remarks
three_month_compliance	Derived or cached eligibility state
replenishments	Amount, reference, compliance result, exception
audit_logs	Immutable actor/action/before/after record
report_exports	Generated report metadata and filters
system_settings	Thresholds, retention, limits and environment configuration
14.3 Key Data Rules
• organizational_units.code is unique.
• Only petty_cash_enabled units may have petty_cash_accounts.
• PSH-ISB petty_cash_enabled is false.
• One account per unit.
• Voucher total > 0 and equals sum of lines.
• expense_lines.category is enum BUILDING, VEHICLE, OTHER.
• OTHER requires non-empty explanation.
• cash_ledger_entries are append-only; changes use compensating entries or audited rebuild logic.
• checked_at and checked_by are both null or both populated.
• One monthly closing per account/month.
• Money uses NUMERIC/DECIMAL, never floating point.
• All timestamps stored in UTC and displayed in Pakistan time.
14.4 Balance Formula
Expected Balance = Opening Balance
                 + Confirmed Cash Allocations / Replenishments
                 + Positive Adjustments
                 - Recorded Expenses
                 - Cash Returns
                 - Negative Adjustments

Variance = Physical Cash Count - Expected Balance
14.5 Demo Attachment Storage
For the Vercel demo, attachment bytes may be stored in PostgreSQL bytea only because no paid object storage or VPS is being used. This is a temporary test strategy. Apply strict file compression, maximum file size, row count and 30-day retention. The storage service interface must allow production replacement with private disk storage without changing voucher APIs.
  15. API and Backend Requirements
15.1 Backend Architecture
Use NestJS 11 with modular REST APIs, OpenAPI/Swagger documentation, DTO validation, Prisma repositories/services, authorization guards, audit interceptors and centralized error handling.
15.2 Modules
AuthModule
UsersModule
RolesModule
OrganizationModule
PettyCashAccountsModule
AllocationsModule
ExpensesModule
AttachmentsModule
ReceiptChecksModule
ReplenishmentsModule
MonthlyCloseModule
ReportsModule
AuditModule
SettingsModule
HealthModule
15.3 API Inventory
Method	Endpoint	Purpose
POST	/auth/login	Authenticate user
POST	/auth/refresh	Refresh session
GET	/me	Current user and unit scope
GET	/units	Authorized units
POST	/admin/units	Create unit
POST	/accounts/:unitId	Enable eligible petty-cash account
GET	/dashboard/finance	Finance command-center data
GET	/dashboard/unit/:id	Unit dashboard data
POST	/allocations	Record allocation
POST	/allocations/:id/confirm	Confirm receipt
POST	/expenses	Create expense voucher
GET	/expenses	Filtered register
GET	/expenses/:id	Voucher detail
PATCH	/expenses/:id	Privileged audited edit
POST	/expenses/:id/reverse	Audited reversal
POST	/expenses/:id/attachments	Upload receipt
GET	/attachments/:id/view	Authorized inline view
GET	/attachments/:id/download	Authorized download
POST	/expenses/:id/check	Mark receipt Checked
POST	/expenses/:id/uncheck	Return to Unchecked with reason
POST	/monthly-close	Create/update count
POST	/monthly-close/:id/close	Close month
GET	/compliance/:unitId	Three-month compliance
POST	/replenishments	Record/process replenishment
GET	/reports/:reportKey	Generate report dataset
POST	/exports	Generate PDF/Excel
GET	/audit	Search audit log
POST	/archives/monthly	Generate monthly ZIP
POST	/archives/:id/confirm	Confirm official download
DELETE	/attachments/eligible	Authorized retention deletion
15.4 API Standards
• JSON responses with consistent envelope and error codes
• Request IDs for tracing
• Server-side pagination/filtering/sorting
• Idempotency keys for allocation/replenishment posting where practical
• Database transactions for financial writes
• Optimistic UI only where rollback is safe
• No client-trusted role or unit scope
• OpenAPI kept current with implementation
  16. Security, Privacy and Auditability
16.1 Security Controls
• HTTPS in all deployed environments
• Environment secrets never committed
• Password hashing with Argon2id or approved equivalent
• Secure HTTP-only cookies or carefully managed token strategy
• CSRF protection where cookie authentication is used
• Rate limiting and brute-force controls
• Role and unit authorization at API/service/database query level
• Private attachment delivery after permission check
• File validation and malware-scanning path for production
• Input validation and output encoding
• Dependency and framework security updates
• Database port not publicly exposed in production
• Daily backups and restore testing
• Automatic session expiry and logout
16.2 Audit Events
Event Group	Examples
Authentication	Login success/failure, logout, reset, lockout
Financial data	Create, edit, reverse, allocation, replenishment
Receipt control	Upload, replace, check, uncheck, download, delete
Month close	Cash count, close, reopen, exception
Administration	User, role, unit and settings changes
Reporting	Sensitive export generation and download
16.3 Privacy
The system stores organizational financial operations and user-identifying activity. Access shall follow least privilege. Export files and downloaded bill archives are confidential and must be handled through official devices and controlled folders.
  17. Non-Functional Requirements
ID	Category	Requirement
NFR-001	Availability	Demo is best effort; production target ≥99.5% excluding planned maintenance.
NFR-002	Performance	Primary dashboards p95 ≤3 seconds under expected load.
NFR-003	Performance	Filtered ledger first page p95 ≤2 seconds for 100,000 records with indexes.
NFR-004	Usability	A trained center user shall record a standard voucher in ≤2 minutes excluding bill scanning.
NFR-005	Accessibility	Conform to WCAG 2.2 AA for core workflows.
NFR-006	Responsive	Support current desktop, tablet and mobile browsers.
NFR-007	Scalability	Add units and users without schema redesign.
NFR-008	Reliability	Financial writes use transactions and return success only after commit.
NFR-009	Auditability	No privileged edit without immutable audit data.
NFR-010	Maintainability	Modular monorepo, typed contracts, automated tests and documented conventions.
NFR-011	Compatibility	Use latest patched stable versions within approved major lines.
NFR-012	Localization	English first, PKR amounts; architecture may support Urdu later.
NFR-013	Online-only	No service-worker financial write queue or offline sync.
NFR-014	Motion	Reduced-motion preference must disable nonessential animation.
NFR-015	Security	Critical framework vulnerabilities patched promptly.
NFR-016	Backup	Production database backed up daily; monthly archive copied off-server.
NFR-017	Storage	Demo attachment retention limited; production disk monitored and alerts configured.
NFR-018	Observability	Health endpoint, structured logs and error monitoring.
  18. Demo and Testing Architecture
18.1 Objective
Build and validate the application without purchasing a domain, VPS or paid storage. The demo must be accessible from multiple PSH locations through Vercel-provided URLs.
18.2 Demo Stack
Layer	Technology
Frontend	Next.js 16.x App Router, React 19.2, TypeScript, Tailwind CSS 4.3
UI	shadcn/ui customized, Lucide React, Motion for React, selective GSAP
Backend	NestJS 11 deployed as Vercel-compatible serverless API or separate Vercel project
Database	Hosted PostgreSQL free tier (Neon/Prisma Postgres-compatible)
ORM	Prisma ORM
Attachments	Temporary PostgreSQL bytea storage with compression and retention
Hosting	Vercel Hobby/free for controlled non-production testing
Domain	No custom domain; use Vercel URLs
Source Control	GitHub private repository
CI	GitHub Actions or Vercel checks for lint/type/test/build
18.3 Demo Restrictions
• No real confidential financial data until production approval.
• Use sample/demo bills or redacted documents.
• Limit attachment size, for example 2 MB after compression, to protect free database quota.
• Delete demo bill bytes after 30 days or earlier.
• Vercel local filesystem is not persistent and shall not store uploads.
• Hobby/free environment is not the official production system.
• Display DEMO ENVIRONMENT badge in masthead.
18.4 Demo Multi-Location Test
1. Deploy frontend and API to Vercel.
2. Seed all active petty-cash units except PSH-ISB.
3. Create role-specific demo users.
4. Ask at least three locations to log in simultaneously.
5. Record vouchers with one and multiple line items.
6. Test receipt upload/view/check.
7. Test negative balance.
8. Test reports and month close.
9. Collect UAT issues and animation/performance feedback.
  19. Production VPS Architecture
19.1 Target Server
Item	Baseline
Server	2 vCPU, 4 GB RAM, 20 GB SSD minimum
OS	Ubuntu Linux LTS
Reverse Proxy	Nginx or Caddy
Containers	Docker Compose
Application	Next.js frontend + NestJS backend
Database	PostgreSQL 18.x compatible stable release
Uploads	Private persistent VPS directory
TLS	Free Let’s Encrypt certificate
Backup	Daily pg_dump + monthly bills/database copied to Head Office
Domain	Official PSH subdomain or approved separate domain
19.2 Production Topology
Internet
  ↓ HTTPS
Nginx / Caddy
  ├── Next.js application
  └── NestJS API
         ├── PostgreSQL (private network / localhost only)
         ├── Private uploads directory
         ├── Report / ZIP workspace
         └── Audit and application logs
19.3 Storage
• Production files are stored outside the public web root.
• Attachment access is streamed through authenticated API endpoints.
• Monthly deletion follows archive-confirmation policy.
• Database stores file metadata and storage key/path.
• Disk usage is monitored; low-space alert is mandatory.
  20. Migration from Vercel Demo to VPS
20.1 Migration Principles
• One codebase and environment-specific configuration
• Storage adapter separates database-byte demo storage from VPS disk storage
• No business-rule rewrite during migration
• Test migration using a copy before final cutover
• Production uses new secrets and official users
• Demo data may be excluded or clearly marked
20.2 Migration Procedure
1. Freeze feature changes and create release tag.
2. Provision and harden Ubuntu VPS.
3. Install Docker, reverse proxy and certificates.
4. Deploy PostgreSQL and application containers.
5. Run Prisma migrations.
6. Export demo PostgreSQL and import approved reference/configuration data.
7. Migrate required demo attachments from bytea to private disk through migration script.
8. Verify unit exclusion, balances, roles and reports.
9. Create production users and reset credentials.
10. Perform security, backup and restore tests.
11. Point domain/subdomain to VPS.
12. Run parallel validation and approve cutover.
13. Retain rollback snapshot and disable demo writes.
20.3 Storage Adapter Contract
interface AttachmentStorage {
  save(file, metadata): Promise<StorageResult>
  open(id, userContext): Promise<Readable>
  delete(id, authorization): Promise<void>
  archive(month, scope): Promise<ArchiveResult>
}

Demo implementation: PostgreSQL bytea
Production implementation: private VPS filesystem
  21. Testing and Quality Assurance
21.1 Test Levels
Level	Tools / Focus
Static	ESLint, TypeScript, formatting, dependency checks
Unit	Vitest/Jest for formulas, validation and permissions
Integration	NestJS + test PostgreSQL for financial transactions
Component	Storybook and interaction tests for design system
E2E	Playwright for complete user workflows
Accessibility	axe checks plus keyboard/manual review
Performance	API timing, report generation and dashboard load
Security	OWASP-oriented review, authorization and file access tests
UAT	Finance and selected center/project users
21.2 Mandatory Test Scenarios
• PSH-ISB cannot be selected or assigned a petty-cash account.
• One bill with five line items saves only when totals match.
• Other without explanation is rejected.
• Negative balance saves and is highlighted.
• Center user cannot edit saved entry.
• Finance Manager edit captures before/after audit.
• Receipt check does not change balance.
• Unchecked filter and report totals are correct.
• Fourth-month replenishment is held when one of three closes is incomplete.
• Authorized exception is audited.
• Bill archive download and deletion retain metadata.
• Network failure does not show false success.
• Reduced-motion mode remains fully usable.
21.3 Definition of Done
• Requirement and acceptance criteria implemented
• Peer/AI-assisted code review completed
• Type check, lint and tests pass
• Permission tests added
• Audit behavior verified
• Responsive and keyboard behavior verified
• No default/sidebar-template UI regression
• Documentation and migration updated
• UAT evidence attached for release-critical features
  22. Acceptance Criteria and UAT
ID	Acceptance Criterion
AC-001	Finance dashboard excludes PSH-ISB and shows every active petty-cash unit.
AC-002	Center user sees only assigned unit(s).
AC-003	Voucher supports multiple items and one bill.
AC-004	Only Building, Vehicle and Other can be selected.
AC-005	Other cannot save without explanation.
AC-006	Line totals must equal bill total.
AC-007	No pre-spend approval screen/status exists.
AC-008	New entry appears immediately after save and updates balance.
AC-009	Negative balance is allowed and clearly highlighted.
AC-010	Finance can mark receipt Checked and action is auditable.
AC-011	Only Finance Manager/Super Admin can edit saved entry.
AC-012	Edit audit shows before and after values.
AC-013	Reports support required filters and exports.
AC-014	Month close calculates variance.
AC-015	Three-month rule controls fourth-month replenishment eligibility.
AC-016	Online file can be viewed/downloaded by authorized user only.
AC-017	Monthly archive and deletion workflow works.
AC-018	UI has no permanent sidebar on desktop or mobile.
AC-019	Core motion respects reduced-motion settings.
AC-020	Vercel demo is accessible from multiple locations.
  23. Implementation Plan and Backlog
23.1 Recommended Delivery Sequence
Phase	Theme	Deliverable
Phase 0	Foundation	Monorepo, CI, design tokens, CLAUDE.md, database baseline
Phase 1	Identity and Organization	Auth, roles, units, PSH-ISB exclusion, demo seed
Phase 2	Cash Accounts	Petty-cash accounts, allocations, ledger and balances
Phase 3	Expense Core	Voucher, line items, categories, justification and negative balance
Phase 4	Documents and Checks	Upload, view, Checked/Unchecked and retention metadata
Phase 5	Modern UI	Command Center, responsive navigation, motion and icon system
Phase 6	Reports Studio	Filters, reports, charts, PDF and Excel
Phase 7	Month Close	Physical cash, variance, three-month rule and replenishment hold
Phase 8	Audit and Security	Audit viewer, privileged edit, hardening and test coverage
Phase 9	UAT Demo	Vercel multi-location testing and Finance sign-off
Phase 10	Production Readiness	VPS compose, backups, migration scripts and operational handbook
23.2 Repository Structure
psh-petty-cash/
├── apps/
│   ├── web/              # Next.js
│   └── api/              # NestJS
├── packages/
│   ├── ui/               # PSH design system
│   ├── contracts/        # Shared schemas/types
│   ├── config/
│   └── testing/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
│   ├── MASTER_SRS.md
│   ├── architecture/
│   ├── decisions/
│   └── uat/
├── scripts/
├── CLAUDE.md
├── pnpm-workspace.yaml
└── turbo.json
  24. Claude Pro / Claude Code Development Playbook
24.1 Operating Model
The user has Claude Pro. Claude Code can be used in the terminal or supported IDE with the same subscription. Claude shall work in small, verifiable increments, read the Master SRS and repository instructions, run tests and avoid broad uncontrolled rewrites.
24.2 Required CLAUDE.md Rules
# PSH Petty Cash - Non-Negotiable Rules
1. Read docs/MASTER_SRS.md before implementation.
2. Never create petty cash for PSH-ISB.
3. No pre-spend approval workflow.
4. Categories are exactly BUILDING, VEHICLE, OTHER.
5. OTHER requires explanation.
6. Negative balance is allowed and highlighted.
7. No permanent sidebar.
8. Motion for React is primary; Lucide is the icon system.
9. Saved financial edits are Finance Manager/Super Admin only and audited.
10. Never mark a save successful before server commit.
11. Demo uses Vercel + hosted PostgreSQL; production uses VPS disk storage.
12. Run lint, typecheck and relevant tests after each task.
13. Do not remove tests to make a build pass.
14. Ask before changing confirmed business rules.
24.3 Claude Task Template
<task>Implement [single feature].</task>
<context>Read MASTER_SRS sections [x], CLAUDE.md, and existing module patterns.</context>
<constraints>List business and UI constraints.</constraints>
<deliverables>Files, migrations, tests, docs.</deliverables>
<verification>Run lint, typecheck, unit/integration/E2E tests.</verification>
<stop_condition>Do not proceed to unrelated modules.</stop_condition>
24.4 Recommended First Claude Prompts
1. Analyze this repository and Master SRS. Produce an implementation plan only; do not edit code.
2. Create the pnpm/Turborepo monorepo, Next.js web app, NestJS API, shared contracts package and baseline CI. Run builds.
3. Design the Prisma schema for organizations, users, petty-cash accounts, ledger, vouchers, line items, attachments, checks, closings and audit logs. Enforce PSH-ISB exclusion and category enum. Produce migration and tests.
4. Build the PSH design-token package and top-navigation application shell. Do not use a sidebar. Add Lucide and Motion with reduced-motion support.
5. Implement the complete expense voucher vertical slice: API, database transaction, UI, validation, negative-balance warning, attachment abstraction and tests.
6. Implement Finance receipt Checked/Unchecked with audit history and responsive voucher detail.
7. Implement Reports Studio with server-side filters and export contracts.
8. Implement monthly close and three-month compliance rule with tests.
24.5 Claude Quality Controls
• Use Git branches and small commits.
• Review generated migrations before applying.
• Require tests for every finance formula and permission path.
• Use Claude hooks or CI to run lint/typecheck/test deterministically.
• Do not allow Claude to invent categories, statuses or units.
• Keep architecture decision records for meaningful changes.
• Ask Claude to explain changed files and remaining risks after each task.
  25. DevOps, Configuration and Environment Variables
25.1 Environment Separation
Environment	Purpose	Data
Local	Developer work	Synthetic only
Demo	Vercel multi-location UAT	Synthetic/redacted only
Staging (optional)	Production-like validation	Controlled test data
Production	Official operation	Authorized live data
25.2 Environment Variables
Variable	Purpose
DATABASE_URL	Prisma pooled connection
DIRECT_DATABASE_URL	Migration/direct connection where provider requires
AUTH_SECRET	Session/JWT signing secret
APP_ENV	local/demo/production
NEXT_PUBLIC_APP_ENV	Visible environment badge
NEXT_PUBLIC_API_BASE_URL	Frontend API base
CORS_ORIGINS	Allowed origins
ATTACHMENT_STORAGE_DRIVER	postgres-bytea or filesystem
UPLOAD_MAX_BYTES	Environment-specific limit
UPLOAD_RETENTION_DAYS	Default 30
ARCHIVE_GRACE_DAYS	Default configurable, e.g. 7
UPLOAD_ROOT	Production private directory
TZ_DISPLAY	Asia/Karachi
LOG_LEVEL	Logging verbosity
RATE_LIMIT_*	Security thresholds
25.3 CI Checks
• Install with lockfile
• Generate Prisma Client
• Lint
• Type check
• Unit tests
• Integration tests where database available
• Build web and API
• Playwright smoke tests on preview
• Dependency/security review
• Prevent merge when critical checks fail
  26. Risks, Assumptions and Mitigations
ID	Risk	Level	Mitigation
R-01	Free demo quotas exceeded	Medium	Strict test data, attachment compression/retention and quota monitoring
R-02	PostgreSQL bytea inflates demo database	High	Small demo files only; storage abstraction and early cleanup
R-03	Users misuse Other	Medium	Mandatory explanation and category report
R-04	Negative balances normalized	High	Prominent alerts, report and Finance follow-up
R-05	Finance misunderstands Checked as approval	Medium	Explicit labels/help text and training
R-06	Three-month rule incorrectly interpreted	High	Automated tests, visible month timeline and Finance UAT
R-07	Animated UI harms speed/accessibility	Medium	Performance budgets and reduced-motion mode
R-08	Claude changes confirmed rules	High	CLAUDE.md, small tasks, tests and human review
R-09	One VPS failure	High	Off-server backups and tested restore
R-10	File deletion before archive	High	Confirmation, grace period and audit
R-11	PSH-ISB accidentally enabled	Critical	Database/API/UI constraint and acceptance test
R-12	Vercel demo treated as production	High	Environment badge, policy and controlled data
  27. Requirements Traceability
27.1 Business-to-System Mapping
Business Need	Rule	Requirements	Verification
No pre-spend approval	BR-001	FR-EXP-008	Expense UAT
Justification	BR-002	FR-EXP-002	Validation test
Three categories	BR-006	FR-EXP-005	Enum/UI/E2E
Other explanation	BR-007	FR-EXP-006	Validation test
Receipt Checked	BR-008	FR-CHK-001..007	Finance UAT
Privileged edits	BR-009..010	FR-EXP-015..016, FR-AUD	Permission/audit tests
Negative balance allowed	BR-011	FR-CASH-007, FR-EXP-010	Negative-balance E2E
Online-only	BR-012	NFR-013	Network failure test
Three-month rule	BR-013	FR-REP, FR-CLS	Compliance tests
Retention	BR-014..015	FR-DOC-011..014	Archive/delete test
PSH-ISB excluded	BR-016	FR-ORG-003, FR-CASH-008	Constraint/E2E
Modern no-sidebar UI	UI 11-13	Screen specifications	Responsive visual UAT
  Appendix A. Detailed Role-Permission Matrix
Permission	Center User	In-Charge	Finance Officer	Finance Manager	Super Admin
View own unit dashboard	Yes	Yes	All	All	All authorized
Create expense	Yes	Optional	No	No	No
Edit saved expense	No	No	No	Yes	Yes
View receipt	Own	Own	All	All	All
Mark receipt Checked	No	No	Yes	Yes	Yes
Record allocation	No	No	Yes	Yes	Yes
Confirm allocation receipt	Yes	Yes	No	Yes	Yes
Enter cash count	Yes	Yes	Yes	Yes	Yes
Close month	No	No	No	Yes	Yes
Override three-month hold	No	No	No	Yes	Yes
Manage categories	No	No	No	Policy only	Yes/config
Manage users/units	No	No	No	Limited	Yes
View audit	No	Own limited	Yes	Yes	Yes
Export reports	Own	Own	All	All	All
  Appendix B. Field Dictionary
Field	Rule	Meaning
Voucher Number	Auto	Unique visible identifier
Unit	Required	Eligible assigned petty-cash unit
Expense Date	Required	Date expense occurred
Bill Date	Optional/conditional	Vendor bill date
Vendor / Payee	Required	Who received payment
Bill Number	Optional	Vendor reference
Justification	Required	Operational reason
Bill Total	Required	Voucher total
Line Description	Required	Item/service detail
Category	Required	Building, Vehicle or Other
Other Explanation	Required when Other	Why no other category applies
Line Amount	Required	Positive PKR amount
Attachment	Normally required	Bill image/PDF or missing-bill reason
Receipt Checked	System marker	Unchecked by default
Checked By/At	System	Finance review identity/time
Negative Balance After	Derived	Balance after posting
Edit Reason	Required for privileged edit	Audit justification
  Appendix C. Category Definitions
Category	Use	Examples
Building	Building, facility, furniture, fixture or premises-related expenditure	Door repair, plumbing, electrical repair, hardware, furniture repair
Vehicle	Vehicle operation or minor vehicle-related expenditure	Fuel, puncture, minor repair, local vehicle supplies
Other	Any legitimate petty-cash expenditure not falling under Building or Vehicle	Medicine, stationery, food/kitchen, transport fare; explanation mandatory
Category Governance
The system shall not add hidden subcategories or free-text account heads in the first release. Description and Other explanation provide detail while the controlled reporting category remains one of three.
  Appendix D. Report Filter Matrix
Report	Date	Unit	Category	Vendor	Amount	Receipt	User/Status
Consolidated Cash	✓	✓	✓	—	✓	✓	✓
Unit Ledger	✓	✓	✓	✓	✓	✓	✓
Monthly Expenses	✓	✓	✓	✓	✓	✓	✓
Category Analysis	✓	✓	✓	—	✓	✓	✓
Vendor Analysis	✓	✓	✓	✓	✓	✓	✓
Receipt Control	✓	✓	✓	✓	✓	✓	✓
Negative Balance	✓	✓	✓	✓	✓	✓	✓
Three-Month Compliance	✓	✓	—	—	—	—	✓
Audit Trail	✓	✓	✓	✓	✓	✓	✓
  Appendix E. Demo Seed Data
Seed active petty-cash units for Cadet College Sohawa, Sukkur, Bhalwal, Center of Excellence AJK, Dastarkhawan Raja Bazaar, Dastarkhawan Liaquat Bagh, Rehabilitation Center Chakri, Rehabilitation Center H-9, and Free Burial Service. Seed PSH-ISB as an organizational unit with petty_cash_enabled=false and no account.
Demo Role	Example Scope
Super Admin	All configuration
Finance Manager	All petty-cash units
Finance Officer	All petty-cash units; receipt check
Center User - Sohawa	Cadet College Sohawa only
Center User - Sukkur	PSH Sukkur only
Project User - Rehabilitation	Chakri and H-9 rehabilitation locations only
Auditor	Read-only all units
  Appendix F. Technology Baseline and Official References
Technology versions shall be pinned in the lockfile and use the latest patched stable release within the approved major line at kickoff. Security advisories override convenience.
Technology	Rationale	Official Reference
Next.js 16 / App Router	Current full-stack React framework baseline; App Router and patched stable releases	https://nextjs.org/docs/app

React 19.2	UI runtime	https://react.dev/blog/2025/10/01/react-19-2

Node.js 24 LTS	Runtime baseline	https://nodejs.org/en/blog/release/v24.18.0

TypeScript 6.0	Typed application language baseline	https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html

Tailwind CSS 4.3	Modern utility styling baseline	https://tailwindcss.com/blog

Motion for React 12	Primary free, production-grade animation library	https://motion.dev/docs/react

GSAP 3	Optional complex animation orchestration	https://gsap.com/docs/v3/

Lucide React	Modern consistent SVG icon system	https://lucide.dev/guide/react

shadcn/ui	Open-code accessible component foundation	https://ui.shadcn.com/docs

NestJS 11	Modular Node.js backend	https://docs.nestjs.com/migration-guide

PostgreSQL 18	Relational database baseline	https://www.postgresql.org/docs/current/

Prisma ORM	Type-safe PostgreSQL access and migrations	https://www.prisma.io/docs/orm

TanStack Query	Server-state caching and synchronization	https://tanstack.com/query/latest/docs/framework/react/overview

TanStack Table	Headless finance table/data-grid engine	https://tanstack.com/table/latest/docs/introduction

Claude Code	Agentic coding tool available with Claude Pro	https://code.claude.com/docs/en/overview

  Appendix G. Release Readiness Checklist
☐ Finance-approved rules implemented
☐ PSH-ISB exclusion verified
☐ Database migration reviewed
☐ Role/permission tests pass
☐ Negative balance tested
☐ Three-month rule tested
☐ Reports validated by Finance
☐ Receipt archive workflow tested
☐ Accessibility and reduced motion tested
☐ No permanent sidebar
☐ Vercel demo UAT completed
☐ Production backup/restore tested before launch
☐ Security review completed
☐ Training and user guide ready
☐ Sign-off recorded
  Appendix H. Glossary
Term	Definition
Allocation	Cash issued to a petty-cash unit
Expected Balance	System-calculated cash remaining
Physical Cash Count	Cash physically present at month end
Variance	Physical cash minus expected balance
Voucher	One recorded bill/payment event
Line Item	An individual item or service within a voucher
Checked Receipt	Receipt viewed by Finance; not an approval
Three-Month Compliance	Completion status of preceding three monthly cash counts/closings
Demo	Free temporary testing deployment
Production	Official secured VPS deployment
Storage Adapter	Code layer that allows demo database storage and production disk storage
  Appendix I. Final Development Authorization
The undersigned confirm that this Master SRS is the authoritative development baseline. Any later change to a confirmed business rule shall be documented through a change request, impact assessment and approved revision.
Approval	Name	Signature	Date
Head of Finance			
Administration / Project Sponsor			
Lead Developer			
UAT Coordinator			
Start Condition
Development may start after the responsible authority accepts this consolidated baseline or records approved changes. Claude Code and human developers shall use the same repository rules and requirement identifiers.

