import { Prisma } from "@prisma/client";
import prisma, { enforceQueryLimits } from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { computeGradeFromPercentage } from "@/config/gradeBoundaries";
import { logAudit } from "@/utils/audit";
import { bumpCacheVersion, cacheGet, cacheSet, getCacheVersion, } from "@/core/cacheService";
import { chunkArray, withConsoleTime, withTiming } from "@/core/utils/perf";
import { getReportCard } from "@/modules/reportCards/service";
import { primeRankingCacheForExam } from "@/modules/ranking/service";
import { resolveStudentEnrollmentForPortal } from "@/modules/student/enrollmentUtils";
function ensureActor(actor) {
    if (!actor.userId || !actor.roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    return { userId: actor.userId, roleType: actor.roleType };
}
function isAdminRole(roleType) {
    return roleType === "SUPER_ADMIN" || roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN";
}
async function resolveStudentContextForActor(schoolId, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (roleType === "STUDENT") {
        const student = await prisma.student.findFirst({
            where: { schoolId, userId, deletedAt: null },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(403, "Student account not linked");
        }
        const enrollment = await resolveStudentEnrollmentForPortal({
            schoolId,
            studentId: student.id,
            allowPreviousYear: true,
        });
        return {
            studentId: student.id,
            classId: enrollment.classId,
            sectionId: enrollment.sectionId,
            academicYearId: enrollment.academicYearId,
        };
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
        const enrollment = await resolveStudentEnrollmentForPortal({
            schoolId,
            studentId: link.studentId,
            allowPreviousYear: true,
        });
        return {
            studentId: link.studentId,
            classId: enrollment.classId,
            sectionId: enrollment.sectionId,
            academicYearId: enrollment.academicYearId,
        };
    }
    throw new ApiError(403, "Forbidden");
}
async function getExamOrThrow(schoolId, examId) {
    const exam = await prisma.exam.findFirst({
        where: { id: examId, schoolId },
        select: { id: true, schoolId: true, isPublished: true, isLocked: true },
    });
    if (!exam) {
        throw new ApiError(404, "Exam not found");
    }
    return exam;
}
export async function computeResultsForExam(schoolId, examId, client = prisma) {
    return withConsoleTime(`results:compute:${examId}`, async () => {
        const exam = await client.exam.findFirst({
            where: { id: examId, schoolId },
            select: { id: true, academicYearId: true },
        });
        if (!exam) {
            throw new ApiError(404, "Exam not found");
        }
        const examSubjects = (await withTiming("results:examSubjects", () => client.examSubject.findMany(enforceQueryLimits({
            where: {
                examId,
                exam: { schoolId },
                classSubject: { class: { schoolId, deletedAt: null } },
            },
            select: {
                id: true,
                maxMarks: true,
                passMarks: true,
                classSubject: { select: { classId: true } },
            },
        }))));
        if (examSubjects.length === 0) {
            return [];
        }
        const examSubjectById = new Map(examSubjects.map((subject) => [subject.id, subject]));
        const examSubjectsByClass = new Map();
        for (const subject of examSubjects) {
            const list = examSubjectsByClass.get(subject.classSubject.classId) ?? [];
            list.push(subject.id);
            examSubjectsByClass.set(subject.classSubject.classId, list);
        }
        const classIds = Array.from(examSubjectsByClass.keys());
        const enrollments = (await withTiming("results:enrollments", () => client.studentEnrollment.findMany(enforceQueryLimits({
            where: {
                classId: { in: classIds },
                academicYearId: exam.academicYearId,
                student: { schoolId, deletedAt: null },
            },
            orderBy: { createdAt: "desc" },
            select: { studentId: true, classId: true, createdAt: true },
        }))));
        const latestEnrollmentByStudent = new Map();
        for (const enrollment of enrollments) {
            if (!latestEnrollmentByStudent.has(enrollment.studentId)) {
                latestEnrollmentByStudent.set(enrollment.studentId, { classId: enrollment.classId });
            }
        }
        const studentIds = Array.from(latestEnrollmentByStudent.keys());
        if (studentIds.length === 0) {
            return [];
        }
        const results = [];
        const sortedStudentIds = studentIds.sort((a, b) => a.localeCompare(b));
        const studentChunks = chunkArray(sortedStudentIds, 1000);
        const examSubjectIds = examSubjects.map((subject) => subject.id);
        for (const chunk of studentChunks) {
            const marks = (await withTiming("results:marksChunk", () => client.mark.findMany(enforceQueryLimits({
                where: {
                    examSubjectId: { in: examSubjectIds },
                    studentId: { in: chunk },
                },
                select: {
                    studentId: true,
                    examSubjectId: true,
                    marksObtained: true,
                },
            }))));
            const marksByStudent = new Map();
            for (const mark of marks) {
                const studentMarks = marksByStudent.get(mark.studentId) ?? new Map();
                studentMarks.set(mark.examSubjectId, mark.marksObtained);
                marksByStudent.set(mark.studentId, studentMarks);
            }
            for (const studentId of chunk) {
                const enrollment = latestEnrollmentByStudent.get(studentId);
                if (!enrollment)
                    continue;
                const subjectIds = examSubjectsByClass.get(enrollment.classId) ?? [];
                if (subjectIds.length === 0)
                    continue;
                let totalMarks = new Prisma.Decimal(0);
                let totalMaxMarks = new Prisma.Decimal(0);
                let isFail = false;
                const studentMarks = marksByStudent.get(studentId) ?? new Map();
                for (const subjectId of subjectIds) {
                    const subject = examSubjectById.get(subjectId);
                    if (!subject)
                        continue;
                    const obtained = studentMarks.get(subjectId) ?? new Prisma.Decimal(0);
                    totalMarks = totalMarks.plus(obtained);
                    totalMaxMarks = totalMaxMarks.plus(subject.maxMarks);
                    if (obtained.lt(subject.passMarks)) {
                        isFail = true;
                    }
                }
                const percentage = totalMaxMarks.equals(0)
                    ? new Prisma.Decimal(0)
                    : totalMarks.div(totalMaxMarks).mul(100).toDecimalPlaces(2);
                results.push({
                    studentId,
                    totalMarks,
                    percentage,
                    status: isFail ? "FAIL" : "PASS",
                });
            }
        }
        return results;
    });
}
export async function upsertResultsForExam(schoolId, examId) {
    return prisma.$transaction(async (tx) => {
        const db = tx;
        const results = await computeResultsForExam(schoolId, examId, db);
        const chunks = chunkArray(results, 500);
        for (const chunk of chunks) {
            const operations = chunk.map((result) => tx.reportCard.upsert({
                where: { examId_studentId: { examId, studentId: result.studentId } },
                update: {
                    totalMarks: result.totalMarks,
                    percentage: result.percentage,
                    grade: computeGradeFromPercentage(Number(result.percentage)),
                },
                create: {
                    examId,
                    studentId: result.studentId,
                    totalMarks: result.totalMarks,
                    percentage: result.percentage,
                    grade: computeGradeFromPercentage(Number(result.percentage)),
                },
            }));
            await Promise.all(operations);
        }
        return { count: results.length };
    });
}
export async function publishResults(schoolId, examId, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    const exam = await getExamOrThrow(schoolId, examId);
    if (!exam.isPublished) {
        throw new ApiError(400, "Exam must be published before publishing results");
    }
    if (!exam.isLocked) {
        const pending = await prisma.examSubject.findFirst({
            where: { examId, marksStatus: { not: "SUBMITTED" } },
            select: { id: true },
        });
        if (pending) {
            throw new ApiError(400, "All subjects must be submitted before publishing results");
        }
        await prisma.exam.update({ where: { id: examId }, data: { isLocked: true } });
    }
    const alreadyPublished = await prisma.reportCard.findFirst({
        where: {
            examId,
            OR: [{ isPublished: true }, { publishedAt: { not: null } }],
        },
        select: { id: true },
    });
    if (alreadyPublished) {
        await logAudit({
            userId,
            action: "RESULT_REPUBLISHED",
            entity: "Exam",
            entityId: examId,
            metadata: { examId },
        });
        return { examId, published: true };
    }
    await upsertResultsForExam(schoolId, examId);
    await prisma.reportCard.updateMany({
        where: { examId },
        data: { publishedAt: new Date(), isPublished: true },
    });
    await bumpCacheVersion("report-cards", examId);
    await bumpCacheVersion("ranking", examId);
    await bumpCacheVersion("results", examId);
    await logAudit({
        userId,
        action: "RESULT_PUBLISHED",
        entity: "Exam",
        entityId: examId,
        metadata: { examId },
    });
    await prewarmExamCaches(schoolId, examId);
    return { examId, published: true };
}
export async function recomputeResults(schoolId, examId, actor) {
    const { roleType, userId } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    const exam = await getExamOrThrow(schoolId, examId);
    if (!exam.isLocked) {
        throw new ApiError(400, "Exam must be locked before computing results");
    }
    const alreadyPublished = await prisma.reportCard.findFirst({
        where: {
            examId,
            OR: [{ isPublished: true }, { publishedAt: { not: null } }],
        },
        select: { id: true },
    });
    if (alreadyPublished) {
        throw new ApiError(400, "Results already published");
    }
    await prisma.reportCard.deleteMany({ where: { examId } });
    const result = await upsertResultsForExam(schoolId, examId);
    await bumpCacheVersion("report-cards", examId);
    await bumpCacheVersion("ranking", examId);
    await bumpCacheVersion("results", examId);
    await logAudit({
        userId,
        action: "RESULT_RECOMPUTED",
        entity: "Exam",
        entityId: examId,
        metadata: { examId, count: result.count },
    });
    return { examId, recalculated: true, count: result.count };
}
export async function getResultsForStudentOrParent(schoolId, examId, actor) {
    const enrollment = await resolveStudentContextForActor(schoolId, actor);
    const version = await getCacheVersion("results", examId);
    const cacheKey = `results:v${version}:${examId}:${enrollment.studentId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
        return cached;
    }
    const exam = await prisma.exam.findFirst({
        where: {
            id: examId,
            schoolId,
            isPublished: true,
            examSubjects: {
                some: {
                    classSubject: {
                        classId: enrollment.classId,
                        class: { schoolId, deletedAt: null },
                    },
                },
            },
        },
        select: { id: true },
    });
    if (!exam) {
        throw new ApiError(404, "Results not found");
    }
    const reportCard = await prisma.reportCard.findFirst({
        where: {
            examId,
            studentId: enrollment.studentId,
            OR: [{ isPublished: true }, { publishedAt: { not: null } }],
        },
        select: {
            id: true,
            examId: true,
            studentId: true,
            totalMarks: true,
            percentage: true,
            grade: true,
            publishedAt: true,
        },
    });
    if (!reportCard) {
        throw new ApiError(404, "Results not found");
    }
    await cacheSet(cacheKey, reportCard, 120);
    return reportCard;
}
export async function getResultsForAdmin(schoolId, examId, studentId) {
    const version = await getCacheVersion("results", examId);
    const cacheKey = `results:v${version}:${examId}:${studentId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
        return cached;
    }
    const exam = await prisma.exam.findFirst({
        where: {
            id: examId,
            schoolId,
            isPublished: true,
        },
        select: { id: true, academicYearId: true },
    });
    if (!exam) {
        throw new ApiError(404, "Results not found");
    }
    const enrollment = await prisma.studentEnrollment.findFirst({
        where: {
            studentId,
            academicYearId: exam.academicYearId,
            student: { schoolId, deletedAt: null },
        },
        select: { classId: true },
    });
    if (!enrollment) {
        throw new ApiError(404, "Student enrollment not found for this exam year");
    }
    const examClass = await prisma.examSubject.findFirst({
        where: {
            examId,
            exam: { schoolId },
            classSubject: { classId: enrollment.classId },
        },
        select: { id: true },
    });
    if (!examClass) {
        throw new ApiError(404, "Results not found");
    }
    const reportCard = await prisma.reportCard.findFirst({
        where: {
            examId,
            studentId,
            OR: [{ isPublished: true }, { publishedAt: { not: null } }],
        },
        select: {
            id: true,
            examId: true,
            studentId: true,
            totalMarks: true,
            percentage: true,
            grade: true,
            publishedAt: true,
        },
    });
    if (!reportCard) {
        throw new ApiError(404, "Results not found");
    }
    await cacheSet(cacheKey, reportCard, 120);
    return reportCard;
}
async function prewarmExamCaches(schoolId, examId) {
    try {
        const reportCards = await prisma.reportCard.findMany({
            where: { examId, OR: [{ isPublished: true }, { publishedAt: { not: null } }] },
            select: { studentId: true },
        });
        const studentIds = reportCards.map((row) => row.studentId);
        if (studentIds.length === 0)
            return;
        const chunks = chunkArray(studentIds, 200);
        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (studentId) => {
                await Promise.all([
                    getResultsForAdmin(schoolId, examId, studentId),
                    getReportCard(schoolId, examId, studentId),
                ]);
            }));
        }
        await primeRankingCacheForExam(schoolId, examId, studentIds);
    }
    catch (err) {
        console.warn("[cache:prewarm] error", err);
    }
}
