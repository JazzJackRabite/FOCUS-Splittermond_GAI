import React from 'react';
import { Swords, X } from 'lucide-react';
import type { Wertekasten } from '../../regelwerk/begleiter';
import type { Aktionen } from './BegleiterSpiel';
import DiceIcon from '../ui/DiceIcon';
import { Knopf, Marke } from '../../fundament';
import type { StatusCondition } from '../../types';
import { textMitZustaenden, zustandsErklaerung, zustandswerte, type Wertname } from '../../regelwerk/zustandswerte';

const ATTR = ['AUS', 'BEW', 'INT', 'KON', 'MYS', 'STÄ', 'VER', 'WIL'];
const ABGL = ['GK', 'GSW', 'LP', 'FO', 'VTD', 'SR', 'KW', 'GW'];

/** Kommas außerhalb von Klammern trennen */
function teile(s: string): string[] {
  const out: string[] = []; let tiefe = 0; let akt = '';
  for (const c of s) {
    if (c === '(') tiefe++; if (c === ')') tiefe--;
    if (c === ',' && tiefe === 0) { out.push(akt); akt = ''; } else akt += c;
  }
  out.push(akt);
  return out.map(x => x.trim()).filter(Boolean);
}

/** „Akrobatik 8, Athletik 10“ → [{name, wert}]; Einträge ohne Zahl bleiben Text */
export function fertigkeitenAusText(t: string): { name: string; wert: number | null; text: string }[] {
  return teile(t).map(x => {
    const m = x.match(/^(.+?)\s+(\d+)(?:\s*\(.*\))?$/);
    return m ? { name: m[1], wert: Number(m[2]), text: x } : { name: x, wert: null, text: x };
  });
}

/** Würfelknopf (Baustein Knopf, neutral) mit Würfel- bzw. Schwertsymbol */
export const WuerfelKnopf: React.FC<{ onClick: () => void; label: string; symbol?: 'wuerfel' | 'schwert' | 'magie'; children: React.ReactNode }> = ({ onClick, label, symbol = 'wuerfel', children }) => (
  <Knopf className="px-3" onClick={onClick} aria-label={label}>
    {symbol === 'schwert' ? <Swords size={14} aria-hidden /> : <DiceIcon size={14} />}
    {children}
  </Knopf>
);

const ZUSTANDSWERTE: string[] = ['GSW', 'VTD', 'SR', 'KW', 'GW', 'INI'];

/** Angezeigter Wert mit eingerechneten Zuständen; Grundwert und Erklärung beim Überfahren mit der Maus */
export const ZWert: React.FC<{ name: string; text: string | number | undefined; zw: ReturnType<typeof zustandswerte> | null; testid?: string }> = ({ name, text, zw, testid }) => {
  if (!zw || !ZUSTANDSWERTE.includes(name)) return <>{text ?? '–'}</>;
  const r = textMitZustaenden(name as Wertname, text, zw);
  if (!r.geaendert) return <>{text ?? '–'}</>;
  return (
    <span title={[`Grundwert ${r.basis}`, zustandsErklaerung(name as Wertname, zw)].join('\n')} data-testid={testid}>
      {r.text}<span className="text-[11px] text-schaden font-bold ml-1 tabular-nums" aria-label={`Grundwert ${r.basis}`}>({r.basis})</span>
    </span>
  );
};

/**
 * Wertekasten eines Begleiters; mit `aktionen` sind Fertigkeiten, Angriffe und Schaden Würfelknöpfe.
 * Mit `zustaende` sind deren Wirkungen (Paketeintrag, `daten.zustandswirkung.werte`) in GSW, VTD, SR, KW, GW
 * und die Initiative der Waffen eingerechnet; der Grundwert steht in Klammern daneben.
 */
