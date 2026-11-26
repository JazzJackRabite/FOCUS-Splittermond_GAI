import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalculations } from '../hooks/useCalculations';
import { useCharacterState } from '../hooks/useCharacterState';
import {
  calculateAttackEG,
  getAvailableCombatManeuvers,
  parseWeaponDamage,
  executeAttackDamageRoll,
  wuchtangriffJeEg,
} from '../utils/combatRules';
import {
  calculateSpellEG,
  parseFocusCost,
} from '../utils/magicRules';
import { getConditionMalus, getActiveRollModifiers, getConditionDescription } from '../utils/conditionModifiers';
import { positionsModifikator } from '../regelwerk/kampflage';
import { archetypen, archetypZuCharakter } from '../regelwerk/archetypen';
import { grwRassen } from '../regelwerk/grwListen';
const RACES = grwRassen();
import { Katalog } from '../regelwerk/katalog';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';

const KB = basisAusDateien();
const KAT = new Katalog(KB.manifest, [KB.basis]);

describe('Splittermond GRW – Umfassende Regelprüfung, Archetypen & Kampfsimulation', () => {

  // =========================================================================
  // TEIL 1: 5 TESTCHARAKTERE NACH GRW-REGELN BAUEN & VALIDIEREN
  // =========================================================================
  describe('1. Archetypen des GRW (Anhang 3) nach den Rassen- und Erschaffungsregeln', () => {
    it('Rassenregeln aus dem Paket (GRW S. 33–37)', () => {
      expect(RACES['Varg']).toMatchObject({ gk: 6, mods: { STA: 2, WIL: -1 }, freeMods: 1 });
      expect(RACES['Mensch']).toMatchObject({ gk: 5, freeMods: 2 });
      expect(RACES['Gnom']).toMatchObject({ gk: 3, mods: { MYS: 1, VER: 1, STA: -1 } });
      expect(RACES['Zwerg']).toMatchObject({ gk: 4, mods: { KON: 1, WIL: 1, BEW: -1 } });
    });

    it.each(archetypen(KAT).map((a) => [a.name, a.id] as const))('%s: 18 Attributpunkte, 55 Fertigkeitspunkte bei der Erschaffung, höchstens 6', (_n, id) => {
      const state = archetypZuCharakter(id, KAT)!;
      expect(Object.values(state.attrBase).reduce((a, b) => a + b, 0)).toBe(18);
      // Kultur 15 + Abstammung 5 + Ausbildung 30 + Schritt 7 5 (GRW S. 23–24); Punkte aus den Start-EP stehen getrennt
      expect(Object.values(state.skillsBase).reduce((a, b) => a + b, 0)).toBe(55);
      for (const [n, v] of Object.entries(state.skillsBase)) expect(v + (state.skillsXp[n] ?? 0)).toBeLessThanOrEqual(6);
    });

    it('Arrou über den Hook: Werte wie im Bogen (GRW S. 328)', () => {
      const a = archetypen(KAT).find((x) => x.name === 'Arrou')!;
      const state = { ...archetypZuCharakter(a.id, KAT)!, inventory: [] };
      const { result } = renderHook(() => useCalculations(state));
      // STÄ 3+2, WIL 2−1, INT 3+1 (freier Bonus)
      expect(result.current.currentAttributes).toMatchObject({ STA: 5, WIL: 1, INT: 4, BEW: 3 });
      expect(result.current.derived.GSW).toBe(10); // GK 6 + BEW 3 + Flink
      expect(result.current.derived.INI).toBe(6);  // 10 − INT 4
      expect(result.current.maxLP).toBe(8);        // GK 6 + KON 2
      expect(result.current.derived.VTD).toBe(18); // 12 + 3 + 5 − 2 (GK 6)
    });
  });

  // =========================================================================
  // TEIL 2: VOLLSTÄNDIGE KAMPFSIMULATION DURCHSPIELEN (END-TO-END)
  // =========================================================================
  describe('2. Durchspiel eines vollständigen Kampfes (Tick-System, Proben, Manöver, Schaden & Heilung)', () => {

    it('Schritt 1: Initiative-Wurf & Start-Ticks nach GRW S. 154', () => {
      // Formel: Start-Ticks = 10 - INI - Erfolgsgrade(Initiative-Wurf)
      // Cederion: INI = 8
      const cederionINI = 8;
      // Würfelergebnis Initiative (z.B. Wurf 15 gegen Standard-Schwierigkeit 15 -> Diff 0 -> 0 EG)
      const iniRollDiff = 0;
      const iniEG = Math.max(0, Math.floor(iniRollDiff / 3));
      const cederionStartTick = Math.max(0, 10 - cederionINI - iniEG);
      expect(cederionStartTick).toBe(2); // Startet auf Tick 2

      // Gegner: INI = 6, kein EG -> Startet auf Tick 4 (10 - 6 = 4)
      const enemyStartTick = 10 - 6;
      expect(enemyStartTick).toBe(4);
      // Cederion hat die Initiative und handelt zuerst!
      expect(cederionStartTick).toBeLessThan(enemyStartTick);
    });

    it('Schritt 2: Nahkampfangriff mit Breitschwert und Kampfmanöver Wuchtangriff (GRW S. 158-160)', () => {
      // Cederion führt ein Breitschwert (1W6+5, WGS 7)
      const weaponFormula = '1W6+5';
      const parsed = parseWeaponDamage(weaponFormula);
      expect(parsed.count).toBe(1);
      expect(parsed.sides).toBe(6);
      expect(parsed.bonus).toBe(5);

      // Angriffs-Wurf: Fertigkeit Klingenwaffen (6) + BEW (3) + STA (4) = Fertigkeitswert 13
      // Würfelergebnis 2W10 = 12 (z.B. 5 + 7) -> Gesamtwert = 13 + 12 = 25
      const totalAttackRoll = 25;
      const enemyVTD = 18;

      // Erfolgsgrad-Berechnung:
      const attackCalc = calculateAttackEG(totalAttackRoll, enemyVTD);
      expect(attackCalc.isSuccess).toBe(true);
      expect(attackCalc.differenz).toBe(7); // 25 - 18 = 7
      expect(attackCalc.eg).toBe(2); // Diff 7 entspricht 2 EG (Diff 6..8 = 2 EG)
      expect(attackCalc.outcomeLabel).toBe('Gelungen'); // 1 bis 2 EG (GRW S. 17)

      // Cederion setzt beide EG für das freie Manöver Wuchtangriff ein: +1 Schaden je EG
      // (GRW S. 161; Beispiel dort: 1 EG macht aus 1W6+4 dann 1W6+5). Nur Waffen mit dem Merkmal Wuchtig geben +2.
      const jeEg = wuchtangriffJeEg(undefined, KAT);
      expect(jeEg).toBe(1);
      const allocatedEG = 2;
      const bonusDamage = allocatedEG * jeEg;
      expect(bonusDamage).toBe(2);

      // Schadenswurf ausführen: Gegner hat Lederrüstung mit RS = 2
      const damageResult = executeAttackDamageRoll({
        baseFormula: weaponFormula,
        egBonusDamage: bonusDamage,
        targetArmorReduction: 2,
      });

      // Würfel 1W6 ergibt mindestens 1, maximal 6
      expect(damageResult.baseDice[0]).toBeGreaterThanOrEqual(1);
      expect(damageResult.baseDice[0]).toBeLessThanOrEqual(6);
      // Brutto-Schaden = Wurf (1..6) + 5 (Waffenbonus) + 2 (Wuchtangriff) = 8..13
      expect(damageResult.grossDamage).toBeGreaterThanOrEqual(8);
      expect(damageResult.grossDamage).toBeLessThanOrEqual(13);
      // Netto-Schaden = Brutto - 2 (RS)
      expect(damageResult.netDamage).toBe(damageResult.grossDamage - 2);
    });

    it('Schritt 3: Schadensabzug im Lebenspunkte-Tracker & Wundabzüge (GRW S. 14 & 172-173)', () => {
      const { result } = renderHook(() => useCharacterState());
      const enemyMaxLP = 8; // Basis-LP

      act(() => {
        result.current.dispatch({
          type: 'PLAY_RESET',
          payload: { maxLP: enemyMaxLP, maxFocus: 16, maxSplitter: 3 },
        });
      });

      // Gegner erleidet 10 echten Schaden (consumed)
      act(() => {
        result.current.dispatch({
          type: 'PLAY_TAKE_DAMAGE',
          payload: { kind: 'consumed', maxLP: enemyMaxLP, amount: 10 },
        });
      });

      // 10 Schaden bei 8 LP -> Wundstufe 1 überschritten (8 LP), aber unter Wundstufe 2 (16 LP)
      // Status: Angeschlagen -> Wundabzug = -1 auf alle Proben
      const { result: rCalc } = renderHook(() => useCalculations(result.current.state));
      expect(rCalc.current.currentHealthLevelName).toBe('Angeschlagen');
      expect(rCalc.current.currentWoundPenalty).toBe(-1);

      // Modifikatoren prüfen: Wundabzug wirkt als -1 Malus auf alle Proben
      const activeMods = getActiveRollModifiers(
        result.current.state.playState.conditions,
        rCalc.current.currentWoundPenalty,
        rCalc.current.currentHealthLevelName
      );
      const totalMalus = activeMods.reduce((sum, m) => sum + m.malus, 0);
      expect(totalMalus).toBe(-1);
    });

    it('Schritt 4: Gegenangriff mit der Meisterschaft „Umreißen“ (GRW S. 95) & Zustand Liegend', () => {
      // Umreißen ist eine allgemeine Nahkampfmeisterschaft (kein freies Manöver): gegen KW, halber Schaden,
      // das Ziel geht bei misslungener Probe zu Boden; kostet 1 EG
      const maneuvers = getAvailableCombatManeuvers([{ name: 'Umreißen (S1)', skill: 'Allgemeine Nahkampfmeisterschaften' }], 'Stangenwaffen', 'Nahkampf', {}, KAT);
      const trip = maneuvers.find((m) => m.name === 'Umreißen');
      expect(trip).toMatchObject({ targetResistance: 'KW', damageMultiplier: 0.5, egCost: 1 });
      expect(trip?.hinweis).toContain('liegend');
      expect(getAvailableCombatManeuvers([], 'Stangenwaffen', 'Nahkampf', {}, KAT).some((m) => m.name === 'Umreißen')).toBe(false);

      // Cederion erhält Zustand 'Liegend'
      const { result } = renderHook(() => useCharacterState());
      act(() => {
        result.current.dispatch({
          type: 'PLAY_ADD_CONDITION',
          payload: { id: 'cond_liegend', key: 'Liegend', level: 1 },
        });
      });

      expect(result.current.state.playState.conditions.some((c) => c.key === 'Liegend')).toBe(true);

      // Kampfposition liegend: eigene Nahkampfangriffe −6 (GRW S. 170) – über die eigene Position im Angriffsdialog,
      // nicht als Abzug auf die Probe
      expect(getConditionMalus({ id: 'cond_liegend', key: 'Liegend', level: 1 }, { bereich: 'kampf' })).toBeNull();
      expect(positionsModifikator('Liegend', 'nahkampf', 'eigene', '', KAT)).toBe(-6);
      expect(getConditionDescription({ id: 'cond_liegend', key: 'Liegend', level: 1 })).toContain('eigene Angriffe');
    });

    it('Schritt 5: Magie im Kampf – Kampfzauber wirken & Fokusverwaltung (GRW S. 192-198)', () => {
      // Telkin wirkt 'Felsgeschoss' (Grad 1, Kosten 3V1)
      const costStr = '3V1';
      const parsedCost = parseFocusCost(costStr);
      // GRW: "3V1" kostet insgesamt 3 Fokus, davon 1 verzehrt → 2 erschöpft + 1 verzehrt
      expect(parsedCost.exhausted).toBe(2);
      expect(parsedCost.consumed).toBe(1);
      expect(parsedCost.total).toBe(3);

      // Zauberprobe: 2W10 + Fertigkeit Felsmagie + MYS + KON vs Schwierigkeit 15
      // Wurf 18 vs 15 -> Diff 3 -> 1 EG
      const spellCalc = calculateSpellEG(18, 15);
      expect(spellCalc.isSuccess).toBe(true);
      expect(spellCalc.eg).toBe(1);

      // Fokus vom Pool abziehen:
      const { result } = renderHook(() => useCharacterState());
      const maxFokus = 20;
      act(() => {
        result.current.dispatch({
          type: 'PLAY_RESET',
          payload: { maxLP: 10, maxFocus: maxFokus, maxSplitter: 3 },
        });
        result.current.dispatch({
          type: 'PLAY_SPEND_FOCUS',
          payload: { kind: 'consumed', amount: parsedCost.consumed },
        });
        result.current.dispatch({
          type: 'PLAY_SPEND_FOCUS',
          payload: { kind: 'exhausted', amount: parsedCost.exhausted },
        });
      });

      expect(result.current.state.playState.focus.consumed).toBe(1);
      expect(result.current.state.playState.focus.exhausted).toBe(2);
      // Freier Fokus = maxFokus - (consumed + exhausted + channeled)
      const freeFocus = maxFokus - (result.current.state.playState.focus.consumed + result.current.state.playState.focus.exhausted);
      expect(freeFocus).toBe(17); // 20 - 3 = 17 freier Fokus
    });

    it('Schritt 6: Splitterpunkt-Einsatz im Kampf (GRW S. 200)', () => {
      const { result } = renderHook(() => useCharacterState());
      act(() => {
        result.current.dispatch({
          type: 'PLAY_RESET',
          payload: { maxLP: 10, maxFocus: 20, maxSplitter: 3 },
        });
      });
      expect(result.current.state.playState.splitterPoints).toBe(3);

      // Splitterpunkt für Schicksalswurf / Bonus ausgeben
      act(() => {
        result.current.dispatch({
          type: 'PLAY_SET_SPLITTER',
          payload: result.current.state.playState.splitterPoints - 1,
        });
      });

      expect(result.current.state.playState.splitterPoints).toBe(2);
    });

    it('Schritt 7: Erholung nach dem Kampf – Verschnaufpause & Ruhephase (GRW S. 174 & 195)', () => {
      const { result } = renderHook(() => useCharacterState());
      act(() => {
        result.current.dispatch({
          type: 'PLAY_RESET',
          payload: { maxLP: 10, maxFocus: 20, maxSplitter: 3 },
        });
        // Charakter hat nach dem Kampf:
        // - 4 Betäubungsschaden (exhausted)
        // - 6 echten Schaden (consumed)
        // - 5 erschöpften Fokus
        // - 2 verzehrten Fokus
        result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'exhausted', maxLP: 10, amount: 4 } });
        result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 10, amount: 6 } });
        result.current.dispatch({ type: 'PLAY_SPEND_FOCUS', payload: { kind: 'exhausted', amount: 5 } });
        result.current.dispatch({ type: 'PLAY_SPEND_FOCUS', payload: { kind: 'consumed', amount: 2 } });
      });

      // 1. Verschnaufpause (15 Minuten):
      // Heilt allen Betäubungsschaden & regeneriert allen erschöpften Fokus
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

      // Betäubungsschaden geheilt (0), echter Schaden verbleibt (6)
      expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'exhausted')).toHaveLength(0);
      expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(6);
      // Erschöpfter Fokus geheilt (0), verzehrter Fokus verbleibt (2)
      expect(result.current.state.playState.focus.exhausted).toBe(0);
      expect(result.current.state.playState.focus.consumed).toBe(2);

      // 2. Ruhephase (6 Stunden Schlaf):
      // Heilt KONx2 echten Schaden und WILx2 verzehrten Fokus via PLAY_REST_HEAL
      const konVal = 3;
      const wilVal = 2;
      act(() => {
        result.current.dispatch({
          type: 'PLAY_REST_HEAL',
          payload: {
            konAmount: konVal,
            wilAmount: wilVal,
            lpHealAmount: konVal * 2, // 6 LP Heilung!
            foHealAmount: wilVal * 2,  // 4 FO Heilung!
          },
        });
      });

      // Echter Schaden komplett geheilt (6 - 6 = 0)
      expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(0);
      // Verzehrter Fokus komplett geheilt (2 - 4 = 0)
      expect(result.current.state.playState.focus.consumed).toBe(0);
      // Charakter ist wieder voll einsatzbereit!
      expect(result.current.state.playState.focus.exhausted).toBe(0);
    });
  });
});
