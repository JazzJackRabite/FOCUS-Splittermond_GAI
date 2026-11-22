/**
 * Kampfpositionen nach der Tabelle GRW S. 170 (Idee #16): Tabelle vollständig aus dem Paket, Kampfposition „Liegend“
 * aus den Zuständen nur als eigene Position im Angriffsdialog (kein zusätzlicher Abzug, keine Wirkung auf andere Proben),
 * Zauber gegen die Verteidigung mit der Position des Ziels wie gegnerischer Fernkampf.
 */
import React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { setzeAktivenKatalog } from '../bruecke';
import { kampfsituationen, positionsBeschreibung, positionsModifikator } from '../kampflage';
import { liegtLautZustaenden, zustandswerte } from '../zustandswerte';
import { getActiveRollModifiers, getConditionDescription, getConditionMalus } from '../../utils/conditionModifiers';
import { CharacterContext } from '../../context/CharacterContext';
import { AttackModal } from '../../components/play/AttackModal';
import { CastSpellModal } from '../../components/play/CastSpellModal';
import { DEFAULT_STATE } from '../../hooks/useCharacterState';

const b = basisAusDateien();
const K = new Katalog(b.manifest, [b.basis]);
const liegend = { id: 'l', key: 'Liegend', level: 1 };
const leer = () => {};

describe('Tabelle der Kampfpositionen (GRW S. 170)', () => {
  it('alle sieben Zeilen wie im Buch', () => {
    // Position, Angriffsart, eigene Angriffe, gegnerische Angriffe – abgeschrieben aus der Tabelle S. 170
    const soll = [
      ['Stehend', 'beide', 0, 0], ['Kniend', 'fernkampf', 0, -3], ['Kniend', 'nahkampf', -3, 3],
      ['Liegend', 'armbrust', 0, -6], ['Liegend', 'fernkampf', -6, -6], ['Liegend', 'nahkampf', -6, 6], ['Fliegend', 'beide', 3, -3],
    ];
    expect(kampfsituationen(K).positionen.map((p) => [p.position, p.angriff, p.eigene, p.gegnerisch])).toEqual(soll);
  });

  it('Armbrust im Liegen: kein Abzug auf eigene Angriffe; anderer Fernkampf −6', () => {
    expect(positionsModifikator('Liegend', 'fernkampf', 'eigene', 'Schwere Armbrust', K)).toBe(0);
    expect(positionsModifikator('Liegend', 'fernkampf', 'eigene', 'Handarmbrust', K)).toBe(0);
    expect(positionsModifikator('Liegend', 'fernkampf', 'eigene', 'Langbogen', K)).toBe(-6);
    expect(positionsModifikator('Kniend', 'fernkampf', 'eigene', 'Langbogen', K)).toBe(0);
    expect(positionsModifikator('Fliegend', 'fernkampf', 'gegnerisch', '', K)).toBe(-3);
  });

  it('Beschreibung in Worten aus der Tabelle', () => {
    expect(positionsBeschreibung('Liegend', 'eigene', K)).toBe('Nahkampf −6, Fernkampf −6, mit Armbrust ±0');
    expect(positionsBeschreibung('Liegend', 'gegnerisch', K)).toBe('Nahkampf +6, Fernkampf −6, mit Armbrust −6');
    expect(positionsBeschreibung('Fliegend', 'eigene', K)).toBe('Nah- und Fernkampf +3');
    expect(positionsBeschreibung('Unbekannt', 'eigene', K)).toBe('');
  });
});

