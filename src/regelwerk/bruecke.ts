/**
 * Brücke zwischen dem bisherigen Editor (Namen, Kürzel wie STA) und dem Regel-Katalog (IDs).
 * - Der RegelwerkProvider setzt den aktiven Katalog; ohne Katalog rechnet der Editor wie bisher.
 * - grimoireModule(): hochgeladene Grimoires als Module im bisherigen Format (Zauber, Meisterschaften, Stärken, Schwächen, Ressourcen).
 * - abgeleiteteFuerCharakter(): abgeleitete Werte nach den Formeln des Grundregelwerks (daten.strukturiert).
 * - voraussetzungAusKatalog(): Voraussetzungen einer Meisterschaft über erfuellt().
 */
import type { Katalog } from './katalog';
import { regelIdsErmitteln } from './ids';
import { fertigkeitsBoni, werteBoni, wirkungenDesCharakters, type CharakterWirkung, type FertigkeitsBonus } from './wirkungen';
import type { Eintrag, Ergebnis } from './typen';
import { erfuellt, type BedingungsCharakter } from './bedingungen';
import { abgeleiteteWerte } from './abgeleitet';
import type { CharacterState, Mastery } from '../types';
import type { RulebookModulePackage, RulebookMastery, RulebookSpell, RulebookStrength } from '../types/rulebookSchema';

let aktiv: Katalog | null = null;

/** benachrichtigen = false: nur setzen (z. B. während des Renderns), das Ereignis folgt separat */
export function setzeAktivenKatalog(k: Katalog | null, benachrichtigen = true): void {
  if (k !== aktiv) { aktiv = k; modulCache = null; }
  if (benachrichtigen && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('splittermond-resources-changed'));
}

export function aktiverKatalog(): Katalog | null {
  return aktiv;
}

// ---------------------------------------------------------------- Namen ↔ IDs
export const RASSE_ID: Record<string, string> = {
  Mensch: 'grw:rasse:menschen', Alb: 'grw:rasse:alben', Zwerg: 'grw:rasse:zwerge', Gnom: 'grw:rasse:gnome', Varg: 'grw:rasse:varge',
};
export const ATTRIBUT_NAME: Record<string, string> = {
  AUS: 'Ausstrahlung', BEW: 'Beweglichkeit', INT: 'Intuition', KON: 'Konstitution', MYS: 'Mystik', STA: 'Stärke', VER: 'Verstand', WIL: 'Willenskraft',
};

/** „Geschichte & Mythen“ = „Geschichte und Mythen“; Groß-/Kleinschreibung egal */
export const norm = (s: string | undefined | null) => (s ?? '').replace(/\s*&\s*/g, ' und ').replace(/\s+/g, ' ').trim().toLowerCase();
/** „Abdrängen (S1)“ → „Abdrängen“ */
export const ohneSchwelle = (s: string) => s.replace(/\s*\(S\d\)\s*$/i, '').trim();

interface Index {
  fertigkeit: Map<string, string>;
  fertigkeitName: Map<string, string>;
  meisterschaft: Map<string, string>;   // fertigkeit-ID|name
  meisterNurName: Map<string, string[]>;
  nachTypName: Map<string, string[]>;   // typ|name
}
const INDEX = new WeakMap<Katalog, Index>();

function index(k: Katalog): Index {
  let ix = INDEX.get(k);
  if (ix) return ix;
  ix = { fertigkeit: new Map(), fertigkeitName: new Map(), meisterschaft: new Map(), meisterNurName: new Map(), nachTypName: new Map() };
  for (const e of Object.values(k.eintraege)) {
    const n = norm(e.name);
    const key = `${e.typ}|${n}`;
    ix.nachTypName.set(key, [...(ix.nachTypName.get(key) ?? []), e.id]);
    if (e.typ === 'fertigkeit' || e.typ === 'meisterschaftsgruppe') { ix.fertigkeit.set(n, e.id); ix.fertigkeitName.set(e.id, e.name); }
    if (e.typ === 'meisterschaft') {
      ix.meisterschaft.set(`${e.daten.fertigkeit}|${n}`, e.id);
      ix.meisterNurName.set(n, [...(ix.meisterNurName.get(n) ?? []), e.id]);
    }
  }
  INDEX.set(k, ix);
  return ix;
}

