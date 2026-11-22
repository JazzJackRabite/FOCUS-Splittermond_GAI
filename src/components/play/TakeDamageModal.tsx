import { wundstufenVerschiebung } from '../../regelwerk/zustaende';
import { splitterSchadensminderung, standardGesundheitsstufen, sterberegeln, zustaendeFuerSchaden } from '../../regelwerk/schadenUndHeilung';
import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, Wahlknopf, useEscape } from '../../fundament';
import React, { useId, useMemo, useState } from 'react';
import { Flame, Shield, Sparkles, X, Plus, Minus, AlertTriangle, Heart, Check } from 'lucide-react';
import type { HealthSlot } from '../../types';

export interface TakeDamageModalProps {
  onClose: () => void;
  maxLP: number;
  derivedSR: number;
  armorSR: number;
  currentSplitterPoints: number;
  activeTempHP: number;
  currentHealthSlots: HealthSlot[];
  /** aktive Zustände (für die Vorschau des Wundabzugs: Verwundet u. ä.) */
  aktiveZustaende?: Array<{ key: string; level?: number }>;
  /** Gesundheitsstufen (Standard: die fünf des GRW); Begleiter mit Schwächlich/Zerbrechlich haben weniger */
  stufen?: { name: string; wundabzug: number }[];
  /** Für Begleiter: ohne Splitterpunkte, temporäre LP und Zustände des Helden; Name für die Überschrift */
  begleiter?: string;
  onApplyDamage: (result: {
    kind: 'consumed' | 'exhausted' | 'channeled';
    amount: number;
    spendSplitter: boolean;
    selectedConditions: Array<{ key: string; level?: number }>;
    note?: string;
  }) => void;
}

