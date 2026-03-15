# Project Documentation

Paste your project documentation here.

SAIYONIX
SCHOOL ERP PLATFORM
Product Requirements & Technical Architecture Document
Version
1.0.0
Prepared By
SaiyoniX Pvt Ltd
Classification
Confidential
Target Scale
15,000-20,000 Concurrent Users

Built for Manipur. Designed for Scale. Powered by SaiyoniX.

Table of Contents



1. Executive Summary
SaiyoniX School ERP is a full-stack, enterprise-grade school management platform developed by SaiyoniX Pvt Ltd for a K-12 institution in Manipur, India. The platform manages the complete lifecycle of school operations — from student admissions and daily attendance to fee payments, examinations, and academic year promotions.

The system is architected to handle 15,000 to 20,000 concurrent users, making it suitable for large schools and scalable for future multi-school deployment across Northeast India.

Parameter
Value
Total Students (est.)
3,360 - 5,040
Total Classes
14 (Nursery to Class 12)
Sections per Class
4 (A, B, C, D)
Students per Section
60 - 90
Total Teachers (est.)
60 - 80
Concurrent Users Target
15,000 - 20,000
Platforms
Web App + Mobile App (Android & iOS) + Public Website
Total Modules
33
User Roles
7
Estimated API Endpoints
250 - 350
Estimated DB Tables
70 - 90

2. System Overview
2.1 Platform Architecture
The SaiyoniX ERP is a three-tier architecture platform consisting of:
    • Web Application — for Admin, Sub-Admins, Teachers, Students, and Parents
    • Mobile Application — for Students, Parents, and Teachers (Android + iOS via Flutter)
    • Public School Website — for prospective parents, general public, and online admissions

2.2 User Roles
Role
Platform
Access Level
Description
Super Admin
Web
Full System
SaiyoniX team — manages entire ERP instance
School Admin
Web
Full School
School management — controls all school data
Sub Admin (Academic)
Web
Academic Dept
Manages academics, exams, promotions, syllabus
Sub Admin (Finance)
Web
Finance Dept
Manages fees, payments, scholarships
Teacher
Web + Mobile
Class/Subject
Class teacher or subject teacher access
Parent
Web + Mobile
Own Child Only
Views child data, pays fees, communicates
Student
Web + Mobile
Own Data Only
Views personal academic & fee information

2.3 Module Summary
#
Module
Primary Users
1
Authentication & RBAC
All Roles
2
Student Management
Admin, Sub-Admin
3
Teacher Management
Admin
4
Parent Management
Admin
5
Attendance System
Teacher, Student, Parent, Admin
6
Timetable Management
Admin, Teacher, Student, Parent
7
Academic Module
Teacher, Student, Parent
8
Exam & Results System
Admin, Sub-Admin, Teacher, Student, Parent
9
Fee Management
Finance Sub-Admin, Parent, Admin
10
Admit Card System
Student, Parent, Admin
11
Digital Student ID (QR)
Student, Teacher, Admin
12
Behavior & Discipline
Teacher, Parent, Student
13
Achievement & Certificate
Teacher, Admin, Student
14
Complaint & Grievance
Student, Parent, Teacher, Admin
15
School Events & Activities
Admin, Student, Parent
16
Digital Notice Board
Admin, All Users
17
Emergency Alert System
Admin, All Users
18
Leave Management
Student, Parent, Teacher, Admin
19
Student Portfolio
Student, Parent, Admin
20
Analytics & Reports
Admin, Teacher
21
Library Management
Admin, Student
22
Substitution Management
Admin, Teacher
23
TC Generation
Admin, Sub-Admin
24
Notification System
All Roles
25
Admission & Lottery System
Admin, Sub-Admin, Parents (Public)
26
Public School Website
General Public
27
System Settings
Admin, Super Admin
28
Academic Year Management
Admin
29
Digital Document Vault
Student, Parent, Admin
30
Weak Student Detection
Teacher, Admin
31
Teacher Workload Dashboard
Admin
32
Student Rank System
Student, Parent, Admin
33
Homework Reminder Automation
System (Auto), Parent

3. Technical Architecture & Infrastructure
3.1 Recommended Technology Stack
Layer
Technology
Justification
Frontend Web
React.js + Vite + TypeScript
Fast, component-based, excellent for dashboards
Mobile App
Flutter (Dart)
Single codebase for Android & iOS
Backend API
Node.js + Express.js / FastAPI (Python)
High throughput, async-capable REST API
Primary Database
PostgreSQL
Relational, ACID-compliant, ideal for school records
Cache Layer
Redis
Session management, rate limiting, queue handling
Message Queue
Bull (Redis-backed) / RabbitMQ
Async jobs: notifications, reports, bulk imports
File Storage
AWS S3 / Cloudflare R2
Documents, photos, PDFs at scale
Push Notifications
Firebase FCM
Android & iOS push notifications
SMS Gateway
Twilio / MSG91
OTP and critical SMS alerts
Payments
Razorpay
UPI, card, net banking — India-optimized
Search
PostgreSQL Full Text / Elasticsearch
Student & record search at scale
CDN
Cloudflare
Static assets, low latency for Manipur
Hosting
AWS (EC2 + RDS + S3) / Railway
Scalable, production-grade cloud hosting
CI/CD
GitHub Actions + Docker
Automated deployment pipeline
Monitoring
Datadog / Sentry
Error tracking, performance monitoring

3.2 Scalability Architecture for 15,000-20,000 Concurrent Users
The system must sustain peak concurrent usage — especially during fee payment deadlines when all parents access the platform simultaneously. The following architecture is required:

3.2.1 Load Balancing
    • NGINX or AWS ALB (Application Load Balancer) distributes traffic across multiple backend instances
    • Horizontal scaling: auto-scale backend pods via Kubernetes or AWS ECS
    • Minimum 3 backend instances in production; auto-scale to 10+ during peak

3.2.2 Database Strategy
    • PostgreSQL primary with read replicas (1 write + 2 read minimum)
    • All heavy read operations (reports, dashboards, analytics) routed to read replicas
    • Connection pooling via PgBouncer — handles burst connections efficiently
    • Database indexes on: student_id, class_id, section_id, parent_mobile, academic_year_id, fee_status
    • Partitioning: attendance and fee tables partitioned by academic_year to keep queries fast as data grows

3.2.3 Caching Strategy
    • Redis cache for: timetables, class lists, fee structures, school settings (low-change data)
    • Cache TTL: timetable = 6 hours, fee structure = 1 hour, student profile = 30 minutes
    • Session tokens stored in Redis with expiry
    • Cache invalidation on any update to cached data

3.2.4 Fee Payment Concurrency Handling
    • Payment requests queued via Bull/RabbitMQ — prevents database deadlocks during peak
    • Idempotency keys on every payment request — prevents double payments
    • Razorpay webhook verification for payment confirmation
    • Payment status stored with optimistic locking
    • Circuit breaker pattern on payment gateway calls

3.2.5 File & Media Handling
    • All uploads (photos, PDFs, documents) go directly to AWS S3 via pre-signed URLs
    • Backend never handles file bytes — reduces server memory load
    • Profile photos compressed to max 200KB on client before upload
    • Bulk photo ZIP processed as background job — does not block API

Scenario
Expected Load
Architecture Response
Fee payment deadline day
10,000-15,000 concurrent
Queue + auto-scale + load balancer
Exam result publication
5,000-8,000 concurrent
Read replicas + CDN cache
Morning attendance (all teachers)
60-80 concurrent writes
Standard backend handles easily
Bulk SMS notification
5,000 SMS in minutes
Message queue + SMS gateway batch API
Admit card generation peak
3,000-5,000 concurrent
Pre-generated PDFs cached in S3

