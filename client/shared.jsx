import React, { useEffect, useRef, useState } from 'react';

export async function api(path, method = 'GET', data) {
  const options = { method };
  if (method !== 'GET') {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(data ?? {});
  }
  const response = await fetch('/api' + path, options);
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('signed-out'));
    throw new Error(result.error || 'Request failed.');
  }
  return result;
}

export function useData(path, live = false) {
  const [result, setResult] = useState({ data: null, error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setResult({ data: null, error: '' });
    let timer;
    async function refresh() {
      try {
        const data = await api(path);
        if (active) setResult({ data, error: '' });
      } catch (error) {
        if (active) setResult({ data: null, error: error.message });
      } finally {
        if (active && live) timer = setTimeout(refresh, 3000);
      }
    }
    refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [path, revision, live]);
  return { ...result, reload: () => setRevision((n) => n + 1) };
}

export const labels = {
  APPLIED: 'Applied',
  IN_REVIEW: 'In review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  OFFERED: 'Offered',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};
export const dateTime = (value) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const paths = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  jobs: 'M3 8h18v12H3z M8 8V5h8v3 M3 12q9 5 18 0',
  applications: 'M8 3h11v15H8z M5 7H3v14h12v-1 M11 8h5 M11 12h5',
  companies: 'M4 21V5h12v16 M16 10h4v11 M2 21h20 M8 9h1m3 0h1m-5 4h1m3 0h1 M9 21v-4h3v4',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21q1-7 8-7t8 7',
  arrow: 'M4 12h15 M13 6l6 6-6 6',
  plus: 'M12 5v14 M5 12h14',
  search: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14 M15 15l6 6',
  calendar: 'M3 6h18v15H3z M7 3v6m10-6v6 M3 11h18',
  logout: 'M10 4H4v16h6 M9 12h12 M17 8l4 4-4 4',
  chart: 'M4 19V5 M4 19h17 M8 16v-4m5 4V8m5 8V5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l4 2',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  close: 'M6 6l12 12 M18 6L6 18',
  check: 'M3 12l6 6L21 5',
};
export function Icon({ name, size = 18 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function Brand({ label = 'TalentGraph' }) {
  return (
    <div className="brand">
      <img src="/mark.svg" alt="" width="34" height="34" />
      {label}
    </div>
  );
}

export function Status({ stage }) {
  return (
    <span className={'status ' + stage.toLowerCase()}>
      {labels[stage]}
    </span>
  );
}

export function Loading({ error }) {
  return (
    <p role="status" className={error ? 'error' : 'muted'}>
      {error || 'Loading…'}
    </p>
  );
}

export function Modal({ title, close, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-label={title}>
      <div className="modal-title">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Form({ submit, button = 'Save changes', children }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      await submit(values);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form" onSubmit={save}>
      {children}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button disabled={busy} className="primary">
        {busy ? 'Saving…' : button}
      </button>
    </form>
  );
}

export function Field({ label, name, value = '', multiline, required = true, ...props }) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea name={name} defaultValue={value} required={required} rows="4" {...props} />
      ) : (
        <input name={name} defaultValue={value} required={required} {...props} />
      )}
    </label>
  );
}

export function Pager({ data, page, change }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="pager">
      <span>
        {data.total} {data.total === 1 ? 'result' : 'results'}
      </span>
      <button disabled={page <= 1} onClick={() => change(page - 1)}>
        Previous
      </button>
      <span>
        {page} / {pages}
      </span>
      <button disabled={page >= pages} onClick={() => change(page + 1)}>
        Next
      </button>
    </div>
  );
}
