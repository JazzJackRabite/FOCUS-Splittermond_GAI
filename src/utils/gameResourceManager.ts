import type { Spell } from '../types/regeldaten';
import type { MasteryEntry } from '../types/regeldaten';
import type { StrengthData } from '../types/regeldaten';
import type { ResourceData } from '../types/regeldaten';
import type { CharacterState, Mastery, AdvancementLogEntry } from '../types';
import { generateId } from './id';
import type { RulebookModulePackage, RulebookMastery } from '../types/rulebookSchema';
import { grimoireModule } from '../regelwerk/bruecke';
import { grwAllgemeineKampfmeisterschaften, grwAllgemeineMagiemeisterschaften, grwMeisterschaften, grwRessourcen, grwRessourcenTexte, grwSchwaechenNamen, grwSchwaechenSeiten, grwSchwaechenTexte, grwSprachen, grwStaerken, grwZauber } from '../regelwerk/grwListen';

export type StrengthEntry = StrengthData;
export type ResourceEntry = ResourceData;

// ---------------------------------------------------------------------------
// Aktive Module: das eingebaute Grundregelwerk (src/data) plus die hochgeladenen Regelpakete
// (Einstellungen → Regelpakete). Die frühere Modul- und Override-Verwaltung („Admin & Ressourcen“)
// ist entfernt; alte Einträge im Browserspeicher werden nicht mehr gelesen.
// ---------------------------------------------------------------------------

function getActivePackages(): RulebookModulePackage[] {
  return grimoireModule();
}

// ---------------------------------------------------------------------------
// Unified Resolved Resource Lookups (Core GRW + hochgeladene Regelpakete)
// ---------------------------------------------------------------------------

export function getSpellDescription(spellName: string, schoolName?: string, defaultDesc = ''): string {

  const trimmed = spellName.trim().toLowerCase();

  // 1. Search in active module packages
  const activePackages = getActivePackages();
  for (const pkg of activePackages) {
    const found = pkg.resources.spells?.find(
      (s) =>
        s.name.toLowerCase() === trimmed &&
        (!schoolName || s.school.toLowerCase() === schoolName.trim().toLowerCase()),
    );
    if (found?.description) return found.description;
  }

  // 2. Search in core GRW
  if (schoolName) {
    const found = grwZauber().find(
      (s) => s.name.toLowerCase() === trimmed && s.school.toLowerCase() === schoolName.trim().toLowerCase(),
    );
    if (found?.description) return found.description;
  }
  const fallback = grwZauber().find((s) => s.name.toLowerCase() === trimmed);
  return fallback?.description || defaultDesc;
}

/**
 * Returns all spells (Core GRW + all active modules) with overrides applied.
 */
export function getResolvedSpells(schoolFilter?: string): Spell[] {
  const activePackages = getActivePackages();

  // Combine Core + Active Modules
  const baseSpells: Spell[] = [...grwZauber()];

  for (const pkg of activePackages) {
    if (pkg.resources.spells && pkg.resources.spells.length > 0) {
      for (const s of pkg.resources.spells) {
        baseSpells.push({
          name: s.name,
          school: s.school,
          grade: s.grade,
          cost: s.cost,
          castTime: s.castTime,
          range: s.range,
          duration: s.duration,
          target: s.target,
          description: s.description,
          damage: s.damage,
          page: s.page,
          source: s.source || pkg.shortName,
        });
      }
    }
  }

  return baseSpells.filter((s) => !schoolFilter || s.school === schoolFilter);
}

export function canonicalSchool(schoolName?: string): string {
  if (!schoolName) return '';
  const trimmed = schoolName.trim();
  const lower = trimmed.toLowerCase();
  for (const s of [
    'Bannmagie', 'Beherrschungsmagie', 'Bewegungsmagie', 'Erkenntnismagie',
    'Felsmagie', 'Feuermagie', 'Heilungsmagie', 'Illusionsmagie',
    'Kampfmagie', 'Lichtmagie', 'Naturmagie', 'Schattenmagie',
    'Schicksalsmagie', 'Schutzmagie', 'Stärkungsmagie', 'Todesmagie',
    'Verwandlungsmagie', 'Wassermagie', 'Windmagie'
  ]) {
    if (s.toLowerCase() === lower) return s;
    if (s.toLowerCase().startsWith(lower)) return s;
  }
  if (lower.startsWith('tod')) return 'Todesmagie';
  return trimmed;
}

