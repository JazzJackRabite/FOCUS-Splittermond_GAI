import type React from 'react';
import type { Katalog } from '../../../regelwerk/katalog';
import type { Begleiter } from '../../../types';
import type { Besitzer } from '../besitzer';

/** Was jeder Schritt bekommt: Katalog, Entwurf, Änderung des Entwurfs, Besitzer, alle Begleiter, eigene Stelle (beim Bearbeiten) */
export interface SchrittProps {
  k: Katalog;
  b: Begleiter;
  aendern: (a: Partial<Begleiter>) => void;
  besitzer: Besitzer;
  alle: Begleiter[];
  index?: number;
}

export interface Schritt {
  id: string;
  titel: string;
  inhalt: React.FC<SchrittProps>;
  /** Weiter erst, wenn das zutrifft (z. B. Tier gewählt) */
  bereit?: (b: Begleiter) => boolean;
  /** nur beim Erstellen (Grundlage: Art, Tier, Kultur, Korpus – lässt sich danach nicht mehr ändern) */
  nurNeu?: boolean;
}
