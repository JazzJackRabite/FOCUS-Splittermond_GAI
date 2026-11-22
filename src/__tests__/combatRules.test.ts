import { describe, it, expect } from 'vitest';
import {
  calculateAttackEG,
  FREE_COMBAT_MANEUVERS,
  getAvailableCombatManeuvers,
  manoeverRegeln,
  parseWeaponDamage,
  executeAttackDamageRoll,
  wuchtangriffJeEg,
  kombiniereManoever,
  manoeverHinzufuegbar,
} from '../utils/combatRules';
import { Katalog } from '../regelwerk/katalog';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';

const B = basisAusDateien();
const K = new Katalog(B.manifest, [B.basis]);

describe('Splittermond Combat Rules & Attack Calculations', () => {
  describe('calculateAttackEG (GRW S. 17 & 158-161)', () => {
    it('calculates 0 EG for close hit (Diff 0 to 2)', () => {
      // Roll 15 vs VTD 15 -> Diff 0 -> 0 EG
      const res0 = calculateAttackEG(15, 15);
      expect(res0.isSuccess).toBe(true);
      expect(res0.differenz).toBe(0);
      expect(res0.eg).toBe(0);

      // Roll 17 vs VTD 15 -> Diff 2 -> 0 EG
      const res2 = calculateAttackEG(17, 15);
      expect(res2.isSuccess).toBe(true);
      expect(res2.differenz).toBe(2);
      expect(res2.eg).toBe(0);
    });

    it('calculates 1 EG for Diff 3..5, 2 EG for Diff 6..8, 3 EG for Diff 9..11', () => {
      expect(calculateAttackEG(18, 15).eg).toBe(1);
      expect(calculateAttackEG(20, 15).eg).toBe(1);
      expect(calculateAttackEG(21, 15).eg).toBe(2);
      expect(calculateAttackEG(23, 15).eg).toBe(2);
      expect(calculateAttackEG(24, 15).eg).toBe(3);
      expect(calculateAttackEG(30, 15).eg).toBe(5);
    });

    it('verfehlte Angriffe mit Einstufung nach GRW S. 17 (knapp misslungen bei −1/−2)', () => {
      const closeMiss = calculateAttackEG(14, 15);
      expect(closeMiss.isSuccess).toBe(false);
      expect(closeMiss.differenz).toBe(-1);
      expect(closeMiss.outcomeLabel).toBe('Knapp misslungen');
      expect(calculateAttackEG(10, 15).outcomeLabel).toBe('Misslungen');
      expect(calculateAttackEG(15, 15).outcomeLabel).toBe('(Knapp) gelungen');
      expect(calculateAttackEG(30, 15).outcomeLabel).toBe('Herausragend gelungen');
    });

    it('Patzer verfehlt immer; Triumph gibt +3 EG, aber nur wenn der Angriff rechnerisch trifft (GRW S. 18)', () => {
      const fumble = calculateAttackEG(18, 15, true, false);
      expect(fumble.isSuccess).toBe(false);
      expect(fumble.isFumble).toBe(true);
      expect(fumble.eg).toBe(0);
      expect(fumble.outcomeLabel).toMatch(/^Patzer/);

      const triumphLow = calculateAttackEG(15, 15, false, true);
      expect(triumphLow).toMatchObject({ isSuccess: true, isCrit: true, eg: 3 });
      expect(calculateAttackEG(21, 15, false, true).eg).toBe(5);
      // Triumph bei rechnerischem Fehlschlag: kein Treffer, keine Zusatz-EG
      expect(calculateAttackEG(13, 15, false, true)).toMatchObject({ isSuccess: false, isCrit: false, eg: 0 });
    });
  });

  describe('Freie Manöver und Manöverregeln aus dem Paket (GRW S. 160–161)', () => {
    it('ohne angesagtes Meisterschafts-Manöver gibt es nur den Angriff selbst; freie Manöver folgen mit EG', () => {
      expect(FREE_COMBAT_MANEUVERS.map((m) => m.id)).toEqual(['none']);
      expect(FREE_COMBAT_MANEUVERS[0].egCost).toBe(0);
    });

    it('genau drei freie Manöver: Wuchtangriff (+1 je EG), Betäubungsschlag (1 EG, nur Nahkampf), Störender Angriff (+3 je EG)', () => {
      const r = manoeverRegeln(K);
      expect(r.freie.map((f) => f.name).sort()).toEqual(['Betäubungsschlag', 'Störender Angriff', 'Wuchtangriff']);
      expect(r.freie.find((f) => f.name === 'Wuchtangriff')?.je_eg?.schaden).toBe(1);
      expect(r.freie.find((f) => f.name === 'Betäubungsschlag')).toMatchObject({ eg: 1, nur_nahkampf: true });
      expect(r.freie.find((f) => f.name === 'Störender Angriff')?.je_eg?.entschlossenheit_erschwert).toBe(3);
      expect(r).toMatchObject({ egJeManoever: 1, streiftrefferSchaden: 2, streiftrefferBetaeubung: 2 });
    });

    it('Wuchtangriff: +1 Schaden je EG, mit dem Merkmal Wuchtig +2 (GRW S. 161, 186)', () => {
      expect(wuchtangriffJeEg('Scharf 2', K)).toBe(1);
      expect(wuchtangriffJeEg('Wuchtig, Zweihändig', K)).toBe(2);
      expect(wuchtangriffJeEg(undefined, K)).toBe(1);
    });
  });

  describe('Meisterschafts-Manöver des Charakters (aus dem Paket)', () => {
    it('ohne Meisterschaften nur der Angriff selbst', () => {
      expect(getAvailableCombatManeuvers([], 'Klingenwaffen', undefined, {}, K).map((m) => m.id)).toEqual(['none']);
    });

    it('Hiebwaffen: Hammerschlag +1W6, Schmetterschlag Benommen 1 für 30 Ticks (GRW S. 97)', () => {
      const m = getAvailableCombatManeuvers([{ name: 'Hammerschlag (S2)', skill: 'Hiebwaffen' }, { name: 'Schmetterschlag (S2)', skill: 'Hiebwaffen' }], 'Hiebwaffen', 'Nahkampf', {}, K);
      const ham = m.find((x) => x.name === 'Hammerschlag')!;
      expect(ham).toMatchObject({ extraDamageFormula: '1W6', egCost: 1, damageMultiplier: 1, targetResistance: 'VTD' });
      expect(m.find((x) => x.name === 'Schmetterschlag')?.inflictsCondition).toBe('Benommen 1 (30 Ticks)');
      expect(ham.belege.join(' ')).toContain('1W6');
    });

    it('Manöver gegen KW oder GW mit halbem Schaden: Abdrängen, Umklammern (beide ringend), Verwirrung (GRW S. 95–98)', () => {
      const m = getAvailableCombatManeuvers([
        { name: 'Abdrängen (S1)', skill: 'Allgemeine Nahkampfmeisterschaften' },
        { name: 'Umklammern (S1)', skill: 'Allgemeine Nahkampfmeisterschaften' },
        { name: 'Verwirrung (S1)', skill: 'Handgemenge' },
      ], 'Handgemenge', 'Nahkampf', {}, K);
      expect(m.find((x) => x.name === 'Abdrängen')).toMatchObject({ targetResistance: 'KW', damageMultiplier: 0.5, hoechstensGk: 7 });
      expect(m.find((x) => x.name === 'Umklammern')).toMatchObject({ targetResistance: 'KW', damageMultiplier: 0.5, inflictsCondition: 'Ringend', selfCondition: 'Ringend' });
      expect(m.find((x) => x.name === 'Verwirrung')).toMatchObject({ targetResistance: 'GW', damageMultiplier: 0.5 });
    });

    it('Zusatzschaden aus Werten des Angreifers: Vorstürmen halbe GSW (höchstens 8), Würgegriff STÄ, Meisterwurf INT', () => {
      const w = { GSW: 19, STA: 4, INT: 3 };
      expect(getAvailableCombatManeuvers([{ name: 'Vorstürmen', skill: 'Allgemeine Nahkampfmeisterschaften' }], 'Klingenwaffen', 'Nahkampf', w, K)[1]).toMatchObject({ fixedExtraDamage: 8 });
      expect(getAvailableCombatManeuvers([{ name: 'Vorstürmen', skill: 'Allgemeine Nahkampfmeisterschaften' }], 'Klingenwaffen', 'Nahkampf', { GSW: 11 }, K)[1].fixedExtraDamage).toBe(6); // 5,5 kaufmännisch
      expect(getAvailableCombatManeuvers([{ name: 'Würgegriff', skill: 'Handgemenge' }], 'Handgemenge', 'Nahkampf', w, K)[1]).toMatchObject({ fixedExtraDamage: 4, requires: 'ringend' });
      expect(getAvailableCombatManeuvers([{ name: 'Meisterwurf', skill: 'Wurfwaffen' }], 'Wurfwaffen', 'Fernkampf', w, K)[1]).toMatchObject({ fixedExtraDamage: 3, requires: 'zielen' });
    });

    it('Ausfall: Ziel verliert 3 Ticks; Entwaffnen und Schildbrecher: kein Schaden', () => {
      const m = getAvailableCombatManeuvers([{ name: 'Ausfall', skill: 'Klingenwaffen' }, { name: 'Entwaffnen', skill: 'Allgemeine Nahkampfmeisterschaften' }], 'Klingenwaffen', 'Nahkampf', {}, K);
      expect(m.find((x) => x.name === 'Ausfall')?.zielVerliertTicks).toBe(3);
      expect(m.find((x) => x.name === 'Entwaffnen')?.damageMultiplier).toBe(0);
    });

    it('eine Meisterschaft gilt nur in ihrer Fertigkeit; allgemeine Nahkampfmeisterschaften nur im Nahkampf', () => {
      const gelernt = [
        { name: 'Meisterschuss (S3)', skill: 'Schusswaffen' },
        { name: 'Ausfall (S1)', skill: 'Stangenwaffen' },
        { name: 'Rundumschlag (S2)', skill: 'Allgemeine Nahkampfmeisterschaften' },
        { name: 'Hammerschlag (S2)', skill: 'Hiebwaffen' },
      ];
      const stange = getAvailableCombatManeuvers(gelernt, 'Stangenwaffen', 'Nahkampf', {}, K).map((m) => m.name);
      expect(stange).toContain('Ausfall');
      expect(stange).toContain('Rundumschlag');
      expect(stange).not.toContain('Meisterschuss');
      expect(stange).not.toContain('Hammerschlag');
      const bogen = getAvailableCombatManeuvers(gelernt, 'Schusswaffen', 'Fernkampf', {}, K).map((m) => m.name);
      expect(bogen).toContain('Meisterschuss');
      expect(bogen).not.toContain('Rundumschlag');
      expect(bogen).not.toContain('Ausfall');
    });

    it('Scharfschütze ist kein Manöver (GRW S. 99): erscheint nicht in der Liste', () => {
      const m = getAvailableCombatManeuvers([{ name: 'Scharfschütze (S1)', skill: 'Schusswaffen' }], 'Schusswaffen', 'Fernkampf', {}, K).map((x) => x.name);
      expect(m).not.toContain('Scharfschütze');
    });

    it('ohne Paket keine Meisterschafts-Manöver (keine Manöver nach Namen im Code)', () => {
      expect(getAvailableCombatManeuvers([{ name: 'Hammerschlag', skill: 'Hiebwaffen' }], 'Hiebwaffen', 'Nahkampf', {}, null).map((m) => m.id)).toEqual(['none']);
    });
  });

  describe('parseWeaponDamage', () => {
    it('parses formulas like 1W6+2, 2W6, 1W10+4', () => {
      const p1 = parseWeaponDamage('1W6+2');
      expect(p1.count).toBe(1);
      expect(p1.sides).toBe(6);
      expect(p1.bonus).toBe(2);

      const p2 = parseWeaponDamage('2W6');
      expect(p2.count).toBe(2);
      expect(p2.sides).toBe(6);
      expect(p2.bonus).toBe(0);

      const p3 = parseWeaponDamage('1W10+4 (Stich)');
      expect(p3.count).toBe(1);
      expect(p3.sides).toBe(10);
      expect(p3.bonus).toBe(4);
      expect(p3.damageType).toBe('Stich');
    });
  });

  describe('executeAttackDamageRoll', () => {
    it('Bruttoschaden, Rüstung und Nettoschaden', () => {
      const result = executeAttackDamageRoll({ baseFormula: '1W6+4', egBonusDamage: 2, targetArmorReduction: 3, damageType: 'Schnitt' });
      expect(result.grossDamage).toBeGreaterThanOrEqual(7);
      expect(result.effectiveArmor).toBe(3);
      expect(result.netDamage).toBe(Math.max(0, result.grossDamage - 3));
    });

    it('Zustand des Manövers, fester Zusatzschaden, Betäubungsschlag', () => {
      const r = executeAttackDamageRoll({ baseFormula: '1W6+2', egBonusDamage: 0, maneuverFixedDamage: 4, maneuverCondition: 'Benommen 1 (30 Ticks)', stunDamage: true });
      expect(r.appliedConditions).toEqual(['Benommen 1 (30 Ticks)']);
      expect(r.grossDamage).toBeGreaterThanOrEqual(7);
      expect(r.damageType).toBe('Betäubung');
    });

    it('halber Schaden kaufmännisch gerundet, kein Schaden bleibt 0, Streiftreffer −2 (GRW S. 11, 161)', () => {
      for (let i = 0; i < 20; i++) {
        const h = executeAttackDamageRoll({ baseFormula: '1W6+4', egBonusDamage: 0, damageMultiplier: 0.5 });
        expect(h.grossDamage).toBe(Math.round((h.baseDiceSum + 4) / 2));
        const st = executeAttackDamageRoll({ baseFormula: '1W6+4', egBonusDamage: 0, streiftrefferAbzug: 2 });
        expect(st.grossDamage).toBe(Math.max(0, st.baseDiceSum + 4 - 2));
      }
      expect(executeAttackDamageRoll({ baseFormula: '1W6+4', egBonusDamage: 3, damageMultiplier: 0 }).grossDamage).toBe(0);
    });
  });
});

