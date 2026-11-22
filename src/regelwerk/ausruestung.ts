/**
 * Ausrüstung aus den Regelpaketen im Format des Editors (src/data/equipment.ts).
 * - grimoireAusruestung(k): alle Ausrüstungs-Einträge der hochgeladenen Grimoires (Waffen, Rüstungen, Schilde, Gegenstände, Kleidung,
 *   Projektile, Ausrüstungssätze, Alchemika, Kräuter, Gifte, Material, Verbesserungen, magische Gegenstände).
 * - grwMitGrimoireAenderungen(k, liste): GRW-Liste mit den Änderungen der Grimoires (aktion „ersetzt“ überschreibt Werte,
 *   „ergaenzt“ mit Beschreibung hängt den Text an).
 * - grwAusruestung(k): Ausrüstung des Grundregelwerks aus dem GRW-Paket (ohne Paket leer).
 * - alleAusruestung(): GRW-Ausrüstung plus Grimoires des aktiven Katalogs; ohne Katalog leer.
 * - findeAusruestung(liste, id): Eintrag nach ID; versteht auch die IDs der früheren eingebauten Liste („waffen|Nahkampf|…|Name“).
 */
import type { ArmorItem, GearItem, ShieldItem, WeaponItem } from '../types/regeldaten';
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';
import { aktiverKatalog } from './bruecke';

export type AusruestungsItem = WeaponItem | ArmorItem | ShieldItem | GearItem;

