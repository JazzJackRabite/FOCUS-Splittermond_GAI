/** Ändern sich die Lebenspunkte je Stufe (Robust, KON), ziehen die Kästchen mit; der erlittene Schaden bleibt */
import { describe, expect, it } from 'vitest';
import { baseCharacterReducer, DEFAULT_STATE } from '../hooks/useCharacterState';
import type { CharacterState, HealthSlot } from '../types';

const mit = (slots: HealthSlot[]) => ({ ...DEFAULT_STATE, playState: { ...DEFAULT_STATE.playState, healthSlots: slots } }) as CharacterState;
const slots = (n: number, schaden: number) => Array.from({ length: n }, (_, i) => ({ type: i < schaden ? 'consumed' : 'empty' }) as HealthSlot);

describe('PLAY_LP_ANPASSEN', () => {
  it('9 → 10 LP je Stufe: 54 → 60 Kästchen, 8 Schaden bleiben', () => {
    const s = baseCharacterReducer(mit(slots(54, 8)), { type: 'PLAY_LP_ANPASSEN', payload: { maxLP: 10 } });
    expect(s.playState.healthSlots.length).toBe(60);
    expect(s.playState.healthSlots.filter((x) => x.type === 'consumed').length).toBe(8);
  });
  it('gleiche Zahl: unverändert', () => {
    const vor = mit(slots(60, 3));
    expect(baseCharacterReducer(vor, { type: 'PLAY_LP_ANPASSEN', payload: { maxLP: 10 } })).toBe(vor);
  });
});
