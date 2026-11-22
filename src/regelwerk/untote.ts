/**
 * Erhobene Untote. Alle Regelwerte aus den Paketen:
 * - `strukturiert.untote` am Regeltext zu Werten und Steigerung von Untoten (Grenze nach Zaubergrad, nicht steigerbare
 *   Fertigkeiten, Angriffsattribute, Verstand, Meisterschaften für mehrfache Verstärkung und Abnormitäten),
 * - `wertesaetze` an den Erhebungszaubern (Kreatur-IDs oder Fundstelle, EP je Verstärkung),
 * - Steigerungskosten, Meisterschaftsschwellen und Grenzen der Heldengrade aus den Kernregeln (`regelwerk/abgeleitet.ts`).
 */
import type { Verstoss } from '../fundament/hausregeln';
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';
import type { Begleiter, Mastery } from '../types';
import { ABGELEITET_ID, attributSteigerungKosten, fertigkeitspunkteKosten, hoechstePunkteHeldengrad, schwelleNachPunkten } from './abgeleitet';
import { anwenden, ausStruktur, werteblock, ATTRIBUT_KURZ, type Werteblock } from './modifikationen';
import { wertekasten } from './begleiter';
import { meisterschaftId } from './bruecke';
import { quelleText } from './relikte';

export const KURZ_NAME: Record<string, string> = {
  AUS: 'Ausstrahlung', BEW: 'Beweglichkeit', INT: 'Intuition', KON: 'Konstitution', MYS: 'Mystik', 'STÄ': 'Stärke', VER: 'Verstand', WIL: 'Willenskraft',
};
/** Pseudo-Fertigkeit für den Angriffswert der Waffen */
export const ANGRIFF = 'angriff';

interface UntoteRegeln {
  grenze_nach_zaubergrad: { zaubergrad_bis: number; heldengrad: number }[];
  angriff_attribute: string[];
  keine_kategorien: string[];
  nicht_steigerbar: string[];
  verstand_frisch?: number;
  verstaerkung_mehrfach?: string;
  abnormitaet?: { meisterschaft: string; hoechstens: number };
}
const REGEL_CACHE = new WeakMap<Katalog, { r: UntoteRegeln | null; quelle: string }>();
/** Regelwerte der Untoten aus dem Paket (null, wenn der Band mit dem Regeltext nicht geladen ist) */
export function untoteRegeln(k: Katalog): UntoteRegeln | null { return regelEintrag(k).r; }
/** Fundstelle des Regeltextes zu den Untoten */
export const untoteRegelQuelle = (k: Katalog) => regelEintrag(k).quelle;
function regelEintrag(k: Katalog) {
  let c = REGEL_CACHE.get(k);
  if (!c) {
    const e = Object.values(k.eintraege).find(x => x.daten.strukturiert?.untote);
    c = { r: e?.daten.strukturiert.untote ?? null, quelle: e ? quelleText(k, e) : '' };
    REGEL_CACHE.set(k, c);
  }
  return c;
}

export interface Wertesatz { name: string; quelle: string; id: string | null }
export interface Erhebung { zauber: Eintrag; grad: number; epJeVerstaerkung: number; wertesaetze: Wertesatz[] }

/** Erhebungszauber im Katalog (Zauber mit `wertesaetze`) */
export function erhebungen(k: Katalog): Erhebung[] {
  return Object.values(k.eintraege)
    .filter(e => e.typ === 'zauber' && e.daten.wertesaetze)
    .map(e => {
      const grad = Math.min(...(e.daten.schulen ?? []).map((s: { grad: number }) => s.grad));
      const W = e.daten.wertesaetze as { saetze: { id?: string; name?: string; werk?: string; seite?: number }[]; ep_je_verstaerkung: number };
      const ws = W.saetze.map((x): Wertesatz => {
        const ke = x.id ? k.get(x.id) : undefined;
        if (ke) return { name: ke.name, quelle: quelleText(k, ke), id: wertekasten(ke) ? ke.id : null };
        return { name: x.name ?? x.id ?? '?', quelle: x.werk ? `${x.werk} S. ${x.seite}` : 'Paket nicht geladen', id: null };
      });
      return { zauber: e, grad, epJeVerstaerkung: Number(W.ep_je_verstaerkung) || 0, wertesaetze: ws };
    }).sort((a, b) => a.grad - b.grad || a.zauber.name.localeCompare(b.zauber.name, 'de'));
}

