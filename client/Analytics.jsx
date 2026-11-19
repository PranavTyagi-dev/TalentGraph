import React, { useState } from 'react';
import { labels, Loading, useData } from './shared.jsx';

function stageColor(stage) {
  return 'var(--stage-' + stage.toLowerCase() + ')';
}

function Distribution({ counts, total }) {
  if (!total) return <p className="chart-empty">No applications yet</p>;
  let end = 0;
  const stages = Object.keys(labels).filter(stage => counts[stage]);
  const bands = stages.map(stage => {
    const start = end;
    end += 100 * counts[stage] / total;
    return stageColor(stage) + ' ' + start + '% ' + end + '%';
  });
  return <div className="distribution"><div className="donut" aria-hidden="true"
    style={{background: 'conic-gradient(' + bands.join(',') + ')'}}>
    <span><b>{total}</b><small>total</small></span></div>
    <ul>{stages.map(stage=><li key={stage}><i style={{background:stageColor(stage)}}/>{labels[stage]} ({counts[stage]})</li>)}</ul></div>;
}

export function Analytics() {
  const [companyId,setCompanyId] = useState('');
  const companies = useData('/companies');
  const { data, error, reload } = useData('/analytics/company?' + new URLSearchParams({companyId}),true);
  if (!data) return <><Loading error={error}/>{error && <button onClick={reload}>Retry</button>}</>;
  const {counts, total, daily, topJobs} = data;
  const stats = [
    ['Total applications',total], ['In pipeline',(counts.IN_REVIEW||0)+(counts.SHORTLISTED||0),'In review + shortlisted'],
    ['Offers',counts.OFFERED||0], ['Last 30 days',data.last30,'New applications']
  ];
  const peak = Math.max(1,...daily.map(row=>row.count));
  return <>
    {companies.data?.length > 1 && <label className="company-filter">Company <select value={companyId} onChange={e=>setCompanyId(e.target.value)}>
      <option value="">All companies</option>{companies.data.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    <div className="analytics-stats">{stats.map(([label,value,hint])=><article key={label}>
      <small>{label}</small><strong>{value}</strong>{hint && <small>{hint}</small>}</article>)}</div>
    <div className="analytics-charts">
      <section><h2>Applications by status</h2><p>Current pipeline distribution</p><Distribution counts={counts} total={total}/></section>
      <section><h2>Applications — last 14 days</h2><p>Daily volume across all jobs</p>
        {daily.length ? <div className="daily-bars">{daily.map(({day,count})=>{
          const date = new Date(day).toLocaleDateString(undefined,{month:'short',day:'numeric'});
          return <div key={day} tabIndex={0} aria-label={date + ', applications: ' + count}><b>{count}</b>
            <i style={{height: (120 * count / peak) + 'px'}}/><small>{date}</small></div>;
        })}</div> : <p className="chart-empty">No applications in this period yet</p>}
      </section>
      <section className="rankings"><h2>Top jobs by applications</h2><p>Where candidates are applying</p>
        {topJobs.map(job=><div className="rank" key={job.id}><span>{job.title}</span><small>{job._count.applications}</small>
          <div><i style={{width: (100*job._count.applications/topJobs[0]._count.applications)+'%'}}/></div></div>)}
        {!topJobs.length && <p className="chart-empty">No applications yet</p>}
      </section>
    </div><p className="analytics-foot">Interviews scheduled: {data.scheduled} · Jobs: {data.activeJobs} active of {data.totalJobs} · Rejected: {counts.REJECTED||0}</p>
  </>;
}
