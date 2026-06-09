import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'image/webp']);

@Injectable()
export class FileStorageService {
  constructor(private readonly config: ConfigService) {}

  async save(file: Express.Multer.File) {
    this.validate(file);
    const uploadDir = this.config.get<string>('UPLOAD_DIR', './uploads');
    await mkdir(uploadDir, { recursive: true });
    const storageKey = `${randomUUID()}${extname(file.originalname)}`;
    await writeFile(join(uploadDir, storageKey), file.buffer);

    return {
      storageKey,
      checksum: createHash('sha256').update(file.buffer).digest('hex'),
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  validate(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    const maxBytes = this.config.get<number>('MAX_FILE_SIZE_MB', 20) * 1024 * 1024;
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(`File size exceeds ${this.config.get<number>('MAX_FILE_SIZE_MB', 20)}MB`);
    }
  }
}
