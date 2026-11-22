/**
 * Texte und Wirkungen aus dem Regelpaket statt aus dem Code:
 * - Verwundet: je Stufe eine Gesundheitsstufe tiefer (GRW S. 169), genau einmal im Wundabzug (Abenteurer und Begleiter)
 * - Liegend: Text aus der Tabelle der Kampfpositionen (GRW S. 170)
 * - Pausen: welche Zustände enden, aus pause_ende (GRW S. 168–169)
 */
import { describe, expect, it } from 'vitest';
import { calculateCharacter } from '../utils/characterCalculations';
import { getActiveRollModifiers } from '../utils/conditionModifiers';
import { DEFAULT_STATE } from '../hooks/useCharacterState';
import { lebenslage } from '../regelwerk/vitals';
import { pausenZustandstext, wundstufenVerschiebung } from '../regelwerk/zustaende';
import { positionsText } from '../regelwerk/kampflage';
import type { CharacterState } from '../types';

const stufen = [0, -1, -2, -4, -8].map((wundabzug, i) => ({ name: `S${i}`, wundabzug }));
const verwundet = (level: number) => ({ id: 'v', key: 'Verwundet', level });

describe('Verwundet über das Feld wundstufe', () => {
  it('Verschiebung aus dem Paket, andere Zustände zählen nicht', () => {
    expect(wundstufenVerschiebung([verwundet(2), { key: 'Erschöpft', level: 3 }])).toBe(2);
    expect(wundstufenVerschiebung([])).toBe(0);
  });

  it('Begleiter: Wundabzug verschoben, auch unverletzt; höchstens die letzte Stufe', () => {
    expect(lebenslage(5, stufen, { zustaende: [verwundet(1)] }).wundabzug).toBe(-1);
    expect(lebenslage(5, stufen, { schaden: 6, zustaende: [verwundet(2)] }).wundabzug).toBe(-4);
    expect(lebenslage(5, stufen, { schaden: 21, zustaende: [verwundet(3)] }).wundabzug).toBe(-8);
    expect(lebenslage(5, stufen, { schaden: 6 }).wundabzug).toBe(-1);
  });

  it('Abenteurer: Wundabzug enthält Verwundet, die Probe zählt es nicht noch einmal', () => {
    const state = { ...DEFAULT_STATE, playState: { ...(DEFAULT_STATE as CharacterState).playState, conditions: [verwundet(1)] } } as CharacterState;
    const calc = calculateCharacter(state);
    const lp = calc.maxLP;
    const mitSchaden = calculateCharacter({ ...state, playState: { ...state.playState!, healthSlots: Array.from({ length: lp * 5 }, (_, i) => ({ type: i < lp + 1 ? 'consumed' : 'empty' })) } } as CharacterState);
    expect(mitSchaden.currentWoundPenalty).toBe(-2); // Angeschlagen (−1), eine Stufe tiefer: −2
    const mods = getActiveRollModifiers([verwundet(1)], mitSchaden.currentWoundPenalty);
    expect(mods.reduce((s, m) => s + m.malus, 0)).toBe(-2);
  });
});

describe('Texte aus dem Paket', () => {
  it('Liegend aus der Tabelle der Kampfpositionen', () => {
    expect(positionsText('Liegend')).toBe('eigene Angriffe: Nahkampf −6, Fernkampf −6 (Armbrust ±0); Angriffe gegen ihn: Nahkampf +6, Fernkampf −6');
  });

  it('Pausen: welche Zustände abgebaut oder aufgehoben werden', () => {
    const v = pausenZustandstext('verschnaufpause');
    expect(v).toContain('Erschöpft');
    expect(v).toContain('Lahm');
    expect(v).not.toContain('Blutend');
  });
});
