-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'LOCKED');

-- CreateEnum
CREATE TYPE "FormTemplateType" AS ENUM ('REGISTRATION', 'ACKNOWLEDGMENT', 'DELIVERABLES_TABLE', 'DOCUMENT_UPLOAD');

-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "AgreementFieldType" AS ENUM ('SIGNATURE', 'CHECKBOX', 'DATE', 'TEXT', 'DROPDOWN');

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "address" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "department" TEXT,
    "academicYear" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "inductionDeadline" TIMESTAMP(3),
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "regNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "mobile" TEXT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustResetPassword" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "photoUrl" TEXT,
    "gender" TEXT,
    "aadhaarNumber" TEXT,
    "accommodation" TEXT,
    "transportRequired" BOOLEAN,
    "boardingPoint" TEXT,
    "fatherName" TEXT,
    "fatherMobile" TEXT,
    "fatherOccupation" TEXT,
    "fatherIncome" TEXT,
    "motherName" TEXT,
    "motherMobile" TEXT,
    "motherOccupation" TEXT,
    "motherIncome" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FormTemplateType" NOT NULL,
    "schema" JSONB NOT NULL,
    "signatoryRoles" JSONB NOT NULL DEFAULT '[{"role":"student","label":"Student Signature"},{"role":"parent","label":"Parent / Guardian Signature"}]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLibrary" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_form_assignments" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "formTemplateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "stepSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_form_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_form_responses" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "formTemplateId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" "ResponseStatus" NOT NULL DEFAULT 'DRAFT',
    "lastSavedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_form_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverable_row_acknowledgments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "formTemplateId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "deliverable_row_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "formTemplateId" TEXT NOT NULL,
    "signatoryRole" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "studentId" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_templates" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalPdfUrl" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_signature_fields" (
    "id" TEXT NOT NULL,
    "agreementTemplateId" TEXT NOT NULL,
    "signerRole" TEXT NOT NULL,
    "fieldType" "AgreementFieldType" NOT NULL DEFAULT 'SIGNATURE',
    "label" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "defaultValue" TEXT,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_signature_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signed_agreements" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "agreementTemplateId" TEXT NOT NULL,
    "signedPdfUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signed_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institutions_code_key" ON "institutions"("code");

-- CreateIndex
CREATE INDEX "batches_createdById_idx" ON "batches"("createdById");

-- CreateIndex
CREATE INDEX "batches_isTemplate_idx" ON "batches"("isTemplate");

-- CreateIndex
CREATE UNIQUE INDEX "students_regNo_key" ON "students"("regNo");

-- CreateIndex
CREATE UNIQUE INDEX "students_username_key" ON "students"("username");

-- CreateIndex
CREATE UNIQUE INDEX "batch_form_assignments_batchId_formTemplateId_key" ON "batch_form_assignments"("batchId", "formTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "batch_form_assignments_batchId_order_key" ON "batch_form_assignments"("batchId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "batch_form_assignments_batchId_stepSlug_key" ON "batch_form_assignments"("batchId", "stepSlug");

-- CreateIndex
CREATE UNIQUE INDEX "student_form_responses_studentId_formTemplateId_key" ON "student_form_responses"("studentId", "formTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "deliverable_row_acknowledgments_studentId_formTemplateId_ro_key" ON "deliverable_row_acknowledgments"("studentId", "formTemplateId", "rowId");

-- CreateIndex
CREATE UNIQUE INDEX "signatures_studentId_formTemplateId_signatoryRole_key" ON "signatures"("studentId", "formTemplateId", "signatoryRole");

-- CreateIndex
CREATE UNIQUE INDEX "documents_studentId_documentType_key" ON "documents"("studentId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "agreement_templates_batchId_idx" ON "agreement_templates"("batchId");

-- CreateIndex
CREATE INDEX "agreement_signature_fields_agreementTemplateId_idx" ON "agreement_signature_fields"("agreementTemplateId");

-- CreateIndex
CREATE INDEX "signed_agreements_studentId_idx" ON "signed_agreements"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "signed_agreements_studentId_agreementTemplateId_key" ON "signed_agreements"("studentId", "agreementTemplateId");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_form_assignments" ADD CONSTRAINT "batch_form_assignments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_form_assignments" ADD CONSTRAINT "batch_form_assignments_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_form_responses" ADD CONSTRAINT "student_form_responses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_form_responses" ADD CONSTRAINT "student_form_responses_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_row_acknowledgments" ADD CONSTRAINT "deliverable_row_acknowledgments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_row_acknowledgments" ADD CONSTRAINT "deliverable_row_acknowledgments_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_templates" ADD CONSTRAINT "agreement_templates_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_templates" ADD CONSTRAINT "agreement_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_signature_fields" ADD CONSTRAINT "agreement_signature_fields_agreementTemplateId_fkey" FOREIGN KEY ("agreementTemplateId") REFERENCES "agreement_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_agreements" ADD CONSTRAINT "signed_agreements_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_agreements" ADD CONSTRAINT "signed_agreements_agreementTemplateId_fkey" FOREIGN KEY ("agreementTemplateId") REFERENCES "agreement_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

