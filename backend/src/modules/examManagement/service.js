import { Prisma } from "@prisma/client";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { normalizeDate } from "@/core/utils/date";
import { logAudit } from "@/utils/audit";
import { trigger } from "@/modules/notification/service";
import { collectClassRecipients } from "@/modules/notification/recipientUtils";
function ensureActor(actor) {
    if (!actor.userId || !actor.roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    return { userId: actor.userId, roleType: actor.roleType };
}
function isAdminRole(roleType) {
    return roleType === "SUPER_ADMIN" || roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN";
}
function toTimeDate(time) {
    const normalized = time.length === 5 ? `${time}:00` : time;
    return new Date(`1970-01-01T${normalized}.000Z`);
}
async function ensureAcademicYearBelongsToSchool(client, schoolId, academicYearId) {
    const record = await client.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
        select: { id: true },
    });
    if (!record) {
        throw new ApiError(400, "Academic year not found for this school");
    }
}
async function ensureClassBelongsToSchool(client, schoolId, classId) {
    const record = await client.class.findFirst({
        where: { id: classId, schoolId, deletedAt: null },
        select: { id: true },
    });
    if (!record) {
        throw new ApiError(400, "Class not found for this school");
    }
}
async function ensureSectionBelongsToSchool(client, schoolId, sectionId) {
    const record = await client.section.findFirst({
        where: { id: sectionId, deletedAt: null, class: { schoolId, deletedAt: null } },
        select: { id: true, classId: true },
    });
    if (!record) {
        throw new ApiError(400, "Section not found for this school");
    }
    return record;
}
async function findClassSubject(client, schoolId, classId, subjectId) {
    const mapping = await client.classSubject.findFirst({
        where: {
            classId,
            subjectId,
            class: { schoolId, deletedAt: null },
            subject: { schoolId },
        },
        select: { id: true },
    });
    if (mapping) {
        return mapping;
    }
    const subject = await client.subject.findFirst({
        where: { id: subjectId, schoolId },
        select: { id: true },
    });
    if (!subject) {
        throw new ApiError(400, "Subject not found for this school");
    }
    return client.classSubject.create({
        data: {
            classId,
            subjectId,
            periodsPerWeek: 1,
        },
        select: { id: true },
    });
}
async function ensureExamExists(client, schoolId, examId) {
    const exam = await client.exam.findFirst({
        where: { id: examId, schoolId },
        select: {
            id: true,
            title: true,
            type: true,
            startsOn: true,
            endsOn: true,
            isLocked: true,
            isFinalExam: true,
            academicYearId: true,
        },
    });
    if (!exam) {
        throw new ApiError(404, "Exam not found");
    }
    return exam;
}
async function resolveStudentContext(schoolId, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (roleType === "STUDENT") {
        const student = await prisma.student.findFirst({
            where: { schoolId, userId, deletedAt: null },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(403, "Student account not linked");
        }
        const enrollment = await prisma.studentEnrollment.findFirst({
            where: { studentId: student.id, student: { schoolId, deletedAt: null } },
            orderBy: { createdAt: "desc" },
            select: { classId: true, sectionId: true, rollNumber: true },
        });
        if (!enrollment) {
            throw new ApiError(404, "Student enrollment not found");
        }
        return { studentId: student.id, ...enrollment };
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
            where: { parentId: parent.id, student: { schoolId, deletedAt: null } },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
            select: { studentId: true },
        });
        if (!link) {
            throw new ApiError(403, "Parent is not linked to any student");
        }
        const enrollment = await prisma.studentEnrollment.findFirst({
            where: { studentId: link.studentId, student: { schoolId, deletedAt: null } },
            orderBy: { createdAt: "desc" },
            select: { classId: true, sectionId: true, rollNumber: true },
        });
        if (!enrollment) {
            throw new ApiError(404, "Student enrollment not found");
        }
        return { studentId: link.studentId, ...enrollment };
    }
    throw new ApiError(403, "Forbidden");
}
export async function createExamAdmin(schoolId, payload, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    return prisma.$transaction(async (tx) => {
        const db = tx;
        await ensureAcademicYearBelongsToSchool(db, schoolId, payload.academicYearId);
        const last = await tx.exam.findFirst({
            where: { schoolId, academicYearId: payload.academicYearId },
            orderBy: { termNo: "desc" },
            select: { termNo: true },
        });
        const termNo = (last?.termNo ?? 0) + 1;
        const exam = await tx.exam.create({
            data: {
                schoolId,
                academicYearId: payload.academicYearId,
                termNo,
                title: payload.name,
                type: payload.type,
                startsOn: normalizeDate(payload.startDate),
                endsOn: normalizeDate(payload.endDate),
                isPublished: false,
                isLocked: false,
            },
        });
        await logAudit({
            userId,
            action: "CREATE",
            entity: "Exam",
            entityId: exam.id,
            metadata: { examId: exam.id, type: payload.type },
        });
        return exam;
    });
}
export async function addExamSchedule(schoolId, payload, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    const exam = await ensureExamExists(prisma, schoolId, payload.examId);
    if (!exam.startsOn || !exam.endsOn) {
        throw new ApiError(400, "Exam start and end dates are required");
    }
    await ensureClassBelongsToSchool(prisma, schoolId, payload.classId);
    const classRecord = await prisma.class.findFirst({
        where: { id: payload.classId, schoolId, deletedAt: null },
        select: { id: true, className: true },
    });
    const rangeStart = normalizeDate(exam.startsOn);
    const rangeEnd = normalizeDate(exam.endsOn);
    const dateKey = (date) => normalizeDate(date).toISOString();
    const payloadDates = payload.schedules.map((item) => dateKey(item.examDate));
    if (exam.type !== "PERIODIC") {
        const payloadDateSet = new Set(payloadDates);
        if (payloadDateSet.size !== payloadDates.length) {
            throw new ApiError(400, "Only one exam per day is allowed for this class");
        }
        const shiftSet = new Set(payload.schedules.map((item) => item.shift));
        if (shiftSet.size > 1) {
            throw new ApiError(400, "All schedules for a class must share the same shift");
        }
        const existing = await prisma.examTimetable.findMany({
            where: {
                examSubject: {
                    examId: payload.examId,
                    classSubject: { classId: payload.classId },
                },
                examDate: { in: payload.schedules.map((item) => normalizeDate(item.examDate)) },
            },
            select: { examDate: true, shift: true },
        });
        if (existing.length > 0) {
            throw new ApiError(400, "Only one exam per day is allowed for this class");
        }
        const existingShift = existing.find((item) => item.shift)?.shift;
        const payloadShift = payload.schedules[0]?.shift;
        if (existingShift && payloadShift && existingShift !== payloadShift) {
            throw new ApiError(400, "Class shift must be consistent across the exam");
        }
    }
    const created = await prisma.$transaction(async (tx) => {
        const db = tx;
        const results = [];
        for (const item of payload.schedules) {
            const examDate = normalizeDate(item.examDate);
            if (examDate < rangeStart || examDate > rangeEnd) {
                throw new ApiError(400, "Exam date must be within exam range");
            }
            const mapping = await findClassSubject(db, schoolId, payload.classId, item.subjectId);
            const examSubject = (await tx.examSubject.findFirst({
                where: { examId: payload.examId, classSubjectId: mapping.id },
                select: { id: true },
            })) ??
                (await tx.examSubject.create({
                    data: {
                        examId: payload.examId,
                        classSubjectId: mapping.id,
                        maxMarks: new Prisma.Decimal(100),
                        passMarks: new Prisma.Decimal(33),
                    },
                    select: { id: true },
                }));
            await tx.examTimetable.upsert({
                where: {
                    examSubjectId_examDate: {
                        examSubjectId: examSubject.id,
                        examDate,
                    },
                },
                update: {
                    startTime: toTimeDate(item.startTime),
                    endTime: toTimeDate(item.endTime),
                    shift: item.shift,
                },
                create: {
                    examSubjectId: examSubject.id,
                    examDate,
                    startTime: toTimeDate(item.startTime),
                    endTime: toTimeDate(item.endTime),
                    shift: item.shift,
                },
            });
            results.push({ examSubjectId: examSubject.id, examDate });
        }
        return results;
    });
    await logAudit({
        userId,
        action: "UPDATE",
        entity: "Exam",
        entityId: payload.examId,
        metadata: {
            examId: payload.examId,
            classId: payload.classId,
            schedules: payload.schedules.length,
        },
    });
    try {
        const recipients = await collectClassRecipients({
            schoolId,
            classId: payload.classId,
        });
        if (recipients.length > 0) {
            await trigger("EXAM_SCHEDULE_PUBLISHED", {
                schoolId,
                sentById: userId,
                userIds: recipients,
                classId: payload.classId,
                className: classRecord?.className ?? undefined,
                metadata: {
                    examId: exam.id,
                    examTitle: exam.title,
                    schedules: payload.schedules.length,
                },
            });
        }
    }
    catch (error) {
        if (process.env.NODE_ENV !== "production") {
            console.error("[notify] exam schedule publish failed", error);
        }
    }
    return created;
}
export async function deleteExamSchedule(schoolId, payload, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    await ensureExamExists(prisma, schoolId, payload.examId);
    await ensureClassBelongsToSchool(prisma, schoolId, payload.classId);
    const result = await prisma.examTimetable.deleteMany({
        where: {
            examSubject: {
                examId: payload.examId,
                classSubject: { classId: payload.classId },
            },
        },
    });
    await logAudit({
        userId,
        action: "DELETE",
        entity: "ExamTimetable",
        entityId: payload.examId,
        metadata: { examId: payload.examId, classId: payload.classId, deleted: result.count },
    });
    return { deleted: result.count };
}
export async function addRoomAllocations(schoolId, payload, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    await ensureExamExists(prisma, schoolId, payload.examId);
    for (const allocation of payload.allocations) {
        await ensureClassBelongsToSchool(prisma, schoolId, allocation.classId);
        const section = await ensureSectionBelongsToSchool(prisma, schoolId, allocation.sectionId);
        if (section.classId !== allocation.classId) {
            throw new ApiError(400, "Section does not belong to the selected class");
        }
    }
    await prisma.examRoomAllocation.createMany({
        data: payload.allocations.map((item) => ({
            examId: payload.examId,
            classId: item.classId,
            sectionId: item.sectionId,
            roomNumber: item.roomNumber,
            rollFrom: item.rollFrom,
            rollTo: item.rollTo,
        })),
    });
    try {
        const exam = await prisma.exam.findFirst({
            where: { id: payload.examId, schoolId },
            select: { id: true, title: true },
        });
        const classIds = Array.from(new Set(payload.allocations.map((item) => item.classId)));
        for (const classId of classIds) {
            const recipients = await collectClassRecipients({ schoolId, classId });
            if (recipients.length === 0)
                continue;
            await trigger("EXAM_ROOM_PUBLISHED", {
                schoolId,
                sentById: userId ?? undefined,
                userIds: recipients,
                classId,
                metadata: {
                    examId: payload.examId,
                    examTitle: exam?.title ?? "Exam",
                },
            });
        }
    }
    catch (error) {
        if (process.env.NODE_ENV !== "production") {
            console.error("[notify] exam room allocation publish failed", error);
        }
    }
    await logAudit({
        userId,
        action: "UPDATE",
        entity: "Exam",
        entityId: payload.examId,
        metadata: { examId: payload.examId, allocations: payload.allocations.length },
    });
    return { count: payload.allocations.length };
}
export async function publishExamAdmin(schoolId, examId, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    const exam = await ensureExamExists(prisma, schoolId, examId);
    if (exam.isLocked) {
        throw new ApiError(400, "Exam is locked");
    }
    const updated = await prisma.exam.update({
        where: { id: examId },
        data: { isPublished: true },
    });
    await logAudit({
        userId,
        action: "PUBLISH",
        entity: "Exam",
        entityId: examId,
        metadata: { examId },
    });
    return updated;
}
export async function unlockExamAdmin(schoolId, examId, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    const exam = await ensureExamExists(prisma, schoolId, examId);
    if (!exam.isLocked) {
        return exam;
    }
    const updated = await prisma.exam.update({
        where: { id: examId },
        data: { isLocked: false },
    });
    await logAudit({
        userId,
        action: "UNLOCK",
        entity: "Exam",
        entityId: examId,
        metadata: { examId },
    });
    return updated;
}
export async function setFinalExamAdmin(schoolId, examId, payload, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    const exam = await ensureExamExists(prisma, schoolId, examId);
    if (payload.isFinalExam === exam.isFinalExam) {
        return exam;
    }
    if (payload.isFinalExam) {
        const examSubjects = await prisma.examSubject.findMany({
            where: { examId },
            select: { classSubject: { select: { classId: true } } },
        });
        if (examSubjects.length === 0) {
            throw new ApiError(400, "Final exam must have subjects assigned");
        }
        const classIds = Array.from(new Set(examSubjects.map((subject) => subject.classSubject.classId)));
        const existingFinal = await prisma.examSubject.findFirst({
            where: {
                classSubject: { classId: { in: classIds } },
                exam: {
                    schoolId,
                    academicYearId: exam.academicYearId,
                    isFinalExam: true,
                    id: { not: examId },
                },
            },
            select: { id: true },
        });
        if (existingFinal) {
            throw new ApiError(409, "Final exam already set for one or more classes");
        }
    }
    const updated = await prisma.exam.update({
        where: { id: examId },
        data: { isFinalExam: payload.isFinalExam },
    });
    await logAudit({
        userId,
        action: payload.isFinalExam ? "FINAL_EXAM_SET" : "FINAL_EXAM_UNSET",
        entity: "Exam",
        entityId: examId,
        metadata: { examId, isFinalExam: payload.isFinalExam },
    });
    return updated;
}
export async function deleteExamAdmin(schoolId, examId, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    const exam = await ensureExamExists(prisma, schoolId, examId);
    if (exam.isLocked) {
        throw new ApiError(400, "Exam is locked");
    }
    const [marksCount, reportCardsCount, admitCardsCount, rankSnapshotsCount] = await prisma.$transaction([
        prisma.mark.count({ where: { examSubject: { examId } } }),
        prisma.reportCard.count({ where: { examId } }),
        prisma.admitCard.count({ where: { examId } }),
        prisma.rankSnapshot.count({ where: { examId } }),
    ]);
    if (marksCount > 0 || reportCardsCount > 0 || admitCardsCount > 0 || rankSnapshotsCount > 0) {
        throw new ApiError(400, "Cannot delete exam with results or generated records");
    }
    await prisma.$transaction([
        prisma.examRoomAllocation.deleteMany({ where: { examId } }),
        prisma.examTimetable.deleteMany({ where: { examSubject: { examId } } }),
        prisma.examSubject.deleteMany({ where: { examId } }),
        prisma.exam.delete({ where: { id: examId } }),
    ]);
    await logAudit({
        userId,
        action: "DELETE",
        entity: "Exam",
        entityId: examId,
        metadata: { examId },
    });
    return { id: examId };
}
export async function getExamRoutineForStudent(schoolId, actor) {
    const context = await resolveStudentContext(schoolId, actor);
    const schedules = await prisma.examTimetable.findMany({
        where: {
            examSubject: {
                exam: { schoolId, isPublished: true },
                classSubject: { classId: context.classId },
            },
        },
        orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
        select: {
            examDate: true,
            startTime: true,
            endTime: true,
            shift: true,
            examSubject: {
                select: {
                    exam: { select: { id: true, title: true, type: true } },
                    classSubject: { select: { subject: { select: { name: true } } } },
                },
            },
        },
    });
    const examIds = Array.from(new Set(schedules.map((item) => item.examSubject.exam.id)));
    const allocations = examIds.length === 0
        ? []
        : await prisma.examRoomAllocation.findMany({
            where: {
                examId: { in: examIds },
                sectionId: context.sectionId,
            },
        });
    const allocationMap = new Map();
    for (const allocation of allocations) {
        const list = allocationMap.get(allocation.examId) ?? [];
        list.push(allocation);
        allocationMap.set(allocation.examId, list);
    }
    return schedules.map((item) => {
        const examId = item.examSubject.exam.id;
        const roomCandidates = allocationMap.get(examId) ?? [];
        const rollNo = context.rollNumber ?? -1;
        const room = roomCandidates.find((alloc) => rollNo >= alloc.rollFrom && rollNo <= alloc.rollTo);
        return {
            examId,
            examTitle: item.examSubject.exam.title,
            examType: item.examSubject.exam.type,
            subject: item.examSubject.classSubject.subject.name,
            date: item.examDate,
            startTime: item.startTime,
            endTime: item.endTime,
            shift: item.shift,
            roomNumber: room?.roomNumber ?? null,
        };
    });
}
