// The demo uses fictional people. Running this script again preserves edits.
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { db } from '../server/db.js';

async function seed() {
  const email = 'recruiter@talentgraph.test';
  const passwordHash = await bcrypt.hash('CampusDemo123', 10);
  await db.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { email } })) {
      console.log('Demo recruiter already exists. Existing records were kept.');
      return;
    }
    const owner = await tx.user.create({
      data: { name: 'Maya Rao', email, passwordHash, role: 'RECRUITER' },
    });
    const company = await tx.company.create({
      data: {
        recruiterId: owner.id,
        name: 'Fieldwork Studio',
        description: 'A small product design and engineering studio.',
      },
    });
    const roles = [
      [
        'Product Design Intern',
        'Bengaluru · Hybrid',
        'Hybrid',
        'Internship',
        'Entry level',
        'Design research, Figma',
        'Research user needs, sketch interfaces, and help test prototypes with the product team.',
      ],
      [
        'Frontend Developer',
        'Remote',
        'Remote',
        'Full-time',
        'Mid level',
        'JavaScript, React',
        'Build accessible React interfaces and work with designers to improve the candidate experience.',
      ],
      [
        'Data Analyst Intern',
        'Pune · On-site',
        'On-site',
        'Internship',
        'Entry level',
        'SQL, spreadsheets',
        'Work with SQL and spreadsheets to answer questions and present findings.',
      ],
    ];
    const openings = [];
    for (const [title, location, workMode, employmentType, experienceLevel, requiredSkills, description] of roles) {
      openings.push(
        await tx.job.create({ data: { title, location, workMode, employmentType, experienceLevel, requiredSkills, description, companyId: company.id } })
      );
    }
    const people = [
      ['Isha Sen', 'candidate@talentgraph.test', 'INTERVIEW', 0],
      ['Aarav Shah', 'aarav@example.test', 'HIRED', 1],
      ['Riya Menon', 'riya@example.test', 'SHORTLISTED', 2],
      ['Dev Malik', 'dev@example.test', 'APPLIED', 1],
      ['Meera Das', 'meera@example.test', 'SHORTLISTED', 0],
      ['Kabir Roy', 'kabir@example.test', 'APPLIED', 2],
      ['Anya Patel', 'anya@example.test', 'APPLIED', 0],
    ];
    for (const [name, email, stage, jobIndex] of people) {
      const user = await tx.user.create({
        data: {
          name,
          email,
          role: 'CANDIDATE',
          passwordHash,
          profile: {
            create: {
              headline: 'Final-year student',
              skills: ['Design research, Figma', 'JavaScript, React', 'SQL, spreadsheets'][
                jobIndex
              ],
            },
          },
        },
      });
      const data = { jobId: openings[jobIndex].id, candidateId: user.id, stage, events: { create: { message: 'Application submitted', actor: name, seen: true } } };
      if (stage === 'INTERVIEW' || stage === 'HIRED') {
        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + (stage === 'HIRED' ? -2 : 2));
        scheduledAt.setHours(14, 0, 0, 0);
        data.interview = { create: { scheduledAt, location: 'Fieldwork Studio · Meeting room A' } };
      }
      await tx.application.create({ data });
    }
  });
}
try {
  await seed();
  const demo = await db.application.findFirst({
    where: { candidate: { email: 'anya@example.test' }, job: { title: 'Product Design Intern',
      company: { name: 'Fieldwork Studio', recruiter: { email: 'recruiter@talentgraph.test' } } } },
    orderBy: { id: 'asc' }
  });
  if (demo) {
    const name = 'Anya-Patel-Demo.pdf';
    const content = await readFile(new URL('./' + name, import.meta.url));
    await db.applicationResume.upsert({ where: { applicationId: demo.id },
      create: { applicationId: demo.id, name, content }, update: {} });
  }
} finally {
  await db.$disconnect();
}
