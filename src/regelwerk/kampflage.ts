/**
 * Modifikatoren für Angriffe je nach Lage, aus dem GRW-Paket (GRW S. 162–163, 170–171):
 * Kampfpositionen (Tabelle S. 170), Taktischer Vorteil, Überzahl, Lücke suchen, Zielen, Deckung, Kampfgetümmel.
 * Ohne Paket gibt es keine Situationsmodifikatoren (keine Zahlen im Code).
 */
import type { Katalog } from './katalog';
import { aktiverKatalog, meisterschaftId } from './bruecke';

export type Angriffsart = 'nahkampf' | 'fernkampf';

export interface Kampfposition { position: string; angriff: 'nahkampf' | 'fernkampf' | 'armbrust' | 'beide'; eigene: number; gegnerisch: number }

export interface Kampfsituationen {
  taktischerVorteil?: { bonus: number };
  ueberzahl?: { bonusJeKaempfer: number; hoechstens: number };
  lueckeSuchen?: { ticks: number; bonus: number; hoechstens: number };
  zielen?: { ticks: number; bonus: number; hoechstens: number };
  deckung?: { leicht: number; schwer: number };
  kampfgetuemmel?: { malus: number };
  positionen: Kampfposition[];
  quellen: Record<string, string>;
}

const IDS = {
  positionen: 'grw:regel:kampf-regeln:kampfpositionen',
  vorteil: 'grw:regel:kampf-regeln:taktischer-vorteil',
  ueberzahl: 'grw:regel:kampf-regeln:ueberzahl',
  fern: 'grw:regel:kampf-regeln:fernkampfhandlungen',
  nah: 'grw:regel:kampf-regeln:nahkampfhandlungen',
};

const CACHE = new WeakMap<Katalog, Kampfsituationen>();
const seite = (k: Katalog, id: string) => { const s = k.get(id)?.quelle.buch_seiten ?? []; return s.length ? `GRW S. ${s.length > 1 ? `${s[0]}–${s[s.length - 1]}` : s[0]}` : ''; };

export function kampfsituationen(k: Katalog | null = aktiverKatalog()): Kampfsituationen {
  if (!k) return { positionen: [], quellen: {} };
  if (CACHE.has(k)) return CACHE.get(k)!;
  const ks = (id: string) => k.get(id)?.daten.kampfsituationen ?? {};
  const v = ks(IDS.vorteil).taktischer_vorteil, u = ks(IDS.ueberzahl).ueberzahl;
  const f = ks(IDS.fern), n = ks(IDS.nah);
  const r: Kampfsituationen = {
    taktischerVorteil: v ? { bonus: v.bonus } : undefined,
    ueberzahl: u ? { bonusJeKaempfer: u.bonus_je_kaempfer, hoechstens: u.hoechstens } : undefined,
    lueckeSuchen: n.luecke_suchen ? { ticks: n.luecke_suchen.ticks, bonus: n.luecke_suchen.bonus, hoechstens: n.luecke_suchen.hoechstens } : undefined,
    zielen: f.zielen ? { ticks: f.zielen.ticks, bonus: f.zielen.bonus, hoechstens: f.zielen.hoechstens } : undefined,
    deckung: f.deckung ? { leicht: f.deckung.leicht.zusaetzliche_eg, schwer: f.deckung.schwer.zusaetzliche_eg } : undefined,
    kampfgetuemmel: f.kampfgetuemmel ? { malus: f.kampfgetuemmel.malus } : undefined,
    positionen: (k.get(IDS.positionen)?.daten.kampfpositionen ?? []) as Kampfposition[],
    quellen: { positionen: seite(k, IDS.positionen), vorteil: seite(k, IDS.vorteil), ueberzahl: seite(k, IDS.ueberzahl), fern: seite(k, IDS.fern), nah: seite(k, IDS.nah) },
  };
  CACHE.set(k, r);
  return r;
}

/** Namen der Positionen in der Reihenfolge der Tabelle */
export function positionsNamen(k: Katalog | null = aktiverKatalog()): string[] {
  return [...new Set(kampfsituationen(k).positionen.map((p) => p.position))];
}

/**
 * Modifikator aus einer Position. `rolle` „eigene“: Position des Angreifers; „gegnerisch“: Position des Ziels.
 * Eine Zeile für eine bestimmte Waffe (Tabelle: „Armbrust“) gilt, wenn der Waffenname dieses Wort enthält.
 */
export function positionsModifikator(position: string, art: Angriffsart, rolle: 'eigene' | 'gegnerisch', waffenName = '', k: Katalog | null = aktiverKatalog()): number {
  const zeilen = kampfsituationen(k).positionen.filter((p) => p.position === position);
  const waffe = waffenName.toLowerCase();
  const spezifisch = zeilen.find((p) => p.angriff !== 'nahkampf' && p.angriff !== 'fernkampf' && p.angriff !== 'beide' && waffe.includes(p.angriff));
  const z = (art === 'fernkampf' ? spezifisch : undefined) ?? zeilen.find((p) => p.angriff === art) ?? zeilen.find((p) => p.angriff === 'beide');
  return z ? z[rolle] : 0;
}

