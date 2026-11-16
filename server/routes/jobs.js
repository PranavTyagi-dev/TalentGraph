import { Router } from 'express';
import { db } from '../db.js';
import { field, fail, positiveId, pageOptions, pageSize, contains } from '../input.js';
import { requireRole } from './auth.js';

import { employmentTypes, experienceLevels, workModes } from '../../shared/jobOptions.js';

export const jobs = Router();
const recruiter = requireRole('RECRUITER');
const candidate = requireRole('CANDIDATE');

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

export function acceptingApplications() {
  return {
    isOpen: true,
    publication: 'Published',
    company: { suspended: false },
    OR: [{ deadline: null }, { deadline: { gt: new Date() } }],
  };
}

export function visibleJobs(user) {
  if (user.role === 'RECRUITER') return { company: teamCompanies(user.id) };
  return { AND: [acceptingApplications()] };
}

function choice(value, options) {
  if (value !== undefined && value !== '' && !options.includes(value))
    fail(400, 'Invalid job option.');
  return value;
}

jobs.get('/jobs', async (req, res) => {
  const where = visibleJobs(req.user);
  const term = contains(req.query.q);
  const fields = {
    title: { title: term },
    skills: { requiredSkills: term },
    location: { location: term },
    company: { company: { name: term } },
    description: { description: term },
  };
  const scope = req.query.searchIn || 'all';
  if (scope !== 'all' && !Object.hasOwn(fields, scope)) fail(400, 'Unknown search field.');
  where.OR = scope === 'all' ? Object.values(fields) : [fields[scope]];
  if (req.query.publication && req.user.role === 'RECRUITER')
    where.publication = choice(req.query.publication, ['Draft', 'Published', 'Closed', 'Archived']);
  if (req.query.location) where.location = contains(req.query.location);
  if (req.query.employmentType)
    where.employmentType = choice(req.query.employmentType, employmentTypes);
  if (req.query.experienceLevel)
    where.experienceLevel = choice(req.query.experienceLevel, experienceLevels);
  if (req.query.applied && req.user.role === 'CANDIDATE') {
    choice(req.query.applied, ['yes', 'no']);
    const candidate = { candidateId: req.user.id };
    where.applications = req.query.applied === 'yes' ? { some: candidate } : { none: candidate };
  }
  const sort = choice(req.query.sort, ['newest', 'oldest', 'title']);
  let orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
  if (sort === 'oldest') orderBy = [{ createdAt: 'asc' }, { id: 'asc' }];
  if (sort === 'title') orderBy = [{ title: 'asc' }, { id: 'asc' }];
  if (req.query.workMode) where.workMode = choice(req.query.workMode, workModes);
  if (req.query.open && req.user.role === 'RECRUITER') {
    if (!['true', 'false'].includes(req.query.open)) fail(400, 'Invalid job filter.');
    where.isOpen = req.query.open === 'true';
  }
  const include = { company: true };
  if (req.user.role === 'RECRUITER') include._count = { select: { applications: true } };
  else include.applications = { where: { candidateId: req.user.id }, select: { id: true } };
  const items = await db.job.findMany({
    where,
    include,
    orderBy,
    ...pageOptions(req.query),
  });
  res.json({ items, total: await db.job.count({ where }), pageSize });
});

function publication(value) {
  if (!['Draft', 'Published', 'Closed', 'Archived'].includes(value))
    fail(400, 'Choose a publication status.');
  return value;
}

function jobFields(body) {
  let deadline;
  if (body.deadline !== undefined) {
    deadline = body.deadline ? new Date(body.deadline) : null;
    if (deadline && !Number.isFinite(deadline.getTime())) fail(400, 'Choose a valid deadline.');
  }
  return {
    deadline,
    publication: body.publication === undefined ? undefined : publication(body.publication),
    compensation:
      body.compensation === undefined
        ? undefined
        : field(body.compensation, 'compensation', 120, false),
    workMode: choice(body.workMode, workModes),
    employmentType: choice(body.employmentType, employmentTypes),
    experienceLevel: choice(body.experienceLevel, experienceLevels),
    requiredSkills:
      body.requiredSkills === undefined
        ? undefined
        : field(body.requiredSkills, 'required skills', 300, false),
    title: field(body.title, 'job title'),
    location: field(body.location, 'location'),
    description: field(body.description, 'description', 5000),
  };
}

jobs.post('/jobs', recruiter, async (req, res) => {
  const companyId = positiveId(req.body.companyId);
  await db.company.findUniqueOrThrow({ where: { id: companyId, ...teamCompanies(req.user.id) } });
  res
    .status(201)
    .json(
      await db.job.create({
        data: {
          ...jobFields(req.body),
          isOpen: !req.body.publication || req.body.publication === 'Published',
          companyId,
        },
      })
    );
});

jobs.put('/jobs/:id', recruiter, async (req, res) => {
  if (typeof req.body.isOpen !== 'boolean') fail(400, 'Select an opening status.');
  const where = { id: positiveId(req.params.id), company: teamCompanies(req.user.id) };
  const job = await db.job.findUniqueOrThrow({ where });
  const status =
    req.body.publication ??
    (req.body.isOpen ? 'Published' : job.isOpen ? 'Closed' : job.publication);
  const allowed = {
    Draft: ['Published', 'Archived'],
    Published: ['Closed', 'Archived'],
    Closed: ['Published', 'Archived'],
    Archived: [],
  };
  if (status !== job.publication && !allowed[job.publication].includes(status))
    fail(409, 'Unavailable publication change.');
  res.json(
    await db.job.update({
      where: { ...where, publication: job.publication },
      data: {
        ...jobFields(req.body),
        publication: status,
        isOpen: status === 'Published',
      },
    })
  );
});

jobs.get('/profile', candidate, async (req, res) => {
  res.json(await db.profile.findUniqueOrThrow({ where: { userId: req.user.id } }));
});

jobs.put('/profile', candidate, async (req, res) => {
  const data = {};
  for (const key of ['headline', 'skills', 'resumeName', 'resumeUrl']) {
    data[key] = field(req.body[key], key, key === 'resumeUrl' ? 2000 : 300, false);
  }
  for (const key of ['summary', 'experience', 'education', 'projects']) {
    if (req.body[key] !== undefined) data[key] = field(req.body[key], key, 2000, false);
  }
  if (Boolean(data.resumeName) !== Boolean(data.resumeUrl))
    fail(400, 'Provide both a resume name and its link.');
  if (data.resumeUrl) {
    if (
      !URL.canParse(data.resumeUrl) ||
      !['http:', 'https:'].includes(new URL(data.resumeUrl).protocol)
    ) {
      fail(400, 'Enter a valid http or https resume link.');
    }
  }
  res.json(await db.profile.update({ where: { userId: req.user.id }, data }));
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

