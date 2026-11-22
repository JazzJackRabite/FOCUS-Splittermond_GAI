/**
 * Stand 45: weitere Regeln aus dem Paket statt fester Zahlen im Code.
 * - Grenzen der Erschaffung (GRW S. 22–25), Sterben (GRW S. 172–173), Verwundet nur im Wundabzug (GRW S. 169),
 *   Anteile in Wirkungen („Abzüge durch Erschöpft halbiert“).
 */
import { describe, expect, it } from 'vitest';
import { erschaffungsGrenzen } from '../regelwerk/grwListen';
import { lpKaestchen, sterbestand, sterberegeln } from '../regelwerk/schadenUndHeilung';
import { wirkungKurz } from '../regelwerk/wirkungen';
import { getActiveRollModifiers } from '../utils/conditionModifiers';

const leiste = (n: number, echt: number) => Array.from({ length: n }, (_, i) => ({ type: i < echt ? 'consumed' : 'empty' }));

describe('Grenzen der Erschaffung aus dem Paket', () => {
  it('18 Attributpunkte (1–3), 55 Fertigkeitspunkte (höchstens 6), 5 nicht-magisch, 8 Ressourcen, 3 Meisterschaften, 2 Sprachen', () => {
    expect(erschaffungsGrenzen()).toEqual({ attributPunkte: 18, attributMin: 1, attributMax: 3, fertigkeitPunkte: 55, fertigkeitMax: 6,
      nichtMagischMin: 5, ressourcenPunkte: 8, startMeisterschaften: 3, sprachen: 2 });
  });
});

describe('Sterben aus dem Paket', () => {
  it('Regeln: Sterbend 2 beim ersten Punkt auf Todgeweiht, Probe auf Zähigkeit gegen 20; alle LP: Bewusstlos und Sterbend 3', () => {
    const r = sterberegeln()!;
    expect(r.beiErstemSchaden).toEqual([{ key: 'Sterbend', level: 2, ursache: 'Wunden' }]);
    expect(r.probe).toEqual({ fertigkeit: 'Zähigkeit', schwierigkeit: 20 });
    expect(r.beiAllenLp.map((z) => z.key)).toEqual(['Bewusstlos', 'Sterbend']);
    expect(r.totMehrAlsStufen).toBe(1);
  });

  it('Stand aus der Leiste (LP 4): 16 → 0, 17 → 2, 20 → 3, 24 → noch 3, 25 → tot', () => {
    const n = lpKaestchen(4);
    expect(n).toBe(25);
    expect(sterbestand(leiste(n, 16), 4).stufe).toBe(0);
    expect(sterbestand(leiste(n, 17), 4).stufe).toBe(2);
    expect(sterbestand(leiste(n, 20), 4)).toMatchObject({ stufe: 3 });
    expect(sterbestand(leiste(n, 20), 4).zustaende.some((z) => z.key === 'Bewusstlos')).toBe(true);
    expect(sterbestand(leiste(n, 24), 4).stufe).toBe(3);
    expect(sterbestand(leiste(n, 25), 4).stufe).toBe(4);
  });
});

describe('Anzeige', () => {
  it('Wirkung mit Anteil: „Abzüge durch Erschöpft halbiert“', () => {
    expect(wirkungKurz({ art: 'wert_gesenkt', wert: 'Hälfte', bezug: 'zustandsabzug', zustand_ref: { id: 'x', text: 'Erschöpft' }, beleg: '' } as never)).toBe('Abzüge durch Erschöpft halbiert');
  });
  it('Wundabzug nennt Verwundet in der Beschriftung (eine Zeile, ein Abzug)', () => {
    const m = getActiveRollModifiers([{ id: 'v', key: 'Verwundet', level: 1 }], -2, 'Angeschlagen');
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ label: 'Wundabzug (Angeschlagen, Verwundet 1)', malus: -2 });
  });
});
