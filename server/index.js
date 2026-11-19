import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { auth, requireUser } from './routes/auth.js';
import { directory } from './routes/public.js';
import { resumes } from './routes/resumes.js';
import { admin } from './routes/admin.js';
import { jobs } from './routes/jobs.js';
import { applications } from './routes/applications.js';

const app = express();
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
app.disable('x-powered-by');
app.use('/api', express.json({ limit: '32kb' }), cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const isResumeUpload =
    ['/applications', '/resumes'].includes(req.path) &&
    req.method === 'POST' &&
    req.is('application/pdf');
  if (
    !isResumeUpload &&
    ['POST', 'PUT', 'PATCH'].includes(req.method) &&
    !req.is('application/json')
  ) {
    return res.status(415).json({ error: 'Send a JSON request.' });
  }
  req.body ??= {};
  next();
});
app.use('/api/auth', auth);
app.use('/api/public', directory);
app.use('/api/resumes', requireUser, resumes);
app.use('/api/admin', requireUser, admin);
app.use(
  '/api',
  requireUser,
  (req, res, next) => {
    if (req.user.role === 'ADMIN')
      return res.status(403).json({ error: 'Use the administration workspace.' });
    next();
  },
  jobs,
  applications
);
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use(express.static(dist));
app.get('/', (req, res) => res.sendFile(path.join(dist, 'index.html')));

app.use((err, req, res, next) => {
  if (err.code === 'P2002') return res.status(409).json({ error: 'This record already exists.' });
  if (err.code === 'P2025') return res.status(404).json({ error: 'This record is unavailable.' });
  if (err.code === 'P2034')
    return res.status(409).json({ error: 'The record changed. Please try again.' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'The server could not complete the request.' });
});

const port = Number(process.env.PORT || 3030);
app.listen(port, '127.0.0.1', () =>
  console.log(`TalentGraph is running at http://127.0.0.1:${port}`)
);