describe('Kampfposition Liegend aus den Zuständen', () => {
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => setzeAktivenKatalog(null, false));

  it('kein Abzug auf Proben – weder auf Kampffertigkeiten noch auf andere', () => {
    expect(getConditionMalus(liegend, { bereich: 'kampf' })).toBeNull();
    expect(getConditionMalus(liegend, { bereich: 'allgemein' })).toBeNull();
    expect(getActiveRollModifiers([liegend], 0, '', 0, false, 'kampf').filter((m) => m.source === 'condition')).toEqual([]);
  });

  it('Beschreibung und Hinweis nennen die Zahlen der Tabelle', () => {
    expect(getConditionDescription(liegend)).toBe('Kampfposition: eigene Angriffe Nahkampf −6, Fernkampf −6, mit Armbrust ±0; Angriffe gegen Liegende Nahkampf +6, Fernkampf −6, mit Armbrust −6. Im Angriffsdialog als eigene Position vorausgewählt (GRW S. 170).');
    expect(zustandswerte([liegend], K).hinweise[0]).toBe('Liegend: gilt als liegend – Angriffe gegen den Charakter Nahkampf +6, Fernkampf −6, mit Armbrust −6 (GRW S. 170)');
  });

  it('Liegend und Zustände, die als liegend gelten', () => {
    expect(liegtLautZustaenden([liegend], K)).toBe(true);
    expect(liegtLautZustaenden([{ id: 'b', key: 'Bewusstlos', level: 1 }], K)).toBe(true);
    expect(liegtLautZustaenden([{ id: 'e', key: 'Erschöpft', level: 1 }], K)).toBe(false);
    expect(liegtLautZustaenden([], K)).toBe(false);
  });

  const angriff = (waffe: string, conditions = [liegend]) => render(
    <CharacterContext.Provider value={{ state: DEFAULT_STATE, dispatch: leer, calc: { wirkungen: { liste: [], fertigkeitsBoni: {} } } as never }}>
      <AttackModal target={{ weapon: { name: waffe, damage: '1W6+3', wgs: 8 }, skillName: waffe === 'Langschwert' ? 'Klingenwaffen' : 'Schusswaffen', skillTotal: 10 }}
        conditions={conditions} splitterpunkte={0} onClose={leer} onSpendSplitterpunkt={leer} onAttackSuccess={leer} onAttackFailure={leer} />
    </CharacterContext.Provider>,
  );

  it('Angriffsdialog: Liegend ist als eigene Position vorausgewählt und zählt nur einmal', () => {
    const a = angriff('Langschwert');
    expect((screen.getByTestId('position-eigene') as HTMLSelectElement).value).toBe('Liegend');
    expect(screen.getByTestId('position-aus-zustand')).toBeTruthy();
    expect(screen.getByTestId('kampflage').textContent).toContain('eigene Position Liegend -6');
    // kein zweiter Abzug als Zustand: keine „Aktiven Abzüge“, Wurf 2W10 + 10 − 6
    expect(screen.queryByText('Aktive Abzüge:')).toBeNull();
    expect(screen.getByText(/^2W10 \+ 4/)).toBeTruthy();
    a.unmount();
  });

  it('Angriffsdialog mit Armbrust im Liegen: kein Abzug', () => {
    angriff('Leichte Armbrust');
    expect((screen.getByTestId('position-eigene') as HTMLSelectElement).value).toBe('Liegend');
    expect(screen.getByTestId('kampflage').textContent).not.toContain('eigene Position Liegend');
    expect(screen.getByText(/^2W10 \+ 10/)).toBeTruthy();
  });

  it('ohne Zustand steht die eigene Position auf Stehend', () => {
    angriff('Langschwert', []);
    expect((screen.getByTestId('position-eigene') as HTMLSelectElement).value).toBe('Stehend');
    expect(screen.queryByTestId('position-aus-zustand')).toBeNull();
  });
});

describe('Zauber gegen die Verteidigung (GRW S. 170)', () => {
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => setzeAktivenKatalog(null, false));
  const zauber = (difficultyType: string) => render(
    <CharacterContext.Provider value={{ state: DEFAULT_STATE, dispatch: leer, calc: { wirkungen: { liste: [], fertigkeitsBoni: {} } } as never }}>
      <CastSpellModal spell={{ name: 'Testzauber', school: 'Feuermagie', grade: 1, cost: '4', castTime: '3 Ticks', range: '10 m', duration: 'sofort', description: '', difficultyType } as never}
        schoolSkillTotal={10} schoolSkillName="Feuermagie" availableFocus={20} maxFO={20}
        focusState={{ exhausted: 0, channeled: 0, consumed: 0 } as never} splitterpunkte={0}
        onClose={leer} onCastSuccess={leer} onCastFailure={leer} onSpendSplitterpunkt={leer} />
    </CharacterContext.Provider>,
  );

  it('Position des Ziels wirkt wie gegnerischer Fernkampf', () => {
    const z = zauber('VTD');
    const wahl = screen.getByTestId('zauber-position-ziel').querySelector('select')!;
    expect([...wahl.options].map((o) => o.textContent)).toEqual(['Stehend', 'Kniend (-3)', 'Liegend (-6)', 'Fliegend (-3)']);
    expect(screen.queryByTestId('zauber-position-mod')).toBeNull();
    fireEvent.change(wahl, { target: { value: 'Liegend' } });
    expect(screen.getByTestId('zauber-position-mod').textContent).toBe('Ziel Liegend -6');
    z.unmount();
  });

  it('gegen GW keine Position', () => {
    zauber('GW');
    expect(screen.queryByTestId('zauber-position-ziel')).toBeNull();
  });
});
