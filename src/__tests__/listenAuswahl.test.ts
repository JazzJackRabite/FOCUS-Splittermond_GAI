/** Stärken, Ressourcen, Sprachen: was nach den Paketdaten noch wählbar ist (Praxistest Liora, HG 4) */
import { describe, expect, it, vi } from 'vitest';
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

describe('Charakter wechseln', () => {
  it('ein neu geladener Charakter erbt keine Kulturwahl, Begleiter oder Relikte des vorherigen', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => { result.current.dispatch({ type: 'LOAD_STATE', payload: {
      name: 'A', erschaffung: { kultur: { modul: 'grw:kultur:selenia', wahl: {} } } as never,
      begleiter: [{ id: 'grw:kreatur:falke', art: 'tier', name: 'Falke' }] as never, xpTotal: 2015, mode: 'xp',
    } }); });
    expect(result.current.state.erschaffung).toBeTruthy();
    act(() => { result.current.dispatch({ type: 'LOAD_STATE', payload: { name: 'B', xpTotal: 15, mode: 'creation' } }); });
    expect(result.current.state.name).toBe('B');
    expect(result.current.state.erschaffung).toBeUndefined();
    expect(result.current.state.begleiter ?? []).toHaveLength(0);
    expect(result.current.state.xpTotal).toBe(15);
  });
});

describe('Ressource bei der Erschaffung', () => {
  it('Mentor 1 aus der Abstammung plus Mentor 1 frei gekauft: ein Eintrag Mentor 2', () => {
    const { result } = renderHook(() => useCharacterState());
    for (let i = 0; i < 2; i++) {
      act(() => { result.current.dispatch({ type: 'ADD_RESOURCE', payload: { name: 'Mentor', level: 1, source: 'creation', pointCost: 1 } }); });
    }
    const m = result.current.state.resourcesList.filter((r) => r.name === 'Mentor');
    expect(m).toHaveLength(1);
    expect(m[0].level).toBe(2);
  });

  it('Kreatur ist laut Paket mehrfach erwerbbar: zwei Tiere bleiben zwei Einträge, ohne gemeinsame Obergrenze', () => {
    const kreatur = grwRessourcen().find((r) => r.name === 'Kreatur')!;
    expect(kreatur.mehrfach).toBe(true);
    expect(listenSperre('resource', kreatur, 'Kreatur', 'xp', [e('Kreatur', 6)]).grund).toBeNull();
    expect(grwRessourcen().find((r) => r.name === 'Vermögen')!.mehrfach).toBeUndefined();
    const { result } = renderHook(() => useCharacterState());
    for (let i = 0; i < 2; i++) {
      act(() => { result.current.dispatch({ type: 'ADD_RESOURCE', payload: { name: 'Kreatur', level: 1, source: 'creation', pointCost: 1 } }); });
    }
    expect(result.current.state.resourcesList.filter((r) => r.name === 'Kreatur')).toHaveLength(2);
  });
});

describe('Angezeigte Würfel', () => {
  it('Großmeister: von 2, 6, 2 zählen 6 und 2; Sicherheit: der höchste; Patzer: die zwei niedrigsten ohne Großmeisterwürfel', async () => {
    const { gezaehlteWuerfel } = await import('../utils/wuerfeln');
    expect(gezaehlteWuerfel([2, 6, 2], 'standard', false, true).map(i => [2, 6, 2][i]).sort()).toEqual([2, 6]);
    expect(gezaehlteWuerfel([3, 9], 'safe', false)).toEqual([1]);
    expect(gezaehlteWuerfel([1, 1, 9], 'standard', true, true)).toEqual([0, 1]);
    expect(gezaehlteWuerfel([4, 7, 2, 9], 'risk', false)).toEqual([1, 3]);
  });
});

describe('Heilung', () => {
  it('30 Schaden, 10 geheilt: 20 bleiben (der Protokolleintrag mit amount 0 heilt nichts)', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => { result.current.dispatch({ type: 'PLAY_RESET', payload: { maxLP: 13, maxFocus: 18, maxSplitter: 6 } }); });
    act(() => { result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 13, amount: 30 } }); });
    act(() => { result.current.dispatch({ type: 'PLAY_UNDO_DAMAGE', payload: { kind: 'consumed', amount: 10, maxLP: 13 } }); });
    act(() => { result.current.dispatch({ type: 'PLAY_UNDO_DAMAGE', payload: { kind: 'consumed', amount: 0, maxLP: 13 } }); });
    expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(20);
  });
});

