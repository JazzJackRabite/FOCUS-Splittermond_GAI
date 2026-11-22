/**
 * Pausen und Wirkungen von Stärken und Meisterschaften, die der Editor früher nach Namen im Code hatte (FUNDAMENT.md, Regelquellen):
 * - ruheregeln: Ruhephase (LP aus Konstitution × Faktor, verzehrter Fokus aus Willenskraft × Faktor, Dauer) und Verschnaufpause
 *   aus `daten.ruheregeln` der Kernregel „Heilung“ (GRW S. 173–174, 196)
 * - ruhewirkungen: `daten.ruhewirkung` der Stärken und Meisterschaften des Charakters (z. B. Erhöhte Lebensregeneration ×3)
 * - wundabzugMinderung: Wirkungen „Wundabzug gesenkt“ (Schmerzresistenz, Schmerzwiderstand)
 * - ausruestungsMinderung: Wirkungen „Behinderung“ bzw. „Tick-Zuschlag gesenkt“ mit `gilt_fuer` Rüstung oder Schild
 * Ohne Paket: Grundwerte des Grundregelwerks, keine Minderungen.
 */
import type { CharacterState } from '../types';
import type { Katalog } from './katalog';
import { aktiverKatalog, idNachName, meisterschaftId } from './bruecke';
import { wirkungenDesCharakters } from './wirkungen';

const HEILUNG_ID = 'grw:regel:kampf-regeln:heilung';

export interface Ruheregeln {
  lpFaktor: number; lpMindestens: number; foFaktor: number; foMindestens: number; ruheStunden: number; verschnaufMinuten: number;
  /** Fundstelle für die Anzeige, z. B. „GRW S. 173–174“ */
  quelle: string;
}

export function ruheregeln(k: Katalog | null = aktiverKatalog()): Ruheregeln {
  const e = k?.get(HEILUNG_ID); const r = e?.daten.ruheregeln;
  const s = e?.quelle.buch_seiten ?? [173, 174];
  return {
    quelle: `GRW S. ${s.length > 1 ? `${s[0]}–${s[s.length - 1]}` : s[0]}`,
    lpFaktor: r?.ruhephase?.lp?.faktor ?? 0, lpMindestens: r?.ruhephase?.lp?.mindestens ?? 0,
    foFaktor: r?.ruhephase?.fo_verzehrt?.faktor ?? 0, foMindestens: r?.ruhephase?.fo_verzehrt?.mindestens ?? 0,
    ruheStunden: r?.ruhephase?.dauer_stunden ?? 0, verschnaufMinuten: r?.verschnaufpause?.dauer_minuten ?? 0,
  };
}

export interface Ruhewirkung {
  quelle: string; quelleTyp: 'Stärke' | 'Meisterschaft';
  lp_faktor?: number; fo_faktor?: number; lp_zusatz?: number; erschoepft_minuten?: number; fo_erschoepft_minuten?: number;
  regeneration_faktor?: number; bedingung?: string; beleg: string;
}

type MitListen = Pick<CharacterState, 'strengthsList' | 'masteries'>;

/** IDs der Stärken und Meisterschaften des Charakters im Katalog */
function eintragsIds(k: Katalog, c: MitListen): string[] {
  const ids: string[] = [];
  for (const s of c.strengthsList ?? []) { const i = idNachName(k, 'staerke', s.name.replace(/\s*\(.*\)\s*$/, '')); if (i) ids.push(i); }
  for (const [skill, l] of Object.entries(c.masteries ?? {})) for (const m of l) { const i = meisterschaftId(k, m.name, skill); if (i) ids.push(i); }
  return [...new Set(ids)];
}

/** Ruhewirkungen der Stärken und Meisterschaften des Charakters */
export function ruhewirkungen(c: MitListen, k: Katalog | null = aktiverKatalog()): Ruhewirkung[] {
  if (!k) return [];
  const out: Ruhewirkung[] = [];
  for (const id of eintragsIds(k, c)) {
    const e = k.get(id); const w = e?.daten.ruhewirkung;
    if (!e || !w) continue;
    out.push({ quelle: e.name, quelleTyp: e.typ === 'staerke' ? 'Stärke' : 'Meisterschaft', ...w });
  }
  return out;
}

/** Regeneration in einer Ruhephase: LP und verzehrter Fokus, mit den unbedingten Ruhewirkungen */
export function ruhephasenRegeneration(kon: number, wil: number, liste: Ruhewirkung[], r: Ruheregeln = ruheregeln()): { lp: number; fo: number } {
  const fest = liste.filter((w) => !w.bedingung);
  const lpFaktor = Math.max(r.lpFaktor, ...fest.map((w) => w.lp_faktor ?? 0));
  const foFaktor = Math.max(r.foFaktor, ...fest.map((w) => w.fo_faktor ?? 0));
  const lp = Math.max(r.lpMindestens, kon * lpFaktor) + fest.reduce((n, w) => n + (w.lp_zusatz ?? 0), 0);
  const fo = Math.max(r.foMindestens, wil * foFaktor);
  return { lp, fo };
}

/** Wirkungen des Charakters, die immer gelten */
function dauerhafte(c: MitListen, k: Katalog) {
  return wirkungenDesCharakters(k, eintragsIds(k, c)).filter((cw) => cw.wirkung.gilt === 'immer' && cw.wirkung.art === 'wert_gesenkt' && typeof cw.wirkung.wert === 'number');
}

/** Um so viele Punkte sind Wundabzüge verringert (Schmerzresistenz, Schmerzwiderstand I/II, GRW S. 74, 123) */
export function wundabzugMinderung(c: MitListen, k: Katalog | null = aktiverKatalog()): { summe: number; quellen: string[] } {
  if (!k) return { summe: 0, quellen: [] };
  const l = dauerhafte(c, k).filter((cw) => cw.wirkung.bezug === 'wundabzug');
  return { summe: l.reduce((n, cw) => n + (cw.wirkung.wert as number), 0), quellen: l.map((cw) => cw.quelleName) };
}

/** Minderung von Behinderung und Tick-Zuschlag für Rüstung bzw. Schild (Rüstungsträger, Starker Schildarm, GRW S. 123) */
export function ausruestungsMinderung(c: MitListen, k: Katalog | null = aktiverKatalog()): Record<'ruestung' | 'schild', { behinderung: number; tick_zuschlag: number }> {
  const out = { ruestung: { behinderung: 0, tick_zuschlag: 0 }, schild: { behinderung: 0, tick_zuschlag: 0 } };
  if (!k) return out;
  for (const cw of dauerhafte(c, k)) {
    const g = cw.wirkung.gilt_fuer as 'ruestung' | 'schild' | undefined; const b = cw.wirkung.bezug;
    if (g && (b === 'behinderung' || b === 'tick_zuschlag')) out[g][b] += cw.wirkung.wert as number;
  }
  return out;
}

/** Traglast (Optionalregel GRW S. 165, Kernregel `strukturiert.traglast`): Last je Punkt Stärke, Behinderung je weiterem Lastpunkt */
export function traglast(k: Katalog | null = aktiverKatalog()): { attribut: string; lastJePunkt: number; behinderungJeLastpunkt: number } | null {
  const t = k?.get('grw:regel:ausruestungsregeln:traglast-optionalregel')?.daten.strukturiert?.traglast;
  return t ? { attribut: t.attribut, lastJePunkt: t.last_je_punkt, behinderungJeLastpunkt: t.behinderung_je_lastpunkt } : null;
}
