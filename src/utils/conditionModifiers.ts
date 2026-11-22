import type { StatusCondition } from '../types';
import { aktiverKatalog } from '../regelwerk/bruecke';
import { positionsText } from '../regelwerk/kampflage';

import type { Probenbereich } from '../types/regeldaten';
import { zustand, zustandQuelle } from '../regelwerk/zustaende';
import { grwFertigkeitsKategorien, grwFertigkeitsattribute } from '../regelwerk/grwListen';

export interface ActiveRollModifier {
  id: string;
  source: 'wound' | 'condition' | 'behinderung';
  label: string;
  malus: number;
  active: boolean;
  description?: string;
}

/**
 * In Splittermond (GRW S. 187):
 * Behinderung gives a malus equal to its value on all checks for general skills (Allgemeine Fertigkeiten)
 * in which Beweglichkeit (BEW) is used. Combat skills and magic schools are explicitly excluded.
 */
export const GENERAL_BEW_SKILLS = [
  'Akrobatik',
  'Athletik',
  'Fingerfertigkeit',
  'Heimlichkeit',
  'Schlösser & Fallen',
  'Seefahrt',
  'Tierführung',
] as const;

export function isSkillAffectedByBehinderung(skillName: string): boolean {
  return (GENERAL_BEW_SKILLS as readonly string[]).includes(skillName);
}

/** Fertigkeitsgruppe einer Fertigkeit nach ihrem Namen */
export function probenbereich(fertigkeit: string): Probenbereich {
  if (grwFertigkeitsKategorien().COMBAT.includes(fertigkeit)) return 'kampf';
  if (grwFertigkeitsKategorien().MAGIC.includes(fertigkeit)) return 'magie';
  return 'allgemein';
}

export type { Probenbereich } from '../types/regeldaten';

export interface Zustandskontext {
  /** Fertigkeitsgruppe der Probe; ohne Angabe gilt „allgemein“ */
  bereich?: Probenbereich;
  /** aktueller Wundabzug (enthält Verwundet schon; nur noch zur Auskunft) */
  wundabzug?: number;
  /** Name der Fertigkeit oder Magieschule – für Zustände, die an Attributen hängen */
  fertigkeit?: string;
}

/** Abzug auf eigene Angriffe im Liegen aus der Tabelle der Kampfpositionen (GRW S. 170); Rückfall −6 */
function liegendEigeneAngriffe(): number {
  const d = aktiverKatalog()?.get('grw:regel:kampf-regeln:kampfpositionen')?.daten as { tabellen?: { zeilen?: string[][] }[] } | undefined;
  for (const t of d?.tabellen ?? []) {
    const zeile = t.zeilen?.find((z) => z[0] === 'Liegend, Nahkampf');
    const wert = Number(String(zeile?.[1] ?? '').replace('−', '-'));
    if (zeile && Number.isFinite(wert) && wert !== 0) return wert;
  }
  return -6;
}

/**
 * Abzug eines Zustands auf eine Probe. Die Zahlen stehen als Daten in data/zustaende.ts, nicht hier.
 * null = der Zustand ändert den Probenwert nicht (z. B. Benommen: verlangsamt nur; Angsterfüllt: nur Sicherheitswürfe).
 * „Liegend“ ist eine Kampfposition (GRW S. 170) und kommt aus der Tabelle der Kampfpositionen im Paket.
 */
