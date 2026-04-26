import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
export var NotificationType;
(function (NotificationType) {
    NotificationType["NOTICE"] = "NOTICE";
    NotificationType["MESSAGE"] = "MESSAGE";
    NotificationType["ASSIGNMENT"] = "ASSIGNMENT";
    NotificationType["ATTENDANCE"] = "ATTENDANCE";
    NotificationType["RESULT"] = "RESULT";
    NotificationType["EXAM"] = "EXAM";
    NotificationType["TIMETABLE"] = "TIMETABLE";
    NotificationType["CALENDAR"] = "CALENDAR";
    NotificationType["ADMIT_CARD"] = "ADMIT_CARD";
    NotificationType["PROMOTION"] = "PROMOTION";
    NotificationType["LEAVE_STATUS"] = "LEAVE_STATUS";
    NotificationType["CERTIFICATE_STATUS"] = "CERTIFICATE_STATUS";
    NotificationType["FEE_UPDATE"] = "FEE_UPDATE";
    NotificationType["SYSTEM"] = "SYSTEM";
})(NotificationType || (NotificationType = {}));
export var TargetScope;
(function (TargetScope) {
    TargetScope["ALL"] = "ALL";
    TargetScope["ROLE"] = "ROLE";
    TargetScope["CLASS"] = "CLASS";
    TargetScope["SECTION"] = "SECTION";
    TargetScope["USER"] = "USER";
})(TargetScope || (TargetScope = {}));
export var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["TEACHER"] = "TEACHER";
    UserRole["STUDENT"] = "STUDENT";
    UserRole["PARENT"] = "PARENT";
})(UserRole || (UserRole = {}));
export async function resolveNotificationRecipients(payload) {
    // Prevent empty notifications
    if (!payload.message && !payload.fileUrl && !payload.title) {
        console.log("[NOTIF RESOLVER] Skipping empty notification");
        return [];
    }
    const { type, scope, schoolId, senderId } = payload;
    let userIds = [];
    const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, role: { select: { roleType: true } } },
    });
    if (!sender) {
        throw new ApiError(404, "Sender not found");
    }
    const senderRoleType = sender.role?.roleType;
    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN"].includes(senderRoleType || "");
    const isTeacher = senderRoleType === "TEACHER";
    const isStudentOrParent = ["STUDENT", "PARENT"].includes(senderRoleType || "");
    // Resolve Active Academic Year Helper
    const getActiveAcademicYear = async () => {
        const ay = await prisma.academicYear.findFirst({
            where: { schoolId, isActive: true },
        });
        return ay?.id;
    };
    // Helper to fetch admins
    const fetchAdmins = async () => {
        const admins = await prisma.user.findMany({
            where: {
                schoolId,
                isActive: true,
                role: { roleType: { in: ["SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN"] } }
            },
            select: { id: true },
        });
        return admins.map(a => a.id);
    };
    // 1. ADMIN -> ALL
    if (isAdmin && scope === TargetScope.ALL) {
        const users = await prisma.user.findMany({
            where: { schoolId, isActive: true },
            select: { id: true },
        });
        userIds = users.map(u => u.id);
    }
    // 2. ADMIN -> TEACHER
    else if (isAdmin && scope === TargetScope.ROLE && payload.role === UserRole.TEACHER) {
        const teachers = await prisma.user.findMany({
            where: { schoolId, isActive: true, role: { roleType: "TEACHER" } },
            select: { id: true },
        });
        userIds = teachers.map(t => t.id);
    }
    // 3. ADMIN -> STUDENT/PARENT
    else if (isAdmin && [TargetScope.USER, TargetScope.CLASS, TargetScope.ROLE, TargetScope.ALL].includes(scope) && (payload.role === UserRole.STUDENT || payload.role === UserRole.PARENT || !payload.role)) {
        if (scope === TargetScope.USER && payload.studentId) {
            // Specific student + parents
            const st = await prisma.student.findUnique({
                where: { id: payload.studentId },
                select: { userId: true },
            });
            if (st?.userId)
                userIds.push(st.userId);
            const links = await prisma.parentStudentLink.findMany({
                where: { studentId: payload.studentId, isActive: true, parent: { userId: { not: null } } },
                select: { parent: { select: { userId: true } } },
            });
            userIds.push(...links.map(l => l.parent.userId).filter((id) => Boolean(id)));
        }
        else if (scope === TargetScope.CLASS && payload.classId) {
            // Bulk class -> all students in class + parents
            const academicYearId = await getActiveAcademicYear();
            const enrollments = await prisma.studentEnrollment.findMany({
                where: { academicYearId, classId: payload.classId, student: { schoolId, deletedAt: null, status: "ACTIVE", userId: { not: null } } },
                select: { studentId: true, student: { select: { userId: true } } },
            });
            const stIds = enrollments.map(e => e.studentId);
            userIds.push(...enrollments.map(e => e.student.userId).filter((id) => Boolean(id)));
            const links = await prisma.parentStudentLink.findMany({
                where: { studentId: { in: stIds }, isActive: true, parent: { userId: { not: null } } },
                select: { parent: { select: { userId: true } } },
            });
            userIds.push(...links.map(l => l.parent.userId).filter((id) => Boolean(id)));
        }
        else if (scope === TargetScope.ROLE || scope === TargetScope.ALL) {
            // Global -> all students + parents
            const reqRoles = payload.role === UserRole.STUDENT ? ["STUDENT"] : payload.role === UserRole.PARENT ? ["PARENT"] : ["STUDENT", "PARENT"];
            const sps = await prisma.user.findMany({
                where: { schoolId, isActive: true, role: { roleType: { in: reqRoles } } },
                select: { id: true },
            });
            userIds.push(...sps.map(u => u.id));
        }
    }
    // 4. TEACHER -> STUDENT/PARENT
    else if (isTeacher && (scope === TargetScope.CLASS || scope === TargetScope.SECTION || scope === TargetScope.USER || scope === TargetScope.ROLE)) {
        // CRITICAL: MUST BE SCOPED
        if (type === NotificationType.MESSAGE && payload.classId && payload.sectionId) {
            // classroom chat -> only room members
            const academicYearId = await getActiveAcademicYear();
            const enrollments = await prisma.studentEnrollment.findMany({
                where: { academicYearId, classId: payload.classId, sectionId: payload.sectionId, student: { schoolId, deletedAt: null, status: "ACTIVE", userId: { not: null } } },
                select: { student: { select: { userId: true } } },
            });
            userIds.push(...enrollments.map(e => e.student.userId).filter((id) => Boolean(id)));
        }
        else if (type === NotificationType.ASSIGNMENT && payload.classId) {
            // assignment -> section/class students + parents
            const academicYearId = await getActiveAcademicYear();
            const enrollments = await prisma.studentEnrollment.findMany({
                where: { academicYearId, classId: payload.classId, ...(payload.sectionId ? { sectionId: payload.sectionId } : {}), student: { schoolId, deletedAt: null, status: "ACTIVE", userId: { not: null } } },
                select: { studentId: true, student: { select: { userId: true } } },
            });
            const stIds = enrollments.map(e => e.studentId);
            userIds.push(...enrollments.map(e => e.student.userId).filter((id) => Boolean(id)));
            const links = await prisma.parentStudentLink.findMany({
                where: { studentId: { in: stIds }, isActive: true, parent: { userId: { not: null } } },
                select: { parent: { select: { userId: true } } },
            });
            userIds.push(...links.map(l => l.parent.userId).filter((id) => Boolean(id)));
        }
        else if (scope === TargetScope.USER || type === NotificationType.ATTENDANCE) {
            // attendance -> specific student (or user target)
            let targetStudentIds = [];
            if (payload.studentId)
                targetStudentIds = [payload.studentId];
            if (payload.userIds && payload.userIds.length > 0) {
                // Find students by userIds
                const stUsers = await prisma.student.findMany({
                    where: { userId: { in: payload.userIds }, schoolId },
                    select: { id: true, userId: true },
                });
                targetStudentIds.push(...stUsers.map(s => s.id));
                userIds.push(...stUsers.map(s => s.userId).filter((id) => Boolean(id)));
            }
            // Ensure parent linkage
            if (targetStudentIds.length > 0) {
                const links = await prisma.parentStudentLink.findMany({
                    where: { studentId: { in: targetStudentIds }, isActive: true, parent: { userId: { not: null } } },
                    select: { parent: { select: { userId: true } } },
                });
                userIds.push(...links.map(l => l.parent.userId).filter((id) => Boolean(id)));
            }
        }
        else {
            // announcement -> class/section only (NOT ALL USERS)
            const academicYearId = await getActiveAcademicYear();
            const enrollments = await prisma.studentEnrollment.findMany({
                where: { academicYearId, classId: payload.classId, ...(payload.sectionId ? { sectionId: payload.sectionId } : {}), student: { schoolId, deletedAt: null, status: "ACTIVE", userId: { not: null } } },
                select: { student: { select: { userId: true } } },
            });
            userIds.push(...enrollments.map(e => e.student.userId).filter((id) => Boolean(id)));
        }
    }
    // 5. TEACHER -> ADMIN
    else if (isTeacher && (payload.role === UserRole.ADMIN || scope === TargetScope.ROLE)) {
        // -> all admins
        userIds = await fetchAdmins();
    }
    // 6. STUDENT/PARENT -> TEACHER
    else if (isStudentOrParent && payload.role === UserRole.TEACHER) {
        if (payload.teacherId) {
            const tc = await prisma.teacher.findUnique({
                where: { id: payload.teacherId },
                select: { userId: true },
            });
            if (tc?.userId)
                userIds.push(tc.userId);
        }
        else if (payload.classId && payload.sectionId) {
            // classroom -> room teacher
            const sectionMapping = await prisma.section.findFirst({
                where: { id: payload.sectionId, classId: payload.classId },
                select: { classTeacher: { select: { userId: true } } }
            });
            if (sectionMapping?.classTeacher?.userId)
                userIds.push(sectionMapping.classTeacher.userId);
        }
        else if (payload.classId) {
            // class teacher -> assigned teacher
            const classMapping = await prisma.class.findFirst({
                where: { id: payload.classId },
                select: { classTeacher: { select: { userId: true } } }
            });
            if (classMapping?.classTeacher?.userId)
                userIds.push(classMapping.classTeacher.userId);
        }
    }
    // 7. STUDENT/PARENT -> ADMIN
    else if (isStudentOrParent && [NotificationType.CERTIFICATE_STATUS, NotificationType.LEAVE_STATUS, NotificationType.EXAM /* proxy for recheck */].includes(type) || payload.role === UserRole.ADMIN) {
        // -> all admins
        userIds = await fetchAdmins();
    }
    // Fallback for direct user targeting (without specific rules mapping like ADMIN->ALL)
    else if (scope === TargetScope.USER && payload.userIds) {
        const validUsers = await prisma.user.findMany({
            where: { schoolId, id: { in: payload.userIds }, isActive: true },
            select: { id: true },
        });
        userIds.push(...validUsers.map(u => u.id));
    }
    else {
        // Unknown combination
        console.warn("[NOTIF RESOLVER] Unhandled combination", { type, scope, role: payload.role, senderRoleType });
    }
    // Ensure deductions
    const uniqueUsers = [...new Set(userIds)].filter((id) => typeof id === "string" && id !== senderId);
    // Logging (MANDATORY FOR DEBUGGING)
    console.log("[NOTIF RESOLVER]", {
        type,
        scope,
        resolvedUsers: uniqueUsers.length
    });
    return uniqueUsers;
}
