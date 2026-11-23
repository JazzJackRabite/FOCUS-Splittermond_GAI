/**
 * Geld rechnen (GRW: 1 Solar = 100 Lunare, 1 Lunar = 100 Telare).
 * - preisInTelare: Preistext aus Katalog oder Eingabe („16 L“, „2 L 50 T“, „1 S“, „1.000 L“, „0,5 L“) in Telare.
 *   Bei Munitionspreisen („10 L/20 T“) gilt der erste Teil: der Preis des Gegenstands selbst.
 * - bezahlen: zieht einen Betrag vom Geldbeutel ab. Erst kleine Münzen, größere werden nur angebrochen, wenn nötig;
 *   das Wechselgeld kommt als Lunare und Telare zurück. null, wenn das Geld nicht reicht.
 */
import type { Money } from '../types';

const WERT: Record<string, number> = { s: 10000, l: 100, t: 1 };

export function preisInTelare(text?: string | null): number | null {
  if (!text) return null;
  const teil = String(text).split('/')[0];
  let summe = 0;
  let gefunden = false;
  for (const m of teil.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(Solare?|Lunare?|Telare?|[SLT])\b/gi)) {
    const ganz = Number(m[1].replace(/\./g, ''));
    const bruch = m[2] ? Number(`0.${m[2]}`) : 0;
    summe += (ganz + bruch) * WERT[m[3][0].toLowerCase()];
    gefunden = true;
  }
  return gefunden ? Math.round(summe) : null;
}

export function geldInTelare(m: Money): number {
  return (m.solare ?? 0) * 10000 + (m.lunare ?? 0) * 100 + (m.telare ?? 0);
}

export function telareText(n: number): string {
  const s = Math.floor(n / 10000);
  const l = Math.floor((n % 10000) / 100);
  const t = n % 100;
  const teile = [s ? `${s} S` : '', l ? `${l} L` : '', t ? `${t} T` : ''].filter(Boolean);
  return teile.length ? teile.join(' ') : '0 T';
}

export function bezahlen(geld: Money, kosten: number): Money | null {
  if (kosten <= 0) return { ...geld };
  if (geldInTelare(geld) < kosten) return null;
  let s = geld.solare ?? 0;
  let l = geld.lunare ?? 0;
  let t = geld.telare ?? 0;
  let rest = kosten;
  const ausT = Math.min(t, rest); t -= ausT; rest -= ausT;
  if (rest > 0) { const ausL = Math.min(l, Math.ceil(rest / 100)); l -= ausL; rest -= ausL * 100; }
  if (rest > 0) { const ausS = Math.min(s, Math.ceil(rest / 10000)); s -= ausS; rest -= ausS * 10000; }
  if (rest > 0) return null;
  const wechsel = -rest;
  return { solare: s, lunare: l + Math.floor(wechsel / 100), telare: t + (wechsel % 100) };
}
