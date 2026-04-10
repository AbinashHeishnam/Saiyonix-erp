import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

import { ApiError } from "@/utils/apiError";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectUnknownKeys(
  original: unknown,
  parsed: unknown,
  path: string[] = []
): string[] {
  if (Array.isArray(original) && Array.isArray(parsed)) {
    const unknowns: string[] = [];
    const max = Math.min(original.length, parsed.length);
    for (let i = 0; i < max; i += 1) {
      unknowns.push(...collectUnknownKeys(original[i], parsed[i], [...path, `[${i}]`]));
    }
    return unknowns;
  }

  if (isPlainObject(original) && isPlainObject(parsed)) {
    const unknowns: string[] = [];
    for (const key of Object.keys(original)) {
      if (!(key in parsed)) {
        unknowns.push([...path, key].join("."));
        continue;
      }

      unknowns.push(
        ...collectUnknownKeys(
          (original as Record<string, unknown>)[key],
          (parsed as Record<string, unknown>)[key],
          [...path, key]
        )
      );
    }
    return unknowns;
  }

  return [];
}

type ValidationSchemaMap = {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
};

type ValidationIssue = {
  source: "body" | "params" | "query";
  issues: unknown[];
  unknownKeys: string[];
};

function isZodSchema(value: unknown): value is ZodSchema {
  return typeof value === "object" && value !== null && "safeParse" in value;
}

const LOG_VALIDATION =
  process.env.LOG_VALIDATION === "true" || process.env.NODE_ENV !== "production";

export function validate(schema: ZodSchema | ValidationSchemaMap) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (LOG_VALIDATION) {
      console.log("[validate] start", req.method, req.originalUrl);
    }
    const errors: ValidationIssue[] = [];

    const canAssignKey = (key: "body" | "params" | "query") => {
      let target: unknown = req;
      while (target && typeof target === "object") {
        const descriptor = Object.getOwnPropertyDescriptor(target, key);
        if (descriptor) {
          return Boolean(descriptor.set) || Boolean(descriptor.writable);
        }
        target = Object.getPrototypeOf(target);
      }
      return true;
    };

    const assignIfWritable = (key: "body" | "params" | "query", value: unknown) => {
      const canAssign = canAssignKey(key);
      if (canAssign) {
        (req as Request & Record<string, unknown>)[key] = value as never;
        return;
      }

      // Fall back to mutating the existing object when possible (Express 5 getter-only props).
      const existing = (req as Request & Record<string, unknown>)[key];
      if (isPlainObject(existing) && isPlainObject(value)) {
        for (const existingKey of Object.keys(existing)) {
          delete (existing as Record<string, unknown>)[existingKey];
        }
        Object.assign(existing, value);
      }
    };

    const validatePart = (
      source: ValidationIssue["source"],
      value: unknown,
      partSchema?: ZodSchema
    ) => {
      if (!partSchema) {
        return value;
      }

      const result = partSchema.safeParse(value);
      if (!result.success) {
        errors.push({ source, issues: result.error.issues, unknownKeys: [] });
        return value;
      }

      const unknownKeys = collectUnknownKeys(value, result.data);
      if (unknownKeys.length > 0) {
        errors.push({ source, issues: [], unknownKeys });
      }

      return result.data;
    };

    if (isZodSchema(schema)) {
      const nextBody = validatePart("body", req.body, schema);
      assignIfWritable("body", nextBody);
    } else {
      const nextBody = validatePart("body", req.body, schema.body);
      const nextParams = validatePart("params", req.params, schema.params);
      const nextQuery = validatePart("query", req.query, schema.query);
      assignIfWritable("body", nextBody);
      assignIfWritable("params", nextParams);
      assignIfWritable("query", nextQuery);
    }

    if (errors.length > 0) {
      if (LOG_VALIDATION) {
        console.log("[validate] failed", errors);
      }
      return next(
        new ApiError(400, "Validation failed", {
          errors,
        })
      );
    }

    if (LOG_VALIDATION) {
      console.log("[validate] ok");
    }
    return next();
  };
}
