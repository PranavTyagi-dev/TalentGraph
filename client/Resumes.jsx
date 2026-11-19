import React from 'react';
import { api, Form, Loading, useData } from './shared.jsx';

export function ResumeChoice() {
  const { data, error } = useData('/resumes');
  if (!data) return <Loading error={error} />;
  if (!data.length) return null;
  return (
    <label>
      Saved resume
      <select name="resumeId" defaultValue={data.find((file) => file.isDefault)?.id || ''}>
        <option value="">None selected</option>
        {data.map((file) => (
          <option key={file.id} value={file.id}>
            {file.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Resumes() {
  const { data, error, reload } = useData('/resumes');
  if (!data) return <Loading error={error} />;
  return (
    <section className="panel narrow">
      <h2>Saved resumes</h2>
      <Form
        button="Save PDF"
        submit={async ({ file }) => {
          if (file.size > 5 * 1024 * 1024) throw new Error('Choose a PDF up to 5 MB.');
          const response = await fetch('/api/resumes?' + new URLSearchParams({ name: file.name }), {
            method: 'POST',
            headers: { 'Content-Type': 'application/pdf' },
            body: file,
          });
          if (!response.ok) throw new Error((await response.json()).error);
          reload();
        }}
      >
        <label>
          PDF resume (up to 5 MB)
          <input type="file" name="file" accept=".pdf,application/pdf" required />
        </label>
      </Form>
      {data.map((file) => (
        <div key={file.id} className="application-row">
          <a className="grow" href={'/api/resumes/' + file.id}>
            {file.name}
          </a>
          {file.isDefault ? (
            <small>Default resume</small>
          ) : (
            <Form
              button="Set default"
              submit={async () => {
                await api('/resumes/' + file.id + '/default', 'PATCH');
                reload();
              }}
            />
          )}
          <Form
            button="Remove"
            submit={async () => {
              if (
                window.confirm(
                  'Remove this saved copy? Submitted applications keep their own copies.'
                )
              ) {
                await api('/resumes/' + file.id, 'DELETE');
                reload();
              }
            }}
          />
        </div>
      ))}
    </section>
  );
}