export function getConditionMalus(condition: StatusCondition, kontext: Zustandskontext = {}): { label: string; malus: number; description?: string; vorausgewaehlt?: boolean } | null {
  const level = condition.level || 1;
  const bereich = kontext.bereich ?? 'allgemein';

  if (condition.key === 'Liegend') {
    if (bereich !== 'kampf') return null;
    const malus = liegendEigeneAngriffe();
    // Text aus der Tabelle der Kampfpositionen im Paket (GRW S. 170)
    return { label: 'Liegend', malus, description: positionsText('Liegend') };
  }

  // Zahlen aus dem Regelpaket (daten.zustandswirkung); ohne Paket der Grundregelwerk-Rückfall
  const z = zustand(condition.key);
  const p = z?.wirkung?.probe;
  if (!z || !p) return null;
  const kurz = getConditionDescription(condition);
  const label = z.mitStufe ? `${condition.key} ${level}` : condition.key;

  // Verwundet u. ä. verschiebt die Gesundheitsstufe; das steckt schon im Wundabzug (wundstufenVerschiebung), kein zweiter Abzug
  if (p.art === 'wundstufe') return null;
  if (p.bereiche && !p.bereiche.includes(bereich)) return null;
  if (p.attribute) {
    // hängt an Attributen: gilt nur, wenn die Fertigkeit bekannt ist und eines der Attribute nutzt
    const attribute = kontext.fertigkeit ? grwFertigkeitsattribute()[kontext.fertigkeit] : null;
    if (!attribute || !attribute.some((x) => p.attribute!.includes(x))) return null;
  }
  const stufe = Math.min(level, p.hoechststufe ?? level);
  const malus = (p.fest ?? 0) + (p.pro_stufe ?? 0) * stufe;
  // „nur bei Sicht“ (Geblendet): bei Angriffen und Zaubern gesetzt; bei Fertigkeitsproben abwählbar und nicht vorausgewählt
  const vorausgewaehlt = p.nur !== 'sicht' || bereich !== 'allgemein';
  return malus === 0 ? null : { label, malus, description: kurz, vorausgewaehlt };
}

/** Beschreibung eines Zustands aus dem Regelpaket (ohne Paket leer; „Liegend“: Text der Kampfposition) */
export function getConditionDescription(condition: StatusCondition): string {
  if (condition.key === 'Liegend') return getConditionMalus(condition, { bereich: 'kampf' })?.description ?? '';
  return zustand(condition.key)?.beschreibung ?? '';
}

/** Text für die Anzeige beim Überfahren mit der Maus: Beschreibung und Quelle mit Seite */
export function zustandTooltip(condition: StatusCondition): string {
  const q = zustandQuelle(condition.key);
  const b = getConditionDescription(condition);
  return [b, q && `Quelle: ${q}`].filter(Boolean).join('\n\n');
}

export function getActiveRollModifiers(
  conditions: StatusCondition[] = [],
  woundPenalty: number = 0,
  healthLevelName: string = 'Unverletzt',
  behinderung: number = 0,
  isBehinderungApplicable: boolean = false,
  bereich: Probenbereich = 'allgemein',
  fertigkeit?: string
): ActiveRollModifier[] {
  const result: ActiveRollModifier[] = [];

  // Behinderung (Rüstungs- und Lastabzug auf allgemeine Fertigkeiten mit Beweglichkeit)
  if (behinderung > 0 && isBehinderungApplicable) {
    result.push({
      id: 'behinderung',
      source: 'behinderung',
      label: `Behinderung (${behinderung})`,
      malus: -behinderung,
      active: true,
      description: `Rüstungs- und Lastbehinderung (−${behinderung}) auf Fertigkeiten mit Beweglichkeit`,
    });
  }

  // Health / Wound penalty (Verwundet u. ä. steckt schon im Wundabzug; sie stehen in der Beschriftung)
  const verschiebende = conditions.filter((c) => zustand(c.key)?.wirkung?.probe?.art === 'wundstufe').map((c) => `${c.key} ${c.level || 1}`);
  if (woundPenalty !== 0) {
    result.push({
      id: 'wound_penalty',
      source: 'wound',
      label: `Wundabzug (${[healthLevelName, ...verschiebende].join(', ')})`,
      malus: woundPenalty,
      active: true,
      description: `Gesundheitsstatus: ${healthLevelName}`,
    });
  }

  // Active status conditions
  conditions.forEach((c) => {
    const mod = getConditionMalus(c, { bereich, wundabzug: woundPenalty, fertigkeit });
    if (mod) {
      result.push({
        id: c.id,
        source: 'condition',
        label: mod.label,
        malus: mod.malus,
        active: mod.vorausgewaehlt !== false,
        description: mod.description,
      });
    }
  });

  return result;
}
