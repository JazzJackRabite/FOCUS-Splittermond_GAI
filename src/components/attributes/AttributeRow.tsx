import React from 'react';
import { Knopf } from '../../fundament';

import type { AttributeRowProps } from '../../types';
import { grwAttribute } from '../../regelwerk/grwListen';

export const AttributeRow: React.FC<AttributeRowProps> = ({
  attrKey,
  total,
  startValue,
  onIncrease,
  onDecrease,
  canIncrease,
  canDecrease,
  cost,
  mode,
  sperrgrund,
}) => (
  <div className="flex items-center justify-between py-2 border-b border-rahmen last:border-0 print:border-leise gap-2">
    <div className="flex flex-col min-w-0 flex-1 pr-1">
      <span className="font-bold text-sm sm:text-base text-schrift truncate">
        {grwAttribute()[attrKey as keyof ReturnType<typeof grwAttribute>]}
      </span>
      <div className="flex items-center gap-1.5 text-xs text-leise">
        <span className="uppercase font-semibold tracking-wider text-gold">{attrKey}</span>
        {mode === 'xp' && total > startValue && (
          <span className="text-[11px] text-schrift bg-seite border border-rahmen px-1.5 rounded-knopf tabular-nums font-medium">
            Start {startValue}
          </span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 no-print">
      <Knopf nurSymbol
        onClick={onDecrease}
        disabled={!canDecrease}
        className="sm:w-7 sm:h-7 active:scale-95 disabled:pointer-events-none shrink-0 text-sm touch-manipulation"
        aria-label={`${grwAttribute()[attrKey as keyof ReturnType<typeof grwAttribute>]} verringern`}
        title="Verringern"
      >
        -
      </Knopf>
      <div className="flex flex-col items-center justify-center min-w-[2.25rem] sm:min-w-[2.5rem] px-0.5">
        <div className="tabular-nums text-lg sm:text-xl font-bold text-gold leading-none">{total}</div>
        {cost > 0 && (
          <span className="text-[11px] text-leise font-semibold leading-none mt-1 whitespace-nowrap">
            {cost} EP
          </span>
        )}
      </div>
      <Knopf nurSymbol
        onClick={onIncrease}
        disabled={!canIncrease}
        className="sm:w-7 sm:h-7 active:scale-95 disabled:pointer-events-none shrink-0 text-sm touch-manipulation"
        aria-label={`${grwAttribute()[attrKey as keyof ReturnType<typeof grwAttribute>]} erhöhen`}
        title={!canIncrease && sperrgrund ? sperrgrund : 'Erhöhen'}
      >
        +
      </Knopf>
    </div>
  </div>
);
