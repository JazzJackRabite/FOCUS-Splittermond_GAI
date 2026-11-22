import { fokusDurchZustaende, zustandswerte } from '../regelwerk/zustandswerte';
import { alleZustaende } from '../regelwerk/zustaende';
import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import type {
  Begleiter,
  CharacterAction,
  PlayState,
  Spell,
  ChanneledSpell,
  StatusCondition,
} from '../types';
import { useCharacter } from './CharacterContext';
import { aktiverKatalog } from '../regelwerk/bruecke';
import { lpWirkung, wirksameZustaende } from '../regelwerk/zauberwerte';
import { grossmeisterAb } from '../regelwerk/bruecke';
import { generateId } from '../utils/id';

import { isSkillAffectedByBehinderung } from '../utils/conditionModifiers';
import {
  executeSpellDamageRoll,
  getActiveSpellModifiers,
  type ParsedSpellDamage,
} from '../utils/magicRules';
import {
  DiceLog,
  type LogEntry,
  type RollEntry,
  type RestLogEntry,
  type ActionLogEntry,
} from '../components/play/DiceLog';
import { RollModal } from '../components/play/RollModal';
import {
  CastSpellModal,
  type CastSpellSuccessResult,
  type CastSpellFailureResult,
} from '../components/play/CastSpellModal';
import {
  AttackModal,
  type AttackWeaponData,
  type AttackTargetConfig,
  type AttackSuccessResult,
  type AttackFailureResult,
} from '../components/play/AttackModal';
import {
  RestResultModal,
  type RestDetailItem,
  type RestResultModalData,
} from '../components/play/RestResultModal';
import { grwFertigkeitsattribute } from '../regelwerk/grwListen';

export interface RollModalConfig {
  skillName: string;
  baseValue: number;
  onSuccess?: () => void;
  successLabel?: string;
  initialSchwierigkeit?: number;
  onFailure?: () => void;
  probeOutcomeLabels?: { success: string; failure: string };
  behinderung?: number;
  /** Großmeister in dieser Fertigkeit (ab 15 Fertigkeitspunkten, GRW S. 92) */
  grossmeister?: boolean;
}

export type RestResultModalState = RestResultModalData;

export interface PlaySessionContextType {
  // Protocol & history
  protocolHistory: LogEntry[];
  setProtocolHistory: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  playHistory: { playState: PlayState; protocolHistory: LogEntry[]; begleiter?: Begleiter['zustand'][] }[];
  pushPlayHistory: (currentPlayState?: PlayState, currentProtocol?: LogEntry[]) => void;
  handleUndoPlay: () => void;
  dispatchWithHistory: (action: CharacterAction) => void;
  logAndDispatch: (
    action: CharacterAction,
    logEntryData?: {
      category: ActionLogEntry['category'];
      title: string;
      description?: string;
      badge?: ActionLogEntry['badge'];
    }
  ) => void;
  handleRecordRoll: (entry: RollEntry) => void;
  /** Protokolleintrag ohne Charakter-Aktion (z. B. Begleiter) */
  logEintrag: (logEntryData: { category: ActionLogEntry['category']; title: string; description?: string; badge?: ActionLogEntry['badge'] }) => void;
  handleQuickRoll: (sides: number, diceCount: number, label: string, modifier?: number) => void;
  handleRollDiceFormula: (formula: string, label: string) => void;

  // Modals management
  rollConfig: RollModalConfig | null;
  setRollConfig: React.Dispatch<React.SetStateAction<RollModalConfig | null>>;
  castSpellTarget: Spell | null;
  setCastSpellTarget: React.Dispatch<React.SetStateAction<Spell | null>>;
  attackTarget: AttackTargetConfig | null;
  setAttackTarget: React.Dispatch<React.SetStateAction<AttackTargetConfig | null>>;
  restResultModal: RestResultModalState | null;
  setRestResultModal: React.Dispatch<React.SetStateAction<RestResultModalState | null>>;

  // Roll triggers
  openRollForAttr: (attrKey: string) => void;
  openRollForSkill: (skill: string, onSuccess?: () => void, successLabel?: string) => void;
  openRollForCombat: (skill: string) => void;
  openRollForWeapon: (
    weaponName: string,
    skill: string,
    customBonus?: number,
    targetVTD?: number,
    weaponData?: Partial<AttackWeaponData>
  ) => void;

  // Spell handlers
  handleOpenCastSpell: (spell: Spell) => void;
  handleCastSpellSuccess: (castResult: CastSpellSuccessResult) => void;
  handleCastSpellFailure: (failureResult: CastSpellFailureResult) => void;
  handleCancelChanneledSpell: (spell: ChanneledSpell) => void;
  handleQuickSpellDamageRoll: (spell: Spell, damageInfo: ParsedSpellDamage) => void;

  // Rest handlers
  handleVerschnaufpause: (options?: {
    healAllStun?: boolean;
    stunAmount?: number;
    healAllExhaustedFocus?: boolean;
    exhaustedFocusAmount?: number;
    exhaustReduction?: number;
    removeConditions?: boolean;
  }) => void;
  handleRuhephase: (konAmount: number, wilAmount: number) => void;

