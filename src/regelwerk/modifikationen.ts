/**
 * Modifikationen aus den Baukästen (Golem-Bausteine, Golem-Material, Abnormitäten, Wesen-Baukasten, Abrichtungen).
 * Die Datenseite liest die Texte aus und schreibt `modifikationen_strukturiert` (Werkzeuge/regelpakete/textauslese.py);
 * der Editor liest nur dieses Feld und wendet die festen Zahlen auf einen Wertekasten an. Wahlen (ein beliebiges Attribut,
 * freie Fertigkeitspunkte, freie Meisterschaften) und übrige Texte stehen ebenfalls im Feld.
 */
import type { Katalog } from './katalog';

export const ATTRIBUT_KURZ = ['AUS', 'BEW', 'INT', 'KON', 'MYS', 'STÄ', 'VER', 'WIL'];
export const ABGELEITET_KURZ = ['GK', 'GSW', 'INI', 'LP', 'FO', 'VTD', 'SR', 'KW', 'GW'];

export interface Modifikationen {
  attribute: Record<string, number>;
  abgeleitet: Record<string, number>;
  /** Obergrenzen, z. B. „GK +1 (maximal 7)“ */
  hoechstens: Record<string, number>;
  angriff: number; schaden: number; wgs: number;
  /** Fertigkeit (Katalog-ID) → Bonus */
  fertigkeiten: Record<string, number>;
  merkmaleDazu: string[];
  merkmaleWeg: string[];
  /** zusätzliche Waffenmerkmale aller Angriffe */
  waffenmerkmale: string[];
  /** entfallende Waffenmerkmale („Waffenmerkmal Stumpf entfällt“) */
  waffenmerkmaleWeg: string[];
  /** wie oft die Merkmalskette angewandt wird: vorhandenes Merkmal der Kette wird zum nächsten, das letzte entfällt,
   *  fehlen alle, steigen die LP um `robuster_lp` der Feinschliff-Regel (Datenseite: `robuster`, `robuster_kette`) */
  robuster: number;
  robusterKette: string[];
  /** Merkmal mit Stufe: fehlt das Merkmal, kommt es mit Stufe `neu` dazu, sonst steigt es um `plus` */
  merkmaleStufe: { name: string; neu: number; plus: number }[];
  /** dasselbe für Waffenmerkmale aller Angriffe */
  waffenmerkmaleStufe: { name: string; neu: number; plus: number }[];
  /** nicht als feste Zahl lesbare Teile */
  rest: string[];
}

/** Zusammenführen doppelter Merkmale nach der Feinschliff-Regel eines Baukastens (`strukturiert.merkmale_zusammenfuehren`) */
export interface MerkmalRegel {
  ersetzen: { merkmal: string; ab: number; wird: string }[];
  stufen_addieren: boolean;
  andere_doppelte_entfallen: boolean;
  beide_entfallen: string[][];
  beide_entfallen_ausser_mehrfach?: string[];
  robuster_lp: number;
}

export const leer = (): Modifikationen => ({
  attribute: {}, abgeleitet: {}, hoechstens: {}, angriff: 0, schaden: 0, wgs: 0, fertigkeiten: {}, merkmaleDazu: [], merkmaleWeg: [], waffenmerkmale: [], waffenmerkmaleWeg: [], robuster: 0, robusterKette: [], merkmaleStufe: [], waffenmerkmaleStufe: [], rest: [],
});

const zahl = (s: string) => Number(s.replace(/[−–]/g, '-').replace('+', ''));
const plus = (r: Record<string, number>, k: string, v: number) => { r[k] = (r[k] ?? 0) + v; };

/** Kommas außerhalb von Klammern trennen (Listen in Wertekästen) */
function teile(s: string, zeichen: string): string[] {
  const out: string[] = []; let tiefe = 0; let akt = '';
  for (const c of s) {
    if (c === '(' || c === '[') tiefe++;
    if (c === ')' || c === ']') tiefe--;
    if (c === zeichen && tiefe === 0) { out.push(akt); akt = ''; } else akt += c;
  }
  out.push(akt);
  return out.map(x => x.trim()).filter(Boolean);
}

/** Wahl aus einem Modifikationen-Text, wie die Datenseite sie schreibt (Schwelle „schritt5“: nach Feinschliff-Tabelle) */
export type WahlRoh =
  | { art: 'attribut'; optionen: string[]; bonus: number; text: string }
  | { art: 'meisterschaft'; schwelle: number | 'schritt5'; text: string }
  | { art: 'fertigkeit'; neu: number; plus: number; text: string }
  | { art: 'punkte'; anzahl: number; max: number; text: string };

