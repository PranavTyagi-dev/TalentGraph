import express, { Router } from 'express';
import { db } from '../db.js';
import { fail, field, positiveId } from '../input.js';
import { requireRole } from './auth.js';

export const resumes = Router();
resumes.use(requireRole('CANDIDATE'));
const metadata = { id: true, name: true, isDefault: true };

export function uploadedPdf(req) {
  const name = field(req.query.name, 'PDF file name', 200);
  if (
    !Buffer.isBuffer(req.body) ||
    req.body.subarray(0, 5).toString() !== '%PDF-' ||
    !name.toLowerCase().endsWith('.pdf')
  ) {
    fail(400, 'Choose a PDF resume.');
  }
  return { name, content: req.body };
}

resumes.get('/', async (req, res) => {
  res.json(
    await db.savedResume.findMany({
      where: { userId: req.user.id },
      select: metadata,
      orderBy: { id: 'desc' },
    })
  );
});
resumes.post('/', express.raw({ type: 'application/pdf', limit: '5mb' }), async (req, res) => {
  const file = uploadedPdf(req);
  res
    .status(201)
    .json(
      await db.savedResume.create({ data: { userId: req.user.id, ...file }, select: metadata })
    );
});
resumes.patch('/:id/default', async (req, res) => {
  const userId = req.user.id;
  await db.$transaction(
    [
      db.savedResume.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
      db.savedResume.update({
        where: { id: positiveId(req.params.id), userId },
        data: { isDefault: true },
        select: metadata,
      }),
    ],
    { isolationLevel: 'Serializable' }
  );
  res.sendStatus(204);
});
resumes.get('/:id', async (req, res) => {
  const file = await db.savedResume.findUniqueOrThrow({
    where: { id: positiveId(req.params.id), userId: req.user.id },
  });
  res.attachment(file.name).type('application/pdf').send(Buffer.from(file.content));
});
resumes.delete('/:id', async (req, res) => {
  await db.savedResume.delete({
    where: { id: positiveId(req.params.id), userId: req.user.id },
    select: metadata,
  });
  res.sendStatus(204);
});
