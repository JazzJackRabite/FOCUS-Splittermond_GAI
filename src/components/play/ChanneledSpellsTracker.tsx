import React, { useState, useMemo } from 'react';
import { Knopf } from '../../fundament';
import {
  Sparkles,
  ZapOff,
  Clock,
  Plus,
  Minus,
  AlertCircle,
  Tag,
  Shield,
} from 'lucide-react';
import type { ChanneledSpell } from '../../types';
import { SourceBadge } from '../ui/SourceBadge';
import { getFullSpellInfo, getActiveSpellModifiers } from '../../utils/magicRules';

interface ChanneledSpellsTrackerProps {
  channeledSpells: ChanneledSpell[];
  onCancelSpell: (spell: ChanneledSpell) => void;
  onUpdateSpell?: (id: string, update: Partial<ChanneledSpell>) => void;
  onOpenCastModal?: () => void;
  className?: string;
  isCombatDashboard?: boolean;
}

export const ChanneledSpellsTracker: React.FC<ChanneledSpellsTrackerProps> = ({
  channeledSpells,
  onCancelSpell,
  onUpdateSpell,
  onOpenCastModal: _onOpenCastModal,
  className = '',
  isCombatDashboard = false,
}) => {
  const [expandedSpellId, setExpandedSpellId] = useState<string | null>(null);
  // Hooks müssen vor jeder frühen Rückgabe stehen (sonst Absturz, sobald der erste Zauber aktiv wird oder der letzte endet)
  const activeMods = useMemo(() => getActiveSpellModifiers(channeledSpells), [channeledSpells]);

  if (channeledSpells.length === 0) {
    if (!isCombatDashboard) return null;
    return (
      <div className={`bg-erhoeht rounded-karte border border-rahmen p-3.5 text-center ${className}`}>
        <div className="flex items-center justify-center gap-2 text-schrift font-bold text-sm">
          <Sparkles size={16} className="text-magie" />
          <span>Keine aktiven kanalisierten Zauber</span>
        </div>
        <p className="text-xs text-leise mt-1">
          Zauber mit kanalisierter Wirkungsdauer binden Fokus und werden hier mit Rundentracker aufgeführt.
        </p>
      </div>
    );
  }

  const totalChanneledFO = channeledSpells.reduce((sum, s) => sum + s.channeledFocus, 0);

  return (
    <div
      className={`bg-erhoeht rounded-karte border border-rahmen p-4 ${className}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b border-rahmen pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-knopf bg-erhoeht text-gold ">
            <Sparkles size={16} />
          </span>
          <div>
            <h3 className="font-bold text-sm text-gold-hell fantasy-font leading-tight">
              Aktive Kanalisierungen ({channeledSpells.length})
            </h3>
            <span className="text-[11px] text-leise">
              Gebundener Fokus: <strong className="tabular-nums text-schrift">{totalChanneledFO} FO</strong>
            </span>
          </div>
        </div>
        <span className="text-xs font-bold text-schrift bg-erhoeht border border-gold px-2 py-0.5 rounded-full">
          Live-Tracking
        </span>
      </div>

      {/* Spells List */}
      <div className="space-y-3">
        {channeledSpells.map((spell) => {
          const isExpanded = expandedSpellId === spell.id;
          const currentRound = spell.activeRounds ?? 1;
          const currentTicks = spell.activeTicks ?? 0;
          const buff = activeMods.breakdown.find((b) => b.spellName.toLowerCase() === (spell.name || '').toLowerCase());
          const spellInfo = getFullSpellInfo({
            name: spell.name,
            school: spell.school || '',
            grade: spell.grade ?? 0,
            cost: spell.channeledFocus,
          });
          const stats = [
            { label: 'Schule', value: spellInfo.school },
            { label: 'Grad', value: spellInfo.grade },
            { label: 'Kanalisiert', value: `${spell.channeledFocus} FO` },
            ...(spellInfo.range && spellInfo.range !== '—' ? [{ label: 'Reichw.', value: spellInfo.range }] : []),
            ...(spellInfo.duration && spellInfo.duration !== '—' ? [{ label: 'Wirkung', value: spellInfo.duration, colSpan: true }] : []),
          ].filter((stat) => stat.value);

          return (
            <div
              key={spell.id}
              className="bg-flaeche rounded-knopf border border-rahmen hover:border-gold transition-all p-3 space-y-2.5"
            >
              {/* Top Row: Name, School, Focus badge & Release Button */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse shrink-0" />
                  <div className="truncate">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-schrift block truncate">
                        {spell.name}
                      </span>
                      {buff && (
                        <span className="text-[11px] font-bold text-schrift bg-magie-grund border border-magie px-1.5 py-0.5 rounded-knopf">
                          {buff.description}
                        </span>
                      )}
                      {spell.targetItemName && (
                        <span className="text-[11px] font-bold text-erschoepft bg-erschoepft-grund border border-erschoepft px-1.5 py-0.5 rounded-knopf flex items-center gap-1">
                          <Tag size={10} className="text-erschoepft" />
                          <span>Ziel: {spell.targetItemName}</span>
                        </span>
                      )}
                      <SourceBadge
                        source={spellInfo.source || 'GRW'}
                        page={spellInfo.page}
                        tooltipData={{ title: spell.name, description: spellInfo.description, stats }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-leise">
                      {spell.school && <span className="text-schrift font-bold">{spell.school}</span>}
                      {spell.grade !== undefined && <span>· Grad {spell.grade}</span>}
                      {spell.startedAt && <span>· Gestartet {spell.startedAt}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-erhoeht text-schrift border border-rahmen text-xs font-bold px-2 py-1 rounded-knopf tabular-nums">
                    {spell.channeledFocus} FO
                  </span>

                  {/* Schnell-Button zum Lösen/Fallenlassen der Kanalisierung */}
                  <Knopf
                    onClick={() => onCancelSpell(spell)}
                    className="bg-erhoeht hover:bg-rahmen text-schaden border border-magie rounded-knopf px-2.5 py-1 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 no-print"
                    title="Kanalisierung sofort beenden – überführt den gebundenen Fokus automatisch in den erschöpften Pool"
                  >
                    <ZapOff size={13} />
                    <span>Lösen</span>
                  </Knopf>
                </div>
              </div>

              {/* Middle Row: Round Tracking & Tick Counters */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-erhoeht border border-rahmen rounded-knopf px-2.5 py-1.5 text-xs">
                {/* Rundenzähler */}
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-gold shrink-0" />
                  <span className="text-leise text-[11px] font-medium">Runde:</span>
                  <div className="flex items-center gap-1 bg-flaeche border border-rahmen rounded-knopf px-1 py-0.5">
                    <Knopf nurSymbol disabled={currentRound <= 1} onClick={() => onUpdateSpell?.(spell.id, { activeRounds: Math.max(1, currentRound - 1) })} title="Runde verringern" aria-label="Runde verringern">
                      <Minus size={10} />
                    </Knopf>
                    <span className="font-bold text-xs tabular-nums px-1 min-w-[1.2rem] text-center text-schrift">
                      {currentRound}
                    </span>
                    <Knopf nurSymbol onClick={() => onUpdateSpell?.(spell.id, { activeRounds: currentRound + 1 })} title="+1 Runde weiter" aria-label="+1 Runde weiter">
                      <Plus size={10} />
                    </Knopf>
                  </div>
                </div>

                {/* Tick-Zähler */}
                <div className="flex items-center gap-1.5">
                  <span className="text-leise text-[11px] font-medium">Ticks:</span>
                  <div className="flex items-center gap-1 bg-flaeche border border-rahmen rounded-knopf px-1 py-0.5">
                    <Knopf nurSymbol disabled={currentTicks <= 0} onClick={() => onUpdateSpell?.(spell.id, { activeTicks: Math.max(0, currentTicks - 1) })} title="Tick verringern" aria-label="Tick verringern">
                      <Minus size={10} />
                    </Knopf>
                    <span className="font-bold text-xs tabular-nums px-1 min-w-[1.2rem] text-center text-schrift">
                      {currentTicks}
                    </span>
                    <Knopf nurSymbol onClick={() => onUpdateSpell?.(spell.id, { activeTicks: currentTicks + 1 })} title="+1 Tick" aria-label="+1 Tick">
                      <Plus size={10} />
                    </Knopf>
                  </div>
                  <Knopf
                    onClick={() => onUpdateSpell?.(spell.id, { activeTicks: currentTicks + 3 })}
                    className="text-[11px]"
                    title="+3 Ticks"
                  >
                    +3
                  </Knopf>
                </div>

                {/* Toggle details */}
                {(spell.enhancements?.length || spell.notes || spell.target) && (
                  <Knopf
                    onClick={() => setExpandedSpellId(isExpanded ? null : spell.id)}
                    className="text-[11px] underline ml-auto"
                  >
                    {isExpanded ? 'Details verbergen' : 'Details'}
                  </Knopf>
                )}
              </div>

              {/* Optional Expanded Details */}
              {(isExpanded || (spell.enhancements && spell.enhancements.length > 0)) && (
                <div className="text-xs space-y-1.5 pt-1 border-t border-rahmen">
                  {spell.target && (
                    <div className="flex items-center gap-1 text-leise">
                      <Shield size={11} className="text-leise" />
                      <span>Ziel: <strong>{spell.target}</strong></span>
                    </div>
                  )}
                  {spell.enhancements && spell.enhancements.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <Tag size={11} className="text-gold" />
                      {spell.enhancements.map((enh, idx) => (
                        <span
                          key={idx}
                          className="bg-erhoeht text-schrift border border-rahmen text-[11px] font-semibold px-1.5 py-0.5 rounded-knopf"
                        >
                          {enh}
                        </span>
                      ))}
                    </div>
                  )}
                  {spell.notes && (
                    <p className="text-[11px] text-leise italic bg-erhoeht p-1.5 rounded-knopf">
                      „{spell.notes}“
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info footer */}
      <div className="mt-2.5 flex items-center gap-1 text-[11px] text-leise">
        <AlertCircle size={12} className="shrink-0 text-gold" />
        <span>
          Beim Lösen der Kanalisierung wird der Fokus gemäß Splittermond-Regeln automatisch in erschöpften Fokus
          umgewandelt.
        </span>
      </div>
    </div>
  );
};
