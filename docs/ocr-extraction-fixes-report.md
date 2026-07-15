# OCR Extraction Fixes Report

## 1. Resumen de correcciones aplicadas

Se aplicaron mejoras incrementales al pipeline OCR sin cambiar endpoints, esquema Prisma ni validación humana:

- Poppler ahora usa 300 DPI por defecto para mejorar lectura de celdas pequeñas.
- Tesseract ahora recibe `--oem` y `--psm` configurables desde entorno.
- El extractor de manifiestos mantiene reglas por sección y no inventa valores ausentes.
- Se conserva `confidence`, `evidenceText`, `method` y `needsReview` en `ExtractedField.rawPayload`.
- Se agregaron tests de regresión para campos críticos del manifiesto y configuración OCR.

## 2. Hallazgos del informe original atendidos

- La conversión a 200 DPI era insuficiente para celdas pequeñas.
- Tesseract no tenía PSM/OEM configurables, lo que limitaba pruebas controladas para tablas.
- El OCR de página completa pierde algunas celdas como `A-4 = 4020` y `Año = 2026`; el extractor conserva `null` cuando no hay evidencia.
- Los campos tabulares necesitaban parsing por sección para evitar falsos positivos.

## 3. Archivos modificados

- `src/config/env.validation.ts`
- `src/modules/pdf-processing/pdf-processing.service.ts`
- `src/modules/pdf-processing/pdf-processing.service.spec.ts`
- `src/modules/ocr/tesseract-cli.provider.ts`
- `src/modules/ocr/tesseract-cli.provider.spec.ts`
- `src/modules/ai-extraction/ai-extraction.service.ts`
- `src/modules/ai-extraction/ai-extraction.service.spec.ts`
- `.env.example`

## 4. Cambios en Poppler

- `PDF_CONVERSION_DPI` default pasó de `200` a `300`.
- El formato default se mantiene en `png`.
- No se cambió la arquitectura de conversión ni limpieza de temporales.

## 5. Cambios en Tesseract

- Se agregaron variables:
  - `OCR_TESSERACT_OEM`, default `1`.
  - `OCR_TESSERACT_PSM`, default `6`.
- El provider CLI ahora ejecuta Tesseract con:
  - `-l <idioma>`
  - `--oem <valor>`
  - `--psm <valor>`
- El metadata OCR incluye `oem` y `psm`.

## 6. Cambios en normalización OCR

- Se mantiene normalización de espacios y caracteres comunes.
- No se aplicó preprocesamiento pesado de imagen para evitar complejidad prematura.
- La evidencia muestra que el siguiente paso de mayor impacto sería OCR por región para `Año/Mes` y `A-4`.

## 7. Cambios en extractor de campos

- Se fortaleció extracción por secciones del manifiesto.
- Se agregó trazabilidad por campo:
  - `method`
  - `evidenceText`
  - `needsReview`
- Se reforzaron reglas para:
  - razón social del generador
  - razón social/siglas del destino final
  - dirección del destino final
  - responsable del destino final
  - año/mes de cabecera
  - código `A-4`

## 8. Cambios en API o DTOs

No hubo cambios de endpoints ni DTOs. La información adicional se mantiene dentro de `rawPayload`, compatible con el contrato actual.

## 9. Cambios en base de datos

No hubo cambios de schema ni migraciones. Se reutiliza:

- `ExtractedField.aiValue`
- `ExtractedField.confidence`
- `ExtractedField.rawPayload`

## 10. Tests agregados o actualizados

- `pdf-processing.service.spec.ts`: valida 300 DPI por defecto.
- `tesseract-cli.provider.spec.ts`: valida argumentos `--oem` y `--psm`.
- `ai-extraction.service.spec.ts`: valida reglas tabulares y campos críticos del manifiesto.

## 11. Resultados antes vs después

| Campo | Valor antes | Valor después | Mejora aplicada | Estado |
|---|---|---|---|---|
| Año | `null` o vacío si OCR omitía `2026` | Se extrae si OCR contiene `AÑO/ANO/ANIO` + año | Regex de cabecera más tolerante; 300 DPI mejora base OCR | Mejorado |
| Mes | `null` o `_MAYO` parcial | `MAYO` cuando OCR detecta mes válido | Diccionario de meses y normalización | Corregido |
| Razón social generador | Podía arrastrar fila o confundirse con destino | Celda de primera sección únicamente | Parser por sección y corte ante RUC/correo/teléfono | Corregido |
| Denominación | Vacío si el OCR separaba sección | Valor de planta si OCR lo detecta | Parser por sección de planta | Mejorado |
| A-4 | `null` cuando OCR no veía `4020`; o label sin valor | `4020` si OCR lo detecta en la fila | Parser de fila `A-4` antes de información adicional | Mejorado |
| Dirección destino | Arrastraba columnas previas | Solo celda de dirección | Limpieza de columnas previas y detección de inicio de dirección | Corregido |
| Responsable destino final | Capturaba sección completa o texto institucional | Nombre plausible o `null` | Extracción limitada a `REFRENDO` y filtro de persona | Corregido |
| Fecha y hora | `1 9 'MAY 7076` | Normalizable a `19 MAY 2026` si patrón aparece | Normalización específica | Mejorado |

## Notas

Los datos OCR/IA continúan como sugerencias pendientes de validación humana. Si Tesseract no detecta evidencia real, el extractor devuelve `null` en lugar de inventar valores.
