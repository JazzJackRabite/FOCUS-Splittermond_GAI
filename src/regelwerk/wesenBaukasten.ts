/**
 * Wesen-Baukasten: beschwörbare Wesen (Die Magie, Baukasten für beschwörbare Wesen) und Kreaturen (Bestienmeister,
 * Baukasten für Kreaturen). Alle Regelwerte kommen aus den Paketen (FUNDAMENT.md, Regelquellen):
 * - Grundwerte: Basis bzw. Korpus (`attribute`, `abgeleitete_werte`, `waffen`, `felder`, `fertigkeiten_refs`).
 * - Stufe: beschwörbare Wesen `beschwoerbares_wesen_stufe` + `stufe_bonus` der Module und Rollen; Kreaturen
 *   `ressource_kreatur` + `kosten_punkte` der Module (ohne Zahl: `kosten_text`, nicht eingerechnet).
 * - Mehrfachwahl `mehrfach` (Zahl oder „beliebig“; ohne Angabe einmal), Gruppen `gruppe`, Voraussetzungen `voraussetzungen`
 *   (Bedingungen mit Träger „wesen“), Dienste `moegliche_dienste`, Feinschliff aus `strukturiert` der Regel Schritt 5.
 * - Werte: `modifikationen` über regelwerk/modifikationen.ts; was keine feste Zahl ist, bleibt Feinschliff (Spielleitung).
 */
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';
import type { Begleiter } from '../types';
import type { Traeger } from './bedingungen';
import { erfuellt } from './bedingungen';
import { anwenden, ausStruktur, merkmalRegel, summe, werteblock, type Werteblock } from './modifikationen';
import { wahlenAus, wahlenAnwenden, type GolemWahl } from './golem';
import type { Ergebnis } from './typen';

export type BaukastenArt = 'beschwoerbar' | 'kreatur';
export const BASIS_TYP = 'wesen_baukasten_basis';
const MODUL_TYP = 'wesen_baukasten_modul';
const ROLLE_TYP = 'wesen_baukasten_rolle';

/** Art des Baukastens einer Basis (null: kein Baukasten-Eintrag) */
export function baukastenArt(e: Eintrag | undefined): BaukastenArt | null {
  if (e?.typ !== BASIS_TYP) return null;
  if (e.daten.beschwoerbares_wesen_stufe !== undefined && e.daten.beschwoerbares_wesen_stufe !== null) return 'beschwoerbar';
  if (e.daten.ressource_kreatur !== undefined && e.daten.ressource_kreatur !== null) return 'kreatur';
  return null;
}

