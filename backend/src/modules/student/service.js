import { Prisma } from "@prisma/client";
import prisma from "@/core/db/prisma";
import { trigger } from "@/modules/notification/service";
import { ApiError } from "@/core/errors/apiError";
import { canAccessResource } from "@/core/security/accessControl";
import { logSecurity } from "@/core/security/logger";
import { listTimetableForStudent } from "@/modules/timetableSlot/service";
function toPublicUrl(value) {
    if (!value)
        return null;
    if (/^https?:\/\//i.test(value))
        return value;
    if (value.startsWith("/api/v1/files/secure"))
        return value;
    return `/api/v1/files/secure?fileUrl=${encodeURIComponent(value)}`;
}
const ADMIN_ROLES = new Set([
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
]);
function sanitizeParentForRole(parent, roleType) {
    if (!parent)
        return parent;
    if (roleType === "PARENT") {
        return parent;
    }
    return {
        id: parent.id,
        fullName: parent.fullName,
        relationToStudent: parent.relationToStudent ?? null,
    };
}
function shapeStudentForRole(student, roleType) {
    const resolvedRole = roleType ?? "UNKNOWN";
    if (ADMIN_ROLES.has(resolvedRole)) {
        return {
            ...student,
            profile: student.profile
                ? { ...student.profile, profilePhotoUrl: toPublicUrl(student.profile.profilePhotoUrl) }
                : student.profile,
        };
    }
    if (resolvedRole === "TEACHER") {
        return {
            id: student.id,
            schoolId: student.schoolId,
            userId: student.userId ?? null,
            registrationNumber: student.registrationNumber,
            admissionNumber: student.admissionNumber ?? null,
            fullName: student.fullName,
            gender: student.gender,
            status: student.status,
            createdAt: student.createdAt,
            updatedAt: student.updatedAt,
            enrollments: student.enrollments,
            profile: student.profile
                ? { profilePhotoUrl: toPublicUrl(student.profile.profilePhotoUrl) }
                : student.profile,
            parentLinks: student.parentLinks?.map((link) => ({
                id: link.id,
                isPrimary: link.isPrimary,
                parent: sanitizeParentForRole(link.parent ?? null, "TEACHER"),
            })),
        };
    }
    const sanitizedParentLinks = student.parentLinks?.map((link) => ({
        id: link.id,
        isPrimary: link.isPrimary,
        parent: sanitizeParentForRole(link.parent ?? null, resolvedRole),
    }));
    return {
        ...student,
        profile: student.profile
            ? { ...student.profile, profilePhotoUrl: toPublicUrl(student.profile.profilePhotoUrl) }
            : student.profile,
        parentLinks: sanitizedParentLinks,
    };
}
async function generateStudentNumbers(client, schoolId) {
    const year = new Date().getFullYear();
    const last = await client.student.findFirst({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        select: { admissionNumber: true },
    });
    let counter = 0;
    if (last?.admissionNumber) {
        const match = last.admissionNumber.match(/ADM-(\d{4})-(\d{4})/);
        if (match) {
            const lastYear = Number(match[1]);
            const lastCounter = Number(match[2]);
            if (Number.isFinite(lastYear) && Number.isFinite(lastCounter)) {
                counter = lastYear === year ? lastCounter : 0;
            }
        }
    }
    const next = counter + 1;
    const suffix = String(next).padStart(4, "0");
    return {
        admissionNumber: `ADM-${year}-${suffix}`,
        registrationNumber: `REG-${year}-${suffix}`,
    };
}
function mapPrismaError(error) {
    const code = error && typeof error === "object" && "code" in error
        ? String(error.code ?? "")
        : "";
    if (code === "P2002") {
        const target = error.meta?.target ?? [];
        const targetList = Array.isArray(target) ? target : [target];
        if (targetList.includes("registrationNumber")) {
            throw new ApiError(409, "Student with this registration number already exists");
        }
        if (targetList.includes("admissionNumber")) {
            throw new ApiError(409, "Student with this admission number already exists");
        }
        if (targetList.includes("studentId") && targetList.includes("academicYearId")) {
            throw new ApiError(409, "Student is already enrolled for this academic year");
        }
        if (targetList.includes("sectionId") && targetList.includes("rollNumber")) {
            throw new ApiError(409, "Roll number already exists in this section");
        }
        throw new ApiError(409, "Duplicate record");
    }
    if (code === "P2003") {
        throw new ApiError(400, "Invalid relation reference");
    }
    throw error;
}
async function ensureAcademicYearBelongsToSchool(schoolId, academicYearId) {
    const record = await prisma.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
        select: { id: true },
    });
    if (!record) {
        throw new ApiError(400, "Academic year not found for this school");
    }
}
async function ensureClassBelongsToSchool(schoolId, classId) {
    const classRecord = await prisma.class.findFirst({
        where: { id: classId, schoolId, deletedAt: null },
        select: { id: true, academicYearId: true },
    });
    if (!classRecord) {
        throw new ApiError(400, "Class not found for this school");
    }
    return classRecord;
}
async function ensureSectionBelongsToSchool(schoolId, sectionId) {
    const section = await prisma.section.findFirst({
        where: {
            id: sectionId,
            deletedAt: null,
            class: { schoolId, deletedAt: null },
        },
        select: { id: true, classId: true },
    });
    if (!section) {
        throw new ApiError(400, "Section not found for this school");
    }
    return section;
}
async function ensureParentBelongsToSchool(client, schoolId, parentId) {
    const parent = await client.parent.findFirst({
        where: { id: parentId, schoolId },
        select: { id: true },
    });
    if (!parent) {
        throw new ApiError(400, "Parent not found for this school");
    }
    return parent;
}
async function ensureStudentExists(schoolId, id) {
    const student = await prisma.student.findFirst({
        where: { id, schoolId, deletedAt: null },
    });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }
    return student;
}
async function getActiveAcademicYearId(schoolId) {
    const academicYear = await prisma.academicYear.findFirst({
        where: { schoolId, isActive: true },
        select: { id: true },
    });
    if (!academicYear) {
        throw new ApiError(400, "Active academic year not found");
    }
    return academicYear.id;
}
async function resolveStudentIdForParent(schoolId, userId, preferredStudentId) {
    const parent = await prisma.parent.findFirst({
        where: { schoolId, userId },
        select: { id: true },
    });
    if (!parent) {
        throw new ApiError(403, "Parent account not linked");
    }
    if (preferredStudentId) {
        const link = await prisma.parentStudentLink.findFirst({
            where: {
                parentId: parent.id,
                studentId: preferredStudentId,
                student: { schoolId, deletedAt: null, status: "ACTIVE" },
            },
            select: { studentId: true },
        });
        if (!link) {
            throw new ApiError(403, "Forbidden");
        }
        return preferredStudentId;
    }
    const links = await prisma.parentStudentLink.findMany({
        where: { parentId: parent.id, student: { schoolId, deletedAt: null, status: "ACTIVE" } },
        select: { studentId: true, isPrimary: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    if (links.length === 0) {
        throw new ApiError(404, "No linked students found");
    }
    return links[0].studentId;
}
export async function getClassTeacherForUser(schoolId, actor, studentIdFromQuery) {
    if (!actor.userId || !actor.roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    let studentId;
    if (actor.roleType === "STUDENT") {
        const student = await prisma.student.findFirst({
            where: { schoolId, userId: actor.userId, deletedAt: null },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(403, "Student account not linked");
        }
        studentId = student.id;
    }
    else if (actor.roleType === "PARENT") {
        studentId = await resolveStudentIdForParent(schoolId, actor.userId, studentIdFromQuery);
    }
    else {
        throw new ApiError(403, "Forbidden");
    }
    const academicYearId = await getActiveAcademicYearId(schoolId);
    const enrollment = await prisma.studentEnrollment.findFirst({
        where: { studentId, academicYearId },
        select: { sectionId: true },
    });
    if (!enrollment) {
        throw new ApiError(404, "Student enrollment not found");
    }
    const section = await prisma.section.findFirst({
        where: { id: enrollment.sectionId, deletedAt: null },
        include: {
            classTeacher: {
                include: {
                    user: { select: { id: true, email: true, mobile: true } },
                },
            },
        },
    });
    if (!section || !section.classTeacher) {
        throw new ApiError(404, "Class teacher not assigned");
    }
    const teacher = section.classTeacher;
    return {
        teacherId: teacher.id,
        userId: teacher.userId ?? teacher.user?.id ?? null,
        fullName: teacher.fullName,
        email: teacher.email ?? teacher.user?.email ?? null,
        mobile: null,
        photoUrl: toPublicUrl(teacher.photoUrl),
    };
}
async function ensureRollNumberAvailable(params) {
    if (!params.rollNumber) {
        return;
    }
    const existing = await prisma.studentEnrollment.findFirst({
        where: {
            sectionId: params.sectionId,
            rollNumber: params.rollNumber,
            ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
        },
        select: { id: true },
    });
    if (existing) {
        throw new ApiError(409, "Roll number already exists in this section");
    }
}
export async function assignPendingRollNumbers(client, params) {
    const max = await client.studentEnrollment.aggregate({
        where: {
            academicYearId: params.academicYearId,
            sectionId: params.sectionId,
            rollNumber: { not: null },
        },
        _max: { rollNumber: true },
    });
    let nextRoll = max._max.rollNumber ?? 0;
    const pending = await client.studentEnrollment.findMany({
        where: {
            academicYearId: params.academicYearId,
            sectionId: params.sectionId,
            rollNumber: null,
        },
        select: { id: true, student: { select: { fullName: true } }, createdAt: true },
        orderBy: [{ student: { fullName: "asc" } }, { createdAt: "asc" }],
    });
    let assignedCount = 0;
    for (const enrollment of pending) {
        nextRoll += 1;
        await client.studentEnrollment.update({
            where: { id: enrollment.id },
            data: { rollNumber: nextRoll },
        });
        assignedCount += 1;
    }
    return assignedCount;
}
export async function assignRollNumbers(input) {
    await ensureAcademicYearBelongsToSchool(input.schoolId, input.academicYearId);
    if (input.sectionId) {
        await ensureSectionBelongsToSchool(input.schoolId, input.sectionId);
        const count = await assignPendingRollNumbers(prisma, {
            academicYearId: input.academicYearId,
            sectionId: input.sectionId,
        });
        return { assigned: count };
    }
    if (!input.classId) {
        throw new ApiError(400, "sectionId or classId is required");
    }
    await ensureClassBelongsToSchool(input.schoolId, input.classId);
    const sections = await prisma.section.findMany({
        where: { classId: input.classId, deletedAt: null },
        select: { id: true },
    });
    let total = 0;
    for (const section of sections) {
        total += await assignPendingRollNumbers(prisma, {
            academicYearId: input.academicYearId,
            sectionId: section.id,
        });
    }
    return { assigned: total };
}
async function ensureEnrollmentIsValid(schoolId, enrollment) {
    await ensureAcademicYearBelongsToSchool(schoolId, enrollment.academicYearId);
    const classRecord = await ensureClassBelongsToSchool(schoolId, enrollment.classId);
    const section = await ensureSectionBelongsToSchool(schoolId, enrollment.sectionId);
    if (classRecord.academicYearId !== enrollment.academicYearId) {
        throw new ApiError(400, "Class does not belong to the selected academic year");
    }
    if (section.classId !== enrollment.classId) {
        throw new ApiError(400, "Section does not belong to the selected class");
    }
}
async function resolveParentId(client, schoolId, parentId, parent) {
    if (parentId) {
        const existing = await ensureParentBelongsToSchool(client, schoolId, parentId);
        return { parentId: existing.id, isPrimary: parent?.isPrimary };
    }
    if (!parent) {
        return { parentId: null, isPrimary: undefined };
    }
    const existingParent = await client.parent.findFirst({
        where: { schoolId, mobile: parent.mobile },
        select: { id: true },
    });
    if (existingParent) {
        return { parentId: existingParent.id, isPrimary: parent.isPrimary };
    }
    const created = await client.parent.create({
        data: {
            schoolId,
            fullName: parent.fullName,
            mobile: parent.mobile,
            email: parent.email,
            relationToStudent: parent.relationToStudent,
        },
        select: { id: true },
    });
    return { parentId: created.id, isPrimary: parent.isPrimary };
}
async function ensureParentLink(client, params) {
    const existing = await client.parentStudentLink.findFirst({
        where: { parentId: params.parentId, studentId: params.studentId },
        select: { id: true },
    });
    if (existing) {
        if (params.isPrimary !== undefined) {
            await client.parentStudentLink.update({
                where: { id: existing.id },
                data: { isPrimary: params.isPrimary },
            });
        }
        return;
    }
    try {
        await client.parentStudentLink.create({
            data: {
                parentId: params.parentId,
                studentId: params.studentId,
                isPrimary: params.isPrimary ?? false,
            },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
}
async function upsertStudentProfile(client, studentId, profile) {
    const medicalInfo = profile.medicalInfo === undefined
        ? undefined
        : profile.medicalInfo === null
            ? Prisma.DbNull
            : profile.medicalInfo;
    const existing = await client.studentProfile.findFirst({
        where: { studentId },
        select: { id: true },
    });
    if (existing) {
        await client.studentProfile.update({
            where: { id: existing.id },
            data: {
                ...(profile.profilePhotoUrl !== undefined
                    ? { profilePhotoUrl: profile.profilePhotoUrl }
                    : {}),
                ...(profile.address !== undefined ? { address: profile.address } : {}),
                ...(profile.emergencyContactName !== undefined
                    ? { emergencyContactName: profile.emergencyContactName }
                    : {}),
                ...(profile.emergencyContactMobile !== undefined
                    ? { emergencyContactMobile: profile.emergencyContactMobile }
                    : {}),
                ...(profile.previousSchool !== undefined
                    ? { previousSchool: profile.previousSchool }
                    : {}),
                ...(medicalInfo !== undefined ? { medicalInfo } : {}),
            },
        });
        return;
    }
    await client.studentProfile.create({
        data: {
            studentId,
            profilePhotoUrl: profile.profilePhotoUrl,
            address: profile.address,
            emergencyContactName: profile.emergencyContactName,
            emergencyContactMobile: profile.emergencyContactMobile,
            previousSchool: profile.previousSchool,
            medicalInfo,
        },
    });
}
async function getEnrollmentForStudent(client, studentId, academicYearId) {
    return client.studentEnrollment.findFirst({
        where: { studentId, academicYearId },
        select: {
            id: true,
            classId: true,
            sectionId: true,
            academicYearId: true,
            rollNumber: true,
        },
    });
}
async function resolveStudentIdsForTeacher(schoolId, userId) {
    const teacher = await prisma.teacher.findFirst({
        where: { schoolId, userId, deletedAt: null },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(403, "Teacher account not linked");
    }
    const classTeacherSections = await prisma.section.findMany({
        where: {
            classTeacherId: teacher.id,
            deletedAt: null,
            class: { schoolId, deletedAt: null },
        },
        select: { id: true, classId: true },
    });
    const subjectAssignments = await prisma.teacherSubjectClass.findMany({
        where: {
            teacherId: teacher.id,
            classSubject: {
                class: { schoolId, deletedAt: null },
                subject: { schoolId },
            },
        },
        select: {
            sectionId: true,
            classSubject: { select: { classId: true } },
        },
    });
    const sectionIds = new Set();
    classTeacherSections.forEach((section) => sectionIds.add(section.id));
    subjectAssignments
        .filter((assignment) => assignment.sectionId)
        .forEach((assignment) => {
        if (assignment.sectionId) {
            sectionIds.add(assignment.sectionId);
        }
    });
    const classIds = new Set();
    subjectAssignments
        .filter((assignment) => !assignment.sectionId)
        .forEach((assignment) => classIds.add(assignment.classSubject.classId));
    if (classIds.size > 0) {
        const extraSections = await prisma.section.findMany({
            where: {
                classId: { in: Array.from(classIds) },
                deletedAt: null,
                class: { schoolId, deletedAt: null },
            },
            select: { id: true },
        });
        extraSections.forEach((section) => sectionIds.add(section.id));
    }
    if (sectionIds.size === 0) {
        return [];
    }
    const enrollments = await prisma.studentEnrollment.findMany({
        where: {
            sectionId: { in: Array.from(sectionIds) },
            student: { schoolId, deletedAt: null },
        },
        select: { studentId: true },
    });
    return Array.from(new Set(enrollments.map((item) => item.studentId)));
}
async function resolveStudentScope(schoolId, actor) {
    if (!actor?.roleType) {
        return {};
    }
    if (actor.roleType === "STUDENT") {
        if (!actor.userId) {
            throw new ApiError(401, "Unauthorized");
        }
        const student = await prisma.student.findFirst({
            where: { schoolId, userId: actor.userId, deletedAt: null },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(403, "Student account not linked");
        }
        return { studentIds: [student.id] };
    }
    if (actor.roleType === "PARENT") {
        if (!actor.userId) {
            throw new ApiError(401, "Unauthorized");
        }
        const parent = await prisma.parent.findFirst({
            where: { schoolId, userId: actor.userId },
            select: { id: true },
        });
        if (!parent) {
            throw new ApiError(403, "Parent account not linked");
        }
        const links = await prisma.parentStudentLink.findMany({
            where: {
                parentId: parent.id,
                student: { schoolId, deletedAt: null, status: "ACTIVE" },
            },
            select: { studentId: true },
        });
        return { studentIds: links.map((link) => link.studentId) };
    }
    if (actor.roleType === "TEACHER") {
        if (!actor.userId) {
            throw new ApiError(401, "Unauthorized");
        }
        const studentIds = await resolveStudentIdsForTeacher(schoolId, actor.userId);
        return { studentIds };
    }
    return {};
}
export async function createStudent(schoolId, payload) {
    await ensureEnrollmentIsValid(schoolId, payload.enrollment);
    await ensureRollNumberAvailable({
        sectionId: payload.enrollment.sectionId,
        rollNumber: payload.enrollment.rollNumber,
    });
    try {
        const studentId = await prisma.$transaction(async (tx) => {
            const db = tx;
            const parentInfo = await resolveParentId(db, schoolId, payload.parentId, payload.parent);
            if (!parentInfo.parentId) {
                throw new ApiError(400, "Parent information is required");
            }
            const generated = await generateStudentNumbers(db, schoolId);
            const admissionNumber = payload.admissionNumber ?? generated.admissionNumber;
            const registrationNumber = payload.registrationNumber ?? generated.registrationNumber;
            const student = await tx.student.create({
                data: {
                    schoolId,
                    registrationNumber,
                    admissionNumber,
                    fullName: payload.fullName,
                    dateOfBirth: payload.dateOfBirth,
                    gender: payload.gender,
                    bloodGroup: payload.bloodGroup,
                    status: payload.status,
                },
                select: { id: true },
            });
            if (payload.profile) {
                await upsertStudentProfile(db, student.id, payload.profile);
            }
            await ensureParentLink(db, {
                parentId: parentInfo.parentId,
                studentId: student.id,
                isPrimary: parentInfo.isPrimary,
            });
            const enrollment = await tx.studentEnrollment.create({
                data: {
                    studentId: student.id,
                    academicYearId: payload.enrollment.academicYearId,
                    classId: payload.enrollment.classId,
                    sectionId: payload.enrollment.sectionId,
                    rollNumber: payload.enrollment.rollNumber,
                    isDetained: payload.enrollment.isDetained ?? false,
                    promotionStatus: payload.enrollment.promotionStatus,
                },
            });
            return student.id;
        });
        try {
            await notifyStudentClassAssignment(schoolId, studentId, payload.enrollment.classId, payload.enrollment.sectionId);
        }
        catch (error) {
            if (process.env.NODE_ENV !== "production") {
                console.error("[notify] student class assignment failed", error);
            }
        }
        return getStudentById(schoolId, studentId);
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function listStudents(schoolId, pagination, actor, filters) {
    const scope = await resolveStudentScope(schoolId, actor);
    if (scope.studentIds && scope.studentIds.length === 0) {
        return { items: [], total: 0 };
    }
    const academicYearId = filters?.academicYearId ?? (await getActiveAcademicYearId(schoolId));
    const enrollmentFilter = {};
    if (filters?.classId) {
        enrollmentFilter.classId = filters.classId;
    }
    if (filters?.sectionId) {
        enrollmentFilter.sectionId = filters.sectionId;
    }
    const where = {
        schoolId,
        deletedAt: null,
        ...(scope.studentIds ? { id: { in: scope.studentIds } } : {}),
        ...(Object.keys(enrollmentFilter).length > 0
            ? { enrollments: { some: { ...enrollmentFilter, academicYearId } } }
            : { enrollments: { some: { academicYearId } } }),
    };
    const [items, total] = await prisma.$transaction([
        prisma.student.findMany({
            where,
            include: {
                profile: true,
                parentLinks: { include: { parent: true } },
                enrollments: {
                    include: { academicYear: true, class: true, section: true },
                    orderBy: { createdAt: "desc" },
                },
            },
            orderBy: { fullName: "asc" },
            ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.student.count({ where }),
    ]);
    const normalized = items.map((item) => shapeStudentForRole(item, actor?.roleType));
    return { items: normalized, total };
}
export async function getStudentById(schoolId, id, actor) {
    if (actor?.roleType) {
        const scope = await resolveStudentScope(schoolId, actor);
        if (scope.studentIds && !scope.studentIds.includes(id)) {
            throw new ApiError(403, "Forbidden: cannot access this student");
        }
    }
    const activeAcademicYear = await prisma.academicYear.findFirst({
        where: { schoolId, isActive: true },
        select: { id: true },
    });
    if (activeAcademicYear) {
        const activeEnrollment = await prisma.studentEnrollment.findFirst({
            where: { studentId: id, academicYearId: activeAcademicYear.id },
            select: { sectionId: true, rollNumber: true },
        });
    }
    const student = await prisma.student.findFirst({
        where: { id, schoolId, deletedAt: null },
        include: {
            profile: true,
            parentLinks: { include: { parent: true } },
            enrollments: {
                include: { academicYear: true, class: true, section: true },
                orderBy: { createdAt: "desc" },
            },
        },
    });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }
    try {
        if (actor?.roleType === "STUDENT") {
            const allowed = canAccessResource({
                userId: actor.userId,
                userRole: actor.roleType,
                resourceOwnerId: student.userId,
                allowedRoles: ["SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN"],
            });
            if (!allowed) {
                logSecurity("unauthorized_student_access", {
                    userId: actor.userId,
                    resourceId: student.id,
                });
                throw new ApiError(403, "Forbidden");
            }
        }
    }
    catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        console.error("[Phase2] Access control error:", err);
    }
    return shapeStudentForRole(student, actor?.roleType);
}
export async function updateStudent(schoolId, id, payload) {
    const student = await ensureStudentExists(schoolId, id);
    const previousEnrollment = payload.enrollment?.academicYearId
        ? await prisma.studentEnrollment.findFirst({
            where: {
                studentId: id,
                academicYearId: payload.enrollment.academicYearId,
            },
            select: { classId: true, sectionId: true },
        })
        : null;
    if (payload.enrollment && !payload.enrollment.academicYearId) {
        throw new ApiError(400, "academicYearId is required to update enrollment");
    }
    try {
        await prisma.$transaction(async (tx) => {
            const db = tx;
            if (payload.profile) {
                await upsertStudentProfile(db, id, payload.profile);
            }
            if (payload.parentId || payload.parent) {
                const parentInfo = await resolveParentId(db, schoolId, payload.parentId, payload.parent);
                if (!parentInfo.parentId) {
                    throw new ApiError(400, "Parent information is required");
                }
                await ensureParentLink(db, {
                    parentId: parentInfo.parentId,
                    studentId: id,
                    isPrimary: parentInfo.isPrimary,
                });
            }
            if (payload.enrollment) {
                const academicYearId = payload.enrollment.academicYearId;
                if (!academicYearId) {
                    throw new ApiError(400, "academicYearId is required to update enrollment");
                }
                const existing = await getEnrollmentForStudent(db, id, academicYearId);
                const classId = payload.enrollment.classId ?? existing?.classId;
                const sectionId = payload.enrollment.sectionId ?? existing?.sectionId;
                if (!classId || !sectionId) {
                    throw new ApiError(400, "classId and sectionId are required for enrollment update");
                }
                const enrollmentPayload = {
                    academicYearId,
                    classId,
                    sectionId,
                    rollNumber: payload.enrollment.rollNumber ?? existing?.rollNumber ?? undefined,
                    isDetained: payload.enrollment.isDetained,
                    promotionStatus: payload.enrollment.promotionStatus,
                };
                await ensureEnrollmentIsValid(schoolId, enrollmentPayload);
                await ensureRollNumberAvailable({
                    sectionId: enrollmentPayload.sectionId,
                    rollNumber: enrollmentPayload.rollNumber,
                    excludeId: existing?.id,
                });
                let updatedEnrollmentId = null;
                if (existing) {
                    const updatedEnrollment = await tx.studentEnrollment.update({
                        where: { id: existing.id },
                        data: {
                            classId: enrollmentPayload.classId,
                            sectionId: enrollmentPayload.sectionId,
                            rollNumber: enrollmentPayload.rollNumber,
                            ...(payload.enrollment.isDetained !== undefined
                                ? { isDetained: payload.enrollment.isDetained }
                                : {}),
                            ...(payload.enrollment.promotionStatus !== undefined
                                ? { promotionStatus: payload.enrollment.promotionStatus }
                                : {}),
                        },
                        select: { id: true, academicYearId: true, sectionId: true, rollNumber: true },
                    });
                    updatedEnrollmentId = updatedEnrollment.id;
                }
                else {
                    const createdEnrollment = await tx.studentEnrollment.create({
                        data: {
                            studentId: id,
                            academicYearId: enrollmentPayload.academicYearId,
                            classId: enrollmentPayload.classId,
                            sectionId: enrollmentPayload.sectionId,
                            rollNumber: enrollmentPayload.rollNumber,
                            isDetained: payload.enrollment.isDetained ?? false,
                            promotionStatus: payload.enrollment.promotionStatus,
                        },
                        select: { id: true, academicYearId: true, sectionId: true, rollNumber: true },
                    });
                    updatedEnrollmentId = createdEnrollment.id;
                }
            }
            await tx.student.update({
                where: { id },
                data: {
                    ...(payload.registrationNumber !== undefined
                        ? { registrationNumber: payload.registrationNumber }
                        : {}),
                    ...(payload.admissionNumber !== undefined
                        ? { admissionNumber: payload.admissionNumber }
                        : {}),
                    ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
                    ...(payload.dateOfBirth !== undefined
                        ? { dateOfBirth: payload.dateOfBirth }
                        : {}),
                    ...(payload.gender !== undefined ? { gender: payload.gender } : {}),
                    ...(payload.bloodGroup !== undefined ? { bloodGroup: payload.bloodGroup } : {}),
                    ...(payload.status !== undefined ? { status: payload.status } : {}),
                },
            });
            if (payload.status !== undefined && student.userId) {
                await tx.user.update({
                    where: { id: student.userId },
                    data: { isActive: payload.status === "ACTIVE" },
                });
            }
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
    if (payload.enrollment?.classId && payload.enrollment?.sectionId) {
        const changed = !previousEnrollment ||
            previousEnrollment.classId !== payload.enrollment.classId ||
            previousEnrollment.sectionId !== payload.enrollment.sectionId;
        if (changed) {
            try {
                await notifyStudentClassAssignment(schoolId, id, payload.enrollment.classId, payload.enrollment.sectionId);
            }
            catch (error) {
                if (process.env.NODE_ENV !== "production") {
                    console.error("[notify] student class assignment failed", error);
                }
            }
        }
    }
    return getStudentById(schoolId, id);
}
async function notifyStudentClassAssignment(schoolId, studentId, classId, sectionId) {
    const [classRecord, sectionRecord] = await Promise.all([
        prisma.class.findFirst({
            where: { id: classId, schoolId, deletedAt: null },
            select: { id: true, className: true },
        }),
        prisma.section.findFirst({
            where: { id: sectionId, classId, deletedAt: null },
            select: { id: true, sectionName: true },
        }),
    ]);
    await trigger("CLASS_ASSIGNED", {
        schoolId,
        studentId,
        classId,
        className: classRecord?.className,
        sectionId,
        sectionName: sectionRecord?.sectionName,
    });
}
export async function deleteStudent(schoolId, id) {
    const student = await ensureStudentExists(schoolId, id);
    return prisma.$transaction(async (tx) => {
        const updated = await tx.student.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        if (student.userId) {
            await tx.user.update({
                where: { id: student.userId },
                data: { isActive: false },
            });
        }
        return updated;
    });
}
export async function getStudentTimetable(schoolId, studentId) {
    return listTimetableForStudent(schoolId, studentId);
}
function getIdCardLocks(info) {
    if (!info || typeof info !== "object") {
        return { nameLocked: false, photoLocked: false };
    }
    const record = info;
    return {
        nameLocked: Boolean(record.idCard?.nameLocked),
        photoLocked: Boolean(record.idCard?.photoLocked),
    };
}
function applyIdCardLocks(info, updates) {
    const base = info && typeof info === "object" ? { ...info } : {};
    const existing = base.idCard && typeof base.idCard === "object" ? { ...base.idCard } : {};
    base.idCard = {
        ...existing,
        ...(updates.nameLocked !== undefined ? { nameLocked: updates.nameLocked } : {}),
        ...(updates.photoLocked !== undefined ? { photoLocked: updates.photoLocked } : {}),
    };
    return base;
}
function mapStudentToIdCard(school, student) {
    const enrollment = student.enrollments[0];
    const parentLink = student.parentLinks.find((link) => link.isPrimary) ?? student.parentLinks[0];
    const locks = getIdCardLocks(student.profile?.medicalInfo);
    return {
        school,
        student: {
            id: student.id,
            fullName: student.fullName,
            admissionNumber: student.admissionNumber ?? null,
            dateOfBirth: student.dateOfBirth,
            bloodGroup: student.bloodGroup ?? null,
            photoUrl: toPublicUrl(student.profile?.profilePhotoUrl ?? null),
            address: student.profile?.address ?? null,
        },
        className: enrollment?.class?.className ?? null,
        sectionName: enrollment?.section?.sectionName ?? null,
        classId: enrollment?.classId ?? null,
        sectionId: enrollment?.sectionId ?? null,
        rollNumber: enrollment?.rollNumber ?? null,
        parentName: parentLink?.parent?.fullName ?? null,
        parentPhone: parentLink?.parent?.mobile ?? null,
        idCardLocks: locks,
    };
}
export async function listStudentIdCardsForAdmin(schoolId, academicYearId) {
    const resolvedAcademicYearId = academicYearId ?? (await getActiveAcademicYearId(schoolId));
    const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, logoUrl: true, address: true, phone: true },
    });
    if (!school) {
        throw new ApiError(404, "School not found");
    }
    const students = await prisma.student.findMany({
        where: { schoolId, deletedAt: null },
        select: {
            id: true,
            fullName: true,
            admissionNumber: true,
            dateOfBirth: true,
            bloodGroup: true,
            profile: { select: { profilePhotoUrl: true, address: true, medicalInfo: true } },
            enrollments: {
                where: { academicYearId: resolvedAcademicYearId },
                take: 1,
                orderBy: { createdAt: "desc" },
                select: {
                    classId: true,
                    sectionId: true,
                    rollNumber: true,
                    class: { select: { className: true } },
                    section: { select: { sectionName: true } },
                },
            },
            parentLinks: {
                orderBy: { isPrimary: "desc" },
                select: {
                    isPrimary: true,
                    parent: { select: { fullName: true, mobile: true } },
                },
            },
        },
        orderBy: { fullName: "asc" },
    });
    return students.map((student) => mapStudentToIdCard(school, student));
}
export async function getStudentIdCardByStudentId(schoolId, studentId) {
    const academicYearId = await getActiveAcademicYearId(schoolId);
    const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, logoUrl: true, address: true, phone: true },
    });
    if (!school) {
        throw new ApiError(404, "School not found");
    }
    const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
        select: {
            id: true,
            fullName: true,
            admissionNumber: true,
            dateOfBirth: true,
            bloodGroup: true,
            profile: { select: { profilePhotoUrl: true, address: true, medicalInfo: true } },
            enrollments: {
                where: { academicYearId },
                take: 1,
                orderBy: { createdAt: "desc" },
                select: {
                    classId: true,
                    sectionId: true,
                    rollNumber: true,
                    class: { select: { className: true } },
                    section: { select: { sectionName: true } },
                },
            },
            parentLinks: {
                orderBy: { isPrimary: "desc" },
                select: {
                    isPrimary: true,
                    parent: { select: { fullName: true, mobile: true } },
                },
            },
        },
    });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }
    return mapStudentToIdCard(school, student);
}
export async function getStudentIdCardForStudentUser(schoolId, userId) {
    const student = await prisma.student.findFirst({
        where: { schoolId, userId, deletedAt: null },
        select: { id: true },
    });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }
    return getStudentIdCardByStudentId(schoolId, student.id);
}
export async function getStudentIdCardForParentUser(schoolId, userId) {
    const parent = await prisma.parent.findFirst({
        where: { schoolId, userId },
        select: { id: true },
    });
    if (!parent) {
        throw new ApiError(404, "Parent not linked");
    }
    const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: parent.id, student: { schoolId, deletedAt: null } },
        orderBy: { isPrimary: "desc" },
        select: { studentId: true },
    });
    if (!link) {
        throw new ApiError(404, "No linked student found");
    }
    return getStudentIdCardByStudentId(schoolId, link.studentId);
}
export async function updateStudentIdCardName(schoolId, studentId, fullName, options = {}) {
    const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
        select: { id: true, profile: { select: { medicalInfo: true } } },
    });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }
    const locks = getIdCardLocks(student.profile?.medicalInfo);
    if (!options.bypassLock && locks.nameLocked) {
        throw new ApiError(403, "Name changes are locked. Contact admin to reset.");
    }
    await prisma.student.update({
        where: { id: studentId },
        data: { fullName },
    });
    if (options.lockAfter) {
        const nextInfo = applyIdCardLocks(student.profile?.medicalInfo, { nameLocked: true });
        await prisma.studentProfile.upsert({
            where: { studentId },
            create: { studentId, medicalInfo: nextInfo },
            update: { medicalInfo: nextInfo },
        });
    }
    return getStudentIdCardByStudentId(schoolId, studentId);
}
export async function updateStudentIdCardPhoto(schoolId, studentId, photoUrl, options = {}) {
    const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
        select: { id: true, profile: { select: { medicalInfo: true } } },
    });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }
    const locks = getIdCardLocks(student.profile?.medicalInfo);
    if (!options.bypassLock && locks.photoLocked) {
        throw new ApiError(403, "Photo changes are locked. Contact admin to reset.");
    }
    const nextInfo = options.lockAfter
        ? applyIdCardLocks(student.profile?.medicalInfo, { photoLocked: true })
        : student.profile?.medicalInfo ?? null;
    await prisma.studentProfile.upsert({
        where: { studentId },
        create: { studentId, profilePhotoUrl: photoUrl, medicalInfo: nextInfo ?? undefined },
        update: {
            profilePhotoUrl: photoUrl,
            ...(options.lockAfter ? { medicalInfo: nextInfo ?? undefined } : {}),
        },
    });
    return getStudentIdCardByStudentId(schoolId, studentId);
}
export async function updateStudentIdCardDetailsAdmin(schoolId, studentId, payload) {
    const academicYearId = await getActiveAcademicYearId(schoolId);
    const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
        select: { id: true },
    });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }
    await prisma.$transaction(async (tx) => {
        if (payload.fullName || payload.admissionNumber || payload.dateOfBirth || payload.bloodGroup) {
            await tx.student.update({
                where: { id: studentId },
                data: {
                    ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
                    ...(payload.admissionNumber !== undefined ? { admissionNumber: payload.admissionNumber } : {}),
                    ...(payload.dateOfBirth !== undefined ? { dateOfBirth: payload.dateOfBirth } : {}),
                    ...(payload.bloodGroup !== undefined ? { bloodGroup: payload.bloodGroup } : {}),
                },
            });
        }
        if (payload.address !== undefined) {
            await tx.studentProfile.upsert({
                where: { studentId },
                create: { studentId, address: payload.address },
                update: { address: payload.address },
            });
        }
        if (payload.parentName !== undefined || payload.parentPhone !== undefined) {
            const link = await tx.parentStudentLink.findFirst({
                where: { studentId },
                orderBy: { isPrimary: "desc" },
                select: { parentId: true },
            });
            if (!link) {
                throw new ApiError(400, "Parent not linked");
            }
            await tx.parent.update({
                where: { id: link.parentId },
                data: {
                    ...(payload.parentName !== undefined ? { fullName: payload.parentName } : {}),
                    ...(payload.parentPhone !== undefined ? { mobile: payload.parentPhone } : {}),
                },
            });
        }
        if (payload.classId || payload.sectionId || payload.rollNumber !== undefined) {
            const existing = await tx.studentEnrollment.findFirst({
                where: { studentId, academicYearId },
                orderBy: { createdAt: "desc" },
            });
            const classId = payload.classId ?? existing?.classId;
            const sectionId = payload.sectionId ?? existing?.sectionId;
            if (!classId || !sectionId) {
                throw new ApiError(400, "classId and sectionId are required");
            }
            await ensureEnrollmentIsValid(schoolId, {
                academicYearId,
                classId,
                sectionId,
                rollNumber: payload.rollNumber ?? existing?.rollNumber ?? undefined,
            });
            await ensureRollNumberAvailable({
                sectionId,
                rollNumber: payload.rollNumber ?? existing?.rollNumber ?? undefined,
                excludeId: existing?.id,
            });
            if (existing) {
                await tx.studentEnrollment.update({
                    where: { id: existing.id },
                    data: {
                        classId,
                        sectionId,
                        ...(payload.rollNumber !== undefined ? { rollNumber: payload.rollNumber } : {}),
                    },
                });
            }
            else {
                await tx.studentEnrollment.create({
                    data: {
                        studentId,
                        academicYearId,
                        classId,
                        sectionId,
                        rollNumber: payload.rollNumber,
                    },
                });
            }
        }
    });
    return getStudentIdCardByStudentId(schoolId, studentId);
}
