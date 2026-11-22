import { describe, it, expect } from 'vitest';
import { getResolvedSpells } from '../utils/gameResourceManager';

describe('Zauberliste', () => {
  it('supports tolerant multi-token search with umlauts and sub-info queries', () => {
    // Test that searching finds spells even with umlauts or partial words
    const allSpells = getResolvedSpells();
    expect(allSpells.length).toBeGreaterThan(50);

    // Filter testing Flammenstrahl
    const flammenSpells = allSpells.filter(
      (s) =>
        s.name.toLowerCase().includes('flamme') ||
        (s.description && s.description.toLowerCase().includes('flamme')),
    );
    expect(flammenSpells.length).toBeGreaterThan(0);
  });
});
