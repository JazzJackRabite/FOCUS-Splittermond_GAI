/**
 * Zustände aus den Regelpaketen (FUNDAMENT.md, Regelquellen): Die Zustände des Grundregelwerks kommen aus dem
 * Grundregelwerk-Paket, alle anderen aus den hochgeladenen Grimoires.
 * Stufe, Abzüge und Quelle stehen im Eintrag vom Typ `zustand` (`hat_stufe`/`parameter`, `zustandswirkung`, `quelle`).
 * „Liegend“ ist kein Zustand, sondern eine Kampfposition (GRW S. 170); der Editor führt sie in derselben Auswahl,
 * weil sie am Spieltisch genauso an- und abgelegt wird.
 * Ohne geladenes Paket gibt es keine Zustände (der Editor startet erst mit Paket).
 */
import { aktiverKatalog } from './bruecke';
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';
import type { Zustandswirkung } from '../types/regeldaten';
import { quelleText } from './relikte';

export const KAMPFPOSITION_LIEGEND = 'Liegend';

/** Wann ein Zustand durch eine Pause endet (Datenseite: pause_ende) */
export interface PauseEnde { verschnaufpause?: 'aufheben' | 'stufe'; ruhephase?: 'aufheben' | 'stufe' }
export interface Zustandsangabe { name: string; mitStufe: boolean; quelle: string; id?: string; wirkung?: Zustandswirkung; beschreibung?: string; pauseEnde?: PauseEnde;
  /** Beleg, wenn der Zustand natürliche Heilung verhindert (Datenseite: keine_natuerliche_heilung) */
  ohneNatuerlicheHeilung?: string }

let cache: { k: Katalog | null; liste: Zustandsangabe[] } | null = null;

function ausEintrag(k: Katalog, e: Eintrag): Zustandsangabe {
  const d = (e.daten ?? {}) as { hat_stufe?: boolean; parameter?: unknown; zustandswirkung?: Zustandswirkung; beschreibung?: string; pause_ende?: PauseEnde; keine_natuerliche_heilung?: { beleg: string } };
  const p = Array.isArray(d.parameter) ? d.parameter.join(',') : String(d.parameter ?? '');
  return { name: e.name, mitStufe: d.hat_stufe ?? /\bStufe\b/.test(p), quelle: quelleText(k, e), id: e.id, wirkung: d.zustandswirkung, beschreibung: d.beschreibung,
    ...(d.pause_ende ? { pauseEnde: { verschnaufpause: d.pause_ende.verschnaufpause, ruhephase: d.pause_ende.ruhephase } } : {}),
    ...(d.keine_natuerliche_heilung ? { ohneNatuerlicheHeilung: d.keine_natuerliche_heilung.beleg } : {}) };
}

