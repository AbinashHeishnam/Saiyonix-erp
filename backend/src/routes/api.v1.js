import { Router } from "express";
import academicYearRouter from "@/modules/academicYear/routes";
import academicCalendarRouter from "@/modules/academicCalendar/routes";
import authRouter from "@/modules/auth/auth.routes";
import classRouter from "@/modules/class/routes";
import classSubjectRouter from "@/modules/classSubject/routes";
import classSubjectConfigRouter from "@/modules/classSubjectConfig/routes";
import bulkPhotoUploadRouter from "@/modules/bulkPhotoUpload/routes";
import uploadRouter from "@/modules/upload/routes";
import filesRouter from "@/modules/files/routes";
import attendanceRouter from "@/modules/attendance/routes";
import noticeRouter from "@/modules/noticeBoard/routes";
import classroomRouter from "@/modules/classroom/routes";
import circularRouter from "@/modules/circular/routes";
import dashboardRouter from "@/modules/dashboard/routes";
import notificationRouter from "@/modules/notification/routes";
import pushRouter from "@/modules/push/routes";
import notesRouter from "@/modules/notes/routes";
import assignmentsRouter from "@/modules/assignments/routes";
import syllabusRouter from "@/modules/syllabus/routes";
import examsRouter from "@/modules/exams/routes";
import examManagementRouter from "@/modules/examManagement/routes";
import marksRouter from "@/modules/marks/routes";
import resultsRouter from "@/modules/results/routes";
import reportCardsRouter from "@/modules/reportCards/routes";
import rankingRouter from "@/modules/ranking/routes";
import admitCardsRouter from "@/modules/admitCards/routes";
import admitCardStudentRouter from "@/modules/admitCards/student.routes";
import admitCardAdminRouter from "@/modules/admitCards/admin.routes";
import examWorkflowRouter from "@/modules/examWorkflow/routes";
import otpRouter from "@/modules/otp/otp.routes";
import emailOtpRouter from "@/modules/emailOtp/emailOtp.routes";
import paymentRouter from "@/modules/payment/payment.routes";
import { razorpayWebhook } from "@/modules/payment/webhook.controller";
import feeRouter from "@/modules/fee/fee.routes";
import parentRouter from "@/modules/parent/routes";
import adminRouter from "@/modules/admin/routes";
import messagesRouter from "@/modules/messages/routes";
import timetableRouter from "@/modules/timetable/routes";
import analyticsRouter from "@/modules/analytics/routes";
import periodRouter from "@/modules/period/routes";
import adminPeriodRouter from "@/modules/period/admin.routes";
import sectionRouter from "@/modules/section/routes";
import studentRouter from "@/modules/student/routes";
import studentBulkImportRouter from "@/modules/studentBulkImport/routes";
import studentAttendanceRouter from "@/modules/studentAttendance/routes";
import studentLeaveRouter from "@/modules/studentLeave/routes";
import studentLeavePortalRouter from "@/modules/studentLeave/portal.routes";
import subjectRouter from "@/modules/subject/routes";
import teacherRouter from "@/modules/teacher/routes";
import teacherBulkImportRouter from "@/modules/teacherBulkImport/routes";
import teacherLeaveRouter from "@/modules/teacherLeave/routes";
import teacherLeavePortalRouter from "@/modules/teacherLeave/portal.routes";
import teacherProfileRouter from "@/modules/teacherProfile/routes";
import teacherSubjectClassRouter from "@/modules/teacherSubjectClass/routes";
import timetableSlotRouter from "@/modules/timetableSlot/routes";
import substitutionRouter from "@/modules/substitution/routes";
import promotionRouter from "@/modules/promotion/routes";
import { certificateRouter, adminCertificateRouter } from "@/modules/certificate/routes";
import schoolOverviewRouter from "@/modules/school/overview.routes";
import healthRouter from "./health.route";
const router = Router();
/*
HEALTH ROUTE
*/
router.use("/", healthRouter);
/*
AUTH ROUTES
*/
router.use("/auth", authRouter);
/*
OTP ROUTES
*/
router.use("/auth/otp", otpRouter);
/*
EMAIL OTP ROUTES
*/
router.use("/auth/email-otp", emailOtpRouter);
/*
MASTER DATA ROUTES
*/
router.use("/academic-years", academicYearRouter);
router.use("/", academicCalendarRouter);
router.use("/classes", classRouter);
router.use("/class", classRouter);
router.use("/class-subjects", classSubjectRouter);
router.use("/admin/class-subjects", classSubjectConfigRouter);
router.use("/sections", sectionRouter);
router.use("/subjects", subjectRouter);
router.use("/periods", periodRouter);
router.use("/", adminPeriodRouter);
router.use("/teachers", teacherRouter);
router.use("/teacher", teacherRouter);
router.use("/teacher-bulk-imports", teacherBulkImportRouter);
router.use("/teacher-bulk-import", teacherBulkImportRouter);
router.use("/teacher-leaves", teacherLeaveRouter);
router.use("/teacher/leave", teacherLeavePortalRouter);
router.use("/teacher-profiles", teacherProfileRouter);
router.use("/teacher-subject-classes", teacherSubjectClassRouter);
router.use("/timetable-slots", timetableSlotRouter);
router.use("/students", studentRouter);
router.use("/student", studentRouter);
router.use("/student-bulk-imports", studentBulkImportRouter);
router.use("/student-attendance", studentAttendanceRouter);
router.use("/student-leaves", studentLeaveRouter);
router.use("/student/leave", studentLeavePortalRouter);
router.use("/attendance", attendanceRouter);
router.use("/bulk", bulkPhotoUploadRouter);
router.use("/upload", uploadRouter);
router.use("/files", filesRouter);
router.use("/notices", noticeRouter);
router.use("/admin/notices", noticeRouter);
router.use("/school", schoolOverviewRouter);
router.use("/classroom", classroomRouter);
router.use("/certificate", certificateRouter);
router.use("/circulars", circularRouter);
router.use("/dashboard", dashboardRouter);
router.use("/notifications", notificationRouter);
router.use("/push", pushRouter);
router.use("/notes", notesRouter);
router.use("/assignments", assignmentsRouter);
router.use("/syllabus", syllabusRouter);
router.use("/exams", examsRouter);
router.use("/exam", examsRouter);
router.use("/", examManagementRouter);
router.use("/marks", marksRouter);
router.use("/results", resultsRouter);
router.use("/report-cards", reportCardsRouter);
router.use("/ranking", rankingRouter);
router.use("/admit-cards", admitCardsRouter);
router.use("/admit-card", admitCardStudentRouter);
router.use("/admin/admit-card", admitCardAdminRouter);
router.use("/", examWorkflowRouter);
router.use("/payments", paymentRouter);
router.post("/payments/webhook", razorpayWebhook);
router.use("/fee", feeRouter);
router.use("/fees", feeRouter);
router.use("/parent", parentRouter);
router.use("/parents", parentRouter);
router.use("/admin/parent", parentRouter);
router.use("/admin", adminRouter);
router.use("/admin", adminCertificateRouter);
router.use("/messages", messagesRouter);
router.use("/analytics", analyticsRouter);
router.use("/", timetableRouter);
router.use("/", substitutionRouter);
router.use("/", promotionRouter);
export default router;
