/** Stärken, Ressourcen, Sprachen: was nach den Paketdaten noch wählbar ist (Praxistest Liora, HG 4) */
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { listenSperre } from '../regelwerk/listenAuswahl';
import { grwRessourcen, grwStaerken } from '../regelwerk/grwListen';
import { getStrengthDetails } from '../utils/gameResourceManager';
import { useCharacterState } from '../hooks/useCharacterState';
import type { ItemEntry } from '../types';

const e = (name: string, level = 1, source = 'creation'): ItemEntry => ({ name, level, source });
const staerke = (n: string) => grwStaerken().find((s) => s.name === n)!;

describe('listenSperre', () => {
  it('„nur bei Generierung" (Flink): bei der Erschaffung frei, danach gesperrt', () => {
    expect(staerke('Flink').onlyCreation).toBe(true);
    expect(listenSperre('strength', staerke('Flink'), 'Flink', 'creation', []).grund).toBeNull();
    expect(listenSperre('strength', staerke('Flink'), 'Flink', 'xp', []).grund).toBe('Nur Erschaffung');
  });

  it('Robust (bis zu dreimal): vorhandene Stufen zählen, danach gesperrt', () => {
    const r = staerke('Robust');
    expect(r.max).toBe(3);
    expect(listenSperre('strength', r, 'Robust', 'xp', [e('Robust', 2)]).restStufen).toBe(1);
    expect(listenSperre('strength', r, 'Robust', 'xp', [e('Robust'), e('Robust', 2, 'xp')]).grund).toBe('Höchstens 3×');
  });

  it('einfach wählbare Stärke ist nach der Wahl gesperrt', () => {
    expect(listenSperre('strength', staerke('Zäh'), 'Zäh', 'xp', [e('Zäh')]).grund).toBe('Bereits gewählt');
  });

  it('Ressource: höchste Tabellenstufe 6, vorhandene Stufen zählen mit', () => {
    const v = grwRessourcen().find((r) => r.name === 'Vermögen')!;
    expect(v.maxStufe).toBe(6);
    expect(listenSperre('resource', v, 'Vermögen', 'xp', [e('Vermögen', 2)]).restStufen).toBe(4);
    expect(listenSperre('resource', v, 'Vermögen', 'xp', [e('Vermögen', 2), e('Vermögen', 4, 'xp')]).grund).toMatch(/Höchststufe 6/);
  });

  it('Sprache: bekannte Sprache nicht noch einmal', () => {
    expect(listenSperre('language', null, 'Basargnomisch', 'creation', [e('Basargnomisch')]).grund).toBe('Bereits bekannt');
  });
});

describe('Ressource steigern', () => {
  it('zweiter EP-Kauf derselben Ressource erhöht den EP-Eintrag statt einen zweiten anzulegen', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => { result.current.dispatch({ type: 'SET_MODE', payload: 'xp' } as never); });
    for (const level of [1, 2]) {
      act(() => { result.current.dispatch({ type: 'ADD_RESOURCE', payload: { name: 'Mentor', level, source: 'xp', pointCost: 1 } }); });
    }
    const mentor = result.current.state.resourcesList.filter((r) => r.name === 'Mentor');
    expect(mentor).toHaveLength(1);
    expect(mentor[0].level).toBe(3);
    expect(result.current.state.advancementLog?.[0].title ?? '').toMatch(/gesteigert/);
  });
});

describe('Quelle von Stärken mit Ziel', () => {
  it('Kulturkunde (Selenia) findet die Stärke Kulturkunde im Regelwerk', () => {
    const d = getStrengthDetails('Kulturkunde (Selenia)');
    expect(d.found).toBe(true);
    expect(d.source).not.toBe('unbekannt');
  });
});

describe('Dialog „Stärke hinzufügen" nach der Erschaffung', () => {
  it('Suche nach Flink wählt die gesperrte Stärke nicht still aus; Hinzufügen bleibt gesperrt', async () => {
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const React = await import('react');
    const { AddItemModal } = await import('../components/modals/AddItemModal');
    let hinzugefuegt = '';
    render(React.createElement(AddItemModal, {
      title: 'Stärke', items: grwStaerken(), onClose: () => {}, onAdd: (n: string) => { hinzugefuegt = n; },
      mode: 'xp', type: 'strength', budget: 1000, existingItems: [],
    }));
    fireEvent.change(screen.getByPlaceholderText(/such/i), { target: { value: 'Flink' } });
    const knopf = screen.getByRole('button', { name: 'Hinzufügen' });
    expect((knopf as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(knopf);
    expect(hinzugefuegt).toBe('');
  });
});

describe('Schwerpunkt aus der Kultur', () => {
  it('„Schwerpunkt: Drachlinge (S1)“ zeigt die Regel Schwerpunkte als Quelle', async () => {
    const { getMasteryDetails } = await import('../utils/gameResourceManager');
    const d = getMasteryDetails('Geschichte & Mythen', 'Schwerpunkt: Drachlinge (S1)');
    expect(d.found).toBe(true);
    expect(d.source).toBe('GRW');
    expect(d.page).toBe(92);
  });
});

describe('Startvermögen aus der Vermögenstabelle', () => {
  it('Vermögen 2 bei der Erschaffung: 20 Lunare; ohne Vermögen: 3 Lunare; EP-Stufen zählen nicht', async () => {
    const { erschaffungsVermoegen, startvermoegen } = await import('../regelwerk/grwListen');
    expect(startvermoegen(2)?.geld).toEqual({ solare: 0, lunare: 20, telare: 0 });
    expect(startvermoegen(0)?.geld.lunare).toBe(3);
    expect(startvermoegen(-2)?.geld).toEqual({ solare: 0, lunare: 0, telare: 0 });
    expect(erschaffungsVermoegen([e('Vermögen', 2), e('Vermögen', 3, 'xp')])).toBe(2);
  });
});
