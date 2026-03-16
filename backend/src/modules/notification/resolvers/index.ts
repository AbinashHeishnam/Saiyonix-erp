import { ApiError } from "../../../core/errors/apiError";
import type { NotificationPayload, ResolverStrategy } from "../types";
import { resolveClass } from "./class";
import { resolveRoleAll } from "./roleAll";
import { resolveSchoolAll } from "./schoolAll";
import { resolveSection } from "./section";
import { resolveStudentWithParents } from "./studentWithParents";
import { resolveTeacherByClassSubject } from "./teacherByClassSubject";
import { resolveUserList } from "./userList";

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

export async function resolveRecipients(
  strategy: ResolverStrategy,
  payload: NotificationPayload
): Promise<string[]> {
  let recipients: string[] = [];

  switch (strategy.type) {
    case "SCHOOL_ALL":
      recipients = await resolveSchoolAll(payload);
      break;
    case "ROLE_ALL":
      recipients = await resolveRoleAll(payload, strategy.roles);
      break;
    case "CLASS":
      recipients = await resolveClass(payload);
      break;
    case "SECTION":
      recipients = await resolveSection(payload);
      break;
    case "STUDENT_WITH_PARENTS":
      recipients = await resolveStudentWithParents(payload, {
        includeParents: strategy.includeParents,
        includeStudent: strategy.includeStudent,
      });
      break;
    case "TEACHER_BY_CLASS_SUBJECT":
      recipients = await resolveTeacherByClassSubject(payload);
      break;
    case "USER_LIST":
      recipients = await resolveUserList(payload);
      break;
    default:
      throw new ApiError(400, "Unsupported recipient resolver strategy");
  }

  return dedupe(recipients.filter(Boolean));
}
