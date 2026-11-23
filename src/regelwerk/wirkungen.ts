/**
 * Wirkungen der Stärken, Meisterschaften und Zauber eines Charakters (daten.wirkungen_strukturiert der Regelpakete).
 *
 * - verrechnet: gilt „immer“ für den Charakter selbst und lässt sich eindeutig einrechnen:
 *     · Bonus/Malus auf benannte Fertigkeiten (z. B. Einfühlsamkeit: +2 Empathie) → Fertigkeitswert
 *     · Meisterschaften auf abgeleitete Werte (z. B. Sprinter: GSW +1, Gute Reflexe: VTD +1, Blitzreflexe: INI −3) → abgeleitete Werte
 *     · Stärken mit Modifikatoren auf abgeleitete Werte (z. B. Hoher Geistiger Widerstand) → schon in abgeleiteteWerte()
 * - dauerhaft: gilt „immer“, ist aber kein Zahlenwert des Bogens (Resistenzen, Immunitäten) → nur Anzeige
 * - bedingt / zauber / manoever: gilt nur in einer Lage, solange ein Zauber wirkt oder beim Manöver → nur Anzeige
 * Wirkungen auf andere (Ziel, beschworenes Wesen, Tier) gehören nicht zum Charakter und werden ausgelassen.
 * Meisterschaftseffekte sind kumulativ (GRW S. 92, „Die Effekte von Meisterschaften sind immer kumulativ“).
 */
import type { Katalog } from './katalog';

export interface Wirkung {
  art: string;
  wert?: number | string;
  bezug?: string;
  auf?: string;
  traeger: string;
  bedingung?: string | null;
  bezug_gruppe?: string;
  gruppe?: 'A' | 'B';
  pro_eg?: number | null;
  einheit?: string;
  quelle_wirkung?: string;
  fertigkeit_refs?: { id: string; text: string }[];
  /** bezug „proben“: gilt für jede Probe (sonst nur für fertigkeit_refs) */
  alle_proben?: boolean;
  zustand_ref?: { id: string; text: string };
  /** Behinderung/Tick-Zuschlag: gilt nur für Rüstung bzw. Schild */
  gilt_fuer?: 'ruestung' | 'schild';
  schadensart?: string;
  gegen_typus?: string;
  beleg: string;
  gilt: string;
}

export type WirkungsStatus = 'verrechnet' | 'dauerhaft' | 'bedingt' | 'zauber' | 'manoever';

export interface CharakterWirkung {
  quelle: string;
  quelleName: string;
  quelleTyp: string;
  wirkung: Wirkung;
  status: WirkungsStatus;
  /** Meisterschaften: Fertigkeiten (Editor-Namen), unter denen der Charakter sie führt – bei allgemeinen Magiemeisterschaften die Magieschulen */
  schulen?: string[];
}

const FUER_CHARAKTER = new Set(['selbst', 'selbst_und_verbuendete']);
/** abgeleitete Werte, die der Editor führt; Meisterschaftswirkungen darauf werden eingerechnet */
const ABGELEITET = new Set(['GSW', 'INI', 'VTD', 'KW', 'GW', 'LP', 'FO']);
const VORZEICHEN: Record<string, number> = { bonus: 1, wert_erhoeht: 1, malus: -1, wert_gesenkt: -1 };

function status(k: Katalog, quelle: string, w: Wirkung): WirkungsStatus {
  if (w.gilt === 'solange der Zauber wirkt') return 'zauber';
  if (w.gilt === 'beim Manöver') return 'manoever';
  if (w.gilt !== 'immer') return 'bedingt';
  if ((w.art === 'bonus' || w.art === 'malus') && w.bezug === 'fertigkeit' && typeof w.wert === 'number' && w.fertigkeit_refs?.length) return 'verrechnet';
  const e = k.get(quelle);
  if (e?.typ === 'meisterschaft' && ABGELEITET.has(String(w.bezug)) && typeof w.wert === 'number' && VORZEICHEN[w.art] !== undefined) return 'verrechnet';
  if (e?.typ === 'staerke' && (e.daten.abgeleitete_werte_modifikatoren ?? []).some((m: { bedingt?: unknown }) => !m.bedingt)) return 'verrechnet';
  return 'dauerhaft';
}

