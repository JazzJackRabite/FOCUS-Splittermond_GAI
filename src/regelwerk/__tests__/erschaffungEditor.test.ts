/**
 * Erschaffung nach Regelwerk im Editor: Module eintragen/austragen (Reducer) und Regelprüfung (GRW S. 22–30).
 * Der gültige Bau entspricht dem „gültigen Gnom“ des Praxistests der Prüfsuite (ohne negative Kernressource und ohne EP).
 */
import { describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { bauAusEditor, freieErschaffungText, modulWerte, pruefeErschaffungImEditor } from '../erschaffungEditor';
import { baseCharacterReducer, DEFAULT_STATE } from '../../hooks/useCharacterState';
import type { CharacterAction, CharacterState, Mastery, Spell } from '../../types';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);
const FI = (n: string) => K.nachTyp('fertigkeit').find(e => e.name === n)!.id;
const m1 = (fert: string, nr = 0) => K.nachTyp('meisterschaft').filter(e => e.daten.fertigkeit === FI(fert) && Number(e.daten.schwelle) === 1).sort((a, b) => a.id.localeCompare(b.id))[nr];
const zb = (schule: string, grad: number, nicht: string[] = []) => K.nachTyp('zauber').sort((a, b) => a.id.localeCompare(b.id))
  .find(e => !nicht.includes(e.id) && (e.daten.schulen ?? []).some((s: { id: string; grad: number }) => s.id === FI(schule) && s.grad === grad))!;
const M = (e: ReturnType<typeof m1>, skill: string, teil: Partial<Mastery>): Mastery =>
  ({ id: e.id, name: `${e.name} (S1)`, tier: 1, cost: 0, isFree: false, isCreationBonus: false, source: 'GRW', skill, ...teil });

function lauf(s: CharacterState, ...a: CharacterAction[]) { return a.reduce((x, y) => baseCharacterReducer(x, y), s); }

function gueltigerGnom(): CharacterState {
  let s: CharacterState = {
    ...DEFAULT_STATE, mode: 'creation', race: 'Gnom', raceBonusAttrs: ['MYS'],
    attrBase: { AUS: 1, BEW: 2, INT: 2, KON: 2, MYS: 3, STA: 2, VER: 3, WIL: 3 },
    strengthsList: ['Feensinn', 'Hoher Geistiger Widerstand', 'Flink'].map(name => ({ name, level: 1, source: 'creation', isRacial: true, isFree: true, pointCost: 0 })),
    resourcesList: [], languagesList: [], masteries: {}, spellsList: [], skillsBase: {}, skillsXp: {},
  };
  s = lauf(s,
    { type: 'ERSCHAFFUNG_MODUL_SETZEN', payload: { art: 'kultur', modul: { modul: 'grw:kultur:ioria', wahl: { fertigkeiten: { '8': FI('Bannmagie') }, meisterschaft: 1 } } } },
    { type: 'ERSCHAFFUNG_MODUL_SETZEN', payload: { art: 'abstammung', modul: { modul: 'grw:abstammung:gelehrte', wahl: { ressourcen: { '0': 'grw:ressource:relikt', '1': 'grw:ressource:vermoegen' } } } } },
  );
  for (const art of ['kultur', 'abstammung'] as const) {
    const w = modulWerte(K, s.erschaffung![art]!.modul, s.erschaffung![art]!.wahl);
    expect(w.fehlend).toEqual([]);
    s = lauf(s, { type: 'ERSCHAFFUNG_MODUL_EINTRAGEN', payload: { art, werte: w.werte } });
  }
  // Ausbildung (frei) + Schritt 7 wie im Praxistest
  const plus: Record<string, number> = { Bannmagie: 5, 'Arkane Kunde': 4, Schutzmagie: 4, Erkenntnismagie: 3, Naturkunde: 3, Wahrnehmung: 3, Entschlossenheit: 3,
    Heilkunde: 3, Alchemie: 3, 'Zähigkeit': 2, Heimlichkeit: 2 };
  for (const [n, p] of Object.entries(plus)) s = lauf(s, { type: 'MOD_SKILL', payload: { key: n, delta: p } });
  s = lauf(s,
    { type: 'ADD_RESOURCE', payload: { name: 'Mentor', level: 1, source: 'creation' } },
    { type: 'ADD_RESOURCE', payload: { name: 'Relikt', level: 1, source: 'creation' } },
    { type: 'ADD_RESOURCE', payload: { name: 'Zuflucht', level: 2, source: 'creation' } },
    { type: 'ADD_STRENGTH', payload: { name: 'Erhöhter Fokuspool', level: 1, source: 'creation', pointCost: 2 } },
    { type: 'ADD_STRENGTH', payload: { name: 'Verbesserte Initiative', level: 1, source: 'creation', pointCost: 2 } },
    { type: 'ADD_STRENGTH', payload: { name: 'Zäh', level: 1, source: 'creation', pointCost: 1 } },
    { type: 'ADD_MASTERY', payload: { skill: 'Bannmagie', mastery: M(m1('Bannmagie'), 'Bannmagie', { isCreationBonus: true, source: 'Erschaffung' }) } },
    { type: 'ADD_MASTERY', payload: { skill: 'Arkane Kunde', mastery: M(m1('Arkane Kunde'), 'Arkane Kunde', { isCreationBonus: true, source: 'Erschaffung' }) } },
    { type: 'ADD_MASTERY', payload: { skill: 'Bannmagie', mastery: M(m1('Bannmagie', 1), 'Bannmagie', { isFree: true }) } },
    { type: 'ADD_MASTERY', payload: { skill: 'Arkane Kunde', mastery: M(m1('Arkane Kunde', 1), 'Arkane Kunde', { isFree: true }) } },
  );
  const bann = [0, 1, 2].map(g => zb('Bannmagie', g)); const schutz = [0, 1].map(g => zb('Schutzmagie', g, bann.map(x => x.id)));
  const erk = [0, 1].map(g => zb('Erkenntnismagie', g, [...bann, ...schutz].map(x => x.id)));
  const zauber: [typeof bann[number], string][] = [...bann.map(z => [z, 'Bannmagie'] as [typeof z, string]), ...schutz.map(z => [z, 'Schutzmagie'] as [typeof z, string]), ...erk.map(z => [z, 'Erkenntnismagie'] as [typeof z, string])];
  for (const [z, schule] of zauber) {
    const grad = z.daten.schulen.find((x: { id: string }) => x.id === FI(schule)).grad;
    s = lauf(s, { type: 'ADD_SPELL', payload: { name: z.name, school: schule, grade: grad, cost: 0, isFree: true, sourceMode: 'creation' } as Spell });
  }
  return s;
}

