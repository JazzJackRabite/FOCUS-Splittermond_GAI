import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { regelverstoss } from '../fundament/hausregeln';
import { generateId } from '../utils/id';
import type React from 'react';
import type { CharacterAction, Mastery, AppMode } from '../types';

interface MasteryHandlersParams {
  xpAvailable: number;
  activeSkillForMastery: { name: string; val: number } | null;
  mode?: AppMode;
  masteries?: Record<string, Mastery[]>;
  dispatch: React.Dispatch<CharacterAction>;
}

export function useMasteryHandlers({ xpAvailable, activeSkillForMastery, mode = 'creation', masteries = {}, dispatch }: MasteryHandlersParams) {
  const addMastery = useCallback((
    mName: string, tier: number, isFree: boolean, cost: number,
    page: number | undefined, desc: string | undefined, isCreationBonus: boolean, source: string,
    userNote?: string,
  ) => {
    if ((!isFree && !isCreationBonus && xpAvailable < cost) && regelverstoss('Nicht genügend EP!')) return;
    if (!activeSkillForMastery) return;
    const newMastery: Mastery = {
      id: generateId(), name: mName, tier, cost, isFree, isCreationBonus,
      source: source || 'GRW', page, desc, skill: activeSkillForMastery.name,
      userNote,
    };
    dispatch({ type: 'ADD_MASTERY', payload: { skill: activeSkillForMastery.name, mastery: newMastery } });
    toast.success(`${mName} hinzugefügt`);
  }, [xpAvailable, activeSkillForMastery, dispatch]);

  const removeMastery = useCallback((skill: string, idx: number) => {
    if (mode === 'xp') {
      const list = masteries[skill] ?? [];
      const target = list[idx];
      if ((target?.isCreationBonus || target?.source === 'Erschaffung') && regelverstoss('In der Steigerung können bei der Erschaffung gewählte Meisterschaften nicht entfernt werden.')) return;
    }
    dispatch({ type: 'REMOVE_MASTERY_BY_IDX', payload: { skill, idx } });
  }, [mode, masteries, dispatch]);

  const removeMasteryById = useCallback((skill: string, id: string) => {
    if (mode === 'xp') {
      const list = masteries[skill] ?? [];
      const target = list.find((m) => m.id === id);
      if ((target?.isCreationBonus || target?.source === 'Erschaffung') && regelverstoss('In der Steigerung können bei der Erschaffung gewählte Meisterschaften nicht entfernt werden.')) return;
    }
    dispatch({ type: 'REMOVE_MASTERY_BY_ID', payload: { skill, id } });
    toast.success('Meisterschaft entfernt');
  }, [mode, masteries, dispatch]);

  return { addMastery, removeMastery, removeMasteryById };
}