export function fertigkeitId(k: Katalog, name: string): string | undefined {
  return index(k).fertigkeit.get(norm(name));
}

export function idNachName(k: Katalog, typ: string, name: string): string | undefined {
  const l = index(k).nachTypName.get(`${typ}|${norm(name)}`);
  return l && l.length ? l[0] : undefined;
}

/** Meisterschaft des Editors (Name mit „(S1)“, Fertigkeitsname) → Katalog-ID */
export function meisterschaftId(k: Katalog, name: string, fertigkeit?: string, regelId?: string): string | undefined {
  if (regelId && k.get(regelId)) return k.get(regelId)!.id;
  const ix = index(k); const n = norm(ohneSchwelle(name));
  const f = fertigkeit ? ix.fertigkeit.get(norm(fertigkeit)) : undefined;
  if (f && ix.meisterschaft.has(`${f}|${n}`)) return ix.meisterschaft.get(`${f}|${n}`);
  for (const g of ['grw:meisterschaftsgruppe:allgemeine-nahkampfmeisterschaften', 'grw:meisterschaftsgruppe:allgemeine-kampfmeisterschaften', 'grw:meisterschaftsgruppe:allgemeine-magiemeisterschaften']) {
    if (ix.meisterschaft.has(`${g}|${n}`)) return ix.meisterschaft.get(`${g}|${n}`);
  }
  const l = ix.meisterNurName.get(n);
  return l && l.length === 1 ? l[0] : undefined;
}

// ---------------------------------------------------------------- Grimoires als Module
let modulCache: RulebookModulePackage[] | null = null;

const zahl = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const seite = (e: Eintrag) => (e.quelle.buch_seiten ?? [])[0];

