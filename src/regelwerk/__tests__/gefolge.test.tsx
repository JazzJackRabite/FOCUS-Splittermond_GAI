/**
 * Gefolge (Ressource Gefolge, GRW S. 77–78): Werte eines Gefolgsmanns, Gefolge-Punkte, Tab „Begleiter“.
 */
import { setzeHausregeln } from '../../fundament/hausregeln';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { baseCharacterReducer, DEFAULT_STATE } from '../../hooks/useCharacterState';
import { CharacterContext } from '../../context/CharacterContext';
import { BegleiterView } from '../../features/begleiter/BegleiterView';
import { validateCharacterImport } from '../../utils/importValidation';
import { Katalog } from '../katalog';
import { abschliessen, basisAusDateien, begleiterErstellen, weiter } from './hilfen';
import { freieAttribute, freieZauberBei, gefolgeWerte, hoechsterZaubergrad, kulturWerte, meisterschaftsAngebot, zauberAngebot } from '../gefolge';
import type { Begleiter, CharacterState } from '../../types';

const b = basisAusDateien(); const K = new Katalog(b.manifest, [b.basis]);
vi.mock('../RegelwerkContext', () => ({ useRegelwerk: () => ({ katalog: K }) }));

const zwingarder: Begleiter = {
  id: 'grw:kultur:zwingard', art: 'gefolge', name: 'Zwingard', rasse: 'grw:rasse:menschen', attributFrei: ['Stärke', 'Konstitution'],
  kulturWahl: { fertigkeiten: { 0: 'grw:fertigkeit:stangenwaffen', 4: 'grw:fertigkeit:handwerk', 5: 'grw:fertigkeit:heilkunde' } },
};

