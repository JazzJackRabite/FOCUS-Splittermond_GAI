import { wundstufenVerschiebung } from '../regelwerk/zustaende';
import type {
  CharacterState,
  DerivedStats,
  CreationUsage,
  Mastery,
  Spell,
} from '../types';
import type { Heldengrad } from '../regelwerk/steigerungsregeln';
import { getSkillXpCost, getAttrXpCost, calculateItemCost } from './costCalculations';
import { heldengrade } from '../regelwerk/steigerungsregeln';
import { abgeleiteteFuerCharakter, wirkungenFuerCharakter, type CharakterWirkungen, type KatalogWerte } from '../regelwerk/bruecke';
import { reliktWiderstandFuerCharakter } from '../regelwerk/relikte';
import { grwAlleFertigkeiten, grwAttribute, grwFertigkeitsKategorien, grwFertigkeitsattribute, grwGesundheitsstufen, grwRassen, staerkenBudget } from '../regelwerk/grwListen';
import { ausruestungsMinderung, traglast, wundabzugMinderung } from '../regelwerk/spielwirkungen';

export interface CharacterCalculationResult {
  getAttrValue: (key: string) => number;
  currentAttributes: Record<string, number>;
  xpSpent: number;
  xpAvailable: number;
  heldengrad: Heldengrad;
  derived: DerivedStats;
  robustBonus: number;
  maxLP: number;
  maxFO: number;
  currentWoundPenalty: number;
  currentHealthLevelName: string;
  splinterPoints: number;
  creationUsage: CreationUsage;
  isCreationComplete: boolean;
  getFreeSlotsForSkill: (skill: string) => number;
  getUsedFreeTiers: (skill: string) => number[];
  totalFreeSlotsAvailable: number;
  detailedFreeSpellSlots: Record<string, number[]>;
  totalFreeSpellSlots: number;
  groupedMasteries: Array<{ skill: string; items: Mastery[] }>;
  groupedSpells: Array<{ skill: string; items: Spell[] }>;
  getSkillValue: (skill: string) => number;
  getSkillTotal: (skill: string) => number | null;
  armorSR: number;
  gearVtdBonus: number;
  gearHandicap: number;
  gearTickModifier: number;
  armorHandicap: number;
  shieldHandicap: number;
  overweightHandicap: number;
  totalHandicap: number;
  loadCapacity: number;
  totalLoad: number;
  /** Werte nach den Regelpaketen (null: Regelpakete nicht geladen, bisherige Rechnung) */
  regelwerk: KatalogWerte | null;
  /** Wirkungen aus Stärken und Meisterschaften (null: Regelpakete nicht geladen); Fertigkeitsboni stecken in getSkillTotal */
  wirkungen: CharakterWirkungen | null;
  /** dauerhafter Bonus aus Wirkungen auf eine Fertigkeit (0 ohne Regelpakete) */
  getSkillBonus: (skill: string) => number;
}

/**
 * Pure, UI-independent calculation of all derived character statistics,
 * XP expenditures, skill values, and rules constraints.
 */
