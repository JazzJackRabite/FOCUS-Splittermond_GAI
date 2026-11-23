/**
 * Rast der Begleiter (FUNDAMENT.md, Regelquellen):
 * - Ruhephase und Verschnaufpause wie beim Abenteurer (`ruheregeln` der Kernregel „Heilung“, GRW S. 173–174, 196):
 *   Ruhephase heilt allen Betäubungsschaden, Lebenspunkte in Höhe der doppelten Konstitution (mindestens 1), allen
 *   erschöpften Fokus und verzehrten Fokus in Höhe der doppelten Willenskraft; kanalisierter Fokus regeneriert nicht,
 *   solange der Zauber wirkt (S. 195–196);
 *   kanalisierter Schaden bleibt, bis sein Zustand aufgehoben ist (S. 173);
 *   die Verschnaufpause heilt Betäubungsschaden und erschöpften Fokus.
 * - Ausnahmen aus `strukturiert.ruhephase_begleiter` an den Regeltexten (Datenseite: begleiter_werte.py): Begleiterarten,
 *   die laut Paket in der Ruhephase keine Lebenspunkte regenerieren; Fundstelle aus dem Eintrag.
 * - Zustände enden oder verlieren Stufen wie beim Abenteurer nach `pause_ende` der Zustände (`nachPause` in `zustaende.ts`).
 * - Ein Zustand mit `keine_natuerliche_heilung` (`ohneNatuerlicheHeilung`) verhindert in beiden Pausen jede Heilung von Lebenspunkten.
 */
import type { Katalog } from './katalog';
import type { BegleiterZustand } from './vitals';
import { ruhephasenRegeneration, ruheregeln } from './spielwirkungen';
import { quelleText } from './relikte';
import { nachPause, ohneNatuerlicheHeilung } from './zustaende';
import { aktiverKatalog } from './bruecke';

export interface RuheAusnahme { art: string; lp: boolean; hinweis?: string; quelle: string }

/** Ausnahme von der Regeneration der Lebenspunkte für diese Begleiterart (null = Regel des Abenteurers) */
export function ruheAusnahme(k: Katalog | null, art: string): RuheAusnahme | null {
  if (!k) return null;
  for (const e of Object.values(k.eintraege)) {
    const r = e.daten.strukturiert?.ruhephase_begleiter;
    if (!r || r.art !== art) continue;
    return { art, lp: r.lp !== false, hinweis: r.hinweis, quelle: quelleText(k, e) };
  }
  return null;
}

const zahl = (s: unknown) => { const n = Number.parseInt(String(s ?? '').replace(/[−–]/g, '-'), 10); return Number.isFinite(n) ? n : 0; };

export interface RastErgebnis {
  zustand: BegleiterZustand;
  /** was geheilt wurde, z. B. „4 LP“, „2 FO verzehrt“ */
  teile: string[];
  /** Hinweis, warum etwas nicht heilt */
  hinweis?: string;
}

/** Ruhephase eines Begleiters mit Konstitution und Willenskraft aus seinem Wertekasten */
export function ruhephaseBegleiter(k: Katalog | null, art: string, z: BegleiterZustand, attribute: Record<string, string> | undefined): RastErgebnis {
  const r = ruheregeln(k);
  const aus = ruheAusnahme(k, art);
  const regen = ruhephasenRegeneration(zahl(attribute?.KON), zahl(attribute?.WIL), [], r);
  const f = z.fokus ?? {};
  const sperrt = ohneNatuerlicheHeilung(z.zustaende ?? [], k);
  const betaeubung = sperrt.length ? 0 : z.betaeubung ?? 0;
  const lp = sperrt.length || (aus && !aus.lp) ? 0 : Math.min(z.schaden ?? 0, regen.lp);
  const foFrei = f.erschoepft ?? 0;
  const foVerzehrt = Math.min(f.verzehrt ?? 0, regen.fo);
  const teile = [
    betaeubung ? `${betaeubung} Betäubung` : '',
    lp ? `${lp} LP` : '',
    foFrei ? `${foFrei} FO erschöpft` : '',
    foVerzehrt ? `${foVerzehrt} FO verzehrt` : '',
    zustandsAenderung(z.zustaende, 'ruhephase', k),
  ].filter(Boolean);
  return {
    zustand: { ...z, betaeubung: (z.betaeubung ?? 0) - betaeubung, schaden: (z.schaden ?? 0) - lp, fokus: { ...f, erschoepft: 0, verzehrt: (f.verzehrt ?? 0) - foVerzehrt },
      ...(z.zustaende ? { zustaende: nachPause(z.zustaende, 'ruhephase', k) } : {}) },
    teile,
    hinweis: sperrt.length ? `keine natürliche Heilung (${sperrt.join(', ')})`
      : aus && !aus.lp && (z.schaden ?? 0) > 0 ? `keine LP-Regeneration (${aus.quelle})` : undefined,
  };
}

/** Verschnaufpause eines Begleiters: Betäubungsschaden, erschöpfter Fokus, Zustände nach `pause_ende` */
export function verschnaufpauseBegleiter(z: BegleiterZustand, k: Katalog | null = aktiverKatalog()): RastErgebnis {
  const f = z.fokus ?? {};
  const sperrt = ohneNatuerlicheHeilung(z.zustaende ?? [], k);
  const betaeubung = sperrt.length ? 0 : z.betaeubung ?? 0;
  const teile = [betaeubung ? `${betaeubung} Betäubung` : '', f.erschoepft ? `${f.erschoepft} FO erschöpft` : '',
    zustandsAenderung(z.zustaende, 'verschnaufpause', k)].filter(Boolean);
  return { zustand: { ...z, betaeubung: (z.betaeubung ?? 0) - betaeubung, fokus: { ...f, erschoepft: 0 }, ...(z.zustaende ? { zustaende: nachPause(z.zustaende, 'verschnaufpause', k) } : {}) }, teile,
    ...(sperrt.length ? { hinweis: `keine natürliche Heilung (${sperrt.join(', ')})` } : {}) };
}

/** Kurztext für Protokoll und Hinweis: welche Zustände die Pause beendet oder gesenkt hat, z. B. „Lahm beendet, Erschöpft 3 → 2“ */
function zustandsAenderung(vorher: BegleiterZustand['zustaende'], art: 'verschnaufpause' | 'ruhephase', k: Katalog | null): string {
  if (!vorher?.length) return '';
  const nachher = nachPause(vorher, art, k);
  return vorher.map((c) => {
    const n = nachher.find((x) => x.id === c.id);
    if (!n) return `${c.key} beendet`;
    return (n.level ?? 1) !== (c.level ?? 1) ? `${c.key} ${c.level ?? 1} → ${n.level ?? 1}` : '';
  }).filter(Boolean).join(', ');
}
