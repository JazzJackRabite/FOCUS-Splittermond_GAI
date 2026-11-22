/**
 * Wirkungen aus Stärken und Meisterschaften: „immer“ auf Fertigkeiten eingerechnet, Stärken über ihre Modifikatoren,
 * der Rest nur zur Anzeige; Wirkungen auf beschworene Wesen gehören nicht zum Charakter.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { grimoireLesen, erstelleKatalog } from '../laden';
import { setzeAktivenKatalog, wirkungenFuerCharakter } from '../bruecke';
import { fertigkeitsBoni, wirkungenDesCharakters, wirkungKurz } from '../wirkungen';
import { basisAusDateien, GRIMOIRE_ORDNER, istGrimoireDatei } from './hilfen';
import { calculateCharacter } from '../../utils/characterCalculations';
import type { CharacterState, Mastery } from '../../types';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);
const M = (name: string): Mastery => ({ id: name, name, tier: 1, cost: 15, isFree: false, isCreationBonus: false, source: 'xp' });

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

describe('Wirkungen im Katalog', () => {
  it('Einordnung: eingerechnet, dauerhaft, bedingt', () => {
    const l = wirkungenDesCharakters(K, ['grw:meisterschaft:beherrschungsmagie:einfuehlsamkeit', 'grw:staerke:hoher-geistiger-widerstand',
      'grw:meisterschaft:feuermagie:feuerresistenz-i', 'grw:staerke:feensinn', 'grw:meisterschaft:lichtmagie:ungeblendet']);
    const st = Object.fromEntries(l.map(x => [x.quelle.split(':').pop(), x.status]));
    expect(st).toEqual({ einfuehlsamkeit: 'verrechnet', 'hoher-geistiger-widerstand': 'verrechnet', 'feuerresistenz-i': 'dauerhaft', feensinn: 'bedingt', ungeblendet: 'dauerhaft' });
    expect(l.map(x => wirkungKurz(x.wirkung))).toContain('immun gegen Geblendet');
  });
  it('Meisterschaftseffekte sind kumulativ (GRW S. 92): Einfühlsamkeit + Stimmungsgespür = Empathie +4', () => {
    const l = wirkungenDesCharakters(K, ['grw:meisterschaft:beherrschungsmagie:einfuehlsamkeit', 'grw:meisterschaft:erkenntnismagie:stimmungsgespuer']);
    expect(fertigkeitsBoni(K, l)).toEqual({ Empathie: { summe: 4, quellen: [{ name: 'Einfühlsamkeit', wert: 2 }, { name: 'Stimmungsgespür', wert: 2 }] } });
  });
});

describe('Wirkungen im Editor', () => {
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => setzeAktivenKatalog(null, false));

  it('Fertigkeitsbonus im Gesamtwert, abgeleitete Werte unverändert', () => {
    const ohne = calculateCharacter(charakter({}));
    const mit = calculateCharacter(charakter({ masteries: { Beherrschungsmagie: [M('Einfühlsamkeit')] } }));
    expect(mit.getSkillBonus('Empathie')).toBe(2);
    expect(mit.getSkillTotal('Empathie')! - ohne.getSkillTotal('Empathie')!).toBe(2);
    expect(mit.getSkillValue('Empathie')).toBe(ohne.getSkillValue('Empathie'));
    expect(mit.derived).toEqual(ohne.derived);
  });
  it('Stärke Hoher Geistiger Widerstand nicht doppelt: GW +2 nur über die Modifikatoren', () => {
    const ohne = calculateCharacter(charakter({}));
    const mit = calculateCharacter(charakter({ strengthsList: [{ name: 'Hoher Geistiger Widerstand', level: 1, source: 'xp' }] }));
    expect(mit.derived.GW - ohne.derived.GW).toBe(2);
    expect(mit.wirkungen!.liste.map(x => x.status)).toEqual(['verrechnet']);
    expect(mit.wirkungen!.fertigkeitsBoni).toEqual({});
  });
  it('ohne Regelpakete keine Wirkungen', () => {
    setzeAktivenKatalog(null, false);
    const r = calculateCharacter(charakter({ masteries: { Beherrschungsmagie: [M('Einfühlsamkeit')] } }));
    expect(r.wirkungen).toBeNull();
    expect(r.getSkillBonus('Empathie')).toBe(0);
    setzeAktivenKatalog(K, false);
  });
});

/**
 * Mit allen Grimoires (lokal): Wirkungen, die einem anderen Wesen gelten (traeger „andere“, etwa beschworenen Wesen),
 * zählen nie zum Charakter. Feste Boni auf Fertigkeiten prüft nachrechnen.test.ts.
 */
const GRIMS = GRIMOIRE_ORDNER && fs.existsSync(GRIMOIRE_ORDNER) ? fs.readdirSync(GRIMOIRE_ORDNER).filter(istGrimoireDatei).sort() : [];
describe.skipIf(!GRIMS.length)('Wirkungen auf andere Wesen (alle Grimoires, lokal)', () => {
  afterAll(() => setzeAktivenKatalog(null, false));
  it.each(GRIMS)('%s', (datei) => {
    const g = grimoireLesen(fs.readFileSync(path.join(GRIMOIRE_ORDNER, datei), 'utf-8'), basis.manifest);
    const { katalog: KG } = erstelleKatalog(basis, [g]);
    setzeAktivenKatalog(KG, false);
    const falsch: string[] = [];
    for (const e of g.paket.eintraege) {
      if (e.typ !== 'meisterschaft') continue;
      const ws = (e.daten?.wirkungen_strukturiert ?? []) as { traeger?: string }[];
      if (!ws.length || ws.some(w => w.traeger !== 'andere')) continue;
      const f = KG.get(String(e.daten.fertigkeit ?? ''));
      if (f?.typ !== 'fertigkeit' || KG.get(e.id)?.name !== e.name) continue;
      const w = wirkungenFuerCharakter({ strengthsList: [], masteries: { [f.name]: [M(e.name)] } });
      if (w && w.liste.length) falsch.push(e.id);
    }
    expect(falsch).toEqual([]);
  });
});

describe('Meisterschaften auf abgeleitete Werte (dauerhaft)', () => {
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => setzeAktivenKatalog(null, false));
  it('Sprinter GSW +1, Gute Reflexe VTD +1, Blitzreflexe INI −3', () => {
    const ohne = calculateCharacter(charakter({}));
    const mit = calculateCharacter(charakter({ masteries: { Athletik: [M('Sprinter')], 'Schlösser und Fallen': [M('Gute Reflexe')], Akrobatik: [M('Blitzreflexe')] } }));
    expect(mit.derived.GSW - ohne.derived.GSW).toBe(1);
    expect(mit.derived.VTD - ohne.derived.VTD).toBe(1);
    expect(mit.derived.INI - ohne.derived.INI).toBe(-3);
    expect(Object.keys(mit.wirkungen!.werteBoni).sort()).toEqual(['GSW', 'INI', 'VTD']);
  });
  it('bedingte Werte (Ausweichen I) werden nicht eingerechnet', () => {
    const ohne = calculateCharacter(charakter({}));
    const mit = calculateCharacter(charakter({ masteries: { Akrobatik: [M('Ausweichen I')] } }));
    expect(mit.derived.VTD).toBe(ohne.derived.VTD);
    expect(mit.wirkungen!.liste.map(x => x.status)).toContain('bedingt');
  });
});
