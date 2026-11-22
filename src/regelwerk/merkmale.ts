/**
 * Spielwerte der Waffenmerkmale aus den Paketen (merkmal_wirkung, gelesen in utils/combatRules.ts; GRW S. 186 und Grimoires).
 * Der Editor kennt keine Merkmalsnamen: Er sucht in der Merkmalsliste einer Waffe nach den
 * Merkmalen des Katalogs, die eine Wirkung tragen, und liest deren Stufe.
 */
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';
import { aktiverKatalog, meisterschaftId } from './bruecke';
import type { GelernteMeisterschaft } from './kampflage';
import { quelleText } from './relikte';
import { merkmaleMitSpielwerten } from '../utils/combatRules';

export interface MerkmalWirkung {
  wuerfel_mindestens?: 'stufe';
  je_hoechstwurf?: 'stufe';
  zusatzwuerfel?: 'stufe';
  sr_ignorieren?: 'stufe';
  schadensart?: 'betaeubung';
  mit_manoevern?: boolean;
  schaden?: number;
  schaden_je_stufe?: number;
  wgs?: number;
  vtd?: number;
  bedingung?: 'zweihaendig' | 'ziel_ruestung_ohne_primitiv' | 'meisterschaft' | 'beritten' | 'gefuehrt';
  meisterschaften?: string[];
  aktive_abwehr_eg_je_stufe?: number;
  aktive_abwehr_schwierigkeit_je_stufe?: number;
}

export interface WaffenMerkmal {
  name: string;
  stufe: number;
  wirkung: MerkmalWirkung;
  quelle: string;
}

const MERKMAL_CACHE = new WeakMap<Katalog, Eintrag[]>();

function merkmaleMitWirkung(k: Katalog): Eintrag[] {
  let l = MERKMAL_CACHE.get(k);
  if (!l) {
    const gesehen = new Set<string>();
    l = [];
    // je Name ein Eintrag: Grundregelwerk zuerst, dann die Bände
    const alle = merkmaleMitSpielwerten(k).map((x) => x.eintrag);
    alle.sort((a, b) => Number(!a.id.startsWith('grw:')) - Number(!b.id.startsWith('grw:')));
    for (const e of alle) {
      const n = e.name.toLowerCase();
      if (gesehen.has(n)) continue;
      gesehen.add(n); l.push(e);
    }
    MERKMAL_CACHE.set(k, l);
  }
  return l;
}


/** Merkmale einer Waffe mit Wirkung und Stufe (Merkmale ohne Stufe: Stufe 1) */
export function waffenMerkmale(merkmalText: string | undefined, k: Katalog | null = aktiverKatalog()): WaffenMerkmal[] {
  if (!k || !merkmalText) return [];
  const text = merkmalText.toLowerCase();
  const raus: WaffenMerkmal[] = [];
  const wirkungVon = new Map(merkmaleMitSpielwerten(k).map((x) => [x.eintrag.id, x.wirkung]));
  for (const e of merkmaleMitWirkung(k)) {
    const m = new RegExp(`(^|[^\\p{L}])${e.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*(\\d+))?([^\\p{L}]|$)`, 'u').exec(text);
    if (!m) continue;
    raus.push({ name: e.name, stufe: m[2] ? Number(m[2]) : 1, wirkung: wirkungVon.get(e.id) as MerkmalWirkung, quelle: quelleText(k, e) });
  }
  return raus;
}

export interface MerkmalLage {
  zweihaendig?: boolean;
  beritten?: boolean;
  zielRuestungOhnePrimitiv?: boolean;
  /** Katalog-IDs der Meisterschaften des Angreifers */
  meisterschaftIds?: Set<string>;
}

export interface MerkmalSchaden {
  /** Schadenswürfel der Waffe zählen mindestens so viel */
  wuerfelMindestens: number;
  /** je Würfel mit Höchstzahl so viel mehr Schaden */
  jeHoechstwurf: number;
  /** so viele Würfel zusätzlich, die besten zählen */
  zusatzwuerfel: number;
  /** so viel Schadensreduktion wird ignoriert */
  srIgnorieren: number;
  /** Schaden zählt als Betäubungsschaden (auch aus Manövern) */
  betaeubung: boolean;
  /** fester Zusatzschaden vor der Schadensreduktion */
  schaden: number;
  /** Abzug vom Schaden nach der Schadensreduktion (Ziel in Rüstung ohne dieses Merkmal) */
  schadenNachSR: number;
  /** Änderung der Waffengeschwindigkeit (negativ = schneller) */
  wgs: number;
  /** angewandte Merkmale in Worten (für Anzeige und Würfelprotokoll) */
  posten: string[];
  /** Bedingungen, die der Spieler angeben muss (nur die, die bei dieser Waffe vorkommen) */
  schalter: Array<'zweihaendig' | 'beritten' | 'ziel_ruestung_ohne_primitiv'>;
  /** Merkmale ohne Wirkung auf den Schadenswurf, aber mit Hinweis zur Aktiven Abwehr */
  hinweise: string[];
}