export function matchSchool(s1?: string, s2?: string): boolean {
  if (!s1 || !s2) return false;
  if (s1.toLowerCase() === s2.toLowerCase()) return true;
  return canonicalSchool(s1) === canonicalSchool(s2);
}

export interface SpellDetailsResult {
  found: boolean;
  name: string;
  school: string;
  grade: number;
  cost: string | number;
  castTime?: string;
  range?: string;
  duration?: string;
  target?: string;
  description: string;
  damage?: string;
  source: string;
  page?: number;
}

/**
 * Returns full details (description, source, page, stats) for a spell.
 * Checks active rulebook modules, core GRW, and custom overrides.
 * If not found in any database or module, marks source as 'unbekannt'.
 */
export function getSpellDetails(
  spellName: string,
  schoolName?: string,
  fallbackDesc = '',
): SpellDetailsResult {
  const normSpell = spellName.trim().toLowerCase();
  const canonSchool = canonicalSchool(schoolName);

  // 1. Search in active module packages
  const activePackages = getActivePackages();
  for (const pkg of activePackages) {
    const found = pkg.resources.spells?.find(
      (s) =>
        s.name.trim().toLowerCase() === normSpell &&
        (!schoolName || matchSchool(s.school, schoolName)),
    );
    if (found) {
      return {
        found: true,
        name: found.name,
        school: canonicalSchool(found.school) || canonSchool,
        grade: found.grade,
        cost: found.cost,
        castTime: found.castTime,
        range: found.range,
        duration: found.duration,
        target: found.target,
        description: found.description || fallbackDesc || 'Details zum Zauber im Regelwerk.',
        damage: found.damage,
        source: found.source || pkg.shortName || 'Modul',
        page: found.page,
      };
    }
  }

  // 2. Search in core GRW
  if (schoolName) {
    const found = grwZauber().find(
      (s) => s.name.trim().toLowerCase() === normSpell && matchSchool(s.school, schoolName),
    );
    if (found) {
      return {
        found: true,
        name: found.name,
        school: canonicalSchool(found.school) || canonSchool,
        grade: found.grade,
        cost: found.cost,
        castTime: found.castTime,
        range: found.range,
        duration: found.duration,
        target: found.target,
        description: found.description || fallbackDesc || 'Details zum Zauber im Regelwerk.',
        damage: found.damage,
        source: found.source || 'GRW',
        page: found.page,
      };
    }
  }

  // 3. Fallback search across all spells in grwZauber() by name alone
  const fallback = grwZauber().find((s) => s.name.trim().toLowerCase() === normSpell);
  if (fallback) {
    return {
      found: true,
      name: fallback.name,
      school: canonSchool || canonicalSchool(fallback.school),
      grade: fallback.grade,
      cost: fallback.cost,
      castTime: fallback.castTime,
      range: fallback.range,
      duration: fallback.duration,
      target: fallback.target,
      description: fallback.description || fallbackDesc || 'Details zum Zauber im Regelwerk.',
      damage: fallback.damage,
      source: fallback.source || 'GRW',
      page: fallback.page,
    };
  }

  // 4. Not found in any database or loaded rulebook module
  return {
    found: false,
    name: spellName,
    school: canonSchool || 'Magie',
    grade: 0,
    cost: 'K1',
    description: fallbackDesc || 'Unbekannter Zauber (nicht im Regelwerk gefunden).',
    source: 'unbekannt',
    page: undefined,
  };
}

export function matchSkillName(s1?: string, s2?: string): boolean {
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  return (
    s1.replace(/\s+und\s+/g, ' & ').trim().toLowerCase() ===
    s2.replace(/\s+und\s+/g, ' & ').trim().toLowerCase()
  );
}

export function getMasteryDescription(
  skillName: string,
  masteryName: string,
  defaultDesc = '',
): string {

  // 1. Search in active module packages
  const activePackages = getActivePackages();
  for (const pkg of activePackages) {
    const found = pkg.resources.masteries?.find(
      (m) =>
        m.name === masteryName &&
        (!skillName || m.skill === skillName || matchSkillName(m.skill, skillName) || m.skill === 'Allgemein'),
    );
    if (found?.desc) return found.desc;
  }

  // 2. Search in core GRW
  const found = (grwMeisterschaften()[skillName] ?? []).find((x) => x.name === masteryName);
  if (found?.desc) return found.desc;

  const general = grwAllgemeineKampfmeisterschaften().find((x) => x.name === masteryName);
  if (general?.desc) return general.desc;

  const magic = grwAllgemeineMagiemeisterschaften().find((x) => x.name === masteryName);
  if (magic?.desc) return magic.desc;

  return defaultDesc;
}

