/**
 * Probenwurf nach GRW S. 16–19 und Großmeister (S. 92) – gemeinsam für Probe, Angriff und Zauber.
 * Anzahl der Würfel je Wurfart und die Grenzen kommen aus dem Paket (regelwerk/proben.ts).
 * - Standardwurf: 2W10 addieren; Patzer bei Augensumme ≤ 3, Triumph ab 19 (Grenzen aus dem Paket: regelwerk/proben.ts).
 * - Sicherheitswurf: 2W10, nur der höhere zählt; kein Patzer, kein Triumph.
 * - Risikowurf: 4W10; die niedrigsten 2 zusammen ≤ 3 = Patzer, sonst zählen die höchsten 2 (Triumph ab 19).
 * - Großmeister (ab 15 Fertigkeitspunkten): ein zusätzlicher W10. Er zählt nicht für den Patzer und ist nur ohne Patzer
 *   nutzbar; Standard: 3 Würfel, die höchsten 2; Risiko: 5 Würfel, die höchsten 2; Sicherheit: 3 Würfel, der höchste.
 */
export type WurfArt = 'standard' | 'safe' | 'risk';

export interface WurfErgebnis {
  /** alle geworfenen Würfel; ein Großmeister-Würfel steht am Ende */
  dice: number[];
  result: number;
  isCrit: boolean;
  isFumble: boolean;
  grossmeisterWuerfel?: number;
}

const w10 = (rnd: () => number) => Math.floor(rnd() * 10) + 1;
const besteZwei = (l: number[]) => [...l].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);

import { wurfgrenzen } from '../regelwerk/proben';

/** Risikowurf auswerten: niedrigste zwei ≤ Patzergrenze = Patzer, sonst die höchsten zwei (mit Großmeisterwürfel) */
export function risikoWertung(wuerfel: number[], g: number | undefined, grenzen: { patzer: number; triumph: number } = wurfgrenzen()): WurfErgebnis {
  const d = [...wuerfel].sort((a, b) => a - b);
  const alle = g !== undefined ? [...d, g] : d;
  const low = d[0] + d[1];
  if (low <= grenzen.patzer) return { dice: alle, result: low, isFumble: true, isCrit: false, grossmeisterWuerfel: g };
  const high = besteZwei(alle);
  return { dice: alle, result: high, isFumble: false, isCrit: high >= grenzen.triumph, grossmeisterWuerfel: g };
}

/** Grenzen für Patzer (Summe der niedrigsten zwei höchstens …) und Triumph (Summe der höchsten zwei mindestens …) aus dem Paket */
export function wuerfeln(art: WurfArt, grossmeister = false, rnd: () => number = Math.random, grenzen: { patzer: number; triumph: number; wuerfel?: { standard: number; safe: number; risk: number } } = wurfgrenzen()): WurfErgebnis {
  const anzahl = grenzen.wuerfel ?? wurfgrenzen().wuerfel;
  const werfe = (n: number) => Array.from({ length: n }, () => w10(rnd));
  if (art === 'safe') {
    const d = werfe(anzahl.safe);
    const g = grossmeister ? w10(rnd) : undefined;
    const alle = g !== undefined ? [...d, g] : d;
    return { dice: alle, result: Math.max(...alle), isCrit: false, isFumble: false, grossmeisterWuerfel: g };
  }
  if (art === 'risk') return risikoWertung(werfe(anzahl.risk), grossmeister ? w10(rnd) : undefined, grenzen);
  const d = werfe(anzahl.standard);
  const g = grossmeister ? w10(rnd) : undefined;
  const alle = g !== undefined ? [...d, g] : d;
  const summe = [...d].sort((a, b) => a - b).slice(0, 2).reduce((a, b) => a + b, 0);
  if (summe <= grenzen.patzer) return { dice: alle, result: summe, isFumble: true, isCrit: false, grossmeisterWuerfel: g };
  const best = besteZwei(alle);
  return { dice: alle, result: best, isFumble: false, isCrit: best >= grenzen.triumph, grossmeisterWuerfel: g };
}

/**
 * Welche Würfel ins Ergebnis zählen (Indizes in `dice`): Sicherheit der höchste, Patzer die zwei niedrigsten
 * (ohne Großmeisterwürfel), sonst die zwei höchsten. Für die Anzeige „[a + b] + Wert“.
 */
export function gezaehlteWuerfel(dice: number[], art: WurfArt, patzer: boolean, grossmeister = false): number[] {
  const idx = dice.map((d, i) => ({ d, i }));
  if (art === 'safe') return [idx.reduce((a, b) => (b.d > a.d ? b : a)).i];
  if (patzer) {
    const ohneG = grossmeister ? idx.slice(0, -1) : idx;
    return [...ohneG].sort((a, b) => a.d - b.d).slice(0, 2).map((x) => x.i).sort((a, b) => a - b);
  }
  return [...idx].sort((a, b) => b.d - a.d).slice(0, 2).map((x) => x.i).sort((a, b) => a - b);
}

const ohneGrossmeister = (w: WurfErgebnis) => (w.grossmeisterWuerfel !== undefined ? w.dice.slice(0, -1) : [...w.dice]);

/**
 * Mondzeichen-Gabe „beide Würfel addieren“ (Der Fels): beim Sicherheitswurf, wenn der höchste Würfel höchstens `hoechstens`
 * zeigt, gilt die Summe der beiden Würfel (kein Patzer). Sonst null.
 */
export function gabeSicherheitBeide(art: WurfArt, w: WurfErgebnis, hoechstens: number): WurfErgebnis | null {
  if (art !== 'safe') return null;
  const d = ohneGrossmeister(w);
  if (Math.max(...w.dice) > hoechstens) return null;
  const summe = d.slice(0, 2).reduce((a, b) => a + b, 0);
  return summe > w.result ? { ...w, result: summe, isFumble: false, isCrit: false } : null;
}

/**
 * Mondzeichen-Gabe „zweitniedrigsten Würfel neu werfen“ (Der Spieler): Risikowurf ohne Patzer; es gilt der neue Wurf,
 * danach normale Auswertung. Sonst null.
 */
export function gabeRisikoNeuwurf(art: WurfArt, w: WurfErgebnis, rnd: () => number = Math.random, grenzen: { patzer: number; triumph: number } = wurfgrenzen()): WurfErgebnis | null {
  if (art !== 'risk' || w.isFumble) return null;
  const d = ohneGrossmeister(w).sort((a, b) => a - b);
  d[1] = w10(rnd);
  return risikoWertung(d, w.grossmeisterWuerfel, grenzen);
}
