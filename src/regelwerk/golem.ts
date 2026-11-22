/**
 * Golems: Baukasten mit Korpus, Material, Zusätzlichen Fähigkeiten, Rollen, Applikationen, Schwachpunkten, Instruktionen,
 * Verfügungen und Sonderausstattung. Regelwerte aus dem Paket: `strukturiert.golem` am Regeltext zu den weiteren
 * Regelelementen (freie Applikationen, Instruktionen, Konstruktion, Preis, Ressource Golem), `baustein_werte` an
 * Schwachpunkten, deren Zahlen nur im Fließtext stehen; die Stufe kommt aus Korpus und Zuschlägen der Bausteine.
 */
import type { Verstoss } from '../fundament/hausregeln';
import type { Katalog } from './katalog';
import { ABGELEITET_ID } from './abgeleitet';
import type { Eintrag } from './typen';
import type { Begleiter } from '../types';
import {
  anwenden, ausStruktur, leer, merkmalRegel, summe, werteblock, type Modifikationen, type ModifikationenStruktur, type Werteblock,
} from './modifikationen';

export const BAUSTEIN_ARTEN = ['Zusätzliche Fähigkeit', 'Rolle', 'Applikation', 'Schwachpunkt', 'Instruktion', 'Verfügung'] as const;

interface GolemRegeln {
  applikationen_frei: number;
  instruktionen_immer: string[];
  instruktionen_weitere: number;
  instruktion_applikation?: string;
  konstruktion: { schwierigkeit_grund: number; schwierigkeit_je_stufe: number; fortschritt_je_stufe: number; je_applikation_schwierigkeit: number; je_applikation_fortschritt: number; schwachpunkte_je_applikation: number };
  preis_lunare: { je_stufe: number; je_applikation_nach_erster: number; je_sonderausstattung: number };
  sonderausstattung_je_stufen: number;
  ressource: { applikationen_je_stufe: number; verfuegungen_je_stufe: number; verfuegungen_mindestens: number };
  mehrfach_beliebig?: string[];
}
const GR_CACHE = new WeakMap<Katalog, { r: GolemRegeln | null }>();
/** Regelwerte der Golems aus dem Paket (null, wenn der Band nicht geladen ist) */
export function golemRegeln(k: Katalog): GolemRegeln | null {
  let c = GR_CACHE.get(k);
  if (!c) { c = { r: Object.values(k.eintraege).find(e => e.daten.strukturiert?.golem)?.daten.strukturiert.golem ?? null }; GR_CACHE.set(k, c); }
  return c.r;
}
/** Instruktionen, die jeder Golem beherrscht (Namen aus dem Paket) */
export const immerInstruktionen = (k: Katalog) => (golemRegeln(k)?.instruktionen_immer ?? []).map(id => k.get(id)?.name ?? id);

export const korpusse = (k: Katalog) => Object.values(k.eintraege).filter(e => e.typ === 'golem_baustein' && e.daten.baustein === 'Korpus')
  .sort((a, b) => korpusStufe(a) - korpusStufe(b));
export const materialien = (k: Katalog) => Object.values(k.eintraege).filter(e => e.typ === 'material' && e.daten.art === 'Golemmaterial')
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));
export const bausteine = (k: Katalog, art: string) => Object.values(k.eintraege)
  .filter(e => e.typ === 'golem_baustein' && e.daten.baustein === art).sort((a, b) => a.name.localeCompare(b.name, 'de'));

/** Stufe des Merkmals Golem eines Korpus („Golem 3“) */
export function korpusStufe(e: Eintrag): number {
  const r = (e.daten.merkmale_refs ?? []).find((x: { id?: string }) => /:golem$/.test(x.id ?? ''));
  if (r?.stufe) return Number(r.stufe);
  const m = String(e.daten.werte?.merkmale ?? '').match(/Golem (\d+)/);
  return m ? Number(m[1]) : 1;
}

/** Wie oft darf ein Baustein gewählt werden? Laut Paket (beliebig oft je Bausteinart, Höchstzahl), sonst nach Beschreibung */
export function hoechstens(k: Katalog, e: Eintrag): number {
  if ((golemRegeln(k)?.mehrfach_beliebig ?? []).includes(e.daten.baustein)) return Infinity;
  const t = e.daten.mehrfach_aus_text;
  return Number(e.daten.baustein_werte?.hoechstens) || (t === 'beliebig' ? Infinity : Number(t) || 1);
}

