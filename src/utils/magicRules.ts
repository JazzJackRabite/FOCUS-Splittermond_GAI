import type { Spell as DbSpell } from '../types/regeldaten';
import { getSpellDescription } from './gameResourceManager';
import type { Spell } from '../types';

import type { Katalog } from '../regelwerk/katalog';
import { aktiverKatalog, idNachName } from '../regelwerk/bruecke';
import { istVerstaerkt, istWaffenlos, kampfwerte, lpWirkung, probenboni, spielwerteDesZaubers, waffenschaden, zielTrifft, geltenderWert } from '../regelwerk/zauberwerte';
import { grwFertigkeitsattribute, grwZauber } from '../regelwerk/grwListen';
import { erfolgsgrade } from '../regelwerk/proben';
import { verstaerkungsZustandText, zauberEgRegeln, zauberErfolgsgrade, type VerstaerkungsZustand, type ZauberErfolgsgrade } from '../regelwerk/zauberEg';

export interface ParsedFocusCost {
  isChanneled: boolean;
  exhausted: number;
  channeled: number;
  consumed: number;
  total: number;
  raw: string;
}

/**
 * Parses Splittermond focus cost strings like "4", "K1", "4V1", "12V3", "K4V1", "K8V2", "K16V4", "20V5"
 *
 * Regel (GRW, Kanalisierte Zauber): Die Zahl hinter V ist ein Teil der Gesamtkosten, nicht zusätzlich.
 * „K6V2 sind 6 kanalisierte Punkte Fokus insgesamt, davon werden 2 sofort verzehrt.“
 * - "4": 4 exhausted focus
 * - "K1": 1 channeled focus
 * - "4V1": total 4 focus (3 exhausted, 1 consumed)
 * - "K4V1": total 4 focus (3 channeled, 1 consumed)
 * - "12V3": total 12 focus (9 exhausted, 3 consumed)
 * - "K8V2": total 8 focus (6 channeled, 2 consumed)
 * `exhausted`/`channeled` sind jeweils nur der nicht verzehrte Anteil.
 */
export function parseFocusCost(costInput?: string | number | null): ParsedFocusCost {
  const raw = String(costInput ?? '0').trim();
  if (!raw || raw === '0' || raw === 'frei' || raw === 'Frei') {
    return { isChanneled: false, exhausted: 0, channeled: 0, consumed: 0, total: 0, raw: '0' };
  }

  let isChanneled = false;
  let exhausted = 0;
  let channeled = 0;
  let consumed = 0;

  const hasK = /K/i.test(raw);
  const vMatch = raw.match(/V(\d+)/i);
  if (vMatch) {
    consumed = parseInt(vMatch[1], 10) || 0;
  }

  if (hasK) {
    isChanneled = true;
    const kMatch = raw.match(/K(\d+)/i);
    if (kMatch) {
      channeled = parseInt(kMatch[1], 10) || 0;
    } else {
      channeled = 1;
    }
  } else {
    // Non-channeled: e.g. "4", "5V2" (insgesamt 5, davon 2 verzehrt)
    const numMatch = raw.match(/^(\d+)/);
    if (numMatch) {
      exhausted = parseInt(numMatch[1], 10) || 0;
    }
  }

  // V ist Teil der genannten Gesamtkosten
  consumed = Math.min(consumed, isChanneled ? channeled : exhausted);
  if (isChanneled) channeled -= consumed; else exhausted -= consumed;
  const total = exhausted + channeled + consumed;
  return {
    isChanneled,
    exhausted,
    channeled,
    consumed,
    total,
    raw,
  };
}

/**
 * Looks up full spell data in the grwZauber() by spell name and optional school.
 */
export function lookupSpellInDb(spellName: string, school?: string): DbSpell | undefined {
  const trimmed = spellName.trim().toLowerCase();
  let found: DbSpell | undefined;
  if (school) {
    found = grwZauber().find(
      (s) => s.name.toLowerCase() === trimmed && s.school.toLowerCase() === school.toLowerCase()
    );
  }
  if (!found) {
    found = grwZauber().find((s) => s.name.toLowerCase() === trimmed);
  }
  if (found) {
    const desc = getSpellDescription(found.name, found.school, found.description);
    return { ...found, description: desc };
  }
  return undefined;
}

/**
 * Merges a character Spell object with its DB entry to get full properties like castTime, range, duration, description, cost string.
 */
export function getFullSpellInfo(spell: Spell): Spell & { dbCost?: string; isChanneled?: boolean } {
  const dbEntry = lookupSpellInDb(spell.name, spell.school);
  const costString = dbEntry?.cost ?? (typeof spell.cost === 'string' ? spell.cost : undefined);
  const parsed = parseFocusCost(costString);

  return {
    ...spell,
    cost: costString ?? spell.cost,
    castTime: spell.castTime || dbEntry?.castTime || '—',
    range: spell.range || dbEntry?.range || '—',
    duration: spell.duration || dbEntry?.duration || (parsed.isChanneled ? 'kanalisiert' : '—'),
    target: spell.target || dbEntry?.target || '—',
    description: spell.description || dbEntry?.description || '',
    page: spell.page || dbEntry?.page,
    source: spell.source || dbEntry?.source || 'GRW',
    dbCost: costString,
    isChanneled: parsed.isChanneled,
    difficulty: spell.difficulty ?? dbEntry?.difficulty,
    difficultyType: spell.difficultyType ?? dbEntry?.difficultyType,
    difficultyValue: spell.difficultyValue ?? dbEntry?.difficultyValue,
  };
}

export interface SpellCastEGCalculation {
  isSuccess: boolean;
  differenz: number;
  eg: number;
  negativeEG: number;
  exhaustedFocusLostOnFailure: number;
  isFumble: boolean;
  isCrit: boolean;
}

