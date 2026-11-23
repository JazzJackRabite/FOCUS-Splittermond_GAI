/**
 * Begleiter aus dem Katalog:
 * - Tiergefährten über die Ressource Kreatur (GRW S. 78; Bestienmeister): Kreaturen und Tiere, deren Merkmal „Kreatur N“ höchstens
 *   der Ressourcenstufe entspricht. Werte direkt aus dem Wertekasten oder aus daten.werte_berechnet („Werte wie … mit Änderungen“).
 * - Beschworene Wesen (Die Magie S. 186–191): verfügbare Dienste über verfuegbareDienste().
 */
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';
import { gesperrteDienste, verfuegbareDienste, type GesperrterDienst, type VerfuegbarerDienst } from './dienste';
import { meisterschaftId } from './bruecke';
import { erfuellt, type BedingungsCharakter, type Traeger } from './bedingungen';
import type { Ergebnis } from './typen';
import type { Begleiter, Mastery } from '../types';

export interface Wertekasten {
  attribute?: Record<string, string>;
  abgeleitete_werte?: Record<string, string>;
  waffen?: { name: string; wert: string; schaden: string; wgs: string; ini: string; merkmale: string }[];
  felder?: Record<string, string>;
  berechnet?: boolean;
}

export function wertekasten(e: Eintrag): Wertekasten | null {
  const d = e.daten.werte_berechnet ?? e.daten;
  if (!d.abgeleitete_werte) return null;
  return { attribute: d.attribute, abgeleitete_werte: d.abgeleitete_werte, waffen: d.waffen, felder: d.felder, berechnet: !!e.daten.werte_berechnet };
}

/** nötige Stufe der Ressource Kreatur (Datenseite: `ressource_kreatur`); null = kein Tiergefährte */
export function kreaturStufe(e: Eintrag): number | null {
  const d = e.daten.werte_berechnet ?? e.daten;
  return typeof d.ressource_kreatur === 'number' ? d.ressource_kreatur : null;
}

export interface Tiergefaehrte { id: string; name: string; stufe: number; typus: string; quelle: string; eintrag: Eintrag }

/** Alle Tiergefährten im Katalog (mit Werten und Merkmal Kreatur), sortiert nach Stufe und Name */
export function tiergefaehrten(k: Katalog): Tiergefaehrte[] {
  return Object.values(k.eintraege)
    .filter(e => (e.typ === 'kreatur' || e.typ === 'tier') && wertekasten(e) && kreaturStufe(e) !== null)
    .map(e => ({ id: e.id, name: e.name, stufe: kreaturStufe(e)!, typus: String((e.daten.werte_berechnet ?? e.daten).felder?.typus ?? ''),
      quelle: k.pakete[e.quelle.paket]?.kuerzel ?? e.quelle.paket, eintrag: e }))
    .sort((a, b) => a.stufe - b.stufe || a.name.localeCompare(b.name, 'de'));
}

export interface BeschwoerbaresWesen { id: string; name: string; stufe: number; quelle: string; mitWerten: boolean }

export function beschwoerbareWesen(k: Katalog): BeschwoerbaresWesen[] {
  return Object.values(k.eintraege)
    // ohne die Korpusse des Wesen-Baukastens: die sind Bausteine, keine fertigen Wesen
    .filter(e => e.typ !== 'wesen_baukasten_basis' && e.daten.beschwoerbares_wesen_stufe !== undefined && e.daten.beschwoerbares_wesen_stufe !== null)
    .map(e => ({ id: e.id, name: e.name, stufe: Number(e.daten.beschwoerbares_wesen_stufe), quelle: k.pakete[e.quelle.paket]?.kuerzel ?? e.quelle.paket, mitWerten: !!wertekasten(e) }))
    .sort((a, b) => a.stufe - b.stufe || a.name.localeCompare(b.name, 'de'));
}