3.3 Security Architecture
Security Layer
Implementation
Authentication
JWT Access Token (15 min expiry) + Refresh Token (7 days)
Password Hashing
bcrypt with salt rounds = 12
OTP
6-digit, 5-minute expiry, max 3 attempts, then 15-min cooldown
Login Attempt Limiting
Account locked after 5 failed attempts, admin unlock required
RBAC Enforcement
Middleware on every API endpoint — role checked server-side always
Data Encryption
AES-256 for sensitive fields: mobile, Aadhar, address, documents
HTTPS
TLS 1.3 enforced — no HTTP in production
CORS
Strict whitelist of allowed origins
Rate Limiting
Per-IP and per-user rate limits via Redis
SQL Injection
Parameterized queries only — no raw SQL string concatenation
XSS Protection
Input sanitization on all user inputs, CSP headers
Audit Logs
Every sensitive action logged: who, when, what, IP address
File Upload Security
MIME type validation, max size limits, virus scan on documents
Payment Security
Razorpay webhook signature verification, no card data stored

4. Student Module
Platform: Mobile App (Android + iOS) + Web

4.1 Authentication
    • Login via registered Mobile Number + OTP (6-digit, 5-minute expiry)
    • OTP delivered via SMS
    • Session managed via JWT tokens
    • Optional: single device login enforcement

4.2 Student Profile
Field
Type
Notes
Profile Photo
Image
Upload from camera or gallery
Full Name
Text

Date of Birth
Date

Gender
Enum
Male / Female / Other
Blood Group
Enum
A+, A-, B+, B-, O+, O-, AB+, AB-
Address
Text
Encrypted at rest
Registration Number
Unique ID
Auto-generated on admission
Admission Number
Unique ID
Auto-generated on admission
Class
Reference
Current academic year class
Section
Reference
Assigned section
Roll Number
Integer
Assigned per section
Academic Year
Reference
Current year
Parent/Guardian Details
Reference
Linked parent account
Previous Year Records
Archive
Viewable from profile

4.3 Attendance
    • Daily attendance status: Present / Absent / Late / Half Day
    • Monthly calendar view with color-coded status
    • Real-time attendance percentage tracker
    • Push notification sent immediately when marked absent
    • Progressive warning notifications: at 85%, 80%, and 75% attendance
    • Critical alert when below 75% — detention risk message shown
    • Leave application status (Pending / Approved / Rejected) visible
    • Below 75% at year-end: system flags student as Detained, blocks admit card and promotion

4.4 Timetable
    • Today's timetable auto-displayed based on current day
    • Weekly timetable view available
    • Free periods and substitution updates reflected in real time
    • Exam timetable: subject, date, time, venue

4.5 Academic Features
Feature
Details
Class Notes
View notes uploaded by teacher — PDF, image, video
Assignments
View assignments with due date, submit digitally
Submission Formats
Image (notebook photo) + PDF upload supported
Submission Timestamp
Recorded on every submission
Late Submission Warning
Shown if submitted after due date
Teacher Remarks
View grade and feedback from teacher
Syllabus Tracker
View subject syllabus with topic completion status
Results & Marksheet
View term-wise marks after admin publishes
Report Card
Download as PDF
School Calendar
Holiday list, important dates
Previous Year Records
Academic history viewable

4.6 Admit Card System
Admit cards are generated per term (Term 1, Term 2, Term 3). Two conditions must BOTH be met:
Condition
Rule
If Failed
Fee Payment
Term fee paid before deadline
Shows: Pay Term X fee to unlock admit card
Attendance
Attendance >= 75%
Shows: Minimum 75% attendance required
Both Failed
Fee unpaid AND attendance < 75%
Shows both warning messages simultaneously

Generated Admit Card contains:
    • Student photo, full name, class, section, roll number
    • Registration number, admission number
    • Exam timetable (subject, date, time, venue)
    • School name, logo, official stamp
    • Unique admit card number
    • Exam hall instructions and rules

4.7 Fee Section
    • Full 3-term fee structure visible
    • Term-wise payment deadlines displayed
    • Pending dues with due dates
    • Online payment: UPI, debit/credit card, net banking via Razorpay
    • Full payment history
    • Receipt download as PDF
    • Late fee notifications

4.8 Digital Student ID Card
    • Permanent digital ID card always accessible in app
    • Contains: photo, name, class, section, roll number, registration number, blood group, emergency contact, school logo, digital signature
    • QR code for instant identity verification by teachers/admin
    • Download as PDF

4.9 Communication
    • Chat with class teacher (doubt clearing)
    • Apply for leave with reason and number of days
    • View and bookmark school announcements and circulars
    • Download notice PDFs

4.10 Student Portfolio
    • Full academic timeline from admission to current year
    • Attendance history per year
    • Exam results per term per year
    • Achievements and certificates
    • Behavior remarks and awards
    • Downloadable as comprehensive PDF (useful for TC applications)

4.11 Complaint & Grievance
    • Submit complaints: Academic issue, Bullying, Teacher issue, Fee issue, General
    • Track complaint status: Submitted > Under Review > Escalated > Resolved
    • Notifications at each stage of escalation

4.12 Achievements & Behavior
    • View personal achievement timeline: Sports, Academic, Cultural
    • Download certificates
    • View behavior remarks (warnings and positive conduct)
    • Push notification on new achievement or warning

5. Parent Module
Platform: Mobile App (Android + iOS) + Web

5.1 Authentication
    • Login via registered Mobile Number + OTP
    • Single account manages multiple children (sibling support)
    • Quick switch between children from home screen

5.2 Child Overview Dashboard
    • All key information for each child visible on dashboard
    • Today's attendance status, upcoming fee dues, pending assignments, recent notices

5.3 Features (All Mirror Student App Plus Additional)
Feature
Parent Additional Capabilities
Profile
View full child profile; update guardian contact details
Attendance
Instant push notification if child absent; monthly & yearly summary
Timetable
View child's daily and weekly timetable
Academic
View notes, assignments, syllabus completion, report card download
Fee
Pay fee on behalf of child; download receipts; view sibling discounts
Admit Card
View and download admit card for child
Digital ID
View child digital ID card
Leave
Apply leave on behalf of child
Communication
Chat with class teacher directly
Notices
View and download all circulars and notices
Complaints
Submit and track complaints on behalf of child
Achievements
View child achievements and download certificates
Behavior
View behavior remarks and receive warning notifications
Portfolio
Full academic history of child
Progress Tracking
Marks trend graph, attendance trend, subject comparison, teacher feedback

5.4 Sibling Management
    • If two or more children are enrolled, all linked to one parent account
    • Auto-detected during bulk import via same mobile number
    • Sibling fee discount applied automatically if configured by admin
    • Switch between children with one tap

6. Teacher Module
Platform: Web Dashboard + Mobile App

6.1 Authentication
    • Login via Employee ID + Password
    • Role auto-detected: Class Teacher or Subject Teacher
    • Password rules: minimum 8 characters, bcrypt hashed
    • Account locked after 5 failed login attempts

6.2 Own Profile & Personal Attendance
    • Personal details: name, photo, employee ID, designation, qualification, joining date
    • Assigned subjects and classes visible
    • View fingerprint attendance records from school's biometric system
    • Monthly attendance summary and leave balance
    • Apply for leave through the system

6.3 Own Timetable
    • Auto-generated personal timetable from master timetable
    • Shows: Period number, Class, Subject, Day
    • Daily view auto-updates to current day
    • Yearly schedule available
    • Substitution notifications when assigned to cover a class

6.4 Class Teacher Features (Only for Assigned Class)
Student Management
    • Full student list with photos and profile details
    • Individual student deep profile view
    • View attendance history of each student
    • View fee defaulters in their class
    • Message individual student or parent
    • Send announcement to entire class

Attendance Management
    • Only class teacher can mark attendance for their assigned class
    • Attendance window opens at school start time, closes after 2 hours (configurable)
    • Mark each student: Present / Absent / Late / Half Day
    • Editing allowed same day only — after midnight, admin correction required
    • Every edit logged: who edited, when, original value, new value, reason
    • Approve or reject student leave applications
    • Monthly attendance reports, exportable as PDF or Excel
    • Flagged list of students below 75% attendance

