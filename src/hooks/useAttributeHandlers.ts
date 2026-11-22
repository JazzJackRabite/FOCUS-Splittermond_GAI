import { getAttrXpCost } from '../utils/costCalculations';
import { regelverstoss } from '../fundament/hausregeln';
import { useCallback } from 'react';

import type React from 'react';
import type { CharacterAction, AttrMap, AppMode, CreationUsage } from '../types';
import { grwRassen } from '../regelwerk/grwListen';

interface AttributeHandlersParams {
  state: {
    attrBase: AttrMap;
    attrIncrements: AttrMap;
    raceBonusAttrs: string[];
    mode: AppMode;
    race: string;
  };
  calc: {
    creationUsage: CreationUsage;
    heldengrad: { maxAttrMod: number };
    xpAvailable: number;
  };
  dispatch: React.Dispatch<CharacterAction>;
}

export function useAttributeHandlers({ state, calc, dispatch }: AttributeHandlersParams) {
  const { attrBase, attrIncrements, raceBonusAttrs, mode, race } = state;
  const { creationUsage, heldengrad, xpAvailable } = calc;

  const modAttrBase = useCallback((key: string, delta: number) => {
    const newVal = (attrBase[key as keyof AttrMap] ?? 0) + delta;
    if (newVal < 1) return;
    if (newVal > 3 && regelverstoss('Attribute lassen sich bei der Erschaffung höchstens auf 3 setzen.')) return;
    if (delta > 0 && creationUsage.attr >= 18 && regelverstoss('Alle 18 Attributspunkte sind verteilt.')) return;
    dispatch({ type: 'MOD_ATTR_BASE', payload: { key: key as keyof AttrMap, delta } });
  }, [attrBase, creationUsage.attr, dispatch]);

  const modAttrXP = useCallback((key: string, delta: number) => {
    const currentInc = attrIncrements[key as keyof AttrMap] ?? 0;
    if (delta > 0) {
      if (currentInc >= heldengrad.maxAttrMod && regelverstoss('Mehr Steigerungen dieses Attributs erlaubt der Heldengrad nicht.')) return;
      const cost = getAttrXpCost(currentInc);
      if (xpAvailable < cost && regelverstoss('Nicht genügend EP!')) return;
    } else {
      if (currentInc <= 0) return;
    }
    dispatch({ type: 'MOD_ATTR_XP', payload: { key: key as keyof AttrMap, delta } });
  }, [attrIncrements, heldengrad.maxAttrMod, xpAvailable, dispatch]);

  const toggleRaceBonus = useCallback((attr: string) => {
    if (mode === 'xp') return;
    const max = (grwRassen()[race as keyof ReturnType<typeof grwRassen>] as { freeMods: number }).freeMods;
    if (race === 'Varg' && attr === 'STA') return;
    if (raceBonusAttrs.includes(attr)) {
      dispatch({ type: 'TOGGLE_RACE_BONUS', payload: attr });
    } else if (raceBonusAttrs.length < max || !regelverstoss('Alle freien Attributspunkte der Rasse sind vergeben.')) {
      dispatch({ type: 'TOGGLE_RACE_BONUS', payload: attr });
    }
  }, [mode, race, raceBonusAttrs, dispatch]);

  return { modAttrBase, modAttrXP, toggleRaceBonus };
}