/** Feld `modifikationen_strukturiert` im Paket */
export interface ModifikationenStruktur {
  attribute?: Record<string, number>; abgeleitet?: Record<string, number>; hoechstens?: Record<string, number>; fertigkeiten?: Record<string, number>;
  angriff?: number; schaden?: number; wgs?: number; robuster?: number; robuster_kette?: string[];
  merkmale_dazu?: string[]; merkmale_weg?: string[]; waffenmerkmale?: string[]; waffenmerkmale_weg?: string[];
  merkmale_stufe?: { name: string; neu: number; plus: number }[]; waffenmerkmale_stufe?: { name: string; neu: number; plus: number }[];
  wahlen?: WahlRoh[]; feste_meisterschaften?: string[]; text?: string[];
}

/** Feste Zahlen einer strukturierten Modifikation; `rest` bekommt die Texte (Wahlen und Übriges) */
export function ausStruktur(s: ModifikationenStruktur | null | undefined): Modifikationen {
  const m = leer();
  if (!s) return m;
  for (const [a, v] of Object.entries(s.attribute ?? {})) plus(m.attribute, a, v);
  for (const [a, v] of Object.entries(s.abgeleitet ?? {})) plus(m.abgeleitet, a, v);
  for (const [a, v] of Object.entries(s.fertigkeiten ?? {})) plus(m.fertigkeiten, a, v);
  Object.assign(m.hoechstens, s.hoechstens ?? {});
  m.angriff = s.angriff ?? 0; m.schaden = s.schaden ?? 0; m.wgs = s.wgs ?? 0; m.robuster = s.robuster ?? 0; m.robusterKette = [...(s.robuster_kette ?? [])];
  m.merkmaleDazu = [...(s.merkmale_dazu ?? [])]; m.merkmaleWeg = [...(s.merkmale_weg ?? [])];
  m.waffenmerkmale = [...(s.waffenmerkmale ?? [])]; m.waffenmerkmaleWeg = [...(s.waffenmerkmale_weg ?? [])];
  m.merkmaleStufe = [...(s.merkmale_stufe ?? [])]; m.waffenmerkmaleStufe = [...(s.waffenmerkmale_stufe ?? [])];
  m.rest = [...(s.wahlen ?? []).map(w => w.text), ...(s.text ?? [])];
  return m;
}

/** Summe mehrerer Modifikationen */
export function summe(...liste: Modifikationen[]): Modifikationen {
  const s = leer();
  for (const m of liste) {
    for (const [a, v] of Object.entries(m.attribute)) plus(s.attribute, a, v);
    for (const [a, v] of Object.entries(m.abgeleitet)) plus(s.abgeleitet, a, v);
    for (const [a, v] of Object.entries(m.fertigkeiten)) plus(s.fertigkeiten, a, v);
    for (const [a, v] of Object.entries(m.hoechstens)) s.hoechstens[a] = Math.min(s.hoechstens[a] ?? Infinity, v);
    s.angriff += m.angriff; s.schaden += m.schaden; s.wgs += m.wgs;
    s.merkmaleDazu.push(...m.merkmaleDazu); s.merkmaleWeg.push(...m.merkmaleWeg); s.waffenmerkmale.push(...m.waffenmerkmale); s.waffenmerkmaleWeg.push(...m.waffenmerkmaleWeg); s.robuster += m.robuster; if (!s.robusterKette.length) s.robusterKette = [...m.robusterKette]; s.merkmaleStufe.push(...m.merkmaleStufe); s.waffenmerkmaleStufe.push(...m.waffenmerkmaleStufe); s.rest.push(...m.rest);
  }
  return s;
}

/** Wertekasten in Zahlen (Grundlage für Modifikationen) */
export interface Werteblock {
  attribute: Record<string, number>;
  abgeleitet: Record<string, number>;
  waffen: { name: string; wert: number; schaden: string; wgs: string; ini: string; merkmale: string }[];
  fertigkeiten: { id?: string; name: string; wert: number }[];
  merkmale: string[];
  typus?: string;
  meisterschaften?: string;
}

const n = (s: unknown) => { const x = Number.parseInt(String(s ?? '').replace(/[−–]/g, '-'), 10); return Number.isFinite(x) ? x : 0; };

