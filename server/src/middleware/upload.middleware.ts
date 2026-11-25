
import multer from "multer";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const uploadDirectory = path.resolve(
  process.cwd(),
  "uploads",
  "tasks"
);

mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, uploadDirectory);
    },
    filename: (_req, _file, callback) => {
      callback(null, randomUUID());
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new Error("Unsupported file type. Upload PDF, images, documents, spreadsheets, CSV, or TXT files.")
      );
      return;
    }

    callback(null, true);
  },
});

export const taskAttachmentUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  upload.single("file")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "File size cannot exceed 10 MB"
          : error.message;

      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "File upload failed",
      });
    }

    next();
  });
};