/** Voraussetzung eines Bausteins (Name eines anderen Bausteins; Datenseite: `voraussetzung_name`) */
export function voraussetzung(e: Eintrag): string | null {
  return e.daten.voraussetzung_name ?? null;
}

/** Zahlen der Schwachpunkte, die die Beschreibung nur als Prosa nennt (`baustein_werte` im Paket) */
function schwachpunktModifikation(e: Eintrag): Modifikationen {
  const m = leer();
  for (const [w, v] of Object.entries(e.daten.baustein_werte?.modifikationen ?? {})) m.abgeleitet[w] = Number(v);
  return m;
}

/** Sonderausstattung (Tabelle Schritt 5): Zeilen mit zwei Möglichkeiten, Datenseite: `sonderausstattung` */
export function sonderausstattungen(k: Katalog): { optionen: string[]; material: string }[] {
  return sonderausstattungDaten(k).map(z => ({ optionen: z.optionen.map(o => o.text), material: z.material }));
}
function sonderausstattungDaten(k: Katalog): { optionen: { text: string; modifikationen_strukturiert: ModifikationenStruktur }[]; material: string }[] {
  const r = Object.values(k.eintraege).find(e => e.typ === 'regel' && e.id.endsWith('baukasten-schritt-5-feinschliff'));
  return r?.daten.sonderausstattung ?? [];
}

/** Höchste Meisterschaftsschwelle nach Stufe des Merkmals Golem (Tabelle Schritt 5) */
export function golemSchwelle(k: Katalog, stufe: number): number {
  const r = Object.values(k.eintraege).find(e => e.typ === 'regel' && /baukasten-schritt-5-feinschliff$/.test(e.id));
  const t = (r?.daten.tabellen ?? []).find((x: { kopf: string[] }) => x.kopf?.[0] === 'Stufe');
  const zeilen = (t?.zeilen ?? []) as string[][];
  for (const [bereich, schwelle] of zeilen) {
    const [von, bis] = bereich.split('-').map(Number);
    if (stufe >= von && stufe <= (bis || von)) return Number(schwelle);
  }
  // über der letzten Zeile der Tabelle gilt deren Schwelle
  const letzte = zeilen[zeilen.length - 1];
  return letzte && stufe > Number(letzte[0].split('-').pop()) ? Number(letzte[1]) : 0;
}

/** Animierungszauber, der einen Golem dieser Stufe animieren kann („Merkmal Golem 3 oder niedriger“) */
export function animierung(k: Katalog, stufe: number): Eintrag | null {
  const z = Object.values(k.eintraege).filter(e => e.typ === 'zauber' && (e.daten.typus ?? []).includes('Animierung'))
    .map(e => ({ e, bis: Number(e.daten.golem_stufe_bis ?? 0) }))
    .filter(x => x.bis >= stufe).sort((a, b) => a.bis - b.bis);
  return z[0]?.e ?? null;
}

/** Wahl beim Feinschliff, aus dem Text eines Bausteins gelesen (Zahlen aus dem Paket) */
export type GolemWahl = { schluessel: string; quelle: string; text: string } & (
  | { art: 'attribut'; optionen: string[]; bonus: number }
  | { art: 'meisterschaft'; schwelle: number }
  | { art: 'fertigkeit'; neu: number; plus: number }
  | { art: 'punkte'; anzahl: number; max: number }
);

const ALLE_ATTRIBUTE = ['AUS', 'BEW', 'INT', 'KON', 'MYS', 'STÄ', 'VER', 'WIL'];

/** Wahlen einer strukturierten Modifikation mit Schlüsseln; „schritt5“ = Schwelle aus der Feinschliff-Tabelle */
export function wahlenAus(st: ModifikationenStruktur | null | undefined, quelle: string, quellId: string, schwelleSchritt5: number): { wahlen: GolemWahl[]; text: string[]; feste: string[] } {
  const wahlen = (st?.wahlen ?? []).map((w, n) => ({ ...w, ...(w.art === 'meisterschaft' ? { schwelle: w.schwelle === 'schritt5' ? schwelleSchritt5 : w.schwelle } : {}), schluessel: `${quellId}#${n}`, quelle }) as GolemWahl);
  return { wahlen, text: [...(st?.text ?? [])], feste: [...(st?.feste_meisterschaften ?? [])] };
}