Promotion Management (End of Year)
    • View final exam total marks for all students in class
    • System auto-flags students with attendance below 75% as Detained
    • Class teacher manually sets status for each student:
        ◦ Promoted — eligible for next class
        ◦ Detained — repeat same class (attendance/marks)
        ◦ Expelled — removed from system
        ◦ TC Issued — transfer certificate, archived
    • Submit promotion list to Academic Sub-Admin for approval
    • Class teacher cannot finalize — must be approved by admin

6.5 Subject Teacher Features (For Assigned Classes)
Notes & Assignments
    • Upload class notes: PDF, image, video — per subject per class
    • Create assignments with title, description, due date
    • View submission list: On Time / Late Submission / Not Submitted
    • Download submissions
    • Grade assignments and add written remarks
    • Mark assignment deduction for late submissions

Marks Entry
    • Enter exam marks for their subject after exams
    • Edit window: 24 hours from first entry
    • After 24 hours: Academic Sub-Admin unlock required to edit
    • After admin locks results: nobody can edit
    • Every edit logged with timestamp, old value, new value, reason
    • Grace marks can be added by admin only before final lock

Syllabus Management
    • Mark individual topics as covered
    • Syllabus completion percentage visible to students and parents in real time

6.6 Behavior & Discipline Recording
Record Type
Category
Late to class
Negative
Misbehavior
Negative
Dress code violation
Negative
Fighting / Aggressive behavior
Negative
Academic achievement
Positive
Good conduct / Helpfulness
Positive
Sports / Cultural achievement
Positive

    • 3 discipline warnings in a term triggers automatic parent push notification
    • Behavior records visible in student portfolio

6.7 Teacher Analytics Dashboard
    • Class average marks per subject
    • Top performers list
    • Weak students list (low marks)
    • At-risk students: low attendance + low marks + multiple missing assignments
    • Assignment completion rate per class
    • Exportable reports as PDF or Excel

7. Admin Module
Platform: Web Dashboard

7.1 Authentication
    • Admin ID + Password + Optional 2FA (OTP)
    • Full activity log of all admin actions
    • Session management with auto-logout on inactivity

7.2 School Management
    • Configure school name, logo, address, contact, affiliation board
    • Set academic year start and end dates
    • Configure school timings, period duration, working days
    • Manage school holidays and event calendar
    • Session rollover management

7.3 Student Management
Feature
Details
Add Student
Manual entry form for individual students
Bulk Import
Excel template download → fill → upload → validate → import
Bulk Photo Upload
ZIP file named by registration number — auto matched
Assign Class & Section
Manual assignment or auto from admission flow
Update Profile
Edit any student data
Transfer Student
Move between classes mid-year with reason log
Issue TC
Digital Transfer Certificate generation with school stamp
View Detained Students
List of all detained students per class
Promote Students
Year-end promotion with snake pattern section allotment
Archive Expelled/TC
Remove access, preserve records permanently

7.4 Teacher Management
    • Add new teacher with all details and employee ID
    • Assign subjects and classes
    • Activate or deactivate teacher accounts
    • View teacher attendance records
    • Bulk import via Excel template
    • Teacher workload dashboard: classes, periods per week, assignment count, student performance

7.5 Class & Section Management
    • Create classes: Nursery, KG, Class 1 through Class 12
    • Create sections per class: A, B, C, D
    • Assign class teacher to each section
    • Define class capacity (max students per section)
    • Configure half-day classes: Nursery and KG end at Period 5
    • Configure full-day classes: Class 1 to 12

7.6 Timetable Management
Setup Flow
    • Step 1: Admin configures master settings — period duration, number of periods, working days, lunch break position
    • Step 2: Admin creates subject-class mapping — which subjects are taught in which class
    • Step 3: Admin assigns teachers to subject-class combinations
    • Step 4: Admin uses visual drag-and-drop builder OR clicks Auto-Generate

Auto-Generation Rules
    • Distributes periods evenly across the week
    • No teacher double-booking — hard blocked
    • No same subject twice in one day — configurable warning
    • Respects half-day vs full-day schedule per class
    • Lunch break assigned correctly to all full-day sections
    • Teacher personal timetable auto-generated from section timetables

Conflict Detection
Conflict Type
System Response
Teacher assigned two classes same period
Hard block — cannot save
Half-day class given full-day period
Hard block — cannot save
Same subject twice in one day
Warning — admin can override
Teacher exceeds maximum periods per day
Warning — admin can override
Class teacher has no free period
Warning — admin can override

7.7 Examination Management
    • Create 3 term exams per academic year
    • Define subjects, maximum marks, passing marks per subject
    • Set exam dates, times, and venues
    • Publish exam timetable (visible to students and parents after publish)
    • Lock marks after verification — no further teacher edits
    • Add grace marks before locking
    • Configure grading system (A1, A2, B1... or percentage-based)
    • Generate report cards after all marks entered
    • Report card includes: subject marks, total, percentage, grade, class rank, section rank, teacher remarks, principal signature

7.8 Fee Management
Feature
Details
Fee Structure
Define fee categories: tuition, transport, library, sports, etc.
3 Term Deadlines
Set deadline date and amount for each term
Discounts
Apply student-specific or category discounts
Scholarships
Tag students as scholarship holders with reduced fee
Sibling Discount
Automatic discount for siblings — admin configures percentage
Late Fee Rules
Auto-apply late fee after deadline passes
Cash Entry
Finance sub-admin can record offline cash payments
Defaulter Tracking
Real-time list of students with unpaid dues
Financial Reports
Daily collection, term-wise collection, pending dues, receipts

7.9 Promotion System (Year-End)
Step-by-Step Flow
    • Step 1: Admin unlocks promotion module at year-end only
    • Step 2: Pre-promotion checklist enforced — all marks entered, all fees cleared or flagged, all class teacher submissions received
    • Step 3: Class teachers submit promotion list per student (Promoted/Detained/Expelled/TC)
    • Step 4: Academic Sub-Admin reviews and approves submissions
    • Step 5: System sorts promoted students by total final exam marks
    • Step 6: Snake pattern section allotment — Rank 1 → A, Rank 2 → B, Rank 3 → C, Rank 4 → D, Rank 5 → A, and so on
    • Step 7: Admin previews section allotment, can manually override any student
    • Step 8: Admin confirms — all profiles update, notifications sent to students and parents

Snake Pattern Allotment Example (4 Sections)
Rank 1 (Highest marks) → Section A
Rank 2 → Section B
Rank 3 → Section C
Rank 4 → Section D
Rank 5 → Section A  (pattern repeats)
Rank 6 → Section B
Result: Every section has equal mix of toppers and average students

7.10 Academic Year Management
    • Admin creates new academic year with start and end dates
    • Year rollover requires 100% checklist completion before proceeding
    • 30-day grace period: both old and new year can run simultaneously
    • All historical data permanently archived under respective academic year
    • New year starts with fresh attendance, timetable, fee structure
    • Teacher class assignments reset — must be reassigned for new year
    • Old year data always accessible — never deleted

7.11 Analytics & Reports Dashboard
    • Total students, total teachers, fee collection stats — live
    • Attendance overview: school-wide percentage today
    • At-risk student count: attendance risk + marks risk + assignment defaulters
    • Fee defaulter list with outstanding amounts
    • Class-wise and section-wise performance comparison
    • Teacher workload balance overview
    • Export all reports as PDF or Excel

7.12 Notification & Alert System
Priority Level
Delivery Method
Examples
Low
In-app only
General notices, activity updates
Medium
Push notification
Assignment due, exam timetable, results published
High
Push + SMS
Fee deadline, attendance warning, complaint escalation
Critical
Push + SMS + Repeat alert
School closure, emergency announcement, exam cancellation

    • Target options: All students / Specific class / Specific section / All teachers / All parents / Entire school
    • Notice categories: Academic / Holiday / Exam / Emergency / General
    • Notices posted in admin panel auto-sync to public website