/** Dienste eines Wesens für einen Zauberer mit diesen Meisterschaften (Editor-Format) */
export function diensteFuer(k: Katalog, wesen: string, meisterschaften: Record<string, Mastery[]>, dienstexperte: string[] = []): VerfuegbarerDienst[] {
  const ids: string[] = [];
  for (const [skill, liste] of Object.entries(meisterschaften)) for (const m of liste) { const i = meisterschaftId(k, m.name, skill); if (i) ids.push(i); }
  return verfuegbareDienste(k, wesen, ids, dienstexperte);
}

/** Erweiterte Dienste des Wesens, die dieser Zauberer (noch) nicht hat, mit Grund */
export function gesperrteDiensteFuer(k: Katalog, wesen: string, meisterschaften: Record<string, Mastery[]>): GesperrterDienst[] {
  const ids: string[] = [];
  for (const [skill, liste] of Object.entries(meisterschaften)) for (const m of liste) { const i = meisterschaftId(k, m.name, skill); if (i) ids.push(i); }
  return gesperrteDienste(k, wesen, ids);
}

// ---------------------------------------------------------------- Tiere: Typus, Potenzial, Abrichtungen (Bestienmeister S. 15–23)

/** Typus-Liste des Wertekastens („Katzenartiger, Reittier, Tier“ → [..]) */
export function typusListe(e: Eintrag): string[] {
  const d = e.daten.werte_berechnet ?? e.daten;
  return String(d.felder?.typus ?? '').split(',').map((x: string) => x.trim()).filter(Boolean);
}

