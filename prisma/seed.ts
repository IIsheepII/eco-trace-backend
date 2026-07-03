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

  const manifestDocuments = await prisma.document.findMany({
    where: { documentTypeId: manifestType.id },
    select: { id: true },
  });
  const manifestDocumentIds = manifestDocuments.map((document) => document.id);

  if (manifestDocumentIds.length > 0) {
    await prisma.validatedField.deleteMany({ where: { documentId: { in: manifestDocumentIds } } });
    await prisma.extractedField.deleteMany({ where: { documentId: { in: manifestDocumentIds } } });
  }

  await prisma.documentFieldDefinition.deleteMany({ where: { documentTypeId: manifestType.id } });

  await prisma.documentFieldDefinition.createMany({
    data: [
      { documentTypeId: manifestType.id, name: 'manifest_year', label: 'Año', dataType: 'string', required: true, order: 1 },
      { documentTypeId: manifestType.id, name: 'manifest_month', label: 'Mes', dataType: 'string', required: true, order: 2 },
      { documentTypeId: manifestType.id, name: 'generator_razon_social', label: 'Razón social', dataType: 'string', required: true, order: 3 },
      { documentTypeId: manifestType.id, name: 'generator_ruc', label: 'N° RUC', dataType: 'string', required: true, order: 4 },
      { documentTypeId: manifestType.id, name: 'plant_denominacion', label: 'Denominación', dataType: 'string', required: true, order: 5 },
      { documentTypeId: manifestType.id, name: 'waste_total_kg', label: 'Cantidad total (kg)', dataType: 'decimal', required: true, order: 6 },
      { documentTypeId: manifestType.id, name: 'basel_a4', label: 'A-4', dataType: 'string', required: true, order: 7 },
      { documentTypeId: manifestType.id, name: 'transporter_razon_social', label: 'Razón social', dataType: 'string', required: true, order: 8 },
      { documentTypeId: manifestType.id, name: 'transporter_ruc', label: 'N° RUC', dataType: 'string', required: true, order: 9 },
      { documentTypeId: manifestType.id, name: 'transporter_registro_eo_rs', label: 'Registro EO - RS', dataType: 'string', required: true, order: 10 },
      { documentTypeId: manifestType.id, name: 'transporter_responsable_tecnico', label: 'Responsable técnico', dataType: 'string', required: true, order: 11 },
      { documentTypeId: manifestType.id, name: 'transporter_colegiatura', label: 'N° de colegiatura', dataType: 'string', required: false, order: 12 },
      { documentTypeId: manifestType.id, name: 'driver_name', label: 'Nombre del conductor', dataType: 'string', required: false, order: 13 },
      { documentTypeId: manifestType.id, name: 'vehicle_plate', label: 'N° placa del vehículo', dataType: 'string', required: false, order: 14 },
      { documentTypeId: manifestType.id, name: 'waste_reception_date', label: 'Fecha de recepción de los residuos', dataType: 'date', required: false, order: 15 },
      { documentTypeId: manifestType.id, name: 'received_quantity_t', label: 'Cantidad de residuos recibidos (t)', dataType: 'decimal', required: false, order: 16 },
      { documentTypeId: manifestType.id, name: 'destination_razon_social_siglas', label: 'Razón social y siglas', dataType: 'string', required: true, order: 17 },
      { documentTypeId: manifestType.id, name: 'destination_ruc', label: 'N° RUC', dataType: 'string', required: true, order: 18 },
      { documentTypeId: manifestType.id, name: 'destination_codigo_registro_eo_rs', label: 'Codigo de Registro EO - RS', dataType: 'string', required: true, order: 19 },
      { documentTypeId: manifestType.id, name: 'destination_address', label: 'Dirección', dataType: 'string', required: true, order: 20 },
      { documentTypeId: manifestType.id, name: 'destination_responsable_tecnico', label: 'Responsable técnico', dataType: 'string', required: true, order: 21 },
      { documentTypeId: manifestType.id, name: 'destination_responsable_name', label: 'Nombres y apellidos del responsable de la EO - RS del destino final', dataType: 'string', required: false, order: 22 },
      { documentTypeId: manifestType.id, name: 'destination_responsable_dni_ce', label: 'DNI / CE', dataType: 'string', required: false, order: 23 },
      { documentTypeId: manifestType.id, name: 'destination_fecha_hora', label: 'Fecha y hora', dataType: 'string', required: false, order: 24 },
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