/** Alle geladenen Grimoires außer dem Grundregelwerk als Module im bisherigen Editor-Format. */
export function grimoireModule(): RulebookModulePackage[] {
  const k = aktiv;
  if (!k) return [];
  if (modulCache) return modulCache;
  const basis = k.manifest.basis_paket;
  const proPaket = new Map<string, Eintrag[]>();
  for (const e of Object.values(k.eintraege)) {
    if (e.quelle.paket === basis || e.aktion !== 'neu') continue;
    proPaket.set(e.quelle.paket, [...(proPaket.get(e.quelle.paket) ?? []), e]);
  }
  const ix = index(k);
  const out: RulebookModulePackage[] = [];
  for (const [pid, E] of proPaket) {
    const info = k.pakete[pid] ?? (k.manifest.bekannte_pakete ?? []).find(p => p.id === pid);
    const kurz = info?.kuerzel ?? pid;
    const spells: RulebookSpell[] = []; const masteries: (RulebookMastery & Record<string, unknown>)[] = [];
    const strengths: RulebookStrength[] = []; const weaknesses: { name: string; desc: string; page?: number; source?: string }[] = [];
    const gameResources: { name: string; desc: string; page?: number; source?: string }[] = [];
    for (const e of E) {
      const d = e.daten;
      if (e.typ === 'zauber') {
        const beschreibung = [d.wirkung, d.erfolgsgrade ? `Erfolgsgrade:\n${d.erfolgsgrade}` : ''].filter(Boolean).join('\n\n');
        for (const s of d.schulen ?? []) {
          if (s.grad === null || s.grad === undefined) continue;
          spells.push({ id: e.id, name: e.name, school: ix.fertigkeitName.get(s.id) ?? s.schule, grade: zahl(s.grad), cost: String(d.kosten ?? ''),
            castTime: d.zauberdauer, range: d.reichweite, duration: d.wirkungsdauer, target: (d.typus ?? []).join(', '),
            description: beschreibung, source: kurz, page: seite(e) });
        }
      } else if (e.typ === 'meisterschaft') {
        const schwelle = zahl(d.schwelle, 1);
        const fName = ix.fertigkeitName.get(d.fertigkeit) ?? d.fertigkeit_name ?? 'Allgemein';
        masteries.push({ id: e.id, name: `${e.name} (S${schwelle})`, skill: fName, level: schwelle, desc: d.beschreibung ?? '', page: seite(e), source: kurz,
          baseName: e.name, tier: schwelle, manoever: d.manoever === true, prerequisiteText: d.voraussetzungen?.text ?? null, regelId: e.id, ...(d.mehrfach_waehlbar ? { mehrfach: true } : {}) });
      } else if (e.typ === 'staerke') {
        strengths.push({ id: e.id, name: e.name, cost: zahl(d.stufe, 1), max: 1, multi: false, onlyCreation: d.nur_bei_generierung === true,
          desc: d.beschreibung ?? '', page: seite(e), source: kurz });
      } else if (e.typ === 'schwaeche') {
        weaknesses.push({ id: e.id, name: e.name, desc: d.beschreibung ?? '', page: seite(e), source: kurz } as never);
      } else if (e.typ === 'ressource') {
        gameResources.push({ id: e.id, name: e.name, desc: d.beschreibung ?? '', page: seite(e), source: kurz } as never);
      }
    }
    if (!spells.length && !masteries.length && !strengths.length && !weaknesses.length && !gameResources.length) continue;
    out.push({
      format: 'splittermond-module-v1', id: `regelpaket-${pid}`, name: info?.titel ?? pid, shortName: kurz, version: '1.0', system: 'splittermond',
      description: 'Aus dem hochgeladenen Regelpaket (Einstellungen → Regelpakete).', author: 'Regelpaket', isActive: true, canRemove: false,
      itemCounts: { spells: spells.length, masteries: masteries.length, strengths: strengths.length, weaknesses: weaknesses.length, resources: gameResources.length },
      resources: { spells, masteries, strengths, weaknesses, gameResources },
    } as RulebookModulePackage);
  }
  modulCache = out;
  return out;
}

// ---------------------------------------------------------------- Charakter → Bedingungs-Charakter
export function bedingungsCharakter(k: Katalog, opt: {
  meisterschaften: Array<Mastery | string>; fertigkeiten: Record<string, number>; ressourcen?: Array<{ name: string; level?: number }>;
  zauber?: Array<{ name: string; school?: string }>; staerken?: Array<{ name: string; level?: number }>; rasse?: string; meisterschaftsFertigkeit?: Record<string, string>;
  /** Fertigkeit der zu prüfenden Meisterschaft */
  fertigkeit?: string;
}): BedingungsCharakter {
  const hat = new Set<string>(); const werte: Record<string, number> = {}; const schwerpunkte: Array<[string, string]> = []; const zauber: string[] = [];
  const gelerntIn: Array<[string, string | undefined]> = [];
  for (const [n, w] of Object.entries(opt.fertigkeiten)) { const i = fertigkeitId(k, n); if (i) werte[i] = w; }
  for (const m of opt.meisterschaften) {
    const name = typeof m === 'string' ? m : m.name;
    const skill = typeof m === 'string' ? opt.meisterschaftsFertigkeit?.[m] : m.skill;
    const regelId = typeof m === 'string' ? undefined : (m as Mastery & { regelId?: string }).regelId;
    const i = meisterschaftId(k, name, skill, regelId);
    if (i) { hat.add(i); gelerntIn.push([i, skill ? fertigkeitId(k, skill) : undefined]); }
    if (typeof m !== 'string' && /schwerpunkt/i.test(name) && m.userNote) {
      const f = skill ? fertigkeitId(k, skill) : undefined;
      if (f) schwerpunkte.push([f, m.userNote.trim()]);
    }
  }
  for (const r of opt.ressourcen ?? []) { const i = idNachName(k, 'ressource', r.name); if (i) werte[i] = (werte[i] ?? 0) + (Number(r.level) || 1); }
  for (const s of opt.staerken ?? []) { const i = idNachName(k, 'staerke', s.name); if (i) hat.add(i); }
  for (const z of opt.zauber ?? []) { const i = idNachName(k, 'zauber', z.name); if (i) { zauber.push(i); hat.add(i); } }
  if (opt.rasse && RASSE_ID[opt.rasse]) hat.add(RASSE_ID[opt.rasse]);
  return { hat, werte, schwerpunkte, zauber, gelerntIn, ...(opt.fertigkeit ? { fertigkeit: fertigkeitId(k, opt.fertigkeit) } : {}) };
}

