import { Auswahl, Wahlknopf } from '../../fundament';
import React, { useContext, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { CharacterContext } from '../../context/CharacterContext';
import { aktiverKatalog } from '../../regelwerk/bruecke';
import { bausteineAktiv, reliktSchwerpunktBoni } from '../../regelwerk/relikte';
import { schwerpunktBonusJe } from '../../regelwerk/grwListen';
import { situativeBoni, zauberAnpassungen, zauberTypen, type KostenDelta, type SituativerBonus, type WurfArtKontext, type ZauberAnpassung } from '../../regelwerk/wirkungen';

/**
 * Bedingte Wirkungen aus Stärken, Meisterschaften und Relikten (Schwerpunkt) für einen Wurf: zum Anklicken, wenn die Lage zutrifft.
 * Ohne Regelpakete oder ohne passende Wirkungen liefert der Hook eine leere Liste.
 */
/** aus: keine Wirkungen des Helden (etwa wenn ein Begleiter würfelt) */
export function useSituativeBoni(art: WurfArtKontext, fertigkeit: string, aus = false) {
  const heldCtx = useContext(CharacterContext);
  const ctx = aus ? null : heldCtx;
  const liste = ctx?.calc?.wirkungen?.liste;
  const attribute = ctx?.calc?.currentAttributes;
  const relikte = ctx?.state?.relikte;
  const inventar = ctx?.state?.inventory;
  const masteries = ctx?.state?.masteries;
  const boni = useMemo(() => {
    const k = aktiverKatalog();
    const aus = k && liste ? situativeBoni(k, liste, art, fertigkeit, attribute) : [];
    // Schwerpunkt-Boni aus Relikten (Verbesserung der Gegenstandsqualität) für Proben, Angriffe und Zauberproben
    // (Magieschulen haben Schwerpunkte wie andere Fertigkeiten; der Bonus erscheint, wenn die Schule im Schwerpunkt steht)
    const rel = k && relikte?.length ? reliktSchwerpunktBoni(relikte, inventar ?? [], bausteineAktiv(k), fertigkeit) : [];
    // Schwerpunkt-Meisterschaften der Fertigkeit: Bonus je Schwerpunkt aus dem Paket, mehrfach erworbene addieren sich
    const je = schwerpunktBonusJe(k);
    const sp: SituativerBonus[] = [];
    if (je !== null) {
      const zaehl = new Map<string, number>();
      for (const m of masteries?.[fertigkeit] ?? []) {
        const n = /^Schwerpunkt\b/i.test(m.name) ? m.name.replace(/^Schwerpunkt:?\s*/i, '').replace(/\s*\(S\d\)\s*$/, '').trim() : '';
        if (n) zaehl.set(n, (zaehl.get(n) ?? 0) + 1);
      }
      for (const [n, anz] of zaehl) sp.push({ id: `schwerpunkt:${fertigkeit}:${n}`, quelle: `Schwerpunkt ${n}`, wert: je * anz,
        text: `+${je * anz}`, bedingung: 'wenn die Probe den Schwerpunkt behandelt', beleg: 'Schwerpunkte (GRW S. 92)' });
    }
    return [...aus, ...rel, ...sp] as SituativerBonus[];
  }, [liste, art, fertigkeit, attribute, relikte, inventar, masteries]);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const umschalten = (id: string) => setGewaehlt(g => { const n = new Set(g); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // Typus des Ziels: wählt die Boni gegen diesen Typus aus und nimmt die gegen andere Typen zurück
  const typen = useMemo(() => [...new Set(boni.map(b => b.typus).filter((t): t is string => !!t))].sort(), [boni]);
  const [zielTypus, setZielTypusRoh] = useState('');
  const setZielTypus = (t: string) => {
    setZielTypusRoh(t);
    setGewaehlt(g => {
      const n = new Set([...g].filter(id => !boni.find(b => b.id === id)?.typus));
      if (t) for (const b of boni) if (b.typus === t && b.wert !== null) n.add(b.id);
      return n;
    });
  };
  const aktiv = boni.filter(b => gewaehlt.has(b.id) && b.wert !== null);
  const summe = aktiv.reduce((s, b) => s + (b.wert ?? 0), 0);
  const labels = aktiv.map(b => `${b.quelle} (${b.wert! >= 0 ? '+' : ''}${b.wert})`);
  return { boni, gewaehlt, umschalten, summe, labels, typen, zielTypus, setZielTypus };
}

const vorzeichen = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export const SituativeBoni: React.FC<{
  boni: SituativerBonus[];
  gewaehlt: Set<string>;
  onToggle: (id: string) => void;
  dunkel?: boolean;
  /** Typen, gegen die einzelne Boni gelten, mit der Wahl des Ziels (aus useSituativeBoni) */
  typen?: string[];
  zielTypus?: string;
  onZielTypus?: (t: string) => void;
}> = ({ boni, gewaehlt, onToggle, dunkel = false, typen = [], zielTypus = '', onZielTypus }) => {
  if (!boni.length) return null;
  const passend = boni.filter(b => !zielTypus || !b.typus || b.typus === zielTypus);
  const verrechenbar = passend.filter(b => b.wert !== null);
  const hinweise = passend.filter(b => b.wert === null);
  const rahmen = dunkel ? 'bg-seite border-rahmen text-schrift' : 'bg-seite border-rahmen text-schrift';
  const titel = dunkel ? 'text-gold' : 'text-schrift';
  return (
    <div className={`rounded-karte p-3 mb-3 border ${rahmen}`} data-testid="situative-boni">
      <div className={`text-xs font-bold uppercase tracking-wider fantasy-font flex items-center gap-1.5 mb-1 ${titel}`}>
        <Sparkles size={14} className="text-gold" /> Stärken & Meisterschaften
      </div>
      {typen.length > 0 && onZielTypus && (
        <div className="mb-2 max-w-xs">
          <Auswahl beschriftung="Typus des Ziels" value={zielTypus} onChange={e => onZielTypus(e.target.value)}>
            <option value="">nicht festgelegt</option>
            {typen.map(t => <option key={t} value={t}>{t}</option>)}
          </Auswahl>
        </div>
      )}
      {verrechenbar.length > 0 && (
        <>
          <p className={`text-xs mb-2 ${dunkel ? 'text-leise' : 'text-leise'}`}>Gilt nur in bestimmten Lagen – anklicken, wenn sie zutrifft:</p>
          <div className="flex flex-wrap gap-1.5">
            {verrechenbar.map(b => {
              const an = gewaehlt.has(b.id);
              return (
                <Wahlknopf gewaehlt={an} ton="erholung" key={b.id} onClick={() => onToggle(b.id)} title={b.beleg} className="block text-xs px-2.5">
                  <span className="tabular-nums font-bold mr-1">{vorzeichen(b.wert!)}</span>
                  <span className="font-semibold">{b.quelle}</span>
                  {b.bedingung && <span className={an ? 'text-schrift' : 'opacity-75'}> – {b.bedingung}</span>}
                  {!b.bedingung && <span className={an ? 'text-schrift' : 'opacity-75'}> – {b.text}</span>}
                  {b.typus && <span className="sr-only"> (Typus {b.typus})</span>}
                </Wahlknopf>
              );
            })}
          </div>
        </>
      )}
      {hinweise.length > 0 && (
        <ul className={`mt-2 text-xs space-y-0.5 ${dunkel ? 'text-leise' : 'text-leise'}`}>
          {hinweise.map(b => (
            // Nur-Hinweis: der ganze Regelsatz statt eines Satzbruchstücks als Bedingung (die Lage steht im Satz)
            <li key={b.id}><strong>{b.quelle}</strong> ({b.text}): {b.beleg || b.bedingung || ''}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Wirkungen auf Zaubermechanik (Kosten, Zauberdauer; Schwierigkeit, Reichweite … als Hinweis) für einen Zauber der Schule.
 * Gewählte Kostenänderungen und Zauberdauer-Änderungen werden vom Zauber-Dialog verrechnet.
 */
export function useZauberAnpassungen(schule: string, kanalisiert: boolean, aus = false, zauberName?: string) {
  const heldCtx = useContext(CharacterContext);
  const ctx = aus ? null : heldCtx;
  const liste = ctx?.calc?.wirkungen?.liste;
  const anpassungen = useMemo(() => {
    const k = aktiverKatalog();
    return k && liste ? zauberAnpassungen(k, liste, schule, kanalisiert, zauberName ? zauberTypen(k, zauberName) : undefined) : [];
  }, [liste, schule, kanalisiert, zauberName]);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const umschalten = (id: string) => setGewaehlt(g => { const n = new Set(g); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const { kosten, dauer, labels } = useMemo(() => {
    const aktiv = anpassungen.filter(a => gewaehlt.has(a.id) && a.art !== 'hinweis');
    return {
      kosten: aktiv.flatMap(a => (a.kosten ? [a.kosten] : [])) as KostenDelta[],
      dauer: aktiv.flatMap(a => (a.dauer ? [a.dauer] : [])),
      labels: aktiv.map(a => `${a.quelle}: ${a.text}`),
    };
  }, [anpassungen, gewaehlt]);
  return { anpassungen, gewaehlt, umschalten, kosten, dauer, labels };
}

export const ZauberAnpassungen: React.FC<{
  anpassungen: ZauberAnpassung[];
  gewaehlt: Set<string>;
  onToggle: (id: string) => void;
}> = ({ anpassungen, gewaehlt, onToggle }) => {
  if (!anpassungen.length) return null;
  // je Meisterschaft ein Knopf (Kosten und Zauberdauer gemeinsam)
  const waehlbar = Object.values(anpassungen.filter(a => a.art !== 'hinweis').reduce<Record<string, { id: string; quelle: string; texte: string[]; bedingungen: string[]; beleg: string }>>((m, a) => {
    const g = (m[a.id] ??= { id: a.id, quelle: a.quelle, texte: [], bedingungen: [], beleg: '' });
    g.texte.push(a.text);
    if (a.bedingung && !g.bedingungen.includes(a.bedingung)) g.bedingungen.push(a.bedingung);
    g.beleg = g.beleg ? `${g.beleg} · ${a.beleg}` : a.beleg;
    return m;
  }, {}));
  const hinweise = anpassungen.filter(a => a.art === 'hinweis');
  return (
    <div className="rounded-karte p-3 border bg-seite border-rahmen text-schrift" data-testid="zauber-anpassungen">
      <div className="text-xs font-bold uppercase tracking-wider fantasy-font flex items-center gap-1.5 mb-1 text-schrift">
        <Sparkles size={14} className="text-gold" /> Kosten & Zauberdauer aus Meisterschaften
      </div>
      {waehlbar.length > 0 && (
        <>
          <p className="text-xs mb-2 text-leise">Anklicken, wenn die Meisterschaft für diesen Zauber gilt bzw. genutzt wird – wird in Kosten und Zauberdauer eingerechnet:</p>
          <div className="flex flex-wrap gap-1.5">
            {waehlbar.map(a => {
              const an = gewaehlt.has(a.id);
              return (
                <Wahlknopf gewaehlt={an} ton="erholung" mittig key={a.id} onClick={() => onToggle(a.id)} title={a.beleg} className="text-xs">
                  <span className="tabular-nums font-bold mr-1">{a.texte.join(', ')}</span>
                  <span className="font-semibold">{a.quelle}</span>
                  {a.bedingungen.length > 0 && <span className={an ? 'text-schrift' : 'opacity-75'}> – {a.bedingungen.join('; ')}</span>}
                </Wahlknopf>
              );
            })}
          </div>
        </>
      )}
      {hinweise.length > 0 && (
        <ul className="mt-2 text-xs space-y-0.5 text-leise">
          {hinweise.map((a, i) => (
            <li key={`${a.id}-${i}`} title={a.beleg}><strong>{a.quelle}:</strong> {a.text}{a.bedingung ? ` – ${a.bedingung}` : ''}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