/** Alle wählbaren Zustände, alphabetisch: aus den geladenen Paketen */
export function zustandsliste(k: Katalog | null = aktiverKatalog()): Zustandsangabe[] {
  if (cache && cache.k === k) return cache.liste;
  const nachName = new Map<string, Zustandsangabe>();
  if (k) for (const e of k.nachTyp('zustand')) if (!nachName.has(e.name)) nachName.set(e.name, ausEintrag(k, e));
  if (k) nachName.set(KAMPFPOSITION_LIEGEND, { name: KAMPFPOSITION_LIEGEND, mitStufe: false, quelle: 'GRW S. 170 (Kampfposition)' });
  const liste = [...nachName.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  cache = { k, liste };
  return liste;
}

/**
 * Um wie viele Gesundheitsstufen Zustände den Wundabzug verschieben (zustandswirkung.probe.art „wundstufe“,
 * GRW: Verwundet, je Stufe eine Gesundheitsstufe tiefer). Der Wundabzug enthält das dann schon; kein eigener Abzug je Zustand.
 */
export function wundstufenVerschiebung(zustaende: { key: string; level?: number | string }[] = [], k: Katalog | null = aktiverKatalog()): number {
  let n = 0;
  for (const c of zustaende) if (zustand(c.key, k)?.wirkung?.probe?.art === 'wundstufe') n += Number(c.level) || 1;
  return n;
}

export function zustand(name: string, k: Katalog | null = aktiverKatalog()): Zustandsangabe | undefined {
  return zustandsliste(k).find((z) => z.name === name);
}

export function alleZustaende(k: Katalog | null = aktiverKatalog()): string[] {
  return zustandsliste(k).map((z) => z.name);
}

export function zustandHatStufe(name: string, k: Katalog | null = aktiverKatalog()): boolean {
  return zustand(name, k)?.mitStufe ?? false;
}

export function istZustand(name: string, k: Katalog | null = aktiverKatalog()): boolean {
  return !!zustand(name, k);
}

/** Quellenangabe für die Anzeige beim Überfahren mit der Maus, z. B. „GRW S. 168“ */
export function zustandQuelle(name: string, k: Katalog | null = aktiverKatalog()): string {
  return zustand(name, k)?.quelle ?? '';
}

/**
 * Zustände nach einer Pause (Paketfeld pause_ende, z. B. GRW S. 168–169: Erschöpft verliert je Verschnaufpause eine Stufe,
 * Glaubenskrise und Lahm enden nach einer Verschnaufpause).
 * Ruhephase: eigene Angabe des Zustands, sonst die der Verschnaufpause; „eine Stufe je Verschnaufpause“ baut die Ruhephase
 * ganz ab (Auslegung: sie dauert sechs Stunden, also ein Vielfaches einer Verschnaufpause).
 * `stufen`: wie viele Stufen eine Verschnaufpause abbaut (Standard 1, im Rast-Dialog einstellbar); `aufheben`: Zustände,
 * die laut Paket enden, wirklich aufheben (im Rast-Dialog abwählbar).
 */
export function nachPause<Z extends { key: string; level?: number }>(zustaende: Z[], art: 'verschnaufpause' | 'ruhephase', k: Katalog | null = aktiverKatalog(), stufen = 1, aufheben = true): Z[] {
  const out: Z[] = [];
  for (const z of zustaende) {
    const pe = zustand(z.key, k)?.pauseEnde;
    const regel = art === 'ruhephase' ? (pe?.ruhephase ?? (pe?.verschnaufpause ? (pe.verschnaufpause === 'stufe' ? 'aufheben' : pe.verschnaufpause) : undefined)) : pe?.verschnaufpause;
    if (regel === 'aufheben' && aufheben) continue;
    if (regel === 'stufe' && stufen > 0) {
      const rest = (z.level ?? 1) - stufen;
      if (rest > 0) out.push({ ...z, level: rest });
      continue;
    }
    out.push(z);
  }
  return out;
}

/**
 * Zustände, die natürliche Heilung verhindern (Paketfeld keine_natuerliche_heilung, z. B. GRW Sterbend: „kann nicht von
 * natürlicher Heilung profitieren“). Solange einer besteht, heilen Verschnaufpause und Ruhephase keine Lebenspunkte;
 * Heilkunde und Heilungsmagie bleiben möglich. Rückgabe: die Namen der aktiven Zustände dieser Art.
 */
export function ohneNatuerlicheHeilung(zustaende: { key: string }[], k: Katalog | null = aktiverKatalog()): string[] {
  return [...new Set(zustaende.filter((z) => zustand(z.key, k)?.ohneNatuerlicheHeilung).map((z) => z.key))];
}

/**
 * Kurzer Text, welche Zustände eine Pause laut Paket aufhebt oder abbaut (für die Rast-Ansicht), z. B.
 * „baut je 1 Stufe Erschöpft ab, hebt Glaubenskrise und Lahm auf“. Leer, wenn kein geladener Zustand ein Pausenende hat.
 */
export function pausenZustandstext(art: 'verschnaufpause' | 'ruhephase', k: Katalog | null = aktiverKatalog(), stufen = 1): string {
  const auf: string[] = []; const ab: string[] = [];
  for (const z of zustandsliste(k)) {
    const pe = z.pauseEnde;
    const regel = art === 'ruhephase' ? (pe?.ruhephase ?? (pe?.verschnaufpause === 'stufe' ? 'aufheben' : pe?.verschnaufpause)) : pe?.verschnaufpause;
    if (regel === 'aufheben') auf.push(z.name);
    else if (regel === 'stufe') ab.push(z.name);
  }
  const liste = (n: string[]) => (n.length > 1 ? `${n.slice(0, -1).join(', ')} und ${n[n.length - 1]}` : n[0]);
  const teile = [ab.length ? `baut je ${stufen} Stufe ${liste(ab)} ab` : '', auf.length ? `hebt ${liste(auf)} auf` : ''].filter(Boolean);
  return teile.join(', ');
}
