import React, { useState } from 'react';
import {
  api,
  dateTime,
  Field,
  Form,
  initials,
  labels,
  Loading,
  Modal,
  Pager,
  Status,
  useData,
} from './shared.jsx';
import { Search } from './Directory.jsx';

export function ResumeLink({ item }) {
  if (item.resume)
    return (
      <a href={'/api/applications/' + item.id + '/resume'} target="_blank" rel="noreferrer">
        Open resume
      </a>
    );
  if (item.candidate.profile?.resumeUrl)
    return (
      <a href={item.candidate.profile.resumeUrl} target="_blank" rel="noreferrer">
        Profile resume
      </a>
    );
  return <small>No resume provided</small>;
}

function Review({ id, recruiter, back }) {
  const { data, error, reload } = useData('/applications/' + id, true);
  return (
    <>
      <button className="link back-link" onClick={back}>← All applications</button>
      {data ? (
        <article className="review">
          <ApplicationDetails
            item={data.item}
            choices={data.choices}
            recruiter={recruiter}
            done={reload}
          />
        </article>
      ) : (
        <Loading error={error} />
      )}
    </>
  );
}

function ApplicationDetails({ item, choices, recruiter, done }) {
  const base = '/applications/' + item.id;
  const { candidate, job, interview, stage } = item;
  const profile = candidate.profile;
  async function update(path, method, values) {
    await api(base + path, method, values);
    done();
  }
  return (
    <div className="details">
      <header className="review-heading">
        <span className="avatar">{initials(candidate.name)}</span>
        <div className="grow">
          <h2>{candidate.name}</h2>
          <p>{job.title} · {job.company.name}</p>
          <small>Applied {dateTime(item.createdAt)}</small>
        </div>
        <Status stage={stage} />
      </header>
      <div className="review-columns">
        <div className="review-column">
          <section className="resume-card">
            <h3>Resume</h3>
            {item.resume && (
              <>
                <strong>{item.resume.name}</strong>
                <div className="resume-actions">
                  <ResumeLink item={item} />
                  <a href={'/api' + base + '/resume?download=1'}>Download PDF</a>
                </div>
                <details className="preview-toggle">
                  <summary>Preview PDF</summary>
                  <object
                  className="pdf-preview"
                  data={'/api' + base + '/resume'}
                  type="application/pdf"
                  aria-label="Submitted resume preview"
                >
                  Use Open resume to view the PDF.
                  </object>
                </details>
              </>
            )}
            {!item.resume && <ResumeLink item={item} />}
          </section>
          {recruiter && (
            <section>
              <h3>Candidate profile</h3>
              <p>
                {candidate.email}
              </p>
              <p>{profile?.headline}</p>
              <p>{profile?.skills}</p>
              {['summary', 'education', 'experience', 'projects'].map(
                (key) =>
                  profile?.[key] && (
                    <div key={key}>
                      <strong>{key[0].toUpperCase() + key.slice(1)}</strong>
                      <p>{profile[key]}</p>
                    </div>
                  )
              )}
            </section>
          )}
          {item.coverNote && (
            <section>
              <h3>Cover note</h3>
              <p>{item.coverNote}</p>
            </section>
          )}
        </div>
        <div className="review-column">
          {recruiter && (
            <section>
              <h3>Private recruiter notes</h3>
              {item.notes.map((n) => (
                <p key={n.id}>
                  {n.text} · {dateTime(n.createdAt)}
                </p>
              ))}
              <Form button="Add private note" submit={(v) => update('/notes', 'POST', v)}>
                <Field name="text" label="New note" multiline maxLength={2000} />
              </Form>
            </section>
          )}
          {!recruiter && choices.length > 0 && (
            <section>
              <Form
                button="Withdraw application"
                submit={async () => {
                  if (
                    window.confirm(
                      'Withdraw this application? You cannot apply again for this opening.'
                    )
                  )
                    await update('/withdraw', 'POST', {});
                }}
              />
            </section>
          )}
          {interview && (
            <section>
              <h3>Interview details</h3>
              <p>{dateTime(interview.scheduledAt)} · 30 minutes</p>
              <p>{interview.location}</p>
              <p>{interview.confirmed ? 'Candidate confirmed attendance' : 'Attendance unconfirmed'}</p>
              {interview.completed && <p>Interview completed</p>}
              {recruiter && stage === 'INTERVIEW' && !interview.completed && (
                <div>
                  <Form
                    button="Cancel interview"
                    submit={async () => {
                      if (
                        window.confirm(
                          'Cancel this interview and return the application to the shortlist?'
                        )
                      )
                        await update('/interview/cancel', 'POST', {});
                    }}
                  />
                  {new Date(interview.scheduledAt) <= new Date() && (
                    <Form
                      button="Mark completed"
                      submit={() => update('/interview/complete', 'POST', {})}
                    />
                  )}
                </div>
              )}
              {!recruiter &&
                !interview.completed &&
                !interview.confirmed &&
                stage === 'INTERVIEW' &&
                new Date(interview.scheduledAt) > new Date() && (
                  <Form
                    button="Confirm attendance"
                    submit={() =>
                      update('/confirm', 'PATCH', {
                        scheduledAt: interview.scheduledAt,
                        location: interview.location,
                      })
                    }
                  />
                )}
            </section>
          )}
          {recruiter && (
            <>
              {choices.some((s) => s !== 'INTERVIEW') && (
                <section>
                  <Form button="Update stage" submit={(v) => update('/stage', 'PATCH', v)}>
                    <label>
                      Application decision
                      <select name="stage" required defaultValue="">
                        <option value="" disabled>
                          Select next stage
                        </option>
                        {choices
                          .filter((s) => s !== 'INTERVIEW')
                          .map((s) => (
                            <option key={s} value={s}>
                              {labels[s]}
                            </option>
                          ))}
                      </select>
                    </label>
                  </Form>
                </section>
              )}
              {['IN_REVIEW', 'SHORTLISTED', 'INTERVIEW'].includes(stage) && !interview?.completed && (
                <section>
                  <h3>{interview ? 'Reschedule interview' : 'Schedule interview'}</h3>
                  <Form
                    button={interview ? 'Reschedule' : 'Schedule interview'}
                    submit={(v) =>
                      update('/interview', 'PUT', {
                        ...v,
                        scheduledAt: new Date(v.scheduledAt).toISOString(),
                      })
                    }
                  >
                    <Field
                      name="scheduledAt"
                      label="Start time (local, 30-minute interview)"
                      type="datetime-local"
                    />
                    <Field name="location" label="Place or meeting link" value={interview?.location} />
                  </Form>
                </section>
              )}
              {interview && (
                <section>
                  <Form button="Save feedback" submit={(v) => update('/feedback', 'PATCH', v)}>
                    <Field
                      name="feedback"
                      label="Private recruiter feedback"
                      multiline
                      maxLength={3000}
                      value={interview.feedback}
                    />
                  </Form>
                </section>
              )}
            </>
          )}
          <section>
            <h3>Application history</h3>
            {item.events.length ? (
              item.events.map((e) => (
                <div key={e.id}>
                  <p>{e.message}</p>
                  <small>
                    {dateTime(e.createdAt)} · {e.actor}
                  </small>
                </div>
              ))
            ) : (
              <p>Applied {dateTime(item.createdAt)}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function Applications({ recruiter, job, clearJob, initialId }) {
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(initialId);
  const [notice, setNotice] = useState('');
  const { data, error, reload } = useData(
    '/applications?' + new URLSearchParams({ q, stage, page, jobId: job?.id || '' }),
    !selected
  );
  if (selected)
    return (
      <Review
        id={selected}
        recruiter={recruiter}
        back={() => {
          setSelected(null);
          reload();
        }}
      />
    );
  return (
    <>
      {job && (
        <div className="toolbar">
          <strong>
            {job.title} · {job.company.name}
          </strong>
          <button
            onClick={() => {
              clearJob();
              setPage(1);
            }}
          >
            Show all jobs
          </button>
        </div>
      )}
      <div className="toolbar">
        <Search
          value={q}
          change={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder={recruiter ? 'Search candidate, job or company' : 'Search job or company'}
        />
        <select
          aria-label="Application stage"
          value={stage}
          onChange={(e) => {
            setStage(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All stages</option>
          {Object.entries(labels).map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="panel directory">
            {data.items.length === 0 && <p className="empty">No applications match this view.</p>}
            {data.items.map((a) => (
              <div className="application-row" key={a.id}>
                <span className="avatar">{initials(a.candidate.name)}</span>
                <div className="grow">
                  <strong>{recruiter ? a.candidate.name : a.job.title}</strong>
                  <p>
                    {recruiter ? a.job.title + ' · ' : ''}
                    {a.job.company.name}
                  </p>
                </div>
                <Status stage={a.stage} />
                {recruiter && <ResumeLink item={a} />}
                <button onClick={() => setSelected(a.id)}>
                  {recruiter ? 'Review' : 'View details'}
                </button>
              </div>
            ))}
          </div>
          <Pager data={data} page={page} change={setPage} />
        </>
      )}
    </>
  );
}
