// Playlists are stored in the browser (IndexedDB) including the audio files themselves,
// so they survive reloads and work offline. Files are stored byte-for-byte (no re-encoding).
export type StoredItem = { file: File; title: string; duration: number; artist?: string; album?: string; genre?: string; folder?: string; source?: string; trackNumber?: number };
export type StoredPlaylist = { name: string; items: StoredItem[]; savedAt: number };

export const QUEUE_KEY = "__queue__";
export const LIBRARY_KEY = "__library__";
const DB = "llamamp";
const STORE = "playlists";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "name" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      res(req.result);
    };
    t.onerror = () => rej(t.error);
  });
}

export const savePlaylist = (p: StoredPlaylist) => tx("readwrite", (s) => s.put(p));
export const loadPlaylist = (name: string) =>
  tx<StoredPlaylist | undefined>("readonly", (s) => s.get(name) as IDBRequest<StoredPlaylist | undefined>);
export const deletePlaylist = (name: string) => tx("readwrite", (s) => s.delete(name));
export async function listPlaylists() {
  const all = await tx<StoredPlaylist[]>("readonly", (s) => s.getAll() as IDBRequest<StoredPlaylist[]>);
  return all
    .filter((p) => p.name !== QUEUE_KEY && p.name !== LIBRARY_KEY)
    .map((p) => ({ name: p.name, count: p.items.length, savedAt: p.savedAt }))
    .sort((a, b) => b.savedAt - a.savedAt);
}
