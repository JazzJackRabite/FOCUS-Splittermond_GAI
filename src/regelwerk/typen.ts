/**
 * Datentypen der Splittermond-Regelpakete (Format „splittermond-regelpaket“ 1.0).
 * Referenz: Regelpakete/LIESMICH.md und Pruefsuite/lader.py im Ordner SCR4P3.
 */

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Daten = Record<string, any>;

export interface Quelle {
  paket: string;
  buch_seiten?: number[];
  pdf_seiten?: number[];
  [k: string]: unknown;
}

export interface Eintrag {
  id: string;
  typ: string;
  aktion: 'neu' | 'ergaenzt' | 'ersetzt' | 'verweis';
  name: string;
  quelle: Quelle;
  ziel?: string | null;
  aenderungen?: Record<string, { alt: unknown; neu: unknown }>;
  daten: Daten;
  /** vom Lader gesetzt: weitere Grimoires, in denen der Eintrag steht */
  _quellen?: Quelle[];
}

export interface Regelgruppe {
  typ: string;
  name: string;
  fassungen: string[];
  art: 'ergaenzt' | 'ersetzt' | 'identisch' | 'abweichend' | 'regional';
  gruende?: Record<string, string>;
}

export interface Ladeinfo {
  format: 'splittermond-editor-ladeinfo';
  format_version: string;
  ladereihenfolge: number;
  abhaengigkeiten: string[];
  optionale_pakete: string[];
  regelgruppen: Record<string, Regelgruppe>;
  umbenannt: Record<string, string>;
  begleiter: Record<string, unknown>;
  original: { datei: string; sha256: string; bytes: number; eintraege: number };
}

export interface RegelPaket {
  format: 'splittermond-regelpaket';
  format_version: string;
  erzeugt: string;
  paket: { id: string; titel: string; kuerzel: string; version?: string; basis?: boolean; erscheinungsjahr?: number; [k: string]: unknown };
  abhaengigkeiten: { paket: string; pflicht: boolean }[] | string[];
  statistik: { eintraege: number; [k: string]: unknown };
  eintraege: Eintrag[];
  /** nur in Grimoires für den Editor (Werkzeuge/regelpakete/editor_export.py) */
  ladeinfo?: Ladeinfo;
}

export interface PaketInfo {
  id: string;
  titel: string;
  kuerzel: string;
  erscheinungsjahr?: number;
  regionalband?: boolean;
  datei?: string;
  sha256?: string;
  bytes?: number;
  basis?: boolean;
  ladereihenfolge: number;
  abhaengigkeiten: string[];
  optionale_pakete?: string[];
  eintraege?: number;
}

export interface Manifest {
  format: string;
  format_version: string;
  basis_paket: string;
  id_schema: { regex: string; [k: string]: unknown };
  pakete: PaketInfo[];
  bekannte_pakete?: PaketInfo[];
  regelgruppen?: { gruppen: Record<string, Regelgruppe>; [k: string]: unknown };
  typen?: Record<string, { bezeichnung: string; charakterbau_auswahl: boolean }>;
  [k: string]: unknown;
}

/** Ein zum Laden bereitgestelltes Paket: Inhalt plus Ladeangaben (aus dem Manifest oder aus paket.ladeinfo). */
export interface LadePaket {
  info: PaketInfo;
  paket: RegelPaket;
  regelgruppen?: Record<string, Regelgruppe>;
  umbenannt?: Record<string, string>;
  /** Anzahl Einträge, die das Paket haben muss (Manifest bzw. ladeinfo.original) */
  erwarteteEintraege?: number;
}

export type Schwere = 'fehler' | 'warnung' | 'info';
export type Befund = [Schwere, string, string, string];

/** Ergebnis einer Bedingung: erfüllt, nicht erfüllt oder Entscheidung der Spielleitung. */
export type Ergebnis = true | false | 'offen';
