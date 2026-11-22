/**
 * Charaktere zusätzlich mit Regel-IDs speichern.
 *
 * Der Editor speichert Stärken, Schwächen, Ressourcen, Meisterschaften und Zauber unter ihrem Namen. Ändert ein Regelpaket einen
 * Namen (z. B. Errata, Umbenennung im ID-Register), passt der gespeicherte Name nicht mehr. Deshalb steht beim Speichern unter
 * `regelIds` zu jedem Namen die ID aus den Regelpaketen. Beim Laden mit geladenen Paketen gilt:
 *   - Name wird gefunden → nichts zu tun.
 *   - Name wird nicht gefunden, aber die gespeicherte ID (auch über Umbenennungen und Regelgruppen) → Name auf den aktuellen setzen.
 *   - Beides nicht gefunden (z. B. Grimoire nicht geladen) → Eintrag bleibt unverändert, die ID bleibt gespeichert.
 * Ohne Regelpakete werden vorhandene `regelIds` unverändert weitergespeichert.
 */
import type { Katalog } from './katalog';
import { idNachName, meisterschaftId, ohneSchwelle, RASSE_ID } from './bruecke';
import type { CharacterState, ItemEntry, Mastery, Spell } from '../types';

export interface RegelIds {
  /** Formatversion */
  version: 1;
  /** geladene Pakete beim Speichern (Kennung → Anfang der SHA-256 der Paketdatei laut Manifest) */
  pakete: Record<string, string>;
  rasse?: string;
  staerken: Record<string, string>;
  schwaechen: Record<string, string>;
  ressourcen: Record<string, string>;
  /** Schlüssel „Fertigkeit|Name“ */
  meisterschaften: Record<string, string>;
  /** Schlüssel „Schule|Name“ */
  zauber: Record<string, string>;
}

type MitListen = Pick<CharacterState, 'race' | 'strengthsList' | 'weaknessesList' | 'resourcesList' | 'masteries' | 'spellsList'> & { regelIds?: RegelIds };

const LISTEN = [['strengthsList', 'staerken', 'staerke'], ['weaknessesList', 'schwaechen', 'schwaeche'], ['resourcesList', 'ressourcen', 'ressource']] as const;

/** IDs aller Einträge des Charakters; frühere IDs von Einträgen, die jetzt nicht auflösbar sind, bleiben erhalten */
export function regelIdsErmitteln(k: Katalog, c: MitListen): RegelIds {
  const alt = c.regelIds;
  const pakete: Record<string, string> = {};
  for (const [id, p] of Object.entries(k.pakete)) pakete[id] = (p.sha256 ?? '').slice(0, 12);
  const out: RegelIds = { version: 1, pakete, staerken: {}, schwaechen: {}, ressourcen: {}, meisterschaften: {}, zauber: {} };
  const r = RASSE_ID[c.race]; if (r && k.get(r)) out.rasse = r; else if (alt?.rasse) out.rasse = alt.rasse;
  for (const [liste, feld, typ] of LISTEN) {
    for (const e of (c[liste] ?? []) as ItemEntry[]) {
      const i = idNachName(k, typ, e.name) ?? alt?.[feld]?.[e.name];
      if (i) out[feld][e.name] = i;
    }
  }
  for (const [skill, l] of Object.entries(c.masteries ?? {})) for (const m of l) {
    const key = `${skill}|${m.name}`; const i = meisterschaftId(k, m.name, skill) ?? alt?.meisterschaften?.[key];
    if (i) out.meisterschaften[key] = i;
  }
  for (const s of c.spellsList ?? []) {
    const key = `${s.school}|${s.name}`; const i = idNachName(k, 'zauber', s.name) ?? alt?.zauber?.[key];
    if (i) out.zauber[key] = i;
  }
  return out;
}

export interface NamensAbgleich {
  /** geänderte Listen (nur wenn sich etwas geändert hat) */
  aenderung: Partial<Pick<CharacterState, 'strengthsList' | 'weaknessesList' | 'resourcesList' | 'masteries' | 'spellsList'>>;
  umbenannt: { alt: string; neu: string; id: string }[];
}

/** Namen, die im Katalog fehlen, über die gespeicherte ID auf den aktuellen Namen setzen */
export function namenAbgleichen(k: Katalog, c: MitListen): NamensAbgleich {
  const ids = c.regelIds;
  const umbenannt: NamensAbgleich['umbenannt'] = [];
  const aenderung: NamensAbgleich['aenderung'] = {};
  if (!ids) return { aenderung, umbenannt };
  const ziel = (id: string | undefined, typ: string) => { const e = id ? k.get(id) : undefined; return e && e.typ === typ ? e : undefined; };

  for (const [liste, feld, typ] of LISTEN) {
    let geaendert = false;
    const neu = ((c[liste] ?? []) as ItemEntry[]).map(e => {
      if (idNachName(k, typ, e.name)) return e;
      const z = ziel(ids[feld]?.[e.name], typ);
      if (!z || z.name === e.name) return e;
      geaendert = true; umbenannt.push({ alt: e.name, neu: z.name, id: z.id });
      return { ...e, name: z.name };
    });
    if (geaendert) (aenderung as Record<string, unknown>)[liste] = neu;
  }

  let mGeaendert = false;
  const masteries: Record<string, Mastery[]> = {};
  for (const [skill, l] of Object.entries(c.masteries ?? {})) {
    masteries[skill] = l.map(m => {
      if (meisterschaftId(k, m.name, skill)) return m;
      const z = ziel(ids.meisterschaften?.[`${skill}|${m.name}`], 'meisterschaft');
      if (!z) return m;
      const suffix = m.name.slice(ohneSchwelle(m.name).length);
      const name = z.name + suffix;
      if (name === m.name) return m;
      mGeaendert = true; umbenannt.push({ alt: m.name, neu: name, id: z.id });
      return { ...m, name };
    });
  }
  if (mGeaendert) aenderung.masteries = masteries;

  let sGeaendert = false;
  const spells: Spell[] = (c.spellsList ?? []).map(s => {
    if (idNachName(k, 'zauber', s.name)) return s;
    const z = ziel(ids.zauber?.[`${s.school}|${s.name}`], 'zauber');
    if (!z || z.name === s.name) return s;
    sGeaendert = true; umbenannt.push({ alt: s.name, neu: z.name, id: z.id });
    return { ...s, name: z.name };
  });
  if (sGeaendert) aenderung.spellsList = spells;

  return { aenderung, umbenannt };
}
