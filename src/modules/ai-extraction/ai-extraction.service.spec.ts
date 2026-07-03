import { DocumentStatus, ProcessingJobStatus } from '@prisma/client';
import { AiExtractionService } from './ai-extraction.service';

describe('AiExtractionService', () => {
  const manifestFields = [
    { id: 'field-year', name: 'manifest_year', label: 'Manifest Year', extractionHint: null },
    { id: 'field-month', name: 'manifest_month', label: 'Manifest Month', extractionHint: null },
    { id: 'field-generator', name: 'generator_name', label: 'Generator Name', extractionHint: null },
    { id: 'field-ruc', name: 'generator_ruc', label: 'Generator RUC', extractionHint: null },
    { id: 'field-plant', name: 'plant_name', label: 'Plant / Installation', extractionHint: null },
    { id: 'field-waste', name: 'waste_description', label: 'Waste Description', extractionHint: null },
    { id: 'field-weight', name: 'total_weight_kg', label: 'Total Weight (KG)', extractionHint: null },
    { id: 'field-transporter', name: 'transporter_name', label: 'Transporter', extractionHint: null },
    { id: 'field-transporter-ruc', name: 'transporter_ruc', label: 'Transporter RUC', extractionHint: null },
    { id: 'field-plate', name: 'vehicle_plate', label: 'Vehicle Plate', extractionHint: null },
    { id: 'field-date', name: 'reception_date', label: 'Reception Date', extractionHint: null },
    { id: 'field-destination', name: 'destination_name', label: 'Destination EO-RS', extractionHint: null },
    { id: 'field-destination-ruc', name: 'destination_ruc', label: 'Destination RUC', extractionHint: null },
    { id: 'field-received', name: 'received_weight_t', label: 'Received Weight (t)', extractionHint: null },
  ];

  const manifestOcrText = `
--- Page 1 ---
AÑO 2026 mes MAYO
Razón social UNIDAD EJECUTORA SALUD SUR AYACUCHO
N° RUC | 20452222419
Denominación de planta HOSPITAL DE APOYO DE PUQUIO FELIPE HUAMAN POMA DE AYALA Tipo de planta: ESTABLECIMIENTO DE SALUD
Descripción del residuo RESIDUOS HOSPITALARIOS Cantidad total (KG) 312.00
3.1. EO-RS DE RECOLECCIÓN Y TRANSPORTE
Racnaoca INVERSIONES Y MULTISERVICIOS AVKA S.A.C. 'N., RUC 20609186748

--- Page 2 ---
N° placa del vehículo Fecha de recepción de los residuos Cantidad de residuos recibidos (t)
FURGON XP - 791 20 /05 /26 O. 27
3.2. EO-RS DEL DESTINO FINAL
Razón social y siglas INNOVA AMBIENTAL S.A. N° RUC 20302891452
Cantidad de residuos entregados / recepcionados (t)
[0.270
`;

  function setup() {
    const createdFields: Array<{ fieldDefinitionId: string; aiValue: string | null }> = [];
    const prisma = {
      document: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'doc-1',
          documentType: {
            fieldDefinitions: manifestFields,
          },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      ocrResult: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ocr-1',
          rawText: manifestOcrText,
          status: ProcessingJobStatus.COMPLETED,
        }),
      },
      extractedField: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }) => {
          createdFields.push({ fieldDefinitionId: data.fieldDefinitionId, aiValue: data.aiValue });
          return Promise.resolve({ id: `extracted-${data.fieldDefinitionId}`, ...data });
        }),
      },
      processingJob: {
        create: jest.fn().mockResolvedValue({ id: 'ai-job', status: ProcessingJobStatus.COMPLETED }),
      },
    };
    return { service: new AiExtractionService(prisma as never), prisma, createdFields };
  }

  it('extracts manifest fields from OCR text across pages', async () => {
    const { service, createdFields, prisma } = setup();

    await service.run('org-1', 'doc-1');

    const values = new Map(createdFields.map((field) => [field.fieldDefinitionId, field.aiValue]));
    expect(values.get('field-year')).toBe('2026');
    expect(values.get('field-month')).toBe('MAYO');
    expect(values.get('field-generator')).toBe('UNIDAD EJECUTORA SALUD SUR AYACUCHO');
    expect(values.get('field-ruc')).toBe('20452222419');
    expect(values.get('field-plant')).toContain('HOSPITAL DE APOYO DE PUQUIO');
    expect(values.get('field-waste')).toBe('RESIDUOS HOSPITALARIOS');
    expect(values.get('field-weight')).toBe('312.00');
    expect(values.get('field-transporter')).toBe('INVERSIONES Y MULTISERVICIOS AVKA S.A.C.');
    expect(values.get('field-transporter-ruc')).toBe('20609186748');
    expect(values.get('field-plate')).toBe('XP-791');
    expect(values.get('field-date')).toBe('20 /05 /26');
    expect(values.get('field-destination')).toBe('INNOVA AMBIENTAL S.A.');
    expect(values.get('field-destination-ruc')).toBe('20302891452');
    expect(values.get('field-received')).toBe('0.270');
    expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 'doc-1' }, data: { status: DocumentStatus.VALIDATION_PENDING } });
  });
});
