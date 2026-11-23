import type {
  CharacterState,
  AttrMap,
  ItemEntry,
  Mastery,
  Spell,
  PlayState,
  AppMode,
  AdvancementLogEntry,
  InventoryItem,
  Money,
  ChanneledSpell,
  Begleiter,
} from '../types';
import { generateId } from './id';

const VALID_MODES: AppMode[] = ['creation', 'xp', 'play', 'combat', 'inventory', 'begleiter'];

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function validateAttrMap(v: unknown): AttrMap | undefined {
  if (!isRecord(v)) return undefined;
  const keys: (keyof AttrMap)[] = ['AUS', 'BEW', 'INT', 'KON', 'MYS', 'STA', 'VER', 'WIL'];
  const result: Partial<AttrMap> = {};
  for (const k of keys) {
    const val = v[k];
    result[k] = isNumber(val) ? Math.round(val) : 1;
  }
  return result as AttrMap;
}

function validateNumberRecord(v: unknown): Record<string, number> | undefined {
  if (!isRecord(v)) return undefined;
  const result: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    if (isString(k) && isNumber(val)) {
      result[k] = val;
    }
  }
  return result;
}

function validateItemEntry(v: unknown): ItemEntry | null {
  if (!isRecord(v)) return null;
  if (!isString(v.name)) return null;
  return {
    name: v.name,
    level: isNumber(v.level) ? v.level : 1,
    source: isString(v.source) ? v.source : 'unknown',
    desc: isString(v.desc) ? v.desc : undefined,
    pointCost: isNumber(v.pointCost) ? v.pointCost : undefined,
    isFree: typeof v.isFree === 'boolean' ? v.isFree : undefined,
    sourceRef: isString(v.sourceRef) ? v.sourceRef : undefined,
    page: isNumber(v.page) ? v.page : undefined,
    isRacial: typeof v.isRacial === 'boolean' ? v.isRacial : undefined,
    onlyCreation: typeof v.onlyCreation === 'boolean' ? v.onlyCreation : undefined,
  };
}

function validateItemEntries(v: unknown): ItemEntry[] | undefined {
  if (!isArray(v)) return undefined;
  if (v.length === 0) return [];
  const result: ItemEntry[] = [];
  for (const item of v) {
    const entry = validateItemEntry(item);
    if (!entry) {
      // If any entry in the list is corrupted/invalid, reject the list to avoid silent data loss
      return undefined;
    }
    result.push(entry);
  }
  return result;
}

function validateMastery(v: unknown): Mastery | null {
  if (!isRecord(v)) return null;
  if (!isString(v.id) || !isString(v.name)) return null;
  return {
    id: v.id,
    name: v.name,
    tier: isNumber(v.tier) ? v.tier : 1,
    cost: isNumber(v.cost) ? v.cost : 0,
    isFree: typeof v.isFree === 'boolean' ? v.isFree : false,
    isCreationBonus: typeof v.isCreationBonus === 'boolean' ? v.isCreationBonus : false,
    source: isString(v.source) ? v.source : 'unknown',
    page: isNumber(v.page) ? v.page : undefined,
    desc: isString(v.desc) ? v.desc : undefined,
    skill: isString(v.skill) ? v.skill : undefined,
    userNote: isString(v.userNote) ? v.userNote : undefined,
  };
}

function validateMasteries(v: unknown): Record<string, Mastery[]> | undefined {
  if (!isRecord(v)) return undefined;
  const result: Record<string, Mastery[]> = {};
  for (const [skill, arr] of Object.entries(v)) {
    if (!isString(skill) || !isArray(arr)) return undefined;
    const validatedList: Mastery[] = [];
    for (const item of arr) {
      const m = validateMastery(item);
      if (!m) return undefined;
      validatedList.push(m);
    }
    result[skill] = validatedList;
  }
  return result;
}

function validateSpell(v: unknown): Spell | null {
  if (!isRecord(v)) return null;
  if (!isString(v.name) || !isString(v.school)) return null;
  return {
    name: v.name,
    school: v.school,
    grade: isNumber(v.grade) ? v.grade : 1,
    cost: isNumber(v.cost) ? v.cost : isString(v.cost) ? v.cost : 0,
    castTime: isString(v.castTime) ? v.castTime : undefined,
    range: isString(v.range) ? v.range : undefined,
    duration: isString(v.duration) ? v.duration : undefined,
    target: isString(v.target) ? v.target : undefined,
    description: isString(v.description) ? v.description : undefined,
    page: isNumber(v.page) ? v.page : undefined,
    isFree: typeof v.isFree === 'boolean' ? v.isFree : undefined,
    source: isString(v.source) ? v.source : undefined,
  };
}

