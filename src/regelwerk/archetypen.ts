/**
 * Archetypen des Grundregelwerks (Anhang 3, GRW S. 323–341) aus den Einträgen vom Typ „archetyp“ im GRW-Paket.
 *
 * Die Datenseite (Werkzeuge/regelpakete/archetypen.py) hat die Werte der Charakterbögen übernommen, die Modulwahl
 * rekonstruiert und jeder Stärke, Meisterschaft, jedem Zauber und jeder Ressourcenstufe ihre Herkunft zugeordnet
 * (Rasse, Kultur, Abstammung, Ausbildung, Schritt 7, Feinschliff, Start-Erfahrung). Hier wird daraus ein Charakter
 * des Editors – ohne eigene Regeln: Namen, Stufen und Beschreibungen kommen aus dem Katalog.
 */
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';
import type { Begleiter, CharacterState, InventoryItem, ItemEntry, Mastery, Relikt, Spell } from '../types';
import { aktiverKatalog, RASSE_ID, zauberAlsSpell } from './bruecke';
import { editorFertigkeit, modulWerte } from './erschaffungEditor';
import { gratisStaerkeDerKultur } from './grwListen';
import { alsAusruestung, type AusruestungsItem } from './ausruestung';
import { reliktAlsInventar, reliktBausteine } from './relikte';
import { DEFAULT_STATE } from '../hooks/useCharacterState';
import { generateId } from '../utils/id';

const ATTR_EDITOR: Record<string, string> = { 'STÄ': 'STA' };
const attrEditor = (a: Record<string, number>) => Object.fromEntries(Object.entries(a).map(([kz, v]) => [ATTR_EDITOR[kz] ?? kz, v]));
const RASSE_EDITOR = Object.fromEntries(Object.entries(RASSE_ID).map(([n, id]) => [id, n]));

type Herkunft = 'rasse' | 'kultur' | 'abstammung' | 'ausbildung' | 'schritt7' | 'feinschliff' | 'ep';
interface AtStaerke { id: string; stufe: number; auswahl?: string | null; herkunft: Herkunft; ep?: number }
interface AtMeisterschaft { fertigkeit: string; id?: string; schwerpunkt_id?: string; schwerpunkt?: string; schwelle: number; auswahl?: string; herkunft: Herkunft; ep?: number }
interface AtZauber { id: string; schule: string; grad: number; herkunft: Herkunft; ep?: number }
interface AtRessource {
  id: string; stufe: number; text?: string | null; ep_stufen?: number; nicht_im_bogen?: boolean;
  begleiter?: { id: string; art: 'tier'; name: string; rufname?: string | null; kreatur: number; vertrauter?: boolean };
  relikt?: { name: string; art: string; basis?: string; bausteine: { id: string; anzahl: number; auswahl?: string }[]; hinweis?: string };
}
interface AtGegenstand { id?: string; text?: string; anzahl: number }

export interface ArchetypInfo {
  id: string; name: string; titel: string; kurz: string; rasse: string; mondzeichen: string; kulturkunde: string; ausbildung: string;
  attribute: Record<string, number>; seiten: number[];
  /** Begründungen, wo der Bogen von einem Modul abweicht und deshalb frei gebaut wurde (aus dem Paket) */
  abweichungen: string[];
}

const name = (k: Katalog, id: string | undefined) => (id ? k.get(id)?.name ?? '' : '');

function info(k: Katalog, e: Eintrag): ArchetypInfo {
  const d = e.daten;
  return {
    id: e.id, name: e.name, titel: d.titel, kurz: d.kurzbeschreibung, rasse: RASSE_EDITOR[d.rasse] ?? name(k, d.rasse),
    mondzeichen: name(k, d.mondzeichen), kulturkunde: d.kulturkunde, ausbildung: d.ausbildung_name,
    attribute: attrEditor(d.attribute), seiten: e.quelle.buch_seiten ?? [],
    abweichungen: [d.kultur_frei, d.abstammung_frei].filter((x): x is string => typeof x === 'string' && !!x),
  };
}

