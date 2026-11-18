import express, { Router } from 'express';
import { db } from '../db.js';
import { field, fail, positiveId, pageOptions, pageSize, contains } from '../input.js';
import { requireRole } from './auth.js';

import { uploadedPdf } from './resumes.js';
import { acceptingApplications, teamCompanies } from './jobs.js';

function event(user, message) {
  return { actor: user.name, message, seen: user.role === 'CANDIDATE' };
}

export const applications = Router();
const recruiter = requireRole('RECRUITER');
export const nextStages = {
  IN_REVIEW: ['SHORTLISTED', 'INTERVIEW', 'REJECTED'],
  OFFERED: ['HIRED', 'REJECTED'],
  WITHDRAWN: [],
  APPLIED: ['IN_REVIEW', 'SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INTERVIEW', 'OFFERED', 'REJECTED'],
  INTERVIEW: ['OFFERED', 'HIRED', 'REJECTED'],
  HIRED: [],
  REJECTED: [],
};

export function visibleApplications(user) {
  if (user.role === 'CANDIDATE') return { candidateId: user.id };
  return { job: { company: teamCompanies(user.id) } };
}

export const jobDetails = { include: { company: { select: { name: true } } } };
const meetingDetails = {
  select: { scheduledAt: true, location: true, confirmed: true, completed: true },
};

function applicationDetails(user) {
  const isRecruiter = user.role === 'RECRUITER';
  return {
    job: jobDetails,
    candidate: { select: { name: true, email: true, profile: true } },
    resume: { select: { name: true } },
    interview: isRecruiter ? true : meetingDetails,
  };
}

applications.get('/applications/:id', async (req, res) => {
  const item = await db.application.findUniqueOrThrow({
    where: ownedApplication(req),
    include: {
      ...applicationDetails(req.user),
      events: { orderBy: { id: 'desc' } },
      notes: req.user.role === 'RECRUITER' ? { orderBy: { id: 'desc' } } : false,
    },
  });
  res.json({ item, choices: nextStages[item.stage] });
});

applications.get('/applications', async (req, res) => {
  const where = visibleApplications(req.user);
  if (req.query.jobId) where.jobId = positiveId(req.query.jobId);
  const term = contains(req.query.q);
  where.OR = [
    { candidate: { name: term } },
    { job: { title: term } },
    { job: { company: { name: term } } },
  ];
  if (req.query.stage) {
    if (!Object.hasOwn(nextStages, req.query.stage)) fail(400, 'Invalid stage.');
    where.stage = req.query.stage;
  }
  const include = applicationDetails(req.user);
  const items = await db.application.findMany({
    where,
    include,
    orderBy: { id: 'desc' },
    ...pageOptions(req.query),
  });
  res.json({ items, total: await db.application.count({ where }), pageSize, nextStages });
});

applications.post(
  '/applications',
  requireRole('CANDIDATE'),
  express.raw({ type: 'application/pdf', limit: '5mb' }),
  async (req, res) => {
    const hasFile = req.is('application/pdf');
    const jobId = positiveId(hasFile ? req.query.jobId : req.body.jobId);
    let note = req.body.coverNote;
    if (hasFile) {
      try {
        note = decodeURIComponent(req.get('X-Cover-Note') || '');
      } catch {
        fail(400, 'Invalid cover note.');
      }
    }
    const coverNote = field(note ?? '', 'cover note', 600, false);
    let resume;
    if (hasFile) {
      resume = { create: uploadedPdf(req) };
    }
    const result = await db.$transaction(
      async (tx) => {
        await tx.job.findFirstOrThrow({ where: { id: jobId, ...acceptingApplications() } });
        if (!hasFile && req.body.resumeId) {
          const file = await tx.savedResume.findUniqueOrThrow({
            where: { id: positiveId(req.body.resumeId), userId: req.user.id },
            select: { name: true, content: true },
          });
          resume = { create: file };
        }
        return tx.application.create({
          data: {
            jobId,
            candidateId: req.user.id,
            resume,
            coverNote,
            events: { create: event(req.user, 'Application submitted') },
          },
        });
      },
      { isolationLevel: 'Serializable' }
    );
    res.status(201).json(result);
  }
);

