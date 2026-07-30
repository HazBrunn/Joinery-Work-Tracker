import { useState } from 'react';
import { signIn, signUp } from '../lib/supabase';
import { signInWithGoogle } from '../lib/firebase';

// Email and password against the same Supabase project as the life tracker, so
// auth.uid() is the id every joinery row is filed under and RLS is the boundary.
//
// Google sign-in is still here for as long as the Firebase backend is, because
// the old data cannot be exported without being able to sign in to read it.
export function Login({ firebase }: { firebase?: boolean }) {
  if (firebase) return <GoogleLogin />;
  return <SupabaseLogin />;
}

function SupabaseLogin() {
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
          <img src="./icon-192.png" alt="" className="login-logo" />
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

// The Firebase path, unchanged, for as long as that backend is readable.
function GoogleLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError('Sign in failed — please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <img src="./icon-192.png" alt="" className="login-logo" />
          <h1>Joinery Tracker</h1>
          <p className="muted">Your private business workspace</p>
        </div>
        <div className="divider" />
        <p className="tiny" style={{ textAlign: 'center', margin: '16px 0' }}>
          Sign in with the Google account that owns this tracker.
          <br />
          Only your account can access this data.
        </p>
        <button className="btn-google" onClick={() => void handleSignIn()} disabled={loading}>
          {loading ? 'Signing in…' : <><GoogleIcon /> Sign in with Google</>}
        </button>
        {error && <p className="tiny text-red" style={{ textAlign: 'center', marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.148 17.64 11.84 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
