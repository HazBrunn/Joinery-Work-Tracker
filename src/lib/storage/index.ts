// Selects the active repository from environment configuration.
import { Repository } from './repository';
import { LocalRepository } from './localRepository';
import { FirebaseRepository } from './firebaseRepository';
import { firebaseConfigured } from '../firebase';

export function createRepository(): Repository {
  const backend = import.meta.env.VITE_DATA_BACKEND;

  if (backend === 'firebase' && firebaseConfigured()) {
    return new FirebaseRepository();
  }
  return new LocalRepository();
}

export type { Repository };
