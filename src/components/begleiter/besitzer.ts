/**
 * Angaben des Abenteurers, die Begleiter brauchen: Ressourcen (Kreatur, Gefolge, Golem), Meisterschaften und Zauber.
 * Gemeinsam für das Blatt eines Begleiters und den Assistenten zum Erstellen und Bearbeiten.
 */
import { useMemo } from 'react';
import { useCharacter } from '../../context/CharacterContext';
import { bedingungsCharakter, idNachName, meisterschaftId } from '../../regelwerk/bruecke';
import type { BedingungsCharakter } from '../../regelwerk/bedingungen';
import { nekromantenMeisterschaften } from '../../regelwerk/untote';
import { heldengrade } from '../../regelwerk/steigerungsregeln';
import { gefolgeWerte } from '../../regelwerk/gefolge';
import { golemWerte } from '../../regelwerk/golem';
import type { Verstoss } from '../../fundament/hausregeln';
import type { Katalog } from '../../regelwerk/katalog';
import type { Begleiter, CharacterState } from '../../types';

export interface Besitzer {
  /** Tierführer: Bedingungs-Charakter für Voraussetzungen, Meisterschafts-IDs, Heldengrad */
  char: BedingungsCharakter; msIds: string[]; heldengrad: number;
  /** Ressourcen Kreatur (absteigend), Stärke Tiervertrauter */
  kreatur: number[]; tiervertrauter: boolean;
  /** Ressource Gefolge (Summe) und höchster Fertigkeitswert nach Heldengrad */
  gefolgePunkte: number; maxFertigkeit: number;
  /** Nekromant: Meisterschaften für mehrfache Verstärkung und Abnormitäten, bekannte Zauber */
  nekromant: boolean; meisterDerAbnormitaeten: boolean; mehrfachMit: string; zauber: string[];
  /** Golems: Ressourcen Golem, Meisterschaft Konstrukteur */
  golemPunkte: number[]; konstrukteur: boolean;
}

export function useBesitzer(k: Katalog): Besitzer {
  const { state, calc } = useCharacter();
  return useMemo(() => besitzerBerechnen(k, state, calc),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [k, state.masteries, state.skillsBase, state.resourcesList, state.spellsList, state.strengthsList, state.race, calc]);
}

type BesitzerStand = Pick<CharacterState, 'masteries' | 'skillsBase' | 'resourcesList' | 'spellsList' | 'strengthsList' | 'race'>;
type BesitzerRechnung = { getSkillValue?: (s: string) => number; heldengrad?: { nr?: number; maxSkill?: number } } | null | undefined;

/** Angaben des Tierführers ohne React (z. B. für den PDF-Export) */
export function besitzerBerechnen(k: Katalog, state: BesitzerStand, calc: BesitzerRechnung): Besitzer {
  {
    const ms = Object.entries(state.masteries ?? {}).flatMap(([skill, l]) => l.map(m => ({ ...m, skill: m.skill || skill })));
    const fertigkeiten: Record<string, number> = {};
    for (const s of Object.keys(state.skillsBase ?? {})) fertigkeiten[s] = calc?.getSkillValue ? calc.getSkillValue(s) : (state.skillsBase[s] ?? 0);
    const char = bedingungsCharakter(k, {
      meisterschaften: ms, fertigkeiten, ressourcen: state.resourcesList, zauber: state.spellsList, staerken: state.strengthsList, rasse: state.race,
    });
    const msIds = ms.map(m => meisterschaftId(k, m.name, m.skill, (m as { regelId?: string }).regelId)).filter((x): x is string => !!x);
    const hg = calc?.heldengrad?.nr ?? 1;
    // Ressourcen und Stärken nach Katalog-ID (Endung der ID, gleich in welchem Band), nicht nach Namen
    const ressourcenIds = state.resourcesList.map(r => ({ id: idNachName(k, 'ressource', r.name) ?? '', stufe: Number(r.level) || 0 }));
    const ressource = (endung: string) => ressourcenIds.filter(r => r.id.endsWith(`:ressource:${endung}`)).map(r => r.stufe);
    const staerkenIds = state.strengthsList.map(s => idNachName(k, 'staerke', s.name) ?? '');
    const nekro = nekromantenMeisterschaften(k, state.masteries);
    return {
      char, msIds, heldengrad: Math.max(1, hg),
      kreatur: ressource('kreatur').sort((a, b) => b - a),
      tiervertrauter: staerkenIds.some(i => i.endsWith(':staerke:tiervertrauter')),
      gefolgePunkte: ressource('gefolge').reduce((s, n) => s + n, 0),
      maxFertigkeit: Number((calc as { heldengrad?: { maxSkill?: number } } | undefined)?.heldengrad?.maxSkill) || (heldengrade(k)?.[0]?.maxSkill ?? 0),
      ...nekro,
      zauber: (state.spellsList ?? []).map(s => s.name),
      golemPunkte: ressource('golem'),
      konstrukteur: msIds.some(i => i.endsWith(':konstrukteur')),
    };
  }
}

