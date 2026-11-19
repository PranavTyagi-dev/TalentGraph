import { Router } from 'express';
import { db } from '../db.js';
import { contains, fail, pageOptions, pageSize, positiveId } from '../input.js';
import { requireRole } from './auth.js';

export const admin = Router();
admin.use(requireRole('ADMIN'));

admin.get('/', async (req, res) => {
  const term = contains(req.query.q);
  const where = { OR: [{ name: term }, { email: term }] };
  const items = await db.user.findMany({
    where,
    orderBy: { id: 'desc' },
    ...pageOptions(req.query),
    select: { id: true, name: true, email: true, role: true, suspended: true },
  });
  const audit = await db.adminAction.findMany({ take: 10, orderBy: { id: 'desc' } });
  res.json({
    items,
    total: await db.user.count({ where }),
    pageSize,
    audit,
    companies: await db.company.count(),
    jobs: await db.job.count(),
    applications: await db.application.count(),
  });
});

admin.patch('/users/:id', async (req, res) => {
  const id = positiveId(req.params.id);
  const suspended = req.body.suspended;
  if (typeof suspended !== 'boolean') fail(400, 'Select an account status.');
  await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id, role: { not: 'ADMIN' }, suspended: !suspended },
      data: { suspended },
    });
    if (suspended) await tx.session.deleteMany({ where: { userId: id } });
    await tx.adminAction.create({
      data: {
        actor: req.user.email,
        message: (suspended ? 'Suspended ' : 'Reactivated ') + user.email,
      },
    });
  });
  res.sendStatus(204);
});

admin.get('/companies', async (req, res) => {
  const where = { name: contains(req.query.q) };
  res.json({
    items: await db.company.findMany({
      where,
      orderBy: { id: 'desc' },
      ...pageOptions(req.query),
      include: { recruiter: { select: { email: true } } },
    }),
    total: await db.company.count({ where }),
    pageSize,
  });
});
admin.patch('/companies/:id', async (req, res) => {
  const suspended = req.body.suspended;
  if (typeof suspended !== 'boolean') fail(400, 'Select a company status.');
  await db.$transaction(async (tx) => {
    const company = await tx.company.update({
      where: { id: positiveId(req.params.id), suspended: !suspended },
      data: { suspended },
    });
    await tx.adminAction.create({
      data: {
        actor: req.user.email,
        message: (suspended ? 'Suspended company ' : 'Reactivated company ') + company.name,
      },
    });
  });
  res.sendStatus(204);
});
