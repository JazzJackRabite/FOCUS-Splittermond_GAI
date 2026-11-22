import { describe, it, expect } from 'vitest';
import { getConditionMalus, getActiveRollModifiers } from '../utils/conditionModifiers';
import type { StatusCondition } from '../types';

describe('Condition Modifiers & Roll Integration (Splittermond GRW)', () => {
  it('correctly calculates condition modifiers for Geblendet (Stufe x -2)', () => {
    const blind1: StatusCondition = { id: 'c1', key: 'Geblendet', level: 1 };
    const blind2: StatusCondition = { id: 'c2', key: 'Geblendet', level: 2 };

    const mod1 = getConditionMalus(blind1);
    const mod2 = getConditionMalus(blind2);

    expect(mod1).not.toBeNull();
    expect(mod1?.malus).toBe(-2);
    expect(mod1?.label).toBe('Geblendet 1');

    expect(mod2).not.toBeNull();
    expect(mod2?.malus).toBe(-4);
    expect(mod2?.label).toBe('Geblendet 2');
  });

  it('Liegend ist eine Kampfposition (GRW S. 170): −6 auf eigene Angriffe, kein Abzug auf andere Proben', () => {
    const liegend: StatusCondition = { id: 'c3', key: 'Liegend' };
    const mod = getConditionMalus(liegend, { bereich: 'kampf' });

    expect(mod).not.toBeNull();
    expect(mod?.malus).toBe(-6);
    expect(mod?.label).toBe('Liegend');
    expect(getConditionMalus(liegend)).toBeNull();
    expect(getConditionMalus(liegend, { bereich: 'magie' })).toBeNull();
  });

  it('Zustände nach GRW S. 168–169: nur Erschöpft, Geblendet, Ringend, Glaubenskrise und Verwundet ändern den Probenwert', () => {
    // Erschöpft: Kampffertigkeiten und allgemeine Fertigkeiten, nicht Magieschulen
    expect(getConditionMalus({ id: '2', key: 'Erschöpft', level: 3 })?.malus).toBe(-3);
    expect(getConditionMalus({ id: '2', key: 'Erschöpft', level: 3 }, { bereich: 'kampf' })?.malus).toBe(-3);
    expect(getConditionMalus({ id: '2', key: 'Erschöpft', level: 3 }, { bereich: 'magie' })).toBeNull();
    // Glaubenskrise: nur Magieschulen
    expect(getConditionMalus({ id: '8', key: 'Glaubenskrise', level: 2 }, { bereich: 'magie' })?.malus).toBe(-2);
    expect(getConditionMalus({ id: '8', key: 'Glaubenskrise', level: 2 })).toBeNull();
    expect(getConditionMalus({ id: '6', key: 'Ringend' })?.malus).toBe(-3);
    // Geblendet zählt höchstens bis Stufe 4
    expect(getConditionMalus({ id: '9', key: 'Geblendet', level: 6 })?.malus).toBe(-8);
    // Verwundet: gilt beim Wundabzug als eine Wundstufe schwerer verletzt je Stufe (0, −1, −2, −4, −8)
    expect(getConditionMalus({ id: '3', key: 'Verwundet', level: 1 }, { wundabzug: 0 })?.malus).toBe(-1);
    expect(getConditionMalus({ id: '3', key: 'Verwundet', level: 1 }, { wundabzug: -2 })?.malus).toBe(-2);
    expect(getConditionMalus({ id: '3', key: 'Verwundet', level: 2 }, { wundabzug: -1 })?.malus).toBe(-3);
    expect(getConditionMalus({ id: '3', key: 'Verwundet', level: 3 }, { wundabzug: -4 })?.malus).toBe(-4);
    expect(getConditionMalus({ id: '3', key: 'Verwundet', level: 1 }, { wundabzug: -8 })).toBeNull();
    // kein Abzug auf Proben: Benommen (verlangsamt), Angsterfüllt (nur Sicherheitswürfe), Panisch, Lahm, Siechtum
    for (const key of ['Benommen', 'Angsterfüllt', 'Panisch', 'Lahm', 'Siechtum', 'Rasend', 'Blutend']) {
      expect(getConditionMalus({ id: 'x', key, level: 2 }), key).toBeNull();
    }
  });

  it('combines wound penalty (e.g. Angeschlagen -1) and active conditions (Geblendet, Liegend)', () => {
    const conditions: StatusCondition[] = [
      { id: 'c1', key: 'Geblendet', level: 1 },
      { id: 'c2', key: 'Liegend' },
    ];
    const woundPenalty = -1;
    const healthLevelName = 'Angeschlagen';

    const activeMods = getActiveRollModifiers(conditions, woundPenalty, healthLevelName, 0, false, 'kampf');

    expect(activeMods).toHaveLength(3);

    // Wound modifier
    const woundMod = activeMods.find((m) => m.source === 'wound');
    expect(woundMod).toBeDefined();
    expect(woundMod?.malus).toBe(-1);
    expect(woundMod?.label).toBe('Wundabzug (Angeschlagen)');
    expect(woundMod?.active).toBe(true);

    // Geblendet modifier
    const blindMod = activeMods.find((m) => m.label.includes('Geblendet'));
    expect(blindMod).toBeDefined();
    expect(blindMod?.malus).toBe(-2);
    expect(blindMod?.active).toBe(true);

    // Liegend modifier
    const liegendMod = activeMods.find((m) => m.label === 'Liegend');
    expect(liegendMod).toBeDefined();
    expect(liegendMod?.malus).toBe(-6);
    expect(liegendMod?.active).toBe(true);

    // Total malus sum
    const totalMalus = activeMods.filter((m) => m.active).reduce((sum, m) => sum + m.malus, 0);
    expect(totalMalus).toBe(-9);
  });

  it('combines wound penalty for Schwer verletzt (-4) with active conditions', () => {
    const conditions: StatusCondition[] = [
      { id: 'c1', key: 'Geblendet', level: 2 },
    ];
    const woundPenalty = -4;
    const healthLevelName = 'Schwer verletzt';

    // Angriff: Geblendet zählt immer (GRW S. 168)
    const activeMods = getActiveRollModifiers(conditions, woundPenalty, healthLevelName, 0, false, 'kampf');

    expect(activeMods).toHaveLength(2);

    const totalMalus = activeMods.filter((m) => m.active).reduce((sum, m) => sum + m.malus, 0);
    // -4 (Schwer verletzt) + -4 (Geblendet 2) = -8
    expect(totalMalus).toBe(-8);

    // Fertigkeitsprobe: Geblendet steht zur Wahl, ist aber nicht vorausgewählt (nur wenn die Sicht zählt)
    const probe = getActiveRollModifiers(conditions, woundPenalty, healthLevelName);
    expect(probe.find((m) => m.label === 'Geblendet 2')?.active).toBe(false);
  });

  it('returns empty list when character is Unverletzt and has no restricting conditions', () => {
    const conditions: StatusCondition[] = [];
    const woundPenalty = 0;
    const healthLevelName = 'Unverletzt';

    const activeMods = getActiveRollModifiers(conditions, woundPenalty, healthLevelName);
    expect(activeMods).toHaveLength(0);
  });
});
