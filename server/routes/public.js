import { Router } from 'express';
import { db } from '../db.js';
import { acceptingApplications } from './jobs.js';
import { positiveId, contains, pageOptions, pageSize } from '../input.js';

export const directory = Router();
const fields = {
  id: true,
  title: true,
  description: true,
  location: true,
  requiredSkills: true,
  workMode: true,
  compensation: true,
  employmentType: true,
  experienceLevel: true,
  deadline: true,
  company: { select: { id: true, name: true } },
};
directory.get('/jobs', async (req, res) => {
  const where = { ...acceptingApplications(), title: contains(req.query.q) };
  res.json({
    items: await db.job.findMany({
      where,
      select: fields,
      orderBy: { id: 'desc' },
      ...pageOptions(req.query),
    }),
    total: await db.job.count({ where }),
    pageSize,
  });
});
directory.get('/jobs/:id', async (req, res) => {
  res.json(
    await db.job.findFirstOrThrow({
      where: { id: positiveId(req.params.id), ...acceptingApplications() },
      select: fields,
    })
  );
});
directory.get('/companies/:id', async (req, res) => {
  res.json(
    await db.company.findUniqueOrThrow({
      where: { id: positiveId(req.params.id), suspended: false },
      select: { id: true, name: true, description: true },
    })
  );
});
