/**
 * Gemeinsame Rast in „Regeneration & Pausen“: „Begleiter rasten mit“ wendet Ruhephase und Verschnaufpause auf alle
 * Begleiter an (Werte aus dem berechneten Wertekasten); ohne Häkchen bleiben sie unverändert. Dazu der Reducer.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { baseCharacterReducer, DEFAULT_STATE } from '../../hooks/useCharacterState';
import { CharacterContext } from '../../context/CharacterContext';
import { RastMitBegleitern } from '../../components/begleiter/rast';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import type { CharacterState } from '../../types';

const b = basisAusDateien(); const K = new Katalog(b.manifest, [b.basis]);
vi.mock('../RegelwerkContext', () => ({ useRegelwerk: () => ({ katalog: K }) }));

const wolf = { id: 'grw:kreatur:wolf', art: 'tier' as const, name: 'Wolf', rufname: 'Grauzahn', zustand: { schaden: 10, betaeubung: 2, fokus: { erschoepft: 1, verzehrt: 2 } } };
const pferd = { id: 'grw:kreatur:pferd', art: 'tier' as const, name: 'Pferd', zustand: { betaeubung: 3 } };

let stand: CharacterState;
type Held = { ruhe: (lp: number, fo: number) => void; pause: () => void };
const Rahmen: React.FC<{ held: Held }> = ({ held }) => {
  const [state, dispatch] = React.useReducer(baseCharacterReducer, { ...DEFAULT_STATE, begleiter: [wolf, pferd] });
  stand = state;
  return (
    <CharacterContext.Provider value={{ state, dispatch, calc: {} as never }}>
      <RastMitBegleitern kon={2} wil={2} strengthsList={[]} weaknessesList={[]} masteries={{}} moonSign="" onRuhephase={held.ruhe} onVerschnaufpause={held.pause} />
    </CharacterContext.Provider>
  );
};

describe('Gemeinsame Rast', () => {
  it('Ruhephase mit Häkchen: Abenteurer und alle Begleiter rasten', () => {
    const held = { ruhe: vi.fn(), pause: vi.fn() };
    render(<Rahmen held={held} />);
    const haken = screen.getByLabelText('Begleiter rasten mit (2)') as HTMLInputElement;
    expect(haken.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Ruhephase durchführen/ })); fireEvent.click(screen.getByRole('button', { name: 'Durchführen' }));
    expect(held.ruhe).toHaveBeenCalledTimes(1);
    // Wolf aus dem GRW: doppelte Konstitution an Lebenspunkten zurück
    const kon = Number(K.get('grw:kreatur:wolf')!.daten.attribute.KON);
    expect(stand.begleiter![0].zustand).toMatchObject({ schaden: 10 - 2 * kon, betaeubung: 0, fokus: { erschoepft: 0 } });
    expect(stand.begleiter![1].zustand).toMatchObject({ betaeubung: 0 });
  });

  it('Verschnaufpause ohne Häkchen: nur der Abenteurer', () => {
    const held = { ruhe: vi.fn(), pause: vi.fn() };
    render(<Rahmen held={held} />);
    fireEvent.click(screen.getByLabelText('Begleiter rasten mit (2)'));
    fireEvent.click(screen.getByRole('button', { name: /Verschnaufpause durchführen/ })); fireEvent.click(screen.getByRole('button', { name: 'Durchführen' }));
    expect(held.pause).toHaveBeenCalledTimes(1);
    expect(stand.begleiter![0].zustand).toEqual(wolf.zustand);
  });

  it('Verschnaufpause mit Häkchen: Betäubung und erschöpfter Fokus der Begleiter', () => {
    const held = { ruhe: vi.fn(), pause: vi.fn() };
    render(<Rahmen held={held} />);
    fireEvent.click(screen.getByRole('button', { name: /Verschnaufpause durchführen/ })); fireEvent.click(screen.getByRole('button', { name: 'Durchführen' }));
    expect(stand.begleiter![0].zustand).toMatchObject({ schaden: 10, betaeubung: 0, fokus: { erschoepft: 0, verzehrt: 2 } });
  });

  it('Reducer: Zustände mehrerer Begleiter je Stelle setzen (auch zwei gleiche Tiere)', () => {
    let s: CharacterState = { ...DEFAULT_STATE, begleiter: [wolf, { ...wolf, rufname: 'Zweiter' }] };
    s = baseCharacterReducer(s, { type: 'BEGLEITER_ZUSTAENDE_SETZEN', payload: [{ index: 1, zustand: { schaden: 1 } }] });
    expect(s.begleiter!.map(x => x.zustand)).toEqual([wolf.zustand, { schaden: 1 }]);
  });
});
