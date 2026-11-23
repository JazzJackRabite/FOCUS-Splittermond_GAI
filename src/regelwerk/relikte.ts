/**
 * Relikte (Ressource Relikt, GRW S. 79) als Baukasten.
 * Alle Regeln kommen aus den Regelpaketen:
 * - daten.relikt_baukasten: welche Bausteintypen ein Relikt nutzen darf, Budget und Höchstpunkte (GRW: Ressource Relikt;
 *   Grimoires ergänzen Typen, z. B. legendäre Kräfte, göttliche Kräfte, besondere Materialien)
 * - daten.baustein: Kosten, Höchstzahl, Gegenstandsart, Auswahl, Bedingungen und Wertänderungen je Baustein
 * Der Editor prüft nur und warnt; er sperrt nichts (viele Relikt-Regeln sind Spielleiterentscheid).
 */
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';
import type { InventoryItem, Relikt, ReliktBaustein, ReliktBeseelung, ReliktChronikEintrag, Spell } from '../types';
import { alleAusruestung, findeAusruestung, type AusruestungsItem } from './ausruestung';
import { aktiverKatalog } from './bruecke';

/** Gegenstandsarten, wie sie daten.baustein.gilt_fuer nennt */
export const GEGENSTANDSARTEN: Record<string, string> = {
  nahkampfwaffe: 'Nahkampfwaffe', fernkampfwaffe: 'Fernkampfwaffe', ruestung: 'Rüstung', schild: 'Schild',
  kleidung: 'Kleidung', gegenstand: 'sonstiger Gegenstand',
};

export interface Baukasten {
  budget: string;
  maxPunkte: number | null;
  typen: string[];
  material: { kosten: number; mindestAus: string } | null;
  /** Einträge, die den Baukasten festlegen (für Quellenangaben) */
  quellen: Eintrag[];
}

