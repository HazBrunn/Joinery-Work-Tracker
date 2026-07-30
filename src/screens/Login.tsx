import { useState } from 'react';
import { signIn, signUp } from '../lib/supabase';

// Email and password against the same Supabase project as the life tracker, so
// auth.uid() is the id every joinery row is filed under and RLS is the boundary.
// Google sign-in went with Firebase.
export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    const e = email.trim();
    if (!e || !password) { setError('Enter your email and a password.'); return; }
    if (mode === 'signup' && password.length < 6) { setError('Password needs at least 6 characters.'); return; }
    setLoading(true); setError(null); setInfo(null);
    const res = mode === 'signup' ? await signUp(e, password) : await signIn(e, password);
    setLoading(false);
    if (res.error) { setError(res.error.message); return; }
    if (mode === 'signup' && !res.data.session) {
      setInfo('Account created — check your email to confirm, then sign in.');
    }
    // The auth listener in App.tsx picks up a real session and re-renders.
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <img src="./favicon.svg" alt="" className="login-logo" />
          <h1>Joinery Tracker</h1>
          <p className="muted">Your private business workspace</p>
        </div>
        <div className="divider" />
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          <input
            type="email" value={email} onChange={(ev) => setEmail(ev.target.value)}
            placeholder="you@email.com" autoComplete="username" aria-label="Email" className="input"
          />
          <input
            type="password" value={password} onChange={(ev) => setPassword(ev.target.value)}
            onKeyDown={(ev) => ev.key === 'Enter' && void submit()}
            placeholder="Password" aria-label="Password" className="input"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>
        {error && <p className="tiny text-red" style={{ textAlign: 'center', marginTop: 12 }}>{error}</p>}
        {info && <p className="tiny" style={{ textAlign: 'center', marginTop: 12 }}>{info}</p>}
        <button className="btn-google" style={{ marginTop: 14 }} onClick={() => void submit()} disabled={loading}>
          {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
        <button
          className="btn-plain"
          style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setInfo(null); }}
        >
          <span className="tiny muted">
            {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </span>
        </button>
        <p className="tiny muted" style={{ textAlign: 'center', marginTop: 16 }}>
          Your records are locked to your account.
        </p>
      </div>
    </div>
  );
}
