/**
 * Vertraute (GRW: Stärke Tiervertrauter; Bestienmeister: Abrichtungen und Meisterschaften für Vertraute).
 * „Die Magie“ verweist für Vertraute nur auf diese Regeln. Was zur Vertrautenmagie gehört, steht im Paket:
 * Meisterschaften mit `vertrautenmagie` (Datenseite: setzen die Stärke Tiervertrauter voraus, auch über andere
 * Meisterschaften) und Zauber mit dem Typus „Vertrauter“ (`typus`).
 */
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';

const ZAUBER_TYPUS = 'Vertrauter';

/** Meisterschaften der Vertrautenmagie, die der Abenteurer hat (IDs aus seinen Meisterschaften) */
export function vertrautenMeisterschaften(k: Katalog, msIds: string[]): Eintrag[] {
  return msIds.map(id => k.get(id)).filter((e): e is Eintrag => !!e && !!e.daten.vertrautenmagie)
    .filter((e, i, l) => l.findIndex(x => x.id === e.id) === i);
}

/** alle Meisterschaften der Vertrautenmagie im Katalog (zur Übersicht) */
export function alleVertrautenMeisterschaften(k: Katalog): Eintrag[] {
  return Object.values(k.eintraege).filter(e => e.typ === 'meisterschaft' && !!e.daten.vertrautenmagie);
}

/** Zauber des Typus „Vertrauter“, die der Abenteurer kennt (nach Namen seiner Zauberliste) */
export function vertrautenZauber(k: Katalog, namen: string[]): Eintrag[] {
  const kennt = new Set(namen);
  return Object.values(k.eintraege).filter(e => e.typ === 'zauber' && (e.daten.typus ?? []).includes(ZAUBER_TYPUS) && kennt.has(e.name));
}

/** alle Zauber des Typus „Vertrauter“ im Katalog */
export function alleVertrautenZauber(k: Katalog): Eintrag[] {
  return Object.values(k.eintraege).filter(e => e.typ === 'zauber' && (e.daten.typus ?? []).includes(ZAUBER_TYPUS));
}

/** Kurztext eines Eintrags (Beschreibung bzw. Wirkung) */
export const kurzText = (e: Eintrag): string => String(e.daten.beschreibung ?? e.daten.wirkung ?? '');
