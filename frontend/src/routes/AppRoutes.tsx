import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "../layouts/AppLayout";
import RequireAuth from "./RequireAuth";

const LoginPage = React.lazy(() => import("../pages/LoginPage"));
const OtpLoginPage = React.lazy(() => import("../pages/OtpLoginPage"));
const ForgotPasswordPage = React.lazy(() => import("../pages/ForgotPasswordPage"));
const TeacherAccessPage = React.lazy(() => import("../pages/TeacherAccessPage"));
const AdminSetupPage = React.lazy(() => import("../pages/AdminSetupPage"));
const SetupAccountPage = React.lazy(() => import("../pages/SetupAccountPage"));
const Unauthorized = React.lazy(() => import("../pages/Unauthorized"));
const NotFound = React.lazy(() => import("../pages/NotFound"));
const DashboardPage = React.lazy(() => import("../modules/dashboard/DashboardPage"));
const AttendancePage = React.lazy(() => import("../modules/attendance/AttendancePage"));
const AttendanceTeacherPage = React.lazy(() => import("../modules/attendance/AttendanceTeacherPage"));
const NoticesPage = React.lazy(() => import("../modules/notices/NoticesPage"));
const NoticeViewPage = React.lazy(() => import("../modules/notices/NoticeViewPage"));
const NotificationsPage = React.lazy(() => import("../modules/notifications/NotificationsPage"));
const ExamsPage = React.lazy(() => import("../modules/exams/ExamsPage"));
const ResultsPage = React.lazy(() => import("../modules/results/ResultsPage"));
const ReportCardsPage = React.lazy(() => import("../modules/reportCards/ReportCardsPage"));
const AdmitCardsPage = React.lazy(() => import("../modules/admitCards/AdmitCardsPage"));
const MarksEntryPage = React.lazy(() => import("../modules/marks/MarksEntryPage"));
const StudentFeeDashboardPage = React.lazy(() => import("../modules/fee/StudentFeeDashboardPage"));
const PaymentPage = React.lazy(() => import("../modules/fee/PaymentPage"));
const ReceiptPage = React.lazy(() => import("../modules/fee/ReceiptPage"));
const ExamRegistrationPage = React.lazy(() => import("../modules/exams/ExamRegistrationPage"));
const FeeStructureAdminPage = React.lazy(() => import("../modules/admin/FeeStructureAdminPage"));
const AdminFeeOverviewPage = React.lazy(() => import("../modules/admin/AdminFeeOverviewPage"));
const AdmitCardAdminPage = React.lazy(() => import("../modules/admin/AdmitCardAdminPage"));
const ScholarshipAdminPage = React.lazy(() => import("../modules/admin/ScholarshipAdminPage"));
const ScholarshipDetailsPage = React.lazy(() => import("../modules/admin/ScholarshipDetailsPage"));
const DiscountAdminPage = React.lazy(() => import("../modules/admin/DiscountAdminPage"));
const FeePaidUnpaidPage = React.lazy(() => import("../modules/admin/FeePaidUnpaidPage"));
const LateFeeAdminPage = React.lazy(() => import("../modules/admin/LateFeeAdminPage"));
const ExamRegistrationsAdminPage = React.lazy(() => import("../modules/admin/ExamRegistrationsAdminPage"));
const ComingSoonPage = React.lazy(() => import("../modules/admin/ComingSoonPage"));
const AdminSettingsPage = React.lazy(() => import("../modules/admin/AdminSettingsPage"));
const AdminSchoolOverviewPage = React.lazy(() => import("../modules/admin/AdminSchoolOverviewPage"));
const BulkImportPage = React.lazy(() => import("../modules/admin/BulkImportPage"));
const BulkPhotoUploadPage = React.lazy(() => import("../modules/admin/BulkPhotoUploadPage"));
const TeacherBulkImportPage = React.lazy(() => import("../modules/teachers/TeacherBulkImportPage"));
const TeacherProfilePage = React.lazy(() => import("../modules/teachers/TeacherProfilePage"));
const TeacherAnalyticsPage = React.lazy(() => import("../modules/teachers/TeacherAnalyticsPage"));
const AdminAnalyticsPage = React.lazy(() => import("../modules/admin/AdminAnalyticsPage"));
const StudentRankPage = React.lazy(() => import("../modules/ranking/StudentRankPage"));
const ParentProfilePage = React.lazy(() => import("../modules/parents/ParentProfilePage"));
const ClassTeacherPage = React.lazy(() => import("../modules/classTeacher/ClassTeacherPage"));
const AdminTeacherDetailPage = React.lazy(() => import("../modules/admin/AdminTeacherDetailPage"));
const AdminStudentDetailPage = React.lazy(() => import("../modules/admin/AdminStudentDetailPage"));
const ParentsPage = React.lazy(() => import("../modules/parents/ParentsPage"));
const TeacherMessagesPage = React.lazy(() => import("../modules/messages/TeacherMessagesPage"));
const TeacherTimetablePage = React.lazy(() => import("../modules/timetable/TeacherTimetablePage"));
const StudentTimetablePage = React.lazy(() => import("../modules/timetable/StudentTimetablePage"));
const ParentTimetablePage = React.lazy(() => import("../modules/timetable/ParentTimetablePage"));
const StudentLeavePage = React.lazy(() => import("../modules/leaves/StudentLeavePage"));
const TeacherLeavePage = React.lazy(() => import("../modules/leaves/TeacherLeavePage"));
const ParentLeavePage = React.lazy(() => import("../modules/leaves/ParentLeavePage"));
const ExamRoutinePage = React.lazy(() => import("../modules/exams/ExamRoutinePage"));
const AdminStudentLeavesPage = React.lazy(() => import("../modules/admin/AdminStudentLeavesPage"));
const AdminTeacherLeavesPage = React.lazy(() => import("../modules/admin/AdminTeacherLeavesPage"));
const AdminPaymentLogsPage = React.lazy(() => import("../modules/admin/AdminPaymentLogsPage"));
const AdminStudentIdCardsPage = React.lazy(() => import("../modules/admin/AdminStudentIdCardsPage"));
const AdminTeacherIdCardsPage = React.lazy(() => import("../modules/admin/AdminTeacherIdCardsPage"));
const ClassroomPage = React.lazy(() => import("../modules/classroom/ClassroomPage"));
const SubstitutionPage = React.lazy(() => import("../modules/substitution/SubstitutionPage"));
const CertificatesPage = React.lazy(() => import("../modules/certificates/CertificatesPage"));
const CertificateRequestsPage = React.lazy(() => import("../modules/certificates/CertificateRequestsPage"));
const TcGeneratorPage = React.lazy(() => import("../modules/certificates/TcGeneratorPage"));
const IdCardPage = React.lazy(() => import("../modules/idCards/IdCardPage"));
const TeacherIdCardPage = React.lazy(() => import("../modules/idCards/TeacherIdCardPage"));
const PromotionCriteriaPage = React.lazy(() => import("../modules/promotion/Admin/PromotionCriteriaPage"));
const PromotionOverviewPage = React.lazy(() => import("../modules/promotion/Admin/PromotionOverviewPage"));
const TeacherPromotionPage = React.lazy(() => import("../modules/promotion/Teacher/TeacherPromotionPage"));
const StudentPromotionStatus = React.lazy(() => import("../modules/promotion/Student/StudentPromotionStatus"));
const ParentPromotionView = React.lazy(() => import("../modules/promotion/Parent/ParentPromotionView"));
const StudentAcademicHistoryPage = React.lazy(() => import("../modules/history/StudentAcademicHistoryPage"));
const TeacherHistoryPage = React.lazy(() => import("../modules/history/TeacherHistoryPage"));
const TeacherOperationalHistoryPage = React.lazy(() => import("../modules/history/TeacherOperationalHistoryPage"));
const AdminRecordsArchivePage = React.lazy(() => import("../modules/admin/AdminRecordsArchivePage"));

