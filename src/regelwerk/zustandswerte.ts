/**
 * Wirkung der Zustände auf abgeleitete Werte und Fokus (FUNDAMENT.md, Regelquellen).
 * Die Zahlen stehen im Paketeintrag des Zustands (`daten.zustandswirkung.werte`); dieses Modul rechnet nur:
 *   pro_stufe × Stufe und fest werden addiert, danach faktor (abgerundet), danach setzen;
 *   kanalisiert_anteil_pro_stufe (Fokus): dieser Anteil des gesamten Fokus je Stufe bleibt dauerhaft kanalisiert.
 * „gilt_als“ (z. B. Bewusstlos, Schlafend: gilt als liegend) übernimmt die Hinweise des anderen Zustands.
 */
import type { StatusCondition } from '../types';
import type { Katalog } from './katalog';
import { aktiverKatalog } from './bruecke';
import { zustand, KAMPFPOSITION_LIEGEND } from './zustaende';
import { positionsBeschreibung, positionsQuelle } from './kampflage';

export type Wertname = 'VTD' | 'GW' | 'KW' | 'GSW' | 'INI' | 'SR';
const WERTE: Wertname[] = ['VTD', 'GW', 'KW', 'GSW', 'INI', 'SR'];

export interface Zustandswerte {
  /** Summe der Zu- und Abschläge je Wert */
  plus: Record<Wertname, number>;
  /** Faktoren je Wert (z. B. Lahm: Geschwindigkeit × 0,5) */
  faktor: Partial<Record<Wertname, number>>;
  /** Wert wird auf diese Zahl gesetzt (z. B. Ringend: Geschwindigkeit 0) */
  setzen: Partial<Record<Wertname, number>>;
  /** Anteil des gesamten Fokus, der dauerhaft kanalisiert bleibt (0 bis 1) */
  fokusAnteil: number;
  /** Erklärung je Wert für die Anzeige, z. B. „Erschöpft 2: −2“ */
  erklaerung: Partial<Record<Wertname | 'FO', string[]>>;
  /** Hinweise ohne eigenen Wert, z. B. Kampfposition liegend */
  hinweise: string[];
}

const zeichen = (n: number) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'));

export function zustandswerte(conditions: StatusCondition[] = [], k: Katalog | null = aktiverKatalog()): Zustandswerte {
  const zw: Zustandswerte = { plus: { VTD: 0, GW: 0, KW: 0, GSW: 0, INI: 0, SR: 0 }, faktor: {}, setzen: {}, fokusAnteil: 0, erklaerung: {}, hinweise: [] };
  const erkl = (w: Wertname | 'FO', t: string) => (zw.erklaerung[w] ??= []).push(t);
  const liegend = new Set<string>();
  for (const c of conditions) {
    const z = zustand(c.key, k);
    if (!z) continue;
    const stufe = z.mitStufe ? Math.max(1, c.level || 1) : 1;
    const label = z.mitStufe ? `${c.key} ${stufe}` : c.key;
    if (c.key === KAMPFPOSITION_LIEGEND || z.wirkung?.gilt_als === 'liegend') liegend.add(c.key);
    for (const [w, a] of Object.entries(z.wirkung?.werte ?? {})) {
      if (w === 'FO') {
        if (a.kanalisiert_anteil_pro_stufe) {
          zw.fokusAnteil = Math.min(1, zw.fokusAnteil + a.kanalisiert_anteil_pro_stufe * stufe);
          erkl('FO', `${label}: ${Math.round(a.kanalisiert_anteil_pro_stufe * stufe * 100)} % dauerhaft kanalisiert`);
        }
        continue;
      }
      if (!WERTE.includes(w as Wertname)) continue;
      const wn = w as Wertname;
      const summe = (a.fest ?? 0) + (a.pro_stufe ?? 0) * stufe;
      if (summe) { zw.plus[wn] += summe; erkl(wn, `${label}: ${zeichen(summe)}`); }
      if (a.faktor !== undefined) { zw.faktor[wn] = (zw.faktor[wn] ?? 1) * a.faktor; erkl(wn, `${label}: ${a.faktor === 0.5 ? 'halbiert' : `× ${a.faktor}`}`); }
      if (a.setzen !== undefined) { zw.setzen[wn] = Math.min(zw.setzen[wn] ?? Infinity, a.setzen); erkl(wn, `${label}: auf ${a.setzen} gesetzt`); }
    }
  }
  const gegen = liegend.size ? positionsBeschreibung(KAMPFPOSITION_LIEGEND, 'gegnerisch', k) : '';
  if (gegen) zw.hinweise.push(`${[...liegend].join(', ')}: gilt als liegend – Angriffe gegen den Charakter ${gegen} (${positionsQuelle(k)})`);
  return zw;
}

/** Wert nach den Zuständen: erst Zu-/Abschläge, dann Faktor (abgerundet), dann gesetzter Wert; nie unter 0 */
export function mitZustaenden(wert: Wertname, basis: number, zw: Zustandswerte): number {
  let v = basis + zw.plus[wert];
  if (zw.faktor[wert] !== undefined) v = Math.floor(v * zw.faktor[wert]!);
  if (zw.setzen[wert] !== undefined) v = zw.setzen[wert]!;
  return Math.max(0, v);
}

/** Fokuspunkte, die durch Zustände dauerhaft kanalisiert sind (z. B. Verstoßen: ein Viertel je Stufe) */
export function fokusDurchZustaende(maxFO: number, zw: Zustandswerte): number {
  return Math.min(maxFO, Math.floor(maxFO * zw.fokusAnteil));
}

/** Kurztext für die Anzeige beim Überfahren mit der Maus */
export function zustandsErklaerung(wert: Wertname | 'FO', zw: Zustandswerte): string {
  const e = zw.erklaerung[wert];
  return e?.length ? `Zustände: ${e.join(', ')}` : '';
}

/**
 * Wert aus einem Wertekasten (Text wie „15“ oder „7–1W6“) mit Zuständen: Die führende Zahl wird umgerechnet,
 * der Rest bleibt stehen. Ohne Zahl oder ohne Wirkung bleibt der Text unverändert.
 */
export function textMitZustaenden(wert: Wertname, text: string | number | undefined | null, zw: Zustandswerte): { text: string; basis: string; geaendert: boolean } {
  const basis = text === undefined || text === null ? '' : String(text);
  const m = basis.match(/^\s*(-?\d+)(.*)$/s);
  const wirkt = zw.plus[wert] !== 0 || zw.faktor[wert] !== undefined || zw.setzen[wert] !== undefined;
  if (!m || !wirkt) return { text: basis, basis, geaendert: false };
  const neu = mitZustaenden(wert, Number(m[1]), zw);
  return { text: `${neu}${m[2]}`, basis, geaendert: neu !== Number(m[1]) };
}

/** Liegt der Charakter laut seinen Zuständen (Kampfposition Liegend oder ein Zustand, der als liegend gilt)? */
export function liegtLautZustaenden(conditions: StatusCondition[] = [], k: Katalog | null = aktiverKatalog()): boolean {
  return conditions.some((c) => c.key === KAMPFPOSITION_LIEGEND || zustand(c.key, k)?.wirkung?.gilt_als === 'liegend');
}