/**
 * Modifikatoren einer Kampfposition als Text aus der Tabelle des Pakets (GRW S. 170), z. B. für Liegend:
 * „eigene Angriffe: Nahkampf −6, Fernkampf −6 (Armbrust ±0); Angriffe gegen ihn: Nahkampf +6, Fernkampf −6“.
 */
export function positionsText(position: string, k: Katalog | null = aktiverKatalog()): string {
  const zeilen = kampfsituationen(k).positionen.filter((p) => p.position === position);
  if (!zeilen.length) return '';
  const zahl = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
  const name = (a: string) => (a === 'nahkampf' ? 'Nahkampf' : a === 'fernkampf' ? 'Fernkampf' : a === 'beide' ? 'alle Angriffe' : a.charAt(0).toUpperCase() + a.slice(1));
  const teil = (rolle: 'eigene' | 'gegnerisch') => {
    const reihe = ['nahkampf', 'fernkampf', 'beide'];
    const allg = zeilen.filter((z) => reihe.includes(z.angriff)).sort((x, y) => reihe.indexOf(x.angriff) - reihe.indexOf(y.angriff));
    const sonder = zeilen.filter((z) => !['nahkampf', 'fernkampf', 'beide'].includes(z.angriff) && z[rolle] !== (allg.find((x) => x.angriff === 'fernkampf')?.[rolle] ?? 0));
    const t = allg.map((z) => `${name(z.angriff)} ${zahl(z[rolle])}`).join(', ');
    return t + (sonder.length ? ` (${sonder.map((z) => `${name(z.angriff)} ${zahl(z[rolle])}`).join(', ')})` : '');
  };
  return `eigene Angriffe: ${teil('eigene')}; Angriffe gegen ihn: ${teil('gegnerisch')}`;
}

/** Bonus aus Lücke suchen bzw. Zielen für aufgewendete Ticks */
export function vorbereitungsBonus(ticks: number, art: Angriffsart, k: Katalog | null = aktiverKatalog()): number {
  const s = kampfsituationen(k); const r = art === 'fernkampf' ? s.zielen : s.lueckeSuchen;
  if (!r || ticks <= 0) return 0;
  return Math.min(r.hoechstens, Math.floor(ticks / r.ticks) * r.bonus);
}

export type GelernteMeisterschaft = { name: string; skill?: string; regelId?: string };
/**
 * Hat der Charakter in der Waffenfertigkeit eine Meisterschaft, die den Modifikator einer Situation entfallen lässt
 * (z. B. Scharfschütze: Kampfgetümmel)? Meisterschaften als Liste (mit `skill`) oder nach Fertigkeit gruppiert.
 */
export function ignoriertSituation(situation: string, masteries: GelernteMeisterschaft[] | Record<string, GelernteMeisterschaft[]> | undefined, waffenFertigkeit: string, k: Katalog | null = aktiverKatalog()): string | null {
  if (!k || !masteries) return null;
  const liste = Array.isArray(masteries) ? masteries.filter((m) => !m.skill || m.skill === waffenFertigkeit) : (masteries[waffenFertigkeit] ?? []);
  for (const m of liste) {
    const id = meisterschaftId(k, m.name, waffenFertigkeit, m.regelId);
    const e = id ? k.get(id) : undefined;
    if (e?.daten.ignoriert_situation?.situation === situation) return e.name;
  }
  return null;
}


const zeichen = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
const artName = (a: string) => (a === 'nahkampf' ? 'Nahkampf' : a === 'fernkampf' ? 'Fernkampf' : a === 'beide' ? 'Nah- und Fernkampf' : a.charAt(0).toUpperCase() + a.slice(1));

/**
 * Wirkung einer Position in Worten, aus der Tabelle im Paket (GRW S. 170):
 * `eigene` – Modifikatoren der eigenen Angriffe, `gegnerisch` – Modifikatoren für Angriffe gegen die Person.
 * Leere Zeichenkette, wenn die Position nicht im Paket steht.
 */
export function positionsBeschreibung(position: string, rolle: 'eigene' | 'gegnerisch', k: Katalog | null = aktiverKatalog()): string {
  const zeilen = kampfsituationen(k).positionen.filter((p) => p.position === position);
  if (!zeilen.length) return '';
  // allgemeine Zeilen zuerst, Zeilen für eine bestimmte Waffe (Armbrust) danach in Klammern
  const RANG = ['nahkampf', 'fernkampf', 'beide'];
  const allg = zeilen.filter((p) => RANG.includes(p.angriff)).sort((a, b) => RANG.indexOf(a.angriff) - RANG.indexOf(b.angriff));
  const bes = zeilen.filter((p) => !['nahkampf', 'fernkampf', 'beide'].includes(p.angriff));
  const teile = allg.map((p) => `${artName(p.angriff)} ${zeichen(p[rolle])}`);
  for (const p of bes) teile.push(`mit ${artName(p.angriff)} ${zeichen(p[rolle])}`);
  return teile.join(', ');
}

/** Quelle der Tabelle der Kampfpositionen, z. B. „GRW S. 170“ */
export function positionsQuelle(k: Katalog | null = aktiverKatalog()): string {
  return kampfsituationen(k).quellen.positionen ?? '';
}