/** Werteblock aus Katalogdaten (attribute, abgeleitete_werte, waffen, fertigkeiten_refs, felder) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function werteblock(k: Katalog, d: any): Werteblock {
  const f = d.felder ?? {};
  return {
    attribute: Object.fromEntries(ATTRIBUT_KURZ.map(a => [a, n(d.attribute?.[a])])),
    abgeleitet: Object.fromEntries(ABGELEITET_KURZ.filter(a => d.abgeleitete_werte?.[a] !== undefined).map(a => [a, n(d.abgeleitete_werte[a])])),
    waffen: (d.waffen ?? []).map((w: Record<string, string>) => ({ name: w.name, wert: n(w.wert), schaden: w.schaden, wgs: w.wgs, ini: w.ini, merkmale: w.merkmale })),
    fertigkeiten: (d.fertigkeiten_refs ?? []).filter((x: { wert?: unknown }) => typeof x.wert === 'number')
      .map((x: { id?: string; text: string; wert: number }) => ({ id: x.id, name: x.id ? k.get(x.id)?.name ?? x.text.replace(/\s*\d+$/, '') : x.text.replace(/\s*\d+$/, ''), wert: x.wert })),
    merkmale: teile(String(d.merkmale ?? f.merkmale ?? '').replace(/,\s*$/, ''), ',').filter(x => x && x !== '–' && x !== '−'),
    typus: d.typus ?? f.typus, meisterschaften: f.meisterschaften,
  };
}

/** „2W6+3“ + 2 → „2W6+5“; „1W10“ − 1 → „1W10−1“ */
export function schadenPlus(s: string, v: number): string {
  if (!v) return s;
  const m = s.match(/^(\d+W\d+)\s*([+\-−]\s*\d+)?(.*)$/);
  if (!m) return `${s} ${v > 0 ? '+' : '−'}${Math.abs(v)}`;
  const k = (m[2] ? zahl(m[2].replace(/\s/g, '')) : 0) + v;
  return `${m[1]}${k > 0 ? `+${k}` : k < 0 ? `−${-k}` : ''}${m[3]}`;
}
/** „8−1W6“ + (−1) → „7−1W6“ */
export function iniPlus(s: string, v: number): string {
  if (!v) return s;
  const m = s.match(/^(\d+)(.*)$/);
  return m ? `${Number(m[1]) + v}${m[2]}` : s;
}
/** „10“ / „6 Ticks“ + 2 */
export function wgsPlus(s: string, v: number): string {
  if (!v) return s;
  const m = String(s).match(/^(\d+)(.*)$/);
  return m ? `${Number(m[1]) + v}${m[2]}` : s;
}

/** Regel zum Zusammenführen doppelter Merkmale am Regeltext `id` (Feinschliff eines Baukastens) */
export function merkmalRegel(k: Katalog, id: string): MerkmalRegel | null {
  return k.get(id)?.daten.strukturiert?.merkmale_zusammenfuehren ?? null;
}

/** „Merkmal X N oder +M“ auf eine Merkmalsliste: vorhandene Stufe erhöhen, sonst mit Stufe N hinzufügen */
function stufeAnwenden(liste: string[], x: { name: string; neu: number; plus: number }): string[] {
  const i = liste.findIndex(y => y.replace(/\s*\+?\d+$/, '').trim() === x.name);
  if (i < 0) return [...liste, `${x.name} ${x.neu}`];
  const alt = Number((liste[i].match(/(\d+)$/) ?? [])[1] ?? 0);
  return liste.map((y, j) => (j === i ? `${x.name} ${alt + x.plus}` : y));
}

/**
 * Doppelte Merkmale nach der Regel des Baukastens zusammenführen: Ersetzungen („zweimal Dämmersicht wird Dunkelsicht“),
 * Stufen addieren, gegenseitig aufhebende Merkmale, übrige Doppelte entfallen. `liste` enthält jedes Vorkommen.
 */
export function merkmaleZusammenfuehren(liste: string[], regel: MerkmalRegel): string[] {
  const grund = (x: string) => x.replace(/\s*\+?\d+$/, '').trim();
  const anzahl = (name: string) => liste.filter(x => grund(x) === name).length;
  let l = [...liste];
  for (const e of regel.ersetzen) if (anzahl(e.merkmal) >= e.ab) l = [...l.filter(x => grund(x) !== e.merkmal), e.wird];
  if (regel.stufen_addieren) {
    const summe = new Map<string, number>();
    for (const x of l) { const m = x.match(/^(.*?)\s+(\d+)$/); if (m) summe.set(m[1], (summe.get(m[1]) ?? 0) + Number(m[2])); }
    const gesehen = new Set<string>();
    l = l.flatMap(x => {
      const m = x.match(/^(.*?)\s+(\d+)$/);
      if (!m || (l.filter(y => grund(y) === m[1]).length < 2)) return [x];
      if (gesehen.has(m[1])) return []; gesehen.add(m[1]); return [`${m[1]} ${summe.get(m[1])}`];
    });
  }
  for (const paar of regel.beide_entfallen) {
    if (!paar.every(p => l.some(x => grund(x) === p))) continue;
    const bleibt = paar.filter(p => (regel.beide_entfallen_ausser_mehrfach ?? []).includes(p) && l.filter(x => grund(x) === p).length > 1);
    l = l.filter(x => !paar.includes(grund(x)) || bleibt.includes(grund(x)));
  }
  if (regel.andere_doppelte_entfallen) l = l.filter((x, i) => l.indexOf(x) === i);
  return l;
}

