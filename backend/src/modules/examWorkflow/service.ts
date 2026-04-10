import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { logAudit } from "@/utils/audit";
import { getReportCardForActor } from "@/modules/reportCards/service";
import { publishResults } from "@/modules/results/service";
import { recomputeRanking } from "@/modules/ranking/service";
import { trigger } from "@/modules/notification/service";
import { collectStudentRecipients } from "@/modules/notification/recipientUtils";
import { PRESENT_STATUSES } from "@/modules/attendance/summaries/service";
import { trigger as triggerNotification } from "@/modules/notification/service";

type ActorContext = {
  userId?: string;
  roleType?: string;
};

function ensureActor(actor: ActorContext): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }
  return { userId: actor.userId, roleType: actor.roleType };
}

function isAdminRole(roleType: string) {
  return roleType === "SUPER_ADMIN" || roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN";
}

function calculateAttendancePercentage(total: number, present: number) {
  if (total === 0) return 0;
  return Math.round((present / total) * 10000) / 100;
}

async function getActiveAcademicYearId(schoolId: string) {
  const academicYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });
  if (!academicYear) {
    throw new ApiError(400, "Active academic year not found");
  }
  return academicYear.id;
}

async function resolveTeacherId(schoolId: string, actor: ActorContext) {
  const { userId, roleType } = ensureActor(actor);
  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Only teachers can enter marks");
  }
  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }
  return teacher.id;
}

async function ensureSectionBelongsToSchool(
  schoolId: string,
  sectionId: string
) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, deletedAt: null, class: { schoolId, deletedAt: null } },
    select: { id: true, classId: true, sectionName: true, classTeacherId: true },
  });
  if (!section) {
    throw new ApiError(404, "Section not found");
  }
  return section;
}

async function ensureClassBelongsToSchool(schoolId: string, classId: string) {
  const record = await prisma.class.findFirst({
    where: { id: classId, schoolId, deletedAt: null },
    select: { id: true, className: true },
  });
  if (!record) {
    throw new ApiError(404, "Class not found");
  }
  return record;
}

async function ensureSubjectBelongsToSchool(schoolId: string, subjectId: string) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId },
    select: { id: true, name: true },
  });
  if (!subject) {
    throw new ApiError(404, "Subject not found");
  }
  return subject;
}

async function resolveClassSubjectId(
  schoolId: string,
  classId: string,
  subjectId: string
) {
  const mapping = await prisma.classSubject.findFirst({
    where: {
      classId,
      subjectId,
      class: { schoolId, deletedAt: null },
      subject: { schoolId },
    },
    select: { id: true },
  });
  if (!mapping) {
    throw new ApiError(400, "Class subject mapping not found");
  }
  return mapping.id;
}

