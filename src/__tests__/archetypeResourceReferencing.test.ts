import { describe, it, expect } from 'vitest';
import { archetypen, archetypZuCharakter } from '../regelwerk/archetypen';
import { referenceCharacterResources, getMasteryDetails, getSpellDetails } from '../utils/gameResourceManager';
import type { CharacterState } from '../types';

describe('Archetype and Character Resource Referencing', () => {
  // Archetypen aus dem GRW-Paket; beim Laden löst referenceCharacterResources Seiten und Beschreibungen auf (wie im Profil-Dialog)
  const archetypZustaende = () => archetypen().map((a) => ({ name: a.name, state: referenceCharacterResources(archetypZuCharakter(a.id)!) }));
  const MAGIER = ['Arrou', 'Eshi bid-Herar', 'Keira Alvios', 'Selesha Maradoh', 'Telkin Feuerfaust', 'Tiai Schimmersee'];

  it('correctly references masteries and spells in all archetypes to GRW rulebook resources', () => {
    expect(archetypen().length).toBe(7);

    for (const preset of archetypZustaende()) {
      const state = preset.state;

      // Every preset mastery must have valid source 'GRW', page number, and non-empty description
      const masteryKeys = Object.keys(state.masteries || {});
      expect(masteryKeys.length).toBeGreaterThan(0);

      for (const skill of masteryKeys) {
        const list = state.masteries[skill];
        expect(list.length).toBeGreaterThan(0);
        for (const m of list) {
          if (m.name.startsWith('Schwerpunkt')) continue; // Schwerpunkte haben keine eigene Seite
          expect(m.source).toBe('GRW');
          expect(m.page).toBeDefined();
          expect(typeof m.page).toBe('number');
          expect(m.desc).toBeDefined();
          expect((m.desc || '').length).toBeGreaterThan(10);
          expect(m.skill).toBe(skill);
        }
      }

      // Check spells for caster archetypes (Eshi, Keira, Selesha, Telkin, Tiai)
      if (MAGIER.includes(preset.name)) {
        expect(state.spellsList.length).toBeGreaterThan(0);
        for (const s of state.spellsList) {
          expect(s.source).toBe('GRW');
          expect(s.page).toBeDefined();
          expect(typeof s.page).toBe('number');
          expect(s.description).toBeDefined();
          expect((s.description || '').length).toBeGreaterThan(10);
        }
      }
    }
  });

  it('populates advancement log with rulebook-referenced entries for starting masteries and spells', () => {
    for (const preset of archetypZustaende()) {
      const state = preset.state;
      expect(state.advancementLog).toBeDefined();
      expect(state.advancementLog!.length).toBeGreaterThan(0);

      const masteryEntries = state.advancementLog!.filter((e) => e.category === 'mastery');
      expect(masteryEntries.length).toBeGreaterThan(0);
      for (const me of masteryEntries) {
        expect(me.detail).toMatch(/Quelle: GRW, S\. \d+/);
      }

      if (MAGIER.includes(preset.name)) {
        const spellEntries = state.advancementLog!.filter((e) => e.category === 'spell');
        expect(spellEntries.length).toBeGreaterThan(0);
        for (const se of spellEntries) {
          expect(se.detail).toMatch(/Quelle: GRW, S\. \d+/);
        }
      }
    }
  });

  it('flags unreferenced/unknown resources as "unbekannt" when loading external character data', () => {
    const customState: Partial<CharacterState> = {
      name: 'Test Wanderer',
      masteries: {
        Überleben: [
          { id: 'm_valid', name: 'Geländekunde (S1)', tier: 1, cost: 0, isFree: true, isCreationBonus: true, source: 'Erschaffung' },
          { id: 'm_invalid', name: 'ErfundeneSuperMeisterschaft', tier: 2, cost: 10, isFree: false, isCreationBonus: false, source: 'Homebrew' },
        ],
      },
      spellsList: [
        { name: 'Feuerstrahl', school: 'Feuermagie', grade: 1, cost: '5V2', source: 'Erschaffung' },
        { name: 'KosmischerWeltraumLaser', school: 'Feuermagie', grade: 3, cost: '10V3', source: 'Homebrew' },
      ],
      strengthsList: [
        { name: 'Zäh', level: 1, source: 'creation', pointCost: 1 },
        { name: 'UnzerstörbarerKörper', level: 1, source: 'creation', pointCost: 5 },
      ],
      resourcesList: [
        { name: 'Kontakte', level: 2, source: 'creation', pointCost: 1 },
        { name: 'RaumschiffFlotte', level: 5, source: 'creation', pointCost: 5 },
      ],
    };

    const resolved = referenceCharacterResources(customState);

    // Valid mastery: resolved to GRW
    const validM = resolved.masteries['Überleben'].find((m) => m.name === 'Geländekunde (S1)');
    expect(validM?.source).toBe('GRW');
    expect(validM?.page).toBe(134);

    // Invalid mastery: flagged as 'unbekannt'
    const invalidM = resolved.masteries['Überleben'].find((m) => m.name === 'ErfundeneSuperMeisterschaft');
    expect(invalidM?.source).toBe('unbekannt');
    expect(invalidM?.desc).toContain('Unbekannte Meisterschaft');

    // Valid spell: resolved to GRW
    const validS = resolved.spellsList.find((s) => s.name === 'Feuerstrahl');
    expect(validS?.source).toBe('GRW');
    expect(validS?.page).toBe(228);

    // Invalid spell: flagged as 'unbekannt'
    const invalidS = resolved.spellsList.find((s) => s.name === 'KosmischerWeltraumLaser');
    expect(invalidS?.source).toBe('unbekannt');
    expect(invalidS?.description).toContain('Unbekannter Zauber');

    // Valid strength: resolved to GRW
    const validSt = resolved.strengthsList.find((st) => st.name === 'Zäh');
    expect(validSt?.sourceRef).toBe('GRW');
    expect(validSt?.page).toBe(74);

    // Invalid strength: flagged as 'unbekannt'
    const invalidSt = resolved.strengthsList.find((st) => st.name === 'UnzerstörbarerKörper');
    expect(invalidSt?.sourceRef).toBe('unbekannt');

    // Valid resource: resolved to GRW
    const validRes = resolved.resourcesList.find((r) => r.name === 'Kontakte');
    expect(validRes?.sourceRef).toBe('GRW');
    expect(validRes?.page).toBe(76);

    // Invalid resource: flagged as 'unbekannt'
    const invalidRes = resolved.resourcesList.find((r) => r.name === 'RaumschiffFlotte');
    expect(invalidRes?.sourceRef).toBe('unbekannt');
  });

  it('getMasteryDetails and getSpellDetails provide fallbacks with unknown status for nonexistent records', () => {
    const unknownMastery = getMasteryDetails('Athletik', 'FliegenWieEinVogel');
    expect(unknownMastery.source).toBe('unbekannt');
    expect(unknownMastery.page).toBeUndefined();

    const unknownSpell = getSpellDetails('HyperDimensionsSprung', 'Raumzeitmagie');
    expect(unknownSpell.source).toBe('unbekannt');
    expect(unknownSpell.page).toBeUndefined();
  });
});
