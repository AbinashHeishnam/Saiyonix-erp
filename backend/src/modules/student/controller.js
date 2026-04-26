import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import { createStudent, deleteStudent, getStudentById, getClassTeacherForUser, listStudents, assignRollNumbers, updateStudent, getStudentTimetable as getStudentTimetableService, listStudentIdCardsForAdmin, getStudentIdCardForStudentUser, updateStudentIdCardName, updateStudentIdCardPhoto, updateStudentIdCardDetailsAdmin, } from "@/modules/student/service";
import { studentIdSchema, studentIdCardUpdateSchema, studentIdCardDetailsSchema, rollAssignSchema, } from "@/modules/student/validation";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getActor(req) {
    return {
        userId: req.user?.sub,
        roleType: req.user?.roleType,
    };
}
function parseId(id) {
    if (typeof id !== "string") {
        throw new ApiError(400, "Invalid id");
    }
    const parsed = studentIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
async function ensureStudentSelfAccess(req, schoolId, studentId) {
    const roleType = req.user?.roleType;
    if (!roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    if (roleType === "STUDENT") {
        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                schoolId,
                userId: req.user?.sub,
                deletedAt: null,
            },
            select: { id: true },
        });
        if (!student) {
            throw new ApiError(403, "Forbidden: cannot access this student timetable");
        }
    }
    if (roleType === "PARENT") {
        const parent = await prisma.parent.findFirst({
            where: { schoolId, userId: req.user?.sub },
            select: { id: true },
        });
        if (!parent) {
            throw new ApiError(403, "Forbidden: parent account not linked");
        }
        const link = await prisma.parentStudentLink.findFirst({
            where: {
                parentId: parent.id,
                studentId,
                student: { schoolId, deletedAt: null, status: "ACTIVE" },
            },
            select: { id: true },
        });
        if (!link) {
            throw new ApiError(403, "Forbidden: cannot access this student timetable");
        }
    }
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await createStudent(schoolId, req.body);
        return success(res, data, "Student created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function list(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        if ("page" in req.query || "limit" in req.query) {
            console.log("[Phase1] Pagination applied");
        }
        const pagination = parsePagination(req.query);
        const { classId, sectionId, academicYearId } = req.query;
        const { items, total } = await listStudents(schoolId, pagination, getActor(req), {
            classId,
            sectionId,
            academicYearId,
        });
        const studentIds = items.map((item) => item.id);
        const tcExits = studentIds.length
            ? await prisma.studentExit.findMany({
                where: { studentId: { in: studentIds }, type: "TC" },
                select: { studentId: true },
            })
            : [];
        const tcGivenSet = new Set(tcExits.map((exit) => exit.studentId));
        const mapped = items.map((student) => ({
            ...student,
            statusLabel: student.status === "EXPELLED" && tcGivenSet.has(student.id)
                ? "TC GIVEN"
                : student.status,
        }));
        return success(res, { students: mapped }, "Students fetched successfully", 200, buildPaginationMeta(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function getById(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await getStudentById(schoolId, id, getActor(req));
        const tcExit = await prisma.studentExit.findFirst({
            where: { studentId: id, type: "TC" },
            select: { id: true },
        });
        const statusLabel = data.status === "EXPELLED" && tcExit ? "TC GIVEN" : data.status;
        return success(res, { ...data, statusLabel }, "Student fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function update(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await updateStudent(schoolId, id, req.body);
        return success(res, data, "Student updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function assignRollNumbersController(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = rollAssignSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        let academicYearId = parsed.data.academicYearId ?? null;
        if (!academicYearId) {
            const active = await prisma.academicYear.findFirst({
                where: { schoolId, isActive: true },
                select: { id: true },
            });
            if (!active) {
                throw new ApiError(404, "Active academic year not found");
            }
            academicYearId = active.id;
        }
        const data = await assignRollNumbers({
            schoolId,
            academicYearId,
            sectionId: parsed.data.sectionId ?? null,
            classId: parsed.data.classId ?? null,
        });
        return success(res, data, "Roll numbers assigned successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function remove(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await deleteStudent(schoolId, id);
        return success(res, data, "Student deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function getTimetable(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        await ensureStudentSelfAccess(req, schoolId, id);
        const data = await getStudentTimetableService(schoolId, id);
        return success(res, data, "Student timetable fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function getClassTeacher(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
        const teacher = await getClassTeacherForUser(schoolId, actor, studentId);
        return success(res, { teacher }, "Class teacher fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function studentMe(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const userId = req.user?.sub;
        if (!userId) {
            throw new ApiError(401, "Unauthorized");
        }
        const student = await prisma.student.findFirst({
            where: { schoolId, userId, deletedAt: null },
            select: {
                id: true,
                fullName: true,
                status: true,
                registrationNumber: true,
                admissionNumber: true,
            },
        });
        if (!student) {
            throw new ApiError(403, "Student account not linked");
        }
        return success(res, student, "Student profile fetched");
    }
    catch (error) {
        return next(error);
    }
}
export async function getStudentIdCard(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const userId = req.user?.sub;
        if (!userId) {
            throw new ApiError(401, "Unauthorized");
        }
        const data = await getStudentIdCardForStudentUser(schoolId, userId);
        return success(res, data, "Student ID card fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function listAdminStudentIdCards(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined;
        const data = await listStudentIdCardsForAdmin(schoolId, academicYearId);
        return success(res, data, "Student ID cards fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateAdminStudentIdCardName(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const parsed = studentIdCardUpdateSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await updateStudentIdCardName(schoolId, id, parsed.data.fullName, {
            bypassLock: true,
            lockAfter: false,
        });
        return success(res, data, "Student ID name updated");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateAdminStudentIdCardPhoto(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const uploadedFile = req.uploadedFile;
        if (!uploadedFile?.fileUrl) {
            throw new ApiError(400, "Photo file is required");
        }
        const data = await updateStudentIdCardPhoto(schoolId, id, uploadedFile.fileUrl, {
            bypassLock: true,
            lockAfter: false,
        });
        return success(res, data, "Student ID photo updated");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateAdminStudentIdCardDetails(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const parsed = studentIdCardDetailsSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await updateStudentIdCardDetailsAdmin(schoolId, id, parsed.data);
        return success(res, data, "Student ID details updated");
    }
    catch (error) {
        return next(error);
    }
}