  // UI helpers
  spOption: number;
  setSpOption: React.Dispatch<React.SetStateAction<number>>;
  damageAmount: number;
  setDamageAmount: React.Dispatch<React.SetStateAction<number>>;
  focusAmount: number;
  setFocusAmount: React.Dispatch<React.SetStateAction<number>>;
  tempHPInput: number;
  setTempHPInput: React.Dispatch<React.SetStateAction<number>>;
  selectedCondition: string;
  setSelectedCondition: React.Dispatch<React.SetStateAction<string>>;
  conditionLevel: number;
  setConditionLevel: React.Dispatch<React.SetStateAction<number>>;
  conditionNote: string;
  setConditionNote: React.Dispatch<React.SetStateAction<string>>;
}

const PlaySessionContext = createContext<PlaySessionContextType | null>(null);

export const PlaySessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { state, dispatch, calc } = useCharacter();
  const { playState, mode } = state;
  const {
    maxLP,
    maxFO,
    currentWoundPenalty,
    currentHealthLevelName,
    currentAttributes,
    getSkillTotal,
    getSkillValue,
    splinterPoints: maxSplitter,
    totalHandicap,
  } = calc;

  const { healthSlots, focus, splitterPoints, conditions = [] } = playState;

  // State
  const [protocolHistory, setProtocolHistory] = useState<LogEntry[]>([]);
  const [playHistory, setPlayHistory] = useState<{ playState: PlayState; protocolHistory: LogEntry[]; begleiter?: Begleiter['zustand'][] }[]>([]);
  const [rollConfig, setRollConfig] = useState<RollModalConfig | null>(null);
  const [castSpellTarget, setCastSpellTarget] = useState<Spell | null>(null);
  const [attackTarget, setAttackTarget] = useState<AttackTargetConfig | null>(null);
  // Werte für Zusatzschaden aus Manövern (Stärke, Intuition, Geschwindigkeit)
  const angreiferWerte = useMemo(
    () => ({ STA: currentAttributes.STA ?? 0, INT: currentAttributes.INT ?? 0, GSW: calc.derived?.GSW ?? 0 }),
    [currentAttributes.STA, currentAttributes.INT, calc.derived?.GSW]
  );
  const [restResultModal, setRestResultModal] = useState<RestResultModalState | null>(null);
  const [spOption, setSpOption] = useState(0);

  const [selectedCondition, setSelectedCondition] = useState(() => alleZustaende()[0]);
  const [conditionLevel, setConditionLevel] = useState(1);
  const [conditionNote, setConditionNote] = useState('');
  const [damageAmount, setDamageAmount] = useState(1);
  const [focusAmount, setFocusAmount] = useState(1);
  const [tempHPInput, setTempHPInput] = useState(1);

  const pushPlayHistory = (currentPlayState: PlayState = playState, currentProtocol: LogEntry[] = protocolHistory) => {
    // Spielzustand der Begleiter mitsichern, damit Rückgängig auch Schaden, Heilung und Rast der Begleiter zurücknimmt
    const begleiter = (state.begleiter ?? []).map((b) => b.zustand);
    setPlayHistory((prev) => [{ playState: currentPlayState, protocolHistory: currentProtocol, begleiter }, ...prev].slice(0, 50));
  };

  const handleUndoPlay = () => {
    if (playHistory.length === 0) return;
    const [lastSnapshot, ...remaining] = playHistory;
    setPlayHistory(remaining);
    dispatch({ type: 'PLAY_SET_STATE', payload: lastSnapshot.playState });
    if (lastSnapshot.begleiter && lastSnapshot.begleiter.length === (state.begleiter ?? []).length) {
      dispatch({ type: 'BEGLEITER_ZUSTAENDE_SETZEN', payload: lastSnapshot.begleiter.map((zustand, index) => ({ index, zustand })) });
    }
    setProtocolHistory(lastSnapshot.protocolHistory);
    toast.success('Letztes Spiel-Ereignis rückgängig gemacht');
  };

  const dispatchWithHistory = (action: CharacterAction) => {
    pushPlayHistory();
    dispatch(action);
  };

  const logAndDispatch = (
    action: CharacterAction,
    logEntryData?: {
      category: ActionLogEntry['category'];
      title: string;
      description?: string;
      badge?: ActionLogEntry['badge'];
    }
  ) => {
    pushPlayHistory();
    dispatch(action);
    if (logEntryData) {
      const newEntry: ActionLogEntry = {
        type: 'action',
        id: generateId(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        ...logEntryData,
      };
      setProtocolHistory((prev) => [newEntry, ...prev]);
    }
  };

  const logEintrag: PlaySessionContextType['logEintrag'] = (logEntryData) => {
    pushPlayHistory();
    const newEntry: ActionLogEntry = {
      type: 'action',
      id: generateId(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ...logEntryData,
    };
    setProtocolHistory((prev) => [newEntry, ...prev]);
  };

  const handleRecordRoll = (entry: RollEntry) => {
    pushPlayHistory();
    setProtocolHistory((prev) => [entry, ...prev]);
  };

  const handleQuickRoll = (sides: number, diceCount: number, label: string, modifier: number = 0) => {
    pushPlayHistory();
    const dice: number[] = [];
    for (let i = 0; i < diceCount; i++) {
      dice.push(Math.floor(Math.random() * sides) + 1);
    }
    const sum = dice.reduce((a, b) => a + b, 0);
    const finalTotal = sum + modifier;
    const fullLabel = modifier !== 0 ? `${label} (${modifier > 0 ? `+${modifier}` : modifier})` : label;
    const entry: RollEntry = {
      id: generateId(),
      type: 'roll',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      label: fullLabel,
      d10s: dice,
      baseVal: 0,
      modifier: modifier,
      total: finalTotal,
      isTriumph: sides === 10 && diceCount === 2 && dice[0] === 10 && dice[1] === 10,
      isPatzer: sides === 10 && diceCount === 2 && dice[0] === 1 && dice[1] === 1,
    };
    setProtocolHistory((prev) => [entry, ...prev]);
  };

  const handleRollDiceFormula = (formula: string, label: string) => {
    pushPlayHistory();
    const cleanFormula = formula.trim().replace(/\s+/g, '').toUpperCase();
    // Unterstützt z. B. 1W6, 2W10+5, 1W6-2 sowie kombinierte Zusätze wie 1W6+1+2
    const match = cleanFormula.match(/^(\d*)W(\d+)((?:[+-]\d+)*)$/i);
    if (!match) {
      toast.error(`Ungültige Würfelformel: ${formula}`);
      return;
    }
    const count = parseInt(match[1] || '1', 10);
    const sides = parseInt(match[2], 10);
    const modString = match[3] || '';

    let mod = 0;
    if (modString) {
      const parts = modString.match(/([+-]\d+)/g);
      if (parts) {
        for (const p of parts) {
          mod += parseInt(p, 10);
        }
      }
    }

    const dice: number[] = [];
    for (let i = 0; i < count; i++) {
      dice.push(Math.floor(Math.random() * sides) + 1);
    }
    const sum = dice.reduce((a, b) => a + b, 0);
    const total = sum + mod;
    const isTriumph = count === 2 && sides === 10 && dice[0] === 10 && dice[1] === 10;
    const isPatzer = count === 2 && sides === 10 && dice[0] === 1 && dice[1] === 1;

    const normalizedFormula = `${count}W${sides}${mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : ''}`;

    const entry: RollEntry = {
      id: generateId(),
      type: 'roll',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      label: `${label} (${normalizedFormula})`,
      d10s: dice,
      baseVal: 0,
      modifier: mod,
      total: total,
      outcome: `[${dice.join(', ')}]${mod !== 0 ? (mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`) : ''} = ${total}`,
      isTriumph,
      isPatzer,
    };
    setProtocolHistory((prev) => [entry, ...prev]);
    toast.success(`${label}: ${total} (${normalizedFormula} [${dice.join(', ')}])`);
  };

  // Roll helpers
  const openRollForAttr = (attrKey: string) => {
    const val = currentAttributes[attrKey] ?? 0;
    setRollConfig({
      skillName: `${attrKey} (Attribut)`,
      baseValue: val,
    });
  };

  const openRollForSkill = (skill: string, onSuccess?: () => void, successLabel?: string) => {
    const total = getSkillTotal(skill);
    if (total === null) return;
    const isAffected = isSkillAffectedByBehinderung(skill);
    const beh = isAffected ? (totalHandicap ?? 0) : 0;
    setRollConfig({ skillName: skill, baseValue: total, onSuccess, successLabel, behinderung: beh, grossmeister: getSkillValue(skill) >= grossmeisterAb() });
  };

  const openRollForCombat = (skill: string) => {
    const val = getSkillValue(skill);
    const attrs = grwFertigkeitsattribute()[skill];
    const total = attrs
      ? val + (currentAttributes[attrs[0]] ?? 0) + (currentAttributes[attrs[1]] ?? 0)
      : val;
    setRollConfig({ skillName: skill, baseValue: total, grossmeister: val >= grossmeisterAb() });
  };

  const openRollForWeapon = (
    weaponName: string,
    skill: string,
    customBonus: number = 0,
    targetVTD?: number,
    weaponData?: Partial<AttackWeaponData>
  ) => {
    const characterWeapons = (state.inventory || []).filter((item) => item.type === 'weapon');
    const foundWeapon = characterWeapons.find((w) => w.name === weaponName);
    const totalVal = getSkillTotal(skill) ?? getSkillValue(skill) ?? 0;

    const payload: AttackWeaponData = {
      name: weaponName,
      weaponSkill: skill,
      damage: foundWeapon?.damage || weaponData?.damage || '1W6',
      wgs: foundWeapon?.wgs || weaponData?.wgs || (skill === 'Handgemenge' ? 5 : 7),
      range: foundWeapon?.range || weaponData?.range || (skill === 'Schusswaffen' || skill === 'Wurfwaffen' ? 'Fernkampf' : 'Nahkampf'),
      attributes: foundWeapon?.attributes || weaponData?.attributes || '',
      category: foundWeapon?.category || weaponData?.category || '',
      equipped: foundWeapon?.equipped ?? true,
      ...weaponData,
    };

    setAttackTarget({
      weapon: payload,
      skillName: skill,
      skillTotal: totalVal,
      customBonus,
      targetVTD: targetVTD ?? 15,
      grossmeister: getSkillValue(skill) >= grossmeisterAb(),
    });
  };

  const handleAttackSuccess = (result: AttackSuccessResult) => {
    const dmgText = result.damageRoll
      ? ` · ${result.damageRoll.netDamage} ${result.damageRoll.damageType} (${result.damageRoll.breakdownText})`
      : '';
    const condText = result.damageRoll?.appliedConditions && result.damageRoll.appliedConditions.length > 0
      ? ` · Effekte: ${result.damageRoll.appliedConditions.join(', ')}`
      : '';

    logAndDispatch(
      { type: 'PLAY_SET_SPLITTER', payload: splitterPoints },
      {
        category: 'combat',
        title: `Angriff getroffen: ${result.weapon.name} (${result.eg} EG)${result.damageRoll ? ` · ${result.damageRoll.netDamage} Schaden` : ''}`,
        description: `Manöver: ${result.maneuver.name} · Wurf: ${result.totalRoll} vs. VTD ${result.targetVTD} (${result.eg} EG erzielt)${dmgText}${condText}${result.notes ? ` · Ziel: ${result.notes}` : ''}`,
        badge: {
          text: result.damageRoll ? `${result.damageRoll.netDamage} SP · ${result.eg} EG` : `${result.eg} EG`,
          variant: result.damageRoll ? 'danger' : 'success',
        },
      }
    );
    setAttackTarget(null);
  };

  const handleAttackFailure = (result: AttackFailureResult) => {
    logAndDispatch(
      { type: 'PLAY_SET_SPLITTER', payload: splitterPoints },
      {
        category: 'combat',
        title: `Angriff verfehlt: ${result.weapon.name}`,
        description: `Manöver: ${result.maneuver.name} · Wurf: ${result.totalRoll} vs. VTD ${result.targetVTD} (Diff ${result.differenz})${result.isFumble ? ' · PATZER!' : ''}`,
        badge: {
          text: result.isFumble ? 'Patzer' : 'Fehlschlag',
          variant: 'danger',
        },
      }
    );
    setAttackTarget(null);
  };

  // Spell casting
  const handleOpenCastSpell = (spell: Spell) => {
    setCastSpellTarget(spell);
  };

  const handleCastSpellSuccess = (castResult: CastSpellSuccessResult) => {
    if (!castSpellTarget) return;

    const totalFO = castResult.exhaustedFocus + castResult.channeledFocus + castResult.consumedFocus;
    const modSummary = castResult.modificationsSummary.length > 0 ? ` (${castResult.modificationsSummary.join(', ')})` : '';
    const damageSummary = castResult.damageRoll
      ? ` · ${castResult.damageRoll.total} ${castResult.damageRoll.damageType} (${castResult.damageRoll.formula} [${castResult.damageRoll.dice.join(', ')}])`
      : '';

    logAndDispatch(
      {
        type: 'PLAY_CAST_SPELL',
        payload: {
          exhaustedFocus: castResult.exhaustedFocus,
          channeledFocus: castResult.channeledFocus,
          consumedFocus: castResult.consumedFocus,
          channeledSpell: castResult.channeledSpell,
        },
      },
      {
        category: 'spell',
        title: `Zauber gewirkt: ${castResult.spell.name} (${castResult.eg} EG)${castResult.damageRoll ? ` · ${castResult.damageRoll.total} Schaden` : ''}`,
        description: `${totalFO} FO aufgewendet [${castResult.exhaustedFocus} Erschöpft, ${castResult.channeledFocus} Kanalisiert, ${castResult.consumedFocus} Verzehrt] · Auslösezeit: ${castResult.effectiveCastTicks} Ticks${modSummary}${damageSummary}${castResult.notes ? ` · Ziel: ${castResult.notes}` : ''}`,
        badge: {
          text: castResult.damageRoll ? `${castResult.damageRoll.total} SP · ${totalFO} FO` : `${totalFO} FO`,
          variant: castResult.damageRoll ? 'danger' : 'info',
        },
      }
    );

    const spellName = castResult.spell.name;

    // Zusätzliche Lebenspunkte (z. B. Lebenskraft stärken, Aura der Lebenskraft): Wert aus den Regelpaketen, mit der
    // gewählten Verstärkung der verstärkte Wert
    const mitVerstaerkung = (castResult.modificationsSummary || []).some((m) => m.toLowerCase().startsWith('verstärkung:'));
    const zusatzLp = lpWirkung(aktiverKatalog(), spellName, 'zusatz_lp', mitVerstaerkung);
    if (zusatzLp && typeof zusatzLp.lp === 'number' && zusatzLp.lp > 0) {
      dispatch({ type: 'PLAY_ADD_TEMP_HP', payload: { amount: zusatzLp.lp } });
      toast.success(`+${zusatzLp.lp} temporäre LP erhalten (${spellName})!`);
    }

    // Direkte Selbstheilung oder Zustandsbehebung
    if (castResult.healSelf) {
      if (castResult.healSelf.restoreAll) {
        const consumedCount = healthSlots.filter((s) => s.type === 'consumed').length;
        const exhaustedCount = healthSlots.filter((s) => s.type === 'exhausted' || s.type === 'channeled').length;
        if (consumedCount > 0) {
          dispatch({ type: 'PLAY_UNDO_DAMAGE', payload: { kind: 'consumed', amount: consumedCount, maxLP } });
        }
        if (exhaustedCount > 0) {
          dispatch({ type: 'PLAY_UNDO_DAMAGE', payload: { kind: 'exhausted', amount: exhaustedCount, maxLP } });
        }
        const badConditions = ['Erschöpft', 'Blutend', 'Brennend', 'Vergiftet', 'Benommen', 'Geblendet', 'Siechtum', 'Lahm'];
        if (castResult.healSelf.curesPoisonDisease) {
          badConditions.push('Krankheit');
        }
        const cleanConditions = conditions.filter((c) => !badConditions.includes(c.key));
        dispatch({ type: 'PLAY_SET_STATE', payload: { ...playState, conditions: cleanConditions } });
        toast.success(
          castResult.healSelf.curesPoisonDisease
            ? 'Wiederherstellung (EG-verstärkt): Alle LP geheilt, Zustände entfernt & Gifte/Krankheiten aufgehoben!'
            : 'Wiederherstellung: Alle LP geheilt & schwere Zustände aufgehoben!'
        );
      } else if (castResult.healSelf.hp && castResult.healSelf.hp > 0) {
        const healAmount = castResult.healSelf.hp;
        const consumedCount = healthSlots.filter((s) => s.type === 'consumed').length;
        const consumedToHeal = Math.min(healAmount, consumedCount);
        const remainingHeal = healAmount - consumedToHeal;
        if (consumedToHeal > 0) {
          dispatch({ type: 'PLAY_UNDO_DAMAGE', payload: { kind: 'consumed', amount: consumedToHeal, maxLP } });
        }
        if (remainingHeal > 0) {
          const exhaustedCount = healthSlots.filter((s) => s.type === 'exhausted' || s.type === 'channeled').length;
          const exhaustedToHeal = Math.min(remainingHeal, exhaustedCount);
          if (exhaustedToHeal > 0) {
            dispatch({ type: 'PLAY_UNDO_DAMAGE', payload: { kind: 'exhausted', amount: exhaustedToHeal, maxLP } });
          }
        }
        toast.success(`+${healAmount} LP geheilt (${spellName})!`);
      } else if (castResult.healSelf.removeCondition) {
        const condKey = castResult.healSelf.removeCondition;
        const existing = conditions.find((c) => c.key.toLowerCase() === condKey.toLowerCase());
        if (existing) {
          if (existing.level && existing.level > 1) {
            const updated = conditions.map((c) => (c.id === existing.id ? { ...c, level: (c.level ?? 2) - 1 } : c));
            dispatch({ type: 'PLAY_SET_STATE', payload: { ...playState, conditions: updated } });
            toast.success(`Zustand '${condKey}' um 1 Stufe verringert (jetzt Stufe ${existing.level - 1})`);
          } else {
            dispatch({ type: 'PLAY_REMOVE_CONDITION', payload: { id: existing.id } });
            toast.success(`Zustand '${condKey}' vollständig aufgehoben!`);
          }
        } else {
          toast(`Info: Kein aktiver Zustand '${condKey}' auf dem Helden.`);
        }
      }
    }

    setCastSpellTarget(null);
    const damageToast = castResult.damageRoll
      ? ` · ${castResult.damageRoll.total} ${castResult.damageRoll.damageType} angerichtet!`
      : '';
    toast.success(`'${spellName}' mit ${castResult.eg} EG erfolgreich gewirkt! (-${totalFO} FO)${damageToast}`);
  };

  const handleCastSpellFailure = (failureResult: CastSpellFailureResult) => {
    if (!castSpellTarget) return;

    logAndDispatch(
      {
        type: 'PLAY_CAST_SPELL',
        payload: {
          exhaustedFocus: failureResult.exhaustedFocusLost,
          channeledFocus: 0,
          consumedFocus: 0,
        },
      },
      {
        category: 'spell',
        title: `Zauber verpufft: ${failureResult.spell.name}`,
        description: `Misslungene Zauberprobe (${failureResult.totalRoll} gegen Schwierigkeit ${failureResult.difficulty}). ${failureResult.exhaustedFocusLost} FO erschöpft (${failureResult.negativeEG} negative EG).`,
        badge: { text: `-${failureResult.exhaustedFocusLost} FO`, variant: 'danger' },
      }
    );

    const spellName = failureResult.spell.name;
    setCastSpellTarget(null);
    toast.error(`'${spellName}' ist verpufft! (${failureResult.exhaustedFocusLost} Fokus erschöpft)`);
  };

  const handleCancelChanneledSpell = (spell: ChanneledSpell) => {
    logAndDispatch(
      { type: 'PLAY_CANCEL_CHANNELED_SPELL', payload: { id: spell.id } },
      {
        category: 'spell',
        title: `Kanalisierung beendet: ${spell.name}`,
        description: `'${spell.name}' fallen gelassen (${spell.channeledFocus} FO wurde in erschöpften Fokus überführt)`,
        badge: { text: `${spell.channeledFocus} FO`, variant: 'warning' },
      }
    );

    // Wenn Lebenskraft stärken oder Aura der Lebenskraft abgebrochen wird, verfallen verbleibende Temp-LP
    if (lpWirkung(aktiverKatalog(), spell.name || '', 'zusatz_lp', false)) {
      dispatch({ type: 'PLAY_REMOVE_TEMP_HP', payload: { amount: 999 } });
      toast(`Temporäre Lebenspunkte aus '${spell.name}' sind verfallen.`);
    }

    toast.success(`Kanalisierung von '${spell.name}' gelöst: ${spell.channeledFocus} FO ist nun erschöpft.`);
  };

  const handleQuickSpellDamageRoll = (spell: Spell, damageInfo: ParsedSpellDamage) => {
    const res = executeSpellDamageRoll(
      damageInfo.diceCount,
      damageInfo.diceSides,
      damageInfo.baseBonus,
      0,
      damageInfo.damageType
    );
    handleRecordRoll({
      id: generateId(),
      type: 'roll',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      label: `Schaden: ${spell.name} (${res.formula})`,
      d10s: res.dice,
      baseVal: 0,
      modifier: res.baseBonus,
      total: res.total,
      outcome: `${res.total} ${res.damageType}`,
    });
    toast.success(`${spell.name}: ${res.total} ${res.damageType} gewürfelt! (${res.formula} [${res.dice.join(', ')}])`);
  };

  // Rest handlers
  const handleVerschnaufpause = (options?: {
    healAllStun?: boolean;
    stunAmount?: number;
    healAllExhaustedFocus?: boolean;
    exhaustedFocusAmount?: number;
    exhaustReduction?: number;
    removeConditions?: boolean;
  }) => {
    pushPlayHistory();
    const healAllStun = options?.healAllStun ?? true;
    const stunAmount = options?.stunAmount ?? 0;
    const healAllExhaustedFocus = options?.healAllExhaustedFocus ?? true;
    const exhaustedFocusAmount = options?.exhaustedFocusAmount ?? 0;
    const exhaustReduction = options?.exhaustReduction !== undefined ? options.exhaustReduction : 1;
    const removeConditions = options?.removeConditions ?? true;

    const stunSlotsCount = healthSlots.filter((s) => s.type === 'exhausted' || s.type === 'channeled').length;
    const actualStunHealed = healAllStun ? stunSlotsCount : Math.min(stunAmount, stunSlotsCount);

    const exhaustedFocusCount = focus.exhausted;
    const channeledFocusCount = focus.channeled;
    const actualFocusHealed = healAllExhaustedFocus
      ? exhaustedFocusCount + channeledFocusCount
      : Math.min(exhaustedFocusAmount, exhaustedFocusCount);

    const currentExhaustLvl = conditions.find((c) => c.key === 'Erschöpft')?.level ?? (conditions.some((c) => c.key === 'Erschöpft') ? 1 : 0);
    const actualExhaustReduced = Math.min(exhaustReduction, currentExhaustLvl);

    const removedConds = removeConditions
      ? conditions.filter((c) => c.key === 'Glaubenskrise' || c.key === 'Lahm').map((c) => c.key)
      : [];

    dispatch({ type: 'PLAY_HEAL_EXHAUSTED', payload: options });

    const details: RestDetailItem[] = [
      {
        label: 'Betäubungsschaden geheilt',
        value: actualStunHealed > 0
          ? `+${actualStunHealed} LP (${healAllStun ? 'komplett' : `max. ${stunAmount}`})`
          : (stunSlotsCount === 0 ? '0 LP (kein Betäubungsschaden)' : '+0 LP'),
        type: 'hp',
      },
      {
        label: 'Erschöpfter/Kanalisierter Fokus',
        value: actualFocusHealed > 0
          ? `+${actualFocusHealed} FO (${healAllExhaustedFocus ? 'komplett' : `max. ${exhaustedFocusAmount}`})`
          : (exhaustedFocusCount + channeledFocusCount === 0 ? '0 FO (kein Fokus erschöpft)' : '+0 FO'),
        type: 'fo',
      },
      {
        label: 'Zustand Erschöpft',
        value: currentExhaustLvl > 0
          ? (actualExhaustReduced > 0 ? `-${actualExhaustReduced} Stufe(n)` : 'Nicht reduziert')
          : 'Nicht aktiv',
        type: 'exhaust',
      },
    ];

    if (removedConds.length > 0) {
      details.push({
        label: 'Aufgehobene Zustände',
        value: removedConds.join(', '),
        type: 'condition',
      });
    }

    const summaryParts: string[] = [];
    if (actualStunHealed > 0) summaryParts.push(`${actualStunHealed} Betäubung geheilt`);
    if (actualFocusHealed > 0) summaryParts.push(`${actualFocusHealed} Fokus regeneriert`);
    if (actualExhaustReduced > 0) summaryParts.push(`Erschöpfung -${actualExhaustReduced}`);
    if (removedConds.length > 0) summaryParts.push(`Zustände entfernt (${removedConds.join(', ')})`);

    const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : 'Keine Erholung nötig (alles voll).';
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const logEntry: RestLogEntry = {
      id: generateId(),
      type: 'rest',
      timestamp,
      restType: 'verschnaufpause',
      title: 'Verschnaufpause',
      summary,
      details,
    };
    setProtocolHistory((prev) => [logEntry, ...prev]);
    toast.success(`Verschnaufpause: ${summary}`, { duration: 4000 });
  };

  const handleRuhephase = (konAmount: number, wilAmount: number) => {
    pushPlayHistory();
    const stunSlotsCount = healthSlots.filter((s) => s.type === 'exhausted' || s.type === 'channeled').length;
    const consumedSlotsCount = healthSlots.filter((s) => s.type === 'consumed').length;
    const actualConsumedHealed = Math.min(konAmount, consumedSlotsCount);

    const exhaustedChanneledFocus = focus.exhausted + focus.channeled;
    const actualConsumedFocusHealed = Math.min(wilAmount, focus.consumed);

    const currentExhaustLvl = conditions.find((c) => c.key === 'Erschöpft')?.level ?? (conditions.some((c) => c.key === 'Erschöpft') ? 1 : 0);
    const removedConds = conditions.filter((c) => c.key === 'Glaubenskrise' || c.key === 'Lahm' || c.key === 'Erschöpft').map((c) => c.key);

    dispatch({
      type: 'PLAY_REST_HEAL',
      payload: { konAmount, wilAmount },
    });

    const details: RestDetailItem[] = [
      {
        label: 'Betäubungsschaden geheilt',
        value: stunSlotsCount > 0 ? `+${stunSlotsCount} LP (komplett)` : '0 LP (kein Schaden)',
        type: 'hp',
      },
      {
        label: 'Echte Wunden geheilt (KON)',
        value: actualConsumedHealed > 0
          ? `+${actualConsumedHealed} LP (Basis: ${konAmount})`
          : (consumedSlotsCount === 0 ? '0 LP (keine Wunden)' : '+0 LP'),
        type: 'hp',
      },
      {
        label: 'Erschöpfter/Kanalisierter Fokus',
        value: exhaustedChanneledFocus > 0 ? `+${exhaustedChanneledFocus} FO (komplett)` : '0 FO',
        type: 'fo',
      },
      {
        label: 'Verzehrter Fokus geheilt (WIL)',
        value: actualConsumedFocusHealed > 0
          ? `+${actualConsumedFocusHealed} FO (Basis: ${wilAmount})`
          : (focus.consumed === 0 ? '0 FO (kein verzehrter Fokus)' : '+0 FO'),
        type: 'fo',
      },
      {
        label: 'Zustand Erschöpft',
        value: currentExhaustLvl > 0 ? 'Komplett entfernt' : 'Nicht aktiv',
        type: 'exhaust',
      },
    ];

    if (removedConds.length > 0) {
      details.push({
        label: 'Entfernte Zustände',
        value: removedConds.join(', '),
        type: 'condition',
      });
    }

    const summaryParts: string[] = [];
    if (stunSlotsCount > 0) summaryParts.push(`${stunSlotsCount} Betäubung geheilt`);
    if (actualConsumedHealed > 0) summaryParts.push(`${actualConsumedHealed} echte LP geheilt`);
    if (exhaustedChanneledFocus > 0) summaryParts.push(`${exhaustedChanneledFocus} erschöpfter FO geheilt`);
    if (actualConsumedFocusHealed > 0) summaryParts.push(`${actualConsumedFocusHealed} verzehrter FO geheilt`);
    if (currentExhaustLvl > 0) summaryParts.push('Erschöpfung komplett geheilt');
    if (removedConds.length > 0) summaryParts.push(`Zustände entfernt (${removedConds.join(', ')})`);

    const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : 'Volle Erholung. Keine Wunden oder verzehrter Fokus vorhanden.';
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const logEntry: RestLogEntry = {
      id: generateId(),
      type: 'rest',
      timestamp,
      restType: 'ruhephase',
      title: 'Ruhephase',
      summary,
      details,
    };
    setProtocolHistory((prev) => [logEntry, ...prev]);
    toast.success(`Ruhephase: ${summary}`, { duration: 4500 });
  };

  // Zustände wie Verstoßen halten einen Teil des Fokus dauerhaft kanalisiert
  const focusAvailable = Math.max(0, maxFO - focus.exhausted - focus.channeled - focus.consumed - fokusDurchZustaende(maxFO, zustandswerte(conditions)));
  const isPlayOrCombat = mode === 'play' || mode === 'combat' || mode === 'begleiter';
  const activeSpellMods = useMemo(() => getActiveSpellModifiers(playState.channeledSpells), [playState.channeledSpells]);
  // Zustände, von denen ein aktiver Zauber Stufen unterdrückt (z. B. Erfrischung), wirken beim Würfeln nur mit der Reststufe
  const wirksameZustaendeListe = useMemo(
    () => wirksameZustaende(aktiverKatalog(), conditions, playState.channeledSpells ?? []).wirksam,
    [conditions, playState.channeledSpells]
  );
  const effectiveWoundPenalty = Math.min(0, currentWoundPenalty + activeSpellMods.woundPenaltyReduction);

  return (
    <PlaySessionContext.Provider
      value={{
        protocolHistory,
        setProtocolHistory,
        playHistory,
        pushPlayHistory,
        handleUndoPlay,
        dispatchWithHistory,
        logAndDispatch,
        handleRecordRoll,
        logEintrag,
        handleQuickRoll,
        handleRollDiceFormula,
        rollConfig,
        setRollConfig,
        castSpellTarget,
        setCastSpellTarget,
        attackTarget,
        setAttackTarget,
        restResultModal,
        setRestResultModal,
        openRollForAttr,
        openRollForSkill,
        openRollForCombat,
        openRollForWeapon,
        handleOpenCastSpell,
        handleCastSpellSuccess,
        handleCastSpellFailure,
        handleCancelChanneledSpell,
        handleQuickSpellDamageRoll,
        handleVerschnaufpause,
        handleRuhephase,
        spOption,
        setSpOption,
        damageAmount,
        setDamageAmount,
        focusAmount,
        setFocusAmount,
        tempHPInput,
        setTempHPInput,
        selectedCondition,
        setSelectedCondition,
        conditionLevel,
        setConditionLevel,
        conditionNote,
        setConditionNote,
      }}
    >
      {children}

      {/* Global Roll Modal */}
      {rollConfig && (
        <RollModal
          skillName={rollConfig.skillName}
          baseValue={rollConfig.baseValue}
          woundPenalty={effectiveWoundPenalty}
          healthLevelName={currentHealthLevelName}
          conditions={wirksameZustaendeListe}
          channeledSpells={playState.channeledSpells}
          behinderung={rollConfig.behinderung}
          splitterPoints={splitterPoints}
          onSpendSplitterPoint={(reason) => {
            if (splitterPoints > 0) {
              const newSP = splitterPoints - 1;
              logAndDispatch(
                { type: 'PLAY_SET_SPLITTER', payload: newSP },
                {
                  category: 'splitter',
                  title: 'Splitterpunkt eingesetzt',
                  description: `${reason} (${newSP} SP übrig)`,
                  badge: { text: '-1 SP', variant: 'gold' },
                }
              );
            }
          }}
          onClose={() => setRollConfig(null)}
          onSuccess={rollConfig.onSuccess}
          successLabel={rollConfig.successLabel}
          initialSchwierigkeit={rollConfig.initialSchwierigkeit}
          onFailure={rollConfig.onFailure}
          probeOutcomeLabels={rollConfig.probeOutcomeLabels}
          onRecordRoll={handleRecordRoll}
          grossmeister={rollConfig.grossmeister}
        />
      )}

      {/* Global Cast Spell Modal */}
      {castSpellTarget && (
        <CastSpellModal
          spell={castSpellTarget}
          schoolSkillTotal={getSkillTotal(castSpellTarget.probeFertigkeit ?? castSpellTarget.school) ?? 0}
          schoolSkillName={castSpellTarget.probeFertigkeit ?? castSpellTarget.school}
          grossmeister={getSkillValue(castSpellTarget.probeFertigkeit ?? castSpellTarget.school) >= grossmeisterAb()}
          availableFocus={focusAvailable}
          maxFO={maxFO}
          focusState={focus}
          conditions={wirksameZustaendeListe}
          woundPenalty={effectiveWoundPenalty}
          splitterpunkte={splitterPoints}
          inventory={state.inventory || []}
          onClose={() => setCastSpellTarget(null)}
          onCastSuccess={handleCastSpellSuccess}
          onCastFailure={handleCastSpellFailure}
          onSpendSplitterpunkt={() => {
            if (splitterPoints > 0) {
              const newSP = splitterPoints - 1;
              logAndDispatch(
                { type: 'PLAY_SET_SPLITTER', payload: newSP },
                {
                  category: 'splitter',
                  title: 'Splitterpunkt eingesetzt (Zauber)',
                  description: `Probe modifiziert oder wiederholt (${newSP} SP übrig)`,
                  badge: { text: '-1 SP', variant: 'gold' },
                }
              );
            }
          }}
          onRecordRoll={handleRecordRoll}
        />
      )}

      {/* Global Attack Modal */}
      {attackTarget && (
        <AttackModal
          target={attackTarget}
          characterMasteries={
            Object.entries(state.masteries || {}).flatMap(([skill, list]) =>
              (list || []).map((m: any) => ({ ...m, skill: m.skill || skill }))
            )
          }
          angreiferWerte={angreiferWerte}
          conditions={wirksameZustaendeListe}
          channeledSpells={playState.channeledSpells}
          woundPenalty={effectiveWoundPenalty}
          splitterpunkte={splitterPoints}
          onClose={() => setAttackTarget(null)}
          onSpendSplitterpunkt={() => {
            if (splitterPoints > 0) {
              const newSP = splitterPoints - 1;
              logAndDispatch(
                { type: 'PLAY_SET_SPLITTER', payload: newSP },
                {
                  category: 'splitter',
                  title: 'Splitterpunkt eingesetzt (Angriff)',
                  description: `Angriff modifiziert (${newSP} SP übrig)`,
                  badge: { text: '-1 SP', variant: 'gold' },
                }
              );
              toast.success(`Splitterpunkt eingesetzt! (${newSP} verbleibend)`);
            }
          }}
          onRecordRoll={handleRecordRoll}
          onAttackSuccess={handleAttackSuccess}
          onAttackFailure={handleAttackFailure}
        />
      )}

      {/* Global Rest Result Modal */}
      {restResultModal && (
        <RestResultModal
          data={restResultModal}
          onClose={() => setRestResultModal(null)}
        />
      )}

      {/* Docked DiceLog in Play and Combat modes */}
      {isPlayOrCombat && (
        <DiceLog
          entries={protocolHistory}
          onClearRolls={() => {
            pushPlayHistory();
            setProtocolHistory([]);
          }}
          onQuickRoll={handleQuickRoll}
          onUndo={handleUndoPlay}
          canUndo={playHistory.length > 0}
        />
      )}
    </PlaySessionContext.Provider>
  );
};

/** Wie usePlaySession, aber null außerhalb des Providers (z. B. in Tests einzelner Ansichten) */
export function usePlaySessionOptional(): PlaySessionContextType | null {
  return useContext(PlaySessionContext);
}

export function usePlaySession(): PlaySessionContextType {
  const context = useContext(PlaySessionContext);
  if (!context) {
    throw new Error('usePlaySession must be used within a PlaySessionProvider');
  }
  return context;
}
