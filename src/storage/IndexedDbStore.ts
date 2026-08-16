import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { Project } from '@/domain/models/Project';

const DB_NAME = 'boxes-js';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export interface StoredProject {
  id: string;
  name: string;
  project: Project;
  updatedAt: number;
}

interface BoxesDb extends DBSchema {
  projects: {
    key: string;
    value: StoredProject;
    indexes: { updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<BoxesDb>> | null = null;

function getDb(): Promise<IDBPDatabase<BoxesDb>> {
  dbPromise ??= openDB<BoxesDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt');
    },
  });
  return dbPromise;
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  // IndexedDB stores values via the structured clone algorithm, which
  // can't clone Vue/Pinia's reactive Proxy objects ("#<Object> could not
  // be cloned"). A JSON round-trip -- the same technique HistoryManager
  // uses for its snapshots -- guarantees a plain, cloneable object.
  const plainProject: Project = JSON.parse(JSON.stringify(project));
  await db.put(STORE_NAME, { id: plainProject.id, name: plainProject.name, project: plainProject, updatedAt: Date.now() });
}

export async function listRecentProjects(limit = 10): Promise<StoredProject[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORE_NAME, 'updatedAt');
  return all.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

export async function loadStoredProject(id: string): Promise<Project | null> {
  const db = await getDb();
  const record = await db.get(STORE_NAME, id);
  return record?.project ?? null;
}

export async function deleteStoredProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}
