import { Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, Wahlknopf, useEscape } from '../../fundament';
import React, { useId, useMemo, useState } from 'react';
import { RefreshCw, Check, Coffee, Moon, Unlink, Minus, Plus } from 'lucide-react';
import type { ChanneledSpell } from '../../types';
import { useHausregeln } from '../../fundament/hausregeln';
import { ruheregeln, ruhephasenRegeneration, ruhewirkungen } from '../../regelwerk/spielwirkungen';
import type { CharacterState } from '../../types';

export interface FocusRegenModalProps {
  onClose: () => void;
  maxFO: number;
  focusAvailable: number;
  focus: { exhausted: number; channeled: number; consumed: number };
  channeledSpells: ChanneledSpell[];
  wil: number;
  strengthsList: CharacterState['strengthsList'];
  masteries: CharacterState['masteries'];
  onApplyRegen: (result: {
    /** zuerst beenden: ihre kanalisierten Punkte werden erschöpft (GRW S. 195–196) */
    spellsToEnd: ChanneledSpell[];
    exhaustedRegenerated: number;
    consumedRegenerated: number;
    methode: string;
    note?: string;
  }) => void;
}

/*
 * Fokus zurückgewinnen nach dem Grundregelwerk (S. 196, Tabelle „Heilung durch Pausen“ S. 174):
 * - Verschnaufpause (30 Minuten Ruhe und Konzentration): aller erschöpfte Fokus.
 * - Ruhephase (6 Stunden): aller erschöpfte Fokus und verzehrter Fokus in Höhe von WIL × 2 (mindestens 1).
 * - Kanalisierter Fokus regeneriert nicht. Erst wenn der Zauber endet, werden die Punkte erschöpft und kehren mit der
 *   nächsten Pause zurück (Beispiel Selesha, S. 196).
 * Die Pausen hier betreffen nur den Fokus. Die vollständige Rast (auch Lebenspunkte, Zustände, Ruhephasen je Tag)
 * steht im Abschnitt „Rast“. „Freie Regeneration“ ist ein Werkzeug für Sonderfälle und nur mit Hausregeln wählbar.
 */
type Methode = 'verschnaufpause' | 'ruhephase' | 'beenden' | 'frei';

