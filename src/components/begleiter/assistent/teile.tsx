/** Gemeinsame Teile der Assistenten-Schritte: Erklärtext, Zwischentitel, Wahlkarte, Übersicht. */
import React from 'react';
import { Check } from 'lucide-react';
import { Abschnittstitel, Marke, Wahlknopf } from '../../../fundament';
import { Werte, Hinweise } from '../Wertekasten';
import { artInfo, begleiterAnsicht } from '../ansicht';
import type { Schritt, SchrittProps } from './typen';

export const Erklaerung: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-sm text-leise">{children}</p>;

export const Titel3: React.FC<{ children: React.ReactNode }> = ({ children }) => <Abschnittstitel als="h3" className="text-[15px]">{children}</Abschnittstitel>;

/** Große Wahlfläche (Art des Begleiters, Herkunft eines Tiers): Knopf mit Titel, Text und Häkchen, wenn gewählt */
export const Wahlkarte: React.FC<{
  gewaehlt: boolean; onClick: () => void; titel: string; text?: React.ReactNode; symbol?: React.ReactNode; disabled?: boolean; hinweis?: string;
}> = ({ gewaehlt, onClick, titel, text, symbol, disabled, hinweis }) => (
  <Wahlknopf gewaehlt={gewaehlt} onClick={onClick} disabled={disabled} className="w-full">
    <span className="flex items-start gap-3 w-full">
    {symbol && <span className="text-gold shrink-0 mt-0.5" aria-hidden>{symbol}</span>}
    <span className="min-w-0 flex-1 space-y-1">
      <span className="flex items-center gap-2 font-bold text-schrift text-[15px]">{titel}{gewaehlt && <Check size={16} className="text-gold" aria-hidden />}</span>
      {text && <span className="block text-sm text-leise">{text}</span>}
      {hinweis && <span className="block text-xs text-leise italic">{hinweis}</span>}
    </span>
    </span>
  </Wahlknopf>
);

/** Letzter Schritt jeder Art: Werte, Kurzangaben und offene Hinweise vor dem Erstellen */
const UebersichtInhalt: React.FC<SchrittProps> = ({ k, b, besitzer }) => {
  const a = begleiterAnsicht(k, b, besitzer);
  return (
    <div className="space-y-4" data-testid="assistent-uebersicht">
      <div className="space-y-1.5">
        <div className="font-titel font-bold text-lg text-schrift">{a.titel}</div>
        <div className="flex gap-2 flex-wrap text-xs">
          <Marke klein ton="gold">{artInfo(b.art).name}</Marke>
          {a.kurz.map((x, i) => <Marke key={i} klein ton={x.ton}>{x.text}</Marke>)}
        </div>
      </div>
      {a.w ? <Werte w={a.w} /> : <p className="text-sm text-leise m-0">Keine Werte in den Paketen{a.fehlt ? ' (Grimoire nicht geladen?)' : ''}.</p>}
      {a.hinweise.length > 0 ? (
        <div className="space-y-1.5"><Titel3>Noch offen</Titel3><Hinweise liste={a.hinweise} /></div>
      ) : <p className="text-sm m-0">Alles gewählt. Lebenspunkte, Fokus und Zustände führst du danach auf dem Blatt des Begleiters.</p>}
    </div>
  );
};
export const UEBERSICHT: Schritt = { id: 'uebersicht', titel: 'Übersicht', inhalt: UebersichtInhalt };