8. Sub-Admin Module
8.1 Academic Sub-Admin
Permission
Details
Manage Subjects
Create, edit, assign subjects to classes
Approve Syllabus Updates
Review and approve teacher syllabus uploads
Exam Management
Create exams, publish timetable, verify marks, generate report cards, lock results
Promotion Approval
Review and approve class teacher promotion submissions
Section Allotment Oversight
Monitor snake pattern allotment, approve overrides
Academic Reports
View all academic performance reports
Assignment Monitoring
Track assignment completion rates school-wide
Marks Edit Unlock
Unlock teacher marks editing after 24-hour window
Discipline Oversight
Review behavior records, issue formal warnings
Cannot Access
Fee data, payment records, financial reports

8.2 Finance Sub-Admin
Permission
Details
Manage Fee Structure
Create and edit term fee amounts and deadlines
Payment Records
View all payment transactions
Admit Card Control
See fee payment status affecting admit card eligibility
Approve Discounts
Apply and approve fee discounts and scholarships
Cash Payment Entry
Record offline cash payments
Financial Reports
Daily, term-wise, yearly collection reports
Defaulter Tracking
Monitor and follow up on unpaid dues
Sibling Discounts
Manage automatic sibling discount rules
Cannot Access
Academic data, marks, attendance records, behavior logs

9. Admission & Lottery System
9.1 Online Registration (Public Portal)
    • Parents access registration form from public school website
    • Form fields: student name, DOB, gender, address, parent name, mobile, class applying for, previous school, document uploads (birth certificate, marksheet)
    • Registration fee payable online
    • On submission: unique Application Number generated, SMS confirmation sent
    • Application stored in ERP under Admission Applications dashboard

9.2 Lottery Process
    • Academic Sub-Admin views all applications per class with seat count
    • Admin triggers lottery per class — tamper-proof random selection algorithm
    • Lottery result logged with timestamp — cannot be re-run after confirmation
    • Results: Selected / Waiting List (numbered) / Not Selected
    • Instant SMS and push notification to all applicants

9.3 Post-Lottery Admission Flow
    • Selected parents receive link to complete full admission form
    • Full form: detailed personal info, document uploads, medical info, blood group, emergency contacts, photo
    • Deadline given for form completion — default 72 hours
    • Academic Sub-Admin verifies documents — Approve or Send Back
    • On academic approval: Finance Sub-Admin generates first term fee
    • Student account created in ERP only after fee payment confirmed
    • Auto-generated: Registration Number, Admission Number, Roll Number
    • Parent account created using mobile number — OTP login ready

9.4 Waiting List Automation
    • If selected student does not pay fee within deadline: seat automatically offered to Waiting List #1
    • Notification sent with 48-hour payment window
    • If unpaid: cascades to Waiting List #2, and so on
    • Admin dashboard shows real-time seat fill status per class

10. Special System Features
10.1 Weak Student Detection (At-Risk System)
Risk Flag
Trigger Condition
Visible To
Attendance Risk
Attendance drops below 80%
Teacher, Admin, Parent
Academic Risk
Marks below passing threshold in 2+ subjects
Teacher, Admin, Parent
Assignment Risk
3 or more missing/not submitted assignments
Teacher, Admin, Parent
Discipline Risk
3 or more behavior warnings in a term
Admin, Parent
Combined At-Risk
2 or more risk flags simultaneously
Teacher, Admin, Parent — high priority alert

    • Color-coded severity: Yellow (1 flag), Orange (2 flags), Red (3+ flags)
    • Dashboard widget on teacher and admin home screen
    • Parent receives notification when child enters at-risk status

10.2 Student Rank System
    • Class Rank, Section Rank, and School Rank calculated after each term
    • Ranks visible to student and parent after admin publishes results
    • Tiebreaker: alphabetical order by name
    • Can be toggled on/off globally in system settings
    • Printed on report card

10.3 Homework Reminder Automation
    • System scans pending assignments daily at configured time (e.g., 7:00 PM)
    • If student has 3 or more pending assignments: parent push notification triggered
    • Daily reminders continue until assignments are submitted or deadline passes
    • Teachers see real-time pending submission count per student

10.4 Complaint & Grievance Escalation
Stage
Handler
Time Limit
If Unresolved
1. Submitted
Student / Parent
—
Sent to Class Teacher
2. Class Teacher Review
Class Teacher
48 hours
Escalated to Academic Sub-Admin
3. Sub-Admin Review
Academic Sub-Admin
48 hours
Escalated to Admin
4. Admin Resolution
School Admin
72 hours
Final — marked resolved or rejected

    • Complaint status visible to submitter at all times
    • Automatic notification at each escalation stage to all parties

10.5 Digital Document Vault
    • Students can upload: Birth Certificate, Aadhar Card, Transfer Certificate, Medical Certificate, any school-required document
    • Documents stored encrypted in AWS S3
    • Admin and Academic Sub-Admin can view and download
    • Parents do not need to bring physical documents after initial upload
    • Document verification status: Pending / Verified / Rejected shown to parent

10.6 Library Management
    • Admin catalogs books: title, author, ISBN, copies available
    • Books issued to students by admin — linked to student profile
    • Due date tracked per issued book
    • Late return fine calculated automatically per day
    • Student sees issued books and due dates in app
    • Fine must be cleared before TC issuance

10.7 Substitution Management
    • When a teacher is absent: admin sees all unassigned periods for that day
    • Admin assigns available teacher as substitute for each affected period
    • Substitute teacher gets push notification with class and period details
    • Students and parents see updated timetable automatically
    • Substitution logged separately — original timetable never modified
    • Substitute teacher gets one-day attendance marking permission for covered class

11. Public School Website
11.1 Pages & Content
Page
Content
Home
School intro, vision, mission, quick stats, latest notices
About Us
School history, principal message, achievements, accreditation
Academics
Curriculum overview, subjects by class, streams offered
Facilities
Labs, library, sports, transport, infrastructure photos
Gallery
School event photos and albums
News & Events
Latest news, upcoming events
Achievements
Student and school awards and recognitions
Admission
Online registration form — directly feeds into ERP
Notice Board
Public notices and circulars (synced from ERP)
Contact Us
Address, Google Maps, phone, email, contact form

11.2 ERP Integration
    • Notices posted in admin panel automatically appear on website notice board
    • School events created in ERP auto-populate website events page
    • Student achievements added in ERP reflect on website achievements page
    • Emergency alerts from ERP appear as banner on website homepage
    • Online admission form on website feeds directly into ERP admission module — zero duplication

11.3 Branding
    • School logo and branding throughout
    • Footer: Powered by SaiyoniX
    • Mobile responsive design
    • Fast load optimized via Cloudflare CDN

12. Data Architecture
12.1 Core Database Tables (Estimated 70-90 Tables)
Table Group
Key Tables
Users & Auth
users, roles, permissions, sessions, otp_logs, login_attempts
School Setup
schools, academic_years, classes, sections, subjects, holidays
Students
students, student_profiles, parent_student_links, document_vault
Teachers
teachers, teacher_subject_class, teacher_attendance
Timetable
timetable_slots, substitutions, period_config
Attendance
attendance_records, attendance_corrections, attendance_audit_log
Academics
notes, assignments, submissions, syllabus, syllabus_topics
Exams & Results
exams, exam_subjects, marks, report_cards, admit_cards
Fee & Finance
fee_structures, fee_terms, fee_deadlines, payments, receipts, discounts, scholarships
Behavior
behavior_records, discipline_warnings, achievements, certificates
Communication
messages, notifications, notice_board, circulars, complaints, complaint_escalations
Admission
applications, lottery_runs, admission_forms, waiting_list
Library
books, book_issues, fines
Events
school_events, event_participants
Audit
audit_logs, correction_logs, marks_edit_log, payment_audit

12.2 Data Retention Policy
Data Type
Retention Policy
Student academic records
Permanent — never deleted, archived per year
Fee payment records
Permanent — financial compliance
Attendance records
Permanent — archived per year
Behavior & discipline records
Permanent — part of student portfolio
Audit logs
Minimum 7 years
OTP logs
30 days
Session tokens
Purged on expiry
Deleted student (expelled/TC)
Profile archived, app access removed, data preserved

