import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf } from '../../fundament';
import React, { useState, useEffect } from 'react';
import { Sun, Moon, RotateCcw, Settings, Heart, Sparkles, X, Check, Clock } from 'lucide-react';
import type { ItemEntry, Mastery } from '../../types';
import { regelverstoss } from '../../fundament/hausregeln';
import { ruheregeln, ruhephasenRegeneration, ruhewirkungen, type Ruhewirkung } from '../../regelwerk/spielwirkungen';

export interface VerschnaufpauseOptions {
  healAllStun: boolean;
  stunAmount: number;
  healAllExhaustedFocus: boolean;
  exhaustedFocusAmount: number;
  exhaustReduction: number;
  removeConditions: boolean;
}

interface RestSectionProps {
  kon: number;
  wil: number;
  strengthsList: ItemEntry[];
  weaknessesList: ItemEntry[];
  masteries: Record<string, Mastery[]>;
  moonSign: string;
  onVerschnaufpause: (options?: Partial<VerschnaufpauseOptions>, mitBegleitern?: boolean) => void;
  onRuhephase: (lpAmount: number, foAmount: number, mitBegleitern?: boolean) => void;
  /** Anzahl der Begleiter; bei mehr als 0 erscheint „Begleiter rasten mit“ */
  begleiterAnzahl?: number;
  /** Ruhephasen seit dem letzten „Neuer Tag“ (Höchstzahl: ruheregeln().ruhephasenJeTag) */
  ruhephasenHeute?: number;
  onNeuerTag?: () => void;
  /** aktive Zustände, die natürliche Heilung verhindern (Paketfeld keine_natuerliche_heilung) */
  ohneHeilung?: string[];
}

