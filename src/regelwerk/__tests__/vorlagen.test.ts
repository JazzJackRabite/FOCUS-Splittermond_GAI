/**
 * Beispielcharaktere (data/presets.ts): Jede genannte Stärke, Schwäche, Ressource, Meisterschaft und jeder Zauber
 * hat eine ID im GRW-Paket; beim Laden einer Vorlage schreibt der Editor diese IDs mit (mitRegelIds).
 */
import { describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { regelIdsErmitteln } from '../ids';
import { CHARACTER_PRESETS } from '../../data/presets';
import { grwMondzeichen, grwRassen } from '../grwListen';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);

describe('Beispielcharaktere nennen nur Einträge des GRW-Pakets', () => {
  it.each(CHARACTER_PRESETS.map((p) => [p.name, p] as const))('%s', (_n, p) => {
    const c = p.fullState;
    const ids = regelIdsErmitteln(K, c);
    const fehlt: string[] = [];
    for (const [liste, feld] of [['strengthsList', 'staerken'], ['weaknessesList', 'schwaechen'], ['resourcesList', 'ressourcen']] as const) {
      for (const e of c[liste] ?? []) {
        const name = e.name.replace(/\s*\(.*\)\s*$/, '');
        if (!ids[feld][e.name] && !regelIdsErmitteln(K, { ...c, [liste]: [{ ...e, name }] })[feld][name]) fehlt.push(`${feld}: ${e.name}`);
      }
    }
    for (const [skill, l] of Object.entries(c.masteries ?? {})) for (const m of l) if (!ids.meisterschaften[`${skill}|${m.name}`]) fehlt.push(`Meisterschaft: ${skill}|${m.name}`);
    for (const s of c.spellsList ?? []) if (!ids.zauber[`${s.school}|${s.name}`]) fehlt.push(`Zauber: ${s.school}|${s.name}`);
    expect(fehlt).toEqual([]);
    expect(ids.rasse).toBeTruthy();
    expect(Object.keys(grwRassen(K))).toContain(c.race);
    expect(grwMondzeichen(K)).toContain(c.moonSign);
  });
});

describe('Protokoll der Vorlagen', () => {
  it('nennt die Quelle aus dem Paket, nicht „unbekannt“ (Vorlage wird erst beim Zugriff aufgelöst)', () => {
    for (const p of CHARACTER_PRESETS) {
      const unbekannt = (p.fullState.advancementLog ?? []).filter((e) => /Quelle: unbekannt/.test(e.detail ?? ''));
      expect(unbekannt.map((e) => `${p.name}: ${e.title}`)).toEqual([]);
    }
  });
});
