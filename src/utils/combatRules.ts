import type { Katalog } from '../regelwerk/katalog';
import type { Eintrag } from '../regelwerk/typen';
import type { Wirkung } from '../regelwerk/wirkungen';
import { aktiverKatalog, meisterschaftId, norm } from '../regelwerk/bruecke';
import { erfolgsgrade } from '../regelwerk/proben';

export interface AttackEGCalculation {
  totalRoll: number;
  targetVTD: number;
  differenz: number;
  isSuccess: boolean;
  isFumble: boolean;
  isCrit: boolean;
  eg: number;
  outcomeLabel: string;
}

/**
 * Erfolg und Erfolgsgrade eines Angriffs nach den Probenregeln des Pakets (regelwerk/proben.ts, GRW S. 17–18):
 * je volle 3 Punkte über der Verteidigung 1 EG; Patzer: immer verfehlt; Triumph: +3 EG, nur wenn der Angriff
 * rechnerisch trifft. Die Bezeichnung ist die Einstufung des GRW („Gelungen“, „Herausragend gelungen“ …).
 */
export function calculateAttackEG(
  totalRoll: number,
  targetVTD: number,
  isFumble: boolean = false,
  isCrit: boolean = false
): AttackEGCalculation {
  const r = erfolgsgrade(totalRoll, targetVTD, isFumble, isCrit);
  return {
    totalRoll,
    targetVTD,
    differenz: r.differenz,
    isSuccess: r.gelungen,
    isFumble,
    isCrit: r.triumph,
    eg: r.gelungen ? Math.max(0, r.eg) : 0,
    outcomeLabel: isFumble ? `Patzer – ${r.einstufung}` : r.triumph ? `Triumph – ${r.einstufung}` : r.einstufung,
  };
}

/**
 * Ein Angriff mit oder ohne Meisterschafts-Manöver (GRW S. 160–161). Die Wirkung kommt aus dem Paket:
 * `daten.manoeverwirkung` der Meisterschaft; für Manöver aus Grimoires ohne dieses Feld die Wirkungen „beim Manöver“
 * (`wirkungen_strukturiert`: Zusatzschaden, Zustand). Keine Manöver nach Namen im Code.
 */
export interface CombatManeuver {
  id: string;
  name: string;
  /** 'free' = Angriff ohne Meisterschafts-Manöver; freie Manöver werden danach mit Erfolgsgraden gewählt */
  type: 'free' | 'mastery';
  regelId?: string;
  skill?: string;
  source?: string;
  page?: number;
  description: string;
  shortDesc: string;
  /** Erfolgsgrade, die das Manöver kostet (GRW S. 161: 1 je angesagtem Meisterschafts-Manöver) */
  egCost: number;
  extraDamageFormula?: string;
  /** fester Zusatzschaden aus Werten des Angreifers (Stärke, Intuition, halbe Geschwindigkeit …) */
  fixedExtraDamage?: number;
  fixedExtraDamageText?: string;
  /** 1 = voller, 0,5 = halber, 0 = kein Schaden */
  damageMultiplier: number;
  inflictsCondition?: string;
  selfCondition?: string;
  targetResistance: 'VTD' | 'KW' | 'GW';
  requires?: 'zielen' | 'ringend';
  zielVerliertTicks?: number;
  zusaetzlicheZiele?: number;
  hoechstensGk?: number;
  hinweis?: string;
  jeWeiteremEg?: string;
  belege: string[];
  /** @deprecated nur noch für alte Aufrufer: Schaden je EG beim Wuchtangriff steht jetzt in wuchtangriffJeEg() */
  egDamageRate?: number;
}

export const MELEE_WEAPON_SKILLS = [
  'Klingenwaffen',
  'Stangenwaffen',
  'Hiebwaffen',
  'Kettenwaffen',
  'Handgemenge',
] as const;

export const RANGED_WEAPON_SKILLS = [
  'Schusswaffen',
  'Wurfwaffen',
] as const;

/**
 * Checks if a given weapon / skill represents melee combat (Nahkampf).
 */
export function isMeleeWeapon(weaponSkill?: string, weaponCategory?: string): boolean {
  if (weaponCategory && /fern/i.test(weaponCategory)) return false;
  if (weaponSkill && RANGED_WEAPON_SKILLS.some((s) => s.toLowerCase() === weaponSkill.toLowerCase())) return false;
  if (weaponCategory && /nah/i.test(weaponCategory)) return true;
  if (weaponSkill && MELEE_WEAPON_SKILLS.some((s) => s.toLowerCase() === weaponSkill.toLowerCase())) return true;
  return true; // Default fallback to melee
}

