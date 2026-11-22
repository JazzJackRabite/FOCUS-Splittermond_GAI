/**
 * Erfolgsgrade beim Angriff: nichts ist vorbelegt; vor dem Schadenswurf fragt der Dialog nach, wenn EG übrig sind.
 * Je volle 3 Punkte über der Verteidigung 1 EG (GRW S. 17).
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AttackModal } from '../components/play/AttackModal';

const ziel = { weapon: { name: 'Langschwert', damage: '1W8+4', wgs: 8 }, skillName: 'Klingenwaffen', skillTotal: 10, targetVTD: 15 };

function angriff() {
  render(<AttackModal target={ziel} splitterpunkte={0} onClose={() => {}} onSpendSplitterpunkt={() => {}} onAttackSuccess={() => {}} onAttackFailure={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Tisch-Wurf/ }));
  fireEvent.change(screen.getByPlaceholderText('z.B. 14'), { target: { value: '14' } }); // 14 + 10 = 24 gegen 15: 3 EG
  fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
}
const wucht = () => screen.getByTestId('eg-wucht-wert').textContent;
const schadenKnopf = () => screen.getAllByRole('button', { name: /^Schaden würfeln/ })[0];

describe('Erfolgsgrade beim Angriff verteilen', () => {
  it('nach dem Treffer ist nichts vorbelegt, alle Möglichkeiten sind wählbar', () => {
    angriff();
    expect(wucht()).toBe('0');
    expect((screen.getByRole('button', { name: 'Wuchtangriff: ein EG mehr' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('eg-betaeubung') as HTMLButtonElement).disabled).toBe(false);
  });

  it('übrige EG: Nachfrage, als Wuchtangriff verwenden', () => {
    angriff();
    fireEvent.click(schadenKnopf());
    expect(screen.getByTestId('eg-nachfrage').textContent).toContain('3 EG');
    fireEvent.click(screen.getByTestId('eg-nachfrage-wucht'));
    expect(screen.queryByTestId('eg-nachfrage')).toBeNull();
    expect(wucht()).toBe('3');
    expect(screen.getByRole('button', { name: /Schaden erneut würfeln/ })).toBeTruthy();
  });

  it('übrige EG verfallen lassen; ohne übrige EG keine Nachfrage', () => {
    angriff();
    fireEvent.click(schadenKnopf());
    fireEvent.click(screen.getByTestId('eg-nachfrage-verfallen'));
    expect(wucht()).toBe('0');
    expect(screen.getByRole('button', { name: /Schaden erneut würfeln/ })).toBeTruthy();
  });

  it('alle EG verteilt: Schaden ohne Nachfrage', () => {
    angriff();
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Wuchtangriff: ein EG mehr' }));
    fireEvent.click(schadenKnopf());
    expect(screen.queryByTestId('eg-nachfrage')).toBeNull();
    expect(screen.getByRole('button', { name: /Schaden erneut würfeln/ })).toBeTruthy();
  });
});
