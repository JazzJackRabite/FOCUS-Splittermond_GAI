/**
 * Brücke Editor ↔ Regelpakete: Zuordnung der Editor-Namen zu Katalog-IDs, abgeleitete Werte aus den Regeldaten,
 * Grimoires als Module, Voraussetzungen über den Katalog.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { grimoireLesen, erstelleKatalog } from '../laden';
import { setzeAktivenKatalog, meisterschaftId, fertigkeitId, idNachName, RASSE_ID, grimoireModule } from '../bruecke';
import { basisAusDateien } from './hilfen';
import { grwAlleFertigkeiten, grwAllgemeineKampfmeisterschaften, grwAllgemeineMagiemeisterschaften, grwMeisterschaften, grwRassen, grwRessourcen, grwStaerken } from '../grwListen';
import { calculateCharacter } from '../../utils/characterCalculations';
import { getResolvedMasteries, getResolvedSpells } from '../../utils/gameResourceManager';
import { checkMasteryPrerequisites } from '../../utils/prerequisiteValidator';
import type { CharacterState } from '../../types';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);

function charakter(teil: Partial<CharacterState>): CharacterState {
  return {
    mode: 'creation', xpTotal: 0, name: 'Test', race: 'Mensch', moonSign: '', homeRegion: '',
    attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 }, raceBonusAttrs: [],
    attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
    skillsBase: {}, skillsXp: {}, masteries: {}, strengthsList: [], resourcesList: [], weaknessesList: [], languagesList: [], spellsList: [],
    playState: { healthSlots: [], focus: { exhausted: 0, channeled: 0, consumed: 0 }, splitterPoints: 3, channeledSpells: [], dyingLevel: 0, conditions: [], tempHP: 0, tempHPUsed: 0, lpModifier: 0 },
    ...teil,
  } as CharacterState;
}

describe('Zuordnung der Editor-Namen zu Katalog-IDs', () => {
  const RACES = grwRassen(K), ALL_SKILLS = grwAlleFertigkeiten(K), STRENGTHS_DATA = grwStaerken(K), PREDEFINED_RESOURCES = grwRessourcen(K);
  const MASTERIES_DB = grwMeisterschaften(K), GENERAL_COMBAT_MASTERIES = grwAllgemeineKampfmeisterschaften(K), GENERAL_MAGIC_MASTERIES = grwAllgemeineMagiemeisterschaften(K);
  it('alle Rassen, Fertigkeiten, Stärken und Ressourcen des Editors', () => {
    expect(Object.keys(RACES).filter(r => !K.get(RASSE_ID[r]))).toEqual([]);
    expect(ALL_SKILLS.filter(s => !fertigkeitId(K, s))).toEqual([]);
    expect(STRENGTHS_DATA.map(s => s.name).filter(n => !idNachName(K, 'staerke', n))).toEqual([]);
    expect(PREDEFINED_RESOURCES.map(r => r.name).filter(n => !idNachName(K, 'ressource', n))).toEqual([]);
  });
  it('alle Meisterschaften des Editors', () => {
    const fehlt: string[] = [];
    for (const [skill, liste] of Object.entries(MASTERIES_DB)) for (const m of liste) if (!meisterschaftId(K, m.name, m.skill ?? skill)) fehlt.push(`${skill}: ${m.name}`);
    for (const m of [...GENERAL_COMBAT_MASTERIES, ...GENERAL_MAGIC_MASTERIES]) if (!meisterschaftId(K, m.name, m.skill)) fehlt.push(`${m.skill}: ${m.name}`);
    expect(fehlt).toEqual([]);
  });
});

describe('Abgeleitete Werte mit Regelpaketen', () => {
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => setzeAktivenKatalog(null, false));

  it('Gnom mit Rassenstärken wie im Praxistest (GRW S. 13–15)', () => {
    // Attribute nach Rassenmodifikatoren: AUS 2, BEW 2, INT 3, KON 2, MYS 3, STÄ 1, VER 3, WIL 3
    const c = charakter({ race: 'Gnom', attrBase: { AUS: 2, BEW: 2, INT: 3, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 3 },
      strengthsList: ['Flink', 'Hoher Geistiger Widerstand', 'Feensinn'].map(name => ({ name, level: 1, source: 'race', isRacial: true })) });
    const r = calculateCharacter(c);
    expect(r.currentAttributes).toMatchObject({ MYS: 3, VER: 3, STA: 1 });
    expect(r.regelwerk).not.toBeNull();
    expect({ ...r.derived, SP: r.splinterPoints, maxLP: r.maxLP, maxFO: r.maxFO }).toMatchObject({ GSW: 6, INI: 7, LP: 5, FO: 12, VTD: 19, GW: 20, KW: 17, SP: 3, maxLP: 5, maxFO: 12 });
    expect(r.regelwerk!.bedingt).toHaveLength(1);
  });
  it('Heldengrad 2: +2 auf VTD, GW, KW und +1 Splitterpunkt (GRW S. 88–89)', () => {
    const c0 = charakter({});
    const c2 = charakter({ xpTotal: 200, masteries: { Akrobatik: [{ id: 'm', name: 'Testkauf', tier: 1, cost: 120, isFree: false, isCreationBonus: false, source: 'xp' }] } });
    const r0 = calculateCharacter(c0); const r2 = calculateCharacter(c2);
    expect(r2.heldengrad.name).toContain('Heldengrad 2');
    expect(r2.derived.VTD - r0.derived.VTD).toBe(2);
    expect(r2.derived.GW - r0.derived.GW).toBe(2);
    expect(r2.derived.KW - r0.derived.KW).toBe(2);
    expect(r2.splinterPoints - r0.splinterPoints).toBe(1);
  });
  it('Robust und Erhöhter Fokuspool erhöhen LP und Fokus', () => {
    const r = calculateCharacter(charakter({ strengthsList: [{ name: 'Robust', level: 2, source: 'creation' }, { name: 'Erhöhter Fokuspool', level: 1, source: 'creation' }] }));
    expect(r.robustBonus).toBe(2);
    expect(r.maxLP).toBe(r.derived.LP + 2);
    expect(r.maxFO).toBe(r.derived.FO + 5);
  });
  it('Ausrüstung: VTD-Bonus bis zum Höchstbonus, Behinderung kaufmännisch gerundet (GRW S. 11, 18)', () => {
    const ohne = calculateCharacter(charakter({}));
    const mit = calculateCharacter(charakter({ ignoreEncumbrance: true, inventory: [
      { id: 'a', name: 'Platte', type: 'armor', quantity: 1, equipped: true, vtdBonus: 3, handicap: 3, sr: 3 },
      { id: 's', name: 'Schild', type: 'shield', quantity: 1, equipped: true, vtdBonus: 2, handicap: 0 },
    ] }));
    expect(mit.derived.VTD - ohne.derived.VTD).toBe(3); // 3 + 2 = 5, Höchstbonus Heldengrad 1: 3
    expect(ohne.derived.GSW - mit.derived.GSW).toBe(2); // halbe Behinderung 1,5 → 2
    expect(mit.regelwerk!.hinweise.join(' ')).toContain('Höchstbonus 3');
  });
});

describe('Hochgeladene Bücher im Editor', () => {
  const buch = {
    format: 'splittermond-regelpaket', format_version: '1.0', erzeugt: '2026-11-05', abhaengigkeiten: [],
    paket: { id: 'testbuch', titel: 'Testbuch', kuerzel: 'TB' }, statistik: { eintraege: 3 },
    eintraege: [
      { id: 'testbuch:meisterschaft:klingenwaffen:testhieb', typ: 'meisterschaft', aktion: 'neu', name: 'Testhieb', quelle: { paket: 'testbuch', buch_seiten: [7] },
        daten: { fertigkeit: 'grw:fertigkeit:klingenwaffen', schwelle: 2, manoever: true, beschreibung: 'Ein Testmanöver.',
          voraussetzungen: { text: 'Meisterschaft Testgriff', bedingung: { hat: 'testbuch:meisterschaft:klingenwaffen:testgriff' } } } },
      { id: 'testbuch:meisterschaft:klingenwaffen:testgriff', typ: 'meisterschaft', aktion: 'neu', name: 'Testgriff', quelle: { paket: 'testbuch', buch_seiten: [7] },
        daten: { fertigkeit: 'grw:fertigkeit:klingenwaffen', schwelle: 1, beschreibung: 'Ein Griff.' } },
      { id: 'testbuch:zauber:testlicht', typ: 'zauber', aktion: 'neu', name: 'Testlicht', quelle: { paket: 'testbuch', buch_seiten: [9] },
        daten: { schulen: [{ id: 'grw:fertigkeit:lichtmagie', schule: 'Licht', grad: 1 }], kosten: '4V1', zauberdauer: '2 Ticks', reichweite: 'Berührung',
          wirkungsdauer: 'kanalisiert', typus: ['Licht'], wirkung: 'Es wird hell.', erfolgsgrade: '• Verstärken' } },
    ],
    ladeinfo: { format: 'splittermond-editor-ladeinfo', format_version: '1.0', ladereihenfolge: 99, abhaengigkeiten: ['grw'], optionale_pakete: [], regelgruppen: {}, umbenannt: {}, begleiter: {},
      original: { datei: 'x', sha256: 'x', bytes: 0, eintraege: 3 } },
  };
  const { katalog } = erstelleKatalog(basis, [grimoireLesen(JSON.stringify(buch), basis.manifest)]);
  beforeAll(() => setzeAktivenKatalog(katalog, false));
  afterAll(() => setzeAktivenKatalog(null, false));

  it('Meisterschaften und Zauber erscheinen in den Auswahllisten', () => {
    expect(grimoireModule().map(m => m.shortName)).toEqual(['TB']);
    const m = getResolvedMasteries('Klingenwaffen').find(x => x.name === 'Testhieb (S2)');
    expect(m).toMatchObject({ tier: 2, source: 'TB', page: 7, manoever: true, id: 'testbuch:meisterschaft:klingenwaffen:testhieb' });
    const z = getResolvedSpells('Lichtmagie').find(x => x.name === 'Testlicht');
    expect(z).toMatchObject({ grade: 1, cost: '4V1', castTime: '2 Ticks', source: 'TB', page: 9 });
  });
  it('Voraussetzungen werden über den Katalog geprüft', () => {
    const m = getResolvedMasteries('Klingenwaffen').find(x => x.name === 'Testhieb (S2)')!;
    const ohne = checkMasteryPrerequisites(m, 'Klingenwaffen', 9, { allCharacterMasteries: [], skills: { Klingenwaffen: 9 }, mode: 'xp' });
    expect(ohne.prerequisitesMet).toBe(false);
    expect(ohne.missingPrerequisites).toEqual(['Meisterschaft Testgriff']);
    const mit = checkMasteryPrerequisites(m, 'Klingenwaffen', 9, { allCharacterMasteries: [{ id: '1', name: 'Testgriff (S1)', tier: 1, cost: 0, isFree: false, isCreationBonus: false, source: 'TB', skill: 'Klingenwaffen' }], skills: { Klingenwaffen: 9 }, mode: 'xp' });
    expect(mit.canLearn).toBe(true);
  });
  it('GRW-Meisterschaften: formale Voraussetzungen statt Textvergleich', () => {
    // jede GRW-Meisterschaft mit Bedingung „hat <Meisterschaft>“: ohne die Meisterschaft nicht erfüllt, mit ihr erfüllt
    let geprueft = 0;
    for (const e of K.nachTyp('meisterschaft')) {
      const b = e.daten.voraussetzungen?.bedingung;
      if (!b || !('hat' in b) || b.bezug || !String(b.hat).includes(':meisterschaft:')) continue;
      const ziel = K.get(b.hat)!; const fName = K.get(ziel.daten.fertigkeit)?.name ?? '';
      const eintrag = { name: `${e.name} (S${e.daten.schwelle})`, source: 'GRW', skill: K.get(e.daten.fertigkeit)?.name, id: e.id, tier: Number(e.daten.schwelle) };
      const ohne = checkMasteryPrerequisites(eintrag, eintrag.skill ?? '', 15, { allCharacterMasteries: [], skills: {}, mode: 'xp' });
      const mit = checkMasteryPrerequisites(eintrag, eintrag.skill ?? '', 15, { allCharacterMasteries: [{ id: 'x', name: `${ziel.name} (S${ziel.daten.schwelle})`, tier: 1, cost: 0, isFree: false, isCreationBonus: false, source: 'GRW', skill: fName }], skills: {}, mode: 'xp' });
      expect([e.id, ohne.prerequisitesMet, mit.prerequisitesMet]).toEqual([e.id, false, true]);
      geprueft++;
    }
    expect(geprueft).toBeGreaterThan(20);
  });
});