/**
 * Checks if a given weapon / skill represents ranged combat (Fernkampf).
 */
export function isRangedWeapon(weaponSkill?: string, weaponCategory?: string): boolean {
  return !isMeleeWeapon(weaponSkill, weaponCategory);
}

const STANDARDANGRIFF: CombatManeuver = {
  id: 'none',
  name: 'Angriff ohne Meisterschafts-Manöver',
  type: 'free',
  source: 'GRW',
  page: 160,
  description: 'Erfolgsgrade können nach dem Wurf für freie Manöver eingesetzt werden (GRW S. 161).',
  shortDesc: 'Erfolgsgrade für freie Manöver',
  egCost: 0,
  damageMultiplier: 1,
  targetResistance: 'VTD',
  belege: [],
  egDamageRate: 1,
};

/** Angriff ohne Meisterschafts-Manöver; die freien Manöver wählt man danach mit Erfolgsgraden */
export const FREE_COMBAT_MANEUVERS: CombatManeuver[] = [STANDARDANGRIFF];

// ---------------------------------------------------------------- Regeln aus dem Paket

const NAHKAMPF_ID = 'grw:regel:kampf-regeln:nahkampfhandlungen';

export interface FreiesManoever { name: string; eg?: number; je_eg?: { schaden?: number; entschlossenheit_erschwert?: number }; betaeubungsschaden?: boolean; nur_nahkampf?: boolean }

export interface ManoeverRegeln {
  egJeManoever: number;
  streiftrefferSchaden: number;
  streiftrefferBetaeubung: number;
  freie: FreiesManoever[];
  /** Kombination mehrerer Meisterschafts-Manöver (GRW S. 161); ohne Paket nur ein Manöver je Angriff */
  kombination: { mehrere: boolean; gleicherWiderstand: boolean; schadenFuerAngriff: boolean; jeManoeverEinmal: boolean };
  quelle: string;
}

/** Manöverregeln (GRW S. 160–161): EG je Meisterschafts-Manöver, Streiftreffer, freie Manöver */
export function manoeverRegeln(k: Katalog | null = aktiverKatalog()): ManoeverRegeln {
  const e = k?.get(NAHKAMPF_ID); const r = e?.daten.manoever_regeln;
  return {
    egJeManoever: r?.eg_je_meisterschaftsmanoever ?? 0,
    streiftrefferSchaden: r?.streiftreffer?.schaden_je_manoever ?? 0,
    streiftrefferBetaeubung: r?.streiftreffer?.betaeubung_je_manoever ?? 0,
    freie: r?.freie_manoever ?? [],
    kombination: {
      mehrere: !!r?.kombination?.mehrere,
      gleicherWiderstand: r?.kombination?.gleicher_widerstand ?? true,
      schadenFuerAngriff: r?.kombination?.schadenseinschraenkung_gilt_fuer_angriff ?? true,
      jeManoeverEinmal: r?.kombination?.je_manoever_einmal ?? true,
    },
    quelle: 'GRW S. 161',
  };
}

/** Schaden je EG beim freien Manöver Wuchtangriff; Waffen mit einem Merkmal, das ihn erhöht (Wuchtig, GRW S. 186), geben mehr */
export function wuchtangriffJeEg(waffenMerkmale: string | undefined, k: Katalog | null = aktiverKatalog()): number {
  const grund = manoeverRegeln(k).freie.find((f) => f.je_eg?.schaden)?.je_eg?.schaden ?? 0;
  if (!k || !waffenMerkmale) return grund;
  const text = waffenMerkmale.toLowerCase();
  for (const e of Object.values(k.eintraege)) {
    if (e.typ === 'merkmal' && typeof e.daten.wuchtangriff_je_eg === 'number' && new RegExp(`(^|[^\\p{L}])${e.name.toLowerCase()}([^\\p{L}]|$)`, 'u').test(text)) {
      return Math.max(grund, e.daten.wuchtangriff_je_eg);
    }
  }
  return grund;
}

