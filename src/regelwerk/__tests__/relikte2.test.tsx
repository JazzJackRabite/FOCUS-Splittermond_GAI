/**
 * Relikte, Stufe 2: Wertänderungen am Gegenstand, GW/KW aus Relikten im Besitz (nur der höchste Bonus, GRW S. 254),
 * Zauberverankerung als Zauber mit Probe auf Arkane Kunde (GRW S. 255), Sperre bei Regelverstoß (Grundsatz 7).
 */
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Katalog } from '../katalog';
import { basisAusDateien, grimoireDatei } from './hilfen';
import { setzeAktivenKatalog } from '../bruecke';
import { alleAusruestung } from '../ausruestung';
import {
  bausteineAktiv, reliktAlsInventar, reliktAenderungen, veralteteReliktEintraege, reliktBausteine, reliktWerte, reliktWiderstand, reliktZauber, pruefeRelikt, reliktBaukasten,
  type BausteinInfo,
} from '../relikte';
import { calculateCharacter } from '../../utils/characterCalculations';
import { baseCharacterReducer, DEFAULT_STATE } from '../../hooks/useCharacterState';
import { CharacterContext } from '../../context/CharacterContext';
import { ReliktKarte } from '../../components/relikte/ReliktKarte';
import { setzeHausregeln } from '../../fundament/hausregeln';
import type { CharacterState, Relikt } from '../../types';

const b = basisAusDateien();
const K = new Katalog(b.manifest, [b.basis]);
vi.mock('../RegelwerkContext', () => ({ useRegelwerk: () => ({ katalog: K }) }));

const bs = reliktBausteine(K);
const relikt = (x: Partial<Relikt>): Relikt => ({ id: 'r1', name: 'Test', punkte: 6, art: 'nahkampfwaffe', bausteine: [], inventarId: 'i1', ...x });
const aus = alleAusruestung(K);
const langschwert = aus.find(i => i.name === 'Langschwert' && i.type === 'weapon')!;
const ruestung = aus.find(i => i.type === 'armor' && (i as { sr?: number }).sr! >= 2 && (i as { handicap?: number }).handicap! >= 1)!;

/** Baustein nur für den Test (Merkmal-Änderungen kommen in den Erweiterungen vor) */
const test = (id: string, x: Partial<BausteinInfo>): BausteinInfo => ({ id, typ: 'verbesserung', name: id, kosten: 1, maxAnzahl: 1, giltFuer: ['alle'],
  aenderungen: [], quelle: 'Test', beschreibung: '', ...x });