describe('Gefolge: Regeln', () => {
  it('Attribute 2 + Rassenmodifikator, freie Boni der Rasse', () => {
    expect(freieAttribute(K, 'grw:rasse:menschen')).toHaveLength(2);
    expect(freieAttribute(K, 'grw:rasse:varge')[0].nicht).toEqual(['Stärke']);
    const g = gefolgeWerte(K, zwingarder, 6);
    expect(g.attribute).toMatchObject({ Stärke: 3, Konstitution: 3, Beweglichkeit: 2, Willenskraft: 2 });
    const varg = gefolgeWerte(K, { ...zwingarder, rasse: 'grw:rasse:varge', attributFrei: ['Beweglichkeit'] }, 6);
    expect(varg.attribute).toMatchObject({ Stärke: 4, Willenskraft: 1, Beweglichkeit: 3 });
    // derselbe Wert zweimal bei „unterschiedlich“ zählt nur einmal
    const doppelt = gefolgeWerte(K, { ...zwingarder, attributFrei: ['Stärke', 'Stärke'] }, 6);
    expect(doppelt.attribute.Stärke).toBe(3);
    expect(doppelt.hinweise).toContain('freien Attributbonus der Rasse wählen');
  });

  it('Kulturmodul: Fertigkeitspunkte, Stärke und Meisterschaft; offene Wahl wird gemeldet', () => {
    const w = kulturWerte(K, 'grw:kultur:zwingard', zwingarder.kulturWahl);
    expect(w.fehlend).toEqual([]);
    expect(Object.values(w.fertigkeiten).reduce((s, x) => s + x, 0)).toBe(15);
    expect(w.fertigkeiten['grw:fertigkeit:stangenwaffen']).toBe(1);
    expect(w.staerke).toBe('grw:staerke:zaeh');
    expect(w.meisterschaft?.text).toBe('Schnell wieder auf den Beinen');
    expect(kulturWerte(K, 'grw:kultur:zwingard').fehlend).toHaveLength(3);
    // „eine Magieschule“ (Ioria)
    const io = kulturWerte(K, 'grw:kultur:ioria', { fertigkeiten: { [String(K.get('grw:kultur:ioria')!.daten.modulwerte.fertigkeiten.findIndex((g: { text: string }) => /Magieschule/.test(g.text)))]: 'grw:fertigkeit:feuermagie' } });
    expect(io.fertigkeiten['grw:fertigkeit:feuermagie']).toBe(1);
  });

  it('Fertigkeitswert = Punkte + Attribute; abgeleitete Werte nach GRW', () => {
    const g = gefolgeWerte(K, zwingarder, 6);
    const zaeh = g.fertigkeiten.find(f => f.name === 'Zähigkeit')!; // Konstitution + Willenskraft
    expect(zaeh).toMatchObject({ punkte: 2, wert: 2 + 3 + 2 });
    expect(g.fertigkeiten.find(f => f.name === 'Klingenwaffen')?.wert).toBeNull(); // Attribute je Waffe
    expect(g.werte.abgeleitete_werte).toMatchObject({ GK: '5', LP: '8' }); // LP = GK + KON
    expect(g.staerken).toEqual(['grw:staerke:zusaetzliche-splitterpunkte', 'grw:staerke:zaeh']); // Rassenstärke der Menschen + Kultur
    expect(g.punkte).toBe(1);
    expect(g.hinweise).toEqual([]);
  });

  it('Punkte: Schwelle anheben, Meisterschaften und Zauber über den freien', () => {
    const angehoben = gefolgeWerte(K, { ...zwingarder, schwellen: ['grw:fertigkeit:stangenwaffen', 'grw:fertigkeit:redegewandtheit'] }, 6);
    expect(angehoben.fertigkeiten.find(f => f.name === 'Stangenwaffen')).toMatchObject({ punkte: 6, angehoben: true, schwelle: 1 });
    expect(angehoben.fertigkeiten.find(f => f.name === 'Redegewandtheit')?.punkte).toBe(6);
    expect(angehoben.freieMeisterschaften).toBe(2);
    expect(angehoben.punkte).toBe(3);
    const verteidiger = meisterschaftsAngebot(K, angehoben.fertigkeiten).find(m => m.name === 'Verteidiger');
    const mit = gefolgeWerte(K, { ...zwingarder, meisterschaften: [verteidiger!.id] }, 6);
    expect(mit.punkte).toBe(2); // zusätzliche Meisterschaft ohne Schwelle kostet 1
    expect(mit.meisterschaften[0].ok).toBe(true); // allgemeine Nahkampfmeisterschaft über Stangenwaffen
    expect(meisterschaftsAngebot(K, gefolgeWerte(K, zwingarder, 6).fertigkeiten).some(m => m.name === 'Verteidiger')).toBe(true);
  });

  it('Zauber: Grad nach Punkten, freie Zauber je Magieschule', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 15].map(n => hoechsterZaubergrad(K, n))).toEqual([-1, 0, 0, 1, 1, 2, 3, 5]);
    expect([0, 1, 3, 6, 9].map(n => freieZauberBei(K, n))).toEqual([0, 1, 2, 3, 3]);
    const magier = { ...zwingarder, kulturWahl: { fertigkeiten: { ...zwingarder.kulturWahl!.fertigkeiten, 5: 'grw:fertigkeit:staerkungsmagie' } } };
    const g = gefolgeWerte(K, magier, 6);
    expect(g.freieZauber).toBe(1);
    const angebot = zauberAngebot(K, g.fertigkeiten);
    expect(angebot.length).toBeGreaterThan(0);
    expect(angebot.every(z => z.schule === 'Stärkung' && z.grad === 0)).toBe(true);
    const zwei = gefolgeWerte(K, { ...magier, zauber: angebot.slice(0, 2).map(z => z.id) }, 6);
    expect(zwei.punkte).toBe(2);
    expect(zwei.zauber.every(z => z.ok)).toBe(true);
  });

  it('Heldengrad begrenzt die Fertigkeiten', () => {
    const g = gefolgeWerte(K, { ...zwingarder, schwellen: ['grw:fertigkeit:stangenwaffen'] }, 5);
    expect(g.fertigkeiten.find(f => f.name === 'Stangenwaffen')?.zuHoch).toBe(true);
    expect(g.hinweise.some(h => /Heldengrad/.test(h))).toBe(true);
  });

  it('Import übernimmt Gefolgsleute', () => {
    const r = validateCharacterImport({ ...DEFAULT_STATE, begleiter: [{ ...zwingarder, aufgabe: 'Knappe', schwellen: ['a', 3], zauber: ['z'], kulturWahl: { fertigkeiten: { 0: 'x', 1: 2 }, meisterschaft: 0 } }] });
    expect(r.begleiter?.[0]).toMatchObject({ art: 'gefolge', aufgabe: 'Knappe', rasse: 'grw:rasse:menschen', schwellen: ['a'], zauber: ['z'], kulturWahl: { fertigkeiten: { 0: 'x' }, meisterschaft: 0 } });
  });
});

