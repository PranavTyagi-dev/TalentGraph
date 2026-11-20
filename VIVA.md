# TalentGraph viva guide

## Trace the Apply button

Start with one question you can answer by pointing to the code. **What happens between clicking Submit application and seeing Applied?**

1. In `client/Directory.jsx`, the Jobs component shows the selected opening. Confirming the form calls `api('/applications', 'POST', { jobId: applying.id })`.
2. In `client/shared.jsx`, `api` converts that JavaScript object to JSON and uses `fetch` to send it to Express. The browser includes its session cookie on this same-site request.
3. In `server/index.js`, Express reads the JSON body. The `requireUser` middleware looks up the session, checks its expiry, and sets `req.user`. Middleware is a function that runs before a route handler and can stop a request or pass it onward.
4. In `server/routes/applications.js`, the POST handler requires a candidate account, checks that the job is open, and creates an application using the signed-in user's ID. This prevents a candidate from choosing someone else's ID in the form.
5. In `prisma/schema.prisma`, `stage @default(APPLIED)` supplies the initial stage. The unique rule on `[jobId, candidateId]` prevents duplicates, even when two requests arrive together.
6. Express responds with status 201 and the new row. React closes the form and fetches the job list again. The button now says Applied. Reloading the browser reads the saved PostgreSQL record.

## Draw the database on the board

| Relationship | How to explain it |
| --- | --- |
| User → Session | One user can sign in from multiple browsers. Each sign-in creates a session with an expiry time. |
| User → Profile | A candidate has one profile. Its userId is both the primary key and a foreign key to User. |
| Recruiter → Company → Job | A recruiter owns companies. Each company can publish several jobs. Each job belongs to one company. |
| Candidate → Application ← Job | A candidate can apply to many jobs. A job can receive many applications. Application connects them and records the stage and submission date. |
| Application → Interview | An application may have one interview. A unique applicationId keeps a reschedule attached to the same interview. |

**Why do we need Application as its own table?** Suppose two candidates apply for the same job. One gets shortlisted while the other is still waiting. Each stage belongs to a particular candidate and job pair. Storing it on the Job row would give both people the same stage.

## Explain the workflow

| Current stage | Available next steps |
| --- | --- |
| Applied | Start review, shortlist or reject |
| In review | Shortlist, schedule an interview or reject |
| Shortlisted | Schedule an interview, offer or reject |
| Interview | Reschedule, cancel, complete the meeting, offer, hire or reject |
| Offered | Hire or reject |
| Hired, rejected or withdrawn | Final decision |

The server keeps the allowed transitions in `nextStages`. Scheduling saves both the interview and the Interview stage in a transaction. If either write fails, PostgreSQL rolls back both. A reschedule updates the existing interview. Saving feedback leaves the stage unchanged.

## Questions to practise

**What is the difference between authentication and authorization?** Signing in proves which user owns the session. The role and ownership checks decide which data that user can read or change. For example, a recruiter can edit a job only when it belongs to one of their companies.

**Why check on the server when the React button is hidden?** React controls what appears on screen. A server can receive a request from another client too. Express checks the role on each protected action, and the Prisma query limits the rows to the current user.

**How do passwords and sessions work?** Registration calls bcrypt to make a salted password hash. Login compares the submitted password with the stored hash. After a successful login, the server creates a random session token. The browser receives it in an HTTP-only cookie. The Session table keeps a hash of the token and a one-day expiry. Logging out removes the session and clears the cookie.

**What do useState and useEffect do here?** In Jobs, state holds the search text, filter and page. Typing changes state and therefore changes the request URL. The effect in useData fetches the new results. Its cleanup ignores an earlier response if the user has already moved to another query.

**How does pagination work?** The API uses a page size of six and sorts newest IDs first. Page two skips six rows and takes the next six. A separate count uses the same filters to calculate the number of pages.

**What does Prisma add?** The schema describes relations in one place. Prisma Client lets route handlers express queries as JavaScript. Migrations store the SQL changes so another machine can create the same tables.

**How is the dashboard calculated?** The overview route groups visible applications by their current stage and counts each group. Recruiter counts cover that recruiter's jobs. Candidate counts cover that candidate's applications. This shows current workload. Historical conversion rates would also require a record of every stage change.

Try this SQL against the demo database to see the stage counts across all recruiters.

```sql
SELECT "stage", COUNT(*) AS total
FROM "Application"
GROUP BY "stage"
ORDER BY "stage";
```

