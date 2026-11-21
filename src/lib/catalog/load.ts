/**
 * Client-side catalog loading. catalog-meta.json (small) is fetched first; if
 * the version in IndexedDB matches, the cached copy is used, otherwise the
 * snapshot is downloaded and cached. All files are same-origin static files.
 */
import type { CatalogFile, CatalogSourceInfo, Target } from './types';
import { unpackCatalog } from './normalize';

export interface CatalogMeta {
  generated: string;
  catalog: { count: number; generated: string };
  toi: { count: number; generated: string };
  sources: CatalogSourceInfo[];
}

const DB = 'transit-planner';
const STORE = 'catalog';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}

async function idbPut(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* private mode or storage disabled: just don't cache */
  }
}

const base = import.meta.env.BASE_URL;

export async function fetchMeta(): Promise<CatalogMeta> {
  const res = await fetch(`${base}data/catalog-meta.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`catalog-meta.json: HTTP ${res.status}`);
  return res.json();
}

export async function loadCatalogFile(name: 'catalog' | 'toi', version: string): Promise<{ targets: Target[]; file: CatalogFile }> {
  const cached = await idbGet<CatalogFile>(name);
  if (cached && cached.generated === version) return { targets: unpackCatalog(cached), file: cached };
  const res = await fetch(`${base}data/${name}.json`);
  if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
  const file = (await res.json()) as CatalogFile;
  void idbPut(name, file);
  return { targets: unpackCatalog(file), file };
}