/**
 * Alle Wirkungen der gegebenen Einträge (Stärken mehrfach möglich: je Stufe einmal), die den Charakter selbst betreffen.
 * `fertigkeitJeId`: zu Meisterschafts-IDs die Fertigkeiten, unter denen der Charakter sie führt (für Magieschulen).
 */
export function wirkungenDesCharakters(k: Katalog, ids: string[], fertigkeitJeId?: Record<string, string[]>): CharakterWirkung[] {
  const out: CharakterWirkung[] = [];
  const gesehen = new Set<string>();
  for (const id of ids) {
    const e = k.get(id);
    if (!e) continue;
    // Stärken mit mehreren Stufen wirken über ihre Modifikatoren; in der Liste reicht ein Eintrag
    if (gesehen.has(e.id)) continue;
    gesehen.add(e.id);
    for (const w of (e.daten.wirkungen_strukturiert ?? []) as Wirkung[]) {
      if (!FUER_CHARAKTER.has(w.traeger)) continue;
      const cw: CharakterWirkung = { quelle: e.id, quelleName: e.name, quelleTyp: e.typ, wirkung: w, status: status(k, e.id, w) };
      if (fertigkeitJeId?.[e.id]?.length) cw.schulen = fertigkeitJeId[e.id];
      out.push(cw);
    }
  }
  return out;
}

export interface FertigkeitsBonus { summe: number; quellen: { name: string; wert: number }[] }

/** Dauerhafte Boni/Mali auf Fertigkeiten, nach Fertigkeitsname des Katalogs (gleich den Namen im Editor) */
export function fertigkeitsBoni(k: Katalog, liste: CharakterWirkung[]): Record<string, FertigkeitsBonus> {
  const out: Record<string, FertigkeitsBonus> = {};
  for (const cw of liste) {
    const w = cw.wirkung;
    if (cw.status !== 'verrechnet' || w.bezug !== 'fertigkeit' || typeof w.wert !== 'number') continue;
    const wert = w.art === 'malus' ? -w.wert : w.wert;
    for (const r of w.fertigkeit_refs ?? []) {
      const name = k.get(r.id)?.name ?? r.text;
      const b = (out[name] ??= { summe: 0, quellen: [] });
      b.summe += wert;
      b.quellen.push({ name: cw.quelleName, wert });
    }
  }
  return out;
}

/** Dauerhafte Änderungen abgeleiteter Werte durch Meisterschaften (Stärken stecken schon in abgeleiteteWerte()) */
export function werteBoni(liste: CharakterWirkung[]): Record<string, { summe: number; quellen: { name: string; wert: number }[] }> {
  const out: Record<string, { summe: number; quellen: { name: string; wert: number }[] }> = {};
  for (const cw of liste) {
    const w = cw.wirkung;
    if (cw.status !== 'verrechnet' || cw.quelleTyp !== 'meisterschaft' || !ABGELEITET.has(String(w.bezug)) || typeof w.wert !== 'number') continue;
    const v = (VORZEICHEN[w.art] ?? 0) * w.wert;
    if (!v) continue;
    const b = (out[String(w.bezug)] ??= { summe: 0, quellen: [] });
    b.summe += v; b.quellen.push({ name: cw.quelleName, wert: v });
  }
  return out;
}

