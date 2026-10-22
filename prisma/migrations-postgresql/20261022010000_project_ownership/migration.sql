BEGIN;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "ownerUid" TEXT;

-- CreateIndex
CREATE INDEX "Project_ownerUid_idx" ON "Project"("ownerUid");

COMMIT;