/** Mehrere angesagte Meisterschafts-Manöver zu einem Angriff zusammengefasst (GRW S. 161) */
export interface ManoeverKombination {
  manoever: CombatManeuver[];
  /** gesamte EG-Kosten (je Manöver seine Kosten) */
  egKosten: number;
  widerstand: 'VTD' | 'KW' | 'GW';
  /** Schadenseinschränkung gilt für den ganzen Angriff: kleinster Faktor */
  damageMultiplier: number;
  extraDamageFormulas: string[];
  fixedExtraDamage: number;
  zustaende: string[];
  selbstZustaende: string[];
  voraussetzungen: ('zielen' | 'ringend')[];
  /** Anzahl angesagter Meisterschafts-Manöver (für Streiftreffer) */
  angesagt: number;
  /** zusammengefasstes Manöver für Protokoll und Rückgabe */
  gesamt: CombatManeuver;
}

/** Darf `m` zu den bereits gewählten Manövern hinzukommen? Grund, wenn nicht. */
export function manoeverHinzufuegbar(gewaehlt: CombatManeuver[], m: CombatManeuver, regeln: ManoeverRegeln = manoeverRegeln()): string | null {
  if (m.type !== 'mastery') return null;
  const meister = gewaehlt.filter((g) => g.type === 'mastery');
  if (regeln.kombination.jeManoeverEinmal && meister.some((g) => g.id === m.id)) return 'Jedes Manöver nur einmal je Angriff';
  if (meister.length === 0) return null;
  if (!regeln.kombination.mehrere) return 'Nur ein Manöver je Angriff';
  const w = meister[0].targetResistance ?? 'VTD';
  if (regeln.kombination.gleicherWiderstand && (m.targetResistance ?? 'VTD') !== w) return `Geht gegen ${m.targetResistance}, die gewählten gegen ${w}`;
  return null;
}

export function kombiniereManoever(gewaehlt: CombatManeuver[], regeln: ManoeverRegeln = manoeverRegeln()): ManoeverKombination {
  const meister = gewaehlt.filter((m) => m.type === 'mastery');
  const liste = meister.length ? meister : [STANDARDANGRIFF];
  const mult = liste.map((m) => m.damageMultiplier ?? 1);
  const gesamtMult = regeln.kombination.schadenFuerAngriff ? Math.min(...mult) : mult[mult.length - 1];
  const r: Omit<ManoeverKombination, 'gesamt'> = {
    manoever: liste,
    egKosten: meister.reduce((s, m) => s + (m.egCost ?? 0), 0),
    widerstand: liste[0].targetResistance ?? 'VTD',
    damageMultiplier: gesamtMult,
    extraDamageFormulas: liste.map((m) => m.extraDamageFormula).filter((f): f is string => !!f),
    fixedExtraDamage: liste.reduce((s, m) => s + (m.fixedExtraDamage ?? 0), 0),
    zustaende: liste.map((m) => m.inflictsCondition).filter((z): z is string => !!z),
    selbstZustaende: liste.map((m) => m.selfCondition).filter((z): z is string => !!z),
    voraussetzungen: [...new Set(liste.map((m) => m.requires).filter((v): v is 'zielen' | 'ringend' => !!v))],
    angesagt: meister.length,
  };
  const gesamt: CombatManeuver = liste.length === 1 ? liste[0] : {
    ...liste[0],
    id: liste.map((m) => m.id).join('+'),
    name: liste.map((m) => m.name).join(' + '),
    description: liste.map((m) => `${m.name}: ${m.description}`).join(' '),
    shortDesc: liste.map((m) => m.shortDesc).join(' / '),
    egCost: r.egKosten,
    extraDamageFormula: r.extraDamageFormulas.join(' + ') || undefined,
    fixedExtraDamage: r.fixedExtraDamage || undefined,
    damageMultiplier: r.damageMultiplier,
    inflictsCondition: r.zustaende.join(', ') || undefined,
    selfCondition: r.selbstZustaende.join(', ') || undefined,
    jeWeiteremEg: undefined,
    belege: liste.flatMap((m) => m.belege),
  };
  return { ...r, gesamt };
}

export interface AngreiferWerte { INT?: number; STA?: number; GSW?: number }

const ATTRIBUT_KURZ: Record<string, keyof AngreiferWerte> = { 'STÄ': 'STA', STA: 'STA', INT: 'INT', GSW: 'GSW' };
const ATTRIBUT_TEXT: Record<string, string> = { STA: 'Stärke', INT: 'Intuition', GSW: 'Geschwindigkeit' };

