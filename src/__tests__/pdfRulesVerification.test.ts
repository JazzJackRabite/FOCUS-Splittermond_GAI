import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalculations } from '../hooks/useCalculations';
import { useCharacterState, DEFAULT_STATE } from '../hooks/useCharacterState';
import {
  calculateSpellEG,
  parseFocusCost,
  calculateTotalEGSpent,
  calculateFinalSpellCosts,
  INITIAL_EG_ALLOCATIONS,
} from '../utils/magicRules';
import { getConditionMalus, getActiveRollModifiers } from '../utils/conditionModifiers';
import { calculateItemCost, getSkillXpCost, getAttrXpCost } from '../utils/costCalculations';
import type { CharacterState, StatusCondition } from '../types';
import { setzeAktivenKatalog } from '../regelwerk/bruecke';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';
import { Katalog } from '../regelwerk/katalog';

// Regeln aus dem GRW-Paket (Wirkungen, Ruhewirkungen, Minderungen); ohne Paket gibt es keine Boni nach Namen mehr
beforeAll(() => { const b = basisAusDateien(); setzeAktivenKatalog(new Katalog(b.manifest, [b.basis]), false); });
afterAll(() => setzeAktivenKatalog(null, false));


describe('Splittermond GRW (2. erratierte Neuauflage) - Regelverifikation anhand PDF', () => {
  // =========================================================================
  // 1. ATTRIBUTE & ABGELEITETE WERTE (PDF S. 11-16, S. 321-323, Anhang 4 S. 343)
  // =========================================================================
  describe('1. Abgeleitete Werte nach Formeln im Regelwerk', () => {
    it('berechnet GSW = BEW + GK für alle spielbaren Rassen korrekt (PDF S. 13, 15, 32-37)', () => {
      // Mensch: GK 5 (S. 35)
      const menschState: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      };
      const { result: rMensch } = renderHook(() => useCalculations(menschState));
      expect(rMensch.current.derived.GSW).toBe(8); // BEW 3 + GK 5 = 8

      // Alb: GK 5 (S. 33)
      const albState: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Alb',
        attrBase: { AUS: 2, BEW: 4, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      };
      const { result: rAlb } = renderHook(() => useCalculations(albState));
      expect(rAlb.current.derived.GSW).toBe(10); // BEW (4+1 Rasse) + GK 5 = 10

      // Gnom: GK 3 (S. 34)
      const gnomState: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Gnom',
        attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      };
      const { result: rGnom } = renderHook(() => useCalculations(gnomState));
      expect(rGnom.current.derived.GSW).toBe(5); // BEW 2 + GK 3 = 5

      // Zwerg: GK 4 (S. 37)
      const zwergState: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Zwerg',
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      };
      const { result: rZwerg } = renderHook(() => useCalculations(zwergState));
      expect(rZwerg.current.derived.GSW).toBe(6); // BEW (3-1 Rasse) + GK 4 = 6

      // Varg: GK 6 (S. 36)
      const vargState: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Varg',
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      };
      const { result: rVarg } = renderHook(() => useCalculations(vargState));
      expect(rVarg.current.derived.GSW).toBe(9); // BEW 3 + GK 6 = 9
    });

    it('berechnet INI = 10 - INT, LP = GK + KON, FO = 2 * (MYS + WIL) (PDF S. 13-15)', () => {
      const state: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 2, INT: 4, KON: 3, MYS: 3, STA: 2, VER: 2, WIL: 4 },
      };
      const { result } = renderHook(() => useCalculations(state));
      // INI = 10 - INT (4) = 6
      expect(result.current.derived.INI).toBe(6);
      // LP = GK (5) + KON (3) = 8
      expect(result.current.derived.LP).toBe(8);
      expect(result.current.maxLP).toBe(8);
      // FO = (MYS 3 + WIL 4) * 2 = 14
      expect(result.current.derived.FO).toBe(14);
      expect(result.current.maxFO).toBe(14);
    });

    it('berechnet VTD mit Größenklasse-Modifikatoren (PDF S. 13 Tabelle)', () => {
      // Formel: 12 + BEW + STA + Modifikator nach GK
      // GK 3 (Gnom): +4
      // GK 4 (Zwerg): +2
      // GK 5 (Mensch/Alb): ±0
      // GK 6 (Varg): -2
      const gnom: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Gnom',
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
      };
      const { result: rGnom } = renderHook(() => useCalculations(gnom));
      // BEW = 3, STA = 2-1 = 1. VTD = 12 + 3 + 1 + 4 = 20
      expect(rGnom.current.derived.VTD).toBe(20);

      const zwerg: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Zwerg',
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 3, VER: 2, WIL: 2 },
      };
      const { result: rZwerg } = renderHook(() => useCalculations(zwerg));
      // BEW = 3-1 = 2, STA = 3. VTD = 12 + 2 + 3 + 2 = 19
      expect(rZwerg.current.derived.VTD).toBe(19);

      const varg: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Varg',
        attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 2, MYS: 2, STA: 3, VER: 2, WIL: 2 },
      };
      const { result: rVarg } = renderHook(() => useCalculations(varg));
      // BEW = 3, STA = 3+2 = 5. VTD = 12 + 3 + 5 - 2 = 18
      expect(rVarg.current.derived.VTD).toBe(18);
    });

    it('berechnet GW = 12 + VER + WIL und KW = 12 + KON + WIL (PDF S. 15)', () => {
      const state: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 4, MYS: 2, STA: 2, VER: 3, WIL: 3 },
      };
      const { result } = renderHook(() => useCalculations(state));
      // GW = 12 + VER(3) + WIL(3) = 18
      expect(result.current.derived.GW).toBe(18);
      // KW = 12 + KON(4) + WIL(3) = 19
      expect(result.current.derived.KW).toBe(19);
    });

    it('berücksichtigt Stärken Robust (+1 LP/Stufe) und Erhöhter Fokuspool (+5 FO) (PDF S. 72-73)', () => {
      const state: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
        strengthsList: [
          { name: 'Robust', level: 3, source: 'creation' },
          { name: 'Erhöhter Fokuspool', level: 2, source: 'creation' },
        ],
      };
      const { result } = renderHook(() => useCalculations(state));
      // Base LP = 5 + 2 = 7; Robust Stufe 3 => +3 LP
      expect(result.current.maxLP).toBe(10);
      // Base FO = 2 * (2 + 2) = 8; Erhöhter Fokuspool Stufe 2 => +10 FO
      expect(result.current.maxFO).toBe(18);
    });
  });

  // =========================================================================
  // 2. HELDENGRADE & STEIGERUNGSKOSTEN (PDF S. 25, S. 87-89)
  // =========================================================================
  describe('2. Heldengrade und Steigerungskosten', () => {
    it('erhöht Widerstandswerte um +2 je Heldengrad ab Wanderer (PDF S. 89)', () => {
      // 100 EP = Heldengrad 2 (Wanderer) -> +2 Widerstände
      const stateHG2: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 },
        skillsXp: {
          Akrobatik: 6, // 18 EP
          Alchemie: 6,  // 18 EP
          Athletik: 6,  // 18 EP
          Darbietung: 6,// 18 EP
          Diplomatie: 6,// 18 EP
          Heilkunde: 6, // 18 EP -> 108 EP total
        },
      };
      const { result: rHG2 } = renderHook(() => useCalculations(stateHG2));
      expect(rHG2.current.heldengrad.name).toContain('Wanderer');
      expect(rHG2.current.heldengrad.resistBonus).toBe(2);
      // GW: 12 + 2 + 2 + 2 (HG2) = 18
      expect(rHG2.current.derived.GW).toBe(18);
      // KW: 12 + 2 + 2 + 2 (HG2) = 18
      expect(rHG2.current.derived.KW).toBe(18);
    });

    it('berechnet Steigerungskosten gemäß Buchbeispiel (PDF S. 87: Fertigkeit 5 auf 7 kostet 8 EP)', () => {
      // Buchbeispiel S. 87:
      // "Ein Abenteurer des Heldengrades Wanderer will eine Fertigkeit von 5 auf 7 steigern.
      // Hierzu muss er 8 Erfahrungspunkte aufwenden: 3 (von 5 auf 6) + 5 (von 6 auf 7).
      // Weiterhin will er sich einen Zauber des 2. Grades kaufen: 6 EP. Insgesamt 14 EP."
      const costSkill5to6 = calculateItemCost('skill', 6);
      const costSkill6to7 = calculateItemCost('skill', 7);
      expect(costSkill5to6).toBe(3);
      expect(costSkill6to7).toBe(5);
      expect(costSkill5to6 + costSkill6to7).toBe(8);

      const costSpellGrad2 = calculateItemCost('spell', 2);
      expect(costSpellGrad2).toBe(6);

      const totalXp = (costSkill5to6 + costSkill6to7) + costSpellGrad2;
      expect(totalXp).toBe(14);
    });

    it('prüft offizielle EP-Kosten aller Eigenschaften (PDF S. 25 & 87)', () => {
      // Attribute: 1.=10, 2.=15, 3.=20, 4.=25
      expect(calculateItemCost('attribute', 1)).toBe(10);
      expect(calculateItemCost('attribute', 2)).toBe(15);
      expect(calculateItemCost('attribute', 3)).toBe(20);
      expect(calculateItemCost('attribute', 4)).toBe(25);

      // Meisterschaften: Schwelle 1=5, 2=10, 3=15, 4=20
      expect(calculateItemCost('mastery', 1)).toBe(5);
      expect(calculateItemCost('mastery', 2)).toBe(10);
      expect(calculateItemCost('mastery', 3)).toBe(15);
      expect(calculateItemCost('mastery', 4)).toBe(20);

      // Stärken: Stufe 1=7, Stufe 2=14
      expect(calculateItemCost('strength', 1)).toBe(7);
      expect(calculateItemCost('strength', 2)).toBe(14);

      // Sprachen: 5 EP
      expect(calculateItemCost('language', 1)).toBe(5);

      // Ressourcen: 7 EP
      expect(calculateItemCost('resource', 1)).toBe(7);

      // Zauber: Grad 0=1, 1=3, 2=6, 3=9, 4=12, 5=15
      expect(calculateItemCost('spell', 0)).toBe(1);
      expect(calculateItemCost('spell', 1)).toBe(3);
      expect(calculateItemCost('spell', 2)).toBe(6);
      expect(calculateItemCost('spell', 3)).toBe(9);
      expect(calculateItemCost('spell', 4)).toBe(12);
      expect(calculateItemCost('spell', 5)).toBe(15);
    });
  });

  // =========================================================================
  // 3. PROBEN, ERFOLGSGRADE, PATZER & TRIUMPH (PDF S. 16-20, S. 198, Anhang 4 S. 343)
  // =========================================================================
  describe('3. Proben- und Erfolgsgradberechnung nach Tabelle S. 17 & 343', () => {
    it('berechnet Erfolgsgrade bei gelungenen Proben (Diff 0-2 = 0 EG, je 3 Punkte darüber +1 EG)', () => {
      // Diff 0 -> 0 EG (Knapp gelungen)
      expect(calculateSpellEG(15, 15).eg).toBe(0);
      expect(calculateSpellEG(15, 15).isSuccess).toBe(true);

      // Diff 2 -> 0 EG
      expect(calculateSpellEG(17, 15).eg).toBe(0);
      expect(calculateSpellEG(17, 15).isSuccess).toBe(true);

      // Diff 3 -> 1 EG (Gelungen)
      expect(calculateSpellEG(18, 15).eg).toBe(1);

      // Diff 6 -> 2 EG
      expect(calculateSpellEG(21, 15).eg).toBe(2);

      // Diff 9 -> 3 EG
      expect(calculateSpellEG(24, 15).eg).toBe(3);

      // Diff 15 -> 5 EG (Herausragend gelungen)
      expect(calculateSpellEG(30, 15).eg).toBe(5);
    });

    it('erkennt "Knapp misslungen" (Diff -1 bis -2): 0 EG und 0 Fokusverlust (PDF S. 17 & 198)', () => {
      // PDF S. 17 & 198: "Bei Kampf und Zauberei müssen trotz Fehlschlag keine negativen Auswirkungen in Kauf genommen werden."
      const calcMinus1 = calculateSpellEG(14, 15);
      expect(calcMinus1.isSuccess).toBe(false);
      expect(calcMinus1.differenz).toBe(-1);
      expect(calcMinus1.negativeEG).toBe(0);
      expect(calcMinus1.exhaustedFocusLostOnFailure).toBe(0);

      const calcMinus2 = calculateSpellEG(13, 15);
      expect(calcMinus2.isSuccess).toBe(false);
      expect(calcMinus2.differenz).toBe(-2);
      expect(calcMinus2.negativeEG).toBe(0);
      expect(calcMinus2.exhaustedFocusLostOnFailure).toBe(0);
    });

    it('berechnet negative Erfolgsgrade bei Misserfolg (Diff <= -3) (PDF S. 17 & 343)', () => {
      // Diff -3 bis -5: -1 EG (1 negativer EG -> 1 Fokus erschöpft)
      const calcMinus3 = calculateSpellEG(12, 15);
      expect(calcMinus3.isSuccess).toBe(false);
      expect(calcMinus3.differenz).toBe(-3);
      expect(calcMinus3.negativeEG).toBe(1);
      expect(calcMinus3.exhaustedFocusLostOnFailure).toBe(1);

      // Diff -6 bis -8: -2 EG
      const calcMinus6 = calculateSpellEG(9, 15);
      expect(calcMinus6.negativeEG).toBe(2);
      expect(calcMinus6.exhaustedFocusLostOnFailure).toBe(2);

      // Diff -15: -5 EG (Verheerend misslungen)
      const calcMinus15 = calculateSpellEG(0, 15);
      expect(calcMinus15.negativeEG).toBe(5);
      expect(calcMinus15.exhaustedFocusLostOnFailure).toBe(5);
    });

    it('behandelt Patzer (S. 18): Probe immer misslungen, -3 EG Abzug, max -1 EG', () => {
      // Patzer trotz mathematischem Übertreffen der Schwierigkeit
      const fumbleOnSuccess = calculateSpellEG(25, 15, true, false);
      expect(fumbleOnSuccess.isSuccess).toBe(false);
      expect(fumbleOnSuccess.isFumble).toBe(true);
      expect(fumbleOnSuccess.negativeEG).toBeGreaterThanOrEqual(1);

      // Patzer bei Misserfolg (z. B. Diff -6 mit Patzer -> 2 + 3 = 5 negative EG)
      const fumbleOnFail = calculateSpellEG(12, 18, true, false);
      expect(fumbleOnFail.isSuccess).toBe(false);
      expect(fumbleOnFail.isFumble).toBe(true);
      expect(fumbleOnFail.negativeEG).toBe(5);
    });

    it('behandelt Triumph (S. 18, 343): +3 EG bei Gelingen', () => {
      // Diff 6 -> 2 EG + 3 (Triumph) = 5 EG
      const critCalc = calculateSpellEG(21, 15, false, true);
      expect(critCalc.isSuccess).toBe(true);
      expect(critCalc.eg).toBe(5);
    });
  });

  // =========================================================================
  // 4. SCHADEN & WUNDABZÜGE (PDF S. 14, S. 172-173, Anhang 4 S. 343)
  // =========================================================================
  describe('4. Schaden, Wundstufen und Wundabzüge', () => {
    it('berechnet Wundabzüge AUSSCHLIESSLICH aus echtem Schaden (PDF S. 14 & S. 173 Arrou-Beispiel)', () => {
      // Aus dem Regelwerk S. 173:
      // "Arrou (8 Lebenspunkte) hat durch eine Kneipenschlägerei bereits 7 Punkte Betäubungsschaden erlitten,
      // ist also noch unverletzt. Plötzlich rammt ihm sein Gegenüber einen Dolch zwischen die Rippen,
      // womit er 4 Punkte Schaden anrichtet. Damit hat Arrou insgesamt 11 Lebenspunkte verloren,
      // zählt aber noch nicht als angeschlagen – denn Wundabzüge berechnen sich einzig anhand des echten Schadens."
      const { result } = renderHook(() => useCharacterState());
      act(() => {
        result.current.dispatch({
          type: 'PLAY_RESET',
          payload: { maxLP: 8, maxFocus: 16, maxSplitter: 3 },
        });
      });

      // 7 Betäubungsschaden (exhausted)
      act(() => {
        result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'exhausted', maxLP: 8, amount: 7 } });
      });
      // 4 echter Schaden (consumed)
      act(() => {
        result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 4 } });
      });

      // Total lost slots: 11 (slots.filter !== 'empty')
      expect(result.current.state.playState.healthSlots.filter((s) => s.type !== 'empty')).toHaveLength(11);
      // But consumed slots = 4, which is <= maxLP (8)
      expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(4);

      // Calculation Hook check:
      const { result: rCalc } = renderHook(() => useCalculations(result.current.state));
      // Arrou is still "Unverletzt" regarding true wounds, wound penalty = 0!
      expect(rCalc.current.currentWoundPenalty).toBe(0);
      expect(rCalc.current.currentHealthLevelName).toBe('Unverletzt');

      // Now add 5 more true damage (total consumed = 9 > 8)
      act(() => {
        result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 5 } });
      });

      const { result: rCalcAfter } = renderHook(() => useCalculations(result.current.state));
      // Now he enters Angeschlagen (-1 wound penalty)
      expect(rCalcAfter.current.currentWoundPenalty).toBe(-1);
      expect(rCalcAfter.current.currentHealthLevelName).toBe('Angeschlagen');
    });

    it('erhöht Wundstufe durch Zustand Verwundet (PDF S. 169)', () => {
      // Character has 0 consumed damage (Unverletzt), but has Verwundet 1 -> counts as Angeschlagen (-1)
      const state: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 3, MYS: 2, STA: 2, VER: 2, WIL: 2 },
        playState: {
          ...DEFAULT_STATE.playState,
          healthSlots: Array.from({ length: 48 }, () => ({ type: 'empty' })),
          conditions: [{ id: 'c1', key: 'Verwundet', level: 1 }],
        },
      };

      const { result } = renderHook(() => useCalculations(state));
      expect(result.current.currentWoundPenalty).toBe(-1);
      expect(result.current.currentHealthLevelName).toBe('Angeschlagen');
    });

    it('reduziert Wundabzüge durch Stärke Schmerzresistenz (PDF S. 73) und Schmerzwiderstand (PDF S. 137)', () => {
      const state: CharacterState = {
        ...DEFAULT_STATE,
        race: 'Mensch',
        attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 3, MYS: 2, STA: 2, VER: 2, WIL: 2 },
        strengthsList: [{ name: 'Schmerzresistenz', level: 1, source: 'creation' }],
        playState: {
          ...DEFAULT_STATE.playState,
          // 10 consumed damage with maxLP=8 -> level 1 (Angeschlagen: -1)
          healthSlots: [
            ...Array.from({ length: 10 }, () => ({ type: 'consumed' as const })),
            ...Array.from({ length: 38 }, () => ({ type: 'empty' as const })),
          ],
        },
      };

      const { result } = renderHook(() => useCalculations(state));
      // Base penalty for Angeschlagen is -1, but Schmerzresistenz reduces it by 1 -> 0!
      expect(result.current.currentWoundPenalty).toBe(0);
    });
  });

  // =========================================================================
  // 5. ERHOLUNG & PAUSEN (PDF S. 174, S. 195)
  // =========================================================================
  describe('5. Heilung durch Pausen', () => {
    it('Verschnaufpause: heilt Betäubungsschaden, regeneriert erschöpften Fokus, baut 1 Stufe Erschöpft ab (PDF S. 174)', () => {
      const { result } = renderHook(() => useCharacterState());
      act(() => {
        result.current.dispatch({
          type: 'PLAY_RESET',
          payload: { maxLP: 8, maxFocus: 16, maxSplitter: 3 },
        });
        result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'exhausted', maxLP: 8, amount: 5 } });
        result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 2 } });
        result.current.dispatch({ type: 'PLAY_SPEND_FOCUS', payload: { kind: 'exhausted', amount: 6 } });
        result.current.dispatch({ type: 'PLAY_ADD_CONDITION', payload: { id: 'c1', key: 'Erschöpft', level: 2 } });
      });

      act(() => {
        result.current.dispatch({
          type: 'PLAY_HEAL_EXHAUSTED',
          payload: {
            healAllStun: true,
            healAllExhaustedFocus: true,
            exhaustReduction: 1,
            removeConditions: true,
          },
        });
      });

      // Exhausted health damage is 0, consumed remains 2
      expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'exhausted')).toHaveLength(0);
      expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(2);
      // Exhausted focus is 0
      expect(result.current.state.playState.focus.exhausted).toBe(0);
      // Erschöpft reduced from 2 to 1
      expect(result.current.state.playState.conditions.find((c) => c.key === 'Erschöpft')?.level).toBe(1);
    });

    it('Ruhephase: heilt Betäubungsschaden, heilt KONx2 echten Schaden, regeneriert WILx2 verzehrten Fokus (PDF S. 174 & 195)', () => {
      const { result } = renderHook(() => useCharacterState());
      act(() => {
        result.current.dispatch({
          type: 'PLAY_RESET',
          payload: { maxLP: 8, maxFocus: 16, maxSplitter: 3 },
        });
        result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 7 } });
        result.current.dispatch({ type: 'PLAY_SPEND_FOCUS', payload: { kind: 'consumed', amount: 8 } });
      });

      // KON = 3 -> heals 6 true LP. WIL = 2 -> heals 4 consumed FO
      act(() => {
        result.current.dispatch({
          type: 'PLAY_REST_HEAL',
          payload: { konAmount: 3, wilAmount: 2 },
        });
      });

      // 7 consumed - 6 healed = 1 consumed remaining
      expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(1);
      // 8 consumed FO - 4 healed = 4 consumed FO remaining
      expect(result.current.state.playState.focus.consumed).toBe(4);
    });
  });

  // =========================================================================
  // 6. ZAUBERVORGANG & EG-MODIFIKATIONEN (PDF S. 195-200, S. 221-223)
  // =========================================================================
  describe('6. Zaubervorgang, Fokuskosten und EG-Modifikationen', () => {
    it('parst Fokuskosten wie K4V1, 5V2, K8V2, K1 korrekt (PDF S. 195-196)', () => {
      const c1 = parseFocusCost('K4V1');
      expect(c1.isChanneled).toBe(true);
      // GRW: „K6V2 sind 6 kanalisierte Punkte Fokus insgesamt, davon werden 2 sofort verzehrt“
      expect(c1.channeled).toBe(3);
      expect(c1.consumed).toBe(1);
      expect(c1.total).toBe(4);

      const c2 = parseFocusCost('5V2');
      expect(c2.isChanneled).toBe(false);
      expect(c2.exhausted).toBe(3);
      expect(c2.consumed).toBe(2);
      expect(c2.total).toBe(5);

      const c3 = parseFocusCost('K1');
      expect(c3.isChanneled).toBe(true);
      expect(c3.channeled).toBe(1);
      expect(c3.total).toBe(1);
    });

    it('wendet EG-Modifikationen nach PDF S. 221 an (Fokus einsparen, Auslösezeit, Schaden)', () => {
      const baseCost = parseFocusCost('6V2');
      const allocations = {
        ...INITIAL_EG_ALLOCATIONS,
        saveExhaustedFocus: 2, // 2 EG -> -2 exhausted FO
        increaseDamage: 2,     // 2 EG -> +2 damage
        reduceCastTime: 1,     // 3 EG -> -1 tick cast time
      };

      expect(calculateTotalEGSpent(allocations)).toBe(7);

      const finalCosts = calculateFinalSpellCosts(baseCost, allocations);
      // 6V2: 4 erschöpft + 2 verzehrt; 4 erschöpft - 2 = 2
      expect(finalCosts.effectiveExhausted).toBe(2);
      expect(finalCosts.effectiveConsumed).toBe(2);
      // Standard 3 ticks Auslösezeit - 1 = 2 ticks
      expect(finalCosts.effectiveCastTicks).toBe(2);
      expect(finalCosts.modificationsSummary).toContain('-2 Erschöpfter Fokus (2 EG)');
      expect(finalCosts.modificationsSummary).toContain('+2 Schaden (2 EG)');
      expect(finalCosts.modificationsSummary).toContain('-1 Ticks Auslösezeit (3 EG)');
    });
  });
});
