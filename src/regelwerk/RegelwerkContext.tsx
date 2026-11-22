/**
 * Stellt den Regel-Katalog (Grundregelwerk + hochgeladene Grimoires) für den ganzen Editor bereit.
 * Hochgeladene Bücher bleiben im Browser (IndexedDB) und werden beim nächsten Start automatisch wieder geladen.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Katalog } from './katalog';
import type { LadePaket } from './typen';
import { basisAusTexten, grimoireLesen, erstelleKatalog, ladeBasis, type Basis } from './laden';
import { alleGespeichertenPakete, basisSpeichern, gespeicherteBasis, paketEntfernen, paketSpeichern } from './paketSpeicher';
import { setzeAktivenKatalog } from './bruecke';

export type RegelwerkStatus = 'laedt' | 'bereit' | 'fehler' | 'nicht_verfuegbar';

export interface Regelwerk {
  status: RegelwerkStatus;
  katalog: Katalog | null;
  basis: Basis | null;
  grimoires: LadePaket[];
  ausgelassen: { id: string; grund: string }[];
  meldungen: string[];
  fehler: string | null;
  /** nur im Browser gespeichert, wenn false: bleibt bis zum Neuladen */
  dauerhaft: boolean;
  hochladen: (dateien: File[]) => Promise<{ geladen: string[]; fehler: string[] }>;
  entfernen: (id: string) => Promise<void>;
}

const NICHT_VERFUEGBAR: Regelwerk = {
  status: 'nicht_verfuegbar', katalog: null, basis: null, grimoires: [], ausgelassen: [], meldungen: [], fehler: null, dauerhaft: true,
  hochladen: async () => ({ geladen: [], fehler: ['Regelwerk ist nicht geladen.'] }), entfernen: async () => {},
};

const RegelwerkKontext = createContext<Regelwerk>(NICHT_VERFUEGBAR);

export const RegelwerkProvider: React.FC<{ children: React.ReactNode; basisUrl?: string }> = ({ children, basisUrl }) => {
  const [basis, setBasis] = useState<Basis | null>(null);
  const [grimoires, setGrimoires] = useState<LadePaket[]>([]);
  const [status, setStatus] = useState<RegelwerkStatus>('laedt');
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldungen, setMeldungen] = useState<string[]>([]);
  const [dauerhaft, setDauerhaft] = useState(true);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        // Grundregelwerk aus public/; ohne Netz die zuletzt geladene Fassung aus dem Browser
        let b: Basis; const m: string[] = [];
        try {
          b = await ladeBasis(basisUrl);
          if (b.roh && !b.warnungen.length) void basisSpeichern(b.roh.manifest, b.roh.paket);
        } catch (e) {
          const g = await gespeicherteBasis();
          if (!g) throw e;
          b = await basisAusTexten(g.manifest, g.paket);
          m.push(`Grundregelwerk ohne Netz: gespeicherte Fassung vom ${new Date(g.gespeichertAm).toLocaleDateString('de-DE')} (${(e as Error).message}).`);
        }
        m.push(...b.warnungen);
        const gespeichert = await alleGespeichertenPakete();
        const geladen: LadePaket[] = [];
        for (const g of gespeichert) {
          try { geladen.push(grimoireLesen(g.text, b.manifest)); } catch (e) { m.push(`${g.titel}: ${(e as Error).message}`); }
        }
        if (!aktiv) return;
        setBasis(b); setGrimoires(geladen); setMeldungen(m); setStatus('bereit');
      } catch (e) {
        if (!aktiv) return;
        setFehler((e as Error).message); setStatus('fehler');
      }
    })();
    return () => { aktiv = false; };
  }, [basisUrl]);

  const { katalog, ausgelassen } = useMemo(() => {
    if (!basis) return { katalog: null, ausgelassen: [] };
    const r = erstelleKatalog(basis, grimoires);
    setzeAktivenKatalog(r.katalog, false); // sofort für Berechnungen im selben Render verfügbar
    return r;
  }, [basis, grimoires]);

  // Katalog für Berechnungen und Auswahllisten außerhalb von React bereitstellen (regelwerk/bruecke.ts)
  useEffect(() => { if (katalog) setzeAktivenKatalog(katalog); }, [katalog]);
  useEffect(() => () => setzeAktivenKatalog(null), []);

  const hochladen = useCallback(async (dateien: File[]) => {
    const ok: string[] = []; const err: string[] = [];
    if (!basis) return { geladen: ok, fehler: ['Das Grundregelwerk ist noch nicht geladen.'] };
    const neu: LadePaket[] = [];
    for (const d of dateien) {
      try {
        const text = await d.text();
        const p = grimoireLesen(text, basis.manifest);
        const persistent = await paketSpeichern({ id: p.info.id, titel: p.info.titel, text, gespeichertAm: new Date().toISOString() });
        if (!persistent) setDauerhaft(false);
        neu.push(p); ok.push(p.info.titel);
      } catch (e) {
        err.push(`${d.name}: ${(e as Error).message}`);
      }
    }
    if (neu.length) setGrimoires(alt => [...alt.filter(b => !neu.some(n => n.info.id === b.info.id)), ...neu]);
    return { geladen: ok, fehler: err };
  }, [basis]);

  const entfernen = useCallback(async (id: string) => {
    await paketEntfernen(id);
    setGrimoires(alt => alt.filter(b => b.info.id !== id));
  }, []);

  const wert = useMemo<Regelwerk>(() => ({ status, katalog, basis, grimoires, ausgelassen, meldungen, fehler, dauerhaft, hochladen, entfernen }),
    [status, katalog, basis, grimoires, ausgelassen, meldungen, fehler, dauerhaft, hochladen, entfernen]);
  return <RegelwerkKontext.Provider value={wert}>{children}</RegelwerkKontext.Provider>;
};

export function useRegelwerk(): Regelwerk {
  return useContext(RegelwerkKontext);
}