/**
 * Calculates success degrees (EG) and failure consequences for a spell roll in Splittermond.
 *
 * Rules:
 * - Difference = total - difficulty
 * - Success: When total >= difficulty and not a fumble.
 *   - 1 EG for every full 3 points above difficulty (Math.floor(diff / 3)).
 *   - Triumph (+3 EG bonus if roll succeeded).
 * - Failure: When total < difficulty or fumble.
 *   - Spell fizzles!
 *   - Player exhausts focus equal to the negative EG:
 *     diff -1 to -3 = 1 neg EG (1 FO exhausted)
 *     diff -4 to -6 = 2 neg EG (2 FO exhausted)
 *     diff -7 to -9 = 3 neg EG (3 FO exhausted)
 *     Fumble adds +3 negative EG penalty.
 */
export function calculateSpellEG(
  totalRoll: number,
  difficulty: number,
  isFumble = false,
  isCrit = false
): SpellCastEGCalculation {
  // Erfolgsgrade nach den Probenregeln des Pakets (regelwerk/proben.ts): Patzer EG −3 (höchstens −1), Triumph +3 nur bei Erfolg;
  // knapp misslungen (−1/−2) ergibt 0 negative EG
  const r = erfolgsgrade(totalRoll, difficulty, isFumble, isCrit);
  if (r.gelungen) {
    return { isSuccess: true, differenz: r.differenz, eg: Math.max(0, r.eg), negativeEG: 0, exhaustedFocusLostOnFailure: 0, isFumble: false, isCrit: r.triumph };
  }
  const negativeEG = Math.max(0, -r.eg);
  return { isSuccess: false, differenz: r.differenz, eg: 0, negativeEG, exhaustedFocusLostOnFailure: negativeEG, isFumble, isCrit: false };
}

export interface SpecificSpellEnhancement {
  id: string;
  egCost: number;
  focusCostRaw: string;
  focusDelta: ParsedFocusCost;
  description: string;
  raw: string;
  /** verursachte Zustände aus dem Paket (nur bei Zaubern aus einem geladenen Paket) */
  zustaende?: VerstaerkungsZustand[];
}

export interface PermissibleSpellModifications {
  rawList: string;
  allowsCastTime: boolean; // Auslösezeit
  allowsExhaustedFocus: boolean; // Erschöpfter Fokus
  allowsChanneledFocus: boolean; // Kanalisierter Fokus
  allowsConsumedFocus: boolean; // Verzehrter Fokus
  allowsRange: boolean; // Reichweite
  allowsDamage: boolean; // Schaden
  allowsDuration: boolean; // Wirkungsdauer
  allowsArea: boolean; // Wirkungsbereich
  allowsEnhance: boolean; // Verstärken
  allowedNames: string[];
  specificEnhancements: SpecificSpellEnhancement[];
}

/**
 * Parst die zusätzlichen Fokuskosten einer Zauber-Verstärkung („Kosten +K1V1“).
 *
 * Die Schreibweise ist dieselbe wie bei den Grundkosten: Die Zahl hinter V ist ein Teil der genannten Punkte, nicht
 * zusätzlich. Beleg (GRW S. 221–222, Verzehrter Fokus): „Für je 3 EG kann 1 Punkt verzehrter Fokus eingespart werden
 * (Kosten -(K)1V1)“ – „1V1“ ist also genau 1 Punkt, und der ist verzehrt.
 * - "+K1V1": +1 Punkt, davon 1 verzehrt  (K4V1 → K5V2)
 * - "+1V1":  +1 Punkt, davon 1 verzehrt  (4V1 → 5V2)
 * - "+K2V2": +2 Punkte, beide verzehrt   (K8V2 → K10V4)
 * - "+2V1":  +2 Punkte, davon 1 verzehrt
 * - "+K1":   +1 kanalisierter Punkt
 */
export function parseEnhancementFocusDelta(rawInput?: string | null): ParsedFocusCost {
  const raw = String(rawInput ?? '0').trim();
  const delta = parseFocusCost(raw.replace(/^\+\s*/, ''));
  return { ...delta, raw: delta.total === 0 ? '0' : raw };
}

/**
 * Parses the permissible modifications ("Zulässige Modifikationen") and specific enhancements
 * from a spell's description or Erfolgsgrade section as stored in the Splittermond GRW database.
 */
function erlaubteOptionen(namen: string[], rawList: string, specificEnhancements: SpecificSpellEnhancement[]): PermissibleSpellModifications {
  const allowedSet = new Set(namen.map((x) => x.toLowerCase()));
  return {
    rawList,
    allowsCastTime: allowedSet.has('auslösezeit'),
    allowsExhaustedFocus: allowedSet.has('erschöpfter fokus'),
    allowsChanneledFocus: allowedSet.has('kanalisierter fokus'),
    allowsConsumedFocus: allowedSet.has('verzehrter fokus'),
    allowsRange: allowedSet.has('reichweite'),
    allowsDamage: allowedSet.has('schaden'),
    allowsDuration: allowedSet.has('wirkungsdauer'),
    allowsArea: allowedSet.has('wirkungsbereich'),
    allowsEnhance: allowedSet.has('verstärken'),
    allowedNames: namen,
    specificEnhancements,
  };
}

/** Optionen und Verstärkungen aus dem Paketfeld erfolgsgrade_strukturiert (IDs wie beim Text: enh-1, enh-2, …) */
export function modifikationenAusPaket(d: ZauberErfolgsgrade): PermissibleSpellModifications {
  const specificEnhancements: SpecificSpellEnhancement[] = d.verstaerkungen.map((v, i) => ({
    id: `enh-${i + 1}`,
    egCost: v.eg || 1,
    focusCostRaw: v.kosten,
    focusDelta: parseEnhancementFocusDelta(v.kosten || '0'),
    description: v.wirkung,
    raw: `${v.eg} EG${v.kosten ? ` (Kosten ${v.kosten})` : ''}: ${v.wirkung}`,
    ...(v.zustaende ? { zustaende: v.zustaende } : {}),
  }));
  return erlaubteOptionen(d.optionen, d.optionen.join(', '), specificEnhancements);
}

