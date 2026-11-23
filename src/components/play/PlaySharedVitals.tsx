import { standardGesundheitsstufen } from '../../regelwerk/schadenUndHeilung';
import { fokusDurchZustaende, mitZustaenden, zustandsErklaerung, zustandswerte } from '../../regelwerk/zustandswerte';
import { alleZustaende, zustandHatStufe, zustandQuelle } from '../../regelwerk/zustaende';
import { Rauten, Knopf, Wahlknopf, Leistenknopf, Feldknopf } from '../../fundament';
import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Check,
  Sparkles,
  Shield,
  Flame,
  Plus,
  Heart,
} from 'lucide-react';
import { useCharacter } from '../../context/CharacterContext';
import { usePlaySession } from '../../context/PlaySessionContext';
import { grwGesundheitsstufen } from '../../regelwerk/grwListen';
import { zustandTooltip } from '../../utils/conditionModifiers';
import { toast } from 'react-hot-toast';
import { generateId } from '../../utils/id';
import type { StatusCondition, HealthSlot, ChanneledSpell } from '../../types';
import { TakeDamageModal } from './TakeDamageModal';
import { HealModal } from './HealModal';
import { getActiveSpellModifiers, zauberHoechstbonus } from '../../utils/magicRules';

// ============================================================================
// Compound Stepper Button Component (matches user's screenshot)
// [  −        Label / Symbol        1   +  ]
// ============================================================================

interface CompoundStepperProps {
  label: string;
  symbol?: string;
  variant: 'amber' | 'red' | 'blue' | 'teal';
  amount: number;
  onAmountChange: (val: number) => void;
  onMinus: () => void;
  onPlus: () => void;
  onLabelClick?: () => void;
  minusTitle?: string;
  plusTitle?: string;
}

