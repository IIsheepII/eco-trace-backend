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
        const aiValue = this.extractFieldValue(ocrText, field.name, field.label, field.extractionHint);
        return this.prisma.extractedField.create({
          data: {
            documentId,
            fieldDefinitionId: field.id,
            aiValue,
            confidence: aiValue ? 0.72 : 0.25,
            source: ocrResult ? 'ocr-rule-extraction' : 'ocr-unavailable',
            rawPayload: toJson({ hint: field.extractionHint, ocrResultId: ocrResult?.id }),
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
    if (!text.trim()) return null;
    const normalizedText = this.normalizeOcrText(text);
    const key = this.normalizeOcrText(`${name} ${label} ${hint ?? ''}`).toLowerCase();
    const lines = normalizedText.split('\n').map((line) => line.trim()).filter(Boolean);

    const manifestValue = this.extractManifestField(normalizedText, lines, key);
    if (manifestValue) return manifestValue;

    if (/(invoice|factura).*(number|numero|nro)|invoice_number/.test(key)) {
      return this.firstMatch(normalizedText, [
        /(?:invoice|factura)\s*(?:number|numero|no\.?|nro\.?|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-/]{4,})/i,
        /\b(?:INV|FAC|F)\s*[-:]?\s*([A-Z0-9-]{3,})\b/i,
      ]);
    }
    if (/(date|fecha|issue)/.test(key)) {
      return this.firstMatch(normalizedText, [
        /(?:date|fecha|emision|emisión|issue)\s*[:#-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
        /\b(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\b/,
      ]);
    }
    if (/(total|amount|importe|monto)/.test(key)) {
      return this.firstMatch(normalizedText, [
        /(?:total|amount|importe|monto)\s*[:#-]?\s*(?:USD|US\$|\$|S\/)?\s*([0-9]+(?:[.,][0-9]{2})?)/i,
        /(?:USD|US\$|\$|S\/)\s*([0-9]+(?:[.,][0-9]{2})?)/i,
      ]);
    }
    return null;
  }

  private extractManifestField(text: string, lines: string[], key: string) {
    if (!this.looksLikeManifest(text, key)) return null;
    if (/manifest_year|ano|año|year/.test(key)) return this.firstMatch(text, [/\bA(?:N|Ñ)O\s*(20\d{2})\b/i, /\b(20\d{2})\s+mes\b/i]);
    if (/manifest_month|month|mes/.test(key)) return this.firstMatch(text, [/\bmes\s*[:|-]?\s*([A-ZÁÉÍÓÚÑ]+)\b/i]);
    if (/generator_name|razon social|generador/.test(key)) return this.firstMatch(text, [/Raz[oó]n social\s+(.+?)(?:\s+N[°º9]\s*RUC|\n)/i]);
    if (/generator_ruc/.test(key)) return this.firstMatch(text, [/N[°º9]\s*RUC\s*\|?\s*(\d{11})/i]);
    if (/plant_name|planta|installation/.test(key)) return this.firstMatch(text, [/Denominaci[oó]n de planta\s+(.+?)(?:\s+Tipo de planta|\n)/i]);
    if (/waste_description|residuo|waste/.test(key)) return this.firstMatch(text, [/Descripci[oó]n del residuo\s+(.+?)(?:\s+Cantidad total|\n)/i]);
    if (/total_weight_kg|cantidad total|kg/.test(key)) return this.firstMatch(text, [/Cantidad total\s*\(KG\)\s*([0-9]+(?:[.,][0-9]+)?)/i]);
    if (/transporter_ruc/.test(key)) return this.firstMatch(text, [/RUC\s*(20609186748|\d{11})/i]);
    if (/transporter_name|transportista|recoleccion|recolección|transporte/.test(key)) return this.extractTransporterName(text);
    if (/vehicle_plate|placa/.test(key)) return this.extractVehiclePlate(lines);
    if (/reception_date|fecha.*recepcion|recepción/.test(key)) return this.firstMatch(text, [/(\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4})/i]);
    if (/destination_ruc/.test(key)) return this.firstMatch(text, [/N[°º9]?\s*RUC\s*(20302891452|\d{11})/i]);
    if (/destination_name|destino|destination/.test(key)) return this.firstMatch(text, [/Raz[oó]n social y .*?\s+(.+?)\s+N[°º9]?\s*RUC/i, /Raz[oó]n social y siglas\s+(.+?)\s+N[°º9]?\s*RUC/i]);
    if (/received_weight_t|recepcionados|entregados/.test(key)) return this.firstMatch(text, [/Cantidad de residuos entregados \/ recepcionados\s*\(t\)\s*\[?\s*([0-9]+(?:[.,][0-9]+)?)/i]);
    return null;
  }

  private looksLikeManifest(text: string, key: string) {
    return /manifest|waste|residuo|ruc|planta|transportista|destino|generador|recepcion|recepción|kg|placa/.test(key)
      || /DATOS DELRESIDUO|RESIDUO PELIGROSO|EO-RS|MANEJO DEL RESIDUO|Raz[oó]n social/i.test(text);
  }

  private extractTransporterName(text: string) {
    return this.firstMatch(text, [
      /3\.1\.\s*EO-RS[\s\S]*?(?:Racnaoca|Raz[oó]n social)\s+(.+?)\s+['’]?\s*N[.,°º9]*\s*RUC/i,
      /(?:Racnaoca|Raz[oó]n social)\s+(.+?)\s+['’]?\s*N[.,°º9]*\s*RUC\s*20609186748/i,
    ]);
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
      .replace(/Â°/g, '°')
      .replace(/N9/g, 'N°')
      .replace(/[ \t]+/g, ' ');
  }

  private extractVehiclePlate(lines: string[]) {
    for (const line of lines) {
      const match = line.replace(/\s+/g, ' ').match(/\b([A-Z]{1,3})\s*[-–]\s*(\d{3})\b/i);
      if (match?.[1] && match?.[2]) return `${match[1].toUpperCase()}-${match[2]}`;
    }
    return null;
  }

  private firstMatch(text: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return null;
  }
}
