import React from 'react';
import { Knopf } from '../../fundament';
import type { AppMode, CreationUsage } from '../../types';

interface StatusWidgetProps {
  mode: AppMode;
  creationUsage: CreationUsage;
  xpAvailable: number;
  xpTotal?: number;
  heldengrad?: { name: string; [key: string]: any };
  freeMasteries: number;
  freeSpells: number;
  onUndo?: () => void;
  canUndo?: boolean;
  onAddXp?: () => void;
  onToggleCreationMode?: () => void;
}

export const StatusWidget: React.FC<StatusWidgetProps> = ({
  mode,
  creationUsage,
  xpAvailable,
  xpTotal,
  heldengrad,
  freeMasteries,
  freeSpells,
  onUndo,
  canUndo = false,
  onAddXp,
  onToggleCreationMode,
}) => {
  const hgMatch = heldengrad?.name?.match(/^(.*?)\s*(\(.*\))$/);
  const hgTitle = hgMatch ? hgMatch[1].toUpperCase() : (heldengrad?.name?.toUpperCase() || '');
  const hgRank = hgMatch ? hgMatch[2] : '';

  return (
    <div className="bg-erhoeht p-4 rounded-knopf border border-gold text-schrift mb-6 print:hidden">
      <div className="flex justify-between items-start mb-4 gap-4">
        {/* Left: Status & Heldengrad */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <h3 className="font-bold text-[17px] fantasy-font tracking-widest text-gold-hell">STATUS</h3>
            {onToggleCreationMode && (
              mode === 'creation' ? (
                <Knopf art="primaer"
                  onClick={onToggleCreationMode}
                  className="text-xs active:scale-95 whitespace-nowrap"
                  title="Charaktererschaffung abschließen und Steigerung freischalten"
                >
                  Erschaffung abschließen
                </Knopf>
              ) : (
                <Knopf art="sekundaer"
                  onClick={onToggleCreationMode}
                  className="text-xs active:scale-95 whitespace-nowrap"
                  title="Charaktererschaffung wieder bearbeiten"
                >
                  Erschaffung
                </Knopf>
              )
            )}
          </div>
          {heldengrad && hgTitle && (
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-gold fantasy-font leading-tight">
                {hgTitle}
              </span>
              {hgRank && (
                <span className="text-[11px] sm:text-xs text-schrift font-medium leading-tight">
                  {hgRank}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Verfügbare EP & Gesamt-EP */}
        <div className="text-right flex flex-col items-end">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gold">Verfügbare EP</div>
            <div className="text-2xl font-bold leading-none text-schrift">{xpAvailable}</div>
          </div>

          {xpTotal !== undefined && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap justify-end">
              <span className="text-[11px] uppercase tracking-wider text-schrift font-semibold leading-none">
                Gesamt-EP
              </span>
              <span
                className="bg-erhoeht text-schrift font-bold text-xs px-2 py-0.5 rounded-knopf border border-gold select-none"
                title="Gesamt-Erfahrungspunkte"
              >
                {xpTotal}
              </span>
              {mode === 'xp' && onAddXp && (
                <Knopf art="primaer"
                  onClick={onAddXp}
                  className="text-xs active:scale-95 leading-none"
                  title="Erfahrungspunkte hinzufügen"
                >
                  +EP
                </Knopf>
              )}
            </div>
          )}
        </div>
      </div>

    {mode === 'creation' && (
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
        {[
          { label: 'Attr', current: creationUsage.attr, max: 18, extra: null },
          {
            label: 'Skill',
            current: creationUsage.skill,
            max: 55,
            extra:
              creationUsage.nonMagicPoints < 5 ? 'Min. 5 nicht-magisch!' : null,
          },
          {
            label: 'Stärk',
            current: creationUsage.strength,
            max: creationUsage.strengthLimit,
            extra: null,
          },
          {
            label: 'Ress',
            current: creationUsage.resource,
            max: creationUsage.resourceLimit,
            extra: null,
          },
          { label: 'Sprach', current: creationUsage.languages, max: 2, extra: null },
        ].map(({ label, current, max, extra }) => {
          const done = current === max;
          return (
            <div
              key={label}
              className={`p-2 rounded-knopf text-center border border-opacity-30 ${
                done ? 'bg-unverletzt-grund border-unverletzt' : 'bg-erschoepft-grund border-schaden'
              }`}
            >
              <div className="text-[11px] uppercase text-schrift">{label}</div>
              <div className={`font-bold text-lg ${done ? 'text-unverletzt' : 'text-schaden'}`}>
                {current}/{max}
              </div>
              {extra && (
                <div className="text-[11px] text-schaden leading-tight">{extra}</div>
              )}
            </div>
          );
        })}
      </div>
    )}

    <div className="space-y-1 text-sm border-t border-gold pt-2">
      {mode === 'creation' && (
        <div className="flex justify-between">
          <span className="text-schrift">Start-Meisterschaften:</span>
          <span
            className={`font-bold ${
              creationUsage.creationMasteries === 3 ? 'text-unverletzt' : 'text-schaden'
            }`}
          >
            {creationUsage.creationMasteries}/3
          </span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-schrift">Gratis-Meisterschaften:</span>
        <span className="font-bold text-schrift">{freeMasteries} offen</span>
      </div>
      <div className="flex justify-between">
        <span className="text-schrift">Gratis-Zauber:</span>
        <span className="font-bold text-schrift">{freeSpells} offen</span>
      </div>
    </div>
  </div>
);
};
