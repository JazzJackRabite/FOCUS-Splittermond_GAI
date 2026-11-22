import React, { createContext, useContext } from 'react';
import type { CharacterAction, CharacterState } from '../types';
import type { useCalculations } from '../hooks/useCalculations';

interface CharacterContextValue {
  state: CharacterState;
  dispatch: React.Dispatch<CharacterAction>;
  calc: ReturnType<typeof useCalculations>;
}

export const CharacterContext = createContext<CharacterContextValue | null>(null);

export function useCharacter(): CharacterContextValue {
  const ctx = useContext(CharacterContext);
  if (!ctx) {
    throw new Error('useCharacter must be used within CharacterProvider');
  }
  return ctx;
}