describe('Mehrere Meisterschafts-Manöver je Angriff (GRW S. 161)', () => {
  const r = manoeverRegeln(K);
  const liste = getAvailableCombatManeuvers(
    [{ name: 'Hammerschlag', skill: 'Hiebwaffen' }, { name: 'Knochenbrecher', skill: 'Hiebwaffen' }, { name: 'Abdrängen', skill: 'Hiebwaffen' }, { name: 'Umreißen', skill: 'Hiebwaffen' }, { name: 'Rundumschlag', skill: 'Hiebwaffen' }],
    'Hiebwaffen', undefined, {}, K,
  );
  const m = (n: string) => liste.find((x) => x.name === n)!;

  it('Kombinationsregeln aus dem Paket', () => {
    expect(r.kombination).toEqual({ mehrere: true, gleicherWiderstand: true, schadenFuerAngriff: true, jeManoeverEinmal: true });
    expect(manoeverRegeln(null).kombination.mehrere).toBe(false);
  });

  it('nur gegen denselben Widerstand, jedes Manöver einmal', () => {
    expect(manoeverHinzufuegbar([m('Hammerschlag')], m('Knochenbrecher'), r)).toBeNull();
    expect(manoeverHinzufuegbar([m('Hammerschlag')], m('Abdrängen'), r)).toMatch(/KW/);
    expect(manoeverHinzufuegbar([m('Abdrängen')], m('Umreißen'), r)).toBeNull();
    expect(manoeverHinzufuegbar([m('Hammerschlag')], m('Hammerschlag'), r)).toMatch(/einmal/);
    expect(manoeverHinzufuegbar([m('Hammerschlag')], m('Knochenbrecher'), manoeverRegeln(null))).toMatch(/Nur ein/);
  });

  it('EG summiert, Zusatzschaden und Zustände gesammelt, Schadenseinschränkung für den ganzen Angriff', () => {
    const k = kombiniereManoever([m('Hammerschlag'), m('Knochenbrecher'), m('Rundumschlag')], r);
    expect(k.egKosten).toBe(3);
    expect(k.angesagt).toBe(3);
    expect(k.extraDamageFormulas).toEqual(['1W6']);
    expect(k.zustaende.length).toBe(1);
    expect(k.damageMultiplier).toBe(0.5);
    expect(k.gesamt.name).toBe('Hammerschlag + Knochenbrecher + Rundumschlag');
    expect(kombiniereManoever([], r).angesagt).toBe(0);
    expect(kombiniereManoever([], r).egKosten).toBe(0);
  });

  it('Schaden: mehrere Zusatzwürfel, Streiftreffer −2 je angesagtem Manöver', () => {
    const res = executeAttackDamageRoll({ baseFormula: '0W6+10', maneuverExtraFormulas: ['0W6+2', '0W6+3'], egBonusDamage: 0, maneuverConditions: ['Benommen', 'Verwundet 1'] });
    expect(res.grossDamage).toBe(15);
    expect(res.appliedConditions).toEqual(['Benommen', 'Verwundet 1']);
    const st = executeAttackDamageRoll({ baseFormula: '0W6+10', egBonusDamage: 0, streiftrefferAbzug: 2 * r.streiftrefferSchaden });
    expect(st.grossDamage).toBe(6);
  });
});
