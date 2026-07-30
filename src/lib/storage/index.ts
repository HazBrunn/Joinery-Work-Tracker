// Selects the active repository from environment configuration.
import { Repository } from './repository';
import { LocalRepository } from './localRepository';
import { SupabaseRepository } from './supabaseRepository';
import { supabaseConfigured } from '../supabase';

export function createRepository(): Repository {
  const backend = import.meta.env.VITE_DATA_BACKEND;

  if (backend === 'supabase' && supabaseConfigured()) {
    return new SupabaseRepository();
  }
  return new LocalRepository();
}

export type { Repository };
