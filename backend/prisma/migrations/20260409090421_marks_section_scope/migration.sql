/*
  Warnings:

  - A unique constraint covering the columns `[examSubjectId,studentId,sectionId]` on the table `Mark` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Mark_examSubjectId_studentId_key";

-- AlterTable
ALTER TABLE "Mark" ADD COLUMN     "sectionId" TEXT;

-- CreateIndex
CREATE INDEX "Mark_sectionId_idx" ON "Mark"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Mark_examSubjectId_studentId_sectionId_key" ON "Mark"("examSubjectId", "studentId", "sectionId");

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
