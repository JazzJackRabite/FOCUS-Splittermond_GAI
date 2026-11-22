import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useRegelwerk } from './RegelwerkContext';
import { namenAbgleichen } from './ids';
import type { CharacterAction, CharacterState } from '../types';

/** Nach dem Laden der Regelpakete: Namen, die nicht mehr passen, über die gespeicherten Regel-IDs aktualisieren */
export function useNamensAbgleich(state: CharacterState, dispatch: React.Dispatch<CharacterAction>): void {
  const { katalog } = useRegelwerk();
  useEffect(() => {
    if (!katalog || !state.regelIds) return;
    const { aenderung, umbenannt } = namenAbgleichen(katalog, state);
    if (!umbenannt.length) return;
    dispatch({ type: 'REGEL_NAMEN_ABGLEICHEN', payload: aenderung });
    toast.success(`Nach den Regelpaketen aktualisiert: ${umbenannt.map(u => `„${u.alt}“ → „${u.neu}“`).join(', ')}`, { duration: 8000, id: 'namensabgleich' });
    // nur bei neuem Katalog oder neu geladenem Charakter (regelIds wechseln dann ihre Identität)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [katalog, state.regelIds]);
}