/** Passen die Kreatur-Punkte der Tiere zu den Ressourcen? (jede Ressource Kreatur trägt ein Tier) */
export function kreaturZuordnung(ressourcen: number[], tiere: number[]): boolean {
  const r = [...ressourcen].sort((a, b) => b - a); const t = tiere.filter(x => x > 0).sort((a, b) => b - a);
  return t.length <= r.length && t.every((x, i) => x <= r[i]);
}

/**
 * Ressource Golem (Die Magie S. 203: Punkte der Ressource gegen die Stufe des Merkmals Golem):
 * Jeder Golem „über Ressource Golem“ belegt eine eigene Ressource. Auslegung: Die Stufe des Golems darf höchstens so hoch
 * sein wie die Punkte der Ressource (wie bei Kreatur). Größte Golems an die größten Ressourcen.
 * `b`/`index`: der gerade bearbeitete Golem (ersetzt den Eintrag an `index` bzw. kommt neu hinzu).
 */
export function golemRessourcenBelegung(k: Katalog, besitzer: Besitzer, alle: Begleiter[], b?: Begleiter, index?: number): { stufe: number; ressource: number | null; eigener: boolean }[] {
  const liste = alle.map((x, i) => ({ x: i === index && b ? b : x, eigener: i === index })).filter(v => v.x.art === 'golem');
  if (b && b.art === 'golem' && (index === undefined || index >= alle.length)) liste.push({ x: b, eigener: true });
  const golems = liste.filter(v => v.x.golemRessource && v.x.id).map(v => ({ stufe: golemWerte(k, v.x).stufe, eigener: v.eigener }));
  golems.sort((a, c) => c.stufe - a.stufe);
  const res = [...besitzer.golemPunkte].sort((a, c) => c - a);
  return golems.map((g, i) => ({ ...g, ressource: res[i] ?? null }));
}

/** Verstoß gegen die Ressource Golem (für aenderungGesperrt): Ausmaß = fehlende Punkte über alle Golems */
export function golemRessourceVerstoesse(k: Katalog, besitzer: Besitzer, alle: Begleiter[], b: Begleiter, index?: number): Verstoss[] {
  const fehlt = golemRessourcenBelegung(k, besitzer, alle, b, index).reduce((s, g) => s + Math.max(0, g.stufe - (g.ressource ?? 0)), 0);
  return fehlt > 0 ? [{ schluessel: 'ressource:golem', mass: fehlt, text: 'Dafür reicht die Ressource Golem nicht: Jeder Golem braucht eine eigene Ressource Golem mindestens in seiner Stufe (Auslegung, Die Magie S. 203).' }] : [];
}

/** Gefolge-Punkte, die die übrigen Gefolgsleute verbrauchen (ohne den Begleiter an Stelle `ohne`) */
export function gefolgeVerbraucht(k: Katalog, alle: Begleiter[], maxFertigkeit: number, ohne?: number): number {
  return alle.reduce((s, b, i) => (b.art === 'gefolge' && i !== ohne ? s + gefolgeWerte(k, b, maxFertigkeit).punkte : s), 0);
}

/** Freie Ressource Kreatur, die für ein Tier der Stufe `st` reicht (kleinste passende) */
export function freieKreatur(besitzer: Besitzer, alle: Begleiter[], st: number | null, ohne?: number): number | undefined {
  const belegt = [...besitzer.kreatur];
  alle.forEach((b, i) => { if (b.art !== 'tier' || i === ohne) return; const j = belegt.indexOf(b.kreatur ?? -1); if (j >= 0) belegt.splice(j, 1); });
  return st !== null ? belegt.filter(x => x >= st).sort((a, b) => a - b)[0] : undefined;
}
