/**
 * Listen des Grundregelwerks aus dem GRW-Paket (FUNDAMENT.md, Regelquellen): Zauber, Meisterschaften, Stärken,
 * Schwächen, Ressourcen, Sprachen, Mondzeichen, Fertigkeiten mit ihren Attributen und die Meisterschaftsschwellen.
 * Der Editor startet erst mit geladenem Paket (app/RegelwerkTor.tsx); ohne Paket liefern die Funktionen leere Listen.
 */
import { aktiverKatalog, norm } from './bruecke';
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';
import type { Spell } from '../types/regeldaten';
import type { MasteryEntry } from '../types/regeldaten';
import type { StrengthData } from '../types/regeldaten';
import type { ResourceData } from '../types/regeldaten';
import type { ItemEntry, Money } from '../types';
import type { LanguageData } from '../types/regeldaten';
import type { RaceData } from '../types';
import { RASSE_ID } from './bruecke';
import { gesundheitsstufen } from './vitals';

export interface Schwaeche { name: string; desc: string; page?: number; source: string }
/** Wie oft eine Stärke gewählt werden kann (Paket: `daten.mehrfach_waehlbar`) */
export interface MehrfachWaehlbar { anzahl?: number | null; je?: string; je_heldengrad?: number; hoechstbonus?: number; beleg: string; auslegung?: string }

interface Listen {
  zauber: Spell[];
  meisterschaften: Record<string, MasteryEntry[]>;
  allgemeinKampf: MasteryEntry[];
  allgemeinMagie: MasteryEntry[];
  staerken: StrengthData[];
  schwaechen: Schwaeche[];
  ressourcen: ResourceData[];
  sprachen: LanguageData[];
  mondzeichen: string[];
  fertigkeiten: { allgemein: string[]; kampf: string[]; magie: string[]; attribute: Record<string, string[] | null> };
  schwellen: Record<number, number>;
}

const CACHE = new WeakMap<Katalog, Listen | null>();
const SCHWELLEN_ID = 'grw:regel:fertigkeiten-regeln:meisterschaften-erhalten';
const ALLG_KAMPF = new Set(['Allgemeine Nahkampfmeisterschaften', 'Allgemeine Kampfmeisterschaften']);
const ALLG_MAGIE = 'Allgemeine Magiemeisterschaften';
/** Abkürzungen der Attribute im Editor */
const ATTR_KURZ: Record<string, string> = { Ausstrahlung: 'AUS', Beweglichkeit: 'BEW', Intuition: 'INT', Konstitution: 'KON', Mystik: 'MYS', Stärke: 'STA', Verstand: 'VER', Willenskraft: 'WIL' };
/** Schreibweise des Editors für Fertigkeiten mit „und“ im Paket */
const ANZEIGE: Record<string, string> = { 'Geschichte und Mythen': 'Geschichte & Mythen', 'Schlösser und Fallen': 'Schlösser & Fallen' };

const seite = (e: Eintrag) => (e.quelle.buch_seiten ?? [])[0];
const zahl = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/** Höchstzahl für die Stufenauswahl einer Stärke: aus `mehrfach_waehlbar`, sonst 1 */
export function staerkeHoechstens(m: MehrfachWaehlbar | undefined, heldengradeAnzahl = 4): { max: number; multi: boolean } {
  if (!m) return { max: 1, multi: false };
  if (m.je) return { max: 1, multi: true };                       // jede Wahl für ein anderes Ziel (Typus, Kultur)
  if (m.je_heldengrad) return { max: m.je_heldengrad * heldengradeAnzahl, multi: true };
  if (typeof m.anzahl === 'number') return { max: m.anzahl, multi: true };
  return { max: 20, multi: true };                                 // „beliebig oft wählbar“
}