function ownedApplication(req) {
  return { id: positiveId(req.params.id), ...visibleApplications(req.user) };
}

applications.get('/applications/:id/resume', async (req, res) => {
  const resume = await db.applicationResume.findFirstOrThrow({
    where: { applicationId: positiveId(req.params.id), application: visibleApplications(req.user) },
  });
  res.set('X-Content-Type-Options', 'nosniff');
  if (req.query.download === '1') res.attachment(resume.name);
  else res.set('Content-Disposition', 'inline; filename="resume.pdf"');
  res.type('application/pdf').send(Buffer.from(resume.content));
});

applications.patch('/applications/:id/stage', recruiter, async (req, res) => {
  const where = ownedApplication(req);
  const application = await db.application.findUniqueOrThrow({ where });
  const stage = req.body.stage;
  if (stage === 'INTERVIEW') fail(400, 'Schedule an interview to enter this stage.');
  if (!nextStages[application.stage].includes(stage))
    fail(409, 'This stage change is unavailable.');
  // Matching the previous stage prevents two reviewers from overwriting a decision.
  res.json(
    await db.application.update({
      where: { ...where, stage: application.stage },
      data: {
        stage,
        events: {
          create: event(req.user, 'Stage changed to ' + stage.toLowerCase().replace('_', ' ')),
        },
      },
    })
  );
});

applications.put('/applications/:id/interview', recruiter, async (req, res) => {
  const where = ownedApplication(req);
  const scheduledAt = new Date(req.body.scheduledAt);
  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date())
    fail(400, 'Choose a future time.');
  const location = field(req.body.location, 'meeting place or link', 500);
  // Both changes commit together. Each application has a single interview slot.
  const result = await db.$transaction(
    async (tx) => {
      const application = await tx.application.findUniqueOrThrow({ where });
      // Two 30-minute slots overlap when their start times are less than 30 minutes apart.
      const halfHour = 30 * 60 * 1000;
      const conflict = await tx.interview.findFirst({
        where: {
          applicationId: { not: where.id },
          completed: false,
          scheduledAt: {
            gt: new Date(scheduledAt.getTime() - halfHour),
            lt: new Date(scheduledAt.getTime() + halfHour),
          },
          application: { stage: 'INTERVIEW' },
          OR: [
            { application: { candidateId: application.candidateId } },
            { interviewerId: req.user.id },
            {
              interviewerId: null,
              application: { job: { company: { recruiterId: req.user.id } } },
            },
          ],
        },
      });
      if (conflict)
        fail(409, 'The recruiter or candidate already has an interview during this slot.');
      const updated = await tx.application.updateMany({
        where: {
          ...where,
          stage: { in: ['IN_REVIEW', 'SHORTLISTED', 'INTERVIEW'] },
          NOT: { interview: { completed: true } },
        },
        data: { stage: 'INTERVIEW' },
      });
      if (!updated.count) fail(409, 'Choose a shortlisted application or an active interview.');
      await tx.applicationEvent.create({
        data: {
          applicationId: where.id,
          ...event(req.user, 'Interview scheduled for ' + scheduledAt.toISOString()),
        },
      });
      return tx.interview.upsert({
        where: { applicationId: where.id },
        create: { applicationId: where.id, scheduledAt, location, interviewerId: req.user.id },
        update: {
          scheduledAt,
          location,
          interviewerId: req.user.id,
          confirmed: false,
          completed: false,
        },
      });
    },
    { isolationLevel: 'Serializable' }
  );
  res.json(result);
});

applications.patch('/applications/:id/confirm', requireRole('CANDIDATE'), async (req, res) => {
  const scheduledAt = new Date(req.body.scheduledAt);
  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date())
    fail(400, 'Select an upcoming interview.');
  const updated = await db.interview.updateMany({
    where: {
      applicationId: positiveId(req.params.id),
      completed: false,
      scheduledAt,
      location: field(req.body.location, 'meeting place or link', 500),
      application: { candidateId: req.user.id, stage: 'INTERVIEW' },
    },
    data: { confirmed: true },
  });
  if (!updated.count) fail(409, 'This invitation has changed. Reopen the application.');
  res.sendStatus(204);
});

