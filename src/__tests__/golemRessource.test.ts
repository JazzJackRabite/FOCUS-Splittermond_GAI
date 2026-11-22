/**
 * Ressource Golem: jeder Golem „über Ressource Golem“ belegt eine eigene Ressource, Stufe höchstens so hoch wie die
 * Ressource (Auslegung zu Die Magie S. 203, wie bei Kreatur). Die Golem-Stufe ist hier simuliert (ohne Grimoire).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../regelwerk/golem', () => ({ golemWerte: (_k: unknown, b: { stufe?: number }) => ({ stufe: b.stufe ?? 1, verstoesse: [] }) }));

import { golemRessourcenBelegung, golemRessourceVerstoesse, type Besitzer } from '../components/begleiter/besitzer';
import type { Begleiter } from '../types';

const k = {} as never;
const besitzer = (golemPunkte: number[]) => ({ golemPunkte }) as unknown as Besitzer;
const golem = (stufe: number, ressource = true) => ({ id: 'g', art: 'golem', name: 'G', golemRessource: ressource || undefined, stufe }) as unknown as Begleiter;

describe('Ressource Golem', () => {
  it('größte Golems an die größten Ressourcen; Golems ohne Ressource zählen nicht', () => {
    const b = golemRessourcenBelegung(k, besitzer([2, 4]), [golem(2), golem(3), golem(5, false)]);
    expect(b.map(x => [x.stufe, x.ressource])).toEqual([[3, 4], [2, 2]]);
  });

  it('kein Verstoß, solange jede Ressource reicht', () => {
    expect(golemRessourceVerstoesse(k, besitzer([3]), [], golem(3))).toEqual([]);
    expect(golemRessourceVerstoesse(k, besitzer([4]), [], golem(2))).toEqual([]);
  });

  it('zu hohe Stufe oder keine freie Ressource: Verstoß mit fehlenden Punkten', () => {
    expect(golemRessourceVerstoesse(k, besitzer([2]), [], golem(3))[0]).toMatchObject({ schluessel: 'ressource:golem', mass: 1 });
    expect(golemRessourceVerstoesse(k, besitzer([]), [], golem(2))[0].mass).toBe(2);
    // eine Ressource 3, schon von einem anderen Golem belegt: der neue (Stufe 2) bekommt keine
    expect(golemRessourceVerstoesse(k, besitzer([3]), [golem(3)], golem(2))[0].mass).toBe(2);
  });

  it('bearbeiteter Golem ersetzt seinen Eintrag; ohne Haken kein Verstoß', () => {
    expect(golemRessourceVerstoesse(k, besitzer([3]), [golem(3)], golem(3), 0)).toEqual([]);
    expect(golemRessourceVerstoesse(k, besitzer([]), [], golem(4, false))).toEqual([]);
  });
});