interface Manoeverwirkung {
  widerstand?: 'VTD' | 'KW' | 'GW';
  schaden?: 'voll' | 'halb' | 'kein';
  zusatzschaden?: { wuerfel?: string; attribut?: string; wert?: string; faktor?: number; hoechstens?: number };
  zustand?: { id: string; stufe?: number; dauer_ticks?: number; auch_selbst?: boolean };
  ziel_verliert_ticks?: number;
  zusaetzliche_ziele?: number;
  hoechstens_gk?: number;
  voraussetzung?: 'zielen' | 'ringend';
  hinweis?: string;
  je_weiterem_eg?: string;
  belege: string[];
}

function zustandText(k: Katalog, z: { id: string; stufe?: number | null; dauer_ticks?: number | null }): string {
  const n = k.get(z.id)?.name ?? z.id;
  return `${n}${z.stufe ? ` ${z.stufe}` : ''}${z.dauer_ticks ? ` (${z.dauer_ticks} Ticks)` : ''}`;
}

/** Wirkung eines Manövers aus dem Paket; ohne `manoeverwirkung` aus den Wirkungen „beim Manöver“ */
function wirkungAusEintrag(e: Eintrag): Manoeverwirkung {
  if (e.daten.manoeverwirkung) return e.daten.manoeverwirkung as Manoeverwirkung;
  const w: Manoeverwirkung = { belege: [] };
  for (const x of (e.daten.wirkungen_strukturiert ?? []) as Wirkung[]) {
    if (x.gilt !== 'beim Manöver') continue;
    if (x.art === 'zusatzschaden' && typeof x.wert === 'string' && /^\d*W\d+/i.test(x.wert)) w.zusatzschaden = { wuerfel: x.wert };
    if (x.art === 'zusatzschaden' && typeof x.wert === 'number') w.zusatzschaden = { wert: 'fest', faktor: x.wert };
    if (x.art === 'zustand' && x.zustand_ref && x.traeger === 'ziel') w.zustand = { id: x.zustand_ref.id, stufe: (x as { stufe?: number }).stufe, dauer_ticks: (x as { dauer_ticks?: number }).dauer_ticks };
    if ((x as { beleg?: string }).beleg) w.belege.push((x as { beleg?: string }).beleg!);
  }
  return w;
}

function zusatzschadenFest(z: Manoeverwirkung['zusatzschaden'], werte: AngreiferWerte): { wert?: number; text?: string } {
  if (!z || z.wuerfel) return {};
  if (z.wert === 'fest') return { wert: z.faktor ?? 0, text: `+${z.faktor ?? 0}` };
  const schl = ATTRIBUT_KURZ[z.attribut ?? z.wert ?? ''];
  if (!schl) return {};
  const f = z.faktor ?? 1;
  const roh = (werte[schl] ?? 0) * f;
  let wert = Math.round(roh);  // kaufmännisch (GRW S. 11)
  if (z.hoechstens !== undefined) wert = Math.min(wert, z.hoechstens);
  const name = ATTRIBUT_TEXT[schl];
  const text = `${f === 0.5 ? 'halbe ' : ''}${name}${z.hoechstens !== undefined ? ` (höchstens ${z.hoechstens})` : ''}`;
  return { wert, text };
}