export interface MasteryDetailsResult {
  found: boolean;
  name: string;
  tier: number;
  desc: string;
  source: string;
  page?: number;
  skill?: string;
  manoever?: boolean;
}

/**
 * Returns full details (description, source, page, tier) for a mastery.
 * Checks active rulebook modules, core GRW, and custom overrides.
 * If not found in any database or module, marks source as 'unbekannt'.
 */
export function getMasteryDetails(
  skillName: string,
  masteryName: string,
  fallbackDesc = '',
): MasteryDetailsResult {
  const norm = masteryName.replace(/\s*\([ST]?\d+\)$/i, '').trim().toLowerCase();
  const tierMatch = masteryName.match(/\([ST]?(\d+)\)/i);
  const fallbackTier = tierMatch ? parseInt(tierMatch[1], 10) : 1;

  // 1. Search in active module packages
  const activePackages = getActivePackages();
  for (const pkg of activePackages) {
    const found = pkg.resources.masteries?.find(
      (m) =>
        (m.name === masteryName || m.name.replace(/\s*\([ST]?\d+\)$/i, '').trim().toLowerCase() === norm) &&
        (!skillName || m.skill === skillName || matchSkillName(m.skill, skillName) || m.skill === 'Allgemein'),
    );
    if (found) {
      return {
        found: true,
        name: found.name,
        tier: typeof found.level === 'number' ? found.level : (Number(found.level) || fallbackTier),
        desc: found.desc || fallbackDesc || 'Details zur Meisterschaft im Regelwerk.',
        source: found.source || pkg.shortName || 'Modul',
        page: found.page,
        skill: found.skill || skillName,
      };
    }
  }

  // 2. Search in core GRW for specified skill
  const skillList = grwMeisterschaften()[skillName] ?? [];
  const foundInSkill = skillList.find(
    (x) => x.name === masteryName || x.baseName === masteryName || x.name.replace(/\s*\([ST]?\d+\)$/i, '').trim().toLowerCase() === norm
  );
  if (foundInSkill) {
    return {
      found: true,
      name: foundInSkill.name,
      tier: foundInSkill.tier ?? fallbackTier,
      desc: foundInSkill.desc || fallbackDesc || 'Details zur Meisterschaft im Regelwerk.',
      source: foundInSkill.source || 'GRW',
      page: foundInSkill.page,
      skill: foundInSkill.skill || skillName,
      manoever: foundInSkill.manoever,
    };
  }

  // 3. Search in general combat masteries
  const generalCombat = grwAllgemeineKampfmeisterschaften().find(
    (x) => x.name === masteryName || x.baseName === masteryName || x.name.replace(/\s*\([ST]?\d+\)$/i, '').trim().toLowerCase() === norm
  );
  if (generalCombat) {
    return {
      found: true,
      name: generalCombat.name,
      tier: generalCombat.tier ?? fallbackTier,
      desc: generalCombat.desc || fallbackDesc || 'Details zur Meisterschaft im Regelwerk.',
      source: generalCombat.source || 'GRW',
      page: generalCombat.page,
      skill: generalCombat.skill || skillName,
      manoever: generalCombat.manoever,
    };
  }

  // 4. Search in general magic masteries
  const generalMagic = grwAllgemeineMagiemeisterschaften().find(
    (x) => x.name === masteryName || x.baseName === masteryName || x.name.replace(/\s*\([ST]?\d+\)$/i, '').trim().toLowerCase() === norm
  );
  if (generalMagic) {
    return {
      found: true,
      name: generalMagic.name,
      tier: generalMagic.tier ?? fallbackTier,
      desc: generalMagic.desc || fallbackDesc || 'Details zur Meisterschaft im Regelwerk.',
      source: generalMagic.source || 'GRW',
      page: generalMagic.page,
      skill: generalMagic.skill || skillName,
    };
  }

  // 5. Fallback across all skills in grwMeisterschaften()
  for (const [sKey, list] of Object.entries(grwMeisterschaften())) {
    const f = list.find(
      (x) => x.name === masteryName || x.baseName === masteryName || x.name.replace(/\s*\([ST]?\d+\)$/i, '').trim().toLowerCase() === norm
    );
    if (f) {
      return {
        found: true,
        name: f.name,
        tier: f.tier ?? fallbackTier,
        desc: f.desc || fallbackDesc || 'Details zur Meisterschaft im Regelwerk.',
        source: f.source || 'GRW',
        page: f.page,
        skill: f.skill || sKey,
        manoever: f.manoever,
      };
    }
  }

  // 6. Not found in any database or loaded rulebook module
  return {
    found: false,
    name: masteryName,
    tier: fallbackTier,
    desc: fallbackDesc || 'Unbekannte Meisterschaft (nicht im Regelwerk gefunden).',
    source: 'unbekannt',
    page: undefined,
    skill: skillName,
  };
}