async function ensureTeacherCanEnterMarks(params: {
  schoolId: string;
  teacherId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  academicYearId: string;
}) {
  const section = await ensureSectionBelongsToSchool(params.schoolId, params.sectionId);
  if (section.classId !== params.classId) {
    throw new ApiError(400, "Section does not belong to class");
  }

  if (section.classTeacherId === params.teacherId) {
    return;
  }

  const classSubjectId = await resolveClassSubjectId(
    params.schoolId,
    params.classId,
    params.subjectId
  );

  const assignment = await prisma.teacherSubjectClass.findFirst({
    where: {
      teacherId: params.teacherId,
      academicYearId: params.academicYearId,
      classSubjectId,
      OR: [{ sectionId: params.sectionId }, { sectionId: null }],
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new ApiError(403, "Teacher is not assigned to this class/subject");
  }
}

export async function getTeacherAssignedExams(
  schoolId: string,
  actor: ActorContext
) {
  const teacherId = await resolveTeacherId(schoolId, actor);
  const academicYearId = await getActiveAcademicYearId(schoolId);

  const [classTeacherSections, subjectAssignments] = await Promise.all([
    prisma.section.findMany({
      where: {
        classTeacherId: teacherId,
        deletedAt: null,
        class: { schoolId, deletedAt: null },
      },
      select: { id: true, sectionName: true, classId: true, class: { select: { className: true } } },
    }),
    prisma.teacherSubjectClass.findMany({
      where: {
        teacherId,
        academicYearId,
        classSubject: { class: { schoolId, deletedAt: null }, subject: { schoolId } },
      },
      select: {
        sectionId: true,
        classSubjectId: true,
        classSubject: {
          select: {
            classId: true,
            class: { select: { className: true } },
            subject: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const classTeacherClassIds = classTeacherSections.map((section) => section.classId);
  const classSubjectsForTeacher = classTeacherClassIds.length
    ? await prisma.classSubject.findMany({
      where: {
        classId: { in: classTeacherClassIds },
        class: { schoolId, deletedAt: null },
        subject: { schoolId },
      },
      select: {
        id: true,
        classId: true,
        subject: { select: { id: true, name: true } },
      },
    })
    : [];

  const classSubjectIds = Array.from(
    new Set([
      ...subjectAssignments.map((item) => item.classSubjectId),
      ...classSubjectsForTeacher.map((item) => item.id),
    ])
  );

  if (classSubjectIds.length === 0) {
    return [];
  }

  const examSubjects = await prisma.examSubject.findMany({
    where: {
      classSubjectId: { in: classSubjectIds },
      exam: { schoolId },
    },
    select: {
      id: true,
      marksStatus: true,
      classSubjectId: true,
      classSubject: {
        select: {
          classId: true,
          class: { select: { className: true } },
          subject: { select: { id: true, name: true } },
        },
      },
      exam: {
        select: {
          id: true,
          title: true,
          type: true,
          startsOn: true,
          endsOn: true,
        },
      },
      timetable: {
        orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
        select: { examDate: true, startTime: true, endTime: true, shift: true },
      },
    },
  });

  const sectionMap = new Map<string, { id: string; name: string }>();
  classTeacherSections.forEach((section) => {
    sectionMap.set(section.id, { id: section.id, name: section.sectionName });
  });
  const subjectSectionIds = subjectAssignments
    .map((assignment) => assignment.sectionId)
    .filter(Boolean) as string[];
  if (subjectSectionIds.length > 0) {
    const subjectSections = await prisma.section.findMany({
      where: { id: { in: subjectSectionIds }, class: { schoolId, deletedAt: null } },
      select: { id: true, sectionName: true },
    });
    subjectSections.forEach((section) => {
      sectionMap.set(section.id, { id: section.id, name: section.sectionName });
    });
  }

  const subjectAssignmentMap = new Map<string, string | null>();
  subjectAssignments.forEach((assignment) => {
    const key = `${assignment.classSubjectId}:${assignment.sectionId ?? "ALL"}`;
    subjectAssignmentMap.set(key, assignment.sectionId ?? null);
  });

  const results = new Map<string, any>();

  for (const examSubject of examSubjects) {
    const base = {
      examSubjectId: examSubject.id,
      examId: examSubject.exam.id,
      examTitle: examSubject.exam.title,
      examType: examSubject.exam.type,
      classId: examSubject.classSubject.classId,
      className: examSubject.classSubject.class?.className ?? null,
      subjectId: examSubject.classSubject.subject?.id ?? null,
      subjectName: examSubject.classSubject.subject?.name ?? null,
      marksStatus: examSubject.marksStatus,
      schedule: examSubject.timetable?.[0]
        ? {
          examDate: examSubject.timetable[0].examDate,
          startTime: examSubject.timetable[0].startTime,
          endTime: examSubject.timetable[0].endTime,
          shift: examSubject.timetable[0].shift,
        }
        : null,
    };

    const classTeacherSectionsForClass = classTeacherSections.filter(
      (section) => section.classId === examSubject.classSubject.classId
    );

    if (classTeacherSectionsForClass.length > 0) {
      for (const section of classTeacherSectionsForClass) {
        const key = `${examSubject.id}:${section.id}`;
        results.set(key, {
          ...base,
          sectionId: section.id,
          sectionName: section.sectionName,
        });
      }
    }

    const subjectAssignmentKeyAll = `${examSubject.classSubjectId}:ALL`;
    if (subjectAssignmentMap.has(subjectAssignmentKeyAll)) {
      const key = `${examSubject.id}:ALL`;
      results.set(key, {
        ...base,
        sectionId: null,
        sectionName: null,
      });
    }

    for (const assignment of subjectAssignments) {
      if (assignment.classSubjectId !== examSubject.classSubjectId) continue;
      const sectionId = assignment.sectionId ?? null;
      const key = `${examSubject.id}:${sectionId ?? "ALL"}`;
      if (!results.has(key)) {
        results.set(key, {
          ...base,
          sectionId,
          sectionName: sectionId ? sectionMap.get(sectionId)?.name ?? null : null,
        });
      }
    }
  }

  const resultList = Array.from(results.values());
  const sectionPairs = resultList
    .filter((item) => item.sectionId)
    .map((item) => ({ examSubjectId: item.examSubjectId, sectionId: item.sectionId }));

  if (sectionPairs.length > 0) {
    const examSubjectIds = Array.from(new Set(sectionPairs.map((pair) => pair.examSubjectId)));
    const sectionIds = Array.from(new Set(sectionPairs.map((pair) => pair.sectionId)));
    const counts = await prisma.mark.groupBy({
      by: ["examSubjectId", "sectionId"],
      where: {
        examSubjectId: { in: examSubjectIds },
        sectionId: { in: sectionIds },
      },
      _count: { _all: true },
    });
    const submittedMap = new Map(
      counts.map((row) => [`${row.examSubjectId}:${row.sectionId}`, row._count._all])
    );
    resultList.forEach((item) => {
      if (!item.sectionId) return;
      const key = `${item.examSubjectId}:${item.sectionId}`;
      const count = submittedMap.get(key) ?? 0;
      item.marksStatus = count > 0 ? "SUBMITTED" : "PENDING";
    });
  }

  return resultList;
}

export async function getMarksEntryContext(
  schoolId: string,
  query: { examId: string; classId: string; sectionId: string; subjectId: string },
  actor: ActorContext
) {
  const teacherId = await resolveTeacherId(schoolId, actor);
  const academicYearId = await getActiveAcademicYearId(schoolId);

  const [exam, classRecord, section, subject] = await Promise.all([
    prisma.exam.findFirst({
      where: { id: query.examId, schoolId },
      select: {
        id: true,
        title: true,
        type: true,
        academicYearId: true,
        isLocked: true,
      },
    }),
    ensureClassBelongsToSchool(schoolId, query.classId),
    ensureSectionBelongsToSchool(schoolId, query.sectionId),
    ensureSubjectBelongsToSchool(schoolId, query.subjectId),
  ]);

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  if (section.classId !== query.classId) {
    throw new ApiError(400, "Section does not belong to class");
  }

  await ensureTeacherCanEnterMarks({
    schoolId,
    teacherId,
    classId: query.classId,
    sectionId: query.sectionId,
    subjectId: query.subjectId,
    academicYearId: academicYearId,
  });

  const classSubjectId = await resolveClassSubjectId(
    schoolId,
    query.classId,
    query.subjectId
  );

  const examSubject = await prisma.examSubject.findFirst({
    where: { examId: query.examId, classSubjectId },
    select: {
      id: true,
      maxMarks: true,
      passMarks: true,
      marksStatus: true,
      timetable: {
        orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
        select: { examDate: true, startTime: true, endTime: true, shift: true },
      },
    },
  });

  if (!examSubject) {
    throw new ApiError(404, "Exam subject not found");
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      sectionId: query.sectionId,
      academicYearId: exam.academicYearId,
      student: { schoolId, deletedAt: null },
    },
    select: {
      studentId: true,
      rollNumber: true,
      student: { select: { fullName: true } },
    },
    orderBy: [{ rollNumber: "asc" }, { student: { fullName: "asc" } }],
  });

  const studentIds = enrollments.map((item) => item.studentId);

  const existingMarks = studentIds.length
    ? await prisma.mark.findMany({
      where: { examSubjectId: examSubject.id, sectionId: query.sectionId, studentId: { in: studentIds } },
      select: { studentId: true, marksObtained: true, isAbsent: true },
    })
    : [];

  const markMap = new Map(
    existingMarks.map((mark) => [mark.studentId, mark])
  );

  const marksStatus =
    studentIds.length > 0 && existingMarks.length === studentIds.length ? "SUBMITTED" : "PENDING";

  return {
    exam: { id: exam.id, title: exam.title, type: exam.type },
    class: { id: classRecord.id, name: classRecord.className },
    section: { id: section.id, name: section.sectionName },
    subject: { id: subject.id, name: subject.name },
    schedule: examSubject.timetable?.[0]
      ? {
        examDate: examSubject.timetable[0].examDate,
        startTime: examSubject.timetable[0].startTime,
        endTime: examSubject.timetable[0].endTime,
        shift: examSubject.timetable[0].shift,
      }
      : null,
    maxMarks: Number(examSubject.maxMarks),
    passMarks: Number(examSubject.passMarks),
    marksStatus,
    students: enrollments.map((enrollment) => {
      const existing = markMap.get(enrollment.studentId);
      return {
        studentId: enrollment.studentId,
        fullName: enrollment.student.fullName,
        rollNumber: enrollment.rollNumber,
        marksObtained: existing ? Number(existing.marksObtained) : null,
        isAbsent: existing?.isAbsent ?? false,
      };
    }),
  };
}

export async function getMarksEntryMatrix(
  schoolId: string,
  query: { examId: string; classId: string; sectionId: string },
  actor: ActorContext
) {
  const teacherId = await resolveTeacherId(schoolId, actor);
  const academicYearId = await getActiveAcademicYearId(schoolId);

  const [exam, classRecord, section] = await Promise.all([
    prisma.exam.findFirst({
      where: { id: query.examId, schoolId },
      select: { id: true, title: true, type: true, academicYearId: true, isLocked: true },
    }),
    ensureClassBelongsToSchool(schoolId, query.classId),
    ensureSectionBelongsToSchool(schoolId, query.sectionId),
  ]);

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  if (section.classId !== query.classId) {
    throw new ApiError(400, "Section does not belong to class");
  }

  const isClassTeacher = section.classTeacherId === teacherId;

  let allowedClassSubjectIds: string[] = [];
  if (isClassTeacher) {
    const classSubjects = await prisma.classSubject.findMany({
      where: {
        classId: query.classId,
        class: { schoolId, deletedAt: null },
        subject: { schoolId },
      },
      select: { id: true },
    });
    allowedClassSubjectIds = classSubjects.map((item) => item.id);
  } else {
    const assignments = await prisma.teacherSubjectClass.findMany({
      where: {
        teacherId,
        academicYearId,
        classSubject: { classId: query.classId, class: { schoolId, deletedAt: null } },
        OR: [{ sectionId: query.sectionId }, { sectionId: null }],
      },
      select: { classSubjectId: true },
    });
    allowedClassSubjectIds = assignments.map((item) => item.classSubjectId);
  }

  if (allowedClassSubjectIds.length === 0) {
    throw new ApiError(403, "No subjects assigned for this class/section");
  }

  const examSubjects = await prisma.examSubject.findMany({
    where: {
      examId: query.examId,
      classSubjectId: { in: allowedClassSubjectIds },
    },
    select: {
      id: true,
      maxMarks: true,
      passMarks: true,
      marksStatus: true,
      classSubjectId: true,
      classSubject: { select: { subject: { select: { id: true, name: true } } } },
    },
    orderBy: [{ classSubject: { subject: { name: "asc" } } }],
  });

  if (examSubjects.length === 0) {
    throw new ApiError(404, "Exam subjects not found");
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      sectionId: query.sectionId,
      academicYearId: exam.academicYearId,
      student: { schoolId, deletedAt: null },
    },
    select: {
      studentId: true,
      rollNumber: true,
      student: { select: { fullName: true } },
    },
    orderBy: [{ rollNumber: "asc" }, { student: { fullName: "asc" } }],
  });

  const studentIds = enrollments.map((item) => item.studentId);
  const examSubjectIds = examSubjects.map((subject) => subject.id);

  const marks = studentIds.length
    ? await prisma.mark.findMany({
      where: {
        studentId: { in: studentIds },
        examSubjectId: { in: examSubjectIds },
        sectionId: query.sectionId,
      },
      select: { studentId: true, examSubjectId: true, marksObtained: true, isAbsent: true },
    })
    : [];

  const marksMap = new Map<string, { marksObtained: number; isAbsent: boolean }>();
  for (const mark of marks) {
    marksMap.set(`${mark.studentId}:${mark.examSubjectId}`, {
      marksObtained: Number(mark.marksObtained),
      isAbsent: mark.isAbsent,
    });
  }

  const response = {
    exam: { id: exam.id, title: exam.title, type: exam.type },
    class: { id: classRecord.id, name: classRecord.className },
    section: { id: section.id, name: section.sectionName },
    students: enrollments.map((enrollment) => ({
      studentId: enrollment.studentId,
      fullName: enrollment.student.fullName,
      rollNumber: enrollment.rollNumber,
    })),
    subjects: examSubjects.map((subject) => ({
      examSubjectId: subject.id,
      subjectId: subject.classSubject.subject?.id ?? null,
      subjectName: subject.classSubject.subject?.name ?? null,
      maxMarks: Number(subject.maxMarks),
      passMarks: Number(subject.passMarks),
      marksStatus: "PENDING",
    })),
    marks: enrollments.map((enrollment) => {
      const studentMarks: Record<string, { marksObtained: number | null; isAbsent: boolean }> =
        {};
      for (const subject of examSubjects) {
        const key = `${enrollment.studentId}:${subject.id}`;
        const existing = marksMap.get(key);
        studentMarks[subject.id] = {
          marksObtained: existing ? existing.marksObtained : null,
          isAbsent: existing ? existing.isAbsent : false,
        };
      }
      return { studentId: enrollment.studentId, marks: studentMarks };
    }),
  };
  if (studentIds.length > 0) {
    const counts = await prisma.mark.groupBy({
      by: ["examSubjectId"],
      where: {
        examSubjectId: { in: examSubjectIds },
        sectionId: query.sectionId,
        studentId: { in: studentIds },
      },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((row) => [row.examSubjectId, row._count._all]));
    response.subjects = response.subjects.map((subject) => ({
      ...subject,
      marksStatus: (countMap.get(subject.examSubjectId) ?? 0) === studentIds.length ? "SUBMITTED" : "PENDING",
    }));
  }

  return response;
}

export async function submitMarksBulk(
  schoolId: string,
  payload: {
    examId: string;
    classId: string;
    sectionId: string;
    subjects: Array<{
      subjectId: string;
      totalMarks: number;
      passMarks: number;
      items: Array<{ studentId: string; marksObtained: number; isAbsent?: boolean }>;
    }>;
  },
  actor: ActorContext
) {
  let updatedSubjects = 0;
  let skippedSubjects = 0;
  for (const subject of payload.subjects) {
    const result = await submitMarks(
      schoolId,
      {
        examId: payload.examId,
        classId: payload.classId,
        sectionId: payload.sectionId,
        subjectId: subject.subjectId,
        totalMarks: subject.totalMarks,
        passMarks: subject.passMarks,
        items: subject.items,
      },
      actor
    );
    if (result.submitted) {
      updatedSubjects += 1;
    } else {
      skippedSubjects += 1;
    }
  }

  if (updatedSubjects === 0) {
    throw new ApiError(400, "No changes detected. Update marks before resubmitting.");
  }

  return { submitted: true, subjects: payload.subjects.length, updatedSubjects, skippedSubjects };
}

export async function submitMarks(
  schoolId: string,
  payload: {
    examId: string;
    classId: string;
    sectionId: string;
    subjectId: string;
    totalMarks: number;
    passMarks: number;
    items: Array<{ studentId: string; marksObtained: number; isAbsent?: boolean }>;
  },
  actor: ActorContext
) {
  const teacherId = await resolveTeacherId(schoolId, actor);
  const academicYearId = await getActiveAcademicYearId(schoolId);

  const exam = await prisma.exam.findFirst({
    where: { id: payload.examId, schoolId },
    select: { id: true, academicYearId: true, isLocked: true },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  if (exam.isLocked) {
    throw new ApiError(400, "Exam is locked");
  }

  await ensureTeacherCanEnterMarks({
    schoolId,
    teacherId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    subjectId: payload.subjectId,
    academicYearId,
  });

  const classSubjectId = await resolveClassSubjectId(
    schoolId,
    payload.classId,
    payload.subjectId
  );

  const examSubject = await prisma.examSubject.findFirst({
    where: { examId: payload.examId, classSubjectId },
    select: {
      id: true,
      marksStatus: true,
      classSubject: { select: { classId: true } },
      exam: { select: { id: true } },
    },
  });

  if (!examSubject) {
    throw new ApiError(404, "Exam subject not found");
  }

  const existingMarks = await prisma.mark.findMany({
    where: { examSubjectId: examSubject.id, sectionId: payload.sectionId },
    select: { studentId: true, marksObtained: true, isAbsent: true },
  });

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      sectionId: payload.sectionId,
      academicYearId: exam.academicYearId,
      student: { schoolId, deletedAt: null },
    },
    select: { studentId: true },
  });

  const studentIds = enrollments.map((row) => row.studentId);
  const submittedIds = new Set(payload.items.map((item) => item.studentId));
  if (studentIds.length !== submittedIds.size) {
    throw new ApiError(400, "Marks must be provided for all students in the section");
  }
  for (const studentId of studentIds) {
    if (!submittedIds.has(studentId)) {
      throw new ApiError(400, "Marks must be provided for all students in the section");
    }
  }

  const totalMarks = new Prisma.Decimal(payload.totalMarks);
  const passMarks = new Prisma.Decimal(payload.passMarks);
  if (passMarks.gt(totalMarks)) {
    throw new ApiError(400, "Pass marks cannot exceed total marks");
  }

  const existingMap = new Map(
    existingMarks.map((mark) => [
      mark.studentId,
      {
        marksObtained: Number(mark.marksObtained),
        isAbsent: mark.isAbsent,
      },
    ])
  );

  if (existingMarks.length > 0) {
    // Allow resubmission only when at least one change is present.
    let hasChange = false;
    for (const item of payload.items) {
      const existing = existingMap.get(item.studentId);
      const nextObtained = item.isAbsent ? 0 : item.marksObtained;
      const nextAbsent = item.isAbsent ?? false;
      if (!existing) {
        hasChange = true;
        break;
      }
      if (existing.marksObtained !== nextObtained || existing.isAbsent !== nextAbsent) {
        hasChange = true;
        break;
      }
    }
    if (!hasChange) {
      return { submitted: false };
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.examSubject.update({
      where: { id: examSubject.id },
      data: {
        maxMarks: totalMarks,
        passMarks,
        marksStatus: "SUBMITTED",
        marksSubmittedAt: new Date(),
        marksSubmittedById: teacherId,
      },
    });

    for (const item of payload.items) {
      const obtained = item.isAbsent ? 0 : item.marksObtained;
      if (obtained > payload.totalMarks) {
        throw new ApiError(400, "Marks obtained cannot exceed total marks");
      }
      const percentage = payload.totalMarks === 0
        ? new Prisma.Decimal(0)
        : new Prisma.Decimal(obtained).div(totalMarks).mul(100).toDecimalPlaces(2);

      await tx.mark.upsert({
        where: {
          examSubjectId_studentId_sectionId: {
            examSubjectId: examSubject.id,
            studentId: item.studentId,
            sectionId: payload.sectionId,
          },
        },
        update: {
          marksObtained: new Prisma.Decimal(obtained),
          isAbsent: item.isAbsent ?? false,
          percentage,
          enteredByTeacherId: teacherId,
          lastEditedAt: new Date(),
          sectionId: payload.sectionId,
        },
        create: {
          examSubjectId: examSubject.id,
          studentId: item.studentId,
          sectionId: payload.sectionId,
          marksObtained: new Prisma.Decimal(obtained),
          isAbsent: item.isAbsent ?? false,
          percentage,
          enteredByTeacherId: teacherId,
        },
      });
    }

    const marks = await tx.mark.findMany({
      where: {
        examSubjectId: examSubject.id,
        studentId: { in: studentIds },
        sectionId: payload.sectionId,
      },
      select: { id: true, studentId: true, marksObtained: true },
    });

    marks.sort((a, b) => {
      const diff = b.marksObtained.minus(a.marksObtained).toNumber();
      if (diff !== 0) return diff;
      return a.studentId.localeCompare(b.studentId);
    });

    let rank = 1;
    for (const mark of marks) {
      await tx.mark.update({
        where: { id: mark.id },
        data: { rank },
      });
      rank += 1;
    }

    await logAudit({
      userId: actor.userId,
      action: "MARKS_SUBMITTED",
      entity: "ExamSubject",
      entityId: examSubject.id,
      metadata: { examSubjectId: examSubject.id, count: payload.items.length },
    });

    try {
      await triggerNotification("MARKS_SUBMITTED", {
        schoolId,
        sentById: actor.userId ?? undefined,
        classId: examSubject.classSubject.classId,
        sectionId: payload.sectionId,
        metadata: {
          examId: examSubject.exam.id,
          examSubjectId: examSubject.id,
          submittedCount: payload.items.length,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[notify] marks submitted failed", error);
      }
    }

    return { submitted: true };
  });
}

export async function getExamResultStatus(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    select: { id: true, title: true },
  });
  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  const examSubjects = await prisma.examSubject.findMany({
    where: { examId },
    select: {
      id: true,
      classSubject: {
        select: {
          class: { select: { id: true, className: true } },
          subject: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ classSubject: { class: { classOrder: "asc" } } }],
  });

  const classIds = Array.from(
    new Set(
      examSubjects
        .map((item) => item.classSubject.class?.id)
        .filter(Boolean) as string[]
    )
  );

  const sections = await prisma.section.findMany({
    where: { classId: { in: classIds }, class: { schoolId, deletedAt: null }, deletedAt: null },
    select: {
      id: true,
      sectionName: true,
      classId: true,
      classTeacher: { select: { fullName: true } },
    },
  });

  const sectionIds = sections.map((sec) => sec.id);

  const [enrollmentCounts, markCounts, latestMarks, publishAgg, publishTotal] = await Promise.all([
    prisma.studentEnrollment.groupBy({
      by: ["sectionId"],
      where: { sectionId: { in: sectionIds } },
      _count: { _all: true },
    }),
    prisma.mark.groupBy({
      by: ["examSubjectId", "sectionId"],
      where: {
        examSubjectId: { in: examSubjects.map((item) => item.id) },
        sectionId: { in: sectionIds },
      },
      _count: { _all: true },
    }),
    prisma.mark.findMany({
      where: {
        examSubjectId: { in: examSubjects.map((item) => item.id) },
        sectionId: { in: sectionIds },
      },
      select: {
        examSubjectId: true,
        sectionId: true,
        enteredAt: true,
        lastEditedAt: true,
        enteredByTeacher: { select: { fullName: true } },
      },
      orderBy: [{ lastEditedAt: "desc" }, { enteredAt: "desc" }],
    }),
    prisma.reportCard.aggregate({
      where: { examId, publishedAt: { not: null } },
      _max: { publishedAt: true },
      _count: { _all: true },
    }),
    prisma.reportCard.count({ where: { examId } }),
  ]);

  const sectionByClass = new Map<string, typeof sections>();
  sections.forEach((section) => {
    if (!sectionByClass.has(section.classId)) sectionByClass.set(section.classId, []);
    sectionByClass.get(section.classId)?.push(section);
  });

  const enrollmentCountMap = new Map(
    enrollmentCounts.map((row) => [row.sectionId, row._count._all])
  );
  const markCountMap = new Map(
    markCounts.map((row) => [`${row.examSubjectId}:${row.sectionId}`, row._count._all])
  );
  const latestMap = new Map<string, { submittedAt: Date; submittedBy: string | null }>();
  latestMarks.forEach((mark) => {
    const key = `${mark.examSubjectId}:${mark.sectionId}`;
    if (latestMap.has(key)) return;
    latestMap.set(key, {
      submittedAt: mark.lastEditedAt ?? mark.enteredAt,
      submittedBy: mark.enteredByTeacher?.fullName ?? null,
    });
  });

  const items: Array<any> = [];
  for (const subject of examSubjects) {
    const classId = subject.classSubject.class?.id ?? null;
    const className = subject.classSubject.class?.className ?? null;
    const subjectId = subject.classSubject.subject?.id ?? null;
    const subjectName = subject.classSubject.subject?.name ?? null;
    if (!classId) continue;
    const sectionsForClass = sectionByClass.get(classId) ?? [];
    for (const section of sectionsForClass) {
      const enrollmentCount = enrollmentCountMap.get(section.id) ?? 0;
      const count = markCountMap.get(`${subject.id}:${section.id}`) ?? 0;
      const latest = latestMap.get(`${subject.id}:${section.id}`) ?? null;
      items.push({
        examSubjectId: subject.id,
        classId,
        className,
        sectionId: section.id,
        sectionName: section.sectionName,
        classTeacher: section.classTeacher?.fullName ?? null,
        subjectId,
        subjectName,
        status: enrollmentCount > 0 && count === enrollmentCount ? "SUBMITTED" : "PENDING",
        submittedAt: latest?.submittedAt ?? null,
        submittedBy: latest?.submittedBy ?? null,
      });
    }
  }

  return {
    exam: { id: exam.id, title: exam.title },
    publishSummary: {
      publishedAt: publishAgg._max.publishedAt ?? null,
      publishedCount: publishAgg._count._all ?? 0,
      totalCount: publishTotal ?? 0,
    },
    items,
  };
}

export async function publishExamResult(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const { userId, roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }
  const result = await publishResults(schoolId, examId, {
    userId,
    roleType: roleType as "SUPER_ADMIN" | "ADMIN" | "ACADEMIC_SUB_ADMIN",
  });
  await recomputeRanking(schoolId, examId, {
    userId,
    roleType: roleType as "SUPER_ADMIN" | "ADMIN" | "ACADEMIC_SUB_ADMIN",
  });
  try {
    const reportCards = await prisma.reportCard.findMany({
      where: { examId },
      select: { studentId: true },
    });
    const studentIds = Array.from(new Set(reportCards.map((row) => row.studentId)));
    const recipients = await collectStudentRecipients({ schoolId, studentIds });
    if (recipients.length > 0) {
      const exam = await prisma.exam.findFirst({
        where: { id: examId, schoolId },
        select: { title: true },
      });
      await trigger("RESULT_PUBLISHED", {
        schoolId,
        sentById: userId,
        userIds: recipients,
        metadata: { examId, examTitle: exam?.title ?? "Exam" },
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[notify] result publish failed", error);
    }
  }
  return result;
}

export async function getExamResultForActor(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  return getReportCardForActor(schoolId, examId, actor);
}

export async function createResultRecheckComplaint(
  schoolId: string,
  payload: { examId: string; subjectId: string; reason: string; studentId?: string },
  actor: ActorContext
) {
  const { userId, roleType } = ensureActor(actor);

  let studentId: string | null = null;
  let parentId: string | null = null;

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }
    studentId = student.id;
  }

  if (roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId },
      select: { id: true },
    });
    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }
    parentId = parent.id;
    if (payload.studentId) {
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: parent.id, studentId: payload.studentId },
        select: { studentId: true },
      });
      if (!link) {
        throw new ApiError(403, "Forbidden");
      }
      studentId = payload.studentId;
    } else {
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: parent.id },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
        select: { studentId: true },
      });
      if (!link) {
        throw new ApiError(403, "Parent is not linked to any student");
      }
      studentId = link.studentId;
    }
  }

  if (!studentId) {
    throw new ApiError(403, "Forbidden");
  }

  const [exam, subject] = await Promise.all([
    prisma.exam.findFirst({ where: { id: payload.examId, schoolId }, select: { title: true } }),
    prisma.subject.findFirst({ where: { id: payload.subjectId, schoolId }, select: { name: true } }),
  ]);

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }
  if (!subject) {
    throw new ApiError(404, "Subject not found");
  }

  const complaint = await prisma.complaint.create({
    data: {
      schoolId,
      studentId,
      parentId,
      category: "RESULT_RECHECK",
      subject: `${exam.title} - ${subject.name}`,
      description: payload.reason,
      status: "SUBMITTED",
    },
  });

  await logAudit({
    userId,
    action: "RESULT_RECHECK",
    entity: "Complaint",
    entityId: complaint.id,
    metadata: { examId: payload.examId, subjectId: payload.subjectId },
  });

  return complaint;
}

