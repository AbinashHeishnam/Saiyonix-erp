# SaiyoniX ERP Delivery Checklist (Phase 2 to Phase 8)

Reference baseline: `docs/project-doc.md` section 18.1/18.2.
This checklist aligns backend + frontend deliverables per phase to avoid overlap and conflicts.

## Phase 2: Daily Operations
Target modules: Attendance System, Notice Board, Basic Notifications, Teacher/Student/Parent Dashboards, Mobile basics.

Status: COMPLETE
Date: March 17, 2026
Locked: true

Note: Phase-2 backend implementation verified and locked. All Phase-2 APIs, database models, and worker systems are implemented. Future changes must not modify Phase-2 behavior unless part of a later phase.

Verification summary:
- Attendance system
- Leave management
- Notice board
- Notifications
- Dashboards
- Security
- Database schema

### 2.1 Backend Data and Foundations
- [x] Add/confirm schema and migrations for `student_attendance`, `attendance_corrections`, `attendance_audit_logs`.
- [x] Add/confirm schema and migrations for `student_leaves`.
- [x] Add attendance indexes for `attendance_date`, `student_id`, `section_id`, `academic_year_id`.
- [x] Add/confirm schema and migrations for `notice_board`.
- [x] Add/confirm schema and migrations for `notifications`, `notification_recipients`.
- [x] Add/confirm schema and migrations for `circulars`.
- [x] Add background jobs table/queue integration for push notification dispatch.
- [x] Add idempotency handling for notification broadcast jobs.

### 2.2 Backend Attendance Features
- [x] Build teacher API to mark class attendance (Present/Absent/Late/Half Day).
- [x] Enforce attendance window (open/close time, configurable in settings).
- [x] Enforce same-day edit rule; route post-day corrections through admin flow.
- [x] Add monthly attendance summary endpoint per student.
- [x] Add school-wide attendance summary endpoint for dashboard.
- [x] Add low-attendance warning logic thresholds (85/80/75).
- [x] Trigger parent notifications on absence and threshold drops.
- [x] Add below-75% risk flags and dashboard visibility.

### 2.3 Backend Leave Management (Basic)
- [x] Student/parent leave application create/read endpoints.
- [x] Class teacher leave approve/reject endpoints.
- [x] Leave status timeline endpoint.
- [x] Leave action audit logs.

### 2.4 Backend Notice Board + Circulars
- [x] Admin CRUD for notices.
- [x] Publish/expiry scheduling via `publishedAt`/`expiresAt`.
- [x] Public visibility flag to support website sync.
- [x] Student/parent/teacher notice list APIs.
- [x] Targeting support: all/class/section/role.
- [x] Circulars module (CRUD + targeting + scheduling).

### 2.5 Backend Notifications (Basic)
- [x] In-app notification create/send API (broadcast + targeted).
- [x] Per-user notification inbox endpoint.
- [x] Mark-as-read + mark-all-read + unread-count endpoints.
- [x] Push notification adapter abstraction (FCM-ready).
- [x] Retry + dead-letter strategy for failed notification jobs.

### 2.6 Backend Dashboard APIs
- [x] Student dashboard API: today attendance, pending tasks, notices, dues summary placeholder.
- [x] Teacher dashboard API: today classes, attendance pending classes, recent notices.
- [x] Parent dashboard API: child attendance + upcoming dues + notices.

### 2.7 Mobile Basic Contract (Backend)
- [x] Freeze API contracts for mobile basic views.
- [x] Add paginated lightweight endpoints for mobile.
- [x] Add offline-friendly sync timestamp fields in response.

### 2.8 Frontend (Phase 2)
- [ ] Admin web UI: attendance, notices, notifications, dashboards.
- [ ] Academic Sub-Admin web UI: attendance, notices, dashboards.
- [ ] Finance Sub-Admin web UI: notices, notifications.
- [ ] Teacher web UI: attendance mark/edit, leave approvals, notices, dashboard.
- [ ] Student web UI: attendance summary, notices, notifications, dashboard.
- [ ] Parent web UI: child attendance summary, notices, notifications, dashboard.
- [ ] Mobile-ready layouts for student/parent/teacher views.
- [ ] Shared design system and role-based navigation.