describe('Module eintragen und austragen', () => {
  it('trägt Ioria und Gelehrte ein und vollständig wieder aus', () => {
    const vorher: CharacterState = { ...DEFAULT_STATE, mode: 'creation', skillsBase: {}, resourcesList: [], strengthsList: [], masteries: {} };
    let s = lauf(vorher, { type: 'ERSCHAFFUNG_MODUL_SETZEN', payload: { art: 'kultur', modul: { modul: 'grw:kultur:ioria', wahl: { fertigkeiten: { '8': FI('Bannmagie') }, meisterschaft: 1 } } } });
    const w = modulWerte(K, 'grw:kultur:ioria', s.erschaffung!.kultur!.wahl).werte;
    expect(Object.values(w.fertigkeiten).reduce((a, b) => a + b, 0)).toBe(15);
    expect(w.staerke?.name).toBe('Weltgewandt');
    expect(w.meisterschaft).toEqual({ skill: 'Straßenkunde', name: 'Gerüchte aufschnappen (S1)' });
    s = lauf(s, { type: 'ERSCHAFFUNG_MODUL_EINTRAGEN', payload: { art: 'kultur', werte: w } });
    expect(s.skillsBase.Bannmagie).toBe(1);
    expect(s.skillsBase['Geschichte & Mythen']).toBe(2);
    expect(s.strengthsList.map(x => x.name)).toEqual(['Weltgewandt']);
    expect(s.masteries['Straßenkunde'].map(x => x.name)).toEqual(['Gerüchte aufschnappen (S1)']);
    // Wahl ist gesperrt, solange eingetragen
    expect(lauf(s, { type: 'ERSCHAFFUNG_MODUL_SETZEN', payload: { art: 'kultur', modul: null } })).toBe(s);
    s = lauf(s, { type: 'ERSCHAFFUNG_MODUL_AUSTRAGEN', payload: { art: 'kultur' } });
    expect(Object.values(s.skillsBase).every(v => v === 0)).toBe(true);
    expect(s.strengthsList).toEqual([]);
    expect(s.masteries['Straßenkunde']).toEqual([]);
    expect(s.erschaffung!.kultur).toEqual({ modul: 'grw:kultur:ioria', wahl: { fertigkeiten: { '8': FI('Bannmagie') }, meisterschaft: 1 } });
  });
});

