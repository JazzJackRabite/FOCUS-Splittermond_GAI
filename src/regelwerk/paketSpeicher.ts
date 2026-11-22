/**
 * Speichert hochgeladene Grimoires nur im Browser (IndexedDB). Nichts davon geht an einen Server oder ins Repo.
 * Ohne IndexedDB (privates Fenster, gesperrte Website-Daten, Tests) bleiben die Pakete nur bis zum Neuladen erhalten.
 */
export interface GespeichertesPaket { id: string; titel: string; text: string; gespeichertAm: string }

const DB_NAME = 'fokus-regelpakete';
/** interner Speichername (unverändert, damit bereits gespeicherte Grimoires erhalten bleiben) */
const STORE = 'buecher';
const fluechtig = new Map<string, GespeichertesPaket>();

function oeffne(name = DB_NAME): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function anfrage<T>(db: IDBDatabase, modus: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, modus);
      const r = f(tx.objectStore(STORE));
      r.onsuccess = () => resolve(r.result as T);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function alleGespeichertenPakete(): Promise<GespeichertesPaket[]> {
  const db = await oeffne();
  if (!db) return [...fluechtig.values()];
  const r = await anfrage<GespeichertesPaket[]>(db, 'readonly', s => s.getAll());
  db.close();
  return r ?? [...fluechtig.values()];
}

/** true: dauerhaft gespeichert; false: nur bis zum Neuladen der Seite */
export async function paketSpeichern(p: GespeichertesPaket): Promise<boolean> {
  fluechtig.set(p.id, p);
  const db = await oeffne();
  if (!db) return false;
  const r = await anfrage(db, 'readwrite', s => s.put(p));
  db.close();
  return r !== null;
}

export async function paketEntfernen(id: string): Promise<void> {
  fluechtig.delete(id);
  const db = await oeffne();
  if (!db) return;
  await anfrage(db, 'readwrite', s => s.delete(id));
  db.close();
}

// ---------------------------------------------------------------- Grundregelwerk für den Start ohne Netz

/** Zuletzt geladene Fassung des Grundregelwerks (Manifest und Paket als Text), eigene Datenbank */
export interface GespeicherteBasis { id: 'basis'; manifest: string; paket: string; gespeichertAm: string }
const BASIS_DB = 'fokus-grundregelwerk';

export async function basisSpeichern(manifest: string, paket: string): Promise<boolean> {
  const db = await oeffne(BASIS_DB);
  if (!db) return false;
  const r = await anfrage(db, 'readwrite', s => s.put({ id: 'basis', manifest, paket, gespeichertAm: new Date().toISOString() } satisfies GespeicherteBasis));
  db.close();
  return r !== null;
}

export async function gespeicherteBasis(): Promise<GespeicherteBasis | null> {
  const db = await oeffne(BASIS_DB);
  if (!db) return null;
  const r = await anfrage<GespeicherteBasis>(db, 'readonly', s => s.get('basis'));
  db.close();
  return r ?? null;
}