/**
 * Getroffene Wahlen des Feinschliffs anwenden (Attribut mit Wirkung auf abgeleitete Werte und Fertigkeiten, Meisterschaft bis
 * zur erlaubten Schwelle, Fertigkeit neu/erhöht, freie Punkte mit Höchstwert je Fertigkeit). Gemeinsam für Golem und Wesen-Baukasten.
 */
export function wahlenAnwenden(
  k: Katalog, werte: Werteblock, wahlen: GolemWahl[], feste: string[], fs: Record<string, string | Record<string, number>>,
  verstoss: (text: string, schluessel: string, mass?: number) => void, wer: string,
): void {
  const R = k.get(ABGELEITET_ID)?.daten.strukturiert;
  const kurzName: Record<string, string> = { AUS: 'Ausstrahlung', BEW: 'Beweglichkeit', INT: 'Intuition', KON: 'Konstitution', MYS: 'Mystik', 'STÄ': 'Stärke', VER: 'Verstand', WIL: 'Willenskraft' };
  const attrVon = (id: string): string[] => (k.get(id)?.daten.attribute ?? []).map((n: string) => Object.keys(kurzName).find(x => kurzName[x] === n)).filter(Boolean);
  const msNeu: string[] = [...feste];
  for (const w of wahlen) {
    const v = fs[w.schluessel];
    if (v === undefined || v === '') continue;
    if (w.art === 'attribut' && typeof v === 'string' && w.optionen.includes(v)) {
      werte.attribute[v] = (werte.attribute[v] ?? 0) + w.bonus;
      // Attribut wirkt auf abgeleitete Werte (Formeln des GRW) und Fertigkeiten
      for (const d of R?.werte ?? []) if ('summe' in d && werte.abgeleitet[d.kuerzel] !== undefined)
        for (const t of d.summe) if ('attribut' in t && t.attribut === kurzName[v]) werte.abgeleitet[d.kuerzel] += (t.faktor ?? 1) * w.bonus;
      werte.fertigkeiten = werte.fertigkeiten.map(f => (f.id && attrVon(f.id).includes(v) ? { ...f, wert: f.wert + w.bonus } : f));
    } else if (w.art === 'meisterschaft' && typeof v === 'string') {
      const e = k.get(v);
      if (e) {
        msNeu.push(`${k.get(e.daten.fertigkeit)?.name ?? ''} (${e.name})`);
        if ((Number(e.daten.schwelle) || 1) > w.schwelle) verstoss(`${e.name}: Schwelle ${e.daten.schwelle} über der erlaubten (${w.schwelle})`, `ms:${w.schluessel}`);
        if (!werte.fertigkeiten.some(f => f.id === e.daten.fertigkeit)) verstoss(`${e.name}: ${wer[0].toUpperCase()}${wer.slice(1)} besitzt die Fertigkeit nicht`, `msf:${w.schluessel}`);
      }
    } else if (w.art === 'fertigkeit' && typeof v === 'string' && k.get(v)) {
      const f = werte.fertigkeiten.find(x => x.id === v);
      if (f) f.wert += w.plus;
      else werte.fertigkeiten.push({ id: v, name: k.get(v)!.name, wert: w.neu + attrVon(v).reduce((s3, a) => s3 + (werte.attribute[a] ?? 0), 0) });
    } else if (w.art === 'punkte' && typeof v === 'object') {
      const summeP = Object.values(v).reduce((s3, x) => s3 + (Number(x) || 0), 0);
      if (summeP > w.anzahl) verstoss(`${w.quelle}: ${summeP} von ${w.anzahl} freien Fertigkeitspunkten verteilt`, `punkte:${w.schluessel}`, summeP - w.anzahl);
      for (const [id, x] of Object.entries(v)) {
        const nP = Number(x) || 0; if (!nP) continue;
        if (nP > w.max) verstoss(`${w.quelle}: höchstens +${w.max} je Fertigkeit`, `max:${w.schluessel}:${id}`, nP - w.max);
        const f = werte.fertigkeiten.find(y => y.id === id);
        if (f) f.wert += nP; else verstoss(`${w.quelle}: Punkte nur auf Fertigkeiten, die ${wer} besitzt`, `fremd:${w.schluessel}:${id}`, nP);
      }
    }
  }
  werte.fertigkeiten.sort((x, y) => x.name.localeCompare(y.name, 'de'));
  if (msNeu.length) werte.meisterschaften = [werte.meisterschaften, ...msNeu].filter(Boolean).join(', ');
}

