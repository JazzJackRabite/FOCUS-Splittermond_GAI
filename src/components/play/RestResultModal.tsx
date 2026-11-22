import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf } from '../../fundament';
import React, { useEffect, useId } from 'react';
import { X, Sun, Moon, Heart, Sparkles, Zap, ShieldCheck, CheckCircle2 } from 'lucide-react';

export interface RestDetailItem {
  label: string;
  value: string;
  type?: 'hp' | 'fo' | 'exhaust' | 'condition' | 'info';
}

export interface RestResultModalData {
  restType: 'verschnaufpause' | 'ruhephase';
  title: string;
  durationText: string;
  summary: string;
  details: RestDetailItem[];
}

interface RestResultModalProps {
  data: RestResultModalData;
  onClose: () => void;
}

export const RestResultModal: React.FC<RestResultModalProps> = ({ data, onClose }) => {
  // Handle ESC / Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isVp = data.restType === 'verschnaufpause';

  const titelId = useId();
  return (
    <Dialoghintergrund
      id="rest-result-modal-backdrop" className="animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId}
        id="rest-result-modal-card" breite="md"
      >
        {/* Header Banner */}
        <Dialogkopf
          titelId={titelId}
          symbol={isVp ? <Sun size={22} /> : <Moon size={22} />}
          titel={data.title}
          untertitel={data.durationText}
          onSchliessen={onClose}
        />

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scroll modal-body-scroll flex-1">
          {/* Main Success Note */}
          <div className="flex items-start gap-2.5 p-3 rounded-karte bg-flaeche border border-rahmen ">
            <CheckCircle2 size={20} className={isVp ? 'text-gold shrink-0 mt-0.5' : 'text-schrift shrink-0 mt-0.5'} />
            <div className="text-xs text-schrift leading-relaxed font-medium">
              {data.summary}
            </div>
          </div>

          {/* Regenerated Points Details */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-leise mb-2 flex items-center gap-1.5">
              <Sparkles size={13} className="text-gold" />
              Regenerierte Werte &amp; Effekte
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {data.details.map((item, idx) => {
                let icon = <CheckCircle2 size={16} className="text-leise" />;
                let badgeClass = 'bg-erhoeht text-schrift border-rahmen';

                if (item.type === 'hp') {
                  icon = <Heart size={16} className="text-schaden" />;
                  badgeClass = 'bg-schaden-grund text-schrift border-magie font-bold';
                } else if (item.type === 'fo') {
                  icon = <Sparkles size={16} className="text-schrift" />;
                  badgeClass = 'bg-flaeche text-schrift border-rahmen font-bold';
                } else if (item.type === 'exhaust') {
                  icon = <Zap size={16} className="text-gold" />;
                  badgeClass = 'bg-erhoeht text-erschoepft border-rahmen font-bold';
                } else if (item.type === 'condition') {
                  icon = <ShieldCheck size={16} className="text-schrift" />;
                  badgeClass = 'bg-flaeche text-schrift border-rahmen font-bold';
                }

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-knopf bg-flaeche border border-rahmen text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-schrift font-medium">{item.label}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-knopf text-xs border ${badgeClass}`}>
                      {item.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-erhoeht border-t border-rahmen flex justify-end">
          <Knopf
            id="confirm-rest-result-modal-btn"
            onClick={onClose}
            className="w-full sm:w-auto text-sm active:scale-98 gap-2"
          >
            Verstanden
          </Knopf>
        </div>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};