describe('Wertänderungen am Gegenstand (daten.baustein.aenderungen)', () => {
  it('GRW-Verbesserungen auf einer Waffe: Schaden, WGS', () => {
    const r = relikt({ basisId: langschwert.id, bausteine: [
      { id: 'grw:verbesserung:waffenschaden-1', anzahl: 2 }, { id: 'grw:verbesserung:waffengeschwindigkeit-1', anzahl: 1 }] });
    const w = reliktWerte(r, bs, langschwert);
    expect(w.item).toEqual(expect.objectContaining({ damage: '1W6+6', wgs: 7, attributes: 'Scharf 2', weight: 2 }));
    expect(w.zeilen).toEqual(['Schaden 1W6+4 → 1W6+6', 'WGS 8 → 7']);
  });

  it('GRW-Verbesserungen auf einer Rüstung: SR, Behinderung, Tick-Zuschlag, Last nicht unter die Hälfte', () => {
    const r = relikt({ art: 'ruestung', basisId: ruestung.id, bausteine: [
      { id: 'grw:verbesserung:schadensreduktion-1', anzahl: 1 }, { id: 'grw:verbesserung:behinderung-1', anzahl: 1 },
      { id: 'grw:verbesserung:last-1', anzahl: 9 }] });
    const a = ruestung as unknown as { sr: number; handicap: number; load: number };
    const it = reliktAlsInventar(r, bs, ruestung);
    expect(it.sr).toBe(a.sr + 1);
    expect(it.handicap).toBe(a.handicap - 1);
    expect(it.weight).toBe(Math.ceil(Number(a.load) / 2));
    expect(it.type).toBe('armor');
  });

  it('Merkmale: neu, erhöhen, Mindestwert, Höchstwert je Schadenswürfel, entfernen, Wahl einer Variante', () => {
    const extra = [
      test('x:schaerfe', { aenderungen: [{ feld: 'merkmal', merkmal: 'Scharf', wert: 1, mindestens: 2, hoechstens_nach_schadenswuerfel: { W6: 3, W10: 5 } }] }),
      test('x:kritisch', { aenderungen: [{ feld: 'merkmal', merkmal: 'Kritisch', wert: 2 }] }),
      test('x:primitiv', { aenderungen: [{ feld: 'merkmal_entfernen', merkmal: 'Scharf' }] }),
      test('x:stand', { aenderungen: [{ feld: 'merkmal', merkmal: 'Standfestigkeit' }], aenderungenWahl: [[{ feld: 'tick_zuschlag', wert: 1 }], [{ feld: 'behinderung', wert: 1 }]] }),
    ];
    const B = [...bs, ...extra];
    const w = reliktWerte(relikt({ bausteine: [{ id: 'x:schaerfe', anzahl: 1 }, { id: 'x:kritisch', anzahl: 1 }] }), B, langschwert);
    expect(w.item.attributes).toBe('Scharf 3, Kritisch 2');
    expect(w.ueberHoechstwert).toEqual([]);
    // Scharf 3 auf W6 + 1 → über dem Höchstwert 3
    const w3 = reliktWerte(relikt({ bausteine: [{ id: 'x:schaerfe', anzahl: 2 }] }), B, langschwert);
    expect(w3.item.attributes).toBe('Scharf 3');
    expect(w3.ueberHoechstwert[0]).toMatch(/Scharf höchstens 3 bei W6-Waffen/);
    expect(reliktWerte(relikt({ bausteine: [{ id: 'x:primitiv', anzahl: 1 }] }), B, langschwert).item.attributes).toBe('–');
    // Wahl: Index 1 = Behinderung +1; ohne Wahl warnt die Prüfung
    const r = relikt({ art: 'ruestung', bausteine: [{ id: 'x:stand', anzahl: 1, auswahl: '1' }] });
    expect(reliktAenderungen(r, B).map(x => x.a.feld)).toEqual(['merkmal', 'behinderung']);
    expect(reliktWerte(r, B, ruestung).item.handicap).toBe((ruestung as unknown as { handicap: number }).handicap + 1);
    expect(pruefeRelikt(relikt({ art: 'ruestung', bausteine: [{ id: 'x:stand', anzahl: 1 }] }), B, reliktBaukasten(K)).warnungen.join()).toMatch(/Wahl fehlt \(Tick-Zuschlag \+1 oder Behinderung \+1\)/);
  });
});

describe('GW/KW aus Relikten im Besitz (GRW S. 254)', () => {
  const gw = (n: number, id = 'r', inv = `i-${id}`): Relikt => relikt({ id, name: id, inventarId: inv, bausteine: [{ id: 'grw:artefaktwirkung:verbesserter-widerstand-geistig', anzahl: n }] });

  it('je Relikt Summe, über mehrere Relikte nur der höchste Bonus; nur im Besitz', () => {
    const rel = [gw(1, 'a'), gw(2, 'b'), relikt({ id: 'c', name: 'c', inventarId: 'i-c', bausteine: [{ id: 'grw:artefaktwirkung:verbesserter-widerstand-koerperlich', anzahl: 1 }] })];
    expect(reliktWiderstand(rel, [{ id: 'i-a' }, { id: 'i-b' }, { id: 'i-c' }], bs)).toEqual({
      GW: { summe: 2, quellen: [{ name: 'b', wert: 2 }] }, KW: { summe: 1, quellen: [{ name: 'c', wert: 1 }] } });
    expect(reliktWiderstand(rel, [{ id: 'i-a' }], bs)).toEqual({ GW: { summe: 1, quellen: [{ name: 'a', wert: 1 }] } });
  });

  describe('im Charakter', () => {
    beforeAll(() => setzeAktivenKatalog(K, false));
    afterAll(() => setzeAktivenKatalog(null, false));
    const charakter = (teil: Partial<CharacterState>) => ({ ...DEFAULT_STATE, ...teil }) as CharacterState;
    it('GW steigt um den höchsten Bonus, ohne Inventareintrag nicht', () => {
      const ohne = calculateCharacter(charakter({}));
      const rel = [gw(1, 'a'), gw(3, 'b')];
      const mit = calculateCharacter(charakter({ relikte: rel, inventory: [{ id: 'i-a', name: 'a', type: 'gear', quantity: 1 }, { id: 'i-b', name: 'b', type: 'gear', quantity: 1 }] }));
      expect(mit.derived.GW - ohne.derived.GW).toBe(3);
      expect(mit.derived.KW).toBe(ohne.derived.KW);
      expect(calculateCharacter(charakter({ relikte: rel, inventory: [] })).derived.GW).toBe(ohne.derived.GW);
      expect(bausteineAktiv()).toBe(bausteineAktiv());
    });
  });
});