export async function listComplaints(
  schoolId: string,
  actor: ActorContext,
  filters?: { category?: string }
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const where = {
    schoolId,
    ...(filters?.category ? { category: filters.category } : {}),
  };

  const items = await prisma.complaint.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { id: true, fullName: true } },
      parent: { select: { id: true, fullName: true } },
    },
  });

  return items.map((item) => ({
    id: item.id,
    category: item.category,
    subject: item.subject,
    description: item.description,
    status: item.status,
    student: item.student ? { id: item.student.id, fullName: item.student.fullName } : null,
    parent: item.parent ? { id: item.parent.id, fullName: item.parent.fullName } : null,
    createdAt: item.createdAt,
  }));
}

export async function getTeacherExamAnalytics(
  schoolId: string,
  params: { examId: string; sectionId: string; marksThreshold?: number; attendanceThreshold?: number },
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  let teacherId: string | null = null;
  if (!isAdminRole(roleType)) {
    teacherId = await resolveTeacherId(schoolId, actor);
  }
  const section = await ensureSectionBelongsToSchool(schoolId, params.sectionId);
  if (teacherId && section.classTeacherId !== teacherId) {
    throw new ApiError(403, "Only class teacher can view analytics");
  }

  const exam = await prisma.exam.findFirst({
    where: { id: params.examId, schoolId },
    select: { id: true, title: true, academicYearId: true, startsOn: true, endsOn: true },
  });
  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: exam.academicYearId, schoolId },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!academicYear) {
    throw new ApiError(404, "Academic year not found");
  }

  const examSubjects = await prisma.examSubject.findMany({
    where: {
      examId: exam.id,
      classSubject: { classId: section.classId },
    },
    select: {
      id: true,
      maxMarks: true,
      passMarks: true,
      classSubject: { select: { subject: { select: { id: true, name: true } } } },
    },
    orderBy: [{ classSubject: { subject: { name: "asc" } } }],
  });

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      sectionId: section.id,
      academicYearId: exam.academicYearId,
      student: { schoolId, deletedAt: null },
    },
    select: {
      studentId: true,
      rollNumber: true,
      student: { select: { fullName: true } },
    },
    orderBy: [{ rollNumber: "asc" }, { student: { fullName: "asc" } }],
  });

  const studentIds = enrollments.map((row) => row.studentId);
  const examSubjectIds = examSubjects.map((row) => row.id);

  const marks = studentIds.length
    ? await prisma.mark.findMany({
      where: { studentId: { in: studentIds }, examSubjectId: { in: examSubjectIds } },
      select: { studentId: true, examSubjectId: true, marksObtained: true },
    })
    : [];

  const marksMap = new Map<string, number>();
  for (const mark of marks) {
    marksMap.set(`${mark.studentId}:${mark.examSubjectId}`, Number(mark.marksObtained));
  }

  const rangeStart = academicYear.startDate;
  const rangeEnd = exam.endsOn ?? academicYear.endDate;
  const totalByStudent = new Map<string, number>();
  const presentByStudent = new Map<string, number>();

  if (studentIds.length > 0) {
    const totalRows = await prisma.studentAttendance.groupBy({
      by: ["studentId"],
      where: {
        studentId: { in: studentIds },
        academicYearId: exam.academicYearId,
        attendanceDate: { gte: rangeStart, lte: rangeEnd },
        student: { schoolId, deletedAt: null },
        section: { class: { schoolId, deletedAt: null }, deletedAt: null },
      },
      _count: { _all: true },
    });
    const presentRows = await prisma.studentAttendance.groupBy({
      by: ["studentId"],
      where: {
        studentId: { in: studentIds },
        academicYearId: exam.academicYearId,
        attendanceDate: { gte: rangeStart, lte: rangeEnd },
        status: { in: [...PRESENT_STATUSES] },
        student: { schoolId, deletedAt: null },
        section: { class: { schoolId, deletedAt: null }, deletedAt: null },
      },
      _count: { _all: true },
    });
    totalRows.forEach((row) => totalByStudent.set(row.studentId, row._count._all));
    presentRows.forEach((row) => presentByStudent.set(row.studentId, row._count._all));
  }

  const markThreshold = params.marksThreshold ?? 40;
  const attendanceThreshold = params.attendanceThreshold ?? 75;

  const subjectStats = examSubjects.map((subject) => {
    let total = 0;
    let count = 0;
    let failCount = 0;
    for (const studentId of studentIds) {
      const value = marksMap.get(`${studentId}:${subject.id}`) ?? 0;
      total += value;
      count += 1;
      if (value < Number(subject.passMarks)) failCount += 1;
    }
    return {
      examSubjectId: subject.id,
      subjectId: subject.classSubject.subject?.id ?? null,
      subjectName: subject.classSubject.subject?.name ?? null,
      average: count ? Math.round((total / count) * 100) / 100 : 0,
      failCount,
    };
  });

  const students: Array<{
    studentId: string;
    fullName: string;
    rollNumber: number | null;
    overallPercentage: number;
    attendancePercentage: number;
    weakMarks: boolean;
    weakAttendance: boolean;
    hasFailedSubject: boolean;
    sectionRank: number | null;
    schoolRank: number | null;
    subjectMarks: Array<{
      subjectId: string;
      subjectName: string;
      marksObtained: number;
      maxMarks: number;
      passMarks: number;
      percentage: number;
      isFail: boolean;
    }>;
  }> = enrollments.map((enrollment) => {
    let totalMarks = 0;
    let totalMax = 0;
    const subjectMarks = examSubjects.map((subject) => {
      const obtained = marksMap.get(`${enrollment.studentId}:${subject.id}`) ?? 0;
      totalMarks += obtained;
      totalMax += Number(subject.maxMarks);
      const percentage = totalMax === 0 ? 0 : Math.round((obtained / Number(subject.maxMarks)) * 10000) / 100;
      const isFail = obtained < Number(subject.passMarks);
      return {
        examSubjectId: subject.id,
        subjectId: subject.classSubject.subject?.id ?? null,
        subjectName: subject.classSubject.subject?.name ?? null,
        marksObtained: obtained,
        maxMarks: Number(subject.maxMarks),
        passMarks: Number(subject.passMarks),
        percentage,
        isFail,
      };
    });

    const hasFailedSubject = subjectMarks.some((m) => m.isFail);
    const overallPercentage = totalMax === 0 ? 0 : Math.round((totalMarks / totalMax) * 10000) / 100;
    const attendancePct = calculateAttendancePercentage(
      totalByStudent.get(enrollment.studentId) ?? 0,
      presentByStudent.get(enrollment.studentId) ?? 0
    );

    return {
      studentId: enrollment.studentId,
      fullName: enrollment.student.fullName,
      rollNumber: enrollment.rollNumber,
      overallPercentage,
      attendancePercentage: attendancePct,
      weakMarks: overallPercentage < markThreshold,
      weakAttendance: attendancePct < attendanceThreshold,
      hasFailedSubject,
      sectionRank: null,
      schoolRank: null,
      subjectMarks,
    };
  });

  const ranks = await prisma.rankSnapshot.findMany({
    where: { examId: exam.id, studentId: { in: studentIds }, exam: { schoolId } },
    select: { studentId: true, sectionRank: true, schoolRank: true },
  });
  const rankMap = new Map(ranks.map((row) => [row.studentId, row]));
  students.forEach((student: any) => {
    const rank = rankMap.get(student.studentId);
    // Class teachers should only see section ranks.
    student.sectionRank = rank?.sectionRank ?? null;
    student.schoolRank = teacherId ? null : rank?.schoolRank ?? null;
  });

  // Fallback: if ranking snapshots are missing, compute section ranks from overall percentage.
  const hasSectionRanks = students.some((student: any) => student.sectionRank !== null);
  if (!hasSectionRanks) {
    const sorted = [...students].sort((a, b) => b.overallPercentage - a.overallPercentage);
    let currentRank = 1;
    sorted.forEach((student, index) => {
      if (
        index > 0 &&
        sorted[index - 1].overallPercentage !== student.overallPercentage
      ) {
        currentRank = index + 1;
      }
      student.sectionRank = currentRank;
    });
  }

  return {
    exam: { id: exam.id, title: exam.title },
    section: { id: section.id, name: section.sectionName },
    thresholds: { marksThreshold: markThreshold, attendanceThreshold },
    subjects: subjectStats,
    students,
  };
}

export async function getTeacherMyClassAnalytics(
  schoolId: string,
  params: { examId: string; teacherId?: string; marksThreshold?: number; attendanceThreshold?: number },
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  let teacherId: string;
  if (isAdminRole(roleType)) {
    if (!params.teacherId) {
      throw new ApiError(400, "teacherId is required for admin access");
    }
    const teacher = await prisma.teacher.findFirst({
      where: { id: params.teacherId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      throw new ApiError(404, "Teacher not found");
    }
    teacherId = teacher.id;
  } else {
    teacherId = await resolveTeacherId(schoolId, actor);
  }

  const section = await prisma.section.findFirst({
    where: {
      classTeacherId: teacherId,
      deletedAt: null,
      class: { schoolId, deletedAt: null },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!section) {
    throw new ApiError(404, "No class assigned to this teacher");
  }

  return getTeacherExamAnalytics(
    schoolId,
    {
      examId: params.examId,
      sectionId: section.id,
      marksThreshold: params.marksThreshold,
      attendanceThreshold: params.attendanceThreshold,
    },
    actor
  );
}
