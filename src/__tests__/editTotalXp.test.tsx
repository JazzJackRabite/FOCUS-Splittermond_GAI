import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdvancementLog } from '../components/advancement/AdvancementLog';
import { EditTotalXpModal } from '../components/modals/EditTotalXpModal';
import { baseCharacterReducer, DEFAULT_STATE } from '../hooks/useCharacterState';
import type { CharacterState } from '../types';

describe('Edit Total XP Functionality & Protocol Logging', () => {
  describe('EditTotalXpModal', () => {
    it('renders with current XP values and allows adjusting total XP and adding a comment', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <EditTotalXpModal
          currentXpTotal={30}
          xpSpent={15}
          onClose={onClose}
          onSave={onSave}
        />
      );

      expect(screen.getByRole('heading', { name: /Gesamt-EP editieren/i })).toBeDefined();
      expect(screen.getByText('30 EP')).toBeDefined(); // Current total
      expect(screen.getAllByText('15 EP').length).toBeGreaterThan(0); // Spent

      // Change total XP from 30 to 50
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '50' } });

      // Diff should show +20 EP
      expect(screen.getAllByText('+20 EP').length).toBeGreaterThan(0);
      // Available after should show 35 EP (50 - 15)
      expect(screen.getAllByText('35 EP').length).toBeGreaterThan(0);

      // Enter a comment
      const textarea = screen.getByPlaceholderText(/z\. B\. Spielleiter-Korrektur/i);
      fireEvent.change(textarea, { target: { value: 'Spielleiter-Bonus für Meilenstein' } });

      // Submit
      const saveBtn = screen.getByRole('button', { name: /Korrektur speichern/i });
      fireEvent.click(saveBtn);

      expect(onSave).toHaveBeenCalledWith(50, 'Spielleiter-Bonus für Meilenstein');
      expect(onClose).toHaveBeenCalled();
    });

    it('handles negative adjustments and warns if new total is less than spent XP', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <EditTotalXpModal
          currentXpTotal={30}
          xpSpent={25}
          onClose={onClose}
          onSave={onSave}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '20' } });

      // Diff should show -10 EP
      expect(screen.getAllByText('-10 EP').length).toBeGreaterThan(0);
      // Warning about available XP being negative (20 - 25 = -5)
      expect(screen.getAllByText(/-5 EP/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Achtung: Die neue Gesamt-EP liegt unter den bisher ausgegebenen EP/i)).toBeDefined();
    });
  });

  describe('AdvancementLog integration', () => {
    it('has a "Gesamt EP editieren" button at the bottom of the log', () => {
      const onEditTotalXp = vi.fn();

      render(
        <AdvancementLog
          entries={[]}
          xpTotal={25}
          xpSpent={10}
          xpAvailable={15}
          onAddXpWithNote={vi.fn()}
          onEditTotalXp={onEditTotalXp}
          onAddCustomLog={vi.fn()}
          onDeleteLogEntry={vi.fn()}
        />
      );

      // Buttons exist both in header and bottom
      const editButtons = screen.getAllByRole('button', { name: /Gesamt.*EP editieren/i });
      expect(editButtons.length).toBeGreaterThanOrEqual(1);

      // Click the edit button
      fireEvent.click(editButtons[0]);

      // Modal should now be open
      expect(screen.getByRole('heading', { name: /Gesamt-EP editieren/i })).toBeDefined();
      expect(screen.getByPlaceholderText(/z\. B\. Spielleiter-Korrektur/i)).toBeDefined();
    });
  });

  describe('CharacterReducer EDIT_XP_TOTAL_WITH_NOTE action', () => {
    it('updates xpTotal and records a detailed log entry with difference and comment', () => {
      const initialState: CharacterState = {
        ...DEFAULT_STATE,
        xpTotal: 20,
        mode: 'xp',
        advancementLog: [],
      };

      const nextState = baseCharacterReducer(initialState, {
        type: 'EDIT_XP_TOTAL_WITH_NOTE',
        payload: {
          newTotal: 45,
          note: 'Punkteübertrag aus alter Runde',
        },
      });

      expect(nextState.xpTotal).toBe(45);
      expect(nextState.advancementLog).toHaveLength(1);

      const logEntry = nextState.advancementLog![0];
      expect(logEntry.category).toBe('xp');
      expect(logEntry.title).toBe('Gesamt-EP korrigiert (+25 EP)');
      expect(logEntry.detail).toContain('Punkteübertrag aus alter Runde');
      expect(logEntry.detail).toContain('Gesamt: 20 → 45 EP');
      expect(logEntry.xpDelta).toBe(25);
    });

    it('records downward correction properly', () => {
      const initialState: CharacterState = {
        ...DEFAULT_STATE,
        xpTotal: 50,
        mode: 'xp',
        advancementLog: [],
      };

      const nextState = baseCharacterReducer(initialState, {
        type: 'EDIT_XP_TOTAL_WITH_NOTE',
        payload: {
          newTotal: 40,
          note: 'Tippfehler bei EP-Eingabe korrigiert',
        },
      });

      expect(nextState.xpTotal).toBe(40);
      expect(nextState.advancementLog).toHaveLength(1);

      const logEntry = nextState.advancementLog![0];
      expect(logEntry.category).toBe('xp');
      expect(logEntry.title).toBe('Gesamt-EP korrigiert (-10 EP)');
      expect(logEntry.detail).toContain('Tippfehler bei EP-Eingabe korrigiert');
      expect(logEntry.detail).toContain('Gesamt: 50 → 40 EP');
      expect(logEntry.xpDelta).toBe(-10);
    });
  });
});
