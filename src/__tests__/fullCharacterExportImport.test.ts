import { describe, it, expect } from 'vitest';
import { validateCharacterImport } from '../utils/importValidation';
import { referenceCharacterResources } from '../utils/gameResourceManager';
import { calculateCharacter } from '../utils/characterCalculations';
import { useCharacterState, DEFAULT_STATE } from '../hooks/useCharacterState';
import { renderHook, act } from '@testing-library/react';
import type { CharacterState, InventoryItem } from '../types';

describe('Vollständiger Export & Import aller Charakterwerte', () => {
  it('speichert und lädt alle Werte verlustfrei (Attribute, Fertigkeiten, Zauber, Meisterschaften, Inventar, Geld, etc.)', () => {
    const testWeapon: InventoryItem = {
      id: 'w-101',
      name: 'Mondsilber-Klinge',
      type: 'weapon',
      category: 'Nahkampf',
      quantity: 1,
      weight: 2,
      price: '25 L',
      desc: 'Geweihte Klinge der Mondpriester',
      equipped: true,
      source: 'Mondstahlklingen',
      page: 38,
      weaponSkill: 'Klingenwaffen',
      damage: '1W6+4',
      wgs: 6,
      range: '1m',
      attributes: 'Scharf 2, Parierwaffe 1',
    };

    const testArmor: InventoryItem = {
      id: 'a-202',
      name: 'Schuppenpanzer',
      type: 'armor',
      category: 'Rüstung',
      quantity: 1,
      weight: 5,
      price: '40 L',
      desc: 'Bronzene Schuppen auf Leder',
      equipped: true,
      source: 'GRW',
      page: 188,
      sr: 3,
      vtdBonus: 0,
      handicap: 2,
      tickModifier: 1,
      minStrength: 3,
      attributes: 'Behindernd 2',
    };

    const testGear: InventoryItem = {
      id: 'g-303',
      name: 'Alchemistenfeuer',
      type: 'alchemika',
      category: 'Alchemika',
      quantity: 3,
      weight: 1,
      price: '5 L',
      desc: 'Brennt auch auf Wasser',
      equipped: false,
      source: 'GRW',
      page: 191,
    };

    const fullChar: CharacterState = {
      mode: 'play',
      xpTotal: 220,
      name: 'Taran Eisbrecher',
      race: 'Zwerg',
      moonSign: 'Der Schild',
      homeRegion: 'Gischtlande',
      attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 4, MYS: 1, STA: 4, VER: 2, WIL: 3 },
      raceBonusAttrs: ['KON', 'STA'],
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 1, MYS: 0, STA: 1, VER: 0, WIL: 0 },
      skillsBase: {
        Athletik: 6,
        Zähigkeit: 7,
        Klingenwaffen: 8,
        Handgemenge: 5,
        Felsmagie: 4,
      },
      skillsXp: {
        Zähigkeit: 2,
        Klingenwaffen: 4,
        Felsmagie: 2,
      },
      masteries: {
        Klingenwaffen: [
          {
            id: 'm1',
            name: 'Wuchtschlag (S1)',
            tier: 1,
            cost: 0,
            isFree: true,
            isCreationBonus: true,
            source: 'GRW',
            page: 104,
            desc: '+2 Schaden für +3 Ticks',
            skill: 'Klingenwaffen',
            userNote: 'Lieblingsmanöver gegen Rüstungen',
          },
        ],
      },
      strengthsList: [
        { name: 'Robust', level: 1, source: 'creation', pointCost: 1, isFree: true, isRacial: true, sourceRef: 'GRW', page: 81 },
        { name: 'Zäher Hund', level: 1, source: 'creation', pointCost: 2, isFree: false, sourceRef: 'GRW', page: 82 },
      ],
      resourcesList: [
        { name: 'Stand', level: 2, source: 'creation', pointCost: 1, sourceRef: 'GRW', page: 85 },
      ],
      weaknessesList: [
        { name: 'Jähzorn', level: 1, source: 'creation', desc: 'Wird schnell wütend', sourceRef: 'GRW', page: 84 },
      ],
      languagesList: [
        { name: 'Zwergisch', level: 1, source: 'creation', isFree: true, sourceRef: 'GRW', page: 83 },
        { name: 'Gischtisch', level: 1, source: 'creation', isFree: true, sourceRef: 'GRW', page: 83 },
      ],
      spellsList: [
        {
          name: 'Felsenhaut',
          school: 'Felsmagie',
          grade: 1,
          cost: 'K4',
          castTime: '3 Ticks',
          range: 'Berührung',
          duration: 'kanalisiert',
          target: '1 Wesen',
          description: 'Gewährt +2 SR.',
          source: 'GRW',
          page: 145,
          isFree: false,
          xpCost: 15,
        },
      ],
      playState: {
        healthSlots: [
          { type: 'empty' },
          { type: 'empty' },
          { type: 'exhausted' },
          { type: 'consumed' },
        ],
        focus: { exhausted: 4, channeled: 4, consumed: 2 },
        splitterPoints: 4,
        channeledSpells: [
          {
            id: 'cs-1',
            name: 'Felsenhaut',
            channeledFocus: 4,
            school: 'Felsmagie',
            grade: 1,
            activeTicks: 12,
          },
        ],
        dyingLevel: 0,
        conditions: [
          { id: 'cond-1', key: 'Verkrüppelt', level: 1, note: 'Rechter Fuß' },
        ],
        tempHP: 5,
        tempHPUsed: 2,
        lpModifier: 0,
      },
      inventory: [testWeapon, testArmor, testGear],
      money: {
        solare: 3,
        lunare: 18,
        telare: 75,
      },
      ignoreEncumbrance: false,
      creationFinalized: true,
      advancementLog: [
        {
          id: 'log-1',
          timestamp: '2026-10-01T12:00:00Z',
          category: 'xp',
          title: '+100 EP für die Zwergenbinge',
          xpDelta: 100,
        },
        {
          id: 'log-2',
          timestamp: '2026-10-02T15:00:00Z',
          category: 'skill',
          title: 'Klingenwaffen gesteigert auf 12',
          xpDelta: -25,
        },
      ],
    };

    // Calculate baseline derived values
    const originalCalc = calculateCharacter(fullChar);

    // ── 1. EXPORT-SIMULATION: Serialisierung zu JSON ──
    const jsonString = JSON.stringify(fullChar, null, 2);
    expect(jsonString).toContain('"Taran Eisbrecher"');
    expect(jsonString).toContain('"Mondsilber-Klinge"');
    expect(jsonString).toContain('"Schuppenpanzer"');
    expect(jsonString).toContain('"Alchemistenfeuer"');
    expect(jsonString).toContain('"solare": 3');
    expect(jsonString).toContain('"lunare": 18');
    expect(jsonString).toContain('"telare": 75');

    // ── 2. IMPORT-SIMULATION: Parsen & Validieren ──
    const parsedRaw = JSON.parse(jsonString);
    const validated = validateCharacterImport(parsedRaw);
    const referenced = referenceCharacterResources(validated);

    // ── 3. PRÜFUNG ALLER CHARAKTERWERTE NACH IMPORT ──
    // Basisdaten
    expect(referenced.name).toBe('Taran Eisbrecher');
    expect(referenced.race).toBe('Zwerg');
    expect(referenced.moonSign).toBe('Der Schild');
    expect(referenced.homeRegion).toBe('Gischtlande');
    expect(referenced.mode).toBe('play');
    expect(referenced.xpTotal).toBe(220);
    expect(referenced.creationFinalized).toBe(true);

    // Attribute
    expect(referenced.attrBase.KON).toBe(4);
    expect(referenced.attrBase.STA).toBe(4);
    expect(referenced.attrIncrements.KON).toBe(1);
    expect(referenced.attrIncrements.STA).toBe(1);
    expect(referenced.raceBonusAttrs).toEqual(['KON', 'STA']);

    // Fertigkeiten
    expect(referenced.skillsBase.Klingenwaffen).toBe(8);
    expect(referenced.skillsXp.Klingenwaffen).toBe(4);
    expect(referenced.skillsBase.Zähigkeit).toBe(7);

    // Meisterschaften
    expect(referenced.masteries.Klingenwaffen).toHaveLength(1);
    expect(referenced.masteries.Klingenwaffen[0].name).toBe('Wuchtschlag (S1)');
    expect(referenced.masteries.Klingenwaffen[0].userNote).toBe('Lieblingsmanöver gegen Rüstungen');

    // Stärken, Schwächen, Ressourcen, Sprachen
    expect(referenced.strengthsList).toHaveLength(2);
    expect(referenced.strengthsList[0].name).toBe('Robust');
    expect(referenced.resourcesList[0].name).toBe('Stand');
    expect(referenced.weaknessesList[0].name).toBe('Jähzorn');
    expect(referenced.languagesList).toHaveLength(2);

    // Zauber
    expect(referenced.spellsList).toHaveLength(1);
    expect(referenced.spellsList[0].name).toBe('Felsenhaut');

    // Vitals & PlayState
    expect(referenced.playState.splitterPoints).toBe(4);
    expect(referenced.playState.focus).toEqual({ exhausted: 4, channeled: 4, consumed: 2 });
    expect(referenced.playState.channeledSpells).toHaveLength(1);
    expect(referenced.playState.channeledSpells[0].name).toBe('Felsenhaut');
    expect(referenced.playState.conditions).toHaveLength(1);
    expect(referenced.playState.conditions[0].key).toBe('Verkrüppelt');
    expect(referenced.playState.tempHP).toBe(5);
    expect(referenced.playState.tempHPUsed).toBe(2);

    // INVENTAR & AUSRÜSTUNG (Kernprüfung)
    expect(referenced.inventory).toBeDefined();
    expect(referenced.inventory).toHaveLength(3);

    const importedWeapon = referenced.inventory?.find((i) => i.id === 'w-101');
    expect(importedWeapon).toBeDefined();
    expect(importedWeapon?.name).toBe('Mondsilber-Klinge');
    expect(importedWeapon?.type).toBe('weapon');
    expect(importedWeapon?.damage).toBe('1W6+4');
    expect(importedWeapon?.wgs).toBe(6);
    expect(importedWeapon?.source).toBe('Mondstahlklingen');
    expect(importedWeapon?.page).toBe(38);
    expect(importedWeapon?.equipped).toBe(true);
    expect(importedWeapon?.attributes).toBe('Scharf 2, Parierwaffe 1');

    const importedArmor = referenced.inventory?.find((i) => i.id === 'a-202');
    expect(importedArmor).toBeDefined();
    expect(importedArmor?.name).toBe('Schuppenpanzer');
    expect(importedArmor?.type).toBe('armor');
    expect(importedArmor?.sr).toBe(3);
    expect(importedArmor?.handicap).toBe(2);
    expect(importedArmor?.tickModifier).toBe(1);
    expect(importedArmor?.source).toBe('GRW');
    expect(importedArmor?.page).toBe(188);
    expect(importedArmor?.equipped).toBe(true);

    const importedGear = referenced.inventory?.find((i) => i.id === 'g-303');
    expect(importedGear).toBeDefined();
    expect(importedGear?.name).toBe('Alchemistenfeuer');
    expect(importedGear?.quantity).toBe(3);
    expect(importedGear?.weight).toBe(1);

    // GELD
    expect(referenced.money).toEqual({
      solare: 3,
      lunare: 18,
      telare: 75,
    });

    // TRAGLAST-REGEL
    expect(referenced.ignoreEncumbrance).toBe(false);

    // ADVANCEMENT LOG
    expect(referenced.advancementLog).toBeDefined();
    expect(referenced.advancementLog?.some((l) => l.title === '+100 EP für die Zwergenbinge')).toBe(true);

    // ── 4. BERECHNUNGSPRÜFUNG: Werte stimmen nach Import 1:1 überein ──
    const importedCalc = calculateCharacter(referenced);
    expect(importedCalc.loadCapacity).toBe(originalCalc.loadCapacity);
    expect(importedCalc.totalLoad).toBe(originalCalc.totalLoad);
    expect(importedCalc.armorSR).toBe(originalCalc.armorSR);
    expect(importedCalc.derived.SR).toBe(originalCalc.derived.SR);
    expect(importedCalc.derived.VTD).toBe(originalCalc.derived.VTD);
    expect(importedCalc.gearHandicap).toBe(originalCalc.gearHandicap);
  });

  it('übernimmt geladenen Zustand im State Hook via LOAD_STATE Action', () => {
    const { result } = renderHook(() => useCharacterState());

    const importedCharacterData: Partial<CharacterState> = {
      name: 'Elena Windläuferin',
      race: 'Mensch',
      inventory: [
        {
          id: 'item-x',
          name: 'Kurzbogen',
          type: 'weapon',
          quantity: 1,
          damage: '1W6+2',
          wgs: 6,
          range: '25m',
          source: 'GRW',
          page: 185,
          equipped: true,
        },
      ],
      money: { solare: 1, lunare: 50, telare: 20 },
      ignoreEncumbrance: true,
    };

    act(() => {
      result.current.dispatch({
        type: 'LOAD_STATE',
        payload: importedCharacterData,
      });
    });

    expect(result.current.state.name).toBe('Elena Windläuferin');
    expect(result.current.state.inventory).toHaveLength(1);
    expect(result.current.state.inventory?.[0].name).toBe('Kurzbogen');
    expect(result.current.state.inventory?.[0].source).toBe('GRW');
    expect(result.current.state.inventory?.[0].page).toBe(185);
    expect(result.current.state.money).toEqual({ solare: 1, lunare: 50, telare: 20 });
    expect(result.current.state.ignoreEncumbrance).toBe(true);
  });

  it('erkennt deutsche Feldnamen & Aliase beim JSON-Import verlustfrei (inventar, geld, last, waffe, etc.)', () => {
    const rawGermanExport = {
      name: 'Koradin von Falkenstein',
      race: 'Mensch',
      attrBase: { AUS: 3, BEW: 3, INT: 2, KON: 3, MYS: 1, STA: 3, VER: 2, WIL: 3 },
      mode: 'play',
      inventar: [
        {
          id: 'w-1',
          bezeichnung: 'Langschwert',
          type: 'waffe',
          anzahl: '2',
          last: '2',
          preis: '35 L',
          ausgerüstet: true,
          quelle: 'GRW',
          seite: '185',
          fertigkeit: 'Klingenwaffen',
          schaden: '1W6+5',
          geschwindigkeit: '7',
          eigenschaften: 'Scharf 1',
        },
        {
          id: 'a-1',
          title: 'Kettenhemd',
          type: 'rüstung',
          anzahl: 1,
          last: 4,
          ausgerüstet: true,
          quelle: 'Mondstahlklingen',
          seite: 42,
          rs: 3,
          behinderung: 2,
          tickMalus: 1,
          mindeststaerke: 3,
        },
        {
          id: 's-1',
          name: 'Holzschild',
          type: 'schild',
          last: '2',
          verteidigung: 1,
          ausgerüstet: false,
          quelle: 'GRW',
        },
        {
          id: 'g-1',
          label: 'Fackel (5x)',
          type: 'ausrüstung',
          anzahl: 5,
          last: 1,
          preis: '5 T',
          quelle: 'GRW',
        },
        {
          id: 'alc-1',
          name: 'Heilbalsam',
          type: 'alchemie',
          anzahl: 2,
          last: 0,
          preis: '10 L',
        },
      ],
      geld: {
        gold: '4',
        silber: '12',
        kupfer: '95',
      },
    };

    const validated = validateCharacterImport(rawGermanExport);
    expect(validated.name).toBe('Koradin von Falkenstein');
    expect(validated.creationFinalized).toBe(true);

    // Inventar geprüft
    expect(validated.inventory).toBeDefined();
    expect(validated.inventory).toHaveLength(5);

    const sword = validated.inventory?.find((i) => i.name === 'Langschwert');
    expect(sword).toBeDefined();
    expect(sword?.type).toBe('weapon');
    expect(sword?.quantity).toBe(2);
    expect(sword?.weight).toBe(2);
    expect(sword?.price).toBe('35 L');
    expect(sword?.equipped).toBe(true);
    expect(sword?.source).toBe('GRW');
    expect(sword?.page).toBe(185);
    expect(sword?.weaponSkill).toBe('Klingenwaffen');
    expect(sword?.damage).toBe('1W6+5');
    expect(sword?.wgs).toBe('7');
    expect(sword?.attributes).toBe('Scharf 1');

    const armor = validated.inventory?.find((i) => i.name === 'Kettenhemd');
    expect(armor).toBeDefined();
    expect(armor?.type).toBe('armor');
    expect(armor?.sr).toBe(3);
    expect(armor?.handicap).toBe(2);
    expect(armor?.tickModifier).toBe(1);
    expect(armor?.minStrength).toBe(3);

    const shield = validated.inventory?.find((i) => i.name === 'Holzschild');
    expect(shield).toBeDefined();
    expect(shield?.type).toBe('shield');
    expect(shield?.vtdBonus).toBe(1);

    const torch = validated.inventory?.find((i) => i.name === 'Fackel (5x)');
    expect(torch).toBeDefined();
    expect(torch?.type).toBe('gear');
    expect(torch?.quantity).toBe(5);

    const balm = validated.inventory?.find((i) => i.name === 'Heilbalsam');
    expect(balm).toBeDefined();
    expect(balm?.type).toBe('alchemika');
    expect(balm?.quantity).toBe(2);

    // Geld geprüft
    expect(validated.money).toEqual({
      solare: 4,
      lunare: 12,
      telare: 95,
    });
  });

  it('lädt auch leeres oder modifiziertes Inventar ohne Seiteneffekte', () => {
    const rawNoInv = {
      name: 'Mönch ohne Besitz',
      race: 'Mensch',
      attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      inventory: [],
      money: { solare: 0, lunare: 0, telare: 0 },
    };

    const validated = validateCharacterImport(rawNoInv);
    expect(validated.inventory).toEqual([]);
    expect(validated.money).toEqual({ solare: 0, lunare: 0, telare: 0 });
  });
});