applications.patch('/applications/:id/feedback', recruiter, async (req, res) => {
  const where = ownedApplication(req);
  const feedback = field(req.body.feedback, 'feedback', 3000);
  res.json(
    await db.interview.update({
      where: { applicationId: where.id, application: where },
      data: { feedback },
    })
  );
});

applications.get('/overview', async (req, res) => {
  const where = visibleApplications(req.user);
  const openJobs = acceptingApplications();
  if (req.user.role === 'RECRUITER') openJobs.company = teamCompanies(req.user.id);
  const groups = await db.application.groupBy({ by: ['stage'], where, _count: true });
  const counts = {};
  for (const stage of Object.keys(nextStages)) counts[stage] = 0;
  for (const group of groups) counts[group.stage] = group._count;
  const recent = await db.application.findMany({
    where,
    take: 4,
    orderBy: { id: 'desc' },
    include: {
      resume: { select: { name: true } },
      candidate: { select: { name: true, profile: { select: { resumeUrl: true } } } },
      job: jobDetails,
    },
  });
  const upcoming = await db.interview.findMany({
    where: {
      completed: false,
      application: { ...where, stage: 'INTERVIEW' },
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 3,
    select: {
      id: true,
      scheduledAt: true,
      location: true,
      application: { select: { job: jobDetails, candidate: { select: { name: true } } } },
    },
  });
  res.json({ counts, openJobs: await db.job.count({ where: openJobs }), recent, upcoming });
});

applications.post('/applications/:id/notes', recruiter, async (req, res) => {
  const text = field(req.body.text, 'note', 2000);
  await db.application.update({
    where: ownedApplication(req),
    data: { notes: { create: { text } } },
  });
  res.sendStatus(204);
});

applications.post('/applications/:id/withdraw', requireRole('CANDIDATE'), async (req, res) => {
  const where = {
    ...ownedApplication(req),
    stage: { in: ['APPLIED', 'IN_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFERED'] },
  };
  await db.application.update({
    where,
    data: { stage: 'WITHDRAWN', events: { create: event(req.user, 'Application withdrawn') } },
  });
  res.sendStatus(204);
});

applications.post('/applications/:id/interview/cancel', recruiter, async (req, res) => {
  await db.application.update({
    where: { ...ownedApplication(req), stage: 'INTERVIEW', interview: { completed: false } },
    data: {
      stage: 'SHORTLISTED',
      interview: { delete: true },
      events: { create: event(req.user, 'Interview cancelled. Returned to shortlist.') },
    },
  });
  res.sendStatus(204);
});

applications.post('/applications/:id/interview/complete', recruiter, async (req, res) => {
  await db.application.update({
    where: {
      ...ownedApplication(req),
      stage: 'INTERVIEW',
      interview: { completed: false, scheduledAt: { lte: new Date() } },
    },
    data: {
      interview: { update: { completed: true } },
      events: { create: event(req.user, 'Interview completed') },
    },
  });
  res.sendStatus(204);
});

applications.get('/interviews', async (req, res) => {
  const meetings = await db.interview.findMany({
    where: { application: visibleApplications(req.user) },
    select: {
      scheduledAt: true,
      location: true,
      confirmed: true,
      completed: true,
      application: {
        select: {
          id: true,
          stage: true,
          job: { select: { title: true } },
          candidate: { select: { name: true } },
        },
      },
    },
    orderBy: { scheduledAt: 'desc' },
    ...pageOptions(req.query),
  });
  res.json({
    items: meetings,
    total: await db.interview.count({ where: { application: visibleApplications(req.user) } }),
    pageSize,
  });
});

applications.get('/updates', requireRole('CANDIDATE'), async (req, res) => {
  const where = { application: { candidateId: req.user.id } };
  const items = await db.applicationEvent.findMany({
    where,
    orderBy: { id: 'desc' },
    ...pageOptions(req.query),
    include: { application: { select: { job: { select: { title: true } } } } },
  });
  res.json({ items, total: await db.applicationEvent.count({ where }), pageSize });
});

applications.patch('/updates/:id/read', requireRole('CANDIDATE'), async (req, res) => {
  await db.applicationEvent.update({
    where: { id: positiveId(req.params.id), application: { candidateId: req.user.id } },
    data: { seen: true },
  });
  res.sendStatus(204);
});
