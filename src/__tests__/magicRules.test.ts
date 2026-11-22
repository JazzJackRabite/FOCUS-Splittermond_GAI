import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Katalog } from '../regelwerk/katalog';
import { setzeAktivenKatalog } from '../regelwerk/bruecke';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';

// Die Zauberwirkungen kommen aus den Regelpaketen (daten.spielwerte) – dafür das eingebaute GRW-Paket laden
beforeAll(() => { const b = basisAusDateien(); setzeAktivenKatalog(new Katalog(b.manifest, [b.basis]), false); });
afterAll(() => setzeAktivenKatalog(null, false));
import {
  parseFocusCost,
  lookupSpellInDb,
  getFullSpellInfo,
  calculateSpellEG,
  calculateTotalEGSpent,
  calculateFinalSpellCosts,
  INITIAL_EG_ALLOCATIONS,
  parseSpellPermissibleModifications,
  getActiveSpellModifiers,
  getActiveSpellRollBonuses,
  getSpellWeaponDamageBonus,
  getSpellHealingInfo,
  calculateSpellHealing,
  getEnhancedSpellDamage,
  getSelectedSpecificEnhancementEffects,
  parseEnhancementFocusDelta,
  isEquipmentTargetingSpell,
  getWeaponEnchantments,
  combineDamageFormula,
} from '../utils/magicRules';
import { baseCharacterReducer, DEFAULT_STATE } from '../hooks/useCharacterState';
import type { CharacterState, ChanneledSpell, Spell } from '../types';

describe('magicRules - parseFocusCost', () => {
  it('parses channeled focus cost correctly (e.g. K4)', () => {
    const result = parseFocusCost('K4');
    expect(result.isChanneled).toBe(true);
    expect(result.channeled).toBe(4);
    expect(result.exhausted).toBe(0);
    expect(result.consumed).toBe(0);
    expect(result.total).toBe(4);
  });

  it('parses standard exhausted focus cost (e.g. 4)', () => {
    const result = parseFocusCost('4');
    expect(result.isChanneled).toBe(false);
    expect(result.channeled).toBe(0);
    expect(result.exhausted).toBe(4);
    expect(result.consumed).toBe(0);
    expect(result.total).toBe(4);
  });

  it('parses consumed focus cost (e.g. 5V2 and 12V3)', () => {
    const result5v2 = parseFocusCost('5V2');
    expect(result5v2.isChanneled).toBe(false);
    expect(result5v2.channeled).toBe(0);
    // GRW: V ist Teil der Gesamtkosten (5V2 = 5 Fokus, davon 2 verzehrt)
    expect(result5v2.exhausted).toBe(3);
    expect(result5v2.consumed).toBe(2);
    expect(result5v2.total).toBe(5);

    const result12v3 = parseFocusCost('12V3');
    expect(result12v3.isChanneled).toBe(false);
    expect(result12v3.channeled).toBe(0);
    expect(result12v3.exhausted).toBe(9);
    expect(result12v3.consumed).toBe(3);
    expect(result12v3.total).toBe(12);
  });

  it('parses channeled with consumed (e.g. K4V1)', () => {
    const result = parseFocusCost('K4V1');
    expect(result.isChanneled).toBe(true);
    expect(result.channeled).toBe(3);
    expect(result.consumed).toBe(1);
    expect(result.total).toBe(4);
  });

  it('handles empty or dash cost', () => {
    const result = parseFocusCost('—');
    expect(result.channeled).toBe(0);
    expect(result.exhausted).toBe(0);
    expect(result.consumed).toBe(0);
    expect(result.total).toBe(0);
  });
});

import { zauberEgRegeln } from '../regelwerk/zauberEg';
const KB = basisAusDateien();
const K = new Katalog(KB.manifest, [KB.basis]);

