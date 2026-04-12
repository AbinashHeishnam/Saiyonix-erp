import { Feather } from "@expo/vector-icons";

export type StudentParentRoute =
  | "Dashboard"
  | "Classroom"
  | "Timetable"
  | "Attendance"
  | "Results"
  | "Rank"
  | "Notices"
  | "Alerts"
  | "Fees"
  | "Payment"
  | "Receipt"
  | "ReportCards"
  | "AdmitCards"
  | "ExamRegistration"
  | "Exams"
  | "Promotion"
  | "History"
  | "Leaves"
  | "Certificates"
  | "IdCard"
  | "Profile"
  | "ClassTeacher";

export type WebParityMenuItem = {
  key: string;
  label: string;
  route: StudentParentRoute;
  icon?: keyof typeof Feather.glyphMap;
  badge?: "notifications";
};

export type WebParityMenuGroup = {
  title: "CORE" | "ACADEMIC" | "ADMIN CONTROL" | "FINANCE" | "SYSTEM";
  items: WebParityMenuItem[];
};

export const STUDENT_WEB_MENU_GROUPS: WebParityMenuGroup[] = [
  {
    title: "CORE",
    items: [
      { key: "dashboard", label: "Dashboard", route: "Dashboard" },
      { key: "classroom", label: "Classroom", route: "Classroom" },
      { key: "exam-routine", label: "Exam Routine", route: "Exams" },
      { key: "certificates", label: "Certificates", route: "Certificates" },
      { key: "id-card", label: "ID Card", route: "IdCard" },
      { key: "student-fees", label: "Fees & Payments", route: "Fees" },
      { key: "exam-registration", label: "Exam Registration", route: "ExamRegistration" },
      { key: "student-leave", label: "Student Leaves", route: "Leaves" },
      { key: "student-promotion", label: "Promotion Status", route: "Promotion" },
      { key: "student-history", label: "Academic History", route: "History" },
    ],
  },
  {
    title: "ACADEMIC",
    items: [
      { key: "attendance", label: "Attendance", route: "Attendance" },
      { key: "student-timetable", label: "My Timetable", route: "Timetable" },
      { key: "results", label: "Results", route: "Results" },
      { key: "ranking", label: "Student Rank", route: "Rank" },
    ],
  },
  {
    title: "ADMIN CONTROL",
    items: [{ key: "notices", label: "Notices", route: "Notices" }],
  },
  {
    title: "FINANCE",
    items: [
      { key: "report-cards", label: "Report Cards", route: "ReportCards" },
      { key: "admit-cards", label: "Admit Cards", route: "AdmitCards" },
      { key: "payment", label: "Pay Now", route: "Payment" },
    ],
  },
  {
    title: "SYSTEM",
    items: [{ key: "notifications", label: "Notifications", route: "Alerts", badge: "notifications" }],
  },
];

export const PARENT_WEB_MENU_GROUPS: WebParityMenuGroup[] = [
  {
    title: "CORE",
    items: [
      { key: "dashboard", label: "Dashboard", route: "Dashboard" },
      { key: "classroom", label: "Classroom", route: "Classroom" },
      { key: "exam-routine", label: "Exam Routine", route: "Exams" },
      { key: "certificates", label: "Certificates", route: "Certificates" },
      { key: "id-card", label: "ID Card", route: "IdCard" },
      { key: "student-fees", label: "Fees & Payments", route: "Fees" },
      { key: "exam-registration", label: "Exam Registration", route: "ExamRegistration" },
      { key: "parent-leave", label: "Student Leaves", route: "Leaves" },
      { key: "parent-promotion", label: "Promotion Status", route: "Promotion" },
      { key: "parent-history", label: "Academic History", route: "History" },
    ],
  },
  {
    title: "ACADEMIC",
    items: [
      { key: "attendance", label: "Attendance", route: "Attendance" },
      { key: "parent-timetable", label: "Child Timetable", route: "Timetable" },
      { key: "results", label: "Results", route: "Results" },
    ],
  },
  {
    title: "ADMIN CONTROL",
    items: [{ key: "notices", label: "Notices", route: "Notices" }],
  },
  {
    title: "FINANCE",
    items: [
      { key: "report-cards", label: "Report Cards", route: "ReportCards" },
      { key: "admit-cards", label: "Admit Cards", route: "AdmitCards" },
      { key: "payment", label: "Pay Now", route: "Payment" },
    ],
  },
  {
    title: "SYSTEM",
    items: [{ key: "notifications", label: "Notifications", route: "Alerts", badge: "notifications" }],
  },
];

export const TAB_ROUTES = new Set<StudentParentRoute>([
  "Dashboard",
  "Classroom",
  "Timetable",
  "Alerts",
  "Profile",
]);