### 2.9 Quality and Security
- [x] Add attendance and notification integration tests.
- [x] Add authorization tests for teacher/class access boundaries.
- [x] Add request rate-limit tuning for attendance mark routes.
- [x] Add audit logging for all sensitive daily operations.

### 2.10 Definition of Done (Phase 2)
- [x] Daily attendance flow works end-to-end for teacher/student/parent.
- [x] Notice create and consume flow works for all target roles.
- [x] Notification inbox and read states are reliable.
- [x] Mobile basic endpoints are documented and stable.
- [x] All tests and `npx tsc --noEmit` pass.

## Phase 3: Academic and Exams
Target modules: Notes, Assignments, Syllabus, Exam Timetable, Marks, Results, Admit Cards, Report Cards, Student Rank.

### 3.1 Backend Data and Foundations
- [ ] Add/confirm schema for `notes`, `assignments`, `assignment_submissions`.
- [ ] Add/confirm schema for `syllabus`, `syllabus_topics`, `syllabus_progress_logs`.
- [ ] Add/confirm schema for `exams`, `exam_subjects`, `exam_timetable`, `marks`, `mark_edit_logs`, `report_cards`, `admit_cards`, `rank_snapshots`.
- [ ] Add exam-related unique constraints to prevent duplicate records.

### 3.2 Backend Academic Features
- [ ] Teacher APIs for note upload metadata and publish.
- [ ] Student/parent APIs for note list and detail.
- [ ] Teacher APIs for assignment CRUD and deadlines.
- [ ] Student assignment submission API with late detection.
- [ ] Teacher grading endpoint with remarks.
- [ ] Submission status endpoint (on-time/late/missing).
- [ ] Academic sub-admin/teacher syllabus publish flow.
- [ ] Topic-level completion endpoints.
- [ ] Real-time completion percentage endpoint per class-subject.
- [ ] Exam term creation and publish controls.
- [ ] Subject marks configuration (max/pass).
- [ ] Exam timetable publish endpoint.
- [ ] Subject teacher mark entry endpoint.
- [ ] 24-hour mark edit window enforcement.
- [ ] Mark lock/unlock workflow with audit logs.
- [ ] Result publish flow and immutable post-lock behavior.
- [ ] Admit card rules: fee paid + attendance >= 75%.
- [ ] Admit-card lock reason API.
- [ ] Admit-card PDF generation service and storage path.
- [ ] Report card computation engine (total/percentage/grade).
- [ ] Class/section/school rank generation with tie-breaker rules.
- [ ] Publish results API to student/parent.
- [ ] Assignment attachment upload endpoint for teachers (file/PDF support).
- [ ] Assignment due reminder notification job integration with notification queue.
- [ ] Bulk marks entry endpoint for teachers (single request for multiple students).
- [ ] Marks validation rule enforcement (marksObtained must be ≤ maxMarks).
- [ ] Result recalculation endpoint for admin in case marks are updated.
- [ ] Rank snapshot recomputation endpoint for recalculating class/section/school ranks.
- [ ] Grade boundary configuration support (e.g., A+, A, B grading ranges).
- [ ] Exam visibility control so students only see published exams.
- [ ] Audit log creation for mark edits using MarkEditLog.
- [ ] Audit log creation when results are published or re-published.

### 3.3 Frontend (Phase 3)
- [ ] Teacher UI: notes/assignments CRUD, grading, syllabus progress, mark entry.
- [ ] Student UI: notes/assignments list, submissions, syllabus progress, results.
- [ ] Parent UI: child notes/assignments, results, report cards, admit cards.
- [ ] Admin/Academic Sub-Admin UI: exam setup, timetable, mark locks, result publish.

