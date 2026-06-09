import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ValidationService } from './validation.service';

describe('ValidationService', () => {
  it('blocks validation for documents outside the organisation', async () => {
    const service = new ValidationService({ document: { findFirst: jest.fn().mockResolvedValue(null) } } as never, {} as never);

    await expect(service.validateDocument(user(), 'doc-id', { fields: [] })).rejects.toThrow(NotFoundException);
  });

  it('requires at least one human validated field', async () => {
    const prisma = { document: { findFirst: jest.fn().mockResolvedValue(document()) } };
    const service = new ValidationService(prisma as never, {} as never);

    await expect(service.validateDocument(user(), 'doc-id', { fields: [] })).rejects.toThrow(BadRequestException);
  });
});

function user() {
  return { id: 'user-id', email: 'a@test.dev', organisationId: 'org-id', role: 'admin', permissions: [] };
}

function document() {
  return {
    id: 'doc-id',
    documentType: { fieldDefinitions: [{ id: 'field-id' }] },
    extractedFields: [],
  };
}
