/** Mondzeichen-Gaben und Schwerpunkt-Bonus aus dem Paket (Praxistest Kael und Mirelda) */
import { describe, expect, it } from 'vitest';
import { gabeRisikoNeuwurf, gabeSicherheitBeide, type WurfErgebnis } from '../utils/wuerfeln';
import { mondgabe, schwerpunktBonusJe } from '../regelwerk/grwListen';
import { mondgabeWirkung } from '../components/play/Mondgabe';

const w = (dice: number[], result: number, extra: Partial<WurfErgebnis> = {}): WurfErgebnis => ({ dice, result, isCrit: false, isFumble: false, ...extra });

describe('Mondzeichen aus dem Paket', () => {
  it('liefert Art und Werte der Gabe', () => {
    expect(mondgabe('Der Fels')).toMatchObject({ art: 'sicherheit_beide_addieren', hoechsterHoechstens: 5, kosten: 1 });
    expect(mondgabe('Der Spieler')?.art).toBe('risiko_zweitniedrigster_neu');
    expect(mondgabe('Der Blitz')).toMatchObject({ ticks: 4, mindestensTicks: 2 });
    expect(mondgabe('Unbekannt')).toBeNull();
  });
});

describe('Der Fels: Sicherheitswurf, höchster Würfel höchstens 5 → beide addieren', () => {
  it('4 und 3: 7 statt 4', () => {
    expect(gabeSicherheitBeide('safe', w([4, 3], 4), 5)?.result).toBe(7);
  });
  it('höchster Würfel 6: nicht anwendbar; kein Sicherheitswurf: nicht anwendbar', () => {
    expect(gabeSicherheitBeide('safe', w([6, 2], 6), 5)).toBeNull();
    expect(gabeSicherheitBeide('standard', w([4, 3], 7), 5)).toBeNull();
  });
});

describe('Der Spieler: Risikowurf ohne Patzer, zweitniedrigsten Würfel neu werfen', () => {
  it('2, 5, 8, 9 → zweitniedrigster (5) wird 10: zählen 10 und 9', () => {
    const n = gabeRisikoNeuwurf('risk', w([2, 5, 8, 9], 17), () => 0.95, { patzer: 3, triumph: 19 });
    expect(n?.dice).toEqual([2, 8, 9, 10]);
    expect(n?.result).toBe(19);
    expect(n?.isCrit).toBe(true);
  });
  it('bei Patzer nicht', () => {
    expect(gabeRisikoNeuwurf('risk', w([1, 1, 8, 9], 2, { isFumble: true }))).toBeNull();
  });
});

describe('Blutiges Antlitz: Wundabzug als Bonus', () => {
  it('Wundabzug −2 → Bonus +2 (Verschiebung +4)', () => {
    expect(mondgabeWirkung('wundabzug_als_bonus', 'standard', w([5, 5], 10), -2)?.bonus).toBe(4);
    expect(mondgabeWirkung('wundabzug_als_bonus', 'standard', w([5, 5], 10), 0)).toBeNull();
  });
});

describe('Schwerpunkt', () => {
  it('Bonus je Schwerpunkt aus dem Paket: 1', () => {
    expect(schwerpunktBonusJe()).toBe(1);
  });
});
