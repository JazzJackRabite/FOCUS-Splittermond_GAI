import React, { useMemo } from 'react';
import { Plus, Minus } from 'lucide-react';
import { allgemeineFertigkeiten, golemMeisterschaften, meisterschaftBraucht, type GolemWahl } from '../../regelwerk/golem';
import type { Katalog } from '../../regelwerk/katalog';
import type { Begleiter } from '../../types';
import { Auswahl, Knopf, Marke } from '../../fundament';

/** Bedienbare Wahlen des Feinschliffs (Attribut, Meisterschaft, Fertigkeit, Punkte verteilen) – Golem und Wesen-Baukasten */
export const Feinschliff: React.FC<{ k: Katalog; b: Begleiter; wahlen: GolemWahl[]; fertigkeiten: { id?: string; name: string; wert: number }[]; aendern: (a: Partial<Begleiter>) => void }> = ({ k, b, wahlen, fertigkeiten, aendern }) => {
  const fs = b.feinschliff ?? {};
  const setze = (schluessel: string, v: string | Record<string, number> | undefined) => {
    const neu = { ...fs }; if (v === undefined || v === '') delete neu[schluessel]; else neu[schluessel] = v;
    aendern({ feinschliff: Object.keys(neu).length ? neu : undefined });
  };
  const allgemein = useMemo(() => allgemeineFertigkeiten(k), [k]);
  return (
    <div className="space-y-3">
      {wahlen.map(w => {
        const v = fs[w.schluessel];
        const label = `${w.quelle}: ${w.text}`;
        if (w.art === 'attribut') return (
          <Auswahl key={w.schluessel} beschriftung={label} value={typeof v === 'string' ? v : ''} onChange={ev => setze(w.schluessel, ev.target.value)}>
            <option value="">Attribut wählen …</option>
            {w.optionen.map(a => <option key={a} value={a}>{a} +{w.bonus}</option>)}
          </Auswahl>
        );
        if (w.art === 'meisterschaft') {
          const angebot = golemMeisterschaften(k, fertigkeiten, w.schwelle);
          return (
            <Auswahl key={w.schluessel} beschriftung={`${w.quelle}: freie Meisterschaft bis Schwelle ${w.schwelle}`} value={typeof v === 'string' ? v : ''} onChange={ev => setze(w.schluessel, ev.target.value)}>
              <option value="">Meisterschaft wählen …</option>
              {[...new Set(angebot.map(m => m.fertigkeit))].map(f => (
                <optgroup key={f} label={f}>{angebot.filter(m => m.fertigkeit === f).map(m => {
                  // Voraussetzung „hat Meisterschaft X“ aus dem Paket: X muss im Feinschliff schon gewählt sein
                  const braucht = meisterschaftBraucht(k, m.id);
                  const gewaehlt = new Set(Object.entries(fs).filter(([s2]) => s2 !== w.schluessel).map(([, x]) => x).filter((x): x is string => typeof x === 'string'));
                  const fehlt = !!braucht && !gewaehlt.has(braucht.id);
                  return <option key={m.id} value={m.id} disabled={fehlt}>{m.name} (S{m.schwelle}){fehlt ? ` – setzt ${braucht!.text} voraus` : ''}</option>;
                })}</optgroup>
              ))}
            </Auswahl>
          );
        }
        if (w.art === 'fertigkeit') return (
          <Auswahl key={w.schluessel} beschriftung={label} value={typeof v === 'string' ? v : ''} onChange={ev => setze(w.schluessel, ev.target.value)}>
            <option value="">Fertigkeit wählen …</option>
            {allgemein.map(e => { const hat = fertigkeiten.some(f => f.id === e.id); return <option key={e.id} value={e.id}>{e.name} ({hat ? `+${w.plus}` : `auf ${w.neu}`})</option>; })}
          </Auswahl>
        );
        // Punkte verteilen
        const verteilt = typeof v === 'object' ? v : {};
        const summe = Object.values(verteilt).reduce((s, x) => s + x, 0);
        return (
          <div key={w.schluessel} className="space-y-2">
            <p><span className="text-leise">{w.quelle}:</span> {w.text} – verteilt <Marke klein ton={summe > w.anzahl ? 'schaden' : summe === w.anzahl ? 'unverletzt' : 'neutral'}>{summe}/{w.anzahl}</Marke></p>
            <div className="grid sm:grid-cols-2 gap-2">
              {fertigkeiten.filter(f => f.id).map(f => {
                const n = verteilt[f.id!] ?? 0;
                const neu = (x: number) => { const o = { ...verteilt, [f.id!]: Math.max(0, x) }; if (!o[f.id!]) delete o[f.id!]; setze(w.schluessel, Object.keys(o).length ? o : undefined); };
                return (
                  <div key={f.id} className="flex items-center gap-2">
                    <span className="min-w-[8rem]">{f.name}</span>
                    <Knopf nurSymbol aria-label={`${f.name} weniger Punkte`} disabled={n <= 0} onClick={() => neu(n - 1)}><Minus size={16} aria-hidden /></Knopf>
                    <span className="w-8 text-center font-titel">+{n}</span>
                    <Knopf nurSymbol aria-label={`${f.name} mehr Punkte`} disabled={n >= w.max || summe >= w.anzahl} onClick={() => neu(n + 1)}><Plus size={16} aria-hidden /></Knopf>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
