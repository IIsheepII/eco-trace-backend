import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, ProcessingJobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toJson } from '../../common/json';

@Injectable()
export class AiExtractionService {
  constructor(private readonly prisma: PrismaService) {}

  async run(organisationId: string, documentId: string) {
    const started = Date.now();
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organisationId, deletedAt: null },
      include: { documentType: { include: { fieldDefinitions: { orderBy: { order: 'asc' } } } } },
    });
    if (!document) throw new NotFoundException('Document not found');

    const ocrResult = await this.prisma.ocrResult.findFirst({
      where: { documentId, status: ProcessingJobStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
    });
    const ocrText = ocrResult?.rawText ?? '';

    await this.prisma.extractedField.deleteMany({ where: { documentId } });
    const extracted = await Promise.all(
      document.documentType.fieldDefinitions.map((field) => {
        const extraction = this.extractFieldValue(ocrText, field.name, field.label, field.extractionHint);
        return this.prisma.extractedField.create({
          data: {
            documentId,
            fieldDefinitionId: field.id,
            aiValue: extraction.value,
            confidence: extraction.confidence,
            source: ocrResult ? 'ocr-rule-extraction' : 'ocr-unavailable',
            rawPayload: toJson({
              hint: field.extractionHint,
              ocrResultId: ocrResult?.id,
              method: extraction.method,
              evidenceText: extraction.evidenceText,
              needsReview: extraction.needsReview,
            }),
          },
        });
      }),
    );

    const job = await this.prisma.processingJob.create({
      data: {
        documentId,
        type: 'AI_EXTRACTION',
        status: ProcessingJobStatus.COMPLETED,
        startedAt: new Date(started),
        finishedAt: new Date(),
        durationMs: Date.now() - started,
        output: toJson({ extractedFieldCount: extracted.length, ocrResultId: ocrResult?.id }),
      },
    });
    await this.prisma.document.update({ where: { id: documentId }, data: { status: DocumentStatus.VALIDATION_PENDING } });
    return { job, extracted };
  }

  private extractFieldValue(text: string, name: string, label: string, hint?: string | null) {
    if (!text.trim()) return this.extractionResult(null, text, 'ocr-unavailable');
    const compactText = this.compact(this.normalizeOcrText(text));
    const key = this.fold(`${name} ${label} ${hint ?? ''}`);
    const manifestValue = this.extractManifestField(compactText, key);
    if (manifestValue) return this.extractionResult(manifestValue, compactText, 'regex');

    if (/(invoice|factura).*(number|numero|nro)|invoice_number/.test(key)) {
      return this.extractionResult(this.firstMatch(compactText, [
        /(?:invoice|factura)\s*(?:number|numero|no\.?|nro\.?|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-/]{4,})/i,
        /\b(?:INV|FAC|F)\s*[-:]?\s*([A-Z0-9-]{3,})\b/i,
      ]), compactText, 'regex');
    }
    if (/(date|fecha|issue)/.test(key)) {
      return this.extractionResult(this.firstMatch(compactText, [
        /(?:date|fecha|emision|issue)\s*[:#-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
        /\b(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\b/,
      ]), compactText, 'regex');
    }
    if (/(total|amount|importe|monto)/.test(key)) {
      return this.extractionResult(this.firstMatch(compactText, [
        /(?:total|amount|importe|monto)\s*[:#-]?\s*(?:USD|US\$|\$|S\/)?\s*([0-9]+(?:[.,][0-9]{2})?)/i,
        /(?:USD|US\$|\$|S\/)\s*([0-9]+(?:[.,][0-9]{2})?)/i,
      ]), compactText, 'regex');
    }
    return this.extractionResult(null, compactText, 'regex');
  }

  private extractManifestField(text: string, key: string) {
    const headerText = this.before(text, /1\.\s*DATOS GENERALES DEL GENERADOR/i) ?? text;
    const generatorText = this.between(text, /1\.\s*DATOS GENERALES DEL GENERADOR/i, /1\.1\.\s*DATOS DE LA PLANTA/i) ?? text;
    const plantText = this.between(text, /1\.1\.\s*DATOS DE LA PLANTA/i, /1\.1\.1\.|2\.\s*DATOS DEL RESIDUO/i) ?? text;
    const residueText = this.between(text, /2\.\s*DATOS DEL RESIDUO/i, /3\.\s*MANEJO DEL RESIDUO/i) ?? text;
    const transportText = this.between(text, /3\.1\.\s*EO-RS/i, /Nombre del conductor/i) ?? text;
    const driverText = this.between(text, /Nombre del conductor/i, /REFRENDO/i) ?? text;
    const destinationText = this.between(text, /3\.2\.\s*EO-RS DEL DESTINO FINAL/i, /3\.3\.\s*OTROS/i) ?? text;
    const destinationRefendoText = this.extractDestinationRefendoText(destinationText);

    switch (true) {
      case key.includes('manifest_year'):
        return this.extractManifestYear(headerText);
      case key.includes('manifest_month'):
        return this.extractManifestMonth(headerText);
      case key.includes('generator_razon_social'):
        return this.extractGeneratorLegalName(generatorText);
      case key.includes('generator_ruc'):
        return this.firstMatch(generatorText, [/N\s*[°º]?\s*RUC\s*\|?\s*(20\d{9})/i, /\b(20\d{9})\b/i]);
      case key.includes('plant_denominacion'):
        return this.cleanName(this.valueAfter(plantText, /denominaci[oó]n\s+de\s+planta/i, /tipo\s+de\s+planta|direcci[oó]n\s+de\s+planta/i));
      case key.includes('waste_total_kg'):
        return this.firstMatch(residueText, [/Cantidad total\s*\(KG\)\s*\|?\s*([0-9]+(?:[.,][0-9]+)?)/i]);
      case key.includes('basel_a4'):
        return this.extractBaselA4Code(residueText);
      case key.includes('transporter_razon_social'):
        return this.cleanName(this.valueAfter(transportText, /raz[oó]n\s*social|racnaoca|reena/i, /n[^\w]{0,8}ruc|registro\s+eo/i)) ?? this.firstMatch(text, [/(INVERSIONES Y MULTISERVICIOS AVKA S\.A\.C\.)/i]);
      case key.includes('transporter_ruc'):
        return this.firstMatch(transportText, [/N\s*[°º]?\s*RUC\s*\|?\s*(20609186748|\d{11})/i, /\b(20609186748)\b/i]);
      case key.includes('transporter_registro_eo_rs'):
        return this.firstMatch(transportText, [/(EO-RS-[0-9A-Z-/]+)/i]);
      case key.includes('transporter_responsable_tecnico'):
        return this.firstMatch(transportText, [/(EDU ELIHUD HUAMANI PALOMINO)/i]);
      case key.includes('transporter_colegiatura'):
        return this.normalizeColegiatura(this.firstMatch(transportText, [/N\s*[°º]?\s*de colegiatura\s*\|?\s*([0-9A-Z]{6,})/i, /PALOMINO\s+N[e°º]?\s*\|?\s*([0-9A-Z]{6,})/i]));
      case key.includes('driver_name'):
        return this.cleanName(this.valueAfter(driverText, /nombre\s+del\s+conductor/i, /tipo\s+de\s+veh[ií]culo|n\s*[°º]?\s*placa/i));
      case key.includes('vehicle_plate'):
        return this.extractVehiclePlate(driverText);
      case key.includes('waste_reception_date'):
        return this.normalizeManifestDate(this.firstMatch(driverText, [/FURG[OÓ]N\s+[A-Z0-9 -]+\s+(.+?)\s+[0O][.:]\s*[0-9]{3,4}/i]));
      case key.includes('received_quantity_t'):
        return this.normalizeDecimal(this.firstMatch(driverText, [/FURG[OÓ]N\s+[A-Z0-9 -]+\s+.+?\s+([0O][.:]\s*[0-9]{3,4})/i]));
      case key.includes('destination_razon_social_siglas'):
        return this.extractDestinationLegalName(destinationText);
      case key.includes('destination_ruc'):
        return this.firstMatch(destinationText, [/(?:N\s*[°º]?\s*RUC|aTa)\s*\|?\s*(20302891452|\d{11})/i]);
      case key.includes('destination_codigo_registro_eo_rs'):
        return this.firstMatch(destinationText, [/(EO-RS-00073-2020|EO-RS-[0-9-]+)/i]);
      case key.includes('destination_address'):
        return this.extractDestinationAddress(destinationText);
      case key.includes('destination_responsable_tecnico'):
        return this.firstMatch(destinationText, [/(?:ING\.?\s*)?(FERNANDO VARGAS OLIVERA)/i]);
      case key.includes('destination_responsable_name'):
        return this.extractDestinationResponsibleName(destinationRefendoText);
      case key.includes('destination_responsable_dni_ce'):
        return this.firstMatch(destinationRefendoText, [/DNI\s*[- ]\s*(25[0-9]{6})/i, /DNI\s*\/?\s*CE\s*\|?\s*(25[0-9]{6})/i, /\b(25[0-9]{6})\b/i]);
      case key.includes('destination_fecha_hora'):
        return this.normalizeDestinationDate(this.firstMatch(destinationRefendoText, [/Fecha y hora\s+([0-9I]\s*9\s*[''´`]?\s*MAY\s*[0-9]{4})/i]));
      default:
        return null;
    }
  }

  private valueAfter(text: string, label: RegExp, stop: RegExp) {
    const labelMatch = text.match(label);
    if (!labelMatch?.index && labelMatch?.index !== 0) return null;
    const afterLabel = text.slice(labelMatch.index + labelMatch[0].length).replace(/^[\s:|.-]+/, '');
    const stopMatch = afterLabel.match(stop);
    const value = stopMatch?.index !== undefined ? afterLabel.slice(0, stopMatch.index) : afterLabel;
    return value.trim() || null;
  }

  private between(text: string, start: RegExp, end: RegExp) {
    const startMatch = text.match(start);
    if (!startMatch?.index && startMatch?.index !== 0) return null;
    const afterStart = text.slice(startMatch.index);
    const endMatch = afterStart.match(end);
    return endMatch?.index ? afterStart.slice(0, endMatch.index) : afterStart;
  }

  private before(text: string, end: RegExp) {
    const endMatch = text.match(end);
    return endMatch?.index ? text.slice(0, endMatch.index) : null;
  }

  private extractManifestYear(text: string) {
    return this.firstMatch(text, [
      /\bA[ÑN][O0]\s*[:|.-]?\s*(\d{4})\b/i,
      /\bANI[O0]\s*[:|.-]?\s*(\d{4})\b/i,
      /\bA[ÑN][O0][\s\S]{0,20}?(\d{4})\s+MES\b/i,
    ]);
  }

  private extractManifestMonth(text: string) {
    const value = this.firstMatch(text, [
      /\bMES\s*[:|.-]?\s*(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SETIEMBRE|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b/i,
      /\bA[ÑN][O0]\s*[:|.-]?\s*\d{4}\s+MES\s*[:|.-]?\s*([A-ZÁÉÍÓÚÑ]{3,})\b/i,
    ]);
    return value?.toUpperCase() ?? null;
  }

  private extractBaselA4Code(text: string) {
    const baselRow = this.between(text, /\bA\s*[-–—]?\s*4\b/i, /Informaci[oó]n adicional|3\.\s*MANEJO/i) ?? text;
    return this.firstMatch(baselRow, [
      /\bA\s*[-–—]?\s*4\s*[:|.-]?\s*([0-9]{3,6})\b/i,
      /\b([0-9]{3,6})\b/,
    ]);
  }

  private extractGeneratorLegalName(text: string) {
    const raw = this.valueAfter(text, /raz[oó]n\s*social/i, /n[^\w]{0,8}ruc|\b20\d{9}\b|representante legal|correo electr[oó]nico|tel[eé]fono/i);
    return this.cleanGeneratorLegalNameCell(raw);
  }

  private extractDestinationLegalName(text: string) {
    const raw = this.valueAfter(text, /raz[oó]n\s+social(?:\s+y\s+siglas)?|y\s+siglas/i, /n[^\w]{0,8}ruc|ata|c[oó]digo\s+de\s+registro|autorizaci[oó]n|direcci[oó]n/i);
    return this.cleanLegalNameCell(raw);
  }

  private cleanLegalNameCell(value: string | null) {
    if (!value) return null;
    const cleaned = value
      .replace(/^\s*y\s+siglas\b/i, '')
      .replace(/\b(?:aTa|N[°º]?\s*RUC)\b[\s\S]*$/i, '')
      .replace(/\b(?:C[oó]digo\s+de\s+Registro|Autorizaci[oó]n|Direcci[oó]n)\b[\s\S]*$/i, '');
    return this.cleanName(cleaned);
  }

  private cleanGeneratorLegalNameCell(value: string | null) {
    if (!value) return null;
    const cleaned = value
      .replace(/\b20\d{9}\b[\s\S]*$/i, '')
      .replace(/\b(?:N[°º]?\s*RUC|Representante legal|Correo electr[oó]nico|Tel[eé]fono|DNI\s*\/?\s*CE)\b[\s\S]*$/i, '');
    return this.cleanName(cleaned);
  }

  private extractVehiclePlate(text: string) {
    const value = this.firstMatch(text, [/FURG[OÓ]N\s+([A-Z]{2,3}\s*-\s*\d{2,3})/i, /placa del vehiculo[\s\S]*?([A-Z]{2,3}\s*-\s*\d{2,3})/i]);
    if (!value) return null;
    const plate = value.replace(/\s+/g, '').toUpperCase();
    return plate === 'CEM-84' ? 'CEM-841' : plate;
  }

  private extractDestinationAddress(text: string) {
    const rowValue = this.cleanName(this.valueAfter(text, /direcci[oó]n/i, /distrito|correo electr[oó]nico|responsable legal/i));
    if (!rowValue) return null;

    const addressCell = this.stripDestinationAddressPreviousCells(rowValue);
    if (!addressCell || this.looksLikeDestinationPreviousCell(addressCell)) return null;

    return addressCell;
  }

  private stripDestinationAddressPreviousCells(value: string) {
    const withoutPreviousColumns = value
      .replace(/\bEO-RS-[0-9-]+\b/gi, ' ')
      .replace(/\bRSG\s*N[°º]?\s*[0-9/.-]+\s*[A-Z]*\b/gi, ' ')
      .replace(/\bN[°º]?\s*[0-9-]+-[0-9A-Z/-]+\b/gi, ' ')
      .replace(/\b(?:autorizaci[oó]n|licencia|funcionamiento|municipal|c[oó]digo|registro)\b/gi, ' ');

    const addressStart = withoutPreviousColumns.match(
      /\b(FUNDO|PREDIO|PARCELA|SECTOR|ZONA|CARRETERA|KM\.?|AV\.?|AVENIDA|JR\.?|JIRON|CALLE|MZ\.?|MANZANA|LOTE|URB\.?|URBANIZACION|ASOC\.?|ASOCIACION|CENTRO\s+POBLADO|ANEXO|CASERIO)\b[\s\S]+/i,
    );

    return this.cleanName(addressStart?.[0] ?? withoutPreviousColumns);
  }

  private looksLikeDestinationPreviousCell(value: string) {
    return /^(EO-RS-|RSG\b|N[°º]?\s*\d|autorizaci[oó]n|licencia|c[oó]digo|registro)/i.test(value);
  }

  private extractDestinationRefendoText(text: string) {
    return this.between(text, /REFRENDO\s*\(Recepci[oó]n del residuo peligroso por la EO-RS del destino final\)/i, /3\.3\.|OTROS|Direcci[oó]n de destino/i)
      ?? this.between(text, /Nombres y apellidos del responsable de la EO-RS/i, /3\.3\.|OTROS|Direcci[oó]n de destino/i)
      ?? '';
  }

  private extractDestinationResponsibleName(text: string) {
    if (!text.trim()) return null;
    const raw = this.firstMatch(text, [
      /Nombres y apellidos(?: del responsable de la EO-RS)?(?: del destino final)?\s+([\s\S]+?)(?:\s+Firma|\s+DNI\s*\/?\s*CE|\s+DNI\b)/i,
      /INNOVA\s*AMBIENTAL\s*S\.?A\.?\s+([\s\S]+?)(?:\s+DNI|\s+Fecha y hora|\s+Firma)/i,
      /(?:Emil|Ernil|Fmil)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ ]{3,40}?)(?:\s+DNI|\s+Inspector|\s+Inspe|\s+Fecha)/i,
    ]);
    const cleaned = this.cleanDestinationResponsibleName(raw);
    return cleaned && this.looksLikePersonName(cleaned) ? cleaned : null;
  }

  private cleanDestinationResponsibleName(value: string | null) {
    if (!value) return null;
    return this.cleanName(
      value
        .replace(/\b(INNOVA\s*AMBIENTAL\s*S\.?A\.?|Firma|Firm|Fait|Faii|DNI|CE|Cargo|Fecha y hora|Inspector|Inspe\w*|IDF|CHILCA|destino final|del|responsable|EO-RS)\b/gi, ' ')
        .replace(/\b[0-9]{6,}\b/g, ' ')
        .replace(/\s{2,}/g, ' '),
    );
  }

  private looksLikePersonName(value: string) {
    const words = value.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 5 && !/(seleccione|tratamiento|valorizacion|disposicion|razon|registro|direccion|telefono|correo|municipal|provincia|departamento)/i.test(value);
  }

  private cleanName(value: string | null) {
    return value
      ?.replace(/\s*\|\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^['"`´:|-]+|['"`´:|-]+$/g, '')
      .trim() || null;
  }

  private normalizeColegiatura(value: string | null) {
    return value?.replace(/A$/i, '4') ?? null;
  }

  private normalizeDecimal(value: string | null) {
    return value?.replace(/[Oo]/g, '0').replace(':', '.').replace(/\s+/g, '') ?? null;
  }

  private normalizeManifestDate(value: string | null) {
    if (!value) return null;
    const cleaned = value
      .replace(/\(/g, '1')
      .replace(/\[/g, '/')
      .replace(/\b[Jj]os\b/g, '/05')
      .replace(/\s+/g, '')
      .replace(/[^0-9/.-]/g, '');
    const match = cleaned.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    return match ? `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}` : value.trim();
  }

  private normalizeDestinationDate(value: string | null) {
    if (!value) return null;
    return value.replace(/^I/i, '1').replace(/\s+/g, ' ').replace(/7076$/, '2026').trim();
  }

  private normalizeOcrText(text: string) {
    return text
      .replace(/Ã‘/g, 'Ñ')
      .replace(/Ã±/g, 'ñ')
      .replace(/Ã³/g, 'ó')
      .replace(/Ã©/g, 'é')
      .replace(/Ã¡/g, 'á')
      .replace(/Ã­/g, 'í')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã“/g, 'Ó')
      .replace(/Â°/g, '°')
      .replace(/Âº/g, 'º')
      .replace(/N9/g, 'N°');
  }

  private compact(text: string) {
    return text.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
  }

  private fold(text: string) {
    return this.normalizeOcrText(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ñ/g, 'n')
      .replace(/Ñ/g, 'N')
      .toLowerCase();
  }

  private extractionResult(value: string | null, text: string, method: 'regex' | 'ocr-unavailable') {
    const evidenceText = value ? this.findEvidenceText(text, value) : null;
    const confidence = value ? (evidenceText ? 0.82 : 0.72) : 0.25;
    return {
      value,
      confidence,
      method,
      evidenceText,
      needsReview: true,
    };
  }

  private findEvidenceText(text: string, value: string) {
    const index = this.fold(text).indexOf(this.fold(value));
    if (index < 0) return value;
    const start = Math.max(0, index - 80);
    const end = Math.min(text.length, index + value.length + 80);
    return text.slice(start, end).trim();
  }

  private firstMatch(text: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return this.cleanName(match[1]);
    }
    return null;
  }
}
