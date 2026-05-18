-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "payeeAccountName" TEXT,
ADD COLUMN     "payeeAccountNumber" TEXT,
ADD COLUMN     "payeeSortCode" TEXT;

-- AlterTable
ALTER TABLE "UserSettings" ALTER COLUMN "visibleColumns" SET DEFAULT '["vendor","description","invoiceNumber","invoiceDate","dueDate","net","vat","gross","currency","status"]';