/** Alle Tiere mit Werten: Tiergefährten (Merkmal Kreatur N) und weitere Tiere (Typus Tier), z. B. gekaufte Reittiere */
export function alleTiere(k: Katalog): Tiergefaehrte[] {
  return Object.values(k.eintraege)
    .filter(e => (e.typ === 'kreatur' || e.typ === 'tier') && wertekasten(e) && (kreaturStufe(e) !== null || typusListe(e).includes('Tier')))
    .map(e => ({ id: e.id, name: e.name, stufe: kreaturStufe(e) ?? 0, typus: typusListe(e).join(', '),
      quelle: k.pakete[e.quelle.paket]?.kuerzel ?? e.quelle.paket, eintrag: e }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de') || a.quelle.localeCompare(b.quelle, 'de'));
}

/** Regeln zum Potenzial von Tieren aus dem Paket (Bestienmeister S. 15: `strukturiert.potenzial`); ohne Grimoire keine */
export interface PotenzialRegeln {
  grundwert: number; kreaturJePunkt: number; tiervertrauter: number;
  qualitaeten: { name: string; potenzial: number }[];
  meisterschaften: { ref: string; bonus: number; jeWahl?: boolean; nurKreatur?: boolean }[];
}
const POTENZIAL_CACHE = new WeakMap<Katalog, PotenzialRegeln | null>();
export function potenzialRegeln(k: Katalog | null): PotenzialRegeln | null {
  if (!k) return null;
  if (POTENZIAL_CACHE.has(k)) return POTENZIAL_CACHE.get(k)!;
  const p = Object.values(k.eintraege).map(e => e.daten.strukturiert?.potenzial).find(Boolean);
  const r: PotenzialRegeln | null = p ? {
    grundwert: p.grundwert, kreaturJePunkt: p.kreatur_je_punkt, tiervertrauter: p.tiervertrauter,
    qualitaeten: p.qualitaeten ?? [],
    meisterschaften: (p.meisterschaften ?? []).map((m: { ref: string; bonus: number; je_wahl?: boolean; nur_kreatur?: boolean }) => ({ ref: m.ref, bonus: m.bonus, jeWahl: m.je_wahl, nurKreatur: m.nur_kreatur })),
  } : null;
  POTENZIAL_CACHE.set(k, r);
  return r;
}

/** Qualität gekaufter Tiere → Grundpotenzial; gleiche Potenziale zusammengefasst („Wildtier / Unausgebildet / Einfach“) */
export function tierQualitaeten(k: Katalog | null): { name: string; potenzial: number }[] {
  const r = potenzialRegeln(k); if (!r) return [];
  const m = new Map<number, string[]>();
  for (const q of r.qualitaeten) m.set(q.potenzial, [...(m.get(q.potenzial) ?? []), q.name]);
  return [...m].map(([potenzial, n]) => ({ name: n.join(' / '), potenzial }));
}

export interface AbrichtungsInfo {
  id: string; name: string; gruppe: string; kosten: number; beschreibung: string;
  /** höchstens so oft wählbar (Infinity = beliebig oft) */
  hoechstens: number; mehrfachText: string | null;
  /** einmal je Heldengrad des Besitzers */
  jeHeldengrad: boolean;
  /** Grundausbildung: wird über die Abrichtung „Grundausbildung“ erlernt (kostet 1, braucht deren Voraussetzung) */
  grundausbildung: boolean;
  voraussetzung: { text: string; bedingung: unknown } | null;
  quelle: string; seite?: number;
}

/** Grenze der Mehrfachwahl (Datenseite: `mehrfach_grenze`): Anzahl, beliebig, je Heldengrad; ohne Angabe 1 */
export function mehrfachGrenze(g: { anzahl?: number; beliebig?: boolean; je_heldengrad?: boolean; spielleitung?: boolean } | null | undefined, heldengrad: number): number {
  if (!g) return 1;
  if (g.anzahl) return g.anzahl;
  if (g.je_heldengrad) return heldengrad;
  return Infinity; // beliebig, oder die Grenze hängt von der Wahl ab (Spielleitung)
}

/** Alle Abrichtungen im Katalog (leer ohne Grimoire „Bestienmeister“) */
export function abrichtungen(k: Katalog): AbrichtungsInfo[] {
  const alle = Object.values(k.eintraege).filter(e => e.typ === 'abrichtung');
  // Sammel-Abrichtung einer Gruppe (Datenseite: sammel_fuer_gruppe): ihre Voraussetzungen gelten für jede Abrichtung der Gruppe
  const grund = alle.find(e => typeof e.daten.sammel_fuer_gruppe === 'string');
  const gruppeGrund = grund?.daten.sammel_fuer_gruppe as string | undefined;
  return alle.map(e => {
    const d = e.daten;
    const ga = !!d.tabellenzeile || (!!gruppeGrund && d.gruppe === gruppeGrund);
    let v = d.voraussetzungen && typeof d.voraussetzungen === 'object' && 'bedingung' in d.voraussetzungen ? d.voraussetzungen : null;
    const gv = grund?.daten.voraussetzungen;
    if (ga && gv?.bedingung) v = v ? { text: `${gv.text}, ${v.text}`, bedingung: { alle: [gv.bedingung, v.bedingung] } } : gv;
    return {
      id: e.id, name: e.name, gruppe: String(d.gruppe ?? ''), beschreibung: String(d.beschreibung ?? ''),
      kosten: typeof d.potenzial_kosten === 'number' ? d.potenzial_kosten : 1,
      hoechstens: ga ? 1 : mehrfachGrenze(d.mehrfach_grenze, 4), mehrfachText: d.mehrfach ?? null, jeHeldengrad: !ga && !!d.mehrfach_grenze?.je_heldengrad,
      grundausbildung: ga, voraussetzung: v ?? null,
      quelle: k.pakete[e.quelle.paket]?.kuerzel ?? e.quelle.paket, seite: e.quelle.buch_seiten?.[0],
    };
  }).filter(a => a.id !== grund?.id) // die Sammel-Abrichtung selbst nicht anbieten
    .sort((a, b) => a.gruppe.localeCompare(b.gruppe, 'de') || a.name.localeCompare(b.name, 'de'));
}

/** Tier als Träger für Bedingungen mit "traeger": "tier" (Abrichtungen, Typus, Größenklasse, Fertigkeiten) */
export function tierTraeger(k: Katalog, b: Begleiter, bisIndex?: number): Traeger {
  const e = k.get(b.id);
  const d = e ? (e.daten.werte_berechnet ?? e.daten) : {};
  const werte: Record<string, number> = {};
  for (const f of d.fertigkeiten_refs ?? []) if (f?.id && typeof f.wert === 'number') werte[f.id] = f.wert;
  const gk = Number.parseInt(String(d.abgeleitete_werte?.GK ?? ''), 10);
  const ab = (b.abrichtungen ?? []).slice(0, bisIndex ?? undefined);
  return { hat: ab, werte, typus: e ? typusListe(e) : [], gk: Number.isFinite(gk) ? gk : null };
}

const WAHL = ['erste Wahl', 'zweite Wahl', 'dritte Wahl', 'vierte Wahl', 'fünfte Wahl'];

/** Prüft die Voraussetzung einer Abrichtung für den Tierführer (char) und sein Tier. n = wievielte Wahl (0 = erste). */
export function pruefeAbrichtung(k: Katalog, a: AbrichtungsInfo, char: BedingungsCharakter, tier: Traeger, n = 0): Ergebnis {
  if (!a.voraussetzung) return true;
  return erfuellt({ ...char, tier, stufe: WAHL[n] ?? WAHL[WAHL.length - 1] }, a.voraussetzung.bedingung, k);
}

export interface PotenzialPosten { text: string; wert: number }

/** Potenzial eines Tieres (Bestienmeister S. 15) mit Aufschlüsselung */
export function potenzial(k: Katalog, b: Begleiter, meisterschaftsIds: string[]): { gesamt: number; posten: PotenzialPosten[] } {
  const r = potenzialRegeln(k);
  if (!r) return { gesamt: 0, posten: [] };
  const posten: PotenzialPosten[] = [];
  const q = tierQualitaeten(k).find(x => x.potenzial === (b.qualitaet ?? r.grundwert));
  const grund = b.qualitaet ?? r.grundwert;
  posten.push({ text: b.qualitaet && b.qualitaet > r.grundwert ? `Grundwert (${q?.name ?? 'Qualität'})` : 'Grundwert', wert: grund });
  if (b.kreatur) posten.push({ text: `Ressource Kreatur ${b.kreatur}`, wert: r.kreaturJePunkt * b.kreatur });
  if (b.vertrauter) posten.push({ text: 'Vertrauter', wert: r.tiervertrauter });
  for (const m of r.meisterschaften) {
    const n = meisterschaftsIds.filter(i => i === m.ref).length;
    if (!n || (m.nurKreatur && !b.kreatur)) continue;
    const name = k.get(m.ref)?.name ?? m.ref;
    const mal = m.jeWahl ? n : 1;
    posten.push({ text: `${name}${mal > 1 ? ` ×${mal}` : ''}${m.nurKreatur ? ' (Kreatur)' : ''}`, wert: m.bonus * mal });
  }
  return { gesamt: posten.reduce((s, p) => s + p.wert, 0), posten };
}

/** Kosten der gewählten Abrichtungen in Potenzialpunkten */
export function potenzialVerbraucht(liste: AbrichtungsInfo[], gewaehlt: string[]): number {
  const m = new Map(liste.map(a => [a.id, a]));
  return gewaehlt.reduce((s, i) => s + (m.get(i)?.kosten ?? 1), 0);
}

/** Reittier: Typus Reittier oder eine Abrichtung, nach der das Tier geritten werden kann (Datenseite: macht_reittier) */
export function istReittier(k: Katalog, b: Begleiter): boolean {
  const e = k.get(b.id);
  return (e ? typusListe(e).includes('Reittier') : false) || (b.abrichtungen ?? []).some(i => !!k.get(i)?.daten.macht_reittier);
}

/** Stufe eines beschwörbaren Wesens (null, wenn nicht angegeben) */
export function wesenStufe(e: Eintrag | undefined): number | null {
  const s = Number(e?.daten.beschwoerbares_wesen_stufe);
  return Number.isFinite(s) && s > 0 ? s : null;
}
