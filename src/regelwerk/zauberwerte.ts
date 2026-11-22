/**
 * Spielwerte aktiver Zauber aus den Regelpaketen (daten.spielwerte am Zauber, siehe Werkzeuge/regelpakete/zauber_spielwerte.py).
 *
 * Der Editor führt keine eigene Tabelle der Zauberwirkungen: Was ein gewirkter Zauber an Kampfwerten, Proben, Zusatzschaden und
 * Lebenspunkten ändert, steht im Paket – auch für Zauber aus hochgeladenen Grimoires.
 *
 *   werte              – je Wert: bezug, wert, verstaerkt (Wert mit gewählter Verstärkung), fertigkeiten (IDs), attribut,
 *                        lage (gilt nur in einer Lage → nicht vorausgewählt bzw. nicht fest eingerechnet), ziel, schadensart
 *   nicht_kombinierbar – Typen: mit anderen aktiven Zaubern, die alle diese Typen tragen, nicht kombinierbar; es zählt der stärkste
 *
 * Regeln, die hier angewendet werden:
 *   - Höchstbonus aus Zauberei auf Proben und abgeleitete Werte (GRW S. 18–19); die Schadensreduktion ist kein abgeleiteter Wert.
 *   - Jeder Zauber hat genau eine Verstärkung, nur einmal wählbar (GRW S. 221–222).
 */
import type { Katalog } from './katalog';
import { ATTRIBUT_NAME, idNachName, norm } from './bruecke';
import { wirkungKurz, type Wirkung } from './wirkungen';

export type SpielwertBezug = 'VTD' | 'SR' | 'GW' | 'KW' | 'GSW' | 'INI' | 'wundabzug' | 'angriff' | 'fertigkeit' | 'attribut'
  | 'alle_fertigkeiten' | 'zusatzschaden' | 'zusatz_lp' | 'heilung_lp' | 'zustand_unterdrueckt';

export interface Spielwert {
  bezug: SpielwertBezug;
  wert: number | 'alle';
  verstaerkt?: number | 'alle';
  fertigkeiten?: string[];
  attribut?: string;
  lage?: boolean;
  ziel?: 'selbst' | 'waffe' | 'waffenlos';
  schadensart?: string;
  /** zustand_unterdrueckt: ID des Zustands, von dem der Zauber so viele Stufen unterdrückt, solange er wirkt */
  zustand?: string;
  /** zusatz_lp: der Zauber endet, sobald die zusätzlichen Lebenspunkte aufgebraucht sind */
  endet_wenn_verbraucht?: boolean;
}

export interface ZauberSpielwerte {
  id: string;
  name: string;
  werte: Spielwert[];
  nichtKombinierbar: string[];
  typus: string[];
  /** Kurztexte der übrigen Wirkungen, wenn der Zauber keine Spielwerte hat (nur Anzeige) */
  hinweise: string[];
}

/** Aktiver Zauber, wie ihn der Spielmodus führt (Ausschnitt aus ChanneledSpell) */
export interface AktiverZauber {
  id: string;
  name: string;
  selectedEnhancementIds?: string[];
  notes?: string;
  enhancements?: string[];
  targetItemId?: string;
  targetItemName?: string;
}

/** Wurde der Zauber mit seiner Verstärkung gewirkt? Ältere Einträge ohne IDs: Vermerk in Notiz/Verstärkungstext. */
export function istVerstaerkt(cs: AktiverZauber): boolean {
  if (cs.selectedEnhancementIds && cs.selectedEnhancementIds.length > 0) return true;
  return /verstärk|\+\s*k?\d+v\d+/.test(`${cs.notes || ''} ${(cs.enhancements || []).join(' ')}`.toLowerCase());
}

