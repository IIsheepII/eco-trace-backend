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

  const manifestType = await prisma.documentType.upsert({
    where: { code: 'MANIFEST' },
    update: {},
    create: {
      code: 'MANIFEST',
      name: 'Hazardous Waste Manifest',
      description: 'Hazardous solid waste manifest with generator, transport, residue and destination sections.',
    },
  });

  await prisma.documentFieldDefinition.createMany({
    data: [
      { documentTypeId: manifestType.id, name: 'manifest_year', label: 'Manifest Year', dataType: 'string', required: true, order: 1 },
      { documentTypeId: manifestType.id, name: 'manifest_month', label: 'Manifest Month', dataType: 'string', required: true, order: 2 },
      { documentTypeId: manifestType.id, name: 'generator_name', label: 'Generator Name', dataType: 'string', required: true, order: 3 },
      { documentTypeId: manifestType.id, name: 'generator_ruc', label: 'Generator RUC', dataType: 'string', required: true, order: 4 },
      { documentTypeId: manifestType.id, name: 'plant_name', label: 'Plant / Installation', dataType: 'string', required: false, order: 5 },
      { documentTypeId: manifestType.id, name: 'waste_description', label: 'Waste Description', dataType: 'string', required: true, order: 6 },
      { documentTypeId: manifestType.id, name: 'total_weight_kg', label: 'Total Weight (KG)', dataType: 'decimal', required: true, order: 7 },
      { documentTypeId: manifestType.id, name: 'transporter_name', label: 'Transporter', dataType: 'string', required: true, order: 8 },
      { documentTypeId: manifestType.id, name: 'transporter_ruc', label: 'Transporter RUC', dataType: 'string', required: true, order: 9 },
      { documentTypeId: manifestType.id, name: 'vehicle_plate', label: 'Vehicle Plate', dataType: 'string', required: false, order: 10 },
      { documentTypeId: manifestType.id, name: 'reception_date', label: 'Reception Date', dataType: 'date', required: false, order: 11 },
      { documentTypeId: manifestType.id, name: 'destination_name', label: 'Destination EO-RS', dataType: 'string', required: true, order: 12 },
      { documentTypeId: manifestType.id, name: 'destination_ruc', label: 'Destination RUC', dataType: 'string', required: true, order: 13 },
      { documentTypeId: manifestType.id, name: 'received_weight_t', label: 'Received Weight (t)', dataType: 'decimal', required: false, order: 14 },
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
