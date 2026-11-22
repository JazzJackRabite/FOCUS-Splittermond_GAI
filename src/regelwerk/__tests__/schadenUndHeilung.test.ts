/**
 * Schadens- und Heildialog lesen ihre Regelwerte aus dem GRW-Paket (regelwerk/schadenUndHeilung.ts):
 * Gesundheitsstufen, Splittergabe Schadensminderung (S. 81), Verschnaufpause (S. 173), Zustände mit Stufe und Höchststufe.
 */
import { describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { heilkundeAuswirkungen, splitterSchadensminderung, standardGesundheitsstufen, verschnaufpause, zustaendeFuerSchaden, zustandHoechststufe } from '../schadenUndHeilung';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);

describe('Regelwerte für Schaden und Heilung aus dem GRW-Paket', () => {
  it('Gesundheitsstufen mit Wundabzügen', () => {
    expect(standardGesundheitsstufen(K).map((s) => `${s.name} ${s.wundabzug}`)).toEqual(
      ['Unverletzt 0', 'Angeschlagen -1', 'Verletzt -2', 'Schwer verletzt -4', 'Todgeweiht -8']);
    expect(standardGesundheitsstufen(null)).toEqual([]);
  });

  it('Splitterpunkt mindert Schaden aus einer Quelle um 5 (Wert aus den Splittergaben)', () => {
    const s = splitterSchadensminderung(K)!;
    expect(s.punkte).toBe(5);
    expect(s.text).toContain('Schaden aus einer Quelle');
    expect(splitterSchadensminderung(null)).toBeNull();
  });

  it('Verschnaufpause: 30 Minuten, heilt allen Betäubungsschaden', () => {
    const v = verschnaufpause(K);
    expect(v.minuten).toBe(30);
    expect(v.wirkung).toContain('Betäubungsschaden');
  });

  it('Zustände aus dem Paket; Höchststufe nur, wo das Paket sie nennt (Geblendet 4)', () => {
    const z = zustaendeFuerSchaden(K);
    expect(z.find((x) => x.name === 'Blutend')).toMatchObject({ mitStufe: true, hoechststufe: undefined });
    expect(z.some((x) => x.name === 'Vergiftet')).toBe(false);
    expect(zustandHoechststufe('Geblendet', K)).toBe(4);
    expect(zustandHoechststufe('Brennend', K)).toBeUndefined();
  });

  it('Heilkunde: Auswirkungen aus der Fertigkeit', () => {
    expect(heilkundeAuswirkungen(K)['Gelungen']).toContain('Ruhephase');
  });
});
