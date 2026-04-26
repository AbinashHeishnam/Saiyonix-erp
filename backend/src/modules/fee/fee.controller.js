import { ApiError } from "@/core/errors/apiError";
import prisma from "@/core/db/prisma";
import { success } from "@/utils/apiResponse";
import { createFeeStructure, listFeeStructures, publishFeeStructure, getStudentFeeStatus, payFee, createScholarship, listScholarships, updateScholarship, deleteScholarship, createDiscount, listDiscounts, updateDiscount, deleteDiscount, createFeeDeadline, listFeeDeadlines, listLateFeeRecords as listLateFeeRecordsService, listStudentReceipts, getStudentReceiptDetail, getFeeOverviewSnapshot, } from "@/modules/fee/fee.service";
import { createFeeStructureSchema, listFeeStructuresSchema, payFeeSchema, publishFeeSchema, scholarshipSchema, scholarshipIdParamSchema, discountIdParamSchema, discountSchema, feeDeadlineSchema, feeRecordsQuerySchema, feeOverviewQuerySchema, studentFeeParamsSchema, feeReceiptsQuerySchema, feeReceiptParamsSchema, } from "@/modules/fee/fee.validation";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getActor(req) {
    if (!req.user?.sub || !req.user?.roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    return { userId: req.user.sub, roleType: req.user.roleType };
}
async function resolveStudentId(schoolId, actor, studentIdParam) {
    if (actor.roleType === "STUDENT") {
        const student = await prisma.student.findFirst({
            where: { schoolId, userId: actor.userId, deletedAt: null },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(403, "Student account not linked");
        }
        return student.id;
    }
    if (actor.roleType === "PARENT") {
        if (!studentIdParam) {
            throw new ApiError(400, "studentId is required for parent access");
        }
        const link = await prisma.parentStudentLink.findFirst({
            where: {
                studentId: studentIdParam,
                parent: {
                    is: { userId: actor.userId, schoolId },
                },
                student: { schoolId, deletedAt: null },
            },
            select: { studentId: true },
        });
        if (!link) {
            throw new ApiError(403, "Parent is not linked to this student");
        }
        return link.studentId;
    }
    if (!studentIdParam) {
        throw new ApiError(400, "studentId is required");
    }
    return studentIdParam;
}
export async function createStructure(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = createFeeStructureSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await createFeeStructure({
            schoolId,
            ...parsed.data,
        });
        return success(res, data, "Fee structure saved successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function getAdminFeeOverview(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = feeOverviewQuerySchema.safeParse(req.query ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid query");
        }
        const data = await getFeeOverviewSnapshot(schoolId, parsed.data.academicYearId ?? null);
        return success(res, data, "Fee overview fetched successfully");
    }
    catch (error) {
        next(error);
    }
}
export async function publishStructure(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = publishFeeSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await publishFeeStructure({
            schoolId,
            ...parsed.data,
        });
        return success(res, data, "Fee structure published successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function listStructures(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = listFeeStructuresSchema.safeParse(req.query ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid query");
        }
        const data = await listFeeStructures({
            schoolId,
            academicYearId: parsed.data.academicYearId ?? null,
            classId: parsed.data.classId ?? null,
            category: parsed.data.category ?? null,
            isPublished: parsed.data.isPublished
                ? parsed.data.isPublished === "true"
                : null,
        });
        return success(res, data, "Fee structures fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function createScholarshipRecord(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = scholarshipSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await createScholarship({
            schoolId,
            title: parsed.data.title ?? null,
            discountPercent: parsed.data.discountPercent,
            classId: parsed.data.classId ?? null,
            sectionId: parsed.data.sectionId ?? null,
            admissionNumber: parsed.data.admissionNumber ?? null,
            academicYearId: parsed.data.academicYearId ?? null,
            academicYear: parsed.data.academicYear ?? null,
        });
        return success(res, data, "Scholarship saved successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function listScholarshipRecords(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = typeof req.query?.academicYearId === "string" ? req.query.academicYearId : null;
        const data = await listScholarships({
            schoolId,
            academicYearId,
        });
        return success(res, data, "Scholarships fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateScholarshipRecord(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const params = scholarshipIdParamSchema.safeParse(req.params ?? {});
        if (!params.success) {
            throw new ApiError(400, "Invalid scholarship id");
        }
        const parsed = scholarshipSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await updateScholarship({
            schoolId,
            id: params.data.id,
            title: parsed.data.title ?? null,
            discountPercent: parsed.data.discountPercent,
            classId: parsed.data.classId ?? null,
            sectionId: parsed.data.sectionId ?? null,
            admissionNumber: parsed.data.admissionNumber ?? null,
            academicYearId: parsed.data.academicYearId ?? null,
            academicYear: parsed.data.academicYear ?? null,
        });
        return success(res, data, "Scholarship updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function deleteScholarshipRecord(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const params = scholarshipIdParamSchema.safeParse(req.params ?? {});
        if (!params.success) {
            throw new ApiError(400, "Invalid scholarship id");
        }
        const data = await deleteScholarship({ schoolId, id: params.data.id });
        return success(res, data, "Scholarship deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function createDiscountRecord(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = discountSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await createDiscount({
            schoolId,
            studentId: parsed.data.studentId ?? null,
            classId: parsed.data.classId ?? null,
            sectionId: parsed.data.sectionId ?? null,
            amount: parsed.data.amount,
            isPercent: parsed.data.isPercent ?? false,
            academicYearId: parsed.data.academicYearId ?? null,
            academicYear: parsed.data.academicYear ?? null,
        });
        return success(res, data, "Discount saved successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function listDiscountRecords(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = typeof req.query?.academicYearId === "string" ? req.query.academicYearId : null;
        const data = await listDiscounts({
            schoolId,
            academicYearId,
        });
        return success(res, data, "Discounts fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateDiscountRecord(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const params = discountIdParamSchema.safeParse(req.params ?? {});
        if (!params.success) {
            throw new ApiError(400, "Invalid discount id");
        }
        const parsed = discountSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await updateDiscount({
            schoolId,
            id: params.data.id,
            studentId: parsed.data.studentId ?? null,
            classId: parsed.data.classId ?? null,
            sectionId: parsed.data.sectionId ?? null,
            amount: parsed.data.amount,
            isPercent: parsed.data.isPercent ?? false,
            academicYearId: parsed.data.academicYearId ?? null,
            academicYear: parsed.data.academicYear ?? null,
        });
        return success(res, data, "Discount updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function deleteDiscountRecord(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const params = discountIdParamSchema.safeParse(req.params ?? {});
        if (!params.success) {
            throw new ApiError(400, "Invalid discount id");
        }
        const data = await deleteDiscount({ schoolId, id: params.data.id });
        return success(res, data, "Discount deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function createFeeDeadlineRecord(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = feeDeadlineSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await createFeeDeadline({
            schoolId,
            dueDate: parsed.data.dueDate,
            lateFeePercent: parsed.data.lateFeePercent ?? null,
            classId: parsed.data.classId ?? null,
            academicYearId: parsed.data.academicYearId ?? null,
            academicYear: parsed.data.academicYear ?? null,
        });
        return success(res, data, "Late fee deadline saved successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function listFeeDeadlineRecords(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = typeof req.query?.academicYearId === "string" ? req.query.academicYearId : null;
        const data = await listFeeDeadlines({
            schoolId,
            academicYearId,
        });
        return success(res, data, "Fee deadlines fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function listLateFeeRecords(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = feeRecordsQuerySchema.safeParse(req.query ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid query");
        }
        const data = await listLateFeeRecordsService({
            schoolId,
            academicYearId: parsed.data.academicYearId ?? null,
            classId: parsed.data.classId ?? null,
        });
        return success(res, data, "Fee records fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function pay(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const parsed = payFeeSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const studentId = await resolveStudentId(schoolId, actor, parsed.data.studentId);
        const data = await payFee({
            schoolId,
            studentId,
            amount: parsed.data.amount,
            academicYearId: parsed.data.academicYearId ?? null,
            academicYear: parsed.data.academicYear ?? null,
            classId: parsed.data.classId ?? null,
            payment: parsed.data.payment ?? null,
        });
        return success(res, data, "Payment recorded successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function getStudentFee(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const params = studentFeeParamsSchema.safeParse(req.params ?? {});
        if (!params.success) {
            throw new ApiError(400, "Invalid student id");
        }
        const studentId = await resolveStudentId(schoolId, actor, params.data.id);
        const data = await getStudentFeeStatus({
            schoolId,
            studentId,
        }, prisma);
        console.log("ROLE:", actor.roleType);
        console.log("FEE STATUS:", data.status);
        return success(res, data, "Fee status fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function listReceipts(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const parsed = feeReceiptsQuerySchema.safeParse(req.query ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid query");
        }
        const studentId = await resolveStudentId(schoolId, actor, parsed.data.studentId ?? null);
        const data = await listStudentReceipts({
            schoolId,
            studentId,
        });
        return success(res, data, "Receipts fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function getReceipt(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const params = feeReceiptParamsSchema.safeParse(req.params ?? {});
        if (!params.success) {
            throw new ApiError(400, "Invalid receipt id");
        }
        const parsed = feeReceiptsQuerySchema.safeParse(req.query ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid query");
        }
        const studentId = await resolveStudentId(schoolId, actor, parsed.data.studentId ?? null);
        const data = await getStudentReceiptDetail({
            schoolId,
            studentId,
            paymentId: params.data.paymentId,
        });
        return success(res, data, "Receipt fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
