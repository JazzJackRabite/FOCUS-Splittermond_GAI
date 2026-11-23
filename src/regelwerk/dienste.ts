/**
 * Dienste beschworener Wesen (Grimoire „Die Magie“, S. 186–191). Portierung von verfuegbare_dienste() aus Pruefsuite/lader.py.
 * Ohne geladenes Paket „magie“ gibt es keine Dienste; die Funktion liefert dann eine leere Liste.
 */
import type { KatalogSicht } from './bedingungen';

export interface VerfuegbarerDienst { id: string; art: 'basis' | 'immer' | 'erweitert'; kosten: string }

/**
 * Höchste Stufe des Wesens für einen erweiterten Dienst: `bis_stufe` der freischaltenden Meisterschaft
 * (`freigeschaltet_durch`), angehoben durch `stufengrenze_erhoeht_durch`. alleSchalter: Grenze auch ohne freischaltende
 * Meisterschaft (für die Begründung gesperrter Dienste).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stufenGrenze(d: any, ms: Set<string>, alleSchalter = false): number {
  const bis = (l: { id: string; bis_stufe?: number }[] | undefined, alle: boolean) =>
    (l ?? []).filter(g => alle || ms.has(g.id)).map(g => Number(g.bis_stufe)).filter(Number.isFinite);
  return Math.max(0, ...bis(d.freigeschaltet_durch, alleSchalter), ...bis(d.stufengrenze_erhoeht_durch, false));
}

export function verfuegbareDienste(kat: KatalogSicht, wesen: string, meisterschaften: string[] = [], dienstexperte: string[] = []): VerfuegbarerDienst[] {
  const E = kat.eintraege;
  const w = E[wesen]?.daten;
  if (!w) return [];
  const stufe: number = w.beschwoerbares_wesen_stufe;
  const ms = new Set(meisterschaften);
  const out: VerfuegbarerDienst[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kosten = (d: any, i: string) => {
    let f: number = d.kosten.fokus; let v: number = d.kosten.davon_verzehrt;
    if (dienstexperte.includes(i) && (d.kosten_gesenkt_durch ?? []).some((x: { id: string }) => ms.has(x.id)) && f > 0) { f = Math.max(1, f - 1); v = Math.max(0, v - 1); }
    return v ? `${f}V${v} Fokus` : `${f} Fokus`;
  };
  const alle = Object.fromEntries(Object.values(E).filter(e => e.typ === 'dienst').map(e => [e.id, e]));
  if (w.basisdienst?.id) out.push({ id: w.basisdienst.id, art: 'basis', kosten: kosten(alle[w.basisdienst.id].daten, w.basisdienst.id) });
  for (const [i, d] of Object.entries(alle)) {
    if (d.daten.immer_verfuegbar && !out.some(o => o.id === i)) out.push({ id: i, art: 'immer', kosten: kosten(d.daten, i) });
  }
  for (const x of w.erweiterte_dienste ?? []) {
    if (!x.id || out.some(o => o.id === x.id)) continue;
    const d = alle[x.id].daten;
    const grenze = stufenGrenze(d, ms);
    if ((d.freigeschaltet_durch ?? []).some((f: { id: string }) => ms.has(f.id)) && stufe <= grenze) out.push({ id: x.id, art: 'erweitert', kosten: kosten(d, x.id) });
  }
  return out;
}

/** Erweiterter Dienst, der (noch) nicht verfügbar ist, mit Grund */
export interface GesperrterDienst {
  id: string;
  /** Meisterschaften, von denen eine den Dienst freischaltet (IDs); leer, wenn schon freigeschaltet */
  fehlt: string[];
  /** Stufe des Wesens über der Grenze: aktuelle Grenze und Meisterschaften, die sie anheben (ID, bis Stufe) */
  stufe?: { wesen: number; grenze: number; anheben: { id: string; bis: number }[] };
}

/** Erweiterte Dienste des Wesens, die verfuegbareDienste() nicht anbietet, und warum (Felder wie dort) */
export function gesperrteDienste(kat: KatalogSicht, wesen: string, meisterschaften: string[] = []): GesperrterDienst[] {
  const E = kat.eintraege;
  const w = E[wesen]?.daten;
  if (!w) return [];
  const stufe = Number(w.beschwoerbares_wesen_stufe);
  const ms = new Set(meisterschaften);
  const frei = new Set(verfuegbareDienste(kat, wesen, meisterschaften).map(d => d.id));
  const out: GesperrterDienst[] = [];
  for (const x of w.erweiterte_dienste ?? []) {
    if (!x.id || frei.has(x.id) || out.some(o => o.id === x.id)) continue;
    const d = E[x.id]?.daten;
    if (!d) continue;
    const schalter: string[] = [...new Set<string>((d.freigeschaltet_durch ?? []).map((f: { id: string }) => f.id))];
    const fehlt = schalter.some(i => ms.has(i)) ? [] : schalter;
    const heben = (d.stufengrenze_erhoeht_durch ?? []) as { id: string; bis_stufe: number }[];
    const grenze = stufenGrenze(d, ms, true);
    out.push({ id: x.id, fehlt, ...(stufe > grenze ? { stufe: { wesen: stufe, grenze, anheben: heben.filter(g => g.bis_stufe >= stufe && !ms.has(g.id)).map(g => ({ id: g.id, bis: g.bis_stufe })) } } : {}) });
  }
  return out;
}
