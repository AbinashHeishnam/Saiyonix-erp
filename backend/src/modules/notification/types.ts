import type { NotificationPriority, UserRole } from "@prisma/client";

export const EVENT_TYPES = [
  "SCHOOL_BROADCAST",
  "ROLE_BROADCAST",
  "CLASS_BROADCAST",
  "SECTION_BROADCAST",
  "STUDENT_ALERT",
  "CLASS_SUBJECT_ALERT",
  "USER_MESSAGE",
  "ASSIGNMENT_PUBLISHED",
  "NOTE_PUBLISHED",
  "LEAVE_REQUEST_SUBMITTED",
  "LEAVE_REQUEST_APPROVED",
  "LEAVE_REQUEST_REJECTED",
  "LEAVE_REQUEST_CANCELLED",
  "SUBSTITUTION_ASSIGNED",
  "PROMOTION_CRITERIA_PUBLISHED",
  "PROMOTION_PUBLISHED",
  "PROMOTION_UNDER_CONSIDERATION",
  "MARKS_SUBMITTED",
  "STUDENT_PROMOTED",
  "TIMETABLE_UPDATED",
  "CLASS_TEACHER_ASSIGNED",
  "CLASS_SUBJECT_ASSIGNED",
  "CLASS_ASSIGNED",
  "EXAM_SCHEDULE_PUBLISHED",
  "EXAM_ROOM_PUBLISHED",
  "FEE_PUBLISHED",
  "FEE_STATUS_UPDATED",
  "ADMIT_CARD_PUBLISHED",
  "ADMIT_CARD_UNLOCKED",
  "RESULT_PUBLISHED",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type DeliveryChannel = "IN_APP" | "EMAIL" | "SMS" | "PUSH";

export type ResolverStrategy =
  | { type: "SCHOOL_ALL" }
  | { type: "ROLE_ALL"; roles?: UserRole[] }
  | { type: "CLASS" }
  | { type: "SECTION" }
  | { type: "STUDENT_WITH_PARENTS"; includeStudent?: boolean; includeParents?: boolean }
  | { type: "TEACHER_BY_CLASS_SUBJECT" }
  | { type: "USER_LIST" };

export type EventConfig = {
  eventType: EventType;
  priority: NotificationPriority;
  category?: string;
  deliveryChannels: DeliveryChannel[];
  resolver: ResolverStrategy;
};

export type NotificationPayload = {
  schoolId: string;
  sentById?: string;
  scheduledAt?: Date;
  linkUrl?: string;
  entityType?: string;
  entityId?: string;
  title?: string;
  body?: string;
  message?: string;
  academicYearId?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  studentId?: string;
  studentIds?: string[];
  studentName?: string;
  classSubjectId?: string;
  subjectName?: string;
  userIds?: string[];
  roles?: UserRole[];
  metadata?: Record<string, unknown>;
};

export type TemplateResult = {
  title: string;
  body: string;
};