/**
 * Returns all masteries (Core GRW + all active modules) with overrides applied.
 */
export function getResolvedMasteries(skillName?: string): MasteryEntry[] {
  const activePackages = getActivePackages();
  const map = new Map<string, MasteryEntry>();

  // Add core GRW masteries
  if (skillName) {
    for (const item of grwMeisterschaften()[skillName] ?? []) {
      map.set(item.name, item);
    }
  } else {
    for (const arr of Object.values(grwMeisterschaften())) {
      for (const item of arr) {
        map.set(item.name, item);
      }
    }
    for (const item of grwAllgemeineKampfmeisterschaften()) {
      map.set(item.name, item);
    }
    for (const item of grwAllgemeineMagiemeisterschaften()) {
      map.set(item.name, item);
    }
  }

  // Add active module masteries
  for (const pkg of activePackages) {
    if (pkg.resources.masteries) {
      for (const m of pkg.resources.masteries) {
        if (!skillName || m.skill === skillName || matchSkillName(m.skill, skillName) || (skillName && m.skill === 'Allgemein')) {
          const extra = m as RulebookMastery & Partial<MasteryEntry> & { regelId?: string };
          map.set(m.name, {
            name: m.name,
            desc: m.desc,
            page: m.page,
            source: m.source || pkg.shortName,
            ...(extra.tier !== undefined ? { tier: extra.tier, baseName: extra.baseName, skill: extra.skill, manoever: extra.manoever, prerequisiteText: extra.prerequisiteText ?? null } : {}),
            ...(extra.regelId ? { id: extra.regelId } : {}),
          });
        }
      }
    }
  }

  return Array.from(map.values());
}

export function getStrengthDescription(name: string, defaultDesc = ''): string {

  const activePackages = getActivePackages();
  for (const pkg of activePackages) {
    const found = pkg.resources.strengths?.find((s) => s.name === name);
    if (found?.desc) return found.desc;
  }

  const found = grwStaerken().find((s) => s.name === name);
  return found?.desc || defaultDesc;
}

/**
 * Returns full details (description, source, page) for a strength.
 */
export function getStrengthDetails(
  name: string,
  fallbackDesc = '',
): { found: boolean; desc: string; source: string; page?: number; cost?: number } {
  const activePackages = getActivePackages();
  for (const pkg of activePackages) {
    const found = pkg.resources.strengths?.find((s) => s.name === name);
    if (found) {
      return {
        found: true,
        desc: found.desc || fallbackDesc || 'Details im Regelwerk.',
        source: found.source || pkg.shortName || 'Modul',
        page: found.page,
        cost: found.cost ?? 1,
      };
    }
  }

  const found = grwStaerken().find((s) => s.name === name);
  if (found) {
    return {
      found: true,
      desc: found.desc || fallbackDesc || 'Details im Regelwerk.',
      source: found.source || 'GRW',
      page: found.page,
      cost: found.cost ?? 1,
    };
  }

  return {
    found: false,
    desc: fallbackDesc || 'Unbekannte Stärke (nicht im Regelwerk gefunden).',
    source: 'unbekannt',
    page: undefined,
    cost: 1,
  };
}

/**
 * Returns all strengths (Core GRW + active modules) with overrides applied.
 */
export function getResolvedStrengths(): StrengthEntry[] {
  const activePackages = getActivePackages();
  const list: StrengthEntry[] = [...grwStaerken()];

  for (const pkg of activePackages) {
    if (pkg.resources.strengths) {
      for (const s of pkg.resources.strengths) {
        list.push({
          name: s.name,
          cost: s.cost ?? 1,
          max: s.max ?? 1,
          multi: s.multi ?? false,
          onlyCreation: s.onlyCreation ?? false,
          desc: s.desc,
          page: s.page ?? 0,
          source: s.source || pkg.shortName,
        });
      }
    }
  }

  return list;
}

