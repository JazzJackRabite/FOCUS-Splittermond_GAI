/**
 * Abgeleitete Werte aus den Formeln des Grundregelwerks (daten.strukturiert von
 * grw:regel:abgeleitete-werte-regeln:berechnung-der-abgeleiteten-werte). Portierung von abgeleitete_werte() aus Pruefsuite/lader.py.
 */
import type { Katalog } from './katalog';

export const ABGELEITET_ID = 'grw:regel:abgeleitete-werte-regeln:berechnung-der-abgeleiteten-werte';

/** Attribute mit vollen Namen: Ausstrahlung, Beweglichkeit, Intuition, Konstitution, Mystik, Stärke, Verstand, Willenskraft */
export type Attribute = Record<string, number>;

export interface BedingterBonus { wert: string; bonus: number; bedingung: string; quelle: string }

export interface AbgeleiteteWerte {
  werte: Record<string, number>;
  bedingt: BedingterBonus[];
  hinweise: string[];
  /** Höchstbonus je Quelle (Ausrüstung, Zauberei) nach Heldengrad und Stärken (GRW S. 18) */
  hoechstbonus: number;
}

export function abgeleiteteWerte(kat: Katalog, attribute: Attribute, rasse: string, staerken: string[] = [], heldengrad = 1,
  ausruestung: string[] = [], gesundheitsstufe = 1): AbgeleiteteWerte {
  const R = kat.get(ABGELEITET_ID)!.daten.strukturiert;
  const hinweise: string[] = [];
  const gk: number = kat.get(rasse)!.daten.groessenklasse;
  const tab: Record<number, Record<string, number>> = {};
  for (const g of R.groessenklassen) tab[g.groessenklasse] = g;
  const w: Record<string, number> = { GK: gk };
  for (const d of R.werte) {
    if (!('summe' in d)) continue;
    let s = 0;
    for (const t of d.summe) {
      if ('konstante' in t) s += t.konstante;
      else if ('attribut' in t) s += attribute[t.attribut] * (t.faktor ?? 1);
      else if ('wert' in t) s += w[t.wert];
      else if ('groessenklasse_tabelle' in t) s += tab[gk][t.groessenklasse_tabelle];
    }
    w[d.kuerzel] = s;
  }
  for (const m of R.modifikatoren) {
    if (m.quelle === 'heldengrad') for (const z of m.ziele) w[z] += m.wert * (heldengrad - 1);
  }
  const bedingt: BedingterBonus[] = [];
  const summeSt = new Map<string, number>();
  let hb: number = R.hoechstbonus.je_quelle_nach_heldengrad[String(heldengrad)];
  const anzahl = (sid: string) => staerken.filter(x => x === sid).length;
  for (const sid of staerken) {
    for (const m of kat.get(sid)?.daten.abgeleitete_werte_modifikatoren ?? []) {
      if (m.bedingt) { bedingt.push({ wert: m.abgeleiteter_wert, bonus: m.bonus, bedingung: m.bedingt, quelle: sid }); continue; }
      if (m.abgeleiteter_wert === 'hoechstbonus') { hb += m.bonus; continue; }
      const k: string = m.abgeleiteter_wert; const key = sid + '|' + k;
      const neu = (summeSt.get(key) ?? 0) + m.bonus;
      if (m.hoechstbonus && Math.abs(neu) > m.hoechstbonus) { hinweise.push(`${sid}: Höchstbonus ${m.hoechstbonus} erreicht`); continue; }
      if (typeof m.mehrfach === 'number' && anzahl(sid) > m.mehrfach) hinweise.push(`${sid}: höchstens ${m.mehrfach}× wählbar`);
      if (m.mehrfach === 'einmal pro Heldengrad' && anzahl(sid) > heldengrad) hinweise.push(`${sid}: nur einmal pro Heldengrad wählbar`);
      summeSt.set(key, neu); w[k] = (w[k] ?? 0) + m.bonus;
    }
  }
  // Ausrüstung: VTD-Bonus zählt zur Quelle Ausrüstung (Höchstbonus), Behinderung halbiert auf GSW
  let vtdAus = 0; let beh = 0;
  const kurz: Record<string, string> = {};
  for (const a of R.attribute) kurz[a.kuerzel] = a.name;
  for (const aid of ausruestung) {
    const d = kat.get(aid)!.daten;
    vtdAus += d.vtd_bonus || 0;
    let b: number = d.behinderung || 0;
    if (d.mindest_staerke) b += Math.max(0, d.mindest_staerke - attribute['Stärke']);
    for (const [k, v] of Object.entries((d.mindestattribute || {}) as Record<string, number>)) b += Math.max(0, v - attribute[kurz[k]]);
    beh += b;
  }
  if (vtdAus > hb) { hinweise.push(`VTD-Bonus aus Ausrüstung ${vtdAus} auf Höchstbonus ${hb} begrenzt`); vtdAus = hb; }
  w.VTD += vtdAus;
  if (beh) {
    if (R.rundung.art !== 'kaufmännisch') throw new Error('Rundungsregel unbekannt: ' + R.rundung.art);
    w.GSW -= Math.trunc(beh / 2 + 0.5); // halbe Gesamt-Behinderung, kaufmännisch gerundet (GRW S. 11)
  }
  const wa = R.gesundheitsstufen.find((g: { stufe: number }) => g.stufe === gesundheitsstufe).wundabzug;
  if (wa) { w.GSW += wa; w.INI -= wa; } // Malus: GSW sinkt, INI (kleiner ist besser) steigt
  w.GSW = Math.max(0, w.GSW);
  w.LP_gesamt = w.LP * 5;
  return { werte: w, bedingt, hinweise, hoechstbonus: hb };
}

