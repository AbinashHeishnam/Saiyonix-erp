export type RoleType =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "ACADEMIC_SUB_ADMIN"
  | "FINANCE_SUB_ADMIN"
  | "TEACHER"
  | "STUDENT"
  | "PARENT";

export interface Role {
  id: string;
  roleType: RoleType;
  name?: string | null;
}

export interface User {
  id: string;
  email?: string | null;
  mobile?: string | null;
  schoolId?: string | null;
  roleId: string;
  role: Role;
  mustChangePassword?: boolean;
  phoneVerified?: boolean;
  restricted?: boolean;
  createdAt?: string;
}

export interface AuthPayload {
  accessToken?: string;
  refreshToken?: string;
  csrfToken?: string;
  user: User;
  role?: RoleType;
}

export type AttendanceSummaryLite = {
  attendancePercentage?: number;
  presentDays?: number;
  absentDays?: number;
  lateDays?: number;
  halfDays?: number;
  totalDays?: number;
  riskFlag?: boolean;
};

export type NoticeLite = {
  id: string;
  title: string;
  noticeType?: string;
  publishedAt?: string;
  createdAt?: string;
};

export type CircularLite = {
  id: string;
  title: string;
  body?: string;
  publishedAt?: string;
};

export type StudentDashboardData = {
  todaysAttendanceStatus: string | null;
  attendanceSummary: AttendanceSummaryLite;
  currentClassName?: string | null;
  currentSectionName?: string | null;
  currentAcademicYear?: {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
  } | null;
  promotionStatus?: string | null;
  promotionCongrats?: boolean;
  promotionIsFinalClass?: boolean;
  recentNotices: NoticeLite[];
  recentCirculars: CircularLite[];
  unreadNotificationsCount: number;
  upcomingExams?: Array<{
    examId: string;
    examTitle: string;
    subject: string;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    shift?: string | null;
    roomNumber?: string | null;
  }>;
};

export type TeacherDashboardData = {
  todaysClasses: Array<{ id: string; dayOfWeek: string; roomNo?: string | null }>;
  attendancePendingClasses: Array<unknown>;
  atRiskStudents: Array<{
    studentId: string;
    studentName?: string | null;
    classId: string;
    sectionId: string;
    className?: string | null;
    sectionName?: string | null;
    attendancePercentage: number;
  }>;
  classTeacherSections?: Array<{
    id: string;
    classId: string;
    className?: string | null;
    sectionName?: string | null;
  }>;
  recentNotices: NoticeLite[];
  recentCirculars: CircularLite[];
  unreadNotificationsCount: number;
  currentAcademicYear?: {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
  } | null;
};

export type ParentDashboardData = {
  children: Array<{
    studentId: string;
    studentName?: string | null;
    className?: string | null;
    sectionName?: string | null;
    rollNumber?: number | null;
    currentAcademicYear?: {
      id: string;
      label: string;
      startDate: string;
      endDate: string;
    } | null;
    todaysAttendanceStatus: string | null;
    attendanceSummary: AttendanceSummaryLite;
    promotionStatus?: string | null;
    promotionCongrats?: boolean;
    promotionIsFinalClass?: boolean;
  }>;
  recentNotices: NoticeLite[];
  recentCirculars: CircularLite[];
  unreadNotificationsCount: number;
  upcomingExams?: Array<{
    examId: string;
    examTitle: string;
    subject: string;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    shift?: string | null;
    roomNumber?: string | null;
    studentId?: string;
    studentName?: string | null;
  }>;
};

export type AttendanceRecord = {
  id: string;
  studentId: string;
  student?: { fullName?: string };
  attendanceDate: string;
  status: string;
  remarks?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AttendanceSummary = {
  studentId?: string;
  academicYearId?: string;
  month?: number;
  year?: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  excusedDays?: number;
  attendancePercentage: number;
  riskFlag?: boolean;
};

export type ClassTeacherAttendanceContext = {
  academicYearId: string;
  sections: Array<{
    id: string;
    sectionName: string;
    classId: string;
    className?: string | null;
    students: Array<{ id: string; fullName?: string | null; profilePhotoUrl?: string | null }>;
    timetableSlots: Array<{
      id: string;
      dayOfWeek: number;
      period?: { periodNumber?: number | null } | null;
      classSubject?: { subject?: { name?: string | null } | null } | null;
    }>;
  }>;
};

export type AttendanceContext = {
  classId: string;
  className?: string | null;
  sectionId: string;
  sectionName: string;
  academicYearId: string;
  date: string;
  timeSlot: string;
  alreadySubmitted?: boolean;
  nextOpenAt?: string | null;
  isOpen?: boolean;
  windowStart?: string;
  windowEnd?: string;
  startTime?: string;
  endTime?: string;
};

export type TimetableSlot = {
  dayOfWeek: number;
  roomNo?: string | null;
  period?: { periodNumber?: number; startTime?: string; endTime?: string };
  classSubject?: { subject?: { name?: string | null } | null } | null;
  teacher?: { id?: string; fullName?: string | null } | null;
  section?: { sectionName?: string | null; class?: { className?: string | null } | null } | null;
};

export type TimetableGrouped = Record<string, TimetableSlot[]>;

export type Notice = {
  id: string;
  title: string;
  content: string;
  noticeType: string;
  isPublic?: boolean;
  targetType?: string | null;
  targetClassId?: string | null;
  targetSectionId?: string | null;
  targetRole?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  attachments?: string[] | null;
};

export type MessageItem = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  messageText: string;
  sentAt: string;
  readAt?: string | null;
};

export type MessageContact = {
  userId: string;
  name: string;
  roleType: "STUDENT" | "PARENT";
  studentId?: string;
  parentId?: string;
};

