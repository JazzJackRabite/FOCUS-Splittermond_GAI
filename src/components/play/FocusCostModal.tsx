import { Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, Wahlknopf, useEscape } from '../../fundament';
import React, { useId, useMemo, useState } from 'react';
import { Sparkles, Minus, Plus, Check, AlertTriangle, Zap } from 'lucide-react';
import { parseFocusCost } from '../../utils/magicRules';
import { useHausregeln } from '../../fundament/hausregeln';

export interface FocusCostModalProps {
  onClose: () => void;
  maxFO: number;
  /** frei verfügbarer Fokus (schon ohne gesperrte Punkte aus Zuständen) */
  focusAvailable: number;
  focus: { exhausted: number; channeled: number; consumed: number };
  onApplyCost: (result: {
    /** Veränderungen der drei Fokusarten (verzehrt kann bei misslungenen Zaubern erschöpfte Punkte umwandeln) */
    exhausted: number;
    channeled: number;
    consumed: number;
    /** Name des kanalisierten Zaubers, falls Punkte kanalisiert werden (erscheint unter „Kanalisierte Zauber“) */
    channeledName?: string;
    title: string;
    description: string;
  }) => void;
}

/*
 * Fokuskosten nach dem Grundregelwerk:
 * - Drei Arten, Fokus einzusetzen (GRW S. 194–196): erschöpfen (Zahl), kanalisieren (K), verzehren (V). Die Zahl hinter V
 *   ist Teil der Gesamtkosten: „K6V2 sind 6 kanalisierte Punkte Fokus insgesamt, davon werden 2 sofort verzehrt.“
 * - Ein gewirkter Zauber kostet immer mindestens einen erschöpften oder kanalisierten Punkt (GRW S. 195).
 * - Misslungener Zauber (GRW S. 198): statt der Kosten erschöpft sich der Fokus um die negativen EG. Reicht der verbliebene
 *   Fokus nicht, werden bereits erschöpfte Punkte in Höhe der Differenz verzehrt.
 * Zauber mit Probe und Erfolgsgraden laufen weiter über „Zaubern“; dieser Dialog bucht Kosten aus Meisterschaften,
 * Stärken, Gegenständen oder am Tisch gewürfelten Zaubern.
 */
type Quelle = 'notation' | 'misslungen';

const SCHNELL = ['1', '2', '4', '8', '4V1', '8V2', 'K1', 'K2', 'K4', 'K4V1'];