describe('magicRules - enhancements & info', () => {
  it('EG-Optionen und Auslösezeit aus dem Paket (GRW S. 221–222)', () => {
    const r = zauberEgRegeln(K);
    expect([r.erschoepft.eg, r.kanalisiert.eg, r.verzehrt.eg, r.schaden.eg, r.reichweite.eg, r.wirkungsdauer.eg, r.wirkungsbereich.eg, r.ausloesezeit.eg]).toEqual([1, 2, 3, 1, 1, 2, 3, 3]);
    expect(r.ausloesezeit).toMatchObject({ hoechstens: 2, minimum: 1 });
    expect(r.grundAusloesezeit).toBe(3);
    expect(zauberEgRegeln(null).schaden.eg).toBe(Infinity);
  });

  it('retrieves spell info from database', () => {
    const spell: Spell = {
      name: 'Wahrer Blick',
      school: 'Bannmagie',
      grade: 0,
      cost: 'K1',
    };
    const info = getFullSpellInfo(spell);
    expect(info.name).toBe('Wahrer Blick');
    expect(info.cost).toBe('K1');
    expect(info.isChanneled).toBe(true);
  });

  it('matches user example scenario: Feuerstrahl with 3 EG', () => {
    // Example from prompt:
    // Difficulty: 18, Roll: 27 -> diff: 9 -> 3 EG
    // Base cost: 5V2 (3 exhausted, 2 consumed)
    // Allocations: 1 EG for +1 damage, 2 EG to save 2 exhausted focus
    // Final focus costs: 1 exhausted (minimum 1), 2 consumed
    const egCalc = calculateSpellEG(27, 18);
    expect(egCalc.isSuccess).toBe(true);
    expect(egCalc.differenz).toBe(9);
    expect(egCalc.eg).toBe(3);

    const allocations = {
      ...INITIAL_EG_ALLOCATIONS,
      increaseDamage: 1, // 1 EG
      saveExhaustedFocus: 2, // 2 EG
    };

    expect(calculateTotalEGSpent(allocations)).toBe(3);

    const baseCost = parseFocusCost('5V2');
    const finalCosts = calculateFinalSpellCosts(baseCost, allocations);

    expect(finalCosts.effectiveExhausted).toBe(1);
    expect(finalCosts.effectiveConsumed).toBe(2);
    expect(finalCosts.effectiveChanneled).toBe(0);
    expect(finalCosts.totalFocus).toBe(3);
  });

  it('handles spell failure: exhausts negative EG focus', () => {
    // Failure: difficulty 18, roll 12 -> diff -6 -> -2 negative EG
    const egCalc = calculateSpellEG(12, 18);
    expect(egCalc.isSuccess).toBe(false);
    expect(egCalc.differenz).toBe(-6);
    expect(egCalc.negativeEG).toBe(2);
    expect(egCalc.exhaustedFocusLostOnFailure).toBe(2);
  });

  it('correctly parses permissible modifications according to Splittermond database', () => {
    // 1. Wahrer Blick: only Auslösezeit and Verstärken
    const wahrerBlick = lookupSpellInDb('Wahrer Blick', 'Bannmagie');
    expect(wahrerBlick).toBeDefined();
    const wbMods = parseSpellPermissibleModifications(wahrerBlick?.description, wahrerBlick?.name);
    expect(wbMods.allowsCastTime).toBe(true);
    expect(wbMods.allowsEnhance).toBe(true);
    expect(wbMods.allowsDamage).toBe(false);
    expect(wbMods.allowsRange).toBe(false);
    expect(wbMods.allowsDuration).toBe(false);
    expect(wbMods.allowsArea).toBe(false);
    expect(wbMods.allowsExhaustedFocus).toBe(false);
    expect(wbMods.allowsChanneledFocus).toBe(false);
    expect(wbMods.allowsConsumedFocus).toBe(false);
    expect(wbMods.specificEnhancements.length).toBeGreaterThan(0);
    expect(wbMods.specificEnhancements[0].egCost).toBe(2);
    expect(wbMods.specificEnhancements[0].focusCostRaw).toBe('+K1V1');

    // 2. Feuerstrahl: has Schaden, Reichweite, Erschöpfter Fokus, Verzehrter Fokus
    const feuerstrahl = lookupSpellInDb('Feuerstrahl', 'Kampfmagie');
    expect(feuerstrahl).toBeDefined();
    const fsMods = parseSpellPermissibleModifications(feuerstrahl?.description, feuerstrahl?.name);
    expect(fsMods.allowsDamage).toBe(true);
    expect(fsMods.allowsRange).toBe(true);
    expect(fsMods.allowsCastTime).toBe(true);
    expect(fsMods.allowsExhaustedFocus).toBe(true);
    expect(fsMods.allowsConsumedFocus).toBe(true);
    expect(fsMods.allowsDuration).toBe(false);
    expect(fsMods.allowsArea).toBe(false);

    // 3. Aura der Entschlossenheit: has Kanalisierter Fokus, Wirkungsbereich, Verzehrter Fokus
    const aura = lookupSpellInDb('Aura der Entschlossenheit', 'Stärkung');
    expect(aura).toBeDefined();
    const auraMods = parseSpellPermissibleModifications(aura?.description, aura?.name);
    expect(auraMods.allowsChanneledFocus).toBe(true);
    expect(auraMods.allowsArea).toBe(true);
    expect(auraMods.allowsConsumedFocus).toBe(true);
    expect(auraMods.allowsDamage).toBe(false);
    expect(auraMods.allowsRange).toBe(false);
  });

  it('saves consumed focus (3 EG per 1 consumed FO) and applies specific enhancement focus costs', () => {
    // Spell costs 4V2 (2 exhausted focus, 2 consumed focus)
    const baseCost = parseFocusCost('4V2');
    expect(baseCost.exhausted).toBe(2);
    expect(baseCost.consumed).toBe(2);

    const availableEnhancements = [
      {
        id: 'enh-1',
        egCost: 2,
        focusCostRaw: '+1V1',
        focusDelta: parseFocusCost('1V1'), // 0 exhausted, 1 consumed
        description: 'Zusätzlicher Effekt',
        raw: '2 EG (Kosten +1V1): Zusätzlicher Effekt',
      },
    ];

    const allocations = {
      ...INITIAL_EG_ALLOCATIONS,
      saveConsumedFocus: 1, // 3 EG spent -> saves 1 consumed focus
      selectedEnhancementIds: ['enh-1'], // 2 EG spent -> costs +1V1
    };

    // Total EG spent: 3 (saveConsumedFocus) + 2 (enh-1) = 5 EG
    expect(calculateTotalEGSpent(allocations, availableEnhancements)).toBe(5);

    const finalCosts = calculateFinalSpellCosts(baseCost, allocations, availableEnhancements);
    // Base exhausted: 2, save: 0, enh: +0 -> 2
    expect(finalCosts.effectiveExhausted).toBe(2);
    // Base consumed: 2, save: -1, enh: +1 -> 2
    expect(finalCosts.effectiveConsumed).toBe(2);
    expect(finalCosts.modificationsSummary).toContain('-1 Verzehrter Fokus (3 EG)');
    expect(finalCosts.modificationsSummary.some((s) => s.includes('Verstärkung: Zusätzlicher Effekt [Kosten +1V1] (2 EG)'))).toBe(true);
  });
});

