import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import { StorageService } from "../core/services/storage.service";

export type UploadedFileResult = {
  fileUrl: string;
  fileKey: string;
};

export type UploadOptions = {
  folder?: string;
  fieldName?: string;
};

const memoryStorage = multer.memoryStorage();

export function uploadSingle(options: UploadOptions = {}) {
  const uploader = multer({ storage: memoryStorage }).single(options.fieldName ?? "file");

  return [
    uploader,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return next();
        }

        const uploaded = await StorageService.uploadFile({
          buffer: req.file.buffer,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          folder: options.folder,
        });

        (req as Request & { uploadedFile?: UploadedFileResult }).uploadedFile = uploaded;
        return next();
      } catch (error) {
        return next(error);
      }
    },
  ];
}
