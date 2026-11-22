/**
 * Pausen und Wirkungen aus dem GRW-Paket statt nach Namen im Code (regelwerk/spielwirkungen.ts):
 * Ruhephase und Verschnaufpause (GRW S. 173–174, 196), Ruhewirkungen von Stärken und Meisterschaften,
 * Wundabzüge (Schmerzresistenz, Schmerzwiderstand), Behinderung und Tick-Zuschlag für Rüstung bzw. Schild.
 */
import { describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { ausruestungsMinderung, ruhephasenRegeneration, ruheregeln, ruhewirkungen, wundabzugMinderung } from '../spielwirkungen';
import type { Mastery } from '../../types';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);
const m = (name: string): Mastery => ({ id: name, name, tier: 1, cost: 0, isFree: true, isCreationBonus: false, source: 'GRW' });

describe('Pausen und Wirkungen aus dem GRW-Paket', () => {
  it('Ruheregeln: Konstitution ×2, Willenskraft ×2, mindestens 1, 6 Stunden, Verschnaufpause 30 Minuten, zweimal pro Tag', () => {
    expect(ruheregeln(K)).toEqual({ lpFaktor: 2, lpMindestens: 1, foFaktor: 2, foMindestens: 1, ruheStunden: 6, verschnaufMinuten: 30, ruhephasenJeTag: 2, quelle: 'GRW S. 173–174' });
    expect(ruheregeln(null).lpFaktor).toBe(0);
  });

  it('Ruhewirkungen mit Beleg; bedingte Wirkungen werden nicht eingerechnet', () => {
    const c = { strengthsList: [{ name: 'Erhöhte Lebensregeneration', level: 1, source: 'GRW' }],
      masteries: { Zähigkeit: [m('Schnell wieder auf den Beinen'), m('Dickschädel')], Naturmagie: [m('Eins mit der Natur')] } };
    const w = ruhewirkungen(c, K);
    expect(w.map((x) => x.quelle).sort()).toEqual(['Dickschädel', 'Eins mit der Natur', 'Erhöhte Lebensregeneration', 'Schnell wieder auf den Beinen']);
    expect(w.find((x) => x.quelle === 'Erhöhte Lebensregeneration')?.beleg).toContain('verdreifacht');
    expect(w.find((x) => x.quelle === 'Eins mit der Natur')?.bedingung).toBe('in der unberührten Natur');
    // KON 2 × 3 + 1 = 7 LP (Eins mit der Natur nur unter Bedingung), WIL 3 × 2 = 6 FO
    expect(ruhephasenRegeneration(2, 3, w, ruheregeln(K))).toEqual({ lp: 7, fo: 6 });
    expect(ruhewirkungen(c, null)).toEqual([]);
  });

  it('Wundabzug: Schmerzresistenz und Schmerzwiderstand I/II senken je um 1', () => {
    const c = { strengthsList: [{ name: 'Schmerzresistenz', level: 1, source: 'GRW' }],
      masteries: { Zähigkeit: [m('Schmerzwiderstand I'), m('Schmerzwiderstand II')] } };
    expect(wundabzugMinderung(c, K).summe).toBe(3);
    expect(wundabzugMinderung({ strengthsList: [], masteries: {} }, K).summe).toBe(0);
  });

  it('Rüstungsträger und Starker Schildarm wirken getrennt auf Rüstung und Schild', () => {
    const r = ausruestungsMinderung({ strengthsList: [], masteries: { Zähigkeit: [m('Rüstungsträger I'), m('Rüstungsträger II'), m('Starker Schildarm I')] } }, K);
    expect(r).toEqual({ ruestung: { behinderung: 1, tick_zuschlag: 1 }, schild: { behinderung: 1, tick_zuschlag: 0 } });
  });
});
