import multer from "multer";
import { ApiError } from "../utils/api-error";
import core, { fromBuffer } from "file-type/core";
import { NextFunction, Request, Response } from "express";

export class UploaderMiddleware {
  upload = () => {
    const storage = multer.memoryStorage();
    const limits = { fileSize: 1 * 1024 * 1024 }; // 1MB

    return multer({ storage, limits });
  };

  fileFilter = (allowedTypes: core.MimeType[]) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
      // Support single file (req.file)
      const singleFile = req.file as Express.Multer.File | undefined;
      if (singleFile) {
        const type = await fromBuffer(singleFile.buffer);
        if (!type || !allowedTypes.includes(type.mime)) {
          throw new ApiError(`File type ${type?.mime} is not allowed`, 400);
        }
        return next();
      }

      // Support array of files (req.files as Express.Multer.File[])
      const anyFiles = req.files as any;
      if (!anyFiles) return next();

      if (Array.isArray(anyFiles)) {
        for (const file of anyFiles as Express.Multer.File[]) {
          const type = await fromBuffer(file.buffer);
          if (!type || !allowedTypes.includes(type.mime)) {
            throw new ApiError(`File type ${type?.mime} is not allowed`, 400);
          }
        }
        return next();
      }

      // Support fields map (req.files as { [fieldname]: File[] })
      const filesMap = anyFiles as { [fieldname: string]: Express.Multer.File[] };
      if (Object.values(filesMap).length === 0) {
        return next();
      }

      for (const fieldname in filesMap) {
        const fileArray = filesMap[fieldname];
        for (const file of fileArray) {
          const type = await fromBuffer(file.buffer);
          if (!type || !allowedTypes.includes(type.mime)) {
            throw new ApiError(`File type ${type?.mime} is not allowed`, 400);
          }
        }
      }

      return next();
    };
  };
}
