import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TakeDamageModal } from '../components/play/TakeDamageModal';
import type { HealthSlot } from '../types';

describe('TakeDamageModal (GRW S. 162-165 & S. 81)', () => {
  const dummySlots: HealthSlot[] = Array.from({ length: 40 }, () => ({ type: 'empty' }));

  it('renders modal with damage inputs, damage types, SR, Splitterpunkt, and conditions', () => {
    const onApplyDamage = vi.fn();
    const onClose = vi.fn();

    render(
      <TakeDamageModal
        onClose={onClose}
        maxLP={8}
        derivedSR={2}
        armorSR={2}
        currentSplitterPoints={3}
        activeTempHP={0}
        currentHealthSlots={dummySlots}
        onApplyDamage={onApplyDamage}
      />
    );

    expect(screen.getByRole('heading', { name: /Schaden erleiden/i })).toBeDefined();
    expect(screen.getByText(/1. Eingehender Schaden/i)).toBeDefined();
    expect(screen.getByText(/2. Schadenstyp/i)).toBeDefined();
    expect(screen.getByText(/3. Schadensreduktion/i)).toBeDefined();
    expect(screen.getByText(/4. Splitterpunkt: Schaden um 5 reduzieren/i)).toBeDefined();
    expect(screen.getByText(/5. Zustände durch den Treffer/i)).toBeDefined();
  });

  it('calculates damage after SR and allows applying Splitterpunkt to reduce damage by 5 (GRW S. 81)', () => {
    const onApplyDamage = vi.fn();
    const onClose = vi.fn();

    render(
      <TakeDamageModal
        onClose={onClose}
        maxLP={8}
        derivedSR={2}
        armorSR={2}
        currentSplitterPoints={3}
        activeTempHP={0}
        currentHealthSlots={dummySlots}
        onApplyDamage={onApplyDamage}
      />
    );

    // Initial raw damage is 5, SR is 2 -> Net damage = 3
    expect(screen.getByRole('button', { name: /3 echten Schaden anwenden/i })).toBeDefined();

    // Check Splitterpunkt: 3 SP -> reduces damage by 5 points: Math.max(0, 3 - 5) = 0
    const spCheckbox = screen.getByLabelText(/4. Splitterpunkt: Schaden um 5 reduzieren/i);
    fireEvent.click(spCheckbox);

    expect(screen.getByRole('button', { name: /0 echten Schaden anwenden/i })).toBeDefined();

    // Now let's increase incoming damage to 10 (+5 button) -> Raw 10, SR 2 = 8 -> minus 5 = 3
    fireEvent.click(screen.getByRole('button', { name: /\+5/i }));
    expect(screen.getByRole('button', { name: /3 echten Schaden anwenden/i })).toBeDefined();

    // Apply damage
    fireEvent.click(screen.getByRole('button', { name: /3 echten Schaden anwenden/i }));

    expect(onApplyDamage).toHaveBeenCalledWith({
      kind: 'consumed',
      amount: 3,
      spendSplitter: true,
      selectedConditions: [],
      note: undefined,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('allows selecting Betäubungsschaden and adding conditions (e.g. Blutend)', () => {
    const onApplyDamage = vi.fn();
    const onClose = vi.fn();

    render(
      <TakeDamageModal
        onClose={onClose}
        maxLP={8}
        derivedSR={0}
        armorSR={0}
        currentSplitterPoints={2}
        activeTempHP={0}
        currentHealthSlots={dummySlots}
        onApplyDamage={onApplyDamage}
      />
    );

    // Select Betäubung
    fireEvent.click(screen.getByRole('button', { name: /Betäubung/i }));

    // Zustand Blutend aus der Liste der Zustände hinzufügen
    fireEvent.change(screen.getByDisplayValue('Angsterfüllt'), { target: { value: 'Blutend' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Zustand/i }));

    // Enter note
    const noteInput = screen.getByPlaceholderText(/z\. B\. Ork-Krieger Kriegsaxt/i);
    fireEvent.change(noteInput, { target: { value: 'Ork-Keule' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /5 Betäubungs- Schaden anwenden/i }));

    expect(onApplyDamage).toHaveBeenCalledWith({
      kind: 'exhausted',
      amount: 5,
      spendSplitter: false,
      selectedConditions: [{ key: 'Blutend', level: 1 }],
      note: 'Ork-Keule',
    });
  });
});
