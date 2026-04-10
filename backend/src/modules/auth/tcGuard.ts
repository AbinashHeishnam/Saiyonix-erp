import prisma from "@/core/db/prisma";

export const TC_LOGIN_GRACE_DAYS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function getDaysPassedSince(date: Date) {
  return (Date.now() - date.getTime()) / MS_PER_DAY;
}

export async function getLatestApprovedTcDate(studentId: string) {
  const request = await prisma.certificateRequest.findFirst({
    where: { studentId, type: "TC", status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });

  return request?.updatedAt ?? null;
}

export async function getStudentTcRestriction(studentId: string) {
  const approvedAt = await getLatestApprovedTcDate(studentId);
  if (!approvedAt) {
    return {
      approvedAt: null,
      daysPassed: null,
      isRestricted: false,
      isExpired: false,
    };
  }

  const daysPassed = getDaysPassedSince(approvedAt);
  return {
    approvedAt,
    daysPassed,
    isRestricted: daysPassed <= TC_LOGIN_GRACE_DAYS,
    isExpired: daysPassed > TC_LOGIN_GRACE_DAYS,
  };
}

export async function isStudentWithinTcGrace(studentId: string) {
  const status = await getStudentTcRestriction(studentId);
  return status.isRestricted;
}

export async function isStudentTcLoginBlocked(studentId: string) {
  const status = await getStudentTcRestriction(studentId);
  return status.isExpired;
}

export async function isParentTcLoginBlocked(parentId: string) {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId, student: { deletedAt: null } },
    select: { studentId: true },
  });

  if (!links.length) {
    return false;
  }

  for (const link of links) {
    const approvedAt = await getLatestApprovedTcDate(link.studentId);
    if (!approvedAt) {
      return false;
    }
    if (new Date() <= addDays(approvedAt, TC_LOGIN_GRACE_DAYS)) {
      return false;
    }
  }

  return true;
}
