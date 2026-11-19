import React, { useState } from 'react';
import { api, Field, Form, Icon, Loading, Modal, Pager, useData } from './shared.jsx';

import { ResumeChoice } from './Resumes.jsx';
import { workModes, employmentTypes, experienceLevels } from '../shared/jobOptions.js';

export function Search({ value, change, placeholder }) {
  return (
    <label className="search">
      <Icon name="search" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        maxLength={100}
        value={value}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
}

const defaultFilters = {
  q: '',
  searchIn: 'all',
  location: '',
  workMode: '',
  employmentType: '',
  experienceLevel: '',
  applied: '',
  publication: '',
  sort: 'newest',
};

function JobForm({ job, done }) {
  const { data: companies, error } = useData('/companies');
  if (!companies) return <Loading error={error} />;
  if (!companies.length)
    return <p>Add your first company in Companies, then return here to post a job.</p>;
  async function save(values) {
    values.deadline = values.deadline ? new Date(values.deadline).toISOString() : '';
    if (job) {
      values.isOpen = values.publication === 'Published';
      await api('/jobs/' + job.id, 'PUT', values);
    } else await api('/jobs', 'POST', values);
    done();
  }
  return (
    <Form submit={save} button={job ? 'Save job' : 'Post job'}>
      {!job && (
        <label>
          Company
          <select name="companyId">
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Field label="Job title" name="title" value={job?.title} />
      <label>
        Work mode
        <select name="workMode" defaultValue={job?.workMode || ''}>
          <option value="">Unspecified</option>
          {workModes.map((mode) => (
            <option key={mode}>{mode}</option>
          ))}
        </select>
      </label>
      <label>
        Employment type
        <select name="employmentType" defaultValue={job?.employmentType || ''}>
          <option value="">Unspecified</option>
          {employmentTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label>
        Experience level
        <select name="experienceLevel" defaultValue={job?.experienceLevel || ''}>
          <option value="">Unspecified</option>
          {experienceLevels.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>
      </label>
      <Field
        label="Required skills"
        name="requiredSkills"
        value={job?.requiredSkills}
        placeholder="e.g. SQL, spreadsheets"
        required={false}
        maxLength={300}
      />
      <Field
        name="compensation"
        label="Compensation"
        value={job?.compensation}
        required={false}
        maxLength={120}
      />
      <Field
        name="deadline"
        label="Application deadline (local time)"
        type="datetime-local"
        required={false}
        value={
          job?.deadline
            ? new Date(
                new Date(job.deadline).getTime() -
                  new Date(job.deadline).getTimezoneOffset() * 60000
              )
                .toISOString()
                .slice(0, 16)
            : ''
        }
      />
      <Field label="Location" name="location" value={job?.location} placeholder="City or remote" />
      <Field
        label="Job description"
        name="description"
        value={job?.description}
        multiline
        maxLength={5000}
      />
      <label>
        Publication status
        <select name="publication" defaultValue={job?.publication || 'Published'}>
          {(job
            ? {
                Draft: ['Draft', 'Published', 'Archived'],
                Published: ['Published', 'Closed', 'Archived'],
                Closed: ['Closed', 'Published', 'Archived'],
                Archived: ['Archived'],
              }[job.publication]
            : ['Published', 'Draft']
          ).map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>
    </Form>
  );
}

export function Jobs({ recruiter, review }) {
  const [filters, setFilters] = useState(defaultFilters);
  function change(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [applying, setApplying] = useState(null);
  const [notice, setNotice] = useState('');
  const { data, error, reload } = useData('/jobs?' + new URLSearchParams({ ...filters, page }));
  return (
    <>
      <div className="toolbar jobs-toolbar">
        <Search
          value={filters.q}
          change={(v) => change('q', v)}
          placeholder="Search job openings"
        />
        {recruiter && (
          <button className="primary" onClick={() => setEditing({})}>
            <Icon name="plus" />
            Post a job
          </button>
        )}
      </div>
      <details className="filter-panel">
        <summary>Search filters{Object.keys(defaultFilters).some((key) => key !== 'q' && filters[key] !== defaultFilters[key]) && ' · active'}</summary>
        <div className="job-filters">
          <label>
            Search in
            <select value={filters.searchIn} onChange={(e) => change('searchIn', e.target.value)}>
              <option value="all">All fields</option>
              <option value="title">Job title</option>
              <option value="skills">Required skills</option>
              <option value="company">Company</option>
              <option value="location">Location</option>
              <option value="description">Description</option>
            </select>
          </label>
          <label>
            Location
            <input
              value={filters.location}
              maxLength={100}
              placeholder="City or region"
              onChange={(e) => change('location', e.target.value)}
            />
          </label>
          {[
            ['workMode', 'Work mode', workModes],
            ['employmentType', 'Employment type', employmentTypes],
            ['experienceLevel', 'Experience level', experienceLevels],
          ].map(([key, label, options]) => (
            <label key={key}>
              {label}
              <select value={filters[key]} onChange={(e) => change(key, e.target.value)}>
                <option value="">Any</option>
                {options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
          {recruiter ? (
            <label>
              Publication status
              <select
                value={filters.publication}
                onChange={(e) => change('publication', e.target.value)}
              >
                <option value="">All openings</option>
                {['Draft', 'Published', 'Closed', 'Archived'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              My applications
              <select value={filters.applied} onChange={(e) => change('applied', e.target.value)}>
                <option value="">All openings</option>
                <option value="yes">Already applied</option>
                <option value="no">Yet to apply</option>
              </select>
            </label>
          )}
          <label>
            Sort by
            <select value={filters.sort} onChange={(e) => change('sort', e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
        </div>
        <button
          onClick={() => {
            setFilters(defaultFilters);
            setPage(1);
          }}
        >
          Reset filters
        </button>
      </details>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="job-grid">
            {data.items.map((job) => (
              <article key={job.id} className="panel job-card">
                <header>
                  <h2>{job.title}</h2>
                  <span className={'status ' + (job.isOpen ? 'hired' : 'rejected')}>
                    {job.isOpen && job.deadline && new Date(job.deadline) <= new Date()
                      ? 'Expired'
                      : job.publication}
                  </span>
                </header>
                <p>{job.company.name}</p>
                <small className="icon-text">
                  <Icon name="pin" size={14} />
                  {job.location}
                </small>
                {(job.employmentType || job.experienceLevel) && (
                  <small>
                    {[job.employmentType, job.experienceLevel].filter(Boolean).join(' · ')}
                  </small>
                )}
                {job.compensation && <p>Compensation · {job.compensation}</p>}
                {job.deadline && <small>Apply by {new Date(job.deadline).toLocaleString()}</small>}
                {job.workMode && <small>Work mode · {job.workMode}</small>}
                {job.requiredSkills && (
                  <p>
                    <strong>Required skills</strong> · {job.requiredSkills}
                  </p>
                )}
                <p className="description">{job.description}</p>
                <div className="card-bottom">
                  {recruiter ? (
                    <>
                      <button className="link" onClick={() => review(job)}>
                        View applicants ({job._count.applications})
                      </button>
                      <button onClick={() => setEditing(job)}>Edit job</button>
                    </>
                  ) : (
                    <button disabled={job.applications.length > 0} onClick={() => setApplying(job)}>
                      {job.applications.length ? 'Applied' : 'Apply for job'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!data.items.length && <p className="empty">No jobs match this view.</p>}
          <Pager data={data} page={page} change={setPage} />
        </>
      )}
      {editing && (
        <Modal title={editing.id ? 'Edit job' : 'Post a job'} close={() => setEditing(null)}>
          <JobForm
            job={editing.id ? editing : null}
            done={() => {
              setEditing(null);
              setNotice('Job saved.');
              reload();
            }}
          />
        </Modal>
      )}
      {applying && (
        <Modal title="Submit application" close={() => setApplying(null)}>
          <p>
            Share your candidate profile with {applying.company.name} for the {applying.title}{' '}
            opening.
          </p>
          <Form
            button="Submit application"
            submit={async ({ resume, resumeId, coverNote }) => {
              if (resume.name) {
                if (resume.size > 5 * 1024 * 1024) throw new Error('Choose a PDF up to 5 MB.');
                const query = new URLSearchParams({ jobId: applying.id, name: resume.name });
                const response = await fetch('/api/applications?' + query, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/pdf',
                    'X-Cover-Note': encodeURIComponent(coverNote),
                  },
                  body: resume,
                });
                if (!response.ok) throw new Error((await response.json()).error);
              } else {
                await api('/applications', 'POST', { jobId: applying.id, resumeId, coverNote });
              }
              setApplying(null);
              setNotice('Application submitted. Track it in Applications.');
              reload();
            }}
          >
            <Field
              name="coverNote"
              label="Cover note (optional)"
              multiline
              required={false}
              maxLength={600}
            />
            <ResumeChoice />
            <label>
              Or attach a different PDF (up to 5 MB)
              <input type="file" name="resume" accept=".pdf,application/pdf" />
            </label>
          </Form>
        </Modal>
      )}
    </>
  );
}

export function Companies({ userId }) {
  const { data, error, reload } = useData('/companies');
  const [editing, setEditing] = useState(null);
  return (
    <>
      <div className="toolbar">
        <button className="primary" onClick={() => setEditing({})}>
          <Icon name="plus" />
          Add company
        </button>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="job-grid">
          {!data.length && <p className="empty">Add a company to start posting jobs.</p>}
          {data.map((c) => (
            <article className="panel job-card" key={c.id}>
              <span className="card-icon">
                <Icon name="companies" />
              </span>
              <h2>{c.name}</h2>
              <p className="description">{c.description}</p>
              <div className="card-bottom">
                <small>{c._count.jobs} jobs</small>
                {c.recruiterId === userId && (
                  <button onClick={() => setEditing(c)}>Edit company</button>
                )}
              </div>
              <details>
                <summary>Recruiting team ({c.members.length + 1})</summary>
                {c.members.map(({ user }) => (
                  <div key={user.id}>
                    <p>
                      {user.name} · {user.email}
                    </p>
                    {c.recruiterId === userId && (
                      <Form
                        button="Remove member"
                        submit={async () => {
                          await api('/companies/' + c.id + '/members/' + user.id, 'DELETE');
                          reload();
                        }}
                      />
                    )}
                  </div>
                ))}
                {c.recruiterId === userId && (
                  <Form
                    button="Add recruiter"
                    submit={async (v) => {
                      await api('/companies/' + c.id + '/members', 'POST', v);
                      reload();
                    }}
                  >
                    <Field name="email" label="Registered recruiter email" type="email" />
                  </Form>
                )}
              </details>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <Modal title={editing.id ? 'Edit company' : 'Add company'} close={() => setEditing(null)}>
          <Form
            submit={async (values) => {
              await api(
                editing.id ? '/companies/' + editing.id : '/companies',
                editing.id ? 'PUT' : 'POST',
                values
              );
              setEditing(null);
              reload();
            }}
          >
            <Field name="name" label="Company name" value={editing.name} />
            <Field
              name="description"
              label="Description"
              value={editing.description}
              multiline
              maxLength={3000}
            />
          </Form>
        </Modal>
      )}
    </>
  );
}

export function Profile() {
  const { data, error, reload } = useData('/profile');
  const [notice, setNotice] = useState('');
  if (!data) return <Loading error={error} />;
  return (
    <section className="panel narrow">
      <h2>Candidate details</h2>
      <p className="muted">Recruiters can see your current profile on jobs you apply for.</p>
      <Form
        submit={async (values) => {
          await api('/profile', 'PUT', values);
          setNotice('Your profile has been saved.');
          reload();
        }}
      >
        <Field
          name="headline"
          label="Headline"
          value={data.headline}
          required={false}
          maxLength={300}
        />
        {['summary', 'education', 'experience', 'projects'].map((key) => (
          <Field
            key={key}
            name={key}
            label={key[0].toUpperCase() + key.slice(1)}
            value={data[key]}
            multiline
            required={false}
            maxLength={2000}
          />
        ))}
        <Field name="skills" label="Skills" value={data.skills} required={false} maxLength={300} />
        <Field
          name="resumeName"
          label="Resume file name"
          value={data.resumeName}
          required={false}
          placeholder="My resume.pdf"
        />
        <Field
          name="resumeUrl"
          label="Shared resume link"
          type="url"
          value={data.resumeUrl}
          required={false}
          placeholder="https://…"
        />
      </Form>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