13. API Architecture Overview
13.1 API Design Principles
    • RESTful API design with consistent endpoint naming conventions
    • All endpoints require valid JWT token (except public auth and admission registration)
    • RBAC middleware validates role permission on every request
    • Standardized response format: { success, data, message, pagination }
    • API versioning: /api/v1/ prefix on all endpoints
    • Rate limiting per user and per IP

13.2 Estimated Endpoint Count by Module
Module
Estimated Endpoints
Authentication
8
Student Management
25
Teacher Management
20
Attendance
18
Timetable
15
Academic (Notes, Assignments, Syllabus)
30
Exam & Results
25
Fee & Payments
22
Admit Card & Digital ID
10
Behavior & Achievements
15
Communication & Notifications
20
Complaints & Grievance
12
Admission & Lottery
18
Library
10
Reports & Analytics
20
System Settings & Year Management
15
Document Vault
8
Events & Notice Board
12
Total (Estimated)
303

14. Deployment & DevOps
14.1 Environment Setup
Environment
Purpose
Infrastructure
Development
Local development
Local machines + shared dev DB
Staging
QA and testing
Single server, production replica
Production
Live system
AWS multi-instance, auto-scaling

14.2 Production Infrastructure
    • AWS EC2 Auto Scaling Group — minimum 3 backend instances, scales to 10+ on peak load
    • AWS RDS PostgreSQL — Multi-AZ deployment for high availability
    • AWS S3 — file storage with lifecycle policies
    • AWS ElastiCache (Redis) — caching and session management
    • AWS ALB — Application Load Balancer with health checks
    • Cloudflare — CDN, DDoS protection, DNS management
    • Docker containers for all services — consistent deployments
    • Kubernetes (EKS) or ECS for container orchestration

14.3 CI/CD Pipeline
    • GitHub repository with branch protection on main
    • GitHub Actions: automated tests on every pull request
    • Docker build and push to AWS ECR on merge to main
    • Auto-deploy to staging, manual approval for production
    • Rollback capability — one-click revert to previous version

14.4 Monitoring & Alerting
    • Sentry — real-time error tracking and alerting
    • Datadog — server metrics, API response times, database performance
    • Uptime monitoring — alert within 1 minute of downtime
    • Payment failure alerting — immediate notification to admin
    • Database slow query logging — detect performance issues early

15. Bulk Data Import & Onboarding
15.1 Student Bulk Import (Excel)
For schools with existing students (3,360 to 5,040 students), manual entry is not feasible. The system provides:

    • Downloadable Excel template with all required columns
    • School fills template from existing registers
    • Admin uploads Excel — system validates every row before import
    • Validation errors highlighted in red with clear descriptions
    • Preview of clean rows before final import
    • Auto-generation of Registration Number, Admission Number, Roll Number
    • Auto-creation of parent accounts from parent mobile numbers
    • Auto-detection of siblings (same parent mobile)

15.2 Bulk Photo Import
    • Admin uploads ZIP file of student photos
    • Photos must be named: RegistrationNumber.jpg
    • System auto-matches photos to student profiles
    • Unmatched photos flagged for manual assignment
    • Background processing job — does not block system during import

15.3 Estimated Onboarding Timeline
Task
Responsible
Time Estimate
School fills student Excel template
School staff
3-5 days
Admin uploads & validates data
SaiyoniX + Admin
1 day
Bulk photo upload
SaiyoniX team
1 day
Teacher data entry
Admin
Half day
Timetable setup
Admin
1-2 days
Fee structure configuration
Finance Sub-Admin
Half day
Testing & verification
SaiyoniX
2 days
Staff training
SaiyoniX
1 day
Total

~10 days

16. Mobile Application
16.1 Technology
    • Framework: Flutter (Dart) — single codebase for Android and iOS
    • State Management: Riverpod or BLoC
    • Local Storage: SQLite for offline data (timetable, notes caching)
    • Push Notifications: Firebase FCM
    • Payment: Razorpay Flutter SDK
    • QR Scanning: Camera + QR decoder library

16.2 Offline Mode
    • Timetable viewable offline (cached on last sync)
    • Downloaded class notes available offline
    • Attendance history cached for offline viewing
    • Auto-sync when connectivity restored
    • Important given connectivity challenges in Manipur region

16.3 App Features by User
User
Key Mobile Features
Student
Attendance, timetable, notes, assignments, fee, admit card, digital ID, chat, notifications
Parent
Child monitoring, fee payment, chat with teacher, notifications, progress graphs
Teacher
Attendance marking, timetable view, assignment management, student list, notifications

16.4 Additional App Features
    • Dark mode support
    • Multi-language support — English + Meitei/Manipuri (future phase)
    • Biometric login (fingerprint/face ID) after initial OTP setup
    • In-app notification center

17. System Settings
Setting
Default
Configurable By
Attendance threshold for detention
75%
Admin
Attendance warning levels
85%, 80%, 75%
Admin
Attendance window duration
2 hours from school start
Admin
Marks edit window
24 hours
Admin
Late fee percentage
Custom
Finance Sub-Admin
OTP expiry time
5 minutes
Super Admin
Login attempt limit
5 attempts
Super Admin
Session timeout
8 hours
Admin
Promotion unlock
Manual by Admin at year-end
Admin
Student rank system
Enabled
Admin (toggle)
Section allotment method
Snake pattern (auto)
Admin
Admit card conditions
Fee paid + 75% attendance
Admin
Homework reminder threshold
3 pending assignments
Admin
School working days
Monday to Saturday
Admin
Period duration
45 minutes
Admin
Sibling discount
Custom percentage
Finance Sub-Admin

18. Development Roadmap
18.1 Recommended Phased Delivery
Phase
Modules
Duration (Est.)
Phase 1 — Core Foundation
Auth & RBAC, Student & Teacher Management, Bulk Import, Class & Section Setup, Basic Timetable
6-8 weeks
Phase 2 — Daily Operations
Attendance System, Notice Board, Basic Notifications, Teacher & Student Dashboards, Mobile App (basic)
6-8 weeks
Phase 3 — Academic & Exams
Notes & Assignments, Syllabus, Exam & Results, Admit Card, Report Cards, Student Ranks
6-8 weeks
Phase 4 — Finance
Fee Management, Online Payments (Razorpay), Receipts, Scholarships, Financial Reports
4-6 weeks
Phase 5 — Advanced Features
Behavior & Discipline, Achievements, Complaint Escalation, Digital ID (QR), Document Vault, Library
4-6 weeks
Phase 6 — Intelligence Layer
Analytics Dashboards, Weak Student Detection, Workload Dashboard, Rank System, Homework Automation
3-4 weeks
Phase 7 — Admission & Website
Admission Form, Lottery System, Public School Website, ERP-Website Integration
4-5 weeks
Phase 8 — Scale & Polish
Performance optimization, Load testing (20k concurrent), Offline mobile mode, Multi-language prep, Security audit
3-4 weeks

18.2 Total Estimated Timeline
Development Timeline Summary
Phase 1-4 (Core ERP):         ~24-30 weeks (~6-7 months)
Phase 5-7 (Advanced + Website): ~11-15 weeks (~3 months)
Phase 8 (Scale & Security):    ~3-4 weeks

Total Estimated Duration: 9-12 months (full team)
Recommended Team: 2 Backend Devs, 2 Frontend/Flutter Devs, 1 UI/UX Designer, 1 QA Engineer, 1 Project Lead

