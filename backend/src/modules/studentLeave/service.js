import { AttendanceStatus, LeaveStatus } from "@prisma/client";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { buildDateRange, normalizeDate } from "@/core/utils/date";
import { safeRedisDel } from "@/core/cache/invalidate";
import { logAudit } from "@/utils/audit";
import { createAndDispatchNotification } from "@/services/notificationEngine";
function toSecureFileUrl(value) {
    if (!value)
        return null;
    if (/^https?:\/\//i.test(value))
        return value;
    if (value.startsWith("/api/v1/files/secure"))
        return value;
    return `/api/v1/files/secure?fileUrl=${encodeURIComponent(value)}`;
}
function ensureActor(actor) {
    if (!actor.userId || !actor.roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    return { userId: actor.userId, roleType: actor.roleType };
}
async function resolveStudentContext(schoolId, actor, studentId) {
    const { userId, roleType } = ensureActor(actor);
    if (roleType === "STUDENT") {
        const student = await prisma.student.findFirst({
            where: { schoolId, userId, deletedAt: null },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(403, "Student account not linked");
        }
        return { studentId: student.id, appliedByParentId: null };
    }
    if (roleType === "PARENT") {
        const parent = await prisma.parent.findFirst({
            where: { schoolId, userId },
            select: { id: true },
        });
        if (!parent) {
            throw new ApiError(403, "Parent account not linked");
        }
        if (!studentId) {
            throw new ApiError(400, "studentId is required");
        }
        const link = await prisma.parentStudentLink.findFirst({
            where: {
                parentId: parent.id,
                studentId,
                student: { schoolId, deletedAt: null },
            },
            select: { id: true },
        });
        if (!link) {
            throw new ApiError(403, "Parent is not linked to this student");
        }
        return { studentId, appliedByParentId: parent.id };
    }
    if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN" || roleType === "SUPER_ADMIN") {
        if (!studentId) {
            throw new ApiError(400, "studentId is required");
        }
        const student = await prisma.student.findFirst({
            where: { id: studentId, schoolId, deletedAt: null },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(400, "Student not found for this school");
        }
        return { studentId, appliedByParentId: null };
    }
    throw new ApiError(403, "Forbidden");
}
async function ensureNoOverlap(schoolId, studentId, fromDate, toDate) {
    const existing = await prisma.studentLeave.findFirst({
        where: {
            studentId,
            status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
            fromDate: { lte: toDate },
            toDate: { gte: fromDate },
            student: { schoolId },
        },
        select: { id: true },
    });
    if (existing) {
        throw new ApiError(409, "Overlapping leave request exists");
    }
}
async function resolveStudentLeaveScope(schoolId, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN" || roleType === "SUPER_ADMIN") {
        return { type: "ALL" };
    }
    if (roleType === "STUDENT") {
        const student = await prisma.student.findFirst({
            where: { schoolId, userId, deletedAt: null },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(403, "Student account not linked");
        }
        return { type: "STUDENT_IDS", studentIds: [student.id] };
    }
    if (roleType === "PARENT") {
        const parent = await prisma.parent.findFirst({
            where: { schoolId, userId },
            select: { id: true },
        });
        if (!parent) {
            throw new ApiError(403, "Parent account not linked");
        }
        const links = await prisma.parentStudentLink.findMany({
            where: { parentId: parent.id, student: { schoolId, deletedAt: null } },
            select: { studentId: true },
        });
        return { type: "STUDENT_IDS", studentIds: links.map((link) => link.studentId) };
    }
    if (roleType === "TEACHER") {
        const teacher = await prisma.teacher.findFirst({
            where: { userId, schoolId, deletedAt: null },
            select: { id: true },
        });
        if (!teacher) {
            throw new ApiError(403, "Teacher account not linked");
        }
        const sections = await prisma.section.findMany({
            where: { classTeacherId: teacher.id, deletedAt: null, class: { schoolId } },
            select: { id: true },
        });
        if (sections.length === 0) {
            return { type: "STUDENT_IDS", studentIds: [] };
        }
        const enrollments = await prisma.studentEnrollment.findMany({
            where: {
                sectionId: { in: sections.map((section) => section.id) },
                student: { schoolId, deletedAt: null },
            },
            select: { studentId: true },
        });
        const ids = Array.from(new Set(enrollments.map((item) => item.studentId)));
        return { type: "STUDENT_IDS", studentIds: ids };
    }
    throw new ApiError(403, "Forbidden");
}
async function ensureTeacherIsClassTeacher(schoolId, userId, studentId) {
    const teacher = await prisma.teacher.findFirst({
        where: { userId, schoolId, deletedAt: null },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(403, "Teacher account not linked");
    }
    const enrollment = await prisma.studentEnrollment.findFirst({
        where: { studentId, student: { schoolId, deletedAt: null } },
        orderBy: { createdAt: "desc" },
        select: { sectionId: true },
    });
    if (!enrollment) {
        throw new ApiError(400, "Student enrollment not found");
    }
    const section = await prisma.section.findFirst({
        where: {
            id: enrollment.sectionId,
            classTeacherId: teacher.id,
            deletedAt: null,
            class: { schoolId, deletedAt: null },
        },
        select: { id: true },
    });
    if (!section) {
        throw new ApiError(403, "Forbidden");
    }
}
async function resolveApproverUserIds(schoolId, studentId) {
    const enrollment = await prisma.studentEnrollment.findFirst({
        where: { studentId, student: { schoolId, deletedAt: null } },
        orderBy: { createdAt: "desc" },
        select: {
            section: {
                select: {
                    classTeacher: { select: { userId: true } },
                },
            },
        },
    });
    const teacherUserId = enrollment?.section?.classTeacher?.userId ?? null;
    const adminUsers = await prisma.user.findMany({
        where: {
            schoolId,
            isActive: true,
            role: { roleType: { in: ["ADMIN", "ACADEMIC_SUB_ADMIN"] } },
        },
        select: { id: true },
    });
    const ids = adminUsers.map((user) => user.id);
    if (teacherUserId) {
        ids.push(teacherUserId);
    }
    return Array.from(new Set(ids));
}
function resolveRequesterUserId(leave) {
    if (leave.appliedByParent?.userId) {
        return leave.appliedByParent.userId;
    }
    return leave.student.userId ?? null;
}
async function resolveStudentAndParentUserIds(params) {
    const ids = new Set();
    if (params.studentUserId)
        ids.add(params.studentUserId);
    if (params.appliedByParentUserId)
        ids.add(params.appliedByParentUserId);
    const links = await prisma.parentStudentLink.findMany({
        where: {
            studentId: params.studentId,
            isActive: true,
            parent: { schoolId: params.schoolId, userId: { not: null } },
        },
        select: { parent: { select: { userId: true } } },
    });
    for (const link of links) {
        if (link.parent.userId) {
            ids.add(link.parent.userId);
        }
    }
    return Array.from(ids);
}
async function applyApprovedLeaveAttendance(schoolId, studentId, fromDate, toDate, approvedByUserId) {
    const approverTeacher = approvedByUserId
        ? await prisma.teacher.findFirst({
            where: { schoolId, userId: approvedByUserId, deletedAt: null },
            select: { id: true },
        })
        : null;
    const enrollment = await prisma.studentEnrollment.findFirst({
        where: { studentId, student: { schoolId, deletedAt: null } },
        orderBy: { createdAt: "desc" },
        select: { sectionId: true, academicYearId: true },
    });
    if (!enrollment) {
        return;
    }
    const section = await prisma.section.findFirst({
        where: { id: enrollment.sectionId, deletedAt: null, class: { schoolId } },
        select: { classTeacherId: true },
    });
    const markerTeacherId = approverTeacher?.id ?? section?.classTeacherId ?? null;
    if (!markerTeacherId) {
        return;
    }
    const rangeStart = normalizeDate(fromDate);
    const rangeEnd = normalizeDate(toDate);
    const dates = buildDateRange(rangeStart, rangeEnd);
    if (dates.length === 0) {
        return;
    }
    const holidays = await prisma.holiday.findMany({
        where: {
            schoolId,
            academicYearId: enrollment.academicYearId,
            holidayDate: {
                gte: rangeStart,
                lte: rangeEnd,
            },
        },
        select: { holidayDate: true },
    });
    const holidaySet = new Set(holidays.map((item) => normalizeDate(item.holidayDate).toISOString()));
    for (const date of dates) {
        const normalized = normalizeDate(date);
        const key = normalized.toISOString();
        if (normalized.getUTCDay() === 0) {
            continue;
        }
        if (holidaySet.has(key)) {
            continue;
        }
        await prisma.studentAttendance.upsert({
            where: {
                studentId_attendanceDate: {
                    studentId,
                    attendanceDate: normalized,
                },
            },
            update: {
                status: AttendanceStatus.EXCUSED,
            },
            create: {
                studentId,
                academicYearId: enrollment.academicYearId,
                sectionId: enrollment.sectionId,
                attendanceDate: normalized,
                status: AttendanceStatus.EXCUSED,
                markedByTeacherId: markerTeacherId,
            },
        });
    }
}
export async function createStudentLeave(schoolId, payload, actor) {
    const { userId } = ensureActor(actor);
    const context = await resolveStudentContext(schoolId, actor, payload.studentId);
    const fromDate = normalizeDate(payload.startDate);
    const toDate = normalizeDate(payload.endDate);
    if (toDate < fromDate) {
        throw new ApiError(400, "endDate must be on or after startDate");
    }
    await ensureNoOverlap(schoolId, context.studentId, fromDate, toDate);
    const leave = await prisma.studentLeave.create({
        data: {
            studentId: context.studentId,
            appliedByParentId: context.appliedByParentId,
            fromDate,
            toDate,
            reason: payload.reason,
            leaveType: payload.leaveType ?? null,
            attachmentUrl: payload.attachmentUrl ?? null,
            status: LeaveStatus.PENDING,
        },
    });
    await logAudit({
        userId,
        action: "CREATE",
        entity: "StudentLeave",
        entityId: leave.id,
        metadata: {
            studentId: context.studentId,
            fromDate,
            toDate,
            leaveType: payload.leaveType ?? null,
        },
    });
    await createAndDispatchNotification({
        type: "LEAVE_APPLIED",
        title: "Leave Request Submitted",
        message: "A new student leave request is awaiting approval.",
        senderId: userId,
        targetType: "ROLE",
        role: "ADMIN",
        meta: {
            entityType: "STUDENT_LEAVE",
            entityId: leave.id,
            leaveId: leave.id,
            studentId: context.studentId,
            leaveType: payload.leaveType ?? null,
            linkUrl: "/admin/student-leaves",
        },
    });
    return leave;
}
export async function applyStudentLeave(schoolId, payload, actor) {
    const mapped = {
        studentId: payload.studentId,
        startDate: payload.fromDate,
        endDate: payload.toDate,
        reason: payload.reason,
        leaveType: payload.leaveType,
        attachmentUrl: payload.attachmentUrl,
    };
    return createStudentLeave(schoolId, mapped, actor);
}
export async function listStudentLeaves(schoolId, actor, pagination) {
    const scope = await resolveStudentLeaveScope(schoolId, actor);
    if (scope.type === "STUDENT_IDS" && scope.studentIds.length === 0) {
        return { items: [], total: 0 };
    }
    const where = {
        student: { schoolId },
        ...(scope.type === "STUDENT_IDS"
            ? { studentId: { in: scope.studentIds } }
            : {}),
    };
    const [items, total] = await prisma.$transaction([
        prisma.studentLeave.findMany({
            where,
            select: {
                id: true,
                studentId: true,
                student: { select: { fullName: true, profile: { select: { profilePhotoUrl: true } } } },
                fromDate: true,
                toDate: true,
                reason: true,
                leaveType: true,
                status: true,
                attachmentUrl: true,
                adminRemarks: true,
                approvedAt: true,
                approvedById: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: [{ createdAt: "desc" }],
            ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.studentLeave.count({ where }),
    ]);
    const mapped = items.map((item) => ({
        ...item,
        attachmentUrl: toSecureFileUrl(item.attachmentUrl),
    }));
    return { items: mapped, total };
}
export async function getStudentLeaveById(schoolId, id, actor) {
    const leave = await prisma.studentLeave.findFirst({
        where: { id, student: { schoolId } },
        include: {
            student: { select: { id: true, userId: true } },
            appliedByParent: { select: { id: true, userId: true } },
        },
    });
    if (!leave) {
        throw new ApiError(404, "Leave request not found");
    }
    const { userId, roleType } = ensureActor(actor);
    if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN") {
        return { ...leave, attachmentUrl: toSecureFileUrl(leave.attachmentUrl) };
    }
    if (roleType === "STUDENT") {
        if (leave.student.userId !== userId) {
            throw new ApiError(403, "Forbidden");
        }
        return { ...leave, attachmentUrl: toSecureFileUrl(leave.attachmentUrl) };
    }
    if (roleType === "PARENT") {
        const parent = await prisma.parent.findFirst({
            where: { schoolId, userId },
            select: { id: true },
        });
        if (!parent) {
            throw new ApiError(403, "Parent account not linked");
        }
        const link = await prisma.parentStudentLink.findFirst({
            where: { parentId: parent.id, studentId: leave.student.id },
            select: { id: true },
        });
        if (!link) {
            throw new ApiError(403, "Forbidden");
        }
        return { ...leave, attachmentUrl: toSecureFileUrl(leave.attachmentUrl) };
    }
    if (roleType === "TEACHER") {
        await ensureTeacherIsClassTeacher(schoolId, userId, leave.student.id);
        return { ...leave, attachmentUrl: toSecureFileUrl(leave.attachmentUrl) };
    }
    throw new ApiError(403, "Forbidden");
}
async function updateStudentLeaveStatus(schoolId, id, actor, status, remarks) {
    const leave = await prisma.studentLeave.findFirst({
        where: { id, student: { schoolId } },
        include: {
            student: { select: { id: true, userId: true } },
            appliedByParent: { select: { id: true, userId: true } },
        },
    });
    if (!leave) {
        throw new ApiError(404, "Leave request not found");
    }
    const { userId, roleType } = ensureActor(actor);
    if (roleType === "TEACHER") {
        await ensureTeacherIsClassTeacher(schoolId, userId, leave.student.id);
    }
    else if (roleType !== "ADMIN" &&
        roleType !== "ACADEMIC_SUB_ADMIN" &&
        roleType !== "SUPER_ADMIN") {
        throw new ApiError(403, "Forbidden");
    }
    if (leave.status !== LeaveStatus.PENDING) {
        throw new ApiError(400, "Leave request already processed");
    }
    const updated = await prisma.studentLeave.update({
        where: { id: leave.id },
        data: {
            status,
            approvedById: userId,
            approvedAt: new Date(),
            ...(remarks !== undefined ? { adminRemarks: remarks } : {}),
        },
    });
    await logAudit({
        userId,
        action: status === LeaveStatus.APPROVED ? "APPROVE" : "REJECT",
        entity: "StudentLeave",
        entityId: leave.id,
        metadata: {
            studentId: leave.student.id,
            status,
            remarks: remarks ?? null,
        },
    });
    if (status === LeaveStatus.APPROVED) {
        await applyApprovedLeaveAttendance(schoolId, leave.student.id, leave.fromDate, leave.toDate, userId);
    }
    const requesterUserId = resolveRequesterUserId(leave);
    if (requesterUserId) {
        const recipientUserIds = await resolveStudentAndParentUserIds({
            schoolId,
            studentId: leave.student.id,
            studentUserId: leave.student.userId ?? null,
            appliedByParentUserId: leave.appliedByParent?.userId ?? null,
        });
        if (recipientUserIds.length > 0) {
            await createAndDispatchNotification({
                type: status === LeaveStatus.APPROVED
                    ? "STUDENT_LEAVE_APPROVED"
                    : "STUDENT_LEAVE_REJECTED",
                title: `Leave ${status === LeaveStatus.APPROVED ? "Approved" : "Rejected"}`,
                message: `Your student leave request has been ${status === LeaveStatus.APPROVED ? "approved" : "rejected"}.`,
                senderId: userId,
                targetType: "USER",
                userIds: recipientUserIds,
                meta: {
                    entityType: "STUDENT_LEAVE",
                    entityId: leave.id,
                    leaveId: leave.id,
                    studentId: leave.student.id,
                    leaveType: leave.leaveType ?? null,
                    linkUrl: "/student/leave",
                    eventType: status === LeaveStatus.APPROVED
                        ? "LEAVE_REQUEST_APPROVED"
                        : "LEAVE_REQUEST_REJECTED",
                },
            });
        }
    }
    try {
        const keys = [`leave:student:${leave.student.id}`];
        if (requesterUserId) {
            keys.push(`leave:user:${requesterUserId}`);
            keys.push(`dashboard:parent:${requesterUserId}`);
        }
        keys.push(`dashboard:student:${leave.student.id}`);
        await safeRedisDel(keys);
    }
    catch {
        // ignore cache failures
    }
    return updated;
}
export async function approveStudentLeave(schoolId, id, actor) {
    return updateStudentLeaveStatus(schoolId, id, actor, LeaveStatus.APPROVED);
}
export async function rejectStudentLeave(schoolId, id, actor) {
    return updateStudentLeaveStatus(schoolId, id, actor, LeaveStatus.REJECTED);
}
export async function adminUpdateStudentLeaveStatus(schoolId, id, actor, status, remarks) {
    return updateStudentLeaveStatus(schoolId, id, actor, status, remarks);
}
export async function cancelStudentLeave(schoolId, id, actor) {
    const leave = await prisma.studentLeave.findFirst({
        where: { id, student: { schoolId } },
        include: {
            student: { select: { id: true, userId: true } },
            appliedByParent: { select: { id: true, userId: true } },
        },
    });
    if (!leave) {
        throw new ApiError(404, "Leave request not found");
    }
    if (leave.status !== LeaveStatus.PENDING) {
        throw new ApiError(400, "Only pending leave can be cancelled");
    }
    const { userId, roleType } = ensureActor(actor);
    if (leave.appliedByParent?.userId) {
        if (roleType !== "PARENT" || leave.appliedByParent.userId !== userId) {
            throw new ApiError(403, "Forbidden");
        }
    }
    else {
        if (roleType !== "STUDENT" || leave.student.userId !== userId) {
            throw new ApiError(403, "Forbidden");
        }
    }
    const updated = await prisma.studentLeave.update({
        where: { id: leave.id },
        data: {
            status: LeaveStatus.CANCELLED,
            approvedById: null,
            approvedAt: null,
        },
    });
    await logAudit({
        userId,
        action: "CANCEL",
        entity: "StudentLeave",
        entityId: leave.id,
        metadata: {
            studentId: leave.student.id,
            status: LeaveStatus.CANCELLED,
        },
    });
    await createAndDispatchNotification({
        type: "LEAVE_APPLIED",
        title: "Leave Request Cancelled",
        message: "A student leave request has been cancelled.",
        senderId: userId,
        targetType: "ROLE",
        role: "ADMIN",
        meta: {
            entityType: "STUDENT_LEAVE",
            entityId: leave.id,
            leaveId: leave.id,
            studentId: leave.student.id,
            leaveType: leave.leaveType ?? null,
            eventType: "LEAVE_REQUEST_CANCELLED",
            linkUrl: "/admin/student-leaves",
        },
    });
    return updated;
}
export async function getStudentLeaveTimeline(schoolId, id, actor) {
    await getStudentLeaveById(schoolId, id, actor);
    const logs = await prisma.auditLog.findMany({
        where: { entity: "StudentLeave", entityId: id },
        orderBy: { createdAt: "asc" },
        select: { action: true, userId: true, createdAt: true, metadata: true },
    });
    return logs.map((log) => ({
        action: log.action,
        actorUserId: log.userId ?? null,
        createdAt: log.createdAt,
        metadata: log.metadata ?? null,
    }));
}
