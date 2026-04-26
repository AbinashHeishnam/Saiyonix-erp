import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { getCacheVersion } from "@/core/cacheService";
import { getCache, setCache } from "@/core/cache/cache";
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
async function resolveTeacherId(schoolId, actor) {
    if (actor.roleType !== "TEACHER") {
        throw new ApiError(403, "Only teachers can access analytics");
    }
    const teacher = await prisma.teacher.findFirst({
        where: { schoolId, userId: actor.userId, deletedAt: null },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(403, "Teacher account not linked");
    }
    return teacher.id;
}
async function teacherHasStudentAccess(schoolId, teacherId, studentId) {
    const academicYearId = await getActiveAcademicYearId(schoolId);
    const enrollment = await prisma.studentEnrollment.findFirst({
        where: { studentId, academicYearId },
        select: { classId: true, sectionId: true },
    });
    if (!enrollment)
        return false;
    if (enrollment.sectionId) {
        const section = await prisma.section.findFirst({
            where: {
                id: enrollment.sectionId,
                deletedAt: null,
                class: { schoolId, deletedAt: null },
            },
            select: { classTeacherId: true },
        });
        if (section?.classTeacherId === teacherId) {
            return true;
        }
    }
    const teacherClassLink = await prisma.teacherSubjectClass.findFirst({
        where: {
            teacherId,
            classSubject: {
                classId: enrollment.classId,
                class: { schoolId, deletedAt: null },
            },
            OR: enrollment.sectionId
                ? [{ sectionId: null }, { sectionId: enrollment.sectionId }]
                : [{ sectionId: null }],
        },
        select: { id: true },
    });
    if (teacherClassLink)
        return true;
    if (enrollment.sectionId) {
        const timetableLink = await prisma.timetableSlot.findFirst({
            where: {
                teacherId,
                sectionId: enrollment.sectionId,
                classSubject: {
                    classId: enrollment.classId,
                    class: { schoolId, deletedAt: null },
                },
            },
            select: { id: true },
        });
        if (timetableLink)
            return true;
    }
    return false;
}
export async function getAnalyticsForActor(schoolId, studentIdOption, examId, actor) {
    let studentId = studentIdOption;
    if (studentId === "me" && actor.roleType === "STUDENT") {
        const meStudent = await prisma.student.findFirst({
            where: { schoolId, userId: actor.userId, deletedAt: null },
            select: { id: true }
        });
        if (meStudent)
            studentId = meStudent.id;
        else
            throw new ApiError(404, "Student mapping not found");
    }
    // Check authorization
    if (actor.roleType === "STUDENT") {
        const student = await prisma.student.findFirst({
            where: { id: studentId, schoolId, userId: actor.userId, deletedAt: null },
        });
        if (!student)
            throw new ApiError(403, "Forbidden");
    }
    else if (actor.roleType === "PARENT") {
        const parent = await prisma.parent.findFirst({
            where: { schoolId, userId: actor.userId },
            select: { id: true },
        });
        if (!parent)
            throw new ApiError(403, "Parent account not linked");
        const link = await prisma.parentStudentLink.findFirst({
            where: { parentId: parent.id, studentId, student: { schoolId, deletedAt: null } },
        });
        if (!link)
            throw new ApiError(403, "Forbidden");
    }
    else if (actor.roleType === "TEACHER") {
        const student = await prisma.student.findFirst({
            where: { id: studentId, schoolId, deletedAt: null },
            select: { id: true },
        });
        if (!student)
            throw new ApiError(404, "Student not found");
        const teacherId = await resolveTeacherId(schoolId, actor);
        const allowed = await teacherHasStudentAccess(schoolId, teacherId, studentId);
        if (!allowed) {
            throw new ApiError(403, "Forbidden");
        }
    }
    else if (!["ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"].includes(actor.roleType)) {
        throw new ApiError(403, "Forbidden");
    }
    const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
        select: {
            fullName: true,
            enrollments: {
                take: 1,
                orderBy: { createdAt: "desc" },
                select: {
                    class: { select: { className: true, id: true } },
                    section: { select: { sectionName: true, id: true } }
                }
            }
        }
    });
    if (!student)
        throw new ApiError(404, "Student not found");
    const classId = student.enrollments[0]?.class?.id;
    const className = student.enrollments[0]?.class?.className;
    const sectionName = student.enrollments[0]?.section?.sectionName;
    // Determine Exam
    let targetExamId = examId;
    let targetExamDetails = null;
    if (targetExamId) {
        targetExamDetails = await prisma.exam.findFirst({ where: { id: targetExamId }, select: { academicYearId: true } });
    }
    if (!targetExamId && classId) {
        const latestExam = await prisma.exam.findFirst({
            where: { schoolId, isPublished: true, examSubjects: { some: { classSubject: { classId } } } },
            orderBy: { endsOn: "desc" },
            select: { id: true, academicYearId: true }
        });
        if (latestExam) {
            targetExamId = latestExam.id;
            targetExamDetails = latestExam;
        }
    }
    if (!targetExamId)
        throw new ApiError(404, "No published exams found for analytics");
    const version = await getCacheVersion("analytics", targetExamId);
    const cacheKey = `analytics:v${version}:${schoolId}:${studentId}:${targetExamId}`;
    const cached = await getCache(cacheKey);
    if (cached)
        return cached;
    // 1. Overall
    const reportCard = await prisma.reportCard.findFirst({
        where: { studentId, examId: targetExamId, OR: [{ isPublished: true }, { publishedAt: { not: null } }] },
        select: { totalMarks: true, percentage: true, grade: true }
    });
    const rankSnapshot = await prisma.rankSnapshot.findFirst({
        where: { studentId, examId: targetExamId },
        select: { classRank: true, sectionRank: true, schoolRank: true }
    });
    // 2. SubjectWise
    const marks = await prisma.mark.findMany({
        where: { studentId, examSubject: { examId: targetExamId } },
        include: { examSubject: { include: { classSubject: { include: { subject: true } } } } }
    });
    const subjectWise = marks.map((m) => {
        const max = Number(m.examSubject.maxMarks);
        const obt = Number(m.marksObtained);
        const passM = Number(m.examSubject.passMarks);
        return {
            subject: m.examSubject.classSubject.subject.name,
            marks: obt,
            maxMarks: max,
            percentage: max > 0 ? Number(((obt / max) * 100).toFixed(2)) : 0,
            pass: obt >= passM
        };
    });
    const passStatus = subjectWise.length > 0 && subjectWise.every(s => s.pass) ? "PASS" : "FAIL";
    const overall = {
        totalMarks: reportCard ? Number(reportCard.totalMarks) : 0,
        percentage: reportCard ? Number(reportCard.percentage) : 0,
        rank: rankSnapshot?.classRank ?? null,
        passStatus
    };
    // 3. Trends
    const allReports = await prisma.reportCard.findMany({
        where: { studentId, OR: [{ isPublished: true }, { publishedAt: { not: null } }] },
        include: { exam: { select: { title: true, endsOn: true } } },
        orderBy: { exam: { endsOn: "asc" } }
    });
    const trends = allReports.map(r => ({
        examName: r.exam.title,
        percentage: Number(r.percentage)
    }));
    // 4. ClassStats
    let classStats = { classAverage: 0, highest: 0, lowest: 0, passPercentage: 0 };
    if (classId && targetExamDetails?.academicYearId) {
        const enrollments = await prisma.studentEnrollment.findMany({
            where: { classId, academicYearId: targetExamDetails.academicYearId },
            select: { studentId: true }
        });
        const studentIds = enrollments.map(e => e.studentId);
        if (studentIds.length > 0) {
            const classReports = await prisma.reportCard.findMany({
                where: { examId: targetExamId, studentId: { in: studentIds } },
                select: { percentage: true }
            });
            const percentages = classReports.map(r => Number(r.percentage)).filter(p => !isNaN(p));
            if (percentages.length > 0) {
                const highest = Math.max(...percentages);
                const lowest = Math.min(...percentages);
                const avg = Number((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(2));
                const passCount = percentages.filter(p => p >= 33).length;
                const passPercentage = Number(((passCount / percentages.length) * 100).toFixed(2));
                classStats = { classAverage: avg, highest, lowest, passPercentage };
            }
        }
    }
    // 5. Attendance (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const attendanceRows = await prisma.studentAttendance.findMany({
        where: {
            studentId,
            attendanceDate: { gte: thirtyDaysAgo }
        },
        select: { attendanceDate: true, status: true }
    });
    const attendanceByDate = {};
    attendanceRows.forEach((row) => {
        const key = row.attendanceDate.toISOString().split("T")[0];
        if (!attendanceByDate[key])
            attendanceByDate[key] = { present: 0, total: 0 };
        attendanceByDate[key].total += 1;
        if (row.status === "PRESENT" || row.status === "LATE") {
            attendanceByDate[key].present += 1;
        }
    });
    const attendanceTrend = Object.keys(attendanceByDate)
        .sort()
        .map((date) => {
        const row = attendanceByDate[date];
        return {
            date: new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
            percentage: row.total > 0 ? Number(((row.present / row.total) * 100).toFixed(1)) : 0,
        };
    });
    const attendanceAverage = attendanceTrend.length > 0
        ? Number((attendanceTrend.reduce((sum, item) => sum + item.percentage, 0) / attendanceTrend.length).toFixed(1))
        : 0;
    const resData = {
        studentInfo: {
            name: student.fullName,
            class: className ?? "N/A",
            section: sectionName ?? "N/A"
        },
        overall,
        subjectWise,
        trends,
        classStats,
        attendance: {
            averagePercentage: attendanceAverage,
            trend: attendanceTrend
        }
    };
    await setCache(cacheKey, resData, 300);
    return resData;
}
export async function getSchoolAnalytics(schoolId) {
    const version = await getCacheVersion("school_analytics", schoolId);
    const cacheKey = `analytics:school:v${version}:${schoolId}`;
    const cached = await getCache(cacheKey);
    if (cached)
        return cached;
    // 1. Demographics
    const totalStudents = await prisma.student.count({ where: { schoolId, deletedAt: null } });
    const totalTeachers = await prisma.teacher.count({ where: { schoolId, deletedAt: null } });
    // Admissions Trend (Last 6 Months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const admissions = await prisma.student.findMany({
        where: { schoolId, deletedAt: null, createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true }
    });
    const admissionTrendMap = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 0; i < 6; i++) {
        const d = new Date(sixMonthsAgo);
        d.setMonth(d.getMonth() + i);
        admissionTrendMap[`${monthNames[d.getMonth()]} ${d.getFullYear()}`] = 0;
    }
    admissions.forEach(a => {
        const key = `${monthNames[a.createdAt.getMonth()]} ${a.createdAt.getFullYear()}`;
        if (admissionTrendMap[key] !== undefined)
            admissionTrendMap[key]++;
    });
    const admissionTrend = Object.keys(admissionTrendMap).map(k => ({ month: k, admissions: admissionTrendMap[k] }));
    // 2. Academic Performance (Overall Pass/Fail ratio in newest exams)
    const latestExam = await prisma.exam.findFirst({
        where: { schoolId, isPublished: true },
        orderBy: { endsOn: "desc" },
        select: { id: true, title: true }
    });
    let passFailCount = { pass: 0, fail: 0 };
    if (latestExam) {
        const reports = await prisma.reportCard.findMany({
            where: { examId: latestExam.id },
            select: { percentage: true }
        });
        passFailCount.pass = reports.filter(r => Number(r.percentage) >= 33).length;
        passFailCount.fail = reports.length - passFailCount.pass;
    }
    // 3. Overall Attendance Average (Last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const attendances = await prisma.studentAttendance.findMany({
        where: { student: { schoolId }, attendanceDate: { gte: fourteenDaysAgo } },
        select: { attendanceDate: true, status: true }
    });
    const attendanceByDate = {};
    attendances.forEach(a => {
        const d = a.attendanceDate.toISOString().split("T")[0];
        if (!attendanceByDate[d])
            attendanceByDate[d] = { present: 0, total: 0 };
        attendanceByDate[d].total++;
        if (a.status === "PRESENT" || a.status === "LATE")
            attendanceByDate[d].present++;
    });
    const attendanceTrend = Object.keys(attendanceByDate)
        .sort()
        .map(date => {
        const row = attendanceByDate[date];
        return {
            date: new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
            percentage: row.total > 0 ? Number(((row.present / row.total) * 100).toFixed(1)) : 0
        };
    });
    const recentAvgAttendance = attendanceTrend.length > 0
        ? Number((attendanceTrend.reduce((a, b) => a + b.percentage, 0) / attendanceTrend.length).toFixed(1))
        : 0;
    const data = {
        summary: {
            totalStudents,
            totalTeachers,
            averageAttendance: recentAvgAttendance
        },
        admissionTrend,
        attendanceTrend,
        performance: {
            examTitle: latestExam?.title ?? "No Data",
            passCount: passFailCount.pass,
            failCount: passFailCount.fail
        }
    };
    await setCache(cacheKey, data, 300);
    return data;
}
