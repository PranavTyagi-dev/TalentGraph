import React, { useState } from 'react';
import { api, dateTime, Field, Form, labels, Loading, Pager, useData } from './shared.jsx';

export function Activity({ pageName, review }) {
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const { data, error: loadError, reload } = useData('/' + pageName + '?page=' + page, true);
  if (!data) return <Loading error={loadError} />;
  return (
    <section className="panel">
      {data.items.length === 0 && <p>No {pageName} yet.</p>}
      {data.items.map((row) => (
        <div className="application-row" key={row.id || row.application.id}>
          <div className="grow">
            <strong>{row.application.job.title}</strong>
            {pageName === 'interviews' ? (
              <>
                <p>
                  {row.application.candidate.name} · {dateTime(row.scheduledAt)} · {row.location}
                </p>
                <small>
                  {row.completed ? 'Completed' : labels[row.application.stage]} ·{' '}
                  {row.confirmed ? 'Attendance confirmed' : 'Unconfirmed'}
                </small>
              </>
            ) : (
              <>
                <p>{row.message}</p>
                <small>
                  {dateTime(row.createdAt)} · {row.seen ? 'Read' : 'Unread'}
                </small>
              </>
            )}
          </div>
          {pageName === 'updates' && !row.seen && (
            <button
              onClick={async () => {
                try {
                  await api('/updates/' + row.id + '/read', 'PATCH');
                  reload();
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              Mark read
            </button>
          )}
          <button onClick={() => review(row.applicationId || row.application.id)}>
            Open application
          </button>
        </div>
      ))}
      {error && <p className="error">{error}</p>}
      <Pager data={data} page={page} change={setPage} />
    </section>
  );
}

export function Account({ user, setUser }) {
  const [notice, setNotice] = useState('');
  return (
    <section className="panel narrow">
      <h2>{user.email}</h2>
      <Form
        button="Save name"
        submit={async (v) => {
          setUser(await api('/auth/account', 'PATCH', v));
          setNotice('Name saved.');
        }}
      >
        <Field label="Display name" name="name" value={user.name} maxLength={80} />
      </Form>
      <p role="status">{notice}</p>
      <h3>Change password</h3>
      <p>Changing your password signs you out on all devices.</p>
      <Form
        button="Change password"
        submit={async (v) => {
          await api('/auth/password', 'POST', v);
          window.dispatchEvent(new Event('signed-out'));
        }}
      >
        <Field
          label="Current password"
          type="password"
          name="currentPassword"
          autoComplete="current-password"
        />
        <Field
          label="New password"
          type="password"
          name="password"
          minLength={8}
          autoComplete="new-password"
        />
      </Form>
    </section>
  );
}

function CompanyAdministration() {
  const [page, setPage] = useState(1);
  const { data, error, reload } = useData('/admin/companies?page=' + page);
  if (!data) return <Loading error={error} />;
  return (
    <section className="panel">
      <h2>Company workspaces</h2>
      {data.items.map((c) => (
        <div className="application-row" key={c.id}>
          <div className="grow">
            <strong>{c.name}</strong>
            <p>
              {c.recruiter.email} · {c.suspended ? 'Suspended' : 'Active'}
            </p>
          </div>
          <Form
            button={c.suspended ? 'Reactivate company' : 'Suspend company'}
            submit={async () => {
              await api('/admin/companies/' + c.id, 'PATCH', { suspended: !c.suspended });
              reload();
            }}
          />
        </div>
      ))}
      <Pager data={data} page={page} change={setPage} />
    </section>
  );
}

export function Administration() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, reload } = useData('/admin?' + new URLSearchParams({ q, page }), true);
  return (
    <>
      <label>
        Find an account{' '}
        <input
          value={q}
          maxLength={100}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {data ? (
        <section className="panel">
          <p>
            {data.companies} companies · {data.jobs} jobs · {data.applications} applications
          </p>
          {data.items.map((u) => (
            <div className="application-row" key={u.id}>
              <div className="grow">
                <strong>{u.name}</strong>
                <p>
                  {u.email} · {u.role} · {u.suspended ? 'Suspended' : 'Active'}
                </p>
              </div>
              {u.role !== 'ADMIN' && (
                <Form
                  button={u.suspended ? 'Reactivate' : 'Suspend'}
                  submit={async () => {
                    await api('/admin/users/' + u.id, 'PATCH', { suspended: !u.suspended });
                    reload();
                  }}
                />
              )}
            </div>
          ))}
          <Pager data={data} page={page} change={setPage} />
          <h3>Recent account changes</h3>
          {data.audit.length ? (
            data.audit.map((a) => (
              <p key={a.id}>
                {a.message} · {a.actor} · {dateTime(a.createdAt)}
              </p>
            ))
          ) : (
            <p>No changes recorded.</p>
          )}
        </section>
      ) : (
        <Loading error={error} />
      )}
      <CompanyAdministration />
    </>
  );
}