export function parseSpellPermissibleModifications(
  description?: string,
  spellName?: string
): PermissibleSpellModifications {
  // Zauber aus einem geladenen Paket: strukturierte Felder; nur eigene Zauber werden aus ihrem Text gelesen
  const ausPaket = spellName ? zauberErfolgsgrade(spellName) : null;
  if (ausPaket) return modifikationenAusPaket(ausPaket);
  const desc = description || '';
  const egIdx = desc.indexOf('Erfolgsgrade:');

  if (egIdx === -1) {
    // If no Erfolgsgrade section is found (e.g. custom user spell without structured text),
    // provide sensible defaults.
    return {
      rawList: 'Auslösezeit, Fokus, Verstärken',
      allowsCastTime: true,
      allowsExhaustedFocus: true,
      allowsChanneledFocus: true,
      allowsConsumedFocus: true,
      allowsRange: true,
      allowsDamage: true,
      allowsDuration: true,
      allowsArea: true,
      allowsEnhance: true,
      allowedNames: [
        'Auslösezeit',
        'Erschöpfter Fokus',
        'Kanalisierter Fokus',
        'Verzehrter Fokus',
        'Reichweite',
        'Schaden',
        'Wirkungsdauer',
        'Wirkungsbereich',
        'Verstärken',
      ],
      specificEnhancements: [],
    };
  }

  const egSection = desc.slice(egIdx + 'Erfolgsgrade:'.length).trim();
  const bullets = egSection.split('•').map((b) => b.trim()).filter(Boolean);

  const modBullet = bullets[0] || '';
  const allowedClean = modBullet
    .replace(/\(s\.\s*u\.\)/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const specificEnhancements: SpecificSpellEnhancement[] = [];
  for (let i = 1; i < bullets.length; i++) {
    const bulletText = bullets[i];
    // Pattern: "2 EG (Kosten +K1V1): Es können bis zu fünf Personen bestimmt werden."
    // or "1 EG (Kosten +1V1): Der Zauberer weiß..."
    // or "2 EG: ..."
    const m = bulletText.match(/^(\d+)\s*EG(?:\s*\((?:Kosten\s*)?([^\)]+)\))?\s*:\s*(.+)$/i);
    if (m) {
      const egCost = parseInt(m[1], 10) || 1;
      const extraRaw = m[2] ? m[2].trim() : '';
      const focusDelta = parseEnhancementFocusDelta(extraRaw);
      specificEnhancements.push({
        id: `enh-${i}`,
        egCost,
        focusCostRaw: extraRaw,
        focusDelta,
        description: m[3].trim(),
        raw: bulletText,
      });
    } else {
      specificEnhancements.push({
        id: `enh-${i}`,
        egCost: 1,
        focusCostRaw: '',
        focusDelta: parseEnhancementFocusDelta('0'),
        description: bulletText,
        raw: bulletText,
      });
    }
  }

  return erlaubteOptionen(allowedClean, modBullet, specificEnhancements);
}

/** Anzahl gewählter Optionen je Art; EG je Option stehen im Paket (regelwerk/zauberEg.ts, GRW S. 221–222) */
export interface SpellEGAllocations {
  saveExhaustedFocus: number;
  saveChanneledFocus: number;
  saveConsumedFocus: number;
  increaseDamage: number;
  increaseRange: number;
  increaseDuration: number;
  reduceCastTime: number;
  expandArea: number;
  selectedEnhancementIds: string[]; // List of specific enhancement IDs selected
  customEnhancementEG: number; // EG spent on spell-specific enhancement
  customEnhancementText: string;
  customEnhancementExtraFocus: number; // extra focus if enhancement requires it
  customEnhancementExtraFocusType: 'exhausted' | 'channeled' | 'consumed';
}

export const INITIAL_EG_ALLOCATIONS: SpellEGAllocations = {
  saveExhaustedFocus: 0,
  saveChanneledFocus: 0,
  saveConsumedFocus: 0,
  increaseDamage: 0,
  increaseRange: 0,
  increaseDuration: 0,
  reduceCastTime: 0,
  expandArea: 0,
  selectedEnhancementIds: [],
  customEnhancementEG: 0,
  customEnhancementText: '',
  customEnhancementExtraFocus: 0,
  customEnhancementExtraFocusType: 'exhausted',
};

/**
 * Calculates total EG spent on modifications.
 */
export function calculateTotalEGSpent(
  allocations: SpellEGAllocations,
  availableEnhancements?: SpecificSpellEnhancement[]
): number {
  let specificEG = 0;
  if (allocations.selectedEnhancementIds && availableEnhancements) {
    for (const id of allocations.selectedEnhancementIds) {
      const found = availableEnhancements.find((e) => e.id === id);
      if (found) {
        specificEG += found.egCost;
      }
    }
  }

  // EG je Option aus dem Paket (GRW S. 221–222)
  const r = zauberEgRegeln();
  return (
    (allocations.saveExhaustedFocus || 0) * r.erschoepft.eg +
    (allocations.saveChanneledFocus || 0) * r.kanalisiert.eg +
    (allocations.saveConsumedFocus || 0) * r.verzehrt.eg +
    (allocations.increaseDamage || 0) * r.schaden.eg +
    (allocations.increaseRange || 0) * r.reichweite.eg +
    (allocations.increaseDuration || 0) * r.wirkungsdauer.eg +
    (allocations.reduceCastTime || 0) * r.ausloesezeit.eg +
    (allocations.expandArea || 0) * r.wirkungsbereich.eg +
    specificEG +
    (allocations.customEnhancementEG || 0)
  );
}

export interface FinalSpellCosts {
  baseCost: ParsedFocusCost;
  effectiveExhausted: number;
  effectiveChanneled: number;
  effectiveConsumed: number;
  totalFocus: number;
  effectiveCastTicks: number; // standard trigger time is 3 ticks, reducible by reduceCastTime
  modificationsSummary: string[];
}

/**
 * Calculates final focus costs and effects after applying EG modifications.
 */