const Rahmen: React.FC<{ start: Partial<CharacterState> }> = ({ start }) => {
  const [state, dispatch] = React.useReducer(baseCharacterReducer, { ...DEFAULT_STATE, ...start });
  return <CharacterContext.Provider value={{ state, dispatch, calc: { heldengrad: { maxSkill: 6 } } as never }}><BegleiterView /></CharacterContext.Provider>;
};

describe('Tab „Begleiter“: Gefolge', () => {
  it('Gefolgsmann im Assistenten: Rasse und Kultur, Fertigkeit anheben, Punkte zählen', () => {
    render(<Rahmen start={{ resourcesList: [{ name: 'Gefolge', level: 1, source: 'test' }] }} />);
    const d = begleiterErstellen('Gefolgsmann');
    const punkte = () => within(d).getByTestId('gefolge-punkte').textContent ?? '';
    expect(punkte()).toContain('Gefolge-Punkte 0/1');
    fireEvent.change(within(d).getByLabelText('Rasse'), { target: { value: 'grw:rasse:zwerge' } });
    fireEvent.change(within(d).getByLabelText('Kultur'), { target: { value: 'grw:kultur:zwingard' } });
    expect(punkte()).toContain('Gefolge-Punkte 1/1');
    weiter();
    fireEvent.change(within(d).getByPlaceholderText('Leibdiener, Knappe …'), { target: { value: 'Knappe' } });
    expect(screen.getByText('Gefolgsmann erstellen')).toBeTruthy();
    fireEvent.change(within(d).getByLabelText(/^Freier Attributbonus 1/), { target: { value: 'Stärke' } });
    fireEvent.change(within(d).getByLabelText('Kultur: Hiebwaffen oder Schusswaffen oder Stangenwaffen 1'), { target: { value: 'grw:fertigkeit:stangenwaffen' } });
    weiter();
    // Stangenwaffen auf 6 anheben → 2 Punkte, mehr als die Ressource
    const zeile = within(within(d).getByRole('table')).getByText('Stangenwaffen').closest('tr')!;
    // ohne Hausregeln gesperrt (FUNDAMENT, Grundsatz 7), mit Hausregeln nur eine Warnung
    fireEvent.click(within(zeile).getByRole('button', { name: /anheben/ }));
    expect(punkte()).toContain('Gefolge-Punkte 1/1');
    setzeHausregeln(true);
    fireEvent.click(within(zeile).getByRole('button', { name: /anheben/ }));
    expect(within(zeile).getAllByText(/^6/).length).toBeGreaterThan(0);
    expect(punkte()).toContain('Gefolge-Punkte 2/1');
    expect(within(d).getByText(/Mehr Punkte, als die Ressource Gefolge hergibt/)).toBeTruthy();
    weiter();
    expect(within(d).getByText('Waffenlos')).toBeTruthy(); // hat jeder
    weiter();
    expect(within(d).getByText('(Kultur)').parentElement!.textContent).toContain('Schnell wieder auf den Beinen');
    // Meisterschaft der Schwelle ist frei
    const sel = within(d).getByLabelText('Meisterschaft für Gefolgsmann wählen') as HTMLSelectElement;
    const verteidiger = [...sel.options].find(o => o.text.startsWith('Verteidiger'))!;
    fireEvent.change(sel, { target: { value: verteidiger.value } });
    fireEvent.click(within(d).getByRole('button', { name: /Meisterschaft hinzufügen/ }));
    expect(within(d).getByText(/frei durch Schwelle/)).toBeTruthy();
    expect(punkte()).toContain('Gefolge-Punkte 2/1');
    abschliessen();
    const blatt = screen.getByTestId('begleiter-blatt');
    expect(within(blatt).getByRole('heading', { name: 'Knappe (Zwingard)' })).toBeTruthy();
    expect(within(blatt).getByText('2 Gefolge-Punkte')).toBeTruthy();
    expect(within(blatt).getByRole('button', { name: /^Angriff Waffenlos würfeln$/ })).toBeTruthy();
    expect(screen.getByText(/Das Gefolge braucht mehr Punkte/)).toBeTruthy();
    setzeHausregeln(false);
  });
});

