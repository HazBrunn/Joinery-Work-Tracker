// Supabase client. This app shares one project with the life tracker and the
// training plan; joinery has a schema of its own, and RLS on user_id is the
// only thing separating the two accounts on it.
//
// The anon key is meant to be in the client bundle. It grants nothing on its
// own — every table's policy checks auth.uid().
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when the keys are present. Without them the app falls back to local storage. */
export const supabaseConfigured = (): boolean => Boolean(url && anonKey);

// The whole app only ever touches the joinery schema, so it is pinned here
// rather than at every call site.
//
// Null when unconfigured, but typed as though it always exists: nothing reaches
// a call on it without going through supabaseConfigured() first, and every
// alternative makes a hundred call sites carry a check that can't fire.
const client = supabaseConfigured()
  ? createClient(url, anonKey, { db: { schema: 'joinery' } })
  : null;
export const supabase = client as NonNullable<typeof client>;

export const PHOTO_BUCKET = 'joinery-photos';

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}
export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}
export async function signOutUser(): Promise<void> {
  await supabase.auth.signOut();
}
