// Tiny IndexedDB blob store for the setup wizard.
// localStorage can't hold logo + document blobs (quota ~5MB), so keep them here.

const DB_NAME = "eec.setup";
const STORE = "blobs";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try { await withStore("readwrite", (s) => s.put(value as unknown as any, key)); } catch { /* ignore */ }
}

export async function idbGet<T = unknown>(key: string): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const v = await withStore<T>("readonly", (s) => s.get(key) as IDBRequest<T>);
    return (v ?? null) as T | null;
  } catch { return null; }
}

export async function idbDel(key: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try { await withStore("readwrite", (s) => s.delete(key)); } catch { /* ignore */ }
}

export async function idbClearSetup(): Promise<void> {
  await Promise.all([idbDel("logo"), idbDel("documents")]);
}

// Convenience shapes ----------------------------------------------------------
export type StoredLogo = { name: string; type: string; blob: Blob } | null;
export type StoredDocFile = {
  code: string; // maps to SetupDocument.code
  name: string;
  type: string;
  blob: Blob;
};
