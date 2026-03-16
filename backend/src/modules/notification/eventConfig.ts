import { NotificationPriority } from "@prisma/client";

import type { EventConfig, EventType } from "./types";

export const eventConfig: Record<EventType, EventConfig> = {
  SCHOOL_BROADCAST: {
    eventType: "SCHOOL_BROADCAST",
    priority: NotificationPriority.MEDIUM,
    category: "GENERAL",
    deliveryChannels: ["IN_APP"],
    resolver: { type: "SCHOOL_ALL" },
  },
  ROLE_BROADCAST: {
    eventType: "ROLE_BROADCAST",
    priority: NotificationPriority.MEDIUM,
    category: "GENERAL",
    deliveryChannels: ["IN_APP"],
    resolver: { type: "ROLE_ALL" },
  },
  CLASS_BROADCAST: {
    eventType: "CLASS_BROADCAST",
    priority: NotificationPriority.MEDIUM,
    category: "ACADEMIC",
    deliveryChannels: ["IN_APP"],
    resolver: { type: "CLASS" },
  },
  SECTION_BROADCAST: {
    eventType: "SECTION_BROADCAST",
    priority: NotificationPriority.MEDIUM,
    category: "ACADEMIC",
    deliveryChannels: ["IN_APP"],
    resolver: { type: "SECTION" },
  },
  STUDENT_ALERT: {
    eventType: "STUDENT_ALERT",
    priority: NotificationPriority.HIGH,
    category: "STUDENT",
    deliveryChannels: ["IN_APP"],
    resolver: { type: "STUDENT_WITH_PARENTS", includeParents: true, includeStudent: true },
  },
  CLASS_SUBJECT_ALERT: {
    eventType: "CLASS_SUBJECT_ALERT",
    priority: NotificationPriority.MEDIUM,
    category: "ACADEMIC",
    deliveryChannels: ["IN_APP"],
    resolver: { type: "TEACHER_BY_CLASS_SUBJECT" },
  },
  USER_MESSAGE: {
    eventType: "USER_MESSAGE",
    priority: NotificationPriority.LOW,
    category: "DIRECT",
    deliveryChannels: ["IN_APP"],
    resolver: { type: "USER_LIST" },
  },
  LEAVE_REQUEST_SUBMITTED: {
    eventType: "LEAVE_REQUEST_SUBMITTED",
    priority: NotificationPriority.MEDIUM,
    category: "ACADEMIC",
    deliveryChannels: ["IN_APP", "PUSH", "SMS"],
    resolver: { type: "USER_LIST" },
  },
  LEAVE_REQUEST_APPROVED: {
    eventType: "LEAVE_REQUEST_APPROVED",
    priority: NotificationPriority.MEDIUM,
    category: "ACADEMIC",
    deliveryChannels: ["IN_APP", "PUSH", "SMS"],
    resolver: { type: "USER_LIST" },
  },
  LEAVE_REQUEST_REJECTED: {
    eventType: "LEAVE_REQUEST_REJECTED",
    priority: NotificationPriority.MEDIUM,
    category: "ACADEMIC",
    deliveryChannels: ["IN_APP", "PUSH", "SMS"],
    resolver: { type: "USER_LIST" },
  },
  LEAVE_REQUEST_CANCELLED: {
    eventType: "LEAVE_REQUEST_CANCELLED",
    priority: NotificationPriority.MEDIUM,
    category: "ACADEMIC",
    deliveryChannels: ["IN_APP", "PUSH", "SMS"],
    resolver: { type: "USER_LIST" },
  },
};
