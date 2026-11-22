import { mindestpunkteZauber } from '../regelwerk/steigerungsregeln';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { regelverstoss, useHausregeln } from '../fundament/hausregeln';
import { getResolvedSpells } from '../utils/gameResourceManager';
import type React from 'react';
import type { CharacterAction, Spell, AppMode } from '../types';

interface SpellHandlersParams {
  xpAvailable: number;
  spellsList: Spell[];
  activeSkillForSpell: string | null;
  skillsBase: Record<string, number>;
  skillsXp: Record<string, number>;
  mode?: AppMode;
  dispatch: React.Dispatch<CharacterAction>;
}

export function useSpellHandlers({ xpAvailable, spellsList, activeSkillForSpell, skillsBase, skillsXp, mode = 'creation', dispatch }: SpellHandlersParams) {
  const hausregeln = useHausregeln();
  const addSpell = useCallback((spell: Spell, isFree: boolean, cost: number) => {
    if ((!isFree && xpAvailable < cost) && regelverstoss('Nicht genügend EP!')) return;
    dispatch({
      type: 'ADD_SPELL',
      payload: {
        ...spell,
        isFree,
        xpCost: cost,
        cost: spell.cost,
        source: spell.source || 'GRW',
        sourceMode: mode,
      },
    });
    toast.success(`${spell.name} gelernt`);
  }, [xpAvailable, mode, dispatch]);

  const removeSpellByObj = useCallback((spellObj: Spell) => {
    if ((mode === 'xp' && spellObj.sourceMode !== 'xp') && regelverstoss('In der Steigerung können bei der Erschaffung gelernte Zauber nicht entfernt werden.')) return;
    const idx = spellsList.indexOf(spellObj);
    if (idx !== -1) {
      dispatch({ type: 'REMOVE_SPELL_BY_IDX', payload: idx });
      toast.success(`${spellObj.name} entfernt`);
    }
  }, [mode, spellsList, dispatch]);

  const contextSpells: Spell[] = useMemo(() => {
    if (!activeSkillForSpell) return [];
    const magicVal = (skillsBase[activeSkillForSpell] ?? 0) + (skillsXp[activeSkillForSpell] ?? 0);
    const req = [1, 3, 6, 9, 12, 15].map((rueckfall, grad) => mindestpunkteZauber(grad) ?? rueckfall);
    return getResolvedSpells(activeSkillForSpell)
      .filter((spell) => {
        if (magicVal < req[spell.grade] && !hausregeln) return false;
        if (spellsList.some((s) => s.name === spell.name && s.school === spell.school)) return false;
        return true;
      })
      .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name)) as Spell[];
  }, [activeSkillForSpell, skillsBase, skillsXp, spellsList, hausregeln]);

  return { addSpell, removeSpellByObj, contextSpells };
}
