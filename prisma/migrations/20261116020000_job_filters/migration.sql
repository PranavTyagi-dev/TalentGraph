ALTER TABLE "Job"
  ADD COLUMN "employmentType" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "experienceLevel" TEXT NOT NULL DEFAULT '';

UPDATE "Job" AS j
SET "employmentType" = sample.kind, "experienceLevel" = sample.level
FROM "Company" AS c, "User" AS u,
  (VALUES ('Product Design Intern', 'Internship', 'Entry level'),
          ('Data Analyst Intern', 'Internship', 'Entry level'),
          ('Frontend Developer', 'Full-time', 'Mid level')) AS sample(title, kind, level)
WHERE j."companyId" = c.id AND c."recruiterId" = u.id
  AND u.email = 'recruiter@talentgraph.test' AND c.name = 'Fieldwork Studio'
  AND j.title = sample.title;
