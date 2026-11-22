/**
 * Zauber-Verstärkungen aus dem Paket (erfolgsgrade_strukturiert): EG, Kosten und verursachte Zustände mit Beleg.
 * Der Editor liest diese Felder; nur eigene Zauber ohne Paketeintrag werden aus ihrem Text gelesen.
 */
import { describe, expect, it } from 'vitest';
import { verstaerkungsZustandText, zauberErfolgsgrade } from '../zauberEg';
import { INITIAL_EG_ALLOCATIONS, getSelectedSpecificEnhancementEffects, parseSpellPermissibleModifications } from '../../utils/magicRules';

describe('Verstärkungen aus dem Paket', () => {
  it('Blitzschlag: 1 EG, +2V2, Benommen 1 für 30 Ticks (GRW S. 225)', () => {
    const d = zauberErfolgsgrade('Blitzschlag')!;
    expect(d.optionen).toContain('Verstärken');
    expect(d.verstaerkungen[0]).toMatchObject({ eg: 1, kosten: '+2V2', zustaende: [{ name: 'Benommen', stufe: 1, ticks: 30 }] });
    expect(d.verstaerkungen[0].wirkung).toContain(d.verstaerkungen[0].zustaende![0].beleg!);
  });

  it('Stoß: Liegend nur bei misslungener Probe; Todesfluch: Sterbend 2', () => {
    expect(verstaerkungsZustandText(zauberErfolgsgrade('Stoß')!.verstaerkungen[0].zustaende![0])).toBe('Liegend (bei misslungener Probe)');
    expect(zauberErfolgsgrade('Todesfluch')!.verstaerkungen[0].zustaende).toMatchObject([{ name: 'Sterbend', stufe: 2 }]);
  });

  it('kein Zustand, wenn er nur unterdrückt oder ausgesetzt wird', () => {
    expect(zauberErfolgsgrade('Geh noch nicht')!.verstaerkungen.every((v) => !v.zustaende)).toBe(true);
  });

  it('Editor: Optionen und Effekte aus dem Paket, auch wenn der gespeicherte Text fehlt', () => {
    const m = parseSpellPermissibleModifications('', 'Blitzschlag');
    expect(m.allowsDamage).toBe(true);
    expect(m.specificEnhancements[0]).toMatchObject({ id: 'enh-1', egCost: 1, focusCostRaw: '+2V2' });
    const eff = getSelectedSpecificEnhancementEffects('Blitzschlag', { ...INITIAL_EG_ALLOCATIONS, selectedEnhancementIds: ['enh-1'] }, m.specificEnhancements);
    expect(eff[0].addedCondition).toBe('Benommen 1 (30 Ticks)');
  });

  it('eigener Zauber ohne Paketeintrag: aus dem Text, ohne Zustandssuche', () => {
    const m = parseSpellPermissibleModifications('Wirkung.\n\nErfolgsgrade:\n• Schaden, Verstärken • 1 EG (Kosten +1V1): Das Ziel erhält den Zustand Benommen 1.', 'Mein Eigenbau');
    expect(m.specificEnhancements[0].zustaende).toBeUndefined();
    expect(m.allowsDamage).toBe(true);
  });
});