const CompoundStepper: React.FC<CompoundStepperProps> = ({
  label,
  symbol,
  variant,
  amount,
  onAmountChange,
  onMinus,
  onPlus,
  onLabelClick,
  minusTitle = 'Verringern / Heilen',
  plusTitle = 'Hinzufügen / Ausgeben',
}) => {
  const styles = {
    amber: {
      border: 'border-erschoepft hover:border-gold',
      bg: 'bg-erschoepft-grund',
      accent: 'text-gold',
      text: 'text-schrift',
      hoverBtn: 'hover:bg-rahmen',
    },
    red: {
      border: 'border-schaden hover:border-schaden',
      bg: 'bg-schaden-grund',
      accent: 'text-schaden',
      text: 'text-schrift',
      hoverBtn: 'hover:bg-rahmen',
    },
    blue: {
      border: 'border-rahmen hover:border-kanalisiert',
      bg: 'bg-kanalisiert-grund',
      accent: 'text-kanalisiert',
      text: 'text-schrift',
      hoverBtn: 'hover:bg-rahmen',
    },
    teal: {
      border: 'border-temporaer hover:border-temporaer',
      bg: 'bg-temporaer-grund',
      accent: 'text-temporaer',
      text: 'text-schrift',
      hoverBtn: 'hover:bg-rahmen',
    },
  }[variant];

  return (
    <div
      className={`flex items-center justify-between rounded-knopf border ${styles.border} ${styles.bg} px-1.5 min-h-11 select-none transition-all`}
    >
      {/* Minus Button */}
      <Leistenknopf
        onClick={onMinus}
        title={minusTitle}
        aria-label={minusTitle}
        className={`text-base font-bold ${styles.accent} ${styles.hoverBtn} shrink-0`}
      >
        −
      </Leistenknopf>

      {/* Center Label (Clickable) */}
      <Leistenknopf
        onClick={onLabelClick || onPlus}
        className={`flex-1 text-center font-bold text-xs tracking-wide ${styles.text} hover:opacity-90 px-0.5 min-w-0 truncate gap-1`}
      >
        <span className="truncate">{label}</span>
        {symbol && <span className="tabular-nums text-[11px] opacity-90 shrink-0">{symbol}</span>}
      </Leistenknopf>

      {/* Right Stepper: Value + Plus */}
      <div className="flex items-center gap-0.5 shrink-0">
        <input
          type="number"
          min={1}
          max={20}
          value={amount}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onAmountChange(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
          className={`w-6 sm:w-7 text-center bg-transparent border-0 tabular-nums font-bold text-xs ${styles.text} focus:outline-none p-0`}
        />
        <Leistenknopf
          onClick={onPlus}
          title={plusTitle}
          aria-label={plusTitle}
          className={`text-base font-bold ${styles.accent} ${styles.hoverBtn} shrink-0`}
        >
          +
        </Leistenknopf>
      </div>
    </div>
  );
};

// ============================================================================
// PlaySharedVitals Main Component
// ============================================================================

export interface PlaySharedVitalsProps {
  isMinimal?: boolean;
}

export const PlaySharedVitals: React.FC<PlaySharedVitalsProps> = ({ isMinimal = false }) => {
  const { state, dispatch, calc } = useCharacter();
  const session = usePlaySession();

  const { playState, name, race, moonSign } = state;
  const {
    maxLP,
    maxFO,
    currentWoundPenalty,
    currentHealthLevelName,
    derived,
    robustBonus,
    armorSR,
    gearVtdBonus,
    splinterPoints: maxSplitter,
    heldengrad,
    totalHandicap = 0,
  } = calc;

  const { healthSlots, focus, splitterPoints, channeledSpells, dyingLevel } = playState;
  const conditions = playState.conditions ?? [];
  const tempHP = playState.tempHP ?? 0;
  const tempHPUsed = playState.tempHPUsed ?? 0;
  const activeTempHP = Math.max(0, tempHP - tempHPUsed);
  const lpModifier = playState.lpModifier ?? 0;

  // Damage & Heal modals & Stepper amounts state
  const [showTakeDamageModal, setShowTakeDamageModal] = useState<boolean>(false);
  const [showHealModal, setShowHealModal] = useState<boolean>(false);
  const [tempHPAmount, setTempHPAmount] = useState<number>(1);

  const [exhaustedFocusAmount, setExhaustedFocusAmount] = useState<number>(1);
  const [channeledFocusAmount, setChanneledFocusAmount] = useState<number>(1);
  const [consumedFocusAmount, setConsumedFocusAmount] = useState<number>(1);

  // Condition dropdown state

  // Minimal condition quick-picker state (Tab Spielen)
  const [showMinimalConditionPicker, setShowMinimalConditionPicker] = useState<boolean>(false);
  const [selectedMinimalCondition, setSelectedMinimalCondition] = useState<string>('Liegend');
  const [minimalConditionLevel, setMinimalConditionLevel] = useState<number>(1);

  const totalChanneledFO = (channeledSpells ?? []).reduce((sum, s) => sum + (s.channeledFocus || 0), 0);
  const consumedLP = healthSlots.filter((s) => s.type === 'consumed').length;
  const exhaustedLP = healthSlots.filter((s) => s.type === 'exhausted').length;
  const channeledLP = healthSlots.filter((s) => s.type === 'channeled').length;
  // Lebenspunkte = LP je Gesundheitsstufe × Zahl der Stufen (GRW S. 172: 5 × LP). Die Kästchen dahinter gehören zur
  // Sterbe-Rechnung (Stufe nach Todgeweiht) und zählen nicht als Lebenspunkte.
  const totalLP = maxLP > 0 ? maxLP * standardGesundheitsstufen().length || healthSlots.length : healthSlots.length;
  const freeLP = healthSlots.slice(0, totalLP).filter((s) => s.type === 'empty').length;
  const totalDamage = consumedLP + exhaustedLP + channeledLP;

  const zwFokus = useMemo(() => zustandswerte(conditions), [conditions]);
  const fokusGesperrt = fokusDurchZustaende(maxFO, zwFokus);
  const focusAvailable = Math.max(0, maxFO - focus.exhausted - focus.channeled - focus.consumed - fokusGesperrt);
  // Zauberboni auf abgeleitete Werte sind auf den Höchstbonus aus Zauberei begrenzt (GRW S. 18–19)
  const hoechstbonusZauber = zauberHoechstbonus(calc);
  const activeSpellMods = useMemo(() => getActiveSpellModifiers(channeledSpells, hoechstbonusZauber), [channeledSpells, hoechstbonusZauber]);
  const effectiveWoundPenalty = Math.min(0, currentWoundPenalty + activeSpellMods.woundPenaltyReduction);
  const woundPenaltyDisplay = effectiveWoundPenalty;

  // Zustände wirken auf die abgeleiteten Werte (Zahlen aus den Paketeinträgen, regelwerk/zustandswerte.ts)
  const zw = useMemo(() => zustandswerte(conditions), [conditions]);
  const effectiveGSW = mitZustaenden('GSW', derived.GSW + activeSpellMods.gswBonus, zw);
  const effectiveINI = mitZustaenden('INI', derived.INI, zw);
  const effectiveVTD = mitZustaenden('VTD', derived.VTD + activeSpellMods.vtdBonus, zw);
  const effectiveSR = mitZustaenden('SR', (derived.SR || 0) + activeSpellMods.srBonus, zw);
  const effectiveGW = mitZustaenden('GW', (derived.GW || 0) + activeSpellMods.gwBonus, zw);
  const effectiveKW = mitZustaenden('KW', (derived.KW || 0) + activeSpellMods.kwBonus, zw);

  const formatConditionLabel = (c: StatusCondition) => {
    let lbl = c.key;
    if (c.level && c.level > 1) lbl += ` ${c.level}`;
    if (c.note) lbl += ` (${c.note})`;
    return lbl;
  };

  const handleAddQuickCondition = (conditionKey: string, customLevel?: number) => {
    const hasLevels = zustandHatStufe(conditionKey);
    const existing = conditions.find((c) => c.key === conditionKey);
    const levelToSet = hasLevels ? (existing ? (existing.level ?? 1) + 1 : (customLevel ?? 1)) : undefined;

    const newCondition: StatusCondition = {
      id: generateId(),
      key: conditionKey,
      level: levelToSet,
    };

    session.logAndDispatch(
      { type: 'PLAY_ADD_CONDITION', payload: newCondition },
      {
        category: 'condition',
        title: `Zustand erhalten: ${conditionKey}`,
        description: formatConditionLabel(newCondition),
        badge: { text: conditionKey, variant: 'warning' },
      }
    );

    toast.success(
      existing && hasLevels
        ? `Zustand ${conditionKey} auf Stufe ${levelToSet} erhöht`
        : `Zustand ${conditionKey}${levelToSet && levelToSet > 1 ? ` ${levelToSet}` : ''} hinzugefügt`
    );
  };

  // Slot click removal
  const handleRemoveSlotDamage = (slot: HealthSlot, index: number) => {
    session.logAndDispatch(
      { type: 'PLAY_UNDO_DAMAGE', payload: { kind: slot.type as 'exhausted' | 'consumed' | 'channeled', amount: 1, maxLP } },
      {
        category: 'heal',
        title: '1 Schadenspunkt entfernt',
        description: `Schaden (${slot.type}) per Klick auf Kästchen #${index + 1} entfernt`,
        badge: { text: '-1 Schaden', variant: 'success' },
      }
    );
    toast.success('1 Schadenspunkt entfernt.');
  };

  const handleRemoveFocusSlot = (slotType: 'consumed' | 'channeled' | 'exhausted') => {
    if (slotType === 'consumed') {
      session.logAndDispatch(
        { type: 'PLAY_SPEND_FOCUS', payload: { kind: 'consumed', amount: -1 } },
        {
          category: 'focus',
          title: 'Verzehrter Fokus regeneriert',
          description: '1 verzehrter Fokus per Klick auf Kästchen regeneriert',
          badge: { text: '-1 Verzehrt', variant: 'success' },
        }
      );
      toast.success('1 verzehrter Fokus regeneriert.');
    } else if (slotType === 'channeled') {
      session.logAndDispatch(
        { type: 'PLAY_SPEND_FOCUS', payload: { kind: 'channeled', amount: -1 } },
        {
          category: 'focus',
          title: 'Kanalisierter Fokus verringert',
          description: '1 kanalisierter Fokus per Klick auf Kästchen freigegeben',
          badge: { text: '-1 Kanalisiert', variant: 'info' },
        }
      );
      toast.success('1 kanalisierter Fokus freigegeben.');
    } else if (slotType === 'exhausted') {
      session.logAndDispatch(
        { type: 'PLAY_SPEND_FOCUS', payload: { kind: 'exhausted', amount: -1 } },
        {
          category: 'focus',
          title: 'Erschöpfter Fokus regeneriert',
          description: '1 erschöpfter Fokus per Klick auf Kästchen regeneriert',
          badge: { text: '-1 Erschöpft', variant: 'success' },
        }
      );
      toast.success('1 erschöpfter Fokus regeneriert.');
    }
  };

  // Render health slot box (sleek solid minimal tiles from screenshot)
  const renderHealthSlot = (slot: HealthSlot, index: number) => {
    let styleClass = 'bg-unverletzt-grund border border-unverletzt';
    let title = 'Frei';

    if (slot.type === 'consumed') {
      styleClass = 'bg-schaden border border-schaden';
      title = isMinimal ? 'Echter Schaden' : 'Echter Schaden (■) – Klick zum Entfernen';
    } else if (slot.type === 'exhausted') {
      styleClass = 'bg-erschoepft border border-erschoepft';
      title = isMinimal ? 'Betäubungsschaden' : 'Betäubungsschaden (✕) – Klick zum Entfernen';
    } else if (slot.type === 'channeled') {
      styleClass = 'bg-kanalisiert border border-kanalisiert';
      title = isMinimal ? 'Kanalisierter Schaden' : 'Kanalisierter Schaden (/) – Klick zum Entfernen';
    }

    if (isMinimal) {
      return (
        <div
          key={index}
          title={title}
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[3px] select-none ${styleClass}`}
        />
      );
    }

    const isClickable = slot.type !== 'empty';

    return (
      <Feldknopf
        key={index}
        disabled={!isClickable}
        onClick={isClickable ? () => handleRemoveSlotDamage(slot, index) : undefined}
        beschriftung={title}
        className={styleClass}
      />
    );
  };

  // Render focus slot box (sleek solid tiles from screenshot)
  const renderFocusSlot = (type: 'consumed' | 'channeled' | 'exhausted' | 'empty', index: number) => {
    let styleClass = 'bg-kanalisiert-grund border border-kanalisiert';
    let title = 'Frei';

    if (type === 'consumed') {
      styleClass = 'bg-schaden border border-schaden';
      title = isMinimal ? 'Verzehrter Fokus' : 'Verzehrter Fokus – Klick zum Regenerieren';
    } else if (type === 'channeled') {
      styleClass = 'bg-kanalisiert border border-kanalisiert';
      title = isMinimal ? 'Kanalisierter Fokus' : 'Kanalisierter Fokus – Klick zum Freigeben';
    } else if (type === 'exhausted') {
      styleClass = 'bg-erschoepft border border-erschoepft';
      title = isMinimal ? 'Erschöpfter Fokus' : 'Erschöpfter Fokus – Klick zum Regenerieren';
    }

    if (isMinimal) {
      return (
        <div
          key={index}
          title={title}
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[3px] select-none ${styleClass}`}
        />
      );
    }

    const isClickable = type !== 'empty';

    return (
      <Feldknopf
        key={index}
        disabled={!isClickable}
        onClick={isClickable ? () => handleRemoveFocusSlot(type) : undefined}
        beschriftung={title}
        className={styleClass}
      />
    );
  };

  // Fokus spend handler
  const handleSpendFocus = (kind: 'exhausted' | 'channeled' | 'consumed', amount: number) => {
    const isAdding = amount > 0;
    const abs = Math.abs(amount);
    const titles = {
      exhausted: isAdding ? `${abs} Fokus erschöpft` : `${abs} erschöpfter Fokus regeneriert`,
      channeled: isAdding ? `${abs} Fokus kanalisiert` : `${abs} kanalisierter Fokus freigegeben`,
      consumed: isAdding ? `${abs} Fokus verzehrt` : `${abs} verzehrter Fokus regeneriert`,
    };

    session.logAndDispatch(
      { type: 'PLAY_SPEND_FOCUS', payload: { kind, amount } },
      {
        category: 'focus',
        title: titles[kind],
        badge: {
          text: `${isAdding ? '-' : '+'}${abs} FO`,
          variant: isAdding ? (kind === 'consumed' ? 'danger' : 'warning') : 'success',
        },
      }
    );
    toast.success(titles[kind]);
  };

  // Zustände: ein gemeinsamer Bereich für die Reiter „Spielen“ und „Kampf & Magie“
  const zustandsbereich = (
    <div className="pt-1.5 border-t border-rahmen space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Wahlknopf
            gewaehlt={showMinimalConditionPicker}
            mittig
            onClick={() => setShowMinimalConditionPicker((prev) => !prev)}
            className="px-3 text-xs uppercase tracking-wider fantasy-font gap-1.5"
            title={showMinimalConditionPicker ? 'Zustandsauswahl schließen' : 'Zustand hinzufügen'}
            aria-expanded={showMinimalConditionPicker}
          >
            <span aria-hidden="true">{showMinimalConditionPicker ? '✕' : '+'}</span>
            <span>Zustände</span>
          </Wahlknopf>
        </div>
        <span className="text-[11px] text-leise font-semibold">
          {conditions.length} aktiv
        </span>
      </div>

      {/* Dezente Schnellauswahl */}
      {showMinimalConditionPicker && (
        <div className="bg-erhoeht border border-rahmen rounded-knopf p-2 sm:p-2.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px] text-leise">
            <span className="font-semibold text-schrift">Schnellauswahl (1 Klick):</span>
            <Knopf
              onClick={() => setShowMinimalConditionPicker(false)}
              className="text-xs"
              title="Schließen"
            >
              ✕
            </Knopf>
          </div>

          {/* Häufigste Zustände als Schnell-Chips */}
          <div className="flex flex-wrap gap-1">
            {['Liegend', 'Benommen', 'Erschöpft', 'Blutend', 'Brennend', 'Geblendet', 'Bewusstlos'].map((key) => {
              const existing = conditions.find((c) => c.key === key);
              return (
                <Wahlknopf gewaehlt={!!existing} mittig key={key} onClick={() => handleAddQuickCondition(key)} title={`${existing ? `${key} aktiv (Klick erhöht Stufe)` : `${key} hinzufügen`}\nQuelle: ${zustandQuelle(key)}`} className="rounded-full text-[11px] font-medium">
                  <span>{key}</span>
                  {existing && existing.level && (
                    <span className="text-gold tabular-nums font-bold text-[11px]">
                      {existing.level}
                    </span>
                  )}
                  <span className="text-gold text-[11px] font-bold">+</span>
                </Wahlknopf>
              );
            })}
          </div>

          {/* Auswahlliste für alle Splittermond-Zustände */}
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-rahmen">
            <select
              value={selectedMinimalCondition}
              onChange={(e) => setSelectedMinimalCondition(e.target.value)}
              className="bg-erhoeht border border-rahmen rounded-knopf px-2 py-1 text-xs text-schrift font-medium focus:outline-none focus:border-gold cursor-pointer flex-1 min-w-[110px]"
            >
              {alleZustaende().map((cond: string) => (
                <option key={cond} value={cond} className="bg-erhoeht text-schrift" title={`Quelle: ${zustandQuelle(cond)}`}>
                  {cond}
                </option>
              ))}
            </select>

            {zustandHatStufe(selectedMinimalCondition) && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-leise">Stufe:</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={minimalConditionLevel}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setMinimalConditionLevel(parseInt(e.target.value, 10) || 1)}
                  className="w-10 bg-erhoeht border border-rahmen rounded-knopf px-1 py-1 text-center text-xs tabular-nums font-bold text-schrift focus:outline-none focus:border-gold"
                />
              </div>
            )}

            <Knopf art="primaer"
              onClick={() => handleAddQuickCondition(selectedMinimalCondition, minimalConditionLevel)}
              className="text-xs shrink-0"
              title="Ausgewählten Zustand hinzufügen"
            >
              + Hinzufügen
            </Knopf>
          </div>
        </div>
      )}

      {/* Aktive Zustände Badges */}
      {conditions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {conditions.map((c) => (
            <Knopf
              key={c.id}
              onClick={() => {
                session.logAndDispatch(
                  { type: 'PLAY_REMOVE_CONDITION', payload: { id: c.id } },
                  {
                    category: 'condition',
                    title: 'Zustand entfernt',
                    description: `${formatConditionLabel(c)} aufgehoben`,
                    badge: { text: `${c.key} weg`, variant: 'success' },
                  }
                );
              }}
              title={`${zustandTooltip(c)}\n\nKlick: Zustand entfernen`}
              aria-label={`${formatConditionLabel(c)} entfernen`}
              className="rounded-full! px-3! gap-1.5 text-xs font-medium hover:bg-rahmen hover:border-gold"
            >
              <span>{c.key}</span>
              {c.level && c.level > 1 && (
                <span className="text-gold tabular-nums font-bold text-[11px]">
                  {c.level}
                </span>
              )}
              {c.note && (
                <span className="text-leise text-[11px] font-normal">
                  ({c.note})
                </span>
              )}
              <span aria-hidden="true" className="text-leise text-sm leading-none">×</span>
            </Knopf>
          ))}
        </div>
      ) : (
        <div
          onClick={() => setShowMinimalConditionPicker((prev) => !prev)}
          className="text-[11px] text-leise hover:text-leise italic cursor-pointer transition-colors"
          title="Klicken, um Zustand-Schnellauswahl zu öffnen"
        >
          Keine aktiven Zustände
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── 2-Column Grid: LEBENSPUNKTE (Links) & FOKUS (Rechts) nebeneinander ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start w-full">
        {/* ── WINDOW 1: LEBENSPUNKTE ── */}
        <div className={`bg-flaeche border border-rahmen rounded-karte ${isMinimal ? 'p-4 space-y-3' : 'p-5 space-y-3.5'}`}>
          {/* Header: LEBENSPUNKTE on left, Unverletzt / Wundstufe pill on right */}
          <div className="flex justify-between items-center pb-1.5 border-b border-rahmen gap-2">
            <h3 className={`text-[17px] font-bold fantasy-font tracking-wide text-gold-hell`}>
              LEBENSPUNKTE
            </h3>

            <div>
              {woundPenaltyDisplay !== 0 ? (
                <span
                  className="border border-schaden bg-schaden-grund text-schrift text-xs font-semibold px-2 py-0.5 rounded-knopf flex items-center gap-1.5 "
                  title={activeSpellMods.woundPenaltyReduction > 0 ? `Wundabzug durch Zauber um ${activeSpellMods.woundPenaltyReduction} reduziert (Basis: ${currentWoundPenalty})` : undefined}
                >
                  <AlertTriangle size={12} className="text-schrift shrink-0" />
                  <span>{currentHealthLevelName || 'Verletzt'}</span>
                  <span className="tabular-nums font-black">{woundPenaltyDisplay}</span>
                  {activeSpellMods.woundPenaltyReduction > 0 && (
                    <span className="text-schrift text-[11px] font-bold bg-magie-grund border border-magie rounded-knopf px-1">+{activeSpellMods.woundPenaltyReduction} </span>
                  )}
                </span>
              ) : currentWoundPenalty < 0 && activeSpellMods.woundPenaltyReduction > 0 ? (
                <span
                  className="border border-unverletzt bg-unverletzt-grund text-unverletzt text-xs font-semibold px-2 py-0.5 rounded-knopf flex items-center gap-1 "
                  title={`Wundabzug durch Zauber ignoriert (Basis: ${currentWoundPenalty})`}
                >
                  <Sparkles size={12} className="text-unverletzt shrink-0" />
                  <span>{currentHealthLevelName || 'Verletzt'}</span>
                  <span className="tabular-nums font-black">0</span>
                  <span className="text-[11px] text-unverletzt font-bold">(Schmerz ignoriert)</span>
                </span>
              ) : dyingLevel > 0 ? (
                <span className="border border-schaden bg-schaden-grund text-schaden text-xs font-semibold px-2 py-0.5 rounded-knopf flex items-center gap-1 animate-pulse">
                  <span>Sterbend {dyingLevel}</span>
                </span>
              ) : (
                <span className="border border-unverletzt bg-unverletzt-grund text-leise text-xs font-semibold px-2 py-0.5 rounded-knopf flex items-center gap-1 ">
                  <Check size={12} className="text-leise shrink-0" />
                  <span>{currentHealthLevelName || 'Unverletzt'}</span>
                </span>
              )}
            </div>
          </div>

          {isMinimal ? (
            /* ── Minimalist view: Nur Lebenspunkte, Zustände (KEINE Kästchen, KEINE redundante Wundstufe) ── */
            <div className="space-y-2">
              {/* 1. Lebenspunkte */}
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-bold tabular-nums text-schrift tracking-tight">
                      {freeLP}
                    </span>
                    <span className="text-leise text-xs sm:text-sm font-medium">
                      / {totalLP} LP
                    </span>
                    {activeTempHP > 0 && (
                      <span className="text-[11px] font-semibold tabular-nums text-temporaer bg-temporaer-grund border border-temporaer px-1.5 py-0.2 rounded-knopf">
                        +{activeTempHP} Temp
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] sm:text-xs text-schrift">
                    {totalDamage > 0 ? (
                      <span>Schaden: <strong className="tabular-nums text-schaden">{totalDamage}</strong></span>
                    ) : (
                      <span className="text-unverletzt font-medium">Vollständig gesund</span>
                    )}
                  </div>
                </div>

                {/* Sleek continuous health bar (smooth meter, NO individual Kästchen) */}
                <div className="h-[18px] w-full bg-erhoeht rounded-full overflow-hidden flex border border-rahmen">
                  <div
                    style={{ width: `${(freeLP / Math.max(1, totalLP)) * 100}%` }}
                    className="bg-unverletzt h-full transition-all duration-300"
                    title={`Freie LP: ${freeLP}`}
                  />
                  {exhaustedLP > 0 && (
                    <div
                      style={{ width: `${(exhaustedLP / Math.max(1, totalLP)) * 100}%` }}
                      className="bg-erschoepft h-full transition-all duration-300"
                      title={`Betäubungsschaden: ${exhaustedLP}`}
                    />
                  )}
                  {channeledLP > 0 && (
                    <div
                      style={{ width: `${(channeledLP / Math.max(1, totalLP)) * 100}%` }}
                      className="bg-kanalisiert h-full transition-all duration-300"
                      title={`Kanalisierter Schaden: ${channeledLP}`}
                    />
                  )}
                  {consumedLP > 0 && (
                    <div
                      style={{ width: `${(consumedLP / Math.max(1, totalLP)) * 100}%` }}
                      className="bg-schaden h-full transition-all duration-300"
                      title={`Echter Schaden: ${consumedLP}`}
                    />
                  )}
                </div>

                {/* Damage breakdown text */}
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-leise pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-[3px] bg-schaden inline-block" />
                    Echt: <strong className="tabular-nums text-schrift">{consumedLP}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-[3px] bg-erschoepft inline-block" />
                    Betäubung: <strong className="tabular-nums text-schrift">{exhaustedLP}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-[3px] bg-kanalisiert inline-block" />
                    Kanalisiert: <strong className="tabular-nums text-schrift">{channeledLP}</strong>
                  </span>
                  {activeTempHP > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-[3px] bg-temporaer inline-block" />
                      Temp: <strong className="tabular-nums text-temporaer">+{activeTempHP}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Zustände */}
              {zustandsbereich}
            </div>
          ) : (
            /* ── Volle Ansicht für Tab Kampf & Magie ── */
            <>
              {/* ── Temporär row (wird nur angezeigt, wenn aktive temporäre LP vorhanden sind) ── */}
              {activeTempHP > 0 && (
                <div className="flex items-center gap-2 sm:gap-3 py-1 px-1.5 bg-erhoeht rounded-knopf border border-rahmen">
                  <div className="w-32 sm:w-36 text-xs font-semibold text-schrift flex items-center gap-1 shrink-0">
                    <span>Temporär:</span>
                    <span className="tabular-nums text-xs font-bold px-1.5 py-0.2 rounded-knopf border text-temporaer bg-temporaer-grund border-temporaer">
                      {activeTempHP}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-1">
                    {Array.from({ length: activeTempHP }).map((_, i) => (
                      <Feldknopf
                        key={`temp-active-${i}`}
                        onClick={() => {
                          dispatch({ type: 'PLAY_REMOVE_TEMP_HP', payload: { amount: 1 } });
                          toast.success('1 temporären LP entfernt');
                        }}
                        beschriftung={`Temporärer LP #${i + 1} (Aktiv) – Klick zum Entfernen`}
                        className="bg-temporaer border border-temporaer"
                      />
                    ))}
                    {tempHPUsed > 0 &&
                      Array.from({ length: tempHPUsed }).map((_, i) => (
                        <div
                          key={`temp-used-${i}`}
                          title={`Temporärer LP #${i + 1} (Verbraucht)`}
                          className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-knopf bg-temporaer-grund border border-temporaer flex items-center justify-center text-[11px] font-bold text-temporaer select-none"
                        >
                          ✕
                        </div>
                      ))}
                    <Knopf nurSymbol onClick={() => {
                        dispatch({ type: 'PLAY_ADD_TEMP_HP', payload: { amount: 1 } });
                        toast.success('+1 temporärer LP');
                      }} title="+1 temporären LP hinzufügen" aria-label="+1 temporären LP hinzufügen">
                      +
                    </Knopf>
                  </div>
                </div>
              )}

              {/* ── Health level rows (5 standard Splittermond levels) ── */}
              <div className="space-y-1.5">
                {grwGesundheitsstufen().slice(0, 5).map(({ name: label, wundabzug: penalty }, level: number) => {
                  const start = level * maxLP;
                  const levelSlots = healthSlots.slice(start, start + maxLP);
                  return (
                    <div key={level} className="flex items-center gap-2 sm:gap-3">
                      <div className="w-32 sm:w-36 text-xs font-semibold text-schrift shrink-0 leading-tight flex items-center justify-between">
                        <span className="whitespace-nowrap">{label}</span>
                        {penalty !== 0 ? (
                          <span className="text-schaden font-bold ml-1 tabular-nums shrink-0">({penalty})</span>
                        ) : (
                          <span className="text-leise tabular-nums text-[11px] ml-1 shrink-0">±0</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        {levelSlots.map((slot, idx) => {
                          const absoluteIdx = start + idx;
                          return renderHealthSlot(slot, absoluteIdx);
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Action Buttons Row: + Schaden & + Heilung (Design von "verzehrt" bzw. grün, ohne Mouse-Over-Animation) ── */}
              <div className="pt-1.5 border-t border-rahmen grid grid-cols-2 gap-1.5 sm:gap-2">
                {/* + Schaden Button (Design von "verzehrt") */}
                <Knopf art="gefahr"
                  onClick={() => setShowTakeDamageModal(true)}
                  className="min-h-11 px-4 rounded-knopf font-bold text-[13px] bg-schaden-grund hover:bg-erhoeht text-schrift border border-schaden flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Schaden erleiden (Modal öffnen)"
                >
                  <Flame size={14} className="text-schaden" />
                  <span>+ Schaden</span>
                </Knopf>

                {/* + Heilung Button (In grün) */}
                <Knopf art="erholung"
                  onClick={() => setShowHealModal(true)}
                  className="min-h-11 px-4 rounded-knopf font-bold text-[13px] bg-unverletzt-grund hover:bg-erhoeht text-schrift border border-unverletzt flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Heilung anwenden (Modal öffnen)"
                >
                  <Heart size={14} className="text-unverletzt" />
                  <span>+ Heilung</span>
                </Knopf>
              </div>

              {/* ── Action Stepper Row 2: Temp LP & LP-Modifikator ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <CompoundStepper
                  label={`Temp LP (${activeTempHP})`}
                  variant="teal"
                  amount={tempHPAmount}
                  onAmountChange={setTempHPAmount}
                  onPlus={() => {
                    dispatch({ type: 'PLAY_ADD_TEMP_HP', payload: { amount: tempHPAmount } });
                    toast.success(`+${tempHPAmount} temporäre LP`);
                  }}
                  onMinus={() => {
                    dispatch({ type: 'PLAY_REMOVE_TEMP_HP', payload: { amount: tempHPAmount } });
                    toast.success(`-${tempHPAmount} temporäre LP`);
                  }}
                  minusTitle="Temporäre LP verringern"
                  plusTitle="Temporäre LP hinzufügen"
                />

                <div className="flex items-center justify-between bg-erhoeht border border-rahmen rounded-knopf px-2.5 py-1 min-h-[36px]">
                  <span className="text-schrift text-xs font-semibold truncate">
                    LP-Mod:
                  </span>
                  <input
                    type="number"
                    value={lpModifier}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      dispatch({
                        type: 'PLAY_SET_LP_MODIFIER',
                        payload: {
                          modifier: val,
                          newMaxLP: Math.max(1, (derived.LP || 8) + robustBonus + val),
                        },
                      });
                    }}
                    className="w-12 bg-transparent border-0 tabular-nums font-bold text-xs text-schrift text-right focus:outline-none"
                  />
                </div>
              </div>

              {/* ── ZUSTÄNDE: derselbe Bereich wie im Reiter „Spielen“ ── */}
              <div className="mt-2">{zustandsbereich}</div>
            </>
          )}
        </div>

        {/* ── WINDOW 2: FOKUS ── */}
        <div className={`bg-flaeche border border-rahmen rounded-karte ${isMinimal ? 'p-4 space-y-3' : 'p-5 space-y-3.5'}`}>
          {/* Header: FOKUS on left, Verfügbar on right */}
          <div className="flex justify-between items-center pb-1.5 border-b border-rahmen gap-2">
            <h3 className={`text-[17px] font-bold fantasy-font tracking-wide text-gold-hell`}>
              FOKUS
            </h3>
            <span className="text-xs sm:text-sm font-bold text-schrift">
              Verfügbar:{' '}
              <span className={focusAvailable < 0 ? 'text-schaden tabular-nums font-bold' : 'text-unverletzt tabular-nums font-bold'}>
                {focusAvailable}
              </span>{' '}
              / <span className="tabular-nums">{maxFO}</span>
            </span>
          </div>

          {isMinimal ? (
            /* ── Minimalist view: Nur Fokus, Kanalisierte Zauber (KEINE Kästchen) ── */
            <div className="space-y-2">
              {/* 1. Fokus */}
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-bold tabular-nums text-schrift tracking-tight">
                      {focusAvailable}
                    </span>
                    <span className="text-leise text-xs sm:text-sm font-medium">
                      / {maxFO} FO
                    </span>
                  </div>
                  <div className="text-[11px] sm:text-xs text-schrift">
                    {focusAvailable === maxFO ? (
                      <span className="text-unverletzt font-medium">Voll verfügbar</span>
                    ) : (
                      <span>Gebunden / Verbraucht: <strong className="tabular-nums text-schaden">{maxFO - focusAvailable}</strong></span>
                    )}
                  </div>
                </div>

                {/* Sleek continuous focus bar (smooth meter, NO individual Kästchen) */}
                <div className="h-[18px] w-full bg-erhoeht rounded-full overflow-hidden flex border border-rahmen">
                  <div
                    style={{ width: `${(Math.max(0, focusAvailable) / Math.max(1, maxFO)) * 100}%` }}
                    className="bg-temporaer h-full transition-all duration-300"
                    title={`Freier Fokus: ${focusAvailable}`}
                  />
                  {focus.exhausted > 0 && (
                    <div
                      style={{ width: `${(focus.exhausted / Math.max(1, maxFO)) * 100}%` }}
                      className="bg-erschoepft h-full transition-all duration-300"
                      title={`Erschöpfter Fokus: ${focus.exhausted}`}
                    />
                  )}
                  {focus.channeled + fokusGesperrt > 0 && (
                    <div
                      style={{ width: `${((focus.channeled + fokusGesperrt) / Math.max(1, maxFO)) * 100}%` }}
                      className="bg-kanalisiert h-full transition-all duration-300"
                      title={[`Kanalisierter Fokus: ${focus.channeled + fokusGesperrt}`, zustandsErklaerung('FO', zw)].filter(Boolean).join('\n')}
                    />
                  )}
                  {focus.consumed > 0 && (
                    <div
                      style={{ width: `${(focus.consumed / Math.max(1, maxFO)) * 100}%` }}
                      className="bg-schaden h-full transition-all duration-300"
                      title={`Verzehrter Fokus: ${focus.consumed}`}
                    />
                  )}
                </div>

                {/* Focus breakdown details */}
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-leise pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-[3px] border border-kanalisiert bg-kanalisiert-grund inline-block" />
                    Frei: <strong className="tabular-nums text-unverletzt">{focusAvailable}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-[3px] bg-erschoepft inline-block" />
                    Erschöpft: <strong className="tabular-nums text-schrift">{focus.exhausted}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-[3px] bg-kanalisiert inline-block" />
                    Kanalisiert: <strong className="tabular-nums text-schrift">{focus.channeled + fokusGesperrt}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-[3px] bg-schaden inline-block" />
                    Verzehrt: <strong className="tabular-nums text-schrift">{focus.consumed}</strong>
                  </span>
                </div>
              </div>

              {/* 2. Kanalisierte Zauber */}
              <div className="pt-1.5 border-t border-rahmen space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-leise fantasy-font">
                    Kanalisierte Zauber
                  </span>
                  <span className="text-[11px] text-leise font-semibold">
                    {channeledSpells.length} aktiv ({totalChanneledFO} K-Fokus)
                  </span>
                </div>
                {channeledSpells.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {channeledSpells.map((s) => {
                      const buff = activeSpellMods.breakdown.find((b) => b.spellName.toLowerCase() === (s.name || '').toLowerCase());
                      return (
                        <span
                          key={s.id}
                          title={`${s.name}: Bindet ${s.channeledFocus} kanalisierten Fokus.${buff ? ` Aktiver Effekt: ${buff.description}.` : ''} Klick auf '×' hebt Zauber auf.`}
                          className="inline-flex items-center gap-1.5 bg-erhoeht hover:bg-rahmen text-schrift border border-kanalisiert hover:border-kanalisiert rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                        >
                          <span className="font-semibold text-schrift">{s.name}</span>
                          {buff && (
                            <span className="text-[11px] text-schrift font-bold bg-magie-grund px-1.5 py-0.2 rounded-knopf border border-magie">
                              {buff.description}
                            </span>
                          )}
                          <span
                            className="text-schrift tabular-nums font-bold text-[11px] bg-kanalisiert-grund px-1.5 py-0.2 rounded-knopf border border-kanalisiert"
                            title={`Bindet ${s.channeledFocus} K-Fokus`}
                          >
                            K{s.channeledFocus}
                          </span>
                          <Knopf
                            onClick={() => session.handleCancelChanneledSpell(s)}
                            className="ml-0.5 text-xs leading-none"
                            title={`'${s.name}' aufheben (${s.channeledFocus} K-Fokus wird zu erschöpftem Fokus)`}
                          >
                            ×
                          </Knopf>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-leise italic">Keine kanalisierten Zauber aktiv</div>
                )}
              </div>
            </div>
          ) : (
            /* ── Volle Ansicht für Tab Kampf & Magie ── */
            <>
              {/* Focus slot visualization */}
              {maxFO > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {Array.from({ length: maxFO }, (_, i) => {
                      let slotType: 'consumed' | 'channeled' | 'exhausted' | 'empty' = 'empty';
                      if (i < focus.consumed) slotType = 'consumed';
                      else if (i < focus.consumed + focus.channeled + fokusGesperrt) slotType = 'channeled';
                      else if (i < focus.consumed + focus.channeled + fokusGesperrt + focus.exhausted) slotType = 'exhausted';
                      return renderFocusSlot(slotType, i);
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-schrift pt-0.5">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-[3px] bg-schaden inline-block" />
                      Verzehrt
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-[3px] bg-kanalisiert inline-block" />
                      Kanalisiert
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-[3px] bg-erschoepft inline-block" />
                      Erschöpft
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-[3px] border border-kanalisiert bg-kanalisiert-grund inline-block" />
                      Frei
                    </span>
                  </div>
                </div>
              )}

              {/* 3 compound steppers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-rahmen">
                <CompoundStepper
                  label="Erschöpft"
                  variant="amber"
                  amount={exhaustedFocusAmount}
                  onAmountChange={setExhaustedFocusAmount}
                  onMinus={() => handleSpendFocus('exhausted', -exhaustedFocusAmount)}
                  onPlus={() => handleSpendFocus('exhausted', exhaustedFocusAmount)}
                  minusTitle="Erschöpften Fokus regenerieren"
                  plusTitle="Erschöpften Fokus ausgeben"
                />
                <CompoundStepper
                  label="Kanalisiert"
                  variant="blue"
                  amount={channeledFocusAmount}
                  onAmountChange={setChanneledFocusAmount}
                  onMinus={() => handleSpendFocus('channeled', -channeledFocusAmount)}
                  onPlus={() => handleSpendFocus('channeled', channeledFocusAmount)}
                  minusTitle="Kanalisierten Fokus freigeben"
                  plusTitle="Fokus kanalisieren"
                />
                <CompoundStepper
                  label="Verzehrt"
                  variant="red"
                  amount={consumedFocusAmount}
                  onAmountChange={setConsumedFocusAmount}
                  onMinus={() => handleSpendFocus('consumed', -consumedFocusAmount)}
                  onPlus={() => handleSpendFocus('consumed', consumedFocusAmount)}
                  minusTitle="Verzehrten Fokus regenerieren"
                  plusTitle="Verzehrten Fokus ausgeben"
                />
              </div>

              {/* Quick Focus Actions */}
              {focus.exhausted > 0 && (
                <div className="pt-2 border-t border-rahmen flex items-center">
                  <Knopf
                    onClick={() => {
                      session.logAndDispatch(
                        { type: 'PLAY_SPEND_FOCUS', payload: { kind: 'exhausted', amount: -focus.exhausted } },
                        {
                          category: 'focus',
                          title: 'Alles Erschöpfte erholt',
                          badge: { text: `+${focus.exhausted} FO`, variant: 'success' },
                        }
                      );
                      toast.success('Alles Erschöpfte erholt');
                    }}
                    className="w-full text-xs text-center"
                  >
                    Alles Erschöpfte erholen ({focus.exhausted})
                  </Knopf>
                </div>
              )}

              {/* ── KANALISIERTE ZAUBER (Inside Focus window: displays active spells with release action) ── */}
              <div className="border border-rahmen bg-erhoeht rounded-knopf p-2.5 space-y-2 mt-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gold-hell fantasy-font">
                    KANALISIERTE ZAUBER
                  </h4>
                  {channeledSpells.length > 0 ? (
                    <span className="text-[11px] text-kanalisiert font-semibold">
                      {channeledSpells.length} aktiv ({totalChanneledFO} K-Fokus)
                    </span>
                  ) : (
                    <span className="text-[11px] text-leise font-medium">0 aktiv</span>
                  )}
                </div>

                {/* Active channeled spells chips if any */}
                {channeledSpells.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {channeledSpells.map((s) => {
                      const buff = activeSpellMods.breakdown.find((b) => b.spellName.toLowerCase() === (s.name || '').toLowerCase());
                      return (
                        <span
                          key={s.id}
                          title={`${s.name}: Bindet ${s.channeledFocus} kanalisierten Fokus.${buff ? ` Aktiver Effekt: ${buff.description}.` : ''} Klick auf 'Aufheben' wandelt diesen Fokus in erschöpften Fokus um.`}
                          className="inline-flex items-center gap-1.5 bg-erhoeht hover:bg-rahmen text-schrift border border-kanalisiert hover:border-kanalisiert rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors"
                        >
                          <span className="font-semibold text-schrift">{s.name}</span>
                          {buff && (
                            <span className="text-[11px] text-schrift font-bold bg-magie-grund px-1.5 py-0.2 rounded-knopf border border-magie">
                              {buff.description}
                            </span>
                          )}
                          <span
                            className="text-schrift tabular-nums font-bold text-[11px] bg-kanalisiert-grund px-1.5 py-0.2 rounded-knopf border border-kanalisiert"
                            title={`Bindet ${s.channeledFocus} kanalisierte(n) Fokuspunkt(e)`}
                          >
                            K{s.channeledFocus}
                          </span>
                          <Knopf
                            onClick={() => session.handleCancelChanneledSpell(s)}
                            className="ml-1 text-[11px] font-bold text-leise hover:text-schrift bg-flaeche hover:bg-rahmen px-1.5 py-0.5 rounded-knopf transition-all cursor-pointer flex items-center gap-0.5"
                            title={`'${s.name}' aufheben (${s.channeledFocus} K-Fokus wird zu erschöpftem Fokus)`}
                          >
                            <span>×</span>
                            <span>Aufheben</span>
                          </Knopf>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-leise italic py-0.5">
                    Keine kanalisierten Zauber aktiv
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 4. Abgeleitete Werte & Splitterpunkte Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Abgeleitete Werte */}
        <div className="derived-stats-card @container bg-flaeche rounded-karte border border-rahmen p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-rahmen pb-2 mb-3 gap-2">
              <h3 className="font-bold text-[17px] fantasy-font text-gold-hell flex items-center gap-2 shrink-0">
                <Shield size={18} className="text-gold shrink-0" />
                <span>Abgeleitete Werte</span>
              </h3>
              <span className="text-xs text-leise font-medium whitespace-nowrap truncate text-right">Splittermond Kampfwirkung</span>
            </div>

            <div className="grid grid-cols-3 @[480px]:grid-cols-6 gap-2 text-center derived-stats-grid">
              <div
                className="bg-erhoeht rounded-knopf px-2 py-3 border border-rahmen"
                title={[
                  'Geschwindigkeit (GSW)',
                  totalHandicap > 0 ? `reduziert um ${Math.floor(totalHandicap / 2)} durch halbe Behinderung von ${totalHandicap}` : '',
                  zustandsErklaerung('GSW', zw),
                ].filter(Boolean).join('\n')}
              >
                <span className="text-[11px] uppercase tracking-widest text-leise block mb-1">GSW</span>
                <span className="font-titel text-2xl font-bold text-schrift tabular-nums">
                  {effectiveGSW}
                  {zw.erklaerung.GSW ? (
                    <span className="text-[11px] text-schaden font-bold ml-1 tabular-nums">(Zustand)</span>
                  ) : totalHandicap > 0 && Math.floor(totalHandicap / 2) > 0 ? (
                    <span className="text-[11px] text-schaden font-bold ml-1 tabular-nums">
                      (-{Math.floor(totalHandicap / 2)})
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="bg-erhoeht rounded-knopf px-2 py-3 border border-rahmen" title={['Initiative (INI)', zustandsErklaerung('INI', zw)].filter(Boolean).join('\n')}>
                <span className="text-[11px] uppercase tracking-widest text-leise block mb-1">INI</span>
                <span className="font-titel text-2xl font-bold text-schrift tabular-nums">
                  {effectiveINI}
                  {zw.plus.INI !== 0 && <span className="text-[11px] text-schaden font-bold ml-1 tabular-nums">({zw.plus.INI > 0 ? '+' : ''}{zw.plus.INI})</span>}
                </span>
              </div>
              <div
                className="bg-erhoeht rounded-knopf px-2 py-3 border border-rahmen"
                title={[
                  gearVtdBonus > 0 || activeSpellMods.vtdBonus > 0
                          ? `VTD: Basis ${derived.VTD - gearVtdBonus} + Ausrüstung +${gearVtdBonus}${activeSpellMods.vtdBonus > 0 ? ` + Zauber +${activeSpellMods.vtdBonus} (${activeSpellMods.breakdown.filter((b) => b.vtd).map((b) => b.spellName).join(', ')})` : ''}`
                          : 'Verteidigung',
                  calc.waffenVtd?.wert ? `Waffe: ${calc.waffenVtd.wert} durch ${calc.waffenVtd.quelle}` : '',
                  zustandsErklaerung('VTD', zw),
                  ...zw.hinweise,
                ].filter(Boolean).join('\n')}
              >
                <span className="text-[11px] uppercase tracking-widest text-leise block mb-1">VTD</span>
                <span className="font-titel text-2xl font-bold text-schrift tabular-nums">
                  {effectiveVTD}
                  {zw.plus.VTD !== 0 && <span className="text-[11px] text-schaden font-bold ml-1">({zw.plus.VTD > 0 ? '+' : ''}{zw.plus.VTD})</span>}
                  {zw.hinweise.length > 0 && <span className="text-[11px] text-erschoepft font-bold ml-1">(liegend)</span>}
                  {zw.plus.VTD === 0 && zw.hinweise.length === 0 && (
                    <>
                      {gearVtdBonus > 0 && <span className="text-[11px] text-unverletzt font-bold ml-0.5">+{gearVtdBonus}</span>}
                      {activeSpellMods.vtdBonus > 0 && (
                        <span
                          className="text-[11px] text-schrift font-bold ml-0.5 bg-magie-grund px-1 py-0.2 rounded-knopf border border-magie"
                          title={`+${activeSpellMods.vtdBonus} VTD durch aktive Zauber (${activeSpellMods.breakdown.filter((b) => b.vtd).map((b) => b.spellName).join(', ')})`}
                        >
                          +{activeSpellMods.vtdBonus}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </div>
              <div
                className="bg-erhoeht rounded-knopf px-2 py-3 border border-rahmen"
                title={`Schadensreduktion: ${armorSR} Rüstung + ${derived.SR - armorSR} natürlich${activeSpellMods.srBonus > 0 ? ` + ${activeSpellMods.srBonus} Zauber (${activeSpellMods.breakdown.filter((b) => b.sr).map((b) => b.spellName).join(', ')})` : ''}`}
              >
                <span className="text-[11px] uppercase tracking-widest text-leise block mb-1">SR</span>
                <span className="font-titel text-2xl font-bold text-schrift tabular-nums">
                  {effectiveSR}
                  {armorSR > 0 && <span className="text-[11px] text-gold font-bold ml-0.5">({armorSR})</span>}
                  {activeSpellMods.srBonus > 0 && (
                    <span
                      className="text-[11px] text-schrift font-bold ml-0.5 bg-magie-grund px-1 py-0.2 rounded-knopf border border-magie"
                      title={`+${activeSpellMods.srBonus} SR durch aktive Zauber (${activeSpellMods.breakdown.filter((b) => b.sr).map((b) => b.spellName).join(', ')})`}
                    >
                      +{activeSpellMods.srBonus}
                    </span>
                  )}
                </span>
              </div>
              <div className="bg-erhoeht rounded-knopf px-2 py-3 border border-rahmen" title={[activeSpellMods.gwBonus > 0 ? `Geistiger Widerstand (+${activeSpellMods.gwBonus} Zauber)` : 'Geistiger Widerstand', zustandsErklaerung('GW', zw)].filter(Boolean).join('\n')}>
                <span className="text-[11px] uppercase tracking-widest text-leise block mb-1">GW</span>
                <span className="font-titel text-2xl font-bold text-schrift tabular-nums">
                  {effectiveGW}
                  {zw.plus.GW !== 0 && <span className="text-[11px] text-schaden font-bold ml-1">({zw.plus.GW})</span>}
                  {activeSpellMods.gwBonus > 0 && (
                    <span className="text-[11px] text-schrift font-bold ml-0.5 bg-magie-grund px-1 py-0.2 rounded-knopf border border-magie">
                      +{activeSpellMods.gwBonus}
                    </span>
                  )}
                </span>
              </div>
              <div className="bg-erhoeht rounded-knopf px-2 py-3 border border-rahmen" title={[activeSpellMods.kwBonus > 0 ? `Körperlicher Widerstand (+${activeSpellMods.kwBonus} Zauber)` : 'Körperlicher Widerstand', zustandsErklaerung('KW', zw)].filter(Boolean).join('\n')}>
                <span className="text-[11px] uppercase tracking-widest text-leise block mb-1">KW</span>
                <span className="font-titel text-2xl font-bold text-schrift tabular-nums">
                  {effectiveKW}
                  {zw.plus.KW !== 0 && <span className="text-[11px] text-schaden font-bold ml-1">({zw.plus.KW})</span>}
                  {activeSpellMods.kwBonus > 0 && (
                    <span className="text-[11px] text-schrift font-bold ml-0.5 bg-magie-grund px-1 py-0.2 rounded-knopf border border-magie">
                      +{activeSpellMods.kwBonus}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Splitterpunkte */}
        <div className="bg-flaeche rounded-karte border border-rahmen p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-rahmen pb-2 mb-3 gap-2">
              <h3 className="font-bold text-[17px] fantasy-font text-gold-hell flex items-center gap-1.5 shrink-0">
                <Sparkles size={18} className="text-gold shrink-0" />
                <span>Splitterpunkte</span>
              </h3>
              <span className="text-sm font-bold text-gold tabular-nums whitespace-nowrap shrink-0">
                {splitterPoints} / {maxSplitter} SP
              </span>
            </div>

            {/* Visual tokens */}
            <Rauten wert={splitterPoints} von={maxSplitter} beschriftung={`${splitterPoints} von ${maxSplitter} Splitterpunkten`} className="my-3" />
          </div>

          {/* SP controls */}
          <div className="flex items-center gap-2 pt-2 border-t border-rahmen mt-3">
            <Knopf art="primaer"
              disabled={splitterPoints <= 0}
              onClick={() => {
                const newSP = Math.max(0, splitterPoints - 1);
                session.logAndDispatch(
                  { type: 'PLAY_SET_SPLITTER', payload: newSP },
                  {
                    category: 'splitter',
                    title: '1 Splitterpunkt ausgegeben',
                    description: `Splitterpunkte auf ${newSP} SP gesetzt`,
                    badge: { text: '-1 SP', variant: 'gold' },
                  }
                );
                toast.success('1 Splitterpunkt eingesetzt');
              }}
              className="flex-1 text-xs whitespace-nowrap text-center"
            >
              1 SP einsetzen
            </Knopf>
            <div className="flex items-center gap-1 shrink-0">
              <Knopf nurSymbol
                disabled={splitterPoints <= 0}
                onClick={() => {
                  const newSP = Math.max(0, splitterPoints - 1);
                  session.logAndDispatch(
                    { type: 'PLAY_SET_SPLITTER', payload: newSP },
                    {
                      category: 'splitter',
                      title: 'Splitterpunkt -1',
                      badge: { text: '-1 SP', variant: 'gold' },
                    }
                  );
                }}
                className="w-11 h-11 bg-erhoeht hover:bg-rahmen border border-rahmen rounded-knopf flex items-center justify-center font-bold text-schrift disabled:opacity-40 text-xs cursor-pointer"
              >
                -
              </Knopf>
              <Knopf nurSymbol
                onClick={() => {
                  const newSP = splitterPoints + 1;
                  session.logAndDispatch(
                    { type: 'PLAY_SET_SPLITTER', payload: newSP },
                    {
                      category: 'splitter',
                      title: 'Splitterpunkt +1',
                      badge: { text: '+1 SP', variant: 'gold' },
                    }
                  );
                }}
                className="w-11 h-11 bg-erhoeht hover:bg-rahmen border border-rahmen rounded-knopf flex items-center justify-center font-bold text-schrift text-xs cursor-pointer"
              >
                +
              </Knopf>
            </div>
          </div>
        </div>
      </div>

      {/* ── Take Damage Modal ── */}
      {showTakeDamageModal && (
        <TakeDamageModal
          onClose={() => setShowTakeDamageModal(false)}
          maxLP={maxLP}
          derivedSR={effectiveSR}
          armorSR={armorSR || 0}
          currentSplitterPoints={splitterPoints}
          activeTempHP={activeTempHP}
          currentHealthSlots={healthSlots}
          aktiveZustaende={conditions}
          onApplyDamage={({ kind, amount, spendSplitter, selectedConditions, note }) => {
            if (spendSplitter && splitterPoints > 0) {
              const newSP = splitterPoints - 1;
              session.logAndDispatch(
                { type: 'PLAY_SET_SPLITTER', payload: newSP },
                {
                  category: 'splitter',
                  title: '1 Splitterpunkt eingesetzt (Schaden um 5 reduziert)',
                  description: `Splitterpunkte auf ${newSP} SP gesetzt (GRW S. 81)`,
                  badge: { text: '-1 SP', variant: 'warning' },
                }
              );
            }

            if (amount > 0) {
              const kindLabel =
                kind === 'consumed'
                  ? 'echter Schaden'
                  : kind === 'exhausted'
                  ? 'Betäubungsschaden'
                  : 'kanalisierter Schaden';

              session.logAndDispatch(
                { type: 'PLAY_TAKE_DAMAGE', payload: { kind, amount, maxLP } },
                {
                  category: 'damage',
                  title: `${amount} ${kindLabel}`,
                  description: note ? `${amount} ${kindLabel} erlitten (${note})` : `${amount} ${kindLabel} erlitten`,
                  badge: { text: `-${amount} LP`, variant: kind === 'consumed' ? 'danger' : 'warning' },
                }
              );
              toast.success(`${amount} ${kindLabel} erlitten`);
            } else {
              toast.success('Kein Schaden erlitten (vollständig abgewehrt)');
            }

            if (selectedConditions && selectedConditions.length > 0) {
              selectedConditions.forEach((c) => {
                const newCondition: StatusCondition = {
                  id: generateId(),
                  key: c.key,
                  level: c.level,
                };
                session.logAndDispatch(
                  { type: 'PLAY_ADD_CONDITION', payload: newCondition },
                  {
                    category: 'condition',
                    title: `Zustand erhalten: ${c.key}${c.level ? ` ${c.level}` : ''}`,
                    description: `${c.key} hinzugefügt`,
                    badge: { text: `${c.key}${c.level ? ` ${c.level}` : ''}`, variant: 'warning' },
                  }
                );
              });
              toast.success(`${selectedConditions.length} Zustand/Zustände hinzugefügt`);
            }
          }}
        />
      )}

      {/* ── Heal Modal (GRW S. 119–120, 173–174) ── */}
      {showHealModal && (
        <HealModal
          onClose={() => setShowHealModal(false)}
          maxLP={maxLP}
          currentHealthSlots={healthSlots}
          activeConditions={conditions}
          onApplyHeal={({ consumedHealed, exhaustedHealed, channeledHealed, kanalisiertFreigegeben = 0, conditionsToRemove, note, healMethod }) => {
            const totalHealed = consumedHealed + exhaustedHealed + channeledHealed;
            if (kanalisiertFreigegeben > 0) {
              session.logAndDispatch(
                { type: 'PLAY_KANALISIERT_FREIGEBEN', payload: { amount: kanalisiertFreigegeben } },
                {
                  category: 'heal',
                  title: 'Kanalisierter Schaden freigegeben',
                  description: `${kanalisiertFreigegeben} kanalisierte Punkte werden zu Betäubungsschaden (Zustand aufgehoben, GRW S. 173)`,
                  badge: { text: `${kanalisiertFreigegeben} → Betäubung`, variant: 'info' },
                }
              );
            }

            if (consumedHealed > 0) {
              dispatch({
                type: 'PLAY_UNDO_DAMAGE',
                payload: { kind: 'consumed', amount: consumedHealed, maxLP },
              });
            }
            if (exhaustedHealed > 0) {
              dispatch({
                type: 'PLAY_UNDO_DAMAGE',
                payload: { kind: 'exhausted', amount: exhaustedHealed, maxLP },
              });
            }
            if (channeledHealed > 0) {
              dispatch({
                type: 'PLAY_UNDO_DAMAGE',
                payload: { kind: 'channeled', amount: channeledHealed, maxLP },
              });
            }

            if (conditionsToRemove && conditionsToRemove.length > 0) {
              conditionsToRemove.forEach((cId) => {
                const cond = conditions.find((c) => c.id === cId);
                session.logAndDispatch(
                  { type: 'PLAY_REMOVE_CONDITION', payload: { id: cId } },
                  {
                    category: 'condition',
                    title: 'Zustand beendet durch Heilung',
                    description: cond ? `${cond.key} aufgehoben` : 'Zustand aufgehoben',
                    badge: { text: cond ? `${cond.key} weg` : 'Zustand weg', variant: 'success' },
                  }
                );
              });
            }

            if (totalHealed > 0 || (conditionsToRemove && conditionsToRemove.length > 0)) {
              const details: string[] = [];
              if (consumedHealed > 0) details.push(`${consumedHealed} echter Schaden`);
              if (exhaustedHealed > 0) details.push(`${exhaustedHealed} Betäubung`);
              if (channeledHealed > 0) details.push(`${channeledHealed} kanalisiert`);
              if (conditionsToRemove && conditionsToRemove.length > 0) {
                details.push(`${conditionsToRemove.length} Zustand/Zustände beendet`);
              }

              session.logAndDispatch(
                { type: 'PLAY_UNDO_DAMAGE', payload: { kind: 'consumed', amount: 0, maxLP } },
                {
                  category: 'heal',
                  title: totalHealed > 0 ? `+${totalHealed} LP geheilt` : 'Zustände geheilt',
                  description: `${healMethod ?? 'Geheilt'}: ${details.join(', ')}${note ? ` (${note})` : ''}`,
                  badge: { text: totalHealed > 0 ? `+${totalHealed} LP` : 'Geheilt', variant: 'success' },
                }
              );
              toast.success(totalHealed > 0 ? `+${totalHealed} LP geheilt` : 'Zustand beendet');
            }
          }}
        />
      )}
    </div>
  );
};
