/**
 * Steigerung: Würfel (GRW S. 16–19), Großmeister (S. 92), freie Meisterschaft trotz unerfüllter Voraussetzung (S. 92).
 */
import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { wuerfeln } from '../../utils/wuerfeln';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { grossmeisterAb, setzeAktivenKatalog } from '../bruecke';
import { MasteryModal } from '../../components/modals/MasteryModal';

/** Zufallsfolge aus Würfelaugen (1–10) */
const folge = (...augen: number[]) => { let i = 0; return () => (augen[i++] - 1) / 10 + 0.01; };

describe('Würfel nach Regelwerk', () => {
  it('Standardwurf: Patzer bis Augensumme 3, Triumph ab 19', () => {
    expect(wuerfeln('standard', false, folge(1, 2))).toMatchObject({ result: 3, isFumble: true, isCrit: false });
    expect(wuerfeln('standard', false, folge(2, 2))).toMatchObject({ result: 4, isFumble: false });
    expect(wuerfeln('standard', false, folge(9, 10))).toMatchObject({ result: 19, isCrit: true });
  });
  it('Sicherheitswurf: nur der höhere Würfel, kein Patzer', () => {
    expect(wuerfeln('safe', false, folge(1, 1))).toMatchObject({ result: 1, isFumble: false, isCrit: false });
    expect(wuerfeln('safe', false, folge(3, 8))).toMatchObject({ result: 8 });
  });
  it('Risikowurf: niedrigste zwei ≤ 3 = Patzer, sonst die höchsten zwei', () => {
    expect(wuerfeln('risk', false, folge(1, 2, 9, 9))).toMatchObject({ result: 3, isFumble: true });
    expect(wuerfeln('risk', false, folge(4, 5, 6, 7))).toMatchObject({ result: 13, isFumble: false });
  });
  it('Großmeister: zusätzlicher W10, zählt nicht für den Patzer', () => {
    expect(wuerfeln('standard', true, folge(5, 6, 9))).toMatchObject({ result: 15, dice: [5, 6, 9], grossmeisterWuerfel: 9 });
    expect(wuerfeln('standard', true, folge(1, 2, 10))).toMatchObject({ result: 3, isFumble: true });
    expect(wuerfeln('standard', true, folge(9, 4, 10))).toMatchObject({ result: 19, isCrit: true });
    expect(wuerfeln('safe', true, folge(3, 4, 8))).toMatchObject({ result: 8 });
    expect(wuerfeln('risk', true, folge(1, 2, 9, 9, 10))).toMatchObject({ result: 3, isFumble: true });
    expect(wuerfeln('risk', true, folge(4, 5, 6, 7, 9))).toMatchObject({ result: 16 });
  });
});

describe('Freie Meisterschaft trotz unerfüllter Voraussetzung (GRW S. 92)', () => {
  const b = basisAusDateien(); const K = new Katalog(b.manifest, [b.basis]);
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => setzeAktivenKatalog(null, false));

  it('Großmeister ab 15 Punkten laut Regeldaten', () => {
    expect(grossmeisterAb()).toBe(15);
  });

  it('Alchemie Schwelle 4: Meisterwerk nur als freie Meisterschaft wählbar', () => {
    const onAdd = vi.fn();
    render(<MasteryModal skillName="Alchemie" skillVal={15} currentFreeTiers={[1, 2, 3]} onClose={() => {}} onAdd={onAdd}
      existingMasteries={[]} allCharacterMasteries={[]} skills={{ Alchemie: 15 }} />);
    const option = screen.getAllByRole('option').find(o => o.textContent?.includes('Meisterwerk (S4)')) as HTMLOptionElement;
    expect(option).toBeTruthy();
    expect(option.disabled).toBe(false);
    fireEvent.change(option.closest('select')!, { target: { value: option.value } });
    expect(screen.getByTestId('frei-trotz-voraussetzung')).toBeTruthy();
    const hinzufuegen = () => screen.getAllByRole('button').find(x => /hinzufügen|lernen|übernehmen/i.test(x.textContent ?? '') && x.className.includes('bg-gold')) as HTMLButtonElement;
    // freie Meisterschaft offen: „Gratis-Slot nutzen“ ist vorgewählt; abgewählt ist sie nicht wählbar
    expect((screen.getByLabelText('Gratis-Slot nutzen') as HTMLInputElement).checked).toBe(true);
    expect(hinzufuegen().disabled).toBe(false);
    fireEvent.click(screen.getByLabelText('Gratis-Slot nutzen'));
    expect(hinzufuegen().disabled).toBe(true);
  });
});
