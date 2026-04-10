import { Prisma } from "@prisma/client";

export function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export function isSerializationFailure(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2036")
  );
}

export async function retryOnceOnUnique<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }
  return fn();
}

export async function retryOnceOnUniqueOrSerialization<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isUniqueConstraintError(error) && !isSerializationFailure(error)) {
      throw error;
    }
  }
  return fn();
}