19. Glossary
Term
Definition
RBAC
Role-Based Access Control — permissions assigned by user role
JWT
JSON Web Token — secure authentication token
OTP
One-Time Password — 6-digit code for mobile login
FCM
Firebase Cloud Messaging — push notification service
Snake Pattern
Section allotment method: A→B→C→D→A→B... by marks rank
Academic Year
School year cycle, e.g., April 2025 to March 2026
TC
Transfer Certificate — issued when student leaves school
Detained
Student repeating same class — below 75% attendance or failed
Admit Card
Exam entry pass — requires fee payment + 75% attendance
At-Risk Student
Student flagged for low attendance, marks, or missing assignments
Bulk Import
Mass upload of student/teacher data via Excel template
Read Replica
Database copy used for read-heavy queries to reduce load on primary
Idempotency Key
Unique key preventing duplicate payment processing
PgBouncer
PostgreSQL connection pooler for high concurrency
CDN
Content Delivery Network — serves static assets from edge servers

20. Existing Student & Teacher Data Entry
This section explains how the school's existing student and teacher data — currently in physical registers — is entered into the ERP database during initial onboarding. This is a one-time process that must be completed carefully before the system goes live.

20.1 Scale of Existing Data
Data Type
Estimated Volume
Entry Method
Students
3,360 - 5,040 records
Bulk Excel Import
Parent accounts
2,500 - 4,000 records
Auto-generated from student Excel
Teachers
60 - 80 records
Bulk Excel Import
Class & section setup
56 sections
Manual by Admin (one-time)
Timetable
56 section timetables
Excel import or Admin builder
Student photos
3,360 - 5,040 photos
Bulk ZIP upload
Teacher photos
60 - 80 photos
Individual upload or ZIP
Fee structure
3 terms x categories
Manual by Finance Sub-Admin
Historical records (optional)
Previous year marks/attendance
Excel import per year

20.2 Student Data Entry — Step by Step
Step 1: Download Excel Template
    • Admin logs into ERP and downloads the official Student Import Template
    • Template contains clearly labeled columns with instructions and example data
    • Template available per class or as a single school-wide sheet

Step 2: Fill the Template
The school's data entry staff fills the Excel sheet from physical registers. Required columns:
Column
Format
Required
Notes
Full Name
Text
Yes

Date of Birth
DD/MM/YYYY
Yes

Gender
Male / Female / Other
Yes

Blood Group
A+, A-, B+, B-, O+, O-, AB+, AB-
No
Leave blank if unknown
Address
Text
Yes

Class
Nursery / KG / 1 to 12
Yes
Must match class names in ERP
Section
A / B / C / D
Yes
Must match sections in ERP
Roll Number
Integer
No
Auto-assigned if blank
Admission Number
Text
No
If school has existing numbers; else auto-generated
Parent / Guardian Name
Text
Yes

Parent Mobile Number
10-digit
Yes
Used for parent login — must be unique per parent
Parent Email
Email
No
Optional
Emergency Contact Name
Text
Yes

Emergency Contact Mobile
10-digit
Yes

Admission Date
DD/MM/YYYY
No
Defaults to current date if blank
Previous School
Text
No
For transfer students

Step 3: Upload & Validate
    • Admin uploads the filled Excel file in the ERP admin panel under Student Management > Bulk Import
    • System runs full validation on every row before importing any data
    • Validation checks performed:
        ◦ Duplicate parent mobile — same number used for two unrelated students (flagged, not blocked if siblings)
        ◦ Missing required fields — row highlighted red with specific column name
        ◦ Invalid class or section name — must match ERP configuration
        ◦ Invalid date format — must be DD/MM/YYYY
        ◦ Duplicate student name in same class/section — warning shown, not blocked
        ◦ Invalid blood group value — must match allowed options
    • System shows a validation summary: total rows, clean rows, error rows
    • Admin can download an error report, fix errors, and re-upload the corrected file
    • Admin reviews clean rows in a preview table before confirming final import

Step 4: System Auto-Generates on Import
Auto-Generated Item
Logic
Registration Number
Unique ID — format: SYXYYYYNNNNN (e.g. SYX2025001234)
Admission Number
Unique ID per school — sequential or custom prefix
Roll Number
Auto-assigned per section in alphabetical order (if not provided)
Parent Account
Created using parent mobile number — OTP login enabled immediately
Sibling Link
If same parent mobile found for two students — auto-linked as siblings
Student Login
Mobile number + OTP ready from day one
Default Profile Photo
Placeholder avatar until photo uploaded

Step 5: Bulk Photo Upload
    • Admin prepares a ZIP file of all student photos
    • Each photo must be named exactly as the student's Registration Number (e.g. SYX2025001234.jpg)
    • Accepted formats: JPG, JPEG, PNG — max 2MB per photo before compression
    • System compresses photos to max 200KB after upload
    • Admin uploads the ZIP file — processed as a background job
    • System matches each photo filename to the corresponding Registration Number
    • Matched photos assigned to student profiles automatically
    • Unmatched photos listed in a report for manual review
    • Process runs in background — admin can continue other work during upload

20.3 Teacher Data Entry — Step by Step
Step 1: Download Teacher Import Template
    • Separate Excel template for teachers available in Admin panel under Teacher Management > Bulk Import

Step 2: Fill Teacher Template
Column
Format
Required
Notes
Full Name
Text
Yes

Employee ID
Text
No
Auto-generated if blank — format: TYX001
Designation
Text
Yes
e.g. PGT, TGT, PRT, Headmaster
Department
Text
Yes
e.g. Science, Mathematics, Languages
Subjects
Comma-separated
Yes
e.g. Physics, Chemistry
Assigned Classes
Comma-separated
Yes
e.g. Class 9, Class 10, Class 11
Class Teacher Of
Class-Section
No
e.g. 9-A (leave blank if not class teacher)
Joining Date
DD/MM/YYYY
Yes

Qualification
Text
Yes
e.g. M.Sc Physics, B.Ed
Mobile Number
10-digit
Yes
Used for login
Email
Email
No
Optional
Address
Text
No
Optional

Step 3: Upload, Validate & Import
    • Same validation process as student import
    • System auto-generates Employee ID if not provided
    • Login credentials created: Employee ID + temporary password (must change on first login)
    • Teacher-subject-class matrix built automatically from import data
    • This matrix becomes the foundation for auto-generating the timetable

20.4 Historical Data Import (Optional)
For schools that want to migrate previous years' data into the system:
    • Separate Excel templates available for: previous year marks, previous year attendance summary, previous year fee payment history
    • Data imported under the specified academic year (e.g. 2023-2024)
    • Archived automatically — visible in student portfolio under Previous Years
    • Not required for go-live but recommended for continuity

20.5 Post-Import Verification Checklist
Check
How to Verify
Total student count matches register
Admin dashboard shows total students per class
All sections have correct student count
Section-wise student list downloadable
Parent accounts created correctly
Sample parent mobile tested for OTP login
Siblings correctly linked
Check sibling accounts in parent profile
Photos correctly assigned
Random sample of student profiles checked
Teacher-class assignments correct
Timetable builder shows correct teacher-subject matrix
Roll numbers assigned correctly
Section-wise roll list downloaded and verified
Registration numbers all unique
System enforces uniqueness — no duplicates possible

21. Biometric Attendance System Integration
The school uses an existing fingerprint biometric machine for teacher attendance. This section explains how to link that hardware system with the SaiyoniX ERP so teacher attendance data flows automatically into the platform without manual entry.

21.1 How Biometric Machines Work
Most fingerprint attendance machines used in schools and offices operate in one of two ways:
Type
How It Works
Integration Approach
Standalone Machine with SDK
Machine stores logs locally, exports via USB or LAN. Manufacturer provides a Windows SDK or API.
Pull-based: ERP fetches logs from machine periodically via SDK or local API
Cloud-Connected Machine
Machine pushes attendance logs to manufacturer's cloud server in real time.
Push-based: ERP receives webhook from cloud or polls manufacturer's cloud API
ZKTeco / eSSL / Realtime compatible
Most common brands in Indian schools. All support LAN-based data pull.
ZKTeco SDK / ADMS protocol — well-documented integration

