import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, Wahlknopf, useEscape } from '../../fundament';
import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Clock,
  Target,
  Maximize2,
  Compass,
  AlertTriangle,
  Plus,
  Minus,
  Check,
  RotateCcw,
  Flame,
  Shield,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Heart,
  Sword,
} from 'lucide-react';
import DiceIcon from '../ui/DiceIcon';
import type { Spell, FocusState, ChanneledSpell, StatusCondition, InventoryItem } from '../../types';
import {
  parseFocusCost,
  getFullSpellInfo,
  calculateSpellEG,
  calculateTotalEGSpent,
  calculateFinalSpellCosts,
  INITIAL_EG_ALLOCATIONS,
  parseSpellDamage,
  executeSpellDamageRoll,
  getEnhancedSpellDamage,
  getSelectedSpecificEnhancementEffects,
  parseSpellPermissibleModifications,
  getSpellHealingInfo,
  calculateSpellHealing,
  type CalculatedSpellHealing,
  type SpecificSpellEnhancement,
  type PermissibleSpellModifications,
  type SpellDamageRollResult,
  type ParsedSpellDamage,
  type SpellEGAllocations,
  type SpellCastEGCalculation,
  isEquipmentTargetingSpell,
} from '../../utils/magicRules';
import { generateId } from '../../utils/id';
import type { RollEntry } from './DiceLog';
import { getActiveRollModifiers } from '../../utils/conditionModifiers';
import { verstaerkungsZustandText } from '../../regelwerk/zauberEg';
import { wuerfeln } from '../../utils/wuerfeln';
import { SituativeBoni, useSituativeBoni, useZauberAnpassungen, ZauberAnpassungen } from './SituativeBoni';
import { kostenAnwenden, zauberdauerAnpassen } from '../../regelwerk/wirkungen';
import { wurfgrenzen } from '../../regelwerk/proben';

export interface CastSpellSuccessResult {
  spell: Spell;
  exhaustedFocus: number;
  channeledFocus: number;
  consumedFocus: number;
  isChanneled: boolean;
  channeledSpell?: ChanneledSpell;
  effectiveCastTicks: number;
  eg: number;
  egAllocations: SpellEGAllocations;
  modificationsSummary: string[];
  notes: string;
  damageRoll?: SpellDamageRollResult;
  healSelf?: {
    hp?: number;
    restoreAll?: boolean;
    curesPoisonDisease?: boolean;
    /** bei „alle LP“: die vom Spieler gewählten Zustände (IDs), die der Zauber aufhebt */
    conditionIdsToRemove?: string[];
    removeCondition?: string;
    label: string;
  };
  rollDetails: {
    dice: number[];
    total: number;
    difficulty: number;
    eg: number;
    isCrit: boolean;
    isFumble: boolean;
  };
}

export interface CastSpellFailureResult {
  spell: Spell;
  exhaustedFocusLost: number;
  negativeEG: number;
  difficulty: number;
  totalRoll: number;
  isFumble: boolean;
  notes?: string;
  rollDetails?: {
    dice: number[];
    total: number;
    difficulty: number;
    isFumble: boolean;
  };
}

interface CastSpellModalProps {
  spell: Spell;
  schoolSkillTotal: number;
  schoolSkillName: string;
  /** Großmeister in der Magieschule (ab 15 Punkten): zusätzlicher W10 */
  grossmeister?: boolean;
  availableFocus: number;
  maxFO: number;
  focusState: FocusState;
  conditions?: StatusCondition[];
  woundPenalty?: number;
  splitterpunkte: number;
  inventory?: InventoryItem[];
  onClose: () => void;
  onCastSuccess: (result: CastSpellSuccessResult) => void;
  onCastFailure: (result: CastSpellFailureResult) => void;
  onSpendSplitterpunkt: () => void;
  onRecordRoll?: (roll: RollEntry) => void;
  /** Wer zaubert: beim Begleiter keine Stärken und Meisterschaften des Helden */
  zaubernder?: 'held' | 'begleiter';
}

type RollType = 'standard' | 'safe' | 'risk';

/** Fokuskosten in Buchschreibweise (z. B. „K4V1“, „3“) */
function kostenText(c: { isChanneled: boolean; exhausted: number; channeled: number; consumed: number }): string {
  const gesamt = (c.isChanneled ? c.channeled : c.exhausted) + c.consumed;
  return `${c.isChanneled ? 'K' : ''}${gesamt}${c.consumed ? `V${c.consumed}` : ''}`;
}