function ausPaket(k: Katalog): Listen | null {
  const basis = k.manifest.basis_paket;
  const E = Object.values(k.eintraege).filter((e) => e.quelle.paket === basis && e.aktion === 'neu');
  if (!E.some((e) => e.typ === 'zauber')) return null;
  const name = new Map(E.filter((e) => e.typ === 'fertigkeit' || e.typ === 'meisterschaftsgruppe').map((e) => [e.id, e.name]));
  const kurz = k.pakete[basis]?.kuerzel ?? 'GRW';
  const schwellenTabelle: { schwelle: number; fertigkeitspunkte: number }[] = k.get(SCHWELLEN_ID)?.daten.strukturiert?.schwellen ?? [];
  const schwellen = Object.fromEntries(schwellenTabelle.map((s) => [s.schwelle, s.fertigkeitspunkte]));
  const L: Listen = { zauber: [], meisterschaften: {}, allgemeinKampf: [], allgemeinMagie: [], staerken: [], schwaechen: [], ressourcen: [], sprachen: [], mondzeichen: [],
    fertigkeiten: { allgemein: [], kampf: [], magie: [], attribute: {} }, schwellen };
  const nachName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'de');
  const heldengradeAnzahl = (k.get('grw:regel:steigerung-regeln:auswirkungen')?.daten.strukturiert?.heldengrade ?? []).length || 4;
  for (const e of E) {
    const d = e.daten;
    if (e.typ === 'zauber') {
      const beschreibung = [d.wirkung, d.erfolgsgrade ? `Erfolgsgrade:\n${d.erfolgsgrade}` : ''].filter(Boolean).join('\n\n');
      const sw = d.schwierigkeit_strukturiert as { art?: string; wert?: number } | undefined;
      for (const s of d.schulen ?? []) {
        if (s.grad === null || s.grad === undefined) continue;
        L.zauber.push({ name: e.name, school: name.get(s.id) ?? s.schule, grade: zahl(s.grad), cost: String(d.kosten ?? ''), castTime: d.zauberdauer,
          range: d.reichweite, duration: d.wirkungsdauer ?? '', target: (d.typus ?? []).join(', '), description: beschreibung, damage: '', source: kurz, page: seite(e),
          difficulty: d.schwierigkeit ?? undefined,
          ...(sw?.art ? { difficultyType: sw.art as Spell['difficultyType'], ...(sw.wert !== undefined ? { difficultyValue: sw.wert } : {}) } : {}) });
      }
    } else if (e.typ === 'meisterschaft') {
      const schwelle = zahl(d.schwelle, 1);
      const fertigkeit = name.get(d.fertigkeit) ?? d.fertigkeit_name ?? '';
      const m: MasteryEntry & { regelId: string } = { name: `${e.name} (S${schwelle})`, baseName: e.name, page: seite(e), source: kurz,
        desc: `${d.manoever ? '[Manöver] ' : ''}${d.beschreibung ?? ''}`, tier: schwelle, minSkillValue: schwellen[schwelle] ?? undefined,
        skill: fertigkeit, manoever: d.manoever === true, prerequisiteText: d.voraussetzungen?.text ?? null, prerequisite: null, prerequisiteStatus: null,
        id: e.id, regelId: e.id, ...(d.mehrfach_waehlbar ? { mehrfach: true } : {}) };
      if (ALLG_KAMPF.has(fertigkeit)) L.allgemeinKampf.push(m);
      else if (fertigkeit === ALLG_MAGIE) L.allgemeinMagie.push(m);
      else (L.meisterschaften[fertigkeit] ??= []).push(m);
    } else if (e.typ === 'staerke') {
      const { max, multi } = staerkeHoechstens(d.mehrfach_waehlbar, heldengradeAnzahl);
      L.staerken.push({ name: e.name, cost: zahl(d.stufe, 1), max, desc: d.beschreibung ?? '', multi, source: kurz, page: seite(e), onlyCreation: d.nur_bei_generierung === true });
    } else if (e.typ === 'schwaeche') {
      L.schwaechen.push({ name: e.name, desc: d.beschreibung ?? '', page: seite(e), source: kurz });
    } else if (e.typ === 'ressource') {
      const t = d.tabelle as { zeilen?: { punkte?: number; werte: string[] }[] } | undefined;
      // offene Tabelle („jeder weitere Punkt“, Gefolge) hat keine oberste Stufe aus der Tabelle → allgemeine Grenze
      const offen = (t?.zeilen ?? []).some((z) => typeof z.punkte !== 'number');
      const punkte = offen ? [] : (t?.zeilen ?? []).map((z) => z.punkte).filter((p): p is number => typeof p === 'number');
      const stufen = t?.zeilen?.length ? `\n\nStufenübersicht:\n${t.zeilen.map((z) => `Stufe ${z.werte[0]}: ${z.werte.slice(1).join(' - ')}`).join('\n')}` : '';
      L.ressourcen.push({ name: e.name, source: kurz, page: seite(e) ?? 0, desc: `${d.beschreibung ?? ''}${stufen}`,
        ...(punkte.length ? { maxStufe: Math.max(...punkte) } : {}), ...(d.mehrfach_erwerbbar ? { mehrfach: true } : {}) });
    } else if (e.typ === 'sprache') {
      L.sprachen.push({ name: e.name, source: kurz, page: seite(e) ?? 0, family: d.untergruppe ?? d.familie ?? undefined });
    } else if (e.typ === 'mondzeichen') {
      L.mondzeichen.push(e.name);
    } else if (e.typ === 'fertigkeit') {
      const n = ANZEIGE[e.name] ?? e.name;
      const art = d.kategorie === 'Magieschule' ? 'magie' : d.kategorie === 'Kampffertigkeit' ? 'kampf' : 'allgemein';
      L.fertigkeiten[art].push(n);
      L.fertigkeiten.attribute[n] = Array.isArray(d.attribute) ? d.attribute.map((a: string) => ATTR_KURZ[a] ?? a) : null;
    }
  }
  L.zauber.sort((a, b) => a.school.localeCompare(b.school, 'de') || a.grade - b.grade || a.name.localeCompare(b.name, 'de'));
  for (const l of [L.allgemeinKampf, L.allgemeinMagie, ...Object.values(L.meisterschaften)]) l.sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0) || nachName(a, b));
  for (const l of [L.staerken, L.schwaechen, L.ressourcen, L.sprachen]) l.sort(nachName);
  L.mondzeichen.sort((a, b) => a.localeCompare(b, 'de'));
  for (const l of [L.fertigkeiten.allgemein, L.fertigkeiten.kampf, L.fertigkeiten.magie]) l.sort((a, b) => a.localeCompare(b, 'de'));
  return L;
}

