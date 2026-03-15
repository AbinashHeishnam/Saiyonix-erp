# SaiyoniX ERP Delivery Checklist (Phase 2 to Phase 8)

Reference baseline: `docs/project-doc.md` section 18.1/18.2.

## Phase 2: Daily Operations
Target modules: Attendance System, Notice Board, Basic Notifications, Teacher Dashboard, Student Dashboard, Mobile basics.

### 2.1 Data and Backend Foundations
- [ ] Add/confirm schema and migrations for `student_attendance`, `attendance_corrections`, `attendance_audit_logs`, `student_leaves`.
- [ ] Add/confirm schema and migrations for `notice_board`, `circulars`, `notifications`, `notification_recipients`.
- [ ] Add attendance indexes for `attendance_date`, `student_id`, `section_id`, `academic_year_id`.
- [ ] Add background jobs table/queue integration for push notification dispatch.
- [ ] Add idempotency handling for notification broadcast jobs.

### 2.2 Attendance Features
- [ ] Build teacher API to mark class attendance (Present/Absent/Late/Half Day).
- [ ] Enforce attendance window (open/close time, configurable in settings).
- [ ] Enforce same-day edit rule; route post-day corrections through admin flow.
- [ ] Add monthly attendance summary endpoint per student.
- [ ] Add school-wide attendance summary endpoint for dashboard.
- [ ] Add low-attendance warning logic thresholds (85/80/75).
- [ ] Trigger parent notifications on absence and threshold drops.
- [ ] Add below-75% risk flags and dashboard visibility.

### 2.3 Leave Management (Basic)
- [ ] Student/parent leave application create/read endpoints.
- [ ] Class teacher leave approve/reject endpoints.
- [ ] Leave status timeline endpoint.
- [ ] Leave action audit logs.

### 2.4 Notice Board + Circulars
- [ ] Admin CRUD for notices and circulars.
- [ ] Targeting support: all/class/section/role.
- [ ] Publish/unpublish scheduling.
- [ ] Public visibility flag to support website sync.
- [ ] Student/parent/teacher notice list APIs.

### 2.5 Notifications (Basic)
- [ ] In-app notification create/send API.
- [ ] Per-user notification inbox endpoint.
- [ ] Mark-as-read endpoint.
- [ ] Push notification adapter abstraction (FCM-ready).
- [ ] Retry + dead-letter strategy for failed notification jobs.

### 2.6 Dashboard APIs
- [ ] Student dashboard API: today attendance, pending tasks, notices, dues summary placeholder.
- [ ] Teacher dashboard API: today classes, attendance pending classes, recent notices.
- [ ] Parent dashboard API: child attendance + upcoming dues + notices.

### 2.7 Mobile Basic Contract
- [ ] Freeze API contracts for mobile basic views.
- [ ] Add paginated lightweight endpoints for mobile.
- [ ] Add offline-friendly sync timestamp fields in response.

### 2.8 Quality and Security
- [ ] Add attendance and notification integration tests.
- [ ] Add authorization tests for teacher/class access boundaries.
- [ ] Add request rate-limit tuning for attendance mark routes.
- [ ] Add audit logging for all sensitive daily operations.

### 2.9 Definition of Done (Phase 2)
- [ ] Daily attendance flow works end-to-end for teacher/student/parent.
- [ ] Notice create and consume flow works for all target roles.
- [ ] Notification inbox and read states are reliable.
- [ ] Mobile basic endpoints are documented and stable.
- [ ] All tests and `npx tsc --noEmit` pass.

## Phase 3: Academic and Exams
Target modules: Notes, Assignments, Syllabus, Exam Timetable, Marks, Results, Admit Cards, Report Cards, Student Rank.

### 3.1 Data and Backend Foundations
- [ ] Add/confirm schema for `notes`, `assignments`, `assignment_submissions`.
- [ ] Add/confirm schema for `syllabus`, `syllabus_topics`, `syllabus_progress_logs`.
- [ ] Add/confirm schema for `exams`, `exam_subjects`, `exam_timetable`, `marks`, `mark_edit_logs`, `report_cards`, `admit_cards`, `rank_snapshots`.
- [ ] Add exam-related unique constraints to prevent duplicate records.