export const FocusRegenModal: React.FC<FocusRegenModalProps> = ({
  onClose, maxFO, focusAvailable, focus, channeledSpells, wil, strengthsList, masteries, onApplyRegen,
}) => {
  const hausregeln = useHausregeln();
  const regeln = useMemo(() => ruheregeln(), []);
  const ruheFO = useMemo(
    () => ruhephasenRegeneration(0, wil, ruhewirkungen({ strengthsList, masteries }), regeln).fo,
    [wil, strengthsList, masteries, regeln],
  );
  const foFaktor = Math.max(regeln.foFaktor, ...ruhewirkungen({ strengthsList, masteries }).filter((w) => !w.bedingung).map((w) => w.fo_faktor ?? 0));

  const [methode, setMethode] = useState<Methode>(focus.consumed > 0 && focus.exhausted === 0 ? 'ruhephase' : 'verschnaufpause');
  const [beenden, setBeenden] = useState<Set<string>>(new Set());
  const [freiErschoepft, setFreiErschoepft] = useState<number>(focus.exhausted);
  const [freiVerzehrt, setFreiVerzehrt] = useState<number>(0);
  const [notiz, setNotiz] = useState<string>('');

  const toggle = (id: string) => setBeenden((alt) => {
    const neu = new Set(alt);
    if (neu.has(id)) neu.delete(id); else neu.add(id);
    return neu;
  });

  const zuBeenden = channeledSpells.filter((s) => beenden.has(s.id));
  const freigegeben = zuBeenden.reduce((n, s) => n + (s.channeledFocus || 0), 0);
  const erschoepftVorher = focus.exhausted + freigegeben;

  const { erschoepft, verzehrt } = useMemo(() => {
    switch (methode) {
      case 'verschnaufpause': return { erschoepft: erschoepftVorher, verzehrt: 0 };
      case 'ruhephase': return { erschoepft: erschoepftVorher, verzehrt: Math.min(ruheFO, focus.consumed) };
      case 'beenden': return { erschoepft: 0, verzehrt: 0 };
      case 'frei': return { erschoepft: Math.min(freiErschoepft, erschoepftVorher), verzehrt: Math.min(freiVerzehrt, focus.consumed) };
    }
  }, [methode, erschoepftVorher, ruheFO, focus.consumed, freiErschoepft, freiVerzehrt]);

  const nachher = {
    exhausted: erschoepftVorher - erschoepft,
    channeled: Math.max(0, focus.channeled - freigegeben),
    consumed: focus.consumed - verzehrt,
  };
  const verfuegbarNachher = focusAvailable + erschoepft + verzehrt;
  const nichts = erschoepft + verzehrt === 0 && zuBeenden.length === 0;

  const methodenName: Record<Methode, string> = {
    verschnaufpause: `Verschnaufpause (${regeln.verschnaufMinuten || 30} Min.)`,
    ruhephase: `Ruhephase (${regeln.ruheStunden || 6} Std.)`,
    beenden: 'Kanalisierte Zauber beendet',
    frei: 'Freie Regeneration',
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (nichts) return;
    onApplyRegen({
      spellsToEnd: zuBeenden,
      exhaustedRegenerated: erschoepft,
      consumedRegenerated: verzehrt,
      methode: methodenName[methode],
      note: notiz.trim() || undefined,
    });
    onClose();
  };

  const titelId = useId();
  useEscape(onClose);
  return (
    <Dialoghintergrund>
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId} breite="lg">
        <Dialogkopf
          titelId={titelId}
          symbol={<RefreshCw size={18} />}
          ton="kanalisiert"
          titel="Fokus regenerieren"
          untertitel="Grundregelwerk (GRW S. 196 Fokus zurückgewinnen, S. 174 Heilung durch Pausen)"
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

          {/* 1. Art der Erholung */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2">
            <label className="block text-xs font-bold text-unverletzt uppercase tracking-wider">1. Art der Erholung</label>
            <div className="grid grid-cols-2 gap-1.5">
              <Wahlknopf gewaehlt={methode === 'verschnaufpause'} ton="erholung" onClick={() => setMethode('verschnaufpause')}>
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Verschnaufpause</span>
                  <Coffee size={12} className="text-unverletzt" />
                </div>
                <div className="text-[11px] text-leise leading-tight">{regeln.verschnaufMinuten || 30} Min.: alles Erschöpfte</div>
              </Wahlknopf>
              <Wahlknopf gewaehlt={methode === 'ruhephase'} ton="erholung" onClick={() => setMethode('ruhephase')}>
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Ruhephase</span>
                  <Moon size={12} className="text-unverletzt" />
                </div>
                <div className="text-[11px] text-leise leading-tight">{regeln.ruheStunden || 6} Std.: Erschöpftes + {ruheFO} Verzehrtes</div>
              </Wahlknopf>
              <Wahlknopf gewaehlt={methode === 'beenden'} ton="erholung" onClick={() => setMethode('beenden')} disabled={channeledSpells.length === 0}
                title={channeledSpells.length === 0 ? 'Keine kanalisierten Zauber aktiv' : undefined}>
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Zauber beenden</span>
                  <Unlink size={12} className="text-kanalisiert" />
                </div>
                <div className="text-[11px] text-leise leading-tight">Kanalisiert → Erschöpft</div>
              </Wahlknopf>
              <Wahlknopf gewaehlt={methode === 'frei'} ton="erholung" onClick={() => setMethode('frei')} disabled={!hausregeln}
                title={hausregeln ? undefined : 'Nur mit „Hausregeln erlauben“ (Einstellungen → Allgemein)'}>
                <div className="font-bold text-xs">Freie Regeneration</div>
                <div className="text-[11px] text-leise leading-tight">{hausregeln ? 'Hausregel: beliebige Punkte' : 'nur mit Hausregeln'}</div>
              </Wahlknopf>
            </div>
            <p className="text-[11px] text-leise m-0" data-testid="fokus-regen-regel">
              {methode === 'ruhephase'
                ? `Eine Ruhephase regeneriert allen erschöpften Fokus und WIL (${wil}) × ${foFaktor} = ${ruheFO} verzehrte Punkte (GRW S. 196).`
                : methode === 'beenden'
                ? 'Kanalisierter Fokus regeneriert nicht. Endet der Zauber, werden seine Punkte erschöpft und kehren mit der nächsten Verschnaufpause zurück (GRW S. 196).'
                : methode === 'frei'
                ? 'Sonderfall nach Absprache am Tisch: Punkte frei wählen.'
                : 'Erschöpfter Fokus frischt sich nach einer halben Stunde Ruhe und Konzentration komplett auf; verzehrter Fokus braucht eine Ruhephase (GRW S. 196).'}
              {' '}Die vollständige Rast (auch LP und Zustände) findest du im Abschnitt „Rast“.
            </p>
          </div>

          {/* 2. Kanalisierte Zauber beenden */}
          <div className="bg-seite border border-kanalisiert rounded-knopf p-3 sm:p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-schrift uppercase tracking-wider">2. Kanalisierte Zauber beenden</label>
              <span className="text-[11px] text-leise">{channeledSpells.length} aktiv</span>
            </div>
            {channeledSpells.length > 0 ? (
              <>
                <p className="text-[11px] text-leise m-0">
                  Gewählte Zauber enden vor der Erholung; ihre kanalisierten Punkte werden erschöpft
                  {methode === 'verschnaufpause' || methode === 'ruhephase' ? ' und gleich mit regeneriert' : ''}.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {channeledSpells.map((s) => {
                    const an = beenden.has(s.id);
                    return (
                      <label key={s.id} className={`flex items-center justify-between p-2 rounded-knopf border cursor-pointer transition-colors ${an ? 'bg-kanalisiert-grund border-kanalisiert' : 'bg-seite border-rahmen'} text-schrift`}>
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={an} onChange={() => toggle(s.id)} className="rounded-knopf focus:ring-0 cursor-pointer w-4 h-4" />
                          <span className="text-xs font-bold">{s.name}</span>
                        </span>
                        <span className="text-[11px] tabular-nums font-bold">K{s.channeledFocus}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-xs text-leise italic">Keine kanalisierten Zauber aktiv.</div>
            )}
          </div>

          {/* 3. Freie Menge (Hausregel) */}
          {methode === 'frei' && (
            <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2">
              <label className="block text-xs font-bold text-unverletzt uppercase tracking-wider">3. Punkte</label>
              {([
                ['Erschöpft', freiErschoepft, setFreiErschoepft, erschoepftVorher],
                ['Verzehrt', freiVerzehrt, setFreiVerzehrt, focus.consumed],
              ] as const).map(([label, wert, setzen, max]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-20 font-semibold text-schrift">{label}</span>
                  <Knopf nurSymbol aria-label={`${label} weniger`} disabled={wert <= 0} onClick={() => setzen(Math.max(0, wert - 1))}><Minus size={14} aria-hidden /></Knopf>
                  <span className="w-8 text-center tabular-nums font-bold text-schrift">{Math.min(wert, max)}</span>
                  <Knopf nurSymbol aria-label={`${label} mehr`} disabled={wert >= max} onClick={() => setzen(Math.min(max, wert + 1))}><Plus size={14} aria-hidden /></Knopf>
                  <span className="text-leise">von {max}</span>
                </div>
              ))}
            </div>
          )}

          {/* Vorschau */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-leise font-semibold">Verfügbar danach:</span>
              <div className="flex items-center gap-1.5 font-bold tabular-nums" data-testid="fokus-regen-vorschau">
                <span className="text-schrift">{focusAvailable}</span>
                <span className="text-leise">→</span>
                <span className="text-unverletzt">{verfuegbarNachher}</span>
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
              placeholder="z. B. Meditation im Versteck"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              className="w-full bg-seite border border-rahmen rounded-knopf px-2.5 py-1.5 text-xs text-schrift placeholder-leise focus:outline-none focus:border-unverletzt"
            />
          </div>
        </form>

        <div className="px-4 sm:px-5 py-3 border-t border-unverletzt bg-seite flex items-center justify-between gap-3 shrink-0">
          <Knopf onClick={onClose} className="text-xs">Abbrechen</Knopf>
          <Knopf art="erholung" onClick={() => handleSubmit()} disabled={nichts} className="text-xs sm:text-sm gap-1.5 disabled:cursor-not-allowed">
            <Check size={16} />
            <span>
              {erschoepft + verzehrt > 0
                ? `${erschoepft + verzehrt} Fokus regenerieren`
                : zuBeenden.length > 0
                ? `${zuBeenden.length} Zauber beenden`
                : 'Fokus regenerieren'}
            </span>
          </Knopf>
        </div>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};