/** Archetypen aus den geladenen Paketen, in der Reihenfolge des Pakets */
export function archetypen(k: Katalog | null = aktiverKatalog()): ArchetypInfo[] {
  if (!k) return [];
  return k.nachTyp('archetyp').map((e) => info(k, e));
}

/** Gegenstand aus dem Katalog als Inventareintrag (wie beim Hinzufügen aus dem Katalog im Inventar) */
function gegenstand(k: Katalog, g: AtGegenstand): InventoryItem | null {
  if (!g.id) return { id: generateId(), name: g.text ?? '', type: 'gear', quantity: g.anzahl, source: 'Eigen' };
  const e = k.get(g.id); if (!e) return null;
  const it = alsAusruestung(e, k.pakete[e.quelle.paket]?.kuerzel ?? e.quelle.paket) as (Record<string, unknown> & { name: string; type: InventoryItem['type'] }) | null;
  if (!it) return null;
  const last = typeof it.load === 'number' ? it.load : parseInt(String(it.load ?? ''), 10) || 0;
  const ruestung = it.type === 'weapon' || it.type === 'armor' || it.type === 'shield';
  return {
    id: generateId(), name: it.name, type: it.type, category: it.category as string | undefined, quantity: g.anzahl, weight: last,
    price: (it.price as string) || '', desc: (it.desc as string) || '', equipped: ruestung, source: it.source as string, page: it.page as number | undefined,
    weaponSkill: it.skill as string | undefined, damage: it.damage as string | undefined, wgs: it.wgs as number | string | undefined, range: it.range as string | undefined,
    vtdBonus: it.vtdBonus as number | undefined, sr: it.sr as number | undefined, handicap: it.handicap as number | undefined,
    tickModifier: it.tickModifier as number | undefined, minStrength: it.minStrength as number | undefined, hardness: it.hardness as number | undefined,
    attributes: it.attributes as string | undefined,
  };
}

/**
 * Charakter des Editors zu einem Archetyp (abgeschlossene Erschaffung, Start-Erfahrung eingesetzt wie im Bogen).
 * Beschreibungen und Seiten ergänzt referenceCharacterResources() beim Laden.
 */
