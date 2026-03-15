import prisma from "../../config/prisma";
import { ApiError } from "../../utils/apiError";

export async function getUserSchoolId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { schoolId: true },
  });

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  return user.schoolId;
}