/** Heldengrad, dessen Grenzen für neu gekaufte Punkte gelten (nach Zaubergrad, aus dem Paket) */
export function grenzHeldengrad(k: Katalog, grad: number): number | null {
  const t = untoteRegeln(k)?.grenze_nach_zaubergrad ?? [];
  return [...t].sort((a, b) => a.zaubergrad_bis - b.zaubergrad_bis).find(z => grad <= z.zaubergrad_bis)?.heldengrad ?? null;
}
/** EP für n Fertigkeitspunkte „von 0 an“ (Kernregeln) */
export const fertigkeitKosten = (k: Katalog, n: number) => fertigkeitspunkteKosten(k, n) ?? 0;
/** EP für n Attributsteigerungen (Kernregeln); über der Tabelle: null */
export const attributKosten = (k: Katalog, n: number) => attributSteigerungKosten(k, n);
/** Schwelle der freien Meisterschaft nach gesteigerten Punkten (Kernregeln) */
export const freieSchwelle = (k: Katalog, n: number) => schwelleNachPunkten(k, n);

const nameVon = (k: Katalog, id: string | undefined) => (id && k.get(id)?.name) || 'die nötige Meisterschaft';

/** Meisterschaften des Charakters, die bei Untoten etwas erlauben (IDs aus dem Paket) */
export function nekromantenMeisterschaften(k: Katalog, masteries: Record<string, Mastery[]> | undefined) {
  const r = untoteRegeln(k);
  const ids = new Set(Object.entries(masteries ?? {}).flatMap(([f, l]) => l.map(m => meisterschaftId(k, m.name, f))).filter(Boolean));
  return {
    nekromant: !!r?.verstaerkung_mehrfach && ids.has(r.verstaerkung_mehrfach),
    meisterDerAbnormitaeten: !!r?.abnormitaet && ids.has(r.abnormitaet.meisterschaft),
    mehrfachMit: nameVon(k, r?.verstaerkung_mehrfach),
  };
}

export interface UntotWerte {
  erhebung: Erhebung | null;
  wertesatz: { name: string; quelle: string; id: string | null } | null;
  werte: Werteblock | null;
  epGesamt: number; epVerbraucht: number;
  posten: { text: string; ep: number }[];
  grenze: number;
  /** ein Platz je erreichter Schwelle einer gesteigerten Fertigkeit */
  freieMeisterschaften: { fertigkeitId: string; fertigkeit: string; schwelle: number }[];
  /** gewählte freie Meisterschaften (b.meisterschaften) mit Platzprüfung */
  meisterschaften: { id: string; name: string; fertigkeit: string; schwelle: number; ok: boolean }[];
  abnormitaet: Eintrag | null;
  abnormitaetText: string;
  hinweise: string[];
  /** Hinweise, die ein Regelverstoß sind */
  verstoesse: Verstoss[];
}