/** Spielwerte eines Zaubers nach Name (Editor führt Zauber unter ihrem Namen) */
export function spielwerteDesZaubers(k: Katalog | null, name: string): ZauberSpielwerte | null {
  if (!k) return null;
  const id = idNachName(k, 'zauber', (name || '').trim());
  const e = id ? k.get(id) : undefined;
  if (!e) return null;
  const sw = (e.daten.spielwerte ?? {}) as { werte?: Spielwert[]; nicht_kombinierbar?: string[] };
  const werte = sw.werte ?? [];
  const hinweise = werte.length ? [] : ((e.daten.wirkungen_strukturiert ?? []) as Wirkung[])
    .filter(w => w.gilt === 'solange der Zauber wirkt' || w.gilt === 'bedingt')
    .map(w => wirkungKurz(w)).filter(Boolean);
  return { id: e.id, name: e.name, werte, nichtKombinierbar: sw.nicht_kombinierbar ?? [], typus: (e.daten.typus ?? []) as string[], hinweise };
}

/** Geltender Wert: mit Verstärkung der verstärkte, sonst der Grundwert (0 = wirkt nur verstärkt) */
export function geltenderWert(x: Spielwert, verstaerkt: boolean): number | 'alle' {
  return verstaerkt && x.verstaerkt !== undefined ? x.verstaerkt : x.wert;
}

interface Aktiv { cs: AktiverZauber; sw: ZauberSpielwerte; verstaerkt: boolean }

const zahl = (v: number | 'alle') => (v === 'alle' ? 999 : v);

/**
 * Aktive Zauber mit Spielwerten; von nicht kombinierbaren Zaubern bleibt nur der stärkste (Summe seiner geltenden Werte).
 * Zwei Zauber schließen sich aus, wenn einer „nicht kombinierbar mit Typus X (und Y)“ nennt und der andere alle diese Typen trägt.
 */
export function aktiveZauber(k: Katalog | null, zauber: AktiverZauber[]): { gilt: Aktiv[]; verdraengt: { cs: AktiverZauber; durch: string }[] } {
  const alle: Aktiv[] = [];
  for (const cs of zauber) {
    const sw = spielwerteDesZaubers(k, cs.name);
    if (sw) alle.push({ cs, sw, verstaerkt: istVerstaerkt(cs) });
  }
  const staerke = (a: Aktiv) => a.sw.werte.reduce((s, x) => s + zahl(geltenderWert(x, a.verstaerkt)), 0);
  const schliesstAus = (a: Aktiv, b: Aktiv) => a.sw.nichtKombinierbar.length > 0 && a.sw.nichtKombinierbar.every(t => b.sw.typus.includes(t));
  const gilt: Aktiv[] = []; const verdraengt: { cs: AktiverZauber; durch: string }[] = [];
  for (const a of [...alle].sort((x, y) => staerke(y) - staerke(x))) {
    const gegner = gilt.find(b => schliesstAus(a, b) || schliesstAus(b, a));
    if (gegner) verdraengt.push({ cs: a.cs, durch: gegner.cs.name }); else gilt.push(a);
  }
  // Reihenfolge wie eingegeben
  gilt.sort((x, y) => zauber.indexOf(x.cs) - zauber.indexOf(y.cs));
  return { gilt, verdraengt };
}

export interface Kampfwerte {
  vtd: number; sr: number; gw: number; kw: number; gsw: number;
  /** Senkung der Wundabzüge (999 = ignoriert) */
  wundabzug: number;
  hinweise: string[];
  jeZauber: { name: string; vtd?: number; sr?: number; gw?: number; kw?: number; gsw?: number; wundabzug?: number; text: string }[];
}

const KAMPF: Partial<Record<SpielwertBezug, 'vtd' | 'sr' | 'gw' | 'kw' | 'gsw'>> = { VTD: 'vtd', SR: 'sr', GW: 'gw', KW: 'kw', GSW: 'gsw' };

