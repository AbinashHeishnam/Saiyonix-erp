import { ApiError } from "@/core/errors/apiError";
import { resolveClass } from "@/modules/notification/resolvers/class";
import { resolveRoleAll } from "@/modules/notification/resolvers/roleAll";
import { resolveSchoolAll } from "@/modules/notification/resolvers/schoolAll";
import { resolveSection } from "@/modules/notification/resolvers/section";
import { resolveStudentWithParents } from "@/modules/notification/resolvers/studentWithParents";
import { resolveTeacherByClassSubject } from "@/modules/notification/resolvers/teacherByClassSubject";
import { resolveUserList } from "@/modules/notification/resolvers/userList";
function dedupe(ids) {
    return Array.from(new Set(ids));
}
export async function resolveRecipients(strategy, payload) {
    let recipients = [];
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
