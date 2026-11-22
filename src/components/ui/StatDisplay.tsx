import React from 'react';

interface StatDisplayProps {
  label: string;
  value: number | string;
  subLabel?: string;
  bonus?: number;
  tooltip?: string;
}

export const StatDisplay: React.FC<StatDisplayProps> = ({ label, value, subLabel, bonus, tooltip }) => {
  const displayVal = typeof value === 'number' && isNaN(value) ? '-' : value;
  return (
    <div className="flex flex-col items-center p-2 stat-box min-w-[80px] flex-shrink-0" title={tooltip}>
      <span className="text-[11px] md:text-xs uppercase font-bold tracking-wider text-leise print:text-black text-center">
        {label}
      </span>
      <span className="text-2xl md:text-3xl font-bold fantasy-font text-schrift print:text-black my-1 flex items-baseline gap-1">
        {displayVal}
        {bonus !== undefined && !isNaN(bonus) && bonus > 0 && (
          <span className="text-sm font-bold text-unverletzt print:text-unverletzt">(+{bonus})</span>
        )}
      </span>
      {subLabel && (
        <span className="text-[11px] text-leise print:text-leise text-center leading-tight">
          {subLabel}
        </span>
      )}
    </div>
  );
};
