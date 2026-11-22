/**
 * Regelwerte für den Schadens- und den Heildialog (FUNDAMENT.md, Regelquellen):
 * - Gesundheitsstufen und Wundabzüge aus den Kernregeln (`regelwerk/vitals.ts`),
 * - Schadensminderung durch einen Splitterpunkt aus `strukturiert.gaben` der Splittergaben (GRW S. 81),
 * - Wirkung und Dauer der Verschnaufpause aus `strukturiert.pausen` bzw. `ruheregeln` der Kernregel „Heilung“ (GRW S. 173),
 * - Zustände mit Stufe und Höchststufe aus den Zustandseinträgen (`hat_stufe`, `zustandswirkung.hoechststufe`).
 * Ohne Paket keine Werte (der Editor startet erst mit geladenem Paket).
 */
import type { Katalog } from './katalog';
import { aktiverKatalog } from './bruecke';
import { gesundheitsstufen, type Gesundheitsstufe } from './vitals';
import { ruheregeln } from './spielwirkungen';
import { zustand, zustandsliste, KAMPFPOSITION_LIEGEND } from './zustaende';

const SPLITTERGABEN_ID = 'grw:regel:splitter-regeln:splittergaben';
const HEILUNG_ID = 'grw:regel:kampf-regeln:heilung';

/** Gesundheitsstufen eines Abenteurers (fünf im GRW) */
export function standardGesundheitsstufen(k: Katalog | null = aktiverKatalog()): Gesundheitsstufe[] {
  return gesundheitsstufen(k).stufen;
}

export interface Splitterminderung { punkte: number; text: string; quelle: string }
/** Schadensminderung durch die Splittergabe „Schadensminderung“ (null, wenn das Paket sie nicht nennt) */
export function splitterSchadensminderung(k: Katalog | null = aktiverKatalog()): Splitterminderung | null {
  if (!k) return null;
  const e = k.get(SPLITTERGABEN_ID);
  const g = (e?.daten.strukturiert?.gaben ?? []).find((x: { name: string }) => x.name === 'Schadensminderung');
  const m = String(g?.wirkung ?? '').match(/[−-]\s*(\d+)/);
  if (!e || !m) return null;
  const s: number[] = e.quelle?.buch_seiten ?? [];
  return { punkte: Number(m[1]), text: String(g.wirkung), quelle: s.length ? `GRW S. ${s[0]}` : 'GRW' };
}

export interface Verschnaufpause { minuten: number; wirkung: string; quelle: string }
/** Dauer und Wirkung der Verschnaufpause */
export function verschnaufpause(k: Katalog | null = aktiverKatalog()): Verschnaufpause {
  const r = ruheregeln(k);
  const p = (k?.get(HEILUNG_ID)?.daten.strukturiert?.pausen ?? []).find((x: { name: string }) => x.name === 'Verschnaufpause');
  return { minuten: r.verschnaufMinuten, wirkung: String(p?.wirkung ?? ''), quelle: r.quelle };
}

export interface ZustandsWahl { name: string; mitStufe: boolean; hoechststufe?: number; quelle: string }
/** Zustände für die Auswahl im Schadensdialog (alle aus den Paketen, dazu die Kampfposition Liegend) */
export function zustaendeFuerSchaden(k: Katalog | null = aktiverKatalog()): ZustandsWahl[] {
  return zustandsliste(k).map(z => ({ name: z.name, mitStufe: z.mitStufe, hoechststufe: z.wirkung?.probe?.hoechststufe, quelle: z.quelle }));
}

/** Höchststufe eines Zustands laut Paket (undefined = keine Grenze genannt) */
export function zustandHoechststufe(name: string, k: Katalog | null = aktiverKatalog()): number | undefined {
  return zustand(name, k)?.wirkung?.probe?.hoechststufe;
}

export { KAMPFPOSITION_LIEGEND };

/** Auswirkungen einer Heilkunde-Probe aus der Fertigkeitsbeschreibung (Erfolgsstufe → Text) */
export function heilkundeAuswirkungen(k: Katalog | null = aktiverKatalog()): Record<string, string> {
  return (k?.get('grw:fertigkeit:heilkunde')?.daten.auswirkungen as Record<string, string> | undefined) ?? {};
}
