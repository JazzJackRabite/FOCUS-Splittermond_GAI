import { lpKaestchen, sterbestand, sterberegeln } from '../regelwerk/schadenUndHeilung';
import { istZustand, zustandHatStufe, nachPause, ohneNatuerlicheHeilung } from '../regelwerk/zustaende';
import { useReducer, useEffect } from 'react';
import type {
  CharacterState,
  CharacterAction,
  AppMode,
  AttrMap,
  ItemEntry,
  Mastery,
  Spell,
  HealthSlot,
  PlayState,
  StatusCondition,
  AdvancementLogEntry,
} from '../types';

import { mitRegelIds } from '../regelwerk/bruecke';
import { saveToLocalStorage, loadFromLocalStorage } from './useLocalStorage';
import { generateId } from '../utils/id';
import { getSkillXpCost, getAttrXpCost, calculateItemCost } from '../utils/costCalculations';
import { getResolvedResources, referenceCharacterResources } from '../utils/gameResourceManager';
import { aktiverKatalog } from '../regelwerk/bruecke';
import { spielwerteDesZaubers } from '../regelwerk/zauberwerte';
import { gratisStaerkeDerKultur, grwStaerken } from '../regelwerk/grwListen';

function createLogEntry(
  category: AdvancementLogEntry['category'],
  title: string,
  detail?: string,
  xpDelta?: number,
): AdvancementLogEntry {
  return {
    id: generateId(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    category,
    title,
    detail,
    xpDelta,
  };
}

// ---------------------------------------------------------------
// Default state
// ---------------------------------------------------------------

const DEFAULT_ATTR_MAP: AttrMap = {
  AUS: 1, BEW: 1, INT: 1, KON: 1, MYS: 1, STA: 1, VER: 1, WIL: 1,
};

const DEFAULT_INCREMENT_MAP: AttrMap = {
  AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0,
};

const DEFAULT_PLAY_STATE: PlayState = {
  healthSlots: [],
  focus: { exhausted: 0, channeled: 0, consumed: 0 },
  splitterPoints: 3, // placeholder; overwritten by PLAY_RESET which uses actual calculated value
  channeledSpells: [],
  dyingLevel: 0,
  conditions: [],
  tempHP: 0,
  tempHPUsed: 0,
  lpModifier: 0,
};

export const DEFAULT_STATE: CharacterState = {
  mode: 'creation',
  xpTotal: 15,
  name: 'Neuer Held',
  race: 'Mensch',
  moonSign: '',
  homeRegion: '',
  attrBase: { ...DEFAULT_ATTR_MAP },
  raceBonusAttrs: [],
  attrIncrements: { ...DEFAULT_INCREMENT_MAP },
  skillsBase: {},
  skillsXp: {},
  masteries: {},
  strengthsList: [],
  resourcesList: [],
  weaknessesList: [],
  languagesList: [],
  spellsList: [],
  playState: { ...DEFAULT_PLAY_STATE },
  inventory: [],
  money: { solare: 0, lunare: 5, telare: 0 },
  advancementLog: [],
  creationFinalized: false,
  ignoreEncumbrance: false,
};

// ---------------------------------------------------------------
// Health slot helpers
// ---------------------------------------------------------------

/**
 * Sortiert HealthSlots nach Splittermond-Regelwerk:
 * Schwerster Schaden vorne (links), leichtester hinten (rechts).
 * consumed (■) → exhausted (✕) → channeled (/) → empty
 */
function normalizeHealthSlots(slots: HealthSlot[]): HealthSlot[] {
  const consumed  = slots.filter((s) => s.type === 'consumed');
  const exhausted = slots.filter((s) => s.type === 'exhausted');
  const channeled = slots.filter((s) => s.type === 'channeled');
  const empty     = slots.filter((s) => s.type === 'empty');
  return [...consumed, ...exhausted, ...channeled, ...empty];
}

// ---------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------

const ADVANCEMENT_ACTION_TYPES = new Set([
  'SET_XP_TOTAL',
  'ADD_XP_WITH_NOTE',
  'ADD_ADVANCEMENT_LOG',
  'REMOVE_ADVANCEMENT_LOG_ENTRY',
  'CLEAR_ADVANCEMENT_LOG',
  'MOD_ATTR_XP',
  'MOD_SKILL',
  'SET_SKILLS_XP',
  'ADD_MASTERY',
  'REMOVE_MASTERY_BY_ID',
  'REMOVE_MASTERY_BY_IDX',
  'ADD_SPELL',
  'REMOVE_SPELL_BY_IDX',
  'ADD_STRENGTH',
  'REMOVE_STRENGTH',
  'ADD_RESOURCE',
  'RESOURCE_STEIGERN',
  'REMOVE_RESOURCE',
  'ADD_WEAKNESS',
  'REMOVE_WEAKNESS',
  'ADD_LANGUAGE',
  'REMOVE_LANGUAGE',
]);

export function baseCharacterReducer(
  state: CharacterState,
  action: CharacterAction,
): CharacterState {
  switch (action.type) {
    case 'LOAD_STATE': {
      const KNOWN_KEYS: (keyof CharacterState)[] = [
        'mode', 'xpTotal', 'name', 'race', 'moonSign', 'homeRegion',
        'attrBase', 'raceBonusAttrs', 'attrIncrements',
        'skillsBase', 'skillsXp', 'masteries',
        'strengthsList', 'resourcesList', 'weaknessesList', 'languagesList',
        'spellsList', 'playState', 'inventory', 'money', 'advancementLog', 'creationFinalized',
        'ignoreEncumbrance', 'erschaffung', 'begleiter', 'relikte', 'regelIds',
      ];
      const safePayload: Partial<CharacterState> = {};
      for (const key of KNOWN_KEYS) {
        if (key in action.payload && action.payload[key] !== undefined) {
          (safePayload as Record<string, unknown>)[key] = action.payload[key];
        }
      }
      // Guarantee inventory and money are explicitly preserved
      if ('inventory' in action.payload) {
        safePayload.inventory = action.payload.inventory ?? [];
      }
      if ('money' in action.payload) {
        safePayload.money = action.payload.money ?? { solare: 0, lunare: 5, telare: 0 };
      }
      // Ein geladener Charakter ersetzt den bisherigen vollständig: fehlende Felder (Kultur-/Abstammungswahl,
      // Begleiter, Relikte, Regel-IDs) kommen aus dem Grundzustand, nicht vom vorher geöffneten Charakter.
      const basis: CharacterState = { ...DEFAULT_STATE, erschaffung: undefined, begleiter: undefined, relikte: undefined, regelIds: undefined } as CharacterState;
      const referenced = referenceCharacterResources({ ...basis, ...safePayload });
      return {
        ...basis,
        ...referenced,
        inventory: safePayload.inventory ?? referenced.inventory ?? [],
        money: safePayload.money ?? referenced.money ?? { solare: 0, lunare: 5, telare: 0 },
      };
    }

    case 'SET_MODE':
      return { ...state, mode: action.payload };

    case 'SET_CREATION_FINALIZED':
      return { ...state, creationFinalized: action.payload };

    case 'SET_XP_TOTAL': {
      const delta = action.payload - state.xpTotal;
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp' && delta !== 0) {
        const entry = createLogEntry(
          'xp',
          delta > 0 ? `+${delta} Gesamt-EP angepasst` : `${delta} Gesamt-EP angepasst`,
          `Gesamt-EP von ${state.xpTotal} auf ${action.payload} EP geändert`,
          delta,
        );
        newLog = [entry, ...newLog];
      }
      return { ...state, xpTotal: action.payload, advancementLog: newLog };
    }

    case 'ADD_XP_WITH_NOTE': {
      const { amount, note } = action.payload;
      const newTotal = state.xpTotal + amount;
      const entry = createLogEntry(
        'xp',
        `+${amount} EP erhalten`,
        note ? `${note} · Gesamt: ${newTotal} EP` : `Gesamt: ${newTotal} EP`,
        amount,
      );
      return {
        ...state,
        xpTotal: newTotal,
        advancementLog: [entry, ...(state.advancementLog ?? [])],
      };
    }

    case 'EDIT_XP_TOTAL_WITH_NOTE': {
      const { newTotal, note } = action.payload;
      const safeNewTotal = Math.max(0, newTotal);
      const delta = safeNewTotal - state.xpTotal;
      let newLog = state.advancementLog ?? [];
      if (delta !== 0 || note?.trim()) {
        const deltaFormatted = delta > 0 ? `+${delta}` : `${delta}`;
        const title = delta !== 0
          ? `Gesamt-EP korrigiert (${deltaFormatted} EP)`
          : 'Gesamt-EP Notiz';
        const detailParts: string[] = [];
        if (note?.trim()) {
          detailParts.push(note.trim());
        }
        detailParts.push(`Gesamt: ${state.xpTotal} → ${safeNewTotal} EP`);
        const entry = createLogEntry(
          'xp',
          title,
          detailParts.join(' · '),
          delta,
        );
        newLog = [entry, ...newLog];
      }
      return {
        ...state,
        xpTotal: safeNewTotal,
        advancementLog: newLog,
      };
    }

    case 'ADD_ADVANCEMENT_LOG':
      return {
        ...state,
        advancementLog: [action.payload, ...(state.advancementLog ?? [])],
      };

    case 'REMOVE_ADVANCEMENT_LOG_ENTRY':
      return {
        ...state,
        advancementLog: (state.advancementLog ?? []).filter((e) => e.id !== action.payload),
      };

    case 'CLEAR_ADVANCEMENT_LOG':
      return {
        ...state,
        advancementLog: [],
      };

    case 'SET_NAME':
      return { ...state, name: action.payload };

    case 'SET_RACE':
      return {
        ...state,
        race: action.payload.race,
        raceBonusAttrs: [],
        strengthsList: [
          ...action.payload.racialStrengths,
          ...action.payload.keptStrengths,
        ],
      };

    case 'SET_MOON_SIGN':
      return { ...state, moonSign: action.payload };

    case 'SET_HOME_REGION': {
      const newHomeRegion = action.payload;
      if (!newHomeRegion) {
        return { ...state, homeRegion: newHomeRegion };
      }
      const gratis = gratisStaerkeDerKultur();
      const regionStrengthName = `${gratis} (${newHomeRegion})`;
      // Einträge dieser Stärke aus früheren Heimatregionen (Quelle Erschaffung) entfernen
      const staerkenOhneAlteRegion = state.strengthsList.filter(
        (s) => !s.name.startsWith(gratis) || s.name === regionStrengthName || s.source !== 'creation',
      );
      const hatRegionSchon = state.strengthsList.some((s) => s.name === regionStrengthName);
      if (hatRegionSchon) {
        return { ...state, homeRegion: newHomeRegion, strengthsList: staerkenOhneAlteRegion };
      }
      const hrData = grwStaerken().find((sd) => sd.name === gratis);
      const gratisEintrag: ItemEntry = {
        name: regionStrengthName,
        level: 1,
        isFree: true,
        isRacial: false,
        source: 'creation',
        desc: hrData ? hrData.desc : 'Heimatregion',
        pointCost: 0,
        sourceRef: 'GRW',
        page: hrData?.page,
      };
      return { ...state, homeRegion: newHomeRegion, strengthsList: [...staerkenOhneAlteRegion, gratisEintrag] };
    }

    case 'MOD_ATTR_BASE': {
      const key = action.payload.key;
      const newVal = (state.attrBase[key] ?? 0) + action.payload.delta;
      return {
        ...state,
        attrBase: { ...state.attrBase, [key]: newVal },
      };
    }

    case 'TOGGLE_RACE_BONUS': {
      const attr = action.payload;
      const current = state.raceBonusAttrs;
      if (current.includes(attr)) {
        return { ...state, raceBonusAttrs: current.filter((a) => a !== attr) };
      }
      return { ...state, raceBonusAttrs: [...current, attr] };
    }

    case 'MOD_ATTR_XP': {
      const key = action.payload.key;
      const currentInc = state.attrIncrements[key] ?? 0;
      const isIncrease = action.payload.delta > 0;
      if (!isIncrease && currentInc <= 0) return state;
      const newInc = Math.max(0, currentInc + action.payload.delta);
      const cost = isIncrease ? getAttrXpCost(currentInc) : getAttrXpCost(newInc);
      const baseVal = state.attrBase[key] ?? 1;
      const raceBonus = state.raceBonusAttrs.includes(key) ? 1 : 0;
      const prevVal = baseVal + raceBonus + currentInc;
      const nextVal = baseVal + raceBonus + newInc;

      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp') {
        const entry = createLogEntry(
          'attr',
          isIncrease ? `Attribut gesteigert: ${key}` : `Attribut gesenkt: ${key}`,
          `${key} von ${prevVal} auf ${nextVal} ${isIncrease ? 'erhöht' : 'gesenkt'} (${newInc}. Steigerung)`,
          isIncrease ? -cost : cost,
        );
        newLog = [entry, ...newLog];
      }

      return {
        ...state,
        attrIncrements: { ...state.attrIncrements, [key]: newInc },
        advancementLog: newLog,
      };
    }

    case 'MOD_SKILL': {
      if (state.mode === 'creation') {
        const currentBase = state.skillsBase[action.payload.key] ?? 0;
        return {
          ...state,
          skillsBase: {
            ...state.skillsBase,
            [action.payload.key]: currentBase + action.payload.delta,
          },
        };
      } else {
        const key = action.payload.key;
        const delta = action.payload.delta;
        const currentXp = state.skillsXp[key] ?? 0;
        const isIncrease = delta > 0;
        if (!isIncrease && currentXp <= 0) return state;
        const newXp = Math.max(0, currentXp + delta);
        const baseVal = state.skillsBase[key] ?? 0;
        const prevTotal = baseVal + currentXp;
        const nextTotal = baseVal + newXp;
        const cost = isIncrease ? getSkillXpCost(nextTotal) : getSkillXpCost(prevTotal);

        const entry = createLogEntry(
          'skill',
          isIncrease ? `Fertigkeit gesteigert: ${key}` : `Fertigkeit gesenkt: ${key}`,
          `Wert von ${prevTotal} auf ${nextTotal} ${isIncrease ? 'erhöht' : 'gesenkt'} (${newXp} EP-Punkte)`,
          isIncrease ? -cost : cost,
        );

        return {
          ...state,
          skillsXp: {
            ...state.skillsXp,
            [key]: newXp,
          },
          advancementLog: [entry, ...(state.advancementLog ?? [])],
        };
      }
    }

    case 'SET_SKILLS_BASE':
      return { ...state, skillsBase: action.payload };

    case 'SET_SKILLS_XP':
      return { ...state, skillsXp: action.payload };

    case 'ADD_MASTERY': {
      const { skill, mastery } = action.payload;
      const current = state.masteries[skill] ?? [];
      const cost = mastery.isFree || mastery.isCreationBonus ? 0 : Number(mastery.cost) || calculateItemCost('mastery', mastery.tier);
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp') {
        const entry = createLogEntry(
          'mastery',
          `Meisterschaft gelernt: ${mastery.name}`,
          `Fertigkeit: ${skill} (Schwelle S${mastery.tier})${mastery.isFree ? ' · Frei' : ''}`,
          -cost,
        );
        newLog = [entry, ...newLog];
      }
      return {
        ...state,
        masteries: { ...state.masteries, [skill]: [...current, mastery] },
        advancementLog: newLog,
      };
    }

    case 'REMOVE_MASTERY_BY_ID': {
      const { skill, id } = action.payload;
      const current = state.masteries[skill] ?? [];
      const target = current.find((m) => m.id === id);
      const cost = target ? (target.isFree || target.isCreationBonus ? 0 : Number(target.cost) || calculateItemCost('mastery', target.tier)) : 0;
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp' && target) {
        const entry = createLogEntry(
          'mastery',
          `Meisterschaft entfernt: ${target.name}`,
          `Fertigkeit: ${skill} (Schwelle S${target.tier})`,
          cost,
        );
        newLog = [entry, ...newLog];
      }
      return {
        ...state,
        masteries: {
          ...state.masteries,
          [skill]: current.filter((m) => m.id !== id),
        },
        advancementLog: newLog,
      };
    }

    case 'REMOVE_MASTERY_BY_IDX': {
      const { skill, idx } = action.payload;
      const current = [...(state.masteries[skill] ?? [])];
      const target = current[idx];
      const cost = target ? (target.isFree || target.isCreationBonus ? 0 : Number(target.cost) || calculateItemCost('mastery', target.tier)) : 0;
      current.splice(idx, 1);
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp' && target) {
        const entry = createLogEntry(
          'mastery',
          `Meisterschaft entfernt: ${target.name}`,
          `Fertigkeit: ${skill}`,
          cost,
        );
        newLog = [entry, ...newLog];
      }
      return {
        ...state,
        masteries: { ...state.masteries, [skill]: current },
        advancementLog: newLog,
      };
    }

    case 'ADD_SPELL': {
      const spell = action.payload;
      const cost = spell.isFree
        ? 0
        : (spell.xpCost ?? (typeof spell.cost === 'number' ? spell.cost : calculateItemCost('spell', spell.grade)));
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp') {
        const entry = createLogEntry(
          'spell',
          `Zauber gelernt: ${spell.name}`,
          `Schule: ${spell.school || 'Magie'}, Grad ${spell.grade}${spell.isFree ? ' · Frei' : ''}`,
          -cost,
        );
        newLog = [entry, ...newLog];
      }
      return { ...state, spellsList: [...state.spellsList, spell], advancementLog: newLog };
    }

    case 'REMOVE_SPELL_BY_IDX': {
      const target = state.spellsList[action.payload];
      const cost = target
        ? (target.isFree
            ? 0
            : (target.xpCost ?? (typeof target.cost === 'number' ? target.cost : calculateItemCost('spell', target.grade))))
        : 0;
      const newList = [...state.spellsList];
      newList.splice(action.payload, 1);
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp' && target) {
        const entry = createLogEntry(
          'spell',
          `Zauber entfernt: ${target.name}`,
          `Schule: ${target.school || 'Magie'}, Grad ${target.grade}`,
          cost,
        );
        newLog = [entry, ...newLog];
      }
      return { ...state, spellsList: newList, advancementLog: newLog };
    }

    case 'ADD_STRENGTH': {
      const item = action.payload;
      const cost = item.isFree ? 0 : (item.level ?? 1) * (item.pointCost ?? 1) * calculateItemCost('strength', 1);
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp') {
        const entry = createLogEntry(
          'strength',
          `Stärke erworben: ${item.name}`,
          `Stufe ${item.level}${item.desc ? ` · ${item.desc}` : ''}`,
          -cost,
        );
        newLog = [entry, ...newLog];
      }
      return { ...state, strengthsList: [...state.strengthsList, item], advancementLog: newLog };
    }

    case 'REMOVE_STRENGTH': {
      const target = state.strengthsList[action.payload];
      const cost = target ? (target.isFree ? 0 : (target.level ?? 1) * (target.pointCost ?? 1) * calculateItemCost('strength', 1)) : 0;
      const newList = [...state.strengthsList];
      newList.splice(action.payload, 1);
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp' && target) {
        const entry = createLogEntry(
          'strength',
          `Stärke entfernt: ${target.name}`,
          `Stufe ${target.level}`,
          cost,
        );
        newLog = [entry, ...newLog];
      }
      return { ...state, strengthsList: newList, advancementLog: newLog };
    }

    case 'ADD_RESOURCE': {
      const item = action.payload;
      const cost = item.isFree ? 0 : (item.level ?? 1) * (item.pointCost ?? 1) * calculateItemCost('strength', 1);
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp') {
        const schonDa = state.resourcesList.some((r) => r.name === item.name) && !getResolvedResources().list.find((r) => r.name === item.name)?.mehrfach;
        const entry = createLogEntry(
          'resource',
          schonDa ? `Ressource gesteigert: ${item.name} +${item.level ?? 1}` : `Ressource erworben: ${item.name}`,
          `Stufe ${item.level}${item.desc ? ` · ${item.desc}` : ''}`,
          -cost,
        );
        newLog = [entry, ...newLog];
      }
      // Steigerung einer schon mit EP gekauften Ressource: Stufen zusammenführen statt zweitem Eintrag
      // (bei der Erschaffung genauso: ein Erschaffungseintrag je Ressource)
      // Mehrfach erwerbbare Ressourcen (Kreatur, Relikt, Zuflucht, Rang laut Paket) bleiben eigene Einträge.
      const mehrfach = !!getResolvedResources().list.find((r) => r.name === item.name)?.mehrfach;
      const vorhanden = mehrfach ? -1 : state.resourcesList.findIndex((r) => r.name === item.name && r.source === item.source && !r.isFree && !item.isFree);
      if (vorhanden >= 0) {
        const liste = [...state.resourcesList];
        const alt = liste[vorhanden];
        liste[vorhanden] = { ...alt, level: (alt.level ?? 1) + (item.level ?? 1) };
        return { ...state, resourcesList: liste, advancementLog: newLog };
      }
      return { ...state, resourcesList: [...state.resourcesList, item], advancementLog: newLog };
    }

    case 'RESOURCE_STEIGERN': {
      // eine vorhandene Ressource um Stufen erhöhen; nach der Erschaffung mit EP (bei Erschaffungs-Einträgen als xpStufen)
      const { index, stufen } = action.payload;
      const alt = state.resourcesList[index];
      if (!alt || stufen <= 0) return state;
      const liste = [...state.resourcesList];
      const mitEp = state.mode === 'xp';
      liste[index] = { ...alt, level: (Number(alt.level) || 0) + stufen,
        ...(mitEp && alt.source !== 'xp' ? { xpStufen: (alt.xpStufen ?? 0) + stufen } : {}) };
      let newLog = state.advancementLog ?? [];
      if (mitEp) {
        const cost = stufen * (alt.pointCost ?? 1) * calculateItemCost('strength', 1);
        newLog = [createLogEntry('resource', `Ressource gesteigert: ${alt.name}`, `Stufe ${alt.level} → ${liste[index].level}`, -cost), ...newLog];
      }
      return { ...state, resourcesList: liste, advancementLog: newLog };
    }

    case 'REMOVE_RESOURCE': {
      const target = state.resourcesList[action.payload];
      const cost = target ? (target.isFree ? 0 : (target.level ?? 1) * (target.pointCost ?? 1) * calculateItemCost('strength', 1)) : 0;
      const newList = [...state.resourcesList];
      newList.splice(action.payload, 1);
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp' && target) {
        const entry = createLogEntry(
          'resource',
          `Ressource entfernt: ${target.name}`,
          `Stufe ${target.level}`,
          cost,
        );
        newLog = [entry, ...newLog];
      }
      return { ...state, resourcesList: newList, advancementLog: newLog };
    }

    case 'ADD_WEAKNESS': {
      const item = action.payload;
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp') {
        const entry = createLogEntry(
          'weakness',
          `Schwäche hinzugefügt: ${item.name}`,
          item.desc ?? '',
          0,
        );
        newLog = [entry, ...newLog];
      }
      return { ...state, weaknessesList: [...state.weaknessesList, item], advancementLog: newLog };
    }

    case 'REMOVE_WEAKNESS': {
      const target = state.weaknessesList[action.payload];
      const newList = [...state.weaknessesList];
      newList.splice(action.payload, 1);
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp' && target) {
        const entry = createLogEntry(
          'weakness',
          `Schwäche entfernt: ${target.name}`,
          target.desc ?? '',
          0,
        );
        newLog = [entry, ...newLog];
      }
      return { ...state, weaknessesList: newList, advancementLog: newLog };
    }

    case 'ADD_LANGUAGE': {
      const item = action.payload;
      const cost = item.isFree ? 0 : 5;
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp') {
        const entry = createLogEntry(
          'language',
          `Sprache gelernt: ${item.name}`,
          `Stufe ${item.level}`,
          -cost,
        );
        newLog = [entry, ...newLog];
      }
      return { ...state, languagesList: [...state.languagesList, item], advancementLog: newLog };
    }

    case 'REMOVE_LANGUAGE': {
      const target = state.languagesList[action.payload];
      const cost = target ? (target.isFree ? 0 : 5) : 0;
      const newList = [...state.languagesList];
      newList.splice(action.payload, 1);
      let newLog = state.advancementLog ?? [];
      if (state.mode === 'xp' && target) {
        const entry = createLogEntry(
          'language',
          `Sprache entfernt: ${target.name}`,
          `Stufe ${target.level}`,
          cost,
        );
        newLog = [entry, ...newLog];
      }
      return { ...state, languagesList: newList, advancementLog: newLog };
    }

    case 'SET_LANGUAGES_LIST':
      return { ...state, languagesList: action.payload };

    case 'SET_STRENGTHS_LIST':
      return { ...state, strengthsList: action.payload };

    case 'PLAY_LP_ANPASSEN': {
      const ziel = lpKaestchen(Math.max(0, action.payload.maxLP));
      const alt = state.playState.healthSlots;
      if (!ziel || alt.length === ziel) return state;
      const schaden = normalizeHealthSlots(alt).filter((x) => x.type !== 'empty').slice(0, ziel);
      const slots: HealthSlot[] = [...schaden, ...Array.from({ length: ziel - schaden.length }, () => ({ type: 'empty' as const }))];
      return { ...state, playState: { ...state.playState, healthSlots: slots } };
    }

    case 'PLAY_RESET': {
      const { maxLP, maxFocus, maxSplitter } = action.payload;
      const slots: HealthSlot[] = Array.from({ length: lpKaestchen(maxLP) }, () => ({ type: 'empty' as const }));
      return {
        ...state,
        playState: {
          healthSlots: slots,
          focus: { exhausted: 0, channeled: 0, consumed: 0 },
          splitterPoints: maxSplitter,
          channeledSpells: [],
          dyingLevel: 0,
          conditions: [],
          tempHP: 0,
          tempHPUsed: 0,
          lpModifier: state.playState.lpModifier ?? 0,
        },
      };
    }

    case 'PLAY_TAKE_DAMAGE': {
      const { kind, maxLP: mLP } = action.payload;

      // Temp HP absorption: absorb damage with available temp HP first
      let remainingDamage = Math.max(1, action.payload.amount ?? 1);
      let nextTempHP = state.playState.tempHP ?? 0;
      let nextTempHPUsed = state.playState.tempHPUsed ?? 0;
      const availableTemp = Math.max(0, nextTempHP - nextTempHPUsed);

      let currentFocus = state.playState.focus;
      let currentChanneledSpells = state.playState.channeledSpells;

      if (availableTemp > 0) {
        const absorb = Math.min(availableTemp, remainingDamage);
        remainingDamage -= absorb;
        nextTempHPUsed += absorb;
        if (nextTempHPUsed >= nextTempHP) {
          nextTempHP = 0;
          nextTempHPUsed = 0;
          // Zauber, die laut Regelpaket enden, sobald ihre zusätzlichen Lebenspunkte aufgebraucht sind (z. B. Lebenskraft stärken)
          const katalog = aktiverKatalog();
          const autoEndIndex = currentChanneledSpells.findIndex(
            (s) => !!spielwerteDesZaubers(katalog, s.name)?.werte.some((x) => x.bezug === 'zusatz_lp' && x.endet_wenn_verbraucht)
          );
          if (autoEndIndex !== -1) {
            const endedSpell = currentChanneledSpells[autoEndIndex];
            currentChanneledSpells = currentChanneledSpells.filter((_, idx) => idx !== autoEndIndex);
            const freedFO = endedSpell.channeledFocus;
            currentFocus = {
              ...currentFocus,
              channeled: Math.max(0, currentFocus.channeled - freedFO),
              exhausted: currentFocus.exhausted + freedFO,
            };
          }
        }
      }

      if (remainingDamage <= 0) {
        return {
          ...state,
          playState: {
            ...state.playState,
            tempHP: nextTempHP,
            tempHPUsed: nextTempHPUsed,
            focus: currentFocus,
            channeledSpells: currentChanneledSpells,
          },
        };
      }

      let slots = [...state.playState.healthSlots];
      const count = remainingDamage;

      for (let step = 0; step < count; step++) {
        const filledCount = slots.filter((s) => s.type !== 'empty').length;
        if (filledCount >= slots.length) {
          // Overflow-Regel: letzten weichen Slot (exhausted oder channeled) in consumed umwandeln
          let overflowIdx = -1;
          for (let i = slots.length - 1; i >= 0; i--) {
            if (slots[i].type === 'exhausted' || slots[i].type === 'channeled') { overflowIdx = i; break; }
          }
          if (overflowIdx === -1) break;
          slots[overflowIdx] = { type: 'consumed' };
        } else {
          // Insert new damage into first empty slot
          const idx = slots.findIndex((s) => s.type === 'empty');
          if (idx !== -1) slots[idx] = { type: kind };
        }
        slots = normalizeHealthSlots(slots);
      }
      const newSlots = normalizeHealthSlots(slots);

      // Sterben nach dem Paket (Kernregel „Sterben“, GRW S. 172–173): Zustände beim ersten echten Punkt auf der letzten
      // Gesundheitsstufe, weitere (Bewusstlos, höhere Sterbe-Stufe), wenn dort alle LP verloren sind; darüber hinaus tot
      let newDyingLevel = state.playState.dyingLevel;
      let newConditions = state.playState.conditions;
      if (mLP && mLP > 0) {
        const st = sterbestand(newSlots, mLP);
        if (st.stufe > newDyingLevel) {
          newDyingLevel = st.stufe;
          for (const z of st.zustaende) {
            // ein Zustand je Name: höhere Stufe ersetzt die niedrigere (Sterbend 2 → Sterbend 3)
            const da = newConditions.find((c) => c.key === z.key);
            if (!da) newConditions = [...newConditions, { id: generateId(), key: z.key, ...(z.level ? { level: z.level } : {}) }];
            else if (z.level && (da.level ?? 0) < z.level) newConditions = newConditions.map((c) => (c === da ? { ...c, level: z.level } : c));
          }
          if (st.stufe === 4 && !newConditions.some((c) => c.key === 'Tod')) newConditions = [...newConditions, { id: generateId(), key: 'Tod' }];
        }
      }

      // Regel: Kein freier Slot mehr + channeled oder exhausted Schaden → automatisch Bewusstlos
      if ((kind === 'channeled' || kind === 'exhausted') && mLP && mLP > 0) {
        const remainingEmpty = newSlots.filter((s) => s.type === 'empty').length;
        const alreadyUnconscious = newConditions.some((c) => c.key === 'Bewusstlos');
        if (remainingEmpty === 0 && !alreadyUnconscious) {
          newConditions = [...newConditions, { id: generateId(), key: 'Bewusstlos' }];
        }
      }

      return {
        ...state,
        playState: {
          ...state.playState,
          healthSlots: newSlots,
          dyingLevel: newDyingLevel,
          conditions: newConditions,
          tempHP: nextTempHP,
          tempHPUsed: nextTempHPUsed,
          focus: currentFocus,
          channeledSpells: currentChanneledSpells,
        },
      };
    }

    case 'PLAY_KANALISIERT_FREIGEBEN': {
      let n = Math.max(0, action.payload.amount);
      const slots = [...state.playState.healthSlots];
      for (let i = slots.length - 1; i >= 0 && n > 0; i--) if (slots[i].type === 'channeled') { slots[i] = { type: 'exhausted' }; n--; }
      return { ...state, playState: { ...state.playState, healthSlots: normalizeHealthSlots(slots) } };
    }

    case 'PLAY_UNDO_DAMAGE': {
      const { kind, amount = 1, maxLP: mLP } = action.payload;
      let slots = [...state.playState.healthSlots];
      // amount 0: nur Protokolleintrag (Heilung schon verbucht), nichts heilen
      const count = Math.max(0, amount);
      for (let step = 0; step < count; step++) {
        if (kind === 'exhausted' || kind === 'channeled') {
          // Find the last slot from the back that matches this type and set it to empty
          let lastIdx = -1;
          for (let i = slots.length - 1; i >= 0; i--) {
            if (slots[i].type === kind) { lastIdx = i; break; }
          }
          if (lastIdx !== -1) slots[lastIdx] = { type: 'empty' };
        } else {
          // consumed: find last consumed slot, set to empty, then re-sort
          let lastIdx = -1;
          for (let i = slots.length - 1; i >= 0; i--) {
            if (slots[i].type === 'consumed') { lastIdx = i; break; }
          }
          if (lastIdx !== -1) slots[lastIdx] = { type: 'empty' };
        }
        slots = normalizeHealthSlots(slots);
      }

      let newDyingLevel = state.playState.dyingLevel;
      let newConditions = state.playState.conditions ?? [];

      if (mLP && mLP > 0) {
        // Schaden zurückgenommen: Sterbe-Stand neu aus der Leiste; Sterbe-Zustände oberhalb des neuen Stands entfallen
        const st = sterbestand(slots, mLP);
        newDyingLevel = st.stufe;
        const r = sterberegeln();
        const sterbeZustaende = [...(r?.beiErstemSchaden ?? []), ...(r?.beiAllenLp ?? [])].filter((z) => z.level);
        if (newDyingLevel < 4) newConditions = newConditions.filter((c) => c.key !== 'Tod');
        // höhere Sterbe-Stufe zurück auf die zum neuen Stand passende, ohne Stand ganz weg
        newConditions = newConditions.flatMap((c) => {
          if (!sterbeZustaende.some((z) => z.key === c.key && z.level === c.level && z.level! > newDyingLevel)) return [c];
          const passend = sterbeZustaende.filter((z) => z.key === c.key && z.level! <= newDyingLevel).map((z) => z.level!).sort((x, y) => y - x)[0];
          return passend ? [{ ...c, level: passend }] : [];
        });
      }

      return {
        ...state,
        playState: {
          ...state.playState,
          healthSlots: slots,
          dyingLevel: newDyingLevel,
          conditions: newConditions,
        },
      };
    }

    case 'PLAY_HEAL_EXHAUSTED': {
      const payload = action.payload;
      const healAllStun = payload?.healAllStun ?? true;
      const stunAmount = payload?.stunAmount ?? 0;
      const healAllExhaustedFocus = payload?.healAllExhaustedFocus ?? true;
      const exhaustedFocusAmount = payload?.exhaustedFocusAmount ?? 0;
      const exhaustReduction = payload?.exhaustReduction !== undefined ? payload.exhaustReduction : 1;
      const removeConditions = payload?.removeConditions ?? true;

      // 1. Betäubungsschaden (GRW S. 173–174); kanalisierter Schaden bleibt, bis sein Zustand aufgehoben ist (S. 173).
      //    Ein Zustand mit keine_natuerliche_heilung (Paket) verhindert jede Heilung von Lebenspunkten durch die Pause.
      const heilungGesperrt = ohneNatuerlicheHeilung(state.playState.conditions ?? []).length > 0;
      let healedSlots = [...state.playState.healthSlots];
      if (heilungGesperrt) {
        // keine Lebenspunkte
      } else if (healAllStun) {
        healedSlots = normalizeHealthSlots(healedSlots.map((s) =>
          s.type === 'exhausted' ? { type: 'empty' as const } : s,
        ));
      } else if (stunAmount > 0) {
        let remaining = stunAmount;
        for (let i = healedSlots.length - 1; i >= 0 && remaining > 0; i--) {
          if (healedSlots[i].type === 'exhausted') {
            healedSlots[i] = { type: 'empty' };
            remaining--;
          }
        }
        healedSlots = normalizeHealthSlots(healedSlots);
      }

      // 2. Focus
      const currentFocus = state.playState.focus;
      let newExhausted = 0;
      let newChanneled = currentFocus.channeled;
      let newChanneledSpells = state.playState.channeledSpells;

      // erschöpfter Fokus; kanalisierte Zauber laufen weiter (sie enden erst in der Ruhephase, GRW S. 196)
      if (healAllExhaustedFocus) {
        newExhausted = 0;
      } else if (exhaustedFocusAmount > 0) {
        newExhausted = Math.max(0, currentFocus.exhausted - exhaustedFocusAmount);
      } else {
        newExhausted = currentFocus.exhausted;
      }

      // 3. Zustände, die laut Paket mit einer Verschnaufpause enden oder abgebaut werden (pause_ende)
      const currentConditions = state.playState.conditions ?? [];
      const newConditions = nachPause(currentConditions, 'verschnaufpause', undefined, exhaustReduction, removeConditions);

      return {
        ...state,
        playState: {
          ...state.playState,
          healthSlots: healedSlots,
          focus: { ...currentFocus, exhausted: newExhausted, channeled: newChanneled },
          channeledSpells: newChanneledSpells,
          conditions: newConditions,
        },
      };
    }

    case 'PLAY_REST_HEAL': {
      const { konAmount, wilAmount, lpHealAmount, foHealAmount } = action.payload;
      // Ein Zustand mit keine_natuerliche_heilung (Paket, z. B. Sterbend) verhindert die Heilung von Lebenspunkten;
      // dann bleiben Schaden und Sterbe-Stufe, Fokus und Zustände werden trotzdem behandelt.
      const heilungGesperrt = ohneNatuerlicheHeilung(state.playState.conditions ?? []).length > 0;
      // Step 1: Betäubungsschaden komplett heilen; kanalisierter Schaden bleibt (GRW S. 173)
      const slots = state.playState.healthSlots.map((s) =>
        s.type === 'exhausted' && !heilungGesperrt ? { type: 'empty' as const } : s,
      );
      // Step 2: Collect indices of remaining consumed slots (they are at the front after step 1)
      const consumedIndices: number[] = [];
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].type === 'consumed') consumedIndices.push(i);
      }
      // Heal the last lpHealAmount (or konAmount*2) consumed slots (from the right / back)
      const healAmount = lpHealAmount !== undefined ? lpHealAmount : Math.max(1, konAmount * 2);
      const toHeal = heilungGesperrt ? 0 : Math.min(healAmount, consumedIndices.length);
      for (let j = consumedIndices.length - 1; j >= consumedIndices.length - toHeal; j--) {
        slots[consumedIndices[j]] = { type: 'empty' };
      }
      // Step 3: Re-sort using normalizeHealthSlots (consumed vorne, dann empty)
      const finalSlots = normalizeHealthSlots(slots);
      // Step 4: Fokus: allen erschöpften regenerieren, verzehrten um foHealAmount (bzw. WIL × 2). Kanalisierter Fokus
      // regeneriert auch in der Ruhephase nicht, kanalisierte Zauber laufen weiter (GRW S. 195–196)
      const focusHeal = foHealAmount !== undefined ? foHealAmount : Math.max(1, wilAmount * 2);
      const newConsumedFocus = Math.max(0, state.playState.focus.consumed - focusHeal);
      // Step 5: Zustände nach der Ruhephase laut Paket (pause_ende)
      const newConditions = nachPause(state.playState.conditions ?? [], 'ruhephase');
      return {
        ...state,
        playState: {
          ...state.playState,
          healthSlots: finalSlots,
          focus: { ...state.playState.focus, exhausted: 0, consumed: newConsumedFocus },
          conditions: newConditions,
          dyingLevel: heilungGesperrt ? state.playState.dyingLevel : 0,
          ruhephasenTag: (state.playState.ruhephasenTag ?? 0) + 1,
        },
      };
    }

    case 'PLAY_NEUER_TAG':
      return { ...state, playState: { ...state.playState, ruhephasenTag: 0 } };

    case 'PLAY_SET_DYING_LEVEL': {
      const newLevel = action.payload;
      let newConditions = state.playState.conditions;
      if (newLevel > state.playState.dyingLevel && (newLevel === 2 || newLevel === 3)) {
        const alreadyPresent = newConditions.some((c) => c.key === 'Sterbend' && c.level === newLevel);
        if (!alreadyPresent) {
          newConditions = [...newConditions, { id: generateId(), key: 'Sterbend', level: newLevel }];
        }
      }
      if (newLevel === 4 && state.playState.dyingLevel < 4) {
        const alreadyPresent = newConditions.some((c) => c.key === 'Tod');
        if (!alreadyPresent) {
          newConditions = [...newConditions, { id: generateId(), key: 'Tod' }];
        }
      }
      return { ...state, playState: { ...state.playState, dyingLevel: newLevel, conditions: newConditions } };
    }

    case 'PLAY_DIVINE_MERCY': {
      const { maxLP: mLP } = action.payload;
      const slots = [...state.playState.healthSlots];
      // Reset Tod-Stufe slots (index mLP*5 to mLP*6-1) to empty
      for (let i = mLP * 5; i < mLP * 6 && i < slots.length; i++) {
        slots[i] = { type: 'empty' };
      }
      const newConditions = state.playState.conditions.filter(
        (c) => c.key !== 'Tod' && c.key !== 'Sterbend',
      );
      return {
        ...state,
        playState: {
          ...state.playState,
          healthSlots: slots,
          dyingLevel: 0,
          conditions: newConditions,
        },
      };
    }

    case 'PLAY_SPEND_FOCUS': {
      const { kind, amount } = action.payload;
      const f = state.playState.focus;
      return {
        ...state,
        playState: {
          ...state.playState,
          focus: { ...f, [kind]: Math.max(0, f[kind] + amount) },
        },
      };
    }

    case 'PLAY_ADD_CHANNELED_SPELL': {
      return {
        ...state,
        playState: {
          ...state.playState,
          channeledSpells: [...state.playState.channeledSpells, action.payload],
        },
      };
    }

    case 'PLAY_UPDATE_CHANNELED_SPELL': {
      const { id, update } = action.payload;
      const updatedList = state.playState.channeledSpells.map((s) =>
        s.id === id ? { ...s, ...update } : s
      );
      return {
        ...state,
        playState: {
          ...state.playState,
          channeledSpells: updatedList,
        },
      };
    }

    case 'PLAY_CAST_SPELL': {
      const { exhaustedFocus = 0, channeledFocus = 0, consumedFocus = 0, channeledSpell } = action.payload;
      const f = state.playState.focus;
      const newExhausted = Math.max(0, f.exhausted + exhaustedFocus);
      const newChanneled = Math.max(0, f.channeled + channeledFocus);
      const newConsumed = Math.max(0, f.consumed + consumedFocus);

      let newChanneledSpells = state.playState.channeledSpells;
      if (channeledSpell && (channeledFocus > 0 || channeledSpell.channeledFocus > 0)) {
        newChanneledSpells = [...newChanneledSpells, channeledSpell];
      }

      return {
        ...state,
        playState: {
          ...state.playState,
          focus: {
            exhausted: newExhausted,
            channeled: newChanneled,
            consumed: newConsumed,
          },
          channeledSpells: newChanneledSpells,
        },
      };
    }

    case 'PLAY_CANCEL_CHANNELED_SPELL': {
      const spell = state.playState.channeledSpells.find((s) => s.id === action.payload.id);
      if (!spell) return state;
      const remaining = state.playState.channeledSpells.filter((s) => s.id !== action.payload.id);
      const f = state.playState.focus;
      const newChanneled = Math.max(0, f.channeled - spell.channeledFocus);
      const newExhausted = f.exhausted + spell.channeledFocus;
      return {
        ...state,
        playState: {
          ...state.playState,
          channeledSpells: remaining,
          focus: { ...f, channeled: newChanneled, exhausted: newExhausted },
        },
      };
    }

    case 'PLAY_SET_SPLITTER': {
      return {
        ...state,
        playState: { ...state.playState, splitterPoints: Math.max(0, action.payload) },
      };
    }

    case 'PLAY_ADD_CONDITION': {
      const currentConditions = state.playState.conditions ?? [];
      const { key, level } = action.payload;

      if ((istZustand(key) && !zustandHatStufe(key))) {
        // Stufenlose Zustände dürfen nur einmal vorkommen
        if (currentConditions.some((c) => c.key === key)) {
          return state;
        }
      } else if (zustandHatStufe(key) && key !== 'Sterbend') {
        // Stufenbehaftete Zustände (außer Sterbend): vorhandene Stufe um 1 erhöhen statt neu hinzufügen
        const existingIdx = currentConditions.findIndex((c) => c.key === key);
        if (existingIdx !== -1) {
          const updated = currentConditions.map((c, i) =>
            i === existingIdx ? { ...c, level: (c.level ?? 1) + 1 } : c
          );
          return { ...state, playState: { ...state.playState, conditions: updated } };
        }
      } else {
        // Sterbend (manuell) und sonstige: Duplikat-Check auf key + level
        if (currentConditions.some((c) => c.key === key && c.level === level)) {
          return state;
        }
      }

      return {
        ...state,
        playState: {
          ...state.playState,
          conditions: [...currentConditions, action.payload],
        },
      };
    }

    case 'PLAY_REMOVE_CONDITION': {
      return {
        ...state,
        playState: {
          ...state.playState,
          conditions: (state.playState.conditions ?? []).filter((c) => c.id !== action.payload.id),
        },
      };
    }

    case 'PLAY_ADD_TEMP_HP': {
      const current = state.playState.tempHP ?? 0;
      const used = state.playState.tempHPUsed ?? 0;
      const added = Math.max(0, action.payload.amount);
      return {
        ...state,
        playState: {
          ...state.playState,
          tempHP: current + added,
          // Keep existing used count – the new slots appear as fresh (unused) at the end
          tempHPUsed: used,
        },
      };
    }

    case 'PLAY_REMOVE_TEMP_HP': {
      const newTempHP = Math.max(0, (state.playState.tempHP ?? 0) - action.payload.amount);
      const newTempHPUsed = Math.min(state.playState.tempHPUsed ?? 0, newTempHP);
      return {
        ...state,
        playState: {
          ...state.playState,
          tempHP: newTempHP,
          tempHPUsed: newTempHPUsed,
        },
      };
    }

    case 'PLAY_SET_LP_MODIFIER': {
      const newModifier = action.payload.modifier;
      const newMaxLP = action.payload.newMaxLP;
      const targetSlotCount = newMaxLP * 6;
      const currentSlots = [...state.playState.healthSlots];

      let adjustedSlots: HealthSlot[];
      if (targetSlotCount > currentSlots.length) {
        const toAdd = targetSlotCount - currentSlots.length;
        adjustedSlots = [...currentSlots, ...Array.from({ length: toAdd }, () => ({ type: 'empty' as const }))];
      } else if (targetSlotCount < currentSlots.length) {
        adjustedSlots = [...currentSlots];
        while (adjustedSlots.length > targetSlotCount) {
          if (adjustedSlots[adjustedSlots.length - 1].type === 'empty') {
            adjustedSlots.pop();
          } else {
            break;
          }
        }
      } else {
        adjustedSlots = currentSlots;
      }

      return {
        ...state,
        playState: { ...state.playState, lpModifier: newModifier, healthSlots: normalizeHealthSlots(adjustedSlots) },
      };
    }

    case 'PLAY_SET_STATE':
      return {
        ...state,
        playState: action.payload,
      };

    case 'ADD_INVENTORY_ITEM': {
      const currentInv = state.inventory ?? [];
      return {
        ...state,
        inventory: [...currentInv, action.payload],
      };
    }

    case 'REMOVE_INVENTORY_ITEM': {
      const currentInv = state.inventory ?? [];
      return {
        ...state,
        inventory: currentInv.filter((it) => it.id !== action.payload.id),
      };
    }

    case 'UPDATE_INVENTORY_ITEM': {
      const currentInv = state.inventory ?? [];
      return {
        ...state,
        inventory: currentInv.map((it) =>
          it.id === action.payload.id ? { ...it, ...action.payload.updates } : it
        ),
      };
    }

    case 'TOGGLE_EQUIP_ITEM': {
      const currentInv = state.inventory ?? [];
      return {
        ...state,
        inventory: currentInv.map((it) =>
          it.id === action.payload.id ? { ...it, equipped: !it.equipped } : it
        ),
      };
    }

    case 'SET_MONEY': {
      const curMoney = state.money ?? { solare: 0, lunare: 5, telare: 0 };
      return {
        ...state,
        money: { ...curMoney, ...action.payload },
      };
    }

    case 'SET_IGNORE_ENCUMBRANCE': {
      return {
        ...state,
        ignoreEncumbrance: action.payload,
      };
    }

    // ---- Begleiter ----
    case 'BEGLEITER_HINZU':
      return { ...state, begleiter: [...(state.begleiter ?? []), action.payload] };
    case 'REGEL_NAMEN_ABGLEICHEN':
      return { ...state, ...action.payload };
    case 'BEGLEITER_ENTFERNEN':
      return { ...state, begleiter: (state.begleiter ?? []).filter((_, i) => i !== action.payload.index) };
    case 'BEGLEITER_AENDERN':
      return { ...state, begleiter: (state.begleiter ?? []).map((b, i) => (i === action.payload.index ? { ...b, ...action.payload.aenderung } : b)) };

    case 'BEGLEITER_ZUSTAENDE_SETZEN':
      return { ...state, begleiter: (state.begleiter ?? []).map((b, i) => { const n = action.payload.find((x) => x.index === i); return n ? { ...b, zustand: n.zustand } : b; }) };

    // ---- Relikte: Relikt speichern und Inventareintrag anlegen bzw. aktualisieren ----
    case 'RELIKT_SPEICHERN': {
      const { relikt, inventar } = action.payload;
      const liste = state.relikte ?? [];
      const relikte = liste.some(r => r.id === relikt.id) ? liste.map(r => (r.id === relikt.id ? relikt : r)) : [...liste, relikt];
      const inv = state.inventory ?? [];
      const inventory = inv.some(it => it.id === inventar.id) ? inv.map(it => (it.id === inventar.id ? { ...it, ...inventar } : it)) : [...inv, inventar];
      return { ...state, relikte, inventory };
    }
    case 'RELIKT_LOESCHEN': {
      const r = (state.relikte ?? []).find(x => x.id === action.payload.id);
      return {
        ...state,
        relikte: (state.relikte ?? []).filter(x => x.id !== action.payload.id),
        inventory: r ? (state.inventory ?? []).filter(it => it.id !== r.inventarId) : state.inventory,
      };
    }

    // ---- Erschaffung nach Regelwerk: Kultur- und Abstammungsmodule (GRW S. 23–24) ----
    case 'ERSCHAFFUNG_MODUL_SETZEN': {
      const alt = state.erschaffung?.[action.payload.art];
      if (alt?.angewendet) return state; // erst austragen, dann ändern
      return { ...state, erschaffung: { ...(state.erschaffung ?? {}), [action.payload.art]: action.payload.modul } };
    }

    case 'ERSCHAFFUNG_MODUL_EINTRAGEN': {
      const { art, werte, beschreibungen } = action.payload;
      const modul = state.erschaffung?.[art];
      if (!modul || modul.angewendet || state.mode !== 'creation') return state;
      const skillsBase = { ...state.skillsBase };
      for (const [n, p] of Object.entries(werte.fertigkeiten)) skillsBase[n] = (skillsBase[n] ?? 0) + p;
      let resourcesList = [...state.resourcesList];
      for (const [n, p] of Object.entries(werte.ressourcen)) {
        const i = resourcesList.findIndex((r) => r.name === n && r.source === 'creation');
        if (i >= 0) resourcesList[i] = { ...resourcesList[i], level: (Number(resourcesList[i].level) || 0) + p };
        else resourcesList = [...resourcesList, { name: n, level: p, source: 'creation', pointCost: 1, desc: beschreibungen?.[n] }];
      }
      let strengthsList = state.strengthsList;
      if (werte.staerke && !strengthsList.some((s) => s.name === werte.staerke!.name && !s.isRacial)) {
        strengthsList = [...strengthsList, { name: werte.staerke.name, level: 1, pointCost: werte.staerke.stufe, source: 'creation', desc: beschreibungen?.[werte.staerke.name] }];
      }
      let masteries = state.masteries;
      if (werte.meisterschaft) {
        const { skill, name } = werte.meisterschaft;
        const liste = masteries[skill] ?? [];
        if (!liste.some((m) => m.name === name)) {
          const m: Mastery = { id: generateId(), name, tier: 1, cost: 0, isFree: false, isCreationBonus: true, source: 'Erschaffung', skill, desc: beschreibungen?.[name] };
          masteries = { ...masteries, [skill]: [...liste, m] };
        }
      }
      return { ...state, skillsBase, resourcesList, strengthsList, masteries,
        erschaffung: { ...(state.erschaffung ?? {}), [art]: { ...modul, angewendet: werte } } };
    }

    case 'ERSCHAFFUNG_MODUL_AUSTRAGEN': {
      const { art } = action.payload;
      const modul = state.erschaffung?.[art];
      const werte = modul?.angewendet;
      if (!modul || !werte || state.mode !== 'creation') return state;
      const skillsBase = { ...state.skillsBase };
      for (const [n, p] of Object.entries(werte.fertigkeiten)) skillsBase[n] = Math.max(0, (skillsBase[n] ?? 0) - p);
      const resourcesList = state.resourcesList
        .map((r) => (r.source === 'creation' && werte.ressourcen[r.name] ? { ...r, level: (Number(r.level) || 0) - werte.ressourcen[r.name] } : r))
        .filter((r) => (Number(r.level) || 0) > 0);
      let strengthsList = state.strengthsList;
      if (werte.staerke) {
        const i = strengthsList.findIndex((s) => s.name === werte.staerke!.name && !s.isRacial && s.source === 'creation');
        if (i >= 0) strengthsList = strengthsList.filter((_, j) => j !== i);
      }
      let masteries = state.masteries;
      if (werte.meisterschaft) {
        const { skill, name } = werte.meisterschaft;
        masteries = { ...masteries, [skill]: (masteries[skill] ?? []).filter((m) => !(m.name === name && m.isCreationBonus)) };
      }
      const { angewendet: _a, ...ohne } = modul; void _a;
      return { ...state, skillsBase, resourcesList, strengthsList, masteries, erschaffung: { ...(state.erschaffung ?? {}), [art]: ohne } };
    }

    default:
      return state;
  }
}

