/**
 * Steigerungsregeln aus dem Grundregelwerk-Paket (FUNDAMENT.md, Regelquellen):
 * Kosten in Erfahrungspunkten und Heldengrade stehen in den Kernregeln (`strukturiert`), nicht im Programmcode.
 * Jede Funktion liefert null, wenn kein Paket geladen ist oder der Wert fehlt.
 */
import { aktiverKatalog } from './bruecke';
import type { Katalog } from './katalog';

const KOSTEN_ID = 'grw:regel:steigerung-regeln:erfahrungspunkte-einsetzen';
const GRADE_ID = 'grw:regel:steigerung-regeln:auswirkungen';

interface Kosten {
  attribut?: { steigerung: number; kosten_ep: number }[];
  fertigkeitspunkt?: { bis_wert: number; kosten_ep_pro_punkt: number }[];
  staerke?: Record<string, number>;
  sprache?: number;
  ressource_pro_punkt?: number;
  zauber_nach_grad?: { grad: number; kosten_ep: number; mindest_fertigkeitspunkte_magieschule: number }[];
  meisterschaft_nach_schwelle?: { schwelle: number; kosten_ep: number }[];
}

function strukturiert<T>(id: string, feld: string, k: Katalog | null): T | null {
  const d = k?.get(id)?.daten as { strukturiert?: Record<string, unknown> } | undefined;
  return (d?.strukturiert?.[feld] as T | undefined) ?? null;
}

const kosten = (k: Katalog | null) => strukturiert<Kosten>(KOSTEN_ID, 'steigerungskosten', k);
const zahl = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Kosten des Fertigkeitspunkts, der die Fertigkeit auf `neuerWert` bringt */
export function kostenFertigkeitspunkt(neuerWert: number, k = aktiverKatalog()): number | null {
  const t = kosten(k)?.fertigkeitspunkt;
  if (!t?.length) return null;
  const zeile = [...t].sort((a, b) => a.bis_wert - b.bis_wert).find((z) => neuerWert <= z.bis_wert) ?? t[t.length - 1];
  return zahl(zeile.kosten_ep_pro_punkt);
}

/** Kosten der n-ten Steigerung eines Attributs (n ab 1) */
export function kostenAttribut(n: number, k = aktiverKatalog()): number | null {
  return zahl(kosten(k)?.attribut?.find((z) => z.steigerung === n)?.kosten_ep);
}

export function kostenStaerke(stufe: number, k = aktiverKatalog()): number | null {
  return zahl(kosten(k)?.staerke?.[`stufe_${stufe}`]);
}

export function kostenSprache(k = aktiverKatalog()): number | null { return zahl(kosten(k)?.sprache); }
export function kostenRessourcenpunkt(k = aktiverKatalog()): number | null { return zahl(kosten(k)?.ressource_pro_punkt); }

export function kostenZauber(grad: number, k = aktiverKatalog()): number | null {
  return zahl(kosten(k)?.zauber_nach_grad?.find((z) => z.grad === grad)?.kosten_ep);
}

/** Fertigkeitspunkte in der Magieschule, die ein Zauber dieses Grads voraussetzt */
export function mindestpunkteZauber(grad: number, k = aktiverKatalog()): number | null {
  return zahl(kosten(k)?.zauber_nach_grad?.find((z) => z.grad === grad)?.mindest_fertigkeitspunkte_magieschule);
}

export function kostenMeisterschaft(schwelle: number, k = aktiverKatalog()): number | null {
  return zahl(kosten(k)?.meisterschaft_nach_schwelle?.find((z) => z.schwelle === schwelle)?.kosten_ep);
}

export interface Heldengrad { nr: number; name: string; minXP: number; maxAttrMod: number; maxSkill: number; resistBonus: number }

const zahlAus = (text: unknown): number => { const m = String(text ?? '').match(/[+-]?\d+/); return m ? Number(m[0]) : 0; };
let gradCache: { k: Katalog; liste: Heldengrad[] } | null = null;

/** Heldengrade aus der Tabelle „Auswirkungen der Heldengrade“; der Widerstandsbonus wird über die Grade aufsummiert */
export function heldengrade(k = aktiverKatalog()): Heldengrad[] | null {
  if (!k) return null;
  if (gradCache?.k === k) return gradCache.liste;
  const t = strukturiert<Record<string, unknown>[]>(GRADE_ID, 'heldengrade', k);
  if (!t?.length) return null;
  let widerstand = 0;
  const liste = [...t].sort((a, b) => Number(a.grad) - Number(b.grad)).map((z) => {
    widerstand += zahlAus(z.widerstaende);
    return { nr: Number(z.grad), name: `Heldengrad ${z.grad} (${z.name})`, minXP: Number(z.noetige_ep) || 0, maxAttrMod: zahlAus(z.max_attributssteigerung), maxSkill: Number(z.max_fertigkeitspunkte) || 0, resistBonus: widerstand };
  });
  gradCache = { k, liste };
  return liste;
}
