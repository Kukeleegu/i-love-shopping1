-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tempTfaSecret" TEXT,
ADD COLUMN     "tfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tfaSecret" TEXT;
