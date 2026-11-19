import React, { useState } from 'react';
import { api, Brand, Field, Form, Icon } from './shared.jsx';

export function Auth({ signIn }) {
  const [register, setRegister] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  async function demo(role) {
    setDemoBusy(true);
    setDemoError('');
    try {
      signIn(
        await api('/auth/login', 'POST', {
          email: role + '@talentgraph.test',
          password: 'CampusDemo123',
        })
      );
    } catch (err) {
      setDemoError(err.message);
    } finally {
      setDemoBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <header className="auth-header"><Brand /></header>
      <section className="auth-side">
        <div className="auth-form">
          <h1>{register ? 'Create an account' : 'Sign in to TalentGraph'}</h1>
          <Form
            key={String(register)}
            button={register ? 'Create account' : 'Sign in'}
            submit={async (values) =>
              signIn(await api(register ? '/auth/register' : '/auth/login', 'POST', values))
            }
          >
            {register && (
              <>
                <Field name="name" label="Full name" autoComplete="name" maxLength="80" />
                <label>
                  Account type
                  <select name="role">
                    <option value="CANDIDATE">Candidate</option>
                    <option value="RECRUITER">Recruiter</option>
                  </select>
                </label>
              </>
            )}
            <Field
              name="email"
              type="email"
              label="Email address"
              autoComplete="email"
              placeholder="you@example.com"
            />
            <Field
              name="password"
              type="password"
              label="Password"
              minLength={register ? 8 : 1}
              autoComplete={register ? 'new-password' : 'current-password'}
            />
          </Form>
          <p className="switch-auth">
            {register ? 'Already have an account?' : 'New to TalentGraph?'}{' '}
            <button
              className="link"
              onClick={() => {
                setRegister(!register);
                setDemoError('');
              }}
            >
              {register ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          {!register && (
            <div className="demo-box">
              <p>
                <strong>Demo accounts</strong>
              </p>
              <div className="demo-actions">
                <button disabled={demoBusy} onClick={() => demo('recruiter')}>
                  <Icon name="jobs" />
                  Recruiter
                </button>
                <button disabled={demoBusy} onClick={() => demo('candidate')}>
                  <Icon name="profile" />
                  Candidate
                </button>
              </div>
              {demoError && (
                <p className="error" role="alert">
                  {demoError}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
