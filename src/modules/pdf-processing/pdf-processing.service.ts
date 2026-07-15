import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type PdfConversionResult = {
  imagePaths: string[];
  tempDir: string;
  pageCount: number;
  dpi: number;
  imageFormat: 'png' | 'jpeg';
  conversionTimeMs: number;
  popplerVersion?: string;
};

@Injectable()
export class PdfProcessingService {
  private readonly logger = new Logger(PdfProcessingService.name);

  constructor(private readonly config: ConfigService) {}

  isPdf(mimeType: string, filePath?: string) {
    return mimeType === 'application/pdf' || Boolean(filePath?.toLowerCase().endsWith('.pdf'));
  }

  async convertPdfToImages(pdfPath: string): Promise<PdfConversionResult> {
    const started = Date.now();
    const pageCount = await this.getPageCount(pdfPath);
    const maxPages = this.config.get<number>('PDF_MAX_PAGES', 20);
    if (pageCount < 1) throw new BadRequestException('PDF has no pages');
    if (pageCount > maxPages) throw new BadRequestException(`PDF exceeds maximum page count of ${maxPages}`);

    const tempDir = await this.createTempDir();
    const dpi = this.config.get<number>('PDF_CONVERSION_DPI', 300);
    const imageFormat = this.normalizedImageFormat();
    const outputPrefix = join(tempDir, 'page');
    const args = [`-${imageFormat}`, '-r', String(dpi), pdfPath, outputPrefix];
    const { stderr } = await this.runPoppler('pdftoppm', args, 'PDF conversion failed');
    const files = await readdir(tempDir);
    const extension = imageFormat === 'jpeg' ? /\.(jpg|jpeg)$/i : /\.png$/i;
    const imagePaths = files
      .filter((file) => extension.test(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((file) => join(tempDir, file));

    if (!imagePaths.length) {
      await this.cleanupTempDir(tempDir);
      throw new BadRequestException('PDF conversion produced no images');
    }

    const result = {
      imagePaths,
      tempDir,
      pageCount,
      dpi,
      imageFormat,
      conversionTimeMs: Date.now() - started,
      popplerVersion: await this.getPopplerVersion().catch(() => undefined),
    };
    this.logger.log(`Converted PDF to ${imagePaths.length} ${imageFormat.toUpperCase()} image(s)`);
    if (stderr?.trim()) this.logger.warn(`Poppler conversion warning: ${stderr.trim()}`);
    return result;
  }

  async cleanupTempDir(tempDir: string) {
    const cleanTempFiles = this.config.get<boolean>('OCR_CLEAN_TEMP_FILES', true);
    if (!cleanTempFiles) return false;
    const root = resolve(this.config.get<string>('OCR_TEMP_DIR', './tmp/ocr'));
    const resolvedTempDir = resolve(tempDir);
    const safeRoot = root.endsWith(sep) ? root : `${root}${sep}`;
    const systemTemp = resolve(tmpdir());
    const safeSystemTemp = systemTemp.endsWith(sep) ? systemTemp : `${systemTemp}${sep}`;
    if (!resolvedTempDir.startsWith(safeRoot) && !resolvedTempDir.startsWith(safeSystemTemp)) {
      throw new BadRequestException('Refusing to clean unsafe temp directory');
    }
    await rm(resolvedTempDir, { recursive: true, force: true });
    return true;
  }

  private async getPageCount(pdfPath: string) {
    const { stdout } = await this.runPoppler('pdfinfo', [pdfPath], 'Unable to inspect PDF');
    const match = stdout.match(/^Pages:\s+(\d+)/im);
    if (!match?.[1]) throw new BadRequestException('Unable to determine PDF page count');
    return Number(match[1]);
  }

  private async getPopplerVersion() {
    const { stdout, stderr } = await this.runPoppler('pdftoppm', ['-v'], 'Unable to read Poppler version');
    return (stdout || stderr).trim();
  }

  private async createTempDir() {
    const tempRoot = resolve(this.config.get<string>('OCR_TEMP_DIR', './tmp/ocr'));
    await mkdir(tempRoot, { recursive: true });
    return mkdtemp(join(tempRoot, 'pdf-'));
  }

  private normalizedImageFormat(): 'png' | 'jpeg' {
    const value = this.config.get<string>('PDF_CONVERSION_FORMAT', 'png').toLowerCase();
    if (value === 'jpg' || value === 'jpeg') return 'jpeg';
    return 'png';
  }

  private popplerCommand(command: 'pdftoppm' | 'pdfinfo') {
    const popplerPath = this.config.get<string>('POPPLER_PATH', '').trim();
    const executable = process.platform === 'win32' ? `${command}.exe` : command;
    return popplerPath ? join(popplerPath, executable) : command;
  }

  private async runPoppler(command: 'pdftoppm' | 'pdfinfo', args: string[], failureMessage: string) {
    try {
      return await execFileAsync(this.popplerCommand(command), args, {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : failureMessage;
      throw new ServiceUnavailableException(`${failureMessage}: ${message}`);
    }
  }
}
