import type { RegelIds } from '../regelwerk/ids';
// ============================================================
// Race trait types
// ============================================================

export interface RaceTrait {
  id: string;
  label: string;
  modifiers: Partial<Record<'strengthPoints' | 'resourcePoints' | 'splinterPoints', number>>;
}

export interface RaceData {
  gk: number;
  mods: Partial<Record<string, number>>;
  freeMods: number;
  strengths: string[];
  traits: RaceTrait[];
}

// ============================================================
// Character entity types
// ============================================================

export interface Mastery {
  id: string;
  name: string;
  tier: number;
  cost: number;
  isFree: boolean;
  isCreationBonus: boolean;
  source: string;
  page?: number;
  desc?: string;
  skill?: string;
  userNote?: string; // Freitext-Notiz des Benutzers
}

export interface Spell {
  name: string;
  school: string;
  grade: number;
  /** Focus cost string from DB (e.g. "1", "K1", "4V1", "5V2") or number for backwards-compatibility */
  cost: string | number;
  /** EP cost when learned in XP mode */
  xpCost?: number;
  castTime?: string;
  range?: string;
  duration?: string;
  target?: string;
  description?: string;
  page?: number;
  isFree?: boolean;
  source?: string;
  sourceMode?: AppMode;
  difficulty?: string;
  difficultyType?: 'fest' | 'VTD' | 'GW' | 'KW';
  difficultyValue?: number;
  /** Probe auf diese Fertigkeit statt auf die Magieschule (Zauberverankerung eines Relikts: Arkane Kunde, GRW S. 255) */
  probeFertigkeit?: string;
  /** Name des Relikts, aus dem der Zauber ausgelöst wird */
  ausRelikt?: string;
}

export interface ItemEntry {
  name: string;
  level: number;
  source: string;
  desc?: string;
  pointCost?: number;
  isFree?: boolean;
  sourceRef?: string;
  page?: number;
  isRacial?: boolean;
  onlyCreation?: boolean;
  /** Ressource: mit EP gekaufte Stufen auf einem Eintrag aus der Erschaffung (in `level` enthalten) */
  xpStufen?: number;
}

// ============================================================
// Play Mode types
// ============================================================

export interface HealthSlot {
  type: 'empty' | 'exhausted' | 'consumed' | 'channeled';
}

export interface FocusState {
  exhausted: number;
  channeled: number;
  consumed: number;
}

export interface ChanneledSpell {
  id: string;
  name: string;
  channeledFocus: number;
  school?: string;
  grade?: number;
  castTime?: string;
  duration?: string;
  range?: string;
  target?: string;
  targetItemId?: string;      // ID of enchanted equipment item (e.g. Katar)
  targetItemName?: string;    // Name of enchanted equipment item
  enhancements?: string[];
  selectedEnhancementIds?: string[];
  notes?: string;
  activeRounds?: number;
  activeTicks?: number;
  startedAt?: string;
}

export interface StatusCondition {
  id: string;
  key: string;
  level?: number;
  note?: string;
}

export interface PlayState {
  healthSlots: HealthSlot[];
  focus: FocusState;
  splitterPoints: number;
  channeledSpells: ChanneledSpell[];
  dyingLevel: 0 | 2 | 3 | 4; // 0 = kein Sterbend, 2 = Sterbend 2 (Wunden), 3 = Sterbend 3 (Wunden), 4 = Tod
  conditions: StatusCondition[];
  tempHP: number;      // Total temporary HP granted
  tempHPUsed: number;  // How many temp HP have been consumed by damage
  lpModifier: number;  // Manual LP modifier (added to maxLP alongside Robust bonus)
  /** Ruhephasen seit dem letzten „Neuer Tag“ (Höchstzahl aus dem Paket: ruheregeln.ruhephase.je_tag) */
  ruhephasenTag?: number;
}

// ============================================================
// Character state (full)
// ============================================================