function validateSpells(v: unknown): Spell[] | undefined {
  if (!isArray(v)) return undefined;
  if (v.length === 0) return [];
  const result: Spell[] = [];
  for (const item of v) {
    const s = validateSpell(item);
    if (!s) return undefined;
    result.push(s);
  }
  return result;
}

const VALID_LOG_CATEGORIES: AdvancementLogEntry['category'][] = [
  'xp', 'attr', 'skill', 'mastery', 'spell', 'strength', 'resource', 'language', 'weakness', 'note'
];

function validateAdvancementLogEntry(v: unknown): AdvancementLogEntry | null {
  if (!isRecord(v)) return null;
  if (!isString(v.id) || !isString(v.timestamp) || !isString(v.title)) return null;
  const category = (isString(v.category) && VALID_LOG_CATEGORIES.includes(v.category as AdvancementLogEntry['category']))
    ? (v.category as AdvancementLogEntry['category'])
    : 'note';
  return {
    id: v.id,
    timestamp: v.timestamp,
    category,
    title: v.title,
    detail: isString(v.detail) ? v.detail : undefined,
    xpDelta: isNumber(v.xpDelta) ? v.xpDelta : undefined,
  };
}

function validateAdvancementLog(v: unknown): AdvancementLogEntry[] | undefined {
  if (!isArray(v)) return undefined;
  if (v.length === 0) return [];
  const result: AdvancementLogEntry[] = [];
  for (const item of v) {
    const entry = validateAdvancementLogEntry(item);
    if (!entry) return undefined;
    result.push(entry);
  }
  return result;
}

function validatePlayState(v: unknown): PlayState | undefined {
  if (!isRecord(v)) return undefined;
  const focus = isRecord(v.focus)
    ? {
        exhausted: isNumber(v.focus.exhausted) ? v.focus.exhausted : 0,
        channeled: isNumber(v.focus.channeled) ? v.focus.channeled : 0,
        consumed: isNumber(v.focus.consumed) ? v.focus.consumed : 0,
      }
    : { exhausted: 0, channeled: 0, consumed: 0 };

  const healthSlots = isArray(v.healthSlots)
    ? v.healthSlots
        .filter(isRecord)
        .filter((s) => ['empty', 'exhausted', 'consumed', 'channeled'].includes(s.type as string))
        .map((s) => ({ type: s.type as 'empty' | 'exhausted' | 'consumed' | 'channeled' }))
    : [];

  const channeledSpells: ChanneledSpell[] = isArray(v.channeledSpells)
    ? v.channeledSpells
        .filter(isRecord)
        .filter((s) => isString(s.id) && isString(s.name) && isNumber(s.channeledFocus))
        .map((s) => ({
          id: s.id as string,
          name: s.name as string,
          channeledFocus: s.channeledFocus as number,
          school: isString(s.school) ? s.school : undefined,
          grade: isNumber(s.grade) ? s.grade : undefined,
          castTime: isString(s.castTime) ? s.castTime : undefined,
          duration: isString(s.duration) ? s.duration : undefined,
          range: isString(s.range) ? s.range : undefined,
          target: isString(s.target) ? s.target : undefined,
          enhancements: isArray(s.enhancements) && s.enhancements.every(isString) ? s.enhancements as string[] : undefined,
          notes: isString(s.notes) ? s.notes : undefined,
          activeRounds: isNumber(s.activeRounds) ? s.activeRounds : undefined,
          activeTicks: isNumber(s.activeTicks) ? s.activeTicks : undefined,
          startedAt: isString(s.startedAt) ? s.startedAt : undefined,
        }))
    : [];

  const dyingLevel = [0, 2, 3, 4].includes(v.dyingLevel as number) ? (v.dyingLevel as 0 | 2 | 3 | 4) : 0;

  const conditions = isArray(v.conditions)
    ? v.conditions
        .filter(isRecord)
        .filter((c) => isString(c.id) && isString(c.key))
        .map((c) => ({
          id: c.id as string,
          key: c.key as string,
          level: isNumber(c.level) ? c.level : undefined,
          note: isString(c.note) ? c.note : undefined,
        }))
    : [];

  return {
    healthSlots,
    focus,
    splitterPoints: isNumber(v.splitterPoints) ? v.splitterPoints : 3,
    channeledSpells,
    dyingLevel,
    conditions,
    tempHP: isNumber(v.tempHP) ? v.tempHP : 0,
    tempHPUsed: isNumber(v.tempHPUsed) ? v.tempHPUsed : 0,
    lpModifier: isNumber(v.lpModifier) ? v.lpModifier : 0,
  };
}

