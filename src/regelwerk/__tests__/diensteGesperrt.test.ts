/**
 * Erweiterte Dienste: Grenze aus den Daten (bis_stufe der freischaltenden Meisterschaft) und Begründung gesperrter Dienste.
 * Erfundenes Beispiel ohne Buchinhalt.
 */
import { describe, expect, it } from 'vitest';
import { gesperrteDienste, verfuegbareDienste } from '../dienste';

const eintrag = (id: string, typ: string, daten: Record<string, unknown>) => ({ id, typ, name: id, daten });
const kat = (stufe: number) => ({
  eintraege: {
    w: eintrag('w', 'wesen', { beschwoerbares_wesen_stufe: stufe, erweiterte_dienste: [{ id: 'd1' }] }),
    d1: eintrag('d1', 'dienst', { kosten: { fokus: 3, davon_verzehrt: 0 }, freigeschaltet_durch: [{ id: 'm1', bis_stufe: 4 }],
      stufengrenze_erhoeht_durch: [{ id: 'm2', bis_stufe: 9 }] }),
  },
}) as never;

describe('Erweiterte Dienste', () => {
  it('Grenze aus bis_stufe, angehoben durch weitere Meisterschaft', () => {
    expect(verfuegbareDienste(kat(4), 'w', ['m1']).map(d => d.id)).toEqual(['d1']);
    expect(verfuegbareDienste(kat(6), 'w', ['m1'])).toEqual([]);
    expect(verfuegbareDienste(kat(6), 'w', ['m1', 'm2']).map(d => d.id)).toEqual(['d1']);
  });
  it('gesperrt: fehlende Meisterschaft und Stufengrenze mit Begründung', () => {
    expect(gesperrteDienste(kat(4), 'w', [])).toEqual([{ id: 'd1', fehlt: ['m1'] }]);
    expect(gesperrteDienste(kat(6), 'w', ['m1'])).toEqual([{ id: 'd1', fehlt: [], stufe: { wesen: 6, grenze: 4, anheben: [{ id: 'm2', bis: 9 }] } }]);
    expect(gesperrteDienste(kat(4), 'w', ['m1'])).toEqual([]);
  });
});
