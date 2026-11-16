ALTER TABLE "Company" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "CompanyMember" (
  "companyId" INTEGER NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("companyId","userId")
);
ALTER TABLE "Interview" ADD COLUMN "interviewerId" INTEGER REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "Interview" i SET "interviewerId" = c."recruiterId" FROM "Application" a, "Job" j, "Company" c
WHERE i."applicationId"=a.id AND a."jobId"=j.id AND j."companyId"=c.id;
