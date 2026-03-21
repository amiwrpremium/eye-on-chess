-- AlterTable
ALTER TABLE "User" ADD COLUMN     "boardTheme" TEXT NOT NULL DEFAULT 'classic',
ADD COLUMN     "darkMode" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pieceSet" TEXT NOT NULL DEFAULT 'classic',
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;
