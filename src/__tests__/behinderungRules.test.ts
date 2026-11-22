import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  GENERAL_BEW_SKILLS,
  isSkillAffectedByBehinderung,
  getActiveRollModifiers,
} from '../utils/conditionModifiers';
import { calculateCharacter } from '../utils/characterCalculations';
import { DEFAULT_STATE } from '../hooks/useCharacterState';
import type { CharacterState, InventoryItem } from '../types';
import { setzeAktivenKatalog } from '../regelwerk/bruecke';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';
import { Katalog } from '../regelwerk/katalog';

// Regeln aus dem GRW-Paket (Wirkungen, Ruhewirkungen, Minderungen); ohne Paket gibt es keine Boni nach Namen mehr
beforeAll(() => { const b = basisAusDateien(); setzeAktivenKatalog(new Katalog(b.manifest, [b.basis]), false); });
afterAll(() => setzeAktivenKatalog(null, false));


describe('Splittermond Behinderung (Handicap) Rules (GRW S. 187)', () => {
  describe('Skill Identification (Allgemeine Fertigkeiten mit Beweglichkeit)', () => {
    it('identifies exactly the 7 general skills with Beweglichkeit as affected by Behinderung', () => {
      const expectedSkills = [
        'Akrobatik',
        'Athletik',
        'Fingerfertigkeit',
        'Heimlichkeit',
        'Schlösser & Fallen',
        'Seefahrt',
        'Tierführung',
      ];

      expect([...GENERAL_BEW_SKILLS].sort()).toEqual([...expectedSkills].sort());

      expectedSkills.forEach((skill) => {
        expect(isSkillAffectedByBehinderung(skill)).toBe(true);
      });
    });

    it('does NOT apply Behinderung to general skills without Beweglichkeit', () => {
      const nonBewSkills = [
        'Alchemie',
        'Anführen',
        'Arkane Kunde',
        'Darbietung',
        'Diplomatie',
        'Edelhandwerk',
        'Empathie',
        'Entschlossenheit',
        'Geschichte & Mythen',
        'Handwerk',
        'Heilkunde',
        'Jagdkunst',
        'Länderkunde',
        'Naturkunde',
        'Redegewandtheit',
        'Schwimmen',
        'Straßenkunde',
        'Überleben',
        'Wahrnehmung',
        'Zähigkeit',
      ];

      nonBewSkills.forEach((skill) => {
        expect(isSkillAffectedByBehinderung(skill)).toBe(false);
      });
    });

    it('does NOT apply Behinderung to magic schools (even Bewegungsmagie which uses BEW)', () => {
      // Splittermond GRW explicitly excludes magic schools: "(also nicht auf Kampffertigkeiten oder Magieschulen)"
      expect(isSkillAffectedByBehinderung('Bewegungsmagie')).toBe(false);
      expect(isSkillAffectedByBehinderung('Kampfmagie')).toBe(false);
      expect(isSkillAffectedByBehinderung('Heilungsmagie')).toBe(false);
    });

    it('does NOT apply Behinderung to combat skills', () => {
      // Splittermond GRW explicitly excludes combat skills
      expect(isSkillAffectedByBehinderung('Klingenwaffen')).toBe(false);
      expect(isSkillAffectedByBehinderung('Handgemenge')).toBe(false);
      expect(isSkillAffectedByBehinderung('Schusswaffen')).toBe(false);
    });
  });

  describe('getActiveRollModifiers with Behinderung', () => {
    it('includes Behinderung as an active roll modifier when applicable', () => {
      const mods = getActiveRollModifiers([], 0, 'Unverletzt', 2, true);
      expect(mods).toHaveLength(1);
      expect(mods[0]).toEqual({
        id: 'behinderung',
        source: 'behinderung',
        label: 'Behinderung (2)',
        malus: -2,
        active: true,
        description: 'Rüstungs- und Lastbehinderung (−2) auf Fertigkeiten mit Beweglichkeit',
      });
    });

    it('does NOT include Behinderung when skill is not affected by Behinderung', () => {
      const mods = getActiveRollModifiers([], 0, 'Unverletzt', 3, false);
      expect(mods).toHaveLength(0);
    });

    it('does NOT include Behinderung when behinderung is 0', () => {
      const mods = getActiveRollModifiers([], 0, 'Unverletzt', 0, true);
      expect(mods).toHaveLength(0);
    });

    it('combines Behinderung with wound penalties and conditions', () => {
      const conditions = [{ id: 'c1', key: 'Erschöpft', level: 1 }];
      const mods = getActiveRollModifiers(conditions, -2, 'Verletzt', 3, true);

      expect(mods).toHaveLength(3);
      const behMod = mods.find((m) => m.source === 'behinderung');
      const woundMod = mods.find((m) => m.source === 'wound');
      const condMod = mods.find((m) => m.source === 'condition');

      expect(behMod?.malus).toBe(-3);
      expect(woundMod?.malus).toBe(-2);
      expect(condMod?.malus).toBe(-1);

      const totalMalus = mods.filter((m) => m.active).reduce((sum, m) => sum + m.malus, 0);
      expect(totalMalus).toBe(-6);
    });
  });

  describe('Character Calculations (characterCalculations.ts)', () => {
    it('calculates armor and shield handicap and reduces GSW by half total handicap (kaufmännisch gerundet, GRW S. 11)', () => {
      const chainmail: InventoryItem = {
        id: 'arm1',
        name: 'Kettenhemd',
        type: 'armor',
        quantity: 1,
        weight: 4,
        sr: 2,
        vtdBonus: 0,
        handicap: 2,
        equipped: true,
      };
      const largeShield: InventoryItem = {
        id: 'sh1',
        name: 'Großschild',
        type: 'shield',
        quantity: 1,
        weight: 3,
        sr: 0,
        vtdBonus: 2,
        handicap: 2,
        equipped: true,
      };

      const state: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch', // GK 5
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 4, MYS: 2, STA: 4, VER: 2, WIL: 2 },
        inventory: [chainmail, largeShield],
      };

      const calc = calculateCharacter(state);

      // Armor handicap = 2, Shield handicap = 2, Total = 4
      expect(calc.armorHandicap).toBe(2);
      expect(calc.shieldHandicap).toBe(2);
      expect(calc.overweightHandicap).toBe(0);
      expect(calc.totalHandicap).toBe(4);

      // Base GSW = BEW (3) + GK (5) = 8
      // Speed reduction = 4 / 2 = 2
      // Effective GSW = 8 - 2 = 6
      expect(calc.derived.GSW).toBe(6);
    });

    it('reduces armor handicap by 1 with mastery "Rüstungsträger I"', () => {
      const plateArmor: InventoryItem = {
        id: 'arm2',
        name: 'Plattenrüstung',
        type: 'armor',
        quantity: 1,
        weight: 6,
        sr: 4,
        vtdBonus: 0,
        handicap: 3,
        equipped: true,
      };

      const state: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 4, MYS: 2, STA: 4, VER: 2, WIL: 2 },
        inventory: [plateArmor],
        masteries: {
          Zähigkeit: [
            {
              id: 'm1',
              name: 'Rüstungsträger I (S1)',
              tier: 1,
              source: 'GRW',
              cost: 0,
              isFree: true,
              isCreationBonus: false,
            },
          ],
        },
      };

      const calc = calculateCharacter(state);

      // Raw handicap is 3, but Rüstungsträger I reduces armor handicap by 1 => 2
      expect(calc.armorHandicap).toBe(2);
      expect(calc.totalHandicap).toBe(2);
      // GSW: 3 + 5 - 2 / 2 = 8 - 1 = 7
      expect(calc.derived.GSW).toBe(7);
    });

    it('reduces shield handicap by 1 with mastery "Starker Schildarm I"', () => {
      const shield: InventoryItem = {
        id: 'sh2',
        name: 'Turmschild',
        type: 'shield',
        quantity: 1,
        weight: 4,
        sr: 0,
        vtdBonus: 2,
        handicap: 2,
        equipped: true,
      };

      const state: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 3, MYS: 2, STA: 3, VER: 2, WIL: 2 },
        inventory: [shield],
        masteries: {
          Zähigkeit: [
            {
              id: 'm2',
              name: 'Starker Schildarm I (S1)',
              tier: 1,
              source: 'GRW',
              cost: 0,
              isFree: true,
              isCreationBonus: false,
            },
          ],
        },
      };

      const calc = calculateCharacter(state);

      // Raw handicap is 2, reduced by 1 => 1
      expect(calc.shieldHandicap).toBe(1);
      expect(calc.totalHandicap).toBe(1);
      // GSW: halbe Behinderung 0,5 kaufmännisch gerundet = 1 (GRW S. 11) => 8 - 1 = 7
      expect(calc.derived.GSW).toBe(7);
    });

    it('adds overweight to total Behinderung when inventory exceeds load capacity (KON + STA)', () => {
      // KON = 2, STA = 2 => Tragkraft = 4
      const heavyCargo: InventoryItem = {
        id: 'cargo1',
        name: 'Schwere Ausrüstung',
        type: 'gear',
        quantity: 1,
        weight: 7, // 7 > 4, so excess = 3
        equipped: false,
      };

      const state: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
        inventory: [heavyCargo],
      };

      const calc = calculateCharacter(state);

      expect(calc.loadCapacity).toBe(4);
      expect(calc.totalLoad).toBe(7);
      expect(calc.overweightHandicap).toBe(3);
      expect(calc.totalHandicap).toBe(3);

      // GSW-Abzug = halbe Behinderung 1,5 kaufmännisch gerundet = 2 (GRW S. 11) => 8 - 2 = 6
      expect(calc.derived.GSW).toBe(6);
    });

    it('ignores overweight handicap when ignoreEncumbrance is true', () => {
      const heavyCargo: InventoryItem = {
        id: 'cargo2',
        name: 'Massives Gepäck',
        type: 'gear',
        quantity: 1,
        weight: 10,
        equipped: false,
      };

      const state: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
        inventory: [heavyCargo],
        ignoreEncumbrance: true,
      };

      const calc = calculateCharacter(state);

      expect(calc.loadCapacity).toBe(4);
      expect(calc.totalLoad).toBe(10);
      expect(calc.overweightHandicap).toBe(0); // Ignored!
      expect(calc.totalHandicap).toBe(0);
      expect(calc.derived.GSW).toBe(8); // Full GSW: 3 + 5, no penalty
    });
  });
});
