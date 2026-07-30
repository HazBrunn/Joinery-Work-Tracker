// Selects the active repository from environment configuration.
//
// Firebase is kept alongside Supabase for the length of the move, so the old
// backend can still be read and exported from. Once the data is across and
// verified, the firebase backend, its repository and its dependency can go.
import { Repository } from './repository';
import { LocalRepository } from './localRepository';
import { SupabaseRepository } from './supabaseRepository';
import { FirebaseRepository } from './firebaseRepository';
import { supabaseConfigured } from '../supabase';
import { firebaseConfigured } from '../firebase';

export function createRepository(): Repository {
  const backend = import.meta.env.VITE_DATA_BACKEND;

  if (backend === 'supabase' && supabaseConfigured()) {
    return new SupabaseRepository();
  }
  if (backend === 'firebase' && firebaseConfigured()) {
    return new FirebaseRepository();
  }
  return new LocalRepository();
}

export type { Repository };
