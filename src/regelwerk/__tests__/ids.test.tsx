/**
 * Charaktere mit Regel-IDs: IDs beim Speichern, Namensabgleich beim Laden, Erhalt der neuen Felder beim Neuladen und Import.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act } from 'react';
import { renderHook } from '@testing-library/react';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { regelIdsErmitteln, namenAbgleichen, type RegelIds } from '../ids';
import { mitRegelIds, setzeAktivenKatalog } from '../bruecke';
import { DEFAULT_STATE, useCharacterState } from '../../hooks/useCharacterState';
import { validateCharacterImport } from '../../utils/importValidation';
import type { CharacterState, Mastery } from '../../types';

const b = basisAusDateien();
const K = new Katalog(b.manifest, [b.basis]);
const M = (name: string): Mastery => ({ id: name, name, tier: 1, cost: 15, isFree: false, isCreationBonus: false, source: 'xp' });
const leer = (): RegelIds => ({ version: 1, pakete: {}, staerken: {}, schwaechen: {}, ressourcen: {}, meisterschaften: {}, zauber: {} });

function charakter(teil: Partial<CharacterState>): CharacterState {
  return { ...DEFAULT_STATE, race: 'Gnom', ...teil } as CharacterState;
}

describe('Regel-IDs ermitteln', () => {
  it('alle Listen mit IDs, Pakete mit Prüfsumme', () => {
    const r = regelIdsErmitteln(K, charakter({
      strengthsList: [{ name: 'Attraktivität', level: 1, source: 'xp' }], weaknessesList: [{ name: 'Angst', level: 1, source: 'xp' }],
      resourcesList: [{ name: 'Kreatur', level: 2, source: 'xp' }], masteries: { Beherrschungsmagie: [M('Einfühlsamkeit')] },
      spellsList: [{ name: 'Alarm', school: 'Schutzmagie', grade: 1, cost: '1' }],
    }));
    expect(r.rasse).toBe('grw:rasse:gnome');
    expect(r.staerken).toEqual({ 'Attraktivität': 'grw:staerke:attraktivitaet' });
    expect(r.schwaechen).toEqual({ Angst: 'grw:schwaeche:angst' });
    expect(r.ressourcen.Kreatur).toMatch(/^grw:ressource:kreatur/);
    expect(r.meisterschaften).toEqual({ 'Beherrschungsmagie|Einfühlsamkeit': 'grw:meisterschaft:beherrschungsmagie:einfuehlsamkeit' });
    expect(r.zauber).toEqual({ 'Schutzmagie|Alarm': 'grw:zauber:alarm' });
    expect(r.pakete.grw).toMatch(/^[0-9a-f]{12}$/);
  });
  it('nicht auflösbare Einträge behalten ihre frühere ID (Buch nicht geladen)', () => {
    const alt = { ...leer(), staerken: { 'Aus anderem Buch': 'magie:staerke:xyz' } };
    const r = regelIdsErmitteln(K, charakter({ strengthsList: [{ name: 'Aus anderem Buch', level: 1, source: 'xp' }], regelIds: alt }));
    expect(r.staerken).toEqual({ 'Aus anderem Buch': 'magie:staerke:xyz' });
  });
});

describe('Namensabgleich beim Laden', () => {
  afterEach(() => { delete K.alias['grw:staerke:alter-name']; });
  it('alter Name über gespeicherte ID auf den aktuellen Namen, auch über Umbenennungen', () => {
    K.alias['grw:staerke:alter-name'] = 'grw:staerke:attraktivitaet'; // wie ein Eintrag „umbenannt“ im ID-Register
    const ids = { ...leer(), staerken: { 'Schönheit': 'grw:staerke:alter-name' },
      meisterschaften: { 'Beherrschungsmagie|Mitgefühl (S1)': 'grw:meisterschaft:beherrschungsmagie:einfuehlsamkeit' },
      zauber: { 'Schutzmagie|Warnung': 'grw:zauber:alarm' } };
    const c = charakter({ regelIds: ids, strengthsList: [{ name: 'Schönheit', level: 1, source: 'xp' }, { name: 'Unbekannt', level: 1, source: 'xp' }],
      masteries: { Beherrschungsmagie: [M('Mitgefühl (S1)')] }, spellsList: [{ name: 'Warnung', school: 'Schutzmagie', grade: 1, cost: '1' }] });
    const { aenderung, umbenannt } = namenAbgleichen(K, c);
    expect(umbenannt.map(u => [u.alt, u.neu])).toEqual([['Schönheit', 'Attraktivität'], ['Mitgefühl (S1)', 'Einfühlsamkeit (S1)'], ['Warnung', 'Alarm']]);
    expect(aenderung.strengthsList!.map(s => s.name)).toEqual(['Attraktivität', 'Unbekannt']);
    expect(aenderung.masteries!.Beherrschungsmagie[0]).toMatchObject({ name: 'Einfühlsamkeit (S1)', id: 'Mitgefühl (S1)' });
  });
  it('passende Namen und falsche Typen bleiben unverändert', () => {
    const c = charakter({ regelIds: { ...leer(), staerken: { Fremd: 'grw:zauber:alarm' } },
      strengthsList: [{ name: 'Attraktivität', level: 1, source: 'xp' }, { name: 'Fremd', level: 1, source: 'xp' }] });
    expect(namenAbgleichen(K, c)).toEqual({ aenderung: {}, umbenannt: [] });
  });
});

describe('Speichern, Neuladen, Import', () => {
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => { setzeAktivenKatalog(null, false); localStorage.clear(); });

  it('mitRegelIds ergänzt nur mit Katalog', () => {
    const c = charakter({ strengthsList: [{ name: 'Attraktivität', level: 1, source: 'xp' }] });
    expect(mitRegelIds(c).regelIds?.staerken).toEqual({ 'Attraktivität': 'grw:staerke:attraktivitaet' });
    setzeAktivenKatalog(null, false);
    expect(mitRegelIds(c)).toBe(c);
    setzeAktivenKatalog(K, false);
  });

  it('gespeicherter Charakter enthält regelIds; Erschaffung, Begleiter und IDs überstehen das Neuladen', () => {
    localStorage.clear();
    const { result, unmount } = renderHook(() => useCharacterState());
    act(() => {
      result.current.dispatch({ type: 'BEGLEITER_HINZU', payload: { id: 'grw:kreatur:pferd', art: 'tier', name: 'Pferd' } });
      result.current.dispatch({ type: 'ERSCHAFFUNG_MODUL_SETZEN', payload: { art: 'kultur', modul: { modul: 'grw:kultur:ioria' } } });
    });
    const gespeichert = JSON.parse(localStorage.getItem('splittermond_char_v95')!);
    expect(gespeichert.regelIds?.rasse).toBeTruthy();
    expect(gespeichert.begleiter).toHaveLength(1);
    unmount();
    const neu = renderHook(() => useCharacterState());
    expect(neu.result.current.state.begleiter).toEqual([{ id: 'grw:kreatur:pferd', art: 'tier', name: 'Pferd' }]);
    expect(neu.result.current.state.erschaffung?.kultur?.modul).toBe('grw:kultur:ioria');
    expect(neu.result.current.state.regelIds?.version).toBe(1);
    neu.unmount();
  });

  it('Import übernimmt regelIds nur als Text-Zuordnungen', () => {
    const r = validateCharacterImport({ ...DEFAULT_STATE, regelIds: { version: 1, pakete: { grw: 'abc' }, staerken: { A: 'grw:staerke:a', B: 5 }, zauber: 'kaputt' } });
    expect(r.regelIds).toEqual({ version: 1, pakete: { grw: 'abc' }, staerken: { A: 'grw:staerke:a' }, schwaechen: {}, ressourcen: {}, meisterschaften: {}, zauber: {} });
  });
});