function listen(k: Katalog | null): Listen | null {
  if (!k) return null;
  if (!CACHE.has(k)) CACHE.set(k, ausPaket(k));
  return CACHE.get(k) ?? null;
}

/** Meisterschaften je Fertigkeit; „Geschichte & Mythen“ und „Geschichte und Mythen“ finden dieselbe Liste */
function mitAliasen(r: Record<string, MasteryEntry[]>): Record<string, MasteryEntry[]> {
  return new Proxy(r, {
    get(t, p, rec) {
      if (typeof p === 'string' && !(p in t)) {
        const a = p.replace(/\s+&\s+/g, ' und '); if (a in t) return t[a];
        const b = p.replace(/\s+und\s+/g, ' & '); if (b in t) return t[b];
      }
      return Reflect.get(t, p, rec);
    },
    has(t, p) { return typeof p === 'string' ? p in t || p.replace(/\s+&\s+/g, ' und ') in t || p.replace(/\s+und\s+/g, ' & ') in t : Reflect.has(t, p); },
  });
}
const MEISTER_CACHE = new WeakMap<Listen, Record<string, MasteryEntry[]>>();

export const grwZauber = (k: Katalog | null = aktiverKatalog()): Spell[] => listen(k)?.zauber ?? [];
export function grwMeisterschaften(k: Katalog | null = aktiverKatalog()): Record<string, MasteryEntry[]> {
  const l = listen(k); if (!l) return {};
  if (!MEISTER_CACHE.has(l)) MEISTER_CACHE.set(l, mitAliasen(l.meisterschaften));
  return MEISTER_CACHE.get(l)!;
}
export const grwAllgemeineKampfmeisterschaften = (k: Katalog | null = aktiverKatalog()): MasteryEntry[] => listen(k)?.allgemeinKampf ?? [];
export const grwAllgemeineMagiemeisterschaften = (k: Katalog | null = aktiverKatalog()): MasteryEntry[] => listen(k)?.allgemeinMagie ?? [];
export const grwStaerken = (k: Katalog | null = aktiverKatalog()): StrengthData[] => listen(k)?.staerken ?? [];
export const grwSchwaechen = (k: Katalog | null = aktiverKatalog()): Schwaeche[] =>
  listen(k)?.schwaechen ?? [];