export function calculateFinalSpellCosts(
  parsedBase: ParsedFocusCost,
  allocations: SpellEGAllocations,
  availableEnhancements?: SpecificSpellEnhancement[]
): FinalSpellCosts {
  const r = zauberEgRegeln();
  // Erschöpfter Fokus: Mindestkosten aus dem Paket (1 erschöpfter Punkt)
  let effectiveExhausted = parsedBase.exhausted;
  if (effectiveExhausted > 0 && allocations.saveExhaustedFocus > 0) {
    const maxReduction = Math.max(0, effectiveExhausted - (r.erschoepft.minimum ?? 0));
    const reduction = Math.min(maxReduction, allocations.saveExhaustedFocus);
    effectiveExhausted -= reduction;
  }

  // Kanalisierter Fokus: Mindestkosten aus dem Paket (1 kanalisierter Punkt)
  let effectiveChanneled = parsedBase.channeled;
  if (effectiveChanneled > 0 && allocations.saveChanneledFocus > 0) {
    const maxReduction = Math.max(0, effectiveChanneled - (r.kanalisiert.minimum ?? 0));
    const reduction = Math.min(maxReduction, allocations.saveChanneledFocus);
    effectiveChanneled -= reduction;
  }

  // 3 EG sparen 1 Punkt verzehrten Fokus (GRW S. 221–222: „Die Mindestkosten betragen 1 erschöpften oder kanalisierten
  // Fokuspunkt“). Der verzehrte Anteil darf also ganz entfallen, solange ein nicht verzehrter Punkt bleibt.
  let effectiveConsumed = parsedBase.consumed;
  if (effectiveConsumed > 0 && allocations.saveConsumedFocus > 0) {
    const mindest = r.verzehrt.minimum ?? 0;
    const restBleibt = effectiveExhausted + effectiveChanneled >= mindest;
    const maxReduction = restBleibt ? effectiveConsumed : Math.max(0, effectiveConsumed - mindest);
    const reduction = Math.min(maxReduction, allocations.saveConsumedFocus);
    effectiveConsumed -= reduction;
  }

  // Apply extra focus from selected specific enhancements
  const modificationsSummary: string[] = [];
  if (allocations.saveExhaustedFocus > 0) {
    modificationsSummary.push(`-${allocations.saveExhaustedFocus} Erschöpfter Fokus (${allocations.saveExhaustedFocus * r.erschoepft.eg} EG)`);
  }
  if (allocations.saveChanneledFocus > 0) {
    modificationsSummary.push(`-${allocations.saveChanneledFocus} Kanalisierter Fokus (${allocations.saveChanneledFocus * r.kanalisiert.eg} EG)`);
  }
  if (allocations.saveConsumedFocus > 0) {
    modificationsSummary.push(`-${allocations.saveConsumedFocus} Verzehrter Fokus (${allocations.saveConsumedFocus * r.verzehrt.eg} EG)`);
  }
  if (allocations.increaseDamage > 0) {
    modificationsSummary.push(`+${allocations.increaseDamage} Schaden (${allocations.increaseDamage * r.schaden.eg} EG)`);
  }
  if (allocations.increaseRange > 0) {
    modificationsSummary.push(`+${allocations.increaseRange}x Grundreichweite (${allocations.increaseRange * r.reichweite.eg} EG)`);
  }
  if (allocations.increaseDuration > 0) {
    modificationsSummary.push(`+${allocations.increaseDuration}x Grundwirkungsdauer (${allocations.increaseDuration * r.wirkungsdauer.eg} EG)`);
  }
  if (allocations.reduceCastTime > 0) {
    modificationsSummary.push(`-${allocations.reduceCastTime} Ticks Auslösezeit (${allocations.reduceCastTime * r.ausloesezeit.eg} EG)`);
  }
  if (allocations.expandArea > 0) {
    modificationsSummary.push(`+${allocations.expandArea}x Grundwirkungsbereich (${allocations.expandArea * r.wirkungsbereich.eg} EG)`);
  }

  if (allocations.selectedEnhancementIds && availableEnhancements) {
    for (const id of allocations.selectedEnhancementIds) {
      const found = availableEnhancements.find((e) => e.id === id);
      if (found) {
        effectiveExhausted += found.focusDelta.exhausted;
        effectiveChanneled += found.focusDelta.channeled;
        effectiveConsumed += found.focusDelta.consumed;
        const costNote = found.focusCostRaw ? ` [Kosten ${found.focusCostRaw}]` : '';
        modificationsSummary.push(`Verstärkung: ${found.description}${costNote} (${found.egCost} EG)`);
      }
    }
  }

  // Add extra focus from custom/spell-specific enhancement if configured
  if (allocations.customEnhancementExtraFocus > 0) {
    if (allocations.customEnhancementExtraFocusType === 'consumed') {
      effectiveConsumed += allocations.customEnhancementExtraFocus;
    } else if (allocations.customEnhancementExtraFocusType === 'channeled') {
      effectiveChanneled += allocations.customEnhancementExtraFocus;
    } else {
      effectiveExhausted += allocations.customEnhancementExtraFocus;
    }
  }

  if (allocations.customEnhancementEG > 0) {
    modificationsSummary.push(
      `Eigene Verstärkung: ${allocations.customEnhancementText || 'Zauberverstärkung'} (${allocations.customEnhancementEG} EG)`
    );
  }

  // Auslösezeit (GRW S. 194–195, 221–222): Grundwert, höchstens zweimal senkbar, Minimum aus dem Paket
  const senkung = Math.min(allocations.reduceCastTime || 0, r.ausloesezeit.hoechstens ?? Infinity);
  const effectiveCastTicks = Math.max(r.ausloesezeit.minimum ?? 0, r.grundAusloesezeit - senkung);

  return {
    baseCost: parsedBase,
    effectiveExhausted,
    effectiveChanneled,
    effectiveConsumed,
    totalFocus: effectiveExhausted + effectiveChanneled + effectiveConsumed,
    effectiveCastTicks,
    modificationsSummary,
  };
}