export interface VoraussetzungsErgebnis { id: string; ergebnis: Ergebnis; text: string }

/** Prüft die Voraussetzung einer Meisterschaft mit dem Katalog; null, wenn kein Katalog oder die Meisterschaft nicht darin steht. */
export function voraussetzungAusKatalog(name: string, fertigkeit: string, regelId: string | undefined, char: () => BedingungsCharakter): VoraussetzungsErgebnis | null {
  const k = aktiv;
  if (!k) return null;
  const id = meisterschaftId(k, name, fertigkeit, regelId);
  if (!id) return null;
  const v = k.get(id)!.daten.voraussetzungen;
  if (!v || typeof v !== 'object' || !('bedingung' in v)) return { id, ergebnis: true, text: '' };
  return { id, ergebnis: erfuellt(char(), v.bedingung, k), text: v.text ?? '' };
}

// ---------------------------------------------------------------- Abgeleitete Werte
export interface KatalogWerte {
  GSW: number; INI: number; LP: number; FO: number; VTD: number; GW: number; KW: number; SP: number;
  /** Schadensreduktion aus Stärken (z. B. Natürlicher Rüstungsschutz) */
  SR: number;
  /** LP- bzw. FO-Bonus aus Stärken (z. B. Robust, Erhöhter Fokuspool) */
  lpAusStaerken: number; foAusStaerken: number;
  hoechstbonus: number; hinweise: string[];
  bedingt: { wert: string; bonus: number; bedingung: string; quelle: string }[];
}

/** Abgeleitete Werte nach den Regeldaten. ausruestung: Summen der angelegten Rüstungen/Schilde (VTD-Bonus, Gesamt-Behinderung). */
export function abgeleiteteFuerCharakter(state: Pick<CharacterState, 'race' | 'strengthsList'>, attribute: Record<string, number>, heldengrad: number,
  ausruestung: { vtdBonus: number; behinderung: number }): KatalogWerte | null {
  const k = aktiv;
  const rasse = RASSE_ID[state.race];
  if (!k || !rasse || !k.get(rasse)) return null;
  const A: Record<string, number> = {};
  for (const [kurz, name] of Object.entries(ATTRIBUT_NAME)) A[name] = Number(attribute[kurz]) || 0;
  const staerken: string[] = [];
  for (const s of state.strengthsList ?? []) {
    const i = idNachName(k, 'staerke', s.name);
    if (!i) continue;
    const n = Math.max(1, Number(s.level) || 1);
    for (let j = 0; j < n; j++) staerken.push(i);
  }
  const hg = Math.min(4, Math.max(1, heldengrad));
  const mit = abgeleiteteWerte(k, A, rasse, staerken, hg);
  const ohne = abgeleiteteWerte(k, A, rasse, [], hg);
  const R = k.get('grw:regel:abgeleitete-werte-regeln:berechnung-der-abgeleiteten-werte')!.daten.strukturiert;
  const hinweise = [...mit.hinweise];
  let vtdAus = Math.max(0, ausruestung.vtdBonus);
  if (vtdAus > mit.hoechstbonus) { hinweise.push(`VTD-Bonus aus Ausrüstung ${vtdAus} auf Höchstbonus ${mit.hoechstbonus} begrenzt (GRW S. 18)`); vtdAus = mit.hoechstbonus; }
  const beh = Math.max(0, ausruestung.behinderung);
  if (beh && R.rundung?.art !== 'kaufmännisch') throw new Error('Rundungsregel unbekannt');
  const gswAbzug = beh ? Math.trunc(beh / 2 + 0.5) : 0;
  const w = mit.werte;
  return {
    GSW: Math.max(0, w.GSW - gswAbzug), INI: w.INI, LP: w.LP, FO: w.FO, VTD: w.VTD + vtdAus, GW: w.GW, KW: w.KW, SP: w.SP, SR: w.SR ?? 0,
    lpAusStaerken: w.LP - ohne.werte.LP, foAusStaerken: w.FO - ohne.werte.FO, hoechstbonus: mit.hoechstbonus, hinweise, bedingt: mit.bedingt,
  };
}

