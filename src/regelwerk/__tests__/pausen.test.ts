/**
 * Pausen nach dem Grundregelwerk: Zustände enden laut Paket (pause_ende, GRW S. 168–169), Betäubungsschaden heilt,
 * kanalisierter Schaden bleibt, bis sein Zustand aufgehoben ist (S. 173); kanalisierte Zauber enden erst in der Ruhephase (S. 196).
 */
import { describe, expect, it } from 'vitest';
import { nachPause, zustand } from '../zustaende';
import { baseCharacterReducer, DEFAULT_STATE } from '../../hooks/useCharacterState';
import type { CharacterState, HealthSlot } from '../../types';

const z = (key: string, level?: number) => ({ id: key, key, ...(level ? { level } : {}) });

describe('Zustände nach Pausen aus dem Paket', () => {
  it('Daten: Erschöpft eine Stufe, Glaubenskrise und Lahm enden nach einer Verschnaufpause', () => {
    expect(zustand('Erschöpft')?.pauseEnde).toEqual({ verschnaufpause: 'stufe', ruhephase: undefined });
    expect(zustand('Lahm')?.pauseEnde?.verschnaufpause).toBe('aufheben');
    expect(zustand('Blutend')?.pauseEnde).toBeUndefined();
  });

  it('Verschnaufpause und Ruhephase', () => {
    const vorher = [z('Erschöpft', 3), z('Lahm'), z('Glaubenskrise', 2), z('Blutend', 1)];
    expect(nachPause(vorher, 'verschnaufpause').map(x => [x.key, x.level])).toEqual([['Erschöpft', 2], ['Blutend', 1]]);
    expect(nachPause(vorher, 'verschnaufpause', undefined, 1, false).map(x => x.key)).toEqual(['Erschöpft', 'Lahm', 'Glaubenskrise', 'Blutend']);
    // Ruhephase: „eine Stufe je Verschnaufpause“ baut sie ganz ab (Auslegung)
    expect(nachPause(vorher, 'ruhephase').map(x => x.key)).toEqual(['Blutend']);
  });
});

describe('Spielstand bei Pausen und Heilung', () => {
  const slots = (...t: HealthSlot['type'][]) => t.map(type => ({ type }));
  const start = (h: HealthSlot[], focus = { exhausted: 2, channeled: 3, consumed: 4 }): CharacterState =>
    ({ ...DEFAULT_STATE, playState: { ...DEFAULT_STATE.playState, healthSlots: h, focus, channeledSpells: [{ id: 's', name: 'Zauber', cost: 3 }] as never, conditions: [z('Erschöpft', 2)] } });

  it('Verschnaufpause: Betäubung weg, kanalisierter Schaden und kanalisierte Zauber bleiben', () => {
    const s = baseCharacterReducer(start(slots('consumed', 'exhausted', 'channeled', 'empty')), { type: 'PLAY_HEAL_EXHAUSTED' } as never);
    expect(s.playState.healthSlots.map(x => x.type).sort()).toEqual(['channeled', 'consumed', 'empty', 'empty']);
    expect(s.playState.focus).toEqual({ exhausted: 0, channeled: 3, consumed: 4 });
    expect(s.playState.channeledSpells).toHaveLength(1);
    expect(s.playState.conditions).toEqual([z('Erschöpft', 1)]);
  });

  it('Ruhephase: kanalisierter Schaden bleibt, kanalisierte Zauber enden', () => {
    const s = baseCharacterReducer(start(slots('consumed', 'exhausted', 'channeled', 'empty')), { type: 'PLAY_REST_HEAL', payload: { konAmount: 1, wilAmount: 1 } } as never);
    expect(s.playState.healthSlots.filter(x => x.type === 'channeled')).toHaveLength(1);
    expect(s.playState.healthSlots.filter(x => x.type === 'exhausted')).toHaveLength(0);
    expect(s.playState.channeledSpells).toEqual([]);
    expect(s.playState.conditions).toEqual([]);
  });

  it('kanalisierter Schaden wird nach Aufheben seines Zustands zu Betäubung', () => {
    const s = baseCharacterReducer(start(slots('consumed', 'channeled', 'channeled', 'empty')), { type: 'PLAY_KANALISIERT_FREIGEBEN', payload: { amount: 1 } } as never);
    expect(s.playState.healthSlots.map(x => x.type).filter(t => t !== 'empty' && t !== 'consumed').sort()).toEqual(['channeled', 'exhausted']);
  });
});
