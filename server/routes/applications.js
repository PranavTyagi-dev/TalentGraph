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

