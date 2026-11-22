/**
 * Gemeinsame Rast: Ruhephase und Verschnaufpause des Abenteurers wenden die Rastregeln auf alle Begleiter an
 * (`regelwerk/begleiterRast.ts`). Konstitution und Willenskraft kommen aus dem berechneten Wertekasten jedes Begleiters.
 * Ein Eintrag im Protokoll nennt je Begleiter, was geheilt wurde; Rückgängig nimmt Abenteurer und Begleiter zusammen zurück.
 */
import React from 'react';
import { toast } from 'react-hot-toast';
import type { Katalog } from '../../regelwerk/katalog';
import { useRegelwerk } from '../../regelwerk/RegelwerkContext';
import { useCharacter } from '../../context/CharacterContext';
import { usePlaySessionOptional } from '../../context/PlaySessionContext';
import { ruhephaseBegleiter, verschnaufpauseBegleiter } from '../../regelwerk/begleiterRast';
import { generateId } from '../../utils/id';
import { begleiterAnsicht, begleiterTitel } from './ansicht';
import { useBesitzer } from './besitzer';
import { RestSection } from '../play/RestSection';

type Rast = 'ruhephase' | 'verschnaufpause';

export function useBegleiterRast(k: Katalog) {
  const { state, dispatch } = useCharacter();
  const besitzer = useBesitzer(k);
  const play = usePlaySessionOptional();
  const alle = state.begleiter ?? [];

  return {
    anzahl: alle.length,
    rasten: (rast: Rast) => {
      if (!alle.length) return;
      const zeilen: string[] = [];
      const payload = alle.map((b, index) => {
        const z = b.zustand ?? {};
        const e = rast === 'ruhephase' ? ruhephaseBegleiter(k, b.art, z, begleiterAnsicht(k, b, besitzer).w?.attribute) : verschnaufpauseBegleiter(z, k);
        zeilen.push(`${begleiterTitel(b)}: ${e.teile.length ? e.teile.join(', ') : 'nichts zu heilen'}${e.hinweis ? ` – ${e.hinweis}` : ''}`);
        return { index, zustand: e.zustand };
      });
      dispatch({ type: 'BEGLEITER_ZUSTAENDE_SETZEN', payload });
      const titel = rast === 'ruhephase' ? 'Ruhephase der Begleiter' : 'Verschnaufpause der Begleiter';
      // ohne eigenen Rückgängig-Schritt: die Rast des Abenteurers hat den Stand schon gesichert
      play?.setProtocolHistory((prev) => [{
        type: 'action', id: generateId(), category: 'heal', title: titel, description: zeilen.join(' · '),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }, ...prev]);
      toast.success(`${titel}: ${zeilen.join(' · ')}`, { duration: 4500 });
    },
  };
}

type RestProps = React.ComponentProps<typeof RestSection>;

const MitKatalog: React.FC<RestProps & { k: Katalog }> = ({ k, onRuhephase, onVerschnaufpause, ...rest }) => {
  const { anzahl, rasten } = useBegleiterRast(k);
  return (
    <RestSection
      {...rest}
      begleiterAnzahl={anzahl}
      onVerschnaufpause={(o, mit) => { onVerschnaufpause(o); if (mit) rasten('verschnaufpause'); }}
      onRuhephase={(lp, fo, mit) => { onRuhephase(lp, fo); if (mit) rasten('ruhephase'); }}
    />
  );
};

/** Regeneration & Pausen des Abenteurers, mit „Begleiter rasten mit“, sobald Begleiter und Regelpakete da sind */
export const RastMitBegleitern: React.FC<RestProps> = (props) => {
  const { katalog } = useRegelwerk();
  return katalog ? <MitKatalog {...props} k={katalog} /> : <RestSection {...props} />;
};