/**
 * Wendet Modifikationen an (ohne Neuberechnung: die Baukästen nennen abgeleitete Änderungen ausdrücklich).
 * Mit `regel` werden doppelte Merkmale nach der Feinschliff-Regel des Baukastens zusammengeführt.
 */
export function anwenden(k: Katalog, w: Werteblock, m: Modifikationen, regel?: MerkmalRegel | null): Werteblock {
  const attribute = { ...w.attribute };
  for (const [a, v] of Object.entries(m.attribute)) attribute[a] = (attribute[a] ?? 0) + v;
  const abgeleitet = { ...w.abgeleitet };
  for (const [a, v] of Object.entries(m.abgeleitet)) {
    if (a === 'INI' && abgeleitet.INI === undefined) continue; // Initiative steht an den Waffen
    abgeleitet[a] = (abgeleitet[a] ?? 0) + v;
    if (m.hoechstens[a] !== undefined) abgeleitet[a] = Math.min(abgeleitet[a], Math.max(w.abgeleitet[a] ?? 0, m.hoechstens[a]));
  }
  for (const a of ['LP', 'SR', 'GSW']) if (abgeleitet[a] !== undefined) abgeleitet[a] = Math.max(0, abgeleitet[a]);
  const ini = m.abgeleitet.INI ?? 0;
  const wm = (x: string) => {
    const alt = teile(String(x ?? ''), ',').filter(y => y && y !== '–' && y !== '−' && !m.waffenmerkmaleWeg.some(w => y.replace(/\s*\d+$/, '') === w));
    const l = [...alt, ...m.waffenmerkmale];
    return l.length ? l.join(', ') : '–';
  };
  const wmStufe = (x: string) => {
    if (!m.waffenmerkmaleStufe.length) return x;
    let l = teile(x, ',').filter(y => y && y !== '–' && y !== '−');
    for (const s2 of m.waffenmerkmaleStufe) l = stufeAnwenden(l, s2);
    return l.join(', ');
  };
  const waffen = w.waffen.map(x => ({ ...x, wert: x.wert + m.angriff, schaden: schadenPlus(x.schaden, m.schaden), wgs: wgsPlus(x.wgs, m.wgs), ini: iniPlus(x.ini, ini), merkmale: wmStufe(wm(x.merkmale)) }));
  const fertigkeiten = w.fertigkeiten.map(f => ({ ...f, wert: f.wert + (f.id ? m.fertigkeiten[f.id] ?? 0 : 0) }));
  for (const [id, v] of Object.entries(m.fertigkeiten)) if (!fertigkeiten.some(f => f.id === id)) fertigkeiten.push({ id, name: k.get(id)?.name ?? id, wert: v });
  fertigkeiten.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const grund = (x: string) => x.replace(/\s*\(?\d+.*$/, '').trim();
  let merkmale = w.merkmale.filter(x => !m.merkmaleWeg.some(y => grund(y) === grund(x)));
  if (regel) merkmale = merkmaleZusammenfuehren([...merkmale, ...m.merkmaleDazu.filter(x => !m.merkmaleWeg.some(y => grund(y) === grund(x)))], regel);
  else for (const x of m.merkmaleDazu) if (!merkmale.some(y => y === x)) merkmale = [...merkmale, x];
  for (const x of m.merkmaleStufe) merkmale = stufeAnwenden(merkmale, x);
  const kette = m.robusterKette;
  for (let i = 0; i < m.robuster; i++) {
    const j = kette.findIndex(x => merkmale.includes(x));
    if (j >= 0 && j < kette.length - 1) merkmale = merkmale.map(x => (x === kette[j] ? kette[j + 1] : x));
    else if (j >= 0) merkmale = merkmale.filter(x => x !== kette[j]);
    else if (abgeleitet.LP !== undefined) abgeleitet.LP += regel?.robuster_lp ?? 0;
  }
  return { ...w, attribute, abgeleitet, waffen, fertigkeiten, merkmale };
}

/** Werteblock → Wertekasten für die Anzeige */
export function alsWertekasten(w: Werteblock): import('./begleiter').Wertekasten {
  return {
    attribute: Object.fromEntries(Object.entries(w.attribute).map(([a, v]) => [a, String(v)])),
    abgeleitete_werte: Object.fromEntries(Object.entries(w.abgeleitet).map(([a, v]) => [a, String(v)])),
    waffen: w.waffen.map(x => ({ ...x, wert: String(x.wert) })),
    felder: {
      ...(w.typus ? { typus: w.typus } : {}),
      ...(w.fertigkeiten.length ? { fertigkeiten: w.fertigkeiten.map(f => `${f.name} ${f.wert}`).join(', ') } : {}),
      ...(w.meisterschaften ? { meisterschaften: w.meisterschaften } : {}),
      ...(w.merkmale.length ? { merkmale: w.merkmale.join(', ') } : {}),
    },
  };
}