export function untotWerte(k: Katalog, b: Begleiter, opt: { nekromant: boolean; meisterDerAbnormitaeten: boolean }): UntotWerte {
  const hinweise: string[] = [];
  const verstoesse: Verstoss[] = [];
  const verstoss = (text: string, schluessel: string, mass = 1) => { hinweise.push(text); verstoesse.push({ text, schluessel, mass }); };
  const erhebung = erhebungen(k).find(x => x.zauber.id === b.erhebung) ?? null;
  const wertesatz = erhebung?.wertesaetze.find(w => w.id === b.id || w.name === b.name) ?? null;
  const R = untoteRegeln(k);
  if (!R) hinweise.push('Regeln zur Steigerung von Untoten fehlen (Band nicht geladen)');
  const grad = erhebung?.grad ?? 0;
  const grenze = hoechstePunkteHeldengrad(k, grenzHeldengrad(k, grad) ?? 0) ?? 0;
  const verst = b.verstaerkungen ?? 0;
  if (verst > 1 && !opt.nekromant) verstoss(`Die Verstärkung mehrfach zu wählen erfordert die Meisterschaft ${nameVon(k, R?.verstaerkung_mehrfach)}`, 'verstaerkung', verst - 1);
  const epGesamt = verst * (erhebung?.epJeVerstaerkung ?? 0);

  const st = b.steigerung ?? {};
  const posten: { text: string; ep: number }[] = [];
  for (const [a, n] of Object.entries(st.attribute ?? {})) if (n > 0) {
    const ep = attributKosten(k, n);
    if (ep === null) verstoss(`${a}: so viele Attributsteigerungen kennt die Steigerungstabelle nicht`, `attribut:${a}`, n);
    posten.push({ text: `${a} +${n}`, ep: ep ?? 0 });
  }
  const freieMeisterschaften: UntotWerte['freieMeisterschaften'] = [];
  for (const [f, n] of Object.entries(st.fertigkeiten ?? {})) {
    if (n <= 0) continue;
    const name = f === ANGRIFF ? 'Angriff' : k.get(f)?.name ?? f;
    posten.push({ text: `${name} +${n}`, ep: fertigkeitKosten(k, n) });
    if (n > grenze) verstoss(`${name}: höchstens ${grenze} neue Punkte (Zaubergrad ${grad})`, `grenze:${f}`, n - grenze);
    if (f !== ANGRIFF && ((R?.nicht_steigerbar ?? []).includes(f) || (R?.keine_kategorien ?? []).includes(k.get(f)?.daten.kategorie))) verstoss(`${name} kann ein erhobener Untoter nicht steigern`, `nicht:${f}`, n);
    if (f !== ANGRIFF) for (let j = 1; j <= freieSchwelle(k, n); j++) freieMeisterschaften.push({ fertigkeitId: f, fertigkeit: name, schwelle: j });
  }
  // gewählte freie Meisterschaften: je Platz eine, Schwelle höchstens die des Platzes
  const frei = [...freieMeisterschaften];
  const meisterschaften = (b.meisterschaften ?? []).map(id => {
    const m = k.get(id); const f: string = m?.daten.fertigkeit ?? ''; const sw = Number(m?.daten.schwelle) || 1;
    const i = frei.filter(p => p.fertigkeitId === f && p.schwelle >= sw).sort((x, y) => x.schwelle - y.schwelle)[0];
    if (i) frei.splice(frei.indexOf(i), 1);
    return { id, name: m?.name ?? id, fertigkeit: k.get(f)?.name ?? f, schwelle: sw, ok: !!i };
  });
  const ohnePlatz = meisterschaften.filter(m => !m.ok).length;
  if (ohnePlatz) verstoss(`${ohnePlatz} Meisterschaft(en) ohne freien Platz (Fertigkeit nicht genug gesteigert)`, 'meisterschaften', ohnePlatz);

  const abnormitaet = b.abnormitaet ? k.get(b.abnormitaet) ?? null : null;
  if (abnormitaet) {
    posten.push({ text: `Abnormität ${abnormitaet.name}`, ep: Number(abnormitaet.daten.kosten_ep) || 0 });
    if (!opt.meisterDerAbnormitaeten) verstoss(`Abnormitäten erfordern die Meisterschaft ${nameVon(k, R?.abnormitaet?.meisterschaft)}`, 'abnormitaet');
  }
  const epVerbraucht = posten.reduce((s, p) => s + p.ep, 0);
  if (epVerbraucht > epGesamt) verstoss(`${epVerbraucht} EP verteilt, aber nur ${epGesamt} EP aus der Verstärkung`, 'ep', epVerbraucht - epGesamt);
  if (!erhebung) hinweise.push('Erhebungszauber nicht im Katalog');

  // Werte: Wertesatz, Verstand 0, Steigerungen mit Auswirkung auf abgeleitete Werte, Abnormität
  let werte: Werteblock | null = null;
  const e = k.get(b.id);
  if (e && wertekasten(e)) {
    const w = werteblock(k, e.daten.werte_berechnet ?? e.daten);
    // gekaufte Attributpunkte; der Verstand frisch erhobener Untoter (Paket) ändert keine sonstigen Werte
    const gek = (a: string) => st.attribute?.[a] ?? 0;
    const kurz = (name: string) => Object.keys(KURZ_NAME).find(x => KURZ_NAME[x] === name);
    const attribute = Object.fromEntries(ATTRIBUT_KURZ.map(a => [a, (a === 'VER' && R?.verstand_frisch !== undefined ? R.verstand_frisch : w.attribute[a]) + gek(a)]));
    const RA = k.get(ABGELEITET_ID)?.daten.strukturiert;
    const abgeleitet = { ...w.abgeleitet };
    for (const d of RA?.werte ?? []) {
      if (!('summe' in d) || abgeleitet[d.kuerzel] === undefined) continue;
      for (const t of d.summe) if ('attribut' in t) abgeleitet[d.kuerzel] += (t.faktor ?? 1) * gek(kurz(t.attribut) ?? '');
    }
    const attrVon = (id: string): string[] => (k.get(id)?.daten.attribute ?? []).map((n: string) => kurz(n)).filter((x: string | undefined): x is string => !!x);
    const fertigkeiten = w.fertigkeiten.map(f => ({ ...f, wert: f.wert + (f.id ? (st.fertigkeiten?.[f.id] ?? 0) + attrVon(f.id).reduce((s, a) => s + gek(a), 0) : 0) }));
    for (const [f, n] of Object.entries(st.fertigkeiten ?? {}))
      if (f !== ANGRIFF && n > 0 && !fertigkeiten.some(x => x.id === f)) fertigkeiten.push({ id: f, name: k.get(f)?.name ?? f, wert: n + attrVon(f).reduce((s, a) => s + attribute[a], 0) });
    fertigkeiten.sort((x, y) => x.name.localeCompare(y.name, 'de'));
    const angriff = (st.fertigkeiten?.[ANGRIFF] ?? 0) + (R?.angriff_attribute ?? []).reduce((x: number, a: string) => x + gek(a), 0);
    const waffen = w.waffen.map(x => ({ ...x, wert: x.wert + angriff }));
    const gewaehlt = meisterschaften.filter(m => m.ok).map(m => `${m.fertigkeit} (${m.name})`);
    werte = { ...w, attribute, abgeleitet, fertigkeiten, waffen, meisterschaften: [w.meisterschaften, ...gewaehlt].filter(Boolean).join(', ') || undefined };
    if (abnormitaet) {
      const m = ausStruktur(abnormitaet.daten.modifikationen_strukturiert);
      werte = anwenden(k, werte, m);
    }
  } else if (wertesatz) {
    hinweise.push(`Wertesatz ${wertesatz.name} steht nicht in den Regelpaketen – Werte aus ${wertesatz.quelle}`);
  }
  return { erhebung, wertesatz, werte, epGesamt, epVerbraucht, posten, grenze, freieMeisterschaften, meisterschaften, abnormitaet, abnormitaetText: String(abnormitaet?.daten.beschreibung ?? ''), hinweise, verstoesse };
}