**How is this project ready for a future AI feature?** An example extension is drafting a job description from recruiter-entered requirements. A new Express route could return a draft to the existing job form for the recruiter to edit and save. The current version records human hiring decisions and uses database counts for analytics.

## Small changes to practise before the viva

- **Change page size.** Edit `pageSize` in `server/input.js`. Restart the server, open Applications and compare the first and second pages.
- **Change the wording of a stage.** Edit the display label in `client/shared.jsx`, rebuild, and reopen Applications. The stored enum value stays stable.
- **Add an optional job department.** Add an optional field to Job, generate a development migration, accept the field in `jobFields`, and add an input and display value in `Directory.jsx`. Check that an older job still renders with an empty department.
- **Show the duplicate rule.** In the demo, an application disables that job's Apply button. Show the unique index for the same candidate and job pair in the migration SQL. Explain why the database rule still matters if the user opens two tabs.

## A reading order for understanding the code

Work through these in order. After each step, explain it aloud and make one small change that you can reverse.

1. Read the models in `prisma/schema.prisma`. Identify every primary key and foreign key. Draw Company → Job → Application on paper and explain where the candidate belongs.
2. Read `server/db.js`. Its import loads the generated Prisma Client class. `new PrismaClient()` creates the object used to send database queries. Exporting `db` lets route files use that same object.
3. Read `server/input.js`. These are ordinary JavaScript functions. Trace an empty job title through `field` and explain which line stops the request.
4. Read `server/index.js` from top to bottom using the explanation below. Express processes matching middleware in the order it is registered.
5. Read registration and login in `server/routes/auth.js`. Trace the password from the form through hashing or comparison. Then trace the cookie through `requireUser`.
6. Read the company and job routes. Compare their GET, POST and PUT handlers. Explain how the signed-in recruiter limits the database query.
7. Read the application routes. Explain duplicate prevention, allowed stage changes and why scheduling needs a transaction.
8. Read `client/main.jsx`, then `shared.jsx`. Follow the user state, selected page, browser request and returned JSON.
9. Read one page at a time. Start with Companies, then Jobs, Applications and Overview. Identify which state controls each form and which request persists its data.
10. Read the CSS last. Change one colour, one spacing value and the mobile breakpoint, then explain what changed on screen.

## Walk through the Express entry point

The first imports load Express, the cookie reader, Node's path utilities and the three route modules. JavaScript modules let related code live in separate files while sharing exported functions.

`const app = express()` creates the server application. The next line finds the absolute path of the built React folder relative to this server file. An absolute path allows the server to locate those files regardless of the terminal's current directory.

`app.disable('x-powered-by')` removes a response header that advertises Express.

The first `app.use('/api', ...)` attaches two middleware functions to API requests. `express.json` reads JSON into `req.body`, with a size limit. `cookieParser()` reads cookies into `req.cookies`.

The next middleware sets `Cache-Control` to `no-store` for API responses. It checks that POST, PUT and PATCH requests use JSON. A failed check sends an error and returns immediately. `req.body ??= {}` supplies an empty object if no body was parsed. `next()` passes control to the next matching handler.

`app.use('/api/auth', auth)` attaches the authentication router. Its registration and login handlers can run before a user is signed in. Individual handlers such as `/me` apply their own session check.

`app.use('/api', requireUser, jobs, applications)` checks the session before running the protected routes. If a router has no matching route, Express continues to the next router. If none matches, the following handler returns an API 404.

`express.static(dist)` serves the built browser assets, including JavaScript and CSS. The root GET handler sends the React HTML document.

The error handler takes four arguments. Express uses this signature to recognise error middleware. It translates known Prisma errors into readable HTTP responses. For example, P2002 indicates that a unique constraint was violated. An unexpected error is logged on the server and receives a general 500 response.

The last lines read the port from the environment, with 3030 as the default, and start listening on the local computer. The callback prints the address once the server has started.

## JavaScript syntax you will meet

