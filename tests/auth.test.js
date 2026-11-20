import test from 'node:test';
import assert from 'node:assert/strict';
import { requireRole, requireUser } from '../server/routes/auth.js';

test('a request without a session cookie needs to sign in', async () => {
  await assert.rejects(requireUser({ cookies: {} }, {}, assert.fail), { status: 401 });
});

test('a candidate cannot access a recruiter route', () => {
  const recruiterOnly = requireRole('RECRUITER');
  const request = { user: { role: 'CANDIDATE' } };
  assert.throws(() => recruiterOnly(request, {}, assert.fail), { status: 403 });
});

test('a recruiter reaches the next handler on a recruiter route', () => {
  const recruiterOnly = requireRole('RECRUITER');
  const request = { user: { role: 'RECRUITER' } };
  let continued = false;
  recruiterOnly(request, {}, () => { continued = true; });
  assert.equal(continued, true);
});