/** Manöver aus einem Paketeintrag (Meisterschaft mit `manoever`) */
export function manoeverAusEintrag(e: Eintrag, k: Katalog, werte: AngreiferWerte = {}): CombatManeuver {
  const w = wirkungAusEintrag(e);
  const fest = zusatzschadenFest(w.zusatzschaden, werte);
  const fertigkeit = k.get(e.daten.fertigkeit)?.name ?? e.daten.fertigkeit_name;
  const teile = [
    w.widerstand && w.widerstand !== 'VTD' ? `gegen ${w.widerstand}` : '',
    w.schaden === 'halb' ? 'halber Schaden' : w.schaden === 'kein' ? 'kein Schaden' : '',
    w.zusatzschaden?.wuerfel ? `+${w.zusatzschaden.wuerfel} Schaden` : fest.text ? `+ ${fest.text} Schaden` : '',
    w.zustand ? `Ziel: ${zustandText(k, w.zustand)}${w.zustand.auch_selbst ? ' (beide)' : ''}` : '',
    w.ziel_verliert_ticks ? `Ziel verliert ${w.ziel_verliert_ticks} Ticks` : '',
    w.hinweis ?? '',
  ].filter(Boolean);
  return {
    id: `mastery_${e.id}`,
    regelId: e.id,
    name: e.name,
    type: 'mastery',
    skill: fertigkeit,
    source: k.pakete[e.quelle.paket]?.kuerzel ?? e.quelle.paket,
    page: (e.quelle.buch_seiten ?? [])[0],
    description: e.daten.beschreibung ?? '',
    shortDesc: teile.join(' · ') || e.name,
    egCost: manoeverRegeln(k).egJeManoever,
    extraDamageFormula: w.zusatzschaden?.wuerfel,
    fixedExtraDamage: fest.wert,
    fixedExtraDamageText: fest.text,
    damageMultiplier: w.schaden === 'halb' ? 0.5 : w.schaden === 'kein' ? 0 : 1,
    inflictsCondition: w.zustand ? zustandText(k, w.zustand) : undefined,
    selfCondition: w.zustand?.auch_selbst ? zustandText(k, w.zustand) : undefined,
    targetResistance: w.widerstand ?? 'VTD',
    requires: w.voraussetzung,
    zielVerliertTicks: w.ziel_verliert_ticks,
    zusaetzlicheZiele: w.zusaetzliche_ziele,
    hoechstensGk: w.hoechstens_gk,
    hinweis: w.hinweis,
    jeWeiteremEg: w.je_weiterem_eg,
    belege: w.belege,
    egDamageRate: 1,
  };
}

/** Gilt eine Meisterschaft für diese Waffe? Waffenfertigkeit gleich, oder allgemeine Nah- bzw. Kampfmeisterschaft */
function passtZurWaffe(fertigkeitName: string | undefined, weaponSkill: string, isMelee: boolean): boolean {
  if (!fertigkeitName) return false;
  const f = fertigkeitName.toLowerCase();
  if (f === weaponSkill.trim().toLowerCase()) return true;
  if (f.startsWith('allgemeine') && f.includes('nahkampf')) return isMelee;
  if (f.startsWith('allgemeine') && f.includes('kampf')) return true;
  return false;
}

/**
 * Ist das Manöver mit dieser Waffe einsetzbar? Entscheidet die Fertigkeit der Meisterschaft im Paket.
 */
export function isCombatManeuverAllowedForWeapon(
  maneuverNameOrClean: string,
  weaponSkill: string = 'Klingenwaffen',
  weaponCategory?: string,
  masterySkill?: string,
  k: Katalog | null = aktiverKatalog(),
): boolean {
  const isMelee = isMeleeWeapon(weaponSkill, weaponCategory);
  if (masterySkill) return passtZurWaffe(masterySkill, weaponSkill, isMelee);
  if (!k) return false;
  const name = norm(maneuverNameOrClean.replace(/\s*\([ST]\d+\)/i, ''));
  return Object.values(k.eintraege).some((e) => e.typ === 'meisterschaft' && e.daten.manoever && norm(e.name) === name
    && passtZurWaffe(k.get(e.daten.fertigkeit)?.name ?? e.daten.fertigkeit_name, weaponSkill, isMelee));
}

/**
 * Manöver, die der Charakter mit dieser Waffe ansagen kann: ein Angriff ohne Meisterschafts-Manöver und jede gelernte
 * Manöver-Meisterschaft der Waffenfertigkeit bzw. der allgemeinen Meisterschaften (GRW und Grimoires).
 */