### 3.4 Quality and Security
- [ ] Tests for mark locking and edit-window constraints.
- [ ] Tests for admit-card eligibility rules.
- [ ] Tests for ranking correctness and tie cases.
- [ ] Performance tests for bulk mark entry.
- [ ] Performance test for bulk marks entry (simulate large class sizes).
- [ ] Validation tests for marks input (prevent invalid marks > maxMarks).
- [ ] Audit log verification tests for mark edits and result publishing.

### 3.5 Definition of Done (Phase 3)
- [ ] Full exam lifecycle is reproducible for one academic year.
- [ ] Students can see notes, assignments, timetable, results.
- [ ] Admit card locking and unlocking works exactly by policy.
- [ ] Rank and report card outputs are validated by sample fixtures.

## Phase 4: Finance
Target modules: Fee Management, Razorpay integration, Receipts, Scholarships, Financial Reports.

### 4.1 Backend Data and Foundations
- [ ] Add/confirm schema for `fee_structures`, `fee_terms`, `fee_deadlines`, `student_fee_ledger`, `discounts`, `scholarships`, `payments`, `payment_items`, `receipts`, `payment_audit_logs`.
- [ ] Add indexes for `student_fee_ledger` and `payments` on student/term/status.
- [ ] Add idempotency key uniqueness and replay-safe behavior.

### 4.2 Backend Finance Features
- [ ] Finance APIs for fee categories and term deadlines.
- [ ] Student ledger generation service per term.
- [ ] Sibling discount and scholarship application rules.
- [ ] Late fee computation engine.
- [ ] Razorpay order creation endpoint.
- [ ] Razorpay webhook verification endpoint with signature validation.
- [ ] Idempotent payment capture flow.
- [ ] Cash entry endpoint for offline payments.
- [ ] Automatic ledger reconciliation after payment state change.
- [ ] Receipt number generation and PDF generation.
- [ ] Student/parent receipt download endpoint.
- [ ] Defaulter list endpoint with filters.
- [ ] Daily/term/year financial report endpoints.

### 4.3 Frontend (Phase 4)
- [ ] Finance Sub-Admin UI: fee setup, ledgers, payments, receipts, reports.
- [ ] Admin UI: finance overview, defaulter list, scholarship approvals.
- [ ] Parent UI: fee ledger, payment flow, receipts.
- [ ] Student UI: fee summary + receipt access.

### 4.4 Quality and Security
- [ ] Tests for double payment prevention.
- [ ] Tests for webhook replay attacks.
- [ ] Tests for fee-calculation edge cases.
- [ ] Audit logs for all payment and fee-rule mutations.

### 4.5 Definition of Done (Phase 4)
- [ ] End-to-end online payment works in sandbox and staging.
- [ ] Receipts generated for all successful payments.
- [ ] Defaulter and finance reports are accurate.
- [ ] Payment APIs are replay-safe and auditable.

## Phase 5: Advanced Features
Target modules: Behavior/Discipline, Achievements, Complaint Escalation, Digital ID (QR), Document Vault, Library.

### 5.1 Backend Data and Foundations
- [ ] Add/confirm schema for behavior, achievements, complaints, escalations, digital IDs, document vault, library.
- [ ] Add required indexes and uniqueness constraints for all new modules.

### 5.2 Backend Advanced Features
- [ ] Behavior record APIs for teachers and admin view.
- [ ] Discipline warning rule engine (term-based counts).
- [ ] Auto notification trigger when warning threshold reached.
- [ ] Achievement and certificate CRUD + student visibility.
- [ ] Complaint create/track APIs for student/parent.
- [ ] Stage-wise escalation workflow (teacher -> sub-admin -> admin).
- [ ] SLA timers and auto-escalation jobs.
- [ ] Complaint comments/timeline endpoint.
- [ ] Student digital ID data endpoint.
- [ ] QR payload generation and verification endpoint.
- [ ] Document vault upload metadata API.
- [ ] Document verification status workflow (Pending/Verified/Rejected).
- [ ] Books catalog CRUD.
- [ ] Book issue/return APIs.
- [ ] Due date and fine computation logic.
- [ ] Fine settlement endpoint and receipt link.

