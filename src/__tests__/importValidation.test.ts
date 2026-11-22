import { describe, it, expect } from 'vitest';
import { validateCharacterImport } from '../utils/importValidation';

describe('validateCharacterImport (Data Integrity & Robustness)', () => {
  it('successfully validates and normalizes a valid character JSON', () => {
    const rawData = {
      mode: 'xp',
      xpTotal: 120,
      name: 'Valeria',
      race: 'Alb',
      moonSign: 'Der Blitz',
      homeRegion: 'Selenia',
      attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 3 },
      raceBonusAttrs: ['BEW'],
      attrIncrements: { AUS: 0, BEW: 1, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
      skillsBase: { Akrobatik: 6, Klingenwaffen: 6 },
      skillsXp: { Klingenwaffen: 2 },
      masteries: {
        Klingenwaffen: [
          { id: 'm1', name: 'Ausfall (S1)', tier: 1, cost: 0, isFree: true, isCreationBonus: true, source: 'GRW' },
        ],
      },
      strengthsList: [
        { name: 'Attraktivität', level: 1, source: 'creation', pointCost: 1, isFree: false },
      ],
      resourcesList: [
        { name: 'Ansehen', level: 2, source: 'creation', pointCost: 1 },
      ],
      weaknessesList: [
        { name: 'Eitelkeit', level: 1, source: 'creation', desc: 'Eitel' },
      ],
      languagesList: [
        { name: 'Tial', level: 1, source: 'creation', isFree: true },
      ],
      spellsList: [
        { name: 'Licht', school: 'Lichtmagie', grade: 0, cost: 0, isFree: true },
      ],
      playState: {
        healthSlots: [{ type: 'empty' }, { type: 'exhausted' }, { type: 'consumed' }],
        focus: { exhausted: 2, channeled: 0, consumed: 1 },
        splitterPoints: 3,
        channeledSpells: [],
        dyingLevel: 0,
        conditions: [{ id: 'c1', key: 'Verwundet', level: 1 }],
        tempHP: 0,
        tempHPUsed: 0,
        lpModifier: 0,
      },
      creationFinalized: true,
    };

    const parsed = validateCharacterImport(rawData);
    expect(parsed.name).toBe('Valeria');
    expect(parsed.race).toBe('Alb');
    expect(parsed.xpTotal).toBe(120);
    expect(parsed.attrBase?.BEW).toBe(3);
    expect(parsed.masteries?.Klingenwaffen).toHaveLength(1);
    expect(parsed.playState?.focus.exhausted).toBe(2);
  });

  it('rejects completely invalid JSON data', () => {
    expect(() => validateCharacterImport(null)).toThrow('Importdaten sind kein gültiges Objekt.');
    expect(() => validateCharacterImport('random string')).toThrow('Importdaten sind kein gültiges Objekt.');
    expect(() => validateCharacterImport({ foo: 'bar' })).toThrow('Ungültiges Dateiformat');
  });

  it('sanitizes malicious/corrupted fields cleanly', () => {
    const rawData = {
      name: 'Corrupted Char',
      race: 'Mensch',
      attrBase: { AUS: 'invalid', BEW: 5.8, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      xpTotal: -50, // negative XP
      mode: 'hackedMode', // invalid mode
      playState: {
        healthSlots: [{ type: 'unknown_corrupted_type' }, { type: 'consumed' }],
        focus: { exhausted: 'NaN', channeled: 3, consumed: 0 },
        dyingLevel: 99, // invalid dying level
      },
    };

    const parsed = validateCharacterImport(rawData);
    expect(parsed.name).toBe('Corrupted Char');
    // AUS defaulted to 1, BEW rounded to 6
    expect(parsed.attrBase?.AUS).toBe(1);
    expect(parsed.attrBase?.BEW).toBe(6);
    // Invalid mode and negative xpTotal ignored
    expect(parsed.mode).toBeUndefined();
    expect(parsed.xpTotal).toBeUndefined();
    // Dying level clamped to 0
    expect(parsed.playState?.dyingLevel).toBe(0);
    // Health slots filtered
    expect(parsed.playState?.healthSlots).toEqual([{ type: 'consumed' }]);
    expect(parsed.playState?.focus.exhausted).toBe(0);
  });

  it('preserves and validates advancementLog across export and import (Fix P1)', () => {
    const rawData = {
      name: 'Chronist',
      race: 'Mensch',
      attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      advancementLog: [
        {
          id: 'log-1',
          timestamp: '2026-03-01T12:00:00Z',
          category: 'xp',
          title: '+50 EP Abenteuerbelohnung',
          xpDelta: 50,
        },
        {
          id: 'log-2',
          timestamp: '2026-03-01T12:05:00Z',
          category: 'skill',
          title: 'Athletik gesteigert auf 4',
          detail: 'Kosten: 3 EP',
          xpDelta: -3,
        },
      ],
    };

    const parsed = validateCharacterImport(rawData);
    expect(parsed.advancementLog).toBeDefined();
    expect(parsed.advancementLog).toHaveLength(2);
    expect(parsed.advancementLog?.[0].title).toBe('+50 EP Abenteuerbelohnung');
    expect(parsed.advancementLog?.[0].category).toBe('xp');
    expect(parsed.advancementLog?.[0].xpDelta).toBe(50);
    expect(parsed.advancementLog?.[1].detail).toBe('Kosten: 3 EP');
  });

  it('does NOT inject empty arrays for missing lists during partial imports (Fix P1)', () => {
    // Partial import with only name and attributes
    const partialData = {
      name: 'Partial Hero',
      race: 'Gnom',
      attrBase: { AUS: 2, BEW: 2, INT: 3, KON: 2, MYS: 3, STA: 1, VER: 2, WIL: 2 },
    };

    const parsed = validateCharacterImport(partialData);
    // Missing lists must be undefined so that merging into existing state does NOT overwrite them
    expect(parsed.masteries).toBeUndefined();
    expect(parsed.strengthsList).toBeUndefined();
    expect(parsed.resourcesList).toBeUndefined();
    expect(parsed.weaknessesList).toBeUndefined();
    expect(parsed.languagesList).toBeUndefined();
    expect(parsed.spellsList).toBeUndefined();
    expect(parsed.advancementLog).toBeUndefined();
  });

  it('rejects corrupted list contents so existing state is not overwritten (Fix P1)', () => {
    // If incoming JSON has a corrupted list entry, it should reject the list (returning undefined)
    // rather than returning a truncated or empty list that silently clears data.
    const corruptData = {
      name: 'Corrupt Strengths Hero',
      race: 'Mensch',
      strengthsList: [
        { name: 'Gute Stärke', level: 1 },
        { invalidFieldWithoutName: 42 }, // corrupted item
      ],
      spellsList: [
        { name: 'Zauber 1', school: 'Feuermagie', grade: 1 },
        { corrupted: 'no school' }, // corrupted spell
      ],
      advancementLog: [
        { id: 'l1', timestamp: '2026-01-01', title: 'Valid Log' },
        { missingTitleAndTimestamp: true }, // corrupted log
      ],
    };

    const parsed = validateCharacterImport(corruptData);
    // Because items were corrupt, the lists are returned as undefined to prevent overwriting
    expect(parsed.strengthsList).toBeUndefined();
    expect(parsed.spellsList).toBeUndefined();
    expect(parsed.advancementLog).toBeUndefined();
  });

  it('guarantees lossless round-trip serialization and deserialization (Export -> Import)', () => {
    const fullOriginalCharacter = {
      mode: 'play' as const,
      xpTotal: 250,
      name: 'Aurelia Schattenläuferin',
      race: 'Varg',
      moonSign: 'Der Falke',
      homeRegion: 'Farukan',
      attrBase: { AUS: 2, BEW: 3, INT: 3, KON: 3, MYS: 2, STA: 3, VER: 2, WIL: 2 },
      raceBonusAttrs: ['STA'],
      attrIncrements: { AUS: 0, BEW: 1, INT: 0, KON: 0, MYS: 0, STA: 1, VER: 0, WIL: 0 },
      skillsBase: { Athletik: 6, Heimlichkeit: 7, Klingenwaffen: 8 },
      skillsXp: { Heimlichkeit: 2, Klingenwaffen: 3 },
      masteries: {
        Klingenwaffen: [
          { id: 'm1', name: 'Ausfall (S1)', tier: 1, cost: 0, isFree: true, isCreationBonus: true, source: 'GRW' },
          { id: 'm2', name: 'Finte (S2)', tier: 2, cost: 15, isFree: false, isCreationBonus: false, source: 'GRW' },
        ],
      },
      strengthsList: [
        { name: 'Richtungssinn', level: 1, source: 'creation', pointCost: 1, isFree: true, isRacial: true },
        { name: 'Zusätzliche Splitterpunkte', level: 1, source: 'creation', pointCost: 1, isFree: false },
      ],
      resourcesList: [
        { name: 'Vermögen', level: 2, source: 'creation', pointCost: 1 },
      ],
      weaknessesList: [
        { name: 'Schlaflosigkeit', level: 1, source: 'creation', desc: 'Leidet oft unter Schlaflosigkeit' },
      ],
      languagesList: [
        { name: 'Farukani', level: 1, source: 'creation', isFree: true },
        { name: 'Vargisch', level: 1, source: 'creation', isFree: true },
      ],
      spellsList: [
        { name: 'Flüsternde Winde', school: 'Windmagie', grade: 1, cost: 0, isFree: true },
      ],
      playState: {
        healthSlots: [{ type: 'empty' as const }, { type: 'exhausted' as const }, { type: 'consumed' as const }],
        focus: { exhausted: 3, channeled: 1, consumed: 2 },
        splitterPoints: 5,
        channeledSpells: [{ id: 'cs1', name: 'Windhauch', channeledFocus: 1 }],
        dyingLevel: 0 as const,
        conditions: [{ id: 'c1', key: 'Verwundet', level: 1, note: 'Am Arm' }],
        tempHP: 2,
        tempHPUsed: 1,
        lpModifier: 0,
      },
      advancementLog: [
        {
          id: 'log-100',
          timestamp: '2026-03-10T10:00:00Z',
          category: 'xp' as const,
          title: '+100 EP für Karawanenbegleitung',
          xpDelta: 100,
        },
        {
          id: 'log-101',
          timestamp: '2026-03-10T10:15:00Z',
          category: 'mastery' as const,
          title: 'Meisterschaft Finte erlernt',
          detail: 'Kosten: 15 EP',
          xpDelta: -15,
        },
      ],
      inventory: [
        {
          id: 'inv-w1',
          name: 'Krummsäbel',
          type: 'weapon' as const,
          quantity: 1,
          weight: 2,
          price: '15 L',
          desc: 'Scharfe gekrümmte Klinge',
          equipped: true,
          source: 'GRW',
          page: 184,
          weaponSkill: 'Klingenwaffen',
          damage: '1W6+3',
          wgs: 7,
          attributes: 'Scharf 1',
        },
        {
          id: 'inv-a1',
          name: 'Lederharnisch',
          type: 'armor' as const,
          quantity: 1,
          weight: 3,
          price: '8 L',
          equipped: true,
          source: 'GRW',
          page: 189,
          sr: 1,
          vtdBonus: 0,
          handicap: 1,
          tickModifier: 0,
        },
        {
          id: 'inv-g1',
          name: 'Kletterseil (10m)',
          type: 'gear' as const,
          category: 'Ausrüstung',
          quantity: 2,
          weight: 1,
          price: '1 L',
          desc: 'Reißfestes Hanfseil',
          equipped: false,
          source: 'GRW',
          page: 190,
        },
      ],
      money: {
        solare: 2,
        lunare: 45,
        telare: 12,
      },
      ignoreEncumbrance: true,
      creationFinalized: true,
    };

    // 1. Simulate Export: JSON stringify
    const exportedJson = JSON.stringify(fullOriginalCharacter);

    // 2. Simulate Import: JSON parse + validate
    const rawParsed = JSON.parse(exportedJson);
    const importedPartial = validateCharacterImport(rawParsed);

    // 3. Verify that every single property is preserved without any data loss
    expect(importedPartial.name).toBe(fullOriginalCharacter.name);
    expect(importedPartial.race).toBe(fullOriginalCharacter.race);
    expect(importedPartial.xpTotal).toBe(fullOriginalCharacter.xpTotal);
    expect(importedPartial.creationFinalized).toBe(true);
    expect(importedPartial.attrBase).toEqual(fullOriginalCharacter.attrBase);
    expect(importedPartial.attrIncrements).toEqual(fullOriginalCharacter.attrIncrements);
    expect(importedPartial.skillsBase).toEqual(fullOriginalCharacter.skillsBase);
    expect(importedPartial.skillsXp).toEqual(fullOriginalCharacter.skillsXp);
    expect(importedPartial.masteries).toEqual(fullOriginalCharacter.masteries);
    expect(importedPartial.strengthsList).toEqual(fullOriginalCharacter.strengthsList);
    expect(importedPartial.resourcesList).toEqual(fullOriginalCharacter.resourcesList);
    expect(importedPartial.weaknessesList).toEqual(fullOriginalCharacter.weaknessesList);
    expect(importedPartial.languagesList).toEqual(fullOriginalCharacter.languagesList);
    expect(importedPartial.spellsList).toEqual(fullOriginalCharacter.spellsList);
    expect(importedPartial.playState).toEqual(fullOriginalCharacter.playState);
    expect(importedPartial.advancementLog).toEqual(fullOriginalCharacter.advancementLog);
    expect(importedPartial.inventory).toEqual(fullOriginalCharacter.inventory);
    expect(importedPartial.money).toEqual(fullOriginalCharacter.money);
    expect(importedPartial.ignoreEncumbrance).toBe(true);
  });
});
