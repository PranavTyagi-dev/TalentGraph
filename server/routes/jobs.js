import { Router } from 'express';
import { db } from '../db.js';
import { field, fail, positiveId, pageOptions, pageSize, contains } from '../input.js';
import { requireRole } from './auth.js';


export const jobs = Router();
const recruiter = requireRole('RECRUITER');

export function teamCompanies(userId) {
  return { suspended: false, OR: [{ recruiterId: userId }, { members: { some: { userId } } }] };
}

jobs.get('/companies', recruiter, async (req, res) => {
  res.json(
    await db.company.findMany({
      where: teamCompanies(req.user.id),
      orderBy: { name: 'asc' },
      include: {
        members: { select: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { jobs: true } },
      },
    })
  );
});

function companyFields(body) {
  return {
    name: field(body.name, 'company name'),
    description: field(body.description, 'description', 3000),
  };
}

jobs.post('/companies', recruiter, async (req, res) => {
  res
    .status(201)
    .json(
      await db.company.create({ data: { ...companyFields(req.body), recruiterId: req.user.id } })
    );
});

jobs.put('/companies/:id', recruiter, async (req, res) => {
  const where = { id: positiveId(req.params.id), recruiterId: req.user.id, suspended: false };
  res.json(await db.company.update({ where, data: companyFields(req.body) }));
});

jobs.post('/companies/:id/members', recruiter, async (req, res) => {
  const companyId = positiveId(req.params.id);
  const email = field(req.body.email, 'recruiter email', 254).toLowerCase();
  const user = await db.user.findUniqueOrThrow({
    where: { email, role: 'RECRUITER', suspended: false },
  });
  if (user.id === req.user.id) fail(400, 'You already own this company.');
  await db.company.update({
    where: { id: companyId, recruiterId: req.user.id, suspended: false },
    data: { members: { create: { userId: user.id } } },
  });
  res.sendStatus(204);
});

jobs.delete('/companies/:id/members/:userId', recruiter, async (req, res) => {
  const companyId = positiveId(req.params.id);
  await db.company.update({
    where: { id: companyId, recruiterId: req.user.id, suspended: false },
    data: {
      members: {
        delete: { companyId_userId: { companyId, userId: positiveId(req.params.userId) } },
      },
    },
  });
  res.sendStatus(204);
});

