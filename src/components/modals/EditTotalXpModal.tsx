import { Dialogfenster, Dialoghintergrund, Dialogkopf, useEscape } from '../../fundament';
import React, { useId, useState } from 'react';
import { Knopf, Dialog } from '../../fundament';
import { Edit3, Plus, Minus, ArrowRight, Info, AlertTriangle } from 'lucide-react';

interface EditTotalXpModalProps {
  currentXpTotal: number;
  xpSpent: number;
  onClose: () => void;
  onSave: (newTotal: number, comment?: string) => void;
}

export const EditTotalXpModal: React.FC<EditTotalXpModalProps> = ({
  currentXpTotal,
  xpSpent,
  onClose,
  onSave,
}) => {
  const [newTotal, setNewTotal] = useState<number>(currentXpTotal);
  const [comment, setComment] = useState('');

  const delta = newTotal - currentXpTotal;
  const availableAfter = newTotal - xpSpent;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isNaN(newTotal) || newTotal < 0) return;
    onSave(newTotal, comment.trim() || undefined);
    onClose();
  };

  const adjustBy = (amount: number) => {
    setNewTotal((prev) => Math.max(0, prev + amount));
  };

  const titelId = useId();
  useEscape(onClose);
  return (
    <Dialoghintergrund>
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId}
        id="edit-total-xp-modal-dialog" breite="lg"
      >
        <Dialogkopf titelId={titelId} symbol={<Edit3 className="w-5 h-5" />} titel="Gesamt-EP editieren" onSchliessen={onClose} />

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar modal-body-scroll">
            {/* Current vs New comparison header */}
            <div className="grid grid-cols-2 gap-3 bg-erhoeht p-3 rounded-knopf border border-rahmen text-xs">
              <div>
                <span className="text-leise font-medium block">Bisherige Gesamt-EP:</span>
                <span className="text-base font-bold text-schrift">{currentXpTotal} EP</span>
              </div>
              <div>
                <span className="text-leise font-medium block">Bereits ausgegeben:</span>
                <span className="text-base font-bold text-erschoepft">{xpSpent} EP</span>
              </div>
            </div>

          {/* New Total XP Input & Stepper */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-schrift uppercase tracking-wide">
              Neue Gesamt-EP festlegen
            </label>
            <div className="flex items-center justify-center gap-2">
              <Knopf
                onClick={() => adjustBy(-10)}
                className="px-2.5 py-1.5 rounded-knopf bg-flaeche hover:bg-rahmen border border-rahmen text-xs font-bold text-schrift transition cursor-pointer"
                title="-10 EP"
              >
                -10
              </Knopf>
              <Knopf nurSymbol
                onClick={() => adjustBy(-1)}
                className="p-1.5 rounded-knopf bg-flaeche hover:bg-rahmen border border-rahmen text-schrift transition cursor-pointer"
                title="-1 EP"
              >
                <Minus size={16} />
              </Knopf>
              <input
                type="number"
                min={0}
                value={isNaN(newTotal) ? '' : newTotal}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNewTotal(isNaN(val) ? 0 : Math.max(0, val));
                }}
                className="w-28 text-center text-2xl font-bold bg-flaeche text-schrift border border-gold rounded-knopf py-1 focus:outline-none focus:ring-2 focus:ring-rahmen"
                autoFocus
              />
              <Knopf nurSymbol
                onClick={() => adjustBy(1)}
                className="p-1.5 rounded-knopf bg-flaeche hover:bg-rahmen border border-rahmen text-schrift transition cursor-pointer"
                title="+1 EP"
              >
                <Plus size={16} />
              </Knopf>
              <Knopf
                onClick={() => adjustBy(10)}
                className="px-2.5 py-1.5 rounded-knopf bg-flaeche hover:bg-rahmen border border-rahmen text-xs font-bold text-schrift transition cursor-pointer"
                title="+10 EP"
              >
                +10
              </Knopf>
            </div>
          </div>

          {/* Impact preview */}
          <div className="p-3 bg-flaeche rounded-knopf border border-rahmen space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-leise">Differenz zur bisherigen Gesamt-EP:</span>
              <span
                className={`font-bold text-sm px-2 py-0.5 rounded-knopf border ${
                  delta > 0
                    ? 'bg-unverletzt-grund text-unverletzt border-unverletzt'
                    : delta < 0
                    ? 'bg-rahmen text-schrift border-rahmen'
                    : 'bg-seite text-schrift border-rahmen'
                }`}
              >
                {delta > 0 ? `+${delta}` : delta} EP
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-rahmen">
              <span className="text-leise">Verfügbare EP nach Korrektur:</span>
              <span
                className={`font-bold tabular-nums ${
                  availableAfter < 0 ? 'text-schrift' : 'text-unverletzt'
                }`}
              >
                {availableAfter} EP
              </span>
            </div>

            {availableAfter < 0 && (
              <div className="flex items-start gap-1.5 mt-2 p-2 bg-erhoeht rounded-knopf border border-gold text-schrift text-[11px] font-semibold">
                <AlertTriangle size={14} className="shrink-0 text-gold mt-0.5" />
                <span>
                  Achtung: Die neue Gesamt-EP liegt unter den bisher ausgegebenen EP ({xpSpent} EP). Verfügbar sind rechnerisch {availableAfter} EP.
                </span>
              </div>
            )}
          </div>

          {/* Comment / Reason field */}
          <div>
            <label className="block text-xs font-bold text-schrift mb-1 uppercase tracking-wide">
              Kommentar / Begründung (wird im Protokoll angezeigt)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="z. B. Spielleiter-Korrektur, Rechenfehler behoben, Kampagnen-Bonus..."
              rows={2}
              className="w-full bg-flaeche border border-rahmen rounded-knopf p-2.5 text-sm text-schrift placeholder-leise focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          {/* Notice */}
          <div className="flex items-start gap-2 text-xs text-leise bg-erhoeht p-2.5 rounded-knopf border border-rahmen">
            <Info size={15} className="shrink-0 text-gold mt-0.5" />
            <span>
              Diese Korrektur wird mit Zeitstempel, der Differenz von <strong>{delta > 0 ? `+${delta}` : delta} EP</strong> und deinem Kommentar im Steigerungsprotokoll festgehalten.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-3.5 border-t border-rahmen bg-black/5 flex justify-end space-x-2 shrink-0">
          <Knopf
            onClick={onClose}
            className="text-sm"
          >
            Abbrechen
          </Knopf>
          <Knopf art="primaer"
            type="submit"
            disabled={isNaN(newTotal) || newTotal < 0}
            className="text-sm gap-1.5"
          >
            <span>Korrektur speichern</span>
            <ArrowRight size={15} />
          </Knopf>
        </div>
      </form>
    </Dialogfenster>
  </Dialoghintergrund>
  );
};