export const RestSection: React.FC<RestSectionProps> = ({
  kon,
  wil,
  strengthsList,
  masteries,
  moonSign,
  onVerschnaufpause,
  onRuhephase,
  begleiterAnzahl = 0,
  ruhephasenHeute = 0,
  onNeuerTag,
  ohneHeilung = [],
}) => {
  const [mitBegleitern, setMitBegleitern] = useState(true);
  const mit = begleiterAnzahl > 0 && mitBegleitern;
  // Pausenregeln und Ruhewirkungen aus dem Paket (regelwerk/spielwirkungen.ts): keine Namen von Stärken oder Meisterschaften im Code
  const regeln = ruheregeln();
  const wirkungen = ruhewirkungen({ strengthsList, masteries });
  const fest = wirkungen.filter((w) => !w.bedingung);
  const bedingt = wirkungen.filter((w) => w.bedingung);
  const { lp: calculatedLPDefault, fo: calculatedFODefault } = ruhephasenRegeneration(kon, wil, wirkungen, regeln);
  const lpMultiplier = Math.max(regeln.lpFaktor, ...fest.map((w) => w.lp_faktor ?? 0));
  const foMultiplier = Math.max(regeln.foFaktor, ...fest.map((w) => w.fo_faktor ?? 0));
  const kurzpausen = fest.filter((w) => w.erschoepft_minuten || w.fo_erschoepft_minuten);
  const ruheText = (w: Ruhewirkung) => [
    w.lp_faktor ? `Konstitution ×${w.lp_faktor}` : '', w.fo_faktor ? `Willenskraft ×${w.fo_faktor}` : '',
    w.lp_zusatz ? `+${w.lp_zusatz} LP` : '', w.regeneration_faktor ? `Regeneration ×${w.regeneration_faktor}` : '',
    w.erschoepft_minuten ? `Erschöpft in ${w.erschoepft_minuten} Min` : '', w.fo_erschoepft_minuten ? `erschöpfter Fokus in ${w.fo_erschoepft_minuten} Min` : '',
  ].filter(Boolean).join(', ');
  const hasSegenMondkraft = moonSign === 'Segen der Mondkraft';

  // User configured Ruhephase amounts
  const [customLP, setCustomLP] = useState<number>(calculatedLPDefault);
  const [customFO, setCustomFO] = useState<number>(calculatedFODefault);

  // -------------------------------------------------------------
  // Verschnaufpause configured options
  // -------------------------------------------------------------
  const [vpHealAllStun, setVpHealAllStun] = useState<boolean>(true);
  const [vpStunAmount, setVpStunAmount] = useState<number>(kon * regeln.lpFaktor);
  const [vpHealAllFocus, setVpHealAllFocus] = useState<boolean>(true);
  const [vpFocusAmount, setVpFocusAmount] = useState<number>(wil * regeln.foFaktor);
  const [vpExhaustReduction, setVpExhaustReduction] = useState<number>(1);
  const [vpRemoveConditions, setVpRemoveConditions] = useState<boolean>(true);

  // Modal state: null | 'verschnaufpause' | 'ruhephase'
  const [activeModal, setActiveModal] = useState<'verschnaufpause' | 'ruhephase' | null>(null);

  // Sync with calculated defaults when character stats change
  useEffect(() => {
    setCustomLP(calculatedLPDefault);
  }, [calculatedLPDefault]);

  useEffect(() => {
    setCustomFO(calculatedFODefault);
  }, [calculatedFODefault]);

  // Handle ESC key for modal
  useEffect(() => {
    if (!activeModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal]);

  // Verschnaufpause is default check
  const isVpDefault =
    vpHealAllStun &&
    vpHealAllFocus &&
    vpExhaustReduction === 1 &&
    vpRemoveConditions;

  const resetVpToDefault = () => {
    setVpHealAllStun(true);
    setVpStunAmount(kon * regeln.lpFaktor);
    setVpHealAllFocus(true);
    setVpFocusAmount(wil * regeln.foFaktor);
    setVpExhaustReduction(1);
    setVpRemoveConditions(true);
  };

  // Ruhephase is default check
  const isRuhephaseDefault = customLP === calculatedLPDefault && customFO === calculatedFODefault;

  const resetRuhephaseToDefault = () => {
    setCustomLP(calculatedLPDefault);
    setCustomFO(calculatedFODefault);
  };

  const handleExecuteVerschnaufpause = () => {
    onVerschnaufpause({
      healAllStun: vpHealAllStun,
      stunAmount: vpHealAllStun ? undefined : vpStunAmount,
      healAllExhaustedFocus: vpHealAllFocus,
      exhaustedFocusAmount: vpHealAllFocus ? undefined : vpFocusAmount,
      exhaustReduction: vpExhaustReduction,
      removeConditions: vpRemoveConditions,
    }, mit);
    if (activeModal === 'verschnaufpause') {
      setActiveModal(null);
    }
  };

  const handleExecuteRuhephase = () => {
    if (regeln.ruhephasenJeTag > 0 && ruhephasenHeute >= regeln.ruhephasenJeTag
      && regelverstoss(`Höchstens ${regeln.ruhephasenJeTag} Ruhephasen pro Tag (${regeln.quelle}). Mit „Neuer Tag“ zurücksetzen.`)) return;
    onRuhephase(customLP, customFO, mit);
    if (activeModal === 'ruhephase') {
      setActiveModal(null);
    }
  };

  const vpDuration = `${regeln.verschnaufMinuten} Minuten`;
  const ruhephaseDuration = `${regeln.ruheStunden} Stunden`;

  return (
    <div id="rest-section-container" className="bg-flaeche rounded-karte border border-rahmen p-5 space-y-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-rahmen pb-2">
        <div className="flex items-center gap-2">
          
          <h3 className="font-bold text-[17px] fantasy-font text-gold-hell">
            Regeneration &amp; Pausen
          </h3>
        </div>
      </div>

      {begleiterAnzahl > 0 && (
        <label className="flex items-center gap-2 min-h-11 text-sm text-schrift cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mitBegleitern}
            onChange={(e) => setMitBegleitern(e.target.checked)}
            className="w-4 h-4 rounded-knopf border-rahmen text-unverletzt focus:ring-unverletzt"
          />
          <span>Begleiter rasten mit ({begleiterAnzahl})</span>
        </label>
      )}

      {ohneHeilung.length > 0 && (
        <p id="rast-ohne-heilung" className="text-xs text-schrift rounded-knopf border border-rahmen bg-erhoeht px-3 py-2">
          Keine natürliche Heilung ({ohneHeilung.join(', ')}): Pausen heilen keine Lebenspunkte, die Sterbe-Stufe bleibt. Heilkunde und Heilzauber wirken weiter.
        </p>
      )}

      {/* Two Action Cards (gestapelt für rechte Spalte) */}
      <div className="grid grid-cols-1 gap-3">
        {/* ── CARD 1: VERSCHNAUFPAUSE ── */}
        <div
          id="verschnaufpause-card"
          className="rounded-karte border border-rahmen bg-erhoeht p-4 flex flex-col justify-between hover:border-gold transition-all relative"
        >
          <div className="space-y-2">
            {/* Top row: Title + Duration */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-knopf bg-erhoeht text-schrift border border-rahmen">
                  <Sun size={18} className="text-gold" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-gold-hell fantasy-font">
                    Verschnaufpause
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs mt-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-knopf bg-erhoeht text-schrift tabular-nums font-bold text-xs border border-rahmen">
                      <Clock size={12} className="text-gold shrink-0" />
                      <span>{vpDuration}</span>
                    </span>
                    {hasSegenMondkraft && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-knopf bg-rahmen text-schrift font-bold border border-rahmen">
                        Mondsegen
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Badge when customized */}
              {!isVpDefault && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-erhoeht text-gold border border-rahmen">
                  Angepasst
                </span>
              )}
            </div>

            {/* Effect in 1 sentence */}
            <p className="text-xs text-schrift leading-relaxed min-h-[36px]">
              Heilt Betäubungsschaden &amp; erschöpften Fokus, baut 1 Stufe Erschöpfung ab.
            </p>
          </div>

          {/* Action Row */}
          <div className="pt-3 mt-2 border-t border-rahmen flex flex-col gap-2">
            <Knopf art="erholung"
              id="btn-execute-verschnaufpause"
              onClick={handleExecuteVerschnaufpause}
              className="w-full active:scale-[0.99] text-sm gap-2 select-none"
            >
              <Sun size={17} className="text-gold" />
              <span>Verschnaufpause durchführen</span>
            </Knopf>

            <div className="flex items-center justify-between text-xs px-0.5">
              <Knopf
                onClick={() => setActiveModal('verschnaufpause')}
                className="gap-1 hover:underline"
              >
                <Settings size={13} className="text-gold" />
                <span>Optionen anpassen</span>
              </Knopf>

              {!isVpDefault && (
                <Knopf
                  onClick={resetVpToDefault}
                  className="gap-1 text-[11px] hover:underline"
                  title="Auf berechnete Regelwerte zurücksetzen"
                >
                  <RotateCcw size={12} />
                  <span>Standardwerte wiederherstellen</span>
                </Knopf>
              )}
            </div>
          </div>
        </div>

        {/* ── CARD 2: RUHEPHASE ── */}
        <div
          id="ruhephase-card"
          className="rounded-karte border border-rahmen bg-erhoeht p-4 flex flex-col justify-between hover:border-gold transition-all relative"
        >
          <div className="space-y-2">
            {/* Top row: Title + Duration */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-knopf bg-erhoeht text-schrift border border-rahmen">
                  <Moon size={18} className="text-schrift" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-gold-hell fantasy-font">
                    Ruhephase
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs mt-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-knopf bg-erhoeht text-schrift tabular-nums font-bold text-xs border border-rahmen">
                      <Clock size={12} className="text-gold shrink-0" />
                      <span>{ruhephaseDuration}</span>
                    </span>
                    {hasSegenMondkraft && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-knopf bg-rahmen text-schrift font-bold border border-rahmen">
                        Mondsegen
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status or preview badges */}
              <div className="flex items-center gap-1.5">
                {!isRuhephaseDefault && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-erhoeht text-gold border border-rahmen">
                    Angepasst
                  </span>
                )}
                <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-knopf bg-erhoeht text-schrift border border-rahmen">
                  +{customLP} LP · +{customFO} FO
                </span>
              </div>
            </div>

            {/* Effect in 1 sentence */}
            <p className="text-xs text-schrift leading-relaxed min-h-[36px]">
              Heilt zusätzlich echten Schaden &amp; verzehrten Fokus, baut Erschöpfung komplett ab.
            </p>
            {regeln.ruhephasenJeTag > 0 && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span id="ruhephasen-heute" className={`tabular-nums ${ruhephasenHeute >= regeln.ruhephasenJeTag ? 'text-gold font-bold' : 'text-leise'}`}>
                  Ruhephasen heute: {ruhephasenHeute} von {regeln.ruhephasenJeTag}
                </span>
                {onNeuerTag && (
                  <Knopf eng id="btn-neuer-tag" onClick={onNeuerTag} title="Zähler der Ruhephasen für einen neuen Tag zurücksetzen">
                    Neuer Tag
                  </Knopf>
                )}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="pt-3 mt-2 border-t border-rahmen flex flex-col gap-2">
            <Knopf art="erholung"
              id="btn-execute-ruhephase"
              onClick={handleExecuteRuhephase}
              className="w-full active:scale-[0.99] text-sm gap-2 select-none"
            >
              <Moon size={17} className="text-gold" />
              <span>Ruhephase durchführen</span>
            </Knopf>

            <div className="flex items-center justify-between text-xs px-0.5">
              <Knopf
                onClick={() => setActiveModal('ruhephase')}
                className="gap-1 hover:underline"
              >
                <Settings size={13} className="text-gold" />
                <span>Optionen anpassen</span>
              </Knopf>

              {!isRuhephaseDefault && (
                <Knopf
                  onClick={resetRuhephaseToDefault}
                  className="gap-1 text-[11px] hover:underline"
                  title="Auf berechnete Regelwerte zurücksetzen"
                >
                  <RotateCcw size={12} />
                  <span>Standardwerte wiederherstellen</span>
                </Knopf>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* OPTIONS MODAL                                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeModal && (
        <Dialoghintergrund
          id="rest-options-modal-backdrop" className="animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
        >
          <Dialogfenster
            id="rest-options-modal-card" breite="lg" className="animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <Dialogkopf
              symbol={activeModal === 'verschnaufpause' ? <Sun size={20} /> : <Moon size={20} />}
              titel={activeModal === 'verschnaufpause' ? 'Optionen: Verschnaufpause' : 'Optionen: Ruhephase'}
              untertitel={activeModal === 'verschnaufpause' ? `Verschnaufpause (${vpDuration})` : `Ruhephase (${ruhephaseDuration})`}
              onSchliessen={() => setActiveModal(null)}
            />

            {/* Modal Content */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm custom-scrollbar modal-body-scroll">
              {activeModal === 'verschnaufpause' ? (
                <>
                  {/* Rule Reference Info */}
                  <div className="bg-erhoeht border border-rahmen rounded-knopf p-3 space-y-1.5 text-xs text-schrift">
                    <div className="flex items-center justify-between font-bold text-schrift">
                      <span>Regel-Grundlage:</span>
                      <span className="font-normal text-[11px] text-leise">{regeln.quelle}</span>
                    </div>
                    <p className="leading-relaxed">
                      Dauer: <strong>{vpDuration}</strong> ununterbrochene Rast. Heilt allen Betäubungsschaden, stellt erschöpften Fokus wieder her und baut 1 Stufe <em>Erschöpft</em> ab.
                    </p>

                    {(hasSegenMondkraft || kurzpausen.length > 0) && (
                      <div className="pt-2 border-t border-rahmen space-y-1">
                        <span className="font-semibold text-schrift block text-[11px]">Aktive Besonderheiten:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {hasSegenMondkraft && (
                            <span className="px-2 py-0.5 rounded-knopf bg-rahmen text-schrift font-bold border border-rahmen text-[11px]">
                              Mondzeichen (Gabe, Splitterpunkt): Dauer halbieren
                            </span>
                          )}
                          {kurzpausen.map((w) => (
                            <span key={w.quelle} title={w.beleg} className="px-2 py-0.5 rounded-knopf bg-kanalisiert-grund text-schrift border border-kanalisiert text-[11px] font-semibold">
                              {w.quelle}: {ruheText(w)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Options Settings */}
                  <div className="space-y-3">
                    {/* Betäubungsschaden */}
                    <div className="bg-flaeche rounded-knopf border border-rahmen p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-schrift flex items-center gap-1.5">
                          <Heart size={15} className="text-schaden" />
                          <span>Betäubungsschaden (LP)</span>
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-schrift cursor-pointer select-none font-semibold">
                          <input
                            type="checkbox"
                            checked={vpHealAllStun}
                            onChange={(e) => setVpHealAllStun(e.target.checked)}
                            className="rounded-knopf border-rahmen text-unverletzt focus:ring-unverletzt"
                          />
                          <span>Komplett heilen</span>
                        </label>
                      </div>

                      {!vpHealAllStun && (
                        <div className="flex items-center justify-between pt-1 border-t border-rahmen">
                          <span className="text-xs text-leise">Maximal zu heilende LP:</span>
                          <div className="flex items-center rounded-knopf border border-rahmen bg-erhoeht overflow-hidden h-7">
                            <Knopf
                              onClick={() => setVpStunAmount((prev) => Math.max(0, prev - 1))}
                              className="w-7 h-full"
                            >
                              −
                            </Knopf>
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={vpStunAmount}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setVpStunAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-12 h-full text-center font-bold text-xs text-schrift bg-transparent border-0 outline-none"
                            />
                            <Knopf
                              onClick={() => setVpStunAmount((prev) => prev + 1)}
                              className="w-7 h-full"
                            >
                              +
                            </Knopf>
                          </div>
                        </div>
                      )}
                      <p className="text-[11px] text-leise">
                        {vpHealAllStun
                          ? 'Entfernt sämtlichen Betäubungsschaden (Gelb ✕ / Blau /) aus der Schadensleiste.'
                          : `Heilt maximal ${vpStunAmount} Punkte Betäubungsschaden.`}
                      </p>
                    </div>

                    {/* Erschöpfter Fokus */}
                    <div className="bg-flaeche rounded-knopf border border-rahmen p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-schrift flex items-center gap-1.5">
                          <Sparkles size={15} className="text-kanalisiert" />
                          <span>Erschöpfter Fokus (FO)</span>
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-schrift cursor-pointer select-none font-semibold">
                          <input
                            type="checkbox"
                            checked={vpHealAllFocus}
                            onChange={(e) => setVpHealAllFocus(e.target.checked)}
                            className="rounded-knopf border-rahmen text-unverletzt focus:ring-unverletzt"
                          />
                          <span>Komplett heilen</span>
                        </label>
                      </div>

                      {!vpHealAllFocus && (
                        <div className="flex items-center justify-between pt-1 border-t border-rahmen">
                          <span className="text-xs text-leise">Maximal zu heilender FO:</span>
                          <div className="flex items-center rounded-knopf border border-rahmen bg-erhoeht overflow-hidden h-7">
                            <Knopf
                              onClick={() => setVpFocusAmount((prev) => Math.max(0, prev - 1))}
                              className="w-7 h-full"
                            >
                              −
                            </Knopf>
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={vpFocusAmount}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setVpFocusAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-12 h-full text-center font-bold text-xs text-schrift bg-transparent border-0 outline-none"
                            />
                            <Knopf
                              onClick={() => setVpFocusAmount((prev) => prev + 1)}
                              className="w-7 h-full"
                            >
                              +
                            </Knopf>
                          </div>
                        </div>
                      )}
                      <p className="text-[11px] text-leise">
                        {vpHealAllFocus
                          ? 'Stellt sämtlichen erschöpften Fokus wieder her & beendet kanalisierte Zauber.'
                          : `Stellt maximal ${vpFocusAmount} Punkte erschöpften Fokus wieder her.`}
                      </p>
                    </div>

                    {/* Erschöpfung & Zustände */}
                    <div className="bg-flaeche rounded-knopf border border-rahmen p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-schrift text-xs">Erschöpfung abbauen:</span>
                        <div className="flex items-center rounded-knopf border border-rahmen bg-erhoeht overflow-hidden h-7">
                          <Knopf
                            onClick={() => setVpExhaustReduction((prev) => Math.max(0, prev - 1))}
                            className="w-7 h-full"
                          >
                            −
                          </Knopf>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={vpExhaustReduction}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setVpExhaustReduction(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="w-12 h-full text-center font-bold text-xs text-schrift bg-transparent border-0 outline-none"
                          />
                          <Knopf
                            onClick={() => setVpExhaustReduction((prev) => prev + 1)}
                            className="w-7 h-full"
                          >
                            +
                          </Knopf>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-rahmen">
                        <label className="flex items-center gap-2 text-xs text-schrift cursor-pointer select-none font-semibold">
                          <input
                            type="checkbox"
                            checked={vpRemoveConditions}
                            onChange={(e) => setVpRemoveConditions(e.target.checked)}
                            className="rounded-knopf border-rahmen text-unverletzt focus:ring-unverletzt"
                          />
                          <span>Zustände aufheben, die laut Regelwerk nach einer Verschnaufpause enden</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Ruhephase Calculation & Traits */}
                  <div className="bg-erhoeht border border-rahmen rounded-knopf p-3 space-y-2 text-xs text-schrift">
                    <div className="flex items-center justify-between font-bold text-schrift">
                      <span>Berechnungsgrundlage (Regel-Standard):</span>
                      <span className="font-normal text-[11px] text-leise">{regeln.quelle}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-knopf bg-flaeche border border-rahmen">
                        <div className="font-bold text-schaden">Lebenspunkte (LP):</div>
                        <div className="tabular-nums text-[11px] mt-0.5 text-schrift">
                          {`KON (${kon}) × ${lpMultiplier}${fest.map((w) => (w.lp_zusatz ? ` + ${w.lp_zusatz}` : '')).join('')} = ${calculatedLPDefault} LP`}
                        </div>
                      </div>

                      <div className="p-2 rounded-knopf bg-flaeche border border-rahmen">
                        <div className="font-bold text-schrift">Fokuspool (FO):</div>
                        <div className="tabular-nums text-[11px] mt-0.5 text-schrift">
                          {`WIL (${wil}) × ${foMultiplier} = ${calculatedFODefault} FO`}
                        </div>
                      </div>
                    </div>

                    {/* Active Modifiers info */}
                    {wirkungen.length > 0 && (
                      <div className="pt-2 border-t border-rahmen space-y-1">
                        <span className="font-semibold text-schrift block text-[11px]">Berücksichtigte Modifikatoren:</span>
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          {fest.filter((w) => w.lp_faktor || w.fo_faktor || w.lp_zusatz).map((w) => (
                            <span key={w.quelle} title={w.beleg} className="px-2 py-0.5 rounded-knopf bg-kanalisiert-grund text-schrift font-semibold border border-kanalisiert">
                              {w.quelleTyp}: {w.quelle} ({ruheText(w)})
                            </span>
                          ))}
                          {bedingt.map((w) => (
                            <span key={w.quelle} title={w.beleg} className="px-2 py-0.5 rounded-knopf bg-rahmen text-schrift border border-rahmen">
                              Nicht eingerechnet – {w.quelle} ({ruheText(w)}) {w.bedingung}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manual Value Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* LP Input */}
                    <div className="bg-flaeche rounded-knopf border border-rahmen p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-schrift text-xs flex items-center gap-1">
                          <Heart size={14} className="text-gold" />
                          <span>Zu heilende LP:</span>
                        </label>
                        <span className="text-[11px] text-leise font-medium">
                          Std: {calculatedLPDefault}
                        </span>
                      </div>

                      <div className="flex items-center rounded-knopf border border-rahmen bg-flaeche overflow-hidden h-9">
                        <Knopf
                          onClick={() => setCustomLP((prev) => Math.max(0, prev - 1))}
                          className="w-9 h-full"
                        >
                          −
                        </Knopf>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={customLP}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setCustomLP(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="flex-1 h-full text-center font-bold text-sm text-schrift bg-transparent border-0 outline-none tabular-nums"
                        />
                        <Knopf
                          onClick={() => setCustomLP((prev) => prev + 1)}
                          className="w-9 h-full"
                        >
                          +
                        </Knopf>
                      </div>
                      <p className="text-[11px] text-leise">
                        Heilt echten Schaden (Verzehrt ■ / Schrägstrich).
                      </p>
                    </div>

                    {/* FO Input */}
                    <div className="bg-flaeche rounded-knopf border border-rahmen p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-schrift text-xs flex items-center gap-1">
                          <Sparkles size={14} className="text-schrift" />
                          <span>Zu heilender FO:</span>
                        </label>
                        <span className="text-[11px] text-leise font-medium">
                          Std: {calculatedFODefault}
                        </span>
                      </div>

                      <div className="flex items-center rounded-knopf border border-rahmen bg-flaeche overflow-hidden h-9">
                        <Knopf
                          onClick={() => setCustomFO((prev) => Math.max(0, prev - 1))}
                          className="w-9 h-full"
                        >
                          −
                        </Knopf>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={customFO}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setCustomFO(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="flex-1 h-full text-center font-bold text-sm text-schrift bg-transparent border-0 outline-none tabular-nums"
                        />
                        <Knopf
                          onClick={() => setCustomFO((prev) => prev + 1)}
                          className="w-9 h-full"
                        >
                          +
                        </Knopf>
                      </div>
                      <p className="text-[11px] text-leise">
                        Regeneriert verzehrten Fokus.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-erhoeht border-t border-rahmen flex flex-wrap items-center justify-between gap-2.5">
              {/* Reset to standard button (only if modified) */}
              <div>
                {activeModal === 'verschnaufpause' && !isVpDefault && (
                  <Knopf
                    onClick={resetVpToDefault}
                    className="gap-1.5 text-xs hover:underline"
                  >
                    <RotateCcw size={13} />
                    <span>Standardwerte wiederherstellen</span>
                  </Knopf>
                )}

                {activeModal === 'ruhephase' && !isRuhephaseDefault && (
                  <Knopf
                    onClick={resetRuhephaseToDefault}
                    className="gap-1.5 text-xs hover:underline"
                  >
                    <RotateCcw size={13} />
                    <span>Standardwerte wiederherstellen</span>
                  </Knopf>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <Knopf
                  onClick={() => setActiveModal(null)}
                  className="text-xs"
                >
                  Übernehmen &amp; Schließen
                </Knopf>

                {activeModal === 'verschnaufpause' ? (
                  <Knopf art="erholung"
                    onClick={handleExecuteVerschnaufpause}
                    className="text-xs gap-1.5"
                  >
                    <Sun size={14} className="text-gold" />
                    <span>Jetzt durchführen</span>
                  </Knopf>
                ) : (
                  <Knopf art="erholung"
                    onClick={handleExecuteRuhephase}
                    className="text-xs gap-1.5"
                  >
                    <Moon size={14} className="text-gold" />
                    <span>Jetzt durchführen</span>
                  </Knopf>
                )}
              </div>
            </div>
          </Dialogfenster>
        </Dialoghintergrund>
      )}
    </div>
  );
};