export function getAvailableCombatManeuvers(
  characterMasteries: unknown = [],
  weaponSkill: string = 'Klingenwaffen',
  weaponCategory?: string,
  werte: AngreiferWerte = {},
  k: Katalog | null = aktiverKatalog(),
): CombatManeuver[] {
  const out: CombatManeuver[] = [STANDARDANGRIFF];
  if (!k) return out;
  const isMelee = isMeleeWeapon(weaponSkill, weaponCategory);
  const gelernt: { name: string; skill?: string; regelId?: string }[] = [];
  const nimm = (item: unknown, skill?: string) => {
    const o = item as { name?: string; baseName?: string; skill?: string; regelId?: string } | string;
    const name = typeof o === 'string' ? o : (o?.name || o?.baseName || '');
    if (name) gelernt.push({ name: name.replace(/\s*\([ST]\d+\)/i, '').trim(), skill: typeof o === 'object' ? (o?.skill ?? skill) : skill, regelId: typeof o === 'object' ? o?.regelId : undefined });
  };
  if (Array.isArray(characterMasteries)) characterMasteries.forEach((m) => nimm(m));
  else if (characterMasteries && typeof characterMasteries === 'object') {
    for (const [skill, l] of Object.entries(characterMasteries as Record<string, unknown[]>)) (l ?? []).forEach((m) => nimm(m, skill));
  }
  const gesehen = new Set<string>();
  for (const g of gelernt) {
    const id = meisterschaftId(k, g.name, g.skill, g.regelId);
    const e = id ? k.get(id) : undefined;
    if (!e?.daten.manoever) continue;
    const fertigkeit = k.get(e.daten.fertigkeit)?.name ?? e.daten.fertigkeit_name;
    // Eine Meisterschaft gilt nur in ihrer Fertigkeit (GRW S. 94); allgemeine Nahkampfmeisterschaften für jede Nahkampfwaffe
    if (!passtZurWaffe(fertigkeit, weaponSkill, isMelee) || gesehen.has(e.id)) continue;
    gesehen.add(e.id);
    out.push(manoeverAusEintrag(e, k, werte));
  }
  return out;
}

/** @deprecated Freie Manöver werden nach dem Wurf mit Erfolgsgraden gewählt (manoeverRegeln().freie) */
export function getFreeCombatManeuversForWeapon(): CombatManeuver[] {
  return FREE_COMBAT_MANEUVERS;
}

export interface ParsedWeaponDamage {
  count: number;
  sides: number;
  bonus: number;
  damageType: string;
  raw: string;
}

/**
 * Parses weapon damage string like "1W6+2", "2W6", "1W10+4", or "1W6"
 */
export function parseWeaponDamage(formulaStr?: string | null, fallbackType: string = 'Schnitt'): ParsedWeaponDamage {
  const raw = (formulaStr || '1W6').trim();
  const match = raw.match(/^(\d*)W(\d+)\s*([+-]\s*\d+)?/i);

  if (!match) {
    return {
      count: 1,
      sides: 6,
      bonus: 0,
      damageType: fallbackType,
      raw: '1W6',
    };
  }

  const count = parseInt(match[1] || '1', 10);
  const sides = parseInt(match[2], 10);
  let bonus = 0;
  if (match[3]) {
    bonus = parseInt(match[3].replace(/\s+/g, ''), 10) || 0;
  }

  // Attempt to detect damage type from attributes or suffix
  let damageType = fallbackType;
  if (/stich/i.test(raw)) damageType = 'Stich';
  else if (/hieb/i.test(raw)) damageType = 'Hieb';
  else if (/waffenlos|stumpf/i.test(raw)) damageType = 'Stumpf';

  return {
    count,
    sides,
    bonus,
    damageType,
    raw,
  };
}

export interface DamageRollInput {
  baseFormula: string;           // e.g. "1W6+3"
  maneuverExtraFormula?: string; // e.g. "1W6" (from Hammerschlag)
  /** mehrere Manöver: alle Zusatzwürfel */
  maneuverExtraFormulas?: string[];
  /** mehrere Manöver: alle Zustände */
  maneuverConditions?: string[];
  /** fester Zusatzschaden des Manövers (z. B. Stärke beim Würgegriff) */
  maneuverFixedDamage?: number;
  /** Betäubungsschlag: profaner Schaden wird Betäubungsschaden (GRW S. 161) */
  stunDamage?: boolean;
  /** Streiftreffer: Abzug in Punkten (2 je angesagtem Manöver, GRW S. 161); Manöverwirkungen entfallen */
  streiftrefferAbzug?: number;
  egBonusDamage: number;         // extra damage from allocated EG (e.g. +4)
  damageMultiplier?: number;     // e.g. 0.5 for Abdrängen
  targetArmorReduction?: number; // opponent's RS (e.g. 3)
  armorPenetrationEG?: number;   // RS ignored from Gezielter Schlag (e.g. 2)
  damageType?: string;
  maneuverCondition?: string;    // e.g. "Verwundet 1"
  tripCondition?: boolean;       // if Umreißen was used
}

export interface DamageRollResult {
  baseDice: number[];
  baseDiceSum: number;
  baseBonus: number;
  maneuverDice: number[];
  maneuverDiceSum: number;
  egBonusDamage: number;
  grossDamage: number;           // before armor
  effectiveArmor: number;        // targetArmorReduction - armorPenetrationEG
  netDamage: number;             // after armor
  damageType: string;
  appliedConditions: string[];
  breakdownText: string;
}

