import { ApiError } from "../../core/errors/apiError";
import type { EventType, NotificationPayload, TemplateResult } from "./types";

const templates: Record<EventType, (payload: NotificationPayload) => TemplateResult> = {
  SCHOOL_BROADCAST: (payload) => ({
    title: payload.title?.trim() || "School Announcement",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "A new announcement has been shared with the school.",
  }),
  ROLE_BROADCAST: (payload) => ({
    title: payload.title?.trim() || "Role Announcement",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "A new update is available for your role.",
  }),
  CLASS_BROADCAST: (payload) => {
    const classLabel = payload.className?.trim() || payload.classId || "your class";
    return {
      title: payload.title?.trim() || "Class Update",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `An update is available for ${classLabel}.`,
    };
  },
  SECTION_BROADCAST: (payload) => {
    const sectionLabel =
      payload.sectionName?.trim() || payload.sectionId || "your section";
    return {
      title: payload.title?.trim() || "Section Update",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `An update is available for ${sectionLabel}.`,
    };
  },
  STUDENT_ALERT: (payload) => {
    const studentLabel =
      payload.studentName?.trim() || payload.studentId || "the student";
    return {
      title: payload.title?.trim() || "Student Update",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `An update is available for ${studentLabel}.`,
    };
  },
  CLASS_SUBJECT_ALERT: (payload) => {
    const subjectLabel = payload.subjectName?.trim() || "the subject";
    return {
      title: payload.title?.trim() || "Subject Update",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `An update is available for ${subjectLabel}.`,
    };
  },
  USER_MESSAGE: (payload) => ({
    title: payload.title?.trim() || "Message",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "You have a new message.",
  }),
  LEAVE_REQUEST_SUBMITTED: (payload) => ({
    title: payload.title?.trim() || "Leave Request Submitted",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "A leave request has been submitted and is awaiting approval.",
  }),
  LEAVE_REQUEST_APPROVED: (payload) => ({
    title: payload.title?.trim() || "Leave Request Approved",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "Your leave request has been approved.",
  }),
  LEAVE_REQUEST_REJECTED: (payload) => ({
    title: payload.title?.trim() || "Leave Request Rejected",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "Your leave request has been rejected.",
  }),
  LEAVE_REQUEST_CANCELLED: (payload) => ({
    title: payload.title?.trim() || "Leave Request Cancelled",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "A leave request has been cancelled.",
  }),
};

export function renderTemplate(
  eventType: EventType,
  payload: NotificationPayload
): TemplateResult {
  const template = templates[eventType];
  if (!template) {
    throw new ApiError(400, "Unsupported notification event type");
  }

  const result = template(payload);
  if (!result.title || !result.body) {
    throw new ApiError(400, "Notification template produced empty content");
  }

  return result;
}