const VALID_ITEM_TYPES: InventoryItem['type'][] = ['weapon', 'armor', 'shield', 'gear', 'alchemika', 'other'];

function validateInventoryItem(v: unknown): InventoryItem | null {
  if (!isRecord(v)) return null;
  const rawName = (isString(v.name) && v.name.trim()) ||
    (isString(v.title) && v.title.trim()) ||
    (isString(v.bezeichnung) && v.bezeichnung.trim()) ||
    (isString(v.label) && v.label.trim());
  if (!rawName) return null;

  // Determine item type, supporting common German synonyms
  let rawType: InventoryItem['type'] = 'gear';
  const typeCandidate = (isString(v.type) ? v.type.toLowerCase().trim() : '') ||
    (isString(v.kategorie) ? v.kategorie.toLowerCase().trim() : '');

  if (VALID_ITEM_TYPES.includes(typeCandidate as InventoryItem['type'])) {
    rawType = typeCandidate as InventoryItem['type'];
  } else if (['waffe', 'nahkampf', 'fernkampf', 'nahkampfwaffe', 'fernkampfwaffe', 'meleeweapon', 'rangedweapon'].includes(typeCandidate)) {
    rawType = 'weapon';
  } else if (['rüstung', 'ruestung', 'panzer', 'bodyarmor'].includes(typeCandidate)) {
    rawType = 'armor';
  } else if (['schild', 'buckler', 'parrierwaffe'].includes(typeCandidate)) {
    rawType = 'shield';
  } else if (['alchemie', 'alchemika', 'trank', 'elixier', 'gift', 'alchemical'].includes(typeCandidate)) {
    rawType = 'alchemika';
  } else if (['ausrüstung', 'ausruestung', 'gegenstand', 'ausruestungsgegenstand', 'gear'].includes(typeCandidate)) {
    rawType = 'gear';
  } else if (typeCandidate === 'other' || typeCandidate === 'sonstiges') {
    rawType = 'other';
  }

  // Quantity
  const rawQty = v.quantity ?? v.anzahl ?? v.count;
  const quantity = isNumber(rawQty)
    ? Math.max(1, Math.round(rawQty))
    : isString(rawQty) && !isNaN(parseInt(rawQty, 10))
      ? Math.max(1, parseInt(rawQty, 10))
      : 1;

  // Weight / Last
  const rawWeight = v.weight ?? v.last ?? v.load ?? v.gewicht;
  const weight = isNumber(rawWeight)
    ? Math.max(0, rawWeight)
    : isString(rawWeight) && !isNaN(parseFloat(rawWeight))
      ? Math.max(0, parseFloat(rawWeight))
      : undefined;

  // Price
  const rawPrice = v.price ?? v.preis ?? v.kosten;
  const price = isString(rawPrice) && rawPrice.trim()
    ? rawPrice.trim()
    : isNumber(rawPrice)
      ? `${rawPrice} L`
      : undefined;

  // Description
  const rawDesc = v.desc ?? v.description ?? v.beschreibung ?? v.text;
  const desc = isString(rawDesc) && rawDesc.trim() ? rawDesc.trim() : undefined;

  // Category
  const rawCat = v.category ?? v.kategorie ?? v.unterkategorie;
  const category = isString(rawCat) && rawCat.trim() ? rawCat.trim() : undefined;

  // Equipped
  const rawEquipped = v.equipped ?? v.ausgerüstet ?? v.ausgeruestet ?? v.angelegt ?? v.isEquipped;
  const equipped = typeof rawEquipped === 'boolean'
    ? rawEquipped
    : rawEquipped === 'true' || rawEquipped === 1 || rawEquipped === '1';

  // Source & Page
  const rawSource = v.source ?? v.quelle ?? v.sourceRef;
  const source = isString(rawSource) && rawSource.trim() ? rawSource.trim() : undefined;

  const rawPage = v.page ?? v.seite;
  const page = isNumber(rawPage)
    ? Math.max(1, Math.round(rawPage))
    : isString(rawPage) && !isNaN(parseInt(rawPage.replace(/\D/g, ''), 10))
      ? parseInt(rawPage.replace(/\D/g, ''), 10)
      : undefined;

  // Weapon specifics
  const rawSkill = v.weaponSkill ?? v.fertigkeit ?? v.skill;
  const weaponSkill = isString(rawSkill) && rawSkill.trim() ? rawSkill.trim() : undefined;

  const rawDmg = v.damage ?? v.schaden;
  const damage = isString(rawDmg) && rawDmg.trim() ? rawDmg.trim() : undefined;

  const rawWgs = v.wgs ?? v.geschwindigkeit;
  const wgs = isNumber(rawWgs) ? rawWgs : isString(rawWgs) && rawWgs.trim() ? rawWgs.trim() : undefined;

  const rawRange = v.range ?? v.reichweite;
  const range = isString(rawRange) && rawRange.trim() ? rawRange.trim() : undefined;

  const rawAttr = v.attributes ?? v.merkmale ?? v.eigenschaften;
  const attributes = isString(rawAttr) && rawAttr.trim() ? rawAttr.trim() : undefined;

  // Armor & Shield specifics
  const parseNumField = (val: unknown): number | undefined => {
    if (isNumber(val)) return val;
    if (isString(val) && !isNaN(parseInt(val, 10))) return parseInt(val, 10);
    return undefined;
  };

  const vtdBonus = parseNumField(v.vtdBonus ?? v.vtd ?? v.verteidigung);
  const sr = parseNumField(v.sr ?? v.rs ?? v.schadensreduktion);
  const handicap = parseNumField(v.handicap ?? v.behinderung ?? v.be);
  const tickModifier = parseNumField(v.tickModifier ?? v.tickMalus ?? v.tick);
  const minStrength = parseNumField(v.minStrength ?? v.mindeststaerke ?? v.minSTA);
  const hardness = parseNumField(v.hardness ?? v.haerte);

  return {
    id: isString(v.id) && v.id.trim() ? v.id : generateId(),
    name: rawName,
    type: rawType,
    category,
    quantity,
    weight,
    price,
    desc,
    equipped,
    source,
    page,
    weaponSkill,
    damage,
    wgs,
    range,
    attributes,
    vtdBonus,
    sr,
    handicap,
    tickModifier,
    minStrength,
    hardness,
  };
}

