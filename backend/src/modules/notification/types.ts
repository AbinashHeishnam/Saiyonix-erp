import type { NotificationPriority, UserRole } from "@prisma/client";

export const EVENT_TYPES = [
  "SCHOOL_BROADCAST",
  "ROLE_BROADCAST",
  "CLASS_BROADCAST",
  "SECTION_BROADCAST",
  "STUDENT_ALERT",
  "CLASS_SUBJECT_ALERT",
  "USER_MESSAGE",
  "LEAVE_REQUEST_SUBMITTED",
  "LEAVE_REQUEST_APPROVED",
  "LEAVE_REQUEST_REJECTED",
  "LEAVE_REQUEST_CANCELLED",
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
  title?: string;
  body?: string;
  message?: string;
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