describe('useCharacterState - spell actions', () => {
  it('PLAY_CAST_SPELL deducts exhausted focus', () => {
    const state: CharacterState = {
      ...DEFAULT_STATE,
      playState: {
        ...DEFAULT_STATE.playState,
        focus: { exhausted: 2, consumed: 0, channeled: 0 },
        channeledSpells: [],
      },
    };

    const nextState = baseCharacterReducer(state, {
      type: 'PLAY_CAST_SPELL',
      payload: {
        exhaustedFocus: 4,
        channeledFocus: 0,
        consumedFocus: 0,
      },
    });

    expect(nextState.playState.focus.exhausted).toBe(6);
    expect(nextState.playState.focus.channeled).toBe(0);
    expect(nextState.playState.focus.consumed).toBe(0);
  });

  it('PLAY_CAST_SPELL adds channeled focus and creates active channeled spell', () => {
    const state: CharacterState = {
      ...DEFAULT_STATE,
      playState: {
        ...DEFAULT_STATE.playState,
        focus: { exhausted: 0, consumed: 0, channeled: 0 },
        channeledSpells: [],
      },
    };

    const newSpell: ChanneledSpell = {
      id: 'spell-1',
      name: 'Lichtstrahl',
      school: 'Lichtmagie',
      grade: 1,
      channeledFocus: 4,
      activeRounds: 1,
      activeTicks: 0,
      startedAt: '2026-08-31',
    };

    const nextState = baseCharacterReducer(state, {
      type: 'PLAY_CAST_SPELL',
      payload: {
        exhaustedFocus: 0,
        channeledFocus: 4,
        consumedFocus: 0,
        channeledSpell: newSpell,
      },
    });

    expect(nextState.playState.focus.channeled).toBe(4);
    expect(nextState.playState.channeledSpells).toHaveLength(1);
    expect(nextState.playState.channeledSpells[0].name).toBe('Lichtstrahl');
  });

  it('PLAY_CANCEL_CHANNELED_SPELL releases channeled focus into exhausted focus pool', () => {
    const state: CharacterState = {
      ...DEFAULT_STATE,
      playState: {
        ...DEFAULT_STATE.playState,
        focus: { exhausted: 2, consumed: 0, channeled: 4 },
        channeledSpells: [
          {
            id: 'spell-1',
            name: 'Lichtstrahl',
            channeledFocus: 4,
          },
        ],
      },
    };

    const nextState = baseCharacterReducer(state, {
      type: 'PLAY_CANCEL_CHANNELED_SPELL',
      payload: { id: 'spell-1' },
    });

    expect(nextState.playState.focus.channeled).toBe(0);
    expect(nextState.playState.focus.exhausted).toBe(6); // 2 + 4
    expect(nextState.playState.channeledSpells).toHaveLength(0);
  });

  it('PLAY_UPDATE_CHANNELED_SPELL updates active rounds and ticks', () => {
    const state: CharacterState = {
      ...DEFAULT_STATE,
      playState: {
        ...DEFAULT_STATE.playState,
        channeledSpells: [
          {
            id: 'spell-1',
            name: 'Lichtstrahl',
            channeledFocus: 4,
            activeRounds: 1,
            activeTicks: 4,
          },
        ],
      },
    };

    const nextState = baseCharacterReducer(state, {
      type: 'PLAY_UPDATE_CHANNELED_SPELL',
      payload: {
        id: 'spell-1',
        update: { activeRounds: 2, activeTicks: 10 },
      },
    });

    expect(nextState.playState.channeledSpells[0].activeRounds).toBe(2);
    expect(nextState.playState.channeledSpells[0].activeTicks).toBe(10);
  });

  describe('getActiveSpellModifiers (Buff Spells like Steinhaut)', () => {
    it('correctly calculates +2 VTD and +2 SR for standard Steinhaut', () => {
      const mods = getActiveSpellModifiers([
        {
          id: 'cs-1',
          name: 'Steinhaut',
          channeledFocus: 6,
        },
      ]);

      expect(mods.vtdBonus).toBe(2);
      expect(mods.srBonus).toBe(2);
      expect(mods.breakdown).toHaveLength(1);
      expect(mods.breakdown[0].description).toBe('+2 VTD, +2 SR');
    });

    it('correctly calculates +2 VTD and +3 SR for enhanced Steinhaut (SR auf 3 Punkte)', () => {
      const mods = getActiveSpellModifiers([
        {
          id: 'cs-1',
          name: 'Steinhaut',
          channeledFocus: 8,
          enhancements: ['Der Bonus auf die SR erhöht sich auf 3 Punkte. (+K2V2)'],
        },
      ]);

      expect(mods.vtdBonus).toBe(2);
      expect(mods.srBonus).toBe(3);
    });

    it('returns 0 bonuses when no buff spells are channeled', () => {
      const mods = getActiveSpellModifiers([
        {
          id: 'cs-2',
          name: 'Lichtstrahl',
          channeledFocus: 4,
        },
      ]);

      expect(mods.vtdBonus).toBe(0);
      expect(mods.srBonus).toBe(0);
      expect(mods.breakdown).toHaveLength(0);
    });

    it('correctly calculates wound penalty reductions (Schmerzen widerstehen & Aura der Schmerzlosigkeit)', () => {
      const mods1 = getActiveSpellModifiers([
        { id: 'cs-sw', name: 'Schmerzen widerstehen', channeledFocus: 4 },
      ]);
      expect(mods1.woundPenaltyReduction).toBe(3);

      const mods2 = getActiveSpellModifiers([
        { id: 'cs-si', name: 'Schmerzen ignorieren', channeledFocus: 6 },
      ]);
      expect(mods2.woundPenaltyReduction).toBe(6);

      const mods3 = getActiveSpellModifiers([
        { id: 'cs-as', name: 'Aura der Schmerzlosigkeit', channeledFocus: 8 },
      ]);
      expect(mods3.woundPenaltyReduction).toBe(999);
    });
  });

  describe('getActiveSpellRollBonuses & Weapon Buffs', () => {
    it('applies attribute roll bonuses based on SKILL_DATA (Katzenreflexe, Bärenstärke)', () => {
      const channeled = [
        { id: 'cs-kr', name: 'Katzenreflexe', channeledFocus: 4 },
        { id: 'cs-bs', name: 'Bärenstärke', channeledFocus: 4 },
      ];

      // Akrobatik uses [BEW, STA] -> should get both Katzenreflexe (+2) and Bärenstärke (+4)
      const akrobatikBonuses = getActiveSpellRollBonuses(channeled, 'Akrobatik', false);
      expect(akrobatikBonuses).toHaveLength(2);
      expect(akrobatikBonuses.find((b) => b.source === 'Katzenreflexe')?.bonus).toBe(2);
      expect(akrobatikBonuses.find((b) => b.source === 'Bärenstärke')?.bonus).toBe(4);

      // Heimlichkeit uses [BEW, INT] -> gets Katzenreflexe (+2) but NOT Bärenstärke
      const heimlichkeitBonuses = getActiveSpellRollBonuses(channeled, 'Heimlichkeit', false);
      expect(heimlichkeitBonuses).toHaveLength(1);
      expect(heimlichkeitBonuses[0].source).toBe('Katzenreflexe');
    });

    it('applies specific skill bonuses (Sinne verstärken, Aura der Schatten, Segnung)', () => {
      const channeled = [
        { id: 'cs-sinne', name: 'Sinne verstärken', channeledFocus: 4 },
        { id: 'cs-schatten', name: 'Aura der Schatten', channeledFocus: 6 },
        { id: 'cs-segnung', name: 'Segnung', channeledFocus: 2 },
      ];

      const wahrnehmungBonuses = getActiveSpellRollBonuses(channeled, 'Wahrnehmung', false);
      // Sinne verstärken (+5) and Segnung (+1)
      expect(wahrnehmungBonuses.find((b) => b.source === 'Sinne verstärken')?.bonus).toBe(5);
      expect(wahrnehmungBonuses.find((b) => b.source === 'Segnung')?.bonus).toBe(1);

      const heimlichkeitBonuses = getActiveSpellRollBonuses(channeled, 'Heimlichkeit', false);
      // Aura der Schatten (+7) and Segnung (+1)
      expect(heimlichkeitBonuses.find((b) => b.source === 'Aura der Schatten')?.bonus).toBe(7);
      expect(heimlichkeitBonuses.find((b) => b.source === 'Segnung')?.bonus).toBe(1);
    });

    it('applies combat attack roll and weapon damage bonuses', () => {
      const channeled = [
        { id: 'cs-anfuehrer', name: 'Aura des Anführers', channeledFocus: 6 },
        { id: 'cs-flamme', name: 'Flammende Waffe', channeledFocus: 4 },
        { id: 'cs-licht', name: 'Waffe des Lichtes', channeledFocus: 4 },
      ];

      const atkBonuses = getActiveSpellRollBonuses(channeled, 'Klingenwaffen', true);
      expect(atkBonuses.find((b) => b.source === 'Aura des Anführers')?.bonus).toBe(2);

      // Flammende Waffe und Waffe des Lichtes sind nicht kombinierbar (Typen Schaden und Waffe, GRW S. 229/250):
      // es zählt nur ein Zusatzschaden.
      const weaponDmg = getSpellWeaponDamageBonus(channeled);
      expect(weaponDmg.totalDamage).toBe(1);
      expect(weaponDmg.fireDamage + weaponDmg.lightDamage).toBe(1);
    });
  });

  describe('calculateSpellHealing & EG modifications', () => {
    it('returns correct healing details for self-healing and restoration', () => {
      expect(getSpellHealingInfo('Selbstheilung')?.baseLP).toBe(3);
      expect(getSpellHealingInfo('Leichte Heilung')?.baseLP).toBe(6);
      expect(getSpellHealingInfo('Heilung')?.baseLP).toBe(16);
      expect(getSpellHealingInfo('Wiederherstellung')?.isRestoreAll).toBe(true);
    });

    it('calculates Selbstheilung with base and with 2 EG enhancement (6 LP)', () => {
      const specificEnhancements = [
        {
          id: 'enh-1',
          egCost: 2,
          focusCostRaw: '+1V1',
          focusDelta: { raw: '+1V1', isChanneled: false, exhausted: 0, channeled: 0, consumed: 1, total: 1 },
          description: 'Es werden insgesamt 6 Lebenspunkte regeneriert.',
          raw: '2 EG (Kosten +1V1): Es werden insgesamt 6 Lebenspunkte regeneriert.',
        },
      ];

      // Base
      const unenhanced = calculateSpellHealing('Selbstheilung', INITIAL_EG_ALLOCATIONS, specificEnhancements);
      expect(unenhanced?.totalLP).toBe(3);

      // With specific 2 EG enhancement
      const enhanced = calculateSpellHealing(
        'Selbstheilung',
        { ...INITIAL_EG_ALLOCATIONS, selectedEnhancementIds: ['enh-1'] },
        specificEnhancements
      );
      expect(enhanced?.totalLP).toBe(6);
      expect(enhanced?.hasEnhancementSelected).toBe(true);
    });

    it('calculates Leichte Heilung with base (6 LP) and 2 EG enhancement (10 LP)', () => {
      const specificEnhancements = [
        {
          id: 'enh-lh',
          egCost: 2,
          focusCostRaw: '+2V2',
          focusDelta: { raw: '+2V2', isChanneled: false, exhausted: 0, channeled: 0, consumed: 2, total: 2 },
          description: 'Es werden insgesamt 10 Lebenspunkte regeneriert.',
          raw: '2 EG (Kosten +2V2): Es werden insgesamt 10 Lebenspunkte regeneriert.',
        },
      ];

      const unenhanced = calculateSpellHealing('Leichte Heilung', INITIAL_EG_ALLOCATIONS, specificEnhancements);
      expect(unenhanced?.totalLP).toBe(6);

      const enhanced = calculateSpellHealing(
        'Leichte Heilung',
        { ...INITIAL_EG_ALLOCATIONS, selectedEnhancementIds: ['enh-lh'] },
        specificEnhancements
      );
      expect(enhanced?.totalLP).toBe(10);
      expect(enhanced?.hasEnhancementSelected).toBe(true);
    });

    it('calculates Heilung with base (16 LP) and 1 EG enhancement (24 LP)', () => {
      const specificEnhancements = [
        {
          id: 'enh-h',
          egCost: 1,
          focusCostRaw: '+3V3',
          focusDelta: { raw: '+3V3', isChanneled: false, exhausted: 0, channeled: 0, consumed: 3, total: 3 },
          description: 'Es werden insgesamt 24 Lebenspunkte regeneriert.',
          raw: '1 EG (Kosten +3V3): Es werden insgesamt 24 Lebenspunkte regeneriert.',
        },
      ];

      const unenhanced = calculateSpellHealing('Heilung', INITIAL_EG_ALLOCATIONS, specificEnhancements);
      expect(unenhanced?.totalLP).toBe(16);

      const enhanced = calculateSpellHealing(
        'Heilung',
        { ...INITIAL_EG_ALLOCATIONS, selectedEnhancementIds: ['enh-h'] },
        specificEnhancements
      );
      expect(enhanced?.totalLP).toBe(24);
      expect(enhanced?.hasEnhancementSelected).toBe(true);
    });

    it('calculates Wiederherstellung with 1 EG enhancement curing poisons & diseases', () => {
      const specificEnhancements = [
        {
          id: 'enh-wh',
          egCost: 1,
          focusCostRaw: '+4V4',
          focusDelta: { raw: '+4V4', isChanneled: false, exhausted: 0, channeled: 0, consumed: 4, total: 4 },
          description: 'Zusätzlich werden alle Gifte und Krankheiten aufgehoben, sofern sie maximal den Zustand Siechtum 2 verleihen.',
          raw: '1 EG (Kosten +4V4): Zusätzlich werden alle Gifte und Krankheiten aufgehoben...',
        },
      ];

      const unenhanced = calculateSpellHealing('Wiederherstellung', INITIAL_EG_ALLOCATIONS, specificEnhancements);
      expect(unenhanced?.isRestoreAll).toBe(true);
      expect(unenhanced?.curesPoisonDisease).toBe(false);

      const enhanced = calculateSpellHealing(
        'Wiederherstellung',
        { ...INITIAL_EG_ALLOCATIONS, selectedEnhancementIds: ['enh-wh'] },
        specificEnhancements
      );
      expect(enhanced?.isRestoreAll).toBe(true);
      expect(enhanced?.curesPoisonDisease).toBe(true);
    });

    it('Erfrischung und Giftbann heben beim Wirken keinen Zustand auf', () => {
      // Erfrischung unterdrückt Stufen von Erschöpft, solange sie wirkt (wirksameZustaende, GRW S. 227); Giftbann hebt
      // Gifte nach Grad auf – einen Zustand „Vergiftet“ gibt es im GRW nicht.
      expect(getSpellHealingInfo('Erfrischung')).toBeNull();
      expect(getSpellHealingInfo('Giftbann')).toBeNull();
      expect(getSpellHealingInfo('Feuerstrahl')).toBeNull();
    });
  });

  describe('Audit of specific enhancements on other spells', () => {
    it('applies Magische Rüstung enhancement (+3 VTD instead of +2 VTD)', () => {
      const unenhanced: ChanneledSpell = { id: 'cs1', name: 'Magische Rüstung', channeledFocus: 4 };
      expect(getActiveSpellModifiers([unenhanced]).vtdBonus).toBe(2);

      const enhanced: ChanneledSpell = {
        id: 'cs2',
        name: 'Magische Rüstung',
        channeledFocus: 4,
        selectedEnhancementIds: ['enh-1'],
        enhancements: ['Verstärkung: Die Erhöhung beträgt 3 Punkte. [Kosten +K1V1] (1 EG)'],
      };
      expect(getActiveSpellModifiers([enhanced]).vtdBonus).toBe(3);
    });

    it('applies Magischer Panzer enhancement (+5 VTD instead of +4 VTD)', () => {
      const unenhanced: ChanneledSpell = { id: 'cs1', name: 'Magischer Panzer', channeledFocus: 12 };
      expect(getActiveSpellModifiers([unenhanced]).vtdBonus).toBe(4);

      const enhanced: ChanneledSpell = {
        id: 'cs2',
        name: 'Magischer Panzer',
        channeledFocus: 12,
        selectedEnhancementIds: ['enh-1'],
        enhancements: ['Verstärkung: Die Erhöhung beträgt 5 Punkte. [Kosten +K3V3] (1 EG)'],
      };
      expect(getActiveSpellModifiers([enhanced]).vtdBonus).toBe(5);
    });

    it('applies Widerstände erhöhen enhancement (+3 GW/KW instead of +2)', () => {
      const unenhanced: ChanneledSpell = { id: 'cs1', name: 'Widerstände erhöhen', channeledFocus: 12 };
      const baseMods = getActiveSpellModifiers([unenhanced]);
      expect(baseMods.gwBonus).toBe(2);
      expect(baseMods.kwBonus).toBe(2);

      const enhanced: ChanneledSpell = {
        id: 'cs2',
        name: 'Widerstände erhöhen',
        channeledFocus: 12,
        selectedEnhancementIds: ['enh-1'],
        enhancements: ['Verstärkung: Der Bonus erhöht sich auf 3 Punkte. [Kosten +K3V3] (2 EG)'],
      };
      const enhMods = getActiveSpellModifiers([enhanced]);
      expect(enhMods.gwBonus).toBe(3);
      expect(enhMods.kwBonus).toBe(3);
    });

    it('applies Beflügelte Waffe enhancement (+3 attack instead of +2)', () => {
      const unenhanced: ChanneledSpell = { id: 'cs1', name: 'Beflügelte Waffe', channeledFocus: 8 };
      expect(getActiveSpellRollBonuses([unenhanced], 'Klingenwaffen')[0]?.bonus).toBe(2);

      const enhanced: ChanneledSpell = {
        id: 'cs2',
        name: 'Beflügelte Waffe',
        channeledFocus: 8,
        selectedEnhancementIds: ['enh-1'],
        enhancements: ['Verstärkung: Der Bonus erhöht sich auf 3 Punkte. [Kosten +K1V1] (2 EG)'],
      };
      expect(getActiveSpellRollBonuses([enhanced], 'Klingenwaffen')[0]?.bonus).toBe(3);
    });

    it('applies Bärenstärke enhancement (+5 Stärke instead of +4)', () => {
      const unenhanced: ChanneledSpell = { id: 'cs1', name: 'Bärenstärke', channeledFocus: 12 };
      expect(getActiveSpellRollBonuses([unenhanced], 'STA')[0]?.bonus).toBe(4);

      const enhanced: ChanneledSpell = {
        id: 'cs2',
        name: 'Bärenstärke',
        channeledFocus: 12,
        selectedEnhancementIds: ['enh-1'],
        enhancements: ['Verstärkung: Der Bonus erhöht sich auf 5 Punkte. [Kosten +K4V4] (2 EG)'],
      };
      expect(getActiveSpellRollBonuses([enhanced], 'STA')[0]?.bonus).toBe(5);
    });

    it('increases Lebensraub damage from 2W6+5 to 4W6+5 with 1 EG enhancement', () => {
      const specificEnhancements = [
        {
          id: 'enh-1',
          egCost: 1,
          focusCostRaw: '+3V3',
          focusDelta: { raw: '+3V3', isChanneled: false, exhausted: 0, channeled: 0, consumed: 3, total: 3 },
          description: 'Die Anzahl der entzogenen Lebenspunkte erhöht sich auf 4W6+5.',
          raw: '1 EG (Kosten +3V3): Die Anzahl der entzogenen Lebenspunkte erhöht sich auf 4W6+5.',
        },
      ];
      const unenhanced = getEnhancedSpellDamage('Lebensraub', 'Der Zauberer entzieht 2W6+5 LP...', INITIAL_EG_ALLOCATIONS, specificEnhancements);
      expect(unenhanced?.formula).toBe('2W6+5');

      const enhanced = getEnhancedSpellDamage(
        'Lebensraub',
        'Der Zauberer entzieht 2W6+5 LP...',
        { ...INITIAL_EG_ALLOCATIONS, selectedEnhancementIds: ['enh-1'] },
        specificEnhancements
      );
      expect(enhanced?.formula).toBe('4W6+5');
      expect(enhanced?.diceCount).toBe(4);
    });

    it('verursachte Zustände kommen aus dem Paketfeld, nicht aus dem Text (Blitzschlag: Benommen 1)', () => {
      const specificEnhancements = [
        {
          id: 'enh-1',
          egCost: 1,
          focusCostRaw: '+2V2',
          focusDelta: { raw: '+2V2', isChanneled: false, exhausted: 0, channeled: 0, consumed: 2, total: 2 },
          description: 'Das Ziel erhält zusätzlich für 30 Ticks den Zustand Benommen 1.',
          raw: '1 EG (Kosten +2V2): Das Ziel erhält zusätzlich für 30 Ticks den Zustand Benommen 1.',
          zustaende: [{ name: 'Benommen', stufe: 1, ticks: 30 }],
        },
      ];
      const effects = getSelectedSpecificEnhancementEffects(
        'Blitzschlag',
        { ...INITIAL_EG_ALLOCATIONS, selectedEnhancementIds: ['enh-1'] },
        specificEnhancements
      );
      expect(effects).toHaveLength(1);
      expect(effects[0].addedCondition).toBe('Benommen 1 (30 Ticks)');
      // ohne Paketfeld keine Textsuche
      expect(getSelectedSpecificEnhancementEffects('x', { ...INITIAL_EG_ALLOCATIONS, selectedEnhancementIds: ['enh-1'] }, [{ ...specificEnhancements[0], zustaende: undefined }])[0].addedCondition).toBeUndefined();
    });

    it('applies Krallen & Schockgriff enhanced weapon damage', () => {
      const enhancedKrallen: ChanneledSpell = {
        id: 'cs1',
        name: 'Krallen',
        channeledFocus: 1,
        selectedEnhancementIds: ['enh-1'],
        enhancements: ['Verstärkung: Der Schaden erhöht sich zusätzlich um 1 Punkt. [Kosten +K1V1] (1 EG)'],
      };
      // Krallen wirken auf waffenlose Angriffe (GRW S. 234), nicht auf Waffen
      const dmg = getSpellWeaponDamageBonus([enhancedKrallen], 'waffenlos');
      expect(dmg.bonusText).toContain('Krallen');
      expect(dmg.totalDamage).toBe(1);
      expect(getSpellWeaponDamageBonus([enhancedKrallen], 'w-katar', 'Katar').totalDamage).toBe(0);
    });

    it('correctly parses enhancement focus deltas with parseEnhancementFocusDelta', () => {
      // Die Zahl hinter V ist Teil der genannten Punkte (GRW S. 221–222: „1 Punkt verzehrter Fokus … Kosten -(K)1V1“)
      const dK1V1 = parseEnhancementFocusDelta('+K1V1');
      expect(dK1V1.channeled).toBe(0);
      expect(dK1V1.consumed).toBe(1);
      expect(dK1V1.total).toBe(1);

      const dK2V2 = parseEnhancementFocusDelta('+K2V2');
      expect(dK2V2.channeled).toBe(0);
      expect(dK2V2.consumed).toBe(2);
      expect(dK2V2.total).toBe(2);

      const d1V1 = parseEnhancementFocusDelta('+1V1');
      expect(d1V1.exhausted).toBe(0);
      expect(d1V1.consumed).toBe(1);
      expect(d1V1.total).toBe(1);

      const d2V1 = parseEnhancementFocusDelta('+2V1');
      expect(d2V1.exhausted).toBe(1);
      expect(d2V1.consumed).toBe(1);
      expect(d2V1.total).toBe(2);
    });

    it('correctly calculates final costs for Flammende Waffe with +K1V1 enhancement', () => {
      const baseCost = parseFocusCost('K4V1'); // 3 channeled, 1 consumed
      const specificEnhancements = [
        {
          id: 'enh-1',
          egCost: 2,
          focusCostRaw: '+K1V1',
          focusDelta: parseEnhancementFocusDelta('+K1V1'),
          description: 'Die Klinge richtet 2 Punkte Feuerschaden an.',
          raw: '2 EG (Kosten +K1V1): Die Klinge richtet 2 Punkte Feuerschaden an.',
        },
      ];
      const finalCosts = calculateFinalSpellCosts(
        baseCost,
        { ...INITIAL_EG_ALLOCATIONS, selectedEnhancementIds: ['enh-1'] },
        specificEnhancements
      );
      // K4V1 + K1V1 = K5V2: 3 kanalisiert, 2 verzehrt
      expect(finalCosts.effectiveChanneled).toBe(3);
      expect(finalCosts.effectiveConsumed).toBe(2);
      expect(finalCosts.totalFocus).toBe(5);
    });

    it('applies Flammende Waffe and Waffe des Lichtes enhanced damage (+2)', () => {
      const enhancedFlamme: ChanneledSpell = {
        id: 'cs-flamme-enh',
        name: 'Flammende Waffe',
        channeledFocus: 4,
        selectedEnhancementIds: ['enh-1'],
        notes: 'Verstärkung: Die Klinge richtet 2 Punkte Feuerschaden an. [Kosten +K1V1]',
      };
      const dmgFlamme = getSpellWeaponDamageBonus([enhancedFlamme]);
      expect(dmgFlamme.fireDamage).toBe(2);
      expect(dmgFlamme.bonusText).toContain('+2 Feuerschaden');

      const enhancedLicht: ChanneledSpell = {
        id: 'cs-licht-enh',
        name: 'Waffe des Lichtes',
        channeledFocus: 8,
        selectedEnhancementIds: ['enh-1'],
        notes: 'Verstärkung: Der Zusatzschaden erhöht sich auf 2 Punkte Lichtschaden. [Kosten +K2V2]',
      };
      const dmgLicht = getSpellWeaponDamageBonus([enhancedLicht]);
      expect(dmgLicht.lightDamage).toBe(2);
      expect(dmgLicht.bonusText).toContain('+2 Lichtschaden');
    });
  });

  describe('equipment targeting & constraints (GRW compliance)', () => {
    it('identifies weapon targeting spells correctly and sets allowsUnarmed to false', () => {
      const flamme = isEquipmentTargetingSpell('Flammende Waffe');
      expect(flamme.targetsEquipment).toBe(true);
      expect(flamme.equipmentType).toBe('weapon');
      expect(flamme.allowsUnarmed).toBe(false);

      const befluegelt = isEquipmentTargetingSpell('Beflügelte Waffe');
      expect(befluegelt.targetsEquipment).toBe(true);
      expect(befluegelt.equipmentType).toBe('weapon');
      expect(befluegelt.allowsUnarmed).toBe(false);

      // Magische Rüstung hat die Reichweite „Zauberer“ (GRW S. 237): sie umhüllt den Körper, kein Ausrüstungsstück
      const ruestung = isEquipmentTargetingSpell('Magische Rüstung');
      expect(ruestung.targetsEquipment).toBe(false);
      expect(isEquipmentTargetingSpell({ name: 'Steinhaut', target: 'Haut, Rüstung', range: 'Zauberer' }).targetsEquipment).toBe(false);
      expect(isEquipmentTargetingSpell({ name: 'Geisterdolch', target: 'Herbeirufung, Waffe', range: 'Zauberer' }).targetsEquipment).toBe(false);

      const feuerstrahl = isEquipmentTargetingSpell('Feuerstrahl');
      expect(feuerstrahl.targetsEquipment).toBe(false);
    });

    it('isolates weapon enchantments to specific weapon via targetItemId and forbids waffenlos', () => {
      const katar = {
        id: 'w-katar',
        name: 'Katar',
        damage: '1W6+1',
        speed: 6,
        category: 'melee',
        skill: 'Handgemenge',
        attack: 4,
      };

      const langschwert = {
        id: 'w-sword',
        name: 'Langschwert',
        damage: '1W6+4',
        speed: 7,
        category: 'melee',
        skill: 'Klingenwaffen',
        attack: 6,
      };

      const waffenlos = {
        id: 'waffenlos',
        name: 'Waffenlos (Faustschlag)',
        damage: '1W6',
        speed: 5,
        category: 'melee',
        skill: 'Handgemenge',
        attack: 4,
      };

      const channeledFlammeKatar: ChanneledSpell = {
        id: 'cs-flamme-katar',
        name: 'Flammende Waffe',
        channeledFocus: 5,
        targetItemId: 'w-katar',
        targetItemName: 'Katar',
        selectedEnhancementIds: ['enh-1'],
        notes: 'Verstärkung: Die Klinge richtet 2 Punkte Feuerschaden an. [Kosten +K1V1]',
      };

      // 1. Katar gets the +2 Feuer damage
      const katarEnchantments = getWeaponEnchantments(katar, [channeledFlammeKatar]);
      expect(katarEnchantments.fireDamage).toBe(2);
      expect(katarEnchantments.extraDamageText).toBe('+2 Feuer');
      expect(katarEnchantments.damageFormulaDisplay).toBe('1W6+1 (+2 Feuer)');
      expect(katarEnchantments.damageRollFormula).toBe('1W6+3');
      expect(katarEnchantments.buttonDamageLabel).toContain('1W6+1 (+2 Feuer) Schaden');

      // 2. Langschwert does NOT receive the bonus because targetItemId does not match
      const swordEnchantments = getWeaponEnchantments(langschwert, [channeledFlammeKatar]);
      expect(swordEnchantments.fireDamage).toBe(0);
      expect(swordEnchantments.extraDamageText).toBe('');
      expect(swordEnchantments.damageRollFormula).toBe('1W6+4');

      // 3. Waffenlos NEVER receives weapon enchantments (Splittermond rule constraint)
      const waffenlosEnchantments = getWeaponEnchantments(waffenlos, [channeledFlammeKatar]);
      expect(waffenlosEnchantments.fireDamage).toBe(0);
      expect(waffenlosEnchantments.damageRollFormula).toBe('1W6');

      // 4. AttackModal getSpellWeaponDamageBonus checks
      const dmgKatar = getSpellWeaponDamageBonus([channeledFlammeKatar], 'w-katar');
      expect(dmgKatar.fireDamage).toBe(2);

      const dmgSword = getSpellWeaponDamageBonus([channeledFlammeKatar], 'w-sword');
      expect(dmgSword.fireDamage).toBe(0);

      const dmgWaffenlos = getSpellWeaponDamageBonus([channeledFlammeKatar], 'waffenlos');
      expect(dmgWaffenlos.fireDamage).toBe(0);
    });

    it('isolates attack bonuses (Beflügelte Waffe) to the targeted weapon', () => {
      const channeledBefluegelt: ChanneledSpell = {
        id: 'cs-befluegelt',
        name: 'Beflügelte Waffe',
        channeledFocus: 4,
        targetItemId: 'w-spear',
        targetItemName: 'Jagdspeer',
        notes: 'Verstärkung: Der Angriffsbonus erhöht sich auf 3 Punkte. [Kosten +K1V1]',
        selectedEnhancementIds: ['enh-1'],
      };

      // Spear gets +3 on attack rolls
      const spearBonuses = getActiveSpellRollBonuses([channeledBefluegelt], 'Stangenwaffen', true, 'w-spear');
      expect(spearBonuses.some((b) => b.source === 'Beflügelte Waffe' && b.bonus === 3)).toBe(true);

      // Sword does not get the +3 attack bonus
      const swordBonuses = getActiveSpellRollBonuses([channeledBefluegelt], 'Klingenwaffen', true, 'w-sword');
      expect(swordBonuses.some((b) => b.source === 'Beflügelte Waffe')).toBe(false);

      // Waffenlos does not get the +3 attack bonus
      const unarmedBonuses = getActiveSpellRollBonuses([channeledBefluegelt], 'Handgemenge', true, 'waffenlos');
      expect(unarmedBonuses.some((b) => b.source === 'Beflügelte Waffe')).toBe(false);
    });

    it('combines damage formulas correctly (e.g. 1W6+1 + 2 -> 1W6+3, avoiding invalid 1W6+1+2)', () => {
      expect(combineDamageFormula('1W6+1', 2)).toBe('1W6+3');
      expect(combineDamageFormula('1W6', 2)).toBe('1W6+2');
      expect(combineDamageFormula('2W6-1', 2)).toBe('2W6+1');
      expect(combineDamageFormula('1W6+2', 0)).toBe('1W6+2');
      expect(combineDamageFormula('1W6+4', 1)).toBe('1W6+5');
    });
  });
});
