import { diskStorage } from 'multer';
import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads';

export const voucherMulterOptions = {
  storage: diskStorage({
    destination: `${UPLOADS_DIR}/vouchers`,
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `voucher-${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(
        new BadRequestException('Solo se permiten imágenes'),
        false,
      );
    }
    cb(null, true);
  },
};
