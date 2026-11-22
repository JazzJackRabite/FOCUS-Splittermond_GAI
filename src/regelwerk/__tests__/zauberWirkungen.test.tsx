/**
 * Zaubermechanik aus Meisterschaften (Gruppe B): Kosten und Zauberdauer im Zauber-Dialog, Filter nach Magieschule.
 */
import React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { setzeAktivenKatalog } from '../bruecke';
import { CharacterContext } from '../../context/CharacterContext';
import { CastSpellModal } from '../../components/play/CastSpellModal';
import { DEFAULT_STATE } from '../../hooks/useCharacterState';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { giltFuerSchule, kostenAnwenden, kostenDelta, situativeBoni, wirkungenDesCharakters, zauberAnpassungen, zauberdauerAnpassen } from '../wirkungen';
import { parseFocusCost } from '../../utils/magicRules';

const b = basisAusDateien();
const K = new Katalog(b.manifest, [b.basis]);
const SPARSAM = 'grw:meisterschaft:allgemeine-magiemeisterschaften:sparsamer-zauberer';
const EILIG = 'grw:meisterschaft:schutzmagie:eiliger-schutz';
const STREITER = 'grw:meisterschaft:lichtmagie:streiter-des-lichtes';
const AUGE = 'grw:meisterschaft:allgemeine-magiemeisterschaften:auge-des-zauberers';

describe('Fokuskosten nach GRW (V ist Teil der Gesamtkosten)', () => {
  it('4V1, K4V1, K1', () => {
    expect(parseFocusCost('4V1')).toMatchObject({ exhausted: 3, consumed: 1, total: 4 });
    expect(parseFocusCost('K4V1')).toMatchObject({ channeled: 3, consumed: 1, total: 4, isChanneled: true });
    expect(parseFocusCost('K1')).toMatchObject({ channeled: 1, consumed: 0, total: 1 });
  });
});

describe('Kostenänderungen', () => {
  it('Zahl und (K)-Schreibweise je nach Zauber', () => {
    expect(kostenDelta('kosten_gesenkt', 1, false)).toEqual({ erschoepft: -1, kanalisiert: 0, verzehrt: 0 });
    expect(kostenDelta('kosten_gesenkt', 1, true)).toEqual({ erschoepft: 0, kanalisiert: -1, verzehrt: 0 });
    expect(kostenDelta('kosten_gesenkt', '(K)2V1', true)).toEqual({ erschoepft: 0, kanalisiert: -1, verzehrt: -1 });
    expect(kostenDelta('kosten_gesenkt', '(K)2V1', false)).toEqual({ erschoepft: -1, kanalisiert: 0, verzehrt: -1 });
    expect(kostenDelta('kosten_gesenkt', '4V1 oder K3V1', true)).toEqual({ erschoepft: 0, kanalisiert: -2, verzehrt: -1 });
    expect(kostenDelta('kosten_erhoeht', 'K3V3', false)).toEqual({ erschoepft: 0, kanalisiert: 0, verzehrt: 3 });
    expect(kostenDelta('kosten_gesenkt', 'halbe Kosten', false)).toBeNull();
  });
  it('Mindestkosten 1 und fehlender verzehrter Anteil geht auf den Rest', () => {
    const z = kostenAnwenden(parseFocusCost('2'), [{ erschoepft: -1, kanalisiert: 0, verzehrt: -1 }]);
    expect(z).toMatchObject({ exhausted: 1, consumed: 0, total: 1 });
    const k = kostenAnwenden(parseFocusCost('K4V1'), [{ erschoepft: 0, kanalisiert: -1, verzehrt: -1 }]);
    expect(k).toMatchObject({ channeled: 2, consumed: 0, total: 2 });
    const e = kostenAnwenden(parseFocusCost('1'), [{ erschoepft: -1, kanalisiert: 0, verzehrt: 0 }]);
    expect(e.total).toBe(1);
  });
  it('Zauberdauer gleicher Einheit, mindestens 1', () => {
    expect(zauberdauerAnpassen('3 Ticks', [{ wert: -2, einheit: 'ticks' }])).toBe('1 Tick');
    expect(zauberdauerAnpassen('9 Ticks', [{ wert: 5, einheit: 'ticks' }])).toBe('14 Ticks');
    expect(zauberdauerAnpassen('5 Minuten', [{ wert: 5, einheit: 'ticks' }])).toBe('5 Minuten');
  });
});

describe('Magieschule', () => {
  const liste = wirkungenDesCharakters(K, [SPARSAM, EILIG, STREITER, AUGE], { [SPARSAM]: ['Feuermagie'], [AUGE]: ['Feuermagie'] });
  it('Meisterschaften einer Schule gelten nur für deren Zauber, allgemeine nur für die gewählte Schule', () => {
    const f = zauberAnpassungen(K, liste, 'Feuermagie', false).map(a => `${a.quelle}:${a.art}`);
    expect(f).toContain('Sparsamer Zauberer:kosten');
    expect(f).toContain('Auge des Zauberers:dauer');
    expect(f.some(x => x.startsWith('Eiliger Schutz'))).toBe(false);
    const s = zauberAnpassungen(K, liste, 'Schutzmagie', false).map(a => `${a.quelle}:${a.art}`);
    expect(s).toEqual(['Eiliger Schutz:dauer']);
  });
  it('Würfelbonus auf Zauber nur in der eigenen Schule', () => {
    expect(situativeBoni(K, liste, 'zauber', 'Lichtmagie').map(x => x.quelle)).toEqual(['Streiter des Lichtes']);
    expect(situativeBoni(K, liste, 'zauber', 'Feuermagie').map(x => x.quelle)).toEqual([]);
    const cw = liste.find(x => x.quelle === STREITER)!;
    expect(giltFuerSchule(K, cw, 'Feuermagie')).toBe(false);
  });
});

describe('Zauber-Dialog', () => {
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => setzeAktivenKatalog(null, false));
  const liste = wirkungenDesCharakters(K, [SPARSAM, AUGE], { [SPARSAM]: ['Feuermagie'], [AUGE]: ['Feuermagie'] });
  const spell = { name: 'Testzauber', school: 'Feuermagie', grade: 1, cost: '4V1', castTime: '9 Ticks', range: '5 m', duration: 'sofort', description: '' } as never;
  const leer = () => {};

  it('Sparsamer Zauberer senkt die Grundkosten, Auge des Zauberers verlängert die Zauberdauer', () => {
    render(
      <CharacterContext.Provider value={{ state: DEFAULT_STATE, dispatch: leer, calc: { wirkungen: { liste, fertigkeitsBoni: {} } } as never }}>
        <CastSpellModal spell={spell} schoolSkillTotal={10} schoolSkillName="Feuermagie" availableFocus={20} maxFO={20}
          focusState={{ exhausted: 0, channeled: 0, consumed: 0 } as never} splitterpunkte={3}
          onClose={leer} onCastSuccess={leer} onCastFailure={leer} onSpendSplitterpunkt={leer} />
      </CharacterContext.Provider>,
    );
    expect(screen.getByTestId('zauber-anpassungen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Sparsamer Zauberer/ }));
    expect(screen.getByText('3V1')).toBeTruthy();
    // Auge des Zauberers: Zauberdauer und Kosten gemeinsam
    fireEvent.click(screen.getByRole('button', { name: /Auge des Zauberers/ }));
    expect(screen.getByText('14 Ticks')).toBeTruthy();
    expect(screen.getByText('7V3')).toBeTruthy();
  });
});