function validateInventory(v: unknown): InventoryItem[] | undefined {
  if (!isArray(v)) return undefined;
  if (v.length === 0) return [];
  const result: InventoryItem[] = [];
  for (const item of v) {
    const it = validateInventoryItem(item);
    if (it) {
      result.push(it);
    }
  }
  return result;
}

function validateMoney(v: unknown): Money | undefined {
  if (!isRecord(v)) return undefined;
  const parseCoin = (val: unknown): number => {
    if (isNumber(val)) return Math.max(0, Math.round(val));
    if (isString(val) && !isNaN(parseInt(val, 10))) return Math.max(0, parseInt(val, 10));
    return 0;
  };
  const solare = parseCoin(v.solare ?? v.gold ?? v.S ?? v.Solare);
  const lunare = parseCoin(v.lunare ?? v.silber ?? v.L ?? v.Lunare);
  const telare = parseCoin(v.telare ?? v.kupfer ?? v.T ?? v.Telare);
  return { solare, lunare, telare };
}

/**
 * Validates an unknown JSON import and returns a Partial<CharacterState>.
 * Invalid fields are filtered out rather than blindly accepted.
 * Throws if the data is completely invalid (missing all identifying fields).
 */
export function validateCharacterImport(data: unknown): Partial<CharacterState> {
  if (!isRecord(data)) {
    throw new Error('Importdaten sind kein gültiges Objekt.');
  }

  const hasIdentifier = isString(data.name) || isString(data.race) || isRecord(data.attrBase);
  if (!hasIdentifier) {
    throw new Error('Ungültiges Dateiformat: Kein Name, Rasse oder Attribute gefunden.');
  }

  const result: Partial<CharacterState> = {};

  if (isString(data.mode) && VALID_MODES.includes(data.mode as AppMode)) {
    result.mode = data.mode as AppMode;
  }
  if (isNumber(data.xpTotal) && data.xpTotal >= 0) {
    result.xpTotal = Math.round(data.xpTotal);
  }
  if (isString(data.name)) result.name = data.name;
  if (isString(data.race)) result.race = data.race;
  if (isString(data.moonSign)) result.moonSign = data.moonSign;
  if (isString(data.homeRegion)) result.homeRegion = data.homeRegion;

  const attrBase = validateAttrMap(data.attrBase);
  if (attrBase) result.attrBase = attrBase;

  if (isArray(data.raceBonusAttrs) && data.raceBonusAttrs.every(isString)) {
    result.raceBonusAttrs = data.raceBonusAttrs as string[];
  }

  const attrIncrements = validateAttrMap(data.attrIncrements);
  if (attrIncrements) result.attrIncrements = attrIncrements;

  const skillsBase = validateNumberRecord(data.skillsBase);
  if (skillsBase) result.skillsBase = skillsBase;

  const skillsXp = validateNumberRecord(data.skillsXp);
  if (skillsXp) result.skillsXp = skillsXp;

  if (data.masteries !== undefined) {
    const masteries = validateMasteries(data.masteries);
    if (masteries !== undefined) result.masteries = masteries;
  }
  if (data.strengthsList !== undefined) {
    const strengthsList = validateItemEntries(data.strengthsList);
    if (strengthsList !== undefined) result.strengthsList = strengthsList;
  }
  if (data.resourcesList !== undefined) {
    const resourcesList = validateItemEntries(data.resourcesList);
    if (resourcesList !== undefined) result.resourcesList = resourcesList;
  }
  if (data.weaknessesList !== undefined) {
    const weaknessesList = validateItemEntries(data.weaknessesList);
    if (weaknessesList !== undefined) result.weaknessesList = weaknessesList;
  }
  if (data.languagesList !== undefined) {
    const languagesList = validateItemEntries(data.languagesList);
    if (languagesList !== undefined) result.languagesList = languagesList;
  }
  if (data.spellsList !== undefined) {
    const spellsList = validateSpells(data.spellsList);
    if (spellsList !== undefined) result.spellsList = spellsList;
  }
  if (data.advancementLog !== undefined) {
    const advancementLog = validateAdvancementLog(data.advancementLog);
    if (advancementLog !== undefined) result.advancementLog = advancementLog;
  }

  const playState = validatePlayState(data.playState);
  if (playState) result.playState = playState;

  // Support inventory and common German / English aliases
  const rawInventory = data.inventory ?? data.inventar ?? data.items ?? data.equipment ?? data.ausruestung;
  if (rawInventory !== undefined) {
    const inventory = validateInventory(rawInventory);
    if (inventory !== undefined) result.inventory = inventory;
  }

  // Support money and common German / English aliases
  const rawMoney = data.money ?? data.geld ?? data.currency;
  if (rawMoney !== undefined) {
    const money = validateMoney(rawMoney);
    if (money !== undefined) result.money = money;
  }

  if (typeof data.ignoreEncumbrance === 'boolean') {
    result.ignoreEncumbrance = data.ignoreEncumbrance;
  }

  // Erschaffung nach Regelwerk (Claude-Edition): gewählte Module mit Katalog-IDs
  if (data.erschaffung && typeof data.erschaffung === 'object' && !Array.isArray(data.erschaffung)) {
    const e: Record<string, unknown> = {};
    for (const art of ['kultur', 'abstammung'] as const) {
      const m = (data.erschaffung as Record<string, unknown>)[art] as Record<string, unknown> | null | undefined;
      if (m && typeof m === 'object' && typeof m.modul === 'string') e[art] = m;
    }
    if (Object.keys(e).length) result.erschaffung = e as CharacterState['erschaffung'];
  }
  const texte = (l: unknown) => (l as unknown[]).filter((a): a is string => typeof a === 'string');
  const kulturWahl = (w: Record<string, unknown>): NonNullable<Begleiter['kulturWahl']> => ({
    ...(w.fertigkeiten && typeof w.fertigkeiten === 'object' && !Array.isArray(w.fertigkeiten)
      ? { fertigkeiten: Object.fromEntries(Object.entries(w.fertigkeiten as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) as Record<string, string> } : {}),
    ...(typeof w.staerke === 'string' ? { staerke: w.staerke } : {}),
    ...(typeof w.meisterschaft === 'number' ? { meisterschaft: w.meisterschaft } : {}),
  });
  const zahlen = (o: unknown) => (o && typeof o === 'object' && !Array.isArray(o)
    ? Object.fromEntries(Object.entries(o as Record<string, unknown>).filter(([, v]) => typeof v === 'number' && v > 0)) as Record<string, number> : undefined);
  const steigerung = (w: Record<string, unknown>): NonNullable<Begleiter['steigerung']> => ({
    ...(zahlen(w.attribute) ? { attribute: zahlen(w.attribute) } : {}),
    ...(zahlen(w.fertigkeiten) ? { fertigkeiten: zahlen(w.fertigkeiten) } : {}),
  });
  const zustand = (z: Record<string, unknown>): NonNullable<Begleiter['zustand']> => ({
    ...(zahlen({ schaden: z.schaden, betaeubung: z.betaeubung, kanalisiert: z.kanalisiert }) ?? {}),
    ...(zahlen(z.fokus) && Object.keys(zahlen(z.fokus)!).length ? { fokus: zahlen(z.fokus) } : {}),
    ...(Array.isArray(z.zustaende) ? { zustaende: (z.zustaende as Record<string, unknown>[]).filter(c => c && typeof c.key === 'string')
      .map(c => ({ id: typeof c.id === 'string' ? c.id : String(c.key), key: String(c.key), ...(typeof c.level === 'number' ? { level: c.level } : {}), ...(typeof c.note === 'string' ? { note: c.note } : {}) })) } : {}),
  });
  if (Array.isArray(data.begleiter)) {
    const b = (data.begleiter as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as Record<string, unknown>).id === 'string'
      && ['tier', 'wesen', 'gefolge', 'golem', 'untoter'].includes(String((x as Record<string, unknown>).art)))
      .map((x) => ({
        id: String(x.id), art: x.art as Begleiter['art'], name: String(x.name ?? x.id),
        ...(typeof x.notiz === 'string' ? { notiz: x.notiz } : {}),
        ...(typeof x.rufname === 'string' ? { rufname: x.rufname } : {}),
        ...(typeof x.kreatur === 'number' && x.kreatur >= 0 ? { kreatur: x.kreatur } : {}),
        ...(typeof x.qualitaet === 'number' && x.qualitaet >= 1 ? { qualitaet: x.qualitaet } : {}),
        ...(x.vertrauter === true ? { vertrauter: true } : {}),
        ...(Array.isArray(x.abrichtungen) ? { abrichtungen: texte(x.abrichtungen) } : {}),
        ...(x.abrichtungWahlen && typeof x.abrichtungWahlen === 'object' && !Array.isArray(x.abrichtungWahlen) ? { abrichtungWahlen: Object.fromEntries(Object.entries(x.abrichtungWahlen as Record<string, unknown>)
          .flatMap(([kk, v]): [string, string | string[]][] => typeof v === 'string' ? [[kk, v]] : Array.isArray(v) ? [[kk, texte(v)]] : [])) } : {}),
        ...(Array.isArray(x.verbesserteAngriffe) ? { verbesserteAngriffe: texte(x.verbesserteAngriffe) } : {}),
        ...(typeof x.aufgabe === 'string' ? { aufgabe: x.aufgabe } : {}),
        ...(typeof x.rasse === 'string' ? { rasse: x.rasse } : {}),
        ...(Array.isArray(x.attributFrei) ? { attributFrei: texte(x.attributFrei) } : {}),
        ...(Array.isArray(x.schwellen) ? { schwellen: texte(x.schwellen) } : {}),
        ...(Array.isArray(x.meisterschaften) ? { meisterschaften: texte(x.meisterschaften) } : {}),
        ...(Array.isArray(x.zauber) ? { zauber: texte(x.zauber) } : {}),
        ...(Array.isArray(x.waffen) ? { waffen: texte(x.waffen) } : {}),
        ...(Array.isArray(x.dienste) ? { dienste: texte(x.dienste) } : {}),
        ...(typeof x.basisdienst === 'string' ? { basisdienst: x.basisdienst } : {}),
        ...(typeof x.material === 'string' ? { material: x.material } : {}),
        ...(Array.isArray(x.bausteine) ? { bausteine: texte(x.bausteine) } : {}),
        ...(Array.isArray(x.sonderausstattung) ? { sonderausstattung: texte(x.sonderausstattung) } : {}),
        ...(x.golemRessource === true ? { golemRessource: true } : {}),
        ...(x.feinschliff && typeof x.feinschliff === 'object' && !Array.isArray(x.feinschliff) ? { feinschliff: Object.fromEntries(Object.entries(x.feinschliff as Record<string, unknown>)
          .flatMap(([kk, v]): [string, string | Record<string, number>][] => typeof v === 'string' ? [[kk, v]] : zahlen(v) ? [[kk, zahlen(v)!]] : [])) } : {}),
        ...(typeof x.erhebung === 'string' ? { erhebung: x.erhebung } : {}),
        ...(typeof x.verstaerkungen === 'number' && x.verstaerkungen >= 0 ? { verstaerkungen: Math.floor(x.verstaerkungen) } : {}),
        ...(typeof x.abnormitaet === 'string' ? { abnormitaet: x.abnormitaet } : {}),
        ...(x.steigerung && typeof x.steigerung === 'object' && !Array.isArray(x.steigerung) ? { steigerung: steigerung(x.steigerung as Record<string, unknown>) } : {}),
        ...(x.zustand && typeof x.zustand === 'object' && !Array.isArray(x.zustand) ? { zustand: zustand(x.zustand as Record<string, unknown>) } : {}),
        ...(x.kulturWahl && typeof x.kulturWahl === 'object' && !Array.isArray(x.kulturWahl) ? { kulturWahl: kulturWahl(x.kulturWahl as Record<string, unknown>) } : {}),
      }));
    if (b.length) result.begleiter = b;
  }
  if (Array.isArray(data.relikte)) {
    const r = (data.relikte as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object'
      && typeof (x as Record<string, unknown>).id === 'string' && typeof (x as Record<string, unknown>).inventarId === 'string'
      && Array.isArray((x as Record<string, unknown>).bausteine))
      .map((x) => ({
        id: String(x.id), name: String(x.name ?? 'Relikt'), punkte: Number(x.punkte) || 0, art: String(x.art ?? 'gegenstand'),
        ...(typeof x.basisId === 'string' ? { basisId: x.basisId } : {}), ...(typeof x.basisName === 'string' ? { basisName: x.basisName } : {}),
        ...(typeof x.notiz === 'string' ? { notiz: x.notiz } : {}), inventarId: String(x.inventarId),
        bausteine: (x.bausteine as unknown[]).filter((b): b is Record<string, unknown> => !!b && typeof b === 'object' && typeof (b as Record<string, unknown>).id === 'string')
          .map(b => ({ id: String(b.id), anzahl: Number(b.anzahl) || 1,
            ...(typeof b.name === 'string' ? { name: b.name } : {}), ...(typeof b.grad === 'number' ? { grad: b.grad } : {}),
            ...(typeof b.stufe === 'number' ? { stufe: b.stufe } : {}), ...(typeof b.auswahl === 'string' ? { auswahl: b.auswahl } : {}) })),
      }));
    if (r.length) result.relikte = r;
  }

  // Regel-IDs (Claude-Edition): nur Zuordnungen Text → Text übernehmen
  if (data.regelIds && typeof data.regelIds === 'object' && !Array.isArray(data.regelIds)) {
    const r = data.regelIds as Record<string, unknown>;
    const map = (x: unknown) => Object.fromEntries(Object.entries((x && typeof x === 'object' && !Array.isArray(x)) ? x as Record<string, unknown> : {})
      .filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    result.regelIds = { version: 1, pakete: map(r.pakete), ...(typeof r.rasse === 'string' ? { rasse: r.rasse } : {}),
      staerken: map(r.staerken), schwaechen: map(r.schwaechen), ressourcen: map(r.ressourcen), meisterschaften: map(r.meisterschaften), zauber: map(r.zauber) };
  }

  if (typeof data.schwaechenHg === 'number' && Number.isFinite(data.schwaechenHg)) result.schwaechenHg = data.schwaechenHg;

  if (typeof data.creationFinalized === 'boolean') {
    result.creationFinalized = data.creationFinalized;
  } else if (
    (result.inventory && result.inventory.length > 0) ||
    result.mode === 'play' ||
    result.mode === 'combat' ||
    result.mode === 'inventory' ||
    result.mode === 'begleiter' ||
    (typeof data.xpTotal === 'number' && data.xpTotal > 15)
  ) {
    // If the imported character has items, play mode, or spent XP, ensure creation is finalized
    // so they aren't forced back to creation mode locking their inventory
    result.creationFinalized = true;
  }

  return result;
}
