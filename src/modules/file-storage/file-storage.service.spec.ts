import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterFile } from '../../common/types/multer-file.type';
import { FileStorageService } from './file-storage.service';

describe('FileStorageService', () => {
  const service = new FileStorageService({ get: jest.fn().mockReturnValue(1) } as unknown as ConfigService);

  it('rejects unsupported file types', () => {
    expect(() => service.validate(file({ mimetype: 'text/plain' }))).toThrow(BadRequestException);
  });

  it('rejects files over configured size', () => {
    expect(() => service.validate(file({ size: 2 * 1024 * 1024 }))).toThrow(BadRequestException);
  });

  it('accepts supported files within size limits', () => {
    expect(() => service.validate(file())).not.toThrow();
  });
});

function file(overrides: Partial<MulterFile> = {}): MulterFile {
  return {
    fieldname: 'file',
    originalname: 'invoice.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('pdf'),
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}