/** Kurztext eines Spielwerts für die Anzeige am aktiven Zauber */
export function spielwertText(k: Katalog | null, x: Spielwert, v: number | 'alle'): string {
  const vz = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const lage = x.lage ? ' (nur in bestimmter Lage)' : '';
  switch (x.bezug) {
    case 'wundabzug': return v === 'alle' ? 'Wundabzüge ignoriert' : `Wundabzug um ${v} gesenkt`;
    case 'angriff': return `${vz(zahl(v))} auf Angriffe${x.ziel === 'waffe' ? ' mit der verzauberten Waffe' : ''}${lage}`;
    case 'fertigkeit': return `${vz(zahl(v))} auf ${(x.fertigkeiten ?? []).map(f => k?.get(f)?.name ?? f).join(', ')}${lage}`;
    case 'attribut': return `${vz(zahl(v))} auf Proben mit ${x.attribut}${lage}`;
    case 'alle_fertigkeiten': return `${vz(zahl(v))} auf alle Fertigkeitsproben${lage}`;
    case 'zusatzschaden': return `${vz(zahl(v))} ${x.schadensart ?? 'Schaden'}${x.ziel === 'waffenlos' ? ' (waffenlos)' : ''}${lage}`;
    case 'zusatz_lp': return `${vz(zahl(v))} zusätzliche Lebenspunkte`;
    case 'heilung_lp': return v === 'alle' ? 'heilt alle Lebenspunkte' : `heilt ${v} Lebenspunkte`;
    case 'zustand_unterdrueckt': return `unterdrückt ${v === 'alle' ? 'alle' : v} ${v === 1 ? 'Stufe' : 'Stufen'} ${k?.get(x.zustand ?? '')?.name ?? 'eines Zustands'}`;
    default: return `${vz(zahl(v))} ${x.bezug}${lage}`;
  }
}

/**
 * Boni aktiver Zauber auf Kampfwerte. Werte, die nur in einer Lage gelten, werden nicht eingerechnet (nur als Text gezeigt).
 * VTD, GW, KW und GSW sind auf den Höchstbonus aus Zauberei begrenzt, wenn er übergeben wird.
 */
export function kampfwerte(k: Katalog | null, zauber: AktiverZauber[], hoechstbonus?: number): Kampfwerte {
  const out: Kampfwerte = { vtd: 0, sr: 0, gw: 0, kw: 0, gsw: 0, wundabzug: 0, hinweise: [], jeZauber: [] };
  const { gilt, verdraengt } = aktiveZauber(k, zauber);
  for (const a of gilt) {
    const zeile: Kampfwerte['jeZauber'][number] = { name: a.cs.name, text: '' };
    const texte: string[] = [];
    for (const x of a.sw.werte) {
      const v = geltenderWert(x, a.verstaerkt);
      if (v === 0) continue;
      texte.push(spielwertText(k, x, v));
      if (x.lage) continue;
      const feld = KAMPF[x.bezug];
      if (feld) { out[feld] += zahl(v); zeile[feld] = (zeile[feld] ?? 0) + zahl(v); }
      else if (x.bezug === 'wundabzug') { out.wundabzug = Math.max(out.wundabzug, zahl(v)); zeile.wundabzug = zahl(v); }
    }
    if (!texte.length) texte.push(...a.sw.hinweise);
    if (!texte.length) continue;
    zeile.text = `${texte.join(', ')}${a.verstaerkt && a.sw.werte.some(x => x.verstaerkt !== undefined) ? ' (verstärkt)' : ''}`;
    out.jeZauber.push(zeile);
  }
  for (const v of verdraengt) {
    out.hinweise.push(`${v.cs.name} zählt nicht: nicht kombinierbar mit ${v.durch}`);
    out.jeZauber.push({ name: v.cs.name, text: `zählt nicht (nicht kombinierbar mit ${v.durch})` });
  }
  if (hoechstbonus !== undefined) {
    for (const [feld, label] of [['vtd', 'VTD'], ['gw', 'GW'], ['kw', 'KW'], ['gsw', 'GSW']] as const) {
      if (out[feld] > hoechstbonus) {
        out.hinweise.push(`${label}: Zauberbonus ${out[feld]} auf Höchstbonus ${hoechstbonus} begrenzt (GRW S. 18)`);
        out[feld] = hoechstbonus;
      }
    }
  }
  return out;
}

