/**
 * Lage beim Angriff aus dem GRW-Paket (regelwerk/kampflage.ts): Kampfpositionen (Tabelle GRW S. 170),
 * Taktischer Vorteil und Überzahl (S. 170–171), Lücke suchen (S. 161), Zielen, Deckung, Kampfgetümmel (S. 162),
 * Scharfschütze hebt Kampfgetümmel auf. Proben (regelwerk/proben.ts): Erfolgsgrade, Patzer, Triumph (S. 17–18).
 */
import { describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { ignoriertSituation, kampfsituationen, positionsModifikator, positionsNamen, vorbereitungsBonus } from '../kampflage';
import { erfolgsgrade, probenregeln, wurfgrenzen } from '../proben';

const B = basisAusDateien();
const K = new Katalog(B.manifest, [B.basis]);

describe('Kampflage aus dem Paket', () => {
  it('liest alle Situationen', () => {
    const s = kampfsituationen(K);
    expect(s.taktischerVorteil?.bonus).toBe(3);
    expect(s.ueberzahl).toEqual({ bonusJeKaempfer: 1, hoechstens: 3 });
    expect(s.deckung).toEqual({ leicht: 1, schwer: 2 });
    expect(s.kampfgetuemmel?.malus).toBe(6);
    expect(s.zielen).toEqual({ ticks: 2, bonus: 1, hoechstens: 3 });
    expect(s.lueckeSuchen).toEqual({ ticks: 2, bonus: 1, hoechstens: 3 });
    expect(s.quellen.positionen).toBe('GRW S. 170');
  });

  it('Kampfpositionen nach Tabelle S. 170', () => {
    expect(positionsNamen(K)).toEqual(['Stehend', 'Kniend', 'Liegend', 'Fliegend']);
    expect(positionsModifikator('Liegend', 'nahkampf', 'gegnerisch', '', K)).toBe(6);
    expect(positionsModifikator('Liegend', 'fernkampf', 'gegnerisch', 'Kurzbogen', K)).toBe(-6);
    expect(positionsModifikator('Liegend', 'fernkampf', 'eigene', 'Kurzbogen', K)).toBe(-6);
    expect(positionsModifikator('Liegend', 'fernkampf', 'eigene', 'Leichte Armbrust', K)).toBe(0);
    expect(positionsModifikator('Kniend', 'nahkampf', 'eigene', '', K)).toBe(-3);
    expect(positionsModifikator('Kniend', 'fernkampf', 'gegnerisch', '', K)).toBe(-3);
    expect(positionsModifikator('Fliegend', 'nahkampf', 'eigene', '', K)).toBe(3);
    expect(positionsModifikator('Stehend', 'fernkampf', 'gegnerisch', '', K)).toBe(0);
  });

  it('Zielen und Lücke suchen: +1 je 2 Ticks, höchstens 3', () => {
    expect(vorbereitungsBonus(1, 'fernkampf', K)).toBe(0);
    expect(vorbereitungsBonus(4, 'fernkampf', K)).toBe(2);
    expect(vorbereitungsBonus(10, 'nahkampf', K)).toBe(3);
  });

  it('Scharfschütze hebt Kampfgetümmel auf, nur in der eigenen Fertigkeit', () => {
    const m = { Schusswaffen: [{ name: 'Scharfschütze' }] };
    expect(ignoriertSituation('kampfgetuemmel', m, 'Schusswaffen', K)).toBe('Scharfschütze');
    expect(ignoriertSituation('kampfgetuemmel', m, 'Wurfwaffen', K)).toBeNull();
    expect(ignoriertSituation('kampfgetuemmel', [{ name: 'Scharfschütze', skill: 'Wurfwaffen' }], 'Wurfwaffen', K)).toBe('Scharfschütze');
    expect(ignoriertSituation('kampfgetuemmel', [{ name: 'Scharfschütze', skill: 'Wurfwaffen' }], 'Schusswaffen', K)).toBeNull();
  });

  it('ohne Paket keine Modifikatoren', () => {
    expect(kampfsituationen(null).positionen).toEqual([]);
    expect(vorbereitungsBonus(6, 'fernkampf', null)).toBe(0);
  });
});

describe('Proben aus dem Paket', () => {
  it('Grenzen und Werte', () => {
    expect(wurfgrenzen(K)).toEqual({ patzer: 3, triumph: 19, wuerfel: { standard: 2, safe: 2, risk: 4 } });
    const r = probenregeln(K);
    expect(r.punkteJeEg).toBe(3);
    expect(r.stufen.length).toBeGreaterThanOrEqual(8);
  });

  it('Erfolgsgrade, Patzer, Triumph', () => {
    expect(erfolgsgrade(20, 15, false, false, K)).toMatchObject({ eg: 1, gelungen: true });
    expect(erfolgsgrade(14, 15, false, false, K)).toMatchObject({ eg: 0, gelungen: false, einstufung: 'Knapp misslungen' });
    expect(erfolgsgrade(30, 15, true, false, K)).toMatchObject({ eg: -1, gelungen: false });
    expect(erfolgsgrade(15, 15, false, true, K)).toMatchObject({ eg: 3, gelungen: true, triumph: true });
    expect(erfolgsgrade(12, 15, false, true, K)).toMatchObject({ eg: -1, gelungen: false, triumph: false });
  });
});