export interface GolemWerte {
  korpus: Eintrag | undefined;
  stufe: number;
  stufePosten: { text: string; wert: number }[];
  werte: Werteblock | null;
  /** gewählte Bausteine je Art (Einträge in Reihenfolge) */
  gewaehlt: Record<string, Eintrag[]>;
  applikationenFrei: number;
  applikationenExtra: number;
  schwachpunkteNoetig: number;
  materialSchwachpunkt: string | null;
  instruktionenErlaubt: number;
  verfuegungenAktiv: number | null;
  sonderausstattungPlaetze: number;
  meisterschaftSchwelle: number;
  preis: number;
  konstruktion: { schwierigkeit: number; fortschritt: number };
  animierung: Eintrag | null;
  /** Freitexte für die Spielleitung */
  feinschliff: string[];
  /** bedienbare Wahlen des Feinschliffs */
  wahlen: GolemWahl[];
  hinweise: string[];
  /** Hinweise, die ein Regelverstoß sind */
  verstoesse: Verstoss[];
}

export function golemWerte(k: Katalog, b: Begleiter): GolemWerte {
  const korpus = k.get(b.id);
  const hinweise: string[] = [];
  const verstoesse: Verstoss[] = [];
  const verstoss = (text: string, schluessel: string, mass = 1) => { hinweise.push(text); verstoesse.push({ text, schluessel, mass }); };
  const gewaehlt: Record<string, Eintrag[]> = Object.fromEntries(BAUSTEIN_ARTEN.map(a => [a, []]));
  for (const i of b.bausteine ?? []) { const e = k.get(i); if (e?.typ === 'golem_baustein' && gewaehlt[e.daten.baustein]) gewaehlt[e.daten.baustein].push(e); }
  const anzahl = (e: Eintrag) => (b.bausteine ?? []).filter(x => x === e.id).length;
  const GR = golemRegeln(k);
  if (!GR) hinweise.push('Regelwerte der Golems fehlen (Band nicht geladen)');

  const stufePosten = [{ text: `Korpus ${korpus?.name ?? '?'}`, wert: korpus ? korpusStufe(korpus) : 0 }];
  for (const e of [...gewaehlt['Zusätzliche Fähigkeit'], ...gewaehlt.Rolle]) {
    const z = Number.parseInt(String(e.daten.stufe_merkmal_golem ?? '0').replace('+', ''), 10) || 0;
    if (z) stufePosten.push({ text: e.name, wert: z });
  }
  const stufe = stufePosten.reduce((s, p) => s + p.wert, 0);

  // Mehrfachwahl und Voraussetzungen
  for (const e of new Set(Object.values(gewaehlt).flat())) {
    if (anzahl(e) > hoechstens(k, e)) verstoss(`${e.name} ist höchstens ${hoechstens(k, e)}-mal wählbar`, `anzahl:${e.id}`, anzahl(e) - hoechstens(k, e));
    const v = voraussetzung(e);
    if (v && !Object.values(gewaehlt).flat().some(x => x.name === v)) verstoss(`${e.name} setzt ${v} voraus`, `voraus:${e.id}`);
  }
  const material = b.material ? k.get(b.material) : undefined;
  if (!material) hinweise.push('Material wählen (Schritt 2)');
  const materialSchwachpunkt: string | null = material?.daten.felder?.schwachpunkt ?? null;

  const frei0 = GR?.applikationen_frei ?? 0;
  const applikationenFrei = b.golemRessource ? Math.max(frei0, (GR?.ressource.applikationen_je_stufe ?? 0) * stufe) : frei0;
  const applikationenExtra = Math.max(0, gewaehlt.Applikation.length - applikationenFrei);
  const schwachpunkteNoetig = applikationenExtra * (GR?.konstruktion.schwachpunkte_je_applikation ?? 0);
  if (gewaehlt.Schwachpunkt.length < schwachpunkteNoetig)
    verstoss(`Für ${applikationenExtra} zusätzliche Applikation${applikationenExtra > 1 ? 'en' : ''} fehlen ${schwachpunkteNoetig - gewaehlt.Schwachpunkt.length} Schwachpunkt(e)`, 'schwachpunkte', schwachpunkteNoetig - gewaehlt.Schwachpunkt.length);
  const instruktionenErlaubt = (GR?.instruktionen_weitere ?? 0) + gewaehlt.Applikation.filter(e => e.id === GR?.instruktion_applikation).length;
  const instr = gewaehlt.Instruktion.filter(e => !(GR?.instruktionen_immer ?? []).includes(e.id));
  if (instr.length > instruktionenErlaubt) verstoss(`Mehr Instruktionen (${instr.length}) als implementierbar (${instruktionenErlaubt}); weitere über die Applikation ${GR?.instruktion_applikation ? (k.get(GR.instruktion_applikation)?.name ?? '') : ''}`, 'instruktionen', instr.length - instruktionenErlaubt);
  const verfuegungenAktiv = b.golemRessource ? Math.max(GR?.ressource.verfuegungen_mindestens ?? 0, (GR?.ressource.verfuegungen_je_stufe ?? 0) * stufe) : null;
  if (verfuegungenAktiv !== null && gewaehlt['Verfügung'].length > verfuegungenAktiv) verstoss(`Höchstens ${verfuegungenAktiv} aktive Verfügungen (Ressource Golem)`, 'verfuegungen', gewaehlt['Verfügung'].length - verfuegungenAktiv);
  const sonderausstattungPlaetze = GR?.sonderausstattung_je_stufen ? Math.floor(stufe / GR.sonderausstattung_je_stufen) : 0;
  const sa = (b.sonderausstattung ?? []).slice(0, sonderausstattungPlaetze).filter(Boolean);
  if ((b.sonderausstattung ?? []).filter(Boolean).length > sonderausstattungPlaetze) verstoss(`Höchstens ${sonderausstattungPlaetze} Sonderausstattung(en)`, 'sonderausstattung', (b.sonderausstattung ?? []).filter(Boolean).length - sonderausstattungPlaetze);

  // Werte
  let werte: Werteblock | null = null;
  const feinschliff: string[] = [];
  const wahlen: GolemWahl[] = [];
  const schwelle5 = golemSchwelle(k, stufe);
  if (korpus) {
    const grund = werteblock(k, { ...korpus.daten.werte, fertigkeiten_refs: korpus.daten.fertigkeiten_refs });
    const mods: Modifikationen[] = [];
    const feste: string[] = [];
    const mitWahl = (st: ModifikationenStruktur | undefined, quelle: string, id: string) => {
      const w = wahlenAus(st, quelle, id, schwelle5);
      wahlen.push(...w.wahlen); feinschliff.push(...w.text.filter(r => !r.startsWith('Applikation '))); feste.push(...w.feste);
      return { ...ausStruktur(st), rest: [] };
    };
    if (material) mods.push(ausStruktur(material.daten.felder?.modifikationen_strukturiert));
    const matSp = materialSchwachpunkt ? bausteine(k, 'Schwachpunkt').find(e => e.name === materialSchwachpunkt) : undefined;
    if (matSp) mods.push(schwachpunktModifikation(matSp));
    const zaehler = new Map<string, number>();
    for (const e of [...gewaehlt['Zusätzliche Fähigkeit'], ...gewaehlt.Rolle]) {
      const nr = zaehler.get(e.id) ?? 0; zaehler.set(e.id, nr + 1);
      mods.push(mitWahl(e.daten.modifikationen_strukturiert, e.name, `${e.id}:${nr}`));
    }
    for (const e of gewaehlt.Schwachpunkt) mods.push(schwachpunktModifikation(e));
    const saDaten = sonderausstattungDaten(k).flatMap(z => z.optionen);
    sa.forEach((s2, i) => mods.push(mitWahl(saDaten.find(o => o.text === s2)?.modifikationen_strukturiert, 'Sonderausstattung', `sa:${i}`)));
    const m = summe(...mods);
    // doppelte Merkmale nach Schritt 5 zusammenführen (Die Magie S. 207)
    werte = anwenden(k, grund, m, merkmalRegel(k, 'magie:regel:regeln:baukasten-schritt-5-feinschliff'));
    // Mindestwerte der Schwachpunkte (z. B. Geschwindigkeit nicht unter einen Wert)
    for (const e of [...gewaehlt.Schwachpunkt, ...(matSp ? [matSp] : [])])
      for (const [w, min] of Object.entries(e.daten.baustein_werte?.mindestwert ?? {}))
        if (werte.abgeleitet[w] !== undefined) werte.abgeleitet[w] = Math.max(Number(min), werte.abgeleitet[w]);
    werte.merkmale = werte.merkmale.map(x => (/^Golem \d+$/.test(x) ? `Golem ${stufe}` : x));

    wahlenAnwenden(k, werte, wahlen, feste, b.feinschliff ?? {}, verstoss, 'der Golem');
  }
  for (const s2 of sa) if (/^Applikation /.test(s2)) feinschliff.push(`Sonderausstattung: ${s2}`);

  const P = GR?.preis_lunare, KO = GR?.konstruktion;
  const preis = P ? P.je_stufe * stufe + P.je_applikation_nach_erster * Math.max(0, applikationenExtra - 1) + P.je_sonderausstattung * sa.length : 0;
  return {
    korpus, stufe, stufePosten, werte, gewaehlt, applikationenFrei, applikationenExtra, schwachpunkteNoetig, materialSchwachpunkt,
    instruktionenErlaubt, verfuegungenAktiv, sonderausstattungPlaetze, meisterschaftSchwelle: schwelle5,
    preis, konstruktion: KO
      ? { schwierigkeit: KO.schwierigkeit_grund + KO.schwierigkeit_je_stufe * stufe + KO.je_applikation_schwierigkeit * applikationenExtra,
          fortschritt: KO.fortschritt_je_stufe * stufe + KO.je_applikation_fortschritt * applikationenExtra }
      : { schwierigkeit: 0, fortschritt: 0 },
    animierung: animierung(k, stufe), feinschliff, wahlen, hinweise, verstoesse,
  };
}