### 5.3 Frontend (Phase 5)
- [ ] Admin UI: behavior/discipline, achievements, complaints, vault, library.
- [ ] Teacher UI: behavior logging, complaints view, library actions (if role allows).
- [ ] Student/Parent UI: achievements, complaints, digital ID, vault visibility.

### 5.4 Quality and Security
- [ ] Role tests for complaint and document visibility boundaries.
- [ ] Storage access policy tests for vault files.
- [ ] Audit logs for verification and escalation decisions.

### 5.5 Definition of Done (Phase 5)
- [ ] Behavior, complaints, digital ID, document vault, and library all usable.
- [ ] Escalation automations run on schedule and are observable.
- [ ] Access controls satisfy privacy requirements.

## Phase 6: Intelligence Layer
Target modules: Analytics dashboards, weak student detection, workload dashboard, rank insights, homework automation.

### 6.1 Backend Data Pipelines
- [ ] Build daily aggregation jobs for attendance, marks, assignments, behavior, fees.
- [ ] Create materialized views or analytics tables for dashboard reads.
- [ ] Add backfill scripts for historical metrics.

### 6.2 Backend Risk and Analytics Features
- [ ] Implement rule engine for attendance risk, academic risk, assignment risk, discipline risk.
- [ ] Combined risk severity scoring (yellow/orange/red).
- [ ] Parent and teacher alert triggers for at-risk status changes.
- [ ] Teacher analytics endpoints: completion rates, weak students, class trends.
- [ ] Admin analytics endpoints: school-level attendance, fee risk, performance comparisons.
- [ ] Teacher workload balancing endpoint.
- [ ] Scheduled job for pending assignment reminders.
- [ ] Threshold and schedule configuration via system settings.
- [ ] Notification fan-out with duplicate suppression.

### 6.3 Frontend (Phase 6)
- [ ] Teacher analytics UI: class trends, weak student lists, completion rates.
- [ ] Admin analytics UI: school metrics, comparative dashboards, fee risk.
- [ ] Teacher workload UI.

### 6.4 Quality and Performance
- [ ] Accuracy tests for risk classification.
- [ ] Load tests for dashboard queries and aggregations.
- [ ] Alerting for failed analytics jobs.

### 6.5 Definition of Done (Phase 6)
- [ ] Risk engine outputs are deterministic and explainable.
- [ ] Dashboard endpoints meet target response times.
- [ ] Reminder automation is stable with retries.

## Phase 7: Admission and Website Integration
Target modules: admission form, lottery system, public website sync.

### 7.1 Backend Admission Features
- [ ] Public admission form endpoint with validation and attachments metadata.
- [ ] Application number generation + parent notification.
- [ ] Admission review workflow (academic + finance checkpoints).
- [ ] Class-wise lottery run endpoint with auditable random seed.
- [ ] Selected/waitlist/not-selected assignment storage.
- [ ] Waiting list cascade automation on non-payment expiry.
- [ ] Selected applicant full-form completion workflow.
- [ ] Fee generation and payment gating before student creation.
- [ ] Auto create student + parent account after payment confirmation.
- [ ] Public APIs for notice board, events, achievements.
- [ ] Emergency banner feed endpoint.
- [ ] Sync jobs or event-driven updates from ERP to website cache.

### 7.2 Frontend (Phase 7)
- [ ] Public admission form UI.
- [ ] Admin UI for admission review + lottery management.
- [ ] Website pages consuming public APIs (notices/events/achievements/emergency).