function characterReducer(
  state: CharacterState,
  action: CharacterAction,
): CharacterState {
  if (action.type === 'UNDO_LAST_ADVANCEMENT') {
    if (!state.advancementHistory || state.advancementHistory.length === 0) {
      return state;
    }
    const [previousState, ...remainingHistory] = state.advancementHistory;
    return {
      ...previousState,
      advancementHistory: remainingHistory,
    };
  }

  const newState = baseCharacterReducer(state, action);

  if (state.mode === 'xp' && ADVANCEMENT_ACTION_TYPES.has(action.type) && newState !== state) {
    const { advancementHistory: _h, ...stateSnapshot } = state;
    const history = state.advancementHistory ?? [];
    return {
      ...newState,
      advancementHistory: [stateSnapshot as CharacterState, ...history].slice(0, 50),
    };
  }

  return newState;
}

// ---------------------------------------------------------------
// Hydrate state from localStorage
// ---------------------------------------------------------------

function hydrateState(): CharacterState {
  const saved = loadFromLocalStorage();
  if (!saved) return DEFAULT_STATE;
  const raw: CharacterState = {
    mode: (saved.mode as AppMode) ?? DEFAULT_STATE.mode,
    xpTotal: (saved.xpTotal as number) ?? DEFAULT_STATE.xpTotal,
    name: (saved.name as string) ?? DEFAULT_STATE.name,
    race: (saved.race as string) ?? DEFAULT_STATE.race,
    moonSign: (saved.moonSign as string) ?? DEFAULT_STATE.moonSign,
    homeRegion: (saved.homeRegion as string) ?? DEFAULT_STATE.homeRegion,
    attrBase: (saved.attrBase as AttrMap) ?? DEFAULT_STATE.attrBase,
    raceBonusAttrs: (saved.raceBonusAttrs as string[]) ?? DEFAULT_STATE.raceBonusAttrs,
    attrIncrements: (saved.attrIncrements as AttrMap) ?? DEFAULT_STATE.attrIncrements,
    skillsBase: (saved.skillsBase as Record<string, number>) ?? DEFAULT_STATE.skillsBase,
    skillsXp: (saved.skillsXp as Record<string, number>) ?? DEFAULT_STATE.skillsXp,
    masteries: (saved.masteries as Record<string, Mastery[]>) ?? DEFAULT_STATE.masteries,
    strengthsList: (saved.strengthsList as ItemEntry[]) ?? DEFAULT_STATE.strengthsList,
    resourcesList: (saved.resourcesList as ItemEntry[]) ?? DEFAULT_STATE.resourcesList,
    weaknessesList: (saved.weaknessesList as ItemEntry[]) ?? DEFAULT_STATE.weaknessesList,
    languagesList: (saved.languagesList as ItemEntry[]) ?? DEFAULT_STATE.languagesList,
    spellsList: (saved.spellsList as Spell[]) ?? DEFAULT_STATE.spellsList,
    playState: {
      ...((saved.playState as PlayState) ?? DEFAULT_STATE.playState),
      dyingLevel: (saved.playState as PlayState)?.dyingLevel ?? 0,
      conditions: ((saved.playState as PlayState)?.conditions as StatusCondition[]) ?? [],
      tempHP: (saved.playState as PlayState)?.tempHP ?? 0,
      tempHPUsed: (saved.playState as PlayState)?.tempHPUsed ?? 0,
      lpModifier: (saved.playState as PlayState)?.lpModifier ?? 0,
    },
    inventory: (saved.inventory as any) ?? DEFAULT_STATE.inventory ?? [],
    money: (saved.money as any) ?? DEFAULT_STATE.money ?? { solare: 0, lunare: 5, telare: 0 },
    advancementLog: ((saved.advancementLog as AdvancementLogEntry[]) ?? []),
    creationFinalized: (saved.creationFinalized as boolean) ?? false,
    ignoreEncumbrance: (saved.ignoreEncumbrance as boolean) ?? false,
    // Claude-Edition: Erschaffung nach Regelwerk, Begleiter und Regel-IDs gingen beim Neuladen verloren
    ...(saved.erschaffung ? { erschaffung: saved.erschaffung as CharacterState['erschaffung'] } : {}),
    ...(Array.isArray(saved.begleiter) ? { begleiter: saved.begleiter as CharacterState['begleiter'] } : {}),
    ...(Array.isArray(saved.relikte) ? { relikte: saved.relikte as CharacterState['relikte'] } : {}),
    ...(saved.regelIds && typeof saved.regelIds === 'object' ? { regelIds: saved.regelIds as CharacterState['regelIds'] } : {}),
  };
  return referenceCharacterResources(raw);
}

// ---------------------------------------------------------------
// Custom hook
// ---------------------------------------------------------------

export function useCharacterState() {
  const [state, dispatch] = useReducer(characterReducer, undefined, hydrateState);

  // Persist to localStorage on every state change
  useEffect(() => {
    const { advancementHistory: _h, ...stateToSave } = state;
    saveToLocalStorage(mitRegelIds(stateToSave) as unknown as Record<string, unknown>);
  }, [state]);

  // Initialize automatic languages if empty
  useEffect(() => {
    if (state.languagesList.length === 0) {
      dispatch({
        type: 'SET_LANGUAGES_LIST',
        payload: [
          {
            name: 'Basargnomisch',
            level: 1,
            source: 'creation',
            desc: 'Handelssprache',
            pointCost: 0,
            isFree: true,
            sourceRef: 'Automatisch',
          },
        ],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, dispatch };
}