/** Fertigkeiten, die der Golem besitzt, und Meisterschaften dazu bis zu einer Schwelle */
export function golemMeisterschaften(k: Katalog, fertigkeiten: { id?: string; name: string }[], schwelle: number) {
  const ids = new Set(fertigkeiten.map(f => f.id).filter(Boolean));
  return Object.values(k.eintraege).filter(e => e.typ === 'meisterschaft' && ids.has(e.daten.fertigkeit) && (Number(e.daten.schwelle) || 1) <= schwelle)
    .map(e => ({ id: e.id, name: e.name, fertigkeit: k.get(e.daten.fertigkeit)?.name ?? '', schwelle: Number(e.daten.schwelle) || 1 }))
    .sort((a, b) => a.fertigkeit.localeCompare(b.fertigkeit, 'de') || a.schwelle - b.schwelle || a.name.localeCompare(b.name, 'de'));
}

/** Allgemeine Fertigkeiten (für „eine noch nicht freigeschaltete Fertigkeit“) */
export function allgemeineFertigkeiten(k: Katalog) {
  return Object.values(k.eintraege).filter(e => e.typ === 'fertigkeit' && !e.daten.gruppierte_fertigkeit && e.daten.kategorie !== 'Magieschule' && e.daten.kategorie !== 'Kampffertigkeit')
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Anzeige eines Golem-Bausteins: Art, Zuschlag auf das Merkmal Golem, Beschreibung */
export function bausteinInfo(e: Eintrag | undefined): { art: string; zuschlag: string | null; beschreibung: string } {
  return { art: String(e?.daten.baustein ?? ''), zuschlag: e?.daten.stufe_merkmal_golem ? String(e.daten.stufe_merkmal_golem) : null, beschreibung: String(e?.daten.beschreibung ?? '') };
}
/** Anzeige eines Golemmaterials: Modifikationen und Schwachpunkt */
export function materialInfo(e: Eintrag): string {
  return `${e.daten.felder?.modifikationen ?? ''}; Schwachpunkt ${e.daten.felder?.schwachpunkt ?? '–'}`;
}
/** Größenklasse eines Korpus */
export function korpusGK(e: Eintrag): string {
  return String(e.daten.werte?.abgeleitete_werte?.GK ?? '?');
}
