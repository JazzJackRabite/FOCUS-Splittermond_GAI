/**
 * Lebenspunkte und Fokus von Begleitern nach den Regeldaten:
 * - Gesundheitsstufen und Wundabzüge aus grw:regel:abgeleitete-werte-regeln:berechnung-der-abgeleiteten-werte (strukturiert).
 * - Merkmale, die die Zahl der Gesundheitsstufen ändern (z. B. Schwächlich, Zerbrechlich), werden aus der Beschreibung des
 *   Monstermerkmals gelesen („Auf diesen Stufen werden die Regeln für die Stufen … angewendet“).
 * - Immunität gegen Betäubungsschaden (z. B. Konstrukt) ebenfalls aus der Merkmalsbeschreibung.
 * - Betäubungs- und kanalisierter Schaden verursachen keine Wundabzüge (wundabzuege.nur_echter_schaden).
 * - Stufe wie beim Abenteurer (characterCalculations): die Stufe, in der der letzte verlorene Lebenspunkt liegt.
 */
import type { Katalog } from './katalog';
import { ABGELEITET_ID } from './abgeleitet';
import { norm } from './bruecke';
import { wundstufenVerschiebung } from './zustaende';

export interface Gesundheitsstufe { name: string; wundabzug: number }
export interface BegleiterZustand {
  schaden?: number; betaeubung?: number; kanalisiert?: number;
  fokus?: { erschoepft?: number; kanalisiert?: number; verzehrt?: number };
  /** Zustände (gleiches Format wie beim Abenteurer) */
  zustaende?: { id: string; key: string; level?: number; note?: string }[];
}


function monstermerkmal(k: Katalog, merkmal: string) {
  const n = norm(merkmal.replace(/\s*[(\d].*$/, ''));
  return Object.values(k.eintraege).find(e => e.typ === 'monstermerkmal' && norm(e.name) === n);
}

/** Gesundheitsstufen eines Wesens mit diesen Merkmalen */
export function gesundheitsstufen(k: Katalog | null, merkmale: string[] = []): { stufen: Gesundheitsstufe[]; quelle: string | null } {
  const alle: Gesundheitsstufe[] = k?.get(ABGELEITET_ID)?.daten.strukturiert?.gesundheitsstufen?.map((s: { name: string; wundabzug: number }) => ({ name: s.name, wundabzug: s.wundabzug })) ?? [];
  if (k) for (const m of merkmale) {
    // eigene Gesundheitsstufen des Merkmals (Datenseite: gesundheitsstufen_namen)
    const eigene: string[] = monstermerkmal(k, m)?.daten.gesundheitsstufen_namen ?? [];
    const namen = alle.filter(s => eigene.includes(s.name));
    if (namen.length) return { stufen: namen, quelle: m.replace(/\s*[(\d].*$/, '') };
  }
  return { stufen: alle, quelle: null };
}

/** Immun gegen Betäubungsschaden (z. B. Konstrukt)? */
export function betaeubungsimmun(k: Katalog | null, merkmale: string[] = []): boolean {
  if (!k) return false;
  return merkmale.some(m => !!monstermerkmal(k, m)?.daten.betaeubungsimmun);
}

export interface Lebenslage {
  lp: number; stufen: Gesundheitsstufe[]; gesamt: number;
  verloren: number; frei: number;
  /** Gesundheitsstufe nach allem verlorenen LP (Anzeige) */
  stufe: number;
  /** Wundabzug aus echtem Schaden, verschoben durch Zustände wie Verwundet */
  wundabzug: number; stufenName: string;
  ausser: boolean;
}

/** Lage der Lebenspunkte: lp = Lebenspunkte je Gesundheitsstufe */
export function lebenslage(lp: number, stufen: Gesundheitsstufe[], z: BegleiterZustand = {}): Lebenslage {
  const gesamt = Math.max(0, lp) * stufen.length;
  const schaden = z.schaden ?? 0; const verloren = Math.min(gesamt, schaden + (z.betaeubung ?? 0) + (z.kanalisiert ?? 0));
  const idx = (n: number) => (lp > 0 && n > 0 ? Math.min(stufen.length - 1, Math.floor((n - 1) / lp)) : 0);
  const ausser = gesamt > 0 && verloren >= gesamt;
  const stufe = idx(verloren);
  // Verwundet u. ä.: je Stufe eine Gesundheitsstufe tiefer (nur für den Wundabzug)
  const schieben = wundstufenVerschiebung(z.zustaende ?? []);
  const echte = stufen[Math.min(stufen.length - 1, idx(Math.min(schaden, gesamt)) + schieben)];
  return {
    lp, stufen, gesamt, verloren, frei: gesamt - verloren, stufe,
    wundabzug: schaden > 0 || schieben > 0 ? echte?.wundabzug ?? 0 : 0, stufenName: ausser ? 'Außer Gefecht' : stufen[stufe]?.name ?? '',
    ausser,
  };
}

/** Freier Fokus */
export function fokusFrei(fo: number, z: BegleiterZustand = {}): number {
  const f = z.fokus ?? {};
  return Math.max(0, fo - (f.erschoepft ?? 0) - (f.kanalisiert ?? 0) - (f.verzehrt ?? 0));
}

/** Gesundheitsfelder im Format der Modale (Schaden, Betäubung, kanalisiert, frei) */
export function gesundheitsfelder(gesamt: number, z: BegleiterZustand = {}): { type: 'empty' | 'exhausted' | 'consumed' | 'channeled' }[] {
  const s = z.schaden ?? 0; const b = z.betaeubung ?? 0; const k = z.kanalisiert ?? 0;
  return Array.from({ length: gesamt }, (_, i) => ({ type: i < s ? 'consumed' : i < s + b ? 'exhausted' : i < s + b + k ? 'channeled' : 'empty' }));
}

/** Schaden eintragen; Betäubungs- und kanalisierter Schaden über die letzte Stufe hinaus wird zu echtem Schaden */
export function schadenEintragen(gesamt: number, z: BegleiterZustand, art: 'consumed' | 'exhausted' | 'channeled', menge: number): BegleiterZustand {
  const s = z.schaden ?? 0; const b = z.betaeubung ?? 0; const k = z.kanalisiert ?? 0;
  if (art === 'consumed') return { ...z, schaden: Math.min(gesamt, s + menge) };
  const frei = Math.max(0, gesamt - s - b - k);
  const passt = Math.min(frei, menge); const ueber = menge - passt;
  const neu = art === 'exhausted' ? { ...z, betaeubung: b + passt } : { ...z, kanalisiert: k + passt };
  if (ueber > 0) {
    // Überlauf verdrängt Betäubung/kanalisiert und wird echter Schaden
    const s2 = Math.min(gesamt, s + ueber);
    const rest = Math.max(0, gesamt - s2);
    const b2 = Math.min(neu.betaeubung ?? 0, rest); const k2 = Math.min(neu.kanalisiert ?? 0, rest - b2);
    return { ...neu, schaden: s2, betaeubung: b2, kanalisiert: k2 };
  }
  return neu;
}
