import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, Wahlknopf, useEscape } from '../../fundament';
import React, { useId, useState } from 'react';
import { Plus, Minus, Sparkles } from 'lucide-react';

interface XpAddModalProps {
  onClose: () => void;
  onAdd: (val: number, note?: string) => void;
}

export const XpAddModal: React.FC<XpAddModalProps> = ({ onClose, onAdd }) => {
  const [val, setVal] = useState(15);
  const [note, setNote] = useState('');

  const quickAmounts = [5, 10, 15, 20, 30, 50];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (val <= 0) return;
    onAdd(val, note.trim() || undefined);
    onClose();
  };

  const titelId = useId();
  useEscape(onClose);
  return (
    <Dialoghintergrund>
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId}
        id="xp-add-modal-dialog" breite="md"
      >
        <Dialogkopf titelId={titelId} symbol={<Sparkles className="w-5 h-5" />} titel="Erfahrungspunkte (EP) hinzufügen" onSchliessen={onClose} />

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar modal-body-scroll">
            {/* Quick buttons */}
            <div>
              <label className="block text-xs font-bold text-leise mb-1.5 uppercase tracking-wide">
                Schnellauswahl
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {quickAmounts.map((amt) => (
                  <Wahlknopf gewaehlt={val === amt} mittig key={amt} onClick={() => setVal(amt)} className="text-xs font-bold">
                    +{amt}
                  </Wahlknopf>
                ))}
              </div>
            </div>

            {/* Stepper Input */}
            <div className="flex flex-col items-center justify-center pt-2">
              <label className="text-xs font-bold text-leise mb-2 uppercase tracking-wide">
                EP-Menge
              </label>
              <div className="flex items-center justify-center space-x-3">
                <Knopf nurSymbol
                  onClick={() => setVal(Math.max(1, val - 1))}
                  className="w-10 h-10 rounded-knopf bg-erhoeht hover:bg-rahmen active:scale-95 font-bold flex items-center justify-center text-schrift border border-rahmen touch-manipulation cursor-pointer transition-all"
                >
                  <Minus size={18} />
                </Knopf>
                <input
                  type="number"
                  min="1"
                  value={val || ''}
                  onChange={(e) => setVal(parseInt(e.target.value, 10) || 0)}
                  className="w-24 text-center text-2xl font-bold bg-flaeche border border-gold rounded-knopf p-2 text-schrift focus:outline-none focus:ring-2 focus:ring-gold"
                  autoFocus
                />
                <Knopf nurSymbol
                  onClick={() => setVal(val + 1)}
                  className="w-10 h-10 rounded-knopf bg-erhoeht hover:bg-rahmen active:scale-95 font-bold flex items-center justify-center text-schrift border border-rahmen touch-manipulation cursor-pointer transition-all"
                >
                  <Plus size={18} />
                </Knopf>
              </div>
            </div>

            {/* Note Input */}
            <div>
              <label className="block text-xs font-bold text-leise mb-1 uppercase tracking-wide">
                Grund / Abenteuer-Notiz (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z. B. Abenteuer 1, Spielleiter-Bonus, Meilenstein"
                className="w-full bg-flaeche border border-rahmen rounded-knopf p-2 text-sm text-schrift focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-rahmen">
            <Knopf
              onClick={onClose}
              className="text-sm"
            >
              Abbrechen
            </Knopf>
            <Knopf art="primaer"
              type="submit"
              disabled={val <= 0}
              className="text-sm"
            >
              +{val} EP Hinzufügen
            </Knopf>
          </div>
        </form>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};
