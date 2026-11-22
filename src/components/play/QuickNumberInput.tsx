import React, { useState, useEffect, useRef } from 'react';
import { Knopf, Wahlknopf } from '../../fundament';
import { Sparkles, Delete, Check, X } from 'lucide-react';

interface QuickNumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
  inputClassName?: string;
  presets?: number[];
  allowZero?: boolean;
  disabled?: boolean;
}

export const QuickNumberInput: React.FC<QuickNumberInputProps> = ({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
  className = '',
  inputClassName = '',
  presets,
  allowZero = false,
  disabled = false,
}) => {
  const effectiveMin = allowZero ? 0 : min;
  const [localStr, setLocalStr] = useState<string>(value.toString());
  const [isOpen, setIsOpen] = useState(false);
  const [padValue, setPadValue] = useState<string>(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync external value to local string when not focused/open
  useEffect(() => {
    setLocalStr(value.toString());
    setPadValue(value.toString());
  }, [value]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        handleApplyPad();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, padValue]);

  const commitValue = (valStr: string) => {
    let num = parseInt(valStr, 10);
    if (isNaN(num)) {
      num = effectiveMin;
    }
    const clamped = Math.max(effectiveMin, Math.min(max, num));
    setLocalStr(clamped.toString());
    setPadValue(clamped.toString());
    onChange(clamped);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty string while typing so users can delete the '1'
    if (raw === '') {
      setLocalStr('');
      return;
    }
    // Allow digits only
    if (/^\d*$/.test(raw)) {
      setLocalStr(raw);
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) {
        onChange(Math.max(effectiveMin, Math.min(max, parsed)));
      }
    }
  };

  const handleInputBlur = () => {
    commitValue(localStr);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue(localStr);
      inputRef.current?.blur();
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setLocalStr(value.toString());
      inputRef.current?.blur();
      setIsOpen(false);
    }
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Select all text on desktop click
    e.currentTarget.select();
  };

  const handleOpenPad = () => {
    if (disabled) return;
    setPadValue(value.toString());
    setIsOpen(true);
  };

  const handlePadDigit = (digit: string) => {
    if (padValue === '0' || padValue === '') {
      setPadValue(digit);
    } else {
      const next = padValue + digit;
      if (parseInt(next, 10) <= max) {
        setPadValue(next);
      }
    }
  };

  const handlePadBackspace = () => {
    if (padValue.length <= 1) {
      setPadValue(effectiveMin.toString());
    } else {
      setPadValue(padValue.slice(0, -1));
    }
  };

  const handlePadClear = () => {
    setPadValue(effectiveMin.toString());
  };

  const handlePadPreset = (presetVal: number) => {
    const clamped = Math.max(effectiveMin, Math.min(max, presetVal));
    setPadValue(clamped.toString());
    commitValue(clamped.toString());
    setIsOpen(false);
  };

  const handlePadAdjust = (delta: number) => {
    const current = parseInt(padValue, 10) || effectiveMin;
    const next = Math.max(effectiveMin, Math.min(max, current + delta));
    setPadValue(next.toString());
  };

  const handleApplyPad = () => {
    commitValue(padValue);
    setIsOpen(false);
  };

  const defaultPresets = presets || (
    effectiveMin === 0
      ? [0, 1, 2, 3, 4, 5, 6, 8, 10, 15, 20]
      : [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20]
  );

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={localStr}
        disabled={disabled}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        onClick={handleInputClick}
        onDoubleClick={handleOpenPad}
        title={label ? `${label} (Klick zum Auswählen/Tippen, Doppelklick für Ziffernfeld)` : 'Klick zum Auswählen/Tippen'}
        className={`w-10 h-full text-center font-bold text-sm bg-transparent border-0 outline-none select-all cursor-pointer text-schrift dark:text-schrift ${inputClassName}`}
      />

      {/* Touch / Quick-Pad Toggle Icon Button (only visible on mobile or hover) */}
      <Knopf
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        disabled={disabled}
        className="no-print dark:text-gold shrink-0 -ml-1 text-[11px]"
        title="Zahleneingabe-Pop-up öffnen"
      >
        <span className="text-[11px] leading-none">▾</span>
      </Knopf>

      {/* ── Touch / Quick Keypad Modal / Popover ── */}
      {isOpen && (
        <>
          {/* Backdrop for easy mobile tapping */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-50 sm:hidden"
            onClick={handleApplyPad}
          />

          <div
            ref={popoverRef}
            className="fixed sm:absolute sm:top-full sm:left-1/2 sm:-translate-x-1/2 mt-1 z-50 bg-erhoeht border border-gold rounded-karte shadow-2xl p-3.5 w-[280px] max-w-[90vw] text-schrift top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-y-0 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-rahmen">
              <span className="font-bold text-xs fantasy-font text-schrift flex items-center gap-1.5">
                <Sparkles size={13} className="text-gold" />
                {label || 'Zahl auswählen'}
              </span>
              <Knopf nurSymbol
                onClick={() => setIsOpen(false)}
              >
                <X size={14} />
              </Knopf>
            </div>

            {/* Current Value Preview Display */}
            <div className="flex items-center justify-between bg-flaeche border border-gold rounded-karte px-3 py-2 mb-3 ">
              <div className="flex items-center gap-1">
                <Knopf
                  onClick={() => handlePadAdjust(-5)}
                  className="text-[11px] active:scale-95"
                >
                  -5
                </Knopf>
                <Knopf
                  onClick={() => handlePadAdjust(-1)}
                  className="text-xs active:scale-95"
                >
                  -1
                </Knopf>
              </div>

              <span className="font-bold text-2xl text-schrift tabular-nums px-2">
                {padValue || effectiveMin}
              </span>

              <div className="flex items-center gap-1">
                <Knopf
                  onClick={() => handlePadAdjust(1)}
                  className="text-xs active:scale-95"
                >
                  +1
                </Knopf>
                <Knopf
                  onClick={() => handlePadAdjust(5)}
                  className="text-[11px] active:scale-95"
                >
                  +5
                </Knopf>
              </div>
            </div>

            {/* Quick Presets Chips */}
            <div className="mb-3">
              <div className="text-[11px] uppercase font-bold text-leise mb-1 tracking-wider">
                Schnellwahl
              </div>
              <div className="grid grid-cols-6 gap-1">
                {defaultPresets.slice(0, 12).map((num) => (
                  <Wahlknopf gewaehlt={parseInt(padValue, 10) === num} mittig key={num} onClick={() => handlePadPreset(num)} className="text-xs font-bold">
                    {num}
                  </Wahlknopf>
                ))}
              </div>
            </div>

            {/* Numpad Digits Grid */}
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <Knopf
                  key={digit}
                  onClick={() => handlePadDigit(digit.toString())}
                  className="h-9 rounded-knopf bg-flaeche border border-rahmen hover:bg-rahmen active:bg-erhoeht font-bold text-sm text-schrift active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  {digit}
                </Knopf>
              ))}
              <Knopf
                onClick={handlePadClear}
                className="h-9 rounded-knopf bg-seite border border-rahmen hover:bg-rahmen active:bg-erhoeht font-bold text-xs text-schrift active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                title="Löschen"
              >
                C
              </Knopf>
              <Knopf
                onClick={() => handlePadDigit('0')}
                className="h-9 rounded-knopf bg-flaeche border border-rahmen hover:bg-rahmen active:bg-erhoeht font-bold text-sm text-schrift active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              >
                0
              </Knopf>
              <Knopf nurSymbol
                onClick={handlePadBackspace}
                className="h-9 rounded-knopf bg-erhoeht border border-rahmen hover:bg-rahmen active:bg-erhoeht font-bold text-xs text-schrift active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                title="Letzte Ziffer löschen"
              >
                <Delete size={14} />
              </Knopf>
            </div>

            {/* Confirm / Apply Button */}
            <Knopf
              onClick={handleApplyPad}
              className="w-full text-xs gap-1.5 active:scale-[0.99]"
            >
              <Check size={14} className="text-gold" />
              <span>Übernehmen</span>
            </Knopf>
          </div>
        </>
      )}
    </div>
  );
};