### 3.2 Notes and Assignments
- [ ] Teacher APIs for note upload metadata and publish.
- [ ] Student/parent APIs for note list and detail.
- [ ] Teacher APIs for assignment CRUD and deadlines.
- [ ] Student assignment submission API with late detection.
- [ ] Teacher grading endpoint with remarks.
- [ ] Submission status endpoint (on-time/late/missing).

### 3.3 Syllabus Tracking
- [ ] Academic sub-admin/teacher syllabus publish flow.
- [ ] Topic-level completion endpoints.
- [ ] Real-time completion percentage endpoint per class-subject.

### 3.4 Exams and Results
- [ ] Exam term creation and publish controls.
- [ ] Subject marks configuration (max/pass).
- [ ] Exam timetable publish endpoint.
- [ ] Subject teacher mark entry endpoint.
- [ ] 24-hour mark edit window enforcement.
- [ ] Mark lock/unlock workflow with audit logs.
- [ ] Result publish flow and immutable post-lock behavior.

### 3.5 Admit Card Rules
- [ ] Implement dual-condition lock: fee paid + attendance >= 75%.
- [ ] Admit-card lock reason API.
- [ ] Admit-card PDF generation service and storage path.

### 3.6 Report Card and Ranking
- [ ] Report card computation engine (total/percentage/grade).
- [ ] Class/section/school rank generation with tie-breaker rules.
- [ ] Publish results API to student/parent.

### 3.7 Quality and Security
- [ ] Add tests for mark locking and edit-window constraints.
- [ ] Add tests for admit-card eligibility rules.
- [ ] Add tests for ranking correctness and tie cases.
- [ ] Add performance tests for bulk mark entry.

### 3.8 Definition of Done (Phase 3)
- [ ] Full exam lifecycle is reproducible for one academic year.
- [ ] Students can see notes, assignments, timetable, results.
- [ ] Admit card locking and unlocking works exactly by policy.
- [ ] Rank and report card outputs are validated by sample fixtures.

## Phase 4: Finance
Target modules: Fee Management, Razorpay integration, Receipts, Scholarships, Financial Reports.

### 4.1 Data and Backend Foundations
- [ ] Add/confirm schema for `fee_structures`, `fee_terms`, `fee_deadlines`, `student_fee_ledger`, `discounts`, `scholarships`, `payments`, `payment_items`, `receipts`, `payment_audit_logs`.
- [ ] Add indexes for `student_fee_ledger` and `payments` on student/term/status.
- [ ] Add idempotency key uniqueness and replay-safe behavior.

### 4.2 Fee Setup and Ledgers
- [ ] Finance APIs for fee categories and term deadlines.
- [ ] Student ledger generation service per term.
- [ ] Sibling discount and scholarship application rules.
- [ ] Late fee computation engine.

### 4.3 Payment Processing
- [ ] Razorpay order creation endpoint.
- [ ] Razorpay webhook verification endpoint with signature validation.
- [ ] Idempotent payment capture flow.
- [ ] Cash entry endpoint for offline payments.
- [ ] Automatic ledger reconciliation after payment state change.

### 4.4 Receipts and Reporting
- [ ] Receipt number generation and PDF generation.
- [ ] Student/parent receipt download endpoint.
- [ ] Defaulter list endpoint with filters.
- [ ] Daily/term/year financial report endpoints.

### 4.5 Quality and Security
- [ ] Add tests for double payment prevention.
- [ ] Add tests for webhook replay attacks.
- [ ] Add tests for fee-calculation edge cases.
- [ ] Add audit logs for all payment and fee-rule mutations.

### 4.6 Definition of Done (Phase 4)
- [ ] End-to-end online payment works in sandbox and staging.
- [ ] Receipts generated for all successful payments.
- [ ] Defaulter and finance reports are accurate.
- [ ] Payment APIs are replay-safe and auditable.

## Phase 5: Advanced Features
Target modules: Behavior/Discipline, Achievements, Complaint Escalation, Digital ID (QR), Document Vault, Library.

