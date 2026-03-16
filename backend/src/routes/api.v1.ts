import { Router } from "express";

import academicYearRouter from "../modules/academicYear/routes";
import authRouter from "../modules/auth/auth.routes";
import classRouter from "../modules/class/routes";
import classSubjectRouter from "../modules/classSubject/routes";
import bulkPhotoUploadRouter from "../modules/bulkPhotoUpload/routes";
import attendanceRouter from "../modules/attendance/routes";
import noticeRouter from "../modules/noticeBoard/routes";
import circularRouter from "../modules/circular/routes";
import dashboardRouter from "../modules/dashboard/routes";
import notificationRouter from "../modules/notification/routes";
import otpRouter from "../modules/otp/otp.routes";
import paymentRouter from "../modules/payment/payment.routes";
import periodRouter from "../modules/period/routes";
import sectionRouter from "../modules/section/routes";
import studentRouter from "../modules/student/routes";
import studentBulkImportRouter from "../modules/studentBulkImport/routes";
import studentAttendanceRouter from "../modules/studentAttendance/routes";
import studentLeaveRouter from "../modules/studentLeave/routes";
import subjectRouter from "../modules/subject/routes";
import teacherRouter from "../modules/teacher/routes";
import teacherBulkImportRouter from "../modules/teacherBulkImport/routes";
import teacherLeaveRouter from "../modules/teacherLeave/routes";
import teacherProfileRouter from "../modules/teacherProfile/routes";
import teacherSubjectClassRouter from "../modules/teacherSubjectClass/routes";
import timetableSlotRouter from "../modules/timetableSlot/routes";
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
MASTER DATA ROUTES
*/
router.use("/academic-years", academicYearRouter);
router.use("/classes", classRouter);
router.use("/class-subjects", classSubjectRouter);
router.use("/sections", sectionRouter);
router.use("/subjects", subjectRouter);
router.use("/periods", periodRouter);
router.use("/teachers", teacherRouter);
router.use("/teacher-bulk-imports", teacherBulkImportRouter);
router.use("/teacher-leaves", teacherLeaveRouter);
router.use("/teacher-profiles", teacherProfileRouter);
router.use("/teacher-subject-classes", teacherSubjectClassRouter);
router.use("/timetable-slots", timetableSlotRouter);
router.use("/students", studentRouter);
router.use("/student-bulk-imports", studentBulkImportRouter);
router.use("/student-attendance", studentAttendanceRouter);
router.use("/student-leaves", studentLeaveRouter);
router.use("/attendance", attendanceRouter);
router.use("/bulk", bulkPhotoUploadRouter);
router.use("/notices", noticeRouter);
router.use("/circulars", circularRouter);
router.use("/dashboard", dashboardRouter);
router.use("/notifications", notificationRouter);
router.use("/payments", paymentRouter);

export default router;
