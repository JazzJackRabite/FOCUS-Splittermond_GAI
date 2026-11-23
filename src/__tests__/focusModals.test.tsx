import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusCostModal } from '../components/play/FocusCostModal';
import { FocusRegenModal } from '../components/play/FocusRegenModal';
import { setzeAktivenKatalog } from '../regelwerk/bruecke';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';
import { Katalog } from '../regelwerk/katalog';
import { setzeHausregeln } from '../fundament/hausregeln';

beforeAll(() => { const b = basisAusDateien(); setzeAktivenKatalog(new Katalog(b.manifest, [b.basis]), false); });
afterAll(() => setzeAktivenKatalog(null, false));
afterEach(() => setzeHausregeln(false));

const leer = { exhausted: 0, channeled: 0, consumed: 0 };

describe('Fokuskosten (GRW S. 194–196, 198)', () => {
  it('Notation K4V1: 3 kanalisiert, 1 verzehrt, mit Namen für „Kanalisierte Zauber“', () => {
    const apply = vi.fn();
    render(<FocusCostModal onClose={vi.fn()} maxFO={12} focusAvailable={12} focus={leer} onApplyCost={apply} />);
    fireEvent.change(screen.getByTestId('fokuskosten-notation'), { target: { value: 'k4v1' } });
    expect(screen.getByTestId('fokuskosten-aufschluesselung').textContent).toContain('3 Kanalisiert');
    fireEvent.change(screen.getByPlaceholderText(/Flammende Waffe/), { target: { value: 'Flammende Waffe' } });
    fireEvent.click(screen.getByRole('button', { name: /4 Fokus buchen/ }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ exhausted: 0, channeled: 3, consumed: 1, channeledName: 'Flammende Waffe' }));
  });

  it('8V2: 6 erschöpft, 2 verzehrt; zu wenig Fokus sperrt ohne Hausregeln', () => {
    const apply = vi.fn();
    render(<FocusCostModal onClose={vi.fn()} maxFO={12} focusAvailable={5} focus={{ exhausted: 7, channeled: 0, consumed: 0 }} onApplyCost={apply} />);
    fireEvent.change(screen.getByTestId('fokuskosten-notation'), { target: { value: '8V2' } });
    expect(screen.getByTestId('fokuskosten-zu-wenig')).toBeDefined();
    expect((screen.getByRole('button', { name: /8 Fokus buchen/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('misslungener Zauber: erschöpft um negative EG, Differenz verzehrt erschöpfte Punkte', () => {
    const apply = vi.fn();
    render(<FocusCostModal onClose={vi.fn()} maxFO={10} focusAvailable={2} focus={{ exhausted: 8, channeled: 0, consumed: 0 }} onApplyCost={apply} />);
    fireEvent.click(screen.getByRole('button', { name: /Zauber misslungen/ }));
    fireEvent.change(screen.getByTestId('fokuskosten-neg-eg'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Fokus buchen/ }));
    // 2 frei → erschöpft; 3 fehlen → 3 erschöpfte Punkte werden verzehrt
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ exhausted: -1, channeled: 0, consumed: 3 }));
  });
});

describe('Fokus regenerieren (GRW S. 174, 196)', () => {
  const basis = { onClose: vi.fn(), maxFO: 12, wil: 3, strengthsList: [], masteries: {} };
  const zauber = [{ id: 'z1', name: 'Geisterdolch', channeledFocus: 1 }, { id: 'z2', name: 'Flammende Waffe', channeledFocus: 3 }];

  it('Verschnaufpause: aller erschöpfte Fokus, beendete Zauber werden mit regeneriert (Beispiel Selesha)', () => {
    const apply = vi.fn();
    render(<FocusRegenModal {...basis} focusAvailable={1} focus={{ exhausted: 3, channeled: 4, consumed: 3 }} channeledSpells={zauber} onApplyRegen={apply} />);
    fireEvent.click(screen.getByRole('button', { name: /Verschnaufpause/ }));
    fireEvent.click(screen.getByLabelText(/Geisterdolch/));
    fireEvent.click(screen.getByLabelText(/Flammende Waffe/));
    fireEvent.click(screen.getByRole('button', { name: /7 Fokus regenerieren/ }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ exhaustedRegenerated: 7, consumedRegenerated: 0 }));
    expect(apply.mock.calls[0][0].spellsToEnd).toHaveLength(2);
  });

  it('Ruhephase: Erschöpftes plus WIL × 2 verzehrte Punkte', () => {
    const apply = vi.fn();
    render(<FocusRegenModal {...basis} focusAvailable={2} focus={{ exhausted: 2, channeled: 0, consumed: 8 }} channeledSpells={[]} onApplyRegen={apply} />);
    fireEvent.click(screen.getByRole('button', { name: /Ruhephase/ }));
    fireEvent.click(screen.getByRole('button', { name: /8 Fokus regenerieren/ }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ exhaustedRegenerated: 2, consumedRegenerated: 6 }));
  });

  it('Freie Regeneration nur mit Hausregeln', () => {
    render(<FocusRegenModal {...basis} focusAvailable={2} focus={{ exhausted: 2, channeled: 0, consumed: 8 }} channeledSpells={[]} onApplyRegen={vi.fn()} />);
    expect((screen.getByRole('button', { name: /Freie Regeneration/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
