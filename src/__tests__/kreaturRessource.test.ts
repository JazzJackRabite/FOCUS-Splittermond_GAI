/** Tiergefährte über die Ressource Kreatur: das Tier darf höchstens die Stufe der Ressource haben (GRW S. 78) */
import { describe, expect, it } from 'vitest';
import { aktiverKatalog } from '../regelwerk/bruecke';
import { kreaturFehlt } from '../components/begleiter/ansicht';
import type { Begleiter } from '../types';

const tier = (id: string, kreatur?: number) => ({ id, art: 'tier', name: 'T', kreatur }) as unknown as Begleiter;

describe('Ressource Kreatur reicht?', () => {
  it('Wolf (Kreatur 4) mit Kreatur 2: fehlt Stufe 4; mit Kreatur 4 oder ohne Ressource: frei', () => {
    const k = aktiverKatalog()!;
    expect(kreaturFehlt(k, tier('grw:kreatur:wolf', 2))).toBe(4);
    expect(kreaturFehlt(k, tier('grw:kreatur:wolf', 4))).toBeNull();
    expect(kreaturFehlt(k, tier('grw:kreatur:wolf'))).toBeNull();
    expect(kreaturFehlt(k, tier('grw:kreatur:falke', 2))).toBeNull();
  });
});
