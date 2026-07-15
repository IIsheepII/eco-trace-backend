import { DocumentStatus, ProcessingJobStatus } from '@prisma/client';
import { AiExtractionService } from './ai-extraction.service';

describe('AiExtractionService', () => {
  const manifestFields = [
    { id: 'field-year', name: 'manifest_year', label: 'Anio', extractionHint: null },
    { id: 'field-month', name: 'manifest_month', label: 'Mes', extractionHint: null },
    { id: 'field-generator-name', name: 'generator_razon_social', label: 'Generador - Razon Social', extractionHint: null },
    { id: 'field-generator-ruc', name: 'generator_ruc', label: 'Generador - N RUC', extractionHint: null },
    { id: 'field-plant', name: 'plant_denominacion', label: 'Denominacion de la planta', extractionHint: null },
    { id: 'field-total-kg', name: 'waste_total_kg', label: 'Cantidad total (kg)', extractionHint: null },
    { id: 'field-a4', name: 'basel_a4', label: 'A-4', extractionHint: null },
    { id: 'field-transporter-name', name: 'transporter_razon_social', label: 'Transportista - Razon Social', extractionHint: null },
    { id: 'field-transporter-ruc', name: 'transporter_ruc', label: 'Transportista - N RUC', extractionHint: null },
    { id: 'field-transporter-registry', name: 'transporter_registro_eo_rs', label: 'Transportista - Registro EO - RS', extractionHint: null },
    { id: 'field-transporter-tech', name: 'transporter_responsable_tecnico', label: 'Transportista - Responsable tecnico', extractionHint: null },
    { id: 'field-transporter-license', name: 'transporter_colegiatura', label: 'Transportista - N de colegiatura', extractionHint: null },
    { id: 'field-driver', name: 'driver_name', label: 'Nombre del conductor', extractionHint: null },
    { id: 'field-plate', name: 'vehicle_plate', label: 'N placa del vehiculo', extractionHint: null },
    { id: 'field-reception-date', name: 'waste_reception_date', label: 'Fecha de recepcion de los residuos', extractionHint: null },
    { id: 'field-received-t', name: 'received_quantity_t', label: 'Cantidad de residuos recibidos (t)', extractionHint: null },
    { id: 'field-destination-name', name: 'destination_razon_social_siglas', label: 'Destino final - Razon social y siglas', extractionHint: null },
    { id: 'field-destination-ruc', name: 'destination_ruc', label: 'Destino final - N RUC', extractionHint: null },
    { id: 'field-destination-registry', name: 'destination_codigo_registro_eo_rs', label: 'Destino final - Codigo de Registro EO - RS', extractionHint: null },
    { id: 'field-destination-address', name: 'destination_address', label: 'Destino final - Direccion', extractionHint: null },
    { id: 'field-destination-tech', name: 'destination_responsable_tecnico', label: 'Destino final - Responsable tecnico', extractionHint: null },
    { id: 'field-destination-responsible', name: 'destination_responsable_name', label: 'Responsable destino final', extractionHint: null },
    { id: 'field-destination-dni', name: 'destination_responsable_dni_ce', label: 'Destino final responsable - DNI / CE', extractionHint: null },
    { id: 'field-destination-date', name: 'destination_fecha_hora', label: 'Destino final - Fecha y hora', extractionHint: null },
  ];

  const manifestOcrText = `
--- Page 1 ---
ANO 2026 mes MAYO
1. DATOS GENERALES DEL GENERADOR
Razon social UNIDAD EJECUTORA SALUD SUR AYACUCHO N RUC | 20452222419
Denominacion de planta HOSPITAL DE APOYO DE PUQUIO FELIPE HUAMAN POMA DE AYALA Tipo de planta: ESTABLECIMIENTO DE SALUD
Descripcion del residuo RESIDUOS HOSPITALARIOS Cantidad total (KG) 259.20
A-4 4020 Informacion adicional del residuo
3.1. EO-RS DE RECOLECCION Y TRANSPORTE
Racnaoca INVERSIONES Y MULTISERVICIOS AVKA S.A.C. 'N., RUC 20609186748
EO-RS-00045-2025-MINAM/VMGA/DGGRS N 057-2024-MDC
RE ON EDU ELIHUD HUAMANI PALOMINO Ne |7302432A

--- Page 2 ---
Nombre del conductor Freda Hamcille Came h ey. Tipo de vehiculo N placa del vehiculo Fecha de recepcion de los residuos Cantidad de residuos recibidos (t)
FURGON CEM-84 (4 Jos [26 O: 2592
3.2. EO-RS DEL DESTINO FINAL
Razon social y siglas | INNOVA AMBIENTAL S.A. aTa 20302891452
Codigo de Registro EO-RS Autorizacion o licencia de funcionamiento municipal Direccion EO-RS-00073-2020 RSG N°04/2019MDCH FUNDO PIEDRAS BLANCAS SECTOR SANTA ROSA ZONA QUEBRADA PARCA KM 18 DE CARRETERA SANTO DOMINGO OLLEROS ANTL. KM 62.5 Distrito Chilca
aO ee ING. FERNANDO VARGAS OLIVERA N de colegiatura | 87851
Cantidad de residuos entregados / recepcionados (t) O. 2542
REFRENDO (Recepcion del residuo peligroso por la EO-RS del destino final)
Nombres y apellidos del responsable de la EO-RS del destino final Fait Bustos Garo DNI - 25743592
Fecha y hora 1 9 'MAY 7076
`;

  const manifestBOcrText = `
MANIFIESTO DE MANEJO DE RESIDUOS SÓLIDOS PELIGROSOS AÑO 2026 MES ABRIL
1. DATOS GENERALES DEL GENERADOR (Corresponde a ser llenado por el generador de residuos sólidos peligrosos)
UNIDAD EJECUTORA 405 RED DE SALUD ANGARAES
Representante legal ARANGO ARENALES HARRY ALBERTO DNI / CE 40600861
1.1. DATOS DE LA PLANTA/INSTALACIÓN (Fuente de Generación)
Denominación de planta HOSPITAL DE LIRCAY Tipo de planta: HOSPITAL
2. DATOS DEL RESIDUO PELIGROSO MANEJADO
Descripción del residuo RESIDUOS HOSPITALARIOS Cantidad total (KG) 2,349.30
A4: Residuos que pueden contener constituyentes inorgánicos u orgánicos
Sub Código según el Convenio de Basilea (Llenar de acuerdo al código de clasificación marcado)
4020 - E - 3
Información adicional del residuo, de considerarlo:
3.1. EO-RS DE RECOLECCIÓN Y TRANSPORTE
INVERSIONES Y MULTISERVICIOS AVKA S.A.C. N° RUC 20609186748
Registro EO - RS Autorización o licencia de funcionamiento municipal Documento que autoriza la ruta
EO-RS-00045-2025-MINAM/VMGA/DGGRS N° 057-2024-MDC N° 3089-2025-MTC/17.02
Responsable técnico EDU ELIHUD HUAMANI PALOMINO N° de colegiatura 34089
Nombre del conductor + C0 Hana l tu an art
Tipo de vehiculo N° placa del vehiculo Fecha de recepción de los residuos Cantidad de residuos recibidos (t)
COMBINE: SS eS
Nombre del conductor Fredy Mancil la (a achert
Cantidad de residuos recibidos (t)
Tipo de vehículo
N° placa del vehículo
Fecha Ide recepción de los residuos
FURGÓN
27. 04.26
2.3413
CE ASYI
REFRENDO (Entrega del residuo peligroso a la EO-RS de recolección y transporte)
3.2. EO-RS DEL DESTINO FINAL
Razón social y siglas INNOVA AMBIENTAL S.A. Ne RUC 20302891452
Código de Regisiro EO-RS Autorización o licencia de funcionamiento municipal
EO-RS-00073-2020 RSG N°04/2019MDCH FUNDO PIEDRAS BLANCAS SECTOR SANTA ROSA ZONA
QUEBRADA PARCA (KM 18 DE CARRETERA SANTO
DOMINGO OLLEROS ANTL. KM 62.5
Representante legal MARCELO SOCOOWSKI AZEVEDO DNI / CE 005427570
Responsable fécnico ING. FERNANDO VARGAS OLIVERA N° de colegiatura 87851
REFRENDO (Recepción del residuo peligroso por la EO-RS del destino final)
Nombres y apellidos del responsable de la EO-RS Ea all Oy 2775 SENTI
destino final Disnrda Cáceres Barreto AI. NO Lo
3.3. OTROS
`;

  function setup(ocrText = manifestOcrText) {
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
          rawText: ocrText,
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

  it('extracts the company manifest schema from OCR text across pages', async () => {
    const { service, createdFields, prisma } = setup();

    await service.run('org-1', 'doc-1');

    const values = new Map(createdFields.map((field) => [field.fieldDefinitionId, field.aiValue]));
    expect(values.get('field-year')).toBe('2026');
    expect(values.get('field-month')).toBe('MAYO');
    expect(values.get('field-generator-name')).toBe('UNIDAD EJECUTORA SALUD SUR AYACUCHO');
    expect(values.get('field-generator-ruc')).toBe('20452222419');
    expect(values.get('field-plant')).toContain('HOSPITAL DE APOYO DE PUQUIO');
    expect(values.get('field-total-kg')).toBe('259.20');
    expect(values.get('field-a4')).toBe('4020');
    expect(values.get('field-transporter-name')).toBe('INVERSIONES Y MULTISERVICIOS AVKA S.A.C.');
    expect(values.get('field-transporter-ruc')).toBe('20609186748');
    expect(values.get('field-transporter-registry')).toBe('EO-RS-00045-2025-MINAM/VMGA/DGGRS');
    expect(values.get('field-transporter-tech')).toBe('EDU ELIHUD HUAMANI PALOMINO');
    expect(values.get('field-transporter-license')).toBe('73024324');
    expect(values.get('field-driver')).toBe('Freda Hamcille Came h ey.');
    expect(values.get('field-plate')).toBe('CEM-841');
    expect(values.get('field-reception-date')).toBe('14/05/26');
    expect(values.get('field-received-t')).toBe('0.2592');
    expect(values.get('field-destination-name')).toBe('INNOVA AMBIENTAL S.A.');
    expect(values.get('field-destination-ruc')).toBe('20302891452');
    expect(values.get('field-destination-registry')).toBe('EO-RS-00073-2020');
    expect(values.get('field-destination-address')).toBe('FUNDO PIEDRAS BLANCAS SECTOR SANTA ROSA ZONA QUEBRADA PARCA KM 18 DE CARRETERA SANTO DOMINGO OLLEROS ANTL. KM 62.5');
    expect(values.get('field-destination-tech')).toBe('FERNANDO VARGAS OLIVERA');
    expect(values.get('field-destination-responsible')).toBe('Bustos Garo');
    expect(values.get('field-destination-dni')).toBe('25743592');
    expect(values.get('field-destination-date')).toBe("1 9 'MAY 2026");
    expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 'doc-1' }, data: { status: DocumentStatus.VALIDATION_PENDING } });
  });

  it('extracts destination address from the address cell without depending on a fixed place name', async () => {
    const ocrText = manifestOcrText.replace(
      'FUNDO PIEDRAS BLANCAS SECTOR SANTA ROSA ZONA QUEBRADA PARCA KM 18 DE CARRETERA SANTO DOMINGO OLLEROS ANTL. KM 62.5',
      'PREDIO SAN JOSE PARCELA 12 CARRETERA CENTRAL KM 8.5',
    );
    const { service, createdFields } = setup(ocrText);

    await service.run('org-1', 'doc-1');

    const values = new Map(createdFields.map((field) => [field.fieldDefinitionId, field.aiValue]));
    expect(values.get('field-destination-address')).toBe('PREDIO SAN JOSE PARCELA 12 CARRETERA CENTRAL KM 8.5');
  });

  it('extracts destination legal name from only its table cell', async () => {
    const ocrText = manifestOcrText.replace(
      'Razon social y siglas | INNOVA AMBIENTAL S.A. aTa 20302891452',
      'Razon social y siglas INNOVA AMBIENTAL S.A. aTa 20302891452 Código de Registro EO-RS',
    );
    const { service, createdFields } = setup(ocrText);

    await service.run('org-1', 'doc-1');

    const values = new Map(createdFields.map((field) => [field.fieldDefinitionId, field.aiValue]));
    expect(values.get('field-destination-name')).toBe('INNOVA AMBIENTAL S.A.');
  });

  it('extracts generator legal name from the first section table cell only', async () => {
    const ocrText = manifestOcrText.replace(
      'Razon social UNIDAD EJECUTORA SALUD SUR AYACUCHO N RUC | 20452222419',
      'Razon social UNIDAD EJECUTORA SALUD SUR AYACUCHO 20452222419 Correo electronico efraimalvarol7@hotmail.com Telefono 988803160',
    );
    const { service, createdFields } = setup(ocrText);

    await service.run('org-1', 'doc-1');

    const values = new Map(createdFields.map((field) => [field.fieldDefinitionId, field.aiValue]));
    expect(values.get('field-generator-name')).toBe('UNIDAD EJECUTORA SALUD SUR AYACUCHO');
  });

  it('leaves destination responsible name blank when the refendo stamp text is not a plausible person name', async () => {
    const ocrText = manifestOcrText.replace(
      'Nombres y apellidos del responsable de la EO-RS del destino final Fait Bustos Garo DNI - 25743592',
      'Nombres y apellidos del responsable de la EO-RS del destino final INNOVA AMBIENTAL SA Inspector IDF CHILCA DNI - 25743592',
    );
    const { service, createdFields } = setup(ocrText);

    await service.run('org-1', 'doc-1');

    const values = new Map(createdFields.map((field) => [field.fieldDefinitionId, field.aiValue]));
    expect(values.get('field-destination-responsible')).toBeNull();
  });

  it('extracts year and month from the top header even with OCR separators', async () => {
    const ocrText = manifestOcrText.replace(
      'ANO 2026 mes MAYO',
      'MANIFIESTO DE MANEJO DE RESIDUOS SOLIDOS PELIGROSOS AÑO | 2026 MES | MAYO',
    );
    const { service, createdFields } = setup(ocrText);

    await service.run('org-1', 'doc-1');

    const values = new Map(createdFields.map((field) => [field.fieldDefinitionId, field.aiValue]));
    expect(values.get('field-year')).toBe('2026');
    expect(values.get('field-month')).toBe('MAYO');
  });

  it('extracts A-4 code from its table cell before additional information', async () => {
    const ocrText = manifestOcrText.replace(
      'A-4 4020 Informacion adicional del residuo',
      'Sub Codigo segun el Convenio de Basilea A - 4 | 4020 Informacion adicional del residuo, de considerarlo',
    );
    const { service, createdFields } = setup(ocrText);

    await service.run('org-1', 'doc-1');

    const values = new Map(createdFields.map((field) => [field.fieldDefinitionId, field.aiValue]));
    expect(values.get('field-a4')).toBe('4020');
  });

  it('keeps manifest-b section values stable when OCR omits labels or reads table headers imperfectly', async () => {
    const { service, createdFields } = setup(manifestBOcrText);

    await service.run('org-1', 'doc-1');

    const values = new Map(createdFields.map((field) => [field.fieldDefinitionId, field.aiValue]));
    expect(values.get('field-year')).toBe('2026');
    expect(values.get('field-month')).toBe('ABRIL');
    expect(values.get('field-generator-name')).toBe('UNIDAD EJECUTORA 405 RED DE SALUD ANGARAES');
    expect(values.get('field-plant')).toBe('HOSPITAL DE LIRCAY');
    expect(values.get('field-total-kg')).toBe('2,349.30');
    expect(values.get('field-a4')).toBe('4020');
    expect(values.get('field-transporter-license')).toBe('34089');
    expect(values.get('field-driver')).toBe('Fredy Mancil la a achert');
    expect(values.get('field-reception-date')).toBe('27/04/26');
    expect(values.get('field-received-t')).toBe('2.3413');
    expect(values.get('field-destination-name')).toBe('INNOVA AMBIENTAL S.A.');
    expect(values.get('field-destination-ruc')).toBe('20302891452');
    expect(values.get('field-destination-address')).toBe('FUNDO PIEDRAS BLANCAS SECTOR SANTA ROSA ZONA QUEBRADA PARCA (KM 18 DE CARRETERA SANTO DOMINGO OLLEROS ANTL. KM 62.5');
  });
});
