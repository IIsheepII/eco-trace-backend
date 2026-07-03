-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'OCR_FAILED';

-- CreateTable
CREATE TABLE "OcrResult" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "processingJobId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "characterCount" INTEGER NOT NULL,
    "processingTimeMs" INTEGER NOT NULL,
    "status" "ProcessingJobStatus" NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcrResult_documentId_idx" ON "OcrResult"("documentId");

-- CreateIndex
CREATE INDEX "OcrResult_processingJobId_idx" ON "OcrResult"("processingJobId");

-- AddForeignKey
ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_processingJobId_fkey" FOREIGN KEY ("processingJobId") REFERENCES "ProcessingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
