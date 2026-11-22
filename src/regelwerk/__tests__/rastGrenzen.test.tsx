/**
 * Grenzen der Rast aus dem Paket:
 * - Zustände mit keine_natuerliche_heilung (im GRW: Sterbend) verhindern, dass Pausen Lebenspunkte heilen; die Sterbe-Stufe bleibt.
 * - ruheregeln.ruhephase.je_tag: höchstens so viele Ruhephasen pro Tag; „Neuer Tag“ setzt den Zähler zurück; mehr sperrt der
 *   Editor (mit Hausregeln nur eine Warnung).
 */
import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ohneNatuerlicheHeilung, zustand } from '../zustaende';
import { ruheregeln } from '../spielwirkungen';
import { ruhephaseBegleiter, verschnaufpauseBegleiter } from '../begleiterRast';
import { baseCharacterReducer, DEFAULT_STATE } from '../../hooks/useCharacterState';
import { RestSection } from '../../components/play/RestSection';
import { setzeAktivenKatalog } from '../bruecke';
import { setzeHausregeln } from '../../fundament/hausregeln';
import { basisAusDateien } from './hilfen';
import { Katalog } from '../katalog';
import type { CharacterState, HealthSlot } from '../../types';

const b = basisAusDateien(); const K = new Katalog(b.manifest, [b.basis]);
beforeAll(() => setzeAktivenKatalog(K, false));
afterAll(() => { setzeAktivenKatalog(null, false); setzeHausregeln(false); });

const z = (key: string, level?: number) => ({ id: key, key, ...(level ? { level } : {}) });
const slots = (...t: HealthSlot['type'][]) => t.map((type) => ({ type }));
const start = (conditions: ReturnType<typeof z>[], dyingLevel: 0 | 2 | 3 = 0): CharacterState => ({
  ...DEFAULT_STATE,
  playState: { ...DEFAULT_STATE.playState, healthSlots: slots('consumed', 'consumed', 'exhausted', 'empty'), focus: { exhausted: 1, channeled: 0, consumed: 2 }, conditions, dyingLevel },
});

describe('Keine natürliche Heilung', () => {
  it('Daten: genau die Zustände mit Beleg im Paket', () => {
    expect(zustand('Sterbend', K)?.ohneNatuerlicheHeilung).toMatch(/natürlicher Heilung/);
    expect(zustand('Blutend', K)?.ohneNatuerlicheHeilung).toBeUndefined();
    expect(ohneNatuerlicheHeilung([z('Sterbend', 2), z('Blutend', 1)], K)).toEqual(['Sterbend']);
  });

  it('Ruhephase: kein Lebenspunkt heilt, Sterbe-Stufe bleibt, Fokus regeneriert', () => {
    const s = baseCharacterReducer(start([z('Sterbend', 2)], 2), { type: 'PLAY_REST_HEAL', payload: { konAmount: 4, wilAmount: 4, lpHealAmount: 4, foHealAmount: 4 } });
    expect(s.playState.healthSlots.map((x) => x.type)).toEqual(['consumed', 'consumed', 'exhausted', 'empty']);
    expect(s.playState.dyingLevel).toBe(2);
    expect(s.playState.focus).toEqual({ exhausted: 0, channeled: 0, consumed: 0 });
  });

  it('ohne solchen Zustand heilt die Ruhephase genau die übergebene Menge und setzt die Sterbe-Stufe zurück', () => {
    const s = baseCharacterReducer(start([], 2), { type: 'PLAY_REST_HEAL', payload: { konAmount: 1, wilAmount: 1, lpHealAmount: 1, foHealAmount: 1 } });
    expect(s.playState.healthSlots.filter((x) => x.type === 'consumed')).toHaveLength(1);
    expect(s.playState.healthSlots.filter((x) => x.type === 'exhausted')).toHaveLength(0);
    expect(s.playState.dyingLevel).toBe(0);
    expect(s.playState.focus.consumed).toBe(1);
  });

  it('Verschnaufpause: Betäubungsschaden bleibt', () => {
    const s = baseCharacterReducer(start([z('Sterbend', 2)], 2), { type: 'PLAY_HEAL_EXHAUSTED' });
    expect(s.playState.healthSlots.filter((x) => x.type === 'exhausted')).toHaveLength(1);
    expect(s.playState.focus.exhausted).toBe(0);
  });

  it('Begleiter: gleiche Sperre in beiden Pausen', () => {
    const zs = { schaden: 5, betaeubung: 2, zustaende: [z('Sterbend', 2)] };
    const r = ruhephaseBegleiter(K, 'tier', zs, { KON: '3', WIL: '2' });
    expect(r.zustand.schaden).toBe(5);
    expect(r.zustand.betaeubung).toBe(2);
    expect(r.hinweis).toMatch(/keine natürliche Heilung \(Sterbend\)/);
    expect(verschnaufpauseBegleiter(zs, K).zustand.betaeubung).toBe(2);
    expect(ruhephaseBegleiter(K, 'tier', { schaden: 5 }, { KON: '3', WIL: '2' }).zustand.schaden).toBeLessThan(5);
  });
});

describe('Ruhephasen pro Tag', () => {
  it('Daten: Höchstzahl aus dem Paket', () => {
    expect(ruheregeln(K).ruhephasenJeTag).toBeGreaterThan(0);
  });

  it('Reducer zählt Ruhephasen, „Neuer Tag“ setzt zurück', () => {
    let s = start([]);
    s = baseCharacterReducer(s, { type: 'PLAY_REST_HEAL', payload: { konAmount: 1, wilAmount: 1 } });
    s = baseCharacterReducer(s, { type: 'PLAY_REST_HEAL', payload: { konAmount: 1, wilAmount: 1 } });
    expect(s.playState.ruhephasenTag).toBe(2);
    s = baseCharacterReducer(s, { type: 'PLAY_NEUER_TAG' });
    expect(s.playState.ruhephasenTag).toBe(0);
  });

  const props = { kon: 2, wil: 2, strengthsList: [], weaknessesList: [], masteries: {}, moonSign: '' };

  it('Ansicht: Zähler, Sperre über der Höchstzahl, Hausregeln lassen sie zu', () => {
    const max = ruheregeln(K).ruhephasenJeTag;
    const ruhe = vi.fn(); const neu = vi.fn();
    const { rerender } = render(<RestSection {...props} onVerschnaufpause={vi.fn()} onRuhephase={ruhe} ruhephasenHeute={max - 1} onNeuerTag={neu} />);
    expect(screen.getByText(`Ruhephasen heute: ${max - 1} von ${max}`)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Ruhephase durchführen/ }));
    expect(ruhe).toHaveBeenCalledTimes(1);
    rerender(<RestSection {...props} onVerschnaufpause={vi.fn()} onRuhephase={ruhe} ruhephasenHeute={max} onNeuerTag={neu} />);
    fireEvent.click(screen.getByRole('button', { name: /Ruhephase durchführen/ }));
    expect(ruhe).toHaveBeenCalledTimes(1);
    setzeHausregeln(true);
    fireEvent.click(screen.getByRole('button', { name: /Ruhephase durchführen/ }));
    expect(ruhe).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Tag' }));
    expect(neu).toHaveBeenCalledTimes(1);
  });

  it('Ansicht: Hinweis, solange natürliche Heilung gesperrt ist', () => {
    render(<RestSection {...props} onVerschnaufpause={vi.fn()} onRuhephase={vi.fn()} ohneHeilung={['Sterbend']} />);
    expect(screen.getByText(/Keine natürliche Heilung \(Sterbend\)/)).toBeDefined();
  });
});
