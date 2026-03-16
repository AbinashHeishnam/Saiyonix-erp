# Phase 2 Mobile API Contract (Backend)

This contract freezes the minimal response shapes for Phase 2 mobile views.
It is based on `docs/project-doc.md` (Phase 2) and `backend/docs/phase2_to_phase8_checklists.md`.

## Global
- All list endpoints return pagination meta with `syncTimestamp`.
- Responses follow `{ success, data, message, pagination }`.

## Notices (List)
`GET /api/v1/notices`

Data (array of):
- `id`
- `title`
- `noticeType`
- `isPublic`
- `targetType`
- `targetClassId`
- `targetSectionId`
- `targetRole`
- `publishedAt`
- `expiresAt`
- `createdAt`
- `updatedAt`

## Circulars (List)
`GET /api/v1/circulars`

Data (array of):
- `id`
- `title`
- `body`
- `targetType`
- `targetClassId`
- `targetSectionId`
- `targetRole`
- `publishedAt`
- `expiresAt`
- `createdAt`
- `updatedAt`

## Notifications (Inbox)
`GET /api/v1/notifications`

Data (array of):
- `id`
- `readAt`
- `createdAt`
- `notification.id`
- `notification.title`
- `notification.body`
- `notification.category`
- `notification.priority`
- `notification.sentAt`
- `notification.createdAt`

## Student Attendance (List)
`GET /api/v1/student-attendance`

Data (array of):
- `id`
- `studentId`
- `attendanceDate`
- `status`
- `remarks`
- `createdAt`
- `updatedAt`

## Student Leaves (List)
`GET /api/v1/student-leaves`

Data (array of):
- `id`
- `studentId`
- `fromDate`
- `toDate`
- `reason`
- `status`
- `createdAt`
- `updatedAt`

Note: These endpoints return lightweight records optimized for mobile clients.
Related data must be fetched via dedicated endpoints.

## Dashboards
### Student
`GET /api/v1/dashboard/student`

- `todaysAttendanceStatus`
- `attendanceSummary`
- `pendingTasks` (placeholder)
- `duesSummary` (placeholder)
- `recentNotices`
- `recentCirculars`
- `unreadNotificationsCount`

### Teacher
`GET /api/v1/dashboard/teacher`

- `todaysClasses`
- `attendancePendingClasses` (placeholder)
- `recentNotices`
- `recentCirculars`
- `unreadNotificationsCount`

### Parent
`GET /api/v1/dashboard/parent`

- `children[]`:
  - `studentId`
  - `todaysAttendanceStatus`
  - `attendanceSummary`
  - `pendingAssignments` (placeholder)
  - `upcomingFeeDues` (placeholder)
- `upcomingFeeDues` (placeholder)
- `recentNotices`
- `recentCirculars`
- `unreadNotificationsCount`