export type AppMode = 'creation' | 'xp' | 'play' | 'combat' | 'inventory' | 'begleiter';

export interface InventoryItem {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'shield' | 'gear' | 'alchemika' | 'other';
  category?: string;
  quantity: number;
  weight?: number; // Last (Weight)
  price?: string;
  desc?: string;
  equipped?: boolean;
  source?: string;      // e.g. "GRW", "Mondstahlklingen", "Eigen"
  page?: number;        // e.g. 183
  // Weapon-specific properties
  weaponSkill?: string; // e.g. "Klingenwaffen"
  damage?: string;      // e.g. "1W6+4"
  wgs?: number | string;// e.g. 8
  range?: string;       // e.g. "20m"
  attributes?: string;  // e.g. "Scharf 2, Wuchtig"
  // Armor / Shield-specific properties
  vtdBonus?: number;    // e.g. +2
  sr?: number;          // e.g. 2
  handicap?: number;    // Behinderung, e.g. 1
  tickModifier?: number;// e.g. 1
  minStrength?: number; // e.g. 3
  /** Härte (GRW: Bruchfestigkeit von Gegenständen; bei Relikten mit den Änderungen der Bausteine) */
  hardness?: number;
}

export interface Money {
  solare: number;  // S (Gold, 1 S = 100 L)
  lunare: number;  // L (Silber, 1 L = 100 T)
  telare: number;  // T (Kupfer, 1 T)
}

export interface AttrMap {
  AUS: number;
  BEW: number;
  INT: number;
  KON: number;
  MYS: number;
  STA: number;
  VER: number;
  WIL: number;
}

export interface AdvancementLogEntry {
  id: string;
  timestamp: string;
  category: 'xp' | 'attr' | 'skill' | 'mastery' | 'spell' | 'strength' | 'resource' | 'language' | 'weakness' | 'note';
  title: string;
  detail?: string;
  xpDelta?: number; // e.g. +15 for XP added, -7 for skill increased, etc.
}

export interface CharacterState {
  /** Heldengrad, auf dem zuletzt eine Schwäche abgelegt wurde (GRW S. 83–84, 88: einmal je neuem Heldengrad) */
  schwaechenHg?: number;
  mode: AppMode;
  xpTotal: number;
  name: string;
  race: string;
  moonSign: string;
  homeRegion: string;
  attrBase: AttrMap;
  raceBonusAttrs: string[];
  attrIncrements: AttrMap;
  skillsBase: Record<string, number>;
  skillsXp: Record<string, number>;
  masteries: Record<string, Mastery[]>;
  strengthsList: ItemEntry[];
  resourcesList: ItemEntry[];
  weaknessesList: ItemEntry[];
  languagesList: ItemEntry[];
  spellsList: Spell[];
  playState: PlayState;
  inventory?: InventoryItem[];
  money?: Money;
  advancementLog?: AdvancementLogEntry[];
  advancementHistory?: CharacterState[];
  creationFinalized?: boolean;
  ignoreEncumbrance?: boolean;
  /** Erschaffung nach Regelwerk: gewählte Kultur- und Abstammungsmodule (Katalog-IDs) und was davon eingetragen wurde */
  erschaffung?: ErschaffungsWahl;
  /** Begleiter mit Katalog-ID (Tiergefährte über die Ressource Kreatur, beschworenes Wesen) */
  begleiter?: Begleiter[];
  /** Relikte (Ressource Relikt): Baukasten aus den Regelpaketen, je Relikt ein Inventareintrag */
  relikte?: Relikt[];
  /** Claude-Edition: Regel-IDs zu den gespeicherten Namen (siehe src/regelwerk/ids.ts) */
  regelIds?: RegelIds;
}

