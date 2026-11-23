/**
 * Ob ein Eintrag (Stärke, Ressource, Sprache) noch gewählt werden darf und bis zu welcher Stufe.
 * Grenzen kommen aus den Listendaten (Paket): „nur bei Generierung", „mehrfach wählbar" mit Anzahl,
 * höchste Stufe der Ressourcentabelle. Bereits vorhandene Einträge zählen mit.
 */
import type { AppMode, ItemEntry } from '../types';

export type ListenArt = 'strength' | 'resource' | 'language' | 'weakness';

export interface ListenDaten {
  name: string;
  /** Stärke: höchste Gesamtstufe bzw. Anzahl Wahlen */
  max?: number;
  /** Stärke: mehrfach wählbar */
  multi?: boolean;
  /** Stärke: nur bei der Erschaffung wählbar */
  onlyCreation?: boolean;
  /** Ressource: höchste Stufe der Tabelle */
  maxStufe?: number;
}

export interface ListenSperre {
  /** Grund, warum der Eintrag nicht wählbar ist, sonst null */
  grund: string | null;
  /** höchste Stufe, die jetzt noch dazukommen darf (≥ 1, wenn wählbar) */
  restStufen: number;
  /** bereits vorhandene Stufen dieses Eintrags */
  vorhanden: number;
}

const RESSOURCE_HOECHSTENS = 6;

export function listenSperre(art: ListenArt, eintrag: ListenDaten | null, name: string, mode: AppMode,
  vorhandene: ItemEntry[]): ListenSperre {
  const gleiche = vorhandene.filter((e) => e.name === name);
  const vorhanden = gleiche.reduce((s, e) => s + (Number(e.level) || 1), 0);
  if (art === 'weakness') return { grund: gleiche.length ? 'Bereits gewählt' : null, restStufen: 1, vorhanden };
  if (art === 'language') return { grund: gleiche.length ? 'Bereits bekannt' : null, restStufen: 1, vorhanden };
  if (art === 'resource') {
    const max = eintrag?.maxStufe ?? RESSOURCE_HOECHSTENS;
    const rest = max - vorhanden;
    return { grund: rest <= 0 ? `Höchststufe ${max} erreicht` : null, restStufen: Math.max(0, rest), vorhanden };
  }
  // Stärke
  if (eintrag?.onlyCreation && mode !== 'creation') return { grund: 'Nur Erschaffung', restStufen: 0, vorhanden };
  if (!gleiche.length) return { grund: null, restStufen: Math.max(1, eintrag?.max ?? 1), vorhanden };
  if (!eintrag?.multi) return { grund: 'Bereits gewählt', restStufen: 0, vorhanden };
  // „je Ziel" mehrfach wählbar (max 1): jede Wahl hat einen anderen Namen, gleicher Name zählt als vergeben
  const max = eintrag.max ?? 1;
  const rest = max - vorhanden;
  return { grund: rest <= 0 ? (max > 1 ? `Höchstens ${max}×` : 'Bereits gewählt') : null, restStufen: Math.max(0, rest), vorhanden };
}