export interface Probenbonus { id: string; quelle: string; bonus: number; text: string; vorausgewaehlt: boolean }

/** Waffenloser Angriff (Kennung „waffenlos“ oder die Ausrüstungs-ID der GRW-Liste) */
export function istWaffenlos(waffenId?: string, waffenName?: string): boolean {
  return (waffenId ?? '').toLowerCase().endsWith('waffenlos') || (waffenName ?? '').trim().toLowerCase() === 'waffenlos';
}

/** Trifft ein Waffenzauber diese Waffe? Mit gespeichertem Ziel nur genau diese Waffe; ohne Ziel (ältere Einträge) jede. */
export function zielTrifft(cs: AktiverZauber, waffenId?: string, waffenName?: string): boolean {
  if (cs.targetItemId) return cs.targetItemId === waffenId;
  if (cs.targetItemName) return !!waffenName && cs.targetItemName.toLowerCase() === waffenName.toLowerCase();
  return true;
}

/**
 * Probenboni aktiver Zauber für eine Fertigkeits- oder Angriffsprobe.
 * `attribute`: Attributskürzel der gewürfelten Fertigkeit (bei Angriffen hängen sie von der Waffe ab, die der Editor nicht
 * kennt – Attributszauber werden dort angeboten, aber nicht vorausgewählt).
 */
export function probenboni(k: Katalog | null, zauber: AktiverZauber[], opt: {
  fertigkeit: string; attribute: string[]; angriff: boolean; waffenId?: string; waffenName?: string;
}): Probenbonus[] {
  const out: Probenbonus[] = [];
  const waffenlos = istWaffenlos(opt.waffenId, opt.waffenName);
  const f = norm(opt.fertigkeit);
  const attrNamen = opt.attribute.map(a => ATTRIBUT_NAME[a] ?? a);
  // Probe direkt auf ein Attribut (Name oder Kürzel als „Fertigkeit“)
  const direkt = Object.entries(ATTRIBUT_NAME).find(([kurz, name]) => f === kurz.toLowerCase() || f === name.toLowerCase())?.[1];
  for (const a of aktiveZauber(k, zauber).gilt) {
    a.sw.werte.forEach((x, i) => {
      const v = geltenderWert(x, a.verstaerkt);
      if (typeof v !== 'number' || v === 0) return;
      const neu = (text: string, vorausgewaehlt: boolean) => out.push({
        id: `spell-bonus-${a.cs.id}-${i}`, quelle: a.cs.name, bonus: v,
        text: `${text}${a.verstaerkt && x.verstaerkt !== undefined ? ' (verstärkt)' : ''}`, vorausgewaehlt: vorausgewaehlt && !x.lage,
      });
      if (x.bezug === 'alle_fertigkeiten') neu(spielwertText(k, x, v), true);
      else if (x.bezug === 'angriff' && opt.angriff) {
        if (x.ziel === 'waffe' && (waffenlos || !zielTrifft(a.cs, opt.waffenId, opt.waffenName))) return;
        neu(spielwertText(k, x, v), true);
      } else if (x.bezug === 'attribut' && x.attribut) {
        if (opt.angriff) neu(`+${v}, wenn ${x.attribut} ein Attribut der Waffe ist`, false);
        else if (attrNamen.includes(x.attribut) || direkt === x.attribut) neu(spielwertText(k, x, v), true);
      } else if (x.bezug === 'fertigkeit' && (x.fertigkeiten ?? []).some(id => norm(k?.get(id)?.name) === f)) {
        neu(spielwertText(k, x, v), true);
      }
    });
  }
  return out;
}

export interface Waffenschaden { feuer: number; licht: number; sonst: number; gesamt: number; text: string; teile: { name: string; wert: number; art: string }[] }

/**
 * Zusatzschaden aktiver Zauber für einen Angriff: Waffenzauber nur auf der verzauberten Waffe, Zauber mit Ziel „waffenlos“
 * nur beim waffenlosen Angriff. Nicht kombinierbare Zauber (z. B. Typen Schaden und Waffe) sind schon ausgesiebt.
 */
