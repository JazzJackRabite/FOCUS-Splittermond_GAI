/**
 * Typen für Regeldaten, wie die Module unter src/regelwerk sie aus den Regelpaketen liefern (Zauber, Meisterschaften,
 * Stärken, Schwächen, Ressourcen, Sprachen, Ausrüstung, Zustände). Früher lagen sie bei den eingebauten Listen in src/data.
 */

export interface Spell {
    name: string;
    school: string;
    grade: number;
    cost: string;
    castTime?: string;
    range?: string;
    duration?: string;
    target?: string;
    description?: string;
    damage?: string;
    source: string;
    page?: number;
    difficulty?: string;
    difficultyType?: 'fest' | 'VTD' | 'GW' | 'KW';
    difficultyValue?: number;
}

export interface PrerequisiteCondition {
  typ: 'besitzt_regel' | 'mindestwert' | 'regel_mindestwert' | 'und' | 'oder' | 'ungeklaert' | string;
  ziel_kategorie?: string;
  ziel_name?: string;
  ziel_id?: string;
  bereich?: string;
  name?: string;
  wert?: number;
  bedingungen?: PrerequisiteCondition[];
  original?: string;
  grund?: string;
  kandidaten?: any[];
  [key: string]: any;
}

export interface MasteryEntry {
  name: string;
  baseName?: string;
  page?: number;
  source: string;
  desc?: string;
  tier?: number;
  minSkillValue?: number;
  skill?: string;
  manoever?: boolean;
  prerequisiteText?: string | null;
  prerequisite?: PrerequisiteCondition | null;
  prerequisiteStatus?: string | null;
  id?: string;
  /** mehrfach wählbar (Paket: `mehrfach_waehlbar`) */
  mehrfach?: boolean;
}

export interface StrengthData {
    name: string;
    cost: number;
    max: number;
    desc: string;
    multi: boolean;
    source: string;
    page?: number;
    onlyCreation: boolean;
}

export interface WeaknessData {
  name: string;
  desc: string;
  source: string;
  page: number;
}

export interface ResourceData {
    name: string;
    source: string;
    page: number;
    desc: string;
    /** höchste Stufe der Ressourcentabelle */
    maxStufe?: number;
    /** mehrfach erwerbbar (je Erwerb ein eigener Eintrag, z. B. ein Tier, ein Relikt) */
    mehrfach?: boolean;
}

export interface LanguageData {
  name: string;
  source: string;
  page: number;
  family?: string;
  desc?: string;
}

export interface WeaponItem {
    id?: string;
    name: string;
    type: 'weapon';
    category: string;
    skill: string;
    damage: string;
    wgs: string | number;
    range: string;
    price: string;
    load: number | string;
    hardness?: number;
    attributes: string;
    /** Attribute, die mit der Kampffertigkeit den Angriffswert ergeben (Paketfeld daten.attribute; GRW S. 181) */
    kampfAttribute?: string[];
    source: string;
    page: number;
    desc: string;
}

export interface ArmorItem {
    id?: string;
    name: string;
    type: 'armor';
    category: string;
    vtdBonus: number;
    sr: number;
    handicap: number;
    tickModifier: number;
    minStrength: number;
    price: string;
    load: number | string;
    hardness?: number;
    attributes: string;
    source: string;
    page: number;
    desc: string;
}

export interface ShieldItem {
    id?: string;
    name: string;
    type: 'shield';
    category: string;
    vtdBonus: number;
    handicap: number;
    tickModifier: number;
    price: string;
    load: number | string;
    hardness?: number;
    attributes: string;
    source: string;
    page: number;
    desc: string;
}

export interface GearItem {
    id?: string;
    name: string;
    type: 'gear' | 'alchemika';
    category: string;
    price: string;
    load?: number | string;
    hardness?: number;
    source: string;
    page: number;
    desc: string;
}

/**
 * Form der Zustandswirkungen. Die Werte stehen nur in den Paketen: Einträge vom Typ `zustand` (Feld `daten.zustandswirkung`),
 * das Grundregelwerk im GRW-Paket, alle anderen in den Grimoires.
 */
export type Probenbereich = 'allgemein' | 'kampf' | 'magie';

/** Form wie `daten.zustandswirkung` im Paket */
export interface Zustandswirkung {
  probe?: { bereiche?: Probenbereich[]; attribute?: string[]; pro_stufe?: number; fest?: number; hoechststufe?: number; nur?: 'sicht'; art?: 'wundstufe' };
  werte?: Record<string, { pro_stufe?: number; fest?: number; faktor?: number; setzen?: number; kanalisiert_anteil_pro_stufe?: number }>;
  /** gilt als anderer Zustand bzw. Kampfposition, z. B. Bewusstlos: „liegend“ */
  gilt_als?: 'liegend';
}
