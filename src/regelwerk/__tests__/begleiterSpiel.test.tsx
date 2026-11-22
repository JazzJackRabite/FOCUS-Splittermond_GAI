/**
 * Begleiter im Spiel: Gesundheitsstufen nach Merkmalen, Lebenspunkte/Fokus, Würfelknöpfe mit den üblichen Modalen.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { baseCharacterReducer, DEFAULT_STATE } from '../../hooks/useCharacterState';
import { CharacterContext } from '../../context/CharacterContext';
import { BegleiterView } from '../../features/begleiter/BegleiterView';
import { validateCharacterImport } from '../../utils/importValidation';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { setzeAktivenKatalog } from '../bruecke';
import { betaeubungsimmun, fokusFrei, gesundheitsfelder, gesundheitsstufen, lebenslage, schadenEintragen } from '../vitals';
import { wirfFormel } from '../../components/begleiter/BegleiterSpiel';
import { fertigkeitenAusText } from '../../components/begleiter/Wertekasten';
import { gefolgeWerte } from '../gefolge';
import type { CharacterState } from '../../types';

const b = basisAusDateien(); const K = new Katalog(b.manifest, [b.basis]);
setzeAktivenKatalog(K, false);
vi.mock('../RegelwerkContext', () => ({ useRegelwerk: () => ({ katalog: K }) }));

describe('Lebenspunkte und Fokus', () => {
  it('Gesundheitsstufen aus den Daten; Schwächlich 3, Zerbrechlich 1 (aus der Merkmalsbeschreibung)', () => {
    expect(gesundheitsstufen(K).stufen.map(s => s.wundabzug)).toEqual([0, -1, -2, -4, -8]);
    const sw = gesundheitsstufen(K, ['Dunkelsicht', 'Schwächlich']);
    expect(sw).toEqual({ stufen: [{ name: 'Unverletzt', wundabzug: 0 }, { name: 'Verletzt', wundabzug: -2 }, { name: 'Todgeweiht', wundabzug: -8 }], quelle: 'Schwächlich' });
    expect(gesundheitsstufen(K, ['Zerbrechlich']).stufen.map(s => s.name)).toEqual(['Unverletzt']);
    expect(betaeubungsimmun(K, ['Betäubungsimmunität'])).toBe(true);
    expect(betaeubungsimmun(K, ['Dunkelsicht'])).toBe(false);
  });
  it('Wundabzug nur aus echtem Schaden; Stufe des letzten verlorenen LP (wie beim Abenteurer); außer Gefecht bei allen LP', () => {
    const st = gesundheitsstufen(K).stufen;
    expect(lebenslage(5, st, { schaden: 5 })).toMatchObject({ stufenName: 'Unverletzt', wundabzug: 0 });
    expect(lebenslage(5, st, { schaden: 6 })).toMatchObject({ gesamt: 25, frei: 19, stufenName: 'Angeschlagen', wundabzug: -1 });
    expect(lebenslage(5, st, { betaeubung: 12 })).toMatchObject({ stufenName: 'Verletzt', wundabzug: 0 });
    expect(lebenslage(5, st, { schaden: 25 })).toMatchObject({ ausser: true, stufenName: 'Außer Gefecht', frei: 0 });
    expect(fokusFrei(10, { fokus: { erschoepft: 2, kanalisiert: 3, verzehrt: 1 } })).toBe(4);
  });
  it('Schaden eintragen: Überlauf von Betäubung wird echter Schaden; Felder für die Modale', () => {
    expect(schadenEintragen(10, { schaden: 2 }, 'consumed', 20)).toEqual({ schaden: 10 });
    expect(schadenEintragen(10, { schaden: 2, betaeubung: 6 }, 'exhausted', 4)).toEqual({ schaden: 4, betaeubung: 6, kanalisiert: 0 });
    expect(gesundheitsfelder(5, { schaden: 1, betaeubung: 2, kanalisiert: 1 }).map(f => f.type)).toEqual(['consumed', 'exhausted', 'exhausted', 'channeled', 'empty']);
  });
  it('Würfelformeln und Fertigkeitstexte', () => {
    const r = wirfFormel('2W6−1')!;
    expect(r.wuerfel).toHaveLength(2); expect(r.mod).toBe(-1); expect(r.summe).toBe(r.wuerfel[0] + r.wuerfel[1] - 1);
    expect(wirfFormel('Spezial')).toBeNull();
    expect(fertigkeitenAusText('Akrobatik 8, Wahrnehmung 7 (Schwerpunkt Sicht 9), Sonderregel')).toEqual([
      { name: 'Akrobatik', wert: 8, text: 'Akrobatik 8' }, { name: 'Wahrnehmung', wert: 7, text: 'Wahrnehmung 7 (Schwerpunkt Sicht 9)' },
      { name: 'Sonderregel', wert: null, text: 'Sonderregel' }]);
  });
  it('Gefolge: Waffe mit Angriffswert aus Fertigkeitspunkten und Waffenattributen', () => {
    const anderthalb = Object.values(K.eintraege).find(e => e.typ === 'waffe' && e.name === 'Anderthalbhänder')!;
    const g = gefolgeWerte(K, { id: 'grw:kultur:zwingard', art: 'gefolge', name: 'Zwingard', rasse: 'grw:rasse:menschen', attributFrei: ['Stärke', 'Beweglichkeit'],
      kulturWahl: { fertigkeiten: { 0: 'grw:fertigkeit:stangenwaffen', 4: 'grw:fertigkeit:handwerk', 5: 'grw:fertigkeit:heilkunde' } }, waffen: [anderthalb.id] }, 6);
    expect(g.waffen.find(w => w.name === 'Anderthalbhänder')).toMatchObject({ wert: 2 + 3 + 3, schaden: '2W6', fertigkeit: 'Klingenwaffen', angeboren: false }); // Klingenwaffen 2 + BEW 3 + STÄ 3
    // Waffenlos hat jeder (Waffe ohne Preis und Verfügbarkeit, GRW S. 183): Handgemenge + BEW + STÄ
    const hg = g.fertigkeiten.find(f => f.name === 'Handgemenge')?.punkte ?? 0;
    expect(g.waffen[0]).toMatchObject({ name: 'Waffenlos', wert: hg + 3 + 3, schaden: '1W6', angeboren: true });
    expect(g.werte.waffen?.map(w => w.name)).toEqual(['Waffenlos', 'Anderthalbhänder']);
  });
  it('Import übernimmt Zustand und Waffen', () => {
    const r = validateCharacterImport({ ...DEFAULT_STATE, begleiter: [{ id: 'x', art: 'tier', name: 'Wolf', waffen: ['w'], feinschliff: { a: 'KON', b: { f: 2 }, c: 3 },
      zustand: { schaden: 3, betaeubung: 'x', fokus: { erschoepft: 2 }, zustaende: [{ id: 'z', key: 'Benommen', level: 2 }, { foo: 1 }] } }] });
    expect(r.begleiter?.[0]).toMatchObject({ waffen: ['w'], feinschliff: { a: 'KON', b: { f: 2 } }, zustand: { schaden: 3, fokus: { erschoepft: 2 }, zustaende: [{ id: 'z', key: 'Benommen', level: 2 }] } });
    expect(r.begleiter?.[0].feinschliff).not.toHaveProperty('c');
    expect(r.begleiter?.[0].zustand).not.toHaveProperty('betaeubung');
  });
});

const Rahmen: React.FC<{ start: Partial<CharacterState> }> = ({ start }) => {
  const [state, dispatch] = React.useReducer(baseCharacterReducer, { ...DEFAULT_STATE, ...start });
  return <CharacterContext.Provider value={{ state, dispatch, calc: { heldengrad: { maxSkill: 6 } } as never }}><BegleiterView /></CharacterContext.Provider>;
};

describe('Tab „Begleiter“: würfeln und Lebenspunkte', () => {
  it('Wolf: Schaden setzt Wundabzug, Probe und Angriff öffnen die Modale', () => {
    render(<Rahmen start={{ begleiter: [{ id: 'grw:kreatur:wolf', art: 'tier', name: 'Wolf', rufname: 'Grauzahn' }] }} />);
    const tiere = screen.getByTestId('begleiter-blatt'); // einziger Begleiter: sein Blatt ist gewählt
    expect(within(tiere).getByRole('heading', { name: 'Grauzahn (Wolf)' })).toBeTruthy();
    const v = within(tiere).getByTestId('begleiter-vitals');
    const lp = Number(K.get('grw:kreatur:wolf')!.daten.abgeleitete_werte.LP);
    // Wolf ist Schwächlich: 3 Gesundheitsstufen (Unverletzt, Verletzt, Todgeweiht)
    expect(within(v).getByText(`LP ${lp * 3}/${lp * 3}`)).toBeTruthy();
    expect(within(v).getByText(/3 Stufen \(Schwächlich\)/)).toBeTruthy();
    // Schaden-Modal: lp + 1 echter Schaden → Stufe 2 (Verletzt, −2)
    fireEvent.click(within(v).getByRole('button', { name: /Schaden erleiden/ }));
    expect(screen.getByText('Grauzahn: Schaden erleiden')).toBeTruthy();
    expect(screen.queryByText(/Splitterpunkt/)).toBeNull();
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: String(lp + 1) } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${lp + 1} echten Schaden anwenden`) }));
    expect(within(v).getByText(`LP ${lp * 2 - 1}/${lp * 3}`)).toBeTruthy();
    expect(within(v).getByText('Wundabzug -2')).toBeTruthy();
    // Heilen-Modal
    fireEvent.click(within(v).getByRole('button', { name: /Heilen/ }));
    expect(screen.getByText('Grauzahn: Heilung anwenden')).toBeTruthy();
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: String(lp + 1) } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${lp + 1} LP heilen`) }));
    expect(within(v).queryByText(/Wundabzug/)).toBeNull();
    expect(within(v).getByText(`LP ${lp * 3}/${lp * 3}`)).toBeTruthy();

    // Zustand: Erschöpft 2 → Marke mit Abzug, wirkt in der Probe
    fireEvent.change(within(v).getByLabelText('Zustand hinzufügen'), { target: { value: 'Erschöpft' } });
    fireEvent.change(within(v).getByLabelText('Stufe'), { target: { value: '2' } });
    fireEvent.click(within(v).getByRole('button', { name: /^Zustand$/ }));
    expect(within(v).getByText(/Erschöpft 2 \(-2\)/)).toBeTruthy();

    fireEvent.click(within(tiere).getByRole('button', { name: /^Probe Wahrnehmung würfeln$/ }));
    expect(screen.getAllByText(/Erschöpft/).length).toBeGreaterThan(1); // auch im Probe-Modal
    expect(screen.getByText(/Grauzahn: Wahrnehmung/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Schließen' })[0]);
    expect(screen.queryByText(/Grauzahn: Wahrnehmung/)).toBeNull();
    fireEvent.click(within(v).getByRole('button', { name: 'Zustand Erschöpft beenden' }));
    expect(within(v).queryByText(/Erschöpft 2/)).toBeNull();
    fireEvent.click(within(tiere).getAllByRole('button', { name: /^Angriff .* würfeln$/ })[0]);
    expect(screen.getAllByText(/Grauzahn: /).length).toBeGreaterThan(0);
  });
});
