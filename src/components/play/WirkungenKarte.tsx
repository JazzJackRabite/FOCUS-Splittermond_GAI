import React, { useState } from 'react';
import { Knopf } from '../../fundament';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useCharacter } from '../../context/CharacterContext';
import { wirkungKurz, type CharakterWirkung, type WirkungsStatus } from '../../regelwerk/wirkungen';

const GRUPPEN: { status: WirkungsStatus; titel: string; hinweis: string; offen: boolean }[] = [
  { status: 'verrechnet', titel: 'Eingerechnet', hinweis: 'In Fertigkeits- und abgeleiteten Werten enthalten.', offen: true },
  { status: 'dauerhaft', titel: 'Dauerhaft', hinweis: 'Gilt immer. Behinderung, Tick-Zuschlag und Wundabzüge rechnet der Editor teils schon ein; der Rest steht nicht als Zahl auf dem Bogen.', offen: true },
  { status: 'bedingt', titel: 'In bestimmten Lagen', hinweis: 'Nur wenn die Bedingung erfüllt ist – selbst anwenden.', offen: false },
  { status: 'manoever', titel: 'Bei Manövern', hinweis: 'Nur beim Einsatz des Manövers.', offen: false },
];

const Zeile: React.FC<{ cw: CharakterWirkung }> = ({ cw }) => (
  <li className="text-xs text-schrift py-0.5" title={cw.wirkung.beleg}>
    <strong>{cw.quelleName}:</strong> {wirkungKurz(cw.wirkung)}
    {cw.wirkung.bedingung && <span className="text-leise"> – {cw.wirkung.bedingung}</span>}
    {cw.wirkung.gegen_typus && !cw.wirkung.bedingung && <span className="text-leise"> – gegen {cw.wirkung.gegen_typus}</span>}
  </li>
);

/** Wirkungen aus Stärken und Meisterschaften (nur mit Regelpaketen) */
export const WirkungenKarte: React.FC = () => {
  const { calc } = useCharacter();
  const w = calc.wirkungen;
  const [offen, setOffen] = useState<Record<string, boolean>>(() => Object.fromEntries(GRUPPEN.map(g => [g.status, g.offen])));
  if (!w || !w.liste.length) return null;
  return (
    <div className="bg-flaeche rounded-karte border border-rahmen p-5" data-testid="wirkungen">
      <div className="flex items-center gap-2 border-b border-gold pb-2 mb-3">
        <Sparkles size={18} className="text-gold" />
        <h3 className="font-bold text-[17px] fantasy-font text-gold-hell">Wirkungen</h3>
      </div>
      <div className="space-y-2">
        {GRUPPEN.map(g => {
          const liste = w.liste.filter(x => x.status === g.status);
          if (!liste.length) return null;
          return (
            <div key={g.status}>
              <Knopf onClick={() => setOffen(o => ({ ...o, [g.status]: !o[g.status] }))} aria-expanded={!!offen[g.status]}
                className="gap-1 text-sm">
                {offen[g.status] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{g.titel} ({liste.length})
              </Knopf>
              {offen[g.status] && (
                <>
                  <p className="text-[11px] text-leise ml-5">{g.hinweis}</p>
                  <ul className="ml-5">{liste.map((cw, i) => <Zeile key={`${cw.quelle}-${i}`} cw={cw} />)}</ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