export const grwRessourcen = (k: Katalog | null = aktiverKatalog()): ResourceData[] => listen(k)?.ressourcen ?? [];
export const grwSprachen = (k: Katalog | null = aktiverKatalog()): LanguageData[] => listen(k)?.sprachen ?? [];
export const grwMondzeichen = (k: Katalog | null = aktiverKatalog()): string[] => listen(k)?.mondzeichen ?? [];
/** Fertigkeiten nach Art (allgemein, Kampf, Magie) in der Schreibweise des Editors */
export function grwFertigkeiten(k: Katalog | null = aktiverKatalog()): { allgemein: string[]; kampf: string[]; magie: string[] } {
  const l = listen(k); return l ? l.fertigkeiten : { allgemein: [], kampf: [], magie: [] };
}
/** Attribute einer Fertigkeit (Abkürzungen); null bei Kampffertigkeiten (Attribute kommen von der Waffe) */
export function grwFertigkeitsattribute(k: Katalog | null = aktiverKatalog()): Record<string, string[] | null> {
  return listen(k)?.fertigkeiten.attribute ?? {};
}
/** Fertigkeitswert, ab dem Meisterschaften einer Schwelle gewählt werden können (GRW: Meisterschaften erhalten) */
export function schwellenwert(schwelle: number, k: Katalog | null = aktiverKatalog()): number {
  const w = listen(k)?.schwellen[schwelle];
  if (typeof w === 'number') return w;
  return 0; // ohne Paket keine Schwelle
}
/** Eintrag einer Stärke mit `mehrfach_waehlbar` (Beleg und ggf. Auslegung für die Anzeige) */
export function staerkeMehrfach(name: string, k: Katalog | null = aktiverKatalog()): MehrfachWaehlbar | undefined {
  if (!k) return undefined;
  const n = norm(name.replace(/\s*\(.*\)\s*$/, ''));
  return Object.values(k.eintraege).find((e) => e.typ === 'staerke' && norm(e.name) === n)?.daten.mehrfach_waehlbar;
}

const TEXTE = new WeakMap<object, { schwaecheText: Record<string, string>; schwaecheSeite: Record<string, number>; ressourceText: Record<string, string>; schwaecheNamen: string[] }>();
function texte(k: Katalog | null) {
  const schl = (listen(k) ?? TEXTE) as object;
  if (!TEXTE.has(schl)) {
    const sw = grwSchwaechen(k);
    TEXTE.set(schl, {
      schwaecheText: Object.fromEntries(sw.map((s) => [s.name, s.desc])),
      schwaecheSeite: Object.fromEntries(sw.filter((s) => s.page !== undefined).map((s) => [s.name, s.page!])),
      ressourceText: Object.fromEntries(grwRessourcen(k).map((r) => [r.name, r.desc])),
      schwaecheNamen: sw.map((s) => s.name),
    });
  }
  return TEXTE.get(schl)!;
}
/** Beschreibung je Schwäche (Name → Text) */
export const grwSchwaechenTexte = (k: Katalog | null = aktiverKatalog()) => texte(k).schwaecheText;
/** Seite je Schwäche (Name → Buchseite) */
export const grwSchwaechenSeiten = (k: Katalog | null = aktiverKatalog()) => texte(k).schwaecheSeite;
/** Namen der Schwächen */
export const grwSchwaechenNamen = (k: Katalog | null = aktiverKatalog()) => texte(k).schwaecheNamen;
/** Beschreibung je Ressource (Name → Text mit Stufenübersicht) */
export const grwRessourcenTexte = (k: Katalog | null = aktiverKatalog()) => texte(k).ressourceText;

// ---------------------------------------------------------------- Rassen, Stärkenpunkte, Attribute, Gesundheitsstufen
const ERSCHAFFUNG_ID = 'grw:regel:erschaffung-regeln:uebersicht-ueber-die-charaktererschaffung';
const ATTRIBUTE_ID = 'grw:regel:abgeleitete-werte-regeln:berechnung-der-abgeleiteten-werte';
const RASSEN_CACHE = new WeakMap<Katalog, Record<string, RaceData> | null>();

