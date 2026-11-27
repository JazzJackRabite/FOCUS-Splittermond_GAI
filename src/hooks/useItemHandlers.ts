import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { regelverstoss } from '../fundament/hausregeln';
import { listenSperre, type ListenArt, type ListenDaten } from '../regelwerk/listenAuswahl';
import { getResolvedResources, getResolvedStrengths } from '../utils/gameResourceManager';
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
    /** Heldengrad, auf dem zuletzt eine Schwäche abgelegt wurde */
    schwaechenHg?: number;
  };
  calc: {
    creationUsage: CreationUsage;
    xpAvailable: number;
    /** aktueller Heldengrad (Nummer) */
    heldengradNr?: number;
  };
  dispatch: React.Dispatch<CharacterAction>;
}

export function useItemHandlers({ state, calc, dispatch }: ItemHandlersParams) {
  const { mode, strengthsList, resourcesList, weaknessesList, languagesList, spellsList, schwaechenHg } = state;
  const { creationUsage, xpAvailable, heldengradNr } = calc;

  const addListEntry = useCallback((
    type: string, name: string, level: number, desc: string,
    pointCost: number, source: string, page: number | undefined, isFree = false, zielIndex?: number,
  ) => {
    const sourceMode = mode;
    if (type === 'weakness') {
      dispatch({ type: 'ADD_WEAKNESS', payload: { name, level: 1, source: sourceMode, desc, pointCost: 0, sourceRef: source, page } });
      toast.success(`${name} hinzugefügt`);
      return;
    }
    if (type === 'strength' || type === 'resource' || type === 'language') {
      const liste = type === 'strength' ? strengthsList : type === 'resource' ? resourcesList : languagesList;
      const daten = (type === 'strength' ? getResolvedStrengths() : type === 'resource' ? getResolvedResources().list : [])
        .find((d) => d.name === name) as ListenDaten | undefined;
      const sp = listenSperre(type as ListenArt, daten ?? null, name, mode, liste);
      if (sp.grund && regelverstoss(`${name}: ${sp.grund}`)) return;
      if (zielIndex === undefined && !sp.grund && type !== 'language' && level > sp.restStufen && regelverstoss(`${name}: höchstens ${sp.restStufen} Stufe(n) mehr möglich`)) return;
      if (zielIndex !== undefined) {
        const hoechst = (daten as { maxStufe?: number } | undefined)?.maxStufe ?? 6;
        const jetzt = Number(resourcesList[zielIndex]?.level) || 0;
        if (jetzt + level > hoechst && regelverstoss(`${name}: höchstens Stufe ${hoechst}`)) return;
      }
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
    else if (type === 'resource' && zielIndex !== undefined) dispatch({ type: 'RESOURCE_STEIGERN', payload: { index: zielIndex, stufen: level } });
    else if (type === 'resource') dispatch({ type: 'ADD_RESOURCE', payload: newItem });
    else if (type === 'language') dispatch({ type: 'ADD_LANGUAGE', payload: newItem });
    toast.success(`${name} hinzugefügt`);
  }, [mode, creationUsage, xpAvailable, dispatch, strengthsList, resourcesList, languagesList]);

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
      // GRW S. 83–84, 88: beim Erreichen eines neuen Heldengrades eine Schwäche ablegen oder ersetzen (einmal je Heldengrad)
      const hg = heldengradNr ?? 1;
      if (mode === 'xp' && hg <= (schwaechenHg ?? 1)
        && regelverstoss('Eine Schwäche lässt sich nur beim Erreichen eines neuen Heldengrades ablegen (GRW S. 83–84, 88) – auf diesem Heldengrad schon geschehen oder noch kein neuer erreicht.')) return;
      itemName = weaknessesList[idx]?.name ?? '';
      dispatch({ type: 'REMOVE_WEAKNESS', payload: idx });
      if (mode === 'xp') dispatch({ type: 'SCHWAECHEN_HG', payload: hg });
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
  }, [mode, strengthsList, resourcesList, weaknessesList, languagesList, spellsList, dispatch, heldengradNr, schwaechenHg]);

  return { addListEntry, removeListEntry };
}