export interface ParsedSpellDamage {
  hasDamage: boolean;
  diceCount: number;
  diceSides: number;
  baseBonus: number;
  formula: string; // e.g. "2W6" or "3W6+3"
  damageType: string; // e.g. "Feuerschaden", "Kälteschaden", "Schaden"
}

export function parseSpellDamage(description?: string, spellName?: string): ParsedSpellDamage | null {
  const text = `${spellName || ''} ${description || ''}`;
  if (!text.trim()) return null;

  // Match patterns like "2W6", "3w6+3", "1W10", "2W10+2", "1W6 + 3"
  const match = text.match(/(\d+)\s*[wW](\d+)(?:\s*\+\s*(\d+))?/);
  if (!match) return null;

  const diceCount = parseInt(match[1], 10) || 1;
  const diceSides = parseInt(match[2], 10) || 6;
  const baseBonus = match[3] ? parseInt(match[3], 10) || 0 : 0;
  const formula = baseBonus > 0 ? `${diceCount}W${diceSides}+${baseBonus}` : `${diceCount}W${diceSides}`;

  // Detect damage type
  let damageType = 'Schaden';
  const lower = text.toLowerCase();
  // Lichtschaden zuerst: „Licht…blitz“ ist kein Blitzschaden
  if (lower.includes('lichtschaden')) {
    damageType = 'Lichtschaden';
  } else if (lower.includes('feuerschaden') || lower.includes('feuer')) {
    damageType = 'Feuerschaden';
  } else if (lower.includes('kälteschaden') || lower.includes('kälte') || lower.includes('eis')) {
    damageType = 'Kälteschaden';
  } else if (lower.includes('blitzschaden') || lower.includes('blitz') || lower.includes('elektrizität')) {
    damageType = 'Blitzschaden';
  } else if (lower.includes('echten schaden') || lower.includes('echter schaden')) {
    damageType = 'Echter Schaden';
  } else if (lower.includes('direkten schaden') || lower.includes('direkter schaden')) {
    damageType = 'Direkter Schaden';
  } else if (lower.includes('geistesschaden') || lower.includes('geist')) {
    damageType = 'Geistesschaden';
  } else if (lower.includes('fels') || lower.includes('erde') || lower.includes('stein')) {
    damageType = 'Physischer Schaden';
  }

  return {
    hasDamage: true,
    diceCount,
    diceSides,
    baseBonus,
    formula,
    damageType,
  };
}

export interface SpellDamageRollResult {
  formula: string;
  diceCount: number;
  diceSides: number;
  dice: number[];
  diceSum: number;
  baseBonus: number;
  egBonus: number;
  total: number;
  damageType: string;
}

export function executeSpellDamageRoll(
  diceCount: number,
  diceSides: number,
  baseBonus: number = 0,
  egBonus: number = 0,
  damageType: string = 'Schaden',
  manualDice?: number[]
): SpellDamageRollResult {
  const dice: number[] = [];
  if (manualDice && manualDice.length === diceCount) {
    dice.push(...manualDice);
  } else {
    for (let i = 0; i < diceCount; i++) {
      dice.push(Math.floor(Math.random() * diceSides) + 1);
    }
  }
  const diceSum = dice.reduce((a, b) => a + b, 0);
  const total = Math.max(0, diceSum + baseBonus + egBonus);
  const formulaParts = [`${diceCount}W${diceSides}`];
  if (baseBonus > 0) formulaParts.push(`+${baseBonus}`);
  if (egBonus > 0) formulaParts.push(`+${egBonus} EG`);

  return {
    formula: formulaParts.join(' '),
    diceCount,
    diceSides,
    dice,
    diceSum,
    baseBonus,
    egBonus,
    total,
    damageType,
  };
}

export interface ActiveSpellModifiers {
  vtdBonus: number;
  srBonus: number;
  gwBonus: number;
  kwBonus: number;
  gswBonus: number;
  woundPenaltyReduction: number;
  /** Hinweise, wenn Boni begrenzt wurden oder ein Zauber wegen eines stärkeren gleichen Typs nicht zählt */
  hinweise: string[];
  breakdown: Array<{
    spellName: string;
    vtd?: number;
    sr?: number;
    gw?: number;
    kw?: number;
    gsw?: number;
    woundPenaltyReduction?: number;
    description: string;
  }>;
}

/**
 * Prüft, ob ein aktiver Zauber mit seiner Verstärkungsoption gewirkt wurde (genau eine je Zauber, nur einmal wählbar –
 * GRW S. 221–222).
 */
export function isSpellEnhanced(cs: import('../types').ChanneledSpell, _searchPatterns: string[] = []): boolean {
  return istVerstaerkt(cs);
}

/**
 * Höchstbonus aus der Quelle Zauberei auf eine Probe oder einen abgeleiteten Wert: zu Spielbeginn 3, je Heldengrad +1
 * (GRW S. 18–19, S. 88–89). Ausrüstung ist eine eigene Quelle mit eigenem Höchstbonus.
 */
export function zauberHoechstbonus(calc?: { regelwerk?: { hoechstbonus?: number } | null; heldengrad?: { name?: string } } | null): number {
  const ausPaket = calc?.regelwerk?.hoechstbonus;
  if (typeof ausPaket === 'number' && ausPaket > 0) return ausPaket;
  const m = (calc?.heldengrad?.name ?? '').match(/Heldengrad\s*(\d)/);
  return 3 + Math.max(0, (m ? Number(m[1]) : 1) - 1);
}

/**
 * Boni aktiver Zauber auf Kampfwerte (VTD, SR, GW, KW, GSW, Wundabzüge). Die Werte kommen aus den Regelpaketen
 * (daten.spielwerte, siehe regelwerk/zauberwerte.ts) – der Editor führt keine eigene Zaubertabelle.
 * `hoechstbonus`: Höchstbonus aus Zauberei (siehe zauberHoechstbonus); VTD, GW, KW und GSW werden darauf begrenzt.
 */
