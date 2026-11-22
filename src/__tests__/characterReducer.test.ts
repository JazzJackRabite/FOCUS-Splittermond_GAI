import { describe, it, expect } from 'vitest';
import { useCharacterState, DEFAULT_STATE } from '../hooks/useCharacterState';
import { renderHook, act } from '@testing-library/react';
import type { CharacterState, HealthSlot } from '../types';

describe('Character Reducer and Advancement System', () => {
  it('handles race changes and automatic strengths updates', () => {
    const { result } = renderHook(() => useCharacterState());

    act(() => {
      result.current.dispatch({
        type: 'SET_RACE',
        payload: {
          race: 'Zwerg',
          racialStrengths: [
            { name: 'Giftresistenz', level: 1, source: 'creation', isRacial: true, pointCost: 0, isFree: true },
            { name: 'Robust', level: 1, source: 'creation', isRacial: true, pointCost: 0, isFree: true },
            { name: 'Orientierungssinn', level: 1, source: 'creation', isRacial: true, pointCost: 0, isFree: true },
          ],
          keptStrengths: [],
        },
      });
    });

    expect(result.current.state.race).toBe('Zwerg');
    expect(result.current.state.strengthsList).toHaveLength(3);
    expect(result.current.state.strengthsList.some((s) => s.name === 'Giftresistenz')).toBe(true);
  });

  it('automatically grants free Kulturkunde when setting home region', () => {
    const { result } = renderHook(() => useCharacterState());

    act(() => {
      result.current.dispatch({
        type: 'SET_HOME_REGION',
        payload: 'Selenia',
      });
    });

    expect(result.current.state.homeRegion).toBe('Selenia');
    const kulturkunde = result.current.state.strengthsList.find((s) => s.name === 'Kulturkunde (Selenia)');
    expect(kulturkunde).toBeDefined();
    expect(kulturkunde?.isFree).toBe(true);
    expect(kulturkunde?.source).toBe('creation');
  });

  it('records advancement log and maintains undo history in XP mode', () => {
    const { result } = renderHook(() => useCharacterState());

    // Switch to XP mode
    act(() => {
      result.current.dispatch({ type: 'SET_MODE', payload: 'xp' });
      result.current.dispatch({ type: 'SET_XP_TOTAL', payload: 100 });
    });

    // Increase skill in XP mode
    act(() => {
      result.current.dispatch({ type: 'MOD_SKILL', payload: { key: 'Akrobatik', delta: 1 } });
    });

    expect(result.current.state.skillsXp['Akrobatik']).toBe(1);
    expect(result.current.state.advancementLog?.length).toBeGreaterThan(0);
    expect(result.current.state.advancementLog?.[0].category).toBe('skill');

    // Undo the advancement
    act(() => {
      result.current.dispatch({ type: 'UNDO_LAST_ADVANCEMENT' });
    });

    expect(result.current.state.skillsXp['Akrobatik'] ?? 0).toBe(0);
  });

  it('correctly calculates XP attribute increases and cost logs', () => {
    const { result } = renderHook(() => useCharacterState());

    act(() => {
      result.current.dispatch({ type: 'SET_MODE', payload: 'xp' });
      result.current.dispatch({ type: 'MOD_ATTR_XP', payload: { key: 'KON', delta: 1 } });
    });

    expect(result.current.state.attrIncrements.KON).toBe(1);
    expect(result.current.state.advancementLog?.[0].xpDelta).toBe(-10); // 1st inc costs 10 EP
  });
});
