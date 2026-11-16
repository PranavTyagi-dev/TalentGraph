import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '../db.js';
import { field, fail } from '../input.js';

export const auth = Router();
const publicUser = { id: true, name: true, email: true, role: true };
const cookie = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
const day = 24 * 60 * 60 * 1000;
const digest = (token) => createHash('sha256').update(token).digest('hex');

async function signIn(res, user) {
  const token = randomBytes(32).toString('hex');
  await db.session.create({
    data: { token: digest(token), userId: user.id, expiresAt: new Date(Date.now() + day) },
  });
  res.cookie('session', token, { ...cookie, maxAge: day });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

export async function requireUser(req, res, next) {
  const token = req.cookies.session;
  if (typeof token !== 'string') fail(401, 'Please sign in.');
  const session = await db.session.findUnique({
    where: { token: digest(token) },
    include: { user: { select: { ...publicUser, suspended: true } } },
  });
  if (!session || session.user.suspended || session.expiresAt <= new Date())
    fail(401, 'Please sign in again.');
  req.user = session.user;
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) fail(403, 'Your account cannot perform this action.');
    next();
  };
}

auth.post('/register', async (req, res) => {
  const name = field(req.body.name, 'name', 80);
  const email = field(req.body.email, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
  const { password, role } = req.body;
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
    fail(400, 'Use a password with at least 8 characters and at most 72 bytes.');
  }
  if (!['CANDIDATE', 'RECRUITER'].includes(role)) fail(400, 'Select an account type.');
  const passwordHash = await bcrypt.hash(password, 10);
  const data = { name, email, passwordHash, role };
  if (role === 'CANDIDATE') data.profile = { create: {} };
  const user = await db.user.create({ data });
  await signIn(res, user);
});

auth.post('/login', async (req, res) => {
  const email = field(req.body.email, 'email', 254).toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (
    !user ||
    user.suspended ||
    typeof req.body.password !== 'string' ||
    !(await bcrypt.compare(req.body.password, user.passwordHash))
  ) {
    fail(401, 'Email or password is incorrect.');
  }
  await signIn(res, user);
});

auth.get('/me', requireUser, (req, res) => res.json(req.user));
auth.post('/logout', async (req, res) => {
  if (typeof req.cookies.session === 'string') {
    await db.session.deleteMany({ where: { token: digest(req.cookies.session) } });
  }
  res.clearCookie('session', cookie).sendStatus(204);
});

auth.patch('/account', requireUser, async (req, res) => {
  const name = field(req.body.name, 'name', 80);
  res.json(
    await db.user.update({ where: { id: req.user.id }, data: { name }, select: publicUser })
  );
});

auth.post('/password', requireUser, async (req, res) => {
  const { currentPassword, password } = req.body;
  const user = await db.user.findUniqueOrThrow({ where: { id: req.user.id } });
  if (
    typeof currentPassword !== 'string' ||
    !(await bcrypt.compare(currentPassword, user.passwordHash))
  )
    fail(400, 'Current password is incorrect.');
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72)
    fail(400, 'Use 8 or more characters, up to 72 bytes.');
  const passwordHash = await bcrypt.hash(password, 10);
  await db.$transaction([
    db.user.update({
      where: { id: user.id, passwordHash: user.passwordHash },
      data: { passwordHash },
    }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);
  res.clearCookie('session', cookie).sendStatus(204);
});