export interface Begleiter {
  /** Tier/Wesen: Katalog-ID des Wertekastens; Gefolge: Katalog-ID der Kultur */
  id: string; art: 'tier' | 'wesen' | 'gefolge' | 'golem' | 'untoter'; name: string; notiz?: string;
  /** eigener Name des Tieres bzw. Wesens */
  rufname?: string;
  /** Punkte der Ressource Kreatur für dieses Tier (0/fehlt = ohne Ressource, z. B. gekauft) */
  kreatur?: number;
  /** Grundpotenzial nach Qualität (gekaufte Tiere, Bestienmeister S. 15); fehlt = 1 */
  qualitaet?: number;
  /** Stärke Tiervertrauter auf dieses Tier */
  vertrauter?: boolean;
  /** Abrichtungen (Katalog-IDs, in Reihenfolge; Wiederholung = mehrfach gewählt) */
  abrichtungen?: string[];
  // ---- Gefolge (Ressource Gefolge, GRW S. 77–78)
  /** Aufgabe, z. B. Leibdiener, Knappe, Leibwächter */
  aufgabe?: string;
  /** Katalog-ID der Rasse */
  rasse?: string;
  /** freie Attributboni der Rasse (volle Attributnamen, je Platz) */
  attributFrei?: string[];
  /** Wahl im Kulturmodul (wie bei der Erschaffung) */
  kulturWahl?: { fertigkeiten?: Record<string, string>; staerke?: string; meisterschaft?: number };
  /** Fertigkeiten (IDs), die auf die erste Meisterschaftsschwelle angehoben sind (je 1 Punkt) */
  schwellen?: string[];
  /** zusätzliche Meisterschaften (IDs) */
  meisterschaften?: string[];
  /** Zauber (IDs) */
  zauber?: string[];
  /** Wesen-Baukasten: gewählte Dienste (IDs) und der Basisdienst */
  dienste?: string[];
  basisdienst?: string;
  /** Waffen des Gefolgsmanns (Katalog-IDs) */
  waffen?: string[];
  // ---- Golem (Die Magie S. 197–207); id = Korpus
  /** Golemmaterial (Katalog-ID) */
  material?: string;
  /** Wesen-Baukasten: Käufe mit Punkten Verbesserter Angriff („set:3“, „stumpf“, „waffe:<ID>“; Die Magie S. 196–197) */
  verbesserteAngriffe?: string[];
  /** Wahlen der Abrichtungen je Abrichtung und Wahl („<Stelle der Abrichtung>:<Nr. der Wahl>“ → Wert) */
  abrichtungWahlen?: Record<string, string | string[]>;
  /** Golem-Bausteine (IDs, Wiederholung = mehrfach gewählt) */
  bausteine?: string[];
  /** gewählte Sonderausstattung je Platz (Text der Möglichkeit, z. B. „SR +2“) */
  sonderausstattung?: string[];
  /** über die Ressource Golem animiert */
  golemRessource?: boolean;
  /** Wahlen beim Feinschliff je Wahl-Schlüssel: Attribut, Meisterschaft, Fertigkeit oder verteilte Punkte */
  feinschliff?: Record<string, string | Record<string, number>>;
  // ---- Erhobener Untoter (Die Magie S. 182–184); id = Wertesatz (Kreatur) oder „untoter:<Name>“
  /** Zauber, mit dem der Untote erhoben wurde */
  erhebung?: string;
  /** wie oft die Verstärkung „Erfahrungspunkte“ gewählt wurde */
  verstaerkungen?: number;
  /** Abnormität (ID) */
  abnormitaet?: string;
  /** mit Erfahrungspunkten gesteigert: Attribute (Kürzel) und Fertigkeiten (IDs), jeweils Anzahl der Punkte */
  steigerung?: { attribute?: Record<string, number>; fertigkeiten?: Record<string, number> };
  // ---- Spielwerte aller Begleiter: verlorene Lebenspunkte und verbrauchter Fokus
  zustand?: {
    schaden?: number; betaeubung?: number; kanalisiert?: number;
    fokus?: { erschoepft?: number; kanalisiert?: number; verzehrt?: number };
    /** Zustände wie beim Abenteurer */
    zustaende?: StatusCondition[];
  };
}