export const Werte: React.FC<{ w: Wertekasten; aktionen?: Aktionen; zustaende?: StatusCondition[] }> = ({ w, aktionen, zustaende }) => {
  const zw = zustaende?.length ? zustandswerte(zustaende) : null;
  return (
  <div className="text-sm space-y-3 text-schrift">
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center">
      {ATTR.map(a => <div key={a}><div className="font-bold text-xs text-leise">{a}</div><div className="font-titel text-base">{w.attribute?.[a] ?? '–'}</div></div>)}
    </div>
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center">
      {ABGL.map(a => <div key={a}><div className="font-bold text-xs text-leise">{a}</div><div className="font-titel text-base"><ZWert name={a} text={w.abgeleitete_werte?.[a]} zw={zw} testid={`zustand-wert-${a}`} /></div></div>)}
    </div>
    {(w.waffen ?? []).length > 0 && (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-1">
          <thead><tr className="text-xs text-leise">{['Waffe', 'Wert', 'Schaden', 'WGS', 'INI', 'Merkmale'].map(t => <th key={t} className="pr-2 font-bold whitespace-nowrap">{t}</th>)}</tr></thead>
          <tbody>{w.waffen!.map((x, i) => (
            <tr key={i}>
              <td className="pr-2 whitespace-nowrap">{x.name}</td>
              <td className="pr-2">{aktionen ? <WuerfelKnopf symbol="schwert" onClick={() => aktionen.angriff(x)} label={`Angriff ${x.name} würfeln`}>{x.wert}</WuerfelKnopf> : x.wert}</td>
              <td className="pr-2">{aktionen ? <WuerfelKnopf onClick={() => aktionen.schaden(x)} label={`Schaden ${x.name} würfeln`}>{x.schaden}</WuerfelKnopf> : x.schaden}</td>
              <td className="pr-2">{x.wgs}</td><td className="pr-2 whitespace-nowrap"><ZWert name="INI" text={x.ini} zw={zw} testid="zustand-wert-INI" /></td><td>{x.merkmale}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    )}
    {w.felder?.typus && <div><span className="text-leise">Typus:</span> {w.felder.typus}</div>}
    {w.felder?.fertigkeiten && (
      aktionen ? (
        <div className="flex flex-wrap gap-2 items-center"><span className="text-leise mr-1">Fertigkeiten:</span>
          {fertigkeitenAusText(w.felder.fertigkeiten).map((f, i) => f.wert !== null ? (
            <WuerfelKnopf key={i} onClick={() => aktionen.probe(f.name, f.wert!)} label={`Probe ${f.name} würfeln`}>{f.name} {f.wert}</WuerfelKnopf>
          ) : <span key={i}>{f.text}</span>)}
        </div>
      ) : <div><span className="text-leise">Fertigkeiten:</span> {w.felder.fertigkeiten}</div>
    )}
    {w.felder?.meisterschaften && <div><span className="text-leise">Meisterschaften:</span> {w.felder.meisterschaften}</div>}
    {w.felder?.merkmale && <div><span className="text-leise">Merkmale:</span> {w.felder.merkmale}</div>}
    {w.berechnet && <div className="text-leise italic">Werte berechnet aus „Werte wie … mit folgenden Änderungen“.</div>}
  </div>
  );
};

/** Hinweisliste (Regelverstöße, offene Wahlen): Rahmen in der Bedeutungsfarbe, Text in Schrift */
export const Hinweise: React.FC<{ liste: string[] }> = ({ liste }) => liste.length ? (
  <ul className="list-disc pl-6 py-2 pr-3 border border-erschoepft bg-erschoepft-grund rounded-knopf text-schrift">
    {liste.map((h, i) => <li key={i}>{h}</li>)}
  </ul>
) : null;

/** Notizfeld eines Begleiters */
export const Notiz: React.FC<{ b: { notiz?: string }; aendern: (a: { notiz?: string }) => void }> = ({ b, aendern }) => {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-leise">Notiz</label>
      <textarea id={id} value={b.notiz ?? ''} onChange={ev => aendern({ notiz: ev.target.value || undefined })} rows={2}
        className="w-full bg-erhoeht border border-rahmen rounded-knopf px-3 py-2 text-sm text-schrift font-text" />
    </div>
  );
};

/** Marke mit eigenem Entfernen-Knopf daneben (Knopf in voller Größe, FUNDAMENT Teil 3, Regel 4) */
export const MarkeMitEntfernen: React.FC<{ ton?: import('../../fundament').Ton; titel?: string; label: string; onEntfernen: () => void; children: React.ReactNode }> = ({ ton, titel, label, onEntfernen, children }) => (
  <span className="inline-flex items-center gap-1">
    <Marke ton={ton} title={titel}>{children}</Marke>
    <Knopf nurSymbol aria-label={label} onClick={onEntfernen}><X size={16} aria-hidden /></Knopf>
  </span>
);