const plus = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Wirkung der Merkmale auf einen Angriff mit dieser Waffe */
export function merkmalSchaden(merkmale: WaffenMerkmal[], lage: MerkmalLage = {}): MerkmalSchaden {
  const r: MerkmalSchaden = { wuerfelMindestens: 0, jeHoechstwurf: 0, zusatzwuerfel: 0, srIgnorieren: 0, betaeubung: false, schaden: 0, schadenNachSR: 0, wgs: 0, posten: [], schalter: [], hinweise: [] };
  for (const m of merkmale) {
    const w = m.wirkung; const t = `${m.name}${m.stufe > 1 || w.wuerfel_mindestens || w.je_hoechstwurf || w.zusatzwuerfel || w.sr_ignorieren || w.schaden_je_stufe ? ` ${m.stufe}` : ''}`;
    if (w.wuerfel_mindestens) { r.wuerfelMindestens = Math.max(r.wuerfelMindestens, m.stufe); r.posten.push(`${t}: Würfel mindestens ${m.stufe}`); }
    if (w.je_hoechstwurf) { r.jeHoechstwurf += m.stufe; r.posten.push(`${t}: +${m.stufe} je Höchstwurf`); }
    if (w.zusatzwuerfel) { r.zusatzwuerfel += m.stufe; r.posten.push(`${t}: ${m.stufe} Würfel mehr, die besten zählen`); }
    if (w.sr_ignorieren) { r.srIgnorieren += m.stufe; r.posten.push(`${t}: ${m.stufe} SR ignoriert`); }
    if (w.schadensart === 'betaeubung') { r.betaeubung = true; r.posten.push(`${t}: Betäubungsschaden`); }
    if (w.aktive_abwehr_schwierigkeit_je_stufe) r.hinweise.push(`${t}: Aktive Abwehr dagegen um ${w.aktive_abwehr_schwierigkeit_je_stufe * m.stufe} erschwert (${m.quelle})`);
    if (w.aktive_abwehr_eg_je_stufe) r.hinweise.push(`${t}: +${w.aktive_abwehr_eg_je_stufe * m.stufe} EG bei erfolgreicher Aktiver Abwehr mit dieser Waffe (${m.quelle})`);
    const bed = w.bedingung;
    if (bed === 'zweihaendig' || bed === 'beritten' || bed === 'ziel_ruestung_ohne_primitiv') if (!r.schalter.includes(bed)) r.schalter.push(bed);
    const erfuellt =
      bed === 'zweihaendig' ? !!lage.zweihaendig
      : bed === 'beritten' ? !!lage.beritten && (!w.meisterschaften || w.meisterschaften.some((id) => lage.meisterschaftIds?.has(id)))
      : bed === 'ziel_ruestung_ohne_primitiv' ? !!lage.zielRuestungOhnePrimitiv
      : bed === 'meisterschaft' ? !!w.meisterschaften?.some((id) => lage.meisterschaftIds?.has(id))
      : bed === 'gefuehrt' ? false
      : true;
    if (!erfuellt) continue;
    const s = (w.schaden ?? 0) + (w.schaden_je_stufe ?? 0) * m.stufe;
    if (s && bed === 'ziel_ruestung_ohne_primitiv') { r.schadenNachSR += s; r.posten.push(`${t}: ${plus(s)} Schaden`); }
    else if (s) { r.schaden += s; r.posten.push(`${t}: ${plus(s)} Schaden`); }
    if (w.wgs) { r.wgs += w.wgs; r.posten.push(`${t}: WGS ${plus(w.wgs)}`); }
  }
  return r;
}

/** Katalog-IDs der Meisterschaften (Liste mit Name und Fertigkeit) */
export function meisterschaftsIdsVon(masteries: GelernteMeisterschaft[] | Record<string, GelernteMeisterschaft[]> | undefined, k: Katalog | null = aktiverKatalog()): Set<string> {
  const ids = new Set<string>();
  if (!k || !masteries) return ids;
  const liste = Array.isArray(masteries) ? masteries : Object.entries(masteries).flatMap(([s, l]) => l.map((m) => ({ ...m, skill: m.skill || s })));
  for (const m of liste) { const id = meisterschaftId(k, m.name, m.skill, m.regelId); if (id) ids.add(id); }
  return ids;
}

/** Verteidigung durch geführte Waffen (Merkmal mit Bedingung „geführt“, GRW S. 186) – zählt einmal, auch bei mehreren Waffen */
export function verteidigungDurchWaffen(waffen: Array<{ attributes?: string; equipped?: boolean }>, k: Katalog | null = aktiverKatalog()): { wert: number; quelle: string } {
  let wert = 0; let quelle = '';
  for (const w of waffen) {
    if (!w.equipped) continue;
    for (const m of waffenMerkmale(w.attributes, k)) {
      if (m.wirkung.bedingung === 'gefuehrt' && m.wirkung.vtd && m.wirkung.vtd < wert) { wert = m.wirkung.vtd; quelle = `${m.name} (${m.quelle})`; }
    }
  }
  return { wert, quelle };
}
