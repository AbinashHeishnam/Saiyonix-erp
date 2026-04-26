import { Prisma } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import prisma, { enforceQueryLimits } from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { computeGradeFromPercentage } from "@/config/gradeBoundaries";
import { cacheGet, cacheSet, getCacheVersion } from "@/core/cacheService";
import { isR2Configured, uploadFile as uploadR2File, buildR2FileUrl } from "@/services/storage/r2.service";
import { documentHeaderBuilder } from "@/utils/documentHeader";
import { resolveStudentEnrollmentForPortal } from "@/modules/student/enrollmentUtils";
async function fileExists(target) {
    try {
        await fs.promises.access(target, fs.constants.F_OK);
        return true;
    }
    catch {
        return false;
    }
}
function buildReportCardKey(examId, studentId) {
    return `report-cards/${examId}/${studentId}.pdf`;
}
function getLocalReportCardPath(examId, studentId) {
    return path.join(process.cwd(), "storage", "report-cards", examId, `${studentId}.pdf`);
}
function getLocalReportCardUrl(examId, studentId) {
    return `/storage/report-cards/${examId}/${studentId}.pdf`;
}
function ensureR2Configured() {
    if (!isR2Configured()) {
        throw new ApiError(500, "R2 storage is not configured");
    }
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
async function renderReportCardPdf(params) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 40 });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err) => reject(err));
        (async () => {
            const primaryColor = "#0f172a"; // slate-900
            const secondaryColor = "#334155"; // slate-700
            const accentColor = "#0284c7"; // sky-600
            const lightBgColor = "#f8fafc"; // slate-50
            const borderColor = "#cbd5e1"; // slate-300
            // 1. Draw Page Outer Border
            doc.rect(20, 20, 555, 802).lineWidth(2).stroke(primaryColor);
            doc.rect(24, 24, 547, 794).lineWidth(1).stroke(accentColor);
            // 2. Header
            doc.y = 50;
            await documentHeaderBuilder(doc, {
                schoolName: params.schoolName,
                schoolAddress: params.schoolAddress,
                schoolPhone: params.schoolPhone,
                officialEmail: params.schoolEmail,
                logoUrl: params.schoolLogoUrl ?? null,
            }, {
                layout: "stacked",
                nameFontSize: 24,
                metaFontSize: 10,
                metaColor: secondaryColor,
                logoSize: 42,
                extraLines: params.schoolBoard ? [`Affiliation: ${params.schoolBoard}`] : [],
                gapAfter: 1,
            });
            // Report Card Banner
            doc.moveDown(1.5);
            const bannerY = doc.y;
            doc.rect(40, bannerY, 515, 30).fill(primaryColor);
            doc.font("Helvetica-Bold").fontSize(14).fillColor("#ffffff").text("ACADEMIC PERFORMANCE REPORT", 0, bannerY + 8, { align: "center", characterSpacing: 2 });
            // 3. Student Information Grid
            doc.moveDown(1.5);
            let currentY = doc.y;
            const leftX = 40;
            const rightX = 300;
            const lineHeight = 18;
            doc.font("Helvetica-Bold").fontSize(10).fillColor(secondaryColor).text("Student Name:", leftX, currentY);
            doc.font("Helvetica-Bold").fillColor(primaryColor).text(params.studentName, leftX + 85, currentY);
            doc.font("Helvetica-Bold").fillColor(secondaryColor).text("Class:", rightX, currentY);
            doc.font("Helvetica-Bold").fillColor(primaryColor).text(`${params.className ?? "-"} ${params.sectionName ? `(${params.sectionName})` : ""}`, rightX + 60, currentY);
            currentY += lineHeight;
            doc.font("Helvetica-Bold").fillColor(secondaryColor).text("Reg. Number:", leftX, currentY);
            doc.font("Helvetica").fillColor(primaryColor).text(params.registrationNumber, leftX + 85, currentY);
            doc.font("Helvetica-Bold").fillColor(secondaryColor).text("Exam:", rightX, currentY);
            doc.font("Helvetica").fillColor(primaryColor).text(params.examTitle, rightX + 60, currentY);
            currentY += lineHeight;
            doc.font("Helvetica-Bold").fillColor(secondaryColor).text("Admn Number:", leftX, currentY);
            doc.font("Helvetica").fillColor(primaryColor).text(params.admissionNumber ?? "-", leftX + 85, currentY);
            doc.font("Helvetica-Bold").fillColor(secondaryColor).text("Result Status:", rightX, currentY);
            doc.font("Helvetica-Bold").fillColor(params.resultStatus === "PASS" ? "#16a34a" : "#dc2626").text(params.resultStatus, rightX + 80, currentY);
            // Border around student info
            doc.rect(35, bannerY + 40, 525, currentY - bannerY - 10).lineWidth(1).stroke(borderColor);
            // 4. Structured Results Table
            currentY += 40;
            // Table Header
            doc.rect(40, currentY, 515, 25).fill(lightBgColor).stroke(borderColor);
            const colX = [45, 220, 310, 400, 490]; // Subject, Max, Pass, Obtained, Status
            doc.font("Helvetica-Bold").fontSize(10).fillColor(primaryColor);
            doc.text("SUBJECT", colX[0], currentY + 7);
            doc.text("MAX MARKS", colX[1], currentY + 7);
            doc.text("PASS MARKS", colX[2], currentY + 7);
            doc.text("OBTAINED", colX[3], currentY + 7);
            doc.text("STATUS", colX[4], currentY + 7);
            currentY += 25;
            const tableStartY = currentY;
            // Table Body
            params.subjects.forEach((subject, i) => {
                // Alternating rows
                if (i % 2 === 0) {
                    doc.rect(40, currentY, 515, 25).fill("#ffffff");
                }
                else {
                    doc.rect(40, currentY, 515, 25).fill("#f8fafc");
                }
                doc.font("Helvetica-Bold").fillColor(primaryColor).text((subject.subjectName || "Subject").toUpperCase(), colX[0], currentY + 8);
                doc.font("Helvetica").text(subject.maxMarks.toString(), colX[1], currentY + 8);
                doc.text(subject.passMarks.toString(), colX[2], currentY + 8);
                doc.font("Helvetica-Bold").text(subject.marksObtained.toString(), colX[3], currentY + 8);
                doc.font("Helvetica-Bold").fillColor(subject.status === "PASS" ? "#16a34a" : "#dc2626").text(subject.status, colX[4], currentY + 8);
                // Grid lines
                doc.moveTo(40, currentY).lineTo(555, currentY).stroke(borderColor);
                currentY += 25;
            });
            // Table Bottom Frame
            doc.rect(40, tableStartY - 25, 515, (params.subjects.length * 25) + 25).stroke(borderColor);
            // Vertical Lines
            doc.moveTo(colX[1] - 5, tableStartY - 25).lineTo(colX[1] - 5, currentY).stroke(borderColor);
            doc.moveTo(colX[2] - 5, tableStartY - 25).lineTo(colX[2] - 5, currentY).stroke(borderColor);
            doc.moveTo(colX[3] - 5, tableStartY - 25).lineTo(colX[3] - 5, currentY).stroke(borderColor);
            doc.moveTo(colX[4] - 5, tableStartY - 25).lineTo(colX[4] - 5, currentY).stroke(borderColor);
            // 5. Summary Section
            currentY += 20;
            doc.rect(40, currentY, 515, 45).fill(lightBgColor).stroke(borderColor);
            doc.font("Helvetica-Bold").fontSize(11).fillColor(primaryColor);
            doc.text("TOTAL MARKS:", 60, currentY + 18);
            doc.font("Helvetica").text(params.totalMarks.toString(), 155, currentY + 18);
            doc.font("Helvetica-Bold").text("PERCENTAGE:", 225, currentY + 18);
            doc.font("Helvetica").text(`${params.percentage}%`, 310, currentY + 18);
            doc.font("Helvetica-Bold").text("FINAL GRADE:", 380, currentY + 18);
            doc.font("Helvetica-Bold").fillColor(accentColor).text(params.grade, 465, currentY + 18);
            currentY += 60;
            // Ranks & Remarks
            if (params.classRank !== null || params.sectionRank !== null || params.schoolRank !== null) {
                doc.font("Helvetica-Bold").fontSize(10).fillColor(secondaryColor).text("RANKING:", 40, currentY);
                const ranks = [];
                if (params.classRank !== null)
                    ranks.push(`Class: ${params.classRank}`);
                if (params.sectionRank !== null)
                    ranks.push(`Section: ${params.sectionRank}`);
                if (params.schoolRank !== null)
                    ranks.push(`School: ${params.schoolRank}`);
                doc.font("Helvetica-Bold").fillColor(primaryColor).text(ranks.join("   |   "), 105, currentY);
                currentY += 20;
            }
            if (params.teacherRemarks) {
                doc.font("Helvetica-Bold").fontSize(10).fillColor(secondaryColor).text("REMARKS:", 40, currentY);
                doc.font("Helvetica-Oblique").fillColor(primaryColor).text(`"${params.teacherRemarks}"`, 105, currentY);
            }
            // 6. Signatures Footer
            doc.moveTo(40, 720).lineTo(160, 720).stroke(borderColor);
            doc.font("Helvetica-Bold").fontSize(10).fillColor(secondaryColor).text("Parent Signature", 60, 730);
            doc.moveTo(237, 720).lineTo(357, 720).stroke(borderColor);
            doc.font("Helvetica-Bold").fontSize(10).fillColor(secondaryColor).text("Class Teacher", 262, 730);
            doc.moveTo(435, 720).lineTo(555, 720).stroke(borderColor);
            doc.font("Helvetica-Bold").fontSize(10).fillColor(secondaryColor).text("Principal Signature", 448, 730);
            doc.end();
        })().catch((err) => reject(err));
    });
}
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
export async function getReportCard(schoolId, examId, studentId) {
    const version = await getCacheVersion("report-cards", examId);
    const cacheKey = `report-cards:v${version}:${examId}:${studentId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
        return cached;
    }
    const reportCard = await prisma.reportCard.findFirst({
        where: {
            examId,
            studentId,
            OR: [{ isPublished: true }, { publishedAt: { not: null } }],
            exam: { schoolId },
            student: { schoolId, deletedAt: null },
        },
        select: {
            id: true,
            examId: true,
            studentId: true,
            totalMarks: true,
            percentage: true,
            grade: true,
            teacherRemarks: true,
            principalSignatureUrl: true,
            publishedAt: true,
        },
    });
    if (!reportCard) {
        throw new ApiError(404, "Report card not found");
    }
    const rankSnapshot = await prisma.rankSnapshot.findFirst({
        where: { examId, studentId: reportCard.studentId, exam: { schoolId } },
        select: { classRank: true, sectionRank: true, schoolRank: true },
    });
    const marks = (await prisma.mark.findMany(enforceQueryLimits({
        where: {
            studentId: reportCard.studentId,
            marksObtained: { gte: new Prisma.Decimal(0) },
            examSubject: {
                examId,
                exam: { schoolId },
                classSubject: { class: { schoolId, deletedAt: null } },
            },
        },
        select: {
            marksObtained: true,
            examSubject: {
                select: {
                    id: true,
                    maxMarks: true,
                    passMarks: true,
                    classSubject: {
                        select: {
                            subject: { select: { id: true, name: true } },
                        },
                    },
                },
            },
        },
    })));
    if (process.env.NODE_ENV !== "production") {
        console.log("=== REPORT DEBUG ===");
        console.log("Marks count:", marks.length);
    }
    const subjects = marks.map((mark) => {
        const obtained = mark.marksObtained;
        const status = obtained.lt(mark.examSubject.passMarks) ? "FAIL" : "PASS";
        return {
            subjectId: mark.examSubject.classSubject.subject?.id ?? mark.examSubject.id,
            subjectName: mark.examSubject.classSubject.subject?.name ?? null,
            marksObtained: obtained,
            maxMarks: mark.examSubject.maxMarks,
            passMarks: mark.examSubject.passMarks,
            status,
        };
    });
    subjects.sort((a, b) => a.subjectId.localeCompare(b.subjectId));
    const totalMarksValue = subjects.reduce((sum, subject) => sum.plus(subject.marksObtained), new Prisma.Decimal(0));
    const totalMaxMarks = subjects.reduce((sum, subject) => sum.plus(subject.maxMarks), new Prisma.Decimal(0));
    const percentageValue = totalMaxMarks.equals(0)
        ? 0
        : Number(totalMarksValue.div(totalMaxMarks).mul(100).toDecimalPlaces(2));
    const resultStatus = subjects.length === 0 || subjects.some((subject) => subject.status === "FAIL")
        ? "FAIL"
        : "PASS";
    const response = buildReportCardResponse({
        reportCard,
        totalMarksValue,
        percentageValue,
        subjects,
        resultStatus,
        classRank: rankSnapshot?.classRank ?? null,
        sectionRank: rankSnapshot?.sectionRank ?? null,
        schoolRank: rankSnapshot?.schoolRank ?? null,
    });
    await cacheSet(cacheKey, response, 300);
    return response;
}
function buildReportCardResponse(params) {
    return {
        studentId: params.reportCard.studentId,
        examId: params.reportCard.examId,
        totalMarks: Number(params.totalMarksValue),
        percentage: params.percentageValue,
        grade: computeGradeFromPercentage(params.percentageValue),
        resultStatus: params.resultStatus,
        classRank: params.classRank,
        sectionRank: params.sectionRank,
        schoolRank: params.schoolRank,
        teacherRemarks: params.reportCard.teacherRemarks ?? null,
        principalSignature: params.reportCard.principalSignatureUrl ?? null,
        subjects: params.subjects.map((subject) => ({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName ?? null,
            marksObtained: Number(subject.marksObtained),
            maxMarks: Number(subject.maxMarks),
            passMarks: Number(subject.passMarks),
            status: subject.status,
        })),
    };
}
export async function getReportCardForActor(schoolId, examId, actor) {
    const { roleType } = ensureActor(actor);
    if (roleType === "STUDENT" || roleType === "PARENT") {
        const enrollment = await resolveStudentContextForActor(schoolId, actor);
        if (roleType === "PARENT") {
            const parent = await prisma.parent.findFirst({
                where: { schoolId, userId: actor.userId },
                select: { id: true },
            });
            if (!parent) {
                throw new ApiError(403, "Parent account not linked");
            }
            const links = await prisma.parentStudentLink.findMany(enforceQueryLimits({
                where: { parentId: parent.id, student: { schoolId, deletedAt: null } },
                select: { studentId: true },
            }));
            const allowed = new Set(links.map((link) => link.studentId));
            if (!allowed.has(enrollment.studentId)) {
                throw new ApiError(403, "Forbidden");
            }
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
            throw new ApiError(404, "Report card not found");
        }
        return getReportCard(schoolId, examId, enrollment.studentId);
    }
    if (isAdminRole(roleType)) {
        throw new ApiError(400, "Student id required for admin access");
    }
    throw new ApiError(403, "Forbidden");
}
export async function getReportCardForAdmin(schoolId, examId, studentId, actor) {
    const { roleType } = ensureActor(actor);
    if (!isAdminRole(roleType)) {
        throw new ApiError(403, "Forbidden");
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
        throw new ApiError(404, "Report card not found");
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
        throw new ApiError(404, "Report card not found");
    }
    return getReportCard(schoolId, examId, studentId);
}
export async function getReportCardPdfStatus(schoolId, examId, studentId) {
    const reportCard = await prisma.reportCard.findFirst({
        where: {
            examId,
            studentId,
            OR: [{ isPublished: true }, { publishedAt: { not: null } }],
            exam: { schoolId },
            student: { schoolId, deletedAt: null },
        },
        select: { studentId: true, examId: true, publishedAt: true, generatedPdfUrl: true },
    });
    if (!reportCard) {
        throw new ApiError(404, "Report card not found");
    }
    if (reportCard.generatedPdfUrl) {
        return {
            studentId,
            examId,
            pdfUrl: toSecureFileUrl(reportCard.generatedPdfUrl),
        };
    }
    const localPath = getLocalReportCardPath(examId, studentId);
    const exists = await fileExists(localPath);
    return {
        studentId,
        examId,
        pdfUrl: exists ? toSecureFileUrl(getLocalReportCardUrl(examId, studentId)) : null,
    };
}
export async function generateReportCardPdf(schoolId, examId, studentId, options) {
    const force = Boolean(options?.force);
    const reportCard = await prisma.reportCard.findFirst({
        where: {
            examId,
            studentId,
            OR: [{ isPublished: true }, { publishedAt: { not: null } }],
            exam: { schoolId },
            student: { schoolId, deletedAt: null },
        },
        select: {
            id: true,
            examId: true,
            studentId: true,
            totalMarks: true,
            percentage: true,
            teacherRemarks: true,
            principalSignatureUrl: true,
            generatedPdfUrl: true,
            generatingPdf: true,
            exam: { select: { title: true, schoolId: true, academicYearId: true } },
            student: {
                select: {
                    fullName: true,
                    registrationNumber: true,
                    admissionNumber: true,
                },
            },
        },
    });
    if (!reportCard) {
        throw new ApiError(404, "Report card not found");
    }
    if (reportCard.generatedPdfUrl && !force) {
        return { studentId, examId, pdfUrl: toSecureFileUrl(reportCard.generatedPdfUrl) };
    }
    if (reportCard.generatingPdf) {
        throw new ApiError(409, "Report card PDF generation already in progress");
    }
    if (force && reportCard.generatedPdfUrl) {
        await prisma.reportCard.update({
            where: { id: reportCard.id },
            data: { generatedPdfUrl: null },
        });
    }
    const lockResult = await prisma.reportCard.updateMany({
        where: {
            id: reportCard.id,
            generatingPdf: false,
            ...(force ? {} : { generatedPdfUrl: null }),
        },
        data: { generatingPdf: true },
    });
    if (lockResult.count === 0) {
        const latest = await prisma.reportCard.findFirst({
            where: { id: reportCard.id },
            select: { generatedPdfUrl: true, generatingPdf: true },
        });
        if (latest?.generatedPdfUrl) {
            return { studentId, examId, pdfUrl: toSecureFileUrl(latest.generatedPdfUrl) };
        }
        throw new ApiError(409, "Report card PDF generation already in progress");
    }
    try {
        const localPath = getLocalReportCardPath(examId, studentId);
        const localUrl = getLocalReportCardUrl(examId, studentId);
        const alreadyExists = await fileExists(localPath);
        if (alreadyExists && !force) {
            await prisma.reportCard.update({
                where: { id: reportCard.id },
                data: { generatedPdfUrl: localUrl, generatingPdf: false },
            });
            return { studentId, examId, pdfUrl: toSecureFileUrl(localUrl) };
        }
        const [enrollment, school, rankSnapshot] = await Promise.all([
            prisma.studentEnrollment.findFirst({
                where: {
                    studentId,
                    academicYearId: reportCard.exam.academicYearId,
                    student: { schoolId, deletedAt: null },
                    class: { schoolId, deletedAt: null },
                },
                orderBy: { createdAt: "desc" },
                select: {
                    class: { select: { className: true } },
                    section: { select: { sectionName: true } },
                },
            }),
            prisma.school.findFirst({
                where: { id: schoolId },
                select: { name: true, address: true, phone: true, email: true, board: true, logoUrl: true },
            }),
            prisma.rankSnapshot.findFirst({
                where: { examId, studentId, exam: { schoolId } },
                select: { classRank: true, sectionRank: true, schoolRank: true },
            }),
        ]);
        const marksList = (await prisma.mark.findMany(enforceQueryLimits({
            where: {
                studentId,
                marksObtained: { gt: new Prisma.Decimal(0) },
                examSubject: {
                    examId,
                    exam: { schoolId },
                    classSubject: { class: { schoolId, deletedAt: null } },
                },
            },
            select: {
                marksObtained: true,
                examSubject: {
                    select: {
                        maxMarks: true,
                        passMarks: true,
                        classSubject: { select: { subject: { select: { name: true } } } },
                    },
                },
            },
        })));
        const subjects = marksList.map((item) => ({
            subjectName: item.examSubject.classSubject.subject.name,
            marksObtained: Number(item.marksObtained),
            maxMarks: Number(item.examSubject.maxMarks),
            passMarks: Number(item.examSubject.passMarks),
            status: item.marksObtained.lt(item.examSubject.passMarks) ? "FAIL" : "PASS",
        }));
        const percentageValue = Number(reportCard.percentage ?? 0);
        const grade = computeGradeFromPercentage(percentageValue);
        const resultStatus = subjects.length === 0 || subjects.some((subject) => subject.status === "FAIL")
            ? "FAIL"
            : "PASS";
        const pdfBuffer = await renderReportCardPdf({
            schoolName: school?.name ?? "School",
            schoolAddress: school?.address ?? null,
            schoolPhone: school?.phone ?? null,
            schoolEmail: school?.email ?? null,
            schoolBoard: school?.board ?? null,
            schoolLogoUrl: school?.logoUrl ?? null,
            studentName: reportCard.student.fullName,
            registrationNumber: reportCard.student.registrationNumber,
            admissionNumber: reportCard.student.admissionNumber ?? null,
            className: enrollment?.class?.className ?? null,
            sectionName: enrollment?.section?.sectionName ?? null,
            examTitle: reportCard.exam.title,
            totalMarks: Number(reportCard.totalMarks ?? 0),
            percentage: percentageValue,
            grade,
            resultStatus,
            classRank: rankSnapshot?.classRank ?? null,
            sectionRank: rankSnapshot?.sectionRank ?? null,
            schoolRank: rankSnapshot?.schoolRank ?? null,
            teacherRemarks: reportCard.teacherRemarks ?? null,
            principalSignatureUrl: reportCard.principalSignatureUrl ?? null,
            subjects,
        });
        ensureR2Configured();
        const key = buildReportCardKey(examId, studentId);
        const uploaded = await uploadR2File(pdfBuffer, key, "application/pdf");
        const fileUrl = buildR2FileUrl(uploaded.bucket, uploaded.key);
        await prisma.reportCard.update({
            where: { id: reportCard.id },
            data: { generatedPdfUrl: fileUrl, generatingPdf: false },
        });
        return {
            studentId,
            examId,
            pdfUrl: toSecureFileUrl(fileUrl),
        };
    }
    catch (error) {
        await prisma.reportCard.update({
            where: { id: reportCard.id },
            data: { generatingPdf: false },
        });
        throw error;
    }
}