export const FocusCostModal: React.FC<FocusCostModalProps> = ({ onClose, maxFO, focusAvailable, focus, onApplyCost }) => {
  const hausregeln = useHausregeln();
  const [quelle, setQuelle] = useState<Quelle>('notation');
  const [notation, setNotation] = useState<string>('1');
  const [zauberName, setZauberName] = useState<string>('');
  const [negEG, setNegEG] = useState<number>(1);
  const [notiz, setNotiz] = useState<string>('');

  const kosten = useMemo(() => parseFocusCost(notation), [notation]);
  const notationGueltig = /^\s*(K\d*(V\d+)?|\d+(V\d+)?)\s*$/i.test(notation) && kosten.total > 0;
  // V ohne erschöpften oder kanalisierten Rest verstößt gegen die Mindestkosten (GRW S. 195)
  const unterMindestkosten = notationGueltig && kosten.exhausted + kosten.channeled === 0;

  // Misslungener Zauber: erschöpfen, soweit Fokus frei ist; der Rest verzehrt bereits erschöpfte Punkte (GRW S. 198)
  const fehlschlag = useMemo(() => {
    const n = Math.max(0, negEG);
    const erschoepfen = Math.min(n, Math.max(0, focusAvailable));
    const differenz = n - erschoepfen;
    const umgewandelt = Math.min(differenz, focus.exhausted + erschoepfen);
    return { erschoepfen, umgewandelt, verfallen: differenz - umgewandelt };
  }, [negEG, focusAvailable, focus.exhausted]);

  const ergebnis = quelle === 'notation'
    ? { exhausted: kosten.exhausted, channeled: kosten.channeled, consumed: kosten.consumed }
    : { exhausted: fehlschlag.erschoepfen - fehlschlag.umgewandelt, channeled: 0, consumed: fehlschlag.umgewandelt };
  const gesamt = quelle === 'notation' ? kosten.total : fehlschlag.erschoepfen + fehlschlag.umgewandelt;
  const zuWenigFokus = quelle === 'notation' && notationGueltig && kosten.total > focusAvailable;
  const gesperrt =
    quelle === 'notation'
      ? !notationGueltig || unterMindestkosten || (zuWenigFokus && !hausregeln)
      : negEG <= 0;

  const nachher = {
    frei: Math.max(0, focusAvailable - (quelle === 'notation' ? kosten.total : fehlschlag.erschoepfen)),
    exhausted: focus.exhausted + ergebnis.exhausted,
    channeled: focus.channeled + ergebnis.channeled,
    consumed: focus.consumed + ergebnis.consumed,
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (gesperrt) return;
    const name = zauberName.trim();
    const n = notiz.trim();
    if (quelle === 'notation') {
      onApplyCost({
        ...ergebnis,
        channeledName: kosten.channeled + kosten.consumed > 0 && kosten.isChanneled ? name || 'Kanalisierter Zauber' : undefined,
        title: `${kosten.total} Fokus eingesetzt (${kosten.raw.toUpperCase()})${name ? `: ${name}` : ''}`,
        description: [
          `${kosten.exhausted} erschöpft, ${kosten.channeled} kanalisiert, ${kosten.consumed} verzehrt`,
          n,
        ].filter(Boolean).join(' · '),
      });
    } else {
      onApplyCost({
        ...ergebnis,
        title: `Zauber misslungen${name ? `: ${name}` : ''} (${negEG} negative EG)`,
        description: [
          `${fehlschlag.erschoepfen} Fokus erschöpft`,
          fehlschlag.umgewandelt > 0 ? `${fehlschlag.umgewandelt} erschöpfte Punkte verzehrt (Fokus reichte nicht, GRW S. 198)` : '',
          n,
        ].filter(Boolean).join(' · '),
      });
    }
    onClose();
  };

  const titelId = useId();
  useEscape(onClose);
  return (
    <Dialoghintergrund>
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId} breite="lg">
        <Dialogkopf
          titelId={titelId}
          symbol={<Zap size={18} />}
          ton="erschoepft"
          titel="Fokuskosten"
          untertitel="Grundregelwerk (GRW S. 194–196 Fokus einsetzen, S. 198 Misslungene Zauber)"
          onSchliessen={onClose}
        />

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {/* Aktueller Fokus */}
          <div className="bg-seite border border-rahmen rounded-knopf p-2.5 sm:p-3 text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-schrift">
              Verfügbar: <strong className="tabular-nums text-unverletzt">{focusAvailable}</strong> / <span className="tabular-nums">{maxFO}</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <span className="px-2 py-0.5 rounded-knopf bg-erschoepft-grund border border-erschoepft text-schrift">Erschöpft: <strong>{focus.exhausted}</strong></span>
              <span className="px-2 py-0.5 rounded-knopf bg-kanalisiert-grund border border-kanalisiert text-schrift">Kanalisiert: <strong>{focus.channeled}</strong></span>
              <span className="px-2 py-0.5 rounded-knopf bg-schaden-grund border border-schaden text-schrift">Verzehrt: <strong>{focus.consumed}</strong></span>
            </div>
          </div>

          {/* 1. Anlass */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2">
            <label className="block text-xs font-bold text-gold-hell uppercase tracking-wider">1. Anlass</label>
            <div className="grid grid-cols-2 gap-1.5">
              <Wahlknopf gewaehlt={quelle === 'notation'} onClick={() => setQuelle('notation')}>
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Fokus einsetzen</span>
                  <Sparkles size={12} className="text-gold" />
                </div>
                <div className="text-[11px] text-leise leading-tight">Zauber, Meisterschaft, Fähigkeit</div>
              </Wahlknopf>
              <Wahlknopf gewaehlt={quelle === 'misslungen'} ton="gefahr" onClick={() => setQuelle('misslungen')}>
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Zauber misslungen</span>
                  <AlertTriangle size={12} className="text-schaden" />
                </div>
                <div className="text-[11px] text-leise leading-tight">Erschöpft um negative EG</div>
              </Wahlknopf>
            </div>
            <p className="text-[11px] text-leise m-0">
              Zauber mit Probe und Erfolgsgraden wirkst du über „Zaubern“; hier buchst du Kosten, die schon feststehen.
            </p>
          </div>

          {/* Zauber / Fähigkeit */}
          <div>
            <label className="block text-[11px] font-bold text-leise uppercase tracking-wide mb-1">
              Zauber / Fähigkeit {quelle === 'notation' && kosten.isChanneled ? '(Name für „Kanalisierte Zauber“)' : '(optional)'}
            </label>
            <input
              type="text"
              placeholder="z. B. Flammende Waffe, Stimme des Sturms"
              value={zauberName}
              onChange={(e) => setZauberName(e.target.value)}
              className="w-full bg-seite border border-rahmen rounded-knopf px-2.5 py-1.5 text-xs text-schrift placeholder-leise focus:outline-none focus:border-gold"
            />
          </div>

          {quelle === 'notation' ? (
            /* 2. Kosten in Splittermond-Notation */
            <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2.5">
              <label className="block text-xs font-bold text-gold-hell uppercase tracking-wider">2. Kosten (Notation)</label>
              <input
                type="text"
                value={notation}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setNotation(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                aria-label="Fokuskosten in Notation"
                data-testid="fokuskosten-notation"
                className="w-full text-center bg-seite border border-erschoepft rounded-knopf py-1.5 text-2xl tabular-nums font-bold text-gold-hell focus:outline-none focus:border-gold"
              />
              <div className="flex flex-wrap gap-1">
                {SCHNELL.map((s) => (
                  <Wahlknopf key={s} gewaehlt={notation === s} mittig onClick={() => setNotation(s)} className="rounded-full text-[11px] font-bold tabular-nums">
                    {s}
                  </Wahlknopf>
                ))}
              </div>
              <p className="text-[11px] text-leise m-0">
                Zahl = erschöpft, K = kanalisiert, V = davon verzehrt. 8V2: 6 erschöpft, 2 verzehrt. K4V1: 3 kanalisiert, 1 verzehrt (GRW S. 195).
              </p>

              {/* Aufschlüsselung */}
              <div className="text-[11px] bg-seite p-2 rounded-knopf border border-rahmen flex flex-wrap items-center justify-between gap-2 text-schrift">
                <span>Aufschlüsselung:</span>
                {notationGueltig ? (
                  <div className="flex items-center gap-2 tabular-nums font-bold" data-testid="fokuskosten-aufschluesselung">
                    {kosten.exhausted > 0 && <span className="text-gold-hell">{kosten.exhausted} Erschöpft</span>}
                    {kosten.channeled > 0 && <span className="text-kanalisiert">{kosten.channeled} Kanalisiert</span>}
                    {kosten.consumed > 0 && <span className="text-schaden">{kosten.consumed} Verzehrt</span>}
                    <span className="text-schrift">= {kosten.total} FO</span>
                  </div>
                ) : (
                  <span className="text-schaden font-bold">Notation nicht lesbar (z. B. 4, 8V2, K2, K4V1)</span>
                )}
              </div>

              {unterMindestkosten && (
                <p className="text-[11px] text-schaden m-0">
                  Mindestens 1 Punkt muss erschöpft oder kanalisiert werden (GRW S. 195).
                </p>
              )}
              {zuWenigFokus && (
                <p className="text-[11px] text-schaden m-0 flex items-center gap-1" data-testid="fokuskosten-zu-wenig">
                  <AlertTriangle size={12} aria-hidden />
                  Nur {focusAvailable} Fokus verfügbar.
                  {hausregeln ? ' Mit Hausregeln trotzdem buchbar.' : ' Ein misslungener Zauber kann trotzdem Fokus kosten (Anlass „Zauber misslungen“).'}
                </p>
              )}
            </div>
          ) : (
            /* 2. Negative Erfolgsgrade */
            <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2.5">
              <label className="block text-xs font-bold text-schaden uppercase tracking-wider">2. Negative Erfolgsgrade</label>
              <div className="flex items-center gap-2">
                <Knopf nurSymbol aria-label="ein negativer EG weniger" onClick={() => setNegEG((n) => Math.max(0, n - 1))}><Minus size={14} aria-hidden /></Knopf>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={negEG}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNegEG(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  aria-label="Negative Erfolgsgrade"
                  data-testid="fokuskosten-neg-eg"
                  className="flex-1 text-center bg-seite border border-schaden rounded-knopf py-1.5 text-2xl tabular-nums font-bold text-schrift focus:outline-none"
                />
                <Knopf nurSymbol aria-label="ein negativer EG mehr" onClick={() => setNegEG((n) => n + 1)}><Plus size={14} aria-hidden /></Knopf>
              </div>
              <p className="text-[11px] text-leise m-0">
                Statt der Zauberkosten erschöpft sich der Fokus um die negativen EG. Reicht der verbliebene Fokus nicht, werden
                bereits erschöpfte Punkte in Höhe der Differenz verzehrt (GRW S. 198).
              </p>
              <div className="text-[11px] bg-seite p-2 rounded-knopf border border-rahmen flex flex-wrap items-center justify-between gap-2 text-schrift">
                <span>Ergebnis:</span>
                <div className="flex items-center gap-2 tabular-nums font-bold" data-testid="fokuskosten-fehlschlag">
                  <span className="text-gold-hell">{fehlschlag.erschoepfen} Erschöpft</span>
                  {fehlschlag.umgewandelt > 0 && <span className="text-schaden">{fehlschlag.umgewandelt} Erschöpft → Verzehrt</span>}
                </div>
              </div>
              {fehlschlag.verfallen > 0 && (
                <p className="text-[11px] text-leise m-0">
                  {fehlschlag.verfallen} Punkt(e) lassen sich nicht mehr abbilden: aller Fokus ist bereits kanalisiert oder verzehrt.
                </p>
              )}
            </div>
          )}

          {/* Vorschau */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-leise font-semibold">Verfügbar danach:</span>
              <div className="flex items-center gap-1.5 font-bold tabular-nums">
                <span className="text-schrift">{focusAvailable}</span>
                <span className="text-leise">→</span>
                <span className={nachher.frei > 0 ? 'text-unverletzt' : 'text-schaden'}>{nachher.frei}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-rahmen tabular-nums">
              <span className="text-leise">Erschöpft {focus.exhausted} → <strong className="text-schrift">{nachher.exhausted}</strong></span>
              <span className="text-leise">Kanalisiert {focus.channeled} → <strong className="text-schrift">{nachher.channeled}</strong></span>
              <span className="text-leise">Verzehrt {focus.consumed} → <strong className="text-schrift">{nachher.consumed}</strong></span>
            </div>
          </div>

          {/* Notiz */}
          <div>
            <label className="block text-[11px] font-bold text-leise uppercase tracking-wide mb-1">Notiz (optional)</label>
            <input
              type="text"
              placeholder="z. B. Ziel, Gegenstand, Meisterschaft"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              className="w-full bg-seite border border-rahmen rounded-knopf px-2.5 py-1.5 text-xs text-schrift placeholder-leise focus:outline-none focus:border-gold"
            />
          </div>
        </form>

        <div className="px-4 sm:px-5 py-3 border-t border-erschoepft bg-seite flex items-center justify-between gap-3 shrink-0">
          <Knopf onClick={onClose} className="text-xs">Abbrechen</Knopf>
          <Knopf art="primaer" onClick={() => handleSubmit()} disabled={gesperrt} className="text-xs sm:text-sm gap-1.5 disabled:cursor-not-allowed">
            <Check size={16} />
            <span>{gesamt > 0 ? `${gesamt} Fokus buchen` : 'Fokus buchen'}</span>
          </Knopf>
        </div>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};