// New dedicated module pages
const StudentsPage = React.lazy(() => import("../modules/students/StudentsPage"));
const TeachersPage = React.lazy(() => import("../modules/teachers/TeachersPage"));
const ClassesPage = React.lazy(() => import("../modules/classes/ClassesPage"));
const SectionsPage = React.lazy(() => import("../modules/sections/SectionsPage"));
const SubjectsPage = React.lazy(() => import("../modules/subjects/SubjectsPage"));
const PeriodsPage = React.lazy(() => import("../modules/periods/PeriodsPage"));
const AcademicYearsPage = React.lazy(() => import("../modules/academicYears/AcademicYearsPage"));
const TimetableBuilderPage = React.lazy(() => import("../modules/timetable/TimetableBuilderPage"));
const ClassSubjectsPage = React.lazy(() => import("../modules/classSubjects/ClassSubjectsPage"));
const AcademicCalendarPage = React.lazy(() => import("../modules/academicCalendar/AcademicCalendarPage"));

import { adminOnlyFeatures } from "./featureMap";

// Map feature keys to dedicated pages
const dedicatedPages: Record<string, React.ReactNode> = {
  students: <StudentsPage />,
  teachers: <TeachersPage />,
  parents: <ParentsPage />,
  classes: <ClassesPage />,
  sections: <SectionsPage />,
  subjects: <SubjectsPage />,
  periods: <PeriodsPage />,
  "academic-years": <AcademicYearsPage />,
  "class-subjects": <ClassSubjectsPage />,
  timetable: <TimetableBuilderPage />,
  "timetable-slots": <TimetableBuilderPage />,
  "academic-calendar": <AcademicCalendarPage />,
  settings: <AdminSettingsPage />,
  "school-overview": <AdminSchoolOverviewPage />,
  fees: <FeeStructureAdminPage />,
  "fees-overview": <AdminFeeOverviewPage />,
  scholarships: <ScholarshipAdminPage />,
  "scholarships-detail": <ScholarshipDetailsPage />,
  discounts: <DiscountAdminPage />,
  "fee-paid-unpaid": <FeePaidUnpaidPage />,
  "late-fees": <LateFeeAdminPage />,
  "admit-card-admin": <AdmitCardAdminPage />,
  "exam-registrations-admin": <ExamRegistrationsAdminPage />,
  "student-leave": <StudentLeavePage />,
  "teacher-leave": <TeacherLeavePage />,
  "parent-leave": <ParentLeavePage />,
  "admin-student-leaves": <AdminStudentLeavesPage />,
  "admin-teacher-leaves": <AdminTeacherLeavesPage />,
  "payment-logs": <AdminPaymentLogsPage />,
  "digital-id": <AdminStudentIdCardsPage />,
  "teacher-id-cards": <AdminTeacherIdCardsPage />,
  "exam-routine-student": <ExamRoutinePage />,
  "certificate-requests": <CertificateRequestsPage />,
  "tc-generator": <TcGeneratorPage />,
  substitution: <SubstitutionPage />,
  "promotion-system": <PromotionCriteriaPage />,
  "promotion-overview": <PromotionOverviewPage />,
  "admin-records": <AdminRecordsArchivePage />,
};


const SuspenseFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center flex-col gap-4">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500"></div>
    <p className="text-sm font-semibold text-slate-500">Loading module...</p>
  </div>
);

export default function AppRoutes() {

  const adminRoutes = adminOnlyFeatures.map((item) => {
    const path = item.path.replace(/^\//, "");

    // Bulk import pages
    if (item.key === "student-imports") {
      return (
        <Route key={item.key} path={path} element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN"]}>
            <BulkImportPage
              title="Student Bulk Import"
              description="Upload CSV or Excel files for bulk student onboarding."
              templateEndpoint="/student-bulk-imports/template"
              previewEndpoint="/student-bulk-imports/preview"
              importEndpoint="/student-bulk-imports"
              format="raw"
              accept=".csv"
            />
          </RequireAuth>
        } />
      );
    }
    if (item.key === "teacher-imports") {
      return (
        <Route key={item.key} path={path} element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN"]}>
            <TeacherBulkImportPage />
          </RequireAuth>
        } />
      );
    }
    if (item.key === "student-photos") {
      return (
        <Route key={item.key} path={path} element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN"]}>
            <BulkPhotoUploadPage />
          </RequireAuth>
        } />
      );
    }

    // Dedicated module pages
    if (dedicatedPages[item.key]) {
      return (
        <Route key={item.key} path={path} element={
          <RequireAuth roles={item.roles}>
            {dedicatedPages[item.key]}
          </RequireAuth>
        } />
      );
    }

    // Coming soon pages (no backend API yet)
    return (
      <Route key={item.key} path={path} element={
        <RequireAuth roles={item.roles}>
          <ComingSoonPage title={item.label} description={item.description} />
        </RequireAuth>
      } />
    );
  });

  return (
    <React.Suspense fallback={<SuspenseFallback />}>
      <Routes>
      <Route path="/login" element={<Navigate to="/login/admin" replace />} />
      <Route path="/login/admin" element={<LoginPage />} />
      <Route path="/login/teacher" element={<LoginPage />} />
      <Route path="/login/student" element={<OtpLoginPage />} />
      <Route path="/login/parent" element={<Navigate to="/login/student" replace />} />
      <Route path="/otp-login" element={<OtpLoginPage />} />
      <Route path="/teacher-activate" element={<TeacherAccessPage mode="activate" />} />
      <Route path="/teacher-forgot-password" element={<TeacherAccessPage mode="reset" />} />
      <Route path="/admin-setup" element={<AdminSetupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/setup-account" element={
        <RequireAuth roles={["TEACHER"]}>
          <SetupAccountPage />
        </RequireAuth>
      } />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="fees" element={
          <RequireAuth roles={["STUDENT", "PARENT"]}>
            <StudentFeeDashboardPage />
          </RequireAuth>
        } />
        <Route path="fees/pay" element={
          <RequireAuth roles={["STUDENT", "PARENT"]}>
            <PaymentPage />
          </RequireAuth>
        } />
        <Route path="fees/receipt/:paymentId" element={
          <RequireAuth roles={["STUDENT", "PARENT"]}>
            <ReceiptPage />
          </RequireAuth>
        } />
        <Route path="teacher/id-card" element={
          <RequireAuth roles={["TEACHER"]}>
            <TeacherIdCardPage />
          </RequireAuth>
        } />
        <Route path="id-card" element={
          <RequireAuth roles={["STUDENT", "PARENT"]}>
            <IdCardPage />
          </RequireAuth>
        } />
        <Route path="exam/registration" element={
          <RequireAuth roles={["STUDENT", "PARENT"]}>
            <ExamRegistrationPage />
          </RequireAuth>
        } />
        <Route path="attendance" element={
          <RequireAuth roles={["TEACHER", "STUDENT", "PARENT"]}>
            <AttendancePage />
          </RequireAuth>
        } />
        <Route path="teacher/attendance" element={
          <RequireAuth roles={["TEACHER"]}>
            <AttendanceTeacherPage />
          </RequireAuth>
        } />
        <Route path="notices" element={
          <RequireAuth roles={["ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN", "TEACHER", "STUDENT", "PARENT", "FINANCE_SUB_ADMIN"]}>
            <NoticesPage />
          </RequireAuth>
        } />
        <Route path="notices/:id" element={
          <RequireAuth roles={["ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN", "TEACHER", "STUDENT", "PARENT", "FINANCE_SUB_ADMIN"]}>
            <NoticeViewPage />
          </RequireAuth>
        } />
        <Route path="notifications" element={
          <RequireAuth roles={["ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN", "TEACHER", "STUDENT", "PARENT"]}>
            <NotificationsPage />
          </RequireAuth>
        } />
        <Route path="exams" element={
          <RequireAuth roles={["ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"]}>
            <ExamsPage />
          </RequireAuth>
        } />
        <Route path="results" element={
          <RequireAuth roles={["ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN", "STUDENT", "PARENT"]}>
            <ResultsPage />
          </RequireAuth>
        } />
        <Route path="report-cards" element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN", "STUDENT", "PARENT"]}>
            <ReportCardsPage />
          </RequireAuth>
        } />
        <Route path="admit-cards" element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN", "STUDENT", "PARENT"]}>
            <AdmitCardsPage />
          </RequireAuth>
        } />
        <Route path="marks" element={
          <RequireAuth roles={["TEACHER"]}>
            <MarksEntryPage />
          </RequireAuth>
        } />
        <Route path="teacher/profile" element={
          <RequireAuth roles={["TEACHER"]}>
            <TeacherProfilePage />
          </RequireAuth>
        } />
        <Route path="teacher/leave" element={
          <RequireAuth roles={["TEACHER"]}>
            <TeacherLeavePage />
          </RequireAuth>
        } />
        <Route path="teacher/messages" element={
          <RequireAuth roles={["TEACHER"]}>
            <TeacherMessagesPage />
          </RequireAuth>
        } />
        <Route path="teacher/timetable" element={
          <RequireAuth roles={["TEACHER"]}>
            <TeacherTimetablePage />
          </RequireAuth>
        } />
        <Route path="teacher/analytics" element={
          <RequireAuth roles={["TEACHER"]}>
            <TeacherAnalyticsPage />
          </RequireAuth>
        } />
        <Route path="teacher/promotions" element={
          <RequireAuth roles={["TEACHER"]}>
            <TeacherPromotionPage />
          </RequireAuth>
        } />
        <Route path="admin/analytics" element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"]}>
            <AdminAnalyticsPage />
          </RequireAuth>
        } />
        <Route path="admin/payments/logs" element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN"]}>
            <AdminPaymentLogsPage />
          </RequireAuth>
        } />
        <Route path="ranking" element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER", "STUDENT"]}>
            <StudentRankPage />
          </RequireAuth>
        } />
        <Route path="parent/timetable" element={
          <RequireAuth roles={["PARENT"]}>
            <ParentTimetablePage />
          </RequireAuth>
        } />
        <Route path="student/timetable" element={
          <RequireAuth roles={["STUDENT"]}>
            <StudentTimetablePage />
          </RequireAuth>
        } />
        <Route path="class-teacher" element={
          <RequireAuth roles={["PARENT", "STUDENT"]}>
            <ClassTeacherPage />
          </RequireAuth>
        } />
        <Route path="classroom" element={
          <RequireAuth roles={["TEACHER", "STUDENT", "PARENT"]}>
            <ClassroomPage />
          </RequireAuth>
        } />
        <Route path="certificates" element={
          <RequireAuth roles={["STUDENT", "PARENT"]}>
            <CertificatesPage />
          </RequireAuth>
        } />
        <Route path="parent/profile" element={
          <RequireAuth roles={["PARENT"]}>
            <ParentProfilePage />
          </RequireAuth>
        } />
        <Route path="parent/leave" element={
          <RequireAuth roles={["PARENT"]}>
            <ParentLeavePage />
          </RequireAuth>
        } />
        <Route path="parent/promotion" element={
          <RequireAuth roles={["PARENT"]}>
            <ParentPromotionView />
          </RequireAuth>
        } />
        <Route path="parent/history" element={
          <RequireAuth roles={["PARENT"]}>
            <StudentAcademicHistoryPage />
          </RequireAuth>
        } />
        <Route path="student/leave" element={
          <RequireAuth roles={["STUDENT"]}>
            <StudentLeavePage />
          </RequireAuth>
        } />
        <Route path="student/promotion" element={
          <RequireAuth roles={["STUDENT"]}>
            <StudentPromotionStatus />
          </RequireAuth>
        } />
        <Route path="student/history" element={
          <RequireAuth roles={["STUDENT"]}>
            <StudentAcademicHistoryPage />
          </RequireAuth>
        } />
        <Route path="exam/routine" element={
          <RequireAuth roles={["STUDENT", "PARENT"]}>
            <ExamRoutinePage />
          </RequireAuth>
        } />
        <Route path="teacher/history" element={
          <RequireAuth roles={["TEACHER"]}>
            <TeacherHistoryPage />
          </RequireAuth>
        } />
        <Route path="teacher/history/operational" element={
          <RequireAuth roles={["TEACHER"]}>
            <TeacherOperationalHistoryPage />
          </RequireAuth>
        } />
        <Route path="teachers/:id/profile" element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN"]}>
            <TeacherProfilePage />
          </RequireAuth>
        } />
        <Route path="admin/teacher/:id" element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"]}>
            <AdminTeacherDetailPage />
          </RequireAuth>
        } />
        <Route path="admin/student/:id" element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"]}>
            <AdminStudentDetailPage />
          </RequireAuth>
        } />
        <Route path="admin/parent/:id" element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN"]}>
            <ParentProfilePage />
          </RequireAuth>
        } />
        <Route path="admin/fees/overview" element={
          <RequireAuth roles={["ADMIN", "SUPER_ADMIN", "FINANCE_SUB_ADMIN"]}>
            <AdminFeeOverviewPage />
          </RequireAuth>
        } />
        {adminRoutes}
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
    </React.Suspense>
  );
}