export function getWeaknessDescription(name: string, defaultDesc = ''): string {

  const activePackages = getActivePackages();
  for (const pkg of activePackages) {
    const found = pkg.resources.weaknesses?.find((w) => w.name === name);
    if (found?.desc) return found.desc;
  }

  return grwSchwaechenTexte()[name] || defaultDesc;
}

/**
 * Returns full details (description, source, page) for a weakness.
 */
export function getWeaknessDetails(
  name: string,
  fallbackDesc = '',
): { found: boolean; desc: string; source: string; page?: number } {
  const activePackages = getActivePackages();
  for (const pkg of activePackages) {
    const found = pkg.resources.weaknesses?.find((w) => w.name === name);
    if (found) {
      return {
        found: true,
        desc: found.desc || fallbackDesc || 'Details im Regelwerk.',
        source: found.source || pkg.shortName || 'Modul',
        page: found.page ?? grwSchwaechenSeiten()[name] ?? 84,
      };
    }
  }

  if (grwSchwaechenTexte()[name]) {
    return {
      found: true,
      desc: grwSchwaechenTexte()[name] || fallbackDesc || 'Details im Regelwerk.',
      source: 'GRW',
      page: grwSchwaechenSeiten()[name] ?? 84,
    };
  }

  return {
    found: false,
    desc: fallbackDesc || 'Unbekannte Schwäche (nicht im Regelwerk gefunden).',
    source: 'unbekannt',
    page: undefined,
  };
}

/**
 * Returns full details (description, source, page) for a language.
 */
export function getLanguageDetails(
  name: string,
  fallbackDesc = '',
): { found: boolean; desc: string; source: string; page?: number } {
  const found = grwSprachen().find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (found) {
    const familyInfo = found.family ? `Sprachfamilie: ${found.family}.` : '';
    const desc = fallbackDesc || (familyInfo ? `${familyInfo} Details im Regelwerk.` : 'Sprache in Lorakis.');
    return {
      found: true,
      desc,
      source: found.source || 'GRW',
      page: found.page ?? 314,
    };
  }

  return {
    found: false,
    desc: fallbackDesc || 'Unbekannte Sprache.',
    source: 'unbekannt',
    page: undefined,
  };
}

/**
 * Returns all weaknesses (Core GRW + active modules) with overrides applied.
 */
export function getResolvedWeaknesses(): {
  list: string[];
  descriptions: Record<string, string>;
} {
  const activePackages = getActivePackages();
  const list = [...grwSchwaechenNamen()];
  const descMap: Record<string, string> = { ...grwSchwaechenTexte() };

  for (const pkg of activePackages) {
    if (pkg.resources.weaknesses) {
      for (const w of pkg.resources.weaknesses) {
        if (!list.includes(w.name)) {
          list.push(w.name);
        }
        descMap[w.name] = w.desc;
      }
    }
  }

  return {
    list,
    descriptions: descMap,
  };
}

export function getResourceDescription(name: string, defaultDesc = ''): string {

  const activePackages = getActivePackages();
  for (const pkg of activePackages) {
    const found = pkg.resources.gameResources?.find((r) => r.name === name);
    if (found?.desc) return found.desc;
  }

  return grwRessourcenTexte()[name] || defaultDesc;
}

/**
 * Returns full details (description, source, page) for a resource.
 */
export function getResourceDetails(
  name: string,
  fallbackDesc = '',
): { found: boolean; desc: string; source: string; page?: number } {
  const activePackages = getActivePackages();
  for (const pkg of activePackages) {
    const found = pkg.resources.gameResources?.find((r) => r.name === name);
    if (found) {
      return {
        found: true,
        desc: found.desc || fallbackDesc || 'Details im Regelwerk.',
        source: found.source || pkg.shortName || 'Modul',
        page: found.page,
      };
    }
  }

  const found = grwRessourcen().find((r) => r.name === name);
  if (found || grwRessourcenTexte()[name]) {
    return {
      found: true,
      desc: found?.desc || grwRessourcenTexte()[name] || fallbackDesc || 'Details im Regelwerk.',
      source: found?.source || 'GRW',
      page: found?.page ?? 75,
    };
  }

  return {
    found: false,
    desc: fallbackDesc || 'Unbekannte Ressource (nicht im Regelwerk gefunden).',
    source: 'unbekannt',
    page: undefined,
  };
}

