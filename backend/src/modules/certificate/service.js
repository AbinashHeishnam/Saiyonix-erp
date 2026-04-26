import PDFDocument from "pdfkit";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { uploadFile } from "@/core/storage/storage.service";
import { documentHeaderBuilder } from "@/utils/documentHeader";
import { getActiveAcademicYear } from "@/modules/academicYear/service";
function ensureActor(actor) {
    if (!actor.userId || !actor.roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    return { userId: actor.userId, roleType: actor.roleType };
}
async function resolveStudentForCertificateRequest(schoolId, actor, studentId) {
    const { userId, roleType } = ensureActor(actor);
    if (roleType === "STUDENT") {
        const student = await prisma.student.findFirst({
            where: { schoolId, userId, deletedAt: null },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(403, "Student account not linked");
        }
        return student.id;
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
        return studentId;
    }
    throw new ApiError(403, "Forbidden");
}
function formatDate(value) {
    if (!value)
        return "";
    return value.toISOString().split("T")[0];
}
async function fetchSchoolInfo(schoolId) {
    const school = await prisma.school.findFirst({
        where: { id: schoolId },
        select: { name: true, address: true, phone: true, email: true, logoUrl: true },
    });
    if (!school) {
        throw new ApiError(404, "School not found");
    }
    return school;
}
async function fetchStudentSnapshot(schoolId, studentId) {
    const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
        select: {
            id: true,
            fullName: true,
            admissionNumber: true,
            registrationNumber: true,
            parentLinks: {
                select: { isPrimary: true, parent: { select: { fullName: true } } },
                orderBy: { isPrimary: "desc" },
            },
            enrollments: {
                select: {
                    createdAt: true,
                    academicYear: { select: { isActive: true } },
                    class: { select: { className: true } },
                    section: { select: { sectionName: true } },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }
    const activeEnrollment = student.enrollments.find((enr) => enr.academicYear?.isActive);
    const enrollment = activeEnrollment ?? student.enrollments[0] ?? null;
    const fatherName = student.parentLinks[0]?.parent?.fullName ?? null;
    return {
        student,
        className: enrollment?.class?.className ?? null,
        sectionName: enrollment?.section?.sectionName ?? null,
        fatherName,
    };
}
function buildPdfBuffer(build) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        Promise.resolve(build(doc))
            .then(() => doc.end())
            .catch((err) => reject(err));
    });
}
async function drawHeader(doc, payload, title) {
    await documentHeaderBuilder(doc, {
        schoolName: payload.schoolName,
        schoolAddress: payload.schoolAddress,
        schoolPhone: payload.schoolPhone,
        officialEmail: payload.schoolEmail,
        logoUrl: payload.schoolLogoUrl,
    }, {
        layout: "stacked",
        nameFontSize: 18,
        metaFontSize: 9,
        gapAfter: 0.3,
    });
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#94a3b8");
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(16).text(title, { align: "center" });
    doc.moveDown(0.6);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#94a3b8");
    doc.moveDown(1.2);
}
async function renderCertificate(type, payload) {
    return buildPdfBuffer(async (doc) => {
        if (type === "TC") {
            await drawHeader(doc, payload, "TRANSFER CERTIFICATE");
            doc.font("Helvetica").fontSize(12);
            doc.text("This is to certify that:");
            doc.moveDown();
            doc.text(`Name: ${payload.studentName}`);
            doc.text(`Father Name: ${payload.fatherName ?? "-"}`);
            doc.text(`Class: ${payload.className ?? "-"}   Section: ${payload.sectionName ?? "-"}`);
            doc.text(`Admission No: ${payload.admissionNumber ?? "-"}`);
            doc.moveDown();
            doc.text(`The student studied in this institution till ${payload.dateLabel ?? "________"} .`);
            doc.moveDown();
            doc.text(`Reason for leaving: ${payload.reason ?? "-"}`);
            doc.moveDown();
            doc.text("Conduct: Good");
            doc.moveDown(2);
            doc.text("Date: __________");
            doc.moveDown(2);
            doc.text("Principal Signature", { align: "right" });
            doc.text("School Seal", { align: "right" });
            return;
        }
        if (type === "CHARACTER") {
            await drawHeader(doc, payload, "CHARACTER CERTIFICATE");
            doc.font("Helvetica").fontSize(12);
            doc.text(`This is to certify that ${payload.studentName} has been a student of this school.`);
            doc.moveDown();
            doc.text("His/Her conduct and character were found to be GOOD during the period of study.");
            doc.moveDown();
            doc.text("We wish him/her success in future.");
            doc.moveDown(2);
            doc.text("Date: __________");
            doc.moveDown(2);
            doc.text("Principal Signature", { align: "right" });
            return;
        }
        await drawHeader(doc, payload, "REGISTRATION CERTIFICATE");
        doc.font("Helvetica").fontSize(12);
        doc.text(`This is to certify that ${payload.studentName} is a registered student of this institution.`);
        doc.moveDown();
        doc.text(`Registration Number: ${payload.registrationNumber ?? "-"}`);
        doc.text(`Class: ${payload.className ?? "-"}`);
        doc.moveDown();
        doc.text("Issued for official purpose.");
        doc.moveDown(2);
        doc.text("Date: __________");
        doc.moveDown(2);
        doc.text("Principal Signature", { align: "right" });
    });
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
async function uploadCertificateBuffer(buffer, fileName, studentId) {
    return uploadFile(buffer, {
        userType: "student",
        userId: studentId,
        module: "certificates",
        fileName,
        mimeType: "application/pdf",
    });
}
export async function requestCertificate(schoolId, actor, payload) {
    const studentId = await resolveStudentForCertificateRequest(schoolId, actor, payload.studentId ?? null);
    const activeYear = await getActiveAcademicYear(schoolId);
    const startDate = activeYear.startDate;
    const endExclusive = new Date(activeYear.endDate);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const existing = await prisma.certificateRequest.findFirst({
        where: {
            studentId,
            type: payload.type,
            createdAt: {
                gte: startDate,
                lt: endExclusive,
            },
        },
        select: { id: true },
    });
    if (existing) {
        throw new ApiError(409, "Certificate already requested for this academic year");
    }
    return prisma.certificateRequest.create({
        data: {
            studentId,
            type: payload.type,
            reason: payload.reason ?? null,
        },
    });
}
export async function listCertificateRequestsForActor(schoolId, actor, studentIdFromQuery) {
    const { userId, roleType } = ensureActor(actor);
    const mapRequests = (items) => items.map((item) => ({ ...item, fileUrl: toSecureFileUrl(item.fileUrl ?? null) }));
    if (roleType === "STUDENT") {
        const student = await prisma.student.findFirst({
            where: { schoolId, userId, deletedAt: null },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(403, "Student account not linked");
        }
        const items = await prisma.certificateRequest.findMany({
            where: { studentId: student.id },
            orderBy: { createdAt: "desc" },
        });
        return mapRequests(items);
    }
    if (roleType === "PARENT") {
        const parent = await prisma.parent.findFirst({
            where: { schoolId, userId },
            select: { id: true },
        });
        if (!parent) {
            throw new ApiError(403, "Parent account not linked");
        }
        if (studentIdFromQuery) {
            const link = await prisma.parentStudentLink.findFirst({
                where: {
                    parentId: parent.id,
                    studentId: studentIdFromQuery,
                    student: { schoolId, deletedAt: null },
                },
                select: { studentId: true },
            });
            if (!link) {
                throw new ApiError(403, "Parent is not linked to this student");
            }
            const items = await prisma.certificateRequest.findMany({
                where: { studentId: link.studentId },
                orderBy: { createdAt: "desc" },
            });
            return mapRequests(items);
        }
        const links = await prisma.parentStudentLink.findMany({
            where: { parentId: parent.id, student: { schoolId, deletedAt: null } },
            select: { studentId: true },
        });
        if (!links.length) {
            throw new ApiError(403, "Parent is not linked to any student");
        }
        const items = await prisma.certificateRequest.findMany({
            where: { studentId: { in: links.map((link) => link.studentId) } },
            orderBy: { createdAt: "desc" },
        });
        return mapRequests(items);
    }
    if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN" || roleType === "SUPER_ADMIN") {
        return listAdminCertificateRequests(schoolId);
    }
    throw new ApiError(403, "Forbidden");
}
export async function listAdminCertificateRequests(schoolId) {
    const requests = await prisma.certificateRequest.findMany({
        where: { student: { schoolId, deletedAt: null } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
            student: {
                select: {
                    id: true,
                    fullName: true,
                    admissionNumber: true,
                    registrationNumber: true,
                    enrollments: {
                        select: {
                            createdAt: true,
                            academicYear: { select: { isActive: true } },
                            class: { select: { className: true } },
                            section: { select: { sectionName: true } },
                        },
                        orderBy: { createdAt: "desc" },
                    },
                },
            },
        },
    });
    return requests.map((request) => {
        const activeEnrollment = request.student.enrollments.find((enr) => enr.academicYear?.isActive);
        const enrollment = activeEnrollment ?? request.student.enrollments[0] ?? null;
        return {
            id: request.id,
            type: request.type,
            reason: request.reason,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            fileUrl: toSecureFileUrl(request.fileUrl),
            student: {
                id: request.student.id,
                fullName: request.student.fullName,
                admissionNumber: request.student.admissionNumber,
                registrationNumber: request.student.registrationNumber,
                className: enrollment?.class?.className ?? null,
                sectionName: enrollment?.section?.sectionName ?? null,
            },
        };
    });
}
export async function approveCertificateRequest(schoolId, actor, requestId) {
    const { userId } = ensureActor(actor);
    const request = await prisma.certificateRequest.findFirst({
        where: { id: requestId, student: { schoolId, deletedAt: null } },
        include: { student: true },
    });
    if (!request) {
        throw new ApiError(404, "Request not found");
    }
    const school = await fetchSchoolInfo(schoolId);
    const snapshot = await fetchStudentSnapshot(schoolId, request.studentId);
    const payload = {
        schoolName: school.name,
        schoolAddress: school.address ?? null,
        schoolPhone: school.phone ?? null,
        schoolEmail: school.email ?? null,
        schoolLogoUrl: school.logoUrl ?? null,
        studentName: snapshot.student.fullName,
        fatherName: snapshot.fatherName,
        className: snapshot.className,
        sectionName: snapshot.sectionName,
        admissionNumber: snapshot.student.admissionNumber,
        registrationNumber: snapshot.student.registrationNumber,
        reason: request.reason ?? null,
        dateLabel: formatDate(new Date()),
    };
    const pdfBuffer = await renderCertificate(request.type, payload);
    const fileName = `${request.type}_${snapshot.student.fullName.replace(/\s+/g, "_")}.pdf`;
    const uploaded = await uploadCertificateBuffer(pdfBuffer, fileName, request.studentId);
    const updatedRequest = await prisma.$transaction(async (tx) => {
        const updatedRequest = await tx.certificateRequest.update({
            where: { id: request.id },
            data: {
                status: "APPROVED",
                approvedBy: userId,
                fileUrl: uploaded.fileUrl,
                rejectedReason: null,
            },
        });
        if (request.type === "TC") {
            await tx.student.update({
                where: { id: request.studentId },
                data: { status: "EXPELLED" },
            });
            const existingExit = await tx.studentExit.findFirst({
                where: { studentId: request.studentId, type: "TC" },
                select: { id: true },
            });
            if (!existingExit) {
                await tx.studentExit.create({
                    data: {
                        studentId: request.studentId,
                        reason: request.reason ?? "TC approved",
                        type: "TC",
                    },
                });
            }
        }
        return updatedRequest;
    });
    return { ...updatedRequest, fileUrl: toSecureFileUrl(updatedRequest.fileUrl) };
}
export async function rejectCertificateRequest(schoolId, actor, requestId, rejectedReason) {
    ensureActor(actor);
    const request = await prisma.certificateRequest.findFirst({
        where: { id: requestId, student: { schoolId, deletedAt: null } },
        select: { id: true },
    });
    if (!request) {
        throw new ApiError(404, "Request not found");
    }
    return prisma.certificateRequest.update({
        where: { id: request.id },
        data: {
            status: "REJECTED",
            rejectedReason,
        },
    });
}
export async function generateTcCertificate(schoolId, actor, payload) {
    const { userId } = ensureActor(actor);
    const school = await fetchSchoolInfo(schoolId);
    const snapshot = await fetchStudentSnapshot(schoolId, payload.studentId);
    const pdfBuffer = await renderCertificate("TC", {
        schoolName: school.name,
        schoolAddress: school.address ?? null,
        schoolPhone: school.phone ?? null,
        schoolEmail: school.email ?? null,
        schoolLogoUrl: school.logoUrl ?? null,
        studentName: snapshot.student.fullName,
        fatherName: snapshot.fatherName,
        className: snapshot.className,
        sectionName: snapshot.sectionName,
        admissionNumber: snapshot.student.admissionNumber,
        registrationNumber: snapshot.student.registrationNumber,
        reason: payload.reason,
        dateLabel: formatDate(payload.date ?? new Date()),
    });
    const fileName = `TC_${snapshot.student.fullName.replace(/\s+/g, "_")}.pdf`;
    const uploaded = await uploadCertificateBuffer(pdfBuffer, fileName, payload.studentId);
    await prisma.$transaction(async (tx) => {
        await tx.certificateRequest.create({
            data: {
                studentId: payload.studentId,
                type: "TC",
                reason: payload.reason,
                status: "APPROVED",
                approvedBy: userId,
                fileUrl: uploaded.fileUrl,
            },
        });
        await tx.studentExit.create({
            data: {
                studentId: payload.studentId,
                reason: payload.reason,
                type: payload.expel ? "EXPELLED" : "TC",
            },
        });
        if (payload.expel) {
            const student = await tx.student.findFirst({
                where: { id: payload.studentId, schoolId, deletedAt: null },
                select: { userId: true },
            });
            await tx.student.update({
                where: { id: payload.studentId },
                data: { status: "EXPELLED" },
            });
            if (student?.userId) {
                await tx.user.update({
                    where: { id: student.userId },
                    data: { isActive: false },
                });
            }
        }
    });
    return { fileUrl: toSecureFileUrl(uploaded.fileUrl) };
}
