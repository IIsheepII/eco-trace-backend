import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const organisation = await prisma.organisation.upsert({
    where: { taxId: 'DEMO-ORG' },
    update: {},
    create: { name: 'Demo Organisation', taxId: 'DEMO-ORG' },
  });

  const adminRole = await prisma.role.upsert({
    where: { name_organisationId: { name: 'admin', organisationId: organisation.id } },
    update: {},
    create: {
      name: 'admin',
      organisationId: organisation.id,
      permissions: [
        'users:manage',
        'roles:manage',
        'organisations:manage',
        'documents:manage',
        'documents:validate',
        'reports:read',
        'settings:manage',
      ],
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@eco-trace.local' },
    update: {},
    create: {
      email: 'admin@eco-trace.local',
      fullName: 'Eco Trace Admin',
      passwordHash: await argon2.hash('Admin123!'),
      organisationId: organisation.id,
      roleId: adminRole.id,
    },
  });

  const invoiceType = await prisma.documentType.upsert({
    where: { code: 'INVOICE' },
    update: {},
    create: {
      code: 'INVOICE',
      name: 'Invoice',
      description: 'Supplier invoice with fiscal and payment fields.',
    },
  });

  await prisma.documentFieldDefinition.createMany({
    data: [
      { documentTypeId: invoiceType.id, name: 'invoice_number', label: 'Invoice Number', dataType: 'string', required: true, order: 1 },
      { documentTypeId: invoiceType.id, name: 'issue_date', label: 'Issue Date', dataType: 'date', required: true, order: 2 },
      { documentTypeId: invoiceType.id, name: 'total_amount', label: 'Total Amount', dataType: 'decimal', required: true, order: 3 },
    ],
    skipDuplicates: true,
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