/**
 * Returns all resources (Core GRW + active modules) with overrides applied.
 */
export function getResolvedResources(): {
  list: ResourceEntry[];
  descriptions: Record<string, string>;
} {
  const activePackages = getActivePackages();
  const list: ResourceEntry[] = [...grwRessourcen()];
  const descMap: Record<string, string> = { ...grwRessourcenTexte() };

  for (const pkg of activePackages) {
    if (pkg.resources.gameResources) {
      for (const r of pkg.resources.gameResources) {
        list.push({
          name: r.name,
          desc: r.desc,
          page: r.page ?? 0,
          source: r.source || pkg.shortName,
        });
        descMap[r.name] = r.desc;
      }
    }
  }

  const resolvedList = list.map((r) => {
    const resolvedDesc = descMap[r.name] || r.desc;
    descMap[r.name] = resolvedDesc;
    return {
      ...r,
      desc: resolvedDesc,
    };
  });

  return {
    list: resolvedList,
    descriptions: descMap,
  };
}

/**
 * Takes any partial or full CharacterState (from presets, imports, or storage)
 * and references all game resources against the built-in GRW data and the uploaded rule packages.
 *
 * - Masteries: resolved by canonical name, authentic description, authentic source, page, tier, and skill.
 * - Spells: resolved by canonical name and school, authentic description, focus cost, cast time, page, and source.
 * - Strengths, Weaknesses, Resources, Languages: resolved against active modules & GRW datasets.
 * - Missing resources in DB: assigned source 'unbekannt'.
 * - Advancement log: seeds initial entries so they display in the advancement (Steigerung) protocol tabs.
 */
