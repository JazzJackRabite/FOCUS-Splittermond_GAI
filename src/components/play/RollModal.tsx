import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { X, Sparkles, Zap, Check } from 'lucide-react';
import DiceIcon from '../ui/DiceIcon';
import { Dialog, Knopf, Wahlknopf } from '../../fundament';
import type { RollEntry } from './DiceLog';
import { generateId } from '../../utils/id';
import type { StatusCondition, ChanneledSpell } from '../../types';
import {
  getActiveRollModifiers, probenbereich,
  isSkillAffectedByBehinderung,
  type ActiveRollModifier,
} from '../../utils/conditionModifiers';
import { begrenzeZauberbonus, getActiveSpellRollBonuses, zauberHoechstbonus } from '../../utils/magicRules';
import { CharacterContext } from '../../context/CharacterContext';
import { SituativeBoni, useSituativeBoni } from './SituativeBoni';

// ---------------------------------------------------------------
// Dice roll logic (RAW)
// ---------------------------------------------------------------

type RollType = 'standard' | 'safe' | 'risk';

import { wuerfeln, type WurfErgebnis as RollResult } from '../../utils/wuerfeln';
import { erfolgsgrade } from '../../regelwerk/proben';

/** Stabile leere Liste: ein `= []` als Vorgabe erzeugt bei jedem Rendern ein neues Array und löst über den Effekt unten eine Endlosschleife aus. */
const KEINE_ZAUBER: ChanneledSpell[] = [];

export { wuerfeln };

// ---------------------------------------------------------------
// Erfolgsgrade (EG) – success-degree helpers
// ---------------------------------------------------------------

interface EGResult {
  eg: number;
  differenz: number;
  qualitaet: string;
  qualitaetEmoji: string;
  hasFumbleModifier: boolean;
  hasCritModifier: boolean;
}

function calcEG(
  total: number,
  schwierigkeit: number,
  isFumble: boolean,
  isCrit: boolean,
): EGResult {
  // Erfolgsgrade und Einstufung nach den Probenregeln des Pakets (regelwerk/proben.ts, GRW S. 17–18)
  const r = erfolgsgrade(total, schwierigkeit, isFumble, isCrit);
  return { eg: r.eg, differenz: r.differenz, qualitaet: r.einstufung, qualitaetEmoji: '', hasFumbleModifier: isFumble, hasCritModifier: r.triumph };
}

export interface RollModalProps {
  skillName: string;
  /** Wer würfelt: beim Begleiter keine Stärken, Meisterschaften und Relikte des Helden */
  wuerfelnder?: 'held' | 'begleiter';
  baseValue: number;
  woundPenalty?: number;
  healthLevelName?: string;
  conditions?: StatusCondition[];
  channeledSpells?: ChanneledSpell[];
  activeModifiers?: ActiveRollModifier[];
  /** Behinderung (Armor / Shield / Overweight Handicap) */
  behinderung?: number;
  /** Current available splinter points */
  splitterPoints?: number;
  /** Callback when 1 SP is spent during or for this roll (ohne: kein Splitterpunkte-Bereich, z. B. bei Begleitern) */
  onSpendSplitterPoint?: (reason: string) => void;
  onClose: () => void;
  /** Optional callback after a successful roll (e.g. deduct focus costs) */
  onSuccess?: () => void;
  /** If provided, shows a "Erfolg!" button after rolling */
  successLabel?: string;
  /** Pre-fills the Schwierigkeit (difficulty) field */
  initialSchwierigkeit?: number;
  /** Großmeister (ab 15 Fertigkeitspunkten): zusätzlicher W10 bei jeder Probe */
  grossmeister?: boolean;
  /** Called when the roll fails against the Schwierigkeit (total < schwierigkeit) */
  onFailure?: () => void;
  /** Custom outcome labels shown automatically after rolling when Schwierigkeit is set */
  probeOutcomeLabels?: { success: string; failure: string };
  /** Optional callback to log roll to history */
  onRecordRoll?: (entry: RollEntry) => void;
}

