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

  it('triggers onVerschnaufpause directly with default parameters on button click', () => {
    const onVerschnaufpause = vi.fn();
    render(<RestSection {...defaultProps} onVerschnaufpause={onVerschnaufpause} />);

    const vpBtn = screen.getByRole('button', { name: /Verschnaufpause durchführen/i });
    fireEvent.click(vpBtn);

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

  it('triggers onRuhephase directly with calculated defaults on button click', () => {
    const onRuhephase = vi.fn();
    render(<RestSection {...defaultProps} kon={3} wil={2} onRuhephase={onRuhephase} />);

    // KON 3 * 2 = 6 LP, WIL 2 * 2 = 4 FO
    const ruheBtn = screen.getByRole('button', { name: /Ruhephase durchführen/i });
    fireEvent.click(ruheBtn);

    expect(onRuhephase).toHaveBeenCalledTimes(1);
    expect(onRuhephase).toHaveBeenCalledWith(6, 4, false); // ohne Begleiter kein „Begleiter rasten mit“
  });

  it('opens options modal when "Optionen anpassen" is clicked and allows custom adjustment', () => {
    render(<RestSection {...defaultProps} />);

    // Initially no modal is open
    expect(screen.queryByText('Optionen: Verschnaufpause')).toBeNull();

    // Click "Optionen anpassen" on Verschnaufpause card
    const optionsButtons = screen.getAllByRole('button', { name: /Optionen anpassen/i });
    fireEvent.click(optionsButtons[0]);

    // Modal is now visible
    expect(screen.getByText('Optionen: Verschnaufpause')).toBeDefined();
    expect(screen.getByText(/GRW S\. 173–174/)).toBeDefined();  // Fundstelle der Heilungsregeln aus dem Paket

    // Close button
    const closeBtn = screen.getByRole('button', { name: /Übernehmen & Schließen/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Optionen: Verschnaufpause')).toBeNull();
  });

  it('shows "Standardwerte wiederherstellen" when Ruhephase options are modified and resets values', () => {
    render(<RestSection {...defaultProps} kon={2} wil={3} />);

    // Initially standard is active (+4 LP / +6 FO) -> reset button should not exist
    expect(screen.queryByText('Standardwerte wiederherstellen')).toBeNull();

    // Open Ruhephase options modal
    const optionsButtons = screen.getAllByRole('button', { name: /Optionen anpassen/i });
    fireEvent.click(optionsButtons[1]); // Ruhephase

    expect(screen.getByText('Optionen: Ruhephase')).toBeDefined();

    // Find the input for LP
    const inputs = screen.getAllByRole('spinbutton');
    // First input in Ruhephase modal is LP, second is FO
    fireEvent.change(inputs[0], { target: { value: '10' } });

    // "Standardwerte wiederherstellen" must now appear!
    const resetButtons = screen.getAllByRole('button', { name: /Standardwerte wiederherstellen/i });
    expect(resetButtons.length).toBeGreaterThan(0);

    // Click reset
    fireEvent.click(resetButtons[0]);

    // Value resets to calculated default 4
    expect((inputs[0] as HTMLInputElement).value).toBe('4');
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
