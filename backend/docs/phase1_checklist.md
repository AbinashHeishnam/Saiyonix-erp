# Phase 1 Checklist (Core Foundation)

Reference: `docs/project-doc.md` section 18.1 (Phase 1)

## 1. Auth + RBAC
- [ ] Enforce final auth policy from PRD: access token `15m`, refresh token `7d`
- [ ] Change OTP expiry to `5m`, max `3` attempts, cooldown `15m`
- [ ] Apply `authLimiter` on login endpoint
- [ ] Store OTP as hash (never plain OTP in DB)
- [ ] Remove OTP from console logs; integrate real SMS gateway abstraction
- [ ] Implement admin unlock workflow for locked accounts
- [ ] Add role-permission tables wiring and permission middleware checks
- [ ] Add secure session revoke-all and device/session listing APIs

## 2. Student Management (minimum Phase 1 scope)
- [ ] Create `students`, `student_profiles`, `student_enrollments` CRUD APIs
- [ ] Add registration/admission number generation service
- [ ] Add parent linkage (`parents`, `parent_student_links`)
- [ ] Add validation rules for class/section/roll uniqueness
- [ ] Add archive flags for expelled/TC states

## 3. Teacher Management (minimum Phase 1 scope)
- [ ] Create `teachers`, `teacher_profiles` CRUD APIs
- [ ] Add employee ID generation and uniqueness checks
- [ ] Add teacher assignment matrix (`teacher_subject_class`)
- [ ] Add activate/deactivate teacher account endpoints

## 4. Bulk Import (students + teachers)
- [ ] Add downloadable template endpoints (CSV/XLSX)
- [ ] Add import validation engine with row-wise error report
- [ ] Add preview-before-commit workflow
- [ ] Add student bulk import with parent auto-account creation
- [ ] Add teacher bulk import with subject/class mapping build
- [ ] Add background job pipeline for bulk photo ZIP matching

## 5. Class + Section Setup
- [ ] Build class CRUD (`Nursery` to `Class 12`)
- [ ] Build section CRUD (`A/B/C/D`) with capacity controls
- [ ] Assign class teacher to section
- [ ] Add academic-year scoped class/section constraints

## 6. Basic Timetable
- [ ] Build period config APIs (count, duration, lunch break)
- [ ] Build timetable slot CRUD (`section + day + period`)
- [ ] Hard-block teacher double-booking conflict
- [ ] Hard-block half-day overflow periods
- [ ] Add teacher timetable projection endpoint
- [ ] Add student/parent read-only timetable endpoint

## 7. Engineering Baseline (must-have before Phase 2)
- [ ] Add test framework (`vitest` or `jest`) and CI test command
- [ ] Add unit tests for auth/otp/rbac services
- [ ] Add API integration tests for auth and base CRUD
- [ ] Fix TypeScript build by adding missing `@types/*`
- [ ] Add API response contract `{ success, data, message, pagination? }`
- [ ] Add OpenAPI/Swagger for implemented endpoints
- [ ] Add seeders for roles, permissions, admin bootstrap
- [ ] Add migration strategy for new schema modules

## 8. Definition of Done for Phase 1
- [ ] All Phase 1 modules are callable under `/api/v1`
- [ ] PRD security constraints are fully matched
- [ ] `npm test` passes in CI
- [ ] `npx tsc --noEmit` passes
- [ ] Seed + migration + local startup documented and reproducible
- [ ] Demo flow works end-to-end:
  - [ ] Admin login
  - [ ] Create class/section/subject
  - [ ] Import students and teachers
  - [ ] Generate basic timetable
  - [ ] Student/teacher can fetch own basic profile + timetable