export function getActiveSpellModifiers(
  channeledSpells: import('../types').ChanneledSpell[] = [],
  hoechstbonus?: number,
  katalog: Katalog | null = aktiverKatalog()
): ActiveSpellModifiers {
  const w = kampfwerte(katalog, channeledSpells, hoechstbonus);
  return {
    vtdBonus: w.vtd, srBonus: w.sr, gwBonus: w.gw, kwBonus: w.kw, gswBonus: w.gsw, woundPenaltyReduction: w.wundabzug, hinweise: w.hinweise,
    breakdown: w.jeZauber.map((z) => ({ spellName: z.name, vtd: z.vtd, sr: z.sr, gw: z.gw, kw: z.kw, gsw: z.gsw, woundPenaltyReduction: z.wundabzug, description: z.text })),
  };
}

export interface ActiveSpellRollBonus {
  id: string;
  source: string;
  bonus: number;
  description: string;
  /** false: nur in bestimmten Lagen – wird angeboten, ist aber nicht vorausgewählt */
  active: boolean;
}

const KAMPFFERTIGKEITEN = ['handgemenge', 'hiebwaffen', 'kettenwaffen', 'klingenwaffen', 'schusswaffen', 'stangenwaffen', 'wurfwaffen'];

/**
 * Probenboni aus aktiven Zaubern für Fertigkeits- und Angriffswürfe (aus den Regelpaketen). Einträge mit `active: false`
 * gelten nur in einer Lage und sind nicht vorausgewählt. Die Summe ist auf den Höchstbonus aus Zauberei begrenzt
 * (siehe begrenzeZauberbonus).
 */
export function getActiveSpellRollBonuses(
  channeledSpells: import('../types').ChanneledSpell[] = [],
  skillName: string,
  isCombatAttack: boolean = false,
  weaponId?: string,
  katalog: Katalog | null = aktiverKatalog()
): ActiveSpellRollBonus[] {
  const cleanSkill = (skillName || '').trim();
  const angriff = isCombatAttack || KAMPFFERTIGKEITEN.includes(cleanSkill.toLowerCase());
  return probenboni(katalog, channeledSpells, { fertigkeit: cleanSkill, attribute: grwFertigkeitsattribute()[cleanSkill] || [], angriff, waffenId: weaponId })
    .map((b) => ({ id: b.id, source: b.quelle, bonus: b.bonus, description: b.text, active: b.vorausgewaehlt }));
}

/**
 * Summe der gewählten Zauberboni einer Probe, begrenzt auf den Höchstbonus aus Zauberei (GRW S. 18–19: „Der maximale
 * Bonus, den eine Probe oder ein Abgeleiteter Wert erhalten kann, beträgt zu Spielbeginn 3 Punkte aus jeder der beiden
 * Quellen Ausrüstung und Zauberei“).
 */
export function begrenzeZauberbonus(summe: number, hoechstbonus: number): number {
  return Math.min(summe, Math.max(0, hoechstbonus));
}

export { istWaffenlos };

export interface SpellWeaponDamageBonus {
  fireDamage: number;
  lightDamage: number;
  /** übriger Zusatzschaden */
  otherDamage: number;
  /** Summe aller Zusatzschäden */
  totalDamage: number;
  bonusText: string;
}

/**
 * Zusatzschaden aus aktiven Zaubern für einen Angriff (aus den Regelpaketen). Waffenzauber wirken nur auf die verzauberte
 * Waffe, Zauber mit Ziel „waffenlos“ nur beim waffenlosen Angriff; Waffenzauber auf waffenlose Angriffe lässt der Editor
 * nicht zu (Auslegung: „Eine Waffe wird …“, keine eigene Regelstelle).
 */
export function getSpellWeaponDamageBonus(
  channeledSpells: import('../types').ChanneledSpell[] = [],
  weaponId?: string,
  weaponName?: string,
  katalog: Katalog | null = aktiverKatalog()
): SpellWeaponDamageBonus {
  const s = waffenschaden(katalog, channeledSpells, weaponId, weaponName);
  return { fireDamage: s.feuer, lightDamage: s.licht, otherDamage: s.sonst, totalDamage: s.gesamt, bonusText: s.text };
}

export interface EquipmentSpellTargetCheck {
  isEquipmentSpell: boolean;
  targetsEquipment: boolean;
  equipmentType: 'weapon' | 'armor' | 'item' | null;
  targetCategory: string;
  constraintNote?: string;
  allowsUnarmed?: boolean;
}

/**
 * Prüft, ob ein Zauber ein Ausrüstungsstück des Charakters verzaubert (Waffe, Rüstung, Gegenstand) – nach Typus und
 * Reichweite des Zaubers aus den Zauberdaten bzw. dem Regelpaket, ohne Namensliste:
 *   - Reichweite „Zauberer“: wirkt auf den Zauberer selbst (Magische Rüstung, Steinhaut, Geisterdolch …) → kein Ziel
 *   - Typus „Waffe“ ohne „Herbeirufung“ → Waffe; Typus „Rüstung“ mit Reichweite „Berührung“ → Rüstung; Typus „Objekt“ → Gegenstand
 */
