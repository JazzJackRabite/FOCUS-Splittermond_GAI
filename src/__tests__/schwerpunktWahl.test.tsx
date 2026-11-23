/**
 * Schwerpunkt-Meisterschaften im Meisterschaftsdialog (GRW S. 92): Vorschläge aus dem Paket, Schwelle 1,
 * derselbe Schwerpunkt je Heldengrad einmal.
 */
import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Katalog } from '../regelwerk/katalog';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';
import { setzeAktivenKatalog } from '../regelwerk/bruecke';
import { schwerpunktAuswahl, schwerpunktHoechstensJeHeldengrad } from '../regelwerk/grwListen';
import { MasteryModal } from '../components/modals/MasteryModal';
import type { Mastery } from '../types';

describe('Schwerpunkt-Auswahl aus dem Paket', () => {
  const b = basisAusDateien(); const K = new Katalog(b.manifest, [b.basis]);
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => setzeAktivenKatalog(null, false));

  it('Fertigkeit: benannte Schwerpunkte und offene Angaben', () => {
    const a = schwerpunktAuswahl('Akrobatik')!;
    expect(a.schwelle).toBe(1);
    expect(a.vorschlaege).toContain('Balancieren');
    const w = schwerpunktAuswahl('Klingenwaffen')!;
    expect(w.vorschlaege).toEqual([]);
    expect(w.platzhalter.length).toBe(1);
  });

  it('Magieschule: Schwerpunkte nach Zauber-Typus der Schule', () => {
    const f = schwerpunktAuswahl('Feuermagie')!;
    expect(f.vorschlaege.length).toBeGreaterThan(1);
  });

  it('je Heldengrad einmal laut Regeldaten', () => {
    expect(schwerpunktHoechstensJeHeldengrad()).toBe(1);
  });

  const hinzufuegen = () => screen.getAllByRole('button').find((x) => /hinzufügen/i.test(x.textContent ?? '') && x.className.includes('bg-gold')) as HTMLButtonElement;
  const waehleSchwerpunkt = () => {
    const option = screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Schwerpunkt')) as HTMLOptionElement;
    fireEvent.change(option.closest('select')!, { target: { value: option.value } });
  };

  it('Dialog: Schwerpunkt wählen und als Meisterschaft „Schwerpunkt: X (S1)“ hinzufügen', () => {
    const onAdd = vi.fn();
    render(<MasteryModal skillName="Akrobatik" skillVal={9} currentFreeTiers={[]} onClose={() => {}} onAdd={onAdd}
      existingMasteries={[]} allCharacterMasteries={[]} skills={{ Akrobatik: 9 }} heldengrad={2} />);
    waehleSchwerpunkt();
    expect(hinzufuegen().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Balancieren' }));
    expect(hinzufuegen().disabled).toBe(false);
    fireEvent.click(hinzufuegen());
    expect(onAdd).toHaveBeenCalledWith('Schwerpunkt: Balancieren (S1)', 1, expect.any(Boolean), expect.any(Number), 92,
      expect.any(String), false, 'GRW', '');
  });

  it('Dialog: derselbe Schwerpunkt höchstens einmal je Heldengrad', () => {
    const vorhanden = (n: number): Mastery[] => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, name: 'Schwerpunkt: Balancieren (S1)', tier: 1, cost: 15,
      isFree: false, isCreationBonus: false, source: 'GRW', skill: 'Akrobatik' }));
    const { unmount } = render(<MasteryModal skillName="Akrobatik" skillVal={9} currentFreeTiers={[]} onClose={() => {}} onAdd={() => {}}
      existingMasteries={vorhanden(1)} allCharacterMasteries={[]} skills={{ Akrobatik: 9 }} heldengrad={2} />);
    waehleSchwerpunkt();
    fireEvent.click(screen.getByRole('button', { name: 'Balancieren' }));
    expect(hinzufuegen().disabled).toBe(false);
    unmount();
    render(<MasteryModal skillName="Akrobatik" skillVal={9} currentFreeTiers={[]} onClose={() => {}} onAdd={() => {}}
      existingMasteries={vorhanden(2)} allCharacterMasteries={[]} skills={{ Akrobatik: 9 }} heldengrad={2} />);
    waehleSchwerpunkt();
    fireEvent.click(screen.getByRole('button', { name: 'Balancieren' }));
    expect(screen.getByTestId('schwerpunkt-anzahl').textContent).toContain('höchstens 2×');
    expect(hinzufuegen().disabled).toBe(true);
  });
});
