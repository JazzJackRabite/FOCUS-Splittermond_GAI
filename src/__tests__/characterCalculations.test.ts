import { describe, it, expect } from 'vitest';
import { calculateCharacter } from '../utils/characterCalculations';
import { DEFAULT_STATE } from '../hooks/useCharacterState';
import type { CharacterState } from '../types';

describe('calculateCharacter (Centralized Calculation Engine)', () => {
  it('calculates attributes, derived stats, and Heldengrad correctly for a base character', () => {
    const state: CharacterState = {
      ...DEFAULT_STATE,
      name: 'Theron',
      race: 'Mensch',
      attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 3 },
      raceBonusAttrs: ['BEW'], // +1 BEW -> BEW = 4
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
    };

    const calc = calculateCharacter(state);

    // Attributes
    expect(calc.currentAttributes.BEW).toBe(4);
    expect(calc.currentAttributes.WIL).toBe(3);

    // Derived stats: Mensch GK = 5
    // GSW = BEW + GK = 4 + 5 = 9
    expect(calc.derived.GSW).toBe(9);
    // INI = 10 - INT = 10 - 2 = 8
    expect(calc.derived.INI).toBe(8);
    // LP = GK + KON = 5 + 2 = 7
    expect(calc.derived.LP).toBe(7);
    // FO = 2 * (MYS + WIL) = 2 * (2 + 3) = 10
    expect(calc.derived.FO).toBe(10);
    // VTD = 12 + BEW + STA = 12 + 4 + 2 = 18
    expect(calc.derived.VTD).toBe(18);
    // GW = 12 + VER + WIL = 12 + 2 + 3 = 17
    expect(calc.derived.GW).toBe(17);
    // KW = 12 + KON + WIL = 12 + 2 + 3 = 17
    expect(calc.derived.KW).toBe(17);

    // Base Heldengrad HG1
    expect(calc.heldengrad.name).toBe('Heldengrad 1 (Suchender)');
    expect(calc.xpSpent).toBe(0);
    expect(calc.xpAvailable).toBe(15);
  });

  it('updates Heldengrad dynamically based on XP expenditure thresholds', () => {
    // HG 1: 0 - 99
    // HG 2: 100 - 299
    // HG 3: 300 - 599
    // HG 4: 600+
    const state: CharacterState = {
      ...DEFAULT_STATE,
      xpTotal: 350,
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
      masteries: {
        Klingenwaffen: [
          { id: 'm1', name: 'M1', tier: 1, cost: 60, isFree: false, isCreationBonus: false, source: 'GRW' },
          { id: 'm2', name: 'M2', tier: 2, cost: 60, isFree: false, isCreationBonus: false, source: 'GRW' },
        ],
      },
    };

    const calc = calculateCharacter(state);
    expect(calc.xpSpent).toBe(120);
    expect(calc.heldengrad.name).toBe('Heldengrad 2 (Wanderer)');
    expect(calc.xpAvailable).toBe(230);
  });

  it('correctly calculates creationUsage and isCreationComplete flag', () => {
    const incompleteState: CharacterState = {
      ...DEFAULT_STATE,
      attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 }, // 16 points (needs 18)
    };
    const incompleteCalc = calculateCharacter(incompleteState);
    expect(incompleteCalc.isCreationComplete).toBe(false);
  });
});
