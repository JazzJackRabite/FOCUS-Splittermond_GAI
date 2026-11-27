/**
 * Angriffswert = Punkte der Kampffertigkeit + die beiden Attribute der Waffe (GRW S. 185); die Attribute stehen im Paket
 * (daten.attribute). Vorher zählten nur die Fertigkeitspunkte.
 */
import { describe, expect, it } from 'vitest';
import { waffenAttribute, waffenlosImPaket, waffeImPaket } from '../regelwerk/ausruestung';
import { calculateCharacter } from '../utils/characterCalculations';
import { DEFAULT_STATE } from '../hooks/useCharacterState';
import type { CharacterState } from '../types';

describe('Angriffswert aus Fertigkeit und Waffenattributen', () => {
  it('Waffenlos aus dem GRW-Paket: Handgemenge, BEW und STÄ, Merkmale aus dem Paket', () => {
    const w = waffenlosImPaket()!;
    expect(w.kampfAttribute).toEqual(['BEW', 'STA']);
    expect(w.attributes).toContain('Stumpf');
    expect(Number(w.wgs)).toBeGreaterThan(0);
  });

  it('Inventarwaffe nach ID oder Name', () => {
    const lang = waffeImPaket({ name: 'Langschwert' })!;
    expect(lang.kampfAttribute?.length).toBe(2);
    expect(waffenAttribute({ id: 'unbekannt', name: 'Langschwert', weaponSkill: lang.skill })).toEqual(lang.kampfAttribute);
    expect(waffenAttribute({ name: 'Gibt es nicht' })).toEqual([]);
  });

  it('getAttackValue zählt Punkte und Attribute', () => {
    const state = { ...DEFAULT_STATE, skillsBase: { ...(DEFAULT_STATE as CharacterState).skillsBase, Handgemenge: 4 } } as CharacterState;
    const c = calculateCharacter(state);
    const erwartet = c.getSkillValue('Handgemenge') + c.currentAttributes.BEW + c.currentAttributes.STA + c.getSkillBonus('Handgemenge');
    expect(c.getAttackValue('Handgemenge', ['BEW', 'STA'])).toBe(erwartet);
    expect(c.getAttackValue('Handgemenge', [])).toBe(c.getSkillValue('Handgemenge') + c.getSkillBonus('Handgemenge'));
  });
});
