import React from 'react';
import { Knopf } from '../../fundament';
import { SourceBadge } from '../ui/SourceBadge';

import { getMasteryDescription } from '../../utils/gameResourceManager';
import { grossmeisterAb } from '../../regelwerk/bruecke';
import type { Mastery, Spell, AppMode } from '../../types';
import { grwAllgemeineKampfmeisterschaften, grwAttribute, grwFertigkeitsKategorien, grwMeisterschaften } from '../../regelwerk/grwListen';

interface SkillRowProps {
  name: string;
  val: number;
  totalValue: number | null;
  onIncrease: () => void;
  onDecrease: () => void;
  canIncrease: boolean;
  cost: number;
  masteries: Mastery[];
  onAddMastery: () => void;
  onRemoveMastery: (idx: number) => void;
  onRemoveMasteryById?: (id: string) => void;
  freeSlots: number;
  onAddSpell: () => void;
  spells: Spell[];
  onRemoveSpell: (s: Spell) => void;
  freeSpellSlotsCount: number;
  attrs: string[] | null;
  currentAttributes: Record<string, number>;
  isOpen: boolean;
  onToggle: () => void;
  creationMode?: boolean;
  creationBudget?: number;
  canDecrease?: boolean;
  mode?: AppMode;
}

export const SkillRow: React.FC<SkillRowProps> = ({
  name,
  val,
  totalValue,
  onIncrease,
  onDecrease,
  canIncrease,
  canDecrease = true,
  cost,
  masteries,
  onAddMastery,
  onRemoveMastery,
  onRemoveMasteryById,
  freeSlots,
  onAddSpell,
  spells,
  onRemoveSpell,
  freeSpellSlotsCount,
  attrs,
  currentAttributes,
  isOpen,
  onToggle,
  creationMode = false,
  creationBudget = 0,
  mode = 'creation',
}) => {
  const isMagic = grwFertigkeitsKategorien().MAGIC.includes(name);

  let tooltipText = '';
  if (attrs && currentAttributes) {
    const [a1, a2] = attrs;
    const v1 = currentAttributes[a1];
    const v2 = currentAttributes[a2];
    tooltipText = `${grwAttribute()[a1 as keyof ReturnType<typeof grwAttribute>]} (${v1}) + ${grwAttribute()[a2 as keyof ReturnType<typeof grwAttribute>]} (${v2}) + Punkte (${val}) = ${totalValue}`;
  }

  const sortedMasteries = [...masteries].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.name.localeCompare(b.name);
  });

  const sortedSpells = [...spells].sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return a.name.localeCompare(b.name);
  });

  const getMasteryDesc = (mName: string): string | undefined => {
    const customDesc = getMasteryDescription(name, mName);
    if (customDesc) return customDesc;
    let found = (grwMeisterschaften()[name] ?? []).find((x) => x.name === mName);
    if (!found && grwFertigkeitsKategorien().COMBAT.includes(name))
      found = grwAllgemeineKampfmeisterschaften().find((x) => x.name === mName);
    if (!found && grwFertigkeitsKategorien().MAGIC.includes(name))
      found = (grwMeisterschaften()['Magieschulen'] ?? []).find((x) => x.name === mName);
    return found?.desc;
  };

  const containerClasses = isOpen
    ? `rounded-knopf mb-2 border transition-all ${
        isMagic
          ? 'bg-seite border-kanalisiert border-l-4 border-l-kanalisiert'
          : 'bg-seite border-gold border-l-4 border-l-gold'
      }`
    : val > 0
    ? `rounded-knopf mb-1 border transition-colors ${
        isMagic
          ? 'bg-seite border-rahmen border-l-2 border-l-kanalisiert hover:border-kanalisiert'
          : 'bg-seite border-rahmen hover:border-gold'
      }`
    : `rounded-knopf mb-1 border transition-colors border-transparent hover:border-rahmen hover:bg-seite ${
        isMagic ? 'border-l-2 border-l-rahmen' : ''
      }`;

  return (
    <div className={containerClasses}>
      <div className="flex flex-wrap md:flex-nowrap items-center justify-between py-1.5 px-2.5">
        <div
          className="w-full md:w-1/2 flex items-center cursor-pointer mb-2 md:mb-0 select-none group"
          onClick={onToggle}
        >
          <span
            className={`text-xs mr-2 transition-transform duration-150 ${
              isOpen ? 'rotate-90 text-gold' : 'text-leise group-hover:text-schrift'
            }`}
          >
            ▶
          </span>
          <span
            className={`text-sm md:text-base truncate transition-colors ${
              isOpen
                ? 'text-schrift font-bold'
                : val > 0
                ? 'text-schrift font-semibold'
                : 'text-leise group-hover:text-schrift'
            }`}
          >
            {name}
          </span>
          {freeSlots > 0 && (
            <span
              className="ml-2 text-[11px] tabular-nums font-bold px-2 py-0.5 rounded-full shrink-0 border bg-erhoeht text-gold border-gold badge-free-mastery"
              title={`Verfügbare Gratis-Meisterschaften: ${freeSlots}`}
            >
              {freeSlots}
            </span>
          )}
          {freeSpellSlotsCount > 0 && isMagic && (
            <span
              className="ml-2 text-[11px] tabular-nums font-bold px-2 py-0.5 rounded-full shrink-0 border bg-erhoeht text-schrift border-kanalisiert badge-free-spell"
              title={`Verfügbare Gratis-Zauber: ${freeSpellSlotsCount}`}
            >
              {freeSpellSlotsCount}
            </span>
          )}
        </div>
        <div className="w-1/4 md:w-1/6 text-center text-sm text-leise print:text-black shrink-0 md:mb-0">
          {totalValue !== null ? (
            <span title={tooltipText} className="cursor-help inline-flex items-center gap-1">
              <span className="text-xs text-gold tabular-nums">∑</span>
              <span className="font-bold text-schrift">{totalValue}</span>
            </span>
          ) : (
            <span className="text-[11px] italic text-leise">Waffe</span>
          )}
        </div>
        <div className="w-full md:w-1/3 flex justify-end items-center space-x-1 md:space-x-2 no-print mt-1 md:mt-0">
          <div className="flex items-center space-x-1">
            <Knopf nurSymbol
              onClick={onDecrease}
              disabled={!canDecrease}
              className="sm:w-7 sm:h-7 active:scale-95 disabled:pointer-events-none shrink-0 text-sm touch-manipulation"
              title="Verringern"
              aria-label={`${name} verringern`}
            >
              -
            </Knopf>
            <span
              className={`w-8 md:w-6 text-center font-bold tabular-nums text-sm ${
                val > 0 ? 'text-gold' : 'text-leise'
              }`}
            >
              {val}
            </span>
            <Knopf nurSymbol
              onClick={onIncrease}
              disabled={!canIncrease}
              className="sm:w-7 sm:h-7 active:scale-95 disabled:pointer-events-none shrink-0 text-sm touch-manipulation"
              title="Erhöhen"
              aria-label={`${name} erhöhen`}
            >
              +
            </Knopf>
          </div>
          <span className="w-12 md:w-10 text-[11px] text-right text-gold font-bold shrink-0">
            {cost > 0 ? `${cost} EP` : ''}
          </span>
        </div>
        <span className="hidden print-only font-bold text-black ml-auto">
          {val} / ∑ {totalValue}
        </span>
      </div>

      {isOpen && (
        <div className="px-3 md:px-6 pb-3 pt-2 text-sm skill-details border-t border-rahmen space-y-2.5">
          <div className="text-[11px] uppercase tracking-wider font-bold border-b border-rahmen pb-1.5 flex justify-between items-center text-gold">
            <span>Optionen</span>
            <span className="no-print hidden md:inline text-[11px] font-normal text-leise">
              {val < 6
                ? 'Meisterschaften ab Wert 6'
                : val < 9
                ? 'Schwelle 1 verfügbar'
                : val < 12
                ? 'Schwelle 2 verfügbar'
                : val < 15
                ? 'Schwelle 3 verfügbar'
                : 'Schwelle 4 verfügbar'}
            </span>
          </div>
          {val >= grossmeisterAb() && (
            <div className="text-xs rounded-knopf border border-gold bg-erhoeht text-gold px-2 py-1" data-testid="grossmeister">
              <strong>Großmeister</strong>: bei jeder Probe in {name} ein zusätzlicher W10 (zählt nicht für Patzer, GRW S. 92). Wird beim Würfeln automatisch berücksichtigt.
            </div>
          )}
          {(val >= 6 || (creationMode && creationBudget > 0 && val >= 1)) && (
            <Knopf art="sekundaer"
              onClick={onAddMastery}
              className="text-xs active:scale-[0.98] md:py-1.5 w-full text-center no-print touch-manipulation"
            >
              + Meisterschaft hinzufügen
            </Knopf>
          )}
          {isMagic && val >= 1 && (
            <Knopf
              onClick={onAddSpell}
              className="text-xs active:scale-[0.98] md:py-1.5 w-full text-center no-print touch-manipulation"
            >
              + Zauber hinzufügen
            </Knopf>
          )}

          {sortedMasteries.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[11px] uppercase text-gold font-bold tracking-wider">
                Meisterschaften
              </div>
              {sortedMasteries.map((m, idx) => {
                const baseDesc =
                  m.desc || getMasteryDesc(m.name) || 'Details zur Meisterschaft im Regelwerk.';
                const description = m.userNote ? `${baseDesc}\n\n${m.userNote}` : baseDesc;
                const canRemoveMastery =
                  mode === 'creation' ||
                  (mode === 'xp' && !m.isCreationBonus && m.source !== 'Erschaffung');
                return (
                  <div
                    key={m.id || idx}
                    className="flex justify-between items-center bg-seite p-2 rounded-knopf border border-rahmen hover:border-rahmen text-xs transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-schrift">
                        {m.name}
                        {!/\(S\d+\)/.test(m.name) && (
                          <span className="font-normal text-leise ml-1">(S{m.tier})</span>
                        )}
                      </span>
                      <SourceBadge
                        source={m.source}
                        page={m.page}
                        tooltipData={{ title: m.name, description }}
                      />
                    </div>
                    {canRemoveMastery && (
                      <Knopf
                        onClick={() =>
                          onRemoveMasteryById ? onRemoveMasteryById(m.id) : onRemoveMastery(idx)
                        }
                        className="text-base"
                        title="Löschen"
                      >
                        ×
                      </Knopf>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {sortedSpells.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[11px] uppercase text-kanalisiert font-bold tracking-wider">
                Zauber
              </div>
              {sortedSpells.map((s, idx) => {
                const stats = [
                  { label: 'Schule', value: s.school },
                  { label: 'Grad', value: s.grade },
                  { label: 'Fokus', value: String(s.cost) },
                  ...(s.castTime ? [{ label: 'Dauer', value: s.castTime }] : []),
                  ...(s.range ? [{ label: 'Reichw.', value: s.range }] : []),
                  ...(s.duration
                    ? [{ label: 'Wirkung', value: s.duration, colSpan: true }]
                    : []),
                ].filter((stat) => stat.value);

                const canRemoveSpell = mode === 'creation' || s.sourceMode === 'xp';

                return (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-seite p-2 rounded-knopf border border-rahmen hover:border-rahmen text-xs transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-kanalisiert">
                        {s.name}{' '}
                        <span className="font-normal text-leise">(Grad {s.grade})</span>
                      </span>
                      <SourceBadge
                        source={s.source}
                        page={s.page}
                        tooltipData={{ title: s.name, description: s.description, stats }}
                      />
                    </div>
                    {canRemoveSpell && (
                      <Knopf
                        onClick={() => onRemoveSpell(s)}
                        className="text-base"
                        title="Löschen"
                      >
                        ×
                      </Knopf>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