/** Basen bzw. Korpusse eines Baukastens */
export function basen(k: Katalog, art: BaukastenArt): Eintrag[] {
  return Object.values(k.eintraege).filter(e => baukastenArt(e) === art).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Module und Rollen desselben Grimoires wie die Basis */
export function bausteineFuer(k: Katalog, basis: Eintrag): Eintrag[] {
  return Object.values(k.eintraege)
    .filter(e => (e.typ === MODUL_TYP || e.typ === ROLLE_TYP) && e.quelle.paket === basis.quelle.paket)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Gruppe eines Bausteins für die Anzeige (Rollen als eigene Gruppe) */
export function gruppe(e: Eintrag): string {
  if (e.typ === ROLLE_TYP) return String(e.daten.gruppe ?? 'Rolle');
  return String(e.daten.gruppe ?? 'Zusätzliche Fähigkeiten');
}

/** Wie oft ist ein Baustein wählbar? (`mehrfach`: Zahl oder „beliebig“; ohne Angabe einmal) */
export function hoechstzahl(e: Eintrag): number {
  const m = e.daten.mehrfach;
  if (m === 'beliebig') return Infinity;
  const n = Number(m);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Beitrag eines Bausteins zur Stufe (beschwörbar: `stufe_bonus`) bzw. zu den Kreaturpunkten (`kosten_punkte`); null = ohne Zahl */
export function beitrag(e: Eintrag, art: BaukastenArt): number | null {
  const v = art === 'beschwoerbar' ? e.daten.stufe_bonus : e.daten.kosten_punkte;
  // ohne Zahl: nur „speziell“, wenn das Paket stattdessen einen Kostentext nennt; ohne jede Kostenangabe (Rollen der Kreaturen,
  // die mit der Basis gewählt werden) kein Zuschlag – Auslegung von „Basis und Rolle“ (Bestienmeister S. 50)
  if (v === undefined || v === null || v === '') return art === 'kreatur' && e.daten.kosten_text ? null : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Grundstufe der Basis */
export function grundstufe(e: Eintrag, art: BaukastenArt): number {
  return Number(art === 'beschwoerbar' ? e.daten.beschwoerbares_wesen_stufe : e.daten.ressource_kreatur) || 0;
}

/** Text der Voraussetzung eines Bausteins (oder null) */
export function voraussetzungText(e: Eintrag): string | null {
  return e.daten.voraussetzungen?.text ?? null;
}

/** Feinschliff beschwörbarer Wesen: höchste Schwelle und höchster Zaubergrad nach Stufe, Zahl der Dienste (Text) */
export function feinschliffBeschwoerbar(k: Katalog, stufe: number): { schwelle: number | null; grad: number | null; dienste: string | null } {
  const r = Object.values(k.eintraege).find(e => e.typ === 'regel' && e.daten.strukturiert?.hoechste_schwelle_und_grad_nach_stufe);
  const s = r?.daten.strukturiert;
  const zeile = (s?.hoechste_schwelle_und_grad_nach_stufe ?? []).find((z: { stufe_von: number; stufe_bis: number }) => stufe >= z.stufe_von && stufe <= z.stufe_bis);
  return { schwelle: zeile?.schwelle ?? null, grad: zeile?.grad ?? null, dienste: s?.dienste_anzahl ?? null };
}

/** Regeln zum Zusammenführen doppelter Merkmale (Feinschliff des Baukastens): Die Magie S. 196, Bestienmeister S. 58 */
const MERKMAL_REGEL: Record<BaukastenArt, string> = {
  beschwoerbar: 'magie:regel:regeln:baukasten-fuer-beschwoerbare-wesen-merkmale',
  kreatur: 'bestien:regel:regeln:schritt-6-feinschliff',
};

/** Verbesserte Angriffe (Die Magie S. 196–197): Regeln aus `strukturiert.verbesserte_angriffe` */
const VA_REGEL = 'magie:regel:regeln:baukasten-fuer-beschwoerbare-wesen-verbesserte-angriffe';
export interface VaRegel {
  wertesets: { punkte: number; schaden: string; wgs: number; merkmale: string }[];
  sonstiges: { punkte: number; art: 'stumpf_entfaellt' | 'waffe'; modus?: string; zweihaendig?: boolean; schild?: boolean }[];
  korpus_bonus: Record<string, number>;
}
export function vaRegel(k: Katalog): VaRegel | null { return k.get(VA_REGEL)?.daten.strukturiert?.verbesserte_angriffe ?? null; }

/** Ein Kauf mit Punkten Verbesserter Angriff: „set:<Punkte>“, „stumpf“ oder „waffe:<Katalog-ID>“ */
export interface VaKauf { schluessel: string; text: string; punkte: number }
export function vaKauf(k: Katalog, R: VaRegel, schluessel: string): VaKauf | null {
  const [art, wert] = [schluessel.split(':')[0], schluessel.slice(schluessel.indexOf(':') + 1)];
  if (art === 'set') { const s = R.wertesets.find(x => String(x.punkte) === wert); return s ? { schluessel, text: `Werteset ${s.schaden}, WGS ${s.wgs}, ${s.merkmale}`, punkte: s.punkte } : null; }
  if (art === 'stumpf') { const s = R.sonstiges.find(x => x.art === 'stumpf_entfaellt'); return s ? { schluessel, text: 'Merkmal Stumpf entfällt', punkte: s.punkte } : null; }
  if (art === 'waffe') {
    const e = k.get(wert); const s = e && waffenKosten(R, e);
    return e && s ? { schluessel, text: `Angriff mit den Werten von ${e.name}`, punkte: s } : null;
  }
  return null;
}
/** Punkte für eine Katalogwaffe nach Modus und Zweihändigkeit (Tabelle „Sonstiges“) */
export function waffenKosten(R: VaRegel, e: Eintrag): number | null {
  const zweih = /Zweihändig/.test(String(e.daten.merkmale_text ?? ''));
  const z = R.sonstiges.find(x => x.art === 'waffe' && (e.typ === 'schild' ? x.schild : x.modus === e.daten.modus && (x.zweihaendig === undefined || x.zweihaendig === zweih)));
  return z?.punkte ?? null;
}
/** Katalogwaffen, die mit Verbesserter Angriff wählbar sind */
export function vaWaffen(k: Katalog, R: VaRegel): { e: Eintrag; punkte: number }[] {
  return Object.values(k.eintraege)
    .filter(e => (e.typ === 'waffe' || (e.typ === 'schild' && e.daten.schaden)) && e.daten.schaden)
    .map(e => ({ e, punkte: waffenKosten(R, e) ?? 0 })).filter(x => x.punkte > 0)
    .sort((a, b) => a.punkte - b.punkte || a.e.name.localeCompare(b.e.name, 'de'));
}

export interface BausteinZeile { e: Eintrag; anzahl: number; beitrag: number | null; voraussetzung: Ergebnis | null }

export interface WesenBaukastenWerte {
  basis: Eintrag | undefined;
  art: BaukastenArt | null;
  stufe: number;
  posten: { text: string; wert: number }[];
  /** Bausteine ohne Zahl im Paket (Kosten „speziell“) */
  ohneZahl: Eintrag[];
  gewaehlt: Eintrag[];
  werte: Werteblock | null;
  /** mögliche Dienste (beschwörbare Wesen) aus den gewählten Bausteinen */
  dienste: { id: string; name: string }[];
  feinschliff: string[];
  /** bedienbare Wahlen (Attribut, Meisterschaft, Fertigkeit, freie Punkte) */
  wahlen: GolemWahl[];
  /** höchste Schwelle und höchster Zaubergrad im Feinschliff (beschwörbare Wesen) */
  schritt5: { schwelle: number | null; grad: number | null; dienste: string | null } | null;
  /** Punkte Verbesserter Angriff (Rolle, Korpus-Bonus) und die Käufe */
  verbesserteAngriffe: { punkte: number; verbraucht: number; kaeufe: VaKauf[] } | null;
  hinweise: { text: string; schluessel: string; mass: number }[];
}

/** Träger „wesen“ für Bedingungen: gewählte Bausteine, Fertigkeitswerte, Typus, Größenklasse, Waffenmerkmale */
function wesenTraeger(gewaehlt: Eintrag[], w: Werteblock | null, basis: Eintrag | undefined): Traeger {
  const merkmale = (basis?.daten.waffen ?? []).flatMap((x: { merkmale_refs?: { id: string }[] }) => (x.merkmale_refs ?? []).map(r => r.id));
  const weg = new Set((w?.waffen ?? []).length ? merkmale.filter((id: string) => !(w!.waffen.some(x => new RegExp(`\\b${id.split(':').pop()}\\b`, 'i').test(x.merkmale)))) : []);
  const werte: Record<string, number> = {};
  for (const f of w?.fertigkeiten ?? []) if (f.id) werte[f.id] = f.wert;
  return {
    hat: [...gewaehlt.map(e => e.id), ...merkmale.filter((id: string) => !weg.has(id))],
    werte,
    typus: String(w?.typus ?? '').split(',').map(t => t.trim()).filter(Boolean),
    gk: w?.abgeleitet.GK ?? null,
  };
}

/** Werte eines im Baukasten gebauten Wesens (Begleiter mit Basis als id und `bausteine`) */
export function wesenBaukastenWerte(k: Katalog, b: Begleiter): WesenBaukastenWerte {
  const basis = k.get(b.id);
  const art = baukastenArt(basis);
  const gewaehlt = (b.bausteine ?? []).map(i => k.get(i)).filter((e): e is Eintrag => !!e && (e.typ === MODUL_TYP || e.typ === ROLLE_TYP));
  const hinweise: WesenBaukastenWerte['hinweise'] = [];
  if (!basis || !art) return { basis, art, stufe: 0, posten: [], ohneZahl: [], gewaehlt, werte: null, dienste: [], feinschliff: [], wahlen: [], schritt5: null, verbesserteAngriffe: null, hinweise };

  const posten = [{ text: basis.name, wert: grundstufe(basis, art) }];
  const ohneZahl: Eintrag[] = [];
  for (const e of gewaehlt) {
    const v = beitrag(e, art);
    if (v === null) ohneZahl.push(e); else if (v !== 0) posten.push({ text: e.name, wert: v });
  }
  const stufe = posten.reduce((s, p) => s + p.wert, 0);

  // Mehrfachwahl
  for (const e of new Set(gewaehlt)) {
    const n = gewaehlt.filter(x => x.id === e.id).length; const h = hoechstzahl(e);
    if (n > h) hinweise.push({ text: `${e.name} ist höchstens ${h}-mal wählbar`, schluessel: `mehrfach:${e.id}`, mass: n - h });
  }

  // Werte: feste Zahlen sofort, Wahlen (Attribut, Meisterschaft, Fertigkeit, Punkte) aus dem Feinschliff
  const schritt5 = art === 'beschwoerbar' ? feinschliffBeschwoerbar(k, stufe) : null;
  const wahlen: GolemWahl[] = []; const feinschliff: string[] = []; const feste: string[] = [];
  const zaehler = new Map<string, number>();
  const mods = gewaehlt.map(e => {
    const m = ausStruktur(e.daten.modifikationen_strukturiert);
    const nr = zaehler.get(e.id) ?? 0; zaehler.set(e.id, nr + 1);
    const w = wahlenAus(e.daten.modifikationen_strukturiert, e.name, `${e.id}:${nr}`, schritt5?.schwelle ?? 1);
    wahlen.push(...w.wahlen); feinschliff.push(...w.text.map(t => `${e.name}: ${t}`)); feste.push(...w.feste);
    return { ...m, rest: [] };
  });
  // Verbesserte Angriffe: Punkte aus Rollen (+ Korpus-Bonus), neue Wertesets vor den Modifikationen (sie gelten für alle Angriffe)
  const grundwerte = werteblock(k, basis.daten);
  const R = vaRegel(k);
  const vaPunkte = gewaehlt.reduce((s2, e) => s2 + (Number(e.daten.verbesserter_angriff) || 0), 0);
  let va: WesenBaukastenWerte['verbesserteAngriffe'] = null;
  const summeMods = summe(...mods);
  if (R && (vaPunkte > 0 || (b.verbesserteAngriffe ?? []).length)) {
    const punkte = vaPunkte > 0 ? vaPunkte + (R.korpus_bonus[basis.id] ?? 0) : 0;
    const kaeufe = (b.verbesserteAngriffe ?? []).map(x => vaKauf(k, R, x)).filter((x): x is VaKauf => !!x);
    const verbraucht = kaeufe.reduce((s2, x) => s2 + x.punkte, 0);
    if (verbraucht > punkte) hinweise.push({ text: `Verbesserte Angriffe: ${verbraucht} von ${punkte} Punkten verwendet`, schluessel: 'va:punkte', mass: verbraucht - punkte });
    const vorbild = grundwerte.waffen[0];
    for (const x of kaeufe) {
      const art2 = x.schluessel.split(':')[0];
      if (art2 === 'stumpf') { summeMods.waffenmerkmaleWeg.push('Stumpf'); continue; }
      const set = art2 === 'set' ? R.wertesets.find(s3 => `set:${s3.punkte}` === x.schluessel) : null;
      const e = art2 === 'waffe' ? k.get(x.schluessel.slice(6)) : null;
      grundwerte.waffen.push({
        name: set ? `Werteset ${set.punkte} P.` : e!.name, wert: vorbild?.wert ?? 0, ini: vorbild?.ini ?? '',
        schaden: set ? set.schaden : String(e!.daten.schaden), wgs: String(set ? set.wgs : e!.daten.wgs ?? ''),
        merkmale: set ? set.merkmale : String(e!.daten.merkmale_text ?? '–'),
      });
    }
    va = { punkte, verbraucht, kaeufe };
  }
  let werte = anwenden(k, grundwerte, summeMods, merkmalRegel(k, MERKMAL_REGEL[art]));
  // Stufenmerkmal der Grundlage (Datenseite: `stufenmerkmal`, z. B. „Kreatur 2“) auf die erreichte Stufe setzen
  const sm: string | undefined = basis?.daten.stufenmerkmal;
  werte = { ...werte, merkmale: werte.merkmale.map(x => (sm && x.startsWith(`${sm} `) && /^\d+$/.test(x.slice(sm.length + 1)) ? `${sm} ${stufe}` : x)) };
  wahlenAnwenden(k, werte, wahlen, feste, b.feinschliff ?? {}, (text, schluessel, mass = 1) => hinweise.push({ text, schluessel, mass }), 'das Wesen');

  // Voraussetzungen (Träger „wesen“): jeweils mit allen übrigen Bausteinen
  const traeger = wesenTraeger(gewaehlt, werte, basis);
  for (const e of gewaehlt) {
    const v = e.daten.voraussetzungen?.bedingung;
    if (!v) continue;
    const ohne = { ...traeger, hat: [...(traeger.hat ?? [])].filter(x => x !== e.id) };
    if (erfuellt({ hat: new Set(), werte: {}, schwerpunkte: [], zauber: [], wesen: ohne }, v, k) === false)
      hinweise.push({ text: `${e.name}: Voraussetzung nicht erfüllt (${voraussetzungText(e) ?? 'siehe Buch'})`, schluessel: `voraussetzung:${e.id}`, mass: 1 });
  }

  const dienste = new Map<string, string>();
  for (const e of gewaehlt) for (const d of e.daten.moegliche_dienste ?? []) if (d.id) dienste.set(d.id, k.get(d.id)?.name ?? d.dienst ?? d.id);

  return {
    basis, art, stufe, posten, ohneZahl, gewaehlt, werte,
    dienste: [...dienste].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    feinschliff, wahlen, schritt5, verbesserteAngriffe: va, hinweise,
  };
}

/** Prüft einen neuen Baustein gegen Mehrfachwahl und Voraussetzung (für die Sperre in der Ansicht) */
export function bausteinPruefen(k: Katalog, b: Begleiter, neu: string): WesenBaukastenWerte['hinweise'] {
  return wesenBaukastenWerte(k, { ...b, bausteine: [...(b.bausteine ?? []), neu] }).hinweise;
}

/** Ergebnis der Voraussetzung eines noch nicht gewählten Bausteins (für die Auswahlliste) */
export function bausteinVorab(k: Katalog, b: Begleiter, e: Eintrag): Ergebnis {
  const v = e.daten.voraussetzungen?.bedingung;
  if (!v) return true;
  const w = wesenBaukastenWerte(k, b);
  return erfuellt({ hat: new Set(), werte: {}, schwerpunkte: [], zauber: [], wesen: wesenTraeger(w.gewaehlt, w.werte, w.basis) }, v, k);
}

/** Anzeigetext eines Bausteins: Beschreibung und Modifikationen */
export function bausteinText(e: Eintrag): string {
  return [e.daten.beschreibung, e.daten.modifikationen ? `Modifikationen: ${e.daten.modifikationen}` : null].filter(Boolean).join(' ');
}

/** Kostenangabe ohne Zahl („speziell“) */
export function kostenText(e: Eintrag): string | undefined {
  return e.daten.kosten_text ?? undefined;
}