/**
 * Rolls damage transparently and calculates net damage vs. target armor.
 */
export function executeAttackDamageRoll(input: DamageRollInput): DamageRollResult {
  const parsed = parseWeaponDamage(input.baseFormula, input.damageType || 'Schnitt');

  // Roll base dice
  const baseDice: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    baseDice.push(Math.floor(Math.random() * parsed.sides) + 1);
  }
  const baseDiceSum = baseDice.reduce((a, b) => a + b, 0);

  // Roll maneuver extra dice (if applicable, e.g. Hammerschlag +1W6)
  const maneuverDice: number[] = [];
  let maneuverBonus = 0;
  for (const f of [...(input.maneuverExtraFormula ? [input.maneuverExtraFormula] : []), ...(input.maneuverExtraFormulas ?? [])]) {
    const parsedM = parseWeaponDamage(f);
    for (let i = 0; i < parsedM.count; i++) {
      maneuverDice.push(Math.floor(Math.random() * parsedM.sides) + 1);
    }
    maneuverBonus += parsedM.bonus;
  }
  const maneuverDiceSum = maneuverDice.reduce((a, b) => a + b, 0) + maneuverBonus;

  // Sum before multiplier
  const fest = input.maneuverFixedDamage ?? 0;
  const rawSum = baseDiceSum + parsed.bonus + maneuverDiceSum + fest + input.egBonusDamage;
  const multiplier = input.damageMultiplier ?? 1;
  const abzug = Math.max(0, input.streiftrefferAbzug ?? 0);
  // halber Schaden kaufmännisch gerundet (GRW S. 11); kein Schaden bleibt 0
  const grossDamage = multiplier === 0 ? 0 : Math.max(0, Math.round(rawSum * multiplier) - abzug);

  // Armor calculations
  const rawArmor = Math.max(0, input.targetArmorReduction ?? 0);
  const armorPen = Math.max(0, input.armorPenetrationEG ?? 0);
  const effectiveArmor = Math.max(0, rawArmor - armorPen);
  const netDamage = Math.max(0, grossDamage - effectiveArmor);

  // Applied conditions
  const appliedConditions: string[] = [];
  if (input.maneuverCondition) {
    appliedConditions.push(input.maneuverCondition);
  }
  for (const z of input.maneuverConditions ?? []) appliedConditions.push(z);
  if (input.tripCondition) {
    appliedConditions.push('Liegend');
  }

  // Construct readable breakdown
  const dicePart = `[${baseDice.join(', ')}]`;
  const bonusPart = parsed.bonus !== 0 ? (parsed.bonus > 0 ? ` + ${parsed.bonus}` : ` - ${Math.abs(parsed.bonus)}`) : '';
  const egPart = input.egBonusDamage > 0 ? ` + ${input.egBonusDamage} EG` : '';
  const manPart = (maneuverDice.length > 0 ? ` + Manöver [${maneuverDice.join(', ')}]${maneuverBonus ? ` + ${maneuverBonus}` : ''}` : '') + (fest ? ` + ${fest} Manöver` : '');
  const multPart = (multiplier === 0.5 ? ' halbiert' : multiplier === 0 ? ' kein Schaden' : multiplier !== 1 ? ` × ${multiplier}` : '') + (abzug ? ` − ${abzug} Streiftreffer` : '');
  const armorPart = rawArmor > 0
    ? ` - ${effectiveArmor} RS${armorPen > 0 ? ` (${rawArmor} - ${armorPen} durchdrungen)` : ''}`
    : '';

  const breakdownText = `${dicePart}${bonusPart}${egPart}${manPart}${multPart} = ${grossDamage} Brutto${armorPart} → ${netDamage} Netto${input.stunDamage ? ' (Betäubungsschaden)' : ''}`;

  return {
    baseDice,
    baseDiceSum,
    baseBonus: parsed.bonus,
    maneuverDice,
    maneuverDiceSum,
    egBonusDamage: input.egBonusDamage,
    grossDamage,
    effectiveArmor,
    netDamage,
    damageType: input.stunDamage ? 'Betäubung' : (input.damageType || parsed.damageType),
    appliedConditions,
    breakdownText,
  };
}
