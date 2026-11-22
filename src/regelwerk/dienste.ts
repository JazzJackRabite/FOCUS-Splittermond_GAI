/**
 * Dienste beschworener Wesen (Grimoire „Die Magie“, S. 186–191). Portierung von verfuegbare_dienste() aus Pruefsuite/lader.py.
 * Ohne geladenes Paket „magie“ gibt es keine Dienste; die Funktion liefert dann eine leere Liste.
 */
import type { KatalogSicht } from './bedingungen';

export interface VerfuegbarerDienst { id: string; art: 'basis' | 'immer' | 'erweitert'; kosten: string }

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
    const grenze = Math.max(5, ...(d.stufengrenze_erhoeht_durch ?? []).filter((g: { id: string }) => ms.has(g.id)).map((g: { bis_stufe: number }) => g.bis_stufe));
    if ((d.freigeschaltet_durch ?? []).some((f: { id: string }) => ms.has(f.id)) && stufe <= grenze) out.push({ id: x.id, art: 'erweitert', kosten: kosten(d, x.id) });
  }
  return out;
}
