import { Katalog } from '../regelwerk/katalog';
import { setzeAktivenKatalog } from '../regelwerk/bruecke';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';
import { describe, it, expect } from 'vitest';
import {
  checkMasteryPrerequisites,
  normalizeMasteryName,
  getMasteryTier,
  getRequiredSkillValue,
} from '../utils/prerequisiteValidator';
import { grwAllgemeineKampfmeisterschaften, grwAllgemeineMagiemeisterschaften, grwMeisterschaften } from '../regelwerk/grwListen';
const MASTERIES_DB = grwMeisterschaften();
const GENERAL_COMBAT_MASTERIES = grwAllgemeineKampfmeisterschaften();
const GENERAL_MAGIC_MASTERIES = grwAllgemeineMagiemeisterschaften();

describe('prerequisiteValidator - Thresholds & Prerequisites', () => {
  it('normalizes mastery names by stripping (S1), (S2), etc.', () => {
    expect(normalizeMasteryName('Ausweichen I (S1)')).toBe('Ausweichen I');
    expect(normalizeMasteryName('Ausweichen II (S2)')).toBe('Ausweichen II');
    expect(normalizeMasteryName('Abdrängen')).toBe('Abdrängen');
  });

  it('calculates correct required skill values for thresholds S1-S4', () => {
    expect(getRequiredSkillValue(1)).toBe(6);
    expect(getRequiredSkillValue(2)).toBe(9);
    expect(getRequiredSkillValue(3)).toBe(12);
    expect(getRequiredSkillValue(4)).toBe(15);
  });

  it('enforces Schwellenvoraussetzung (threshold requirements) in creation mode', () => {
    // Akrobatik S1 (Antäuschen I)
    const s1Mastery = MASTERIES_DB['Akrobatik'].find((m) => m.name.startsWith('Antäuschen I'))!;
    expect(s1Mastery).toBeDefined();

    // Akrobatik S2 (Ausweichen II)
    const s2Mastery = MASTERIES_DB['Akrobatik'].find((m) => m.name.startsWith('Ausweichen II'))!;
    expect(s2Mastery).toBeDefined();

    // At creation: S1 with skill 6 should pass threshold
    const resS1Pass = checkMasteryPrerequisites(s1Mastery, 'Akrobatik', 6, {
      allCharacterMasteries: [],
      skills: { Akrobatik: 6 },
      mode: 'creation',
    });
    expect(resS1Pass.thresholdMet).toBe(true);

    // At creation: S1 with skill 3 and NO creation budget should fail threshold
    const resS1Fail = checkMasteryPrerequisites(s1Mastery, 'Akrobatik', 3, {
      allCharacterMasteries: [],
      skills: { Akrobatik: 3 },
      mode: 'creation',
      creationBudget: 0,
    });
    expect(resS1Fail.thresholdMet).toBe(false);

    // At creation: S1 with skill 3 and creation bonus slot should pass
    const resS1Bonus = checkMasteryPrerequisites(s1Mastery, 'Akrobatik', 3, {
      allCharacterMasteries: [],
      skills: { Akrobatik: 3 },
      mode: 'creation',
      creationBudget: 1,
      isCreationBonus: true,
    });
    expect(resS1Bonus.thresholdMet).toBe(true);

    // At creation: S2 should ALWAYS fail threshold because creation max skill is 6 and S2 requires 9
    const resS2Creation = checkMasteryPrerequisites(s2Mastery, 'Akrobatik', 6, {
      allCharacterMasteries: [{ name: 'Ausweichen I (S1)' } as any],
      skills: { Akrobatik: 6 },
      mode: 'creation',
      creationBudget: 2,
    });
    expect(resS2Creation.thresholdMet).toBe(false);
    expect(resS2Creation.canLearn).toBe(false);
    expect(resS2Creation.thresholdReason).toContain('In der Heldenerstellung können nur Schwelle-1-Meisterschaften gewählt werden');
  });

  it('enforces Schwellenvoraussetzung in XP mode', () => {
    const s2Mastery = MASTERIES_DB['Akrobatik'].find((m) => m.name.startsWith('Ausweichen II'))!;

    // In XP mode with skillVal 6 (< 9), threshold fails
    const resXpFail = checkMasteryPrerequisites(s2Mastery, 'Akrobatik', 6, {
      allCharacterMasteries: [{ name: 'Ausweichen I (S1)' } as any],
      skills: { Akrobatik: 6 },
      mode: 'xp',
    });
    expect(resXpFail.thresholdMet).toBe(false);
    expect(resXpFail.thresholdReason).toContain('Schwelle 2 erfordert Fertigkeitswert 9 (aktuell: 6)');

    // In XP mode with skillVal 9 and Ausweichen I present, passes!
    const resXpPass = checkMasteryPrerequisites(s2Mastery, 'Akrobatik', 9, {
      allCharacterMasteries: [{ name: 'Ausweichen I (S1)' } as any],
      skills: { Akrobatik: 9 },
      mode: 'xp',
    });
    expect(resXpPass.thresholdMet).toBe(true);
    expect(resXpPass.prerequisitesMet).toBe(true);
    expect(resXpPass.canLearn).toBe(true);
  });

  it('enforces mastery prerequisites chain (Ausweichen I -> Ausweichen II -> Ausweichen III)', () => {
    const s2Mastery = MASTERIES_DB['Akrobatik'].find((m) => m.name.startsWith('Ausweichen II'))!;
    const s3Mastery = MASTERIES_DB['Akrobatik'].find((m) => m.name.startsWith('Ausweichen III'))!;

    // Skill is 12, but player doesn't have Ausweichen I
    const resMissing1 = checkMasteryPrerequisites(s2Mastery, 'Akrobatik', 12, {
      allCharacterMasteries: [],
      skills: { Akrobatik: 12 },
      mode: 'xp',
    });
    expect(resMissing1.thresholdMet).toBe(true);
    expect(resMissing1.prerequisitesMet).toBe(false);
    expect(resMissing1.canLearn).toBe(false);
    expect(resMissing1.missingPrerequisites).toContain('Meisterschaft Ausweichen I');

    // Player has Ausweichen I, now Ausweichen II passes
    const resHave1 = checkMasteryPrerequisites(s2Mastery, 'Akrobatik', 12, {
      allCharacterMasteries: [{ name: 'Ausweichen I (S1)' } as any],
      skills: { Akrobatik: 12 },
      mode: 'xp',
    });
    expect(resHave1.canLearn).toBe(true);

    // But Ausweichen III requires Ausweichen II
    const resS3Without2 = checkMasteryPrerequisites(s3Mastery, 'Akrobatik', 12, {
      allCharacterMasteries: [{ name: 'Ausweichen I (S1)' } as any],
      skills: { Akrobatik: 12 },
      mode: 'xp',
    });
    expect(resS3Without2.canLearn).toBe(false);
    expect(resS3Without2.missingPrerequisites).toContain('Meisterschaft Ausweichen II');

    // Once Ausweichen II is added, Ausweichen III passes
    const resS3With2 = checkMasteryPrerequisites(s3Mastery, 'Akrobatik', 12, {
      allCharacterMasteries: [
        { name: 'Ausweichen I (S1)' } as any,
        { name: 'Ausweichen II (S2)' } as any,
      ],
      skills: { Akrobatik: 12 },
      mode: 'xp',
    });
    expect(resS3With2.canLearn).toBe(true);
  });

  it('enforces multi-condition prerequisites with skills and masteries (Apnoe)', () => {
    const apnoe = MASTERIES_DB['Schwimmen'].find((m) => m.name.startsWith('Apnoe'))!;
    expect(apnoe).toBeDefined();

    // Apnoe requires Langstreckenschwimmer + Meerestaucher + Zähigkeit 6
    const resMissingAll = checkMasteryPrerequisites(apnoe, 'Schwimmen', 12, {
      allCharacterMasteries: [],
      skills: { Schwimmen: 12, Zähigkeit: 3 },
      mode: 'xp',
    });
    expect(resMissingAll.canLearn).toBe(false);

    const resHaveMasteriesOnly = checkMasteryPrerequisites(apnoe, 'Schwimmen', 12, {
      allCharacterMasteries: [
        { name: 'Langstreckenschwimmer (S1)' } as any,
        { name: 'Meerestaucher (S2)' } as any,
      ],
      skills: { Schwimmen: 12, Zähigkeit: 4 },
      mode: 'xp',
    });
    expect(resHaveMasteriesOnly.canLearn).toBe(false);
    expect(resHaveMasteriesOnly.missingPrerequisites[0]).toContain('Fertigkeitspunkte Zähigkeit 6');

    const resPass = checkMasteryPrerequisites(apnoe, 'Schwimmen', 12, {
      allCharacterMasteries: [
        { name: 'Langstreckenschwimmer (S1)' } as any,
        { name: 'Meerestaucher (S2)' } as any,
      ],
      skills: { Schwimmen: 12, Zähigkeit: 6 },
      mode: 'xp',
    });
    expect(resPass.canLearn).toBe(true);
  });

  it('enforces resource prerequisites (Investor)', () => {
    // Investor in Diplomatie requires Kontakte 3
    const investor = MASTERIES_DB['Diplomatie']?.find((m) => m.name.startsWith('Investor'))
      || Object.values(MASTERIES_DB).flat().find((m) => m.name.startsWith('Investor'))!;
    expect(investor).toBeDefined();

    const resNoKontakte = checkMasteryPrerequisites(investor, investor.skill || 'Diplomatie', 12, {
      allCharacterMasteries: [],
      skills: { [investor.skill || 'Diplomatie']: 12 },
      resources: [{ name: 'Kontakte', level: 2 }],
      mode: 'xp',
    });
    expect(resNoKontakte.canLearn).toBe(false);
    expect(resNoKontakte.missingPrerequisites[0]).toContain('Ressource Kontakte 3');

    const resHaveKontakte = checkMasteryPrerequisites(investor, investor.skill || 'Diplomatie', 12, {
      allCharacterMasteries: [],
      skills: { [investor.skill || 'Diplomatie']: 12 },
      resources: [{ name: 'Kontakte', level: 3 }],
      mode: 'xp',
    });
    expect(resHaveKontakte.canLearn).toBe(true);
  });

  it('enforces OR conditions (Wisst Ihr überhaupt, wer ich bin?)', () => {
    // Requires Stand 3 ODER Redegewandtheit 12
    const mastery = Object.values(MASTERIES_DB).flat().find((m) => m.name.includes('Wisst Ihr überhaupt'))!;
    expect(mastery).toBeDefined();

    // Neither met
    const resFail = checkMasteryPrerequisites(mastery, mastery.skill || 'Diplomatie', 12, {
      allCharacterMasteries: [],
      skills: { [mastery.skill || 'Diplomatie']: 12, Redegewandtheit: 8 },
      resources: [{ name: 'Stand', level: 1 }],
      mode: 'xp',
    });
    expect(resFail.canLearn).toBe(false);

    // Stand 3 met
    const resStandPass = checkMasteryPrerequisites(mastery, mastery.skill || 'Diplomatie', 12, {
      allCharacterMasteries: [],
      skills: { [mastery.skill || 'Diplomatie']: 12, Redegewandtheit: 8 },
      resources: [{ name: 'Stand', level: 3 }],
      mode: 'xp',
    });
    expect(resStandPass.canLearn).toBe(true);

    // Redegewandtheit 12 met
    const resRedePass = checkMasteryPrerequisites(mastery, mastery.skill || 'Diplomatie', 12, {
      allCharacterMasteries: [],
      skills: { [mastery.skill || 'Diplomatie']: 12, Redegewandtheit: 12 },
      resources: [{ name: 'Stand', level: 0 }],
      mode: 'xp',
    });
    expect(resRedePass.canLearn).toBe(true);
  });

  it('enforces same magic school prerequisites (Wunderwirker & Nichts passiert!)', () => {
    const wunderwirker = GENERAL_MAGIC_MASTERIES.find((m) => m.name.startsWith('Wunderwirker'))!;
    expect(wunderwirker).toBeDefined();

    // Without Zauberfinger in Feuermagie, cannot learn Wunderwirker for Feuermagie
    const resNoSchool = checkMasteryPrerequisites(wunderwirker, 'Feuermagie', 9, {
      allCharacterMasteries: [{ name: 'Zauberfinger (S1)', skill: 'Wassermagie' } as any],
      skills: { Feuermagie: 9, Wassermagie: 9 },
      mode: 'xp',
    });
    expect(resNoSchool.canLearn).toBe(false);

    // With Zauberfinger in Feuermagie, passes!
    const resSchoolPass = checkMasteryPrerequisites(wunderwirker, 'Feuermagie', 9, {
      allCharacterMasteries: [{ name: 'Zauberfinger (S1)', skill: 'Feuermagie' } as any],
      skills: { Feuermagie: 9 },
      mode: 'xp',
    });
    expect(resSchoolPass.canLearn).toBe(true);
  });

  it('enforces focus prerequisites (Abhärtung durch Gewöhnung requires Schwerpunkt Gifte)', () => {
    const abhaertung = MASTERIES_DB['Alchemie'].find((m) => m.name.startsWith('Abhärtung durch Gewöhnung'))!;
    expect(abhaertung).toBeDefined();

    // Without focus
    const resNoFocus = checkMasteryPrerequisites(abhaertung, 'Alchemie', 12, {
      allCharacterMasteries: [],
      skills: { Alchemie: 12 },
      mode: 'xp',
    });
    expect(resNoFocus.canLearn).toBe(false);

    // With focus in userNote or mastery name
    const resFocusPass = checkMasteryPrerequisites(abhaertung, 'Alchemie', 12, {
      allCharacterMasteries: [{ name: 'Schwerpunkt', skill: 'Alchemie', userNote: 'Gifte' } as any],
      skills: { Alchemie: 12 },
      mode: 'xp',
    });
    expect(resFocusPass.canLearn).toBe(true);
  });

  // Voraussetzungen einzelner Meisterschaften stehen formal im Paket, nicht mehr nach Namen im Code
  it('enforces spell-based prerequisites (Freiheit der Form)', () => {
    const b = basisAusDateien(); setzeAktivenKatalog(new Katalog(b.manifest, [b.basis]), false);
    try { pruefeFreiheit(); } finally { setzeAktivenKatalog(null, false); }
  });
  const pruefeFreiheit = () => {
    const freiheit = MASTERIES_DB['Verwandlungsmagie'].find((m) => m.name.startsWith('Freiheit der Form'))!;
    expect(freiheit).toBeDefined();

    // Missing spell
    const resNoSpell = checkMasteryPrerequisites(freiheit, 'Verwandlungsmagie', 6, {
      allCharacterMasteries: [{ name: 'Bevorzugte Gestalt (S1)' } as any],
      spells: [{ name: 'Flammenstrahl' }],
      skills: { Verwandlungsmagie: 6 },
      mode: 'xp',
    });
    expect(resNoSpell.canLearn).toBe(false);

    // Has Kleintierform spell
    const resSpellPass = checkMasteryPrerequisites(freiheit, 'Verwandlungsmagie', 6, {
      allCharacterMasteries: [{ name: 'Bevorzugte Gestalt (S1)' } as any],
      spells: [{ name: 'Kleintierform' }],
      skills: { Verwandlungsmagie: 6 },
      mode: 'xp',
    });
    expect(resSpellPass.canLearn).toBe(true);
  };
});