describe('Ressource steigern mit EP', () => {
  it('Relikt 2 aus der Erschaffung um 1 gesteigert: Stufe 3, 7 EP, Erschaffungspunkte bleiben 2', async () => {


    const { result } = renderHook(() => useCharacterState());
    act(() => { result.current.dispatch({ type: 'ADD_RESOURCE', payload: { name: 'Relikt', level: 2, source: 'creation', pointCost: 1 } }); });
    act(() => { result.current.dispatch({ type: 'SET_MODE', payload: 'xp' } as never); });
    act(() => { result.current.dispatch({ type: 'RESOURCE_STEIGERN', payload: { index: 0, stufen: 1 } }); });
    const r = result.current.state.resourcesList[0];
    expect(r.level).toBe(3);
    expect(r.xpStufen).toBe(1);
    expect(result.current.state.advancementLog?.[0].xpDelta).toBe(-7);
  });
});

describe('Relikte je Ressource', () => {
  it('Relikt 2 + Relikt 2 (mehrfach): ein Relikt höchstens 2 Punkte; das zweite wieder 2; ohne mehrfach die Summe', async () => {
    const { reliktFrei } = await import('../regelwerk/relikte');
    expect(reliktFrei([2, 2], true, [])).toBe(2);
    expect(reliktFrei([2, 2], true, [2])).toBe(2);
    expect(reliktFrei([2, 2], true, [2, 2])).toBe(0);
    expect(reliktFrei([3, 1], true, [1])).toBe(3);
    expect(reliktFrei([2, 2], false, [1])).toBe(3);
  });
});

describe('Erschaffung: Schritt 7 überzogen', () => {
  it('nennt die Fertigkeiten, die über den Grenzen der Ausbildung liegen', async () => {
    const { pruefeErschaffungImEditor } = await import('../regelwerk/erschaffungEditor');
    const { DEFAULT_STATE } = await import('../hooks/useCharacterState');
    const st = { ...DEFAULT_STATE, race: 'Gnom', skillsBase: { Feuermagie: 6, Verwandlungsmagie: 6, Felsmagie: 6, Bannmagie: 6, Windmagie: 6 } } as never;
    const p = pruefeErschaffungImEditor(st)!;
    expect(p.hinweise.some(h => /Schritt 7 trägt .*Magie/.test(h))).toBe(true);
  });
});

describe('Modulwahl „eine Nahkampffertigkeit“', () => {
  it('Landadel bietet keine Schuss- oder Wurfwaffen an', async () => {
    const { modulAuswahlListe } = await import('../regelwerk/erschaffungEditor');
    const { aktiverKatalog } = await import('../regelwerk/bruecke');
    const k = aktiverKatalog()!;
    const gr = (k.get('grw:abstammung:landadel')!.daten.modulwerte as { fertigkeiten: never[] }).fertigkeiten[0];
    const namen = modulAuswahlListe(k, gr).map(o => o.text);
    expect(namen).toContain('Klingenwaffen');
    expect(namen).not.toContain('Schusswaffen');
    expect(namen).not.toContain('Wurfwaffen');
  });
});

describe('Gefolge', () => {
  it('Tabelle mit „jeder weitere Punkt“: keine Höchststufe 1', () => {
    expect(grwRessourcen().find((r) => r.name === 'Gefolge')!.maxStufe).toBeUndefined();
    expect(listenSperre('resource', grwRessourcen().find((r) => r.name === 'Gefolge')!, 'Gefolge', 'creation', [e('Gefolge', 1)]).restStufen).toBe(5);
  });
});

describe('Schwäche ablegen', () => {
  it('in der Steigerung einmal je neuem Heldengrad (GRW S. 83–84, 88)', async () => {
    const { useItemHandlers } = await import('../hooks/useItemHandlers');
    const dispatch = vi.fn();
    const basis = { mode: 'xp' as const, strengthsList: [], resourcesList: [], weaknessesList: [e('Hitzkopf')], languagesList: [], spellsList: [] };
    const calc = { creationUsage: {} as never, xpAvailable: 100 };
    const a = renderHook(() => useItemHandlers({ state: { ...basis, schwaechenHg: 2 }, calc: { ...calc, heldengradNr: 2 }, dispatch }));
    act(() => a.result.current.removeListEntry('weakness', 0));
    expect(dispatch).not.toHaveBeenCalled();
    const b = renderHook(() => useItemHandlers({ state: { ...basis, schwaechenHg: 2 }, calc: { ...calc, heldengradNr: 3 }, dispatch }));
    act(() => b.result.current.removeListEntry('weakness', 0));
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_WEAKNESS', payload: 0 });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SCHWAECHEN_HG', payload: 3 });
  });
});