/** Rassen im Format des Editors (Mensch, Alb, Zwerg, Gnom, Varg): Größenklasse, Attributsmodifikatoren, Rassenstärken */
export function grwRassen(k: Katalog | null = aktiverKatalog()): Record<string, RaceData> {
  if (!k) return {};
  if (!RASSEN_CACHE.has(k)) {
    const out: Record<string, RaceData> = {};
    for (const [editorName, id] of Object.entries(RASSE_ID)) {
      const d = k.get(id)?.daten; if (!d?.attributsmodifikatoren) continue;
      const am = d.attributsmodifikatoren as { fest?: Record<string, number>; frei?: { anzahl: number }[] };
      const zusatz = zahl(d.zusaetzliche_staerkepunkte);
      out[editorName] = {
        gk: zahl(d.groessenklasse),
        mods: Object.fromEntries(Object.entries(am.fest ?? {}).map(([a, v]) => [ATTR_KURZ[a] ?? a, v])),
        freeMods: (am.frei ?? []).reduce((n, f) => n + zahl(f.anzahl), 0),
        strengths: (d.staerken_refs ?? []).filter((r: { rassenstaerke?: boolean }) => r.rassenstaerke).map((r: { id: string; text: string }) => k.get(r.id)?.name ?? r.text),
        traits: zusatz ? [{ id: 'zusaetzliche_staerkenpunkte', label: 'Zusätzliche Stärkenpunkte', modifiers: { strengthPoints: zusatz } }] : [],
      };
    }
    RASSEN_CACHE.set(k, Object.keys(out).length ? out : null);
  }
  return RASSEN_CACHE.get(k) ?? {};
}

/** Punkte für Stärken bei der Erschaffung: Kultur + Ausbildung + Schritt 7 (GRW S. 23–27), dazu Punkte der Rasse */
export function staerkenBudget(rasse: string, k: Katalog | null = aktiverKatalog()): number {
  const s = k?.get(ERSCHAFFUNG_ID)?.daten.strukturiert as Record<string, { staerke_punkte?: number }> | undefined;
  const teile = s ? [s.kultur_frei?.staerke_punkte, s.ausbildung_frei?.staerke_punkte, s.schritt_7?.staerke_punkte] : [];
  const grund = teile.length && teile.every((x) => typeof x === 'number') ? teile.reduce((a, b) => a! + b!, 0)! : 0;
  const r = grwRassen(k)[rasse];
  return grund + (r?.traits ?? []).reduce((n, t) => n + (t.modifiers.strengthPoints ?? 0), 0);
}

/** Grenzen der freien Erschaffung aus dem Paket (GRW S. 22–25); ohne Paket 0 */
export interface ErschaffungsGrenzen {
  attributPunkte: number; attributMin: number; attributMax: number;
  fertigkeitPunkte: number; fertigkeitMax: number;
  /** Punkte, die auf Fertigkeiten ohne Magieschulen gehen müssen (Abstammung: keine Magieschulen) */
  nichtMagischMin: number;
  ressourcenPunkte: number; startMeisterschaften: number; sprachen: number;
}
export function erschaffungsGrenzen(k: Katalog | null = aktiverKatalog()): ErschaffungsGrenzen {
  type Teil = { fertigkeitspunkte?: number; ressourcenpunkte?: number; meisterschaften_schwelle_1?: number; magieschulen_erlaubt?: boolean };
  const s = k?.get(ERSCHAFFUNG_ID)?.daten.strukturiert as Record<string, Teil & Record<string, unknown>> | undefined;
  const z = (x: unknown) => (typeof x === 'number' ? x : 0);
  const teile = [s?.kultur_frei, s?.abstammung_frei, s?.ausbildung_frei, s?.schritt_7];
  const attr = s?.attribute as { punkte?: number; minimum?: number; maximum?: number } | undefined;
  return {
    attributPunkte: z(attr?.punkte), attributMin: z(attr?.minimum), attributMax: z(attr?.maximum),
    fertigkeitPunkte: teile.reduce((n, t) => n + z(t?.fertigkeitspunkte), 0),
    fertigkeitMax: z(s?.schritt_7?.fertigkeit_hoechstwert_spielbeginn),
    nichtMagischMin: s?.abstammung_frei?.magieschulen_erlaubt === false ? z(s.abstammung_frei.fertigkeitspunkte) : 0,
    ressourcenPunkte: teile.reduce((n, t) => n + z(t?.ressourcenpunkte), 0),
    startMeisterschaften: teile.reduce((n, t) => n + z(t?.meisterschaften_schwelle_1), 0),
    sprachen: Array.isArray((s?.feinschliff as { sprachen?: unknown[] } | undefined)?.sprachen) ? (s!.feinschliff as { sprachen: unknown[] }).sprachen.length : 0,
  };
}

