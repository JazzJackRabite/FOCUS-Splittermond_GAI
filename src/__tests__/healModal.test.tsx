import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HealModal } from '../components/play/HealModal';
import type { HealthSlot, StatusCondition } from '../types';
import { setzeHausregeln } from '../fundament/hausregeln';

describe('HealModal (GRW S. 165-167)', () => {
  const sampleSlots: HealthSlot[] = [
    { type: 'consumed' },
    { type: 'consumed' },
    { type: 'consumed' },
    { type: 'exhausted' },
    { type: 'exhausted' },
    { type: 'empty' },
    { type: 'empty' },
    { type: 'empty' },
  ];

  const sampleConditions: StatusCondition[] = [
    { id: 'cond-1', key: 'Blutend', level: 1 },
    { id: 'cond-2', key: 'Benommen', level: 1 },
  ];

  it('renders modal with damage overview, healing methods, priority options, and conditions', () => {
    const onApplyHeal = vi.fn();
    const onClose = vi.fn();

    render(
      <HealModal
        onClose={onClose}
        maxLP={8}
        currentHealthSlots={sampleSlots}
        activeConditions={sampleConditions}
        onApplyHeal={onApplyHeal}
      />
    );

    expect(screen.getByRole('heading', { name: /Heilung anwenden/i })).toBeDefined();
    expect(screen.getByText(/1. Heilmethode/i)).toBeDefined();
    expect(screen.getByText(/2. Zu heilende Schadenspunkte/i)).toBeDefined();
    expect(screen.getByText(/3. Zu heilende Schadensart/i)).toBeDefined();
    expect(screen.getByText(/4. Zustände beenden/i)).toBeDefined();
    expect(screen.getByText(/Wundstufen-Verbesserung/i)).toBeDefined();
  });

  it('calculates consumed and exhausted healing correctly with consumed_first priority', () => {
    const onApplyHeal = vi.fn();
    const onClose = vi.fn();

    render(
      <HealModal
        onClose={onClose}
        maxLP={8}
        currentHealthSlots={sampleSlots}
        activeConditions={sampleConditions}
        onApplyHeal={onApplyHeal}
      />
    );

    // Initial amount is 3. With consumed_first and 3 consumed available:
    // It heals 3 consumed, 0 exhausted
    const applyButton = screen.getByRole('button', { name: /3 LP heilen/i });
    expect(applyButton).toBeDefined();

    fireEvent.click(applyButton);

    expect(onApplyHeal).toHaveBeenCalledWith(
      expect.objectContaining({
        consumedHealed: 3,
        exhaustedHealed: 0,
        channeledHealed: 0,
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('Heilkunde wählt keine Zustände vor; gewählte Zustände werden beendet', () => {
    const onApplyHeal = vi.fn();
    render(
      <HealModal onClose={vi.fn()} maxLP={8} currentHealthSlots={sampleSlots} activeConditions={sampleConditions} onApplyHeal={onApplyHeal} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Heilkunde/i }));
    const blutend = screen.getByLabelText(/Blutend/i) as HTMLInputElement;
    expect(blutend.checked).toBe(false);
    fireEvent.click(blutend);
    fireEvent.click(screen.getByRole('button', { name: /heilen/i }));
    expect(onApplyHeal).toHaveBeenCalledWith(expect.objectContaining({ conditionsToRemove: ['cond-1'], healMethod: 'Heilkunde' }));
  });

  it('ohne Hausregeln: nur echter Schaden, keine Verschnaufpause im Dialog, Freie Heilung gesperrt', () => {
    const onApplyHeal = vi.fn();
    render(<HealModal onClose={vi.fn()} maxLP={8} currentHealthSlots={sampleSlots} activeConditions={[]} onApplyHeal={onApplyHeal} />);
    expect(screen.queryByRole('button', { name: /Verschnaufpause/i })).toBeNull();
    expect(screen.getByTestId('heil-regel').textContent).toContain('Rast');
    expect((screen.getByRole('button', { name: /Freie Heilung/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Betäubung zuerst/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Heilmagie/i }));
    fireEvent.click(screen.getByRole('button', { name: /3 LP heilen/i }));
    expect(onApplyHeal).toHaveBeenCalledWith(expect.objectContaining({ consumedHealed: 3, exhaustedHealed: 0, channeledHealed: 0, healMethod: 'Heilmagie' }));
  });

  it('mit Hausregeln: Verteilung auf Betäubung und Freie Heilung wählbar', () => {
    setzeHausregeln(true);
    try {
      const onApplyHeal = vi.fn();
      render(<HealModal onClose={vi.fn()} maxLP={8} currentHealthSlots={sampleSlots} activeConditions={[]} onApplyHeal={onApplyHeal} />);
      expect((screen.getByRole('button', { name: /Freie Heilung/i }) as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(screen.getByRole('button', { name: /Betäubung zuerst/i }));
      fireEvent.click(screen.getByRole('button', { name: /3 LP heilen/i }));
      expect(onApplyHeal).toHaveBeenCalledWith(expect.objectContaining({ consumedHealed: 1, exhaustedHealed: 2 }));
    } finally { setzeHausregeln(false); }
  });

  it('kanalisierter Schaden heilt nicht, wird aber nach Aufheben seines Zustands zu Betäubung (GRW S. 15, 173)', () => {
    const onApplyHeal = vi.fn();
    const slots: HealthSlot[] = [{ type: 'consumed' }, { type: 'channeled' }, { type: 'channeled' }, { type: 'empty' }];
    render(<HealModal onClose={vi.fn()} maxLP={4} currentHealthSlots={slots} activeConditions={[]} onApplyHeal={onApplyHeal} />);
    fireEvent.click(screen.getByRole('button', { name: 'ein Punkt mehr freigeben' }));
    fireEvent.click(screen.getByRole('button', { name: 'ein Punkt mehr freigeben' }));
    expect(screen.getByTestId('kanalisiert-freigeben-wert').textContent).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: /1 LP heilen/i }));
    expect(onApplyHeal).toHaveBeenCalledWith(expect.objectContaining({ consumedHealed: 1, channeledHealed: 0, kanalisiertFreigegeben: 2 }));
  });
});
