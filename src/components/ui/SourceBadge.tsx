import { Dialogfenster, Dialoghintergrund } from '../../fundament';
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Knopf } from '../../fundament';
import { X } from 'lucide-react';

interface TooltipStat {
  label: string;
  value: string | number;
  colSpan?: boolean;
}

interface TooltipDataType {
  title?: string;
  description?: string;
  stats?: TooltipStat[];
}

interface SourceBadgeProps {
  source?: string;
  page?: number;
  tooltipData?: TooltipDataType;
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, page, tooltipData, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const displaySource = (!source || source === 'creation' || source === 'xp' || source === 'Regelwerk' || source === 'Erschaffung')
    ? 'GRW'
    : source;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const calculatePosition = () => {
    if (!badgeRef.current) return;
    const badgeRect = badgeRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current;

    // Use measured dimensions if mounted, otherwise use safe estimates
    const tooltipWidth = tooltip ? tooltip.offsetWidth : 320;
    const tooltipHeight = tooltip ? tooltip.offsetHeight : 280;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const PADDING = 12;

    // Horizontal placement:
    // Try right side first: badge right + 10px
    // If it doesn't fit on the right, try left side: badge left - 10px - tooltipWidth
    const canFitRight = badgeRect.right + 10 + tooltipWidth <= viewportWidth - PADDING;
    const canFitLeft = badgeRect.left - 10 - tooltipWidth >= PADDING;

    let x: number;
    if (canFitRight) {
      x = badgeRect.right + 10;
    } else if (canFitLeft) {
      x = badgeRect.left - 10 - tooltipWidth;
    } else {
      // If neither side fits fully, place aligned with badge left
      x = badgeRect.left;
    }

    // Strict viewport clamp for horizontal coordinate
    const maxX = Math.max(PADDING, viewportWidth - tooltipWidth - PADDING);
    x = Math.max(PADDING, Math.min(x, maxX));

    // Vertical placement:
    // Start aligned with badge top
    let y = badgeRect.top;

    // If bottom of tooltip exceeds the viewport bottom, shift upward
    if (y + tooltipHeight > viewportHeight - PADDING) {
      y = viewportHeight - tooltipHeight - PADDING;
    }

    // Strict viewport clamp for vertical coordinate
    if (y < PADDING) {
      y = PADDING;
    }

    setCoords({ x: Math.round(x), y: Math.round(y) });
  };

  // Recalculate position whenever tooltip opens, using actual DOM measurements
  useLayoutEffect(() => {
    if (isOpen && !isMobile) {
      calculatePosition();
    }
  }, [isOpen, isMobile]);

  // Keep tooltip properly positioned on scroll or window resize while visible
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handleUpdate = () => {
      calculatePosition();
    };
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen, isMobile]);

  const handleMouseEnter = () => {
    if (!isMobile) {
      calculatePosition();
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) setIsOpen(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      setIsOpen(!isOpen);
    } else {
      calculatePosition();
      setIsOpen(true);
    }
  };

  const renderContent = () => (
    <>
      <h4 className="font-bold text-gold-hell text-sm border-b border-gold pb-1 mb-2 fantasy-font pr-6">
        {tooltipData?.title}
      </h4>
      {isMobile && (
        <Knopf nurSymbol
          onClick={() => setIsOpen(false)}
          className="absolute top-2 right-2"
        >
          <X size={16} />
        </Knopf>
      )}
      {tooltipData?.description && (
        <div className="text-xs text-schrift italic mb-2 leading-snug whitespace-pre-line">
          {tooltipData.description}
        </div>
      )}
      {tooltipData?.stats && tooltipData.stats.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 bg-flaeche bg-opacity-50 p-2 rounded-knopf border border-rahmen mb-2">
          {tooltipData.stats.map((s, i) => (
            <div
              key={i}
              className={`text-[11px] flex justify-between border-b border-rahmen last:border-0 pb-0.5 ${s.colSpan ? 'col-span-2' : ''}`}
            >
              <span className="font-bold text-leise mr-2">{s.label}:</span>
              <span className="text-schrift tabular-nums text-right">{s.value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="text-[11px] text-gold font-bold text-right mt-1 uppercase tracking-wider">
        Quelle: {displaySource} {page ? `S. ${page}` : ''}
      </div>
    </>
  );

  return (
    <>
      <div
        ref={badgeRef}
        className={className || "relative inline-block ml-2 align-middle shrink-0"}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <span
          className={`inline-block bg-erhoeht text-leise text-[11px] px-1.5 rounded-knopf tabular-nums border border-rahmen align-middle ${tooltipData ? 'cursor-help hover:bg-gold hover:text-seite hover:border-gold' : ''}`}
        >
          {displaySource} {page ? `S. ${page}` : ''}
        </span>
      </div>
      {isOpen && tooltipData && (
        isMobile ? (
          <Dialoghintergrund className="z-[9999]" onClick={() => setIsOpen(false)}>
            <Dialogfenster breite="sm" className="p-4 relative overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {renderContent()}
            </Dialogfenster>
          </Dialoghintergrund>
        ) : (
          <div
            ref={tooltipRef}
            className="fixed z-[9999] w-80 max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto bg-erhoeht dark-theme-panel border border-gold shadow-2xl rounded-knopf p-3 text-left pointer-events-none"
            style={{ top: coords.y, left: coords.x }}
          >
            {renderContent()}
          </div>
        )
      )}
    </>
  );
};
