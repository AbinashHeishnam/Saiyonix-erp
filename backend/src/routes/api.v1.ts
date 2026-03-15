import { Router } from "express";

import academicYearRouter from "../modules/academicYear/routes";
import authRouter from "../modules/auth/auth.routes";
import classRouter from "../modules/class/routes";
import classSubjectRouter from "../modules/classSubject/routes";
import otpRouter from "../modules/otp/otp.routes";
import periodRouter from "../modules/period/routes";
import sectionRouter from "../modules/section/routes";
import studentRouter from "../modules/student/routes";
import studentBulkImportRouter from "../modules/studentBulkImport/routes";
import studentAttendanceRouter from "../modules/studentAttendance/routes";
import subjectRouter from "../modules/subject/routes";
import teacherRouter from "../modules/teacher/routes";
import teacherBulkImportRouter from "../modules/teacherBulkImport/routes";
import teacherProfileRouter from "../modules/teacherProfile/routes";
import teacherSubjectClassRouter from "../modules/teacherSubjectClass/routes";
import timetableSlotRouter from "../modules/timetableSlot/routes";

const router = Router();

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
router.use("/teacher-profiles", teacherProfileRouter);
router.use("/teacher-subject-classes", teacherSubjectClassRouter);
router.use("/timetable-slots", timetableSlotRouter);
router.use("/students", studentRouter);
router.use("/student-bulk-imports", studentBulkImportRouter);
router.use("/student-attendance", studentAttendanceRouter);

export default router;