/** Ausrüstungstypen der Regelpakete → Editor-Typ und Bezeichnung */
export const AUSRUESTUNGS_TYPEN: Record<string, { art: 'weapon' | 'armor' | 'shield' | 'gear' | 'alchemika'; bezeichnung: string }> = {
  waffe: { art: 'weapon', bezeichnung: 'Waffe' },
  ruestung: { art: 'armor', bezeichnung: 'Rüstung' },
  schild: { art: 'shield', bezeichnung: 'Schild' },
  gegenstand: { art: 'gear', bezeichnung: 'Ausrüstung' },
  kleidung: { art: 'gear', bezeichnung: 'Kleidung' },
  projektil: { art: 'gear', bezeichnung: 'Projektile' },
  ausruestungssatz: { art: 'gear', bezeichnung: 'Ausrüstungssatz' },
  material: { art: 'gear', bezeichnung: 'Material' },
  verbesserung: { art: 'gear', bezeichnung: 'Verbesserung' },
  magischer_gegenstand: { art: 'gear', bezeichnung: 'Magischer Gegenstand' },
  alchemikum: { art: 'alchemika', bezeichnung: 'Alchemika' },
  kraut: { art: 'alchemika', bezeichnung: 'Kräuter' },
  gift: { art: 'alchemika', bezeichnung: 'Gifte' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D = Record<string, any>;
const txt = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const zahl = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const leer = (s: string) => !s || s === '–' || s === '-';
/** Härte als Zahl, wenn das Paket eine nennt */
const haerte = (d: D): { hardness?: number } => (txt(d.haerte) !== '' && Number.isFinite(Number(d.haerte)) ? { hardness: Number(d.haerte) } : {});

function preis(d: D): string {
  if (d.preis && typeof d.preis === 'object' && txt(d.preis.text)) return txt(d.preis.text);
  if (typeof d.preis === 'string' && d.preis) return d.preis;
  if (d.preis_lunare !== undefined && d.preis_lunare !== null) return `${d.preis_lunare} L`;
  if (txt(d.einkaufspreis_l)) return `${d.einkaufspreis_l} L`;
  if (txt(d.liste?.kosten)) return `${d.liste.kosten} QS`;
  return '';
}

/** Werte-Zeile wie in der eingebauten GRW-Liste („Fertigkeit: … | Schaden: … | …“) */
function werteZeile(paare: Array<[string, unknown]>): string {
  return paare.filter(([, v]) => !leer(txt(v))).map(([k, v]) => `${k}: ${txt(v)}`).join(' | ');
}

/** Freitexte eines Eintrags (Beschreibung, Besonderheiten, Kästen …) */
function texte(d: D): string[] {
  const out: string[] = [];
  const dazu = (s: unknown, praefix = '') => { const t = txt(s); if (t && !leer(t) && !out.some(o => o.includes(t))) out.push(praefix + t); };
  dazu(d.kurzbeschreibung); dazu(d.beschreibung); dazu(d.regelbeschreibung);
  dazu(d.besonderheiten, 'Besonderheiten: '); dazu(d.besonderheit, 'Besonderheit: ');
  dazu(d.auswirkung, 'Wirkung: '); if (typeof d.wirkung === 'string' && !d.giftwerte) dazu(d.wirkung, 'Wirkung: ');
  dazu(d.materialeigenschaft, 'Materialeigenschaft: '); dazu(d.positiver_umstand, 'Positiver Umstand: ');
  dazu(d.kosten_und_grenzen, 'Kosten und Grenzen: '); if (!d.beschreibung) dazu(d.liste?.kurzbeschreibung);
  dazu(d.liste?.einschraenkungen, 'Einschränkungen: ');
  for (const k of d.kaesten ?? []) dazu(k?.titel ? `${k.titel}: ${txt(k.text)}` : k?.text);
  if (Array.isArray(d.inhalt) && d.inhalt.length) dazu('Inhalt: ' + d.inhalt.map((x: D) => txt(x.name)).filter(Boolean).join(', '));
  if (d.felder && typeof d.felder === 'object' && !Array.isArray(d.felder)) {
    for (const [k, v] of Object.entries(d.felder as D)) if (typeof v === 'string' || typeof v === 'number') dazu(v, `${feldName(k)}: `);
  }
  dazu(d.fussnote);
  return out;
}

const FELDNAMEN: Record<string, string> = { materialeigenschaft: 'Materialeigenschaft', qualitaet: 'Qualität', aufpreis_pro_punkt_last: 'Aufpreis je Last',
  modifikationen: 'Modifikationen', schwachpunkt: 'Schwachpunkt', verfuegbarkeit: 'Verfügbarkeit', merkmale: 'Merkmale', preis: 'Preis', schaden: 'Schaden',
  tick_zuschlag: 'Tick-Zuschlag', mindest_staerke: 'Mindest-STÄ', vtd_bonus: 'VTD+', behinderung: 'Behinderung', reichweite: 'Reichweite', last: 'Last' };
const feldName = (k: string) => FELDNAMEN[k.replace(/_text$/, '')] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');

const beschreibung = (zeile: string, d: D) => [zeile, ...texte(d)].filter(Boolean).join('\n\n');

/** Ein Ausrüstungs-Eintrag des Katalogs im Editor-Format; null für Typen ohne Ausrüstung */
export function alsAusruestung(e: Eintrag, quelle: string): AusruestungsItem | null {
  const t = AUSRUESTUNGS_TYPEN[e.typ];
  if (!t) return null;
  const d = e.daten as D;
  const page = (e.quelle.buch_seiten ?? [])[0] ?? 0;
  const merkmale = leer(txt(d.merkmale_text)) ? '–' : txt(d.merkmale_text);
  const last = d.last ?? '';
  if (t.art === 'weapon') {
    const skill = txt(d.fertigkeit_name) || txt(d.gruppe);
    const zeile = werteZeile([['Fertigkeit', skill], ['Schaden', d.schaden], ['WGS', d.wgs], ['Reichweite', d.reichweite], ['Attribute', (d.attribute ?? []).join(', ')],
      ['Mindestattribute', d.mindestattribute_text], ['Last', last], ['Härte', d.haerte], ['Preis', preis(d)], ['Verfügbarkeit', d.verfuegbarkeit], ['Merkmale', merkmale]]);
    return { id: e.id, name: e.name, type: 'weapon', category: txt(d.modus) || 'Nahkampf', skill, damage: txt(d.schaden), wgs: d.wgs ?? '',
      range: txt(d.reichweite), price: preis(d), load: last, attributes: merkmale, source: quelle, page, desc: beschreibung(zeile, d), ...haerte(d) };
  }
  if (t.art === 'armor' || t.art === 'shield') {
    const zeile = werteZeile([['VTD+', d.vtd_bonus], ['SR', d.sr], ['Behinderung', d.behinderung], ['Tick-Zuschlag', d.tick_zuschlag],
      ['Mindest-STÄ', d.mindest_staerke], ['Last', last], ['Härte', d.haerte], ['Preis', preis(d)], ['Verfügbarkeit', d.verfuegbarkeit], ['Merkmale', merkmale]]);
    const gemeinsam = { id: e.id, name: e.name, vtdBonus: zahl(d.vtd_bonus), handicap: zahl(d.behinderung), tickModifier: zahl(d.tick_zuschlag),
      price: preis(d), load: last, attributes: merkmale, source: quelle, page, desc: beschreibung(zeile, d), ...haerte(d) };
    return t.art === 'armor'
      ? { ...gemeinsam, type: 'armor', category: 'Rüstung', sr: zahl(d.sr), minStrength: zahl(d.mindest_staerke) }
      : { ...gemeinsam, type: 'shield', category: 'Schild' };
  }
  const gruppe = txt(d.gruppe) || txt(d.kategorie) || txt(d.art);
  const category = e.typ === 'gegenstand' ? (gruppe || t.bezeichnung) : t.bezeichnung;
  const zeile = werteZeile([
    ['Gruppe', category !== gruppe ? gruppe : ''], ['Region', d.region], ['Verwendung', d.verwendung], ['Fertigkeit', d.fertigkeit], ['Schwerpunkt', d.schwerpunkt],
    ['Schaden', d.schaden], ['Reichweite', d.reichweite], ['Tick-Zuschlag', d.tick_zuschlag],
    ['Gift', d.giftwerte ? [d.giftwerte.art_stufe, d.giftwerte.wirkung, d.giftwerte.dauer].filter(Boolean).join(' / ') : ''],
    ['Qualität', d.qualitaet], ['Kosten (Qualität)', d.kosten_qualitaet], ['Max. Last', d.max_last], ['Aufpreis je Last', txt(d.aufpreis_pro_punkt_last_l) ? `${d.aufpreis_pro_punkt_last_l} L` : ''],
    ['Last', last], ['Härte', d.haerte], ['Preis', preis(d)], ['Verfügbarkeit', d.verfuegbarkeit]]);
  const item: GearItem = { id: e.id, name: e.name, type: t.art as GearItem['type'], category, price: preis(d), source: quelle, page, desc: beschreibung(zeile, d) };
  if (last !== '') item.load = last;
  Object.assign(item, haerte(d));
  return item;
}

const NACH_TYP = Object.fromEntries(Object.entries(AUSRUESTUNGS_TYPEN).map(([typ, t]) => [typ, t.art]));
const kuerzel = (k: Katalog, pid: string) => k.pakete[pid]?.kuerzel ?? (k.manifest.bekannte_pakete ?? []).find(p => p.id === pid)?.kuerzel ?? pid;

const CACHE = new WeakMap<Katalog, { buch: AusruestungsItem[]; grw: AusruestungsItem[] }>();

/** Ausrüstung der hochgeladenen Grimoires (ohne Grundregelwerk), nach Ladereihenfolge und Name */
export function grimoireAusruestung(k: Katalog): AusruestungsItem[] {
  const basis = k.manifest.basis_paket;
  const out: Array<{ r: number; item: AusruestungsItem }> = [];
  for (const e of Object.values(k.eintraege)) {
    if (e.quelle.paket === basis || e.aktion !== 'neu' || !(e.typ in NACH_TYP)) continue;
    const item = alsAusruestung(e, kuerzel(k, e.quelle.paket));
    if (item) out.push({ r: k.pakete[e.quelle.paket]?.ladereihenfolge ?? 999, item });
  }
  return out.sort((a, b) => a.r - b.r || a.item.name.localeCompare(b.item.name, 'de')).map(x => x.item);
}

/** Passender GRW-Katalogeintrag zu einem Eintrag der eingebauten Liste (Name, Typ, bei Waffen Nah-/Fernkampf) */
function grwEintrag(k: Katalog, item: AusruestungsItem, nachName: Map<string, Eintrag[]>): Eintrag | undefined {
  const kandidaten = nachName.get(`${item.type}|${item.name.toLowerCase()}`) ?? [];
  if (item.type === 'weapon') return kandidaten.find(e => txt(e.daten.modus) === item.category) ?? kandidaten[0];
  return kandidaten[0];
}

const REIHENFOLGE = Object.keys(AUSRUESTUNGS_TYPEN);
const GRW_CACHE = new WeakMap<Katalog, AusruestungsItem[]>();

/** Ausrüstung des Grundregelwerks aus dem GRW-Paket, nach Art und Name */
export function grwAusruestung(k: Katalog | null = aktiverKatalog()): AusruestungsItem[] {
  if (!k) return [];
  if (!GRW_CACHE.has(k)) {
    const basis = k.manifest.basis_paket;
    const E = Object.values(k.eintraege).filter(e => e.quelle.paket === basis && e.aktion === 'neu' && e.typ in NACH_TYP)
      .sort((a, b) => REIHENFOLGE.indexOf(a.typ) - REIHENFOLGE.indexOf(b.typ) || a.name.localeCompare(b.name, 'de'));
    const liste = E.map(e => alsAusruestung(e, kuerzel(k, basis))).filter((x): x is AusruestungsItem => !!x);
    GRW_CACHE.set(k, liste);
  }
  return GRW_CACHE.get(k)!;
}

/** Eintrag nach ID; IDs der früheren eingebauten Liste („waffen|Nahkampf|Klingenwaffen|Langschwert“) werden über Art, Name und Modus gefunden */
export function findeAusruestung(liste: AusruestungsItem[], id: string | undefined | null): AusruestungsItem | null {
  if (!id) return null;
  const direkt = liste.find(i => i.id === id);
  if (direkt || !id.includes('|')) return direkt ?? null;
  const teile = id.split('|'); const name = teile[teile.length - 1];
  const art = ({ waffen: 'weapon', ruestungen: 'armor', schilde: 'shield', ausruestung: 'gear', alchemika: 'alchemika' } as Record<string, string>)[teile[0]];
  const passend = liste.filter(i => i.name === name && (!art || i.type === art));
  return (art === 'weapon' ? passend.find(i => (i as WeaponItem).category === teile[1]) : undefined) ?? passend[0] ?? null;
}

/** GRW-Ausrüstung mit den Änderungen der geladenen Grimoires */
export function grwMitGrimoireAenderungen(k: Katalog, liste: AusruestungsItem[] = grwAusruestung(k)): AusruestungsItem[] {
  const basis = k.manifest.basis_paket;
  const nachName = new Map<string, Eintrag[]>();
  for (const e of Object.values(k.eintraege)) {
    if (e.quelle.paket !== basis || !(e.typ in NACH_TYP) || !k.erweiterungen[e.id]?.length) continue;
    const key = `${NACH_TYP[e.typ]}|${e.name.toLowerCase()}`;
    nachName.set(key, [...(nachName.get(key) ?? []), e]);
  }
  if (!nachName.size) return liste;
  return liste.map(item => {
    const g = grwEintrag(k, item, nachName);
    if (!g) return item;
    const erw = k.erweiterungen[g.id] ?? [];
    const zusatz: string[] = [];
    let neu: AusruestungsItem = item;
    for (const x of erw) {
      const q = `${kuerzel(k, x.quelle.paket)}${x.quelle.buch_seiten?.length ? ` S. ${x.quelle.buch_seiten[0]}` : ''}`;
      if (x.aktion === 'ersetzt') {
        // Geltende Werte stehen nach dem Laden im GRW-Eintrag; übernommen werden nur die geänderten Felder.
        const felder = Object.keys(x.aenderungen ?? {});
        const ausKatalog = alsAusruestung(g, item.source) as unknown as Record<string, unknown>;
        const n = { ...neu } as unknown as Record<string, unknown>;
        if (felder.some(f => f === 'merkmale' || f === 'merkmale_text')) {
          n.attributes = ausKatalog.attributes;
          n.desc = String(n.desc ?? '').replace(/Merkmale: [^|\n]*/, `Merkmale: ${ausKatalog.attributes}`);
        }
        for (const [feld, ziel] of [['schaden', 'damage'], ['wgs', 'wgs'], ['reichweite', 'range'], ['last', 'load'], ['vtd_bonus', 'vtdBonus'], ['sr', 'sr'],
          ['behinderung', 'handicap'], ['tick_zuschlag', 'tickModifier'], ['mindest_staerke', 'minStrength'], ['preis', 'price']] as const) {
          if (felder.includes(feld) && ziel in ausKatalog) n[ziel] = ausKatalog[ziel];
        }
        neu = n as unknown as AusruestungsItem;
        const welche = felder.filter(f => !(f === 'merkmale' && felder.includes('merkmale_text')))
          .map(f => { const v = g.daten[f]; const w = v && typeof v === 'object' ? txt((v as D).text) : txt(v); return w ? `${feldName(f)} ${w}` : feldName(f); });
        zusatz.push(`Geändert durch ${q}: ${welche.join('; ')}.`);
      } else if (x.aktion === 'ergaenzt') {
        const t = texte(x.daten as D).filter(s => !(item.desc ?? '').includes(s));
        if (t.length) zusatz.push(`${q}: ${t.join('\n\n')}`);
      }
    }
    if (neu === item && !zusatz.length) return item;
    return { ...neu, desc: [neu.desc, ...zusatz].filter(Boolean).join('\n\n') };
  });
}

/** Alle Ausrüstung für Auswahllisten: GRW (mit Änderungen der Grimoires) plus Grimoires des aktiven Katalogs */
export function alleAusruestung(k: Katalog | null = aktiverKatalog()): AusruestungsItem[] {
  if (!k) return grwAusruestung(null);
  let c = CACHE.get(k);
  if (!c) { c = { grw: grwMitGrimoireAenderungen(k), buch: grimoireAusruestung(k) }; CACHE.set(k, c); }
  return [...c.grw, ...c.buch];
}
