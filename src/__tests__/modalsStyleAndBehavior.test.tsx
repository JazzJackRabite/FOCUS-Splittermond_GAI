import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MasteryModal } from '../components/modals/MasteryModal';
import { SpellModal } from '../components/modals/SpellModal';

describe('MasteryModal and SpellModal unified styling & threshold behavior', () => {
  it('MasteryModal lists all masteries without S1-S4 threshold selector buttons', () => {
    const handleAdd = vi.fn();
    const handleClose = vi.fn();

    render(
      <MasteryModal
        skillName="Athletik"
        skillVal={12}
        onAdd={handleAdd}
        onClose={handleClose}
        existingMasteries={[]}
        currentFreeTiers={[]}
      />
    );

    // Verify S1-S4 buttons are NOT present
    expect(screen.queryByRole('button', { name: 'S1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'S2' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'S3' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'S4' })).toBeNull();

    // Verify Gratis-Slot element exists with unified styling class
    const freeSlotContainer = document.getElementById('mastery-modal-free-slot');
    expect(freeSlotContainer).toBeTruthy();
    expect(
      freeSlotContainer?.classList.contains('dark-theme-slot-active') ||
      freeSlotContainer?.classList.contains('dark-theme-slot-inactive')
    ).toBe(true);
  });

  it('SpellModal has unified styling matching MasteryModal Gratis-Slot', () => {
    const handleAdd = vi.fn();
    const handleClose = vi.fn();

    render(
      <SpellModal
        availableSpells={[
          {
            name: 'Flammenstrahl',
            school: 'Feuermagie',
            grade: 1,
            cost: '1V1',
            page: 120,
            description: 'Schießt einen Flammenstrahl.',
          },
        ]}
        schoolName="Feuermagie"
        onAdd={handleAdd}
        onClose={handleClose}
        freeSlots={{
          'Feuermagie': [1, 2],
        }}
        budget={15}
      />
    );

    // Verify Gratis-Slot element exists with unified styling class
    const freeSlotContainer = document.getElementById('spell-modal-free-slot');
    expect(freeSlotContainer).toBeTruthy();
    expect(
      freeSlotContainer?.classList.contains('dark-theme-slot-active') ||
      freeSlotContainer?.classList.contains('dark-theme-slot-inactive')
    ).toBe(true);

    // Text label check
    expect(screen.getByText('Gratis-Slot nutzen')).toBeTruthy();
  });
});