export function referenceCharacterResources(rawState: Partial<CharacterState>): CharacterState {
  const state = { ...rawState };

  // 1. Reference Masteries
  const resolvedMasteries: Record<string, Mastery[]> = {};
  if (state.masteries && typeof state.masteries === 'object') {
    for (const [skill, list] of Object.entries(state.masteries)) {
      if (!Array.isArray(list)) continue;
      resolvedMasteries[skill] = list.map((m) => {
        const details = getMasteryDetails(skill, m.name, m.desc);
        return {
          id: m.id || generateId(),
          name: details.name,
          tier: details.tier,
          cost: m.cost ?? (m.isFree || m.isCreationBonus ? 0 : details.tier * 5),
          isFree: m.isFree ?? false,
          isCreationBonus: m.isCreationBonus ?? false,
          source: details.source,
          page: details.page,
          desc: details.desc,
          skill: skill,
          userNote: m.userNote,
        };
      });
    }
  }
  state.masteries = resolvedMasteries;

  // 2. Reference Spells
  if (Array.isArray(state.spellsList)) {
    state.spellsList = state.spellsList.map((s) => {
      const details = getSpellDetails(s.name, s.school, s.description);
      return {
        name: details.name,
        school: details.school,
        grade: details.grade,
        cost: details.cost,
        castTime: details.castTime,
        range: details.range,
        duration: details.duration,
        target: details.target,
        description: details.description,
        damage: details.damage,
        source: details.source,
        page: details.page,
        isFree: s.isFree ?? false,
        xpCost: s.xpCost,
        sourceMode: s.sourceMode || 'creation',
      };
    });
  } else {
    state.spellsList = [];
  }

  // 3. Reference Strengths
  if (Array.isArray(state.strengthsList)) {
    state.strengthsList = state.strengthsList.map((st) => {
      const details = getStrengthDetails(st.name, st.desc);
      return {
        ...st,
        desc: details.desc,
        sourceRef: details.source,
        page: details.page,
        pointCost: st.pointCost ?? details.cost ?? 1,
      };
    });
  } else {
    state.strengthsList = [];
  }

  // 4. Reference Weaknesses
  if (Array.isArray(state.weaknessesList)) {
    state.weaknessesList = state.weaknessesList.map((w) => {
      const details = getWeaknessDetails(w.name, w.desc);
      return {
        ...w,
        desc: details.desc,
        sourceRef: details.source,
        page: details.page,
      };
    });
  } else {
    state.weaknessesList = [];
  }

  // 5. Reference Resources
  if (Array.isArray(state.resourcesList)) {
    state.resourcesList = state.resourcesList.map((r) => {
      const details = getResourceDetails(r.name, r.desc);
      return {
        ...r,
        desc: details.desc,
        sourceRef: details.source,
        page: details.page,
      };
    });
  } else {
    state.resourcesList = [];
  }

  // 6. Reference Languages
  if (Array.isArray(state.languagesList)) {
    state.languagesList = state.languagesList.map((l) => {
      const details = getLanguageDetails(l.name, l.desc);
      return {
        ...l,
        desc: details.desc,
        sourceRef: details.source,
        page: details.page,
      };
    });
  } else {
    state.languagesList = [];
  }

  // 7. Ensure Advancement Log contains entries for starting values so they show in Steigerungsprotokoll
  const existingLog = Array.isArray(state.advancementLog) ? [...state.advancementLog] : [];
  const hasMasteryLog = existingLog.some((e) => e.category === 'mastery');
  const hasSpellLog = existingLog.some((e) => e.category === 'spell');

  // If no advancement logs exist or masteries/spells are not recorded, generate initial creation log entries
  if (existingLog.length === 0 || (!hasMasteryLog && Object.keys(resolvedMasteries).length > 0) || (!hasSpellLog && state.spellsList.length > 0)) {
    const creationEntries: AdvancementLogEntry[] = [];
    const timestamp = 'Erschaffung';

    // Seed masteries
    for (const [skill, list] of Object.entries(resolvedMasteries)) {
      for (const m of list) {
        const alreadyLogged = existingLog.some((e) => e.category === 'mastery' && e.title.includes(m.name));
        if (!alreadyLogged) {
          creationEntries.push({
            id: generateId(),
            timestamp,
            category: 'mastery',
            title: `Meisterschaft: ${m.name}`,
            detail: `Fertigkeit: ${skill} (Schwelle S${m.tier}) · Quelle: ${m.source}${m.page ? ', S. ' + m.page : ''}`,
            xpDelta: m.cost > 0 ? -m.cost : 0,
          });
        }
      }
    }

    // Seed spells
    for (const s of state.spellsList) {
      const alreadyLogged = existingLog.some((e) => e.category === 'spell' && e.title.includes(s.name));
      if (!alreadyLogged) {
        creationEntries.push({
          id: generateId(),
          timestamp,
          category: 'spell',
          title: `Zauber: ${s.name}`,
          detail: `Schule: ${s.school}, Grad ${s.grade} · Fokus: ${s.cost} · Quelle: ${s.source}${s.page ? ', S. ' + s.page : ''}`,
          xpDelta: 0,
        });
      }
    }

    // Seed strengths
    for (const st of state.strengthsList) {
      const alreadyLogged = existingLog.some((e) => e.category === 'strength' && e.title.includes(st.name));
      if (!alreadyLogged) {
        creationEntries.push({
          id: generateId(),
          timestamp,
          category: 'strength',
          title: `Stärke: ${st.name}`,
          detail: `Punkte: ${st.pointCost ?? 1} · Quelle: ${st.sourceRef || 'GRW'}${st.page ? ', S. ' + st.page : ''}`,
          xpDelta: 0,
        });
      }
    }

    // Seed resources
    for (const r of state.resourcesList) {
      const alreadyLogged = existingLog.some((e) => e.category === 'resource' && e.title.includes(r.name));
      if (!alreadyLogged) {
        creationEntries.push({
          id: generateId(),
          timestamp,
          category: 'resource',
          title: `Ressource: ${r.name} (Wert ${r.level})`,
          detail: `Punkte: ${r.level} · Quelle: ${r.sourceRef || 'GRW'}${r.page ? ', S. ' + r.page : ''}`,
          xpDelta: 0,
        });
      }
    }

    // Seed XP
    if (!existingLog.some((e) => e.category === 'xp')) {
      creationEntries.push({
        id: generateId(),
        timestamp,
        category: 'xp',
        title: 'Start-Erfahrungspunkte',
        detail: `${state.xpTotal ?? 15} EP bei Erschaffung`,
        xpDelta: state.xpTotal ?? 15,
      });
    }

    state.advancementLog = [...existingLog, ...creationEntries];
  } else {
    state.advancementLog = existingLog;
  }

  return state as CharacterState;
}
