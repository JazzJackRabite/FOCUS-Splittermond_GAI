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

/** Heiltrank mit fester Heilung (Alchemika mit Feld `heilung_lp`) */
export interface Heiltrank { id: string; name: string; lp: number; quelle: string; seite?: number }

/** Heiltränke aus allen geladenen Paketen; gleichnamige mit gleicher Heilung nur einmal (der erste, GRW zuerst) */
export function heiltraenke(k: Katalog | null = aktiverKatalog()): Heiltrank[] {
  if (!k) return [];
  const out: Heiltrank[] = [];
  for (const e of k.nachTyp('alchemikum')) {
    const lp = e.daten.heilung_lp;
    if (typeof lp !== 'number' || out.some((h) => h.name === e.name && h.lp === lp)) continue;
    out.push({ id: e.id, name: e.name, lp, quelle: k.pakete[e.quelle.paket]?.kuerzel ?? e.quelle.paket, seite: (e.quelle.buch_seiten ?? [])[0] });
  }
  return out.sort((a, b) => a.lp - b.lp || a.name.localeCompare(b.name, 'de'));
}

// ---------------------------------------------------------------- Sterben (GRW S. 172–173)
const STERBEN_ID = 'grw:regel:kampf-regeln:sterben';

export interface SterbeZustand { key: string; level?: number; ursache?: string }
export interface Sterberegeln {
  /** Zustand beim ersten echten Schadenspunkt auf der letzten Gesundheitsstufe (Todgeweiht) */
  beiErstemSchaden: SterbeZustand[];
  /** Probe gegen Wundschock (Fertigkeit, Schwierigkeit); misslungen: bewusstlos */
  probe: { fertigkeit: string; schwierigkeit: number } | null;
  /** Zustände, wenn alle Lebenspunkte der letzten Stufe verloren sind */
  beiAllenLp: SterbeZustand[];
  /** tot, wenn der echte Schaden über die letzte Stufe hinaus mehr als totMehrAlsStufen × LP beträgt */
  totMehrAlsStufen: number;
  quelle: string;
}

type ZustandRoh = { name?: string; stufe?: number; ursache?: string };
const alsZustand = (z: ZustandRoh): SterbeZustand => ({ key: String(z.name ?? ''), ...(z.stufe ? { level: z.stufe } : {}), ...(z.ursache ? { ursache: z.ursache } : {}) });

/** Regeln zum Sterben aus dem Paket (Kernregel „Sterben“, strukturiert); ohne Paket null (keine automatischen Zustände) */
export function sterberegeln(k: Katalog | null = aktiverKatalog()): Sterberegeln | null {
  const e = k?.get(STERBEN_ID);
  const s = e?.daten.strukturiert as {
    zustand_bei_erstem_schaden?: ZustandRoh; zustaende_bei_allen_lp?: ZustandRoh[]; tot_mehr_als_stufen?: number;
    erster_echter_schaden_auf_todgeweiht?: { probe?: { fertigkeit?: string; schwierigkeit?: number } };
  } | undefined;
  if (!e || !s?.zustand_bei_erstem_schaden || typeof s.tot_mehr_als_stufen !== 'number') return null;
  const p = s.erster_echter_schaden_auf_todgeweiht?.probe;
  const fName = p?.fertigkeit ? k!.get(p.fertigkeit)?.name ?? '' : '';
  const seiten = e.quelle.buch_seiten ?? [];
  return {
    beiErstemSchaden: [alsZustand(s.zustand_bei_erstem_schaden)],
    probe: fName && typeof p?.schwierigkeit === 'number' ? { fertigkeit: fName, schwierigkeit: p.schwierigkeit } : null,
    beiAllenLp: (s.zustaende_bei_allen_lp ?? []).map(alsZustand),
    totMehrAlsStufen: s.tot_mehr_als_stufen,
    quelle: seiten.length ? `GRW S. ${seiten.length > 1 ? `${seiten[0]}–${seiten[seiten.length - 1]}` : seiten[0]}` : 'GRW',
  };
}

/** Zahl der Kästchen der Lebenspunkt-Leiste: alle Gesundheitsstufen plus der Bereich, in dem der Abenteurer noch nicht tot ist */
export function lpKaestchen(maxLP: number, k: Katalog | null = aktiverKatalog()): number {
  const stufen = standardGesundheitsstufen(k).length;
  const tot = sterberegeln(k)?.totMehrAlsStufen;
  if (!maxLP || !stufen) return 0;
  return tot ? maxLP * (stufen + tot) + 1 : maxLP * stufen;
}

/**
 * Stand des Sterbens aus der Leiste (nur echter Schaden zählt): 0 = nicht sterbend, sonst die Stufe des Zustands Sterbend
 * aus dem Paket (GRW: 2 ab dem ersten Punkt auf Todgeweiht, 3 wenn alle LP dort verloren sind), 4 = tot.
 */
export function sterbestand(slots: { type: string }[], maxLP: number, k: Katalog | null = aktiverKatalog()): { stufe: 0 | 2 | 3 | 4; zustaende: SterbeZustand[] } {
  const r = sterberegeln(k); const n = standardGesundheitsstufen(k).length;
  if (!r || !maxLP || !n) return { stufe: 0, zustaende: [] };
  const echt = slots.filter((s) => s.type === 'consumed').length;
  const aufLetzter = echt - maxLP * (n - 1);
  const darueber = echt - maxLP * n;
  const sterbend = (l: SterbeZustand[]) => (l.find((z) => z.level)?.level ?? 0) as 0 | 2 | 3;
  if (darueber > maxLP * r.totMehrAlsStufen) return { stufe: 4, zustaende: [...r.beiErstemSchaden, ...r.beiAllenLp] };
  if (aufLetzter >= maxLP) return { stufe: sterbend(r.beiAllenLp) || sterbend(r.beiErstemSchaden), zustaende: [...r.beiErstemSchaden, ...r.beiAllenLp] };
  if (aufLetzter >= 1) return { stufe: sterbend(r.beiErstemSchaden), zustaende: r.beiErstemSchaden };
  return { stufe: 0, zustaende: [] };
}
