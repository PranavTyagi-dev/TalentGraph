import React from 'react';
import { dateTime, Icon, initials, labels, Loading, Status, useData } from './shared.jsx';

import { ResumeLink } from './Applications.jsx';

export function Overview({ recruiter, go, review }) {
  const { data, error } = useData('/overview', true);
  if (!data) return <Loading error={error} />;
  const { counts, recent, upcoming, openJobs } = data;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const cards = [
    ['Open jobs', openJobs],
    ['Applications', total],
    ['In interview', counts.INTERVIEW],
    ['Hired', counts.HIRED],
  ];
  return (
    <>
      <div className="stat-grid">
        {cards.map(([label, value]) => (
          <article className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <section className="panel recent-applications">
        <header>
          <h2>Recent applications</h2>
          <button className="link" onClick={() => go('applications')}>
            View all <Icon name="arrow" size={15} />
          </button>
        </header>
        {recent.length === 0 && <p className="empty">Submitted applications will appear here.</p>}
        {recent.map((a) => (
          <div className="recent-row" key={a.id}>
            <span className="avatar">{initials(a.candidate.name)}</span>
            <div className="grow">
              <strong>{recruiter ? a.candidate.name : a.job.title}</strong>
              <p>{recruiter ? a.job.title : a.job.company.name}</p>
            </div>
            <Status stage={a.stage} />
            {recruiter && <><ResumeLink item={a} /><button onClick={() => review(a.id)}>Review</button></>}
          </div>
        ))}
      </section>
      <div className="overview-grid">
        <section className="panel">
          <header>
            <h2>Application pipeline</h2>
          </header>
          <div className="chart">
            {Object.entries(labels).map(([stage, label]) => (
              <div className="chart-row" key={stage}>
                <span>{label}</span>
                <div className="track">
                  <div
                    className={'bar ' + stage.toLowerCase()}
                    style={{
                      width: (100 * counts[stage]) / Math.max(...Object.values(counts), 1) + '%',
                    }}
                  />
                </div>
                <b>{counts[stage]}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel schedule">
          <header>
            <h2>Upcoming interviews</h2>
          </header>
          {upcoming.length === 0 && (
            <p className="empty">Upcoming interviews will appear here once scheduled.</p>
          )}
          {upcoming.map((meeting) => (
            <div className="meeting" key={meeting.id}>
              <span className="date-tile">
                <small>
                  {new Date(meeting.scheduledAt).toLocaleString(undefined, { month: 'short' })}
                </small>
                {new Date(meeting.scheduledAt).getDate()}
              </span>
              <div>
                <strong>
                  {recruiter ? meeting.application.candidate.name : meeting.application.job.title}
                </strong>
                <p>
                  {recruiter ? meeting.application.job.title : meeting.application.job.company.name}
                </p>
                <small>
                  {dateTime(meeting.scheduledAt)} · {meeting.location}
                </small>
              </div>
            </div>
          ))}
        </section>
      </div>

    </>
  );
}