### 5.1 Behavior and Achievement
- [ ] Behavior record APIs for teachers and admin view.
- [ ] Discipline warning rule engine (term-based counts).
- [ ] Auto notification trigger when warning threshold reached.
- [ ] Achievement and certificate CRUD + student visibility.

### 5.2 Complaint and Escalation
- [ ] Complaint create/track APIs for student/parent.
- [ ] Stage-wise escalation workflow (teacher -> sub-admin -> admin).
- [ ] SLA timers and auto-escalation jobs.
- [ ] Complaint comments/timeline endpoint.

### 5.3 Digital ID and Vault
- [ ] Student digital ID data endpoint.
- [ ] QR payload generation and verification endpoint.
- [ ] Document vault upload metadata API.
- [ ] Document verification status workflow (Pending/Verified/Rejected).

### 5.4 Library Module
- [ ] Books catalog CRUD.
- [ ] Book issue/return APIs.
- [ ] Due date and fine computation logic.
- [ ] Fine settlement endpoint and receipt link.

### 5.5 Quality and Security
- [ ] Add role tests for complaint and document visibility boundaries.
- [ ] Add storage access policy tests for vault files.
- [ ] Add audit logs for verification and escalation decisions.

### 5.6 Definition of Done (Phase 5)
- [ ] Behavior, complaints, digital ID, document vault, and library all usable.
- [ ] Escalation automations run on schedule and are observable.
- [ ] Access controls satisfy privacy requirements.

## Phase 6: Intelligence Layer
Target modules: Analytics dashboards, weak student detection, workload dashboard, rank insights, homework automation.

### 6.1 Metrics and Data Pipelines
- [ ] Build daily aggregation jobs for attendance, marks, assignments, behavior, fees.
- [ ] Create materialized views or analytics tables for dashboard reads.
- [ ] Add backfill scripts for historical metrics.

### 6.2 Weak Student Detection
- [ ] Implement rule engine for attendance risk, academic risk, assignment risk, discipline risk.
- [ ] Combined risk severity scoring (yellow/orange/red).
- [ ] Parent and teacher alert triggers for at-risk status changes.

### 6.3 Teacher/Admin Dashboards
- [ ] Teacher analytics endpoints: completion rates, weak students, class trends.
- [ ] Admin analytics endpoints: school-level attendance, fee risk, performance comparisons.
- [ ] Teacher workload balancing endpoint.

### 6.4 Homework Reminder Automation
- [ ] Scheduled job for pending assignment reminders.
- [ ] Threshold and schedule configuration via system settings.
- [ ] Notification fan-out with duplicate suppression.

### 6.5 Quality and Performance
- [ ] Accuracy tests for risk classification.
- [ ] Load tests for dashboard queries and aggregations.
- [ ] Alerting for failed analytics jobs.

### 6.6 Definition of Done (Phase 6)
- [ ] Risk engine outputs are deterministic and explainable.
- [ ] Dashboard endpoints meet target response times.
- [ ] Reminder automation is stable with retries.

## Phase 7: Admission and Website Integration
Target modules: admission form, lottery system, public website sync.

### 7.1 Admission Module
- [ ] Public admission form endpoint with validation and attachments metadata.
- [ ] Application number generation + parent notification.
- [ ] Admission review workflow (academic + finance checkpoints).

### 7.2 Lottery System
- [ ] Class-wise lottery run endpoint with auditable random seed.
- [ ] Selected/waitlist/not-selected assignment storage.
- [ ] Waiting list cascade automation on non-payment expiry.

### 7.3 Post-Lottery Conversion
- [ ] Selected applicant full-form completion workflow.
- [ ] Fee generation and payment gating before student creation.
- [ ] Auto create student + parent account after payment confirmation.

### 7.4 Website Sync
- [ ] Public APIs for notice board, events, achievements.
- [ ] Emergency banner feed endpoint.
- [ ] Sync jobs or event-driven updates from ERP to website cache.

### 7.5 Quality and Security
- [ ] Anti-spam and abuse controls on public admission forms.
- [ ] Fraud and duplicate application detection checks.
- [ ] Audit logs for lottery trigger and result publication.

### 7.6 Definition of Done (Phase 7)
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

### 8.5 Mobile and UX Readiness
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