| Code pattern | Meaning in this project |
| --- | --- |
| `import` and `export` | Load a value from another file or make a value available to other files. |
| `async` and `await` | Wait for operations such as a database query or browser request before using their result. |
| `{ name, email }` | An object whose properties use the values of the variables named name and email. |
| `const { name } = values` | Read the name property from an object into a variable. |
| `...values` | Copy properties into another object. Later properties replace earlier ones with the same name. |
| `value ?? fallback` | Use the fallback when value is null or undefined. An empty string stays an empty string. |
| `profile?.headline` | Read headline when profile exists. Otherwise the expression produces undefined. |
| `items.map(item => ...)` | Create a new array by applying a function to each item. React uses this to render lists. |
| `items.filter(item => ...)` | Create an array containing only the items that pass a condition. |
| `throw error` | Stop the current operation and pass the error to its caller or error handler. |
| `try / catch / finally` | Attempt an operation, handle an error and perform cleanup after either outcome. |

## Explain the HTTP responses

| Status | A TalentGraph example |
| --- | --- |
| 200 | A job list was returned, or an update succeeded. |
| 201 | A job or application was created. |
| 204 | Logout succeeded and there is no response body. |
| 400 | A required field or date is invalid. |
| 401 | The session is missing or expired. |
| 403 | A candidate tried a recruiter-only action. |
| 404 | A record is unavailable to this user, or the route does not exist. |
| 409 | An application already exists, or the requested stage conflicts with its current state. |
| 415 | A write request used an unsupported content type. |
| 500 | An unexpected server operation failed. |

## Check your own understanding

Close this guide and explain how a company is linked to a recruiter, why Apply needs the signed-in user ID, how a cookie identifies a session, and how a changed database count reaches the dashboard. Then locate the exact code for each answer. If a line is unclear, write down its input, output and effect before moving on.

## Demonstrate job discovery

Open Job openings as the demo candidate. Search for SQL and choose On-site. The seeded Data Analyst Intern opening lists SQL in its required skills. Switch the work mode to Remote while keeping SQL in the search box to see how combining conditions narrows the results.

Follow the workMode state in `client/Directory.jsx` into the URL sent to Express. In `server/routes/jobs.js`, the search matches any one of title, skills, company or location. The selected work mode is an additional condition that must also match. Both conditions apply before pagination, so the total and page contents use the same rules. A recruiter can edit the two fields on an existing job.

## Combine filters and review one opening

In Job openings, set Search in to Required skills and enter SQL. Add Pune, Internship and Entry level to narrow the demo results. Switching Search in to Job title asks a different question because SQL appears in the skills field. Reset filters starts a fresh search. Sorting changes the order before the server chooses a page.

Candidates can also select Yet to apply. Prisma checks for the absence of an application linking that job to the signed-in candidate. For recruiters, View applicants passes the opening’s numeric ID to Applications. There you can filter by stage or candidate name within that job, including when two jobs have the same title.

## Demonstrate a submitted résumé and an interview

Apply to a new job with a small PDF. Open that application as the owning recruiter and choose **Open** under **Submitted résumé**. The application ID is the résumé table’s primary key and foreign key. A nested create saves both records together. The list query fetches only the filename. Opening the PDF makes a separate request that checks the signed-in candidate or recruiter before reading the file contents.

Shortlist the candidate and schedule a future interview at 10:00. Try scheduling a second shortlisted application for the same recruiter at 10:15. The server rejects the overlap. A 10:30 start is allowed. The same check covers a candidate interviewing with another recruiter. The transaction checks availability and saves the appointment together with its stage. Serializable isolation prevents two simultaneous conflicting bookings from both succeeding.

Open the invitation as the candidate and confirm attendance. Reschedule it as the recruiter, then reopen it as the candidate. The new appointment needs a fresh confirmation. The server compares the submitted time and place to the current invitation before accepting a confirmation.

## Demonstrate the extended backend

1. Create a draft with a deadline and compensation. Check Job openings as a candidate, then publish it as the recruiter. The application endpoint checks the same publication and deadline rules as browsing.
2. In Résumés, upload a PDF and set it as the default. Apply with a cover note. Delete the saved PDF and open the submitted copy as the recruiter. Explain why ApplicationResume and SavedResume have different owners.
3. Move the application into review and add a private note. Look at the candidate’s Updates and application history. A nested Prisma write records the stage and its event together. The notes table is included only for authorized recruiters.
4. Add a second registered recruiter to a company. Show that the job and its applications appear in that teammate’s workspace. Remove the membership and repeat the query. The company filter joins through company membership on every request.
5. Cancel an interview and see the application return to Shortlisted. Withdraw as the candidate and open Analytics as a recruiter. The application remains available to count and review.
6. Sign in with a separately provisioned local administrator. Suspend a practice account, inspect the audit row and reactivate it. Explain why the previous session still requires a new login.
