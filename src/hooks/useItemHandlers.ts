import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { regelverstoss } from '../fundament/hausregeln';
import type React from 'react';
import type { CharacterAction, ItemEntry, AppMode, Spell, CreationUsage } from '../types';

interface ItemHandlersParams {
  state: {
    mode: AppMode;
    strengthsList: ItemEntry[];
    resourcesList: ItemEntry[];
    weaknessesList: ItemEntry[];
    languagesList: ItemEntry[];
    spellsList: Spell[];
  };
  calc: {
    creationUsage: CreationUsage;
    xpAvailable: number;
  };
  dispatch: React.Dispatch<CharacterAction>;
}

export function useItemHandlers({ state, calc, dispatch }: ItemHandlersParams) {
  const { mode, strengthsList, resourcesList, weaknessesList, languagesList, spellsList } = state;
  const { creationUsage, xpAvailable } = calc;

  const addListEntry = useCallback((
    type: string, name: string, level: number, desc: string,
    pointCost: number, source: string, page: number | undefined, isFree = false,
  ) => {
    const sourceMode = mode;
    if (type === 'weakness') {
      dispatch({ type: 'ADD_WEAKNESS', payload: { name, level: 1, source: sourceMode, desc, pointCost: 0, sourceRef: source, page } });
      toast.success(`${name} hinzugefügt`);
      return;
    }
    const multiplier = type === 'strength' || type === 'resource' ? 7 : 5;
    let cost = 0;
    if (mode === 'creation') {
      cost = isFree ? 0 : level * pointCost;
    } else {
      cost = type === 'language' ? 5 : level * pointCost * multiplier;
    }
    if (mode === 'creation') {
      if (type === 'strength' && creationUsage.strength + cost > creationUsage.strengthLimit && regelverstoss('Nicht genügend Punkte!')) return;
      if (type === 'resource' && creationUsage.resource + cost > creationUsage.resourceLimit && regelverstoss('Nicht genügend Punkte!')) return;
    } else {
      if (xpAvailable < cost && regelverstoss('Nicht genügend EP!')) return;
    }
    const newItem: ItemEntry = { name, level, source: sourceMode, desc, pointCost, isFree, sourceRef: source, page };
    if (type === 'strength') dispatch({ type: 'ADD_STRENGTH', payload: newItem });
    else if (type === 'resource') dispatch({ type: 'ADD_RESOURCE', payload: newItem });
    else if (type === 'language') dispatch({ type: 'ADD_LANGUAGE', payload: newItem });
    toast.success(`${name} hinzugefügt`);
  }, [mode, creationUsage, xpAvailable, dispatch]);

  const removeListEntry = useCallback((type: string, idx: number) => {
    let itemName = '';
    if (type === 'strength') {
      const item = strengthsList[idx];
      if (mode === 'xp' && item?.source !== 'xp' && regelverstoss('In der Steigerung können bei der Erschaffung gewählte Stärken nicht entfernt werden.')) return;
      itemName = item?.name ?? '';
      dispatch({ type: 'REMOVE_STRENGTH', payload: idx });
    } else if (type === 'resource') {
      const item = resourcesList[idx];
      if (mode === 'xp' && item?.source !== 'xp' && regelverstoss('In der Steigerung können bei der Erschaffung gewählte Ressourcen nicht entfernt werden.')) return;
      itemName = item?.name ?? '';
      dispatch({ type: 'REMOVE_RESOURCE', payload: idx });
    } else if (type === 'weakness') {
      if (mode === 'xp' && regelverstoss('In der Steigerung können Schwächen nicht entfernt werden.')) return;
      itemName = weaknessesList[idx]?.name ?? '';
      dispatch({ type: 'REMOVE_WEAKNESS', payload: idx });
    } else if (type === 'language') {
      const item = languagesList[idx];
      if (mode === 'xp' && item?.source !== 'xp' && regelverstoss('In der Steigerung können bei der Erschaffung gewählte Sprachen nicht entfernt werden.')) return;
      itemName = item?.name ?? '';
      dispatch({ type: 'REMOVE_LANGUAGE', payload: idx });
    } else if (type === 'spell') {
      const item = spellsList[idx];
      if (mode === 'xp' && item?.sourceMode !== 'xp' && regelverstoss('In der Steigerung können bei der Erschaffung gelernte Zauber nicht entfernt werden.')) return;
      itemName = item?.name ?? '';
      dispatch({ type: 'REMOVE_SPELL_BY_IDX', payload: idx });
    }
    if (itemName) toast.success(`${itemName} entfernt`);
  }, [mode, strengthsList, resourcesList, weaknessesList, languagesList, spellsList, dispatch]);

  return { addListEntry, removeListEntry };
}