export const CastSpellModal: React.FC<CastSpellModalProps> = ({
  spell: rawSpell,
  schoolSkillTotal,
  schoolSkillName,
  grossmeister = false,
  zaubernder = 'held',
  availableFocus,
  maxFO,
  focusState: _focusState,
  conditions = [],
  woundPenalty = 0,
  splitterpunkte,
  inventory = [],
  onClose,
  onCastSuccess,
  onCastFailure,
  onSpendSplitterpunkt,
  onRecordRoll,
}) => {
  const modalHeadingId = useId();
  const spell = useMemo(() => getFullSpellInfo(rawSpell), [rawSpell]);

  // Check if this spell enchants an equipment piece (e.g. Flammende Waffe -> Waffe; Rüstung schwächen -> Rüstung)
  const equipmentTargetCheck = useMemo(() => isEquipmentTargetingSpell(spell), [spell]);

  const candidateEquipment = useMemo(() => {
    if (!equipmentTargetCheck.isEquipmentSpell) return [];
    if (equipmentTargetCheck.equipmentType === 'weapon') {
      return (inventory || []).filter(
        (item) => item.type === 'weapon' || item.category === 'weapon' || Boolean(item.damage)
      );
    }
    if (equipmentTargetCheck.equipmentType === 'armor') {
      return (inventory || []).filter((item) => item.type === 'armor' || item.type === 'shield');
    }
    return (inventory || []).filter((item) => item.type !== 'other');
  }, [equipmentTargetCheck, inventory]);

  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(() => {
    if (!equipmentTargetCheck.isEquipmentSpell) return '';
    const equipped = candidateEquipment.find((item) => item.equipped);
    if (equipped) return equipped.id;
    if (candidateEquipment.length > 0) return candidateEquipment[0].id;
    return 'other';
  });

  const selectedEquipmentItem = useMemo(() => {
    if (!selectedEquipmentId || selectedEquipmentId === 'other') return null;
    return candidateEquipment.find((item) => item.id === selectedEquipmentId) || null;
  }, [candidateEquipment, selectedEquipmentId]);
  const grundkosten = useMemo(() => parseFocusCost(spell.cost), [spell.cost]);
  // Kosten- und Zauberdauer-Änderungen aus Meisterschaften (nur mit Regelpaketen)
  const zauberWirk = useZauberAnpassungen(schoolSkillName, grundkosten.isChanneled, zaubernder === 'begleiter');
  const baseCost = useMemo(() => kostenAnwenden(grundkosten, zauberWirk.kosten), [grundkosten, zauberWirk.kosten]);
  const kostenGeaendert = baseCost !== grundkosten;
  const zauberdauer = useMemo(() => zauberdauerAnpassen(spell.castTime, zauberWirk.dauer), [spell.castTime, zauberWirk.dauer]);
  const spellHealingInfo = useMemo(() => getSpellHealingInfo(spell.name, spell.description), [spell.name, spell.description]);

  // Step 1: Difficulty & Roll Modifiers
  const isFixedDifficulty = useMemo(() => {
    if (spell.difficultyType === 'fest') return true;
    if (spell.difficultyValue !== undefined && spell.difficultyType !== 'VTD' && spell.difficultyType !== 'GW' && spell.difficultyType !== 'KW') return true;
    if (spell.difficulty && !isNaN(Number(spell.difficulty))) return true;
    if (!spell.difficultyType && !spell.difficulty) return true;
    return false;
  }, [spell.difficultyType, spell.difficultyValue, spell.difficulty]);

  const fixedDiffValue = useMemo(() => {
    if (spell.difficultyValue !== undefined) return spell.difficultyValue;
    if (spell.difficulty && !isNaN(Number(spell.difficulty))) return Number(spell.difficulty);
    return 12 + 3 * (spell.grade ?? 0);
  }, [spell.difficultyValue, spell.difficulty, spell.grade]);

  const initialDifficulty = useMemo(() => {
    if (isFixedDifficulty) return fixedDiffValue;
    if (spell.difficultyType === 'VTD') return 16;
    if (spell.difficultyType === 'GW') return 15;
    if (spell.difficultyType === 'KW') return 17;
    return 15;
  }, [isFixedDifficulty, fixedDiffValue, spell.difficultyType]);

  const [difficulty, setDifficulty] = useState<number>(initialDifficulty);
  const effectiveDifficulty = isFixedDifficulty ? fixedDiffValue : difficulty;

  const [selectedPreset, setSelectedPreset] = useState<string>(() => (isFixedDifficulty ? String(fixedDiffValue) : '15'));
  const [situationalMod, setSituationalMod] = useState<number>(0);
  const [spellTargetNote, setSpellTargetNote] = useState<string>('');
  const [showSpellDetails, setShowSpellDetails] = useState<boolean>(false);
  const [manualInputOpen, setManualInputOpen] = useState<boolean>(false);
  const [manualRollVal, setManualRollVal] = useState<string>('');

  // Active condition modifiers
  // Zustände für Magieschulen; der Wundabzug selbst wird gesondert gerechnet
  const conditionMods = useMemo(() => getActiveRollModifiers(conditions, woundPenalty, '', 0, false, 'magie', spell?.school).filter((m) => m.source === 'condition'), [conditions, woundPenalty]);
  const totalConditionPenalty = useMemo(() => {
    return conditionMods.reduce((sum, c) => sum + (c.active ? c.malus : 0), 0);
  }, [conditionMods]);

  // Total skill modifier
  const situativ = useSituativeBoni('zauber', schoolSkillName, zaubernder === 'begleiter');
  const totalRollModifier = schoolSkillTotal + woundPenalty + totalConditionPenalty + situationalMod + situativ.summe;

  // Step 2: Roll execution & state
  const [hasRolled, setHasRolled] = useState<boolean>(false);
  const [rollDice, setRollDice] = useState<number[]>([0, 0]);
  const [diceSum, setDiceSum] = useState<number>(0);
  const [isFumble, setIsFumble] = useState<boolean>(false);
  const [isCrit, setIsCrit] = useState<boolean>(false);
  const [rollType, setRollType] = useState<RollType>('standard');
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [extraSPBonus, setExtraSPBonus] = useState<number>(0);

  // Total rolled calculation
  const totalRollResult = hasRolled ? diceSum + totalRollModifier + extraSPBonus : 0;

  // Step 3: Evaluation (EG / Negative EG)
  const egCalculation: SpellCastEGCalculation | null = useMemo(() => {
    if (!hasRolled) return null;
    return calculateSpellEG(totalRollResult, effectiveDifficulty, isFumble, isCrit);
  }, [hasRolled, totalRollResult, effectiveDifficulty, isFumble, isCrit]);

  // Manual failure adjustment (if player/GM wants to tweak negative EG focus cost)
  const [customFailureFocus, setCustomFailureFocus] = useState<number | null>(null);
  // Heilzauber mit „alle LP“: welche Zustände er aufhebt, wählt der Spieler laut Zauberbeschreibung (vorbelegt: alle)
  const [aufzuheben, setAufzuheben] = useState<string[]>(() => conditions.map((c) => c.id));

  // Step 4: Permissible modifications according to Splittermond GRW database
  const permissibleMods = useMemo<PermissibleSpellModifications>(
    () => parseSpellPermissibleModifications(spell.description, spell.name),
    [spell.description, spell.name]
  );
  const [showCustomEnhancement, setShowCustomEnhancement] = useState<boolean>(false);

  // Step 4: EG allocations (Schritt 5 des Zaubervorgangs)
  const [allocations, setAllocations] = useState<SpellEGAllocations>(INITIAL_EG_ALLOCATIONS);

  // Calculate spent and remaining EG
  const totalEarnedEG = egCalculation?.isSuccess ? egCalculation.eg : 0;
  const spentEG = useMemo(
    () => calculateTotalEGSpent(allocations, permissibleMods.specificEnhancements),
    [allocations, permissibleMods.specificEnhancements]
  );
  const remainingEG = Math.max(0, totalEarnedEG - spentEG);

  // Calculate final focus costs after applying EG savings and enhancements
  const finalCosts = useMemo(() => {
    const f = calculateFinalSpellCosts(baseCost, allocations, permissibleMods.specificEnhancements);
    return zauberWirk.labels.length ? { ...f, modificationsSummary: [...zauberWirk.labels, ...f.modificationsSummary] } : f;
  }, [baseCost, allocations, permissibleMods.specificEnhancements, zauberWirk.labels]);

  const currentHealingInfo = useMemo(() => {
    return calculateSpellHealing(spell.name, allocations, permissibleMods.specificEnhancements);
  }, [spell.name, allocations, permissibleMods.specificEnhancements]);

  const handleToggleEnhancement = (enh: SpecificSpellEnhancement) => {
    setAllocations((prev) => {
      const isSelected = prev.selectedEnhancementIds.includes(enh.id);
      if (isSelected) {
        return {
          ...prev,
          selectedEnhancementIds: prev.selectedEnhancementIds.filter((id) => id !== enh.id),
        };
      } else {
        if (remainingEG < enh.egCost) return prev;
        return {
          ...prev,
          selectedEnhancementIds: [...prev.selectedEnhancementIds, enh.id],
        };
      }
    });
  };

  // Can the player afford the final focus cost?
  const canAffordFocus = availableFocus >= finalCosts.totalFocus;

  // Step 4.5: Damage Roller State
  const detectedDamage = useMemo(
    () => getEnhancedSpellDamage(spell.name, spell.description, allocations, permissibleMods.specificEnhancements),
    [spell.name, spell.description, allocations, permissibleMods.specificEnhancements]
  );
  const activeEnhancementEffects = useMemo(() => {
    return getSelectedSpecificEnhancementEffects(spell.name, allocations, permissibleMods.specificEnhancements);
  }, [spell.name, allocations, permissibleMods.specificEnhancements]);

  const [enableDamageRoll, setEnableDamageRoll] = useState<boolean>(!!detectedDamage);
  const [customDiceCount, setCustomDiceCount] = useState<number>(detectedDamage?.diceCount ?? 1);
  const [customDiceSides, setCustomDiceSides] = useState<number>(detectedDamage?.diceSides ?? 6);
  const [customBaseBonus, setCustomBaseBonus] = useState<number>(detectedDamage?.baseBonus ?? 0);
  const [customDamageType, setCustomDamageType] = useState<string>(detectedDamage?.damageType ?? 'Schaden');

  useEffect(() => {
    if (detectedDamage) {
      setCustomDiceCount(detectedDamage.diceCount);
      setCustomDiceSides(detectedDamage.diceSides);
      setCustomBaseBonus(detectedDamage.baseBonus);
      setCustomDamageType(detectedDamage.damageType);
    }
  }, [detectedDamage]);

  const [showDamageConfig, setShowDamageConfig] = useState<boolean>(false);
  const [damageResult, setDamageResult] = useState<SpellDamageRollResult | null>(null);
  const [manualDamageInputOpen, setManualDamageInputOpen] = useState<boolean>(false);
  const [manualDamageInputVal, setManualDamageInputVal] = useState<string>('');

  const spellCausesDamage = (enableDamageRoll || !!detectedDamage || allocations.increaseDamage > 0) && customDiceCount > 0;

  // Keep damageResult synchronized with allocations.increaseDamage
  const currentDamageResult: SpellDamageRollResult | null = useMemo(() => {
    if (!damageResult) return null;
    return executeSpellDamageRoll(
      damageResult.diceCount,
      damageResult.diceSides,
      damageResult.baseBonus,
      allocations.increaseDamage,
      damageResult.damageType,
      damageResult.dice
    );
  }, [damageResult, allocations.increaseDamage]);

  const handleRollDamage = (manualDice?: number[]) => {
    const res = executeSpellDamageRoll(
      customDiceCount,
      customDiceSides,
      customBaseBonus,
      allocations.increaseDamage,
      customDamageType,
      manualDice
    );
    setDamageResult(res);
    if (onRecordRoll) {
      onRecordRoll({
        id: generateId(),
        type: 'roll',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        label: `Schaden: ${spell.name} (${res.formula})`,
        d10s: res.dice,
        baseVal: 0,
        modifier: res.baseBonus + res.egBonus,
        total: res.total,
        outcome: `${res.total} ${res.damageType}`,
      });
    }
  };

  const handleApplyManualDamage = () => {
    const raw = manualDamageInputVal.trim();
    if (!raw) return;
    const parts = raw.split(/[\s,;+]+/).map((p) => parseInt(p, 10)).filter((n) => !isNaN(n));
    if (parts.length === 0) return;
    setCustomDiceCount(parts.length);
    handleRollDamage(parts);
    setManualDamageInputOpen(false);
  };

  // Helper to execute rolling
  const performRoll = (type: RollType = rollType) => {
    if (isRolling) return;
    setRollType(type);
    setIsRolling(true);

    setTimeout(() => {
      let d10s: number[] = [];
      let sum = 0;
      let fumble = false;
      let crit = false;

      // Würfel nach GRW S. 16–19 (gemeinsame Würfellogik), mit Großmeister ab 15 Punkten in der Magieschule
      const w = wuerfeln(type, grossmeister);
      d10s = w.dice;
      sum = w.result;
      fumble = w.isFumble;
      crit = w.isCrit;

      setRollDice(d10s);
      setDiceSum(sum);
      setIsFumble(fumble);
      setIsCrit(crit);
      setExtraSPBonus(0);
      setHasRolled(true);
      setCustomFailureFocus(null);
      setAllocations(INITIAL_EG_ALLOCATIONS);
      setDamageResult(null);
      setIsRolling(false);

      // Optional: Record raw roll to dice log
      if (onRecordRoll) {
        const entry: RollEntry = {
          id: generateId(),
          type: 'roll',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          label: `Zauberprobe: ${spell.name} (${schoolSkillName}) [${type === 'standard' ? 'Standard' : type === 'safe' ? 'Sicherheit' : 'Risiko'}]${situativ.labels.length ? ` [${situativ.labels.join(', ')}]` : ''}`,
          d10s,
          baseVal: schoolSkillTotal,
          modifier: totalRollModifier - schoolSkillTotal,
          total: sum + totalRollModifier,
          target: effectiveDifficulty,
          isTriumph: crit,
          isPatzer: fumble,
        };
        onRecordRoll(entry);
      }
    }, 560);
  };

  const handleApplyManualRoll = () => {
    const val = parseInt(manualRollVal, 10);
    if (isNaN(val)) return;
    setRollType('standard');
    setRollDice([Math.floor(val / 2), Math.ceil(val / 2)]);
    setDiceSum(val);
    const grenzen = wurfgrenzen();
    setIsFumble(val <= grenzen.patzer);
    setIsCrit(val >= grenzen.triumph);
    setExtraSPBonus(0);
    setHasRolled(true);
    setCustomFailureFocus(null);
    setAllocations(INITIAL_EG_ALLOCATIONS);
    setDamageResult(null);
  };

  // Splitterpunkt actions
  const handleSpendSPBonus = () => {
    if (splitterpunkte <= 0) return;
    onSpendSplitterpunkt();
    setExtraSPBonus((prev) => prev + 3);
  };

  const handleSpendSPReroll = () => {
    if (splitterpunkte <= 0) return;
    onSpendSplitterpunkt();
    performRoll(rollType);
  };

  // EG Allocation Handlers with boundary and cost checking
  // GRW S. 221–222: verzehrter Fokus ist einsparbar, solange 1 erschöpfter oder kanalisierter Punkt bleibt
  const maxVerzehrtSparen = baseCost.exhausted + baseCost.channeled >= 1 ? baseCost.consumed : Math.max(0, baseCost.consumed - 1);

  const handleModifyAllocation = (
    field: keyof SpellEGAllocations,
    costPerUnit: number,
    delta: number,
    maxLimit?: number
  ) => {
    setAllocations((prev) => {
      const currentVal = (prev[field] as number) || 0;
      const newVal = currentVal + delta;
      if (newVal < 0) return prev;
      if (maxLimit !== undefined && newVal > maxLimit) return prev;

      // Check if enough EG is available
      if (delta > 0 && remainingEG < costPerUnit) {
        return prev;
      }

      return {
        ...prev,
        [field]: newVal,
      };
    });
  };

  // Finish: Success
  const handleCompleteCast = (healSelfOption?: {
    hp?: number;
    restoreAll?: boolean;
    curesPoisonDisease?: boolean;
    /** bei „alle LP“: die vom Spieler gewählten Zustände (IDs), die der Zauber aufhebt */
    conditionIdsToRemove?: string[];
    removeCondition?: string;
    label: string;
  }) => {
    if (!egCalculation?.isSuccess) return;

    let channeledSpell: ChanneledSpell | undefined = undefined;
    if (finalCosts.effectiveChanneled > 0) {
      const targetItemName = selectedEquipmentItem
        ? selectedEquipmentItem.name
        : selectedEquipmentId === 'other'
        ? 'Fremde Waffe / Verbündeter'
        : undefined;

      channeledSpell = {
        id: generateId(),
        name: spell.name,
        school: spell.school,
        grade: spell.grade,
        channeledFocus: finalCosts.effectiveChanneled,
        castTime: zauberdauer,
        duration: spell.duration,
        range: spell.range,
        target: spell.target,
        targetItemId: selectedEquipmentItem ? selectedEquipmentItem.id : undefined,
        targetItemName,
        startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        activeRounds: 1,
        activeTicks: 0,
        selectedEnhancementIds: [...allocations.selectedEnhancementIds],
        enhancements: finalCosts.modificationsSummary,
        notes: [
          `Auslösezeit: ${finalCosts.effectiveCastTicks} Ticks`,
          `EG: ${totalEarnedEG}`,
          targetItemName ? `Ziel: ${targetItemName}` : '',
          ...finalCosts.modificationsSummary,
          spellTargetNote ? `Notiz: ${spellTargetNote}` : '',
        ].filter(Boolean).join(' · '),
      };
    }

    onCastSuccess({
      spell,
      exhaustedFocus: finalCosts.effectiveExhausted,
      channeledFocus: finalCosts.effectiveChanneled,
      consumedFocus: finalCosts.effectiveConsumed,
      isChanneled: finalCosts.effectiveChanneled > 0,
      channeledSpell,
      effectiveCastTicks: finalCosts.effectiveCastTicks,
      eg: totalEarnedEG,
      egAllocations: allocations,
      modificationsSummary: finalCosts.modificationsSummary,
      notes: spellTargetNote,
      damageRoll: currentDamageResult ?? undefined,
      healSelf: healSelfOption,
      rollDetails: {
        dice: rollDice,
        total: totalRollResult,
        difficulty: effectiveDifficulty,
        eg: totalEarnedEG,
        isCrit,
        isFumble,
      },
    });
  };

  // Finish: Failure
  const handleApplyFailure = () => {
    if (!egCalculation || egCalculation.isSuccess) return;

    const lostFO = customFailureFocus !== null ? customFailureFocus : egCalculation.exhaustedFocusLostOnFailure;

    onCastFailure({
      spell,
      exhaustedFocusLost: lostFO,
      negativeEG: egCalculation.negativeEG,
      difficulty: effectiveDifficulty,
      totalRoll: totalRollResult,
      isFumble,
      notes: spellTargetNote,
      rollDetails: {
        dice: rollDice,
        total: totalRollResult,
        difficulty: effectiveDifficulty,
        isFumble,
      },
    });
  };

  useEscape(onClose);
  return (
    <Dialoghintergrund
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalHeadingId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Dialogfenster
        id="cast-spell-modal-dialog" breite="2xl" className="lg:max-w-3xl text-erschoepft sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Dialogkopf
          titelId={modalHeadingId}
          symbol={<Sparkles className="w-4 h-4" />}
          ton="magie"
          titel={spell.name}
          untertitel={`${spell.school} · Grad ${spell.grade}${spell.source ? ` · ${spell.source}` : ''}`}
          onSchliessen={onClose}
        />

        {/* Workflow Progress Steps */}
        <div className="border-b border-gold px-3 sm:px-4 py-2 flex items-center justify-between text-xs font-semibold text-leise overflow-x-auto gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1.5 shrink-0 text-schrift">
            <span className="w-5 h-5 rounded-full bg-gold text-seite font-bold flex items-center justify-center text-[11px]">1</span>
            <span>Vorbereitung &amp; Ziel</span>
          </div>
          <span className="text-leise">→</span>
          <div className={`flex items-center gap-1.5 shrink-0 ${hasRolled ? 'text-schrift' : 'text-leise'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${hasRolled ? 'bg-gold text-seite' : 'bg-seite text-schrift'}`}>2</span>
            <span>Zauberprobe (2W10)</span>
          </div>
          <span className="text-leise">→</span>
          <div className={`flex items-center gap-1.5 shrink-0 ${hasRolled && egCalculation?.isSuccess ? 'text-schrift' : 'text-leise'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${hasRolled && egCalculation?.isSuccess ? 'bg-gold text-seite' : 'bg-seite text-schrift'}`}>3</span>
            <span>EG-Modifikationen</span>
          </div>
          <span className="text-leise">→</span>
          <div className={`flex items-center gap-1.5 shrink-0 ${hasRolled ? 'text-schrift' : 'text-leise'}`}>
            <span className="w-5 h-5 rounded-full bg-seite text-leise font-bold flex items-center justify-center text-[11px]">4</span>
            <span>Fokus abstreichen</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-3.5 sm:p-4 md:p-5 overflow-y-auto space-y-4 text-sm flex-1 custom-scrollbar modal-body-scroll">
          {/* STEP 1: Spell Info Banner - Clean responsive stat cards without superfluous subtitle texts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-erhoeht p-2.5 sm:p-3 rounded-karte border border-rahmen">
            <div className="bg-flaeche rounded-knopf p-2.5 border border-rahmen text-center sm:text-left">
              <span className="text-[11px] text-leise font-medium flex items-center justify-center sm:justify-start gap-1">
                <Clock className="w-3.5 h-3.5 text-gold" /> Zauberdauer
              </span>
              <p className="font-bold text-schrift mt-0.5 text-sm sm:text-base">
                {zauberdauer || '—'}
                {zauberdauer !== spell.castTime && <span className="line-through text-xs text-leise font-normal ml-1">{spell.castTime}</span>}
              </p>
            </div>
            <div className="bg-flaeche rounded-knopf p-2.5 border border-rahmen text-center sm:text-left">
              <span className="text-[11px] text-leise font-medium flex items-center justify-center sm:justify-start gap-1">
                <Zap className="w-3.5 h-3.5 text-gold" /> Auslösezeit
              </span>
              <p className="font-bold text-schrift mt-0.5 text-sm sm:text-base">
                {allocations.reduceCastTime > 0 ? (
                  <span>
                    {finalCosts.effectiveCastTicks} Ticks <span className="line-through text-xs text-leise font-normal">3 Ticks</span>
                  </span>
                ) : (
                  '3 Ticks'
                )}
              </p>
            </div>
            <div className="bg-flaeche rounded-knopf p-2.5 border border-rahmen text-center sm:text-left">
              <span className="text-[11px] text-leise font-medium flex items-center justify-center sm:justify-start gap-1">
                <Flame className="w-3.5 h-3.5 text-schaden" /> Grundkosten
              </span>
              <p className="font-bold text-schaden mt-0.5 text-sm sm:text-base">
                {kostenGeaendert ? kostenText(baseCost) : spell.cost || '0'}
                {kostenGeaendert && <span className="line-through text-xs text-leise font-normal ml-1">{spell.cost}</span>}
              </p>
            </div>
            <div className="bg-flaeche rounded-knopf p-2.5 border border-rahmen text-center sm:text-left">
              <span className="text-[11px] text-leise font-medium flex items-center justify-center sm:justify-start gap-1">
                <Compass className="w-3.5 h-3.5 text-gold" /> Reichweite
              </span>
              <p className="font-bold text-schrift mt-0.5 text-sm sm:text-base truncate">{spell.range || '—'}</p>
            </div>
          </div>

          <ZauberAnpassungen anpassungen={zauberWirk.anpassungen} gewaehlt={zauberWirk.gewaehlt} onToggle={zauberWirk.umschalten} />

          {/* Spell Description Collapsible */}
          {spell.description && (
            <div className="bg-flaeche rounded-karte border border-rahmen p-3 text-xs leading-relaxed text-schrift">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowSpellDetails(!showSpellDetails)}>
                <span className="font-semibold text-schrift flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Zauberwirkung &amp; Verstärkungen
                </span>
                <Knopf >
                  {showSpellDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Knopf>
              </div>
              {showSpellDetails && (
                <div className="mt-2 pt-2 border-t border-rahmen text-leise whitespace-pre-line">
                  {spell.description}
                </div>
              )}
            </div>
          )}

          {/* Ausrüstungs-Zielauswahl für Zauber, die Ausrüstung verzaubern (Flammende Waffe etc.) */}
          {equipmentTargetCheck.isEquipmentSpell && (
            <div className="bg-flaeche rounded-karte border border-rahmen p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-erhoeht text-schrift rounded-knopf border border-rahmen">
                    <Sword className="w-4 h-4 text-schrift" />
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-gold-hell flex items-center gap-1.5">
                      <span>Ziel-{equipmentTargetCheck.targetCategory} im Inventar auswählen</span>
                      <span className="text-[11px] bg-erhoeht text-schrift font-semibold px-2 py-0.5 rounded-knopf border border-rahmen">
                        Ziel: {spell.target || equipmentTargetCheck.targetCategory}
                      </span>
                    </h4>
                    <p className="text-xs text-leise">
                      {equipmentTargetCheck.constraintNote}
                    </p>
                  </div>
                </div>
              </div>

              {candidateEquipment.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {candidateEquipment.map((item) => {
                    const isSelected = selectedEquipmentId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedEquipmentId(item.id)}
                        className={`p-2.5 rounded-karte border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-erhoeht text-schrift border-gold ring-1 ring-gold'
                            : 'bg-erhoeht text-schrift border-rahmen hover:border-gold'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm truncate">{item.name}</span>
                            {item.equipped ? (
                              <span
                                className={`text-[11px] px-1.5 py-0.5 rounded-knopf font-bold ${
                                  isSelected
                                    ? 'bg-unverletzt-grund text-schrift'
                                    : 'bg-unverletzt-grund text-unverletzt border border-unverletzt'
                                }`}
                              >
                                Ausgerüstet
                              </span>
                            ) : (
                              <span
                                className={`text-[11px] px-1.5 py-0.5 rounded-knopf font-medium ${
                                  isSelected ? 'bg-erhoeht text-schrift' : 'bg-seite text-leise'
                                }`}
                              >
                                Im Rucksack
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 flex items-center gap-2 ${
                              isSelected ? 'text-schrift' : 'text-leise'
                            }`}
                          >
                            {item.weaponSkill && <span>{item.weaponSkill}</span>}
                            {item.damage && <span className="tabular-nums font-bold">{item.damage}</span>}
                            {item.wgs && <span>WGS {item.wgs}</span>}
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-gold bg-gold' : 'border-leise bg-flaeche'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-erhoeht" />}
                        </div>
                      </div>
                    );
                  })}

                  {/* Option: Fremdes Ziel / Verbündeter */}
                  <div
                    onClick={() => setSelectedEquipmentId('other')}
                    className={`p-2.5 rounded-karte border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      selectedEquipmentId === 'other'
                        ? 'bg-erhoeht text-schrift border-gold ring-1 ring-gold'
                        : 'bg-erhoeht text-schrift border-rahmen hover:border-gold'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-sm block">Waffe eines Verbündeten / Fremde Waffe</span>
                      <span
                        className={`text-[11px] block ${
                          selectedEquipmentId === 'other' ? 'text-schrift' : 'text-leise'
                        }`}
                      >
                        Wirkung auf Ausrüstung eines anderen Charakters
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedEquipmentId === 'other' ? 'border-gold bg-gold' : 'border-leise bg-flaeche'
                      }`}
                    >
                      {selectedEquipmentId === 'other' && <div className="w-1.5 h-1.5 rounded-full bg-erhoeht" />}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-erschoepft-grund rounded-karte border border-gold-hell text-xs text-erschoepft space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-erschoepft" />
                    Keine passende Ausrüstung im Inventar
                  </p>
                  <p>{equipmentTargetCheck.constraintNote}</p>
                  <p className="text-[11px] text-erschoepft italic">
                    Der Zauber wird als Wirkung auf eine fremde Ausrüstung / Verbündeten eingetragen.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Difficulty & Target Selection */}
          {isFixedDifficulty ? (
            <div className="bg-flaeche rounded-karte border border-rahmen p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-schrift flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-schaden" /> Schwierigkeit des Zaubers
                  </span>
                  <span className="text-xs text-leise">
                    Fester Wert laut Datenbank ({spell.difficulty ?? fixedDiffValue})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-leise font-medium">Feste Schwierigkeit:</span>
                  <div className="px-4 py-1.5 rounded-knopf bg-erhoeht text-schrift tabular-nums font-bold text-lg ">
                    {fixedDiffValue}
                  </div>
                </div>
              </div>

              {/* Optional Target Note */}
              <div className="pt-2 border-t border-rahmen">
                <input
                  type="text"
                  value={spellTargetNote}
                  onChange={(e) => setSpellTargetNote(e.target.value)}
                  placeholder="Ziel oder Anmerkung (z. B. Verbündeter, Reisegruppe) …"
                  className="w-full text-xs px-3 py-1.5 border border-rahmen rounded-knopf bg-erhoeht focus:outline-none focus:ring-2 focus:ring-rahmen text-schrift placeholder-leise"
                />
              </div>
            </div>
          ) : (
            <div className="bg-flaeche rounded-karte border border-rahmen p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label htmlFor="spell-diff-input" className="font-bold text-sm text-schrift flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-schaden" /> Schwierigkeit des Zaubers
                  </label>
                  <span className="text-xs text-schaden font-medium">
                    Variabel laut Datenbank: {spell.difficulty || `Gegen ${spell.difficultyType ?? 'Widerstand'} des Ziels`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    id="spell-diff-input"
                    type="number"
                    min={1}
                    max={45}
                    value={difficulty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 15;
                      setDifficulty(val);
                      setSelectedPreset('custom');
                    }}
                    className="w-16 text-center font-bold text-base py-1 px-2 border border-rahmen rounded-knopf bg-erhoeht focus:outline-none focus:ring-2 focus:ring-rahmen"
                  />
                </div>
              </div>

              {/* Presets Chips */}
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { label: 'VTD Ziel (16)', val: 16 },
                  { label: 'GW Ziel (15)', val: 15 },
                  { label: 'KW Ziel (17)', val: 17 },
                  { label: '12 (Leicht)', val: 12 },
                  { label: '15 (Standard)', val: 15 },
                  { label: '18 (Herausfordernd)', val: 18 },
                  { label: '21 (Schwer)', val: 21 },
                  { label: '24 (Sehr schwer)', val: 24 },
                ].map((p) => {
                  const isActive = difficulty === p.val && selectedPreset === p.label;
                  return (
                    <Wahlknopf gewaehlt={isActive} mittig key={p.label} onClick={() => {
                        setDifficulty(p.val);
                        setSelectedPreset(p.label);
                      }} className="text-xs font-medium">
                      {p.label}
                    </Wahlknopf>
                  );
                })}
              </div>

              {/* Optional Target Note */}
              <div>
                <input
                  type="text"
                  value={spellTargetNote}
                  onChange={(e) => setSpellTargetNote(e.target.value)}
                  placeholder="Ziel oder Anmerkung (z. B. 'Ork-Krieger', 'Reisegruppe', 'Gegnerischer Zauberer')..."
                  className="w-full text-xs px-3 py-1.5 border border-rahmen rounded-knopf bg-erhoeht focus:outline-none focus:ring-2 focus:ring-rahmen text-schrift placeholder-leise"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Probe Calculation & Rolling */}
          <div className="bg-flaeche rounded-karte border border-rahmen p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-rahmen pb-2.5">
              <div>
                <span className="text-xs font-semibold text-leise uppercase tracking-wider">Zauberprobe</span>
                <p className="font-bold text-schrift text-base">{schoolSkillName}</p>
              </div>

              {/* Modifiers breakdown */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="bg-erhoeht text-schrift border border-rahmen px-2 py-0.5 rounded-knopf tabular-nums font-bold">
                  FW +{schoolSkillTotal}
                </span>
                {woundPenalty !== 0 && (
                  <span className="bg-schaden-grund text-schrift border border-schaden px-2 py-0.5 rounded-knopf tabular-nums font-bold">
                    Wundabzug {woundPenalty}
                  </span>
                )}
                {totalConditionPenalty !== 0 && (
                  <span className="bg-erhoeht text-schrift border border-magie px-2 py-0.5 rounded-knopf tabular-nums">
                    Zustände {totalConditionPenalty}
                  </span>
                )}
                {situativ.summe !== 0 && (
                  <span className="bg-unverletzt-grund text-schrift border border-unverletzt px-2 py-0.5 rounded-knopf tabular-nums">
                    Stärken/MS {situativ.summe > 0 ? '+' : ''}{situativ.summe}
                  </span>
                )}
                <div className="flex items-center gap-1 bg-flaeche border border-rahmen px-1.5 py-0.5 rounded-knopf text-xs">
                  <span className="text-leise">Sit.:</span>
                  <Knopf
                    onClick={() => setSituationalMod((prev) => prev - 1)}
                  >
                    -
                  </Knopf>
                  <span className="tabular-nums font-bold text-schrift">{situationalMod >= 0 ? `+${situationalMod}` : situationalMod}</span>
                  <Knopf
                    onClick={() => setSituationalMod((prev) => prev + 1)}
                  >
                    +
                  </Knopf>
                </div>
                <span className="font-bold text-sm text-schrift pl-1">
                  = {totalRollModifier >= 0 ? `+${totalRollModifier}` : totalRollModifier}
                </span>
              </div>
            </div>

            <SituativeBoni boni={situativ.boni} gewaehlt={situativ.gewaehlt} onToggle={situativ.umschalten} typen={situativ.typen} zielTypus={situativ.zielTypus} onZielTypus={situativ.setZielTypus} />

            {/* Roll Buttons or Roll Result */}
            {!hasRolled ? (
              <div className="space-y-3 pt-1">
                {/* Wurfart-Auswahl wie im normalen Proben-Fenster */}
                <div>
                  <label className="block text-xs uppercase text-leise font-bold mb-1.5">Wurfart</label>
                  <div className="flex gap-2">
                    {([
                      { key: 'standard', label: 'Standard' },
                      { key: 'safe', label: 'Sicherheit' },
                      { key: 'risk', label: 'Risiko' },
                    ] as { key: RollType; label: string }[]).map(({ key, label }) => (
                      <Wahlknopf gewaehlt={rollType === key} mittig key={key} onClick={() => setRollType(key)} disabled={isRolling} className="flex-1 text-sm font-bold">
                        {label}
                      </Wahlknopf>
                    ))}
                  </div>
                </div>

                {/* Roll button */}
                <Knopf
                  onClick={() => performRoll(rollType)}
                  disabled={isRolling}
                  className="w-full min-h-11 bg-gold hover:bg-gold-hell disabled:opacity-60 text-seite font-bold py-3 rounded-knopf text-base transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <DiceIcon size={20} />
                  <span>Würfeln!</span>
                </Knopf>

                {/* Dice rolling animation */}
                {isRolling && (
                  <div className="flex justify-center gap-4 py-3">
                    {Array.from({ length: rollType === 'risk' ? 4 : 2 }).map((_, i) => (
                      <div key={i} className="dice-roll">
                        <DiceIcon size={48} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Manual Table Roll Accordion */}
                <div className="pt-1">
                  <Knopf
                    onClick={() => setManualInputOpen(!manualInputOpen)}
                    className="text-[11px] underline"
                  >
                    {manualInputOpen ? 'Würfeleingabe schließen' : 'Am Tisch mit echten Würfeln gewürfelt? Hier eintragen'}
                  </Knopf>
                  {manualInputOpen && (
                    <div className="flex items-center gap-2 mt-2 bg-erhoeht p-2.5 rounded-knopf border border-rahmen">
                      <span className="text-xs text-leise">Reines 2W10-Ergebnis (2–20):</span>
                      <input
                        type="number"
                        min={2}
                        max={20}
                        value={manualRollVal}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setManualRollVal(e.target.value)}
                        placeholder="z. B. 15"
                        className="w-16 px-2 py-1 text-center font-bold border rounded-knopf"
                      />
                      <Knopf
                        onClick={handleApplyManualRoll}
                        disabled={!manualRollVal}
                        className="text-xs"
                      >
                        Übernehmen
                      </Knopf>
                    </div>
                  )}
                </div>
              </div>
            ) : isRolling ? (
              /* Dice rolling animation during rerolls */
              <div className="flex justify-center items-center py-8 gap-4 bg-erhoeht rounded-karte border border-rahmen">
                {Array.from({ length: rollType === 'risk' ? 4 : 2 }).map((_, i) => (
                  <div key={i} className="dice-roll">
                    <DiceIcon size={48} />
                  </div>
                ))}
              </div>
            ) : (
              /* Already Rolled Display */
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-erhoeht rounded-karte p-3.5 border border-rahmen gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {rollDice.map((d, i) => (
                        <div
                          key={i}
                          className={`w-10 h-10 rounded-knopf bg-flaeche border border-rahmen flex items-center justify-center font-bold text-lg text-schrift ${
                            rollType === 'risk' && i < 2 && !isFumble ? 'opacity-40' : ''
                          }`}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs text-leise">
                        Würfel {diceSum} {totalRollModifier >= 0 ? `+ ${totalRollModifier}` : `- ${Math.abs(totalRollModifier)}`}
                        {extraSPBonus > 0 ? ` + ${extraSPBonus} SP` : ''}
                        <span className="ml-1.5 font-semibold text-leise">
                          ({rollType === 'standard' ? 'Standard' : rollType === 'safe' ? 'Sicherheit' : 'Risiko'})
                        </span>
                      </div>
                      <div className="font-extrabold text-xl md:text-2xl text-schrift flex items-center gap-2">
                        <span>Ergebnis: {totalRollResult}</span>
                        <span className="text-xs font-normal text-leise">(gegen {difficulty})</span>
                        {isCrit && <span className="text-gold text-xs font-bold uppercase tracking-wider">Triumph</span>}
                        {isFumble && <span className="text-schaden text-xs font-bold uppercase tracking-wider">Patzer</span>}
                      </div>
                    </div>
                  </div>

                  {/* Splitterpunkte Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                    <Knopf art="primaer"
                      onClick={handleSpendSPBonus}
                      disabled={splitterpunkte <= 0 || isRolling}
                      title="Kostet 1 Splitterpunkt: +3 Bonus auf das Ergebnis"
                      className="px-2.5 py-1.5 bg-gold hover:bg-gold-hell text-seite border border-erschoepft rounded-knopf text-xs font-bold transition-colors disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>+3 (1 SP)</span>
                    </Knopf>
                    <Knopf art="sekundaer"
                      onClick={handleSpendSPReroll}
                      disabled={splitterpunkte <= 0 || isRolling}
                      title="Kostet 1 Splitterpunkt: Neuwurf"
                      className="px-2.5 py-1.5 bg-flaeche text-schrift border border-gold hover:bg-rahmen rounded-knopf text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reroll (1 SP)</span>
                    </Knopf>
                    <Knopf nurSymbol
                      onClick={() => performRoll(rollType)}
                      disabled={isRolling}
                      title="Erneut würfeln"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Knopf>
                    <Knopf
                      onClick={() => setHasRolled(false)}
                      disabled={isRolling}
                      title="Wurfart ändern / Neu vorbereiten"
                      className="text-xs underline ml-1"
                    >
                      Wurfart ändern
                    </Knopf>
                  </div>
                </div>

                {/* STEP 3: Evaluation Banner */}
                {egCalculation && (
                  <div>
                    {egCalculation.isSuccess ? (
                      /* Success Box */
                      <div className="bg-erhoeht border border-gold text-schrift rounded-karte p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-erhoeht text-gold border border-rahmen flex items-center justify-center font-bold shrink-0">
                            <Check className="w-5 h-5 text-gold" />
                          </div>
                          <div>
                            <p className="font-bold text-schrift">Zauber gelungen!</p>
                            <p className="text-xs text-leise">
                              {egCalculation.differenz} Punkte über Schwierigkeit {difficulty} →{' '}
                              <span className="font-bold text-schrift">{egCalculation.eg} Erfolgsgrad(e) (EG)</span> erzielt.
                              {egCalculation.isCrit ? ' (+3 EG durch Triumph)' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-block bg-erhoeht text-gold border border-gold px-3 py-1 rounded-knopf font-bold text-sm tabular-nums">
                            {egCalculation.eg} EG
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Failure Box */
                      <div className="bg-erhoeht border border-schaden text-schrift rounded-karte p-3.5 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-schaden-grund text-schrift flex items-center justify-center font-bold shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-schaden">Zauber verpufft!</p>
                            <p className="text-xs text-leise">
                              {Math.abs(egCalculation.differenz)} Punkte unter Schwierigkeit {difficulty} (
                              {egCalculation.negativeEG} negative EG). Bei Misslingen verpufft der Zauber und du erschöpfst Fokuspunkte in Höhe der negativen Erfolgsgrade.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-rahmen text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-schaden">Zu erschöpfender Fokus:</span>
                            <div className="flex items-center gap-1 bg-flaeche border border-rahmen rounded-knopf px-1 py-0.5">
                              <Knopf
                                onClick={() =>
                                  setCustomFailureFocus((prev) =>
                                    Math.max(0, (prev !== null ? prev : egCalculation.exhaustedFocusLostOnFailure) - 1)
                                  )
                                }
                              >
                                -
                              </Knopf>
                              <span className="font-bold tabular-nums px-1 text-schrift">
                                {customFailureFocus !== null ? customFailureFocus : egCalculation.exhaustedFocusLostOnFailure} FO
                              </span>
                              <Knopf
                                onClick={() =>
                                  setCustomFailureFocus((prev) =>
                                    (prev !== null ? prev : egCalculation.exhaustedFocusLostOnFailure) + 1
                                  )
                                }
                              >
                                +
                              </Knopf>
                            </div>
                          </div>

                          <Knopf art="gefahr"
                            onClick={handleApplyFailure}
                            className="min-h-11 py-1.5 px-3 bg-schaden-grund hover:bg-schaden-grund hover:text-schrift text-schrift rounded-knopf font-bold border border-schaden transition-colors cursor-pointer"
                          >
                            Fehlschlag anwenden (-{customFailureFocus !== null ? customFailureFocus : egCalculation.exhaustedFocusLostOnFailure} FO)
                          </Knopf>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 4: EG Modifications Allocation (Only on Success) */}
          {hasRolled && egCalculation?.isSuccess && (
            <div className="bg-flaeche rounded-karte border border-rahmen p-5 space-y-4">
              {/* Clean EG Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-erhoeht p-3 rounded-karte border border-rahmen">
                <div>
                  <span className="text-xs text-leise font-medium">Verfügbare Erfolgsgrade (EG)</span>
                  <p className="text-sm font-bold text-schrift">
                    Erzielt: <span className="text-schrift font-bold">{totalEarnedEG} EG</span> · Eingesetzt:{' '}
                    <span className="text-gold font-bold">{spentEG} EG</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-knopf text-xs font-bold border transition-all ${
                      remainingEG === 0
                        ? 'bg-erhoeht text-gold border-gold'
                        : 'bg-erhoeht text-schrift border-gold'
                    }`}
                  >
                    {remainingEG === 0 ? 'Alle EG verteilt' : `Noch ${remainingEG} EG verfügbar`}
                  </span>
                  {spentEG > 0 && (
                    <Knopf
                      onClick={() => setAllocations(INITIAL_EG_ALLOCATIONS)}
                      className="text-xs underline"
                    >
                      Zurücksetzen
                    </Knopf>
                  )}
                </div>
              </div>

              {/* Options Grid according to Splittermond Rules & Database */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-rahmen pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-leise">
                    Zulässige Modifikationen
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-leise font-medium mr-1">Regelwerk-Prüfung:</span>
                    {permissibleMods.allowedNames.map((modName) => (
                      <span
                        key={modName}
                        className="px-1.5 py-0.5 bg-erhoeht text-schrift border border-rahmen rounded-knopf text-[11px] font-semibold"
                      >
                        {modName}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 1. Fokus einsparen (Erschöpfter Fokus) */}
                {permissibleMods.allowsExhaustedFocus && baseCost.exhausted > 0 && (
                  <div className="flex items-center justify-between p-2.5 bg-erhoeht rounded-karte border border-rahmen">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-sm text-schrift flex items-center gap-1.5">
                        <span>Fokus einsparen (Erschöpft)</span>
                        <span className="text-[11px] bg-erhoeht text-schrift border border-rahmen font-semibold px-1.5 py-0.5 rounded-knopf">
                          je 1 EG = -1 FO
                        </span>
                      </div>
                      <p className="text-xs text-leise">
                        Spart erschöpften Fokus ein (Mindestkosten: 1 FO). Aktuell: {finalCosts.effectiveExhausted} FO{' '}
                        {allocations.saveExhaustedFocus > 0 && `(vorher ${baseCost.exhausted} FO)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('saveExhaustedFocus', 1, -1)}
                        disabled={allocations.saveExhaustedFocus <= 0}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Knopf>
                      <span className="font-bold tabular-nums text-sm w-5 text-center">
                        {allocations.saveExhaustedFocus}
                      </span>
                      <Knopf nurSymbol
                        onClick={() =>
                          handleModifyAllocation('saveExhaustedFocus', 1, 1, Math.max(0, baseCost.exhausted - 1))
                        }
                        disabled={remainingEG < 1 || allocations.saveExhaustedFocus >= Math.max(0, baseCost.exhausted - 1)}
                        className="hover:brightness-110"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Knopf>
                    </div>
                  </div>
                )}

                {/* 2. Fokus einsparen (Kanalisierter Fokus) */}
                {permissibleMods.allowsChanneledFocus && baseCost.channeled > 0 && (
                  <div className="flex items-center justify-between p-2.5 bg-erhoeht rounded-karte border border-rahmen">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-sm text-schrift flex items-center gap-1.5">
                        <span>Fokus einsparen (Kanalisiert)</span>
                        <span className="text-[11px] bg-erhoeht text-schrift border border-rahmen font-semibold px-1.5 py-0.5 rounded-knopf">
                          je 2 EG = -1 FO
                        </span>
                      </div>
                      <p className="text-xs text-leise">
                        Spart kanalisierten Fokus ein (Mindestkosten: 1 FO). Aktuell: {finalCosts.effectiveChanneled} FO
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('saveChanneledFocus', 2, -1)}
                        disabled={allocations.saveChanneledFocus <= 0}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Knopf>
                      <span className="font-bold tabular-nums text-sm w-5 text-center">
                        {allocations.saveChanneledFocus}
                      </span>
                      <Knopf nurSymbol
                        onClick={() =>
                          handleModifyAllocation('saveChanneledFocus', 2, 1, Math.max(0, baseCost.channeled - 1))
                        }
                        disabled={remainingEG < 2 || allocations.saveChanneledFocus >= Math.max(0, baseCost.channeled - 1)}
                        className="hover:brightness-110"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Knopf>
                    </div>
                  </div>
                )}

                {/* 3. Fokus einsparen (Verzehrter Fokus) */}
                {permissibleMods.allowsConsumedFocus && baseCost.consumed > 0 && (
                  <div className="flex items-center justify-between p-2.5 bg-erhoeht rounded-karte border border-rahmen">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-sm text-schrift flex items-center gap-1.5">
                        <span>Fokus einsparen (Verzehrt)</span>
                        <span className="text-[11px] bg-erhoeht text-schrift border border-magie font-semibold px-1.5 py-0.5 rounded-knopf">
                          je 3 EG = -1 FO
                        </span>
                      </div>
                      <p className="text-xs text-leise">
                        Spart verzehrten Fokus ein (Mindestkosten: 1 FO). Aktuell: {finalCosts.effectiveConsumed} FO
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('saveConsumedFocus', 3, -1)}
                        disabled={allocations.saveConsumedFocus <= 0}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Knopf>
                      <span className="font-bold tabular-nums text-sm w-5 text-center">
                        {allocations.saveConsumedFocus}
                      </span>
                      <Knopf nurSymbol
                        onClick={() =>
                          handleModifyAllocation('saveConsumedFocus', 3, 1, maxVerzehrtSparen)
                        }
                        disabled={remainingEG < 3 || allocations.saveConsumedFocus >= maxVerzehrtSparen}
                        className="hover:brightness-110"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Knopf>
                    </div>
                  </div>
                )}

                {/* 4. Schaden erhöhen */}
                {permissibleMods.allowsDamage && (
                  <div className="flex items-center justify-between p-2.5 bg-erhoeht rounded-karte border border-rahmen">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-sm text-schrift flex items-center gap-1.5">
                        <span>Schaden erhöhen</span>
                        <span className="text-[11px] bg-erhoeht text-schrift border border-magie font-semibold px-1.5 py-0.5 rounded-knopf">
                          je 1 EG = +1 Schaden
                        </span>
                      </div>
                      <p className="text-xs text-leise">
                        Erhöht den direkt angerichteten Schaden um +1 Punkt pro EG.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('increaseDamage', 1, -1)}
                        disabled={allocations.increaseDamage <= 0}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Knopf>
                      <span className="font-bold tabular-nums text-sm w-5 text-center">{allocations.increaseDamage}</span>
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('increaseDamage', 1, 1)}
                        disabled={remainingEG < 1}
                        className="hover:brightness-110"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Knopf>
                    </div>
                  </div>
                )}

                {/* 5. Reichweite erhöhen */}
                {permissibleMods.allowsRange && (
                  <div className="flex items-center justify-between p-2.5 bg-erhoeht rounded-karte border border-rahmen">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-sm text-schrift flex items-center gap-1.5">
                        <span>Reichweite erhöhen</span>
                        <span className="text-[11px] bg-erhoeht text-schrift border border-rahmen font-semibold px-1.5 py-0.5 rounded-knopf">
                          je 1 EG = +Grundwert
                        </span>
                      </div>
                      <p className="text-xs text-leise">
                        Grundwert ({spell.range || '—'}) erhöht sich um das {allocations.increaseRange + 1}-Fache.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('increaseRange', 1, -1)}
                        disabled={allocations.increaseRange <= 0}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Knopf>
                      <span className="font-bold tabular-nums text-sm w-5 text-center">{allocations.increaseRange}</span>
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('increaseRange', 1, 1)}
                        disabled={remainingEG < 1}
                        className="hover:brightness-110"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Knopf>
                    </div>
                  </div>
                )}

                {/* 6. Wirkungsdauer verlängern */}
                {permissibleMods.allowsDuration && (
                  <div className="flex items-center justify-between p-2.5 bg-erhoeht rounded-karte border border-rahmen">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-sm text-schrift flex items-center gap-1.5">
                        <span>Wirkungsdauer verlängern</span>
                        <span className="text-[11px] bg-erhoeht text-schrift border border-rahmen font-semibold px-1.5 py-0.5 rounded-knopf">
                          je 2 EG = +Grundwert
                        </span>
                      </div>
                      <p className="text-xs text-leise">
                        Grundwert ({spell.duration || '—'}) verlängert sich um den Grundwert.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('increaseDuration', 2, -1)}
                        disabled={allocations.increaseDuration <= 0}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Knopf>
                      <span className="font-bold tabular-nums text-sm w-5 text-center">{allocations.increaseDuration}</span>
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('increaseDuration', 2, 1)}
                        disabled={remainingEG < 2}
                        className="hover:brightness-110"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Knopf>
                    </div>
                  </div>
                )}

                {/* 7. Auslösezeit verkürzen */}
                {permissibleMods.allowsCastTime && (
                  <div className="flex items-center justify-between p-2.5 bg-erhoeht rounded-karte border border-rahmen">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-sm text-schrift flex items-center gap-1.5">
                        <span>Auslösezeit verkürzen</span>
                        <span className="text-[11px] bg-erhoeht text-schrift border border-rahmen font-semibold px-1.5 py-0.5 rounded-knopf">
                          je 3 EG = -1 Tick (max 2)
                        </span>
                      </div>
                      <p className="text-xs text-leise">
                        Auslösezeit sinkt von 3 Ticks auf {finalCosts.effectiveCastTicks} Ticks.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('reduceCastTime', 3, -1)}
                        disabled={allocations.reduceCastTime <= 0}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Knopf>
                      <span className="font-bold tabular-nums text-sm w-5 text-center">{allocations.reduceCastTime}</span>
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('reduceCastTime', 3, 1, 2)}
                        disabled={remainingEG < 3 || allocations.reduceCastTime >= 2}
                        className="hover:brightness-110"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Knopf>
                    </div>
                  </div>
                )}

                {/* 8. Wirkungsbereich erweitern */}
                {permissibleMods.allowsArea && (
                  <div className="flex items-center justify-between p-2.5 bg-erhoeht rounded-karte border border-rahmen">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-sm text-schrift flex items-center gap-1.5">
                        <span>Wirkungsbereich erweitern</span>
                        <span className="text-[11px] bg-erhoeht text-schrift border border-rahmen font-semibold px-1.5 py-0.5 rounded-knopf">
                          je 3 EG = +Grundbereich
                        </span>
                      </div>
                      <p className="text-xs text-leise">
                        Erhöht den Radius/Bereich gemäß der Zauberbeschreibung.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('expandArea', 3, -1)}
                        disabled={allocations.expandArea <= 0}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Knopf>
                      <span className="font-bold tabular-nums text-sm w-5 text-center">{allocations.expandArea}</span>
                      <Knopf nurSymbol
                        onClick={() => handleModifyAllocation('expandArea', 3, 1)}
                        disabled={remainingEG < 3}
                        className="hover:brightness-110"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Knopf>
                    </div>
                  </div>
                )}

                {/* 9. Zauberspezifische Verstärkung aus Spruchdatenbank (Verstärken) */}
                {permissibleMods.allowsEnhance && permissibleMods.specificEnhancements.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-rahmen">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-schrift flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-magie" />
                        <span>Spezifische Zauber-Verstärkung</span>
                        <span className="text-[11px] bg-erhoeht text-schrift border border-rahmen font-semibold px-2 py-0.5 rounded-knopf">
                          Aus Spruchdaten
                        </span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      {permissibleMods.specificEnhancements.map((enh) => {
                        const isSelected = allocations.selectedEnhancementIds.includes(enh.id);
                        const canSelect = isSelected || remainingEG >= enh.egCost;
                        return (
                          <div
                            key={enh.id}
                            onClick={() => {
                              if (!canSelect && !isSelected) return;
                              handleToggleEnhancement(enh);
                            }}
                            className={`p-3 rounded-karte border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isSelected
                                ? 'bg-erhoeht border-gold ring-1 ring-gold'
                                : canSelect
                                ? 'bg-erhoeht border-rahmen hover:border-gold'
                                : 'bg-erhoeht border-rahmen opacity-50 cursor-not-allowed dark-theme-slot-inactive'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-xs bg-erhoeht text-schrift px-2 py-0.5 rounded-knopf tabular-nums border border-rahmen">
                                  {enh.egCost} EG
                                </span>
                                {enh.focusCostRaw && (
                                  <span className="font-semibold text-xs bg-erhoeht text-schrift border border-magie px-1.5 py-0.5 rounded-knopf tabular-nums">
                                    Kosten {enh.focusCostRaw}
                                  </span>
                                )}
                                {enh.zustaende?.map((z) => (
                                  <span key={z.name} data-testid="verstaerkung-zustand" title={z.beleg} className="text-xs bg-erhoeht text-schrift border border-schaden px-1.5 py-0.5 rounded-knopf">
                                    Ziel: {verstaerkungsZustandText(z)}
                                  </span>
                                ))}
                                {isSelected && (
                                  <span className="text-[11px] bg-unverletzt-grund text-unverletzt font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    ✓ Aktiviert
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-schrift font-medium leading-relaxed">
                                {enh.description}
                              </p>
                            </div>

                            <div className="shrink-0 pt-0.5">
                              <div
                                className={`w-5 h-5 rounded-knopf border flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-erhoeht border-gold text-gold'
                                    : 'border-rahmen bg-flaeche'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 10. Eigene / Manuelle Verstärkung hinzufügen (Optional/Erweiterbar) */}
                <div className="pt-1 border-t border-rahmen">
                  <Knopf
                    onClick={() => setShowCustomEnhancement((prev) => !prev)}
                    className="text-[11px] gap-1"
                  >
                    <span>{showCustomEnhancement ? '− Eigene Verstärkung verbergen' : '+ Eigene/manuelle Verstärkung eintragen'}</span>
                  </Knopf>

                  {showCustomEnhancement && (
                    <div className="mt-2 p-3 bg-erhoeht rounded-karte border border-rahmen space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-schrift">Individuelle Verstärkung</span>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-leise">EG-Kosten:</span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={allocations.customEnhancementEG}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              const otherEG = spentEG - allocations.customEnhancementEG;
                              if (otherEG + val <= totalEarnedEG) {
                                setAllocations((prev) => ({ ...prev, customEnhancementEG: val }));
                              }
                            }}
                            className="w-12 text-center py-0.5 border rounded-knopf tabular-nums font-bold"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={allocations.customEnhancementText}
                        onChange={(e) => setAllocations((prev) => ({ ...prev, customEnhancementText: e.target.value }))}
                        placeholder="Beschreibung der Verstärkung (z. B. '+1 Ziel', 'Verdoppelt Barriere')..."
                        className="w-full text-xs px-2.5 py-1.5 border border-rahmen rounded-knopf bg-flaeche"
                      />
                      <div className="flex items-center gap-2 text-xs text-leise">
                        <span>Zusätzlicher Fokusaufwand (falls verlangt):</span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={allocations.customEnhancementExtraFocus}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setAllocations((prev) => ({ ...prev, customEnhancementExtraFocus: val }));
                          }}
                          className="w-12 text-center py-0.5 border rounded-knopf tabular-nums"
                        />
                        <select
                          value={allocations.customEnhancementExtraFocusType}
                          onChange={(e) =>
                            setAllocations((prev) => ({
                              ...prev,
                              customEnhancementExtraFocusType: e.target.value as 'exhausted' | 'channeled' | 'consumed',
                            }))
                          }
                          className="border rounded-knopf text-xs py-0.5 px-1 bg-flaeche"
                        >
                          <option value="exhausted">Erschöpft</option>
                          <option value="channeled">Kanalisiert</option>
                          <option value="consumed">Verzehrt</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4.5: Damage Roller (Schaden würfeln) */}
          {hasRolled && egCalculation?.isSuccess && (
            <>
              {(enableDamageRoll || detectedDamage || allocations.increaseDamage > 0) ? (
                <div className="bg-flaeche rounded-karte border border-rahmen p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-erhoeht text-schrift rounded-knopf border border-magie">
                        <Flame className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="font-bold text-sm text-gold-hell flex items-center gap-1.5">
                          <span>Zauberschaden würfeln</span>
                          <span className="text-[11px] bg-erhoeht text-schrift font-semibold px-2 py-0.5 rounded-knopf border border-magie">
                            {customDamageType}
                          </span>
                        </h4>
                        <div className="text-xs text-leise flex items-center gap-1.5">
                          <span>
                            Formel:{' '}
                            <strong className="tabular-nums text-schrift">
                              {customDiceCount}W{customDiceSides}
                              {customBaseBonus > 0 ? `+${customBaseBonus}` : ''}
                            </strong>
                          </span>
                          {allocations.increaseDamage > 0 && (
                            <span className="text-schrift font-bold tabular-nums text-[11px] bg-erhoeht px-1.5 py-0.5 rounded-knopf border border-rahmen">
                              +{allocations.increaseDamage} EG
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Knopf
                      onClick={() => setShowDamageConfig((prev) => !prev)}
                      className="text-xs underline decoration-dotted"
                    >
                      {showDamageConfig ? 'Formel einklappen' : 'Formel anpassen'}
                    </Knopf>
                  </div>

                  {/* Damage Formula Configurator */}
                  {showDamageConfig && (
                    <div className="p-3 bg-erhoeht rounded-knopf border border-rahmen text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-leise font-medium mb-1">Würfelanzahl</label>
                        <div className="flex items-center gap-1">
                          <Knopf nurSymbol onClick={() => setCustomDiceCount((c) => Math.max(1, c - 1))}>
                            -
                          </Knopf>
                          <span className="tabular-nums font-bold w-6 text-center text-schrift">{customDiceCount}</span>
                          <Knopf nurSymbol onClick={() => setCustomDiceCount((c) => Math.min(20, c + 1))}>
                            +
                          </Knopf>
                        </div>
                      </div>

                      <div>
                        <label className="block text-leise font-medium mb-1">Würfelart</label>
                        <select
                          value={customDiceSides}
                          onChange={(e) => setCustomDiceSides(parseInt(e.target.value, 10))}
                          className="w-full border border-rahmen rounded-knopf px-1.5 py-1 bg-flaeche tabular-nums text-xs text-schrift"
                        >
                          <option value={6}>W6</option>
                          <option value={10}>W10</option>
                          <option value={8}>W8</option>
                          <option value={12}>W12</option>
                          <option value={4}>W4</option>
                          <option value={20}>W20</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-leise font-medium mb-1">Basis-Bonus</label>
                        <input
                          type="number"
                          value={customBaseBonus}
                          onChange={(e) => setCustomBaseBonus(parseInt(e.target.value, 10) || 0)}
                          className="w-full border border-rahmen rounded-knopf px-2 py-0.5 tabular-nums text-xs bg-flaeche text-schrift"
                        />
                      </div>

                      <div>
                        <label className="block text-leise font-medium mb-1">Schadensart</label>
                        <input
                          type="text"
                          value={customDamageType}
                          onChange={(e) => setCustomDamageType(e.target.value)}
                          className="w-full border border-rahmen rounded-knopf px-2 py-0.5 text-xs bg-flaeche text-schrift"
                        />
                      </div>
                    </div>
                  )}

                  {/* Roll Action Area */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Knopf
                      onClick={() => handleRollDamage()}
                      className="flex-1 text-xs sm:text-sm gap-2 active:scale-98"
                    >
                      <DiceIcon size={16} />
                      <span>
                        {currentDamageResult ? 'Schaden erneut würfeln' : 'Schaden jetzt würfeln'} (
                        {customDiceCount}W{customDiceSides}
                        {customBaseBonus > 0 ? `+${customBaseBonus}` : ''}
                        {allocations.increaseDamage > 0 ? `+${allocations.increaseDamage}` : ''})
                      </span>
                    </Knopf>

                    <Knopf
                      onClick={() => setManualDamageInputOpen((prev) => !prev)}
                      className="text-xs"
                      title="Am Tisch mit physischen Würfeln gewürfelt? Hier eintragen"
                    >
                      Tisch-Wurf
                    </Knopf>
                  </div>

                  {/* Manual Damage Input */}
                  {manualDamageInputOpen && (
                    <div className="p-2.5 bg-erhoeht rounded-knopf border border-rahmen text-xs space-y-2 animate-in fade-in duration-100">
                      <p className="text-leise">
                        Augenzahlen deiner {customDiceCount} Würfel eintragen (z. B.{' '}
                        {customDiceCount === 2 ? '4, 5' : '5'}):
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={manualDamageInputVal}
                          onChange={(e) => setManualDamageInputVal(e.target.value)}
                          placeholder={customDiceCount === 2 ? '4, 5' : '5'}
                          className="flex-1 border border-rahmen rounded-knopf px-2 py-1 tabular-nums bg-flaeche text-xs text-schrift"
                        />
                        <Knopf
                          onClick={handleApplyManualDamage}
                        >
                          Übernehmen
                        </Knopf>
                      </div>
                    </div>
                  )}

                  {/* Damage Roll Result Box */}
                  {currentDamageResult && (
                    <div className="bg-erhoeht rounded-karte p-3 border border-rahmen flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-leise font-medium">Augen:</span>
                          <div className="flex items-center gap-1">
                            {currentDamageResult.dice.map((d, i) => (
                              <span
                                key={i}
                                className="w-6 h-6 rounded-knopf bg-flaeche text-schrift font-bold tabular-nums text-xs flex items-center justify-center border border-rahmen"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-leise tabular-nums">
                            = {currentDamageResult.diceSum}
                          </span>
                          {currentDamageResult.baseBonus > 0 && (
                            <span className="text-xs text-leise tabular-nums">
                              + {currentDamageResult.baseBonus}
                            </span>
                          )}
                          {currentDamageResult.egBonus > 0 && (
                            <span className="text-xs text-schrift font-bold tabular-nums">
                              + {currentDamageResult.egBonus} EG
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-leise">Schaden:</span>
                        <span className="text-2xl font-black tabular-nums text-schrift px-2.5 py-0.5 bg-flaeche rounded-knopf border border-rahmen">
                          {currentDamageResult.total}
                        </span>
                        <span className="text-xs font-semibold text-schaden">
                          {currentDamageResult.damageType}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-1">
                  <Knopf
                    onClick={() => setEnableDamageRoll(true)}
                    className="text-xs gap-1 mx-auto hover:underline"
                  >
                    <Flame className="w-3.5 h-3.5 text-schaden" />
                    <span>+ Zauberschaden für diesen Spruch würfeln</span>
                  </Knopf>
                </div>
              )}
            </>
          )}

          {/* STEP 5: Final Cost Summary & Execution */}
          {hasRolled && egCalculation?.isSuccess && (
            <div className="bg-flaeche rounded-karte border border-rahmen p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-leise font-medium">Finaler Fokusaufwand</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-extrabold text-schrift">
                      {finalCosts.totalFocus} FO
                    </span>
                    <span className="text-xs text-leise">
                      [{finalCosts.effectiveExhausted} Erschöpft
                      {finalCosts.effectiveChanneled > 0 ? `, ${finalCosts.effectiveChanneled} Kanalisiert` : ''}
                      {finalCosts.effectiveConsumed > 0 ? `, ${finalCosts.effectiveConsumed} Verzehrt` : ''}]
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-leise block">Freier Fokus</span>
                  <span
                    className={`tabular-nums font-bold text-sm ${
                      canAffordFocus ? 'text-schrift' : 'text-schaden'
                    }`}
                  >
                    {availableFocus} / {maxFO} FO
                  </span>
                </div>
              </div>

              {/* Damage summary in step 5 */}
              {currentDamageResult && (
                <div className="bg-erhoeht rounded-knopf p-2.5 border border-rahmen text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-schaden" />
                    <span className="font-semibold text-schrift">Zauberschaden:</span>
                    <span className="text-leise">
                      {currentDamageResult.formula} [{currentDamageResult.dice.join(', ')}]
                      {currentDamageResult.egBonus > 0 ? ` + ${currentDamageResult.egBonus} EG` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 tabular-nums">
                    <span className="font-bold text-schaden text-sm">
                      {currentDamageResult.total}
                    </span>
                    <span className="text-[11px] text-leise font-medium ">
                      {currentDamageResult.damageType}
                    </span>
                  </div>
                </div>
              )}

              {/* Active Modifications Summary */}
              {finalCosts.modificationsSummary.length > 0 && (
                <div className="bg-erhoeht rounded-knopf p-2.5 border border-rahmen text-xs space-y-1">
                  <span className="font-semibold text-schrift block">Gewählte Modifikationen:</span>
                  <ul className="list-disc list-inside text-schrift space-y-0.5">
                    {finalCosts.modificationsSummary.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!canAffordFocus && (
                <div className="bg-erhoeht text-schaden border border-schaden rounded-knopf p-2 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Nicht genügend freier Fokus vorhanden! Benötigt: {finalCosts.totalFocus} FO, frei: {availableFocus} FO.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {hasRolled && egCalculation?.isSuccess && currentHealingInfo?.isRestoreAll && conditions.length > 0 && (
          <fieldset id="wiederherstellung-zustaende" className="border-t border-rahmen px-4 sm:px-5 py-3 space-y-1.5">
            <legend className="text-xs font-bold text-gold-hell">Zustände, die der Zauber aufhebt</legend>
            <p className="text-[11px] text-leise">
              Laut Zauberbeschreibung wählen{currentHealingInfo.curesPoisonDisease ? ' (mit Verstärkung auch Gifte und Krankheiten)' : ''}; nicht gewählte Zustände bleiben.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {conditions.map((c) => (
                <label key={c.id} className="flex items-center gap-2 min-h-11 sm:min-h-0 text-sm text-schrift cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aufzuheben.includes(c.id)}
                    onChange={(e) => setAufzuheben((v) => (e.target.checked ? [...v, c.id] : v.filter((x) => x !== c.id)))}
                    className="w-4 h-4 rounded-knopf border-rahmen"
                  />
                  <span>{c.key}{c.level ? ` ${c.level}` : ''}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Modal Footer */}
        <div className="bg-erhoeht border-t border-rahmen px-4 sm:px-5 py-3 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
          <Knopf
            onClick={onClose}
            className="text-xs w-full sm:w-auto text-center"
          >
            Abbrechen
          </Knopf>

          {hasRolled && egCalculation?.isSuccess && (
            currentHealingInfo?.isHealingSpell ? (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <Knopf
                  onClick={() => handleCompleteCast()}
                  disabled={!canAffordFocus}
                  className="text-xs"
                  title="Zauber auf Ziel oder Verbündeten anwenden (ohne Selbstheilung)"
                >
                  Auf Verbündeten wirken (-{finalCosts.totalFocus} FO)
                </Knopf>
                <Knopf art="erholung"
                  onClick={() => {
                    handleCompleteCast({
                      hp: currentHealingInfo.totalLP,
                      restoreAll: currentHealingInfo.isRestoreAll,
                      curesPoisonDisease: currentHealingInfo.curesPoisonDisease,
                      ...(currentHealingInfo.isRestoreAll ? { conditionIdsToRemove: aufzuheben.filter((id) => conditions.some((c) => c.id === id)) } : {}),
                      label: currentHealingInfo.label,
                    });
                  }}
                  disabled={!canAffordFocus}
                  className="text-sm active:scale-95 disabled:pointer-events-none gap-2 w-full sm:w-auto"
                >
                  <Heart className="w-4 h-4 fill-schrift shrink-0" />
                  <span>
                    {currentHealingInfo.isRestoreAll
                      ? `Selbst heilen (Alle LP${aufzuheben.some((id) => conditions.some((c) => c.id === id)) ? ' & gewählte Zustände' : ''})`
                      : `Selbst heilen (+${currentHealingInfo.totalLP} LP)`}
                  </span>
                  {currentHealingInfo.hasEnhancementSelected && !currentHealingInfo.isRestoreAll && (
                    <span className="text-[11px] bg-unverletzt-grund text-unverletzt px-1.5 py-0.5 rounded-knopf tabular-nums font-semibold">
                      (EG-verstärkt)
                    </span>
                  )}
                </Knopf>
              </div>
            ) : currentHealingInfo?.conditionToRemove ? (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <Knopf art="primaer"
                  onClick={() => handleCompleteCast()}
                  disabled={!canAffordFocus}
                  className="text-xs underline decoration-dotted"
                  title="Zauber auf Ziel oder Verbündeten anwenden"
                >
                  Auf Verbündeten wirken (-{finalCosts.totalFocus} FO)
                </Knopf>
                <Knopf art="erholung"
                  onClick={() => {
                    handleCompleteCast({
                      removeCondition: currentHealingInfo.conditionToRemove,
                      label: currentHealingInfo.label,
                    });
                  }}
                  disabled={!canAffordFocus}
                  className="text-sm active:scale-95 disabled:pointer-events-none gap-2 w-full sm:w-auto"
                >
                  <Sparkles className="w-4 h-4 text-unverletzt shrink-0" />
                  <span>Zustand aufheben ({currentHealingInfo.conditionToRemove})</span>
                </Knopf>
              </div>
            ) : spellCausesDamage && !currentDamageResult ? (
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Knopf art="primaer"
                  onClick={() => handleCompleteCast()}
                  disabled={!canAffordFocus}
                  className="text-xs underline decoration-dotted"
                  title="Zauber abschließen ohne Schaden auszuwürfeln"
                >
                  Ohne Schaden vollenden
                </Knopf>
                <Knopf art="primaer"
                  onClick={() => handleRollDamage()}
                  className="text-sm active:scale-95 gap-2 w-full sm:w-auto"
                >
                  <Flame className="w-4 h-4 text-schaden" />
                  <span>
                    Schaden würfeln (
                    {customDiceCount}W{customDiceSides}
                    {customBaseBonus > 0 ? `+${customBaseBonus}` : ''}
                    {allocations.increaseDamage > 0 ? `+${allocations.increaseDamage}` : ''})
                  </span>
                </Knopf>
              </div>
            ) : (
              <Knopf art="primaer"
                onClick={() => handleCompleteCast()}
                disabled={!canAffordFocus}
                className="text-sm active:scale-95 disabled:pointer-events-none gap-2 w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4 text-schrift" />
                <span>
                  Zauber vollenden (-{finalCosts.totalFocus} FO
                  {currentDamageResult ? ` · ${currentDamageResult.total} Schaden` : ''}
                  {activeEnhancementEffects.length > 0 ? ` · ${activeEnhancementEffects.length} Verstärkung(en)` : ''})
                </span>
              </Knopf>
            )
          )}
        </div>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};
export default CastSpellModal;