Important Note for SaiyoniX Team
Before building the integration, identify the exact brand and model of the school's biometric machine.
Common brands in Manipur schools: ZKTeco, eSSL, Realtime, Virdi, Matrix.
Each brand has its own SDK or API. ZKTeco is the most common and has the best-documented SDK.
Ask the school: What brand is the machine? Is it connected to LAN or standalone USB only?

21.2 Integration Architecture
Option A — LAN / Network Based Integration (Recommended)
This is the cleanest integration method if the biometric machine is connected to the school's local network:
    • Step 1: Biometric machine connected to school LAN (most modern machines support this)
    • Step 2: SaiyoniX deploys a small Bridge Server — a lightweight service running on a local PC or Raspberry Pi on the same network
    • Step 3: Bridge Server communicates with biometric machine using the manufacturer's SDK or protocol (e.g. ZKTeco ADMS)
    • Step 4: Bridge Server pulls punch records every 5-15 minutes and sends them to the SaiyoniX cloud API
    • Step 5: ERP receives the data, matches it to teacher profiles, and updates attendance records

Component
Technology
Location
Biometric Machine
ZKTeco / eSSL (existing hardware)
School premises
Bridge Server
Node.js service + manufacturer SDK
School LAN (local PC or Raspberry Pi)
Communication Protocol
ZKTeco ADMS or TCP/IP push
Local network
Cloud API Endpoint
SaiyoniX REST API — POST /api/v1/biometric/punch
AWS cloud
Data Sync Frequency
Every 5-15 minutes (configurable)
—
Fallback
Manual sync via USB export if LAN fails
—

Option B — USB / Manual Export (Fallback)
    • Biometric machine exports attendance log as CSV or Excel via USB
    • School admin downloads the file from machine and uploads to ERP
    • ERP parses and imports the records, matches to teacher Employee IDs
    • Less real-time but works with any biometric machine regardless of brand
    • Recommended as fallback when LAN integration is not possible

21.3 Data Flow — Punch to ERP
Step
Action
System
1
Teacher places finger on biometric machine at entry/exit
Biometric Hardware
2
Machine records: Employee ID, Punch Time, Punch Type (IN/OUT)
Biometric Hardware
3
Bridge Server polls machine every 10 minutes, retrieves new punch logs
Bridge Server (LAN)
4
Bridge Server sends punch data to SaiyoniX API with school authentication token
Bridge Server → Cloud API
5
API receives punch data, validates Employee ID against teacher records
SaiyoniX Backend
6
System calculates attendance status: Present / Late / Half Day / Absent
SaiyoniX Backend
7
Teacher attendance record updated in database
PostgreSQL
8
Teacher can view their attendance in the app
Teacher Mobile/Web App
9
Admin can view all teacher attendance in dashboard
Admin Web Dashboard

21.4 Attendance Status Logic
Condition
Status Assigned
Example
Punch IN before or at school start time
Present
Punch at 7:55 AM, school starts 8:00 AM
Punch IN within 30 minutes of start time
Late
Punch at 8:20 AM (configurable late threshold)
Punch IN after 30 minutes of start time
Very Late / Half Day
Punch at 10:00 AM
No punch IN record for the day
Absent (auto-marked at end of day)
No record found
Punch IN + Punch OUT (early departure)
Half Day
IN at 8:00, OUT at 12:00
On approved leave in ERP
On Leave
Leave approved by admin in system

    • Late threshold configurable by admin (default: 30 minutes after school start)
    • Half day threshold configurable (default: less than 4 hours on premises)
    • Auto-absent marking runs as a scheduled job at end of school day
    • Teacher can view their own attendance records — any discrepancy must be reported to admin
    • Admin can correct attendance with reason logged in audit trail

21.5 Employee ID Mapping
For the biometric integration to work, the Employee ID stored in the biometric machine must match the Employee ID in the SaiyoniX ERP. During onboarding:
    • Admin exports the employee list from the biometric machine software
    • Maps each biometric Employee ID to the corresponding teacher in ERP during teacher import
    • Field in teacher Excel template: Biometric Employee ID (if different from ERP Employee ID)
    • System stores the mapping — uses biometric ID to look up teacher profile on every punch
    • New teachers added to ERP must also be enrolled in biometric machine — both systems updated together