export function isEquipmentTargetingSpell(
  spellOrName: string | { name?: string; target?: string; description?: string; range?: string },
  katalog: Katalog | null = aktiverKatalog()
): EquipmentSpellTargetCheck {
  const KEIN_ZIEL: EquipmentSpellTargetCheck = { isEquipmentSpell: false, targetsEquipment: false, equipmentType: null, targetCategory: '', allowsUnarmed: true };
  const name = (typeof spellOrName === 'string' ? spellOrName : spellOrName.name || '').trim();
  const ausPaket = katalog ? katalog.get(idNachName(katalog, 'zauber', name) ?? '') : undefined;
  const typus = (typeof spellOrName === 'object' && spellOrName.target
    ? spellOrName.target.split(',')
    : ((ausPaket?.daten.typus ?? []) as string[])).map((t) => t.trim().toLowerCase());
  const reichweite = ((typeof spellOrName === 'object' && spellOrName.range) || (ausPaket?.daten.reichweite as string | undefined) || '').trim().toLowerCase();
  if (reichweite === 'zauberer') return KEIN_ZIEL;

  if (typus.includes('waffe') && !typus.includes('herbeirufung')) {
    return {
      isEquipmentSpell: true, targetsEquipment: true, equipmentType: 'weapon', targetCategory: 'Waffe', allowsUnarmed: false,
      constraintNote: 'Nur Waffen aus dem Inventar. Für waffenlose Angriffe gibt es eigene Zauber (Typus Hand).',
    };
  }
  if (typus.includes('rüstung') && reichweite === 'berührung') {
    return {
      isEquipmentSpell: true, targetsEquipment: true, equipmentType: 'armor', targetCategory: 'Rüstung', allowsUnarmed: false,
      constraintNote: 'Nur getragene oder im Inventar befindliche Rüstungen und Schilde.',
    };
  }
  if (typus.includes('objekt') || typus.includes('gegenstand')) {
    return {
      isEquipmentSpell: true, targetsEquipment: true, equipmentType: 'item', targetCategory: 'Gegenstand', allowsUnarmed: false,
      constraintNote: 'Gegenstände aus dem Inventar.',
    };
  }
  return KEIN_ZIEL;
}

/**
 * Kombiniert eine Grundschadensformel (z. B. "1W6+1") mit Zusatzschadenspunkten (z. B. 2)
 * zu einer validen Standard-Würfelformel (z. B. "1W6+3" statt "1W6+1+2").
 */
export function combineDamageFormula(baseDamage: string, extraDamage: number): string {
  if (!extraDamage || extraDamage === 0) return baseDamage || '1W6';
  const clean = (baseDamage || '1W6').trim();
  const match = clean.match(/^(\d*W\d+)(.*)$/i);
  if (!match) {
    return `${clean}+${extraDamage}`;
  }
  const dicePart = match[1];
  const rest = match[2].trim();
  let existingMod = 0;
  if (rest) {
    const numMatches = rest.match(/([+-]\s*\d+)/g);
    if (numMatches) {
      for (const m of numMatches) {
        existingMod += parseInt(m.replace(/\s+/g, ''), 10) || 0;
      }
    }
  }
  const totalMod = existingMod + extraDamage;
  if (totalMod === 0) return dicePart;
  if (totalMod > 0) return `${dicePart}+${totalMod}`;
  return `${dicePart}${totalMod}`;
}

export interface WeaponEnchantmentInfo {
  hasEnchantment: boolean;
  fireDamage: number;
  lightDamage: number;
  atBonus: number;
  spells: Array<{
    name: string;
    description: string;
    badgeText: string;
    badgeVariant: 'fire' | 'light' | 'magic';
  }>;
  extraDamageText: string;      // z. B. "+2 Feuer"
  damageFormulaDisplay: string; // z. B. "1W6+1 (+2 Feuer)"
  damageRollFormula: string;    // z. B. "1W6+1+2"
  buttonDamageLabel: string;    // z. B. "1W6+1 (+2 Feuer) Schaden"
}

/**
 * Ermittelt alle aktiven Verzauberungen auf einer konkreten Waffe (z. B. Katar mit Flammende Waffe +2 Feuer).
 */
export function getWeaponEnchantments(
  weapon: { id?: string; name: string; damage?: string },
  channeledSpells: import('../types').ChanneledSpell[] = [],
  katalog: Katalog | null = aktiverKatalog()
): WeaponEnchantmentInfo {
  const baseDamage = weapon.damage || '1W6';
  const schaden = waffenschaden(katalog, channeledSpells, weapon.id, weapon.name);
  const spells: WeaponEnchantmentInfo['spells'] = [];
  let atBonus = 0;

  // Zusatzschaden (schon nach „nicht kombinierbar“ gesiebt)
  for (const t of schaden.teile) {
    const variante = /feuer/i.test(t.art) ? 'fire' : /licht/i.test(t.art) ? 'light' : 'magic';
    spells.push({ name: t.name, description: `+${t.wert} ${t.art}`, badgeText: `+${t.wert} ${t.art.replace(/schaden$/i, '') || 'Schaden'}`, badgeVariant: variante });
  }
  // Angriffsboni von Waffenzaubern auf dieser Waffe; Boni, die nur in einer Lage gelten, stehen nicht im AT-Wert
  if (!istWaffenlos(weapon.id, weapon.name)) {
    for (const cs of channeledSpells) {
      if (!zielTrifft(cs, weapon.id, weapon.name)) continue;
      const sw = spielwerteDesZaubers(katalog, cs.name);
      for (const x of sw?.werte ?? []) {
        if (x.bezug !== 'angriff' || x.ziel !== 'waffe') continue;
        const v = geltenderWert(x, istVerstaerkt(cs));
        if (typeof v !== 'number' || v === 0) continue;
        if (x.lage) { spells.push({ name: cs.name, description: `+${v} auf Angriffe nur in bestimmter Lage`, badgeText: `+${v} AT (Lage)`, badgeVariant: 'magic' }); continue; }
        atBonus += v;
        spells.push({ name: cs.name, description: `+${v} auf Angriffe`, badgeText: `+${v} AT`, badgeVariant: 'magic' });
      }
    }
  }

  const extraDamageParts: string[] = [];
  if (schaden.feuer > 0) extraDamageParts.push(`+${schaden.feuer} Feuer`);
  if (schaden.licht > 0) extraDamageParts.push(`+${schaden.licht} Licht`);
  if (schaden.sonst > 0) extraDamageParts.push(`+${schaden.sonst} Zauber`);
  const extraDamageText = extraDamageParts.join(', ');

  return {
    hasEnchantment: spells.length > 0,
    fireDamage: schaden.feuer,
    lightDamage: schaden.licht,
    atBonus,
    spells,
    extraDamageText,
    damageFormulaDisplay: extraDamageText ? `${baseDamage} (${extraDamageText})` : baseDamage,
    damageRollFormula: combineDamageFormula(baseDamage, schaden.gesamt),
    buttonDamageLabel: extraDamageText ? `${baseDamage} (${extraDamageText}) Schaden` : `${baseDamage} Schaden`,
  };
}

