/**
 * Zauber durch Erfolgsgrade verbessern (GRW S. 221–222) und Auslösezeit (GRW S. 194–195) aus dem GRW-Paket:
 * EG je Option, Höchstzahl, Mindestwerte. Ohne Paket ist keine Option wählbar.
 */
import type { Katalog } from './katalog';
import { aktiverKatalog, idNachName } from './bruecke';

const EG_ID = 'grw:regel:zauber-regeln:zauber-durch-erfolgsgrade-verbessern';
const AUSLOESEN_ID = 'grw:regel:zauber-regeln:erlaeuterung-der-zauberbeschreibungen';

export interface ZauberEgOption { eg: number; hoechstens: number | null; minimum: number | null }
export interface ZauberEgRegeln {
  erschoepft: ZauberEgOption; kanalisiert: ZauberEgOption; verzehrt: ZauberEgOption;
  schaden: ZauberEgOption; reichweite: ZauberEgOption; wirkungsdauer: ZauberEgOption; wirkungsbereich: ZauberEgOption;
  ausloesezeit: ZauberEgOption;
  /** Dauer der sofortigen Aktion zum Auslösen in Ticks */
  grundAusloesezeit: number;
  quelle: string;
}

/** Name der Option im Paket → Schlüssel */
const OPTION: Record<string, keyof Omit<ZauberEgRegeln, 'grundAusloesezeit' | 'quelle'>> = {
  'Erschöpfter Fokus': 'erschoepft', 'Kanalisierter Fokus': 'kanalisiert', 'Verzehrter Fokus': 'verzehrt',
  Schaden: 'schaden', Reichweite: 'reichweite', Wirkungsdauer: 'wirkungsdauer', Wirkungsbereich: 'wirkungsbereich', 'Auslösezeit': 'ausloesezeit',
};

const NICHT: ZauberEgOption = { eg: Infinity, hoechstens: 0, minimum: null };
const OHNE_PAKET: ZauberEgRegeln = {
  erschoepft: NICHT, kanalisiert: NICHT, verzehrt: NICHT, schaden: NICHT, reichweite: NICHT, wirkungsdauer: NICHT, wirkungsbereich: NICHT,
  ausloesezeit: NICHT, grundAusloesezeit: 0, quelle: '',
};

const CACHE = new WeakMap<Katalog, ZauberEgRegeln>();

export function zauberEgRegeln(k: Katalog | null = aktiverKatalog()): ZauberEgRegeln {
  if (!k) return OHNE_PAKET;
  if (CACHE.has(k)) return CACHE.get(k)!;
  const r: ZauberEgRegeln = { ...OHNE_PAKET, quelle: 'GRW S. 221–222' };
  const opt = k.get(EG_ID)?.daten.strukturiert?.optionen as { name: string; eg: number | string; hoechstens?: number | null; minimum?: string }[] | undefined;
  for (const o of opt ?? []) {
    const key = OPTION[o.name];
    if (!key || typeof o.eg !== 'number') continue;
    const min = o.minimum?.match(/^(\d+)/);
    r[key] = { eg: o.eg, hoechstens: o.hoechstens ?? null, minimum: min ? +min[1] : null };
  }
  const t = k.get(AUSLOESEN_ID)?.daten.strukturiert?.ausloesezeit_ticks;
  if (typeof t === 'number') r.grundAusloesezeit = t;
  CACHE.set(k, r);
  return r;
}

/** Zustand, den eine Verstärkung verursacht (Paketfeld erfolgsgrade_strukturiert.verstaerkungen[].zustaende) */
export interface VerstaerkungsZustand { name: string; stufe?: number; ticks?: number; bedingt?: 'probe'; beleg?: string }
export interface ZauberVerstaerkung { eg: number; kosten: string; wirkung: string; zustaende?: VerstaerkungsZustand[] }
export interface ZauberErfolgsgrade { optionen: string[]; verstaerkungen: ZauberVerstaerkung[]; quelle: string }

/**
 * Zulässige Optionen und Verstärkungen eines Zaubers aus dem Paket (Editor führt Zauber unter ihrem Namen).
 * null, wenn der Zauber in keinem geladenen Paket steht (eigener Zauber): dann bleibt nur sein Text.
 */
export function zauberErfolgsgrade(name: string, k: Katalog | null = aktiverKatalog()): ZauberErfolgsgrade | null {
  if (!k || !name) return null;
  const id = idNachName(k, 'zauber', name.trim());
  const e = id ? k.get(id) : undefined;
  const s = e?.daten.erfolgsgrade_strukturiert as { optionen?: string[]; verstaerkungen?: Partial<ZauberVerstaerkung>[] } | undefined;
  if (!e || !s) return null;
  const verstaerkungen = (s.verstaerkungen ?? [])
    .filter((v) => typeof v.eg === 'number')
    .map((v) => ({ eg: v.eg as number, kosten: String(v.kosten ?? ''), wirkung: String(v.wirkung ?? ''), ...(v.zustaende?.length ? { zustaende: v.zustaende } : {}) }));
  const seite = e.quelle.buch_seiten?.[0];
  return { optionen: s.optionen ?? [], verstaerkungen, quelle: `${k.pakete[e.quelle.paket]?.kuerzel ?? e.quelle.paket}${seite ? ` S. ${seite}` : ''}` };
}

/** Anzeige eines verursachten Zustands: „Benommen 1 (30 Ticks)“, „Liegend (bei misslungener Probe)“ */
export function verstaerkungsZustandText(z: VerstaerkungsZustand): string {
  const zusatz = [z.ticks ? `${z.ticks} Ticks` : '', z.bedingt === 'probe' ? 'bei misslungener Probe' : ''].filter(Boolean).join(', ');
  return `${z.name}${z.stufe ? ` ${z.stufe}` : ''}${zusatz ? ` (${zusatz})` : ''}`;
}
