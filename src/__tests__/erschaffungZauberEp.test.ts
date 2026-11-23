/** Bei der Erschaffung über die freien Zauber hinaus gewählte Zauber kosten Erfahrungspunkte (cost ist dort die Fokus-Angabe) */
import { describe, expect, it } from 'vitest';
import { calculateCharacter } from '../utils/characterCalculations';
import { calculateItemCost } from '../utils/costCalculations';
import { DEFAULT_STATE } from '../hooks/useCharacterState';
import type { CharacterState } from '../types';

const zauber = (isFree: boolean) => ({ id: 'z', name: 'Blenden', school: 'Lichtmagie', grade: 1, cost: '4V1', isFree, sourceMode: 'creation' });

describe('Zauber bei der Erschaffung', () => {
  it('frei: 0 EP; zusätzlich gewählt: Kosten des Grades', () => {
    const mit = (z: unknown[]) => calculateCharacter({ ...DEFAULT_STATE, spellsList: z } as unknown as CharacterState).xpSpent;
    const ohne = mit([]);
    expect(mit([zauber(true)])).toBe(ohne);
    expect(mit([zauber(false)])).toBe(ohne + calculateItemCost('spell', 1));
  });
});
