import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { assignPendingRollNumbers } from "@/modules/student/service";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getParamString(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return typeof value === "string" ? value : undefined;
}
function toSecureFileUrl(value) {
    if (!value)
        return null;
    if (/^https?:\/\//i.test(value))
        return value;
    if (value.startsWith("/api/v1/files/secure"))
        return value;
    return `/api/v1/files/secure?fileUrl=${encodeURIComponent(value)}`;
}
export async function getAdminTeacherDetails(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const teacherId = getParamString(req.params.id);
        if (!teacherId) {
            throw new ApiError(400, "teacherId is required");
        }
        const teacher = await prisma.teacher.findFirst({
            where: { id: teacherId, schoolId, deletedAt: null },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        mobile: true,
                        isActive: true,
                        role: { select: { roleType: true } },
                    },
                },
                teacherProfile: true,
            },
        });
        if (!teacher) {
            throw new ApiError(404, "Teacher not found");
        }
        const activeAcademicYear = await prisma.academicYear.findFirst({
            where: { schoolId, isActive: true },
            select: { id: true },
        });
        const timetableSlots = activeAcademicYear
            ? await prisma.timetableSlot.findMany({
                where: {
                    teacherId: teacher.id,
                    academicYearId: activeAcademicYear.id,
                    section: { deletedAt: null, class: { schoolId, deletedAt: null } },
                },
                select: {
                    sectionId: true,
                    classSubjectId: true,
                    section: {
                        select: {
                            id: true,
                            sectionName: true,
                            classId: true,
                            class: { select: { className: true, classOrder: true } },
                        },
                    },
                    classSubject: {
                        select: {
                            subject: { select: { id: true, name: true } },
                            class: { select: { id: true, className: true } },
                        },
                    },
                },
            })
            : [];
        const assignedSections = timetableSlots
            .map((slot) => slot.section)
            .filter(Boolean)
            .reduce((acc, section) => {
            if (!section || acc.has(section.id))
                return acc;
            acc.set(section.id, section);
            return acc;
        }, new Map())
            .values();
        const assignedClasses = Array.from(assignedSections)
            .map((section) => ({
            sectionId: section.id,
            sectionName: section.sectionName,
            classId: section.classId,
            className: section.class?.className ?? null,
            classOrder: section.class?.classOrder ?? 0,
        }))
            .sort((a, b) => {
            if (a.classOrder !== b.classOrder)
                return a.classOrder - b.classOrder;
            return a.sectionName.localeCompare(b.sectionName);
        })
            .map(({ classOrder, ...rest }) => rest);
        const subjects = timetableSlots.reduce((acc, slot) => {
            const subject = slot.classSubject?.subject;
            if (!subject)
                return acc;
            const key = `${subject.id}-${slot.sectionId ?? ""}`;
            if (acc.has(key))
                return acc;
            acc.set(key, {
                id: key,
                className: slot.classSubject?.class?.className ?? null,
                sectionName: slot.section?.sectionName ?? null,
                subjectName: subject.name ?? null,
            });
            return acc;
        }, new Map());
        const profile = {
            designation: teacher.designation ?? null,
            qualification: teacher.qualification ?? null,
            totalExperience: teacher.totalExperience ?? null,
            academicExperience: teacher.academicExperience ?? null,
            industryExperience: teacher.industryExperience ?? null,
            researchInterest: teacher.researchInterest ?? null,
            nationalPublications: teacher.nationalPublications ?? null,
            internationalPublications: teacher.internationalPublications ?? null,
            bookChapters: teacher.bookChapters ?? null,
            projects: teacher.projects ?? null,
        };
        return success(res, {
            teacher: {
                id: teacher.id,
                fullName: teacher.fullName,
                employeeId: teacher.employeeId,
                designation: teacher.designation,
                department: teacher.department,
                phone: teacher.phone,
                email: teacher.email,
                address: teacher.address,
                status: teacher.status,
                gender: teacher.gender,
                joiningDate: teacher.joiningDate,
                photoUrl: toSecureFileUrl(teacher.photoUrl),
            },
            user: teacher.user,
            profile,
            teacherProfile: teacher.teacherProfile
                ? {
                    ...teacher.teacherProfile,
                    photoUrl: toSecureFileUrl(teacher.teacherProfile.photoUrl),
                }
                : teacher.teacherProfile ?? null,
            assignedClasses,
            subjects: Array.from(subjects.values()),
        }, "Teacher details fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function uploadAdminTeacherPhoto(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const teacherId = getParamString(req.params.id);
        if (!teacherId) {
            throw new ApiError(400, "teacherId is required");
        }
        const uploadedFile = req.uploadedFile;
        if (!uploadedFile?.fileUrl) {
            throw new ApiError(400, "Photo file is required");
        }
        const teacher = await prisma.teacher.findFirst({
            where: { id: teacherId, schoolId, deletedAt: null },
            select: { id: true },
        });
        if (!teacher) {
            throw new ApiError(404, "Teacher not found");
        }
        await prisma.teacher.update({
            where: { id: teacherId },
            data: { photoUrl: uploadedFile.fileUrl },
        });
        return success(res, { photoUrl: toSecureFileUrl(uploadedFile.fileUrl) }, "Teacher photo updated");
    }
    catch (error) {
        return next(error);
    }
}
export async function getAdminStudentDetails(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const studentId = getParamString(req.params.id);
        if (!studentId) {
            throw new ApiError(400, "studentId is required");
        }
        const student = await prisma.student.findFirst({
            where: { id: studentId, schoolId, deletedAt: null },
            include: {
                profile: true,
                parentLinks: {
                    include: {
                        parent: true,
                    },
                },
            },
        });
        if (!student) {
            throw new ApiError(404, "Student not found");
        }
        const academicYear = await prisma.academicYear.findFirst({
            where: { schoolId, isActive: true },
            select: { id: true },
        });
        const promotionRecord = academicYear
            ? await prisma.promotionRecord.findFirst({
                where: { studentId: student.id, academicYearId: academicYear.id },
                orderBy: { createdAt: "desc" },
                select: {
                    status: true,
                    isFinalClass: true,
                    isManuallyPromoted: true,
                    academicYearId: true,
                },
            })
            : null;
        let enrollment = null;
        if (academicYear) {
            enrollment = await prisma.studentEnrollment.findFirst({
                where: { studentId: student.id, academicYearId: academicYear.id },
                include: {
                    class: { select: { id: true, className: true } },
                    section: {
                        select: {
                            id: true,
                            sectionName: true,
                            classTeacher: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    photoUrl: true,
                                    designation: true,
                                    phone: true,
                                    email: true,
                                },
                            },
                        },
                    },
                },
            });
        }
        return success(res, {
            student: {
                id: student.id,
                fullName: student.fullName,
                registrationNumber: student.registrationNumber,
                admissionNumber: student.admissionNumber,
                status: student.status,
                gender: student.gender,
                dateOfBirth: student.dateOfBirth,
                bloodGroup: student.bloodGroup,
            },
            studentProfile: student.profile
                ? {
                    ...student.profile,
                    profilePhotoUrl: toSecureFileUrl(student.profile.profilePhotoUrl),
                }
                : student.profile,
            parents: student.parentLinks.map((link) => ({
                id: link.parent.id,
                fullName: link.parent.fullName,
                mobile: link.parent.mobile,
                email: link.parent.email,
                relationToStudent: link.parent.relationToStudent,
                isPrimary: link.isPrimary,
            })),
            class: enrollment?.class ?? null,
            section: enrollment?.section ?? null,
            classTeacher: enrollment?.section?.classTeacher
                ? {
                    ...enrollment.section.classTeacher,
                    photoUrl: toSecureFileUrl(enrollment.section.classTeacher.photoUrl),
                }
                : enrollment?.section?.classTeacher ?? null,
            enrollment: enrollment
                ? {
                    rollNumber: enrollment.rollNumber ?? null,
                    isDetained: enrollment.isDetained ?? null,
                    promotionStatus: promotionRecord?.status ?? null,
                    promotionIsFinalClass: promotionRecord?.isFinalClass ?? false,
                    promotionIsManual: promotionRecord?.isManuallyPromoted ?? false,
                    promotionAcademicYearId: promotionRecord?.academicYearId ?? null,
                }
                : null,
        }, "Student details fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function assignSectionRollNumbers(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const sectionId = getParamString(req.params.id);
        if (!sectionId) {
            throw new ApiError(400, "sectionId is required");
        }
        const section = await prisma.section.findFirst({
            where: { id: sectionId, class: { schoolId } },
            select: { id: true },
        });
        if (!section) {
            throw new ApiError(404, "Section not found");
        }
        const academicYear = await prisma.academicYear.findFirst({
            where: { schoolId, isActive: true },
            select: { id: true },
        });
        if (!academicYear) {
            throw new ApiError(400, "Active academic year not found");
        }
        const assignedCount = await assignPendingRollNumbers(prisma, {
            academicYearId: academicYear.id,
            sectionId,
        });
        return success(res, { assignedCount }, "Roll numbers assigned successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function assignClassRollNumbers(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const classId = getParamString(req.params.id);
        if (!classId) {
            throw new ApiError(400, "classId is required");
        }
        const classRecord = await prisma.class.findFirst({
            where: { id: classId, schoolId },
            select: { id: true },
        });
        if (!classRecord) {
            throw new ApiError(404, "Class not found");
        }
        const academicYear = await prisma.academicYear.findFirst({
            where: { schoolId, isActive: true },
            select: { id: true },
        });
        if (!academicYear) {
            throw new ApiError(400, "Active academic year not found");
        }
        const sections = await prisma.section.findMany({
            where: { classId: classRecord.id },
            select: { id: true },
        });
        let assignedCount = 0;
        for (const section of sections) {
            assignedCount += await assignPendingRollNumbers(prisma, {
                academicYearId: academicYear.id,
                sectionId: section.id,
            });
        }
        return success(res, { assignedCount }, "Roll numbers assigned successfully");
    }
    catch (error) {
        return next(error);
    }
}