/** Attribute (Kürzel des Editors → Name) */
export function grwAttribute(k: Katalog | null = aktiverKatalog()): Record<string, string> {
  const l: { name: string; kuerzel: string }[] | undefined = k?.get(ATTRIBUTE_ID)?.daten.strukturiert?.attribute;
  return l?.length ? Object.fromEntries(l.map((a) => [ATTR_KURZ[a.name] ?? a.kuerzel, a.name])) : {};
}

/** Alle Fertigkeiten (allgemein, Kampf, Magie), alphabetisch */
export function grwAlleFertigkeiten(k: Katalog | null = aktiverKatalog()): string[] {
  const f = grwFertigkeiten(k);
  return [...f.allgemein, ...f.kampf, ...f.magie].sort();
}

/** Gesundheitsstufen des Abenteurers: Name und Wundabzug (GRW S. 172) */
export function grwGesundheitsstufen(k: Katalog | null = aktiverKatalog()): { name: string; wundabzug: number }[] {
  return gesundheitsstufen(k).stufen;
}

/** Fertigkeiten nach Art in den Schlüsseln der früheren Liste (GENERAL, COMBAT, MAGIC) */
export function grwFertigkeitsKategorien(k: Katalog | null = aktiverKatalog()): { GENERAL: string[]; COMBAT: string[]; MAGIC: string[] } {
  const f = grwFertigkeiten(k);
  return { GENERAL: f.allgemein, COMBAT: f.kampf, MAGIC: f.magie };
}

/** Stärke, die die Kultur kostenlos für die Heimatregion gibt (GRW S. 23: Kulturkunde) */
export function gratisStaerkeDerKultur(k: Katalog | null = aktiverKatalog()): string {
  const ref = (k?.get(ERSCHAFFUNG_ID)?.daten.strukturiert as { kultur_frei?: { gratis_staerke_ref?: { id: string } } } | undefined)?.kultur_frei?.gratis_staerke_ref;
  return (ref && k?.get(ref.id)?.name) || '';
}

/**
 * Heimatregionen für die kostenlose Kulturkunde: das Feld „Kulturkunde“ der Kultur-Module (GRW S. 39–50 und Grimoires),
 * Ohne Paket keine.
 */
export function grwHeimatregionen(k: Katalog | null = aktiverKatalog()): string[] {
  if (!k) return [];
  const r = new Set<string>();
  for (const e of Object.values(k.eintraege)) {
    if (e.typ !== 'kultur') continue;
    const kk = String(e.daten.felder?.kulturkunde ?? '').trim();
    r.add(kk && kk.length <= 40 ? kk : e.name);
  }
  return [...r].sort((a, b) => a.localeCompare(b, 'de'));
}

// ---------------------------------------------------------------- Vermögen (Startvermögen)

/** Startvermögen aus der Ressource Vermögen: Spalte „Startvermögen“ der Vermögenstabelle; maßgeblich ist die Stufe aus der Erschaffung */
const VERMOEGEN_GRUPPE = 'grw:ressource:vermoegen';

interface Tabelle { spalten?: string[]; zeilen?: { punkte?: number; werte: string[] }[]; buch_seite?: number }

function vermoegenEintrag(k: Katalog | null) {
  if (!k) return null;
  return Object.values(k.eintraege).find((e) => e.typ === 'ressource' && e.daten.regelgruppe === VERMOEGEN_GRUPPE) ?? null;
}

/** Name der Ressource im Paket (für den Abgleich mit der Ressourcenliste) */
export function vermoegenName(k: Katalog | null = aktiverKatalog()): string | null {
  return vermoegenEintrag(k)?.name ?? null;
}

