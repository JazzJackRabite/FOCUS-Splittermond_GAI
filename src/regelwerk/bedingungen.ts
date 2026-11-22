/**
 * Auswertung von Voraussetzungen (manifest.voraussetzungen). Portierung von erfuellt() aus Pruefsuite/lader.py.
 * Ergebnis: true (erfüllt), false (nicht erfüllt) oder 'offen' (Entscheidung der Spielleitung bzw. Angabe fehlt).
 */
import type { Eintrag, Ergebnis } from './typen';

export interface Traeger {
  hat?: Iterable<string>;
  werte?: Record<string, number>;
  zauber?: string[];
  typus?: string[];
  gk?: number | null;
}

export interface BedingungsCharakter {
  hat: Set<string>;
  werte: Record<string, number>;
  /** Schwerpunkte als [Fertigkeits-ID, Name] */
  schwerpunkte: Array<[string, string]>;
  zauber: string[];
  /** Tiergefährte bzw. Wesen im Baukasten (Bedingungen mit traeger) */
  tier?: Traeger;
  wesen?: Traeger;
  typus?: string[];
  gk?: number | null;
  stufe?: string;
  gottheit?: string;
  gewaehlte_magieschule?: string;
  auswahl_geprueft?: boolean;
  /** gelernte Meisterschaften mit der Fertigkeit, unter der sie geführt werden: [Meisterschafts-ID, Fertigkeits-ID] */
  gelerntIn?: Array<[string, string | undefined]>;
  /** Fertigkeit der zu prüfenden Meisterschaft (für Bedingungen mit `gleiche_fertigkeit`) */
  fertigkeit?: string;
}

