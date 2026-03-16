# Phase 1 Checklist (Core Foundation)

Reference: `docs/project-doc.md` section 18.1 (Phase 1)

## 1. Auth + RBAC
- [x] Enforce final auth policy from PRD: access token `15m`, refresh token `7d`
- [x] Change OTP expiry to `5m`, max `3` attempts, cooldown `15m`
- [x] Apply `authLimiter` on login endpoint
- [x] Store OTP as hash (never plain OTP in DB)
- [x] Remove OTP from console logs; integrate real SMS gateway abstraction
- [x] Implement admin unlock workflow for locked accounts
- [x] Add role-permission tables wiring and permission middleware checks
- [x] Add secure session revoke-all and device/session listing APIs

## 2. Student Management (minimum Phase 1 scope)
- [x] Create `students`, `student_profiles`, `student_enrollments` CRUD APIs
- [x] Add registration/admission number generation service
- [x] Add parent linkage (`parents`, `parent_student_links`)
- [x] Add validation rules for class/section/roll uniqueness
- [x] Add archive flags for expelled/TC states

## 3. Teacher Management (minimum Phase 1 scope)
- [x] Create `teachers`, `teacher_profiles` CRUD APIs
- [x] Add employee ID generation and uniqueness checks
- [x] Add teacher assignment matrix (`teacher_subject_class`)
- [x] Add activate/deactivate teacher account endpoints

## 4. Bulk Import (students + teachers)
- [x] Add downloadable template endpoints (CSV/XLSX)
- [x] Add import validation engine with row-wise error report
- [x] Add preview-before-commit workflow
- [x] Add student bulk import with parent auto-account creation
- [x] Add teacher bulk import with subject/class mapping build
- [x] Add bulk photo ZIP import pipeline (simple)

## 5. Class + Section Setup
- [x] Build class CRUD (`Nursery` to `Class 12`)
- [x] Build section CRUD (`A/B/C/D`) with capacity controls
- [x] Assign class teacher to section
- [x] Add academic-year scoped class/section constraints

## 6. Basic Timetable
- [x] Build period config APIs (count, duration, lunch break)
- [x] Build timetable slot CRUD (`section + day + period`)
- [x] Hard-block teacher double-booking conflict
- [x] Hard-block half-day overflow periods
- [x] Add teacher timetable projection endpoint
- [x] Add student/parent read-only timetable endpoint

## 7. Engineering Baseline (must-have before Phase 2)
- [x] Add test framework (`vitest` or `jest`) and CI test command
- [x] Add unit tests for auth/otp/rbac services
- [x] Add API integration tests for auth and base CRUD
- [x] Fix TypeScript build by adding missing `@types/*`
- [x] Add API response contract `{ success, data, message, pagination? }`
- [x] Add OpenAPI/Swagger for implemented endpoints
- [x] Add seeders for roles, permissions, admin bootstrap
- [x] Add migration strategy for new schema modules
- [x] Add GitHub CI pipeline for typecheck and tests

## 8. Definition of Done for Phase 1
- [x] All Phase 1 modules are callable under `/api/v1`
- [x] PRD security constraints are fully matched
- [x] `npm test` passes in CI
- [x] `npx tsc --noEmit` passes
- [x] Seed + migration + local startup documented and reproducible
- [x] Demo flow works end-to-end:
  - [x] Admin login
  - [x] Create class/section/subject
  - [x] Import students and teachers
  - [x] Generate basic timetable
  - [x] Student/teacher can fetch own basic profile + timetable

## 9. Additional Phase 1 Items
- [x] Attendance base endpoints are implemented

PHASE-1 STATUS: COMPLETE