describe('Zauberverankerung (GRW S. 255)', () => {
  const zauber = K.nachTyp('zauber').find(z => (z.daten.schulen as Array<{ grad: number }>).some(s => s.grad === 1))!;
  const r = relikt({ name: 'Amulett', art: 'gegenstand', bausteine: [{ id: 'grw:artefaktwirkung:zauberverankerung', anzahl: 1, grad: 1, auswahl: zauber.id }] });

  it('Relikt im Besitz liefert den Zauber mit Probe auf Arkane Kunde und den Werten aus dem Paket', () => {
    const [z] = reliktZauber(K, [r], [{ id: 'i1' }], bs);
    expect(z.spell).toEqual(expect.objectContaining({ name: zauber.name, grade: 1, probeFertigkeit: 'Arkane Kunde', ausRelikt: 'Amulett',
      cost: String(zauber.daten.kosten), source: 'GRW' }));
    expect(z.ausloesung).toEqual(expect.objectContaining({ probe: 'einfach', schwierigkeit: 'zauber', voraussetzung: 'in_der_hand' }));
    expect(reliktZauber(K, [r], [], bs)).toEqual([]);
  });

  it('Inventarbeschreibung nennt den Zauber mit Namen, nicht mit ID', () => {
    expect(reliktAlsInventar(r, bs, null, undefined, K).desc).toContain(`Zauberverankerung (Grad 1, ${zauber.name})`);
  });
});

describe('Werkstatt: Sperre bei Regelverstoß, mit Hausregeln Warnung (Grundsatz 7)', () => {
  afterEach(() => setzeHausregeln(false));
  const Rahmen: React.FC = () => {
    const [state, dispatch] = React.useReducer(baseCharacterReducer, { ...DEFAULT_STATE, resourcesList: [{ name: 'Relikt', level: 2, source: 'test' }] });
    return <CharacterContext.Provider value={{ state, dispatch, calc: {} as never }}><ReliktKarte /><div data-testid="inv">{(state.inventory ?? []).map(i => `${i.name}:${i.damage ?? ''}`).join('|')}</div></CharacterContext.Provider>;
  };
  const bauen = () => {
    render(<Rahmen />);
    fireEvent.click(screen.getByRole('button', { name: /Relikt bauen/ }));
    const dlg = screen.getByRole('dialog', { name: 'Relikt-Werkstatt' });
    fireEvent.change(within(dlg).getByLabelText('Grundgegenstand'), { target: { value: 'Langschw' } });
    fireEvent.click(within(dlg).getByRole('button', { name: /^Langschwert/ }));
    fireEvent.change(within(dlg).getByLabelText('Punkte des Relikts'), { target: { value: '3' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Waffenschaden +1 hinzufügen' }));
    return dlg;
  };

  it('mehr Punkte als die Ressource: gesperrt; Werte-Vorschau zeigt den neuen Schaden', () => {
    const dlg = bauen();
    expect(within(dlg).getByTestId('relikt-werte').textContent).toContain('Schaden 1W6+4 → 1W6+5');
    expect(within(dlg).getByTestId('relikt-pruefung').textContent).toMatch(/3 Punkte, aus der Ressource Relikt sind noch 2 frei/);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Relikt speichern' }));
    expect(screen.getByRole('dialog', { name: 'Relikt-Werkstatt' })).toBeTruthy();
    expect(screen.getByTestId('inv').textContent).toBe('');
  });

  it('mit Hausregeln wird gespeichert, der Inventareintrag hat den verbesserten Schaden', () => {
    setzeHausregeln(true);
    const dlg = bauen();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Relikt speichern' }));
    expect(screen.queryByRole('dialog', { name: 'Relikt-Werkstatt' })).toBeNull();
    expect(screen.getByTestId('inv').textContent).toBe('Langschwert:1W6+5');
  });
});

describe('Abgleich alter Relikte (vor Stand 21 gebaut)', () => {
  it('trägt die Werte nach, wenn der Inventareintrag noch die Grundwerte hat; sonst nichts', () => {
    const r = relikt({ basisId: langschwert.id, bausteine: [{ id: 'grw:verbesserung:waffenschaden-1', anzahl: 2 }] });
    const aktuell = reliktAlsInventar(r, bs, langschwert, undefined, K);
    const alt = { ...aktuell, damage: '1W6+4', desc: 'alt', equipped: true };
    const neu = veralteteReliktEintraege([r], [alt], bs, K);
    expect(neu).toHaveLength(1);
    expect(neu[0].damage).toBe('1W6+6');
    expect(neu[0].equipped).toBe(true);
    expect(veralteteReliktEintraege([r], [aktuell], bs, K)).toHaveLength(0);
    expect(veralteteReliktEintraege([r], [], bs, K)).toHaveLength(0);
  });
});
