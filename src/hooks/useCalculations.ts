import { useMemo } from 'react';
import type { CharacterState } from '../types';
import { calculateCharacter, type CharacterCalculationResult } from '../utils/characterCalculations';
import { useRegelwerk } from '../regelwerk/RegelwerkContext';

export type { CharacterCalculationResult };

/**
 * Hook that computes all derived stats, XP costs, and rules constraints
 * using the central, pure calculateCharacter logic.
 */
export function useCalculations(state: CharacterState): CharacterCalculationResult {
  const { katalog } = useRegelwerk(); // neu rechnen, sobald die Regelpakete geladen oder geändert sind
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => calculateCharacter(state), [state, katalog]);
}
