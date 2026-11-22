/**
 * Relikte: Baukasten aus den Regelpaketen (GRW S. 79 Ressource Relikt, S. 142 Verbesserungen, S. 254 Strukturgeber),
 * Prüfung, Inventareintrag, Zustand und Werkstatt. Mit FOKUS_GRIMOIRES zusätzlich die Bausteine der Erweiterungen.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { baseCharacterReducer, DEFAULT_STATE } from '../../hooks/useCharacterState';
import { CharacterContext } from '../../context/CharacterContext';
import { ReliktKarte } from '../../components/relikte/ReliktKarte';
import { Katalog } from '../katalog';
import { basisAusDateien, buchfaelle, grimoireDatei } from './hilfen';
import { grimoireLesen, erstelleKatalog } from '../laden';
import { alleAusruestung } from '../ausruestung';
import { artVon, kostenVon, passtZu, pruefeRelikt, reliktAlsInventar, reliktBaukasten, reliktBausteine, ressourcePunkte } from '../relikte';
import type { Relikt } from '../../types';

const b = basisAusDateien(); const K = new Katalog(b.manifest, [b.basis]);
vi.mock('../RegelwerkContext', () => ({ useRegelwerk: () => ({ katalog: K }) }));

const relikt = (x: Partial<Relikt>): Relikt => ({ id: 'r1', name: 'Test', punkte: 3, art: 'nahkampfwaffe', bausteine: [], inventarId: 'i1', ...x });

describe('Relikt-Baukasten aus dem GRW', () => {
  const bk = reliktBaukasten(K)!;
  const bs = reliktBausteine(K, bk);
  const B = (id: string) => bs.find(x => x.id === id)!;

  it('Baukasten an der Ressource Relikt: Budget, bis 6 Punkte, Verbesserungen und Artefaktwirkungen', () => {
    expect(bk).toEqual(expect.objectContaining({ budget: 'ressourcenpunkte', maxPunkte: 6, typen: ['verbesserung', 'artefaktwirkung'], material: null }));
    expect(bk.quellen.map(e => e.id)).toEqual(['grw:ressource:relikt']);
  });

  it('acht Verbesserungen (S. 142) und drei Strukturgeber-Wirkungen (S. 254); alchemistische Wirkung ohne Kosten nicht dabei', () => {
    expect(bs.filter(x => x.typ === 'verbesserung').map(x => x.id).sort()).toEqual([
      'grw:verbesserung:behinderung-1', 'grw:verbesserung:fertigkeitsbonus-auf-einen-schwerpunkt', 'grw:verbesserung:haerte-1', 'grw:verbesserung:last-1',
      'grw:verbesserung:schadensreduktion-1', 'grw:verbesserung:tick-zuschlag-1', 'grw:verbesserung:waffengeschwindigkeit-1', 'grw:verbesserung:waffenschaden-1']);
    expect(bs.filter(x => x.typ === 'artefaktwirkung').length).toBe(3);
    expect(B('grw:verbesserung:waffenschaden-1')).toEqual(expect.objectContaining({ kosten: 1, maxAnzahl: 2, giltFuer: ['waffe'], quelle: 'GRW S. 142' }));
    expect(B('grw:artefaktwirkung:zauberverankerung').kostenNachGrad).toEqual([0, 1, 2, 3, 4, 5].map(g => ({ grad: g, kosten: g + 1 })));
  });

  it('Kosten wie im Beispiel GRW S. 142: Schaden +1, Fertigkeitsbonus, WGS −1 = 5 Qualitätsstufen', () => {
    const r = relikt({ punkte: 5, bausteine: [
      { id: 'grw:verbesserung:waffenschaden-1', anzahl: 1 },
      { id: 'grw:verbesserung:fertigkeitsbonus-auf-einen-schwerpunkt', anzahl: 1, auswahl: 'Klingenwaffen (Angriff)' },
      { id: 'grw:verbesserung:waffengeschwindigkeit-1', anzahl: 1 }] });
    expect(pruefeRelikt(r, bs, bk)).toEqual({ verwendet: 5, warnungen: [] });
    expect(kostenVon(B('grw:artefaktwirkung:zauberverankerung'), { id: 'x', anzahl: 1, grad: 3 })).toBe(4);
  });

  it('Warnungen: zu viele Punkte, Höchstzahl, falsche Gegenstandsart, fehlende Auswahl, über 6 Punkte', () => {
    const r = relikt({ punkte: 7, art: 'ruestung', bausteine: [
      { id: 'grw:verbesserung:waffenschaden-1', anzahl: 3 },
      { id: 'grw:artefaktwirkung:zauberverankerung', anzahl: 1, grad: 5 }] });
    const p = pruefeRelikt(r, bs, bk);
    expect(p.verwendet).toBe(9);
    expect(p.warnungen.join('\n')).toMatch(/höchstens 2×/);
    expect(p.warnungen.join('\n')).toMatch(/nicht für Rüstung/);
    expect(p.warnungen.join('\n')).toMatch(/Auswahl fehlt \(Zauber\)/);
    expect(p.warnungen.join('\n')).toMatch(/kosten 9 Punkte, das Relikt hat 7/);
    expect(p.warnungen.join('\n')).toMatch(/Mehr als 6 Punkte/);
  });

  it('Gegenstandsart aus der Ausrüstung; Waffen-Bausteine passen zu Nah- und Fernkampf', () => {
    const aus = alleAusruestung(K);
    expect(artVon(aus.find(i => i.type === 'weapon' && i.category === 'Fernkampf'))).toBe('fernkampfwaffe');
    expect(artVon(aus.find(i => i.type === 'armor'))).toBe('ruestung');
    expect(passtZu(B('grw:verbesserung:waffenschaden-1'), 'fernkampfwaffe')).toBe(true);
    expect(passtZu(B('grw:verbesserung:schadensreduktion-1'), 'nahkampfwaffe')).toBe(false);
    expect(passtZu(B('grw:verbesserung:haerte-1'), 'kleidung')).toBe(true);
  });

  it('Ressource Relikt: Summe aller Einträge', () => {
    expect(ressourcePunkte([{ name: 'Relikt', level: 2 }, { name: 'Relikt', level: 3 }, { name: 'Kreatur', level: 4 }])).toBe(5);
  });

  it('Inventareintrag mit Werten des Grundgegenstands und Bausteinen in der Beschreibung', () => {
    const basis = alleAusruestung(K).find(i => i.name === 'Langschwert' && i.type === 'weapon')!;
    const r = relikt({ name: 'Großvaters Klinge', basisId: basis.id, bausteine: [{ id: 'grw:verbesserung:waffenschaden-1', anzahl: 2 }] });
    const it = reliktAlsInventar(r, bs, basis);
    expect(it).toEqual(expect.objectContaining({ id: 'i1', name: 'Großvaters Klinge', type: 'weapon', category: 'Relikt', source: 'GRW',
      damage: '1W6+6', quantity: 1 }));
    expect(it.desc).toContain('Werte: Schaden 1W6+4 → 1W6+6.');
    expect(it.desc).toContain('Waffenschaden +1 ×2 – 2 P., GRW S. 142');
  });

  it('Härte des Grundgegenstands als Feld, Verbesserung Härte +1 rechnet sie hoch', () => {
    const basis = alleAusruestung(K).find(i => i.name === 'Langschwert' && i.type === 'weapon')!;
    expect(typeof basis.hardness).toBe('number');
    const r = relikt({ basisId: basis.id, bausteine: [{ id: 'grw:verbesserung:haerte-1', anzahl: 2 }] });
    const it = reliktAlsInventar(r, bs, basis);
    expect(it.hardness).toBe(basis.hardness! + 2);
    expect(it.desc).toContain(`Härte ${basis.hardness} → ${basis.hardness! + 2}`);
  });
});

describe('Relikte im Zustand und in der Werkstatt', () => {
  it('Reducer: speichern legt Inventareintrag an, erneutes Speichern aktualisiert, löschen entfernt beides', () => {
    const r = relikt({});
    let s = baseCharacterReducer(DEFAULT_STATE, { type: 'RELIKT_SPEICHERN', payload: { relikt: r, inventar: { id: 'i1', name: 'Test', type: 'weapon', quantity: 1 } } });
    expect(s.relikte).toHaveLength(1);
    expect(s.inventory?.filter(i => i.id === 'i1')).toHaveLength(1);
    s = baseCharacterReducer(s, { type: 'TOGGLE_EQUIP_ITEM', payload: { id: 'i1' } });
    s = baseCharacterReducer(s, { type: 'RELIKT_SPEICHERN', payload: { relikt: { ...r, name: 'Neu' }, inventar: { id: 'i1', name: 'Neu', type: 'weapon', quantity: 1 } } });
    expect(s.relikte?.map(x => x.name)).toEqual(['Neu']);
    expect(s.inventory?.filter(i => i.id === 'i1').map(i => i.name)).toEqual(['Neu']);
    s = baseCharacterReducer(s, { type: 'RELIKT_LOESCHEN', payload: { id: 'r1' } });
    expect(s.relikte).toEqual([]);
    expect(s.inventory?.some(i => i.id === 'i1')).toBe(false);
  });

  it('Werkstatt: Grundgegenstand wählen, Bausteine hinzufügen, Punkte prüfen, speichern', () => {
    const Rahmen: React.FC = () => {
      const [state, dispatch] = React.useReducer(baseCharacterReducer, { ...DEFAULT_STATE, resourcesList: [{ name: 'Relikt', level: 3, source: 'test' }] });
      return <CharacterContext.Provider value={{ state, dispatch, calc: {} as never }}><ReliktKarte /><div data-testid="inv">{(state.inventory ?? []).map(i => i.name).join('|')}</div></CharacterContext.Provider>;
    };
    render(<Rahmen />);
    expect(screen.getByText(/Ressource Relikt: 3 Punkte, davon in Relikten 0/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Relikt bauen/ }));
    const dlg = screen.getByRole('dialog', { name: 'Relikt-Werkstatt' });
    fireEvent.change(within(dlg).getByLabelText('Grundgegenstand'), { target: { value: 'Langschw' } });
    fireEvent.click(within(dlg).getByRole('button', { name: /^Langschwert/ }));
    expect((within(dlg).getByLabelText('Art des Gegenstands') as HTMLSelectElement).value).toBe('nahkampfwaffe');
    // Rüstungs-Verbesserung ist für Waffen ausgeblendet
    expect(within(dlg).queryByRole('button', { name: 'Schadensreduktion +1 hinzufügen' })).toBeNull();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Waffenschaden +1 hinzufügen' }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Waffenschaden +1 hinzufügen' }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Waffengeschwindigkeit -1 hinzufügen' }));
    expect(within(dlg).getByTestId('relikt-pruefung').textContent).toMatch(/4 von 3 Punkten verwendet.*kosten 4 Punkte, das Relikt hat 3/);
    fireEvent.click(within(dlg).getAllByRole('button', { name: 'weniger' })[0]);
    expect(within(dlg).getByTestId('relikt-pruefung').textContent).toMatch(/^3 von 3 Punkten verwendet$/);
    fireEvent.change(within(dlg).getByLabelText('Name'), { target: { value: 'Klinge der Ahnen' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Relikt speichern' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('inv').textContent).toBe('Klinge der Ahnen');
    expect(screen.getByText(/Ressource Relikt: 3 Punkte, davon in Relikten 3/)).toBeTruthy();
    expect(screen.getByText('Waffenschaden +1')).toBeTruthy();
  });
});

// Zahlen und IDs zu den Erweiterungen: lokale Falldatei (hilfen.ts: buchfaelle)
interface ReliktFaelle { grimoires: string[]; typen: string[]; anzahl: Record<string, number>; materialMindestens: number; grwMaterial: { id: string; kosten: number; mindestPunkte: number }; ergaenzt: { id: string; muster: string } }
const F = buchfaelle<ReliktFaelle>('relikte', ['mondstahl', 'goetter']);
describe.skipIf(!F)('Relikt-Bausteine der Erweiterungen (lokal)', () => {
  it('Grimoires erweitern den Baukasten', () => {
    const { katalog: KB } = erstelleKatalog(b, F!.grimoires.map(n => grimoireLesen(fs.readFileSync(grimoireDatei(n), 'utf-8'), b.manifest)));
    const bk = reliktBaukasten(KB)!;
    expect(bk.typen).toEqual(F!.typen);
    expect(bk.material).toEqual({ kosten: 1, mindestAus: 'qualitaet' });
    const bs = reliktBausteine(KB, bk);
    const zahl = (t: string) => bs.filter(x => x.typ === t).length;
    for (const [t, n] of Object.entries(F!.anzahl)) expect(zahl(t), t).toBe(n);
    expect(zahl('material')).toBeGreaterThan(F!.materialMindestens);
    // GRW-Material, dessen Materialqualität erst eine Ergänzung nennt
    const { id, ...rest } = F!.grwMaterial;
    expect(bs.find(x => x.id === id)).toEqual(expect.objectContaining({ typ: 'material', ...rest }));
    expect(bs.find(x => x.id === F!.ergaenzt.id)!.beschreibung).toMatch(new RegExp(F!.ergaenzt.muster));
    expect(bs.every(x => x.kosten !== null || x.kostenNachGrad)).toBe(true);
    // Material: Kosten 1, Mindestpunkte = Materialqualität; nur ein Material je Relikt
    const mat = bs.filter(x => x.typ === 'material').sort((a, c) => (c.mindestPunkte ?? 0) - (a.mindestPunkte ?? 0));
    const r = relikt({ punkte: 2, bausteine: [{ id: mat[0].id, anzahl: 1 }, { id: mat[1].id, anzahl: 1 }] });
    const w = pruefeRelikt(r, bs, bk).warnungen.join('\n');
    expect(w).toMatch(/verlangt mindestens \d+ Punkte/);
    expect(w).toMatch(/nur eine Variante/);
  });
});
