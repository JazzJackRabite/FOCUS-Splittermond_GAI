import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RestSection } from '../components/play/RestSection';
import { setzeAktivenKatalog } from '../regelwerk/bruecke';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';
import { Katalog } from '../regelwerk/katalog';

// Regeln aus dem GRW-Paket (Wirkungen, Ruhewirkungen, Minderungen); ohne Paket gibt es keine Boni nach Namen mehr
beforeAll(() => { const b = basisAusDateien(); setzeAktivenKatalog(new Katalog(b.manifest, [b.basis]), false); });
afterAll(() => setzeAktivenKatalog(null, false));


describe('RestSection Component (Streamlined Regeneration & Pausen)', () => {
  const defaultProps = {
    kon: 2,
    wil: 3,
    strengthsList: [],
    weaknessesList: [],
    masteries: {},
    moonSign: '',
    onVerschnaufpause: vi.fn(),
    onRuhephase: vi.fn(),
  };

  it('renders both compact action cards for Verschnaufpause and Ruhephase', () => {
    render(<RestSection {...defaultProps} />);

    expect(screen.getByText('Regeneration & Pausen')).toBeDefined();
    expect(screen.getByText('Verschnaufpause')).toBeDefined();
    expect(screen.getByText('Ruhephase')).toBeDefined();

    // Durations
    expect(screen.getByText('30 Minuten')).toBeDefined();
    expect(screen.getByText('6 Stunden')).toBeDefined();

    // 1-sentence effect descriptions
    expect(screen.getByText(/Heilt Betäubungsschaden & erschöpften Fokus/)).toBeDefined();
    expect(screen.getByText(/Heilt zusätzlich echten Schaden & verzehrten Fokus/)).toBeDefined();

    // Default calculated LP and FO previews on Ruhephase card: KON=2 -> 4 LP, WIL=3 -> 6 FO
    expect(screen.getByText('+4 LP · +6 FO')).toBeDefined();
  });

  it('opens the Verschnaufpause dialog and runs it with the rule defaults', () => {
    const onVerschnaufpause = vi.fn();
    render(<RestSection {...defaultProps} onVerschnaufpause={onVerschnaufpause} />);

    // „Verschnaufpause durchführen“ öffnet den Dialog mit den Optionen; dort wird die Pause ausgelöst
    fireEvent.click(screen.getByRole('button', { name: /Verschnaufpause durchführen/i }));
    expect(onVerschnaufpause).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Durchführen' }));

    expect(onVerschnaufpause).toHaveBeenCalledTimes(1);
    expect(onVerschnaufpause).toHaveBeenCalledWith({
      healAllStun: true,
      stunAmount: undefined,
      healAllExhaustedFocus: true,
      exhaustedFocusAmount: undefined,
      exhaustReduction: 1,
      removeConditions: true,
    }, false);
  });

  it('opens the Ruhephase dialog and runs it with the calculated defaults', () => {
    const onRuhephase = vi.fn();
    render(<RestSection {...defaultProps} kon={3} wil={2} onRuhephase={onRuhephase} />);

    // KON 3 * 2 = 6 LP, WIL 2 * 2 = 4 FO
    fireEvent.click(screen.getByRole('button', { name: /Ruhephase durchführen/i }));
    expect(onRuhephase).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Durchführen' }));

    expect(onRuhephase).toHaveBeenCalledTimes(1);
    expect(onRuhephase).toHaveBeenCalledWith(6, 4, false); // ohne Begleiter kein „Begleiter rasten mit“
  });

  it('has no separate "Optionen anpassen" buttons; the dialog holds the options and can be cancelled', () => {
    const onVerschnaufpause = vi.fn();
    render(<RestSection {...defaultProps} onVerschnaufpause={onVerschnaufpause} />);
    expect(screen.queryByRole('button', { name: /Optionen anpassen/i })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Verschnaufpause durchführen/i }));
    expect(screen.getByRole('dialog', { name: 'Verschnaufpause durchführen' })).toBeDefined();
    expect(screen.getByText(/GRW S\. 173–174/)).toBeDefined();  // Fundstelle der Heilungsregeln aus dem Paket
    expect(screen.getByText(/Kanalisierte Zauber bleiben bestehen/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onVerschnaufpause).not.toHaveBeenCalled();
  });

  it('Ruhephase dialog: adjusted values are used, reset restores them, reopening starts from the rule values', () => {
    const onRuhephase = vi.fn();
    render(<RestSection {...defaultProps} kon={2} wil={3} onRuhephase={onRuhephase} />);

    fireEvent.click(screen.getByRole('button', { name: /Ruhephase durchführen/i }));
    expect(screen.queryByText('Standardwerte wiederherstellen')).toBeNull();

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Standardwerte wiederherstellen/i }));
    expect((inputs[0] as HTMLInputElement).value).toBe('4');

    fireEvent.change(inputs[0], { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Durchführen' }));
    expect(onRuhephase).toHaveBeenCalledWith(9, 6, false);

    fireEvent.click(screen.getByRole('button', { name: /Ruhephase durchführen/i }));
    expect((screen.getAllByRole('spinbutton')[0] as HTMLInputElement).value).toBe('4');
  });

  it('respects traits like Segen der Mondkraft, Erhöhte Lebensregeneration, and Schnell wieder auf den Beinen', () => {
    render(
      <RestSection
        {...defaultProps}
        kon={2}
        wil={3}
        moonSign="Segen der Mondkraft"
        strengthsList={[{ name: 'Erhöhte Lebensregeneration', level: 1, source: 'GRW' }]}
        masteries={{
          Zähigkeit: [{ id: 'm1', name: 'Schnell wieder auf den Beinen', tier: 1, cost: 0, isFree: true, isCreationBonus: false, source: 'GRW' }],
        }}
      />
    );

    // Dauer aus den Pausenregeln des Pakets; Segen der Mondkraft halbiert nur beim Einsatz der Gabe für einen Splitterpunkt (GRW S. 81, 83)
    expect(screen.getByText('30 Minuten')).toBeDefined();
    expect(screen.getByText('6 Stunden')).toBeDefined();

    // LP Calculation: KON (2) * 3 (Erhöhte Lebensregeneration) + 1 (Schnell wieder auf den Beinen) = 7 LP
    // FO Calculation: WIL (3) * 2 = 6 FO
    expect(screen.getByText('+7 LP · +6 FO')).toBeDefined();
  });
});
