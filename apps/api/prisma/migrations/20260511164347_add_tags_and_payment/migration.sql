-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidDate" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[];