const BEZUG_TEXT: Record<string, string> = {
  proben: 'Proben', angriff: 'Angriffe', nahkampfangriff: 'Nahkampfangriffe', fernkampfangriff: 'Fernkampfangriffe', aktive_abwehr: 'Aktive Abwehr',
  widerstaende: 'Widerstandswerte', fertigkeitsproben_und_widerstaende: 'Fertigkeitsproben und Widerstandswerte', schaden: 'Schaden', wundabzug: 'Wundabzüge',
  behinderung: 'Behinderung', tick_zuschlag: 'Tick-Zuschlag', maximalbonus: 'Höchstbonus', traglast: 'Last', wgs: 'WGS', zustandsabzug: 'Abzüge aus Zuständen',
  zauber: 'Zauber', zauberkosten: 'Zauberkosten', zauberdauer: 'Zauberdauer', reichweite: 'Reichweite', wirkungsdauer: 'Wirkungsdauer', schwierigkeit: 'Schwierigkeit',
  erfolgsgrade: 'Erfolgsgrade', zauberschaden: 'Zauberschaden', sonstiges: '',
};
function bezugText(w: Wirkung): string {
  if (w.bezug === 'fertigkeit' && w.fertigkeit_refs?.length) return w.fertigkeit_refs.map(r => r.text).join(', ');
  const b = String(w.bezug ?? '');
  // Abzüge eines bestimmten Zustands (z. B. „Abzüge durch Erschöpft“), sonst allgemein
  if (b === 'zustandsabzug' && w.zustand_ref?.text) return `Abzüge durch ${w.zustand_ref.text}`;
  if (b.startsWith('attributproben:')) return `Proben mit ${b.slice(15)}`;
  if (b.startsWith('attribut:')) return b.slice(9);
  return BEZUG_TEXT[b] ?? b;
}

/** Kurztexte je Art einer Wirkung (Schlüssel: Vokabular `art` der Wirkungen im Paket, nicht Regelnamen) */
const KURZTEXT: Record<string, (w: Wirkung, z: string) => string> = {

  bonus: (w, z) => `${z} auf ${(w.auf ?? bezugText(w)).replace(/^(?:seine[nrs]?|ihre[nrs]?|den|die|das) /, '')}`.trim(),
  wert_erhoeht: (w, z) => `${bezugText(w)} ${z}`.trim(),
  schaden_gesenkt: (w) => `${w.schadensart ?? 'Schaden'} −${w.wert}`,
  immunitaet: (w) => `immun gegen ${w.zustand_ref?.text ?? ''}`.trim(),
  zusatzschaden: (w) => `+${w.wert} Schaden`,
  sr_ignorieren: (w) => `${w.wert} SR ignorieren`,
  zustand: (w) => `Zustand ${w.zustand_ref?.text ?? ''}`.trim(),
  wert_gesetzt: (w) => `${w.bezug ?? ''} = ${w.wert}`,
  heilung: (w) => `heilt ${w.wert} ${w.bezug ?? ''}`.trim(),
  schaden: (w) => `${w.wert} Schaden`,
  kosten_gesenkt: (w) => `Kosten −${w.wert}`,
  kosten_erhoeht: (w) => `Kosten +${w.wert}`,
};
KURZTEXT.malus = KURZTEXT.bonus;
KURZTEXT.wert_gesenkt = KURZTEXT.wert_erhoeht;

/** Kurztext einer Wirkung für die Anzeige */
export function wirkungKurz(w: Wirkung): string {
  if (w.art === 'wert_gesenkt' && w.wert === 'Hälfte') return `${bezugText(w)} halbiert`;
  const z = (w.art === 'malus' || w.art === 'wert_gesenkt' ? '−' : '+') + (w.wert ?? '') + (w.pro_eg ? ` (+${w.pro_eg} je EG)` : '');
  const f = KURZTEXT[w.art];
  return f ? f(w, z) : w.beleg;
}

// ---------------------------------------------------------------- Situative Boni beim Würfeln
export type WurfArtKontext = 'probe' | 'angriff' | 'zauber';

export interface SituativerBonus {
  /** eindeutig je Wirkung des Charakters */
  id: string;
  quelle: string;
  /** Bonus (positiv) oder Malus (negativ); null = nur Hinweis, nicht verrechenbar (z. B. Zusatzschaden) */
  wert: number | null;
  text: string;
  bedingung?: string | null;
  beleg: string;
  /** gilt nur gegen Wesen dieses Typus (Regelpaket: gegen_typus, z. B. Untoter) */
  typus?: string;
}

const FERNKAMPF = new Set(['Schusswaffen', 'Wurfwaffen']);