// ---------------------------------------------------------------- Steigerung (Kernregeln GRW S. 25, 87–88)
export const STEIGERUNG_ID = 'grw:regel:steigerung-regeln:erfahrungspunkte-einsetzen';
export const HELDENGRADE_ID = 'grw:regel:steigerung-regeln:auswirkungen';
export const ERSCHAFFUNG_ID = 'grw:regel:erschaffung-regeln:uebersicht-ueber-die-charaktererschaffung';

interface Steigerungskosten {
  attribut: { steigerung: number; kosten_ep: number }[];
  fertigkeitspunkt: { bis_wert: number; kosten_ep_pro_punkt: number }[];
  zauber_nach_grad: { grad: number; mindest_fertigkeitspunkte_magieschule: number }[];
  meisterschaft_nach_schwelle: { schwelle: number; mindest_fertigkeitspunkte: number }[];
}
function steigerung(k: Katalog): Steigerungskosten | null { return k.get(STEIGERUNG_ID)?.daten.strukturiert?.steigerungskosten ?? null; }

/** EP für n Fertigkeitspunkte „von 0 an“ nach der Tabelle der Steigerungskosten; null ohne Kernregeln */
export function fertigkeitspunkteKosten(k: Katalog, n: number): number | null {
  const t = steigerung(k)?.fertigkeitspunkt; if (!t?.length) return null;
  let s = 0;
  for (let p = 1; p <= n; p++) s += (t.find((z) => p <= z.bis_wert) ?? t[t.length - 1]).kosten_ep_pro_punkt;
  return s;
}
/** EP für n Attributsteigerungen (erste, zweite, …); null ohne Kernregeln oder über der Tabelle */
export function attributSteigerungKosten(k: Katalog, n: number): number | null {
  const t = steigerung(k)?.attribut; if (!t?.length || n > t.length) return null;
  return t.slice(0, n).reduce((s, z) => s + z.kosten_ep, 0);
}
/** höchste Meisterschaftsschwelle, die n Fertigkeitspunkte erlauben (0 = keine) */
export function schwelleNachPunkten(k: Katalog, n: number): number {
  return Math.max(0, ...(steigerung(k)?.meisterschaft_nach_schwelle ?? []).filter((z) => n >= z.mindest_fertigkeitspunkte).map((z) => z.schwelle));
}
/** höchster Zaubergrad, den n Punkte in einer Magieschule erlauben (−1 = keiner) */
export function zaubergradNachPunkten(k: Katalog, n: number): number {
  return Math.max(-1, ...(steigerung(k)?.zauber_nach_grad ?? []).filter((z) => n >= z.mindest_fertigkeitspunkte_magieschule).map((z) => z.grad));
}
/** freie Zauber einer Magieschule bei n Punkten (Feinschliff der Erschaffung): je erreichter Stufe ein Zauber dieses Grades */
export function freieZauberNachPunkten(k: Katalog, n: number): number[] {
  const t: { grad: number; ab_fertigkeitspunkten: number }[] = k.get(ERSCHAFFUNG_ID)?.daten.strukturiert?.feinschliff?.freie_zauber_je_magieschule ?? [];
  return t.filter((z) => n >= z.ab_fertigkeitspunkten).map((z) => z.grad);
}
/** Punkte in einer Magieschule, ab denen je ein freier Zauber dazukommt (Feinschliff, GRW S. 26), z. B. [1, 3, 6] */
export function freieZauberSchwellen(k: Katalog | null): number[] {
  const t: { ab_fertigkeitspunkten: number }[] = k?.get(ERSCHAFFUNG_ID)?.daten.strukturiert?.feinschliff?.freie_zauber_je_magieschule ?? [];
  return t.map((z) => z.ab_fertigkeitspunkten);
}
/** Grade der freien Zauber einer Magieschule bei n Punkten: je erreichter Schwelle einer (GRW S. 26 und S. 200) */
export function freieZauberGrade(n: number, k: Katalog | null): number[] {
  if (!k) return [];
  return (steigerung(k)?.zauber_nach_grad ?? []).filter((z) => n >= z.mindest_fertigkeitspunkte_magieschule).map((z) => z.grad);
}

/** höchste Fertigkeitspunkte eines Heldengrades */
export function hoechstePunkteHeldengrad(k: Katalog, hg: number): number | null {
  const t: { grad: number; max_fertigkeitspunkte: number }[] = k.get(HELDENGRADE_ID)?.daten.strukturiert?.heldengrade ?? [];
  return t.find((z) => z.grad === hg)?.max_fertigkeitspunkte ?? null;
}
