/**
 * Zustände aus den Regelpaketen (FUNDAMENT.md, Regelquellen): Die Zustände des Grundregelwerks kommen aus dem
 * Grundregelwerk-Paket, alle anderen aus den hochgeladenen Grimoires.
 * Stufe, Abzüge und Quelle stehen im Eintrag vom Typ `zustand` (`hat_stufe`/`parameter`, `zustandswirkung`, `quelle`).
 * „Liegend“ ist kein Zustand, sondern eine Kampfposition (GRW S. 170); der Editor führt sie in derselben Auswahl,
 * weil sie am Spieltisch genauso an- und abgelegt wird.
 * Ohne geladenes Paket gibt es keine Zustände (der Editor startet erst mit Paket).
 */
import { aktiverKatalog } from './bruecke';
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';
import type { Zustandswirkung } from '../types/regeldaten';
import { quelleText } from './relikte';

export const KAMPFPOSITION_LIEGEND = 'Liegend';

export interface Zustandsangabe { name: string; mitStufe: boolean; quelle: string; id?: string; wirkung?: Zustandswirkung; beschreibung?: string }

let cache: { k: Katalog | null; liste: Zustandsangabe[] } | null = null;

function ausEintrag(k: Katalog, e: Eintrag): Zustandsangabe {
  const d = (e.daten ?? {}) as { hat_stufe?: boolean; parameter?: unknown; zustandswirkung?: Zustandswirkung; beschreibung?: string };
  const p = Array.isArray(d.parameter) ? d.parameter.join(',') : String(d.parameter ?? '');
  return { name: e.name, mitStufe: d.hat_stufe ?? /\bStufe\b/.test(p), quelle: quelleText(k, e), id: e.id, wirkung: d.zustandswirkung, beschreibung: d.beschreibung };
}

/** Alle wählbaren Zustände, alphabetisch: aus den geladenen Paketen */
export function zustandsliste(k: Katalog | null = aktiverKatalog()): Zustandsangabe[] {
  if (cache && cache.k === k) return cache.liste;
  const nachName = new Map<string, Zustandsangabe>();
  if (k) for (const e of k.nachTyp('zustand')) if (!nachName.has(e.name)) nachName.set(e.name, ausEintrag(k, e));
  if (k) nachName.set(KAMPFPOSITION_LIEGEND, { name: KAMPFPOSITION_LIEGEND, mitStufe: false, quelle: 'GRW S. 170 (Kampfposition)' });
  const liste = [...nachName.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  cache = { k, liste };
  return liste;
}

export function zustand(name: string, k: Katalog | null = aktiverKatalog()): Zustandsangabe | undefined {
  return zustandsliste(k).find((z) => z.name === name);
}

export function alleZustaende(k: Katalog | null = aktiverKatalog()): string[] {
  return zustandsliste(k).map((z) => z.name);
}

export function zustandHatStufe(name: string, k: Katalog | null = aktiverKatalog()): boolean {
  return zustand(name, k)?.mitStufe ?? false;
}

export function istZustand(name: string, k: Katalog | null = aktiverKatalog()): boolean {
  return !!zustand(name, k);
}

/** Quellenangabe für die Anzeige beim Überfahren mit der Maus, z. B. „GRW S. 168“ */
export function zustandQuelle(name: string, k: Katalog | null = aktiverKatalog()): string {
  return zustand(name, k)?.quelle ?? '';
}
