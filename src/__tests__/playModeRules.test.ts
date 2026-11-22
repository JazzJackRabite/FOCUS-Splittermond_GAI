import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Katalog } from '../regelwerk/katalog';
import { setzeAktivenKatalog } from '../regelwerk/bruecke';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';

// Ob ein Zauber endet, wenn seine zusätzlichen Lebenspunkte aufgebraucht sind, steht im Regelpaket
beforeAll(() => { const b = basisAusDateien(); setzeAktivenKatalog(new Katalog(b.manifest, [b.basis]), false); });
afterAll(() => setzeAktivenKatalog(null, false));
import { useCharacterState } from '../hooks/useCharacterState';
import { renderHook, act } from '@testing-library/react';

describe('Play Mode Rules & Health/Focus Engine (Splittermond GRW)', () => {
  it('Lebenspunkt-Leiste: 5 Gesundheitsstufen + eine Stufe bis zum Tod + 1 (tot erst bei MEHR als einer Stufe unter Todgeweiht, GRW S. 172)', () => {
    const { result } = renderHook(() => useCharacterState());
    const maxLP = 8; // e.g. GK 5 + KON 3

    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 8, maxFocus: 16, maxSplitter: 3 },
      });
    });

    // 5 Stufen × 8 + 1 Stufe × 8 + 1 = 49 Kästchen
    expect(result.current.state.playState.healthSlots).toHaveLength(49);
    expect(result.current.state.playState.healthSlots.every((s) => s.type === 'empty')).toBe(true);
  });

  it('normalizes health slots strictly: consumed -> exhausted -> channeled -> empty', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 8, maxFocus: 16, maxSplitter: 3 },
      });
    });

    // Apply 2 exhausted damage, then 2 consumed damage, then 1 channeled
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'exhausted', maxLP: 8, amount: 2 } });
    });
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 2 } });
    });
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'channeled', maxLP: 8, amount: 1 } });
    });

    const slots = result.current.state.playState.healthSlots;
    // Indices 0..1 must be consumed
    expect(slots[0].type).toBe('consumed');
    expect(slots[1].type).toBe('consumed');
    // Indices 2..3 must be exhausted
    expect(slots[2].type).toBe('exhausted');
    expect(slots[3].type).toBe('exhausted');
    // Index 4 must be channeled
    expect(slots[4].type).toBe('channeled');
    // Remaining slots empty
    expect(slots[5].type).toBe('empty');
  });

  it('applies Splittermond damage overflow rule when all health slots are full', () => {
    const { result } = renderHook(() => useCharacterState());
    // Small health pool for testing overflow: maxLP = 2 -> 13 slots
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 2, maxFocus: 10, maxSplitter: 3 },
      });
    });

    // Fill all 13 slots with exhausted damage
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'exhausted', maxLP: 2, amount: 13 } });
    });

    expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'exhausted')).toHaveLength(13);

    // Taking more exhausted damage overflows and converts the last exhausted slot into consumed damage!
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'exhausted', maxLP: 2, amount: 1 } });
    });

    expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(1);
    expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'exhausted')).toHaveLength(12);
  });

  it('automatically adds Bewusstlos condition when character is fully filled with non-empty damage', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 2, maxFocus: 10, maxSplitter: 3 },
      });
    });

    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'exhausted', maxLP: 2, amount: 13 } });
    });

    const conditions = result.current.state.playState.conditions;
    expect(conditions.some((c) => c.key === 'Bewusstlos')).toBe(true);
  });

  it('tracks dying levels (Todgeweiht / Sterbend) and death accurately', () => {
    const { result } = renderHook(() => useCharacterState());
    // maxLP = 2 => 12 slots total
    // Level 1: 0..1 (Unverletzt)
    // Level 2: 2..3 (Angeschlagen)
    // Level 3: 4..5 (Schwer verletzt)
    // Level 4: 6..7 (Kritisch)
    // Level 5 (Todgeweiht): 8..9
    // Level 6 (Tod): 10..11
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 2, maxFocus: 10, maxSplitter: 3 },
      });
    });

    // 8 consumed damage fills up to end of Level 4
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 2, amount: 8 } });
    });
    expect(result.current.state.playState.dyingLevel).toBe(0);

    // 1 more consumed damage enters Todgeweiht (index 8) -> dyingLevel becomes 2 (Sterbend 2)
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 2, amount: 1 } });
    });
    expect(result.current.state.playState.dyingLevel).toBe(2);
    expect(result.current.state.playState.conditions.some((c) => c.key === 'Sterbend' && c.level === 2)).toBe(true);

    // 1 more consumed damage completes Todgeweiht (index 9) -> enters Tod range -> dyingLevel becomes 3
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 2, amount: 1 } });
    });
    expect(result.current.state.playState.dyingLevel).toBe(3);
    // alle LP auf Todgeweiht verloren: zusätzlich bewusstlos (Paket: zustaende_bei_allen_lp)
    expect(result.current.state.playState.conditions.some((c) => c.key === 'Bewusstlos')).toBe(true);

    // genau eine Stufe darunter (2 Punkte): noch nicht tot – erst MEHR als eine Stufe
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 2, amount: 2 } });
    });
    expect(result.current.state.playState.dyingLevel).toBe(3);
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 2, amount: 1 } });
    });
    expect(result.current.state.playState.dyingLevel).toBe(4);
    expect(result.current.state.playState.conditions.some((c) => c.key === 'Tod')).toBe(true);
  });

  it('handles Verschnaufpause (short rest) healing rules', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 8, maxFocus: 16, maxSplitter: 3 },
      });
      // Add damage & focus spend
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'exhausted', maxLP: 8, amount: 4 } });
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 2 } });
      result.current.dispatch({ type: 'PLAY_SPEND_FOCUS', payload: { kind: 'exhausted', amount: 5 } });
      result.current.dispatch({ type: 'PLAY_ADD_CONDITION', payload: { id: 'c1', key: 'Erschöpft', level: 2 } });
      result.current.dispatch({ type: 'PLAY_ADD_CONDITION', payload: { id: 'c2', key: 'Glaubenskrise' } });
    });

    // Execute Verschnaufpause
    act(() => {
      result.current.dispatch({
        type: 'PLAY_HEAL_EXHAUSTED',
        payload: {
          healAllStun: true,
          healAllExhaustedFocus: true,
          exhaustReduction: 1,
          removeConditions: true,
        },
      });
    });

    // All exhausted damage removed, 2 consumed remain
    expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(2);
    expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'exhausted')).toHaveLength(0);
    // Exhausted focus healed to 0
    expect(result.current.state.playState.focus.exhausted).toBe(0);
    // Erschöpft reduced from 2 to 1
    const erschöpft = result.current.state.playState.conditions.find((c) => c.key === 'Erschöpft');
    expect(erschöpft?.level).toBe(1);
    // Glaubenskrise removed
    expect(result.current.state.playState.conditions.some((c) => c.key === 'Glaubenskrise')).toBe(false);
  });

  it('handles Ruhephase (extended rest) healing rules (KONx2 LP, WILx2 FO)', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 8, maxFocus: 16, maxSplitter: 3 },
      });
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 6 } });
      result.current.dispatch({ type: 'PLAY_SPEND_FOCUS', payload: { kind: 'consumed', amount: 8 } });
      result.current.dispatch({ type: 'PLAY_ADD_CONDITION', payload: { id: 'c1', key: 'Erschöpft', level: 3 } });
    });

    // KON = 2 -> heals 4 consumed LP, WIL = 3 -> heals 6 consumed FO
    act(() => {
      result.current.dispatch({
        type: 'PLAY_REST_HEAL',
        payload: { konAmount: 2, wilAmount: 3 },
      });
    });

    // 6 consumed - 4 healed = 2 consumed remaining
    expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(2);
    // 8 consumed FO - 6 healed = 2 consumed FO remaining
    expect(result.current.state.playState.focus.consumed).toBe(2);
    // All Erschöpft conditions cleared
    expect(result.current.state.playState.conditions.some((c) => c.key === 'Erschöpft')).toBe(false);
  });

  it('handles channeled spells and cancelling channeled focus', () => {
    const { result } = renderHook(() => useCharacterState());

    act(() => {
      result.current.dispatch({
        type: 'PLAY_ADD_CHANNELED_SPELL',
        payload: { id: 's1', name: 'Wahrer Blick', channeledFocus: 4 },
      });
      result.current.dispatch({
        type: 'PLAY_SPEND_FOCUS',
        payload: { kind: 'channeled', amount: 4 },
      });
    });

    expect(result.current.state.playState.focus.channeled).toBe(4);
    expect(result.current.state.playState.channeledSpells).toHaveLength(1);

    // Cancelling channeling shifts the focus from channeled to exhausted
    act(() => {
      result.current.dispatch({
        type: 'PLAY_CANCEL_CHANNELED_SPELL',
        payload: { id: 's1' },
      });
    });

    expect(result.current.state.playState.focus.channeled).toBe(0);
    expect(result.current.state.playState.focus.exhausted).toBe(4);
    expect(result.current.state.playState.channeledSpells).toHaveLength(0);
  });

  it('absorbs damage using temporary HP before health slots are damaged', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 8, maxFocus: 16, maxSplitter: 3 },
      });
      result.current.dispatch({
        type: 'PLAY_ADD_TEMP_HP',
        payload: { amount: 2 },
      });
    });

    expect(result.current.state.playState.tempHP).toBe(2);

    // 1st damage is absorbed by tempHP
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 1 } });
    });

    expect(result.current.state.playState.tempHPUsed).toBe(1);
    expect(result.current.state.playState.healthSlots.every((s) => s.type === 'empty')).toBe(true);

    // 2nd damage consumes last tempHP and clears tempHP
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 1 } });
    });

    expect(result.current.state.playState.tempHP).toBe(0);
    expect(result.current.state.playState.healthSlots.every((s) => s.type === 'empty')).toBe(true);

    // 3rd damage actually enters health slots
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 1 } });
    });

    expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(1);
  });

  it('GRW S. 235: Lebenskraft stärken ends automatically and releases channeled focus when all tempHP are depleted', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 8, maxFocus: 16, maxSplitter: 3 },
      });
      // Cast Lebenskraft stärken: binds 6 channeled focus, grants 6 temp HP
      result.current.dispatch({
        type: 'PLAY_CAST_SPELL',
        payload: {
          exhaustedFocus: 0,
          channeledFocus: 6,
          consumedFocus: 2,
          channeledSpell: {
            id: 'cs-temp',
            name: 'Lebenskraft stärken',
            channeledFocus: 6,
          },
        },
      });
      result.current.dispatch({
        type: 'PLAY_ADD_TEMP_HP',
        payload: { amount: 6 },
      });
    });

    expect(result.current.state.playState.tempHP).toBe(6);
    expect(result.current.state.playState.focus.channeled).toBe(6);
    expect(result.current.state.playState.channeledSpells).toHaveLength(1);

    // Take 4 damage: absorbed by tempHP, spell remains active
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 4 } });
    });
    expect(result.current.state.playState.tempHPUsed).toBe(4);
    expect(result.current.state.playState.channeledSpells).toHaveLength(1);
    expect(result.current.state.playState.focus.channeled).toBe(6);

    // Take another 3 damage: 2 absorbed, 1 penetrates to healthSlots, tempHP fully consumed, spell auto-ends!
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 8, amount: 3 } });
    });
    expect(result.current.state.playState.tempHP).toBe(0);
    expect(result.current.state.playState.channeledSpells).toHaveLength(0); // auto-ended!
    expect(result.current.state.playState.focus.channeled).toBe(0); // released!
    expect(result.current.state.playState.focus.exhausted).toBe(6); // converted to exhausted focus!
    expect(result.current.state.playState.healthSlots.filter((s) => s.type === 'consumed')).toHaveLength(1);
  });

  it('slides up damage (Schaden rutscht auf) according to Splittermond rules when damage is removed', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 4, maxFocus: 10, maxSplitter: 3 },
      });
    });

    // Add 2 consumed damage, 2 exhausted damage, 1 channeled damage
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 4, amount: 2 } });
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'exhausted', maxLP: 4, amount: 2 } });
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'channeled', maxLP: 4, amount: 1 } });
    });

    // Initial state: [consumed, consumed, exhausted, exhausted, channeled, empty...]
    let slots = result.current.state.playState.healthSlots;
    expect(slots[0].type).toBe('consumed');
    expect(slots[1].type).toBe('consumed');
    expect(slots[2].type).toBe('exhausted');
    expect(slots[3].type).toBe('exhausted');
    expect(slots[4].type).toBe('channeled');
    expect(slots[5].type).toBe('empty');

    // Remove 1 consumed damage (e.g. clicking a consumed box)
    act(() => {
      result.current.dispatch({ type: 'PLAY_UNDO_DAMAGE', payload: { kind: 'consumed', amount: 1, maxLP: 4 } });
    });

    // The remaining damage must slide up (aufrutschen):
    // 1 consumed, 2 exhausted, 1 channeled -> slots[0]=consumed, slots[1,2]=exhausted, slots[3]=channeled, slots[4]=empty
    slots = result.current.state.playState.healthSlots;
    expect(slots[0].type).toBe('consumed');
    expect(slots[1].type).toBe('exhausted');
    expect(slots[2].type).toBe('exhausted');
    expect(slots[3].type).toBe('channeled');
    expect(slots[4].type).toBe('empty');

    // Remove 1 exhausted damage
    act(() => {
      result.current.dispatch({ type: 'PLAY_UNDO_DAMAGE', payload: { kind: 'exhausted', amount: 1, maxLP: 4 } });
    });

    // The channeled damage slides up:
    // 1 consumed, 1 exhausted, 1 channeled -> slots[0]=consumed, slots[1]=exhausted, slots[2]=channeled, slots[3]=empty
    slots = result.current.state.playState.healthSlots;
    expect(slots[0].type).toBe('consumed');
    expect(slots[1].type).toBe('exhausted');
    expect(slots[2].type).toBe('channeled');
    expect(slots[3].type).toBe('empty');
  });

  it('recalculates dyingLevel and removes Sterbend condition when consumed damage in Todgeweiht is removed', () => {
    const { result } = renderHook(() => useCharacterState());
    // maxLP = 2 -> 12 slots. Todgeweiht is index 8..9.
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 2, maxFocus: 10, maxSplitter: 3 },
      });
    });

    // Fill with 9 consumed damage so 1 consumed damage enters Todgeweiht (index 8)
    act(() => {
      result.current.dispatch({ type: 'PLAY_TAKE_DAMAGE', payload: { kind: 'consumed', maxLP: 2, amount: 9 } });
    });

    expect(result.current.state.playState.dyingLevel).toBe(2);
    expect(result.current.state.playState.conditions.some((c) => c.key === 'Sterbend')).toBe(true);

    // Heal 1 consumed damage (removes the slot from Todgeweiht)
    act(() => {
      result.current.dispatch({ type: 'PLAY_UNDO_DAMAGE', payload: { kind: 'consumed', amount: 1, maxLP: 2 } });
    });

    expect(result.current.state.playState.dyingLevel).toBe(0);
    expect(result.current.state.playState.conditions.some((c) => c.key === 'Sterbend')).toBe(false);
  });

  it('slides up focus when focus points are recovered', () => {
    const { result } = renderHook(() => useCharacterState());
    act(() => {
      result.current.dispatch({
        type: 'PLAY_RESET',
        payload: { maxLP: 8, maxFocus: 12, maxSplitter: 3 },
      });
    });

    // Spend 2 consumed, 2 channeled, 2 exhausted focus
    act(() => {
      result.current.dispatch({ type: 'PLAY_SPEND_FOCUS', payload: { kind: 'consumed', amount: 2 } });
      result.current.dispatch({ type: 'PLAY_SPEND_FOCUS', payload: { kind: 'channeled', amount: 2 } });
      result.current.dispatch({ type: 'PLAY_SPEND_FOCUS', payload: { kind: 'exhausted', amount: 2 } });
    });

    expect(result.current.state.playState.focus.consumed).toBe(2);
    expect(result.current.state.playState.focus.channeled).toBe(2);
    expect(result.current.state.playState.focus.exhausted).toBe(2);

    // Recover 1 consumed focus (simulating click on consumed focus slot)
    act(() => {
      result.current.dispatch({ type: 'PLAY_SPEND_FOCUS', payload: { kind: 'consumed', amount: -1 } });
    });

    expect(result.current.state.playState.focus.consumed).toBe(1);
    expect(result.current.state.playState.focus.channeled).toBe(2);
    expect(result.current.state.playState.focus.exhausted).toBe(2);
  });
});