describe('Regelprüfung der Erschaffung im Editor', () => {
  it('der gültige Gnom hat keine Fehler', () => {
    const s = gueltigerGnom();
    const r = pruefeErschaffungImEditor(s, K)!;
    expect(r.hinweise).toEqual([]);
    expect(r.befunde).toEqual([]);
    expect(Object.values(s.skillsBase).reduce((a, b) => a + b, 0)).toBe(55);
  });
  it('meldet überzogene Schritte und Höchstwerte', () => {
    const s = lauf(gueltigerGnom(), { type: 'MOD_SKILL', payload: { key: 'Bannmagie', delta: 1 } });
    const t = pruefeErschaffungImEditor(s, K)!.befunde.map(b => b[1]).join(' | ');
    expect(t).toContain('Schritt 7: 6 statt 5 Fertigkeitspunkte');
    expect(t).toContain('Fertigkeit Bannmagie = 7 vor Start-Erfahrung, höchstens 6');
  });
  it('findet eine regelgerechte Verteilung, wenn es eine gibt', () => {
    // Heilkunde 3 → 6 (Ausbildung +3, Schritt 7 +3): passt, wenn Heimlichkeit ganz in die Ausbildung wandert
    const s = lauf(gueltigerGnom(), { type: 'MOD_SKILL', payload: { key: 'Heilkunde', delta: 3 } }, { type: 'MOD_SKILL', payload: { key: 'Alchemie', delta: -3 } });
    expect(pruefeErschaffungImEditor(s, K)!.befunde).toEqual([]);
  });
  it('meldet Schritt 7, wenn keine Verteilung passt', () => {
    // drei Fertigkeiten je 3 Punkte über der Ausbildungsgrenze: Schritt 7 bräuchte mehr als 5 Punkte
    const s = lauf(gueltigerGnom(),
      ...(['Heilkunde', 'Wahrnehmung', 'Naturkunde'].map(key => ({ type: 'MOD_SKILL', payload: { key, delta: 3 } }) as CharacterAction)),
      ...([['Alchemie', -3], ['Entschlossenheit', -3], ['Zähigkeit', -2], ['Heimlichkeit', -1]] as const).map(([key, delta]) => ({ type: 'MOD_SKILL', payload: { key, delta } }) as CharacterAction));
    const t = pruefeErschaffungImEditor(s, K)!.befunde.map(b => b[1]).join(' | ');
    expect(t).toMatch(/Schritt 7: \d+ statt 5 Fertigkeitspunkte/);
  });
  it('freie Kultur und Abstammung: die Punkte werden regelgerecht auf die Schritte verteilt', () => {
    // 11 Fertigkeiten mit je 5 Punkten = 55 (Kultur je ≤2, Abstammung je ≤1, Ausbildung je ≤3, Schritt 7 frei)
    const namen = ['Akrobatik', 'Athletik', 'Diplomatie', 'Empathie', 'Entschlossenheit', 'Heimlichkeit', 'Jagdkunst', 'Naturkunde', 'Überleben', 'Wahrnehmung', 'Zähigkeit'];
    const s: CharacterState = { ...DEFAULT_STATE, mode: 'creation', race: 'Varg', raceBonusAttrs: ['KON'], skillsBase: Object.fromEntries(namen.map(n => [n, 5])),
      attrBase: { AUS: 2, BEW: 3, INT: 2, KON: 3, MYS: 1, STA: 3, VER: 2, WIL: 2 }, strengthsList: [], resourcesList: [], masteries: {}, spellsList: [] };
    const { verteilung } = bauAusEditor(K, s);
    const summe = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    expect([summe(verteilung.kultur), summe(verteilung.abstammung), summe(verteilung.ausbildung), summe(verteilung.schritt7)]).toEqual([15, 5, 30, 5]);
    const t = pruefeErschaffungImEditor(s, K)!.befunde.map(b => b[1]);
    expect(t.filter(x => /Fertigkeitspunkte|höchstens \+/.test(x))).toEqual([]);
  });
});

describe('Freie Erschaffung: Text aus den Kernregeln (GRW S. 23)', () => {
  it('Kultur und Abstammung', () => {
    expect(freieErschaffungText(K, 'kultur')).toBe('Frei: 15 Fertigkeitspunkte (je höchstens +2, eine Magieschule +1), 1 Stärke für 1 Punkt, 1 Meisterschaft (GRW S. 23)');
    expect(freieErschaffungText(K, 'abstammung')).toBe('Frei: 5 Fertigkeitspunkte (je höchstens +1, keine Magieschule), 4 Ressourcenpunkte (GRW S. 23)');
  });
});
