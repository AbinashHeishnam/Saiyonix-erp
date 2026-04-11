/*
  Warnings:

  - A unique constraint covering the columns `[gatewayOrderId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gatewayPaymentId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gatewayEventId]` on the table `PaymentLog` will be added. If there are existing duplicate values, this will fail.
  - Made the column `gatewayOrderId` on table `Payment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentSource" ADD VALUE 'VERIFY';
ALTER TYPE "PaymentSource" ADD VALUE 'WEBHOOK';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "gatewayOrderId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PaymentLog" ADD COLUMN     "gatewayEventId" TEXT,
ADD COLUMN     "rawPayload" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayOrderId_key" ON "Payment"("gatewayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayPaymentId_key" ON "Payment"("gatewayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLog_gatewayEventId_key" ON "PaymentLog"("gatewayEventId");
