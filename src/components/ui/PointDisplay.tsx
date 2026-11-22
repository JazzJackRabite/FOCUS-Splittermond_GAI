import React from 'react';
import type { AppMode } from '../../types';

interface PointDisplayProps {
  current: number;
  max: number;
  label: string;
  mode: AppMode;
}

export const PointDisplay: React.FC<PointDisplayProps> = ({ current, max, label, mode }) => {
  if (mode === 'xp') return null;
  const isComplete = current === max;
  return (
    <div className="text-[11px] uppercase tracking-wider font-bold text-right mt-1">
      {label}:{' '}
      <span className={isComplete ? 'text-unverletzt' : 'text-schaden'}>
        {current} / {max}
      </span>
    </div>
  );
};