/**
 * Bedingte Wirkungen, die zu diesem Wurf passen könnten: Der Spieler entscheidet, ob die Lage zutrifft.
 * - Fertigkeitsboni der gewürfelten Fertigkeit (auch Waffen- und Magieschulfertigkeit); Boni auf „Proben“ (z. B. zur Orientierung)
 *   nur für die im Regelpaket zugeordneten Fertigkeiten, „alle Proben“ für jede
 * - Angriff: Boni auf Angriffe (Nahkampfangriffe nur im Nahkampf); Zusatzschaden, SR ignorieren und Schadensboni als Hinweis
 *   (Wirkungen „beim Manöver“ stecken in der Manöverauswahl und erscheinen hier nicht)
 * - Zauber: Boni auf Zauber; Schadensboni als Hinweis
 */
const ATTR_EDITOR: Record<string, string> = { AUS: 'AUS', BEW: 'BEW', INT: 'INT', KON: 'KON', MYS: 'MYS', STÄ: 'STA', VER: 'VER', WIL: 'WIL' };

/** Wert einer Wirkung als Zahl: Zahl direkt, Attributkürzel (z. B. „VER“ bei Begabter Alchemist) über die Attribute des Charakters */
export function wertAlsZahl(wert: unknown, attribute?: Record<string, number>): number | null {
  if (typeof wert === 'number') return wert;
  const a = ATTR_EDITOR[String(wert)];
  if (a && attribute && typeof attribute[a] === 'number') return attribute[a];
  return null;
}

export function situativeBoni(k: Katalog, liste: CharakterWirkung[], art: WurfArtKontext, fertigkeit: string, attribute?: Record<string, number>): SituativerBonus[] {
  const out: SituativerBonus[] = [];
  const nahkampf = !FERNKAMPF.has(fertigkeit);
  liste.forEach((cw, i) => {
    // Manöver-Wirkungen stecken in der Manöverauswahl des Angriffs; hier nur bedingte Wirkungen
    if (cw.status !== 'bedingt') return;
    const w = cw.wirkung;
    const roh = wertAlsZahl(w.wert, attribute);
    const zahl = roh === null ? null : (w.art === 'malus' ? -roh : roh);
    let passt = false; let nurHinweis = false;
    if ((w.art === 'bonus' || w.art === 'malus') && cw.status === 'bedingt') {
      if (w.bezug === 'fertigkeit') passt = (w.fertigkeit_refs ?? []).some(r => (k.get(r.id)?.name ?? r.text) === fertigkeit);
      // „Proben zur Orientierung“ u. Ä.: nur für die zugeordneten Fertigkeiten (Regelpaket: fertigkeit_refs), „alle Proben“ immer
      else if (w.bezug === 'proben') passt = w.fertigkeit_refs?.length
        ? w.fertigkeit_refs.some(r => (k.get(r.id)?.name ?? r.text) === fertigkeit)
        : !!w.alle_proben;
      else if (w.bezug === 'angriff') passt = art === 'angriff';
      else if (w.bezug === 'nahkampfangriff') passt = art === 'angriff' && nahkampf;
      else if (w.bezug === 'zauber') passt = art === 'zauber' && giltFuerSchule(k, cw, fertigkeit);
      else if (w.bezug === 'schaden') { passt = art === 'angriff' || art === 'zauber'; nurHinweis = true; }
    } else if (art === 'angriff' && cw.status === 'bedingt' && (w.art === 'zusatzschaden' || w.art === 'sr_ignorieren')) {
      passt = true; nurHinweis = true;
    }
    if (!passt) return;
    const text = typeof w.wert === 'string' && roh !== null ? `${wirkungKurz(w)} (= ${roh})` : wirkungKurz(w);
    out.push({ id: `${cw.quelle}#${i}`, quelle: cw.quelleName, wert: nurHinweis ? null : zahl, text, bedingung: w.bedingung, beleg: w.beleg, ...(w.gegen_typus ? { typus: w.gegen_typus } : {}) });
  });
  return out;
}

// ---------------------------------------------------------------- Zaubermechanik (Gruppe B) im Zauber-Dialog
const ALLGEMEINE_MAGIE = 'grw:meisterschaftsgruppe:allgemeine-magiemeisterschaften';

