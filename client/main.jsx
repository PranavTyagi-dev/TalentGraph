import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, Brand, Icon, initials, Loading } from './shared.jsx';
import { Auth } from './Auth.jsx';
import { Overview } from './Overview.jsx';
import { Companies, Jobs, Profile } from './Directory.jsx';
import { Applications } from './Applications.jsx';
import { Resumes } from './Resumes.jsx';
import { Account, Activity, Administration } from './Workspace.jsx';
import { Analytics } from './Analytics.jsx';
import './style.css';

const pages = {
  analytics: 'Analytics',
  resumes: 'Resumes',
  interviews: 'Interviews',
  updates: 'Updates',
  account: 'Account',
  admin: 'Administration',
  overview: 'Overview',
  jobs: 'Job openings',
  applications: 'Applications',
  companies: 'Companies',
  profile: 'My profile',
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewJob, setReviewJob] = useState(null);
  const [reviewId, setReviewId] = useState(null);
  function navigate(nextPage) {
    setReviewId(null);
    setReviewJob(null);
    setPage(nextPage);
  }
  const [page, setPage] = useState('overview');
  useEffect(() => {
    api('/auth/me')
      .then(setUser)
      .catch((err) => {
        if (!err.message.startsWith('Please sign in')) setError(err.message);
      })
      .finally(() => setLoading(false));
    function signedOut() {
      setUser(null);
      setPage('overview');
    }
    window.addEventListener('signed-out', signedOut);
    return () => window.removeEventListener('signed-out', signedOut);
  }, []);
  if (loading) return <Loading />;
  if (!user)
    return (
      <>
        {error && <p className="error">{error}</p>}
        <Auth
          signIn={(u) => {
            setUser(u);
            setError('');
            setPage('overview');
          }}
        />
      </>
    );
  const recruiter = user.role === 'RECRUITER';
  const isAdmin = user.role === 'ADMIN';
  const links = isAdmin
    ? ['admin', 'account']
    : [
        'overview',
        'jobs',
        'applications',
        'interviews',
        ...(recruiter ? ['analytics', 'companies'] : ['updates', 'profile', 'resumes']),
        'account',
      ];
  const currentPage = links.includes(page) ? page : links[0];
  const role = isAdmin ? 'Administrator' : recruiter ? 'Recruiter' : 'Candidate';
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand label={role} />
        <nav aria-label="Workspace">
          {links.map((key) => (
            <button
              key={key}
              aria-current={currentPage === key ? 'page' : undefined}
              onClick={() => navigate(key)}
            >
              <Icon
                name={
                  {
                    analytics: 'chart',
                    resumes: 'applications',
                    account: 'profile',
                    admin: 'companies',
                    updates: 'clock',
                    interviews: 'calendar',
                  }[key] || key
                }
              />
              {pages[key]}
            </button>
          ))}
        </nav>
        <div className="account">
          <span className="avatar">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
          </div>
          <button
            title="Sign out"
            aria-label="Sign out"
            onClick={async () => {
              try {
                await api('/auth/logout', 'POST');
                setUser(null);
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <div className="content">
          <header className="page-heading">
            <h1>{pages[currentPage]}</h1>
          </header>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {currentPage === 'admin' && <Administration />}
          {currentPage === 'resumes' && <Resumes />}
          {currentPage === 'account' && <Account user={user} setUser={setUser} />}
          {['updates', 'interviews'].includes(currentPage) && (
            <Activity
              key={currentPage}
              pageName={currentPage}
              review={(id) => {
                navigate('applications');
                setReviewId(id);
              }}
            />
          )}
          {currentPage === 'overview' && (
            <Overview
              recruiter={recruiter}
              go={navigate}
              review={(id) => {
                navigate('applications');
                setReviewId(id);
              }}
            />
          )}
          {currentPage === 'jobs' && (
            <Jobs
              recruiter={recruiter}
              review={(job) => {
                setReviewJob(job);
                setPage('applications');
              }}
            />
          )}
          {currentPage === 'applications' && (
            <Applications
              key={reviewId}
              initialId={reviewId}
              recruiter={recruiter}
              job={reviewJob}
              clearJob={() => setReviewJob(null)}
            />
          )}
          {currentPage === 'analytics' && <Analytics />}
          {currentPage === 'companies' && recruiter && <Companies userId={user.id} />}
          {currentPage === 'profile' && !recruiter && <Profile />}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