/** Stufe aus der Erschaffung */
export function erschaffungsVermoegen(liste: ItemEntry[], k: Katalog | null = aktiverKatalog()): number {
  const name = vermoegenName(k);
  if (!name) return 0;
  return liste.filter((r) => r.name === name && r.source === 'creation').reduce((s, r) => s + (Number(r.level) || 0) - (Number(r.xpStufen) || 0), 0);
}

const MUENZE: Record<string, keyof Money> = { solar: 'solare', solare: 'solare', lunar: 'lunare', lunare: 'lunare', telar: 'telare', telare: 'telare' };

/** Startvermögen für eine Stufe: Geld und Seite; null, wenn das Paket keine Tabelle hat */
export function startvermoegen(stufe: number, k: Katalog | null = aktiverKatalog()):
  { geld: Money; text: string; seite?: number } | null {
  const e = vermoegenEintrag(k);
  const t = e?.daten.tabelle as Tabelle | undefined;
  const spalte = t?.spalten?.findIndex((s) => /start/i.test(s)) ?? -1;
  const zeile = t?.zeilen?.find((z) => z.punkte === stufe);
  if (!t || spalte < 0 || !zeile) return null;
  const text = zeile.werte[spalte] ?? '';
  const geld: Money = { solare: 0, lunare: 0, telare: 0 };
  for (const m of text.matchAll(/(\d+)\s*([A-Za-zäöü]+)/g)) {
    const art = MUENZE[m[2].toLowerCase()];
    if (art) geld[art] += Number(m[1]);
  }
  return { geld, text, seite: t.buch_seite };
}

// ---------------------------------------------------------------- Schwerpunkte

const SCHWERPUNKT_REGEL_ID = 'grw:regel:fertigkeiten-regeln:schwerpunkte';

/** Regel „Schwerpunkte“ (für Schwerpunkt-Meisterschaften aus der Kultur): Text, Seite, Kürzel */
export function schwerpunktRegel(k: Katalog | null = aktiverKatalog()): { text: string; seite?: number; kuerzel: string } | null {
  const e = k?.get(SCHWERPUNKT_REGEL_ID);
  if (!e || !k) return null;
  return { text: String(e.daten.beschreibung ?? e.daten.text ?? ''), seite: seite(e), kuerzel: k.pakete[e.quelle.paket]?.kuerzel ?? 'GRW' };
}

/** Bonus je Schwerpunkt-Meisterschaft, die eine Probe behandelt (Regel „Schwerpunkte“, Feld `bonus_je_schwerpunkt`); null ohne Paketangabe */
export function schwerpunktBonusJe(k: Katalog | null = aktiverKatalog()): number | null {
  const s = k?.get(SCHWERPUNKT_REGEL_ID)?.daten.strukturiert as { bonus_je_schwerpunkt?: number } | undefined;
  return typeof s?.bonus_je_schwerpunkt === 'number' ? s.bonus_je_schwerpunkt : null;
}

// ---------------------------------------------------------------- Mondzeichen-Gaben

export interface Mondgabe {
  /** Name des Mondzeichens */
  name: string;
  art: string;
  kosten: number;
  /** ganzer Gabentext (Beleg) */
  text: string;
  hoechsterHoechstens?: number;
  ticks?: number;
  mindestensTicks?: number;
  initiativeBonus?: number;
}

/** Gabe des Mondzeichens (Feld `gabe_strukturiert`) zum Namen aus dem Charakter; null ohne Angabe */
export function mondgabe(name: string | undefined, k: Katalog | null = aktiverKatalog()): Mondgabe | null {
  if (!name || !k) return null;
  const e = k.nachTyp('mondzeichen').find((x) => x.name === name);
  const g = e?.daten.gabe_strukturiert as Record<string, unknown> | undefined;
  if (!e || !g || typeof g.art !== 'string') return null;
  const zahl = (v: unknown) => (typeof v === 'number' ? v : undefined);
  return {
    name: e.name, art: g.art, kosten: zahl(g.kosten_splitterpunkte) ?? 1, text: String((g.beleg as { text?: string })?.text ?? ''),
    hoechsterHoechstens: zahl(g.hoechster_hoechstens), ticks: zahl(g.ticks), mindestensTicks: zahl(g.mindestens_ticks), initiativeBonus: zahl(g.initiative_bonus),
  };
}
