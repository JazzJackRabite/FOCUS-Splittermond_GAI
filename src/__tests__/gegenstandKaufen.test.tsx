import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { bezahlen, preisInTelare, telareText } from '../regelwerk/geld';
import { InventoryView } from '../features/inventory/InventoryView';
import { CharacterContext } from '../context/CharacterContext';
import { DEFAULT_STATE } from '../hooks/useCharacterState';

describe('Geld rechnen (1 S = 100 L, 1 L = 100 T)', () => {
  it('liest Preistexte aus Katalog und Eingabe', () => {
    expect(preisInTelare('16 L')).toBe(1600);
    expect(preisInTelare('50 T')).toBe(50);
    expect(preisInTelare('2 L 50 T')).toBe(250);
    expect(preisInTelare('1 S 5 L')).toBe(10500);
    expect(preisInTelare('1.000 L')).toBe(100000);
    expect(preisInTelare('0,5 L')).toBe(50);
    expect(preisInTelare('10 L/20 T')).toBe(1000); // Munition: erster Teil ist der Gegenstand
    expect(preisInTelare('–')).toBeNull();
    expect(preisInTelare('')).toBeNull();
  });

  it('bezahlt mit kleinen Münzen zuerst, wechselt größere nur bei Bedarf, null bei zu wenig Geld', () => {
    expect(bezahlen({ solare: 0, lunare: 5, telare: 0 }, 300)).toEqual({ solare: 0, lunare: 2, telare: 0 });
    expect(bezahlen({ solare: 0, lunare: 5, telare: 30 }, 250)).toEqual({ solare: 0, lunare: 2, telare: 80 });
    expect(bezahlen({ solare: 1, lunare: 0, telare: 0 }, 150)).toEqual({ solare: 0, lunare: 98, telare: 50 });
    expect(bezahlen({ solare: 0, lunare: 1, telare: 0 }, 150)).toBeNull();
    expect(telareText(10250)).toBe('1 S 2 L 50 T');
  });
});

describe('Inventar: „Gegenstand kaufen“', () => {
  const rendern = (money = { solare: 0, lunare: 5, telare: 0 }) => {
    const dispatch = vi.fn();
    const calc = { loadCapacity: 10, totalLoad: 0 } as never;
    render(
      <CharacterContext.Provider value={{ state: { ...DEFAULT_STATE, inventory: [], money }, dispatch, calc }}>
        <InventoryView />
      </CharacterContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gegenstand' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Eigener Gegenstand' }));
    fireEvent.change(screen.getByPlaceholderText(/Kletterseil/), { target: { value: 'Seil' } });
    fireEvent.change(screen.getByPlaceholderText('z.B. 2 L 50 T'), { target: { value: '1 L 50 T' } });
    return dispatch;
  };
  const arten = (d: ReturnType<typeof vi.fn>) => d.mock.calls.map((c) => c[0].type);

  it('standardmäßig aus: nur hinzufügen, kein Geld abziehen', () => {
    const dispatch = rendern();
    expect((screen.getByTestId('gegenstand-kaufen') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Gegenstand erstellen' }));
    expect(arten(dispatch)).toEqual(['ADD_INVENTORY_ITEM']);
  });

  it('an: Preis × Anzahl wird abgezogen', () => {
    const dispatch = rendern();
    fireEvent.click(screen.getByTestId('gegenstand-kaufen'));
    const anzahl = screen.getByText('Anzahl').parentElement!.querySelector('input')!;
    fireEvent.change(anzahl, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gegenstand kaufen' }));
    expect(arten(dispatch)).toEqual(['SET_MONEY', 'ADD_INVENTORY_ITEM']);
    expect(dispatch.mock.calls[0][0].payload).toEqual({ solare: 0, lunare: 2, telare: 0 });
  });

  it('an, aber zu wenig Geld: nichts wird gekauft', () => {
    const dispatch = rendern({ solare: 0, lunare: 1, telare: 0 });
    fireEvent.click(screen.getByTestId('gegenstand-kaufen'));
    fireEvent.click(screen.getByRole('button', { name: 'Gegenstand kaufen' }));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
