/**
 * Probenregeln aus dem GRW-Paket (GRW S. 16–20): Würfelarten, Patzer, Triumph, Erfolgsgrade und ihre Einstufung.
 * Gemeinsam für Fertigkeitsproben, Angriffe und Zauber. Ohne Paket gibt es weder Erfolgsgrade noch Patzer oder Triumph.
 */
import type { Katalog } from './katalog';
import { aktiverKatalog } from './bruecke';

const EG_ID = 'grw:regel:proben-regeln:erfolgsgrade-eg';
const PATZER_ID = 'grw:regel:proben-regeln:patzer';
const TRIUMPH_ID = 'grw:regel:proben-regeln:triumph';
const WURF_IDS = { standard: 'grw:regel:proben-regeln:der-standardwurf', safe: 'grw:regel:proben-regeln:der-sicherheitswurf', risk: 'grw:regel:proben-regeln:risikowurf' } as const;

export interface Probenregeln {
  punkteJeEg: number;
  patzerSummeHoechstens: number;
  patzerEg: number;
  patzerEgHoechstens: number;
  triumphSummeMindestens: number;
  triumphEg: number;
  /** Anzahl W10 je Wurfart (Standard-, Sicherheits-, Risikowurf) */
  wuerfel: { standard: number; safe: number; risk: number };
  /** Einstufung nach Erfolgsgraden: von oben nach unten, erste passende Stufe gilt */
  stufen: { egMin: number; egMax: number; nurBeiDifferenz?: 'positiv' | 'negativ'; einstufung: string }[];
  quelle: string;
}


/** „5 und mehr“, „3 bis 4“, „0“, „-1 bis -2“, „-5 und mehr“ in Grenzen übersetzen */
function egBereich(text: string): [number, number] | null {
  const t = text.replace(/−/g, '-').trim();
  let m = t.match(/^(-?\d+)\s*bis\s*(-?\d+)$/);
  if (m) { const a = +m[1], b = +m[2]; return [Math.min(a, b), Math.max(a, b)]; }
  m = t.match(/^(-?\d+)\s*und mehr$/);
  if (m) { const a = +m[1]; return a < 0 ? [-Infinity, a] : [a, Infinity]; }
  m = t.match(/^(-?\d+)$/);
  if (m) return [+m[1], +m[1]];
  return null;
}

const CACHE = new WeakMap<Katalog, Probenregeln>();
const anzahlW10 = (t: unknown): number | undefined => { const m = typeof t === 'string' ? t.match(/^(\d+)W10$/) : null; return m ? +m[1] : undefined; };

export function probenregeln(k: Katalog | null = aktiverKatalog()): Probenregeln {
  if (k && CACHE.has(k)) return CACHE.get(k)!;
  const eg = k?.get(EG_ID)?.daten.strukturiert;
  const pa = k?.get(PATZER_ID)?.daten.strukturiert;
  const tr = k?.get(TRIUMPH_ID)?.daten.strukturiert;
  let stufen: Probenregeln['stufen'] = [];
  if (Array.isArray(eg?.stufen)) {
    const s = (eg.stufen as { differenz: string; eg: string; einstufung: string }[]).map((x) => {
      const b = egBereich(x.eg); if (!b) return null;
      const neg = /^-/.test(x.differenz.replace(/^ab\s*/, '').trim());
      return { egMin: b[0], egMax: b[1], ...(b[0] === 0 && b[1] === 0 ? { nurBeiDifferenz: neg ? 'negativ' as const : 'positiv' as const } : {}), einstufung: x.einstufung };
    });
    if (s.every(Boolean)) stufen = s as Probenregeln['stufen'];
  }
  const r: Probenregeln = {
    punkteJeEg: eg?.punkte_je_eg ?? Infinity,
    patzerSummeHoechstens: pa?.summe_hoechstens ?? -Infinity,
    patzerEg: pa?.eg_aenderung ?? 0,
    patzerEgHoechstens: pa?.eg_hoechstens ?? 0,
    triumphSummeMindestens: tr?.summe_mindestens ?? Infinity,
    triumphEg: tr?.eg_aenderung ?? 0,
    wuerfel: {
      standard: anzahlW10(k?.get(WURF_IDS.standard)?.daten.strukturiert?.wuerfel) ?? 0,
      safe: anzahlW10(k?.get(WURF_IDS.safe)?.daten.strukturiert?.wuerfel) ?? 0,
      risk: anzahlW10(k?.get(WURF_IDS.risk)?.daten.strukturiert?.wuerfel) ?? 0,
    },
    stufen,
    quelle: 'GRW S. 17–18',
  };
  if (k) CACHE.set(k, r);
  return r;
}

export interface ProbenErgebnis {
  differenz: number;
  /** Erfolgsgrade mit Patzer bzw. Triumph; negativ bei Misslingen */
  eg: number;
  gelungen: boolean;
  einstufung: string;
  patzer: boolean;
  triumph: boolean;
}

/**
 * Erfolgsgrade einer Probe (GRW S. 17–18): je volle 3 Punkte über bzw. unter der Schwierigkeit ein EG (−1/−2 sind 0 EG,
 * knapp misslungen). Patzer: immer misslungen, EG −3, höchstens −1. Triumph: +3 EG, nur wenn die Probe rechnerisch gelingt.
 */
export function erfolgsgrade(gesamt: number, schwierigkeit: number, patzer = false, triumph = false, k: Katalog | null = aktiverKatalog()): ProbenErgebnis {
  const r = probenregeln(k);
  const differenz = gesamt - schwierigkeit;
  let eg = Math.trunc(differenz / r.punkteJeEg) || 0; // keine −0
  let gelungen = differenz >= 0;
  let triumphWirkt = false;
  if (patzer) { eg = Math.min(eg + r.patzerEg, r.patzerEgHoechstens); gelungen = false; }
  else if (triumph && gelungen) { eg += r.triumphEg; triumphWirkt = true; }
  const stufe = r.stufen.find((s) => eg >= s.egMin && eg <= s.egMax && (!s.nurBeiDifferenz || (s.nurBeiDifferenz === 'positiv') === gelungen));
  return { differenz, eg, gelungen, einstufung: stufe?.einstufung ?? (gelungen ? 'Gelungen' : 'Misslungen'), patzer, triumph: triumphWirkt };
}

/** Grenzen für Patzer und Triumph beim Würfeln */
export function wurfgrenzen(k: Katalog | null = aktiverKatalog()): { patzer: number; triumph: number; wuerfel: Probenregeln['wuerfel'] } {
  const r = probenregeln(k);
  return { patzer: r.patzerSummeHoechstens, triumph: r.triumphSummeMindestens, wuerfel: r.wuerfel };
}
