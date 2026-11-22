/**
 * Rast der Begleiter (FUNDAMENT.md, Regelquellen):
 * - Ruhephase und Verschnaufpause wie beim Abenteurer (`ruheregeln` der Kernregel „Heilung“, GRW S. 173–174, 196):
 *   Ruhephase heilt allen Betäubungs- und kanalisierten Schaden, Lebenspunkte in Höhe der doppelten Konstitution
 *   (mindestens 1), allen erschöpften und kanalisierten Fokus und verzehrten Fokus in Höhe der doppelten Willenskraft;
 *   die Verschnaufpause heilt Betäubungsschaden und erschöpften Fokus.
 * - Ausnahmen aus `strukturiert.ruhephase_begleiter` an den Regeltexten (Datenseite: begleiter_werte.py): Begleiterarten,
 *   die laut Paket in der Ruhephase keine Lebenspunkte regenerieren; Fundstelle aus dem Eintrag.
 * Zustände der Begleiter bleiben unverändert; sie werden im Blatt des Begleiters beendet.
 */
import type { Katalog } from './katalog';
import type { BegleiterZustand } from './vitals';
import { ruhephasenRegeneration, ruheregeln } from './spielwirkungen';
import { quelleText } from './relikte';

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
  const betaeubung = (z.betaeubung ?? 0) + (z.kanalisiert ?? 0);
  const lp = aus && !aus.lp ? 0 : Math.min(z.schaden ?? 0, regen.lp);
  const foFrei = (f.erschoepft ?? 0) + (f.kanalisiert ?? 0);
  const foVerzehrt = Math.min(f.verzehrt ?? 0, regen.fo);
  const teile = [
    betaeubung ? `${betaeubung} Betäubung` : '',
    lp ? `${lp} LP` : '',
    foFrei ? `${foFrei} FO erschöpft/kanalisiert` : '',
    foVerzehrt ? `${foVerzehrt} FO verzehrt` : '',
  ].filter(Boolean);
  return {
    zustand: { ...z, betaeubung: 0, kanalisiert: 0, schaden: (z.schaden ?? 0) - lp, fokus: { ...f, erschoepft: 0, kanalisiert: 0, verzehrt: (f.verzehrt ?? 0) - foVerzehrt } },
    teile,
    hinweis: aus && !aus.lp && (z.schaden ?? 0) > 0 ? `keine LP-Regeneration (${aus.quelle})` : undefined,
  };
}

/** Verschnaufpause eines Begleiters: Betäubungsschaden und erschöpfter Fokus */
export function verschnaufpauseBegleiter(z: BegleiterZustand): RastErgebnis {
  const f = z.fokus ?? {};
  const teile = [z.betaeubung ? `${z.betaeubung} Betäubung` : '', f.erschoepft ? `${f.erschoepft} FO erschöpft` : ''].filter(Boolean);
  return { zustand: { ...z, betaeubung: 0, fokus: { ...f, erschoepft: 0 } }, teile };
}
