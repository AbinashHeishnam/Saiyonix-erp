import { ApiError } from "@/core/errors/apiError";
import type { EventType, NotificationPayload, TemplateResult } from "@/modules/notification/types";

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
  ASSIGNMENT_PUBLISHED: (payload) => ({
    title: payload.title?.trim() || "New Assignment",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "A new assignment has been posted.",
  }),
  NOTE_PUBLISHED: (payload) => ({
    title: payload.title?.trim() || "New Note",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "A new note has been published.",
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
  SUBSTITUTION_ASSIGNED: (payload) => ({
    title: payload.title?.trim() || "Emergency Substitution Assigned",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "You have been assigned as a substitute teacher for today.",
  }),
  PROMOTION_CRITERIA_PUBLISHED: (payload) => ({
    title: payload.title?.trim() || "Promotion Criteria Published",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "Promotion criteria has been published for the academic year.",
  }),
  PROMOTION_PUBLISHED: (payload) => ({
    title: payload.title?.trim() || "Promotion Results Published",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "Promotion results have been published.",
  }),
  PROMOTION_UNDER_CONSIDERATION: (payload) => ({
    title: payload.title?.trim() || "Promotion Under Consideration",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "A promotion override requires admin review.",
  }),
  MARKS_SUBMITTED: (payload) => ({
    title: payload.title?.trim() || "Marks Submitted",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "Marks have been submitted and require review.",
  }),
  STUDENT_PROMOTED: (payload) => ({
    title: payload.title?.trim() || "Promotion Update",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "You have been promoted to the next class.",
  }),
  TIMETABLE_UPDATED: (payload) => {
    const classLabel = payload.className?.trim() || payload.classId || "your class";
    const sectionLabel = payload.sectionName?.trim() || payload.sectionId;
    const targetLabel = sectionLabel ? `${classLabel} ${sectionLabel}` : classLabel;
    return {
      title: payload.title?.trim() || "Timetable Updated",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `The timetable has been updated for ${targetLabel}.`,
    };
  },
  CLASS_TEACHER_ASSIGNED: (payload) => {
    const classLabel = payload.className?.trim() || payload.classId || "the class";
    const sectionLabel = payload.sectionName?.trim() || payload.sectionId;
    const targetLabel = sectionLabel ? `${classLabel} ${sectionLabel}` : classLabel;
    return {
      title: payload.title?.trim() || "Class Teacher Assigned",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `A class teacher has been assigned for ${targetLabel}.`,
    };
  },
  CLASS_SUBJECT_ASSIGNED: (payload) => {
    const subjectLabel = payload.subjectName?.trim() || "a subject";
    const classLabel = payload.className?.trim() || payload.classId || "the class";
    const sectionLabel = payload.sectionName?.trim() || payload.sectionId;
    const targetLabel = sectionLabel ? `${classLabel} ${sectionLabel}` : classLabel;
    return {
      title: payload.title?.trim() || "Class Assignment Updated",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `${subjectLabel} has been assigned for ${targetLabel}.`,
    };
  },
  CLASS_ASSIGNED: (payload) => {
    const classLabel = payload.className?.trim() || payload.classId || "a class";
    const sectionLabel = payload.sectionName?.trim() || payload.sectionId;
    const targetLabel = sectionLabel ? `${classLabel} ${sectionLabel}` : classLabel;
    return {
      title: payload.title?.trim() || "Class Assigned",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `You have been assigned to ${targetLabel}.`,
    };
  },
  EXAM_SCHEDULE_PUBLISHED: (payload) => {
    const examLabel = payload.metadata?.examTitle ?? payload.title ?? "Exam";
    const classLabel = payload.className?.trim() || payload.classId || "your class";
    return {
      title: payload.title?.trim() || "Exam Schedule Published",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `The exam schedule for ${examLabel} has been published for ${classLabel}.`,
    };
  },
  EXAM_ROOM_PUBLISHED: (payload) => {
    const examLabel = payload.metadata?.examTitle ?? payload.title ?? "Exam";
    const classLabel = payload.className?.trim() || payload.classId || "your class";
    return {
      title: payload.title?.trim() || "Exam Room Allocation Published",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `Room allocation for ${examLabel} is now available for ${classLabel}.`,
    };
  },
  FEE_PUBLISHED: (payload) => {
    const classLabel = payload.className?.trim() || payload.classId || "your class";
    return {
      title: payload.title?.trim() || "Fee Structure Published",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `The fee structure has been published for ${classLabel}.`,
    };
  },
  FEE_STATUS_UPDATED: (payload) => ({
    title: payload.title?.trim() || "Fee Status Updated",
    body:
      payload.body?.trim() ||
      payload.message?.trim() ||
      "Your fee status has been updated.",
  }),
  ADMIT_CARD_PUBLISHED: (payload) => {
    const examLabel = payload.metadata?.examTitle ?? payload.title ?? "Exam";
    return {
      title: payload.title?.trim() || "Admit Card Available",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `Admit cards for ${examLabel} are now available.`,
    };
  },
  ADMIT_CARD_UNLOCKED: (payload) => {
    const examLabel = payload.metadata?.examTitle ?? payload.title ?? "Exam";
    return {
      title: payload.title?.trim() || "Admit Card Unlocked",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `Admit card access is unlocked for ${examLabel}.`,
    };
  },
  RESULT_PUBLISHED: (payload) => {
    const examLabel = payload.metadata?.examTitle ?? payload.title ?? "Exam";
    return {
      title: payload.title?.trim() || "Result Published",
      body:
        payload.body?.trim() ||
        payload.message?.trim() ||
        `Results for ${examLabel} have been published.`,
    };
  },
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