export interface BausteinInfo {
  id: string;
  typ: string;
  name: string;
  kosten: number | null;
  kostenNachGrad?: Array<{ grad: number; kosten: number }>;
  kostenJe?: string;
  maxAnzahl: number | null;
  giltFuer: string[];
  auswahl?: string;
  grenze?: string;
  bedingungMerkmal?: string;
  mindestVtd?: number;
  mindestPunkte?: number;
  variante?: string;
  aenderungen: Aenderung[];
  /** eine der Listen gilt (Wahl beim Bau, Index in ReliktBaustein.auswahl) */
  aenderungenWahl?: Aenderung[][];
  /** 'besitz': wirkt, solange der Charakter das Relikt besitzt (z. B. verbesserter Widerstand) */
  wirkt?: string;
  /** nur der höchste Bonus dieser Art zählt (über alle Relikte) */
  nurHoechster?: string;
  /** Auslösen einer Zauberverankerung (GRW S. 255) */
  ausloesung?: { fertigkeit: string; probe: string; schwierigkeit: string; fokus: string; erfolgsgrade: string; voraussetzung: string };
  quelle: string;
  beschreibung: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D = Record<string, any>;

/** Wertänderung eines Bausteins (daten.baustein.aenderungen) */
export interface Aenderung {
  feld: string;
  wert?: number;
  merkmal?: string;
  merkmal_id?: string;
  mindestens?: number;
  hoechstens_nach_schadenswuerfel?: Record<string, number>;
}
const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

function alleEintraege(k: Katalog): Eintrag[] {
  return [...Object.values(k.eintraege), ...Object.values(k.erweiterungen).flat()];
}

export function quelleText(k: Katalog, e: Eintrag): string {
  const p = k.pakete[e.quelle.paket];
  const kz = p?.kuerzel ?? (k.manifest.bekannte_pakete ?? []).find(x => x.id === e.quelle.paket)?.kuerzel ?? e.quelle.paket.toUpperCase();
  const s = (e.quelle.buch_seiten ?? [])[0];
  return s ? `${kz} S. ${s}` : kz;
}

/** Baukasten aus allen geladenen Paketen; null, wenn kein Paket einen festlegt */
export function reliktBaukasten(k: Katalog | null): Baukasten | null {
  if (!k) return null;
  const quellen = alleEintraege(k).filter(e => e.daten?.relikt_baukasten);
  if (!quellen.length) return null;
  const bk: Baukasten = { budget: 'ressourcenpunkte', maxPunkte: null, typen: [], material: null, quellen };
  for (const e of quellen) {
    const d = e.daten.relikt_baukasten as D;
    if (d.budget) bk.budget = d.budget;
    if (typeof d.max_punkte === 'number') bk.maxPunkte = d.max_punkte;
    for (const t of d.bausteintypen ?? []) if (!bk.typen.includes(t)) bk.typen.push(t);
    if (d.material) bk.material = { kosten: Number(d.material.kosten), mindestAus: String(d.material.mindest_punkte_aus ?? 'qualitaet') };
  }
  return bk;
}

function beschreibung(k: Katalog, e: Eintrag): string {
  const d = e.daten as D;
  const teile = [txt(d.liste?.kurzbeschreibung), txt(d.beschreibung)];
  const felder = d.felder as D | undefined;
  if (felder?.materialeigenschaft) teile.push(`Materialeigenschaft: ${txt(felder.materialeigenschaft)}`);
  if (txt(d.liste?.einschraenkungen)) teile.push(`Einschränkungen: ${txt(d.liste.einschraenkungen)}`);
  if (txt(d.kosten_und_grenzen)) teile.push(`Kosten und Grenzen: ${txt(d.kosten_und_grenzen)}`);
  if (txt(d.fussnote)) teile.push(txt(d.fussnote));
  for (const x of k.erweiterungen[e.id] ?? []) {
    const t = txt((x.daten as D).beschreibung);
    if (t && !teile.includes(t)) teile.push(`${quelleText(k, x)}: ${t}`);
  }
  return teile.filter(Boolean).join('\n\n');
}

/** Alle Bausteine, die der Baukasten erlaubt, sortiert nach Typ (Reihenfolge im Baukasten) und Name */
export function reliktBausteine(k: Katalog | null, bk: Baukasten | null = reliktBaukasten(k)): BausteinInfo[] {
  if (!k || !bk) return [];
  const out: BausteinInfo[] = [];
  for (const e of Object.values(k.eintraege)) {
    if (!bk.typen.includes(e.typ)) continue;
    const d = e.daten as D;
    if (e.typ === 'material') {
      if (!bk.material) continue;
      // Qualität im Eintrag oder in einer Ergänzung (z. B. GRW-Material mit Materialqualität aus einem Grimoire)
      const q = [d, ...(k.erweiterungen[e.id] ?? []).map(x => x.daten as D)].map(x => Number(x[bk.material!.mindestAus])).find(n => Number.isFinite(n) && n > 0) ?? NaN;
      if (!Number.isFinite(q) || q <= 0) continue;
      out.push({ id: e.id, typ: e.typ, name: e.name, kosten: bk.material.kosten, maxAnzahl: 1, giltFuer: ['alle'], mindestPunkte: q,
        aenderungen: [], quelle: quelleText(k, e), beschreibung: beschreibung(k, e), variante: 'material' });
      continue;
    }
    const b = d.baustein as D | undefined;
    if (!b || (b.kosten === null && !b.kosten_nach_grad)) continue;
    out.push({
      id: e.id, typ: e.typ, name: e.name, kosten: b.kosten ?? null, kostenNachGrad: b.kosten_nach_grad, kostenJe: b.kosten_je,
      maxAnzahl: b.max_anzahl ?? null, giltFuer: b.gilt_fuer ?? ['alle'], auswahl: b.auswahl, grenze: b.grenze,
      bedingungMerkmal: b.bedingung_merkmal, mindestVtd: b.mindest_vtd_bonus, variante: b.variante_von,
      aenderungen: b.aenderungen ?? [], aenderungenWahl: b.aenderungen_wahl, wirkt: b.wirkt, nurHoechster: b.nur_hoechster, ausloesung: b.ausloesung,
      quelle: quelleText(k, e), beschreibung: beschreibung(k, e),
    });
  }
  const ord = (t: string) => bk.typen.indexOf(t);
  return out.sort((a, b) => ord(a.typ) - ord(b.typ) || a.name.localeCompare(b.name, 'de'));
}

/** Gegenstandsart eines Ausrüstungseintrags (für gilt_fuer) */
export function artVon(item: { type?: string; category?: string } | null | undefined): string {
  if (!item) return 'gegenstand';
  if (item.type === 'weapon') return item.category === 'Fernkampf' ? 'fernkampfwaffe' : 'nahkampfwaffe';
  if (item.type === 'armor') return 'ruestung';
  if (item.type === 'shield') return 'schild';
  if (item.type === 'alchemika') return 'alchemikum';
  if (/kleidung/i.test(item.category ?? '')) return 'kleidung';
  return 'gegenstand';
}

/** Passt der Baustein zur Gegenstandsart? */
export function passtZu(b: BausteinInfo, art: string): boolean {
  if (b.giltFuer.includes('alle') && art !== 'alchemikum') return true;
  if (b.giltFuer.includes(art)) return true;
  return b.giltFuer.includes('waffe') && (art === 'nahkampfwaffe' || art === 'fernkampfwaffe');
}

/** Kosten eines gewählten Bausteins (Punkte der Ressource Relikt) */
export function kostenVon(b: BausteinInfo, w: ReliktBaustein): number {
  const n = Math.max(1, w.anzahl || 1);
  if (b.kostenNachGrad) return (b.kostenNachGrad.find(x => x.grad === (w.grad ?? 0))?.kosten ?? 0) * n;
  if (b.kostenJe === 'stufe') return (b.kosten ?? 0) * Math.max(1, w.stufe ?? 1) * n;
  return (b.kosten ?? 0) * n;
}

const merkmalNamen = (attributes?: string) => String(attributes ?? '').split(/,\s*/).map(s => s.replace(/\s*\(?\d+\)?\s*$/, '').trim().toLowerCase()).filter(Boolean);

export interface ReliktPruefung { verwendet: number; warnungen: string[] }

/** Prüft ein Relikt gegen den Baukasten. Nur Warnungen. */
export function pruefeRelikt(relikt: Relikt, bausteine: BausteinInfo[], bk: Baukasten | null, basis?: AusruestungsItem | null,
  opt: { k?: Katalog | null; heldengrad?: number } = {}): ReliktPruefung {
  const W: string[] = [];
  const nachId = new Map(bausteine.map(b => [b.id, b]));
  let verwendet = 0;
  const anzahl = new Map<string, number>();
  const varianten = new Map<string, string[]>();
  for (const w of relikt.bausteine) {
    const b = nachId.get(w.id);
    if (!b) { W.push(`${w.name ?? w.id}: Baustein nicht geladen (Grimoire fehlt?) – Kosten nicht gezählt.`); continue; }
    verwendet += kostenVon(b, w);
    anzahl.set(b.id, (anzahl.get(b.id) ?? 0) + Math.max(1, w.anzahl || 1));
    if (b.variante) varianten.set(b.variante, [...(varianten.get(b.variante) ?? []), b.name]);
    if (!passtZu(b, relikt.art)) W.push(`${b.name}: gilt für ${b.giltFuer.map(g => GEGENSTANDSARTEN[g] ?? g).join(', ')}, nicht für ${GEGENSTANDSARTEN[relikt.art] ?? relikt.art}.`);
    if (b.mindestPunkte && relikt.punkte < b.mindestPunkte) W.push(`${b.name}: verlangt mindestens ${b.mindestPunkte} Punkte (Materialqualität).`);
    if (b.bedingungMerkmal && basis && !merkmalNamen((basis as { attributes?: string }).attributes).includes(b.bedingungMerkmal.toLowerCase()))
      W.push(`${b.name}: Der Gegenstand braucht das Merkmal ${b.bedingungMerkmal}.`);
    if (b.mindestVtd && basis && 'vtdBonus' in basis && Number(basis.vtdBonus) < b.mindestVtd) W.push(`${b.name}: nur ab VTD-Bonus +${b.mindestVtd}.`);
    if (b.auswahl && !w.auswahl?.trim()) W.push(`${b.name}: Auswahl fehlt (${AUSWAHL[b.auswahl] ?? b.auswahl}).`);
    if (b.aenderungenWahl && !(Number(w.auswahl) >= 0 && Number(w.auswahl) < b.aenderungenWahl.length && w.auswahl !== '' && w.auswahl !== undefined))
      W.push(`${b.name}: Wahl fehlt (${b.aenderungenWahl.map(wahlText).join(' oder ')}).`);
  }
  for (const [id, n] of anzahl) {
    const b = nachId.get(id)!;
    if (b.maxAnzahl !== null && n > b.maxAnzahl) W.push(`${b.name}: höchstens ${b.maxAnzahl}×, gewählt ${n}×.`);
  }
  for (const [v, namen] of varianten) if (namen.length > 1) W.push(`${v === 'material' ? 'Material' : v}: nur eine Variante wählbar (${namen.join(', ')}).`);
  // Merkmale über ihrem Höchstwert (z. B. Scharf je nach Schadenswürfel)
  if (basis) for (const t of reliktWerte(relikt, bausteine, basis).ueberHoechstwert) W.push(t);
  // Stufe 3: Beseelung (Punkte und Kräfte) und Chronik des Wachsens
  if (relikt.beseelung) {
    const bs = pruefeBeseelung(opt.k ?? null, relikt.beseelung);
    verwendet += bs.punkte; W.push(...bs.warnungen);
  }
  if (relikt.chronik?.length) W.push(...pruefeChronik(opt.k ?? null, relikt.chronik, opt.heldengrad));
  if (verwendet > relikt.punkte) W.push(`Die Bausteine kosten ${verwendet} Punkte, das Relikt hat ${relikt.punkte}.`);
  if (bk?.maxPunkte !== null && bk?.maxPunkte !== undefined && relikt.punkte > bk.maxPunkte) W.push(`Mehr als ${bk.maxPunkte} Punkte in einem Relikt (nur nach Spielleiterentscheid).`);
  return { verwendet, warnungen: W };
}

export const AUSWAHL: Record<string, string> = {
  zauber: 'Zauber', schwerpunkt: 'Schwerpunkt', schadensart: 'Schadensart', typus: 'Kreaturentypus', fertigkeit: 'Fertigkeit und Umstand', staerke: 'Stärke',
};

/** Punkte der Ressource Relikt (Summe aller Einträge „Relikt“) */
export function ressourcePunkte(resources: Array<{ name: string; level: number }>): number {
  return resources.filter(r => /^Relikt\b/i.test(r.name)).reduce((s, r) => s + (Number(r.level) || 0), 0);
}

/** Stufen der einzelnen Ressourcen Relikt */
export function reliktRessourcen(resources: Array<{ name: string; level: number }>): number[] {
  return resources.filter(r => /^Relikt\b/i.test(r.name)).map(r => Number(r.level) || 0).filter(n => n > 0);
}

/**
 * Höchste Punktzahl für ein Relikt neben den übrigen Relikten. Ist die Ressource laut Paket mehrfach erwerbbar
 * („um unterschiedliche Relikte zu besitzen“, GRW S. 79), gehört zu jedem Relikt eine eigene Ressource: die übrigen
 * Relikte belegen je die kleinste passende, frei ist die größte verbleibende. Sonst gilt die Summe der Punkte.
 */
export function reliktFrei(stufen: number[], mehrfach: boolean, andere: number[]): number {
  if (!mehrfach) return stufen.reduce((a, b) => a + b, 0) - andere.reduce((a, b) => a + b, 0);
  const frei = [...stufen].sort((a, b) => a - b);
  for (const p of [...andere].sort((a, b) => b - a)) {
    const i = frei.findIndex(x => x >= p);
    frei.splice(i >= 0 ? i : frei.length - 1, 1);
  }
  return frei.length ? Math.max(...frei) : 0;
}

const FELDNAME: Record<string, string> = {
  schaden: 'Schaden', wgs: 'WGS', sr: 'SR', behinderung: 'Behinderung', tick_zuschlag: 'Tick-Zuschlag', haerte: 'Härte', last: 'Last',
  gw: 'GW', kw: 'KW', schwerpunkt: 'Schwerpunkt', merkmal: 'Merkmal', merkmal_entfernen: 'Merkmal entfällt',
};
const vz = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export function wahlText(liste: Aenderung[]): string {
  return liste.map(a => `${FELDNAME[a.feld] ?? a.feld} ${vz(a.wert ?? 0)}`).join(', ');
}

/** Merkmale aus „Scharf 2, Wurffähig“ bzw. „Scharf (2)“ */
function merkmaleLesen(text?: string): Array<{ name: string; stufe: number | null }> {
  return String(text ?? '').split(/,\s*/).map(t => t.trim()).filter(t => t && t !== '–' && t !== '-').map(t => {
    const m = t.match(/^(.*?)\s*\(?(\d+)\)?$/);
    return m ? { name: m[1].trim(), stufe: Number(m[2]) } : { name: t, stufe: null };
  });
}
const merkmaleText = (l: Array<{ name: string; stufe: number | null }>) => l.map(m => (m.stufe === null ? m.name : `${m.name} ${m.stufe}`)).join(', ') || '–';

/** Alle wirksamen Änderungen eines Relikts (Anzahl berücksichtigt, gewählte Variante aufgelöst) */
export function reliktAenderungen(relikt: Relikt, bausteine: BausteinInfo[]): Array<{ a: Aenderung; baustein: BausteinInfo; w: ReliktBaustein }> {
  const nachId = new Map(bausteine.map(b => [b.id, b]));
  const out: Array<{ a: Aenderung; baustein: BausteinInfo; w: ReliktBaustein }> = [];
  for (const w of relikt.bausteine) {
    const b = nachId.get(w.id);
    if (!b) continue;
    const n = Math.max(1, w.anzahl || 1);
    const liste = [...b.aenderungen, ...(b.aenderungenWahl?.[Number(w.auswahl)] ?? [])];
    for (const a of liste) out.push({ a: a.wert !== undefined ? { ...a, wert: a.wert * n } : a, baustein: b, w });
  }
  return out;
}

export interface ReliktWerte {
  item: Partial<InventoryItem>;
  /** lesbare Änderungen für die Beschreibung */
  zeilen: string[];
  /** Merkmale, die ihren Höchstwert überschreiten würden (Warnung) */
  ueberHoechstwert: string[];
}

/** Werte des Relikts: Grundgegenstand plus Wertänderungen der Bausteine (daten.baustein.aenderungen) */
export function reliktWerte(relikt: Relikt, bausteine: BausteinInfo[], basis: AusruestungsItem | null | undefined): ReliktWerte {
  const b = (basis ?? {}) as Record<string, unknown>;
  const item: Partial<InventoryItem> = {
    weaponSkill: b.skill as string | undefined, damage: b.damage as string | undefined, wgs: b.wgs as number | string | undefined,
    range: b.range as string | undefined, attributes: b.attributes as string | undefined, vtdBonus: b.vtdBonus as number | undefined,
    sr: b.sr as number | undefined, handicap: b.handicap as number | undefined, tickModifier: b.tickModifier as number | undefined,
    minStrength: b.minStrength as number | undefined,
    hardness: b.hardness as number | undefined,
    weight: typeof b.load === 'number' ? b.load : parseInt(String(b.load ?? ''), 10) || 0,
  };
  const zeilen: string[] = []; const ueber: string[] = [];
  let merkmale = merkmaleLesen(item.attributes);
  const lastBasis = item.weight ?? 0;
  const zahl = (v: unknown) => Number(v) || 0;
  for (const { a, baustein } of reliktAenderungen(relikt, bausteine)) {
    const n = a.wert ?? 0;
    switch (a.feld) {
      case 'schaden': {
        const alt = String(item.damage ?? '');
        const m = alt.match(/^(\d*W\d+)\s*([+-]\s*\d+)?$/i);
        item.damage = m ? `${m[1]}${(() => { const s = (Number((m[2] ?? '0').replace(/\s/g, '')) || 0) + n; return s ? vz(s) : ''; })()}` : (alt ? `${alt} ${vz(n)}` : vz(n));
        if (alt) zeilen.push(`Schaden ${alt} → ${item.damage}`);
        break;
      }
      case 'wgs': { const alt = zahl(item.wgs); item.wgs = Math.max(1, alt + n); zeilen.push(`WGS ${alt} → ${item.wgs}`); break; }
      case 'sr': { const alt = zahl(item.sr); item.sr = Math.max(0, alt + n); zeilen.push(`SR ${alt} → ${item.sr}`); break; }
      case 'behinderung': { const alt = zahl(item.handicap); item.handicap = Math.max(0, alt + n); zeilen.push(`Behinderung ${alt} → ${item.handicap}`); break; }
      case 'tick_zuschlag': { const alt = zahl(item.tickModifier); item.tickModifier = Math.max(0, alt + n); zeilen.push(`Tick-Zuschlag ${alt} → ${item.tickModifier}`); break; }
      case 'last': {
        const alt = item.weight ?? 0;
        const grenze = baustein.grenze === 'last_haelfte' ? Math.ceil(lastBasis / 2) : 0;
        item.weight = Math.max(grenze, alt + n);
        zeilen.push(`Last ${alt} → ${item.weight}`);
        break;
      }
      case 'merkmal': case 'merkmal_entfernen': {
        const name = a.merkmal ?? '';
        const i = merkmale.findIndex(m => m.name.toLowerCase() === name.toLowerCase());
        if (a.feld === 'merkmal_entfernen') { if (i >= 0) { merkmale = merkmale.filter((_, j) => j !== i); zeilen.push(`Merkmal ${name} entfällt`); } break; }
        const vorher = i >= 0 ? merkmale[i].stufe : null;
        let stufe: number | null = a.wert === undefined ? vorher : (vorher ?? 0) + n;
        if (a.mindestens !== undefined && stufe !== null) stufe = Math.max(stufe, a.mindestens);
        const wuerfel = String(item.damage ?? '').match(/W(\d+)/i)?.[0]?.toUpperCase();
        const hoechst = wuerfel ? a.hoechstens_nach_schadenswuerfel?.[wuerfel] : undefined;
        if (hoechst !== undefined && stufe !== null && stufe > hoechst) { ueber.push(`${baustein.name}: ${name} höchstens ${hoechst} bei ${wuerfel}-Waffen.`); stufe = hoechst; }
        if (i >= 0) merkmale[i] = { name: merkmale[i].name, stufe }; else merkmale.push({ name, stufe });
        zeilen.push(i >= 0 && vorher !== stufe ? `Merkmal ${name} ${vorher ?? ''} → ${stufe ?? ''}`.replace(/\s+/g, ' ') : i >= 0 ? `Merkmal ${name}` : `Merkmal ${name}${stufe !== null ? ` ${stufe}` : ''} neu`);
        break;
      }
      case 'haerte': {
        if (item.hardness === undefined) { zeilen.push(`Härte ${vz(n)}`); item.hardness = Math.max(0, n); break; }
        const alt = item.hardness; item.hardness = Math.max(0, alt + n); zeilen.push(`Härte ${alt} → ${item.hardness}`); break;
      }
      case 'schwerpunkt': break; // Bonus auf einen Schwerpunkt: Auswahl steht beim Baustein
      default: break; // gw/kw wirken auf den Charakter (reliktWiderstand)
    }
  }
  if (merkmale.length || item.attributes) item.attributes = merkmaleText(merkmale);
  return { item, zeilen, ueberHoechstwert: ueber };
}

/** Bonus auf GW/KW aus Relikten im Besitz: je Relikt Summe, über alle Relikte nur der höchste (GRW S. 254) */
export function reliktWiderstand(relikte: Relikt[], inventar: Array<{ id: string }>, bausteine: BausteinInfo[]): Record<string, { summe: number; quellen: { name: string; wert: number }[] }> {
  const imBesitz = new Set(inventar.map(i => i.id));
  const out: Record<string, { summe: number; quellen: { name: string; wert: number }[] }> = {};
  for (const r of relikte) {
    if (!imBesitz.has(r.inventarId)) continue;
    const jeWert: Record<string, number> = {};
    for (const { a, baustein } of reliktAenderungen(r, bausteine)) {
      if (baustein.wirkt !== 'besitz' || (a.feld !== 'gw' && a.feld !== 'kw')) continue;
      jeWert[a.feld] = (jeWert[a.feld] ?? 0) + (a.wert ?? 0);
    }
    for (const [feld, wert] of Object.entries(jeWert)) {
      const key = feld.toUpperCase();
      if (!out[key] || wert > out[key].summe) out[key] = { summe: wert, quellen: [{ name: r.name, wert }] };
    }
  }
  return out;
}

export interface ReliktZauber { relikt: Relikt; spell: Spell; ausloesung: NonNullable<BausteinInfo['ausloesung']> }

/** Zauber aus Zauberverankerungen der Relikte im Besitz, als Zauber zum Wirken (Probe auf die Fertigkeit der Auslösung) */
export function reliktZauber(k: Katalog | null, relikte: Relikt[], inventar: Array<{ id: string }>, bausteine: BausteinInfo[]): ReliktZauber[] {
  if (!k) return [];
  const imBesitz = new Set(inventar.map(i => i.id));
  const nachId = new Map(bausteine.map(b => [b.id, b]));
  const out: ReliktZauber[] = [];
  for (const r of relikte) {
    if (!imBesitz.has(r.inventarId)) continue;
    for (const w of r.bausteine) {
      const b = nachId.get(w.id);
      if (!b?.ausloesung || !w.auswahl) continue;
      const z = k.get(w.auswahl) ?? k.nachTyp('zauber').find(e => e.name === w.auswahl);
      if (!z || z.typ !== 'zauber') continue;
      const d = z.daten as D;
      const schulen = (d.schulen ?? []) as Array<{ id: string; schule: string; grad: number | null }>;
      const s = schulen.find(x => x.grad === (w.grad ?? 0)) ?? schulen[0];
      const fert = k.get(b.ausloesung.fertigkeit)?.name ?? b.ausloesung.fertigkeit;
      const sw = d.schwierigkeit_strukturiert as { art?: string; wert?: number } | undefined;
      const spell: Spell = {
        name: z.name, school: (s && k.get(s.id)?.name) ?? s?.schule ?? '', grade: w.grad ?? s?.grad ?? 0, cost: txt(d.kosten),
        castTime: txt(d.zauberdauer) || undefined, range: txt(d.reichweite) || undefined, duration: txt(d.wirkungsdauer) || undefined,
        target: (d.typus ?? []).join(', ') || undefined,
        description: [txt(d.wirkung), txt(d.erfolgsgrade) ? `Erfolgsgrade:\n${txt(d.erfolgsgrade)}` : ''].filter(Boolean).join('\n\n'),
        page: (z.quelle.buch_seiten ?? [])[0], source: k.pakete[z.quelle.paket]?.kuerzel ?? z.quelle.paket.toUpperCase(),
        difficulty: txt(d.schwierigkeit) || undefined,
        ...(sw?.art === 'fest' && typeof sw.wert === 'number' ? { difficultyType: 'fest' as const, difficultyValue: sw.wert }
          : sw?.art && ['VTD', 'GW', 'KW'].includes(sw.art) ? { difficultyType: sw.art as 'VTD' | 'GW' | 'KW' } : {}),
        probeFertigkeit: fert, ausRelikt: r.name,
      };
      out.push({ relikt: r, spell, ausloesung: b.ausloesung });
    }
  }
  return out;
}

/** Der Inventareintrag eines Relikts: Werte des Grundgegenstands, Name und Beschreibung des Relikts */
/** Auswahl eines Bausteins lesbar: Zauber-ID → Name, Wahl-Index → Änderungen, sonst der Text */
export function auswahlAnzeige(b: BausteinInfo | undefined, w: ReliktBaustein, k?: Katalog | null): string {
  if (!w.auswahl) return '';
  if (b?.aenderungenWahl) return b.aenderungenWahl[Number(w.auswahl)] ? wahlText(b.aenderungenWahl[Number(w.auswahl)]) : '';
  if (b?.auswahl === 'zauber') return k?.get(w.auswahl)?.name ?? w.auswahl;
  return w.auswahl;
}

export function reliktAlsInventar(relikt: Relikt, bausteine: BausteinInfo[], basis: AusruestungsItem | null | undefined, alt?: InventoryItem, k?: Katalog | null): InventoryItem {
  const nachId = new Map(bausteine.map(b => [b.id, b]));
  const zeilen = relikt.bausteine.map(w => {
    const b = nachId.get(w.id);
    const name = b?.name ?? w.name ?? w.id;
    const extra = [w.grad !== undefined && b?.kostenNachGrad ? `Grad ${w.grad}` : '', w.stufe && b?.kostenJe ? `Stufe ${w.stufe}` : '', auswahlAnzeige(b, w, k)].filter(Boolean).join(', ');
    return `• ${name}${(w.anzahl ?? 1) > 1 ? ` ×${w.anzahl}` : ''}${extra ? ` (${extra})` : ''}${b ? ` – ${kostenVon(b, w)} P., ${b.quelle}` : ''}`;
  });
  const werte = reliktWerte(relikt, bausteine, basis);
  const kopf = `Relikt mit ${relikt.punkte} Punkten${basis ? ` auf Basis von ${basis.name}` : ''}.`;
  const kraefte = relikt.beseelung ? aktiveKraefte(relikt.beseelung).map(id => k?.get(id)?.name ?? id) : [];
  const beseelt = relikt.beseelung ? `Beseelt${relikt.beseelung.heiliger ? ` (${relikt.beseelung.heiliger})` : ''}: ${kraefte.join(', ') || 'noch keine Kraft'}.` : '';
  const desc = [kopf, ...zeilen, werte.zeilen.length ? `Werte: ${werte.zeilen.join('; ')}.` : '', beseelt, relikt.notiz ?? ''].filter(Boolean).join('\n');
  const typ = (basis?.type ?? (relikt.art === 'ruestung' ? 'armor' : relikt.art === 'schild' ? 'shield' : relikt.art.endsWith('waffe') ? 'weapon' : 'gear')) as InventoryItem['type'];
  return {
    ...werte.item,
    id: relikt.inventarId,
    name: relikt.name,
    type: typ,
    category: 'Relikt',
    quantity: 1,
    weight: werte.item.weight ?? 0,
    price: undefined,
    desc,
    equipped: alt?.equipped ?? false,
    source: basis?.source ?? 'Eigen',
    page: typeof basis?.page === 'number' && basis.page ? basis.page : undefined,
  };
}

/** Spielwerte, die ein Relikt am Inventareintrag festlegt */
const RELIKT_WERTFELDER = ['damage', 'wgs', 'sr', 'handicap', 'tickModifier', 'weight', 'hardness', 'attributes', 'type'] as const;

/**
 * Inventareinträge von Relikten, deren Spielwerte nicht mehr zu den Regeln passen (z. B. vor Stand 21 gebaut oder
 * Regelpaket geändert). Liefert die neu berechneten Einträge; Notizen werden nur dann ersetzt, wenn Werte abweichen.
 */
export function veralteteReliktEintraege(relikte: Relikt[], inventar: InventoryItem[], bausteine: BausteinInfo[], k: Katalog | null): InventoryItem[] {
  if (!k || !bausteine.length) return [];
  const aus = alleAusruestung(k);
  const raus: InventoryItem[] = [];
  for (const r of relikte) {
    const alt = inventar.find(it => it.id === r.inventarId);
    if (!alt) continue;
    if (r.bausteine.some(w => !bausteine.some(b => b.id === w.id))) continue; // Paket fehlt: nichts anfassen
    const basis = findeAusruestung(aus, r.basisId);
    if (r.basisId && !basis) continue;
    const neu = reliktAlsInventar(r, bausteine, basis, alt, k);
    const a = alt as unknown as Record<string, unknown>, n = neu as unknown as Record<string, unknown>;
    const norm = (v: unknown) => (v === undefined || v === null || v === '' ? '' : String(v));
    // nur Felder, die das Relikt festlegt (nach dem Zusammenführen sind sie gleich, also keine Schleife)
    if (RELIKT_WERTFELDER.some(f => n[f] !== undefined && norm(a[f]) !== norm(n[f]))) raus.push(neu);
  }
  return raus;
}

const BAUSTEIN_CACHE = new WeakMap<Katalog, BausteinInfo[]>();
/** Bausteine des aktiven Katalogs (zwischengespeichert je Katalog) */
export function bausteineAktiv(k: Katalog | null = aktiverKatalog()): BausteinInfo[] {
  if (!k) return [];
  let b = BAUSTEIN_CACHE.get(k);
  if (!b) { b = reliktBausteine(k); BAUSTEIN_CACHE.set(k, b); }
  return b;
}

/** GW/KW-Boni aus den Relikten eines Charakters (aktiver Katalog) */
export function reliktWiderstandFuerCharakter(state: { relikte?: Relikt[]; inventory?: Array<{ id: string }> }) {
  if (!state.relikte?.length) return {};
  return reliktWiderstand(state.relikte, state.inventory ?? [], bausteineAktiv());
}

/** Zauber, die einen Grad in einer Schule haben (Auswahl der Zauberverankerung), alphabetisch */
export function zauberMitGrad(k: Katalog, grad: number): Array<{ id: string; name: string }> {
  return k.nachTyp('zauber').filter(z => ((z.daten.schulen ?? []) as Array<{ grad: number | null }>).some(s => s.grad === grad))
    .map(z => ({ id: z.id, name: z.name })).sort((a, c) => a.name.localeCompare(c.name, 'de'));
}

// ---------------------------------------------------------------- Stufe 3: Wachsen und beseelte Gegenstände
interface WachsenRegeln { kosten?: string; anlaesse: { art: string; punkte_mindestens?: number; punkte_je_heldengrad?: number; bausteine: string; beschreibung_noetig?: boolean }[] }
interface BeseelungRegeln {
  punkte_beseelung: number; kraefte_in_beseelung: number; punkte_je_weitere_kraft: number;
  queste_je_kraft?: boolean; naechste_kraft_nach_queste?: boolean; stufen: { stufe: string; ab_kraft: number }[]; verstoss?: string;
}
const STUFE3_CACHE = new WeakMap<Katalog, { wachsen: WachsenRegeln | null; beseelung: BeseelungRegeln | null; qw: string; qb: string }>();
function stufe3(k: Katalog) {
  let c = STUFE3_CACHE.get(k);
  if (!c) {
    const ew = alleEintraege(k).find(e => e.daten.strukturiert?.relikt_wachsen);
    const eb = alleEintraege(k).find(e => e.daten.strukturiert?.beseelung);
    c = { wachsen: ew?.daten.strukturiert.relikt_wachsen ?? null, beseelung: eb?.daten.strukturiert.beseelung ?? null,
      qw: ew ? quelleText(k, ew) : '', qb: eb ? quelleText(k, eb) : '' };
    STUFE3_CACHE.set(k, c);
  }
  return c;
}
/** Regeln zum Wachsen von Relikten (null, wenn der Band nicht geladen ist) */
export const wachsenRegeln = (k: Katalog | null) => (k ? stufe3(k).wachsen : null);
export const wachsenQuelle = (k: Katalog | null) => (k ? stufe3(k).qw : '');
/** Regeln für beseelte Gegenstände (null, wenn der Band nicht geladen ist) */
export const beseelungRegeln = (k: Katalog | null) => (k ? stufe3(k).beseelung : null);
export const beseelungQuelle = (k: Katalog | null) => (k ? stufe3(k).qb : '');

export const ANLASS_NAME: Record<string, string> = { legendaere_tat: 'Legendäre Tat', heldengrad: 'Neuer Heldengrad', belohnung: 'Abenteuerbelohnung' };

/** Prüft die Chronik gegen die Regeln zum Wachsen */
export function pruefeChronik(k: Katalog | null, chronik: ReliktChronikEintrag[], heldengrad?: number): string[] {
  const R = wachsenRegeln(k);
  if (!R) return ['Wachsen von Relikten: Regeln nicht geladen (Buchpaket fehlt).'];
  const W: string[] = [];
  for (const c of chronik) {
    const a = R.anlaesse.find(x => x.art === c.art);
    if (!a) { W.push(`Chronik: Anlass „${c.art}“ kennen die Regeln nicht.`); continue; }
    if (a.beschreibung_noetig && !c.text.trim()) W.push(`Chronik: ${ANLASS_NAME[c.art] ?? c.art} ohne Beschreibung.`);
    if (a.punkte_mindestens && c.punkte < a.punkte_mindestens) W.push(`Chronik: ${ANLASS_NAME[c.art] ?? c.art} bringt mindestens ${a.punkte_mindestens} Punkt(e).`);
    if (a.punkte_je_heldengrad !== undefined && c.punkte > a.punkte_je_heldengrad) W.push(`Chronik: Ein neuer Heldengrad bringt höchstens ${a.punkte_je_heldengrad} Punkt(e).`);
  }
  const hg = chronik.filter(c => c.art === 'heldengrad');
  if (heldengrad !== undefined && hg.length > Math.max(0, heldengrad - 1)) W.push(`Chronik: ${hg.length}× Wachsen durch Heldengrad, erreicht sind aber erst ${Math.max(0, heldengrad - 1)} neue Heldengrade.`);
  const grade = hg.map(c => c.heldengrad).filter((g): g is number => g !== undefined);
  if (new Set(grade).size < grade.length) W.push('Chronik: Derselbe Heldengrad zählt nur einmal.');
  return W;
}

/** Domänen beseelter Gegenstände */
export const domaenen = (k: Katalog | null) => (k ? alleEintraege(k).filter(e => e.typ === 'reliktdomaene').sort((a, b) => a.name.localeCompare(b.name, 'de')) : []);
/** Kräfte einer Domäne mit Stufe (I, II, III+) */
export function domaenenKraefte(k: Katalog | null, domaene: string): Array<{ id: string; name: string; stufe: string; beschreibung: string }> {
  const d = k?.get(domaene); if (!k || !d) return [];
  return (d.daten.kraefte_refs ?? []).map((r: { id: string; text: string }) => k.get(r.id)).filter(Boolean)
    .map((e: Eintrag) => ({ id: e.id, name: e.name, stufe: String(e.daten.stufe ?? ''), beschreibung: String(e.daten.beschreibung ?? '') }));
}
/** Punkte der Beseelung: Grundpunkte (mit der ersten Kraft) und je weitere freigeschaltete Kraft */
export function beseelungPunkte(R: BeseelungRegeln, b: ReliktBeseelung): number {
  const frei = b.kraefte.filter(x => x.erfuellt).length;
  return R.punkte_beseelung + Math.max(0, frei - R.kraefte_in_beseelung) * R.punkte_je_weitere_kraft;
}
/** Kräfte, die der Träger nutzen kann: freigeschaltet (Queste erfüllt), ohne die ruhenden letzten */
export function aktiveKraefte(b: ReliktBeseelung): string[] {
  const frei = b.kraefte.filter(x => x.erfuellt).map(x => x.id);
  return frei.slice(0, Math.max(0, frei.length - (b.ruht ?? 0)));
}
export function pruefeBeseelung(k: Katalog | null, b: ReliktBeseelung): { punkte: number; warnungen: string[] } {
  const R = beseelungRegeln(k);
  if (!R) return { punkte: 0, warnungen: ['Beseelter Gegenstand: Regeln nicht geladen (Buchpaket fehlt).'] };
  const W: string[] = [];
  const angebot = domaenenKraefte(k, b.domaene);
  if (!b.domaene || !k?.get(b.domaene)) W.push('Beseelter Gegenstand: Domäne wählen.');
  b.kraefte.forEach((x, i) => {
    const kr = angebot.find(a => a.id === x.id);
    const name = k?.get(x.id)?.name ?? x.id;
    if (!kr) W.push(`${name}: gehört nicht zur gewählten Domäne.`);
    const ab = R.stufen.find(s => s.stufe === kr?.stufe)?.ab_kraft;
    if (ab && i + 1 < ab) W.push(`${name} (${kr!.stufe}) eignet sich erst als ${ab}. Kraft, hier ist sie die ${i + 1}. (nur nach Spielleiterentscheid).`);
    if (R.naechste_kraft_nach_queste && x.erfuellt && b.kraefte.slice(0, i).some(y => !y.erfuellt)) W.push(`${name}: Erst die Queste der vorherigen Kraft erfüllen.`);
    if (R.queste_je_kraft && x.erfuellt && !x.queste?.trim()) W.push(`${name}: Queste angeben.`);
  });
  if (new Set(b.kraefte.map(x => x.id)).size < b.kraefte.length) W.push('Beseelter Gegenstand: Jede Kraft nur einmal.');
  return { punkte: beseelungPunkte(R, b), warnungen: W };
}

/** Schwerpunkt-Boni aus Relikten im Inventar für eine Probe (zum Anklicken, wenn der Schwerpunkt passt) */
export function reliktSchwerpunktBoni(relikte: Relikt[], inventar: Array<{ id: string }>, bausteine: BausteinInfo[], fertigkeit: string):
  Array<{ id: string; quelle: string; wert: number; text: string; bedingung: string; beleg: string }> {
  const out: Array<{ id: string; quelle: string; wert: number; text: string; bedingung: string; beleg: string }> = [];
  const f = fertigkeit.toLowerCase();
  for (const r of relikte) {
    if (!inventar.some(it => it.id === r.inventarId)) continue;
    const jeSchwerpunkt = new Map<string, number>();
    let beleg = '';
    for (const { a, w, baustein } of reliktAenderungen(r, bausteine)) {
      if (a.feld !== 'schwerpunkt' || !a.wert) continue;
      const sp = (w.auswahl ?? '').trim();
      if (sp && f && !sp.toLowerCase().includes(f)) continue;
      jeSchwerpunkt.set(sp, (jeSchwerpunkt.get(sp) ?? 0) + a.wert);
      beleg = baustein.quelle;
    }
    for (const [sp, wert] of jeSchwerpunkt)
      out.push({ id: `relikt:${r.id}:${sp}`, quelle: r.name, wert, text: `Schwerpunkt ${sp || '(nicht gewählt)'}`, bedingung: 'wenn das Relikt eingesetzt wird und der Schwerpunkt passt', beleg });
  }
  return out;
}