/**
 * Gilt die Wirkung für einen Zauber dieser Magieschule (Editor-Name, z. B. „Feuermagie“)?
 * - Meisterschaft einer Magieschule: nur für Zauber dieser Schule
 * - allgemeine Magiemeisterschaft: für die Schulen, unter denen der Charakter sie führt (unbekannt → alle)
 * - Meisterschaften anderer Fertigkeiten (z. B. Arkane Kunde, Empathie) und Stärken: für alle Zauber, die Lage entscheidet der Spieler
 */
export function giltFuerSchule(k: Katalog, cw: CharakterWirkung, schule: string): boolean {
  if (cw.quelleTyp !== 'meisterschaft') return true;
  const f = k.get(cw.quelle)?.daten.fertigkeit as string | undefined;
  if (f === ALLGEMEINE_MAGIE) return !cw.schulen?.length || cw.schulen.includes(schule);
  const fe = f ? k.get(f) : undefined;
  if (fe?.typ === 'fertigkeit' && fe.daten.kategorie === 'Magieschule') return fe.name === schule;
  return true;
}

/** Änderung der Fokuskosten: nicht verzehrter Anteil (erschöpft bzw. kanalisiert) und verzehrter Anteil, mit Vorzeichen */
export interface KostenDelta { erschoepft: number; kanalisiert: number; verzehrt: number }

/**
 * Kostenangabe einer Wirkung → Änderung für einen Zauber. „(K)“ heißt: kanalisiert, wenn der Zauber kanalisiert ist.
 * „4V1 oder K3V1“ → die Variante, die zum Zauber passt. Zahl allein → Punkte im nicht verzehrten Anteil.
 * Nicht berechenbar (z. B. „halbe Kosten“, „2 je GK über 6“) → null.
 */
export function kostenDelta(art: string, wert: unknown, zauberKanalisiert: boolean): KostenDelta | null {
  const vz = art === 'kosten_gesenkt' ? -1 : art === 'kosten_erhoeht' ? 1 : 0;
  if (!vz) return null;
  let gesamt: number; let verzehrt = 0; let kanal = zauberKanalisiert;
  if (typeof wert === 'number') gesamt = wert;
  else {
    const varianten = String(wert ?? '').split(/\s+oder\s+/).map(v => v.trim());
    const v = varianten.find(x => /^K/.test(x) === zauberKanalisiert) ?? varianten[0];
    const m = v.match(/^(\(K\)|K)?(\d+)(?:V(\d+))?$/);
    if (!m) return null;
    if (m[1] === 'K') kanal = true;
    gesamt = Number(m[2]); verzehrt = m[3] ? Number(m[3]) : 0;
    if (verzehrt > gesamt) return null;
  }
  const rest = gesamt - verzehrt;
  const n = (x: number) => (x === 0 ? 0 : x);
  return { erschoepft: n(kanal ? 0 : vz * rest), kanalisiert: n(kanal ? vz * rest : 0), verzehrt: n(vz * verzehrt) };
}

export interface FokusKosten { isChanneled: boolean; exhausted: number; channeled: number; consumed: number; total: number; raw: string }

/**
 * Kostenänderungen auf die Grundkosten anwenden. Kein Anteil fällt unter 0; eine Senkung des verzehrten Anteils, die der Zauber
 * nicht hat, geht auf den übrigen Anteil. Gesamtkosten mindestens 1, wenn der Zauber etwas kostet (Mindestkosten).
 */
export function kostenAnwenden<T extends FokusKosten>(basis: T, deltas: KostenDelta[]): T {
  if (!deltas.length) return basis;
  let e = basis.exhausted; let c = basis.channeled; let v = basis.consumed;
  for (const d of deltas) {
    v += d.verzehrt;
    let uebrig = d.erschoepft + d.kanalisiert;
    if (v < 0) { uebrig += v; v = 0; }
    if (basis.isChanneled || d.kanalisiert) c += uebrig; else e += uebrig;
    if (e < 0) { c += e; e = 0; }
    if (c < 0) { e += c; c = 0; if (e < 0) e = 0; }
  }
  if (basis.total > 0 && e + c + v < 1) { if (basis.isChanneled) c = 1; else e = 1; }
  return { ...basis, exhausted: e, channeled: c, consumed: v, total: e + c + v, isChanneled: basis.isChanneled || c > 0 };
}