/**
 * Liefert die effektive Schadensformel für Zauber, deren Schaden durch spezifische Zauber-Verstärkungen
 * verändert wird (z. B. Lebensraub von 2W6+5 auf 4W6+5 mit 1 EG).
 */
export function getEnhancedSpellDamage(
  spellName?: string,
  description?: string,
  allocations?: SpellEGAllocations,
  specificEnhancements: SpecificSpellEnhancement[] = []
): ParsedSpellDamage | null {
  const base = parseSpellDamage(description, spellName);
  if (!base) return null;
  // Nennt die gewählte Verstärkung eine neue Würfelformel (z. B. „… erhöht sich auf 4W6+5“), gilt diese
  const selectedEnhIds = allocations?.selectedEnhancementIds || [];
  const gewaehlt = specificEnhancements.find((e) => selectedEnhIds.includes(e.id));
  const m = gewaehlt ? gewaehlt.description.match(/(\d+)W(\d+)(?:\s*([+-])\s*(\d+))?/) : null;
  if (m) {
    const bonus = m[4] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
    return {
      ...base,
      diceCount: Number(m[1]),
      diceSides: Number(m[2]),
      baseBonus: bonus,
      formula: `${m[1]}W${m[2]}${bonus ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : ''}`,
    };
  }
  return base;
}

export interface ActiveEnhancementEffect {
  id: string;
  egCost: number;
  focusCostRaw?: string;
  description: string;
  addedCondition?: string;
}

/**
 * Liefert aktive Effekte der ausgewählten Verstärkungen, mit den Zuständen, die sie laut Paket verursachen.
 */
export function getSelectedSpecificEnhancementEffects(
  _spellName?: string,
  allocations?: SpellEGAllocations,
  specificEnhancements: SpecificSpellEnhancement[] = []
): ActiveEnhancementEffect[] {
  const selectedEnhIds = allocations?.selectedEnhancementIds || [];
  if (selectedEnhIds.length === 0) return [];

  const results: ActiveEnhancementEffect[] = [];
  for (const id of selectedEnhIds) {
    const enh = specificEnhancements.find((e) => e.id === id);
    if (enh) {
      // verursachte Zustände stehen im Paket (erfolgsgrade_strukturiert.verstaerkungen[].zustaende), keine Textsuche
      const addedCondition = enh.zustaende?.length ? enh.zustaende.map(verstaerkungsZustandText).join(', ') : undefined;

      results.push({
        id: enh.id,
        egCost: enh.egCost,
        focusCostRaw: enh.focusCostRaw,
        description: enh.description,
        addedCondition,
      });
    }
  }
  return results;
}

export interface SpellHealingInfo {
  isHealingSpell: boolean;
  baseLP: number;
  isRestoreAll?: boolean;
  conditionToRemove?: string;
  label: string;
}

export interface CalculatedSpellHealing {
  isHealingSpell: boolean;
  baseLP: number;
  enhancedLP: number;
  totalLP: number;
  isRestoreAll: boolean;
  curesPoisonDisease: boolean;
  hasEnhancementSelected: boolean;
  conditionToRemove?: string;
  label: string;
}

/**
 * Heilwirkung eines Zaubers beim Wirken: Lebenspunkte aus den Regelpaketen (daten.spielwerte, Bezug heilung_lp) mit dem
 * Wert der gewählten Verstärkung. „alle“ = alle Lebenspunkte (Wiederherstellung); deren Verstärkung hebt zusätzlich Gifte
 * und Krankheiten auf.
 */
export function calculateSpellHealing(
  spellName?: string,
  allocations?: SpellEGAllocations,
  _specificEnhancements: SpecificSpellEnhancement[] = [],
  katalog: Katalog | null = aktiverKatalog()
): CalculatedSpellHealing | null {
  const verstaerkt = (allocations?.selectedEnhancementIds || []).length > 0;
  const heil = lpWirkung(katalog, spellName || '', 'heilung_lp', verstaerkt);
  if (heil) {
    const alle = heil.lp === 'alle';
    const grund = heil.grund === 'alle' ? 999 : heil.grund;
    const lp = heil.lp === 'alle' ? 999 : heil.lp;
    return {
      isHealingSpell: true,
      baseLP: grund,
      enhancedLP: lp,
      totalLP: lp,
      isRestoreAll: alle,
      curesPoisonDisease: alle && verstaerkt,
      hasEnhancementSelected: alle ? verstaerkt : heil.verstaerkt,
      label: alle
        ? (verstaerkt ? 'Selbst heilen (Alle LP, Zustände & Gifte/Krankheiten)' : 'Selbst heilen (Alle LP & Zustände)')
        : `Selbst heilen (+${lp} LP)`,
    };
  }

  // Zauber, die Stufen eines Zustands unterdrücken (z. B. Erfrischung), wirken über wirksameZustaende(), solange sie aktiv
  // sind – hier gibt es nichts abzuziehen. Giftbann hebt Gifte nach Grad auf; einen Zustand „Vergiftet“ kennt das GRW nicht.
  return null;
}

/**
 * Liefert Selbstheilungs- bzw. Zustandsbehebungs-Informationen für Zauber nach Splittermond GRW.
 */
export function getSpellHealingInfo(
  spellName?: string,
  _description?: string,
  allocations?: SpellEGAllocations,
  specificEnhancements?: SpecificSpellEnhancement[]
): SpellHealingInfo | null {
  const calc = calculateSpellHealing(spellName, allocations, specificEnhancements);
  if (!calc) return null;
  return {
    isHealingSpell: calc.isHealingSpell,
    baseLP: calc.totalLP,
    isRestoreAll: calc.isRestoreAll,
    conditionToRemove: calc.conditionToRemove,
    label: calc.label,
  };
}