/** Großmeister ab so vielen Fertigkeitspunkten (grw:regel:fertigkeiten-regeln:meisterschaften-erhalten, GRW S. 92); ohne Katalog 15 */
export function grossmeisterAb(): number {
  const g = aktiv?.get('grw:regel:fertigkeiten-regeln:meisterschaften-erhalten')?.daten.strukturiert?.grossmeister;
  return Number(g?.ab_fertigkeitspunkten) || 15;
}

// ---------------------------------------------------------------- Wirkungen
export interface CharakterWirkungen { liste: CharakterWirkung[]; fertigkeitsBoni: Record<string, FertigkeitsBonus>; werteBoni: Record<string, FertigkeitsBonus> }

/** Wirkungen der Stärken und Meisterschaften des Charakters; null ohne Regelpakete */
export function wirkungenFuerCharakter(state: Pick<CharacterState, 'strengthsList' | 'masteries'>): CharakterWirkungen | null {
  const k = aktiv;
  if (!k) return null;
  const ids: string[] = [];
  for (const s of state.strengthsList ?? []) { const i = idNachName(k, 'staerke', s.name); if (i) ids.push(i); }
  const fertigkeitJeId: Record<string, string[]> = {};
  for (const [skill, liste] of Object.entries(state.masteries ?? {})) for (const m of liste) {
    const i = meisterschaftId(k, m.name, skill);
    if (i) { ids.push(i); (fertigkeitJeId[i] ??= []).push(skill); }
  }
  const liste = wirkungenDesCharakters(k, ids, fertigkeitJeId);
  return { liste, fertigkeitsBoni: fertigkeitsBoni(k, liste), werteBoni: werteBoni(liste) };
}

// ---------------------------------------------------------------- Regel-IDs beim Speichern
/** Zustand zum Speichern/Exportieren: mit geladenen Regelpaketen um regelIds ergänzt, sonst unverändert (alte regelIds bleiben) */
export function mitRegelIds<T extends Partial<CharacterState>>(state: T): T {
  const k = aktiv;
  if (!k || !state.race) return state;
  try {
    return { ...state, regelIds: regelIdsErmitteln(k, state as CharacterState) };
  } catch {
    return state;
  }
}

/** Katalog-Zauber als Zauber des Editors (für das Zauber-Modal), in der Magieschule schuleId oder der ersten */
export function zauberAlsSpell(k: Katalog, id: string, schuleId?: string): import('../types').Spell | null {
  const e = k.get(id); if (!e || e.typ !== 'zauber') return null;
  const d = e.daten; const ix = index(k);
  const s = (d.schulen ?? []).find((x: { id: string }) => x.id === schuleId) ?? d.schulen?.[0];
  return {
    name: e.name, school: ix.fertigkeitName.get(s?.id) ?? s?.schule ?? '', grade: zahl(s?.grad), cost: String(d.kosten ?? ''),
    castTime: d.zauberdauer, range: d.reichweite, duration: d.wirkungsdauer,
    description: [d.wirkung, d.erfolgsgrade ? `Erfolgsgrade:\n${d.erfolgsgrade}` : ''].filter(Boolean).join('\n\n'),
    source: k.pakete[e.quelle.paket]?.kuerzel ?? e.quelle.paket, page: seite(e),
  } as import('../types').Spell;
}