export const abnormitaeten = (k: Katalog) => Object.values(k.eintraege).filter(e => e.typ === 'abnormitaet').sort((a, b) => a.name.localeCompare(b.name, 'de'));

/** Meisterschaften einer Fertigkeit bis zu einer Schwelle (für die freien Plätze) */
export function meisterschaftenBis(k: Katalog, fertigkeit: string, schwelle: number) {
  return Object.values(k.eintraege).filter(e => e.typ === 'meisterschaft' && e.daten.fertigkeit === fertigkeit && (Number(e.daten.schwelle) || 1) <= schwelle)
    .map(e => ({ id: e.id, name: e.name, schwelle: Number(e.daten.schwelle) || 1 })).sort((a, b) => a.schwelle - b.schwelle || a.name.localeCompare(b.name, 'de'));
}

/** Fertigkeiten, die ein erhobener Untoter steigern darf (laut Paket) */
export function steigerbareFertigkeiten(k: Katalog) {
  return Object.values(k.eintraege).filter(e => e.typ === 'fertigkeit' && !e.daten.gruppierte_fertigkeit
    && !(untoteRegeln(k)?.keine_kategorien ?? []).includes(e.daten.kategorie) && !(untoteRegeln(k)?.nicht_steigerbar ?? []).includes(e.id)).sort((x, y) => x.name.localeCompare(y.name, 'de'));
}