/** Gewählter Baustein eines Relikts (Regel-ID aus den Paketen) */
export interface ReliktBaustein { id: string; name?: string; anzahl: number; grad?: number; stufe?: number; auswahl?: string }
/** Relikt: Punkte der Ressource Relikt, Gegenstandsart, Grundgegenstand (Ausrüstungs-ID) und Bausteine */
export interface Relikt {
  id: string; name: string; punkte: number; art: string;
  basisId?: string; basisName?: string;
  bausteine: ReliktBaustein[];
  notiz?: string;
  /** ID des zugehörigen Inventareintrags */
  inventarId: string;
  /** Wachsen des Relikts (Anlass, Punkte, Beschreibung) */
  chronik?: ReliktChronikEintrag[];
  /** Beseelter Gegenstand: Domäne des Heiligen, Kräfte mit Questen, ruhende Kräfte nach Verstoß */
  beseelung?: ReliktBeseelung;
}
export interface ReliktChronikEintrag { id: string; art: string; punkte: number; text: string; heldengrad?: number; datum?: string }
export interface ReliktBeseelung {
  domaene: string;
  heiliger?: string;
  gebote?: string;
  kraefte: { id: string; queste?: string; erfuellt?: boolean }[];
  /** so viele der zuletzt erhaltenen Kräfte ruhen (Verstoß gegen Gebote, bis zur Buße) */
  ruht?: number;
}

export interface ErschaffungsModulWahl {
  fertigkeiten?: Record<string, string>;
  ressourcen?: Record<string, string>;
  staerke?: string;
  meisterschaft?: number;
}
export interface ErschaffungsModulAngewendet {
  fertigkeiten: Record<string, number>;
  ressourcen: Record<string, number>;
  staerke?: { name: string; stufe: number };
  meisterschaft?: { skill: string; name: string };
}
export interface ErschaffungsModulZustand { modul: string; wahl?: ErschaffungsModulWahl; angewendet?: ErschaffungsModulAngewendet }
export interface ErschaffungsWahl { kultur?: ErschaffungsModulZustand | null; abstammung?: ErschaffungsModulZustand | null }

// ============================================================
// Reducer actions
// ============================================================

