import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "@/utils/pagination";
import {
  createNote as createNoteService,
  deleteNote as deleteNoteService,
  getNoteById as getNoteByIdService,
  listNotes as listNotesService,
  updateNote as updateNoteService,
} from "@/modules/notes/service";
import { listNoteQuerySchema, noteIdSchema } from "@/modules/notes/validation";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function parseId(id: unknown) {
  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  const parsed = noteIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

function parseQuery(query: AuthRequest["query"]) {
  const parsed = listNoteQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid query parameters", {
      issues: parsed.error.issues,
    });
  }

  return parsed.data;
}

function getActor(req: AuthRequest) {
  if (!req.user?.sub || !req.user?.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: req.user.sub, roleType: req.user.roleType };
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const data = await createNoteService(schoolId, req.body, actor);
    return success(res, data, "Note created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const pagination = parsePagination(req.query);
    const cappedLimit = Math.min(pagination.limit, 50);
    const safePagination = {
      ...pagination,
      limit: cappedLimit,
      take: cappedLimit,
      skip: (pagination.page - 1) * cappedLimit,
    };
    const filters = parseQuery(req.query);

    const { items, total } = await listNotesService(
      schoolId,
      filters,
      actor,
      safePagination
    );

    return success(
      res,
      items,
      "Notes fetched successfully",
      200,
      buildPaginationMetaWithSync(total, safePagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await getNoteByIdService(schoolId, id, actor);
    return success(res, data, "Note fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await updateNoteService(schoolId, id, req.body, actor);
    return success(res, data, "Note updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await deleteNoteService(schoolId, id, actor);
    return success(res, data, "Note deleted successfully");
  } catch (error) {
    return next(error);
  }
}
