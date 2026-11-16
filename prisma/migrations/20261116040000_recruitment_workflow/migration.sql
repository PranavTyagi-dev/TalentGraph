-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Stage" ADD VALUE 'IN_REVIEW';
ALTER TYPE "Stage" ADD VALUE 'OFFERED';
ALTER TYPE "Stage" ADD VALUE 'WITHDRAWN';

-- DropForeignKey
ALTER TABLE "ApplicationResume" DROP CONSTRAINT "ApplicationResume_applicationId_fkey";

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "coverNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "compensation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "deadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "education" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "experience" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "projects" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "summary" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterNote" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruiterNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" SERIAL NOT NULL,
    "actor" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterNote" ADD CONSTRAINT "RecruiterNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationResume" ADD CONSTRAINT "ApplicationResume_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Submission dates are known for older rows. Earlier decisions have no recorded timestamps.
INSERT INTO "ApplicationEvent" ("applicationId","message","actor","createdAt","seen")
SELECT a.id, 'Application submitted', u.name, a."createdAt", true
FROM "Application" a JOIN "User" u ON u.id = a."candidateId";

ALTER TABLE "Job" ADD COLUMN "publication" TEXT NOT NULL DEFAULT 'Published';
UPDATE "Job" SET "publication"='Closed' WHERE "isOpen"=false;
CREATE TABLE "SavedResume" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL, content BYTEA NOT NULL, "isDefault" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "one_default_resume" ON "SavedResume" ("userId") WHERE "isDefault";
