CREATE TABLE "ApplicationResume" (
  "applicationId" INTEGER PRIMARY KEY REFERENCES "Application"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "content" BYTEA NOT NULL
);
ALTER TABLE "Interview" ADD COLUMN "confirmed" BOOLEAN NOT NULL DEFAULT false;
