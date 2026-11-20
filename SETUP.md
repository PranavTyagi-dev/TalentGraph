# TalentGraph

A college capstone for managing recruitment. A recruiter posts a job, a candidate applies, and both can follow the application through an interview and a decision. The dashboard calculates counts from PostgreSQL. AI integration is a possible second phase.

## Set up on another computer

You need Node.js 22.12 or later and a running PostgreSQL server. One project folder contains both the client and server.

1. Create an empty database named `talentgraph` using pgAdmin or `createdb talentgraph`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to the database address, username and password for that machine. Use the example port unless another process already uses it.
3. Run these commands in the project folder.

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm start
```

The migration creates the tables and constraints. The optional seed command adds fictional people, jobs and applications. The demo buttons need this data. Running the seed again keeps existing demo edits. A fresh installation can also work with accounts created through registration.

Open http://127.0.0.1:3030 and use a demo account after seeding.

| Role | Email | Password |
| --- | --- | --- |
| Recruiter | recruiter@talentgraph.test | CampusDemo123 |
| Candidate | candidate@talentgraph.test | CampusDemo123 |

## Edit and run

For a simple change, edit a file, rebuild with `npm run build`, then run `npm start`. If you only changed backend code, restarting the server is sufficient.

For automatic reload while editing, stop the previous server with Ctrl+C. Run `npm run dev:api` in one terminal and `npm run dev:ui` in another. Open the address printed by Vite. Its configuration forwards API requests to Express on port 3030. If you change the API port, update the forwarding address in `client/vite.config.js` too.

After a database model change, use `npx prisma migrate dev --name describe_your_change` against your development database. Read the generated SQL and keep it with the project. On another computer, `npm run db:migrate` applies those saved migrations.

## Present the project in five minutes

1. Sign in as the demo recruiter. In **Job openings**, post a new “Campus Software Intern” role under Fieldwork Studio.
2. Open a private browser window with a separate login. Sign in as the demo candidate. In **My profile**, enter skills and, optionally, a shared résumé link and file name.
3. Find the new job and apply. Open **Applications** to see the initial Applied stage. The job now shows Applied and prevents another submission.
4. In the recruiter window, open **Applications** and review the candidate. Shortlist them. Reopen the application and schedule a future interview with a place or meeting link.
5. In the candidate window, reopen **Applications** to see the schedule. In the recruiter window, save feedback, then choose Hired. Reopen **Overview** to see the count change. Each window fetches fresh data when you revisit a page.

## Where to read the code

| Start here | What to follow |
| --- | --- |
| `prisma/schema.prisma` | Tables, primary keys, foreign keys and unique constraints |
| `server/index.js` | How Express receives JSON, attaches routes, serves React and returns errors |
| `server/routes/auth.js` | Register, sign in, verify a session, check a role and sign out |
| `server/routes/jobs.js` | Company, job and candidate profile forms and queries |
| `server/routes/applications.js` | Stage rules, application submission, scheduling, feedback and dashboard counts |
| `server/input.js` and `server/db.js` | Input checks, pagination and the shared database connection |
| `client/main.jsx` | The signed-in user, navigation and page components |
| `client/Directory.jsx` | Job search, application submission, company editing and candidate profiles |
| `client/Applications.jsx` and `client/Overview.jsx` | Reviewing an application and displaying the dashboard |
| `client/shared.jsx` | Browser requests, loading state and reusable form controls |
| `client/Auth.jsx` and `client/style.css` | Sign-in, registration and presentation |

See [the viva guide](VIVA.md) for a worked request, database relationships, sample questions and small changes to rehearse.

## Design choices

- Each company has one owner who can add registered recruiters to its team. One recruiter can work with several companies. Candidates can browse open jobs across companies.
- Closing a job blocks new applications and preserves existing records. A candidate may apply to each job once.
- An application has one reschedulable interview. Recruiter feedback is private. Candidates see their stage, time and location.
- A candidate profile stores a résumé name and a shareable link. Candidates may also attach a PDF of up to 5 MB when applying. PostgreSQL keeps this file with that specific application. Recruiters see the current profile.
- The interface uses plain React, built-in fetch and CSS. Express handles requests, Prisma queries PostgreSQL, bcryptjs hashes passwords, and cookie-parser reads the session cookie. Vite builds the client. The local demo uses the same server for the API and browser files.

## Extended recruitment workflow

The implementation adapts the [reference backend](https://github.com/Utkarsh12072007/TalentGraph-Dummy/tree/5be6492/server/src/modules) to this project’s Express routes, Prisma models and cookie sessions. After updating an older checkout, run `npm run db:migrate`, `npm run db:generate` and `npm run build`, then restart the server.

| Area | What you can demonstrate |
| --- | --- |
| Account | Edit your name or change your password. Password changes revoke sessions across devices. |
| Companies | An owner adds an existing recruiter by email. Members can post jobs, review applicants and schedule interviews for that company. Removing a member ends that access. |
| Jobs | Save a draft, publish, close, reopen or archive it. Add compensation and a deadline. Candidates can apply only to published openings with time remaining in an active company. |
| Profiles and résumés | Candidates edit a summary, education, experience, projects and skills. Save and download PDFs, choose a default or attach a different PDF when applying. Each submission keeps its own copy. |
| Application review | Write a cover note, move an applicant through review and offer stages, add private notes or withdraw an active application. The timeline records new changes. Older applications retain their known submission date. |
| Interviews | List meetings, schedule, confirm, reschedule, cancel or mark a past meeting complete. Cancellation removes the slot and returns the candidate to the shortlist. |
| Updates | Candidates see events from their own applications, open the associated application and mark updates read. |
| Analytics | Recruiters filter by company to count applications in each stage for each opening. |
| Administration | Administrators search users, suspend and reactivate accounts and companies, and inspect recent administrative changes. Suspension removes a company from discovery and restricts its hiring workspace. |
| Public API | GET /api/public/jobs?q=designer, /api/public/jobs/:id and /api/public/companies/:id return public listing fields without requiring login. |

**Create a local administrator.** Choose a new email. In a terminal, set ADMIN_EMAIL and ADMIN_PASSWORD in the environment or your ignored .env file, then run `node --env-file=.env prisma/create-admin.js`. Sign in through the normal sign-in form. Remove the provisioning password from the environment after use. Public registration offers the recruiter and candidate roles only.

**Simplifications.** Team members share one recruiter permission level and the recruiter scheduling a meeting is its interviewer. Education, experience and projects are text fields. Each application has one interview slot and one feedback field. The admin log covers account and company suspension changes. Job compensation is display text. Résumé uploads accept PDF. The reference also provides separate interviewer assignments and scorecards, logo and Word uploads, Swagger, JWT and deployment tooling.

## Check authentication

After installing dependencies and generating the Prisma client, run `node --test tests/auth.test.js`. The tests check missing sessions and recruiter-only access using Node’s built-in test runner.