export interface ZauberAnpassung {
  /** Eintrags-ID der Quelle: alle Anpassungen einer Meisterschaft werden gemeinsam gewählt */
  id: string;
  quelle: string;
  /** kosten/dauer: anklickbar und verrechnet; hinweis: nur anzeigen */
  art: 'kosten' | 'dauer' | 'hinweis';
  text: string;
  bedingung?: string | null;
  beleg: string;
  kosten?: KostenDelta;
  /** Änderung der Zauberdauer */
  dauer?: { wert: number; einheit: 'ticks' | 'minuten' };
}

const B_HINWEIS = new Set(['schwierigkeit', 'wirkungsdauer', 'reichweite', 'erfolgsgrade', 'zauberschaden', 'zauberkosten', 'zauberdauer']);

/**
 * Wirkungen auf Zaubermechanik (Kosten, Zauberdauer, Schwierigkeit, Reichweite …) für einen Zauber dieser Schule.
 * Alle hängen von einer Lage oder einer Wahl des Spielers ab (z. B. „für Bannzauber des Typus Konter“, Auge des Zauberers):
 * Kosten und Zauberdauer sind deshalb anklickbar, der Rest wird als Hinweis gezeigt. Würfelboni stehen bei situativeBoni().
 */
export function zauberAnpassungen(k: Katalog, liste: CharakterWirkung[], schule: string, zauberKanalisiert: boolean): ZauberAnpassung[] {
  const out: ZauberAnpassung[] = [];
  liste.forEach(cw => {
    const w = cw.wirkung;
    if (!B_HINWEIS.has(String(w.bezug)) || w.art === 'schaden') return;
    if (!giltFuerSchule(k, cw, schule)) return;
    // Kosten und Zauberdauer derselben Meisterschaft gehören zusammen (z. B. Auge des Zauberers: +5 Ticks und (K)4V2) → gleiche id
    const basis = { id: cw.quelle, quelle: cw.quelleName, bedingung: w.bedingung, beleg: w.beleg };
    if (w.bezug === 'zauberkosten') {
      const d = kostenDelta(w.art, w.wert, zauberKanalisiert);
      const text = `Kosten ${w.art === 'kosten_gesenkt' ? '−' : '+'}${w.wert}`;
      out.push(d ? { ...basis, art: 'kosten', text, kosten: d } : { ...basis, art: 'hinweis', text });
      return;
    }
    if (w.bezug === 'zauberdauer' && typeof w.wert === 'number' && (w.einheit === 'ticks' || w.einheit === 'minuten')
      && (w.art === 'wert_erhoeht' || w.art === 'wert_gesenkt')) {
      const wert = w.art === 'wert_gesenkt' ? -w.wert : w.wert;
      out.push({ ...basis, art: 'dauer', text: `Zauberdauer ${wert > 0 ? '+' : '−'}${Math.abs(wert)} ${w.einheit === 'ticks' ? 'Ticks' : 'Minuten'}`, dauer: { wert, einheit: w.einheit } });
      return;
    }
    out.push({ ...basis, art: 'hinweis', text: wirkungKurz(w) });
  });
  return out;
}

/** Zauberdauer („9 Ticks“, „5 Minuten“) um gewählte Änderungen gleicher Einheit anpassen (mindestens 1); andere Angaben bleiben */
export function zauberdauerAnpassen(zauberdauer: string | undefined, aenderungen: { wert: number; einheit: 'ticks' | 'minuten' }[]): string | undefined {
  const m = (zauberdauer ?? '').match(/^(\d+)\s*(Ticks?|Minuten?)\b/i);
  if (!m || !aenderungen.length) return zauberdauer;
  const einheit = /^tick/i.test(m[2]) ? 'ticks' : 'minuten';
  const summe = aenderungen.filter(a => a.einheit === einheit).reduce((s, a) => s + a.wert, 0);
  if (!summe) return zauberdauer;
  const n = Math.max(1, Number(m[1]) + summe);
  return `${n} ${einheit === 'ticks' ? (n === 1 ? 'Tick' : 'Ticks') : (n === 1 ? 'Minute' : 'Minuten')}`;
}