export function waffenschaden(k: Katalog | null, zauber: AktiverZauber[], waffenId?: string, waffenName?: string): Waffenschaden {
  const out: Waffenschaden = { feuer: 0, licht: 0, sonst: 0, gesamt: 0, text: '', teile: [] };
  const waffenlos = istWaffenlos(waffenId, waffenName);
  // Ausschluss nur unter Zaubern, die diese Waffe überhaupt treffen
  const betroffen = zauber.filter(cs => waffenlos || zielTrifft(cs, waffenId, waffenName));
  for (const a of aktiveZauber(k, betroffen).gilt) {
    for (const x of a.sw.werte) {
      if (x.bezug !== 'zusatzschaden' || x.lage) continue;
      if ((x.ziel === 'waffenlos') !== waffenlos) continue;
      const v = geltenderWert(x, a.verstaerkt);
      if (typeof v !== 'number' || v === 0) continue;
      const art = x.schadensart ?? 'Schaden';
      if (/feuer/i.test(art)) out.feuer += v; else if (/licht/i.test(art)) out.licht += v; else out.sonst += v;
      out.teile.push({ name: a.cs.name, wert: v, art });
    }
  }
  out.gesamt = out.feuer + out.licht + out.sonst;
  out.text = out.teile.map(t => `+${t.wert} ${t.art} (${t.name})`).join(', ');
  return out;
}

export interface Heilwirkung { lp: number | 'alle'; grund: number | 'alle'; verstaerkt: boolean }

/** Heilung beim Wirken (heilung_lp) bzw. zusätzliche Lebenspunkte (zusatz_lp) eines Zaubers */
export function lpWirkung(k: Katalog | null, name: string, bezug: 'heilung_lp' | 'zusatz_lp', verstaerkt: boolean): Heilwirkung | null {
  const x = spielwerteDesZaubers(k, name)?.werte.find(w => w.bezug === bezug);
  if (!x) return null;
  return { lp: geltenderWert(x, verstaerkt), grund: x.wert, verstaerkt: verstaerkt && x.verstaerkt !== undefined };
}

/**
 * Zustände, wie sie gerade wirken: Aktive Zauber können Stufen eines Zustands unterdrücken, solange sie wirken (z. B.
 * Erfrischung: 1 Stufe Erschöpft, verstärkt 3 – GRW S. 227). Der gespeicherte Zustand bleibt unverändert; endet der Zauber,
 * gilt wieder die volle Stufe. Zustände ohne Stufen zählen als Stufe 1.
 */
export function wirksameZustaende<T extends { key: string; level?: number }>(k: Katalog | null, zustaende: T[], zauber: AktiverZauber[]): { wirksam: T[]; unterdrueckt: { key: string; stufen: number; durch: string }[] } {
  const unterdrueckt: { key: string; stufen: number; durch: string }[] = [];
  for (const a of aktiveZauber(k, zauber).gilt) {
    for (const x of a.sw.werte) {
      if (x.bezug !== 'zustand_unterdrueckt' || !x.zustand) continue;
      const v = geltenderWert(x, a.verstaerkt);
      const name = k?.get(x.zustand)?.name;
      if (name && v !== 0) unterdrueckt.push({ key: name, stufen: zahl(v), durch: a.cs.name });
    }
  }
  if (!unterdrueckt.length) return { wirksam: zustaende, unterdrueckt };
  const wirksam: T[] = [];
  for (const z of zustaende) {
    const weg = unterdrueckt.filter(u => norm(u.key) === norm(z.key)).reduce((s, u) => s + u.stufen, 0);
    const stufe = (z.level ?? 1) - weg;
    if (weg === 0) wirksam.push(z);
    else if (stufe > 0) wirksam.push({ ...z, level: stufe });
  }
  return { wirksam, unterdrueckt: unterdrueckt.filter(u => zustaende.some(z => norm(z.key) === norm(u.key))) };
}
