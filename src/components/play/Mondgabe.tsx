/**
 * Gabe des Mondzeichens im Würfeldialog (Splittergabe „Mondzeichen“, ein Splitterpunkt).
 * Art und Werte kommen aus dem Paket (`gabe_strukturiert`); Würfelgaben werden angewandt, die übrigen als Hinweis gezeigt.
 */
import React, { useContext } from 'react';
import { Moon } from 'lucide-react';
import { Knopf } from '../../fundament';
import { CharacterContext } from '../../context/CharacterContext';
import { mondgabe } from '../../regelwerk/grwListen';
import { gabeRisikoNeuwurf, gabeSicherheitBeide, type WurfArt, type WurfErgebnis } from '../../utils/wuerfeln';

export interface MondgabeProps {
  art: WurfArt;
  ergebnis: WurfErgebnis | null;
  /** Wundabzug der Probe (negativ oder 0) */
  wundabzug?: number;
  splitterpunkte: number;
  genutzt: boolean;
  onEinsatz: (grund: string, aenderung: { ergebnis?: WurfErgebnis; bonus?: number }) => void;
}

/** Was die Gabe bei diesem Wurf bewirken würde; null = gerade nicht anwendbar oder keine Würfelgabe */
export function mondgabeWirkung(art: string, wurfArt: WurfArt, w: WurfErgebnis | null, wundabzug: number, hoechstens?: number):
  { text: string; ergebnis?: WurfErgebnis; bonus?: number } | null {
  if (!w) return null;
  if (art === 'sicherheit_beide_addieren' && hoechstens !== undefined) {
    const n = gabeSicherheitBeide(wurfArt, w, hoechstens);
    return n ? { text: `beide Würfel addieren (${w.result} → ${n.result})`, ergebnis: n } : null;
  }
  if (art === 'risiko_zweitniedrigster_neu') {
    const n = gabeRisikoNeuwurf(wurfArt, w);
    return n ? { text: 'zweitniedrigsten Würfel neu werfen', ergebnis: n } : null;
  }
  if (art === 'wundabzug_als_bonus' && wundabzug < 0) {
    return { text: `Wundabzug ${wundabzug} als Bonus +${-wundabzug}`, bonus: -2 * wundabzug };
  }
  return null;
}

const WUERFELGABEN = new Set(['sicherheit_beide_addieren', 'risiko_zweitniedrigster_neu', 'wundabzug_als_bonus']);

export const Mondgabe: React.FC<MondgabeProps> = ({ art, ergebnis, wundabzug = 0, splitterpunkte, genutzt, onEinsatz }) => {
  const ctx = useContext(CharacterContext);
  const g = mondgabe(ctx?.state?.moonSign);
  if (!g) return null;
  if (!WUERFELGABEN.has(g.art)) {
    return (
      <p className="text-xs text-leise mt-2" title={g.text} data-testid="mondgabe-hinweis">
        <Moon size={12} className="inline mr-1" />Mondzeichen {g.name} ({g.kosten} SP): {g.text}
      </p>
    );
  }
  const w = mondgabeWirkung(g.art, art, ergebnis, wundabzug, g.hoechsterHoechstens);
  return (
    <Knopf data-testid="mondgabe" className="flex-1 text-xs font-bold" title={g.text}
      disabled={genutzt || !w || splitterpunkte < g.kosten}
      onClick={() => w && onEinsatz(`Mondzeichen ${g.name}: ${w.text}`, { ergebnis: w.ergebnis, bonus: w.bonus })}>
      <Moon size={14} />
      <span>{genutzt ? `✓ ${g.name}` : `${g.name}: ${w ? w.text : 'hier nicht anwendbar'} (${g.kosten} SP)`}</span>
    </Knopf>
  );
};
