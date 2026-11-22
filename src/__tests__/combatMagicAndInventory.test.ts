import { describe, it, expect } from 'vitest';
import { calculateCharacter } from '../utils/characterCalculations';
import { DEFAULT_STATE } from '../hooks/useCharacterState';
import type { CharacterState, InventoryItem } from '../types';

describe('Kampf & Magie and Inventar Integration', () => {
  it('correctly updates derived stats (VTD, SR, load) when armor, shields, and weapons are equipped', () => {
    const weapon: InventoryItem = {
      id: 'w1',
      name: 'Langschwert',
      type: 'weapon',
      quantity: 1,
      weight: 2,
      damage: '1W6+4',
      weaponSkill: 'Klingenwaffen',
      wgs: 7,
      equipped: true,
    };

    const armor: InventoryItem = {
      id: 'a1',
      name: 'Kettenhemd',
      type: 'armor',
      quantity: 1,
      weight: 4,
      sr: 2,
      vtdBonus: 0,
      handicap: 2,
      tickModifier: 1,
      equipped: true,
    };

    const shield: InventoryItem = {
      id: 's1',
      name: 'Holzschild',
      type: 'shield',
      quantity: 1,
      weight: 2,
      vtdBonus: 1,
      handicap: 1,
      equipped: true,
    };

    const gear: InventoryItem = {
      id: 'g1',
      name: 'Seil & Fackeln',
      type: 'gear',
      quantity: 3,
      weight: 1, // 3 * 1 = 3 load
      equipped: false,
    };

    const state: CharacterState = {
      ...DEFAULT_STATE,
      name: 'Alrik',
      race: 'Mensch', // GK = 5
      attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 3, MYS: 2, STA: 3, VER: 2, WIL: 2 },
      inventory: [weapon, armor, shield, gear],
    };

    const calc = calculateCharacter(state);

    // Attributes: KON = 3, STA = 3
    // Tragkraft = KON + STA = 3 + 3 = 6
    expect(calc.loadCapacity).toBe(6);

    // Total load = 2 (weapon) + 4 (armor) + 2 (shield) + 3 (gear) = 11
    expect(calc.totalLoad).toBe(11);

    // Equipped Armor SR = 2
    expect(calc.armorSR).toBe(2);
    // Base SR = 0 -> derived.SR = 2
    expect(calc.derived.SR).toBe(2);

    // Equipped Shield VTD bonus = +1
    expect(calc.gearVtdBonus).toBe(1);
    // Base VTD = 12 + BEW (3) + STA (3) = 18. With shield = 19
    expect(calc.derived.VTD).toBe(19);

    // Equipped handicap = 2 (armor) + 1 (shield) = 3
    expect(calc.gearHandicap).toBe(3);
    // Equipped tick modifier = 1
    expect(calc.gearTickModifier).toBe(1);
  });

  it('keeps base derived stats unchanged when items are not equipped', () => {
    const unequippedArmor: InventoryItem = {
      id: 'a2',
      name: 'Plattenrüstung',
      type: 'armor',
      quantity: 1,
      weight: 6,
      sr: 4,
      vtdBonus: 0,
      handicap: 4,
      equipped: false,
    };

    const state: CharacterState = {
      ...DEFAULT_STATE,
      race: 'Mensch',
      attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      inventory: [unequippedArmor],
    };

    const calc = calculateCharacter(state);

    expect(calc.armorSR).toBe(0);
    expect(calc.gearVtdBonus).toBe(0);
    expect(calc.derived.SR).toBe(0);
    // Base VTD: 12 + 3 + 2 = 17
    expect(calc.derived.VTD).toBe(17);
    expect(calc.totalLoad).toBe(6);
  });
});
