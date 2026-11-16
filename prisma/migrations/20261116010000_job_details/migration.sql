ALTER TABLE "Job"
  ADD COLUMN "workMode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "requiredSkills" TEXT NOT NULL DEFAULT '';

-- Populate the new fields for the original fictional demo openings.
UPDATE "Job" AS job
SET "workMode" = sample.mode, "requiredSkills" = sample.skills
FROM "Company" AS company, "User" AS owner,
  (VALUES
    ('Product Design Intern', 'Bengaluru · Hybrid', 'Hybrid', 'Design research, Figma'),
    ('Frontend Developer', 'Remote', 'Remote', 'JavaScript, React'),
    ('Data Analyst Intern', 'Pune · On-site', 'On-site', 'SQL, spreadsheets')
  ) AS sample(title, location, mode, skills)
WHERE job."companyId" = company.id AND company."recruiterId" = owner.id
  AND owner.email = 'recruiter@talentgraph.test' AND company.name = 'Fieldwork Studio'
  AND job.title = sample.title AND job.location = sample.location;
