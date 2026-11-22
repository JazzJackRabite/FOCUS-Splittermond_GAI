import type { MasteryEntry, PrerequisiteCondition } from '../types/regeldaten';
import type { Mastery, AppMode } from '../types';
import { aktiverKatalog, bedingungsCharakter, voraussetzungAusKatalog } from '../regelwerk/bruecke';
import { schwellenwert } from '../regelwerk/grwListen';

export interface PrerequisiteValidationContext {
  allCharacterMasteries: Array<Mastery | string>;
  skills: Record<string, number>;
  resources?: Array<{ name: string; level?: number; [k: string]: any }>;
  strengths?: Array<{ name: string; level?: number; [k: string]: any }>;
  spells?: Array<{ name: string; school?: string; [k: string]: any }>;
  culture?: string;
  race?: string;
  mode?: AppMode;
  creationBudget?: number;
  isCreationBonus?: boolean;
}

export interface PrerequisiteCheckResult {
  canLearn: boolean;
  thresholdMet: boolean;
  prerequisitesMet: boolean;
  tier: number;
  minSkillValue: number;
  currentSkillVal: number;
  thresholdReason?: string;
  prerequisiteReason?: string;
  missingPrerequisites: string[];
}

/**
 * Normalizes a mastery name by removing the threshold suffix like ' (S1)', ' (S2)'
 */
export function normalizeMasteryName(name: string): string {
  return name.replace(/\s*\(S\d\)/g, '').trim();
}

/**
 * Returns the threshold level (Schwelle 1..4) of a mastery
 */
export function getMasteryTier(mastery: MasteryEntry | { name: string; tier?: number }): number {
  if (typeof mastery.tier === 'number' && mastery.tier >= 1 && mastery.tier <= 4) {
    return mastery.tier;
  }
  const match = mastery.name.match(/\(S(\d)\)/);
  if (match?.[1]) {
    return parseInt(match[1], 10);
  }
  return 1;
}

/**
 * Returns the required skill value for a given mastery threshold (Schwellenwert)
 * – aus dem GRW-Paket (Kapitel „Meisterschaften erhalten“: 6, 9, 12, 15), siehe regelwerk/grwListen.ts
 */
export function getRequiredSkillValue(tier: number): number {
  return schwellenwert(tier);
}

/**
 * Evaluates whether a character meets the prerequisites and threshold requirements
 * to learn a specific mastery.
 */
export function checkMasteryPrerequisites(
  mastery: MasteryEntry,
  currentSkillName: string,
  currentSkillVal: number,
  context: PrerequisiteValidationContext
): PrerequisiteCheckResult {
  const tier = mastery.tier || getMasteryTier(mastery);
  const minSkillValue = mastery.minSkillValue || getRequiredSkillValue(tier);
  const mode = context.mode || 'creation';
  const isCreation = mode === 'creation';

  // 1. Schwellenvoraussetzung (Threshold check)
  let thresholdMet = false;
  let thresholdReason: string | undefined;

  if (isCreation) {
    // Bei der Erschaffung reicht der höchste Fertigkeitswert nur für Schwelle 1
    if (tier > 1) {
      thresholdMet = false;
      thresholdReason = `Schwelle ${tier} erfordert Fertigkeitswert ${minSkillValue} (In der Heldenerstellung können nur Schwelle-1-Meisterschaften gewählt werden).`;
    } else {
      // Schwelle 1: Fertigkeitswert nach Paket (schwellenwert); freie Meisterschaften der Erschaffung schon ab 1 Punkt
      if (currentSkillVal >= minSkillValue) {
        thresholdMet = true;
      } else if (
        context.isCreationBonus ||
        (typeof context.creationBudget === 'number' && context.creationBudget > 0 && currentSkillVal >= 1)
      ) {
        thresholdMet = true;
      } else {
        thresholdMet = false;
        thresholdReason = `Schwelle 1 erfordert Fertigkeitswert ${minSkillValue} (aktuell: ${currentSkillVal}).`;
      }
    }
  } else {
    // In Advancement (XP) or Play mode:
    if (currentSkillVal >= minSkillValue) {
      thresholdMet = true;
    } else {
      thresholdMet = false;
      thresholdReason = `Schwelle ${tier} erfordert Fertigkeitswert ${minSkillValue} (aktuell: ${currentSkillVal}).`;
    }
  }

  // 2. Spezifische Voraussetzungen: formal aus dem Regelpaket (voraussetzungen mit IDs), GRW und hochgeladene Grimoires
  const missingPrerequisites: string[] = [];

  let spielleitung: string | undefined;
  const regelId = (mastery as MasteryEntry & { regelId?: string }).regelId ?? (mastery.id && /^[a-z0-9]+:[a-z_]+:/.test(mastery.id) ? mastery.id : undefined);
  const ausKatalog = voraussetzungAusKatalog(mastery.name, mastery.skill || currentSkillName, regelId, () => bedingungsCharakter(aktiverKatalog()!, {
    meisterschaften: context.allCharacterMasteries || [],
    fertigkeiten: context.skills || {},
    ressourcen: context.resources || [],
    zauber: context.spells || [],
    staerken: context.strengths || [],
    rasse: context.race,
    fertigkeit: currentSkillName,
  }));
  if (ausKatalog) {
    if (ausKatalog.ergebnis === false) missingPrerequisites.push(ausKatalog.text || 'Voraussetzung nicht erfüllt');
    if (ausKatalog.ergebnis === 'offen') spielleitung = `Entscheidung der Spielleitung: ${ausKatalog.text}`;
  } else if (mastery.prerequisiteText?.trim()) {
    // Eintrag ohne formale Voraussetzung im Paket: die Spielleitung entscheidet
    spielleitung = `Entscheidung der Spielleitung: ${mastery.prerequisiteText.trim()}`;
  }

  const prerequisitesMet = missingPrerequisites.length === 0;
  const canLearn = thresholdMet && prerequisitesMet;

  return {
    canLearn,
    thresholdMet,
    prerequisitesMet,
    tier,
    minSkillValue,
    currentSkillVal,
    thresholdReason,
    prerequisiteReason: missingPrerequisites.length > 0 ? missingPrerequisites.join('; ') : spielleitung,
    missingPrerequisites,
  };
}