export const TakeDamageModal: React.FC<TakeDamageModalProps> = ({
  stufen: stufenProp,
  begleiter,
  onClose,
  maxLP,
  derivedSR,
  currentSplitterPoints,
  activeTempHP,
  currentHealthSlots,
  aktiveZustaende = [],
  onApplyDamage,
}) => {
  const stufen = useMemo(() => stufenProp ?? standardGesundheitsstufen(), [stufenProp]);
  const splitter = useMemo(() => splitterSchadensminderung(), []);
  const zustaende = useMemo(() => zustaendeFuerSchaden(), []);
  // Raw incoming damage
  const [rawDamage, setRawDamage] = useState<number>(5);

  // Damage type (GRW: Echter Schaden [consumed], Betäubung [exhausted], Kanalisiert [channeled])
  const [damageKind, setDamageKind] = useState<'consumed' | 'exhausted' | 'channeled'>('consumed');

  // Schadensreduktion (SR / Panzerung)
  const [applySR, setApplySR] = useState<boolean>(derivedSR > 0);
  const [effectiveSR, setEffectiveSR] = useState<number>(derivedSR);

  // Splitterpunkt: Schadensminderung (Splittergaben, Wert aus dem Paket)
  const [useSplitter, setUseSplitter] = useState<boolean>(false);

  const [extraCondition, setExtraCondition] = useState<string>(() => zustaende[0]?.name ?? '');
  const [extraLevel, setExtraLevel] = useState<number>(1);
  const [extraConditionsList, setExtraConditionsList] = useState<Array<{ key: string; level?: number }>>([]);

  // Optional note / source
  const [damageNote, setDamageNote] = useState<string>('');

  // Calculations
  const damageAfterSR = useMemo(() => {
    if (!applySR) return rawDamage;
    return Math.max(0, rawDamage - effectiveSR);
  }, [rawDamage, applySR, effectiveSR]);

  const finalDamage = useMemo(() => {
    let dmg = damageAfterSR;
    if (splitter && useSplitter && currentSplitterPoints > 0) {
      // Splittergabe Schadensminderung: Schaden aus einer Quelle senken (einmal je Schadensquelle)
      dmg = Math.max(0, dmg - splitter.punkte);
    }
    return Math.max(0, dmg);
  }, [damageAfterSR, useSplitter, currentSplitterPoints, splitter]);

  // Temp HP absorption estimation
  const absorbedByTemp = useMemo(() => {
    return Math.min(activeTempHP, finalDamage);
  }, [activeTempHP, finalDamage]);

  const damageHittingHealth = useMemo(() => {
    return Math.max(0, finalDamage - absorbedByTemp);
  }, [finalDamage, absorbedByTemp]);

  const sterben = useMemo(() => sterberegeln(), []);

  // Wound preview simulation
  const woundPreview = useMemo(() => {
    const HEALTH_LEVEL_NAMES = stufen.map((x) => x.name);
    const WOUND_PENALTIES = stufen.map((x) => x.wundabzug);
    const letzte = stufen.length - 1;

    const currentConsumed = currentHealthSlots.filter((s) => s.type === 'consumed').length;
    const currentFilled = currentHealthSlots.filter((s) => s.type !== 'empty').length;

    let curLevelIndex = 0;
    if (currentConsumed > maxLP) {
      curLevelIndex = Math.min(letzte, Math.floor((currentConsumed - 1) / maxLP));
    }

    // Simulate after damage
    let simConsumed = currentConsumed;
    let simTotalFilled = currentFilled + damageHittingHealth;
    const totalSlots = maxLP * stufen.length;

    if (damageKind === 'consumed') {
      simConsumed += damageHittingHealth;
    } else {
      // If exhausted or channeled, check overflow
      if (simTotalFilled > totalSlots) {
        const overflow = simTotalFilled - totalSlots;
        simConsumed += overflow;
      }
    }

    let nextLevelIndex = 0;
    if (simConsumed > maxLP) {
      nextLevelIndex = Math.min(letzte, Math.floor((simConsumed - 1) / maxLP));
    }

    const curName = HEALTH_LEVEL_NAMES[curLevelIndex] ?? 'Unverletzt';
    const nextName = HEALTH_LEVEL_NAMES[nextLevelIndex] ?? 'Unverletzt';
    // Verwundet u. ä. (Paketfeld wundstufe): Wundabzug um Stufen tiefer, auch durch Zustände dieses Treffers
    const schieben = wundstufenVerschiebung([...aktiveZustaende, ...extraConditionsList]);
    const nextPenalty = WOUND_PENALTIES[Math.min(letzte, nextLevelIndex + schieben)] ?? 0;
    const isWoundIncreased = nextLevelIndex > curLevelIndex || schieben > wundstufenVerschiebung(aktiveZustaende);
    const isDying = nextLevelIndex === letzte || simTotalFilled >= totalSlots;

    return {
      curName,
      nextName,
      nextPenalty,
      isWoundIncreased,
      isDying,
      simTotalFilled,
      totalSlots,
    };
  }, [currentHealthSlots, maxLP, damageHittingHealth, damageKind, stufen, aktiveZustaende, extraConditionsList]);

  // Handlers
  const gewaehlterZustand = zustaende.find((x) => x.name === extraCondition);

  const handleAddExtraCondition = () => {
    if (!extraCondition) return;
    const z = zustaende.find((x) => x.name === extraCondition);
    const hasLvl = !!z?.mitStufe;
    setExtraConditionsList((prev) => [
      ...prev,
      { key: extraCondition, level: hasLvl ? extraLevel : undefined },
    ]);
  };

  const handleRemoveExtraCondition = (index: number) => {
    setExtraConditionsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const selectedConds: Array<{ key: string; level?: number }> = [];

    selectedConds.push(...extraConditionsList);

    onApplyDamage({
      kind: damageKind,
      amount: finalDamage,
      spendSplitter: !begleiter && !!splitter && useSplitter && currentSplitterPoints > 0,
      selectedConditions: begleiter ? [] : selectedConds,
      note: damageNote.trim() || undefined,
    });

    onClose();
  };

  const titelId = useId();
  useEscape(onClose);
  return (
    <Dialoghintergrund>
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId} breite="lg">
        {/* Header */}
        <Dialogkopf
          titelId={titelId}
          symbol={<Flame size={18} />}
          ton="schaden"
          titel={begleiter ? `${begleiter}: Schaden erleiden` : 'Schaden erleiden'}
          untertitel="Grundregelwerk (GRW S. 172–173 & S. 81)"
          onSchliessen={onClose}
        />

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {/* 1. Eingehender Schaden (Brutto) */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2.5">
            <label className="block text-xs font-bold text-gold uppercase tracking-wider">
              1. Eingehender Schaden (Brutto)
            </label>
            <div className="flex items-center gap-2">
              <Knopf
                onClick={() => setRawDamage((d) => Math.max(0, d - 5))}
                className="text-xs"
              >
                -5
              </Knopf>
              <Knopf nurSymbol
                onClick={() => setRawDamage((d) => Math.max(0, d - 1))}
              >
                <Minus size={14} />
              </Knopf>

              <div className="flex-1 text-center">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={rawDamage}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setRawDamage(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center bg-seite border border-gold rounded-knopf py-1.5 text-2xl tabular-nums font-bold text-schrift focus:outline-none focus:border-gold"
                />
              </div>

              <Knopf nurSymbol
                onClick={() => setRawDamage((d) => d + 1)}
              >
                <Plus size={14} />
              </Knopf>
              <Knopf
                onClick={() => setRawDamage((d) => d + 5)}
                className="text-xs"
              >
                +5
              </Knopf>
              <Knopf
                onClick={() => setRawDamage((d) => d + 10)}
                className="text-xs"
              >
                +10
              </Knopf>
            </div>
          </div>

          {/* 2. Schadenstyp (GRW S. 172–173) */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2">
            <label className="block text-xs font-bold text-gold uppercase tracking-wider">
              2. Schadenstyp (GRW S. 172–173)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Echter Schaden */}
              <Wahlknopf gewaehlt={damageKind === 'consumed'} ton="gefahr" onClick={() => setDamageKind('consumed')}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-xs">Echter Schaden</span>
                  <span className="text-schaden font-bold tabular-nums text-xs">■</span>
                </div>
                <div className="text-[11px] text-leise leading-tight">Wunden, Stürze, Waffen</div>
              </Wahlknopf>

              {/* Betäubungsschaden */}
              <Wahlknopf gewaehlt={damageKind === 'exhausted'} onClick={() => setDamageKind('exhausted')}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-xs">Betäubung</span>
                  <span className="text-gold font-bold tabular-nums text-xs">/</span>
                </div>
                <div className="text-[11px] text-leise leading-tight">Stumpfe Hiebe, Schock</div>
              </Wahlknopf>

              {/* Kanalisierter Schaden */}
              <Wahlknopf gewaehlt={damageKind === 'channeled'} onClick={() => setDamageKind('channeled')}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-xs">Kanalisiert</span>
                  <span className="text-kanalisiert font-bold tabular-nums text-xs">X</span>
                </div>
                <div className="text-[11px] text-leise leading-tight">Magische Bindung</div>
              </Wahlknopf>
            </div>
          </div>

          {/* 3. Schadensreduktion (SR / Panzerung) */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applySR}
                  onChange={(e) => setApplySR(e.target.checked)}
                  className="rounded-knopf text-gold focus:ring-0 cursor-pointer w-4 h-4"
                />
                <Shield size={14} className="text-gold" />
                <span>3. Schadensreduktion (SR) anwenden</span>
              </label>
              {applySR && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-leise font-semibold">Effektive SR:</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={effectiveSR}
                    onChange={(e) => setEffectiveSR(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-12 bg-seite border border-rahmen rounded-knopf px-1.5 py-0.5 text-center text-xs tabular-nums font-bold text-schrift focus:outline-none focus:border-gold"
                  />
                </div>
              )}
            </div>

            {applySR && (
              <div className="text-[11px] text-leise flex items-center justify-between bg-seite px-2.5 py-1.5 rounded-knopf border border-rahmen">
                <span>
                  {begleiter ? 'SR' : 'Basis-SR des Helden'}: <strong className="text-schrift">{derivedSR}</strong>
                </span>
                <span className="text-schrift">
                  {rawDamage} Brutto − {effectiveSR} SR = <strong className="text-gold">{damageAfterSR} Schaden</strong>
                </span>
              </div>
            )}
          </div>

          {!begleiter && (<>
          {/* 4. Splitterpunkt: Schadensminderung (Wert aus dem Paket) */}
          {splitter && <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label
                className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  currentSplitterPoints > 0 ? 'text-gold cursor-pointer' : 'text-leise cursor-not-allowed'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={currentSplitterPoints <= 0}
                  checked={useSplitter && currentSplitterPoints > 0}
                  onChange={(e) => setUseSplitter(e.target.checked)}
                  className="rounded-knopf text-gold focus:ring-0 cursor-pointer w-4 h-4 disabled:opacity-40"
                />
                <Sparkles size={14} className={currentSplitterPoints > 0 ? 'text-gold' : 'text-leise'} />
                <span>4. Splitterpunkt: Schaden um {splitter.punkte} reduzieren</span>
              </label>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-knopf border ${
                  currentSplitterPoints > 0
                    ? 'bg-erhoeht text-gold border-gold'
                    : 'bg-schaden-grund text-schrift border-schaden'
                }`}
              >
                {currentSplitterPoints} SP verfügbar
              </span>
            </div>

            {useSplitter && currentSplitterPoints > 0 && (
              <div className="text-[11px] text-schrift bg-flaeche px-2.5 py-1.5 rounded-knopf border border-rahmen flex items-center justify-between">
                <span>{splitter.quelle}: {splitter.text} (1 SP)</span>
                <span className="text-gold font-bold">
                  {damageAfterSR} → {finalDamage} Schaden (−{Math.min(splitter.punkte, damageAfterSR)})
                </span>
              </div>
            )}
          </div>}

          {/* 5. Temporäre Lebenspunkte */}
          {activeTempHP > 0 && (
            <div className="bg-temporaer-grund border border-temporaer rounded-knopf p-2.5 text-xs text-temporaer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart size={14} className="text-temporaer" />
                <span>
                  Temporäre LP aktiv: <strong>{activeTempHP} Temp LP</strong>
                </span>
              </div>
              <span className="text-[11px] text-temporaer">
                {absorbedByTemp > 0 ? `${absorbedByTemp} absorbieren den Schaden` : 'Kein Schaden erreicht Temp LP'}
              </span>
            </div>
          )}

          {/* 6. Zustände hinzufügen (GRW S. 168–169) */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2.5">
            <label className="block text-xs font-bold text-gold uppercase tracking-wider">
              5. Zustände durch den Treffer (GRW S. 168–169)
            </label>

            {/* Additional condition dropdown */}
            <div className="pt-2 border-t border-rahmen flex items-center gap-2">
              <select
                value={extraCondition}
                onChange={(e) => setExtraCondition(e.target.value)}
                className="bg-seite border border-rahmen rounded-knopf px-2 py-1 text-xs text-schrift font-medium focus:outline-none focus:border-gold flex-1 min-w-[120px]"
              >
                {zustaende.map((z) => (
                  <option key={z.name} value={z.name} title={`Quelle: ${z.quelle}`}>
                    {z.name}
                  </option>
                ))}
              </select>

              {gewaehlterZustand?.mitStufe && (
                <input
                  type="number"
                  min={1}
                  max={gewaehlterZustand.hoechststufe}
                  aria-label={`Stufe ${extraCondition}`}
                  value={extraLevel}
                  onChange={(e) => {
                    const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setExtraLevel(gewaehlterZustand.hoechststufe ? Math.min(gewaehlterZustand.hoechststufe, n) : n);
                  }}
                  className="w-12 bg-seite border border-rahmen rounded-knopf px-1.5 py-1 text-center text-xs tabular-nums font-bold text-schrift focus:outline-none focus:border-gold"
                />
              )}

              <Knopf
                onClick={handleAddExtraCondition}
                className="text-xs shrink-0"
              >
                + Zustand
              </Knopf>
            </div>

            {/* Selected extra conditions pills */}
            {extraConditionsList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {extraConditionsList.map((item, idx) => (
                  <span
                    key={`${item.key}-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-erschoepft-grund border border-gold text-[11px] text-gold-hell"
                  >
                    <span>
                      {item.key}
                      {item.level ? ` ${item.level}` : ''}
                    </span>
                    <Knopf
                      onClick={() => handleRemoveExtraCondition(idx)}
                      className="ml-0.5"
                    >
                      ×
                    </Knopf>
                  </span>
                ))}
              </div>
            )}
          </div>
          </>)}

          {/* 7. Wundstufen-Vorschau (GRW S. 172) */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-leise font-semibold">Wundstufen-Vorschau:</span>
              <div className="flex items-center gap-1.5 font-bold">
                <span className="text-schrift">{woundPreview.curName}</span>
                <span className="text-leise">→</span>
                <span className={woundPreview.isWoundIncreased ? 'text-schaden' : 'text-schrift'}>
                  {woundPreview.nextName}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-rahmen">
              <span className="text-leise">Wundabzug auf alle Proben:</span>
              <span
                className={`tabular-nums font-bold ${
                  woundPreview.nextPenalty < 0 ? 'text-schaden' : 'text-schrift'
                }`}
              >
                {woundPreview.nextPenalty}
              </span>
            </div>

            {woundPreview.isDying && (
              <div className="mt-1 bg-schaden-grund border border-schaden rounded-knopf px-2.5 py-1 text-xs text-schrift flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-schaden shrink-0" />
                <span className="font-bold">
                  Achtung: Todgeweiht oder alle Lebenspunkte aufgebraucht (Sterbend / Bewusstlos)!
                  {sterben?.probe && damageKind === 'consumed' && !begleiter && (
                    <> Beim ersten echten Punkt auf {woundPreview.nextName}: Probe auf {sterben.probe.fertigkeit} gegen {sterben.probe.schwierigkeit}, sonst bewusstlos ({sterben.quelle}).</>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* 8. Schadensquelle / Notiz */}
          <div>
            <label className="block text-[11px] font-bold text-leise uppercase tracking-wide mb-1">
              Schadensquelle / Notiz (optional)
            </label>
            <input
              type="text"
              placeholder="z. B. Ork-Krieger Kriegsaxt, Sturz aus 5m, Feuerfalle"
              value={damageNote}
              onChange={(e) => setDamageNote(e.target.value)}
              className="w-full bg-seite border border-rahmen rounded-knopf px-2.5 py-1.5 text-xs text-schrift placeholder-leise focus:outline-none focus:border-gold"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-4 sm:px-5 py-3 border-t border-rahmen bg-seite flex items-center justify-between gap-3 shrink-0">
          <Knopf
            onClick={onClose}
            className="text-xs"
          >
            Abbrechen
          </Knopf>

          <Knopf art="primaer"
            onClick={() => handleSubmit()}
            className="text-xs sm:text-sm gap-1.5"
          >
            <Check size={16} />
            <span>
              {finalDamage} {damageKind === 'consumed' ? 'echten' : damageKind === 'exhausted' ? 'Betäubungs-' : 'kanalis.'} Schaden anwenden
            </span>
          </Knopf>
        </div>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};
