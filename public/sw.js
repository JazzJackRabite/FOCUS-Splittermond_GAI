/*
 * FOKUS – Service Worker für den Start ohne Netz.
 * Speichert die Dateien der App (Seite, Skripte, Stile, Schriften), sobald sie einmal mit Netz geladen wurden.
 * Immer zuerst aus dem Netz (so kommen Aktualisierungen sofort an), ohne Netz aus dem Zwischenspeicher.
 * Regelpakete und Grimoires laufen NICHT hierüber: Das Grundregelwerk speichert der Editor selbst in IndexedDB
 * (regelwerk/paketSpeicher.ts) und meldet dann „Grundregelwerk ohne Netz“; Grimoires liegen ohnehin nur im Browser.
 */
const SPEICHER = 'fokus-app-v1';
const SCHRIFTEN = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SPEICHER) await caches.delete(k);
    await self.clients.claim();
  })());
});

/** gehört die Adresse in den Zwischenspeicher? (eigene Dateien außer Regelpaketen, dazu die Schriften) */
function speichern(adresse) {
  const url = new URL(adresse);
  if (url.origin === self.location.origin) return !url.pathname.includes('/regelpakete/');
  return SCHRIFTEN.includes(url.origin);
}

// Beim ersten Besuch lädt die Seite ihre Dateien, bevor der Service Worker sie übernimmt; sie schickt die Liste nach.
self.addEventListener('message', (e) => {
  if (!e.data || e.data.art !== 'speichern' || !Array.isArray(e.data.adressen)) return;
  e.waitUntil((async () => {
    const speicher = await caches.open(SPEICHER);
    for (const a of e.data.adressen) {
      if (typeof a !== 'string' || !speichern(a) || await speicher.match(a, { ignoreVary: true })) continue;
      try { const antwort = await fetch(a); if (antwort.ok) await speicher.put(a, antwort); } catch { /* ohne Netz: später */ }
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || !speichern(r.url)) return;
  e.respondWith((async () => {
    const speicher = await caches.open(SPEICHER);
    try {
      const antwort = await fetch(r);
      if (antwort.ok || antwort.type === 'opaque') speicher.put(r, antwort.clone()).catch(() => {});
      return antwort;
    } catch (fehler) {
      // ignoreVary: manche Server schicken „Vary: Origin“; die gespeicherte Anfrage hatte womöglich eine andere Herkunftsangabe
      const alt = await speicher.match(r, { ignoreSearch: r.mode === 'navigate', ignoreVary: true });
      if (alt) return alt;
      // Seitenaufruf unter einer anderen Adresse innerhalb der App: die gespeicherte Startseite
      if (r.mode === 'navigate') {
        const start = await speicher.match(new URL('./', self.registration.scope).href, { ignoreVary: true });
        if (start) return start;
      }
      throw fehler;
    }
  })());
});