// ---------------------------------------------------------------
// Animated D10 die face – uses DiceIcon shape with overlaid number
// ---------------------------------------------------------------
const DICE_VIEWBOX_WIDTH = 130.97302;
const DICE_VIEWBOX_HEIGHT = 115.3993;

const D10Face: React.FC<{ value: number; dimmed?: boolean }> = ({ value, dimmed = false }) => {
  const iconSize = 54;
  const iconHeight = Math.round(iconSize * (DICE_VIEWBOX_HEIGHT / DICE_VIEWBOX_WIDTH));
  return (
    <div
      className={`relative inline-flex items-center justify-center drop-shadow-md${dimmed ? ' opacity-40' : ''}`}
      style={{ width: iconSize, height: iconHeight }}
    >
      <DiceIcon size={iconSize} />
      <span
        className="absolute inset-0 flex items-center justify-center font-bold"
        style={{ fontFamily: 'var(--font-titel)', fontSize: 18, color: 'var(--color-schrift)' }}
      >
        {value}
      </span>
    </div>
  );
};

export const RollModal: React.FC<RollModalProps> = ({
  skillName,
  wuerfelnder = 'held',
  baseValue,
  woundPenalty = 0,
  healthLevelName = 'Unverletzt',
  conditions = [],
  channeledSpells = KEINE_ZAUBER,
  activeModifiers,
  behinderung = 0,
  splitterPoints = 0,
  onSpendSplitterPoint,
  onClose,
  onSuccess,
  successLabel,
  initialSchwierigkeit,
  onFailure,
  grossmeister = false,
  probeOutcomeLabels,
  onRecordRoll,
}) => {
  const [rollType, setRollType] = useState<RollType>('standard');

  const initialModifiers = useMemo(() => {
    if (activeModifiers) return activeModifiers;
    const isAffected = isSkillAffectedByBehinderung(skillName);
    return getActiveRollModifiers(
      conditions,
      woundPenalty,
      healthLevelName,
      behinderung,
      isAffected,
      probenbereich(skillName),
      skillName
    );
  }, [activeModifiers, conditions, woundPenalty, healthLevelName, behinderung, skillName]);

  const [modifiersList, setModifiersList] = useState<ActiveRollModifier[]>(initialModifiers);
  const situativ = useSituativeBoni('probe', skillName, wuerfelnder === 'begleiter');

  // Splittermond GRW: Aktive kanalisierte Zauber-Boni (automatisch aktiv)
  const spellBonuses = useMemo(() => {
    return getActiveSpellRollBonuses(channeledSpells, skillName, false);
  }, [channeledSpells, skillName]);

  const [activeSpellBonusIds, setActiveSpellBonusIds] = useState<Set<string>>(() => {
    return new Set(spellBonuses.filter((b) => b.active).map((b) => b.id));
  });

  useEffect(() => {
    setActiveSpellBonusIds(new Set(spellBonuses.filter((b) => b.active).map((b) => b.id)));
  }, [spellBonuses]);

  const toggleSpellBonus = (id: string) => {
    setActiveSpellBonusIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Höchstbonus aus Zauberei (GRW S. 18–19): 3 zu Spielbeginn, +1 je Heldengrad
  const hoechstbonusZauber = zauberHoechstbonus(useContext(CharacterContext)?.calc);
  const spellBonusRoh = useMemo(() => {
    return spellBonuses
      .filter((b) => activeSpellBonusIds.has(b.id))
      .reduce((sum, b) => sum + b.bonus, 0);
  }, [spellBonuses, activeSpellBonusIds]);
  const spellBonusTotal = begrenzeZauberbonus(spellBonusRoh, hoechstbonusZauber);

  const [extraModifier, setExtraModifier] = useState(0);
  const [extraModifierStr, setExtraModifierStr] = useState('0');
  const [schwierigkeit, setSchwierigkeit] = useState<number | null>(initialSchwierigkeit ?? null);
  const [schwierigkeitStr, setSchwierigkeitStr] = useState(
    initialSchwierigkeit !== undefined ? String(initialSchwierigkeit) : '',
  );
  const [result, setResult] = useState<RollResult | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [splinterBonusSpent, setSplinterBonusSpent] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const conditionMalusTotal = modifiersList
    .filter((m) => m.active)
    .reduce((sum, m) => sum + m.malus, 0);

  const splinterModifier = splinterBonusSpent ? 3 : 0;
  const effectiveModifier = conditionMalusTotal + situativ.summe + extraModifier + splinterModifier + spellBonusTotal;
  const diceCount = (rollType === 'risk' ? 4 : 2) + (grossmeister ? 1 : 0);

  const toggleModifier = (id: string) => {
    setModifiersList((prev) =>
      prev.map((m) => (m.id === id ? { ...m, active: !m.active } : m))
    );
  };

  const executeRoll = (bonusApplied = splinterBonusSpent) => {
    const r: RollResult = wuerfeln(rollType, grossmeister);

    // Clear any previous timeout
    if (timeoutRef.current !== null) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

    // Start animation
    setIsRolling(true);
    setResult(null);

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setIsRolling(false);
      setResult(r);

      const currentEffMod = conditionMalusTotal + situativ.summe + extraModifier + (bonusApplied ? 3 : 0) + spellBonusTotal;
      const computedTotal = baseValue + r.result + currentEffMod;
      const computedEg =
        schwierigkeit !== null
          ? calcEG(computedTotal, schwierigkeit, r.isFumble, r.isCrit).eg
          : undefined;

      const activeConditionLabels = modifiersList
        .filter((m) => m.active)
        .map((m) => `${m.label} (${m.malus >= 0 ? `+${m.malus}` : m.malus})`);
      activeConditionLabels.push(...situativ.labels);

      const activeSpellBonusLabels = spellBonuses
        .filter((b) => activeSpellBonusIds.has(b.id))
        .map((b) => `${b.source} (+${b.bonus})`);
      activeConditionLabels.push(...activeSpellBonusLabels);

      if (bonusApplied) {
        activeConditionLabels.push('Splitterpunkt +3');
      }

      const rollLabel = `${skillName} (${rollType === 'standard' ? 'Standard' : rollType === 'safe' ? 'Sicherheit' : 'Risiko'})${
        activeConditionLabels.length > 0 ? ` [${activeConditionLabels.join(', ')}]` : ''
      }`;

      if (onRecordRoll) {
        onRecordRoll({
          id: generateId(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          label: rollLabel,
          d10s: r.dice,
          baseVal: baseValue,
          modifier: currentEffMod,
          total: computedTotal,
          target: schwierigkeit ?? undefined,
          eg: computedEg,
          isTriumph: r.isCrit,
          isPatzer: r.isFumble,
        });
      }
    }, 560);
  };

  const handleRoll = () => {
    setSplinterBonusSpent(false);
    executeRoll(false);
  };

  const handleSplinterBonus = () => {
    if (splitterPoints < 1 || splinterBonusSpent) return;
    if (onSpendSplitterPoint) {
      onSpendSplitterPoint(`+3 auf Probe (${skillName})`);
    }
    setSplinterBonusSpent(true);

    if (result && onRecordRoll) {
      const newEffMod = conditionMalusTotal + situativ.summe + extraModifier + 3 + spellBonusTotal;
      const newComputedTotal = baseValue + result.result + newEffMod;
      const newComputedEg =
        schwierigkeit !== null
          ? calcEG(newComputedTotal, schwierigkeit, result.isFumble, result.isCrit).eg
          : undefined;

      const activeConditionLabels = modifiersList
        .filter((m) => m.active)
        .map((m) => `${m.label} (${m.malus >= 0 ? `+${m.malus}` : m.malus})`);
      activeConditionLabels.push(...situativ.labels);

      const activeSpellBonusLabels = spellBonuses
        .filter((b) => activeSpellBonusIds.has(b.id))
        .map((b) => `${b.source} (+${b.bonus})`);
      activeConditionLabels.push(...activeSpellBonusLabels);
      activeConditionLabels.push('Splitterpunkt +3');

      onRecordRoll({
        id: generateId(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        label: `${skillName} (${rollType === 'standard' ? 'Standard' : rollType === 'safe' ? 'Sicherheit' : 'Risiko'}) [${activeConditionLabels.join(', ')}]`,
        d10s: result.dice,
        baseVal: baseValue,
        modifier: newEffMod,
        total: newComputedTotal,
        target: schwierigkeit ?? undefined,
        eg: newComputedEg,
        isTriumph: result.isCrit,
        isPatzer: result.isFumble,
      });
    }
  };

  const total = result ? baseValue + result.result + effectiveModifier : null;
  const egResult =
    total !== null && result && schwierigkeit !== null
      ? calcEG(total, schwierigkeit, result.isFumble, result.isCrit)
      : null;

  return (
    <Dialog titel={skillName} untertitel="Fertigkeitsprobe" onSchliessen={onClose} breite="schmal">
          {/* Basiswert Info */}
          <div className="bg-seite rounded-knopf p-3 text-sm space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-schrift font-medium">Basiswert:</span>
            <span className="font-bold text-lg text-schrift">{baseValue}</span>
          </div>
          {effectiveModifier !== 0 && (
            <div className="flex justify-between items-center pt-1 border-t border-rahmen">
              <span className="text-schrift font-medium">Gesamt-Modifikator:</span>
              <span className={`font-bold ${effectiveModifier < 0 ? 'text-schaden' : 'text-unverletzt'}`}>
                {effectiveModifier >= 0 ? `+${effectiveModifier}` : effectiveModifier}
              </span>
            </div>
          )}
        </div>

        {/* Aktive Zauber-Wirkungen (GRW: Bärenstärke, Katzenreflexe, Sinne verstärken, etc.) */}
        {spellBonuses.length > 0 && (
          <div className="bg-erhoeht rounded-karte p-3 mb-3 border border-rahmen">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-magie fantasy-font flex items-center gap-1.5">
                <Sparkles size={14} className="text-magie" /> Aktive Zauber-Wirkungen
              </span>
              <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-knopf border bg-magie-grund text-schrift border-magie">
                Bonus: +{spellBonusTotal}
                {spellBonusRoh > spellBonusTotal && ` (von +${spellBonusRoh})`}
              </span>
            </div>
            <p className="text-xs text-magie mb-2 leading-relaxed">
              Aus aktiven Zaubern. Anklicken zum Ab- oder Zuwählen; durchgestrichene gelten nur in bestimmten Lagen.
              {spellBonusRoh > spellBonusTotal && ` Zauberboni sind auf den Höchstbonus +${hoechstbonusZauber} begrenzt (GRW S. 18).`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {spellBonuses.map((b) => {
                const isActive = activeSpellBonusIds.has(b.id);
                return (
                  <Wahlknopf gewaehlt={isActive} mittig key={b.id} onClick={() => toggleSpellBonus(b.id)} title={`${b.description} (Klicken zum ${isActive ? 'Abwählen' : 'Aktivieren'})`} className="text-xs font-bold">
                    {isActive ? (
                      <Check size={12} strokeWidth={3} className="shrink-0 text-magie" />
                    ) : (
                      <X size={12} strokeWidth={3} className="shrink-0 text-leise" />
                    )}
                    <span>{b.source}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-knopf text-[11px] tabular-nums font-bold ${
                        isActive ? 'bg-black/25 text-schrift' : 'bg-rahmen text-schrift'
                      }`}
                    >
                      +{b.bonus}
                    </span>
                  </Wahlknopf>
                );
              })}
            </div>
          </div>
        )}

        {/* Zustands- & Wundabzüge (D&D Beyond Style: automatisch eingerechnet und einzeln abwählbar) */}
        <SituativeBoni boni={situativ.boni} gewaehlt={situativ.gewaehlt} onToggle={situativ.umschalten} typen={situativ.typen} zielTypus={situativ.zielTypus} onZielTypus={situativ.setZielTypus} />

        {modifiersList.length > 0 && (
          <div className="bg-seite rounded-karte p-3 mb-3 border border-rahmen">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-schrift fantasy-font flex items-center gap-1.5">
                <Zap size={14} className="text-gold" /> Aktive Zustände & Wunden
              </span>
              <span
                className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-knopf border ${
                  modifiersList.some((m) => (m.source === 'wound' || m.id === 'wound_penalty') && m.active) || conditionMalusTotal < 0
                    ? 'bg-schaden-grund text-schrift border-schaden'
                    : 'bg-erhoeht text-schrift border-rahmen'
                }`}
              >
                Abzug: {conditionMalusTotal >= 0 ? `+${conditionMalusTotal}` : conditionMalusTotal}
              </span>
            </div>
            <p className="text-xs text-leise mb-2 leading-relaxed">
              Automatisch vorausgewählt. Klicke auf einen Zustand, um ihn für diese Probe abzuwählen:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {modifiersList.map((m) => {
                const isWound = m.source === 'wound' || m.id === 'wound_penalty';
                const isBehinderung = m.source === 'behinderung' || m.id === 'behinderung';
                return (
                  <Wahlknopf
                    key={m.id}
                    gewaehlt={m.active}
                    ton={isWound || isBehinderung ? 'gefahr' : 'gold'}
                    mittig
                    onClick={() => toggleModifier(m.id)}
                    title={`${m.description || m.label} (Klicken zum ${m.active ? 'Abwählen' : 'Aktivieren'})`}
                    className={`px-2.5 text-xs font-bold ${m.active ? '' : 'text-leise line-through'}`}
                  >
                    {m.active ? (
                      <Check
                        size={12}
                        strokeWidth={3}
                        className={`shrink-0 ${isWound || isBehinderung ? 'text-schrift' : 'text-gold'}`}
                      />
                    ) : (
                      <X size={12} strokeWidth={3} className="shrink-0 text-leise" />
                    )}
                    <span>{m.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-knopf text-[11px] tabular-nums font-bold ${
                        m.active
                          ? isWound || isBehinderung
                            ? 'bg-black/25 text-schrift'
                            : 'bg-flaeche text-schrift'
                          : 'bg-rahmen text-schrift'
                      }`}
                    >
                      {m.malus > 0 ? `+${m.malus}` : m.malus}
                    </span>
                  </Wahlknopf>
                );
              })}
            </div>
          </div>
        )}

        {/* Situativer Zusatz-Modifier + Schwierigkeit */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs uppercase text-leise font-bold mb-1">
              Situativer Zusatz-Mod.
            </label>
            <input
              type="number"
              value={extraModifierStr}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                setExtraModifierStr(e.target.value);
                const n = parseInt(e.target.value, 10);
                setExtraModifier(isNaN(n) ? 0 : n);
              }}
              className="w-full bg-flaeche border border-rahmen rounded-knopf px-3 py-1.5 text-schrift font-bold focus:outline-none focus:border-rahmen"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs uppercase text-leise font-bold mb-1">
              Schwierigkeit (optional)
            </label>
            <input
              type="number"
              value={schwierigkeitStr}
              placeholder="—"
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                setSchwierigkeitStr(e.target.value);
                const n = parseInt(e.target.value, 10);
                setSchwierigkeit(isNaN(n) ? null : n);
              }}
              className="w-full bg-flaeche border border-rahmen rounded-knopf px-3 py-1.5 text-schrift font-bold focus:outline-none focus:border-rahmen"
            />
          </div>
        </div>

        {/* Roll type selection */}
        <div className="mb-4">
          <label className="block text-xs uppercase text-leise font-bold mb-2">Wurfart</label>
          <div className="flex gap-2">
            {([
              { key: 'standard', label: 'Standard' },
              { key: 'safe', label: 'Sicherheit' },
              { key: 'risk', label: 'Risiko' },
            ] as { key: RollType; label: string }[]).map(({ key, label }) => (
              <Wahlknopf gewaehlt={rollType === key} mittig key={key} onClick={() => setRollType(key)} className="flex-1 text-sm font-bold">
                {label}
              </Wahlknopf>
            ))}
          </div>
          <p className="text-xs text-leise mt-1">
            {rollType === 'standard' && '2W10 addieren. ≤3 = Patzer, ≥19 = Triumph.'}
            {rollType === 'safe' && '2W10, nur höchster zählt. Kein Patzer/Triumph.'}
            {rollType === 'risk' && '4W10, niedrigste 2 prüfen (Patzer?), sonst höchste 2 addieren.'}
            {grossmeister && ' Großmeister: +1 W10 (zählt nicht für Patzer, sonst gelten die besten Würfel).'}
          </p>
        </div>

        {/* Roll button */}
        <Knopf art="primaer" onClick={handleRoll} disabled={isRolling} className="w-full text-base">
          <DiceIcon size={20} stroke="currentColor" /> Würfeln!
        </Knopf>

        {/* Dice rolling animation */}
        {isRolling && (
          <div className="flex justify-center gap-4 mb-4">
            {Array.from({ length: diceCount }).map((_, i) => (
              <div key={i} className="dice-roll">
                <DiceIcon size={48} />
              </div>
            ))}
          </div>
        )}

        {/* Result */}
        {!isRolling && result && total !== null && (
          <div className="bg-flaeche rounded-karte border border-gold p-4 text-center space-y-2">
            {result.isFumble && (
              <div className="roll-patzer-banner font-bold py-2.5 px-4 rounded-knopf text-lg fantasy-font tracking-wide flex items-center justify-center gap-2">
                
                <span className="tracking-widest font-black">PATZER!</span>
              </div>
            )}
            {result.isCrit && !result.isFumble && (
              <div className="roll-triumph-banner font-bold py-2.5 px-4 rounded-knopf text-lg fantasy-font tracking-wide flex items-center justify-center gap-2">
                
                <span className="tracking-widest font-black">TRIUMPH!</span>
              </div>
            )}
            <div className="flex justify-center gap-3 mb-2">
              {result.dice.map((v, i) => (
                <D10Face
                  key={i}
                  value={v}
                  dimmed={rollType === 'risk' && i < 2}
                />
              ))}
            </div>
            <div className="text-sm font-medium text-leise dark:text-schrift">
              <span className="font-semibold text-schrift dark:text-schrift">{baseValue}</span> (Basis) +{' '}
              <span className="font-semibold text-schrift dark:text-schrift">{result.result}</span> (Wurf){' '}
              {effectiveModifier !== 0 ? (
                <span className={effectiveModifier < 0 ? 'text-schaden dark:text-schaden font-bold tabular-nums' : 'text-unverletzt dark:text-unverletzt font-bold tabular-nums'}>
                  {effectiveModifier >= 0 ? `+ ${effectiveModifier}` : `− ${Math.abs(effectiveModifier)}`} (Mod.)
                </span>
              ) : ''}
            </div>
            <div className="text-5xl font-black tabular-nums text-schrift dark:text-schrift tracking-tight py-1">{total}</div>

            {/* Splitterpunkt einsetzen (GRW Splittermond) */}
            {onSpendSplitterPoint && (
            <div className="mt-3 pt-3 border-t border-rahmen bg-erhoeht -mx-4 -mb-2 p-3 rounded-b-karte border-b border-rahmen">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-schrift fantasy-font flex items-center gap-1">
                  <Sparkles size={14} className="text-gold" /> Splitterpunkte
                </span>
                <span className="text-xs font-bold tabular-nums text-schrift bg-erhoeht border border-rahmen px-2 py-0.5 rounded-knopf">
                  Vorrat: {splitterPoints} SP
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {/* Option 1: +3 Bonus auf diese Probe */}
                <Knopf
                  art={splinterBonusSpent ? 'sekundaer' : 'primaer'}
                  onClick={handleSplinterBonus}
                  disabled={splitterPoints < 1 || splinterBonusSpent}
                  title={
                    splinterBonusSpent
                      ? 'Splitterpunkt-Bonus (+3) bereits für diese Probe angewendet'
                      : splitterPoints < 1
                      ? 'Keine Splitterpunkte mehr verfügbar'
                      : '1 SP einsetzen für +3 auf dieses Würfelergebnis'
                  }
                  className="flex-1 text-xs font-bold"
                >
                  <Sparkles size={14} />
                  <span>{splinterBonusSpent ? '✓ +3 SP aktiv' : 'Splitterpunkt: +3 (1 SP)'}</span>
                </Knopf>

              </div>
            </div>
            )}

            {/* EG block – only when Schwierigkeit was provided */}
            {egResult && (
              <div className="mt-3 pt-3 border-t border-rahmen space-y-1">
                <div className="text-3xl font-bold text-schrift">
                  EG: {egResult.eg >= 0 ? '+' : ''}{egResult.eg}
                </div>
                <div className="inline-block rounded-knopf px-3 py-1 text-sm font-bold bg-erhoeht text-schrift border border-gold">
                  {egResult.qualitaetEmoji} {egResult.qualitaet}
                </div>
                {egResult.hasFumbleModifier && (
                  <div className="text-xs text-schaden font-medium">
                    Patzer: −3 EG, max. −1 EG
                  </div>
                )}
                {egResult.hasCritModifier && (
                  <div className="text-xs text-gold font-medium">
                    Triumph: +3 EG
                  </div>
                )}
                <div className="text-xs text-leise font-medium">
                  Differenz: {egResult.differenz >= 0 ? '+' : ''}{egResult.differenz} (Schwierigkeit {schwierigkeit})
                </div>
              </div>
            )}

            {/* Probe outcome – shown automatically when Schwierigkeit + outcome labels are set */}
            {probeOutcomeLabels && schwierigkeit !== null ? (
              total >= schwierigkeit ? (
                <div className="mt-2 space-y-2">
                  <div className="bg-erhoeht border border-unverletzt rounded-knopf px-4 py-2 text-unverletzt font-bold text-sm ">
                    {probeOutcomeLabels.success}
                  </div>
                  {onSuccess && successLabel && (
                    <Knopf
                      onClick={() => { onSuccess(); onClose(); }}
                      className="w-full"
                    >
                      {successLabel}
                    </Knopf>
                  )}
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="bg-erhoeht border border-schaden rounded-knopf px-4 py-2 text-schaden font-bold text-sm ">
                    {probeOutcomeLabels.failure}
                  </div>
                  {onFailure && (
                    <Knopf art="gefahr"
                      onClick={() => { onFailure(); onClose(); }}
                      className="w-full"
                    >
                      Bewusstlos setzen & schließen
                    </Knopf>
                  )}
                </div>
              )
            ) : (
              onSuccess && successLabel && (
                <Knopf
                  onClick={() => { onSuccess(); onClose(); }}
                  className="mt-2"
                >
                  {successLabel}
                </Knopf>
              )
            )}
          </div>
        )}
    </Dialog>
  );
};