export type TeacherUnreadItem = {
  id: string;
  senderUserId: string;
  senderName: string;
  senderRole: "STUDENT" | "PARENT";
  messageText: string;
  sentAt: string;
};

export type TeacherUnreadSummary = {
  senderUserId: string;
  senderName: string;
  senderRole: "STUDENT" | "PARENT";
  count: number;
  lastMessage: string;
  lastSentAt: string;
};

export type FeeStatus = {
  baseAmount: number | null;
  scholarshipAmount: number | null;
  discountAmount: number | null;
  lateFee: number | null;
  finalAmount: number | null;
  totalAmount: number | null;
  paidAmount: number | null;
  dueDate?: string | null;
  status: "PAID" | "PARTIAL" | "PENDING" | "NOT_PUBLISHED" | string;
};

export type ReceiptItem = {
  id: string;
  amount?: number;
  paidAt?: string;
  paymentId?: string;
  studentId?: string;
  status?: string;
};

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string | null;
};

export type ResultSubject = {
  examSubjectId: string;
  marksObtained: number;
  maxMarks: number;
  passMarks: number;
  subjectName?: string;
};

export type ResultPayload = {
  studentId: string;
  examId: string;
  totalMarks: number;
  percentage: number;
  grade?: string | null;
  subjects: ResultSubject[];
};

export type ReportCardPayload = {
  studentId: string;
  examId: string;
  totalMarks: number;
  percentage: number;
  grade?: string | null;
  subjects: Array<{
    examSubjectId: string;
    marksObtained: number;
    maxMarks: number;
    passMarks: number;
    subjectName?: string;
  }>;
};

export type StudentIdCardData = {
  school: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
  };
  student: {
    id: string;
    fullName: string;
    admissionNumber: string | null;
    dateOfBirth: string;
    bloodGroup: string | null;
    photoUrl: string | null;
    address: string | null;
  };
  className: string | null;
  sectionName: string | null;
  classId: string | null;
  sectionId: string | null;
  parentName: string | null;
  parentPhone: string | null;
  rollNumber: number | null;
  idCardLocks?: { nameLocked: boolean; photoLocked: boolean };
};

export type TeacherIdCardData = {
  school: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
  };
  teacher: {
    id: string;
    fullName: string;
    employeeId: string | null;
    designation: string | null;
    department: string | null;
    joiningDate: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    photoUrl: string | null;
  };
};

export type NotificationItem = {
  id: string;
  readAt?: string | null;
  createdAt?: string;
  notification: {
    id: string;
    title: string;
    body?: string;
    category?: string;
    priority?: string;
    eventType?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    linkUrl?: string | null;
    metadata?: Record<string, unknown> | null;
    sentAt?: string;
    createdAt?: string;
  };
};

export type SchoolOverview = {
  schoolName: string;
  schoolAddress: string | null;
  schoolPhone: string | null;
  officialEmail: string | null;
  logoUrl?: string | null;
};

export type ActiveStudent = {
  id: string;
  fullName?: string | null;
  registrationNumber?: string | null;
  admissionNumber?: string | null;
};

export type ParentProfile = {
  id?: string;
  fullName?: string | null;
  mobile?: string | null;
  email?: string | null;
  relationToStudent?: string | null;
};

export type ParentProfileStudent = {
  id: string;
  fullName: string | null;
  registrationNumber?: string | null;
  admissionNumber?: string | null;
  status?: string | null;
  profile?: {
    profilePhotoUrl?: string | null;
    address?: string | null;
    emergencyContactName?: string | null;
    emergencyContactMobile?: string | null;
    previousSchool?: string | null;
    medicalInfo?: string | null;
  } | null;
};

export type ParentProfileResponse = {
  parent: ParentProfile;
  students: ParentProfileStudent[];
  completionPercentage: number;
};

export type TeacherProfile = {
  id?: string;
  fullName?: string | null;
  employeeId?: string | null;
  phone?: string | null;
  email?: string | null;
  designation?: string | null;
  department?: string | null;
  experience?: string | null;
  qualification?: string | null;
  address?: string | null;
  profilePhotoUrl?: string | null;
};

export type TeacherProfileResponse = {
  teacher: TeacherProfile;
  profileCompletion: number;
};

export type StudentProfile = {
  id?: string;
  fullName?: string | null;
  registrationNumber?: string | null;
  admissionNumber?: string | null;
  rollNumber?: number | null;
  className?: string | null;
  sectionName?: string | null;
  profilePhotoUrl?: string | null;
};

export type LeaveRequest = {
  id: string;
  fromDate: string;
  toDate: string;
  leaveType?: string | null;
  reason?: string | null;
  status?: string | null;
  attachmentUrl?: string | null;
  remarks?: string | null;
  student?: { fullName?: string | null } | null;
  teacher?: { fullName?: string | null; employeeId?: string | null } | null;
};

export type ExamRegistrationSummary = {
  examId: string;
  status: string;
  createdAt: string;
  title: string | null;
  termNo: number | null;
  type: string | null;
};

export type Exam = {
  id: string;
  academicYearId: string;
  termNo: number;
  title: string;
  isPublished: boolean;
  isLocked: boolean;
  isFinalExam?: boolean;
  timetablePublishedAt?: string | null;
  createdAt?: string;
};

export type ExamSubject = {
  id: string;
  classSubjectId: string;
  maxMarks: number;
  passMarks: number;
  classSubject?: {
    classId?: string;
    class?: { className?: string };
    subject?: { name?: string };
  };
  timetable?: Array<{
    id: string;
    examDate: string;
    startTime: string;
    endTime: string;
    venue?: string | null;
  }>;
};

export type ExamDetail = Exam & { examSubjects: ExamSubject[] };