21.6 Handling Common Issues
Issue
System Handling
Duplicate punch (finger scanned twice)
System ignores duplicate punches within 5-minute window
Biometric machine offline
Bridge Server queues logs locally and syncs when machine comes back online
LAN connectivity loss
Bridge Server stores unsynced records locally, retries every 2 minutes
Wrong punch (another teacher's finger misread)
Admin can correct with reason — logged in audit trail
Teacher forgets to punch
Admin manually marks attendance with reason
New teacher not enrolled in biometric
Punch data has no matching Employee ID — flagged for admin review
Machine clock drift (wrong time)
Bridge Server uses server time for sync timestamp, not machine time

22. New Student Registration System
This section explains in detail how newly applying students go from public registration to being fully active in the ERP — covering the complete admission lifecycle.

22.1 Registration Portal (Public Facing)
Accessible from the school's public website without any login. Any parent can register their child for admission.
Field
Type
Required
Student Full Name
Text
Yes
Date of Birth
Date
Yes
Gender
Dropdown
Yes
Class Applying For
Dropdown (available classes only)
Yes
Parent / Guardian Name
Text
Yes
Parent Mobile Number
10-digit (verified via OTP)
Yes
Parent Email
Email
No
Current Address
Text
Yes
Previous School Name
Text
No (required for Class 2+)
Birth Certificate
PDF/Image upload
Yes
Previous Marksheet
PDF/Image upload
No (required for Class 2+)
Registration Fee
Online payment via Razorpay
Yes

    • Parent mobile number verified via OTP before form submission — prevents fake applications
    • Registration fee payment required to complete submission — deters non-serious applications
    • On successful submission: unique Application Number generated (format: APP-2025-XXXXX)
    • Confirmation SMS sent immediately to parent with Application Number
    • Parent can check application status on website using Application Number — no login needed

22.2 Admin Admission Dashboard
    • Academic Sub-Admin sees all applications per class with total count vs seat capacity
    • Filter by: class, status (Pending / Lottery Done / Selected / Admitted / Rejected)
    • Download full applicant list as Excel for any class
    • View individual application details and uploaded documents

22.3 Lottery System — Detailed Flow
Pre-Lottery Setup
    • Admin sets seat capacity per class before running lottery (e.g. Class 1 = 240 seats across 4 sections)
    • Admin can define reservation categories if applicable (e.g. staff children, siblings of existing students)
    • Reserved category seats filled first before open lottery

Running the Lottery
    • Admin clicks Run Lottery for a specific class
    • System uses a cryptographically secure random number generator — cannot be manipulated
    • Lottery run is logged with exact timestamp, total applicants, seats available, and random seed
    • Results generated: Selected (up to seat count), Waiting List (numbered 1, 2, 3...), Not Selected
    • Admin previews results before confirming — cannot change individual selections
    • Admin clicks Confirm Lottery — results finalized and locked
    • Instant SMS sent to all applicants with their result

Post-Lottery Actions
Result
Next Step
Timeline
Selected
Parent receives link to complete full admission form
72-hour deadline
Waiting List
Parent notified of position, told to wait
Offered seat if selected student drops
Not Selected
Parent notified, registration fee refunded (optional per school policy)
Immediate notification

22.4 Full Admission Form (Selected Students Only)
Selected parents receive a secure link to complete the detailed admission form:
    • All basic registration data pre-filled — parent only adds missing details
    • Additional fields: blood group, medical conditions, emergency contact 2, religion, category, transport requirement
    • Upload: passport photo, Aadhar card, address proof, medical certificate if applicable
    • Parent digitally confirms all details are accurate
    • Academic Sub-Admin reviews and either Approves or Returns for correction
    • On approval: Finance Sub-Admin generates first term fee invoice
    • Payment link sent to parent via SMS

22.5 Student Account Creation (Post Fee Payment)
Student account is created in the ERP automatically only after fee payment is confirmed by Razorpay webhook:
    • Registration Number auto-generated (format: SYX-YEAR-NNNNN)
    • Admission Number auto-generated (school-specific format)
    • Class and section assigned manually by admin (or via snake pattern if bulk promotion)
    • Roll number auto-assigned within section
    • Parent account activated — OTP login now works
    • Welcome SMS sent to parent with student Registration Number
    • Student profile immediately visible in admin dashboard, teacher class list, and parent app

22.6 Waiting List Automation
Event
Automated Action
Selected student does not pay fee within 72 hours
Seat offered to Waiting List #1 automatically
Waiting list parent notified
SMS + push notification with 48-hour deadline
Waiting list parent does not pay in 48 hours
Seat cascades to Waiting List #2
All waiting list exhausted
Seat marked as unfilled — admin notified
Selected student pays late (after deadline passed)
System checks if seat already re-offered; if not, still accepts payment

23. Unique Features — Detailed Explanation
This section explains the more complex or unique system features in depth so that developers, school administrators, and stakeholders fully understand how they work.

23.1 Snake Pattern Section Allotment
After year-end promotions, students are redistributed across sections in the next class. The snake pattern ensures every section has an equal mix of high-performing and average students — no section becomes the elite class.

How Snake Pattern Works
All promoted students from Class 9 are sorted by total final exam marks (highest to lowest).
Sections assigned in repeating pattern: A → B → C → D → A → B → C → D...

Example with 80 students, 4 sections (20 each):
Rank 1 (95%) → Section A    |    Rank 2 (93%) → Section B
Rank 3 (91%) → Section C    |    Rank 4 (90%) → Section D
Rank 5 (88%) → Section A    |    Rank 6 (87%) → Section B
...and so on until all 80 students are assigned.

Result: Each section gets Rank 1, 5, 9, 13... (every 4th rank) — perfectly balanced.

    • Tiebreaker: If two students have identical total marks, sorted alphabetically by first name
    • Admin can manually override any individual student's section after auto-assignment
    • System recalculates remaining assignments automatically after manual override
    • Admin must set section capacity before running allotment
    • Detained, expelled, and TC students are excluded from the promotion pool entirely

23.2 Admit Card Lock System
The admit card system enforces two hard rules before a student can generate their exam entry pass. Both conditions must be satisfied simultaneously.
Condition
Source of Data
How Checked
Term fee paid before deadline
Fee payment records — confirmed by Razorpay webhook
Fee status = PAID and payment_date <= deadline_date
Attendance >= 75% for the term
Daily attendance records for that academic year
Calculated: (present_days / total_school_days) * 100 >= 75

    • Admit card is a system-generated PDF — not pre-made; generated fresh on demand
    • Once unlocked, student can generate and download anytime before exam
    • Admin can manually override and unlock for specific students (e.g. scholarship students with fee waiver)
    • Each term has its own admit card — Term 1, Term 2, Term 3 are independent
    • Admit card contains a unique alphanumeric code verifiable by exam supervisors

23.3 Digital Student ID with QR Verification
Every student has a permanent digital ID card inside their app. This replaces physical ID cards and adds instant verification capability.
    • QR code is unique to each student — encoded with Registration Number + school ID + checksum
    • QR code does not contain personal data — only a lookup key
    • Teacher or admin scans QR code using any QR scanner (including mobile camera)
    • ERP instantly shows: student photo, name, class, section — confirms identity in real time
    • Useful during exams (verifying identity at exam hall entry), events, and campus access checks
    • QR code rotates every 24 hours — prevents screenshots being used by others
    • PDF version downloadable and printable for students without smartphones

23.4 Academic Year Rollover System
The year rollover is the most critical system operation — it transitions all 4,000+ students from one academic year to the next. It is designed to be safe, reversible, and checksum-verified.
Pre-Rollover Mandatory Checklist
Checklist Item
Verified By
All term exam marks entered and locked
System auto-check
All class teacher promotion lists submitted
System auto-check
All promotion lists approved by Academic Sub-Admin
System auto-check
New academic year created with start/end dates
Admin
New class and section structure created
Admin
Fee structure for new year configured
Finance Sub-Admin
New timetable created or ready to create
Admin

    • System will not allow rollover if any checklist item is incomplete
    • 30-day overlap period: both current and new year run simultaneously — no disruption
    • During overlap: old year read-only, new year active for new operations
    • Full data snapshot taken before rollover — recovery point available for 30 days
    • After rollover confirmed: all student profiles auto-update, notifications sent school-wide

23.5 At-Risk Student Detection System
The ERP automatically monitors every student across three dimensions and flags those who need attention — without waiting for a teacher to notice.
Risk Dimension
Trigger
Alert Sent To
Attendance Risk
Attendance drops below 80%
Class teacher + Parent (push notification)
Academic Risk
Below passing marks in 2 or more subjects in latest term
Class teacher + Parent
Assignment Risk
3 or more assignments not submitted
Subject teacher + Parent (automated reminder)
Discipline Risk
3 or more behavior warnings in current term
Class teacher + Admin + Parent
Critical Risk
Any 2 or more of the above simultaneously
Class teacher + Admin + Parent (high priority SMS)

    • Teacher dashboard shows At-Risk Students widget — updated in real time
    • Admin dashboard shows school-wide at-risk count with drill-down by class
    • Parent app shows a gentle alert: Your child may need additional support — without alarming language
    • System does not penalize the student — it is purely an early warning tool
    • Once the risk condition is resolved (attendance improves, marks improve), flag is automatically removed

23.6 Complaint Escalation Workflow
Complaints follow a structured escalation path ensuring no complaint is ignored. Every stage has a time limit.
Stage
Assigned To
Time Limit
Notification on Escalation
1 — Submitted
System receives complaint
—
Confirmation SMS to submitter
2 — Class Teacher Review
Class Teacher assigned to student
48 hours to respond
Teacher notified, submitter notified
3 — Academic Sub-Admin
Auto-escalated if teacher doesn't respond in 48 hrs
48 hours to resolve
Sub-admin notified, submitter notified
4 — Admin Resolution
Auto-escalated if sub-admin doesn't resolve in 48 hrs
72 hours final
Admin notified, full thread visible
5 — Closed
Admin marks resolved or rejected with reason
—
Submitter notified with resolution

    • Submitter can see current stage and assigned handler at all times
    • No one can delete a complaint — only resolve or reject with reason
    • Admin can see all open complaints sorted by priority and age
    • Complaints older than 7 days without resolution flagged as Overdue in red

23.7 Teacher Timetable Auto-Generation
Teachers never need a separately created timetable. Their personal schedule is derived automatically from the 56 section timetables.
    • When admin assigns a teacher to a subject for a class/section in the timetable builder, the system records that assignment
    • Teacher's personal timetable is a live query: show all timetable slots where teacher_id = X
    • If admin changes a class timetable, the affected teacher's personal view updates instantly — no separate update needed
    • Teacher sees their daily schedule: Period 1 — Class 9A Math, Period 2 — Free, Period 3 — Class 10B Math
    • Free periods clearly marked — teacher knows exactly when they have no class
    • Substitution assignments appear as temporary entries — clearly labeled as SUBSTITUTE

23.8 Fee Payment with Concurrency Safety
During fee deadlines, thousands of parents may attempt payment simultaneously. The system handles this safely:
    • Every payment initiated gets a unique idempotency key — if the same parent submits twice (double-tap), only one payment is processed
    • Payment requests queued via Bull (Redis-backed job queue) — database never receives 10,000 writes simultaneously
    • Razorpay handles the actual payment processing — SaiyoniX only receives confirmation via webhook
    • Webhook verification: every Razorpay callback verified using HMAC signature — prevents fake payment confirmations
    • Payment status uses optimistic locking — prevents race conditions where two processes update the same record
    • Receipt generated asynchronously after payment — does not block the payment confirmation response
    • Failed payments logged with reason — parent sees clear error message and can retry


Document End

SaiyoniX Pvt Ltd — Confidential
Building the future of school management in Northeast India.