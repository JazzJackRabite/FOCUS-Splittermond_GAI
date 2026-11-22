import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalculations } from '../hooks/useCalculations';
import { DEFAULT_STATE } from '../hooks/useCharacterState';
import type { CharacterState } from '../types';
import { setzeAktivenKatalog } from '../regelwerk/bruecke';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';
import { Katalog } from '../regelwerk/katalog';

// Regeln aus dem GRW-Paket (Wirkungen, Ruhewirkungen, Minderungen); ohne Paket gibt es keine Boni nach Namen mehr
beforeAll(() => { const b = basisAusDateien(); setzeAktivenKatalog(new Katalog(b.manifest, [b.basis]), false); });
afterAll(() => setzeAktivenKatalog(null, false));


describe('Derived Stats and Calculations (Splittermond GRW)', () => {
  it('calculates derived stats accurately for standard Mensch', () => {
    // Standard Mensch with AUS=2, BEW=2, INT=2, KON=3, MYS=2, STA=3, VER=2, WIL=2
    const state: CharacterState = {
      ...DEFAULT_STATE,
      race: 'Mensch',
      attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 3, MYS: 2, STA: 3, VER: 2, WIL: 2 },
      raceBonusAttrs: [],
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
    };

    const { result } = renderHook(() => useCalculations(state));
    const { derived, maxLP, maxFO, splinterPoints } = result.current;

    // GSW = BEW (2) + GK (5) = 7
    expect(derived.GSW).toBe(7);
    // INI = 10 - INT (2) = 8
    expect(derived.INI).toBe(8);
    // LP = GK (5) + KON (3) = 8
    expect(derived.LP).toBe(8);
    expect(maxLP).toBe(8);
    // FO = 2 * (MYS(2) + WIL(2)) = 8
    expect(derived.FO).toBe(8);
    expect(maxFO).toBe(8);
    // VTD = 12 + BEW(2) + STA(3) + sizeMod(0) = 17
    expect(derived.VTD).toBe(17);
    // GW = 12 + VER(2) + WIL(2) + resistBonus(0) = 16
    expect(derived.GW).toBe(16);
    // KW = 12 + KON(3) + WIL(2) + resistBonus(0) = 17
    expect(derived.KW).toBe(17);
    // Splitterpunkte = 3 + 2 (Mensch starts with Zusätzliche Splitterpunkte) or 3 without
    expect(splinterPoints).toBe(3); // base without strength
  });

  it('calculates size modifiers for all races correctly (GK 3, 4, 5, 6)', () => {
    // Gnom (GK 3) => sizeMod +4
    const gnomState: CharacterState = {
      ...DEFAULT_STATE,
      race: 'Gnom',
      attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
    };
    const { result: gnomRes } = renderHook(() => useCalculations(gnomState));
    // Gnom base mods: MYS +1, VER +1, STA -1 -> BEW=2, STA=1
    // VTD = 12 + BEW(2) + STA(1) + sizeMod(+4) = 19
    expect(gnomRes.current.derived.VTD).toBe(19);

    // Zwerg (GK 4) => sizeMod +2
    const zwergState: CharacterState = {
      ...DEFAULT_STATE,
      race: 'Zwerg',
      attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
    };
    const { result: zwergRes } = renderHook(() => useCalculations(zwergState));
    // Zwerg base mods: KON +1, WIL +1, BEW -1 -> BEW=1, STA=2
    // VTD = 12 + BEW(1) + STA(2) + sizeMod(+2) = 17
    expect(zwergRes.current.derived.VTD).toBe(17);

    // Varg (GK 6) => sizeMod -2
    const vargState: CharacterState = {
      ...DEFAULT_STATE,
      race: 'Varg',
      attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
    };
    const { result: vargRes } = renderHook(() => useCalculations(vargState));
    // Varg base mods: STA +2, WIL -1 -> BEW=2, STA=4
    // VTD = 12 + BEW(2) + STA(4) + sizeMod(-2) = 16
    expect(vargRes.current.derived.VTD).toBe(16);
    // Varg GSW = BEW(2) + GK(6) = 8
    expect(vargRes.current.derived.GSW).toBe(8);
  });

  it('calculates Heldengrad thresholds and resistance bonuses', () => {
    // HG 1: < 100 EP spent -> resistBonus 0
    // HG 2: 100-299 EP spent -> resistBonus +2
    // HG 3: 300-599 EP spent -> resistBonus +4
    // HG 4: >= 600 EP spent -> resistBonus +6
    const state: CharacterState = {
      ...DEFAULT_STATE,
      race: 'Mensch',
      attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      // Give enough skills to spend 120 EP
      skillsXp: {
        Akrobatik: 6, // 6 * 3 = 18
        Alchemie: 6,  // 18
        Athletik: 6,  // 18
        Darbietung: 6,// 18
        Diplomatie: 6,// 18
        Heilkunde: 6, // 18
        Jagdkunst: 6, // 18 => total 126 EP
      },
    };
    const { result } = renderHook(() => useCalculations(state));
    expect(result.current.xpSpent).toBe(126);
    expect(result.current.heldengrad.name).toContain('Heldengrad 2');
    // GW = 12 + VER(2) + WIL(2) + resistBonus(2) = 18
    expect(result.current.derived.GW).toBe(18);
    // KW = 12 + KON(2) + WIL(2) + resistBonus(2) = 18
    expect(result.current.derived.KW).toBe(18);
  });

  it('applies Robust and Erhöhter Fokuspool strengths to maxLP and maxFO', () => {
    const state: CharacterState = {
      ...DEFAULT_STATE,
      race: 'Mensch',
      attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      strengthsList: [
        { name: 'Robust', level: 2, source: 'creation' },
        { name: 'Erhöhter Fokuspool', level: 1, source: 'creation' },
      ],
    };
    const { result } = renderHook(() => useCalculations(state));
    // Base LP = GK(5) + KON(2) = 7. Robust level 2 adds +2 LP per health box => total 9
    expect(result.current.maxLP).toBe(9);
    // Base FO = 2 * (MYS(2) + WIL(2)) = 8. Erhöhter Fokuspool level 1 adds +5 FO => total 13
    expect(result.current.maxFO).toBe(13);
  });

  it('calculates free mastery slots based on skill thresholds (FW 6, 9, 12, 15)', () => {
    const state: CharacterState = {
      ...DEFAULT_STATE,
      skillsBase: { Akrobatik: 6, Athletik: 9, Handgemenge: 12 },
      masteries: {
        Akrobatik: [{ id: '1', name: 'M1', tier: 1, cost: 0, isFree: true, isCreationBonus: false, source: 'GRW' }],
      },
    };
    const { result } = renderHook(() => useCalculations(state));
    // Akrobatik has FW 6 (1 earned) - 1 used = 0 remaining
    expect(result.current.getFreeSlotsForSkill('Akrobatik')).toBe(0);
    // Athletik has FW 9 (2 earned) - 0 used = 2 remaining
    expect(result.current.getFreeSlotsForSkill('Athletik')).toBe(2);
    // Handgemenge has FW 12 (3 earned) - 0 used = 3 remaining
    expect(result.current.getFreeSlotsForSkill('Handgemenge')).toBe(3);
  });

  it('calculates free spell slots according to magic school ranks (FW 1, 3, 6, 9, 12, 15)', () => {
    const state: CharacterState = {
      ...DEFAULT_STATE,
      skillsBase: { Feuermagie: 6 }, // FW 6 => earned slots for Grade 0, Grade 1, Grade 2
      spellsList: [
        { name: 'Feuerstrahl', school: 'Feuermagie', grade: 1, cost: 0, isFree: true },
      ],
    };
    const { result } = renderHook(() => useCalculations(state));
    // Feuermagie had slots [0, 1, 2], Grade 1 used a slot (slot 1 or 2). Remaining 2 free slots
    const feuermagieSlots = result.current.detailedFreeSpellSlots['Feuermagie'];
    expect(feuermagieSlots.length).toBe(2);
  });
});