export interface KatalogSicht {
  eintraege: Record<string, Eintrag>;
  alias?: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bedingung = any;

export function erfuellt(char: BedingungsCharakter, b: Bedingung, kat: KatalogSicht): Ergebnis {
  const E = kat.eintraege;
  const alias = kat.alias ?? {};
  const get = (i: string | undefined | null) => (i ? E[i] : undefined);
  if ('offen' in b) return 'offen';
  if ('situativ' in b) return true; // gilt beim Einsatz, nicht beim Erwerb
  if (b.traeger === 'tier' || b.traeger === 'wesen') {
    const sub: Traeger | undefined = char[b.traeger as 'tier' | 'wesen'];
    if (sub === undefined || sub === null) return 'offen';
    const { traeger: _t, ...b2 } = b; void _t;
    return erfuellt({ hat: new Set(sub.hat ?? []), werte: sub.werte ?? {}, schwerpunkte: [], zauber: sub.zauber ?? [], typus: sub.typus ?? [], gk: sub.gk ?? null }, b2, kat);
  }
  if ('nicht' in b) {
    const r = erfuellt(char, b.nicht, kat);
    return r === 'offen' ? 'offen' : !r;
  }
  if ('gestaffelt' in b) {
    const st = b.gestaffelt.find((x: { fuer: string }) => x.fuer === char.stufe) ?? b.gestaffelt[0];
    return erfuellt(char, st.bedingung, kat);
  }
  if ('typus' in b) {
    const t = char.typus;
    if (t === undefined || t === null) return 'offen';
    return t.includes(b.typus);
  }
  if ('groessenklasse' in b) {
    const g = b.groessenklasse; const gk = char.gk;
    if (gk === undefined || gk === null) return 'offen';
    return gk >= (g.min ?? -99) && gk <= (g.max ?? 99);
  }
  if ('fertigkeit_vorhanden' in b) return (char.werte[b.fertigkeit_vorhanden] ?? 0) > 0;
  if ('auswahl_einschraenkung' in b) {
    const a = b.auswahl_einschraenkung;
    if (a.feld === 'gottheit.bevorzugte_magieschulen' && char.gottheit && char.gewaehlte_magieschule) {
      const g = get(char.gottheit);
      if (!g) return 'offen'; // Paket mit der Götterliste nicht geladen
      if ((g.daten.bevorzugte_magieschulen ?? []).some((s: { id?: string }) => s.id === char.gewaehlte_magieschule)) return true;
      return 'offen'; // Listen laut Buch nicht abschließend (Die Götter S. 171)
    }
    return char.auswahl_geprueft ? true : 'offen';
  }
  if ('hat_name' in b) {
    const h = b.hat_name;
    const passt = (e?: Eintrag) => !!e && e.typ === h.typ && e.name === h.name && (!h.fertigkeit || e.daten.fertigkeit === h.fertigkeit);
    for (const i of char.hat) if (passt(get(i))) return true;
    return Object.values(E).some(e => passt(e)) ? false : 'offen';
  }
  if ('meisterschaften_anzahl' in b) {
    const m = b.meisterschaften_anzahl;
    let n = 0;
    for (const i of char.hat) {
      const e = get(i);
      if (e && e.typ === 'meisterschaft' && (!m.manoever || e.daten.manoever) && (!m.fertigkeit || e.daten.fertigkeit === m.fertigkeit)) n++;
    }
    return n >= m.anzahl;
  }
  if ('fertigkeiten_anzahl' in b) {
    const f = b.fertigkeiten_anzahl;
    if (f.gruppe !== 'magieschule') throw new Error('fertigkeiten_anzahl: unbekannte Gruppe ' + f.gruppe);
    let n = 0;
    for (const [i, w] of Object.entries(char.werte)) {
      const e = get(i);
      if (e && e.typ === 'fertigkeit' && e.daten.kategorie === 'Magieschule' && w >= f.mindestwert) n++;
    }
    return n >= f.anzahl;
  }
  if ('hat' in b) {
    if (b.bezug) {
      const name = b.meisterschaft_name;
      // „in der gleichen Magieschule“ / „in derselben Fertigkeit“ (Datenseite: gleiche_fertigkeit)
      if (b.gleiche_fertigkeit && char.fertigkeit && char.gelerntIn)
        return char.gelerntIn.some(([h, f]) => f === char.fertigkeit && get(h)?.name === name);
      for (const h of char.hat) { const e = get(h); if (e && e.name === name) return true; }
      return false;
    }
    if (char.hat.has(b.hat)) return true;
    const ziel = alias[b.hat] ?? b.hat;
    for (const h of char.hat) if ((alias[h] ?? h) === ziel) return true;
    return false;
  }
  if ('mindestwert' in b) return (char.werte[b.mindestwert.ziel] ?? 0) >= b.mindestwert.wert;
  if ('schwerpunkt' in b) {
    const s = b.schwerpunkt;
    if (s.auspraegung) return char.schwerpunkte.some(([f, n]) => f === s.fertigkeit && (n === s.name || n.startsWith(s.name + ':')));
    return char.schwerpunkte.some(([f, n]) => f === s.fertigkeit && n === s.name);
  }
  if ('zauber_typus' in b) {
    const t = b.zauber_typus;
    const n = char.zauber.filter(z => (get(z)?.daten.typus ?? []).includes(t.typus)).length;
    return n >= t.anzahl;
  }
  if ('alle' in b) {
    const r = b.alle.map((x: Bedingung) => erfuellt(char, x, kat));
    return r.includes(false) ? false : r.includes('offen') ? 'offen' : true;
  }
  if ('einer_von' in b) {
    const r = b.einer_von.map((x: Bedingung) => erfuellt(char, x, kat));
    return r.includes(true) ? true : r.includes('offen') ? 'offen' : false;
  }
  throw new Error('Unbekannte Bedingung: ' + JSON.stringify(b));
}

/** Prüft die Voraussetzungen eines Eintrags; ohne formale Bedingung: true. */
export function voraussetzungErfuellt(char: BedingungsCharakter, e: Eintrag, kat: KatalogSicht): Ergebnis {
  const v = e.daten.voraussetzungen;
  if (!v || typeof v !== 'object' || !('bedingung' in v)) return true;
  return erfuellt(char, v.bedingung, kat);
}