export type CharacterAction =
  | { type: 'SET_MODE'; payload: AppMode }
  | { type: 'UNDO_LAST_ADVANCEMENT' }
  | { type: 'SET_IGNORE_ENCUMBRANCE'; payload: boolean }
  | { type: 'PLAY_SET_STATE'; payload: PlayState }
  | { type: 'SET_CREATION_FINALIZED'; payload: boolean }
  | { type: 'SET_XP_TOTAL'; payload: number }
  | { type: 'ADD_XP_WITH_NOTE'; payload: { amount: number; note?: string } }
  | { type: 'EDIT_XP_TOTAL_WITH_NOTE'; payload: { newTotal: number; note?: string } }
  | { type: 'ADD_ADVANCEMENT_LOG'; payload: AdvancementLogEntry }
  | { type: 'REMOVE_ADVANCEMENT_LOG_ENTRY'; payload: string }
  | { type: 'CLEAR_ADVANCEMENT_LOG' }
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_RACE'; payload: { race: string; racialStrengths: ItemEntry[]; keptStrengths: ItemEntry[] } }
  | { type: 'SET_MOON_SIGN'; payload: string }
  | { type: 'SET_HOME_REGION'; payload: string }
  | { type: 'MOD_ATTR_BASE'; payload: { key: keyof AttrMap; delta: number } }
  | { type: 'TOGGLE_RACE_BONUS'; payload: string }
  | { type: 'MOD_ATTR_XP'; payload: { key: keyof AttrMap; delta: number } }
  | { type: 'MOD_SKILL'; payload: { key: string; delta: number } }
  | { type: 'SET_SKILLS_BASE'; payload: Record<string, number> }
  | { type: 'SET_SKILLS_XP'; payload: Record<string, number> }
  | { type: 'ADD_MASTERY'; payload: { skill: string; mastery: Mastery } }
  | { type: 'REMOVE_MASTERY_BY_ID'; payload: { skill: string; id: string } }
  | { type: 'REMOVE_MASTERY_BY_IDX'; payload: { skill: string; idx: number } }
  | { type: 'ADD_SPELL'; payload: Spell }
  | { type: 'REMOVE_SPELL_BY_IDX'; payload: number }
  | { type: 'ADD_STRENGTH'; payload: ItemEntry }
  | { type: 'REMOVE_STRENGTH'; payload: number }
  | { type: 'ADD_RESOURCE'; payload: ItemEntry }
  | { type: 'RESOURCE_STEIGERN'; payload: { index: number; stufen: number } }
  | { type: 'SCHWAECHEN_HG'; payload: number }
  | { type: 'REMOVE_RESOURCE'; payload: number }
  | { type: 'ADD_WEAKNESS'; payload: ItemEntry }
  | { type: 'REMOVE_WEAKNESS'; payload: number }
  | { type: 'ADD_LANGUAGE'; payload: ItemEntry }
  | { type: 'REMOVE_LANGUAGE'; payload: number }
  | { type: 'SET_LANGUAGES_LIST'; payload: ItemEntry[] }
  | { type: 'SET_STRENGTHS_LIST'; payload: ItemEntry[] }
  | { type: 'LOAD_STATE'; payload: Partial<CharacterState> }
  | { type: 'PLAY_TAKE_DAMAGE'; payload: { kind: 'exhausted' | 'consumed' | 'channeled'; maxLP?: number; amount?: number } }
  | { type: 'PLAY_SET_DYING_LEVEL'; payload: 0 | 2 | 3 | 4 }
  | { type: 'PLAY_UNDO_DAMAGE'; payload: { kind: 'exhausted' | 'consumed' | 'channeled'; amount?: number; maxLP?: number } }
  /** kanalisierter Schaden, dessen Zustand aufgehoben ist, wird zu Betäubungsschaden (GRW S. 15, 173) */
  | { type: 'PLAY_KANALISIERT_FREIGEBEN'; payload: { amount: number } }
  | {
      type: 'PLAY_HEAL_EXHAUSTED';
      payload?: {
        healAllStun?: boolean;
        stunAmount?: number;
        healAllExhaustedFocus?: boolean;
        exhaustedFocusAmount?: number;
        exhaustReduction?: number;
        removeConditions?: boolean;
      };
    }
  | { type: 'PLAY_REST_HEAL'; payload: { konAmount: number; wilAmount: number; lpHealAmount?: number; foHealAmount?: number } }
  | { type: 'PLAY_NEUER_TAG' }
  | { type: 'PLAY_SPEND_FOCUS'; payload: { kind: 'exhausted' | 'channeled' | 'consumed'; amount: number } }
  | { type: 'PLAY_CANCEL_CHANNELED_SPELL'; payload: { id: string } }
  | { type: 'PLAY_ADD_CHANNELED_SPELL'; payload: ChanneledSpell }
  | { type: 'PLAY_UPDATE_CHANNELED_SPELL'; payload: { id: string; update: Partial<ChanneledSpell> } }
  | {
      type: 'PLAY_CAST_SPELL';
      payload: {
        exhaustedFocus?: number;
        channeledFocus?: number;
        consumedFocus?: number;
        channeledSpell?: ChanneledSpell;
      };
    }
  | { type: 'PLAY_SET_SPLITTER'; payload: number }
  | { type: 'PLAY_ADD_CONDITION'; payload: StatusCondition }
  | { type: 'PLAY_REMOVE_CONDITION'; payload: { id: string } }
  | { type: 'PLAY_DIVINE_MERCY'; payload: { maxLP: number } }
  | { type: 'PLAY_ADD_TEMP_HP'; payload: { amount: number } }
  | { type: 'PLAY_REMOVE_TEMP_HP'; payload: { amount: number } }
  | { type: 'PLAY_SET_LP_MODIFIER'; payload: { modifier: number; newMaxLP: number } }
  | { type: 'PLAY_RESET'; payload: { maxLP: number; maxFocus: number; maxSplitter: number } }
  /** Lebenspunkte je Stufe haben sich geändert (z. B. Robust, KON): Kästchen anpassen, Schaden bleibt */
  | { type: 'PLAY_LP_ANPASSEN'; payload: { maxLP: number } }
  | { type: 'ADD_INVENTORY_ITEM'; payload: InventoryItem }
  | { type: 'REMOVE_INVENTORY_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_INVENTORY_ITEM'; payload: { id: string; updates: Partial<InventoryItem> } }
  | { type: 'TOGGLE_EQUIP_ITEM'; payload: { id: string } }
  | { type: 'SET_MONEY'; payload: Partial<Money> }
  | { type: 'ERSCHAFFUNG_MODUL_SETZEN'; payload: { art: 'kultur' | 'abstammung'; modul: ErschaffungsModulZustand | null } }
  | { type: 'ERSCHAFFUNG_MODUL_EINTRAGEN'; payload: { art: 'kultur' | 'abstammung'; werte: ErschaffungsModulAngewendet; beschreibungen?: Record<string, string> } }
  | { type: 'ERSCHAFFUNG_MODUL_AUSTRAGEN'; payload: { art: 'kultur' | 'abstammung' } }
  | { type: 'BEGLEITER_HINZU'; payload: Begleiter }
  | { type: 'BEGLEITER_ENTFERNEN'; payload: { index: number } }
  | { type: 'BEGLEITER_AENDERN'; payload: { index: number; aenderung: Partial<Omit<Begleiter, 'id' | 'art'>> } }
  /** Spielzustand mehrerer Begleiter auf einmal (Rast mit dem Abenteurer, Rückgängig im Spiel), je Stelle in der Liste */
  | { type: 'BEGLEITER_ZUSTAENDE_SETZEN'; payload: { index: number; zustand: Begleiter['zustand'] }[] }
  | { type: 'RELIKT_SPEICHERN'; payload: { relikt: Relikt; inventar: InventoryItem } }
  | { type: 'RELIKT_LOESCHEN'; payload: { id: string } }
  | { type: 'REGEL_NAMEN_ABGLEICHEN'; payload: Partial<Pick<CharacterState, 'strengthsList' | 'weaknessesList' | 'resourcesList' | 'masteries' | 'spellsList'>> };

// ============================================================
// Derived / calculated values
// ============================================================

export interface DerivedStats {
  GSW: number;
  INI: number;
  LP: number;
  FO: number;
  VTD: number;
  SR: number;
  GW: number;
  KW: number;
}

export interface CreationUsage {
  attr: number;
  skill: number;
  strength: number;
  resource: number;
  language: number;
  languages: number;
  nonMagicPoints: number;
  creationMasteries: number;
  strengthLimit: number;
  resourceLimit: number;
  /** Grenzen der Erschaffung aus dem Paket */
  attrLimit: number;
  attrMin: number;
  attrMax: number;
  skillLimit: number;
  skillMax: number;
  nonMagicMin: number;
  masteryLimit: number;
  languageLimit: number;
}

// ============================================================
// Component prop types
// ============================================================

export interface AttributeRowProps {
  attrKey: string;
  total: number;
  startValue: number;
  onIncrease: () => void;
  onDecrease: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
  cost: number;
  mode: AppMode;
  /** warum „Erhöhen“ gesperrt ist (Anzeige beim Überfahren mit der Maus) */
  sperrgrund?: string;
}