export function calculateCharacter(state: CharacterState): CharacterCalculationResult {
  const {
    attrBase,
    race,
    raceBonusAttrs,
    attrIncrements,
    skillsBase,
    skillsXp,
    strengthsList,
    resourcesList,
    languagesList,
    masteries,
    spellsList,
    xpTotal,
    homeRegion,
  } = state;

  // 1. Attribute calculation
  const getAttrValue = (key: string): number => {
    const base = Number(attrBase[key as keyof typeof attrBase]) || 0;
    const raceData = grwRassen()[race as keyof ReturnType<typeof grwRassen>] as {
      mods: Record<string, number>;
    } | undefined;
    const mod = Number(raceData?.mods?.[key]) || 0;
    const bonus = (raceBonusAttrs ?? []).filter((a) => a === key).length;
    const incr = Number(attrIncrements[key as keyof typeof attrIncrements]) || 0;
    const total = base + mod + bonus + incr;
    return isNaN(total) ? 0 : total;
  };

  const currentAttributes: Record<string, number> = {};
  Object.keys(grwAttribute()).forEach((k) => {
    currentAttributes[k] = getAttrValue(k);
  });

  // 2. XP Spent
  let xpSpent = 0;
  Object.keys(attrIncrements).forEach((key) => {
    const incs = Number(attrIncrements[key as keyof typeof attrIncrements]) || 0;
    for (let i = 0; i < incs; i++) {
      xpSpent += getAttrXpCost(i);
    }
  });

  Object.keys(skillsXp).forEach((key) => {
    const base = Number(skillsBase[key]) || 0;
    const added = Number(skillsXp[key]) || 0;
    for (let i = 0; i < added; i++) {
      const nextVal = base + i + 1;
      xpSpent += getSkillXpCost(nextVal);
    }
  });

  const strengthXpPoints = strengthsList
    .filter((s) => s.source === 'xp')
    .reduce((a, b) => a + (Number(b.level) || 1) * (Number(b.pointCost) || 1), 0);
  const resourceXpPoints = resourcesList
    .filter((r) => r.source === 'xp')
    .reduce((a, b) => a + (Number(b.level) || 1), 0);

  xpSpent += strengthXpPoints * calculateItemCost('strength', 1) + resourceXpPoints * calculateItemCost('resource', 1);

  const languageCountXP = languagesList.filter((l) => l.source === 'xp').length;
  xpSpent += languageCountXP * calculateItemCost('language', 1);

  Object.values(masteries).forEach((list) => {
    list.forEach((m) => {
      xpSpent += Number(m.cost || 0) || 0;
    });
  });
  spellsList.forEach((s) => {
    if (s.sourceMode === 'xp') {
      const cost = s.isFree
        ? 0
        : (s.xpCost ?? (typeof s.cost === 'number' ? s.cost : calculateItemCost('spell', s.grade)));
      xpSpent += cost;
    } else if (typeof s.cost === 'number') {
      xpSpent += s.cost;
    }
  });

  if (isNaN(xpSpent)) xpSpent = 0;

  // 3. Heldengrad
  // Schwellen und Grenzen aus den Kernregeln des Pakets
  const grade: Heldengrad[] = heldengrade() ?? [];
  let heldengrad: Heldengrad = grade[0] ?? { nr: 1, name: '', minXP: 0, maxAttrMod: 0, maxSkill: 0, resistBonus: 0 };
  for (const g of grade) if (xpSpent >= g.minXP) heldengrad = g;

  // 4. Derived stats
  // Formeln der abgeleiteten Werte stehen im Paket (abgeleiteteFuerCharakter, unten); hier nur die Ausrüstung

  // Equipment bonuses (armor, shields, load)
  const equippedItems = state.inventory?.filter((it) => it.equipped) ?? [];
  const armorSR = equippedItems
    .filter((it) => it.type === 'armor' || it.sr !== undefined)
    .reduce((sum, it) => sum + (Number(it.sr) || 0), 0);
  const gearVtdBonus = equippedItems
    .reduce((sum, it) => sum + (Number(it.vtdBonus) || 0), 0);
  const gearHandicap = equippedItems
    .reduce((sum, it) => sum + (Number(it.handicap) || 0), 0);

  // Traglast (Optionalregel GRW S. 165): Last je Punkt des Attributs aus dem Paket, Behinderung je weiterem Lastpunkt
  const tl = traglast();
  const tlAttr = Object.entries(grwAttribute()).find(([, n]) => n === tl?.attribut)?.[0];
  const loadCapacity = tl && tlAttr ? (Number(currentAttributes[tlAttr as keyof typeof currentAttributes]) || 0) * tl.lastJePunkt : Infinity;
  const totalLoad = (state.inventory ?? []).reduce(
    (sum, it) => sum + (Number(it.weight) || 0) * (Number(it.quantity) || 1),
    0
  );

  // Meisterschaften, die Behinderung und Tick-Zuschlag von Rüstung bzw. Schild senken (Wirkungen mit gilt_fuer aus dem Paket, GRW S. 123)
  const minderung = ausruestungsMinderung(state);

  const armorHandicapRaw = equippedItems
    .filter((it) => it.type === 'armor' || (it.handicap !== undefined && it.type !== 'shield'))
    .reduce((sum, it) => sum + (Number(it.handicap) || 0), 0);
  const armorHandicap = Math.max(0, armorHandicapRaw - minderung.ruestung.behinderung);

  const shieldHandicapRaw = equippedItems
    .filter((it) => it.type === 'shield')
    .reduce((sum, it) => sum + (Number(it.handicap) || 0), 0);
  const shieldHandicap = Math.max(0, shieldHandicapRaw - minderung.schild.behinderung);

  // Tick-Zuschlag von Rüstung und Schild, gesenkt durch Rüstungsträger II bzw. Starker Schildarm II (nie unter 0)
  const tickVon = (schild: boolean) => equippedItems.filter((it) => (it.type === 'shield') === schild).reduce((sum, it) => sum + (Number(it.tickModifier) || 0), 0);
  const gearTickModifier = Math.max(0, tickVon(false) - minderung.ruestung.tick_zuschlag) + Math.max(0, tickVon(true) - minderung.schild.tick_zuschlag);

  const overweightHandicap = state.ignoreEncumbrance || !tl ? 0 : Math.max(0, totalLoad - loadCapacity) * tl.behinderungJeLastpunkt;
  const totalHandicap = armorHandicap + shieldHandicap + overweightHandicap;

  // Geschwindigkeit abzüglich halber Behinderung rechnet abgeleiteteFuerCharakter aus dem Paket (GRW S. 165, 187)
  const derived: DerivedStats = { GSW: 0, INI: 0, LP: 0, FO: 0, VTD: 0, SR: armorSR, GW: 0, KW: 0 };

  // 5. Max LP & FO
  // LP und FO aus Stärken stehen im Paket (abgeleitete_werte_modifikatoren); ohne Paket keine
  let robustBonus = 0;
  let foBonusFromStrengths = 0;

  // 5a. Regelpakete geladen: Formeln, Heldengrad-Boni (VTD/GW/KW, Splitterpunkte), Stärken, Höchstbonus der Ausrüstung
  //     und kaufmännische Rundung der Behinderung aus den Regeldaten (GRW S. 11–18, 88–89)
  const heldengradNr = heldengrad.nr;
  const regelwerk = abgeleiteteFuerCharakter(state, currentAttributes, heldengradNr, { vtdBonus: gearVtdBonus, behinderung: totalHandicap });
  if (regelwerk) {
    derived.GSW = regelwerk.GSW;
    derived.INI = regelwerk.INI;
    derived.LP = regelwerk.LP - regelwerk.lpAusStaerken;
    derived.FO = regelwerk.FO - regelwerk.foAusStaerken;
    derived.VTD = regelwerk.VTD;
    derived.GW = regelwerk.GW;
    derived.KW = regelwerk.KW;
    derived.SR += regelwerk.SR;
    robustBonus = regelwerk.lpAusStaerken;
    foBonusFromStrengths = regelwerk.foAusStaerken;
  }
  // 5b. Dauerhafte Wirkungen von Meisterschaften auf abgeleitete Werte (z. B. Sprinter GSW +1, Gute Reflexe VTD +1), nur mit Regelpaketen
  const wirkungen = wirkungenFuerCharakter(state);
  if (regelwerk && wirkungen) {
    for (const [wert, b] of Object.entries(wirkungen.werteBoni)) {
      if (wert in derived) (derived as unknown as Record<string, number>)[wert] += b.summe;
    }
  }

  // 5c. Relikte im Besitz: Bonus auf GW/KW (Strukturgeber, GRW S. 254: nur der höchste Bonus zählt), nur mit Regelpaketen
  const reliktBoni = regelwerk ? reliktWiderstandFuerCharakter(state) : {};
  for (const [wert, b] of Object.entries(reliktBoni)) {
    if (wert in derived) (derived as unknown as Record<string, number>)[wert] += b.summe;
  }

  const lpMod = Number(state.playState?.lpModifier) || 0;
  const rawMaxLP = derived.LP + robustBonus + lpMod;
  const maxLP = isNaN(rawMaxLP) ? 0 : rawMaxLP;

  const rawMaxFO = derived.FO + foBonusFromStrengths;
  const maxFO = isNaN(rawMaxFO) ? 0 : rawMaxFO;

  // 6. Wound penalty
  const stufenGrw = grwGesundheitsstufen();
  const WOUND_PENALTIES = stufenGrw.map((x) => x.wundabzug);
  const HEALTH_LEVEL_NAMES = stufenGrw.map((x) => x.name);
  const slots = state.playState?.healthSlots ?? [];
  let currentWoundPenalty = 0;
  let currentHealthLevelName = 'Unverletzt';

  if (slots.length > 0 && maxLP > 0) {
    const consumedCount = slots.filter((s) => s.type === 'consumed').length;
    let levelIndex = 0;
    if (consumedCount > maxLP) {
      levelIndex = Math.min(4, Math.floor((consumedCount - 1) / maxLP));
    }

    const conditions = state.playState?.conditions ?? [];
    // Zustände, die laut Paket die Wundstufe verschlechtern (GRW: Verwundet): je Stufe eine Gesundheitsstufe tiefer
    levelIndex = Math.min(4, levelIndex + wundstufenVerschiebung(conditions));

    let penalty = WOUND_PENALTIES[levelIndex] ?? 0;
    if (penalty < 0) {
      // Wundabzüge verringert (Schmerzresistenz, Schmerzwiderstand; Wirkungen aus dem Paket, GRW S. 172)
      const reduction = wundabzugMinderung(state).summe;
      penalty = Math.min(0, penalty + reduction);
    }

    currentWoundPenalty = penalty;
    currentHealthLevelName = HEALTH_LEVEL_NAMES[levelIndex] ?? 'Unverletzt';
  }

  // 7. Splitter points
  const splinterPoints = regelwerk ? regelwerk.SP : 3;

  // 8. Creation Usage
  const attrPoints = Object.values(attrBase).reduce((a, b) => a + (Number(b) || 0), 0);
  const skillPoints = Object.values(skillsBase).reduce((a, b) => a + (Number(b) || 0), 0);
  const nonMagicPoints = grwAlleFertigkeiten().reduce((sum, skill) => {
    if (grwFertigkeitsKategorien().MAGIC.includes(skill)) return sum;
    return sum + (Number(skillsBase[skill]) || 0);
  }, 0);
  const strengthPoints = strengthsList
    .filter((s) => s.source === 'creation' && !s.isRacial && !s.isFree)
    .reduce((a, b) => {
      const cost = typeof b.pointCost === 'number' ? b.pointCost : 1;
      return a + (Number(b.level) || 1) * cost;
    }, 0);
  const resourcePoints = resourcesList
    .filter((r) => r.source === 'creation')
    .reduce((a, b) => a + (Number(b.level) || 1), 0);
  const languagePoints = languagesList
    .filter((l) => l.source === 'creation' && !l.isFree)
    .reduce((a, b) => {
      const cost = typeof b.pointCost === 'number' ? b.pointCost : 1;
      return a + cost;
    }, 0);

  let creationMasteriesCount = 0;
  let totalMasteriesCount = 0;
  Object.values(masteries).forEach((list) => {
    list.forEach((m) => {
      totalMasteriesCount++;
      if (m.isCreationBonus || m.isFree || m.source === 'Erschaffung') creationMasteriesCount++;
    });
  });

  const strengthLimit = staerkenBudget(race);

  const creationUsage: CreationUsage = {
    attr: attrPoints,
    skill: skillPoints,
    strength: strengthPoints,
    resource: resourcePoints,
    language: languagePoints,
    languages: languagesList.length,
    nonMagicPoints,
    creationMasteries: Math.min(3, creationMasteriesCount),
    strengthLimit,
    resourceLimit: 8,
  };

  const isCreationComplete =
    creationUsage.attr === 18 &&
    creationUsage.skill === 55 &&
    creationUsage.nonMagicPoints >= 5 &&
    creationUsage.strength === creationUsage.strengthLimit &&
    creationUsage.resource === creationUsage.resourceLimit &&
    (creationUsage.creationMasteries === 3 || totalMasteriesCount >= 3 || !!state.creationFinalized) &&
    creationUsage.languages === 2 &&
    homeRegion !== '';

  // 9. Free mastery slots
  const getFreeSlotsForSkill = (skill: string): number => {
    const base = skillsBase[skill] ?? 0;
    const xp = skillsXp[skill] ?? 0;
    const total = base + xp;
    let earned = 0;
    if (total >= 6) earned++;
    if (total >= 9) earned++;
    if (total >= 12) earned++;
    if (total >= 15) earned++;
    const used = (masteries[skill] ?? []).filter((m) => m.isFree).length;
    return Math.max(0, earned - used);
  };

  const getUsedFreeTiers = (skill: string): number[] => {
    return (masteries[skill] ?? [])
      .filter((m) => m.isFree)
      .map((m) => m.tier);
  };

  let totalFreeSlotsAvailable = 0;
  grwAlleFertigkeiten().forEach((skill) => {
    totalFreeSlotsAvailable += getFreeSlotsForSkill(skill);
  });

  // 10. Free spell slots
  const detailedFreeSpellSlots: Record<string, number[]> = {};
  grwFertigkeitsKategorien().MAGIC.forEach((skill) => {
    const val = (skillsBase[skill] ?? 0) + (skillsXp[skill] ?? 0);
    const earned: number[] = [];
    if (val >= 1) earned.push(0);
    if (val >= 3) earned.push(1);
    if (val >= 6) earned.push(2);
    if (val >= 9) earned.push(3);
    if (val >= 12) earned.push(4);
    if (val >= 15) earned.push(5);
    const usedInSchool = spellsList
      .filter((s) => s.isFree && s.school === skill)
      .map((s) => s.grade)
      .sort((a, b) => a - b);
    earned.sort((a, b) => a - b);
    usedInSchool.forEach((usedGrade) => {
      const idx = earned.findIndex((slot) => slot >= usedGrade);
      if (idx !== -1) earned.splice(idx, 1);
    });
    detailedFreeSpellSlots[skill] = earned;
  });

  const totalFreeSpellSlots = (Object.values(detailedFreeSpellSlots) as number[][]).reduce(
    (sum: number, slots: number[]) => sum + slots.length,
    0,
  );

  // 11. Grouped masteries & spells
  const allMasterySkills = Array.from(new Set([...grwAlleFertigkeiten(), ...Object.keys(masteries)])).sort();
  const groupedMasteries = allMasterySkills.map((skill) => {
    const mList = masteries[skill] ?? [];
    if (mList.length === 0) return null;
    const sortedItems = [...mList].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
    return { skill, items: sortedItems };
  }).filter((g): g is NonNullable<typeof g> => g !== null);

  const groups: Record<string, typeof spellsList> = {};
  spellsList.forEach((s) => {
    if (!groups[s.school]) groups[s.school] = [];
    groups[s.school].push(s);
  });
  const groupedSpells = Object.keys(groups)
    .sort()
    .map((skill) => ({
      skill,
      items: groups[skill].sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name)),
    }));

  // 12. Helpers
  const getSkillValue = (skill: string) => (skillsBase[skill] ?? 0) + (skillsXp[skill] ?? 0);

  const getSkillBonus = (skill: string) => wirkungen?.fertigkeitsBoni[skill]?.summe ?? 0;

  const getSkillTotal = (skill: string): number | null => {
    const val = getSkillValue(skill);
    const attrs = grwFertigkeitsattribute()[skill];
    if (!attrs) return null;
    return val + currentAttributes[attrs[0]] + currentAttributes[attrs[1]] + getSkillBonus(skill);
  };

  const xpAvailable = xpTotal - xpSpent;

  return {
    getAttrValue,
    currentAttributes,
    xpSpent,
    xpAvailable,
    heldengrad,
    derived,
    robustBonus,
    maxLP,
    maxFO,
    currentWoundPenalty,
    currentHealthLevelName,
    splinterPoints,
    creationUsage,
    isCreationComplete,
    getFreeSlotsForSkill,
    getUsedFreeTiers,
    totalFreeSlotsAvailable,
    detailedFreeSpellSlots,
    totalFreeSpellSlots,
    groupedMasteries,
    groupedSpells,
    getSkillValue,
    getSkillTotal,
    armorSR,
    gearVtdBonus,
    gearHandicap,
    gearTickModifier,
    armorHandicap,
    shieldHandicap,
    overweightHandicap,
    totalHandicap,
    loadCapacity,
    totalLoad,
    regelwerk,
    wirkungen,
    getSkillBonus,
  };
}