export function archetypZuCharakter(id: string, k: Katalog | null = aktiverKatalog()): CharacterState | null {
  const e = k?.get(id);
  if (!k || !e || e.typ !== 'archetyp') return null;
  const d = e.daten;
  const fert = (fid: string) => editorFertigkeit(k, fid) ?? name(k, fid);

  // Fertigkeiten: Punkte aus den Start-EP getrennt (Steigerung zu Spielbeginn)
  const skillsBase: Record<string, number> = {}; const skillsXp: Record<string, number> = {};
  for (const [fid, v] of Object.entries(d.fertigkeiten as Record<string, number>)) {
    const ep = Number((d.fertigkeiten_ep ?? {})[fid]) || 0;
    skillsBase[fert(fid)] = v - ep;
    if (ep) skillsXp[fert(fid)] = ep;
  }

  // Kultur und Abstammung: Modul mit Wahl (eingetragen) oder frei gebaut
  const modul = (mid: string, wahl: Record<string, unknown> | undefined) => ({ modul: mid, wahl, angewendet: modulWerte(k, mid, wahl ?? {}).werte });
  const kultur = d.kultur_frei ? null : modul(d.kultur, d.kultur_wahl);
  const abstammung = d.abstammung_frei ? null : modul(d.abstammung, d.abstammung_wahl);

  // Stärken: je Stärke und Herkunftsart ein Eintrag (Stufe = Anzahl)
  const strengthsList: ItemEntry[] = [];
  for (const s of d.staerken as AtStaerke[]) {
    const n = name(k, s.id);
    const art = s.herkunft === 'rasse' ? 'rasse' : s.herkunft === 'ep' ? 'xp' : 'creation';
    const da = strengthsList.find((x) => x.name === n && (art === 'rasse' ? x.isRacial : !x.isRacial && x.source === (art === 'xp' ? 'xp' : 'creation')));
    if (da) { da.level += 1; continue; }
    strengthsList.push({
      name: n, level: 1, source: art === 'xp' ? 'xp' : 'creation', pointCost: art === 'rasse' ? 0 : s.stufe,
      isFree: art === 'rasse', isRacial: art === 'rasse',
    });
  }
  const gratis = gratisStaerkeDerKultur(k);
  if (gratis && d.kulturkunde) strengthsList.push({ name: `${gratis} (${d.kulturkunde})`, level: 1, isFree: true, isRacial: false, source: 'creation', pointCost: 0 });

  // Meisterschaften: Kultur/Ausbildung = Erschaffung, Feinschliff = frei, sonst aus den Start-EP
  const masteries: Record<string, Mastery[]> = {};
  for (const m of d.meisterschaften as AtMeisterschaft[]) {
    const skill = fert(m.fertigkeit);
    const mName = m.schwerpunkt ? `Schwerpunkt: ${m.schwerpunkt} (S1)` : `${name(k, m.id)} (S${m.schwelle || 1})`;
    const erschaffung = m.herkunft === 'kultur' || m.herkunft === 'ausbildung';
    (masteries[skill] ??= []).push({
      id: generateId(), name: mName, tier: m.schwelle || 1, cost: m.herkunft === 'ep' ? Number(m.ep) || 0 : 0,
      isFree: m.herkunft === 'feinschliff', isCreationBonus: erschaffung, source: erschaffung ? 'Erschaffung' : 'GRW', skill,
      ...(m.auswahl ? { userNote: m.auswahl } : {}),
    });
  }

  // Zauber: Feinschliff = frei, sonst aus den Start-EP
  const spellsList: Spell[] = [];
  for (const z of d.zauber as AtZauber[]) {
    const s = zauberAlsSpell(k, z.id, z.schule); if (!s) continue;
    spellsList.push(z.herkunft === 'ep' ? { ...s, isFree: false, sourceMode: 'xp', xpCost: Number(z.ep) || 0 } : { ...s, isFree: true, sourceMode: 'creation' });
  }

  // Ressourcen (Stufen aus den Start-EP als xpStufen); Freitexte des Bogens ins Protokoll
  const resourcesList: ItemEntry[] = (d.ressourcen as AtRessource[]).map((r) => ({
    name: name(k, r.id), level: r.stufe, source: 'creation', pointCost: 1, ...(r.ep_stufen ? { xpStufen: r.ep_stufen } : {}),
  }));
  const weaknessesList: ItemEntry[] = (d.schwaechen as { name: string; id?: string }[]).map((s) => ({ name: s.id ? name(k, s.id) : s.name, level: 1, source: 'creation', pointCost: 0 }));
  const languagesList: ItemEntry[] = (d.sprachen as string[]).map((sid, i) => ({
    name: name(k, sid), level: 1, source: 'creation', isFree: true, pointCost: 0, desc: i === 0 ? 'Muttersprache' : 'Handelssprache',
  }));
  const inventory = (d.ausruestung as AtGegenstand[]).map((g) => gegenstand(k, g)).filter((x): x is InventoryItem => !!x);

  // Kreatur als Tiergefährte (Begleiter), Relikte mit ihren Bausteinen (Inventareintrag wie beim Bau im Editor)
  const begleiter: Begleiter[] = (d.ressourcen as AtRessource[]).filter((r) => r.begleiter).map((r) => ({
    id: r.begleiter!.id, art: 'tier', name: r.begleiter!.name, ...(r.begleiter!.rufname ? { rufname: r.begleiter!.rufname } : {}),
    kreatur: r.begleiter!.kreatur, ...(r.begleiter!.vertrauter ? { vertrauter: true } : {}),
  }));
  const relikte: Relikt[] = [];
  const bausteine = reliktBausteine(k);
  for (const r of (d.ressourcen as AtRessource[]).filter((x) => x.relikt)) {
    const rl = r.relikt!;
    const be = rl.basis ? k.get(rl.basis) : undefined;
    const basis = be ? (alsAusruestung(be, k.pakete[be.quelle.paket]?.kuerzel ?? be.quelle.paket) as AusruestungsItem | null) : null;
    const alt = basis ? inventory.find((it) => it.name === basis.name) : undefined;
    const relikt: Relikt = {
      id: generateId(), name: rl.name, punkte: r.stufe, art: rl.art, ...(rl.basis ? { basisId: rl.basis, basisName: basis?.name } : {}),
      bausteine: rl.bausteine.map((b) => ({ id: b.id, anzahl: b.anzahl, ...(b.auswahl ? { auswahl: b.auswahl } : {}) })),
      ...(rl.hinweis ? { notiz: rl.hinweis } : {}), inventarId: alt?.id ?? generateId(),
    };
    const item = { ...reliktAlsInventar(relikt, bausteine, basis, alt, k), ...(alt ? { equipped: alt.equipped } : {}) };
    if (alt) inventory[inventory.indexOf(alt)] = item; else inventory.push(item);
    relikte.push(relikt);
  }

  const texte = [
    ...(d.ressourcen as AtRessource[]).filter((r) => r.text).map((r) => `${name(k, r.id)} ${r.stufe}: ${r.text}`),
    ...(d.ressourcen as AtRessource[]).filter((r) => r.nicht_im_bogen).map((r) => `${name(k, r.id)} ${r.stufe}: vom Abstammungsmodul, im Bogen nicht genannt`),
    ...(d.staerken as AtStaerke[]).filter((s) => s.auswahl).map((s) => `${name(k, s.id)}: ${s.auswahl}`),
    ...[d.kultur_frei, d.abstammung_frei].filter(Boolean),
  ];
  const seiten = (e.quelle.buch_seiten ?? []).join(', ');

  return {
    ...DEFAULT_STATE,
    mode: 'play', creationFinalized: true, xpTotal: Number(d.ep?.gesamt) || 15,
    // Die Bögen rechnen ohne die Optionalregel Traglast (GRW S. 165): GSW nur mit der Behinderung der Rüstung
    ignoreEncumbrance: true,
    name: e.name, race: RASSE_EDITOR[d.rasse] ?? '', moonSign: name(k, d.mondzeichen), homeRegion: d.kulturkunde ?? '',
    attrBase: attrEditor(d.attribute_basis) as unknown as CharacterState['attrBase'],
    raceBonusAttrs: (d.rasse_frei as string[]).map((a) => ATTR_EDITOR[a] ?? a),
    attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
    skillsBase, skillsXp, masteries, strengthsList, resourcesList, weaknessesList, languagesList, spellsList, inventory,
    ...(begleiter.length ? { begleiter } : {}), ...(relikte.length ? { relikte } : {}),
    money: { solare: Number(d.vermoegen?.solare) || 0, lunare: Number(d.vermoegen?.lunare) || 0, telare: Number(d.vermoegen?.telare) || 0 },
    erschaffung: { kultur, abstammung },
    playState: { ...DEFAULT_STATE.playState, splitterPoints: Number(d.splitterpunkte) || DEFAULT_STATE.playState.splitterPoints },
    advancementLog: [{
      id: generateId(), timestamp: new Date().toISOString(), category: 'note',
      title: `Archetyp ${e.name} (${d.titel})`,
      detail: [`Ausbildung: ${d.ausbildung_name}. Quelle: GRW, S. ${seiten}.`, ...texte].join('\n'),
    }],
  };
}