### 7.3 Quality and Security
- [ ] Anti-spam and abuse controls on public admission forms.
- [ ] Fraud and duplicate application detection checks.
- [ ] Audit logs for lottery trigger and result publication.

### 7.4 Definition of Done (Phase 7)
- [ ] Admission from public form to enrolled student works end-to-end.
- [ ] Lottery process is tamper-evident and reproducible.
- [ ] Website reflects ERP notices/events/alerts correctly.

## Phase 8: Scale, Security, and Production Polish
Target modules: performance optimization, load testing (20k concurrent), offline readiness support, multi-language prep, security audit.

### 8.1 Performance and Scale
- [ ] Add Redis caching for low-change/high-read endpoints.
- [ ] Add background queues for heavy tasks.
- [ ] Add DB connection pooling and query optimization pass.
- [ ] Add read-replica strategy for reporting workloads.
- [ ] Run staged load tests to target peak concurrency profiles.

### 8.2 Security Hardening
- [ ] Complete OWASP checklist pass for API.
- [ ] Add secrets management policy (no plaintext secrets in code).
- [ ] Enforce TLS-only deployment and strict CORS by env.
- [ ] Add payload sanitization and CSP policy for web-facing endpoints.
- [ ] Add periodic token/session cleanup jobs and retention jobs.

### 8.3 Reliability and Observability
- [ ] Add centralized logs with correlation IDs.
- [ ] Add APM/error tracking (Sentry/Datadog equivalent).
- [ ] Add uptime checks and paging alerts.
- [ ] Add disaster recovery runbook and backup-restore drill.

### 8.4 DevOps and Release
- [ ] CI/CD with test gates and migration checks.
- [ ] Blue/green or rolling deployment strategy.
- [ ] Rollback automation and smoke test suite.
- [ ] Environment parity checks (dev/staging/prod).

### 8.5 Frontend and Mobile Polish
- [ ] Offline sync contract validation for mobile cached modules.
- [ ] Localization infrastructure prep for multi-language support.
- [ ] Final API contract freeze and versioning policy.

### 8.6 Definition of Done (Phase 8)
- [ ] Load-test evidence demonstrates target capacity acceptance.
- [ ] Security audit findings are resolved or formally accepted.
- [ ] Monitoring/alerts and incident runbooks are active.
- [ ] Production deployment is repeatable and rollback-safe.

## Final Completion Checklist (Program-Level)

### A. Product Completeness
- [ ] All PRD modules have implemented APIs and tested critical flows.
- [ ] All role journeys pass UAT: Super Admin, Admin, Academic Sub-Admin, Finance Sub-Admin, Teacher, Parent, Student.
- [ ] All required reports and exports are verified.

### B. Quality Gates
- [ ] Unit, integration, and end-to-end tests pass in CI.
- [ ] Test coverage target met for core domains.
- [ ] Type-checking and linting are mandatory and passing.

### C. Data and Compliance
- [ ] Data retention rules implemented (OTP, sessions, audit, archives).
- [ ] Backup/restore tested against production-like dataset.
- [ ] Audit logs cover sensitive actions and are queryable.

### D. Security and Risk
- [ ] Pen test/security audit completed and signed off.
- [ ] Payment and auth threat models documented.
- [ ] Incident response process practiced.

### E. Operations and Handover
- [ ] Production SLO/SLI and alert policies defined.
- [ ] Runbooks for common incidents completed.
- [ ] Admin and support training done.
- [ ] Release notes and technical handover docs completed.

## Suggested Milestone Exit Reviews
- [ ] Phase 2 exit review with attendance and notice live demo.
- [ ] Phase 3 exit review with full exam-to-report-card demo.
- [ ] Phase 4 exit review with payment and receipt reconciliation demo.
- [ ] Phase 5 exit review with complaints escalation and vault demo.
- [ ] Phase 6 exit review with risk engine accuracy report.
- [ ] Phase 7 exit review with admission-to-enrollment demo.
- [ ] Phase 8 exit review with load test and security sign-off.
