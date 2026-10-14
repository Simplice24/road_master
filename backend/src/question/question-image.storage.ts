import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

/** Where uploads live on disk (served at /uploads by main.ts). Gitignored. */
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
const QUESTIONS_DIR = 'questions';

// Mirrored by the frontend image upload — keep in sync.
export const IMAGE_UPLOAD_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  types: ['image/png', 'image/jpeg', 'image/webp'],
} as const;

/** The slice of multer's file object this needs (no @types/multer in the project). */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/**
 * Detects the real format from the file's leading bytes — the client-supplied mimetype and
 * extension are never trusted. SVG is deliberately unsupported (it can carry scripts).
 */
function sniffImageType(buffer: Buffer): { ext: string; mime: string } | null {
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/**
 * Local-disk storage for question/option images. Files get random names (never the
 * client's), and URLs are absolute (PUBLIC_BASE_URL) so they satisfy the DTOs' @IsUrl and
 * work from the separately-hosted frontend.
 */
@Injectable()
export class QuestionImageStorage {
  private readonly logger = new Logger(QuestionImageStorage.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validated so a misconfigured PUBLIC_BASE_URL fails the upload with a clear message instead
   * of storing the file and returning a link the question DTOs then reject as "not a URL".
   */
  private get baseUrl() {
    const raw = (
      process.env.PUBLIC_BASE_URL?.trim() ||
      `http://localhost:${process.env.PORT ?? 3000}`
    ).replace(/\/$/, '');
    let parsed: URL | null = null;
    try {
      parsed = new URL(raw);
    } catch {
      parsed = null;
    }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
      this.logger.error(
        `PUBLIC_BASE_URL must be an absolute http(s) URL such as http://localhost:3000 (got "${raw}")`,
      );
      throw new InternalServerErrorException(
        'Image uploads are misconfigured on the server (PUBLIC_BASE_URL is not a valid URL)',
      );
    }
    return raw;
  }

  async save(file: UploadedImage | undefined): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('Attach an image file in the "file" field');
    }
    if (file.size > IMAGE_UPLOAD_LIMITS.maxBytes) {
      throw new BadRequestException('Images must be 2 MB or smaller');
    }
    const detected = sniffImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        'Only PNG, JPEG or WebP images are allowed',
      );
    }

    const baseUrl = this.baseUrl; // validate config before writing anything to disk
    const name = `${randomUUID()}.${detected.ext}`;
    await fs.mkdir(join(UPLOADS_ROOT, QUESTIONS_DIR), { recursive: true });
    await fs.writeFile(join(UPLOADS_ROOT, QUESTIONS_DIR, name), file.buffer);
    return { url: `${baseUrl}/uploads/${QUESTIONS_DIR}/${name}` };
  }

  /**
   * Best-effort cleanup after an image is replaced/removed or its question deleted: removes
   * the file only if it's one of ours and no question or option still points at it.
   */
  async deleteIfUnreferenced(
    urls: (string | null | undefined)[],
  ): Promise<void> {
    let prefix: string;
    try {
      prefix = `${this.baseUrl}/uploads/${QUESTIONS_DIR}/`;
    } catch {
      return; // misconfigured base URL (already logged) — skip cleanup, never fail the save
    }
    for (const url of new Set(urls)) {
      if (!url || !url.startsWith(prefix)) continue;
      const name = url.slice(prefix.length);
      if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(name)) continue;
      const [questions, options] = await Promise.all([
        this.prisma.question.count({ where: { imageUrl: url } }),
        this.prisma.option.count({ where: { imageUrl: url } }),
      ]);
      if (questions + options > 0) continue;
      await fs
        .unlink(join(UPLOADS_ROOT, QUESTIONS_DIR, name))
        .catch((error: unknown) => {
          this.logger.warn(`Could not delete ${name}: ${String(error)}`);
        });
    }
  }
}
