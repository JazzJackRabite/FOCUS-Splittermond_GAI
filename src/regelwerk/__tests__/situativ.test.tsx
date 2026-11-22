/**
 * Bedingte Wirkungen beim Würfeln: passende Boni je Wurf, anklickbar im Probendialog.
 */
import React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { setzeAktivenKatalog } from '../bruecke';
import { situativeBoni, wirkungenDesCharakters } from '../wirkungen';
import { CharacterContext } from '../../context/CharacterContext';
import { RollModal } from '../../components/play/RollModal';
import { AttackModal } from '../../components/play/AttackModal';
import { DEFAULT_STATE } from '../../hooks/useCharacterState';

const b = basisAusDateien();
const K = new Katalog(b.manifest, [b.basis]);
const IDS = ['grw:staerke:feine-nase', 'grw:staerke:orientierungssinn', 'grw:meisterschaft:arkane-kunde:jaeger-des-uebernatuerlichen',
  'grw:meisterschaft:heimlichkeit:ueberraschungsangriff-i', 'grw:meisterschaft:beherrschungsmagie:einfuehlsamkeit'];
const liste = wirkungenDesCharakters(K, IDS);
const namen = (l: ReturnType<typeof situativeBoni>) => l.map(x => `${x.quelle}:${x.wert}`);

describe('Situative Boni je Wurf', () => {
  it('Probe: Fertigkeitsbonus nur für die passende Fertigkeit, „Proben zur Orientierung“ nur bei Überleben', () => {
    expect(namen(situativeBoni(K, liste, 'probe', 'Wahrnehmung'))).toEqual(['Feine Nase:2', 'Jäger des Übernatürlichen:3']);
    expect(namen(situativeBoni(K, liste, 'probe', 'Überleben'))).toEqual(['Orientierungssinn:3', 'Jäger des Übernatürlichen:3']);
    expect(namen(situativeBoni(K, liste, 'probe', 'Alchemie'))).toEqual([]);
  });
  it('Angriff: Angriffsbonus verrechenbar, Zusatzschaden nur als Hinweis', () => {
    expect(namen(situativeBoni(K, liste, 'angriff', 'Klingenwaffen'))).toEqual(['Jäger des Übernatürlichen:3', 'Überraschungsangriff I:null']);
  });
  it('Zauber: keine Angriffsboni; dauerhafte Wirkungen erscheinen nie', () => {
    const z = namen(situativeBoni(K, liste, 'zauber', 'Beherrschungsmagie'));
    expect(z).toEqual([]);
  });
});

describe('Probendialog', () => {
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => setzeAktivenKatalog(null, false));

  it('Bonus anklicken erhöht den Gesamt-Modifikator', () => {
    const calc = { wirkungen: { liste, fertigkeitsBoni: {} } } as never;
    render(
      <CharacterContext.Provider value={{ state: DEFAULT_STATE, dispatch: () => {}, calc }}>
        <RollModal skillName="Wahrnehmung" baseValue={10} onClose={() => {}} />
      </CharacterContext.Provider>,
    );
    expect(screen.getByTestId('situative-boni')).toBeTruthy();
    expect(screen.queryByText('Gesamt-Modifikator:')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Feine Nase/ }));
    expect(screen.getByText('Gesamt-Modifikator:').nextSibling?.textContent).toBe('+2');
    fireEvent.click(screen.getByRole('button', { name: /Jäger des Übernatürlichen/ }));
    expect(screen.getByText('Gesamt-Modifikator:').nextSibling?.textContent).toBe('+5');
  });

  it('Typus des Ziels wählt die Boni gegen diesen Typus aus (Untotenjäger, GRW S. 216)', () => {
    const l = [...liste, ...wirkungenDesCharakters(K, ['grw:meisterschaft:todesmagie:untotenjaeger'])];
    expect(situativeBoni(K, l, 'probe', 'Wahrnehmung').filter(x => x.typus).map(x => [x.quelle, x.typus])).toEqual([['Untotenjäger', 'Untoter']]);
    const calc = { wirkungen: { liste: l, fertigkeitsBoni: {} } } as never;
    render(
      <CharacterContext.Provider value={{ state: DEFAULT_STATE, dispatch: () => {}, calc }}>
        <RollModal skillName="Wahrnehmung" baseValue={10} onClose={() => {}} />
      </CharacterContext.Provider>,
    );
    const knopf = () => screen.queryByRole('button', { name: /Untotenjäger/ });
    expect(knopf()?.getAttribute('aria-pressed')).toBe('false');
    fireEvent.change(screen.getByLabelText('Typus des Ziels'), { target: { value: 'Untoter' } });
    expect(knopf()?.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Gesamt-Modifikator:').nextSibling?.textContent).toBe('+3');
    fireEvent.change(screen.getByLabelText('Typus des Ziels'), { target: { value: '' } });
    expect(knopf()?.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Gesamt-Modifikator:')).toBeNull();
  });

  it('Begleiter würfeln ohne die Stärken und Meisterschaften des Helden', () => {
    const calc = { wirkungen: { liste, fertigkeitsBoni: {} } } as never;
    const ziel = { weapon: { name: 'Biss', damage: '1W6', wgs: 7 }, skillName: 'Klingenwaffen', skillTotal: 10 };
    const mit = (angreifer: 'held' | 'begleiter') => render(
      <CharacterContext.Provider value={{ state: DEFAULT_STATE, dispatch: () => {}, calc }}>
        <AttackModal angreifer={angreifer} target={ziel} splitterpunkte={0} onClose={() => {}} onSpendSplitterpunkt={() => {}} onAttackSuccess={() => {}} onAttackFailure={() => {}} />
      </CharacterContext.Provider>,
    );
    const a = mit('held');
    expect(screen.queryByTestId('situative-boni')).toBeTruthy();
    a.unmount();
    mit('begleiter');
    expect(screen.queryByTestId('situative-boni')).toBeNull();
  });

  it('ohne Charakterkontext kein Abschnitt', () => {
    render(<RollModal skillName="Wahrnehmung" baseValue={10} onClose={() => {}} />);
    expect(screen.queryByTestId('situative-boni')).toBeNull();
  });
});

describe('Attributwerte als Bonus', () => {
  it('Begabter Späher: Bonus in Höhe der Intuition mit Splitterpunkt', () => {
    const l = wirkungenDesCharakters(K, ['grw:meisterschaft:wahrnehmung:begabter-spaeher']);
    const b = situativeBoni(K, l, 'probe', 'Wahrnehmung', { INT: 3 });
    expect(b.map(x => [x.quelle, x.wert])).toEqual([['Begabter Späher', 3]]);
    expect(situativeBoni(K, l, 'probe', 'Wahrnehmung').map(x => x.wert)).toEqual([null]);
  });
});
