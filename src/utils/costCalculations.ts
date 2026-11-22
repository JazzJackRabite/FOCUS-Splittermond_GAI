/*
 * Kosten in Erfahrungspunkten aus den Kernregeln des Grundregelwerk-Pakets (regelwerk/steigerungsregeln.ts, GRW S. 87).
 * Ohne Paket kosten Steigerungen nichts (der Editor startet erst mit geladenem Paket).
 */
import { kostenAttribut, kostenFertigkeitspunkt, kostenMeisterschaft, kostenRessourcenpunkt, kostenSprache, kostenStaerke, kostenZauber } from '../regelwerk/steigerungsregeln';

/** Kosten eines Fertigkeitspunkts; nextVal ist der Wert nach der Steigerung */
export const getSkillXpCost = (nextVal: number): number => kostenFertigkeitspunkt(nextVal) ?? 0;

/** Kosten einer Attributsteigerung; currentInc ist die Zahl der bisherigen Steigerungen */
export const getAttrXpCost = (currentInc: number): number => kostenAttribut(currentInc + 1) ?? 0;

/** Kosten nach Art und Stufe (Attribut, Fertigkeit, Stärke, Ressource, Sprache, Meisterschaft, Zauber) */
export const calculateItemCost = (
  type: 'attribute' | 'skill' | 'strength' | 'resource' | 'language' | 'mastery' | 'spell',
  levelOrRank: number
): number => {
  switch (type) {
    case 'attribute': return kostenAttribut(levelOrRank) ?? 0;
    case 'skill': return getSkillXpCost(levelOrRank);
    case 'strength': return kostenStaerke(levelOrRank) ?? 0;
    case 'resource': return kostenRessourcenpunkt() ?? 0;
    case 'language': return kostenSprache() ?? 0;
    case 'mastery': return kostenMeisterschaft(levelOrRank) ?? 0;
    case 'spell': return kostenZauber(levelOrRank) ?? 0;
    default: return 0;
  }
};
