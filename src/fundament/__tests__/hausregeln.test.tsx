/** Grundsatz 7: Sperren als Standard; „Hausregeln erlauben“ macht aus Sperren Warnungen. */
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { aenderungGesperrt, hausregelnErlaubt, regelverstoss, setzeHausregeln, useHausregeln } from '../hausregeln';
import { useItemHandlers } from '../../hooks/useItemHandlers';
import type { CharacterAction } from '../../types';

describe('Hausregeln', () => {
  beforeEach(() => setzeHausregeln(false));

  it('Standard: aus – ein Regelverstoß sperrt', () => {
    expect(hausregelnErlaubt()).toBe(false);
    expect(regelverstoss('Nicht genügend EP!')).toBe(true);
  });

  it('eingeschaltet: ein Regelverstoß warnt nur; die Einstellung bleibt im Browser', () => {
    setzeHausregeln(true);
    expect(regelverstoss('Nicht genügend EP!')).toBe(false);
    expect(localStorage.getItem('fokus_hausregeln')).toBe('1');
  });

  it('Ansichten erfahren vom Umschalten', () => {
    const { result } = renderHook(() => useHausregeln());
    expect(result.current).toBe(false);
    act(() => setzeHausregeln(true));
    expect(result.current).toBe(true);
  });

  it('Steigerung: Stärke ohne genug Erfahrungspunkte ist gesperrt, mit Hausregeln möglich', () => {
    const aktionen: CharacterAction[] = [];
    const { result } = renderHook(() => useItemHandlers({
      state: { mode: 'xp', strengthsList: [], resourcesList: [], weaknessesList: [], languagesList: [], spellsList: [] },
      calc: { creationUsage: { strength: 0, strengthLimit: 6, resource: 0, resourceLimit: 6 } as never, xpAvailable: 3 },
      dispatch: (a) => { aktionen.push(a); },
    }));
    act(() => result.current.addListEntry('strength', 'Beispiel', 1, '', 1, 'GRW', undefined));
    expect(aktionen).toHaveLength(0);
    setzeHausregeln(true);
    act(() => result.current.addListEntry('strength', 'Beispiel', 1, '', 1, 'GRW', undefined));
    expect(aktionen.map((a) => a.type)).toEqual(['ADD_STRENGTH']);
  });

  it('zusammengesetzte Einträge: gesperrt ist nur, was einen Verstoß neu schafft oder vergrößert', () => {
    const v = (schluessel: string, mass: number) => ({ text: schluessel, schluessel, mass });
    expect(aenderungGesperrt([], [v('ep', 2)])).toBe(true);
    expect(aenderungGesperrt([v('ep', 2)], [v('ep', 3)])).toBe(true);
    expect(aenderungGesperrt([v('ep', 3)], [v('ep', 2)])).toBe(false);
    expect(aenderungGesperrt([v('ep', 3)], [v('ep', 3)])).toBe(false);
    expect(aenderungGesperrt([v('ep', 3)], [])).toBe(false);
    setzeHausregeln(true);
    expect(aenderungGesperrt([], [v('ep', 2)])).toBe(false);
  });
});
